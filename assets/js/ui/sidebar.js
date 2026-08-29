/**
 * sidebar.js — progression, filtres, tri.
 * Les selects sont remplis a partir des donnees : ajouter un jeu dans
 * data/reference/games.json le fait apparaitre ici sans toucher au code.
 */

import { el, fill, setOptions } from "../core/dom.js";
import { STATUS_FILTERS, FORM_FILTERS, GO_FILTERS } from "../domain/filters.js";
// Les libelles vivent dans des tableaux de module, evalues UNE fois a
// l'import : les traduire la aurait fige la langue du premier chargement. On
// les traduit donc a l'affichage, ou la langue courante est connue.
import { t, nomType } from "../core/i18n.js";

export function createSidebar(ctx) {
  const { dataset, store } = ctx;

  /** L'onglet ouvert : la colonne entiere en depend. */
  const surGo = () => store.state.tab === "go";

  const pills = document.getElementById("status-pills");
  const genSelect = document.getElementById("filter-gen");
  const formSelect = document.getElementById("filter-form");
  const gameSelect = document.getElementById("filter-game");
  const sortSelect = document.getElementById("filter-sort");
  const typeSelect = document.getElementById("filter-type");
  const searchInput = document.getElementById("search");
  const viewToggle = document.getElementById("view-toggle");
  /* --------------------------- remplissage --------------------------- */

  /**
   * Remplit les listes deroulantes.
   *
   * Appelee a chaque rendu et non une seule fois a la creation : leurs libelles
   * changent avec la langue, et remplies une fois pour toutes elles restaient
   * dans celle du premier chargement. `setOptions` restaure la valeur
   * selectionnee, ce chemin est donc sans effet de bord.
   */
  function remplirLesListes() {

  // La region parle plus que le chiffre romain : on retient « Hoenn » bien
  // avant « Génération III ».
  //
  // Le libelle et la region passent par `t()` separement, et non la phrase
  // assemblee : « Génération V — Unys » n'existe nulle part comme chaine, ses
  // deux morceaux si.
  setOptions(
    genSelect,
    [
      { value: "all", label: t("Toutes générations") },
      ...Object.entries(dataset.generations).map(([value, g]) => ({
        value,
        label: g.region ? `${t(g.label)} — ${t(g.region)}` : t(g.label),
      })),
    ],
    store.state.gen
  );

  // Vingt-trois jeux a plat se lisent mal : on les regroupe par generation,
  // c'est l'ordre dans lequel on les a en tete.
  const parGeneration = new Map();
  for (const jeu of dataset.games) {
    const gen = dataset.generations[jeu.gen] || {};
    const titre = gen.region
      ? `${t(gen.label)} — ${t(gen.region)}`
      : `${t("Génération")} ${jeu.gen}`;
    if (!parGeneration.has(titre)) parGeneration.set(titre, []);
    parGeneration.get(titre).push({ value: jeu.code, label: t(jeu.name) });
  }
  setOptions(
    gameSelect,
    [{ value: "all", label: t("N'importe quel jeu") }],
    store.state.game,
    [...parGeneration].map(([label, options]) => ({ label, options }))
  );

  setOptions(
    formSelect,
    FORM_FILTERS.map((f) => ({ value: f.value, label: t(f.label) })),
    store.state.form
  );

  setOptions(
    typeSelect,
    [
      { value: "all", label: t("Tous les types") },
      // `type` et non `t` : le nom du parametre aurait masque la fonction de
      // traduction dans toute la lambda.
      ...Object.keys(dataset.types).map((type) => ({ value: type, label: nomType(type) })),
    ],
    store.state.type
  );

  }

  remplirLesListes();

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
        title: t(title),
        "aria-pressed": String(store.state.view === value),
        dataset: { view: value },
        onclick: () => store.set({ view: value }),
        textContent: t(label),
      })
    )
  );

  /* ----------------------------- ecouteurs ---------------------------- */

  // Un seul select de generation pour deux Pokedex, et c'est voulu : deux
  // controles identiques a la meme place, dont un seul compte selon l'onglet,
  // seraient plus deroutants que ce partage. Il ecrit dans la cle de l'onglet
  // ouvert, et `render()` le remet a la bonne valeur quand on bascule.
  genSelect.addEventListener("change", () =>
    store.set(surGo() ? { goGen: genSelect.value } : { gen: genSelect.value })
  );
  formSelect.addEventListener("change", () => store.set({ form: formSelect.value }));
  gameSelect.addEventListener("change", () => store.set({ game: gameSelect.value }));
  sortSelect.addEventListener("change", () => store.set({ sort: sortSelect.value }));
  typeSelect.addEventListener("change", () => store.set({ type: typeSelect.value }));
  searchInput.addEventListener("input", ctx.onSearchInput);

  createTiroir();

  /* ------------------------------- rendu ------------------------------ */

  const out = {
    pct: document.getElementById("stat-pct"),
    owned: document.getElementById("stat-owned"),
    total: document.getElementById("stat-total"),
    bar: document.getElementById("progress-bar"),
    fill: document.getElementById("progress-fill"),
    bars: document.getElementById("progress-bars"),
    titre: document.getElementById("progress-title"),
    resume: document.getElementById("bars-summary"),
    legende: document.getElementById("legend-panel"),
    champs: {
      gen: document.getElementById("field-gen"),
      form: document.getElementById("field-form"),
      game: document.getElementById("field-game"),
      sort: document.getElementById("field-sort"),
    },
  };

  /**
   * La colonne bascule avec l'onglet.
   *
   * Trois des quatre listes deroulantes n'ont aucun sens dans le Pokedex GO :
   * il n'y a ni forme, ni jeu d'origine, et un livingdex se range toujours par
   * numero. La legende, elle, decrit le tableau de disponibilite de la fiche
   * HOME. Les laisser en place, mortes, aurait fait croire a des filtres qui
   * ne repondent pas.
   */
  function poserContexte() {
    // Les listes d'abord : leurs libelles suivent la langue.
    remplirLesListes();

    const go = surGo();
    out.champs.form.hidden = go;
    out.champs.game.hidden = go;
    out.champs.sort.hidden = go;
    out.legende.hidden = go;
    out.titre.textContent = go ? "Progression Pokémon GO" : "Progression totale";
    out.resume.textContent = go ? "Détail" : "Détail par forme";
  }

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
    genSelect.value = surGo() ? store.state.goGen : store.state.gen;
    formSelect.value = store.state.form;
    gameSelect.value = store.state.game;
    sortSelect.value = store.state.sort;
    typeSelect.value = store.state.type;

    const cleStatut = surGo() ? "goStatus" : "status";
    for (const pill of pills.children) {
      pill.setAttribute("aria-pressed", String(pill.dataset.value === store.state[cleStatut]));
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
    render(counts, progress, go) {
      poserContexte();

      // Le grand chiffre compte les CASES, pas les especes : c'est la vraie
      // progression du site. Le decompte d'especes descend dans « Ma
      // collection », sous son propre nom. Sur l'onglet GO, ce sont les 2050
      // cases de GO — les deux ne se melangent jamais.
      const total = surGo()
        ? { done: go.done, total: go.cases, pct: go.pct }
        : (progress && progress.all) || { done: 0, total: 0, pct: 0 };
      out.pct.textContent = total.pct;
      out.owned.textContent = total.done;
      out.total.textContent = total.total;
      out.fill.style.width = `${total.pct}%`;
      out.bar.setAttribute("aria-valuenow", total.pct);

      if (surGo()) renderGoBars(out, go, store);
      else if (progress) renderBars(out, progress, counts, store);

      const filtres = surGo() ? GO_FILTERS : STATUS_FILTERS;
      const cleStatut = surGo() ? "goStatus" : "status";
      const decompte = surGo()
        ? {
            all: go.total,
            missing: go.total - go.owned,
            noshiny: go.shinyTotal - go.shiny,
            absent: go.listees - go.total,
          }
        : counts;

      fill(
        pills,
        filtres.map((filter) =>
          el(
            "button.pill",
            {
              type: "button",
              "aria-pressed": String(store.state[cleStatut] === filter.value),
              dataset: { value: filter.value },
              onclick: () => store.set({ [cleStatut]: filter.value }),
            },
            // « Statut » ne porte plus ni le filtre chromatique ni celui des
            // paires : ils sont devenus des barres de progression cliquables.
            // Ces pastilles n'ont donc plus de logo, seulement un libellé.
            el("span.pill__name", t(filter.label)),
            el("span.pill__count", decompte[filter.key || filter.value])
          )
        )
      );

      for (const button of viewToggle.children) {
        button.setAttribute("aria-pressed", String(button.dataset.view === store.state.view));
      }
      genSelect.value = surGo() ? store.state.goGen : store.state.gen;
      formSelect.value = store.state.form;
      gameSelect.value = store.state.game;
      sortSelect.value = store.state.sort;
      typeSelect.value = store.state.type;
    },
  };
}

/* ------------------------ tiroir de filtres, mobile ---------------------- */

/**
 * Sur telephone, la barre laterale devient un tiroir POSE PAR-DESSUS la page.
 *
 * Avant, elle restait un bloc normal, tout en haut du document : appuyer sur
 * « Filtres » depuis le milieu du Pokedex ne montrait rien du tout — il fallait
 * remonter plusieurs milliers de pixels pour tomber dessus. Le bouton avait
 * l'air cassé alors qu'il faisait exactement ce qu'on lui demandait.
 *
 * Elle se ferme donc comme la fiche : par la croix, par le fond assombri, par
 * Echap. Meme grammaire, meme geste, et pour la meme raison — un panneau qui
 * couvre l'ecran doit se refermer sans qu'on ait a chercher comment.
 */
function createTiroir() {
  const bouton = document.getElementById("nav-toggle");
  const croix = document.getElementById("nav-close");
  const fond = document.getElementById("nav-backdrop");
  const barre = document.getElementById("sidebar");
  const mobile = window.matchMedia("(max-width: 860px)");

  /** Ou l'on etait dans la grille avant l'ouverture. */
  let defilement = 0;
  const ouvert = () => bouton.getAttribute("aria-expanded") === "true";

  function sync() {
    const petit = mobile.matches;
    const ouvre = petit && ouvert();
    barre.hidden = petit && !ouvre;
    fond.hidden = !ouvre;
    croix.hidden = !petit;
    document.body.classList.toggle("nav-open", ouvre);
  }

  function poser(etat) {
    if (etat === ouvert()) return;
    // Bloquer le defilement du corps peut faire remonter la page : on note ou
    // l'on etait pour y revenir a la fermeture, comme le fait la fiche.
    if (etat) defilement = window.scrollY;
    bouton.setAttribute("aria-expanded", String(etat));
    sync();
    if (etat) barre.scrollTop = 0;
    else window.scrollTo({ top: defilement, behavior: "auto" });
  }

  bouton.addEventListener("click", () => poser(!ouvert()));
  croix.addEventListener("click", () => {
    poser(false);
    bouton.focus();
  });
  fond.addEventListener("click", () => poser(false));

  /*
   * Choisir un statut referme le tiroir.
   *
   * Sur telephone il couvre toute la grille : le laisser ouvert cache
   * exactement ce qu'on vient de demander a voir. On appuyait sur « Manquants »,
   * le filtre s'appliquait pour de bon — mais derriere le panneau, si bien que
   * rien ne semblait se passer.
   *
   * Seulement sur les PASTILLES de statut, et pas sur les listes deroulantes :
   * la pastille est le geste « j'ai choisi, montre-moi », tandis qu'on combine
   * volontiers une generation et une forme avant de regarder. Le panneau des
   * themes et la synchronisation logent dans le meme tiroir et n'ont aucune
   * raison de le faire disparaitre sous les doigts.
   *
   * Les pastilles sont reconstruites a chaque rendu : c'est leur conteneur qui
   * ecoute, pas elles.
   */
  document.getElementById("status-pills")?.addEventListener("click", (event) => {
    if (event.target.closest(".pill") && mobile.matches && ouvert()) poser(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ouvert() && mobile.matches) {
      poser(false);
      bouton.focus();
    }
  });
  // Passage en grand ecran alors que le tiroir etait ouvert : la barre reprend
  // sa place dans la colonne, il ne doit plus rien rester du panneau.
  mobile.addEventListener("change", sync);
  sync();
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

/**
 * Les deux barres du Pokedex GO.
 *
 * Deux, et pas dix : GO n'a ni region, ni Gigamax, ni paire ♂ / ♀. Chacune
 * pointe vers ce qu'il RESTE a faire — cliquer « Attrapés » n'affiche pas les
 * attrapés, il affiche ceux qui manquent. C'est la question qu'on se pose en
 * lisant la barre, et c'est celle a laquelle le clic doit repondre.
 */
function renderGoBars(out, go, store) {
  const lignes = [
    ["missing", "Attrapés", null, go.owned, go.total, "Ceux qu'il reste à attraper."],
    ["noshiny", "Chromatiques", "shiny", go.shiny, go.shinyTotal, "Ceux dont le chromatique manque. GO n'en a pas sorti pour tout le monde : le total ne compte que ceux qui en ont un."],
  ];

  fill(
    out.bars,
    el(
      "section.bars__group",
      el("h2.panel__label", t("Ma collection GO")),
      lignes.map(([cible, label, icon, done, total, title]) => {
        const pct = total ? Math.round((done / total) * 100) : 0;
        const actif = store.state.goStatus === cible;
        return el(
          "button.bars__row",
          {
            type: "button",
            title: `${t(title)}\n${actif ? t("Cliquer pour retirer le filtre.") : t("Cliquer pour n'afficher que ceux-là.")}`,
            "aria-pressed": String(actif),
            dataset: { filtre: "goStatus", cible },
            onclick: () => store.set({ goStatus: store.state.goStatus === cible ? "all" : cible }),
          },
          el(
            "span.bars__head",
            icon === "shiny"
              ? el("span.toggle__ico.toggle__ico--shiny.bars__icon", { "aria-hidden": "true" })
              : el("span.toggle__ico.toggle__ico--capture.bars__icon", { "aria-hidden": "true" }),
            el("span.bars__label", t(label)),
            el("span.bars__pct", `${pct} %`)
          ),
          el(
            "span.bars__meter",
            el(
              "span.bar",
              {
                role: "progressbar",
                "aria-label": t(label),
                "aria-valuemin": "0",
                "aria-valuemax": "100",
                "aria-valuenow": String(pct),
              },
              el("span.bar__fill", { style: { width: `${pct}%` } })
            ),
            el("span.bars__value", `${done} / ${total}`)
          )
        );
      })
    )
  );
}

function renderBars(out, progress, counts, store) {
  // « Progression Pokédex » ne vient pas de `progress` : c'est le seul
  // compteur d'ESPECES de la liste, il vit dans `collection.counts()`.
  const especes = { done: counts.owned, total: counts.total, pct: counts.pct };

  fill(
    out.bars,
    BAR_GROUPS.map((group) =>
      el(
        "section.bars__group",
        el("h2.panel__label", t(group.title)),
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
              title: `${t(title)}\n${actif ? t("Cliquer pour retirer le filtre.") : t("Cliquer pour n'afficher que ceux-là.")}`,
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
              el("span.bars__label", t(label)),
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
                  "aria-label": t(label),
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

