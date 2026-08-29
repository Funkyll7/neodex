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
// Le carnet de chasses voyage dans le meme fichier que les cases, mais par un
// chemin entierement separe : sa fusion est une JOINTURE — union, max, treillis
// —, la leur un arbitrage a trois voies. Les melanger aurait mis les cases en
// danger pour rien, les deux problemes n'ayant pas la meme forme.
import {
  sanitizeQuetes,
  joinQuetes,
  egalQuetes,
} from "./quetes.js";

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

    // Le carnet vit a cote, jamais dedans. `quetesEnvoyees` est ce que le depot
    // contenait a la derniere lecture ; `quetes` y ajoute ce qui n a pas encore
    // pu partir. La jointure etant idempotente, il n y a pas d ancetre a garder :
    // rejouer une fusion ne change rien, contrairement aux cases.
    this.quetesEnvoyees = sanitizeQuetes(base && base.quetes);
    this.quetes = joinQuetes(this.quetesEnvoyees, lireQuetesLocales());

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

  /**
   * Fusion a trois voies avec l'etat du depot.
   *
   * `this.base` est l'ancetre commun — ce que le depot contenait la derniere
   * fois qu'on l'a lu ; la couche locale porte nos modifications ; l'argument
   * porte celles venues d'ailleurs. Sans cette fusion, un conflit se resolvait
   * en reecrivant l'etat local en entier, et une case cochee sur le telephone
   * pendant que le navigateur avait le site ouvert disparaissait.
   *
   * Une propriete agreable tombe du fait qu'une case ne vaut que oui ou non :
   * si notre valeur differe de la leur, l'une des deux est forcement restee
   * egale a l'ancetre — c'est donc l'autre qui a bouge, et elle gagne. Il n'y
   * a jamais de desaccord reel a arbitrer, donc aucune regle a inventer.
   *
   * @param {object} distantMarks  les marques lues dans le depot
   * @returns {object} les marques fusionnees, pretes a etre reecrites
   */
  fusionnerAvec(distantMarks) {
    const distant = sanitize(distantMarks);
    // Le depot peut etre plus ancien que la migration des cases heritees.
    if (this.dataset) migrateLayer(distant, this.dataset);

    const resultat = {};
    const ids = new Set([
      ...Object.keys(this.base),
      ...Object.keys(this.local),
      ...Object.keys(distant),
    ]);

    for (const id of ids) {
      const ancetre = this.base[id] || {};
      // La couche locale remplace l'entree entiere d'une espece : une case
      // absente de `local[id]` mais presente dans l'ancetre est une case
      // decochee ici, pas une case dont on n'aurait rien dit.
      const notre = this.local[id] || ancetre;
      const leur = distant[id] || {};

      const cases = {};
      for (const slot of new Set([
        ...Object.keys(ancetre),
        ...Object.keys(notre),
        ...Object.keys(leur),
      ])) {
        const a = Boolean(ancetre[slot]);
        const n = Boolean(notre[slot]);
        const l = Boolean(leur[slot]);
        // n === l : tout le monde est d'accord.
        // a === l : eux n'ont pas bouge, donc c'est nous.
        // sinon   : nous n'avons pas bouge, donc c'est eux.
        if (n === l ? n : a === l ? n : l) cases[slot] = 1;
      }

      if (Object.keys(cases).length) resultat[id] = cases;
    }

    return resultat;
  }

  /**
   * Le depot devient le nouvel ancetre, sans rien perdre de ce qui attend.
   *
   * A ne pas confondre avec `commitLocal`, qui s'emploie apres une ecriture
   * reussie et vide la couche locale parce que le depot la contient desormais.
   * Ici le depot ne contient PAS nos modifications : les vider les perdrait.
   * On repose donc l'ancetre sur ce qu'on vient de lire, et on garde en attente
   * exactement ce qui l'en ecarte.
   *
   * @param {object} distantMarks  les marques lues dans le depot
   * @returns {boolean} vrai si l'affichage doit etre refait
   */
  adopterDistant(distantMarks) {
    const fusionne = this.fusionnerAvec(distantMarks);
    const avant = this.toExport("comparaison").marks;

    const distant = sanitize(distantMarks);
    if (this.dataset) migrateLayer(distant, this.dataset);
    this.base = distant;

    const local = {};
    for (const id of new Set([...Object.keys(fusionne), ...Object.keys(distant)])) {
      const voulu = fusionne[id] || {};
      if (!sameMarks(voulu, distant[id] || {})) local[id] = voulu;
    }
    this.local = local;
    writeLocal(this.local);

    // Un RAPPORT et non un booleen : « Mis a jour depuis le depot » ne disait
    // pas QUOI, et c est justement ce qu on veut savoir en rentrant chez soi.
    // Il reste faux quand rien n a bouge, donc aucun appelant ne change.
    return rapportDeChangement(avant, this.toExport("comparaison").marks, this.dataset);
  }


  /* ------------------------- le carnet de chasses ------------------------ */

  /**
   * Reste-t-il du carnet a envoyer ?
   *
   * Comparaison STRUCTURELLE et non textuelle : l'ordre des cles d'un objet
   * suit l'ordre d'insertion, et deux carnets egaux construits dans un ordre
   * different auraient semble differer — donc auraient declenche une ecriture,
   * qui aurait replanifie la suivante, sans fin.
   */
  get quetesEnAttente() {
    return !egalQuetes(this.quetes, this.quetesEnvoyees);
  }

  /**
   * Remplace le carnet par sa jointure avec celui qu'on vient de lire ou
   * d'ecrire, et retient ce que le depot contient desormais.
   *
   * Le meme appel sert aux deux cas — relecture et acquittement — parce que la
   * jointure ne distingue pas : elle est idempotente. C'est toute la difference
   * avec les cases, ou lire et ecrire demandent deux methodes distinctes.
   */
  adopterQuetes(distantes) {
    const propre = sanitizeQuetes(distantes);
    this.quetes = joinQuetes(this.quetes, propre);
    this.quetesEnvoyees = propre;
    // On ne garde en local QUE ce que le depot n'a pas encore : sinon le
    // localStorage grossirait d'une copie complete du carnet a chaque fusion.
    ecrireQuetesLocales(this.quetes);
  }

  /** Applique une modification au carnet, et la note comme a envoyer. */
  majQuetes(carnet) {
    this.quetes = sanitizeQuetes(carnet);
    ecrireQuetesLocales(this.quetes);
  }

  /**
   * Objet pret a etre ecrit dans data/collection.json.
   *
   * @param {string} [source]
   * @param {object} [marksImposees]  marques a ecrire telles quelles, au lieu
   *   de l'empilement base + local. Sert a la fusion apres conflit.
   */
  toExport(source = "export navigateur", marksImposees = null) {
    const merged = marksImposees ? sanitize(marksImposees) : { ...this.base };
    if (!marksImposees) {
      for (const [id, marks] of Object.entries(this.local)) {
        if (Object.keys(marks).length) merged[id] = marks;
        else delete merged[id];
      }
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
      // TEL QUEL, sans elagage ni borne ni tri. Voir la LOI en tete de
      // domain/quetes.js : normaliser ici et pas dans l etat ferait renaitre un
      // ecart juste apres chaque ecriture reussie, donc un commit toutes les
      // quatre secondes, indefiniment.
      quetes: this.quetes,
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


/* ------------------------------------------------------------------------ *
 * Le carnet de chasses.
 *
 * Voyage dans le meme fichier que les cases, mais sans jamais croiser leur
 * chemin : sa fusion est une jointure idempotente, la leur un arbitrage a trois
 * voies. Voir domain/quetes.js, et la LOI qui y est ecrite en tete.
 * ------------------------------------------------------------------------ */

function lireQuetesLocales() {
  try {
    return sanitizeQuetes(JSON.parse(localStorage.getItem(CONFIG.storage.quetes) || "{}"));
  } catch {
    return { parties: {} };
  }
}

function ecrireQuetesLocales(carnet) {
  try {
    localStorage.setItem(CONFIG.storage.quetes, JSON.stringify(carnet));
  } catch {
    /* quota depasse : on continue sans persister */
  }
}

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

/** La meme comparaison, mais d'une collection entiere a une autre. */

/**
 * Ce qui a changé entre deux états de la collection.
 *
 * Rend `null` quand rien n'a bougé, et NON un objet vide. Les appelants
 * écrivent « if (!change) return » : un objet aurait toujours été vrai, et la
 * grille se serait reconstruite à chaque retour sur l'onglet. C'est aussi ce
 * qui permet de remplacer le booléen d'`adopterDistant` sans toucher à aucun
 * appelant — `null` est faux, un rapport est vrai.
 *
 * Les deux sens comptent. Une synchronisation peut RETIRER une case : décocher
 * sur le téléphone est une décision comme une autre, et un message qui ne
 * parlerait que des arrivées aurait laissé croire à une perte silencieuse.
 */
function rapportDeChangement(avant, apres, dataset) {
  const especes = [];
  let gagnees = 0;
  let perdues = 0;

  for (const id of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
    const a = avant[id] || {};
    const b = apres[id] || {};
    const plus = [];
    const moins = [];
    for (const slot of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!a[slot] && b[slot]) plus.push(slot);
      else if (a[slot] && !b[slot]) moins.push(slot);
    }
    if (!plus.length && !moins.length) continue;
    gagnees += plus.length;
    perdues += moins.length;
    // L'espèce ENTIÈRE et non son nom : le nom dépend de la langue affichée, et
    // ce module n'a pas à la connaître. Celui qui écrit le message la connaît.
    especes.push({ id: Number(id), espece: dataset ? dataset.byId.get(Number(id)) : null, gagnees: plus, perdues: moins });
  }

  if (!especes.length) return null;
  especes.sort((x, y) => x.id - y.id);
  return { especes, gagnees, perdues };
}

function sameCollections(a = {}, b = {}) {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) if (!sameMarks(a[id], b[id])) return false;
  return true;
}
