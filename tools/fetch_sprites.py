#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Telecharge les sprites HOME de PokeAPI (normal + chromatique) dans un cache local.

Ils ne servent qu'a l'outil de lecture des captures d'ecran
(tools/read_screenshots.py) : le site, lui, va chercher les images sur le CDN.
Le cache n'est pas versionne (voir .gitignore).

Usage :
    python tools/fetch_sprites.py
    python tools/fetch_sprites.py --max-id 1025 --workers 16
"""

import argparse
import csv
import io
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".cache" / "sprites"
BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/"
FORMS_CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv"
FORMS_MAP = CACHE.parent / "forms.json"


def target(pid, shiny):
    return CACHE / ("%d%s.png" % (pid, "_s" if shiny else ""))


def fetch(job):
    pid, shiny = job
    path = target(pid, shiny)
    if path.exists() and path.stat().st_size > 0:
        return "cache"
    url = "%s%s%d.png" % (BASE, "shiny/" if shiny else "", pid)
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            data = resp.read()
    except urllib.error.HTTPError as exc:
        return "absent" if exc.code == 404 else "erreur"
    except Exception:
        return "erreur"
    path.write_bytes(data)
    return "telecharge"


def alternate_forms():
    """
    Formes alternatives (Gigamax, formes regionales, Mega...) : leur id PokeAPI
    depasse 10000. HOME les affiche comme des entrees a part entiere, il faut
    donc pouvoir les reconnaitre puis les rattacher a leur espece de base.
    """
    with urllib.request.urlopen(FORMS_CSV, timeout=120) as resp:
        rows = csv.DictReader(io.StringIO(resp.read().decode("utf-8")))
        return {int(r["id"]): int(r["species_id"]) for r in rows if int(r["id"]) > 10000}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-id", type=int, default=1025)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--no-forms", action="store_true", help="ignorer les formes alternatives")
    args = parser.parse_args()

    CACHE.mkdir(parents=True, exist_ok=True)
    jobs = [(pid, shiny) for pid in range(1, args.max_id + 1) for shiny in (False, True)]

    if not args.no_forms:
        forms = alternate_forms()
        print("Formes alternatives connues :", len(forms))
        FORMS_MAP.write_text(
            "{\n" + ",\n".join(' "%d": %d' % kv for kv in sorted(forms.items())) + "\n}\n",
            encoding="utf-8",
        )
        jobs += [(fid, shiny) for fid in sorted(forms) for shiny in (False, True)]

    tally = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for index, result in enumerate(pool.map(fetch, jobs), 1):
            tally[result] = tally.get(result, 0) + 1
            if index % 250 == 0:
                print("  %d / %d" % (index, len(jobs)), flush=True)

    print("Termine :", ", ".join("%s=%d" % kv for kv in sorted(tally.items())))
    return 1 if tally.get("erreur") else 0


if __name__ == "__main__":
    sys.exit(main())
