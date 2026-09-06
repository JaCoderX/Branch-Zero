extends Node3D
## Vault door — the timelock made visible (docs/GAME-DESIGN.md §4, WORLD-3D §7).
##
## The clock renders `releaseTime` from the chain record (GameState.wires[*].releaseTime) minus the
## desk-corrected clock (`GameState.now()`), never `chainNow`. States:
##   nothing pending → LED off, door shut, clock "— : — —"
##   cooling         → LED red, digits count down to the soonest release
##   released        → LED green, bolts back, door opens 30°, clock "OPEN"
##   just settled    → LED amber for a moment, then off

const OPEN_DEG := 30.0

var _hinge: Node3D
var _door: MeshInstance3D
var _led_mat: StandardMaterial3D
var _clock: Label3D
var _sub: Label3D
var _bolts: Array[MeshInstance3D] = []
var _target_open := 0.0
var _was_pending := false
var _amber_until := 0.0


func _ready() -> void:
	name = "VaultDoor"
	# frame + LED strip
	var frame_mat := StandardMaterial3D.new()
	frame_mat.albedo_color = Color(0.30, 0.32, 0.36)
	_led_mat = StandardMaterial3D.new()
	_led_mat.albedo_color = Color(0.2, 0.2, 0.2)
	_led_mat.emission_enabled = true
	_led_mat.emission = Color(0.2, 0.2, 0.2)
	_led_mat.emission_energy_multiplier = 0.0
	for spec in [
		[Vector3(-2.1, 1.85, 0.0), Vector3(0.25, 3.9, 0.35)],
		[Vector3(2.1, 1.85, 0.0), Vector3(0.25, 3.9, 0.35)],
		[Vector3(0.0, 3.9, 0.0), Vector3(4.45, 0.25, 0.35)],
	]:
		var f := _box(spec[0], spec[1], frame_mat)
		add_child(f)
		var led := _box(spec[0] + Vector3(0, 0, 0.2), spec[1] * Vector3(0.5, 0.97, 0.2), _led_mat)
		add_child(led)

	# hinge on the west edge; the door is a thick disc facing south (+z)
	_hinge = Node3D.new()
	_hinge.position = Vector3(-1.85, 1.85, 0.25)
	add_child(_hinge)
	_door = MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.75
	cyl.bottom_radius = 1.75
	cyl.height = 0.35
	_door.mesh = cyl
	_door.rotation_degrees.x = 90.0
	_door.position = Vector3(1.85, 0.0, 0.0)
	var dm := StandardMaterial3D.new()
	dm.albedo_color = Color(0.55, 0.57, 0.62)
	dm.metallic = 0.7
	dm.roughness = 0.35
	_door.material_override = dm
	_hinge.add_child(_door)
	var bolt_mat := StandardMaterial3D.new()
	bolt_mat.albedo_color = Color(0.78, 0.62, 0.30)
	for i in 6:
		var a := i * TAU / 6.0
		var b := _box(Vector3(1.85 + cos(a) * 1.35, sin(a) * 1.35, 0.25), Vector3(0.2, 0.2, 0.3), bolt_mat)
		_hinge.add_child(b)
		_bolts.append(b)
	var hub := _box(Vector3(1.85, 0.0, 0.25), Vector3(0.6, 0.6, 0.2), bolt_mat)
	_hinge.add_child(hub)

	# the clock above the door (the wall clock of the antechamber)
	_clock = Label3D.new()
	_clock.position = Vector3(0.0, 2.75, 0.62)
	_clock.pixel_size = 0.009
	_clock.font_size = 96
	_clock.outline_size = 10
	_clock.modulate = Color(0.9, 0.9, 0.9)
	_clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_clock)
	_sub = Label3D.new()
	_sub.position = Vector3(0.0, 0.85, 0.62)
	_sub.pixel_size = 0.007
	_sub.font_size = 36
	_sub.outline_size = 8
	_sub.modulate = Color(0.85, 0.85, 0.85)
	_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_sub)


func _box(pos: Vector3, size: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = m
	return mi


func _process(delta: float) -> void:
	var pending: int = GameState.pending_count()
	var released: int = GameState.released_count()
	var now_t := Time.get_unix_time_from_system()
	if _was_pending and pending == 0:
		_amber_until = now_t + 2.5
	_was_pending = pending > 0

	var s: Dictionary = GameState.strings
	if pending == 0:
		_target_open = 0.0
		if now_t < _amber_until:
			_led(Color(1.0, 0.65, 0.1), 2.0)
			_clock.text = str(s.get("vault_clock_settled", "DONE"))
		else:
			_led(Color(0.2, 0.2, 0.2), 0.0)
			_clock.text = str(s.get("vault_clock_idle", "— : — —"))
		_sub.text = str(s.get("vault_sub_idle", "Nothing cooling."))
	elif released > 0:
		_target_open = OPEN_DEG
		_led(Color(0.2, 1.0, 0.35), 2.0)
		_clock.text = str(s.get("vault_clock_open", "OPEN"))
		_sub.text = Dialogue.interpolate(str(s.get("vault_sub_released", "{released} wire(s) may be released")), GameState.vars())
	else:
		_target_open = 0.0
		_led(Color(1.0, 0.2, 0.15), 2.0)
		_clock.text = GameState.fmt_duration(GameState.soonest_remaining())
		_sub.text = Dialogue.interpolate(str(s.get("vault_sub_cooling", "{pending} wire(s) cooling · release {release_in}")), GameState.vars())

	_hinge.rotation_degrees.y = move_toward(_hinge.rotation_degrees.y, -_target_open, 20.0 * delta)
	var bolt_out := 0.25 if _target_open == 0.0 else 0.05
	for b in _bolts:
		b.position.z = move_toward(b.position.z, bolt_out, 0.5 * delta)


func _led(c: Color, energy: float) -> void:
	_led_mat.albedo_color = c if energy > 0.0 else Color(0.2, 0.2, 0.2)
	_led_mat.emission = c
	_led_mat.emission_energy_multiplier = energy
