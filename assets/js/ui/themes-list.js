/**
 * Les themes proposes, en quatre familles.
 *
 * Sauf les deux themes clairs des familles (Reshiram, starters d'Alola), tous
 * sont batis sur le theme sombre : ils n'en redefinissent que les fonds, les
 * bordures et l'accent, jamais les tons de texte. C'est ce qui garantit que le
 * contraste reste bon sans avoir a le revalider vingt-six fois — et c'est
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
 * `groupe` est le titre de la famille : c'est lui qui coupe la palette en
 * quatre au lieu de derouler vingt-six boutons d'affilee.
 * `bandeau` est la couleur du fond de page — elle doit valoir exactement le
 * --bg du bloc CSS correspondant, car elle part dans `theme-color`, donc dans
 * la barre du navigateur et, une fois l'application installee, dans le bandeau
 * systeme.
 * `pastille` est l'accent du theme : les deux forment le point de la vignette.
 */
export const THEMES = [
  // --- Base -----------------------------------------------------------------
  { value: "dark", label: "Sombre", groupe: "Base", bandeau: "#0a0d17", pastille: "#ffcb05" },
  { value: "light", label: "Clair", groupe: "Base", bandeau: "#f2f4f9", pastille: "#c98f00" },

  // --- Couleurs : une palette par teinte ------------------------------------
  { value: "rubis", label: "Rubis", groupe: "Couleurs", bandeau: "#150c0f", pastille: "#f2586c" },
  { value: "ambre", label: "Ambre", groupe: "Couleurs", bandeau: "#13100a", pastille: "#ff9f2e" },
  { value: "emeraude", label: "Émeraude", groupe: "Couleurs", bandeau: "#091310", pastille: "#45cf8d" },
  { value: "turquoise", label: "Turquoise", groupe: "Couleurs", bandeau: "#06141a", pastille: "#36ced8" },
  { value: "saphir", label: "Saphir", groupe: "Couleurs", bandeau: "#080d1c", pastille: "#5b8dff" },
  { value: "amethyste", label: "Améthyste", groupe: "Couleurs", bandeau: "#100b1a", pastille: "#a97dff" },

  // --- Legendaires : une region, son legendaire -----------------------------
  { value: "kanto", label: "Mewtwo", groupe: "Légendaires", bandeau: "#0f1015", pastille: "#c3aef2" },
  { value: "johto", label: "Ho-Oh", groupe: "Légendaires", bandeau: "#140f09", pastille: "#ff7f3a" },
  { value: "hoenn", label: "Kyogre", groupe: "Légendaires", bandeau: "#030913", pastille: "#2ea8ff" },
  { value: "sinnoh", label: "Dialga", groupe: "Légendaires", bandeau: "#141822", pastille: "#a9c9e8" },
  { value: "unys", label: "Reshiram", groupe: "Légendaires", bandeau: "#f6f2ea", pastille: "#a04516" },
  { value: "kalos", label: "Xerneas", groupe: "Légendaires", bandeau: "#0a0c1e", pastille: "#f0d27a" },
  { value: "alola", label: "Solgaleo", groupe: "Légendaires", bandeau: "#06181a", pastille: "#ffe7c2" },
  { value: "galar", label: "Zacian", groupe: "Légendaires", bandeau: "#0d121b", pastille: "#f2637f" },
  { value: "paldea", label: "Koraidon", groupe: "Légendaires", bandeau: "#09070f", pastille: "#ff5f43" },

  // --- Starters : une region, son trio de depart ----------------------------
  { value: "starters-kanto", label: "Kanto", groupe: "Starters", bandeau: "#0a100c", pastille: "#6cc86a" },
  { value: "starters-johto", label: "Johto", groupe: "Starters", bandeau: "#110f0c", pastille: "#ff8a3c" },
  { value: "starters-hoenn", label: "Hoenn", groupe: "Starters", bandeau: "#061315", pastille: "#4cc6e8" },
  { value: "starters-sinnoh", label: "Sinnoh", groupe: "Starters", bandeau: "#121620", pastille: "#9fc46a" },
  { value: "starters-unys", label: "Unys", groupe: "Starters", bandeau: "#0f0f11", pastille: "#7fbdec" },
  { value: "starters-kalos", label: "Kalos", groupe: "Starters", bandeau: "#100f16", pastille: "#f5c04f" },
  { value: "starters-alola", label: "Alola", groupe: "Starters", bandeau: "#eef5f4", pastille: "#1c7049" },
  { value: "starters-galar", label: "Galar", groupe: "Starters", bandeau: "#101410", pastille: "#5090e0" },
  { value: "starters-paldea", label: "Paldéa", groupe: "Starters", bandeau: "#12110a", pastille: "#ff6b3d" },
];
