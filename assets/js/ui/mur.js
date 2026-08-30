/**
 * mur.js — le mur des chromatiques, en grand.
 *
 * IL S'OUVRE EN PLEIN ÉCRAN, et pas dans un onglet. Un onglet aurait mis le mur
 * à côté des deux Pokédex, c'est-à-dire au milieu du travail ; or ce n'est pas
 * du travail, c'est le contraire. On l'ouvre, on regarde, on referme — la même
 * grammaire que la carte de partage, et pour la même raison.
 *
 * LES VIGNETTES SONT GRANDES. La grille en montre mille à cent cinquante
 * pixels ; le mur en montre quatre-vingts à cent quatre-vingts, ce qui est la
 * taille à laquelle un chromatique se distingue de son normal. Un Ptéra violet
 * et un Ptéra bleu ne se différencient pas à quarante pixels.
 *
 * AUCUN COMPTEUR « SUR COMBIEN ». C'est la seule page du site qui n'en a pas.
 * Un « 87 / 1025 » aurait retourné le mur en liste de courses.
 */

import { el, fill } from "../core/dom.js";
import { t, nomEspece, nomForme } from "../core/i18n.js";
import { spriteImg, formImg, cosmeticImg } from "../domain/sprites.js";
import { nomCosmetique } from "../core/i18n.js";
import { murDesChromatiques, murParGeneration } from "../domain/mur.js";
import { ouvrirPopup } from "./popup.js";

/**
 * Ouvre le mur.
 *
 * @param {Object} ctx `{ dataset, collection }`
 */
export function ouvrirMur(ctx) {
  const { dataset, collection } = ctx;
  const mur = murDesChromatiques(dataset.species, collection);
  const paquets = murParGeneration(mur, dataset.generations);

  return ouvrirPopup({
    titre: t("Mur des chromatiques"),
    // Le nombre EST le titre secondaire. Il ne dit pas « sur combien » — voir
    // l'en-tête du module — mais il dit ce qu'on regarde.
    sousTitre: mur.length
      ? `${mur.length} ${mur.length > 1 ? t("chromatiques") : t("chromatique")}`
      : t("Aucun pour l'instant"),
    large: true,
    corps: mur.length ? paquets.map(section) : [vide()],
  });
}

function section(paquet) {
  const titre = paquet.region ? t(paquet.region) : `${t("Génération")} ${paquet.gen}`;
  return el(
    "section.mur__section",
    el(
      "header.mur__tete",
      el("h3.mur__region", titre),
      el("span.mur__compte", String(paquet.entrees.length))
    ),
    el("div.mur__grille", paquet.entrees.map(vignette))
  );
}

/**
 * Une vignette : l'image chromatique, et son nom dessous.
 *
 * LE NOM EST ÉCRIT, pas mis en infobulle. Sur la grille l'infobulle suffit parce
 * qu'on cherche un Pokémon qu'on a en tête ; ici on ne cherche rien, on
 * parcourt — et un mur de sprites sans légende devient un test de connaissance.
 */
function vignette(entree) {
  return el(
    "figure.mur__item",
    el("span.mur__cadre", imageDe(entree)),
    el("figcaption.mur__nom", nomDe(entree))
  );
}

function imageDe(entree) {
  const classe = "mur__img";
  if (entree.sujet === "forme") {
    return formImg(entree.forme, { shiny: true, alt: "", className: classe });
  }
  if (entree.sujet === "cosmetique") {
    return cosmeticImg(entree.variant, entree.id, { shiny: true, alt: "", className: classe });
  }
  return spriteImg(entree.id, {
    shiny: true,
    female: entree.genre === "f",
    alt: "",
    className: classe,
  });
}

/**
 * Le nom d'une entrée, avec ce qui la distingue de sa voisine.
 *
 * Une espèce à dimorphisme apparaît deux fois : sans le ♂ et le ♀, le mur
 * montrerait « Nidoran » deux fois de suite sans qu'on sache pourquoi.
 */
function nomDe(entree) {
  const genre = entree.genre === "f" ? " ♀" : entree.genre === "m" ? " ♂" : "";
  if (entree.sujet === "forme") return nomForme(entree.forme) + genre;
  if (entree.sujet === "cosmetique") return nomCosmetique(entree.variant.name);
  return nomEspece(entree.espece) + genre;
}

/**
 * Le mur vide.
 *
 * Il dit ce qu'il faut faire pour le remplir, et non seulement qu'il est vide.
 * C'est le seul moment où cette page a le droit de parler d'objectif.
 */
function vide() {
  return el(
    "div.mur__vide",
    el("span.mur__vide-ico", { "aria-hidden": "true" }, "✦"),
    el("p.mur__vide-titre", t("Le mur est encore nu")),
    el(
      "p.mur__vide-aide",
      t("Coche la case Shiny d'un Pokémon et il viendra s'accrocher ici.")
    )
  );
}
