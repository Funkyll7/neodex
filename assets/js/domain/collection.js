/**
 * collection.js — ce que je possede.
 *
 * Modele : marks[id] = { om, of, sm, sf, f10161, f10161s, ... }
 *   om / of      forme normale male / femelle
 *   sm / sf      chromatique male / femelle
 *   f<id>        forme alternative n° <id> (PokeAPI), version normale
 *   f<id>s       la meme, chromatique
 *
 * `vo` / `vs` sont l'ancien schema, quand une espece n'avait qu'une variante :
 * ils restent lus et rattaches a la forme principale, mais ne sont plus ecrits.
 *
 * Deux sources empilees :
 *   - data/collection.json  la reference commitee dans le depot
 *   - localStorage          les cases cochees depuis ce navigateur
 * La seconde ecrase la premiere, espece par espece. « Exporter » aplatit les
 * deux pour produire un nouveau collection.json, « Reinitialiser » jette la
 * couche locale.
 */

import { CONFIG } from "../config.js";

export const SLOT_KEYS = ["om", "of", "sm", "sf", "vo", "vs"];

/** Cases de forme : "f10161" (normale) et "f10161s" (chromatique). */
const FORM_SLOT = /^f\d+s?$/;

const isSlot = (key) => SLOT_KEYS.includes(key) || FORM_SLOT.test(key);

export class Collection {
  constructor(base) {
    this.base = sanitize(base && base.marks);
    this.local = readLocal();
  }

  /** Marques effectives d'une espece (jamais null). */
  get(id) {
    const key = String(id);
    return this.local[key] || this.base[key] || {};
  }

  has(id, slot) {
    return Boolean(this.get(id)[slot]);
  }

  isOwned(id) {
    const m = this.get(id);
    return Boolean(m.om || m.of);
  }

  isShiny(id) {
    const m = this.get(id);
    return Boolean(m.sm || m.sf);
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

  /** Compteurs affiches dans la barre laterale. */
  counts(species) {
    let owned = 0;
    let shiny = 0;
    let pair = 0;
    for (const p of species) {
      if (this.isOwned(p.id)) owned += 1;
      if (this.isShiny(p.id)) shiny += 1;
      if (this.isCompletePair(p.id)) pair += 1;
    }
    const total = species.length;
    return {
      total,
      owned,
      missing: total - owned,
      shiny,
      pair,
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
