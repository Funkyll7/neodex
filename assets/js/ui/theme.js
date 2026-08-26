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

  buildPicker();
  initBouton();
}

/**
 * Le bouton de la marque ouvre la palette.
 *
 * Il ne fait plus basculer clair / sombre : avec onze themes, un bouton qui
 * en alterne deux laissait les neuf autres inaccessibles sans un second
 * reglage ailleurs. Il devient donc l'entree unique — un panneau s'ouvre, on
 * choisit, il se referme.
 */
function initBouton() {
  const button = document.getElementById("theme-toggle");
  const picker = document.getElementById("theme-picker");
  if (!button || !picker) return;

  const ouvrir = (etat) => {
    picker.hidden = !etat;
    button.setAttribute("aria-expanded", String(etat));
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

  picker.addEventListener("click", () => ouvrir(false));
}

/** Applique un theme, le retient, et remet le selecteur d'accord. */
function choisir(theme) {
  apply(theme);
  writePrefs({ ...readPrefs(), theme });
  syncPicker();
}

function buildPicker() {
  const root = document.getElementById("theme-picker");
  if (!root) return;

  root.replaceChildren(
    ...THEMES.map((t) => {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "swatch";
      bouton.dataset.theme = t.value;
      bouton.title = t.label;
      bouton.setAttribute("aria-label", `Thème ${t.label}`);
      bouton.style.setProperty("--sw-bg", t.bandeau);
      bouton.style.setProperty("--sw-fg", t.pastille);
      bouton.append(Object.assign(document.createElement("span"), { className: "swatch__dot" }));
      bouton.append(Object.assign(document.createElement("span"), { className: "swatch__name", textContent: t.label }));
      bouton.addEventListener("click", () => choisir(t.value));
      return bouton;
    })
  );
  syncPicker();
}

function syncPicker() {
  const root = document.getElementById("theme-picker");
  if (!root) return;
  const courant = document.documentElement.dataset.theme;
  for (const bouton of root.children) {
    bouton.setAttribute("aria-pressed", String(bouton.dataset.theme === courant));
  }
}

/**
 * Les themes proposes.
 *
 * Les huit variantes de region sont baties sur le theme sombre : elles n'en
 * redefinissent que les fonds, les bordures et l'accent, jamais les tons de
 * texte. C'est ce qui garantit que le contraste reste bon sans avoir a le
 * revalider huit fois — et c'est pourquoi ajouter une region ne demande qu'un
 * bloc dans theme.css et une ligne ici.
 *
 * `bandeau` est la couleur du fond de page : elle part dans `theme-color`,
 * donc dans la barre du navigateur et, une fois installe, dans le bandeau
 * systeme de l'application.
 */
export const THEMES = [
  { value: "dark", label: "Sombre", bandeau: "#0a0d17", pastille: "#ffcb05" },
  { value: "light", label: "Clair", bandeau: "#f2f4f9", pastille: "#c98f00" },
  { value: "kanto", label: "Kanto", bandeau: "#120b0c", pastille: "#ff6b4a" },
  { value: "johto", label: "Johto", bandeau: "#130f07", pastille: "#f2b134" },
  { value: "hoenn", label: "Hoenn", bandeau: "#04141a", pastille: "#2ec5c0" },
  { value: "sinnoh", label: "Sinnoh", bandeau: "#090f1c", pastille: "#5aa9ff" },
  { value: "unys", label: "Unys", bandeau: "#08090d", pastille: "#7fd1ff" },
  { value: "kalos", label: "Kalos", bandeau: "#0f0a18", pastille: "#e07be0" },
  { value: "alola", label: "Alola", bandeau: "#05171a", pastille: "#ffb02e" },
  { value: "galar", label: "Galar", bandeau: "#100c15", pastille: "#e05a7d" },
  { value: "paldea", label: "Paldéa", bandeau: "#0d0916", pastille: "#a06bff" },
];

const BANDEAU = Object.fromEntries(THEMES.map((t) => [t.value, t.bandeau]));

function apply(theme) {
  document.documentElement.dataset.theme = theme;

  // Le bandeau du navigateur — et, une fois l'application installee, la barre
  // systeme — prend cette couleur. Sans cette mise a jour, un site passe en
  // clair gardait un bandeau noir au-dessus de lui.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BANDEAU[theme] || BANDEAU.dark);

  // Le bouton porte le nom du theme courant et en prend l'accent : il dit
  // ainsi ou l'on est, sans avoir a ouvrir la palette.
  const courant = THEMES.find((t) => t.value === theme);
  const button = document.getElementById("theme-toggle");
  if (button) {
    button.textContent = theme === "light" ? "☀" : "☾";
    const nom = courant ? courant.label : theme;
    button.title = `Thème : ${nom} — cliquer pour changer`;
    button.setAttribute("aria-label", button.title);
  }
}
