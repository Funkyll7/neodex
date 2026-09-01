/**
 * go-dex.js — le livingdex Pokémon GO.
 *
 * Un Pokédex volontairement plus simple que l'autre. On y range des BOÎTES :
 * les 1025 espèces, plus les 161 formes que le jeu propose — dans GO, un
 * Miaouss d'Alola occupe une boîte à lui, exactement comme celui de Kanto, et
 * une Prismillon Motif Savane aussi. Deux cases par boîte, attrapé et
 * chromatique, et rien de plus : pas de case ♂ / ♀, pas de Méga, pas de
 * Gigamax. Recopier la vignette du Pokédex HOME aurait affiché six cases dont
 * quatre n'existent pas dans le jeu.
 *
 * Ce que GO range et ce que HOME range ne se recouvrent pas : les
 * transformations de combat et les costumes événementiels ne sont des boîtes ni
 * ici ni là, et c'est data/reference/go.json qui tranche, forme par forme.
 *
 * Les deux collections ne se mélangent jamais : les cases GO s'appellent `gn`
 * et `gs` pour une espèce, `gf<id>` pour une forme, `gc<id>-<clef>` pour une
 * variante cosmétique. `completion.js` ne les regarde pas, et le pourcentage
 * HOME ne bouge pas d'un point quand on coche ici.
 *
 * Mêmes deux principes que dex-grid.js, et pour les mêmes raisons :
 *   - un seul écouteur, délégué sur la grille, jamais détruit ;
 *   - cocher une case *repeint* la vignette au lieu de la remplacer, sinon le
 *     bouton disparaît sous le doigt et l'événement suivant retombe sur son
 *     remplaçant.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { spriteImg, formImg, cosmeticImg } from "../domain/sprites.js";
import { applyGoFilters } from "../domain/filters.js";
import { goProgressOf } from "../domain/progress.js";
import { dexNumber, typeInk } from "./common.js";
import { renderLivingDex } from "./livingdex.js";
import { nomEntreeGo, nomType, t, tn } from "../core/i18n.js";

export function createGoDex(ctx) {
  const { store, collection, dataset } = ctx;
  const grid = document.getElementById("go-grid");
  const boites = document.getElementById("go-livingdex");
  const empty = document.getElementById("go-empty");
  const sentinel = document.getElementById("go-sentinel");
  const counter = document.getElementById("go-count");
  const search = document.getElementById("go-search");
  const typeSelect = document.getElementById("go-type");

  const out = {
    owned: document.getElementById("go-owned"),
    ownedTotal: document.getElementById("go-owned-total"),
    shiny: document.getElementById("go-shiny"),
    shinyTotal: document.getElementById("go-shiny-total"),
    pct: document.getElementById("go-pct"),
    bar: document.getElementById("go-bar"),
    fill: document.getElementById("go-fill"),
  };

  let list = [];
  let shown = 0;

  /* ------------------------------ commandes ---------------------------- */

  fill(
    typeSelect,
    el("option", { value: "all" }, t("Tous les types")),
    // `type` et non `t` : le nom du parametre aurait masque la fonction de
    // traduction dans toute la lambda. La VALEUR reste le type francais — c'est
    // la clef qui voyage jusqu'a `store.state.goType` —, seul le libelle change.
    Object.keys(dataset.types).map((type) => el("option", { value: type }, nomType(type)))
  );
  typeSelect.value = store.state.goType;
  typeSelect.addEventListener("change", () => store.set({ goType: typeSelect.value }));

  search.addEventListener("input", ctx.onGoSearchInput);

  /* ------------------------------ défilement --------------------------- */

  function appendPage() {
    const next = list.slice(shown, shown + CONFIG.pageSize);
    grid.append(...next.map((entry) => carte(entry, ctx)));
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
    const progress = goProgressOf(dataset.goEntries, collection);
    out.owned.textContent = progress.owned;
    out.ownedTotal.textContent = progress.total;
    out.shiny.textContent = progress.shiny;
    out.shinyTotal.textContent = progress.shinyTotal;
    out.pct.textContent = progress.pct;
    out.fill.style.width = `${progress.pct}%`;
    out.bar.setAttribute("aria-valuenow", progress.pct);
    return progress;
  }

  // Un objet nomme plutot qu un litteral rendu directement : `refresh` doit
  // pouvoir rappeler `render`, et passer par `this` aurait lie le module a la
  // facon dont l appelant l invoque.
  const api = {
    /** Rendu complet : la liste filtrée a changé. */
    render() {
      renderStats();
      if (typeSelect.value !== store.state.goType) typeSelect.value = store.state.goType;

      // GRILLE OU BOÎTES, JAMAIS LES DEUX — même règle que dans le Pokédex
      // HOME, et pour la même raison : les deux dispositions montrent le même
      // Pokédex, et les afficher ensemble aurait doublé un millier de sprites
      // pour rien.
      const mode = store.state.goMode || "grille";
      const enBoites = mode !== "grille";
      grid.hidden = enBoites;
      if (boites) boites.hidden = !enBoites;

      if (enBoites) {
        // L'état vide et le compteur parlent de la GRILLE — d'un filtre qui ne
        // laisse rien passer. Les boîtes ignorant les filtres, les laisser
        // affichés aurait annoncé « 0 résultat » au-dessus de mille cases.
        empty.hidden = true;
        counter.textContent = "";
        // LES BOÎTES IGNORENT LES FILTRES. Elles existent pour montrer les
        // trous À LEUR PLACE ; en retirer les trois quarts parce qu'un filtre
        // de type est actif aurait détruit le seul intérêt de la vue.
        renderLivingDex(boites, {
          dex: "go",
          entrees: dataset.goEntries,
          chaines: dataset.chaines,
          collection,
          ordre: mode === "familles" ? "famille" : "numero",
          // Le clic COCHE, et il passe par le même chemin que les boutons de la
          // grille : de quoi annuler, la note, la synchronisation.
          surChoix: (id, slot) => ctx.onGoToggle(id, slot),
        });
        return;
      }

      list = applyGoFilters(dataset.goEntries, store.state, collection);
      shown = 0;
      grid.replaceChildren();
      empty.hidden = list.length > 0;
      counter.textContent = `${list.length} ${tn(list.length, "résultat", "résultats")}`;
      appendPage();
      rearmer();
    },

    /**
     * Une case vient d'être cochée : on repeint la vignette et les chiffres.
     *
     * Une espèce peut avoir plusieurs boîtes à l'écran — la sienne et ses
     * formes régionales — et cocher l'une ne touche pas les autres. On repeint
     * donc la boîte visée, pas toutes celles qui portent ce numéro.
     */
    refresh(id, slot) {
      renderStats();
      // En boîtes, la vignette repeinte n'existe pas : c'est une case, et elle
      // vit dans un arbre que `renderLivingDex` reconstruit d'un bloc. Même
      // chemin que le Pokédex HOME, qui refait ses boîtes de la même façon.
      if ((store.state.goMode || "grille") !== "grille") {
        api.render();
        return;
      }
      const entry = list.find((e) => e.id === id && (e.slot === slot || e.shinySlot === slot));
      if (!entry) return;
      const node = grid.querySelector(`[data-key="${entry.key}"]`);
      if (!node) return;
      peindre(node, entry, ctx);
      // La vignette ne correspond plus au filtre en cours : on la BARRE au lieu
      // de reconstruire un millier de vignettes sous le doigt. Reconstruire
      // décalait la liste d'un cran et remettait le défilement au premier
      // palier — chaque Pokémon attrapé coûtait une remontée de liste entière.
      if (store.state.goStatus !== "all") {
        const encore = applyGoFilters([entry], store.state, collection).length > 0;
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

  return api;
}

/* -------------------------------- vignette ------------------------------- */

function carte(entry, ctx) {
  const species = entry.species;
  const color = ctx.dataset.types[species.types[0]] || "#8b8b8b";
  const node = el(
    "div.gcard",
    {
      "--type": color,
      "--type-ink": typeInk(color),
      dataset: { key: entry.key, id: entry.id, slot: entry.slot },
      role: "listitem",
    },
    el(
      "span.gcard__num",
      dexNumber(entry.id),
      // La famille de la forme, en toutes lettres. Deux boîtes portent le même
      // numéro : sans elle, le Miaouss d'Alola et celui de Kanto ne se
      // distinguaient que par leur sprite, à 56 px.
      entry.kind
        ? el("span.gcard__kind", KIND_COURT[entry.kind] ? t(KIND_COURT[entry.kind]) : entry.kind)
        : null
    ),
    el("span.gcard__art"),
    el("span.gcard__name", { title: nomEntreeGo(entry) }, nomEntreeGo(entry)),
    el(
      "div.gcard__toggles",
      // Pas encore dans Pokémon GO : rien ne se coche. La vignette reste dans
      // la grille — savoir qu'un Pokémon manque au jeu fait partie de ce qu'on
      // vient chercher ici — mais ses deux cases deviennent muettes, et elle
      // ne compte dans aucun total.
      !entry.released
        ? el(
            "span.gcard__absent",
            { title: t("Pas encore obtenable dans Pokémon GO") },
            t("Pas dans GO")
          )
        : el(
            "button.gcard__btn",
            {
              type: "button",
              dataset: { goSlot: entry.slot, species: entry.id },
              title: `${nomEntreeGo(entry)} — ${t("attrapé dans Pokémon GO")}`,
              "aria-label": `${nomEntreeGo(entry)} — ${t("attrapé dans Pokémon GO")}`,
            },
            el("span.toggle__ico.toggle__ico--capture", { "aria-hidden": "true" })
          ),
      // Pas de bouton chromatique quand GO n'en a jamais sorti : une case qu'on
      // ne peut pas cocher n'a rien à faire sous le doigt. Un rappel muet prend
      // sa place, pour que la vignette garde sa silhouette dans la grille.
      !entry.released
        ? null
        : entry.shiny
          ? el(
              "button.gcard__btn.gcard__btn--gold",
              {
                type: "button",
                dataset: { goSlot: entry.shinySlot, species: entry.id },
                title: `${nomEntreeGo(entry)} — ${t("chromatique dans Pokémon GO")}`,
                "aria-label": `${nomEntreeGo(entry)} — ${t("chromatique dans Pokémon GO")}`,
              },
              el("span.toggle__ico.toggle__ico--shiny", { "aria-hidden": "true" })
            )
          : el(
              "span.gcard__btn.gcard__btn--vide",
              { title: t("Aucun chromatique dans Pokémon GO à ce jour"), "aria-hidden": "true" },
              "—"
            )
    )
  );
  peindre(node, entry, ctx);
  return node;
}

/** Libellé court de la famille, posé à côté du numéro. */
const KIND_COURT = {
  alola: "Alola",
  galar: "Galar",
  hisui: "Hisui",
  paldea: "Paldéa",
  other: "Forme",
  cosmetic: "Motif",
  cap: "Casquette",
  battle: "Forme",
  mega: "Méga",
  primal: "Primo",
  gmax: "Gigamax",
};

/**
 * Remet la vignette à l'état de la collection. Les boutons ne sont jamais
 * remplacés : on ne fait que retourner leur `aria-pressed`.
 */
function peindre(node, entry, ctx) {
  const { collection } = ctx;
  const attrape = collection.has(entry.id, entry.slot);
  const shiny = collection.has(entry.id, entry.shinySlot);

  node.className = [
    "gcard",
    !entry.released ? "gcard--absent" : attrape ? "gcard--owned" : "gcard--missing",
    // Le chromatique sans le normal : on l'a bien en boîte, dire « je n'ai
    // rien » en passant l'image en gris était faux. Même règle que le Pokédex
    // HOME, où c'est `.card--partial` qui la porte.
    !attrape && shiny ? "gcard--partial" : "",
    shiny ? "gcard--shiny" : "",
    attrape && shiny ? "gcard--complete" : "",
  ]
    .filter(Boolean)
    .join(" ");

  node.title = !entry.released
    ? t("Pas encore obtenable dans Pokémon GO")
    : attrape && shiny
      ? t("Attrapé et chromatique")
      : attrape
        ? t("Attrapé")
        : shiny
          ? t("Chromatique obtenu, pas la version normale")
          : t("À attraper");

  // Le chromatique obtenu prend la place du sprite normal : c'est celui dont on
  // est fier, et c'est celui qu'on cherche des yeux en parcourant la grille.
  const art = node.querySelector(".gcard__art");
  const key = String(shiny);
  if (art.dataset.key !== key) {
    art.dataset.key = key;
    fill(
      art,
      entry.form
        ? formImg(entry.form, { shiny, alt: nomEntreeGo(entry), className: "gcard__img" })
        : entry.variant
          ? cosmeticImg(entry.variant, entry.id, { shiny, alt: nomEntreeGo(entry), className: "gcard__img" })
          : spriteImg(entry.id, { shiny, alt: nomEntreeGo(entry), className: "gcard__img" })
    );
  }

  for (const bouton of node.querySelectorAll("[data-go-slot]")) {
    bouton.setAttribute("aria-pressed", String(collection.has(entry.id, bouton.dataset.goSlot)));
  }
}
