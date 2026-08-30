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
    onglet: "Marque",
    aide: "Le signe posé sur les Pokémon dont toutes les cases sont cochées.",
    defaut: "etoile",
  },
  {
    cle: "cadre",
    nom: "Cadre de vignette",
    onglet: "Cadre",
    aide: "Le bord des vignettes terminées, dans la grille.",
    defaut: "aucun",
  },
  {
    cle: "motif",
    nom: "Fond de page",
    onglet: "Fond",
    aide: "Une trame discrète derrière la grille.",
    defaut: "aucun",
  },
  {
    cle: "banniere",
    nom: "Bandeau de la carte",
    onglet: "Bandeau",
    aide: "Le filet de tête de la carte de partage.",
    defaut: "uni",
  },
  {
    cle: "sons",
    nom: "Jeu de sons",
    onglet: "Sons",
    aide: "Les notes jouées quand une case se coche.",
    defaut: "doux",
  },
  /* LA BALL EST LE SEUL COSMÉTIQUE QU'ON VOIT MILLE FOIS PAR SESSION : c'est
     le bouton qu'on presse pour cocher, et il est sur chaque vignette. Il
     portait une Poké Ball, la même pour tout le monde.

     Elle se DÉCLINE plutôt qu'elle ne se remplace : la Ball choisie sert à la
     fois de pastille sur le bouton « capturé » et de curseur sur ordinateur.
     C'était deux récompenses dans la première esquisse — « une Ball » et « un
     curseur » — et c'était la même question posée deux fois. */
  {
    cle: "ball",
    nom: "Ball",
    onglet: "Ball",
    aide: "La Ball du bouton « capturé », et le curseur sur ordinateur.",
    defaut: "poke",
  },
  /* LE STYLE DE SPRITE ÉTAIT PRISONNIER DE SA PALETTE. Les images en pixels
     n'existaient qu'à travers les six thèmes « Pixels » : les vouloir obligeait
     à prendre leurs couleurs, et aimer les couleurs d'un autre thème obligeait
     à renoncer aux pixels. Deux goûts sans rapport, liés par un accident
     d'implémentation — le thème était le seul endroit qui savait basculer les
     sprites.
     C'est maintenant un choix à part, valable sur les trente-huit palettes.
     Il se gagne, parce que c'est le changement d'apparence le plus profond du
     site : il ne repeint pas l'interface, il remplace mille images. */
  {
    cle: "sprites",
    nom: "Style de sprite",
    onglet: "Sprites",
    aide: "Les images des Pokémon : le rendu 3D de HOME, ou le pixel art.",
    defaut: "3d",
  },
  /* Les mascottes ne se GAGNENT pas : leurs deux options sont ouvertes dès la
     première visite. Elles sont ici quand même, parce que c'est un choix
     d'apparence exactement comme les six autres, et qu'un réglage rangé
     ailleurs aurait été un réglage de plus à trouver. Le mécanisme est le
     même — un attribut sur <html>, le CSS fait le reste. */
  {
    cle: "mascottes",
    nom: "Mascottes",
    aide: "Les Pokémon du thème, au pied de la colonne et dans la barre « Filtres ».",
    defaut: "affichees",
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
  // La CLE reste « etoile » alors que le nom ne l est plus, exactement comme le
  // cadre du meme nom : elle est ecrite dans les preferences de quiconque porte
  // cette marque, et la renommer aurait remis tout le monde sur autre chose. Le
  // nom, lui, etait faux — cette marque est la seule qui prenne la couleur du
  // theme, et c est ce qui la definit, pas son signe.
  { cle: "etoile", type: "marque", nom: "Classique", succes: null },
  { cle: "coche", type: "marque", nom: "Coche", succes: "cent-complets" },
  { cle: "eclat", type: "marque", nom: "Éclat", succes: "cinq-cents-chromatiques" },
  { cle: "hexagone", type: "marque", nom: "Hexagone", succes: "toutes-regionales" },
  { cle: "fleur", type: "marque", nom: "Fleur", succes: "tous-cosmetiques" },
  { cle: "gemme", type: "marque", nom: "Gemme", succes: "cinq-cents-complets" },
  { cle: "couronne", type: "marque", nom: "Couronne", succes: "pokedex-entier" },

  /* ------------------------------- Cadres -------------------------------- */
  { cle: "aucun", type: "cadre", nom: "Aucun", succes: null },
  // La CLÉ reste « or » alors que le nom ne l'est plus : elle est écrite dans
  // les préférences de quiconque a déjà choisi ce cadre, et la renommer aurait
  // remis tout le monde sur « Aucun ». Le nom, lui, était faux — ce cadre est
  // peint en `--gold`, donc il prend la couleur de la palette et n'est doré que
  // sur celles qui le sont.
  { cle: "or", type: "cadre", nom: "Classique", succes: "mille-cases" },
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
  /* LES DEUX PREMIERS FONDS QUI BOUGENT. Les cinq autres sont des trames
     fixes ; ceux-ci tombent. Hoenn est la région de l'eau et de Kyogre, Sinnoh
     celle du Mont Couronné et de sa neige — la météo de chacune, en somme.
     Elles s'arrêtent sous `prefers-reduced-motion`, comme les six autres
     animations du site. */
  { cle: "pluie", type: "motif", nom: "Pluie", succes: "fanatique-3" },
  { cle: "neige", type: "motif", nom: "Neige", succes: "fanatique-4" },

  /* ------------------------------ Bandeaux ------------------------------- */
  { cle: "uni", type: "banniere", nom: "Uni", succes: null },
  { cle: "degrade", type: "banniere", nom: "Dégradé", succes: "moitie-du-dex" },
  { cle: "tricolore", type: "banniere", nom: "Tricolore", succes: "trois-generations" },
  { cle: "prisme", type: "banniere", nom: "Prisme", succes: "mille-chromatiques" },
  { cle: "or", type: "banniere", nom: "Or", succes: "tous-complets" },

  /* ------------------------------ Mascottes ------------------------------ */
  { cle: "affichees", type: "mascottes", nom: "Affichées", succes: null },
  { cle: "masquees", type: "mascottes", nom: "Masquées", succes: null },

  /* ------------------------------- Sprites --------------------------------
     UNYS, ET CE N'EST PAS UN TIRAGE AU SORT. Les images en pixels que le site
     affiche viennent du dossier `generation-v/black-white` de PokeAPI — ce sont
     littéralement les sprites de Pokémon Noir et Blanc, les derniers que la
     série ait dessinés à la main avant de passer à la 3D. La récompense et la
     région qui l'ouvre disent donc la même chose. */
  { cle: "3d", type: "sprites", nom: "3D (HOME)", succes: null },
  { cle: "pixels", type: "sprites", nom: "Pixel art", succes: "fanatique-5" },

  /* --------------------------------- Balls ---------------------------------
     LE DÉFAUT RESTE MONOCHROME, ET LES TROIS AUTRES SONT EN COULEUR. Ce n'est
     pas une inconséquence : la Poké Ball du bouton est un MASQUE peint par
     `currentColor`, donc elle suit l'état coché et les trente-huit palettes
     sans qu'on ait à en dessiner une variante. C'est une bonne solution, et
     personne qui n'a rien gagné ne doit voir son site changer.
     Mais le bouton fait douze pixels de côté, et à cette taille une silhouette
     de Ball ne se distingue pas d'une autre — seule la COULEUR se lit. Un
     masque aurait donc donné trois récompenses identiques. Les trois gagnées
     passent en image : c'est précisément ce que la récompense offre, la vraie
     Ball plutôt que son ombre.

     Kanto l'Hyper Ball parce que c'est là qu'elle est née ; Johto la Lune Ball
     parce que Johto est la région des Balls d'Apricot ; Paldea la Master Ball
     parce que c'est la dernière région, la plus grosse, et qu'on ne gaspille
     pas une Master Ball. */
  { cle: "poke", type: "ball", nom: "Poké Ball", succes: null },
  { cle: "hyper", type: "ball", nom: "Hyper Ball", succes: "fanatique-1" },
  { cle: "lune", type: "ball", nom: "Lune Ball", succes: "fanatique-2" },
  { cle: "master", type: "ball", nom: "Master Ball", succes: "fanatique-9" },

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
