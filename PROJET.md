# PROJET.md — carte du projet Funkylldex

> **À lire avant chaque modification.** Ce fichier liste tous les dossiers et
> fichiers, dit à quoi sert chacun, et rappelle où ajouter quoi.
> **Si tu ajoutes, déplaces ou supprimes un fichier, mets ce document à jour
> dans le même changement.**

Funkylldex est un Pokédex personnel : suivi de collection sur les 1025 espèces,
leurs 304 formes alternatives (Alola, Galar, Hisui, Paldéa, Méga-Évolutions,
Gigamax…) et leurs 160 formes cosmétiques (Zarbi, Prismillon, Charmilly…),
formes ♂ / ♀, chromatiques, disponibilité par jeu, verrouillage chromatique et
méthode de shiny hunt jeu par jeu. Soit 2 802 cases à cocher.

- Site **100 % statique** : pas de build, pas de dépendance, pas de serveur.
  Le dossier tel quel se publie sur GitHub Pages.
- Les scripts de `tools/` ne servent **qu'à préparer les données**.
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
├── sw.js                       cache hors ligne (voir § 7)
│
├── assets/
│   ├── css/
│   │   ├── theme.css           jetons de design — TOUTES les couleurs, clair + sombre
│   │   ├── base.css            remise à zéro, typographie, boutons, selects
│   │   ├── layout.css          squelette : barre latérale, grille, points de rupture
│   │   └── components.css      briques d'interface : vignettes, fiche, tableau, quêtes
│   ├── img/
│   │   ├── favicon.svg         Poké Ball
│   │   ├── gigamax.png         pastille Gigamax
│   │   ├── gigamax-nb.png      la même, éteinte (case non cochée)
│   │   ├── shiny.png           logo chromatique — utilisé en MASQUE CSS (§ 4)
│   │   ├── forme-alola.png     logos de région, sur les tuiles et les barres
│   │   ├── forme-galar.png
│   │   ├── forme-paldea.png
│   │   └── sources/            originaux non recadrés, hors du site
│   └── js/
│       ├── main.js             point d'entrée : charge, câble les vues, gère l'état
│       ├── config.js           réglages (sprites épinglés, pagination, localStorage, hors ligne)
│       ├── core/
│       │   ├── dom.js          el() / fill() — fabrication de DOM sans framework
│       │   ├── store.js        état applicatif + abonnements groupés
│       │   └── data.js         chargement et fusion des six couches de données
│       ├── domain/             logique métier, sans aucun accès au DOM
│       │   ├── collection.js   marques possédées, compteurs, export / import
│       │   ├── sprites.js      URL des images (espèces, formes, cosmétiques) + replis
│       │   ├── availability.js présence par jeu et shiny possible ou non
│       │   ├── hunt.js         choix de la méthode de chasse, tirage des quêtes
│       │   ├── sync.js         écrit data/collection.json dans le dépôt via l'API GitHub
│       │   ├── completion.js   « tout obtenu ? » — cases exigées, l'impossible exclu
│       │   ├── progress.js     compteurs par case : par région, Gigamax, paires, chromatiques
│       │   ├── filters.js      filtrage, recherche et tri de la liste
│       │   └── display.js      quel sprite montrer quand seule une forme est possédée
│       └── ui/                 rendu, un module par zone d'écran
│           ├── theme.js        palette de thèmes (le bouton de la marque l'ouvre)
│           ├── themes-list.js  les 26 palettes, en quatre familles
│           ├── sidebar.js      progression, filtres, tri
│           ├── dex-grid.js     grille de vignettes (chargement par paliers)
│           ├── go-dex.js       onglet Pokédex Pokémon GO (deux cases par espèce)
│           ├── detail-panel.js fiche détaillée de droite
│           ├── quest.js        onglet Quêtes et journal de chasse
│           ├── save.js         exporter / importer / réinitialiser
│           ├── shortcuts.js    raccourcis clavier (/ · ← → · 1 2 · Échap)
│           ├── to-top.js       bouton « revenir en haut » (apparaît au défilement)
│           ├── active-filters.js pastilles des filtres actifs + compteur du menu
│           ├── undo.js         bandeau « Annuler » et pile des cases cochées
│           ├── haptics.js      retour vibrant sur les cases (suit « mouvement réduit »)
│           ├── mur.js          le mur des chromatiques (vue d'ensemble)
│           ├── reste.js        « Manquant par jeu » : case par case, jeu et DLC
│           ├── popup.js        la coquille commune des panneaux qui s'ouvrent par-dessus
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
│   │   ├── shiny-locks.json    verrou chromatique par jeu, + `noShiny` (jamais nulle part)
│   │   ├── dlc.json            les 4 contenus téléchargeables : `toutes` et `species` (§ 3 bis)
│   │   └── go.json             Pokémon GO : les 73 espèces pas encore obtenables
│   │                           et les 889 chromatiques (relevé Serebii)
│   ├── details/                ✎ écrit à la main, enrichissement par Pokémon
│   │   ├── gen-1.json … gen-9.json    où le trouver, corrections de jeux
│   │   ├── forms.json          où obtenir chaque forme, par catégorie et au cas par cas
│   │   └── cosmetic-forms.json les formes que PokeAPI n'expose pas (Zarbi, Prismillon,
│   │                           Flabébé, Couafarel, Charmilly, Cheniti, Sancoki…)
│   └── collection.json         ▲ GÉNÉRÉ puis corrigé — ma collection
│
├── tools/                      scripts hors site
│   ├── check_data.py           vérifie la cohérence des renvois — n'écrit rien
│   ├── crop_logos.ps1          recadre assets/img/sources/ (PowerShell, § 4)
│   ├── build_dataset.py        régénère data/pokemon/ depuis PokeAPI
│   ├── build_forms.py          régénère data/forms/ + vérifie chaque sprite
│   ├── build_availability.py   régénère data/availability/ (Pokédex + rencontres)
│   ├── fetch_sprites.py        remplit le cache de sprites (pour la lecture d'écrans)
│   ├── read_screenshots.py     lit photo/ → tools/.cache/collection-lue.json (§ 5)
│   └── .cache/                 (ignoré par git) CSV PokeAPI, sprites, rapport
│
└── photo/                      (ignoré par git) captures Pokémon HOME à relire
```

Légende : **▲ GÉNÉRÉ** = écrasé par un script, **✎** = édité à la main.

---

## 2. Les six couches de données

Elles sont séparées pour que la régénération automatique n'écrase jamais le
travail manuel. Ce qui se déduit d'une base de données est **généré** ; ce qui
demande un arbitrage humain est **écrit à la main**.

| Couche | Fichiers | Origine | Contenu |
|---|---|---|---|
| **Base** | `data/pokemon/gen-*.json` | PokeAPI, via `build_dataset.py` | id, nom FR/EN, catégorie, types, génération, stats de base, dimorphisme, légendaire/fabuleux/bébé, pré-évolution |
| **Formes** | `data/forms/gen-*.json` | PokeAPI + dépôt de sprites, via `build_forms.py` | id, nom FR, catégorie de forme, types, stats, sprites réellement existants |
| **Disponibilité** | `data/availability/gen-*.json` | Pokédex régionaux + table des rencontres, via `build_availability.py` | `gm` (jeux où on l'obtient), `ev` (événement), `wild` (jeux où on le croise dehors) |
| **Détails** | `data/details/*.json` | écrit à la main | corrections et textes : `where`, `gm`, `nogm`, `ev`, `note`, `hab`, `gift`, `stat`, `wild` — et `forms.json` pour les formes |
| **Cosmétiques** | `data/details/cosmetic-forms.json` | écrit à la main | les formes sans entrée `/pokemon` chez PokeAPI : 28 Zarbi, 20 Prismillon, 63 Charmilly, 10 Couafarel, 5 Flabébé × 3 espèces, saisons, capes, mers, formes de thé |
| **Collection** | `data/collection.json` | le site (synchronisation, « Lire des captures ») | `om`, `of`, `sm`, `sf`, `f<id>`, `f<id>s`, `x<n>-<clef>`, `y<n>-<clef>` par espèce |

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
| `f<id>f` / `f<id>sf` | la même en femelle, pour les formes à dimorphisme (Farfuret de Hisui) |
| `x<n>-<clef>` / `y<n>-<clef>` | forme cosmétique — `x201-b` = Zarbi B, `y666-savanna` = Prismillon Mangrove chromatique |
| `vo` / `vs` / `vof` / `vsf` | ancien schéma, **supprimé** — voir ci-dessous |

`of` et `sf` ne sont proposées que si l'espèce a `gd: 1` (dimorphisme visible).

### Pourquoi `vo` / `vs` ont disparu

Ces quatre cases désignaient « la première forme collectionnable de l'espèce ».
Une position, pas une identité : dès qu'une forme apparaissait, changeait de
statut ou passait en `hidden`, `vo` se mettait à désigner **un autre Pokémon**,
sans que rien ne le signale. Trois collections s'y sont perdues — Floette,
Météno et Melmetal, dont la seule forme cochable est en `shiny: "none"` : la
règle de l'époque excluait ces formes du choix, l'espèce se retrouvait sans
forme principale, et la case cochée ne désignait plus rien.

Chaque forme porte donc désormais **sa** case `f<id>`, toujours la même.
Les 107 marques héritées de `data/collection.json` ont été converties une fois
pour toutes ; `migrateLegacySlots()` dans `domain/collection.js` fait la même
conversion à la volée, au chargement, à l'import d'une vieille sauvegarde et au
« Recharger » — une sauvegarde exportée avant la bascule reste donc lisible.
Une marque héritée qu'aucune forme ne peut accueillir est laissée intacte
plutôt que posée au hasard.

`species.primaryForm` existe toujours, mais ne sert plus qu'à choisir le
raccourci affiché sur la vignette : il ne décide plus d'aucun nom de case.

Chez les espèces à formes cosmétiques, **la variante de base réutilise `om` /
`sm`** : le Zarbi A, la Prismillon Motif Floraison, la Flabébé Fleur Rouge *sont*
la forme par défaut de l'espèce. Sans cela on cocherait deux fois la même
chose, et `isOwned()` ne saurait plus quoi regarder.

### « Est-ce que j'ai ce Pokémon ? » — deux réponses, pas une

`isOwned()` regarde `om` / `of`, **et aussi les cases cosmétiques `x…`** : un
Zarbi B est un Zarbi, une Prismillon Motif Continental est une Prismillon. Sans
cette clause, une vignette s'affichait « manquante » alors que sa grille de
variantes était cochée — seule la variante de base écrit `om`.

Une forme **régionale**, elle, ne compte pas : un Miaouss d'Alola ne remplace
pas le Miaouss de Kanto dans une boîte de HOME, il s'ajoute à lui. C'est
`domain/display.js` (`formeDeRepli`) qui traite ce cas — la vignette montre le
sprite de la forme possédée, en couleur, au lieu de laisser croire qu'on n'a
rien. Elle porte alors `.card--partial`, ni possédée ni absente.

### Les deux cases du Pokédex Pokémon GO

Le total n'est pas 1025 × 2. 73 espèces sont marquées « Not Currently
Available » par Serebii — Arceus, Manaphy, les Trésors du Fléau, la moitié de
Paldéa — et 64 des 952 restantes n'ont pas encore de chromatique dans GO. La
grille les montre quand même, grisées et sans case : savoir qu'un Pokémon
manque au jeu fait partie de ce qu'on vient chercher. Les deux listes sont dans
`data/reference/go.json`.

`gn` et `gs` vivent dans le même `marks[id]` que tout le reste : un seul
fichier, une seule synchronisation, un seul export. Elles n'apparaissent jamais
dans `requiredSlots()`, donc ni `completion.js` ni `progress.js` ne les voient —
cocher un GO ne fait pas bouger d'un point la progression HOME. `goProgressOf()`
les compte à part.

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
`forms` au cas par cas. Champs propres à une forme :

- `shiny` — `own` (chromatique propre à chasser) / `base` (celui du Pokémon de
  base : Méga, Primo, formes de combat) / `none` (aucun chromatique n'existe) ;
- `entry` — `0` retire **les cases** sans retirer la fiche : la forme n'a pas
  d'entrée à elle dans HOME. C'est le cas des fusions (Kyurem Noir, Necrozma
  Solgaleo, Sylveroy monté), des Formes Originelles de Dialga / Palkia /
  Giratina, de l'Infinimax d'Éthernatos et des partenaires de Let's Go ;
- `hidden` — `1` retire la forme complètement, doublon ou mirage : une femelle
  déjà couverte par la case ♀ de l'espèce (Mistigrix, Wimessir, Paragruel,
  Fragroin), le Zygarde 50 % en double, l'Amphinobi Synergie qui est le même
  Pokémon que la Forme Sacha, les masques d'Ogerpon qui ne montent pas dans HOME ;
- `gendered` — `1` donne quatre cases à la forme (♂ / ♀ × normal / chromatique).
  Un seul cas à ce jour : le Farfuret de Hisui.

### Les formes cosmétiques

PokeAPI ne donne pas d'entrée `/pokemon` aux Zarbi, Prismillon, Flabébé,
Couafarel, Charmilly, Cheniti, Sancoki, Tritosor, Vivaldaim, Haydaim, Théffroi
et consorts : `build_forms.py` ne peut donc pas les voir. Elles vivent dans
`data/details/cosmetic-forms.json`, écrit à la main, et s'affichent sous forme
de **grille à cocher** (deux cases par tuile) suivie du détail de chaque
variante. Les sprites existent bel et bien dans le dépôt PokeAPI, nommés par
forme (`666-savanna`, `201-b`, `869-rainbow-swirl-love-sweet`).

Clés d'un groupe : `title`, `base` (la variante qui *est* la forme par défaut),
`where`, `note`, `layout` (`compact` pour les lettres, `wide` pour les motifs),
`fold` (replié d'office — les 63 Charmilly), `info` (aucune case à cocher :
le seul Pichu Troizépi), `spriteSet` (`classic` quand la forme n'a pas de rendu
HOME). Clés d'une variante : `key`, `name`, `short`, `where`, `sprite` (le nom
du fichier quand il ne se déduit pas de `<id>-<key>`), `noshiny`, `nosprite`,
`noentry` (`1` = la variante s'affiche mais ne peut pas entrer dans HOME : ni
case normale, ni case chromatique — les six Pikachu Cosplayeur de Hoenn).

### « Tout obtenu »

`assets/js/domain/completion.js` répond à « ai-je tout pour ce Pokémon ? ».
La règle tient en une phrase : **tout ce qui a existé un jour est à cocher.**
Un chromatique distribué une seule fois en 2013 reste un chromatique qu'on peut
avoir en boîte — il compte. Trois soustractions, et trois seulement :

- les espèces listées dans `noShiny` de `data/reference/shiny-locks.json` :
  aucun chromatique n'en a jamais été produit, ni en jeu, ni en distribution, ni
  par GO. Victini, Ogerpon, Shifours, les Trésors de Ruine du DLC… Elles n'ont
  pas de bouton « Shiny » du tout, et le verrou se propage à leurs formes ;
- les formes sans entrée dans HOME (`entry: 0`, plus Méga / Primo / combat) ;
- les formes en `shiny: "none"` ou sans sprite chromatique — Pikachu à
  casquette, Amphinobi Forme Sacha, Melmetal Gigamax, noyaux de Météno,
  Floette Éternel, Prismillon Poké Ball.

Attention à ne pas confondre `always` et `noShiny` dans `shiny-locks.json` :
`always` dit « la série principale ne le génère jamais » — c'est une
information de **chasse**, elle ne retire rien du « tout obtenu ». Shaymin,
Darkrai, Phione, Manaphy, Meloetta, Genesect, Arceus, Volcanion, Zeraora,
Diancie, les Gardiens d'Alola, Regieleki, Regidrago, Solgaleo, Lunala, Koraidon
et Miraidon sont dans ce cas : pas chassables, mais leur chromatique existe,
donc exigé.

Concrètement : Bulbizarre demande 2 cases, Miaouss 8, Pikachu 15, Zarbi 56,
Prismillon 39, Charmilly 128, Diancie 2, Melmetal 3, Ogerpon 1 (aucun
chromatique nulle part).

Chaque vignette affiche son compteur — `3/8` — à côté du losange qui compte les
formes : on sait ce que le Pokémon réclame sans ouvrir la fiche. Une vignette
complète prend en plus une bordure dorée, un fond teinté et un badge
« ★ Complet », plus une animation jouée **une seule fois**, au moment où elle
bascule — `ui/dex-grid.js` ajoute alors `card--just-complete`. L'animer en
permanence sur des centaines de vignettes coûterait cher pour rien. Tout est
neutralisé sous `prefers-reduced-motion`.

Deux entrées de filtre s'y rattachent : « ★ Complets » et « À terminer ».

### Compteurs globaux

`assets/js/domain/progress.js` répond à l'autre question : « combien de **cases**
ai-je, sur les 2 802 du site ? ». C'est ce total qui porte le grand chiffre de
la barre latérale, sous le titre « Progression totale ».

À ne pas confondre avec `collection.counts()`, qui compte des **espèces** : un
Miaouss capturé pèse une espèce et huit cases. Les deux sont affichés, mais
séparément et sous deux noms distincts — « Progression totale » pour les cases,
« Progression Pokédex » pour les espèces, cette dernière étant une barre du
groupe « Ma collection ».

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

## 3 bis. Les contenus téléchargeables

`data/reference/dlc.json` porte quatre enregistrements — l'Île Solitaire de
l'Armure et les Terres Enneigées de la Couronne (Épée/Bouclier), le Trésor
Enfoui de la Zone Zéro (Écarlate/Violet), la Méga-Dimension (Légendes Z-A). Un
DLC porte **deux listes d'espèces**, et il faut les deux parce qu'on pose au
fichier deux questions différentes :

| Champ | Contenu | Répond à |
|---|---|---|
| `toutes` | le Pokédex du DLC plus ses hors-dex, **sans rien retirer** | « ce contenu recense-t-il cette espèce ? » |
| `species` | la même liste, **moins** ce que le Pokédex du jeu de base donne déjà | « faut-il acheter quelque chose pour l'avoir ici ? » |

`domain/dlc.js` les lit — `dlcApporte()` pour la première, `dlcRequis()` pour
la seconde — et ne recalcule jamais rien : `species` est produit par
soustraction à la génération, la refaire ici aurait créé un second endroit à
tenir d'accord avec le premier.

### Les deux règles du tableau « Où le trouver »

`domain/availability.js` en tire vingt-sept lignes : les vingt-trois jeux, plus
une sous-ligne par DLC sous les trois jeux qui en ont, **toujours affichées**,
même pour dire non.

1. **La ligne du jeu bascule en « indisponible »** quand `dlcRequis()` renvoie
   quelque chose — c'est-à-dire quand la cartouche seule ne suffit pas. Rayquaza
   dans Écarlate/Violet affiche donc un tiret, et le Trésor Enfoui juste dessous
   affiche « Disponible ».
2. **Une sous-ligne de DLC dit oui si son DLC apporte l'espèce, OU si le jeu de
   base la donne déjà.** On ne joue pas « au DLC » : on joue au jeu **avec** le
   DLC installé, et l'achat n'a jamais retiré une rencontre.

**La seconde règle ne se déduit d'aucun champ, et c'est pourquoi elle est
écrite dans le code.** Le `toutes` de la Méga-Dimension compte 132 numéros —
exactement son `species` : le Pokédex Hyperespace ne recense que ses
nouveautés. Ses **failles extradimensionnelles**, elles, rejouent une grande
part du jeu de base, triées par type — Bulbizarre, Herbizarre et Florizarre se
croisent dans les failles Poison. Le Pokédex de l'Île Solitaire relistait le
jeu de base (220 numéros contre 119 exclusifs), celui de l'Hyperespace non :
`build_availability.py` déduit les DLC des Pokédex, et **un Pokédex de DLC n'a
aucune obligation de relister le jeu de base**. Sans la seconde règle, la
Méga-Dimension déclarait Bulbizarre indisponible alors qu'il s'y chasse.

Une sous-ligne ne peut en revanche **jamais contredire son jeu** : elle est
bâtie par étalement de la ligne du jeu, donc quand `data/availability` dit que
l'espèce n'est pas là, la sous-ligne l'est aussi, quoi que `toutes` prétende.
C'est `data/availability` qui tranche, ici comme partout.

---

## 4. Où ajouter quoi

| Je veux… | Fichier à toucher |
|---|---|
| changer une couleur, un rayon, une police | `assets/css/theme.css` |
| documenter un Pokémon (emplacement, corrections de jeux) | `data/details/gen-N.json` |
| documenter une forme (où l'obtenir, remarque) | `data/details/forms.json` |
| retirer les cases d'une forme (pas transférable dans HOME) | `data/details/forms.json`, champ `entry: 0` |
| supprimer une forme en double | `data/details/forms.json`, champ `hidden: 1` |
| ajouter une forme cosmétique (motif, couleur, saison…) | `data/details/cosmetic-forms.json` |
| limiter une forme cosmétique à certains jeux | `data/details/cosmetic-forms.json`, `gm` / `nogm` (variante ou groupe) |
| dire qu'une espèce n'a **aucun** chromatique | `data/reference/shiny-locks.json`, bloc `noShiny` |
| corriger un verrouillage chromatique par jeu | `data/reference/shiny-locks.json`, bloc `byGame` |
| ajouter un jeu à la série | `data/reference/games.json` (dont ses `vg`) |
| changer une méthode de chasse ou un taux | `data/reference/hunt.json` |
| ajouter un filtre | `assets/js/domain/filters.js` + un contrôle dans `index.html` et `ui/sidebar.js` |
| ajouter une famille au filtre « Forme » | `assets/js/domain/filters.js` (`FORM_FILTERS`) |
| retoucher une tuile de forme | `ui/detail-panel.js` (`formTile`) + bloc `.ftile` de `components.css` |
| changer l'apparence d'une vignette | `assets/js/ui/dex-grid.js` + `components.css` |
| ajouter une section à la fiche | `assets/js/ui/detail-panel.js` |
| retoucher la grille à cocher des cosmétiques | `ui/detail-panel.js` (`cosmeticPicker`) + bloc `.picker` de `components.css` |
| changer la règle du « tout obtenu » | `assets/js/domain/completion.js` |
| changer une barre de progression | `assets/js/domain/progress.js` + `BAR_GROUPS` de `ui/sidebar.js` |
| recadrer un logo de forme | `tools/crop_logos.ps1`, sources dans `assets/img/sources/` |
| refaire une pastille de bouton ou un logo d'onglet | `tools/make_logos.ps1` |
| ajouter un thème | un bloc dans `theme.css` + une ligne dans `ui/themes-list.js` |
| toucher au Pokédex Pokémon GO | `ui/go-dex.js` + `applyGoFilters` et `goProgressOf` |
| mettre à jour ce que GO propose | `data/reference/go.json` (blocs `absents` et `shiny`) |
| ajouter un contenu téléchargeable | `data/reference/dlc.json` (les DEUX listes, § 3 bis) |
| changer ce qu'un DLC déclare apporter | `domain/availability.js` (`availabilityRows`) + `domain/dlc.js` |
| changer ce que « Manquant par jeu » compte | `domain/reste.js` (`obtenableDans`, `casesManquantes`) |
| retoucher le panneau « Manquant par jeu » | `ui/reste.js` + bloc « Manquant par jeu » de `components.css` |
| changer ce qui compte comme « possédé » | `domain/collection.js` (`isOwned`) + `domain/display.js` |
| retoucher la feuille mobile | `ui/detail-panel.js` (`createSheet`) + bloc « Feuille mobile » de `components.css` |
| changer la source des images | `assets/js/config.js` (`spriteBase`) |
| remonter la version des sprites | `assets/js/config.js` (`SPRITES_REF`) |
| ajouter du texte à la recherche | `assets/js/core/data.js` (`searchIndex`) |
| ajouter un raccourci clavier | `assets/js/ui/shortcuts.js` |
| couper le cache hors ligne partout | `assets/js/config.js` (`offline: false`) |
| changer le dépôt de synchronisation | `assets/js/config.js` (bloc `github`) |
| corriger une case cochée à tort | dans le site : la synchronisation s'en occupe (§ 6) |
| dire qu'une espèce n'est pas rencontrable dans un jeu | `data/details/gen-N.json`, champ `nowild` (§ 5) |
| changer la taille des boîtes du Living Dex | bloc « Plusieurs boîtes de front » de `components.css` |
| toucher à la fusion des trois couches de collection | `domain/collection.js` (`constructor`, `fusionnerAvec`, `adopterDistant`) — lire § 6 d'abord |
| vérifier que les données se tiennent | `python tools/check_data.py` |

**Règles de tenue du code**

- Aucune couleur en dur hors de `theme.css` : passer par les variables CSS.
- `domain/` ne touche jamais au DOM ; `ui/` ne contient jamais de règle de jeu.
- Pas de dépendance externe : ni npm, ni CDN de bibliothèque. Seules les images
  et les polices viennent de l'extérieur.
- Commentaires et textes d'interface en français.
- **Une case cochée ne reconstruit jamais son propre bouton.** Voir ci-dessous.
- **Une case porte une identité, jamais une position.** C'est ce qui a tué
  `vo` / `vs` (§ 2) : un nom de case ne doit jamais dépendre du rang d'une
  forme dans une liste qu'un script régénère.
- Les sprites viennent d'un **SHA épinglé** de `PokeAPI/sprites`, pas de
  `master` : une réorganisation en amont ne doit pas pouvoir casser toutes les
  images d'un coup, sans prévenir et sans qu'on ait rien changé ici.

### Cocher une case : délégation et repeinte

C'est la seule subtilité du rendu, et elle vient d'un vrai bug : la fiche était
entièrement reconstruite à chaque clic. Le bouton qu'on venait de toucher
disparaissait donc sous le doigt, le focus retombait sur `<body>`, et
l'évènement suivant pouvait atterrir sur un bouton fraîchement recréé au même
endroit — la case précédente se recochait toute seule.

Deux règles en découlent :

1. **Écoute déléguée.** Un seul écouteur `click` sur `#detail`, un seul sur
   `#grid`, posés une fois pour toutes. Aucun bouton ne porte de `onclick` ; ils
   portent `data-slot` et `data-species`, et le conteneur fait le reste.
2. **Repeinte, pas reconstruction.** Cocher une case appelle
   `detail.syncMarks()` et `grid.refresh()`, qui se contentent de retourner les
   `aria-pressed` et de remplacer le sprite quand il passe au chromatique.
   `detail.render()` — la reconstruction complète — n'a lieu qu'au changement de
   Pokémon. Corollaire : un libellé de bouton ne doit jamais dépendre de l'état
   coché (d'où le `✓` transparent de `.form__btn-check`), sinon il ne se mettra
   pas à jour.

### Les formes se lisent en grille

`formTile()` remplace l'ancienne carte pleine largeur. Trois formes
remplissaient un écran ; Météno en a treize, Motisma cinq — on ne voyait
jamais ce qu'il restait à cocher sans défiler longuement. Les formes se lisent
donc comme les variantes cosmétiques : une tuile chacune, deux colonnes sur
téléphone, trois sur grand écran.

Rien n'est perdu. Le détail écrit à la main — où l'obtenir, les jeux, le
verrou chromatique, la note — descend dans un repli `.ftile__more` par tuile.
Sa clé `data-key` le fait survivre à une repeinte, comme les autres replis.

**Les cases restent hors du repli** : cocher est ce qu'on vient faire ici, ça
ne se cache pas derrière un clic. Les deux sprites, normal et chromatique, sont
côte à côte : on compare sans basculer.

Le filtre « Forme » (`FORM_FILTERS` dans `domain/filters.js`) liste les
familles qu'on cherche vraiment — Alola, Galar, Hisui, Paldéa, Gigamax,
cosmétiques. Volontairement pas toutes les catégories de `KIND_TITLES` : les
Méga, les formes de combat et les casquettes ne se cochent pas, en faire un
filtre donnerait une liste qu'on ne peut pas terminer.

**Ce qui se coche passe devant.** `KIND_ORDER` ne contient plus que les
familles collectionnables — régions, `other`, Gigamax — et `KIND_ORDER_LORE`
reçoit le reste : Méga, Primo, formes de combat, casquettes. Ces dernières
sont rendues sous un trait, en retrait, avec une phrase qui dit pourquoi. On
ne les cache pas — c'est de l'information utile — mais elles ne rivalisent
plus avec ce qui se collectionne.

`other` passe **avant** `gmax`, et ce n'est pas arbitraire : chez Salarsen, la
Forme Grave est une forme à part entière qu'on obtient en jeu, alors que ses
deux Gigamax dépendent d'un facteur séparé. La forme d'abord, ses Gigamax
ensuite.

### Les logos : masque pour le chromatique, image pour les régions

Le logo chromatique (`shiny.png`) est posé en **masque CSS**, pas en `<img>` :
le fichier est turquoise, or le site code le chromatique en or. Un masque ne
garde que la forme et prend la couleur qu'on lui donne — donc `--accent`, qui
suit déjà les deux thèmes. Une image aurait figé la couleur.

Les logos de région sont multicolores : eux restent des `<img>`, en pastille
dans le coin de l'illustration de chaque tuile et devant le titre de groupe.

`tools/crop_logos.ps1` fabrique ces fichiers depuis `assets/img/sources/`. Le
détourage ne peut pas être un simple « blanc → transparent » : **la flamme de
Paldéa et la Poké Ball de Galar sont blanches**, elles seraient perforées. Le
script remplit donc depuis les bords — seul le blanc relié au bord devient
transparent, le blanc enfermé dans le dessin reste opaque.

### Les barres de progression, en deux groupes

`domain/progress.js` renvoie désormais un découpage par famille de formes
(`kinds`) en plus des compteurs généraux, parce que les barres ne répondent
pas à la même question :

- **Formes** — Alola, Galar, Hisui, Paldéa, Autres, Cosmétiques, Gigamax.
  C'est un découpage du travail qui reste : on voit d'un coup qu'il manque les
  Galar.
- **Ma collection** — Progression Pokédex, Paires ♂ / ♀, Chromatiques. Trois
  angles sur la même collection. « Progression Pokédex » est la seule barre à
  compter des espèces et non des cases : elle vient de `collection.counts()`,
  pas de `progress`.

L'ancienne carte Gigamax séparée a disparu : elle répétait une barre déjà
présente et allongeait une colonne déjà chargée. Ses deux chiffres propres
(paires normal + chromatique, chromatiques obtenus) restent calculés dans
`progress.kinds.gmax`.

### Les deux vues d'ensemble

Sous la progression, un panneau **Vues d'ensemble** ouvre deux pop-up qui ne
gèrent rien et se regardent : le **Mur des chromatiques** (`ui/mur.js`) et
**Manquant par jeu** (`ui/reste.js`).

Ils étaient rangés dans le repli « Sauvegarde et synchronisation ». Le
commentaire qui les y accompagnait disait déjà pourquoi c'était une erreur — « on
ne va pas chercher un plaisir dans un menu de sauvegarde » — mais il les
laissait dans le même repli, donc repliés, donc jamais ouverts. Exporter et
Réinitialiser sont des gestes de gestion qu'on fait deux fois par an ; ces
deux-là répondent à la question qu'on se pose en ouvrant le site. Ils se lisent
donc à la suite de la progression : le pourcentage dit **combien** il reste, le
mur ce qui est **déjà fait**, « Manquant par jeu » **où** aller le chercher.

**« Manquant par jeu » compte des CASES, pas des espèces.** C'est son
changement de fond. Il comptait une case par espèce — « il te manque sa case de
base » — et un Pokémon dont il ne manque que le chromatique, c'est-à-dire le
vrai travail, ne comptait pour rien. Il dit maintenant, pour chaque espèce,
**exactement** ce qui manque : normal ♂ / ♀, chromatique ♂ / ♀, chaque forme,
chaque variante cosmétique, chaque Gigamax.

Une case manquante est rattachée à un jeu quand **ce jeu peut la donner** :

- case de l'espèce — `espece.games`, et `canShinyIn()` pour un chromatique ;
- case de forme — **`forme.games`**, que `core/data.js` pose sur chaque forme
  (`sinceOnwards()` part du jeu qui l'a introduite), et `forme.shinyLocked`
  pour son chromatique. C'est ce qui empêche de promettre un Miaouss d'Alola
  dans Rouge/Bleu ;
- case cosmétique — **`variant.games`**, qui suit l'espèce tant que
  `cosmetic-forms.json` ne dit pas le contraire (voir juste dessous).

Ce que le jeu **ne peut pas** donner n'est pas jeté : il est compté à part, en
« + n ailleurs ». Le taire aurait laissé croire qu'un Pokémon à deux cases ici
est à deux cases d'être complet.

**Chaque espèce dit aussi comment on l'obtient là** — `methodeDobtention()` :
`sauvage`, `evenement`, `cadeau`, `fixe`, `evolution`, `reproduction`,
`echange`, dans cet ordre de priorité, du moins cher au plus cher. La fonction
rend une **clé**, jamais un libellé : la règle est du métier, le mot est de
l'affichage et se traduit. Le sprite de l'espèce a disparu de la ligne — le nom
la désigne déjà, et l'image entrait en concurrence avec les seules qui comptent,
celles des formes qui manquent.

#### Les noms viennent des jeux, jamais d'une traduction

**`tools/.cache/pokemon_form_names.csv` fait foi** — langue 5 pour le français,
9 pour l'anglais. C'est déjà la table dont `build_forms.py` tire le français des
304 formes ; les cosmétiques doivent la lire aussi. Un nom vaut
`<espèce> <form_name>`.

Traduire l'anglais donne des noms faux, et rien ne le signale. **81 noms**
avaient été inventés ainsi :

| Anglais | Traduction inventée | Nom du jeu |
|---|---|---|
| Savanna | Motif Savane | **Motif Mangrove** |
| Ocean | Motif Océan | **Motif Soleil Levant** |
| Sun | Motif Soleil | **Motif Zénith** |
| Polar | Motif Pôle | **Motif Banquise** |
| Icy Snow | Motif Banquise | **Motif Blizzard** |
| Vanilla Cream | Crème Vanille | **Lait Vanille** |
| Strawberry Sweet | Douceur Fraise | **Fraise en Sucre** |
| Artisan Form | Forme Artisanale | **Forme Onéreuse** |

Le piège du renommage : « Banquise » désignait *Icy Snow* et doit désigner
*Polar*. Un chercher-remplacer séquentiel écrase les deux — il faut remplacer le
`name` et le `short` **ensemble**, en s'appuyant sur la clé.

**Les `key` ne changent jamais.** Ce sont les suffixes de sprite PokeAPI, et
elles nomment les cases `x<id>-` / `y<id>-` de la collection : les renommer
orphelinerait tout ce qui est coché.

#### `gm` / `nogm` sur une forme cosmétique

Le format de `cosmetic-forms.json` annonçait ces deux champs depuis toujours ;
`core/data.js` ne les lisait pas. Une variante cosmétique suivait donc l'espèce
**sans exception possible**.

Les Pikachu à casquette en payaient le prix. Ils ne sont pas des formes — les
quatorze entrées `cap` de PokeAPI sont `hidden: 1` dans `details/forms.json`,
regroupées en variantes cosmétiques — et ils héritaient donc des jeux de
Pikachu, c'est-à-dire de presque tous. « Manquant par jeu » les proposait dans
Écarlate/Violet, où aucune distribution n'a jamais eu lieu.

La précédence est **variante > groupe > espèce**, la même que `spriteSet` :
les huit casquettes n'ont pas été distribuées dans les mêmes jeux (Casquette
Monde dans Épée/Bouclier, Partenaire dans Ultra-Soleil/Ultra-Lune, les six de
2017 dans Soleil/Lune et Ultra-Soleil/Ultra-Lune) mais partagent un défaut.
`nogm` seul **retranche** du défaut au lieu de repartir de rien.

Sous chaque jeu, une espèce tombe dans **exactement un groupe** : la cartouche,
ou le DLC sans lequel on ne l'a pas — `dlcRequis()`, la même fonction que la
fiche. Drakkarmin, seule espèce relevant de deux DLC du même jeu, apparaît sous
les deux ; le total du jeu repart donc des espèces distinctes, sans quoi il le
compterait deux fois.

### La feuille mobile

C'est là qu'on utilise le site le plus souvent, et elle avait un défaut de
fond : **fermée, la fiche restait dans le flux**. Elle repassait en bloc normal
sous la grille, si bien qu'en défilant jusqu'au bout du Pokédex on retrouvait
une fiche entière, ouverte sur le dernier Pokémon consulté. Sur téléphone,
`.detail` est donc en `display: none` tant que `body.sheet-open` n'est pas là.

Trois gestes la referment, en plus de la croix et du fond : **Échap**, le
**bouton Retour du navigateur** — le réflexe sur téléphone, et sans l'entrée
d'historique il quittait le site — et un **glissement vers le bas**. Ce
dernier n'est pris en compte que si la fiche est déjà tout en haut, sinon on
l'empêcherait de défiler.

À la fermeture, on remet l'utilisateur là où il avait laissé la grille et on
rend le focus à la vignette d'origine : bloquer le défilement de la page peut
sinon la faire remonter.

### Ce qui est gardé d'une visite à l'autre

`CONFIG.storage` : les cases cochées, les quêtes, le thème, le jeton, **et
depuis peu les filtres**. Travailler « À terminer » filtré sur Gigamax et
recharger repartait sinon de zéro. La recherche, elle, n'est pas gardée —
c'est une intention du moment, la retrouver au retour ferait croire à une
liste vide.

Les clés ont été renommées de `neodex.*` à `funkylldex.*` en même temps que le
site. `migrateStorage()` dans `main.js` recopie les anciennes au premier
chargement : sans cela le renommage aurait jeté d'un coup les cases pas encore
synchronisées, l'avancement des quêtes et le jeton GitHub.

**`CONFIG.github.repo` reste `neodex`** : c'est le nom réel du dépôt, le
changer casserait la synchronisation.

### Chercher, et se déplacer de fiche en fiche

Deux règles, chacune née d'un vrai défaut d'usage.

**Un numéro se compare à un numéro, jamais comme du texte.** Les vignettes
affichent `#0025` : c'est ce qu'on recopie depuis une capture. L'ancienne
recherche par sous-chaîne répondait alors « Pêchaminus », parce que `"1025"`
contient `"025"` — un résultat unique, faux, et sans le moindre signe que
quelque chose clochait. `numberQuery()` normalise (`#`, zéros de tête), puis on
compare au numéro exact ou à un début de numéro. Le numéro exact remonte en
première place quel que soit le tri.

**Tout le reste cherche dans `species.search`**, construit une fois pour toutes
par `core/data.js` : nom FR et EN, catégorie, noms de formes, clés PokeAPI,
titres et variantes cosmétiques. C'est ce qui permet de taper « alola »,
« gigamax » ou « mangrove ». Ajouter une source de texte à la recherche se fait
là, dans `searchIndex()`, et nulle part ailleurs.

**« Suivant » suit la liste filtrée, pas le Pokédex.** Les flèches `‹ ›` de la
fiche et les touches `←` / `→` se déplacent dans ce qui est affiché. Filtrer
sur « À terminer » puis avancer de fiche en fiche, c'est le geste qu'on répète
en remontant une boîte de HOME. `main.js` garde la liste dans `visible` et
l'expose par `ctx.neighbours()` et `ctx.onStep()` ; un changement de filtre
appelle `detail.refreshSteps()`, qui remplace les deux flèches et rien d'autre.

Les raccourcis vivent dans `ui/shortcuts.js`, avec une règle non négociable :
**on ne détourne jamais une touche pendant que l'utilisateur écrit.** Un champ
actif rend toutes les touches à la page, Échap excepté.

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
python tools/read_screenshots.py   # tools/.cache/collection-lue.json (~10 min)
```

Les trois premiers sont ceux qui font tourner le site ; ils acceptent tous
`--cache` pour réutiliser les CSV déjà téléchargés. `build_forms.py` accepte en
plus `--offline`, qui se contente du cache de sprites local sans interroger le
réseau. Les deux derniers ne servent qu'à relire les captures d'écran.

### `check_data.py` — le filet des couches écrites à la main

```bash
python tools/check_data.py
```

Les fichiers de `data/details/` et `data/reference/` renvoient à des
identifiants qui vivent dans les fichiers générés. Rien ne garantit que ces
renvois restent valides : une forme disparaît d'une régénération, un code de
jeu est mal tapé, une case cochée désigne une forme qui n'existe plus. Le site
ignore silencieusement ce qu'il ne comprend pas — c'est le bon comportement à
l'affichage, mais ça laisse pourrir les données sans prévenir.

Le script fait le tour de ces renvois : espèces et formes inconnues, codes de
jeu inventés, clés JSON en double, cases héritées non migrées. Il n'écrit
rien et sort en code 1 s'il trouve quelque chose. À lancer après toute retouche
manuelle d'un fichier de `data/`.

Ce qu'il ne fait **pas** : rejouer la fusion des couches. Le total de cases, le
« tout obtenu » et les formes principales en dépendent — les redupliquer en
Python les ferait diverger de `core/data.js` à la première évolution. Ces
chiffres-là se lisent dans la barre latérale du site.

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

**Il n'écrit plus `data/collection.json`.** Il a servi une fois, pour monter la
collection depuis 61 captures ; le site fait désormais la même lecture avec
« Lire des captures » (`ui/import-photos.js` + `domain/reco.js`), sans rien
écraser et en connaissant le Pokédex GO.

Le laisser pointer sur le fichier de collection était une mine : il écrivait
**sans jamais lire l'existant**, et son vocabulaire se limite à `om` et `sm`.
Une exécution distraite aurait effacé, sur le fichier d'aujourd'hui, 135 cases
de forme, 60 femelles, 23 chromatiques femelles, 183 cases GO, 40 chromatiques
GO, 18 formes GO, 94 variantes cosmétiques et le carnet de quêtes — sans
confirmation ni sauvegarde. Et le garde-fou naturel ne jouait pas : `photo/` ne
contient plus que quelques captures, donc `if not photos` ne se déclenchait pas,
et le résultat aurait été une collection presque vide plutôt qu'une erreur.

Il écrit donc dans `tools/.cache/collection-lue.json`, et le dit à l'écran.
L'import se fait par le site, où il passe par la même fusion que le reste.

### La régénération ne ressuscite plus les starters de Paldéa

PokeAPI n'a pas de table de rencontres pour BDSP, Légendes Arceus,
Écarlate/Violet ni Légendes Z-A : `build_availability.py` y déclare donc sauvage
**toute espèce non légendaire présente dans le jeu** (`NO_ENCOUNTER_DATA`). Juste
pour la quasi-totalité de ces Pokédex, faux pour les Pokémon de départ, qu'on
reçoit puis fait évoluer.

Le coût n'était pas cosmétique : `domain/hunt.js` lit `wild` pour choisir une
méthode, et les trois lignées de Paldéa se voyaient proposer « apparition
massive + sandwich », une chasse qui n'existe pas. Le commit `a40f158` avait
corrigé ça **à la main dans le fichier généré**, que la régénération écrase — le
bug serait revenu sans un mot.

Le retrait est maintenant écrit **deux fois**, et c'est voulu :

- `nowild: "sv"` sur les entrées 906-914 de `data/details/gen-9.json` — la
  couche que le site fusionne, et que rien ne régénère. C'est le **premier
  emploi** de ce champ, documenté depuis toujours et jamais utilisé ;
- la table `NO_WILD` de `build_availability.py`, appliquée au même goulet que
  `manual` — le seul endroit que **toutes** les sources de `wild` traversent.

On n'y liste que ce qui est établi. Les autres starters des jeux sans table de
rencontres gardent leur `wild` tel que le script le déduit : personne ne l'a
vérifié, et inventer ici serait exactement l'erreur qu'on répare.

---

## 6. Sauvegarde de la collection

`data/collection.json` est la **référence**, versionnée dans git. Les cases
cochées vont d'abord dans le **localStorage**, par-dessus. Deux façons de faire
redescendre le localStorage dans le dépôt.

### Trois couches, pas deux : l'ancêtre

| Clé | Contenu |
|---|---|
| `data/collection.json` | la référence, dans le dépôt |
| `funkylldex.marks.v1` | les cases cochées depuis ce navigateur |
| `funkylldex.base.v1` | **l'ancêtre** : ce que le dépôt contenait quand `marks` a été écrite |

La couche locale écrase la référence **espèce par espèce** — l'entrée entière,
pas case par case. C'est ce qui rend l'ancêtre indispensable : sans lui, on ne
peut pas distinguer *« cette case, je l'ai décochée ici »* de *« cette case, je
ne l'avais simplement pas encore »*.

**Le défaut que ça corrige, mesuré.** L'ancêtre était pris du fichier
fraîchement chargé, ce qui paraît naturel et ne l'est pas : `marks` survit dans
le localStorage pendant que la référence est relue du réseau à chaque ouverture.
L'ancêtre avançait donc **sous** la couche locale. Une vieille entrée `{om:1}`
masquait le `{om:1, sm:1}` que le dépôt avait reçu du téléphone — la case
chromatique disparaissait de l'écran, et `toExport()` la réécrivait telle
quelle : **la synchronisation suivante effaçait du dépôt ce qui avait été coché
ailleurs.** Un écart de dix-sept espèces s'est constaté ainsi entre un téléphone
et un ordinateur.

La réconciliation a donc lieu **à chaque chargement**, dans le constructeur, par
`adopterDistant()` — la fusion à trois voies qui existait déjà, mais que seul
« Recharger » déclenchait, et à laquelle il fallait penser.

**Le premier chargement n'a pas d'ancêtre**, aucun navigateur n'en ayant écrit
avant. On repart d'un ancêtre vide, et ce n'est pas un pis-aller : avec `a = 0`
partout, la règle `n === l ? n : a === l ? n : l` dégénère exactement en
**union**. Les deux erreurs possibles ne se valent pas — garder une case décochée
ici se voit et se défait d'un clic, perdre une case cochée ailleurs ne se voit
pas. Dès la première écriture l'ancêtre existe, et la fusion redevient exacte.

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
   Un plafond, `maxDelayMs` (30 s), borne ce report : sans lui, cocher une case
   toutes les trois secondes repousserait le minuteur indéfiniment et rien ne
   partirait jamais.
4. Quitter l'onglet (`visibilitychange`) déclenche l'écriture immédiatement :
   sur téléphone, c'est le cas courant. Cette requête-là part en `keepalive`,
   sinon elle meurt avec la page qu'on vient de quitter — c'est-à-dire
   précisément dans le cas qu'elle est censée couvrir. Le corps est alors
   plafonné à 64 Ko par la norme : au-delà, `sync.js` renonce au `keepalive`,
   prévient en console, et l'envoi redevient ordinaire.
5. **Recharger** reprend ce que contient le dépôt — utile quand on a coché
   depuis un autre appareil. Le fichier ramené repasse par la conversion des
   cases héritées (§ 2), au cas où il daterait d'avant.

Valider une quête coche une case comme n'importe quel clic, et déclenche donc
la même écriture. `onCollectionChange()` ne fait que repeindre : c'est
`onToggle` — et l'appel explicite de `ui/quest.js` — qui programment l'envoi.

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

---

## 7. Le cache hors ligne

`sw.js`, à la racine — un service worker doit y être pour couvrir tout le site.
Le site sert à cocher des cases **pendant qu'on joue** : dans le train, en
salle d'attente, exactement là où le réseau manque.

Trois régimes, et le choix de chacun tient à une seule question : *servir une
version périmée, est-ce grave ?*

| Ressource | Régime | Pourquoi |
|---|---|---|
| `index.html`, CSS, JS | **réseau d'abord** | Le site se met à jour par un simple `git push`, sans build. Un worker qui servirait du code périmé figerait le site dans une version ancienne. C'est le piège classique. |
| `data/collection.json` | **réseau d'abord** | C'est la collection. Servir la version d'hier ferait *disparaître* des cases cochées sous les yeux. Le cache n'est qu'un dernier recours hors ligne. |
| Reste de `data/` | cache d'abord | Ne bouge qu'à une régénération. Rafraîchi en arrière-plan. |
| Sprites, polices | cache d'abord | Les sprites sont épinglés sur un SHA (§ 4) : leur URL ne désignera **jamais** une autre image. Rien en cache ne peut devenir faux. |

`api.github.com` n'est **jamais** intercepté : une écriture doit partir sur le
réseau ou échouer franchement.

### L'interrupteur de secours

Sans étape de build, on ne peut pas demander à chaque appareil d'ouvrir les
outils de développement. D'où `CONFIG.offline` : le passer à **`false`** ne se
contente pas de ne plus enregistrer le worker — il **désinscrit** celui qui est
en place et vide ses caches, au prochain chargement.

C'est la manette d'arrêt à distance : si un jour un worker se comporte mal, on
pousse `offline: false`, les appareils se nettoient seuls, et on repasse à
`true` une fois le problème corrigé. Changer `VERSION` dans `sw.js` purge aussi
les anciens caches.
