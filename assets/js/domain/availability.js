/**
 * availability.js — « ou trouver cette espece, et le shiny y est-il possible ? »
 *
 * Source : les champs gm / ev / nsh de data/details/gen-N.json.
 * Une espece sans donnee curatee renvoie simplement `curated: false` : la fiche
 * affiche alors une invite a completer le fichier plutot qu'un tableau vide.
 */

/** Quatre etats croises presence x chromatique, avec la couleur du tableau. */
export const AVAIL_STATE = {
  none: { label: "—", color: null },
  wild: { label: "Disponible", color: "var(--avail-ok)" },
  wildLocked: { label: "Disponible", color: "var(--avail-nolock)" },
  event: { label: "Événement", color: "var(--avail-event)" },
  eventLocked: { label: "Événement", color: "var(--avail-event-lock)" },
};

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

/** Une ligne par jeu, prete a etre rendue. */
export function availabilityRows(species, games) {
  return games.map((game) => {
    const present = species.games.has(game.code);
    const isEvent = species.eventGames.has(game.code);
    const shiny = canShinyIn(species, game);

    let state = "none";
    if (present) {
      if (isEvent) state = shiny ? "event" : "eventLocked";
      else state = shiny ? "wild" : "wildLocked";
    }

    return {
      game,
      present,
      isEvent,
      shiny,
      state,
      color: AVAIL_STATE[state].color,
      presenceLabel: AVAIL_STATE[state].label,
      shinyLabel: !present
        ? "—"
        : shiny
          ? "✦ Oui"
          : game.shinyOk === false
            ? "Gén. I"
            : "Bloqué",
    };
  });
}
