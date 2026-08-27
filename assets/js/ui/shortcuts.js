/**
 * shortcuts.js — raccourcis clavier.
 *
 * Cocher une collection, c'est repeter le meme geste des centaines de fois.
 * A la souris, chaque Pokemon coute un aller-retour vers la grille ; au
 * clavier, c'est une fleche.
 *
 *   /  ou  s     aller a la recherche
 *   ← / →        Pokemon precedent / suivant dans la liste filtree
 *   1 / 2        cocher la case normale / chromatique du Pokemon affiche
 *   Echap        quitter la recherche (la feuille mobile est geree ailleurs,
 *                dans ui/detail-panel.js, qui ecoute deja Echap)
 *
 * Regle unique et non negociable : on ne detourne jamais une touche pendant
 * que l'utilisateur ecrit. Un champ de saisie actif rend toutes les touches a
 * la page, Echap excepte.
 */

/** Champs ou l'utilisateur ecrit : aucun raccourci ne doit s'y declencher. */
const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Exporte pour `ui/undo.js`, qui prend Ctrl+Z et a besoin exactement de la
 * meme definition de « l'utilisateur est en train d'ecrire ». Deux copies de
 * cette regle finiraient par diverger, et c'est le genre de divergence qui se
 * remarque le jour ou une touche est volee en pleine frappe.
 */
export const isTyping = (node) =>
  Boolean(node) && (TYPING.has(node.tagName) || node.isContentEditable);

export function createShortcuts(ctx) {
  /**
   * Le champ de recherche de l'onglet ouvert.
   *
   * Il y en a deux depuis l'arrivee du Pokedex GO. « / » visait toujours celui
   * du Pokedex HOME : depuis l'onglet GO, il donnait donc le focus a un champ
   * CACHE, et la frappe suivante partait dans le vide.
   */
  const champ = () =>
    document.getElementById(ctx.store.state.tab === "go" ? "go-search" : "search");

  document.addEventListener("keydown", (event) => {
    // Une combinaison appartient au navigateur ou au systeme, pas a nous.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (isTyping(event.target)) {
      // Seule sortie utile depuis un champ de recherche : rendre le focus a la
      // page. On ne vide pas le champ — le filtre en cours est rarement ce
      // qu'on veut perdre.
      if (event.key === "Escape" && event.target === champ()) event.target.blur();
      return;
    }

    if (event.key === "/" || event.key === "s" || event.key === "S") {
      const cible = champ();
      if (!cible) return;
      // preventDefault, sinon le « / » s'ecrit dans le champ qu'on vient
      // d'atteindre, et Firefox ouvre sa recherche rapide.
      event.preventDefault();
      cible.focus();
      cible.select();
      return;
    }

    // Les quatre touches qui suivent parlent de la fiche du Pokedex HOME : la
    // case cochee, le Pokemon suivant. Hors de cet onglet, elles agissaient
    // dans le vide — « 1 » cochait une case HOME sans que rien ne bouge a
    // l'ecran, ce qui est pire que de ne rien faire.
    if (ctx.store.state.tab !== "dex") return;

    // Cocher sans la souris. Les fleches deplacent, ces deux touches cochent :
    // remonter une boite entiere ne demande plus de lacher le clavier.
    if (event.key === "1" || event.key === "2") {
      const species = ctx.dataset.byId.get(ctx.store.state.selectedId);
      if (!species) return;
      if (event.key === "2" && species.noShiny) return;
      event.preventDefault();
      ctx.onToggle(species.id, event.key === "1" ? "om" : "sm");
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
