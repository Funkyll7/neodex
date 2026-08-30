/**
 * sprites.js — fabrique les URL d'images et gere les replis.
 *
 * Deux cas distincts :
 *   - une espece : PokeAPI ne fournit pas toujours le sprite "female", ni le
 *     sprite HOME chromatique. `spriteImg` degrade female -> male -> artwork.
 *   - une forme alternative : tools/build_forms.py a verifie image par image ce
 *     qui existe reellement (data/forms/*.json, champ `sprites`). On part donc
 *     directement de la bonne source au lieu d'attendre un 404.
 */

import { CONFIG } from "../config.js";

/**
 * Le theme « Pixels » ne change pas que des couleurs : il change les images.
 *
 * Un theme ordinaire ne touche qu'a des variables CSS, et les sprites sont des
 * images distantes — aucune regle de style ne peut les remplacer. On passe donc
 * par ici, seul endroit du site ou une adresse de sprite se fabrique.
 *
 * Un simple drapeau de module, et non un argument de plus sur chaque appel : la
 * trentaine de points d'appel de `spriteImg` n'a rien a savoir du theme choisi,
 * et `ui/theme.js` reste le seul a decider.
 */
let enPixels = false;

/**
 * DEUX SOURCES, UN SEUL ETAT.
 *
 * Les pixels venaient du theme, et de lui seul : les six themes « Pixels »
 * changeaient les images en meme temps que les couleurs. C'etait un accident
 * d'implementation devenu une regle — vouloir le pixel art obligeait a prendre
 * la palette qui allait avec, et aimer une autre palette obligeait a renoncer
 * aux pixels. Deux gouts sans rapport, lies par un seul drapeau.
 *
 * Le style est maintenant AUSSI une recompense, choisie a part et valable sur
 * les trente-huit palettes. Les deux sources sont donc retenues separement et
 * combinees par un OU : un theme « Pixels » donne des pixels comme avant, et le
 * choix explicite les donne partout ailleurs. Aucune des deux ne peut effacer
 * l'autre — c'est ce qu'un drapeau unique faisait, et c'est ce qui rendait
 * l'ordre des appels significatif.
 *
 * Les deux poseurs rendent l'etat EFFECTIF, pour que l'appelant sache quoi
 * poser sur `<html>` sans refaire le calcul de son cote.
 */
let themeEnPixels = false;
let choixEnPixels = false;

function recalculer() {
  enPixels = themeEnPixels || choixEnPixels;
  return enPixels;
}

/** Le theme courant demande-t-il des pixels ? Rend l'etat effectif. */
export function setSpritesEnPixels(actif) {
  themeEnPixels = Boolean(actif);
  return recalculer();
}

/** La recompense « Style de sprite ». Rend l'etat effectif. */
export function setStyleDeSprite(cle) {
  choixEnPixels = cle === "pixels";
  return recalculer();
}

export function spritesEnPixels() {
  return enPixels;
}

export function spriteUrl(id, { shiny = false, female = false } = {}) {
  return `${CONFIG.spriteBase}${shiny ? "shiny/" : ""}${female ? "female/" : ""}${id}.png`;
}

/**
 * L'adresse en pixels, quand le theme la demande — sinon rien.
 *
 * Elle se met EN TETE d'une chaine de replis, jamais a la place. Le dossier en
 * pixels ne couvre pas exactement le meme catalogue que celui de HOME :
 * quelques formes recentes y manquent, comme il en manque deja dans HOME.
 * Remplacer l'adresse laissait alors un carre vide ; l'ajouter en tete fait
 * simplement retomber sur le rendu 3D, ce qui est moche mais visible.
 *
 * Le dossier n'a pas non plus de variante femelle — les differences de sexe
 * n'etaient pas dessinees a cette epoque. On demande le sprite commun.
 */
function urlsEnPixels(nom, { shiny = false, replier = true } = {}) {
  if (!enPixels) return [];
  const base = CONFIG.spritePixelBase;
  if (!shiny) return [`${base}${nom}.png`];

  const liste = [`${base}shiny/${nom}.png`];
  // Le sprite NORMAL comme dernier secours d'un chromatique : mieux vaut un
  // sprite en pixels de la mauvaise teinte qu'un rendu 3D au milieu des autres.
  //
  // Mais `formImg` demande a le placer lui-meme, plus bas. Intercale ici, il
  // court-circuitait toutes les vraies sources de chromatique qui viennent
  // apres — le dossier chromatique de Showdown en servait vingt-deux, et les
  // Formes Meteore de Meteno une de plus. Elles affichaient donc le sprite
  // normal alors que le bon existait, sans que rien ne le signale.
  if (replier) liste.push(`${base}${nom}.png`);
  return liste;
}

/**
 * Les rares sprites choisis a la main, en tout dernier recours.
 *
 * Apres PokeAPI et apres le projet Smogon : ce n'est utile que pour ce
 * qu'aucune communaute n'a dessine. Le Pikachu Partenaire n'y figure plus —
 * Showdown en a un vrai, dessine pour LUI, la ou celui de Jaune n'etait qu'un
 * Pikachu ordinaire. On le garde tout de meme en bout de chaine : il ne coute
 * rien et il reste juste, le Pikachu Partenaire etant celui de Jaune.
 *
 * Une fonction et non une chaine : `CONFIG` est lu au moment de l'appel, pas au
 * chargement du module, ce qui laisse la table lisible en tete de fichier.
 */
const PIXELS_CHOISIS = {
  10158: () => `${CONFIG.spriteJauneBase}25.png`,
};

/**
 * Les formes dont le sprite en pixels vit dans le depot.
 *
 * Vingt-six formes du DLC Mega-Dimension n'ont de pixel art nulle part —
 * mesure faite source par source sur les 304 formes du jeu de donnees. Deux
 * artistes les ont dessinees a la main, et leurs images sont maintenant ici.
 *
 * Une liste explicite, et non un simple essai suivi d'un repli : sans elle,
 * les 278 AUTRES formes demanderaient chacune un fichier absent avant de
 * continuer leur chaine. Un 404 par forme affichee, pour rien.
 *
 * Y ajouter une forme, c'est deposer `<cle>.png` dans assets/img/pixels/ et
 * ecrire sa cle ici. Rien d'autre.
 */
const PIXELS_LOCAUX = new Set([
  "absol-mega-z",
  "barbaracle-mega",
  "baxcalibur-mega",
  "darkrai-mega",
  "dragalge-mega",
  "eelektross-mega",
  "falinks-mega",
  "garchomp-mega-z",
  "golisopod-mega",
  "heatran-mega",
  "lucario-mega-z",
  "magearna-mega",
  "magearna-original-mega",
  "malamar-mega",
  "meowstic-male-mega",
  "pyroar-mega",
  "raichu-mega-x",
  "raichu-mega-y",
  "scolipede-mega",
  "scrafty-mega",
  "staraptor-mega",
  // Les trois Nigirigon partagent un seul dessin, et c'est fidele au jeu : la
  // Mega-Evolution fond les trois formes en une.
  "tatsugiri-curly-mega",
  "tatsugiri-droopy-mega",
  "tatsugiri-stretchy-mega",
  "zeraora-mega",
  "zygarde-mega",
]);

/**
 * Celles dont on a AUSSI le chromatique — les vingt-six, desormais.
 *
 * Elles n'etaient que six a l'origine : PokeAPI et Showdown ne servent pas de
 * chromatique pour ces formes, et les rares planches trouvees en ligne n'en
 * couvraient qu'une poignee. Les vingt autres ont ete dessinees a la main par
 * le proprietaire de ce Pokedex.
 *
 * La liste reste explicite plutot qu'un essai a l'aveugle, pour la meme raison
 * que la premiere : ne jamais demander un fichier qu'on sait absent. Elle est
 * pleine aujourd'hui, mais une forme ajoutee demain arriverait sans son
 * chromatique, et c'est cette liste qui evitera alors un 404 par affichage.
 */
const PIXELS_LOCAUX_SHINY = new Set([
  "absol-mega-z",
  "barbaracle-mega",
  "baxcalibur-mega",
  "darkrai-mega",
  "dragalge-mega",
  "eelektross-mega",
  "falinks-mega",
  "garchomp-mega-z",
  "golisopod-mega",
  "heatran-mega",
  "lucario-mega-z",
  "magearna-mega",
  "magearna-original-mega",
  "malamar-mega",
  "meowstic-male-mega",
  "pyroar-mega",
  "raichu-mega-x",
  "raichu-mega-y",
  "scolipede-mega",
  "scrafty-mega",
  "staraptor-mega",
  "tatsugiri-curly-mega",
  "tatsugiri-droopy-mega",
  "tatsugiri-stretchy-mega",
  "zeraora-mega",
  "zygarde-mega",
]);

/**
 * Les rares formes dont le chromatique est celui de l'ESPECE.
 *
 * Les six Formes Meteore de Meteno n'ont aucun chromatique dessine, ni chez
 * PokeAPI ni chez Showdown — et pour une bonne raison : la coque est identique
 * quelle que soit la couleur du noyau, et c'est justement l'apparence par
 * defaut de l'espece. Le chromatique de l'espece EST donc le leur.
 *
 * Une exception nommee, et non un repli general vers l'espece : retomber sur
 * l'espece pour n'importe quelle forme afficherait un AUTRE Pokemon — un
 * Mega-Dracaufeu X deviendrait un Dracaufeu. Ici la substitution est juste
 * parce que les deux images sont la meme.
 */
const CHROMATIQUE_DE_L_ESPECE = {
  "minior-orange-meteor": 774,
  "minior-yellow-meteor": 774,
  "minior-green-meteor": 774,
  "minior-blue-meteor": 774,
  "minior-indigo-meteor": 774,
  "minior-violet-meteor": 774,
};

/**
 * L'adresse locale d'une forme, quand elle existe — sinon rien.
 *
 * `replier` suit la meme regle que `urlsEnPixels` : le sprite normal ne doit
 * pas se glisser au milieu d'une chaine de chromatiques, ou il couperait
 * l'herbe sous le pied des sources qui viennent apres. Les vingt-six formes
 * locales ont toutes leur chromatique aujourd'hui, mais une forme ajoutee
 * demain sans le sien tomberait droit dans ce piege.
 */
function urlsLocales(key, { shiny = false, replier = true } = {}) {
  if (!enPixels || !key || !PIXELS_LOCAUX.has(key)) return [];
  const base = CONFIG.spritePixelLocalBase;
  const liste = [];
  if (shiny && PIXELS_LOCAUX_SHINY.has(key)) liste.push(`${base}${key}.shiny.png`);
  if (replier || !shiny) liste.push(`${base}${key}.png`);
  return liste;
}

export function artworkUrl(id, { shiny = false } = {}) {
  return `${CONFIG.artworkBase}${shiny ? "shiny/" : ""}${id}.png`;
}

/**
 * Cree un <img> qui tente successivement plusieurs sources.
 * On garde `loading="lazy"` : la grille peut afficher un millier d'images.
 */
export function spriteImg(id, { shiny = false, female = false, alt = "", className = "", paresseux = true } = {}) {
  const chain = urlsEnPixels(id, { shiny });
  if (female) chain.push(spriteUrl(id, { shiny, female: true }));
  chain.push(spriteUrl(id, { shiny }));
  chain.push(artworkUrl(id, { shiny }));
  if (shiny) chain.push(artworkUrl(id));
  return imageFrom(chain, alt, className, paresseux);
}

/**
 * Image d'une forme alternative. `form.sprites` dit ce qui existe : on ne
 * demande jamais une image absente, et une forme sans chromatique connu
 * retombe volontairement sur son image normale.
 */
export function formImg(form, { shiny = false, alt = "", className = "", paresseux = true } = {}) {
  const has = form.sprites || {};
  // En tete de tout : les seuls sprites dont on SAIT qu'ils sont la, parce
  // qu'ils sont dans le depot. Ils ne couvrent que les vingt-six formes
  // qu'aucune source distante ne sert ; pour les 278 autres, cette liste est
  // vide et la chaine reprend normalement.
  const chain = urlsLocales(form.key, { shiny, replier: false });

  // Puis PokeAPI. En tete de ce qui suit, jamais a la place : une forme absente
  // du dossier en pixels retombe ainsi sur son rendu HOME au lieu de laisser un
  // carre vide.
  chain.push(...urlsEnPixels(form.id, { shiny, replier: false }));

  // Puis le projet Smogon, la ou PokeAPI s'arrete. Sa cle est celle de la
  // forme, telle quelle — `clefable-mega`, `pikachu-starter` — et c'est ce qui
  // rend ce repli sur, en plus d'etre court : une cle inconnue rend 404 et la
  // chaine continue, la ou une cle « rapprochee » aurait affiche un AUTRE
  // Pokemon. Essaye et rejete : `absol-mega-z` tombait ainsi sur `absol-mega`,
  // qui est une toute autre creature.
  //
  // Le dossier chromatique EN PREMIER quand on demande un chromatique : il est
  // separe chez Showdown, et l'oublier faisait afficher le sprite normal a la
  // place — mesure sur les 304 formes, vingt-deux etaient dans ce cas, dont le
  // Pikachu et l'Evoli Partenaire.
  if (enPixels && form.key) {
    if (shiny) chain.push(`${CONFIG.spriteShowdownShinyBase}${form.key}.png`);
    chain.push(`${CONFIG.spriteShowdownBase}${form.key}.png`);
  }

  // Les six Formes Meteore de Meteno, dont le chromatique est celui de
  // l'espece : meme image, la coque ne depend pas du noyau.
  const especeChromatique = CHROMATIQUE_DE_L_ESPECE[form.key];
  if (enPixels && shiny && especeChromatique) {
    chain.push(`${CONFIG.spritePixelBase}shiny/${especeChromatique}.png`);
  }
  // Le normal en pixels seulement MAINTENANT, une fois tous les chromatiques
  // essayes : c'est un pis-aller, il ne doit pas passer devant une vraie image.
  if (enPixels && shiny) {
    chain.push(...urlsLocales(form.key, { shiny: false }));
    chain.push(`${CONFIG.spritePixelBase}${form.id}.png`);
  }

  // Puis, s'il en existe un, le sprite choisi a la main pour cette forme.
  const choisi = PIXELS_CHOISIS[form.id];
  if (enPixels && choisi) chain.push(choisi());
  if (shiny) {
    if (has.homeShiny) chain.push(spriteUrl(form.id, { shiny: true }));
    if (has.artShiny) chain.push(artworkUrl(form.id, { shiny: true }));
  }
  if (has.home) chain.push(spriteUrl(form.id));
  if (has.art) chain.push(artworkUrl(form.id));
  // Filet de securite si le referentiel n'a pas encore ete regenere.
  if (!chain.length) chain.push(spriteUrl(form.id, { shiny }), artworkUrl(form.id));
  // Le repli ultime doit exister meme quand `has` a rempli la chaine : sans
  // lui, une forme absente du dossier en pixels n'avait plus rien a essayer.
  else if (enPixels) chain.push(spriteUrl(form.id, { shiny }), artworkUrl(form.id));
  return imageFrom(chain, alt || form.name, className, paresseux);
}

/**
 * Image d'une forme cosmetique. Les sprites sont nommes par forme et non par
 * id — "666-savanna", "201-b", "869-rainbow-swirl-love-sweet". Une variante
 * sans sprite propre (Théffroi Contrefaçon / Authentique, indiscernables en
 * jeu) retombe simplement sur l'image de l'espece.
 */
export function cosmeticImg(variant, speciesId, { shiny = false, alt = "", className = "" } = {}) {
  if (!variant.sprite) return spriteImg(speciesId, { shiny, alt: alt || variant.name, className });

  // Le theme « Pixels » vaut ici aussi : le dossier en pixels nomme ses formes
  // cosmetiques comme le dossier classique, « 172-spiky-eared » y figure. En
  // tete de chaine et non a la place — une variante qui y manquerait retombe
  // ainsi sur son sprite habituel.
  const base = variant.spriteSet === "classic" ? CONFIG.spriteClassicBase : CONFIG.spriteBase;
  // `replier: false` pour la meme raison que dans `formImg` : le sprite normal
  // en pixels ne doit pas se glisser devant le chromatique du dossier classique,
  // qui vient juste apres. Il aurait affiche la mauvaise teinte alors que la
  // bonne existait.
  const chain = urlsEnPixels(variant.sprite, { shiny, replier: false });
  if (shiny) chain.push(`${base}shiny/${variant.sprite}.png`);
  if (enPixels && shiny) chain.push(`${CONFIG.spritePixelBase}${variant.sprite}.png`);
  chain.push(`${base}${variant.sprite}.png`);
  // Repli si le depot de sprites change de nommage : l'espece, jamais rien.
  chain.push(spriteUrl(speciesId, { shiny }), artworkUrl(speciesId));
  return imageFrom(chain, alt || variant.name, className);
}

function imageFrom(chain, alt, className, paresseux = true) {
  const img = document.createElement("img");
  img.alt = alt;
  /* PARESSEUX DANS LA GRILLE, PRESSÉ DANS LA FICHE.
     `lazy` est le bon réglage pour un millier de vignettes dont vingt sont à
     l'écran. Il est le mauvais pour la fiche d'un Pokémon : elle s'ouvre en
     feuille plein écran, ses images sont visibles à l'instant où elle apparaît,
     et le chargement paresseux leur faisait attendre un tour de mise en page de
     plus. Sur un réseau de téléphone, ce tour se compte en secondes — c'est le
     « ils mettent quinze ans à apparaître » qui a été signalé. */
  img.loading = paresseux ? "lazy" : "eager";
  if (!paresseux) img.fetchPriority = "high";
  img.decoding = "async";
  /* Le texte de remplacement ne se DESSINE pas.
     Entre deux essais de la chaîne, le navigateur affiche un instant l'icône
     d'image cassée suivie du texte `alt` — « Shaymin Céleste » s'étalait alors
     en travers de la tuile et poussait la mise en page. Le texte reste dans le
     document, pour les lecteurs d'écran et pour la recherche du navigateur ;
     il ne se voit simplement plus. */
  img.style.color = "transparent";
  if (className) img.className = className;

  let step = 0;
  img.addEventListener("error", () => {
    step += 1;
    if (step < chain.length) img.src = chain[step];
    else img.removeAttribute("src");
  });
  img.src = chain[0];
  return img;
}
