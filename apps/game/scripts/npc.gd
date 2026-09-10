class_name Npc
extends CharacterBody3D
## NPC — one on-chain role or read surface each (docs/NPCS.md §2). State machine:
## IDLE → TALKING → WORKING → TALKING | REFUSING → TALKING → ESCORTING → IDLE.
## The body is either the Kenney bank-staff rig or the KayKit Adventurers feel-spike (`PropKit.USE_KAYKIT_CAST`):
## states play bank clip aliases (idle · work · refuse · walk · greet).
## `tint` is kept for wardrobe / role colouring hooks; floating nameplates were removed in polish.

signal player_near(npc: Npc, near: bool)
signal duty_changed

enum State { IDLE, TALKING, WORKING, ESCORTING, REFUSING }

## npc_id → wardrobe role key. With KayKit cast, `PropKit.KAYKIT_MESHES` maps these to Adventurers bodies.
## Unlisted ids fall back to `default`.
const SKINS := {
	"greeter": "greeter",            # Ranger — lobby face
	"clerk": "clerk",                # Mage — Account Opening
	"teller": "teller",              # Rogue — Counter 1
	"vault_keeper": "vault_keeper",  # Knight — vault window
	"manager": "manager",            # Barbarian — corner office
	"registrar": "registrar",        # Mage — Petra, Name Desk
	"dealer": "dealer",              # Rogue_Hooded — Johnny, FX desk (S1)
	"default": "greeter",
}

## The cast shares one mesh, so a few centimetres of height is what keeps seven staff from reading as clones.
const _HEIGHTS := {
	"greeter": 1.78, "clerk": 1.70, "teller": 1.75, "vault_keeper": 1.82,
	"manager": 1.73, "registrar": 1.68, "dealer": 1.76,
}

@export var npc_id: String = "greeter"
@export var display_name: String = "Ash"
@export var role: String = "Greeter"
@export var tint: Color = Color(0.85, 0.55, 0.25)
@export var escort_path: Array[Vector3] = []

var state: State = State.IDLE
var face_state: String = "neutral"
var home: Vector3
var home_yaw: float = 0.0

var _body: Node3D
var _anim: AnimationPlayer
var _face: MeshInstance3D
var _skeleton: Skeleton3D
var _head_bone := -1
var _head_base_pose := Quaternion.IDENTITY
var _gaze_active := false
var _bubble: Label3D
var _zone: Area3D
var _player: Node3D
var _t := 0.0
var _escort_i := -1
var _escort_back := false
var _wait := 0.0
var _escort_t := 0.0
var _leg_t := 0.0
var _escort_ignore: Array[PhysicsBody3D] = []
var _greeted_in_approach := false

const _ESCORT_SPEED := 3.2
const _ARRIVE := 0.45
const _VAULT_PAUSE := 1.6
const _ESCORT_LIMIT := 22.0
const _LEG_LIMIT := 6.0


func _ready() -> void:
	add_to_group("npc")
	name = "NPC_" + npc_id
	home = global_position
	home_yaw = rotation.y

	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.75
	shape.shape = cap
	shape.position.y = 0.875
	add_child(shape)

	# silhouette + idle from a CC0 rig; the collider above is still the U3 capsule
	_body = Node3D.new()
	_body.name = "Body"
	add_child(_body)
	var ch := PropKit.character(str(SKINS.get(npc_id, SKINS["default"])), _HEIGHTS.get(npc_id, 1.76))
	var ch_root: Node3D = ch["root"]
	ch_root.rotation.y = PI   # Kenney glTF characters face +Z; a Godot body faces -Z
	_body.add_child(ch_root)
	_anim = ch["anim"]
	_face = ch["face"]
	_skeleton = ch["skeleton"]
	_head_bone = -1
	if _skeleton != null:
		_head_bone = _skeleton.find_bone("Head")
		if _head_bone < 0:
			_head_bone = _skeleton.find_bone("head")
	_set_face_state("smile")
	if _anim != null:
		_anim.animation_finished.connect(_on_animation_finished)
	_play("idle")

	# No hovering nameplates — polish: the [Space] prompt and dialogue header carry the name.
	_bubble = Label3D.new()
	_bubble.position.y = 2.35
	_bubble.pixel_size = 0.004
	_bubble.font_size = 28
	_bubble.outline_size = 6
	_bubble.modulate = Color(1.0, 0.92, 0.6)
	_bubble.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_bubble.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_bubble.visible = false
	_bubble.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_bubble)

	_zone = Area3D.new()
	_zone.name = "InteractZone"
	var zs := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 3.2
	zs.shape = sph
	zs.position.y = 1.0
	_zone.add_child(zs)
	_zone.body_entered.connect(func(b: Node3D) -> void:
		if b.is_in_group("player"):
			_player = b
			if state == State.IDLE:
				_set_face_state("smile")
				if not _greeted_in_approach:
					_greeted_in_approach = true
					_greet_once()
			player_near.emit(self, true))
	_zone.body_exited.connect(func(b: Node3D) -> void:
		if b.is_in_group("player"):
			if b == _player:
				_player = null
				_greeted_in_approach = false
				if state == State.IDLE:
					_set_face_state("neutral")
			player_near.emit(self, false))
	add_child(_zone)

	Dialogue.opened.connect(func(id: String) -> void:
		if id == npc_id:
			_set_state(State.TALKING)
			_dialogue_face_beat())
	Dialogue.closed.connect(func(id: String) -> void:
		if id == npc_id and state != State.ESCORTING:
			_set_state(State.IDLE))
	Dialogue.working.connect(func(id: String, text: String) -> void:
		if id == npc_id:
			_set_state(State.WORKING)
			_say(text))
	Dialogue.action_finished.connect(func(id: String, ok: bool) -> void:
		if id == npc_id:
			_set_state(State.TALKING if ok else State.REFUSING)
			if ok:
				_bubble.visible = false)
	Dialogue.escort_requested.connect(func(id: String, _target: String) -> void:
		if id == npc_id and not escort_path.is_empty():
			_begin_escort())


func can_talk() -> bool:
	return state == State.IDLE or state == State.TALKING


func interact() -> void:
	if can_talk():
		Dialogue.start(npc_id)


func _set_state(s: State) -> void:
	state = s
	_t = 0.0
	duty_changed.emit()
	# A greet is a one-shot approach beat, never a state pose. Stop it before any non-IDLE state
	# selects its own clip so opening dialogue mid-greet cannot leave the body on the last greet frame.
	if s != State.IDLE and _anim != null and _anim.current_animation == "greet":
		_anim.stop()
		_play("idle")
	match s:
		State.WORKING:
			_set_face_state("neutral")
			_play("work")
		State.REFUSING:
			_set_face_state("concern")
			_play("refuse")
		State.ESCORTING:
			_set_face_state("smile")
			_play("walk", _ESCORT_SPEED / PropKit.walk_mps())
		State.TALKING:
			_set_face_state("talk")
			_play("idle")
		_:
			_set_face_state("smile" if _player != null else "neutral")
			_play("idle")
	if s == State.REFUSING:
		_say(str(GameState.strings.get("refusing_bubble", "…")))
		get_tree().create_timer(1.6).timeout.connect(func() -> void:
			if state == State.REFUSING:
				_set_state(State.TALKING)
				_bubble.visible = false)


func _set_face_state(face_state: String) -> void:
	self.face_state = face_state
	if _face == null:
		return
	PropKit.set_face_state(_face, str(SKINS.get(npc_id, SKINS["default"])), face_state)


func _dialogue_face_beat() -> void:
	_set_face_state("surprised")
	await get_tree().create_timer(0.4).timeout
	if state == State.TALKING:
		_set_face_state("talk")


func _greet_once() -> void:
	if _anim == null or not _anim.has_animation("greet") or state != State.IDLE:
		return
	_anim.speed_scale = 1.0
	_anim.play("greet", 0.12)


func _on_animation_finished(clip: StringName) -> void:
	if clip == &"greet" and state == State.IDLE:
		_play("idle")


func _process(delta: float) -> void:
	if _skeleton == null or _head_bone < 0:
		return
	# Kenney clips carry constant scale tracks; re-assert silhouette. KayKit bones do not match — no-op.
	if not PropKit.USE_KAYKIT_CAST:
		PropKit.apply_role_scale(_skeleton, str(SKINS.get(npc_id, SKINS["default"])))
	var active := state == State.IDLE and _player != null
	if active and not _gaze_active:
		_head_base_pose = _skeleton.get_bone_pose_rotation(_head_bone)
		_gaze_active = true
	elif not active and _gaze_active:
		_skeleton.set_bone_pose_rotation(_head_bone, _head_base_pose)
		_gaze_active = false
	if not active:
		return
	var local := to_local(_player.global_position)
	var yaw := clampf(atan2(-local.x, -local.z), deg_to_rad(-40.0), deg_to_rad(40.0))
	var flat := Vector2(local.x, local.z).length()
	var pitch := clampf(atan2(local.y - 1.45, maxf(flat, 0.05)), deg_to_rad(-15.0), deg_to_rad(15.0))
	var aim := Quaternion(Vector3.UP, yaw) * Quaternion(Vector3.RIGHT, pitch)
	var target := aim * _head_base_pose
	_skeleton.set_bone_pose_rotation(_head_bone, _skeleton.get_bone_pose_rotation(_head_bone).slerp(target, clampf(delta * 8.0, 0.0, 1.0)))


func _say(text: String) -> void:
	_bubble.text = text
	_bubble.visible = text != ""


func _play(clip: String, speed: float = 1.0) -> void:
	if _anim == null or not _anim.has_animation(clip):
		return
	_anim.speed_scale = speed      # the walk clip covers PropKit.walk_mps(); an escort is faster than that
	if _anim.current_animation != clip:
		_anim.play(clip, 0.2)


func _physics_process(delta: float) -> void:
	_t += delta
	rotation.x = 0.0
	rotation.z = 0.0
	match state:
		State.TALKING, State.WORKING, State.REFUSING:
			if _player:
				var d := _player.global_position - global_position
				if d.length() > 0.05:
					rotation.y = lerp_angle(rotation.y, atan2(-d.x, -d.z), 8.0 * delta)
		State.ESCORTING:
			_escort(delta)
		_:
			rotation.y = lerp_angle(rotation.y, home_yaw, 3.0 * delta)
			velocity.x = 0.0
			velocity.z = 0.0
			velocity.y = 0.0 if is_on_floor() else -9.8
			move_and_slide()


# ---------------------------------------------------------------- escort (teller walks the player to the vault, then back to the counter)

func _begin_escort() -> void:
	_escort_i = 0
	_escort_back = false
	_wait = 0.0
	_escort_t = 0.0
	_leg_t = 0.0
	_clear_escort_ignore()
	if _player is PhysicsBody3D:
		_ignore_during_escort(_player as PhysicsBody3D)
	for n in get_tree().get_nodes_in_group("npc"):
		if n != self and n is PhysicsBody3D:
			_ignore_during_escort(n as PhysicsBody3D)
	_set_state(State.ESCORTING)
	_say(str(GameState.strings.get("escort_bubble", "Walk with me.")))


func _escort_target() -> Vector3:
	if not _escort_back:
		return escort_path[clampi(_escort_i, 0, escort_path.size() - 1)]
	if _escort_i < 0:
		return home
	return escort_path[_escort_i]


func _finish_escort() -> void:
	_clear_escort_ignore()
	velocity = Vector3.ZERO
	global_position = Vector3(home.x, home.y, home.z)
	rotation = Vector3(0.0, home_yaw, 0.0)
	_escort_i = -1
	_escort_back = false
	_bubble.visible = false
	_set_state(State.IDLE)


func _ignore_during_escort(body: PhysicsBody3D) -> void:
	add_collision_exception_with(body)
	_escort_ignore.append(body)


func _clear_escort_ignore() -> void:
	for body in _escort_ignore:
		if is_instance_valid(body):
			remove_collision_exception_with(body)
	_escort_ignore.clear()


func _advance_leg() -> void:
	_leg_t = 0.0
	if not _escort_back:
		if _escort_i >= escort_path.size() - 1:
			_escort_back = true
			_escort_i = escort_path.size() - 2
			_bubble.visible = false
		else:
			_escort_i += 1
	else:
		_escort_i -= 1


func _escort(delta: float) -> void:
	if escort_path.is_empty():
		_finish_escort()
		return
	_escort_t += delta
	_leg_t += delta
	if _escort_t > _ESCORT_LIMIT:
		_finish_escort()
		return

	var target := _escort_target()
	var d := target - global_position
	d.y = 0.0
	var arrived := d.length() < _ARRIVE
	var waiting := not _escort_back and _escort_i >= escort_path.size() - 1 and arrived

	if waiting:
		_wait += delta
		_say(str(GameState.strings.get("escort_arrived", "Here we are. Bob has your wire.")))
		velocity.x = 0.0
		velocity.z = 0.0
		velocity.y = 0.0 if is_on_floor() else -9.8
		move_and_slide()
		if _wait > _VAULT_PAUSE:
			_advance_leg()
		return

	if arrived or _leg_t > _LEG_LIMIT:
		if _escort_back and _escort_i < 0:
			_finish_escort()
			return
		_advance_leg()
		velocity.x = 0.0
		velocity.z = 0.0
		velocity.y = 0.0 if is_on_floor() else -9.8
		move_and_slide()
		return

	var dir := d.normalized() * _ESCORT_SPEED
	velocity.x = dir.x
	velocity.z = dir.z
	velocity.y = 0.0 if is_on_floor() else -9.8
	rotation.y = lerp_angle(rotation.y, atan2(-d.x, -d.z), 10.0 * delta)
	move_and_slide()
