/**
 * historique.js — la collection telle qu'elle était, mois après mois.
 *
 * Le site sait dire où l'on en est ; il ne savait pas dire d'où l'on vient.
 * Or l'information existe déjà, et depuis toujours : chaque synchronisation
 * écrit `data/collection.json` dans le dépôt, donc l'historique git EST la
 * courbe. Il n'y a rien à enregistrer, rien à migrer, et rien qui puisse se
 * désynchroniser de la collection — c'est la collection, à des dates passées.
 *
 * POURQUOI ON ÉCHANTILLONNE.
 *
 * Un compte exact demande de LIRE chaque version : l'API donne bien la liste
 * des commits d'un fichier, mais aucun ne porte le nombre de cases qu'il
 * contient. Il faut donc les télécharger. Le fichier fait quarante kilo-octets,
 * et une collection active accumule plusieurs commits par jour : sur un an, ce
 * serait des centaines de requêtes et des dizaines de mégaoctets pour tracer
 * une ligne.
 *
 * On prend donc UN commit par pas de temps, au plus `POINTS` en tout. Une
 * courbe de progression n'a pas besoin de la minute près — elle a besoin de sa
 * forme, et vingt points la donnent aussi bien que trois cents.
 *
 * POURQUOI ON GARDE LE RÉSULTAT.
 *
 * L'histoire ancienne ne change jamais : un commit d'il y a six mois contiendra
 * toujours le même nombre de cases. Le relevé est donc rangé dans les
 * préférences locales, clé par clé de commit, et une seconde ouverture ne
 * retélécharge que ce qui est arrivé depuis. C'est ce qui rend la courbe
 * gratuite après la première fois.
 *
 * Ce module ne touche pas au DOM.
 */

import { CONFIG } from "../config.js";
import { lirePrefs, ecrirePrefs } from "../core/prefs.js";

const API = "https://api.github.com";

/** Nombre de points tracés. Vingt suffisent à donner la forme d'une courbe. */
const POINTS = 20;

/** Le relevé déjà fait, par sha de commit. */
function cache() {
  const brut = lirePrefs().historique;
  return brut && typeof brut === "object" ? brut : {};
}

function retenir(sha, point) {
  const prefs = lirePrefs();
  ecrirePrefs({ ...prefs, historique: { ...(prefs.historique || {}), [sha]: point } });
}

/**
 * Compte les cases d'un export.
 *
 * La case réservée « hors d'atteinte » n'en est pas une : la compter aurait
 * fait monter la courbe quand on met une espèce de côté, c'est-à-dire
 * exactement au moment où l'on renonce à elle.
 */
function compter(collection) {
  const marks = (collection && collection.marks) || {};
  let cases = 0;
  let especes = 0;
  for (const slots of Object.values(marks)) {
    if (!slots || typeof slots !== "object") continue;
    const n = Object.keys(slots).filter((s) => s !== "hors").length;
    if (!n) continue;
    cases += n;
    especes += 1;
  }
  return { cases, especes };
}

/**
 * Choisit les commits à lire.
 *
 * Un par tranche de temps, et non un sur N : les synchronisations ne sont pas
 * réparties régulièrement — une journée de pointage en produit trente, puis
 * plus rien pendant trois semaines. Un pas fixe aurait donc mis quinze points
 * dans la même journée et aucun sur le mois suivant.
 *
 * Le premier et le DERNIER sont toujours gardés : la courbe doit commencer au
 * début et finir à aujourd'hui, quelles que soient les tranches.
 */
function echantillonner(commits) {
  if (commits.length <= POINTS) return commits;

  const debut = new Date(commits[0].date).getTime();
  const fin = new Date(commits[commits.length - 1].date).getTime();
  const pas = (fin - debut) / (POINTS - 1) || 1;

  const gardes = [];
  let prochain = debut;
  for (const commit of commits) {
    const t = new Date(commit.date).getTime();
    if (t >= prochain) {
      gardes.push(commit);
      prochain = t + pas;
    }
  }
  const dernier = commits[commits.length - 1];
  if (gardes[gardes.length - 1] !== dernier) gardes.push(dernier);
  return gardes;
}

/**
 * La courbe, du plus ancien au plus récent.
 *
 * @param {GitHubSync} sync   pour son `call()`, qui porte le jeton
 * @param {(fait: number, total: number) => void} [avancement]  appelé à chaque
 *   version lue : la première fois, l'attente se compte en secondes, et une
 *   barre vaut mieux qu'un écran figé.
 * @returns {Promise<{date: string, cases: number, especes: number}[]>}
 */
export async function chargerHistorique(sync, avancement = () => {}) {
  const { owner, repo, path } = CONFIG.github;

  // 100 est le maximum d'une page, et c'est assez : au-delà, l'échantillonnage
  // aurait de toute façon jeté l'essentiel. On prend donc les cent derniers
  // commits du fichier, et la courbe commence là où ils commencent.
  const liste = await sync.call(
    `${API}/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=100`
  );

  // L'API rend du plus récent au plus ancien ; une courbe se lit dans l'autre
  // sens.
  const commits = liste
    .map((c) => ({ sha: c.sha, date: c.commit && c.commit.committer && c.commit.committer.date }))
    .filter((c) => c.sha && c.date)
    .reverse();

  if (!commits.length) return [];

  const choisis = echantillonner(commits);
  const connus = cache();
  const points = [];

  for (const [i, commit] of choisis.entries()) {
    avancement(i, choisis.length);

    if (connus[commit.sha]) {
      points.push({ date: commit.date, ...connus[commit.sha] });
      continue;
    }
    // `Accept: raw` évite le base64 : l'API rend sinon le fichier encodé, qu'il
    // faudrait décoder pour rien — et quarante kilo-octets en base64 en font
    // cinquante-trois.
    const contenu = await sync.call(
      `${API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${commit.sha}`,
      { headers: { Accept: "application/vnd.github.raw+json" } }
    );
    const compte = compter(contenu);
    retenir(commit.sha, compte);
    points.push({ date: commit.date, ...compte });
  }

  avancement(choisis.length, choisis.length);
  return points;
}
