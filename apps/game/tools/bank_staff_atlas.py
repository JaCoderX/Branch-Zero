"""Bank staff atlas — repaint Kenney's CC0 skins as art-deco bank staff, eight roles in one 1024² atlas.

    python apps/game/tools/bank_staff_atlas.py <extracted-pack-dir>[,<second-pack>] <bank_staff.glb> <out.png>

Kenney's "Animated Characters" packs ship skater / criminal / cyborg / survivor / zombie skins: flat vector art
in exactly the language the art bible wants (WORLD-3D §1) but the wrong wardrobe for a bank. This script keeps
each skin's **head and hands** — Kenney's faces are the part we could not author — and repaints every clothing
region in the wing palette (`themes/wing_main.tres`: deep green, brass, cream, graphite, oxblood, wood).

Nothing is guessed about the layout. The regions come from the exported `bank_staff.glb` itself: every triangle
is assigned to the joint that carries most of its weight (`REGION`), the belt line splits the hips into jacket
and trousers by vertex height, and the shirt front is the run of chest triangles whose normal faces the camera
(+Z after the glTF Y-up conversion) — so the collar, tie and buttons land on the chest panel by measurement.

Output is a 3 × 3 grid of 340 px tiles (one spare) in a 1024 × 1024 PNG; `PropKit.character` offsets each
role's UVs into its tile at load, so the whole cast still shares **one** material
(GameDevOS `atlas-skins-to-one-material`).
"""

import json
import os
import struct
import sys

from PIL import Image, ImageDraw, ImageFilter

TILE = 340
STRIDE = 341
ATLAS = 1024
SOURCE = 1024          # Kenney's skins are 1024²; regions are painted at that size, then reduced to TILE

# palette (themes/wing_main.tres)
GREEN = (41, 92, 71)
GREEN_D = (28, 64, 49)
BRASS = (199, 158, 77)
BRASS_D = (150, 115, 52)
CREAM = (238, 231, 214)
CREAM_D = (206, 197, 178)
GRAPHITE = (66, 71, 82)
GRAPHITE_D = (46, 50, 58)
CHARCOAL = (41, 44, 51)
OXBLOOD = (140, 31, 36)
OXBLOOD_D = (102, 22, 26)
WOOD = (92, 61, 37)
WOOD_D = (64, 42, 25)
BLACK = (28, 28, 32)
CAMEL = (158, 122, 76)
CAMEL_D = (120, 92, 56)
NAVY = (46, 56, 87)
NAVY_D = (33, 40, 63)
GREY_HAIR = (176, 176, 172)

# joint → clothing region. Head / neck / hands keep Kenney's own art.
REGION = {
    "Head": "keep", "Neck": "keep",
    # hands are repainted in the skin tone sampled off the neck: the source skins put a skater's black
    # wristbands and bracelets here, which read as gloves on a bank clerk
    "LeftHand": "skin", "RightHand": "skin",
    "LeftHandIndex1": "skin", "LeftHandIndex2": "skin", "LeftHandIndex3": "skin",
    "LeftHandThumb1": "skin", "LeftHandThumb2": "skin",
    "RightHandIndex1": "skin", "RightHandIndex2": "skin", "RightHandIndex3": "skin",
    "RightHandThumb1": "skin", "RightHandThumb2": "skin",
    "LeftShoulder": "coat", "RightShoulder": "coat",
    "LeftArm": "coat", "RightArm": "coat",
    "LeftForeArm": "sleeve", "RightForeArm": "sleeve",
    "Spine": "coat", "Chest": "coat", "UpperChest": "coat",
    "Hips": "belt",                      # split by height: jacket above the belt, trousers below
    "LeftUpLeg": "trouser", "RightUpLeg": "trouser",
    "LeftLeg": "trouser", "RightLeg": "trouser",
    "LeftFoot": "shoe", "RightFoot": "shoe",
    "LeftToes": "shoe", "RightToes": "shoe",
}

BELT_Y = 1.30          # model units; Hips' head sits at 1.242, the jacket hem just above it

# One tile per NPC role (`scripts/npc.gd` SKINS) plus the player. `head` names the Kenney skin whose face,
# hands and hair are kept; `hair` recolours that skin's hair field so repeated faces still read as two people.
ROLES = [
    dict(name="greeter", head="skaterMaleA", coat=GREEN, sleeve=GREEN, trouser=GRAPHITE, shoe=WOOD_D,
         shirt=CREAM, tie=BRASS, buttons=BRASS, lapel=GREEN_D),
    dict(name="clerk", head="skaterFemaleA", coat=BRASS, sleeve=BRASS, trouser=GRAPHITE, shoe=WOOD_D,
         shirt=CREAM, tie=GREEN, buttons=GREEN_D, lapel=BRASS_D, hair=(122, 68, 42)),
    dict(name="teller", head="survivorMaleB", coat=GRAPHITE, sleeve=CREAM, trouser=GRAPHITE, shoe=WOOD_D,
         shirt=CREAM, tie=OXBLOOD, buttons=BRASS, lapel=GRAPHITE_D),
    dict(name="vault_keeper", head="criminalMaleA", coat=GRAPHITE, sleeve=GRAPHITE, trouser=GRAPHITE_D,
         shoe=BLACK, shirt=CREAM, tie=BRASS, buttons=BRASS, lapel=BRASS_D),
    dict(name="manager", head="criminalMaleA", coat=CHARCOAL, sleeve=CHARCOAL, trouser=CHARCOAL, shoe=BLACK,
         shirt=CREAM, tie=OXBLOOD, buttons=BRASS, lapel=(56, 60, 68), hair=GREY_HAIR),
    dict(name="registrar", head="survivorFemaleA", coat=GREEN_D, sleeve=CREAM, trouser=GRAPHITE, shoe=WOOD,
         shirt=CREAM, tie=BRASS, buttons=BRASS, lapel=GREEN),
    dict(name="dealer", head="skaterMaleA", coat=OXBLOOD, sleeve=CREAM, trouser=GRAPHITE, shoe=WOOD,
         shirt=CREAM, tie=GRAPHITE, buttons=BRASS, lapel=OXBLOOD_D, hair=(38, 32, 30)),
    dict(name="player", head="skaterFemaleA", coat=CAMEL, sleeve=CAMEL, trouser=NAVY, shoe=WOOD_D,
         shirt=CREAM, tie=NAVY_D, buttons=CAMEL_D, lapel=CAMEL_D),
]


# ----------------------------------------------------------------------------- glb reading

def read_glb(path: str) -> dict:
    blob = open(path, "rb").read()
    n = struct.unpack("<I", blob[12:16])[0]
    doc = json.loads(blob[20:20 + n])
    body = blob[20 + n + 8:]

    def accessor(index: int):
        acc = doc["accessors"][index]
        view = doc["bufferViews"][acc["bufferView"]]
        kind = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
        fmt, size = kind[acc["componentType"]]
        parts = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        stride = view.get("byteStride") or size * parts
        out = []
        for i in range(acc["count"]):
            off = start + i * stride
            out.append(struct.unpack_from("<" + fmt * parts, body, off))
        return out

    prim = doc["meshes"][0]["primitives"][0]
    joints = [doc["nodes"][j].get("name", str(j)) for j in doc["skins"][0]["joints"]]
    return {
        "pos": accessor(prim["attributes"]["POSITION"]),
        "nrm": accessor(prim["attributes"]["NORMAL"]),
        "uv": accessor(prim["attributes"]["TEXCOORD_0"]),
        "bone": accessor(prim["attributes"]["JOINTS_0"]),
        "weight": accessor(prim["attributes"]["WEIGHTS_0"]),
        "index": [i[0] for i in accessor(prim["indices"])],
        "joints": joints,
    }


def triangles(mesh: dict) -> list:
    """(region, uv triple, mean height, mean forward-facing) per triangle."""
    out = []
    idx = mesh["index"]
    for t in range(0, len(idx), 3):
        tri = idx[t:t + 3]
        weights = {}
        for v in tri:
            for b, w in zip(mesh["bone"][v], mesh["weight"][v]):
                if w > 0.0:
                    weights[mesh["joints"][b]] = weights.get(mesh["joints"][b], 0.0) + w
        bone = max(weights, key=weights.get)
        region = REGION.get(bone, "coat")
        y = sum(mesh["pos"][v][1] for v in tri) / 3.0
        if region == "belt":
            region = "coat" if y > BELT_Y else "trouser"
        out.append({
            "region": region,
            "bone": bone,
            "uv": [(mesh["uv"][v][0] * SOURCE, mesh["uv"][v][1] * SOURCE) for v in tri],
            "y": y,
            "front": sum(mesh["nrm"][v][2] for v in tri) / 3.0,
        })
    return out


# ----------------------------------------------------------------------------- painting

def shade(color, amount: float):
    """Kenney's skins carry a soft top-lit gradient; keep that read instead of a dead flat fill."""
    return tuple(max(0, min(255, int(c * amount))) for c in color)


def recolor_hair(img: Image.Image, mask: Image.Image, target) -> None:
    """Swap a kept head's hair field for `target`, so a face reused across two roles still reads as two people."""
    pixels = img.load()
    keep = mask.load()
    counts = {}
    for y in range(0, SOURCE, 3):
        for x in range(0, SOURCE, 3):
            if keep[x, y]:
                c = pixels[x, y][:3]
                if (c[0] * 0.3 + c[1] * 0.6 + c[2] * 0.1) < 120:      # hair is the dark field behind the face
                    counts[c] = counts.get(c, 0) + 1
    if not counts:
        return
    hair = max(counts, key=counts.get)
    base = max(1, sum(hair) / 3.0)
    for y in range(SOURCE):
        for x in range(SOURCE):
            if not keep[x, y]:
                continue
            c = pixels[x, y]
            if all(abs(c[i] - hair[i]) < 26 for i in range(3)):
                lift = (sum(c[:3]) / 3.0) / base
                pixels[x, y] = shade(target, lift) + (c[3],) if len(c) == 4 else shade(target, lift)


def skin_tone(src: Image.Image, tris: list):
    """This skin's flesh colour, read off the middle of its neck island — the one patch that is always skin."""
    neck = [t for t in tris if t["bone"] == "Neck"]
    if not neck:
        return (240, 170, 140)
    x = sum(p[0] for t in neck for p in t["uv"]) / (3.0 * len(neck))
    y = sum(p[1] for t in neck for p in t["uv"]) / (3.0 * len(neck))
    return src.convert("RGB").getpixel((min(SOURCE - 1, int(x)), min(SOURCE - 1, int(y))))


def paint(role: dict, tris: list, skins: dict) -> Image.Image:
    src = skins[role["head"]].convert("RGBA")
    role = dict(role, skin=skin_tone(src, tris))
    img = Image.new("RGBA", (SOURCE, SOURCE), shade(role["coat"], 0.9))   # unmapped texels: keep mips in-family
    draw = ImageDraw.Draw(img)

    ys = [t["y"] for t in tris]
    low, high = min(ys), max(ys)
    for t in sorted(tris, key=lambda t: t["y"]):
        if t["region"] == "keep":
            continue
        color = role[t["region"]] if t["region"] in role else role["coat"]
        lift = 0.90 + 0.16 * ((t["y"] - low) / max(0.01, high - low))      # top-lit
        if t["front"] < -0.35:
            lift *= 0.94                                                    # the back reads a touch darker
        draw.polygon(t["uv"], fill=shade(color, lift))

    # the chest panel: collar, shirt V, tie and buttons, placed on the run of forward-facing torso triangles
    front = [t for t in tris if t["bone"] in ("Spine", "Chest", "UpperChest") and t["front"] > 0.3]
    if front:
        xs = [p[0] for t in front for p in t["uv"]]
        vs = [p[1] for t in front for p in t["uv"]]
        x0, x1, v0, v1 = min(xs), max(xs), min(vs), max(vs)
        w, h = x1 - x0, v1 - v0
        mid = (x0 + x1) / 2.0
        draw.polygon([(mid - w * 0.20, v0), (mid + w * 0.20, v0), (mid, v0 + h * 0.42)],
                     fill=shade(role["shirt"], 1.0))                        # open collar / shirt front
        draw.polygon([(mid - w * 0.30, v0), (mid - w * 0.06, v0 + h * 0.30), (mid - w * 0.30, v0 + h * 0.46)],
                     fill=shade(role["lapel"], 1.02))                       # lapels
        draw.polygon([(mid + w * 0.30, v0), (mid + w * 0.06, v0 + h * 0.30), (mid + w * 0.30, v0 + h * 0.46)],
                     fill=shade(role["lapel"], 1.02))
        draw.polygon([(mid - w * 0.055, v0 + h * 0.06), (mid + w * 0.055, v0 + h * 0.06),
                      (mid + w * 0.035, v0 + h * 0.40), (mid, v0 + h * 0.46), (mid - w * 0.035, v0 + h * 0.40)],
                     fill=shade(role["tie"], 1.0))                          # tie
        r = w * 0.022
        for i in range(3):
            cy = v0 + h * (0.52 + 0.13 * i)
            draw.ellipse([mid - w * 0.11 - r, cy - r, mid - w * 0.11 + r, cy + r], fill=shade(role["buttons"], 1.05))

    # keep Kenney's head / neck / hands: rasterise those triangles as a mask and copy the source pixels back
    mask = Image.new("L", (SOURCE, SOURCE), 0)
    mdraw = ImageDraw.Draw(mask)
    for t in tris:
        if t["region"] == "keep":
            mdraw.polygon(t["uv"], fill=255)
    mask = mask.filter(ImageFilter.MaxFilter(5))        # grow 2 px so filtering never samples repainted cloth
    head = src.copy()
    if role.get("hair"):
        recolor_hair(head, mask, role["hair"])
    img.paste(head, (0, 0), mask)
    return img


def main() -> None:
    packs, glb, out = sys.argv[1], sys.argv[2], sys.argv[3]
    skins = {}
    for pack in packs.split(","):
        folder = os.path.join(pack, "Skins")
        for file in os.listdir(folder):
            if file.lower().endswith(".png"):
                skins[os.path.splitext(file)[0]] = Image.open(os.path.join(folder, file))
    mesh = read_glb(glb)
    tris = triangles(mesh)
    counts = {}
    for t in tris:
        counts[t["region"]] = counts.get(t["region"], 0) + 1
    print("triangles %d by region: %s" % (len(tris), counts))

    atlas = Image.new("RGBA", (ATLAS, ATLAS), (0, 0, 0, 0))
    for i, role in enumerate(ROLES):
        tile = paint(role, tris, skins).resize((TILE, TILE), Image.LANCZOS)
        col, row = i % 3, i // 3
        atlas.paste(tile, (col * STRIDE, row * STRIDE))
        print("  tile %d,%d  %-12s head %s" % (col, row, role["name"], role["head"]))
    atlas.convert("RGB").save(out)
    print("WROTE", out, os.path.getsize(out), "B", atlas.size)


main()
