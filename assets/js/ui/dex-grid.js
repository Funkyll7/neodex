/**
 * dex-grid.js — la grille de vignettes.
 *
 * 1025 especes : on rend par paliers de CONFIG.pageSize et on charge la suite
 * quand la sentinelle de bas de liste entre dans le viewport. Chaque filtre
 * repart du premier palier.
 *
 * Deux principes qui evitent le bug de la case qui se recoche toute seule :
 *   - un seul ecouteur, delegue sur #grid, jamais detruit ;
 *   - cocher une case *repeint* la vignette au lieu de la remplacer, donc le
 *     bouton sous le doigt survit au clic et garde son focus.
 */

import { CONFIG } from "../config.js";
import { debounce } from "../core/store.js";
import { el, fill } from "../core/dom.js";
import { spriteImg, formImg } from "../domain/sprites.js";
import { completionOf } from "../domain/completion.js";
import { progressOf } from "../domain/progress.js";
import { formeDeRepli } from "../domain/display.js";
import { dexNumber, typeChip, typeInk } from "./common.js";
import { nomCosmetique, nomEspece, nomForme, t, tn } from "../core/i18n.js";

export function createGrid(ctx) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("grid-empty");
  const sentinel = document.getElementById("grid-sentinel");
  const counter = document.getElementById("result-count");

  let list = [];
  let shown = 0;
  /** La reprise n'a lieu qu'au tout premier rendu, pas a chaque filtre. */
  let premier = true;
  /** Vignettes que le filtre en cours exclut desormais : voir `setStale()`. */
  const rangees = new Set();

  /**
   * « 118 résultats · 2 rangés ». On ne ment pas sur le nombre : ce qui est
   * barre ne compte plus, mais reste visible.
   */
  function peindreCompteur() {
    const restant = list.length - rangees.size;
    counter.textContent =
      `${restant} ${tn(restant, "résultat", "résultats")}` +
      (rangees.size ? ` · ${rangees.size} ${tn(rangees.size, "rangé", "rangés")}` : "");
  }

  /**
   * Les vignettes loin de l'ecran gardent leur PLACE mais perdent leur contenu.
   *
   * Mesure sur la grille complete, du clic sur une case a l'image rendue :
   * 50,5 ms avec les 1025 vignettes garnies, 34 ms en n'en garnissant que 140.
   * Seize millisecondes et demie par case cochee — plus d'une image entiere, et
   * deux a trois fois cela sur un telephone.
   *
   * Ce qui coute n'est PAS le nombre d'emplacements de la grille : mesure aussi,
   * vider les vignettes sans les retirer rend exactement le meme gain (16,6 ms
   * contre 16,5). C'est le nombre de NOEUDS. D'ou ce choix, qui est le seul sans
   * danger : on garde la coquille, avec sa hauteur figee, et on ne retire que
   * ses enfants.
   *
   * Aucun calcul de hauteur, aucun espaceur, aucun saut de defilement possible —
   * la coquille tient sa place toute seule. C'est ce qui distingue cette
   * approche d'une virtualisation classique, ou une hauteur mal estimee fait
   * bondir la page sous le pouce.
   *
   * `content-visibility` ne remplace pas ceci : il est deja pose sur
   * `.card__select`, et mesure, l'etendre aux boutons ne change rien.
   *
   * 1200 px de marge : le contenu revient bien avant d'etre visible, on ne voit
   * donc jamais une vignette se remplir.
   */
  const veilleur = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) remplir(entry.target);
        else vider(entry.target);
      }
    },
    { rootMargin: "1200px 0px" }
  );

  function vider(node) {
    if (node.dataset.vide || !node.firstChild) return;
    const hauteur = node.getBoundingClientRect().height;
    // Hauteur nulle : la vignette n'a pas encore ete mise en page. La vider
    // maintenant lui ferait perdre sa place au lieu de la tenir.
    if (!hauteur) return;
    node.style.height = `${hauteur}px`;
    node.replaceChildren();
    node.dataset.vide = "1";
  }

  function remplir(node) {
    if (!node.dataset.vide) return;
    const espece = ctx.dataset.byId.get(Number(node.dataset.id));
    if (!espece) return;
    delete node.dataset.vide;
    node.style.height = "";
    garnir(node, espece, ctx);
    // `paint()` reecrit la liste de classes en entier : le barre, qui vit
    // ailleurs (voir `setStale`), doit etre repose ensuite.
    if (rangees.has(espece.id)) node.classList.add("card--stale");
  }

  /**
   * La hauteur de la barre d'outils, publiee en variable CSS.
   *
   * Le bandeau de generation colle juste sous elle. Or elle passe a la ligne
   * selon la largeur de l'ecran — 124 px sur un telephone etroit, moins sur un
   * large. Une valeur ecrite en dur dans la feuille de style glissait le
   * bandeau DERRIERE elle, ou il devenait invisible.
   */
  const barreOutils = grid.closest(".tabpanel")?.querySelector(".toolbar");
  if (barreOutils && typeof ResizeObserver === "function") {
    const publier = () => {
      const h = Math.round(barreOutils.getBoundingClientRect().height);
      if (h) document.documentElement.style.setProperty("--barre-outils-h", `${h}px`);
    };
    new ResizeObserver(publier).observe(barreOutils);
    publier();
  }

  /**
   * La generation du dernier Pokemon ajoute, pour savoir quand poser un bandeau.
   * `null` au depart de chaque rendu : le premier ajout en pose toujours un.
   */
  let derniereGen = null;

  /**
   * L'avancement par génération, pour les bandeaux. Recalculé UNE fois par
   * rendu complet et non par bandeau : `progressOf` parcourt les 1025 espèces
   * et toutes leurs cases, et il y a jusqu'à neuf bandeaux par grille.
   *
   * `null` tant qu'aucun rendu n'a eu lieu — les paliers suivants réutilisent
   * alors ce que le premier a calculé, ce qui est exact : ajouter des vignettes
   * ne change pas la collection.
   */
  let avancementParGen = null;

  function appendPage() {
    const next = list.slice(shown, shown + CONFIG.pageSize);
    const noeuds = [];
    // Les bandeaux de generation n'ont de sens que sur la liste rangee par
    // numero. Par nom ou par statistiques, les generations sont melangees et un
    // « Génération III » au milieu ne dirait rien.
    const parNumero = ctx.store.state.sort === "num";

    for (const species of next) {
      if (parNumero && species.gen !== derniereGen) {
        noeuds.push(separateurGeneration(species.gen, ctx, avancementParGen));
        derniereGen = species.gen;
      }
      noeuds.push(card(species, ctx));
    }

    grid.append(...noeuds);
    // Chaque vignette est surveillee des son arrivee : c'est ce qui la videra
    // quand elle s'eloignera, et la regarnira quand elle reviendra. Les
    // bandeaux, eux, ne se vident pas — ils ne pesent qu'un noeud.
    for (const noeud of noeuds) {
      if (noeud.classList.contains("card")) veilleur.observe(noeud);
    }
    shown += next.length;
  }

  /**
   * Le palier suivant se charge quand la sentinelle approche du bas de l'ecran.
   *
   * Avant, une boucle lisait `sentinel.getBoundingClientRect()` entre deux
   * `appendPage()`. Lire une position juste apres avoir ajoute 120 vignettes
   * oblige le navigateur a remettre en page toute la grille immediatement, et
   * la boucle recommencait : mesure sur un remplissage complet, 714 ms avec ces
   * lectures contre 455 ms sans. 259 ms de mise en page rejouee pour rien, et
   * une lecture forcee a chaque image tant qu'il reste des paliers.
   *
   * L'observateur ne lit jamais de position : c'est le navigateur qui previent,
   * une fois la mise en page faite, quand il l'a deja faite pour lui.
   *
   * `rootMargin` reprend exactement la marge de 600 px de l'ancienne boucle :
   * le palier suivant arrive avant qu'on ait atteint le bas.
   */
  const observer = new IntersectionObserver(
    (entries) => {
      if (shown >= list.length) return;
      if (!entries.some((entry) => entry.isIntersecting)) return;
      appendPage();
      // Un palier ne remplit pas toujours l'ecran (filtre tres large, grand
      // ecran) : la sentinelle reste alors visible, et un observateur ne
      // repond qu'aux CHANGEMENTS. On le re-arme donc pour obtenir une
      // nouvelle notification initiale — c'est ce qui remplace la boucle,
      // sans jamais lire de position nous-memes.
      rearmer();
    },
    { rootMargin: "600px 0px" }
  );

  function rearmer() {
    observer.unobserve(sentinel);
    if (shown < list.length) observer.observe(sentinel);
  }

  grid.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-slot]");
    if (toggle) {
      ctx.onToggle(Number(toggle.dataset.species), toggle.dataset.slot);
      return;
    }
    const select = event.target.closest(".card__select");
    if (select) ctx.onSelect(Number(select.closest(".card").dataset.id));
  });

  /* ----------------------- reprendre ou l'on en etait --------------------- */

  /**
   * La vignette au centre de l'ecran.
   *
   * `elementFromPoint` plutot qu'un parcours des mille enfants de la grille :
   * on releve cette position a chaque arret du defilement, un parcours y
   * couterait plus cher que le rendu lui-meme.
   *
   * Rien quand la feuille mobile est ouverte : au centre de l'ecran il y a
   * alors la fiche, pas la grille.
   */
  function repere() {
    if (document.body.classList.contains("sheet-open")) return null;
    const cible = document.elementFromPoint(
      Math.round(window.innerWidth / 2),
      Math.round(window.innerHeight / 2)
    );
    const carte = cible && cible.closest ? cible.closest(".card") : null;
    return carte ? Number(carte.dataset.id) : null;
  }

  function ecrireRepere() {
    const id = repere();
    if (!id) return;
    try {
      localStorage.setItem(CONFIG.storage.spot, String(id));
    } catch {
      /* stockage bloque : on repartira simplement du haut */
    }
  }

  function lireRepere() {
    try {
      const brut = Number(localStorage.getItem(CONFIG.storage.spot));
      return Number.isInteger(brut) && brut > 0 ? brut : null;
    } catch {
      return null;
    }
  }

  /**
   * Premier rendu de la session : on remonte a la vignette quittee.
   *
   * Les filtres et le dernier Pokemon consulte survivaient deja au
   * rechargement, mais pas la POSITION dans la liste. Or sur telephone la page
   * est rechargee sans arret — on bascule vers HOME, le systeme reprend la
   * memoire — et au retour on se retrouvait en haut de 1025 vignettes.
   *
   * On memorise le NUMERO de la vignette, jamais une hauteur en pixels : la
   * hauteur d'une carte change avec la largeur de l'ecran et le nombre de
   * colonnes.
   *
   * On ne peut pas defiler vers une vignette qui n'existe pas encore — la
   * grille se rend par paliers de 120. On deroule donc les paliers jusqu'a
   * elle, d'un coup : c'est exactement ce que le defilement ferait, en
   * plusieurs secondes de pouce.
   *
   * `block: "center"` et non `"start"` : la barre d'outils est collante et
   * recouvrirait une vignette calee en haut.
   */
  /**
   * La vignette ou revenir, retenue jusqu'a ce que la grille soit VISIBLE.
   *
   * Le premier rendu a lieu pendant que `#app` porte encore `hidden` : un
   * element cache n'a pas de boite, et `scrollIntoView` n'y peut donc rien. La
   * reprise deroulait bien ses paliers mais ne defilait jamais — on retrouvait
   * le haut de la liste avec six cents vignettes construites pour rien. Le
   * defaut est ancien ; il ne se voyait pas, la grille etant de toute facon
   * entierement garnie.
   *
   * C'est `reveal()` qui defile desormais, appele par main.js une fois la
   * grille demasquee — exactement ce que fait deja le Pokedex GO.
   */
  let aRejoindre = null;

  function reprendre() {
    const cible = lireRepere();
    if (!cible) return;
    const index = list.findIndex((p) => p.id === cible);
    if (index < 0) return;
    while (shown <= index && shown < list.length) appendPage();
    aRejoindre = cible;
  }

  // Ecrit au repos, pas a chaque pixel : le localStorage est synchrone, et un
  // defilement au pouce genere des dizaines d'evenements par seconde.
  window.addEventListener("scroll", debounce(ecrireRepere, 400), { passive: true });
  // Sur telephone on quitte l'onglet plus souvent qu'on ne le ferme, et la page
  // peut etre tuee juste apres : c'est le moment sur pour ecrire.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") ecrireRepere();
  });

  return {
    /**
     * La grille vient d'etre demasquee : c'est le premier instant ou elle a une
     * boite, donc le premier ou l'on peut defiler vers quelque chose.
     */
    reveal() {
      if (!aRejoindre) return;
      const node = grid.querySelector(`[data-id="${aRejoindre}"]`);
      aRejoindre = null;
      if (node) node.scrollIntoView({ block: "center", behavior: "auto" });
    },

    /** Rendu complet : nouvelle liste filtree. */
    render(filtered) {
      list = filtered;
      shown = 0;
      // C'est ici, et seulement ici, que les vignettes rangees s'en vont : un
      // changement de filtre est le moment ou l'on accepte que la liste bouge.
      rangees.clear();
      derniereGen = null;
      avancementParGen = progressOf(ctx.dataset.species, ctx.collection).gens;
      // Les anciennes vignettes disparaissent : plus rien a surveiller sur elles.
      veilleur.disconnect();
      grid.replaceChildren();
      empty.hidden = list.length > 0;
      peindreCompteur();
      appendPage();
      // Les filtres sont deja restaures a ce stade : la liste est bien celle
      // qu'on avait quittee, la vignette memorisee y a donc encore sa place.
      if (premier) {
        premier = false;
        reprendre();
      }
      // Re-armement : la liste a change, la sentinelle est peut-etre deja
      // visible sans avoir bouge d'un pixel.
      rearmer();
    },

    /**
     * La vignette ne correspond plus au filtre en cours — on vient de terminer
     * un Pokemon alors que « À terminer » est actif.
     *
     * Elle est BARREE, pas retiree. Reconstruire la liste a ce moment-la
     * decalait toutes les vignettes d'un cran et remettait le defilement au
     * premier palier : un Pokemon termine coutait une remontee de liste,
     * exactement au moment ou l'on enchaine le mieux. Elle s'en va au prochain
     * changement de filtre, quand la liste a de toute facon le droit de bouger.
     *
     * Elle reste aussi dans `visible` cote main.js, donc les fleches ‹ › et les
     * touches ← → continuent de passer dessus — c'est ce qu'on veut : on vient
     * peut-etre de terminer le voisin par erreur.
     */
    setStale(id, stale) {
      const node = grid.querySelector(`[data-id="${id}"]`);
      if (!node) return;
      if (node.classList.contains("card--stale") === stale) return;
      node.classList.toggle("card--stale", stale);
      if (stale) rangees.add(id);
      else rangees.delete(id);
      peindreCompteur();
    },

    /** Repeint une seule vignette apres un clic sur une case. */
    refresh(id) {
      const node = grid.querySelector(`[data-id="${id}"]`);
      if (!node) return;
      // Une vignette videe n'a rien a repeindre : elle se regarnira a jour
      // quand elle reviendra pres de l'ecran.
      if (node.dataset.vide) return;
      const wasComplete = node.classList.contains("card--complete");
      paint(node, ctx.dataset.byId.get(id), ctx);
      // La vignette vient de basculer sur « complet » : c'est le seul moment ou
      // l'animation a un sens. La jouer en permanence sur cent vignettes
      // fatiguerait l'oeil et la machine.
      if (!wasComplete && node.classList.contains("card--complete")) {
        node.classList.add("card--just-complete");
      }
    },

    /** Met a jour l'anneau de selection sans tout redessiner. */
    setSelected(id, previousId) {
      for (const value of [previousId, id]) {
        const node = grid.querySelector(`[data-id="${value}"]`);
        if (node) node.classList.toggle("card--selected", value === id);
      }
    },
  };
}

/* ------------------------------- vignette -------------------------------- */

/** Squelette : tout ce qui ne bouge jamais. Le reste est pose par paint(). */
/**
 * Le bandeau qui dit dans quelle generation on se trouve.
 *
 * Colle en haut de la grille et se laisse pousser par le suivant : c'est le
 * comportement natif de `position: sticky` dans une grille, sans le moindre
 * ecouteur de defilement. Mille vingt-cinq vignettes se parcourent au pouce
 * pendant plusieurs secondes sans le moindre repere ; celui-ci dit ou l'on est
 * sans qu'on ait a lire un numero.
 *
 * Pose UNIQUEMENT quand la liste est triee par numero — voir `appendPage`.
 * Trie par nom ou par statistiques, un bandeau « Génération III » au milieu de
 * la liste ne voudrait rien dire.
 */
function separateurGeneration(gen, ctx, avancement) {
  const info = ctx.dataset.generations[gen] || {};
  const titre = info.region ? `${t(info.label)} — ${t(info.region)}` : t(info.label || `${t("Génération")} ${gen}`);

  // Le compte de la génération, à droite du nom.
  //
  // C'était le seul repère de navigation d'une grille de 1025 vignettes, et il
  // ne disait que son nom. « Kanto » ne se compare à rien ; « Kanto 148/151 »
  // dit d'un coup s'il reste du travail ici ou s'il faut descendre.
  //
  // Le bandeau reste une PASTILLE et non une barre pleine largeur, malgré
  // l'envie : il est collant, opaque, et une bande de la largeur de la grille
  // masquerait une rangée entière de vignettes pendant tout le défilement.
  // La pastille, elle, laisse passer les cartes de chaque côté.
  const seau = avancement && avancement[gen];
  const compte = seau
    ? el("span.gen-sep__compte", `${seau.done} / ${seau.total}`)
    : null;

  return el(
    "div.gen-sep",
    { dataset: { gen: String(gen) }, "aria-hidden": "true" },
    el("span.gen-sep__nom", titre),
    compte
  );
}

/**
 * Le CONTENU d'une vignette, separe de sa coquille.
 *
 * Separe parce qu'il se pose et se retire : les vignettes loin de l'ecran
 * gardent leur place dans la grille mais perdent leur contenu. Voir
 * `vider()` / `remplir()` dans `createGrid`.
 */
function garnir(node, species, ctx) {
  const color = ctx.dataset.types[species.types[0]] || "#8b8b8b";

  node.replaceChildren(
    el(
      "button.card__select",
      { type: "button", "aria-label": `${t("Ouvrir la fiche de")} ${nomEspece(species)}` },
      el("span.card__top", el("span.card__num", dexNumber(species.id)), el("span.card__flags")),
      el("span.card__art"),
      el("span.card__name", nomEspece(species)),
      el(
        "span.card__types",
        species.types.map((type) => typeChip(type, ctx.dataset.types[type] || "#8b8b8b"))
      ),
      el("span.card__foot")
    ),
    el("div.card__toggles", quickToggles(species, ctx, color))
  );

  paint(node, species, ctx);
}

function card(species, ctx) {
  const color = ctx.dataset.types[species.types[0]] || "#8b8b8b";
  // Le second type, ou le premier quand il n'y en a qu'un. L'aura de la
  // vignette balaie de l'un a l'autre ; pour un mono-type elle balaie donc
  // d'une couleur vers elle-meme, ce qui rend exactement le halo d'avant.
  const color2 = ctx.dataset.types[species.types[1]] || color;

  const node = el("div.card", {
    "--type": color,
    "--type-2": color2,
    "--type-ink": typeInk(color),
    dataset: { id: species.id },
    role: "listitem",
  });

  garnir(node, species, ctx);
  return node;
}

/**
 * Remet la vignette a l'etat de la collection. Ne remplace que ce qui change :
 * l'image (quand on passe du normal au chromatique) et les deux lignes de
 * texte. Les boutons, eux, ne bougent jamais — on ne fait que retourner leur
 * `aria-pressed`.
 */
function paint(node, species, ctx) {
  const { collection, store, dataset } = ctx;
  const marks = collection.get(species.id);
  const owned = collection.isOwned(species.id);
  const shiny = collection.isShiny(species.id);
  const progress = completionOf(species, collection);

  const view = store.state.view;
  const showShiny = view === "shiny" || (shiny && view !== "normal");
  const showFemale = Boolean(species.gd) && (showShiny ? marks.sf && !marks.sm : marks.of && !marks.om);
  // On n'a pas la forme de base, mais on a une de ses formes alternatives :
  // c'est son sprite qu'il faut montrer. Voir domain/display.js.
  const repli = owned ? null : formeDeRepli(species, collection);
  // « Ni possédé ni absent ». Vrai aussi quand seul le chromatique de base est
  // coché : on l'a bien en boîte, dire « je n'ai rien » en le passant en gris
  // était faux — c'est seulement la forme normale qui manque.
  const partiel = !owned && (Boolean(repli) || shiny);

  node.className = [
    "card",
    owned ? "card--owned" : partiel ? "card--partial" : "card--missing",
    shiny ? "card--shiny" : "",
    showShiny && owned ? "card--shiny-art" : "",
    progress.complete ? "card--complete" : "",
    // Mise de côté : la vignette part en retrait, mais reste là et reste
    // cliquable. Sortir une espèce du décompte n'est pas la cacher — il faut
    // pouvoir revenir dessus, et voir ce qu'on a écarté.
    collection.estHorsAtteinte(species.id) ? "card--hors" : "",
    store.state.selectedId === species.id ? "card--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  node.title = progress.complete
    ? `${t("Tout obtenu")} — ${progress.total} ${tn(progress.total, "case", "cases")}`
    : (repli ? `${nomForme(repli.form)} ${t("obtenu, pas la forme de base.")} ` : "") +
      `${progress.done} / ${progress.total} — ${t("reste :")} ${progress.missing.join(", ")}`;

  fill(
    node.querySelector(".card__flags"),
    // L'étoile de complétion n'est plus dans cette rangée : elle se pose en
    // pastille dans le coin de la vignette (voir `.card--complete::after`),
    // où elle se repère sans être lue, et où elle ne dispute plus la place au
    // compteur de cases.
    null,
    // Le compteur repond a « combien de cases ce Pokemon demande-t-il ? »
    // sans avoir a ouvrir la fiche : Miaouss en veut huit, pas quatre.
    el(
      "span.card__flag.card__flag--count",
      { title: `${progress.done} ${tn(progress.done, "case cochée sur", "cases cochées sur")} ${progress.total}` },
      `${progress.done}/${progress.total}`
    ),
    species.formCount
      ? el("span.card__flag", { title: formTitle(species) }, `◈${species.formCount}`)
      : null,
    species.gd ? el("span.card__flag.card__flag--pair", { title: t("Formes ♂ et ♀ distinctes") }, "♂♀") : null
  );

  const gmax = gmaxState(species, collection);
  const art = node.querySelector(".card__art");
  const key = `${showShiny}-${showFemale}-${gmax}-${repli ? repli.form.id + (repli.shiny ? "s" : "") : ""}`;
  if (art.dataset.key !== key) {
    art.dataset.key = key;
    fill(
      art,
      repli
        ? formImg(repli.form, { shiny: repli.shiny, alt: nomForme(repli.form), className: "card__img" })
        : spriteImg(species.id, { shiny: showShiny, female: showFemale, alt: nomEspece(species), className: "card__img" }),
      showShiny
        ? el("span.card__spark", { title: t("Version chromatique affichée"), "aria-hidden": "true" })
        : null,
      // Sous l'étoile chromatique : l'emblème Gigamax, gris tant que la forme
      // n'est pas obtenue. Rien du tout chez les espèces qui n'en ont pas.
      gmax === "none"
        ? null
        : el(gmax === "owned" ? "span.card__gmax.card__gmax--on" : "span.card__gmax", {
            title: gmax === "owned" ? t("Forme Gigamax obtenue") : t("Forme Gigamax manquante"),
          }),
      // L''ornement des cadres  Laurier  et  Couronne  : une vraie couronne
      // posee sur la tete du Pokemon, un vrai laurier qui l''entoure.
      //
      // DANS LA ZONE DU SPRITE et non sur la vignette entiere, parce que c''est
      // le Pokemon qu''on couronne. Pose ailleurs, l''ornement tombait sur le
      // numero, sur les puces de type ou sur la pastille de completion — il
      // n''avait plus rien a decorer, il genait.
      //
      // Pose pour les 1025 et non pour les seules terminees : la completion
      // change en cochant une case, et un element a ajouter au vol aurait
      // demande de reconstruire la vignette a chaque fois. Vide et
      // `display: none` par defaut, il ne coute rien.
      el("span.card__ornement", { "aria-hidden": "true" })
    );
  }

  fill(
    node.querySelector(".card__foot"),
    progress.complete
      // Le signe vient du CSS, par `--marque` : c'est une récompense qu'on
      // choisit, et l'écrire ici en dur aurait obligé à reconstruire les 1025
      // vignettes à chaque changement. La pastille du coin lit la même variable.
      ? el("span.card__complete", el("i.card__marque", { "aria-hidden": "true" }), ` ${t("Complet")}`)
      : el("span.card__gen", t(dataset.generations[species.gen].game).replace("Pokémon ", ""))
  );

  for (const button of node.querySelectorAll("[data-slot]")) {
    button.setAttribute("aria-pressed", String(collection.has(species.id, button.dataset.slot)));
  }
}

/**
 * Etat Gigamax d'une espece, pour la pastille de la vignette.
 * « obtenue » des qu'une de ses formes Gigamax est cochee, normale ou
 * chromatique : avoir le Gigamax chromatique, c'est avoir le Gigamax.
 * @returns {"none"|"owned"|"missing"}
 */
function gmaxState(species, collection) {
  const forms = species.forms.filter((form) => form.kind === "gmax" && form.entry);
  if (!forms.length) return "none";
  const owned = forms.some(
    (form) => collection.has(species.id, form.slot) || collection.has(species.id, form.shinySlot)
  );
  return owned ? "owned" : "missing";
}

function formTitle(species) {
  // La pastille « ◈ 3 » liste ses formes en infobulle : elles se traduisent
  // comme partout ailleurs — les alternatives par leur clé PokeAPI, les
  // cosmétiques par leur nom français.
  const names = species.forms.map(nomForme);
  if (species.cosmetic && !species.cosmetic.info) names.push(nomCosmetique(species.cosmetic.title));
  return names.join(" · ");
}

/**
 * Cases rapides sous la vignette : ce qu'on coche le plus souvent.
 * Des pictogrammes, pas des mots — six boutons doivent tenir sur la largeur
 * d'une vignette de 150 px. Le libelle complet est dans le `title` et dans
 * l'`aria-label`.
 */
/**
 * Les pastilles des boutons — trois masques CSS, jamais du texte.
 *
 * Les glyphes Unicode qu'elles remplacent (●, ✦, ◈) dependaient de la police
 * installee et n'avaient rien a voir avec le vocabulaire visuel du jeu. En
 * masque plutot qu'en image de fond, chacune prend la couleur du bouton : elle
 * suit donc l'etat coche et le theme sans qu'on ait a fabriquer une variante.
 *
 *   capture       la Poke Ball pleine — « je l'ai attrape » ;
 *   capture-forme la meme, plus le losange ◈ en pastille — « je l'ai attrape,
 *                 sous une autre forme ». Elle sert aux formes dont la famille
 *                 n'a pas de logo officiel : Salarsen Forme Grave, Keldeo
 *                 Forme Resolue, Motisma Chaleur… qui n'avaient qu'un ◈ nu ;
 *   shiny         le logo chromatique.
 */
const icoBase = () => el("span.toggle__ico.toggle__ico--capture", { "aria-hidden": "true" });
const icoShiny = () => el("span.toggle__ico.toggle__ico--shiny", { "aria-hidden": "true" });
/**
 * ♂ en bleu, ♀ en rose — les deux couleurs deja employees par la fiche
 * (`.slot__tag`). La couleur porte l'information : sur un bouton de 26 px, le
 * glyphe seul se distingue mal de son voisin.
 */
const icoSexe = (glyphe) =>
  el(glyphe === "♀" ? "span.toggle__sex.toggle__sex--f" : "span.toggle__sex", { "aria-hidden": "true" }, glyphe);

/**
 * Le logo de la famille de la forme principale, quand il en existe un : le
 * bouton dit alors DE QUELLE variante il parle. Chez Florizarre ce sont ses
 * Gigamax, chez Miaouss sa forme d'Alola. Le losange ◈ ne servait qu'a dire
 * « une forme », sans preciser laquelle.
 */
const ICONES_FAMILLE = {
  alola: "assets/img/forme-alola.png",
  galar: "assets/img/forme-galar.png",
  hisui: "assets/img/forme-hisui.png",
  paldea: "assets/img/forme-paldea.png",
  gmax: "assets/img/gigamax.png",
};

const icoFamille = (kind) =>
  ICONES_FAMILLE[kind]
    ? el("img.toggle__fam", { src: ICONES_FAMILLE[kind], alt: "", width: 13, height: 13, loading: "lazy" })
    : el("span.toggle__ico.toggle__ico--capture-forme", { "aria-hidden": "true" });

function quickToggles(species, ctx, color) {
  // Les NOMS des formes suivent la langue au meme titre que les suffixes qui
  // les accompagnent. Sans cela le bouton disait « Dracaufeu Gigamax — normal »
  // en anglais : moitie francais, moitie anglais, dans le meme libelle.
  const base = species.cosmetic && species.cosmetic.baseVariant;
  const nomBase = base ? nomCosmetique(base.name) : "";
  const definitions = species.gd
    ? [
        ["om", [icoSexe("♂")], t("Mâle normal"), false],
        ["of", [icoSexe("♀")], t("Femelle normale"), false],
      ]
    : [["om", [icoBase()], base ? `${nomBase} — ${t("normal")}` : t("Marquer comme capturé"), false]];

  if (!species.noShiny) {
    if (species.gd) {
      definitions.push(
        ["sm", [icoShiny(), icoSexe("♂")], t("Shiny mâle"), true],
        ["sf", [icoShiny(), icoSexe("♀")], t("Shiny femelle"), true]
      );
    } else {
      definitions.push([
        "sm",
        [icoShiny()],
        base ? `${nomBase} — ${t("shiny")}` : t("Marquer le shiny obtenu"),
        true,
      ]);
    }
  }

  // Une seule forme est proposee ici : la principale. Les autres se cochent
  // dans la fiche, ou elles sont accompagnees de leur sprite et de leur texte.
  const primary = species.primaryForm;
  if (primary) {
    const nomPrimaire = nomForme(primary);
    definitions.push([primary.slot, [icoFamille(primary.kind)], `${nomPrimaire} — ${t("forme normale")}`, false]);
    if (primary.shinyEntry) {
      definitions.push([
        primary.shinySlot,
        [icoShiny(), icoFamille(primary.kind)],
        `${nomPrimaire} — ${t("shiny")}`,
        true,
      ]);
    }
  }

  return definitions.map(([slot, label, title, gold]) =>
    el(
      [
        "button.toggle",
        gold ? "toggle--gold" : "",
        // Marque les cases ♂ / ♀ : cochées, elles se remplissent de la couleur
        // du symbole — bleu pour ♂, rose pour ♀. Voir components.css.
        label.some((n) => n && n.classList && n.classList.contains("toggle__sex")) ? "toggle--sex" : "",
        label.some((n) => n && n.classList && n.classList.contains("toggle__sex--f")) ? "toggle--sex-f" : "",
      ]
        .filter(Boolean)
        .join("."),
      {
        type: "button",
        title,
        "aria-label": `${title} — ${nomEspece(species)}`,
        "--type": color,
        "--type-ink": typeInk(color),
        dataset: { slot, species: species.id },
      },
      label
    )
  );
}
