/**
 * quest.js — l'onglet « Quêtes ».
 *
 * Le planificateur tire une espece dont le shiny n'est pas encore coche, choisit
 * le jeu au meilleur taux et affiche la marche a suivre. Valider coche le shiny
 * et tire la quete suivante ; passer se contente de retirer.
 *
 * Le vivier se limite aux especes dont la disponibilite est renseignee dans
 * data/details/ : c'est indique dans la carte pour que ce ne soit pas une
 * surprise quand un Pokemon ne sort jamais.
 */

import { el, fill } from "../core/dom.js";
import { spriteImg } from "../domain/sprites.js";
import { dexNumber, typeChip } from "./common.js";

export function createQuest(ctx) {
  const card = document.getElementById("quest-card");
  const logRoot = document.getElementById("quest-log");
  const doneOut = document.getElementById("quest-done");
  const skippedOut = document.getElementById("quest-skipped");

  function complete(done) {
    const { quest } = ctx.store.state;
    if (done && quest) {
      const species = ctx.dataset.byId.get(quest.id);
      const game = ctx.dataset.gamesByCode.get(quest.game);
      const method = ctx.planner.methodFor(quest.game, species);
      ctx.collection.mark(species.id, "sm");
      ctx.store.set((s) => ({
        questDone: s.questDone + 1,
        questLog: [
          { id: species.id, name: species.name, game: game.name, method: method.name },
          ...s.questLog,
        ].slice(0, 8),
      }));
      ctx.onCollectionChange(species.id);
    } else {
      ctx.store.set((s) => ({ questSkipped: s.questSkipped + 1 }));
    }
    ctx.store.set({ quest: ctx.planner.roll(ctx.collection) });
  }

  return {
    render() {
      const state = ctx.store.state;
      doneOut.textContent = state.questDone;
      skippedOut.textContent = state.questSkipped;
      renderLog(logRoot, state.questLog, ctx);

      const quest = state.quest;
      if (!quest) {
        fill(card, emptyQuest(ctx, complete));
        return;
      }
      const species = ctx.dataset.byId.get(quest.id);
      const game = ctx.dataset.gamesByCode.get(quest.game);
      if (!species || !game) {
        fill(card, emptyQuest(ctx, complete));
        return;
      }
      fill(card, questBody(species, game, ctx, complete));
    },
  };
}

/* ------------------------------ carte quete ------------------------------ */

function questBody(species, game, ctx, complete) {
  const { dataset, planner, store } = ctx;
  const method = planner.methodFor(game.code, species);
  const c1 = dataset.types[species.types[0]] || "#8b8b8b";
  const c2 = dataset.types[species.types[1]] || c1;
  const poolSize = planner.questGames(species).length;

  const fragment = document.createDocumentFragment();

  const head = el(
    "div.quest__head",
    { "--c1": c1, "--c2": c2 },
    el("span.quest__kicker", "Quête en cours · méthode la plus simple"),
    el(
      "div.quest__hero",
      spriteImg(species.id, { shiny: true, alt: `${species.name} chromatique`, className: "quest__img" }),
      el(
        "div.quest__id",
        el("div.quest__num", dexNumber(species.id)),
        el("h2.quest__name", `✦ ${species.name}`),
        el("p.quest__where", ["dans ", el("strong", game.name)]),
        el(
          "div.detail__chips",
          species.types.map((t) => typeChip(t, dataset.types[t] || "#8b8b8b", "lg"))
        )
      )
    )
  );

  const body = el(
    "div.quest__body",
    el(
      "div.quest__facts",
      el(
        "div.quest__fact",
        el("div.quest__fact-key", "Méthode"),
        el("div.quest__fact-val", method.name)
      ),
      el(
        "div.quest__fact.quest__fact--odds",
        el("div.quest__fact-key", "Taux"),
        el("div.quest__fact-val.quest__fact-val--odds", method.odds),
        el(
          "div.quest__fact-note",
          `Meilleur taux disponible parmi les ${poolSize} jeu${poolSize > 1 ? "x" : ""} où ce shiny est huntable.`
        )
      )
    ),
    el(
      "div",
      el("h3.panel__label", "Comment procéder"),
      el(
        "div.quest__steps",
        method.steps.map((text, index) =>
          el("div.quest__step", el("span.quest__step-n", index + 1), el("span.quest__step-text", text))
        )
      )
    ),
    game.gen >= species.gen && species.where
      ? el(
        "div.quest__fact",
        el(
          "div.quest__fact-key",
          game.gen === species.gen
            ? "Où le trouver dans ce jeu"
            : `Repère général — vérifie la zone équivalente dans ${game.name}`
        ),
        el("div.info__text", species.where)
      )
      : null,
    el(
      "div.quest__actions",
      el(
        "button.btn.btn--wide.quest__done",
        { type: "button", onclick: () => complete(true) },
        "✦ Shiny obtenu — quête terminée"
      ),
      el("button.btn.btn--ghost", { type: "button", onclick: () => complete(false) }, "Passer"),
      el(
        "button.btn.btn--ghost",
        {
          type: "button",
          onclick: () => store.set({ tab: "dex", selectedId: species.id }),
        },
        "Voir la fiche"
      )
    )
  );

  fragment.append(head, body);
  return fragment;
}

function emptyQuest(ctx, complete) {
  const documented = ctx.dataset.species.filter((p) => p.curated).length;
  const fragment = document.createDocumentFragment();
  fragment.append(
    el(
      "div.quest__head",
      { "--c1": "#ffcb05", "--c2": "#ff9c3d" },
      el("span.quest__kicker", "Aucune quête disponible"),
      el("h2.quest__name", { style: { marginTop: "8px" } }, "Rien à chasser pour l'instant")
    ),
    el(
      "div.quest__body",
      el(
        "p.info__text",
        `Les quêtes se tirent parmi les ${documented} espèces dont la disponibilité par jeu est renseignée dans data/details/. Soit tous leurs shinies sont cochés, soit il faut enrichir ces fichiers pour élargir le vivier.`
      ),
      el(
        "div.quest__actions",
        el("button.btn", { type: "button", onclick: () => complete(false) }, "Retirer une quête"),
        el(
          "button.btn.btn--ghost",
          { type: "button", onclick: () => ctx.store.set({ tab: "dex" }) },
          "Retour au Pokédex"
        )
      )
    )
  );
  return fragment;
}

/* ------------------------------- journal --------------------------------- */

function renderLog(root, entries, ctx) {
  if (!entries.length) {
    fill(
      root,
      el(
        "p.log__empty",
        "Aucune quête terminée pour l'instant. Attrape le shiny demandé, puis valide — une nouvelle cible est tirée aussitôt."
      )
    );
    return;
  }
  fill(
    root,
    el(
      "div.log",
      entries.map((entry) =>
        el(
          "div.log__item",
          spriteImg(entry.id, { shiny: true, alt: entry.name, className: "log__img" }),
          el(
            "div",
            el("div.log__name", `✦ ${entry.name}`),
            el("div.log__meta", `${entry.game} · ${entry.method}`)
          )
        )
      )
    )
  );
}
