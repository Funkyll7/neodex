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
   * Sprites en pixels, pour le theme du meme nom.
   *
   * Le dossier s'appelle `generation-v/black-white` parce qu'il a commence par
   * les sprites de Noir et Blanc, mais il ne s'y limite plus : la communaute
   * PokeAPI y a dessine, dans le meme style, tous les Pokemon posterieurs. Les
   * jeux sont en 3D depuis X et Y, ces sprites-la n'existent donc nulle part
   * officiellement.
   *
   * Couverture verifiee sur un echantillon de cinquante numeros repartis de 1 a
   * 1025, chromatiques compris, Ogerpon et Terapagos inclus : rien ne manque.
   *
   * Meme depot et meme SHA que les sprites HOME. Aucune dependance nouvelle,
   * aucun CDN de plus a faire confiance.
   */
  spritePixelBase: `${SPRITES_ROOT}versions/generation-v/black-white/`,

  /**
   * Le projet de sprites Smogon, heberge par Pokemon Showdown.
   *
   * Des sprites DESSINES A LA MAIN par la communaute, dans le style de Noir et
   * Blanc, pour les Pokemon et les formes que les jeux n'ont jamais rendus en
   * 2D. C'est la meme demarche que le dossier `black-white` de PokeAPI, mais
   * un catalogue different : la ou PokeAPI s'arrete, Showdown continue.
   *
   * Mesure sur les 304 formes du jeu de donnees : 48 n'ont aucun sprite en
   * pixels chez PokeAPI, et Showdown en couvre 22 — dont le Pikachu et l'Evoli
   * Partenaire, et la moitie des Mega-Evolutions de Legendes Z-A.
   *
   * Les sprites du projet sont libres d'usage a condition de le crediter ; le
   * credit figure dans le panneau d'informations du site.
   *
   * Un troisieme hote, donc, et c'est assume : il n'est interroge que pour les
   * formes qu'aucune autre source ne couvre, et jamais pour une espece.
   */
  spriteShowdownBase: "https://play.pokemonshowdown.com/sprites/gen5/",

  /**
   * Le meme projet Smogon, mais son dossier CHROMATIQUE.
   *
   * Il ne s'agit pas d'un raffinement : mesure sur les 304 formes du jeu de
   * donnees, VINGT-DEUX ont un chromatique en pixels ici et nulle part
   * ailleurs — le Pikachu et l'Evoli Partenaire, et la moitie des
   * Mega-Evolutions de Legendes Z-A. Sans cette adresse, elles affichaient
   * leur sprite normal a la place du chromatique, sans que rien ne le signale.
   */
  spriteShowdownShinyBase: "https://play.pokemonshowdown.com/sprites/gen5-shiny/",


  /**
   * Les sprites de Pokemon Jaune, dernier recours pour le Pikachu Partenaire.
   *
   * Showdown le couvre desormais, et mieux. On garde ce repli parce qu'il ne
   * coute rien et qu'il reste juste : le Pikachu Partenaire EST celui de Jaune.
   */
  spriteJauneBase: `${SPRITES_ROOT}versions/generation-i/yellow/`,

  /**
   * Sprites « classiques » du depot PokeAPI, nommes par forme ("172-spiky-eared").
   * Les formes cosmetiques y sont toutes presentes, y compris celles qui n'ont
   * pas de rendu HOME — c'est le cas du seul Pichu Troizepi.
   */
  /**
   * Les sprites deposes dans le depot, pour ce que personne d'autre ne sert.
   *
   * Vingt-six formes du DLC Mega-Dimension n'ont de pixel art NULLE PART : ni
   * chez PokeAPI, ni chez Showdown. Mesure faite source par source sur les 304
   * formes du jeu de donnees. Deux artistes les ont dessinees a la main —
   * RetroNC et KingOfThe-X-Roads — et leurs images vivent ici, ramenees a 96 px
   * comme tout le reste du theme.
   *
   * Chez nous et non en lien direct, et ce n'est pas un detail : DeviantArt
   * signe ses adresses avec un jeton qui EXPIRE, et les images de X refusent
   * souvent d'etre affichees depuis un autre site. Un lien direct aurait donc
   * lache tout seul, un jour, sans que rien n'ait bouge ici. 136 Ko au total.
   */
  spritePixelLocalBase: "assets/img/pixels/",

  spriteClassicBase: SPRITES_ROOT,

  /** Nombre de vignettes ajoutees a chaque palier de defilement. */
  pageSize: 120,

  /**
   * Cache hors ligne (sw.js). Interrupteur de secours : le passer a `false`
   * ne se contente pas de ne plus enregistrer le service worker, il
   * DESINSCRIT celui qui serait deja en place et vide ses caches.
   *
   * Sur un site sans etape de build, c'est la seule facon de reprendre la main
   * a distance si un jour un worker se comporte mal : on pousse `false`, le
   * prochain chargement fait le menage, et on repasse a `true` une fois le
   * probleme corrige. Sans cela il faudrait ouvrir les outils de developpement
   * sur chaque appareil.
   */
  offline: true,

  /**
   * Cles localStorage. Changer de version repart d'une sauvegarde vierge.
   *
   * Renommees de `neodex.*` a `funkylldex.*` en meme temps que le site.
   * `main.js` recopie les anciennes cles au premier chargement : sans cela le
   * changement de nom aurait jete les cases cochees pas encore synchronisees,
   * l'avancement des quetes, le theme choisi et le jeton GitHub.
   */
  storage: {
    marks: "funkylldex.marks.v1",
    /** Le carnet de chasses pas encore envoye. Voir domain/quetes.js. */
    quetes: "funkylldex.quetes.v1",
    quest: "funkylldex.quest.v1",
    prefs: "funkylldex.prefs.v1",
    filters: "funkylldex.filters.v1",
    barsFold: "funkylldex.barsfold.v1",
    /** Ou l'on en etait dans la grille, pour y revenir a la visite suivante. */
    spot: "funkylldex.spot.v1",
    saveFold: "funkylldex.savefold.v1",
    token: "funkylldex.github.v1",
  },

  /** Anciennes cles, relues une fois pour reprendre ce qui s'y trouve. */
  storageLegacy: {
    marks: "neodex.marks.v1",
    quest: "neodex.quest.v1",
    prefs: "neodex.prefs.v1",
    filters: "neodex.filters.v1",
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
