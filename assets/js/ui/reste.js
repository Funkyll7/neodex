/**
 * reste.js — « Manquant par jeu ».
 *
 * LE CLASSEMENT D'ABORD, LE DÉTAIL ENSUITE. Un sélecteur de jeu en tête aurait
 * demandé de connaître la réponse avant de poser la question : on ne sait pas
 * QUEL jeu ressortir, c'est précisément ce qu'on vient demander. Les
 * vingt-trois jeux sont donc classés d'emblée, et cliquer sur l'un d'eux ouvre
 * le détail de ce qu'il rapporte.
 *
 * ═══ CE QUE LE PANNEAU DISAIT AVANT, ET POURQUOI ON NE LE COMPRENAIT PAS ═══
 *
 * Il s'appelait « Ce qu'il reste par jeu » et affichait, par jeu, deux paquets
 * de vignettes : « en sauvage » et « autrement ». Trois choses manquaient, et
 * c'est la troisième qui rendait les deux premières illisibles :
 *
 *   1. il comptait des ESPÈCES et une seule case chacune. Un Pokémon dont il ne
 *      manque que le chromatique — le vrai travail, celui qui prend des heures —
 *      ne comptait pour rien ;
 *   2. il ne disait pas CE QUI manque. Une vignette de Florizarre pouvait
 *      vouloir dire « je ne l'ai pas du tout », « il me manque la femelle » ou
 *      « il me manque le shiny mâle » — trois soirées très différentes ;
 *   3. son titre promettait « ce qu'il reste », donc tout ce qu'il reste ; il
 *      montrait un sous-ensemble sans jamais dire lequel.
 *
 * Il dit maintenant, case par case : normal ou chromatique, l'espèce ou telle
 * forme, et ce que ce jeu-là ne peut PAS donner est compté à part plutôt que
 * passé sous silence. Le nom suit : « Manquant par jeu ».
 *
 * ═══ LES CHIPS PLUTÔT QU'UNE LISTE À PUCES ═══
 *
 * Une espèce a jusqu'à cent vingt-huit cases — Charmilly. Écrites en lignes,
 * elles auraient donné un panneau qu'on fait défiler pendant une minute pour un
 * seul Pokémon. En pastilles, elles se lisent d'un coup d'œil et se comptent
 * sans les lire : c'est un inventaire, pas une prose.
 *
 * LE CHROMATIQUE SE VOIT SANS SE LIRE. Sa pastille porte l'accent du site — la
 * même couleur que le reste du chromatique, partout ailleurs — et l'étoile qui
 * le désigne depuis toujours. On repère donc « il ne me manque que des shinies »
 * sans lire un mot.
 *
 * ═══ LES DLC SONT DES SOUS-GROUPES, PAS DES LIGNES DE PLUS ═══
 *
 * Sous un jeu, chaque espèce est rangée soit dans la cartouche, soit dans le
 * DLC sans lequel on ne l'a pas. Voir `domain/reste.js` : c'est `dlcRequis()`
 * qui tranche, la même fonction que le tableau de la fiche.
 */

import { el, fill } from "../core/dom.js";
import { t, deuxPoints, nomEspece } from "../core/i18n.js";
import { classementDesJeux } from "../domain/reste.js";
import { cosmeticImg, formImg, spriteImg } from "../domain/sprites.js";
import { ouvrirPopup } from "./popup.js";
import { logoDlc } from "./symboles-jeux.js";

/**
 * Ouvre le panneau.
 *
 * @param {Object} ctx `{ dataset, collection, complete }`
 */
export function ouvrirReste(ctx) {
  const { dataset, collection } = ctx;

  // TOUT LE CALCUL SE FAIT ICI, UNE FOIS. Le panneau se repeint à chaque
  // ouverture ou fermeture d'un jeu ; refaire le croisement à chaque clic
  // aurait relu les 1025 espèces pour ne changer qu'un chevron.
  const classement = classementDesJeux(dataset.species, collection, dataset.games, dataset.dlc);
  const casesEnTout = classement.reduce((n, ligne) => Math.max(n, ligne.totaux.cases), 0);
  const corps = el("div.reste");

  const peindre = (ouvert) => {
    fill(
      corps,
      el(
        "p.reste__chapeau",
        casesEnTout
          ? t(
              "Case par case, ce qui te manque dans chaque jeu. Le détail dit s'il te manque le normal, le chromatique, ou les deux — et pour quelle forme."
            )
          : t("Il ne te manque plus rien : les vingt-trois jeux sont à zéro.")
      ),
      el(
        "ul.reste__liste",
        classement.map((ligne) =>
          ligneDeJeu(ligne, ouvert === ligne.jeu.code, () =>
            peindre(ouvert === ligne.jeu.code ? null : ligne.jeu.code)
          )
        )
      )
    );
  };
  peindre(null);

  return ouvrirPopup({
    titre: t("Manquant par jeu"),
    sousTitre: t("Par jeu, du plus rentable au moins"),
    large: true,
    corps: [corps],
  });
}

function ligneDeJeu(ligne, ouvert, surClic) {
  const { jeu, totaux } = ligne;
  // L'échelle est celle du MEILLEUR jeu, pas celle du total à prendre : sur un
  // Pokédex presque fini, toutes les barres auraient été des traits d'un pixel.
  const max = Math.max(1, totaux.cases);
  return el(
    "li.reste__jeu" +
      (ouvert ? ".reste__jeu--ouvert" : "") +
      (totaux.cases ? "" : ".reste__jeu--vide"),
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
        {
          title: `${totaux.normal} ${t("normal")} · ${totaux.chromatique} ${t("chromatique")}`,
        },
        el("span.reste__barre.reste__barre--normal", {
          style: { width: `${(totaux.normal / max) * 100}%` },
        }),
        el("span.reste__barre.reste__barre--shiny", {
          style: { width: `${(totaux.chromatique / max) * 100}%` },
        })
      ),
      el("span.reste__total", totaux.cases ? String(totaux.cases) : "—"),
      el("span.reste__chevron", { "aria-hidden": "true" }, ouvert ? "▾" : "▸")
    ),
    ouvert && totaux.cases ? detail(ligne) : null
  );
}

function detail(ligne) {
  return el(
    "div.reste__detail",
    resume(ligne.totaux),
    ligne.groupes.map((groupe) => paquet(groupe, ligne.jeu))
  );
}

/**
 * La ligne de comptes du jeu.
 *
 * ELLE PORTE LES CASES, PAS LES ESPÈCES, parce que c'est l'unité du site
 * partout ailleurs — la barre latérale annonce « 1738 / 2806 cases cochées ».
 * Le nombre d'espèces reste affiché à côté : les deux répondent à deux
 * questions, « combien de soirées » et « combien de Pokémon ».
 */
function resume(totaux) {
  const morceaux = [
    [String(totaux.cases), t("cases")],
    [String(totaux.especes), t("espèces")],
    [String(totaux.normal), t("normal")],
    [String(totaux.chromatique), t("chromatique")],
  ];
  if (totaux.formes) morceaux.push([String(totaux.formes), t("formes")]);
  if (totaux.cosmetiques) morceaux.push([String(totaux.cosmetiques), t("cosmétiques")]);
  return el(
    "p.reste__resume",
    morceaux.map(([n, mot]) =>
      el("span.reste__compte", el("b.reste__compte-n", n), " ", mot)
    )
  );
}

/** Un groupe : la cartouche, ou l'un de ses contenus téléchargeables. */
function paquet(groupe, jeu) {
  const { dlc, entrees, totaux } = groupe;
  return el(
    "section.reste__paquet" + (dlc ? ".reste__paquet--dlc" : ""),
    el(
      "header.reste__paquet-tete",
      dlc ? logoDlc(dlc.code, t("Contenu téléchargeable"), 20) : null,
      el("h4.reste__paquet-titre", dlc ? t(dlc.name) : t("Jeu de base")),
      el("span.reste__paquet-compte", `${totaux.cases} ${t("cases")}`)
    ),
    el(
      "p.reste__paquet-aide",
      dlc
        ? t("Espèces que la cartouche seule ne donne pas.")
        : t("Espèces obtenables sans rien acheter de plus.")
    ),
    el(
      "ul.reste__especes",
      entrees.map((entree) => rangeeEspece(entree, jeu))
    )
  );
}

/**
 * Comment on l'obtient, en un mot et son explication.
 *
 * LES CLÉS VIENNENT DE `domain/reste.js`, les mots sont ici. La règle — « est-ce
 * sauvage, un cadeau, une évolution ? » — se déduit des données de jeu et n'a
 * rien à faire dans l'affichage ; le vocabulaire, lui, se traduit et n'a rien à
 * faire dans le métier.
 */
const METHODES = {
  sauvage: ["sauvage", "On la croise à l'état sauvage dans ce jeu."],
  evenement: ["événement", "Distribution officielle : elle ne se rencontre pas en jeu."],
  cadeau: ["cadeau", "Elle est remise, jamais rencontrée."],
  fixe: ["rencontre fixe", "Une rencontre unique, posée à un endroit précis."],
  evolution: ["évolution", "Elle s'obtient en faisant évoluer sa pré-évolution."],
  reproduction: ["reproduction", "Elle n'éclot que d'un Œuf : la Pension, jamais une rencontre."],
  echange: ["échange", "Ce jeu la contient, mais pas par une rencontre : échange ou transfert."],
};

/**
 * Une espèce et ses cases manquantes.
 *
 * ═══ LE NOM, PUIS COMMENT L'AVOIR, PUIS CE QUI MANQUE EN IMAGES ═══
 *
 * La ligne portait le sprite de l'espèce devant son nom, et les cases
 * manquantes derrière. Deux images pour la même bête, dont la première
 * n'apprenait rien : on venait de lire son nom. Pire, elle entrait en
 * concurrence avec les seules images qui comptent — celles des formes qui
 * manquent —, si bien qu'un Miaouss de Galar absent se lisait à côté d'un
 * Miaouss de Kanto présent, comme si les deux étaient en jeu.
 *
 * Le nom suffit donc à désigner l'espèce, et la place ainsi libérée va à ce
 * qu'on ne peut PAS déduire du nom : **comment on l'obtient ici**. « Sauvage »
 * et « échange » ne se préparent pas de la même façon, et c'est la première
 * chose qu'on veut savoir en choisissant quoi faire ce soir.
 *
 * Les sprites, eux, ne montrent plus que ce qui manque.
 */
function rangeeEspece(entree, jeu) {
  const { espece, manques, ailleurs, sauvage, methode } = entree;
  const [mot, aide] = METHODES[methode] || METHODES.echange;
  return el(
    "li.reste__espece" + (sauvage ? ".reste__espece--sauvage" : ""),
    el(
      "div.reste__espece-tete",
      el("span.reste__espece-nom", nomEspece(espece)),
      el(
        "span.reste__methode" + `.reste__methode--${methode}`,
        { title: t(aide) },
        t(mot)
      ),
      ailleurs
        ? el(
            "span.reste__ailleurs",
            {
              title: t(
                "Cases qui lui manquent aussi, mais que ce jeu ne peut pas donner — une forme plus récente, ou un chromatique verrouillé ici."
              ),
            },
            `+${ailleurs} ${t("ailleurs")}`
          )
        : null
    ),
    el(
      "ul.reste__cases",
      manques.map((manque) => caseManquante(manque, espece, jeu))
    )
  );
}

/**
 * Une case, en pastille.
 *
 * L'IMAGE EST CELLE DU SUJET, pas celle de l'espèce. Un « Miaouss de Galar
 * shiny » à côté du sprite de Miaouss de Kanto aurait demandé de lire le
 * libellé pour comprendre qu'il s'agit d'autre chose — or c'est justement ce
 * qu'on veut éviter en montrant une image. `formImg` et `cosmeticImg` savent
 * déjà se rabattre quand le sprite n'existe pas.
 */
function caseManquante(manque, espece, jeu) {
  const { label, chromatique, famille, forme, variant } = manque;
  const image = forme
    ? formImg(forme, { shiny: chromatique, alt: "", className: "reste__case-img" })
    : variant
      ? cosmeticImg(variant, espece.id, { shiny: chromatique, alt: "", className: "reste__case-img" })
      : spriteImg(espece.id, {
          shiny: chromatique,
          female: manque.genre === "f",
          alt: "",
          className: "reste__case-img",
        });
  return el(
    "li.reste__case" +
      (chromatique ? ".reste__case--shiny" : "") +
      `.reste__case--${famille}`,
    { title: deuxPoints(t(jeu.name), label) },
    image,
    el("span.reste__case-nom", label)
  );
}
