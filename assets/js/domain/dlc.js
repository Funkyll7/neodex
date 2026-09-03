/**
 * dlc.js — les contenus téléchargeables : ce sans quoi on n'a pas l'espèce, et
 * ce que chacun contient.
 *
 * ═══ DEUX QUESTIONS, ET IL FAUT LES DEUX ═══
 *
 * Ce module en répond deux, qui se ressemblent assez pour qu'on les confonde et
 * diffèrent assez pour qu'aucune ne puisse tenir lieu de l'autre :
 *
 *   1. « Faut-il acheter quelque chose pour avoir cette espèce dans ce jeu ? »
 *      → `dlcRequis`. Elle regarde le champ `species`, celui des EXCLUSIVES.
 *
 *   2. « Ce contenu téléchargeable-là contient-il cette espèce ? »
 *      → `dlcApporte`. Elle regarde le champ `toutes`, la liste COMPLÈTE.
 *
 * LA PREMIÈRE naît d'un mensonge par omission. Le tableau « Où le trouver » dit
 * depuis toujours que Raikou est dans Épée/Bouclier. Il a raison, et il ment :
 * la cartouche seule ne le donne pas, il faut les Terres Enneigées de la
 * Couronne. Deux joueurs lisant la même ligne n'y lisaient donc pas la même
 * chose selon ce qu'ils possèdent, et rien à l'écran ne les départageait.
 *
 * LA SECONDE naît d'un affichage tout autre : les quatre DLC montrés EN
 * PERMANENCE sur la fiche de n'importe quelle espèce, chacun disant de
 * lui-même s'il l'apporte ou non. Là, `dlcRequis` ne peut plus servir, et pas
 * par maladresse — par construction. Elle ne sait répondre que pour les espèces
 * absentes du jeu de base, puisque la soustraction a effacé les autres :
 * demandez-lui « Pikachu est-il dans l'Île Solitaire ? », elle répond non,
 * alors qu'il y est bel et bien — il est simplement AUSSI dans Épée/Bouclier.
 * Un « non » juste pour la première question, faux pour la seconde. D'où le
 * champ `toutes`, qui ne soustrait rien, et `dlcApporte` qui le lit.
 *
 * Aucune des deux ne dit comment on l'attrape, ni où, ni si le chromatique y
 * est chassable : `availability.js` s'en charge et reste seul maître de la
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
 * `data/reference/dlc.json` porte les DEUX listes, déjà calculées, par DLC :
 *
 *   - `toutes`   : le Pokédex du DLC plus ses hors-dex, SANS rien retirer.
 *                  1068 numéros sur les quatre — c'est la liste brute.
 *   - `species`  : la même, MOINS tout ce que le jeu de base donne déjà.
 *                  666 numéros, la soustraction en ayant retiré 402.
 *
 * Bulbizarre est au Pokédex de l'Île Solitaire : il est dans `toutes`, il n'est
 * pas dans `species` — on l'attrape dans Épée/Bouclier sans rien acheter, et un
 * logo « il te faut le DLC » sur sa ligne aurait été un contresens.
 *
 * Ce module n'a donc RIEN à soustraire, ni à additionner. Il cherche dans l'une
 * ou l'autre liste, c'est tout. Refaire ici la moindre part du calcul — ne
 * serait-ce que reconstituer `species` en retranchant quelque chose de
 * `toutes` — aurait créé un second endroit à tenir d'accord avec le premier,
 * pour un résultat identique. Voir l'en-tête du fichier de données, qui dit
 * d'où sortent les numéros et comment la soustraction est faite.
 *
 * `species` est un SOUS-ENSEMBLE de `toutes`, par construction et vérifié à la
 * génération : toute espèce exclusive au DLC est évidemment dans le DLC. Si
 * l'invariant venait à tomber, c'est le fichier de données qui serait à
 * reprendre, pas ce module.
 *
 * ═══ LA VÉRIFICATION QUE `dlcRequis` GARDE : L'ESPÈCE EST-ELLE LÀ ? ═══
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
 * les 666 entrées de `species` sont toutes présentes dans leur jeu — Zarudé
 * (893) y compris, que `data/availability` donne en « ev », c'est-à-dire par
 * distribution, et qui est bien au Pokédex de l'Île Solitaire. Elle ne coûte
 * qu'une interrogation de Set, et elle empêche à jamais la contradiction.
 *
 * ═══ ET POURQUOI `dlcApporte` NE LA PORTE PAS ═══
 *
 * L'asymétrie est voulue, et c'est la conséquence directe des deux questions.
 *
 * `dlcRequis` PARLE D'UNE LIGNE DE TABLEAU. Elle qualifie la ligne d'un jeu
 * précis, elle la fait même basculer en « indisponible » (voir
 * `availability.js`) : il lui faut donc s'accorder avec le tableau, sous peine
 * de le contredire dans le même millimètre carré.
 *
 * `dlcApporte` NE PARLE QUE DU DLC. Elle répond « le Pokédex de ce contenu
 * recense-t-il cette espèce ? », et cette réponse est vraie ou fausse toute
 * seule, sans rien devoir à ce que `data/availability` pense du jeu. Y ajouter
 * la garde aurait cassé l'affichage qu'on veut : les quatre DLC sont montrés en
 * permanence, y compris ceux d'un jeu où l'espèce n'est pas — et c'est
 * précisément là qu'ils doivent pouvoir dire NON. Une garde qui renvoie faux
 * quand le jeu n'a pas l'espèce aurait rendu ce « non » indistinguable d'un
 * « non » de contenu, et surtout aurait rendu `dlcApporte` incapable de
 * répondre oui pour une espèce que le jeu de base donne aussi, ce qui est très
 * exactement son unique raison d'exister.
 *
 * Reste que la question de la contradiction se pose. Aujourd'hui elle ne se
 * pose pas : les 1068 entrées de `toutes` sont, elles aussi, toutes présentes
 * dans leur jeu selon `data/availability`. Si un jour l'une manquait, ce serait
 * une divergence de données à corriger à la source, pas un cas que ce module
 * doive masquer — et c'est à l'affichage, seul à savoir ce qu'il dessine, de
 * décider s'il veut croiser les deux réponses.
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

/**
 * Le champ `toutes` d'un DLC, retourné en Set, une fois pour toutes.
 *
 * MÊME RAISONNEMENT QUE `indexer`, AUTRE CLÉ. `indexer` se met en cache sur le
 * TABLEAU des DLC, parce que `dlcRequis` les parcourt tous à chaque appel.
 * `dlcApporte`, elle, reçoit UN enregistrement et n'a besoin que du sien : la
 * clé naturelle est donc l'enregistrement lui-même. `core/data.js` le construit
 * une fois au chargement et le garde pour la vie de la page, la WeakMap tient
 * donc aussi longtemps qu'il faut — et si un jeu de données était rechargé, les
 * anciens enregistrements s'effaceraient avec leurs entrées, sans qu'on ait à y
 * penser.
 *
 * L'ENJEU EST PLUS GROS QU'IL N'EN A L'AIR. La fiche montre les quatre DLC pour
 * chacune des vingt-trois lignes de jeu ; chercher dans un tableau de 455
 * numéros — la Zone Zéro — se fait en le parcourant. Sans ce cache, une seule
 * ouverture de fiche coûterait des dizaines de milliers de comparaisons, et la
 * fiche se redessine à chaque clic du Pokédex.
 *
 * LE REPLI SI `toutes` MANQUE : un Set vide, donc « ce DLC n'apporte rien ».
 * C'est le bon défaut. Un fichier de données antérieur à l'arrivée du champ ne
 * ferait alors qu'afficher quatre « non » — muet, mais jamais menteur. Répondre
 * « oui » par défaut, ou se rabattre sur `species`, aurait affirmé des choses
 * fausses sans que rien ne le signale.
 */
const INDEX_TOUTES = new WeakMap();

function especesDe(dlc) {
  const deja = INDEX_TOUTES.get(dlc);
  if (deja) return deja;
  const especes = new Set(dlc.toutes || []);
  INDEX_TOUTES.set(dlc, especes);
  return especes;
}

/**
 * Ce contenu téléchargeable apporte-t-il cette espèce ? Vrai ou faux, et rien
 * d'autre.
 *
 * C'EST LA QUESTION N° 2 DE L'EN-TÊTE, celle que `dlcRequis` ne sait pas poser.
 * Elle lit `toutes`, la liste complète et non soustraite : la réponse vaut donc
 * aussi pour une espèce que le jeu de base donne déjà. Pikachu dans l'Île
 * Solitaire : vrai — il y est, même si Épée/Bouclier le donne aussi. C'est ce
 * qui permet aux quatre DLC de rester affichés en permanence sur n'importe
 * quelle fiche, chacun répondant pour son propre compte.
 *
 * ON PREND L'ENREGISTREMENT, PAS LE CODE. L'appelant qui affiche quatre logos
 * tient déjà les quatre enregistrements en main — `dlcDuJeu` d'`availability.js`
 * les lui donne, ou `dataset.dlc` directement. Lui demander un code l'aurait
 * obligé à les retrouver ici par recherche, à chaque logo et à chaque ligne,
 * pour un objet qu'il possédait déjà.
 *
 * CE QU'ELLE NE DIT PAS, et il faut le savoir en la lisant : elle dit D'OÙ
 * VIENT l'espèce, pas COMMENT on l'obtient ni si on l'obtient vraiment. Zarudé
 * (893) est au Pokédex de l'Île Solitaire — vrai, donc — alors que
 * `data/availability` le donne en distribution événementielle. Les deux
 * réponses se lisent ensemble ; celle-ci ne remplace pas celle-là. Et
 * contrairement à `dlcRequis`, aucune garde ne consulte `availability` ici :
 * l'en-tête dit longuement pourquoi.
 *
 * @param {object} dlc     UN enregistrement de data/reference/dlc.json
 * @param {object} espece  l'espèce, telle que `core/data.js` la construit
 * @returns {boolean} vrai si ce DLC recense cette espèce
 */
export function dlcApporte(dlc, espece) {
  if (!dlc || !espece) return false;
  return especesDe(dlc).has(espece.id);
}
