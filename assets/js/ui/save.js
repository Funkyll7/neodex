/**
 * save.js — synchronisation GitHub, export, import, reinitialisation.
 *
 * Deux facons de figer la collection dans le depot :
 *   - la synchronisation (domain/sync.js) ecrit data/collection.json toute
 *     seule, quelques secondes apres la derniere case cochee ;
 *   - l'export / import reste la, comme filet : il marche sans jeton, et sert
 *     a passer d'un navigateur a l'autre ou a repartir d'une sauvegarde.
 */

import { deuxPoints, t, tn } from "../core/i18n.js";
import { resumeDuRapport } from "../domain/sync.js";
import { downloadJson } from "./common.js";
import { jouer } from "./sons.js";
import { ouvrirCartePartage } from "./carte-partage.js";

export function createSaveControls(ctx) {
  const note = document.getElementById("dirty-note");
  const fileInput = document.getElementById("import-file");
  const sync = createSyncControls(ctx);

  document.getElementById("export-btn").addEventListener("click", () => {
    downloadJson("collection.json", ctx.collection.toExport("export navigateur"));
  });

  document.getElementById("import-btn").addEventListener("click", () => fileInput.click());

  // Le partage ne part PLUS du geste lui-même, et c'est voulu. `navigator.share`
  // refuse tout appel qui ne descend pas directement d'un clic — l'ancien code
  // devait donc partager à l'aveugle, sans jamais montrer ce qu'il envoyait. Ce
  // clic-ci ne fait qu'ouvrir le panneau ; le partage système est déclenché par
  // le bouton qui s'y trouve, qui est lui aussi un vrai clic.
  document.getElementById("summary-btn").addEventListener("click", () => {
    ouvrirCartePartage(ctx);
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
      // Le CARNET aussi. L export l ecrit, l import ne le relisait pas : sans
      // jeton — le cas que l en-tete de ce fichier designe comme le principal,
      // passer d un navigateur a l autre — des centaines de rencontres
      // comptees disparaissaient a la restauration, sans un message.
      //
      // `adopterQuetes` et non un remplacement : c est une jointure, donc ce
      // qui est deja la survit. Importer une vieille sauvegarde n efface pas
      // les chasses commencees depuis.
      if (parsed && parsed.quetes) ctx.collection.adopterQuetes(parsed.quetes);
      ctx.onCollectionChange();
      ctx.sync.schedule("import d'une sauvegarde");
    } catch (error) {
      window.alert(deuxPoints(t("Import impossible"), error.message));
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
            )}${attenteEnClair(ctx.sync)}`
          : `${count} ${tn(
              count,
              "espèce modifiée dans ce navigateur.",
              "espèces modifiées dans ce navigateur.",
            )} ` + t("Exporte et remplace data/collection.json pour figer ces changements dans le dépôt.");

        // LE TON MONTE quand l'attente devient anormale. La note est dorée par
        // défaut, du même or que le reste du site : elle se lit comme une
        // information, ce qu'elle est tant que l'envoi suit dans les secondes.
        //
        // Deux cas où ce n'en est plus une. SANS JETON, passé une trentaine
        // d'espèces, tout ce travail ne vit que dans ce navigateur — un
        // nettoyage de données, un autre appareil, et il n'existe plus.
        // AVEC JETON, une attente de plus de cinq minutes veut dire que
        // l'écriture ne passe pas : hors ligne, jeton périmé, dépôt renommé.
        // Dans les deux cas le doré ne suffit plus.
        const urgent = ctx.sync.configured
          ? minutesDAttente(ctx.sync) >= 5
          : count >= 30;
        note.classList.toggle("dirty-note--urgent", urgent);
      }
      sync.render();
    },
  };
}

/**
 * Depuis combien de minutes quelque chose attend d'être envoyé.
 *
 * `pendingSince` est posé au premier changement et remis à `null` dès qu'une
 * écriture part. Zéro quand rien n'attend — l'appelant n'a donc pas à distinguer
 * les deux cas.
 */
function minutesDAttente(sync) {
  if (!sync.pendingSince) return 0;
  return Math.floor((Date.now() - sync.pendingSince) / 60000);
}

/**
 * « depuis 7 minutes », ou rien du tout.
 *
 * En dessous d'une minute on ne dit pas la durée : l'envoi part au bout de
 * quelques secondes, et afficher « depuis 0 minute » ferait croire à un blocage
 * là où tout se passe normalement.
 */
function attenteEnClair(sync) {
  const minutes = minutesDAttente(sync);
  if (minutes < 1) return "";
  return ` ${t("En attente depuis")} ${minutes} ${tn(minutes, "minute", "minutes")}.`;
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

  // Un son sur l issue d une synchronisation, et sur elle seule : « busy » et
  // « attente » passent en silence, sinon chaque enregistrement automatique se
  // serait annonce deux fois.
  let dernierStatut = null;
  sync.subscribe((etat) => {
    if (etat.status !== dernierStatut) {
      if (etat.status === "ok") jouer("synchro");
      else if (etat.status === "error") jouer("erreur");
      dernierStatut = etat.status;
    }
    render();
  });

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

