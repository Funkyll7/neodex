/**
 * sw.js — cache hors ligne.
 *
 * Le site sert a cocher des cases pendant qu'on joue : sur telephone, dans le
 * train, en salle d'attente. C'est exactement la ou le reseau manque. Sans
 * cache, chaque ouverture retelecharge 27 fichiers JSON et des centaines de
 * sprites.
 *
 * Trois regimes, et le choix de chacun se resume a une question : « servir une
 * version perimee, est-ce grave ? »
 *
 *   Coquille (html, css, js)  RESEAU D'ABORD.
 *       Le site se met a jour par un simple `git push`, sans etape de build :
 *       un service worker qui servirait du code perime figerait le site dans
 *       une version ancienne sans aucun moyen de s'en sortir. C'est le piege
 *       classique, on l'evite en interrogeant toujours le reseau d'abord.
 *
 *   collection.json           RESEAU D'ABORD, et sans discussion.
 *       C'est la collection. Servir une version d'hier ferait *disparaitre*
 *       des cases cochees sous les yeux de l'utilisateur. Le cache n'est la
 *       que comme dernier recours, hors ligne.
 *
 *   Donnees de reference      CACHE D'ABORD, rafraichi en arriere-plan.
 *   et sprites                Les JSON de data/ ne bougent qu'a une
 *       regeneration, et les sprites sont epingles sur un SHA (voir
 *       config.js) : leur URL ne designera jamais une autre image. Rien de ce
 *       qui est en cache ne peut donc devenir faux.
 *
 * L'API GitHub n'est jamais interceptee : une ecriture doit partir sur le
 * reseau ou echouer franchement, jamais etre servie depuis un cache.
 */

/* Changer ce numero purge les anciens caches au prochain chargement.
   v2 : les reponses opaques (sprites) entrent enfin dans le cache.
   v3 : les requetes de la coquille contournent le cache HTTP. Les caches v2
        contiennent du JS perime, il faut les jeter.
   v16 : `no-cache` remplace `no-store` — meme garantie de fraicheur, mais la
        revalidation redevient possible et la coquille n'est plus
        retelechargee en entier a chaque ouverture. */
const VERSION = "funkylldex-v17";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const SPRITES = `${VERSION}-sprites`;
/** Captures recues par le menu « Partager » d Android, en attente de lecture. */
const PARTAGE = `${VERSION}-partage`;

/** Ce qu'il faut avoir sous la main pour que le site demarre hors ligne. */
const SHELL_FILES = [
  "./",
  "./index.html",
  "./assets/css/theme.css",
  "./assets/css/base.css",
  "./assets/css/layout.css",
  "./assets/css/components.css",
  "./assets/js/main.js",
  "./assets/img/favicon.svg",
  // Les pastilles des boutons et les logos de famille : quelques kilo-octets,
  // mais visibles sur chaque vignette. Sans eux hors ligne, la grille se
  // couvrait de carres vides.
  "./assets/img/capture.png",
  "./assets/img/capture-forme.png",
  "./assets/img/shiny.png",
  "./assets/img/forme-alola.png",
  "./assets/img/forme-galar.png",
  "./assets/img/forme-hisui.png",
  "./assets/img/forme-paldea.png",
  "./assets/img/gigamax.png",
  "./assets/img/gigamax-nb.png",
  "./assets/img/logo-home.png",
  "./assets/img/logo-go.png",
  "./assets/img/logo-quete.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // `addAll` echoue en bloc si un seul fichier manque. On prefere un cache
      // partiel a une installation qui ne se fait jamais.
      // `no-cache` pour la meme raison qu'ailleurs : `cache.add()` passerait
      // sinon par le cache HTTP, et on installerait une coquille deja perimee.
      .then((cache) =>
        Promise.allSettled(
          SHELL_FILES.map((file) =>
            fetch(file, { cache: "no-cache" }).then((r) => (r.ok ? cache.put(file, r) : null))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const garder = new Set([SHELL, DATA, SPRITES, PARTAGE]);
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => !garder.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

/**
 * Partage Android : les captures arrivent ici, pas dans la page.
 *
 * Quand on choisit Funkylldex dans le menu « Partager » du telephone, le
 * systeme envoie un POST multipart vers `share_target.action`. Cette requete
 * n'atteint jamais le serveur — GitHub Pages ne sait pas la traiter, et de
 * toute facon les images n'ont aucune raison de quitter le telephone. C'est le
 * worker qui l'intercepte.
 *
 * On range les fichiers dans un cache dedie, puis on redirige vers la page.
 * Un `postMessage` ne conviendrait pas : au moment du partage il n'y a pas
 * encore de page ouverte a qui parler.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method === "POST" && new URL(request.url).searchParams.has("partage")) {
    event.respondWith(recevoirPartage(request));
    return;
  }

  // Une ecriture ne se met pas en cache, et ne se rejoue pas.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // L'API GitHub passe en direct, toujours.
  if (url.hostname === "api.github.com") return;

  // `play.pokemonshowdown.com` sert les sprites du projet Smogon, employes par
  // le theme « Pixels » pour les formes qu'aucune autre source ne couvre.
  if (
    url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "play.pokemonshowdown.com"
  ) {
    event.respondWith(cacheDAbord(request, SPRITES));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/data/collection.json")) {
    event.respondWith(reseauDAbord(request, DATA));
    return;
  }

  if (url.pathname.includes("/data/")) {
    event.respondWith(cacheDAbord(request, DATA));
    return;
  }

  // Les sprites deposes dans le depot ne changent jamais : leur contenu est fige
  // par le nom du fichier. Cache d'abord, comme les sprites distants — le reste
  // du site reste en reseau d'abord, pour qu'une mise en ligne se voie tout de
  // suite.
  if (url.pathname.includes("/assets/img/pixels/")) {
    event.respondWith(cacheDAbord(request, SPRITES));
    return;
  }

  event.respondWith(reseauDAbord(request, SHELL));
});

/**
 * Range les captures partagees et renvoie la page.
 *
 * Le cache plutot qu'IndexedDB : les fichiers sont deja des `Blob`, une
 * `Response` les stocke telle quelle, et la page les relit avec le meme
 * `caches.match` qu'elle connait deja. Trois lignes contre une base.
 *
 * On vide le cache avant : deux partages de suite ne doivent pas melanger
 * leurs captures, et l'ordre compte — c'est de lui que vient la contrainte du
 * dex croissant.
 *
 * La redirection est une 303 : sans elle, un rechargement de la page
 * renverrait le POST une seconde fois.
 */
async function recevoirPartage(request) {
  try {
    const form = await request.formData();
    const fichiers = form.getAll("captures").filter((f) => f && f.size);
    const cache = await caches.open(PARTAGE);
    for (const cle of await cache.keys()) await cache.delete(cle);
    // Numerotees sur trois chiffres : la page les relit dans l'ordre, et c'est
    // l'ordre des captures qui rend la reconnaissance fiable.
    await Promise.all(
      fichiers.map((f, i) =>
        cache.put(
          `/partage/${String(i).padStart(3, "0")}`,
          new Response(f, { headers: { "content-type": f.type || "image/jpeg" } })
        )
      )
    );
  } catch (error) {
    // Un partage rate ne doit pas laisser l'utilisateur devant une page
    // d'erreur : on ouvre le site normalement, il choisira ses fichiers.
    console.warn("Funkylldex : partage illisible.", error);
  }
  return Response.redirect("./?partage=1", 303);
}

/**
 * Une reponse est-elle bonne a mettre en cache ?
 *
 * `response.ok` ne suffit pas. Les sprites viennent d'un autre domaine et sont
 * demandes par des balises <img> : ce sont des requetes `no-cors`, dont la
 * reponse est *opaque* — status 0, `ok` a false, contenu illisible pour nous.
 * Elle s'affiche parfaitement, mais un test sur `ok` la rejette.
 *
 * Sans cette exception, les images — de loin le plus lourd, et la raison meme
 * d'avoir un cache — n'y entraient jamais.
 */
function cachable(reponse) {
  return Boolean(reponse) && (reponse.ok || reponse.type === "opaque");
}

/**
 * Reseau d'abord : la reponse fraiche gagne toujours, le cache ne sert que
 * lorsqu'elle n'arrive pas.
 */
async function reseauDAbord(request, nomCache) {
  try {
    // Contourner le cache HTTP n'est pas un detail : sans cela, ce `fetch`
    // pouvait rendre une copie vieille de plusieurs minutes — GitHub Pages sert
    // le JS avec un `max-age` de dix minutes — et le worker la rangeait ensuite
    // dans SON cache. C'est exactement comme ca que le site a servi un
    // index.html neuf avec un sidebar.js perime, et s'est arrete sur « Cannot
    // set properties of null ».
    //
    // Mais `no-store`, employe jusqu'ici, allait trop loin : il interdit aussi
    // la REVALIDATION. Le navigateur retelechargeait donc le corps entier de
    // chaque fichier a chaque ouverture, meme inchange.
    //
    // `no-cache` garde la garantie et rend l'economie : le navigateur demande
    // toujours au serveur, mais avec l'empreinte qu'il detient. Verifie sur le
    // site en ligne — GitHub Pages envoie bien un ETag et repond « 304, corps
    // vide » quand rien n'a bouge. C'est le serveur qui tranche, jamais le
    // cache tout seul : la fraicheur est aussi sure qu'avant.
    const reponse = await fetch(request, { cache: "no-cache" });
    if (cachable(reponse)) {
      const cache = await caches.open(nomCache);
      cache.put(request, reponse.clone());
    }
    return reponse;
  } catch (error) {
    const enCache = await caches.match(request);
    if (enCache) return enCache;
    throw error;
  }
}

/**
 * Cache d'abord : on repond immediatement, et on rafraichit en arriere-plan
 * pour la fois d'apres. Reserve a ce qui ne peut pas devenir faux.
 */
async function cacheDAbord(request, nomCache) {
  const enCache = await caches.match(request);

  if (enCache) {
    // Rafraichissement en arriere-plan : on ne l'attend pas, et son echec est
    // sans consequence puisqu'on a deja repondu.
    //
    // Sauf pour les sprites. Leur adresse porte le SHA du depot (voir
    // config.js) : elle ne designera JAMAIS une autre image. Les rafraichir
    // revenait a retelecharger, puis a reecrire dans le cache, mot pour mot ce
    // qu'on venait de servir — une requete et une ecriture par sprite affiche,
    // a chaque ouverture, pour un resultat identique par construction.
    if (nomCache !== SPRITES) {
      fetch(request)
        .then(async (reponse) => {
          if (cachable(reponse)) (await caches.open(nomCache)).put(request, reponse.clone());
        })
        .catch(() => {});
    }
    return enCache;
  }

  const reponse = await fetch(request);
  if (cachable(reponse)) {
    const cache = await caches.open(nomCache);
    cache.put(request, reponse.clone());
  }
  return reponse;
}
