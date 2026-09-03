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
import { autourDUneAdoption } from "./journal.js";
import { sourceAvecAppareil, appareilDistant } from "./source.js";
import { nomDeCetAppareil } from "../core/appareil.js";
// Les messages d'etat sont lus par l'utilisateur : ils suivent la langue. Les
// `reason`, elles, restent en francais — ce sont des messages de commit git,
// ecrits dans l'historique du depot, pas a l'ecran.
import { deuxPoints, t, tn, nomEspece } from "../core/i18n.js";

const API = "https://api.github.com";

/**
 * `keepalive` permet a une requete de survivre a la fermeture de la page, mais
 * la norme plafonne son corps a 64 Ko. On garde une marge : au-dela, la
 * requete serait rejetee d'emblee, ce qui serait pire que le risque qu'elle
 * couvre. Une collection complete tourne autour de 50 Ko encodee.
 */
const KEEPALIVE_MAX_BYTES = 60 * 1024;

/**
 * Ce qui a ecrit le fichier : le site, par opposition a un export manuel
 * (« export navigateur ») ou a un outil. Cette valeur etait ecrite en dur aux
 * deux endroits qui appellent `toExport` ci-dessous ; le nom de l appareil s y
 * ajoute desormais, et une constante evitait d avoir a se souvenir des deux.
 */
const SOURCE_DU_SITE = "site Funkylldex";


/**
 * Ce qu'une synchronisation vient de rapporter, en une phrase.
 *
 * « Mis à jour depuis le dépôt » ne disait pas QUOI, et c'est précisément la
 * question qu'on se pose en rentrant chez soi après avoir coché sur le
 * téléphone. Trois noms au plus, puis un compte : au-delà, la phrase devient
 * une liste qu'on ne lit pas, et le nombre suffit à rassurer.
 *
 * Les décochages sont dits aussi. Décocher sur un autre appareil est une
 * décision comme une autre, mais une phrase qui ne parlerait que des arrivées
 * aurait laissé une disparition passer pour un bug.
 */
export function resumeDuRapport(rapport) {
  const noms = rapport.especes.slice(0, 3).map((e) => (e.espece ? nomEspece(e.espece) : `#${e.id}`));
  const reste = rapport.especes.length - noms.length;
  const liste = reste > 0 ? `${noms.join(", ")} +${reste}` : noms.join(", ");

  const parts = [];
  if (rapport.gagnees) {
    parts.push(`${rapport.gagnees} ${tn(rapport.gagnees, t("case cochée"), t("cases cochées"))}`);
  }
  if (rapport.perdues) {
    parts.push(`${rapport.perdues} ${tn(rapport.perdues, t("case décochée"), t("cases décochées"))}`);
  }
  return `${deuxPoints(t("Mis à jour depuis le dépôt"), parts.join(", "))} — ${liste}`;
}

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
    /** Date de la premiere modification en attente, pour plafonner le delai. */
    this.pendingSince = null;
    this.inFlight = null;
    /** Un envoi a echoue faute de reseau : `reprendre()` s'en chargera. */
    this.enAttenteDeReseau = false;
  }

  /* ------------------------------ abonnement ---------------------------- */

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(status, message = "", rapport = null) {
    // Le RAPPORT voyage avec le message, et non a sa place : le bandeau reste
    // une ligne, mais l interface peut desormais proposer d en voir le detail.
    // Nul quand il n y a rien a detailler — un enregistrement reussi, une
    // erreur —, ce qui laisse tous les appelants existants inchanges.
    this.state = { status, message, rapport, at: new Date() };
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
    this.emit("busy", t("Vérification du jeton…"));
    try {
      // Ce qu on lit ici n est PAS jetable. `fetchRemote` pose `this.sha`, et
      // `write()` ne fusionne le distant que lorsqu il ne connait pas encore de
      // sha : verifier le jeton suffisait donc a court-circuiter cette fusion,
      // et le premier envoi apres la connexion ecrasait le depot — cases comme
      // carnet. On adopte ce qu on vient de lire.
      const distant = await this.fetchRemote();
      autourDUneAdoption(
        this.collection,
        () => this.collection.adopterDistant(distant.marks),
        appareilDistant(distant.source, nomDeCetAppareil())
      );
      this.collection.adopterQuetes(distant.quetes);
    } catch (error) {
      this.token = "";
      this.emit("error", error.message);
      throw error;
    }
    writeToken(this.token);
    this.emit("ok", t("Connecté au dépôt."));

    // Ce qui a ete coche AVANT le jeton part maintenant.
    //
    // On peut se servir du site sans jeton : les cases s'empilent dans le
    // navigateur, c'est meme le mode par defaut. Le jour ou l'on colle enfin
    // un jeton, ces cases-la n'avaient aucune raison d'attendre une
    // modification de plus pour etre envoyees — elles restaient pourtant en
    // rade jusqu'a ce qu'on en coche une nouvelle.
    //
    // `reprendre()` relit d'abord, puis envoie : le depot peut contenir des
    // cases venues d'un autre appareil, la fusion les preserve toutes.
    if (this.collection.dirtyCount) await this.reprendre();
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
    // Le STATUT voyage avec l'erreur, et c'est ce qui sert a decider plus loin.
    // Le message, lui, passe par `t()` : le chemin de fusion apres conflit le
    // testait avec /^Conflit/ et ne se declenchait donc jamais en anglais, ou
    // GitHub repond « Conflict: the file changed in the repository. » — la
    // protection contre la perte des cases d'un autre appareil etait
    // inaccessible a la moitie des langues du site.
    const erreur = new Error(describe(response.status, detail.message));
    erreur.statut = response.status;
    throw erreur;
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
  async push(reason = "mise à jour depuis le site", keepalive = false) {
    if (!this.configured) throw new Error("aucun jeton enregistré");
    // Une seule ecriture a la fois : deux PUT concurrents se voleraient le sha.
    if (this.inFlight) return this.inFlight;
    this.pendingSince = null;
    this.inFlight = this.write(reason, true, keepalive).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async write(reason, retry = true, keepalive = false, marksImposees = null) {
    this.emit("busy", t("Enregistrement sur GitHub…"));
    // QUI ECRIT, en plus de QUOI. Le nom de cet appareil est relu a chaque
    // envoi et non retenu au demarrage : on peut le changer dans les reglages
    // en cours de session, et l envoi suivant doit porter le nouveau. C est la
    // SEULE chose que ce correctif ajoute au chemin d ecriture — une chaine
    // composee, dans un champ qui existait deja. Voir `domain/source.js`.
    const source = sourceAvecAppareil(SOURCE_DU_SITE, nomDeCetAppareil());
    let payload = this.collection.toExport(source, marksImposees);
    const body = {
      message: `Collection : ${reason}`,
      content: encodeBase64(`${JSON.stringify(payload, null, 1)}\n`),
      branch: this.repo.branch,
      ...(this.sha ? { sha: this.sha } : {}),
    };

    try {
      if (!this.sha) {
        // On ne connait pas encore le sha : il faut lire le depot. Mais ce
        // qu'on y lit N'EST PAS jetable — c'est peut-etre ce qu'un autre
        // appareil a coche pendant que celui-ci etait ferme. On l'adopte avant
        // d'ecrire, et on refait le contenu par-dessus la fusion.
        //
        // Sans cela, le PREMIER envoi de chaque chargement de page ecrasait
        // silencieusement ces cases-la : on ne demandait au depot que son sha,
        // et on lui renvoyait notre etat tel quel. Le chemin 409 protegeait les
        // envois SUIVANTS, jamais le premier — celui-ci n'a pas de conflit a
        // resoudre, puisqu'on vient tout juste de lire le sha exact.
        //
        // Sauf quand `marksImposees` est la : la fusion vient d'etre faite par
        // le chemin de conflit, la refaire n'apporterait rien.
        const distant = await this.fetchRemote();
        if (!marksImposees) {
          autourDUneAdoption(
            this.collection,
            () => this.collection.adopterDistant(distant.marks),
            appareilDistant(distant.source, nomDeCetAppareil())
          );
          this.collection.adopterQuetes(distant.quetes);
          payload = this.collection.toExport(source);
          body.content = encodeBase64(`${JSON.stringify(payload, null, 1)}\n`);
        }
      }
      const text = JSON.stringify({ ...body, sha: this.sha });
      const data = await this.call(this.contentsUrl, {
        method: "PUT",
        body: text,
        keepalive: keepalive && withinKeepalive(text),
      });
      this.sha = data.content && data.content.sha;
      // `adopterDistant` et non `commitLocal`, alors que c'est bien nous qui
      // venons d'ecrire. La raison est une course : l'instantane `payload` est
      // pris AVANT le PUT, qui dure le temps d'un aller-retour reseau. Une case
      // cochee pendant ce vol se trouve dans la couche locale mais pas dans
      // `payload.marks` — et `commitLocal` vidait la couche entiere, donc cette
      // case avec. Une seconde de fenetre, mais deterministe : cocher vite
      // pendant un enregistrement suffisait.
      //
      // `adopterDistant` prend ce qu'on vient d'ecrire pour nouvel ancetre et
      // ne garde en attente que ce qui l'en ecarte. Quand rien n'a bouge
      // pendant le vol, il ne reste rien : le comportement est exactement celui
      // de `commitLocal`, sans le trou.
      // PAS DE JOURNAL ICI, et c est le deuxieme essai. Le premier relevait a
      // cet endroit ce qu on envoyait, sous le nom d envoi. Ca ne notait rien
      // pour qui n a pas configure la synchronisation — c est-a-dire que le
      // journal restait vide a jamais alors que le site marche tres bien sans
      // depot. Les modifications locales sont desormais relevees par
      // `domain/journal.js`, a la source, salve par salve : ce qui passe ici
      // est donc deja note, et le renoter ferait double emploi.
      this.collection.adopterDistant(payload.marks);
      // Le carnet suit le meme acquittement : ce qu on vient d ecrire devient ce
      // que le depot contient. La jointure etant idempotente, ceci ne peut pas
      // creer d ecart — c est ce qui garantit qu on ne replanifie pas sans fin.
      this.collection.adopterQuetes(payload.quetes);
      this.emit("ok", t("Enregistré dans le dépôt."));
      // Reste-t-il quelque chose ? Alors c'est qu'une case est arrivee pendant
      // le vol, et personne ne la renverrait avant la prochaine bascule.
      if (this.collection.dirtyCount || this.collection.quetesEnAttente) {
        this.schedule("suite de l'enregistrement");
      }
      return data;
    } catch (error) {
      // 409 / 422 : le fichier a bouge depuis notre derniere lecture — un autre
      // appareil a coche quelque chose. On relit, on FUSIONNE, et on recommence
      // une fois. Une 404, elle, ne se repare pas.
      //
      // Reecrire l'etat local tel quel, comme on le faisait, effacait ce que
      // l'autre appareil venait d'ajouter : cocher sur le telephone puis laisser
      // le navigateur enregistrer suffisait a perdre la case.
      if (retry && (error.statut === 409 || error.statut === 422)) {
        this.emit("busy", t("Fusion avec le dépôt…"));
        const distant = await this.fetchRemote();
        const fusionne = this.collection.fusionnerAvec(distant.marks);
        // Le CARNET aussi, et il manquait. La reecriture repartait avec notre
        // carnet seul : les chasses comptees sur l autre appareil etaient
        // effacees du depot, et l acquittement qui suit les declarait envoyees,
        // donc rien ne les rattrapait jamais. La jointure est idempotente, la
        // rejouer ici ne coute rien et ne peut rien casser.
        this.collection.adopterQuetes(distant.quetes);
        return this.write(reason, false, false, fusionne);
      }
      // Hors ligne, ce n'est pas une erreur : c'est le cas normal du site. On
      // coche des cases dans le train, en salle d'attente, au fond d'un magasin.
      // Les modifications restent dans le navigateur, et `attendreLeReseau()`
      // les enverra des que la connexion revient. Le dire calmement evite
      // d'alarmer pour quelque chose qui va se resoudre tout seul.
      if (horsLigne(error)) {
        this.enAttenteDeReseau = true;
        this.emit("attente", t("Hors ligne — envoi dès le retour du réseau."));
        return null;
      }

      this.emit("error", error.message);
      throw error;
    }
  }

  /**
   * Renvoie ce qui attend, des que le reseau revient.
   *
   * On relit AVANT d'ecrire : pendant la coupure, un autre appareil a pu
   * enregistrer. Relire d'abord fusionne sans passer par un conflit, et evite
   * un aller-retour.
   *
   * @returns {Promise<boolean>} vrai si quelque chose a ete envoye ou relu.
   */
  async reprendre() {
    if (!this.configured) return false;
    this.enAttenteDeReseau = false;
    let change = false;
    try {
      change = await this.relire();
    } catch {
      // Le reseau vient a peine de revenir : s'il retombe, on retentera au
      // prochain retour. Rien de perdu, tout est encore dans le navigateur.
    }
    if (this.collection.dirtyCount) {
      await this.flush("retour du réseau").catch(() => {});
      return true;
    }
    return change;
  }

  /**
   * Relit le depot et absorbe ce qui a ete coche ailleurs.
   *
   * Sans cela, un onglet reste ouvert ignore tout des cases cochees sur le
   * telephone jusqu'a son prochain rechargement — et les affiche donc a tort
   * comme manquantes.
   *
   * @returns {Promise<boolean>} vrai si l'affichage doit etre refait.
   */
  async relire() {
    if (!this.configured || this.inFlight) return false;
    const shaConnu = this.sha;
    const distant = await this.fetchRemote();
    // Meme sha : le depot n'a pas bouge, rien a faire. On evite ainsi de
    // reconstruire la grille a chaque retour sur l'onglet.
    if (shaConnu && shaConnu === this.sha) return false;

    // `adopterDistant` et non `commitLocal` : le depot ne contient pas encore
    // ce qui est coche ici, vider la couche locale le perdrait.
    //
    // ET D OU CA VIENT : le fichier qu on vient de lire porte, dans son champ
    // `source`, le nom de l appareil qui l a ecrit. C est le chemin par lequel
    // « Recu d un autre appareil » devient « Recu de : telephone de Kyllian ».
    // Un fichier ecrit par une version anterieure, ou par un appareil sans nom,
    // rend `null` ici — et l entree garde alors l ancien libelle.
    const rapport = autourDUneAdoption(
      this.collection,
      () => this.collection.adopterDistant(distant.marks),
      appareilDistant(distant.source, nomDeCetAppareil())
    );
    this.collection.adopterQuetes(distant.quetes);
    if (rapport) this.emit("ok", resumeDuRapport(rapport), rapport);
    return rapport;
  }

  /**
   * Ecriture differee : on attend que l'utilisateur ait fini de cocher.
   * Sans cela, cocher dix cases ferait dix commits.
   */
  schedule(reason) {
    if (!this.configured) return;
    clearTimeout(this.timer);
    this.emit("pending", t("Modification en attente…"));
    if (this.pendingSince === null) this.pendingSince = Date.now();
    // Plafond : sans lui, cocher une case toutes les trois secondes repousse
    // le minuteur indefiniment et rien ne part jamais. Passe `maxDelayMs`
    // depuis la premiere modification en attente, on ecrit sans discuter.
    const waited = Date.now() - this.pendingSince;
    const delay = Math.max(0, Math.min(CONFIG.github.delayMs, CONFIG.github.maxDelayMs - waited));
    this.timer = setTimeout(() => {
      this.push(reason).catch(() => {
        /* l'etat d'erreur est deja diffuse par write() */
      });
    }, delay);
  }

  /**
   * Force l'ecriture immediate (bouton, ou fermeture de l'onglet).
   * @param {boolean} [keepalive]  laisser la requete survivre au demontage de
   *   la page — indispensable quand on quitte l'onglet sur telephone.
   */
  flush(reason = "mise à jour depuis le site", keepalive = false) {
    clearTimeout(this.timer);
    return this.push(reason, keepalive);
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

/**
 * Le corps tient-il sous le plafond `keepalive` ? Au-dela, on renonce a
 * l'option plutot que de voir la requete refusee : l'envoi redevient
 * ordinaire, donc vulnerable a la fermeture de l'onglet, mais il part.
 */
function withinKeepalive(text) {
  const size = new TextEncoder().encode(text).length;
  if (size <= KEEPALIVE_MAX_BYTES) return true;
  console.warn(
    `Funkylldex : collection trop volumineuse (${Math.round(size / 1024)} Ko) pour un envoi ` +
      "`keepalive`. L'écriture en quittant l'onglet peut être perdue — synchronise " +
      "explicitement avant de fermer."
  );
  return false;
}

/**
 * L'echec vient-il d'une coupure reseau, et non du depot ?
 *
 * `fetch` rejette avec un `TypeError` quand la requete ne part pas — pas de
 * reseau, DNS injoignable, requete avortee. Les reponses de GitHub, elles,
 * passent par `describe()` et portent un message francais. On distingue donc
 * sur les deux : ce que le navigateur n'a pas pu envoyer, et ce que le serveur
 * a refuse. Seul le premier vaut la peine d'etre retente tout seul.
 */
function horsLigne(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError;
}

/** Messages d'erreur orientes « quoi faire », dans la langue affichee. */
function describe(status, message) {
  if (status === 401) return t("Jeton refusé : il est invalide ou a expiré.");
  if (status === 403) return t("Accès refusé : le jeton n'a pas le droit d'écriture sur ce dépôt.");
  if (status === 404) return t("Fichier introuvable : vérifie le dépôt, la branche et le chemin.");
  if (status === 409 || status === 422) return t("Conflit : le fichier a changé dans le dépôt.");
  // Le message vient de GitHub, donc en anglais quoi qu'il arrive : seule
  // l'amorce se traduit.
  return message ? `${t("GitHub a répondu :")} ${message}` : `${t("GitHub a répondu")} ${status}.`;
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
