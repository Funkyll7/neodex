/**
 * journal.js — l'historique des modifications de la collection.
 *
 * CE QU'IL GARDE, ET POURQUOI CES DEUX-LÀ. Deux évènements font bouger une
 * collection : ce qu'on envoie au dépôt depuis cet appareil, et ce qu'on en
 * reçoit parce qu'un autre appareil y a écrit. Le journal note les deux, avec
 * leur heure et le détail des cases.
 *
 * CE QU'IL NE GARDE PAS : chaque case cochée, une par une. On en coche des
 * dizaines d'affilée en remontant une boîte de HOME, et un journal qui les
 * noterait toutes serait illisible au bout d'une soirée — en plus de remplir le
 * stockage du navigateur. Les cases sont donc regroupées par ENVOI, ce qui est
 * la maille naturelle : c'est le moment où la collection change vraiment de
 * version. L'annulation fine, elle, existe déjà ailleurs (`ui/undo.js`).
 *
 * OÙ IL VIT. Dans les préférences, donc dans `localStorage`, donc PROPRE À CET
 * APPAREIL — comme le thème et le mode compact. Le ranger dans
 * `collection.json` l'aurait fait voyager, et un journal qui voyage devient un
 * journal à fusionner : deux appareils y écriraient en même temps, et il
 * faudrait arbitrer. Or ce qu'on veut savoir est justement local : « qu'est-ce
 * qui a changé pendant que je n'étais pas devant CET écran ? »
 *
 * DEUX PLAFONDS, et ils sont là pour la même raison. `localStorage` tient
 * quelques mégaoctets pour tout le site, collection comprise : un journal sans
 * borne finirait par faire échouer l'écriture des préférences, c'est-à-dire par
 * casser le thème pour garder un historique que personne ne relit. Cent
 * cinquante entrées couvrent des mois d'usage ; soixante espèces par entrée
 * couvrent tous les cas sauf le premier import, où le compte suffit.
 */

import { lirePrefs, ecrirePrefs } from "../core/prefs.js";

const MAX_ENTREES = 150;
const MAX_ESPECES = 60;

/**
 * L'historique, du plus récent au plus ancien.
 *
 * Tolérant à tout : une préférence absente, un tableau devenu autre chose, une
 * entrée sans espèces. Ce fichier peut venir d'une version plus ancienne du
 * site, ou avoir été édité à la main — il ne doit jamais empêcher le site de
 * démarrer.
 */
export function lireJournal() {
  const brut = lirePrefs().journal;
  if (!Array.isArray(brut)) return [];
  return brut.filter((e) => e && typeof e === "object" && typeof e.at === "number");
}

/**
 * Ajoute une entrée, et rend le journal à jour.
 *
 * Silencieuse si le rapport est vide : `rapportDeChangement` rend `null` quand
 * rien n'a bougé, et une entrée « zéro case » n'apprendrait rien.
 *
 * @param {"envoi"|"reception"} sens  d'où vient le changement
 * @param {{especes: Array, gagnees: number, perdues: number}} rapport
 * @param {number} horodatage  passé par l'appelant — ce module ne lit pas
 *        l'heure lui-même, ce qui le rend testable sans horloge
 */
export function ajouterAuJournal(sens, rapport, horodatage) {
  if (!rapport || !rapport.especes || !rapport.especes.length) return lireJournal();

  const entree = {
    at: horodatage,
    sens,
    gagnees: rapport.gagnees,
    perdues: rapport.perdues,
    // Le NUMÉRO seul, pas l'espèce entière. L'objet espèce pèse des kilo-octets
    // — noms, types, formes, disponibilités — et il est déjà en mémoire, chargé
    // depuis `data/`. Le journal ne stocke donc que de quoi le retrouver.
    especes: rapport.especes.slice(0, MAX_ESPECES).map((e) => ({
      id: e.id,
      g: e.gagnees,
      p: e.perdues,
    })),
    // Ce qu'on a dû couper, pour que l'affichage puisse le dire au lieu de
    // mentir par omission.
    coupees: Math.max(0, rapport.especes.length - MAX_ESPECES),
  };

  const journal = [entree, ...lireJournal()].slice(0, MAX_ENTREES);
  const prefs = lirePrefs();
  ecrirePrefs({ ...prefs, journal });
  return journal;
}

/** Efface tout l'historique. Les cases, elles, ne bougent pas. */
export function viderJournal() {
  const prefs = lirePrefs();
  ecrirePrefs({ ...prefs, journal: [] });
}

/**
 * Regroupe les entrées par jour, du plus récent au plus ancien.
 *
 * La CLÉ est la date locale et non l'horodatage : deux entrées à 23 h 50 et
 * 00 h 10 sont deux jours différents pour qui les relit, même si trente minutes
 * les séparent. `toDateString` donne cette clé sans dépendre d'un format.
 *
 * @returns {Array<{jour: Date, entrees: Array}>}
 */
export function parJour(journal) {
  const groupes = new Map();
  for (const entree of journal) {
    const date = new Date(entree.at);
    const cle = date.toDateString();
    if (!groupes.has(cle)) groupes.set(cle, { jour: date, entrees: [] });
    groupes.get(cle).entrees.push(entree);
  }
  return [...groupes.values()];
}
