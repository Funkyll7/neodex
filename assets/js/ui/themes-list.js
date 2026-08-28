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
 *   `sprite`   le Pokemon qui donne son nom au theme — un numero, ou trois pour
 *              un trio de starters. Absent pour « Base » et « Couleurs », qui
 *              ne portent le nom d'aucun Pokemon : le menu leur dessine une
 *              Poke Ball dans les deux couleurs du theme.
 */
export const THEMES = [
  // --- Base -----------------------------------------------------------------
  { value: "dark", label: "Sombre", groupe: "Base", bandeau: "#0a0d17", pastille: "#ffcb05" },
  { value: "light", label: "Clair", groupe: "Base", bandeau: "#f2f4f9", pastille: "#c98f00" },
  // Sable et rose en dégradé sur les tuiles, sur une nuit chaude. Le seul thème
  // hors de la famille Pixels à servir les sprites dessinés plutôt que les
  // rendus 3D : son fond très sombre et son accent franc sont justement la
  // recette qui fait ressortir un sprite de 96 pixels. Voir theme.css.
  { value: "boussole", label: "Boussole ❤️", groupe: "Base", bandeau: "#14100d", pastille: "#f174d3", sprites: "pixel" },

  // --- Couleurs : une palette par teinte ------------------------------------
  { value: "rubis", label: "Rubis", groupe: "Couleurs", bandeau: "#150c0f", pastille: "#f2586c" },
  { value: "ambre", label: "Ambre", groupe: "Couleurs", bandeau: "#13100a", pastille: "#ff9f2e" },
  { value: "emeraude", label: "Émeraude", groupe: "Couleurs", bandeau: "#091310", pastille: "#45cf8d" },
  { value: "turquoise", label: "Turquoise", groupe: "Couleurs", bandeau: "#06141a", pastille: "#36ced8" },
  { value: "saphir", label: "Saphir", groupe: "Couleurs", bandeau: "#080d1c", pastille: "#5b8dff" },
  { value: "amethyste", label: "Améthyste", groupe: "Couleurs", bandeau: "#100b1a", pastille: "#a97dff" },

  // --- Legendaires : une region, son legendaire -----------------------------
  { value: "kanto", label: "Mewtwo", groupe: "Légendaires", bandeau: "#0f1015", pastille: "#c3aef2", sprite: 150 },
  { value: "johto", label: "Ho-Oh", groupe: "Légendaires", bandeau: "#140f09", pastille: "#ff7f3a", sprite: 250 },
  { value: "hoenn", label: "Kyogre", groupe: "Légendaires", bandeau: "#030913", pastille: "#2ea8ff", sprite: 382 },
  { value: "sinnoh", label: "Dialga", groupe: "Légendaires", bandeau: "#141822", pastille: "#a9c9e8", sprite: 483 },
  { value: "unys", label: "Reshiram", groupe: "Légendaires", bandeau: "#f6f2ea", pastille: "#a04516", sprite: 643 },
  { value: "kalos", label: "Xerneas", groupe: "Légendaires", bandeau: "#0a0c1e", pastille: "#f0d27a", sprite: 716 },
  { value: "alola", label: "Solgaleo", groupe: "Légendaires", bandeau: "#06181a", pastille: "#ffe7c2", sprite: 791 },
  { value: "galar", label: "Zacian", groupe: "Légendaires", bandeau: "#0d121b", pastille: "#f2637f", sprite: 888 },
  { value: "paldea", label: "Koraidon", groupe: "Légendaires", bandeau: "#09070f", pastille: "#ff5f43", sprite: 1007 },

  // --- Starters : une region, son trio de depart ----------------------------
  // Trois numeros et non un seul : un trio de depart ne se resume pas a l'un
  // des trois, et c'est le trio qu'on reconnait d'un coup d'oeil.
  { value: "starters-kanto", label: "Kanto", groupe: "Starters", bandeau: "#0a100c", pastille: "#6cc86a", sprite: [1, 4, 7] },
  { value: "starters-johto", label: "Johto", groupe: "Starters", bandeau: "#110f0c", pastille: "#ff8a3c", sprite: [152, 155, 158] },
  { value: "starters-hoenn", label: "Hoenn", groupe: "Starters", bandeau: "#061315", pastille: "#4cc6e8", sprite: [252, 255, 258] },
  { value: "starters-sinnoh", label: "Sinnoh", groupe: "Starters", bandeau: "#121620", pastille: "#9fc46a", sprite: [387, 390, 393] },
  { value: "starters-unys", label: "Unys", groupe: "Starters", bandeau: "#0f0f11", pastille: "#7fbdec", sprite: [495, 498, 501] },
  { value: "starters-kalos", label: "Kalos", groupe: "Starters", bandeau: "#100f16", pastille: "#f5c04f", sprite: [650, 653, 656] },
  { value: "starters-alola", label: "Alola", groupe: "Starters", bandeau: "#eef5f4", pastille: "#1c7049", sprite: [722, 725, 728] },
  { value: "starters-galar", label: "Galar", groupe: "Starters", bandeau: "#101410", pastille: "#5090e0", sprite: [810, 813, 816] },
  { value: "starters-paldea", label: "Paldéa", groupe: "Starters", bandeau: "#12110a", pastille: "#ff6b3d", sprite: [906, 909, 912] },

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
  { value: "pixels", label: "Console", groupe: "Pixels", bandeau: "#141024", pastille: "#8be04e", sprites: "pixel", sprite: 25 },
  { value: "pixels-ambre", label: "Ambré", groupe: "Pixels", bandeau: "#1a1206", pastille: "#ffb340", sprites: "pixel", sprite: 4 },
  { value: "pixels-cyan", label: "Cathode", groupe: "Pixels", bandeau: "#061418", pastille: "#3fd8e8", sprites: "pixel", sprite: 131 },
  { value: "pixels-magenta", label: "Néon", groupe: "Pixels", bandeau: "#170a18", pastille: "#f45fd0", sprites: "pixel", sprite: 151 },
  { value: "pixels-sang", label: "Braise", groupe: "Pixels", bandeau: "#170808", pastille: "#ff6a4d", sprites: "pixel", sprite: 6 },
  { value: "pixels-encre", label: "Encre", groupe: "Pixels", bandeau: "#0b0f1a", pastille: "#7f9cff", sprites: "pixel", sprite: 130 },
];
