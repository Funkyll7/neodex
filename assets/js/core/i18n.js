/**
 * i18n.js — la langue de l'interface.
 *
 * Le francais est la langue SOURCE, et le texte francais est sa propre cle.
 * On ecrit `t("Capturés")` et non `t("filters.status.owned")` : pas de
 * catalogue de cles a inventer, rien a garder aligne entre le code et un
 * fichier, et le code reste lisible pour qui parle francais — ce qui est le
 * cas de tout ce depot, commentaires compris.
 *
 * Le prix de ce choix est connu : deux textes francais identiques qui
 * demandent deux traductions differentes se marchent dessus. « Filtres » est
 * un bouton dans la barre du haut et un titre de section dans la colonne ;
 * l'anglais voudra peut-etre « Filter » pour l'un et « Filters » pour l'autre.
 * D'ou le second argument de `t()`, qui distingue les homonymes sans obliger a
 * nommer les 1500 autres.
 *
 * En francais, `t()` rend son argument sans rien faire : la langue par defaut
 * ne coute donc pas une lecture de table, pas un octet de reseau, et le
 * fichier anglais n'est jamais telecharge.
 */

import { CONFIG } from "../config.js";

/** La langue affichee. Rien d'autre dans le site ne doit ecrire cette variable. */
let langue = "fr";

/**
 * Le contenu de data/i18n/en.json, une fois charge.
 *
 * `null` tant qu'on est en francais — et c'est voulu : un lecteur francais ne
 * telecharge jamais les 46 Ko de la table anglaise.
 */
let table = null;

/** Construit a la demande : `Intl.PluralRules` coute a l'instanciation. */
let regleDuPluriel = null;

export function langueCourante() {
  return langue;
}

export function enAnglais() {
  return langue === "en";
}

/**
 * Ce que l'utilisateur avait choisi la derniere fois.
 *
 * Lu dans les memes preferences que le theme : une seule cle de stockage, un
 * seul objet a lire au demarrage.
 */
export function languePreferee() {
  try {
    const prefs = JSON.parse(localStorage.getItem(CONFIG.storage.prefs) || "{}");
    return prefs.langue === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

function retenirLangue(valeur) {
  try {
    const cle = CONFIG.storage.prefs;
    const prefs = JSON.parse(localStorage.getItem(cle) || "{}");
    localStorage.setItem(cle, JSON.stringify({ ...prefs, langue: valeur }));
  } catch {
    /* stockage indisponible : la langue redeviendra le francais au rechargement */
  }
}

/**
 * Applique une langue, en chargeant sa table si besoin.
 *
 * Asynchrone parce que passer a l'anglais demande un fichier. L'appelant doit
 * attendre avant de redessiner, sinon il redessine en francais.
 *
 * Si le fichier ne vient pas — hors ligne, premiere visite —, on RESTE en
 * francais plutot que d'afficher une interface a moitie traduite. Mieux vaut
 * une langue entiere qu'un melange.
 */
export async function choisirLangue(valeur) {
  const cible = valeur === "en" ? "en" : "fr";

  if (cible === "en" && !table) {
    const reponse = await fetch("data/i18n/en.json");
    if (!reponse.ok) throw new Error(`table anglaise indisponible (${reponse.status})`);
    table = await reponse.json();
  }

  langue = cible;
  regleDuPluriel = null;
  retenirLangue(cible);

  // L'attribut `lang` du document n'est PAS pose ici : ce module est importe
  // par `domain/`, qui ne doit jamais toucher au DOM. C'est `ui/langue.js` qui
  // s'en charge, juste apres cet appel. Il compte pourtant : il commande la
  // cesure, le choix des glyphes, et la prononciation par un lecteur d'ecran —
  // sans lui, « Caught » serait lu a la francaise.
  return cible;
}

/**
 * Une chaine d'interface.
 *
 * @param {string} fr        le texte francais, qui est aussi la cle
 * @param {string} [contexte] pour distinguer deux emplois du meme mot
 */
export function t(fr, contexte) {
  if (langue === "fr" || !table) return fr;
  const ui = table.ui || {};
  if (contexte) {
    // Deux points doubles comme separateur, et non une espace : les chaines
    // francaises en contiennent toutes, « Filtres actifs » suivi du contexte
    // « titre » aurait donc pu heurter une vraie chaine « Filtres actifs titre ».
    const precis = ui[`${fr}::${contexte}`];
    if (precis) return precis;
  }
  // Pas de repli silencieux vers une chaine vide : ce qui manque reste en
  // francais, visible, et donc corrigeable. Une interface a trous se remarque ;
  // une interface muette, non.
  // Puis les noms venus des donnees de reference — jeux, generations, regions.
  // Ils sont clees par le francais eux aussi, et les separer obligeait chaque
  // appelant a savoir dans quelle table chercher. Ici, `t()` suffit partout.
  return ui[fr] || (table.games || {})[fr] || fr;
}

/**
 * Une chaine qui s'accorde en nombre.
 *
 * Le francais du site n'a jamais eu de forme singulier — il affiche « 1 / 1025
 * cases cochées » et personne ne s'en offusque. L'anglais, lui, rend « 1 boxes
 * checked », qui saute aux yeux. C'est donc la bascule qui oblige a distinguer
 * les deux formes, pas le francais.
 *
 * `Intl.PluralRules` plutot qu'un `n > 1` : il connait les regles de chaque
 * langue, y compris celles ou le pluriel ne commence pas a deux.
 */
export function tn(n, unSeul, plusieurs) {
  if (langue === "fr") return n > 1 ? plusieurs : unSeul;
  if (!regleDuPluriel) regleDuPluriel = new Intl.PluralRules(langue);
  const forme = regleDuPluriel.select(n);
  return t(forme === "one" ? unSeul : plusieurs);
}

/* ------------------------------------------------------------------------ *
 * Les noms qui viennent des donnees.
 *
 * Chacun a sa fonction plutot qu'un `t()` unique, parce que chacun a une cle
 * differente — et ces cles ne sont pas le francais. Voir tools/build_i18n.md
 * pour la raison, qui tient a six categories francaises ambigues.
 * ------------------------------------------------------------------------ */

/** Le nom d'une espece. L'anglais dort deja dans les donnees, champ `en`. */
export function nomEspece(espece) {
  if (langue === "fr") return espece.name;
  return espece.en || espece.name;
}

/** Le nom d'un type — « Plante » devient « Grass ». */
export function nomType(type) {
  if (langue === "fr" || !table) return type;
  return (table.types || {})[type] || type;
}

/**
 * La categorie d'une espece, clee par son NUMERO et non par le francais :
 * « Pokémon Poisson » vaut a lui seul Fish, Goldfish, Angler et Water Fish.
 */
export function nomCategorie(espece) {
  if (langue === "fr" || !table) return espece.cat;
  return (table.categories || {})[String(espece.id)] || espece.cat;
}

/** Le nom d'une forme alternative, clee par sa cle PokeAPI. */
export function nomForme(forme) {
  if (langue === "fr" || !table) return forme.name;
  return (table.forms || {})[forme.key] || forme.name;
}

/**
 * Un texte de `data/details/cosmetic-forms.json` — le nom d'un Zarbi, le titre
 * d'une famille, mais aussi le « ou trouver » d'une variante et ses notes.
 *
 * Clee par le texte FRANCAIS, et non par une cle PokeAPI comme les formes
 * alternatives : ces variantes-la n'en ont pas. Elles sont fabriquees au
 * chargement a partir du fichier, et leur texte francais est ce qu'elles ont de
 * stable. Meme convention que `t()`, donc, mais dans une table a part : 330
 * entrees qui n'ont rien a faire dans `ui`, et que `t()` n'a aucune raison de
 * parcourir a chaque libelle d'interface.
 */
export function nomCosmetique(nom) {
  if (langue === "fr" || !table) return nom;
  return (table.cosmetics || {})[nom] || nom;
}

/**
 * Un texte de `data/reference/hunt.json` : nom de methode, etape, fragment.
 *
 * Table a part, et non `ui`, pour la meme raison que les cosmetiques : 133
 * phrases de chasse au chromatique n'ont rien a faire au milieu des libelles
 * d'interface, et `t()` n'a aucune raison de les parcourir a chaque bouton.
 *
 * LES EMPLACEMENTS A VARIABLES SURVIVENT. Les modeles portent `{cible}`,
 * `{nom}`, `{base}`, `{charme}`, `{evolution}`, et `domain/hunt.js` les remplit
 * APRES coup. La traduction doit donc les reproduire tels quels — c'est
 * verifie : chaque entree anglaise porte exactement les memes accolades que sa
 * source francaise.
 */
export function texteChasse(fr) {
  if (langue === "fr" || !table) return fr;
  return (table.hunt || {})[fr] || fr;
}

/**
 * Le « ou trouver » d'une espece, venu de `data/details/gen-*.json`.
 *
 * Clee par le francais, comme les cosmetiques : ces phrases n'ont pas
 * d'identifiant propre dans les donnees, elles sont ecrites a la main espece
 * par espece.
 *
 * Une table a part encore, et c'est la troisieme du meme genre. Le partage
 * n'est pas gratuit : deux phrases identiques dans deux fichiers differents
 * pourraient vouloir deux traductions, et les melanger dans une seule table
 * rendrait ce conflit invisible. Chaque fichier de donnees garde donc la
 * sienne.
 */
export function lieuEspece(fr) {
  if (langue === "fr" || !table) return fr;
  return (table.lieux || {})[fr] || fr;
}

/**
 * Une note explicative des donnees : pourquoi un chromatique est verrouille
 * dans tel jeu, ce qu'une forme a de particulier.
 *
 * Vient de `data/reference/shiny-locks.json` et des champs `note` de
 * `data/details/`. Ce sont les seuls textes du site qui expliquent une ABSENCE —
 * « aucun chromatique n'existe » —, et c'est pour cela qu'ils comptent : sans
 * eux, une case barree n'a l'air que d'un bogue.
 */
export function noteDonnees(fr) {
  if (langue === "fr" || !table) return fr;
  // DEUX tables, interrogees dans l'ordre : `notes` porte shiny-locks.json et
  // les notes d'especes, `formes` porte les « ou trouver » et les notes de
  // details/forms.json. Elles restent separees parce que leurs fichiers le sont
  // — une meme phrase francaise dans deux fichiers pourrait vouloir deux
  // traductions, et les fondre rendrait ce conflit invisible. Mais elles
  // servent la meme chose a l'ecran, la prose qui explique une forme ou une
  // absence, d'ou un seul lecteur.
  const tables = [table.notes, table.formes];
  for (const t of tables) if (t && t[fr]) return t[fr];
  return fr;
}

/**
 * Le nom d'une boite du Pokedex GO.
 *
 * `entree.name` est calcule une fois pour toutes au chargement des donnees, et
 * l'objet est gele : impossible de le traduire sur place. On refait donc le
 * nom a l'affichage, depuis les trois pieces que l'entree porte deja — une
 * espece, une forme, ou une espece plus un suffixe de variante.
 */
export function nomEntreeGo(entree) {
  if (langue === "fr") return entree.name;
  if (entree.form) return nomForme(entree.form);
  // `variant.short` reste francais tant que la table des formes cosmetiques
  // n'existe pas : mieux vaut « Pikachu Casquette » que rien du tout.
  if (entree.variant) return `${nomEspece(entree.species)} ${entree.variant.short}`;
  return nomEspece(entree.species);
}

/**
 * La locale a passer a `localeCompare` pour trier des noms.
 *
 * Le tri par nom etait fige sur « fr ». Ce n'etait pas qu'une question de
 * locale : les NOMS eux-memes changent — Bulbizarre devient Bulbasaur, Roucool
 * devient Pidgey. L'ordre alphabetique du Pokedex entier est donc different
 * d'une langue a l'autre, et un comparateur fige aurait menti sur les deux.
 */
export function localeDeTri() {
  return langue;
}
