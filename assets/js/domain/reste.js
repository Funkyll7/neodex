/**
 * reste.js — ce qu'il reste à obtenir, jeu par jeu.
 *
 * LA QUESTION QU'AUCUNE VUE NE POSAIT. Le site sait montrer ce qu'on a et ce
 * qu'on n'a pas ; il ne savait pas répondre à « si je relance Émeraude, qu'est-ce
 * que ça me rapporte ». C'est pourtant la question qu'on se pose avant de
 * ressortir une cartouche, et elle a une réponse exacte : le croisement de ce
 * qui manque avec ce que ce jeu-là contient.
 *
 * DEUX NOMBRES, PAS UN. « Obtenable » et « attrapable en sauvage » ne
 * s'échangent pas :
 *
 *   obtenable    l'espèce EXISTE dans ce jeu, d'une façon ou d'une autre —
 *                échange, évolution, cadeau, événement, transfert ;
 *   en sauvage   on la croise dehors, c'est-à-dire qu'une soirée de jeu suffit.
 *
 * Un jeu qui « contient » quarante manques dont deux en sauvage ne vaut pas un
 * jeu qui en contient vingt dont dix-huit. Confondre les deux aurait donné un
 * classement faux, et un classement faux est pire qu'aucun classement.
 *
 * ON NE COMPTE QUE LES ESPÈCES, PAS LES CASES. Les formes régionales, les
 * chromatiques et les variantes cosmétiques ne se rattachent pas proprement à un
 * jeu : un Miaouss d'Alola n'existe pas dans Rouge, mais la table de
 * disponibilité parle de l'espèce Miaouss. Compter les cases aurait donc promis
 * des choses fausses. Une espèce est « à prendre » quand il lui manque au moins
 * sa case de base.
 *
 * Ce module ne touche pas au DOM.
 */

/**
 * Ce qu'un jeu apporterait.
 *
 * @param {Array}    especes
 * @param {Function} manque   (espece) => bool — vrai si l'espèce est à prendre
 * @param {string}   code     le code du jeu (« sv », « e », « hgss »…)
 */
export function resteDansLeJeu(especes, manque, code) {
  const sauvage = [];
  const autrement = [];
  for (const espece of especes) {
    if (!manque(espece)) continue;
    // `games` porte tout ce qui est obtenable dans ce jeu, `wildGames` le
    // sous-ensemble qu'on croise dehors. Les deux viennent de `core/data.js`,
    // qui a déjà fusionné la table de disponibilité et les fiches.
    if (!espece.games || !espece.games.has(code)) continue;
    if (espece.wildGames && espece.wildGames.has(code)) sauvage.push(espece);
    else autrement.push(espece);
  }
  return { code, sauvage, autrement, total: sauvage.length + autrement.length };
}

/**
 * Les jeux, classés par ce qu'ils rapporteraient.
 *
 * TRIÉS SUR LE SAUVAGE D'ABORD, et le total ensuite. C'est le seul ordre qui
 * corresponde à la question posée : entre deux jeux qui bouchent le même nombre
 * de trous, celui où on les attrape soi-même vaut mieux que celui qui demande
 * vingt échanges.
 *
 * Les jeux qui n'apportent rien restent dans la liste, en bas : les retirer
 * aurait laissé croire à un oubli de données. Un zéro est une réponse.
 */
export function classementDesJeux(especes, manque, jeux) {
  const aPrendre = especes.filter(manque);
  return jeux
    .map((jeu) => ({ jeu, ...resteDansLeJeu(aPrendre, () => true, jeu.code) }))
    .sort((a, b) => b.sauvage.length - a.sauvage.length || b.total - a.total);
}
