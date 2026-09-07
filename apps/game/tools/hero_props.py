"""Branch Zero hero props - generated with Blender 4.5 (headless), exported as glTF 2.0 .glb, +Y up, 1 unit = 1 m.

    "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b -P apps/game/tools/hero_props.py -- apps/game/assets/models/hero

Everything here is ours (docs/WORLD-3D-ENVIRONMENT.md section 5: "Custom hero props: vault door, counters, split-flap
board, ... stamp, printer"). Materials are named after the bank palette (Marble, MarbleDark, Brass, Wood, Graphite,
Steel, Glass, LED, Bulb, Cream, Paper); scripts/props.gd swaps them for the WingTheme materials at load time, so the
.glb carries shape only. Coordinates below are written in Godot terms (x east, y up, z south) and converted for
Blender. No textures, no UVs - flat colours + bevels, the stylised low-poly look from WORLD-3D section 1.
"""
import bpy, math, os, sys

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)

PALETTE = {
    "Marble":     dict(rgb=(0.93, 0.90, 0.84)),
    "MarbleDark": dict(rgb=(0.16, 0.36, 0.28)),
    "Brass":      dict(rgb=(0.78, 0.62, 0.30), metallic=0.8, rough=0.35),
    "Wood":       dict(rgb=(0.45, 0.30, 0.18)),
    "Graphite":   dict(rgb=(0.26, 0.28, 0.32)),
    "Steel":      dict(rgb=(0.55, 0.57, 0.62), metallic=0.7, rough=0.35),
    "Glass":      dict(rgb=(0.70, 0.85, 0.95), alpha=0.28),
    "LED":        dict(rgb=(0.2, 0.2, 0.2), emit=(0.2, 0.2, 0.2), strength=0.0),
    "Bulb":       dict(rgb=(1.0, 0.95, 0.80), emit=(1.0, 0.92, 0.7), strength=2.0),
    "Cream":      dict(rgb=(0.86, 0.80, 0.70)),
    "Paper":      dict(rgb=(0.97, 0.96, 0.92)),
}
MATS = {}


def mat(name):
    if name in MATS:
        return MATS[name]
    spec = PALETTE[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*spec["rgb"], 1.0)
    bsdf.inputs["Metallic"].default_value = spec.get("metallic", 0.0)
    bsdf.inputs["Roughness"].default_value = spec.get("rough", 0.85)
    if "alpha" in spec:
        bsdf.inputs["Alpha"].default_value = spec["alpha"]
        for attr, val in (("blend_method", "BLEND"), ("surface_render_method", "BLENDED")):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    if "emit" in spec:
        bsdf.inputs["Emission Color"].default_value = (*spec["emit"], 1.0)
        bsdf.inputs["Emission Strength"].default_value = spec.get("strength", 1.0)
    MATS[name] = m
    return m


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for d in list(bpy.data.meshes):
        if d.users == 0:
            bpy.data.meshes.remove(d)


def _finish(o, name, m, bevel):
    o.name = name
    o.data.name = name
    o.data.materials.append(mat(m))
    if bevel > 0:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 2
        b.limit_method = "ANGLE"
    return o


def gloc(g):
    """godot (x, y, z) -> blender (x, -z, y)"""
    return (g[0], -g[2], g[1])


def box(name, gpos, gsize, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=gloc(gpos))
    o = bpy.context.active_object
    o.scale = (gsize[0], gsize[2], gsize[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler = rot
    return _finish(o, name, m, bevel)


def cyl(name, gpos, r, h, m, axis="y", verts=32, bevel=0.0, r2=None, fill="NGON"):
    rot = {"y": (0, 0, 0), "z": (math.radians(90), 0, 0), "x": (0, math.radians(90), 0)}[axis]
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=gloc(gpos), rotation=rot, end_fill_type=fill)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=gloc(gpos), rotation=rot, end_fill_type=fill)
    return _finish(bpy.context.active_object, name, m, bevel)


def torus(name, gpos, major, minor, m, axis="y", segs=32):
    rot = {"y": (0, 0, 0), "z": (math.radians(90), 0, 0)}[axis]
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=gloc(gpos), rotation=rot, major_segments=segs, minor_segments=8)
    return _finish(bpy.context.active_object, name, m, 0.0)


def sphere(name, gpos, r, m):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=8, location=gloc(gpos))
    return _finish(bpy.context.active_object, name, m, 0.0)


def join(objs, name, origin_zero=True):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")  # applies modifiers on every selected object
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    if origin_zero:
        bpy.context.scene.cursor.location = (0, 0, 0)
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return o


def export(objs, fname):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    path = os.path.join(OUT, fname)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_texcoords=False, export_normals=True, export_materials="EXPORT", export_image_format="NONE",
        export_animations=False, export_skins=False, export_morph=False, export_lights=False, export_cameras=False,
        export_extras=False,
    )
    faces = sum(len(o.data.polygons) for o in objs)
    print("  wrote %s: %d node(s), ~%d faces, %d bytes" % (fname, len(objs), faces, os.path.getsize(path)))


# ---------------------------------------------------------------- vault (WORLD-3D 2.1: circular door with bolts, LED strip on the frame)

# Door geometry shared with scripts/vault_door.gd: DOOR_R (disc radius), DOOR_CY (disc centre height), the clock
# plate sits above the swing (door top = DOOR_CY + DOOR_R) so "OPEN" stays readable while the door stands 30° ajar.
DOOR_R = 1.6
DOOR_CY = 1.75
CLOCK_Y = 3.62


def vault_frame():
    clear()
    parts = [
        box("PillarW", (-2.1, 2.075, 0.0), (0.35, 4.15, 0.35), "Graphite", 0.03),
        box("PillarE", (2.1, 2.075, 0.0), (0.35, 4.15, 0.35), "Graphite", 0.03),
        box("Lintel", (0.0, 4.15, 0.0), (4.55, 0.35, 0.35), "Graphite", 0.03),
        box("Threshold", (0.0, 0.03, 0.05), (4.2, 0.06, 0.5), "Steel", 0.01),
        cyl("Mouth", (0.0, DOOR_CY, -0.02), DOOR_R + 0.2, 0.06, "Graphite", axis="z", verts=40),
        torus("Liner", (0.0, DOOR_CY, 0.04), DOOR_R + 0.11, 0.07, "Steel", axis="z", segs=40),
        box("ClockPlate", (0.0, CLOCK_Y, 0.57), (1.7, 0.62, 0.08), "Graphite", 0.02),
        box("ClockPlateTrim", (0.0, CLOCK_Y, 0.545), (1.82, 0.74, 0.02), "Brass", 0.0),   # brass border behind the plate
    ]
    frame = join(parts, "Frame")
    leds = [
        box("LedW", (-2.1, 2.075, 0.2), (0.2, 4.05, 0.06), "LED"),
        box("LedE", (2.1, 2.075, 0.2), (0.2, 4.05, 0.06), "LED"),
        box("LedTop", (0.0, 4.15, 0.2), (4.3, 0.2, 0.06), "LED"),
    ]
    led = join(leds, "LedStrip")
    export([frame, led], "prop_vault_frame.glb")


def vault_door():
    clear()
    r = DOOR_R
    hx = -(r + 0.1)
    parts = [
        cyl("Disc", (0.0, 0.0, 0.0), r, 0.35, "Steel", axis="z", verts=48, bevel=0.04),
        torus("RimRing", (0.0, 0.0, 0.18), r - 0.22, 0.035, "Brass", axis="z", segs=48),
        torus("InnerRing", (0.0, 0.0, 0.18), r * 0.55, 0.03, "Brass", axis="z", segs=40),
        torus("Wheel", (0.0, 0.0, 0.34), 0.5, 0.045, "Brass", axis="z", segs=32),
        cyl("Hub", (0.0, 0.0, 0.30), 0.16, 0.22, "Brass", axis="z", verts=24),
        cyl("HingeTop", (hx, 1.0, 0.0), 0.10, 0.55, "Steel", axis="y", verts=16),
        cyl("HingeBottom", (hx, -1.0, 0.0), 0.10, 0.55, "Steel", axis="y", verts=16),
        box("HingeArmTop", (hx + 0.3, 1.0, 0.0), (0.7, 0.16, 0.16), "Steel", 0.02),
        box("HingeArmBottom", (hx + 0.3, -1.0, 0.0), (0.7, 0.16, 0.16), "Steel", 0.02),
    ]
    for i in range(4):
        a = i * math.pi / 4.0
        parts.append(box("Spoke%d" % i, (0.0, 0.0, 0.34), (0.98, 0.06, 0.05), "Brass", 0.0, rot=(0, -a, 0)))
    door = join(parts, "Door")
    bolts = []
    for i in range(6):
        a = i * math.tau / 6.0
        # a radial locking bar; scripts/vault_door.gd slides it along (cos a, sin a, 0)
        b = cyl("Bolt%d" % i, (math.cos(a) * r, math.sin(a) * r, 0.0), 0.09, 0.42, "Brass", axis="y", verts=12)
        b.rotation_euler = (0.0, math.radians(90) - a, 0.0)
        bolts.append(b)
    export([door] + bolts, "prop_vault_door.glb")


# ---------------------------------------------------------------- counter (WORLD-3D 2.1: 1.1 m marble counter, glass partition with slot)

def counter():
    clear()
    L = 3.6
    parts = [
        box("Plinth", (0, 0.06, 0.0), (L, 0.12, 0.9), "MarbleDark", 0.01),
        box("Body", (0, 0.55, 0.0), (L, 0.86, 0.86), "Marble", 0.02),
        box("Top", (0, 1.06, 0.0), (L + 0.1, 0.08, 1.0), "MarbleDark", 0.02),
        cyl("FootRail", (0, 0.25, 0.48), 0.03, L - 0.2, "Brass", axis="x", verts=12),
        box("Tray", (0, 1.12, 0.05), (0.8, 0.04, 0.3), "Graphite", 0.005),
        box("TrayLipN", (0, 1.15, -0.09), (0.8, 0.03, 0.02), "Brass"),
        box("TrayLipS", (0, 1.15, 0.19), (0.8, 0.03, 0.02), "Brass"),
        box("GlassRail", (0, 2.71, 0.0), (L, 0.05, 0.07), "Brass", 0.01),
        box("GlassPostW", (-L / 2 + 0.02, 1.9, 0.0), (0.06, 1.6, 0.07), "Brass"),
        box("GlassPostE", (L / 2 - 0.02, 1.9, 0.0), (0.06, 1.6, 0.07), "Brass"),
        box("GlassLipTray", (0, 1.4, 0.0), (0.84, 0.03, 0.06), "Brass"),
    ]
    for x in (-1.2, 0.0, 1.2):
        parts.append(box("Flute%s" % x, (x, 0.55, 0.44), (0.04, 0.72, 0.02), "Brass"))
    body = join(parts, "Counter")
    glass = join([
        box("PaneW", (-1.1, 1.9, 0.0), (1.4, 1.6, 0.04), "Glass"),
        box("PaneE", (1.1, 1.9, 0.0), (1.4, 1.6, 0.04), "Glass"),
        box("PaneMid", (0.0, 2.05, 0.0), (0.8, 1.3, 0.04), "Glass"),
    ], "Glass")
    export([body, glass], "prop_counter.glb")


# ---------------------------------------------------------------- boards (split-flap housing; the rows are a SubViewport quad in Godot)

def board_frame(fname, w, h, depth):
    clear()
    t = 0.25
    parts = [
        box("Top", (0, h / 2 - t / 2, -depth / 2), (w, t, depth), "Graphite", 0.03),
        box("Bottom", (0, -h / 2 + t / 2, -depth / 2), (w, t, depth), "Graphite", 0.03),
        box("Left", (-w / 2 + t / 2, 0, -depth / 2), (t, h - 2 * t, depth), "Graphite", 0.03),
        box("Right", (w / 2 - t / 2, 0, -depth / 2), (t, h - 2 * t, depth), "Graphite", 0.03),
        box("Back", (0, 0, -depth + 0.03), (w - 2 * t + 0.02, h - 2 * t + 0.02, 0.06), "Graphite"),
        box("TrimTop", (0, h / 2 - t, -0.02), (w - 2 * t, 0.03, 0.04), "Brass"),
        box("TrimBottom", (0, -h / 2 + t, -0.02), (w - 2 * t, 0.03, 0.04), "Brass"),
        box("TrimLeft", (-w / 2 + t, 0, -0.02), (0.03, h - 2 * t, 0.04), "Brass"),
        box("TrimRight", (w / 2 - t, 0, -0.02), (0.03, h - 2 * t, 0.04), "Brass"),
        box("Cornice", (0, h / 2 + 0.04, -depth / 2), (w + 0.2, 0.08, depth + 0.1), "Brass", 0.02),
    ]
    export([join(parts, "Frame")], fname)


# ---------------------------------------------------------------- desk-top props

def engraver():
    clear()
    parts = [
        box("Base", (0, 0.04, 0), (0.5, 0.08, 0.36), "Graphite", 0.01),
        box("Bed", (0, 0.09, 0.02), (0.3, 0.02, 0.2), "Steel"),
        box("Plate", (0, 0.105, 0.02), (0.2, 0.01, 0.07), "Brass"),
        box("PostW", (-0.2, 0.23, -0.1), (0.04, 0.3, 0.04), "Brass"),
        box("PostE", (0.2, 0.23, -0.1), (0.04, 0.3, 0.04), "Brass"),
        box("Bar", (0, 0.37, -0.1), (0.48, 0.04, 0.04), "Brass", 0.005),
        box("Head", (0.05, 0.3, -0.06), (0.08, 0.12, 0.1), "Graphite", 0.01),
        cyl("Bit", (0.05, 0.2, -0.02), 0.008, 0.1, "Steel", verts=8),
        box("Panel", (0.18, 0.09, 0.15), (0.1, 0.02, 0.04), "Steel"),
        sphere("Knob", (0.16, 0.115, 0.15), 0.012, "Brass"),
        sphere("Knob2", (0.20, 0.115, 0.15), 0.012, "Brass"),
    ]
    export([join(parts, "Engraver")], "prop_engraver.glb")


def printer():
    clear()
    paper = box("Paper", (0, 0.36, -0.12), (0.3, 0.26, 0.01), "Paper")
    paper.rotation_euler = (math.radians(-20), 0, 0)
    parts = [
        box("Body", (0, 0.11, 0), (0.5, 0.22, 0.42), "Graphite", 0.02),
        box("Lid", (0, 0.24, -0.06), (0.46, 0.04, 0.24), "Steel", 0.01),
        box("Slot", (0, 0.235, 0.1), (0.36, 0.02, 0.03), "Paper"),
        paper,
        box("Feed", (0, 0.05, 0.215), (0.3, 0.12, 0.01), "Paper"),
        box("Btn1", (-0.16, 0.225, 0.14), (0.04, 0.015, 0.03), "Brass"),
        box("Btn2", (-0.10, 0.225, 0.14), (0.04, 0.015, 0.03), "Brass"),
    ]
    export([join(parts, "Printer")], "prop_printer.glb")


def stamp():
    clear()
    parts = [
        box("Base", (0, 0.025, 0), (0.24, 0.05, 0.24), "Graphite", 0.01),
        cyl("Handle", (0, 0.11, 0), 0.035, 0.12, "Wood", verts=16),
        sphere("Knob", (0, 0.19, 0), 0.045, "Brass"),
    ]
    export([join(parts, "Stamp")], "prop_stamp.glb")


def shredder():
    clear()
    parts = [
        box("Basket", (0, 0.3, 0), (0.56, 0.6, 0.44), "Graphite", 0.02),
        box("Window", (0, 0.32, 0.221), (0.4, 0.3, 0.01), "Glass"),
        box("Head", (0, 0.71, 0), (0.6, 0.22, 0.5), "Steel", 0.02),
        box("Slot", (0, 0.825, 0), (0.42, 0.02, 0.05), "Graphite"),
        box("Rim", (0, 0.822, 0), (0.46, 0.012, 0.08), "Brass"),
        box("Strip", (0, 0.9, 0), (0.25, 0.15, 0.005), "Paper"),
    ]
    export([join(parts, "Shredder")], "prop_shredder.glb")


def pendant_lamp():
    clear()
    # short cord: the third-person camera rides at ~3.4 m, the shade must stay above it
    shade = cyl("Shade", (0, -0.76, 0), 0.42, 0.32, "Brass", verts=24, r2=0.1, fill="NOTHING")
    s = shade.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = 0.02
    parts = [
        cyl("Cord", (0, -0.3, 0), 0.012, 0.6, "Graphite", verts=8),
        cyl("Canopy", (0, -0.015, 0), 0.08, 0.03, "Brass", verts=16),
        shade,
    ]
    lamp = join(parts, "Lamp")
    bulb = sphere("Bulb", (0, -0.8, 0), 0.075, "Bulb")
    export([lamp, bulb], "prop_pendant_lamp.glb")


def water_cooler():
    clear()
    parts = [
        box("Base", (0, 0.475, 0), (0.36, 0.95, 0.36), "Cream", 0.02),
        box("Panel", (0, 0.6, 0.185), (0.3, 0.25, 0.02), "Graphite"),
        box("Tap", (-0.06, 0.78, 0.2), (0.03, 0.04, 0.06), "Brass"),
        box("Tap2", (0.06, 0.78, 0.2), (0.03, 0.04, 0.06), "Brass"),
        cyl("Neck", (0, 0.98, 0), 0.06, 0.06, "Glass", verts=16),
        cyl("Bottle", (0, 1.19, 0), 0.16, 0.42, "Glass", verts=20, bevel=0.03),
    ]
    export([join(parts, "Cooler")], "prop_water_cooler.glb")


def rope_post():
    clear()
    parts = [
        cyl("Foot", (0, 0.015, 0), 0.15, 0.03, "Brass", verts=20),
        cyl("Pole", (0, 0.47, 0), 0.02, 0.9, "Brass", verts=12),
        sphere("Ball", (0, 0.95, 0), 0.05, "Brass"),
        torus("Ring", (0, 0.86, 0), 0.045, 0.01, "Brass", axis="y", segs=16),
    ]
    export([join(parts, "Post")], "prop_rope_post.glb")


def elevator_panel():
    clear()
    parts = [
        box("Plate", (0, 0, 0), (0.18, 0.3, 0.02), "Brass", 0.005),
        cyl("BtnMain", (0, 0.06, 0.015), 0.03, 0.01, "Graphite", axis="z", verts=16),
        cyl("BtnArc", (0, -0.06, 0.015), 0.03, 0.01, "Graphite", axis="z", verts=16),
    ]
    export([join(parts, "Panel")], "prop_elevator_panel.glb")


for fn in (vault_frame, vault_door, counter, engraver, printer, stamp, shredder, pendant_lamp, water_cooler, rope_post, elevator_panel):
    print("prop:", fn.__name__)
    fn()
board_frame("prop_board_frame.glb", 8.6, 2.6, 0.28)
board_frame("prop_names_board_frame.glb", 2.8, 1.7, 0.2)
print("done")
