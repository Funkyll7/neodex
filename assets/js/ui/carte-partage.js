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
import { bilanDesSucces, evaluerSucces } from "../domain/succes.js";
import { dessinerIcone } from "./icones-succes.js";
import { bannierePortee, cartePortee, titrePorte } from "./recompenses.js";
import { retourFerme } from "./retour.js";

const LARGEUR = 1080;
const HAUTEUR = 1350;
const MARGE = 64;
/** Largeur utile d'un panneau, bornes comprises. */
const UTILE = LARGEUR - MARGE * 2;

/**
 * La géométrie de l'habillage « Carte postale ».
 *
 * LA BANDE DU HAUT EST LARGE, ET C'EST LA CORRECTION D'UN DÉFAUT. Le timbre
 * était d'abord posé dans le coin haut droit du canvas, par-dessus la carte :
 * il recouvrait l'en-tête, c'est-à-dire le nom et le pourcentage — exactement
 * ce qu'on partage. Une vraie carte postale ne colle pas son timbre sur le
 * texte, elle lui réserve une bande. Celle-ci fait cent soixante pixels, la
 * carte est repoussée d'autant, et plus rien ne se recouvre.
 *
 * Le prix est une carte 12 % plus petite, donc un texte 12 % plus petit. C'est
 * le prix de l'habillage, il est payé par qui le choisit, et le défaut n'y
 * touche pas. */
const POSTALE = { cote: 38, haut: 160, bas: 38 };

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
    // Les cinq crans de rareté, résolus ici. Ils sont écrits en `color-mix`
    // dans la feuille de style : `getComputedStyle` en rend la couleur finale,
    // que le canvas comprend, là où la déclaration elle-même ne lui dirait rien.
    raretes: [1, 2, 3, 4, 5].map((n) => lire(`--rarete-${n}`, "#8b95a8")),
    corps: lire("--font-body", "system-ui, sans-serif"),
    titre: lire("--font-display", "system-ui, sans-serif"),
  };
}

/**
 * La peinture du filet de tête, selon le bandeau porté.
 *
 * Un dégradé de canvas n'existe que pour un contexte donné : il se fabrique ici,
 * au dessin, et pas dans une table de constantes. « Uni » rend une couleur
 * simple — `fillStyle` accepte les deux, l'appelant n'a pas à savoir lequel il a
 * reçu.
 */
function peintureDuBandeau(c, p, cle) {
  if (cle === "uni") return p.accent;
  const d = c.createLinearGradient(0, 0, LARGEUR, 0);
  const arrets = {
    // Les deux couleurs de la complétion, celles des barres de progression.
    degrade: [p.accent, "#ff9c3d"],
    // Les trois premières teintes de génération : la carte les porte déjà dans
    // sa barre du Pokédex national, le bandeau y répond.
    tricolore: [TEINTES_GEN[0], TEINTES_GEN[2], TEINTES_GEN[5]],
    prisme: TEINTES_GEN.filter((_, i) => i % 2 === 0),
    or: ["#8a6a00", "#ffd76a", "#8a6a00"],
  }[cle] || [p.accent];
  arrets.forEach((couleur, i) => d.addColorStop(arrets.length === 1 ? 0 : i / (arrets.length - 1), couleur));
  return d;
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

/**
 * Écrit en tenant dans une largeur donnée.
 *
 * Le canvas ne sait pas couper : il déborde, et le texte sort du panneau sans
 * rien signaler. « Collectionneur de motifs » dans une colonne de 176 px en est
 * l'exemple. On réduit donc la taille jusqu'à un plancher — en dessous, plus
 * personne ne lit —, puis on coupe à l'ellipse si ça ne suffit pas.
 */
function ecrireAjuste(c, p, texte, x, y, largeurMax, opts = {}) {
  const { taille = 24, poids = 600, police = "corps" } = opts;
  const famille = police === "titre" ? p.titre : p.corps;
  const PLANCHER = 13;

  let taillePosee = taille;
  c.font = `${poids} ${taillePosee}px ${famille}`;
  while (c.measureText(texte).width > largeurMax && taillePosee > PLANCHER) {
    taillePosee -= 1;
    c.font = `${poids} ${taillePosee}px ${famille}`;
  }

  let sortie = texte;
  while (sortie.length > 1 && c.measureText(`${sortie}…`).width > largeurMax) {
    sortie = sortie.slice(0, -1);
  }
  if (sortie !== texte) sortie = `${sortie.trimEnd()}…`;

  ecrire(c, p, sortie, x, y, { ...opts, taille: taillePosee });
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

/**
 * Le Pokédex national, au sens où on l'entend d'habitude : UNE case par espèce.
 *
 * Le panneau montrait les compteurs de `progressOf`, qui comptent les CASES —
 * normal, chromatique, ♂, ♀, formes et variantes cosmétiques. Un Miaouss y pèse
 * huit. Sous un titre « Pokédex national », « Kanto 70 % » se lisait donc comme
 * « 70 % des Pokémon de Kanto » alors qu'il en disait tout autre chose, et le
 * chiffre juste répondait à une étiquette qui promettait autre chose.
 *
 * Les chromatiques sont comptés deux panneaux plus haut, et les formes dans le
 * total des cases : les répéter ici ne servait qu'à rendre ce panneau illisible.
 *
 * Calculé ici et non dans `domain/progress.js` : `progressOf` tourne à chaque
 * case cochée, la carte se dessine sur demande. Un parcours de mille espèces
 * de plus n'a rien à faire dans le premier.
 */
function especesParGeneration(dataset, collection) {
  const seaux = {};
  for (const espece of dataset.species) {
    const seau = seaux[espece.gen] || (seaux[espece.gen] = { done: 0, total: 0, pct: 0 });
    seau.total += 1;
    if (collection.isOwned(espece.id)) seau.done += 1;
  }
  for (const seau of Object.values(seaux)) {
    seau.pct = seau.total ? Math.round((seau.done / seau.total) * 100) : 0;
  }
  return seaux;
}

/**
 * La légende des générations, trois colonnes sur trois rangées.
 *
 * Précédée d'une ligne qui dit CE QU'ON COMPTE : sans elle, rien ne distingue
 * « une case par espèce » de « toutes les cases », et les deux lectures donnent
 * des pourcentages très différents.
 */
function legendeDesGenerations(c, p, zone, gens, ordre, noms) {
  ecrire(c, p, t("Pokémon capturés par région — une case par espèce"), zone.x, zone.y + 128, {
    taille: 18, poids: 600, couleur: p.fantome,
  });

  const colonnes = 3;
  const largeurCol = zone.l / colonnes;
  ordre.forEach((numero, i) => {
    const cx = zone.x + (i % colonnes) * largeurCol;
    const cy = zone.y + 164 + Math.floor(i / colonnes) * 42;
    c.beginPath();
    c.arc(cx + 7, cy - 6, 7, 0, Math.PI * 2);
    c.fillStyle = TEINTES_GEN[i % TEINTES_GEN.length];
    c.fill();
    ecrire(c, p, noms[i], cx + 24, cy, { taille: 21, poids: 600, couleur: p.discret });
    // Le COMPTE et non le pourcentage. « Kanto 70 % » oblige à connaître le
    // dénominateur pour savoir ce qu'il reste ; « 151 / 151 » dit d'un coup
    // que la région est finie, et « 138 / 151 » dit combien manquent. Le
    // pourcentage n'a pas disparu pour autant — c'est ce que la barre au-dessus
    // dessine, à l'échelle et sans un chiffre.
    const seau = gens[numero];
    const fini = seau.done === seau.total;
    ecrire(c, p, `${seau.done} / ${seau.total}`, cx + largeurCol - 30, cy, {
      taille: 21, poids: 800, align: "right",
      // Une région terminée passe à l'accent : sur neuf lignes de chiffres, ce
      // sont les seules qu'on cherche.
      couleur: fini ? p.accent : p.doux,
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
 * Les cinq succès les plus rares, nommés.
 *
 * TROIS VERSIONS, ET LA TROISIÈME EST LA BONNE. On a d'abord montré les cinq
 * succès de l'époque, nommés. Puis, passé à quarante-trois, une étagère de
 * vingt icônes muettes — les nommer tous étant impossible. C'était l'erreur :
 * vingt formes sans légende ne disent rien à personne, et surtout elles
 * mélangeaient les gagnés et ceux qui restent à faire, sur une carte dont le
 * seul objet est de montrer ce qu'on a.
 *
 * Cinq, gagnés, nommés, les plus rares d'abord. `rang` classe les succès par
 * difficulté ; à rang égal on garde l'ordre du fichier, qui va du plus
 * accessible au plus lointain — le dernier arrivé passe donc devant.
 *
 * Rien n'est dessiné s'il n'y a rien à montrer : cinq pastilles éteintes sous
 * un « 0 / 43 » n'apprendraient rien de plus que le compte lui-même.
 */
function panneauDesSucces(c, p, y, succes) {
  const zone = panneau(c, p, y, 190);
  const gagnes = succes.filter((s) => s.obtenu);
  titreDePanneau(c, p, t("Succès"), zone);
  ecrire(c, p, `${gagnes.length} / ${succes.length}`, zone.x + zone.l, y + 49, {
    taille: 22, poids: 800, couleur: p.fantome, align: "right",
  });

  const MONTRES = 5;
  const rares = gagnes
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (b.s.rang || 0) - (a.s.rang || 0) || b.i - a.i)
    .slice(0, MONTRES)
    .map((x) => x.s);
  if (!rares.length) return;

  // Les cinq restent centrés quel qu'en soit le nombre : trois succès rangés
  // dans cinq colonnes auraient laissé un trou à droite, comme s'il manquait
  // quelque chose. On divise par ce qu'on montre.
  const pas = zone.l / rares.length;
  rares.forEach((s, i) => {
    const cx = zone.x + pas * i + pas / 2;
    // La couleur de RARETÉ, la même que dans la page des succès et la même sur
    // les trente-huit palettes. C'est ce qui rend la carte lisible par quelqu'un
    // d'autre : l'or dit « très loin » sans qu'on ait à connaître le Pokédex.
    dessinerIcone(c, s.icone, cx, y + 98, 34, p.raretes[(s.rang || 1) - 1]);
    // La colonne fait 176 px, « Collectionneur de motifs » en fait 200 à cette
    // taille : sans l'ajustement, le nom sortait par-dessus ses voisins.
    ecrireAjuste(c, p, t(s.titre), cx, y + 144, pas - 12, {
      taille: 17, poids: 700, couleur: p.doux, align: "center",
    });
    // La CONDITION sous le nom, en trois mots. « Chasseur émérite » ne dit pas
    // ce qu'il a fallu faire, et c'est justement ce qu'on regarde sur la carte
    // de quelqu'un d'autre. Le champ `resume` des succès est une phrase
    // entière — « Obtenir cinq cents chromatiques. » —, illisible dans une
    // colonne de 176 px : chaque succès porte donc aussi un libellé court.
    ecrireAjuste(c, p, t(s.court || s.resume), cx, y + 168, pas - 8, {
      taille: 15, poids: 600, couleur: p.fantome, align: "center",
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
 * @param {Object} [options]
 * @param {string} [options.banniere] force le bandeau au lieu de lire celui qui
 *        est porte. Ecrit pour l'apercu d'une recompense verrouillee : on ne
 *        peut pas juger un bandeau qu'on n'a pas le droit de choisir, et le
 *        montrer sur autre chose que la vraie carte ne dirait rien.
 * @returns {{canvas: HTMLCanvasElement, texte: string}}
 */
export function dessinerCarte(ctx, options = {}) {
  const p = palette();
  const langue = langueCourante();
  const nombre = new Intl.NumberFormat(langue);
  const { dataset, collection, store } = ctx;

  const prog = progressOf(dataset.species, collection);
  const go = goProgressOf(dataset.goEntries, collection);
  const carnet = collection.quetes;
  const ouvertes = chassesOuvertes(carnet).size;
  const rencontres = Object.values(carnet.parties || {}).reduce((s, part) => s + totalPartie(part), 0);
  const complets = countComplete(dataset.species, collection);
  const succes = evaluerSucces(
    bilanDesSucces({
      progression: prog,
      progressionGo: go,
      comptes: { complete: complets, total: dataset.species.length },
      carnet,
      questDone: store.state.questDone,
      regions: Object.fromEntries(
        Object.entries(dataset.generations).map(([n, g]) => [n, g.region || g.label])
      ),
    })
  );

  // Deux découpages par génération, et ils ne comptent pas la même chose :
  // `prog.gens` compte les CASES — il alimente le total global —, `parGen`
  // compte les ESPÈCES et n'alimente que le panneau du Pokédex national.
  const parGen = especesParGeneration(dataset, collection);
  const especesPrises = Object.values(parGen).reduce((somme, g) => somme + g.done, 0);
  const ordre = Object.keys(parGen)
    .filter((n) => parGen[n].total > 0)
    .sort((a, b) => a - b);
  const noms = ordre.map((numero) => {
    const meta = dataset.generations[numero];
    return meta && meta.region ? t(meta.region) : `${t("Génération")} ${numero}`;
  });

  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR;
  canvas.height = HAUTEUR;
  const c = canvas.getContext("2d");

  /* --- l'habillage, s'il y en a un ---
     LA CARTE ENTIÈRE EST REDESSINÉE PLUS PETITE, ET PAS UNE COORDONNÉE NE
     BOUGE. Le dessin qui suit compte en 1080 × 1350 depuis le premier jour, sur
     six cents lignes ; le rentrer dans un cadre aurait voulu dire relire chaque
     `x` et chaque `y`. Une translation et une échelle posées AVANT font le même
     travail en trois lignes, et — c'est le point — laissent le reste du fichier
     ignorer qu'il existe un habillage.

     Le corollaire compte autant : les panneaux, où vit tout le texte, gardent
     leurs couleurs de thème. Le contraste mesuré sur les trente-huit palettes
     reste donc exactement celui d'avant. L'habillage n'est qu'un cadre. */
  const habillage = options.carte || cartePortee();
  const postale = habillage === "postale";
  if (postale) {
    papierDeCartePostale(c, p);
    c.save();
    c.translate(POSTALE.cote, POSTALE.haut);
    c.scale(
      (LARGEUR - 2 * POSTALE.cote) / LARGEUR,
      (HAUTEUR - POSTALE.haut - POSTALE.bas) / HAUTEUR
    );
    // Les angles arrondis se posent en découpe : sans elle, le dégradé de fond
    // remplirait les coins carrés et l'effet de photo collée disparaîtrait.
    boite(c, 0, 0, LARGEUR, HAUTEUR, 26);
    c.clip();
  }

  /* --- le fond --- */
  const degrade = c.createLinearGradient(0, 0, 0, HAUTEUR);
  degrade.addColorStop(0, p.fond);
  degrade.addColorStop(1, p.fondBas);
  c.fillStyle = degrade;
  c.fillRect(0, 0, LARGEUR, HAUTEUR);
  // Le filet de tête : c'est ce qui fait reconnaître la carte comme venant
  // d'ici, le jour où le thème change tout le reste. Sa peinture est l'une des
  // six récompenses — voir `domain/recompenses.js`.
  c.fillStyle = peintureDuBandeau(c, p, options.banniere || bannierePortee());
  c.fillRect(0, 0, LARGEUR, 6);

  /* --- l'en-tête --- */
  ecrire(c, p, "Funkylldex", MARGE, 96, { taille: 46, poids: 800, police: "titre" });
  ecrire(
    c,
    p,
    new Date().toLocaleDateString(langue, { day: "numeric", month: "long", year: "numeric" }),
    LARGEUR - MARGE,
    94,
    { taille: 21, poids: 600, couleur: p.fantome, align: "right" }
  );
  // Le titre porté, sous le nom. C'est le seul endroit de la carte qui dise
  // quelque chose de la personne plutôt que de la collection — et la raison
  // pour laquelle un titre vaut d'être gagné.
  ecrire(c, p, titrePorte(), MARGE + 2, 124, {
    taille: 21, poids: 700, couleur: p.accent,
  });

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
  // Le compte du panneau, dans l'unité du panneau : des espèces capturées, pas
  // des cases. Ce chiffre-là a porté deux autres valeurs avant celle-ci — le
  // total des cases, qui répétait mot pour mot la ligne du bloc au-dessus, puis
  // le nombre d'espèces complètes, qui parlait encore d'autre chose que la
  // barre juste en dessous.
  ecrire(
    c,
    p,
    `${nombre.format(especesPrises)} / ${nombre.format(dataset.species.length)}`,
    nat.x + nat.l,
    509,
    { taille: 22, poids: 800, couleur: p.fantome, align: "right" }
  );
  barreDesGenerations(c, p, nat, parGen, ordre);
  legendeDesGenerations(c, p, nat, parGen, ordre, noms);

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

  // PAS DE PIED. La carte se terminait par « Cases à cocher · Galar 43 % ·
  // Sinnoh 50 % · Johto 58 % » : les trois régions les plus en retard. C'est
  // une liste de courses, et elle n'a rien à faire sur une image qu'on envoie
  // à quelqu'un — on partage ce qu'on a, pas ce qu'on n'a pas. La place rendue
  // sert aux libellés courts des succès, qui eux disent quelque chose.

  // L'habillage se referme ICI, après tout le contenu : le timbre et le cachet
  // se posent SUR le papier, hors de la découpe, sinon les angles arrondis
  // rogneraient le timbre du coin.
  if (postale) {
    c.restore();
    timbreEtCachet(c, p);
  }

  const texte = [
    `Funkylldex — ${t("ma collection")}`,
    `${prog.all.pct} % · ${nombre.format(prog.all.done)} / ${nombre.format(prog.all.total)} ${t("cases cochées")}`,
    `${t("Chromatiques")} ${nombre.format(prog.shiny.done)} / ${nombre.format(prog.shiny.total)} · ` +
      `${t("Paires ♂ / ♀")} ${prog.pairs.done} / ${prog.pairs.total}`,
    `${t("Pokédex GO")} ${go.pct} % · ${nombre.format(go.owned)} / ${nombre.format(go.total)}`,
    `${t("Quêtes accomplies")} ${nombre.format(store.state.questDone)} · ` +
      `${t("Rencontres comptées")} ${nombre.format(rencontres)}`,
    `${t("Pokédex national")} ${nombre.format(especesPrises)} / ${nombre.format(dataset.species.length)}`,
    `${t("Succès")} ${succes.filter((s) => s.obtenu).length} / ${succes.length}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { canvas, texte };
}


/* --------------------------- La carte postale ---------------------------- */

/**
 * Le papier : la couleur du carton, et l'ombre portée de la photo.
 *
 * UN CRÈME FIXE, ET NON L'ACCENT DU THÈME. Un tirage papier est crème parce que
 * le papier est crème ; le teinter en vert sur une palette verte aurait donné
 * une carte verte à bord vert, c'est-à-dire pas de bord du tout. C'est le même
 * raisonnement que pour le rouge du Dynamax : quand une couleur EST l'objet, la
 * palette ne s'en mêle pas.
 *
 * Le grain est fait de traits très pâles, pas d'un bruit aléatoire : le dessin
 * doit être le même à chaque export, sinon deux cartes de la même collection
 * différeraient d'un pixel sans raison.
 */
/**
 * Le paysage d'Alola, dessiné — le fond de la carte postale.
 *
 * REDESSINÉ, PAS EMBARQUÉ. La référence est une image de l'anime : elle ne nous
 * appartient pas, et elle est floue — une capture agrandie. Un dessin vectoriel
 * reste net quelle que soit la taille, ne pèse rien, et ne pose aucune question
 * de droits. C'est le même parti que les palmes du motif « Aurore » et que les
 * ornements de vignette.
 *
 * ON NE VOIT QUE LES BORDS, et c'est ce qui décide de la composition. La carte
 * recouvre tout sauf la bande d'affranchissement en haut et quelques dizaines de
 * pixels sur les trois autres côtés. Le ciel, la montagne et les frondes sont
 * donc calés dans les cent soixante premiers pixels, et le sable dans les
 * derniers : peindre une belle jungle au milieu aurait été peindre sous la
 * carte.
 *
 * AUCUN ALÉATOIRE. Deux cartes de la même collection doivent être identiques au
 * pixel près ; toutes les positions sont donc écrites ou calculées.
 */
function paysageDAlola(c) {
  const HORIZON = 596;

  /* --- le ciel --- */
  const ciel = c.createLinearGradient(0, 0, 0, HORIZON);
  ciel.addColorStop(0, "#3fbfe4");
  ciel.addColorStop(0.55, "#8fdcf2");
  ciel.addColorStop(1, "#dff4fb");
  c.fillStyle = ciel;
  c.fillRect(0, 0, LARGEUR, HORIZON);

  // Les nuages : trois amas de disques, pas un flou. Un `shadowBlur` aurait
  // coûté un repaint par disque et rendu un gris sale sur les bords.
  const nuage = (x, y, e, alpha) => {
    c.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    for (const [dx, dy, r] of [[0, 0, 1], [-0.62, 0.2, 0.72], [0.66, 0.24, 0.66], [-1.2, 0.42, 0.5], [1.25, 0.46, 0.46]]) {
      c.beginPath();
      c.ellipse(x + dx * e, y + dy * e, r * e, r * e * 0.7, 0, 0, Math.PI * 2);
      c.fill();
    }
  };
  nuage(150, 62, 54, 0.9);
  nuage(560, 40, 44, 0.75);
  nuage(935, 96, 60, 0.85);
  nuage(330, 150, 38, 0.5);

  /* --- la montagne --- */
  // Deux masses : une crête arrière plus pâle, la principale devant. C'est ce
  // décalage qui donne la profondeur, pas un dégradé sur une seule silhouette.
  const crete = (points, haut, bas) => {
    const g = c.createLinearGradient(0, points[0][1], 0, HORIZON);
    g.addColorStop(0, haut);
    g.addColorStop(1, bas);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-40, HORIZON);
    for (const [x, y] of points) c.lineTo(x, y);
    c.lineTo(LARGEUR + 40, HORIZON);
    c.closePath();
    c.fill();
  };
  // LES SOMMETS SONT HAUTS PARCE QUE SEULS LES CENT SOIXANTE PREMIERS PIXELS
  // SE VOIENT. Une montagne qui culmine a 150 n aurait montre que dix pixels de
  // crete sous la bande ; celle-ci entre dans le cadre.
  crete([[60, 172], [250, 74], [430, 150], [660, 92], [880, 168], [1080, 128]], "#7fe0d4", "#4fbdb8");
  crete([[10, 250], [110, 168], [262, 34], [366, 116], [470, 210], [610, 156], [760, 240]], "#5fd6c6", "#2f9d9c");

  // Les ravines : des traits pâles qui descendent du sommet. Trois suffisent —
  // la montagne n'est visible que sur cent soixante pixels de haut.
  c.strokeStyle = "rgba(214, 250, 244, .5)";
  c.lineWidth = 7;
  c.lineCap = "round";
  for (const [x0, y0, x1, y1] of [0, 1, 2].map((i) => [262, 44, 194 + i * 76, 210 + i * 40])) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo((x0 + x1) / 2 + 18, (y0 + y1) / 2, x1, y1);
    c.stroke();
  }

  /* --- la jungle, puis le sable --- */
  c.fillStyle = "#2f9d63";
  c.beginPath();
  c.moveTo(-40, HORIZON + 60);
  for (let x = -40; x <= LARGEUR + 40; x += 46) {
    c.arc(x + 23, HORIZON - 6, 30, Math.PI, 0);
  }
  c.lineTo(LARGEUR + 40, HORIZON + 60);
  c.closePath();
  c.fill();

  const sable = c.createLinearGradient(0, HORIZON, 0, HAUTEUR);
  sable.addColorStop(0, "#efdcb2");
  sable.addColorStop(0.5, "#e6cf9e");
  sable.addColorStop(1, "#d3b783");
  c.fillStyle = sable;
  c.fillRect(0, HORIZON + 24, LARGEUR, HAUTEUR - HORIZON - 24);

  // Les ornières du chemin : des arcs très pâles qui fuient vers l'horizon.
  c.strokeStyle = "rgba(160, 130, 82, .22)";
  c.lineWidth = 9;
  for (const d of [-1, 1]) {
    c.beginPath();
    c.moveTo(LARGEUR / 2 + d * 40, HORIZON + 40);
    c.quadraticCurveTo(LARGEUR / 2 + d * 210, HAUTEUR - 220, LARGEUR / 2 + d * 430, HAUTEUR + 40);
    c.stroke();
  }

  /* --- les palmiers --- */
  // UN SEUL PALMIER, ET SA COURONNE DANS LA BANDE. Il a fallu deux corrections.
  // Il etait d abord a 946, c est-a-dire exactement sous le timbre : ses
  // frondes etaient dessinees puis recouvertes. Puis a 762 mais avec la
  // couronne a 96, donc a cheval sur le bord de la carte — on n en voyait que
  // le tronc. Elle est maintenant a 46, bien au-dessus, et ses frondes
  // s etalent de 580 a 820 : a gauche du timbre, a droite de la montagne.
  //
  // Le second palmier a ete retire. Il etait a mi-hauteur, donc entierement
  // sous la carte : du dessin que personne ne verrait jamais.
  palmier(c, 686, 82, 168, 1.15);
}

/**
 * Un palmier : un tronc courbe et sept frondes.
 *
 * Les frondes reprennent la construction des palmes du motif « Aurore » — une
 * nervure et des folioles couchées vers la pointe — mais en plein plutôt qu'en
 * masque, et avec deux verts pour que celles du fond passent derrière.
 */
function palmier(c, x, y, taille, echelle) {
  // Le tronc, de bas en haut, en s'affinant.
  c.strokeStyle = "#b9925c";
  c.lineWidth = 13 * echelle;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x + 26 * echelle, y + 520 * echelle);
  c.quadraticCurveTo(x + 6 * echelle, y + 240 * echelle, x, y);
  c.stroke();
  // Les anneaux du stipe.
  c.strokeStyle = "rgba(120, 88, 48, .4)";
  c.lineWidth = 3 * echelle;
  for (let i = 1; i <= 9; i++) {
    const t = i / 10;
    const px = x + 26 * echelle * t * t;
    const py = y + 520 * echelle * t;
    c.beginPath();
    c.moveTo(px - 7 * echelle, py);
    c.lineTo(px + 7 * echelle, py);
    c.stroke();
  }

  const D = Math.PI / 180;
  // Sept frondes en eventail, de bas-gauche a bas-droite en passant par le
  // haut. Les deux verts font passer les deux premieres DERRIERE les autres :
  // une couronne d une seule teinte se lit comme une tache.
  const frondes = [
    [-170, 0.96, "#1f7a4e"],
    [-140, 1.02, "#1f7a4e"],
    [-112, 1.0, "#2a9560"],
    [-85, 0.94, "#2a9560"],
    [-58, 1.0, "#35ab6c"],
    [-30, 1.02, "#35ab6c"],
    [-5, 0.9, "#2a9560"],
  ];
  for (const [angle, longueur, couleur] of frondes) {
    c.fillStyle = couleur;
    fronde(c, x, y, angle * D, taille * longueur, echelle);
  }
}

/** Une fronde : nervure courbe, folioles de part et d'autre. */
function fronde(c, x0, y0, angle, longueur, echelle) {
  const PAS = 15;
  // LA COURBURE EST MIROIR, et c est ce qui manquait. Une fronde retombe
  // toujours vers l EXTERIEUR : celles qui partent a gauche doivent tourner a
  // gauche, celles qui partent a droite tourner a droite. Avec une courbure de
  // meme signe pour toutes, la moitie gauche de la couronne se relevait au lieu
  // de retomber — et sortait du cadre par le haut, ce qui ne laissait voir que
  // le tronc.
  const courbe = 1.05 * (Math.cos(angle) < 0 ? -1 : 1);
  const point = (t) => {
    const a = angle + courbe * t * t;
    return [x0 + Math.cos(a) * longueur * t, y0 + Math.sin(a) * longueur * t];
  };
  // La nervure, effilée.
  c.beginPath();
  c.moveTo(x0, y0);
  for (let i = 1; i <= PAS; i++) {
    const [px, py] = point(i / PAS);
    c.lineTo(px, py);
  }
  for (let i = PAS; i >= 0; i--) {
    const t = i / PAS;
    const a = angle + courbe * t * t;
    const [px, py] = point(t);
    const w = (4.8 * (1 - t) + 0.9) * echelle;
    c.lineTo(px - Math.sin(a) * w, py + Math.cos(a) * w);
  }
  c.closePath();
  c.fill();
  // Les folioles.
  for (let i = 2; i < PAS; i++) {
    const t = i / PAS;
    const a = angle + courbe * t * t;
    const [px, py] = point(t);
    // Des folioles LONGUES : a 0,3 la couronne etait une arete de poisson.
    const L = longueur * (0.44 - 0.27 * t);
    for (const cote of [-1, 1]) {
      const af = a + cote * (Math.PI / 2) - cote * 0.8 * (1 - 0.25 * t);
      c.beginPath();
      c.moveTo(px, py);
      c.quadraticCurveTo(
        px + Math.cos(af) * L * 0.55 + Math.cos(a) * L * 0.2,
        py + Math.sin(af) * L * 0.55 + Math.sin(a) * L * 0.2,
        px + Math.cos(af) * L,
        py + Math.sin(af) * L
      );
      c.quadraticCurveTo(
        px + Math.cos(a) * L * 0.34,
        py + Math.sin(a) * L * 0.34,
        px + Math.cos(a) * 2.2 * echelle,
        py + Math.sin(a) * 2.2 * echelle
      );
      c.closePath();
      c.fill();
    }
  }
}

function papierDeCartePostale(c, p) {
  // LE FOND N'EST PLUS UN CARTON, C'EST UN PAYSAGE. La bande blanche autour de
  // la carte ne disait rien ; Alola en dit quelque chose. Le dessin occupe tout
  // le canvas mais n'est visible qu'aux bords — voir `paysageDAlola`, qui cale
  // sa composition là-dessus.
  paysageDAlola(c);

  // Un voile très pâle sur l'ensemble : il RECULE le paysage d'un cran, sans
  // quoi la carte posée dessus paraissait collée sur une affiche plutôt que
  // posée sur une table. Cinq pour cent suffisent.
  c.fillStyle = "rgba(255, 252, 244, .05)";
  c.fillRect(0, 0, LARGEUR, HAUTEUR);

  // L'ombre de la photo sur le paysage. Elle est portée par le rectangle qu'on
  // s'apprête à découper, donc dessinée avant lui — une ombre posée après
  // aurait été rognée par la découpe qu'elle doit justement déborder.
  c.save();
  c.shadowColor = "rgba(74, 52, 24, .34)";
  c.shadowBlur = 26;
  c.shadowOffsetY = 8;
  c.fillStyle = "#000";
  boite(c, POSTALE.cote, POSTALE.haut, LARGEUR - 2 * POSTALE.cote, HAUTEUR - POSTALE.haut - POSTALE.bas, 26);
  c.fill();
  c.restore();
}

/**
 * Le timbre et son cachet, dans la bande d'affranchissement.
 *
 * DENTELÉ SUR UN CALQUE À PART, ET C'EST LA CORRECTION D'UN DÉFAUT. Les dents
 * étaient d'abord la couleur du carton reposée en ronds sur les bords : ça
 * marchait tant que le fond ÉTAIT ce carton. Depuis qu'il y a un paysage
 * derrière, les mêmes ronds faisaient des points crème sur de l'herbe.
 *
 * Le timbre est donc fabriqué hors écran, à sa taille, où `destination-out`
 * perce vraiment les dents — ce qu'on ne pouvait pas faire sur le canvas
 * principal sans effacer aussi le paysage et l'ombre de la carte. Le résultat
 * est collé d'un seul `drawImage` : le paysage se voit à travers les dents,
 * comme sur un vrai timbre décollé.
 *
 * Le timbre porte l'accent du THÈME : c'est la vignette du site sur la carte,
 * pas un objet du monde réel.
 */
function timbreEtCachet(c, p) {
  // DANS LA BANDE, ET JAMAIS SUR LA CARTE. Les quatre nombres se déduisent de
  // `POSTALE` plutôt que d'être posés à la main : c'est ce qui garantit que le
  // timbre ne peut pas redescendre sur l'en-tête si la bande change un jour de
  // hauteur.
  const h = POSTALE.haut - 2 * 14;
  const l = Math.round(h * 0.82);
  const x = LARGEUR - POSTALE.cote - l - 10;
  const y = 14;
  const pas = 22;

  const hors = document.createElement("canvas");
  hors.width = l;
  hors.height = h;
  const g = hors.getContext("2d");

  g.fillStyle = "#fffaf0";
  g.fillRect(0, 0, l, h);

  // TOUT EST PROPORTIONNEL À LA VIGNETTE, sans un seul nombre absolu. Le
  // timbre a déjà changé de taille une fois — il descendait sur l'en-tête — et
  // les rayons écrits en dur avaient alors débordé de leur cadre.
  const m = Math.round(l * 0.13);
  const bandeau = Math.round(h * 0.2);
  const util = { x: m, y: m, l: l - 2 * m, h: h - 2 * m - bandeau };
  const peinture = g.createLinearGradient(0, 0, l, h);
  peinture.addColorStop(0, p.accent);
  peinture.addColorStop(1, p.raretes[4] || p.accent);
  g.fillStyle = peinture;
  g.fillRect(util.x, util.y, util.l, util.h);

  const cx = l / 2;
  const cy = util.y + util.h / 2;
  const r = Math.min(util.l, util.h) * 0.38;
  g.fillStyle = "rgba(255, 250, 240, .92)";
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = peinture;
  g.fillRect(cx - r, cy - r * 0.13, r * 2, r * 0.26);
  g.beginPath();
  g.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255, 250, 240, .92)";
  g.beginPath();
  g.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = "#5a4526";
  g.font = `700 ${Math.round(l * 0.17)}px ${p.corps}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("ALOLA", cx, h - m - bandeau / 2 + 2);

  // Les dents, PERCÉES pour de bon. Sur le calque hors écran, `destination-out`
  // ne peut effacer que le timbre lui-même : c'est tout l'intérêt de l'avoir
  // sorti du canvas principal.
  g.globalCompositeOperation = "destination-out";
  const dent = (dx, dy) => {
    g.beginPath();
    g.arc(dx, dy, 7, 0, Math.PI * 2);
    g.fill();
  };
  for (let i = pas / 2; i < l; i += pas) {
    dent(i, 0);
    dent(i, h);
  }
  for (let i = pas / 2; i < h; i += pas) {
    dent(0, i);
    dent(l, i);
  }

  // Une ombre courte sous le timbre : il est COLLÉ sur la carte, il ne flotte
  // pas. Elle est portée par le drawImage, donc posée sur le canvas principal.
  c.save();
  c.shadowColor = "rgba(40, 30, 12, .3)";
  c.shadowBlur = 10;
  c.shadowOffsetY = 3;
  c.drawImage(hors, x, y);
  c.restore();

  // Le cachet : deux arcs, quelques barres et le nom, posés de travers et à
  // cheval sur le timbre — un cachet d'oblitération ne vise jamais juste. Il
  // reste DANS la bande : son centre est à mi-hauteur du timbre, et son plus
  // grand rayon tient dans la moitié de la bande.
  c.save();
  const rc = Math.min(h * 0.42, POSTALE.haut * 0.4);
  c.translate(x - rc * 0.42, y + h * 0.5);
  c.rotate(-0.22);
  c.strokeStyle = "rgba(60, 44, 22, .55)";
  c.fillStyle = "rgba(60, 44, 22, .55)";
  c.lineWidth = 3;
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const rayon of [rc, rc * 0.86]) {
    c.beginPath();
    c.arc(0, 0, rayon, 0, Math.PI * 2);
    c.stroke();
  }
  // Les barres d'oblitération partent du cachet vers la gauche, dans le vide de
  // la bande. Proportionnelles elles aussi : écrites en dur, elles sortaient du
  // papier dès que le cachet rétrécissait.
  for (let i = 0; i < 5; i++) {
    const dy = (i - 2) * rc * 0.18;
    c.beginPath();
    c.moveTo(-rc * 1.75, dy);
    c.lineTo(-rc * 1.15, dy);
    c.stroke();
  }
  c.font = `700 ${Math.round(rc * 0.3)}px ${p.corps}`;
  c.fillText("FUNKYLLDEX", 0, 0);
  c.restore();
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

  // Le balayage Retour d'un téléphone doit refermer la carte, pas quitter le
  // site — et depuis une application installée, « quitter » veut dire fermer.
  // Voir `ui/retour.js`.
  let liberer = null;

  const fermer = () => {
    document.removeEventListener("keydown", auClavier);
    URL.revokeObjectURL(url);
    fond.remove();
    if (liberer) {
      const f = liberer;
      liberer = null;
      f();
    }
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
  liberer = retourFerme(fermer);
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
