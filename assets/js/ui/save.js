/**
 * save.js — synchronisation GitHub, export, import, reinitialisation.
 *
 * Deux facons de figer la collection dans le depot :
 *   - la synchronisation (domain/sync.js) ecrit data/collection.json toute
 *     seule, quelques secondes apres la derniere case cochee ;
 *   - l'export / import reste la, comme filet : il marche sans jeton, et sert
 *     a passer d'un navigateur a l'autre ou a repartir d'une sauvegarde.
 */

import { t, tn } from "../core/i18n.js";
import { resumeDuRapport } from "../domain/sync.js";
import { progressOf } from "../domain/progress.js";
import { downloadJson } from "./common.js";
import { el } from "../core/dom.js";

export function createSaveControls(ctx) {
  const note = document.getElementById("dirty-note");
  const fileInput = document.getElementById("import-file");
  const sync = createSyncControls(ctx);

  document.getElementById("export-btn").addEventListener("click", () => {
    downloadJson("collection.json", ctx.collection.toExport("export navigateur"));
  });

  document.getElementById("import-btn").addEventListener("click", () => fileInput.click());

  // Le partage doit partir du geste lui-meme : `navigator.share` refuse tout
  // appel qui ne descend pas directement d'un clic.
  document.getElementById("summary-btn").addEventListener("click", () => {
    partagerResume(ctx);
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const marks = parsed && parsed.marks ? parsed.marks : parsed;
      if (!marks || typeof marks !== "object") throw new Error(t("format inattendu"));
      ctx.collection.replaceLocal(marks);
      ctx.onCollectionChange();
      ctx.sync.schedule("import d'une sauvegarde");
    } catch (error) {
      window.alert(`${t("Import impossible")} : ${error.message}`);
    }
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    const count = ctx.collection.dirtyCount;
    const message = count
      ? `${t("Effacer les")} ${count} ${t("espèce(s) modifiées dans ce navigateur et revenir à data/collection.json ?")}`
      : t("Revenir à data/collection.json ?");
    if (!window.confirm(message)) return;
    ctx.collection.resetLocal();
    ctx.onCollectionChange();
  });

  return {
    render() {
      const count = ctx.collection.dirtyCount;
      note.hidden = count === 0;
      if (count) {
        // Le pluriel ne se decoupe pas en « espèce » + « s » : « s » seul n'est
        // pas une chaine traduisible. Chaque forme est donc une phrase entiere,
        // et c'est `tn()` qui choisit entre les deux — un `count > 1` ecrit ici
        // coderait en dur la regle francaise, celle-la meme que `tn()` existe
        // pour ne pas figer.
        note.textContent = ctx.sync.configured
          ? `${count} ${tn(
              count,
              "espèce en attente d'envoi vers le dépôt.",
              "espèces en attente d'envoi vers le dépôt.",
            )}`
          : `${count} ${tn(
              count,
              "espèce modifiée dans ce navigateur.",
              "espèces modifiées dans ce navigateur.",
            )} ` + t("Exporte et remplace data/collection.json pour figer ces changements dans le dépôt.");
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
      // `adopterDistant` et non `commitLocal`, pour la raison que `collection.js`
      // ecrit noir sur blanc au-dessus des deux methodes : `commitLocal` vide la
      // couche locale parce qu'apres un ENVOI reussi le depot la contient. Ici
      // le depot ne contient pas ce qui attend d'etre envoye — le vider le
      // perdait, sans confirmation et sans recours, « Annuler » ne rejouant que
      // des bascules dont l'etat de depart a disparu.
      //
      // Et le piege etait le plus naturel possible : « Recharger » est le bouton
      // d'a cote d'« Enregistrer », donc le reflexe juste apres un echec
      // d'envoi — c'est-a-dire exactement quand la couche locale porte tout ce
      // qui n'a pas pu partir. `sync.js` faisait deja le bon appel, ici seul.
      const rapport = ctx.collection.adopterDistant((remote && remote.marks) || {});
      ctx.onCollectionChange();
      // Le rapport dit CE QUI est arrive. « Collection rechargee » laissait
      // l'utilisateur verifier lui-meme si quelque chose avait bouge, ce qui
      // est exactement la question a laquelle le bouton devait repondre.
      sync.emit("ok", rapport ? resumeDuRapport(rapport) : t("Collection déjà à jour."));
    } catch {
      /* idem */
    }
  });

  document.getElementById("sync-forget").addEventListener("click", () => {
    if (!window.confirm(t("Oublier le jeton GitHub dans ce navigateur ?"))) return;
    sync.forget();
    render();
  });

  sync.subscribe(() => render());

  function render() {
    const { status, message } = sync.state;
    const connected = sync.configured;
    setup.hidden = connected;
    live.hidden = !connected;
    // SYNC_LABELS est evalue une seule fois a l'import : le tableau reste en
    // francais et la traduction se fait ici, a chaque affichage. `message`, lui,
    // arrive deja traduit de son point d'emission — le re-traduire n'aurait
    // rien trouve.
    const libelle = SYNC_LABELS[status];
    state.textContent = message || (libelle ? t(libelle) : "");
    state.className = `sync__state sync__state--${status}`;
  }

  render();
  return { render };
}

/**
 * Le résumé : ce qu'on AFFICHE, et ce qu'on PARTAGE.
 *
 * Les deux ne peuvent pas être la même chose. Le texte partagé doit tenir dans
 * un message, donc être plat ; l'affichage doit se lire d'un coup d'œil, donc
 * être aligné. Un seul bloc de texte servant aux deux donnait ce qu'on a vu :
 * quatre lignes entassées, dont « 30 / 102 paires ♂ / ♀ » qui se coupait en
 * plein milieu du symbole.
 */
function resumeDeLaCollection(ctx) {
  const { dataset, collection } = ctx;
  const p = progressOf(dataset.species, collection);

  // Les générations les plus en retard, et non les premières par numéro : ce
  // qu'on montre, c'est où l'on en est, et la ligne intéressante est celle qui
  // traîne.
  const retard = Object.entries(p.gens || {})
    .filter(([, v]) => v.total)
    .sort((a, b) => a[1].pct - b[1].pct)
    .slice(0, 3)
    .map(([numero, v]) => {
      const meta = dataset.generations[numero];
      const nom = meta && meta.region ? t(meta.region) : `${t("Génération")} ${numero}`;
      return `${nom} ${v.pct} %`;
    });

  const lignes = [
    { cle: t("Cases cochées"), valeur: `${p.all.done} / ${p.all.total}` },
    { cle: t("Chromatiques"), valeur: String(p.shiny.done) },
    { cle: t("Paires ♂ / ♀"), valeur: `${p.pairs.done} / ${p.pairs.total}` },
  ];

  const texte = [
    `Funkylldex — ${t("ma collection")}`,
    `${p.all.pct} % · ${p.all.done} / ${p.all.total} ${t("cases cochées")}`,
    `${p.shiny.done} ${tn(p.shiny.done, t("chromatique"), t("chromatiques"))} · ` +
      `${p.pairs.done} / ${p.pairs.total} ${tn(p.pairs.total, t("paire ♂ / ♀"), t("paires ♂ / ♀"))}`,
    retard.length ? `${t("Reste à faire")} : ${retard.join(" · ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { pct: p.all.pct, lignes, retard, texte };
}

/**
 * Partage le résumé, ou le copie à défaut.
 *
 * Le bandeau est posé AVANT toute tentative : « Copié » sans dire quoi oblige à
 * aller coller ailleurs pour savoir ce qu'on partage, et sur un ordinateur sans
 * `navigator.share` ni presse-papiers autorisé, le bouton n'avait aucun effet
 * visible du tout.
 *
 * `navigator.share` d'abord : sur téléphone il ouvre le menu du système, qui est
 * là où l'on partage vraiment. Il refuse tout appel qui ne descend pas d'un
 * geste de l'utilisateur, d'où l'appel sans `await` avant lui.
 */
async function partagerResume(ctx) {
  const resume = resumeDeLaCollection(ctx);
  const suite = afficherResume(resume);
  try {
    if (navigator.share) {
      await navigator.share({ text: resume.texte });
      suite(t("Partagé."));
      return;
    }
    await navigator.clipboard.writeText(resume.texte);
    suite(t("Copié dans le presse-papiers."));
  } catch (error) {
    // Fermer le menu de partage lève un `AbortError` : ce n'est pas un échec,
    // c'est un renoncement.
    if (error && error.name === "AbortError") {
      suite(t("Partage annulé."));
      return;
    }
    suite(t("Sélectionnez le texte pour le copier."));
  }
}

/** Pose le bandeau et rend de quoi en changer la dernière ligne. */
function afficherResume(resume) {
  document.querySelector(".resume-bandeau")?.remove();
  const suite = el("span.bandeau__suite");

  const bandeau = el(
    "div.resume-bandeau",
    { role: "status", "aria-live": "polite" },
    el("span.bandeau__titre", t("Ma collection")),
    el("p.resume__pct", String(resume.pct), el("span", "%")),
    el(
      "div.resume__lignes",
      resume.lignes.flatMap((l) => [
        el("span.resume__cle", l.cle),
        el("span.resume__valeur", l.valeur),
      ])
    ),
    resume.retard.length
      ? el("p.resume__reste", `${t("Reste à faire")} : ${resume.retard.join(" · ")}`)
      : null,
    suite
  );
  document.body.append(bandeau);
  setTimeout(() => bandeau.remove(), 12000);
  return (message) => {
    suite.textContent = message;
  };
}
