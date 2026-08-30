/**
 * decor-theme.js — les Pokémon du thème, en fond de page.
 *
 * Chaque palette porte déjà le nom d'un Pokémon ou d'un trio : Mewtwo, Ho-Oh,
 * les starters de Kanto. On ne le voyait que dans le menu des thèmes, sur une
 * vignette de trente pixels — une fois la palette choisie, le menu se referme et
 * il ne reste plus que des couleurs. Ce module donne au thème sa figure : le
 * Pokémon qui lui donne son nom occupe le coin bas droit de la page, très
 * effacé, derrière tout le reste.
 *
 * L'ARTWORK ET NON LE SPRITE. La vignette du menu tire un sprite de 96 pixels,
 * ce qui va pour trente. Agrandi à quatre cents, le même fichier donne une
 * bouillie — ou, avec `image-rendering: pixelated`, un gros pixel-art qui
 * contredit le reste de la page. L'artwork officiel fait 475 pixels de côté et
 * supporte cette taille sans rien montrer de sa grille.
 *
 * IL NE DOIT JAMAIS SE FAIRE REMARQUER. Trois précautions, et elles ne sont pas
 * décoratives :
 *
 *   - `pointer-events: none`, sinon la figure attraperait les clics destinés
 *     aux vignettes qui passent au-dessus ;
 *   - `aria-hidden`, parce qu'un lecteur d'écran n'a rien à faire d'un décor —
 *     et que les images n'ont pas de texte de remplacement, faute d'avoir quoi
 *     que ce soit à dire ;
 *   - une opacité qui descend avec la largeur de l'écran, parce que la grille y
 *     prend toute la place et qu'une figure trop marquée passerait de fond à
 *     désordre.
 *
 * DEUX SURFACES, PAS UNE. La figure de fond était d'abord réservée aux écrans
 * de plus de 1100 px, au motif qu'en dessous la grille couvre tout. Résultat :
 * sur un écran normal elle ne s'affichait JAMAIS, et le thème n'avait toujours
 * pas de visage. Elle s'affiche donc partout, plus discrète quand la place
 * manque — et sur mobile elle gagne un second emplacement, une bande de
 * vignettes à droite de la barre « Filtres », qui est la seule chose toujours
 * visible en haut de l'écran.
 *
 * ON NE CHARGE RIEN QUAND IL N'Y A RIEN À MONTRER. Les palettes « Base » et
 * « Couleurs » ne nomment aucun Pokémon : le décor se vide, et pas une requête
 * ne part. Les deux surfaces partagent les mêmes adresses, donc le navigateur
 * ne télécharge chaque artwork qu'une fois.
 */

import { el, fill } from "../core/dom.js";
import { artworkUrl } from "../domain/sprites.js";

/** Le conteneur, créé une fois et réutilisé à chaque changement de thème. */
let racine = null;

function conteneur() {
  if (racine && racine.isConnected) return racine;
  racine = el("div.decor", { "aria-hidden": "true" });
  // AVANT `#app` dans le document, et le CSS le range derrière : `body` peint
  // son propre fond, un décor posé plus bas dans l'empilement aurait donc
  // disparu dessous. Ici il se glisse entre le fond et l'application, dont les
  // panneaux gardent chacun le leur.
  document.body.prepend(racine);
  return racine;
}

/**
 * Accorde le décor au thème.
 *
 * @param {{sprite?: number|number[]}} theme  l'entrée de `ui/themes-list.js`
 */
export function majDecor(theme) {
  const ids = !theme || !theme.sprite ? [] : Array.isArray(theme.sprite) ? theme.sprite : [theme.sprite];

  const figures = () =>
    ids.map((id) =>
      el("img.decor__sprite", {
        src: artworkUrl(id),
        alt: "",
        // `lazy` serait un contresens : l'élément est en bas de l'écran, donc
        // toujours dans le champ, et le navigateur le chargerait tout de suite
        // en payant en plus le calcul de visibilité. `async` en revanche évite
        // que le décodage d'une image de 475 pixels bloque le rendu de la
        // grille, qui est ce qu'on est venu voir.
        decoding: "async",
      })
    );

  const boite = conteneur();
  boite.dataset.n = String(ids.length);
  fill(boite, figures());

  // La bande de la barre « Filtres ». Le bouton n'existe qu'en dessous de
  // 860 px, mais il est TOUJOURS dans le document : on le remplit sans
  // condition, et c'est le CSS qui décide de le montrer. Tester la largeur ici
  // aurait demandé de réagir aussi au redimensionnement, pour un résultat que
  // la feuille de style obtient seule.
  const barre = document.getElementById("nav-toggle");
  if (!barre) return;
  let bande = barre.querySelector(".decor-barre");
  if (!bande) {
    bande = el("span.decor-barre", { "aria-hidden": "true" });
    barre.append(bande);
  }
  bande.dataset.n = String(ids.length);
  fill(bande, figures());
}
