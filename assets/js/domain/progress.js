/**
 * progress.js — les compteurs globaux de la barre latérale.
 *
 * `collection.counts()` répond à « combien d'espèces ai-je ? ». Ce module
 * répond à « combien de **cases** ai-je ? », ce qui n'est pas la même question :
 * un Miaouss capturé pèse une espèce, mais huit cases. Quatre décomptes, un par
 * barre affichée : tout, paires ♂ / ♀, formes alternatives, Gigamax.
 */

import { requiredSlots } from "./completion.js";

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
 * Parcourt toute la collection une seule fois et en tire les quatre barres.
 * @returns {{all, pairs, forms, gmax: {done, total, pct, shiny, pairs, pairsTotal}}}
 */
export function progressOf(speciesList, collection) {
  const all = empty();
  const pairs = empty();
  const forms = empty();
  const gmax = { ...empty(), shiny: 0, pairs: 0, pairsTotal: 0 };

  for (const species of speciesList) {
    for (const entry of requiredSlots(species)) {
      bump(all, collection.has(species.id, entry.slot));
    }

    // Une paire ♂ / ♀ n'a de sens que chez les espèces à dimorphisme visible :
    // les compter toutes donnerait un pourcentage plafonné à 10 %.
    if (species.gd) {
      bump(pairs, collection.has(species.id, "om") && collection.has(species.id, "of"));
    }

    if (species.cosmetic && !species.cosmetic.info) {
      for (const variant of species.cosmetic.variants) {
        if (variant.isBase) continue;
        bump(forms, collection.has(species.id, variant.slot));
        if (variant.shinyEntry) bump(forms, collection.has(species.id, variant.shinySlot));
      }
    }

    for (const form of species.forms) {
      if (!form.entry) continue;
      const target = form.kind === "gmax" ? gmax : forms;
      const owned = collection.has(species.id, form.slot);
      const shiny = form.shinyEntry && collection.has(species.id, form.shinySlot);

      bump(target, owned);
      if (form.gendered) bump(target, collection.has(species.id, form.slotF));
      if (form.shinyEntry) {
        bump(target, shiny);
        if (form.gendered) bump(target, collection.has(species.id, form.shinySlotF));
      }

      if (form.kind === "gmax") {
        if (shiny) gmax.shiny += 1;
        // « Paire » côté Gigamax : le normal ET le chromatique de la même forme.
        if (form.shinyEntry) {
          gmax.pairsTotal += 1;
          if (owned && shiny) gmax.pairs += 1;
        }
      }
    }
  }

  return { all: seal(all), pairs: seal(pairs), forms: seal(forms), gmax: seal(gmax) };
}
