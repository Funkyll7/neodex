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
 */
export function rangerEnFamilles(especes, chaines) {
  const parId = new Map(especes.map((e) => [e.id, e]));
  const placees = new Set();
  const lignes = [];

  for (const chaine of chaines) {
    const membres = chaine.map((id) => parId.get(id)).filter(Boolean);
    if (!membres.length) continue;
    for (const m of membres) placees.add(m.id);
    lignes.push({ membres, cases: membres.flatMap(casesDe) });
  }
  for (const espece of parId.values()) {
    if (placees.has(espece.id)) continue;
    lignes.push({ membres: [espece], cases: casesDe(espece) });
  }
  // Rangées par le premier numéro : la liste se parcourt comme le Pokédex.
  return lignes.sort((a, b) => a.membres[0].id - b.membres[0].id);
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
