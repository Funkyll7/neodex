/**
 * parametres.js — le panneau des réglages qui ne sont ni la langue ni le thème.
 *
 * Il y avait trois boutons dans l'en-tête, et chacun faisait UNE chose : couper
 * le son, changer de langue, ouvrir la palette. Ça marche tant qu'il n'y a que
 * trois réglages. Le quatrième — la densité de la grille — n'avait aucune place
 * où aller : ce n'est pas une bascule qu'on veut voir en permanence, et la barre
 * latérale ne fait que 268 px.
 *
 * D'où ce panneau. Le son y descend avec la densité, parce qu'ils sont de la
 * même famille : des préférences d'appareil, qu'on règle une fois et qu'on
 * oublie. La langue et le thème restent dehors — on en change souvent, et pour
 * le thème c'est même le geste le plus fréquent du site.
 *
 * IL S'OUVRE COMME LA PALETTE, exprès : même bouton à bascule avec
 * `aria-expanded`, même fermeture au clic extérieur et à Échap. Deux panneaux
 * qui s'ouvrent différemment dans la même barre, c'est un panneau de trop à
 * apprendre.
 *
 * CHAQUE RÉGLAGE EST APPLIQUÉ AU DOCUMENT, pas rendu par du JavaScript. Le mode
 * compact pose `data-compact` sur `<html>` et le CSS fait le reste : aucune
 * vignette n'est reconstruite, la grille change d'apparence en une image. C'est
 * aussi ce qui le rend gratuit à l'usage — basculer 1025 vignettes ne coûte
 * qu'un attribut.
 */

import { el, fill } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { reglage, poserReglage } from "../core/prefs.js";
import { nomDeCetAppareil, nomDeduit, poserNomDeCetAppareil } from "../core/appareil.js";
import { LONGUEUR_MAX } from "../domain/source.js";
import { jouer, sonsActifs, basculerSons } from "./sons.js";
import { iconeSvg } from "./icones-succes.js";
import { ouvrirJournal } from "./journal.js";
import { lireJournal } from "../domain/journal.js";

/**
 * Les réglages du panneau, dans l'ordre d'affichage.
 *
 * `lire` et `poser` plutôt qu'un simple nom de clé : les sons ne se rangent pas
 * comme les autres. Leur préférence s'appelle `sons`, mais `ui/sons.js` en est
 * propriétaire — c'est lui qui la lit à chaque note jouée, et lui seul doit
 * décider de ce que « absent » veut dire. Le panneau lui parle, il ne lui passe
 * pas devant.
 */
const REGLAGES = [
  {
    cle: "sons",
    titre: "Sons",
    aide: "Un retour discret à chaque case cochée, plus marqué pour un chromatique.",
    lire: () => sonsActifs(),
    poser: () => basculerSons(),
    // Un aperçu à l'activation : sans lui, on coche et on décoche sans jamais
    // savoir ce qu'on vient de choisir.
    apercu: (actif) => actif && jouer("shiny"),
  },
  {
    cle: "compact",
    titre: "Mode compact",
    aide: "Des vignettes réduites au sprite, au numéro et aux cases : on en voit trois fois plus d'un coup d'œil.",
    lire: () => reglage("compact", false),
    poser: () => poserReglage("compact", !reglage("compact", false)),
    apercu: () => jouer("theme"),
  },
];

/**
 * Applique les réglages au document.
 *
 * Appelé au démarrage AVANT le premier rendu, et à chaque bascule. Poser
 * l'attribut plus tôt que le contenu évite le clignotement : la grille naît
 * déjà compacte au lieu de le devenir sous les yeux.
 */
export function appliquerParametres() {
  document.documentElement.toggleAttribute("data-compact", reglage("compact", false));
}

/** Le panneau et son bouton. */
let contexte = null;

/**
 * Le jeu de donnees, pose par `main.js`.
 *
 * Pose et non importe : ce module est initialise avant le chargement des
 * donnees, et le journal n en a besoin qu au moment ou on l ouvre — c est-a-dire
 * bien apres. Meme mecanique que `poserSourceDesSucces` dans `ui/recompenses.js`,
 * et pour la meme raison : eviter un import qui obligerait a attendre.
 */
export function poserContexteParametres(ctx) {
  contexte = ctx;
}

export function initParametres() {
  const bouton = document.getElementById("settings-toggle");
  const panneau = document.getElementById("settings-panel");
  if (!bouton || !panneau) return;

  // Le rouage vient d'ici et non du caractère « ⚙ » écrit dans le HTML : la
  // boîte de ce glyphe n'est pas centrée sur son dessin, et il tombait haut et
  // à gauche dans son rond quel que soit le centrage appliqué au bouton. Un
  // tracé n'a pas ce défaut, et il s'accorde au trophée d'à côté.
  fill(bouton, iconeSvg("roue", 17));

  const ouvrir = (etat) => {
    panneau.hidden = !etat;
    bouton.setAttribute("aria-expanded", String(etat));
    if (etat) dessiner();
  };

  function dessiner() {
    fill(
      panneau,
      el("h3.panel__label", t("Réglages de cet appareil")),
      ...REGLAGES.map((r) => ligne(r)),
      champAppareil(),
      // LE JOURNAL EST UNE ACTION, PAS UN RÉGLAGE, d'où la ligne séparée sous
      // les bascules plutôt qu'une case de plus. Il vit ici quand même parce
      // que c'est le seul panneau qui parle de CET appareil, et que le journal
      // est justement local — il ne suit pas la collection d'un écran à
      // l'autre. Le compte est sur le bouton : sans lui, on ne sait pas s'il y
      // a quelque chose à voir avant de l'ouvrir.
      el(
        "button.param__action",
        {
          type: "button",
          onclick: () => {
            ouvrir(false);
            ouvrirJournal(contexte && contexte.dataset);
          },
        },
        el("span.param__action-icone", { "aria-hidden": "true" }, iconeSvg("carnet", 16)),
        el(
          "span.param__action-texte",
          el("span.param__titre", t("Journal des modifications")),
          el("span.param__aide", t("Tout ce qui a été coché ici ou reçu d'un autre appareil, jour par jour."))
        ),
        el("span.param__action-compte", String(lireJournal().length))
      ),
      // Les réglages ne partent pas dans le dépôt, et il faut le dire : sinon
      // on suppose que couper le son sur le téléphone le coupe partout.
      el("p.param__note", t("Ces réglages restent dans ce navigateur : ils ne suivent pas ta collection d'un appareil à l'autre."))
    );
  }

  function ligne(r) {
    const actif = r.lire();
    const id = `param-${r.cle}`;
    const entree = el("input.param__case", {
      type: "checkbox",
      id,
      checked: actif,
      onchange: () => {
        const suivant = r.poser();
        appliquerParametres();
        if (r.apercu) r.apercu(suivant);
        // On redessine le panneau entier plutôt que la seule case : `sonsActifs`
        // peut refuser d'être changé — stockage bloqué —, et l'affichage doit
        // alors dire la vérité, pas ce qu'on a demandé.
        dessiner();
        document.dispatchEvent(new CustomEvent("funkylldex:parametres", { detail: { cle: r.cle, actif: suivant } }));
      },
    });
    return el(
      "div.param",
      entree,
      el(
        // `for` et non `htmlFor` : `core/dom.js` ne connaît `htmlFor` ni comme
        // propriété ni comme alias, il le poserait donc en ATTRIBUT — et un
        // attribut « htmlfor » ne relie rien. Ces deux étiquettes, Sons et Mode
        // compact, ne l'étaient plus depuis leur écriture : cliquer sur le
        // titre ou sur l'explication ne cochait pas la case, alors que le
        // commentaire de `.param__label` dans la feuille de style promet
        // exactement l'inverse. Un mot à changer, et la promesse est tenue.
        "label.param__label",
        { for: id },
        el("span.param__titre", t(r.titre)),
        el("span.param__aide", t(r.aide))
      )
    );
  }

  /**
   * Le nom de cet appareil : le seul réglage qui se TAPE au lieu de se cocher.
   *
   * MÊME MOULE QUE LES AUTRES, à la commande près : un `div.param`, un
   * `label.param__label` qui porte le titre et son explication, et la commande
   * qui va avec. Seule la direction change — le champ passe SOUS son étiquette
   * au lieu d'être à côté, parce qu'un champ de saisie prend toute la largeur
   * quand une case fait dix-sept pixels. D'où le modificateur `--texte`, et
   * rien d'autre.
   *
   * IL N'ENTRE PAS DANS `REGLAGES`. Cette table décrit des bascules : `lire`
   * rend un booléen, `poser` le renverse, `apercu` le fête. Un champ de texte
   * n'a aucune de ces trois formes, et l'y faire entrer aurait demandé un
   * quatrième champ « genre » consulté par `ligne()` — c'est-à-dire une
   * abstraction inventée pour deux cas. Deux fonctions voisines coûtent moins
   * cher à lire qu'une fonction qui se demande ce qu'elle est en train de faire.
   *
   * ON ENREGISTRE SUR `change` ET NON SUR `input`, donc à la sortie du champ ou
   * à la touche Entrée. Écrire à chaque frappe aurait posé douze préférences
   * pour « ordinateur du salon », et surtout : la valeur retenue est celle qu'on
   * a fini d'écrire, jamais l'un de ses préfixes.
   *
   * PAS DE `dessiner()` APRÈS COUP, contrairement aux bascules. Elles se
   * redessinent parce qu'un réglage peut refuser d'être changé et que
   * l'affichage doit alors dire la vérité ; ici la vérité est déjà à l'écran —
   * c'est ce que la personne vient de taper. Reconstruire le panneau lui aurait
   * repris le focus au milieu d'une correction.
   */
  function champAppareil() {
    const id = "param-appareil";
    return el(
      "div.param.param--texte",
      el(
        // `for` et non `htmlFor` — meme raison que pour les bascules plus haut,
        // ou l.explication complete est ecrite.
        "label.param__label",
        { for: id },
        el("span.param__titre", t("Nom de cet appareil")),
        el(
          "span.param__aide",
          t("Il accompagne chaque envoi vers le dépôt : les autres appareils liront « Reçu de » suivi de ce nom dans leur journal. Vide, il se devine tout seul.")
        )
      ),
      el("input.param__champ", {
        type: "text",
        id,
        // La valeur EFFECTIVE, pas la préférence brute : tant que personne n'a
        // choisi de nom, le champ montre celui qui est deviné — c'est-à-dire
        // celui qui part réellement dans le dépôt. Un champ vide aurait laissé
        // croire que rien n'était envoyé.
        value: nomDeCetAppareil(),
        // Ce qui reprendra la main si on efface tout. L'indication n'apparaît
        // qu'à ce moment-là, et c'est exactement quand elle sert.
        placeholder: nomDeduit(),
        // La borne du FORMAT du fichier, pas une lubie d'affichage : voir
        // `domain/source.js`. Elle est aussi appliquée à l'écriture, mais la
        // poser ici évite de laisser taper trente caractères qui seraient
        // coupés en silence.
        maxLength: LONGUEUR_MAX,
        autocomplete: "off",
        spellcheck: "false",
        // Pas d'évènement `funkylldex:parametres` : son `detail` annonce un
        // booléen (`actif`), et un nom n'en est pas un. Personne n'écoute ce
        // signal aujourd'hui ; lui faire porter deux formes différentes serait
        // un piège tendu au premier qui s'y abonnera.
        onchange: (event) => {
          const retenu = poserNomDeCetAppareil(event.target.value);
          // On réaffiche ce qui a été RETENU et non ce qui a été tapé : les
          // espaces en trop ont sauté, et un champ vidé revient au nom deviné.
          // Sans ce renvoi, le champ affirmerait un nom que le dépôt ne verra
          // jamais.
          event.target.value = retenu;
        },
      })
    );
  }

  bouton.addEventListener("click", (event) => {
    event.stopPropagation();
    ouvrir(panneau.hidden);
  });

  document.addEventListener("click", (event) => {
    if (!panneau.hidden && !panneau.contains(event.target)) ouvrir(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panneau.hidden) {
      ouvrir(false);
      bouton.focus();
    }
  });

  // Le panneau se redessine quand la langue change : il ne se reconstruit qu'à
  // l'ouverture, donc sans ceci il gardait la langue de la dernière ouverture.
  document.addEventListener("funkylldex:langue", () => {
    if (!panneau.hidden) dessiner();
  });
}
