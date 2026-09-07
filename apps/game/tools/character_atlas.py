"""Kenney Blocky Characters (CC0) → one shared atlas + UV-remapped .glb per skin (U7 viz Stage 3).

    python tools/character_atlas.py <extracted kenney_blocky-characters_20 dir> [out_dir]

Why: the kit ships one 1024² texture per skin, so eight skins would cost eight materials against the ≤ 40 budget
(docs/WORLD-3D-ENVIRONMENT.md §6). Each skin's texture is resampled to a 256² tile (the art is flat colour blocks;
256 keeps the faces, 128 does not), the tiles are packed into one 1024×512 atlas with an 8 px replicated border per
tile (mip bleed guard), and every .glb's TEXCOORD_0 is wrapped into [0, 1] (the kit relies on REPEAT) and mapped
into its tile. The image uri of every .glb points at Textures/atlas.png, so PropKit.textured() hands all characters
one StandardMaterial3D. Geometry and the 27 animation clips are untouched. Needs Pillow.
"""
import json, math, os, struct, sys
from PIL import Image

# skin letter → atlas tile index (column-major, 4 × 2). Which npc uses which is scripts/npc.gd SKINS.
SKINS = ["b", "c", "e", "f", "i", "j", "m", "q"]
TILE = 256
BORDER = 8
INNER = TILE - 2 * BORDER
COLS = 4
ATLAS_W, ATLAS_H = COLS * TILE, math.ceil(len(SKINS) / COLS) * TILE


def read_glb(path):
    with open(path, "rb") as f:
        magic, _ver, _len = struct.unpack("<III", f.read(12))
        assert magic == 0x46546C67, path
        jlen, jtype = struct.unpack("<II", f.read(8))
        assert jtype == 0x4E4F534A
        j = json.loads(f.read(jlen))
        blen, btype = struct.unpack("<II", f.read(8))
        assert btype == 0x004E4942
        b = bytearray(f.read(blen))
    return j, b


def write_glb(path, j, b):
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    while len(b) % 4:
        b += b"\0"
    total = 12 + 8 + len(js) + 8 + len(b)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(b), 0x004E4942) + bytes(b))


def accessor_floats(j, b, idx):
    """(offset, stride, count, ncomp) for a float accessor."""
    a = j["accessors"][idx]
    bv = j["bufferViews"][a["bufferView"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]
    assert a["componentType"] == 5126
    return bv.get("byteOffset", 0) + a.get("byteOffset", 0), bv.get("byteStride") or 4 * n, a["count"], n


def accessor_ints(j, b, idx):
    a = j["accessors"][idx]
    bv = j["bufferViews"][a["bufferView"]]
    fmt = {5121: "B", 5123: "H", 5125: "I"}[a["componentType"]]
    size = struct.calcsize(fmt)
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride") or size
    return [struct.unpack_from("<" + fmt, b, off + k * stride)[0] for k in range(a["count"])]


def remap_uvs(j, b, tile):
    """Wrap every triangle's UVs into its own unit cell, then map into `tile` (col, row) of the atlas."""
    col, row = tile
    u0 = (col * TILE + BORDER) / ATLAS_W
    v0 = (row * TILE + BORDER) / ATLAS_H
    su = INNER / ATLAS_W
    sv = INNER / ATLAS_H
    for m in j["meshes"]:
        for p in m["primitives"]:
            off, stride, count, n = accessor_floats(j, b, p["attributes"]["TEXCOORD_0"])
            assert n == 2
            uv = [list(struct.unpack_from("<ff", b, off + k * stride)) for k in range(count)]
            idx = accessor_ints(j, b, p["indices"])
            cell = [None] * count
            for t in range(0, len(idx), 3):
                tri = idx[t:t + 3]
                mu = sum(uv[k][0] for k in tri) / 3.0
                mv = sum(uv[k][1] for k in tri) / 3.0
                c = (math.floor(mu), math.floor(mv))
                for k in tri:
                    if cell[k] is not None and cell[k] != c:
                        raise SystemExit("vertex %d shared across wrap cells in %s" % (k, m["name"]))
                    cell[k] = c
            new_min = [1e9, 1e9]
            new_max = [-1e9, -1e9]
            for k in range(count):
                cu, cv = cell[k] if cell[k] is not None else (math.floor(uv[k][0]), math.floor(uv[k][1]))
                u = min(max(uv[k][0] - cu, 0.0), 1.0)
                v = min(max(uv[k][1] - cv, 0.0), 1.0)
                nu, nv = u0 + u * su, v0 + v * sv
                struct.pack_into("<ff", b, off + k * stride, nu, nv)
                new_min = [min(new_min[0], nu), min(new_min[1], nv)]
                new_max = [max(new_max[0], nu), max(new_max[1], nv)]
            a = j["accessors"][p["attributes"]["TEXCOORD_0"]]
            a["min"], a["max"] = new_min, new_max
    for s in j.get("samplers", []):
        s["wrapS"] = s["wrapT"] = 33071   # CLAMP_TO_EDGE — the atlas must never repeat
    if not j.get("samplers"):
        j["samplers"] = [{"magFilter": 9728, "minFilter": 9984, "wrapS": 33071, "wrapT": 33071}]
        for t in j["textures"]:
            t["sampler"] = 0


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "assets", "characters", "kenney_blocky")
    glb_dir = os.path.join(src, "Models", "GLB format")
    tex_dir = os.path.join(glb_dir, "Textures")
    os.makedirs(os.path.join(out, "Textures"), exist_ok=True)
    atlas = Image.new("RGB", (ATLAS_W, ATLAS_H), (24, 24, 24))
    for i, skin in enumerate(SKINS):
        col, row = i % COLS, i // COLS
        tex = Image.open(os.path.join(tex_dir, "texture-%s.png" % skin)).convert("RGB")
        inner = tex.resize((INNER, INNER), Image.LANCZOS)
        # replicated border: resize the inner tile's edge pixels outwards (mip bleed guard)
        tile = Image.new("RGB", (TILE, TILE))
        tile.paste(inner.resize((TILE, TILE), Image.NEAREST), (0, 0))   # cheap edge fill
        tile.paste(inner, (BORDER, BORDER))
        atlas.paste(tile, (col * TILE, row * TILE))
        j, b = read_glb(os.path.join(glb_dir, "character-%s.glb" % skin))
        remap_uvs(j, b, (col, row))
        j["images"] = [{"uri": "Textures/atlas.png", "name": "atlas"}]
        for mat in j["materials"]:
            mat["name"] = "blocky_atlas"
        j.setdefault("asset", {})["generator"] = "Kenney Blocky Characters 2.0 via tools/character_atlas.py"
        write_glb(os.path.join(out, "character-%s.glb" % skin), j, b)
        print("character-%s.glb -> tile (%d, %d)" % (skin, col, row))
    atlas.save(os.path.join(out, "Textures", "atlas.png"), optimize=True)
    print("atlas %dx%d -> %s" % (ATLAS_W, ATLAS_H, os.path.join(out, "Textures", "atlas.png")))


if __name__ == "__main__":
    main()
