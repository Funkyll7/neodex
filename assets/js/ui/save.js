/**
 * save.js — synchronisation GitHub, export, import, reinitialisation.
 *
 * Deux facons de figer la collection dans le depot :
 *   - la synchronisation (domain/sync.js) ecrit data/collection.json toute
 *     seule, quelques secondes apres la derniere case cochee ;
 *   - l'export / import reste la, comme filet : il marche sans jeton, et sert
 *     a passer d'un navigateur a l'autre ou a repartir d'une sauvegarde.
 */

import { downloadJson } from "./common.js";

export function createSaveControls(ctx) {
  const note = document.getElementById("dirty-note");
  const fileInput = document.getElementById("import-file");
  const sync = createSyncControls(ctx);

  document.getElementById("export-btn").addEventListener("click", () => {
    downloadJson("collection.json", ctx.collection.toExport("export navigateur"));
  });

  document.getElementById("import-btn").addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const marks = parsed && parsed.marks ? parsed.marks : parsed;
      if (!marks || typeof marks !== "object") throw new Error("format inattendu");
      ctx.collection.replaceLocal(marks);
      ctx.onCollectionChange();
      ctx.sync.schedule("import d'une sauvegarde");
    } catch (error) {
      window.alert(`Import impossible : ${error.message}`);
    }
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    const count = ctx.collection.dirtyCount;
    const message = count
      ? `Effacer les ${count} espèce(s) modifiées dans ce navigateur et revenir à data/collection.json ?`
      : "Revenir à data/collection.json ?";
    if (!window.confirm(message)) return;
    ctx.collection.resetLocal();
    ctx.onCollectionChange();
  });

  return {
    render() {
      const count = ctx.collection.dirtyCount;
      note.hidden = count === 0;
      if (count) {
        note.textContent = ctx.sync.configured
          ? `${count} espèce${count > 1 ? "s" : ""} en attente d'envoi vers le dépôt.`
          : `${count} espèce${count > 1 ? "s" : ""} modifiée${count > 1 ? "s" : ""} dans ce navigateur. ` +
            "Exporte et remplace data/collection.json pour figer ces changements dans le dépôt.";
      }
      sync.render();
    },
  };
}

/* --------------------------- synchronisation ----------------------------- */

/*
 * `off` disait « Hors ligne », ce qui n'a jamais ete son sens : il signifie
 * « aucun jeton enregistre », donc aucune synchronisation configuree. Le vrai
 * hors-ligne, lui, s'appelle desormais `attente` — et confondre les deux
 * aurait laisse croire a une coupure reseau alors qu'il manque un reglage.
 */
const SYNC_LABELS = {
  off: "Pas de synchronisation — les cases restent dans ce navigateur.",
  idle: "Connecté au dépôt.",
  pending: "Modification en attente…",
  busy: "Envoi en cours…",
  attente: "Hors ligne — envoi dès le retour du réseau.",
  ok: "Dépôt à jour.",
  error: "Échec de l'envoi.",
};

function createSyncControls(ctx) {
  const { sync } = ctx;
  const state = document.getElementById("sync-state");
  const setup = document.getElementById("sync-setup");
  const live = document.getElementById("sync-live");
  const tokenInput = document.getElementById("sync-token");

  document.getElementById("sync-connect").addEventListener("click", async () => {
    const token = tokenInput.value;
    tokenInput.value = "";
    if (!token.trim()) return;
    try {
      await sync.connect(token);
      await sync.flush("connexion initiale");
    } catch {
      /* le message d'erreur passe par l'abonnement ci-dessous */
    }
    render();
  });

  document.getElementById("sync-now").addEventListener("click", () => {
    sync.flush("enregistrement manuel").catch(() => {});
  });

  // Recharger : reprendre ce que le depot contient, par exemple apres avoir
  // coche des cases depuis le telephone.
  document.getElementById("sync-pull").addEventListener("click", async () => {
    try {
      const remote = await sync.fetchRemote();
      ctx.collection.commitLocal((remote && remote.marks) || {});
      ctx.onCollectionChange();
      sync.emit("ok", "Collection rechargée depuis le dépôt.");
    } catch {
      /* idem */
    }
  });

  document.getElementById("sync-forget").addEventListener("click", () => {
    if (!window.confirm("Oublier le jeton GitHub dans ce navigateur ?")) return;
    sync.forget();
    render();
  });

  sync.subscribe(() => render());

  function render() {
    const { status, message } = sync.state;
    const connected = sync.configured;
    setup.hidden = connected;
    live.hidden = !connected;
    state.textContent = message || SYNC_LABELS[status] || "";
    state.className = `sync__state sync__state--${status}`;
  }

  render();
  return { render };
}
