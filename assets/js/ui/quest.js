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
import { lieuEspece, nomEspece, t, tn } from "../core/i18n.js";
import { oddsValue } from "../domain/hunt.js";
import { progressOf } from "../domain/progress.js";
import { jouer } from "./sons.js";
import { isTyping } from "./shortcuts.js";
import { embleme, emblemePaire } from "./symboles-jeux.js";
import {
  chassesOuvertes,
  chanceCumulee,
  chassesDeLaPaire,
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

  /**
   * La chasse en cours pour la quête affichée, ou `null` si aucune.
   *
   * `cle` DÉSIGNE la chasse — c'est elle qui reçoit les « +1 » —, tandis que
   * `cles` et `total` couvrent toutes celles ouvertes sur la même paire. Les
   * deux ne coïncident que sur un seul appareil : dès qu'un second a compté
   * hors ligne, il a ouvert sa propre clé, et n'additionner que la désignée
   * effaçait ses rencontres de l'écran. Voir `chassesDeLaPaire`.
   */
  function chasseCourante() {
    const { quest } = ctx.store.state;
    if (!quest) return null;
    const carnet = ctx.collection.quetes;
    const vue = chassesOuvertes(carnet).get(quest.id);
    if (!vue) return null;
    const cles = chassesDeLaPaire(carnet, quest.id, vue.jeu);
    return {
      cle: vue.cle,
      part: carnet.parties[vue.cle],
      cles,
      total: cles.reduce((somme, c) => somme + totalPartie(carnet.parties[c]), 0),
      // L'objectif le plus élevé des parties de la paire. Il vit sur la chasse
      // désignée dans le cas normal, mais deux appareils ont pu en poser deux —
      // la jointure garde alors le plus grand, et l'écran doit dire la même
      // chose qu'elle.
      objectif: cles.reduce((max, c) => Math.max(max, carnet.parties[c].o || 0), 0) || null,
    };
  }

  /**
   * Fixer, changer ou retirer l'objectif de la chasse en cours.
   *
   * « 41 rencontres » ne dit rien tout seul. La probabilité cumulée aide, mais
   * elle ne se termine jamais : elle approche 100 % sans l'atteindre, et une
   * chasse n'a donc aucune ligne d'arrivée. Un objectif en donne une — « je
   * m'arrête à 500 » — et transforme un compteur qui monte en une barre qui se
   * remplit.
   *
   * `prompt` plutôt qu'un champ dans la carte : le geste est rare — une fois par
   * chasse — et un champ permanent aurait pris la place des boutons qu'on presse
   * des centaines de fois. Le site emploie déjà `confirm` et `alert` ailleurs.
   *
   * Vider le champ RETIRE l'objectif. Il faut pouvoir revenir en arrière, et un
   * objectif qu'on ne peut plus enlever devient une dette.
   */
  function fixerObjectif() {
    const chasse = chasseCourante();
    if (!chasse) return;

    const reponse = window.prompt(
      t("Objectif de rencontres pour cette chasse ? Laisse vide pour l'enlever."),
      chasse.objectif ? String(chasse.objectif) : ""
    );
    if (reponse === null) return;

    const valeur = Math.floor(Number(reponse.trim()));
    const part = ctx.collection.quetes.parties[chasse.cle];
    const suivant = { ...part };
    if (reponse.trim() === "" || !Number.isFinite(valeur) || valeur <= 0) delete suivant.o;
    else suivant.o = Math.min(100000, valeur);

    ctx.collection.majQuetes({ parties: { ...ctx.collection.quetes.parties, [chasse.cle]: suivant } });
    ctx.sync.schedule(t("objectif de chasse"));
    jouer("theme");
    dessiner();
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
    // Rien à retirer d'une chasse qui n'existe pas encore. Sans ce garde-fou, un
    // « −1 » posé avant le premier « +1 » ouvrait une partie à compteur vide :
    // `chassesOuvertes` l'écarte ensuite, puisqu'elle n'a aucune rencontre, donc
    // le « +1 » suivant en ouvrait une NOUVELLE — et l'ancienne restait dans le
    // carnet pour toujours, une union ne supprimant rien.
    if (!ouverte && delta <= 0) return;
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
    renderStats(statsRoot, ctx, remettreLeCompte);
  }

  /**
   * Compter à la BARRE D'ESPACE, et en la maintenant.
   *
   * Une chasse, c'est des centaines d'appuis sur le même bouton. Viser une
   * cible de quarante pixels à chaque rencontre, pendant deux heures, use plus
   * que la chasse elle-même — et sur un ordinateur, la main quitte le clavier à
   * chaque fois.
   *
   * LE MAINTIEN EST GRATUIT : le navigateur répète déjà `keydown` tant que la
   * touche est enfoncée. On ne filtre donc pas `event.repeat`, et garder la
   * barre appuyée fait défiler le compteur. Le limiteur de `ui/sons.js` s'occupe
   * du bruit — un tic toutes les 40 ms au plus, pas un par rencontre.
   *
   * `preventDefault` est obligatoire : la barre d'espace fait défiler la page,
   * et la carte serait partie vers le bas dès le premier appui.
   *
   * Trois gardes : seulement sur l'onglet des quêtes, jamais dans un champ de
   * saisie, et jamais avec un modificateur — Ctrl+Espace appartient au système.
   */
  document.addEventListener("keydown", (event) => {
    if (ctx.store.state.tab !== "quest") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;

    const delta = event.key === " " || event.key === "+" ? 1 : event.key === "-" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    compter(delta);
  });

  function complete(done) {
    const { quest } = ctx.store.state;
    if (done && quest) {
      const species = ctx.dataset.byId.get(quest.id);
      const game = ctx.dataset.gamesByCode.get(quest.game);
      const method = ctx.planner.methodFor(quest.game, species);
      const chasse = chasseCourante();
      const rencontres = chasse ? chasse.total : 0;

      ctx.collection.mark(species.id, "sm");
      jouer("quete");

      // La chasse passe à « prise » au lieu d'être supprimée : sous une fusion
      // par union, une suppression est ressuscitée par l'appareil qui ne l'a pas
      // vue. Le statut, lui, est un treillis — il ne redescend jamais.
      //
      // TOUTES les chasses de la paire, et non la seule désignée : quand deux
      // appareils en ont ouvert chacun une, n'en fermer qu'une laissait l'autre
      // « en cours » pour toujours. Elle ne se serait jamais refermée — la
      // quête, elle, disparaît du tirage dès que le chromatique est coché — et
      // « Chasses en cours » aurait compté un fantôme à chaque prise.
      if (chasse) {
        const fin = Date.now();
        const parties = { ...ctx.collection.quetes.parties };
        for (const cle of chasse.cles) {
          parties[cle] = { ...parties[cle], s: "prise", f: fin };
        }
        ctx.collection.majQuetes({ parties });
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
          // DEUX CENTS et non huit. Le plafond d'origine tenait au rendu — huit
          // lignes suffisent à l'écran —, mais il jetait l'histoire avec :
          // passé la huitième prise, la neuvième d'avant disparaissait sans
          // qu'on puisse la revoir, et avec elle le nombre de rencontres qu'elle
          // avait coûté. C'est justement ce qu'on veut relire des mois plus
          // tard.
          //
          // Deux cents entrées pèsent une vingtaine de kilo-octets dans le
          // localStorage, qui en accepte cinq mille. Le rendu, lui, n'en montre
          // toujours que huit — le reste se déplie (voir `renderLog`).
        ].slice(0, 200),
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

  /**
   * Retire une entrée du journal.
   *
   * Le journal n'est qu'une trace : il ne coche rien, et l'oublier ne DÉCOCHE
   * pas le chromatique — la case reste dans la collection, seule la ligne
   * disparaît. C'est ce qui rend le geste sans danger, et ce que dit son
   * libellé : « oublier », pas « supprimer ».
   *
   * L'index et non l'espèce : on peut avoir chassé deux fois le même Pokémon,
   * et retirer la mauvaise ligne serait plus agaçant que de ne pas pouvoir.
   */
  /**
   * Remet « Quêtes accomplies » à zéro, journal compris.
   *
   * Ce compteur ne se recalcule à partir de rien : il s'incrémente à chaque
   * validation et rien d'autre ne le touche. « Oublier » une ligne le
   * décrémente désormais, mais le journal ne garde que huit prises — passé ce
   * seuil, un compte faux n'avait plus aucun moyen de redescendre.
   *
   * Le JOURNAL part avec lui : laisser des lignes sous un compteur à zéro
   * aurait recréé, dans l'autre sens, l'écart qu'on vient de corriger.
   *
   * Une confirmation, parce que c'est le seul geste du site qui efface
   * franchement quelque chose sans que « Annuler » puisse le rattraper — le
   * bandeau d'annulation ne connaît que les cases. Même choix que pour l'oubli
   * du jeton dans ui/save.js.
   *
   * Rien ne part vers le dépôt : ce compteur vit dans le localStorage de ce
   * navigateur, il n'a jamais été synchronisé.
   */
  function remettreLeCompte() {
    if (!window.confirm(t("Remettre « Quêtes accomplies » à zéro et vider le journal ?"))) return;
    ctx.store.set({ questDone: 0, questLog: [] });
    jouer("annuler");
  }

  function oublierDuJournal(index) {
    ctx.store.set((s) => ({
      questLog: s.questLog.filter((_, i) => i !== index),
      // Le compteur suit la ligne. « Oublier » une prise, c'est dire qu'elle ne
      // compte plus ; laisser le total derrière affichait « 12 quêtes
      // accomplies » au-dessus d'un journal qui n'en montrait que onze, et
      // l'écart ne se rattrapait plus jamais.
      //
      // `Math.max(0, …)` parce que les deux ne mesurent pas la même chose : le
      // journal ne garde que les huit dernières lignes, le compteur garde tout.
      // Rien n'interdit donc à un état venu d'ailleurs — un import, une reprise
      // partielle — de porter plus de lignes que de quêtes comptées, et un
      // compteur négatif n'aurait aucun sens.
      questDone: Math.max(0, s.questDone - 1),
    }));
    jouer("annuler");
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
    fill(card, questBody(species, game, ctx, complete, chasseCourante(), compter, fixerObjectif));
  }

  return {
    render() {
      const state = ctx.store.state;
      renderStats(statsRoot, ctx, remettreLeCompte);
      renderLog(logRoot, state.questLog, ctx, oublierDuJournal);
      dessiner();
    },
  };
}


/* ------------------------------ carte quete ------------------------------ */

function questBody(species, game, ctx, complete, chasse, compter, objectif) {
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
        el("p.quest__where", [`${t("dans")} `, el("strong", t(game.name))]),
        el(
          "div.detail__chips",
          // `type` et non `t` : une variable nommee `t` masquerait la fonction
          // de traduction dans cette portee.
          species.types.map((type) => typeChip(type, dataset.types[type] || "#8b8b8b", "lg"))
        )
      ),
      // Le logo du jeu, GRAND et à droite. Il était glissé dans la ligne
      // « dans … » à seize pixels, où il ne se lisait pas et encombrait une
      // phrase. Ici il a la place d'être reconnu d'un coup d'œil, et c'est bien
      // ce qu'un logo sert à faire : dire de quel jeu il s'agit sans le lire.
      logoDuJeu(game)
    )
  );

  const body = el(
    "div.quest__body",
    compteurDeChasse(method, chasse, compter, objectif),
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
        el("div.info__text", lieuEspece(species.where))
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

function renderLog(root, entries, ctx, oublier) {
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
  // Huit lignes à l'écran, le reste replié. Le journal garde deux cents prises
  // (voir le plafond dans `complete`), mais les dérouler toutes pousserait la
  // carte de quête hors de portée — et c'est elle qu'on vient voir.
  const VISIBLES = 8;
  const dessus = entries.slice(0, VISIBLES);
  const dessous = entries.slice(VISIBLES);

  fill(
    root,
    el(
      "div.log",
      dessus.map((entry, index) => ligneDuJournal(entry, index, ctx, oublier)),
      // `<details>` et non un bouton : le navigateur gère l'ouverture, l'état
      // au clavier et l'annonce aux lecteurs d'écran sans une ligne de script.
      dessous.length
        ? el(
            "details.log__reste",
            el(
              "summary.log__reste-titre",
              `${dessous.length} ${tn(dessous.length, "prise plus ancienne", "prises plus anciennes")}`
            ),
            // L'index repart de `VISIBLES` : `oublier` travaille sur la position
            // dans le tableau complet, pas dans la tranche affichée. Sans ce
            // décalage, oublier la neuvième ligne en retirait la première.
            dessous.map((entry, i) => ligneDuJournal(entry, i + VISIBLES, ctx, oublier))
          )
        : null
    )
  );
}

/**
 * Une ligne du journal.
 *
 * `index` est la position dans le tableau COMPLET, pas dans la tranche
 * affichée : c'est lui que reçoit `oublier`, et les lignes repliées sont
 * décalées de huit.
 */
function ligneDuJournal(entry, index, ctx, oublier) {
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
      el("div.log__meta", `${t(entry.game)} · ${entry.method}`)
    ),
    // Le nombre de rencontres qu'a pris la prise. Absent des entrées d'avant le
    // compteur : on n'affiche alors rien plutôt qu'un zéro, qui aurait laissé
    // croire à une chance insolente.
    entry.rencontres ? el("span.log__n", String(entry.rencontres)) : null,
    // Les logos du jeu, à droite et en grand.
    logoDuJournal(jeu),
    // Oublier la ligne. Elle ne DÉCOCHE rien : le chromatique reste dans la
    // collection, c'est la trace qui disparaît. D'où « oublier » et non
    // « supprimer » — le mot dit ce que le geste fait vraiment.
    el(
      "button.log__oubli",
      {
        type: "button",
        title: t("Oublier cette prise du journal"),
        "aria-label": `${t("Oublier cette prise du journal")} — ${nomJournal(entry, ctx)}`,
        onclick: () => oublier(index),
      },
      "✕"
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
  // `chasse.total` et non `totalPartie(chasse.part)` : la somme de TOUTES les
  // chasses ouvertes sur la paire, pas seulement celle qui est designee.
  const n = chasse ? chasse.total : 0;
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

function compteurDeChasse(method, chasse, compter, objectif) {
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
    // L'OBJECTIF, quand il y en a un. Une seconde barre et non un repère sur la
    // première : celle du dessus dit une probabilité, celle-ci un décompte. Deux
    // sens sur une même jauge se confondent.
    chasse && chasse.objectif
      ? el(
          "div.chasse__objectif",
          el(
            "div.chasse__objectif-tete",
            el("span", t("Objectif")),
            el(
              "span.chasse__objectif-n",
              `${m.n} / ${chasse.objectif}`
            )
          ),
          el(
            "div.chasse__jauge.chasse__jauge--objectif",
            { role: "img", "aria-label": `${m.n} ${t("sur")} ${chasse.objectif}` },
            el("span.chasse__jauge-fill", {
              style: { width: `${Math.min(100, Math.round((m.n / chasse.objectif) * 100))}%` },
            })
          ),
          el(
            "p.chasse__note",
            m.n >= chasse.objectif
              ? t("Objectif atteint.")
              : `${t("Encore")} ${chasse.objectif - m.n}`
          )
        )
      : null,
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
      ),
      el(
        "button.btn.btn--ghost.chasse__cible",
        {
          type: "button",
          onclick: objectif,
          title: t("Se fixer un nombre de rencontres à atteindre"),
        },
        chasse && chasse.objectif ? `◎ ${chasse.objectif}` : "◎"
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
function renderStats(root, ctx, remettre) {
  if (!root) return;
  const p = progressOf(ctx.dataset.species, ctx.collection);
  const carnet = ctx.collection.quetes;
  const ouvertes = chassesOuvertes(carnet).size;
  const cumul = Object.values(carnet.parties || {}).reduce((s, part) => s + totalPartie(part), 0);

  const cases = [
    { cle: t("Chromatiques"), val: p.shiny.done, note: `/ ${p.shiny.total}`, fort: true },
    // Le SEUL compteur qu'on puisse remettre à zéro, et le seul qui en ait
    // besoin : les trois autres se recalculent depuis la collection ou depuis
    // le carnet, donc ils ne peuvent pas se tromper. Celui-ci n'a pas de source
    // — il s'incrémente et rien ne le corrige. Une validation de trop restait
    // là pour toujours dès que le journal, qui ne garde que huit lignes, ne
    // portait plus la prise correspondante.
    { cle: t("Quêtes accomplies"), val: ctx.store.state.questDone, remise: true },
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
        ),
        // Le bouton n'apparaît qu'à partir de 1 : remettre zéro à zéro n'a
        // aucun sens, et un bouton mort sur une tuile vide n'aurait fait
        // qu'encombrer.
        c.remise && remettre && c.val > 0
          ? el(
              "button.qstat__raz",
              {
                type: "button",
                title: t("Remettre le compte à zéro"),
                "aria-label": t("Remettre le compte à zéro"),
                onclick: remettre,
              },
              "↺"
            )
          : null
      )
    )
  );
}

/**
 * Le logo d'un jeu, en grand, pour le bandeau de la quête.
 *
 * LES DEUX versions du couple : « Ultra-Soleil / Ultra-Lune » est un couple, et
 * n'en montrer qu'un revenait à n'en nommer qu'un. Ici la place le permet ;
 * dans le tableau de disponibilité, à vingt pixels sur vingt-trois lignes, on
 * n'en garde qu'un.
 *
 * `null` quand le jeu n'a pas de logo : le bandeau se referme alors sur le
 * sprite et le nom, sans trou.
 */
function logoDuJeu(game) {
  const boite = emblemePaire(game.code, 60);
  if (!boite) return null;
  boite.classList.add("quest__logo");
  return boite;
}

/** Les logos d'un jeu pour une ligne du journal. `null` s'il n'en a pas. */
function logoDuJournal(jeu) {
  if (!jeu) return null;
  const boite = emblemePaire(jeu.code, 30);
  if (!boite) return null;
  boite.classList.add("log__logo");
  return boite;
}
