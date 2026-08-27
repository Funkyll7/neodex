/**
 * go-dex.js — le livingdex Pokémon GO.
 *
 * Un Pokédex volontairement plus simple que l'autre : GO ne connaît ni forme
 * régionale, ni Gigamax, ni case ♂ / ♀. Une espèce y vaut deux cases — attrapé,
 * chromatique — et rien de plus. Recopier la vignette du Pokédex HOME, avec ses
 * six boutons et son compteur de formes, aurait affiché six cases dont quatre
 * n'existent pas dans le jeu.
 *
 * Les deux collections ne se mélangent jamais : les cases GO s'appellent `gn`
 * et `gs`, `completion.js` ne les regarde pas, et le pourcentage HOME ne bouge
 * pas d'un point quand on coche ici.
 *
 * Mêmes deux principes que dex-grid.js, et pour les mêmes raisons :
 *   - un seul écouteur, délégué sur la grille, jamais détruit ;
 *   - cocher une case *repeint* la vignette au lieu de la remplacer, sinon le
 *     bouton disparaît sous le doigt et l'événement suivant retombe sur son
 *     remplaçant.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { spriteImg } from "../domain/sprites.js";
import { applyGoFilters, GO_FILTERS } from "../domain/filters.js";
import { goProgressOf } from "../domain/progress.js";
import { dexNumber } from "./common.js";

export function createGoDex(ctx) {
  const { store, collection, dataset } = ctx;
  const grid = document.getElementById("go-grid");
  const empty = document.getElementById("go-empty");
  const sentinel = document.getElementById("go-sentinel");
  const counter = document.getElementById("go-count");
  const search = document.getElementById("go-search");
  const genSelect = document.getElementById("go-gen");
  const viewToggle = document.getElementById("go-view");

  const out = {
    owned: document.getElementById("go-owned"),
    shiny: document.getElementById("go-shiny"),
    pct: document.getElementById("go-pct"),
    bar: document.getElementById("go-bar"),
    fill: document.getElementById("go-fill"),
  };

  let list = [];
  let shown = 0;

  /* ------------------------------ commandes ---------------------------- */

  // Même libellé que la barre latérale : la région parle plus que le chiffre
  // romain, on retient « Hoenn » bien avant « Génération III ».
  fill(
    genSelect,
    el("option", { value: "all" }, "Toutes générations"),
    Object.entries(dataset.generations).map(([value, gen]) =>
      el("option", { value }, gen.region ? `${gen.label} — ${gen.region}` : gen.label)
    )
  );
  genSelect.value = store.state.goGen;
  genSelect.addEventListener("change", () => store.set({ goGen: genSelect.value }));

  fill(
    viewToggle,
    GO_FILTERS.map((filtre) =>
      el(
        "button",
        {
          type: "button",
          dataset: { value: filtre.value },
          "aria-pressed": String(store.state.goStatus === filtre.value),
          onclick: () => store.set({ goStatus: filtre.value }),
        },
        filtre.label
      )
    )
  );

  search.addEventListener("input", ctx.onGoSearchInput);

  /* ------------------------------ défilement --------------------------- */

  function appendPage() {
    const next = list.slice(shown, shown + CONFIG.pageSize);
    grid.append(...next.map((species) => carte(species, ctx)));
    shown += next.length;
  }

  /**
   * Même observateur que dex-grid.js, et pour la même raison : lire une
   * position juste après avoir ajouté 120 vignettes force le navigateur à
   * remettre en page toute la grille sur-le-champ. L'observateur, lui, ne lit
   * jamais rien — c'est le navigateur qui prévient.
   *
   * Un panneau `hidden` ne déclenche aucune intersection : la grille GO ne se
   * remplit donc pas pendant qu'on regarde l'autre onglet, sans qu'on ait à le
   * tester nous-mêmes. C'est aussi pourquoi `reveal()` doit ré-armer.
   */
  const observer = new IntersectionObserver(
    (entries) => {
      if (shown >= list.length) return;
      if (!entries.some((entry) => entry.isIntersecting)) return;
      appendPage();
      rearmer();
    },
    { rootMargin: "600px 0px" }
  );

  function rearmer() {
    observer.unobserve(sentinel);
    if (shown < list.length) observer.observe(sentinel);
  }

  grid.addEventListener("click", (event) => {
    const bouton = event.target.closest("[data-go-slot]");
    if (!bouton) return;
    ctx.onGoToggle(Number(bouton.dataset.species), bouton.dataset.goSlot);
  });

  /* -------------------------------- rendu ------------------------------ */

  function renderStats() {
    const progress = goProgressOf(dataset.species, collection);
    out.owned.textContent = progress.owned;
    out.shiny.textContent = progress.shiny;
    out.pct.textContent = progress.pct;
    out.fill.style.width = `${progress.pct}%`;
    out.bar.setAttribute("aria-valuenow", progress.pct);
    return progress;
  }

  return {
    /** Rendu complet : la liste filtrée a changé. */
    render() {
      list = applyGoFilters(dataset.species, store.state, collection);
      shown = 0;
      grid.replaceChildren();
      empty.hidden = list.length > 0;
      counter.textContent = `${list.length} résultat${list.length > 1 ? "s" : ""}`;
      for (const bouton of viewToggle.children) {
        bouton.setAttribute("aria-pressed", String(bouton.dataset.value === store.state.goStatus));
      }
      if (genSelect.value !== store.state.goGen) genSelect.value = store.state.goGen;
      renderStats();
      appendPage();
      rearmer();
    },

    /** Une case vient d'être cochée : on repeint une vignette et les chiffres. */
    refresh(id) {
      renderStats();
      const node = grid.querySelector(`[data-id="${id}"]`);
      if (!node) return;
      peindre(node, dataset.byId.get(id), ctx);
      // La vignette ne correspond plus au filtre en cours : on la BARRE au lieu
      // de reconstruire 1025 vignettes sous le doigt. Reconstruire décalait la
      // liste d'un cran et remettait le défilement au premier palier — chaque
      // Pokémon attrapé coûtait alors une remontée de liste entière.
      if (store.state.goStatus !== "all") {
        const encore = applyGoFilters([dataset.byId.get(id)], store.state, collection).length > 0;
        node.classList.toggle("gcard--stale", !encore);
      }
    },

    /**
     * L'onglet vient de s'afficher. Tant qu'il était `hidden`, la sentinelle ne
     * pouvait déclencher aucune intersection : l'observateur n'a donc rien vu,
     * et il faut le ré-armer pour qu'il rende son verdict maintenant.
     */
    reveal() {
      rearmer();
    },
  };
}

/* -------------------------------- vignette ------------------------------- */

function carte(species, ctx) {
  const color = ctx.dataset.types[species.types[0]] || "#8b8b8b";
  const node = el(
    "div.gcard",
    { "--type": color, dataset: { id: species.id }, role: "listitem" },
    el("span.gcard__num", dexNumber(species.id)),
    el("span.gcard__art"),
    el("span.gcard__name", species.name),
    el(
      "div.gcard__toggles",
      el(
        "button.gcard__btn",
        {
          type: "button",
          dataset: { goSlot: "gn", species: species.id },
          title: `${species.name} — attrapé dans Pokémon GO`,
          "aria-label": `${species.name} — attrapé dans Pokémon GO`,
        },
        el("span.toggle__ico.toggle__ico--capture", { "aria-hidden": "true" })
      ),
      el(
        "button.gcard__btn.gcard__btn--gold",
        {
          type: "button",
          dataset: { goSlot: "gs", species: species.id },
          title: `${species.name} — chromatique dans Pokémon GO`,
          "aria-label": `${species.name} — chromatique dans Pokémon GO`,
        },
        el("span.toggle__ico.toggle__ico--shiny", { "aria-hidden": "true" })
      )
    )
  );
  peindre(node, species, ctx);
  return node;
}

/**
 * Remet la vignette à l'état de la collection. Les boutons ne sont jamais
 * remplacés : on ne fait que retourner leur `aria-pressed`.
 */
function peindre(node, species, ctx) {
  const { collection } = ctx;
  const attrape = collection.has(species.id, "gn");
  const shiny = collection.has(species.id, "gs");

  node.className = [
    "gcard",
    attrape ? "gcard--owned" : "gcard--missing",
    shiny ? "gcard--shiny" : "",
    attrape && shiny ? "gcard--complete" : "",
  ]
    .filter(Boolean)
    .join(" ");

  node.title = attrape && shiny ? "Attrapé et chromatique" : attrape ? "Attrapé" : "À attraper";

  // Le chromatique obtenu prend la place du sprite normal : c'est celui dont on
  // est fier, et c'est celui qu'on cherche des yeux en parcourant la grille.
  const art = node.querySelector(".gcard__art");
  const key = String(shiny);
  if (art.dataset.key !== key) {
    art.dataset.key = key;
    fill(art, spriteImg(species.id, { shiny, alt: species.name, className: "gcard__img" }));
  }

  for (const bouton of node.querySelectorAll("[data-go-slot]")) {
    bouton.setAttribute("aria-pressed", String(collection.has(species.id, bouton.dataset.goSlot)));
  }
}
