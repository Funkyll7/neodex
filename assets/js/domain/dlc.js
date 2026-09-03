/**
 * dlc.js — « faut-il acheter un contenu téléchargeable pour avoir cette espèce
 * dans ce jeu-là ? »
 *
 * LA QUESTION QUE CE FICHIER RÉPOND, ET CELLE QU'IL NE RÉPOND PAS. Le tableau
 * « Où le trouver » dit depuis toujours que Raikou est dans Épée/Bouclier. Il a
 * raison, et il ment par omission : la cartouche seule ne le donne pas, il faut
 * les Terres Enneigées de la Couronne. Deux joueurs lisant la même ligne n'y
 * lisent donc pas la même chose selon ce qu'ils possèdent, et rien à l'écran ne
 * les départageait. Ce module fournit ce qui manquait — QUEL contenu
 * téléchargeable, et lui seul, met cette espèce dans ce jeu.
 *
 * Il ne dit rien de plus. Ni comment on l'attrape, ni où, ni si le chromatique
 * y est chassable : `availability.js` s'en charge et reste seul maître de la
 * présence. Ce fichier ne fait que QUALIFIER une présence déjà établie.
 *
 * ═══ POURQUOI C'EST UNE RÈGLE DE JEU, ET DONC POURQUOI ELLE VIT ICI ═══
 *
 * « Cette espèce vient du DLC » n'est pas une question d'affichage. C'est un
 * fait sur les jeux Pokémon, vérifiable dans un Pokédex, et qui resterait vrai
 * si le site n'avait pas de fiche du tout. Écrite dans le panneau, elle y
 * aurait été inatteignable pour tout le reste — la recherche, un filtre « sans
 * DLC », un compteur, une future colonne du Living Dex. Écrite ici, elle est
 * une fonction que n'importe qui appelle, et le panneau n'a plus qu'à dessiner.
 *
 * ═══ CE QUE LE FICHIER DE DONNÉES A DÉJÀ FAIT, ET QU'ON NE REFAIT PAS ═══
 *
 * `data/reference/dlc.json` ne liste PAS le Pokédex de chaque DLC. Il liste ce
 * que chaque DLC apporte À LUI SEUL : la soustraction du jeu de base y est déjà
 * faite, et elle retire 402 espèces sur l'ensemble des quatre. Bulbizarre est
 * au Pokédex de l'Île Solitaire, il n'est pas dans la liste — on l'attrape dans
 * Épée/Bouclier sans rien acheter, un logo sur sa ligne aurait été un
 * contresens.
 *
 * Ce module n'a donc RIEN à soustraire. Il cherche, c'est tout. Refaire ici la
 * moindre part du calcul aurait créé un second endroit à tenir d'accord avec le
 * premier, pour un résultat identique — voir l'en-tête du fichier de données,
 * qui dit d'où sortent les numéros et comment la soustraction est faite.
 *
 * ═══ LA SEULE VÉRIFICATION QU'ON GARDE : L'ESPÈCE EST-ELLE LÀ ? ═══
 *
 * Deux fichiers parlent du même jeu — `data/availability` dit ce qu'il
 * contient, `data/reference/dlc.json` dit ce qu'il faut acheter — et rien ne
 * les oblige à s'accorder. Le jour où ils divergeraient, on poserait un logo de
 * DLC sur une ligne qui affiche « — » : le tableau dirait « absent » et
 * l'image dirait « achète ceci pour l'avoir ». Une contradiction à l'écran,
 * dans le même millimètre carré.
 *
 * `availability` tranche, parce que c'est lui qui décide déjà de la couleur de
 * la ligne, de la case et du compteur. Aujourd'hui la garde ne retire rien :
 * les 658 entrées des quatre DLC sont toutes présentes dans leur jeu — Zarudé
 * (893) y compris, que `data/availability` donne en « ev », c'est-à-dire par
 * distribution, et qui est bien au Pokédex de l'Île Solitaire. Elle ne coûte
 * qu'une interrogation de Set, et elle empêche à jamais la contradiction.
 */

/**
 * Le tableau rendu quand il n'y a rien à dire — c'est-à-dire presque toujours.
 *
 * Une fiche ouverte pose la question vingt-trois fois, une par jeu, et vingt
 * fois au moins la réponse est « aucun DLC ». Autant de tableaux vides jetés
 * aussitôt, à chaque ouverture de fiche. Un seul suffit : il est gelé, donc
 * personne ne peut le remplir par mégarde et le partager à son insu.
 */
const VIDE = Object.freeze([]);

/**
 * Les listes d'espèces, retournées en Set, une fois pour toutes.
 *
 * Le fichier de données range les numéros en tableaux — c'est ce qui se relit à
 * la main dans GitHub, et c'est très bien ainsi. Mais chercher un numéro dans
 * un tableau se fait en le parcourant, et le Trésor Enfoui de la Zone Zéro en
 * compte 289 : une fiche ouverte, c'est vingt-trois lignes fois quatre DLC,
 * donc jusqu'à seize mille comparaisons pour dessiner trois petites images. Et
 * la fiche se redessine à chaque clic du Pokédex.
 *
 * La clé est le TABLEAU DE DLC lui-même : `core/data.js` le construit une fois
 * au chargement et le pose sur le dataset pour la vie de la page. Une WeakMap
 * suffit donc — même raisonnement que le cache de `completion.js` —, et le jour
 * où un jeu de données serait rechargé, l'ancien s'effacerait avec ses entrées
 * sans qu'on ait à y penser.
 */
const INDEX = new WeakMap();

function indexer(dlcs) {
  const deja = INDEX.get(dlcs);
  if (deja) return deja;
  const index = dlcs.map((dlc) => ({ dlc, especes: new Set(dlc.species || []) }));
  INDEX.set(dlcs, index);
  return index;
}

/**
 * Les contenus téléchargeables sans lesquels cette espèce n'est pas dans ce
 * jeu. Tableau vide — le cas courant — quand le jeu de base suffit.
 *
 * ON REND LES ENREGISTREMENTS ENTIERS, et non des codes. L'appelant a besoin du
 * `code` pour l'image et du `name` pour l'infobulle ; lui rendre les seuls
 * codes l'aurait obligé à retourner chercher le nom dans le tableau, c'est-à-
 * dire à refaire au point d'affichage la recherche qu'on vient de faire ici.
 *
 * L'ORDRE EST CELUI DU FICHIER, et il compte : Drakkarmin (621) est la seule
 * espèce à relever de deux DLC du même jeu — l'Île Solitaire et les Terres
 * Enneigées —, sa fiche montre donc deux logos, et ils doivent se présenter
 * dans le même ordre d'une ouverture à l'autre. L'ordre du fichier ne bouge
 * pas ; un ordre calculé, lui, aurait pu.
 *
 * @param {object} espece   l'espèce, telle que `core/data.js` la construit
 * @param {string} codeJeu  le `code` d'un jeu de data/reference/games.json
 * @param {Array}  dlcs     `dataset.dlc`, c'est-à-dire data/reference/dlc.json
 * @returns {Array} enregistrements de DLC ({ code, game, name, count, species })
 */
export function dlcRequis(espece, codeJeu, dlcs) {
  if (!espece || !codeJeu || !dlcs || !dlcs.length) return VIDE;
  // La garde expliquée en tête : `availability` a le dernier mot sur la
  // présence, et on ne qualifie que ce qu'il a déjà reconnu.
  if (!espece.games || !espece.games.has(codeJeu)) return VIDE;

  let trouves = null;
  for (const entree of indexer(dlcs)) {
    if (entree.dlc.game !== codeJeu) continue;
    if (!entree.especes.has(espece.id)) continue;
    if (!trouves) trouves = [];
    trouves.push(entree.dlc);
  }
  return trouves || VIDE;
}
