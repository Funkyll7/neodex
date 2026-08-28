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

/**
 * Le theme « Pixels » ne change pas que des couleurs : il change les images.
 *
 * Un theme ordinaire ne touche qu'a des variables CSS, et les sprites sont des
 * images distantes — aucune regle de style ne peut les remplacer. On passe donc
 * par ici, seul endroit du site ou une adresse de sprite se fabrique.
 *
 * Un simple drapeau de module, et non un argument de plus sur chaque appel : la
 * trentaine de points d'appel de `spriteImg` n'a rien a savoir du theme choisi,
 * et `ui/theme.js` reste le seul a decider.
 */
let enPixels = false;

export function setSpritesEnPixels(actif) {
  enPixels = Boolean(actif);
}

export function spritesEnPixels() {
  return enPixels;
}

export function spriteUrl(id, { shiny = false, female = false } = {}) {
  // Le dossier en pixels n'a pas de variante femelle : les differences de sexe
  // n'etaient pas dessinees a cette epoque. On sert le sprite commun plutot que
  // d'attendre un 404 et de degrader.
  if (enPixels) return `${CONFIG.spritePixelBase}${shiny ? "shiny/" : ""}${id}.png`;
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

/**
 * Image d'une forme cosmetique. Les sprites sont nommes par forme et non par
 * id — "666-savanna", "201-b", "869-rainbow-swirl-love-sweet". Une variante
 * sans sprite propre (Théffroi Contrefaçon / Authentique, indiscernables en
 * jeu) retombe simplement sur l'image de l'espece.
 */
export function cosmeticImg(variant, speciesId, { shiny = false, alt = "", className = "" } = {}) {
  if (!variant.sprite) return spriteImg(speciesId, { shiny, alt: alt || variant.name, className });

  const base = variant.spriteSet === "classic" ? CONFIG.spriteClassicBase : CONFIG.spriteBase;
  const chain = [];
  if (shiny) chain.push(`${base}shiny/${variant.sprite}.png`);
  chain.push(`${base}${variant.sprite}.png`);
  // Repli si le depot de sprites change de nommage : l'espece, jamais rien.
  chain.push(spriteUrl(speciesId, { shiny }), artworkUrl(speciesId));
  return imageFrom(chain, alt || variant.name, className);
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
