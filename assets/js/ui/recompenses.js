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
import { RARETES } from "../domain/succes.js";
import { retourFerme } from "./retour.js";
import { jouerAvec } from "./sons.js";

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
      onclick: r.ouvert ? () => poserChoix(type.cle, r.cle) : () => ouvrirApercu(type.cle, r),
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
 * L'APERÇU D'UNE RÉCOMPENSE VERROUILLÉE.
 *
 * Avant, un clic sur un cadenas faisait descendre un bandeau qui nommait le
 * succès manquant. C'était la moitié de la réponse. On regarde une liste de
 * cosmétiques fermés pour décider LEQUEL on a envie d'aller chercher, et ce
 * choix se fait à l'œil : « Néon » et « Couronne » sont deux mots, la pastille
 * de vingt pixels à côté n'en dit guère plus, et rien là-dedans ne donne envie
 * de courir après l'un plutôt que l'autre.
 *
 * Le pop-up montre donc la chose EN GRAND et à sa vraie échelle, avec, dessous,
 * ce qu'il faut faire pour l'ouvrir et où l'on en est.
 *
 * ────────────────────────────────────────────────────────────────────────
 * COMMENT ON PRÉVISUALISE SANS DUPLIQUER LE STYLE.
 *
 * Tous ces cosmétiques sont peints par le CSS depuis un attribut posé sur
 * `<html>` : `[data-cadre="neon"] .card--complete { … }`. Réécrire ces
 * déclarations une seconde fois pour le pop-up aurait créé exactement le piège
 * qu'on veut éviter — un aperçu qui ne ressemble plus à la chose, parce que
 * l'un des deux a été retouché et pas l'autre.
 *
 * Les sélecteurs ont donc perdu leur `:root`. `[data-cadre="neon"]` accroche
 * toujours `<html>`, et accroche AUSSI la petite scène du pop-up quand on lui
 * pose le même attribut. Une seule écriture, deux endroits peints.
 *
 * La vignette de démonstration, elle, est CLONÉE de la grille : c'est une vraie
 * carte terminée, avec son sprite et sa pastille. Aucune maquette n'aurait été
 * aussi fidèle, et surtout aucune n'aurait suivi les évolutions de la vraie.
 * ────────────────────────────────────────────────────────────────────────
 */
function ouvrirApercu(type, r) {
  document.querySelector(".verrou-fond")?.remove();

  const s = r.source;
  const fond = el("div.verrou-fond", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": `${t(r.nom)} — ${t("verrouillé")}`,
  });

  // Le geste Retour du téléphone doit refermer ce pop-up, pas quitter le site :
  // c'est la même règle que pour la fiche, la page des succès et le tiroir des
  // filtres. `liberer` dépile l'entrée si on ferme par un autre chemin.
  let liberer = null;
  const fermer = () => {
    fond.remove();
    document.removeEventListener("keydown", surTouche);
    if (liberer) {
      const f = liberer;
      liberer = null;
      f();
    }
  };
  const surTouche = (e) => {
    if (e.key === "Escape") fermer();
  };

  fond.append(
    el(
      "div.verrou",
      {
        // Un clic DANS la boîte ne doit pas la fermer, alors qu'un clic sur le
        // voile derrière doit le faire. Sans cette interception, essayer le son
        // « Cristal » refermait le pop-up au premier appui.
        onclick: (e) => e.stopPropagation(),
      },
      el(
        "div.verrou__tete",
        el("span.verrou__cadenas", { "aria-hidden": "true" }, "🔒"),
        el(
          "div.verrou__identite",
          el("h3.verrou__nom", t(r.nom)),
          el("p.verrou__type", t(nomDuType(type)))
        ),
        el("button.verrou__fermer", {
          type: "button",
          "aria-label": t("Fermer"),
          textContent: "✕",
          onclick: fermer,
        })
      ),
      sceneDe(type, r),
      voieDe(s)
    )
  );

  fond.addEventListener("click", fermer);
  document.addEventListener("keydown", surTouche);
  document.body.append(fond);
  liberer = retourFerme(fermer);
  fond.querySelector(".verrou__fermer")?.focus();
}

/** Le libellé du type, pour la ligne sous le nom de la récompense. */
function nomDuType(cle) {
  return (TYPES.find((x) => x.cle === cle) || {}).nom || "";
}

/**
 * La scène : la récompense montrée pour de vrai.
 *
 * Un cas par type, parce qu'il n'y a rien de commun entre un cadre de vignette
 * et un jeu de notes. Ce qui EST commun, c'est la règle : on montre la chose à
 * sa taille d'usage, jamais une miniature — c'est déjà ce que fait la pastille
 * de la liste, et c'est précisément parce qu'elle ne suffisait pas qu'on ouvre
 * ce pop-up.
 */
function sceneDe(type, r) {
  if (type === "titre") {
    // Un titre est du texte, et sa seule mise en scène possible est l'endroit
    // où il apparaîtra : la ligne sous le nom du site, en haut de la colonne.
    return el(
      "div.verrou__scene.verrou__scene--plein",
      el(
        "div.verrou__marque",
        el("span.verrou__marque-nom", "Funkylldex"),
        el("span.verrou__marque-sous", t(r.texte || r.nom))
      )
    );
  }

  if (type === "cadre" || type === "marque") {
    // L'attribut est posé SUR la scène : les règles de `components.css`, qui
    // n'exigent plus `:root`, peignent alors la vignette clonée à l'intérieur
    // exactement comme elles peindraient la grille.
    return el("div.verrou__scene", { dataset: { [type]: r.cle } }, tuileDemo());
  }

  if (type === "motif") {
    // La trame se pose derrière l'APPLICATION ENTIÈRE. La montrer seule, sur un
    // carré vide, ne dit rien : à cette échelle un quadrillage de 34 px et une
    // poussière de 26 px se ressemblent, et surtout on ne voit pas ce qui
    // compte — si elle passe derrière le contenu sans le gêner.
    //
    // D'où une tranche de page plutôt qu'un échantillon : la ligne de marque,
    // une barre de progression, deux vignettes. La trame se juge alors sur ce
    // qu'elle laisse lire, ce qui est la seule question qu'on se pose.
    return el(
      "div.verrou__scene.verrou__scene--motif",
      { dataset: { motif: r.cle } },
      el("span.verrou__motif", { "aria-hidden": "true" }),
      el(
        "div.verrou__page",
        el(
          "div.verrou__page-tete",
          el("span.verrou__page-nom", "Funkylldex"),
          el("span.verrou__page-pct", "64 %")
        ),
        el("div.verrou__page-jauge", el("span")),
        el("div.verrou__page-tuiles", tuileDemo(0), tuileDemo(1))
      )
    );
  }

  if (type === "banniere") return sceneCarte(r);

  if (type === "sons") return sceneSonore(r);

  return el(
    "div.verrou__scene.verrou__scene--plein",
    el("span.recomp__apercu.verrou__gros", { dataset: { [type]: r.cle } })
  );
}

/**
 * Le bandeau, montré SUR LA CARTE DE PARTAGE.
 *
 * Une bande de couleur large de trois cents pixels ne dit rien : les cinq
 * bandeaux sont cinq dégradés, et alignés côte à côte hors de leur contexte ils
 * se valent tous. Or ce bandeau n'existe qu'à un seul endroit — le filet de
 * six pixels en haut de la carte qu'on envoie —, et c'est là, au-dessus du
 * nom, des barres et des chiffres, qu'on peut dire s'il va.
 *
 * C'est donc la VRAIE carte qui est dessinée, avec les vrais compteurs, et
 * seulement le bandeau forcé. 1080 × 1350 réduits à la largeur de la scène :
 * on ne lit plus les chiffres, mais on n'est pas là pour ça — on regarde une
 * mise en page qu'on connaît déjà et le filet qui la coiffe.
 *
 * REPLI. `poserApercuCarte` est appelé par `ui/save.js`, seul détenteur du
 * contexte ; si ce chemin n'a pas encore tourné, ou si le dessin échoue, on
 * retombe sur la bande large. Un aperçu dégradé vaut mieux qu'une scène vide.
 */
function sceneCarte(r) {
  const canvas = dessinerLaCarte(r.cle);
  if (!canvas) {
    return el(
      "div.verrou__scene.verrou__scene--plein",
      el("span.recomp__apercu.verrou__bande", { dataset: { banniere: r.cle } })
    );
  }
  canvas.className = "verrou__carte";
  canvas.setAttribute("aria-hidden", "true");
  return el("div.verrou__scene.verrou__scene--carte", canvas);
}

/**
 * Le dessinateur de carte, posé de l'extérieur.
 *
 * Posé et non importé, pour la raison qui vaut déjà pour `poserSourceDesSucces`
 * juste au-dessus, avec un motif de plus ici : `ui/carte-partage.js` importe CE
 * module — il y lit le bandeau porté et le titre — et l'importer en retour
 * aurait fait un cycle franc.
 *
 * Rend `null` tant que rien n'est posé, ce qui laisse simplement le repli.
 */
let peintre = null;
export function poserApercuCarte(fn) {
  peintre = fn;
}
function dessinerLaCarte(banniere) {
  if (!peintre) return null;
  try {
    return peintre(banniere);
  } catch {
    // La carte lit une douzaine de compteurs : si l'un manque au moment où on
    // ouvre l'aperçu, on préfère la bande large à un pop-up qui ne s'ouvre pas.
    return null;
  }
}

/**
 * Un jeu de notes ne se REGARDE pas.
 *
 * D'où deux boutons plutôt qu'une image : le tic d'une case, qu'on entendra des
 * milliers de fois, et la fanfare d'un succès, qu'on entendra rarement et qui
 * porte tout le caractère du jeu. Les juger séparément est le seul moyen de
 * savoir si « Rétro » amuse ou fatigue.
 *
 * `jouerAvec` joue sous un jeu QUELCONQUE sans rien écrire dans les
 * préférences — sans quoi essayer un timbre verrouillé aurait demandé de le
 * choisir, ce qui est justement impossible.
 */
function sceneSonore(r) {
  const dire = (nom) => () => {
    if (!jouerAvec(r.cle, nom)) {
      // Rien n'est sorti : les sons sont coupés, ou le navigateur n'a pas de
      // Web Audio. Le dire vaut mieux que laisser croire à un timbre muet.
      note.textContent = t("Les sons sont coupés dans les réglages.");
    }
  };
  const note = el("p.verrou__note");

  return el(
    "div.verrou__scene.verrou__scene--sons",
    el(
      "div.verrou__ecoutes",
      el("button.verrou__ecoute", {
        type: "button",
        textContent: `▶ ${t("Une case cochée")}`,
        onclick: dire("case"),
      }),
      el("button.verrou__ecoute", {
        type: "button",
        textContent: `▶ ${t("Un succès")}`,
        onclick: dire("succes"),
      })
    ),
    note
  );
}

/**
 * Une vraie vignette terminée, prise dans la grille.
 *
 * Clonée et non fabriquée : la vignette a une douzaine de sous-éléments — le
 * numéro, les puces de type, la pastille, l'aura colorée du premier type — et
 * une maquette qui en oublie un montre un cadre autour de quelque chose qui
 * n'est pas la vignette qu'on aura.
 *
 * On retire ce qui est interactif : les bascules rapides et le bouton
 * d'ouverture de fiche n'ont rien à faire dans un aperçu, et un bouton dans un
 * bouton casse la navigation au clavier.
 *
 * REPLI. Rien n'est terminé au tout début, ou la seule vignette complète est
 * hors de l'écran donc VIDÉE de son contenu par la virtualisation. On rend
 * alors une vignette nue : elle porte le cadre et la pastille, ce qui est
 * exactement ce qu'on venait voir.
 */
function tuileDemo(rang = 0) {
  // `rang` sert aux scenes qui en montrent plusieurs : deux clones du meme
  // Pokemon cote a cote se liraient comme un bug d'affichage.
  const modeles = [...document.querySelectorAll(".card--complete")].filter((n) =>
    n.querySelector(".card__img")
  );
  const modele = modeles[rang % Math.max(1, modeles.length)];

  if (!modele) {
    return el(
      "div.card.card--complete.verrou__tuile",
      el("span.card__top", el("span.card__num", "000")),
      el("span.card__art"),
      el("span.card__name", t("Exemple"))
    );
  }

  const copie = modele.cloneNode(true);
  copie.classList.add("verrou__tuile");
  copie.removeAttribute("id");
  copie.querySelector(".card__toggles")?.remove();
  for (const bouton of copie.querySelectorAll("button")) {
    bouton.setAttribute("tabindex", "-1");
    bouton.setAttribute("aria-hidden", "true");
    bouton.disabled = true;
  }
  return copie;
}

/**
 * Ce qu'il faut faire, et où l'on en est.
 *
 * La jauge compte autant que le chiffre. « 312 / 500 » demande une division
 * mentale pour savoir si c'est proche ; une barre aux deux tiers se lit sans
 * calcul, et c'est elle qui fait la différence entre « un jour peut-être » et
 * « tiens, j'y suis presque ».
 */
function voieDe(s) {
  if (!s) {
    return el(
      "div.verrou__voie",
      el("p.verrou__absent", t("Cette récompense n'est pas encore accessible."))
    );
  }

  const pct = s.total > 0 ? Math.min(100, Math.round((s.fait / s.total) * 100)) : 0;

  return el(
    "div.verrou__voie",
    el("p.verrou__quoi", t("Il faut le succès")),
    el(
      "div.verrou__succes",
      el("span.verrou__icone", { "aria-hidden": "true" }, iconeSvg(s.icone, 24)),
      el(
        "div.verrou__succes-texte",
        el(
          "span.verrou__succes-titre",
          t(s.titre),
          el("span.verrou__rang", t(RARETES[s.rang - 1] || ""))
        ),
        el("span.verrou__succes-resume", t(s.resume))
      )
    ),
    el(
      "div.verrou__jauge",
      { role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" },
      el("span.verrou__jauge-plein", { style: { width: `${pct}%` } })
    ),
    el(
      "p.verrou__chiffres",
      el("span.verrou__fait", `${s.fait} / ${s.total}`),
      el("span.verrou__pct", `${pct} %`)
    )
  );
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
