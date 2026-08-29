/**
 * symboles-jeux.js — un emblème par jeu, dessiné à la main.
 *
 * Rien n'est téléchargé. Ce sont des formes géométriques originales qui
 * ÉVOQUENT un jeu sans reprendre son logo : une gemme taillée pour Rubis, deux
 * croissants pour Soleil / Lune, une épée et un bouclier croisés. Un logo
 * officiel est une marque déposée et un fichier dont on ne sait pas d'où il
 * vient ; ces vingt-trois-là pèsent quelques lignes et n'appartiennent qu'à ce
 * dépôt.
 *
 * UNE SEULE COULEUR, `currentColor`. Le symbole prend donc la teinte de son
 * contexte — celle du thème, quel qu'il soit, clair comme sombre. Deux couleurs
 * auraient été illisibles à la taille où on les affiche, et auraient figé une
 * palette parmi trente-huit.
 *
 * DANS UN MODULE JS, et non en fichiers séparés ni en feuille de sprites. Vingt-
 * trois fichiers, ce sont vingt-trois requêtes ; une feuille de sprites, c'est
 * une requête de plus et un `fetch` à gérer hors ligne. Ici le tout pèse trois
 * kilo-octets, part avec le graphe de modules et se retrouve pré-caché sans rien
 * demander.
 *
 * Tout est dessiné dans un carré de 24, et pensé pour rester lisible à 14 px :
 * pas de trait sous 1,5, pas de détail sous 2 de côté.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Le contenu de chaque emblème, clé = `code` de data/reference/games.json.
 *
 * Les 23 jeux y sont, et c'est vérifié à l'affichage : un code sans symbole ne
 * dessine rien plutôt que de casser la mise en page.
 */
const SYMBOLES = {
  /* Gen 1 — deux versions, deux disques qui se recouvrent. */
  rb: '<circle cx="9" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="15" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  /* Jaune — l'éclair de Pikachu, qui accompagnait le joueur. */
  y: '<path d="M13.6 2 6 13.4h4.6L9.8 22 18 10.2h-4.9L13.6 2Z" fill="currentColor"/>',

  /* Gen 2 — la Clochette et la Cloche, deux anneaux enlacés. */
  gs: '<circle cx="9.5" cy="9.5" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="14.5" cy="14.5" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  /* Cristal — un prisme taillé, avec son arête. */
  c: '<path d="M12 2 4 9.5 12 22l8-12.5L12 2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M4 9.5h16M12 2v20" stroke="currentColor" stroke-width="1.2"/>',

  /* Gen 3 — la gemme taillée en table. */
  rs: '<path d="M7 4h10l4 6-9 10-9-10 4-6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.2"/>',
  /* Émeraude — la taille à pans coupés, qui lui donne son nom. */
  e: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  /* Rouge Feu / Vert Feuille — une flamme et une feuille, dos à dos. */
  frlg: '<path d="M8 2.5c0 3.4-3.3 4.4-3.3 7.7A3.9 3.9 0 0 0 8.6 14c2.2 0 3.7-1.7 3.7-3.8 0-3.3-4.3-4.3-4.3-7.7Z" fill="currentColor"/><path d="M21 10c0 5.5-3.9 9.4-9 9.4 0-5.5 3.9-9.4 9-9.4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12.4 19.2 19 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  /* Colosseum / XD — l'arène, deux arcs face à face. */
  col: '<ellipse cx="12" cy="12" rx="9.5" ry="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="4.2" ry="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/>',

  /* Gen 4 — le losange du diamant et la rondeur de la perle. */
  dp: '<path d="M8 3 3 12l5 9 5-9-5-9Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="17" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  /* Platine — le lingot, coin d'un métal plus dur. */
  pt: '<path d="M5 8h14l-2.5 9h-9L5 8Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 12h10" stroke="currentColor" stroke-width="1.3"/>',
  /* HeartGold / SoulSilver — le cœur, seul jeu à en porter un. */
  hgss: '<path d="M12 20S3.5 14.6 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6C20.5 14.6 12 20 12 20Z" fill="currentColor"/>',

  /* Gen 5 — le noir et le blanc, un disque partagé. */
  bw: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
  /* Noir 2 / Blanc 2 — le même disque, marqué d'un cran. */
  b2w2: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/><path d="M12 8v8" stroke="currentColor" stroke-width="1.6"/>',

  /* Gen 6 — les deux lettres, qui sont le titre lui-même. */
  xy: '<path d="M3 4.5 10 12l-7 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 4.5 3 12 10 19.5M14 4.5l3.5 5 3.5-5M17.5 9.5v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  /* Oméga / Alpha — la lettre grecque du remake. */
  oras: '<path d="M7 20h3.2a7 7 0 1 1 3.6 0H17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',

  /* Gen 7 — le soleil et la lune, ensemble. */
  sm: '<circle cx="7" cy="12" r="3.4" fill="currentColor"/><path d="M7 5.4v1.6M7 17v1.6M.9 12h1.6M11.5 12h1.6M2.7 7.7l1.1 1.1M10.2 15.2l1.1 1.1M2.7 16.3l1.1-1.1M10.2 8.8l1.1-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M22 16.4a6.6 6.6 0 1 1-4.9-10.8 5.4 5.4 0 0 0 4.9 10.8Z" fill="currentColor"/>',
  /* Ultra-Soleil / Ultra-Lune — les mêmes, pris dans une faille. */
  usum: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  /* Let's Go — l'éclair, dans la Ball qu'on lançait au geste. */
  lgpe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h5M16 12h5" stroke="currentColor" stroke-width="1.8"/><path d="M13.4 5.5 8.8 13h3l-.6 5.5L16 11h-3l.4-5.5Z" fill="currentColor"/>',

  /* Gen 8 — l'épée et le bouclier, croisés. */
  swsh: '<path d="M20 3.5 9.5 14M6 17.5 4 20.5l3-2 1.6-1.6M7.4 15.9l1.7 1.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M9 4.2 14.6 6v5.6c0 3.4-2.4 5.7-5.6 6.8-3.2-1.1-5.6-3.4-5.6-6.8V6L9 4.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  /* Diamant Étincelant / Perle Scintillante — le losange, et l'éclat en plus. */
  bdsp: '<path d="M9 4 4.5 12 9 20l4.5-8L9 4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M18 4.5l1.1 2.9 2.9 1.1-2.9 1.1L18 12.5l-1.1-2.9L14 8.5l2.9-1.1L18 4.5Z" fill="currentColor"/>',
  /* Légendes Arceus — la roue, et ses seize rayons ramenés à quatre. */
  pla: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.4v3.4M12 17.2v3.4M3.4 12h3.4M17.2 12h3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',

  /* Gen 9 — les deux livres, l'Écarlate et le Violet. */
  sv: '<path d="M12 6.5S9.5 4 4 4v14c5.5 0 8 2.5 8 2.5s2.5-2.5 8-2.5V4c-5.5 0-8 2.5-8 2.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 6.5v14" stroke="currentColor" stroke-width="1.4"/>',
  /* Légendes Z-A — la lettre, et le A du titre. */
  za: '<path d="M4 4.5h8l-8 11h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 20 18.5 8l4 12M15.8 16.4h5.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
};

/**
 * L'emblème d'un jeu, prêt à être inséré.
 *
 * Rend `null` quand le code est inconnu : un jeu ajouté aux données sans son
 * symbole ne dessine alors rien du tout, au lieu de laisser un trou ou de casser
 * la ligne. L'appelant n'a rien à vérifier.
 *
 * `innerHTML` est employé sur une CONSTANTE de ce module, jamais sur une entrée
 * venue d'ailleurs — c'est la seule façon simple de poser du SVG, et elle est
 * sans risque tant que la source reste ce fichier.
 */
export function symboleJeu(code, taille = 14) {
  const contenu = SYMBOLES[code];
  if (!contenu) return null;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(taille));
  svg.setAttribute("height", String(taille));
  svg.setAttribute("class", "sym-jeu");
  // Purement décoratif : le nom du jeu est écrit juste à côté, et le faire lire
  // deux fois n'apprendrait rien.
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = contenu;
  return svg;
}

/** Les codes qui ont un symbole. Sert à vérifier la couverture des données. */
export function codesAvecSymbole() {
  return Object.keys(SYMBOLES);
}

/**
 * Le logo officiel de chaque jeu, fourni par l'auteur du site.
 *
 * Une VERSION par jeu, la première du couple : « Rouge » pour Rouge / Bleu,
 * « Épée » pour Épée / Bouclier. Montrer les deux aurait demandé deux fois la
 * place, pour une différence qu'on ne distingue pas à quinze pixels.
 *
 * Les fichiers sont ramenés à 96 px de côté : ils faisaient 500 px et pesaient
 * 2,8 Mo à eux tous, pour être affichés entre 16 et 26 px. À 96 ils couvrent
 * encore le triple de la taille d'affichage, donc les écrans très denses, et le
 * lot tient en 1,2 Mo.
 *
 * Ils ne sont PAS pré-cachés : le service worker ne précharge que la coquille,
 * et un mégaoctet d'images à l'installation aurait coûté plus qu'il ne rapporte.
 * Le gestionnaire `fetch` les range à la première visite qui les affiche.
 */
const LOGOS = {
  rb: "pokemon-red",
  y: "pokemon-yellow",
  gs: "pokemon-gold",
  c: "pokemon-crystal",
  rs: "pokemon-rubis",
  e: "pokemon-emerald",
  frlg: "pokemon-fire-red",
  col: "pokemon-colosseum",
  dp: "pokemon-diamond",
  pt: "pokemon-platinum",
  hgss: "pokemon-heartgold",
  bw: "pokemon-black",
  b2w2: "pokemon-black2",
  xy: "pokemon-x",
  oras: "pokemon-omegarubis",
  sm: "pokemon-sun",
  usum: "pokemon-ultrasun",
  lgpe: "pokemon-letsgopikachu",
  swsh: "pokemon-sword",
  bdsp: "pokemon-brilliantdiamond",
  pla: "pokemon-arceus",
  sv: "pokemon-scarlet",
  za: "pokemon-za",
};

/**
 * L'emblème d'un jeu : son logo quand il existe, le dessin sinon.
 *
 * Le repli n'est pas décoratif. Un jeu ajouté aux données sans son fichier
 * garderait un emblème lisible au lieu d'un carré vide, et les vingt-trois
 * dessins restent la seule chose qui suive la couleur du thème.
 *
 * `loading="lazy"` : le tableau de disponibilité en aligne vingt-trois d'un
 * coup, dont on ne voit que quelques-uns avant de faire défiler.
 */
export function embleme(code, taille = 15) {
  const fichier = LOGOS[code];
  if (fichier) {
    const img = document.createElement("img");
    img.src = `assets/img/jeux/${fichier}.png`;
    img.width = taille;
    img.height = taille;
    img.className = "sym-jeu sym-jeu--logo";
    img.loading = "lazy";
    img.decoding = "async";
    // Décoratif : le nom du jeu est écrit juste à côté, le faire lire deux fois
    // n'apprendrait rien.
    img.alt = "";
    return img;
  }
  return symboleJeu(code, taille);
}
