/**
 * livingdex.js — le Pokédex rangé comme on le range vraiment.
 *
 * POURQUOI DEUX VUES DE PLUS, ALORS QUE LA GRILLE MONTRE DÉJÀ TOUT.
 *
 * La grille est une liste : elle répond à « où est Machin » et à « qu'est-ce qui
 * correspond à ce filtre ». Elle répond mal à la seule question qu'on se pose en
 * approchant de la fin — « où sont mes trous ». Sur mille vignettes de cent
 * cinquante pixels, un manque est un espace vide qu'il faut chercher.
 *
 * UNE PLACE POUR LE NORMAL, UNE POUR LE CHROMATIQUE, CÔTE À CÔTE. C'est ainsi
 * qu'on range un living dex : le shiny ne remplace pas le normal, il se garde à
 * côté. Une seule case par espèce aurait forcé à choisir lequel des deux elle
 * représente, et rendu invisible la moitié du travail.
 *
 * TOUTES LES CASES COCHABLES, FORMES COMPRISES. Se limiter au normal et au
 * chromatique de base aurait montré mille cases quand la collection en compte
 * deux mille huit cents : le Miaouss d'Alola, le Motisma Lavage et les
 * vingt-huit Zarbi sont des cases comme les autres, et ils se rangent aussi.
 * Chaque case de la vue est donc une case de la collection — ni plus, ni
 * moins —, et cliquer dessus la coche.
 *
 * DEUX RANGEMENTS, ET DEUX FORMES DIFFÉRENTES.
 *
 *   BOÎTES    six colonnes sur cinq rangées, comme HOME. C'est le rangement
 *             qu'on aura sous les yeux dans le jeu, donc le seul qui permette
 *             de comparer boîte par boîte avec sa vraie collection.
 *   FAMILLES  une LIGNÉE PAR LIGNE, et pas des boîtes du tout. Rangées en
 *             boîtes, les familles ne se voyaient pas : rien ne disait où l'une
 *             finissait et où l'autre commençait. Une ligne par lignée le dit
 *             sans un mot — c'est la disposition du Pokédex d'Ultra-Soleil.
 *
 * Ce module ne touche pas au DOM et ne connaît aucune image.
 */

/** Une boîte de HOME : six colonnes, cinq rangées. */
export const PAR_BOITE = 30;
/** Les colonnes d'une boîte. Six, et c'est pair — voir l'en-tête. */
export const COLONNES = 6;

/**
 * TOUTES les cases cochables d'une espèce, dans l'ordre où on les remplit.
 *
 * PAS SEULEMENT LE NORMAL ET LE CHROMATIQUE DE BASE. Un living dex range aussi
 * les formes : le Miaouss d'Alola, le Motisma Lavage, les vingt-huit Zarbi. Se
 * limiter à la base aurait montré mille cases quand la collection en compte
 * deux mille huit cents — un Pokédex à moitié affiché.
 *
 * L'ORDRE FAIT LES PAIRES TOUT SEUL. `base normal, base shiny`, puis pour
 * chaque forme `normal, shiny` : les deux teintes d'un même Pokémon sont donc
 * toujours voisines, sans qu'on ait à les grouper à la main.
 *
 * `sujet` dit quelle image dessiner — l'espèce, une variante cosmétique ou une
 * forme —, et c'est la seule chose que `requiredSlots` ne donne pas. On refait
 * donc ici le même parcours que `domain/completion.js`, pour cette raison-là et
 * pas une autre.
 */
export function casesDe(espece) {
  const cases = [];
  const pousser = (slot, chromatique, sujet, extra, genre) =>
    cases.push({ espece, slot, chromatique, sujet, genre: genre || null, ...extra });

  const cos = espece.cosmetic;
  // LE SEXE PASSE AVANT LA TEINTE. `requiredSlots` range ♂ normal, ♀ normal,
  // ♂ shiny, ♀ shiny — l'ordre dans lequel on remplit une fiche. Ici on range
  // en PAIRES, et la paire est « ce Pokémon-là, ses deux teintes » : un
  // Florizarre mâle et son chromatique côte à côte, puis la femelle et le sien.
  // Suivre l'autre ordre aurait mis chaque normal à côté d'un normal.
  pousser("om", false, "espece", {}, espece.gd ? "m" : null);
  if (!espece.noShiny) pousser("sm", true, "espece", {}, espece.gd ? "m" : null);
  if (espece.gd) {
    pousser("of", false, "espece", {}, "f");
    if (!espece.noShiny) pousser("sf", true, "espece", {}, "f");
  }

  if (cos && !cos.info) {
    for (const variant of cos.variants) {
      if (variant.isBase || !variant.entry) continue;
      pousser(variant.slot, false, "cosmetique", { variant });
      if (variant.shinyEntry) pousser(variant.shinySlot, true, "cosmetique", { variant });
    }
  }

  for (const forme of espece.forms) {
    if (!forme.entry) continue;
    // Même règle que pour la base : le sexe avant la teinte, pour que la paire
    // reste « un Pokémon, ses deux teintes ».
    pousser(forme.slot, false, "forme", { forme }, forme.gendered ? "m" : null);
    if (forme.shinyEntry) pousser(forme.shinySlot, true, "forme", { forme }, forme.gendered ? "m" : null);
    if (forme.gendered) {
      pousser(forme.slotF, false, "forme", { forme }, "f");
      if (forme.shinyEntry) pousser(forme.shinySlotF, true, "forme", { forme }, "f");
    }
  }

  return cases;
}

/**
 * Le rangement de HOME : le Pokédex national, trente cases par boîte.
 *
 * Pas de regroupement par famille ici, et c'est voulu — cette vue existe pour
 * ressembler à HOME, où l'ordre est celui du Pokédex national et rien d'autre.
 */
export function rangerEnBoites(especes) {
  const cases = [...especes].sort((a, b) => a.id - b.id).flatMap(casesDe);
  const boites = [];
  for (let i = 0; i < cases.length; i += PAR_BOITE) {
    const lot = cases.slice(i, i + PAR_BOITE);
    while (lot.length < PAR_BOITE) lot.push(null);
    boites.push({ numero: boites.length + 1, cases: lot });
  }
  return boites;
}

/**
 * Une lignée par ligne, dans l'ordre du Pokédex national.
 *
 * Les espèces qu'aucune chaîne ne nomme — un jeu de données amputé, une
 * référence qui vieillit — forment chacune leur propre ligne. On préfère une
 * ligne d'un seul membre à une espèce qui disparaît de sa collection.
 *
 * CHAQUE MEMBRE PORTE SES PROPRES CASES. La ligne les portait seule, et la vue
 * les redistribuait en comparant `k.espece === espece` — un filtre par membre,
 * donc un parcours de toutes les cases de la lignée par membre. Surtout, ce
 * découpage ne savait pas se faire ailleurs : le Pokédex GO range plusieurs
 * boîtes sous une même espèce — Miaouss de Kanto, d'Alola et de Galar — et
 * comparer l'espèce les aurait fondues en un seul bloc de six cases sans nom.
 */
export function rangerEnFamilles(especes, chaines) {
  const parId = new Map(especes.map((e) => [e.id, e]));
  return lignerParFamille(
    [...parId.values()],
    chaines,
    (espece) => espece.id,
    (espece) => [{ espece, entree: null, cases: casesDe(espece) }]
  );
}

/* ===================================================================== */
/*                          LE MÊME, POUR GO                             */
/* ===================================================================== */

/**
 * Les cases cochables d'une entrée du Pokédex GO.
 *
 * DEUX CASES AU PLUS, ET SOUVENT UNE SEULE. Le Pokédex GO ne connaît ni les
 * sexes, ni les Méga, ni les Gigamax : une boîte y vaut « attrapé » et, quand
 * le jeu l'a sorti, « chromatique ». Recopier `casesDe` aurait fabriqué quatre
 * cases dont deux n'existent nulle part.
 *
 * UNE ENTRÉE PAS ENCORE SORTIE N'A AUCUNE CASE. Ce n'est pas un trou qu'on
 * pourrait combler, c'est un Pokémon que le jeu ne propose pas — le compter
 * comme manquant aurait fait porter aux boîtes une centaine de cases
 * impossibles, exactement le piège que les espèces sans chromatique tendent
 * dans l'autre Pokédex. La grille continue de les montrer, elle, parce que
 * savoir ce qui manque AU JEU fait partie de ce qu'on vient y chercher.
 */
export function casesDeGo(entree) {
  if (!entree.released) return [];
  const commun = {
    espece: entree.species,
    entree,
    // Le sujet dit quelle image dessiner, et les trois valeurs sont celles de
    // `casesDe` : la vue n'a donc rien à savoir du Pokédex dont vient la case.
    sujet: entree.form ? "forme" : entree.variant ? "cosmetique" : "espece",
    forme: entree.form || null,
    variant: entree.variant || null,
    // Pas de ♂ / ♀ dans GO : la pastille de sexe ne se pose jamais ici.
    genre: null,
  };
  const cases = [{ ...commun, slot: entree.slot, chromatique: false }];
  if (entree.shiny) cases.push({ ...commun, slot: entree.shinySlot, chromatique: true });
  return cases;
}

/**
 * Le rangement en boîtes du Pokédex GO.
 *
 * L'ordre est celui de la grille GO : le numéro national, et les formes d'une
 * espèce juste après elle. C'est celui dans lequel le jeu lui-même les range.
 */
export function rangerGoEnBoites(entrees) {
  const cases = entrees.flatMap(casesDeGo);
  const boites = [];
  for (let i = 0; i < cases.length; i += PAR_BOITE) {
    const lot = cases.slice(i, i + PAR_BOITE);
    while (lot.length < PAR_BOITE) lot.push(null);
    boites.push({ numero: boites.length + 1, cases: lot });
  }
  return boites;
}

/**
 * Les entrées GO, une lignée par ligne.
 *
 * UN MEMBRE PAR BOÎTE, PAS PAR ESPÈCE. Le Miaouss de Kanto, celui d'Alola et
 * celui de Galar sont trois boîtes du jeu ; les fondre sous un seul « Miaouss »
 * aurait affiché six cases sans dire laquelle appartient à quoi.
 */
export function rangerGoEnFamilles(entrees, chaines) {
  const parEspece = new Map();
  for (const entree of entrees) {
    if (!casesDeGo(entree).length) continue;
    const id = entree.species.id;
    if (!parEspece.has(id)) parEspece.set(id, []);
    parEspece.get(id).push(entree);
  }
  return lignerParFamille(
    [...parEspece.values()],
    chaines,
    (lot) => lot[0].species.id,
    (lot) => lot.map((entree) => ({ espece: entree.species, entree, cases: casesDeGo(entree) }))
  );
}

/**
 * Le squelette commun aux deux rangements par famille.
 *
 * Il ne connaît ni les espèces ni les entrées : `numero` lui dit à quel numéro
 * national rattacher un élément, `membrer` lui dit quoi en tirer. C'est tout ce
 * qui différait entre les deux versions, et les écrire deux fois aurait laissé
 * deux tris et deux gestions du reliquat à garder d'accord.
 */
function lignerParFamille(elements, chaines, numero, membrer) {
  const parId = new Map(elements.map((x) => [numero(x), x]));
  const placees = new Set();
  const lignes = [];

  const ligne = (elems) => {
    const membres = elems.flatMap(membrer);
    return { membres, cases: membres.flatMap((m) => m.cases) };
  };

  for (const chaine of chaines) {
    const elems = chaine.map((id) => parId.get(id)).filter(Boolean);
    if (!elems.length) continue;
    for (const e of elems) placees.add(numero(e));
    lignes.push(ligne(elems));
  }
  for (const [id, elem] of parId) {
    if (placees.has(id)) continue;
    lignes.push(ligne([elem]));
  }
  // Rangées par le premier numéro : la liste se parcourt comme le Pokédex.
  return lignes
    .filter((l) => l.membres.length)
    .sort((a, b) => a.membres[0].espece.id - b.membres[0].espece.id);
}

/**
 * Le compte d'un lot de cases.
 *
 * @param {Function} pris  (case) => bool
 */
export function compter(cases, pris) {
  let total = 0;
  let faites = 0;
  for (const c of cases) {
    if (!c) continue;
    total += 1;
    if (pris(c)) faites += 1;
  }
  return { total, faites, manquantes: total - faites };
}
