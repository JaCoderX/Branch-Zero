extends Node3D
## Bank interior greybox — docs/WORLD-3D-ENVIRONMENT.md §2 floor plan, built from boxes so the layout can be
## read from a screenshot before any art exists. 1 unit = 1 m; x east, z south (north is -z), origin at the
## centre of the 30 × 22 m footprint. Zones are Area3D volumes; entering one emits `zone_entered`.

signal zone_entered(zone: String)
signal zone_exited(zone: String)

const W := 30.0
const D := 22.0
const WALL_H := 4.5
const T := 0.3

const CREAM := Color(0.86, 0.80, 0.70)
const MARBLE := Color(0.93, 0.90, 0.84)
const BRASS := Color(0.78, 0.62, 0.30)
const GREEN := Color(0.16, 0.36, 0.28)
const GRAPHITE := Color(0.26, 0.28, 0.32)
const WOOD := Color(0.45, 0.30, 0.18)
const GLASS := Color(0.70, 0.85, 0.95, 0.28)
const PLANT := Color(0.20, 0.55, 0.25)

var _mats: Dictionary = {}


func _ready() -> void:
	_floor()
	_outer_walls()
	_north_strip()
	_west_column()
	_account_opening()
	_lobby_furniture()
	_east_column()
	_zones()


# ---------------------------------------------------------------- pieces

func _floor() -> void:
	box("Floor", Vector3(0, -0.1, 0), Vector3(W, 0.2, D), CREAM)
	# compass rosette in the lobby floor
	var r := disc("Rosette", Vector3(0, 0.005, 0.5), 2.2, 0.01, BRASS)
	r.rotation.y = 0.0


func _outer_walls() -> void:
	var half_w := W / 2.0
	var half_d := D / 2.0
	box("WallN", Vector3(0, WALL_H / 2, -half_d), Vector3(W + T, WALL_H, T), MARBLE)
	box("WallW", Vector3(-half_w, WALL_H / 2, 0), Vector3(T, WALL_H, D + T), MARBLE)
	box("WallE", Vector3(half_w, WALL_H / 2, 0), Vector3(T, WALL_H, D + T), MARBLE)
	# south wall with the entrance gap x ∈ [3, 7]
	box("WallS_a", Vector3((-half_w + 3.0) / 2.0, WALL_H / 2, half_d), Vector3(half_w + 3.0, WALL_H, T), MARBLE)
	box("WallS_b", Vector3((7.0 + half_w) / 2.0, WALL_H / 2, half_d), Vector3(half_w - 7.0, WALL_H, T), MARBLE)
	box("EntranceLintel", Vector3(5.0, WALL_H - 0.5, half_d), Vector3(4.2, 1.0, T), BRASS)
	plaque("BRANCH ZERO — est. block 0", Vector3(5.0, 3.5, half_d - 0.2), 0.0, 0.3, BRASS)
	# revolving door: two thin panes
	box("DoorPaneA", Vector3(5.0, 1.1, half_d), Vector3(1.6, 2.2, 0.05), GLASS, false)
	box("DoorPaneB", Vector3(5.0, 1.1, half_d), Vector3(0.05, 2.2, 1.6), GLASS, false)


## Manager's office (west, glass) and vault antechamber (east) along the north wall; partition at z = -5.
func _north_strip() -> void:
	var z := -5.0
	# manager glass partition x ∈ [-15, -1] with a door gap x ∈ [-9, -7]
	box("MgrGlassA", Vector3(-12.0, WALL_H / 2, z), Vector3(6.0, WALL_H, 0.08), GLASS, true)
	box("MgrGlassB", Vector3(-4.0, WALL_H / 2, z), Vector3(6.0, WALL_H, 0.08), GLASS, true)
	box("MgrGlassE", Vector3(-1.0, WALL_H / 2, -8.0), Vector3(0.08, WALL_H, 6.0), GLASS, true)
	box("MgrLintel", Vector3(-8.0, WALL_H - 0.4, z), Vector3(2.2, 0.8, 0.1), GRAPHITE)
	plaque("MANAGER'S OFFICE", Vector3(-8.0, 3.0, z + 0.15), 0.0, 0.35, GRAPHITE)
	box("MgrDesk", Vector3(-8.0, 0.4, -8.6), Vector3(3.0, 0.8, 1.2), WOOD)
	box("MgrStamp", Vector3(-7.0, 0.9, -8.6), Vector3(0.3, 0.2, 0.3), BRASS, false)
	box("Shredder", Vector3(-12.5, 0.45, -9.5), Vector3(0.6, 0.9, 0.5), GRAPHITE)
	plaque("SHREDDER", Vector3(-12.5, 1.2, -9.2), 0.0, 0.22, GRAPHITE)
	plaque("Branch limits\nover the counter: up to {limit} {symbol}\nabove that: the vault, cooling {timelock}", Vector3(-8.0, 2.4, -10.8), 0.0, 0.2, GRAPHITE, "LimitsPoster")
	# vault antechamber x ∈ [1, 15]: partition with an opening x ∈ [6, 10]
	box("VaultPartA", Vector3(3.5, WALL_H / 2, z), Vector3(5.0, WALL_H, T), MARBLE)
	box("VaultPartB", Vector3(12.5, WALL_H / 2, z), Vector3(5.0, WALL_H, T), MARBLE)
	box("VaultLintel", Vector3(8.0, WALL_H - 0.5, z), Vector3(4.3, 1.0, T), BRASS)
	plaque("VAULT", Vector3(8.0, 3.2, z + 0.2), 0.0, 0.6, BRASS)
	box("VaultBench", Vector3(3.0, 0.25, -8.0), Vector3(1.8, 0.5, 0.6), WOOD)
	box("MagazineRack", Vector3(1.6, 0.6, -9.5), Vector3(0.5, 1.2, 0.4), GRAPHITE)
	plaque("Why do banks wait?", Vector3(1.6, 1.4, -9.2), 0.0, 0.18, GRAPHITE)
	box("VaultWindow", Vector3(13.5, 1.6, -10.85), Vector3(2.0, 1.2, 0.1), GLASS, false)
	plaque("VAULT WINDOW", Vector3(13.5, 2.5, -10.7), 0.0, 0.3, BRASS)


## Counters 1 & 2 and the Name Desk along the west wall. Counters are 1.1 m marble with a glass partition.
func _west_column() -> void:
	_counter("Counter1", 3.0, "COUNTER 1")
	_counter("Counter2", -1.0, "COUNTER 2")
	box("NameDesk", Vector3(-12.5, 0.4, -4.0), Vector3(2.4, 0.8, 1.0), WOOD)
	plaque("NAME DESK\n(opens with U5)", Vector3(-12.5, 2.2, -4.9), 0.0, 0.3, GRAPHITE)
	plaque("Approved payees\n• Florist\n• Landlord\n• Demo merchant", Vector3(-14.8, 2.4, 3.0), PI / 2, 0.24, GRAPHITE, "PayeeList")
	plaque("Services at this counter\n• Payment over the counter\n• Scheduled wire (via the vault)", Vector3(-14.8, 2.4, -1.0), PI / 2, 0.24, GRAPHITE, "ServiceMenu")


func _counter(name: String, z: float, label: String) -> void:
	box(name, Vector3(-10.5, 0.55, z), Vector3(0.9, 1.1, 3.6), MARBLE)
	box(name + "Glass", Vector3(-10.5, 1.9, z), Vector3(0.06, 1.6, 3.6), GLASS, false)
	box(name + "Slot", Vector3(-10.5, 1.15, z), Vector3(0.1, 0.1, 0.8), GRAPHITE, false)
	box(name + "Printer", Vector3(-11.6, 1.25, z + 1.2), Vector3(0.5, 0.3, 0.5), GRAPHITE, false)
	box(name + "Stamp", Vector3(-11.4, 1.2, z - 1.0), Vector3(0.25, 0.2, 0.25), BRASS, false)
	plaque(label, Vector3(-10.5, 3.0, z), PI / 2, 0.5, GRAPHITE)


func _account_opening() -> void:
	box("AODesk", Vector3(-9.0, 0.4, 8.0), Vector3(2.6, 0.8, 1.1), WOOD)
	box("AOChairA", Vector3(-9.6, 0.25, 9.3), Vector3(0.5, 0.5, 0.5), GRAPHITE)
	box("AOChairB", Vector3(-8.4, 0.25, 9.3), Vector3(0.5, 0.5, 0.5), GRAPHITE)
	cylinder("AOPot", Vector3(-11.6, 0.3, 9.6), 0.45, 0.6, WOOD)
	cylinder("AOPlant", Vector3(-11.6, 1.3, 9.6), 0.7, 1.6, PLANT)
	box("BrochureRack", Vector3(-6.0, 0.8, 10.6), Vector3(1.0, 1.6, 0.3), GRAPHITE)
	plaque("ACCOUNT OPENING", Vector3(-9.0, 3.0, 10.8), 0.0, 0.35, GRAPHITE)
	plaque("Sign in once. Consent once.\nAfter that the tellers stamp your slips.", Vector3(-6.0, 1.9, 10.4), 0.0, 0.18, GRAPHITE)
	# low partition between Account Opening and the entrance
	box("AOPartition", Vector3(-3.0, 0.6, 8.0), Vector3(0.15, 1.2, 6.0), MARBLE)


func _lobby_furniture() -> void:
	for i in 4:
		var x := -4.5 + i * 3.0
		box("Bench%d" % i, Vector3(x, 0.25, 2.5), Vector3(1.8, 0.5, 0.6), WOOD)
	# Lobby side of the north partition. Off the manager door (x ∈ [-9, -7]) and the vault
	# opening (x ∈ [6, 10]); escort last lobby waypoint is ~(6, -3.5).
	var plant_x := PackedFloat32Array([-5.0, -1.0, 3.0])
	for i in plant_x.size():
		cylinder("LobbyPlant%d" % i, Vector3(plant_x[i], 1.0, -3.2), 0.5, 1.4, PLANT)
	box("WaterCooler", Vector3(8.0, 0.6, 4.5), Vector3(0.4, 1.2, 0.4), GLASS, false)
	# ledger board backing on the north partition (the board itself is scenes/props ledger_board)
	box("LedgerFrame", Vector3(0, 3.0, -4.8), Vector3(8.4, 2.4, 0.15), GRAPHITE)
	plaque("TODAY'S MOVEMENTS", Vector3(0, 4.35, -4.65), 0.0, 0.3, BRASS)


func _east_column() -> void:
	box("Elevator", Vector3(13.0, WALL_H / 2, 0.5), Vector3(3.0, WALL_H, 3.0), GRAPHITE)
	plaque("ELEVATOR\nMAIN / ARC\n(Arc wing opens with U6)", Vector3(11.45, 2.2, 0.5), -PI / 2, 0.28, MARBLE)
	plaque("FX DESK\n(stretch)", Vector3(14.8, 2.2, -3.0), -PI / 2, 0.3, GRAPHITE)
	plaque("SECURITY\nside door (lore)", Vector3(14.8, 2.2, 3.5), -PI / 2, 0.3, GRAPHITE)
	box("SideDoor", Vector3(14.9, 1.1, 3.5), Vector3(0.1, 2.2, 1.0), WOOD)


## Trigger volumes. Names match dialogue conditions and the HUD zone chip.
func _zones() -> void:
	zone("Entrance", Vector3(6.0, 1.5, 8.0), Vector3(18.0, 3.0, 6.0))
	zone("Account Opening", Vector3(-9.0, 1.5, 8.0), Vector3(12.0, 3.0, 6.0))
	zone("Lobby", Vector3(0.5, 1.5, 0.0), Vector3(15.0, 3.0, 10.0))
	zone("Counter", Vector3(-11.5, 1.5, 1.0), Vector3(7.0, 3.0, 8.0))
	zone("Vault antechamber", Vector3(8.0, 1.5, -8.0), Vector3(14.0, 3.0, 6.0))
	zone("Manager's office", Vector3(-8.0, 1.5, -8.0), Vector3(14.0, 3.0, 6.0))


# ---------------------------------------------------------------- builders

func mat(color: Color, translucent: bool = false) -> StandardMaterial3D:
	var key := "%s-%s" % [color.to_html(), translucent]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.85
	if translucent or color.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mats[key] = m
	return m


func box(name: String, pos: Vector3, size: Vector3, color: Color, solid: bool = true) -> Node3D:
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
	mi.material_override = mat(color)
	root.add_child(mi)
	add_child(root)
	return root


func cylinder(name: String, pos: Vector3, radius: float, height: float, color: Color, solid: bool = true) -> Node3D:
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
	mi.material_override = mat(color)
	root.add_child(mi)
	add_child(root)
	return root


func disc(name: String, pos: Vector3, radius: float, height: float, color: Color) -> Node3D:
	var n := Node3D.new()
	n.name = name
	n.position = pos
	var mi := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mi.mesh = mesh
	mi.material_override = mat(color)
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
