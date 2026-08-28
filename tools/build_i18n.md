# Refaire `data/i18n/en.json`

Ce fichier porte les noms ANGLAIS de ce qui vient des donnees : les dix-huit
types, la categorie de chaque espece, et le nom de chaque forme alternative.
Les noms d'especes n'y sont pas — ils dorment deja dans le champ `en` de
`data/pokemon/*.json`.

La source est PokeAPI, via son miroir statique `PokeAPI/api-data` servi par
jsDelivr. Pas de cle, pas de quota, et le meme depot que les sprites.

## Pourquoi les cles sont ce qu'elles sont

Les **categories** sont clees par NUMERO NATIONAL, pas par leur libelle
francais. Six categories francaises couvrent plusieurs libelles anglais : a lui
seul, « Pokemon Poisson » vaut *Fish*, *Goldfish*, *Angler* et *Water Fish*.
Une table clee par le francais aurait donc rendu la mauvaise traduction a
quatre especes sur cinq — et, mesuree, elle etait aussi plus grosse (33 Ko
contre 26).

Les **formes** sont clees par leur cle PokeAPI (`venusaur-mega`), qui figure
deja dans `data/forms/*.json`. C'est exact et ca ne coute rien.

Les **types** sont clees par leur nom francais : dix-huit valeurs, aucune
collision possible.

## La marche a suivre

Trois pieges, tous rencontres :

1. Le miroir sert du JSON **indente**, et pas toujours de la meme facon : les
   uns avec deux espaces, les autres avec quatre. Une expression reguliere sur
   une seule ligne ne marche pas ; il faut un petit automate.

2. Certains fichiers encodent les accents en **sequences d'echappement**
   (`Pok\u00e9mon Bisou`) et d'autres en UTF-8. Sans decodage, onze categories
   sur 717 ne correspondaient a rien. Le decodage doit ignorer les paires de
   substitution, qui font echouer `chr()`.

3. Les identifiants de `pokemon-form` ne sont PAS ceux de `pokemon`. Il faut
   passer par `pokemon-form/index.json`, qui donne la correspondance
   nom -> identifiant pour les 1579 formes connues.

Les commandes, en shell POSIX, avec `curl` et `awk` :

    # 1. categories, par numero national
    seq 1 1025 | xargs -P 20 -I{} sh -c '
      curl -s "$BASE/pokemon-species/{}/index.json" > /tmp/s.json
      en=$(awk "/\"genera\"/{d=1;next}
                d&&/^ *\],?$/{d=0}
                d&&/\"genus\":/{g=\$0;sub(/.*\"genus\": \"/,\"\",g);sub(/\",?$/,\"\",g);a=1;next}
                d&&a&&/\"name\":/{l=\$0;sub(/.*\"name\": \"/,\"\",l);sub(/\",?$/,\"\",l);if(l==\"en\")e=g;a=0}
                END{print e}" /tmp/s.json)
      printf "%s\t%s\n" "{}" "$en"'

    # 2. formes, par cle
    curl -s "$BASE/pokemon-form/index.json"   # nom -> identifiant

    # 3. decodage des echappements, dans les deux cas
    perl -CSD -pe 's/\x5cu([0-9a-fA-F]{4})/my $c=hex($1);
                   ($c>=0xD800 && $c<=0xDFFF) ? "?" : chr($c)/ge'

avec `BASE=https://cdn.jsdelivr.net/gh/PokeAPI/api-data@master/data/api/v2`.

## Verifier

Recharger le site et comparer : chaque espece doit trouver sa categorie, chaque
forme sa cle, chaque type le sien. Zero manquant, sinon le fichier est a
refaire — un trou ne se voit pas, il affiche juste le francais.
