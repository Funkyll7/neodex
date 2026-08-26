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

/* Changer ce numero purge les anciens caches au prochain chargement. */
const VERSION = "neodex-v1";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const SPRITES = `${VERSION}-sprites`;

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
  "./assets/img/gigamax.png",
  "./assets/img/gigamax-nb.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // `addAll` echoue en bloc si un seul fichier manque. On prefere un cache
      // partiel a une installation qui ne se fait jamais.
      .then((cache) => Promise.allSettled(SHELL_FILES.map((file) => cache.add(file))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const garder = new Set([SHELL, DATA, SPRITES]);
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => !garder.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Une ecriture ne se met pas en cache, et ne se rejoue pas.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // L'API GitHub passe en direct, toujours.
  if (url.hostname === "api.github.com") return;

  if (url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.gstatic.com") {
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

  event.respondWith(reseauDAbord(request, SHELL));
});

/**
 * Reseau d'abord : la reponse fraiche gagne toujours, le cache ne sert que
 * lorsqu'elle n'arrive pas.
 */
async function reseauDAbord(request, nomCache) {
  try {
    const reponse = await fetch(request);
    if (reponse && reponse.ok) {
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
    fetch(request)
      .then(async (reponse) => {
        if (reponse && reponse.ok) (await caches.open(nomCache)).put(request, reponse.clone());
      })
      .catch(() => {});
    return enCache;
  }

  const reponse = await fetch(request);
  if (reponse && reponse.ok) {
    const cache = await caches.open(nomCache);
    cache.put(request, reponse.clone());
  }
  return reponse;
}
