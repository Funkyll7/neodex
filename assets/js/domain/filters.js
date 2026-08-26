/**
 * filters.js — reduction de la liste des especes selon l'etat des filtres.
 * Une seule fonction pure, facile a tester et a etendre : pour ajouter un
 * critere, ajouter une clause ici et le controle correspondant dans ui/sidebar.js.
 */

export const STATUS_FILTERS = [
  { value: "all", label: "Tous", key: "total" },
  { value: "owned", label: "Capturés", key: "owned" },
  { value: "missing", label: "Manquants", key: "missing" },
  { value: "shiny", label: "✦ Shiny", key: "shiny" },
  { value: "pair", label: "♂♀ Paire complète", key: "pair" },
  { value: "complete", label: "★ Complets", key: "complete" },
  { value: "incomplete", label: "À terminer", key: "incomplete" },
];

/**
 * Filtre « Forme » : les familles de formes qu'on cherche vraiment a lister.
 *
 * Volontairement pas toutes les categories de `KIND_TITLES` : les Mega, les
 * formes de combat et les casquettes ne se cochent pas, en faire un filtre
 * donnerait une liste qu'on ne peut pas completer. Hisui accompagne Alola,
 * Galar et Paldea — les quatre regions vont ensemble.
 */
export const FORM_FILTERS = [
  { value: "all", label: "Toutes les formes" },
  { value: "alola", label: "Formes d'Alola" },
  { value: "galar", label: "Formes de Galar" },
  { value: "hisui", label: "Formes de Hisui" },
  { value: "paldea", label: "Formes de Paldéa" },
  { value: "gmax", label: "Formes Gigamax" },
  { value: "cosmetic", label: "Formes cosmétiques" },
];

export const SORTS = {
  num: (a, b) => a.id - b.id,
  name: (a, b) => a.name.localeCompare(b.name, "fr"),
  type: (a, b) => (a.types[0] || "").localeCompare(b.types[0] || "", "fr") || a.id - b.id,
  stats: (a, b) => total(b) - total(a) || a.id - b.id,
};

const total = (p) => p.stats.reduce((sum, n) => sum + n, 0);

export function applyFilters(species, state, collection, isComplete = () => false) {
  const query = state.search.trim().toLowerCase();
  const number = numberQuery(query);

  const list = species.filter((p) => {
    if (query && !matches(p, query, number)) return false;
    if (state.type !== "all" && !p.types.includes(state.type)) return false;
    if (state.gen !== "all" && String(p.gen) !== state.gen) return false;
    if (state.game !== "all" && !p.games.has(state.game)) return false;
    if (state.form !== "all" && !hasForm(p, state.form)) return false;

    switch (state.status) {
      case "owned":
        return collection.isOwned(p.id);
      case "missing":
        return !collection.isOwned(p.id);
      case "shiny":
        return collection.isShiny(p.id);
      case "pair":
        return collection.isCompletePair(p.id);
      case "complete":
        return isComplete(p);
      case "incomplete":
        return !isComplete(p);
      default:
        return true;
    }
  });

  list.sort(SORTS[state.sort] || SORTS.num);

  // Un numero tape en entier gagne la premiere place, quel que soit le tri :
  // qui tape « 0025 » cherche Pikachu, pas le premier de la liste par ordre
  // alphabetique.
  if (number !== null) {
    const exact = list.findIndex((p) => p.id === number);
    if (exact > 0) list.unshift(list.splice(exact, 1)[0]);
  }
  return list;
}

/**
 * Cette espece a-t-elle une forme de la famille demandee ?
 * `cosmetic` est a part : les Zarbi, Prismillon & co ne sont pas des formes au
 * sens de data/forms/, ils vivent dans leur propre groupe.
 */
function hasForm(species, kind) {
  if (kind === "cosmetic") return Boolean(species.cosmetic && !species.cosmetic.info);
  return species.forms.some((form) => form.kind === kind);
}

/**
 * « 0025 », « #25 », « 25 » -> 25. Tout le reste -> null.
 *
 * Les vignettes affichent le numero sur quatre chiffres (`#0025`) : c'est donc
 * ce qu'on recopie depuis une capture d'ecran. Sans normalisation, l'ancienne
 * recherche par sous-chaine repondait « Pêchaminus » a « 025 », parce que
 * « 1025 » contient « 025 » — un seul resultat, faux, et sans le moindre
 * signe que quelque chose clochait.
 */
function numberQuery(query) {
  const match = /^#?0*(\d{1,4})$/.exec(query);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return value > 0 ? value : null;
}

/**
 * Une requete purement numerique ne compare que des numeros : le numero exact,
 * ou un debut de numero (« 25 » sort 25 puis 250 a 259). Jamais une
 * sous-chaine — c'est ce qui faisait remonter 1025 pour « 025 ».
 * Tout le reste cherche dans `species.search`, construit par core/data.js :
 * nom francais et anglais, categorie, noms de formes et de cosmetiques.
 */
function matches(p, query, number) {
  if (number !== null) {
    const id = String(p.id);
    return p.id === number || id.startsWith(String(number));
  }
  return p.search.includes(query);
}
