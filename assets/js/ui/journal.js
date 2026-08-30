/**
 * journal.js — l'historique des modifications, en panneau.
 *
 * IL RÉPOND À UNE QUESTION QUE RIEN D'AUTRE NE POSAIT : « qu'est-ce qui a bougé
 * dans ma collection, et quand ? » Le bandeau de synchronisation le dit pour le
 * dernier évènement et l'oublie aussitôt ; le dépôt garde bien un commit par
 * envoi, mais il faut aller sur GitHub, et les messages y disent « Collection :
 * case cochée », jamais laquelle.
 *
 * DEUX SENS, ET LA DISTINCTION COMPTE. Ce que j'ai coché ici, et ce qu'un autre
 * appareil a fait pendant ce temps. C'est le second qui surprend, et c'est pour
 * lui qu'on ouvre ce panneau — d'où la flèche, la couleur et le libellé qui les
 * séparent d'un coup d'œil.
 *
 * Un troisième sens traîne, « envoi », et il n'est plus jamais produit : les
 * entrées écrites par une version antérieure le portent, et elles décrivaient
 * exactement ce que « local » décrit aujourd'hui. Elles se lisent donc comme du
 * local, avec leur ancien libellé.
 *
 * LES JOURS PORTENT UN NOM tant qu'ils en ont un. « Aujourd'hui » et « Hier »
 * se lisent sans calcul ; au-delà, la date complète, dans la langue du site.
 * Une liste d'horodatages bruts se relit à la calculette.
 */

import { el, fill } from "../core/dom.js";
import { t, langueCourante } from "../core/i18n.js";
import { lireJournal, viderJournal, parJour } from "../domain/journal.js";
import { ouvrirPopup } from "./popup.js";
import { ligneEspece } from "./changements.js";

/**
 * Le nom du jour : « Aujourd'hui », « Hier », ou la date écrite.
 *
 * La comparaison porte sur la DATE LOCALE et non sur un écart en heures :
 * hier 23 h et aujourd'hui 1 h sont séparés de deux heures et pourtant de deux
 * jours, et c'est bien « Hier » qu'il faut lire.
 */
function nomDuJour(jour, aujourdhui) {
  const meme = (a, b) => a.toDateString() === b.toDateString();
  if (meme(jour, aujourdhui)) return t("Aujourd'hui");
  const hier = new Date(aujourdhui);
  hier.setDate(hier.getDate() - 1);
  if (meme(jour, hier)) return t("Hier");
  return jour.toLocaleDateString(langueCourante(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(jour.getFullYear() === aujourdhui.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** L'heure d'une entrée, sans les secondes : la minute suffit à s'y retrouver. */
function heure(at) {
  return new Date(at).toLocaleTimeString(langueCourante(), { hour: "2-digit", minute: "2-digit" });
}

/** Une entrée : son heure, son sens, son compte, et le détail de ses espèces. */
function bloc(entree, dataset) {
  const recu = entree.sens === "reception";
  // Trois sens depuis que les modifications locales sont relevees a la source :
  // ce que j ai coche ici, ce qui est arrive du depot. L ancien « envoi » ne
  // sert plus qu aux entrees deja ecrites par une version precedente, et il se
  // lit comme du local — c est bien ce qu il etait.
  const fleche = recu ? "↓" : "✓";
  const libelle = recu
    ? t("Reçu d'un autre appareil")
    : entree.sens === "envoi"
      ? t("Envoyé au dépôt")
      : t("Coché sur cet appareil");
  const comptes = [];
  if (entree.gagnees) comptes.push(`+${entree.gagnees}`);
  if (entree.perdues) comptes.push(`−${entree.perdues}`);

  return el(
    "details.jrn__entree" + (recu ? ".jrn__entree--recu" : ""),
    // OUVERTE SI ELLE EST COURTE, repliée sinon. Une entrée de deux espèces se
    // lit d'un coup et se replier serait un clic pour rien ; une de quarante
    // noierait les autres. Le seuil est bas exprès — on parcourt une liste, on
    // ne la lit pas.
    { open: entree.especes.length <= 3 },
    el(
      "summary.jrn__somme",
      el("span.jrn__fleche", { "aria-hidden": "true" }, fleche),
      el(
        "span.jrn__quoi",
        el("span.jrn__sens", libelle),
        el("span.jrn__heure", heure(entree.at))
      ),
      el(
        "span.jrn__comptes",
        comptes.map((c) =>
          el("span.jrn__compte" + (c.startsWith("+") ? ".jrn__compte--plus" : ".jrn__compte--moins"), c)
        )
      )
    ),
    el(
      "div.jrn__detail",
      entree.especes.map((e) =>
        // Le journal ne garde que des NUMÉROS — voir `domain/journal.js` —, on
        // rend donc l'espèce au moment de l'afficher. Absente du jeu de
        // données (une entrée d'une version plus ancienne, un numéro retiré),
        // `ligneEspece` retombe sur le numéro seul.
        ligneEspece({
          id: e.id,
          espece: dataset ? dataset.byId.get(e.id) : null,
          gagnees: e.g || [],
          perdues: e.p || [],
        })
      ),
      entree.coupees
        ? el("p.jrn__coupees", `+ ${entree.coupees} ${t("espèces non détaillées")}`)
        : null
    )
  );
}

/**
 * Ouvre le journal.
 *
 * @param {Object} dataset  pour retrouver les espèces à partir de leur numéro
 * @param {number} maintenant  l'heure de référence, pour « Aujourd'hui »
 */
export function ouvrirJournal(dataset, maintenant = Date.now()) {
  const aujourdhui = new Date(maintenant);

  const corps = el("div.jrn");
  const peindre = () => {
    const journal = lireJournal();
    if (!journal.length) {
      fill(
        corps,
        el(
          "p.jrn__vide",
          // Le texte disait « à chaque envoi vers le dépôt », ce qui était vrai
          // une heure et faux ensuite : le journal se remplit maintenant dès
          // qu'on coche, dépôt ou pas. Le laisser aurait promis le contraire de
          // ce qui se passe à qui n'a pas configuré la synchronisation.
          t("Rien pour l'instant. Ce journal se remplit dès que tu coches une case, et à chaque changement venu d'un autre appareil.")
        )
      );
      return;
    }

    const jours = parJour(journal);
    fill(
      corps,
      el(
        "p.jrn__resume",
        `${journal.length} ${t("modifications")} · ${jours.length} ${t("jours")}`,
        el("button.jrn__vider", {
          type: "button",
          textContent: t("Vider"),
          // Pas de confirmation : le journal ne contient AUCUNE case, seulement
          // le souvenir de leur passage. L'effacer ne perd rien de la
          // collection, et une boîte de dialogue pour ça se lirait comme un
          // avertissement qu'il n'y a pas lieu de donner.
          onclick: () => {
            viderJournal();
            peindre();
          },
        })
      ),
      jours.map((groupe) =>
        el(
          "section.jrn__jour",
          el(
            "h4.jrn__titre",
            el("span.jrn__nom-jour", nomDuJour(groupe.jour, aujourdhui)),
            el("span.jrn__compte-jour", String(groupe.entrees.length))
          ),
          groupe.entrees.map((e) => bloc(e, dataset))
        )
      )
    );
  };
  peindre();

  ouvrirPopup({
    titre: t("Journal des modifications"),
    sousTitre: t("Ce qui a été coché, et quand"),
    icone: "🗓",
    corps: [corps],
    large: true,
  });
}
