/**
 * icones-succes.js — le jeu d'icônes des succès.
 *
 * UN TRACÉ, DEUX SURFACES.
 *
 * Chaque icône est une chaîne de commandes SVG sur une grille de 24 × 24, et
 * rien d'autre. C'est ce qui permet de la dessiner aux deux endroits où on en a
 * besoin sans jamais l'écrire deux fois :
 *
 *   - dans la page, en `<path d="…">` à l'intérieur d'un `<svg viewBox>` ;
 *   - sur la carte de partage, en `new Path2D(d)` — le constructeur du canvas
 *     accepte exactement la même syntaxe.
 *
 * Une icône rangée dans un fichier `.svg` séparé n'aurait pas eu cette
 * propriété : le canvas ne peut pas dessiner un fichier SVG sans le charger en
 * image, et une image chargée depuis un `<img>` ne se teinte pas. Ici la
 * couleur est celle du contexte, en `currentColor` d'un côté et en `strokeStyle`
 * de l'autre.
 *
 * TOUT EST EN TRAIT, PAS EN REMPLISSAGE.
 *
 * Trait de 2, bouts et jointures ronds, aucun aplat. C'est une contrainte qu'on
 * s'impose : elle rend les quarante-deux icônes cohérentes entre elles sans
 * qu'on ait à y penser, elle les garde lisibles à 20 pixels comme à 120, et
 * surtout elle les rend indépendantes du fond — un aplat aurait demandé une
 * couleur d'encre différente selon les trente-huit thèmes.
 *
 * `plein: true` marque les rares exceptions, celles dont la forme n'existe que
 * remplie : le point d'un centre de cible, un cœur.
 *
 * AUCUNE DE CES FORMES N'EST TIRÉE DU JEU. Ce sont des objets et des symboles
 * génériques — étoile, couronne, boussole, montagne. On ne redessine ici ni
 * logo, ni marque, ni créature.
 */

/**
 * Les tracés, par clé.
 *
 * L'ordre n'a aucune importance : c'est `domain/succes.js` qui décide quelle
 * icône va à quel succès, et plusieurs succès d'une même famille partagent la
 * leur — un palier de mille cases et un palier de deux mille racontent la même
 * chose, ils se distinguent par leur couleur et leur libellé, pas par un
 * dessin qu'il aurait fallu inventer différent pour rien.
 */
export const ICONES = {
  /* Mise a jour — redessinee d apres le logo fourni par l auteur : un disque
     plein, une fleche vers le haut et un trait evides dedans. Le fichier
     d origine est un PNG noir sur blanc opaque, sans transparence : impossible
     a colorer, et donc a accorder aux trente-huit palettes. Retrace en un seul
     chemin a regle `evenodd`, il prend `currentColor` comme les quarante-cinq
     autres. */
  /* --- les deux familles de customisation ajoutées avec les Fanatique --- */
  /* Une Poké Ball en TRAIT, et non en aplat : le grand cercle, la bande qui
     s'arrête de chaque côté du bouton, et le bouton. Trois sous-chemins et rien
     d'autre — c'est le dessin le plus reconnaissable de toute la série, il n'a
     besoin d'aucun détail pour se lire à quinze pixels. */
  ball: "M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M3.2 12h5.6M15.2 12h5.6M12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4",
  /* L'escalier de blocs : c'est LA signature du pixel art. Une diagonale y est
     forcément un escalier, faute de pouvoir tracer entre deux pixels — dire
     « sprite » par une grille aurait répété l'icône du fond de page, et par un
     Pokémon aurait demandé de choisir lequel. */
  pixel: "M3 15h4.5v4.5H3zM7.5 10.5H12V15H7.5zM12 6h4.5v4.5H12zM16.5 4.5H21V9h-4.5z",

  /* --- cocher, compter --- */
  case: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM8 12l2.8 2.8L16.5 9",
  grille: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13.5 16.8l2 2 4.2-4.2",
  pile: "M4 17.5l8 4 8-4M4 12.5l8 4 8-4M12 2.5l-8 4 8 4 8-4z",
  compteur: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 7v5l3.5 2",
  moitie: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 3v18M14.5 8h4M14.5 12h5M14.5 16h4",

  /* --- le chromatique --- */
  etincelle: "M12 3l1.9 5.4L19 10.3l-5.1 1.9L12 17.6l-1.9-5.4L5 10.3l5.1-1.9zM18 16l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z",
  etincelles: "M9 3l1.5 4.2L14.5 8.7l-4 1.5L9 14.4l-1.5-4.2L3.5 8.7l4-1.5zM17.5 11l1 2.7 2.7 1-2.7 1-1 2.7-1-2.7-2.7-1 2.7-1zM6 17l.7 1.8L8.5 19.5l-1.8.7L6 22l-.7-1.8L3.5 19.5l1.8-.7z",
  prisme: "M12 4l8.5 15h-17zM3 12h5.5M13.5 12.5l7-2M14 15h7M14.5 17.5l6.5 2",
  arcenciel: "M3 19a9 9 0 0 1 18 0M6.5 19a5.5 5.5 0 0 1 11 0M10 19a2 2 0 0 1 4 0",

  /* --- terminer --- */
  etoile: "M12 3.2l2.7 5.7 6.2.9-4.5 4.3 1.1 6.1L12 17.3l-5.5 2.9 1.1-6.1L3.1 9.8l6.2-.9z",
  couronne: "M3.5 8.5l4.2 3.2L12 5l4.3 6.7 4.2-3.2-2 10H5.5zM5.5 20h13",
  trophee: "M8 4h8v5a4 4 0 0 1-8 0zM8 5.5H5.2A2.2 2.2 0 0 0 5 10a4.5 4.5 0 0 0 3 1.8M16 5.5h2.8A2.2 2.2 0 0 1 19 10a4.5 4.5 0 0 1-3 1.8M12 13v4M9 20h6l-.7-3h-4.6z",
  medaille: "M8.5 3l3.5 6 3.5-6M7 3l5 8M17 3l-5 8M12 21a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z",
  laurier: "M8 20.5C4 18.5 2.5 14 3.5 9.5M16 20.5c4-2 5.5-6.5 4.5-11M8 20.5h8M5 8l3 1M4 12l3 .5M4.5 16l3-.5M19 8l-3 1M20 12l-3 .5M19.5 16l-3-.5",
  ruban: "M12 14.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zM8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5",
  drapeau: "M5 21V4M5 5h11l-2 3.5L16 12H5",
  infini: "M8.5 8.5a3.5 3.5 0 1 0 0 7c3.5 0 3.5-7 7-7a3.5 3.5 0 1 1 0 7c-3.5 0-3.5-7-7-7z",

  /* --- les paires, les genres --- */
  duo: "M9 16.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zM15 16.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10z",
  male: "M10 20a5 5 0 1 1 0-10 5 5 0 0 1 0 10zM13.8 11.2L20 5M14.5 4.5H20V10",
  femelle: "M12 15.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zM12 15.5V21M9 18.5h6",
  coeur: "M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.5 2.7c0 5.8-8.5 11.3-8.5 11.3z",
  oeuf: "M12 21c-3.6 0-6-2.6-6-6 0-4.4 2.7-12 6-12s6 7.6 6 12c0 3.4-2.4 6-6 6z",

  /* --- les régions --- */
  globe: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3c-5 6-5 12 0 18 5-6 5-12 0-18z",
  carte: "M9 3.5L3 6v14.5L9 18l6 2.5 6-2.5V6l-6 2.5zM9 3.5V18M15 8.5V20.5",
  boussole: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z",
  vague: "M3 8.5c2.5-2.5 4.5 2 7 0s4.5 2 7 0 2.5 2 4 1M3 14c2.5-2.5 4.5 2 7 0s4.5 2 7 0 2.5 2 4 1M3 19c2.5-2.5 4.5 2 7 0s4.5 2 7 0 2.5 2 4 1",
  montagne: "M2.5 19.5l6-11 4 6.5 2.5-4 6.5 8.5zM8.5 8.5l2.2 4M17.5 5.5a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z",
  tour: "M9 21V6l3-3 3 3v15M5.5 21V11l3.5-2M18.5 21V11L15 9M3 21h18M11 14h2",
  cristal: "M7 3h10l4 6-9 12L3 9zM3 9h18M7 3l2 6M17 3l-2 6M9 9l3 12M15 9l-3 12",
  desert: "M1.5 20.5h21M2 20.5c2-5 5-7 8-4s5 1 6-1 3-1 6 5M16.5 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  ville: "M4 21V9l5-3v15M14 21V4l6 3v14M3 21h18M6.5 12h1M6.5 15.5h1M16.5 10h1M16.5 14h1M16.5 18h1",

  /* --- les formes --- */
  geant: "M12 3l6 6h-3.5v4.5h-5V9H6zM5 17h14M5 21h14",
  metamorphose: "M4 8h11a4.5 4.5 0 0 1 0 9H9M4 8l3.5-3.5M4 8l3.5 3.5M9 17l3-3M9 17l3 3",
  palette: "M12 21a9 9 0 1 1 0-18c5 0 9 3.4 9 7.5 0 2.5-2 3.5-3.5 3.5H15a2 2 0 0 0-1.4 3.4c.5.6.4 1.6-.6 1.6zM7.5 11.5v.01M10 8v.01M14.5 8v.01M17 11v.01",
  papillon: "M12 5.5v13M12 7c-1.5-3-7-4-7 .5 0 4 4 4.5 7 4.5M12 7c1.5-3 7-4 7 .5 0 4-4 4.5-7 4.5M12 12c-3 0-6.5 1-6.5 4S9 20 12 18.5M12 12c3 0 6.5 1 6.5 4S15 20 12 18.5",
  masque: "M4 6.5h16v5a8.5 8.5 0 0 1-8 8.5 8.5 8.5 0 0 1-8-8.5zM8 11h.01M16 11h.01M9.5 15.5c1.5 1.2 3.5 1.2 5 0",

  /* --- la chasse --- */
  cible: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zM12 13.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z",
  chrono: "M12 21.5a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 9.5v4l2.5 1.5M9.5 2.5h5M19 6l1.8-1.8",
  loupe: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM16 16l5 5",
  carnet: "M4 4.5A1.5 1.5 0 0 1 5.5 3H19v14.5H5.5A1.5 1.5 0 0 0 4 19zM4 19a1.5 1.5 0 0 0 1.5 1.5H19v-3M8 8h7M8 11.5h5",
  de: "M6 3.5h12a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
  sablier: "M7 3h10M7 21h10M7.5 3v3.5L12 12l4.5-5.5V3M7.5 21v-3.5L12 12l4.5 5.5V21",
  eclair: "M13.5 2.5L5 13.5h6L10.5 21.5 19 10.5h-6z",
  flamme: "M12 21.5c-3.3 0-6-2.4-6-5.5 0-4 4-5.5 3-9.5 3 1 5 3 5 5.5 1-.8 1.5-2 1.5-3.5 2 2 2.5 4.5 2.5 7.5 0 3.1-2.7 5.5-6 5.5z",
  lune: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z",
  soleil: "M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zM12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8",

  /* --- l'en-tête ---
     Le rouage des réglages. Il ne sert à aucun succès : il est ici parce que le
     bouton de l'en-tête portait le caractère « ⚙ », dont la boîte de glyphe
     n'est pas centrée sur son dessin — le rouage tombait haut et à gauche dans
     son rond, quel que soit le centrage appliqué au bouton. Un tracé n'a pas ce
     défaut, et il ressemble enfin au trophée d'à côté. */
  /* Une note, pour la section des sons du menu de customisation. Aucune des
     quarante-deux autres ne disait « ceci s'entend » — l'étincelle du
     chromatique avait été essayée, et se lisait comme un effet visuel. */
  note: "M9 18.5a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5zM11.75 15.75V4.5l8-1.5v10.25M19.75 16a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0zM11.75 8.5l8-1.5",

  roue: "M12 15.4a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8zM10.4 2.9a1 1 0 0 1 1-.9h1.2a1 1 0 0 1 1 .9l.2 1.9 2 .8 1.5-1.2a1 1 0 0 1 1.3.1l.9.9a1 1 0 0 1 .1 1.3l-1.2 1.5.8 2 1.9.2a1 1 0 0 1 .9 1v1.2a1 1 0 0 1-.9 1l-1.9.2-.8 2 1.2 1.5a1 1 0 0 1-.1 1.3l-.9.9a1 1 0 0 1-1.3.1l-1.5-1.2-2 .8-.2 1.9a1 1 0 0 1-1 .9h-1.2a1 1 0 0 1-1-.9l-.2-1.9-2-.8-1.5 1.2a1 1 0 0 1-1.3-.1l-.9-.9a1 1 0 0 1-.1-1.3l1.2-1.5-.8-2-1.9-.2a1 1 0 0 1-.9-1v-1.2a1 1 0 0 1 .9-1l1.9-.2.8-2-1.2-1.5a1 1 0 0 1 .1-1.3l.9-.9a1 1 0 0 1 1.3-.1l1.5 1.2 2-.8z",
};

/**
 * Les icônes qui n'existent que remplies.
 *
 * Un cœur en trait est un contour de cœur, ce qui va ; un centre de cible en
 * trait est un anneau minuscule qui se bouche à l'affichage. Ces trois-là sont
 * donc peintes, et c'est la seule exception à la règle du trait.
 */
export const PLEINES = new Set(["coeur", "etoile", "eclair"]);

/* Les traces qui EVIDENT une forme dans une autre : sans `evenodd`, le creux se
   remplirait comme le plein et l icone serait une pastille pleine. L ensemble
   est vide depuis que la mise a jour porte le logo fourni plutot qu un trace,
   mais il reste nomme : la regle vaut pour la prochaine, et la retrouver
   couterait plus cher que de la garder. */
export const EVIDEES = new Set();

const REPLI = "etoile";

/** Le tracé d'une clé, avec un repli qui ne laisse jamais un trou. */
export function traceIcone(cle) {
  return ICONES[cle] || ICONES[REPLI];
}

/**
 * L'icône en `<svg>`, prête à poser dans la page.
 *
 * `aria-hidden` sans exception : l'icône double toujours un libellé écrit juste
 * à côté, et un lecteur d'écran qui annoncerait « image, étoile » avant « Premier
 * millier » ne ferait qu'allonger la phrase.
 *
 * On fabrique les nœuds par `createElementNS` et non par `innerHTML` : les
 * éléments SVG n'ont pas le même espace de noms que le HTML, et un `<svg>` posé
 * par `innerHTML` sur un conteneur HTML n'est pas rendu du tout.
 */
export function iconeSvg(cle, taille = 24) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", taille);
  svg.setAttribute("height", taille);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", "icone-succes");

  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", traceIcone(cle));
  if (PLEINES.has(cle)) {
    path.setAttribute("fill", "currentColor");
    if (EVIDEES.has(cle)) path.setAttribute("fill-rule", "evenodd");
  } else {
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
  }
  svg.append(path);
  return svg;
}

/**
 * La même icône sur un canvas, centrée sur (cx, cy) et mise à l'échelle.
 *
 * Le tracé est écrit sur 24 unités : on translate d'abord au coin haut-gauche
 * voulu, puis on met à l'échelle. L'ordre compte — mettre à l'échelle avant de
 * translater aurait multiplié la translation par le facteur, et les icônes
 * seraient parties hors de la carte.
 *
 * L'épaisseur du trait est divisée par le facteur pour rester de 2 unités APRÈS
 * la mise à l'échelle : sans cela, une icône dessinée à 44 pixels sortait avec
 * un trait de presque 4, deux fois trop gras pour le reste de la carte.
 */
export function dessinerIcone(c, cle, cx, cy, taille, couleur) {
  const facteur = taille / 24;
  c.save();
  c.translate(cx - taille / 2, cy - taille / 2);
  c.scale(facteur, facteur);
  const trace = new Path2D(traceIcone(cle));
  if (PLEINES.has(cle)) {
    c.fillStyle = couleur;
    c.fill(trace);
  } else {
    c.strokeStyle = couleur;
    c.lineWidth = 2;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.stroke(trace);
  }
  c.restore();
}
