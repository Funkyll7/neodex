/**
 * sync.js — ecrire data/collection.json directement dans le depot GitHub.
 *
 * Le site reste 100 % statique : c'est le navigateur qui parle a l'API GitHub,
 * avec un jeton que l'utilisateur colle une fois et qui ne quitte jamais sa
 * machine (localStorage). Aucun serveur, aucune dependance.
 *
 * Le cycle exporter / remplacer le fichier / commiter devient :
 *   coche une case -> quelques secondes plus tard, le depot est a jour.
 *
 * Prudence volontaire :
 *   - on relit toujours le `sha` du fichier avant d'ecrire, et on retente une
 *     fois si quelqu'un a commite entre-temps : pas d'ecrasement silencieux ;
 *   - le jeton n'est jamais ecrit ailleurs que dans le localStorage de ce
 *     navigateur, et `forget()` l'efface.
 */

import { CONFIG } from "../config.js";

const API = "https://api.github.com";

export class GitHubSync {
  constructor(collection) {
    this.collection = collection;
    this.repo = { ...CONFIG.github };
    this.token = readToken();
    /** sha du collection.json distant, exige par l'API pour toute mise a jour. */
    this.sha = null;
    this.state = { status: this.token ? "idle" : "off", message: "", at: null };
    this.listeners = new Set();
    this.timer = null;
    this.inFlight = null;
  }

  /* ------------------------------ abonnement ---------------------------- */

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(status, message = "") {
    this.state = { status, message, at: new Date() };
    for (const fn of this.listeners) fn(this.state);
  }

  get configured() {
    return Boolean(this.token && this.repo.owner && this.repo.repo);
  }

  /* -------------------------------- jeton ------------------------------- */

  /** Enregistre le jeton et verifie tout de suite qu'il donne bien acces. */
  async connect(token) {
    this.token = String(token || "").trim();
    if (!this.token) throw new Error("jeton vide");
    this.emit("busy", "Vérification du jeton…");
    try {
      await this.fetchRemote();
    } catch (error) {
      this.token = "";
      this.emit("error", error.message);
      throw error;
    }
    writeToken(this.token);
    this.emit("ok", "Connecté au dépôt.");
  }

  forget() {
    this.token = "";
    this.sha = null;
    clearToken();
    this.emit("off", "");
  }

  /* ------------------------------- lecture ------------------------------ */

  get contentsUrl() {
    const { owner, repo, path } = this.repo;
    return `${API}/repos/${owner}/${repo}/contents/${path}`;
  }

  async call(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (response.ok) return response.json();

    const detail = await response.json().catch(() => ({}));
    throw new Error(describe(response.status, detail.message));
  }

  /** Recupere le collection.json distant : son contenu et son sha. */
  async fetchRemote() {
    const url = `${this.contentsUrl}?ref=${encodeURIComponent(this.repo.branch)}`;
    const data = await this.call(url, { cache: "no-store" });
    this.sha = data.sha;
    return JSON.parse(decodeBase64(data.content));
  }

  /* ------------------------------ ecriture ------------------------------ */

  /**
   * Ecrit la collection courante dans le depot.
   * @param {string} reason  ce qui apparaitra dans le message de commit.
   */
  async push(reason = "mise à jour depuis le site") {
    if (!this.configured) throw new Error("aucun jeton enregistré");
    // Une seule ecriture a la fois : deux PUT concurrents se voleraient le sha.
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.write(reason).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async write(reason, retry = true) {
    this.emit("busy", "Enregistrement sur GitHub…");
    const payload = this.collection.toExport("site NéoDex");
    const body = {
      message: `Collection : ${reason}`,
      content: encodeBase64(`${JSON.stringify(payload, null, 1)}\n`),
      branch: this.repo.branch,
      ...(this.sha ? { sha: this.sha } : {}),
    };

    try {
      if (!this.sha) await this.fetchRemote();
      const data = await this.call(this.contentsUrl, {
        method: "PUT",
        body: JSON.stringify({ ...body, sha: this.sha }),
      });
      this.sha = data.content && data.content.sha;
      // Ce qui est dans le depot devient la nouvelle reference : plus rien
      // n'est « modifie dans ce navigateur ».
      this.collection.commitLocal(payload.marks);
      this.emit("ok", "Enregistré dans le dépôt.");
      return data;
    } catch (error) {
      // 409 / 422 : le fichier a bouge depuis notre derniere lecture. On relit
      // le sha et on recommence une fois. Une 404, elle, ne se repare pas.
      if (retry && /^Conflit/.test(error.message)) {
        this.sha = null;
        return this.write(reason, false);
      }
      this.emit("error", error.message);
      throw error;
    }
  }

  /**
   * Ecriture differee : on attend que l'utilisateur ait fini de cocher.
   * Sans cela, cocher dix cases ferait dix commits.
   */
  schedule(reason) {
    if (!this.configured) return;
    clearTimeout(this.timer);
    this.emit("pending", "Modification en attente…");
    this.timer = setTimeout(() => {
      this.push(reason).catch(() => {
        /* l'etat d'erreur est deja diffuse par write() */
      });
    }, CONFIG.github.delayMs);
  }

  /** Force l'ecriture immediate (bouton, ou fermeture de l'onglet). */
  flush(reason = "mise à jour depuis le site") {
    clearTimeout(this.timer);
    return this.push(reason);
  }
}

/* ------------------------------ persistance ------------------------------ */

function readToken() {
  try {
    return localStorage.getItem(CONFIG.storage.token) || "";
  } catch {
    return "";
  }
}

function writeToken(token) {
  try {
    localStorage.setItem(CONFIG.storage.token, token);
  } catch {
    /* stockage bloque : la session marchera, mais il faudra recoller le jeton */
  }
}

function clearToken() {
  try {
    localStorage.removeItem(CONFIG.storage.token);
  } catch {
    /* rien a faire */
  }
}

/* -------------------------------- helpers -------------------------------- */

/** Messages d'erreur en francais, orientes « quoi faire ». */
function describe(status, message) {
  if (status === 401) return "Jeton refusé : il est invalide ou a expiré.";
  if (status === 403) return "Accès refusé : le jeton n'a pas le droit d'écriture sur ce dépôt.";
  if (status === 404) return "Fichier introuvable : vérifie le dépôt, la branche et le chemin.";
  if (status === 409 || status === 422) return "Conflit : le fichier a changé dans le dépôt.";
  return message ? `GitHub a répondu : ${message}` : `GitHub a répondu ${status}.`;
}

/** base64 <-> UTF-8 : les noms francais contiennent des accents. */
function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(base64) {
  const binary = atob(String(base64 || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
