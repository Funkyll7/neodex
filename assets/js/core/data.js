/**
 * data.js — chargement et assemblage des jeux de donnees.
 *
 * Cinq couches, dans cet ordre de priorite croissante :
 *   1. data/pokemon/gen-N.json       genere depuis PokeAPI  (tools/build_dataset.py)
 *   2. data/forms/gen-N.json         genere : les 300+ formes alternatives
 *                                    (tools/build_forms.py)
 *   3. data/availability/gen-N.json  genere : ou chaque espece s'obtient
 *                                    (tools/build_availability.py)
 *   4. data/details/*.json           enrichissements ecrits a la main
 *   5. data/reference/*.json         tables de reference (types, jeux, chasse,
 *                                    verrouillage chromatique)
 *
 * Le resultat est un tableau `species` fige, trie par numero national, dont
 * chaque entree porte son tableau `forms` deja resolu.
 */

const BASE = new URL("../../../data/", import.meta.url);

async function loadJson(path) {
  const url = new URL(path, BASE);
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Impossible de charger ${path} (HTTP ${response.status})`);
  }
  return response.json();
}

/** Charge un fichier facultatif : son absence n'est pas une erreur. */
function loadOptional(path, fallback) {
  return loadJson(path).catch(() => fallback);
}

export async function loadDataset() {
  const [manifest, typesRef, gensRef, gamesRef, huntRef, locksRef, formDetails] = await Promise.all([
    loadJson("pokemon/manifest.json"),
    loadJson("reference/types.json"),
    loadJson("reference/generations.json"),
    loadJson("reference/games.json"),
    loadJson("reference/hunt.json"),
    loadOptional("reference/shiny-locks.json", { always: {}, byGame: {}, forms: {} }),
    loadOptional("details/forms.json", { defaults: {}, bySince: {}, forms: {} }),
  ]);

  const gens = manifest.generations.map((g) => g.gen);

  const [baseChunks, detailChunks, availChunks, formChunks, collection] = await Promise.all([
    Promise.all(gens.map((g) => loadJson(`pokemon/gen-${g}.json`))),
    Promise.all(gens.map((g) => loadOptional(`details/gen-${g}.json`, {}))),
    Promise.all(gens.map((g) => loadOptional(`availability/gen-${g}.json`, {}))),
    Promise.all(gens.map((g) => loadOptional(`forms/gen-${g}.json`, {}))),
    loadOptional("collection.json", { marks: {} }),
  ]);

  const details = Object.assign({}, ...detailChunks);
  const availability = Object.assign({}, ...availChunks);
  const formsBySpecies = Object.assign({}, ...formChunks);

  const games = gamesRef.games;
  const allCodes = games.map((g) => g.code);
  const context = {
    games,
    allCodes,
    /** identifiant de version group PokeAPI -> code de jeu du site. */
    gameOfVersionGroup: versionGroupIndex(games),
    locks: locksRef,
    lockedByGame: lockIndex(locksRef, allCodes),
    formDetails,
  };

  const species = baseChunks
    .flat()
    .map((entry) =>
      merge(entry, details[String(entry.id)], availability[String(entry.id)], formsBySpecies[String(entry.id)], context)
    )
    .sort((a, b) => a.id - b.id);

  const byId = new Map(species.map((p) => [p.id, p]));
  const byName = new Map(species.map((p) => [p.name.toLowerCase(), p]));

  return {
    manifest,
    species,
    byId,
    byName,
    types: typesRef.types,
    generations: gensRef.generations,
    games,
    gamesByCode: new Map(games.map((g) => [g.code, g])),
    hunt: huntRef,
    locks: locksRef,
    statLabels: manifest.statLabels,
    baseCollection: collection,
    /** Toutes les formes, a plat — pratique pour les compteurs. */
    forms: species.flatMap((p) => p.forms),
  };
}

/* ------------------------------ index prealables ------------------------- */

function versionGroupIndex(games) {
  const index = new Map();
  for (const game of games) {
    for (const vg of game.vg || []) index.set(vg, game.code);
  }
  return index;
}

/**
 * Inverse la table de verrouillage : numero national -> Set de jeux ou le
 * chromatique est impossible. `always` s'applique a tous les jeux d'un coup.
 */
function lockIndex(locks, allCodes) {
  const index = new Map();
  const add = (id, codes) => {
    const set = index.get(id) || new Set();
    for (const code of codes) set.add(code);
    index.set(id, set);
  };
  for (const id of (locks.always && locks.always.species) || []) add(id, allCodes);
  for (const [code, entry] of Object.entries(locks.byGame || {})) {
    for (const id of (entry && entry.species) || []) add(id, [code]);
  }
  return index;
}

/* --------------------------------- fusion -------------------------------- */

/**
 * Fusionne une espece generee avec sa disponibilite, ses details manuels et
 * ses formes. Les champs `gm` / `ev` / `nsh` passent de chaines ("rb y frlg")
 * a des Set.
 */
function merge(entry, detail = {}, avail = {}, rawForms = [], context) {
  // Presence = socle genere + ajouts manuels, moins les retraits manuels.
  const gm = codeSet(avail.gm);
  for (const code of codeSet(detail.gm)) gm.add(code);
  const ev = codeSet(avail.ev);
  for (const code of codeSet(detail.ev)) ev.add(code);
  // Un Pokemon obtenu en evenement compte comme present dans le jeu.
  for (const code of ev) gm.add(code);
  for (const code of codeSet(detail.nogm)) {
    gm.delete(code);
    ev.delete(code);
  }

  const shinyLocked = new Set(context.lockedByGame.get(entry.id) || []);
  for (const code of codeSet(detail.nsh)) shinyLocked.add(code);

  const species = {
    ...entry,
    where: detail.where || "",
    note: detail.note || "",
    habitat: detail.hab || "",
    isGift: Boolean(detail.gift),
    isStaticEncounter: Boolean(detail.stat),
    isWild: Boolean(detail.wild),
    /** Jeux ou l'espece se croise vraiment dehors (PokeAPI encounters.csv). */
    wildGames: wildSet(avail.wild, detail, gm),
    games: gm,
    eventGames: ev,
    shinyLocked,
    /** true des que l'on sait ou l'obtenir — c'est le cas des 1025 desormais. */
    curated: gm.size > 0 || Boolean(detail.where),
    /** true quand un humain a relu la fiche (texte d'emplacement ecrit). */
    documented: Boolean(detail.where || detail.note),
  };

  const forms = (rawForms || []).map((form) => mergeForm(form, species, context));
  // La premiere forme collectionnable garde les anciennes cases `vo` / `vs` :
  // les collections deja exportees restent lisibles telles quelles.
  const primary = forms.findIndex((f) => f.collectible);
  if (primary >= 0) forms[primary] = Object.freeze({ ...forms[primary], slot: "vo", shinySlot: "vs" });

  species.forms = forms;
  /** Forme principale : la premiere que l'on peut reellement collectionner. */
  species.primaryForm = primary >= 0 ? forms[primary] : null;
  return Object.freeze(species);
}

/** Categories qui ne sont qu'une transformation de combat : rien a cocher. */
const NOT_COLLECTIBLE = new Set(["mega", "primal", "battle"]);

function mergeForm(form, species, context) {
  const { formDetails, gameOfVersionGroup } = context;
  const detail = (formDetails.forms || {})[form.key] || {};
  const bySince = (formDetails.bySince || {})[form.since] || {};
  const byKind = (formDetails.defaults || {})[form.kind] || {};
  // Precedence : entree individuelle > correction par jeu d'origine > categorie.
  const rule = { ...byKind, ...bySince, ...detail };

  let games;
  if (rule.gm !== undefined || rule.ev !== undefined) {
    games = codeSet(rule.gm);
    for (const code of codeSet(rule.ev)) games.add(code);
  } else if (rule.follow === "species") {
    games = sinceOnwards(species.games, form.since, context);
  } else {
    games = new Set();
  }
  for (const code of codeSet(rule.nogm)) games.delete(code);

  const eventGames = codeSet(rule.ev);
  const shiny = rule.shiny || "own";
  const rawLock = (context.locks.forms || {})[form.key];
  const shinyLocked =
    shiny === "none" || rawLock === "*" ? new Set(context.allCodes) : codeSet(rawLock);
  for (const code of codeSet(rule.nsh)) shinyLocked.add(code);
  // Un chromatique de forme suit toujours celui de l'espece : ce qui est
  // verrouille pour l'espece l'est aussi pour la forme.
  for (const code of species.shinyLocked) shinyLocked.add(code);

  return Object.freeze({
    ...form,
    games,
    eventGames,
    shinyLocked,
    shiny,
    where: rule.where || "",
    note: rule.note || "",
    collectible: !NOT_COLLECTIBLE.has(form.kind) && shiny !== "none",
    /** Cases de collection propres a cette forme. */
    slot: `f${form.id}`,
    shinySlot: `f${form.id}s`,
    /** Un sprite chromatique existe-t-il seulement ? */
    hasShinySprite: Boolean(form.sprites && (form.sprites.homeShiny || form.sprites.artShiny)),
  });
}

/**
 * Jeux de l'espece a partir de celui qui a introduit la forme.
 * Sert aux formes sans regle explicite : un Motisma Chaleur existe partout ou
 * Motisma existe, mais pas avant Platine.
 */
function sinceOnwards(speciesGames, since, context) {
  const first = context.gameOfVersionGroup.get(since);
  const order = context.allCodes;
  const start = first ? order.indexOf(first) : 0;
  if (start < 0) return new Set(speciesGames);
  return new Set(order.filter((code, index) => index >= start && speciesGames.has(code)));
}

/**
 * Jeux ou l'espece se rencontre a l'etat sauvage.
 * `wild: 1` dans les details force « rencontrable partout ou elle est
 * presente » — utile pour les quelques cas que PokeAPI classe en don alors
 * qu'on peut aussi les croiser (Magicarpe, Évoli...).
 */
function wildSet(generated, detail, presentIn) {
  if (detail && detail.wild) return new Set(presentIn);
  const set = codeSet(generated);
  for (const code of codeSet(detail && detail.nowild)) set.delete(code);
  return set;
}

function codeSet(value) {
  return new Set(String(value || "").split(" ").filter(Boolean));
}
