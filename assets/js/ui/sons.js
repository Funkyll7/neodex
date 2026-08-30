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

import { lirePrefs, reglage, poserReglage } from "../core/prefs.js";

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

/**
 * L'utilisateur veut-il des sons ? OUI par défaut.
 *
 * C'est le seul réglage du site dont le défaut est « allumé », et c'est
 * délibéré : personne ne va chercher dans les paramètres un retour sonore dont
 * il ignore l'existence. On le donne, et on le coupe d'un clic.
 */
export function sonsActifs() {
  return reglage("sons", true);
}

/** Bascule la préférence et rend son nouvel état. */
export function basculerSons() {
  return poserReglage("sons", !sonsActifs());
}

/**
 * Les trois jeux de notes, dont deux se débloquent par un succès.
 *
 * UNE TRANSFORMATION, ET NON TROIS PALETTES. Écrire trois fois les quinze
 * recettes aurait été trois fois plus de choses à tenir d'accord : ajouter un
 * son au site aurait demandé de l'écrire trois fois, et deux des trois
 * versions auraient fini par diverger de la première.
 *
 * Chaque jeu est donc un filtre appliqué à la palette unique. `ton` transpose —
 * 1,5 est une quinte au-dessus, 0,75 une quarte en dessous —, `duree` étire ou
 * raccourcit l'extinction, `volume` compense la forme d'onde : un carré porte
 * beaucoup plus loin qu'un sinus à volume égal, et sans ce correctif « Rétro »
 * aurait été deux fois trop fort.
 *
 * `forme: null` laisse chaque recette garder la sienne — c'est ce qui préserve
 * le triangle des réussites dans le jeu par défaut.
 */
const JEUX = {
  doux: { forme: null, ton: 1, duree: 1, volume: 1 },
  cristal: { forme: "sine", ton: 1.5, duree: 1.45, volume: 0.85 },
  retro: { forme: "square", ton: 0.75, duree: 0.72, volume: 0.5 },
};

/**
 * Le jeu choisi.
 *
 * Lu ici dans les préférences plutôt que reçu de `ui/recompenses.js` : ce module
 * est appelé à chaque case cochée et n'a aucune raison de dépendre du panneau
 * qui règle le choix. Un jeu inconnu retombe sur « doux » — une préférence peut
 * venir d'un autre appareil, ou nommer une récompense retirée du catalogue.
 */
function jeu() {
  const choix = (lirePrefs().recompenses || {}).sons;
  return JEUX[choix] || JEUX.doux;
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
  const j = jeu();
  recette.notes.forEach((frequence, i) => {
    note(ctx, {
      frequence: frequence * j.ton,
      // L'écart suit la durée : transposer sans étirer les silences donnait un
      // arpège cristallin joué au tempo d'un tic de case, ce qui s'entendait
      // comme une erreur de lecture plutôt que comme un autre jeu.
      depart: t + i * ecart * j.duree,
      // La dernière note d'une suite traîne un peu : c'est ce qui fait qu'elle
      // se termine au lieu de s'arrêter.
      duree:
        (i === recette.notes.length - 1 && recette.notes.length > 1
          ? recette.duree * 2.4
          : recette.duree) * j.duree,
      volume: recette.volume * j.volume,
      forme: j.forme || recette.forme,
    });
  });
}
