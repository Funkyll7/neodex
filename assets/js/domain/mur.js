/**
 * mur.js — la liste de ce qu'on a en chromatique.
 *
 * POURQUOI CE N'EST PAS UN FILTRE DE PLUS. La grille sait déjà montrer « ce que
 * j'ai en shiny » : il suffit d'un filtre. Mais elle le montre comme elle montre
 * tout le reste — mille vingt-cinq emplacements dont quatre-vingt-sept sont
 * remplis, c'est-à-dire un Pokédex plein de trous où les shinies sont noyés.
 *
 * Le mur ne montre QUE ce qu'on a. Rien n'y manque, par construction : il n'y a
 * pas de case grise, pas de compteur « sur combien », pas d'objectif. C'est la
 * seule page du site qui ne demande rien et ne reproche rien — celle qu'on
 * ouvre pour la regarder, et qu'on montre.
 *
 * UNE ENTRÉE PAR CASE COCHÉE, ET NON PAR ESPÈCE. Un Amphinobi normal et un
 * Amphinobi de Hisui sont deux chasses, deux rencontres, deux moments. Les
 * fondre en une vignette « Amphinobi » aurait effacé la moitié du travail. Une
 * espèce à trois formes chromatiques occupe donc trois places sur le mur, et
 * c'est juste.
 *
 * LA STRUCTURE EST RELUE, PAS DEVINÉE. Les cases chromatiques se déduisent de
 * l'espèce — base, variantes cosmétiques, formes —, exactement comme dans
 * `domain/completion.js`. On refait ici le même parcours parce qu'on a besoin
 * d'une chose que `requiredSlots` ne donne pas : le SUJET de chaque case, sans
 * lequel on ne saurait pas quelle image dessiner.
 *
 * Ce module ne touche pas au DOM et ne fabrique aucune adresse d'image.
 */

/**
 * Ce qu'on possède en chromatique, dans l'ordre du Pokédex national.
 *
 * @param {Array}  especes
 * @param {Object} collection  doit répondre à `has(id, slot)`
 * @returns {Array<{cle, id, slot, nom, genre, sujet, espece}>} `sujet` vaut
 *   « espece », « cosmetique » ou « forme » ; `genre` vaut « m », « f » ou null.
 */
export function murDesChromatiques(especes, collection) {
  const mur = [];

  for (const espece of [...especes].sort((a, b) => a.id - b.id)) {
    const pris = (slot) => slot && collection.has(espece.id, slot);
    const poser = (slot, sujet, extra, genre) => {
      if (!pris(slot)) return;
      mur.push({ cle: `${espece.id}:${slot}`, id: espece.id, slot, sujet, genre: genre || null, espece, ...extra });
    };

    // La base. Une espèce à dimorphisme a deux cases, et ce sont deux images
    // différentes — c'est bien deux entrées.
    if (!espece.noShiny) {
      poser("sm", "espece", {}, espece.gd ? "m" : null);
      if (espece.gd) poser("sf", "espece", {}, "f");
    }

    // Les variantes cosmétiques : les vingt-huit Zarbi, les Prismillon, les
    // Pikachu à casquette. `info` marque les familles décoratives que le site
    // ne fait pas cocher.
    const cos = espece.cosmetic;
    if (cos && !cos.info) {
      for (const variant of cos.variants) {
        if (variant.isBase || !variant.shinyEntry) continue;
        poser(variant.shinySlot, "cosmetique", { variant });
      }
    }

    for (const forme of espece.forms) {
      if (!forme.entry || !forme.shinyEntry) continue;
      poser(forme.shinySlot, "forme", { forme }, forme.gendered ? "m" : null);
      if (forme.gendered) poser(forme.shinySlotF, "forme", { forme }, "f");
    }
  }

  return mur;
}

/**
 * Le mur, découpé par génération.
 *
 * DÉCOUPÉ ET NON TRIÉ, parce qu'un mur de quatre-vingt-sept vignettes à la file
 * ne raconte rien, alors que « Kanto 14, Johto 9, Hoenn 21 » raconte où l'on a
 * chassé. C'est la seule information que le mur porte, et elle se lit dans les
 * en-têtes plutôt que dans un compteur.
 *
 * Les générations vides ne sont pas rendues : un mur ne montre pas les murs
 * qu'on n'a pas.
 */
export function murParGeneration(mur, generations) {
  const paquets = new Map();
  for (const entree of mur) {
    const gen = entree.espece.gen;
    if (!paquets.has(gen)) paquets.set(gen, []);
    paquets.get(gen).push(entree);
  }
  return [...paquets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gen, entrees]) => ({
      gen,
      region: (generations[gen] || {}).region || "",
      label: (generations[gen] || {}).label || "",
      entrees,
    }));
}
