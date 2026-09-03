/**
 * journal.js — l'historique des modifications de la collection.
 *
 * CE QU'IL GARDE. Deux évènements font bouger une collection : les cases qu'on
 * coche sur CET appareil, et celles qui arrivent du dépôt parce qu'un autre y a
 * écrit. Le journal note les deux, avec leur heure et le détail des cases.
 *
 * Les locales étaient d'abord relevées au moment de l'ENVOI vers le dépôt. Ça
 * paraissait la bonne maille, et ça ne notait rien du tout pour qui n'a pas
 * configuré la synchronisation : le journal restait vide à jamais alors que le
 * site marche très bien sans dépôt. Elles sont donc relevées à la source, et le
 * sens « envoi » ne subsiste que dans les entrées déjà écrites.
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
import { rapportDeChangement } from "./collection.js";

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
 * @param {"local"|"reception"|"envoi"} sens  d'où vient le changement. « envoi »
 *        n'est plus produit : il reste lisible pour les entrées écrites par une
 *        version antérieure, qui décrivaient la même chose que « local ».
 * @param {{especes: Array, gagnees: number, perdues: number}} rapport
 * @param {number} horodatage  passé par l'appelant — ce module ne lit pas
 *        l'heure lui-même, ce qui le rend testable sans horloge
 * @param {string|null} [appareil]  le nom de l'appareil d'où vient un changement
 *        reçu, quand le fichier distant le dit. Voir la clé `app` ci-dessous.
 */
export function ajouterAuJournal(sens, rapport, horodatage, appareil = null) {
  if (!rapport || !rapport.especes || !rapport.especes.length) return lireJournal();

  const entree = {
    at: horodatage,
    sens,
    gagnees: rapport.gagnees,
    perdues: rapport.perdues,
    // D'OÙ ÇA VIENT, quand on le sait — et la clé est courte pour la même
    // raison que `g` et `p` plus bas : ce tableau est recopié en entier dans
    // `localStorage` à chaque ajout, cent cinquante fois, et un nom de clé long
    // s'y paie autant de fois.
    //
    // ABSENTE PLUTÔT QUE NULLE, et c'est le point à ne pas rater. Les entrées
    // déjà écrites — plusieurs centaines — n'ont pas cette clé, et il n'est pas
    // question d'aller les réécrire pour y poser un `null` : `ui/journal.js`
    // doit de toute façon savoir lire une entrée qui ne dit pas d'où elle
    // vient, puisque c'est le cas de tout l'historique existant ET de tout
    // changement reçu d'un appareil qui n'a pas de nom. Une seule branche à
    // l'affichage couvre donc les deux, et l'ancien libellé « Reçu d'un autre
    // appareil » reste la réponse juste quand le nom manque.
    ...(appareil ? { app: appareil } : {}),
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

/* ------------------------ Les modifications locales ---------------------- */

/**
 * L etat au dernier enregistrement. Ce qui s en ecarte est ce qui reste a noter.
 *
 * UNE COMPARAISON ET NON UN COMPTE RENDU DES APPELS. La collection previent
 * qu elle a ete ecrite, jamais ce qu elle a ecrit : il y a cinq points
 * d ecriture, un sixieme finira par exister, et un journal qui ferait confiance
 * a chacun d eux pour se decrire aurait un trou le jour ou l on en ajoute un.
 * Comparer deux etats ne peut pas se tromper.
 */
let instantane = null;
let minuteur = null;

/**
 * Le delai avant d enregistrer une salve.
 *
 * On coche par rafales — une boite de HOME, c est trente cases en deux
 * minutes —, et une entree par case ferait un journal illisible. Quatre
 * secondes de silence marquent la fin d une salve, comme le differe de la
 * synchronisation marque la fin d une session d edition. Les deux valeurs sont
 * proches, et ce n est pas un hasard : elles mesurent la meme chose.
 */
const DELAI = 4000;

/**
 * Commence a suivre une collection.
 *
 * Le premier instantane est pris SANS RIEN NOTER : au demarrage, tout l ecart
 * entre un objet vide et la collection chargee serait attribue a cet instant,
 * et le journal se serait ouvert sur une entree de mille cases datee du jour ou
 * l on a ouvert le site.
 */
export function suivreCollection(collection) {
  instantane = collection.toExport("journal").marks;
  collection.surEcritureLocale = () => noterSalve(collection);
}

/**
 * Note ce qui a bouge depuis le dernier enregistrement, une fois la salve finie.
 *
 * Repousse a chaque nouvelle ecriture : tant qu on coche, rien ne part.
 */
function noterSalve(collection) {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => viderSalve(collection), DELAI);
}

/** Enregistre tout de suite ce qui attendait, s il y a quelque chose. */
function viderSalve(collection) {
  clearTimeout(minuteur);
  minuteur = null;
  if (!instantane) return;
  const apres = collection.toExport("journal").marks;
  const rapport = rapportDeChangement(instantane, apres, null);
  instantane = apres;
  if (rapport) ajouterAuJournal("local", rapport, Date.now());
}

/**
 * Encadre une adoption d etat distant : avant, pendant, apres.
 *
 * UNE SEULE FONCTION POUR LES TROIS TEMPS, et c est le point. Chacun pris a
 * part se serait oublie quelque part — il y a quatre endroits ou l on adopte du
 * distant —, et un seul des trois manquant suffit a attribuer des cases au
 * mauvais cote. Enveloppee, l operation ne peut pas etre faite a moitie.
 *
 * @param {Function} adopter  fait l adoption et rend son rapport, ou `null`
 * @param {string|null} [appareil]  le nom de l appareil d ou vient ce qu on
 *   adopte, quand l appelant a pu le lire dans le fichier distant. Facultatif
 *   a dessein : l adoption d un onglet jumeau ou d un fichier importe n a pas
 *   d expediteur a nommer, et une entree sans nom garde l ancien libelle.
 */
export function autourDUneAdoption(collection, adopter, appareil = null) {
  // 1. Ce qui attendait est BIEN A NOUS. Sans ce vidage, une salve en cours au
  //    moment ou le depot repond serait comparee a un etat qui contient deja
  //    les cases distantes, et nos propres coches auraient disparu du journal.
  viderSalve(collection);

  // 2. L adoption elle-meme, qui rend son rapport ou `null`.
  const rapport = adopter();
  if (rapport) ajouterAuJournal("reception", rapport, Date.now(), appareil);

  // 3. Le nouvel etat devient la reference. Sans cette reprise, la salve
  //    suivante aurait note les cases distantes une seconde fois, comme si on
  //    les avait cochees ici — apres une fusion a trois voies, rien dans les
  //    marques ne dit d ou vient une case.
  instantane = collection.toExport("journal").marks;
  return rapport;
}