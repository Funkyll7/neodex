# PROJET.md — carte du projet NéoDex

> **À lire avant chaque modification.** Ce fichier liste tous les dossiers et
> fichiers, dit à quoi sert chacun, et rappelle où ajouter quoi.
> **Si tu ajoutes, déplaces ou supprimes un fichier, mets ce document à jour
> dans le même changement.**

NéoDex est un Pokédex personnel : suivi de collection sur les 1025 espèces,
formes ♂ / ♀, chromatiques, disponibilité par jeu et quêtes de shiny hunt.

- Site **100 % statique** : pas de build, pas de dépendance, pas de serveur.
  Le dossier tel quel se publie sur GitHub Pages.
- Les scripts Python de `tools/` ne servent **qu'à préparer les données**.
  Le site ne les exécute jamais.

---

## 1. Arborescence

```
Projet Poke/
├── index.html                  page unique, structure HTML de toute l'appli
├── PROJET.md                   ce fichier
├── README.md                   installation, lancement, mise en ligne
├── .gitignore                  ignore tools/.cache/ (300+ Mo reconstructibles)
├── .nojekyll                   empêche GitHub Pages de filtrer les dossiers
│
├── assets/
│   ├── css/
│   │   ├── theme.css           jetons de design — TOUTES les couleurs, clair + sombre
│   │   ├── base.css            remise à zéro, typographie, boutons, selects
│   │   ├── layout.css          squelette : barre latérale, grille, points de rupture
│   │   └── components.css      briques d'interface : vignettes, fiche, tableau, quêtes
│   ├── img/
│   │   └── favicon.svg         Poké Ball
│   └── js/
│       ├── main.js             point d'entrée : charge, câble les vues, gère l'état
│       ├── config.js           réglages (URL des sprites, pagination, clés localStorage)
│       ├── core/
│       │   ├── dom.js          el() / fill() — fabrication de DOM sans framework
│       │   ├── store.js        état applicatif + abonnements groupés
│       │   └── data.js         chargement et fusion des trois couches de données
│       ├── domain/             logique métier, sans aucun accès au DOM
│       │   ├── collection.js   marques possédées, compteurs, export / import
│       │   ├── sprites.js      URL des images + repli quand un sprite manque
│       │   ├── availability.js présence par jeu et shiny possible ou non
│       │   ├── hunt.js         choix de la méthode de chasse, tirage des quêtes
│       │   └── filters.js      filtrage et tri de la liste
│       └── ui/                 rendu, un module par zone d'écran
│           ├── theme.js        bascule clair / sombre
│           ├── sidebar.js      progression, filtres, tri
│           ├── dex-grid.js     grille de vignettes (chargement par paliers)
│           ├── detail-panel.js fiche détaillée de droite
│           ├── quest.js        onglet Quêtes et journal de chasse
│           ├── save.js         exporter / importer / réinitialiser
│           └── common.js       fragments partagés (pastilles de type, liens)
│
├── data/
│   ├── pokemon/                ▲ GÉNÉRÉ — ne pas éditer à la main
│   │   ├── manifest.json       date de génération, libellés de stats, index
│   │   └── gen-1.json … gen-9.json    1025 espèces (nom FR/EN, types, stats…)
│   ├── reference/              ✎ écrit à la main, tables de référence
│   │   ├── types.json          couleur de chaque type
│   │   ├── generations.json    jeu d'origine et année par génération
│   │   ├── games.json          22 jeux de la série principale
│   │   └── hunt.json           méthodes de shiny hunt, taux, règles d'exception
│   ├── details/                ✎ écrit à la main, enrichissement par Pokémon
│   │   └── gen-1.json … gen-9.json    où le trouver, jeux, shiny lock, variante
│   └── collection.json         ▲ GÉNÉRÉ puis corrigé — ma collection
│
├── tools/                      scripts Python, hors site
│   ├── build_dataset.py        régénère data/pokemon/ depuis PokeAPI
│   ├── fetch_sprites.py        remplit le cache de sprites (pour la lecture d'écrans)
│   ├── read_screenshots.py     lit photo/ et en déduit data/collection.json
│   └── .cache/                 (ignoré par git) CSV PokeAPI, sprites, rapport
│
└── photo/                      61 captures d'écran de Pokémon HOME (source)
```

Légende : **▲ GÉNÉRÉ** = écrasé par un script, **✎** = édité à la main.

---

## 2. Les trois couches de données

Elles sont séparées pour que la régénération automatique n'écrase jamais le
travail manuel.

| Couche | Fichiers | Origine | Contenu |
|---|---|---|---|
| **Base** | `data/pokemon/gen-*.json` | PokeAPI, via `build_dataset.py` | id, nom FR/EN, catégorie, types, génération, stats de base, dimorphisme, légendaire/fabuleux/bébé, pré-évolution |
| **Détails** | `data/details/gen-*.json` | écrit à la main | `where`, `gm`, `ev`, `nsh`, `variant`, `note`, `hab`, `gift`, `stat`, `wild` |
| **Collection** | `data/collection.json` | `read_screenshots.py` puis corrections | `om`, `of`, `sm`, `sf`, `vo`, `vs` par espèce |

`assets/js/core/data.js` les fusionne au chargement. Une espèce sans entrée dans
`details/` s'affiche normalement, mais son tableau de disponibilité indique
« pas encore renseignée » et elle ne peut pas sortir en quête.

### Champs de `data/details/gen-N.json`

Clé = numéro national en texte. Tous les champs sont facultatifs.

```jsonc
"6": {
  "where": "Évolution de Reptincel au niveau 36.",   // emplacement d'origine
  "gm":    "rb y frlg hgss xy lgpe swsh sv",         // jeux où on l'obtient
  "ev":    "",                                        // jeux où il est événementiel
  "nsh":   "lgpe",                                    // jeux où le shiny est bloqué
  "hab":   "grotte",                                  // habitat (herbe / eau / grotte…)
  "gift":  1,                                         // remis, jamais rencontré
  "stat":  1,                                         // rencontre unique non légendaire
  "wild":  1,                                         // force « rencontrable » malgré where
  "note":  "…",                                       // remplace le texte du bloc shiny hunt
  "variant": { "name": "Méga-Dracaufeu X", "id": 10034, "where": "…" }
}
```

Les codes de `gm` / `ev` / `nsh` sont ceux de `data/reference/games.json`
(`rb`, `y`, `gs`, `c`, `rs`, `e`, `frlg`, `col`, `dp`, `pt`, `hgss`, `bw`,
`b2w2`, `xy`, `oras`, `sm`, `usum`, `lgpe`, `swsh`, `bdsp`, `pla`, `sv`).

### Marques de `data/collection.json`

| Clé | Sens |
|---|---|
| `om` / `of` | forme normale, mâle / femelle |
| `sm` / `sf` | chromatique, mâle / femelle |
| `vo` / `vs` | variante déclarée dans `details`, normale / chromatique |

`of` et `sf` ne sont proposées que si l'espèce a `gd: 1` (dimorphisme visible).

---

## 3. Où ajouter quoi

| Je veux… | Fichier à toucher |
|---|---|
| changer une couleur, un rayon, une police | `assets/css/theme.css` |
| documenter un Pokémon (emplacement, jeux, shiny lock) | `data/details/gen-N.json` |
| ajouter un jeu à la série | `data/reference/games.json` |
| changer une méthode de chasse ou un taux | `data/reference/hunt.json` |
| ajouter un filtre | `assets/js/domain/filters.js` + un contrôle dans `index.html` et `ui/sidebar.js` |
| changer l'apparence d'une vignette | `assets/js/ui/dex-grid.js` + `components.css` |
| ajouter une section à la fiche | `assets/js/ui/detail-panel.js` |
| changer la source des images | `assets/js/config.js` (`spriteBase`) |
| corriger une case cochée à tort | dans le site, puis **Exporter** → remplacer `data/collection.json` |

**Règles de tenue du code**

- Aucune couleur en dur hors de `theme.css` : passer par les variables CSS.
- `domain/` ne touche jamais au DOM ; `ui/` ne contient jamais de règle de jeu.
- Pas de dépendance externe : ni npm, ni CDN de bibliothèque. Seules les images
  et les polices viennent de l'extérieur.
- Commentaires et textes d'interface en français.

---

## 4. Les outils

Ordre normal la première fois :

```bash
python tools/build_dataset.py      # data/pokemon/  (~30 s)
python tools/fetch_sprites.py      # tools/.cache/sprites/  (~300 Mo, ~5 min)
python tools/read_screenshots.py   # data/collection.json  (~10 min)
```

`build_dataset.py` est le seul indispensable pour faire tourner le site. Les
deux autres ne servent qu'à relire les captures d'écran.

### `read_screenshots.py` — ce qu'il fait et ce qu'il vaut

Il découpe chaque capture selon la grille fixe de HOME (5 colonnes × 7 lignes),
détoure chaque case du fond, puis compare la silhouette et les couleurs aux
sprites HOME officiels. Trois garde-fous :

1. **Passe libre** — seuls les scores très bas sont retenus d'emblée (ancres).
2. **Passes de rattrapage** — les boîtes de HOME étant triées par numéro
   national, une case coincée entre deux ancres ne peut être qu'une espèce de
   l'intervalle. Chaque tour resserre les intervalles du suivant.
3. **Cohérence d'ordre** — on ne garde que la plus longue suite de cases dont
   les numéros restent croissants ; une reconnaissance qui casse l'ordre est
   forcément fausse.

Résultat sur les 61 captures actuelles : **1938 cases lues sur 2013**, 675
espèces distinctes. Sur un échantillon de 33 cases relues à la main,
**31 espèces correctes** — donc de l'ordre de 5 à 10 % d'erreurs, davantage sur
le drapeau chromatique que sur l'espèce.

**Ce n'est donc pas une source de vérité.** `tools/.cache/screenshots_report.txt`
commence par la liste des marques les moins sûres, classées : c'est la liste à
relire dans le site. Corriger une case = un clic, puis **Exporter** et remplacer
`data/collection.json`.

Les deux cases masquées par les boutons flottants de HOME (ligne 7, colonnes 3
et 5) sont ignorées : les captures se chevauchent d'une ligne, elles
réapparaissent intactes dans la suivante.

---

## 5. Sauvegarde de la collection

Le site est statique : il ne peut rien écrire dans le dépôt. D'où ce cycle,
volontairement explicite :

1. `data/collection.json` est la **référence**, versionnée dans git.
2. Les cases cochées dans le navigateur vont dans le **localStorage**, par-dessus.
3. La barre latérale affiche « N espèces modifiées dans ce navigateur ».
4. **Exporter** produit un `collection.json` fusionné → le remplacer dans le
   dépôt et commiter.
5. **Réinitialiser** jette la couche locale et revient au fichier.

Vider les données du site dans le navigateur ne perd donc jamais que les
modifications non exportées.
