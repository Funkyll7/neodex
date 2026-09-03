#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genere la disponibilite par jeu des 1025 especes, a partir des Pokedex
regionaux de PokeAPI.

Sortie (ecrase a chaque execution, ne jamais editer a la main) :
    data/availability/gen-1.json ... gen-9.json
    data/availability/manifest.json

Principe : une espece presente dans le Pokedex regional d'un jeu s'y obtient.
C'est l'approximation utilisee partout ; elle ne dit rien des exclusivites de
version (un exclusif Epee reste « present dans Epee/Bouclier », le site rappelle
en note qu'un echange peut etre necessaire).

Le fichier ecrit ici sert de socle. Les corrections a la main vivent dans
data/details/gen-N.json : `gm` s'ajoute a ce socle, `nogm` en retire un jeu.

Usage :
    python tools/build_availability.py
    python tools/build_availability.py --cache
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
OUT_DIR = ROOT / "data" / "availability"
CACHE_DIR = ROOT / "tools" / ".cache"

CSV_BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/"
CSV_FILES = [
    "pokedexes",
    "pokemon_dex_numbers",
    "pokemon_species",
    "pokemon",
    "versions",
    "version_groups",
    "encounters",
    "encounter_slots",
    "encounter_methods",
]

# Methodes de rencontre qui ne sont pas des rencontres : ce sont des dons, des
# echanges ou des distributions. PokeAPI les range dans la meme table, mais on
# ne peut pas y enchainer les rencontres pour chasser un chromatique.
NOT_WILD_METHODS = {
    "gift",
    "gift-egg",
    "npc-trade",
    "colosseum-bonus-disc-us",
    "colosseum-bonus-disc-jpn",
    "pokemon-channel-pal",
    "pokemon-ranger",
    "pokemon-battle-revolution",
    "new-york-pokecenter-wish-eggs",
}

GEN_LAST_ID = {1: 151, 2: 251, 3: 386, 4: 493, 5: 649, 6: 721, 7: 809, 8: 905, 9: 1025}

# Pokedex PokeAPI -> codes de jeu de data/reference/games.json.
# Les Pokedex national (1) et Conquete (11) ne correspondent a aucun jeu de la
# serie principale : on les ignore.
DEX_TO_GAMES = {
    "kanto": ["rb", "y", "frlg"],
    "original-johto": ["gs", "c"],
    "hoenn": ["rs", "e"],
    "original-sinnoh": ["dp", "bdsp"],
    "extended-sinnoh": ["pt"],
    "updated-johto": ["hgss"],
    "original-unova": ["bw"],
    "updated-unova": ["b2w2"],
    "kalos-central": ["xy"],
    "kalos-coastal": ["xy"],
    "kalos-mountain": ["xy"],
    "updated-hoenn": ["oras"],
    "original-alola": ["sm"],
    "original-melemele": ["sm"],
    "original-akala": ["sm"],
    "original-ulaula": ["sm"],
    "original-poni": ["sm"],
    "updated-alola": ["usum"],
    "updated-melemele": ["usum"],
    "updated-akala": ["usum"],
    "updated-ulaula": ["usum"],
    "updated-poni": ["usum"],
    "letsgo-kanto": ["lgpe"],
    "galar": ["swsh"],
    "isle-of-armor": ["swsh"],
    "crown-tundra": ["swsh"],
    "hisui": ["pla"],
    "paldea": ["sv"],
    "kitakami": ["sv"],
    "blueberry": ["sv"],
    "lumiose-city": ["za"],
    "hyperspace": ["za"],
}

# Version group PokeAPI -> code de jeu. Sert a exploiter encounters.csv, qui
# dit ou chaque espece se rencontre vraiment a l'etat sauvage.
VG_TO_GAME = {
    "red-blue": "rb", "red-green-japan": "rb", "blue-japan": "rb",
    "yellow": "y",
    "gold-silver": "gs", "crystal": "c",
    "ruby-sapphire": "rs", "emerald": "e", "firered-leafgreen": "frlg",
    "colosseum": "col", "xd": "col",
    "diamond-pearl": "dp", "platinum": "pt", "heartgold-soulsilver": "hgss",
    "black-white": "bw", "black-2-white-2": "b2w2",
    "x-y": "xy", "omega-ruby-alpha-sapphire": "oras",
    "sun-moon": "sm", "ultra-sun-ultra-moon": "usum",
    "lets-go-pikachu-lets-go-eevee": "lgpe",
    "sword-shield": "swsh", "the-isle-of-armor": "swsh", "the-crown-tundra": "swsh",
    "brilliant-diamond-shining-pearl": "bdsp",
    "legends-arceus": "pla",
    "scarlet-violet": "sv", "the-teal-mask": "sv", "the-indigo-disk": "sv",
    "legends-za": "za", "mega-dimension": "za",
}

# PokeAPI n'a pas (encore) de table de rencontres pour ces jeux. On y considere
# comme « rencontrable » toute espece non legendaire presente dans le jeu : le
# Souterrain de BDSP, les zones de Hisui, de Paldea et de Lumiose posent en
# effet la quasi-totalite de leur Pokedex dans le decor.
NO_ENCOUNTER_DATA = ["bdsp", "pla", "sv", "za"]

# Ordre d'affichage : celui de data/reference/games.json.
GAME_ORDER = [
    "rb", "y", "gs", "c", "rs", "e", "frlg", "col", "dp", "pt", "hgss",
    "bw", "b2w2", "xy", "oras", "sm", "usum", "lgpe", "swsh", "bdsp", "pla", "sv", "za",
]

# Regles que les Pokedex regionaux ne capturent pas.
#
# BDSP : PokeAPI ne lui rattache que le Pokedex de Sinnoh (151 entrees), alors
# que le Pokedex national s'y complete en jeu — Souterrain, Parc Ramanas,
# Grand Marais. On ouvre donc les 493 premieres especes, sauf les fabuleux qui
# n'y sont jamais apparus autrement que par distribution.
NATIONAL_DEX_GAMES = {"bdsp": 493}
BDSP_MISSING = {151, 251, 385, 386, 489, 490, 491, 492, 493}

# Fabuleux qui, dans ces jeux precis, s'obtiennent bel et bien en jouant —
# ils restent donc en « disponible » et non en « evenement ».
MYTHIC_IN_GAME = {
    386: {"oras", "usum"},   # Deoxys : Episode Delta, puis failles d'Ultra-Chimie
    489: {"pla"},            # Phione : requete 66 « La legende de la mer », Hisui
    490: {"pla"},            # Manaphy : meme requete, grotte de Bordebrume
    491: {"za"},             # Darkrai
    493: {"pla"},            # Arceus : quete finale de Legendes Arceus
    647: {"swsh", "za"},     # Keldeo : Etang de Chamboulier, puis Pokedex Hyperespace
    648: {"za"},             # Meloetta : Pokedex Hyperespace (DLC Mega-Dimension)
    649: {"za"},             # Genesect
    720: {"za"},             # Hoopa
    721: {"za"},             # Volcanion
    801: {"za"},             # Magearna : Dimension Hyperespace (DLC Mega-Dimension)
    802: {"za"},             # Marshadow
    807: {"za"},             # Zeraora
    808: {"lgpe", "za"},     # Meltan : Boite Mystere reliee a Pokemon GO, puis Hyperespace
    809: {"lgpe", "za"},     # Melmetal
    1025: {"sv"},            # Pecharunt : combat scenarise apres le Disque Indigo
}

# ---------------------------------------------------------------------------
# Attrapables SANS etre recensees : l'angle mort des Pokedex regionaux
# ---------------------------------------------------------------------------
#
# Tout ce fichier repose sur une equivalence : « presente au Pokedex regional
# d'un jeu » = « s'obtient dans ce jeu ». Elle vaut pour l'ecrasante majorite
# des especes, et c'est elle qui permet de situer 1025 Pokemon sans les saisir
# un par un. Mais elle a un angle mort, et c'est toujours le meme : une espece
# peut etre ATTRAPABLE dans un jeu sans y etre RECENSEE. PokeAPI dit alors vrai
# et le calcul est faux — l'espece disparait purement et simplement du jeu.
#
# Le cas d'ecole est le Repaire Dynamax de la Toundra Couronnee (Dynamax
# Adventures / Max Lair, Epee-Bouclier). On y capture une quarantaine de
# legendaires d'anciennes generations : les chiens de Johto, les trios de Hoenn
# et de Sinnoh, les Ultra-Chimeres d'Alola. Aucun ne figure au Pokedex de la
# Toundra Couronnee, qui ne recense que la faune de la region — le Repaire est
# une annexe, pas une zone. Ils manquaient donc TOUS a Epee/Bouclier.
#
# Meme mecanique ailleurs :
#   - les friandises legendaires de Jeffry Andise, debloquees apres le scenario
#     du Disque Indigo, ramenent 25 legendaires dans Ecarlate/Violet ;
#   - le chasseur de Taupiqueur de l'Ile Solitaire de l'Armure offre un starter
#     d'Alola au palier de 100 Taupiqueur ;
#   - Keldeo s'obtient a l'Etang de Chamboulier de Couronneige, avec Cobaltium,
#     Terrakium et Viridium dans l'equipe.
# Aucun de ces Pokemon n'est au Pokedex du jeu qui le distribue.
#
# Ces tables sont donc la contrepartie assumee de l'approximation : la liste de
# ce que les Pokedex regionaux ne peuvent pas dire. Elles s'ajoutent au socle
# calcule, exactement comme MYTHIC_IN_GAME au-dessus corrige les fabuleux — et
# comme elle, elles se relisent espece par espece.
#
# ELLES N'OUVRENT PAS LA RENCONTRE SAUVAGE, ET C'EST DELIBERE. Verifie sur
# encounters.csv : PokeAPI possede des lignes de rencontre « sword-shield »
# pour la TOTALITE des especes du Repaire. Sans precaution, les ajouter ici
# aurait donc aussi rempli leur champ `wild`. Or une expedition du Repaire
# demande de finir le DLC, d'entrer dans un repaire et d'enchainer quatre
# combats : ce n'est pas une rencontre qu'on relance dehors en une soiree, ce
# que `wild` promet au site (meme raison que NOT_WILD_METHODS plus haut, et
# assets/js/domain/reste.js le redit cote interface). Les codes ajoutes ici
# sont donc explicitement retires du calcul de `wild`, a l'ecriture.

# Repaire Dynamax de la Toundra Couronnee -> « swsh ».
DYNAMAX_ADVENTURES = {
    243, 244, 245,                      # Raikou, Entei, Suicune
    253, 254, 256, 257, 259, 260,       # evolutions des starters de Hoenn
    380, 381, 382, 383,                 # Latias, Latios, Kyogre, Groudon
    480, 481, 482,                      # Crehelf, Crefollet, Crefadet
    484, 485, 487, 488,                 # Palkia, Heatran, Giratina, Cresselia
    641, 642, 645, 646,                 # Boreas, Fulguris, Demeteros, Kyurem
    716, 717, 718,                      # Xerneas, Yveltal, Zygarde
    785, 786, 787, 788,                 # les quatre Tokos d'Alola
    791, 792,                           # Solgaleo, Lunala
    793, 794, 795, 796, 797, 798, 799,  # les sept Ultra-Chimeres de Soleil/Lune
    805, 806,                           # Ama-Ama, Pierroteknik
}

# Friandises legendaires de Jeffry Andise, apres le Disque Indigo -> « sv ».
# Chaque legendaire est reparti par version en solo, mais reste accessible dans
# l'autre en quete de groupe : « sv » pour les deux, comme pour toute
# exclusivite de version ailleurs dans ce fichier.
SNACKSWORTH_TREATS = {
    144, 145, 146,            # Artikodin, Electhor, Sulfura
    243, 244, 245,            # Raikou, Entei, Suicune
    249, 250,                 # Lugia, Ho-Oh
    380, 381, 382, 383, 384,  # Latias, Latios, Kyogre, Groudon, Rayquaza
    638, 639, 640,            # Cobaltium, Terrakium, Viridium
    643, 644, 646,            # Reshiram, Zekrom, Kyurem
    791, 792,                 # Solgaleo, Lunala
    800,                      # Necrozma
    891,                      # Wushours
    896, 897,                 # Blizzeval, Spectreval
}

# Le reste, espece par espece : id -> jeux, meme forme que MYTHIC_IN_GAME.
# Keldeo y figure ET dans MYTHIC_IN_GAME : etant fabuleux, il lui faut les
# deux — cette table pour que « swsh » entre dans les jeux calcules, la
# whitelist pour qu'il y compte comme jouable et non comme evenement.
OFF_DEX_EXTRAS = {
    647: {"swsh"},  # Keldeo : Etang de Chamboulier, les trois Epees dans l'equipe
    722: {"swsh"},  # Brindibou, offert au palier de 100 Taupiqueur (Ile Solitaire)
    723: {"swsh"},  # Effleche
    724: {"swsh"},  # Archeduc
    725: {"swsh"},  # Flamiaou, meme don
    726: {"swsh"},  # Matoufeu
    727: {"swsh"},  # Felinferno
    728: {"swsh"},  # Otaquin, meme don
    729: {"swsh"},  # Otarlequin
    730: {"swsh"},  # Oratoria
}


def off_dex_additions():
    """Les trois tables ci-dessus, fondues en un seul {espece: {jeux}}."""
    extras = {}
    for sid in DYNAMAX_ADVENTURES:
        extras.setdefault(sid, set()).add("swsh")
    for sid in SNACKSWORTH_TREATS:
        extras.setdefault(sid, set()).add("sv")
    for sid, codes in OFF_DEX_EXTRAS.items():
        extras.setdefault(sid, set()).update(codes)
    return extras


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


def gen_of(species_id):
    for gen in sorted(GEN_LAST_ID):
        if species_id <= GEN_LAST_ID[gen]:
            return gen
    return 9


def build(use_cache):
    log("1/3 recuperation des CSV PokeAPI")
    tables = {name: fetch_csv(name, use_cache) for name in CSV_FILES}

    log("2/3 croisement Pokedex regionaux x jeux")
    dex_name = {to_int(r["id"]): r["identifier"] for r in tables["pokedexes"]}
    known_species = {to_int(r["id"]) for r in tables["pokemon_species"] if to_int(r["id"]) <= 1025}
    # Les fabuleux figurent dans les Pokedex regionaux sans jamais s'y attraper :
    # ils passent en « evenement » plutot qu'en « disponible ».
    mythical = {
        to_int(r["id"])
        for r in tables["pokemon_species"]
        if r["is_mythical"] == "1" and to_int(r["id"]) <= 1025
    }

    games_by_species = {sid: set() for sid in known_species}
    unmapped = set()
    for row in tables["pokemon_dex_numbers"]:
        sid = to_int(row["species_id"])
        if sid not in games_by_species:
            continue
        identifier = dex_name.get(to_int(row["pokedex_id"]), "")
        if identifier in ("national", "conquest-gallery", "champions"):
            continue
        codes = DEX_TO_GAMES.get(identifier)
        if codes is None:
            unmapped.add(identifier)
            continue
        games_by_species[sid].update(codes)

    for code, last in NATIONAL_DEX_GAMES.items():
        for sid in known_species:
            if sid <= last and sid not in BDSP_MISSING:
                games_by_species[sid].add(code)

    # Attrapables sans etre recensees : Repaire Dynamax, friandises de Jeffry
    # Andise, dons hors Pokedex. Voir le long bloc en tete de fichier — c'est
    # la seule chose que les Pokedex regionaux ne savent pas dire.
    off_dex = off_dex_additions()
    for sid, codes in sorted(off_dex.items()):
        if sid in games_by_species:
            games_by_species[sid].update(codes)
        else:
            log("    espece %d inconnue de PokeAPI : ajout manuel ignore" % sid)
    log("    ajouts hors Pokedex : %d especes" % len(off_dex))

    log("    rencontres sauvages (encounters.csv)")
    vg_name = {to_int(r["id"]): r["identifier"] for r in tables["version_groups"]}
    game_of_version = {}
    for row in tables["versions"]:
        code = VG_TO_GAME.get(vg_name.get(to_int(row["version_group_id"]), ""))
        if code:
            game_of_version[to_int(row["id"])] = code
    # Une forme alternative (id > 10000) compte pour son espece de base.
    species_of_pokemon = {to_int(r["id"]): to_int(r["species_id"]) for r in tables["pokemon"]}

    method_name = {to_int(r["id"]): r["identifier"] for r in tables["encounter_methods"]}
    slot_is_wild = {
        to_int(r["id"]): method_name.get(to_int(r["encounter_method_id"]), "") not in NOT_WILD_METHODS
        for r in tables["encounter_slots"]
    }

    wild_by_species = {sid: set() for sid in known_species}
    for row in tables["encounters"]:
        if not slot_is_wild.get(to_int(row["encounter_slot_id"]), True):
            continue
        code = game_of_version.get(to_int(row["version_id"]))
        sid = species_of_pokemon.get(to_int(row["pokemon_id"]))
        if code and sid in wild_by_species:
            wild_by_species[sid].add(code)

    legendary = {
        to_int(r["id"])
        for r in tables["pokemon_species"]
        if r["is_legendary"] == "1" or r["is_mythical"] == "1"
    }
    for sid in known_species:
        if sid in legendary:
            continue
        for code in NO_ENCOUNTER_DATA:
            if code in games_by_species[sid]:
                wild_by_species[sid].add(code)

    log("3/3 ecriture des fichiers")
    order = {code: index for index, code in enumerate(GAME_ORDER)}
    by_gen = {gen: {} for gen in GEN_LAST_ID}
    empty = []
    for sid in sorted(known_species):
        codes = sorted(games_by_species[sid], key=lambda c: order.get(c, 99))
        if not codes:
            empty.append(sid)
            continue
        if sid in mythical:
            playable = MYTHIC_IN_GAME.get(sid, set())
            entry = {}
            events = [c for c in codes if c not in playable]
            wild = [c for c in codes if c in playable]
            if wild:
                entry["gm"] = " ".join(wild)
            if events:
                entry["ev"] = " ".join(events)
        else:
            entry = {"gm": " ".join(codes)}
        # Un ajout hors Pokedex ne remplit JAMAIS `wild` : l'espece s'attrape
        # dans ce jeu, elle ne s'y croise pas dehors. Sans ce filtre, les
        # lignes « sword-shield » que PokeAPI porte sur les especes du Repaire
        # Dynamax passeraient toutes en rencontre sauvage.
        manual = off_dex.get(sid, ())
        wild = sorted(
            (
                c
                for c in wild_by_species[sid]
                if c in games_by_species[sid] and c not in manual
            ),
            key=lambda c: order.get(c, 99),
        )
        if wild:
            entry["wild"] = " ".join(wild)
        by_gen[gen_of(sid)][str(sid)] = entry

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_gens = []
    for gen in sorted(by_gen):
        block = by_gen[gen]
        (OUT_DIR / ("gen-%d.json" % gen)).write_text(
            json.dumps(block, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
        manifest_gens.append({"gen": gen, "file": "gen-%d.json" % gen, "count": len(block)})
        log("    gen-%d.json  %4d especes" % (gen, len(block)))

    per_game = {}
    for codes in games_by_species.values():
        for code in codes:
            per_game[code] = per_game.get(code, 0) + 1

    manifest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "PokeAPI (pokedexes x pokemon_dex_numbers)",
        "generator": "tools/build_availability.py",
        "total": sum(len(b) for b in by_gen.values()),
        "perGame": {code: per_game.get(code, 0) for code in GAME_ORDER if per_game.get(code)},
        "generations": manifest_gens,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    log("")
    log("Termine : %d especes situees." % manifest["total"])
    log("  par jeu : %s" % ", ".join("%s=%d" % (c, n) for c, n in manifest["perGame"].items()))
    if empty:
        log("  %d especes sans aucun jeu : %s" % (len(empty), ", ".join(map(str, empty))))
    if unmapped:
        log("  Pokedex non rattaches a un jeu : %s" % ", ".join(sorted(unmapped)))
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", action="store_true", help="reutilise les CSV deja telecharges")
    return build(parser.parse_args().cache)


if __name__ == "__main__":
    sys.exit(main())
