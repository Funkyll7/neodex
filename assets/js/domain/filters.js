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

export const SORTS = {
  num: (a, b) => a.id - b.id,
  name: (a, b) => a.name.localeCompare(b.name, "fr"),
  type: (a, b) => (a.types[0] || "").localeCompare(b.types[0] || "", "fr") || a.id - b.id,
  stats: (a, b) => total(b) - total(a) || a.id - b.id,
};

const total = (p) => p.stats.reduce((sum, n) => sum + n, 0);

export function applyFilters(species, state, collection, isComplete = () => false) {
  const query = state.search.trim().toLowerCase();

  const list = species.filter((p) => {
    if (query && !matches(p, query)) return false;
    if (state.type !== "all" && !p.types.includes(state.type)) return false;
    if (state.gen !== "all" && String(p.gen) !== state.gen) return false;
    if (state.game !== "all" && !p.games.has(state.game)) return false;

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

  return list.sort(SORTS[state.sort] || SORTS.num);
}

function matches(p, query) {
  return (
    p.name.toLowerCase().includes(query) ||
    p.en.toLowerCase().includes(query) ||
    String(p.id).includes(query)
  );
}
