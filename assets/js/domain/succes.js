/**
 * succes.js — les succès, et les thèmes que cinq d'entre eux déverrouillent.
 *
 * RIEN N'EST STOCKÉ, et c'est le choix qui tient tout le fichier.
 *
 * On avait d'abord prévu de ranger les succès obtenus dans `collection.json`,
 * sous une clé à part, pour qu'ils suivent d'un appareil à l'autre. C'était
 * inutile : chacun se DÉDUIT des compteurs que `progressOf()` calcule déjà à
 * chaque rendu. Un succès stocké aurait été une seconde vérité à tenir d'accord
 * avec la première — avec tout ce que ça suppose de dérive le jour où une case
 * se décoche, où une espèce change de génération, où le dénominateur bouge
 * parce qu'une forme nouvelle entre dans les données.
 *
 * Déduits, ils sont justes par construction, identiques sur tous les appareils
 * sans rien synchroniser, et surtout ils ne peuvent pas se perdre — ce qui
 * compte pour un fichier dont on a déjà corrigé un bug de perte de cases.
 *
 * Le seul état qui mérite d'être retenu est « celui-là, on l'a déjà annoncé »,
 * pour que le bandeau de déverrouillage ne se rejoue pas à chaque ouverture.
 * C'est du confort d'affichage, propre à un appareil : il vit dans les
 * préférences locales, et `ui/` s'en charge. Rien à faire ici.
 *
 * CE QUE MESURE UN SUCCÈS.
 *
 * `mesure` reçoit un BILAN et non les seuls compteurs du Pokédex national.
 * Tant qu'il n'y avait que cinq succès, `progressOf()` suffisait ; les
 * cinquante-deux d'aujourd'hui parlent aussi du Pokédex GO, du carnet de
 * chasse et du nombre d'espèces entièrement obtenues. Le bilan rassemble ces
 * quatre sources, et `ui/` le fabrique une fois par rendu — au même endroit et
 * au même instant que les compteurs de la barre latérale, pour qu'un succès ne
 * puisse jamais annoncer autre chose que ce qui est affiché.
 *
 * `mesure` rend un avancement CHIFFRÉ et non un booléen : la page des succès
 * affiche « 1733 / 2000 » sous un cadenas, et un oui-ou-non n'aurait rien dit
 * du chemin restant. Un succès qu'on ne peut pas situer décourage au lieu
 * d'attirer.
 *
 * POURQUOI TOUS N'OUVRENT PAS UN THÈME.
 *
 * Cinq le font — ce sont les cinq d'origine, et leurs clés n'ont pas bougé
 * d'une lettre : `ui/themes-list.js` les référence par `verrou`, et les
 * préférences locales gardent la liste des succès déjà annoncés sous ces
 * mêmes clés. Les renommer aurait rejoué trente-huit bandeaux d'un coup et
 * reverrouillé cinq thèmes déjà gagnés.
 *
  * Les autres ouvrent l'un des cent quatorze cosmétiques — titres, marques,
 * cadres, motifs, bandeaux, sons, Balls, compagnons, écrans de chargement,
 * style de sprite, habillage de carte. Quelques-uns ne donnent rien de plus
 * qu'eux-mêmes, et c'est assumé : une récompense par succès aurait demandé
 * d'en inventer pour remplir des cases plutôt que par idée.
 *
 * Ce module ne touche pas au DOM : `domain/` n'en a pas le droit.
 */

import { totalPartie } from "./quetes.js";

/** Un seau vide, pour les compteurs qu'un bilan partiel n'a pas fournis. */
const VIDE = { done: 0, total: 0, pct: 0 };

/**
 * Rassemble en un bilan les quatre sources dont les succès parlent.
 *
 * Rien n'est recalculé ici : les deux progressions et les comptes d'espèces
 * arrivent tels que la barre latérale vient de les faire, et le carnet n'est
 * qu'une lecture. C'est la condition pour qu'un succès ne puisse jamais
 * annoncer autre chose que ce qui est affiché au même instant.
 *
 * `questDone` est passé plutôt que lu : ce compteur vit dans l'état de
 * l'application, pas dans la collection, et `domain/` n'a pas à le connaître.
 */
export function bilanDesSucces({ progression, progressionGo, comptes, carnet, questDone, regions }) {
  return {
    p: progression,
    // Le NOM des regions, indexe par numero de generation. Ce module ne connait
    // pas le jeu de donnees et n a pas a le connaitre : c est l appelant qui
    // lit `dataset.generations`, et il n en passe que ce dont un succes se sert.
    // Sans lui, « Region bouclee » ne pouvait annoncer qu un pourcentage nu,
    // sans dire DE QUELLE region il parle — ce qui etait justement la question.
    regions: regions || {},
    go: progressionGo,
    complets: comptes ? comptes.complete : 0,
    especes: comptes ? comptes.total : 0,
    questDone: questDone || 0,
    rencontres: Object.values((carnet && carnet.parties) || {}).reduce(
      (somme, part) => somme + totalPartie(part),
      0
    ),
  };
}

/** Un seau de `kinds`, sans jamais lever sur un bilan incomplet. */
const seau = (b, nom) => (b.p.kinds && b.p.kinds[nom]) || VIDE;

/** La somme de plusieurs seaux, pour les succès qui couvrent quatre régions. */
function somme(b, noms) {
  let fait = 0;
  let total = 0;
  for (const nom of noms) {
    const s = seau(b, nom);
    fait += s.done;
    total += s.total;
  }
  return { fait, total };
}

/**
 * Les générations non vides, en tableau.
 *
 * `entries` et non `values` : le numéro EST l'information qui manquait. Sans
 * lui, la mesure de « Région bouclée » savait qu'on était à 78 % sans pouvoir
 * dire de quelle région, ce qui est la seule chose qu'on veut savoir.
 */
const generations = (b) =>
  Object.entries(b.p.gens || {})
    .filter(([, g]) => g.total > 0)
    .map(([numero, g]) => ({ ...g, gen: Number(numero), region: (b.regions || {})[numero] || "" }));

/**
 * Ce qu'il faut savoir d'une génération : laquelle, et où on en est.
 *
 * Les nombres seulement, jamais une phrase : celle-ci se traduit, et ce module
 * ne parle aucune langue. L'affichage l'assemble.
 */
const detailRegion = (g) => ({
  quoi: "region",
  gen: g.gen,
  region: g.region,
  fait: g.done,
  total: g.total,
  reste: g.total - g.done,
  pct: g.total ? Math.floor((g.done / g.total) * 100) : 0,
});

/**
 * Les neuf « Fanatique » — une région bouclée, nommément.
 *
 * POURQUOI NEUF SUCCÈS ET NON UN SEUL. « Région bouclée » existe déjà et
 * demande d'en finir UNE, n'importe laquelle : c'est un défi qu'on relève une
 * fois, et l'avancement affiché est celui de la région dont on est le plus
 * près. Ces neuf-là posent la question région par région, ce qui est une tout
 * autre chose : ils donnent neuf objectifs distincts, et chacun ouvre sa propre
 * récompense.
 *
 * INDEXÉS PAR NUMÉRO DE GÉNÉRATION, PAS PAR NOM DE RÉGION. La clé d'un succès
 * voyage dans les préférences et ne doit jamais bouger ; le nom d'une région,
 * lui, se traduit — « Unys » est « Unova » en anglais. Le numéro est le seul
 * identifiant stable. Le nom reste écrit ici parce qu'il faut bien un titre,
 * mais il ne sert qu'à l'affichage et passe par `t()` comme le reste.
 *
 * TOUS AU RANG 4, ET AUCUN AU RANG 5. Boucler une région entière — formes,
 * chromatiques et variantes comprises — est un long travail quelle que soit la
 * région : les faire varier aurait laissé croire que Kanto est facile, ce qui
 * est faux, il porte les Pikachu à casquette et les Métamorphes. Le rang 5
 * reste à « Tour du monde », qui les demande toutes les neuf.
 */
const REGIONS_FANATIQUE = [
  [1, "Kanto"],
  [2, "Johto"],
  [3, "Hoenn"],
  [4, "Sinnoh"],
  [5, "Unys"],
  [6, "Kalos"],
  [7, "Alola"],
  [8, "Galar"],
  [9, "Paldea"],
];

/**
 * « de Kanto », mais « d'Unys ».
 *
 * Deux des neuf régions commencent par une voyelle, et « Fanatique de Unys »
 * se lit comme une faute parce que c'en est une. La règle est mécanique et
 * tient en une ligne ; l'écrire vaut mieux que recopier neuf titres entiers,
 * qu'il aurait fallu tenir d'accord avec neuf résumés.
 *
 * Le H de Hoenn est ASPIRÉ dans l'usage français de la série — « de Hoenn »,
 * jamais « d'Hoenn » —, il n'entre donc pas dans la liste.
 */
const de = (region) => (/^[AEIOUY]/.test(region) ? `d'${region}` : `de ${region}`);

const FANATIQUES = REGIONS_FANATIQUE.map(([gen, region]) => ({
  cle: `fanatique-${gen}`,
  rang: 4,
  titre: `Fanatique ${de(region)}`,
  court: region,
  resume: `Cocher toutes les cases ${de(region)} — chromatiques et formes comprises.`,
  famille: "Régions",
  icone: "drapeau",
  mesure: (b) => {
    const seau = (b.p.gens || {})[gen];
    // Une generation absente du jeu de donnees rend un succes NON obtenu, et
    // non un succes gratuit : meme regle que `complet()` juste au-dessus.
    if (!seau || !seau.total) return { fait: 0, total: 1 };
    return {
      fait: seau.done,
      total: seau.total,
      // La ligne de precision de « Region bouclee » vaut ici aussi : elle dit
      // ce qu'il reste, et c'est le nombre qu'on cherche devant un succes a
      // finir. Le nom vient du jeu de donnees quand il est la, du tableau
      // ci-dessus sinon — l'un est traduit, l'autre est un repli.
      detail: detailRegion({ ...seau, gen, region: (b.regions || {})[gen] || region }),
    };
  },
}));

/**
 * Un palier : « en avoir N ».
 *
 * La forme la plus courante, et celle qui se trompait le plus facilement à la
 * main — un `total` oublié donnait un succès gratuit, un `fait` non plafonné
 * une barre remplie à 173 %.
 */
const palier = (lire, cible) => (b) => ({ fait: lire(b), total: cible });

/** Un seau entier : « tout avoir dans cette catégorie ». */
const complet = (lire) => (b) => {
  const s = lire(b);
  // Un seau VIDE — catégorie absente du jeu de données — donne un succès NON
  // obtenu plutôt qu'un succès gratuit : mieux vaut un cadenas de trop qu'une
  // récompense qui tombe toute seule le jour où une table se vide.
  return { fait: s.done, total: s.total || 1 };
};

/**
 * Les cinquante-deux succès, groupés par famille.
 *
 * `famille` ne sert qu'à la page des succès, qui en fait ses sections. Elle ne
 * change rien au calcul.
 *
 * `icone` est une clé de `ui/icones-succes.js`. Plusieurs succès d'une même
 * série partagent la leur : un palier de mille cases et un palier de deux mille
 * racontent la même chose, ils se distinguent par leur libellé et par leur
 * rang, pas par un dessin qu'il aurait fallu inventer différent pour rien.
 */
export const SUCCES = [
  /* ----------------------------- la collection ---------------------------- */
  {
    cle: "cent-cases",
    rang: 1,
    titre: "Premiers pas",
    court: "100 cases",
    resume: "Cocher cent cases.",
    famille: "Collection",
    icone: "case",
    mesure: palier((b) => b.p.all.done, 100),
  },
  {
    cle: "cinq-cents-cases",
    rang: 1,
    titre: "En chemin",
    court: "500 cases",
    resume: "Cocher cinq cents cases.",
    famille: "Collection",
    icone: "grille",
    mesure: palier((b) => b.p.all.done, 500),
  },
  {
    cle: "mille-cases",
    rang: 2,
    titre: "Premier millier",
    court: "1 000 cases",
    resume: "Cocher mille cases.",
    famille: "Collection",
    icone: "pile",
    theme: "aube",
    mesure: palier((b) => b.p.all.done, 1000),
  },
  {
    cle: "deux-mille-cases",
    rang: 3,
    titre: "Deux mille",
    court: "2 000 cases",
    resume: "Cocher deux mille cases.",
    famille: "Collection",
    icone: "pile",
    mesure: palier((b) => b.p.all.done, 2000),
  },
  {
    cle: "moitie-du-dex",
    rang: 3,
    titre: "À mi-chemin",
    court: "Moitié des cases",
    resume: "Cocher la moitié des cases du Pokédex.",
    famille: "Collection",
    icone: "moitie",
    // La moitié se calcule sur le total du moment, pas sur un nombre écrit en
    // dur : le dénominateur bouge à chaque génération nouvelle, et « 1401 »
    // aurait cessé d'être la moitié dès la suivante.
    mesure: (b) => ({ fait: b.p.all.done, total: Math.ceil(b.p.all.total / 2) || 1 }),
  },
  {
    cle: "pokedex-entier",
    rang: 5,
    titre: "Achevé",
    court: "Toutes les cases",
    resume: "Cocher toutes les cases du Pokédex.",
    famille: "Collection",
    icone: "couronne",
    theme: "couronne",
    mesure: complet((b) => b.p.all),
  },
  {
    cle: "cent-complets",
    rang: 2,
    titre: "Cent complets",
    court: "100 complets",
    resume: "Obtenir cent Pokémon entièrement complets.",
    famille: "Collection",
    icone: "etoile",
    mesure: palier((b) => b.complets, 100),
  },
  {
    cle: "cinq-cents-complets",
    rang: 3,
    titre: "Cinq cents complets",
    court: "500 complets",
    resume: "Obtenir cinq cents Pokémon entièrement complets.",
    famille: "Collection",
    icone: "etoile",
    mesure: palier((b) => b.complets, 500),
  },
  {
    cle: "tous-complets",
    rang: 5,
    titre: "Rien ne manque",
    court: "Tous complets",
    resume: "Obtenir chaque Pokémon entièrement complet.",
    famille: "Collection",
    icone: "laurier",
    mesure: (b) => ({ fait: b.complets, total: b.especes || 1 }),
  },

  /* --------------------------- les chromatiques --------------------------- */
  {
    cle: "dix-chromatiques",
    rang: 1,
    titre: "Première lueur",
    court: "10 chromatiques",
    resume: "Obtenir dix chromatiques.",
    famille: "Chromatiques",
    icone: "etincelle",
    mesure: palier((b) => b.p.shiny.done, 10),
  },
  {
    cle: "cinquante-chromatiques",
    rang: 1,
    titre: "Éclat",
    court: "50 chromatiques",
    resume: "Obtenir cinquante chromatiques.",
    famille: "Chromatiques",
    icone: "etincelle",
    mesure: palier((b) => b.p.shiny.done, 50),
  },
  {
    cle: "cent-chromatiques",
    rang: 2,
    titre: "Chasseur",
    court: "100 chromatiques",
    resume: "Obtenir cent chromatiques.",
    famille: "Chromatiques",
    icone: "etincelles",
    theme: "prisme",
    mesure: palier((b) => b.p.shiny.done, 100),
  },
  {
    cle: "deux-cent-cinquante-chromatiques",
    rang: 3,
    titre: "Chasseur confirmé",
    court: "250 chromatiques",
    resume: "Obtenir deux cent cinquante chromatiques.",
    famille: "Chromatiques",
    icone: "etincelles",
    mesure: palier((b) => b.p.shiny.done, 250),
  },
  {
    cle: "cinq-cents-chromatiques",
    rang: 3,
    titre: "Chasseur émérite",
    court: "500 chromatiques",
    resume: "Obtenir cinq cents chromatiques.",
    famille: "Chromatiques",
    icone: "prisme",
    mesure: palier((b) => b.p.shiny.done, 500),
  },
  {
    cle: "mille-chromatiques",
    rang: 4,
    titre: "Mille éclats",
    court: "1 000 chromatiques",
    resume: "Obtenir mille chromatiques.",
    famille: "Chromatiques",
    icone: "arcenciel",
    mesure: palier((b) => b.p.shiny.done, 1000),
  },
  {
    cle: "tous-chromatiques",
    rang: 5,
    titre: "Tout brille",
    court: "Tous chromatiques",
    resume: "Obtenir chaque chromatique existant.",
    famille: "Chromatiques",
    icone: "soleil",
    mesure: complet((b) => b.p.shiny),
  },

  /* ------------------------------ les paires ------------------------------ */
  {
    cle: "moitie-paires",
    rang: 2,
    titre: "Premiers couples",
    court: "Moitié des paires",
    resume: "Réunir la moitié des paires ♂ / ♀.",
    famille: "Paires",
    icone: "duo",
    mesure: (b) => ({ fait: b.p.pairs.done, total: Math.ceil(b.p.pairs.total / 2) || 1 }),
  },
  {
    cle: "toutes-les-paires",
    rang: 4,
    titre: "Couples",
    court: "Toutes les paires",
    resume: "Réunir toutes les paires ♂ / ♀.",
    famille: "Paires",
    icone: "coeur",
    theme: "duo",
    mesure: complet((b) => b.p.pairs),
  },

  /* ----------------------------- les régions ------------------------------ */
  {
    cle: "une-generation",
    rang: 3,
    titre: "Région bouclée",
    court: "1 génération",
    // « Terminer une génération » était ambigu, et l'ambiguïté coûtait cher : on
    // peut avoir attrapé les 72 Pokémon de Kalos et n'être qu'à 78 % de ses
    // CASES, parce qu'il reste les chromatiques, les formes et les variantes
    // cosmétiques. Le résumé dit maintenant ce qui est compté.
    resume: "Cocher toutes les cases d'une génération — chromatiques et formes comprises.",
    famille: "Régions",
    icone: "drapeau",
    theme: "cartouche",
    // La MEILLEURE génération, pas leur somme : le succès demande d'en finir
    // une, et afficher « 8 / 9 générations » aurait décrit un autre défi.
    // L'avancement montre donc celle dont on est le plus près.
    mesure: (b) => {
      const seaux = generations(b);
      if (!seaux.length) return { fait: 0, total: 100 };
      // Terminé si une génération a TOUTES ses cases. On compare les COMPTES et
      // non les pourcentages : `pct` est arrondi, et une génération à 99,6 %
      // s'affichait donc à 100 — le thème se débloquait alors qu'il restait des
      // cases à cocher.
      const finie = seaux.find((g) => g.done === g.total);
      if (finie) return { fait: 100, total: 100, detail: detailRegion(finie) };
      // Sinon on montre la plus avancée, plancher plutôt qu'arrondi et plafonnée
      // à 99 : un cadenas au-dessus de « 100 / 100 » serait incompréhensible.
      const meilleure = seaux.reduce((a, g) => (g.done / g.total > a.done / a.total ? g : a));
      return {
        fait: Math.min(99, Math.floor((meilleure.done / meilleure.total) * 100)),
        total: 100,
        // Le POURCENTAGE seul ne disait pas de quelle région il parlait, ni
        // combien de cases il restait. Les deux comptes voyagent donc à côté :
        // « 78 % » se lit tout autrement quand on sait que c'est Kalos et qu'il
        // reste huit cases.
        detail: detailRegion(meilleure),
      };
    },
  },
  {
    cle: "trois-generations",
    rang: 4,
    titre: "Trois régions",
    court: "3 générations",
    resume: "Cocher toutes les cases de trois générations.",
    famille: "Régions",
    icone: "carte",
    mesure: (b) => ({ fait: generations(b).filter((g) => g.done === g.total).length, total: 3 }),
  },
  ...FANATIQUES,
  {
    cle: "toutes-generations",
    rang: 5,
    titre: "Tour du monde",
    court: "9 générations",
    resume: "Cocher toutes les cases des neuf générations.",
    famille: "Régions",
    icone: "globe",
    mesure: (b) => {
      const seaux = generations(b);
      return { fait: seaux.filter((g) => g.done === g.total).length, total: seaux.length || 1 };
    },
  },
  {
    cle: "chaque-generation-entamee",
    rang: 1,
    titre: "Partout un peu",
    court: "Chaque région",
    resume: "Cocher au moins une case dans chaque génération.",
    famille: "Régions",
    icone: "boussole",
    mesure: (b) => {
      const seaux = generations(b);
      return { fait: seaux.filter((g) => g.done > 0).length, total: seaux.length || 1 };
    },
  },

  /* ------------------------------ les formes ------------------------------ */
  {
    cle: "toutes-alola",
    rang: 3,
    titre: "Îles",
    court: "Formes d'Alola",
    resume: "Obtenir toutes les formes d'Alola.",
    famille: "Formes",
    icone: "vague",
    mesure: complet((b) => seau(b, "alola")),
  },
  {
    cle: "toutes-galar",
    rang: 3,
    titre: "Couronne de Galar",
    court: "Formes de Galar",
    resume: "Obtenir toutes les formes de Galar.",
    famille: "Formes",
    icone: "tour",
    mesure: complet((b) => seau(b, "galar")),
  },
  {
    cle: "toutes-hisui",
    rang: 3,
    titre: "Hisui",
    court: "Formes de Hisui",
    resume: "Obtenir toutes les formes de Hisui.",
    famille: "Formes",
    icone: "montagne",
    mesure: complet((b) => seau(b, "hisui")),
  },
  {
    cle: "toutes-paldea",
    rang: 2,
    titre: "Paldéa",
    court: "Formes de Paldéa",
    resume: "Obtenir toutes les formes de Paldéa.",
    famille: "Formes",
    icone: "cristal",
    mesure: complet((b) => seau(b, "paldea")),
  },
  {
    cle: "toutes-regionales",
    rang: 4,
    titre: "Quatre régions, quatre formes",
    court: "4 régions",
    resume: "Obtenir toutes les formes régionales des quatre régions.",
    famille: "Formes",
    icone: "desert",
    mesure: (b) => {
      const { fait, total } = somme(b, ["alola", "galar", "hisui", "paldea"]);
      return { fait, total: total || 1 };
    },
  },
  {
    cle: "tous-gmax",
    rang: 4,
    titre: "Colosse",
    court: "Tous les Gigamax",
    resume: "Obtenir toutes les formes Gigamax.",
    famille: "Formes",
    icone: "geant",
    mesure: complet((b) => seau(b, "gmax")),
  },
  {
    cle: "moitie-cosmetiques",
    rang: 2,
    titre: "Motifs",
    court: "Moitié des motifs",
    resume: "Obtenir la moitié des formes cosmétiques.",
    famille: "Formes",
    icone: "papillon",
    mesure: (b) => {
      const s = seau(b, "cosmetic");
      return { fait: s.done, total: Math.ceil(s.total / 2) || 1 };
    },
  },
  {
    cle: "tous-cosmetiques",
    rang: 4,
    titre: "Collectionneur de motifs",
    court: "Tous les motifs",
    resume: "Obtenir toutes les formes cosmétiques.",
    famille: "Formes",
    icone: "palette",
    mesure: complet((b) => seau(b, "cosmetic")),
  },
  {
    cle: "toutes-autres-formes",
    rang: 4,
    titre: "Tout le reste",
    court: "Autres formes",
    resume: "Obtenir toutes les formes des autres catégories.",
    famille: "Formes",
    icone: "masque",
    mesure: complet((b) => seau(b, "other")),
  },

  /* ---------------------------- le Pokédex GO ----------------------------- */
  {
    cle: "cent-go",
    rang: 1,
    titre: "Premiers pas dans GO",
    court: "100 dans GO",
    resume: "Attraper cent Pokémon dans le Pokédex GO.",
    famille: "Pokémon GO",
    icone: "cible",
    mesure: palier((b) => b.go.owned, 100),
  },
  {
    cle: "cinq-cents-go",
    rang: 2,
    titre: "Explorateur",
    court: "500 dans GO",
    resume: "Attraper cinq cents Pokémon dans le Pokédex GO.",
    famille: "Pokémon GO",
    icone: "boussole",
    mesure: palier((b) => b.go.owned, 500),
  },
  {
    cle: "moitie-go",
    rang: 3,
    titre: "GO à mi-chemin",
    court: "Moitié de GO",
    resume: "Attraper la moitié du Pokédex GO.",
    famille: "Pokémon GO",
    icone: "moitie",
    mesure: (b) => ({ fait: b.go.owned, total: Math.ceil(b.go.total / 2) || 1 }),
  },
  {
    cle: "tous-go",
    rang: 5,
    titre: "GO complet",
    court: "Tout GO",
    resume: "Attraper tout le Pokédex GO.",
    famille: "Pokémon GO",
    icone: "globe",
    mesure: (b) => ({ fait: b.go.owned, total: b.go.total || 1 }),
  },
  {
    cle: "cinquante-go-shiny",
    rang: 2,
    titre: "Éclats de terrain",
    court: "50 shiny GO",
    resume: "Obtenir cinquante chromatiques dans le Pokédex GO.",
    famille: "Pokémon GO",
    icone: "etincelle",
    mesure: palier((b) => b.go.shiny, 50),
  },
  {
    cle: "deux-cents-go-shiny",
    rang: 4,
    titre: "Chasseur de terrain",
    court: "200 shiny GO",
    resume: "Obtenir deux cents chromatiques dans le Pokédex GO.",
    famille: "Pokémon GO",
    icone: "etincelles",
    mesure: palier((b) => b.go.shiny, 200),
  },

  /* ------------------------------ les chasses ----------------------------- */
  {
    cle: "premiere-quete",
    rang: 1,
    titre: "Première prise",
    court: "1 chasse",
    resume: "Mener une chasse jusqu'au bout.",
    famille: "Chasses",
    icone: "cible",
    mesure: palier((b) => b.questDone, 1),
  },
  {
    cle: "dix-quetes",
    rang: 2,
    titre: "Dix prises",
    court: "10 chasses",
    resume: "Mener dix chasses jusqu'au bout.",
    famille: "Chasses",
    icone: "carnet",
    mesure: palier((b) => b.questDone, 10),
  },
  {
    cle: "cinquante-quetes",
    rang: 4,
    titre: "Cinquante prises",
    court: "50 chasses",
    resume: "Mener cinquante chasses jusqu'au bout.",
    famille: "Chasses",
    icone: "trophee",
    mesure: palier((b) => b.questDone, 50),
  },
  {
    cle: "cent-rencontres",
    rang: 1,
    titre: "Cent rencontres",
    court: "100 rencontres",
    resume: "Compter cent rencontres dans le carnet.",
    famille: "Chasses",
    icone: "de",
    mesure: palier((b) => b.rencontres, 100),
  },
  {
    cle: "mille-rencontres",
    rang: 2,
    titre: "Mille rencontres",
    court: "1 000 rencontres",
    resume: "Compter mille rencontres dans le carnet.",
    famille: "Chasses",
    icone: "compteur",
    mesure: palier((b) => b.rencontres, 1000),
  },
  {
    cle: "dix-mille-rencontres",
    rang: 4,
    titre: "Dix mille rencontres",
    court: "10 000 rencontres",
    resume: "Compter dix mille rencontres dans le carnet.",
    famille: "Chasses",
    icone: "sablier",
    mesure: palier((b) => b.rencontres, 10000),
  },
];

/**
 * Les cinq crans de rareté, indexés par `rang - 1`.
 *
 * Ils ne servent qu'à nommer une couleur — `--rarete-1` à `--rarete-5`, définies
 * une fois pour toutes dans `theme.css` et identiques sur les trente-huit
 * palettes. Un cran n'a de sens que s'il ne bouge pas d'un thème à l'autre.
 */
export const RARETES = ["Commun", "Peu commun", "Rare", "Très rare", "Légendaire"];

/** Les familles, dans l'ordre où la page les présente. */
export const FAMILLES = ["Collection", "Chromatiques", "Paires", "Régions", "Formes", "Pokémon GO", "Chasses"];

/**
 * Complète un bilan partiel.
 *
 * Chaque `mesure` lit `b.p.all.done` ou `b.go.owned` sans se demander si la
 * source existe. Plutôt que cinquante-deux gardes recopiées, une seule
 * normalisation à l'entrée : un appelant qui ne fournit que les compteurs du
 * Pokédex national obtient des zéros ailleurs, jamais une exception.
 */
function normaliser(bilan) {
  const p = bilan.p || {};
  return {
    p: {
      all: p.all || VIDE,
      pairs: p.pairs || VIDE,
      shiny: p.shiny || VIDE,
      kinds: p.kinds || {},
      gens: p.gens || {},
    },
    go: bilan.go || { owned: 0, total: 0, shiny: 0, shinyTotal: 0, pct: 0 },
    complets: bilan.complets || 0,
    especes: bilan.especes || 0,
    questDone: bilan.questDone || 0,
    rencontres: bilan.rencontres || 0,
    regions: bilan.regions || {},
  };
}

/**
 * L'état des succès, à partir du bilan du moment.
 *
 * `fait` est plafonné à `total` : sans ce plafond, « 1733 / 1000 » se serait
 * affiché sous un succès déjà gagné, et une barre remplie à 173 %.
 *
 * Un `total` nul donne un succès NON obtenu plutôt qu'un succès gratuit : mieux
 * vaut un cadenas de trop qu'une récompense qui tombe toute seule.
 */
export function evaluerSucces(bilan) {
  if (!bilan) return [];
  const b = normaliser(bilan);
  return SUCCES.map((succes) => {
    const { fait, total, detail } = succes.mesure(b);
    return {
      ...succes,
      fait: Math.min(fait, total),
      total,
      // Absent chez cinquante et un succes sur cinquante-deux : seul « Region
      // bouclee » a quelque chose de plus a dire que son compte.
      detail: detail || null,
      obtenu: total > 0 && fait >= total,
    };
  });
}
