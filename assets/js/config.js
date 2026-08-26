/**
 * config.js — les quelques reglages qu'on a envie de changer sans lire le code.
 */

/**
 * Version epinglee du depot PokeAPI/sprites servie par jsDelivr.
 *
 * Volontairement un SHA, pas `master` : sur une branche mobile, une
 * reorganisation en amont casserait toutes les images du site d'un coup, sans
 * prevenir et sans rien changer ici. On remonte donc ce SHA a la main, quand
 * on le decide — typiquement apres l'arrivee de nouveaux Pokemon.
 *
 * Pour le mettre a jour :
 *   1. relever le dernier commit sur https://github.com/PokeAPI/sprites
 *   2. remplacer la constante ci-dessous
 *   3. recharger le site et verifier quelques vignettes, dont une forme recente
 *
 * Epingle le 2026-08-26 sur le commit du 2026-08-08.
 */
const SPRITES_REF = "c10459b9b0129eaca5c5d9b1cac65336debb1d08";
const SPRITES_ROOT = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${SPRITES_REF}/sprites/pokemon/`;

export const CONFIG = {
  /**
   * Base des sprites "HOME" de PokeAPI, servie par le CDN jsDelivr.
   * Pour heberger les images en local un jour : deposer les PNG dans
   * assets/img/sprites/ et mettre spriteBase = "assets/img/sprites/".
   */
  spriteBase: `${SPRITES_ROOT}other/home/`,

  /** Repli quand un sprite HOME n'existe pas (formes recentes). */
  artworkBase: `${SPRITES_ROOT}other/official-artwork/`,

  /**
   * Sprites « classiques » du depot PokeAPI, nommes par forme ("172-spiky-eared").
   * Les formes cosmetiques y sont toutes presentes, y compris celles qui n'ont
   * pas de rendu HOME — c'est le cas du seul Pichu Troizepi.
   */
  spriteClassicBase: SPRITES_ROOT,

  /** Nombre de vignettes ajoutees a chaque palier de defilement. */
  pageSize: 120,

  /** Cles localStorage. Changer de version repart d'une sauvegarde vierge. */
  storage: {
    marks: "neodex.marks.v1",
    quest: "neodex.quest.v1",
    prefs: "neodex.prefs.v1",
    token: "neodex.github.v1",
  },

  /**
   * Ecriture directe de data/collection.json dans le depot, depuis le site.
   * Le jeton n'est pas ici : il est saisi dans la barre laterale et reste dans
   * le localStorage de ce navigateur.
   */
  github: {
    owner: "Funkyll7",
    repo: "neodex",
    branch: "main",
    path: "data/collection.json",
    /** Delai avant d'ecrire, pour regrouper une serie de cases cochees. */
    delayMs: 4000,
    /**
     * Plafond de ce regroupement. Chaque case cochee repousse `delayMs` ; sans
     * plafond, une longue session de pointage ne declencherait jamais la
     * moindre ecriture. Passe ce delai depuis la premiere modification en
     * attente, on ecrit, quitte a couper une serie en deux commits.
     */
    maxDelayMs: 30000,
  },

  /** Liens externes des fiches. */
  links: {
    pokepedia: "https://www.pokepedia.fr/",
    bulbapedia: "https://bulbapedia.bulbagarden.net/wiki/",
    shinyGuide: "https://www.pokepedia.fr/Pok%C3%A9mon_chromatique",
  },
};
