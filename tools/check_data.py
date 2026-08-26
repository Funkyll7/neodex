#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verifie la coherence des six couches de donnees. N'ecrit rien.

Les fichiers ecrits a la main (data/details/, data/reference/) renvoient a des
identifiants qui vivent dans les fichiers generes (data/pokemon/, data/forms/).
Rien ne garantit que ces renvois restent valides : une forme disparait d'une
regeneration, un code de jeu est mal tape, une case cochee designe une forme
qui n'existe plus. Le site, lui, ignore silencieusement ce qu'il ne comprend
pas — c'est le bon comportement a l'affichage, mais ca laisse pourrir les
donnees sans prevenir.

Ce script fait le tour des renvois et signale ceux qui ne tombent pas juste.

Ce qu'il ne fait PAS : il ne rejoue pas la fusion des couches (assets/js/core/
data.js). Le total de cases du site, le « tout obtenu », les formes principales
en dependent — les redupliquer ici les ferait diverger a la premiere evolution
du code. Ces chiffres-la se lisent dans la barre laterale du site.

Usage :
    python tools/check_data.py
    python tools/check_data.py --quiet    # ne sort que les problemes

Code de sortie : 0 si tout est coherent, 1 sinon.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
GENERATIONS = range(1, 10)

# Cases heritees du schema positionnel, converties par domain/collection.js.
# Il n'en reste normalement aucune dans le fichier de reference.
LEGACY_SLOTS = ("vo", "vs", "vof", "vsf")

# Champs de data/details/gen-N.json dont la valeur est une liste de codes de jeu.
GAME_FIELDS = ("gm", "nogm", "ev", "nowild", "nsh")


def load(path):
    """Charge un JSON, en signalant les cles dupliquees plutot que les ecraser."""
    doubles = []

    def hook(pairs):
        vues = set()
        for cle, _ in pairs:
            if cle in vues:
                doubles.append(cle)
            vues.add(cle)
        return dict(pairs)

    with open(path, encoding="utf-8") as handle:
        data = json.load(handle, object_pairs_hook=hook)
    return data, doubles


class Report:
    def __init__(self):
        self.problems = []

    def fail(self, where, message):
        self.problems.append(f"{where} : {message}")

    def __len__(self):
        return len(self.problems)


def collect_reference(report):
    """Ids d'especes, ids et cles de formes, codes de jeu : le socle a verifier."""
    species_ids, form_ids, form_keys = set(), set(), set()

    for gen in GENERATIONS:
        entries, doubles = load(DATA / "pokemon" / f"gen-{gen}.json")
        for cle in doubles:
            report.fail(f"pokemon/gen-{gen}.json", f"clé « {cle} » en double")
        for entry in entries:
            species_ids.add(entry["id"])

        forms, doubles = load(DATA / "forms" / f"gen-{gen}.json")
        for cle in doubles:
            report.fail(f"forms/gen-{gen}.json", f"clé « {cle} » en double")
        for group in forms.values():
            for form in group:
                form_ids.add(form["id"])
                form_keys.add(form["key"])

    games_doc, doubles = load(DATA / "reference" / "games.json")
    for cle in doubles:
        report.fail("reference/games.json", f"clé « {cle} » en double")
    game_codes = {game["code"] for game in games_doc.get("games", [])}

    return species_ids, form_ids, form_keys, game_codes


def check_details(report, species_ids, game_codes):
    """data/details/gen-N.json : especes connues, codes de jeu connus."""
    for gen in GENERATIONS:
        path = DATA / "details" / f"gen-{gen}.json"
        if not path.exists():
            continue
        details, doubles = load(path)
        where = f"details/gen-{gen}.json"
        for cle in doubles:
            report.fail(where, f"clé « {cle} » en double")
        for national, entry in details.items():
            if not national.isdigit() or int(national) not in species_ids:
                report.fail(where, f"espèce « {national} » inconnue")
            for field in GAME_FIELDS:
                for code in str(entry.get(field, "")).split():
                    if code not in game_codes:
                        report.fail(where, f"{national}.{field} → jeu « {code} » inconnu")


def check_forms_details(report, form_keys):
    """data/details/forms.json : chaque cle doit designer une forme reelle."""
    doc, doubles = load(DATA / "details" / "forms.json")
    where = "details/forms.json"
    for cle in doubles:
        report.fail(where, f"clé « {cle} » en double")
    for key in doc.get("forms", {}):
        if key not in form_keys:
            report.fail(where, f"forme « {key} » inexistante")


def check_locks(report, species_ids, form_keys, game_codes):
    """data/reference/shiny-locks.json : especes, formes et jeux existants."""
    doc, doubles = load(DATA / "reference" / "shiny-locks.json")
    where = "reference/shiny-locks.json"
    for cle in doubles:
        report.fail(where, f"clé « {cle} » en double")

    for block in ("always", "noShiny"):
        for national in doc.get(block, {}).get("species", []):
            if national not in species_ids:
                report.fail(where, f"{block} → espèce {national} inconnue")

    for code, entry in doc.get("byGame", {}).items():
        if code == "_comment":
            continue
        if code not in game_codes:
            report.fail(where, f"byGame → jeu « {code} » inconnu")
        for national in entry.get("species", []):
            if national not in species_ids:
                report.fail(where, f"byGame.{code} → espèce {national} inconnue")

    for key in doc.get("forms", {}):
        if key == "_comment":
            continue
        if key not in form_keys:
            report.fail(where, f"forms → forme « {key} » inexistante")


def check_cosmetics(report, species_ids):
    """data/details/cosmetic-forms.json : cles uniques, `base` qui existe."""
    doc, doubles = load(DATA / "details" / "cosmetic-forms.json")
    where = "details/cosmetic-forms.json"
    for cle in doubles:
        report.fail(where, f"clé « {cle} » en double")

    for national, group in doc.get("groups", {}).items():
        if not national.isdigit() or int(national) not in species_ids:
            report.fail(where, f"espèce « {national} » inconnue")

        keys = set()
        for variant in group.get("forms", []):
            key = variant.get("key")
            if not key or not variant.get("name"):
                report.fail(where, f"{national} → variante sans « key » ou « name »")
                continue
            if key in keys:
                report.fail(where, f"{national} → clé « {key} » en double")
            keys.add(key)

        # `base` est facultatif : chez Pikachu, aucune casquette n'est la forme
        # par defaut de l'espece. Mais s'il est declare, il doit exister.
        base = group.get("base")
        if base and base not in keys:
            report.fail(where, f"{national} → base « {base} » absente des variantes")


def check_collection(report, species_ids, form_ids):
    """data/collection.json : especes connues, formes existantes, zero herite."""
    doc, doubles = load(DATA / "collection.json")
    where = "collection.json"
    for cle in doubles:
        report.fail(where, f"clé « {cle} » en double")

    for national, marks in doc.get("marks", {}).items():
        if not national.isdigit() or int(national) not in species_ids:
            report.fail(where, f"espèce « {national} » inconnue")
        for slot in marks:
            if slot in LEGACY_SLOTS:
                report.fail(where, f"{national}.{slot} → case héritée non migrée")
                continue
            if slot.startswith("f"):
                digits = slot[1:].rstrip("sf")
                if digits.isdigit() and int(digits) not in form_ids:
                    report.fail(where, f"{national}.{slot} → forme {digits} inexistante")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="ne sortir que les problèmes")
    args = parser.parse_args()

    report = Report()
    species_ids, form_ids, form_keys, game_codes = collect_reference(report)

    check_details(report, species_ids, game_codes)
    check_forms_details(report, form_keys)
    check_locks(report, species_ids, form_keys, game_codes)
    check_cosmetics(report, species_ids)
    check_collection(report, species_ids, form_ids)

    if not args.quiet:
        print(f"{len(species_ids)} espèces, {len(form_ids)} formes, {len(game_codes)} jeux")

    if not report.problems:
        if not args.quiet:
            print("Tout est cohérent.")
        return 0

    print(f"{len(report)} problème(s) :", file=sys.stderr)
    for line in report.problems:
        print(f"  {line}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
