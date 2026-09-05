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
import { STATUS_FILTERS, FORM_FILTERS, LIBELLES_STATUT } from "../domain/filters.js";
import { t, nomType } from "../core/i18n.js";

/** Valeur consideree comme « aucun filtre » pour chaque cle. */
const NEUTRE = { search: "", type: "all", gen: "all", game: "all", form: "all", status: "all" };

export function createActiveFilters(ctx) {
  const root = document.getElementById("active-filters");
  const navToggle = document.getElementById("nav-toggle");
  const { store, dataset } = ctx;

  // Le bouton de l'etat vide retire tout : quand la liste est vide, c'est
  // presque toujours un filtre oublie.
  const vide = document.getElementById("empty-clear");
  if (vide) vide.addEventListener("click", () => store.set({ ...NEUTRE }));

  const libelle = (cle, valeur) => {
    if (cle === "search") return `« ${valeur} »`;
    if (cle === "type") return nomType(valeur);
    if (cle === "gen") return t((dataset.generations[valeur] || {}).label) || `${t("Gén.")} ${valeur}`;
    if (cle === "game") {
      const jeu = dataset.games.find((g) => g.code === valeur);
      return jeu ? t(jeu.name) : valeur;
    }
    if (cle === "form") return t((FORM_FILTERS.find((f) => f.value === valeur) || {}).label || valeur);
    if (cle === "status") {
      // `LIBELLES_STATUT` couvre les deux valeurs posees par les barres de la
      // colonne, qui n'ont pas de pastille et n'etaient donc nulle part dans
      // `STATUS_FILTERS` : sans lui, cliquer « Chromatiques » affichait « shiny ».
      const trouve = STATUS_FILTERS.find((f) => f.value === valeur);
      return t((trouve && trouve.label) || LIBELLES_STATUT[valeur] || valeur);
    }
    return valeur;
  };

  function actifs() {
    return Object.entries(NEUTRE)
      .filter(([cle, neutre]) => store.state[cle] !== neutre)
      .map(([cle]) => cle);
  }

  /**
   * La vue affichee range-t-elle en boites ?
   *
   * ═══ POURQUOI CETTE QUESTION SE POSE ICI ═══
   *
   * Les vues en boites IGNORENT les filtres, et c'est voulu : une boite de HOME
   * a trente cases, en retirer vingt parce qu'un filtre de type est actif
   * detruirait le seul interet de la vue, qui est de montrer les trous A LEUR
   * PLACE. Voir `renderList()` dans main.js, qui range toujours les 1025.
   *
   * Mais les pastilles, elles, continuaient de s'afficher. Une pastille
   * « Generation VI » posee au-dessus des quatre-vingt-quatorze boites de Kanto
   * a Paldea affirme quelque chose de faux, et c'est exactement ce que cette
   * barre existe pour eviter : son en-tete dit qu'elle est la pour qu'un filtre
   * oublie ne fasse pas passer le Pokedex pour ampute.
   *
   * ON NE RETIRE PAS LES PASTILLES POUR AUTANT. Le filtre n'est pas annule, il
   * est seulement sans effet ICI : il reprend des qu'on revient a la grille.
   * Les effacer aurait donc menti dans l'autre sens, et fait perdre un reglage
   * a chaque aller-retour entre les deux vues. On ajoute une phrase, on ne
   * retire rien.
   */
  function enBoites() {
    const mode = store.state.tab === "go" ? store.state.goMode : store.state.mode;
    return Boolean(mode) && mode !== "grille";
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
        : null,
      enBoites()
        ? el(
            "span.fchip-note",
            { title: t("Une boîte garde ses trente cases : filtrer les déplacerait, et c'est leur place qu'on vient lire.") },
            t("sans effet sur les boîtes")
          )
        : null
    );
  }

  return { render };
}
