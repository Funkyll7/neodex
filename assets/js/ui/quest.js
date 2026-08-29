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

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { spriteImg } from "../domain/sprites.js";
import { dexNumber, typeChip } from "./common.js";
import { nomEspece, t, tn } from "../core/i18n.js";
import { oddsValue } from "../domain/hunt.js";
import { progressOf } from "../domain/progress.js";
import { jouer } from "./sons.js";
import { embleme } from "./symboles-jeux.js";
import {
  chassesOuvertes,
  chanceCumulee,
  nouvelAppareil,
  nouvelleCle,
  totalPartie,
} from "../domain/quetes.js";

/**
 * L'identifiant de CET appareil, six hexadécimaux tirés une fois.
 *
 * Le compteur de rencontres est rangé en une colonne par appareil — voir la
 * démonstration en tête de `domain/quetes.js`. Cet identifiant n'est donc pas
 * un traçage : c'est le nom de la colonne dans laquelle ce navigateur écrit, et
 * la seule chose qui rende la fusion capable de ne rien perdre.
 *
 * Dans les préférences locales et non dans la collection : il décrit l'appareil,
 * pas ce qu'on a attrapé.
 */
function idAppareil() {
  try {
    const cle = CONFIG.storage.prefs;
    const prefs = JSON.parse(localStorage.getItem(cle) || "{}");
    if (typeof prefs.appareil === "string" && /^[0-9a-f]{6}$/.test(prefs.appareil)) {
      return prefs.appareil;
    }
    const neuf = nouvelAppareil();
    localStorage.setItem(cle, JSON.stringify({ ...prefs, appareil: neuf }));
    return neuf;
  } catch {
    // Stockage bloqué : un identifiant éphémère. Le compteur marchera pour la
    // session et sa colonne repartira à zéro ensuite — ce qui vaut mieux que de
    // refuser de compter.
    return nouvelAppareil();
  }
}

export function createQuest(ctx) {
  const card = document.getElementById("quest-card");
  const logRoot = document.getElementById("quest-log");
  const statsRoot = document.getElementById("quest-stats");
  const appareil = idAppareil();

  /** Le tirage suivant, en reprenant le jeu d'une chasse déjà ouverte. */
  function tirer() {
    return ctx.planner.roll(ctx.collection, chassesOuvertes(ctx.collection.quetes));
  }

  /** La chasse en cours pour la quête affichée, ou `null` si aucune. */
  function chasseCourante() {
    const { quest } = ctx.store.state;
    if (!quest) return null;
    const vue = chassesOuvertes(ctx.collection.quetes).get(quest.id);
    if (!vue) return null;
    return { cle: vue.cle, part: ctx.collection.quetes.parties[vue.cle] };
  }

  /**
   * Compte des rencontres. Crée la chasse au PREMIER appui, jamais au tirage :
   * une chasse est un acte volontaire, une quête tirée n'est qu'une proposition.
   */
  function compter(delta) {
    const { quest } = ctx.store.state;
    if (!quest) return;

    const carnet = ctx.collection.quetes;
    const ouverte = chassesOuvertes(carnet).get(quest.id);
    const cle = ouverte ? ouverte.cle : nouvelleCle();
    const part = carnet.parties[cle] || { e: quest.id, j: quest.game, r: {}, s: "encours" };

    const suivant = Math.max(0, (part.r[appareil] || 0) + delta);
    const r = { ...part.r };
    // Une colonne à zéro est RETIRÉE : la garder aurait laissé l'état différer
    // de son export relu, et le nettoyeur écarte les valeurs nulles. Voir la loi
    // en tête de domain/quetes.js.
    if (suivant > 0) r[appareil] = suivant;
    else delete r[appareil];

    ctx.collection.majQuetes({ parties: { ...carnet.parties, [cle]: { ...part, r } } });
    ctx.sync.schedule(t("compteur de chasse"));
    // Tres discret, et fortement limite : ce bouton se presse des centaines de
    // fois d affilee. Voir la regle des volumes en tete de ui/sons.js.
    jouer("compteur");
    rafraichirCompteur();
    renderStats(statsRoot, ctx);
  }

  function complete(done) {
    const { quest } = ctx.store.state;
    if (done && quest) {
      const species = ctx.dataset.byId.get(quest.id);
      const game = ctx.dataset.gamesByCode.get(quest.game);
      const method = ctx.planner.methodFor(quest.game, species);
      const chasse = chasseCourante();
      const rencontres = chasse ? totalPartie(chasse.part) : 0;

      ctx.collection.mark(species.id, "sm");
      jouer("quete");

      // La chasse passe à « prise » au lieu d'être supprimée : sous une fusion
      // par union, une suppression est ressuscitée par l'appareil qui ne l'a pas
      // vue. Le statut, lui, est un treillis — il ne redescend jamais.
      if (chasse) {
        ctx.collection.majQuetes({
          parties: {
            ...ctx.collection.quetes.parties,
            [chasse.cle]: { ...chasse.part, s: "prise", f: Date.now() },
          },
        });
      }

      // Valider une quete coche une case comme n'importe quel clic : elle doit
      // donc partir vers le depot. `onCollectionChange` ne fait que repeindre,
      // c'est `onToggle` qui programme l'ecriture — d'ou cet appel explicite.
      ctx.sync.schedule(`${species.name} shiny (quête)`);
      ctx.store.set((s) => ({
        questDone: s.questDone + 1,
        questLog: [
          // `code` en plus du nom : le journal retrouvait le jeu en comparant son
          // NOM, ce qui n a marche que par chance — le nom stocke est le francais
          // brut des donnees, jamais la version traduite. Le code, lui, ne depend
          // d aucune langue. Le nom reste pour les entrees deja ecrites.
          { id: species.id, name: species.name, game: game.name, code: game.code, method: method.name, rencontres },
          ...s.questLog,
        ].slice(0, 8),
      }));
      ctx.onCollectionChange(species.id);
    } else {
      // Rien a compter : « quetes passees » n est plus affiche depuis que la
      // barre de compteurs dit des choses plus utiles — chromatiques, chasses
      // en cours, rencontres cumulees. Le son suffit a accuser reception.
      jouer("passe");
    }
    ctx.store.set({ quest: tirer() });
  }

  /**
   * Met à jour le compteur SUR PLACE, sans reconstruire la carte.
   *
   * `dessiner()` remplace tout le contenu de la carte. Appelé à chaque « +1 »,
   * il détruisait le bouton qui avait le focus — donc, au clavier, il fallait
   * re-tabuler entre chaque rencontre sur un bouton qu'on presse des centaines
   * de fois. Il recréait aussi le sprite, un `<img>` distant qui repartait sans
   * image décodée : le plus gros élément de la carte clignotait à chaque appui.
   * Et la transition de la jauge ne jouait jamais, un élément neuf n'ayant pas
   * d'état de départ d'où partir.
   */
  function rafraichirCompteur() {
    const { quest } = ctx.store.state;
    if (!quest) return;
    const species = ctx.dataset.byId.get(quest.id);
    if (!species) return;
    const m = mesureChasse(ctx.planner.methodFor(quest.game, species), chasseCourante());

    const nombre = card.querySelector(".chasse__n");
    const remplissage = card.querySelector(".chasse__jauge-fill");
    const jauge = card.querySelector(".chasse__jauge");
    const note = card.querySelector(".chasse__note");
    if (nombre) nombre.textContent = String(m.n);
    if (remplissage) remplissage.style.width = `${Math.min(100, m.pct)}%`;
    if (jauge) jauge.setAttribute("aria-label", m.chance);
    if (note) note.textContent = m.note;
  }

  /** Redessine la carte seule, sans toucher au reste de l'onglet. */
  function dessiner() {
    const { quest } = ctx.store.state;
    const species = quest && ctx.dataset.byId.get(quest.id);
    const game = quest && ctx.dataset.gamesByCode.get(quest.game);
    if (!species || !game) {
      fill(card, emptyQuest(ctx, complete));
      return;
    }
    fill(card, questBody(species, game, ctx, complete, chasseCourante(), compter));
  }

  return {
    render() {
      const state = ctx.store.state;
      renderStats(statsRoot, ctx);
      renderLog(logRoot, state.questLog, ctx);
      dessiner();
    },
  };
}


/* ------------------------------ carte quete ------------------------------ */

function questBody(species, game, ctx, complete, chasse, compter) {
  const { dataset, planner, store } = ctx;
  const method = planner.methodFor(game.code, species);
  const c1 = dataset.types[species.types[0]] || "#8b8b8b";
  const c2 = dataset.types[species.types[1]] || c1;
  const poolSize = planner.questGames(species).length;

  const fragment = document.createDocumentFragment();

  const head = el(
    "div.quest__head",
    { "--c1": c1, "--c2": c2 },
    el("span.quest__kicker", t("Quête en cours · méthode la plus simple")),
    el(
      "div.quest__hero",
      spriteImg(species.id, {
        shiny: true,
        alt: `${nomEspece(species)} ${t("chromatique")}`,
        className: "quest__img",
      }),
      el(
        "div.quest__id",
        el("div.quest__num", dexNumber(species.id)),
        el("h2.quest__name", `✦ ${nomEspece(species)}`),
        el(
          "p.quest__where",
          // L'emblème du jeu avant son nom. `.filter(Boolean)` parce qu'un code
          // sans symbole rend `null` : le jeu s'affiche alors sans emblème au
          // lieu de casser la ligne.
          [`${t("dans")} `, embleme(game.code, 26), el("strong", t(game.name))].filter(Boolean)
        ),
        el(
          "div.detail__chips",
          // `type` et non `t` : une variable nommee `t` masquerait la fonction
          // de traduction dans cette portee.
          species.types.map((type) => typeChip(type, dataset.types[type] || "#8b8b8b", "lg"))
        )
      )
    )
  );

  const body = el(
    "div.quest__body",
    compteurDeChasse(method, chasse, compter),
    el(
      "div.quest__facts",
      el(
        "div.quest__fact",
        el("div.quest__fact-key", t("Méthode")),
        el("div.quest__fact-val", method.name)
      ),
      el(
        "div.quest__fact.quest__fact--odds",
        el("div.quest__fact-key", t("Taux")),
        el("div.quest__fact-val.quest__fact-val--odds", method.odds),
        el(
          "div.quest__fact-note",
          `${t("Meilleur taux disponible parmi les")} ${poolSize} ${tn(poolSize, "jeu", "jeux")} ${t("où ce shiny est huntable.")}`
        )
      )
    ),
    el(
      "div",
      el("h3.panel__label", t("Comment procéder")),
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
            ? t("Où le trouver dans ce jeu")
            : `${t("Repère général — vérifie la zone équivalente dans")} ${t(game.name)}`
        ),
        el("div.info__text", species.where)
      )
      : null,
    el(
      "div.quest__actions",
      el(
        "button.btn.btn--wide.quest__done",
        { type: "button", onclick: () => complete(true) },
        t("✦ Shiny obtenu — quête terminée")
      ),
      el("button.btn.btn--ghost", { type: "button", onclick: () => complete(false) }, t("Passer")),
      el(
        "button.btn.btn--ghost",
        {
          type: "button",
          onclick: () => store.set({ tab: "dex", selectedId: species.id }),
        },
        t("Voir la fiche")
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
      el("span.quest__kicker", t("Aucune quête disponible")),
      el("h2.quest__name", { style: { marginTop: "8px" } }, t("Rien à chasser pour l'instant"))
    ),
    el(
      "div.quest__body",
      el(
        "p.info__text",
        `${t("Les quêtes se tirent parmi les")} ${documented} ${t("espèces dont la disponibilité par jeu est renseignée dans data/details/. Soit tous leurs shinies sont cochés, soit il faut enrichir ces fichiers pour élargir le vivier.")}`
      ),
      el(
        "div.quest__actions",
        el("button.btn", { type: "button", onclick: () => complete(false) }, t("Retirer une quête")),
        el(
          "button.btn.btn--ghost",
          { type: "button", onclick: () => ctx.store.set({ tab: "dex" }) },
          t("Retour au Pokédex")
        )
      )
    )
  );
  return fragment;
}

/**
 * Le nom a montrer dans le journal.
 *
 * Le journal garde le nom tel qu'il etait au moment de la capture — c'est une
 * archive, et on n'y touche pas. Mais l'AFFICHER en francais sous une interface
 * anglaise n'aurait aucun sens : on retrouve donc l'espece par son numero et on
 * montre son nom dans la langue courante. Le nom archive reste le repli, pour
 * une espece qui aurait disparu du jeu de donnees.
 */
function nomJournal(entree, ctx) {
  const espece = ctx.dataset.byId.get(entree.id);
  return espece ? nomEspece(espece) : entree.name;
}

/* ------------------------------- journal --------------------------------- */

function renderLog(root, entries, ctx) {
  if (!entries.length) {
    fill(
      root,
      el(
        "p.log__empty",
        t(
          "Aucune quête terminée pour l'instant. Attrape le shiny demandé, puis valide — une nouvelle cible est tirée aussitôt."
        )
      )
    );
    return;
  }
  fill(
    root,
    el(
      "div.log",
      entries.map((entry) => {
        // Par le code quand il est la, par le nom pour les entrees d avant.
        const jeu =
          (entry.code && ctx.dataset.gamesByCode.get(entry.code)) ||
          [...ctx.dataset.gamesByCode.values()].find((g) => g.name === entry.game);
        return el(
          "div.log__item",
          spriteImg(entry.id, { shiny: true, alt: nomJournal(entry, ctx), className: "log__img" }),
          el(
            "div.log__corps",
            el("div.log__name", `✦ ${nomJournal(entry, ctx)}`),
            el(
              "div.log__meta",
              [
                jeu ? embleme(jeu.code, 16) : null,
                `${t(entry.game)} · ${entry.method}`,
              ].filter(Boolean)
            )
          ),
          // Le nombre de rencontres qu'a pris la prise. Absent des entrées
          // d'avant le compteur : on n'affiche alors rien plutôt qu'un zéro,
          // qui aurait laissé croire à une chance insolente.
          entry.rencontres ? el("span.log__n", String(entry.rencontres)) : null
        );
      })
    )
  );
}

/**
 * Le compteur de rencontres — la pièce centrale de la carte.
 *
 * C'est le seul nombre de tout l'onglet qui bouge pendant qu'on joue ; tout le
 * reste est un bilan. Il est donc grand, et les boutons sont larges : on appuie
 * dessus des centaines de fois, souvent sans regarder.
 *
 * La barre dit la probabilité d'avoir DÉJÀ réussi après n essais, pas celle que
 * le prochain soit le bon — celle-là ne bouge jamais, et les confondre est
 * l'erreur classique du chasseur. Le libellé le dit en toutes lettres.
 */
/**
 * Les trois chiffres du compteur, calculés une seule fois.
 *
 * Partagé entre la construction de la carte et son rafraîchissement : sans ce
 * partage, la formule de la probabilité aurait vécu à deux endroits, et la
 * médiane à deux endroits aussi.
 */
function mesureChasse(method, chasse) {
  const n = chasse ? totalPartie(chasse.part) : 0;
  const denominateur = oddsValue(method.odds);
  const pct = Math.round(chanceCumulee(n, denominateur) * 100);
  // La médiane : le nombre d'essais après lequel une chasse sur deux a abouti.
  // Plus parlant que la moyenne, qu'une longue traîne tire vers le haut.
  const mediane = Number.isFinite(denominateur)
    ? Math.ceil(Math.log(0.5) / Math.log(1 - 1 / denominateur))
    : null;
  const chance = `${pct} % ${t("de chance d'avoir déjà réussi")}`;
  return { n, pct, chance, note: mediane ? `${chance} · ${t("médiane")} ${mediane}` : chance };
}

function compteurDeChasse(method, chasse, compter) {
  const m = mesureChasse(method, chasse);

  return el(
    "section.chasse",
    el(
      "div.chasse__tete",
      el("span.chasse__cle", t("Rencontres")),
      // `aria-live` : le compte est la seule chose qui bouge quand on appuie, et
      // rien ne l'annonçait. « polite » et non « assertive » — on n'interrompt
      // pas quelqu'un pour lui dire 41.
      el("span.chasse__n", { "aria-live": "polite" }, String(m.n))
    ),
    el(
      "div.chasse__jauge",
      { role: "img", "aria-label": m.chance },
      el("span.chasse__jauge-fill", { style: { width: `${Math.min(100, m.pct)}%` } })
    ),
    el("p.chasse__note", m.note),
    el(
      "div.chasse__boutons",
      el(
        "button.btn.chasse__plus",
        { type: "button", onclick: () => compter(1), title: t("Une rencontre de plus") },
        "+1"
      ),
      el("button.btn.btn--ghost", { type: "button", onclick: () => compter(10) }, "+10"),
      el(
        "button.btn.btn--ghost",
        { type: "button", onclick: () => compter(-1), title: t("Corriger une frappe en trop") },
        "−1"
      )
    )
  );
}

/**
 * Les quatre compteurs de tête.
 *
 * Trois viennent de la collection et se DÉDUISENT — chromatiques, chasses
 * ouvertes, rencontres cumulées ; le quatrième, les quêtes accomplies, vient de
 * la session. C'est volontaire : les trois premiers décrivent la collection et
 * doivent être vrais partout, le dernier décrit ce qu'on a fait aujourd'hui.
 *
 * « Rencontres cumulées » compte TOUTES les colonnes de toutes les parties,
 * celles des autres appareils comprises. C'est le seul chiffre du site qui dise
 * le temps passé plutôt que le résultat obtenu, et c'est pour ça qu'il vaut la
 * peine : une collection ne montre que ce qu'on a fini.
 */
function renderStats(root, ctx) {
  if (!root) return;
  const p = progressOf(ctx.dataset.species, ctx.collection);
  const carnet = ctx.collection.quetes;
  const ouvertes = chassesOuvertes(carnet).size;
  const cumul = Object.values(carnet.parties || {}).reduce((s, part) => s + totalPartie(part), 0);

  const cases = [
    { cle: t("Chromatiques"), val: p.shiny.done, note: `/ ${p.shiny.total}`, fort: true },
    { cle: t("Quêtes accomplies"), val: ctx.store.state.questDone },
    { cle: t("Chasses en cours"), val: ouvertes },
    { cle: t("Rencontres comptées"), val: cumul },
  ];

  fill(
    root,
    cases.map((c) =>
      el(
        "div.qstat" + (c.fort ? ".qstat--fort" : ""),
        el("span.qstat__cle", c.cle),
        el(
          "span.qstat__val",
          String(c.val),
          c.note ? el("span.qstat__note", ` ${c.note}`) : null
        )
      )
    )
  );
}
