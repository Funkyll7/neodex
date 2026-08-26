/**
 * data.js — chargement et assemblage des jeux de donnees.
 *
 * Cinq couches, dans cet ordre de priorite croissante :
 *   1. data/pokemon/gen-N.json       genere depuis PokeAPI  (tools/build_dataset.py)
 *   2. data/forms/gen-N.json         genere : les 300+ formes alternatives
 *                                    (tools/build_forms.py)
 *   3. data/availability/gen-N.json  genere : ou chaque espece s'obtient
 *                                    (tools/build_availability.py)
 *   4. data/details/*.json           enrichissements ecrits a la main, dont
 *                                    cosmetic-forms.json (Zarbi, Prismillon,
 *                                    Charmilly… que PokeAPI n'expose pas comme
 *                                    des entrees /pokemon distinctes)
 *   5. data/reference/*.json         tables de reference (types, jeux, chasse,
 *                                    verrouillage chromatique)
 *
 * Le resultat est un tableau `species` fige, trie par numero national, dont
 * chaque entree porte son tableau `forms` deja resolu et, le cas echeant, son
 * groupe `cosmetic`.
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
  const [manifest, typesRef, gensRef, gamesRef, huntRef, locksRef, formDetails, cosmeticRef] =
    await Promise.all([
      loadJson("pokemon/manifest.json"),
      loadJson("reference/types.json"),
      loadJson("reference/generations.json"),
      loadJson("reference/games.json"),
      loadJson("reference/hunt.json"),
      loadOptional("reference/shiny-locks.json", { always: {}, noShiny: {}, byGame: {}, forms: {} }),
      loadOptional("details/forms.json", { defaults: {}, bySince: {}, forms: {} }),
      loadOptional("details/cosmetic-forms.json", { groups: {} }),
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
    /** Especes dont le chromatique n'existe nulle part : aucun bouton Shiny. */
    noShiny: new Set((locksRef.noShiny && locksRef.noShiny.species) || []),
    formDetails,
    cosmeticGroups: cosmeticRef.groups || {},
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
    /**
     * Le chromatique de cette espece n'existe nulle part — ni en jeu, ni en
     * distribution, ni via GO. C'est la seule chose qui retire la case Shiny :
     * un fabuleux verrouille dans toute la serie principale garde la sienne,
     * puisqu'une distribution a pu en produire un.
     */
    noShiny: context.noShiny.has(entry.id),
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

  // `hidden` retire les doublons : une femelle qui est deja la case ♀ de
  // l'espece, une forme qui ne monte pas dans HOME et n'a donc rien a cocher.
  const forms = (rawForms || [])
    .filter((form) => !((context.formDetails.forms || {})[form.key] || {}).hidden)
    .map((form) => mergeForm(form, species, context));
  // Chaque forme garde SA case `f<id>`, toujours. Les anciennes cases `vo` /
  // `vs` etaient positionnelles — « la premiere forme cochable » — donc elles
  // changeaient de Pokemon des qu'une forme apparaissait ou changeait de
  // statut. Trois collections s'y sont perdues (Floette, Meteno, Melmetal).
  // Elles sont converties une fois pour toutes a la lecture, voir
  // `migrateLegacySlots()` dans domain/collection.js.
  const primary = forms.findIndex((f) => f.entry);

  species.forms = forms;
  /**
   * Forme principale : la premiere reellement cochable. Ne sert plus qu'a
   * choisir le raccourci affiche sur la vignette — elle ne decide plus
   * d'aucun nom de case. Une forme sans chromatique compte : ne pas la
   * confondre avec `shinyEntry`, qui repond a une tout autre question.
   */
  species.primaryForm = primary >= 0 ? forms[primary] : null;
  species.cosmetic = cosmeticGroup(context.cosmeticGroups[String(entry.id)], species);
  /** Tout ce qui se compte comme « une forme » dans la vignette. */
  species.formCount =
    forms.length + (species.cosmetic ? species.cosmetic.variants.filter((v) => !v.isBase).length : 0);
  species.search = searchIndex(species);
  return Object.freeze(species);
}

/**
 * Botte de foin de la recherche : tout ce qu'on peut taper pour retrouver ce
 * Pokemon, en minuscules, concatene une fois pour toutes.
 *
 * Sans elle, chercher « alola » ou « gigamax » ne donnait rien : la recherche
 * ne regardait que le nom de l'espece — sur un site dont l'interet est
 * justement ses 304 formes et ses 160 cosmetiques.
 *
 * Les cles PokeAPI (`rattata-alola`) sont incluses volontairement : elles
 * offrent une prise en anglais, et elles sont stables.
 */
function searchIndex(species) {
  const parts = [species.name, species.en, species.cat];
  for (const form of species.forms) parts.push(form.name, form.label, form.key);
  if (species.cosmetic) {
    parts.push(species.cosmetic.title);
    for (const variant of species.cosmetic.variants) parts.push(variant.name, variant.short);
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
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

  const hasShinySprite = Boolean(form.sprites && (form.sprites.homeShiny || form.sprites.artShiny));
  /**
   * `entry` = la forme a sa propre entree dans HOME, donc sa propre case.
   * Par defaut : tout sauf les transformations de combat. `entry: 0` dans
   * data/details/forms.json retire les cases sans retirer la fiche — c'est le
   * cas des fusions (Kyurem Noir, Necrozma Solgaleo, Sylveroy monte) et des
   * partenaires de Let's Go, qui ne montent jamais dans HOME.
   */
  const entry = rule.entry === undefined ? !NOT_COLLECTIBLE.has(form.kind) : Boolean(rule.entry);
  const gendered = Boolean(rule.gendered);

  return Object.freeze({
    ...form,
    games,
    eventGames,
    shinyLocked,
    shiny,
    where: rule.where || "",
    note: rule.note || "",
    entry,
    gendered,
    /** Un chromatique de cette forme existe-t-il, et est-il a cocher ? */
    shinyEntry: entry && shiny === "own" && hasShinySprite && !species.noShiny,
    /** Cases de collection propres a cette forme (…f = femelle). */
    slot: `f${form.id}`,
    shinySlot: `f${form.id}s`,
    slotF: `f${form.id}f`,
    shinySlotF: `f${form.id}sf`,
    /** Un sprite chromatique existe-t-il seulement ? */
    hasShinySprite,
  });
}

/* --------------------------- formes cosmetiques -------------------------- */

/**
 * Zarbi, Prismillon, Charmilly, Couafarel… : PokeAPI ne leur donne pas d'entree
 * /pokemon distincte (pas d'id > 10000), donc tools/build_forms.py ne les voit
 * pas. Elles sont ecrites a la main dans data/details/cosmetic-forms.json et
 * rendues sous forme de grille a cocher.
 *
 * `base` designe la variante qui EST la forme par defaut de l'espece : elle
 * reutilise les cases `om` / `sm` au lieu d'en creer de nouvelles, sans quoi on
 * cocherait deux fois la meme chose.
 */
function cosmeticGroup(group, species) {
  if (!group || !Array.isArray(group.forms)) return null;

  const variants = group.forms.map((raw) => {
    const isBase = raw.key === group.base;
    // `noentry` : la variante existe, se montre, mais ne peut pas entrer dans
    // HOME — les six Pikachu Cosplayeur de ROSA, prisonniers de leur jeu.
    const noEntry = Boolean(raw.noentry);
    const noShiny = Boolean(raw.noshiny) || species.noShiny || Boolean(group.info) || noEntry;
    return Object.freeze({
      key: raw.key,
      name: raw.name,
      short: raw.short || raw.name,
      where: raw.where || "",
      isBase,
      /**
       * Nom du fichier de sprite, ou null : on retombe sur l'espece.
       * Par defaut la convention par forme ("666-savanna") ; `sprite` permet de
       * pointer un fichier nomme autrement, comme les id des Pikachu a
       * casquette, que le jeu de sprites ne nomme pas par motif.
       */
      sprite: raw.nosprite ? null : String(raw.sprite || `${species.id}-${raw.key}`),
      spriteSet: group.spriteSet || "home",
      slot: isBase ? "om" : `x${species.id}-${raw.key}`,
      shinySlot: isBase ? "sm" : `y${species.id}-${raw.key}`,
      shinyEntry: !group.info && !noShiny,
      entry: !group.info && !noEntry,
    });
  });

  return Object.freeze({
    title: group.title || "Formes",
    where: group.where || "",
    note: group.note || "",
    layout: group.layout || "",
    fold: Boolean(group.fold),
    /** Aucune case a cocher : le groupe n'est la que pour l'information. */
    info: Boolean(group.info),
    /** La grille remplace « Ma collection » : la variante de base y figure. */
    coversBase: variants.some((v) => v.isBase),
    baseVariant: variants.find((v) => v.isBase) || null,
    variants,
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
