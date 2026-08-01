#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lit les captures d'ecran de Pokemon HOME et en deduit la collection.

Principe : la grille de HOME a une geometrie fixe (5 colonnes, 7 lignes, pas
constant). Chaque case est decoupee, detouree du fond, puis comparee aux sprites
HOME officiels de PokeAPI (normal et chromatique) telecharges par
tools/fetch_sprites.py. Le meilleur score gagne.

Le resultat est l'union des especes vues : les doublons entre captures qui se
chevauchent sont sans effet, on ne compte pas les individus.

Sorties :
    data/collection.json                       marques om / sm par espece
    tools/.cache/screenshots_report.txt         detail case par case, a relire

Usage :
    python tools/fetch_sprites.py         # une fois, pour remplir le cache
    python tools/read_screenshots.py
    python tools/read_screenshots.py --dry-run --limit 3
"""

import argparse
import bisect
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "photo"
SPRITES = ROOT / "tools" / ".cache" / "sprites"
FORMS = ROOT / "tools" / ".cache" / "forms.json"
REPORT = ROOT / "tools" / ".cache" / "screenshots_report.txt"
OUT = ROOT / "data" / "collection.json"

# --- Geometrie de la grille, mesuree sur les captures 1080x2412 --------------
SCREEN = (1080, 2412)
COL_X = [145, 341, 537, 733, 929]      # centre horizontal des 5 colonnes
ROW_Y = [692, 950, 1207, 1465, 1722, 1980, 2237]  # centre vertical des 7 lignes
HALF_W = 95                            # demi-largeur de la case
TOP, BOTTOM = 68, 80                   # hauteur au-dessus / au-dessous du centre
                                       # (exclut l'etoile de marquage, ~90 px plus haut)

# Deux cases de la derniere ligne sont recouvertes par les boutons flottants de
# HOME. On les ignore : les captures se chevauchent d'une ligne, ces cases
# reapparaissent intactes dans la capture suivante. Les lire donnerait des
# reconnaissances aberrantes qui, servant d'appui aux passes suivantes,
# fausseraient leurs voisines.
OBSCURED = {(6, 2), (6, 4)}

SIG = 28           # cote de la signature carree
FG_THRESHOLD = 85  # ecart au fond (somme des |delta| RVB) au-dela duquel c'est un sprite
MIN_PIXELS = 260   # en dessous, la case est consideree vide

# Deux niveaux d'exigence. Calibres sur 50 cases relues a la main : sous 6.0,
# aucune erreur observee ; au-dela, les erreurs deviennent frequentes.
STRICT = 6.0         # match retenu d'emblee, sert d'ancre
RELAXED = 13.0       # match accepte une fois l'intervalle du dex connu
RELAXED_NARROW = 20.0  # idem, quand l'intervalle ne laisse que quelques candidats
NARROW_WIDTH = 8     # largeur d'intervalle en dessous de laquelle on est indulgent
PASSES = 6           # tours de rattrapage : chacun resserre les intervalles


# ============================================================ signatures ====

def signature_from_rgba(image):
    """Sprite de reference : le canal alpha donne directement le detourage."""
    array = np.asarray(image.convert("RGBA"), dtype=np.float32)
    mask = array[:, :, 3] > 140
    if mask.sum() < 40:
        return None
    return pack(array[:, :, :3], mask)


def pack(rgb, mask):
    """Recadre sur le contenu, met a l'echelle en gardant les proportions."""
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if not len(rows) or not len(cols):
        return None
    y0, y1 = rows[0], rows[-1] + 1
    x0, x1 = cols[0], cols[-1] + 1

    crop_rgb = rgb[y0:y1, x0:x1]
    crop_mask = mask[y0:y1, x0:x1]
    h, w = crop_mask.shape

    # Le fond est neutralise en gris moyen : deux sprites ne different alors que
    # par leur silhouette et leurs couleurs propres.
    flat = np.where(crop_mask[:, :, None], crop_rgb, 128.0).astype(np.uint8)

    scale = SIG / max(h, w)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    small = np.asarray(
        Image.fromarray(flat).resize((nw, nh), Image.BILINEAR), dtype=np.float32
    )
    small_mask = np.asarray(
        Image.fromarray((crop_mask * 255).astype(np.uint8)).resize((nw, nh), Image.BILINEAR),
        dtype=np.float32,
    ) / 255.0

    canvas = np.full((SIG, SIG, 3), 128.0, dtype=np.float32)
    canvas_mask = np.zeros((SIG, SIG), dtype=np.float32)
    oy, ox = (SIG - nh) // 2, (SIG - nw) // 2
    canvas[oy:oy + nh, ox:ox + nw] = small
    canvas_mask[oy:oy + nh, ox:ox + nw] = small_mask

    # La silhouette compte autant qu'une composante couleur.
    return np.concatenate([canvas.reshape(-1) / 255.0, canvas_mask.reshape(-1)]).astype(np.float32)


def load_references(max_id):
    """
    Matrice (N, D) des signatures + etiquettes (espece, shiny, forme).

    Les formes alternatives (Gigamax, formes regionales, Mega) ont leur propre
    sprite dans HOME : il faut savoir les reconnaitre, sinon elles sont
    attribuees a n'importe quelle espece. Elles sont ensuite rattachees a leur
    espece de base via tools/.cache/forms.json.
    """
    forms = {}
    if FORMS.exists():
        forms = {int(k): int(v) for k, v in json.loads(FORMS.read_text(encoding="utf-8")).items()}

    entries = [(pid, pid) for pid in range(1, max_id + 1)]
    entries += [(fid, sid) for fid, sid in sorted(forms.items()) if sid <= max_id]

    vectors, labels = [], []
    for sprite_id, species_id in entries:
        for shiny in (False, True):
            path = SPRITES / ("%d%s.png" % (sprite_id, "_s" if shiny else ""))
            if not path.exists():
                continue
            vector = signature_from_rgba(Image.open(path))
            if vector is None:
                continue
            vectors.append(vector)
            labels.append((species_id, shiny, sprite_id))
    if not vectors:
        raise SystemExit(
            "Cache de sprites vide. Lance d'abord : python tools/fetch_sprites.py"
        )
    return np.stack(vectors), labels


# ========================================================== decoupe cases ====

def background_profile(array):
    """Couleur de fond ligne par ligne : la mediane, le fond etant majoritaire."""
    return np.median(array[:, ::6, :], axis=1)


def morph(mask, radius, dilate):
    """Erosion ou dilatation carree, en pur numpy."""
    padded = np.pad(mask, radius, constant_values=False)
    h, w = mask.shape
    out = None
    size = 2 * radius + 1
    for dy in range(size):
        for dx in range(size):
            window = padded[dy:dy + h, dx:dx + w]
            out = window if out is None else (out | window if dilate else out & window)
    return out


def cell_signature(array, background, cx, cy):
    """
    Signature d'une case, ou None si elle est vide.

    Le fond de HOME n'est pas uni : un motif de toile d'araignee le barre de
    traits blancs epais qui franchissent n'importe quel seuil de difference.
    D'ou deux passes :

      1. masque « chromatique » — on ecarte les pixels qui ne font qu'eclaircir
         le fond sans le colorer (c'est la signature d'un trait de la toile).
         Apres ouverture morphologique il ne reste que le sprite : il donne le
         cadre utile.
      2. masque complet — a l'interieur de ce cadre seulement, on reprend tous
         les pixels qui different du fond, y compris les parties blanches du
         sprite (ailes de Papilusion, dards de Dardargnan) que la passe 1 rejette.
    """
    y0, y1 = cy - TOP, cy + BOTTOM
    x0, x1 = cx - HALF_W, cx + HALF_W
    patch = array[y0:y1, x0:x1, :]
    bg = background[y0:y1][:, None, :]

    delta = patch - bg
    strength = np.abs(delta).sum(axis=2)
    full = strength > FG_THRESHOLD

    brighter = (delta > 0).all(axis=2)
    spread = delta.max(axis=2) - delta.min(axis=2)
    web = brighter & (spread < 30)  # eclaircissement neutre = trait de la toile

    solid = morph(morph(full & ~web, 3, dilate=False), 3, dilate=True)
    if solid.sum() < MIN_PIXELS:
        solid = morph(morph(full, 3, dilate=False), 3, dilate=True)
    if solid.sum() < MIN_PIXELS:
        return None, 0

    rows = np.where(solid.any(axis=1))[0]
    cols = np.where(solid.any(axis=0))[0]
    if not len(rows) or not len(cols):
        return None, 0

    pad = 7
    window = np.zeros_like(full)
    window[
        max(0, rows[0] - pad):rows[-1] + 1 + pad,
        max(0, cols[0] - pad):cols[-1] + 1 + pad,
    ] = True
    mask = full & window

    if mask.sum() < MIN_PIXELS:
        return None, 0
    return pack(patch, mask), int(mask.sum())


# ============================================================== traitement ====

def read_cells(photo):
    """Signature de chacune des 35 cases d'une capture, dans l'ordre de lecture."""
    image = Image.open(photo).convert("RGB")
    if image.size != SCREEN:
        image = image.resize(SCREEN, Image.LANCZOS)
    array = np.asarray(image, dtype=np.float32)
    background = background_profile(array)

    cells = []
    for r, cy in enumerate(ROW_Y):
        for c, cx in enumerate(COL_X):
            if (r, c) in OBSCURED:
                continue
            vector, pixels = cell_signature(array, background, cx, cy)
            cells.append({"row": r, "col": c, "vector": vector, "pixels": pixels})
    return cells


def match(vector, references, labels, keep=None):
    """Plus proche sprite, eventuellement restreint a un sous-ensemble."""
    if keep is None:
        distances = np.abs(references - vector).mean(axis=1) * 100.0
        best = int(np.argmin(distances))
        return labels[best], float(distances[best])

    indices = np.flatnonzero(keep)
    if not len(indices):
        return None, float("inf")
    distances = np.abs(references[indices] - vector).mean(axis=1) * 100.0
    best = int(np.argmin(distances))
    return labels[indices[best]], float(distances[best])


def longest_non_decreasing(pairs):
    """
    Plus longue sous-suite croissante (au sens large) parmi (index, numero).
    Renvoie l'ensemble des index conserves.
    """
    tails, tail_index, previous = [], [], {}
    for index, value in pairs:
        slot = bisect.bisect_right(tails, value)
        if slot == len(tails):
            tails.append(value)
            tail_index.append(index)
        else:
            tails[slot] = value
            tail_index[slot] = index
        previous[index] = tail_index[slot - 1] if slot else None

    kept = set()
    node = tail_index[-1] if tail_index else None
    while node is not None:
        kept.add(node)
        node = previous[node]
    return kept


def bracket(cells, forward):
    """
    Pour chaque case, le numero de la case sure la plus proche avant (forward)
    ou apres. Les boites de HOME etant triees par numero national, ces deux
    valeurs encadrent forcement l'espece cherchee.
    """
    bounds = [None] * len(cells)
    order = range(len(cells)) if forward else range(len(cells) - 1, -1, -1)
    seen = 1 if forward else 1025
    for i in order:
        bounds[i] = seen
        cell = cells[i]
        if cell["accepted"] and cell["label"] is not None:
            seen = cell["label"][0]
    return bounds


def enforce_order(cells):
    """
    Filet de securite : on ne garde que la plus longue suite de cases dont les
    numeros restent croissants. Une reconnaissance isolee qui casse l'ordre du
    dex est forcement fausse, quel que soit son score.
    """
    kept = longest_non_decreasing(
        [(i, cell["label"][0]) for i, cell in enumerate(cells) if cell["accepted"]]
    )
    dropped = 0
    for i, cell in enumerate(cells):
        if cell["accepted"] and i not in kept:
            cell["accepted"] = False
            cell["reason"] = "ordre"
            dropped += 1
    return dropped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--photos", default=str(PHOTOS))
    parser.add_argument("--limit", type=int, default=0, help="ne traiter que les N premieres captures")
    parser.add_argument("--max-id", type=int, default=1025)
    parser.add_argument("--dry-run", action="store_true", help="n'ecrit pas data/collection.json")
    args = parser.parse_args()

    photos = sorted(Path(args.photos).glob("*.jpg")) + sorted(Path(args.photos).glob("*.png"))
    if args.limit:
        photos = photos[: args.limit]
    if not photos:
        raise SystemExit("Aucune capture trouvee dans %s" % args.photos)

    print("Chargement des sprites de reference…", flush=True)
    references, labels = load_references(args.max_id)
    print("  %d sprites (%d especes)" % (len(labels), len({p for p, _, _ in labels})))
    report = []

    # ------------------------------------------------ 1re passe : les ancres
    # Recherche libre sur les 1025 especes. Seuls les scores tres bas sont
    # retenus : a ce niveau d'exigence la reconnaissance ne se trompe pas.
    print("Lecture des captures…", flush=True)
    cells = []
    for index, photo in enumerate(photos, 1):
        for cell in read_cells(photo):
            cell["photo"] = photo.name
            cells.append(cell)
        print("  %2d/%d  %s" % (index, len(photos), photo.name[:38]), flush=True)

    print("1re passe : reconnaissance libre…", flush=True)
    for cell in cells:
        if cell["vector"] is None:
            cell["label"], cell["score"], cell["accepted"] = None, float("inf"), False
            continue
        cell["label"], cell["score"] = match(cell["vector"], references, labels)
        cell["accepted"] = cell["score"] <= STRICT
    print("  %d ancres sures sur %d cases" % (sum(c["accepted"] for c in cells), len(cells)))
    enforce_order(cells)

    # ----------------------- passes suivantes : contrainte par l'ordre du dex
    # HOME range les boites par numero national : la suite des cases est
    # croissante. Entre deux cases sures, une case ne peut etre qu'une espece
    # de l'intervalle — ce qui ramene 1025 candidats a une poignee. Chaque
    # tour ajoute des points d'appui, donc resserre les intervalles du suivant.
    species_ids = np.array([sid for sid, _, _ in labels])
    for turn in range(1, PASSES + 1):
        lower = bracket(cells, forward=True)
        upper = bracket(cells, forward=False)
        recovered = 0
        for i, cell in enumerate(cells):
            if cell["vector"] is None or cell["accepted"]:
                continue
            lo, hi = lower[i], upper[i]
            keep = (species_ids >= lo) & (species_ids <= hi)
            label, score = match(cell["vector"], references, labels, keep)
            if label is None:
                continue
            # Plus l'intervalle est etroit, plus on peut etre indulgent : avec
            # cinq candidats possibles, un score moyen reste concluant.
            width = hi - lo + 1
            limit = RELAXED if width > NARROW_WIDTH else RELAXED_NARROW
            if score > limit:
                cell["label"], cell["score"] = label, score
                continue
            cell["label"], cell["score"] = label, score
            cell["accepted"], cell["window"] = True, (lo, hi)
            recovered += 1
        dropped = enforce_order(cells)
        print("  passe %d : +%d cases  (-%d hors ordre)" % (turn + 1, recovered, dropped), flush=True)
        if not recovered:
            break

    for cell in cells:
        if not cell["accepted"]:
            cell["rejected"] = True
            cell.setdefault("reason", "score")

    # ------------------------------------------------------------- resultats
    marks = {}
    confidence = {}
    stats = {"cases": len(cells), "reconnues": 0, "refusees": 0, "vides": 0}
    current = None

    for cell in cells:
        if cell["photo"] != current:
            current = cell["photo"]
            report.append("\n=== %s ===" % current)

        position = "  L%d C%d" % (cell["row"] + 1, cell["col"] + 1)
        flag = ""

        if cell["vector"] is None:
            stats["vides"] += 1
            report.append("%s  vide%s" % (position, flag))
            continue
        if cell.get("rejected") or cell["label"] is None:
            stats["refusees"] += 1
            reason = cell.get("reason", "score")
            report.append("%s  REFUSE (%s)  score %.1f%s" % (position, reason, cell["score"], flag))
            continue

        pid, shiny, form = cell["label"]
        if form != pid:
            flag += " [forme %d]" % form
        if "window" in cell:
            flag += " [rattrape dans #%d-#%d]" % cell["window"]

        stats["reconnues"] += 1
        report.append(
            "%s  #%04d %-6s score %.1f  (%d px)%s"
            % (position, pid, "shiny" if shiny else "normal", cell["score"], cell["pixels"], flag)
        )
        slot = "sm" if shiny else "om"
        marks.setdefault(pid, {})[slot] = 1
        key = (pid, slot)
        confidence[key] = min(confidence.get(key, 1e9), cell["score"])

    # En tete du rapport : les marques les moins sures d'abord. C'est la liste
    # a relire dans le site, la reconnaissance ne pretend pas etre parfaite.
    weak = sorted((score, pid, slot) for (pid, slot), score in confidence.items() if score > STRICT)
    header = [
        "Marques deduites : %d  (dont %d a verifier, score > %.1f)" % (len(confidence), len(weak), STRICT),
        "",
        "--- a verifier en priorite (score le plus bas obtenu pour cette marque) ---",
    ]
    header += ["  #%04d %-6s  score %.1f" % (pid, slot, score) for score, pid, slot in weak[::-1][:120]]
    report[:0] = header

    species = sorted(marks)
    normal = sum(1 for pid in species if marks[pid].get("om"))
    shiny = sum(1 for pid in species if marks[pid].get("sm"))

    print("")
    print("Cases : %(cases)d  |  reconnues %(reconnues)d  |  refusees %(refusees)d  |  vides %(vides)d" % stats)
    print("Especes distinctes : %d   (dont %d normales, %d chromatiques)" % (len(species), normal, shiny))

    holes = ["#%d-#%d" % (a + 1, b - 1) for a, b in zip(species, species[1:]) if b - a > 1]
    if holes:
        print("Trous dans la suite des numeros (%d) : %s%s"
              % (len(holes), ", ".join(holes[:10]), " …" if len(holes) > 10 else ""))

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("Rapport detaille : %s" % REPORT)

    if args.dry_run:
        print("(--dry-run : data/collection.json inchange)")
        return 0

    payload = {
        "_comment": "Genere par tools/read_screenshots.py a partir du dossier photo/. "
                    "Les cases cochees dans le navigateur se superposent a ce fichier ; "
                    "utilise « Exporter » pour figer tes corrections ici.",
        "version": 1,
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "captures Pokémon HOME (%d images)" % len(photos),
        "marks": {str(pid): marks[pid] for pid in species},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("Ecrit : %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
