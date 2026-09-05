/**
 * reste.js — ce qu'il manque, case par case, jeu par jeu et DLC par DLC.
 *
 * LA QUESTION QU'AUCUNE VUE NE POSAIT. Le site sait montrer ce qu'on a et ce
 * qu'on n'a pas ; il ne savait pas répondre à « si je relance Émeraude,
 * qu'est-ce que ça me rapporte ». C'est pourtant la question qu'on se pose
 * avant de ressortir une cartouche, et elle a une réponse exacte : le
 * croisement de ce qui manque avec ce que ce jeu-là contient.
 *
 * ═══ CE QUE CE MODULE COMPTAIT AVANT, ET POURQUOI C'ÉTAIT TROP GROS ═══
 *
 * Il comptait des ESPÈCES, et une seule case par espèce : « il te manque sa
 * case de base ». Le raisonnement écrit ici disait que les formes, les
 * chromatiques et les cosmétiques « ne se rattachent pas proprement à un jeu »,
 * donc qu'en parler aurait promis des choses fausses.
 *
 * La prudence était juste, la conclusion non. Le jeu de données SAIT rattacher
 * une forme à un jeu : `core/data.js` pose un `games` sur CHAQUE forme —
 * `sinceOnwards()` part du jeu qui l'a introduite — et un `shinyLocked` qui dit
 * où son chromatique est verrouillé. Un Miaouss d'Alola n'est donc pas
 * « impossible à rattacher » : il est rattaché à Soleil/Lune et à ce qui suit,
 * et à rien avant. Ce qui manquait, ce n'était pas la donnée, c'était de la
 * lire.
 *
 * Et le compte à l'espèce mentait dans l'autre sens : un Pokémon dont on a le
 * normal mais pas le chromatique ne comptait pour rien du tout — alors que
 * c'est exactement le travail qui reste, et le plus long.
 *
 * ═══ LA RÈGLE, MAINTENANT ═══
 *
 * Une case manquante est rattachée à un jeu quand CE JEU PEUT LA DONNER :
 *
 *   case de l'espèce   `espece.games` la contient ; et pour un chromatique,
 *                      `canShinyIn()` — donc ni verrou de jeu, ni Gén. I ;
 *   case de forme      `forme.games` la contient ; et pour un chromatique,
 *                      le verrou propre à la forme, qui hérite déjà de celui
 *                      de l'espèce (voir `mergeForm` dans core/data.js) ;
 *   case cosmétique    elle suit l'espèce. PokeAPI ne donne pas d'entrée
 *                      distincte aux Zarbi ni aux Prismillon, donc aucun `games`
 *                      ne leur est propre — et c'est fidèle : un motif de
 *                      Prismillon existe partout où Prismillon existe.
 *
 * Le reste — ce qui manque mais que ce jeu ne peut pas donner — n'est pas jeté :
 * il est COMPTÉ À PART, dans `ailleurs`. Le taire aurait laissé croire qu'un
 * Pokémon affiché « il te manque 2 cases ici » est à deux cases d'être complet,
 * alors qu'il lui en manque peut-être vingt.
 *
 * ═══ DEUX NOMBRES POUR LE CLASSEMENT, PAS UN ═══
 *
 * « Obtenable » et « attrapable en sauvage » ne s'échangent pas :
 *
 *   obtenable    l'espèce EXISTE dans ce jeu, d'une façon ou d'une autre —
 *                échange, évolution, cadeau, événement, transfert ;
 *   en sauvage   on la croise dehors, c'est-à-dire qu'une soirée de jeu suffit.
 *
 * Un jeu qui « contient » quarante manques dont deux en sauvage ne vaut pas un
 * jeu qui en contient vingt dont dix-huit. Confondre les deux aurait donné un
 * classement faux, et un classement faux est pire qu'aucun classement.
 *
 * ═══ LES DLC SONT UN DÉCOUPAGE, PAS UNE SECONDE LISTE ═══
 *
 * Sous un jeu, chaque espèce tombe dans exactement UN groupe : le jeu de base,
 * ou le DLC sans lequel on ne l'a pas. C'est `dlcRequis()` qui tranche, la même
 * fonction que le tableau de la fiche — donc les deux vues disent la même chose
 * par construction. Répéter sous « Île Solitaire » tout ce que la cartouche
 * donne déjà aurait doublé la liste sans rien apprendre : ce qu'on vient
 * chercher, c'est « qu'est-ce que ce DLC ajoute que je n'ai pas ».
 *
 * Ce n'est pas la même question que celle des sous-lignes de la fiche, qui
 * demandent « puis-je chasser ceci avec ce DLC installé » et répondent oui pour
 * le jeu de base aussi. Voir l'en-tête de `domain/dlc.js` : deux questions
 * voisines, deux réponses, et aucune ne tient lieu de l'autre.
 *
 * Ce module ne touche pas au DOM.
 */

import { canShinyIn } from "./availability.js";
import { requiredSlots } from "./completion.js";
import { dlcRequis } from "./dlc.js";
import { casesDe } from "./livingdex.js";

/**
 * Les libellés des cases, indexés par case.
 *
 * `casesDe()` donne la STRUCTURE — l'espèce, la forme, la variante, la teinte,
 * le sexe —, `requiredSlots()` donne le LIBELLÉ traduit. Les deux parcourent la
 * même espèce dans le même ordre logique et produisent exactement le même
 * ensemble de cases : c'est écrit en toutes lettres en tête de `casesDe`, qui
 * dit refaire ce parcours pour la seule raison que `requiredSlots` ne rend pas
 * le sujet à dessiner.
 *
 * On les recoud donc ici plutôt que de réécrire les libellés : ils portent les
 * accords (« Normal ♂ », « Zarbi B shiny »), la traduction des 304 formes et le
 * nom de la variante cosmétique de base. Les refaire aurait créé le second
 * endroit à tenir d'accord que `completion.js` interdit en toutes lettres.
 */
function libellesDe(espece) {
  const table = new Map();
  for (const entree of requiredSlots(espece)) table.set(entree.slot, entree.label);
  return table;
}

/**
 * Cette case-là peut-elle s'obtenir dans ce jeu-là ?
 *
 * LE CHROMATIQUE EST UNE QUESTION SÉPARÉE DE LA PRÉSENCE, et c'est tout
 * l'intérêt du panneau : Ho-Oh est dans Or/Argent, son chromatique n'y est pas
 * chassable. Une vue qui aurait répondu « présent » aux deux aurait envoyé
 * chasser dans un jeu où la chasse est impossible.
 *
 * @param {object} k    une case rendue par `casesDe()`
 * @param {object} jeu  un jeu de data/reference/games.json
 */
function obtenableDans(k, jeu) {
  const code = jeu.code;
  if (k.sujet === "forme" && k.forme) {
    if (!k.forme.games.has(code)) return false;
    if (!k.chromatique) return true;
    // Le verrou de la forme a déjà absorbé celui de l'espèce — `mergeForm` le
    // recopie. `shinyOk === false` est la Génération I, où aucun chromatique
    // n'existe : la vérifier ici évite de promettre un Zarbi shiny en Rouge.
    return jeu.shinyOk !== false && !k.forme.shinyLocked.has(code);
  }
  // UNE VARIANTE COSMÉTIQUE A SES PROPRES JEUX, et pas toujours ceux de son
  // espèce. `core/data.js` les lui pose — elle suit l'espèce tant que
  // `data/details/cosmetic-forms.json` ne dit pas le contraire, ce qui reste le
  // cas de dix-sept groupes sur dix-huit : un motif de Prismillon existe bien
  // partout où Prismillon existe.
  //
  // Le dix-huitième est celui qui a motivé cette ligne. Les Pikachu à casquette
  // ne sont pas des formes — leurs quatorze entrées PokeAPI sont `hidden` — mais
  // des variantes cosmétiques, et ils héritaient donc des jeux de Pikachu,
  // c'est-à-dire de presque tous. Le panneau les proposait dans Écarlate/Violet,
  // où aucune distribution n'a jamais eu lieu : une case impossible, listée
  // comme à prendre, exactement ce qu'on veut éviter ici.
  if (k.sujet === "cosmetique" && k.variant) {
    if (!k.variant.games.has(code)) return false;
    // Le verrou chromatique, lui, reste celui de l'espèce : c'est le jeu qui
    // génère — ou non — un chromatique, pas le motif.
    return k.chromatique ? canShinyIn(k.espece, jeu) : true;
  }

  if (!k.espece.games.has(code)) return false;
  return k.chromatique ? canShinyIn(k.espece, jeu) : true;
}

/**
 * Comment on obtient cette espèce dans ce jeu-là.
 *
 * ═══ POURQUOI UNE CLÉ ET NON UN LIBELLÉ ═══
 *
 * La réponse est une RÈGLE DE JEU — elle se déduit de `wildGames`, de
 * `eventGames` et des champs écrits à la main dans `data/details/` —, donc elle
 * vit ici. Le MOT qui la dit est de l'affichage, et il vit dans `ui/reste.js`,
 * qui le passe par `t()`. Rendre « sauvage » depuis ce fichier aurait mis une
 * chaîne d'interface dans la couche métier, et obligé l'anglais à la retraduire
 * depuis le français au lieu de la produire.
 *
 * ═══ L'ORDRE EST CELUI DE L'EFFORT, DU MOINS CHER AU PLUS CHER ═══
 *
 * Une espèce coche souvent plusieurs cases à la fois : un Magicarpe est
 * sauvage ET issu d'une évolution qu'on peut faire, un Zarudé est un cadeau ET
 * un événement. Ce qu'on vient lire, c'est « qu'est-ce que je fais ce soir »,
 * donc la voie la plus courte gagne. Le sauvage passe premier parce qu'il
 * suffit d'y aller ; l'échange finit dernier parce qu'il demande quelqu'un
 * d'autre.
 *
 * `echange` est le défaut, et il est honnête : quand rien de ce qui précède ne
 * s'applique, l'espèce est bien dans ce jeu — `manquesDeLEspece` l'a déjà
 * vérifié — mais on ne sait pas mieux dire que « elle y arrive d'ailleurs ».
 */
export function methodeDobtention(espece, jeu) {
  const code = jeu.code;
  if (espece.wildGames && espece.wildGames.has(code)) return "sauvage";
  if (espece.eventGames && espece.eventGames.has(code)) return "evenement";
  if (espece.isGift) return "cadeau";
  if (espece.isStaticEncounter) return "fixe";
  if (espece.evolvesFrom) return "evolution";
  // `baby` sans pré-évolution : Pichu, Togépi, Melo… on ne les rencontre pas,
  // on les fait éclore. C'est la seule voie, et elle mérite son mot.
  if (espece.baby) return "reproduction";
  return "echange";
}

/**
 * La famille d'affichage d'une case. Le panneau range par là, et c'est le seul
 * regroupement qu'on lise vraiment : « il me manque le shiny » et « il me
 * manque trois formes » ne sont pas le même travail.
 */
function familleDe(k) {
  if (k.sujet === "forme") return k.forme && k.forme.kind === "gmax" ? "gmax" : "forme";
  if (k.sujet === "cosmetique") return "cosmetique";
  return "espece";
}

/**
 * Les cases qui manquent à une espèce, SANS regarder aucun jeu.
 *
 * ═══ POURQUOI CE DÉCOUPAGE, ET PAS UN CALCUL PAR JEU ═══
 *
 * « Quelles cases manquent » ne dépend que de la collection ; « lesquelles ce
 * jeu peut donner » dépend du jeu. Les calculer ensemble revenait à refaire le
 * premier vingt-trois fois — une fois par jeu —, soit 23 575 parcours de
 * `casesDe()` à chaque ouverture du panneau, alors que 1025 suffisent. Sur
 * Charmilly et ses 128 cases, la différence se voyait.
 *
 * On rend donc la liste une fois, et chaque jeu se contente de la FILTRER.
 */
export function casesManquantes(espece, collection) {
  const libelles = libellesDe(espece);
  const manques = [];
  for (const k of casesDe(espece)) {
    if (collection.has(espece.id, k.slot)) continue;
    manques.push({
      slot: k.slot,
      label: libelles.get(k.slot) || k.slot,
      chromatique: Boolean(k.chromatique),
      famille: familleDe(k),
      forme: k.forme || null,
      variant: k.variant || null,
      genre: k.genre || null,
      // La case telle que `casesDe` la rend : `obtenableDans` en a besoin, et
      // la garder évite de reconstruire un objet équivalent par jeu.
      k,
    });
  }
  return manques;
}

/**
 * L'index des manques, prêt à être croisé avec n'importe quel jeu.
 *
 * Les espèces complètes n'y entrent pas : elles ne peuvent apparaître dans
 * aucun jeu, et les porter aurait fait tester vingt-trois fois une liste vide.
 */
export function indexerManques(especes, collection) {
  const index = [];
  for (const espece of especes) {
    const manques = casesManquantes(espece, collection);
    if (manques.length) index.push({ espece, manques });
  }
  return index;
}

/**
 * Ce qui manque à UNE espèce dans UN jeu.
 *
 * Rend `null` quand ce jeu ne peut rien apporter pour elle — soit qu'elle y
 * soit absente, soit qu'elle y soit complète, soit qu'aucune de ses cases
 * manquantes ne s'y obtienne. Un `null` se filtre ; une entrée à zéro se serait
 * affichée.
 *
 * @param {Array} [manques]  l'entrée d'index déjà calculée. Omise, on la calcule
 *   — l'appel isolé reste licite, il coûte seulement ce qu'il coûtait.
 */
export function manquesDeLEspece(espece, collection, jeu, manques = null) {
  if (!espece.games.has(jeu.code)) return null;

  const tous = manques || casesManquantes(espece, collection);
  const ici = [];
  let ailleurs = 0;

  for (const m of tous) {
    if (obtenableDans(m.k, jeu)) ici.push(m);
    else ailleurs += 1;
  }

  if (!ici.length) return null;

  return {
    espece,
    manques: ici,
    /** Cases manquantes que ce jeu ne peut PAS donner. Comptées, jamais tues. */
    ailleurs,
    /** On la croise dehors : une soirée suffit, contre vingt échanges. */
    sauvage: Boolean(espece.wildGames && espece.wildGames.has(jeu.code)),
    /** Comment on l'obtient ici — voir `methodeDobtention`. */
    methode: methodeDobtention(espece, jeu),
    /** Le chromatique de l'espèce est-il chassable ici ? Sert au libellé. */
    shinyIci: canShinyIn(espece, jeu),
  };
}

/** Additionne un lot d'espèces. Le panneau affiche ces cinq nombres. */
function totaux(entrees) {
  const somme = {
    especes: entrees.length,
    cases: 0,
    normal: 0,
    chromatique: 0,
    formes: 0,
    cosmetiques: 0,
    sauvage: 0,
  };
  for (const entree of entrees) {
    somme.cases += entree.manques.length;
    if (entree.sauvage) somme.sauvage += 1;
    for (const m of entree.manques) {
      if (m.chromatique) somme.chromatique += 1;
      else somme.normal += 1;
      if (m.famille === "forme" || m.famille === "gmax") somme.formes += 1;
      else if (m.famille === "cosmetique") somme.cosmetiques += 1;
    }
  }
  return somme;
}

/**
 * Ce qu'un jeu apporterait, découpé entre sa cartouche et ses DLC.
 *
 * @param {Array}  index       l'index rendu par `indexerManques()`
 * @param {object} collection  pour savoir ce qui est déjà coché
 * @param {object} jeu         un jeu de data/reference/games.json
 * @param {Array} [dlcs]       `dataset.dlc`. Omis, tout tombe dans le groupe de
 *   base et le panneau se comporte comme avant l'arrivée des DLC — c'est le
 *   repli du jour où data/reference/dlc.json manquerait.
 */
export function manquesDuJeu(index, collection, jeu, dlcs = []) {
  // Un groupe par DLC, plus celui de la cartouche, TOUJOURS dans l'ordre du
  // fichier de référence : les deux DLC d'Épée/Bouclier doivent se présenter
  // dans le même ordre d'un jeu à l'autre.
  const base = { dlc: null, entrees: [] };
  const groupes = new Map();
  for (const dlc of dlcs) {
    if (dlc.game === jeu.code) groupes.set(dlc.code, { dlc, entrees: [] });
  }

  for (const { espece, manques } of index) {
    const entree = manquesDeLEspece(espece, collection, jeu, manques);
    if (!entree) continue;
    // `dlcRequis` répond « quels DLC faut-il acheter pour l'avoir ici » : vide
    // dans l'immense majorité des cas, et c'est alors la cartouche. La même
    // fonction que la fiche, donc les deux vues ne peuvent pas diverger.
    const requis = dlcRequis(espece, jeu.code, dlcs);
    if (!requis.length) {
      base.entrees.push(entree);
      continue;
    }
    // Drakkarmin relève de DEUX DLC du même jeu : il apparaît sous les deux,
    // parce que l'un OU l'autre suffit à l'obtenir. Le compter une seule fois
    // aurait fait mentir celui sous lequel on ne l'aurait pas rangé.
    for (const dlc of requis) {
      const groupe = groupes.get(dlc.code);
      if (groupe) groupe.entrees.push(entree);
    }
  }

  const ranger = (groupe) => ({ ...groupe, totaux: totaux(groupe.entrees) });
  const tous = [base, ...groupes.values()].map(ranger).filter((g) => g.entrees.length);

  return {
    jeu,
    groupes: tous,
    // Le total du JEU ne réadditionne pas les groupes : Drakkarmin compte dans
    // deux d'entre eux, la somme l'aurait donc compté deux fois. On repart des
    // espèces distinctes.
    totaux: totaux([...new Map(tous.flatMap((g) => g.entrees.map((e) => [e.espece.id, e]))).values()]),
  };
}

/**
 * Les jeux, classés par ce qu'ils rapporteraient.
 *
 * TRIÉS SUR LE SAUVAGE D'ABORD, puis sur les cases. C'est le seul ordre qui
 * corresponde à la question posée : entre deux jeux qui bouchent le même nombre
 * de trous, celui où on les attrape soi-même vaut mieux que celui qui demande
 * vingt échanges.
 *
 * Les jeux qui n'apportent rien restent dans la liste, en bas : les retirer
 * aurait laissé croire à un oubli de données. Un zéro est une réponse.
 */
export function classementDesJeux(especes, collection, jeux, dlcs = []) {
  // L'index une fois pour toutes, puis vingt-trois filtrages. Voir
  // `indexerManques` : le calculer par jeu coûtait vingt-trois fois ce prix.
  const index = indexerManques(especes, collection);
  return jeux
    .map((jeu) => manquesDuJeu(index, collection, jeu, dlcs))
    .sort(
      (a, b) =>
        b.totaux.sauvage - a.totaux.sauvage ||
        b.totaux.cases - a.totaux.cases ||
        b.totaux.especes - a.totaux.especes
    );
}
