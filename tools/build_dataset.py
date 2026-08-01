#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genere le dataset de base des Pokemon a partir des CSV officiels de PokeAPI.

Sortie (ecrase a chaque execution, ne jamais editer a la main) :
    data/pokemon/gen-1.json ... gen-9.json
    data/pokemon/manifest.json

Les donnees ecrites ici sont purement factuelles (nom, types, stats...).
Tout ce qui est curate a la main vit ailleurs et n'est jamais touche par ce script :
    data/reference/*.json   tables de reference (types, generations, jeux, methodes)
    data/details/*.json     enrichissements par Pokemon (ou le trouver, shiny lock...)
    data/collection.json    la collection personnelle

Usage :
    python tools/build_dataset.py
    python tools/build_dataset.py --cache      # reutilise les CSV deja telecharges
"""

import argparse
import csv
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "pokemon"
CACHE_DIR = ROOT / "tools" / ".cache"

CSV_BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/"
CSV_FILES = [
    "pokemon_species",
    "pokemon_species_names",
    "pokemon",
    "pokemon_types",
    "type_names",
    "pokemon_stats",
    "stat_names",
]

LANG_FR = 5
LANG_EN = 9

# Ordre des stats tel qu'affiche sur la fiche.
STAT_ORDER = [1, 2, 3, 4, 5, 6]
STAT_LABELS_FR = {
    1: "PV",
    2: "Attaque",
    3: "Defense",
    4: "Atq. Spe.",
    5: "Def. Spe.",
    6: "Vitesse",
}

# Derniere espece de chaque generation (numero national).
GEN_LAST_ID = {1: 151, 2: 251, 3: 386, 4: 493, 5: 649, 6: 721, 7: 809, 8: 905, 9: 1025}


def log(msg):
    print(msg, flush=True)


def fetch_csv(name, use_cache):
    """Telecharge un CSV PokeAPI (ou le relit depuis le cache) et renvoie une liste de dicts."""
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


def build(use_cache):
    log("1/4 recuperation des CSV PokeAPI")
    tables = {name: fetch_csv(name, use_cache) for name in CSV_FILES}

    log("2/4 indexation")

    # id de type -> nom francais
    type_fr = {}
    for row in tables["type_names"]:
        if to_int(row["local_language_id"]) == LANG_FR:
            type_fr[to_int(row["type_id"])] = row["name"]

    # id d'espece -> noms et categorie
    names_fr, names_en, genus_fr = {}, {}, {}
    for row in tables["pokemon_species_names"]:
        sid = to_int(row["pokemon_species_id"])
        lang = to_int(row["local_language_id"])
        if lang == LANG_FR:
            names_fr[sid] = row["name"]
            genus_fr[sid] = row.get("genus") or ""
        elif lang == LANG_EN:
            names_en[sid] = row["name"]

    # Forme par defaut de chaque espece : c'est elle qui porte types et stats.
    default_form = {}
    for row in tables["pokemon"]:
        if row["is_default"] == "1":
            default_form[to_int(row["species_id"])] = to_int(row["id"])

    types_by_pokemon = {}
    for row in tables["pokemon_types"]:
        pid = to_int(row["pokemon_id"])
        types_by_pokemon.setdefault(pid, []).append(
            (to_int(row["slot"]), to_int(row["type_id"]))
        )

    stats_by_pokemon = {}
    for row in tables["pokemon_stats"]:
        pid = to_int(row["pokemon_id"])
        stats_by_pokemon.setdefault(pid, {})[to_int(row["stat_id"])] = to_int(
            row["base_stat"]
        )

    log("3/4 construction des especes")
    by_gen = {gen: [] for gen in GEN_LAST_ID}
    skipped = []

    for row in tables["pokemon_species"]:
        sid = to_int(row["id"])
        gen = to_int(row["generation_id"])
        if gen not in by_gen:
            skipped.append(sid)
            continue
        if sid not in names_fr or sid not in names_en:
            skipped.append(sid)
            continue

        form_id = default_form.get(sid)
        raw_types = sorted(types_by_pokemon.get(form_id, []))
        type_names = [type_fr.get(tid, "?") for _, tid in raw_types]
        raw_stats = stats_by_pokemon.get(form_id, {})

        by_gen[gen].append(
            {
                "id": sid,
                "name": names_fr[sid],
                "en": names_en[sid],
                "cat": genus_fr.get(sid, ""),
                "gen": gen,
                "types": type_names,
                "stats": [raw_stats.get(stat_id, 0) for stat_id in STAT_ORDER],
                # gd = formes male et femelle visuellement distinctes (sprite "female" existant)
                "gd": 1 if row["has_gender_differences"] == "1" else 0,
                "legend": 1 if row["is_legendary"] == "1" else 0,
                "mythic": 1 if row["is_mythical"] == "1" else 0,
                "baby": 1 if row["is_baby"] == "1" else 0,
                "evolvesFrom": to_int(row["evolves_from_species_id"], 0) or None,
            }
        )

    log("4/4 ecriture des fichiers")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_gens = []
    total = 0

    for gen in sorted(by_gen):
        entries = sorted(by_gen[gen], key=lambda p: p["id"])
        if not entries:
            continue
        total += len(entries)
        path = OUT_DIR / ("gen-%d.json" % gen)
        path.write_text(
            json.dumps(entries, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
        manifest_gens.append(
            {
                "gen": gen,
                "file": "gen-%d.json" % gen,
                "count": len(entries),
                "first": entries[0]["id"],
                "last": entries[-1]["id"],
            }
        )
        log("    gen-%d.json  %4d especes  (#%d a #%d)" % (gen, len(entries), entries[0]["id"], entries[-1]["id"]))

    manifest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "PokeAPI (data/v2/csv)",
        "generator": "tools/build_dataset.py",
        "total": total,
        "statLabels": [STAT_LABELS_FR[s] for s in STAT_ORDER],
        "generations": manifest_gens,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    log("")
    log("Termine : %d especes reparties sur %d generations." % (total, len(manifest_gens)))
    if skipped:
        log("(%d entrees hors dex principal ignorees)" % len(skipped))
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache",
        action="store_true",
        help="reutilise les CSV deja telecharges dans tools/.cache",
    )
    args = parser.parse_args()
    return build(args.cache)


if __name__ == "__main__":
    sys.exit(main())
