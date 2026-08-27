/**
 * display.js — « quelle image la vignette doit-elle montrer ? »
 *
 * Une seule règle de jeu, mais qui ne pouvait vivre ni dans `collection.js`
 * (qui ne connaît pas les formes) ni dans `dex-grid.js` (qui ne doit contenir
 * aucune règle) : celle du repli sur une forme alternative.
 *
 * Le problème qu'elle résout : on possède le Miaouss d'Alola et lui seul. La
 * vignette affichait le Miaouss de Kanto en gris, comme si l'espèce était
 * entièrement absente de la collection — alors qu'on en a bien un exemplaire
 * en boîte, sous une autre forme.
 *
 * Deux traitements distincts, parce que les deux cas ne veulent pas dire la
 * même chose :
 *
 *   - une forme COSMÉTIQUE est le même Pokémon. Un Zarbi B est un Zarbi. Elle
 *     rend donc l'espèce « capturée » tout court, et c'est `collection.isOwned()`
 *     qui s'en charge.
 *   - une forme RÉGIONALE (ou Gigamax, ou toute forme à entrée propre) est un
 *     Pokémon de plus à ranger : elle ne remplace pas la forme de base. On ne
 *     la déclare donc pas capturée — on montre seulement SON sprite, pour que
 *     la vignette dise « j'ai celui-là, pas l'autre » au lieu de « je n'ai
 *     rien ».
 */

/**
 * La forme à afficher à la place de l'espèce, ou null.
 *
 * Le déclencheur est la seule question qui compte : **ai-je la forme de
 * base ?** Tant qu'elle manque, c'est le sprite de la forme possédée qui doit
 * s'afficher, en couleur.
 *
 * On ne regarde donc PAS le chromatique de l'espèce. C'était le cas de Keldeo :
 * son chromatique de base coché suffisait à faire taire cette fonction, la
 * vignette retombait sur le sprite de l'espèce, et comme la forme normale de
 * base manquait toujours elle restait grise. On avait la Forme Décidée en boîte
 * et le Pokédex affichait un Keldeo éteint.
 *
 * @returns {{form: object, shiny: boolean}|null}
 */
export function formeDeRepli(species, collection) {
  if (collection.isOwned(species.id)) return null;

  for (const form of species.forms) {
    if (!form.entry) continue;
    // L'ordre de `species.forms` est celui du référentiel : la première forme
    // cochable est aussi celle que la vignette propose en raccourci. Montrer
    // une autre image que celle du bouton juste en dessous serait déroutant.
    if (collection.has(species.id, form.slot) || (form.gendered && collection.has(species.id, form.slotF))) {
      return { form, shiny: false };
    }
    if (form.shinyEntry && (collection.has(species.id, form.shinySlot) || collection.has(species.id, form.shinySlotF))) {
      return { form, shiny: true };
    }
  }
  return null;
}
