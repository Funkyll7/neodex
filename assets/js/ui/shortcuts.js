/**
 * shortcuts.js — raccourcis clavier.
 *
 * Cocher une collection, c'est repeter le meme geste des centaines de fois.
 * A la souris, chaque Pokemon coute un aller-retour vers la grille ; au
 * clavier, c'est une fleche.
 *
 *   /  ou  s     aller a la recherche
 *   ← / →        Pokemon precedent / suivant dans la liste filtree
 *   Echap        quitter la recherche (la feuille mobile est geree ailleurs,
 *                dans ui/detail-panel.js, qui ecoute deja Echap)
 *
 * Regle unique et non negociable : on ne detourne jamais une touche pendant
 * que l'utilisateur ecrit. Un champ de saisie actif rend toutes les touches a
 * la page, Echap excepte.
 */

/** Champs ou l'utilisateur ecrit : aucun raccourci ne doit s'y declencher. */
const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

const isTyping = (node) =>
  Boolean(node) && (TYPING.has(node.tagName) || node.isContentEditable);

export function createShortcuts(ctx) {
  const search = document.getElementById("search");

  document.addEventListener("keydown", (event) => {
    // Une combinaison appartient au navigateur ou au systeme, pas a nous.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (isTyping(event.target)) {
      // Seule sortie utile depuis le champ de recherche : rendre le focus a la
      // page. On ne vide pas le champ — le filtre en cours est rarement ce
      // qu'on veut perdre.
      if (event.key === "Escape" && event.target === search) search.blur();
      return;
    }

    if (event.key === "/" || event.key === "s" || event.key === "S") {
      // preventDefault, sinon le « / » s'ecrit dans le champ qu'on vient
      // d'atteindre, et Firefox ouvre sa recherche rapide.
      event.preventDefault();
      search.focus();
      search.select();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      // La grille et la fiche defilent a la fleche verticale ; l'horizontale
      // ne sert a rien ici, on peut la prendre sans rien voler.
      event.preventDefault();
      ctx.onStep(event.key === "ArrowRight" ? 1 : -1);
    }
  });
}
