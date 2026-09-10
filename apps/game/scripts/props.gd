class_name PropKit
extends RefCounted
## Set-dressing loader with the material budget built in (docs/WORLD-3D-ENVIRONMENT.md §5 pipeline, §6 ≤ 40 unique
## materials). Two kinds of .glb come through here:
##  - hero props (assets/models/hero, made by tools/hero_props.py) name their materials after the palette — Marble,
##    Brass, BrassDark, Steel, SteelDark, Glass, … — and are re-pointed at the WingTheme colours, so the mesh carries
##    shape only (the two Dark tones are derived from the theme's brass / steel, Stage 2 hero recesses);
##  - Kenney Furniture Kit props (assets/models/kenney_furniture, CC0) carry 1–4 flat-colour materials each; identical
##    colours collapse into one shared StandardMaterial3D, and `recolor` re-tints named kit colours into the bank palette;
##  - the bank staff (assets/characters/kenney_staff, Kenney Animated Characters CC0, character style climb) are
##    one skinned mesh worn eight ways: `character()` folds the role's atlas tile into a copy of the UVs, so the
##    cast costs one albedo material plus one inverted-hull outline pass, and adds one shared face-sheet material on
##    a shadowless head carrier — see `staff_material` / `staff_outline` / `face_material`;
##  - KayKit Adventurers feel-spike (assets/characters/kaykit_adventurers, CC0): when `USE_KAYKIT_CAST` is true,
##    `character()` instances a per-role Adventurers mesh and installs bank clip aliases (idle/walk/…) from the
##    Rig_Medium General / MovementBasic / Simulation libraries — no face sheet / outline / atlas tile. The bank
##    variants (2026-09-09) are recoloured palette sheets (`*_bank_texture.png`, tools/kaykit_bank_variants.py) plus a
##    per-role UV cell remap for the roles that share a body (KAYKIT_ROLE_CELLS) — still five body materials.
##    Art-deco land (ENG-2026-0015): vault_keeper hides `Knight_Helmet` / `Knight_HelmetVisor` and wears navy plate
##    cells (guard tunic read) — no new glb;
##  - KayKit Furniture Bits (assets/models/kaykit_furniture, CC0, U7 viz Stage 6a) were authored against one flat-colour
##    palette atlas that tools/kaykit_pack.py strips out of the .glb: at load `_split_kaykit` reads each triangle's UV
##    cell and hands it the matching WingTheme palette material, so the denser fill costs zero new materials and
##    recolours with the wing like every hero prop.
##  - Stage 6c surface grain (assets/textures/surfaces, ambientCG CC0 albedo only): Marble / Wood / Ceiling sample
##    512² JPEGs tinted by the WingTheme colour. Same material slots — zero new unique materials. Floor stays the
##    procedural terrazzo (no photoreal floor map). Stage 6b (MrEliptik office pack) was skipped: itch NYOP, not free.
##  - Kenney Nature Kit props (assets/models/kenney_nature, CC0, U7 viz Stage 6d) are the lobby / desk plants: flat
##    teal-green kit colours with metallic 1 / roughness 1 in the .glb, so `nature_recolor` replaces every kit material
##    outright with a palette Material (foliage → Plant, trunks and soil → WoodDark, pot body → MarbleDark or Cream)
##    and the mesh carries shape only — zero new materials, and the plants bake with everything else.
## Anything that blocks the player gets a StaticBody3D on layer 1 / mask 0 — colliders that block must not listen
## (U4+ lesson: Godot Physics on web shoves listening bodies).

const HERO := "res://assets/models/hero/"
const KIT := "res://assets/models/kenney_furniture/"
const KAYKIT := "res://assets/models/kaykit_furniture/"
const NATURE := "res://assets/models/kenney_nature/"
const CHARACTERS := "res://assets/characters/kenney_staff/"
const KAYKIT_CAST := "res://assets/characters/kaykit_adventurers/"
const KAYKIT_CHARACTERS := KAYKIT_CAST + "Characters/"
const KAYKIT_ANIMS := KAYKIT_CAST + "Animations/"
const SURFACES := "res://assets/textures/surfaces/"

## Stage 3 lock (2026-09-09): soft-fantasy KayKit Adventurers as the live cast. Flip false to restore Kenney staff.
const USE_KAYKIT_CAST := true

# The Kenney cast: one skinned .glb + one atlas, both regenerable (tools/bank_staff_rig.py, tools/bank_staff_atlas.py).
const STAFF_GLB := CHARACTERS + "bank_staff.glb"
const STAFF_ATLAS := CHARACTERS + "Textures/staff_atlas.png"
const STAFF_FACE_SHEET := CHARACTERS + "Textures/face_sheet.png"
const STAFF_TILE := 340.0        # tile side in atlas pixels
const STAFF_STRIDE := 341.0      # tile pitch — a 1 px gutter keeps mip filtering out of the neighbour
const STAFF_ATLAS_PX := 1024.0
const STAFF_COLS := 3
const STAFF_OUTLINE := 0.042     # inverted-hull grow, model space (see staff_outline)
const STAFF_FACE_COLS := 8
const STAFF_FACE_ROWS := 5
const STAFF_FACE_PAD_PX := 2.0
## npc.gd `npc_id` / player → atlas tile, in the order tools/bank_staff_atlas.py paints them.
const STAFF_TILES := {
	"greeter": 0, "clerk": 1, "teller": 2, "vault_keeper": 3,
	"manager": 4, "registrar": 5, "dealer": 6, "player": 7,
}
const STAFF_CLIPS := ["idle", "walk", "sprint", "work", "refuse", "greet"]
## Ground speed each locomotion clip was authored for, so callers can scale `speed_scale` instead of skating.
const STAFF_WALK_MPS := 1.5
const STAFF_SPRINT_MPS := 3.8

## KayKit Adventurers mesh per bank role (ENG-2026-0017 jacket cast; stock glbs kept beside for revert).
## Mage / Ranger reuse one jacket body; Johnny / Walker / Bob are CC0 derivative glbs (Rig_Medium unchanged).
const KAYKIT_MESHES := {
	"greeter": "Ranger_jacket_nocape",
	"clerk": "Mage_jacket_nocape",
	"teller": "Rogue_jacket_nocape",
	"vault_keeper": "Bob_jacket_cape",
	"manager": "Walker_jacket",
	"registrar": "Mage_jacket_nocape",
	"dealer": "Johnny_jacket",
	"player": "Ranger_jacket_nocape",
}
## Mesh file stem → albedo PNG beside the .glb. The `*_bank_texture.png` sheets are the bank-variant derivatives that
## tools/kaykit_bank_variants.py paints from KayKit's CC0 `*_texture.png` (room neutrals + one accent per role;
## Johnny shares the rogue sheet). Five sheets → five body materials.
const KAYKIT_TEXTURE_FILES := {
	"Barbarian": "barbarian_bank_texture.png",
	"Knight": "knight_bank_texture.png",
	"Mage": "mage_bank_texture.png",
	"Ranger": "ranger_bank_texture.png",
	"Rogue": "rogue_bank_texture.png",
	"Rogue_Hooded": "rogue_bank_texture.png",
	"Ranger_jacket_nocape": "ranger_bank_texture.png",
	"Mage_jacket_nocape": "mage_bank_texture.png",
	"Rogue_jacket_nocape": "rogue_bank_texture.png",
	"Johnny_jacket": "rogue_bank_texture.png",
	"Walker_jacket": "barbarian_bank_texture.png",
	"Bob_jacket_cape": "knight_bank_texture.png",
}
## KayKit sheets are an 8 × 4 grid of 128 × 256 px palette cells and every triangle's UVs sit inside one cell. Where two
## roles wear the same body (Iris / Petra on Mage, Ash / player on Ranger, Eve / Johnny on the rogue sheet) the second
## role is told apart by tint alone without a sixth material: tools/kaykit_bank_variants.py paints its colours into the
## sheet's spare bottom-row cells and `_kaykit_role_mesh` moves that role's triangles from the base cell (key) to the
## spare (value) in a cached copy of the mesh's UVs. Cells are Vector2i(col, row).
const KAYKIT_CELL_COLS := 8
const KAYKIT_CELL_ROWS := 4
const KAYKIT_ROLE_CELLS := {
	# Petra: deep-green robe + hat (was Iris's slate), coral cape + trims (was mustard), copper hair (was black).
	"registrar": {
		Vector2i(0, 1): Vector2i(0, 3), Vector2i(1, 1): Vector2i(0, 3),
		Vector2i(2, 1): Vector2i(1, 3), Vector2i(5, 0): Vector2i(1, 3),
		Vector2i(1, 0): Vector2i(2, 3),
	},
	# player: graphite tunic + sleeves (Ash's camel), navy cape / sash (Ash's emerald), dark hair (Ash's auburn).
	"player": {
		Vector2i(7, 0): Vector2i(0, 3), Vector2i(7, 2): Vector2i(0, 3),
		Vector2i(0, 1): Vector2i(1, 3),
		Vector2i(1, 0): Vector2i(2, 3),
	},
	# Johnny: graphite tunic spare + teal cape / mantle where Eve wears oxblood cape cloth.
	"dealer": {
		Vector2i(0, 1): Vector2i(0, 3), Vector2i(1, 1): Vector2i(1, 3),
	},
}
## Fantasy accessory MeshInstance3D names to free before aabb/scale. Jacket cast glbs already omit accessories
## (ENG-2026-0016/0017); keep entries only if a role still loads a stock Adventurers body.
const KAYKIT_HIDE_PARTS := {}
## Bank clip name → KayKit Rig_Medium clip (General / MovementBasic / Simulation).
const KAYKIT_CLIP_SRC := {
	"idle": "Idle_A",
	"walk": "Walking_A",
	"sprint": "Running_A",
	"greet": "Waving",
	"work": "Interact",
	"refuse": "Hit_A",
}
const KAYKIT_ANIM_FILES := [
	"Rig_Medium_General.glb",
	"Rig_Medium_MovementBasic.glb",
	"Rig_Medium_Simulation.glb",
]
## Approximate authored ground speeds for KayKit walk / run (no root motion; used for speed_scale only).
const KAYKIT_WALK_MPS := 1.2
const KAYKIT_SPRINT_MPS := 3.0

# Mirrors the authoring table in tools/bank_staff_rig.py. The common glb stays one mesh; these pose scales are applied
# to each Skeleton3D instance so stocky / slight / tall cues cost no mesh, atlas tile, or material.
const STAFF_ROLE_SCALES := {
	"greeter": {"Spine": Vector3(1.08, 1.02, 0.96), "Chest": Vector3(1.08, 1.02, 0.96), "Head": Vector3(1.06, 1.06, 1.06), "Neck": Vector3(1.03, 1.03, 1.0), "LeftUpLeg": Vector3(0.96, 0.96, 0.95), "RightUpLeg": Vector3(0.96, 0.96, 0.95)},
	"clerk": {"Spine": Vector3(0.94, 0.96, 0.96), "Chest": Vector3(0.94, 0.96, 0.96), "Head": Vector3(1.02, 1.02, 1.02), "Neck": Vector3(1.01, 1.01, 1.0), "LeftUpLeg": Vector3(1.03, 1.03, 1.04), "RightUpLeg": Vector3(1.03, 1.03, 1.04)},
	"teller": {"Spine": Vector3(1.02, 1.0, 0.98), "Chest": Vector3(1.02, 1.0, 0.98), "Head": Vector3.ONE, "LeftUpLeg": Vector3(0.99, 0.99, 0.98), "RightUpLeg": Vector3(0.99, 0.99, 0.98)},
	"vault_keeper": {"Spine": Vector3(1.07, 1.04, 0.96), "Chest": Vector3(1.07, 1.04, 0.96), "Head": Vector3(1.03, 1.03, 1.03), "Neck": Vector3(1.02, 1.02, 1.0), "LeftUpLeg": Vector3(0.95, 0.95, 0.94), "RightUpLeg": Vector3(0.95, 0.95, 0.94)},
	"manager": {"Spine": Vector3(1.10, 1.05, 0.95), "Chest": Vector3(1.10, 1.05, 0.95), "Head": Vector3.ONE, "Neck": Vector3.ONE, "LeftUpLeg": Vector3(0.94, 0.94, 0.93), "RightUpLeg": Vector3(0.94, 0.94, 0.93)},
	"registrar": {"Spine": Vector3(0.92, 0.95, 0.95), "Chest": Vector3(0.92, 0.95, 0.95), "Head": Vector3(0.98, 0.98, 0.98), "LeftUpLeg": Vector3(1.05, 1.05, 1.06), "RightUpLeg": Vector3(1.05, 1.05, 1.06)},
	"dealer": {"Spine": Vector3(0.96, 0.98, 0.98), "Chest": Vector3(0.96, 0.98, 0.98), "Head": Vector3.ONE, "LeftUpLeg": Vector3(1.07, 1.07, 1.08), "RightUpLeg": Vector3(1.07, 1.07, 1.08)},
	"player": {"Head": Vector3(1.02, 1.02, 1.02), "Neck": Vector3(1.01, 1.01, 1.0)},
}

static var theme: WingTheme = null
static var _mats: Dictionary = {}
static var _scenes: Dictionary = {}
static var _staff_meshes: Dictionary = {}
static var _kaykit_meshes: Dictionary = {}   # "<mesh>@<role>" → UV-remapped ArrayMesh (KAYKIT_ROLE_CELLS)


static func ensure_theme() -> WingTheme:
	if theme == null:
		theme = load("res://themes/wing_main.tres")
	return theme


## U6 elevator beat: clear the palette cache before the static interior is rebuilt for the other wing.
static func set_wing_theme(wing: String) -> WingTheme:
	theme = load("res://themes/wing_arc.tres" if wing == "arc" else "res://themes/wing_main.tres")
	_mats.clear()
	return theme


## Palette material by name (the names tools/hero_props.py writes into the .glb).
static func palette(name: String) -> StandardMaterial3D:
	var t := ensure_theme()
	match name:
		"Marble":
			return surface("Marble", t.wall_color, 0.0, 0.7, SURFACES + "marble_albedo.jpg", Vector3(2.5, 2.5, 2.5))
		"MarbleDark":
			return surface("MarbleDark", t.wainscot_color, 0.0, 0.55, SURFACES + "marble_albedo.jpg", Vector3(2.0, 2.0, 2.0))
		"Brass":
			return color(t.trim_color, 0.85, 0.35)
		"BrassDark":
			return color(t.trim_color.darkened(0.4), 0.85, 0.4)
		"Wood":
			return surface("Wood", t.wood_color, 0.0, 0.7, SURFACES + "wood_albedo.jpg", Vector3(1.5, 1.5, 1.5))
		"WoodDark":
			return surface("WoodDark", t.wood_color.darkened(0.25), 0.0, 0.7, SURFACES + "wood_albedo.jpg", Vector3(1.5, 1.5, 1.5))
		"Graphite":
			return color(t.graphite_color, 0.1, 0.8)
		"Steel":
			return color(t.steel_color, 0.75, 0.35)
		"SteelDark":
			return color(t.steel_color.darkened(0.45), 0.7, 0.45)
		"Glass":
			return color(t.glass_color, 0.0, 0.1)
		"LED":
			return color(Color(0.2, 0.2, 0.2), 0.0, 0.6)
		"Bulb":
			return color(t.bulb_color, 0.0, 1.0, t.bulb_color, 2.0)
		"Cream":
			return color(t.cream_color)
		"Paper":
			return surface("Paper", t.paper_color, 0.0, 1.0, SURFACES + "plaster_albedo.jpg", Vector3(3.0, 3.0, 3.0))
		"Plant":
			return color(t.plant_color, 0.0, 0.9)
		"Rope":
			return color(t.rope_color, 0.0, 0.9)
		"Ceiling":
			return surface("Ceiling", t.ceiling_color, 0.0, 1.0, SURFACES + "plaster_albedo.jpg", Vector3(4.0, 4.0, 4.0))
		"Floor":
			return floor_material()
	push_warning("PropKit: unknown palette name %s" % name)
	return color(Color.MAGENTA)


static func is_palette_name(name: String) -> bool:
	return name in ["Marble", "MarbleDark", "Brass", "BrassDark", "Wood", "WoodDark", "Graphite", "Steel", "SteelDark", "Glass", "LED", "Bulb", "Cream", "Paper", "Plant", "Rope", "Ceiling", "Floor"]


## One shared material per (colour, metallic, roughness, emission) — quantised so near-identical kit colours merge.
static func color(c: Color, metallic: float = 0.0, roughness: float = 0.85, emission: Color = Color(0, 0, 0, 0), energy: float = 0.0) -> StandardMaterial3D:
	var key := "%s|%.1f|%.1f|%s|%.1f" % [c.to_html(true), metallic, roughness, emission.to_html(false), energy]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.resource_name = key
	m.albedo_color = c
	m.metallic = metallic
	m.roughness = roughness
	if c.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if energy > 0.0:
		m.emission_enabled = true
		m.emission = emission
		m.emission_energy_multiplier = energy
	_mats[key] = m
	return m


## Stage 6c: existing palette slot + ambientCG albedo (tint via albedo_color). Falls back to flat colour if the file is missing.
static func surface(slot: String, tint: Color, metallic: float, roughness: float, tex_path: String, uv_scale: Vector3) -> StandardMaterial3D:
	var key := "surf|%s" % slot
	if _mats.has(key):
		return _mats[key]
	if not ResourceLoader.exists(tex_path):
		push_warning("PropKit: missing surface %s — flat fallback" % tex_path)
		return color(tint, metallic, roughness)
	var m := StandardMaterial3D.new()
	m.resource_name = slot
	m.albedo_color = tint
	m.albedo_texture = load(tex_path)
	m.uv1_scale = uv_scale
	m.metallic = metallic
	m.roughness = roughness
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_mats[key] = m
	return m


## Terrazzo: a procedural noise texture (no file, ~64 KB VRAM) modulating the floor colour towards the chip colour.
static func floor_material() -> StandardMaterial3D:
	if _mats.has("floor"):
		return _mats["floor"]
	var t := ensure_theme()
	var m := StandardMaterial3D.new()
	m.resource_name = "floor"
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_CELLULAR
	noise.cellular_return_type = FastNoiseLite.RETURN_CELL_VALUE
	noise.frequency = 0.12
	noise.seed = 7
	var tex := NoiseTexture2D.new()
	tex.width = 256
	tex.height = 256
	tex.seamless = true
	tex.noise = noise
	var grad := Gradient.new()
	grad.set_color(0, t.floor_chip_color)
	grad.set_color(1, t.floor_color)
	grad.add_point(0.35, t.floor_color.lerp(t.floor_chip_color, 0.35))
	tex.color_ramp = grad
	m.albedo_texture = tex
	m.albedo_color = Color(1, 1, 1)
	m.uv1_scale = Vector3(14, 10, 1)
	m.roughness = 0.55
	m.metallic = 0.0
	m.metallic_specular = 0.4
	_mats["floor"] = m
	return m


static func unique_material_count() -> int:
	return _mats.size()


static func scene(path: String) -> PackedScene:
	if not _scenes.has(path):
		_scenes[path] = load(path)
	return _scenes[path]


## Instantiate a .glb and re-point every surface at a shared material.
## opts: scale (float | Vector3), fit (Vector3: scale so the AABB matches), center (bool: footprint centred on the
## node origin), ground (bool: lowest point at y = 0), recolor ({material_name: Color}), keep_materials (bool).
static func instance(path: String, opts: Dictionary = {}) -> Node3D:
	var packed := scene(path)
	if packed == null:
		push_error("PropKit: missing %s" % path)
		var missing := Node3D.new()
		missing.name = path.get_file().get_basename()
		missing.set_meta("missing_glb", path)   # tests/run_viz_budget.gd fails on this
		return missing
	var root := packed.instantiate() as Node3D
	root.name = path.get_file().get_basename()
	root.set_meta("glb", path)
	if path.begins_with(KAYKIT):
		_split_kaykit(root)
	elif not bool(opts.get("keep_materials", false)):
		retarget(root, opts.get("recolor", {}))
	var bb := aabb(root)
	var s: Vector3 = Vector3.ONE
	if opts.has("scale"):
		var v = opts["scale"]
		s = v if v is Vector3 else Vector3.ONE * float(v)
	if opts.has("fit"):
		var target: Vector3 = opts["fit"]
		s = Vector3(target.x / maxf(bb.size.x, 0.001), target.y / maxf(bb.size.y, 0.001), target.z / maxf(bb.size.z, 0.001))
	root.scale = s
	var off := Vector3.ZERO
	if bool(opts.get("center", false)):
		off.x = -(bb.position.x + bb.size.x / 2.0) * s.x
		off.z = -(bb.position.z + bb.size.z / 2.0) * s.z
	if bool(opts.get("ground", false)):
		off.y = -bb.position.y * s.y
	root.position = off
	return root


## Place a prop under `parent`. `collider` (world size, metres) adds a layer-1 / mask-0 StaticBody3D; ZERO = walk-through.
static func place(parent: Node, name: String, path: String, pos: Vector3, yaw: float = 0.0, opts: Dictionary = {}, collider: Vector3 = Vector3.ZERO, collider_offset: Vector3 = Vector3.ZERO) -> Node3D:
	var root: Node3D
	if collider != Vector3.ZERO:
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = collider
		shape.shape = bs
		shape.position = collider_offset
		shape.rotation.y = -yaw   # collider sizes are given in world axes; undo the prop's yaw
		body.add_child(shape)
		body.collision_layer = 1
		body.collision_mask = 0
		root = body
	else:
		root = Node3D.new()
	root.name = name
	root.position = pos
	root.rotation.y = yaw
	root.add_child(instance(path, opts))
	parent.add_child(root)
	return root


## Kenney kit props are authored at ~half scale with a corner origin: ×2, centred, grounded (WORLD-3D §5 1 unit = 1 m).
static func kit(parent: Node, name: String, file: String, pos: Vector3, yaw: float = 0.0, opts: Dictionary = {}, collider: Vector3 = Vector3.ZERO, collider_offset: Vector3 = Vector3.ZERO) -> Node3D:
	var o := {"scale": 2.0, "center": true, "ground": true, "recolor": kit_recolor()}
	o.merge(opts, true)
	return place(parent, name, KIT + file + ".glb", pos, yaw, o, collider, collider_offset)


static func hero(parent: Node, name: String, file: String, pos: Vector3, yaw: float = 0.0, opts: Dictionary = {}, collider: Vector3 = Vector3.ZERO, collider_offset: Vector3 = Vector3.ZERO) -> Node3D:
	return place(parent, name, HERO + file + ".glb", pos, yaw, opts, collider, collider_offset)


## KayKit Furniture Bits are authored at 1 unit = 1 m with a centred footprint and face +z; `fit` / `scale` as for `place`.
static func kaykit(parent: Node, name: String, file: String, pos: Vector3, yaw: float = 0.0, opts: Dictionary = {}, collider: Vector3 = Vector3.ZERO, collider_offset: Vector3 = Vector3.ZERO) -> Node3D:
	var o := {"center": true, "ground": true}
	o.merge(opts, true)
	return place(parent, name, KAYKIT + file + ".glb", pos, yaw, o, collider, collider_offset)


## Kenney Nature Kit props (U7 viz Stage 6d, CC0) are authored at 1 unit = 1 m around a centred footprint. Their
## materials are flat teal greens and terracotta with metallic 1 / roughness 1, so none of them may reach `color()`:
## `nature_recolor` hands every kit material name a palette Material and the mesh carries shape only. opts `pot`
## (a palette name, default MarbleDark) picks the pot body's colour; foliage always lands on the Plant slot.
static func nature(parent: Node, name: String, file: String, pos: Vector3, yaw: float = 0.0, opts: Dictionary = {}, collider: Vector3 = Vector3.ZERO, collider_offset: Vector3 = Vector3.ZERO) -> Node3D:
	var o := {"center": true, "ground": true, "recolor": nature_recolor(str(opts.get("pot", "MarbleDark")))}
	o.merge(opts, true)
	return place(parent, name, NATURE + file + ".glb", pos, yaw, o, collider, collider_offset)


## Nature Kit material names → palette Materials (names read from the .glb files): grass / leafsGreen / leafsDark are
## the foliage (→ Plant); woodBark / woodBarkDark the trunks and the soil disc inside the pots (→ WoodDark); wood the
## pot body (→ `pot`); _defaultMat the pot's hidden inner disc (→ WoodDark); colorRed the one flower accent (→ Rope,
## oxblood). Every value is a Material, never a Color — `retarget` then never sees the kit's metallic-1 factors.
static func nature_recolor(pot: String = "MarbleDark") -> Dictionary:
	var plant := palette("Plant")
	var dark := palette("WoodDark")
	return {
		"grass": plant, "leafsGreen": plant, "leafsDark": plant,
		"woodBark": dark, "woodBarkDark": dark, "_defaultMat": dark,
		"wood": palette(pot),
		"colorRed": palette("Rope"), "colorYellow": palette("Brass"), "colorPurple": palette("MarbleDark"), "colorWhite": palette("Cream"),
	}


## The KayKit atlas is an 8 × 4 grid of flat colours (each cell a gentle top-to-bottom gradient, 128 × 256 px of the
## 1024² sheet); the mesh picks its colour by which cell a face's UVs sit in. This table says what each cell means in
## the bank: wood tones stay wood (the tan drawer fronts too, so cabinets read as two-tone wood), the blue upholstery
## becomes the deep green of the wainscot, the yellow accent (book spines, pillows) becomes the rope's oxblood, lamp
## shades glow as the Bulb, and the picture canvas is a deep-green panel rather than a blank white sheet.
const KAYKIT_CELLS: Array = [
	["WoodDark", "WoodDark", "WoodDark", "Wood", "Wood", "Wood", "Brass", "MarbleDark"],
	["Rope", "Rope", "MarbleDark", "MarbleDark", "Paper", "Paper", "Paper", "Graphite"],
	["Cream", "Bulb", "Graphite", "Paper", "Cream", "WoodDark", "Plant", "Plant"],
	["Steel", "Steel", "Steel", "Steel", "Steel", "Steel", "Steel", "Steel"],
]


static func kaykit_cell(uv: Vector2) -> String:
	var col := clampi(int(floor(uv.x * 8.0)), 0, 7)
	var row := clampi(int(floor(uv.y * 4.0)), 0, 3)
	return KAYKIT_CELLS[row][col]


## Rebuild every mesh under a KayKit .glb root as one surface per palette material: each triangle goes to the
## palette name of its UV-centroid cell (KAYKIT_CELLS). The mesh keeps its vertices, normals and UVs, so bake_static
## merges it with everything else in the same materials — no atlas texture, no new material, +0 draw calls.
static func _split_kaykit(root: Node) -> void:
	for mi in _meshes(root):
		var src := mi.mesh
		if src == null:
			continue
		var groups: Dictionary = {}
		var order: Array[String] = []
		for s in src.get_surface_count():
			var arrays: Array = src.surface_get_arrays(s)
			var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
			var uvs: PackedVector2Array = arrays[Mesh.ARRAY_TEX_UV]
			var idx: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			if idx.is_empty():
				idx = PackedInt32Array(range(verts.size()))
			var has_uv := uvs.size() == verts.size()
			var has_n := normals.size() == verts.size()
			for i in range(0, idx.size() - 2, 3):
				var a := idx[i]
				var b := idx[i + 1]
				var c := idx[i + 2]
				var uv := (uvs[a] + uvs[b] + uvs[c]) / 3.0 if has_uv else Vector2.ZERO
				var nm := kaykit_cell(uv)
				if not groups.has(nm):
					var st0 := SurfaceTool.new()
					st0.begin(Mesh.PRIMITIVE_TRIANGLES)
					groups[nm] = st0
					order.append(nm)
				var st: SurfaceTool = groups[nm]
				for v in [a, b, c]:
					if has_n:
						st.set_normal(normals[v])
					if has_uv:
						st.set_uv(uvs[v])
					st.add_vertex(verts[v])
		var out := ArrayMesh.new()
		for nm in order:
			var st: SurfaceTool = groups[nm]
			st.index()
			out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, st.commit_to_arrays())
			out.surface_set_material(out.get_surface_count() - 1, palette(nm))
		mi.mesh = out
		mi.set_meta("kaykit_split", order.size())


## Kenney Furniture Kit material names → bank palette. The kit's own names (read from the .glb files): wood, woodDark,
## carpet, carpetDarker, carpetWhite, metal, metalMedium, metalDark, glass, lamp, plant. A Color re-tints; a Material
## replaces outright (lamp shades become the emissive Bulb). Unknown names keep the kit colour.
static func kit_recolor() -> Dictionary:
	var t := ensure_theme()
	return {
		"wood": t.wood_color,
		"woodDark": t.wood_color.darkened(0.25),
		"carpet": t.wainscot_color,
		"carpetDarker": t.wainscot_color.darkened(0.25),
		"carpetWhite": t.cream_color,
		"metal": t.steel_color,
		"metalMedium": t.graphite_color.lightened(0.15),
		"metalDark": t.graphite_color,
		"glass": t.glass_color,
		"lamp": palette("Bulb"),
		"plant": t.plant_color,
	}


## Every surface → shared material. Palette names map to the theme; other flat colours merge by value (recolored if named).
static func retarget(root: Node, recolor: Dictionary = {}) -> void:
	for mi in _meshes(root):
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var src := mi.get_active_material(i)
			if src == null:
				continue
			var shared: Material = null
			var nm := src.resource_name
			if is_palette_name(nm):
				shared = palette(nm)
			elif src is BaseMaterial3D:
				var b := src as BaseMaterial3D
				if recolor.has(nm) and recolor[nm] is Material:
					shared = recolor[nm]
				elif b.albedo_texture != null:
					shared = textured(b.albedo_texture, b.albedo_color)
				else:
					var c: Color = b.albedo_color
					if recolor.has(nm):
						c = recolor[nm]
					var metallic := b.metallic
					var rough := snappedf(b.roughness, 0.1)
					if nm in ["metal", "metalMedium", "metalDark"]:
						metallic = 0.6
						rough = 0.4
					shared = color(c, metallic, rough, b.emission if b.emission_enabled else Color(0, 0, 0, 0), b.emission_energy_multiplier if b.emission_enabled else 0.0)
			if shared != null:
				mi.set_surface_override_material(i, shared)


## One material per texture (used by hero / kit .glb that carry an albedo map; the cast has its own
## `staff_material`, which is why nothing here special-cases the character folder any more).
static func textured(tex: Texture2D, tint: Color) -> StandardMaterial3D:
	var key := "tex|%s|%s" % [tex.resource_path if tex.resource_path != "" else str(tex.get_instance_id()), tint.to_html(false)]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.resource_name = key
	m.albedo_texture = tex
	m.albedo_color = tint
	m.roughness = 0.9
	m.metallic = 0.0
	_mats[key] = m
	return m


static func _meshes(root: Node) -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	if root is MeshInstance3D:
		out.append(root)
	for c in root.get_children():
		out.append_array(_meshes(c))
	return out


static func find_mesh(root: Node, name: String) -> MeshInstance3D:
	var n := root.find_child(name, true, false)
	return n as MeshInstance3D


## Merged AABB of every mesh under `root`, in `root`'s local space (before `root.scale`).
static func aabb(root: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for mi in _meshes(root):
		if mi.has_meta("face_carrier"):
			continue # a face carrier is a visual overlay, not part of the body's height fit
		var bb := rel_xform(mi, root) * mi.get_aabb()
		out = bb if first else out.merge(bb)
		first = false
	return out


## Transform of `node` relative to `root` (both may be outside the tree).
static func rel_xform(node: Node, root: Node) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var n: Node = node
	while n != null and n != root:
		if n is Node3D:
			xf = (n as Node3D).transform * xf
		n = n.get_parent()
	return xf


## Static mesh merging (WORLD-3D §6 "static mesh merging per zone"): every MeshInstance3D under `root` that is not
## marked `no_batch` (on itself or an ancestor below `root`) is appended into one ArrayMesh with one surface per
## material, and the originals are freed. Colliders, Area3Ds and Label3Ds are untouched. Draw calls fall from one per
## box to one per material — and the shadow pass, which redraws every caster per split, shrinks with them.
static func bake_static(root: Node3D, name: String = "StaticBatch") -> MeshInstance3D:
	var groups: Dictionary = {}
	var order: Array = []
	var victims: Array[MeshInstance3D] = []
	var surfaces := 0
	for mi in _meshes(root):
		if mi.mesh == null or _no_batch(mi, root):
			continue
		var xf := rel_xform(mi, root)
		for i in mi.mesh.get_surface_count():
			var m := mi.get_active_material(i)
			if m == null:
				continue
			var key := m.get_instance_id()
			if not groups.has(key):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				groups[key] = {"mat": m, "st": st}
				order.append(key)
			(groups[key]["st"] as SurfaceTool).append_from(mi.mesh, i, xf)
			surfaces += 1
		victims.append(mi)
	var mesh := ArrayMesh.new()
	for key in order:
		var g: Dictionary = groups[key]
		var arrays: Array = (g["st"] as SurfaceTool).commit_to_arrays()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		mesh.surface_set_material(mesh.get_surface_count() - 1, g["mat"])
	for mi in victims:
		if not is_instance_valid(mi):
			continue   # freed with a parent mesh earlier in the list
		var p := mi.get_parent()
		if p != null:
			p.remove_child(mi)
		mi.free()
	# glb roots whose every mesh went into the batch are now empty Node3Ds — drop them too
	for n in _all_nodes(root):
		if is_instance_valid(n) and n != root and n.has_meta("glb") and n.get_child_count() == 0:
			n.get_parent().remove_child(n)
			n.free()
	var out := MeshInstance3D.new()
	out.name = name
	out.mesh = mesh
	out.set_meta("baked_surfaces", surfaces)
	root.add_child(out)
	return out


static func _all_nodes(n: Node) -> Array[Node]:
	var out: Array[Node] = []
	for c in n.get_children():
		out.append(c)
		out.append_array(_all_nodes(c))
	return out


static func _no_batch(node: Node, root: Node) -> bool:
	var n: Node = node
	while n != null and n != root:
		if n.has_meta("no_batch"):
			return true
		n = n.get_parent()
	return false


## Active cast builder. When `USE_KAYKIT_CAST` is true, see `character_kaykit`; otherwise the Kenney staff path below.
## Scaled so the head top sits at `height`; returns {root, anim, face, skeleton}. `face` is null on the KayKit path.
static func character(role: String, height: float = 1.8) -> Dictionary:
	if USE_KAYKIT_CAST:
		return character_kaykit(role, height)
	return character_kenney(role, height)


static func walk_mps() -> float:
	return KAYKIT_WALK_MPS if USE_KAYKIT_CAST else STAFF_WALK_MPS


static func sprint_mps() -> float:
	return KAYKIT_SPRINT_MPS if USE_KAYKIT_CAST else STAFF_SPRINT_MPS


## KayKit Adventurers feel-spike: one mesh per role + bank clip aliases from Rig_Medium libraries.
## All surfaces on a body share one cached albedo material (Rogue / Rogue_Hooded share `rogue_texture`).
static func character_kaykit(role: String, height: float = 1.8) -> Dictionary:
	var mesh_name := str(KAYKIT_MESHES.get(role, KAYKIT_MESHES["greeter"]))
	var root := instance(KAYKIT_CHARACTERS + mesh_name + ".glb", {
		"center": true, "ground": true, "keep_materials": true,
	})
	var mat := kaykit_body_material(mesh_name)
	var remap: Dictionary = KAYKIT_ROLE_CELLS.get(role, {})
	for mi in _meshes(root):
		if mi.mesh == null:
			continue
		if not remap.is_empty() and mi.mesh is ArrayMesh:
			mi.mesh = _kaykit_role_mesh(mi.mesh as ArrayMesh, role, remap)
		for i in mi.mesh.get_surface_count():
			mi.set_surface_override_material(i, mat)
	# Drop fantasy accessory shells before aabb so height scale uses the bare silhouette.
	# Jacket cast glbs already omit accessories; HIDE_PARTS is empty unless a stock body is remounted.
	_kaykit_hide_parts(root, KAYKIT_HIDE_PARTS.get(role, []))
	var bb := aabb(root)
	var s := height / maxf(bb.size.y, 0.01)
	root.scale = Vector3.ONE * s
	root.position = Vector3(
		-(bb.position.x + bb.size.x / 2.0) * s,
		-bb.position.y * s,
		-(bb.position.z + bb.size.z / 2.0) * s,
	)
	var skeleton := _find_skeleton(root)
	var anim := _kaykit_ensure_anim_player(root, skeleton)
	_kaykit_install_bank_clips(anim)
	return {"root": root, "anim": anim, "face": null, "skeleton": skeleton}


## Free named MeshInstance3D children (KayKit accessory shells). Immediate free so aabb() excludes them this frame.
static func _kaykit_hide_parts(root: Node, names: Array) -> void:
	if names.is_empty():
		return
	var want: Dictionary = {}
	for n in names:
		want[str(n)] = true
	var doomed: Array[Node] = []
	for mi in _meshes(root):
		if want.has(mi.name):
			doomed.append(mi)
	for n in doomed:
		n.free()


## Bank-variant tint for a role that shares its body sheet with another role (KAYKIT_ROLE_CELLS): a copy of the
## imported ArrayMesh whose triangles in a remapped palette cell are shifted, whole cell to whole cell, into the spare
## cell painted for this role — the shading gradient inside the cell survives because the offset within the cell does
## not change. Bones / weights / normals ride along in the arrays, the shadow mesh is shared, and the copy is cached per
## (mesh, role) so eight instances still cost one mesh each. Same material, so the body count stays at five.
static func _kaykit_role_mesh(src: ArrayMesh, role: String, remap: Dictionary) -> ArrayMesh:
	var key := "%s|%s@%s" % [src.resource_path, src.resource_name, role]
	if _kaykit_meshes.has(key):
		return _kaykit_meshes[key]
	var out := ArrayMesh.new()
	out.resource_name = "%s_%s" % [src.resource_name, role]
	var cell := Vector2(1.0 / KAYKIT_CELL_COLS, 1.0 / KAYKIT_CELL_ROWS)
	for surface in src.get_surface_count():
		var arrays: Array = src.surface_get_arrays(surface)
		var src_uv: PackedVector2Array = arrays[Mesh.ARRAY_TEX_UV]
		var uv := src_uv.duplicate()
		var index: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		var indexed := index.size() > 0
		# Decide per triangle from its UV centroid (every KayKit triangle sits inside one cell), then move all three
		# corners by the same whole-cell offset — a corner on a cell edge must follow its triangle, not its own cell.
		# Shared corners are moved once (`moved`), from the source UVs, so two triangles never shift one vertex twice.
		var moved := PackedByteArray()
		moved.resize(uv.size())
		var tri_count := (index.size() if indexed else uv.size()) / 3
		for t in tri_count:
			var a := index[t * 3] if indexed else t * 3
			var b := index[t * 3 + 1] if indexed else t * 3 + 1
			var c := index[t * 3 + 2] if indexed else t * 3 + 2
			var centroid := (src_uv[a] + src_uv[b] + src_uv[c]) / 3.0
			var from := Vector2i(int(floor(centroid.x * KAYKIT_CELL_COLS)), int(floor(centroid.y * KAYKIT_CELL_ROWS)))
			if not remap.has(from):
				continue
			var to: Vector2i = remap[from]
			var shift := Vector2(float(to.x - from.x), float(to.y - from.y)) * cell
			for v in [a, b, c]:
				if moved[v] == 0:
					uv[v] = src_uv[v] + shift
					moved[v] = 1
		arrays[Mesh.ARRAY_TEX_UV] = uv
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	out.shadow_mesh = src.shadow_mesh
	_kaykit_meshes[key] = out
	return out


## One StandardMaterial3D per Adventurers body texture (cached). No outline / face sheet — KayKit faces are painted on.
static func kaykit_body_material(mesh_name: String) -> StandardMaterial3D:
	var tex_file := str(KAYKIT_TEXTURE_FILES.get(mesh_name, "ranger_texture.png"))
	var key := "kaykit_" + tex_file.get_basename()
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.resource_name = key
	m.albedo_texture = load(KAYKIT_CHARACTERS + tex_file)
	m.roughness = 0.85
	m.metallic = 0.0
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	_mats[key] = m
	return m


## Kenney staff (character style climb, 2026-09-08): **one** skinned .glb for the whole cast — Kenney's CC0
## `characterMedium` (804 verts, 1,604 tris, one surface, 32 deform bones) carrying the clips that
## tools/bank_staff_rig.py bakes, worn eight different ways. `role` picks a 340 px tile of the shared
## 1024² atlas; the tile is folded into a **copy of the mesh's UVs** rather than into a per-role material.
## Budget: 3 surfaces (body + outline next_pass + shadowless face) × (1 colour + 2 shadow passes) each.
static func character_kenney(role: String, height: float = 1.8) -> Dictionary:
	var root := instance(STAFF_GLB, {"center": true, "ground": true, "keep_materials": true})
	var tile := int(STAFF_TILES.get(role, STAFF_TILES["greeter"]))
	var mat := staff_material()
	for mi in _meshes(root):
		if mi.mesh is ArrayMesh:
			mi.mesh = _staff_mesh(mi.mesh as ArrayMesh, tile)
		for i in mi.mesh.get_surface_count():
			mi.set_surface_override_material(i, mat)
	var bb := aabb(root)
	var s := height / maxf(bb.size.y, 0.01)
	root.scale = Vector3.ONE * s
	root.position = Vector3(-(bb.position.x + bb.size.x / 2.0) * s, -bb.position.y * s, -(bb.position.z + bb.size.z / 2.0) * s)
	var skeleton := _find_skeleton(root)
	apply_role_scale(skeleton, role)
	var face := _face_carrier(root, skeleton, role)
	var anim := root.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if anim != null:
		for clip in STAFF_CLIPS:
			if anim.has_animation(clip):
				anim.get_animation(clip).loop_mode = Animation.LOOP_NONE if clip == "greet" else Animation.LOOP_LINEAR
	return {"root": root, "anim": anim, "face": face, "skeleton": skeleton}


static func _kaykit_ensure_anim_player(root: Node, _skeleton: Skeleton3D) -> AnimationPlayer:
	var existing := root.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if existing != null:
		# An embedded glb player must also resolve `Rig_Medium/Skeleton3D:*` from the glb root, wherever it sits.
		existing.root_node = existing.get_path_to(root)
		return existing
	var anim := AnimationPlayer.new()
	anim.name = "AnimationPlayer"
	# KayKit libraries author tracks as `Rig_Medium/Skeleton3D:bone` from the glb root. `root_node` is resolved
	# relative to the AnimationPlayer itself, so the player (a child of `root`) must point at its parent: `..`.
	# `.` made every track miss silently and left the cast in the T-pose bind (2026-09-09 Stage 0A).
	root.add_child(anim)
	anim.root_node = NodePath("..")
	return anim


static func _kaykit_install_bank_clips(anim: AnimationPlayer) -> void:
	if anim == null:
		return
	var lib := AnimationLibrary.new()
	var pending: Dictionary = {}
	for bank_name in KAYKIT_CLIP_SRC:
		pending[str(KAYKIT_CLIP_SRC[bank_name])] = str(bank_name)
	for file_name in KAYKIT_ANIM_FILES:
		if pending.is_empty():
			break
		var packed: PackedScene = load(KAYKIT_ANIMS + str(file_name)) as PackedScene
		if packed == null:
			push_warning("PropKit: missing KayKit anim library %s" % file_name)
			continue
		var tmp := packed.instantiate()
		var src := tmp.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if src == null:
			tmp.free()
			continue
		for full in src.get_animation_list():
			var short := String(full)
			var slash := short.rfind("/")
			if slash >= 0:
				short = short.substr(slash + 1)
			if not pending.has(short):
				continue
			var bank_clip: String = pending[short]
			var clip: Animation = src.get_animation(full).duplicate(true)
			clip.loop_mode = Animation.LOOP_NONE if bank_clip == "greet" or bank_clip == "refuse" else Animation.LOOP_LINEAR
			lib.add_animation(bank_clip, clip)
			pending.erase(short)
		tmp.free()
	for missing_src in pending:
		push_warning("PropKit: KayKit clip %s (bank %s) not found in anim libraries" % [missing_src, pending[missing_src]])
	if anim.has_animation_library(&""):
		anim.remove_animation_library(&"")
	anim.add_animation_library(&"", lib)


static func _find_skeleton(root: Node) -> Skeleton3D:
	for n in _all_nodes(root):
		if n is Skeleton3D:
			return n as Skeleton3D
	return null


static func apply_role_scale(skeleton: Skeleton3D, role: String) -> void:
	if skeleton == null:
		return
	var scales: Dictionary = STAFF_ROLE_SCALES.get(role, {})
	for bone_name in scales:
		var bone := skeleton.find_bone(str(bone_name))
		if bone >= 0:
			skeleton.set_bone_pose_scale(bone, scales[bone_name])


static func _face_carrier(root: Node3D, skeleton: Skeleton3D, role: String) -> MeshInstance3D:
	if skeleton == null or skeleton.find_bone("Head") < 0:
		push_warning("PropKit: staff face carrier could not find the Head bone")
		return null
	var attachment := BoneAttachment3D.new()
	attachment.name = "FaceAttachment"
	attachment.bone_name = "Head"
	attachment.set_meta("face_attachment", true)
	skeleton.add_child(attachment)
	var face := MeshInstance3D.new()
	face.name = "FaceCarrier"
	var quad := QuadMesh.new()
	quad.size = Vector2(0.30, 0.30)
	face.mesh = quad
	face.position = Vector3(0.0, 0.11, 0.165)
	face.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	face.material_override = face_material()
	face.set_instance_shader_parameter("frame", face_frame(role, "smile" if role != "player" else "neutral"))
	face.set_meta("face_carrier", true)
	attachment.add_child(face)
	return face


## The cast's albedo: the staff atlas, linear-filtered (the faces are vector art with soft gradients, unlike the
## Blocky block edges this replaced) with the inverted-hull outline hung off `next_pass`.
static func staff_material() -> StandardMaterial3D:
	if _mats.has("staff"):
		return _mats["staff"]
	var m := StandardMaterial3D.new()
	m.resource_name = "staff"
	m.albedo_texture = load(STAFF_ATLAS)
	m.roughness = 0.85
	m.metallic = 0.0
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	# a soft toon ramp on bodies only; Compatibility may flatten it back to Lambert, and the flat art still reads
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	m.next_pass = staff_outline()
	_mats["staff"] = m
	return m


## One shared, unshaded face-sheet material. `frame` is an instance uniform so eight characters can show eight
## portraits and five states without duplicating a material. The 2 px inset is the mip-safe gutter inside each 64 px
## cell (8 × 5 cells, 512 × 320 sheet).
static func face_material() -> ShaderMaterial:
	if _mats.has("staffFace"):
		return _mats["staffFace"] as ShaderMaterial
	var shader := Shader.new()
	shader.code = """
	shader_type spatial;
	// Alpha scissor keeps the face as an opaque Compatibility cutout: no soft transparent plate to sort against glass/counters.
	render_mode unshaded, cull_disabled, depth_draw_opaque;
instance uniform int frame = 0;
uniform sampler2D face_sheet;

void fragment() {
	int col = frame - (frame / 8) * 8;
	int row = frame / 8;
	vec2 cell = vec2(1.0 / 8.0, 1.0 / 5.0);
	vec2 pad = vec2(2.0 / 512.0, 2.0 / 320.0);
	vec2 uv = vec2(float(col), float(row)) * cell + pad + UV * (cell - pad * 2.0);
	vec4 face = texture(face_sheet, uv);
	ALBEDO = face.rgb;
	ALPHA = face.a;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
}
"""
	var m := ShaderMaterial.new()
	m.resource_name = "staffFace"
	m.shader = shader
	m.set_shader_parameter("face_sheet", load(STAFF_FACE_SHEET))
	_mats["staffFace"] = m
	return m


static func face_frame(role: String, state: String) -> int:
	var rows := {"neutral": 0, "smile": 1, "talk": 2, "concern": 3, "surprised": 4}
	var state_row: int = int(rows.get(state, 0))
	var role_col: int = int(STAFF_TILES.get(role, STAFF_TILES["greeter"]))
	return state_row * STAFF_FACE_COLS + role_col


static func set_face_state(face: MeshInstance3D, role: String, state: String) -> void:
	if face == null:
		return
	face.set_instance_shader_parameter("frame", face_frame(role, state))


## Character-only ink: an inverted hull (grow along the normal, cull the front faces, unshaded near-black).
## Compatibility-safe — no Forward+ pass, no full-screen Sobel — and it is the only style layer on the cast;
## the room keeps its own materials (GameDevOS `style-the-cast-separately-from-the-set`).
static func staff_outline() -> StandardMaterial3D:
	if _mats.has("staffOutline"):
		return _mats["staffOutline"]
	var m := StandardMaterial3D.new()
	m.resource_name = "staffOutline"
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(0.05, 0.045, 0.06)
	m.cull_mode = BaseMaterial3D.CULL_FRONT
	m.grow = true
	m.grow_amount = STAFF_OUTLINE          # model space; the root is scaled to ~0.47, so ≈ 1.3 cm on screen
	m.disable_receive_shadows = true
	m.disable_ambient_light = true
	_mats["staffOutline"] = m
	return m


## The role's tile folded into a copy of the mesh's UVs. One ArrayMesh per role, shared by every instance of it
## (skinning is per-MeshInstance3D, so sharing the mesh resource is free).
static func _staff_mesh(src: ArrayMesh, tile: int) -> ArrayMesh:
	if _staff_meshes.has(tile):
		return _staff_meshes[tile]
	var out := ArrayMesh.new()
	out.resource_name = "staff_tile_%d" % tile
	var origin := Vector2(float(tile % STAFF_COLS), float(tile / STAFF_COLS)) * STAFF_STRIDE
	for surface in src.get_surface_count():
		var arrays: Array = src.surface_get_arrays(surface)
		var uv: PackedVector2Array = arrays[Mesh.ARRAY_TEX_UV]
		for i in uv.size():
			uv[i] = (origin + uv[i] * STAFF_TILE) / STAFF_ATLAS_PX
		arrays[Mesh.ARRAY_TEX_UV] = uv
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	_staff_meshes[tile] = out
	return out
