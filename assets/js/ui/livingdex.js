/**
 * livingdex.js — les boîtes de HOME, dessinées.
 *
 * TROIS ÉTATS PAR CASE, ET PAS DEUX. « Je l'ai » et « je ne l'ai pas » suffirait
 * à HOME, où un Pokémon est là ou n'y est pas. Ici une espèce peut être cochée
 * en normal sans l'être en chromatique, et confondre ce cas avec « rien » aurait
 * fait paraître le Pokédex bien plus vide qu'il n'est :
 *
 *   vide       aucune case cochée — le sprite est éteint ;
 *   commencée  au moins une, pas toutes — le sprite est en couleur, la case
 *              porte un liséré ;
 *   terminée   toutes — le sprite est en couleur et la case s'allume.
 *
 * ON NE CHARGE PAS MILLE IMAGES D'UN COUP. Les trente-cinq boîtes font mille
 * vingt-cinq sprites : `loading="lazy"` les laisse arriver au fil du
 * défilement, exactement comme la grille.
 *
 * LE CLIC OUVRE LA FICHE, il ne coche rien. Une case de boîte fait quarante-six
 * pixels : y poser une case à cocher aurait donné une cible impossible sur
 * téléphone, et surtout la question qu'on se pose devant une boîte est « ça me
 * manque, où le trouver » — c'est la fiche qui répond.
 */

import { el, fill } from "../core/dom.js";
import { t, nomEspece } from "../core/i18n.js";
import { spriteImg } from "../domain/sprites.js";
import { rangerEnBoites, compterBoite } from "../domain/livingdex.js";
import { completionOf } from "../domain/completion.js";

/**
 * Dessine la vue.
 *
 * @param {HTMLElement} racine
 * @param {Object} ctx  `{ especes, chaines, collection, ordre, surChoix }`
 */
export function renderLivingDex(racine, ctx) {
  if (!racine) return;
  const { especes, chaines, collection, ordre, surChoix } = ctx;

  const boites = rangerEnBoites(especes, { ordre, chaines });
  // Le compte est fait UNE fois par espèce puis relu : `completionOf` alloue
  // deux tableaux, et la vue en appelle mille vingt-cinq. Sans ce cache, changer
  // de rangement recalculait tout deux fois — une pour les cases, une pour les
  // en-têtes de boîte.
  const etats = new Map();
  const etat = (e) => {
    let v = etats.get(e.id);
    if (!v) {
      const c = completionOf(e, collection);
      v = { done: c.done, total: c.total, complete: c.complete, entame: c.done > 0 };
      etats.set(e.id, v);
    }
    return v;
  };

  fill(
    racine,
    boites.map((boite) => {
      const compte = compterBoite(boite, (e) => etat(e).entame, (e) => etat(e).complete);
      return el(
        "section.boite",
        el(
          "header.boite__tete",
          el("h3.boite__nom", `${t("Boîte")} ${boite.numero}`),
          el(
            "span.boite__compte",
            { className: compte.manquantes === 0 ? "boite__compte boite__compte--pleine" : "boite__compte" },
            `${compte.pleines} / ${compte.cases}`
          )
        ),
        el(
          "div.boite__grille",
          { role: "list" },
          boite.cases.map((espece, rang) => (espece ? caseDeBoite(espece, etat(espece), surChoix) : caseVide(rang)))
        )
      );
    })
  );
}

function caseDeBoite(espece, etat, surChoix) {
  const nom = nomEspece(espece);
  const classes = etat.complete ? ".ldx--fini" : etat.entame ? ".ldx--entame" : ".ldx--vide";
  return el(
    `button.ldx${classes}`,
    {
      type: "button",
      role: "listitem",
      // Le titre porte le compte : sur une case de quarante-six pixels il n'y a
      // pas la place de l'écrire, et c'est pourtant l'information qui décide
      // si l'on clique.
      title: `${nom} · ${etat.done} / ${etat.total}`,
      "aria-label": `${nom}, ${etat.done} ${t("sur")} ${etat.total}`,
      onclick: () => surChoix && surChoix(espece.id),
    },
    spriteImg(espece.id, { alt: "", className: "ldx__img" }),
    el("span.ldx__num", String(espece.id).padStart(4, "0"))
  );
}

/**
 * Une case sans Pokémon.
 *
 * Elle n'existe que dans le rangement par famille, quand une lignée n'a pas tenu
 * dans la place restante. Retirée du flux d'accessibilité : ce n'est pas un trou
 * dans la collection, c'est un blanc de mise en page.
 */
function caseVide(rang) {
  return el("span.ldx.ldx--absente", { "aria-hidden": "true", dataset: { rang: String(rang) } });
}
