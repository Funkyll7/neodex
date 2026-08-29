/**
 * hunt.js — choix de la meilleure methode de chasse au chromatique,
 * et tirage des quetes.
 *
 * Principe : pour une espece et un jeu, on part de la methode par defaut du jeu
 * (data/reference/hunt.json > byGame), puis on la corrige selon le cas :
 *   - legendaire ou rencontre unique  -> soft reset, raid Dynamax, faille Ultra
 *   - espece non rencontrable         -> on chasse la premiere forme de la lignee
 *   - forme offerte                   -> soft reset sur le don
 *   - jeu compatible Masuda           -> on garde le meilleur des deux taux
 *
 * Contrairement au mockup d'origine, la lignee est remontee via `evolvesFrom`
 * (donnee PokeAPI presente pour les 1025 especes) et non via une table de noms.
 */

export class HuntPlanner {
  constructor(dataset) {
    this.data = dataset;
    this.ref = dataset.hunt;
    this.rules = dataset.hunt.rules;
    this.giftLocked = new Set(this.rules.giftLocked);
    this.grassOnly = new Set(this.rules.grassOnly);
    this.staticOk = new Set(this.rules.staticSoftResetOk);
    this.dynamax = new Set(this.rules.dynamaxRaid);
    this.wormhole = new Set(this.rules.ultraWormhole);
    this.grass = new Set(this.rules.grassEncounter);
  }

  /* ------------------------------ predicats ----------------------------- */

  /** Rencontre unique : legendaire, fabuleux, ou marque `stat` dans les details. */
  isStatic(species) {
    return Boolean(species.legend || species.mythic || species.isStaticEncounter);
  }

  /**
   * Se croise-t-elle dehors dans ce jeu ?
   * La reponse vient de data/availability/ (rencontres reelles de PokeAPI), pas
   * d'une lecture du texte : un Pikachu se chasse dans l'herbe de Rouge/Bleu
   * mais est le starter de Jaune, et les deux cas se distinguent tout seuls.
   */
  isWildIn(species, gameCode) {
    return species.wildGames.has(gameCode);
  }

  /**
   * Remonte la lignee jusqu'a la forme qu'on chasse reellement dans ce jeu :
   * le premier ancetre qu'on peut vraiment croiser. On s'arrete avant les
   * bebes — personne ne chasse un Pichu pour un Pikachu.
   */
  huntTarget(species, gameCode) {
    let current = species;
    let lineageEnd = species;
    for (let step = 0; step < 6; step += 1) {
      if (this.isWildIn(current, gameCode)) return { species: current, isGift: false };
      if (!current.evolvesFrom) break;
      const parent = this.data.byId.get(current.evolvesFrom);
      if (!parent || parent.baby) break;
      current = parent;
      lineageEnd = parent;
    }
    // Personne dans la lignee ne se croise ici : c'est un don ou un echange.
    return { species: lineageEnd, isGift: true };
  }

  /** La cible se croise-t-elle vraiment dans les hautes herbes ? */
  targetIsGrass(species, gameCode) {
    const target = this.huntTarget(species, gameCode);
    if (target.isGift) return true;
    if (target.species.habitat) return target.species.habitat === "herbe";
    return this.grass.has(target.species.name);
  }

  /* ------------------------------- methodes ----------------------------- */

  /** Meilleure methode pour une espece dans un jeu donne. */
  methodFor(gameCode, species) {
    const game = this.data.gamesByCode.get(gameCode) || { gen: 5 };
    let base = this.ref.byGame[gameCode] || this.ref.fallback;

    // Poke Radar (Sinnoh, X/Y) : inoperant hors hautes herbes.
    if (this.grassOnly.has(gameCode) && !this.targetIsGrass(species, gameCode)) {
      base = this.withEraOdds(this.ref.templates.wildFallback, game);
    }

    if (this.isStatic(species)) {
      if (gameCode === "swsh" && this.dynamax.has(species.id)) return this.ref.templates.dynamax;
      if (gameCode === "usum" && this.wormhole.has(species.id)) return this.ref.templates.wormhole;
      return this.withEraOdds(this.ref.templates.softReset, game);
    }

    if (!this.isWildIn(species, gameCode)) {
      const target = this.huntTarget(species, gameCode);
      const method = target.isGift
        ? this.giftMethod(target.species.name, species, game)
        : this.evolutionMethod(base, target.species.name, species);
      return this.easiest(method, this.masudaMethod(gameCode, target.species.name, species));
    }

    return this.easiest(base, this.masudaMethod(gameCode, species.name, species));
  }

  /** Taux ancien (1/8192) avant la Gen. VI, moderne (1/4096) ensuite. */
  withEraOdds(template, game) {
    return {
      name: template.name,
      odds: game.gen <= 5 ? template.odds.old : template.odds.new,
      steps: template.steps,
    };
  }

  giftMethod(targetName, species, game) {
    const direct = this.withEraOdds(this.ref.templates.gift, game);
    if (targetName === species.name) return direct;
    const tpl = this.ref.templates.giftLine;
    return {
      name: fill(tpl.name, { cible: targetName }),
      odds: direct.odds,
      steps: tpl.steps.map((s) => fill(s, { cible: targetName, nom: species.name })),
    };
  }

  evolutionMethod(base, targetName, species) {
    const tpl = this.ref.templates.evolution;
    return {
      name: fill(tpl.name, { base: base.name, cible: targetName }),
      odds: base.odds,
      steps: [
        fill(tpl.intro, { nom: species.name, cible: targetName }),
        ...base.steps,
        `${fill(tpl.outro, { cible: targetName })} ${species.where || ""}`.trim(),
      ],
    };
  }

  masudaMethod(gameCode, targetName, species) {
    const odds = this.ref.masudaOdds[gameCode];
    if (!odds || this.isStatic(species)) return null;
    const tpl = this.ref.templates.masuda;
    const hasCharm = oddsValue(odds) <= 512;
    const vars = {
      cible: targetName,
      nom: species.name,
      charme: hasCharm ? tpl.charme : "",
      evolution: targetName === species.name ? "" : fill(tpl.evolution, { nom: species.name }),
    };
    return { name: fill(tpl.name, vars), odds, steps: tpl.steps.map((s) => fill(s, vars)) };
  }

  /** Entre deux methodes, garde celle au meilleur taux. */
  easiest(a, b) {
    if (!a) return b;
    if (!b) return a;
    return oddsValue(b.odds) < oddsValue(a.odds) ? b : a;
  }

  /* -------------------------------- quetes ------------------------------ */

  /** Jeux ou une quete sur cette espece a du sens. */
  questGames(species) {
    let games = this.data.games.filter(
      (g) => species.games.has(g.code) && g.shinyOk !== false && !species.shinyLocked.has(g.code)
    );
    if (this.isStatic(species)) {
      games = games.filter(
        (g) => this.staticOk.has(g.code) || (g.code === "swsh" && this.dynamax.has(species.id))
      );
    } else {
      // Un don shiny-locke reste chassable si le jeu permet la methode Masuda.
      games = games.filter(
        (g) =>
          this.isWildIn(species, g.code) ||
          !this.huntTarget(species, g.code).isGift ||
          !this.giftLocked.has(g.code) ||
          Boolean(this.ref.masudaOdds[g.code])
      );
    }
    return games;
  }

  /** Le jeu au meilleur taux (tirage au sort en cas d'egalite). */
  bestGame(species) {
    const games = this.questGames(species);
    if (!games.length) return null;
    const scored = games.map((g) => ({ game: g, odds: oddsValue(this.methodFor(g.code, species).odds) }));
    const best = Math.min(...scored.map((s) => s.odds));
    const tied = scored.filter((s) => s.odds === best);
    return tied[Math.floor(Math.random() * tied.length)].game;
  }

  /** Especes eligibles a une quete : celles dont la disponibilite est renseignee. */
  questPool(collection) {
    const pool = [];
    for (const species of this.data.species) {
      if (!species.curated) continue;
      if (collection.isShiny(species.id)) continue;
      const game = this.bestGame(species);
      if (game) pool.push({ species, game });
    }
    return pool;
  }

  /**
   * Tire une quete parmi les especes dont le chromatique manque.
   *
   * @param {object} collection
   * @param {Map<number, {jeu: string}>} [ouvertes] chasses deja commencees,
   *   indexees par espece. Voir `chassesOuvertes()` de domain/quetes.js.
   */
  roll(collection, ouvertes = null) {
    const pool = this.questPool(collection);
    if (!pool.length) return null;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    // Une chasse deja entamee sur cette espece impose SON jeu. `bestGame()`
    // tire au sort entre jeux a taux egal : sans cette reprise, retomber sur la
    // meme espece aurait pu designer un autre jeu, donc une autre chasse, et le
    // compteur serait reparti de zero en laissant les rencontres deja comptees
    // sous une entree qu'on ne retrouvait plus.
    const dejaOuverte = ouvertes && ouvertes.get(pick.species.id);
    if (dejaOuverte) return { id: pick.species.id, game: dejaOuverte.jeu };

    return { id: pick.species.id, game: pick.game.code };
  }
}

/* -------------------------------- helpers -------------------------------- */

/** "1/8192" ou "~1/200" -> 8192 / 200. Sert a comparer deux methodes. */
export function oddsValue(odds) {
  const match = /1\s*\/\s*([\d\s]+)/.exec(odds || "");
  return match ? parseInt(match[1].replace(/\s/g, ""), 10) : Number.MAX_SAFE_INTEGER;
}

/** Remplace les {variables} d'un gabarit. */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (key in vars ? vars[key] : ""));
}
