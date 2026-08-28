/**
 * langue.js — le bouton qui bascule entre le francais et l'anglais.
 *
 * Tout le travail de traduction vit dans `core/i18n.js`, qui ne touche pas au
 * DOM parce que `domain/` l'importe. Ce fichier-ci fait le reste : le bouton,
 * l'attribut `lang` du document, et l'annonce du changement au reste du site.
 */

import { choisirLangue, langueCourante, languePreferee } from "../core/i18n.js";

/** Ce que le bouton doit dire, selon la langue affichee. */
const LIBELLES = {
  fr: {
    texte: "FR",
    titre: "Langue : Français — cliquer pour l'anglais",
  },
  en: {
    texte: "EN",
    titre: "Language: English — click for French",
  },
};

/**
 * Applique la langue au document et previent le reste du site.
 *
 * L'attribut `lang` n'est pas decoratif : il commande la cesure des mots, le
 * choix des glyphes dans certaines polices, et surtout la prononciation par un
 * lecteur d'ecran. Sans lui, « Caught » serait lu a la francaise.
 */
function appliquer(valeur) {
  document.documentElement.lang = valeur;

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
 * Asynchrone, et il faut l'attendre : passer a l'anglais demande un fichier de
 * 46 Ko. Sans cette attente, la grille se dessinerait en francais puis
 * changerait sous les yeux, ce qui est pire que de commencer un peu plus tard.
 *
 * Si le fichier ne vient pas — hors ligne a la premiere visite en anglais —,
 * on reste en francais : une interface entiere dans une langue vaut mieux
 * qu'une moitie dans chacune.
 */
export async function initLangue() {
  const voulue = languePreferee();
  if (voulue === "en") {
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
 * d'especes changent, donc aussi le tri par nom, donc l'ordre de la grille.
 * On previent par un evenement plutot que d'appeler `main.js` — `ui/` n'a pas
 * a connaitre la grille, pas plus ici que pour les themes.
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
