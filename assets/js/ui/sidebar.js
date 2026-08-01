/**
 * sidebar.js — progression, filtres, tri.
 * Les selects sont remplis a partir des donnees : ajouter un jeu dans
 * data/reference/games.json le fait apparaitre ici sans toucher au code.
 */

import { el, fill, setOptions } from "../core/dom.js";
import { STATUS_FILTERS } from "../domain/filters.js";

export function createSidebar(ctx) {
  const { dataset, store } = ctx;

  const pills = document.getElementById("status-pills");
  const genSelect = document.getElementById("filter-gen");
  const gameSelect = document.getElementById("filter-game");
  const sortSelect = document.getElementById("filter-sort");
  const typeSelect = document.getElementById("filter-type");
  const searchInput = document.getElementById("search");
  const viewToggle = document.getElementById("view-toggle");

  /* --------------------------- remplissage --------------------------- */

  setOptions(
    genSelect,
    [
      { value: "all", label: "Toutes générations" },
      ...Object.entries(dataset.generations).map(([value, g]) => ({ value, label: g.label })),
    ],
    store.state.gen
  );

  setOptions(
    gameSelect,
    [
      { value: "all", label: "N'importe quel jeu" },
      ...dataset.games.map((g) => ({ value: g.code, label: g.name })),
    ],
    store.state.game
  );

  setOptions(
    typeSelect,
    [
      { value: "all", label: "Tous les types" },
      ...Object.keys(dataset.types).map((t) => ({ value: t, label: t })),
    ],
    store.state.type
  );

  sortSelect.value = store.state.sort;
  searchInput.value = store.state.search;

  fill(
    viewToggle,
    [
      ["auto", "Auto", "Affiche le shiny si tu l'as coché"],
      ["normal", "Normal", "Force l'image normale partout"],
      ["shiny", "✦ Shiny", "Force l'image chromatique partout"],
    ].map(([value, label, title]) =>
      el("button", {
        type: "button",
        title,
        "aria-pressed": String(store.state.view === value),
        dataset: { view: value },
        onclick: () => store.set({ view: value }),
        textContent: label,
      })
    )
  );

  /* ----------------------------- ecouteurs ---------------------------- */

  genSelect.addEventListener("change", () => store.set({ gen: genSelect.value }));
  gameSelect.addEventListener("change", () => store.set({ game: gameSelect.value }));
  sortSelect.addEventListener("change", () => store.set({ sort: sortSelect.value }));
  typeSelect.addEventListener("change", () => store.set({ type: typeSelect.value }));
  searchInput.addEventListener("input", ctx.onSearchInput);

  // Menu repliable en mobile.
  const navToggle = document.getElementById("nav-toggle");
  const sidebar = document.getElementById("sidebar");
  const mobile = window.matchMedia("(max-width: 860px)");
  const syncNav = () => {
    sidebar.hidden = mobile.matches && navToggle.getAttribute("aria-expanded") !== "true";
  };
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    syncNav();
  });
  mobile.addEventListener("change", syncNav);
  syncNav();

  /* ------------------------------- rendu ------------------------------ */

  const out = {
    pct: document.getElementById("stat-pct"),
    owned: document.getElementById("stat-owned"),
    total: document.getElementById("stat-total"),
    shiny: document.getElementById("stat-shiny"),
    pair: document.getElementById("stat-pair"),
    bar: document.getElementById("progress-bar"),
    fill: document.getElementById("progress-fill"),
  };

  return {
    render(counts) {
      out.pct.textContent = counts.pct;
      out.owned.textContent = counts.owned;
      out.total.textContent = counts.total;
      out.shiny.textContent = counts.shiny;
      out.pair.textContent = counts.pair;
      out.fill.style.width = `${counts.pct}%`;
      out.bar.setAttribute("aria-valuenow", counts.pct);

      fill(
        pills,
        STATUS_FILTERS.map((filter) =>
          el(
            "button.pill",
            {
              type: "button",
              "aria-pressed": String(store.state.status === filter.value),
              onclick: () => store.set({ status: filter.value }),
            },
            el("span", filter.label),
            el("span.pill__count", counts[filter.key])
          )
        )
      );

      for (const button of viewToggle.children) {
        button.setAttribute("aria-pressed", String(button.dataset.view === store.state.view));
      }
      genSelect.value = store.state.gen;
      gameSelect.value = store.state.game;
      sortSelect.value = store.state.sort;
      typeSelect.value = store.state.type;
    },
  };
}
