/**
 * filters.js — reduction de la liste des especes selon l'etat des filtres.
 * Une seule fonction pure, facile a tester et a etendre : pour ajouter un
 * critere, ajouter une clause ici et le controle correspondant dans ui/sidebar.js.
 */

import { completionOf } from "./completion.js";
// Une fonction pure, sans DOM : l'index de recherche est plié sans accents par
// `core/data.js`, la requête doit l'être exactement de la même manière. Les
// écrire à deux endroits les aurait laissés diverger un jour.
import { sansAccents } from "../core/data.js";

/**
 * Les pastilles de statut.
 *
 * `shiny` et `pair` n'y figurent plus : les barres « Chromatiques » et
 * « Paires ♂ / ♀ » de la barre laterale font deja exactement ce filtrage, et
 * en donnant le compte en prime. Deux chemins pour le meme resultat, a dix
 * centimetres l'un de l'autre, n'aidaient personne.
 *
 * Les valeurs, elles, restent gerees par `applyFilters` : ce sont ces barres
 * qui les posent.
 */
export const STATUS_FILTERS = [
  { value: "all", label: "Tous", key: "total" },
  { value: "owned", label: "Capturés", key: "owned" },
  { value: "missing", label: "Manquants", key: "missing" },
  { value: "complete", label: "★ Complets", key: "complete" },
  { value: "incomplete", label: "À terminer", key: "incomplete" },
];

/**
 * Les deux statuts qui n'ont pas de pastille, mais qui ont un nom.
 *
 * `shiny` et `pair` sont poses par les barres de la colonne, et par elles
 * seules — d'ou leur absence de `STATUS_FILTERS`. Mais la pastille de filtre
 * actif cherchait leur libelle dans cette liste, ne le trouvait pas, et
 * affichait la cle telle quelle : cliquer « Chromatiques » donnait une pastille
 * intitulee « shiny ».
 *
 * Ici et non dans `ui/` : c'est le meme fichier qui explique, dix lignes plus
 * haut, pourquoi ces deux valeurs existent sans pastille. Les separer aurait
 * garanti qu'un jour l'une bouge sans l'autre.
 */
export const LIBELLES_STATUT = {
  shiny: "Chromatiques",
  pair: "Paires ♂ / ♀",
};

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
  { value: "other", label: "Autres formes" },
  { value: "gmax", label: "Formes Gigamax" },
  { value: "cosmetic", label: "Formes cosmétiques" },
];

/**
 * Le livingdex Pokemon GO n'a que trois angles, et c'est voulu.
 *
 * GO ne connait ni forme regionale, ni Gigamax, ni case ♂ / ♀ : une espece y
 * vaut deux cases, le normal et le chromatique. Lui recopier les huit filtres
 * du Pokedex HOME aurait donne sept listes vides.
 */
export const GO_FILTERS = [
  { value: "all", label: "Tous" },
  { value: "missing", label: "À attraper" },
  { value: "noshiny", label: "Sans shiny" },
  { value: "absent", label: "Pas dans GO" },
];

/**
 * Meme grammaire de recherche que le Pokedex HOME — numero exact ou debut de
 * numero, sinon `species.search` — mais sur les BOITES de GO : les especes et
 * les 55 formes regionales que le jeu propose.
 *
 * L'ordre de `dataset.goEntries` est deja celui des boites — chaque espece
 * suivie de ses formes — et on n'y touche pas : un livingdex se range comme le
 * jeu le range, pas par ordre alphabetique.
 */
export function applyGoFilters(entries, state, collection) {
  const query = (state.goSearch || "").trim().toLowerCase();
  const number = numberQuery(query);

  const list = entries.filter((e) => {
    const p = e.species;
    if (query && !matches(p, query, number)) return false;
    if (state.goType !== "all" && !p.types.includes(state.goType)) return false;
    if (state.goGen !== "all" && String(p.gen) !== state.goGen) return false;
    switch (state.goStatus) {
      // « A attraper » ne propose que ce qui EST attrapable : les 73 especes
      // absentes du jeu y seraient restees pour toujours.
      case "missing":
        return e.released && !collection.has(e.id, e.slot);
      case "noshiny":
        // Meme raison : une boite dont GO n'a pas encore sorti le chromatique
        // n'a rien a faire dans une liste de choses a faire.
        return e.shiny && !collection.has(e.id, e.shinySlot);
      // Les 73 absentes, sur demande. Elles gardent un filtre a elles plutot
      // que de disparaitre : savoir ce qui manque au jeu fait partie de ce
      // qu'on vient chercher ici.
      case "absent":
        return !e.released;
      // « Tous », c'est tous les OBTENABLES. Y compter les 73 absentes
      // affichait « 1025 » a cote de « 952 attrapés » : le chiffre meme qu'on
      // venait de corriger partout ailleurs.
      default:
        return e.released;
    }
  });

  // Un numero tape en entier remonte sa boite de base en tete, comme dans
  // l'autre Pokedex.
  if (number !== null) {
    const exact = list.findIndex((e) => e.id === number && !e.form);
    if (exact > 0) list.unshift(list.splice(exact, 1)[0]);
  }
  return list;
}

export const SORTS = {
  num: (a, b) => a.id - b.id,
  name: (a, b) => a.name.localeCompare(b.name, "fr"),
  type: (a, b) => (a.types[0] || "").localeCompare(b.types[0] || "", "fr") || a.id - b.id,
  stats: (a, b) => total(b) - total(a) || a.id - b.id,
};

const total = (p) => p.stats.reduce((sum, n) => sum + n, 0);

/**
 * « Presque complets » — le seul tri qui a besoin de la collection.
 *
 * `SORTS` ne compare que deux especes, et c'est ce qui le garde lisible :
 * celui-ci doit savoir combien de cases sont deja cochees. On le fabrique donc
 * a la demande, avec la collection en argument.
 *
 * Pourquoi ce tri : en fin de session on cherche les Pokemon a qui il ne manque
 * qu'une case. Les terminer coute un appui chacun et fait monter le compteur
 * « ★ Complets » — alors qu'un Charmilly en a 126 devant lui. Les especes deja
 * terminees passent en queue : elles n'ont plus rien a offrir a ce tri.
 *
 * Le cache n'est pas une optimisation de confort : un tri appelle son
 * comparateur des milliers de fois, et `completionOf` reconstruit a chaque
 * appel la liste complete des cases exigees.
 */
function almostSort(collection) {
  const cache = new Map();
  const reste = (p) => {
    if (!cache.has(p.id)) {
      const { complete, total: t, done } = completionOf(p, collection);
      cache.set(p.id, complete ? Number.MAX_SAFE_INTEGER : t - done);
    }
    return cache.get(p.id);
  };
  return (a, b) => reste(a) - reste(b) || a.id - b.id;
}

export function applyFilters(species, state, collection, isComplete = () => false) {
  const query = sansAccents(state.search.trim().toLowerCase());
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

  list.sort(state.sort === "almost" ? almostSort(collection) : SORTS[state.sort] || SORTS.num);

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
