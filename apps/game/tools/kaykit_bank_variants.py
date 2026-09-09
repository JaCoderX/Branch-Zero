"""Derive the bank-variant albedos for the KayKit Adventurers cast (docs/HANDOFF-kaykit-bank-variants.md, Pass A).

    python apps/game/tools/kaykit_bank_variants.py [--sheet <png>]

KayKit paints each Adventurer with one 1024² palette sheet: an 8 × 4 grid of 128 × 256 px cells, each a flat colour
with a top-to-bottom shading gradient, and the mesh UVs point into those cells. A "bank variant" is therefore a cell
recolour: the room owns the neutrals (cream / brass / deep green / graphite), each role owns one saturated accent,
and the shading gradient of every cell is kept (target colour × the cell's own luminance profile).

Two roles share each of the Mage, Ranger and Rogue sheets (Ines / Petra, Mo / player, Dev / Kenji), and the cast is
budgeted at five body materials, so the second role of a pair does not get a second PNG: this script paints its
colours into the sheet's *spare* cells (bottom row, unused by any mesh) and `PropKit.KAYKIT_ROLE_CELLS` re-points
that role's triangles at them when the mesh is instanced — same material, different tint.

Reads `<body>_texture.png` (the CC0 originals beside the .glb) and writes `<body>_bank_texture.png` next to them.
Prints the sha256 of every derivative for CREDITS.md. `--sheet` also writes a before / after contact sheet.
"""
import hashlib
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CHARACTERS = os.path.normpath(os.path.join(HERE, "..", "assets", "characters", "kaykit_adventurers", "Characters"))
COLS, ROWS = 8, 4
CELL_W, CELL_H = 128, 256

# Room neutrals (WingTheme main wing) and the one-accent-per-role set from the handoff wardrobe sheet.
CREAM = "#ddc9ad"
PAPER = "#f1ece1"
BRASS = "#c49a48"
DEEP_GREEN = "#2a5c47"
GRAPHITE = "#434854"
CHARCOAL = "#2e3037"
SLATE = "#4d5568"
STEEL_DARK = "#6f7684"
DARK_BROWN = "#4a3b32"
CAMEL = "#b98a5c"
TAN = "#c7a274"
HAIR_DARK = "#3a2a22"

EMERALD = "#1e8f5e"   # Mo — greeter
MUSTARD = "#d8a627"   # Ines — clerk
OXBLOOD = "#7a1f2b"   # Dev — teller · Mr. Okafor — manager
OXBLOOD_DARK = "#561520"
CORAL = "#e46f52"     # Petra — registrar · Bob's cape
TEAL = "#1f8f96"      # Kenji — dealer
TEAL_DARK = "#15656b"
NAVY = "#27365f"      # player
NAVY_GUARD = "#2f3d63"       # Bob — plate cells as guard tunic (ENG-2026-0015)
NAVY_GUARD_DARK = "#1f2740"  # Bob — darker plate piping / arm bands
COPPER = "#9a512f"    # Petra's hair (Ines keeps the black)

# Per sheet: ("tint", cell, colour) recolours a cell in place, keeping its own gradient;
# ("spare", cell, colour, profile_cell) paints an unused cell with `colour` shaded like `profile_cell`.
# Cells are (col, row) in the 8 × 4 grid. Skin (0,0) and the eye cell (2,0) are never touched.
WARDROBE = {
    # Ines (base) — slate "desk mage" robe + hat, mustard cape / trims, brass clasps, charcoal hose.
    # Petra — deep-green robe + hat, coral cape / trims, copper hair, via the spares (PropKit "registrar" remap).
    "mage": [
        ("tint", (0, 1), SLATE), ("tint", (1, 1), SLATE), ("tint", (2, 1), MUSTARD), ("tint", (5, 0), MUSTARD),
        ("tint", (7, 1), CHARCOAL), ("tint", (2, 2), BRASS), ("tint", (3, 0), BRASS), ("tint", (4, 0), BRASS),
        ("spare", (0, 3), DEEP_GREEN, (0, 1)), ("spare", (1, 3), CORAL, (2, 1)), ("spare", (2, 3), COPPER, (1, 0)),
    ],
    # Mo (base) — camel tunic, brass fittings, cream shirt, emerald cape / sash, auburn hair.
    # player — graphite tunic, navy cape / sash, dark hair, via the spares (PropKit "player" remap).
    "ranger": [
        ("tint", (7, 0), CAMEL), ("tint", (7, 2), CAMEL), ("tint", (3, 0), BRASS), ("tint", (0, 1), EMERALD),
        ("tint", (5, 0), PAPER), ("tint", (6, 0), PAPER), ("tint", (7, 1), CHARCOAL),
        ("spare", (0, 3), GRAPHITE, (7, 0)), ("spare", (1, 3), NAVY, (0, 1)), ("spare", (2, 3), HAIR_DARK, (1, 0)),
    ],
    # Dev (base, Rogue) — oxblood hood-cloth / cape, tan leather, brass buckles, charcoal hose.
    # Kenji (Rogue_Hooded) — teal hood / cape / mask on the same sheet via the spares (PropKit "dealer" remap).
    "rogue": [
        ("tint", (0, 1), OXBLOOD_DARK), ("tint", (1, 1), OXBLOOD), ("tint", (3, 0), BRASS), ("tint", (5, 0), TAN),
        ("tint", (7, 1), CHARCOAL),
        ("spare", (0, 3), TEAL_DARK, (0, 1)), ("spare", (1, 3), TEAL, (1, 1)),
    ],
    # Bob — navy guard tunic (was steel plate cells; helm/visor hidden at load in PropKit), brass trim,
    # cream piping, coral cape, charcoal under-layer. Cells (3,0)/(4,0) from GameLab ENG-2026-0015.
    "knight": [
        ("tint", (3, 0), NAVY_GUARD), ("tint", (4, 0), NAVY_GUARD_DARK),
        ("tint", (7, 0), BRASS), ("tint", (2, 1), BRASS), ("tint", (0, 1), CORAL),
        ("tint", (1, 1), CREAM), ("tint", (7, 1), CHARCOAL),
    ],
    # Mr. Okafor — oxblood sash / wrap, brass straps and buckles, cream teeth / trim, dark bear fur, charcoal hose.
    "barbarian": [
        ("tint", (1, 3), OXBLOOD), ("tint", (6, 0), BRASS), ("tint", (3, 0), BRASS), ("tint", (3, 1), BRASS),
        ("tint", (2, 1), CREAM), ("tint", (7, 1), CHARCOAL), ("tint", (7, 0), DARK_BROWN),
    ],
}


def hex_rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def cell_box(cell):
    c, r = cell
    return slice(r * CELL_H, (r + 1) * CELL_H), slice(c * CELL_W, (c + 1) * CELL_W)


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def recolour(px: np.ndarray, src: np.ndarray, cell, colour: str, profile_cell=None) -> None:
    """Paint `cell` with `colour`, shaded by the luminance profile of `profile_cell` (default: the cell itself)."""
    prof = src[cell_box(profile_cell or cell)][..., :3].astype(np.float64)
    lum = luminance(prof)
    scale = lum / max(lum.mean(), 1.0)
    target = hex_rgb(colour)
    out = np.clip(target[None, None, :] * scale[..., None], 0, 255)
    ys, xs = cell_box(cell)
    px[ys, xs, :3] = out.astype(np.uint8)


def derive(stem: str) -> str:
    src_path = os.path.join(CHARACTERS, f"{stem}_texture.png")
    dst_path = os.path.join(CHARACTERS, f"{stem}_bank_texture.png")
    src = np.array(Image.open(src_path).convert("RGBA"))
    if src.shape[:2] != (ROWS * CELL_H, COLS * CELL_W):
        raise SystemExit(f"{stem}: expected a 1024² palette sheet, got {src.shape}")
    px = src.copy()
    for op in WARDROBE[stem]:
        if op[0] == "tint":
            recolour(px, src, op[1], op[2])
        elif op[0] == "spare":
            recolour(px, src, op[1], op[2], op[3])
        else:
            raise SystemExit(f"{stem}: unknown op {op}")
    Image.fromarray(px, "RGBA").save(dst_path, optimize=True)
    with open(dst_path, "rb") as f:
        data = f.read()
    print(f"{os.path.basename(dst_path)}  sha256 {hashlib.sha256(data).hexdigest()}  ({len(data)} B)")
    return dst_path


def contact_sheet(path: str) -> None:
    stems = list(WARDROBE)
    tile = 256
    sheet = Image.new("RGB", (tile * len(stems), tile * 2 + 24), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, stem in enumerate(stems):
        for row, suffix in enumerate(("_texture", "_bank_texture")):
            im = Image.open(os.path.join(CHARACTERS, f"{stem}{suffix}.png")).convert("RGB").resize((tile, tile), Image.NEAREST)
            sheet.paste(im, (tile * i, 24 + tile * row))
        d.text((tile * i + 4, 6), stem, fill=(255, 255, 255))
    sheet.save(path)
    print(f"contact sheet -> {path}")


def main() -> None:
    for stem in WARDROBE:
        derive(stem)
    if "--sheet" in sys.argv:
        contact_sheet(sys.argv[sys.argv.index("--sheet") + 1])


if __name__ == "__main__":
    main()
