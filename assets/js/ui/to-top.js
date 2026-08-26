/**
 * to-top.js — le bouton « retour en haut ».
 *
 * 1025 vignettes font une page tres longue, et sur telephone le geste pour
 * remonter n'existe pas vraiment : on fait defiler pendant plusieurs secondes,
 * ou on cherche la barre d'etat. Le bouton n'apparait qu'une fois qu'on a
 * vraiment descendu, pour ne pas encombrer un ecran deja etroit.
 *
 * Il se cache aussi quand la feuille mobile est ouverte : elle a son propre
 * bouton de fermeture au meme endroit.
 */

const SEUIL = 900;

export function createToTop() {
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "to-top";
  bouton.hidden = true;
  bouton.title = "Revenir en haut";
  bouton.setAttribute("aria-label", "Revenir en haut de la liste");
  bouton.textContent = "↑";

  bouton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const recherche = document.getElementById("search");
    if (recherche) recherche.focus({ preventScroll: true });
  });

  document.body.append(bouton);

  let prevu = false;
  const actualiser = () => {
    prevu = false;
    const cache = window.scrollY < SEUIL || document.body.classList.contains("sheet-open");
    if (bouton.hidden !== cache) bouton.hidden = cache;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (prevu) return;
      prevu = true;
      requestAnimationFrame(actualiser);
    },
    { passive: true }
  );

  return { refresh: actualiser };
}
