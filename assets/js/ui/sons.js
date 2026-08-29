/**
 * sons.js — les deux sons de l'application.
 *
 * SYNTHÉTISÉS, pas téléchargés. Web Audio fabrique ces quelques notes en une
 * poignée d'octets de code ; deux fichiers audio auraient pesé plus lourd que
 * tout le JavaScript du site, demandé deux requêtes, et il aurait fallu les
 * pré-cacher pour qu'ils marchent hors ligne. Ici, tout marche partout, tout de
 * suite, et le timbre se règle en changeant un nombre.
 *
 * DEUX SONS, et deux seulement. Une case chromatique cochée, une quête réussie.
 * On coche des milliers de cases ordinaires : leur donner un son aurait fait un
 * crépitement, et on aurait coupé le tout au bout d'une minute. Ces deux-là sont
 * rares, et c'est ce qui leur permet d'être une récompense.
 *
 * LE CONTEXTE AUDIO NAÎT AU PREMIER SON, jamais au chargement. Les navigateurs
 * refusent d'ouvrir un contexte sans geste de l'utilisateur, et un contexte
 * ouvert trop tôt reste « suspendu » — il faudrait le réveiller à la main. Créé
 * dans le gestionnaire du clic, il naît déjà actif.
 */

import { CONFIG } from "../config.js";

let contexte = null;

/** Le contexte audio, créé à la demande. `null` si le navigateur n'en a pas. */
function audio() {
  if (contexte) return contexte;
  const Constructeur = window.AudioContext || window.webkitAudioContext;
  if (!Constructeur) return null;
  try {
    contexte = new Constructeur();
    return contexte;
  } catch {
    // Web Audio indisponible ou bloqué : le site marche sans, en silence.
    return null;
  }
}

/** L'utilisateur veut-il des sons ? Oui par défaut. */
export function sonsActifs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(CONFIG.storage.prefs) || "{}");
    return prefs.sons !== false;
  } catch {
    return true;
  }
}

/** Bascule la préférence et rend son nouvel état. */
export function basculerSons() {
  const suivant = !sonsActifs();
  try {
    const cle = CONFIG.storage.prefs;
    const prefs = JSON.parse(localStorage.getItem(cle) || "{}");
    localStorage.setItem(cle, JSON.stringify({ ...prefs, sons: suivant }));
  } catch {
    /* stockage bloqué : la préférence ne survivra pas au rechargement */
  }
  return suivant;
}

/**
 * Une note : une sinusoïde et son enveloppe.
 *
 * L'enveloppe compte plus que la fréquence. Une sinusoïde coupée net claque —
 * c'est le « clic » qu'on entend au bout d'un son mal fini. D'où l'attaque en
 * 8 ms et l'extinction exponentielle : l'oreille n'entend alors que la note.
 *
 * `exponentialRampToValueAtTime` et non `linear` : le volume se perçoit sur une
 * échelle logarithmique, et une descente linéaire s'entend comme une coupure
 * brutale à la fin. La cible ne peut pas valoir zéro — d'où 0.0001.
 */
function note(ctx, { frequence, depart, duree, volume = 0.16, forme = "sine" }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = forme;
  osc.frequency.setValueAtTime(frequence, depart);

  gain.gain.setValueAtTime(0.0001, depart);
  gain.gain.exponentialRampToValueAtTime(volume, depart + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, depart + duree);

  osc.connect(gain).connect(ctx.destination);
  osc.start(depart);
  osc.stop(depart + duree + 0.02);
}

/**
 * Une case chromatique vient d'être cochée.
 *
 * Deux notes qui montent, très courtes, une quinte juste au-dessus : c'est
 * l'intervalle le plus consonant après l'octave, et deux notes suffisent à
 * faire un geste. Une troisième aurait fait une mélodie, donc quelque chose
 * qu'on finit par attendre — et par trouver long.
 */
export function jouerShiny() {
  if (!sonsActifs()) return;
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  note(ctx, { frequence: 1318.5, depart: t, duree: 0.11, volume: 0.13 });
  note(ctx, { frequence: 1975.5, depart: t + 0.055, duree: 0.17, volume: 0.11 });
}

/**
 * Une quête vient d'être terminée.
 *
 * Un arpège de do majeur, quatre notes qui montent jusqu'à l'octave. Plus long
 * que le chromatique, et c'est voulu : une quête terminée est plus rare qu'une
 * case cochée, elle a droit à sa demi-seconde.
 *
 * Une onde triangulaire plutôt qu'une sinusoïde : elle porte quelques
 * harmoniques, ce qui l'empêche de sonner comme un test de laboratoire.
 */
export function jouerQuete() {
  if (!sonsActifs()) return;
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const arpege = [523.25, 659.25, 783.99, 1046.5];
  arpege.forEach((frequence, i) => {
    note(ctx, {
      frequence,
      depart: t + i * 0.085,
      duree: i === arpege.length - 1 ? 0.42 : 0.16,
      volume: 0.12,
      forme: "triangle",
    });
  });
}

/**
 * Câble le bouton de l'en-tête.
 *
 * Le bouton porte l'état COURANT — « ♪ » quand les sons marchent, « ♪ » barré
 * quand ils sont coupés — et non ce qu'on obtiendrait en cliquant : un bouton
 * qui montre l'action se lit dans les deux sens, et on ne sait plus lequel est
 * vrai. Même raisonnement que pour le bouton de langue, expliqué dans index.html.
 *
 * Un aperçu se joue à l'activation : sans lui, on coupe et on rallume sans
 * jamais savoir ce qu'on vient de choisir — les deux sons du site étant rares,
 * il faudrait attendre un chromatique pour le vérifier.
 */
export function initBoutonSons() {
  const bouton = document.getElementById("sound-toggle");
  if (!bouton) return;

  const peindre = (actifs) => {
    bouton.textContent = actifs ? "♪" : "♪̸";
    bouton.classList.toggle("icon-btn--muet", !actifs);
    bouton.setAttribute("aria-pressed", String(actifs));
    const titre = actifs
      ? "Sons activés — cliquer pour les couper"
      : "Sons coupés — cliquer pour les remettre";
    bouton.title = titre;
    bouton.setAttribute("aria-label", titre);
  };

  peindre(sonsActifs());
  bouton.addEventListener("click", () => {
    const actifs = basculerSons();
    peindre(actifs);
    if (actifs) jouerShiny();
  });
}
