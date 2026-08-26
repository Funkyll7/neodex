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
