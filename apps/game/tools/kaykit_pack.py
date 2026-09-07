"""Pack the KayKit Furniture Bits (CC0) glTF picks into textureless .glb files for the bank's fill (U7 viz Stage 6a).

    python apps/game/tools/kaykit_pack.py <KayKit_Furniture_Bits_1.0_FREE dir> [out_dir]

The pack ships .gltf + .bin + one 1024² palette atlas (furniturebits_texture.png). Every atlas cell is a flat colour
with a soft top-to-bottom gradient, so the bank does not ship the atlas at all: this script drops the image / texture /
sampler entries and the material's baseColorTexture, keeps the UVs, and writes one binary .glb per pick. At load,
scripts/props.gd (`PropKit._split_kaykit`) reads each triangle's UV cell and hands it the matching WingTheme palette
material (wood, deep green, brass, paper …) — zero new materials, and the Arc theme recolours the fill for free.
Geometry is untouched (1 unit = 1 m, +Y up, as authored). License.txt is copied beside the models.
"""
import json
import os
import shutil
import struct
import sys

PICKS = [
    "couch", "chair_A", "chair_stool", "table_small", "lamp_table", "lamp_standing",
    "cabinet_medium", "cabinet_medium_decorated", "shelf_B_large_decorated", "book_set",
    "rug_rectangle_stripes_B", "rug_oval_B",
    "pictureframe_large_A", "pictureframe_large_B", "pictureframe_medium",
]


def pack(src_dir: str, name: str, out_dir: str) -> int:
    with open(os.path.join(src_dir, name + ".gltf"), "r", encoding="utf-8") as f:
        g = json.load(f)
    if len(g["buffers"]) != 1:
        raise SystemExit(f"{name}: expected one buffer, got {len(g['buffers'])}")
    with open(os.path.join(src_dir, g["buffers"][0]["uri"]), "rb") as f:
        bin_data = f.read()
    for key in ("images", "textures", "samplers"):
        g.pop(key, None)
    for m in g.get("materials", []):
        pbr = m.setdefault("pbrMetallicRoughness", {})
        pbr.pop("baseColorTexture", None)
        pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
        m["name"] = "KayKitAtlas"   # the UV cell picks the palette material at load (props.gd)
    g["buffers"] = [{"byteLength": len(bin_data)}]
    g.setdefault("asset", {})["extras"] = {"source": "KayKit Furniture Bits 1.0 (CC0) — atlas stripped by tools/kaykit_pack.py"}
    js = json.dumps(g, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    bd = bin_data + b"\0" * ((4 - len(bin_data) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bd)
    out = os.path.join(out_dir, name + ".glb")
    with open(out, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON"))
        f.write(js)
        f.write(struct.pack("<I4s", len(bd), b"BIN\0"))
        f.write(bd)
    return total


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    root = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, "..", "assets", "models", "kaykit_furniture")
    os.makedirs(out_dir, exist_ok=True)
    src = os.path.join(root, "Assets", "gltf")
    total = 0
    for name in PICKS:
        n = pack(src, name, out_dir)
        total += n
        print(f"  {name}.glb  {n:>7,} B")
    shutil.copyfile(os.path.join(root, "License.txt"), os.path.join(out_dir, "LICENSE-kaykit-furniture-bits.txt"))
    print(f"{len(PICKS)} models, {total:,} B -> {os.path.abspath(out_dir)}")


if __name__ == "__main__":
    main()
