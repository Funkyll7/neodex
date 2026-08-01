/**
 * detail-panel.js — la fiche de droite.
 *
 * Sections, dans l'ordre : entete, ma collection, variante, disponibilite par
 * jeu, shiny hunt, fiche d'origine, statistiques de base.
 * Tout est reconstruit a chaque changement de selection ou de case cochee :
 * c'est un seul panneau, le cout est negligeable.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { spriteImg } from "../domain/sprites.js";
import { availabilityRows, huntableGames } from "../domain/availability.js";
import { dexNumber, typeChip, pokepediaUrl, bulbapediaUrl } from "./common.js";
import { isMega } from "./dex-grid.js";

export function createDetailPanel(ctx) {
  const root = document.getElementById("detail");

  return {
    render(species) {
      const { dataset } = ctx;
      const c1 = dataset.types[species.types[0]] || "#8b8b8b";
      const c2 = dataset.types[species.types[1]] || c1;
      root.style.setProperty("--c1", c1);
      root.style.setProperty("--c2", c2);

      fill(
        root,
        head(species, ctx, c1),
        collectionSection(species, ctx),
        variantSection(species, ctx),
        availabilitySection(species, ctx),
        huntSection(species, ctx),
        infoSection(species, ctx),
        statsSection(species, ctx)
      );
      root.scrollTop = 0;
    },
  };
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

/* -------------------------------- variante -------------------------------- */

function variantSection(species, ctx) {
  const variant = species.variant;
  if (!variant) return null;
  const collectible = !isMega(species);

  return el(
    "section.detail__section",
    el("h3.panel__label", `Variante · ${variant.name}`),
    el(
      "div.variant",
      el(
        "div.variant__pair",
        el(
          "div.variant__cell",
          el("span.variant__cap", "Normal"),
          spriteImg(variant.id, { alt: variant.name, className: "variant__img" })
        ),
        el(
          "div.variant__cell",
          el("span.variant__cap.variant__cap--shiny", "✦ Shiny"),
          spriteImg(variant.id, { shiny: true, alt: `${variant.name} shiny`, className: "variant__img variant__img--shiny" })
        )
      ),
      collectible &&
        el(
          "div.variant__btns",
          [
            ["vo", "Normal", false],
            ["vs", "✦ Shiny", true],
          ].map(([slot, label, gold]) => {
            const on = ctx.collection.has(species.id, slot);
            return el(
              gold ? "button.variant__btn.variant__btn--gold" : "button.variant__btn",
              {
                type: "button",
                "aria-pressed": String(on),
                onclick: () => ctx.onToggle(species.id, slot),
              },
              on ? `✓ ${label}` : label
            );
          })
        ),
      !collectible &&
        el("p.variant__warn", "Forme temporaire en combat — ce n'est pas une entrée séparée à collectionner."),
      el("p.variant__text", variant.where || ""),
      el("a.info__link", { href: pokepediaUrl(variant.name), target: "_blank", rel: "noopener" }, "Fiche de la variante ↗")
    )
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

function huntSection(species, { dataset }) {
  const huntable = huntableGames(species, dataset.games);
  const methods = huntable.length ? dataset.hunt.generalMethods : [];

  const why = huntable.length
    ? `Meilleurs jeux pour la chasse : ${huntable.slice(-3).map((g) => g.name).join(" · ")}. Les jeux marqués « Bloqué » donnent ce Pokémon dans l'intrigue avec le chromatique désactivé, et la Gén. I n'a pas de chromatiques du tout.`
    : species.note ||
      (species.curated
        ? "Ce Pokémon n'est obtenable qu'en événement ou dans l'intrigue avec le chromatique désactivé (shiny-locked) dans tous les jeux où il apparaît."
        : "Disponibilité pas encore renseignée : impossible de dire où le shiny est chassable.");

  return el(
    "section.detail__section",
    el("h3.panel__label", "✦ Shiny hunt"),
    el(
      "div.hunt",
      el(
        huntable.length ? "span.hunt__badge" : "span.hunt__badge.hunt__badge--none",
        huntable.length
          ? `✦ Shiny hunt possible dans ${huntable.length} jeu${huntable.length > 1 ? "x" : ""}`
          : "Shiny impossible ou non documenté"
      ),
      el("p.hunt__why", why),
      methods.length ? el("div.hunt__sep") : null,
      methods.length ? el("h4.panel__label", "Méthodes recommandées") : null,
      el(
        "div.hunt__list",
        methods.map((m) =>
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
