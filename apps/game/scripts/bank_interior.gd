extends Node3D
## Bank interior — docs/WORLD-3D-ENVIRONMENT.md §2 floor plan. U3 built it from boxes; the U7 early art pass keeps
## every footprint, collider and zone volume where it was and replaces the boxes in place with hero meshes
## (assets/models/hero, made by tools/hero_props.py), Kenney Furniture Kit props (CC0) and the Main-wing materials +
## lighting recipe (themes/wing_main.tres, WORLD-3D §7). 1 unit = 1 m; x east, z south (north is -z), origin at the
## centre of the 30 × 22 m footprint. Zones are Area3D volumes; entering one emits `zone_entered`.
## U7 viz Stage 4 dresses the visible wall faces and the ceiling in place (`_shell`, `_coffers`): pilasters, frieze,
## framed panels, wainscot stiles and coffer beams, all BoxMesh pieces in existing palette materials with no collider,
## so they merge into the static batch at zero extra draw calls and zero new materials.
## U7 viz Stage 6a swaps the Kenney *fill* in the high-traffic zones (lobby seating, vault antechamber, manager's office,
## behind the counters) for denser KayKit Furniture Bits (CC0) split into the same palette materials (PropKit.kaykit):
## couches where the bench pairs were, side tables + lamps, credenzas, a dressed cabinet, framed pictures, rugs. Every
## pre-existing collider keeps its size and place; the few new solids stand behind counters or against the north wall.
##
## Rules kept from U4+: props that block the player collide on layer 1 and listen on mask 0 (Godot Physics on web
## shoves listening bodies); nothing sits in the manager door (x ∈ [-9, -7] at z = -5), the vault opening
## (x ∈ [6, 10]) or on the teller's escort waypoints (~(-8.5, 5.6) → (-2, -1) → (6, -3.5) → (8, -6.8)).

signal zone_entered(zone: String)
signal zone_exited(zone: String)

const W := 30.0
const D := 22.0
const WALL_H := 4.5
const T := 0.3
const WAINSCOT_H := 0.95
const SKYLIGHT := Rect2(-6.0, -4.0, 12.0, 9.0)   # x, z, w, d — the open ceiling over the lobby
# Stage 4 shell modules (docs/WORLD-3D-ENVIRONMENT.md §1 art-deco lobby): a deep-green frieze with brass fillets just
# under the clerestory sills (3.45), raised panels between the pilasters above the wainscot cap (1.0)
const FRIEZE_Y0 := 3.12
const FRIEZE_Y1 := 3.34
const PANEL_Y0 := 1.25
const PANEL_Y1 := 2.95
const PILASTER_W := 0.36
const BEAM_DROP := 0.28   # coffer beams hang this far under the ceiling slabs (pendant canopies sit at the slab)

var theme: WingTheme
var lamps: Array[OmniLight3D] = []
var shell_pieces := 0   # BoxMesh modules the Stage 4 shell added; tests/run_viz_budget.gd asserts they exist and were baked


func _ready() -> void:
	theme = PropKit.ensure_theme()
	_floor()
	_outer_walls()
	_ceiling()
	_north_strip()
	_west_column()
	_account_opening()
	_lobby_furniture()
	_east_column()
	_lamps_and_windows()
	_shell()
	_coffers()
	_zones()
	_count_fill()
	# one merged mesh per material for everything static (WORLD-3D §6); colliders, zones and labels stay as they are
	PropKit.bake_static(self)


## Stage 6a bookkeeping for tests/run_viz_budget.gd, taken before the bake frees the KayKit roots: how many KayKit
## props were placed, how many of their meshes were split into palette surfaces, and their triangle count.
func _count_fill() -> void:
	var instances := 0
	var split := 0
	var tris := 0
	for n in PropKit._all_nodes(self):
		if n.has_meta("glb") and str(n.get_meta("glb")).begins_with(PropKit.KAYKIT):
			instances += 1
		if n is MeshInstance3D and n.has_meta("kaykit_split") and (n as MeshInstance3D).mesh != null:
			split += 1
			tris += (n as MeshInstance3D).mesh.get_faces().size() / 3
	set_meta("kaykit_instances", instances)
	set_meta("kaykit_split_meshes", split)
	set_meta("kaykit_tris", tris)


# ---------------------------------------------------------------- shell

func _floor() -> void:
	# terrazzo plane on a 20 cm slab collider (the slab is what the player stands on)
	var body := StaticBody3D.new()
	body.name = "Floor"
	body.position = Vector3(0, -0.1, 0)
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(W, 0.2, D)
	shape.shape = bs
	body.add_child(shape)
	var mi := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(W, D)
	mi.mesh = plane
	mi.position.y = 0.1
	mi.material_override = PropKit.floor_material()
	body.add_child(mi)
	add_child(body)
	# compass rosette in the lobby floor: brass ring, green field, brass core
	disc("Rosette", Vector3(0, 0.004, 0.5), 2.2, 0.01, PropKit.palette("Brass"))
	disc("RosetteField", Vector3(0, 0.008, 0.5), 1.7, 0.01, PropKit.palette("MarbleDark"))
	disc("RosetteCore", Vector3(0, 0.012, 0.5), 0.45, 0.01, PropKit.palette("Brass"))
	var n := plaque("N", Vector3(0, 0.03, -1.35), 0.0, 0.3, theme.trim_color)
	n.rotation.x = -PI / 2


func _outer_walls() -> void:
	var half_w := W / 2.0
	var half_d := D / 2.0
	# north wall in two runs either side of the vault strongroom cut (x ∈ [VAULT_X0, VAULT_X1], see _vault_interior);
	# the run above the cut is a plain lintel box (a wall() piece would hang its wainscot at 3.55 m)
	wall("WallN_a", Vector3((-half_w - T / 2.0 + VAULT_X0) / 2.0, WALL_H / 2, -half_d), Vector3(VAULT_X0 + half_w + T / 2.0, WALL_H, T), [1])
	wall("WallN_b", Vector3((VAULT_X1 + half_w + T / 2.0) / 2.0, WALL_H / 2, -half_d), Vector3(half_w + T / 2.0 - VAULT_X1, WALL_H, T), [1])
	box("WallN_lintel", Vector3((VAULT_X0 + VAULT_X1) / 2.0, (VAULT_H + WALL_H) / 2.0, -half_d), Vector3(VAULT_X1 - VAULT_X0, WALL_H - VAULT_H, T), theme.wall_color)
	_vault_interior()
	wall("WallW", Vector3(-half_w, WALL_H / 2, 0), Vector3(T, WALL_H, D + T), [1])
	wall("WallE", Vector3(half_w, WALL_H / 2, 0), Vector3(T, WALL_H, D + T), [-1])
	# south wall with the entrance gap x ∈ [3, 7]
	wall("WallS_a", Vector3((-half_w + 3.0) / 2.0, WALL_H / 2, half_d), Vector3(half_w + 3.0, WALL_H, T), [-1])
	wall("WallS_b", Vector3((7.0 + half_w) / 2.0, WALL_H / 2, half_d), Vector3(half_w - 7.0, WALL_H, T), [-1])
	box("EntranceLintel", Vector3(5.0, WALL_H - 0.5, half_d), Vector3(4.2, 1.0, T + 0.1), theme.trim_color)
	plaque("BRANCH ZERO — est. block 0", Vector3(5.0, 3.5, half_d - 0.25), 0.0, 0.3, theme.trim_color)
	# cornice along the outer walls
	var cm := PropKit.palette("Brass")
	box_m("CorniceN", Vector3(0, WALL_H - 0.08, -half_d + T / 2 + 0.04), Vector3(W, 0.16, 0.08), cm, false)
	box_m("CorniceW", Vector3(-half_w + T / 2 + 0.04, WALL_H - 0.08, 0), Vector3(0.08, 0.16, D), cm, false)
	box_m("CorniceE", Vector3(half_w - T / 2 - 0.04, WALL_H - 0.08, 0), Vector3(0.08, 0.16, D), cm, false)
	box_m("CorniceS", Vector3(0, WALL_H - 0.08, half_d - T / 2 - 0.04), Vector3(W, 0.16, 0.08), cm, false)
	# revolving door: four glass wings on a brass axis inside two brass rings
	var glass := PropKit.palette("Glass")
	box_m("DoorPaneA", Vector3(5.0, 1.1, half_d), Vector3(1.6, 2.2, 0.05), glass, false)
	box_m("DoorPaneB", Vector3(5.0, 1.1, half_d), Vector3(0.05, 2.2, 1.6), glass, false)
	cylinder_m("DoorAxis", Vector3(5.0, 1.1, half_d), 0.04, 2.2, cm, false)
	ring("DoorRingFloor", Vector3(5.0, 0.02, half_d), 0.95, 0.03, cm)
	ring("DoorRingTop", Vector3(5.0, 2.22, half_d), 0.95, 0.04, cm)


# ---------------------------------------------------------------- vault strongroom (U7 polish finding 9)

# The strongroom sits behind the north wall, x ∈ [VAULT_X0, VAULT_X1], from the wall's outer face (VAULT_Z0) back
# to VAULT_Z1, under a VAULT_H ceiling. The only see-through is a square throat inscribed in the door's collar
# (half-side THROAT_HALF about DOOR_CY), so the shut door still covers it; the graphite plate around the throat
# reads as the door's back plate where the frame's own Mouth disc used to be (vault_door.gd hides that disc).
const VAULT_X0 := 6.2
const VAULT_X1 := 9.8
const VAULT_Z0 := -11.15
const VAULT_Z1 := -13.7
const VAULT_H := 3.55
const THROAT_HALF := 1.26     # (DOOR_R 1.6 + collar 0.18) / sqrt 2
const THROAT_CY := 1.75       # vault_door.gd DOOR_CY

var vault_pieces := 0   # tests/run_viz_budget.gd asserts the strongroom was built


## A shallow strongroom behind the vault door so OPEN shows something worth waiting for (WORLD-3D §2.1: the player
## never goes inside — a solid, invisible throat block keeps it that way). Palette materials only, all mesh-only, so
## every piece bakes into the static batch: +0 draw calls, +0 materials. Lit by ambient and the antechamber pendant
## (shadowless omnis reach through walls); a Bulb strip on the ceiling gives the lit-strongroom cue.
func _vault_interior() -> void:
	var cx := (VAULT_X0 + VAULT_X1) / 2.0
	var wz := -D / 2.0                 # wall plane centre (z = -11)
	var graphite := PropKit.palette("Graphite")
	var cream := PropKit.palette("Cream")
	var green := PropKit.palette("MarbleDark")
	var wood := PropKit.palette("Wood")
	var brass := PropKit.palette("Brass")
	var steel := PropKit.palette("Steel")
	var steel_dark := PropKit.palette("SteelDark")
	var paper := PropKit.palette("Paper")
	var piece := func(n: String, pos: Vector3, size: Vector3, m: Material) -> void:
		slab("Vault" + n, pos, size, m)
		vault_pieces += 1
	# throat plate at the wall plane: graphite around the square opening
	var tx0 := cx - THROAT_HALF
	var tx1 := cx + THROAT_HALF
	var ty0 := THROAT_CY - THROAT_HALF
	var ty1 := THROAT_CY + THROAT_HALF
	piece.call("ThroatW", Vector3((VAULT_X0 + tx0) / 2.0, VAULT_H / 2.0, wz), Vector3(tx0 - VAULT_X0, VAULT_H, T), graphite)
	piece.call("ThroatE", Vector3((tx1 + VAULT_X1) / 2.0, VAULT_H / 2.0, wz), Vector3(VAULT_X1 - tx1, VAULT_H, T), graphite)
	piece.call("ThroatTop", Vector3(cx, (ty1 + VAULT_H) / 2.0, wz), Vector3(tx1 - tx0, VAULT_H - ty1, T), graphite)
	piece.call("ThroatSill", Vector3(cx, ty0 / 2.0, wz), Vector3(tx1 - tx0, ty0, T), graphite)
	piece.call("ThroatSillCap", Vector3(cx, ty0 + 0.02, wz), Vector3(tx1 - tx0 + 0.06, 0.04, T + 0.08), brass)
	solid_box("VaultThroat", Vector3(cx, VAULT_H / 2.0, wz), Vector3(VAULT_X1 - VAULT_X0, VAULT_H, T))
	# the room: floor at the sill, cream walls and ceiling, deep-green back lining
	var depth := VAULT_Z0 - VAULT_Z1
	var zc := (VAULT_Z0 + VAULT_Z1) / 2.0
	piece.call("Floor", Vector3(cx, ty0 - 0.05, zc), Vector3(VAULT_X1 - VAULT_X0, 0.1, depth), steel_dark)
	piece.call("Ceiling", Vector3(cx, VAULT_H + 0.1, zc), Vector3(VAULT_X1 - VAULT_X0 + 0.4, 0.2, depth + 0.2), cream)
	piece.call("WallW", Vector3(VAULT_X0 - 0.1, VAULT_H / 2.0, zc), Vector3(0.2, VAULT_H, depth), cream)
	piece.call("WallE", Vector3(VAULT_X1 + 0.1, VAULT_H / 2.0, zc), Vector3(0.2, VAULT_H, depth), cream)
	piece.call("WallBack", Vector3(cx, VAULT_H / 2.0, VAULT_Z1 - 0.1), Vector3(VAULT_X1 - VAULT_X0 + 0.4, VAULT_H, 0.2), green)
	piece.call("Underfloor", Vector3(cx, (ty0 - 0.1) / 2.0, zc), Vector3(VAULT_X1 - VAULT_X0 + 0.4, ty0 - 0.1, depth + 0.2), graphite)
	piece.call("Strip", Vector3(cx, VAULT_H - 0.03, zc + 0.3), Vector3(2.4, 0.05, 0.14), PropKit.palette("Bulb"))
	# back shelving: two wood uprights, three boards, cash stacks (paper with a green band) and brass bars
	var shelf_d := 0.42
	var sz := VAULT_Z1 + shelf_d / 2.0
	for x in [cx - 1.5, cx + 1.5]:
		piece.call("Upright%d" % int(x * 10), Vector3(x, (ty0 + 2.85) / 2.0, sz), Vector3(0.06, 2.85 - ty0, shelf_d), wood)
	var boards: Array[float] = [ty0 + 0.5, ty0 + 1.2, ty0 + 1.9]
	for i in boards.size():
		var y: float = boards[i]
		piece.call("Shelf%d" % i, Vector3(cx, y, sz), Vector3(3.0, 0.05, shelf_d), wood)
		for k in 6:
			var x := cx - 1.25 + k * 0.5
			if i == 1 and k >= 2 and k <= 3:
				continue   # the middle board keeps a gap for the deed box
			piece.call("Cash%d_%d" % [i, k], Vector3(x, y + 0.025 + 0.08, sz), Vector3(0.34, 0.16, 0.22), paper)
			piece.call("Band%d_%d" % [i, k], Vector3(x, y + 0.025 + 0.08, sz), Vector3(0.36, 0.05, 0.24), green)
	piece.call("DeedBox", Vector3(cx, boards[1] + 0.025 + 0.16, sz), Vector3(0.9, 0.32, 0.34), steel)
	piece.call("DeedBoxLid", Vector3(cx, boards[1] + 0.025 + 0.33, sz), Vector3(0.94, 0.03, 0.38), steel_dark)
	# a pallet of bars on the floor, a pyramid of 4 + 3 + 2, with the top row turned
	var py := ty0 + 0.04
	piece.call("Pallet", Vector3(cx, py, VAULT_Z1 + 1.15), Vector3(1.1, 0.08, 0.7), wood)
	var rows := [[4, 0.0], [3, 0.0], [2, 0.0]]
	for r in rows.size():
		var n: int = rows[r][0]
		for k in n:
			var x := cx - (n - 1) * 0.125 + k * 0.25
			piece.call("Bar%d_%d" % [r, k], Vector3(x, py + 0.04 + 0.05 + r * 0.1, VAULT_Z1 + 1.15), Vector3(0.22, 0.1, 0.5), brass)
	# side lockers: steel deed boxes on the east and west walls
	for i in 3:
		var y := ty0 + 0.25 + i * 0.5
		piece.call("LockerW%d" % i, Vector3(VAULT_X0 + 0.25, y, VAULT_Z1 + 1.9), Vector3(0.5, 0.4, 0.45), steel if i % 2 == 0 else steel_dark)
		piece.call("LockerE%d" % i, Vector3(VAULT_X1 - 0.25, y, VAULT_Z1 + 1.9), Vector3(0.5, 0.4, 0.45), steel_dark if i % 2 == 0 else steel)
	set_meta("vault_pieces", vault_pieces)


## Ceiling slabs everywhere except the lobby skylight; the skylight glass casts no shadow so the sun pools on the floor.
func _ceiling() -> void:
	var cy := WALL_H + 0.1
	var cm := PropKit.palette("Ceiling")
	var s := SKYLIGHT
	var half_w := W / 2.0
	var half_d := D / 2.0
	slab("CeilingN", Vector3(0, cy, (-half_d + s.position.y) / 2.0), Vector3(W, 0.2, s.position.y + half_d), cm)
	slab("CeilingS", Vector3(0, cy, (s.end.y + half_d) / 2.0), Vector3(W, 0.2, half_d - s.end.y), cm)
	slab("CeilingW", Vector3((-half_w + s.position.x) / 2.0, cy, s.get_center().y), Vector3(s.position.x + half_w, 0.2, s.size.y), cm)
	slab("CeilingE", Vector3((s.end.x + half_w) / 2.0, cy, s.get_center().y), Vector3(half_w - s.end.x, 0.2, s.size.y), cm)
	var brass := PropKit.palette("Brass")
	var c := s.get_center()
	slab("SkyCurbN", Vector3(c.x, cy + 0.15, s.position.y - 0.1), Vector3(s.size.x + 0.4, 0.5, 0.2), brass)
	slab("SkyCurbS", Vector3(c.x, cy + 0.15, s.end.y + 0.1), Vector3(s.size.x + 0.4, 0.5, 0.2), brass)
	slab("SkyCurbW", Vector3(s.position.x - 0.1, cy + 0.15, c.y), Vector3(0.2, 0.5, s.size.y), brass)
	slab("SkyCurbE", Vector3(s.end.x + 0.1, cy + 0.15, c.y), Vector3(0.2, 0.5, s.size.y), brass)
	for z in [-1.0, 2.0]:
		slab("SkyMullionX%d" % int(z), Vector3(c.x, cy + 0.36, z), Vector3(s.size.x, 0.08, 0.08), brass)
	for x in [-2.0, 2.0]:
		slab("SkyMullionZ%d" % int(x), Vector3(x, cy + 0.36, c.y), Vector3(0.08, 0.08, s.size.y), brass)
	var glass := slab("SkyGlass", Vector3(c.x, cy + 0.37, c.y), Vector3(s.size.x, 0.04, s.size.y), PropKit.palette("Glass"))
	glass.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	glass.set_meta("no_batch", true)


# ---------------------------------------------------------------- north strip: manager's office (west, glass) and vault antechamber (east)

func _north_strip() -> void:
	var z := -5.0
	var glass := PropKit.palette("Glass")
	var graphite := PropKit.palette("Graphite")
	# manager glass partition x ∈ [-15, -1] with a door gap x ∈ [-9, -7]
	box_m("MgrGlassA", Vector3(-12.0, WALL_H / 2, z), Vector3(6.0, WALL_H, 0.08), glass, true)
	box_m("MgrGlassB", Vector3(-4.0, WALL_H / 2, z), Vector3(6.0, WALL_H, 0.08), glass, true)
	box_m("MgrGlassE", Vector3(-1.0, WALL_H / 2, -8.0), Vector3(0.08, WALL_H, 6.0), glass, true)
	# brass mullions so the glass reads as glass. U7 polish finding 2: the door gap x ∈ [-9, -7] holds nothing — the
	# two jamb mullions stand just outside it and the rail is split either side of it (it used to run straight
	# across the doorway at 1.05 m as a sill).
	var brass := PropKit.palette("Brass")
	for x in [-15.0, -13.0, -11.0, -5.0, -3.0, -1.0]:
		box_m("MgrMullion%d" % int(-x), Vector3(x, WALL_H / 2, z), Vector3(0.08, WALL_H, 0.12), brass, false)
	box_m("MgrJambW", Vector3(-9.06, WALL_H / 2, z), Vector3(0.12, WALL_H, 0.14), brass, false)
	box_m("MgrJambE", Vector3(-6.94, WALL_H / 2, z), Vector3(0.12, WALL_H, 0.14), brass, false)
	box_m("MgrRailW", Vector3(-12.0, 1.05, z), Vector3(6.0, 0.06, 0.12), brass, false)
	box_m("MgrRailE", Vector3(-4.0, 1.05, z), Vector3(6.0, 0.06, 0.12), brass, false)
	box_m("MgrLintel", Vector3(-8.0, WALL_H - 0.4, z), Vector3(2.2, 0.8, 0.12), graphite, false)
	plaque("MANAGER'S OFFICE", Vector3(-8.0, 3.45, z + 0.15), 0.0, 0.3, theme.graphite_color)
	# desk: two kit desks under one collider (3.0 × 0.8 × 1.2, as the greybox box)
	PropKit.kit(self, "MgrDeskW", "desk", Vector3(-8.75, 0, -8.6), PI, {"fit": Vector3(1.5, 0.78, 1.15)})
	PropKit.kit(self, "MgrDeskE", "desk", Vector3(-7.25, 0, -8.6), PI, {"fit": Vector3(1.5, 0.78, 1.15)})
	solid_box("MgrDesk", Vector3(-8.0, 0.4, -8.6), Vector3(3.0, 0.8, 1.2))
	PropKit.hero(self, "MgrStamp", "prop_stamp", Vector3(-7.0, 0.78, -8.6))
	PropKit.kit(self, "MgrScreen", "computerScreen", Vector3(-8.6, 0.78, -8.95), PI)
	PropKit.kit(self, "MgrKeyboard", "computerKeyboard", Vector3(-8.6, 0.78, -8.5), PI)
	# Stage 6a: KayKit fill — shaded table lamp, padded guest chairs (they face +z, so yaw PI turns them to the desk),
	# striped rug, a dressed cabinet on the old bookcase collider, a credenza with ledgers west of the poster, pictures
	# in the north-wall panels either side of it, a standing lamp in the south-west corner
	PropKit.kaykit(self, "MgrLamp", "lamp_table", Vector3(-9.3, 0.78, -8.95), 0.0, {"fit": Vector3(0.34, 0.46, 0.34)})
	PropKit.kit(self, "MgrPlant", "plantSmall2", Vector3(-6.7, 0.78, -9.0))
	PropKit.kaykit(self, "MgrChairA", "chair_A", Vector3(-8.8, 0, -7.6), PI, {"scale": 0.68}, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
	PropKit.kaykit(self, "MgrChairB", "chair_A", Vector3(-7.2, 0, -7.6), PI, {"scale": 0.68}, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
	PropKit.kaykit(self, "MgrRug", "rug_rectangle_stripes_B", Vector3(-8.0, 0.004, -8.4), 0.0, {"fit": Vector3(3.8, 0.02, 2.8)})
	PropKit.kaykit(self, "MgrBookcase", "cabinet_medium_decorated", Vector3(-4.2, 0, -10.6), 0.0, {"fit": Vector3(1.2, 1.8, 0.45)}, Vector3(1.0, 1.8, 0.4), Vector3(0, 0.9, 0))
	PropKit.kaykit(self, "MgrCredenza", "cabinet_medium", Vector3(-11.8, 0, -10.6), 0.0, {"fit": Vector3(1.8, 0.85, 0.5)}, Vector3(1.8, 0.85, 0.5), Vector3(0, 0.425, 0))
	PropKit.kaykit(self, "MgrLedgers", "book_set", Vector3(-12.3, 0.85, -10.6), 0.0, {"fit": Vector3(0.6, 0.34, 0.28)})
	PropKit.kaykit(self, "MgrPictureW", "pictureframe_medium", Vector3(-12.6, 2.25, -10.82), 0.0, {"fit": Vector3(0.7, 0.9, 0.06), "ground": false})
	PropKit.kaykit(self, "MgrPictureE", "pictureframe_large_A", Vector3(-3.45, 2.3, -10.82), 0.0, {"fit": Vector3(1.0, 1.2, 0.06), "ground": false})
	PropKit.kaykit(self, "MgrFloorLamp", "lamp_standing", Vector3(-14.4, 0, -10.4), 0.0, {"fit": Vector3(0.45, 1.75, 0.45)}, Vector3(0.35, 1.75, 0.35), Vector3(0, 0.875, 0))
	PropKit.hero(self, "Shredder", "prop_shredder", Vector3(-12.5, 0, -9.5), 0.0, {}, Vector3(0.6, 0.9, 0.5), Vector3(0, 0.45, 0))
	plaque("SHREDDER", Vector3(-12.5, 1.2, -9.2), 0.0, 0.22, theme.graphite_color)
	plaque("Branch limits\nover the counter: up to {limit} {symbol}\nabove that: the vault, cooling {timelock}", Vector3(-8.0, 2.4, -10.8), 0.0, 0.2, theme.graphite_color, "LimitsPoster")
	box_m("LimitsPosterBoard", Vector3(-8.0, 2.4, -10.83), Vector3(3.2, 1.3, 0.03), PropKit.palette("Paper"), false)
	# vault antechamber x ∈ [1, 15]: partition with an opening x ∈ [6, 10]
	wall("VaultPartA", Vector3(3.5, WALL_H / 2, z), Vector3(5.0, WALL_H, T), [-1, 1])
	wall("VaultPartB", Vector3(12.5, WALL_H / 2, z), Vector3(5.0, WALL_H, T), [-1, 1])
	box("VaultLintel", Vector3(8.0, WALL_H - 0.5, z), Vector3(4.3, 1.0, T), theme.trim_color)
	# on the lintel, above the opening, so it never sits in front of the door clock from the lobby
	plaque("VAULT", Vector3(8.0, 4.05, z + 0.2), 0.0, 0.5, theme.graphite_color)
	# Stage 6a: a green couch on the bench collider, an oval rug under it, a standing lamp beside it, a set of ledgers
	# on the magazine rack, pictures in the two north-wall panels west of the door
	PropKit.kaykit(self, "VaultCouch", "couch", Vector3(3.0, 0, -8.0), PI, {"fit": Vector3(1.8, 0.8, 0.75)})
	solid_box("VaultBench", Vector3(3.0, 0.25, -8.0), Vector3(1.8, 0.5, 0.6))
	PropKit.kaykit(self, "VaultRug", "rug_oval_B", Vector3(3.0, 0.004, -8.1), 0.0, {"fit": Vector3(2.8, 0.02, 1.9)})
	PropKit.kaykit(self, "VaultFloorLamp", "lamp_standing", Vector3(1.5, 0, -7.4), 0.0, {"fit": Vector3(0.45, 1.75, 0.45)}, Vector3(0.35, 1.75, 0.35), Vector3(0, 0.875, 0))
	PropKit.kit(self, "MagazineRack", "bookcaseOpenLow", Vector3(1.6, 0, -9.5), 0.0, {"fit": Vector3(0.5, 1.2, 0.4)}, Vector3(0.5, 1.2, 0.4), Vector3(0, 0.6, 0))
	PropKit.kaykit(self, "MagazineRackBooks", "book_set", Vector3(1.6, 1.2, -9.5), PI / 2, {"fit": Vector3(0.4, 0.26, 0.28)})
	PropKit.kaykit(self, "VaultPictureW", "pictureframe_large_B", Vector3(1.0, 2.2, -10.82), 0.0, {"fit": Vector3(2.0, 1.2, 0.06), "ground": false})
	PropKit.kaykit(self, "VaultPictureE", "pictureframe_large_A", Vector3(3.6, 2.2, -10.82), 0.0, {"fit": Vector3(1.0, 1.2, 0.06), "ground": false})
	plaque("Why do banks wait?", Vector3(1.6, 1.4, -9.2), 0.0, 0.18, theme.graphite_color)
	box_m("VaultWindow", Vector3(13.5, 1.6, -10.85), Vector3(2.0, 1.2, 0.1), glass, false)
	box_m("VaultWindowFrame", Vector3(13.5, 1.6, -10.83), Vector3(2.16, 1.36, 0.06), brass, false)
	box_m("VaultWindowLedge", Vector3(13.5, 1.0, -10.65), Vector3(2.2, 0.08, 0.4), PropKit.palette("MarbleDark"), false)
	PropKit.kit(self, "VaultLedgePlant", "plantSmall3", Vector3(14.3, 1.04, -10.65))
	plaque("VAULT WINDOW", Vector3(13.5, 2.5, -10.7), 0.0, 0.3, theme.trim_color)


# ---------------------------------------------------------------- west column: counters 1 & 2 and the Name Desk

func _west_column() -> void:
	_counter("Counter1", 3.0, "COUNTER 1")
	# U7 polish finding 3: Petra serves from the Counter 2 teller bay (main.gd NPCS), so Counter 2 is the Name Desk
	# window — the engraver replaces its stamp and the wall sign behind it lists the name services. The old Name
	# Desk table north of it stays as her records annex, under the names board on the west wall.
	_counter("Counter2", -1.0, "COUNTER 2 · NAME DESK", "prop_engraver")
	# Stage 6a fill behind the tellers (unreachable for the player, so the two solids change no walkable footprint):
	# a credenza under the payee list, a ledger shelf under the service menu, a stool behind each teller
	PropKit.kaykit(self, "Counter1Credenza", "cabinet_medium", Vector3(-14.55, 0, 3.0), PI / 2, {"fit": Vector3(2.0, 0.85, 0.5)}, Vector3(0.5, 0.85, 2.0), Vector3(0, 0.425, 0))
	PropKit.kaykit(self, "Counter1Stool", "chair_stool", Vector3(-12.5, 0, 3.0), 0.0, {"fit": Vector3(0.45, 0.6, 0.45)})
	PropKit.kaykit(self, "Counter2Shelf", "shelf_B_large_decorated", Vector3(-14.6, 0.9, -1.0), PI / 2, {"fit": Vector3(2.0, 0.82, 0.5)})
	PropKit.kaykit(self, "Counter2Stool", "chair_stool", Vector3(-12.5, 0, -1.0), 0.0, {"fit": Vector3(0.45, 0.6, 0.45)})
	PropKit.kit(self, "NameDesk", "desk", Vector3(-12.5, 0, -4.0), PI, {"fit": Vector3(2.4, 0.8, 1.0)}, Vector3(2.4, 0.8, 1.0), Vector3(0, 0.4, 0))
	PropKit.kit(self, "NameDeskPlant", "plantSmall1", Vector3(-13.4, 0.8, -4.1))
	box_m("NameDeskLedger", Vector3(-12.0, 0.82, -4.0), Vector3(0.36, 0.04, 0.26), PropKit.palette("Paper"), false)
	PropKit.hero(self, "NamesBoardFrame", "prop_names_board_frame", Vector3(-14.65, 2.3, -3.8), PI / 2)
	var quad := MeshInstance3D.new()
	quad.name = "NamesBoardQuad"   # U5: put the registered-names SubViewport texture on this quad (2.3 × 1.2 m)
	var qm := QuadMesh.new()
	qm.size = Vector2(2.3, 1.2)
	quad.mesh = qm
	quad.position = Vector3(-14.77, 2.3, -3.8)
	quad.rotation.y = PI / 2
	quad.material_override = PropKit.color(Color(0.06, 0.07, 0.09), 0.0, 1.0)
	quad.set_meta("no_batch", true)   # stays its own node so U5 can swap the material
	add_child(quad)
	plaque("NAME DESK", Vector3(-12.5, 2.2, -4.9), 0.0, 0.3, theme.graphite_color)
	plaque("Approved payees\n• Florist\n• Landlord\n• Demo merchant", Vector3(-14.8, 2.4, 3.0), PI / 2, 0.24, theme.graphite_color, "PayeeList")
	box_m("PayeeListBoard", Vector3(-14.83, 2.4, 3.0), Vector3(0.03, 1.2, 2.6), PropKit.palette("Paper"), false)
	plaque("Name Desk · Counter 2\n• Claim a name under branchzero.eth\n• Update your passbook records\n• Pay by name at Counter 1", Vector3(-14.8, 2.4, -1.0), PI / 2, 0.24, theme.graphite_color, "ServiceMenu")
	box_m("ServiceMenuBoard", Vector3(-14.83, 2.4, -1.0), Vector3(0.03, 1.2, 3.2), PropKit.palette("Paper"), false)


## Marble counter (hero mesh, 1.1 m, glass partition with a slot) under the greybox collider; printer + stamp (or
## another hero tool) on a teller-side shelf. The teller stands at x = -11.6, so the shelf stops at x = -11.3.
func _counter(name: String, z: float, label: String, tool: String = "prop_stamp") -> void:
	PropKit.hero(self, name, "prop_counter", Vector3(-10.5, 0, z), PI / 2, {}, Vector3(0.9, 1.1, 3.6), Vector3(0, 0.55, 0))
	box_m(name + "Shelf", Vector3(-11.15, 1.02, z), Vector3(0.3, 0.05, 3.6), PropKit.palette("Wood"), false)
	PropKit.hero(self, name + "Printer", "prop_printer", Vector3(-11.15, 1.045, z + 1.2), PI / 2)
	PropKit.hero(self, name + "Tool", tool, Vector3(-11.15, 1.045, z - 1.0), PI / 2 if tool != "prop_stamp" else 0.0)
	plaque(label, Vector3(-10.5, 3.0, z), PI / 2, 0.5, theme.graphite_color)


# ---------------------------------------------------------------- account opening (the desk with the plant)

## U7 polish finding 5: the desk faces the room. Ines stands on its south side (between the desk and the south wall,
## main.gd NPCS) with the screen and keyboard on her side; the customer chairs sit on the north (lobby) side, so a
## player walking in from the lobby meets the desk first and Ines behind it.
func _account_opening() -> void:
	PropKit.kit(self, "AODeskW", "desk", Vector3(-9.65, 0, 8.0), PI, {"fit": Vector3(1.3, 0.78, 1.1)})
	PropKit.kit(self, "AODeskE", "desk", Vector3(-8.35, 0, 8.0), PI, {"fit": Vector3(1.3, 0.78, 1.1)})
	solid_box("AODesk", Vector3(-9.0, 0.4, 8.0), Vector3(2.6, 0.8, 1.1))
	PropKit.kit(self, "AOScreen", "computerScreen", Vector3(-8.6, 0.78, 7.85), PI)
	PropKit.kit(self, "AOKeyboard", "computerKeyboard", Vector3(-8.6, 0.78, 8.3), PI)
	PropKit.kit(self, "AODeskPlant", "plantSmall3", Vector3(-9.9, 0.78, 8.3))
	box_m("AOLeaflet", Vector3(-8.0, 0.79, 7.75), Vector3(0.2, 0.006, 0.28), PropKit.palette("Paper"), false)
	PropKit.kit(self, "AOChairA", "chairCushion", Vector3(-10.0, 0, 6.7), 0.0, {}, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
	PropKit.kit(self, "AOChairB", "chairCushion", Vector3(-8.0, 0, 6.7), 0.0, {}, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
	# the landmark plant ("the desk with the plant")
	PropKit.kit(self, "AOPlant", "pottedPlant", Vector3(-11.6, 0, 9.6), 0.3, {"scale": 4.0}, Vector3(1.0, 2.2, 1.0), Vector3(0, 1.1, 0))
	PropKit.kit(self, "BrochureRack", "bookcaseOpen", Vector3(-6.0, 0, 10.6), 0.0, {"fit": Vector3(1.0, 1.6, 0.3)}, Vector3(1.0, 1.6, 0.3), Vector3(0, 0.8, 0))
	PropKit.kit(self, "AORug", "rugRectangle", Vector3(-9.0, 0.004, 8.4), 0.0, {"fit": Vector3(3.6, 0.01, 3.0)})
	plaque("ACCOUNT OPENING", Vector3(-9.0, 3.0, 10.8), PI, 0.35, theme.graphite_color)
	plaque("Sign in once. Consent once.\nAfter that the tellers stamp your slips.", Vector3(-6.0, 1.9, 10.4), PI, 0.18, theme.graphite_color)
	# low partition between Account Opening and the entrance
	box("AOPartition", Vector3(-3.0, 0.6, 8.0), Vector3(0.15, 1.2, 6.0), theme.wall_color)
	box_m("AOPartitionCap", Vector3(-3.0, 1.22, 8.0), Vector3(0.22, 0.04, 6.1), PropKit.palette("Brass"), false)


# ---------------------------------------------------------------- lobby

func _lobby_furniture() -> void:
	# Stage 6a: a green couch on each bench collider (facing the entrance like the benches did), a side table with a
	# shaded lamp in the three gaps between them
	for i in 4:
		var x := -4.5 + i * 3.0
		PropKit.kaykit(self, "Couch%d" % i, "couch", Vector3(x, 0, 2.5), 0.0, {"fit": Vector3(1.8, 0.8, 0.75)})
		solid_box("Bench%d" % i, Vector3(x, 0.25, 2.5), Vector3(1.8, 0.5, 0.6))
	for i in 3:
		var x := -3.0 + i * 3.0
		PropKit.kaykit(self, "SideTable%d" % i, "table_small", Vector3(x, 0, 2.5), 0.0, {"fit": Vector3(0.55, 0.55, 0.55)}, Vector3(0.55, 0.55, 0.55), Vector3(0, 0.275, 0))
		PropKit.kaykit(self, "SideLamp%d" % i, "lamp_table", Vector3(x, 0.55, 2.5), 0.0, {"fit": Vector3(0.32, 0.44, 0.32)})
	# Lobby side of the north partition. Off the manager door (x ∈ [-9, -7]) and the vault
	# opening (x ∈ [6, 10]); escort last lobby waypoint is ~(6, -3.5).
	var plant_x := PackedFloat32Array([-5.0, -1.0, 3.0])
	for i in plant_x.size():
		PropKit.kit(self, "LobbyPlant%d" % i, "pottedPlant", Vector3(plant_x[i], 0, -3.2), i * 1.1, {"scale": 3.0})
		solid_cylinder("LobbyPlant%dBody" % i, Vector3(plant_x[i], 1.0, -3.2), 0.5, 1.4)
	PropKit.hero(self, "WaterCooler", "prop_water_cooler", Vector3(8.0, 0, 4.5))
	# split-flap housing on the north partition; the rows are scripts/ledger_board.gd's SubViewport quad at z = -4.7
	PropKit.hero(self, "LedgerFrame", "prop_board_frame", Vector3(0, 3.0, -4.72))
	# rope queue in front of the counters (west of the escort line)
	var rope := PropKit.palette("Rope")
	var posts: Array[float] = [-2.4, -0.4, 1.6]
	for i in posts.size():
		PropKit.hero(self, "RopePost%d" % i, "prop_rope_post", Vector3(-8.0, 0, posts[i]))
		if i > 0:
			var mid: float = (posts[i] + posts[i - 1]) / 2.0
			var r := MeshInstance3D.new()
			r.name = "Rope%d" % i
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.022
			cyl.bottom_radius = 0.022
			cyl.height = posts[i] - posts[i - 1] - 0.1
			r.mesh = cyl
			r.position = Vector3(-8.0, 0.84, mid)
			r.rotation.x = PI / 2
			r.material_override = rope
			add_child(r)
	# entrance
	PropKit.kit(self, "Doormat", "rugDoormat", Vector3(5.0, 0.004, 9.6), 0.0, {"fit": Vector3(2.2, 0.01, 1.2)})
	PropKit.kit(self, "CoatRack", "coatRackStanding", Vector3(8.6, 0, 9.9), 0.0, {}, Vector3(0.5, 1.6, 0.5), Vector3(0, 0.8, 0))


# ---------------------------------------------------------------- east column: elevator, FX desk, side door

func _east_column() -> void:
	var brass := PropKit.palette("Brass")
	box("Elevator", Vector3(13.0, WALL_H / 2, 0.5), Vector3(3.0, WALL_H, 3.0), theme.graphite_color)
	box_m("ElevatorDoorA", Vector3(11.47, 1.1, 0.13), Vector3(0.04, 2.2, 0.7), brass, false)
	box_m("ElevatorDoorB", Vector3(11.47, 1.1, 0.87), Vector3(0.04, 2.2, 0.7), brass, false)
	box_m("ElevatorFrame", Vector3(11.46, 2.3, 0.5), Vector3(0.03, 0.2, 1.7), brass, false)
	# hall lantern (floor indicator) + call panel: hero props (Stage 2), U6 wires the behaviour
	PropKit.hero(self, "ElevatorLantern", "prop_elevator_lantern", Vector3(11.46, 2.58, 0.5), -PI / 2)
	PropKit.hero(self, "ElevatorPanel", "prop_elevator_panel", Vector3(11.46, 1.25, -0.6), -PI / 2)
	# U6 Arc is deferred (docs/ARC.md §5b): the shaft says so, and main.gd refuses the trip with the same words
	plaque("ELEVATOR\nMAIN · ARC\nARC · coming soon", Vector3(11.45, 3.3, 0.5), -PI / 2, 0.28, theme.wall_color)
	# a paper notice taped across the car doors at eye height (the label sits a centimetre in front of its board)
	box_m("ArcNoticeBoard", Vector3(11.43, 1.55, 0.5), Vector3(0.02, 0.42, 0.98), PropKit.palette("Paper"), false)
	plaque("ARC FLOOR\ncoming soon", Vector3(11.41, 1.55, 0.5), -PI / 2, 0.15, theme.graphite_color, "ArcNotice")
	plaque("FX DESK\n(stretch)", Vector3(14.8, 2.2, -3.0), -PI / 2, 0.3, theme.graphite_color)
	plaque("SECURITY\nside door (lore)", Vector3(14.8, 2.2, 3.5), -PI / 2, 0.3, theme.graphite_color)
	PropKit.kit(self, "SideDoor", "doorwayFront", Vector3(14.85, 0, 3.5), -PI / 2, {"fit": Vector3(1.0, 2.2, 0.16)}, Vector3(0.1, 2.2, 1.0), Vector3(0, 1.1, 0))


# ---------------------------------------------------------------- lighting fixtures + clerestory windows (WORLD-3D §7)

## Eight pendants, each an OmniLight3D with shadows off (budget: one shadowed light, the sun). The Compatibility
## renderer lights at most 8 omnis per mesh, and the floor sees all of them — do not add a ninth.
func _lamps_and_windows() -> void:
	var spots := [
		Vector3(-2.0, WALL_H + 0.45, -1.0), Vector3(2.0, WALL_H + 0.45, -1.0),   # lobby, hung from the skylight mullion
		Vector3(-11.0, WALL_H, 1.0),                                              # counters
		Vector3(-9.0, WALL_H, 8.0),                                               # account opening
		Vector3(-8.0, WALL_H, -8.0),                                              # manager's office
		Vector3(8.0, WALL_H, -8.0),                                               # vault antechamber
		Vector3(-12.5, WALL_H, -3.6),                                             # name desk
		Vector3(5.0, WALL_H, 8.3),                                                # entrance
	]
	for i in spots.size():
		var p: Vector3 = spots[i]
		PropKit.hero(self, "Pendant%d" % i, "prop_pendant_lamp", p)
		var l := OmniLight3D.new()
		l.name = "Lamp%d" % i
		l.position = p + Vector3(0, -0.92, 0)
		l.light_color = theme.lamp_color
		l.light_energy = theme.lamp_energy
		l.omni_range = theme.lamp_range
		l.omni_attenuation = 1.4
		l.shadow_enabled = false
		add_child(l)
		lamps.append(l)
	# clerestory windows: cool emissive panes high on the outer walls — the "fill from windows"
	var pane := PropKit.color(theme.fill_color, 0.0, 0.2, theme.fill_color, 0.9)
	var brass := PropKit.palette("Brass")
	var half_w := W / 2.0
	var half_d := D / 2.0
	var y := 3.85
	for x in [-12.0, -9.0, -6.0, 9.0, 12.0]:
		box_m("WindowS%d" % int(x + 20), Vector3(x, y, half_d - T / 2 - 0.03), Vector3(2.1, 0.8, 0.04), brass, false)
		box_m("WindowSPane%d" % int(x + 20), Vector3(x, y, half_d - T / 2 - 0.06), Vector3(1.9, 0.62, 0.04), pane, false)
	for z in [-7.0, -3.0, 3.5, 7.0]:
		box_m("WindowE%d" % int(z + 20), Vector3(half_w - T / 2 - 0.03, y, z), Vector3(0.04, 0.8, 2.1), brass, false)
		box_m("WindowEPane%d" % int(z + 20), Vector3(half_w - T / 2 - 0.06, y, z), Vector3(0.04, 0.62, 1.9), pane, false)
	for z in [-3.5, 1.0, 5.0, 8.5]:
		box_m("WindowW%d" % int(z + 20), Vector3(-half_w + T / 2 + 0.03, y, z), Vector3(0.04, 0.8, 2.1), brass, false)
		box_m("WindowWPane%d" % int(z + 20), Vector3(-half_w + T / 2 + 0.06, y, z), Vector3(0.04, 0.62, 1.9), pane, false)


## Trigger volumes. Names match dialogue conditions and the HUD zone chip. Unchanged since U3 except the Counter
## volume, which U7 polish stretches north to the manager glass so Petra's records annex and the names board
## (z ∈ [-5, -3]) chip as Counter instead of nothing.
func _zones() -> void:
	zone("Entrance", Vector3(6.0, 1.5, 8.0), Vector3(18.0, 3.0, 6.0))
	zone("Account Opening", Vector3(-9.0, 1.5, 8.0), Vector3(12.0, 3.0, 6.0))
	zone("Lobby", Vector3(0.5, 1.5, 0.0), Vector3(15.0, 3.0, 10.0))
	zone("Counter", Vector3(-11.5, 1.5, 0.0), Vector3(7.0, 3.0, 10.0))
	zone("Vault antechamber", Vector3(8.0, 1.5, -8.0), Vector3(14.0, 3.0, 6.0))
	zone("Manager's office", Vector3(-8.0, 1.5, -8.0), Vector3(14.0, 3.0, 6.0))


# ---------------------------------------------------------------- Stage 4: architecture shell — wall faces and ceiling

## Dress the visible faces of the CSG walls so they stop reading as single-colour boxes. The walls, their colliders,
## the door gaps and every footprint stay exactly where U3 put them; only mesh is added. Coordinates are the
## along-wall axis (x for walls running east–west, z for north–south) in world metres; every hero prop, board and
## plaque on a face was measured first so pilasters and panels land between them, and `gaps` cut the frieze where a
## housing rises through it (ledger board, names board, vault frame, ACCOUNT OPENING plaque).
func _shell() -> void:
	var half_w := W / 2.0
	var half_d := D / 2.0
	var inner_x := [-half_w + T / 2.0, half_w - T / 2.0]
	var inner_z := [-half_d + T / 2.0, half_d - T / 2.0]
	var pz := -5.0
	# north partition — lobby face (+1, south) and vault face (-1, north). The ledger housing covers x ∈ [-4.4, 4.4] of
	# the lobby face; the pilasters at 5.75 / 10.25 turn the vault opening and its lintel into a portal.
	shell("VaultPartA", Vector3(3.5, WALL_H / 2, pz), Vector3(5.0, WALL_H, T), 1, {"pilasters": [5.75], "panels": [[4.6, 5.4]], "gaps": [[1.0, 4.45]]})
	shell("VaultPartA", Vector3(3.5, WALL_H / 2, pz), Vector3(5.0, WALL_H, T), -1, {"pilasters": [1.3, 5.75], "panels": [[1.7, 5.4]]})
	shell("VaultPartB", Vector3(12.5, WALL_H / 2, pz), Vector3(5.0, WALL_H, T), 1, {"pilasters": [10.25, 14.6], "panels": [[10.65, 14.2]]})
	shell("VaultPartB", Vector3(12.5, WALL_H / 2, pz), Vector3(5.0, WALL_H, T), -1, {"pilasters": [10.25, 14.6], "panels": [[10.65, 14.2]]})
	# north wall, south face: manager's office (x < -1) and vault antechamber (x > -1). The vault frame stands on
	# x ∈ [5.5, 10.5] (4.45 m tall, so the frieze stops for it), the window on [12.4, 14.6]; the limits poster gets a
	# brass frame instead of a panel.
	shell("WallN", Vector3(0, WALL_H / 2, -half_d), Vector3(W + T, WALL_H, T), 1, {
		"span": inner_x,
		"pilasters": [-14.6, -10.6, -5.5, -1.4, -0.6, 2.6, 4.6, 11.4],
		"panels": [[-14.2, -11.0], [-9.75, -6.25, 1.68, 3.06, false], [-5.1, -1.8], [-0.2, 2.2], [3.0, 4.2]],
		"gaps": [[5.4, 10.6]]})
	# west wall, east face: behind the counters and the Name Desk. The payee list and service menu boards get frames;
	# the names-board housing (z ∈ [-5.3, -2.3], top 3.29) interrupts the frieze.
	shell("WallW", Vector3(-half_w, WALL_H / 2, 0), Vector3(T, WALL_H, D + T), 1, {
		"span": inner_z,
		"pilasters": [-10.6, -7.9, -5.5, 1.15, 5.2, 7.9, 10.6],
		"panels": [[-10.2, -8.3], [-7.5, -5.9], [-2.65, 0.65, 1.75, 3.05, false], [1.65, 4.35, 1.75, 3.05, false], [5.6, 7.5], [8.3, 10.2]],
		"gaps": [[-5.4, -2.2]]})
	# east wall, west face: the elevator shaft stands on z ∈ [-1, 2] (0.35 m off the wall), the FX DESK plaque at
	# z = -3 gets a frame, the side door fills z ∈ [3, 4]
	shell("WallE", Vector3(half_w, WALL_H / 2, 0), Vector3(T, WALL_H, D + T), -1, {
		"span": inner_z,
		"pilasters": [-10.6, -7.9, -5.5, -4.4, -1.5, 2.4, 4.7, 7.9, 10.6],
		"panels": [[-10.2, -8.3], [-7.5, -5.9], [-3.9, -2.1, 1.75, 2.65, false], [5.1, 7.5], [8.3, 10.2]]})
	# south wall, north face, in its two halves either side of the entrance gap x ∈ [3, 7]: portal pilasters flank the
	# gap; the ACCOUNT OPENING plaque sits at y ≈ 3 over x ∈ [-11, -7], so that bay's panel is lower and the frieze skips it
	shell("WallS_a", Vector3((-half_w + 3.0) / 2.0, WALL_H / 2, half_d), Vector3(half_w + 3.0, WALL_H, T), -1, {
		"span": [inner_x[0], 3.0],
		"pilasters": [-14.6, -11.0, -7.5, -3.5, 2.55],
		"panels": [[-14.2, -11.4], [-10.6, -7.9, PANEL_Y0, 2.55], [-7.1, -3.9], [-3.1, 2.15]],
		"gaps": [[-11.3, -6.7]]})
	shell("WallS_b", Vector3((7.0 + half_w) / 2.0, WALL_H / 2, half_d), Vector3(half_w - 7.0, WALL_H, T), -1, {
		"span": [7.0, inner_x[1]],
		"pilasters": [7.45, 11.0, 14.6],
		"panels": [[7.85, 10.6], [11.4, 14.2]]})
	# elevator shaft (a graphite block to the ceiling): marble corner columns, green dado with brass cap, frieze and a
	# brass crown on its three lobby faces. The call panel (z = -0.6) and the hall lantern (y 2.58) stay clear; the
	# ELEVATOR plaque (y ≈ 2.9–3.8) sits where the frieze would run on the west face, so that face has none.
	var ev_pos := Vector3(13.0, WALL_H / 2, 0.5)
	var ev_size := Vector3(3.0, WALL_H, 3.0)
	shell("ElevatorW", ev_pos, ev_size, -1, {"along_x": false, "pilasters": [-0.95, 1.95], "dado": true, "crown": true, "frieze": false})
	shell("ElevatorN", ev_pos, ev_size, -1, {"along_x": true, "dado": true, "crown": true, "stiles": false})
	shell("ElevatorS", ev_pos, ev_size, 1, {"along_x": true, "dado": true, "crown": true, "stiles": false})


## One wall face. `pos` / `size` are the wall box; `face` is ±1 along the box's thin axis (the wall's normal).
## spec keys — pilasters: along-coords of marble pilasters (green base, brass fillet, brass capital) · panels:
## [a0, a1, (y0, y1, plate)] brass frames with a raised paper plate unless plate is false (a board already fills it) ·
## gaps: [a0, a1] the frieze skips · span: [a0, a1] to dress (default: the whole box) · along_x: override the axis ·
## frieze (true) · stiles (true): brass strips splitting the wainscot into panels · dado / crown (false): the green
## wainscot + cap and a brass top band for boxes that `wall()` did not build. Mesh only — no collider is ever added.
func shell(name: String, pos: Vector3, size: Vector3, face: int, spec: Dictionary) -> void:
	var along_x: bool = spec.get("along_x", size.x > size.z)
	var sgn := float(face)
	var plane := (pos.z + size.z / 2.0 * sgn) if along_x else (pos.x + size.x / 2.0 * sgn)
	var a0 := (pos.x - size.x / 2.0) if along_x else (pos.z - size.z / 2.0)
	var a1 := (pos.x + size.x / 2.0) if along_x else (pos.z + size.z / 2.0)
	if spec.has("span"):
		a0 = float(spec["span"][0])
		a1 = float(spec["span"][1])
	var tag := name + ("Face%s" % ("S" if face > 0 else "N")) if along_x else name + ("Face%s" % ("E" if face > 0 else "W"))
	var marble := PropKit.palette("Marble")
	var green := PropKit.palette("MarbleDark")
	var brass := PropKit.palette("Brass")
	var paper := PropKit.palette("Paper")
	# one piece: centred on along-coordinate `a`, `w` wide, from y0 to y1, standing p0..p1 proud of the face
	var piece := func(n: String, a: float, w: float, y0: float, y1: float, p0: float, p1: float, m: Material) -> void:
		var c := plane + sgn * (p0 + p1) / 2.0
		var d := p1 - p0
		var p := Vector3(a, (y0 + y1) / 2.0, c) if along_x else Vector3(c, (y0 + y1) / 2.0, a)
		var s := Vector3(w, y1 - y0, d) if along_x else Vector3(d, y1 - y0, w)
		slab(tag + n, p, s, m)
		shell_pieces += 1
	var pilasters: Array = spec.get("pilasters", [])
	for i in pilasters.size():
		var a := float(pilasters[i])
		piece.call("Pilaster%d" % i, a, PILASTER_W, 0.0, FRIEZE_Y0, 0.0, 0.10, marble)
		piece.call("PilasterBase%d" % i, a, PILASTER_W + 0.08, 0.0, 0.30, 0.0, 0.13, green)
		piece.call("PilasterFillet%d" % i, a, PILASTER_W + 0.10, 0.30, 0.34, 0.0, 0.14, brass)
		piece.call("PilasterCap%d" % i, a, PILASTER_W + 0.08, FRIEZE_Y0 - 0.10, FRIEZE_Y0, 0.0, 0.13, brass)
	if bool(spec.get("frieze", true)):
		var segs: Array = [[a0 + 0.02, a1 - 0.02]]
		for g in spec.get("gaps", []):
			var next: Array = []
			for sg in segs:
				if float(g[1]) <= float(sg[0]) or float(g[0]) >= float(sg[1]):
					next.append(sg)
					continue
				if float(g[0]) > float(sg[0]):
					next.append([sg[0], g[0]])
				if float(g[1]) < float(sg[1]):
					next.append([g[1], sg[1]])
			segs = next
		for i in segs.size():
			var mid := (float(segs[i][0]) + float(segs[i][1])) / 2.0
			var w := float(segs[i][1]) - float(segs[i][0])
			piece.call("Frieze%d" % i, mid, w, FRIEZE_Y0, FRIEZE_Y1, 0.0, 0.05, green)
			piece.call("FriezeLo%d" % i, mid, w, FRIEZE_Y0 - 0.03, FRIEZE_Y0, 0.0, 0.06, brass)
			piece.call("FriezeHi%d" % i, mid, w, FRIEZE_Y1, FRIEZE_Y1 + 0.03, 0.0, 0.06, brass)
	var panels: Array = spec.get("panels", [])
	for i in panels.size():
		var pnl: Array = panels[i]
		var y0 := float(pnl[2]) if pnl.size() > 2 else PANEL_Y0
		var y1 := float(pnl[3]) if pnl.size() > 3 else PANEL_Y1
		var plate := bool(pnl[4]) if pnl.size() > 4 else true
		var mid := (float(pnl[0]) + float(pnl[1])) / 2.0
		var w := float(pnl[1]) - float(pnl[0])
		var f := 0.035
		piece.call("PanelL%d" % i, float(pnl[0]) + f / 2.0, f, y0, y1, 0.0, 0.03, brass)
		piece.call("PanelR%d" % i, float(pnl[1]) - f / 2.0, f, y0, y1, 0.0, 0.03, brass)
		piece.call("PanelB%d" % i, mid, w - 2.0 * f, y0, y0 + f, 0.0, 0.03, brass)
		piece.call("PanelT%d" % i, mid, w - 2.0 * f, y1 - f, y1, 0.0, 0.03, brass)
		if plate:
			piece.call("Panel%d" % i, mid, w - 2.0 * f, y0 + f, y1 - f, 0.0, 0.015, paper)
	if bool(spec.get("dado", false)):
		piece.call("Dado", (a0 + a1) / 2.0, a1 - a0 - 0.02, 0.0, WAINSCOT_H, 0.0, 0.04, green)
		piece.call("DadoCap", (a0 + a1) / 2.0, a1 - a0 - 0.02, WAINSCOT_H, WAINSCOT_H + 0.05, 0.0, 0.055, brass)
	if bool(spec.get("stiles", true)):
		var edges: Array[float] = [a0]
		for a in pilasters:
			edges.append(float(a))
		edges.append(a1)
		edges.sort()
		for i in edges.size() - 1:
			var bay := edges[i + 1] - edges[i]
			var n := int(floor(bay / 2.6))
			for k in n:
				piece.call("Stile%d_%d" % [i, k], edges[i] + bay * float(k + 1) / float(n + 1), 0.03, 0.03, WAINSCOT_H - 0.02, 0.0, 0.055, brass)
	if bool(spec.get("crown", false)):
		piece.call("Crown", (a0 + a1) / 2.0, a1 - a0, WALL_H - 0.22, WALL_H - 0.08, 0.0, 0.06, brass)


## Coffered ceiling: marble beams with a brass fillet hang under the slabs on lines chosen to miss the eight
## pendants (0.84 m canopies at the slab), the skylight well (x ∈ [-6, 6], z ∈ [-4, 5]), the vault frame (top 4.45)
## and the ledger housing (top 4.44); a green band lines the skylight well under the brass curb. The skylight glass
## keeps its no-shadow / no-batch behaviour. Mesh only: nothing walks on or collides with the ceiling.
func _coffers() -> void:
	var marble := PropKit.palette("Marble")
	var brass := PropKit.palette("Brass")
	var green := PropKit.palette("MarbleDark")
	var half_w := W / 2.0 - T / 2.0
	var half_d := D / 2.0 - T / 2.0
	var s := SKYLIGHT
	var y_beam := WALL_H - BEAM_DROP / 2.0
	var y_fillet := WALL_H - BEAM_DROP - 0.015
	# [z, x0, x1] — beams running east–west
	var along_x := [
		[-9.5, -half_w, half_w], [-6.5, -half_w, half_w],
		[-2.0, -half_w, s.position.x], [-2.0, s.end.x, half_w],
		[1.8, -half_w, s.position.x], [1.8, s.end.x, half_w],
		[5.3, -half_w, half_w], [9.0, -half_w, half_w],
	]
	# [x, z0, z1] — beams running north–south
	var along_z := [
		[-13.4, -half_d, half_d], [-10.0, -half_d, half_d], [-6.6, -half_d, half_d],
		[-3.2, -half_d, -5.1], [-3.2, s.end.y, half_d],
		[0.2, -half_d, -5.1], [0.2, s.end.y, half_d],
		[4.0, -half_d, -5.1], [4.0, s.end.y, half_d],
		[8.0, -4.85, half_d],
		[12.0, -half_d, -5.15], [12.0, -4.85, half_d],
	]
	for i in along_x.size():
		var b: Array = along_x[i]
		var mid := (float(b[1]) + float(b[2])) / 2.0
		var len := float(b[2]) - float(b[1])
		slab("BeamX%d" % i, Vector3(mid, y_beam, float(b[0])), Vector3(len, BEAM_DROP, 0.22), marble)
		slab("BeamXFillet%d" % i, Vector3(mid, y_fillet, float(b[0])), Vector3(len, 0.03, 0.26), brass)
		shell_pieces += 2
	for i in along_z.size():
		var b: Array = along_z[i]
		var mid := (float(b[1]) + float(b[2])) / 2.0
		var len := float(b[2]) - float(b[1])
		slab("BeamZ%d" % i, Vector3(float(b[0]), y_beam, mid), Vector3(0.22, BEAM_DROP, len), marble)
		slab("BeamZFillet%d" % i, Vector3(float(b[0]), y_fillet, mid), Vector3(0.26, 0.03, len), brass)
		shell_pieces += 2
	# green band lining the skylight well, inside the brass curb (the curb's inner faces are flush with the opening)
	var c := s.get_center()
	var wy := WALL_H + 0.2   # the curb spans WALL_H … WALL_H + 0.5; the band sits in its lower half, under the glass
	slab("SkyWellN", Vector3(c.x, wy, s.position.y + 0.015), Vector3(s.size.x - 0.06, 0.3, 0.03), green)
	slab("SkyWellS", Vector3(c.x, wy, s.end.y - 0.015), Vector3(s.size.x - 0.06, 0.3, 0.03), green)
	slab("SkyWellW", Vector3(s.position.x + 0.015, wy, c.y), Vector3(0.03, 0.3, s.size.y - 0.06), green)
	slab("SkyWellE", Vector3(s.end.x - 0.015, wy, c.y), Vector3(0.03, 0.3, s.size.y - 0.06), green)
	shell_pieces += 4
	set_meta("shell_pieces", shell_pieces)


# ---------------------------------------------------------------- builders

## Marble wall with a deep-green wainscot and brass cap on the faces listed in `faces` (±1 along the wall's thin axis).
func wall(name: String, pos: Vector3, size: Vector3, faces: Array) -> Node3D:
	var root := box(name, pos, size, theme.wall_color)
	var along_x := size.x > size.z
	var wain := PropKit.palette("MarbleDark")
	var cap := PropKit.palette("Brass")
	for f in faces:
		var sign := float(f)
		var off := Vector3(0, 0, (size.z / 2.0 + 0.02) * sign) if along_x else Vector3((size.x / 2.0 + 0.02) * sign, 0, 0)
		var wsize := Vector3(size.x - 0.02, WAINSCOT_H, 0.04) if along_x else Vector3(0.04, WAINSCOT_H, size.z - 0.02)
		var csize := Vector3(size.x - 0.02, 0.05, 0.07) if along_x else Vector3(0.07, 0.05, size.z - 0.02)
		var base_y := -size.y / 2.0
		_mesh_child(root, name + "Wainscot%d" % int(sign), off + Vector3(0, base_y + WAINSCOT_H / 2.0, 0), wsize, wain)
		_mesh_child(root, name + "Cap%d" % int(sign), off + Vector3(0, base_y + WAINSCOT_H + 0.02, 0), csize, cap)
	return root


func _mesh_child(parent: Node3D, name: String, pos: Vector3, size: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = name
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = m
	parent.add_child(mi)
	return mi


## Ceiling piece: mesh only, no collider (the camera arm must not hit it; nothing walks on it).
func slab(name: String, pos: Vector3, size: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = name
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = m
	add_child(mi)
	return mi


## Invisible blocker (layer 1 / mask 0) under a prop whose mesh is not box-shaped.
func solid_box(name: String, pos: Vector3, size: Vector3) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = name + "Collider"
	body.position = pos
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	shape.shape = bs
	body.add_child(shape)
	add_child(body)
	return body


func solid_cylinder(name: String, pos: Vector3, radius: float, height: float) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = name + "Collider"
	body.position = pos
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var cs := CylinderShape3D.new()
	cs.radius = radius
	cs.height = height
	shape.shape = cs
	body.add_child(shape)
	add_child(body)
	return body


func box(name: String, pos: Vector3, size: Vector3, color: Color, solid: bool = true) -> Node3D:
	return box_m(name, pos, size, PropKit.color(color, 0.0, 0.85), solid)


func box_m(name: String, pos: Vector3, size: Vector3, m: Material, solid: bool = true) -> Node3D:
	var root: Node3D
	if solid:
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		shape.shape = bs
		body.add_child(shape)
		# Layer 1 so CharacterBody3D cannot walk through; mask 0 so Godot Physics on web
		# cannot shove this body when something slides into it.
		body.collision_layer = 1
		body.collision_mask = 0
		root = body
	else:
		root = Node3D.new()
	root.name = name
	root.position = pos
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.material_override = m
	root.add_child(mi)
	add_child(root)
	return root


func cylinder_m(name: String, pos: Vector3, radius: float, height: float, m: Material, solid: bool = true) -> Node3D:
	var root: Node3D
	if solid:
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var cs := CylinderShape3D.new()
		cs.radius = radius
		cs.height = height
		shape.shape = cs
		body.add_child(shape)
		body.collision_layer = 1
		body.collision_mask = 0
		root = body
	else:
		root = Node3D.new()
	root.name = name
	root.position = pos
	var mi := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mi.mesh = mesh
	mi.material_override = m
	root.add_child(mi)
	add_child(root)
	return root


func disc(name: String, pos: Vector3, radius: float, height: float, m: Material) -> Node3D:
	var n := Node3D.new()
	n.name = name
	n.position = pos
	var mi := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mi.mesh = mesh
	mi.material_override = m
	n.add_child(mi)
	add_child(n)
	return n


func ring(name: String, pos: Vector3, radius: float, thickness: float, m: Material) -> Node3D:
	var n := Node3D.new()
	n.name = name
	n.position = pos
	var mi := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = radius - thickness
	mesh.outer_radius = radius + thickness
	mesh.rings = 32
	mesh.ring_segments = 8
	mi.mesh = mesh
	mi.material_override = m
	n.add_child(mi)
	add_child(n)
	return n


## Signage. `{limit}` / `{timelock}` placeholders are filled from GameState once the session is known.
func plaque(text: String, pos: Vector3, yaw: float, size: float, color: Color, name: String = "") -> Label3D:
	var l := Label3D.new()
	if name != "":
		l.name = name
	l.text = text
	l.position = pos
	l.rotation.y = yaw
	l.pixel_size = 0.005 * size / 0.3
	l.font_size = 48
	l.outline_size = 6
	l.double_sided = false
	l.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	l.modulate = color
	l.outline_modulate = Color(0, 0, 0, 0.6)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.set_meta("template", text)
	add_child(l)
	return l


func zone(zone_name: String, pos: Vector3, size: Vector3) -> Area3D:
	var a := Area3D.new()
	a.name = "Zone " + zone_name
	a.position = pos
	a.monitoring = true
	a.monitorable = false
	var shape := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	shape.shape = bs
	a.add_child(shape)
	a.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			zone_entered.emit(zone_name))
	a.body_exited.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			zone_exited.emit(zone_name))
	add_child(a)
	return a


## Re-fill signage templates from the live session (limits poster, counter sign).
func refresh_signs() -> void:
	var v := GameState.vars()
	for c in get_children():
		if c is Label3D and c.has_meta("template"):
			c.text = Dialogue.interpolate(str(c.get_meta("template")), v)
