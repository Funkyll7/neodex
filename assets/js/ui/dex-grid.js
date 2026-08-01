/**
 * dex-grid.js — la grille de vignettes.
 *
 * 1025 especes : on rend par paliers de CONFIG.pageSize et on charge la suite
 * quand la sentinelle de bas de liste entre dans le viewport. Chaque filtre
 * repart du premier palier.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { spriteImg } from "../domain/sprites.js";
import { dexNumber, typeChip } from "./common.js";

export function createGrid(ctx) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("grid-empty");
  const sentinel = document.getElementById("grid-sentinel");
  const counter = document.getElementById("result-count");

  let list = [];
  let shown = 0;
  let scheduled = false;

  function appendPage() {
    const next = list.slice(shown, shown + CONFIG.pageSize);
    grid.append(...next.map((species) => card(species, ctx)));
    shown += next.length;
  }

  /**
   * Charge les paliers suivants tant que la sentinelle est a moins d'un ecran
   * du bas de la fenetre. La boucle couvre aussi le cas ou un palier ne suffit
   * pas a remplir l'ecran (filtre tres large sur un grand ecran).
   */
  function fillViewport() {
    let guard = 0;
    while (shown < list.length && guard < 40) {
      const distance = sentinel.getBoundingClientRect().top - window.innerHeight;
      if (distance > 600) break;
      appendPage();
      guard += 1;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fillViewport();
    });
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });

  return {
    /** Rendu complet : nouvelle liste filtree. */
    render(filtered) {
      list = filtered;
      shown = 0;
      grid.replaceChildren();
      empty.hidden = list.length > 0;
      counter.textContent = `${list.length} résultat${list.length > 1 ? "s" : ""}`;
      appendPage();
      schedule();
    },

    /** Redessine une seule vignette apres un clic sur une case. */
    refresh(id) {
      const old = grid.querySelector(`[data-id="${id}"]`);
      if (!old) return;
      const species = ctx.dataset.byId.get(id);
      old.replaceWith(card(species, ctx));
    },

    /** Met a jour l'anneau de selection sans tout redessiner. */
    setSelected(id, previousId) {
      for (const value of [previousId, id]) {
        const node = grid.querySelector(`[data-id="${value}"]`);
        if (node) node.classList.toggle("card--selected", value === id);
      }
    },
  };
}

/* ------------------------------- vignette -------------------------------- */

function card(species, ctx) {
  const { collection, store, dataset } = ctx;
  const marks = collection.get(species.id);
  const owned = collection.isOwned(species.id);
  const shiny = collection.isShiny(species.id);
  const selected = store.state.selectedId === species.id;
  const color = dataset.types[species.types[0]] || "#8b8b8b";

  const view = store.state.view;
  const showShiny = view === "shiny" || (shiny && view !== "normal");
  const showFemale = Boolean(species.gd) && (showShiny ? marks.sf && !marks.sm : marks.of && !marks.om);

  const node = el(
    "div",
    {
      "--type": color,
      dataset: { id: species.id },
      role: "listitem",
      class: [
        "card",
        owned ? "card--owned" : "card--missing",
        shiny ? "card--shiny" : "",
        showShiny && owned ? "card--shiny-art" : "",
        selected ? "card--selected" : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    el(
      "button.card__select",
      {
        type: "button",
        "aria-label": `Ouvrir la fiche de ${species.name}`,
        onclick: () => store.set({ selectedId: species.id }),
      },
      el(
        "span.card__top",
        el("span.card__num", dexNumber(species.id)),
        el(
          "span.card__flags",
          species.variant ? el("span.card__flag", { title: species.variant.name }, "VAR") : null,
          species.gd
            ? el("span.card__flag.card__flag--pair", { title: "Formes ♂ et ♀ distinctes" }, "♂♀")
            : null
        )
      ),
      el(
        "span.card__art",
        spriteImg(species.id, {
          shiny: showShiny,
          female: showFemale,
          alt: species.name,
          className: "card__img",
        }),
        showShiny && el("span.card__spark", { title: "Version chromatique affichée" }, "✦")
      ),
      el("span.card__name", species.name),
      el(
        "span.card__types",
        species.types.map((t) => typeChip(t, dataset.types[t] || "#8b8b8b"))
      ),
      el("span.card__gen", dataset.generations[species.gen].game.replace("Pokémon ", ""))
    ),
    el("div.card__toggles", quickToggles(species, ctx, color))
  );

  return node;
}

/** Cases rapides sous la vignette : ce qu'on coche le plus souvent. */
function quickToggles(species, ctx, color) {
  const definitions = species.gd
    ? [
        ["om", "♂", "Mâle normal", false],
        ["of", "♀", "Femelle normale", false],
        ["sm", "✦♂", "Shiny mâle", true],
        ["sf", "✦♀", "Shiny femelle", true],
      ]
    : [
        ["om", "Normal", "Marquer comme capturé", false],
        ["sm", "✦", "Marquer le shiny obtenu", true],
      ];

  if (species.variant && !isMega(species)) {
    definitions.push(
      ["vo", "◈", `${species.variant.name} — forme normale`, false],
      ["vs", "✦◈", `${species.variant.name} — shiny`, true]
    );
  }

  return definitions.map(([slot, label, title, gold]) =>
    toggleButton(species, slot, label, title, gold, color, ctx)
  );
}

function toggleButton(species, slot, label, title, gold, color, ctx) {
  const on = ctx.collection.has(species.id, slot);
  return el(
    gold ? "button.toggle.toggle--gold" : "button.toggle",
    {
      type: "button",
      title,
      "aria-label": `${title} — ${species.name}`,
      "aria-pressed": String(on),
      "--type": color,
      onclick: (event) => {
        event.stopPropagation();
        ctx.onToggle(species.id, slot);
      },
    },
    on ? `✓${label === "Normal" || label === "✦" ? "" : label}` : label
  );
}

export const isMega = (species) =>
  Boolean(species.variant && /m[ée]ga/i.test(species.variant.name || ""));
