# PROJET.md — carte du projet NéoDex

> **À lire avant chaque modification.** Ce fichier liste tous les dossiers et
> fichiers, dit à quoi sert chacun, et rappelle où ajouter quoi.
> **Si tu ajoutes, déplaces ou supprimes un fichier, mets ce document à jour
> dans le même changement.**

NéoDex est un Pokédex personnel : suivi de collection sur les 1025 espèces et
leurs 304 formes alternatives (Alola, Galar, Hisui, Paldéa, Méga-Évolutions,
Gigamax…), formes ♂ / ♀, chromatiques, disponibilité par jeu, verrouillage
chromatique et méthode de shiny hunt jeu par jeu.

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
│       │   ├── sprites.js      URL des images (espèces et formes) + replis
│       │   ├── availability.js présence par jeu et shiny possible ou non
│       │   ├── hunt.js         choix de la méthode de chasse, tirage des quêtes
│       │   ├── sync.js         écrit data/collection.json dans le dépôt via l'API GitHub
│       │   ├── completion.js   « tout obtenu ? » — cases exigées, l'impossible exclu
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
│   ├── forms/                  ▲ GÉNÉRÉ — ne pas éditer à la main
│   │   ├── manifest.json       total par catégorie, formes sans sprite shiny
│   │   └── gen-1.json … gen-9.json    304 formes (id, nom FR, types, sprites)
│   ├── availability/           ▲ GÉNÉRÉ — ne pas éditer à la main
│   │   ├── manifest.json       nombre d'espèces par jeu
│   │   └── gen-1.json … gen-9.json    gm / ev / wild par espèce
│   ├── reference/              ✎ écrit à la main, tables de référence
│   │   ├── types.json          couleur de chaque type
│   │   ├── generations.json    jeu d'origine et année par génération
│   │   ├── games.json          23 jeux de la série principale (+ version groups)
│   │   ├── hunt.json           méthodes de shiny hunt, taux, règles d'exception
│   │   └── shiny-locks.json    qui est verrouillé chromatique, et dans quel jeu
│   ├── details/                ✎ écrit à la main, enrichissement par Pokémon
│   │   ├── gen-1.json … gen-9.json    où le trouver, corrections de jeux
│   │   └── forms.json          où obtenir chaque forme, par catégorie et au cas par cas
│   └── collection.json         ▲ GÉNÉRÉ puis corrigé — ma collection
│
├── tools/                      scripts Python, hors site
│   ├── build_dataset.py        régénère data/pokemon/ depuis PokeAPI
│   ├── build_forms.py          régénère data/forms/ + vérifie chaque sprite
│   ├── build_availability.py   régénère data/availability/ (Pokédex + rencontres)
│   ├── fetch_sprites.py        remplit le cache de sprites (pour la lecture d'écrans)
│   ├── read_screenshots.py     lit photo/ et en déduit data/collection.json
│   └── .cache/                 (ignoré par git) CSV PokeAPI, sprites, rapport
│
└── photo/                      (ignoré par git) captures Pokémon HOME à relire
```

Légende : **▲ GÉNÉRÉ** = écrasé par un script, **✎** = édité à la main.

---

## 2. Les cinq couches de données

Elles sont séparées pour que la régénération automatique n'écrase jamais le
travail manuel. Ce qui se déduit d'une base de données est **généré** ; ce qui
demande un arbitrage humain est **écrit à la main**.

| Couche | Fichiers | Origine | Contenu |
|---|---|---|---|
| **Base** | `data/pokemon/gen-*.json` | PokeAPI, via `build_dataset.py` | id, nom FR/EN, catégorie, types, génération, stats de base, dimorphisme, légendaire/fabuleux/bébé, pré-évolution |
| **Formes** | `data/forms/gen-*.json` | PokeAPI + dépôt de sprites, via `build_forms.py` | id, nom FR, catégorie de forme, types, stats, sprites réellement existants |
| **Disponibilité** | `data/availability/gen-*.json` | Pokédex régionaux + table des rencontres, via `build_availability.py` | `gm` (jeux où on l'obtient), `ev` (événement), `wild` (jeux où on le croise dehors) |
| **Détails** | `data/details/*.json` | écrit à la main | corrections et textes : `where`, `gm`, `nogm`, `ev`, `note`, `hab`, `gift`, `stat`, `wild` — et `forms.json` pour les formes |
| **Collection** | `data/collection.json` | `read_screenshots.py` puis corrections | `om`, `of`, `sm`, `sf`, `f<id>`, `f<id>s` par espèce |

`assets/js/core/data.js` les fusionne au chargement, plus les tables de
`data/reference/`. Les 1025 espèces ont désormais une disponibilité : le
tableau « Où le trouver » n'est jamais vide.

**Règle de fusion à retenir :** la disponibilité générée est le socle, `gm` des
détails **s'y ajoute**, `nogm` en **retire**. Deux sources qui se contredisent
donnent donc une union, jamais un écrasement silencieux.

### Champs de `data/details/gen-N.json`

Clé = numéro national en texte. Tous les champs sont facultatifs — on n'écrit
ici que ce que la génération ne sait pas deviner.

```jsonc
"889": {
  "where": "Intrigue d'Épée/Bouclier, puis Tréfonds de l'Aire Zéro.",
  "gm":    "sv",        // jeux à ajouter au socle généré
  "nogm":  "",          // jeux à retirer du socle généré
  "ev":    "",          // jeux où il n'arrive que par événement
  "hab":   "grotte",    // habitat (herbe / eau / grotte…), affine le Poké Radar
  "gift":  1,           // remis, jamais rencontré
  "stat":  1,           // rencontre unique non légendaire
  "wild":  1,           // force « rencontrable » partout où il est présent
  "nowild": "",         // jeux où il n'est finalement pas rencontrable
  "note":  "…"          // remplace le texte du bloc shiny hunt
}
```

Les codes sont ceux de `data/reference/games.json` (`rb`, `y`, `gs`, `c`, `rs`,
`e`, `frlg`, `col`, `dp`, `pt`, `hgss`, `bw`, `b2w2`, `xy`, `oras`, `sm`,
`usum`, `lgpe`, `swsh`, `bdsp`, `pla`, `sv`, `za`).

Le verrouillage chromatique ne se met **plus** ici : il vit dans
`data/reference/shiny-locks.json` (voir § 3).

### Marques de `data/collection.json`

| Clé | Sens |
|---|---|
| `om` / `of` | forme normale, mâle / femelle |
| `sm` / `sf` | chromatique, mâle / femelle |
| `f<id>` / `f<id>s` | forme alternative n° `<id>` (id PokeAPI), normale / chromatique |
| `vo` / `vs` | ancien schéma : la **première** forme collectionnable de l'espèce |

`of` et `sf` ne sont proposées que si l'espèce a `gd: 1` (dimorphisme visible).
`vo` / `vs` restent lus et écrits pour la forme principale, ce qui garde les
collections déjà exportées valables.

---

## 3. Formes alternatives et verrouillage chromatique

### Les 304 formes

`tools/build_forms.py` recense toute entrée PokeAPI dont l'id dépasse 10000 et
la range dans une catégorie, dans l'ordre d'affichage de la fiche :

| Catégorie | Nombre | Collectionnable ? |
|---|---|---|
| `alola` / `galar` / `hisui` / `paldea` | 18 / 20 / 16 / 4 | oui — chromatique propre à chasser |
| `mega` | 96 | non — transformation de combat |
| `primal` | 2 | non |
| `gmax` | 34 | oui — le facteur Gigamax appartient à l'individu |
| `cap` | 14 | non — aucun chromatique n'existe |
| `battle` | 26 | non — visible seulement en combat |
| `other` | 74 | oui — entrée distincte dans HOME |

Les formes Totem de Soleil/Lune sont volontairement ignorées : elles n'ont pas
d'entrée HOME. Les modes de monture de Koraidon et Miraidon aussi, faute de
sprite.

Le script **vérifie image par image** ce qui existe vraiment sur le dépôt
`PokeAPI/sprites` (HOME normal, HOME chromatique, artwork officiel, artwork
chromatique) et écrit le résultat dans le champ `sprites`. Le site s'en sert
pour ne jamais demander une image absente — et pour dire honnêtement « aucun
chromatique n'existe pour cette forme » quand c'est le cas.

`data/details/forms.json` complète le tableau à la main, avec trois niveaux de
précédence : `defaults` par catégorie → `bySince` par jeu d'introduction →
`forms` au cas par cas. Le champ `shiny` y vaut :

- `own` — la forme a son propre chromatique, à chasser séparément ;
- `base` — elle reprend celui du Pokémon de base (Méga, Primo, formes de combat) ;
- `none` — aucun chromatique n'existe.

### « Tout obtenu »

`assets/js/domain/completion.js` répond à « ai-je tout pour ce Pokémon ? ». La
règle : **tout ce qui est obtenable, l'impossible exclu.** Sont retirés du
calcul, automatiquement :

- le chromatique d'une espèce verrouillée dans tous les jeux où elle apparaît
  (Ogerpon, Koraidon, les fabuleux) ;
- le chromatique d'une forme dont aucun sprite chromatique n'existe (les
  Pikachu à casquette, le Pikachu partenaire) ou qui est verrouillée partout
  (Pikachu Gigamax, offert donc bloqué) ;
- les formes non collectionnables — Méga, Primo, formes de combat.

Sans cette soustraction, Pikachu et Évoli ne seraient jamais complets et
l'indicateur ne voudrait plus rien dire. Concrètement : Bulbizarre demande
2 cases, Pikachu 6, Miaouss 8, Ogerpon 4 (aucun chromatique).

Une vignette complète prend une bordure dorée, un fond teinté et un badge
« ★ Complet », plus une animation jouée **une seule fois**, au moment où elle
bascule — `ui/dex-grid.js` ajoute alors `card--just-complete`. L'animer en
permanence sur des centaines de vignettes coûterait cher pour rien. Tout est
neutralisé sous `prefers-reduced-motion`.

Deux entrées de filtre s'y rattachent : « ★ Complets » et « À terminer ».

### Le shiny lock

`data/reference/shiny-locks.json` répond à « puis-je avoir ce chromatique ici ? »
sur trois niveaux :

- `always.species` — fabuleux que la série ne génère jamais en chromatique ;
- `byGame.<code>.species` — numéros nationaux bloqués dans ce jeu précis, avec
  `why` et `note` affichés dans la fiche ;
- `forms.<clé>` — formes bloquées, `"*"` signifiant « dans aucun jeu ».

Les clés de `forms` sont les identifiants PokeAPI (`meowth-galar`), pas les ids
numériques : c'est beaucoup moins facile à se tromper à la main. Un verrou posé
sur l'espèce se propage automatiquement à toutes ses formes.

---

## 4. Où ajouter quoi

| Je veux… | Fichier à toucher |
|---|---|
| changer une couleur, un rayon, une police | `assets/css/theme.css` |
| documenter un Pokémon (emplacement, corrections de jeux) | `data/details/gen-N.json` |
| documenter une forme (où l'obtenir, remarque) | `data/details/forms.json` |
| corriger un verrouillage chromatique | `data/reference/shiny-locks.json` |
| ajouter un jeu à la série | `data/reference/games.json` (dont ses `vg`) |
| changer une méthode de chasse ou un taux | `data/reference/hunt.json` |
| ajouter un filtre | `assets/js/domain/filters.js` + un contrôle dans `index.html` et `ui/sidebar.js` |
| changer l'apparence d'une vignette | `assets/js/ui/dex-grid.js` + `components.css` |
| ajouter une section à la fiche | `assets/js/ui/detail-panel.js` |
| changer la règle du « tout obtenu » | `assets/js/domain/completion.js` |
| retoucher la feuille mobile | `ui/detail-panel.js` (`createSheet`) + bloc « Feuille mobile » de `components.css` |
| changer la source des images | `assets/js/config.js` (`spriteBase`) |
| changer le dépôt de synchronisation | `assets/js/config.js` (bloc `github`) |
| corriger une case cochée à tort | dans le site : la synchronisation s'en occupe (§ 6) |

**Règles de tenue du code**

- Aucune couleur en dur hors de `theme.css` : passer par les variables CSS.
- `domain/` ne touche jamais au DOM ; `ui/` ne contient jamais de règle de jeu.
- Pas de dépendance externe : ni npm, ni CDN de bibliothèque. Seules les images
  et les polices viennent de l'extérieur.
- Commentaires et textes d'interface en français.

---

## 5. Les outils

`photo/` et `tools/.cache/` sont **hors dépôt** : GitHub Pages sert le dossier
tel quel, publier les captures d'écran reviendrait à les exposer. Seul leur
résultat, `data/collection.json`, est versionné. Pour relancer une lecture,
remets les captures dans `photo/`.

Ordre normal la première fois :

```bash
python tools/build_dataset.py      # data/pokemon/       (~30 s)
python tools/build_forms.py        # data/forms/         (~2 min, vérifie les sprites)
python tools/build_availability.py # data/availability/  (~30 s)
python tools/fetch_sprites.py      # tools/.cache/sprites/  (~300 Mo, ~5 min)
python tools/read_screenshots.py   # data/collection.json  (~10 min)
```

Les trois premiers sont ceux qui font tourner le site ; ils acceptent tous
`--cache` pour réutiliser les CSV déjà téléchargés. `build_forms.py` accepte en
plus `--offline`, qui se contente du cache de sprites local sans interroger le
réseau. Les deux derniers ne servent qu'à relire les captures d'écran.

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

## 6. Sauvegarde de la collection

`data/collection.json` est la **référence**, versionnée dans git. Les cases
cochées vont d'abord dans le **localStorage**, par-dessus. Deux façons de faire
redescendre le localStorage dans le dépôt.

### Synchronisation directe (le chemin normal)

`assets/js/domain/sync.js` écrit `data/collection.json` dans le dépôt via l'API
GitHub, depuis le navigateur. Le site reste statique : il n'y a pas de serveur,
c'est le navigateur qui commite.

1. Dans la barre latérale, coller un **jeton d'accès personnel à portée
   limitée** — dépôt `neodex` uniquement, permission `Contents: read and write`.
2. Le jeton est vérifié tout de suite, puis rangé dans le localStorage de ce
   navigateur, et nulle part ailleurs. « Oublier » l'efface.
3. Chaque case cochée programme une écriture ; les suivantes la repoussent de
   `CONFIG.github.delayMs` (4 s). Cocher dix cases fait donc un seul commit.
4. Quitter l'onglet (`visibilitychange`) déclenche l'écriture immédiatement :
   sur téléphone, c'est le cas courant.
5. **Recharger** reprend ce que contient le dépôt — utile quand on a coché
   depuis un autre appareil.

Le `sha` du fichier distant est relu avant chaque écriture ; en cas de conflit
(quelqu'un a commité entre-temps), l'écriture est retentée une fois avec le
`sha` frais. Rien n'est écrasé en silence.

Le dépôt de destination se règle dans `assets/js/config.js`, bloc `github`
(`owner`, `repo`, `branch`, `path`).

### Export / import (le filet)

Toujours là, et sans jeton : **Exporter** produit un `collection.json` fusionné
à remplacer dans le dépôt, **Importer** relit un fichier, **Réinitialiser**
jette la couche locale et revient au fichier de référence.

Vider les données du site dans le navigateur ne perd donc jamais que les
modifications non encore synchronisées.
