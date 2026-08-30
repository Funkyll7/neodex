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

/** Une espèce et ce qui a bougé chez elle. */
function ligne(entree) {
  const noms = libelles(entree.espece);
  const nom = (slot) => noms.get(slot) || slot;

  return el(
    "div.chgt__espece",
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
          .map(ligne)
      ),
    ],
  });
}
