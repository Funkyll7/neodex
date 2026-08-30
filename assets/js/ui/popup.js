/**
 * popup.js — la coquille commune des panneaux qui s'ouvrent par-dessus.
 *
 * POURQUOI ELLE EXISTE. L'aperçu d'une récompense verrouillée l'avait écrite le
 * premier ; l'aperçu d'une palette l'a reprise ; le détail d'une synchronisation
 * allait en faire une troisième copie. Or ce n'est pas la boîte qui est
 * délicate, ce sont ses QUATRE CHEMINS DE FERMETURE, et chacun a coûté un bug :
 *
 *   - la croix, qui doit dépiler l'entrée d'historique qu'elle n'a pas empilée ;
 *   - le voile, qui ferme, alors qu'un clic DANS la boîte ne doit pas — sans
 *     l'interception, essayer un son refermait le panneau au premier appui ;
 *   - Échap, qui doit être pris EN CAPTURE et arrêté net, sinon il traverse et
 *     ferme aussi le menu qui se trouve dessous ;
 *   - le geste Retour du téléphone, qui passe par `ui/retour.js` et ne doit
 *     concerner que le panneau du dessus.
 *
 * Trois copies de ça, c'est trois occasions de n'en corriger que deux.
 */

import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { retourFerme } from "./retour.js";

/**
 * Ouvre un panneau modal et rend de quoi le refermer.
 *
 * @param {Object} options
 * @param {string} options.titre       le nom, en gros
 * @param {string} [options.sousTitre] la ligne sous le nom
 * @param {Node|string} [options.icone] posé à gauche du titre
 * @param {Array} options.corps        le contenu, sous l'en-tête
 * @param {boolean} [options.large]    plus large : pour ce qui se juge en grand
 * @param {() => void} [options.apres] appelé APRÈS insertion, pour ce qui a
 *        besoin de mesurer — une largeur n'existe pas hors du document
 * @param {boolean} [options.focus] donner le clavier à la croix. Vrai par
 *        défaut ; faux quand le panneau s'ouvre de lui-même
 * @returns {() => void} la fermeture, si l'appelant veut la déclencher lui-même
 */
export function ouvrirPopup({ titre, sousTitre = "", icone = null, corps = [], large = false, apres = null, focus = true }) {
  document.querySelector(".verrou-fond")?.remove();

  const fond = el("div.verrou-fond", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": titre,
  });

  let liberer = null;
  const fermer = () => {
    fond.remove();
    document.removeEventListener("keydown", surTouche, true);
    if (liberer) {
      const f = liberer;
      liberer = null;
      f();
    }
  };

  const surTouche = (e) => {
    if (e.key !== "Escape" && e.key !== "Tab") return;
    // LE PANNEAU A PU DISPARAITRE AUTREMENT que par `fermer` — un rendu qui
    // vide son parent, un `remove()` venu d'ailleurs. L'ecouteur, lui, serait
    // reste sur `document`, et comme il coupe la propagation, il AVALAIT Echap
    // pour tout le monde : le panneau suivant ne se fermait plus, ni le menu
    // dessous. On se retire alors sans rien fermer.
    if (!fond.isConnected) {
      document.removeEventListener("keydown", surTouche, true);
      return;
    }
    // La tabulation est traitee AVANT Echap, mais APRES ce controle : un
    // ecouteur orphelin qui piegerait la tabulation enfermerait le clavier
    // dans un panneau qui n existe plus.
    if (e.key === "Tab") return piegerTabulation(e, fond);
    // EN CAPTURE, ET ON ARRÊTE TOUT. Le menu de customisation écoute Échap lui
    // aussi, sur `document` : sans cet arrêt, une seule pression fermait les
    // deux panneaux et renvoyait sur la grille, alors qu'on voulait revenir à
    // la liste. La capture passe AVANT son écouteur, et
    // `stopImmediatePropagation` coupe la propagation entière.
    e.stopImmediatePropagation();
    e.preventDefault();
    fermer();
  };

  fond.append(
    el(
      "div.verrou" + (large ? ".verrou--large" : ""),
      {
        // Un clic DANS la boîte ne doit pas la fermer, alors qu'un clic sur le
        // voile derrière doit le faire. Sans cette interception, essayer le son
        // « Cristal » refermait le pop-up au premier appui.
        onclick: (e) => e.stopPropagation(),
      },
      el(
        "div.verrou__tete",
        icone ? el("span.verrou__cadenas", { "aria-hidden": "true" }, icone) : null,
        el(
          "div.verrou__identite",
          el("h3.verrou__nom", titre),
          sousTitre ? el("p.verrou__type", sousTitre) : null
        ),
        el("button.verrou__fermer", {
          type: "button",
          "aria-label": t("Fermer"),
          textContent: "✕",
          onclick: fermer,
        })
      ),
      // LE CORPS EST UNE ZONE A PART, et c'est ce qui permet a l'en-tete de
      // rester en place. Avant, `.verrou` defilait en entier : sur un long
      // panneau — le detail d'une synchronisation en compte parfois trente —,
      // le titre et la croix partaient vers le haut, et il fallait remonter
      // pour fermer. La boite ne defile plus, le corps si.
      el("div.verrou__corps", ...corps)
    )
  );

  fond.addEventListener("click", fermer);
  document.addEventListener("keydown", surTouche, true);
  document.body.append(fond);
  // APRÈS l'insertion, et pas avant : ce qui se règle sur une largeur mesurée
  // n'a rien à mesurer tant que l'élément est hors du document.
  if (apres) apres(fond);
  liberer = retourFerme(fermer);
  // LE FOCUS NE SE PREND QUE SUR UNE OUVERTURE DEMANDEE.
  //
  // Sur un clic, le prendre est juste : on vient d ouvrir ce panneau, le
  // clavier doit y etre. Sur une ouverture AUTOMATIQUE — le detail d une
  // synchronisation qui arrive pendant qu on tape dans la recherche —, c est
  // l inverse : le curseur saute hors du champ au milieu d un mot, et la
  // frappe suivante part dans le vide. L appelant qui n a rien demande passe
  // donc `focus: false`.
  if (focus) fond.querySelector(".verrou__fermer")?.focus();

  return fermer;
}

/**
 * Garde la tabulation DANS le panneau.
 *
 * Le voile annonce `aria-modal="true"` : un lecteur d'écran cesse alors
 * d'annoncer ce qu'il y a derrière, et l'utilisateur est fondé à croire qu'il
 * n'y a plus rien d'autre. Au clavier, pourtant, Tab sortait du panneau et
 * continuait dans la grille — mille vignettes à traverser à l'aveugle avant de
 * revenir. La promesse n'était pas tenue.
 *
 * Le cycle se ferme donc à la main : depuis le dernier élément, Tab revient au
 * premier ; depuis le premier, Maj+Tab va au dernier. La liste est relue à
 * CHAQUE pression et non retenue à l'ouverture — le journal ajoute des blocs
 * dépliables, l'aperçu des sons deux boutons, et un panneau qui change de
 * contenu invaliderait une liste figée.
 *
 * `:not([tabindex="-1"])` exclut ce qui a été volontairement retiré du cycle,
 * comme les boutons de la vignette de démonstration.
 */
function piegerTabulation(e, fond) {
  const boite = fond.querySelector(".verrou");
  if (!boite) return;

  const focalisables = [...boite.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]'
  )].filter((n) => n.tabIndex !== -1 && n.offsetParent !== null);
  if (!focalisables.length) return;

  const premier = focalisables[0];
  const dernier = focalisables[focalisables.length - 1];
  // `document.activeElement` et non la cible de l'évènement : celle-ci est le
  // document quand rien n'est encore focalisé — le cas d'une ouverture
  // automatique, qui ne prend justement pas le clavier.
  const courant = document.activeElement;

  if (e.shiftKey && (courant === premier || !boite.contains(courant))) {
    e.preventDefault();
    dernier.focus();
  } else if (!e.shiftKey && (courant === dernier || !boite.contains(courant))) {
    e.preventDefault();
    premier.focus();
  }
}