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
 * OÙ LES METTRE : DEUX ESSAIS RATÉS AVANT LE BON.
 *
 * Premier essai, une grande figure en fond de page, au coin bas droit, réservée
 * aux écrans de plus de 1100 px — au motif qu'en dessous la grille couvre tout.
 * Sur un écran normal elle ne s'affichait donc JAMAIS.
 *
 * Deuxième essai, la même figure à toutes les largeurs. Elle s'affichait bien,
 * et on ne la voyait pas davantage : la colonne principale est une grille de
 * vignettes opaques, du haut de la page au bas de la page, quelle que soit la
 * taille de l'écran. Un fond n'existe que s'il reste du fond à voir.
 *
 * Troisième essai, celui-ci. On cherche les surfaces que RIEN ne recouvre :
 *
 *   - le pied de la barre latérale, qui a son propre fond opaque et reste
 *     visible en permanence sur grand écran ;
 *   - la barre « Filtres », qui la remplace en dessous de 860 px et qui est
 *     alors la seule chose fixe en haut de l'écran.
 *
 * Les vignettes y sont en PLEINE COULEUR et non en filigrane : sur une surface
 * qui leur appartient, une figure effacée n'aurait été qu'une tache.
 *
 * Le fond de page, lui, ne reçoit plus rien du tout. Il a porté un moment un
 * halo aux couleurs du thème, dont le seul rôle était d'ancrer la grande figure
 * pour qu'elle ne flotte pas comme une image collée. La figure partie, il ne
 * restait qu'une tache colorée dans un coin, sans rien à ancrer : une
 * décoration qui a perdu sa raison d'être ne devient pas neutre, elle devient
 * du bruit.
 *
 * ON NE CHARGE RIEN QUAND IL N'Y A RIEN À MONTRER. Les palettes « Base » et
 * « Couleurs » ne nomment aucun Pokémon : le décor se vide, et pas une requête
 * ne part. Les deux surfaces partagent les mêmes adresses, donc le navigateur
 * ne télécharge chaque artwork qu'une fois.
 */

import { el, fill } from "../core/dom.js";
import { artworkUrl } from "../domain/sprites.js";

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

  // Les deux surfaces que rien ne recouvre. On les remplit toutes les deux sans
  // condition, et c'est le CSS qui décide laquelle montrer : tester la largeur
  // ici aurait demandé de réagir aussi au redimensionnement, pour un résultat
  // que la feuille de style obtient seule. Les images étant les mêmes, le
  // navigateur ne télécharge chaque artwork qu'une fois.
  poser(document.getElementById("sidebar"), "decor-flanc", ids, figures);
  poser(document.getElementById("nav-toggle"), "decor-barre", ids, figures);
  // L'écran de chargement, troisième surface — et la première qu'on voit.
  //
  // Elle a ceci de particulier qu'elle n'existe que quelques centaines de
  // millisecondes, et qu'elle est peinte AVANT les données : `initTheme()`
  // tourne en tête de `main.js`, bien avant `boot()`. C'est justement ce qui
  // permet d'y montrer le trio — le thème, lui, est connu dès la première
  // ligne, il vient des préférences.
  poser(document.getElementById("boot"), "decor-boot", ids, figures);
}

/**
 * Pose — ou remplit — une bande de vignettes à la fin d'un hôte.
 *
 * On réutilise la bande existante plutôt que d'en refaire une : elle est créée
 * une fois pour la vie de la page, et changer de thème n'en remplace que le
 * contenu. La recréer aurait aussi défait la place qu'elle occupe dans la
 * colonne, ce qui se voit sur une barre latérale en `flex`.
 */
function poser(hote, classe, ids, figures) {
  if (!hote) return;
  let bande = hote.querySelector(`.${classe}`);
  if (!bande) {
    bande = el(`span.${classe}`, { "aria-hidden": "true" });
    hote.append(bande);
  }
  bande.dataset.n = String(ids.length);
  fill(bande, figures());
}
