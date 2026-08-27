/**
 * import-photos.js — cocher les cases à partir de captures d'écran de HOME.
 *
 * Un site web ne peut pas lire l'écran d'une autre application : c'est une
 * garantie du système, pas une limite qu'on pourrait contourner. Le geste
 * devient donc : tu prépares ton écran dans HOME — filtre par jeu d'origine si
 * tu ne veux que les Pokémon de GO —, tu photographies, tu déposes ici.
 *
 * **Rien n'est coché sans relecture.** La reconnaissance affiche ce qu'elle a
 * cru voir, avec son degré de confiance, et c'est un appui volontaire qui
 * l'applique. Une reconnaissance qui écrirait toute seule pourrait poser un
 * chromatique que tu n'as pas, dans un fichier synchronisé sur GitHub, sans
 * que tu t'en aperçoives. C'est la seule erreur que ce site ne doit pas
 * pouvoir commettre.
 *
 * La lecture ne part qu'au bouton, jamais toute seule : le temps de préparer
 * son filtre dans HOME fait partie du geste.
 */

import { el, fill } from "../core/dom.js";
import { spriteImg } from "../domain/sprites.js";
import { dexNumber } from "./common.js";
import { detecterGrille, lireCases, reconnaitre } from "../domain/reco.js";

/** Où vivent les empreintes des sprites, chargées seulement à l'usage. */
const BANQUE_BIN = "data/reference/sprites-sig.bin";
const BANQUE_JSON = "data/reference/sprites-sig.json";

export function createImportPhotos(ctx) {
  const { dataset, collection } = ctx;
  let banque = null;
  let resultats = null;
  let cible = "dex";

  const racine = el("div.imp", { hidden: true });
  const fond = el("div.imp__fond", { hidden: true, onclick: () => fermer() });
  document.body.append(fond, racine);

  const fichiers = el("input", {
    type: "file",
    accept: "image/*",
    multiple: true,
    hidden: true,
    onchange: (e) => lancer([...e.target.files]),
  });
  document.body.append(fichiers);

  /* ------------------------------ ouverture ---------------------------- */

  function ouvrir(destination) {
    cible = destination;
    racine.hidden = false;
    fond.hidden = false;
    document.body.classList.add("imp-open");
    accueil();
  }

  function fermer() {
    racine.hidden = true;
    fond.hidden = true;
    document.body.classList.remove("imp-open");
    resultats = null;
  }

  const titre = () =>
    el(
      "div.imp__tete",
      el("h2.imp__titre", cible === "go" ? "Lire des captures → Pokédex GO" : "Lire des captures → Pokédex HOME"),
      el("button.icon-btn", { type: "button", onclick: fermer, "aria-label": "Fermer" }, "✕")
    );

  function accueil() {
    const etapeTexte = (n, titre, texte) =>
      el("li.imp__etape", el("strong.imp__etape-titre", `${n}. ${titre}`), el("span", texte));

    fill(
      racine,
      titre(),
      el(
        "div.imp__corps",

        el(
          "div.imp__avert",
          el("p.imp__avert-titre", "À lire avant de s'en servir"),
          el(
            "p",
            "Cette lecture se trompe. Elle reconnaît un dessin de 20 pixels de côté " +
              "parmi 2 663 sprites qui se ressemblent — un Roucool et un Roucoups, un " +
              "Nidoran mâle et un Nidoran femelle. Elle est bonne, pas infaillible."
          ),
          el(
            "p",
            el("strong", "Elle ne coche donc jamais rien toute seule."),
            " Elle te montre ce qu'elle a cru voir, tu retires ce qui est faux, et " +
              "c'est ton appui qui l'écrit. Une case posée à tort partirait dans " +
              "data/collection.json sur GitHub sans que tu la voies passer."
          ),
          el(
            "p",
            "Et si tu t'aperçois trop tard qu'un lot était mauvais : le bandeau " +
              "« Annuler » défait toute la lecture d'un seul appui."
          )
        ),

        el("h3.imp__soustitre", "Comment faire"),
        el(
          "ol.imp__etapes",
          etapeTexte(
            1,
            "Prépare l'écran dans HOME.",
            " Onglet « Pokémon », vue « Tous les Pokémon », tri par numéro — le bouton « N° » " +
              "en bas à droite. " +
              (cible === "go"
                ? "Et pose ton filtre sur le jeu d'origine « Pokémon GO » : seuls tes Pokémon de GO seront listés, donc lus."
                : "Pose un filtre si tu ne veux lire qu'une partie de ta collection.")
          ),
          etapeTexte(
            2,
            "Photographie en faisant défiler.",
            " Laisse une ligne de recouvrement entre deux captures. Ce n'est pas une " +
              "précaution de confort : c'est ce recouvrement qui rattrape les cases " +
              "cachées par les deux boutons flottants de HOME."
          ),
          etapeTexte(
            3,
            "Dépose-les ici, dans l'ordre.",
            " L'ordre compte beaucoup — voir plus bas."
          ),
          etapeTexte(4, "Relis, puis applique.", " Rien n'entre dans ta collection avant.")
        ),

        el(
          "details.imp__replis",
          el("summary", "Comment ça marche, au juste"),
          el(
            "p",
            "Le site repère la grille dans ta capture : il cherche les colonnes et les " +
              "lignes de sprites en comptant, colonne par colonne, les pixels qui ne sont " +
              "pas du fond. Rien n'est codé en dur — ça marche donc sur n'importe quel " +
              "téléphone, quelle que soit la hauteur de ta barre d'état."
          ),
          el(
            "p",
            "Chaque case est ensuite détourée de son fond, réduite à une empreinte de " +
              "20 × 20 — trois canaux de couleur plus la silhouette — et comparée aux " +
              "empreintes des 2 663 sprites officiels. La plus proche gagne."
          ),
          el(
            "p",
            el("strong", "C'est l'ordre qui fait la fiabilité."),
            " HOME range par numéro national : la suite de tes captures est croissante. " +
              "Le site ne retient d'abord que les reconnaissances franches, qui deviennent " +
              "des points d'appui ; puis, entre deux appuis, une case ne peut plus être " +
              "qu'une espèce de l'intervalle. Mille candidats retombent à une poignée, et " +
              "une reconnaissance moyenne devient concluante. Six tours, chacun resserrant " +
              "le suivant. Toute reconnaissance qui casserait l'ordre est jetée, quel que " +
              "soit son score — c'est pour ça que déposer les captures dans le désordre " +
              "dégrade beaucoup le résultat."
          ),
          el(
            "p",
            "Le chromatique n'est pas deviné : les sprites normaux et chromatiques sont " +
              "tous les deux dans la comparaison, c'est la couleur du dessin qui tranche."
          ),
          el(
            "p.imp__gris",
            "Rien ne quitte ton téléphone. Les captures sont lues dans la page, jamais " +
              "envoyées nulle part. Les empreintes de sprites (4 Mo) se chargent une fois, " +
              "à la première lecture."
          )
        ),

        el(
          "div.imp__actions",
          el(
            "button.btn.btn--primary",
            { type: "button", onclick: () => fichiers.click() },
            "Choisir mes captures"
          )
        )
      )
    );
  }

  /* ------------------------------- lecture ----------------------------- */

  function etape(texte, valeur, max) {
    fill(
      racine,
      titre(),
      el(
        "div.imp__corps",
        el("p.imp__texte", texte),
        el("progress.imp__barre", { value: String(valeur), max: String(max) })
      )
    );
  }

  async function chargerBanque() {
    if (banque) return banque;
    etape("Chargement des empreintes de sprites (une seule fois)…", 0, 1);
    const [meta, bin] = await Promise.all([
      fetch(BANQUE_JSON).then((r) => r.json()),
      fetch(BANQUE_BIN).then((r) => r.arrayBuffer()),
    ]);
    const especes = new Int32Array(meta.etiquettes.length);
    const shiny = new Uint8Array(meta.etiquettes.length);
    const sprites = new Int32Array(meta.etiquettes.length);
    meta.etiquettes.forEach(([id, s], i) => {
      sprites[i] = id;
      shiny[i] = s;
      // Une forme alternative a son propre sprite mais appartient à son espèce :
      // c'est elle qu'on coche, et c'est son numéro qui porte l'ordre du dex.
      especes[i] = id > 10000 ? especeDeLaForme(dataset, id) : id;
    });
    banque = { octets: new Uint8Array(bin), taille: meta.taille, especes, shiny, sprites };
    return banque;
  }

  async function lancer(liste) {
    if (!liste.length) return;
    try {
      const b = await chargerBanque();
      const parCapture = [];
      for (let i = 0; i < liste.length; i++) {
        etape(`Lecture de la capture ${i + 1} sur ${liste.length}…`, i, liste.length);
        const imageData = await enPixels(liste[i]);
        const grille = detecterGrille(imageData);
        if (!grille) {
          parCapture.push([]);
          continue;
        }
        parCapture.push(lireCases(imageData, grille));
      }
      etape("Comparaison aux sprites officiels…", liste.length, liste.length);
      // Un tour de boucle pour que la barre s'affiche avant le gros calcul.
      await new Promise((r) => setTimeout(r, 30));
      resultats = reconnaitre(parCapture, b);
      relire();
    } catch (erreur) {
      fill(
        racine,
        titre(),
        el(
          "div.imp__corps",
          el("p.imp__texte.imp__texte--erreur", `La lecture a échoué : ${erreur.message}`),
          el("div.imp__actions", el("button.btn.btn--ghost", { type: "button", onclick: accueil }, "Recommencer"))
        )
      );
    } finally {
      fichiers.value = "";
    }
  }

  /* ------------------------------- relecture --------------------------- */

  function relire() {
    // Une espèce vue plusieurs fois ne compte qu'une : on ne range pas des
    // individus, on remplit des cases. On garde le meilleur score obtenu.
    const trouvees = new Map();
    for (const r of resultats) {
      if (!r.retenue || r.espece === null) continue;
      const cle = `${r.espece}|${r.shiny ? 1 : 0}`;
      const vu = trouvees.get(cle);
      if (!vu || r.score < vu.score) trouvees.set(cle, r);
    }

    const lignes = [...trouvees.values()]
      .map((r) => ({ ...r, ...destination(r) }))
      .filter((r) => r.slot)
      .sort((a, b) => a.espece - b.espece || Number(a.shiny) - Number(b.shiny));

    const nouvelles = lignes.filter((l) => !collection.has(l.id, l.slot));
    const douteuses = resultats.filter((r) => !r.retenue && !r.vide).length;

    if (!lignes.length) {
      fill(
        racine,
        titre(),
        el(
          "div.imp__corps",
          el("p.imp__texte", "Aucun Pokémon reconnu sur ces captures."),
          el(
            "p.imp__texte",
            "Vérifie que ce sont bien des captures de la liste « Tous les Pokémon » de HOME, " +
              "prises en entier — une capture rognée ou zoomée ne se lit pas."
          ),
          el("div.imp__actions", el("button.btn.btn--ghost", { type: "button", onclick: accueil }, "Réessayer"))
        )
      );
      return;
    }

    const choisis = new Set(nouvelles.map((l) => `${l.id}|${l.slot}`));

    const grille = el(
      "div.imp__grille",
      lignes.map((l) => {
        const cle = `${l.id}|${l.slot}`;
        const deja = collection.has(l.id, l.slot);
        const espece = dataset.byId.get(l.espece);
        return el(
          "button.imp__vignette",
          {
            type: "button",
            "aria-pressed": String(choisis.has(cle)),
            dataset: { cle },
            disabled: deja,
            title: deja
              ? "Déjà cochée dans ta collection"
              : `Confiance : ${l.score} — plus le nombre est bas, plus c'est sûr`,
            onclick: (e) => {
              const b = e.currentTarget;
              const actif = b.getAttribute("aria-pressed") === "true";
              b.setAttribute("aria-pressed", String(!actif));
              if (actif) choisis.delete(cle);
              else choisis.add(cle);
              compteur.textContent = libelleAppliquer(choisis.size);
            },
          },
          spriteImg(l.sprite > 10000 ? l.sprite : l.espece, {
            shiny: l.shiny,
            alt: "",
            className: "imp__img",
          }),
          el("span.imp__num", dexNumber(l.espece)),
          el("span.imp__nom", espece ? espece.name : `n° ${l.espece}`),
          el(
            "span.imp__etat",
            deja ? "déjà cochée" : l.shiny ? "chromatique" : "normal"
          ),
          el("span.imp__score", { class: l.score > 6 ? "imp__score imp__score--faible" : "imp__score" }, l.score)
        );
      })
    );

    const compteur = el("span.imp__compte", libelleAppliquer(choisis.size));

    fill(
      racine,
      titre(),
      el(
        "div.imp__corps",
        el(
          "p.imp__texte",
          `${lignes.length} Pokémon reconnus, dont ${nouvelles.length} qui ne sont pas encore cochés. ` +
            (douteuses
              ? `${douteuses} cases n'ont pas pu être lues avec certitude : elles ne sont pas proposées.`
              : "")
        ),
        el(
          "p.imp__texte.imp__texte--gris",
          "Le nombre en bas de chaque vignette est la distance au sprite officiel : " +
            "sous 6 la reconnaissance ne se trompe pas, au-delà relis-la. " +
            "Appuie sur une vignette pour la retirer ou la remettre."
        ),
        grille
      ),
      el(
        "div.imp__pied",
        el("button.btn.btn--ghost", { type: "button", onclick: accueil }, "Recommencer"),
        el(
          "button.btn.btn--primary",
          { type: "button", onclick: () => appliquer(lignes, choisis) },
          compteur
        )
      )
    );
  }

  const libelleAppliquer = (n) => (n ? `Cocher ces ${n} cases` : "Ne rien cocher");

  /**
   * La case à cocher pour une espèce reconnue, selon le Pokédex visé.
   * Dans GO, une espèce absente du jeu n'a pas de case : on ne la propose pas.
   */
  function destination(r) {
    const espece = dataset.byId.get(r.espece);
    if (!espece) return {};
    if (cible === "go") {
      if (!espece.goReleased) return {};
      if (r.shiny && !espece.goShiny) return {};
      return { id: espece.id, slot: r.shiny ? "gs" : "gn" };
    }
    if (r.shiny && espece.noShiny) return {};
    return { id: espece.id, slot: r.shiny ? "sm" : "om" };
  }

  function appliquer(lignes, choisis) {
    const lot = lignes
      .filter((l) => choisis.has(`${l.id}|${l.slot}`) && !collection.has(l.id, l.slot))
      .map((l) => ({ id: l.id, slot: l.slot, before: false }));
    if (!lot.length) {
      fermer();
      return;
    }
    ctx.applyBatch(lot, `Lecture de captures — ${lot.length} cases`);
    fermer();
  }

  return { ouvrir };
}

/* ------------------------------- utilitaires ----------------------------- */

/** Espèce à laquelle appartient une forme, d'après son identifiant PokeAPI. */
function especeDeLaForme(dataset, formeId) {
  for (const p of dataset.species) {
    for (const f of p.forms) if (f.id === formeId) return p.id;
  }
  return formeId;
}

/**
 * Une image de fichier, en pixels.
 *
 * Ramenée à 1080 px de large : la détection de grille travaille en proportions,
 * mais un cliché de 4000 px coûterait plusieurs secondes de calcul pour rien.
 */
async function enPixels(fichier) {
  const bitmap = await createImageBitmap(fichier);
  const largeur = Math.min(1080, bitmap.width);
  const hauteur = Math.round((bitmap.height * largeur) / bitmap.width);
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  bitmap.close();
  return ctx.getImageData(0, 0, largeur, hauteur);
}
