/**
 * livingdex.js — les boîtes de HOME et les lignées, dessinées.
 *
 * DEUX CASES PAR ESPÈCE, ET ELLES NE SE RESSEMBLENT PAS. Le normal et le
 * chromatique sont côte à côte, mais rien ne servirait de les montrer identiques
 * quand on ne les a pas : on ne saurait plus lequel manque. La case chromatique
 * porte donc son ✦, et son sprite est celui du chromatique — c'est la seule
 * façon de voir, en la remplissant, ce qu'on est en train de chasser.
 *
 * TROIS ÉTATS, ET UN QUATRIÈME QUI N'EN EST PAS UN :
 *
 *   pris        la case est cochée — sprite en couleur, fond allumé ;
 *   manquant    elle ne l'est pas — sprite éteint ;
 *   impossible  cette espèce n'a pas de chromatique. Ce n'est PAS un trou, et
 *               la confondre avec un manque aurait fait porter au Pokédex une
 *               centaine de cases qu'on ne peut pas remplir.
 *
 * ON NE CHARGE PAS DEUX MILLE IMAGES D'UN COUP : `loading="lazy"` les laisse
 * arriver au fil du défilement, exactement comme la grille.
 */

import { el, fill } from "../core/dom.js";
import { t, nomEspece, nomForme, nomCosmetique } from "../core/i18n.js";
import { spriteImg, formImg, cosmeticImg } from "../domain/sprites.js";
import { rangerEnBoites, rangerEnFamilles, compter } from "../domain/livingdex.js";

/**
 * Dessine la vue.
 *
 * @param {HTMLElement} racine
 * @param {Object} ctx `{ especes, chaines, collection, ordre, surChoix }`
 */
export function renderLivingDex(racine, ctx) {
  if (!racine) return;
  const { especes, chaines, collection, ordre, surChoix } = ctx;

  // UNE CASE DE LA VUE EST UNE CASE DE LA COLLECTION. Pas d'agrégat, pas de
  // « au moins une des deux » : on lit exactement le créneau que la case porte,
  // et c'est ce qui permet de la cocher d'un clic sans ambiguïté.
  const pris = (c) => collection.has(c.espece.id, c.slot);

  racine.dataset.ordre = ordre;
  if (ordre === "famille") {
    const lignes = rangerEnFamilles(especes, chaines);
    fill(racine, lignes.map((ligne) => ligneDeFamille(ligne, pris, surChoix)));
    return;
  }

  const boites = rangerEnBoites(especes);
  fill(
    racine,
    boites.map((boite) => {
      const c = compter(boite.cases, pris);
      return el(
        "section.boite",
        el(
          "header.boite__tete",
          el("h3.boite__nom", `${t("Boîte")} ${boite.numero}`),
          el(
            "span.boite__compte" + (c.manquantes === 0 ? ".boite__compte--pleine" : ""),
            `${c.faites} / ${c.total}`
          )
        ),
        el("div.boite__grille", { role: "list" }, boite.cases.map((k) => caseOuVide(k, pris, surChoix)))
      );
    })
  );
}

/**
 * Une lignée sur une ligne.
 *
 * LE NOM DE LA FAMILLE EST CELUI DE SON PREMIER MEMBRE, et non « famille
 * Bulbizarre » : la lignée d'Évoli en compte neuf, celle de Tarsal quatre dont
 * deux terminaisons — aucun mot ne les nomme mieux que leur base.
 */
function ligneDeFamille(ligne, pris, surChoix) {
  const c = compter(ligne.cases, pris);
  return el(
    "section.lignee" + (c.manquantes === 0 ? ".lignee--faite" : ""),
    el(
      "header.lignee__tete",
      el("h3.lignee__nom", nomEspece(ligne.membres[0])),
      el("span.lignee__compte", `${c.faites} / ${c.total}`)
    ),
    el(
      "div.lignee__membres",
      { role: "list" },
      // Un membre = son couple de cases. Les couples sont séparés par une
      // gouttière plus large que celle qui sépare les deux cases d'un même
      // Pokémon : c'est ce qui fait lire « Bulbizarre, puis Herbizarre » plutôt
      // qu'une file de six vignettes.
      ligne.membres.map((espece) =>
        el(
          "div.lignee__membre",
          el("div.lignee__paire", ligne.cases
            .filter((k) => k.espece === espece)
            .map((k) => caseOuVide(k, pris, surChoix))),
          el("span.lignee__nom-membre", nomEspece(espece))
        )
      )
    )
  );
}

/** Le nom de ce que porte une case : l'espèce, sa variante ou sa forme. */
function nomDe(k) {
  const genre = k.genre === "f" ? " ♀" : k.genre === "m" ? " ♂" : "";
  if (k.sujet === "forme") return nomForme(k.forme) + genre;
  if (k.sujet === "cosmetique") return nomCosmetique(k.variant.name);
  return nomEspece(k.espece) + genre;
}

/** L'image de ce que porte une case, dans la bonne teinte. */
function imageDe(k) {
  const o = { shiny: k.chromatique, alt: "", className: "ldx__img" };
  if (k.sujet === "forme") return formImg(k.forme, o);
  if (k.sujet === "cosmetique") return cosmeticImg(k.variant, k.espece.id, o);
  return spriteImg(k.espece.id, { ...o, female: k.genre === "f" });
}

/**
 * Une case.
 *
 * LE CLIC COCHE, il n'ouvre pas la fiche. C'était l'inverse au premier jet, et
 * c'était passer à côté : devant une boîte on ne se demande pas « qui est ce
 * Pokémon », on constate qu'il manque — ou qu'on vient de l'avoir. La vue
 * devient donc une surface de saisie, exactement comme les boutons de la
 * grille, et elle passe par le même chemin : `onToggle` enregistre de quoi
 * annuler, joue la note et déclenche la synchronisation.
 */
function caseOuVide(k, pris, surChoix) {
  if (!k) return el("span.ldx.ldx--absente", { "aria-hidden": "true" });

  const nom = nomDe(k);
  const quoi = k.chromatique ? t("Shiny") : t("Normal");
  const obtenu = pris(k);
  return el(
    `button.ldx${obtenu ? ".ldx--pris" : ".ldx--manque"}${k.chromatique ? ".ldx--shiny" : ""}`,
    {
      type: "button",
      role: "listitem",
      title: `${nom} · ${quoi}`,
      "aria-pressed": String(obtenu),
      "aria-label": `${nom}, ${quoi}`,
      onclick: () => surChoix && surChoix(k.espece.id, k.slot),
    },
    imageDe(k),
    k.chromatique ? el("span.ldx__marque", { "aria-hidden": "true" }, "✦") : null
  );
}
