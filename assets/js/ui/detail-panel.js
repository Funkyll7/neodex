/**
 * detail-panel.js — la fiche de droite.
 *
 * Sections, dans l'ordre : entete, ma collection, formes alternatives,
 * disponibilite par jeu, shiny hunt jeu par jeu, fiche d'origine, statistiques.
 *
 * Deux rendus distincts, et c'est important :
 *   - `render()` reconstruit tout — on a change de Pokemon ;
 *   - `syncMarks()` ne fait que remettre a jour les `aria-pressed` — on vient de
 *     cocher une case.
 * Reconstruire la fiche a chaque clic detruisait le bouton sous le doigt : le
 * navigateur perdait le focus, et l'evenement suivant pouvait retomber sur un
 * bouton fraichement recree au meme endroit — la case se recochait toute seule.
 * D'ou aussi l'ecoute deleguee : un seul ecouteur, pose sur #detail, qui survit
 * a tous les rendus.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { spriteImg, formImg, cosmeticImg } from "../domain/sprites.js";
import { availabilityRows, huntableGames } from "../domain/availability.js";
import { completionOf } from "../domain/completion.js";
import { dexNumber, typeChip, pokepediaUrl, bulbapediaUrl } from "./common.js";
import { nomEspece, nomCategorie, nomForme, enAnglais, t, tn } from "../core/i18n.js";

export function createDetailPanel(ctx) {
  const root = document.getElementById("detail");
  const sheet = createSheet(root, ctx);
  let shownId = null;

  // Un seul ecouteur pour toutes les cases de la fiche, pose une fois pour
  // toutes : aucun bouton ne porte plus son propre `onclick`.
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slot]");
    if (!button || !root.contains(button)) return;
    ctx.onToggle(Number(button.dataset.species), button.dataset.slot);
  });

  return {
    /** Ouvre la feuille mobile sans rien redessiner. */
    open: () => sheet.open(),
    close: () => sheet.close(),

    /** Une case vient d'etre cochee : on retouche, on ne reconstruit pas. */
    syncMarks(species) {
      if (shownId !== species.id) return;
      for (const button of root.querySelectorAll("[data-slot]")) {
        button.setAttribute(
          "aria-pressed",
          String(ctx.collection.has(Number(button.dataset.species), button.dataset.slot))
        );
      }
      // Une tuile devient « terminée » ou cesse de l'être : on retourne la
      // classe, on ne reconstruit pas. Les cases sont listées sur la tuile
      // elle-même, il n'y a donc rien à recalculer côté données.
      for (const tuile of root.querySelectorAll(".ftile[data-slots]")) {
        const slots = tuile.dataset.slots.split(" ").filter(Boolean);
        const id = Number(tuile.dataset.species);
        const done = slots.length > 0 && slots.every((s) => ctx.collection.has(id, s));
        tuile.classList.toggle("ftile--done", done);
      }
      updateHead(root, species, ctx);
      updateCosmeticCount(root, species, ctx);
    },

    /**
     * Les filtres ont bouge sans que le Pokemon change : « suivant » ne
     * designe plus la meme fiche. On remplace les deux fleches, et elles
     * seules — reconstruire l'en-tete entier serait deja trop.
     */
    refreshSteps(species) {
      if (shownId !== species.id) return;
      const old = root.querySelector(".detail__steps");
      if (old) old.replaceWith(stepper(species, ctx));
    },

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

      // Tant qu'on reste sur le meme Pokemon, on remet l'utilisateur exactement
      // ou il etait : meme position de defilement, memes methodes depliees.
      const sameSpecies = shownId === species.id;
      const scroll = sameSpecies ? root.scrollTop : 0;
      const opened = sameSpecies ? openedGroups(root) : null;

      fill(
        root,
        head(species, ctx, c1),
        collectionSection(species, ctx),
        cosmeticSection(species, ctx),
        cosmeticNotes(species, ctx),
        formsSection(species, ctx),
        availabilitySection(species, ctx),
        huntSection(species, ctx),
        infoSection(species, ctx),
        statsSection(species, ctx)
      );

      if (opened) restoreGroups(root, opened);
      root.scrollTop = scroll;

      // Annonce courte pour les lecteurs d'ecran, a la place de la relecture
      // integrale de la fiche. Seulement quand on change vraiment de Pokemon :
      // repeindre les memes cases n'est pas un evenement.
      if (!sameSpecies) announce(species, ctx);
      shownId = species.id;

      // Choisir une vignette sur telephone ouvre la feuille par-dessus la
      // grille, au lieu de faire descendre la page de plusieurs milliers de
      // pixels jusqu'a la fiche.
      if (reveal && !sameSpecies) sheet.open();
    },
  };
}

/**
 * Ce qu'un lecteur d'ecran entend quand la fiche change : le nom, le numero,
 * et l'avancement. Le reste est atteignable a la navigation normale — le
 * deverser dans une region live n'aiderait personne.
 */
function announce(species, ctx) {
  const node = document.getElementById("detail-live");
  if (!node) return;
  const progress = completionOf(species, ctx.collection);
  node.textContent =
    `${nomEspece(species)}, ${t("n°")} ${species.id}. ` +
    (progress.complete
      ? `${t("Tout obtenu")}, ${progress.total} ${tn(progress.total, "case", "cases")}.`
      : `${progress.done} ${t("sur")} ${progress.total} ${t("cases cochées")}.`);
}

/* ------------------------- feuille plein ecran --------------------------- */

/**
 * Sur telephone la fiche devient une feuille qui monte du bas.
 * Trois sorties : la croix, le fond assombri, la touche Echap. Le defilement
 * de la page derriere est bloque tant que la feuille est ouverte, sinon on
 * fait defiler la grille en croyant faire defiler la fiche.
 */
function createSheet(root, ctxGlobal) {
  const backdrop = document.getElementById("detail-backdrop");
  const closeButton = document.getElementById("detail-close");
  const mobile = window.matchMedia("(max-width: 860px)");

  /** Ou l'on etait dans la grille, et qui avait le focus, avant l'ouverture. */
  let scroll = 0;
  let origine = null;
  /** Une entree d'historique a-t-elle ete empilee pour cette feuille ? */
  let empile = false;

  const ouverte = () => document.body.classList.contains("sheet-open");

  /**
   * @param {boolean} viaRetour  vrai quand c'est le bouton Retour du
   *   navigateur qui ferme : l'entree d'historique est deja depilee, il ne
   *   faut surtout pas rappeler `history.back()`.
   */
  function close(viaRetour = false) {
    if (!ouverte()) return;
    document.body.classList.remove("sheet-open");
    backdrop.hidden = true;
    closeButton.hidden = true;

    // Le blocage du defilement peut avoir fait remonter la page : on remet
    // l'utilisateur exactement la ou il avait laissé la grille.
    window.scrollTo({ top: scroll, behavior: "auto" });
    if (origine && document.contains(origine)) origine.focus({ preventScroll: true });
    origine = null;

    if (empile && !viaRetour) history.back();
    empile = false;
  }

  function open() {
    if (!mobile.matches || ouverte()) return;
    scroll = window.scrollY;
    origine = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.classList.add("sheet-open");
    backdrop.hidden = false;
    closeButton.hidden = false;
    closeButton.focus({ preventScroll: true });

    // Sur telephone, le reflexe pour refermer un panneau est le bouton Retour.
    // Sans cette entree d'historique, il quittait le site.
    if (!empile) {
      history.pushState({ funkylldexSheet: true }, "");
      empile = true;
    }
  }

  backdrop.addEventListener("click", () => close());
  closeButton.addEventListener("click", () => close());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  window.addEventListener("popstate", () => {
    if (ouverte()) close(true);
  });
  // Repasser en grand ecran alors que la feuille est ouverte la laisserait
  // coincee : la fiche redevient une colonne, on referme.
  mobile.addEventListener("change", (event) => {
    if (!event.matches) close();
  });

  glisser(root, close, ctxGlobal);
  return { open, close };
}

/**
 * Les deux gestes de la feuille.
 *
 *   vers le bas    fermer — le geste attendu pour un panneau qui monte du bas.
 *                  Pris en compte seulement si la fiche est deja tout en haut,
 *                  sinon on l'empecherait de defiler, ce qui sert davantage.
 *   vers le cote   Pokemon precedent / suivant, comme les fleches ‹ › de
 *                  l'en-tete. C'est le geste qu'on cherche instinctivement en
 *                  remontant une boite.
 *
 * Un seul suivi pour les deux : la direction dominante du premier mouvement
 * decide, et l'autre axe est alors ignore jusqu'a la fin du geste. Sans cela,
 * un glissement de biais fermerait la feuille ET changerait de Pokemon.
 */
function glisser(root, close, ctx) {
  const SEUIL = 80;
  let x0 = null;
  let y0 = null;
  let axe = null;

  root.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) return;
      x0 = event.touches[0].clientX;
      y0 = event.touches[0].clientY;
      axe = null;
    },
    { passive: true }
  );

  root.addEventListener(
    "touchmove",
    (event) => {
      if (x0 === null) return;
      const dx = event.touches[0].clientX - x0;
      const dy = event.touches[0].clientY - y0;

      if (!axe && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
        axe = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }

      if (axe === "y") {
        // Vers le haut : on veut lire, pas fermer. Et si la fiche est deja
        // defilee, le geste lui appartient.
        if (dy > SEUIL && root.scrollTop <= 0) {
          x0 = null;
          close();
        }
      } else if (axe === "x" && Math.abs(dx) > SEUIL) {
        const sens = dx < 0 ? 1 : -1;
        x0 = null;
        ctx.onStep(sens);
      }
    },
    { passive: true }
  );

  root.addEventListener("touchend", () => {
    x0 = null;
    axe = null;
  });
}

/** Cles des blocs deplies (methodes de chasse, groupes de formes replies). */
function openedGroups(root) {
  return new Set([...root.querySelectorAll("details[open][data-key]")].map((n) => n.dataset.key));
}

/**
 * On repose l'etat EXACT releve avant la repeinte, ouvert comme ferme.
 *
 * Se contenter de rouvrir ce qui l'etait suffisait tant que tous les replis
 * naissaient fermes. Depuis que certains naissent ouverts — les casquettes de
 * Pikachu, les variantes cosmetiques en general — un repli que l'utilisateur
 * venait de fermer se rouvrait a la premiere repeinte.
 */
function restoreGroups(root, opened) {
  for (const node of root.querySelectorAll("details[data-key]")) {
    node.open = opened.has(node.dataset.key);
  }
}

/* -------------------------------- entete --------------------------------- */

function head(species, ctx) {
  const node = el(
    "header.detail__head",
    el(
      "div.detail__head-row",
      el("span.detail__num", dexNumber(species.id)),
      stepper(species, ctx),
      el("span.detail__tag", { dataset: { role: "tag" } }, "")
    ),
    el("h2.detail__name", nomEspece(species)),
    // La ligne du dessous porte le nom dans l'AUTRE langue, plus la categorie.
    // Symetrique : en francais on lit « Bulbasaur · Pokémon Graine », en anglais
    // « Bulbizarre · Seed Pokémon ». Repeter « Bulbasaur » sous « Bulbasaur »
    // n'aurait rien appris.
    el(
      "p.detail__sub",
      [enAnglais() ? species.name : species.en, nomCategorie(species)].filter(Boolean).join(" · ")
    ),
    el(
      "div.detail__chips",
      species.types.map((type) => typeChip(type, ctx.dataset.types[type] || "#8b8b8b", "lg"))
    ),
    el("p.detail__progress", { dataset: { role: "progress" } }, "")
  );
  fillHead(node, species, ctx);
  return node;
}

/**
 * Les deux fleches ‹ › : le Pokemon precedent et le suivant *dans la liste
 * filtree en cours*, pas dans le Pokedex entier. Filtrer sur « À terminer »
 * puis avancer de fiche en fiche, c'est exactement le geste qu'on repete en
 * remontant une boite de HOME.
 *
 * Le nom du voisin est dans l'infobulle : on sait ou l'on va avant de cliquer.
 * Une extremite de liste desactive le bouton plutot que de le cacher, pour que
 * l'en-tete ne bouge pas d'une fiche a l'autre.
 */
function stepper(species, ctx) {
  const { prev, next } = ctx.neighbours(species.id);
  // Le libelle « aucun voisin » est passe entier plutot que recompose : une
  // fois traduit, « Aucun Pokémon précédent » ne s'obtient plus en minusculant
  // « Précédent », l'anglais placant le mot ailleurs dans la phrase.
  //
  // Le nom du voisin passe par `nomEspece()` et non par `t()` : c'est un nom
  // venu des donnees, qui dort deja dans le champ `en` de l'espece. En
  // francais la fonction rend `target.name` sans rien faire — l'infobulle est
  // donc inchangee.
  const button = (target, delta, glyph, sens, aucun) => {
    const label = target ? `${t(sens)} : ${nomEspece(target)}` : t(aucun);
    return el(
      "button.detail__step",
      {
        type: "button",
        disabled: !target,
        title: label,
        "aria-label": label,
        onclick: () => ctx.onStep(delta),
      },
      glyph
    );
  };
  return el(
    "div.detail__steps",
    button(prev, -1, "‹", "Précédent", "Aucun Pokémon précédent"),
    button(next, 1, "›", "Suivant", "Aucun Pokémon suivant")
  );
}

function updateHead(root, species, ctx) {
  const node = root.querySelector(".detail__head");
  if (node) fillHead(node, species, ctx);
}

/** Le bandeau se met a jour sans etre reconstruit : voir syncMarks(). */
function fillHead(node, species, ctx) {
  const owned = ctx.collection.isOwned(species.id);
  const shiny = ctx.collection.isShiny(species.id);
  const progress = completionOf(species, ctx.collection);

  const tag = node.querySelector('[data-role="tag"]');
  tag.textContent = shiny ? t("✦ Shiny obtenu") : owned ? t("✓ Capturé") : t("Manquant");
  tag.className = owned ? "detail__tag detail__tag--owned" : "detail__tag";

  const bar = node.querySelector('[data-role="progress"]');
  bar.textContent = progress.complete
    ? `${t("★ Tout obtenu")} — ${progress.total} ${tn(progress.total, "case", "cases")}`
    : `${progress.done} / ${progress.total} ${t("cases cochées")}`;
  bar.className = progress.complete ? "detail__progress detail__progress--done" : "detail__progress";
}

/* ---------------------------- ma collection ------------------------------ */

/**
 * Chez la plupart des especes, « Ma collection » = deux ou quatre cases.
 * Chez les Zarbi, Prismillon, Charmilly & co, la forme de base n'existe pas
 * seule : la grille des variantes EST la collection, et sa premiere case est
 * celle de l'espece (`om` / `sm`). On n'affiche donc pas les deux.
 */
function collectionSection(species, ctx) {
  const cosmetic = species.cosmetic;
  if (cosmetic && cosmetic.coversBase) return cosmeticPicker(species, cosmetic, ctx);

  const shiny = !species.noShiny;
  // Note : quand le groupe ne couvre pas la base — les casquettes de Pikachu,
  // qui s'ajoutent a la forme classique au lieu de la remplacer — la grille
  // est rendue juste apres, par cosmeticSection().
  const slots = [["om", species.gd ? t("Normal ♂") : t("Normal"), false, false]];
  if (species.gd) slots.push(["of", t("Normal ♀"), false, true]);
  if (shiny) {
    slots.push(["sm", species.gd ? t("Shiny ♂") : t("Shiny"), true, false]);
    if (species.gd) slots.push(["sf", t("Shiny ♀"), true, true]);
  }

  return el(
    "section.detail__section",
    el(
      "div.detail__row",
      el("h3.panel__label", t("Ma collection")),
      el(
        "span.detail__note",
        species.gd ? t("Formes ♂ / ♀ distinctes") : t("Aucune différence ♂ / ♀")
      )
    ),
    el(
      "p.detail__help",
      species.gd
        ? t("Cette espèce a des apparences mâle et femelle différentes : coche chaque case que tu possèdes. Dès qu'un shiny est coché, la vignette bascule sur sa version chromatique.")
        : t("Coche ce que tu possèdes. Dès que « Shiny » est coché, la vignette bascule sur l'image chromatique.")
    ),
    species.noShiny
      ? el("p.form__shiny.form__shiny--none", `✦ ${noShinyReason(ctx)}`)
      : null,
    el(
      species.gd && shiny ? "div.slots.slots--gendered" : "div.slots",
      slots.map(([slot, label, gold, female]) => slotButton(species, ctx, { slot, label, gold, female }))
    )
  );
}

function noShinyReason(ctx) {
  const rule = ctx.dataset.locks.noShiny || {};
  return rule.why || t("Aucun chromatique de cette espèce n'existe, dans aucun jeu ni aucune distribution.");
}

function slotButton(species, ctx, { slot, label, gold, female }) {
  return el(
    gold ? "button.slot.slot--gold" : "button.slot",
    {
      type: "button",
      "aria-pressed": String(ctx.collection.has(species.id, slot)),
      dataset: { slot, species: species.id },
    },
    el(
      "span.slot__top",
      el(
        female && !gold ? "span.slot__tag.slot__tag--f" : "span.slot__tag",
        gold
          ? el("span.toggle__ico.toggle__ico--shiny", { "aria-hidden": "true" })
          : species.gd
            ? female
              ? "♀"
              : "♂"
            : el("span.toggle__ico.toggle__ico--capture", { "aria-hidden": "true" })
      ),
      el("span.slot__check", "✓")
    ),
    spriteImg(species.id, {
      shiny: gold,
      female: female && Boolean(species.gd),
      alt: `${nomEspece(species)} ${label}`,
      className: "slot__img",
    }),
    el("span.slot__label", label)
  );
}

/* -------------------------- formes cosmetiques --------------------------- */

/**
 * La grille a cocher : une tuile par variante, deux cases par tuile.
 * Les 28 Zarbi, les 20 Prismillon, les 63 Charmilly se cochent d'un coup d'oeil
 * au lieu de defiler sur trois ecrans de fiches.
 */
function cosmeticPicker(species, cosmetic, ctx) {
  const grid = el(
    cosmetic.layout ? `div.picker.picker--${cosmetic.layout}` : "div.picker",
    cosmetic.variants.map((variant) => pickerCell(species, variant, ctx))
  );

  return el(
    "section.detail__section",
    el(
      "div.detail__row",
      el(
        "h3.panel__label",
        cosmetic.coversBase ? `${t("Ma collection")} · ${cosmetic.title}` : cosmetic.title
      ),
      el("span.detail__note", { dataset: { role: "cosmetic-count" } }, cosmeticCount(species, cosmetic, ctx))
    ),
    el(
      "p.detail__help",
      cosmetic.coversBase
        ? t("Chaque variante est une entrée distincte dans HOME : coche le carré du haut pour la version normale, l'étoile du bas pour le chromatique. La première tuile est la forme de base de l'espèce.")
        : t("Chaque variante est une entrée distincte dans HOME, en plus de la forme classique ci-dessus : coche le carré du haut pour la version normale, l'étoile du bas pour le chromatique.")
    ),
    // TOUS les groupes cosmétiques se replient, pas seulement les plus longs :
    // les quatorze casquettes de Pikachu poussaient le reste de la fiche hors
    // de portée sans qu'on puisse les ranger. `fold` ne décide donc plus que
    // de l'état initial — replié pour les 63 Charmilly, déplié pour le reste.
    // La clé `data-key` fait survivre l'état à une repeinte.
    el(
      "details.picker__fold",
      { open: !cosmetic.fold, dataset: { key: `picker-${species.id}` } },
      el(
        "summary.forms__title.forms__title--fold",
        `${cosmetic.variants.length} ${t("variantes")}`
      ),
      grid
    ),
    cosmetic.where ? el("p.form__text", cosmetic.where) : null,
    cosmetic.note ? el("p.form__note", cosmetic.note) : null
  );
}

/**
 * La grille des variantes, en section a elle, quand elle ne remplace pas
 * « Ma collection » : Pikachu garde ses cases ♂ / ♀ classiques, et ses
 * quatorze tenues viennent ensuite.
 */
function cosmeticSection(species, ctx) {
  const cosmetic = species.cosmetic;
  if (!cosmetic || cosmetic.info || cosmetic.coversBase) return null;
  return cosmeticPicker(species, cosmetic, ctx);
}

function cosmeticCount(species, cosmetic, ctx) {
  // Les variantes hors HOME ne comptent pas : les afficher au dénominateur
  // ferait un compteur qui n'atteint jamais son total.
  const countable = cosmetic.variants.filter((v) => v.entry);
  const done = countable.filter((v) => ctx.collection.has(species.id, v.slot)).length;
  return `${done} / ${countable.length} ${t("variantes")}`;
}

function updateCosmeticCount(root, species, ctx) {
  const node = root.querySelector('[data-role="cosmetic-count"]');
  if (node && species.cosmetic) node.textContent = cosmeticCount(species, species.cosmetic, ctx);
}

function pickerCell(species, variant, ctx) {
  // Variante qui ne monte pas dans HOME : on la montre pour l'inventaire, mais
  // il n'y a rien à cocher — ni normal, ni chromatique.
  if (!variant.entry) {
    return el(
      "div.picker__cell.picker__cell--off",
      cosmeticImg(variant, species.id, { className: "picker__img" }),
      el("span.picker__name", variant.short),
      el(
        "div.picker__btns",
        el("span.picker__btn.picker__btn--off", { title: t("Ne peut pas entrer dans HOME") }, "✕"),
        el("span.picker__btn.picker__btn--off", { title: t("Ne peut pas entrer dans HOME") }, "✕")
      )
    );
  }

  const buttons = [
    el(
      "button.picker__btn",
      {
        type: "button",
        title: `${variant.name} — ${t("normal")}`,
        "aria-label": `${variant.name} — ${t("normal")}`,
        "aria-pressed": String(ctx.collection.has(species.id, variant.slot)),
        dataset: { slot: variant.slot, species: species.id },
      },
      "✓"
    ),
  ];
  if (variant.shinyEntry) {
    buttons.push(
      el(
        "button.picker__btn.picker__btn--gold",
        {
          type: "button",
          title: `${variant.name} — ${t("chromatique")}`,
          "aria-label": `${variant.name} — ${t("chromatique")}`,
          "aria-pressed": String(ctx.collection.has(species.id, variant.shinySlot)),
          dataset: { slot: variant.shinySlot, species: species.id },
        },
        el("span.toggle__ico.toggle__ico--shiny", { "aria-hidden": "true" })
      )
    );
  } else {
    buttons.push(
      el("span.picker__btn.picker__btn--off", { title: t("Aucun chromatique n'existe") }, "✕")
    );
  }

  return el(
    variant.isBase ? "div.picker__cell.picker__cell--base" : "div.picker__cell",
    cosmeticImg(variant, species.id, { className: "picker__img" }),
    el("span.picker__name", variant.short),
    el("div.picker__btns", buttons)
  );
}

/** Le detail de chaque variante, sous la grille — « explique-moi chaque forme ». */
function cosmeticNotes(species, ctx) {
  const cosmetic = species.cosmetic;
  if (!cosmetic) return null;

  // Groupe purement informatif (Pichu Troizépi) : pas de grille du tout.
  if (cosmetic.info) {
    return el(
      "section.detail__section",
      el("h3.panel__label", cosmetic.title),
      el(
        "div.forms__list",
        cosmetic.variants.map((variant) =>
          el(
            "article.form",
            el(
              "div.form__head",
              el("div.form__arts", el("span.form__art", cosmeticImg(variant, species.id, { className: "form__img" }))),
              el("div.form__id", el("div.form__name", variant.name), el("div.form__label", cosmetic.title))
            ),
            cosmetic.where ? el("p.form__text", cosmetic.where) : null,
            cosmetic.note ? el("p.form__note", cosmetic.note) : null,
            el("p.form__warn", t("Aucune case à cocher : cette forme ne peut pas entrer dans HOME."))
          )
        )
      )
    );
  }

  const detailed = cosmetic.variants.filter((v) => v.where);
  if (!detailed.length) return null;

  return el(
    "section.detail__section",
    el("h3.panel__label", `${cosmetic.title} — ${t("le détail")}`),
    el(
      "details.forms__group.forms__group--fold",
      { dataset: { key: `notes-${species.id}` } },
      el(
        "summary.forms__title.forms__title--fold",
        `${t("Où trouver chaque variante")} · ${detailed.length}`
      ),
      el(
        "ul.variants",
        detailed.map((variant) =>
          el(
            "li.variants__item",
            cosmeticImg(variant, species.id, { className: "variants__img" }),
            el(
              "div",
              el("div.variants__name", variant.name),
              el("div.variants__where", variant.where),
              variant.shinyEntry
                ? null
                : el("div.variants__lock", t("✦ Aucun chromatique n'existe pour cette variante."))
            )
          )
        )
      )
    )
  );
}

/* -------------------------------- formes --------------------------------- */

/** Libelles des groupes, dans l'ordre d'affichage. */
const KIND_TITLES = {
  alola: "Formes d'Alola",
  galar: "Formes de Galar",
  hisui: "Formes de Hisui",
  paldea: "Formes de Paldéa",
  other: "Autres formes",
  gmax: "Formes Gigamax",
  mega: "Méga-Évolutions",
  primal: "Primo-Résurgence",
  battle: "Formes de combat",
  cap: "Pikachu à casquette",
};

/** Libellé court, porté par la tuile depuis la suppression des titres de groupe. */
const KIND_SHORT = {
  alola: "Alola",
  galar: "Galar",
  hisui: "Hisui",
  paldea: "Paldéa",
  other: "Forme",
  gmax: "Gigamax",
  mega: "Méga",
  primal: "Primo",
  battle: "Combat",
  cap: "Casquette",
};

/** Le logo officiel de la famille, quand il en existe un. */
const KIND_ICONS = {
  alola: "assets/img/forme-alola.png",
  galar: "assets/img/forme-galar.png",
  hisui: "assets/img/forme-hisui.png",
  paldea: "assets/img/forme-paldea.png",
  gmax: "assets/img/gigamax.png",
};

/**
 * Ordre d'affichage des familles. `other` passe **avant** `gmax` : chez
 * Salarsen, la Forme Grave est une forme à part entière qu'on obtient en jeu,
 * alors que ses deux Gigamax dépendent d'un facteur séparé.
 */
const KIND_ORDER = [
  "alola",
  "galar",
  "hisui",
  "paldea",
  "other",
  "gmax",
  "mega",
  "primal",
  "battle",
  "cap",
];

const rangKind = (kind) => {
  const i = KIND_ORDER.indexOf(kind);
  return i < 0 ? KIND_ORDER.length : i;
};

/**
 * Ce qui se coche passe devant — et « se cocher », c'est `form.entry`, pas la
 * famille.
 *
 * Trier sur la famille était faux dans les deux sens. L'Amphinobi Forme Sacha
 * est en famille `battle` mais porte `entry: 1` : il se retrouvait sous
 * « il n'y a rien à y cocher » avec une vraie case, que `completion.js` exige
 * pour compléter l'espèce. À l'inverse, douze formes en `entry: 0` — Kyurem
 * Noir et Blanc, les deux Necrozma, les deux Sylveroy, l'Infinimax
 * d'Éthernatos, les Formes Originelles — sont en famille `other` et passaient
 * donc au-dessus du trait. Chez ces espèces-là, tout le bloc « à cocher »
 * était incochable.
 *
 * On partitionne donc sur `entry`, et on ordonne par famille à l'intérieur de
 * chaque moitié.
 */
function formsSection(species, ctx) {
  if (!species.forms.length) return null;

  const cochables = species.forms.filter((f) => f.entry).sort((a, b) => rangKind(a.kind) - rangKind(b.kind));
  const groups = new Map();
  for (const form of species.forms) {
    if (form.entry) continue;
    if (!groups.has(form.kind)) groups.set(form.kind, []);
    groups.get(form.kind).push(form);
  }
  const lore = [...groups.keys()].sort((a, b) => rangKind(a) - rangKind(b));

  return el(
    "section.detail__section",
    el(
      "div.detail__row",
      el("h3.panel__label", `${t("Formes")} · ${species.forms.length}`),
      el(
        "span.detail__note",
        `${species.forms.filter((f) => f.entry).length} ${t("à collectionner")}`
      )
    ),
    el(
      "p.detail__help",
      t("Chaque forme a son propre sprite normal et chromatique. Ce qui se coche est en haut.")
    ),
    // UNE seule grille pour tout ce qui se coche, et non une grille par
    // famille : chez Miaouss, trois familles d'une forme chacune donnaient
    // trois grilles d'une colonne, empilées, avec du vide sur les côtés. La
    // famille reste lisible sur la tuile — pastille dans le coin et libellé
    // au-dessus du nom — donc les titres de groupe ne manquent pas.
    cochables.length
      ? el("div.ftiles", cochables.map((form) => formTile(form, species, ctx)))
      : null,
    // Le trait ne sert pas qu'a decorer : il dit ou s'arrete la collection et
    // ou commence ce qui n'est la que pour l'information.
    lore.length
      ? el(
          "div.forms__lore",
          el(
            "p.forms__lore-note",
            t("Pour l'information seulement — ces formes n'ont pas d'entrée à elles dans HOME, il n'y a rien à y cocher.")
          ),
          lore.map((kind) => formGroup(kind, groups.get(kind), species, ctx))
        )
      : null
  );
}

/**
 * Un groupe de formes. Celles qu'on ne coche pas — Méga, formes de combat,
 * fusions — sont repliees par defaut : chez Pikachu elles font a elles seules
 * quatorze cartes, et elles poussent le reste de la fiche hors de portee.
 */
function formGroup(kind, forms, species, ctx) {
  const grid = el(
    "div.ftiles",
    forms.map((form) => formTile(form, species, ctx))
  );
  // Ce groupe ne contient que des formes non cochables : au-dela de deux, on
  // le replie pour ne pas repousser le reste de la fiche hors de portee
  // (Pikachu a quatorze Mega... enfin, Florizarre et consorts en ont deux).
  const collapsible = forms.length > 2;
  const icon = KIND_ICONS[kind];
  const titre = [
    icon ? el("img.forms__icon", { src: icon, alt: "", width: 17, height: 17, loading: "lazy" }) : null,
    // KIND_TITLES est une constante de module, evaluee une seule fois a
    // l'import : elle reste en francais, et c'est ici, a l'affichage, qu'on la
    // traduit.
    `${t(KIND_TITLES[kind])} · ${forms.length}`,
  ];

  if (!collapsible) {
    return el("div.forms__group", el("h4.forms__title", titre), grid);
  }
  return el(
    "details.forms__group.forms__group--fold",
    { dataset: { key: `${species.id}-${kind}` } },
    el("summary.forms__title.forms__title--fold", titre),
    grid
  );
}

/**
 * Une forme = une tuile, comme les variantes cosmetiques.
 *
 * Avant, chaque forme etait une carte pleine largeur avec son texte, ses jeux
 * et son bloc chromatique : trois formes remplissaient un ecran, et il fallait
 * defiler longtemps pour voir ce qu'il restait a cocher. Une grille de tuiles
 * montre tout d'un coup — c'est ce que fait deja la grille des Zarbi.
 *
 * Rien n'est perdu pour autant : le detail curate a la main (ou l'obtenir, les
 * jeux, le verrou chromatique) descend dans un repli par tuile. Sa cle
 * `data-key` le fait survivre a une repeinte, comme les autres replis.
 *
 * Les cases restent **hors** du repli : c'est ce qu'on vient faire, ça ne se
 * cache pas derriere un clic.
 */
function formTile(form, species, ctx) {
  const { dataset } = ctx;
  const games = dataset.games.filter((g) => form.games.has(g.code));
  const huntable = games.filter((g) => g.shinyOk !== false && !form.shinyLocked.has(g.code));

  // Les cases de cette forme, dans l'ordre exact ou formButtons() les rend.
  // On les inscrit sur la tuile : `syncMarks()` peut alors recalculer l'etat
  // « terminee » sans rien reconstruire, comme il le fait deja pour les
  // `aria-pressed`.
  const slots = form.entry ? tileSlots(form) : [];
  const done = slots.length > 0 && slots.every((s) => ctx.collection.has(species.id, s));

  const classes = ["div.ftile"];
  if (form.kind === "gmax") classes.push("ftile--gmax");
  if (!form.entry) classes.push("ftile--off");
  if (done) classes.push("ftile--done");

  return el(
    classes.join("."),
    { dataset: { slots: slots.join(" "), species: species.id } },
    el(
      "div.ftile__art",
      formImg(form, { alt: nomForme(form), className: "ftile__img" }),
      form.hasShinySprite
        ? el(
            "span.ftile__shiny",
            formImg(form, {
              shiny: true,
              alt: `${nomForme(form)} ${t("chromatique")}`,
              className: "ftile__img",
            }),
            el("span.ftile__spark", { title: t("Version chromatique"), "aria-hidden": "true" })
          )
        : null,
      // Le logo de la famille, en pastille : d'un coup d'œil on sait si la
      // tuile est une forme d'Alola, de Galar, de Paldéa ou un Gigamax.
      // Les familles sans logo officiel — le Salarsen Forme Grave, le Keldeo
      // Forme Résolue, les Motisma — n'avaient rien du tout dans ce coin, et
      // leurs tuiles se ressemblaient toutes. Elles reçoivent la Poké Ball de
      // capture marquée du losange : « à attraper, sous une autre forme ».
      // Seulement si la forme se coche, sinon l'icône promettrait une case qui
      // n'existe pas (les Méga et les formes de combat n'en ont aucune).
      KIND_ICONS[form.kind]
        ? el("img.ftile__kind", {
            src: KIND_ICONS[form.kind],
            alt: "",
            title: t(KIND_TITLES[form.kind]),
            width: 18,
            height: 18,
            loading: "lazy",
          })
        : form.entry
          ? el("span.ftile__kind.ftile__kind--capture", {
              title: t(KIND_TITLES[form.kind] || "Forme alternative"),
              "aria-hidden": "true",
            })
          : null
    ),
    el(
      "div.ftile__id",
      // Remplace le titre de groupe supprimé : la famille reste écrite, mais
      // sur la tuile, ce qui laisse toutes les formes dans une même grille.
      el("span.ftile__fam", t(KIND_SHORT[form.kind] || KIND_TITLES[form.kind] || "")),
      el("div.ftile__name", nomForme(form)),
      el(
        "div.ftile__chips",
        form.types.map((type) => typeChip(type, dataset.types[type] || "#8b8b8b"))
      )
    ),
    formButtons(form, species, ctx),
    el(
      "details.ftile__more",
      { dataset: { key: `${species.id}-${form.key}` } },
      el("summary.ftile__summary", t("Détails")),
      form.where ? el("p.form__text", form.where) : null,
      el(
        "p.form__games",
        games.length
          ? [`${t("Présente dans")} : `, el("strong", games.map((g) => t(g.name)).join(" · "))]
          : t("Aucun jeu de la série principale ne la propose — transfert HOME uniquement.")
      ),
      shinyLine(form, huntable, games, species, ctx),
      form.note ? el("p.form__note", form.note) : null,
      el(
        "a.info__link",
        { href: pokepediaUrl(form.name), target: "_blank", rel: "noopener" },
        t("Fiche de la forme ↗")
      )
    )
  );
}


/**
 * Les cases d'une forme : une, deux, ou quatre quand la forme a une apparence
 * male et une femelle distinctes (le Farfuret de Hisui). Aucune quand la forme
 * ne monte pas dans HOME — la fiche reste, seuls les boutons disparaissent.
 */
/**
 * Les cases d'une forme, dans le meme ordre que `formButtons()`.
 * Les deux doivent rester d'accord : si l'une ajoute une case que l'autre
 * ignore, une tuile pourrait passer « terminee » sans l'etre.
 */
function tileSlots(form) {
  const slots = [form.slot];
  if (form.gendered) slots.push(form.slotF);
  if (form.shinyEntry) {
    slots.push(form.shinySlot);
    if (form.gendered) slots.push(form.shinySlotF);
  }
  return slots;
}

function formButtons(form, species, ctx) {
  if (!form.entry) {
    return el(
      "p.form__warn",
      t("Rien à cocher : cette forme n'a pas d'entrée à elle dans HOME. La fiche est là pour l'information.")
    );
  }

  // Le logo chromatique remplace le ✦ : même pastille que sur les vignettes et
  // dans la grille cosmétique, pour que « chromatique » se lise pareil partout.
  const ico = () => el("span.toggle__ico.toggle__ico--shiny", { "aria-hidden": "true" });
  const sexe = (g) =>
    el(g === "♀" ? "span.toggle__sex.toggle__sex--f" : "span.toggle__sex", { "aria-hidden": "true" }, g);

  // Une forme à dimorphisme a QUATRE boutons dans une tuile de 172 px :
  // « Normal ♂ » n'y tient pas et se faisait rogner en « Norma… », ce qui
  // effaçait justement le seul repère utile. Chez le Farfuret de Hisui, les
  // deux cases normales devenaient indiscernables. On garde donc le symbole
  // seul, comme sur les raccourcis de vignette — le libellé complet reste dans
  // l'infobulle et dans le nom accessible.
  // Trois fentes distinctes, et c'est voulu : la coche, le logo, le libellé.
  // Glisser le logo DANS le libellé le faisait retomber à la ligne — il est en
  // `display: block` et le libellé n'est pas un conteneur flex — d'où des
  // boutons de 48 px au lieu de 36, au contenu sur deux étages.
  const defs = form.gendered
    ? [
        [form.slot, null, sexe("♂"), false, t("Normal mâle")],
        [form.slotF, null, sexe("♀"), false, t("Normal femelle")],
      ]
    : [[form.slot, null, t("Normal"), false, t("Normal")]];

  if (form.shinyEntry) {
    if (form.gendered) {
      defs.push(
        [form.shinySlot, ico(), sexe("♂"), true, t("Chromatique mâle")],
        [form.shinySlotF, ico(), sexe("♀"), true, t("Chromatique femelle")]
      );
    } else {
      defs.push([form.shinySlot, ico(), t("Shiny"), true, t("Chromatique")]);
    }
  }

  // L'emblème Gigamax ne se pose plus sur le bouton : la tuile le porte déjà
  // en pastille dans le coin de l'illustration. À deux boutons par tuile, un
  // emblème de 16 px plus le ✓ plus le logo chromatique plus le libellé ne
  // tenaient plus, et « Normal » se faisait rogner.
  return el(
    form.gendered ? "div.form__btns.form__btns--four" : "div.form__btns",
    defs.map(([slot, icone, label, gold, nom]) =>
      el(
        gold ? "button.form__btn.form__btn--gold" : "button.form__btn",
        {
          type: "button",
          // Le bouton ne montre qu'un symbole chez une forme à dimorphisme :
          // le libellé complet doit donc rester atteignable, à la souris comme
          // au lecteur d'écran.
          title: `${nomForme(form)} — ${nom}`,
          "aria-label": `${nomForme(form)} — ${nom}`,
          "aria-pressed": String(ctx.collection.has(species.id, slot)),
          dataset: { slot, species: species.id },
        },
        el("span.form__btn-check", "✓"),
        icone,
        el("span.form__btn-label", label)
      )
    )
  );
}

/** La ligne qui repond a « et le shiny, alors ? » pour une forme. */
function shinyLine(form, huntable, games, species, ctx) {
  if (form.shiny === "base") {
    return el(
      "p.form__shiny.form__shiny--base",
      t("✦ Pas de chasse dédiée : c'est le chromatique du Pokémon de base qui s'affiche sous cette forme.")
    );
  }
  if (species.noShiny) {
    return el("p.form__shiny.form__shiny--none", `✦ ${noShinyReason(ctx)}`);
  }
  if (form.shiny === "none" || !form.hasShinySprite) {
    return el(
      "p.form__shiny.form__shiny--none",
      t("✦ Aucun chromatique n'existe pour cette forme, dans aucun jeu.")
    );
  }
  if (!huntable.length) {
    return el(
      "p.form__shiny.form__shiny--event",
      games.length
        ? `${t("✦ Chromatique verrouillé partout où elle apparaît")} (${games
            .map((g) => t(g.name))
            .join(" · ")}) : ${t("il n'existe que par distribution ou par HOME — donc à cocher quand tu l'as.")}`
        : t("✦ Chromatique hors série principale : distribution ou HOME uniquement.")
    );
  }
  return el(
    "p.form__shiny.form__shiny--ok",
    `${t("✦ Chromatique chassable dans")} ${huntable.length} ${tn(
      huntable.length,
      "jeu",
      "jeux"
    )} : ${huntable.map((g) => t(g.name)).join(" · ")}.`
  );
}

/* --------------------- disponibilite par jeu ----------------------------- */

function availabilitySection(species, { dataset }) {
  const section = el(
    "section.detail__section",
    el("h3.panel__label", t("Où le trouver — tous les jeux"))
  );

  if (!species.curated) {
    section.append(
      el(
        "p.detail__help",
        t("Disponibilité pas encore renseignée pour cette espèce. Elle s'ajoute dans "),
        el("code", `data/details/gen-${species.gen}.json`),
        t(" (champs gm / ev / nsh) — voir PROJET.md.")
      )
    );
    return section;
  }

  section.append(
    el(
      "p.detail__help",
      t("Vert = capturable en jeu et shiny huntable · orange = capturable mais shiny impossible · violet = uniquement par événement, shiny possible · bleu = événement et shiny impossible.")
    ),
    el(
      "div.games",
      el(
        "div.games__row.games__head",
        el("span", t("Jeu")),
        el("span", t("Présence")),
        el("span.games__cell--shiny", t("Shiny"))
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
            el("div.games__name", t(row.game.name)),
            el("div.games__gen", `${t("Gén.")} ${row.game.gen}`)
          ),
          // `presenceLabel` / `shinyLabel` viennent d'une table de module de
          // `availability.js`, figee a l'import : on les traduit ici, au point
          // d'affichage.
          el("span.games__cell", t(row.presenceLabel)),
          el("span.games__cell.games__cell--shiny", t(row.shinyLabel))
        )
      )
    ),
    el(
      "p.footnote",
      t("Séries principales uniquement. Un Pokémon absent reste obtenable par échange ou transfert (Banque / HOME) depuis un jeu où il apparaît.")
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
    huntable.length ? "span.hunt__badge" : "span.hunt__badge--none.hunt__badge",
    huntable.length
      ? `${t("✦ Shiny hunt possible dans")} ${huntable.length} ${tn(huntable.length, "jeu", "jeux")}`
      : species.noShiny
        ? t("Aucun chromatique n'existe")
        : t("Shiny impossible dans la série principale")
  );

  const why = huntable.length
    ? whyText(species, huntable, planner)
    : species.noShiny
      ? noShinyReason(ctx)
      : species.note ||
        (species.curated
          ? t("Ce Pokémon est verrouillé chromatique dans tous les jeux où il apparaît, ou n'existe que dans la Gén. I, qui ne connaît pas les chromatiques. Son chromatique reste obtenable par distribution ou par HOME : la case compte donc dans le « tout obtenu ».")
          : t("Disponibilité pas encore renseignée : impossible de dire où le shiny est chassable."));

  return el(
    "section.detail__section",
    el("h3.panel__label", t("✦ Shiny hunt — jeu par jeu")),
    el(
      "div.hunt",
      badge,
      el("p.hunt__why", why),
      huntable.length ? el("div.hunt__sep") : null,
      huntable.map((game) => gameMethod(species, game, planner)),
      locked.length
        ? el(
            "p.hunt__locked",
            `${t("Verrouillé chromatique dans")} : ${locked.map((g) => t(g.name)).join(" · ")}. `,
            lockReason(species, locked, dataset)
          )
        : null,
      el("div.hunt__sep"),
      el("h4.panel__label", t("Rappel des méthodes générales")),
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
        t("Guide complet des Pokémon chromatiques ↗")
      )
    )
  );
}

/** Une carte depliable par jeu : methode, taux, marche a suivre. */
function gameMethod(species, game, planner) {
  const method = planner.methodFor(game.code, species);
  return el(
    "details.method",
    { dataset: { key: `hunt-${game.code}` } },
    el(
      "summary.method__head",
      el("span.method__game", t(game.name)),
      el("span.method__odds", method.odds || "—"),
      el("span.method__name", method.name)
    ),
    el("ol.method__steps", (method.steps || []).map((step) => el("li", step)))
  );
}

function whyText(species, huntable, planner) {
  const best = huntable
    .map((game) => ({ game, method: planner.methodFor(game.code, species) }))
    .sort((a, b) => oddsOf(a.method.odds) - oddsOf(b.method.odds))[0];
  return (
    `${t("Le meilleur taux se trouve dans")} ${t(best.game.name)} : ${best.method.name}, ${best.method.odds}. ` +
    t("Déplie un jeu ci-dessous pour la marche à suivre exacte ; les taux tiennent compte du Charme Chroma quand le jeu le propose.")
  );
}

function lockReason(species, locked, dataset) {
  const always = ((dataset.locks.always && dataset.locks.always.species) || []).includes(species.id);
  if (always) return dataset.locks.always.why || "";
  const first = dataset.locks.byGame && dataset.locks.byGame[locked[0].code];
  return (first && first.why) || t("Le jeu ne génère jamais cette espèce en chromatique.");
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
    el("h3.panel__label", t("Fiche")),
    el(
      "div.info",
      el(
        "div",
        el("div.info__key", t("Apparition d'origine")),
        el("div.info__val", t(gen.game)),
        el("div.info__sub", `${t(gen.label)} · ${t("sortie")} ${gen.year}`)
      ),
      el("div.info__sep"),
      el(
        "div",
        el("div.info__key", t("Emplacement d'origine")),
        el("div.info__text", species.where || t("Non renseigné pour l'instant."))
      ),
      el(
        "div.info__links",
        el("a.info__link", { href: pokepediaUrl(species.name), target: "_blank", rel: "noopener" }, t("Poképédia (FR) ↗")),
        el("a.info__link", { href: bulbapediaUrl(species.en), target: "_blank", rel: "noopener" }, t("Bulbapedia (EN) ↗"))
      )
    )
  );
}

/* --------------------------------- stats --------------------------------- */

function statsSection(species, { dataset }) {
  const total = species.stats.reduce((sum, n) => sum + n, 0);
  return el(
    "section.detail__section",
    el("h3.panel__label", t("Statistiques de base")),
    species.stats.map((value, index) =>
      el(
        "div.stat",
        el("span.stat__label", t(dataset.statLabels[index])),
        el("span.stat__value", value),
        el("div.stat__track", el("div.stat__bar", { style: { width: `${Math.min(100, (value / 255) * 100)}%` } }))
      )
    ),
    el(
      "div.stat.stat--total",
      el("span.stat__label", t("Total")),
      el("span.stat__value", total),
      el("div.stat__track", el("div.stat__bar", { style: { width: `${Math.min(100, (total / 720) * 100)}%` } }))
    )
  );
}
