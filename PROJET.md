# PROJET.md — carte du projet NéoDex

> **À lire avant chaque modification.** Ce fichier liste tous les dossiers et
> fichiers, dit à quoi sert chacun, et rappelle où ajouter quoi.
> **Si tu ajoutes, déplaces ou supprimes un fichier, mets ce document à jour
> dans le même changement.**

NéoDex est un Pokédex personnel : suivi de collection sur les 1025 espèces,
leurs 304 formes alternatives (Alola, Galar, Hisui, Paldéa, Méga-Évolutions,
Gigamax…) et leurs 160 formes cosmétiques (Zarbi, Prismillon, Charmilly…),
formes ♂ / ♀, chromatiques, disponibilité par jeu, verrouillage chromatique et
méthode de shiny hunt jeu par jeu. Soit 2 802 cases à cocher.

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
│   │   └── gigamax-nb.png      la même, éteinte (case non cochée)
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
│       │   ├── progress.js     compteurs globaux par case : tout / paires / formes / Gigamax
│       │   └── filters.js      filtrage, recherche et tri de la liste
│       └── ui/                 rendu, un module par zone d'écran
│           ├── theme.js        bascule clair / sombre
│           ├── sidebar.js      progression, filtres, tri
│           ├── dex-grid.js     grille de vignettes (chargement par paliers)
│           ├── detail-panel.js fiche détaillée de droite
│           ├── quest.js        onglet Quêtes et journal de chasse
│           ├── save.js         exporter / importer / réinitialiser
│           ├── shortcuts.js    raccourcis clavier (/ · ← → · Échap)
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
│   │   └── shiny-locks.json    verrou chromatique par jeu, + `noShiny` (jamais nulle part)
│   ├── details/                ✎ écrit à la main, enrichissement par Pokémon
│   │   ├── gen-1.json … gen-9.json    où le trouver, corrections de jeux
│   │   ├── forms.json          où obtenir chaque forme, par catégorie et au cas par cas
│   │   └── cosmetic-forms.json les formes que PokeAPI n'expose pas (Zarbi, Prismillon,
│   │                           Flabébé, Couafarel, Charmilly, Cheniti, Sancoki…)
│   └── collection.json         ▲ GÉNÉRÉ puis corrigé — ma collection
│
├── tools/                      scripts Python, hors site
│   ├── check_data.py           vérifie la cohérence des renvois — n'écrit rien
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
| **Collection** | `data/collection.json` | `read_screenshots.py` puis corrections | `om`, `of`, `sm`, `sf`, `f<id>`, `f<id>s`, `x<n>-<clef>`, `y<n>-<clef>` par espèce |

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
| `x<n>-<clef>` / `y<n>-<clef>` | forme cosmétique — `x201-b` = Zarbi B, `y666-savanna` = Prismillon Savane chromatique |
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
`sm`** : le Zarbi A, la Prismillon Motif Floral, la Flabébé Fleur Rouge *sont*
la forme par défaut de l'espèce. Sans cela on cocherait deux fois la même
chose, et `isOwned()` ne saurait plus quoi regarder.

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
ai-je, sur les 2 802 du site ? ». Il produit quatre barres pour la barre
latérale — Tout, Paires ♂ / ♀, Formes, Gigamax — plus le bloc Gigamax (paires
normal + chromatique, chromatiques obtenus). À ne pas confondre avec
`collection.counts()`, qui compte des **espèces** : un Miaouss capturé pèse une
espèce et huit cases.

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
| retirer les cases d'une forme (pas transférable dans HOME) | `data/details/forms.json`, champ `entry: 0` |
| supprimer une forme en double | `data/details/forms.json`, champ `hidden: 1` |
| ajouter une forme cosmétique (motif, couleur, saison…) | `data/details/cosmetic-forms.json` |
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
| changer une barre de progression | `assets/js/domain/progress.js` + `ui/sidebar.js` |
| retoucher la feuille mobile | `ui/detail-panel.js` (`createSheet`) + bloc « Feuille mobile » de `components.css` |
| changer la source des images | `assets/js/config.js` (`spriteBase`) |
| remonter la version des sprites | `assets/js/config.js` (`SPRITES_REF`) |
| ajouter du texte à la recherche | `assets/js/core/data.js` (`searchIndex`) |
| ajouter un raccourci clavier | `assets/js/ui/shortcuts.js` |
| couper le cache hors ligne partout | `assets/js/config.js` (`offline: false`) |
| changer le dépôt de synchronisation | `assets/js/config.js` (bloc `github`) |
| corriger une case cochée à tort | dans le site : la synchronisation s'en occupe (§ 6) |
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
« gigamax » ou « savane ». Ajouter une source de texte à la recherche se fait
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
python tools/read_screenshots.py   # data/collection.json  (~10 min)
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
