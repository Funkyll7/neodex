/**
 * sons.js — la palette sonore de l'application.
 *
 * SYNTHÉTISÉS, pas téléchargés. Web Audio fabrique ces notes en une poignée
 * d'octets de code ; une douzaine de fichiers audio auraient pesé plus lourd que
 * tout le JavaScript du site, demandé autant de requêtes, et il aurait fallu les
 * pré-cacher pour qu'ils marchent hors ligne. Ici tout marche partout, tout de
 * suite, et un timbre se règle en changeant un nombre.
 *
 * ────────────────────────────────────────────────────────────────────────
 * SONNER PARTOUT DEMANDE DE DOSER, pas de multiplier.
 *
 * On coche des milliers de cases. Un même son à plein volume à chaque geste
 * ferait un crépitement qu'on couperait au bout d'une minute — et couper le
 * tout, c'est perdre aussi les deux sons qui comptent vraiment.
 *
 * Trois règles tiennent donc toute la palette :
 *
 *   1. LE VOLUME SUIT LA RARETÉ. Un tic de case est à 0,05 ; une quête réussie
 *      à 0,12. Deux fois et demie plus fort pour cent fois moins fréquent.
 *   2. UN LIMITEUR PAR SON. Deux tics ne peuvent pas se déclencher à moins de
 *      50 ms — cocher au pouce en rafale rend une frappe régulière, pas une
 *      bouillie.
 *   3. LE NOMBRE DE VOIX EST BORNÉ. Au-delà de huit notes en vol, on n'en
 *      ajoute plus : c'est le point où le mélange devient du bruit, et où le
 *      navigateur commence à saturer.
 * ────────────────────────────────────────────────────────────────────────
 *
 * LE CONTEXTE AUDIO NAÎT AU PREMIER SON, jamais au chargement. Les navigateurs
 * refusent d'ouvrir un contexte sans geste de l'utilisateur, et un contexte
 * ouvert trop tôt reste « suspendu ». Créé dans le gestionnaire d'un clic, il
 * naît déjà actif.
 */

import { CONFIG } from "../config.js";
import { t } from "../core/i18n.js";

let contexte = null;
let voix = 0;
const dernierAppel = new Map();

/** Le contexte audio, créé à la demande. `null` si le navigateur n'en a pas. */
function audio() {
  if (contexte) return contexte;
  const Constructeur = window.AudioContext || window.webkitAudioContext;
  if (!Constructeur) return null;
  try {
    contexte = new Constructeur();
  } catch {
    // Web Audio indisponible ou bloqué : le site marche sans, en silence.
    return null;
  }
  return contexte;
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
 * Une note : un oscillateur et son enveloppe.
 *
 * L'enveloppe compte plus que la fréquence. Une sinusoïde coupée net claque —
 * c'est le « clic » qu'on entend au bout d'un son mal fini. D'où l'attaque en
 * 6 ms et l'extinction exponentielle : l'oreille n'entend alors que la note.
 *
 * `exponentialRampToValueAtTime` et non `linear` : le volume se perçoit sur une
 * échelle logarithmique, et une descente linéaire s'entend comme une coupure
 * brutale. La cible ne peut pas valoir zéro — d'où 0,0001.
 */
function note(ctx, { frequence, depart, duree, volume, forme = "sine" }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = forme;
  osc.frequency.setValueAtTime(frequence, depart);

  gain.gain.setValueAtTime(0.0001, depart);
  gain.gain.exponentialRampToValueAtTime(volume, depart + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, depart + duree);

  osc.connect(gain).connect(ctx.destination);
  osc.start(depart);
  osc.stop(depart + duree + 0.02);

  voix += 1;
  osc.onended = () => {
    voix -= 1;
  };
}

/**
 * La palette.
 *
 * `notes` : les fréquences, jouées dans l'ordre, espacées de `ecart`.
 * `volume` : suit la rareté du geste — voir la règle 1 en tête de fichier.
 * `pause`  : le délai minimal entre deux déclenchements du MÊME son.
 *
 * Les fréquences ne sont pas au hasard : ce sont des notes justes, et les suites
 * montent. Un intervalle faux ou descendant s'entend comme une erreur, même
 * quand il accompagne une réussite.
 */
const PALETTE = {
  /* Gestes fréquents — discrets, et fortement limités. */
  case: { notes: [880], duree: 0.05, volume: 0.05, pause: 50 },
  decase: { notes: [587.3], duree: 0.05, volume: 0.04, pause: 50 },
  compteur: { notes: [1046.5], duree: 0.035, volume: 0.035, pause: 40 },
  onglet: { notes: [740], duree: 0.05, volume: 0.04, pause: 120 },
  theme: { notes: [988], duree: 0.07, volume: 0.05, pause: 120 },

  /* Gestes de correction — ils descendent, ce qui les distingue sans mot. */
  annuler: { notes: [784, 587.3], duree: 0.07, volume: 0.06, ecart: 0.05, pause: 120 },
  passe: { notes: [659.3], duree: 0.08, volume: 0.05, pause: 150 },

  /* Réussites — plus rares, donc plus présentes. */
  complet: { notes: [659.3, 880], duree: 0.09, volume: 0.08, ecart: 0.06, pause: 150 },
  shiny: { notes: [1318.5, 1975.5], duree: 0.13, volume: 0.12, ecart: 0.055, pause: 150 },
  quete: {
    notes: [523.25, 659.25, 783.99, 1046.5],
    duree: 0.16,
    volume: 0.12,
    ecart: 0.085,
    forme: "triangle",
    pause: 300,
  },
  succes: {
    notes: [523.25, 659.25, 783.99, 1046.5, 1318.5],
    duree: 0.18,
    volume: 0.13,
    ecart: 0.09,
    forme: "triangle",
    pause: 400,
  },

  /* Synchronisation — deux notes qui montent, deux qui descendent. */
  synchro: { notes: [783.99, 1046.5], duree: 0.09, volume: 0.06, ecart: 0.06, pause: 400 },
  erreur: { notes: [415.3, 311.1], duree: 0.14, volume: 0.07, ecart: 0.08, forme: "triangle", pause: 400 },
};

/**
 * Joue un son de la palette.
 *
 * Silencieux et sans erreur si le nom est inconnu, si les sons sont coupés, si
 * Web Audio manque, si le limiteur s'y oppose, ou si trop de notes sont déjà en
 * vol. Aucun appelant n'a donc à se protéger.
 */
export function jouer(nom) {
  if (!sonsActifs()) return;
  const recette = PALETTE[nom];
  if (!recette) return;

  // Le limiteur, avant même d'ouvrir le contexte : cocher en rafale ne doit pas
  // coûter un aller-retour dans Web Audio à chaque frappe.
  const maintenant = Date.now();
  if (maintenant - (dernierAppel.get(nom) || 0) < recette.pause) return;

  const ctx = audio();
  if (!ctx) return;
  // Un contexte peut naître SUSPENDU. Il suffit que le premier son de la visite
  // parte hors d'un geste — un retour de synchronisation, un succès qui
  // s'annonce — et le navigateur refuse de l'ouvrir. Le navigateur en suspend
  // aussi quand l'onglet passe longtemps à l'arrière-plan.
  //
  // Sans ce réveil, ce premier son manqué les rendait TOUS muets pour le reste
  // de la visite : `audio()` rend le contexte déjà créé, et plus rien ne le
  // relançait. `resume()` appelé hors d'un geste échoue simplement — d'où le
  // `catch` vide, qui n'a rien à rattraper.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  // Au-delà de huit notes en vol, le mélange devient du bruit. On préfère en
  // sauter une plutôt que d'empiler.
  if (voix >= 8) return;
  dernierAppel.set(nom, maintenant);

  const t = ctx.currentTime;
  const ecart = recette.ecart || 0;
  recette.notes.forEach((frequence, i) => {
    note(ctx, {
      frequence,
      depart: t + i * ecart,
      // La dernière note d'une suite traîne un peu : c'est ce qui fait qu'elle
      // se termine au lieu de s'arrêter.
      duree: i === recette.notes.length - 1 && recette.notes.length > 1 ? recette.duree * 2.4 : recette.duree,
      volume: recette.volume,
      forme: recette.forme,
    });
  });
}

/**
 * Câble le bouton de l'en-tête.
 *
 * Le bouton porte l'état COURANT — « ♪ » quand les sons marchent, barré quand
 * ils sont coupés — et non ce qu'on obtiendrait en cliquant : un bouton qui
 * montre l'action se lit dans les deux sens, et on ne sait plus lequel est vrai.
 * Même raisonnement que pour le bouton de langue, expliqué dans index.html.
 *
 * Un aperçu se joue à l'activation : sans lui, on coupe et on rallume sans
 * jamais savoir ce qu'on vient de choisir.
 */
export function initBoutonSons() {
  const bouton = document.getElementById("sound-toggle");
  if (!bouton) return;

  const peindre = (actifs) => {
    // Le libelle porte l ETAT, jamais l action : « Sons » quand ils marchent,
    // « Sons coupes » quand ils ne marchent pas. Un bouton qui annonce ce qu il
    // ferait se lit dans les deux sens, et on ne sait plus lequel est vrai —
    // meme raisonnement que pour le bouton de langue.
    bouton.textContent = actifs ? "♪" : "♪̸";
    bouton.classList.toggle("icon-btn--muet", !actifs);
    bouton.setAttribute("aria-pressed", String(actifs));
    // `t()` et non le texte brut : `ui/langue.js` traduit bien ce bouton au
    // chargement, en relevant son libellé d'origine dans index.html — mais
    // `peindre()` le réécrit à chaque clic, et l'écriture gagne. Le libellé
    // revenait donc au français dès qu'on touchait au bouton.
    const titre = actifs
      ? t("Sons activés — cliquer pour les couper")
      : t("Sons coupés — cliquer pour les remettre");
    bouton.title = titre;
    bouton.setAttribute("aria-label", titre);
  };

  peindre(sonsActifs());
  bouton.addEventListener("click", () => {
    const actifs = basculerSons();
    peindre(actifs);
    if (actifs) jouer("shiny");
  });
}
