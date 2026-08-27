/**
 * theme.js — le choix du thème.
 * Le choix est memorise ; sans choix explicite on suit le reglage du systeme.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { THEMES } from "./themes-list.js";

const KEY = CONFIG.storage.prefs;

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* stockage indisponible : le theme redeviendra automatique au rechargement */
  }
}

export function initTheme() {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const saved = readPrefs().theme;
  // Un theme enregistre qui n'existe plus — une palette renommee, un fichier de
  // preferences venu d'une autre machine — ne doit pas laisser la page sans
  // aucune couleur : on retombe alors sur le reglage systeme.
  const connu = saved && THEMES.some((t) => t.value === saved);
  apply(connu ? saved : media.matches ? "light" : "dark");

  // Sans choix explicite, on suit les changements de reglage systeme.
  media.addEventListener("change", (event) => {
    if (!readPrefs().theme) apply(event.matches ? "light" : "dark");
  });

  buildPicker();
  initBouton();
}

/**
 * Le bouton de la marque ouvre la palette.
 *
 * Il ne fait plus basculer clair / sombre : avec vingt-six themes, un bouton
 * qui en alterne deux laissait les vingt-quatre autres inaccessibles sans un
 * second reglage ailleurs. Il devient donc l'entree unique — un panneau
 * s'ouvre, on choisit, il se referme.
 */
function initBouton() {
  const button = document.getElementById("theme-toggle");
  const picker = document.getElementById("theme-picker");
  if (!button || !picker) return;

  const ouvrir = (etat) => {
    picker.hidden = !etat;
    button.setAttribute("aria-expanded", String(etat));
    // La palette s'ouvre sur la famille courante : avec quatre familles, elle
    // s'ouvrait sinon systematiquement sur « Base » et il fallait faire defiler
    // pour retrouver ou l'on etait.
    if (etat) {
      const actif = picker.querySelector('[aria-pressed="true"]');
      if (actif) actif.scrollIntoView({ block: "nearest" });
    }
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    ouvrir(picker.hidden);
  });

  // Cliquer ailleurs referme : un panneau qui reste ouvert derriere soi est
  // une gene, pas une aide.
  document.addEventListener("click", (event) => {
    if (!picker.hidden && !picker.contains(event.target)) ouvrir(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !picker.hidden) {
      ouvrir(false);
      button.focus();
    }
  });

  picker.addEventListener("click", (event) => {
    if (event.target.closest(".swatch")) ouvrir(false);
  });
}

/** Applique un theme, le retient, et remet le selecteur d'accord. */
function choisir(theme) {
  apply(theme);
  writePrefs({ ...readPrefs(), theme });
  syncPicker();
}

/**
 * La palette, coupee en familles.
 *
 * Vingt-six pastilles d'affilee formaient un mur qu'on parcourait sans rien y
 * chercher. Les quatre titres disent ce qu'on regarde — une couleur, un
 * legendaire, un trio de depart — et rendent la liste consultable.
 */
function buildPicker() {
  const root = document.getElementById("theme-picker");
  if (!root) return;

  const familles = new Map();
  for (const theme of THEMES) {
    if (!familles.has(theme.groupe)) familles.set(theme.groupe, []);
    familles.get(theme.groupe).push(theme);
  }

  fill(
    root,
    [...familles].map(([titre, liste]) =>
      el(
        "section.themes__cat",
        el("h3.themes__catname", titre),
        el(
          "div.themes__grid",
          liste.map((t) =>
            el(
              "button.swatch",
              {
                type: "button",
                dataset: { theme: t.value },
                title: t.label,
                "aria-label": `Thème ${t.label}`,
                "--sw-bg": t.bandeau,
                "--sw-fg": t.pastille,
                onclick: () => choisir(t.value),
              },
              el("span.swatch__dot"),
              el("span.swatch__name", t.label)
            )
          )
        )
      )
    )
  );
  syncPicker();
}

function syncPicker() {
  const root = document.getElementById("theme-picker");
  if (!root) return;
  const courant = document.documentElement.dataset.theme;
  for (const bouton of root.querySelectorAll(".swatch")) {
    bouton.setAttribute("aria-pressed", String(bouton.dataset.theme === courant));
  }
}

const PAR_VALEUR = new Map(THEMES.map((t) => [t.value, t]));

/**
 * Un fond est-il clair ?
 *
 * Deduit de la luminance du bandeau plutot que d'un drapeau a tenir a jour :
 * deux thèmes de famille sont clairs (Reshiram, les starters d'Alola), et il y
 * en aura d'autres. Un drapeau oublie donnait un soleil sur un fond noir.
 */
function estClair(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  if (!Number.isFinite(n)) return false;
  const r = (n >> 16) & 255;
  const v = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + v * 587 + b * 114) / 1000 > 140;
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  const courant = PAR_VALEUR.get(theme) || PAR_VALEUR.get("dark");

  // Le bandeau du navigateur — et, une fois l'application installee, la barre
  // systeme — prend cette couleur. Sans cette mise a jour, un site passe en
  // clair gardait un bandeau noir au-dessus de lui.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", courant.bandeau);

  // Le bouton porte le nom du theme courant : il dit ainsi ou l'on est, sans
  // avoir a ouvrir la palette.
  const button = document.getElementById("theme-toggle");
  if (button) {
    button.textContent = estClair(courant.bandeau) ? "☀" : "☾";
    button.title = `Thème : ${courant.label} — cliquer pour changer`;
    button.setAttribute("aria-label", button.title);
  }
}
