/**
 * recompenses.js — porter ce qu'on a gagné.
 *
 * `domain/recompenses.js` dit ce qui existe et ce qui l'ouvre ; ce fichier-ci
 * pose le choix sur le document et construit de quoi en changer.
 *
 * TOUT PASSE PAR UN ATTRIBUT SUR <html>, ET RIEN PAR DU JAVASCRIPT DE RENDU.
 *
 * `data-marque`, `data-cadre`, `data-motif` : le CSS fait le reste. C'est ce qui
 * rend le changement gratuit — repeindre 1025 vignettes avec un autre cadre ne
 * coûte qu'un attribut, là où reconstruire la grille coûte un rendu complet. Et
 * c'est ce qui garde ce module minuscule : il ne connaît aucune vignette.
 *
 * Deux exceptions, parce qu'elles ne sont pas peintes par le CSS :
 *
 *   - le TITRE est du texte, il remplace la ligne sous le nom du site ;
 *   - le JEU DE SONS est lu par `ui/sons.js` au moment de jouer une note.
 *
 * Le BANDEAU de la carte de partage n'est pas appliqué ici non plus : la carte
 * est un canvas, elle lit le choix quand elle se dessine.
 *
 * LE CHOIX EST LOCAL. Comme le thème, comme le mode compact : c'est un réglage
 * d'apparence propre à un appareil. Le ranger dans `collection.json` aurait fait
 * voyager un goût du moment avec les seules données qu'on ne veut jamais
 * perdre — et aurait ajouté une clé à synchroniser pour un choix cosmétique.
 */

import { el, fill } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { lirePrefs, ecrirePrefs } from "../core/prefs.js";
import { TYPES, RECOMPENSES, choixValide, evaluerRecompenses } from "../domain/recompenses.js";
import { iconeSvg } from "./icones-succes.js";

/** Les types posés en attribut sur `<html>`, et peints par le CSS seul. */
const ATTRIBUTS = ["marque", "cadre", "motif", "mascottes"];

/**
 * Le choix courant, tous types confondus, déjà validé.
 *
 * Une préférence peut nommer une récompense qui n'existe plus — un catalogue qui
 * bouge, un fichier venu d'un autre appareil. `choixValide` ramène alors au
 * défaut du type plutôt que de laisser poser un attribut inconnu, que le CSS
 * ignorerait sans rien dire.
 */
export function choixCourant() {
  const brut = lirePrefs().recompenses || {};
  const sortie = {};
  for (const type of TYPES) sortie[type.cle] = choixValide(type.cle, brut[type.cle]);
  return sortie;
}

/**
 * Retient un choix et le rend applicable tout de suite.
 *
 * L'état coché est repris À LA MAIN sur les boutons du type touché, et non par
 * un redessin du panneau. Redessiner aurait ramené la liste en haut à chaque
 * clic — or on essaie six cadres à la suite, et repartir du titre entre chaque
 * essai rend le panneau inutilisable. Un seul type change à la fois : mettre à
 * jour ses boutons suffit, et coûte cinq lignes.
 */
function poserChoix(type, cle) {
  const prefs = lirePrefs();
  ecrirePrefs({ ...prefs, recompenses: { ...(prefs.recompenses || {}), [type]: cle } });
  appliquerRecompenses();

  for (const bouton of document.querySelectorAll(`.recomp__opt[data-type="${type}"]`)) {
    bouton.setAttribute("aria-pressed", String(bouton.dataset.valeur === cle));
  }
}

/** Le texte du titre porté, pour la barre latérale et la carte de partage. */
export function titrePorte() {
  const cle = choixCourant().titre;
  const r = RECOMPENSES.find((x) => x.type === "titre" && x.cle === cle);
  if (!r) return "";
  return t(r.texte || r.nom);
}

/** Le jeu de sons choisi, lu par `ui/sons.js`. */
export function jeuDeSons() {
  return choixCourant().sons;
}

/** Le bandeau choisi, lu par la carte de partage. */
export function bannierePortee() {
  return choixCourant().banniere;
}

/**
 * Applique le choix au document.
 *
 * Appelé au démarrage AVANT le premier rendu et à chaque changement. Les
 * attributs se posent tôt pour la même raison que le mode compact : la grille
 * doit naître avec son cadre plutôt que le prendre sous les yeux.
 */
export function appliquerRecompenses() {
  const choix = choixCourant();
  for (const type of ATTRIBUTS) document.documentElement.dataset[type] = choix[type];

  // Le titre est du texte : il remplace la ligne sous le nom du site. Le défaut
  // y réécrit « Collection perso », donc sans récompense choisie rien ne change.
  const sous = document.querySelector(".brand__sub");
  if (sous) sous.textContent = titrePorte();

  document.dispatchEvent(new CustomEvent("funkylldex:recompenses", { detail: choix }));
}

/* ------------------------------- le panneau ------------------------------ */

/**
 * La section « Récompenses » de la page des succès.
 *
 * Elle vit LÀ et non dans les réglages, et c'est délibéré : on y arrive en
 * regardant ce qu'on a gagné, et le choix se fait à deux centimètres de la
 * raison pour laquelle on l'a. Rangée dans les réglages, elle aurait été un
 * menu de plus, sans rapport visible avec les succès.
 *
 * @param {Array} succes l'état rendu par `evaluerSucces`
 */
export function sectionRecompenses(succes) {
  const choix = choixCourant();
  const etat = evaluerRecompenses(succes, choix);
  const ouvertes = etat.filter((r) => r.ouvert).length;

  return el(
    "section.recomp",
    el(
      "h4.succes__titre-famille",
      t("Récompenses"),
      el("span.succes__compte-famille", `${ouvertes} / ${etat.length}`)
    ),
    TYPES.map((type) => famille(type, etat, choix))
  );
}

function famille(type, etat, choix) {
  return el(
    "div.recomp__famille",
    el(
      "div.recomp__entete",
      el("span.recomp__nom", t(type.nom)),
      el("span.recomp__aide", t(type.aide))
    ),
    optionsDuType(type, etat, choix)
  );
}

/**
 * Les options d'un seul type, sans son en-tête.
 *
 * Sortie à part parce que le menu de customisation en a besoin nue : là-bas
 * chaque type a son ONGLET, dont le libellé dit déjà le nom, et répéter
 * « Titre » sous un onglet « Titre » n'aurait rien appris à personne.
 *
 * @param {Array} [etat]  l'état déjà évalué ; recalculé si absent
 */
export function optionsDuType(type, etat, choix) {
  const c = choix || choixCourant();
  const liste = (etat || evaluerRecompenses(succesSource(), c)).filter((r) => r.type === type.cle);
  return el(
    "div.recomp__options",
    // `data-type` sert à retrouver ce conteneur pour le repeindre quand un
    // succès tombe. On ne peut pas le chercher par son libellé : celui-ci est
    // traduit, et le sélecteur aurait cessé de fonctionner en anglais.
    { role: "group", "aria-label": t(type.nom), dataset: { type: type.cle } },
    liste.map((r) => option(type, r, c[type.cle] === r.cle))
  );
}

/**
 * Repeint les options, quand ce qui est débloqué a changé.
 *
 * Le menu est construit UNE fois, au démarrage, avant même que les données
 * soient là : `evaluerRecompenses` n'avait alors aucun succès à lire et
 * verrouillait tout. Sans ce rafraîchissement, les quarante et une options
 * restaient closes pour la durée de la visite — y compris les dix-sept déjà
 * gagnées.
 */
export function redessinerOptions() {
  const conteneurs = document.querySelectorAll(".recomp__options[data-type]");
  if (!conteneurs.length) return;
  const choix = choixCourant();
  const etat = evaluerRecompenses(succesSource(), choix);
  for (const ancien of conteneurs) {
    const type = TYPES.find((x) => x.cle === ancien.dataset.type);
    if (!type) continue;
    ancien.replaceWith(optionsDuType(type, etat, choix));
    // Le compte du titre suit, sinon la section annoncerait « 2 / 7 » au-dessus
    // de sept options dont cinq sont ouvertes — le titre est justement ce qu'on
    // lit avant de déplier.
    const compte = document.querySelector(`.custo__section[data-custo="${type.cle}"] .custo__compte`);
    if (compte) compte.textContent = compteDuType(type, etat);
  }
}

/**
 * « Combien en ai-je, sur combien » pour un type.
 *
 * Le titre des thèmes portait un simple « 38 » — le nombre de palettes, sans
 * plus, parce qu'elles sont toutes visibles. Les six autres familles ont des
 * options verrouillées : le nombre seul n'y dirait rien, alors que « 3 / 7 »
 * dit d'un coup s'il reste à gagner de ce côté-là.
 */
export function compteDuType(type, etat) {
  const liste = (etat || evaluerRecompenses(succesSource(), choixCourant())).filter(
    (r) => r.type === type.cle
  );
  return `${liste.filter((r) => r.ouvert).length} / ${liste.length}`;
}

/**
 * L'état des succès, quand l'appelant ne le fournit pas.
 *
 * Posé par `ui/theme.js` au lieu d'être importé : ce module est chargé AVANT lui
 * — `main.js` applique les récompenses avant d'avoir des données — et un import
 * croisé aurait fait un cycle. Vide tant que rien n'est calculé, ce qui rend
 * simplement toutes les récompenses verrouillées sauf les défauts.
 */
let source = () => [];
export function poserSourceDesSucces(fn) {
  source = fn;
}
const succesSource = () => source();

/**
 * Une option.
 *
 * Verrouillée, elle reste VISIBLE et porte le nom du succès qui l'ouvre, avec
 * son avancement. C'est le choix déjà fait pour les palettes, et pour la même
 * raison : une récompense dont on ignore l'existence ne donne envie de rien.
 * Elle est `disabled` plutôt que muette au clic — un bouton mort qui garde l'air
 * vivant est le pire des deux.
 */
function option(type, r, choisi) {
  const titre = r.ouvert ? t(r.nom) : `${t(r.nom)} — ${conditionDe(r)}`;

  return el(
    "button.recomp__opt",
    {
      type: "button",
      // `aria-disabled` et NON `disabled` : un bouton vraiment désactivé
      // n'accepte aucun clic, donc aucun moyen de demander pourquoi. Or c'est
      // exactement la question qu'on se pose devant un cadenas. Il reste donc
      // cliquable, et son clic répond.
      "aria-disabled": String(!r.ouvert),
      "aria-pressed": String(choisi),
      title: titre,
      "aria-label": titre,
      dataset: { type: type.cle, valeur: r.cle },
      onclick: r.ouvert ? () => poserChoix(type.cle, r.cle) : () => annoncerVerrou(r),
    },
    apercu(type.cle, r),
    el("span.recomp__label", t(r.nom)),
    r.ouvert ? null : el("span.recomp__cadenas", { "aria-hidden": "true" }, "🔒")
  );
}

/** « Le succès qu'il faut, et où l'on en est » — ou le constat, à défaut. */
function conditionDe(r) {
  if (!r.source) return t("verrouillé");
  const s = r.source;
  return `${t(s.titre)} · ${s.fait} / ${s.total}`;
}

/**
 * Dit ce qu'il manque, au clic sur un cadenas.
 *
 * Un bandeau plutôt qu'une infobulle : l'infobulle existe déjà — c'est le
 * `title` —, mais elle demande de survoler, ce qu'un téléphone ne sait pas
 * faire. Or c'est justement sur téléphone qu'on parcourt cette liste au doigt.
 *
 * Il reprend la mise en forme du bandeau de déverrouillage, et ce n'est pas de
 * l'économie : les deux disent la même chose à deux moments opposés — « voilà
 * ce que tu viens d'obtenir » et « voilà ce qu'il te faut ». Les rendre
 * identiques à l'œil, c'est dire qu'ils parlent du même sujet.
 */
function annoncerVerrou(r) {
  document.querySelector(".verrou-bandeau")?.remove();
  const s = r.source;

  const bandeau = el(
    "div.succes-bandeau.verrou-bandeau",
    { role: "status", "aria-live": "polite" },
    el("span.bandeau__titre", `🔒 ${t(r.nom)}`),
    el(
      "p.succes__liste",
      s ? `${t("Il faut le succès")} « ${t(s.titre)} »` : t("Cette récompense n'est pas encore accessible.")
    ),
    s ? el("span.bandeau__suite", `${t(s.resume)} — ${s.fait} / ${s.total}`) : null
  );

  document.body.append(bandeau);
  setTimeout(() => bandeau.remove(), 6000);
}

/**
 * L'aperçu d'une option.
 *
 * Montrer la chose plutôt que la nommer : « Prisme » ne dit pas à quoi ressemble
 * un prisme, et six listes de mots seraient six listes à essayer une par une.
 * Chaque type a le sien, et c'est le CSS qui les dessine — sauf le titre, qui
 * EST du texte et n'a donc rien à figurer.
 */
function apercu(type, r) {
  if (type === "titre") return null;
  if (type === "marque") {
    return el("span.recomp__apercu.recomp__apercu--marque", { dataset: { marque: r.cle } });
  }
  if (type === "sons") return iconeSvg("etincelle", 16);
  return el("span.recomp__apercu", { dataset: { [type]: r.cle } });
}
