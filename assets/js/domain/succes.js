/**
 * succes.js — les succès, et les thèmes qu'ils déverrouillent.
 *
 * RIEN N'EST STOCKÉ, et c'est le choix qui tient tout le fichier.
 *
 * On avait d'abord prévu de ranger les succès obtenus dans `collection.json`,
 * sous une clé à part, pour qu'ils suivent d'un appareil à l'autre. C'était
 * inutile : chacun des cinq se DÉDUIT des compteurs que `progressOf()` calcule
 * déjà à chaque rendu. Un succès stocké aurait été une seconde vérité à tenir
 * d'accord avec la première — avec tout ce que ça suppose de dérive le jour où
 * une case se décoche, où une espèce change de génération, où le dénominateur
 * bouge parce qu'une forme nouvelle entre dans les données.
 *
 * Déduits, ils sont justes par construction, identiques sur tous les appareils
 * sans rien synchroniser, et surtout ils ne peuvent pas se perdre — ce qui
 * compte pour un fichier dont on vient de corriger un bug de perte de cases.
 *
 * Le seul état qui mérite d'être retenu est « celui-là, on l'a déjà annoncé »,
 * pour que le bandeau de déverrouillage ne se rejoue pas à chaque ouverture.
 * C'est du confort d'affichage, propre à un appareil : il vit dans les
 * préférences locales, et `ui/` s'en charge. Rien à faire ici.
 *
 * Ce module ne touche pas au DOM : `domain/` n'en a pas le droit, et il est
 * importé par `ui/theme.js` qui, lui, dessine.
 */

/**
 * Les cinq succès, du plus accessible au plus lointain.
 *
 * `mesure` rend un avancement chiffré et non un booléen : le menu des thèmes
 * affiche « 1733 / 2802 » sous un cadenas, et un oui-ou-non n'aurait rien dit
 * du chemin restant. Un succès qu'on ne peut pas situer décourage au lieu
 * d'attirer.
 *
 * `theme` est la valeur du thème que le succès rend visible — la même clé que
 * dans `ui/themes-list.js`, où ces cinq palettes portent `verrou`.
 */
export const SUCCES = [
  {
    cle: "mille-cases",
    titre: "Premier millier",
    resume: "Cocher mille cases.",
    theme: "aube",
    mesure: (p) => ({ fait: p.all.done, total: 1000 }),
  },
  {
    cle: "cent-chromatiques",
    titre: "Chasseur",
    resume: "Obtenir cent chromatiques.",
    theme: "prisme",
    mesure: (p) => ({ fait: p.shiny.done, total: 100 }),
  },
  {
    cle: "une-generation",
    titre: "Région bouclée",
    resume: "Terminer une génération entière.",
    theme: "cartouche",
    // La MEILLEURE génération, pas leur somme : le succès demande d'en finir
    // une, et afficher « 8 / 9 générations » aurait décrit un autre défi.
    // L'avancement montre donc celle dont on est le plus près.
    mesure: (p) => {
      const seaux = Object.values(p.gens || {});
      if (!seaux.length) return { fait: 0, total: 100 };
      const meilleure = seaux.reduce((a, b) => (b.pct > a.pct ? b : a));
      return { fait: meilleure.pct, total: 100 };
    },
  },
  {
    cle: "toutes-les-paires",
    titre: "Couples",
    resume: "Réunir toutes les paires ♂ / ♀.",
    theme: "duo",
    mesure: (p) => ({ fait: p.pairs.done, total: p.pairs.total }),
  },
  {
    cle: "pokedex-entier",
    titre: "Achevé",
    resume: "Cocher toutes les cases du Pokédex.",
    theme: "couronne",
    mesure: (p) => ({ fait: p.all.done, total: p.all.total }),
  },
];

/**
 * L'état des cinq succès, à partir des compteurs du moment.
 *
 * `fait` est plafonné à `total` : sans ce plafond, « 1733 / 1000 » se serait
 * affiché sous un succès déjà gagné, et une barre remplie à 173 %.
 *
 * Un `total` nul — aucune paire attendue, jamais le cas en pratique mais les
 * données peuvent bouger — donne un succès NON obtenu plutôt qu'un succès
 * gratuit : mieux vaut un cadenas de trop qu'une récompense qui tombe seule.
 */
export function evaluerSucces(progress) {
  if (!progress) return [];
  return SUCCES.map((succes) => {
    const { fait, total } = succes.mesure(progress);
    return {
      ...succes,
      fait: Math.min(fait, total),
      total,
      obtenu: total > 0 && fait >= total,
    };
  });
}

/** Les valeurs de thème que la collection actuelle rend visibles. */
export function themesDeverrouilles(progress) {
  return new Set(
    evaluerSucces(progress)
      .filter((succes) => succes.obtenu)
      .map((succes) => succes.theme)
  );
}

/** Le succès qui garde ce thème, ou `undefined` s'il est libre d'accès. */
export function succesDuTheme(valeur) {
  return SUCCES.find((succes) => succes.theme === valeur);
}
