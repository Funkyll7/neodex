/**
 * succes-detail.js — la ligne de précision d'un succès.
 *
 * UN MODULE POUR UNE FONCTION, et c'est délibéré. Deux endroits l'affichent —
 * la page des succès et le pop-up d'un cosmétique verrouillé —, et ces deux-là
 * s'importent DÉJÀ l'un l'autre : `ui/page-succes.js` demande la section des
 * récompenses à `ui/recompenses.js`. Poser la fonction dans l'un des deux aurait
 * fermé le cycle, avec la fragilité qui va avec — l'ordre d'évaluation des
 * modules décide alors si la fonction existe au moment où on l'appelle.
 * Un fichier neutre coupe court : les deux le lisent, il ne lit personne.
 *
 * LE DOMAINE REND DES NOMBRES, JAMAIS UNE PHRASE. `domain/succes.js` ne parle
 * aucune langue, et il n'a pas à savoir qu'une région s'écrit « Kalos » ici et
 * « Kalos » là — c'est un hasard qu'elle s'écrive pareil, et le jour où ce n'est
 * plus vrai le domaine n'aura rien à corriger. Il rend donc un objet : quelle
 * génération, combien de cases faites, combien en tout, combien il reste, et le
 * pourcentage. L'assemblage se fait ici.
 */

import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";

/**
 * Ce qu'un succès a de plus à dire que son compte.
 *
 * Rend `null` pour quarante-deux succès sur quarante-trois : seul « Région
 * bouclée » a une précision, parce que son avancement est un pourcentage qui ne
 * disait pas DE QUOI il parlait. « 78 % » se lit tout autrement quand on sait
 * que c'est Kalos et qu'il reste huit cases.
 *
 * @param {Object} s  un succès évalué par `evaluerSucces`
 */
export function precisionDuSucces(s) {
  const d = s && s.detail;
  if (!d || d.quoi !== "region") return null;

  return el(
    "span.succes__precision",
    // Le nom de la région d'abord : c'est la réponse à « laquelle ? », et c'est
    // la question qu'on se pose avant celle du compte.
    el("b.succes__precision-nom", d.region || `${t("Génération")} ${d.gen}`),
    el("span.succes__precision-compte", `${d.fait} / ${d.total} ${t("cases")}`),
    // Ce qui RESTE, et non ce qui est fait : devant un succès à finir, c'est le
    // nombre qu'on cherche. Absent quand il ne reste rien.
    //
    // Le nombre passe DEVANT le mot, et ce n'est pas un choix de style : le
    // français dit « reste 53 » et l'anglais « 53 left ». Un fragment traduit
    // posé avant le nombre aurait donc donné « left 53 ». Mettre le compte en
    // tête laisse le seul mot traduisible en queue, où les deux langues
    // l'acceptent.
    d.reste ? el("span.succes__precision-reste", `${d.reste} ${t("restantes")}`) : null,
    el("span.succes__precision-pct", `${d.pct} %`)
  );
}
