/**
 * detail-panel.js — la fiche de droite.
 *
 * Sections, dans l'ordre : entete, ma collection, formes alternatives,
 * disponibilite par jeu, shiny hunt jeu par jeu, fiche d'origine, statistiques.
 * Tout est reconstruit a chaque changement de selection ou de case cochee :
 * c'est un seul panneau, le cout est negligeable.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { spriteImg, formImg } from "../domain/sprites.js";
import { availabilityRows, huntableGames } from "../domain/availability.js";
import { dexNumber, typeChip, pokepediaUrl, bulbapediaUrl } from "./common.js";

export function createDetailPanel(ctx) {
  const root = document.getElementById("detail");
  const singleColumn = window.matchMedia("(max-width: 1180px)");
  let shownId = null;

  return {
    /**
     * @param {object} species
     * @param {boolean} reveal  vrai quand l'utilisateur vient de choisir une
     *   vignette : en une colonne la fiche est sous la grille, il faut y aller.
     */
    render(species, reveal = false) {
      const { dataset } = ctx;
      const c1 = dataset.types[species.types[0]] || "#8b8b8b";
      const c2 = dataset.types[species.types[1]] || c1;
      root.style.setProperty("--c1", c1);
      root.style.setProperty("--c2", c2);

      // Cocher une case reconstruit toute la fiche. Tant qu'on reste sur le
      // meme Pokemon, on remet l'utilisateur exactement ou il etait : meme
      // position de defilement, memes methodes depliees.
      const sameSpecies = shownId === species.id;
      const scroll = sameSpecies ? root.scrollTop : 0;
      const opened = sameSpecies ? openedMethods(root) : null;

      fill(
        root,
        head(species, ctx, c1),
        collectionSection(species, ctx),
        formsSection(species, ctx),
        availabilitySection(species, ctx),
        huntSection(species, ctx),
        infoSection(species, ctx),
        statsSection(species, ctx)
      );

      if (opened) restoreMethods(root, opened);
      root.scrollTop = scroll;
      shownId = species.id;

      if (reveal && !sameSpecies && singleColumn.matches) {
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
  };
}

/** Codes des jeux dont la marche a suivre est depliee. */
function openedMethods(root) {
  return new Set(
    [...root.querySelectorAll(".method[open]")].map((node) => node.dataset.game)
  );
}

function restoreMethods(root, opened) {
  for (const node of root.querySelectorAll(".method")) {
    if (opened.has(node.dataset.game)) node.open = true;
  }
}

/* -------------------------------- entete --------------------------------- */

function head(species, { dataset, collection }) {
  const owned = collection.isOwned(species.id);
  const shiny = collection.isShiny(species.id);

  return el(
    "header.detail__head",
    el(
      "div.detail__head-row",
      el("span.detail__num", dexNumber(species.id)),
      el(
        owned ? "span.detail__tag.detail__tag--owned" : "span.detail__tag",
        shiny ? "✦ Shiny obtenu" : owned ? "✓ Capturé" : "Manquant"
      )
    ),
    el("h2.detail__name", species.name),
    el("p.detail__sub", [species.en, species.cat].filter(Boolean).join(" · ")),
    el(
      "div.detail__chips",
      species.types.map((t) => typeChip(t, dataset.types[t] || "#8b8b8b", "lg"))
    )
  );
}

/* ---------------------------- ma collection ------------------------------ */

function collectionSection(species, ctx) {
  const slots = species.gd
    ? [
        ["om", "Normal ♂", false, false],
        ["of", "Normal ♀", false, true],
        ["sm", "Shiny ♂", true, false],
        ["sf", "Shiny ♀", true, true],
      ]
    : [
        ["om", "Normal", false, false],
        ["sm", "Shiny", true, false],
      ];

  return el(
    "section.detail__section",
    el(
      "div.detail__row",
      el("h3.panel__label", "Ma collection"),
      el("span.detail__note", species.gd ? "Formes ♂ / ♀ distinctes" : "Aucune différence ♂ / ♀")
    ),
    el(
      "p.detail__help",
      species.gd
        ? "Cette espèce a des apparences mâle et femelle différentes : coche chaque case que tu possèdes. Dès qu'un shiny est coché, la vignette bascule sur sa version chromatique."
        : "Coche ce que tu possèdes. Dès que « Shiny » est coché, la vignette bascule sur l'image chromatique."
    ),
    el(
      species.gd ? "div.slots.slots--gendered" : "div.slots",
      slots.map(([slot, label, shiny, female]) => slotButton(species, ctx, { slot, label, shiny, female }))
    )
  );
}

function slotButton(species, ctx, { slot, label, shiny, female }) {
  const on = ctx.collection.has(species.id, slot);
  return el(
    shiny ? "button.slot.slot--gold" : "button.slot",
    {
      type: "button",
      "aria-pressed": String(on),
      onclick: () => ctx.onToggle(species.id, slot),
    },
    el(
      "span.slot__top",
      el(female && !shiny ? "span.slot__tag.slot__tag--f" : "span.slot__tag", shiny ? "✦" : female ? "♀" : "♂"),
      el("span.slot__check", "✓")
    ),
    spriteImg(species.id, {
      shiny,
      female: female && Boolean(species.gd),
      alt: `${species.name} ${label}`,
      className: "slot__img",
    }),
    el("span.slot__label", label)
  );
}

/* -------------------------------- formes --------------------------------- */

/** Libelles des groupes, dans l'ordre d'affichage. */
const KIND_TITLES = {
  alola: "Formes d'Alola",
  galar: "Formes de Galar",
  hisui: "Formes de Hisui",
  paldea: "Formes de Paldéa",
  mega: "Méga-Évolutions",
  primal: "Primo-Résurgence",
  gmax: "Formes Gigamax",
  cap: "Pikachu à casquette",
  battle: "Formes de combat",
  other: "Autres formes",
};
const KIND_ORDER = Object.keys(KIND_TITLES);

function formsSection(species, ctx) {
  if (!species.forms.length) return null;

  const groups = new Map();
  for (const form of species.forms) {
    if (!groups.has(form.kind)) groups.set(form.kind, []);
    groups.get(form.kind).push(form);
  }
  const ordered = KIND_ORDER.filter((kind) => groups.has(kind));

  return el(
    "section.detail__section",
    el(
      "div.detail__row",
      el("h3.panel__label", `Formes · ${species.forms.length}`),
      el("span.detail__note", `${species.forms.filter((f) => f.collectible).length} à collectionner`)
    ),
    el(
      "p.detail__help",
      "Chaque forme a son propre sprite normal et chromatique. Les Méga-Évolutions et les formes de combat ne sont que des transformations : elles reprennent le chromatique du Pokémon de base et ne se cochent pas."
    ),
    ordered.map((kind) => formGroup(kind, groups.get(kind), species, ctx))
  );
}

/**
 * Un groupe de formes. Celles qu'on ne collectionne pas — Méga, formes de
 * combat, casquettes — sont repliees par defaut : chez Pikachu elles font a
 * elles seules quatorze cartes, et elles poussent le reste de la fiche hors de
 * portee. Un clic sur le titre les rouvre.
 */
function formGroup(kind, forms, species, ctx) {
  const cards = forms.map((form) => formCard(form, species, ctx));
  const collapsible = !forms.some((form) => form.collectible) && forms.length > 2;
  const title = `${KIND_TITLES[kind]} · ${forms.length}`;

  if (!collapsible) {
    return el("div.forms__group", el("h4.forms__title", title), el("div.forms__list", cards));
  }
  return el(
    "details.forms__group.forms__group--fold",
    el("summary.forms__title.forms__title--fold", title),
    el("div.forms__list", cards)
  );
}

function formCard(form, species, ctx) {
  const { dataset, collection } = ctx;
  const games = dataset.games.filter((g) => form.games.has(g.code));
  const huntable = games.filter((g) => g.shinyOk !== false && !form.shinyLocked.has(g.code));

  return el(
    "article.form",
    el(
      "div.form__head",
      el(
        "div.form__arts",
        el(
          "span.form__art",
          formImg(form, { alt: form.name, className: "form__img" })
        ),
        form.hasShinySprite
          ? el(
              "span.form__art.form__art--shiny",
              formImg(form, { shiny: true, alt: `${form.name} chromatique`, className: "form__img" }),
              el("span.form__spark", "✦")
            )
          : null
      ),
      el(
        "div.form__id",
        el("div.form__name", form.name),
        el(
          "div.form__chips",
          form.types.map((t) => typeChip(t, dataset.types[t] || "#8b8b8b"))
        ),
        el("div.form__label", form.label)
      )
    ),
    form.where ? el("p.form__text", form.where) : null,
    el(
      "p.form__games",
      games.length
        ? ["Présente dans : ", el("strong", games.map((g) => g.name).join(" · "))]
        : "Aucun jeu de la série principale ne la propose — transfert HOME uniquement."
    ),
    shinyLine(form, huntable, games),
    form.note ? el("p.form__note", form.note) : null,
    form.collectible
      ? el(
          "div.form__btns",
          [
            [form.slot, "Normal", false],
            [form.shinySlot, "✦ Shiny", true],
          ].map(([slot, label, gold]) => {
            const on = collection.has(species.id, slot);
            return el(
              gold ? "button.form__btn.form__btn--gold" : "button.form__btn",
              {
                type: "button",
                "aria-pressed": String(on),
                onclick: () => ctx.onToggle(species.id, slot),
              },
              on ? `✓ ${label}` : label
            );
          })
        )
      : el("p.form__warn", "Transformation de combat : rien à cocher, elle n'a pas d'entrée propre dans HOME."),
    el(
      "a.info__link",
      { href: pokepediaUrl(form.name), target: "_blank", rel: "noopener" },
      "Fiche de la forme ↗"
    )
  );
}

/** La ligne qui repond a « et le shiny, alors ? » pour une forme. */
function shinyLine(form, huntable, games) {
  if (form.shiny === "base") {
    return el("p.form__shiny.form__shiny--base", "✦ Pas de chasse dédiée : c'est le chromatique du Pokémon de base qui s'affiche sous cette forme.");
  }
  if (form.shiny === "none" || !form.hasShinySprite) {
    return el("p.form__shiny.form__shiny--none", "✦ Aucun chromatique n'existe pour cette forme, dans aucun jeu.");
  }
  if (!huntable.length) {
    return el(
      "p.form__shiny.form__shiny--none",
      games.length
        ? `✦ Chromatique verrouillé partout où elle apparaît (${games.map((g) => g.name).join(" · ")}).`
        : "✦ Chromatique non chassable dans la série principale."
    );
  }
  return el(
    "p.form__shiny.form__shiny--ok",
    `✦ Chromatique chassable dans ${huntable.length} jeu${huntable.length > 1 ? "x" : ""} : ${huntable
      .map((g) => g.name)
      .join(" · ")}.`
  );
}

/* --------------------- disponibilite par jeu ----------------------------- */

function availabilitySection(species, { dataset }) {
  const section = el("section.detail__section", el("h3.panel__label", "Où le trouver — tous les jeux"));

  if (!species.curated) {
    section.append(
      el(
        "p.detail__help",
        "Disponibilité pas encore renseignée pour cette espèce. Elle s'ajoute dans ",
        el("code", `data/details/gen-${species.gen}.json`),
        " (champs gm / ev / nsh) — voir PROJET.md."
      )
    );
    return section;
  }

  section.append(
    el(
      "p.detail__help",
      "Vert = capturable en jeu et shiny huntable · orange = capturable mais shiny impossible · violet = uniquement par événement, shiny possible · bleu = événement et shiny impossible."
    ),
    el(
      "div.games",
      el(
        "div.games__row.games__head",
        el("span", "Jeu"),
        el("span", "Présence"),
        el("span.games__cell--shiny", "Shiny")
      ),
      availabilityRows(species, dataset.games).map((row) =>
        el(
          "div",
          {
            class: row.present ? "games__row games__row--on" : "games__row",
            "--c": row.color || "transparent",
          },
          el(
            "div",
            el("div.games__name", row.game.name),
            el("div.games__gen", `Gén. ${row.game.gen}`)
          ),
          el("span.games__cell", row.presenceLabel),
          el("span.games__cell.games__cell--shiny", row.shinyLabel)
        )
      )
    ),
    el(
      "p.footnote",
      "Séries principales uniquement. Un Pokémon absent reste obtenable par échange ou transfert (Banque / HOME) depuis un jeu où il apparaît."
    )
  );
  return section;
}

/* ------------------------------ shiny hunt ------------------------------- */

function huntSection(species, ctx) {
  const { dataset, planner } = ctx;
  const huntable = huntableGames(species, dataset.games);
  const locked = dataset.games.filter(
    (g) => species.games.has(g.code) && g.shinyOk !== false && species.shinyLocked.has(g.code)
  );

  const badge = el(
    huntable.length ? "span.hunt__badge" : "span.hunt__badge.hunt__badge--none",
    huntable.length
      ? `✦ Shiny hunt possible dans ${huntable.length} jeu${huntable.length > 1 ? "x" : ""}`
      : "Shiny impossible dans la série principale"
  );

  const why = huntable.length
    ? whyText(species, huntable, planner)
    : species.note ||
      (species.curated
        ? "Ce Pokémon est verrouillé chromatique (shiny lock) dans tous les jeux où il apparaît, ou n'existe que dans la Gén. I, qui ne connaît pas les chromatiques."
        : "Disponibilité pas encore renseignée : impossible de dire où le shiny est chassable.");

  return el(
    "section.detail__section",
    el("h3.panel__label", "✦ Shiny hunt — jeu par jeu"),
    el(
      "div.hunt",
      badge,
      el("p.hunt__why", why),
      huntable.length ? el("div.hunt__sep") : null,
      huntable.map((game) => gameMethod(species, game, planner)),
      locked.length
        ? el(
            "p.hunt__locked",
            `Verrouillé chromatique dans : ${locked.map((g) => g.name).join(" · ")}. `,
            lockReason(species, locked, dataset)
          )
        : null,
      el("div.hunt__sep"),
      el("h4.panel__label", "Rappel des méthodes générales"),
      el(
        "div.hunt__list",
        dataset.hunt.generalMethods.map((m) =>
          el(
            "div.hunt__item",
            el("span.hunt__odds", m.odds),
            el("div", el("div.hunt__name", m.name), el("div.hunt__how", m.how))
          )
        )
      ),
      el(
        "a.info__link",
        { href: CONFIG.links.shinyGuide, target: "_blank", rel: "noopener", style: { marginTop: "10px", display: "inline-block" } },
        "Guide complet des Pokémon chromatiques ↗"
      )
    )
  );
}

/** Une carte depliable par jeu : methode, taux, marche a suivre. */
function gameMethod(species, game, planner) {
  const method = planner.methodFor(game.code, species);
  const node = el(
    "details.method",
    { dataset: { game: game.code } },
    el(
      "summary.method__head",
      el("span.method__game", game.name),
      el("span.method__odds", method.odds || "—"),
      el("span.method__name", method.name)
    ),
    el("ol.method__steps", (method.steps || []).map((step) => el("li", step)))
  );
  return node;
}

function whyText(species, huntable, planner) {
  const best = huntable
    .map((game) => ({ game, method: planner.methodFor(game.code, species) }))
    .sort((a, b) => oddsOf(a.method.odds) - oddsOf(b.method.odds))[0];
  return (
    `Le meilleur taux se trouve dans ${best.game.name} : ${best.method.name}, ${best.method.odds}. ` +
    "Déplie un jeu ci-dessous pour la marche à suivre exacte ; les taux tiennent compte du Charme Chroma quand le jeu le propose."
  );
}

function lockReason(species, locked, dataset) {
  const always = ((dataset.locks.always && dataset.locks.always.species) || []).includes(species.id);
  if (always) return dataset.locks.always.why || "";
  const first = dataset.locks.byGame && dataset.locks.byGame[locked[0].code];
  return (first && first.why) || "Le jeu ne génère jamais cette espèce en chromatique.";
}

function oddsOf(odds) {
  const match = /1\s*\/\s*([\d\s]+)/.exec(odds || "");
  return match ? parseInt(match[1].replace(/\s/g, ""), 10) : Number.MAX_SAFE_INTEGER;
}

/* --------------------------------- fiche --------------------------------- */

function infoSection(species, { dataset }) {
  const gen = dataset.generations[species.gen];
  return el(
    "section.detail__section",
    el("h3.panel__label", "Fiche"),
    el(
      "div.info",
      el(
        "div",
        el("div.info__key", "Apparition d'origine"),
        el("div.info__val", gen.game),
        el("div.info__sub", `${gen.label} · sortie ${gen.year}`)
      ),
      el("div.info__sep"),
      el(
        "div",
        el("div.info__key", "Emplacement d'origine"),
        el("div.info__text", species.where || "Non renseigné pour l'instant.")
      ),
      el(
        "div.info__links",
        el("a.info__link", { href: pokepediaUrl(species.name), target: "_blank", rel: "noopener" }, "Poképédia (FR) ↗"),
        el("a.info__link", { href: bulbapediaUrl(species.en), target: "_blank", rel: "noopener" }, "Bulbapedia (EN) ↗")
      )
    )
  );
}

/* --------------------------------- stats --------------------------------- */

function statsSection(species, { dataset }) {
  const total = species.stats.reduce((sum, n) => sum + n, 0);
  return el(
    "section.detail__section",
    el("h3.panel__label", "Statistiques de base"),
    species.stats.map((value, index) =>
      el(
        "div.stat",
        el("span.stat__label", dataset.statLabels[index]),
        el("span.stat__value", value),
        el("div.stat__track", el("div.stat__bar", { style: { width: `${Math.min(100, (value / 255) * 100)}%` } }))
      )
    ),
    el(
      "div.stat.stat--total",
      el("span.stat__label", "Total"),
      el("span.stat__value", total),
      el("div.stat__track", el("div.stat__bar", { style: { width: `${Math.min(100, (total / 720) * 100)}%` } }))
    )
  );
}
