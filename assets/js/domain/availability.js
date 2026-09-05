/**
 * availability.js — « ou trouver cette espece, et le shiny y est-il possible ? »
 *
 * Source : les champs gm / ev / nsh de data/details/gen-N.json.
 * Une espece sans donnee curatee renvoie simplement `curated: false` : la fiche
 * affiche alors une invite a completer le fichier plutot qu'un tableau vide.
 */

import { dlcApporte, dlcRequis } from "./dlc.js";

/** Quatre etats croises presence x chromatique, avec la couleur du tableau. */
export const AVAIL_STATE = {
  none: { label: "—", color: null },
  wild: { label: "Disponible", color: "var(--avail-ok)" },
  wildLocked: { label: "Disponible", color: "var(--avail-nolock)" },
  event: { label: "Événement", color: "var(--avail-event)" },
  eventLocked: { label: "Événement", color: "var(--avail-event-lock)" },
};

/**
 * Le tableau rendu quand il n'y a pas de sous-ligne — c'est-a-dire pour vingt
 * jeux sur vingt-trois, quelle que soit l'espece : ces vingt-la n'ont aucun
 * contenu telechargeable, il n'y a donc rien a ranger sous leur ligne.
 *
 * Un seul tableau gele, partage par toutes ces lignes, plutot qu'un tableau
 * neuf par ligne : une fiche ouverte en fabriquerait vingt-trois, jetes
 * aussitot, a chaque clic du Pokedex. Gele, personne ne peut le remplir par
 * megarde et le partager a son insu.
 *
 * Il sert aussi de valeur par defaut au troisieme argument : appeler
 * `availabilityRows(espece, jeux)` sans les DLC reste licite et ne coute rien.
 */
const VIDE = Object.freeze([]);

/** Le chromatique est-il chassable dans ce jeu precis ? */
export function canShinyIn(species, game) {
  return (
    species.games.has(game.code) &&
    game.shinyOk !== false &&
    !species.shinyLocked.has(game.code)
  );
}

/** Liste des jeux ou le chromatique est reellement chassable. */
export function huntableGames(species, games) {
  return games.filter((game) => canShinyIn(species, game));
}

/**
 * Les contenus telechargeables ranges par code de jeu, une fois pour toutes.
 *
 * Meme raisonnement de cache que dans `domain/dlc.js` : `core/data.js`
 * construit le tableau des DLC une fois au chargement et le garde pour la vie
 * de la page, une WeakMap posee dessus vit donc exactement aussi longtemps
 * qu'il faut — et si un jeu de donnees etait recharge, l'ancien s'effacerait
 * avec son index sans qu'on ait a y penser.
 *
 * Les listes rendues sont GELEES. Elles sortent du module et se promenent dans
 * l'affichage ; un `push` malencontreux chez l'appelant aurait sinon corrompu
 * l'index pour toute la page, et le bug se serait manifeste ailleurs, plus
 * tard, sur une autre fiche.
 */
const INDEX_PAR_JEU = new WeakMap();

function indexerParJeu(dlcs) {
  const deja = INDEX_PAR_JEU.get(dlcs);
  if (deja) return deja;
  const index = new Map();
  for (const dlc of dlcs) {
    if (!index.has(dlc.game)) index.set(dlc.game, []);
    index.get(dlc.game).push(dlc);
  }
  for (const liste of index.values()) Object.freeze(liste);
  INDEX_PAR_JEU.set(dlcs, index);
  return index;
}

/**
 * Les contenus telechargeables de ce jeu, qu'ils apportent l'espece ou non.
 * Tableau vide pour les vingt jeux qui n'en ont aucun.
 *
 * ═══ POURQUOI CETTE LISTE EXISTE, ALORS QUE `dlcRequis` EXISTE DEJA ═══
 *
 * `dlcRequis` repond « quels DLC faut-il acheter », et sa reponse est vide dans
 * l'immense majorite des cas. Elle ne sait donc pas dire QUELS DLC EXISTENT pour
 * ce jeu, et c'est pourtant la premiere chose a savoir quand les quatre doivent
 * s'afficher en permanence : un contenu qui n'apporte pas l'espece a une ligne
 * malgre tout, pour y dire non. Partir de `dlcRequis` — ou de `dlcRows` — aurait
 * fait disparaitre exactement les lignes qu'on veut voir.
 *
 * Elle sert donc deux appelants qui ont besoin de la meme chose :
 * `availabilityRows`, juste en dessous, qui range une sous-ligne sous chaque
 * jeu ; et tout affichage qui montrerait les quatre logos ailleurs sur la fiche.
 *
 * ═══ POURQUOI L'AFFICHAGE NE LES CONNAIT PAS LUI-MEME ═══
 *
 * Ecrire « swsh a deux DLC, sv un, za un » au point de dessin aurait fige dans
 * du code ce que data/reference/dlc.json dit deja, et qui bougera : un
 * cinquieme DLC, ou le decoupage de zone-zero en ses deux moities, aurait
 * oblige a retoucher l'affichage alors que seule la donnee a change. En passant
 * par ici, l'affichage boucle sur ce qu'on lui rend et n'a jamais a savoir
 * combien il y en a.
 *
 * ═══ CE QU'ELLE NE FAIT PAS ═══
 *
 * Elle ne dit RIEN de l'espece — elle n'en recoit meme pas. C'est un pur
 * rangement du fichier de reference par code de jeu. Pour la question « ce
 * DLC-la apporte-t-il cette espece ? », l'appelant enchaine avec `dlcApporte`
 * de `domain/dlc.js`, qui lit le champ `toutes`.
 *
 * L'ORDRE EST CELUI DU FICHIER DE DONNEES, et il compte : les deux DLC d'Epee/
 * Bouclier doivent se presenter dans le meme ordre d'une fiche a l'autre, sinon
 * les deux logos changeraient de place au fil de la navigation.
 *
 * @param {string} codeJeu  le `code` d'un jeu de data/reference/games.json
 * @param {Array} [dlcs]    `dataset.dlc`, c'est-a-dire data/reference/dlc.json
 * @returns {Array} enregistrements de DLC, gele ; vide si ce jeu n'en a pas
 */
export function dlcDuJeu(codeJeu, dlcs = VIDE) {
  if (!codeJeu || !dlcs || !dlcs.length) return VIDE;
  return indexerParJeu(dlcs).get(codeJeu) || VIDE;
}

/**
 * L'absence, prete a etre etalee sur une ligne : cinq champs, toujours les
 * memes.
 *
 * DEUX ENDROITS DOIVENT DIRE « NON » dans la fonction ci-dessous, et ce ne sont
 * pas les memes « non » : la ligne d'un jeu dont seul un contenu telechargeable
 * apporte l'espece, et la sous-ligne d'un contenu telechargeable qui ne
 * l'apporte pas. Les ecrire deux fois aurait invite a les faire diverger — le
 * jour ou l'absence s'ecrira autrement qu'avec un tiret, un seul des deux aurait
 * suivi, et le tableau aurait affiche deux vocabulaires dans la meme colonne.
 *
 * LES LIBELLES SONT PRIS DANS `AVAIL_STATE.none`, jamais ecrits en dur, pour
 * exactement la meme raison d'un cran plus haut : c'est cette table-la qui
 * decide de la langue du tableau, et elle doit rester le seul endroit ou on la
 * change.
 *
 * Gele, parce qu'il est etale — `{ ...ligne, ...ABSENTE }` — jusqu'a vingt-sept
 * fois par fiche ouverte, et que la fiche se redessine a chaque clic du
 * Pokedex : un seul objet partage, que personne ne peut modifier au passage.
 */
const ABSENTE = Object.freeze({
  present: false,
  state: "none",
  color: AVAIL_STATE.none.color,
  presenceLabel: AVAIL_STATE.none.label,
  shinyLabel: AVAIL_STATE.none.label,
});

/**
 * Une ligne par jeu, prete a etre rendue — et, sous les trois jeux qui ont du
 * contenu telechargeable, une sous-ligne par contenu, TOUJOURS.
 *
 * ═══ CE QUE LA LIGNE DU JEU DISAIT, ET QUI ETAIT FAUX ═══
 *
 * Le tableau annoncait « Ecarlate / Violet — Disponible » pour Rayquaza. La
 * cartouche seule ne le donne pas : il faut le Tresor Enfoui de la Zone Zero.
 * La ligne repondait donc « oui » a la seule question qu'on vient lui poser —
 * « est-ce que je peux l'attraper dans ce jeu-la ? » —, alors que la reponse
 * honnete est « pas avec le jeu de base ».
 *
 * Un petit logo pose a cote du nom du jeu avait ete tente, et c'etait pire : il
 * QUALIFIAIT une ligne qui restait verte et affirmait « Disponible ». Deux
 * signes contradictoires dans le meme millimetre carre, et le plus gros des
 * deux — le mot, la couleur — etait le faux.
 *
 * ═══ LA REGLE DE LA LIGNE DU JEU, INCHANGEE ═══
 *
 * Quand un DLC est REQUIS pour avoir l'espece dans ce jeu, LA LIGNE DU JEU
 * PASSE EN ABSENTE : etat « none », plus de couleur, un tiret dans les deux
 * colonnes, exactement comme les vingt autres jeux qui n'ont pas l'espece.
 * C'est litteralement vrai, et c'est la meme ecriture partout — un lecteur qui
 * parcourt la colonne n'a pas un troisieme vocabulaire a apprendre.
 *
 * Et elle ne bascule QUE dans ce cas-la. Un Pikachu, que le jeu de base donne,
 * affiche « Epee / Bouclier : Disponible » comme il l'a toujours fait, meme si
 * l'Ile Solitaire le donne aussi : ce qui rendrait la ligne fausse, ce n'est pas
 * qu'un DLC contienne l'espece, c'est qu'il faille l'acheter pour l'avoir.
 *
 * ═══ LES SOUS-LIGNES : TOUJOURS LA, MEME POUR DIRE NON ═══
 *
 * C'est le changement. Avant, une sous-ligne n'apparaissait que pour un DLC
 * requis : le tableau faisait donc 23 lignes pour presque toutes les especes, et
 * 24 ou 25 pour quelques centaines. Il en fait desormais 27 pour TOUTES —
 * Epee / Bouclier suivi de ses deux DLC, Ecarlate / Violet du sien, Legendes
 * Z-A du sien —, chaque sous-ligne repondant pour son propre compte.
 *
 * POURQUOI MONTRER UN « NON ». Parce que l'ancien tableau ne le disait pas : il
 * se taisait. Or le silence avait deux sens indiscernables — « ce DLC n'a pas
 * l'espece » et « ce DLC ne change rien ici, l'espece est deja dans le jeu de
 * base » — et un troisieme, plus embetant : « on ne sait pas ». Le joueur qui
 * POSSEDE l'Ile Solitaire et se demande s'il peut y chasser son Pikachu ne
 * trouvait rien a lire. Une reponse ecrite, meme negative, vaut mieux qu'une
 * absence de ligne : elle se lit, se compare a celle du voisin, et se date.
 *
 * ET LA COLONNE DU CHROMATIQUE SUIT. La sous-ligne d'un DLC qui apporte
 * l'espece herite de l'etat, de la couleur et des DEUX libelles de la ligne du
 * jeu telle qu'elle etait AVANT la bascule — puisque c'est exactement de cette
 * presence-la qu'ils parlaient, elle est simplement payante. Celle d'un DLC qui
 * ne l'apporte pas prend `ABSENTE`, la meme absence que les vingt jeux qui n'ont
 * pas l'espece : tiret, tiret, pas de couleur.
 *
 * « QUI APPORTE L'ESPECE » SE LIT LARGEMENT, et c'est le point le plus
 * important de cette fonction. Un DLC apporte l'espece s'il la recense, OU si
 * le jeu de base la donne deja : on ne joue pas au DLC, on joue au jeu avec le
 * DLC installe, et l'achat n'a jamais retire une rencontre. Sans cette seconde
 * branche, la Mega-Dimension declarait Bulbizarre indisponible alors qu'il se
 * chasse dans Legendes Z-A — et dans ses propres failles. Le corps de la
 * fonction dit pourquoi aucun champ de donnees ne pouvait couvrir ce cas.
 *
 * ═══ POURQUOI DEUX QUESTIONS, ET DONC DEUX FONCTIONS DE `dlc.js` ═══
 *
 * La bascule de la ligne du jeu lit `dlcRequis`, qui interroge le champ
 * `species` — les EXCLUSIVES du DLC. La sous-ligne lit `dlcApporte`, qui
 * interroge le champ `toutes` — le contenu COMPLET. Ce n'est pas une
 * coquetterie. `dlcRequis` est incapable de repondre pour la sous-ligne d'un
 * Pikachu, parce que la soustraction qui fabrique `species` l'a efface de l'Ile
 * Solitaire, ou il est pourtant : elle repondrait « non » a une question qu'on
 * ne lui pose pas.
 * L'en-tete de `domain/dlc.js` developpe longuement les deux questions.
 *
 * ═══ CE QU'UNE SOUS-LIGNE NE PEUT JAMAIS FAIRE : CONTREDIRE SON JEU ═══
 *
 * Les sous-lignes sont baties par etalement de `ligne` — la ligne du jeu AVANT
 * la bascule —, jamais construites a part. La consequence est voulue : quand
 * `data/availability` dit que l'espece n'est pas dans ce jeu, `ligne` est deja
 * une absence, et la sous-ligne l'est donc aussi, meme si `toutes` pretend le
 * contraire. Deux fichiers parlent du meme jeu et rien ne les oblige a
 * s'accorder ; le jour ou ils divergeraient, le tableau afficherait sinon
 * « Ecarlate / Violet : — » et juste dessous « Zone Zero : Disponible », soit
 * une contradiction dans le meme millimetre carre. C'est `data/availability` qui
 * tranche, ici comme partout ailleurs sur le site.
 *
 * ═══ POURQUOI ICI, ET PAS DANS LE PANNEAU ═══
 *
 * « Cette espece n'est pas dans le jeu de base » est un fait sur les jeux, pas
 * une question de dessin. Ecrit dans le panneau, il aurait ete inatteignable
 * pour tout le reste — un filtre « sans DLC », un compteur, une colonne du
 * Living Dex — et le panneau aurait decide qu'une presence devient une absence,
 * ce qui n'est pas son metier. Ici, chacun appelle et lit.
 *
 * ═══ CE QU'ON NE RECALCULE PAS ═══
 *
 * Aucune soustraction n'est faite ici. Le champ `species` de
 * `data/reference/dlc.json` ne liste que ce que chaque DLC apporte ET QUE LE JEU
 * DE BASE N'A PAS — 402 especes en ont deja ete retirees. Qu'une espece y figure
 * SUFFIT donc a conclure qu'elle est absente du jeu de base : il n'y a pas
 * d'autre test, et en ajouter un aurait cree un second endroit a tenir d'accord
 * avec le premier. `dlcRequis` fait la recherche, et rien de plus — voir
 * domain/dlc.js.
 *
 * LA BASCULE NE TOUCHE QUE LES LIGNES CONCERNEES. Les vingt jeux sans contenu
 * telechargeable — et les trois autres, tant que l'espece est dans leur
 * cartouche de base — ressortent exactement comme avant.
 *
 * ═══ SANS LES DLC, RIEN NE CHANGE ═══
 *
 * Le troisieme argument reste facultatif, et son absence rend le tableau
 * d'avant : vingt-trois lignes, `dlcRows` vide partout, aucune bascule. Ce n'est
 * pas une politesse envers les appelants, c'est le repli du jour ou
 * `data/reference/dlc.json` manquerait — la fiche perdrait quatre lignes et une
 * nuance, elle ne perdrait pas le tableau.
 *
 * @param {object} species  l'espece, telle que `core/data.js` la construit
 * @param {Array}  games    data/reference/games.json, les 23 jeux
 * @param {Array} [dlcs]    `dataset.dlc` ; omis, le tableau se comporte comme
 *   avant l'arrivee des DLC — c'est le repli si data/reference/dlc.json manque
 * @returns {Array} une ligne par jeu, chacune avec son `dlcRows` : vide pour les
 *   vingt jeux sans contenu telechargeable, une entree par contenu pour les
 *   trois autres, quoi que ce contenu apporte
 */
export function availabilityRows(species, games, dlcs = VIDE) {
  return games.map((game) => {
    const present = species.games.has(game.code);
    const isEvent = species.eventGames.has(game.code);
    const shiny = canShinyIn(species, game);

    let state = "none";
    if (present) {
      if (isEvent) state = shiny ? "event" : "eventLocked";
      else state = shiny ? "wild" : "wildLocked";
    }

    const ligne = {
      game,
      present,
      isEvent,
      shiny,
      state,
      color: AVAIL_STATE[state].color,
      presenceLabel: AVAIL_STATE[state].label,
      shinyLabel: !present
        ? AVAIL_STATE.none.label
        : shiny
          ? "✦ Oui"
          : game.shinyOk === false
            ? "Gén. I"
            : "Bloqué",
      dlcRows: VIDE,
    };

    // Les contenus telechargeables de CE jeu — pas ceux qui apportent l'espece,
    // TOUS. Vingt jeux sur vingt-trois n'en ont aucun et ressortent ici, a
    // l'identique de l'ancien tableau ; c'est aussi ce qui arrive quand
    // l'appelant n'a pas passe `dlcs`.
    //
    // L'ORDRE EST CELUI DU FICHIER DE DONNEES, et il compte : les deux DLC
    // d'Epee / Bouclier doivent se presenter dans le meme ordre d'une fiche a
    // l'autre, sinon leurs deux lignes changeraient de place au fil de la
    // navigation, sous les yeux de qui compare deux especes.
    const contenus = dlcDuJeu(game.code, dlcs);
    if (!contenus.length) return ligne;

    // LA BASCULE DE LA LIGNE DU JEU ne regarde PAS ce que les DLC contiennent :
    // elle regarde ce qu'ils rendent OBLIGATOIRE. Un Pikachu que les deux DLC
    // recensent laisse sa ligne intacte — il est dans la cartouche —, un
    // Rayquaza qu'ils sont seuls a donner la fait basculer. C'est exactement la
    // difference entre `toutes` et `species`, et donc entre les deux fonctions
    // de `domain/dlc.js`.
    const requis = dlcRequis(species, game.code, dlcs);

    // ═══ UN DLC N'ENLEVE JAMAIS LE JEU DE BASE ═══
    //
    // C'est la regle, et elle etait fausse. La sous-ligne ne repondait oui que
    // si le Pokedex DU DLC recensait l'espece ; elle disait donc « — » pour tout
    // ce que la cartouche donne deja. Or on ne joue pas « au DLC » : on joue au
    // jeu AVEC le DLC installe, et rien de ce qu'on pouvait attraper avant ne
    // disparait en l'achetant. Bulbizarre est dans Legendes Z-A, chromatique
    // compris ; sa ligne Mega-Dimension annoncait pourtant « indisponible ».
    //
    // MEGA-DIMENSION EST LE CAS QUI LE PROUVE. Son `toutes` compte 132 numeros —
    // exactement son `species` : la soustraction n'a rien retire, parce que le
    // Pokedex Hyperespace ne recense QUE ses nouveautes. Les failles
    // extradimensionnelles, elles, rejouent une grande partie du jeu de base,
    // triees par type — Bulbizarre, Herbizarre et Florizarre se croisent dans
    // les failles Poison. Aucun champ du fichier de reference ne le dit, et
    // aucun ne le dira : `build_availability.py` deduit les DLC des Pokedex, et
    // un Pokedex de DLC n'a aucune obligation de relister le jeu de base. L'Ile
    // Solitaire le fait (220 numeros contre 119 exclusifs), l'Hyperespace non.
    //
    // D'OU LA REGLE, QUI NE DEPEND PLUS DE CETTE INEGALITE : une sous-ligne dit
    // oui si son DLC apporte l'espece, OU si le jeu de base la donne deja. La
    // seconde branche n'est pas une approximation, c'est le fait le plus solide
    // des deux — posseder le DLC implique posseder le jeu.
    //
    // `requis.length` est exactement « le jeu de base ne suffit pas » : c'est
    // deja ce qui fait basculer la ligne du jeu, et s'en servir ici garde les
    // deux lectures d'accord par construction.
    const baseDonne = present && !requis.length;

    // UNE SOUS-LIGNE PAR CONTENU, QU'IL APPORTE L'ESPECE OU NON.
    //
    // Celle qui l'apporte est `ligne` elle-meme — la ligne du jeu AVANT la
    // bascule ci-dessous —, augmentee de son DLC : meme etat, meme couleur,
    // memes libelles de presence et de chromatique, parce que c'est de la meme
    // presence, dans le meme jeu, qu'ils parlaient ; elle est seulement payante.
    //
    // Celle qui ne l'apporte pas prend `ABSENTE` par-dessus : le tiret des
    // vingt jeux qui n'ont pas l'espece, et pas un autre mot.
    //
    // Le sens de l'etalement compte. `ABSENTE` passe APRES `ligne`, donc quand
    // `data/availability` dit deja que l'espece n'est pas dans ce jeu, les deux
    // disent la meme chose et il n'y a rien a arbitrer ; mais si `toutes`
    // pretendait le contraire, c'est `data/availability` qui l'emporterait —
    // voir l'en-tete, une sous-ligne ne peut jamais affirmer plus que son jeu.
    // `baseDonne` exige `present` pour la meme raison.
    const dlcRows = contenus.map((dlc) =>
      baseDonne || dlcApporte(dlc, species) ? { ...ligne, dlc } : { ...ligne, ...ABSENTE, dlc }
    );

    if (!requis.length) return { ...ligne, dlcRows };

    return { ...ligne, ...ABSENTE, dlcRows };
  });
}
