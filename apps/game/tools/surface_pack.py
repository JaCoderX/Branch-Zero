"""Fetch ambientCG CC0 1K Color maps and write 512² JPEGs for Stage 6c surface grain.

    python apps/game/tools/surface_pack.py

Downloads Marble016 / WoodFloor043 / Plaster001 (1K-JPG), keeps only the Color map,
resizes to 512², and writes apps/game/assets/textures/surfaces/{marble,wood,plaster}_albedo.jpg
plus LICENSE-ambientcg.txt. PropKit.palette() tints these onto existing Marble / Wood / Ceiling /
Paper slots — zero new materials. Requires: pillow, network.
"""
from __future__ import annotations

import hashlib
import io
import zipfile
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "textures" / "surfaces"
PACKS = [
    ("Marble016", "Marble016_1K-JPG.zip", "Marble016_1K-JPG_Color.jpg", "marble_albedo.jpg"),
    ("WoodFloor043", "WoodFloor043_1K-JPG.zip", "WoodFloor043_1K-JPG_Color.jpg", "wood_albedo.jpg"),
    ("Plaster001", "Plaster001_1K-JPG.zip", "Plaster001_1K-JPG_Color.jpg", "plaster_albedo.jpg"),
]
LICENCE = """ambientCG materials (Marble016, WoodFloor043, Plaster001) — Creative Commons CC0 1.0 Universal
https://creativecommons.org/publicdomain/zero/1.0/
https://ambientcg.com/license

Only the Color (albedo) maps are redistributed here, downsampled to 512² JPEG for the
Branch Zero web build (U7 viz Stage 6c). Full PBR packs were not imported.
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for _id, zip_name, color_name, dest_name in PACKS:
        url = f"https://ambientcg.com/get?file={zip_name}"
        print(f"GET {url}")
        data = urlopen(url, timeout=120).read()
        digest = hashlib.sha256(data).hexdigest()
        print(f"  sha256 {digest} ({len(data)} B)")
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            with zf.open(color_name) as src:
                im = Image.open(src).convert("RGB")
        im = im.resize((512, 512), Image.Resampling.LANCZOS)
        dest = OUT / dest_name
        im.save(dest, "JPEG", quality=85, optimize=True)
        print(f"  -> {dest.name} {dest.stat().st_size} B")
    (OUT / "LICENSE-ambientcg.txt").write_text(LICENCE, encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
