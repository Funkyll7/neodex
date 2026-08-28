/**
 * theme.js — le choix du thème.
 * Le choix est memorise ; sans choix explicite on suit le reglage du systeme.
 */

import { CONFIG } from "../config.js";
import { el, fill } from "../core/dom.js";
import { THEMES } from "./themes-list.js";
import { setSpritesEnPixels } from "../domain/sprites.js";
// Un identifiant d'onglet doit etre de l'ASCII : « Legendaires » et non
// « Légendaires ». Le pliage existe deja, on ne le reecrit pas ici.
import { sansAccents } from "../core/data.js";

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
 * Il ne fait plus basculer clair / sombre : avec trente-deux themes, un bouton
 * qui en alterne deux laissait les trente autres inaccessibles sans un second
 * reglage ailleurs. Il devient donc l'entree unique — un panneau
 * s'ouvre, on choisit, il se referme.
 */
function initBouton() {
  const button = document.getElementById("theme-toggle");
  const picker = document.getElementById("theme-picker");
  if (!button || !picker) return;

  const ouvrir = (etat) => {
    picker.hidden = !etat;
    button.setAttribute("aria-expanded", String(etat));
    // La palette s'ouvre sur l'onglet de la famille courante : sinon elle
    // s'ouvrait toujours sur « Base », et retrouver ou l'on etait demandait de
    // rouvrir les cinq onglets un a un.
    if (etat) syncPicker();
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
    if (event.target.closest(".thopt")) ouvrir(false);
  });
}

/** Applique un theme, le retient, et remet le selecteur d'accord. */
function choisir(theme) {
  const avant = document.documentElement.hasAttribute("data-sprites-pixel");
  apply(theme);
  writePrefs({ ...readPrefs(), theme });
  syncPicker();

  // Passer aux sprites en pixels change les ADRESSES des images, pas seulement
  // les couleurs : les <img> deja dans la page pointent encore vers les rendus
  // HOME. Il faut donc les refaire. On previent plutot que d'appeler main.js
  // directement — `ui/theme.js` n'a pas a connaitre la grille.
  if (document.documentElement.hasAttribute("data-sprites-pixel") !== avant) {
    document.dispatchEvent(new CustomEvent("funkylldex:sprites"));
  }
}

/**
 * La palette, en onglets.
 *
 * Trente-deux pastilles empilees formaient un mur : on le parcourait sans rien
 * y chercher, et il fallait faire defiler 445 px pour voir la derniere. Deux
 * changements le rendent consultable.
 *
 * Un onglet par famille, d'abord. On ne voit plus qu'une famille a la fois —
 * neuf cartes au maximum — et le panneau tient desormais entier a l'ecran,
 * sans defilement du tout. Choisir, c'est deux gestes : la famille, puis la
 * carte.
 *
 * Chaque carte peinte dans SES couleurs, ensuite. Une vignette qui montre le
 * fond de page du theme et son accent dit ce qu'on va obtenir ; un nom seul ne
 * le disait pas, et c'est bien la ce qu'on vient chercher. Les familles qui
 * portent un nom de Pokemon montrent ce Pokemon — reconnaitre Mewtwo est plus
 * rapide que lire « Mewtwo » —, les autres une Poke Ball dans les deux
 * couleurs du theme.
 *
 * Les sprites du menu sont ceux en pixels, quel que soit le theme actif, et
 * c'est une question de poids : le rendu HOME de Mewtwo pese 115 Ko, son sprite
 * en pixels 929 octets. Pour une vignette de 42 px, c'est 125 fois trop cher —
 * 2,8 Mo pour ouvrir un menu, contre 36 Ko.
 */
function buildPicker() {
  const root = document.getElementById("theme-picker");
  if (!root) return;

  const familles = new Map();
  for (const theme of THEMES) {
    if (!familles.has(theme.groupe)) familles.set(theme.groupe, []);
    familles.get(theme.groupe).push(theme);
  }

  const onglets = el("div.themes__tabs", { role: "tablist", "aria-label": "Familles de thèmes" });
  const panneaux = el("div.themes__panels");

  for (const [titre, liste] of familles) {
    const cle = idDeFamille(titre);
    onglets.append(
      el(
        "button.themes__tab",
        {
          type: "button",
          role: "tab",
          id: `theme-tab-${cle}`,
          "aria-controls": `theme-panel-${cle}`,
          "aria-selected": "false",
          tabindex: "-1",
          dataset: { famille: cle },
          onclick: () => montrerFamille(root, cle),
          onkeydown: (event) => naviguerOnglets(root, event),
        },
        titre
      )
    );
    panneaux.append(
      el(
        "div.themes__panel",
        {
          role: "tabpanel",
          id: `theme-panel-${cle}`,
          "aria-labelledby": `theme-tab-${cle}`,
          dataset: { famille: cle },
          hidden: true,
        },
        liste.map(carte)
      )
    );
  }

  fill(root, onglets, panneaux);
  syncPicker();
}

/** « Légendaires » -> « legendaires » : un identifiant sur pour aria-controls. */
function idDeFamille(titre) {
  return sansAccents(titre).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Une carte, peinte dans les couleurs du theme qu'elle propose. */
function carte(theme) {
  return el(
    "button.thopt",
    {
      type: "button",
      dataset: { theme: theme.value },
      title: theme.label,
      "aria-label": `Thème ${theme.label}`,
      "aria-pressed": "false",
      "--sw-bg": theme.bandeau,
      "--sw-fg": theme.pastille,
      onclick: () => choisir(theme.value),
    },
    vignette(theme),
    el("span.thopt__name", theme.label)
  );
}

/**
 * Le dessin de la carte : le Pokemon du theme, ou une Poke Ball a defaut.
 *
 * Les trois starters d'une region plutot qu'un seul : un trio de depart ne se
 * resume pas a l'un des trois, et c'est le trio qu'on reconnait d'un coup
 * d'oeil. Ils se chevauchent legerement — trois sprites cote a cote ne
 * tiendraient pas dans les 85 px d'une carte.
 */
function vignette(theme) {
  if (!theme.sprite) {
    return el("span.thopt__art", el("span.thopt__ball"));
  }
  const ids = Array.isArray(theme.sprite) ? theme.sprite : [theme.sprite];
  const classe = ids.length > 1 ? "span.thopt__art.thopt__art--trio" : "span.thopt__art";
  return el(
    classe,
    ids.map((id) =>
      el("img.thopt__sprite", {
        src: `${CONFIG.spritePixelBase}${id}.png`,
        // Vide et non le nom du Pokemon : le bouton porte deja son `aria-label`,
        // et « Mewtwo » lu deux fois de suite n'apprend rien.
        alt: "",
        loading: "lazy",
        decoding: "async",
      })
    )
  );
}

/** Montre une famille et une seule. */
function montrerFamille(root, cle) {
  for (const onglet of root.querySelectorAll(".themes__tab")) {
    const actif = onglet.dataset.famille === cle;
    onglet.setAttribute("aria-selected", String(actif));
    onglet.tabIndex = actif ? 0 : -1;
  }
  for (const panneau of root.querySelectorAll(".themes__panel")) {
    panneau.hidden = panneau.dataset.famille !== cle;
  }
}

/**
 * Fleches gauche / droite entre les onglets.
 *
 * Attendu d'un `role="tablist"` : sans cela, un seul onglet est atteignable au
 * clavier, puisque les autres portent `tabindex="-1"` — c'est justement ce qui
 * evite d'avoir a traverser cinq onglets pour atteindre les cartes.
 */
function naviguerOnglets(root, event) {
  const sens = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!sens) return;
  event.preventDefault();
  const onglets = [...root.querySelectorAll(".themes__tab")];
  const ici = onglets.indexOf(event.currentTarget);
  const cible = onglets[(ici + sens + onglets.length) % onglets.length];
  montrerFamille(root, cible.dataset.famille);
  cible.focus();
}

/**
 * Remet le selecteur d'accord avec le theme applique — la carte cochee, et
 * l'onglet ouvert sur la famille ou l'on se trouve. C'est ce dernier point qui
 * fait qu'ouvrir le menu montre toujours d'abord la ou l'on est.
 */
function syncPicker() {
  const root = document.getElementById("theme-picker");
  if (!root) return;
  const courant = document.documentElement.dataset.theme;

  let famille = null;
  for (const bouton of root.querySelectorAll(".thopt")) {
    const actif = bouton.dataset.theme === courant;
    bouton.setAttribute("aria-pressed", String(actif));
    if (actif) famille = bouton.closest(".themes__panel").dataset.famille;
  }

  // Un theme inconnu — une palette retiree, des preferences venues d'ailleurs —
  // ne doit pas laisser le menu sans aucun onglet ouvert.
  const premier = root.querySelector(".themes__tab");
  montrerFamille(root, famille || (premier && premier.dataset.famille));
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

  // Le theme « Pixels » remplace les images, pas seulement les couleurs. Le
  // drapeau part vers `domain/sprites.js`, qui fabrique toutes les adresses, et
  // l'attribut sur <html> laisse le CSS couper le lissage.
  const pixels = courant.sprites === "pixel";
  setSpritesEnPixels(pixels);
  document.documentElement.toggleAttribute("data-sprites-pixel", pixels);

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
