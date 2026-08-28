/**
 * langue.js — le bouton qui bascule entre le francais et l'anglais, et la
 * traduction de tout ce qui est ecrit en dur dans index.html.
 *
 * Le travail de traduction lui-meme vit dans `core/i18n.js`, qui ne touche pas
 * au DOM parce que `domain/` l'importe. Ce fichier-ci fait le reste.
 */

import { choisirLangue, langueCourante, languePreferee, t } from "../core/i18n.js";

/** Ce que le bouton doit dire, selon la langue affichee. */
const LIBELLES = {
  fr: { texte: "FR", titre: "Langue : Français — cliquer pour l'anglais" },
  en: { texte: "EN", titre: "Language: English — click for French" },
};

/**
 * Ce que le JavaScript redessine lui-meme, et qu'il ne faut donc PAS toucher
 * ici : ces zones passent deja par `t()` a la source, et les reecrire depuis
 * le DOM ferait le travail deux fois — et le referait a l'envers au premier
 * rendu suivant.
 *
 * Les `select` n'y sont PAS, et ce n'est pas un oubli : le releve a lieu au tout
 * debut du demarrage, avant que la barre laterale existe. Les listes qu'elle
 * remplit sont donc encore vides a cet instant, et seules les options ecrites
 * en dur dans index.html — celles du tri — se font relever. Les exclure privait
 * « Trier par » de traduction.
 */
const ZONES_DYNAMIQUES =
  "#grid,#go-grid,#detail,#quest-card,#quest-log,#theme-picker,#status-pills," +
  "#progress-bars,#active-filters,#result-count,#go-count,#dirty-note,#boot-error";

/**
 * Ce qui a ete releve dans index.html, avec son texte francais d'origine.
 *
 * Releve UNE FOIS, au demarrage, avant toute traduction : le HTML livre est en
 * francais, c'est donc toujours le bon original — meme quand l'utilisateur
 * arrive en anglais parce que c'est ce qu'il avait choisi la derniere fois.
 *
 * On garde l'original plutot que de traduire dans l'autre sens : la table ne va
 * que du francais vers l'anglais, et une table inverse aurait fusionne les
 * homonymes que le second argument de `t()` sert justement a separer.
 */
const statiques = [];

/** Les attributs qui portent du texte lu par quelqu'un. */
const ATTRIBUTS = ["title", "aria-label", "placeholder"];

function recenserLeStatique() {
  if (statiques.length) return;

  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let noeud;
  while ((noeud = marcheur.nextNode())) {
    const parent = noeud.parentElement;
    if (!parent || parent.closest(ZONES_DYNAMIQUES)) continue;
    const brut = noeud.textContent;
    const fr = brut.trim();
    if (fr.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(fr)) continue;
    // Les espaces autour comptent : « Filtres » colle a son icone si on les
    // perd, et une phrase coupee par un lien se recolle de travers.
    const debut = brut.slice(0, brut.indexOf(fr));
    const fin = brut.slice(brut.indexOf(fr) + fr.length);
    statiques.push({ noeud, fr, debut, fin });
  }

  for (const el of document.querySelectorAll("[title],[aria-label],[placeholder]")) {
    if (el.closest(ZONES_DYNAMIQUES)) continue;
    for (const attr of ATTRIBUTS) {
      const fr = el.getAttribute(attr);
      if (fr && fr.trim().length > 1) statiques.push({ el, attr, fr });
    }
  }
}

/**
 * Repeint le statique dans la langue courante.
 *
 * En francais on remet l'original tel quel, sans passer par la table : c'est
 * gratuit, et surtout c'est exact — une chaine que l'anglais n'a pas traduite
 * reviendrait sinon telle quelle de toute facon, mais une chaine traduite dans
 * les deux sens aurait pu ne pas revenir a son point de depart.
 */
function appliquerAuStatique() {
  const enFrancais = langueCourante() === "fr";
  for (const entree of statiques) {
    const valeur = enFrancais ? entree.fr : t(entree.fr);
    if (entree.attr) entree.el.setAttribute(entree.attr, valeur);
    else entree.noeud.textContent = entree.debut + valeur + entree.fin;
  }
}

/**
 * Applique la langue au document et au bouton.
 *
 * L'attribut `lang` n'est pas decoratif : il commande la cesure des mots, le
 * choix des glyphes dans certaines polices, et surtout la prononciation par un
 * lecteur d'ecran. Sans lui, « Caught » serait lu a la francaise.
 */
function appliquer(valeur) {
  document.documentElement.lang = valeur;
  appliquerAuStatique();

  // Le bouton APRES le statique : son `title` fait partie du releve, et le
  // repeindre ensuite serait le seul texte de la page a rester en arriere.
  const bouton = document.getElementById("lang-toggle");
  if (bouton) {
    const libelle = LIBELLES[valeur] || LIBELLES.fr;
    bouton.textContent = libelle.texte;
    bouton.title = libelle.titre;
    bouton.setAttribute("aria-label", libelle.titre);
  }
}

/**
 * Reprend la langue choisie la derniere fois, avant le premier rendu.
 *
 * Asynchrone, et il faut l'attendre : passer a l'anglais demande un fichier.
 * Sans cette attente, la grille se dessinerait en francais puis changerait sous
 * les yeux, ce qui est pire que de commencer un peu plus tard.
 *
 * Si le fichier ne vient pas — hors ligne a la premiere visite en anglais —, on
 * reste en francais : une interface entiere dans une langue vaut mieux qu'une
 * moitie dans chacune.
 */
export async function initLangue() {
  // Le releve d'abord, toujours : c'est lui qui garde le francais d'origine.
  recenserLeStatique();

  if (languePreferee() === "en") {
    try {
      await choisirLangue("en");
    } catch {
      /* table indisponible : on garde le francais, deja en place */
    }
  }
  appliquer(langueCourante());
}

/**
 * Cable le bouton.
 *
 * Le changement de langue refait TOUT ce qui porte du texte : les noms
 * d'especes changent, donc aussi le tri par nom, donc l'ordre de la grille. On
 * previent par un evenement plutot que d'appeler `main.js` — `ui/` n'a pas a
 * connaitre la grille, pas plus ici que pour les themes.
 */
export function initBoutonLangue() {
  const bouton = document.getElementById("lang-toggle");
  if (!bouton) return;

  bouton.addEventListener("click", async () => {
    const cible = langueCourante() === "fr" ? "en" : "fr";

    // Desactive pendant le chargement : un double clic lancerait deux fetch et
    // deux rendus complets, pour rien.
    bouton.disabled = true;
    try {
      await choisirLangue(cible);
      appliquer(langueCourante());
      document.dispatchEvent(new CustomEvent("funkylldex:langue"));
    } catch (error) {
      console.warn("Funkylldex : impossible de charger la table anglaise.", error);
    } finally {
      bouton.disabled = false;
    }
  });
}
