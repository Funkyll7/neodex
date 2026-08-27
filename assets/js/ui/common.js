/**
 * common.js — petits fragments d'interface partages par plusieurs vues.
 */

import { el } from "../core/dom.js";
import { CONFIG } from "../config.js";

/** "#0025" */
export const dexNumber = (id) => `#${String(id).padStart(4, "0")}`;

/** Couleur du premier type, utilisee comme accent de la vignette et de la fiche. */
export const typeColor = (types, type) => types[type] || "#8b8b8b";

/** Pastille de type. `size` vaut "sm" (grille) ou "lg" (fiche). */
export function typeChip(name, color, size = "sm") {
  return el(size === "lg" ? "span.chip.chip--lg" : "span.chip", { "--type": color }, name);
}

/**
 * Le mode de defilement a employer pour un `scrollTo` / `scrollIntoView`.
 *
 * La regle `prefers-reduced-motion` de base.css coupe les animations CSS, mais
 * elle ne peut rien contre un defilement pilote en JavaScript : `behavior:
 * "smooth"` reste doux quoi qu'il arrive. C'est a l'appelant de demander.
 */
export const defilementDoux = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/** Liens externes : Poképédia attend des underscores, Bulbapedia aussi. */
export const wikiSlug = (name) => encodeURIComponent(String(name).replace(/ /g, "_"));

export const pokepediaUrl = (name) => CONFIG.links.pokepedia + wikiSlug(name);
export const bulbapediaUrl = (nameEn) =>
  `${CONFIG.links.bulbapedia}${wikiSlug(nameEn)}_(Pok%C3%A9mon)`;

/** Telecharge un objet au format JSON. */
export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 1) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
