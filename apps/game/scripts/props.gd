class_name PropKit
extends RefCounted
## Set-dressing loader with the material budget built in (docs/WORLD-3D-ENVIRONMENT.md §5 pipeline, §6 ≤ 40 unique
## materials). Two kinds of .glb come through here:
##  - hero props (assets/models/hero, made by tools/hero_props.py) name their materials after the palette — Marble,
##    Brass, BrassDark, Steel, SteelDark, Glass, … — and are re-pointed at the WingTheme colours, so the mesh carries
##    shape only (the two Dark tones are derived from the theme's brass / steel, Stage 2 hero recesses);
##  - Kenney Furniture Kit props (assets/models/kenney_furniture, CC0) carry 1–4 flat-colour materials each; identical
##    colours collapse into one shared StandardMaterial3D, and `recolor` re-tints named kit colours into the bank palette;
##  - Kenney Blocky Characters (assets/characters/kenney_blocky, CC0, Stage 3) all sample one atlas written by
##    tools/character_atlas.py, so every NPC and the player share a single nearest-filtered textured material;
##  - KayKit Furniture Bits (assets/models/kaykit_furniture, CC0, U7 viz Stage 6a) were authored against one flat-colour
##    palette atlas that tools/kaykit_pack.py strips out of the .glb: at load `_split_kaykit` reads each triangle's UV
##    cell and hands it the matching WingTheme palette material, so the denser fill costs zero new materials and
##    recolours with the wing like every hero prop.
##  - Stage 6c surface grain (assets/textures/surfaces, ambientCG CC0 albedo only): Marble / Wood / Ceiling sample
##    512² JPEGs tinted by the WingTheme colour. Same material slots — zero new unique materials. Floor stays the
##    procedural terrazzo (no photoreal floor map). Stage 6b (MrEliptik office pack) was skipped: itch NYOP, not free.
## Anything that blocks the player gets a StaticBody3D on layer 1 / mask 0 — colliders that block must not listen
## (U4+ lesson: Godot Physics on web shoves listening bodies).

const HERO := "res://assets/models/hero/"
const KIT := "res://assets/models/kenney_furniture/"
const KAYKIT := "res://assets/models/kaykit_furniture/"
const CHARACTERS := "res://assets/characters/kenney_blocky/"
const SURFACES := "res://assets/textures/surfaces/"

static var theme: WingTheme = null
static var _mats: Dictionary = {}
static var _scenes: Dictionary = {}


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


## One material per texture (the character atlas is shared by every character). Textures under CHARACTERS are
## flat-colour block art resampled to 256² tiles, so they sample nearest (with mipmaps) instead of blurring.
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
	if tex.resource_path.begins_with(CHARACTERS):
		m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
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


## Kenney Blocky Characters (CC0, Stage 3 — adult-ish silhouettes; Kenney Mini chibi until then): one animated .glb
## per skin, six rigid body parts driven by node tracks (no skin), 72 tris, one shared atlas material. Scaled so the
## head top sits at `height`; returns {root, anim}. Clips used: idle · walk · sprint (player) · emote-no (refusing) ·
## interact-right (working). Characters animate, so they never join bake_static: budget them as
## 6 surfaces × (1 colour + 2 shadow passes) = 18 draws each (GameDevOS lesson animated-nodes-cost-surfaces-times-passes).
static func character(file: String, height: float = 1.8) -> Dictionary:
	var path := CHARACTERS + file + ".glb"
	var root := instance(path, {"center": true, "ground": true})
	var bb := aabb(root)
	var s := height / maxf(bb.size.y, 0.01)
	root.scale = Vector3.ONE * s
	root.position = Vector3(-(bb.position.x + bb.size.x / 2.0) * s, -bb.position.y * s, -(bb.position.z + bb.size.z / 2.0) * s)
	var anim := root.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if anim != null:
		for clip in ["idle", "walk", "sprint", "interact-right", "static"]:
			if anim.has_animation(clip):
				anim.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
	return {"root": root, "anim": anim}
