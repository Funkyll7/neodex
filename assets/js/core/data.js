/**
 * data.js — chargement et assemblage des jeux de donnees.
 *
 * Trois couches, dans cet ordre de priorite croissante :
 *   1. data/pokemon/gen-N.json    genere depuis PokeAPI  (tools/build_dataset.py)
 *   2. data/details/gen-N.json    enrichissements ecrits a la main
 *   3. data/reference/*.json      tables de reference (types, jeux, chasse)
 *
 * Le resultat est un tableau `species` fige, trie par numero national.
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

export async function loadDataset() {
  const [manifest, typesRef, gensRef, gamesRef, huntRef] = await Promise.all([
    loadJson("pokemon/manifest.json"),
    loadJson("reference/types.json"),
    loadJson("reference/generations.json"),
    loadJson("reference/games.json"),
    loadJson("reference/hunt.json"),
  ]);

  const gens = manifest.generations.map((g) => g.gen);

  const [baseChunks, detailChunks, collection] = await Promise.all([
    Promise.all(gens.map((g) => loadJson(`pokemon/gen-${g}.json`))),
    Promise.all(gens.map((g) => loadJson(`details/gen-${g}.json`).catch(() => ({})))),
    loadJson("collection.json").catch(() => ({ marks: {} })),
  ]);

  const details = Object.assign({}, ...detailChunks);

  const species = baseChunks
    .flat()
    .map((entry) => merge(entry, details[String(entry.id)]))
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
    games: gamesRef.games,
    gamesByCode: new Map(gamesRef.games.map((g) => [g.code, g])),
    hunt: huntRef,
    statLabels: manifest.statLabels,
    baseCollection: collection,
  };
}

/**
 * Fusionne une espece generee avec son enrichissement manuel.
 * Les champs `gm` / `ev` / `nsh` passent de chaines ("rb y frlg") a des Set.
 */
function merge(entry, detail = {}) {
  const gm = codeSet(detail.gm);
  const ev = codeSet(detail.ev);
  // Un Pokemon obtenu en evenement compte comme present dans le jeu.
  for (const code of ev) gm.add(code);

  return Object.freeze({
    ...entry,
    where: detail.where || "",
    note: detail.note || "",
    habitat: detail.hab || "",
    isGift: Boolean(detail.gift),
    isStaticEncounter: Boolean(detail.stat),
    isWild: Boolean(detail.wild),
    variant: detail.variant || null,
    games: gm,
    eventGames: ev,
    shinyLocked: codeSet(detail.nsh),
    /** true des qu'on dispose d'un minimum d'infos ecrites a la main. */
    curated: Boolean(detail.where || detail.gm || detail.ev),
  });
}

function codeSet(value) {
  return new Set(String(value || "").split(" ").filter(Boolean));
}
