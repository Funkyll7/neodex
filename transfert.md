# Transfert de session — Funkylldex

Écrit le 3 septembre 2026 pour reprendre le travail sur une autre machine.
Ce fichier voyage par git : `git pull` sur le PC fixe et il est là.
**Supprime-le quand tu n'en as plus besoin** — il n'a rien à faire dans le dépôt
à long terme, et GitHub Pages le sert comme le reste.

---

## 1. Où en est le projet

| | |
|---|---|
| Version | **5.4** — « Chaque DLC sur sa ligne » |
| Service worker | **v98** |
| Dernier commit | `277a8e6` |
| Dépôt | `https://github.com/Funkyll7/neodex.git`, branche `main` |
| Modules JS | 64 |
| Notes de version | 96, sur 20 versions |

L'arbre est propre et poussé. `data/collection.json` est identique au dépôt.

**Sur le PC fixe** : `git pull`, puis sers le dossier
(`python -m http.server 4173`) — jamais en `file://`, les modules ES et les
`fetch` de `data/` ne s'y chargent pas.

---

## 2. Ce que cette session a livré

### 5.2 — Ce qui manquait, ce qui clochait

- **« Chasser celui-ci »** dans la fiche. L'onglet Quêtes contenait 1465 lignes
  déjà écrites et n'avait **jamais servi** — `"quetes": { "parties": {} }`. Ce
  n'était pas un manque de fonctionnalité mais de **routage** : les seuls
  chemins vers `store.quest` étaient deux tirages au sort.
- **Ouvrir une fiche depuis une case de boîte** — appui long (450 ms), clic
  droit, Ctrl+clic. Le clic simple continue de cocher.
- **Un nom d'appareil** dans le journal (« Reçu de : … »). Il voyage dans le
  champ `source` qui existait déjà : **aucun changement de format**, donc aucun
  risque de fusion.
- **Deux onglets du même navigateur** se préviennent (`core/jumeaux.js`).
- **Le clic mort entre 861 et 1180 px** : la fiche s'ouvrait sous la grille et
  rien n'y emmenait. Un commentaire promettait ce défilement depuis toujours.
- **`htmlFor` au lieu de `for`** dans les réglages : deux étiquettes reliées à
  rien depuis le début.

### 5.3 — Les DLC comptent enfin

`build_availability.py` déduit la disponibilité des **Pokédex régionaux**, or
les légendaires du Repaire Dynamax n'y figurent pas.

| Jeu | Ajout |
|---|---|
| Épée/Bouclier | +52 (Repaire, starters d'Alola, Keldeo) |
| Écarlate/Violet | +25 (friandises de Jeffry Andise) |
| Légendes Z-A | +8 (Pokédex Hyperespace) |
| Légendes Arceus | +2 (Phione, Manaphy) |

Plus les quatre logos de DLC détourés, la case « Masquer les formes Gigamax »,
les bandes de génération dans les boîtes et les familles, le renommage en
« Ce qu'il reste par jeu », et la reproduction par DV écartée du meilleur taux.

### 5.4 — Chaque DLC sur sa ligne

Les quatre DLC ont leur **propre ligne** sous leur jeu, visible sur **toutes**
les fiches, chacune disant si elle apporte l'espèce. Quand une espèce n'est
obtenable que par un DLC, la ligne du jeu de base dit « indisponible » — elle
annonçait « disponible » à tort.

Huit légendaires manquaient à la Toundra : **Mewtwo, Lugia, Ho-Oh, Rayquaza,
Dialga, Reshiram, Zekrom, Necrozma**.

---

## 3. Les conventions du projet — à ne pas enfreindre

- **100 % statique.** Aucun build, aucun npm, aucune dépendance, aucun nouveau
  CDN. Modules ES natifs, CSS, JSON servis tels quels.
- **`domain/` ne touche jamais au DOM. `ui/` ne contient aucune règle de jeu.**
- **Français** pour l'interface *et* les commentaires. Les commentaires
  expliquent le **pourquoi**, longuement.
- Toute chaîne affichée passe par `t()` et doit exister dans
  `data/i18n/en.json`.
- **Ne jamais modifier `data/collection.json` à la main.**
- **Ne jamais redéfinir `--pair` ni `--female`** (couleurs ♂/♀).
- Tout nouveau module doit entrer dans les `<link rel="modulepreload">`
  d'`index.html` — `sw.js` y lit sa liste de pré-cache.
- Incrémenter `VERSION` dans `sw.js` à chaque livraison.

---

## 4. Les pièges — appris à mes dépens

### `data/details/*.json` prime sur `data/availability/`

Un champ `gm` écrit à la main dans `details` **s'ajoute** à celui d'
`availability`. J'ai conclu à tort que Rayquaza et Mewtwo n'avaient pas `swsh`
en lisant `availability` seul. **Toujours vérifier le dataset fusionné.**

C'est aussi ce qui a masqué les huit légendaires manquants : ils portaient déjà
`swsh` par `details`, donc ils n'étaient jamais « manquants ».

### Trois caches mentent

1. Le **serveur d'aperçu** peut servir un instantané figé → `preview_stop` puis
   `preview_start`.
2. Le **cache HTTP** garde les modules ES → `fetch(url, { cache: 'reload' })`
   sur chaque fichier *avant* de recharger.
3. Le **service worker** est un troisième cache que `cache: 'reload'` ne
   traverse pas → le désinscrire et vider `caches.keys()`.

### Le clone git est structurellement en retard

Le téléphone écrit `data/collection.json` en continu. **Toujours
`git fetch origin main` avant de raisonner sur l'historique.**

### Chargement paresseux

Les images du tableau sont en `loading="lazy"` : `naturalWidth` vaut 0 tant
qu'on n'a pas fait `scrollIntoView`. J'ai cru à un fichier corrompu, puis à un
cache, avant de comprendre.

### Détails de manipulation

- `sed -i` de Git Bash **convertit CRLF en LF** silencieusement. Les fichiers de
  `data/availability/` sont en CRLF.
- `ConvertFrom-Json` de PowerShell est **insensible à la casse** et déclare à
  tort `en.json` invalide (clés « Espèces » / « espèces »).
- **Python n'est pas installé** (seul le stub du Microsoft Store répond).
  `build_availability.py` ne peut pas être relancé : toute correction doit être
  faite **à la fois** dans le script et à la main dans les JSON.
- Une vignette de la grille s'ouvre par `.card__select`, pas par `.card`.

---

## 5. Décisions ouvertes — elles t'appartiennent

### La sauvegarde tierce compte-t-elle comme obtenable ?

Sept cas ne sont écrits **nulle part**, faute d'arbitrage :

- **Mew, Jirachi, Arceus** dans Diamant Étincelant — cadeaux conditionnés par
  une sauvegarde Let's Go / Épée-Bouclier / Légendes Arceus sur la console.
- **Darkrai, Shaymin** dans Légendes Arceus — même mécanique.
- **Regigigas**, **Poipole/Naganadel**, **Meloetta** pour Écarlate/Violet,
  **Shifours** — sources contradictoires ou uniques.

La convention actuelle les exclut, **mais Darkrai a déjà `za`** : elle n'est
donc pas appliquée uniformément.

### Les formes dans les disponibilités

`data/availability` ne connaît que des **espèces**, jamais des formes. Le
**Raichu d'Alola** est bien attrapable au Repaire Dynamax (avec Sablaireau,
Triopikeur, Persian et Ossatueur d'Alola), mais aucun ajout de numéro d'espèce
ne le fera apparaître — les cinq espèces ont déjà `swsh`. C'est une **évolution
de modèle**, pas une correction.

### Le worktree `v6-test`

Il occupe toujours le disque avec le prototype 6.0 écarté :

```bash
git worktree remove v6-test --force && git branch -D v6-test
```

**Attention** : il est local à cette machine. Sur le PC fixe il n'existera pas —
`git worktree list` te le confirmera.

### Une dette de génération

Le commit `a40f158` a corrigé les starters de Paldéa **à la main dans les
données**, sans toucher au générateur. Relancer `build_availability.py`
aujourd'hui **ressusciterait ce bug**. Il faudrait une table `NO_WILD` dans le
script.

---

## 6. Idées écartées, pour ne pas les reproposer

De la recherche « 6.0 » : **L'État civil** (provenance, natures, rubans),
**La Mémoire**, **L'Itinéraire**, **La Maisonnée** (plusieurs dresseurs), et
**Le Second Écran**. Le prototype construit a été rejeté.

Également mesuré et refusé : héberger les sprites en local (11× plus léger, mais
pas d'encodeur WebP sur la machine).

Une piste réelle et non exploitée : `tools/.cache/encounters.csv` (3,1 Mo) porte
des lignes `sword-shield` pour toutes les espèces du Repaire. C'est le seul
recensement machine du Repaire présent sur le disque.

---

## 7. Pour reprendre

```bash
git pull origin main
git log --oneline -5
python -m http.server 4173     # puis http://localhost:4173
```

Et sur le téléphone, après chaque livraison : **fermer complètement
l'application et la rouvrir**, sinon le service worker garde l'ancienne version.
