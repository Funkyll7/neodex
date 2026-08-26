/**
 * dex-grid.js — la grille de vignettes.
 *
 * 1025 especes : on rend par paliers de CONFIG.pageSize et on charge la suite
 * quand la sentinelle de bas de liste entre dans le viewport. Chaque filtre
 * repart du premier palier.
 *
 * Deux principes qui evitent le bug de la case qui se recoche toute seule :
 *   - un seul ecouteur, delegue sur #grid, jamais detruit ;
 *   - cocher une case *repeint* la vignette au lieu de la remplacer, donc le
 *     bouton sous le doigt survit au clic et garde son focus.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { spriteImg } from "../domain/sprites.js";
import { completionOf } from "../domain/completion.js";
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

  grid.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-slot]");
    if (toggle) {
      ctx.onToggle(Number(toggle.dataset.species), toggle.dataset.slot);
      return;
    }
    const select = event.target.closest(".card__select");
    if (select) ctx.onSelect(Number(select.closest(".card").dataset.id));
  });

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

    /** Repeint une seule vignette apres un clic sur une case. */
    refresh(id) {
      const node = grid.querySelector(`[data-id="${id}"]`);
      if (!node) return;
      const wasComplete = node.classList.contains("card--complete");
      paint(node, ctx.dataset.byId.get(id), ctx);
      // La vignette vient de basculer sur « complet » : c'est le seul moment ou
      // l'animation a un sens. La jouer en permanence sur cent vignettes
      // fatiguerait l'oeil et la machine.
      if (!wasComplete && node.classList.contains("card--complete")) {
        node.classList.add("card--just-complete");
      }
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

/** Squelette : tout ce qui ne bouge jamais. Le reste est pose par paint(). */
function card(species, ctx) {
  const color = ctx.dataset.types[species.types[0]] || "#8b8b8b";

  const node = el(
    "div.card",
    { "--type": color, dataset: { id: species.id }, role: "listitem" },
    el(
      "button.card__select",
      { type: "button", "aria-label": `Ouvrir la fiche de ${species.name}` },
      el("span.card__top", el("span.card__num", dexNumber(species.id)), el("span.card__flags")),
      el("span.card__art"),
      el("span.card__name", species.name),
      el(
        "span.card__types",
        species.types.map((t) => typeChip(t, ctx.dataset.types[t] || "#8b8b8b"))
      ),
      el("span.card__foot")
    ),
    el("div.card__toggles", quickToggles(species, ctx, color))
  );

  paint(node, species, ctx);
  return node;
}

/**
 * Remet la vignette a l'etat de la collection. Ne remplace que ce qui change :
 * l'image (quand on passe du normal au chromatique) et les deux lignes de
 * texte. Les boutons, eux, ne bougent jamais — on ne fait que retourner leur
 * `aria-pressed`.
 */
function paint(node, species, ctx) {
  const { collection, store, dataset } = ctx;
  const marks = collection.get(species.id);
  const owned = collection.isOwned(species.id);
  const shiny = collection.isShiny(species.id);
  const progress = completionOf(species, collection);

  const view = store.state.view;
  const showShiny = view === "shiny" || (shiny && view !== "normal");
  const showFemale = Boolean(species.gd) && (showShiny ? marks.sf && !marks.sm : marks.of && !marks.om);

  node.className = [
    "card",
    owned ? "card--owned" : "card--missing",
    shiny ? "card--shiny" : "",
    showShiny && owned ? "card--shiny-art" : "",
    progress.complete ? "card--complete" : "",
    store.state.selectedId === species.id ? "card--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  node.title = progress.complete
    ? `Tout obtenu — ${progress.total} case${progress.total > 1 ? "s" : ""}`
    : `${progress.done} / ${progress.total} — reste : ${progress.missing.join(", ")}`;

  fill(
    node.querySelector(".card__flags"),
    progress.complete ? el("span.card__flag.card__flag--complete", { title: "Tout obtenu" }, "★") : null,
    // Le compteur repond a « combien de cases ce Pokemon demande-t-il ? »
    // sans avoir a ouvrir la fiche : Miaouss en veut huit, pas quatre.
    el(
      "span.card__flag.card__flag--count",
      { title: `${progress.done} case${progress.done > 1 ? "s" : ""} cochée${progress.done > 1 ? "s" : ""} sur ${progress.total}` },
      `${progress.done}/${progress.total}`
    ),
    species.formCount
      ? el("span.card__flag", { title: formTitle(species) }, `◈${species.formCount}`)
      : null,
    species.gd ? el("span.card__flag.card__flag--pair", { title: "Formes ♂ et ♀ distinctes" }, "♂♀") : null
  );

  const gmax = gmaxState(species, collection);
  const art = node.querySelector(".card__art");
  const key = `${showShiny}-${showFemale}-${gmax}`;
  if (art.dataset.key !== key) {
    art.dataset.key = key;
    fill(
      art,
      spriteImg(species.id, { shiny: showShiny, female: showFemale, alt: species.name, className: "card__img" }),
      showShiny
        ? el("span.card__spark", { title: "Version chromatique affichée", "aria-hidden": "true" })
        : null,
      // Sous l'étoile chromatique : l'emblème Gigamax, gris tant que la forme
      // n'est pas obtenue. Rien du tout chez les espèces qui n'en ont pas.
      gmax === "none"
        ? null
        : el(gmax === "owned" ? "span.card__gmax.card__gmax--on" : "span.card__gmax", {
            title: gmax === "owned" ? "Forme Gigamax obtenue" : "Forme Gigamax manquante",
          })
    );
  }

  fill(
    node.querySelector(".card__foot"),
    progress.complete
      ? el("span.card__complete", "★ Complet")
      : el("span.card__gen", dataset.generations[species.gen].game.replace("Pokémon ", ""))
  );

  for (const button of node.querySelectorAll("[data-slot]")) {
    button.setAttribute("aria-pressed", String(collection.has(species.id, button.dataset.slot)));
  }
}

/**
 * Etat Gigamax d'une espece, pour la pastille de la vignette.
 * « obtenue » des qu'une de ses formes Gigamax est cochee, normale ou
 * chromatique : avoir le Gigamax chromatique, c'est avoir le Gigamax.
 * @returns {"none"|"owned"|"missing"}
 */
function gmaxState(species, collection) {
  const forms = species.forms.filter((form) => form.kind === "gmax" && form.entry);
  if (!forms.length) return "none";
  const owned = forms.some(
    (form) => collection.has(species.id, form.slot) || collection.has(species.id, form.shinySlot)
  );
  return owned ? "owned" : "missing";
}

function formTitle(species) {
  const names = species.forms.map((f) => f.name);
  if (species.cosmetic && !species.cosmetic.info) names.push(species.cosmetic.title);
  return names.join(" · ");
}

/**
 * Cases rapides sous la vignette : ce qu'on coche le plus souvent.
 * Des pictogrammes, pas des mots — six boutons doivent tenir sur la largeur
 * d'une vignette de 150 px. Le libelle complet est dans le `title` et dans
 * l'`aria-label`.
 */
/**
 * Les pastilles des boutons.
 *
 * `base` et `shiny` sont des images posees en fond, pas du texte : les glyphes
 * Unicode qu'elles remplacent (● et ✦) dependaient de la police installee et
 * n'avaient rien a voir avec le vocabulaire visuel du jeu.
 *
 *   base   anneau gris et blanc — deux tons, donc une IMAGE : un masque en
 *          ferait un disque plein et l'anneau disparaitrait ;
 *   shiny  logo chromatique — une seule couleur, donc un MASQUE : il prend
 *          la teinte du bouton, doree ici, et suit les deux themes.
 */
const icoBase = () => el("span.toggle__ico.toggle__ico--base", { "aria-hidden": "true" });
const icoShiny = () => el("span.toggle__ico.toggle__ico--shiny", { "aria-hidden": "true" });

function quickToggles(species, ctx, color) {
  const base = species.cosmetic && species.cosmetic.baseVariant;
  const definitions = species.gd
    ? [
        ["om", ["♂"], "Mâle normal", false],
        ["of", ["♀"], "Femelle normale", false],
      ]
    : [["om", [icoBase()], base ? `${base.name} — normal` : "Marquer comme capturé", false]];

  if (!species.noShiny) {
    if (species.gd) {
      definitions.push(
        ["sm", [icoShiny(), "♂"], "Shiny mâle", true],
        ["sf", [icoShiny(), "♀"], "Shiny femelle", true]
      );
    } else {
      definitions.push([
        "sm",
        [icoShiny()],
        base ? `${base.name} — shiny` : "Marquer le shiny obtenu",
        true,
      ]);
    }
  }

  // Une seule forme est proposee ici : la principale. Les autres se cochent
  // dans la fiche, ou elles sont accompagnees de leur sprite et de leur texte.
  const primary = species.primaryForm;
  if (primary) {
    definitions.push([primary.slot, ["◈"], `${primary.name} — forme normale`, false]);
    if (primary.shinyEntry) {
      definitions.push([primary.shinySlot, [icoShiny(), "◈"], `${primary.name} — shiny`, true]);
    }
  }

  return definitions.map(([slot, label, title, gold]) =>
    el(
      gold ? "button.toggle.toggle--gold" : "button.toggle",
      {
        type: "button",
        title,
        "aria-label": `${title} — ${species.name}`,
        "--type": color,
        dataset: { slot, species: species.id },
      },
      label
    )
  );
}
