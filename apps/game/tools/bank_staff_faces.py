"""Branch Zero face sheet — eight original flat vector faces × five expression states.

    python apps/game/tools/bank_staff_faces.py [out.png]

The sheet is deliberately small and boring to render: 8 columns × 5 rows, 64 px cells, 512 × 320 RGBA. Each cell
is an original derivative drawing in the same flat graphic language as the CC0 Kenney base, with an inset border so
linear filtering never samples a neighbour. Godot uses the cell index as a per-instance shader uniform on one shared
face material; there is no blendshape, face rig, per-NPC material, or outline pass on this carrier.

The face art is authored by D9 Studio for Branch Zero and carries no third-party pixels. The base rig and atlas remain
the CC0 Kenney-derived assets credited in CREDITS.md.
"""

import os
import sys

from PIL import Image, ImageDraw


CELL = 64
COLS = 8
ROWS = 5
OUT = (CELL * COLS, CELL * ROWS)
STATES = ("neutral", "smile", "talk", "concern", "surprised")
INK = (31, 27, 32, 255)
SKIN_OUTLINE = (82, 52, 48, 255)
CHEEK = (222, 114, 106, 230)
EYE_WHITE = (255, 252, 239, 255)
EYE_HIGHLIGHT = (255, 255, 255, 255)
MOUTH_INNER = (74, 37, 45, 255)
TONGUE = (224, 106, 106, 255)


FACES = [
    dict(name="mo", skin=(208, 137, 103, 255), hair=(47, 35, 32, 255), style="round", eye=(47, 65, 82, 255), jaw=1.08, glasses=False),
    dict(name="ines", skin=(183, 119, 91, 255), hair=(119, 57, 39, 255), style="up", eye=(64, 87, 87, 255), jaw=.96, glasses="cat"),
    dict(name="dev", skin=(152, 91, 70, 255), hair=(34, 38, 45, 255), style="crop", eye=(42, 56, 68, 255), jaw=.98, glasses=False),
    dict(name="bob", skin=(214, 151, 116, 255), hair=(58, 43, 39, 255), style="receding", eye=(72, 57, 46, 255), jaw=1.04, moustache=True, glasses=False),
    dict(name="okafor", skin=(102, 64, 54, 255), hair=(164, 164, 154, 255), style="temples", eye=(48, 58, 67, 255), jaw=1.02, glasses="round", heavy_brows=True),
    dict(name="petra", skin=(236, 174, 136, 255), hair=(72, 43, 36, 255), style="bun", eye=(68, 60, 82, 255), jaw=.92, glasses="cat"),
    dict(name="kenji", skin=(190, 119, 85, 255), hair=(42, 33, 31, 255), style="slick", eye=(53, 79, 83, 255), jaw=1.00, glasses=False),
    dict(name="player", skin=(224, 158, 124, 255), hair=(74, 58, 52, 255), style="bob", eye=(54, 70, 94, 255), jaw=.98, glasses=False),
]


def box(cx: float, cy: float, rx: float, ry: float):
    return (int(cx - rx), int(cy - ry), int(cx + rx), int(cy + ry))


def curve(draw: ImageDraw.ImageDraw, points, fill, width=2):
    draw.line([(int(x), int(y)) for x, y in points], fill=fill, width=width, joint="curve")


def hair(draw: ImageDraw.ImageDraw, face: dict) -> None:
    c = face["hair"]
    dark = tuple(max(0, int(v * .70)) for v in c[:3]) + (255,)
    if face["style"] == "round":
        draw.ellipse(box(32, 21, 24, 20), fill=c, outline=INK, width=2)
        draw.polygon([(9, 25), (16, 17), (26, 21), (37, 18), (53, 24), (55, 30), (9, 30)], fill=dark)
    elif face["style"] in ("up", "bun"):
        draw.ellipse(box(43, 9, 9, 8), fill=dark, outline=INK, width=2)
        draw.ellipse(box(32, 20, 23, 19), fill=c, outline=INK, width=2)
        draw.polygon([(10, 27), (18, 17), (29, 19), (39, 16), (54, 25), (52, 31), (11, 31)], fill=c)
    elif face["style"] == "crop":
        draw.rounded_rectangle((9, 10, 55, 29), radius=10, fill=c, outline=INK, width=2)
        draw.polygon([(10, 24), (19, 18), (27, 25), (36, 18), (45, 24), (54, 19), (55, 30), (9, 30)], fill=dark)
    elif face["style"] == "receding":
        draw.ellipse(box(32, 17, 17, 11), fill=c, outline=INK, width=2)
        draw.rectangle((10, 19, 18, 31), fill=dark)
        draw.rectangle((46, 19, 54, 31), fill=dark)
    elif face["style"] == "temples":
        draw.arc((9, 6, 55, 33), 190, 350, fill=c, width=5)
        draw.rectangle((10, 20, 19, 32), fill=c)
        draw.rectangle((45, 20, 54, 32), fill=c)
    elif face["style"] == "slick":
        draw.polygon([(8, 25), (14, 11), (52, 13), (56, 23), (46, 26), (22, 21), (10, 31)], fill=c, outline=INK)
        draw.line((24, 11, 19, 27), fill=dark, width=2)
    elif face["style"] == "bob":
        draw.ellipse(box(32, 20, 24, 19), fill=c, outline=INK, width=2)
        draw.rounded_rectangle((8, 25, 18, 46), radius=5, fill=dark)
        draw.rounded_rectangle((46, 25, 56, 46), radius=5, fill=dark)


def draw_glasses(draw: ImageDraw.ImageDraw, kind: str, eye_y: int) -> None:
    if kind == "cat":
        draw.line((12, eye_y - 5, 25, eye_y - 7, 30, eye_y - 4), fill=INK, width=2)
        draw.line((34, eye_y - 4, 39, eye_y - 7, 52, eye_y - 5), fill=INK, width=2)
        draw.arc((12, eye_y - 6, 29, eye_y + 7), 0, 180, fill=INK, width=2)
        draw.arc((35, eye_y - 6, 52, eye_y + 7), 0, 180, fill=INK, width=2)
    else:
        draw.ellipse((12, eye_y - 7, 29, eye_y + 7), outline=INK, width=2)
        draw.ellipse((35, eye_y - 7, 52, eye_y + 7), outline=INK, width=2)
        draw.line((29, eye_y - 1, 35, eye_y - 1), fill=INK, width=2)


def draw_mouth(draw: ImageDraw.ImageDraw, state: str, y: int) -> None:
    if state == "neutral":
        curve(draw, [(24, y), (32, y + 1), (40, y)], INK, 2)
    elif state == "smile":
        curve(draw, [(22, y - 2), (27, y + 3), (32, y + 4), (37, y + 3), (42, y - 2)], INK, 3)
        draw.arc((26, y - 1, 38, y + 7), 0, 180, fill=(238, 146, 132, 255), width=2)
    elif state == "talk":
        draw.ellipse(box(32, y + 2, 8, 6), fill=MOUTH_INNER, outline=INK, width=2)
        draw.arc((27, y + 1, 37, y + 8), 0, 180, fill=TONGUE, width=2)
    elif state == "concern":
        curve(draw, [(22, y + 3), (27, y - 1), (32, y - 2), (37, y - 1), (42, y + 3)], INK, 3)
    else:
        draw.ellipse(box(32, y + 2, 7, 9), fill=MOUTH_INNER, outline=INK, width=2)


def draw_face(cell: Image.Image, face: dict, state: str) -> None:
    draw = ImageDraw.Draw(cell)
    skin = face["skin"]
    hair(draw, face)
    # A slightly asymmetric jaw is enough to keep the eight portraits from becoming a cloned icon set.
    jaw = float(face.get("jaw", 1.0))
    head = box(32, 37, 22 * jaw, 23)
    draw.ellipse(head, fill=skin, outline=SKIN_OUTLINE, width=2)
    # Fringe is redrawn over the forehead so the hair cut remains graphic after the face fill.
    if face["style"] in ("round", "up", "bun", "crop", "slick", "bob"):
        c = face["hair"]
        draw.polygon([(10, 28), (17, 20), (27, 24), (34, 18), (46, 23), (54, 27), (50, 33), (42, 28), (30, 33), (20, 28), (13, 34)], fill=c)
    elif face["style"] == "temples":
        draw.rectangle((10, 25, 17, 33), fill=face["hair"])
        draw.rectangle((47, 25, 54, 33), fill=face["hair"])
    elif face["style"] == "receding":
        draw.rectangle((10, 26, 17, 34), fill=face["hair"])
        draw.rectangle((47, 26, 54, 34), fill=face["hair"])

    eye_y = 36
    eye_rx, eye_ry = (8, 9) if state == "surprised" else (7, 8)
    for x in (23, 41):
        draw.ellipse(box(x, eye_y, eye_rx, eye_ry), fill=EYE_WHITE, outline=INK, width=2)
        pupil = face["eye"]
        draw.ellipse(box(x, eye_y + 1, 3.0, 4.5), fill=pupil)
        draw.ellipse(box(x - 1.1, eye_y - 1.4, 1.2, 1.5), fill=EYE_HIGHLIGHT)

    brow_y = 25
    if state == "concern":
        curve(draw, [(17, brow_y + 3), (23, brow_y - 1), (28, brow_y + 1)], INK, 3)
        curve(draw, [(36, brow_y + 1), (41, brow_y - 1), (47, brow_y + 3)], INK, 3)
    elif state == "surprised":
        curve(draw, [(17, brow_y - 3), (23, brow_y - 5), (28, brow_y - 3)], INK, 3)
        curve(draw, [(36, brow_y - 3), (41, brow_y - 5), (47, brow_y - 3)], INK, 3)
    elif face.get("heavy_brows"):
        draw.line((17, brow_y, 28, brow_y - 1), fill=INK, width=4)
        draw.line((36, brow_y - 1, 47, brow_y), fill=INK, width=4)
    else:
        draw.line((17, brow_y, 28, brow_y - 1), fill=INK, width=2)
        draw.line((36, brow_y - 1, 47, brow_y), fill=INK, width=2)

    draw.ellipse(box(15, 48, 2.2, 2.2), fill=CHEEK)
    draw.ellipse(box(49, 48, 2.2, 2.2), fill=CHEEK)
    if face.get("moustache"):
        draw.polygon([(26, 45), (31, 47), (32, 44), (33, 47), (38, 45), (36, 50), (28, 50)], fill=INK)
    draw_mouth(draw, state, 50)
    if face.get("glasses"):
        draw_glasses(draw, face["glasses"], eye_y)


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        "apps", "game", "assets", "characters", "kenney_staff", "Textures", "face_sheet.png"
    )
    sheet = Image.new("RGBA", OUT, (0, 0, 0, 0))
    for row, state in enumerate(STATES):
        for col, face in enumerate(FACES):
            cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            draw_face(cell, face, state)
            sheet.alpha_composite(cell, (col * CELL, row * CELL))
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    sheet.save(out, "PNG", optimize=True)
    print("WROTE", out, os.path.getsize(out), "B", sheet.size, "faces", len(FACES), "states", len(STATES))


if __name__ == "__main__":
    main()
