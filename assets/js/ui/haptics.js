/**
 * haptics.js — le petit retour dans la main.
 *
 * Devant HOME on regarde la console, pas le telephone : le doigt part sur une
 * case de 26 px sans que l'oeil suive. Une vibration de quelques millisecondes
 * confirme que l'appui a porte. C'est le seul retour qui ne demande pas de
 * regarder l'ecran, et c'est exactement la situation d'usage du site.
 *
 * Deux prudences :
 *   - `navigator.vibrate` n'existe pas sur iOS. L'appel est simplement ignore :
 *     rien a detecter cote appelant, rien a expliquer a l'utilisateur ;
 *   - qui a demande « moins d'animations » a son systeme n'a pas envie non plus
 *     qu'on lui vibre dans la main. On suit ce reglage, et il tient lieu de
 *     bouton d'arret : la barre laterale est deja longue, un interrupteur de
 *     plus y couterait plus qu'il ne rendrait.
 */

const calme = window.matchMedia("(prefers-reduced-motion: reduce)");

export function vibrer(motif) {
  if (calme.matches || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(motif);
  } catch {
    /* certains navigateurs refusent hors geste utilisateur : sans consequence */
  }
}

/** Une case cochee ou decochee : le minimum perceptible. */
export const tapCase = () => vibrer(12);

/** Un Pokemon entierement termine : deux impulsions, ca se remarque. */
export const tapComplet = () => vibrer([14, 60, 26]);

/** Un geste annule : une impulsion plus longue, distincte des deux autres. */
export const tapAnnule = () => vibrer(28);
