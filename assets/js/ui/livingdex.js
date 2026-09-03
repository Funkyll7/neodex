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
 * UN SECOND GESTE POUR LA FICHE, PARCE QUE LE CLIC EST PRIS. Le clic coche — la
 * décision est expliquée là où elle s'applique, sur `caseOuVide`, et elle reste
 * la bonne. Elle avait pourtant une conséquence qu'on n'avait pas vue : aucune
 * des quatre vues qui passent par ce module — les boîtes et les lignées, dans
 * le Pokédex HOME comme dans le Pokédex GO — n'offrait le moindre moyen
 * d'OUVRIR la fiche d'un Pokémon. On savait dire « il manque », jamais « c'est
 * lequel, celui-là ». Trois gestes s'ajoutent donc, et aucun ne retire rien au
 * clic :
 *
 *   clic droit          sur ordinateur, à la place du menu du navigateur ;
 *   appui long          au doigt, ~450 ms sans que le doigt dérive ;
 *   Ctrl / Cmd + clic   pour qui a déjà les mains sur le clavier.
 *
 * ET LE GESTE EST ÉCRIT SUR LA CASE. Un geste caché n'existe pas : ni le clic
 * droit ni l'appui long ne laissent la moindre trace à l'écran, et rien d'autre
 * dans la vue ne pouvait les annoncer. Ils partent donc dans le `title` et dans
 * l'`aria-label` de chaque case, seuls endroits que la case possède en propre.
 *
 * ON NE CHARGE PAS DEUX MILLE IMAGES D'UN COUP : `loading="lazy"` les laisse
 * arriver au fil du défilement, exactement comme la grille.
 */

import { el, fill } from "../core/dom.js";
import { t, nomEspece, nomForme, nomCosmetique, nomEntreeGo } from "../core/i18n.js";
import { spriteImg, formImg, cosmeticImg } from "../domain/sprites.js";
import {
  rangerEnBoites,
  rangerEnFamilles,
  rangerGoEnBoites,
  rangerGoEnFamilles,
  compter,
} from "../domain/livingdex.js";
// LA MÊME BANDE QUE LA GRILLE, et non une copie. « GÉNÉRATION I — KANTO » se
// lit exactement pareil ici : c'est le même repère, il doit avoir le même
// dessin, le même compte et le même comportement collant. Deux fabriques
// auraient fini par diverger sur un détail — et c'est toujours celui qu'on
// remarque.
import { separateurGeneration } from "./dex-grid.js";

/**
 * Dessine la vue.
 *
 * UNE SEULE VUE POUR LES DEUX POKÉDEX. Les cases de GO ont exactement la forme
 * de celles de HOME — un sujet, un créneau, une teinte —, et c'est le
 * rangement, en amont, qui diffère. Écrire une seconde vue aurait dupliqué la
 * case, la boîte, la lignée et leurs trois états pour ne changer que la source.
 *
 * DEUX SORTIES ET NON UNE. `surChoix(id, slot)` coche la case visée ;
 * `surFiche(id)` ouvre la fiche de l'espèce, et c'est l'appelant qui sait où
 * cette fiche vit — dans le panneau de droite pour HOME, dans un AUTRE onglet
 * pour GO. La vue, elle, se contente de reconnaître les gestes.
 *
 * @param {HTMLElement} racine
 * @param {Object} ctx `{ dex, especes, entrees, chaines, collection, ordre, surChoix, surFiche }`
 */
export function renderLivingDex(racine, ctx) {
  if (!racine) return;
  const { dex = "home", especes, entrees, chaines, collection, ordre, surChoix, surFiche, sansGmax,
          generations, avancement, entete } = ctx;
  const go = dex === "go";
  /**
   * La bande de génération, posée devant ce qui l'inaugure.
   *
   * ELLE MANQUAIT ICI, et c'était un oubli et non un choix : on parcourt
   * quatre-vingt-douze boîtes ou cinq cent quarante et une lignées au pouce,
   * exactement le défilement pour lequel la grille s'était vu poser ce repère.
   * Sans lui, rien ne dit où Johto commence — et c'est justement ce qu'on
   * cherche en rangeant ses vraies boîtes.
   */
  /*
   * LA PREMIÈRE BANDE PARTAGE SA LIGNE AVEC LES OPTIONS.
   *
   * La case « Masquer les formes Gigamax » occupait une barre pleine largeur au
   * -dessus de la liste, et ça mangeait une ligne entière pour une seule case à
   * cocher. Elle vient donc se poser À DROITE de « GÉNÉRATION I — KANTO », dans
   * une bulle de même facture : deux pastilles distinctes sur une même ligne —
   * un repère à gauche, un réglage à droite — au lieu d'une barre et d'une
   * pastille empilées.
   *
   * `entete` est un nœud construit UNE FOIS par l'appelant et simplement
   * déplacé ici : on ne le reconstruit pas à chaque rendu, sans quoi la case
   * serait remplacée sous le doigt à l'instant où on la coche.
   */
  let entetePlacee = false;
  const bande = (gen) => {
    if (!gen) return null;
    const pastille = separateurGeneration(gen, generations, avancement);
    if (entetePlacee || !entete) return pastille;
    entetePlacee = true;
    return el("div.ldx-rang", pastille, entete);
  };
  // Le Pokédex GO ne connaît pas les Gigamax : l'option n'a de sens que pour
  // l'autre, et la lui passer quand même n'aurait rien retiré — mais aurait
  // laissé croire qu'elle joue ici aussi.
  const options = go ? null : { gmax: Boolean(sansGmax) };

  // UNE CASE DE LA VUE EST UNE CASE DE LA COLLECTION. Pas d'agrégat, pas de
  // « au moins une des deux » : on lit exactement le créneau que la case porte,
  // et c'est ce qui permet de la cocher d'un clic sans ambiguïté.
  const pris = (c) => collection.has(c.espece.id, c.slot);

  racine.dataset.ordre = ordre;
  if (ordre === "famille") {
    const lignes = go
      ? rangerGoEnFamilles(entrees, chaines)
      : rangerEnFamilles(especes, chaines, options);
    fill(
      racine,
      lignes.map((ligne) => [bande(ligne.genNouvelle), ligneDeFamille(ligne, pris, surChoix, surFiche)])
    );
    return;
  }

  const boites = go ? rangerGoEnBoites(entrees) : rangerEnBoites(especes, options);
  fill(
    racine,
    boites.map((boite) => {
      const c = compter(boite.cases, pris);
      return [
        bande(boite.genNouvelle),
        el(
        "section.boite",
        el(
          "header.boite__tete",
          el("h3.boite__nom", `${t("Boîte")} ${boite.numero}`),
          el(
            "span.boite__compte" + (c.manquantes === 0 ? ".boite__compte--pleine" : ""),
            `${c.faites} / ${c.total}`
          )
        ),
        el(
          "div.boite__grille",
          { role: "list" },
          boite.cases.map((k) => caseOuVide(k, pris, surChoix, surFiche))
        )
        ),
      ];
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
function ligneDeFamille(ligne, pris, surChoix, surFiche) {
  const c = compter(ligne.cases, pris);
  return el(
    "section.lignee" + (c.manquantes === 0 ? ".lignee--faite" : ""),
    el(
      "header.lignee__tete",
      el("h3.lignee__nom", nomEspece(ligne.membres[0].espece)),
      el("span.lignee__compte", `${c.faites} / ${c.total}`)
    ),
    el(
      "div.lignee__membres",
      { role: "list" },
      // Un membre = son couple de cases. Les couples sont séparés par une
      // gouttière plus large que celle qui sépare les deux cases d'un même
      // Pokémon : c'est ce qui fait lire « Bulbizarre, puis Herbizarre » plutôt
      // qu'une file de six vignettes.
      //
      // Le membre apporte SES cases, il ne les cherche plus dans celles de la
      // lignée : c'est ce qui permet aux trois Miaouss du Pokédex GO d'être
      // trois membres nommés plutôt qu'un bloc de six cases anonymes.
      ligne.membres.map((membre) =>
        el(
          "div.lignee__membre",
          el(
            "div.lignee__paire",
            membre.cases.map((k) => caseOuVide(k, pris, surChoix, surFiche))
          ),
          el("span.lignee__nom-membre", nomDeMembre(membre))
        )
      )
    )
  );
}

/**
 * Le nom sous un membre d'une lignée.
 *
 * Le Pokédex GO range des BOÎTES et non des espèces : sous une case de Miaouss
 * d'Alola il faut lire « Miaouss d'Alola », pas « Miaouss ». `nomEntreeGo` sait
 * déjà le composer — c'est celui que la grille GO affiche.
 */
function nomDeMembre(membre) {
  return membre.entree ? nomEntreeGo(membre.entree) : nomEspece(membre.espece);
}

/** Le nom de ce que porte une case : l'espèce, sa variante ou sa forme. */
function nomDe(k) {
  if (k.entree) return nomEntreeGo(k.entree);
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
 * Le temps qu'il faut tenir pour que ce soit un appui long, en millisecondes.
 *
 * 450 ms : bien au-dessus de l'effleurement qui voulait cocher, et JUSTE en
 * dessous des ~500 ms où Android sort son propre menu contextuel. L'ordre
 * compte — le nôtre arrive le premier, et le `contextmenu` du système, quand il
 * arrive derrière, trouve le travail déjà fait et n'a plus qu'à se taire.
 */
const APPUI_LONG_MS = 450;

/**
 * Ce qu'un doigt a le droit de bouger sans cesser d'être un appui.
 *
 * Dix pixels : un doigt posé sur du verre tremble toujours un peu, et une vue
 * de deux mille huit cents cases se parcourt justement en glissant dessus. Sans
 * cette tolérance, ou bien le moindre frémissement annulait l'appui, ou bien
 * chaque défilement ouvrait une fiche au hasard.
 */
const DERIVE_MAX_PX = 10;

/**
 * Les trois gestes qui ouvrent la fiche, posés sur une case.
 *
 * DEUX SONT GRATUITS, LE TROISIÈME SE MESURE. Le clic droit et Ctrl / Cmd +
 * clic, le navigateur les distingue déjà du clic simple : il n'y a qu'à les
 * écouter. L'appui long, lui, n'existe pas — il faut le reconnaître, et c'est
 * là que sont tous les pièges :
 *
 *   - le doigt qui DÉRIVE ne demandait rien, il faisait défiler la page.
 *     Au-delà de dix pixels le compte s'arrête ;
 *   - le doigt qui se LÈVE avant l'échéance voulait cocher. Même arrêt, et le
 *     clic part normalement ;
 *   - le doigt qui a TENU a déjà obtenu sa fiche. Le clic que le navigateur
 *     émet parfois derrière cocherait la case par-dessus : on l'avale.
 *
 * LES ÉVÉNEMENTS POINTER ET NON TOUCH. Ils portent la souris, le doigt et le
 * stylet sous un seul nom — donc un seul chemin à écrire —, et surtout
 * `pointercancel` dit ce qu'aucun événement touch ne sait dire : « le
 * navigateur me reprend ce geste pour défiler ». C'est exactement le cas qu'il
 * fallait attraper.
 *
 * LES TROIS ÉCOUTEURS D'ANNULATION VIVENT SUR LA FENÊTRE, et seulement le temps
 * de l'appui. Posés sur la case, ils auraient coûté trois écouteurs de plus sur
 * chacune des deux mille huit cents cases de la vue ; surtout, ils auraient
 * raté le doigt qui glisse HORS de la case avant de se lever, c'est-à-dire le
 * défilement le plus banal. Un `AbortController` les retire tous les trois d'un
 * geste, sans avoir à garder trois références de fonctions.
 *
 * @param {Function} ouvrir  ouvre la fiche de l'espèce de cette case
 * @param {Function} cocher  coche (ou décoche) cette case
 */
function gestesDeFiche(ouvrir, cocher) {
  // L'état est celui de CETTE case, dans cette fermeture. Une case doit savoir
  // que c'est elle qu'on tient, et son écouteur de clic doit savoir ce que
  // l'appui long vient de faire une fraction de seconde plus tôt.
  let minuteur = null;
  let veille = null;
  let ouverteParAppui = false;

  function oublier() {
    if (minuteur !== null) clearTimeout(minuteur);
    minuteur = null;
    if (veille) veille.abort();
    veille = null;
  }

  return {
    /**
     * Le clic droit remplace le menu du navigateur. `preventDefault` d'abord :
     * sans lui on obtiendrait la fiche ET « Enregistrer l'image sous… » posé
     * par-dessus, ce qui n'est un service pour personne.
     */
    oncontextmenu: (event) => {
      event.preventDefault();
      // SUR TÉLÉPHONE, CE `contextmenu` EST LA FIN DE L'APPUI LONG — pas un
      // geste de plus. Les deux ordres d'arrivée existent selon l'appareil :
      // notre minuteur d'abord (la fiche est déjà ouverte, on ne la rouvre
      // pas), ou le sien d'abord (un doigt est encore posé : c'est nous qui
      // ouvrons, et le minuteur n'aura plus à le faire). Dans les deux cas le
      // drapeau reste levé pour avaler le clic que certains navigateurs
      // émettent quand même derrière.
      //
      // À la souris, aucun des deux n'est vrai : le drapeau ne se lève pas, et
      // il ne traîne donc pas jusqu'au clic gauche suivant.
      const dejaOuverte = ouverteParAppui;
      const doigtPose = minuteur !== null;
      oublier();
      if (dejaOuverte || doigtPose) ouverteParAppui = true;
      if (!dejaOuverte) ouvrir();
    },

    onpointerdown: (event) => {
      // Un nouvel appui repart de zéro, quel que soit le bouton : le drapeau ne
      // doit jamais survivre au geste qui l'a levé, sinon le clic suivant se
      // ferait avaler pour rien.
      oublier();
      ouverteParAppui = false;
      // L'APPUI LONG EST UN GESTE DE DOIGT. À la souris, tenir le bouton une
      // demi-seconde est un clic lent — pas une demande de fiche —, et cocher
      // une case au ralenti est très exactement ce qu'on fait quand on vise une
      // case de 26 px. La souris a déjà ses deux chemins à elle.
      if (event.pointerType === "mouse" || event.button !== 0) return;

      const x = event.clientX;
      const y = event.clientY;
      veille = new AbortController();
      const options = { signal: veille.signal };
      window.addEventListener(
        "pointermove",
        (e) => {
          if (Math.hypot(e.clientX - x, e.clientY - y) > DERIVE_MAX_PX) oublier();
        },
        options
      );
      window.addEventListener("pointerup", oublier, options);
      window.addEventListener("pointercancel", oublier, options);

      minuteur = setTimeout(() => {
        oublier();
        ouverteParAppui = true;
        ouvrir();
      }, APPUI_LONG_MS);
    },

    onclick: (event) => {
      // Ctrl / Cmd + clic, pour qui a déjà les mains sur le clavier. Sur Mac,
      // Ctrl + clic est un clic droit : il sera passé par `oncontextmenu` et ce
      // clic-ci n'arrivera même pas. C'est Cmd qui y répond là-bas.
      if (event.ctrlKey || event.metaKey) {
        ouvrir();
        return;
      }
      // L'appui long a déjà ouvert la fiche : ce clic-ci est son résidu, et le
      // laisser passer cocherait la case qu'on voulait seulement consulter.
      if (ouverteParAppui) {
        ouverteParAppui = false;
        return;
      }
      cocher();
    },
  };
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
 *
 * LA FICHE N'EST DONC PAS PERDUE, ELLE EST DEUXIÈME. Voir `gestesDeFiche` pour
 * les trois gestes qui la rouvrent, et l'en-tête du module pour la raison.
 */
function caseOuVide(k, pris, surChoix, surFiche) {
  if (!k) return el("span.ldx.ldx--absente", { "aria-hidden": "true" });

  const nom = nomDe(k);
  const quoi = k.chromatique ? t("Shiny") : t("Normal");
  const obtenu = pris(k);
  // LE GESTE EST DIT, SUR CHAQUE CASE. Un clic droit et un appui long ne
  // laissent aucune trace à l'écran : sans cette phrase dans l'infobulle et
  // dans le nom accessible, la fiche resterait inatteignable depuis les boîtes
  // pour quiconque n'a pas lu ailleurs qu'elle existe — c'est-à-dire pour tout
  // le monde. C'est le seul endroit que la case possède en propre ; un mode
  // d'emploi posé au-dessus des boîtes, lui, se lit une fois et s'oublie.
  const geste = t("appui long ou clic droit pour ouvrir la fiche");
  return el(
    `button.ldx${obtenu ? ".ldx--pris" : ".ldx--manque"}${k.chromatique ? ".ldx--shiny" : ""}`,
    {
      type: "button",
      role: "listitem",
      title: `${nom} · ${quoi} — ${geste}`,
      "aria-pressed": String(obtenu),
      "aria-label": `${nom}, ${quoi}, ${geste}`,
      ...gestesDeFiche(
        () => surFiche && surFiche(k.espece.id),
        () => surChoix && surChoix(k.espece.id, k.slot)
      ),
    },
    imageDe(k),
    // LE SEXE À GAUCHE, LA TEINTE À DROITE, et seulement quand ils distinguent
    // quelque chose. Les cent deux espèces à dimorphisme occupent quatre cases
    // au lieu de deux ; sans le ♂ et le ♀, quatre Florizarre à la file ne se
    // distinguaient que par une nuance de sprite qu'on ne voit pas à cette
    // taille. Les 923 autres espèces n'ont pas de marque : une pastille qui ne
    // dit rien est du bruit.
    //
    // Les deux couleurs sont celles que le site emploie déjà pour le sexe —
    // `--pair` et `--female`, celles des boutons de la fiche. On les LIT, on ne
    // les redéfinit pas : elles sont un repère appris, pas une décoration.
    k.genre
      ? el(
          `span.ldx__sexe${k.genre === "f" ? ".ldx__sexe--f" : ""}`,
          { "aria-hidden": "true" },
          k.genre === "f" ? "♀" : "♂"
        )
      : null,
    k.chromatique ? el("span.ldx__marque", { "aria-hidden": "true" }, "✦") : null
  );
}
