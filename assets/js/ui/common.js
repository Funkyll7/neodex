/**
 * common.js — petits fragments d'interface partages par plusieurs vues.
 */

import { el } from "../core/dom.js";
import { CONFIG } from "../config.js";
import { nomType } from "../core/i18n.js";

/** "#0025" */
export const dexNumber = (id) => `#${String(id).padStart(4, "0")}`;

/** Couleur du premier type, utilisee comme accent de la vignette et de la fiche. */
export const typeColor = (types, type) => types[type] || "#8b8b8b";

/**
 * L'encre a poser SUR une couleur de type : la plus lisible des deux.
 *
 * Toutes ces surfaces etaient peintes en blanc. Mesure sur les dix-huit types :
 * QUATORZE echouaient au seuil de 4,5, et pas de peu — le blanc sur le jaune
 * Electrik ne donnait que 1,49, autant dire rien. En encre sombre, le meme
 * jaune monte a 12,67.
 *
 * Calcule plutot que note dans data/reference/types.json : la table des couleurs
 * bouge parfois, et une encre ecrite a la main aurait cesse d'etre juste sans
 * que personne ne le voie. Ici elle suit.
 *
 * Le blanc reste gagnant sur les quatre types sombres — Combat, Dragon,
 * Spectre, Tenebres. Le pire cas devient 4,6, contre 1,49 avant.
 */
export function typeInk(color) {
  const canal = (i) => {
    const v = parseInt(String(color).slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
  // Contraste contre le blanc, puis contre l'encre sombre. Le plus grand gagne.
  // `L_ENCRE` est la luminance relative de #111111, calculee une fois ici plutot
  // que laissee en constante magique.
  const L_ENCRE = 0.00605;
  const surBlanc = 1.05 / (L + 0.05);
  const surEncre = (L + 0.05) / (L_ENCRE + 0.05);
  return surBlanc >= surEncre ? "#ffffff" : "#111111";
}

/**
 * Pastille de type. `size` vaut "sm" (grille) ou "lg" (fiche).
 *
 * La traduction se fait ICI et non chez les appelants : les pastilles sont
 * peintes depuis cinq endroits differents — grille, fiche, formes, quete,
 * Pokedex GO —, et l'oubli d'un seul aurait laisse un « Plante » au milieu des
 * « Grass ». La couleur, elle, reste choisie sur le nom FRANCAIS, qui est la
 * cle de data/reference/types.json.
 */
export function typeChip(name, color, size = "sm") {
  const balise = size === "lg" ? "span.chip.chip--lg" : "span.chip";
  return el(balise, { "--type": color, "--type-ink": typeInk(color) }, nomType(name));
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
