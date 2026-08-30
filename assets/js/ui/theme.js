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
import { evaluerSucces } from "../domain/succes.js";
import { t } from "../core/i18n.js";
import { jouer } from "./sons.js";

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

  // Le menu se redessine quand la langue change. Il fait partie des zones que
  // `ui/langue.js` laisse tranquilles — au motif, juste, qu'elles passent déjà
  // par `t()` à la source. Encore faut-il qu'elles se redessinent : sans cette
  // ligne, les six familles et les trente-huit noms de palettes restaient en
  // français jusqu'au rechargement.
  document.addEventListener("funkylldex:langue", retraduirePalette);
}

/**
 * Reconstruit la palette dans la langue courante.
 *
 * Il le faut à deux moments, et pour deux raisons distinctes.
 *
 * AU DÉMARRAGE. `initTheme()` s'exécute avant `boot()`, donc avant
 * `await initLangue()` — et c'est voulu : c'est ce qui pose les couleurs sans
 * attendre les données, et ce qui laisse un menu de thèmes utilisable même
 * quand le chargement échoue. Mais passer à l'anglais demande un fichier ; à
 * cet instant la table n'est pas là, et `t()` rend son argument français. La
 * palette naissait donc en français même pour qui avait choisi l'anglais la
 * fois d'avant — seules les cartes verrouillées y échappaient, parce que
 * `redessinerRecompenses()` les repeint plus tard, une fois la table chargée.
 *
 * AU CHANGEMENT DE LANGUE, ensuite, par l'écouteur posé dans `initTheme()`.
 *
 * L'onglet ouvert est conservé : `syncPicker()` rouvre sinon la famille du
 * thème actif, et basculer la langue en parcourant « Pixels » aurait ramené
 * ailleurs sans qu'on l'ait demandé.
 */
export function retraduirePalette() {
  // Le bouton D'ABORD, et hors de toute condition : il porte le nom du thème
  // courant, il change donc de langue lui aussi, alors même que le thème n'a
  // pas bougé — et il existe même quand la palette, elle, n'a pas pu se
  // construire.
  peindreBoutonTheme();

  const root = document.getElementById("theme-picker");
  if (!root || !root.querySelector(".themes__tab")) return;
  const ouvert = [...root.querySelectorAll(".themes__tab")].find(
    (onglet) => onglet.getAttribute("aria-selected") === "true"
  );
  const famille = ouvert && ouvert.dataset.famille;
  buildPicker();
  if (famille) montrerFamille(root, famille);
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
  jouer("theme");

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

  const onglets = el("div.themes__tabs", { role: "tablist", "aria-label": t("Familles de thèmes") });
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
        // Le TEXTE se traduit, la CLÉ non. `cle` vient de `idDeFamille(titre)`
        // et sert d'identifiant DOM (`aria-controls`, `data-famille`) ; elle est
        // aussi écrite en dur ailleurs — `redessinerRecompenses` cherche
        // `[data-famille="recompenses"]`. Traduire le titre AVANT d'en dériver
        // la clé aurait donné « rewards » en anglais, et ce sélecteur, muet,
        // aurait cessé de repeindre les récompenses dans cette langue-là.
        t(titre)
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

/**
 * Une carte, peinte dans les couleurs du theme qu'elle propose.
 *
 * Sauf si le theme se merite et n'est pas encore gagne : la carte ne montre
 * alors NI son fond NI son accent, seulement un cadenas et ce qu'il reste a
 * faire. C'est ce qui fait d'une palette un cosmetique cache — la couleur est
 * la surprise, la condition ne l'est pas. Une recompense dont on ignore
 * l'existence ne donne envie de rien.
 */
function carte(theme) {
  const succes = theme.verrou ? etatSucces.find((s) => s.cle === theme.verrou) : null;
  // Le theme COURANT reste toujours choisissable, meme si son succes n'est
  // plus atteint. Decocher une case ne doit pas arracher a quelqu'un la
  // palette qu'il a sous les yeux, ni la faire disparaitre du menu ou il vient
  // de la selectionner.
  const ouvert =
    !theme.verrou ||
    (succes && succes.obtenu) ||
    document.documentElement.dataset.theme === theme.value;

  if (!ouvert) return carteFermee(succes);

  return el(
    "button.thopt",
    {
      type: "button",
      dataset: { theme: theme.value },
      title: t(theme.label),
      "aria-label": `${t("Thème")} ${t(theme.label)}`,
      "aria-pressed": "false",
      "--sw-bg": theme.bandeau,
      "--sw-fg": theme.pastille,
      onclick: () => choisir(theme.value),
    },
    vignette(theme),
    // Les noms de régions et « Émeraude » sortent déjà de la table `games`,
    // que `t()` interroge après `ui` : dix libellés se traduisent sans qu'on
    // ait à les redire ici.
    el("span.thopt__name", t(theme.label))
  );
}

/**
 * La carte d'un theme pas encore gagne.
 *
 * `disabled` et non un clic qui ne fait rien : un bouton mort qui garde l'air
 * vivant est le pire des deux. Le lecteur d'ecran l'annonce comme indisponible,
 * et le nom accessible porte la condition entiere — sans quoi il aurait lu
 * « cadenas » et rien d'autre.
 *
 * Le titre porte le succes, ce qu'il demande et l'avancement chiffre. Une carte
 * fait 85 px : le compte tient sous le nom, le reste passe par l'infobulle.
 */
function carteFermee(succes) {
  if (!succes) return el("button.thopt.thopt--verrou", { type: "button", disabled: true },
    el("span.thopt__art", el("span.thopt__cadenas")), el("span.thopt__name", "?"));

  const compte = `${succes.fait} / ${succes.total}`;
  const titre = `${t(succes.titre)}\n${t(succes.resume)}\n${compte}`;
  return el(
    "button.thopt.thopt--verrou",
    {
      type: "button",
      disabled: true,
      title: titre,
      "aria-label": `${t("Thème à débloquer")} — ${t(succes.resume)} — ${compte}`,
      dataset: { succes: succes.cle },
    },
    el("span.thopt__art", el("span.thopt__cadenas")),
    el("span.thopt__name", t(succes.titre)),
    el("span.thopt__reste", compte)
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


/* ============================ Récompenses ================================= */

/**
 * L'état des succès au dernier calcul. Vide tant que la collection n'est pas
 * lue : les cartes verrouillées se dessinent alors sans compte, ce qui est
 * juste — on ne connaît pas encore l'avancement, on ne l'invente pas.
 */
let etatSucces = [];

/**
 * L'état des succès au dernier calcul, pour qui a besoin de le lire.
 *
 * `ui/page-succes.js` s'en sert et NE le recalcule pas : deux calculs, ce
 * seraient deux vérités, capables de diverger d'une fraction de seconde entre
 * la tuile et le bandeau qui la félicite.
 */
export function succesCourants() {
  return etatSucces;
}

/**
 * Les succès dont le bandeau a déjà été montré.
 *
 * Dans les préférences locales, et NON dans la collection : savoir qu'on a déjà
 * félicité quelqu'un est un confort d'affichage propre à un appareil, pas un
 * fait de la collection. Les succès eux-mêmes ne se stockent nulle part — voir
 * l'en-tête de `domain/succes.js`, qui explique pourquoi les déduire vaut mieux
 * que les retenir.
 */
function annoncesVues() {
  const prefs = readPrefs();
  return new Set(Array.isArray(prefs.succesVus) ? prefs.succesVus : []);
}

/**
 * Recalcule les succès et rafraîchit ce qui en dépend.
 *
 * Appelé par `main.js` à chaque fois que les compteurs sont refaits, donc à
 * chaque case cochée. Le travail est borné : cinq mesures sur des compteurs
 * déjà calculés, et un redessin de cinq cartes seulement quand l'une d'elles
 * change d'état.
 */
export function majSucces(bilan) {
  const avant = etatSucces;
  etatSucces = evaluerSucces(bilan);

  // Ne redessiner que si quelque chose a bougé : sans ce test, cocher une case
  // reconstruirait cinq boutons à chaque fois, pour rien.
  const bouge =
    avant.length !== etatSucces.length ||
    etatSucces.some((s, i) => !avant[i] || avant[i].obtenu !== s.obtenu || avant[i].fait !== s.fait);
  if (bouge) {
    redessinerRecompenses();
    // La page des succès écoute, mais ne se redessine que si elle est ouverte.
    // Émettre depuis ici plutôt que la laisser recalculer garantit qu'elle
    // montre exactement le même état que le bandeau de déverrouillage.
    document.dispatchEvent(new CustomEvent("funkylldex:succes"));
  }

  const vues = annoncesVues();
  const nouveaux = etatSucces.filter((s) => s.obtenu && !vues.has(s.cle));
  if (!nouveaux.length) return;

  for (const succes of nouveaux) vues.add(succes.cle);
  writePrefs({ ...readPrefs(), succesVus: [...vues] });
  annoncer(nouveaux);
}

/** Repeint le panneau des récompenses, s'il est construit. */
function redessinerRecompenses() {
  const panneau = document.querySelector('.themes__panel[data-famille="recompenses"]');
  if (!panneau) return;
  fill(panneau, THEMES.filter((theme) => idDeFamille(theme.groupe) === "recompenses").map(carte));
  syncPicker();
}

/**
 * Le bandeau de déverrouillage.
 *
 * `role="status"` et non `alert` : c'est une bonne nouvelle, pas une urgence —
 * un lecteur d'écran doit l'annoncer quand il a fini sa phrase, sans couper.
 *
 * Il ne dit pas quelle palette a été gagnée, et c'est délibéré : la couleur est
 * la surprise. Il dit qu'il y a quelque chose à aller voir.
 */
function annoncer(nouveaux) {
  // Quatre titres au plus. Le bandeau en listait autant qu'il en arrivait, ce
  // qui allait tant qu'il y avait cinq succès en tout ; à quarante-trois, la
  // première ouverture en débloque une douzaine d'un coup et la liste couvrait
  // la moitié de l'écran.
  const MONTRES = 4;
  const titres = nouveaux.slice(0, MONTRES).map((s) => t(s.titre)).join(" · ");
  const reste = nouveaux.length - MONTRES;

  // La palette n'est promise que si l'un des nouveaux en ouvre vraiment une.
  // Cinq succès sur quarante-trois déverrouillent un thème : l'annoncer à
  // chaque fois aurait envoyé chercher une couleur qui n'existe pas.
  const palette = nouveaux.some((s) => s.theme);

  const bandeau = el(
    "div.succes-bandeau",
    { role: "status", "aria-live": "polite" },
    el("span.bandeau__titre", nouveaux.length > 1 ? t("Succès débloqués") : t("Succès débloqué")),
    el("p.succes__liste", reste > 0 ? `${titres} + ${reste}` : titres),
    el(
      "span.bandeau__suite",
      palette
        ? t("Une nouvelle palette vous attend dans les thèmes.")
        : t("À voir dans la page des succès.")
    )
  );
  document.body.append(bandeau);
  jouer("succes");
  setTimeout(() => bandeau.remove(), 7000);
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
  // avoir a ouvrir la palette. Le dessin, lui, ne change pas — c'est une roue
  // chromatique, et un quartier en prend l'accent tout seul, par le CSS.
  peindreBoutonTheme();
}

/**
 * Le libellé du bouton de thème.
 *
 * À part, parce qu'il se repeint à DEUX occasions sans rapport : quand le thème
 * change — `apply()` — et quand la langue change, où le thème, lui, n'a pas
 * bougé. Laissé dans `apply()`, il restait dans la langue du dernier
 * changement de thème ; au démarrage, c'était toujours le français, puisque
 * `initTheme()` s'exécute avant que la table anglaise soit chargée.
 *
 * Trois morceaux traduits séparément, et non une phrase entière : le nom du
 * thème est l'un des trente-huit, une phrase complète en aurait donc demandé
 * trente-huit. La ponctuation voyage AVEC les morceaux — le français met une
 * espace avant les deux-points, l'anglais non, et « Theme : Dark » aurait trahi
 * la traduction aussi sûrement qu'un mot resté en français.
 */
function peindreBoutonTheme() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const courant = PAR_VALEUR.get(document.documentElement.dataset.theme) || PAR_VALEUR.get("dark");
  button.title = `${t("Thème :")} ${t(courant.label)}${t(" — cliquer pour changer")}`;
  button.setAttribute("aria-label", button.title);
}
