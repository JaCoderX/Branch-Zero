extends Node3D
## Bank interior — docs/WORLD-3D-ENVIRONMENT.md §2 floor plan. U3 built it from boxes; the U7 early art pass keeps
## every footprint, collider and zone volume where it was and replaces the boxes in place with hero meshes
## (assets/models/hero, made by tools/hero_props.py), Kenney Furniture Kit props (CC0) and the Main-wing materials +
## lighting recipe (themes/wing_main.tres, WORLD-3D §7). 1 unit = 1 m; x east, z south (north is -z), origin at the
## centre of the 30 × 22 m footprint. Zones are Area3D volumes; entering one emits `zone_entered`.
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

var theme: WingTheme
var lamps: Array[OmniLight3D] = []


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
	_zones()
	# one merged mesh per material for everything static (WORLD-3D §6); colliders, zones and labels stay as they are
	PropKit.bake_static(self)


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
	wall("WallN", Vector3(0, WALL_H / 2, -half_d), Vector3(W + T, WALL_H, T), [1])
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
	# brass mullions so the glass reads as glass
	var brass := PropKit.palette("Brass")
	for x in [-15.0, -13.0, -11.0, -9.0, -7.0, -5.0, -3.0, -1.0]:
		box_m("MgrMullion%d" % int(-x), Vector3(x, WALL_H / 2, z), Vector3(0.08, WALL_H, 0.12), brass, false)
	box_m("MgrRail", Vector3(-8.0, 1.05, z), Vector3(14.0, 0.06, 0.12), brass, false)
	box_m("MgrLintel", Vector3(-8.0, WALL_H - 0.4, z), Vector3(2.2, 0.8, 0.12), graphite, false)
	plaque("MANAGER'S OFFICE", Vector3(-8.0, 3.45, z + 0.15), 0.0, 0.3, theme.graphite_color)
	# desk: two kit desks under one collider (3.0 × 0.8 × 1.2, as the greybox box)
	PropKit.kit(self, "MgrDeskW", "desk", Vector3(-8.75, 0, -8.6), PI, {"fit": Vector3(1.5, 0.78, 1.15)})
	PropKit.kit(self, "MgrDeskE", "desk", Vector3(-7.25, 0, -8.6), PI, {"fit": Vector3(1.5, 0.78, 1.15)})
	solid_box("MgrDesk", Vector3(-8.0, 0.4, -8.6), Vector3(3.0, 0.8, 1.2))
	PropKit.hero(self, "MgrStamp", "prop_stamp", Vector3(-7.0, 0.78, -8.6))
	PropKit.kit(self, "MgrScreen", "computerScreen", Vector3(-8.6, 0.78, -8.95), PI)
	PropKit.kit(self, "MgrKeyboard", "computerKeyboard", Vector3(-8.6, 0.78, -8.5), PI)
	PropKit.kit(self, "MgrLamp", "lampRoundTable", Vector3(-9.3, 0.78, -8.95))
	PropKit.kit(self, "MgrPlant", "plantSmall2", Vector3(-6.7, 0.78, -9.0))
	PropKit.kit(self, "MgrChairA", "chairCushion", Vector3(-8.8, 0, -7.6), 0.0, {}, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
	PropKit.kit(self, "MgrChairB", "chairCushion", Vector3(-7.2, 0, -7.6), 0.0, {}, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
	PropKit.kit(self, "MgrRug", "rugRectangle", Vector3(-8.0, 0.004, -8.4), 0.0, {"fit": Vector3(3.8, 0.01, 2.8)})
	PropKit.kit(self, "MgrBookcase", "bookcaseOpen", Vector3(-4.2, 0, -10.6), 0.0, {"fit": Vector3(1.0, 1.8, 0.4)}, Vector3(1.0, 1.8, 0.4), Vector3(0, 0.9, 0))
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
	PropKit.kit(self, "VaultBenchA", "benchCushion", Vector3(2.6, 0, -8.0), PI)
	PropKit.kit(self, "VaultBenchB", "benchCushion", Vector3(3.4, 0, -8.0), PI)
	solid_box("VaultBench", Vector3(3.0, 0.25, -8.0), Vector3(1.8, 0.5, 0.6))
	PropKit.kit(self, "MagazineRack", "bookcaseOpenLow", Vector3(1.6, 0, -9.5), 0.0, {"fit": Vector3(0.5, 1.2, 0.4)}, Vector3(0.5, 1.2, 0.4), Vector3(0, 0.6, 0))
	plaque("Why do banks wait?", Vector3(1.6, 1.4, -9.2), 0.0, 0.18, theme.graphite_color)
	box_m("VaultWindow", Vector3(13.5, 1.6, -10.85), Vector3(2.0, 1.2, 0.1), glass, false)
	box_m("VaultWindowFrame", Vector3(13.5, 1.6, -10.83), Vector3(2.16, 1.36, 0.06), brass, false)
	box_m("VaultWindowLedge", Vector3(13.5, 1.0, -10.65), Vector3(2.2, 0.08, 0.4), PropKit.palette("MarbleDark"), false)
	PropKit.kit(self, "VaultLedgePlant", "plantSmall3", Vector3(14.3, 1.04, -10.65))
	plaque("VAULT WINDOW", Vector3(13.5, 2.5, -10.7), 0.0, 0.3, theme.trim_color)


# ---------------------------------------------------------------- west column: counters 1 & 2 and the Name Desk

func _west_column() -> void:
	_counter("Counter1", 3.0, "COUNTER 1")
	_counter("Counter2", -1.0, "COUNTER 2")
	# Name Desk — static dress only; U5 wires Petra, the claim form and the names board (NamesBoardQuad) here.
	PropKit.kit(self, "NameDesk", "desk", Vector3(-12.5, 0, -4.0), PI, {"fit": Vector3(2.4, 0.8, 1.0)}, Vector3(2.4, 0.8, 1.0), Vector3(0, 0.4, 0))
	PropKit.hero(self, "Engraver", "prop_engraver", Vector3(-12.0, 0.8, -4.0), 0.0)
	PropKit.kit(self, "NameDeskPlant", "plantSmall1", Vector3(-13.4, 0.8, -4.1))
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
	plaque("NAME DESK\n(opens with U5)", Vector3(-12.5, 2.2, -4.9), 0.0, 0.3, theme.graphite_color)
	plaque("Approved payees\n• Florist\n• Landlord\n• Demo merchant", Vector3(-14.8, 2.4, 3.0), PI / 2, 0.24, theme.graphite_color, "PayeeList")
	box_m("PayeeListBoard", Vector3(-14.83, 2.4, 3.0), Vector3(0.03, 1.2, 2.6), PropKit.palette("Paper"), false)
	plaque("Services at this counter\n• Payment over the counter\n• Scheduled wire (via the vault)", Vector3(-14.8, 2.4, -1.0), PI / 2, 0.24, theme.graphite_color, "ServiceMenu")
	box_m("ServiceMenuBoard", Vector3(-14.83, 2.4, -1.0), Vector3(0.03, 1.2, 3.2), PropKit.palette("Paper"), false)


## Marble counter (hero mesh, 1.1 m, glass partition with a slot) under the greybox collider; printer + stamp on a
## teller-side shelf. The teller stands at x = -11.6, so the shelf stops at x = -11.3.
func _counter(name: String, z: float, label: String) -> void:
	PropKit.hero(self, name, "prop_counter", Vector3(-10.5, 0, z), PI / 2, {}, Vector3(0.9, 1.1, 3.6), Vector3(0, 0.55, 0))
	box_m(name + "Shelf", Vector3(-11.15, 1.02, z), Vector3(0.3, 0.05, 3.6), PropKit.palette("Wood"), false)
	PropKit.hero(self, name + "Printer", "prop_printer", Vector3(-11.15, 1.045, z + 1.2), PI / 2)
	PropKit.hero(self, name + "Stamp", "prop_stamp", Vector3(-11.15, 1.045, z - 1.0))
	plaque(label, Vector3(-10.5, 3.0, z), PI / 2, 0.5, theme.graphite_color)


# ---------------------------------------------------------------- account opening (the desk with the plant)

func _account_opening() -> void:
	PropKit.kit(self, "AODeskW", "desk", Vector3(-9.65, 0, 8.0), 0.0, {"fit": Vector3(1.3, 0.78, 1.1)})
	PropKit.kit(self, "AODeskE", "desk", Vector3(-8.35, 0, 8.0), 0.0, {"fit": Vector3(1.3, 0.78, 1.1)})
	solid_box("AODesk", Vector3(-9.0, 0.4, 8.0), Vector3(2.6, 0.8, 1.1))
	PropKit.kit(self, "AOScreen", "computerScreen", Vector3(-8.6, 0.78, 8.15), 0.0)
	PropKit.kit(self, "AOKeyboard", "computerKeyboard", Vector3(-8.6, 0.78, 7.7), 0.0)
	PropKit.kit(self, "AODeskPlant", "plantSmall3", Vector3(-9.9, 0.78, 8.3))
	box_m("AOLeaflet", Vector3(-8.0, 0.79, 8.2), Vector3(0.2, 0.006, 0.28), PropKit.palette("Paper"), false)
	PropKit.kit(self, "AOChairA", "chairCushion", Vector3(-9.6, 0, 9.3), PI, {}, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
	PropKit.kit(self, "AOChairB", "chairCushion", Vector3(-8.4, 0, 9.3), PI, {}, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
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
	for i in 4:
		var x := -4.5 + i * 3.0
		PropKit.kit(self, "Bench%dA" % i, "benchCushion", Vector3(x - 0.4, 0, 2.5), 0.0)
		PropKit.kit(self, "Bench%dB" % i, "benchCushion", Vector3(x + 0.4, 0, 2.5), 0.0)
		solid_box("Bench%d" % i, Vector3(x, 0.25, 2.5), Vector3(1.8, 0.5, 0.6))
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
	plaque("ELEVATOR\nMAIN / ARC\n(Arc wing opens with U6)", Vector3(11.45, 3.3, 0.5), -PI / 2, 0.28, theme.wall_color)
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


## Trigger volumes. Names match dialogue conditions and the HUD zone chip. Unchanged since U3.
func _zones() -> void:
	zone("Entrance", Vector3(6.0, 1.5, 8.0), Vector3(18.0, 3.0, 6.0))
	zone("Account Opening", Vector3(-9.0, 1.5, 8.0), Vector3(12.0, 3.0, 6.0))
	zone("Lobby", Vector3(0.5, 1.5, 0.0), Vector3(15.0, 3.0, 10.0))
	zone("Counter", Vector3(-11.5, 1.5, 1.0), Vector3(7.0, 3.0, 8.0))
	zone("Vault antechamber", Vector3(8.0, 1.5, -8.0), Vector3(14.0, 3.0, 6.0))
	zone("Manager's office", Vector3(-8.0, 1.5, -8.0), Vector3(14.0, 3.0, 6.0))


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
