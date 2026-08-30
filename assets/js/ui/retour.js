/**
 * retour.js — le geste Retour ferme le panneau, il ne quitte pas le site.
 *
 * LE PROBLÈME. Sur téléphone, et surtout dans une application installée, le
 * réflexe pour refermer quelque chose qui s'ouvre par-dessus la page est le
 * balayage Retour. Si ce panneau n'est qu'un élément du DOM, le navigateur n'a
 * rien à dépiler : il quitte la page — et depuis une application installée, il
 * la FERME. On perd tout l'écran pour avoir voulu fermer une fenêtre.
 *
 * LA SOLUTION est vieille comme les applications d'une seule page : empiler une
 * entrée d'historique à l'ouverture, l'écouter, et la dépiler soi-même quand on
 * ferme autrement. `ui/detail-panel.js` le faisait déjà à la main pour la fiche
 * en tiroir ; ce fichier en extrait le mécanisme pour les panneaux qui sont
 * arrivés depuis — la carte de partage et la page des succès.
 *
 * LE PIÈGE, ET IL EST DOUBLE.
 *
 * Fermer par le bouton doit dépiler l'entrée, sinon elle reste là : le prochain
 * balayage Retour ne ferait rien de visible, et il en faudrait deux pour
 * revenir en arrière. Mais `history.back()` déclenche `popstate`, qui rappelle
 * la fermeture… d'un panneau déjà fermé.
 *
 * Un seul drapeau règle les deux sens : `actif` dit si l'entrée est encore là.
 * Le retour le baisse avant de fermer, la fermeture le lit avant de dépiler.
 * Quel que soit celui des deux qui arrive en premier, l'autre ne fait rien.
 */

/**
 * Empile une entrée d'historique et rend de quoi la libérer.
 *
 * @param {() => void} fermer  ce qu'il faut faire quand le geste Retour survient
 * @returns {() => void} à appeler DANS `fermer`, quelle que soit l'origine de la
 *   fermeture : elle retire l'écouteur, et ne dépile que si le geste Retour ne
 *   l'a pas déjà fait.
 */
export function retourFerme(fermer) {
  let actif = true;

  const surRetour = () => {
    if (!actif) return;
    // Baissé AVANT d'appeler la fermeture : celle-ci appellera `liberer`, qui
    // doit alors savoir que l'entrée est déjà partie et ne pas la redépiler.
    actif = false;
    fermer();
  };

  window.addEventListener("popstate", surRetour);
  history.pushState({ funkylldex: true }, "");

  return function liberer() {
    window.removeEventListener("popstate", surRetour);
    if (!actif) return;
    actif = false;
    // L'écouteur vient d'être retiré : ce `back` ne rappellera personne.
    history.back();
  };
}
