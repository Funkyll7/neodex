/**
 * quetes.js — le carnet de chasses, et sa fusion entre appareils.
 *
 * Une CHASSE est un compteur de rencontres sur une espèce, dans un jeu. Elle
 * naît au premier appui sur « +1 », jamais d'un tirage : la quête affichée est
 * éphémère et locale, le carnet est durable et partagé.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA LOI DE CE MODULE, à ne jamais enfreindre :
 *
 *     sanitizeQuetes(toExport().quetes)  ≡  l'état lui-même
 *
 * Autrement dit : AUCUNE normalisation à l'export. Pas d'élagage, pas de
 * borne, pas de tri, pas de champ interne ajouté au passage.
 *
 * Pourquoi c'est vital. Après une écriture réussie, `sync.js` fait adopter au
 * dépôt ce qu'on vient d'y mettre, puis replanifie une écriture s'il reste
 * quelque chose à envoyer. Si l'export normalisait autrement que l'état, la
 * différence renaîtrait aussitôt, « il reste à envoyer » resterait vrai, et
 * l'on commiterait toutes les quatre secondes, sur chaque onglet ouvert,
 * indéfiniment.
 *
 * Le chemin des cases tient cette loi par accident — `toExport` n'y fait que
 * `sanitize` + tri, et l'adoption recalcule avec le même `sanitize`, donc le
 * point fixe tombe au premier tour. Ici il faut la tenir exprès.
 * ────────────────────────────────────────────────────────────────────────
 *
 * LA FUSION EST UNE JOINTURE, pas un arbitrage. Union des parties, `max` par
 * colonne, treillis pour le statut : trois opérations idempotentes,
 * commutatives et associatives. Il n'y a donc pas d'ancêtre à connaître, pas
 * d'ordre à respecter, et rejouer une fusion ne change rien. C'est ce qui rend
 * ce carnet incapable de perdre quoi que ce soit — contrairement aux cases,
 * qui ont besoin de leur ancêtre pour distinguer « décoché » de « jamais eu ».
 */

/** Codes de jeu acceptés : deux à douze caractères, minuscules et chiffres. */
const CLE_PARTIE = /^\d{10,16}-[0-9a-f]{4}$/;
const CODE_JEU = /^[a-z0-9-]{2,12}$/;
const APPAREIL = /^[0-9a-f]{6}$/;

/**
 * Les statuts, du plus faible au plus fort.
 *
 * Un treillis et non un simple « le dernier gagne » : sans ordre total, deux
 * appareils qui terminent la même chasse différemment se contrediraient à
 * chaque synchronisation. « Prise » l'emporte sur « abandon » parce qu'on ne
 * peut pas attraper par erreur — alors qu'on abandonne souvent avant de s'y
 * remettre.
 */
const RANG = { encours: 0, abandon: 1, prise: 2 };

/** Une chasse en cours, pour une espèce et un jeu donnés. */
export function nouvelleCle() {
  // Horodatage plus quatre hexadécimaux. L'horodatage donne un ordre total,
  // identique sur tous les appareils, qui sert à départager deux chasses
  // ouvertes sur la même paire. Le tirage évite la collision de deux appareils
  // à la même milliseconde.
  const hasard = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
  return `${Date.now()}-${hasard}`;
}

/** Six hexadécimaux, tirés une fois par appareil. */
export function nouvelAppareil() {
  return Math.floor(Math.random() * 0x1000000)
    .toString(16)
    .padStart(6, "0");
}

/**
 * Ne garde que ce qui a la bonne forme, et rend EXACTEMENT la forme de l'état.
 *
 * Liste blanche stricte : une clé mal formée, un jeu inconnu, un compteur
 * négatif disparaissent. C'est volontaire — mieux vaut perdre une entrée
 * corrompue que propager une forme que la fusion ne saurait pas traiter.
 *
 * Idempotente, et il le faut : c'est elle qui garantit la loi du module. Passer
 * deux fois ne doit rien changer, sans quoi le point fixe n'existe pas.
 */
export function sanitizeQuetes(brut) {
  const parties = {};
  const source = (brut && brut.parties) || {};
  if (typeof source !== "object") return { parties };

  for (const [cle, part] of Object.entries(source)) {
    if (!CLE_PARTIE.test(cle) || !part || typeof part !== "object") continue;

    const espece = Number(part.e);
    if (!Number.isInteger(espece) || espece < 1 || espece > 100000) continue;
    if (typeof part.j !== "string" || !CODE_JEU.test(part.j)) continue;

    const colonnes = {};
    for (const [appareil, n] of Object.entries(part.r || {})) {
      if (!APPAREIL.test(appareil)) continue;
      // `Math.floor` et non `Number` seul : un compteur venu d'ailleurs peut
      // porter une décimale, et `max` sur des flottants finirait par produire
      // des totaux impossibles à afficher.
      const valeur = Math.floor(Number(n));
      if (Number.isFinite(valeur) && valeur > 0) colonnes[appareil] = valeur;
    }

    const propre = { e: espece, j: part.j, r: colonnes };
    propre.s = RANG[part.s] === undefined ? "encours" : part.s;

    // Une partie VIDE de tout : aucune rencontre, aucun statut, aucune fin. Elle
    // ne porte rien que la paire espèce-jeu, que la quête affichée dit déjà.
    //
    // Elle naissait d'un « −1 » posé avant le premier « +1 » (corrigé dans
    // ui/quest.js) et se logeait ensuite dans le carnet pour toujours, une union
    // ne supprimant rien. La jeter ici est sans danger, et c'est le seul endroit
    // où c'est vrai : la jeter ne peut pas faire diverger deux appareils, parce
    // qu'elle ne dit rien qu'un autre appareil pourrait contredire. Si l'un
    // d'eux compte vraiment une rencontre sous cette clé, l'union la ramène avec
    // sa colonne, et elle n'est alors plus vide.
    //
    // Le test est ÉTROIT à dessein. `{r:{}, s:"prise"}` — une chasse marquée
    // attrapée sans compteur — porte, elle, une information : elle reste.
    const vide = !Object.keys(colonnes).length && propre.s === "encours";
    // `f` reste ABSENT quand personne ne l'a posé. Absent, zéro et null sont
    // trois choses différentes, et les confondre casserait la loi : l'état
    // n'aurait pas la même forme que son export relu.
    const fin = Math.floor(Number(part.f));
    if (Number.isFinite(fin) && fin > 0) propre.f = fin;

    // `f` compte comme une information : une partie vide QUI PORTE UNE FIN n'est
    // pas vide. D'où ce test après la pose de `f`, et non avant.
    if (vide && propre.f === undefined) continue;

    parties[cle] = propre;
  }
  return { parties };
}

/** Le total d'une chasse : la somme de ses colonnes. */
export function totalPartie(part) {
  if (!part || !part.r) return 0;
  return Object.values(part.r).reduce((somme, n) => somme + n, 0);
}

/**
 * Fusionne deux chasses portant la même clé.
 *
 * Colonne par colonne, par `max`. C'est correct parce qu'un appareil n'écrit
 * QUE sa colonne : deux valeurs qui diffèrent sur une même colonne ne sont
 * jamais deux comptes concurrents, c'est la même suite vue à deux moments.
 *
 * Un compteur unique aurait été faux. Deux appareils hors ligne, l'un à +200,
 * l'autre à +150 : `max` rendrait 200, et 150 rencontres réelles
 * disparaîtraient — définitivement, `max` étant monotone. La somme aurait
 * dérivé, elle, en se rejouant à chaque fusion.
 */
function fusionnerPartie(a, b) {
  if (!a) return b;
  if (!b) return a;

  const r = { ...a.r };
  for (const [appareil, n] of Object.entries(b.r)) {
    r[appareil] = Math.max(r[appareil] || 0, n);
  }

  const out = { e: a.e, j: a.j, r };
  out.s = RANG[a.s] >= RANG[b.s] ? a.s : b.s;

  // La PREMIÈRE fin connue, et jamais `Infinity` : un `Math.min` naïf sur deux
  // parties sans fin aurait rendu Infinity, que JSON écrit `null`, que le
  // nettoyeur rejette — et le champ se serait mis à osciller entre absent et
  // null à chaque tour, donc à commiter sans fin.
  const fins = [a.f, b.f].filter((f) => Number.isFinite(f));
  if (fins.length) out.f = Math.min(...fins);

  return out;
}

/** L'union de deux carnets. Idempotente, commutative, associative. */
export function joinQuetes(a, b) {
  const gauche = (a && a.parties) || {};
  const droite = (b && b.parties) || {};
  const parties = {};
  for (const cle of new Set([...Object.keys(gauche), ...Object.keys(droite)])) {
    parties[cle] = fusionnerPartie(gauche[cle], droite[cle]);
  }
  return { parties };
}

/**
 * Deux carnets sont-ils identiques ?
 *
 * Sert à répondre « reste-t-il quelque chose à envoyer ? ». Comparaison
 * structurelle et non `JSON.stringify` : l'ordre des clés d'un objet dépend de
 * l'ordre d'insertion, et deux carnets égaux mais construits dans un ordre
 * différent auraient semblé différer — donc auraient déclenché une écriture,
 * puis une autre, indéfiniment.
 */
export function egalQuetes(a, b) {
  const gauche = (a && a.parties) || {};
  const droite = (b && b.parties) || {};
  const cles = new Set([...Object.keys(gauche), ...Object.keys(droite)]);
  for (const cle of cles) {
    const x = gauche[cle];
    const y = droite[cle];
    if (!x || !y) return false;
    if (x.e !== y.e || x.j !== y.j || x.s !== y.s || x.f !== y.f) return false;
    const appareils = new Set([...Object.keys(x.r), ...Object.keys(y.r)]);
    for (const appareil of appareils) {
      if ((x.r[appareil] || 0) !== (y.r[appareil] || 0)) return false;
    }
  }
  return true;
}

/**
 * Les chasses en cours, indexées par espèce. DÉRIVÉ, jamais stocké.
 *
 * Deux appareils hors ligne peuvent ouvrir deux chasses sur la même paire, et
 * c'est sans danger : leurs colonnes sont disjointes, donc aucun double compte.
 * Il faut pourtant en désigner une seule à l'écran — c'est la plus ANCIENNE,
 * et la clé porte l'horodatage, donc le choix est le même partout sans avoir à
 * s'entendre.
 *
 * @returns {Map<number, {cle: string, jeu: string}>}
 */
export function chassesOuvertes(carnet) {
  const ouvertes = new Map();
  for (const [cle, part] of Object.entries((carnet && carnet.parties) || {})) {
    if (part.s !== "encours") continue;
    // Une chasse sans aucune rencontre n en est pas une : c est une entree
    // laissee par un +1 aussitot repris. La compter aurait affiche « 1 chasse en
    // cours » sous un compteur a zero. L entree reste dans le carnet — sous une
    // union on ne supprime pas — mais elle ne se montre plus.
    if (!Object.values(part.r).some((n) => n > 0)) continue;
    const vue = ouvertes.get(part.e);
    if (!vue || cle < vue.cle) ouvertes.set(part.e, { cle, jeu: part.j });
  }
  return ouvertes;
}

/**
 * La probabilité d'avoir DÉJÀ réussi après n tentatives à 1 sur d.
 *
 * 1 − (1 − 1/d)^n. C'est le chiffre qui donne son sel au compteur : « 340
 * essais » ne dit rien, « 49 % » dit qu'on est à la moitié du chemin médian.
 *
 * Ce n'est PAS la probabilité que le prochain essai soit le bon — elle, ne
 * bouge jamais. Beaucoup de chasseurs confondent les deux ; l'interface doit
 * donc nommer celle-ci sans ambiguïté.
 */
export function chanceCumulee(n, denominateur) {
  if (!denominateur || denominateur < 1 || n <= 0) return 0;
  return 1 - Math.pow(1 - 1 / denominateur, n);
}
