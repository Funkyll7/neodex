/**
 * appareil.js — le nom de CET appareil, et de lui seul.
 *
 * À QUOI IL SERT. Il accompagne chaque envoi vers le dépôt, glissé dans le
 * champ `source` de `data/collection.json` (voir `domain/source.js`, qui tient
 * la règle du format et explique pourquoi on n'ajoute aucune clé au fichier).
 * De l'autre côté, le journal des modifications peut enfin écrire « Reçu de :
 * téléphone de Kyllian » au lieu de « Reçu d'un autre appareil ».
 *
 * OÙ IL VIT : dans les préférences locales, donc dans `localStorage`, donc
 * PROPRE À CE NAVIGATEUR — comme le thème, la langue et le mode compact. Ce
 * n'est pas un rangement par commodité : c'est la condition même du service
 * rendu. Un nom qui se synchroniserait serait le même partout et ne
 * distinguerait donc rien. C'est le seul réglage du site dont la NON-diffusion
 * est la fonction, et non un effet de bord.
 *
 * IL N'EST PAS ÉCRIT TANT QU'ON NE LE CHOISIT PAS. Au premier lancement, rien
 * n'est enregistré : le nom est DÉDUIT à la volée, à chaque lecture. Ça évite
 * une écriture dans `localStorage` au démarrage — donc un mode de panne de plus
 * quand le stockage est refusé — et ça laisse le nom suivre la langue affichée
 * tant que personne ne l'a fixé. Dès que l'on tape quelque chose dans le
 * panneau des réglages, la valeur choisie prend le dessus et ne bouge plus.
 *
 * COMME `prefs.js`, CE FICHIER N'ÉCHOUE JAMAIS BRUYAMMENT. Un stockage refusé,
 * un `navigator` incomplet, un `matchMedia` absent : on retombe sur un nom
 * plausible et le site continue. Un appareil sans nom envoie exactement ce
 * qu'envoyaient les cinq cents commits précédents.
 */

import { lirePrefs, poserReglage } from "./prefs.js";
import { t } from "./i18n.js";

/**
 * La clé dans les préférences. Une seule, et elle porte une chaîne libre.
 *
 * `nomAppareil` ET SURTOUT PAS `appareil` : cette clé-là EXISTE DÉJÀ, et elle
 * porte tout autre chose — les six hexadécimaux tirés par `ui/quest.js`, qui
 * nomment la colonne dans laquelle ce navigateur écrit ses compteurs de
 * rencontres (voir la démonstration en tête de `domain/quetes.js`). Les deux
 * valeurs décrivent bien « l'appareil », d'où la collision naturelle, et elle
 * aurait fait deux dégâts d'un coup : le nom écrasait l'identifiant de colonne,
 * puis `idAppareil()` — qui vérifie la forme `/^[0-9a-f]{6}$/` — jugeait le nom
 * invalide, en tirait un neuf, et écrasait le nom à son tour. Un carnet de
 * chasses qui repart dans une colonne vierge et un nom d'appareil qui ne tient
 * pas d'une session à l'autre, sans que rien ne signale quoi que ce soit.
 */
const CLE = "nomAppareil";

/**
 * Nettoie un nom saisi : espaces normalisées, extrémités rognées.
 *
 * Les retours à la ligne et les espaces doubles viennent d'un copier-coller, et
 * ils ne se voient pas dans un champ de saisie — mais ils se verraient dans le
 * diff du prochain commit. On les réduit à l'entrée plutôt que d'avoir à s'en
 * méfier partout ensuite.
 *
 * PAS DE COUPE EN LONGUEUR ICI : la borne est une règle du FORMAT du fichier,
 * elle appartient à `domain/source.js`, qui l'applique aux deux bouts. Ce
 * module-ci ne connaît que le stockage local, et `core/` ne dépend pas de
 * `domain/`.
 */
function nettoyer(brut) {
  return String(brut ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Le nom deviné pour cet appareil : « téléphone », « tablette » ou
 * « ordinateur ».
 *
 * TROIS MOTS, PAS TRENTE. On ne cherche ni la marque ni le modèle : ce nom sert
 * à distinguer les deux ou trois appareils d'une même personne, et « iPhone 15
 * Pro » ne distingue pas mieux que « téléphone » quand il n'y en a qu'un. Un
 * mot approximatif qu'on peut remplacer d'un geste vaut mieux qu'une fiche
 * technique exacte que personne ne relit.
 *
 * ON NE RENIFLE PAS `navigator.userAgent`, et c'est délibéré. Cette chaîne est
 * un champ de ruines historique où tous les navigateurs mentent par
 * compatibilité depuis trente ans : Chrome s'y déclare Safari, qui s'y déclare
 * Mozilla, et un iPad récent s'y annonce comme un Mac. Une expression
 * régulière écrite aujourd'hui se trompe déjà sur du matériel qui existe, et se
 * trompera davantage à chaque rentrée.
 *
 * DEUX SOURCES, DANS L'ORDRE :
 *
 *   1. `navigator.userAgentData`, quand il existe — Chrome, Edge, et les
 *      navigateurs Chromium d'Android. C'est la réponse propre : le navigateur
 *      DÉCLARE s'il est mobile et sur quelle plateforme il tourne, il n'y a
 *      rien à interpréter ;
 *
 *   2. sinon — Firefox, et tout Safari, donc tout iPhone et tout iPad — la
 *      forme du matériel. Un pointeur grossier dit un doigt et non une souris ;
 *      le petit côté de l'écran sépare ensuite le téléphone de la tablette.
 *
 * LE PETIT CÔTÉ, et non la largeur : `screen.width` suit l'orientation sur
 * certains navigateurs et pas sur d'autres, une tablette couchée serait donc
 * passée pour un téléphone une fois sur deux. Le plus petit des deux côtés, lui,
 * ne change pas quand on tourne l'appareil. Le seuil de 600 px est la frontière
 * classique entre téléphone et tablette — un iPhone Pro Max fait 430 px de
 * large, un iPad mini 744 px.
 *
 * LE MOT SUIT LA LANGUE AFFICHÉE, parce qu'il se lit à l'écran : dans le
 * panneau des réglages, et dans le journal de l'appareil d'en face. Il est figé
 * dès qu'on en choisit un ; jusque-là, il se traduit avec le reste.
 */
export function nomDeduit() {
  try {
    const declare = typeof navigator !== "undefined" ? navigator.userAgentData : null;
    if (declare && typeof declare.mobile === "boolean") {
      if (declare.mobile) return t("téléphone");
      // Une TABLETTE ANDROID n'est pas « mobile » pour Chrome : le drapeau ne
      // couvre que les téléphones, et sans ce cas particulier une tablette
      // serait annoncée comme un ordinateur de bureau. C'est la seule
      // plateforme où l'écart existe — iPadOS n'expose pas `userAgentData`.
      if (declare.platform === "Android") return t("tablette");
      return t("ordinateur");
    }

    const auDoigt =
      typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (!auDoigt) return t("ordinateur");

    const ecran = typeof screen !== "undefined" ? screen : null;
    const petitCote = ecran ? Math.min(ecran.width || 0, ecran.height || 0) : 0;
    // Sans mesure d'écran exploitable, on penche vers le téléphone : c'est de
    // loin l'appareil tactile le plus courant, donc le pari le moins souvent
    // faux — et le nom se corrige d'un geste dans les réglages.
    return petitCote && petitCote >= 600 ? t("tablette") : t("téléphone");
  } catch {
    // Un environnement qu'on n'avait pas prévu. Un nom neutre vaut mieux qu'une
    // exception : ce module est appelé sur le chemin de l'envoi vers le dépôt.
    return t("ordinateur");
  }
}

/**
 * Le nom de cet appareil : celui qu'on a choisi, sinon celui qu'on devine.
 *
 * Jamais vide, jamais `null` : les appelants composent une chaîne avec, et un
 * `undefined` s'y serait affiché tel quel.
 */
export function nomDeCetAppareil() {
  return nettoyer(lirePrefs()[CLE]) || nomDeduit();
}

/**
 * Enregistre le nom choisi, et rend celui qui vaudra désormais.
 *
 * VIDER LE CHAMP N'EST PAS UNE ERREUR, c'est le geste qui remet le nom deviné :
 * on enregistre la chaîne vide, et `nomDeCetAppareil` retombe sur la déduction.
 * Il n'y a donc pas de bouton « réinitialiser » à prévoir — effacer suffit, et
 * c'est ce qu'on fait spontanément.
 */
export function poserNomDeCetAppareil(nom) {
  const propre = nettoyer(nom);
  poserReglage(CLE, propre);
  return propre || nomDeduit();
}
