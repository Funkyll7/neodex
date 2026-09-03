/**
 * source.js — le champ `source` de `data/collection.json` : ce qu'on y écrit,
 * ce qu'on y lit.
 *
 * LE PROBLÈME. Le journal des modifications savait dire « Reçu d'un autre
 * appareil », jamais LEQUEL — et c'est pourtant la seule moitié intéressante de
 * la phrase. Qu'une case vienne d'ailleurs, on s'en doutait ; ce qu'on veut
 * savoir en rentrant chez soi, c'est si elle vient du téléphone qu'on avait
 * dans le train ou de la tablette restée sur la table. Rien dans le dépôt ne
 * portait cette information : les quelque cinq cents commits de
 * `data/collection.json` sortent tous du même compte GitHub — celui du jeton —
 * et portent tous le même `"source": "site Funkylldex"`.
 *
 * ═══ LE CHOIX QUI FAIT TOUT CE FICHIER : AUCUNE CLÉ NOUVELLE ═══
 *
 * On aurait pu ajouter un champ `appareil` à côté de `source`. C'est ce qui
 * vient à l'esprit, c'est plus « propre » sur le papier, et c'est justement ce
 * qu'on refuse. Une clé de plus dans ce fichier-là n'est pas une ligne de plus,
 * c'est une DIMENSION de plus, et elle coûte sur quatre plans à la fois :
 *
 *   - LA FUSION. `collection.js` fusionne à trois voies — ancêtre, local,
 *     distant — et cette fusion ne sait arbitrer QUE des cases. Un champ
 *     nouveau que deux appareils renseignent différemment n'a pas de règle
 *     d'arbitrage : il faudrait en inventer une, la tester, et vivre avec ses
 *     surprises sur un fichier qui porte des années de collection ;
 *
 *   - LA MIGRATION. Cinq cents fichiers antérieurs n'auraient pas la clé. Tout
 *     lecteur devrait donc gérer son absence de toute façon — c'est-à-dire
 *     écrire exactement le code que ce fichier-ci écrit, mais en plus du reste ;
 *
 *   - LES VERSIONS ANCIENNES DU SITE. Le cache hors ligne peut servir pendant
 *     des jours un onglet ouvert sur une version antérieure. Cet onglet-là
 *     écrit `toExport()` tel qu'il le connaît : une clé qu'il ignore
 *     disparaîtrait du fichier au premier envoi qu'il ferait, silencieusement ;
 *
 *   - LA RELECTURE À LA MAIN. `data/collection.json` se relit dans GitHub, et
 *     le diff d'un commit doit rester lisible. Une ligne de plus en tête de
 *     chaque commit, pour dire ce qu'une ligne existante peut dire, est une
 *     ligne de bruit.
 *
 * Le champ `source` EXISTE DÉJÀ. Il est écrit à chaque export, il décrit par
 * construction le dernier écrivain, personne ne le fusionne, personne ne le
 * valide, et un lecteur qui ne s'y intéresse pas l'ignore sans rien casser.
 * On y range donc le nom de l'appareil, derrière un séparateur :
 *
 *     "site Funkylldex"  devient  "site Funkylldex · téléphone de Kyllian"
 *
 * Zéro changement de structure, donc zéro risque de fusion, zéro migration, et
 * les anciens fichiers restent lisibles exactement tels quels. C'est ce qui
 * distingue ce correctif d'une refonte du format — et c'est le cœur de la
 * décision, pas un détail d'implémentation.
 *
 * LE MARQUEUR EST UN POINT MÉDIAN, et ce n'est pas décoratif. Le nom est du
 * texte libre écrit par une personne : un tiret, un deux-points ou une barre
 * verticale se retrouveraient tôt ou tard DANS un nom — « ordi — bureau »,
 * « tel: perso » — et la coupure se ferait au mauvais endroit. Le point médian,
 * lui, ne se tape pas par accident. Et même s'il finissait dans un nom, la
 * coupure se fait à la PREMIÈRE occurrence en gardant tout le reste : le nom
 * revient intact quoi qu'il arrive.
 */

/** Ce qui sépare l'origine du logiciel du nom de l'appareil. */
export const MARQUEUR = "·";
const SEPARATEUR = ` ${MARQUEUR} `;

/**
 * La longueur maximale d'un nom d'appareil, en caractères.
 *
 * ELLE EST DÉFINIE ICI ET NULLE PART AILLEURS, parce que c'est une règle du
 * FORMAT et non un confort d'affichage : ce nom part dans un fichier commité,
 * relu dans un diff GitHub, et revient sur trois appareils. Quarante caractères
 * laissent la place à « téléphone de Kyllian » ou « ordinateur du bureau » et
 * arrêtent net le copier-coller malheureux d'un paragraphe entier.
 *
 * La borne est posée aux DEUX bouts — à l'écriture comme à la lecture — parce
 * qu'un fichier peut avoir été écrit par autre chose que ce site : une version
 * future, une main dans un éditeur de texte. Ce qui entre est borné, ce qui
 * sort l'est aussi ; on ne fait jamais confiance à l'autre côté du fichier.
 */
export const LONGUEUR_MAX = 40;

/** Coupe et normalise un nom, quelle que soit sa provenance. */
function borner(nom) {
  // Les espaces d'abord, la coupe ensuite, le rognage encore après : couper à
  // quarante peut retomber au milieu d'une espace, et un nom qui finirait par
  // une espace produirait « … · » à l'affichage, soit un séparateur orphelin.
  return String(nom ?? "").replace(/\s+/g, " ").trim().slice(0, LONGUEUR_MAX).trim();
}

/**
 * Compose la valeur du champ `source` : l'origine, puis l'appareil s'il en a un.
 *
 * SANS NOM, ON REND LA BASE SEULE — pas « base · », pas « base · inconnu ». Le
 * fichier écrit est alors exactement celui qu'écrivaient les cinq cents commits
 * précédents, à l'octet près, et il se relit comme eux : sans nom. C'est ce qui
 * permet à un appareil qui n'a pas de nom de coexister avec ceux qui en ont un,
 * sans que rien nulle part n'ait à connaître les deux cas.
 *
 * @param {string} base       d'où vient l'écriture — « site Funkylldex »
 * @param {string} [appareil] le nom de l'appareil, ou rien
 */
export function sourceAvecAppareil(base, appareil) {
  const nom = borner(appareil);
  return nom ? `${base}${SEPARATEUR}${nom}` : String(base);
}

/**
 * Le nom d'appareil caché dans un champ `source`, ou `null`.
 *
 * `null` ET NON UNE CHAÎNE VIDE, et l'appelant s'appuie dessus : c'est ce qui
 * distingue « ce fichier ne dit pas d'où il vient » de « il vient de nulle
 * part ». Les cinq cents fichiers antérieurs tombent dans le premier cas, et
 * l'affichage doit alors garder son ancien libellé plutôt que d'annoncer un
 * expéditeur vide.
 *
 * TOLÉRANT À TOUT : une source absente, un nombre, un objet, une source sans
 * marqueur, un marqueur suivi de rien. Ce qui arrive ici sort d'un fichier
 * téléchargé, et un fichier téléchargé peut contenir n'importe quoi — une
 * version future du site, un import à la main, un fichier tronqué.
 *
 * @param {*} source  la valeur du champ `source` du fichier distant
 * @returns {string|null}
 */
export function appareilDeSource(source) {
  if (typeof source !== "string") return null;
  // PREMIÈRE occurrence, et tout ce qui suit. Un nom qui contiendrait lui-même
  // un point médian revient donc entier : « site Funkylldex · ordi · bureau »
  // rend « ordi · bureau », qui est bien ce qui avait été composé. Couper à la
  // DERNIÈRE occurrence aurait rendu « bureau » et perdu la moitié du nom.
  const coupe = source.indexOf(MARQUEUR);
  if (coupe === -1) return null;
  return borner(source.slice(coupe + MARQUEUR.length)) || null;
}

/**
 * Le nom de l'appareil d'EN FACE — `null` quand le fichier vient de nous.
 *
 * ON SE RELIT PLUS SOUVENT QU'ON NE CROIT. Trois chemins de `sync.js` relisent
 * le dépôt juste après y avoir écrit : la résolution d'un conflit, la relecture
 * périodique, le retour du réseau. Le fichier qu'ils rapportent porte alors
 * NOTRE propre nom, et le journal affichait « Reçu de : ordinateur » pour des
 * cases cochées sur cet ordinateur-là. Une ligne d'historique qui attribue à
 * quelqu'un d'autre ce qu'on vient de faire soi-même est pire que pas de nom
 * du tout.
 *
 * DANS LE DOUTE, ON N'ACCUSE PERSONNE. Deux appareils jamais renommés portent
 * tous deux le nom deviné — « téléphone » — et cette comparaison les confond.
 * L'erreur est alors de taire un nom vrai, et l'entrée retombe sur « Reçu d'un
 * autre appareil », qui reste exact. L'erreur inverse, elle, aurait affirmé
 * quelque chose de faux. On préfère se taire.
 *
 * @param {*} source  la valeur du champ `source` du fichier distant
 * @param {string} notre  le nom de CET appareil
 * @returns {string|null}
 */
export function appareilDistant(source, notre) {
  const nom = appareilDeSource(source);
  if (!nom) return null;
  const pareil =
    typeof notre === "string" && nom.toLocaleLowerCase() === notre.trim().toLocaleLowerCase();
  return pareil ? null : nom;
}
