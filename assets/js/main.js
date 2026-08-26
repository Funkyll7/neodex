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
import { progressOf } from "./domain/progress.js";
import { initTheme } from "./ui/theme.js";
import { createSidebar } from "./ui/sidebar.js";
import { createGrid } from "./ui/dex-grid.js";
import { createDetailPanel } from "./ui/detail-panel.js";
import { createQuest } from "./ui/quest.js";
import { createSaveControls } from "./ui/save.js";
import { createShortcuts } from "./ui/shortcuts.js";
import { createToTop } from "./ui/to-top.js";
import { createActiveFilters } from "./ui/active-filters.js";

const FILTER_KEYS = ["search", "type", "gen", "game", "form", "sort", "status", "view"];

migrateStorage();
initTheme();
boot();

/**
 * Reprend ce qui etait range sous les anciennes cles `neodex.*`.
 *
 * Le site a change de nom ; les cles du localStorage aussi. Sans cette reprise,
 * le renommage aurait jete d'un coup les cases cochees pas encore
 * synchronisees, l'avancement des quetes, le theme et le jeton GitHub — des
 * choses invisibles mais penibles a refaire.
 *
 * L'ancienne cle est conservee : si le renommage devait etre annule, rien
 * n'est perdu. C'est quelques kilo-octets.
 */
function migrateStorage() {
  try {
    for (const [nom, cible] of Object.entries(CONFIG.storage)) {
      const source = CONFIG.storageLegacy[nom];
      if (!source || localStorage.getItem(cible) !== null) continue;
      const valeur = localStorage.getItem(source);
      if (valeur !== null) localStorage.setItem(cible, valeur);
    }
  } catch {
    /* stockage bloque : on repart simplement de zero */
  }
}

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
  /** Liste filtree actuellement a l'ecran : c'est elle qui definit « suivant ». */
  let visible = [];
  const collection = new Collection(dataset.baseCollection, dataset);
  const sync = new GitHubSync(collection);
  const planner = new HuntPlanner(dataset);
  const store = createStore({
    tab: "dex",
    search: "",
    type: "all",
    gen: "all",
    game: "all",
    form: "all",
    sort: "num",
    status: "all",
    view: "auto",
    selectedId: 25,
    ...loadFilters(),
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
      toTop.refresh();
    },
    onSearchInput: debounce((event) => store.set({ search: event.target.value }), 160),
    /**
     * Voisins dans la liste filtree en cours. La fiche s'en sert pour ses
     * fleches ‹ › : remonter une boite de HOME, c'est aller de 1 a 2 a 3, pas
     * refermer la fiche et rechercher la vignette suivante a chaque fois.
     */
    neighbours: (id) => {
      const index = visible.findIndex((p) => p.id === id);
      if (index < 0) return { prev: null, next: null };
      return { prev: visible[index - 1] || null, next: visible[index + 1] || null };
    },
    /** Se deplacer de `delta` dans la liste filtree (fleches et clavier). */
    onStep: (delta) => {
      const index = visible.findIndex((p) => p.id === store.state.selectedId);
      if (index < 0) return;
      const target = visible[index + delta];
      if (target) store.set({ selectedId: target.id });
    },
  };

  const sidebar = createSidebar(ctx);
  const grid = createGrid(ctx);
  const detail = createDetailPanel(ctx);
  const quest = createQuest(ctx);
  const save = createSaveControls(ctx);
  createShortcuts(ctx);
  const toTop = createToTop();
  const activeFilters = createActiveFilters(ctx);
  createBarsFold();

  // Sur telephone, on quitte l'onglet plus souvent qu'on ne le ferme : c'est
  // le moment sur : on ecrit sans attendre la fin du delai de regroupement.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && collection.dirtyCount) {
      // `keepalive` : la page peut etre gelee ou tuee juste apres. Sans lui,
      // la requete part avec elle — or c'est justement le cas courant.
      sync.flush("sortie de l'application", true).catch(() => {});
    }
  });

  const tabsRoot = document.getElementById("tabs");
  const panels = { dex: document.getElementById("tab-dex"), quest: document.getElementById("tab-quest") };

  if (!store.state.quest) store.set({ quest: planner.roll(collection) });

  /* ------------------------------- rendu ------------------------------- */

  /** « Tout obtenu » : dépend des formes et du verrou chromatique. */
  const complete = (species) => isComplete(species, collection);

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
    visible = applyFilters(dataset.species, store.state, collection, complete);
    grid.render(visible);
  }

  function renderDetail(reveal = false) {
    const species = dataset.byId.get(store.state.selectedId) || dataset.species[0];
    detail.render(species, reveal);
  }

  function renderCounts() {
    sidebar.render(collection.counts(dataset.species, complete), progressOf(dataset.species, collection));
    save.render();
    renderTabs();
  }

  /**
   * Une case a ete cochee : on rafraichit le strict necessaire.
   * La fiche n'est surtout PAS reconstruite — on ne fait que retourner ses
   * `aria-pressed`. Sinon le bouton qu'on vient de toucher disparaitrait sous
   * le doigt, et l'evenement suivant retomberait sur son remplacant.
   */
  function onCollectionChange(id) {
    renderCounts();
    if (id === undefined) {
      renderList();
      renderDetail();
      return;
    }
    grid.refresh(id);
    // Les filtres « capturés / manquants / shiny » peuvent exclure la carte.
    if (store.state.status !== "all") renderList();
    detail.syncMarks(dataset.byId.get(id) || dataset.species[0]);
  }

  let previousSelected = store.state.selectedId;

  store.subscribe((state, changed) => {
    if (FILTER_KEYS.some((key) => changed.has(key))) {
      renderList();
      // Les barres cliquables et les pastilles doivent s'allumer tout de
      // suite. `sidebar.render()` refait les compteurs sur 1025 especes :
      // beaucoup trop cher pour un simple changement de filtre.
      sidebar.syncActive();
      activeFilters.render();
      saveFilters(state);
      // La liste a change : « suivant » ne designe plus la meme fiche.
      detail.refreshSteps(dataset.byId.get(state.selectedId) || dataset.species[0]);
    }

    if (changed.has("selectedId")) {
      grid.setSelected(state.selectedId, previousSelected);
      previousSelected = state.selectedId;
      renderDetail(true);
      saveFilters(state);
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
  activeFilters.render();
  renderDetail();
  quest.render();

  document.getElementById("boot").remove();
  document.getElementById("app").hidden = false;

  registerWorker();
}

/**
 * Cache hors ligne. Enregistre apres le premier rendu : il n'a aucune raison
 * de retarder l'affichage, et son absence ne doit rien empecher — un
 * `file://`, un navigateur ancien ou un contexte non securise le refusent, le
 * site marche pareil.
 *
 * `CONFIG.offline: false` fait le chemin inverse : desinscription et purge des
 * caches. C'est la manette d'arret a distance decrite dans config.js.
 */
function registerWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

  if (!CONFIG.offline) {
    navigator.serviceWorker
      .getRegistrations()
      .then((list) => Promise.all(list.map((reg) => reg.unregister())))
      .then(() => (window.caches ? caches.keys() : []))
      .then((noms) => Promise.all([...noms].map((nom) => caches.delete(nom))))
      .catch(() => {});
    return;
  }

  navigator.serviceWorker.register("sw.js").catch((error) => {
    console.warn("Funkylldex : cache hors ligne indisponible.", error);
  });
}

/**
 * Le repli du détail de progression, retenu d'une visite à l'autre.
 *
 * Fermé par défaut : ces dix barres repoussaient « Statut » à 666 px du haut,
 * hors de portée immédiate. Qui veut les consulter les ouvre une fois, et
 * elles restent ouvertes.
 */
function createBarsFold() {
  const fold = document.getElementById("bars-fold");
  if (!fold) return;
  try {
    fold.open = localStorage.getItem(CONFIG.storage.barsFold) === "1";
  } catch {
    /* stockage bloque : ferme par defaut */
  }
  fold.addEventListener("toggle", () => {
    try {
      localStorage.setItem(CONFIG.storage.barsFold, fold.open ? "1" : "0");
    } catch {
      /* rien a faire */
    }
  });
}

/* ---------------------- persistance des filtres -------------------------- */

/**
 * Les filtres survivent au rechargement.
 *
 * Sans cela, travailler « À terminer » filtré sur Gigamax et recharger la page
 * — ou revenir sur le site plus tard — repartait de zero. La recherche, elle,
 * n'est PAS gardee : c'est une intention du moment, la retrouver au retour
 * ferait croire a une liste vide.
 */
const FILTRES_GARDES = ["type", "gen", "game", "form", "sort", "status", "view"];
/** Le dernier Pokemon consulte : rouvrir le site le retrouve ouvert. */
const DERNIER = "selectedId";

function loadFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storage.filters) || "null");
    if (!saved) return {};
    const out = {};
    for (const key of FILTRES_GARDES) {
      if (typeof saved[key] === "string") out[key] = saved[key];
    }
    if (Number.isInteger(saved[DERNIER])) out[DERNIER] = saved[DERNIER];
    return out;
  } catch {
    return {};
  }
}

function saveFilters(state) {
  try {
    const out = {};
    for (const key of FILTRES_GARDES) out[key] = state[key];
    out[DERNIER] = state[DERNIER];
    localStorage.setItem(CONFIG.storage.filters, JSON.stringify(out));
  } catch {
    /* stockage indisponible : les filtres repartiront simplement a zero */
  }
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
