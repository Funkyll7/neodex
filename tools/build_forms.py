#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genere le referentiel des formes alternatives a partir des CSV de PokeAPI.

Sortie (ecrase a chaque execution, ne jamais editer a la main) :
    data/forms/gen-1.json ... gen-9.json
    data/forms/manifest.json

Une "forme alternative" est une entree PokeAPI dont l'id depasse 10000 :
formes regionales (Alola, Galar, Hisui, Paldea), Mega-Evolutions, Primo-formes,
Gigamax, casquettes de Pikachu, formes de combat (Motisma, Deoxys, Zygarde...).

Ce script ecrit uniquement du factuel : nom francais, types, stats, categorie,
et surtout *quels sprites existent reellement* (normal / chromatique, HOME /
artwork officiel). Le site s'appuie sur ces drapeaux pour ne jamais demander une
image absente — et l'absence de sprite chromatique est en soi une information :
elle signale une forme dont le chromatique n'existe pas (casquettes, Cosplay).

Tout ce qui est curate a la main vit ailleurs et n'est jamais touche ici :
    data/details/forms.json    ou obtenir chaque forme, shiny lock, remarques

Usage :
    python tools/build_forms.py
    python tools/build_forms.py --cache      # reutilise les CSV deja telecharges
    python tools/build_forms.py --offline    # n'interroge pas le reseau du tout
"""

import argparse
import csv
import io
import json
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "forms"
CACHE_DIR = ROOT / "tools" / ".cache"
SPRITE_CACHE = CACHE_DIR / "sprites"
SPRITE_INDEX = CACHE_DIR / "form_sprites.json"

CSV_BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/"
CSV_FILES = [
    "pokemon",
    "pokemon_forms",
    "pokemon_form_names",
    "pokemon_types",
    "type_names",
    "pokemon_stats",
    "pokemon_species_names",
    "version_groups",
]

SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/"
SPRITE_KINDS = {
    "home": "other/home/%d.png",
    "homeShiny": "other/home/shiny/%d.png",
    "art": "other/official-artwork/%d.png",
    "artShiny": "other/official-artwork/shiny/%d.png",
}

LANG_FR = 5
STAT_ORDER = [1, 2, 3, 4, 5, 6]
GEN_LAST_ID = {1: 151, 2: 251, 3: 386, 4: 493, 5: 649, 6: 721, 7: 809, 8: 905, 9: 1025}

# Les formes Totem (Soleil/Lune) ne sont ni transferables ni stockables : elles
# n'ont pas d'entree propre dans HOME, on ne les recense donc pas.
SKIP_SUFFIXES = ("-totem", "-totem-alola", "-totem-busted", "-totem-disguised")

# QUAND LE NOM DE POKEAPI NE DIT PAS CE QU'IL FAUT SAVOIR.
#
# Trois formes se distinguent par leur TALENT et par rien d'autre : leur
# apparence est celle d'une forme ordinaire, et PokeAPI les nomme comme telles.
# « Forme 10 % » ne disait donc pas laquelle des deux on regardait, et le
# Rocabot a Tempo Perso — le seul qui evolue en Lougaroc Crepusculaire —
# s'affichait sous l'etiquette « Autre forme », qui ne dit rien du tout.
#
# On ne corrige que le libelle, jamais l'identifiant ni les sprites : la table
# est indexee par la cle PokeAPI, et une cle qui disparaitrait du jeu de donnees
# ferait simplement une entree morte ici.
NOMS_FORCES = {
    "zygarde-10-power-construct": {
        "name": "Zygarde Forme 10 % Système Alpha",
        "label": "10 % · Système Alpha",
    },
    "zygarde-50-power-construct": {
        "name": "Zygarde Forme 50 % Système Alpha",
        "label": "50 % · Système Alpha",
    },
    "rockruff-own-tempo": {"label": "Tempo Perso"},
}

# Categories affichees par le site, dans l'ordre des sections de la fiche.
KIND_ORDER = ["alola", "galar", "hisui", "paldea", "mega", "primal", "gmax", "cap", "battle", "other"]
KIND_LABELS = {
    "alola": "Forme d'Alola",
    "galar": "Forme de Galar",
    "hisui": "Forme de Hisui",
    "paldea": "Forme de Paldéa",
    "mega": "Méga-Évolution",
    "primal": "Primo-Résurgence",
    "gmax": "Forme Gigamax",
    "cap": "Pikachu à casquette",
    "battle": "Forme de combat",
    "other": "Autre forme",
}


def log(msg):
    print(msg, flush=True)


def fetch_csv(name, use_cache):
    cached = CACHE_DIR / (name + ".csv")
    if use_cache and cached.exists():
        text = cached.read_text(encoding="utf-8")
    else:
        url = CSV_BASE + name + ".csv"
        log("  telechargement %s" % url)
        with urllib.request.urlopen(url, timeout=120) as resp:
            text = resp.read().decode("utf-8")
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cached.write_text(text, encoding="utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def classify(identifier, battle_only=False):
    """Categorie d'affichage deduite de l'identifiant PokeAPI."""
    if identifier.endswith("-primal"):
        return "primal"
    if "-mega" in identifier:
        return "mega"
    if identifier.endswith("-gmax"):
        return "gmax"
    for region in ("alola", "galar", "hisui", "paldea"):
        if identifier.endswith("-" + region) or ("-%s-" % region) in identifier:
            # pikachu-alola-cap est une casquette, pas une forme d'Alola.
            if identifier.endswith("-cap"):
                return "cap"
            return region
    if identifier.endswith("-cap") or identifier.startswith("pikachu-") and identifier.split("-")[-1] in (
        "cosplay", "libre", "phd", "belle", "rock", "star", "pop",
    ):
        return "cap"
    # Tout ce qui ne se voit qu'en combat (Motisma est stockable, Palmaria non).
    return "battle" if battle_only else "other"


def gen_of(species_id):
    for gen in sorted(GEN_LAST_ID):
        if species_id <= GEN_LAST_ID[gen]:
            return gen
    return 9


# --------------------------------- sprites ---------------------------------


def sprite_flags(ids, offline):
    """
    Pour chaque id de forme : quels sprites existent vraiment.

    Ordre de resolution, du moins cher au plus cher :
      1. le cache local de tools/fetch_sprites.py (HOME normal et chromatique) ;
      2. l'index deja calcule par une execution precedente ;
      3. une requete HEAD sur le depot PokeAPI/sprites.
    """
    index = {}
    if SPRITE_INDEX.exists():
        try:
            index = json.loads(SPRITE_INDEX.read_text(encoding="utf-8"))
        except ValueError:
            index = {}

    todo = []
    for pid in ids:
        known = index.get(str(pid))
        if known and all(k in known for k in SPRITE_KINDS):
            continue
        flags = dict(known or {})
        # Le cache de fetch_sprites.py fait foi pour les deux sprites HOME.
        if (SPRITE_CACHE / ("%d.png" % pid)).exists():
            flags["home"] = 1
        if (SPRITE_CACHE / ("%d_s.png" % pid)).exists():
            flags["homeShiny"] = 1
        index[str(pid)] = flags
        if not all(k in flags for k in SPRITE_KINDS):
            todo.append(pid)

    if todo and not offline:
        log("  verification en ligne de %d formes" % len(todo))

        def probe(pid):
            found = {}
            for key, pattern in SPRITE_KINDS.items():
                if key in index[str(pid)]:
                    continue
                url = SPRITE_BASE + (pattern % pid)
                try:
                    urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=45)
                    found[key] = 1
                except urllib.error.HTTPError as exc:
                    found[key] = 0 if exc.code == 404 else 1
                except Exception:
                    found[key] = 0
            return pid, found

        with ThreadPoolExecutor(max_workers=12) as pool:
            for pid, found in pool.map(probe, todo):
                index[str(pid)].update(found)

    for pid in ids:
        flags = index.setdefault(str(pid), {})
        for key in SPRITE_KINDS:
            flags.setdefault(key, 0)

    SPRITE_INDEX.write_text(json.dumps(index, indent=0, sort_keys=True), encoding="utf-8")
    return index


# --------------------------------- build -----------------------------------


def build(use_cache, offline):
    log("1/4 recuperation des CSV PokeAPI")
    tables = {name: fetch_csv(name, use_cache or offline) for name in CSV_FILES}

    log("2/4 indexation")
    type_fr = {
        to_int(r["type_id"]): r["name"]
        for r in tables["type_names"]
        if to_int(r["local_language_id"]) == LANG_FR
    }
    species_fr = {
        to_int(r["pokemon_species_id"]): r["name"]
        for r in tables["pokemon_species_names"]
        if to_int(r["local_language_id"]) == LANG_FR
    }
    version_group = {to_int(r["id"]): r["identifier"] for r in tables["version_groups"]}

    types_by_pokemon = {}
    for row in tables["pokemon_types"]:
        types_by_pokemon.setdefault(to_int(row["pokemon_id"]), []).append(
            (to_int(row["slot"]), to_int(row["type_id"]))
        )

    stats_by_pokemon = {}
    for row in tables["pokemon_stats"]:
        stats_by_pokemon.setdefault(to_int(row["pokemon_id"]), {})[to_int(row["stat_id"])] = to_int(
            row["base_stat"]
        )

    # pokemon_id -> ligne de pokemon_forms (la forme par defaut de cette entree)
    form_row = {}
    for row in tables["pokemon_forms"]:
        pid = to_int(row["pokemon_id"])
        if row["is_default"] == "1" or pid not in form_row:
            form_row[pid] = row

    names_fr = {
        to_int(r["pokemon_form_id"]): r
        for r in tables["pokemon_form_names"]
        if to_int(r["local_language_id"]) == LANG_FR
    }

    log("3/4 construction des formes")
    entries = []
    skipped_totem = 0
    for row in tables["pokemon"]:
        pid = to_int(row["id"])
        if pid <= 10000:
            continue
        identifier = row["identifier"]
        if identifier.endswith(SKIP_SUFFIXES) or "-totem" in identifier:
            skipped_totem += 1
            continue

        species_id = to_int(row["species_id"])
        form = form_row.get(pid, {})
        label = names_fr.get(to_int(form.get("id", 0)), {})
        battle_only = form.get("is_battle_only") == "1"
        kind = classify(identifier, battle_only)
        raw_types = sorted(types_by_pokemon.get(pid, []))
        raw_stats = stats_by_pokemon.get(pid, {})

        entries.append(
            {
                "id": pid,
                "species": species_id,
                "key": identifier,
                "name": NOMS_FORCES.get(identifier, {}).get("name")
                or label.get("pokemon_name")
                or species_fr.get(species_id, identifier),
                "label": NOMS_FORCES.get(identifier, {}).get("label")
                or label.get("form_name")
                or KIND_LABELS[kind],
                "kind": kind,
                "types": [type_fr.get(tid, "?") for _, tid in raw_types],
                "stats": [raw_stats.get(sid, 0) for sid in STAT_ORDER],
                "battleOnly": 1 if battle_only else 0,
                "since": version_group.get(to_int(form.get("introduced_in_version_group_id", 0)), ""),
            }
        )

    log("4/4 verification des sprites")
    flags = sprite_flags([e["id"] for e in entries], offline)
    kept = []
    dropped = []
    for entry in entries:
        entry["sprites"] = {k: flags[str(entry["id"])].get(k, 0) for k in SPRITE_KINDS}
        # Une forme sans la moindre image ne peut pas etre affichee (modes de
        # monture de Koraidon / Miraidon, par exemple).
        if not any(entry["sprites"].values()):
            dropped.append(entry["key"])
            continue
        kept.append(entry)

    # PokeAPI double certaines entrees qui n'en font qu'une en jeu : Mistigrix
    # male et femelle partagent une seule Mega-Evolution, Zygarde 10 % existe en
    # double selon son talent. On garde l'entree la plus « normale » : celle qui
    # se voit hors combat, puis le plus petit id.
    best = {}
    for entry in kept:
        signature = (entry["species"], entry["name"])
        current = best.get(signature)
        if current is None or (entry["battleOnly"], entry["id"]) < (current["battleOnly"], current["id"]):
            best[signature] = entry
    duplicates = sorted(e["key"] for e in kept if best.get((e["species"], e["name"])) is not e)
    kept = list(best.values())

    by_gen = {gen: {} for gen in GEN_LAST_ID}
    order = {kind: index for index, kind in enumerate(KIND_ORDER)}
    for entry in sorted(kept, key=lambda e: (e["species"], order.get(e["kind"], 99), e["id"])):
        gen = gen_of(entry["species"])
        by_gen[gen].setdefault(str(entry["species"]), []).append(
            {k: v for k, v in entry.items() if k != "species"}
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_gens = []
    for gen in sorted(by_gen):
        block = by_gen[gen]
        path = OUT_DIR / ("gen-%d.json" % gen)
        path.write_text(json.dumps(block, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        count = sum(len(v) for v in block.values())
        manifest_gens.append({"gen": gen, "file": "gen-%d.json" % gen, "species": len(block), "forms": count})
        log("    gen-%d.json  %3d formes sur %3d especes" % (gen, count, len(block)))

    counts = {}
    for entry in kept:
        counts[entry["kind"]] = counts.get(entry["kind"], 0) + 1
    no_shiny = [e["key"] for e in kept if not e["sprites"]["homeShiny"] and not e["sprites"]["artShiny"]]

    manifest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "PokeAPI (data/v2/csv) + PokeAPI/sprites",
        "generator": "tools/build_forms.py",
        "total": len(kept),
        "byKind": {k: counts.get(k, 0) for k in KIND_ORDER if counts.get(k)},
        "kindLabels": KIND_LABELS,
        "kindOrder": KIND_ORDER,
        "withoutShinySprite": sorted(no_shiny),
        "generations": manifest_gens,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    log("")
    log("Termine : %d formes." % len(kept))
    log("  par categorie : %s" % ", ".join("%s=%d" % (k, v) for k, v in manifest["byKind"].items()))
    log("  %d formes Totem ignorees (pas d'entree HOME)" % skipped_totem)
    if dropped:
        log("  %d formes sans aucun sprite ignorees : %s" % (len(dropped), ", ".join(dropped)))
    if duplicates:
        log("  %d doublons PokeAPI fusionnes : %s" % (len(duplicates), ", ".join(duplicates)))
    if no_shiny:
        log("  %d formes sans sprite chromatique : %s" % (len(no_shiny), ", ".join(no_shiny)))
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", action="store_true", help="reutilise les CSV deja telecharges")
    parser.add_argument("--offline", action="store_true", help="aucune requete reseau")
    args = parser.parse_args()
    return build(args.cache, args.offline)


if __name__ == "__main__":
    sys.exit(main())
