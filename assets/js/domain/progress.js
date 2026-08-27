/**
 * progress.js — les compteurs globaux de la barre latérale.
 *
 * `collection.counts()` répond à « combien d'espèces ai-je ? ». Ce module
 * répond à « combien de **cases** ai-je ? », ce qui n'est pas la même question :
 * un Miaouss capturé pèse une espèce, mais huit cases.
 *
 * Les compteurs sont rangés en deux familles, parce qu'ils ne répondent pas à
 * la même question :
 *
 *   `kinds`   « où en suis-je sur les formes ? » — une entrée par région, plus
 *             les cosmétiques et les Gigamax. C'est un découpage du travail
 *             qui reste : on voit d'un coup qu'il manque les Galar.
 *   `overall` « où en suis-je en général ? » — tout, les paires ♂ / ♀, les
 *             chromatiques. Trois angles sur la même collection.
 *
 * Un seul parcours de la collection alimente les deux.
 */

import { requiredSlots } from "./completion.js";

/** Familles de formes affichées, dans l'ordre de la barre latérale. */
export const FORM_KINDS = ["alola", "galar", "hisui", "paldea", "other", "cosmetic", "gmax"];

/**
 * Le livingdex Pokémon GO, compté à part.
 *
 * Deux cases par espèce et rien d'autre — GO n'a ni forme régionale, ni case
 * ♂ / ♀. Il ne partage donc AUCUN compteur avec le Pokédex HOME : mélanger les
 * deux ferait un pourcentage qui ne veut rien dire, puisque ce ne sont pas les
 * mêmes Pokémon qu'on range.
 */
export function goProgressOf(speciesList, collection) {
  let owned = 0;
  let shiny = 0;
  // Aucun des deux dénominateurs n'est 1025, et pour deux raisons distinctes :
  //   - 73 espèces ne sont pas obtenables dans GO à ce jour (Arceus, Manaphy,
  //     les Trésors du Fléau, la moitié de Paldéa) : elles ne peuvent pas
  //     entrer dans une boîte, donc elles ne comptent pas ;
  //   - parmi les 952 restantes, 64 n'ont pas encore de chromatique — GO les
  //     sort à son propre rythme.
  // Les compter aurait donné deux barres impossibles à terminer. Les deux
  // listes sont relevées sur Serebii, voir data/reference/go.json.
  let total = 0;
  let shinyTotal = 0;
  for (const species of speciesList) {
    if (!species.goReleased) continue;
    total += 1;
    if (collection.has(species.id, "gn")) owned += 1;
    if (!species.goShiny) continue;
    shinyTotal += 1;
    if (collection.has(species.id, "gs")) shiny += 1;
  }
  const cases = total + shinyTotal;
  return {
    owned,
    shiny,
    /** Especes obtenables : le denominateur de « attrapes ». */
    total,
    /** Especes montrees dans la grille, absentes du jeu comprises. */
    listees: speciesList.length,
    shinyTotal,
    done: owned + shiny,
    cases,
    pct: cases ? Math.round(((owned + shiny) / cases) * 100) : 0,
    pctOwned: total ? Math.round((owned / total) * 100) : 0,
  };
}

const empty = () => ({ done: 0, total: 0, pct: 0 });

function bump(bucket, owned) {
  bucket.total += 1;
  if (owned) bucket.done += 1;
}

function seal(bucket) {
  bucket.pct = bucket.total ? Math.round((bucket.done / bucket.total) * 100) : 0;
  return bucket;
}

/**
 * Parcourt toute la collection une seule fois et en tire tous les compteurs.
 * @returns {{all, pairs, shiny, kinds, gmax}}
 */
export function progressOf(speciesList, collection) {
  const all = empty();
  const pairs = empty();
  const shiny = empty();
  const kinds = {};
  for (const kind of FORM_KINDS) kinds[kind] = empty();
  const gmaxExtra = { shiny: 0, pairs: 0, pairsTotal: 0 };

  for (const species of speciesList) {
    for (const entry of requiredSlots(species)) {
      bump(all, collection.has(species.id, entry.slot));
    }

    // Une paire ♂ / ♀ n'a de sens que chez les espèces à dimorphisme visible :
    // les compter toutes donnerait un pourcentage plafonné à 10 %.
    if (species.gd) {
      bump(pairs, collection.has(species.id, "om") && collection.has(species.id, "of"));
    }

    if (!species.noShiny) {
      bump(shiny, collection.has(species.id, "sm"));
      if (species.gd) bump(shiny, collection.has(species.id, "sf"));
    }

    if (species.cosmetic && !species.cosmetic.info) {
      for (const variant of species.cosmetic.variants) {
        if (variant.isBase || !variant.entry) continue;
        bump(kinds.cosmetic, collection.has(species.id, variant.slot));
        if (variant.shinyEntry) {
          const owned = collection.has(species.id, variant.shinySlot);
          bump(kinds.cosmetic, owned);
          bump(shiny, owned);
        }
      }
    }

    for (const form of species.forms) {
      if (!form.entry) continue;
      // Une catégorie sans barre à elle (Méga, formes de combat) retombe dans
      // « Autres » : mieux vaut une ligne fourre-tout qu'une case qui n'est
      // comptée nulle part.
      const bucket = kinds[form.kind] || kinds.other;
      const owned = collection.has(species.id, form.slot);
      const shinyOwned = form.shinyEntry && collection.has(species.id, form.shinySlot);

      bump(bucket, owned);
      if (form.gendered) bump(bucket, collection.has(species.id, form.slotF));
      if (form.shinyEntry) {
        bump(bucket, shinyOwned);
        bump(shiny, shinyOwned);
        if (form.gendered) {
          const f = collection.has(species.id, form.shinySlotF);
          bump(bucket, f);
          bump(shiny, f);
        }
      }

      if (form.kind === "gmax") {
        if (shinyOwned) gmaxExtra.shiny += 1;
        // « Paire » côté Gigamax : le normal ET le chromatique de la même forme.
        if (form.shinyEntry) {
          gmaxExtra.pairsTotal += 1;
          if (owned && shinyOwned) gmaxExtra.pairs += 1;
        }
      }
    }
  }

  for (const kind of FORM_KINDS) seal(kinds[kind]);
  Object.assign(kinds.gmax, gmaxExtra);

  return {
    all: seal(all),
    pairs: seal(pairs),
    shiny: seal(shiny),
    kinds,
    /** Raccourci : la barre Gigamax porte aussi ses paires et ses chromatiques. */
    gmax: kinds.gmax,
  };
}
