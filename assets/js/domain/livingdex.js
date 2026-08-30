/**
 * livingdex.js — le Pokédex rangé comme les boîtes de HOME.
 *
 * POURQUOI UNE VUE DE PLUS, ALORS QUE LA GRILLE MONTRE DÉJÀ TOUT.
 *
 * La grille est une liste : elle répond à « où est Machin » et à « qu'est-ce
 * qui correspond à ce filtre ». Elle répond mal à la seule question qu'on se
 * pose quand on approche de la fin — « où sont mes trous ». Sur mille vingt-cinq
 * vignettes de cent cinquante pixels, un manque est un espace vide qu'il faut
 * chercher en faisant défiler quatre mille pixels.
 *
 * Une boîte de HOME tient trente Pokémon sur un seul écran. Trente-cinq boîtes
 * couvrent le Pokédex national, et un trou s'y voit sans qu'on le cherche :
 * c'est une case grise au milieu de vingt-neuf autres. C'est la même donnée,
 * rangée de la façon dont on la range VRAIMENT dans le jeu.
 *
 * DEUX RANGEMENTS, ET ILS NE RÉPONDENT PAS À LA MÊME QUESTION.
 *
 *   « Par numéro »  reproduit HOME à l'identique — c'est le rangement qu'on
 *                   aura sous les yeux dans le jeu, donc celui qui permet de
 *                   comparer boîte par boîte avec sa vraie collection.
 *   « Par famille » range par lignée d'évolution. Un trou y devient
 *                   ACTIONNABLE : voir Herbizarre manquant entre Bulbizarre et
 *                   Florizarre dit quoi faire, là où le voir entre Papilusion
 *                   et Dardargnan ne dit rien.
 *
 * UNE LIGNÉE N'EST JAMAIS COUPÉE EN DEUX. C'est la règle qui fait tout
 * l'intérêt du second rangement : si la famille en cours ne tient pas dans la
 * place restante, la boîte est close et la famille commence la suivante. Les
 * cases perdues sont le prix — une trentaine sur mille — et elles sont laissées
 * VIDES plutôt que comblées, parce qu'une case vide se lit comme une fin de
 * boîte alors qu'un intrus se lirait comme un trou.
 *
 * Ce module ne touche pas au DOM et ne connaît aucune image.
 */

/** Une boîte de HOME : cinq colonnes, six rangées. */
export const PAR_BOITE = 30;

/**
 * Range les espèces en boîtes.
 *
 * @param {Array}  especes   la liste complète, dans n'importe quel ordre
 * @param {Object} options
 * @param {string} options.ordre     « numero » ou « famille »
 * @param {Array}  [options.chaines] les lignées, pour l'ordre « famille »
 * @returns {Array<{numero: number, cases: Array}>} les cases valent `null` quand
 *   la boîte a été close avant d'être pleine.
 */
export function rangerEnBoites(especes, { ordre = "numero", chaines = [] } = {}) {
  const parId = new Map(especes.map((e) => [e.id, e]));
  return ordre === "famille"
    ? parFamille(parId, chaines)
    : parNumero([...especes].sort((a, b) => a.id - b.id));
}

/** Le rangement de HOME : le Pokédex national, trente par trente. */
function parNumero(triees) {
  const boites = [];
  for (let i = 0; i < triees.length; i += PAR_BOITE) {
    boites.push({ numero: boites.length + 1, cases: triees.slice(i, i + PAR_BOITE) });
  }
  return boites;
}

/**
 * Le rangement par lignée, sans jamais couper une famille.
 *
 * Les espèces qu'aucune chaîne ne nomme — un jeu de données amputé, une
 * référence qui vieillit — sont ajoutées à la fin, chacune seule. On préfère
 * une boîte de rab à une espèce qui disparaît de sa propre collection.
 */
function parFamille(parId, chaines) {
  const placees = new Set();
  const groupes = [];

  for (const chaine of chaines) {
    const membres = chaine.map((id) => parId.get(id)).filter(Boolean);
    if (!membres.length) continue;
    groupes.push(membres);
    for (const m of membres) placees.add(m.id);
  }
  for (const espece of parId.values()) {
    if (!placees.has(espece.id)) groupes.push([espece]);
  }

  const boites = [];
  let courante = [];
  const clore = () => {
    if (!courante.length) return;
    // Complétée à trente avec des cases vides : c'est ce qui garde la grille
    // rectangulaire, et une case vide dit « fin de boîte » sans ambiguïté.
    while (courante.length < PAR_BOITE) courante.push(null);
    boites.push({ numero: boites.length + 1, cases: courante });
    courante = [];
  };

  for (const groupe of groupes) {
    // Une lignée plus longue qu'une boîte n'existe pas aujourd'hui — la plus
    // fournie est celle d'Évoli, neuf membres — mais la borne est écrite : sans
    // elle, une famille de trente et un aurait bouclé sans fin.
    if (groupe.length > PAR_BOITE) {
      clore();
      for (let i = 0; i < groupe.length; i += PAR_BOITE) {
        courante = groupe.slice(i, i + PAR_BOITE);
        clore();
      }
      continue;
    }
    if (courante.length + groupe.length > PAR_BOITE) clore();
    courante.push(...groupe);
  }
  clore();
  return boites;
}

/**
 * Le compte d'une boîte : combien de cases pleines, combien de terminées.
 *
 * DEUX NOMBRES ET NON UN, parce que « je l'ai » et « je l'ai fini » sont deux
 * états distincts dans ce Pokédex : une espèce peut être cochée en normal et
 * pas en chromatique. La boîte affiche le premier — c'est celui qui correspond
 * à HOME, où un Pokémon est là ou n'y est pas.
 *
 * @param {Function} possede   (espece) => bool
 * @param {Function} terminee  (espece) => bool
 */
export function compterBoite(boite, possede, terminee) {
  let cases = 0;
  let pleines = 0;
  let finies = 0;
  for (const espece of boite.cases) {
    if (!espece) continue;
    cases += 1;
    if (possede(espece)) pleines += 1;
    if (terminee(espece)) finies += 1;
  }
  return { cases, pleines, finies, manquantes: cases - pleines };
}
