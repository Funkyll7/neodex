/**
 * carte-partage.js — la collection entière en une image.
 *
 * POURQUOI UNE IMAGE, ET PAS LE TEXTE QU'ON AVAIT.
 *
 * Le bouton partageait quatre lignes de texte. C'était honnête et parfaitement
 * illisible : « 1733 / 2802 » ne dit rien à qui ne connaît pas le dénominateur,
 * et surtout le texte ne montrait qu'une seule des trois collections. Le
 * Pokédex GO n'y était pas, le carnet de chasse non plus, les succès non plus.
 * Une carte les met côte à côte, à l'échelle, et se lit d'un coup d'œil.
 *
 * POURQUOI DU CANVAS, ET RIEN D'AUTRE.
 *
 * Les deux autres voies sont fermées. Une bibliothèque type html2canvas est une
 * dépendance, et ce site n'en a aucune — c'est la règle qui le garde réparable
 * dans dix ans. Un SVG sérialisé puis dessiné dans une image est séduisant mais
 * ment sur les polices : un SVG chargé comme image n'a accès à AUCUNE police de
 * la page, il faudrait embarquer Baloo 2 en base64 dans chaque carte. Le canvas,
 * lui, dessine avec les polices déjà chargées par le document. Il ne coûte rien
 * et ne dépend de rien.
 *
 * POURQUOI UNE TAILLE FIXE.
 *
 * 1080 × 1350, sans `devicePixelRatio`. L'image QUITTE la machine : sa
 * définition ne doit pas dépendre de l'écran qui l'a fabriquée, sinon la même
 * collection sort en 1080 depuis un portable et en 3240 depuis un téléphone
 * récent. Le format 4:5 est celui qui survit le mieux aux recadrages.
 *
 * POURQUOI ON MONTRE LA CARTE AVANT DE LA PARTAGER.
 *
 * L'ancien bouton était aveugle : il appelait `navigator.share`, qui n'existe
 * pas sur la plupart des ordinateurs, puis le presse-papiers, qui peut être
 * refusé — et dans ce cas il ne se passait RIEN. On dessine d'abord, on montre,
 * et l'utilisateur choisit ce qu'il en fait. Le partage système reste déclenché
 * par un vrai clic, ce que `navigator.share` exige de toute façon.
 *
 * Ce module est dans `ui/` : il dessine. Il ne calcule aucun compteur — tout
 * vient de `domain/progress.js`, `domain/quetes.js` et `domain/succes.js`.
 */

import { el } from "../core/dom.js";
import { langueCourante, t } from "../core/i18n.js";
import { progressOf, goProgressOf } from "../domain/progress.js";
import { chassesOuvertes, totalPartie } from "../domain/quetes.js";
import { countComplete } from "../domain/completion.js";
import { evaluerSucces } from "../domain/succes.js";
import { THEMES } from "./themes-list.js";

const LARGEUR = 1080;
const HAUTEUR = 1350;
const MARGE = 64;
/** Largeur utile d'un panneau, bornes comprises. */
const UTILE = LARGEUR - MARGE * 2;

/**
 * Neuf teintes pour neuf générations.
 *
 * Fixes et non calculées à la volée : une rampe générée par un `hsl(i * 40)`
 * donne du vert olive en cinquième position et deux bleus voisins qu'on ne
 * distingue plus une fois la barre réduite à vingt-six pixels. Ces neuf-là ont
 * été choisies pour rester séparables côte à côte, et pour tenir aussi bien sur
 * un fond sombre que sur un fond clair — la carte suit le thème de
 * l'utilisateur, elle peut donc sortir en clair.
 */
const TEINTES_GEN = [
  "#ff6b6b", "#ff9f43", "#ffd43b", "#a9e34b", "#38d9a9",
  "#4dabf7", "#748ffc", "#da77f2", "#f783ac",
];

/* ------------------------------ le dessin -------------------------------- */

/**
 * Relit les couleurs du thème COURANT.
 *
 * La carte doit ressembler au Pokédex qu'on a sous les yeux, thème de
 * récompense compris : sortir une carte bleu nuit alors qu'on a débloqué et
 * choisi « Couronne » aurait été le partage de quelqu'un d'autre. On lit donc
 * les variables au moment du dessin, jamais à l'import.
 */
function palette() {
  const style = getComputedStyle(document.documentElement);
  const lire = (nom, defaut) => (style.getPropertyValue(nom) || "").trim() || defaut;
  return {
    fond: lire("--bg", "#0a0d17"),
    fondBas: lire("--bg-sunken", "#0e1424"),
    panneau: lire("--bg-raised", "#141a2b"),
    creux: lire("--bg-inset", "#161d31"),
    trait: lire("--border", "#222a40"),
    traitFort: lire("--border-strong", "#2a3350"),
    texte: lire("--text", "#eef1f8"),
    doux: lire("--text-soft", "#bdc7e0"),
    discret: lire("--text-muted", "#a4b1cf"),
    fantome: lire("--text-ghost", "#8d96b2"),
    accent: lire("--accent", "#ffcb05"),
    corps: lire("--font-body", "system-ui, sans-serif"),
    titre: lire("--font-display", "system-ui, sans-serif"),
  };
}

/** Rectangle à coins ronds, avec le repli pour les navigateurs sans `roundRect`. */
function boite(c, x, y, l, h, r) {
  c.beginPath();
  if (typeof c.roundRect === "function") {
    c.roundRect(x, y, l, h, r);
    return;
  }
  // Repli manuel : `roundRect` n'existe que depuis Chrome 99 / Safari 16. Une
  // carte à coins droits reste une carte ; une exception, non.
  c.moveTo(x + r, y);
  c.arcTo(x + l, y, x + l, y + h, r);
  c.arcTo(x + l, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + l, y, r);
  c.closePath();
}

/** Pose un panneau et rend son intérieur utile. */
function panneau(c, p, y, h) {
  boite(c, MARGE, y, UTILE, h, 26);
  c.fillStyle = p.panneau;
  c.fill();
  c.strokeStyle = p.trait;
  c.lineWidth = 2;
  c.stroke();
  return { x: MARGE + 36, l: UTILE - 72, y };
}

function ecrire(c, p, texte, x, y, opts = {}) {
  const { taille = 24, poids = 600, couleur = p.texte, police = "corps", align = "left" } = opts;
  c.font = `${poids} ${taille}px ${police === "titre" ? p.titre : p.corps}`;
  c.fillStyle = couleur;
  c.textAlign = align;
  c.textBaseline = "alphabetic";
  c.fillText(texte, x, y);
}

/** Le titre d'un panneau, avec sa petite barre d'accent à gauche. */
function titreDePanneau(c, p, texte, zone) {
  c.fillStyle = p.accent;
  boite(c, zone.x, zone.y + 30, 5, 22, 2.5);
  c.fill();
  ecrire(c, p, texte, zone.x + 18, zone.y + 49, {
    taille: 26, poids: 800, police: "titre", couleur: p.doux,
  });
}

/**
 * L'anneau d'avancement.
 *
 * Un anneau plutôt qu'une barre parce qu'il porte le pourcentage EN SON
 * CENTRE : c'est le seul chiffre qu'on lit à coup sûr sur une vignette réduite
 * dans une conversation, et il doit être le plus gros de la carte.
 */
function anneau(c, p, cx, cy, r, pct) {
  const epaisseur = 26;
  c.lineCap = "round";

  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.strokeStyle = p.creux;
  c.lineWidth = epaisseur;
  c.stroke();

  // Un avancement nul ne dessine RIEN : `arc` avec un angle nul et un bout
  // arrondi laisse quand même un point, et une carte à 0 % aurait affiché une
  // pastille dorée orpheline en haut de l'anneau.
  if (pct > 0) {
    const debut = -Math.PI / 2;
    c.beginPath();
    c.arc(cx, cy, r, debut, debut + (Math.PI * 2 * Math.min(pct, 100)) / 100);
    c.strokeStyle = p.accent;
    c.lineWidth = epaisseur;
    c.stroke();
  }
  c.lineCap = "butt";

  // Le nombre et son signe forment UN bloc, qu'on mesure avant de le poser.
  // Les décaler à la main de part et d'autre du centre ne marchait qu'à deux
  // chiffres : « 7 % » partait à gauche, « 100 % » mordait sur l'anneau.
  const grand = 78;
  const petit = 34;
  c.font = `800 ${grand}px ${p.titre}`;
  const largeurNombre = c.measureText(String(pct)).width;
  c.font = `800 ${petit}px ${p.titre}`;
  const largeurSigne = c.measureText("%").width;
  const gauche = cx - (largeurNombre + 6 + largeurSigne) / 2;

  ecrire(c, p, String(pct), gauche, cy + 14, { taille: grand, poids: 800, police: "titre" });
  ecrire(c, p, "%", gauche + largeurNombre + 6, cy + 14, {
    taille: petit, poids: 800, police: "titre", couleur: p.accent,
  });
  ecrire(c, p, t("de la collection"), cx, cy + 52, {
    taille: 19, poids: 600, couleur: p.fantome, align: "center",
  });
}

/**
 * La barre des générations : une part par génération, large comme son nombre de
 * cases, remplie comme son avancement.
 *
 * C'est le même découpage que la barre de la colonne de gauche, et pour la même
 * raison : une case appartient à UNE génération, donc les neuf parts se somment
 * exactement au total. Un découpage qui se recouvrirait — captures, puis
 * chromatiques, puis paires — ferait une barre dont le tout ne veut rien dire.
 */
function barreDesGenerations(c, p, zone, gens, ordre) {
  const y = zone.y + 76;
  const h = 26;
  const total = ordre.reduce((s, n) => s + gens[n].total, 0) || 1;
  // L'écart entre deux parts est pris SUR les parts et non ajouté : sans cela
  // la barre dépassait de trente-deux pixels à droite du panneau.
  const ecart = 4;
  const dispo = zone.l - ecart * (ordre.length - 1);

  let x = zone.x;
  ordre.forEach((numero, i) => {
    const seau = gens[numero];
    const large = (seau.total / total) * dispo;
    const remplie = seau.total ? (seau.done / seau.total) * large : 0;
    const teinte = TEINTES_GEN[i % TEINTES_GEN.length];

    // La part NON faite garde la couleur de sa génération, en sourdine.
    //
    // On ne dessinait d'abord que la part faite, sur une piste grise commune :
    // neuf pastilles courtes séparées par du vide, dont on ne pouvait lire ni
    // la taille de chaque génération ni ce qu'il y restait. Avec sa propre
    // piste teintée, chaque génération occupe VISIBLEMENT sa largeur, et le
    // contraste entre le vif et le sourd dit exactement où l'on en est.
    c.save();
    c.globalAlpha = 0.22;
    boite(c, x, y, large, h, h / 2);
    c.fillStyle = teinte;
    c.fill();
    c.restore();

    if (remplie > 0.5) {
      // Plancher à un demi-cercle : en dessous, un rectangle arrondi devient un
      // fuseau plus étroit que haut, illisible. Mieux vaut une pastille ronde
      // un peu généreuse qu'un trait qu'on ne voit pas.
      boite(c, x, y, Math.max(remplie, h / 2), h, h / 2);
      c.fillStyle = teinte;
      c.fill();
    }
    x += large + ecart;
  });
}

/** La légende des générations, trois colonnes sur trois rangées. */
function legendeDesGenerations(c, p, zone, gens, ordre, noms) {
  const colonnes = 3;
  const largeurCol = zone.l / colonnes;
  ordre.forEach((numero, i) => {
    const cx = zone.x + (i % colonnes) * largeurCol;
    const cy = zone.y + 152 + Math.floor(i / colonnes) * 42;
    c.beginPath();
    c.arc(cx + 7, cy - 6, 7, 0, Math.PI * 2);
    c.fillStyle = TEINTES_GEN[i % TEINTES_GEN.length];
    c.fill();
    ecrire(c, p, noms[i], cx + 24, cy, { taille: 21, poids: 600, couleur: p.discret });
    ecrire(c, p, `${gens[numero].pct} %`, cx + largeurCol - 30, cy, {
      taille: 21, poids: 800, couleur: p.doux, align: "right",
    });
  });
}

/** Un panneau « titre + trois chiffres alignés ». Sert à GO et aux chasses. */
function panneauChiffres(c, p, y, titre, stats) {
  const zone = panneau(c, p, y, 150);
  titreDePanneau(c, p, titre, zone);
  const pas = zone.l / stats.length;
  stats.forEach((stat, i) => {
    const cx = zone.x + pas * i + pas / 2;
    ecrire(c, p, stat.val, cx, y + 110, {
      taille: 38, poids: 800, police: "titre", align: "center",
      couleur: stat.ton || p.texte,
    });
    ecrire(c, p, stat.cle, cx, y + 134, {
      taille: 19, poids: 600, couleur: p.fantome, align: "center",
    });
  });
  return zone;
}

/**
 * Les cinq succès.
 *
 * Obtenu : la pastille du thème qu'il déverrouille, pleine. Pas encore :
 * l'anneau seul, plus son avancement en arc. C'est le choix déjà fait dans le
 * menu des thèmes, et pour la même raison — un cadenas sans mesure décourage au
 * lieu d'attirer, alors qu'un arc aux trois quarts donne envie de finir.
 */
function panneauDesSucces(c, p, y, succes) {
  const zone = panneau(c, p, y, 176);
  const gagnes = succes.filter((s) => s.obtenu).length;
  titreDePanneau(c, p, t("Succès"), zone);
  ecrire(c, p, `${gagnes} / ${succes.length}`, zone.x + zone.l, y + 49, {
    taille: 22, poids: 800, couleur: p.fantome, align: "right",
  });

  const pas = zone.l / succes.length;
  succes.forEach((s, i) => {
    const cx = zone.x + pas * i + pas / 2;
    const cy = y + 110;
    const theme = THEMES.find((th) => th.verrou === s.cle);
    const couleur = (theme && theme.pastille) || p.accent;

    c.beginPath();
    c.arc(cx, cy, 25, 0, Math.PI * 2);
    if (s.obtenu) {
      c.fillStyle = couleur;
      c.fill();
    } else {
      c.strokeStyle = p.traitFort;
      c.lineWidth = 3;
      c.stroke();
      // L'arc d'avancement par-dessus l'anneau éteint : on voit d'un coup
      // lequel des succès restants est le plus proche.
      if (s.total > 0 && s.fait > 0) {
        c.beginPath();
        c.arc(cx, cy, 25, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * s.fait) / s.total);
        c.strokeStyle = couleur;
        c.lineWidth = 3;
        c.stroke();
      }
    }
    ecrire(c, p, t(s.titre), cx, y + 158, {
      taille: 18, poids: s.obtenu ? 800 : 600, align: "center",
      couleur: s.obtenu ? p.doux : p.fantome,
    });
  });
}

/**
 * Dessine la carte, et rend aussi sa version texte.
 *
 * Les deux sortent du MÊME calcul, et c'est tout l'intérêt de les fabriquer
 * ensemble : le texte servait de résumé indépendant, avec ses propres appels à
 * `progressOf`, et les deux pouvaient diverger sans qu'on le voie. Le texte
 * reste indispensable — c'est le repli quand le partage de fichier n'existe
 * pas, et le seul format lisible par un lecteur d'écran à l'autre bout.
 *
 * @returns {{canvas: HTMLCanvasElement, texte: string}}
 */
export function dessinerCarte(ctx) {
  const p = palette();
  const langue = langueCourante();
  const nombre = new Intl.NumberFormat(langue);
  const { dataset, collection, store } = ctx;

  const prog = progressOf(dataset.species, collection);
  const go = goProgressOf(dataset.goEntries, collection);
  const carnet = collection.quetes;
  const ouvertes = chassesOuvertes(carnet).size;
  const rencontres = Object.values(carnet.parties || {}).reduce((s, part) => s + totalPartie(part), 0);
  const succes = evaluerSucces(prog);

  const gens = prog.gens || {};
  const ordre = Object.keys(gens)
    .filter((n) => gens[n].total > 0)
    .sort((a, b) => a - b);
  const noms = ordre.map((numero) => {
    const meta = dataset.generations[numero];
    return meta && meta.region ? t(meta.region) : `${t("Génération")} ${numero}`;
  });

  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR;
  canvas.height = HAUTEUR;
  const c = canvas.getContext("2d");

  /* --- le fond --- */
  const degrade = c.createLinearGradient(0, 0, 0, HAUTEUR);
  degrade.addColorStop(0, p.fond);
  degrade.addColorStop(1, p.fondBas);
  c.fillStyle = degrade;
  c.fillRect(0, 0, LARGEUR, HAUTEUR);
  // Le filet d'accent en haut : c'est ce qui fait reconnaître la carte comme
  // venant d'ici, le jour où le thème change tout le reste.
  c.fillStyle = p.accent;
  c.fillRect(0, 0, LARGEUR, 6);

  /* --- l'en-tête --- */
  ecrire(c, p, "Funkylldex", MARGE, 108, { taille: 46, poids: 800, police: "titre" });
  ecrire(
    c,
    p,
    new Date().toLocaleDateString(langue, { day: "numeric", month: "long", year: "numeric" }),
    LARGEUR - MARGE,
    106,
    { taille: 21, poids: 600, couleur: p.fantome, align: "right" }
  );

  /* --- le bloc de tête --- */
  const tete = panneau(c, p, 140, 300);
  anneau(c, p, MARGE + 180, 290, 106, prog.all.pct);
  const lignes = [
    { cle: t("Cases cochées"), val: `${nombre.format(prog.all.done)} / ${nombre.format(prog.all.total)}` },
    { cle: t("Chromatiques"), val: `${nombre.format(prog.shiny.done)} / ${nombre.format(prog.shiny.total)}` },
    { cle: t("Paires ♂ / ♀"), val: `${prog.pairs.done} / ${prog.pairs.total}` },
  ];
  lignes.forEach((ligne, i) => {
    const y = 232 + i * 68;
    ecrire(c, p, ligne.cle, MARGE + 340, y, { taille: 21, poids: 600, couleur: p.fantome });
    ecrire(c, p, ligne.val, tete.x + tete.l, y + 2, {
      taille: 34, poids: 800, police: "titre", align: "right",
    });
    if (i < lignes.length - 1) {
      c.fillStyle = p.trait;
      c.fillRect(MARGE + 340, y + 24, tete.l - 276, 1);
    }
  });

  /* --- le Pokédex national --- */
  const nat = panneau(c, p, 460, 300);
  titreDePanneau(c, p, t("Pokédex national"), nat);
  // Les Pokémon ENTIÈREMENT obtenus, et non les cases : ce chiffre-là répétait
  // mot pour mot le « Cases cochées » du bloc au-dessus. Le nombre d'espèces
  // complètes est la seule autre lecture du même travail — celle qui compte un
  // Miaouss pour un, quand les cases le comptent pour huit.
  ecrire(
    c,
    p,
    `${nombre.format(countComplete(dataset.species, collection))} / ${nombre.format(dataset.species.length)} ★`,
    nat.x + nat.l,
    509,
    { taille: 22, poids: 800, couleur: p.fantome, align: "right" }
  );
  barreDesGenerations(c, p, nat, gens, ordre);
  legendeDesGenerations(c, p, nat, gens, ordre, noms);

  /* --- le Pokédex GO --- */
  panneauChiffres(c, p, 780, t("Pokédex GO"), [
    { cle: t("Attrapés"), val: `${nombre.format(go.owned)} / ${nombre.format(go.total)}` },
    { cle: t("Chromatiques"), val: nombre.format(go.shiny), ton: p.accent },
    { cle: t("Avancement"), val: `${go.pct} %` },
  ]);

  /* --- le carnet de chasse --- */
  panneauChiffres(c, p, 950, t("Chasses"), [
    { cle: t("Quêtes accomplies"), val: nombre.format(store.state.questDone) },
    { cle: t("Chasses en cours"), val: nombre.format(ouvertes) },
    { cle: t("Rencontres comptées"), val: nombre.format(rencontres) },
  ]);

  /* --- les succès --- */
  panneauDesSucces(c, p, 1120, succes);

  /* --- le pied --- */
  const retard = ordre
    .map((numero, i) => ({ nom: noms[i], pct: gens[numero].pct }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3)
    .map((g) => `${g.nom} ${g.pct} %`);
  if (retard.length) {
    ecrire(c, p, `${t("Reste à faire")} · ${retard.join("  ·  ")}`, LARGEUR / 2, 1328, {
      taille: 20, poids: 600, couleur: p.fantome, align: "center",
    });
  }

  const texte = [
    `Funkylldex — ${t("ma collection")}`,
    `${prog.all.pct} % · ${nombre.format(prog.all.done)} / ${nombre.format(prog.all.total)} ${t("cases cochées")}`,
    `${t("Chromatiques")} ${nombre.format(prog.shiny.done)} / ${nombre.format(prog.shiny.total)} · ` +
      `${t("Paires ♂ / ♀")} ${prog.pairs.done} / ${prog.pairs.total}`,
    `${t("Pokédex GO")} ${go.pct} % · ${nombre.format(go.owned)} / ${nombre.format(go.total)}`,
    `${t("Quêtes accomplies")} ${nombre.format(store.state.questDone)} · ` +
      `${t("Rencontres comptées")} ${nombre.format(rencontres)}`,
    `${t("Succès")} ${succes.filter((s) => s.obtenu).length} / ${succes.length}`,
    retard.length ? `${t("Reste à faire")} : ${retard.join(" · ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { canvas, texte };
}

/* ------------------------------ le panneau ------------------------------- */

/** Le canvas en PNG, en promesse — `toBlob` n'a pas de version qui en rend une. */
function enPng(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Un nom de fichier daté, pour que deux cartes ne s'écrasent pas au téléchargement. */
function nomDeFichier() {
  const d = new Date();
  const deux = (n) => String(n).padStart(2, "0");
  return `funkylldex-${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}.png`;
}

/**
 * Ouvre le panneau de partage : dessine, montre, et laisse choisir.
 *
 * L'attente de `document.fonts.ready` n'est pas une précaution de style. Le
 * canvas ne DEMANDE pas les polices : si Baloo 2 n'est pas encore arrivée, il
 * dessine silencieusement dans la police par défaut du système et rend une
 * carte en Times New Roman qu'on ne peut plus corriger. La promesse est déjà
 * résolue en pratique — on ne partage pas dans la première seconde — mais elle
 * coûte zéro et ferme le cas.
 */
export async function ouvrirCartePartage(ctx) {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Une police manquante dégrade la carte ; elle ne doit pas l'empêcher.
    }
  }

  const { canvas, texte } = dessinerCarte(ctx);
  const png = await enPng(canvas);
  // `toBlob` peut rendre `null` si le canvas est trop grand pour la mémoire du
  // navigateur. On n'ouvre alors rien du tout : mieux vaut copier le texte que
  // montrer un cadre vide.
  if (!png) {
    await copierTexte(texte, null);
    return;
  }

  const url = URL.createObjectURL(png);
  const rendu = document.activeElement;
  const etat = el("p.carte__etat", { role: "status", "aria-live": "polite" });

  const image = el("img.carte__image", {
    src: url,
    // Le texte de remplacement N'EST PAS décoratif : c'est la seule façon dont
    // un lecteur d'écran connaîtra le contenu de l'image, et c'est aussi ce
    // qu'on partage. Autant que ce soit le résumé complet.
    alt: texte,
    width: LARGEUR,
    height: HAUTEUR,
  });

  const fermer = () => {
    document.removeEventListener("keydown", auClavier);
    URL.revokeObjectURL(url);
    fond.remove();
    if (rendu && rendu.isConnected) rendu.focus();
  };

  const auClavier = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      fermer();
    }
  };

  const boutonPartager = el(
    "button.btn.btn--primary",
    { type: "button", onclick: () => partager(png, texte, etat) },
    t("Partager")
  );

  const fond = el(
    "div.carte-fond",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": t("Carte de collection"),
      // Le clic sur le fond ferme, mais PAS le clic sur la carte : sans ce
      // test, faire glisser la sélection sur l'image refermait le panneau.
      onclick: (event) => {
        if (event.target === fond) fermer();
      },
    },
    el(
      "div.carte-boite",
      image,
      el(
        "div.carte__actions",
        boutonPartager,
        el(
          "button.btn.btn--ghost",
          { type: "button", onclick: () => telecharger(url, etat) },
          t("Télécharger")
        ),
        el(
          "button.btn.btn--ghost",
          { type: "button", onclick: () => copierTexte(texte, etat) },
          t("Copier le texte")
        ),
        el("button.btn.btn--ghost", { type: "button", onclick: fermer }, t("Fermer"))
      ),
      etat
    )
  );

  document.body.append(fond);
  document.addEventListener("keydown", auClavier);
  boutonPartager.focus();
}

/**
 * Le partage système.
 *
 * `canShare({files})` avant `share` : sur un ordinateur de bureau, `share`
 * existe souvent alors que le partage de FICHIER n'est pas géré, et l'appel
 * échouait par une exception au lieu de dire non. On retombe alors sur le
 * texte, qui passe partout.
 */
async function partager(png, texte, etat) {
  const dire = (message) => {
    if (etat) etat.textContent = message;
  };
  const fichier = new File([png], nomDeFichier(), { type: "image/png" });

  try {
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      await navigator.share({ files: [fichier], text: texte });
      dire(t("Partagé."));
      return;
    }
    if (navigator.share) {
      await navigator.share({ text: texte });
      dire(t("Partagé."));
      return;
    }
  } catch (error) {
    // Fermer le menu de partage lève un `AbortError` : ce n'est pas un échec,
    // c'est un renoncement, et le signaler comme une erreur serait mentir.
    if (error && error.name === "AbortError") {
      dire(t("Partage annulé."));
      return;
    }
  }
  await copierTexte(texte, etat, t("Ce navigateur ne partage pas de fichier."));
}

/** Le téléchargement, seul moyen sûr de garder la carte sur un ordinateur. */
function telecharger(url, etat) {
  const lien = el("a", { href: url, download: nomDeFichier() });
  document.body.append(lien);
  lien.click();
  lien.remove();
  if (etat) etat.textContent = t("Image enregistrée.");
}

async function copierTexte(texte, etat, prefixe) {
  const dire = (message) => {
    if (etat) etat.textContent = prefixe ? `${prefixe} ${message}` : message;
  };
  try {
    await navigator.clipboard.writeText(texte);
    dire(t("Texte copié."));
  } catch {
    // Le presse-papiers se refuse hors HTTPS et hors geste utilisateur. Le
    // texte est déjà dans l'attribut `alt` de l'image : on le dit plutôt que
    // de laisser un bouton sans effet.
    dire(t("Sélectionnez le texte pour le copier."));
  }
}
