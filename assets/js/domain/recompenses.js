/**
 * recompenses.js — ce que les succès font gagner.
 *
 * Il n'y avait qu'un seul type de récompense : la palette de couleurs, et cinq
 * succès sur quarante-trois en ouvraient une. Les trente-huit autres ne
 * donnaient rien. Ce fichier en ajoute cinq types, et trente-neuf récompenses.
 *
 * SIX TYPES, ET UN SEUL CHOIX PAR TYPE.
 *
 *   `titre`     un rang, affiché sous le nom du site et sur la carte de partage
 *   `marque`    le signe qui remplace le ★ des Pokémon complets
 *   `cadre`     le traitement du bord des vignettes de la grille
 *   `motif`     une trame en fond de page
 *   `banniere`  le filet de tête de la carte de partage
 *   `sons`      le jeu de notes joué par `ui/sons.js`
 *
 * Les palettes ne sont PAS ici : elles vivent dans `ui/themes-list.js` depuis le
 * début, elles se choisissent dans leur propre menu, et les y déplacer aurait
 * cassé les préférences enregistrées de tout le monde pour un gain nul.
 *
 * RIEN N'EST STOCKÉ, SAUF LE CHOIX.
 *
 * C'est la même règle que pour les succès, et pour la même raison. Ce qui est
 * DÉBLOQUÉ se déduit des succès, qui se déduisent eux-mêmes de la collection :
 * aucune seconde vérité à tenir d'accord avec la première, rien qui puisse se
 * perdre, et le même résultat sur tous les appareils sans rien synchroniser.
 *
 * Seul le choix — « parmi ce que j'ai, je porte ceci » — est retenu, dans les
 * préférences locales. C'est un réglage d'apparence propre à un appareil,
 * exactement comme le thème : le ranger dans `collection.json` aurait fait
 * voyager un goût du moment avec des données qu'on ne veut jamais perdre.
 *
 * UNE RÉCOMPENSE CHOISIE NE SE REPREND PAS.
 *
 * Décocher une case peut faire retomber un succès sous son seuil. La récompense
 * qu'il ouvrait redevient alors verrouillée — mais si elle est PORTÉE, elle
 * reste portée et reste visible dans la liste. C'est la règle déjà appliquée
 * aux palettes : on n'arrache pas à quelqu'un ce qu'il a sous les yeux, et
 * surtout pas à cause d'une correction qu'il vient de faire lui-même.
 *
 * Ce module ne touche pas au DOM.
 */

/**
 * Les six familles, dans l'ordre où le panneau les présente.
 *
 * `defaut` est la clé de l'option toujours disponible. Chaque type en a une :
 * sans elle, quelqu'un qui n'a rien débloqué verrait six listes vides, et le
 * panneau n'aurait aucun sens avant le premier millier de cases.
 */
export const TYPES = [
  {
    cle: "titre",
    nom: "Titre",
    aide: "Sous le nom du site, et sur la carte de partage.",
    defaut: "aucun",
  },
  {
    cle: "marque",
    nom: "Marque de complétion",
    aide: "Le signe posé sur les Pokémon dont toutes les cases sont cochées.",
    defaut: "etoile",
  },
  {
    cle: "cadre",
    nom: "Cadre de vignette",
    aide: "Le bord des vignettes terminées, dans la grille.",
    defaut: "aucun",
  },
  {
    cle: "motif",
    nom: "Fond de page",
    aide: "Une trame discrète derrière la grille.",
    defaut: "aucun",
  },
  {
    cle: "banniere",
    nom: "Bandeau de la carte",
    aide: "Le filet de tête de la carte de partage.",
    defaut: "uni",
  },
  {
    cle: "sons",
    nom: "Jeu de sons",
    aide: "Les notes jouées quand une case se coche.",
    defaut: "doux",
  },
];

/**
 * Les trente-neuf récompenses.
 *
 * `succes` porte la clé du succès qui l'ouvre — `null` pour les six options par
 * défaut, disponibles dès la première visite.
 *
 * Le succès choisi pour chacune n'est pas décoratif : il dit ce que la
 * récompense CÉLÈBRE. Le cadre « Prisme » s'ouvre sur cinq cents chromatiques
 * parce qu'un cadre irisé n'a de sens qu'au bout d'une chasse ; le titre
 * « Patient » sur dix mille rencontres comptées, qui est exactement ce qu'il
 * décrit.
 */
export const RECOMPENSES = [
  /* ------------------------------- Titres --------------------------------
     `nom` est ce qu'on lit dans le choix, `texte` ce qui s'affiche sous le nom
     du site. Les deux diffèrent pour le seul défaut : dans la liste il
     s'appelle « Aucun », mais il écrit « Collection perso » — c'est-à-dire
     exactement ce qui était là avant qu'il existe un titre. Sans ce détour, le
     défaut aurait remplacé la ligne d'identité du site par le mot « Dresseur »
     dès la première visite, pour une fonctionnalité que personne n'a demandée
     à ce moment-là. */
  { cle: "aucun", type: "titre", nom: "Aucun", texte: "Collection perso", succes: null },
  { cle: "dresseur", type: "titre", nom: "Dresseur", succes: "cent-cases" },
  { cle: "collectionneur", type: "titre", nom: "Collectionneur", succes: "mille-cases" },
  { cle: "archiviste", type: "titre", nom: "Archiviste", succes: "deux-mille-cases" },
  { cle: "chasseur", type: "titre", nom: "Chasseur", succes: "cent-chromatiques" },
  { cle: "chasseur-emerite", type: "titre", nom: "Chasseur émérite", succes: "cinq-cents-chromatiques" },
  { cle: "traqueur", type: "titre", nom: "Traqueur de lumière", succes: "mille-chromatiques" },
  { cle: "marieur", type: "titre", nom: "Marieur", succes: "toutes-les-paires" },
  { cle: "globe-trotteur", type: "titre", nom: "Globe-trotteur", succes: "toutes-generations" },
  { cle: "arpenteur", type: "titre", nom: "Arpenteur de terrain", succes: "tous-go" },
  { cle: "patient", type: "titre", nom: "Patient", succes: "dix-mille-rencontres" },
  { cle: "maitre", type: "titre", nom: "Maître du Pokédex", succes: "pokedex-entier" },

  /* --------------------------- Marques (le ★) ---------------------------- */
  { cle: "etoile", type: "marque", nom: "Étoile", succes: null },
  { cle: "coche", type: "marque", nom: "Coche", succes: "cent-complets" },
  { cle: "eclat", type: "marque", nom: "Éclat", succes: "cinq-cents-chromatiques" },
  { cle: "hexagone", type: "marque", nom: "Hexagone", succes: "toutes-regionales" },
  { cle: "fleur", type: "marque", nom: "Fleur", succes: "tous-cosmetiques" },
  { cle: "gemme", type: "marque", nom: "Gemme", succes: "cinq-cents-complets" },
  { cle: "couronne", type: "marque", nom: "Couronne", succes: "pokedex-entier" },

  /* ------------------------------- Cadres -------------------------------- */
  { cle: "aucun", type: "cadre", nom: "Aucun", succes: null },
  { cle: "or", type: "cadre", nom: "Or", succes: "mille-cases" },
  { cle: "laurier", type: "cadre", nom: "Laurier", succes: "trois-generations" },
  { cle: "prisme", type: "cadre", nom: "Prisme", succes: "cinq-cents-chromatiques" },
  { cle: "neon", type: "cadre", nom: "Néon", succes: "cinq-cents-go" },
  { cle: "couronne", type: "cadre", nom: "Couronne", succes: "pokedex-entier" },

  /* ------------------------------- Motifs -------------------------------- */
  { cle: "aucun", type: "motif", nom: "Aucun", succes: null },
  { cle: "grille", type: "motif", nom: "Quadrillage", succes: "cinq-cents-cases" },
  { cle: "eclats", type: "motif", nom: "Éclats", succes: "cent-chromatiques" },
  { cle: "vagues", type: "motif", nom: "Vagues", succes: "toutes-alola" },
  { cle: "poussiere", type: "motif", nom: "Poussière", succes: "mille-rencontres" },
  { cle: "aurore", type: "motif", nom: "Aurore", succes: "mille-chromatiques" },

  /* ------------------------------ Bandeaux ------------------------------- */
  { cle: "uni", type: "banniere", nom: "Uni", succes: null },
  { cle: "degrade", type: "banniere", nom: "Dégradé", succes: "moitie-du-dex" },
  { cle: "tricolore", type: "banniere", nom: "Tricolore", succes: "trois-generations" },
  { cle: "prisme", type: "banniere", nom: "Prisme", succes: "mille-chromatiques" },
  { cle: "or", type: "banniere", nom: "Or", succes: "tous-complets" },

  /* -------------------------------- Sons --------------------------------- */
  { cle: "doux", type: "sons", nom: "Doux", succes: null },
  { cle: "cristal", type: "sons", nom: "Cristal", succes: "cinquante-quetes" },
  { cle: "retro", type: "sons", nom: "Rétro", succes: "dix-mille-rencontres" },
];

/** Les récompenses d'un type, dans l'ordre de déclaration. */
export function recompensesDuType(type) {
  return RECOMPENSES.filter((r) => r.type === type);
}

/**
 * L'état des récompenses : ce qui est ouvert, et pourquoi.
 *
 * @param {Array} succes   le tableau rendu par `evaluerSucces`
 * @param {Object} portees le choix courant, par type — pour la règle « une
 *                         récompense portée reste portée »
 */
export function evaluerRecompenses(succes, portees = {}) {
  const gagnes = new Set((succes || []).filter((s) => s.obtenu).map((s) => s.cle));
  const parCle = new Map((succes || []).map((s) => [s.cle, s]));

  return RECOMPENSES.map((r) => {
    const source = r.succes ? parCle.get(r.succes) : null;
    const ouvert = !r.succes || gagnes.has(r.succes) || portees[r.type] === r.cle;
    return {
      ...r,
      ouvert,
      /** Le succès qui l'ouvre, avec son avancement — pour l'afficher sous le cadenas. */
      source: source || null,
    };
  });
}

/**
 * Le choix retenu pour un type, ramené à quelque chose de valide.
 *
 * Une préférence peut nommer une récompense qui n'existe plus — un catalogue qui
 * bouge, un fichier de préférences venu d'un autre appareil. On retombe alors
 * sur le défaut du type plutôt que de laisser l'application poser un attribut
 * inconnu, que le CSS ignorerait sans rien dire.
 */
export function choixValide(type, valeur) {
  const famille = TYPES.find((t) => t.cle === type);
  if (!famille) return null;
  const existe = RECOMPENSES.some((r) => r.type === type && r.cle === valeur);
  return existe ? valeur : famille.defaut;
}
