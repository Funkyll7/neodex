# NéoDex

Pokédex personnel : les 1025 espèces et leurs 304 formes alternatives (Alola,
Galar, Hisui, Paldéa, Méga-Évolutions, Gigamax…), ma collection (normal /
chromatique, formes ♂ et ♀), la disponibilité jeu par jeu, le verrouillage
chromatique et la méthode de shiny hunt détaillée pour chaque jeu.

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
  chromatique, HOME et artwork officiel.
- `build_availability.py` régénère `data/availability/` : dans quels jeux chaque
  espèce s'obtient, et dans lesquels on la croise vraiment à l'état sauvage
  (croisement des Pokédex régionaux et de la table des rencontres de PokeAPI).

Les trois acceptent `--cache` pour réutiliser les CSV déjà téléchargés, et ne
touchent jamais aux fichiers écrits à la main.

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
