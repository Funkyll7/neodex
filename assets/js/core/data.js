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

// Le message d'echec de chargement est lu par l'utilisateur : il suit la langue.
import { t } from "./i18n.js";

const BASE = new URL("../../../data/", import.meta.url);

async function loadJson(path) {
  const url = new URL(path, BASE);
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`${t("Impossible de charger")} ${path} (HTTP ${response.status})`);
  }
  return response.json();
}

/** Charge un fichier facultatif : son absence n'est pas une erreur. */
function loadOptional(path, fallback) {
  return loadJson(path).catch(() => fallback);
}

export async function loadDataset() {
  const [manifest, typesRef, gensRef, gamesRef, huntRef, locksRef, formDetails, cosmeticRef, goRef, famillesRef, dlcRef] =
    await Promise.all([
      loadJson("pokemon/manifest.json"),
      loadJson("reference/types.json"),
      loadJson("reference/generations.json"),
      loadJson("reference/games.json"),
      loadJson("reference/hunt.json"),
      loadOptional("reference/shiny-locks.json", { always: {}, noShiny: {}, byGame: {}, forms: {} }),
      loadOptional("details/forms.json", { defaults: {}, bySince: {}, forms: {} }),
      loadOptional("details/cosmetic-forms.json", { groups: {} }),
      loadOptional("reference/go.json", { shiny: [] }),
      // Les lignees d evolution, pour le rangement par famille du Living Dex.
      // `loadOptional` et non `loadJson` : le fichier est un CONFORT, pas une
      // donnee de collection. S il manque, la vue par boites garde son
      // rangement par numero et rien d autre ne bouge.
      loadOptional("reference/familles.json", { chaines: [] }),
      // Ce que chaque contenu telechargeable apporte, et lui seul : de quoi
      // poser le logo du DLC a cote de l embleme du jeu sur une fiche.
      // `loadOptional` comme familles.json juste au-dessus, et pour la meme
      // raison : c est un ORNEMENT. Le fichier n apprend rien de neuf sur la
      // disponibilite — data/availability place deja l espece dans
      // Epee/Bouclier ou Ecarlate/Violet sans lui —, il precise seulement
      // qu il y faut le DLC. S il manque, une fiche perd un logo et RIEN
      // d autre : ni case, ni compteur, ni jeu dans la liste des presences.
      // Un tel detail n a pas a emporter le chargement de tout le site.
      loadOptional("reference/dlc.json", { dlc: [] }),
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
    /**
     * Especes dont le chromatique existe dans Pokemon GO, formes de base
     * seulement (data/reference/go.json, releve sur Serebii). Sans cette
     * liste, le livingdex GO demandait 1025 chromatiques dont 136 n'ont
     * jamais existe : un compteur impossible a terminer.
     */
    goShiny: new Set(goRef.shiny || []),
    /**
     * Les 73 especes que Serebii marque « Not Currently Available ». On stocke
     * les ABSENTES et non les presentes : c'est la liste qui bouge, et elle
     * raccourcit a chaque mise a jour du jeu.
     */
    goAbsent: new Set(goRef.absents || []),
    /**
     * Formes regionales presentes dans GO, en « <numero>-<region> ». GO n'a ni
     * Mega, ni Gigamax, ni cosmetique : seules ces quatre familles s'y rangent
     * dans une boite a part, et ce sont donc les seules qui comptent ici.
     */
    goFormes: new Set(goRef.formes || []),
    goFormesShiny: new Set(goRef.formesShiny || []),
    /**
     * Formes que la cle « <numero>-<region> » ramasse a tort : Serebii ne donne
     * que l'espece et la region, et deux formes du depot peuvent partager ce
     * couple. Une exclusion nommee plutot qu'une heuristique — un Mode Transe
     * ne se reconnait a rien d'automatique.
     */
    goFormesExclues: new Set(goRef.formesExclues || []),
    /**
     * Les autres formes que GO range dans une boite a part : Motisma, Deoxys,
     * Origine, Totemique, Mordudor Ambulant… plus les familles cosmetiques.
     *
     * Referencees par une CLE FIGEE — « f:<cle PokeAPI> » pour une forme de
     * data/forms, « c:<numero>-<clef> » pour une variante cosmetique. Serebii
     * ne donne qu'un libelle anglais ; l'appariement a ete fait une fois, a la
     * main pour les vingt cas que le nom seul ne tranche pas, et le resultat
     * est fige ici. Rien n'est devine a l'execution.
     */
    goAutres: new Set(goRef.formesAutres || []),
    goAutresShiny: new Set(goRef.formesAutresShiny || []),
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
    /** Ce que le Pokedex GO range dans des boites. Voir `goEntries()`. */
    goEntries: goEntries(species),
    /**
     * Les 541 lignees d evolution, rangees par le premier numero national de
     * chacune. Elles ne servent qu au rangement « par famille » des boites —
     * voir `domain/livingdex.js`. Relevees dans les CSV de PokeAPI, colonnes
     * `evolves_from_species_id` et `evolution_chain_id`.
     */
    chaines: famillesRef.chaines || [],
    /**
     * Les quatre DLC et, pour chacun, les especes qu il apporte a LUI SEUL :
     * l Ile Solitaire de l Armure et les Terres Enneigees de la Couronne pour
     * Epee/Bouclier, le Tresor Enfoui de la Zone Zero pour Ecarlate/Violet,
     * Mega-Dimension pour Legendes Z-A.
     *
     * La liste est deja debarrassee de ce que le jeu de base contient : une
     * espece n y figure que si le DLC est la seule facon de l obtenir. C est
     * tout l interet du fichier, et c est ce qui autorise a afficher son logo
     * sans se poser de question. Voir data/reference/dlc.json, qui dit d ou
     * viennent les numeros et comment la soustraction est faite.
     */
    dlc: dlcRef.dlc || [],
  };
}

/**
 * Ce que le Pokedex GO range dans des boites : les 1025 especes, plus les 161
 * formes que le jeu propose.
 *
 * Une liste PLATE d'entrees, et non les especes avec leurs formes en dessous :
 * dans GO, une forme d'Alola n'est pas un detail de son espece, c'est une boite
 * de plus a remplir. La grille les traite donc a egalite, exactement comme le
 * jeu — et chaque entree porte ses deux cases, son sprite et son nom.
 *
 * Trois provenances, un seul type d'entree :
 *   - l'espece elle-meme ;
 *   - une forme de data/forms — regionale, Motisma, Deoxys, Origine… ;
 *   - une variante cosmetique — motif de Prismillon, coupe de Couafarel.
 * Les transformations de combat et les costumes evenementiels n'y sont pas :
 * ce ne sont pas des boites, et data/reference/go.json dit lesquelles retenir.
 */
function goEntries(species) {
  const entries = [];
  for (const p of species) {
    entries.push(
      Object.freeze({
        key: String(p.id),
        id: p.id,
        species: p,
        form: null,
        variant: null,
        name: p.name,
        kind: null,
        slot: "gn",
        shinySlot: "gs",
        released: p.goReleased,
        shiny: p.goShiny,
      })
    );

    for (const form of p.forms) {
      if (!form.goReleased) continue;
      entries.push(
        Object.freeze({
          key: form.slot,
          id: p.id,
          species: p,
          form,
          variant: null,
          name: form.name,
          kind: form.kind,
          slot: form.goSlot,
          shinySlot: form.goShinySlot,
          released: true,
          shiny: form.goShiny,
        })
      );
    }

    if (!p.cosmetic) continue;
    for (const variant of p.cosmetic.variants) {
      if (!variant.goReleased) continue;
      entries.push(
        Object.freeze({
          key: variant.slot,
          id: p.id,
          species: p,
          form: null,
          variant,
          name: `${p.name} ${variant.short}`,
          kind: "cosmetic",
          slot: variant.goSlot,
          shinySlot: variant.goShinySlot,
          released: true,
          shiny: variant.goShiny,
        })
      );
    }
  }
  return entries;
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
    /**
     * Cette espece est-elle obtenable dans Pokemon GO aujourd'hui ?
     * 73 ne le sont pas — Arceus, Manaphy, les Tresors du Fleau, la moitie de
     * Paldea. Les compter donnait un livingdex de 1025 cases dont 73
     * impossibles a cocher.
     */
    goReleased: !context.goAbsent.has(entry.id),
    /**
     * Le chromatique de cette espece existe-t-il dans Pokemon GO ?
     * Question distincte de `noShiny` : GO sort ses chromatiques a son propre
     * rythme, et beaucoup de Pokemon recents n'en ont pas encore alors que la
     * serie principale, elle, en a un depuis longtemps.
     */
    goShiny: context.goShiny.has(entry.id) && !context.goAbsent.has(entry.id),
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
  species.cosmetic = cosmeticGroup(
    context.cosmeticGroups[String(entry.id)],
    species,
    context.goAutres,
    context.goAutresShiny
  );
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
  // L'index est range SANS accents, et la requete sera pliee de la meme
  // maniere. Personne ne tape « Mélofée » sur un clavier de telephone : on
  // tape « melofee », et la recherche ne rendait rien. Meme histoire pour
  // Leviator, Tenefix, Electhor, Ecremeuh et une bonne partie du dex francais.
  //
  // On garde le nom accentue partout ailleurs — c'est l'orthographe juste, et
  // c'est ce qui s'affiche. Seul l'index de recherche est aplati.
  return sansAccents(parts.filter(Boolean).join(" ").toLowerCase());
}

/**
 * Retire les signes diacritiques d'une chaine deja en minuscules.
 *
 * `normalize("NFD")` separe la lettre de son accent, le filtre jette les
 * accents devenus autonomes. Rien a maintenir : ni table de correspondance,
 * ni liste de cas particuliers.
 */
export function sansAccents(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "");
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
    /**
     * Le Pokedex GO, a part. Une forme regionale y est un Pokemon de plus a
     * ranger dans une boite, comme dans HOME — mais GO n'a ni Mega, ni
     * Gigamax, ni cosmetique, et il sort ses formes a son propre rythme.
     * Les deux cases GO de la forme, sans rapport avec les quatre de HOME.
     */
    goReleased:
      !context.goFormesExclues.has(form.key) &&
      (context.goFormes.has(`${species.id}-${form.kind}`) || context.goAutres.has(`f:${form.key}`)),
    goShiny:
      !context.goFormesExclues.has(form.key) &&
      (context.goFormesShiny.has(`${species.id}-${form.kind}`) ||
        context.goAutresShiny.has(`f:${form.key}`)),
    goSlot: `gf${form.id}`,
    goShinySlot: `gf${form.id}s`,
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
function cosmeticGroup(group, species, goSet, goShinySet) {
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
      /**
       * LE JEU DE SPRITES SE DECIDE PAR VARIANTE, PAS PAR GROUPE.
       *
       * Il ne se decidait que par groupe, et les Pikachu en faisaient les
       * frais : les huit casquettes ONT un rendu HOME, les six Cosplayeur n'en
       * ont pas — mesure faite image par image. Un seul drapeau pour les
       * quatorze imposait donc le sprite 2D aux huit qui meritaient le 3D,
       * dans les boites comme dans la grille.
       *
       * Le groupe reste le defaut, ce qui garde les dix-sept autres inchanges ;
       * la variante peut le contredire quand elle seule fait exception.
       */
      spriteSet: raw.spriteSet || group.spriteSet || "home",
      slot: isBase ? "om" : `x${species.id}-${raw.key}`,
      shinySlot: isBase ? "sm" : `y${species.id}-${raw.key}`,
      shinyEntry: !group.info && !noShiny,
      entry: !group.info && !noEntry,
      /**
       * Pokemon GO range certaines de ces variantes dans une boite a part —
       * les motifs de Prismillon, les coupes de Couafarel, les couleurs de
       * Flabebe. Cases distinctes de celles de HOME : avoir la Prismillon
       * Motif Savane dans GO ne la met pas dans une boite de HOME.
       */
      goReleased: goSet.has(`c:${species.id}-${raw.key}`),
      goShiny: goShinySet.has(`c:${species.id}-${raw.key}`),
      goSlot: `gc${species.id}-${raw.key}`,
      goShinySlot: `gc${species.id}-${raw.key}s`,
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
