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
import { jouer, sonsActifs, basculerSons } from "./sons.js";
import { iconeSvg } from "./icones-succes.js";

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
        "label.param__label",
        { htmlFor: id },
        el("span.param__titre", t(r.titre)),
        el("span.param__aide", t(r.aide))
      )
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
