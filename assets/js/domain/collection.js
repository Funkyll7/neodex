/**
 * collection.js — ce que je possede.
 *
 * Modele : marks[id] = { om, of, sm, sf, gn, gs, f10161, f10161s, x201-b, ... }
 *   om / of      forme normale male / femelle
 *   sm / sf      chromatique male / femelle
 *   gn / gs      Pokedex Pokemon GO : normal / chromatique. Deux cases par
 *                espece, pas une de plus — le livingdex GO ignore les formes.
 *                Elles vivent dans le meme objet que les autres, et c'est
 *                voulu : un seul fichier, une seule synchronisation, un seul
 *                export. `completion.js` ne les regarde jamais, donc elles
 *                n'entrent pas dans la progression HOME.
 *   f<id>        forme alternative n° <id> (PokeAPI), version normale
 *   f<id>s       la meme, chromatique
 *   f<id>f       la meme, femelle (formes a dimorphisme : Farfuret de Hisui)
 *   f<id>sf      la meme, chromatique femelle
 *   gf<id>       forme regionale dans Pokemon GO, normale ; gf<id>s chromatique
 *   x<n>-<clef>  forme cosmetique (Zarbi, Prismillon, Charmilly…), normale
 *   y<n>-<clef>  la meme, chromatique
 *
 * `vo` / `vs` / `vof` / `vsf` sont l'ancien schema, positionnel : ils
 * designaient « la premiere forme cochable de l'espece », donc ils changeaient
 * de Pokemon des qu'une forme apparaissait ou changeait de statut. Ils ne sont
 * plus ni ecrits ni lus tels quels : `migrateLegacySlots()` les convertit une
 * fois pour toutes vers la case explicite `f<id>` de la forme concernee, a la
 * construction et a chaque import. Une marque heritee qu'aucune forme ne peut
 * accueillir est laissee intacte plutot que posee au hasard.
 *
 * Deux sources empilees :
 *   - data/collection.json  la reference commitee dans le depot
 *   - localStorage          les cases cochees depuis ce navigateur
 * La seconde ecrase la premiere, espece par espece. « Exporter » aplatit les
 * deux pour produire un nouveau collection.json, « Reinitialiser » jette la
 * couche locale.
 */

import { CONFIG } from "../config.js";

export const SLOT_KEYS = ["om", "of", "sm", "sf", "gn", "gs", "vo", "vs", "vof", "vsf"];

/** Cases de forme : "f10161", "f10161s" (chromatique), "…f" (femelle). */
const FORM_SLOT = /^f\d+s?f?$/;
/**
 * Cases d'une forme regionale dans Pokemon GO : "gf10161", "gf10161s".
 * Le prefixe `gf` les separe des cases HOME de la meme forme (`f10161`) :
 * avoir le Miaouss d'Alola dans GO ne le met pas dans une boite de HOME.
 */
const GO_FORM_SLOT = /^gf\d+s?$/;
/** Case d'une variante cosmetique dans Pokemon GO : "gc666-savanna", "…s". */
const GO_COSMETIC_SLOT = /^gc\d+-[a-z0-9-]+$/;
/** Cases de forme cosmetique : "x201-b" (normale), "y201-b" (chromatique). */
const COSMETIC_SLOT = /^[xy]\d+-[a-z0-9-]+$/;
/**
 * Une case cosmetique, et une seule, commence par `x` (normale) ou `y`
 * (chromatique). C'est un raccourci, mais un raccourci garanti : `sanitize()`
 * ne laisse passer que des cases connues, et aucune des autres ne commence par
 * ces deux lettres — `om/of/sm/sf/gn/gs` et l'ancien `vo/vs/vof/vsf` commencent
 * par o, s, g ou v, les formes par `f`.
 *
 * Une expression reguliere rejouee sur chaque cle a chaque appel couterait ici :
 * `isOwned` et `isShiny` sont appelees des milliers de fois par case cochee —
 * deux fois par espece dans les compteurs, une dans les filtres, deux par
 * vignette repeinte.
 */
const aUneCosmetique = (marks, lettre) => {
  for (const slot of Object.keys(marks)) if (slot[0] === lettre) return true;
  return false;
};

const isSlot = (key) =>
  SLOT_KEYS.includes(key) ||
  FORM_SLOT.test(key) ||
  GO_FORM_SLOT.test(key) ||
  GO_COSMETIC_SLOT.test(key) ||
  COSMETIC_SLOT.test(key);

/** Ancienne case -> champ de la forme principale qui la remplace. */
const LEGACY_SLOTS = { vo: "slot", vs: "shinySlot", vof: "slotF", vsf: "shinySlotF" };

export class Collection {
  /**
   * @param {object} base     contenu de data/collection.json
   * @param {object} [dataset] jeu de donnees fusionne, pour convertir les
   *   anciennes cases positionnelles. Sans lui, elles restent en l'etat.
   */
  constructor(base, dataset = null) {
    this.dataset = dataset;
    this.base = sanitize(base && base.marks);
    this.local = readLocal();
    this.migrateLegacySlots();
  }

  /**
   * Convertit les cases heritees `vo` / `vs` / `vof` / `vsf` vers la case
   * explicite de la forme qu'elles designaient. Idempotent : une fois la
   * conversion faite, il n'y a plus rien a convertir.
   *
   * Sert a deux moments : au chargement, pour un depot pas encore migre, et
   * a l'import d'une sauvegarde exportee avant la migration.
   */
  migrateLegacySlots() {
    if (!this.dataset) return;
    migrateLayer(this.base, this.dataset);
    if (migrateLayer(this.local, this.dataset)) writeLocal(this.local);
  }

  /** Marques effectives d'une espece (jamais null). */
  get(id) {
    const key = String(id);
    return this.local[key] || this.base[key] || {};
  }

  has(id, slot) {
    return Boolean(this.get(id)[slot]);
  }

  /**
   * « Est-ce que j'ai ce Pokemon ? »
   *
   * Une variante cosmetique compte : un Zarbi B EST un Zarbi, une Prismillon
   * Motif Continental EST une Prismillon. Sans cette clause, une vignette
   * s'affichait « manquante » alors que sa grille de variantes etait cochee —
   * seule la variante de base ecrit `om`, les autres ecrivent `x<id>-<clef>`.
   *
   * Une forme REGIONALE ne compte pas, elle : un Miaouss d'Alola ne remplace
   * pas le Miaouss de Kanto dans une boite de HOME, il s'ajoute a lui. La
   * vignette le signale autrement — voir `formeDeRepli()` dans domain/display.js,
   * qui montre le sprite de la forme possedee a la place de celui de l'espece.
   */
  isOwned(id) {
    const m = this.get(id);
    if (m.om || m.of) return true;
    return aUneCosmetique(m, "x");
  }

  isShiny(id) {
    const m = this.get(id);
    if (m.sm || m.sf) return true;
    return aUneCosmetique(m, "y");
  }

  isCompletePair(id) {
    const m = this.get(id);
    return Boolean(m.om && m.of);
  }

  /** Coche / decoche une case et persiste aussitot. */
  toggle(id, slot) {
    const key = String(id);
    const next = { ...this.get(id) };
    if (next[slot]) delete next[slot];
    else next[slot] = 1;

    if (Object.keys(next).length) this.local[key] = next;
    else this.local[key] = {};
    writeLocal(this.local);
    return next;
  }

  /** Force une case a l'etat coche (utilise par la validation de quete). */
  mark(id, slot) {
    if (this.has(id, slot)) return;
    this.toggle(id, slot);
  }

  /** Nombre d'especes dont l'etat local differe du fichier de reference. */
  get dirtyCount() {
    let count = 0;
    for (const [id, marks] of Object.entries(this.local)) {
      const reference = this.base[id] || {};
      if (!sameMarks(marks, reference)) count += 1;
    }
    return count;
  }

  /**
   * Compteurs affiches dans la barre laterale.
   * @param {(species: object) => boolean} [isComplete]  test « tout obtenu »,
   *   injecte par l'appelant : la collection ne connait ni les jeux ni les formes.
   */
  counts(species, isComplete = () => false) {
    let owned = 0;
    let shiny = 0;
    let pair = 0;
    let complete = 0;
    for (const p of species) {
      if (this.isOwned(p.id)) owned += 1;
      if (this.isShiny(p.id)) shiny += 1;
      if (this.isCompletePair(p.id)) pair += 1;
      if (isComplete(p)) complete += 1;
    }
    const total = species.length;
    return {
      total,
      owned,
      missing: total - owned,
      shiny,
      pair,
      complete,
      incomplete: total - complete,
      pct: total ? Math.round((owned / total) * 100) : 0,
    };
  }

  /** Objet pret a etre ecrit dans data/collection.json. */
  toExport(source = "export navigateur") {
    const merged = { ...this.base };
    for (const [id, marks] of Object.entries(this.local)) {
      if (Object.keys(marks).length) merged[id] = marks;
      else delete merged[id];
    }
    const ordered = {};
    for (const id of Object.keys(merged).sort((a, b) => Number(a) - Number(b))) {
      ordered[id] = merged[id];
    }
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      source,
      marks: ordered,
    };
  }

  /** Remplace entierement la couche locale (import de fichier). */
  replaceLocal(marks) {
    this.local = sanitize(marks);
    // Le fichier importe peut dater d'avant la migration des cases heritees.
    if (this.dataset) migrateLayer(this.local, this.dataset);
    writeLocal(this.local);
  }

  /**
   * Ce qui vient d'etre ecrit dans le depot devient la nouvelle reference.
   * La couche locale n'a alors plus rien a signaler : dirtyCount retombe a 0
   * sans qu'on ait besoin de recharger la page.
   */
  commitLocal(marks) {
    this.base = sanitize(marks);
    // « Recharger » ramene le fichier du depot, qui peut etre plus ancien que
    // la migration des cases heritees.
    if (this.dataset) migrateLayer(this.base, this.dataset);
    this.local = {};
    writeLocal(this.local);
  }

  /** Oublie les modifications locales et revient au fichier de reference. */
  resetLocal() {
    this.local = {};
    localStorage.removeItem(CONFIG.storage.marks);
  }
}

/* ------------------------------ persistance ------------------------------ */

function readLocal() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(CONFIG.storage.marks) || "{}"));
  } catch {
    return {};
  }
}

function writeLocal(marks) {
  try {
    localStorage.setItem(CONFIG.storage.marks, JSON.stringify(marks));
  } catch {
    // Quota depasse ou stockage bloque : on continue sans persister.
  }
}

/**
 * Convertit sur place les cases heritees d'une couche de marques.
 * @returns {boolean} vrai si quelque chose a bouge.
 */
function migrateLayer(layer, dataset) {
  let touched = false;
  for (const [id, marks] of Object.entries(layer)) {
    for (const key of Object.keys(marks)) {
      const field = LEGACY_SLOTS[key];
      if (!field) continue;
      const species = dataset.byId.get(Number(id));
      const target = species && species.primaryForm && species.primaryForm[field];
      // Aucune forme cochable pour l'accueillir : on garde la marque telle
      // quelle. Elle ne compte pas, mais elle n'est pas perdue non plus.
      if (!target || target === key) continue;
      marks[target] = 1;
      delete marks[key];
      touched = true;
    }
  }
  return touched;
}

/** Ne garde que des ids numeriques et des cases connues. */
function sanitize(raw) {
  const out = {};
  for (const [id, marks] of Object.entries(raw || {})) {
    if (!/^\d+$/.test(id) || !marks || typeof marks !== "object") continue;
    const clean = {};
    for (const [slot, value] of Object.entries(marks)) if (value && isSlot(slot)) clean[slot] = 1;
    out[id] = clean;
  }
  return out;
}

function sameMarks(a = {}, b = {}) {
  const slots = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const slot of slots) if (Boolean(a[slot]) !== Boolean(b[slot])) return false;
  return true;
}
