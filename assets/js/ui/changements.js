/**
 * changements.js — ce que la synchronisation vient de rapporter, en détail.
 *
 * LE BANDEAU DISAIT COMBIEN, PAS QUOI. « Mis à jour depuis le dépôt : 12 cases
 * cochées — Bulbizarre, Herbizarre +9 » : on apprend qu'il s'est passé quelque
 * chose, on ne sait pas quoi. Or c'est exactement la question qu'on se pose en
 * rentrant chez soi après avoir coché au téléphone — et la seule qui compte
 * quand des cases sont PERDUES, parce qu'une perte inattendue veut dire qu'il
 * faut aller voir.
 *
 * Le rapport existait déjà : `rapportDeChangement` dans `domain/collection.js`
 * rend chaque espèce touchée avec la liste exacte de ses cases gagnées et
 * perdues. Il ne manquait qu'un endroit où le lire.
 *
 * LES NOMS DE CASES VIENNENT DE `requiredSlots`, la même fonction qui nomme les
 * cases dans l'infobulle d'une vignette et dans la fiche. Une case s'appelle
 * donc « Méga-Dracaufeu X shiny ♀ » ici comme ailleurs, et le jour où un
 * libellé change, il change partout à la fois.
 */

import { el } from "../core/dom.js";
import { nomEspece, t, tn } from "../core/i18n.js";
import { requiredSlots } from "../domain/completion.js";
import { spriteImg } from "../domain/sprites.js";
import { ouvrirPopup } from "./popup.js";

/**
 * Le nom lisible de chaque case d'une espèce, indexé par sa clé.
 *
 * Reconstruit à chaque espèce plutôt que mis en cache : le panneau s'ouvre à la
 * main, sur quelques dizaines d'espèces au plus, et un cache de 1025 entrées
 * pour ça coûterait plus cher que ce qu'il économise.
 */
function libelles(espece) {
  const table = new Map();
  if (espece) for (const { slot, label } of requiredSlots(espece)) table.set(slot, label);
  // La mise de côté n'est pas une case de collection : elle voyage dans le même
  // objet — voir la clé réservée « hors » — mais elle décrit le DÉCOMPTE, pas
  // ce qu'on possède. Sans ce libellé elle se serait affichée sous sa clé brute.
  table.set("hors", t("Hors d'atteinte"));
  return table;
}

/**
 * Le sprite qui accompagne la ligne.
 *
 * IL SUIT LE THÈME, sans avoir à le savoir : `spriteImg` lit le drapeau posé
 * par `ui/theme.js` dans `domain/sprites.js`, et rend donc du pixel art sous
 * les palettes Pixels et du rendu HOME partout ailleurs. Une seule décision,
 * prise à un seul endroit, pour la trentaine de points d'appel.
 *
 * CHROMATIQUE QUAND LE CHANGEMENT L'EST. Si toutes les cases qui ont bougé
 * chez cette espèce sont des cases de chromatique, c'est le chromatique qu'on
 * montre : la ligne dit « + Shiny ♀ », il serait étrange qu'elle montre le
 * sprite normal à côté. Dès qu'une seule case normale bouge aussi, on revient
 * au sprite de base, qui est ce que la ligne décrit alors le plus souvent.
 *
 * `alt` vide et `aria-hidden` : le nom de l'espèce est écrit juste à côté, et
 * l'entendre deux fois de suite n'apprend rien.
 */
function portrait(entree, chromatiques) {
  if (!entree.espece) return null;
  const bougees = [...entree.gagnees, ...entree.perdues];
  const toutesChromatiques = bougees.length > 0 && bougees.every((slot) => chromatiques.has(slot));
  return el(
    "span.chgt__sprite",
    { "aria-hidden": "true" },
    spriteImg(entree.espece.id, { shiny: toutesChromatiques, alt: "", className: "chgt__img" })
  );
}

/**
 * Une espèce et ce qui a bougé chez elle.
 *
 * Exportée parce que le journal en affiche les mêmes : une entrée d'historique
 * n'est rien d'autre qu'un rapport ancien, et deux rendus differents auraient
 * fini par diverger sur le libellé d'une case ou le choix du sprite.
 */
export function ligneEspece(entree) {
  const cases = entree.espece ? requiredSlots(entree.espece) : [];
  const noms = libelles(entree.espece);
  const nom = (slot) => noms.get(slot) || slot;
  // `chromatique` est posé par `domain/completion.js`, seul endroit qui sache
  // quelles cases parlent d'un chromatique — voir le commentaire de
  // `buildSlots`. On ne le redéduit pas ici.
  const chromatiques = new Set(cases.filter((e) => e.chromatique).map((e) => e.slot));

  return el(
    "div.chgt__espece",
    portrait(entree, chromatiques),
    el(
      "div.chgt__corps",
      el(
        "div.chgt__tete",
        el("span.chgt__num", `#${String(entree.id).padStart(4, "0")}`),
        el("span.chgt__nom", entree.espece ? nomEspece(entree.espece) : `#${entree.id}`)
      ),
      el(
        "ul.chgt__cases",
        entree.gagnees.map((slot) =>
          el("li.chgt__case.chgt__case--plus", el("span.chgt__signe", { "aria-hidden": "true" }, "+"), nom(slot))
        ),
        entree.perdues.map((slot) =>
          el("li.chgt__case.chgt__case--moins", el("span.chgt__signe", { "aria-hidden": "true" }, "−"), nom(slot))
        )
      )
    )
  );
}

/**
 * Ouvre le détail d'un rapport de synchronisation.
 *
 * @param {{especes: Array, gagnees: number, perdues: number}} rapport
 */
export function ouvrirChangements(rapport) {
  if (!rapport || !rapport.especes.length) return;

  const compte = [];
  if (rapport.gagnees) {
    compte.push(`${rapport.gagnees} ${tn(rapport.gagnees, t("case cochée"), t("cases cochées"))}`);
  }
  if (rapport.perdues) {
    compte.push(`${rapport.perdues} ${tn(rapport.perdues, t("case décochée"), t("cases décochées"))}`);
  }

  ouvrirPopup({
    titre: t("Ce qui a changé"),
    sousTitre: `${compte.join(", ")} · ${rapport.especes.length} ${tn(
      rapport.especes.length,
      t("espèce"),
      t("espèces")
    )}`,
    icone: "↻",
    corps: [
      // Les PERTES d'abord quand il y en a. Un rapport qui commence par ce
      // qu'on a gagné se lit comme une bonne nouvelle, et on ferme ; or c'est
      // la ligne « − shiny » au milieu de trente gains qui demandait un regard.
      el(
        "div.chgt",
        rapport.perdues
          ? el(
              "p.chgt__alerte",
              t("Des cases ont été décochées ailleurs. Elles apparaissent en rouge ci-dessous.")
            )
          : null,
        rapport.especes
          .slice()
          .sort((a, b) => b.perdues.length - a.perdues.length || a.id - b.id)
          .map(ligneEspece)
      ),
    ],
  });
}
