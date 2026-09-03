/**
 * reste.js — « ce qu'il me reste », jeu par jeu.
 *
 * LE CLASSEMENT D'ABORD, LE DÉTAIL ENSUITE. Un sélecteur de jeu en tête aurait
 * demandé de connaître la réponse avant de poser la question : on ne sait pas
 * QUEL jeu ressortir, c'est précisément ce qu'on vient demander. Les
 * vingt-trois jeux sont donc classés d'emblée, et cliquer sur l'un d'eux ouvre
 * la liste de ce qu'il rapporte.
 *
 * DEUX BARRES PAR JEU, et non un pourcentage. « En sauvage » et « autrement »
 * sont deux efforts différents — une soirée contre vingt échanges — et un seul
 * nombre les aurait confondus. La barre pleine dit le sauvage, la barre pâle le
 * reste ; leur somme est le total.
 */

import { el, fill } from "../core/dom.js";
import { t, nomEspece } from "../core/i18n.js";
import { spriteImg } from "../domain/sprites.js";
import { classementDesJeux, resteDansLeJeu } from "../domain/reste.js";
import { ouvrirPopup } from "./popup.js";

/**
 * Ouvre le panneau.
 *
 * @param {Object} ctx `{ dataset, collection, complete }`
 */
export function ouvrirReste(ctx) {
  const { dataset, collection } = ctx;

  // « À PRENDRE » VEUT DIRE : SA CASE DE BASE N'EST PAS COCHÉE. Voir l'en-tête
  // de `domain/reste.js` — la table de disponibilité parle de l'espèce, pas de
  // ses formes ni de son chromatique, et compter les cases aurait promis des
  // choses fausses.
  const manque = (espece) => !collection.has(espece.id, espece.gd ? "om" : "om");

  const classement = classementDesJeux(dataset.species, manque, dataset.games);
  const aPrendre = dataset.species.filter(manque).length;
  const corps = el("div.reste");

  const peindre = (ouvert) => {
    fill(
      corps,
      el(
        "p.reste__chapeau",
        aPrendre
          ? `${aPrendre} ${t("espèces te manquent. Voici où les prendre.")}`
          : t("Il ne te manque plus rien : les vingt-trois jeux sont à zéro.")
      ),
      el(
        "ul.reste__liste",
        classement.map((ligne) => ligneDeJeu(ligne, ouvert === ligne.jeu.code, () =>
          peindre(ouvert === ligne.jeu.code ? null : ligne.jeu.code)
        ))
      )
    );
  };
  peindre(null);

  return ouvrirPopup({
    titre: t("Ce qu'il reste par jeu"),
    sousTitre: t("Par jeu, du plus rentable au moins"),
    large: true,
    corps: [corps],
  });
}

function ligneDeJeu(ligne, ouvert, surClic) {
  const { jeu, sauvage, autrement, total } = ligne;
  // L'échelle est celle du MEILLEUR jeu, pas celle du total à prendre : sur un
  // Pokédex presque fini, toutes les barres auraient été des traits d'un pixel.
  const max = Math.max(1, total);
  return el(
    "li.reste__jeu" + (ouvert ? ".reste__jeu--ouvert" : "") + (total ? "" : ".reste__jeu--vide"),
    el(
      "button.reste__entete",
      {
        type: "button",
        "aria-expanded": String(ouvert),
        onclick: surClic,
      },
      el("span.reste__nom", t(jeu.name)),
      el(
        "span.reste__barres",
        { title: `${sauvage.length} ${t("en sauvage")} · ${autrement.length} ${t("autrement")}` },
        el("span.reste__barre.reste__barre--sauvage", { style: { width: `${(sauvage.length / max) * 100}%` } }),
        el("span.reste__barre.reste__barre--autre", { style: { width: `${(autrement.length / max) * 100}%` } })
      ),
      el("span.reste__total", total ? String(total) : "—"),
      el("span.reste__chevron", { "aria-hidden": "true" }, ouvert ? "▾" : "▸")
    ),
    ouvert && total ? detail(sauvage, autrement) : null
  );
}

function detail(sauvage, autrement) {
  return el(
    "div.reste__detail",
    sauvage.length ? paquet(t("En sauvage"), t("Tu les croises dehors."), sauvage, "sauvage") : null,
    autrement.length
      ? paquet(t("Autrement"), t("Échange, évolution, cadeau ou événement."), autrement, "autre")
      : null
  );
}

function paquet(titre, aide, especes, genre) {
  return el(
    "section.reste__paquet",
    el(
      "header.reste__paquet-tete",
      el("h4.reste__paquet-titre", titre),
      el("span.reste__paquet-compte", String(especes.length))
    ),
    el("p.reste__paquet-aide", aide),
    el(
      "div.reste__especes",
      { dataset: { genre } },
      especes.map((espece) =>
        el(
          "span.reste__espece",
          { title: nomEspece(espece) },
          spriteImg(espece.id, { alt: "", className: "reste__img" }),
          el("span.reste__espece-nom", nomEspece(espece))
        )
      )
    )
  );
}
