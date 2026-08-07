/**
 * main.js — point d'entree : charge les donnees, cable les vues, gere l'etat.
 *
 * Flux : un store unique -> un abonne qui repeint uniquement ce qui depend des
 * cles modifiees. Aucun framework, aucune etape de build : le dossier tel quel
 * est deployable sur GitHub Pages.
 */

import { CONFIG } from "./config.js";
import { createStore, debounce } from "./core/store.js";
import { el, fill } from "./core/dom.js";
import { loadDataset } from "./core/data.js";
import { Collection } from "./domain/collection.js";
import { GitHubSync } from "./domain/sync.js";
import { HuntPlanner } from "./domain/hunt.js";
import { applyFilters } from "./domain/filters.js";
import { isComplete } from "./domain/completion.js";
import { initTheme } from "./ui/theme.js";
import { createSidebar } from "./ui/sidebar.js";
import { createGrid } from "./ui/dex-grid.js";
import { createDetailPanel } from "./ui/detail-panel.js";
import { createQuest } from "./ui/quest.js";
import { createSaveControls } from "./ui/save.js";

const FILTER_KEYS = ["search", "type", "gen", "game", "sort", "status", "view"];

initTheme();
boot();

async function boot() {
  try {
    start(await loadDataset());
  } catch (error) {
    const box = document.getElementById("boot-error");
    box.hidden = false;
    box.textContent =
      `${error.message}. Les fichiers de data/ se chargent en fetch : ouvre le site via un serveur ` +
      "(python -m http.server) ou via GitHub Pages, pas en double-cliquant sur index.html.";
    console.error(error);
  }
}

function start(dataset) {
  const collection = new Collection(dataset.baseCollection);
  const sync = new GitHubSync(collection);
  const planner = new HuntPlanner(dataset);
  const store = createStore({
    tab: "dex",
    search: "",
    type: "all",
    gen: "all",
    game: "all",
    sort: "num",
    status: "all",
    view: "auto",
    selectedId: 25,
    ...loadQuestState(),
  });

  const ctx = {
    dataset,
    collection,
    sync,
    planner,
    store,
    onToggle: (id, slot) => {
      collection.toggle(id, slot);
      const species = dataset.byId.get(id);
      sync.schedule(species ? species.name : `n° ${id}`);
      onCollectionChange(id);
    },
    onCollectionChange: (id) => onCollectionChange(id),
    /**
     * Choisir une vignette. Retaper celle qui est deja selectionnee ne change
     * pas l'etat, donc n'aurait rien declenche : sur telephone, la feuille
     * refermee ne se rouvrait plus. On l'ouvre alors directement.
     */
    onSelect: (id) => {
      if (store.state.selectedId === id) detail.open();
      else store.set({ selectedId: id });
    },
    onSearchInput: debounce((event) => store.set({ search: event.target.value }), 160),
  };

  const sidebar = createSidebar(ctx);
  const grid = createGrid(ctx);
  const detail = createDetailPanel(ctx);
  const quest = createQuest(ctx);
  const save = createSaveControls(ctx);

  // Sur telephone, on quitte l'onglet plus souvent qu'on ne le ferme : c'est
  // le moment sur : on ecrit sans attendre la fin du delai de regroupement.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && collection.dirtyCount) {
      sync.flush("sortie de l'application").catch(() => {});
    }
  });

  const tabsRoot = document.getElementById("tabs");
  const panels = { dex: document.getElementById("tab-dex"), quest: document.getElementById("tab-quest") };

  if (!store.state.quest) store.set({ quest: planner.roll(collection) });

  /* ------------------------------- rendu ------------------------------- */

  /** « Tout obtenu » : dépend des jeux et des formes, donc du dataset. */
  const complete = (species) => isComplete(species, collection, dataset.games);

  function renderTabs() {
    const counts = collection.counts(dataset.species, complete);
    fill(
      tabsRoot,
      [
        ["dex", "Pokédex", `${counts.owned}/${counts.total}`],
        ["quest", "✦ Quêtes", String(store.state.questDone)],
      ].map(([value, label, badge]) =>
        el(
          "button.tab",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(store.state.tab === value),
            onclick: () => store.set({ tab: value }),
          },
          label,
          el("span.tab__badge", badge)
        )
      )
    );
    panels.dex.hidden = store.state.tab !== "dex";
    panels.quest.hidden = store.state.tab !== "quest";
  }

  function renderList() {
    grid.render(applyFilters(dataset.species, store.state, collection, complete));
  }

  function renderDetail(reveal = false) {
    const species = dataset.byId.get(store.state.selectedId) || dataset.species[0];
    detail.render(species, reveal);
  }

  function renderCounts() {
    sidebar.render(collection.counts(dataset.species, complete));
    save.render();
    renderTabs();
  }

  /** Une case a ete cochee : on rafraichit le strict necessaire. */
  function onCollectionChange(id) {
    renderCounts();
    if (id === undefined) {
      renderList();
    } else {
      grid.refresh(id);
      // Les filtres « capturés / manquants / shiny » peuvent exclure la carte.
      if (store.state.status !== "all") renderList();
    }
    renderDetail();
  }

  let previousSelected = store.state.selectedId;

  store.subscribe((state, changed) => {
    if (FILTER_KEYS.some((key) => changed.has(key))) renderList();

    if (changed.has("selectedId")) {
      grid.setSelected(state.selectedId, previousSelected);
      previousSelected = state.selectedId;
      renderDetail(true);
    }

    if (changed.has("tab")) renderTabs();
    if (changed.has("quest") || changed.has("questDone") || changed.has("questSkipped")) {
      quest.render();
      renderTabs();
    }
    if (["quest", "questDone", "questSkipped", "questLog"].some((key) => changed.has(key))) {
      saveQuestState(state);
    }
    if (changed.has("view")) renderDetail();
  });

  /* ---------------------------- premier rendu --------------------------- */

  renderCounts();
  renderList();
  renderDetail();
  quest.render();

  document.getElementById("boot").remove();
  document.getElementById("app").hidden = false;
}

/* ------------------------- persistance des quetes ------------------------ */

function loadQuestState() {
  const empty = { quest: null, questDone: 0, questSkipped: 0, questLog: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storage.quest) || "null");
    return saved ? { ...empty, ...saved } : empty;
  } catch {
    return empty;
  }
}

function saveQuestState(state) {
  try {
    localStorage.setItem(
      CONFIG.storage.quest,
      JSON.stringify({
        quest: state.quest,
        questDone: state.questDone,
        questSkipped: state.questSkipped,
        questLog: state.questLog,
      })
    );
  } catch {
    /* stockage indisponible : les quetes repartiront de zero */
  }
}
