/**
 * completion.js — « ai-je vraiment tout pour ce Pokémon ? »
 *
 * La règle tient en une phrase : **tout ce qui a existé un jour est à cocher.**
 * Un chromatique distribué une seule fois en 2013 reste un chromatique qu'on
 * peut avoir en boîte : il compte. Ce qui ne compte pas, c'est ce qui n'existe
 * nulle part. Trois soustractions, et trois seulement :
 *
 *   - les espèces de `noShiny` (data/reference/shiny-locks.json) : aucun
 *     chromatique n'en a jamais été produit — Victini, Ogerpon, Shifours…
 *   - les formes sans entrée propre dans HOME (`entry: 0`) : fusions, formes de
 *     combat, Méga-Évolutions, partenaires de Let's Go ;
 *   - les formes dont aucun sprite chromatique n'existe (Pikachu à casquette)
 *     ou marquées `shiny: "none"` (Amphinobi Forme Sacha, Melmetal Gigamax).
 *
 * Tout le reste est exigé, y compris les formes cosmétiques : les 28 Zarbi, les
 * 20 Prismillon, les 63 Charmilly. Un Pokémon « ★ Complet » l'est vraiment.
 */

/**
 * Les cases qui doivent être cochées pour que ce Pokémon soit complet.
 * @returns {{slot: string, label: string}[]}
 */
export function requiredSlots(species) {
  const slots = [];
  const shiny = !species.noShiny;
  const cos = species.cosmetic;
  // Chez les espèces à formes cosmétiques, la case de base n'est pas
  // « Normal » : c'est le Zarbi A, la Prismillon Motif Floral, la Flabébé
  // Fleur Rouge. On la nomme pour que l'infobulle reste lisible.
  const baseName = cos && cos.baseVariant ? cos.baseVariant.name : "";

  slots.push({ slot: "om", label: baseName || (species.gd ? "Normal ♂" : "Normal") });
  if (species.gd) slots.push({ slot: "of", label: "Normal ♀" });
  if (shiny) {
    slots.push({ slot: "sm", label: baseName ? `${baseName} shiny` : species.gd ? "Shiny ♂" : "Shiny" });
    if (species.gd) slots.push({ slot: "sf", label: "Shiny ♀" });
  }

  if (cos && !cos.info) {
    for (const variant of cos.variants) {
      // La base est deja comptee plus haut ; une variante qui ne monte pas dans
      // HOME ne peut pas etre cochee, donc pas exigee.
      if (variant.isBase || !variant.entry) continue;
      slots.push({ slot: variant.slot, label: variant.name });
      if (variant.shinyEntry) slots.push({ slot: variant.shinySlot, label: `${variant.name} shiny` });
    }
  }

  for (const form of species.forms) {
    if (!form.entry) continue;
    slots.push({ slot: form.slot, label: form.gendered ? `${form.name} ♂` : form.name });
    if (form.gendered) slots.push({ slot: form.slotF, label: `${form.name} ♀` });
    if (form.shinyEntry) {
      slots.push({ slot: form.shinySlot, label: form.gendered ? `${form.name} shiny ♂` : `${form.name} shiny` });
      if (form.gendered) slots.push({ slot: form.shinySlotF, label: `${form.name} shiny ♀` });
    }
  }
  return slots;
}

/**
 * Avancement d'un Pokémon : combien de cases sur combien, et est-ce fini.
 * `total` vaut au minimum 1 (la forme normale de base), jamais 0.
 */
export function completionOf(species, collection) {
  const slots = requiredSlots(species);
  const missing = slots.filter((entry) => !collection.has(species.id, entry.slot));
  return {
    done: slots.length - missing.length,
    total: slots.length,
    complete: missing.length === 0,
    /** Ce qu'il reste à cocher, pour l'infobulle de la vignette. */
    missing: missing.map((e) => e.label),
  };
}

export function isComplete(species, collection) {
  return completionOf(species, collection).complete;
}

/** Nombre de Pokémon entièrement obtenus, pour les compteurs. */
export function countComplete(speciesList, collection) {
  let count = 0;
  for (const species of speciesList) {
    if (isComplete(species, collection)) count += 1;
  }
  return count;
}
