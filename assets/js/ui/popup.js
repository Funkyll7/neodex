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
 * @returns {() => void} la fermeture, si l'appelant veut la déclencher lui-même
 */
export function ouvrirPopup({ titre, sousTitre = "", icone = null, corps = [], large = false, apres = null }) {
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
    if (e.key !== "Escape") return;
    // LE PANNEAU A PU DISPARAITRE AUTREMENT que par `fermer` — un rendu qui
    // vide son parent, un `remove()` venu d'ailleurs. L'ecouteur, lui, serait
    // reste sur `document`, et comme il coupe la propagation, il AVALAIT Echap
    // pour tout le monde : le panneau suivant ne se fermait plus, ni le menu
    // dessous. On se retire alors sans rien fermer.
    if (!fond.isConnected) {
      document.removeEventListener("keydown", surTouche, true);
      return;
    }
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
  fond.querySelector(".verrou__fermer")?.focus();

  return fermer;
}
