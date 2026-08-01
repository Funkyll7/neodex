/**
 * save.js — exporter / importer / reinitialiser la collection.
 *
 * Le site est purement statique : rien ne peut ecrire dans le depot depuis le
 * navigateur. Le flux est donc explicite — on coche dans l'interface (stocke en
 * local), on exporte, et on remplace data/collection.json dans le depot.
 */

import { downloadJson } from "./common.js";

export function createSaveControls(ctx) {
  const note = document.getElementById("dirty-note");
  const fileInput = document.getElementById("import-file");

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
        note.textContent =
          `${count} espèce${count > 1 ? "s" : ""} modifiée${count > 1 ? "s" : ""} dans ce navigateur. ` +
          "Exporte et remplace data/collection.json pour figer ces changements dans le dépôt.";
      }
    },
  };
}
