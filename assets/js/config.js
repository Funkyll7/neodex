/**
 * config.js — les quelques reglages qu'on a envie de changer sans lire le code.
 */

export const CONFIG = {
  /**
   * Base des sprites "HOME" de PokeAPI, servie par le CDN jsDelivr.
   * Pour heberger les images en local un jour : deposer les PNG dans
   * assets/img/sprites/ et mettre spriteBase = "assets/img/sprites/".
   */
  spriteBase: "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/home/",

  /** Repli quand un sprite HOME n'existe pas (formes recentes). */
  artworkBase: "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/",

  /** Nombre de vignettes ajoutees a chaque palier de defilement. */
  pageSize: 120,

  /** Cles localStorage. Changer de version repart d'une sauvegarde vierge. */
  storage: {
    marks: "neodex.marks.v1",
    quest: "neodex.quest.v1",
    prefs: "neodex.prefs.v1",
  },

  /** Liens externes des fiches. */
  links: {
    pokepedia: "https://www.pokepedia.fr/",
    bulbapedia: "https://bulbapedia.bulbagarden.net/wiki/",
    shinyGuide: "https://www.pokepedia.fr/Pok%C3%A9mon_chromatique",
  },
};
