extends Node3D
## FxUnicorn — the shy pink unicorn of the FX desk (docs/missions/HANDOFF-shy-fx-unicorn.md; lab ENG-2026-0023).
##
## Uniswap's mark is a pink unicorn, and unicorns prefer not to be seen. This one lives behind Johnny's furniture and
## only shows itself when the customer goes quiet: it is a soft pink silhouette by default (never fully invisible —
## alpha 0 reads as a missing mesh), fades in at a curated hide socket after ≥ 3 s of locomotion idle, and the longer
## the player stays still the closer the socket and the longer the dwell, up to hard caps. Any activity dissolves it
## back to the far socket. Ambient folklore only: no dialogue, no interact prompt, no collider, no Follow / phone, and
## nothing on the FX swap path reads or writes this node.
##
## "Idle" is locomotion / interaction: WASD, a click walk (player velocity), the interact key and any open dialogue
## or form (`GameState.ui_locked`) all count as activity. Camera look, orbit and wheel zoom do not.
##
## Sockets are three world positions picked from the WORLD-3D east-column pins — far / mid / near — all behind FX
## furniture from the customer pad and all ≥ 2 m from anywhere a player can stand (PERSONAL_SPACE re-checks that at
## run time and drops a tier when a body is too close). No navmesh, no line-of-sight queries: pick by idle tier only.
## Every tick the prop yaws so the nose tracks the hero (hidden silhouette and peeks alike) — never a fixed west stare.
##
## Seeded discovery: the first time the player idles ≥ 3 s while *inside the FX desk zone* the peek is forced to the
## mid socket with a longer dwell, so a demo walk that pauses at the desk notices it once. Every later peek follows
## the idle tier table.
##
## Budget: the glb is one static 1,964-tri mesh with one textured material (Closest filter — Minecraft blocks stay
## crisp); it is the single +1 unique material over the Gum Bot ceiling (tests/run_viz_budget.gd documents 43 / 45).
## Shadows off; kept out of the static batch so its alpha can move.

const GLB := "res://assets/models/fx_unicorn/unicorn_pink.glb"
const MODEL_SCALE := 0.26            # the pack is ~5.2 units tall → ≈ 1.35 m, horn clearing the 1.1 m counter
const MODEL_YAW := PI / 2            # the glb's nose points local −z; +π/2 turns it west, toward the customer pad

const HIDDEN_ALPHA := 0.10           # soft silhouette; the handoff forbids alpha 0
const PEEK_ALPHA := 0.85             # readable pink, still a little ghostly
const FADE_IN_SEC := 0.9
const FADE_OUT_SEC := 0.45
const IDLE_MIN_SEC := 3.0            # nothing happens before this
const REPEEK_GAP_SEC := 2.0          # hidden pause between two peeks while the player stays idle
const PERSONAL_SPACE := 2.0          # never pick a socket this close to the player
const BAY_RADIUS := 9.0              # peeks only when the player is within this of the desk (FX bay thing, not lobby)
const DESK_CENTRE := Vector3(12.6, 0.0, -2.0)   # the "FX desk" zone centre (bank_interior.gd)
const FX_ZONE := "FX desk"

## Hide sockets, far → near (feet on the floor, world space). See the handoff "Suggested sockets".
##  0 far  — NE nook between the counter's north end, the desk plant and the vault partition (z = −5)
##  1 mid  — staff side behind the counter's south end, beside the engraver: the head and horn peek over the 1.1 m
##           counter through the partition glass; clear of the shelf (x ≤ 12.75) and of the SECURITY door (x 14.85)
##  2 near — staff side behind the printer / PC screen on the shelf's north half, ~2 m north of Johnny's spot
const SOCKETS: Array[Vector3] = [Vector3(13.9, 0.0, -4.65), Vector3(13.35, 0.0, 0.0), Vector3(13.35, 0.0, -3.95)]

## Idle tiers: [idle seconds reached, socket index, peek dwell seconds]. Dwell is capped by MAX_DWELL_SEC.
const TIERS: Array = [[3.0, 0, 2.0], [10.0, 1, 5.0], [25.0, 2, 10.0]]
const SEED_TIER: Array = [3.0, 1, 3.5]   # the one forced discovery peek (mid socket, a little longer)
const MAX_DWELL_SEC := 10.0

enum State { HIDDEN, PEEKING, RELOCATING }

var state: State = State.HIDDEN
var socket: int = 0                  # where the body currently stands
var alpha: float = HIDDEN_ALPHA
var idle_sec: float = 0.0
var peeks: int = 0                   # peeks started (tests / debug)
var seeded: bool = false             # the discovery peek has been spent

var _target_alpha: float = HIDDEN_ALPHA
var _dwell_left: float = 0.0
var _gap_left: float = 0.0
var _pending_socket: int = -1        # RELOCATING (or an activity dissolve): snap here once dissolved
var _body: Node3D
var _mesh: MeshInstance3D
var _mat: StandardMaterial3D


func _ready() -> void:
	name = "FxUnicorn"
	_dress()
	_place(0)
	_apply_alpha()


## The glb body: one MeshInstance3D, one material duplicated so this node owns its alpha and filter.
func _dress() -> void:
	var scene: PackedScene = load(GLB)
	if scene == null:
		push_warning("FxUnicorn: %s missing — unicorn stays a bare node" % GLB)
		return
	_body = scene.instantiate() as Node3D
	_body.name = "Body"
	_body.scale = Vector3.ONE * MODEL_SCALE
	_body.rotation.y = MODEL_YAW
	add_child(_body)
	for c in _body.find_children("*", "MeshInstance3D", true, false):
		_mesh = c
		break
	if _mesh == null or _mesh.mesh == null:
		push_warning("FxUnicorn: unicorn_pink.glb has no mesh")
		return
	var imported := _mesh.mesh.surface_get_material(0) as StandardMaterial3D
	_mat = imported.duplicate() as StandardMaterial3D if imported != null else StandardMaterial3D.new()
	_mat.resource_name = "UnicornPink"
	_mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST   # Minecraft blocks, no smear
	_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat.cull_mode = BaseMaterial3D.CULL_BACK
	_mat.roughness = 0.9
	_mat.metallic = 0.0
	_mat.emission_enabled = false
	_mesh.material_override = _mat
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mesh.set_meta("no_batch", true)


func _process(delta: float) -> void:
	step(delta, _poll_activity())


## One tick of the shy machine. Split from _process so a headless test can drive time and activity directly.
func step(delta: float, active: bool) -> void:
	if active:
		idle_sec = 0.0
		_gap_left = 0.0
		if state != State.HIDDEN or socket != 0:
			_dissolve_to_far()
	else:
		idle_sec += delta
		_gap_left = maxf(0.0, _gap_left - delta)

	match state:
		State.HIDDEN:
			if not active and idle_sec >= IDLE_MIN_SEC and _gap_left <= 0.0 and _player_in_bay():
				var tier: Array = _tier_for(idle_sec)
				if int(tier[1]) != socket:
					_pending_socket = int(tier[1])
					_dwell_left = float(tier[2])
					state = State.RELOCATING
					_target_alpha = HIDDEN_ALPHA
				else:
					_start_peek(float(tier[2]))
			elif _pending_socket >= 0 and alpha <= HIDDEN_ALPHA + 0.005:
				_place(_pending_socket)   # the activity dissolve has finished: snap home while nobody can see it
				_pending_socket = -1
		State.PEEKING:
			if alpha >= PEEK_ALPHA - 0.02:
				_dwell_left -= delta
				if _dwell_left <= 0.0:
					state = State.HIDDEN
					_target_alpha = HIDDEN_ALPHA
					_gap_left = REPEEK_GAP_SEC
		State.RELOCATING:
			if alpha <= HIDDEN_ALPHA + 0.005:
				_place(_pending_socket)
				_pending_socket = -1
				_start_peek(_dwell_left)

	var rate: float = (PEEK_ALPHA - HIDDEN_ALPHA) / (FADE_IN_SEC if _target_alpha > alpha else FADE_OUT_SEC)
	alpha = move_toward(alpha, _target_alpha, rate * delta)
	alpha = clampf(alpha, HIDDEN_ALPHA, PEEK_ALPHA)
	_apply_alpha()
	_face_player()   # always track the hero — silhouette and peeks both look at them


func _start_peek(dwell: float) -> void:
	state = State.PEEKING
	_target_alpha = PEEK_ALPHA
	_dwell_left = minf(dwell, MAX_DWELL_SEC)
	peeks += 1
	_face_player()


func _dissolve_to_far() -> void:
	state = State.HIDDEN
	_target_alpha = HIDDEN_ALPHA
	_dwell_left = 0.0
	_pending_socket = 0 if socket != 0 else -1


## Pick the tier for this much idle; the seed overrides the first in-bay peek; a tier whose socket sits inside the
## player's personal space falls back to the next farther one (the far socket always wins by construction).
func _tier_for(idle: float) -> Array:
	var tier: Array = TIERS[0]
	if not seeded and _player_zone() == FX_ZONE:
		seeded = true
		tier = SEED_TIER
	else:
		for t in TIERS:
			if idle >= float(t[0]):
				tier = t
	var p := _player()
	while p != null and int(tier[1]) > 0 and SOCKETS[int(tier[1])].distance_to(_flat(p.global_position)) < PERSONAL_SPACE:
		tier = [tier[0], int(tier[1]) - 1, tier[2]]
	return tier


func _place(index: int) -> void:
	socket = clampi(index, 0, SOCKETS.size() - 1)
	global_position = SOCKETS[socket]
	_face_player()


## Yaw the whole prop so the body's nose points at the player (nose = world −x when rotation.y is 0).
## Called every `step` so the unicorn keeps facing the hero while they idle / orbit, not only at peek start.
func _face_player() -> void:
	var p := _player()
	if p == null or _body == null:
		return
	var to: Vector3 = _flat(p.global_position) - _flat(global_position)
	if to.length() < 0.5:
		return
	# rotating (−1, 0, 0) about y by θ gives (−cos θ, 0, sin θ); solve for the direction `to`
	rotation.y = atan2(to.z, -to.x)


func _apply_alpha() -> void:
	if _mat != null:
		var c := _mat.albedo_color
		_mat.albedo_color = Color(c.r, c.g, c.b, alpha)


func _poll_activity() -> bool:
	if GameState.ui_locked:
		return true
	if Input.get_vector("move_left", "move_right", "move_forward", "move_back").length() > 0.1:
		return true
	if Input.is_action_pressed("interact"):
		return true
	var p := _player()
	if p is CharacterBody3D:
		var v: Vector3 = (p as CharacterBody3D).velocity
		if Vector2(v.x, v.z).length() > 0.3:
			return true
	return false


func _player() -> Node3D:
	return get_tree().get_first_node_in_group("player") as Node3D


func _player_zone() -> String:
	return String(GameState.current_zone)


func _player_in_bay() -> bool:
	var p := _player()
	return p != null and _flat(p.global_position).distance_to(DESK_CENTRE) <= BAY_RADIUS


static func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)
