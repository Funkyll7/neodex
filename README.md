# NéoDex

Pokédex personnel : les 1025 espèces, leurs 304 formes alternatives (Alola,
Galar, Hisui, Paldéa, Méga-Évolutions, Gigamax…) et leurs 160 formes
cosmétiques (les 28 Zarbi, les 20 Prismillon, les 63 Charmilly, les couleurs de
Flabébé, les tailles de Couafarel, les saisons de Vivaldaim…), ma collection
(normal / chromatique, formes ♂ et ♀), la disponibilité jeu par jeu, le
verrouillage chromatique et la méthode de shiny hunt détaillée pour chaque jeu.

**2 802 cases** en tout. Chaque vignette affiche les siennes — `3/8` — sans
qu'on ait à l'ouvrir. Un Pokémon dont tout l'obtenable est coché passe en doré,
badge « ★ Complet ». La barre latérale suit quatre progressions distinctes :
tout, paires ♂ / ♀, formes, Gigamax.

**Toutes les formes se cochent dans une grille** — les régionales, les
Gigamax, les Méga comme les lettres des Zarbi, les motifs de Prismillon ou les
crèmes de Charmilly. Une tuile chacune, les sprites normal et chromatique côte
à côte, et le détail (où l'obtenir, les jeux, le verrou chromatique) dans un
repli. Sur téléphone, choisir une vignette ouvre la fiche en feuille plein
écran.

**Ce qui se coche est en haut.** Les formes régionales, les Gigamax et les
formes à part entière viennent d'abord ; les Méga-Évolutions, la
Primo-Résurgence et les formes de combat sont reléguées sous un trait — elles
n'ont pas d'entrée dans HOME, il n'y a rien à y cocher.

Le filtre **Forme** isole les formes d'Alola, de Galar, de Hisui, de Paldéa,
les Gigamax et les cosmétiques. La barre latérale suit la même logique : un
groupe **Formes**, région par région, et un groupe **Ma collection** — tout,
paires ♂ / ♀, chromatiques.

La recherche accepte le numéro tel qu'il est affiché (`0025`), le nom en
français ou en anglais, et **le nom d'une forme** : `alola`, `gigamax`,
`savane`, `noyeau`. Les flèches `‹ ›` de la fiche — ou les touches `←` / `→` —
passent au Pokémon suivant **de la liste filtrée** : filtrer sur « À terminer »
puis avancer de fiche en fiche remonte une boîte de HOME sans jamais revenir à
la grille. `/` va à la recherche.

Le site fonctionne **hors ligne** une fois chargé : c'est fait pour cocher en
jouant, là où le réseau manque.

Site statique — pas de build, pas de dépendance, pas de serveur.

> **La carte du projet est dans [PROJET.md](PROJET.md).** À lire avant toute
> modification : elle liste chaque dossier, chaque fichier et son rôle.

---

## Lancer en local

Le site charge ses données en `fetch`, donc un double-clic sur `index.html`
ne suffit pas — il faut un serveur local. Python fait l'affaire :

```bash
python -m http.server 4173
```

Puis ouvrir <http://localhost:4173>.

---

## Cocher depuis le site, sans exporter

Le site peut écrire `data/collection.json` directement dans le dépôt. Il reste
statique : c'est le navigateur qui parle à l'API GitHub.

1. Créer un **jeton d'accès personnel à portée limitée** :
   [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
   - *Repository access* : **Only select repositories** → `neodex`
   - *Permissions* → *Repository permissions* → **Contents : Read and write**
   - une expiration courte se renouvelle sans douleur, le site le redemandera
2. Coller le jeton dans **Synchronisation**, dans la barre latérale du site.
3. C'est fini. Chaque case cochée part dans le dépôt quelques secondes plus
   tard, regroupée avec les suivantes pour ne pas faire un commit par clic.
   Quitter l'onglet force l'envoi immédiat.

Le jeton reste dans le `localStorage` de ce navigateur et n'est envoyé qu'à
`api.github.com`. Le bouton **Oublier** l'efface. À ne pas faire sur un
ordinateur partagé : donne-lui la portée la plus étroite possible, et rien
d'autre que ce dépôt.

**Recharger** récupère ce que contient le dépôt — pratique quand on a coché
depuis le téléphone et qu'on reprend sur l'ordinateur.

L'export / import reste disponible et fonctionne sans jeton.

---

## Régénérer les données

Rien de tout ceci n'est nécessaire pour simplement utiliser le site : les
fichiers générés sont versionnés.

```bash
python tools/build_dataset.py
python tools/build_forms.py
python tools/build_availability.py
```

- `build_dataset.py` régénère `data/pokemon/` (nom FR/EN, types, statistiques de
  base, dimorphisme, pré-évolutions).
- `build_forms.py` régénère `data/forms/` : les 304 formes alternatives, avec
  vérification image par image des sprites qui existent réellement — normal,
  chromatique, HOME et artwork officiel. Il ne voit **pas** les formes
  cosmétiques (Zarbi, Prismillon, Charmilly…), que PokeAPI n'expose pas comme
  des entrées distinctes : celles-là sont écrites à la main dans
  `data/details/cosmetic-forms.json`.
- `build_availability.py` régénère `data/availability/` : dans quels jeux chaque
  espèce s'obtient, et dans lesquels on la croise vraiment à l'état sauvage
  (croisement des Pokédex régionaux et de la table des rencontres de PokeAPI).

Les trois acceptent `--cache` pour réutiliser les CSV déjà téléchargés, et ne
touchent jamais aux fichiers écrits à la main.

Après toute retouche manuelle d'un fichier de `data/`, un filet :

```bash
python tools/check_data.py
```

Il vérifie que les fichiers écrits à la main renvoient à des espèces, des
formes et des jeux qui existent vraiment. Il n'écrit rien et sort en code 1
s'il trouve quelque chose.

```bash
python tools/fetch_sprites.py
python tools/read_screenshots.py
```

Relit les captures d'écran de `photo/` et en déduit `data/collection.json`.
Nécessite `pillow` et `numpy`. La reconnaissance est bonne mais pas parfaite —
voir la section correspondante de [PROJET.md](PROJET.md).

```bash
python -m pip install pillow numpy
```

---

## Mettre en ligne sur un dépôt privé

GitHub Pages fonctionne sur les dépôts privés avec un compte **Pro, Team,
Enterprise Cloud ou Education**. Le site est alors publié à une URL publique,
mais le code reste privé. Sur un compte gratuit, Pages exige un dépôt public :
dans ce cas, garder le dépôt privé et travailler en local.

1. Créer un dépôt **privé** sur GitHub, sans README ni .gitignore.
2. Depuis ce dossier :

```bash
git remote add origin https://github.com/<ton-compte>/<ton-depot>.git
git branch -M main
git push -u origin main
```

3. Sur GitHub : **Settings → Pages → Source : Deploy from a branch**,
   branche `main`, dossier `/ (root)`, puis **Save**.

Le fichier `.nojekyll` est déjà présent : sans lui, GitHub Pages ignorerait
certains dossiers.

### Ce qui ne part pas sur GitHub

- `photo/` — les captures d'écran de Pokémon HOME. GitHub Pages sert le dépôt
  tel quel : les versionner reviendrait à les publier. Elles restent en local ;
  seul leur résultat, `data/collection.json`, est versionné. Pour relancer
  `tools/read_screenshots.py`, remets tes captures dans ce dossier.
- `tools/.cache/` — plus de 300 Mo de sprites et de CSV, reconstruits par
  `fetch_sprites.py` et `build_dataset.py`.

---

## Sources

- Données et sprites : [PokeAPI](https://pokeapi.co/) (sprites servis via jsDelivr).
- Emplacements et méthodes de chasse : [Poképédia](https://www.pokepedia.fr/),
  [Bulbapedia](https://bulbapedia.bulbagarden.net/) et le
  [dossier Shasse de PokéBip](https://www.pokebip.com/page/jeux-video/dossier-shasse/).
- Recensement des formes : les pages
  [formes de Galar](https://www.pokebip.com/page/jeux-video/pokemon-epee-bouclier/formes-galar),
  [formes d'Alola](https://www.pokebip.com/page/jeux-video/pokemon-soleil-lune/nouvelles-formes),
  [formes de Paldéa](https://www.pokebip.com/page/jeux-video/pokemon-ecarlate-violet/formes-paldea)
  et [Méga-Évolutions](https://www.pokebip.com/page/general/mega-evolutions) de PokéBip,
  ainsi que [Gigamax](https://www.pokepedia.fr/Gigamax) sur Poképédia.

Pokémon est une marque de Nintendo / Creatures Inc. / GAME FREAK inc.
Projet personnel, sans but lucratif et sans affiliation.
