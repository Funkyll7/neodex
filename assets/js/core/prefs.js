/**
 * prefs.js — les réglages de ce navigateur, et eux seuls.
 *
 * Une seule clé de localStorage pour tout ce qui décrit l'APPAREIL : le thème,
 * la langue, les sons, la densité de la grille, l'identifiant de colonne du
 * carnet de chasses. Rien de tout cela ne décrit la collection, donc rien ne
 * part vers le dépôt — c'est la ligne de partage, et elle tient en une phrase :
 * ce qu'on a attrapé se synchronise, la façon dont on le regarde non.
 *
 * Ce fichier existe parce que quatre modules relisaient cette même clé, chacun
 * avec sa propre copie du `JSON.parse` et de son `try / catch` : `ui/theme.js`,
 * `ui/sons.js`, `core/i18n.js` et `ui/quest.js`. Quatre endroits où ajouter un
 * réglage, quatre endroits où se tromper de valeur par défaut. Le panneau de
 * paramètres en aurait fait un cinquième.
 *
 * LE STOCKAGE PEUT ÊTRE REFUSÉ — navigation privée, réglage du navigateur, un
 * quota plein. Toutes les fonctions d'ici échouent alors en silence et rendent
 * la valeur par défaut. Le site marche sans mémoire ; il ne doit jamais
 * s'arrêter parce qu'il n'a pas pu en écrire.
 */

import { CONFIG } from "../config.js";

const CLE = CONFIG.storage.prefs;

/** Tous les réglages, ou un objet vide si rien n'est lisible. */
export function lirePrefs() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || "{}");
    // `typeof null === "object"` : sans ce test, un `null` stocké se propagerait
    // et le premier `prefs.theme` lèverait.
    return brut && typeof brut === "object" ? brut : {};
  } catch {
    return {};
  }
}

/** Remplace tous les réglages. Les appelants passent par `poserReglage`. */
export function ecrirePrefs(prefs) {
  try {
    localStorage.setItem(CLE, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

/**
 * Un réglage booléen, avec sa valeur par défaut.
 *
 * `!== false` et non `=== true` : un réglage jamais touché est ABSENT, et
 * l'absence doit valoir le défaut. Les sons marchent tant qu'on ne les a pas
 * coupés ; le mode compact reste éteint tant qu'on ne l'a pas allumé. C'est la
 * même fonction pour les deux, à un argument près.
 */
export function reglage(nom, defaut = false) {
  const valeur = lirePrefs()[nom];
  return valeur === undefined ? defaut : valeur === true;
}

/** Pose un réglage sans toucher aux autres. Rend la valeur posée. */
export function poserReglage(nom, valeur) {
  ecrirePrefs({ ...lirePrefs(), [nom]: valeur });
  return valeur;
}
