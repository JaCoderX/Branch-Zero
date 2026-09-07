"""Branch Zero hero props - generated with Blender 4.5 (headless), exported as glTF 2.0 .glb, +Y up, 1 unit = 1 m.

    "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b -P apps/game/tools/hero_props.py -- apps/game/assets/models/hero [prop ...]

Everything here is ours (docs/WORLD-3D-ENVIRONMENT.md section 5: "Custom hero props: vault door, counters, split-flap
board, ... stamp, printer"). Materials are named after the bank palette (Marble, MarbleDark, Brass, BrassDark, Wood,
Graphite, Steel, SteelDark, Glass, LED, Bulb, Cream, Paper); scripts/props.gd swaps them for the WingTheme materials at
load time, so the .glb carries shape only. Coordinates below are written in Godot terms (x east, y up, z south = the
prop's front) and converted for Blender. No textures, no UVs - flat colours + bevels, the stylised low-poly look from
WORLD-3D section 1. Optional trailing arguments regenerate only the named props (function names below).

Stage 2 (docs/KICKOFF-U7-viz-stage2.md) re-cut the heroes: vault frame + door, repeater, counter, board housings,
elevator panel + lantern. Footprints, node names (Frame / LedStrip, Door / Bolt0-5, Counter / Glass, Panel) and the
board openings (w - 2t x h - 2t) are unchanged so scripts/vault_door.gd and bank_interior.gd keep working.
"""
import bpy, math, os, sys

_args = sys.argv[sys.argv.index("--") + 1:]
OUT = _args[0]
ONLY = set(_args[1:])
os.makedirs(OUT, exist_ok=True)

PALETTE = {
    "Marble":     dict(rgb=(0.93, 0.90, 0.84)),
    "MarbleDark": dict(rgb=(0.16, 0.36, 0.28)),
    "Brass":      dict(rgb=(0.78, 0.62, 0.30), metallic=0.8, rough=0.35),
    "BrassDark":  dict(rgb=(0.47, 0.37, 0.18), metallic=0.8, rough=0.4),
    "Wood":       dict(rgb=(0.45, 0.30, 0.18)),
    "Graphite":   dict(rgb=(0.26, 0.28, 0.32)),
    "Steel":      dict(rgb=(0.55, 0.57, 0.62), metallic=0.7, rough=0.35),
    "SteelDark":  dict(rgb=(0.30, 0.31, 0.34), metallic=0.7, rough=0.45),
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


def zrot(a):
    """Blender euler for a rotation of `a` radians about the Godot z axis (the prop's front/back axis)."""
    return (0.0, -a, 0.0)


def box(name, gpos, gsize, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=gloc(gpos))
    o = bpy.context.active_object
    o.scale = (gsize[0], gsize[2], gsize[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler = rot
    return _finish(o, name, m, bevel)


def cyl(name, gpos, r, h, m, axis="y", verts=32, bevel=0.0, r2=None, fill="NGON", spin=0.0):
    """Cylinder along a Godot axis. `spin` rotates it about its own axis (radians) - e.g. to aim a 3-vert prism."""
    rot = {"y": (0, 0, 0), "z": (math.radians(90), 0, 0), "x": (0, math.radians(90), 0)}[axis]
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=gloc(gpos), rotation=rot, end_fill_type=fill)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=gloc(gpos), rotation=rot, end_fill_type=fill)
    o = bpy.context.active_object
    if spin:
        o.rotation_euler.rotate_axis("Z", spin)
    return _finish(o, name, m, bevel)


def torus(name, gpos, major, minor, m, axis="y", segs=32, minor_segs=8):
    rot = {"y": (0, 0, 0), "z": (math.radians(90), 0, 0), "x": (0, math.radians(90), 0)}[axis]
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=gloc(gpos), rotation=rot, major_segments=segs, minor_segments=minor_segs)
    return _finish(bpy.context.active_object, name, m, 0.0)


def sphere(name, gpos, r, m, segs=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=segs, ring_count=rings, location=gloc(gpos))
    return _finish(bpy.context.active_object, name, m, 0.0)


def join(objs, name, origin=(0.0, 0.0, 0.0)):
    """Apply modifiers, merge into one object with identity rotation/scale and its origin at godot `origin`."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")  # applies modifiers on every selected object
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.context.scene.cursor.location = gloc(origin)
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
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
    print("  wrote %s: %d node(s), %d faces (~%d tris), %d bytes" % (fname, len(objs), faces, tris, os.path.getsize(path)))


# ---------------------------------------------------------------- vault (WORLD-3D 2.1: circular door with bolts, LED strip on the frame)

# Door geometry shared with scripts/vault_door.gd: DOOR_R (disc radius), DOOR_CY (disc centre height), the clock
# plate sits above the swing (door top = DOOR_CY + DOOR_R) so "OPEN" stays readable while the door stands 30 deg ajar.
DOOR_R = 1.6
DOOR_CY = 1.75
CLOCK_Y = 3.62
BOLTS = 6


def vault_frame():
    """Frame node (Graphite / Steel / SteelDark / Brass) + LedStrip node (state material from vault_door.gd).
    Pilaster inner faces stay at x = +-1.925 and the lintel bottom at ~4.0, as Stage 1."""
    clear()
    parts = [
        box("Lintel", (0.0, 4.17, 0.0), (4.85, 0.36, 0.40), "Graphite", 0.03),
        box("LintelInlay", (0.0, 4.02, 0.205), (4.85, 0.03, 0.02), "Brass"),
        box("Crown1", (0.0, 4.375, 0.02), (4.95, 0.05, 0.44), "Brass", 0.01),
        box("Crown2", (0.0, 4.425, 0.0), (4.6, 0.05, 0.36), "Graphite", 0.01),
        box("LedChannelTop", (0.0, 4.17, 0.20), (4.4, 0.24, 0.04), "SteelDark"),
        # threshold plate with a brass edge
        box("Threshold", (0.0, 0.03, 0.1), (4.3, 0.06, 0.6), "Steel", 0.01),
        box("ThresholdEdge", (0.0, 0.035, 0.41), (4.3, 0.05, 0.03), "Brass"),
        # mouth: dark disc behind the door, chamfered collar, steel liner ring
        cyl("Mouth", (0.0, DOOR_CY, -0.02), DOOR_R + 0.2, 0.06, "Graphite", axis="z", verts=48),
        cyl("Collar", (0.0, DOOR_CY, 0.06), DOOR_R + 0.18, 0.10, "SteelDark", axis="z", verts=48, r2=DOOR_R + 0.08),
        torus("Liner", (0.0, DOOR_CY, 0.12), DOOR_R + 0.12, 0.06, "Steel", axis="z", segs=48),
        # clock hood in front of the lintel: graphite face (the Label3D sits at z 0.62), brass bezel + canopy, brackets
        box("ClockPlate", (0.0, CLOCK_Y, 0.57), (1.7, 0.62, 0.08), "Graphite", 0.02),
        box("BezelTop", (0.0, CLOCK_Y + 0.34, 0.57), (1.86, 0.06, 0.10), "Brass", 0.01),
        box("BezelBottom", (0.0, CLOCK_Y - 0.34, 0.57), (1.86, 0.06, 0.10), "Brass", 0.01),
        box("BezelW", (-0.90, CLOCK_Y, 0.57), (0.06, 0.74, 0.10), "Brass", 0.01),
        box("BezelE", (0.90, CLOCK_Y, 0.57), (0.06, 0.74, 0.10), "Brass", 0.01),
        box("Canopy", (0.0, CLOCK_Y + 0.40, 0.50), (1.98, 0.04, 0.30), "Brass", 0.01),
        box("BracketW", (-0.6, CLOCK_Y, 0.365), (0.10, 0.46, 0.33), "Graphite", 0.01),
        box("BracketE", (0.6, CLOCK_Y, 0.365), (0.10, 0.46, 0.33), "Graphite", 0.01),
    ]
    for sx in (-1, 1):
        px = sx * 2.15
        parts += [
            box("Base%d" % sx, (px, 0.22, 0.05), (0.55, 0.44, 0.45), "Graphite", 0.02),
            box("Shaft%d" % sx, (px, 2.2, 0.0), (0.45, 3.5, 0.38), "Graphite", 0.03),
            box("Capital%d" % sx, (px, 3.98, 0.03), (0.55, 0.16, 0.44), "Brass", 0.02),
            box("LedChannel%d" % sx, (px, 2.2, 0.20), (0.26, 3.4, 0.04), "SteelDark"),
            box("FluteA%d" % sx, (px - 0.17, 2.2, 0.20), (0.03, 3.3, 0.02), "Brass"),
            box("FluteB%d" % sx, (px + 0.17, 2.2, 0.20), (0.03, 3.3, 0.02), "Brass"),
        ]
    # bolt receivers on the collar, one per bolt: the door's bars slide into these
    for i in range(BOLTS):
        a = i * math.tau / BOLTS
        c = (math.cos(a) * 1.80, DOOR_CY + math.sin(a) * 1.80)
        parts.append(box("Receiver%d" % i, (c[0], c[1], 0.25), (0.24, 0.18, 0.26), "Steel", 0.01, rot=zrot(a)))
        parts.append(box("ReceiverCap%d" % i, (c[0], c[1], 0.39), (0.26, 0.20, 0.02), "Brass", 0.0, rot=zrot(a)))
    frame = join(parts, "Frame")
    leds = [
        box("LedW", (-2.15, 2.2, 0.215), (0.18, 3.3, 0.05), "LED"),
        box("LedE", (2.15, 2.2, 0.215), (0.18, 3.3, 0.05), "LED"),
        box("LedTop", (0.0, 4.17, 0.215), (4.3, 0.16, 0.05), "LED"),
    ]
    led = join(leds, "LedStrip")
    export([frame, led], "prop_vault_frame.glb")


def vault_repeater():
    """Lobby-side repeater on the vault lintel: brass case, dark channel, LedStrip node for the state material."""
    clear()
    housing = join([
        box("Case", (0.0, 0.0, 0.0), (4.1, 0.24, 0.08), "Brass", 0.01),
        box("Channel", (0.0, 0.0, 0.025), (3.9, 0.14, 0.04), "SteelDark"),
        box("CapW", (-2.0, 0.0, 0.03), (0.06, 0.20, 0.07), "BrassDark"),
        box("CapE", (2.0, 0.0, 0.03), (0.06, 0.20, 0.07), "BrassDark"),
    ], "Housing")
    led = join([box("Led", (0.0, 0.0, 0.05), (3.8, 0.10, 0.04), "LED")], "LedStrip")
    export([housing, led], "prop_vault_repeater.glb")


def vault_door():
    """Door node (centred on the disc) + Bolt0..5 nodes at the rim; vault_door.gd slides each along (cos a, sin a, 0)."""
    clear()
    r = DOOR_R
    hx = -(r + 0.1)
    parts = [
        cyl("Disc", (0.0, 0.0, 0.0), r, 0.35, "Steel", axis="z", verts=64, bevel=0.04),
        cyl("Band", (0.0, 0.0, 0.185), r - 0.10, 0.02, "SteelDark", axis="z", verts=64),
        cyl("FacePlate", (0.0, 0.0, 0.21), r - 0.30, 0.08, "Steel", axis="z", verts=64, bevel=0.03),
        torus("RimRing", (0.0, 0.0, 0.19), r - 0.07, 0.03, "Brass", axis="z", segs=64),
        torus("InnerRing", (0.0, 0.0, 0.245), r - 0.30, 0.03, "Brass", axis="z", segs=48),
        # hand wheel: rim, six arms, hub with a dark cap, six grips
        torus("Wheel", (0.0, 0.0, 0.36), 0.5, 0.05, "Brass", axis="z", segs=40),
        cyl("Hub", (0.0, 0.0, 0.32), 0.17, 0.22, "Brass", axis="z", verts=24, bevel=0.02),
        cyl("HubCap", (0.0, 0.0, 0.44), 0.08, 0.04, "BrassDark", axis="z", verts=16),
        # combination dial (east, low) and nameplate (west, low)
        cyl("Dial", (0.75, -0.55, 0.26), 0.14, 0.05, "Graphite", axis="z", verts=24),
        torus("DialRing", (0.75, -0.55, 0.28), 0.14, 0.02, "Brass", axis="z", segs=24),
        cyl("DialKnob", (0.75, -0.55, 0.30), 0.05, 0.06, "Brass", axis="z", verts=16),
        box("DialPointer", (0.75, -0.46, 0.29), (0.02, 0.08, 0.02), "Brass"),
        box("Nameplate", (-0.75, -0.55, 0.26), (0.36, 0.14, 0.02), "Brass", 0.005),
        box("NameplateField", (-0.75, -0.55, 0.272), (0.30, 0.08, 0.01), "Graphite"),
        # hinge on the west edge: two knuckles with brass caps, two arms
        cyl("HingeTop", (hx, 1.0, 0.0), 0.11, 0.60, "Steel", axis="y", verts=20),
        cyl("HingeBottom", (hx, -1.0, 0.0), 0.11, 0.60, "Steel", axis="y", verts=20),
        cyl("HingeCapA", (hx, 1.32, 0.0), 0.13, 0.04, "Brass", axis="y", verts=20),
        cyl("HingeCapB", (hx, 0.68, 0.0), 0.13, 0.04, "Brass", axis="y", verts=20),
        cyl("HingeCapC", (hx, -0.68, 0.0), 0.13, 0.04, "Brass", axis="y", verts=20),
        cyl("HingeCapD", (hx, -1.32, 0.0), 0.13, 0.04, "Brass", axis="y", verts=20),
        box("HingeArmTop", (hx + 0.35, 1.0, 0.0), (0.8, 0.18, 0.20), "Steel", 0.02),
        box("HingeArmBottom", (hx + 0.35, -1.0, 0.0), (0.8, 0.18, 0.20), "Steel", 0.02),
        box("HingeStrapTop", (hx + 0.55, 1.0, 0.185), (0.40, 0.12, 0.02), "BrassDark"),
        box("HingeStrapBottom", (hx + 0.55, -1.0, 0.185), (0.40, 0.12, 0.02), "BrassDark"),
    ]
    for k in range(3):
        parts.append(box("Spoke%d" % k, (0.0, 0.0, 0.36), (1.0, 0.06, 0.05), "Brass", 0.0, rot=zrot(k * math.pi / 3.0)))
    for k in range(6):
        a = math.radians(30) + k * math.pi / 3.0
        parts.append(cyl("Grip%d" % k, (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.42), 0.03, 0.10, "Brass", axis="z", verts=10))
    # the mechanism the wheel drives: a rod from the hub to a boss at each bolt angle
    for i in range(BOLTS):
        a = i * math.tau / BOLTS
        parts.append(box("Rod%d" % i, (math.cos(a) * 0.82, math.sin(a) * 0.82, 0.27), (0.50, 0.05, 0.04), "Brass", 0.0, rot=zrot(a)))
        parts.append(box("Boss%d" % i, (math.cos(a) * 1.15, math.sin(a) * 1.15, 0.27), (0.22, 0.16, 0.06), "Graphite", 0.01, rot=zrot(a)))
    for k in range(18):
        a = k * math.tau / 18.0 + math.tau / 36.0
        parts.append(cyl("Rivet%d" % k, (math.cos(a) * 1.41, math.sin(a) * 1.41, 0.20), 0.035, 0.03, "Brass", axis="z", verts=10))
    door = join(parts, "Door")
    bolts = []
    for i in range(BOLTS):
        a = i * math.tau / BOLTS
        # a radial locking bar (one material so it stays one draw call); built along +x, then aimed at angle a
        b = join([
            cyl("Bar", (0.0, 0.0, 0.0), 0.09, 0.42, "Brass", axis="x", verts=12),
            cyl("Collar", (0.15, 0.0, 0.0), 0.11, 0.06, "Brass", axis="x", verts=12),
        ], "Bolt%d" % i)
        b.location = gloc((math.cos(a) * r, math.sin(a) * r, 0.0))
        b.rotation_euler = zrot(a)
        bolts.append(b)
    export([door] + bolts, "prop_vault_door.glb")


# ---------------------------------------------------------------- counter (WORLD-3D 2.1: 1.1 m marble counter, glass partition with slot)

def counter():
    """Counter node + Glass node. 3.6 x 0.9 m footprint, 1.1 m top, glass to 2.74 m; +z is the customer side."""
    clear()
    L = 3.6
    parts = [
        box("Plinth", (0, 0.06, 0.0), (L, 0.12, 0.9), "MarbleDark", 0.01),
        box("Kick", (0, 0.05, 0.455), (L - 0.1, 0.06, 0.02), "Brass"),
        box("Body", (0, 0.56, -0.03), (L, 0.88, 0.80), "Marble", 0.02),
        box("Top", (0, 1.06, 0.03), (L + 0.12, 0.10, 1.02), "MarbleDark", 0.03),
        box("Nosing", (0, 1.005, 0.52), (L + 0.10, 0.03, 0.03), "Brass"),
        # pass-through tray let into the top, brass-lipped
        box("Tray", (0, 1.115, 0.08), (0.8, 0.02, 0.32), "Steel"),
        box("TrayLipN", (0, 1.135, -0.08), (0.84, 0.03, 0.02), "Brass"),
        box("TrayLipS", (0, 1.135, 0.24), (0.84, 0.03, 0.02), "Brass"),
        box("TrayLipW", (-0.41, 1.135, 0.08), (0.02, 0.03, 0.34), "Brass"),
        box("TrayLipE", (0.41, 1.135, 0.08), (0.02, 0.03, 0.34), "Brass"),
        # glass frame: posts, top rail, mullions, bottom channels either side of the slot, sill over the slot, transom
        box("PostW", (-1.77, 1.92, 0.0), (0.07, 1.64, 0.08), "Brass", 0.005),
        box("PostE", (1.77, 1.92, 0.0), (0.07, 1.64, 0.08), "Brass", 0.005),
        box("TopRail", (0, 2.74, 0.0), (L + 0.06, 0.06, 0.09), "Brass", 0.01),
        box("MullionW", (-0.42, 1.92, 0.0), (0.05, 1.64, 0.07), "Brass"),
        box("MullionE", (0.42, 1.92, 0.0), (0.05, 1.64, 0.07), "Brass"),
        box("ChannelW", (-1.1, 1.13, 0.0), (1.34, 0.04, 0.08), "Brass"),
        box("ChannelE", (1.1, 1.13, 0.0), (1.34, 0.04, 0.08), "Brass"),
        box("Sill", (0, 1.42, 0.0), (0.84, 0.04, 0.08), "Brass"),
        box("Transom", (0, 2.30, 0.0), (L, 0.03, 0.06), "Brass"),
        # speak-through grille and a card plate on the middle pane
        box("Grille", (0, 1.85, 0.03), (0.30, 0.18, 0.02), "BrassDark", 0.005),
        box("GrilleBarA", (0, 1.80, 0.045), (0.26, 0.02, 0.01), "Brass"),
        box("GrilleBarB", (0, 1.85, 0.045), (0.26, 0.02, 0.01), "Brass"),
        box("GrilleBarC", (0, 1.90, 0.045), (0.26, 0.02, 0.01), "Brass"),
        box("CardPlate", (0, 2.56, 0.045), (0.34, 0.20, 0.03), "Brass", 0.005),
        box("Card", (0, 2.56, 0.065), (0.28, 0.14, 0.01), "Cream"),
        # foot rail and brackets on the customer side
        cyl("FootRail", (0, 0.25, 0.50), 0.03, L - 0.3, "Brass", axis="x", verts=12),
        box("RailBracketW", (-1.4, 0.2, 0.47), (0.04, 0.12, 0.08), "Brass"),
        box("RailBracketE", (1.4, 0.2, 0.47), (0.04, 0.12, 0.08), "Brass"),
        box("RailBracketC", (0.0, 0.2, 0.47), (0.04, 0.12, 0.08), "Brass"),
    ]
    # panelled front: four marble pilasters, three green insets with brass fluting
    for x in (-1.75, -0.6, 0.6, 1.75):
        parts.append(box("Pilaster%s" % x, (x, 0.56, 0.40), (0.14, 0.88, 0.08), "Marble", 0.015))
    for cx, w in ((-1.175, 1.01), (0.0, 1.06), (1.175, 1.01)):
        parts.append(box("Inset%s" % cx, (cx, 0.56, 0.385), (w - 0.04, 0.72, 0.03), "MarbleDark"))
        for dx in (-0.25, 0.0, 0.25):
            parts.append(box("Flute%s_%s" % (cx, dx), (cx + dx, 0.56, 0.405), (0.03, 0.64, 0.02), "Brass"))
    body = join(parts, "Counter")
    glass = join([
        box("PaneW", (-1.1, 1.92, 0.0), (1.32, 1.58, 0.03), "Glass"),
        box("PaneE", (1.1, 1.92, 0.0), (1.32, 1.58, 0.03), "Glass"),
        box("PaneMid", (0.0, 2.08, 0.0), (0.80, 1.28, 0.03), "Glass"),
    ], "Glass")
    export([body, glass], "prop_counter.glb")


# ---------------------------------------------------------------- boards (split-flap housing; the rows are a SubViewport quad in Godot)

def board_frame(fname, w, h, depth, bulbs):
    """Art-deco split-flap cabinet. Opening stays (w - 2t) x (h - 2t) around the quad; the front face is z = 0 and the
    body goes back into the wall. `bulbs` = x positions of the marquee lamps under the hood (Bulb material, no lights)."""
    clear()
    t = 0.25
    parts = [
        box("Left", (-w / 2 + t / 2, 0, -depth / 2), (t, h, depth), "Graphite", 0.03),
        box("Right", (w / 2 - t / 2, 0, -depth / 2), (t, h, depth), "Graphite", 0.03),
        box("Top", (0, h / 2 - t / 2, -depth / 2), (w - 2 * t, t, depth), "Graphite", 0.03),
        box("Bottom", (0, -h / 2 + t / 2, -depth / 2), (w - 2 * t, t, depth), "Graphite", 0.03),
        box("Back", (0, 0, -depth + 0.03), (w - 2 * t + 0.02, h - 2 * t + 0.02, 0.06), "Graphite"),
        # brass trim at the opening edge
        box("TrimTop", (0, h / 2 - t, -0.02), (w - 2 * t, 0.03, 0.04), "Brass"),
        box("TrimBottom", (0, -h / 2 + t, -0.02), (w - 2 * t, 0.03, 0.04), "Brass"),
        box("TrimLeft", (-w / 2 + t, 0, -0.02), (0.03, h - 2 * t, 0.04), "Brass"),
        box("TrimRight", (w / 2 - t, 0, -0.02), (0.03, h - 2 * t, 0.04), "Brass"),
        # stepped cornice
        box("Cornice1", (0, h / 2 + 0.025, -depth / 2), (w + 0.16, 0.05, depth + 0.08), "Brass", 0.01),
        box("Cornice2", (0, h / 2 + 0.075, -depth / 2 + 0.02), (w - 0.2, 0.05, depth + 0.02), "Graphite", 0.01),
        box("Cornice3", (0, h / 2 + 0.12, -depth / 2 + 0.04), (w - 0.8, 0.04, depth - 0.02), "Brass", 0.01),
        # header plate on the top rail, marquee hood over the opening, toe line, marble apron
        box("Header", (0, h / 2 - t / 2, 0.01), (w * 0.5, 0.10, 0.02), "Brass", 0.005),
        box("HeaderField", (0, h / 2 - t / 2, 0.025), (w * 0.5 - 0.04, 0.06, 0.01), "BrassDark"),
        box("Hood", (0, h / 2 - t + 0.06, 0.10), (w - 2 * t + 0.10, 0.03, 0.22), "Brass", 0.005),
        box("Toe", (0, -h / 2 + 0.05, 0.005), (w - 2 * t, 0.03, 0.015), "Brass"),
        box("Apron", (0, -h / 2 - 0.03, -depth / 2 + 0.02), (w + 0.10, 0.06, depth + 0.06), "MarbleDark", 0.01),
    ]
    for sx in (-1, 1):
        cx = sx * (w / 2 - t / 2)
        for dx in (-0.07, 0.0, 0.07):
            parts.append(box("Flute%d_%s" % (sx, dx), (cx + dx, 0, 0.005), (0.025, h - 0.5, 0.015), "Brass"))
    for x in bulbs:
        parts.append(cyl("LampCup%s" % x, (x, h / 2 - t + 0.03, 0.16), 0.045, 0.03, "BrassDark", axis="y", verts=12))
    frame = join(parts, "Frame")
    lamps = join([sphere("Lamp%s" % x, (x, h / 2 - t + 0.0, 0.16), 0.035, "Bulb", segs=10, rings=6) for x in bulbs], "Lamps")
    export([frame, lamps], fname)


def board_frame_ledger():
    board_frame("prop_board_frame.glb", 8.6, 2.6, 0.28, (-3.0, -1.5, 0.0, 1.5, 3.0))


def board_frame_names():
    board_frame("prop_names_board_frame.glb", 2.8, 1.7, 0.2, (-0.7, 0.0, 0.7))


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


# ---------------------------------------------------------------- elevator (WORLD-3D 2.1: two-button panel MAIN / ARC, floor indicator)

def elevator_panel():
    """Panel node: brass plate, graphite inset, two rimmed buttons, a lit dot at MAIN (the wing we are in), arrows."""
    clear()
    parts = [
        box("Plate", (0, 0, 0), (0.22, 0.44, 0.02), "Brass", 0.005),
        box("Inset", (0, 0, 0.012), (0.18, 0.40, 0.01), "Graphite"),
        box("Divider", (0, 0, 0.018), (0.14, 0.006, 0.004), "Brass"),
        cyl("RimMain", (0, 0.07, 0.02), 0.035, 0.012, "Brass", axis="z", verts=20),
        cyl("RimArc", (0, -0.07, 0.02), 0.035, 0.012, "Brass", axis="z", verts=20),
        cyl("BtnMain", (0, 0.07, 0.024), 0.025, 0.014, "Graphite", axis="z", verts=20),
        cyl("BtnArc", (0, -0.07, 0.024), 0.025, 0.014, "Graphite", axis="z", verts=20),
        cyl("DotArc", (0.065, -0.07, 0.02), 0.008, 0.008, "LED", axis="z", verts=8),
        cyl("ArrowUp", (0, 0.17, 0.02), 0.03, 0.006, "Brass", axis="z", verts=3, spin=math.radians(90)),
        cyl("ArrowDown", (0, -0.17, 0.02), 0.03, 0.006, "Brass", axis="z", verts=3, spin=math.radians(-90)),
    ]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl("Screw%d%d" % (sx, sy), (sx * 0.09, sy * 0.20, 0.012), 0.008, 0.006, "BrassDark", axis="z", verts=8))
    panel = join(parts, "Panel")
    dot = join([cyl("Dot", (0.065, 0.07, 0.02), 0.008, 0.008, "Bulb", axis="z", verts=8)], "DotMain")
    export([panel, dot], "prop_elevator_panel.glb")


def elevator_lantern():
    """Hall lantern over the elevator doors: brass case, dark face, two lit windows (the indicator)."""
    clear()
    case = join([
        box("Case", (0, 0, 0), (0.7, 0.2, 0.08), "Brass", 0.01),
        box("Face", (0, 0, 0.04), (0.64, 0.14, 0.01), "Graphite"),
        box("Bar", (0, 0, 0.046), (0.02, 0.12, 0.006), "Brass"),
    ], "Lantern")
    windows = join([
        box("WindowW", (-0.16, 0, 0.046), (0.20, 0.08, 0.008), "Bulb"),
        box("WindowE", (0.16, 0, 0.046), (0.20, 0.08, 0.008), "Bulb"),
    ], "Windows")
    export([case, windows], "prop_elevator_lantern.glb")


ALL = (vault_frame, vault_repeater, vault_door, counter, board_frame_ledger, board_frame_names, engraver, printer, stamp,
       shredder, pendant_lamp, water_cooler, rope_post, elevator_panel, elevator_lantern)
for fn in ALL:
    if ONLY and fn.__name__ not in ONLY:
        continue
    print("prop:", fn.__name__)
    fn()
print("done")
