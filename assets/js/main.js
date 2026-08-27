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
import { isComplete, requiredSlots } from "./domain/completion.js";
import { progressOf, goProgressOf } from "./domain/progress.js";
import { initTheme } from "./ui/theme.js";
import { createSidebar } from "./ui/sidebar.js";
import { createGrid } from "./ui/dex-grid.js";
import { createGoDex } from "./ui/go-dex.js";
import { createDetailPanel } from "./ui/detail-panel.js";
import { createQuest } from "./ui/quest.js";
import { createSaveControls } from "./ui/save.js";
import { createShortcuts } from "./ui/shortcuts.js";
import { createToTop } from "./ui/to-top.js";
import { createActiveFilters } from "./ui/active-filters.js";
import { createUndo } from "./ui/undo.js";
import { createImportPhotos } from "./ui/import-photos.js";
import { tapCase, tapComplet, tapAnnule } from "./ui/haptics.js";

const FILTER_KEYS = ["search", "type", "gen", "game", "form", "sort", "status", "view"];
/** Les filtres du Pokedex GO, qui ne pilotent que sa grille a lui. */
const GO_KEYS = ["goSearch", "goGen", "goStatus", "goType"];

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
    goSearch: "",
    goGen: "all",
    goType: "all",
    goStatus: "all",
    ...loadFilters(),
    ...loadQuestState(),
  });

  const ctx = {
    dataset,
    collection,
    sync,
    planner,
    store,
    /**
     * Cocher une case, en gardant de quoi revenir en arriere.
     * L'etat d'avant est releve AVANT la bascule : c'est lui, et non l'inverse
     * de l'etat courant, que « Annuler » remettra en place.
     */
    onToggle: (id, slot) => {
      const avant = collection.has(id, slot);
      const species = dataset.byId.get(id);
      const etaitComplet = species ? complete(species) : false;
      collection.toggle(id, slot);
      sync.schedule(species ? species.name : `n° ${id}`);
      undo.record(
        `Case ${avant ? "décochée" : "cochée"} · ${species ? species.name : `n° ${id}`}` +
          ` — ${slotLabel(species, slot)}`,
        [{ id, slot, before: avant }]
      );
      // Deux impulsions quand le Pokemon vient de basculer sur « complet » :
      // c'est le seul evenement de la session qui merite d'etre remarque sans
      // regarder l'ecran.
      if (species && !etaitComplet && complete(species)) tapComplet();
      else tapCase();
      onCollectionChange(id);
    },

    /**
     * Remet un lot de cases dans l'etat qu'elles avaient. Appele par
     * `ui/undo.js`, et par lui seul.
     *
     * `toggle()` est une bascule : on ne la declenche que sur les cases qui ne
     * sont pas deja dans l'etat voulu. Sans ce test, annuler un lot dont une
     * case a ete recochee a la main la decocherait.
     */
    restoreMarks: (entries) => {
      const touches = new Set();
      for (const { id, slot, before } of entries) {
        if (collection.has(id, slot) !== before) collection.toggle(id, slot);
        touches.add(id);
      }
      sync.schedule("annulation depuis le site");
      tapAnnule();
      // Les deux Pokedex peuvent etre concernes, et l'entree ne dit pas lequel
      // est a l'ecran. Repeindre les deux coute deux vignettes ; se tromper
      // coute une case qui reste cochee sous les yeux apres l'annulation.
      if (touches.size === 1 && entries.length === 1) {
        onCollectionChange(entries[0].id);
        go.refresh(entries[0].id, entries[0].slot);
      } else {
        onCollectionChange();
        go.render();
      }
    },
    /**
     * Coche un LOT de cases d'un coup — la lecture de captures, aujourd'hui.
     *
     * Un seul pas d'annulation pour tout le lot : défaire une lecture de
     * trente cases ne doit pas demander trente appuis. Et comme partout, on
     * relève l'état d'avant plutôt que de supposer qu'il était vide.
     */
    applyBatch: (lot, titre) => {
      const entrees = [];
      for (const { id, slot } of lot) {
        const avant = collection.has(id, slot);
        if (avant) continue;
        collection.toggle(id, slot);
        entrees.push({ id, slot, before: avant });
      }
      if (!entrees.length) return 0;
      sync.schedule(titre);
      undo.record(titre, entrees);
      tapComplet();
      onCollectionChange();
      go.render();
      return entrees.length;
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
     * Une case du Pokedex GO. Chemin separe de `onToggle` : il n'y a ici ni
     * fiche a resynchroniser ni vignette HOME a repeindre, et surtout aucun
     * compteur HOME a refaire — cocher un GO ne change pas d'un point la
     * progression de l'autre Pokedex.
     */
    onGoToggle: (id, slot) => {
      const avant = collection.has(id, slot);
      collection.toggle(id, slot);
      const species = dataset.byId.get(id);
      const nom = species ? species.name : `n° ${id}`;
      sync.schedule(`${nom} (GO)`);
      undo.record(`Case ${avant ? "décochée" : "cochée"} · ${nom} — ${slotLabel(species, slot)}`, [
        { id, slot, before: avant },
      ]);
      tapCase();
      go.refresh(id, slot);
      // La colonne de gauche affiche la progression GO tant qu'on est sur cet
      // onglet : elle doit suivre chaque case, comme elle suit celles de HOME.
      renderCounts();
    },
    onGoSearchInput: debounce((event) => store.set({ goSearch: event.target.value }), 160),
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
  const go = createGoDex(ctx);
  const detail = createDetailPanel(ctx);
  const quest = createQuest(ctx);
  const save = createSaveControls(ctx);
  createShortcuts(ctx);
  const toTop = createToTop();
  const activeFilters = createActiveFilters(ctx);
  const undo = createUndo(ctx);
  const photos = createImportPhotos(ctx);
  for (const bouton of document.querySelectorAll("[data-import]")) {
    bouton.addEventListener("click", () => photos.ouvrir(bouton.dataset.import));
  }
  createFolds();

  // Sur telephone, on quitte l'onglet plus souvent qu'on ne le ferme : c'est
  // le moment sur : on ecrit sans attendre la fin du delai de regroupement.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && collection.dirtyCount) {
      // `keepalive` : la page peut etre gelee ou tuee juste apres. Sans lui,
      // la requete part avec elle — or c'est justement le cas courant.
      sync.flush("sortie de l'application", true).catch(() => {});
      return;
    }

    // Au retour, on va voir ce qui a ete coche ailleurs. Un onglet laisse
    // ouvert sur l'ordinateur ignorait sinon tout du telephone jusqu'a son
    // prochain rechargement, et affichait a tort des cases comme manquantes.
    if (document.visibilityState === "visible") {
      sync
        .relire()
        .then((change) => {
          if (!change) return;
          renderCounts();
          renderList();
        })
        // Hors ligne, ou jeton absent : on garde ce qu'on affiche. Ce n'est
        // pas une erreur a montrer, juste une occasion manquee.
        .catch(() => {});
    }
  });

  const tabsRoot = document.getElementById("tabs");
  const panels = {
    dex: document.getElementById("tab-dex"),
    go: document.getElementById("tab-go"),
    quest: document.getElementById("tab-quest"),
  };

  if (!store.state.quest) store.set({ quest: planner.roll(collection) });

  /* ------------------------------- rendu ------------------------------- */

  /** « Tout obtenu » : dépend des formes et du verrou chromatique. */
  const complete = (species) => isComplete(species, collection);

  /**
   * Cette espece a-t-elle encore sa place dans la liste affichee ?
   *
   * On repasse par `applyFilters` avec une liste d'un seul element plutot que
   * de reecrire la regle ici : le jour ou un filtre change, les deux chemins ne
   * pourront pas diverger.
   */
  const stillVisible = (species) =>
    applyFilters([species], store.state, collection, complete).length > 0;

  /**
   * Les trois onglets.
   *
   * Deux Pokedex distincts, donc deux noms explicites : « Pokédex » tout court
   * ne disait plus lequel. Le logo officiel fait le reste du travail — sur
   * telephone il reste seul avec le nom court, le nom long ne tiendrait pas.
   *
   * `long` et `court` sont deux nœuds, pas un texte tronque en CSS : couper
   * « Pokédex Pokémon HOME » avec des points de suspension aurait donne
   * « Pokédex Poké… » sur les deux onglets, c'est-a-dire deux libelles
   * identiques.
   */
  function renderTabs() {
    const counts = collection.counts(dataset.species, complete);
    const goCounts = goProgressOf(dataset.goEntries, collection);
    fill(
      tabsRoot,
      [
        ["dex", "assets/img/logo-home.png", "Pokédex Pokémon HOME", "HOME", `${counts.owned}/${counts.total}`],
        ["go", "assets/img/logo-go.png", "Pokédex Pokémon GO", "GO", `${goCounts.owned}/${goCounts.total}`],
        // Une pastille en couleur comme ses deux voisines, et non un symbole
        // monochrome : le ✦ qu'elle remplace faisait tache a cote de deux
        // logotypes en couleur.
        ["quest", "assets/img/logo-quete.png", "Quêtes", "Quêtes", String(store.state.questDone)],
      ].map(([value, logo, long, court, badge]) =>
        el(
          "button.tab",
          {
            type: "button",
            role: "tab",
            title: long,
            "aria-label": long,
            "aria-selected": String(store.state.tab === value),
            onclick: () => store.set({ tab: value }),
          },
          logo ? el("img.tab__logo", { src: logo, alt: "", height: 22, loading: "lazy" }) : null,
          el("span.tab__long", long),
          el("span.tab__court", court),
          el("span.tab__badge", badge)
        )
      )
    );
    for (const [nom, panneau] of Object.entries(panels)) panneau.hidden = store.state.tab !== nom;
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
    sidebar.render(
      collection.counts(dataset.species, complete),
      progressOf(dataset.species, collection),
      goProgressOf(dataset.goEntries, collection)
    );
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
      // Un import ou une reinitialisation touche aussi les cases GO : la grille
      // de l'autre onglet n'est plus a jour, meme si on ne la regarde pas.
      go.render();
      return;
    }
    grid.refresh(id);
    // Les filtres « capturés / manquants / complets » peuvent exclure la carte.
    // On la BARRE au lieu de reconstruire la liste : voir `grid.setStale()`.
    // Seul `status` depend de la collection ; les autres filtres ne peuvent
    // pas changer d'avis parce qu'une case a bascule.
    if (store.state.status !== "all") {
      const species = dataset.byId.get(id);
      if (species) grid.setStale(id, !stillVisible(species));
    }
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

    // L'onglet ouvert est retenu d'une visite a l'autre : on revient sur le
    // site pour continuer ce qu'on faisait, pas pour rechoisir son Pokedex.
    if (changed.has("tab") || GO_KEYS.some((key) => changed.has(key))) saveFilters(state);

    if (GO_KEYS.some((key) => changed.has(key))) go.render();

    if (changed.has("tab")) {
      renderTabs();
      // La colonne de gauche appartient a l'onglet ouvert : progression,
      // statut et filtres basculent avec lui. C'est `render()` qu'il faut,
      // pas `syncActive()` — ce ne sont pas les memes pastilles ni les memes
      // barres, il faut les reconstruire.
      renderCounts();
      // Et on rederive la liste et ses pastilles depuis l'etat, au lieu de
      // faire confiance a ce qui etait affiche avant la bascule. Un aller-
      // retour entre les onglets laissait, dans un cas rapporte, la pastille
      // « Manquants » allumee au-dessus d'une liste qui ne l'etait pas. Deux
      // millisecondes de filtrage valent mieux qu'un rappel de filtre qui ment
      // sur ce qu'on a sous les yeux.
      renderList();
      activeFilters.render();
      // La grille GO ne peut pas se mesurer tant que son panneau est `hidden` :
      // elle n'aurait charge qu'un seul palier, et le defilement infini
      // n'aurait jamais demarre.
      if (state.tab === "go") go.reveal();
    }
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
  go.render();
  if (store.state.tab === "go") go.reveal();

  document.getElementById("boot").remove();
  document.getElementById("app").hidden = false;

  registerWorker();

  // Le site vient d'etre ouvert par le menu « Partager » d'Android : les
  // captures attendent dans un cache, le lecteur les reprend tout de suite.
  // Apres le premier rendu, pour ne pas retarder l'affichage — et sans faire
  // de bruit si ce n'etait pas un partage.
  if (new URLSearchParams(location.search).has("partage")) {
    photos.reprendrePartage().catch((error) => {
      console.warn("Funkylldex : captures partagees illisibles.", error);
    });
    // L'adresse est nettoyee : recharger la page ne doit pas relancer une
    // lecture dont les fichiers ont deja ete consommes.
    history.replaceState(null, "", location.pathname);
  }
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

/** Les cases du Pokedex GO, que `requiredSlots()` ne connait pas : elles
    n'entrent pas dans la progression HOME, donc il ne les nomme jamais. */
const GO_LABELS = { gn: "GO — attrapé", gs: "GO — chromatique" };

/**
 * Le nom lisible d'une case — « Normal ♀ », « Miaouss d'Alola shiny ».
 *
 * On relit `requiredSlots()` plutot que d'inventer une table de libelles :
 * c'est deja lui qui nomme les cases dans le « tout obtenu », et deux
 * vocabulaires pour la meme case seraient un piege a maintenance.
 */
function slotLabel(species, slot) {
  if (GO_LABELS[slot]) return GO_LABELS[slot];
  if (!species) return slot;
  // Une forme regionale dans GO : `gf10091` / `gf10091s`. Son nom vient de la
  // forme elle-meme, `requiredSlots()` ne parle que des cases HOME.
  const go = /^gf(\d+)(s?)$/.exec(slot);
  if (go) {
    const forme = species.forms.find((f) => String(f.id) === go[1]);
    const nom = forme ? forme.name : `forme ${go[1]}`;
    return `GO — ${nom}${go[2] ? " chromatique" : ""}`;
  }
  const entree = requiredSlots(species).find((e) => e.slot === slot);
  return entree ? entree.label : slot;
}

/**
 * Les replis de la barre latérale, retenus d'une visite à l'autre.
 *
 * Fermés par défaut, et pour la même raison dans les deux cas : dépliés, ils
 * repoussaient les commandes utiles à plus d'un écran du haut de la colonne —
 * les dix barres de progression d'un côté, les six boutons de sauvegarde de
 * l'autre. Qui s'en sert les ouvre une fois, et ils restent ouverts.
 */
function createFolds() {
  for (const [id, cle] of [
    ["bars-fold", CONFIG.storage.barsFold],
    ["save-fold", CONFIG.storage.saveFold],
  ]) {
    const fold = document.getElementById(id);
    if (!fold) continue;
    try {
      fold.open = localStorage.getItem(cle) === "1";
    } catch {
      /* stockage bloque : ferme par defaut */
    }
    fold.addEventListener("toggle", () => {
      try {
        localStorage.setItem(cle, fold.open ? "1" : "0");
      } catch {
        /* rien a faire */
      }
    });
  }
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
const FILTRES_GARDES = ["type", "gen", "game", "form", "sort", "status", "view", "goGen", "goType", "goStatus", "tab"];
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
