extends Node3D
## Vault door — the timelock made visible (docs/GAME-DESIGN.md §4, WORLD-3D §7).
##
## The clock renders `releaseTime` from the chain record (GameState.wires[*].releaseTime) minus the
## desk-corrected clock (`GameState.now()`), never `chainNow`. States:
##   nothing pending → LED off, door shut, clock "— : — —"
##   cooling         → LED red, digits count down to the soonest release
##   released        → LED green (one bright pulse), bolts retract, door opens 30°, clock "OPEN"
##   just settled    → LED amber for a moment, then off
##
## U7 early art: the frame, LED strip and door are hero meshes from assets/models/hero (tools/hero_props.py); the
## six bolts are radial bars that slide out of the rim. A repeater strip on the lobby face of the vault lintel shares
## the LED material so the state reads from the lobby (WORLD-3D §10). State logic is unchanged since U3.

const OPEN_DEG := 30.0
const DOOR_R := 1.6          # disc radius — matches tools/hero_props.py DOOR_R
const DOOR_CY := 1.75        # disc centre height — DOOR_CY
const CLOCK_Y := 3.62        # clock plate — CLOCK_Y, above the door's swing
const BOLT_LOCKED := 0.0     # bolt centre at the rim radius: half of it protrudes
const BOLT_OPEN := -0.32     # slid back inside the disc

var _hinge: Node3D
var _led_mat: StandardMaterial3D
var _clock: Label3D
var _sub: Label3D
var _bolts: Array[MeshInstance3D] = []
var _bolt_dirs: Array[Vector3] = []
var _bolt_offset := BOLT_LOCKED
var _target_open := 0.0
var _was_pending := false
var _was_released := false
var _amber_until := 0.0
var _pulse := 0.0


func _ready() -> void:
	name = "VaultDoor"
	_led_mat = StandardMaterial3D.new()
	_led_mat.albedo_color = Color(0.2, 0.2, 0.2)
	_led_mat.emission_enabled = true
	_led_mat.emission = Color(0.2, 0.2, 0.2)
	_led_mat.emission_energy_multiplier = 0.0

	# frame + LED strip (hero mesh); the strip takes the state material
	var frame := PropKit.instance(PropKit.HERO + "prop_vault_frame.glb")
	add_child(frame)
	var strip := PropKit.find_mesh(frame, "LedStrip")
	if strip != null:
		strip.material_override = _led_mat
	# repeater on the lobby side of the vault lintel, just above the opening (world (8, 3.58, -4.8); this node sits
	# at (8, 0, -10.7)) — the lobby reads the state without seeing the door
	add_child(_box(Vector3(0.0, 3.58, 5.9), Vector3(3.8, 0.14, 0.06), _led_mat))

	# hinge on the west edge; the door hero mesh is centred on its own disc
	_hinge = Node3D.new()
	_hinge.position = Vector3(-(DOOR_R + 0.1), DOOR_CY, 0.25)
	add_child(_hinge)
	var door := PropKit.instance(PropKit.HERO + "prop_vault_door.glb")
	door.position = Vector3(DOOR_R + 0.1, 0.0, 0.0)
	_hinge.add_child(door)
	for i in 6:
		var b := PropKit.find_mesh(door, "Bolt%d" % i)
		if b == null:
			continue
		var a := i * TAU / 6.0
		_bolts.append(b)
		_bolt_dirs.append(Vector3(cos(a), sin(a), 0.0))

	# the clock above the door (on the frame's clock plate)
	_clock = Label3D.new()
	_clock.position = Vector3(0.0, CLOCK_Y, 0.62)
	_clock.pixel_size = 0.009
	_clock.font_size = 96
	_clock.outline_size = 10
	_clock.modulate = Color(0.9, 0.9, 0.9)
	_clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_clock.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_clock)
	_sub = Label3D.new()
	_sub.position = Vector3(0.0, 0.85, 0.62)
	_sub.pixel_size = 0.007
	_sub.font_size = 36
	_sub.outline_size = 8
	_sub.modulate = Color(0.85, 0.85, 0.85)
	_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sub.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
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
	if released > 0 and not _was_released:
		_pulse = 1.0   # one bloom pulse when the clock runs out (WORLD-3D §7)
	_was_released = released > 0
	_pulse = move_toward(_pulse, 0.0, delta * 1.2)

	var s: Dictionary = GameState.strings
	if pending == 0:
		_target_open = 0.0
		if now_t < _amber_until:
			_led(Color(1.0, 0.62, 0.08), 1.5)
			_clock.text = str(s.get("vault_clock_settled", "DONE"))
		else:
			_led(Color(0.2, 0.2, 0.2), 0.0)
			_clock.text = str(s.get("vault_clock_idle", "— : — —"))
		_sub.text = str(s.get("vault_sub_idle", "Nothing cooling."))
	elif released > 0:
		_target_open = OPEN_DEG
		_led(Color(0.15, 1.0, 0.3), 1.5 + 3.0 * _pulse)
		_clock.text = str(s.get("vault_clock_open", "OPEN"))
		_sub.text = Dialogue.interpolate(str(s.get("vault_sub_released", "{released} wire(s) may be released")), GameState.vars())
	else:
		_target_open = 0.0
		_led(Color(1.0, 0.12, 0.08), 1.5)
		_clock.text = GameState.fmt_duration(GameState.soonest_remaining())
		_sub.text = Dialogue.interpolate(str(s.get("vault_sub_cooling", "{pending} wire(s) cooling · release {release_in}")), GameState.vars())

	_hinge.rotation_degrees.y = move_toward(_hinge.rotation_degrees.y, -_target_open, 20.0 * delta)
	var bolt_target := BOLT_LOCKED if _target_open == 0.0 else BOLT_OPEN
	_bolt_offset = move_toward(_bolt_offset, bolt_target, 0.6 * delta)
	for i in _bolts.size():
		_bolts[i].position = _bolt_dirs[i] * (DOOR_R + _bolt_offset)


func _led(c: Color, energy: float) -> void:
	_led_mat.albedo_color = c if energy > 0.0 else Color(0.2, 0.2, 0.2)
	_led_mat.emission = c
	_led_mat.emission_energy_multiplier = energy
