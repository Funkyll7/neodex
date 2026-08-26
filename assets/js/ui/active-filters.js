/**
 * active-filters.js — le rappel de ce qui filtre la liste.
 *
 * Sur telephone la barre laterale est repliee derriere un bouton : un filtre
 * pose la veille reste actif, invisible, et le Pokedex a l'air amputé. Les
 * pastilles disent ce qui s'applique, et chacune se retire d'un geste.
 *
 * Le meme etat alimente le compteur pose sur le bouton « Filtres » : meme
 * replie, il annonce combien de criteres sont actifs.
 */

import { el, fill } from "../core/dom.js";
import { STATUS_FILTERS, FORM_FILTERS } from "../domain/filters.js";

/** Valeur consideree comme « aucun filtre » pour chaque cle. */
const NEUTRE = { search: "", type: "all", gen: "all", game: "all", form: "all", status: "all" };

export function createActiveFilters(ctx) {
  const root = document.getElementById("active-filters");
  const navToggle = document.getElementById("nav-toggle");
  const { store, dataset } = ctx;

  const libelle = (cle, valeur) => {
    if (cle === "search") return `« ${valeur} »`;
    if (cle === "type") return valeur;
    if (cle === "gen") return (dataset.generations[valeur] || {}).label || `Gén. ${valeur}`;
    if (cle === "game") {
      const jeu = dataset.games.find((g) => g.code === valeur);
      return jeu ? jeu.name : valeur;
    }
    if (cle === "form") return (FORM_FILTERS.find((f) => f.value === valeur) || {}).label || valeur;
    if (cle === "status") return (STATUS_FILTERS.find((f) => f.value === valeur) || {}).label || valeur;
    return valeur;
  };

  function actifs() {
    return Object.entries(NEUTRE)
      .filter(([cle, neutre]) => store.state[cle] !== neutre)
      .map(([cle]) => cle);
  }

  function render() {
    const cles = actifs();

    // Le compteur sur le bouton « Filtres » : la seule chose visible quand la
    // colonne est repliee.
    const badge = navToggle.querySelector(".nav-toggle__count");
    if (cles.length) {
      if (badge) badge.textContent = cles.length;
      else navToggle.append(el("span.nav-toggle__count", String(cles.length)));
    } else if (badge) {
      badge.remove();
    }

    root.hidden = cles.length === 0;
    if (!cles.length) return;

    fill(
      root,
      cles.map((cle) =>
        el(
          "button.fchip",
          {
            type: "button",
            title: `Retirer ce filtre : ${libelle(cle, store.state[cle])}`,
            onclick: () => store.set({ [cle]: NEUTRE[cle] }),
          },
          el("span.fchip__text", libelle(cle, store.state[cle])),
          el("span.fchip__x", { "aria-hidden": "true" }, "✕")
        )
      ),
      cles.length > 1
        ? el(
            "button.fchip.fchip--clear",
            {
              type: "button",
              title: "Retirer tous les filtres",
              onclick: () => store.set({ ...NEUTRE }),
            },
            "Tout effacer"
          )
        : null
    );
  }

  return { render };
}
