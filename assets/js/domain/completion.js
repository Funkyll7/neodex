/**
 * completion.js — « ai-je vraiment tout pour ce Pokémon ? »
 *
 * La question n'a de sens que si l'on retire ce que le jeu ne permet pas.
 * Trois choses ne sont jamais obtenables et sont donc exclues du calcul :
 *
 *   - le chromatique d'une espèce verrouillée dans tous les jeux où elle
 *     apparaît (Ogerpon, Koraidon, les fabuleux…) ;
 *   - le chromatique d'une forme dont aucun sprite chromatique n'existe
 *     (les Pikachu à casquette, le Pikachu partenaire) ;
 *   - les formes qu'on ne collectionne pas — Méga-Évolutions, Primo-Résurgence
 *     et formes de combat : ce sont des transformations, pas des entrées.
 *
 * Sans cette soustraction, Pikachu et Évoli ne pourraient jamais être marqués
 * complets, ce qui viderait l'indicateur de son sens.
 */

import { huntableGames } from "./availability.js";

/**
 * Les cases qui doivent être cochées pour que ce Pokémon soit complet.
 * @returns {{slot: string, label: string}[]}
 */
export function requiredSlots(species, games) {
  const slots = [];
  const shinyPossible = huntableGames(species, games).length > 0;

  slots.push({ slot: "om", label: species.gd ? "Normal ♂" : "Normal" });
  if (species.gd) slots.push({ slot: "of", label: "Normal ♀" });
  if (shinyPossible) {
    slots.push({ slot: "sm", label: species.gd ? "Shiny ♂" : "Shiny" });
    if (species.gd) slots.push({ slot: "sf", label: "Shiny ♀" });
  }

  for (const form of species.forms) {
    if (!form.collectible) continue;
    slots.push({ slot: form.slot, label: form.name });
    if (formShinyPossible(form, games)) {
      slots.push({ slot: form.shinySlot, label: `${form.name} shiny` });
    }
  }
  return slots;
}

/** Un chromatique de cette forme existe-t-il, et est-il atteignable quelque part ? */
function formShinyPossible(form, games) {
  if (!form.hasShinySprite || form.shiny === "none") return false;
  return games.some(
    (game) => form.games.has(game.code) && game.shinyOk !== false && !form.shinyLocked.has(game.code)
  );
}

/**
 * Avancement d'un Pokémon : combien de cases sur combien, et est-ce fini.
 * `total` vaut au minimum 1 (la forme normale de base), jamais 0.
 */
export function completionOf(species, collection, games) {
  const slots = requiredSlots(species, games);
  const done = slots.filter((entry) => collection.has(species.id, entry.slot)).length;
  return {
    done,
    total: slots.length,
    complete: done === slots.length,
    /** Ce qu'il reste à cocher, pour l'infobulle de la vignette. */
    missing: slots.filter((entry) => !collection.has(species.id, entry.slot)).map((e) => e.label),
  };
}

export function isComplete(species, collection, games) {
  return completionOf(species, collection, games).complete;
}

/** Nombre de Pokémon entièrement obtenus, pour les compteurs. */
export function countComplete(speciesList, collection, games) {
  let count = 0;
  for (const species of speciesList) {
    if (isComplete(species, collection, games)) count += 1;
  }
  return count;
}
