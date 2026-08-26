/**
 * sidebar.js — progression, filtres, tri.
 * Les selects sont remplis a partir des donnees : ajouter un jeu dans
 * data/reference/games.json le fait apparaitre ici sans toucher au code.
 */

import { el, fill, setOptions } from "../core/dom.js";
import { STATUS_FILTERS, FORM_FILTERS } from "../domain/filters.js";

export function createSidebar(ctx) {
  const { dataset, store } = ctx;

  const pills = document.getElementById("status-pills");
  const genSelect = document.getElementById("filter-gen");
  const formSelect = document.getElementById("filter-form");
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

  setOptions(formSelect, FORM_FILTERS, store.state.form);

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
  formSelect.addEventListener("change", () => store.set({ form: formSelect.value }));
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
    bar: document.getElementById("progress-bar"),
    fill: document.getElementById("progress-fill"),
    bars: document.getElementById("progress-bars"),
  };

  return {
    /**
     * @param {object} counts    decompte par espece (combien en ai-je ?)
     * @param {object} progress  decompte par case (combien de cases ai-je ?)
     */
    render(counts, progress) {
      out.pct.textContent = counts.pct;
      out.owned.textContent = counts.owned;
      out.total.textContent = counts.total;
      out.fill.style.width = `${counts.pct}%`;
      out.bar.setAttribute("aria-valuenow", counts.pct);

      if (progress) renderBars(out, progress);

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
      formSelect.value = store.state.form;
      gameSelect.value = store.state.game;
      sortSelect.value = store.state.sort;
      typeSelect.value = store.state.type;
    },
  };
}

/* ------------------------------ barres de % ------------------------------ */

/**
 * Deux groupes, parce que les barres ne repondent pas a la meme question.
 *
 * « Formes » decoupe le travail qui reste, region par region : on voit d'un
 * coup qu'il manque les Galar. « Ma collection » donne les trois angles
 * generaux. Avant, quatre barres melangeaient les deux et une carte Gigamax
 * separee repetait l'une d'elles — la colonne etait chargee sans rien dire de
 * plus.
 */
const BAR_GROUPS = [
  {
    title: "Formes",
    rows: [
      ["alola", "Alola", "assets/img/forme-alola.png", "Les 18 formes d'Alola, normales et chromatiques."],
      ["galar", "Galar", "assets/img/forme-galar.png", "Les 20 formes de Galar, normales et chromatiques."],
      ["hisui", "Hisui", null, "Les 16 formes de Hisui, normales et chromatiques."],
      ["paldea", "Paldéa", "assets/img/forme-paldea.png", "Les 4 formes de Paldéa, normales et chromatiques."],
      ["other", "Autres formes", null, "Formes alternatives hors régions : Motisma, Deoxys, Sylveroy, Salarsen Forme Grave…"],
      ["cosmetic", "Cosmétiques", null, "Zarbi, Prismillon, Charmilly, Flabébé, saisons, capes…"],
      ["gmax", "Gigamax", "assets/img/gigamax.png", "Les 34 formes Gigamax, normales et chromatiques."],
    ],
  },
  {
    title: "Ma collection",
    rows: [
      ["all", "Tout", null, "Toutes les cases du site : espèces, formes régionales, cosmétiques et Gigamax."],
      ["pairs", "Paires ♂ / ♀", null, "Espèces à apparence mâle et femelle distinctes dont les deux cases sont cochées."],
      ["shiny", "Chromatiques", null, "Toutes les cases chromatiques du site, formes comprises."],
    ],
  },
];

function renderBars(out, progress) {
  fill(
    out.bars,
    BAR_GROUPS.map((group) =>
      el(
        "section.bars__group",
        el("h2.panel__label", group.title),
        group.rows.map(([key, label, icon, title]) => {
          const value = progress.kinds[key] || progress[key];
          if (!value) return null;
          return el(
            "div.bars__row",
            { title },
            el(
              "div.bars__head",
              icon
                ? el("img.bars__icon", { src: icon, alt: "", width: 15, height: 15, loading: "lazy" })
                : null,
              el("span.bars__label", label),
              el("span.bars__value", `${value.done} / ${value.total}`),
              el("span.bars__pct", `${value.pct} %`)
            ),
            el(
              "div.bar",
              {
                role: "progressbar",
                "aria-label": label,
                "aria-valuemin": "0",
                "aria-valuemax": "100",
                "aria-valuenow": String(value.pct),
              },
              el(key === "gmax" ? "div.bar__fill.bar__fill--gmax" : "div.bar__fill", {
                style: { width: `${value.pct}%` },
              })
            )
          );
        })
      )
    )
  );
}
