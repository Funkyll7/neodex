/**
 * Les themes proposes, en cinq familles.
 *
 * Sauf les deux themes clairs des familles (Reshiram, starters d'Alola), tous
 * sont batis sur le theme sombre : ils n'en redefinissent que les fonds, les
 * bordures et l'accent, jamais les tons de texte. C'est ce qui garantit que le
 * contraste reste bon sans avoir a le revalider trente-deux fois — et c'est
 * pourquoi ajouter une palette ne demande qu'un bloc dans theme.css et une
 * ligne ici.
 *
 * Aucun theme ne touche a --pair ni a --female : le glyphe ♂ / ♀ est peint en
 * noir par-dessus, ces deux teintes doivent donc rester les memes tons moyens
 * partout. Elles sont figees une seule fois, en tete de la section THEMES.
 *
 * Les valeurs des Legendaires sont restees celles des regions (kanto, johto,
 * …) : elles dorment deja dans les preferences enregistrees, les renommer
 * aurait renvoye tout le monde au theme par defaut au prochain chargement.
 *
 * Les champs :
 *   `groupe`   le titre de la famille — c'est lui qui fait les onglets du menu.
 *   `bandeau`  la couleur du fond de page. Elle doit valoir exactement le --bg
 *              du bloc CSS correspondant, car elle part dans `theme-color`,
 *              donc dans la barre du navigateur et, une fois l'application
 *              installee, dans le bandeau systeme. Le menu s'en sert aussi pour
 *              peindre la carte du theme.
 *   `pastille` l'accent du theme. Fond + accent, c'est tout ce qui distingue
 *              visuellement une palette d'une autre : le menu montre les deux.
 *   `sprite`   le Pokemon a montrer — un numero, ou plusieurs pour un groupe.
 *              Les trente-huit en ont un : les familles qui ne portent pas de
 *              nom de Pokemon en recoivent un CHOISI, faute d'en avoir un
 *              donne. Les six « Couleurs » prennent les coeurs de Meteno, qui
 *              existent justement en sept teintes ; « Sombre » prend Darkrai et
 *              « Clair » Arceus. Le menu dessinait sinon une Poke Ball, la meme
 *              treize fois.
 *   `degrade`  les deux bouts du degrade de progression du theme, `--gold` et
 *              `--gold-soft`. Le menu s'en sert pour peindre le NOM du theme :
 *              Xerneas va de l'or au bleu, son nom aussi. Trente palettes sur
 *              trente-huit l'ont ; les huit qui ne l'ont pas sont « Base » sans
 *              Boussole et les six « Couleurs », dont le degrade n'est qu'une
 *              teinte et sa version claire — un degrade qu'on ne verrait pas.
 *              Leur nom s'ecrit alors d'une seule couleur.
 *
 * `bandeau`, `pastille` et `degrade` recopient des valeurs qui vivent aussi
 * dans theme.css, et c'est assume : une carte du menu n'est pas peinte dans les
 * variables du theme qu'elle propose — elle est dans la page, qui porte un
 * AUTRE theme. Elle ne peut donc que recevoir ces couleurs en dur.
 */
export const THEMES = [
  // --- Base -----------------------------------------------------------------
  { value: "dark", label: "Sombre", groupe: "Base", bandeau: "#0a0d17", pastille: "#ffcb05", sprite: 491 },
  { value: "light", label: "Clair", groupe: "Base", bandeau: "#f2f4f9", pastille: "#c98f00", sprite: 493 },
  // Sable et rose en dégradé sur les tuiles, sur une nuit chaude. Le seul thème
  // hors de la famille Pixels à servir les sprites dessinés plutôt que les
  // rendus 3D : son fond très sombre et son accent franc sont justement la
  // recette qui fait ressortir un sprite de 96 pixels. Voir theme.css.
  // Le trio est celui du thème, pas celui d'une région : Psykokwak, Luxray et
  // Chelours. `sprite` accepte déjà un tableau — c'est le même mécanisme que
  // les trios de starters, et il ne touche à aucune couleur.
  { value: "boussole", label: "Boussole ❤️", groupe: "Base", bandeau: "#14100d", pastille: "#f174d3", sprites: "pixel", sprite: [54, 405, 760], degrade: ["#e0c79c", "#f174d3"] },

  // --- Couleurs : une palette par teinte ------------------------------------
  { value: "rubis", label: "Rubis", groupe: "Couleurs", bandeau: "#150c0f", pastille: "#f2586c", sprite: 10136 },
  { value: "ambre", label: "Ambre", groupe: "Couleurs", bandeau: "#13100a", pastille: "#ff9f2e", sprite: 10137 },
  { value: "emeraude", label: "Émeraude", groupe: "Couleurs", bandeau: "#091310", pastille: "#45cf8d", sprite: 10139 },
  { value: "turquoise", label: "Turquoise", groupe: "Couleurs", bandeau: "#06141a", pastille: "#36ced8", sprite: 10140 },
  { value: "saphir", label: "Saphir", groupe: "Couleurs", bandeau: "#080d1c", pastille: "#5b8dff", sprite: 10141 },
  { value: "amethyste", label: "Améthyste", groupe: "Couleurs", bandeau: "#100b1a", pastille: "#a97dff", sprite: 10142 },

  // --- Legendaires : une region, son legendaire -----------------------------
  { value: "kanto", label: "Mewtwo", groupe: "Légendaires", bandeau: "#0f1015", pastille: "#f2b3d6", sprite: 150, degrade: ["#f2b3d6", "#b49bea"] },
  { value: "johto", label: "Ho-Oh", groupe: "Légendaires", bandeau: "#140f09", pastille: "#ff7f3a", sprite: 250, degrade: ["#ff7f3a", "#ffcf5e"] },
  { value: "hoenn", label: "Kyogre", groupe: "Légendaires", bandeau: "#030913", pastille: "#2ea8ff", sprite: 382, degrade: ["#2ea8ff", "#8ae4ff"] },
  { value: "sinnoh", label: "Dialga", groupe: "Légendaires", bandeau: "#141822", pastille: "#a9c9e8", sprite: 483, degrade: ["#a9c9e8", "#e2eefa"] },
  { value: "unys", label: "Reshiram", groupe: "Légendaires", bandeau: "#f6f2ea", pastille: "#a04516", sprite: 643, degrade: ["#a04516", "#e08a35"] },
  { value: "kalos", label: "Xerneas", groupe: "Légendaires", bandeau: "#0a0c1e", pastille: "#f0d27a", sprite: 716, degrade: ["#f0d27a", "#7fd8ff"] },
  { value: "alola", label: "Solgaleo", groupe: "Légendaires", bandeau: "#06181a", pastille: "#ffe7c2", sprite: 791, degrade: ["#ffe7c2", "#ffab3d"] },
  { value: "galar", label: "Zacian", groupe: "Légendaires", bandeau: "#0d121b", pastille: "#f2637f", sprite: 888, degrade: ["#f2637f", "#ffc45e"] },
  { value: "paldea", label: "Koraidon", groupe: "Légendaires", bandeau: "#09070f", pastille: "#ff5f43", sprite: 1007, degrade: ["#ff5f43", "#b07cff"] },

  // --- Starters : une region, son trio de depart ----------------------------
  // Trois numeros et non un seul : un trio de depart ne se resume pas a l'un
  // des trois, et c'est le trio qu'on reconnait d'un coup d'oeil.
  { value: "starters-kanto", label: "Kanto", groupe: "Starters", bandeau: "#0a100c", pastille: "#6cc86a", sprite: [1, 4, 7], degrade: ["#6cc86a", "#ffbe87"] },
  { value: "starters-johto", label: "Johto", groupe: "Starters", bandeau: "#110f0c", pastille: "#ff8a3c", sprite: [152, 155, 158], degrade: ["#ff8a3c", "#a6c520"] },
  { value: "starters-hoenn", label: "Hoenn", groupe: "Starters", bandeau: "#061315", pastille: "#4cc6e8", sprite: [252, 255, 258], degrade: ["#4cc6e8", "#22b073"] },
  { value: "starters-sinnoh", label: "Sinnoh", groupe: "Starters", bandeau: "#121620", pastille: "#9fc46a", sprite: [387, 390, 393], degrade: ["#9fc46a", "#ffab5e"] },
  { value: "starters-unys", label: "Unys", groupe: "Starters", bandeau: "#0f0f11", pastille: "#7fbdec", sprite: [495, 498, 501], degrade: ["#7fbdec", "#3aa459"] },
  { value: "starters-kalos", label: "Kalos", groupe: "Starters", bandeau: "#100f16", pastille: "#f5c04f", sprite: [650, 653, 656], degrade: ["#f5c04f", "#82a64e"] },
  { value: "starters-alola", label: "Alola", groupe: "Starters", bandeau: "#eef5f4", pastille: "#1c7049", sprite: [722, 725, 728], degrade: ["#1c7049", "#cf7524"] },
  { value: "starters-galar", label: "Galar", groupe: "Starters", bandeau: "#101410", pastille: "#5090e0", sprite: [810, 813, 816], degrade: ["#5090e0", "#8fd47a"] },
  { value: "starters-paldea", label: "Paldéa", groupe: "Starters", bandeau: "#12110a", pastille: "#ff6b3d", sprite: [906, 909, 912], degrade: ["#ff6b3d", "#b9cf5e"] },

  // --- Pixels ---------------------------------------------------------------
  // La seule famille qui ne se contente pas de recolorer : `sprites: "pixel"`
  // fait servir les sprites dessines plutot que les rendus 3D de HOME. C'est
  // `ui/theme.js` qui le transmet a `domain/sprites.js`, et theme.css qui coupe
  // le lissage — un pixel agrandi doit rester un carre.
  //
  // Six variantes sur la meme recette : un fond tres sombre et legerement
  // colore, un accent franc et lumineux. C'est ce contraste-la qui fait
  // ressortir un sprite de 96 pixels, et c'est pourquoi la famille garde sa
  // propre gamme au lieu de reprendre celle des « Couleurs », batie pour des
  // rendus 3D bien plus grands.
  //
  // Chaque carte montre un Pokemon de la teinte de son accent : c'est la seule
  // famille ou le sprite ne nomme pas le theme, il l'illustre.
  { value: "pixels", label: "Console", groupe: "Pixels", bandeau: "#141024", pastille: "#8be04e", sprites: "pixel", sprite: 25, degrade: ["#8be04e", "#ffd23f"] },
  { value: "pixels-ambre", label: "Ambré", groupe: "Pixels", bandeau: "#1a1206", pastille: "#ffb340", sprites: "pixel", sprite: 4, degrade: ["#ffb340", "#ff6a3d"] },
  { value: "pixels-cyan", label: "Cathode", groupe: "Pixels", bandeau: "#061418", pastille: "#3fd8e8", sprites: "pixel", sprite: 131, degrade: ["#3fd8e8", "#b9a6ff"] },
  { value: "pixels-magenta", label: "Néon", groupe: "Pixels", bandeau: "#170a18", pastille: "#f45fd0", sprites: "pixel", sprite: 151, degrade: ["#f45fd0", "#9b8cff"] },
  { value: "pixels-sang", label: "Braise", groupe: "Pixels", bandeau: "#170808", pastille: "#ff6a4d", sprites: "pixel", sprite: 6, degrade: ["#ff6a4d", "#ffc244"] },
  { value: "pixels-encre", label: "Encre", groupe: "Pixels", bandeau: "#0b0f1a", pastille: "#7f9cff", sprites: "pixel", sprite: 130, degrade: ["#7f9cff", "#5fd8c4"] },

  // --- Récompenses : on ne les choisit pas, on les gagne ---------------------
  // `verrou` porte la clé du succès qui les ouvre — voir domain/succes.js, qui
  // DÉDUIT les succès des compteurs au lieu de les stocker.
  //
  // Tant qu'elles sont fermées, le menu ne montre ni leur fond ni leur accent :
  // il dessine un cadenas et ce qu'il reste à faire. C'est le sens de
  // « cosmétique caché » — la palette est une surprise, pas la condition. Une
  // récompense qu'on ne sait pas exister ne donne envie de rien.
  //
  // Toutes sont bi- ou tricolores, ce qu'aucune autre famille ne fait : elles
  // séparent la couleur de ce qu'on TERMINE de celle de ce qu'on TOUCHE, et
  // les font se rencontrer dans le voile des vignettes. Voir theme.css.
  { value: "aube", label: "Aube", groupe: "Récompenses", bandeau: "#0c0e1a", pastille: "#ff9a5c", verrou: "mille-cases", sprite: 637, degrade: ["#ff9a5c", "#6ea8ff"] },
  { value: "prisme", label: "Prisme", groupe: "Récompenses", bandeau: "#0a0c14", pastille: "#7ee7ff", verrou: "cent-chromatiques", sprite: 800, degrade: ["#7ee7ff", "#ff8ad8"] },
  { value: "cartouche", label: "Cartouche", groupe: "Récompenses", bandeau: "#15151b", pastille: "#9ef01a", verrou: "une-generation", sprite: 137, degrade: ["#9ef01a", "#c8b6ff"] },
  // Compagnol et Famignol : le Pokémon Couple et sa famille. Deux sprites et
  // non un, comme les starters — c'est un thème de paires.
  { value: "duo", label: "Duo", groupe: "Récompenses", bandeau: "#17131c", pastille: "#f5e3c0", verrou: "toutes-les-paires", sprite: [924, 925], degrade: ["#d9a066", "#f2b8c6"] },
  { value: "couronne", label: "Couronne", groupe: "Récompenses", bandeau: "#12100c", pastille: "#ffcf4d", verrou: "pokedex-entier", sprite: 889, degrade: ["#ffcf4d", "#d4574e"] },
];
