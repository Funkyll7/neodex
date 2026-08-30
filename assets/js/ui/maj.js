/**
 * maj.js — l'onglet des mises à jour.
 *
 * UN ONGLET ET NON UN POP-UP, contrairement au journal des modifications qui
 * lui ressemble. Les deux racontent une histoire, mais pas la même, et on ne
 * les ouvre pas dans le même état d'esprit : le journal répond à « qu'est-ce
 * qui a bougé dans MA collection », question pressée qu'on se pose au retour
 * d'une synchronisation ; celui-ci répond à « qu'est-ce que le site sait faire
 * de plus », qu'on lit posément. Un panneau qu'on parcourt mérite la place
 * d'un onglet, pas les 380 pixels d'une boîte.
 *
 * LES VERSIONS MAJEURES OUVRENT UN CHAPITRE. Douze versions à la file se
 * lisent comme un fichier de log ; quatre chapitres au-dessus de leurs
 * finitions se survolent. C'est la seule hiérarchie de la page, et elle suffit.
 */

import { el, fill } from "../core/dom.js";
import { t, langueCourante } from "../core/i18n.js";
import { VERSIONS, NATURES } from "../domain/maj.js";

/** La date d'une version, écrite en toutes lettres dans la langue du site. */
function dateEcrite(iso) {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(a, m - 1, j).toLocaleDateString(langueCourante(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Une note : sa nature en pastille, son texte à côté. */
function note([nature, texte]) {
  const n = NATURES[nature] || NATURES.amelioration;
  return el(
    "li.maj__note",
    { "--teinte": n.teinte },
    el("span.maj__nature", t(n.nom)),
    el("span.maj__texte", t(texte))
  );
}

/** Une version : son en-tête, son titre, ses notes. */
function version(v) {
  return el(
    "article.maj__version" + (v.majeure ? ".maj__version--majeure" : ""),
    el(
      "header.maj__entete",
      el("span.maj__numero", v.version),
      el(
        "div.maj__identite",
        el("h3.maj__titre", t(v.titre)),
        el("time.maj__date", { dateTime: v.date }, dateEcrite(v.date))
      ),
      // Le mot « majeure » plutôt qu'une simple différence de taille : la
      // hiérarchie doit s'entendre aussi, pas seulement se voir.
      v.majeure ? el("span.maj__jalon", t("Version majeure")) : null
    ),
    el("ul.maj__notes", v.notes.map(note))
  );
}

/**
 * Remplit l'onglet.
 *
 * Appelé à chaque rendu, comme les autres panneaux : les libellés passent par
 * `t()` et doivent suivre la langue. Les données ne bougent jamais, mais les
 * reconstruire coûte une douzaine de nœuds — moins cher que de retenir un état
 * de plus.
 */
export function renderMaj(racine) {
  if (!racine) return;
  fill(
    racine,
    el(
      "div.maj",
      // LE LOGO ENTIER, ET NON CELUI DE L'ONGLET. Ce sont deux fichiers pour
      // un seul dessin : celui-ci garde le mot qu'il porte, illisible à la
      // taille d'une icône mais net à cinquante-six pixels. C'est aussi la
      // seule image de la page, et elle dit de quoi on parle avant la
      // première ligne.
      el(
        "header.maj__tete",
        el("span.maj__logo", { "aria-hidden": "true" }),
        el(
          "p.maj__chapeau",
          t("Ce que le site sait faire de plus, version après version. Les plus marquantes sont signalées.")
        )
      ),
      VERSIONS.map(version)
    )
  );
}
