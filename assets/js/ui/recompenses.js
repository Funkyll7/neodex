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
import { jouerAvec } from "./sons.js";
import { ouvrirPopup } from "./popup.js";

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
  montrerVerrou({ nom: t(r.nom), sousTitre: t(nomDuType(type)), scene: sceneDe(type, r), succes: r.source });
}

/**
 * L'APERÇU D'UN THÈME VERROUILLÉ.
 *
 * Les cinq palettes de récompense se cachaient entièrement : le menu n'en
 * montrait qu'un cadenas et le succès à faire, et la carte était `disabled`,
 * donc muette au clic. C'était cohérent avec une idée — « la couleur est la
 * surprise, la condition ne l'est pas » — et cette idée est ici abandonnée,
 * demandée par l'usage : une surprise dont on ignore à quoi elle ressemble ne
 * fait courir personne, et les sept autres familles de cosmétiques montrent
 * maintenant ce qu'elles donnent. Un thème n'avait aucune raison de rester le
 * seul mystère du lot.
 *
 * @param {Object} theme  l'entrée de `ui/themes-list.js`
 * @param {Object} succes le succès qui l'ouvre, déjà évalué
 */
export function ouvrirApercuTheme(theme, succes) {
  montrerVerrou({
    nom: t(theme.label),
    sousTitre: t("Palette du site"),
    scene: sceneTheme(theme),
    succes,
    // LE SEUL POP-UP LARGE, et il le faut. Les sept autres récompenses tiennent
    // sur un objet — un cadre, une marque, un bandeau — qu'on juge en le
    // regardant seul. Une palette n'est pas un objet : elle est le rapport
    // entre un fond, une colonne, une barre et quinze vignettes, et ce rapport
    // ne se voit qu'en montrant l'écran entier.
    large: true,
  });
}

/**
 * La coquille commune : voile, boîte, en-tête, scène, condition.
 *
 * Sortie du corps de `ouvrirApercu` quand les thèmes sont venus s'y ajouter.
 * Les deux appelants ne partagent que la scène et le nom ; tout le reste — les
 * quatre chemins de fermeture, l'entrée d'historique, le piège du clic
 * intérieur — est délicat et n'avait pas à exister en double.
 */
function montrerVerrou({ nom, sousTitre, scene, succes, large = false }) {
  ouvrirPopup({
    titre: nom,
    sousTitre,
    icone: "\u{1F512}",
    corps: [scene, voieDe(succes)],
    large,
    // La loupe des palettes se regle sur une largeur mesuree : elle attend donc
    // que la boite soit dans le document.
    apres: ajusterLoupe,
  });
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
      trancheDePage()
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
 * Un thème verrouillé, montré sur une tranche de page.
 *
 * C'est le même montage que pour les cadres, poussé d'un cran : l'attribut
 * `data-theme-apercu` porte la palette entière, et TOUT ce qu'il y a dedans —
 * le fond, le texte, la barre, les deux vignettes avec leur cadre et leur
 * pastille — se repeint tout seul. `assets/css/theme.css` déclare chaque
 * palette sur ce sélecteur en plus de `:root`, donc les couleurs ne sont
 * écrites qu'une fois.
 *
 * L'attribut est distinct de `data-theme`, et il fallait qu'il le soit : les
 * trente-huit cartes du menu portent déjà `data-theme`, et un sélecteur
 * généralisé les aurait repeintes chacune dans sa propre palette.
 */
function sceneTheme(theme) {
  return el(
    "div.verrou__scene.verrou__scene--theme",
    { "data-theme-apercu": theme.value },
    // Deux éléments emboîtés, et c'est tout le mécanisme de la loupe : la
    // maquette est construite à sa VRAIE largeur — 860 px, celle d'un écran
    // d'ordinateur — puis réduite par `transform` jusqu'à tenir dans le
    // pop-up. `ajusterLoupe`, appelé après insertion, calcule le rapport et
    // rend au cadre la hauteur qui va avec.
    el("div.verrou__loupe", el("div.verrou__ecran", maquetteDePage()))
  );
}

/**
 * Ramène la maquette pleine largeur à la taille du pop-up.
 *
 * ELLE EST CONSTRUITE EN GRAND PUIS RÉDUITE, et non construite en petit.
 * Fabriquer directement une version miniature aurait demandé une deuxième
 * feuille de styles — des tailles de police, des marges et des rayons choisis
 * pour cette taille-là — c'est-à-dire une seconde vérité à tenir d'accord avec
 * la première. Réduite, la maquette est la VRAIE page : les proportions, les
 * contrastes et les épaisseurs sont ceux qu'on aura, au facteur d'échelle
 * près. C'est précisément ce qu'on vient regarder.
 *
 * `transform` et non `zoom` : `zoom` ferait exactement ce qu'on veut en une
 * ligne, et Firefox ne l'a repris qu'en 2024. Le prix de `transform`, c'est de
 * devoir rendre sa hauteur au parent — une mise à l'échelle ne change pas la
 * place que l'élément occupe dans le flux.
 */
function ajusterLoupe(racine) {
  const loupe = racine.querySelector(".verrou__loupe");
  const ecran = racine.querySelector(".verrou__ecran");
  if (!loupe || !ecran) return;
  // DEUX CONTRAINTES, ET C'EST LA PLUS SERREE QUI GAGNE. La largeur seule ne
  // suffisait pas : la maquette téléphone fait 420 px de large mais près de
  // 900 de haut, et mise à l'échelle de la largeur elle sortait à mille pixels
  // dans une boîte qui en fait sept cents. Il fallait faire défiler pour voir
  // le bas — or c'est justement « voir l'écran entier » qu'on est venu faire.
  //
  // Le plafond de hauteur vit dans le CSS, sur `.verrou__loupe` : la mise en
  // page appartient à la feuille de styles, ce calcul ne fait que le lire.
  //
  // Pas de borne à 1 vers le haut : une maquette de 420 px flotterait au
  // milieu d'un cadre de 680, et l'agrandir reste net puisque tout y est du
  // DOM, sauf les sprites.
  // La largeur disponible se mesure sur le PARENT et non sur la loupe : on
  // s'apprête à donner à celle-ci la taille exacte de la maquette réduite, et
  // se mesurer soi-même aurait fait rétrécir un peu plus à chaque appel.
  const dispo = loupe.parentElement ? loupe.parentElement.clientWidth : loupe.clientWidth;
  const plafond = parseFloat(getComputedStyle(loupe).maxHeight);
  const rapport = Math.min(
    dispo / ecran.offsetWidth,
    (Number.isFinite(plafond) ? plafond : Infinity) / ecran.offsetHeight
  );

  // LE CADRE PREND LA TAILLE DE CE QU'IL CONTIENT, largeur comprise.
  //
  // Il ne prenait que la hauteur, et c'était un défaut visible : dès que la
  // contrainte de HAUTEUR l'emportait — ce qui est le cas de la maquette
  // téléphone, haute de neuf cents pixels —, la maquette réduite devenait plus
  // étroite que son cadre. Comme elle est mise à l'échelle depuis son coin haut
  // gauche, elle se collait à gauche et laissait à sa droite un rectangle noir
  // aussi large qu'elle. Ça ressemblait à une place laissée libre ; ce n'était
  // qu'un cadre trop grand.
  //
  // Le cadre épouse donc les deux dimensions, et se centre — voir `margin:
  // 0 auto` dans la feuille de styles.
  ecran.style.transform = `scale(${rapport})`;
  loupe.style.width = `${Math.round(ecran.offsetWidth * rapport)}px`;
  loupe.style.height = `${Math.round(ecran.offsetHeight * rapport)}px`;
}

/**
 * L'application entière, en maquette : la colonne de gauche et la grille.
 *
 * Une tranche ne suffisait pas. Le pop-by ne montrait que deux vignettes, et
 * une palette ne se juge pas sur deux vignettes : ce qu'on veut savoir, c'est
 * ce que donne l'ÉCRAN — la colonne sombre à côté de la grille claire, la
 * barre de progression au milieu, quinze vignettes qui se répètent. C'est là
 * qu'une palette est belle ou ne l'est pas.
 *
 * Les vignettes sont clonées de la vraie grille, donc avec leur sprite, leur
 * cadre et leur pastille ; tout le reste est du décor fidèle aux classes de
 * l'application, repeint par la palette prévisualisée.
 */
function maquetteDePage() {
  // LARGE OU ÉTROITE SELON LA FORME DU CADRE, et c'est le troisième essai.
  //
  // Le premier suivait l'appareil : téléphone → maquette téléphone. L'intention
  // était juste — montrer une maquette d'ordinateur à quelqu'un qui tient un
  // téléphone répond à côté —, mais elle ratait le cas d'une fenêtre étroite et
  // BASSE, celle d'un ordinateur portable au navigateur réduit. Le cadre y est
  // alors en paysage, la maquette téléphone en portrait, et une forme portrait
  // dans un cadre paysage est bornée par la hauteur : elle sortait large de
  // deux cent cinquante pixels au milieu d'un cadre qui en fait cinq cents,
  // avec un rectangle vide aussi grand qu'elle à côté.
  //
  // On regarde donc la forme de la place disponible. Un cadre plus large que
  // haut appelle une maquette d'ordinateur, un cadre plus haut que large une
  // maquette de téléphone — et comme la place disponible suit la fenêtre, un
  // vrai téléphone reçoit toujours sa maquette de téléphone.
  //
  // LA MESURE VIENT DU DOCUMENT, PAS DE CONSTANTES RECOPIÉES. La version
  // précédente reprenait dans le JavaScript la largeur du pop-up, ses marges et
  // le plafond de la loupe — `Math.min(innerWidth - 32, 720) - 34`. Ça marchait
  // et c'était une bombe à retardement : changer la largeur du pop-up dans la
  // feuille de styles aurait fait choisir la mauvaise maquette, sans rien
  // signaler.
  //
  // Le cadre est donc mesuré POUR DE VRAI, sur un pop-up vide monté hors écran
  // le temps d'une lecture. Une reflow, une fois par ouverture : c'est le prix
  // d'une mise en page qui reste dans la feuille de styles.
  const { largeur, hauteur } = mesurerLeCadre();
  const etroit = largeur <= hauteur;

  const stat = (nom, pct) =>
    el(
      "div.verrou__stat",
      el("span.verrou__stat-nom", nom),
      el("div.verrou__page-jauge", el("span", { style: { width: `${pct}%` } }))
    );

  return el(
    "div.verrou__appli" + (etroit ? ".verrou__appli--etroit" : ""),
    { style: { width: etroit ? "420px" : "860px" } },
    el(
      "aside.verrou__colonne",
      el(
        "div.verrou__page-tete",
        el("span.verrou__page-nom", "Funkylldex"),
        el("span.verrou__page-pct", "64 %")
      ),
      el("div.verrou__page-jauge.verrou__page-jauge--grosse", el("span", { style: { width: "64%" } })),
      el(
        "div.verrou__page-chiffres",
        [
          ["1 024", t("cases")],
          ["312", t("espèces")],
          ["87", t("chromatiques")],
        ].map(([n, quoi]) => el("span.verrou__page-stat", el("b", n), el("i", quoi)))
      ),
      stat(t("Génération") + " I", 88),
      stat(t("Génération") + " II", 41),
      stat(t("Génération") + " III", 12),
      el(
        "div.verrou__pastilles",
        [t("Tout"), t("Capturé"), t("Manquant")].map((mot, i) =>
          el("span.verrou__pastille" + (i === 0 ? ".verrou__pastille--active" : ""), mot)
        )
      )
    ),
    el(
      "div.verrou__grille",
      // Quatre vignettes en étroit, douze en large : dans les deux cas de quoi
      // remplir l'écran et le faire déborder d'une rangée, ce qui est ce qui
      // fait qu'une grille ressemble à une grille.
      //
      // Quatre et non six, parce que la maquette entière doit tenir SANS
      // DÉFILEMENT : chaque rangée de plus la rallonge de deux cent cinquante
      // pixels, que le facteur d'échelle paie ensuite en lisibilité. Six
      // rangeaient l'écran à 46 % ; quatre le rendent à 64 %, et une grille
      // coupée par le bas se lit aussi bien avec deux rangées qu'avec trois.
      ...(etroit ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).map((i) =>
        tuileDemo(i)
      )
    )
  );
}


/**
 * Mesure la place qu'aura la maquette, avant de la construire.
 *
 * LE PROBLÈME EST UN ŒUF ET UNE POULE : la forme de la maquette dépend du
 * cadre, et le cadre n'existe qu'une fois le pop-up ouvert — donc une fois la
 * maquette construite. On monte donc un pop-up VIDE, hors écran, on lit les
 * deux dimensions, et on le jette. Le vrai s'ouvre ensuite avec la bonne
 * maquette du premier coup.
 *
 * Deux versions ont précédé celle-ci. La première recopiait les nombres du CSS
 * dans le JS ; la seconde les recopiait mieux. Toutes deux mentaient dès qu'on
 * touchait à la feuille de styles. Mesurer ne ment pas.
 *
 * `visibility: hidden` et non `display: none` : un élément non affiché n'a
 * aucune dimension à donner. Il est hors flux et invisible, mais mesurable.
 */
function mesurerLeCadre() {
  const sonde = el(
    "div.verrou-fond",
    { style: { visibility: "hidden", pointerEvents: "none" }, "aria-hidden": "true" },
    el("div.verrou.verrou--large", el("div.verrou__corps", el("div.verrou__scene.verrou__scene--theme", el("div.verrou__loupe"))))
  );
  document.body.append(sonde);
  const scene = sonde.querySelector(".verrou__scene");
  const loupe = sonde.querySelector(".verrou__loupe");
  const largeur = scene.clientWidth;
  const hauteur = parseFloat(getComputedStyle(loupe).maxHeight) || scene.clientHeight;
  sonde.remove();
  return { largeur, hauteur };
}
/**
 * Une tranche de l'application : marque, barre de progression, deux vignettes.
 *
 * C'est la version courte, pour les MOTIFS. Une trame n'est pas une palette :
 * ce qu'on lui demande, c'est de ne pas gêner, et deux vignettes posées dessus
 * suffisent à le dire. La maquette entière aurait été une réponse trop longue
 * à une question courte.
 *
 * Les deux vignettes gardent leur largeur de grille et débordent volontiers :
 * une grille coupée par le bord ressemble à une page, deux vignettes centrées
 * ne ressemblent à rien.
 */
function trancheDePage() {
  return el(
    "div.verrou__page",
    el(
      "div.verrou__page-tete",
      el("span.verrou__page-nom", "Funkylldex"),
      el("span.verrou__page-pct", "64 %")
    ),
    el("div.verrou__page-jauge", el("span", { style: { width: "64%" } })),
    el("div.verrou__page-tuiles", tuileDemo(0), tuileDemo(1))
  );
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
