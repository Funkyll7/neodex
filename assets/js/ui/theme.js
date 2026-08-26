/**
 * theme.js — bascule clair / sombre.
 * Le choix est memorise ; sans choix explicite on suit le reglage du systeme.
 */

import { CONFIG } from "../config.js";

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
  apply(saved || (media.matches ? "light" : "dark"));

  // Sans choix explicite, on suit les changements de reglage systeme.
  media.addEventListener("change", (event) => {
    if (!readPrefs().theme) apply(event.matches ? "light" : "dark");
  });

  const button = document.getElementById("theme-toggle");
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    apply(next);
    writePrefs({ ...readPrefs(), theme: next });
  });
}

/** Fond de page de chaque theme, recopie de theme.css. */
const BANDEAU = { dark: "#0a0d17", light: "#f2f4f9" };

function apply(theme) {
  document.documentElement.dataset.theme = theme;

  // Le bandeau du navigateur — et, une fois l'application installee, la barre
  // systeme — prend cette couleur. Sans cette mise a jour, un site passe en
  // clair gardait un bandeau noir au-dessus de lui.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BANDEAU[theme] || BANDEAU.dark);

  const button = document.getElementById("theme-toggle");
  if (button) {
    button.textContent = theme === "light" ? "☀" : "☾";
    button.title = theme === "light" ? "Passer au thème sombre" : "Passer au thème clair";
  }
}
