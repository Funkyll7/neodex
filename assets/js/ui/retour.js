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
 * arrivés depuis — la carte de partage, la page des succès, le tiroir des
 * filtres, le menu de customisation et l'aperçu d'une récompense verrouillée.
 *
 * ────────────────────────────────────────────────────────────────────────
 * UNE PILE, ET UN SEUL ÉCOUTEUR POUR TOUT LE MONDE.
 *
 * La première version donnait à chaque panneau SON écouteur `popstate` et son
 * drapeau. Ça marche tant qu'un seul panneau est ouvert, et ça casse dès qu'ils
 * s'empilent : le menu des cosmétiques, puis l'aperçu d'une récompense
 * verrouillée par-dessus. Un seul balayage Retour réveillait les DEUX écouteurs,
 * fermait les deux panneaux, et on se retrouvait sur la grille alors qu'on
 * voulait seulement revenir à la liste.
 *
 * D'où la pile. Un seul écouteur, et le geste ne concerne que le DERNIER
 * panneau ouvert — ce qui est exactement ce que le geste veut dire.
 *
 * LE PIÈGE, ET IL EST DOUBLE.
 *
 * Fermer par le bouton doit dépiler l'entrée, sinon elle reste là : le prochain
 * balayage Retour ne ferait rien de visible, et il en faudrait deux pour
 * revenir en arrière. Mais `history.back()` déclenche `popstate`, qui ferait
 * alors tomber le panneau du DESSOUS — celui qu'on voulait garder.
 *
 * `aAvaler` règle ce sens-là : la libération manuelle annonce à l'avance le
 * `popstate` qu'elle provoque, et l'écouteur le laisse passer sans rien fermer.
 * ────────────────────────────────────────────────────────────────────────
 */

/** Les panneaux ouverts, du plus ancien au plus récent. */
const pile = [];

/**
 * Les `popstate` que nous avons nous-mêmes provoqués et qui ne doivent
 * fermer personne. Un compteur et non un booléen : deux panneaux peuvent être
 * refermés à la main coup sur coup, et les deux `back` arrivent en différé.
 */
let aAvaler = 0;

window.addEventListener("popstate", () => {
  if (aAvaler > 0) {
    aAvaler -= 1;
    return;
  }
  const entree = pile.pop();
  if (entree) entree.fermer();
  // Pile vide : personne n'a rien empilé, le geste est une vraie navigation et
  // le navigateur a déjà fait ce qu'il fallait.
});

/**
 * Empile une entrée d'historique et rend de quoi la libérer.
 *
 * @param {() => void} fermer  ce qu'il faut faire quand le geste Retour survient
 * @returns {() => void} à appeler DANS `fermer`, quelle que soit l'origine de la
 *   fermeture : elle retire l'entrée de la pile, et ne dépile l'historique que
 *   si le geste Retour ne l'a pas déjà fait.
 */
export function retourFerme(fermer) {
  const entree = { fermer };
  pile.push(entree);
  history.pushState({ funkylldex: true }, "");

  return function liberer() {
    const rang = pile.indexOf(entree);
    // Absent de la pile : le geste Retour l'a déjà consommé, et l'entrée
    // d'historique est partie avec. Il n'y a rien à dépiler.
    if (rang === -1) return;
    pile.splice(rang, 1);
    // Recherché par identité et non dépilé du sommet : on peut refermer le
    // menu du dessous pendant qu'un aperçu est encore ouvert au-dessus. Les
    // comptes restent justes — une entrée retirée, une entrée d'historique
    // dépilée.
    aAvaler += 1;
    history.back();
  };
}
