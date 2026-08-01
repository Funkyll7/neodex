/**
 * sprites.js — fabrique les URL d'images et gere les replis.
 *
 * PokeAPI ne fournit pas de sprite "female" pour toutes les especes a
 * dimorphisme, ni de sprite HOME pour toutes les formes alternatives.
 * `attachFallback` degrade proprement : female -> male -> artwork -> vide.
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
  const img = document.createElement("img");
  img.alt = alt;
  img.loading = "lazy";
  img.decoding = "async";
  if (className) img.className = className;

  const chain = [];
  if (female) chain.push(spriteUrl(id, { shiny, female: true }));
  chain.push(spriteUrl(id, { shiny }));
  chain.push(artworkUrl(id, { shiny }));
  if (shiny) chain.push(artworkUrl(id));

  let step = 0;
  img.addEventListener("error", () => {
    step += 1;
    if (step < chain.length) img.src = chain[step];
    else img.removeAttribute("src");
  });
  img.src = chain[0];
  return img;
}
