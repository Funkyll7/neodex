/**
 * sprites.js — fabrique les URL d'images et gere les replis.
 *
 * Deux cas distincts :
 *   - une espece : PokeAPI ne fournit pas toujours le sprite "female", ni le
 *     sprite HOME chromatique. `spriteImg` degrade female -> male -> artwork.
 *   - une forme alternative : tools/build_forms.py a verifie image par image ce
 *     qui existe reellement (data/forms/*.json, champ `sprites`). On part donc
 *     directement de la bonne source au lieu d'attendre un 404.
 */

import { CONFIG } from "../config.js";

export function spriteUrl(id, { shiny = false, female = false } = {}) {
  return `${CONFIG.spriteBase}${shiny ? "shiny/" : ""}${female ? "female/" : ""}${id}.png`;
}

export function artworkUrl(id, { shiny = false } = {}) {
  return `${CONFIG.artworkBase}${shiny ? "shiny/" : ""}${id}.png`;
}

/**
 * Cree un <img> qui tente successivement plusieurs sources.
 * On garde `loading="lazy"` : la grille peut afficher un millier d'images.
 */
export function spriteImg(id, { shiny = false, female = false, alt = "", className = "" } = {}) {
  const chain = [];
  if (female) chain.push(spriteUrl(id, { shiny, female: true }));
  chain.push(spriteUrl(id, { shiny }));
  chain.push(artworkUrl(id, { shiny }));
  if (shiny) chain.push(artworkUrl(id));
  return imageFrom(chain, alt, className);
}

/**
 * Image d'une forme alternative. `form.sprites` dit ce qui existe : on ne
 * demande jamais une image absente, et une forme sans chromatique connu
 * retombe volontairement sur son image normale.
 */
export function formImg(form, { shiny = false, alt = "", className = "" } = {}) {
  const has = form.sprites || {};
  const chain = [];
  if (shiny) {
    if (has.homeShiny) chain.push(spriteUrl(form.id, { shiny: true }));
    if (has.artShiny) chain.push(artworkUrl(form.id, { shiny: true }));
  }
  if (has.home) chain.push(spriteUrl(form.id));
  if (has.art) chain.push(artworkUrl(form.id));
  // Filet de securite si le referentiel n'a pas encore ete regenere.
  if (!chain.length) chain.push(spriteUrl(form.id, { shiny }), artworkUrl(form.id));
  return imageFrom(chain, alt || form.name, className);
}

function imageFrom(chain, alt, className) {
  const img = document.createElement("img");
  img.alt = alt;
  img.loading = "lazy";
  img.decoding = "async";
  if (className) img.className = className;

  let step = 0;
  img.addEventListener("error", () => {
    step += 1;
    if (step < chain.length) img.src = chain[step];
    else img.removeAttribute("src");
  });
  img.src = chain[0];
  return img;
}
