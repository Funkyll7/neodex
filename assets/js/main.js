/**
 * main.js — point d'entree : charge les donnees, cable les vues, gere l'etat.
 *
 * Flux : un store unique -> un abonne qui repeint uniquement ce qui depend des
 * cles modifiees. Aucun framework, aucune etape de build : le dossier tel quel
 * est deployable sur GitHub Pages.
 */

import { CONFIG } from "./config.js";
import { createStore, debounce } from "./core/store.js";
import { el, fill } from "./core/dom.js";
import { ouvrirCanalJumeaux } from "./core/jumeaux.js";
import { loadDataset } from "./core/data.js";
import { Collection } from "./domain/collection.js";
import { GitHubSync } from "./domain/sync.js";
import { HuntPlanner } from "./domain/hunt.js";
import { applyFilters } from "./domain/filters.js";
import { isComplete, requiredSlots, neManqueQueLeChromatique } from "./domain/completion.js";
import { progressOf, goProgressOf } from "./domain/progress.js";
import { bilanDesSucces } from "./domain/succes.js";
import { initTheme, majSucces, retraduirePalette } from "./ui/theme.js";
import { jouer } from "./ui/sons.js";
import { initParametres, appliquerParametres, poserContexteParametres } from "./ui/parametres.js";
import { suivreCollection, autourDUneAdoption } from "./domain/journal.js";
import { versionCourante } from "./domain/maj.js";
import { renderMaj } from "./ui/maj.js";
import { renderLivingDex } from "./ui/livingdex.js";
import { iconeSvg } from "./ui/icones-succes.js";
import { initPageSucces } from "./ui/page-succes.js";
import { appliquerRecompenses, poserSourceDesEspeces } from "./ui/recompenses.js";
import { initCourbe } from "./ui/courbe.js";
import { chassesOuvertes } from "./domain/quetes.js";
import { estCaseChromatique, CASE_HORS } from "./domain/collection.js";

import { createSidebar } from "./ui/sidebar.js";
import { createGrid } from "./ui/dex-grid.js";
import { createGoDex } from "./ui/go-dex.js";
import { createDetailPanel } from "./ui/detail-panel.js";
import { createQuest } from "./ui/quest.js";
import { createSaveControls } from "./ui/save.js";
import { createShortcuts } from "./ui/shortcuts.js";
import { createToTop } from "./ui/to-top.js";
import { createActiveFilters } from "./ui/active-filters.js";
import { createUndo } from "./ui/undo.js";
import { tapCase, tapComplet, tapAnnule } from "./ui/haptics.js";
import { initLangue, initBoutonLangue } from "./ui/langue.js";
import { nomEspece, nomForme, t } from "./core/i18n.js";

const FILTER_KEYS = ["search", "type", "gen", "game", "form", "sort", "status", "view", "mode", "sansGmax"];
/** Les filtres du Pokedex GO, qui ne pilotent que sa grille a lui. */
const GO_KEYS = ["goSearch", "goGen", "goStatus", "goType", "goMode"];

migrateStorage();
initTheme();
// Les réglages AVANT le premier rendu, et même avant les données : le mode
// compact n'est qu'un attribut sur <html>, et le poser tôt évite que la grille
// naisse en taille normale pour se contracter ensuite sous les yeux.
appliquerParametres();
// Les recompenses AVANT le premier rendu, pour la meme raison que le mode
// compact : la grille doit naitre avec son cadre plutot que le prendre sous les
// yeux. Ce ne sont que des attributs sur <html>, le CSS fait le reste.
appliquerRecompenses();
initParametres();
// La page des succes n a pas besoin des donnees : elle lit l etat que
// `ui/theme.js` tient a jour, et se dessine a l ouverture.
initPageSucces();
boot();

/**
 * Reprend ce qui etait range sous les anciennes cles `neodex.*`.
 *
 * Le site a change de nom ; les cles du localStorage aussi. Sans cette reprise,
 * le renommage aurait jete d'un coup les cases cochees pas encore
 * synchronisees, l'avancement des quetes, le theme et le jeton GitHub — des
 * choses invisibles mais penibles a refaire.
 *
 * L'ancienne cle est conservee : si le renommage devait etre annule, rien
 * n'est perdu. C'est quelques kilo-octets.
 */
function migrateStorage() {
  try {
    for (const [nom, cible] of Object.entries(CONFIG.storage)) {
      const source = CONFIG.storageLegacy[nom];
      if (!source || localStorage.getItem(cible) !== null) continue;
      const valeur = localStorage.getItem(source);
      if (valeur !== null) localStorage.setItem(cible, valeur);
    }
  } catch {
    /* stockage bloque : on repart simplement de zero */
  }
}

async function boot() {
  try {
    // La langue AVANT les donnees, et surtout avant le premier rendu : passer
    // a l'anglais demande un fichier, et sans cette attente la grille se
    // dessinerait en francais puis changerait sous les yeux.
    await initLangue();
    // La palette des thèmes est née plus haut, dans `initTheme()`, avant que la
    // table anglaise existe. C'est ici, et seulement ici, qu'on sait enfin dans
    // quelle langue on est. L'événement `funkylldex:langue` ne sert à rien pour
    // ce tour-ci : il n'est émis qu'au clic sur le bouton, pas au démarrage.
    retraduirePalette();
    start(await loadDataset());
  } catch (error) {
    const box = document.getElementById("boot-error");
    box.hidden = false;
    // Le message technique reste tel quel — il vient du navigateur ; seule
      // l'explication se traduit.
    box.textContent = `${error.message}. ${t("Les fichiers de data/ se chargent en fetch : ouvre le site via un serveur (python -m http.server) ou via GitHub Pages, pas en double-cliquant sur index.html.")}`;
    console.error(error);
  }
}

function start(dataset) {
  // Le menu des recompenses nomme ses compagnons par leur numero d espece : il
  // lui faut le jeu de donnees pour en tirer un nom traduit. Pose ici, au plus
  // tot apres le chargement, et avant tout rendu du menu.
  poserSourceDesEspeces((id) => dataset.byId.get(id));

  /** Liste filtree actuellement a l ecran : c est elle qui definit « suivant ». */
  let visible = [];
  const collection = new Collection(dataset.baseCollection, dataset);
  const sync = new GitHubSync(collection);
  const planner = new HuntPlanner(dataset);
  const store = createStore({
    tab: "dex",
    search: "",
    type: "all",
    gen: "all",
    game: "all",
    form: "all",
    sort: "num",
    status: "all",
    view: "auto",
    // La disposition du Pokedex HOME : « grille », « boites » ou « familles ».
    // Elle vit dans les filtres enregistres comme le tri et la vue, parce que
    // c est le meme genre de reglage — on la retrouve en revenant.
    mode: "grille",
    // Retirer les Gigamax du rangement en boites. Un Gigamax n occupe pas de
    // boite dans HOME : c est un pouvoir porte par un Pokemon deja range, pas
    // une creature de plus. Voir domain/livingdex.js.
    sansGmax: false,
    selectedId: 25,
    goSearch: "",
    goGen: "all",
    goType: "all",
    // La disposition du Pokedex GO, separee de celle de HOME : regarder ses
    // boites de HOME ne dit rien de la facon dont on veut regarder GO, et un
    // reglage commun aurait fait basculer les deux d un seul clic.
    goMode: "grille",
    goStatus: "all",
    ...loadFilters(),
    ...loadQuestState(),
  });

  const ctx = {
    dataset,
    collection,
    sync,
    planner,
    store,
    /**
     * Cocher une case, en gardant de quoi revenir en arriere.
     * L'etat d'avant est releve AVANT la bascule : c'est lui, et non l'inverse
     * de l'etat courant, que « Annuler » remettra en place.
     */
    onToggle: (id, slot) => {
      const avant = collection.has(id, slot);
      const species = dataset.byId.get(id);
      const etaitComplet = species ? complete(species) : false;
      collection.toggle(id, slot);
      sync.schedule(species ? species.name : `n° ${id}`);
      // Le bandeau se traduit ; le message de commit juste au-dessus, NON. Ce
      // dernier part dans l'historique du depot, qui est en francais de bout en
      // bout : le faire suivre la langue de l'interface aurait melange les deux
      // dans un journal qu'on relit des mois plus tard.
      undo.record(
        `${avant ? t("Case décochée") : t("Case cochée")} · ${species ? nomEspece(species) : `${t("n°")} ${id}`}` +
          ` — ${slotLabel(species, slot)}`,
        [{ id, slot, before: avant }]
      );
      const finiMaintenant = Boolean(species && !etaitComplet && complete(species));

      // Deux impulsions quand le Pokemon vient de basculer sur « complet » :
      // c'est le seul evenement de la session qui merite d'etre remarque sans
      // regarder l'ecran.
      if (finiMaintenant) tapComplet();
      else tapCase();

      // Le son suit le geste, et un seul se joue : espece terminee, sinon
      // chromatique coche, sinon la coche ou la decoche ordinaire. Les volumes
      // sont doses par RARETE dans ui/sons.js — un tic de case y est deux fois
      // et demie plus discret qu une quete reussie, et un limiteur empeche deux
      // tics de se declencher a moins de 50 ms. Sans quoi cocher au pouce en
      // rafale aurait fait une bouillie.
      if (finiMaintenant) jouer("complet");
      else if (!avant && estCaseChromatique(slot)) jouer("shiny");
      else jouer(avant ? "decase" : "case");
      onCollectionChange(id);
    },

    /**
     * Mettre une espece de cote, ou la remettre en jeu.
     *
     * Passe par le meme chemin qu'une case cochee — memes compteurs, meme
     * annulation, meme synchronisation — parce que c'en est une : la decision
     * voyage dans `marks`, sous une cle reservee. Voir CASE_HORS dans
     * domain/collection.js.
     *
     * Le geste est annulable comme les autres. Il ne touche AUCUNE case de
     * l'espece : la remettre en jeu la retrouve exactement comme elle etait, et
     * c'est ce qui permet de s'en servir sans y reflechir.
     */
    onHorsAtteinte: (id) => {
      const espece = dataset.byId.get(id);
      const nom = espece ? nomEspece(espece) : `${t("n°")} ${id}`;
      const avant = collection.estHorsAtteinte(id);
      collection.basculerHorsAtteinte(id);

      sync.schedule(espece ? espece.name : `n° ${id}`);
      undo.record(
        `${avant ? t("Remise dans le décompte") : t("Mise hors d'atteinte")} · ${nom}`,
        [{ id, slot: CASE_HORS, before: avant }]
      );
      tapCase();
      jouer(avant ? "case" : "passe");
      onCollectionChange(id);
    },

    /**
     * Remet un lot de cases dans l'etat qu'elles avaient. Appele par
     * `ui/undo.js`, et par lui seul.
     *
     * `toggle()` est une bascule : on ne la declenche que sur les cases qui ne
     * sont pas deja dans l'etat voulu. Sans ce test, annuler un lot dont une
     * case a ete recochee a la main la decocherait.
     */
    restoreMarks: (entries) => {
      const touches = new Set();
      for (const { id, slot, before } of entries) {
        if (collection.has(id, slot) !== before) collection.toggle(id, slot);
        touches.add(id);
      }
      sync.schedule("annulation depuis le site");
      tapAnnule();
      // Les deux Pokedex peuvent etre concernes, et l'entree ne dit pas lequel
      // est a l'ecran. Repeindre les deux coute deux vignettes ; se tromper
      // coute une case qui reste cochee sous les yeux apres l'annulation.
      if (touches.size === 1 && entries.length === 1) {
        onCollectionChange(entries[0].id);
        go.refresh(entries[0].id, entries[0].slot);
      } else {
        onCollectionChange();
        go.render();
      }
    },
    /**
     * Coche un LOT de cases d'un coup — la lecture de captures, aujourd'hui.
     *
     * Un seul pas d'annulation pour tout le lot : défaire une lecture de
     * trente cases ne doit pas demander trente appuis. Et comme partout, on
     * relève l'état d'avant plutôt que de supposer qu'il était vide.
     */
    applyBatch: (lot, titre) => {
      const entrees = [];
      for (const { id, slot } of lot) {
        const avant = collection.has(id, slot);
        if (avant) continue;
        collection.toggle(id, slot);
        entrees.push({ id, slot, before: avant });
      }
      if (!entrees.length) return 0;
      sync.schedule(titre);
      undo.record(titre, entrees);
      tapComplet();
      onCollectionChange();
      go.render();
      return entrees.length;
    },
    onCollectionChange: (id) => onCollectionChange(id),
    /**
     * Choisir une vignette. Retaper celle qui est deja selectionnee ne change
     * pas l'etat, donc n'aurait rien declenche : sur telephone, la feuille
     * refermee ne se rouvrait plus. On l'ouvre alors directement.
     */
    onSelect: (id) => {
      if (store.state.selectedId === id) detail.open();
      else store.set({ selectedId: id });
      toTop.refresh();
    },
    onSearchInput: debounce((event) => store.set({ search: event.target.value }), 160),
    /**
     * Une case du Pokedex GO. Chemin separe de `onToggle` : il n'y a ici ni
     * fiche a resynchroniser ni vignette HOME a repeindre, et surtout aucun
     * compteur HOME a refaire — cocher un GO ne change pas d'un point la
     * progression de l'autre Pokedex.
     */
    onGoToggle: (id, slot) => {
      const avant = collection.has(id, slot);
      collection.toggle(id, slot);
      const species = dataset.byId.get(id);
      // Deux noms, et c'est voulu : le francais pour le commit, la langue de
      // l'interface pour le bandeau. Voir `onToggle`.
      const nom = species ? species.name : `n° ${id}`;
      sync.schedule(`${nom} (GO)`);
      const affiche = species ? nomEspece(species) : `${t("n°")} ${id}`;
      undo.record(
        `${avant ? t("Case décochée") : t("Case cochée")} · ${affiche} — ${slotLabel(species, slot)}`,
        [{ id, slot, before: avant }]
      );
      tapCase();
      // Le son suit le geste, comme sur les cases de HOME. Le Pokédex GO était
      // le seul endroit du site où cocher ne s'entendait pas — et le
      // chromatique, qui est justement ce qu'on vient y chercher, passait sans
      // un bruit. `estCaseChromatique` connaît déjà ses cases à lui : `gs` pour
      // la forme de base, `gf<id>s` pour les formes régionales.
      //
      // Pas de son « complet » ici, contrairement à HOME : une entrée GO ne
      // porte que deux cases, et l'événement qui mérite d'être entendu est le
      // chromatique, pas le fait d'avoir coché les deux.
      if (!avant && estCaseChromatique(slot)) jouer("shiny");
      else jouer(avant ? "decase" : "case");
      go.refresh(id, slot);
      // La colonne de gauche affiche la progression GO tant qu'on est sur cet
      // onglet : elle doit suivre chaque case, comme elle suit celles de HOME.
      renderCounts();
    },
    onGoSearchInput: debounce((event) => store.set({ goSearch: event.target.value }), 160),
    /**
     * Voisins dans la liste filtree en cours. La fiche s'en sert pour ses
     * fleches ‹ › : remonter une boite de HOME, c'est aller de 1 a 2 a 3, pas
     * refermer la fiche et rechercher la vignette suivante a chaque fois.
     */
    neighbours: (id) => {
      const index = visible.findIndex((p) => p.id === id);
      if (index < 0) return { prev: null, next: null };
      return { prev: visible[index - 1] || null, next: visible[index + 1] || null };
    },
    /** Se deplacer de `delta` dans la liste filtree (fleches et clavier). */
    onStep: (delta) => {
      const index = visible.findIndex((p) => p.id === store.state.selectedId);
      if (index < 0) return;
      const target = visible[index + delta];
      if (target) store.set({ selectedId: target.id });
    },
  };

  // Le panneau des reglages a besoin du jeu de donnees pour son journal : il
  // n y retrouve les especes que par leur numero. Pose ici plutot qu importe,
  // parce que `initParametres` a deja tourne au demarrage, bien avant que les
  // donnees soient la.
  poserContexteParametres(ctx);

  // Le journal se met a suivre la collection. Ici et pas plus tot : le premier
  // instantane doit etre pris sur une collection DEJA CHARGEE, sans quoi l ecart
  // entre un objet vide et mille cases serait note comme une modification faite
  // a l instant.
  suivreCollection(collection);

  const sidebar = createSidebar(ctx);
  const grid = createGrid(ctx);
  const go = createGoDex(ctx);
  const detail = createDetailPanel(ctx);
  const quest = createQuest(ctx);
  const save = createSaveControls(ctx);
  createShortcuts(ctx);
  const toTop = createToTop();
  const activeFilters = createActiveFilters(ctx);
  const undo = createUndo(ctx);
  // La courbe ne charge rien tant qu'on ne l'ouvre pas : son bouton se contente
  // d'apparaitre quand un depot est joignable. Voir ui/courbe.js.
  initCourbe(ctx);
  // Le lecteur de captures pese 68 Ko a lui seul — `domain/reco.js` et son
  // interface — pour une fonction qu'on ouvre rarement. Il ne part donc plus
  // avec le reste : le module arrive au premier clic, ou a l'arrivee d'un
  // partage Android.
  //
  // Il part quand meme au chargement, mais plus tard, et la raison a change :
  // le service worker pre-cache desormais tout le graphe de modules — il lit
  // pour cela les `modulepreload` d'index.html, ou le lecteur figure —, si bien
  // que la disponibilite hors ligne n'est plus en jeu. Ce qui reste, c'est le
  // premier clic : sans ce prechargement a l'inactivite, il attendrait le
  // telechargement et l'analyse des 68 Ko.
  let photos = null;
  let chargementDuLecteur = null;
  const lecteurDeCaptures = () => {
    if (!chargementDuLecteur) {
      chargementDuLecteur = import("./ui/import-photos.js").then(({ createImportPhotos }) => {
        photos = photos || createImportPhotos(ctx);
        return photos;
      });
    }
    return chargementDuLecteur;
  };
  for (const bouton of document.querySelectorAll("[data-import]")) {
    bouton.addEventListener("click", () => {
      lecteurDeCaptures().then((lecteur) => lecteur.ouvrir(bouton.dataset.import));
    });
  }
  createFolds();

  /* ------------------------- les onglets jumeaux ------------------------- */

  /*
   * Deux onglets du meme navigateur partagent `localStorage` — et s'ignoraient
   * completement. On cochait dans l'un, l'autre continuait d'afficher l'ancien
   * etat, puis effacait la case au clic suivant en reecrivant sa propre copie
   * perimee. Le canal ne transporte qu'un SIGNAL : l'etat, lui, est deja dans le
   * stockage, et celui qui recoit va l'y relire. Voir core/jumeaux.js.
   */
  const jumeaux = ouvrirCanalJumeaux(() => adopterLeJumeau());

  // On ENCHAINE au lieu de remplacer. `suivreCollection` a pose son propre
  // rappel sur `surEcritureLocale` quelques lignes plus haut — c'est par la que
  // le journal apprend qu'une salve est en cours —, et la collection n'offre
  // qu'un seul crochet. L'ecraser aurait rendu le journal muet, sans que rien
  // ne le signale.
  const noterLaSalve = collection.surEcritureLocale;
  collection.surEcritureLocale = (origine) => {
    if (noterLaSalve) noterLaSalve(origine);

    /*
     * ON N'ANNONCE QUE NOS PROPRES COCHES, jamais une adoption du depot.
     *
     * La collection tient DEUX couches : `base`, l'ancetre lu dans le depot, et
     * `local`, ce qui l'en ecarte. Seule la seconde vit dans `localStorage` —
     * la premiere n'existe que dans la page, chargee au demarrage depuis
     * data/collection.json.
     *
     * Un envoi reussi appelle donc `adopterDistant` : `base` avance, `local`
     * est vide, et le stockage se retrouve a zero. Annoncer ca au voisin le
     * faisait relire un `local` VIDE tout en gardant sa `base` restee en
     * arriere : la soustraction des deux couches perdait d'un coup toutes les
     * cases en attente, qui se decochaient a l'ecran sous ses yeux. Le
     * correctif des onglets jumeaux produisait ainsi, tout seul, exactement le
     * symptome qu'il devait supprimer.
     *
     * Le voisin n'a de toute facon rien a apprendre dans ce cas : la reunion de
     * ses deux couches est INCHANGEE par un envoi — les memes cases, rangees
     * autrement. Il remettra ses couches d'aplomb a sa prochaine lecture du
     * depot, qui est le seul endroit qui fasse autorite sur `base`.
     *
     * C'est aussi ce qui evite un renvoi sans fin : deux onglets qui se
     * relaieraient leurs adoptions se seraient repondu indefiniment.
     */
    if (origine !== "depot") jumeaux.annoncer();
  };

  /**
   * Un onglet voisin a ecrit : on relit le stockage et on se redessine.
   *
   * TOUT SE JOUE DANS `autourDUneAdoption`, et c'est le point delicat du
   * correctif. `domain/journal.js` note les modifications LOCALES en comparant
   * un instantane a l'etat courant : adopter l'etat du voisin sans precaution
   * aurait fait deux degats d'un coup. La salve en cours ici — nos propres cases,
   * pas encore ecrites — aurait ete comparee a un etat contenant deja celles du
   * voisin, donc perdue ; et la salve SUIVANTE aurait rattrape les cases du
   * voisin comme si on venait de les cocher. L'enveloppe vide la premiere avant
   * l'adoption et repose l'instantane apres : les deux trous sont bouches
   * ensemble, et on ne peut pas en oublier un.
   *
   * ON REND `null` A DESSEIN, alors qu'on a bien un rapport sous la main : c'est
   * ce qui empeche l'enveloppe d'ecrire une entree « reception » dans le
   * journal. Une telle entree serait fausse deux fois. Le journal vit dans les
   * preferences, donc dans le meme `localStorage` : les deux onglets ecrivent
   * dans LE MEME journal, et le voisin y notera ces cases lui-meme, comme
   * locales — ce qu'elles sont, puisqu'elles ont ete cochees sur cet appareil.
   * Les noter ici en plus les aurait doublees. Et pire : le voisin regroupe sa
   * salve, une seule entree pour trente cases, quand nous recevons un signal par
   * case — trente entrees « reception » pour la meme boite de HOME.
   */
  function adopterLeJumeau() {
    let rapport = null;
    autourDUneAdoption(collection, () => {
      rapport = collection.relireCoucheLocale();
      return null;
    });
    if (!rapport) return;

    // Le chemin complet : le voisin a pu cocher n'importe quoi, y compris la
    // fiche ouverte ici ou une boite du Pokedex GO. Meme raison qu'au retour sur
    // l'onglet, quelques lignes plus bas.
    onCollectionChange();

    // Le meme bandeau que la synchronisation, dans la meme colonne : c'est deja
    // la qu'on lit « Mis à jour depuis le dépôt ». Le statut `jumeau` n'a pas de
    // regle CSS, et n'en aura pas — il retombe donc sur le gris discret de
    // `.sync__state`, ce qui est exactement le ton voulu : ce n'est ni un succes
    // a feter ni une erreur. Sans rapport joint, volontairement : le panneau de
    // detail s'ouvre tout seul quand un rapport arrive, et se le faire ouvrir a
    // chaque case cochee dans l'onglet d'a cote serait insupportable.
    //
    // MAIS PAS PAR-DESSUS UNE ERREUR. Le bandeau est unique et le dernier qui
    // parle gagne : « Échec de l'envoi », le seul message qui demande une
    // action, se faisait effacer par une case cochée dans l'onglet d'à côté.
    // Une nouvelle qui n'appelle aucun geste ne doit pas couvrir celle qui en
    // appelle un — l'erreur reste donc affichée, et la relecture a bien eu
    // lieu de toute façon.
    if (sync.state.status !== "error") {
      sync.emit("jumeau", t("Mis à jour depuis un autre onglet."));
    }
  }

  // Sur telephone, on quitte l'onglet plus souvent qu'on ne le ferme : c'est
  // le moment sur : on ecrit sans attendre la fin du delai de regroupement.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && collection.dirtyCount) {
      // `keepalive` : la page peut etre gelee ou tuee juste apres. Sans lui,
      // la requete part avec elle — or c'est justement le cas courant.
      sync.flush("sortie de l'application", true).catch(() => {});
      return;
    }

    // Au retour, on va voir ce qui a ete coche ailleurs. Un onglet laisse
    // ouvert sur l'ordinateur ignorait sinon tout du telephone jusqu'a son
    // prochain rechargement, et affichait a tort des cases comme manquantes.
    if (document.visibilityState === "visible") {
      sync
        .relire()
        .then((change) => {
          if (!change) return;
          // Le chemin complet, et non « compteurs + grille » : une relecture peut
          // rapporter n importe quelle case, y compris celle du Pokemon dont la
          // fiche est ouverte, ou une boite du Pokedex GO. Les repeindre a moitie
          // laissait la fiche affirmer le contraire de la grille, juste a cote.
          onCollectionChange();
        })
        // Hors ligne, ou jeton absent : on garde ce qu'on affiche. Ce n'est
        // pas une erreur a montrer, juste une occasion manquee.
        .catch(() => {});
    }
  });

  /*
   * Le reseau revient : on rattrape tout seul.
   *
   * C'est le cas courant de ce site. On coche des cases en jouant, dans le
   * train ou au fond d'un magasin, et l'envoi echoue. Les cases restaient bien
   * dans le navigateur — rien n'etait perdu — mais elles y restaient jusqu'a ce
   * qu'on pense a rouvrir le site et a cocher une case de plus pour declencher
   * un nouvel envoi.
   *
   * `reprendre()` relit d'abord, puis envoie : pendant la coupure, un autre
   * appareil a pu enregistrer.
   */
  // Le theme « Pixels » change les adresses des images : les <img> deja posees
  // pointent encore vers les rendus HOME.
  //
  // Les TROIS onglets, et pas seulement celui qu'on regarde. Un onglet cache
  // garde ses vignettes dans le document : n'en refaire qu'un laissait le
  // Pokedex GO et le Pokemon d'une quete en 3D, et le decalage n'apparaissait
  // qu'en changeant d'onglet — au moment ou l'on ne fait plus le lien avec le
  // theme qu'on vient de choisir.
  document.addEventListener("funkylldex:sprites", () => {
    renderList();
    renderDetail();
    go.render();
    quest.render();
  });

  initBoutonLangue();

  // Changer de langue refait plus que du texte : les noms d'especes changent,
  // donc le tri par nom, donc l'ORDRE de la grille. On repasse par le meme
  // chemin qu'un changement de filtre plutot que de retoucher les noeuds en
  // place — sinon la grille resterait rangee selon l'ancienne langue.
  document.addEventListener("funkylldex:langue", () => {
    renderList();
    renderDetail();
    go.render();
    quest.render();
    // `renderCounts` et non `sidebar.render()` : celui-ci attend les trois jeux
    // de compteurs, que seul le premier sait calculer.
    renderCounts();
    // LES PASTILLES DE FILTRE AUSSI, et elles manquaient. `ui/langue.js` ne les
    // retraduit pas depuis le DOM — `#active-filters` est dans ses ZONES
    // DYNAMIQUES, justement parce qu'il passe deja par `t()` a la source. Mais
    // encore faut-il le redessiner : sans cet appel, basculer en anglais
    // laissait « Génération VI » au-dessus d'une grille devenue anglaise, et le
    // libellé restait faux jusqu'au prochain changement de filtre.
    activeFilters.render();
  });

  window.addEventListener("online", () => {
    sync
      .reprendre()
      .then((change) => {
        if (!change) return;
        // Meme raison qu au retour sur l onglet : la relecture touche tout.
        onCollectionChange();
      })
      .catch(() => {});
  });

  const tabsRoot = document.getElementById("tabs");
  const panels = {
    dex: document.getElementById("tab-dex"),
    go: document.getElementById("tab-go"),
    quest: document.getElementById("tab-quest"),
    maj: document.getElementById("tab-maj"),
  };

  if (!store.state.quest) store.set({ quest: planner.roll(collection, chassesOuvertes(collection.quetes)) });

  /* ------------------------------- rendu ------------------------------- */

  /** « Tout obtenu » : dépend des formes et du verrou chromatique. */
  const complete = (species) => isComplete(species, collection);
  /** « À une case du bout, et c'est le chromatique. » Voir la pastille du même nom. */
  const presqueShiny = (species) => neManqueQueLeChromatique(species, collection, estCaseChromatique);

  /**
   * Cette espece a-t-elle encore sa place dans la liste affichee ?
   *
   * On repasse par `applyFilters` avec une liste d'un seul element plutot que
   * de reecrire la regle ici : le jour ou un filtre change, les deux chemins ne
   * pourront pas diverger.
   */
  const stillVisible = (species) =>
    applyFilters([species], store.state, collection, complete).length > 0;

  /**
   * Les trois onglets.
   *
   * Deux Pokedex distincts, donc deux noms explicites : « Pokédex » tout court
   * ne disait plus lequel. Le logo officiel fait le reste du travail — sur
   * telephone il reste seul avec le nom court, le nom long ne tiendrait pas.
   *
   * `long` et `court` sont deux nœuds, pas un texte tronque en CSS : couper
   * « Pokédex Pokémon HOME » avec des points de suspension aurait donne
   * « Pokédex Poké… » sur les deux onglets, c'est-a-dire deux libelles
   * identiques.
   */
  function renderTabs() {
    const counts = collection.counts(dataset.species, complete);
    const goCounts = goProgressOf(dataset.goEntries, collection);
    fill(
      tabsRoot,
      [
        ["dex", "assets/img/logo-home.png", t("Pokédex Pokémon HOME"), t("HOME"), `${counts.owned}/${counts.total}`],
        ["go", "assets/img/logo-go.png", t("Pokédex Pokémon GO"), t("GO"), `${goCounts.owned}/${goCounts.total}`],
        // Une pastille en couleur comme ses deux voisines, et non un symbole
        // monochrome : le ✦ qu'elle remplace faisait tache a cote de deux
        // logotypes en couleur.
        ["quest", "assets/img/logo-quete.svg", t("Quêtes"), t("Quêtes"), String(store.state.questDone)],
        // Le quatrieme onglet porte lui aussi un logo, mais pas de la meme
        // facon que ses voisins : les trois autres designent un jeu ou une
        // activite et gardent donc leurs couleurs propres, celui-ci designe le
        // site lui-meme et prend les siennes. Le dessin sert de MASQUE et non
        // d image : c est l accent du theme qui le peint, et il suit donc les
        // trente-huit palettes au lieu d en imposer une trente-neuvieme.
        // Sa pastille porte le numero de version : c est ce qu on vient
        // verifier.
        ["maj", null, t("Mises à jour"), t("Maj"), versionCourante()],
      ].map(([value, logo, long, court, badge]) =>
        el(
          "button.tab",
          {
            type: "button",
            role: "tab",
            title: long,
            "aria-label": long,
            "aria-selected": String(store.state.tab === value),
            onclick: () => {
              jouer("onglet");
              store.set({ tab: value });
            },
          },
          logo
            ? el("img.tab__logo", { src: logo, alt: "", height: 22, loading: "lazy" })
            : el("span.tab__ico", { "aria-hidden": "true" }),
          el("span.tab__long", long),
          el("span.tab__court", court),
          el("span.tab__badge", badge)
        )
      )
    );
    for (const [nom, panneau] of Object.entries(panels)) panneau.hidden = store.state.tab !== nom;
    // Le panneau des mises a jour se remplit a l ouverture, et seulement la :
    // ses libelles passent par `t()`, et le construire au demarrage l aurait
    // fige dans la langue du premier chargement.
    if (store.state.tab === "maj") renderMaj(panels.maj);
  }

  /** La bulle « Masquer les formes Gigamax », construite une seule fois. */
  let bulleOptions = null;

  function renderList() {
    visible = applyFilters(dataset.species, store.state, collection, complete, planner);

    // GRILLE OU BOÎTES, JAMAIS LES DEUX. Les deux dispositions montrent le même
    // Pokédex ; les afficher ensemble aurait doublé mille sprites pour rien, et
    // laissé deux zones de défilement l'une sous l'autre.
    const mode = store.state.mode || "grille";
    const enBoites = mode !== "grille";
    const grille = document.getElementById("grid");
    const boitesRacine = document.getElementById("livingdex");
    if (grille) grille.hidden = enBoites;
    if (boitesRacine) boitesRacine.hidden = !enBoites;

    if (!enBoites) {
      grid.render(visible);
      return;
    }
    // La bulle est construite UNE fois et DÉPLACÉE dans la liste a chaque
    // rendu : `renderLivingDex` la pose a droite de la premiere bande de
    // generation. Elle n existe que dans les vues en boites.
    const entete = peindreOptionsDesBoites();
    // LES BOÎTES IGNORENT LES FILTRES, et c'est le point. Une boîte de HOME a
    // trente cases : en retirer vingt parce qu'un filtre de type est actif
    // détruirait le seul intérêt de la vue, qui est de montrer les trous À LEUR
    // PLACE. On range donc toujours les mille vingt-cinq.
    renderLivingDex(boitesRacine, {
      especes: dataset.species,
      chaines: dataset.chaines,
      collection,
      ordre: mode === "familles" ? "famille" : "numero",
      // Le clic COCHE. Il passe par `ctx.onToggle`, le meme chemin que les
      // boutons de la grille : de quoi annuler, la note, la synchronisation.
      surChoix: (id, slot) => ctx.onToggle(id, slot),
      // Le SECOND geste — clic droit, appui long, Ctrl + clic — ouvre la fiche,
      // et il passe par `onSelect`, exactement comme une vignette de la grille :
      // meme selection, meme feuille qui monte sur telephone, et meme reponse
      // quand la fiche affichee est deja celle-la.
      surFiche: (id) => ctx.onSelect(id),
      // Retirer les Gigamax du RANGEMENT, pas du Pokédex : la progression, les
      // succès et la grille continuent de les compter. Voir
      // `domain/livingdex.js` pour la raison du choix.
      sansGmax: Boolean(store.state.sansGmax),
      // LE MÊME LIBELLÉ QUE LA GRILLE, et il vient de la même table : sans
      // elle, `separateurGeneration` retombe sur son texte de secours et écrit
      // « Génération 12 » au lieu de « GÉNÉRATION I — KANTO ». Le repli existe
      // pour une table absente, pas pour une table qu'on a oublié de passer.
      entete,
      generations: dataset.generations,
      // Le compte à droite du nom, celui de la grille. `progressOf` parcourt
      // les 1025 espèces : c'est exactement ce que `dex-grid.js` fait déjà une
      // fois par rendu, et pour le même bandeau.
      avancement: progressOf(dataset.species, collection).gens,
    });
  }

  /**
   * La bande au-dessus des boîtes : pour l'instant, une seule case.
   *
   * ELLE SE DESSINE UNE FOIS ET SE CORRIGE ENSUITE. La reconstruire à chaque
   * rendu aurait remplacé la case au moment même où le doigt appuie dessus —
   * c'est le défaut que `dex-grid.js` documente déjà pour ses vignettes. On ne
   * touche donc qu'à `checked` quand la bande existe déjà.
   *
   * ELLE VIT AU MÊME NIVEAU QUE LA BANDE DE GÉNÉRATION de la grille, et lui
   * emprunte son allure : même pilule collante en haut, même fond opaque. Ce
   * sont deux repères de même nature — ce qu'on regarde, et comment c'est rangé.
   */
  function peindreOptionsDesBoites() {
    if (bulleOptions) {
      // On ne la reconstruit JAMAIS : elle est déplacée dans la liste à chaque
      // rendu, et la chercher dans son conteneur d'origine — désormais vide —
      // en aurait fabriqué une deuxième à chaque fois. Seul son état se remet
      // d'accord avec le store.
      bulleOptions.querySelector("input").checked = Boolean(store.state.sansGmax);
      return bulleOptions;
    }
    const id = "ldx-sans-gmax";
    bulleOptions = el(
      "label.ldx-bulle",
      { for: id, title: t("Un Gigamax n'occupe pas de boîte dans HOME : c'est un pouvoir porté par un Pokémon déjà rangé.") },
      el("input", {
        type: "checkbox",
        id,
        checked: Boolean(store.state.sansGmax),
        onchange: (e) => store.set({ sansGmax: e.target.checked }),
      }),
      el("span", t("Masquer les formes Gigamax"))
    );
    return bulleOptions;
  }

  function renderDetail(reveal = false) {
    const species = dataset.byId.get(store.state.selectedId) || dataset.species[0];
    detail.render(species, reveal);
  }

  function renderCounts() {
    const progression = progressOf(dataset.species, collection);
    const progressionGo = goProgressOf(dataset.goEntries, collection);
    const comptes = collection.counts(dataset.species, complete, presqueShiny);
    sidebar.render(comptes, progression, progressionGo);
    // Les succes se DEDUISENT de ces memes compteurs. Les recalculer ici, et
    // nulle part ailleurs, garantit qu'ils ne peuvent pas diverger de ce que la
    // barre laterale affiche au meme instant.
    //
    // Le bilan reunit les quatre sources dont les succes parlent : le Pokedex
    // national, le Pokedex GO, le nombre d'especes entierement obtenues, et le
    // carnet de chasse. Aucune n'est recalculee pour l'occasion — `comptes` et
    // les deux progressions viennent d'etre faits pour la barre laterale, et le
    // carnet n'est qu'une lecture.
    majSucces(
      bilanDesSucces({
        progression,
        progressionGo,
        comptes,
        carnet: collection.quetes,
        questDone: store.state.questDone,
        // Les noms de region, pour que « Region bouclee » puisse dire LAQUELLE.
        // `domain/succes.js` ne connait pas le jeu de donnees : on ne lui passe
        // que ce dont il se sert.
        regions: Object.fromEntries(
          Object.entries(dataset.generations).map(([n, g]) => [n, g.region || g.label])
        ),
      })
    );
    save.render();
    renderTabs();
  }

  /**
   * Une case a ete cochee : on rafraichit le strict necessaire.
   * La fiche n'est surtout PAS reconstruite — on ne fait que retourner ses
   * `aria-pressed`. Sinon le bouton qu'on vient de toucher disparaitrait sous
   * le doigt, et l'evenement suivant retomberait sur son remplacant.
   */
  function onCollectionChange(id) {
    renderCounts();
    if (id === undefined) {
      renderList();
      renderDetail();
      // Un import ou une reinitialisation touche aussi les cases GO : la grille
      // de l'autre onglet n'est plus a jour, meme si on ne la regarde pas.
      go.render();
      return;
    }
    // En vue BOÎTES, la grille est cachée : `grid.refresh` repeindrait une
    // vignette que personne ne voit, et la case de boîte garderait son ancien
    // état. Les boîtes n'ont pas de rafraîchissement à l'unité — elles n'ont
    // aucun état à préserver, ni défilement interne ni bouton sous le doigt —,
    // un redessin complet est donc à la fois plus simple et sans effet visible.
    if ((store.state.mode || "grille") !== "grille") {
      renderList();
      detail.syncMarks(dataset.byId.get(id) || dataset.species[0]);
      return;
    }

    grid.refresh(id);
    // Les filtres « capturés / manquants / complets » peuvent exclure la carte.
    // On la BARRE au lieu de reconstruire la liste : voir `grid.setStale()`.
    // Seul `status` depend de la collection ; les autres filtres ne peuvent
    // pas changer d'avis parce qu'une case a bascule.
    if (store.state.status !== "all") {
      const species = dataset.byId.get(id);
      if (species) grid.setStale(id, !stillVisible(species));
    }
    detail.syncMarks(dataset.byId.get(id) || dataset.species[0]);
  }

  let previousSelected = store.state.selectedId;

  store.subscribe((state, changed) => {
    if (FILTER_KEYS.some((key) => changed.has(key))) {
      renderList();
      // Les barres cliquables et les pastilles doivent s'allumer tout de
      // suite. `sidebar.render()` refait les compteurs sur 1025 especes :
      // beaucoup trop cher pour un simple changement de filtre.
      sidebar.syncActive();
      activeFilters.render();
      saveFilters(state);
      // La liste a change : « suivant » ne designe plus la meme fiche.
      detail.refreshSteps(dataset.byId.get(state.selectedId) || dataset.species[0]);
    }

    if (changed.has("selectedId")) {
      grid.setSelected(state.selectedId, previousSelected);
      previousSelected = state.selectedId;
      renderDetail(true);
      saveFilters(state);
    }

    // L'onglet ouvert est retenu d'une visite a l'autre : on revient sur le
    // site pour continuer ce qu'on faisait, pas pour rechoisir son Pokedex.
    if (changed.has("tab") || GO_KEYS.some((key) => changed.has(key))) saveFilters(state);

    if (GO_KEYS.some((key) => changed.has(key))) {
      go.render();
      // Les pastilles de statut DOIVENT suivre, et elles ne suivaient pas : ce
      // bloc ne redessinait que la grille. Le filtre s'appliquait donc — la
      // liste changeait bien — mais « Tous » restait allumé au-dessus d'une
      // liste filtrée, et rien ne disait lequel des quatre était actif.
      //
      // `syncActive()` savait déjà lire `goStatus` plutôt que `status` selon
      // l'onglet ; il n'était appelé que par le bloc des filtres HOME, quinze
      // lignes plus haut.
      sidebar.syncActive();
      activeFilters.render();
    }

    if (changed.has("tab")) {
      renderTabs();
      // La colonne de gauche appartient a l'onglet ouvert : progression,
      // statut et filtres basculent avec lui. C'est `render()` qu'il faut,
      // pas `syncActive()` — ce ne sont pas les memes pastilles ni les memes
      // barres, il faut les reconstruire.
      renderCounts();
      // Et on rederive la liste et ses pastilles depuis l'etat, au lieu de
      // faire confiance a ce qui etait affiche avant la bascule. Un aller-
      // retour entre les onglets laissait, dans un cas rapporte, la pastille
      // « Manquants » allumee au-dessus d'une liste qui ne l'etait pas. Deux
      // millisecondes de filtrage valent mieux qu'un rappel de filtre qui ment
      // sur ce qu'on a sous les yeux.
      renderList();
      activeFilters.render();
      // La grille GO ne peut pas se mesurer tant que son panneau est `hidden` :
      // elle n'aurait charge qu'un seul palier, et le defilement infini
      // n'aurait jamais demarre.
      if (state.tab === "go") go.reveal();
    }
    // `questLog` compte ici, et pas seulement pour l'enregistrement plus bas :
    // il ne bougeait jusqu'ici qu'en meme temps que `questDone`, quand une
    // quete est validee. « Oublier » une prise le change SEUL — sans cette
    // clause, la ligne restait a l'ecran jusqu'au prochain rendu.
    if (changed.has("quest") || changed.has("questDone") || changed.has("questLog")) {
      quest.render();
      renderTabs();
    }
    if (["quest", "questDone", "questLog"].some((key) => changed.has(key))) {
      saveQuestState(state);
    }
    if (changed.has("view")) renderDetail();
  });

  /* ---------------------------- premier rendu --------------------------- */

  renderCounts();
  renderList();
  activeFilters.render();
  renderDetail();
  quest.render();
  go.render();
  if (store.state.tab === "go") go.reveal();

  document.getElementById("boot").remove();
  document.getElementById("app").hidden = false;

  // La grille a une boite depuis cette ligne seulement : c'est maintenant, et
  // pas avant, qu'on peut defiler vers la vignette quittee.
  grid.reveal();

  registerWorker();

  // Le prechargement du lecteur de captures, maintenant seulement : place plus
  // haut, `requestIdleCallback` se declenchait des 17 ms — pendant une attente
  // du demarrage, donc en concurrence avec le chargement des donnees. Ici, la
  // grille est peinte et le fil est libre.
  const quandLaPageSeTait = window.requestIdleCallback || ((f) => setTimeout(f, 3000));
  quandLaPageSeTait(() => lecteurDeCaptures().catch(() => {}));

  // Le site vient d'etre ouvert par le menu « Partager » d'Android : les
  // captures attendent dans un cache, le lecteur les reprend tout de suite.
  // Apres le premier rendu, pour ne pas retarder l'affichage — et sans faire
  // de bruit si ce n'etait pas un partage.
  if (new URLSearchParams(location.search).has("partage")) {
    lecteurDeCaptures()
      .then((lecteur) => lecteur.reprendrePartage())
      .catch((error) => {
        console.warn("Funkylldex : captures partagees illisibles.", error);
      });
    // L'adresse est nettoyee : recharger la page ne doit pas relancer une
    // lecture dont les fichiers ont deja ete consommes.
    history.replaceState(null, "", location.pathname);
  }
}

/**
 * Cache hors ligne. Enregistre apres le premier rendu : il n'a aucune raison
 * de retarder l'affichage, et son absence ne doit rien empecher — un
 * `file://`, un navigateur ancien ou un contexte non securise le refusent, le
 * site marche pareil.
 *
 * `CONFIG.offline: false` fait le chemin inverse : desinscription et purge des
 * caches. C'est la manette d'arret a distance decrite dans config.js.
 */
function registerWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

  if (!CONFIG.offline) {
    navigator.serviceWorker
      .getRegistrations()
      .then((list) => Promise.all(list.map((reg) => reg.unregister())))
      .then(() => (window.caches ? caches.keys() : []))
      .then((noms) => Promise.all([...noms].map((nom) => caches.delete(nom))))
      .catch(() => {});
    return;
  }

  navigator.serviceWorker.register("sw.js").catch((error) => {
    console.warn("Funkylldex : cache hors ligne indisponible.", error);
  });
}

/** Les cases du Pokedex GO, que `requiredSlots()` ne connait pas : elles
    n'entrent pas dans la progression HOME, donc il ne les nomme jamais. */
const GO_LABELS = { gn: "GO — attrapé", gs: "GO — chromatique" };

/**
 * Le nom lisible d'une case — « Normal ♀ », « Miaouss d'Alola shiny ».
 *
 * On relit `requiredSlots()` plutot que d'inventer une table de libelles :
 * c'est deja lui qui nomme les cases dans le « tout obtenu », et deux
 * vocabulaires pour la meme case seraient un piege a maintenance.
 */
function slotLabel(species, slot) {
  // `t()` a l'USAGE et non a la definition : `GO_LABELS` est construit au
  // chargement du module, bien avant que la table anglaise existe.
  if (GO_LABELS[slot]) return t(GO_LABELS[slot]);
  if (!species) return slot;
  // Une forme regionale dans GO : `gf10091` / `gf10091s`. Son nom vient de la
  // forme elle-meme, `requiredSlots()` ne parle que des cases HOME.
  const go = /^gf(\d+)(s?)$/.exec(slot);
  if (go) {
    const forme = species.forms.find((f) => String(f.id) === go[1]);
    const nom = forme ? nomForme(forme) : `${t("forme")} ${go[1]}`;
    return `GO — ${nom}${go[2] ? t(" chromatique") : ""}`;
  }
  const entree = requiredSlots(species).find((e) => e.slot === slot);
  return entree ? entree.label : slot;
}

/**
 * Les replis de la barre latérale, retenus d'une visite à l'autre.
 *
 * Fermés par défaut, et pour la même raison dans les deux cas : dépliés, ils
 * repoussaient les commandes utiles à plus d'un écran du haut de la colonne —
 * les dix barres de progression d'un côté, les six boutons de sauvegarde de
 * l'autre. Qui s'en sert les ouvre une fois, et ils restent ouverts.
 */
function createFolds() {
  for (const [id, cle] of [
    ["bars-fold", CONFIG.storage.barsFold],
    ["save-fold", CONFIG.storage.saveFold],
  ]) {
    const fold = document.getElementById(id);
    if (!fold) continue;
    try {
      fold.open = localStorage.getItem(cle) === "1";
    } catch {
      /* stockage bloque : ferme par defaut */
    }
    fold.addEventListener("toggle", () => {
      try {
        localStorage.setItem(cle, fold.open ? "1" : "0");
      } catch {
        /* rien a faire */
      }
    });
  }
}

/* ---------------------- persistance des filtres -------------------------- */

/**
 * Les filtres survivent au rechargement.
 *
 * Sans cela, travailler « À terminer » filtré sur Gigamax et recharger la page
 * — ou revenir sur le site plus tard — repartait de zero. La recherche, elle,
 * n'est PAS gardee : c'est une intention du moment, la retrouver au retour
 * ferait croire a une liste vide.
 */
const FILTRES_GARDES = [
  "type", "gen", "game", "form", "sort", "status", "view",
  "goGen", "goType", "goStatus", "tab",
  // LES DEUX DISPOSITIONS SE GARDENT AUSSI. `mode` disait deja, en commentaire,
  // qu on la retrouvait en revenant — elle ne figurait simplement pas ici, et
  // chaque visite repartait donc en grille. `goMode` arrive avec la sienne.
  "mode", "goMode",
  // Une option de RANGEMENT, pas un filtre : elle ne retire rien du Pokedex,
  // elle change la facon dont les boites sont composees. Gardee pour la meme
  // raison que la disposition — on la retrouve en revenant.
  "sansGmax",
];
/** Le dernier Pokemon consulte : rouvrir le site le retrouve ouvert. */
const DERNIER = "selectedId";

function loadFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storage.filters) || "null");
    if (!saved) return {};
    const out = {};
    for (const key of FILTRES_GARDES) {
      // LES BOOLEENS AUSSI, depuis que `sansGmax` existe. Le test ne gardait que
      // les chaines — ce qui suffisait tant que tous les reglages retenus etaient
      // des valeurs de filtre —, et une case cochee serait donc revenue decochee
      // a chaque visite, sans que rien ne le signale.
      const v = saved[key];
      if (typeof v === "string" || typeof v === "boolean") out[key] = v;
    }
    if (Number.isInteger(saved[DERNIER])) out[DERNIER] = saved[DERNIER];
    return out;
  } catch {
    return {};
  }
}

function saveFilters(state) {
  try {
    const out = {};
    for (const key of FILTRES_GARDES) out[key] = state[key];
    out[DERNIER] = state[DERNIER];
    localStorage.setItem(CONFIG.storage.filters, JSON.stringify(out));
  } catch {
    /* stockage indisponible : les filtres repartiront simplement a zero */
  }
}

/* ------------------------- persistance des quetes ------------------------ */

function loadQuestState() {
  const empty = { quest: null, questDone: 0, questLog: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storage.quest) || "null");
    return saved ? { ...empty, ...saved } : empty;
  } catch {
    return empty;
  }
}

function saveQuestState(state) {
  try {
    localStorage.setItem(
      CONFIG.storage.quest,
      JSON.stringify({
        quest: state.quest,
        questDone: state.questDone,
        questLog: state.questLog,
      })
    );
  } catch {
    /* stockage indisponible : les quetes repartiront de zero */
  }
}
