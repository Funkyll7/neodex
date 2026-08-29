/**
 * undo.js — revenir sur la case qu'on vient de cocher.
 *
 * Cocher au pouce, une heure d'affilee, c'est rater une case de temps en
 * temps : le doigt tombe sur le bouton voisin, ou sur la vignette d'a cote.
 * Sans retour en arriere il faut retrouver le Pokemon fautif, deviner laquelle
 * de ses huit cases a bouge, et la decocher — le plus souvent on ne s'en
 * apercoit meme pas.
 *
 * Le bandeau nomme ce qui vient de se passer et le defait d'un appui. Il garde
 * une pile, pas un seul pas : une erreur remarquee trois cases plus tard se
 * repare encore.
 *
 * On memorise l'etat AVANT chaque case, jamais « l'inverse de ce qu'elle vaut
 * maintenant ». Annuler un lot dont une case a ete recochee a la main doit
 * ramener exactement ce qui etait la.
 *
 * `role="status"` : le bandeau sert aussi d'annonce aux lecteurs d'ecran, qui
 * n'entendaient rien quand une case basculait dans la grille.
 */

import { el } from "../core/dom.js";
import { isTyping } from "./shortcuts.js";
import { jouer } from "./sons.js";
import { deuxPoints, t } from "../core/i18n.js";

/** Le bandeau couvre le bas de l'ecran — la ou se trouvent les cases de la
    vignette suivante. Il se retire donc tout seul. */
const DUREE_MS = 6000;
/** Assez de pas pour rattraper une serie ratee, pas assez pour peser. */
const PROFONDEUR = 25;

export function createUndo(ctx) {
  const pile = [];
  let minuteur = 0;

  const texte = el("span.undo__text");
  const bouton = el("button.undo__btn", { type: "button", onclick: () => defaire() }, "Annuler");
  const bandeau = el("div.undo", { role: "status", "aria-live": "polite", hidden: true }, texte, bouton);
  document.body.append(bandeau);

  function montrer(message) {
    texte.textContent = message;
    // Le libellé du bouton se repose à CHAQUE apparition, et non une seule fois
    // à la construction. Le bandeau naît avec la page, donc avant que la table
    // anglaise soit chargée — et il naît APRÈS le relevé du statique de
    // `ui/langue.js`, qui ne l'a donc jamais vu. Il restait « Annuler » sous un
    // message anglais, pour toute la visite. Le reposer ici ne coûte rien : la
    // fonction ne s'exécute qu'au moment où l'on coche.
    bouton.textContent = t("Annuler");
    bandeau.hidden = false;
    clearTimeout(minuteur);
    minuteur = setTimeout(cacher, DUREE_MS);
  }

  function cacher() {
    clearTimeout(minuteur);
    bandeau.hidden = true;
  }

  function defaire() {
    const pas = pile.pop();
    if (!pas) {
      cacher();
      return;
    }
    ctx.restoreMarks(pas.entries);
    // Deux notes qui DESCENDENT, la ou tout le reste monte : un retour en
    // arriere s entend alors sans qu on ait a le nommer.
    jouer("annuler");
    // Le bandeau reste ouvert et vise desormais le pas d'avant : deux cases
    // ratees coup sur coup se defont en deux appuis au meme endroit, sans
    // avoir a rechercher le bouton.
    if (pile.length) {
      montrer(`${deuxPoints(t("Annulé"), pas.titre)} — ${t("encore")} ${pile.length}`);
    } else {
      montrer(deuxPoints(t("Annulé"), pas.titre));
      // Plus rien a defaire : le bouton ne doit pas promettre le contraire.
      bouton.disabled = true;
    }
  }

  /**
   * Ctrl+Z, le geste universel.
   *
   * `ui/shortcuts.js` rend toutes les combinaisons au navigateur — c'est la
   * bonne regle pour les touches simples, mais celle-ci n'a aucun autre sens
   * sur cette page. Jamais dans un champ de saisie : le navigateur y annule la
   * frappe, ce qui reste exactement ce qu'on attend.
   */
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (event.key !== "z" && event.key !== "Z") return;
    if (isTyping(event.target)) return;
    event.preventDefault();
    defaire();
  });

  return {
    /**
     * @param {string} titre    la phrase affichee : « Case cochée · Pikachu — Shiny ♂ »
     * @param {Array}  entries  [{ id, slot, before }] — l'etat d'AVANT, case
     *   par case. Un lot entier compte pour UN pas : defaire 63 Charmilly ne
     *   doit pas demander 63 appuis sur « Annuler ».
     */
    record(titre, entries) {
      if (!entries || !entries.length) return;
      pile.push({ titre, entries });
      if (pile.length > PROFONDEUR) pile.shift();
      bouton.disabled = false;
      montrer(titre);
    },
    undo: defaire,
  };
}
