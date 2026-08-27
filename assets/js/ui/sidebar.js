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

  // La region parle plus que le chiffre romain : on retient « Hoenn » bien
  // avant « Génération III ».
  setOptions(
    genSelect,
    [
      { value: "all", label: "Toutes générations" },
      ...Object.entries(dataset.generations).map(([value, g]) => ({
        value,
        label: g.region ? `${g.label} — ${g.region}` : g.label,
      })),
    ],
    store.state.gen
  );

  // Vingt-trois jeux a plat se lisent mal : on les regroupe par generation,
  // c'est l'ordre dans lequel on les a en tete.
  const parGeneration = new Map();
  for (const jeu of dataset.games) {
    const gen = dataset.generations[jeu.gen] || {};
    const titre = gen.region ? `${gen.label} — ${gen.region}` : `Génération ${jeu.gen}`;
    if (!parGeneration.has(titre)) parGeneration.set(titre, []);
    parGeneration.get(titre).push({ value: jeu.code, label: jeu.name });
  }
  setOptions(
    gameSelect,
    [{ value: "all", label: "N'importe quel jeu" }],
    store.state.game,
    [...parGeneration].map(([label, options]) => ({ label, options }))
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

  /**
   * Remet les controles en accord avec l'etat, sans rien recalculer.
   *
   * `render()` refait les compteurs, ce qui reparcourt les 1025 especes : trop
   * cher a chaque changement de filtre. Or une barre cliquee doit s'allumer
   * tout de suite, et le select « Forme » suivre. D'ou ce chemin leger, appele
   * par main.js quand un filtre bouge.
   */
  function syncActive() {
    searchInput.value = store.state.search;
    genSelect.value = store.state.gen;
    formSelect.value = store.state.form;
    gameSelect.value = store.state.game;
    sortSelect.value = store.state.sort;
    typeSelect.value = store.state.type;

    for (const pill of pills.children) {
      pill.setAttribute("aria-pressed", String(pill.dataset.value === store.state.status));
    }
    for (const row of out.bars.querySelectorAll(".bars__row")) {
      const actif = row.dataset.cible !== "all" && store.state[row.dataset.filtre] === row.dataset.cible;
      row.setAttribute("aria-pressed", String(actif));
    }
    for (const button of viewToggle.children) {
      button.setAttribute("aria-pressed", String(button.dataset.view === store.state.view));
    }
  }

  return {
    syncActive,

    /**
     * @param {object} counts    decompte par espece (combien en ai-je ?)
     * @param {object} progress  decompte par case (combien de cases ai-je ?)
     */
    render(counts, progress) {
      // Le grand chiffre compte les CASES, pas les especes : c'est la vraie
      // progression du site. Le decompte d'especes descend dans « Ma
      // collection », sous son propre nom.
      const total = (progress && progress.all) || { done: 0, total: 0, pct: 0 };
      out.pct.textContent = total.pct;
      out.owned.textContent = total.done;
      out.total.textContent = total.total;
      out.fill.style.width = `${total.pct}%`;
      out.bar.setAttribute("aria-valuenow", total.pct);

      if (progress) renderBars(out, progress, counts, store);

      fill(
        pills,
        STATUS_FILTERS.map((filter) =>
          el(
            "button.pill",
            {
              type: "button",
              "aria-pressed": String(store.state.status === filter.value),
              dataset: { value: filter.value },
              onclick: () => store.set({ status: filter.value }),
            },
            // « Statut » ne porte plus ni le filtre chromatique ni celui des
            // paires : ils sont devenus des barres de progression cliquables.
            // Ces pastilles n'ont donc plus de logo, seulement un libellé.
            el("span.pill__name", filter.label),
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
 * generaux.
 *
 * Chaque barre est un BOUTON : cliquer « Alola » ne filtre pas seulement la
 * liste, il repond a la question qu'on vient de se poser en lisant la barre —
 * « il m'en manque douze, lesquels ? ». Recliquer la meme barre revient a tout.
 *
 * `filtre` dit quelle cle d'etat la barre pilote : `form` pour les familles de
 * formes, `status` pour les trois angles generaux.
 */
const BAR_GROUPS = [
  {
    title: "Formes",
    filtre: "form",
    rows: [
      ["alola", "Alola", "assets/img/forme-alola.png", "Les 18 formes d'Alola, normales et chromatiques."],
      ["galar", "Galar", "assets/img/forme-galar.png", "Les 20 formes de Galar, normales et chromatiques."],
      ["hisui", "Hisui", "assets/img/forme-hisui.png", "Les 16 formes de Hisui, normales et chromatiques."],
      ["paldea", "Paldéa", "assets/img/forme-paldea.png", "Les 4 formes de Paldéa, normales et chromatiques."],
      ["gmax", "Gigamax", "assets/img/gigamax.png", "Les 34 formes Gigamax, normales et chromatiques."],
      // « Autres formes » et « Cosmétiques » n'ont plus de barre : ce sont des
      // fourre-tout sans logo, qui allongeaient la colonne sans répondre à une
      // question qu'on se pose. Ils restent comptés dans « Tout » et
      // atteignables par le select « Forme ».
    ],
  },
  {
    title: "Ma collection",
    filtre: "status",
    rows: [
      // Le decompte d'ESPECES — combien de Pokemon distincts sont capturés,
      // sans compter leurs formes. Le total en CASES, lui, est le grand
      // chiffre en tete du panneau.
      ["dex", "Progression Pokédex", null, "Espèces distinctes capturées, formes non comprises. Le grand chiffre au-dessus compte les cases, celui-ci compte les Pokémon."],
      ["pairs", "Paires ♂ / ♀", null, "Espèces à apparence mâle et femelle distinctes dont les deux cases sont cochées."],
      // « shiny » n'est pas un chemin d'image : le logo chromatique est posé en
      // masque, pour prendre la couleur du thème comme partout ailleurs.
      ["shiny", "Chromatiques", "shiny", "Toutes les cases chromatiques du site, formes comprises."],
    ],
  },
];

/**
 * La cle de la barre n'est pas toujours celle du filtre : la barre « Paires »
 * compte des cases (`pairs`), le filtre s'appelle `pair` ; « Tout » n'est pas
 * un filtre du tout, c'est le retour a l'etat neutre.
 */
const CLE_FILTRE = { dex: "owned", pairs: "pair", shiny: "shiny" };

function renderBars(out, progress, counts, store) {
  // « Progression Pokédex » ne vient pas de `progress` : c'est le seul
  // compteur d'ESPECES de la liste, il vit dans `collection.counts()`.
  const especes = { done: counts.owned, total: counts.total, pct: counts.pct };

  fill(
    out.bars,
    BAR_GROUPS.map((group) =>
      el(
        "section.bars__group",
        el("h2.panel__label", group.title),
        group.rows.map(([key, label, icon, title]) => {
          const value = key === "dex" ? especes : progress.kinds[key] || progress[key];
          if (!value) return null;

          const cible = group.filtre === "form" ? key : CLE_FILTRE[key] || key;
          const actif = store.state[group.filtre] === cible && cible !== "all";
          // On relit l'etat au clic plutot que de fermer sur `actif` : la barre
          // n'est pas reconstruite a chaque changement de filtre (voir
          // `syncActive`), la valeur capturee serait vite perimee.
          const bascule = () => {
            const courant = store.state[group.filtre];
            store.set({ [group.filtre]: courant === cible ? "all" : cible });
          };

          return el(
            "button.bars__row",
            {
              type: "button",
              title: `${title}\nCliquer pour ${actif ? "retirer le filtre" : "n'afficher que ceux-là"}.`,
              "aria-pressed": String(actif),
              // Lus par `syncActive()` : la barre doit s'allumer sans qu'on
              // reconstruise tout le bloc.
              dataset: { filtre: group.filtre, cible },
              onclick: bascule,
            },
            el(
              "span.bars__head",
              icon === "shiny"
                ? el("span.toggle__ico.toggle__ico--shiny.bars__icon", { "aria-hidden": "true" })
                : icon
                  ? el("img.bars__icon", { src: icon, alt: "", width: 15, height: 15, loading: "lazy" })
                  : null,
              el("span.bars__label", label),
              el("span.bars__pct", `${value.pct} %`)
            ),
            // Le decompte descend a cote de la jauge, sur la deuxieme ligne.
            // En tete il disputait la place au libelle : la colonne fait 268 px,
            // « 504 / 1377 » en mangeait 53, et « Chromatiques » — un seul mot,
            // donc insecable — debordait de sa boite pour se peindre par-dessus
            // le nombre. Deplace ici, il ne coute pas une ligne de plus.
            el(
              "span.bars__meter",
              el(
                "span.bar",
                {
                  role: "progressbar",
                  "aria-label": label,
                  "aria-valuemin": "0",
                  "aria-valuemax": "100",
                  "aria-valuenow": String(value.pct),
                },
                el(key === "gmax" ? "span.bar__fill.bar__fill--gmax" : "span.bar__fill", {
                  style: { width: `${value.pct}%` },
                })
              ),
              el("span.bars__value", `${value.done} / ${value.total}`)
            )
          );
        })
      )
    )
  );
}
