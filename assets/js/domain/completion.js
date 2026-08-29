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
 *
 * Ce fichier vit dans `domain/` et importe pourtant `core/i18n.js` : c'est
 * permis, i18n ne touche pas au DOM — c'est meme pour cela qu'il n'y touche
 * pas. Les LIBELLES des cases sont du texte lu par quelqu'un, ils suivent donc
 * la langue ; les SLOTS, eux, ne changent jamais.
 */

import { langueCourante, nomCosmetique, nomForme, t } from "../core/i18n.js";

/**
 * Les cases exigees par une espece ne dependent que du jeu de donnees et de la
 * langue : ni la collection, ni les filtres, ni le theme n'y changent quoi que
 * ce soit. Or on les redemandait 2050 fois par case cochee — 1025 pour les
 * compteurs de cases, 1025 pour le « tout obtenu » des compteurs d'especes.
 *
 * La cle est l'objet espece lui-meme : core/data.js le gele et n'en fabrique
 * qu'un exemplaire pour toute la vie de la page. Une WeakMap suffit donc, et le
 * jour ou un jeu de donnees serait recharge, l'ancien s'effacerait avec ses
 * entrees sans qu'on ait a y penser.
 *
 * Chaque entree retient la LANGUE dans laquelle elle a ete construite. Un cache
 * qui l'ignorait aurait fige les libelles dans celle de la premiere visite —
 * voir `requiredSlots`.
 *
 * Le tableau rendu est PARTAGE entre tous les appelants : il ne se modifie pas.
 * Aucun appelant ne le fait aujourd'hui — `completionOf` en tire un nouveau
 * tableau par `filter`, progress.js se contente de le parcourir.
 */
const cache = new WeakMap();

/**
 * Les cases qui doivent être cochées pour que ce Pokémon soit complet.
 * @returns {{slot: string, label: string}[]}  tableau partagé, à ne pas modifier
 */
export function requiredSlots(species) {
  // La LANGUE fait partie de la clé du cache. Les libellés sont traduits, et un
  // cache qui ne retenait que l'espèce les figeait dans la langue de la
  // première visite : l'infobulle d'une vignette déjà affichée serait restée en
  // français après la bascule, celles des vignettes suivantes en anglais. Le
  // WeakMap ne se vide pas, mais il n'a pas à l'être — on remplace l'entrée.
  const langue = langueCourante();
  const range = cache.get(species);
  if (range && range.langue === langue) return range.slots;

  const slots = buildSlots(species);
  cache.set(species, { langue, slots });
  return slots;
}

function buildSlots(species) {
  const slots = [];
  const shiny = !species.noShiny;
  const cos = species.cosmetic;
  // Chez les espèces à formes cosmétiques, la case de base n'est pas
  // « Normal » : c'est le Zarbi A, la Prismillon Motif Floral, la Flabébé
  // Fleur Rouge. On la nomme pour que l'infobulle reste lisible.
  const baseName = cos && cos.baseVariant ? nomCosmetique(cos.baseVariant.name) : "";
  const normal = t("Normal");
  const chromatique = t("Shiny");

  slots.push({ slot: "om", label: baseName || (species.gd ? `${normal} ♂` : normal) });
  if (species.gd) slots.push({ slot: "of", label: `${normal} ♀` });
  if (shiny) {
    slots.push({ slot: "sm", label: baseName ? `${baseName} shiny` : species.gd ? `${chromatique} ♂` : chromatique });
    if (species.gd) slots.push({ slot: "sf", label: `${chromatique} ♀` });
  }

  if (cos && !cos.info) {
    for (const variant of cos.variants) {
      // La base est deja comptee plus haut ; une variante qui ne monte pas dans
      // HOME ne peut pas etre cochee, donc pas exigee.
      if (variant.isBase || !variant.entry) continue;
      const nom = nomCosmetique(variant.name);
      slots.push({ slot: variant.slot, label: nom });
      if (variant.shinyEntry) slots.push({ slot: variant.shinySlot, label: `${nom} shiny` });
    }
  }

  for (const form of species.forms) {
    if (!form.entry) continue;
    // `nomForme` et non `form.name` : ces libelles finissent dans l'infobulle
    // de chaque vignette, ou l'anglais lisait « Caninos de Hisui » au milieu
    // d'une phrase anglaise. Les 304 traductions dorment deja dans en.json.
    const nom = nomForme(form);
    slots.push({ slot: form.slot, label: form.gendered ? `${nom} ♂` : nom });
    if (form.gendered) slots.push({ slot: form.slotF, label: `${nom} ♀` });
    if (form.shinyEntry) {
      slots.push({ slot: form.shinySlot, label: form.gendered ? `${nom} shiny ♂` : `${nom} shiny` });
      if (form.gendered) slots.push({ slot: form.shinySlotF, label: `${nom} shiny ♀` });
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

/**
 * « Tout obtenu ? », sans rien fabriquer.
 *
 * Passer par `completionOf()` construisait deux tableaux — les cases manquantes,
 * puis leurs libelles — pour n'en tirer qu'un booleen. Ce test est appele 1025
 * fois par rendu des compteurs et 1025 fois de plus des qu'un filtre de statut
 * est actif : autant ne pas allouer du tout.
 */
export function isComplete(species, collection) {
  for (const entry of requiredSlots(species)) {
    if (!collection.has(species.id, entry.slot)) return false;
  }
  return true;
}

/**
 * « Il ne manque que le chromatique. »
 *
 * Le filtre le plus utile du site pour qui chasse : ces Pokémon-là sont à UNE
 * case de la complétion, et cette case est justement celle qui demande des
 * heures. Les autres filtres ne savaient pas les montrer — « À terminer » les
 * noie parmi ceux à qui il manque six formes.
 *
 * Vrai seulement s'il manque quelque chose : un Pokémon complet n'a rien à
 * chasser, et l'inclure aurait rempli la liste de travail déjà fait.
 *
 * Aucune allocation, contrairement à `completionOf` : ce test tourne sur les
 * 1025 espèces à chaque frappe dans le champ de recherche.
 *
 * @param {(slot: string) => boolean} estChromatique  passé par l'appelant plutôt
 *   qu'importé : la reconnaissance des cases chromatiques vit dans
 *   `domain/collection.js`, qui ne connaît pas ce fichier et n'a pas à le
 *   connaître. L'inverse aurait créé un cycle.
 */
export function neManqueQueLeChromatique(species, collection, estChromatique) {
  let manque = false;
  for (const entry of requiredSlots(species)) {
    if (collection.has(species.id, entry.slot)) continue;
    if (!estChromatique(entry.slot)) return false;
    manque = true;
  }
  return manque;
}

/** Nombre de Pokémon entièrement obtenus, pour les compteurs. */
export function countComplete(speciesList, collection) {
  let count = 0;
  for (const species of speciesList) {
    if (isComplete(species, collection)) count += 1;
  }
  return count;
}
