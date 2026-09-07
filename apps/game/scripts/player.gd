extends CharacterBody3D
## Player — third-person capsule, WASD relative to the camera, ←/→ (or Q/R, or mouse drag) orbit the camera.
## Camera (U7 viz Stage 5): the spring arm hangs 0.6 m off the right shoulder at -17 deg; while a dialogue is open it
## shortens and swings 38 deg into a two-shot so the NPC is beside the player, not behind the Blocky body.
## No jump (docs/WORLD-3D-ENVIRONMENT.md §2.2). Movement is locked while a dialogue or form is open.

const WALK := 4.0
const JOG := 6.5
const TURN := 10.0
const CAM_SPEED := 2.2
const CAM_DIST := 5.0
const CAM_PITCH := -17.0       # Stage 5: shallower than the old -22 deg so the coffers read in wide lobby shots
const CAM_HEIGHT := 1.6
const CAM_SHOULDER := 0.6      # over-the-shoulder: the arm hangs off the player's right shoulder (Stage 3 lesson)
const TALK_DIST := 3.8         # while a dialogue is open the arm shortens and...
const TALK_SWING := -38.0      # ...swings (degrees) so the NPC sits beside the player in a two-shot, not behind
const CAM_EASE := 6.0
const SKIN := "character-c"   # scripts/npc.gd SKINS lists the staff; the atlas holds eight skins

var cam_yaw: float = 0.0
var view_yaw: float = 0.0       # the yaw the pivot actually shows: eases to cam_yaw, or to the talk two-shot
var cam_pitch: float = CAM_PITCH
var talk_framing: bool = false
var _talk_point: Vector3 = Vector3.ZERO
var _has_talk_point := false
var facing: float = 0.0

var _arm: SpringArm3D
var _cam: Camera3D
var _body: Node3D
var _anim: AnimationPlayer
var _dragging := false


func _ready() -> void:
	add_to_group("player")
	name = "Player"
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	add_child(shape)

	# the customer: a CC0 Kenney Blocky Character (U7 viz Stage 3, green shirt); the collider above is still the U3 capsule
	_body = Node3D.new()
	_body.name = "Body"
	add_child(_body)
	var ch := PropKit.character(SKIN, 1.8)
	var ch_root: Node3D = ch["root"]
	ch_root.rotation.y = PI   # glTF characters face +Z; a Godot body faces -Z
	_body.add_child(ch_root)
	_anim = ch["anim"]
	_play("idle")

	var pivot := Node3D.new()
	pivot.name = "CamPivot"
	pivot.position.y = CAM_HEIGHT
	add_child(pivot)
	_arm = SpringArm3D.new()
	_arm.name = "Arm"
	_arm.spring_length = CAM_DIST
	_arm.margin = 0.3
	_arm.position.x = CAM_SHOULDER
	_arm.rotation_degrees.x = CAM_PITCH
	_arm.collision_mask = 1
	pivot.add_child(_arm)
	_cam = Camera3D.new()
	_cam.fov = 55.0
	_cam.current = true
	_arm.add_child(_cam)
	_arm.add_excluded_object(get_rid())
	cam_yaw = rotation.y
	view_yaw = cam_yaw
	facing = rotation.y
	rotation.y = 0.0
	# the talk two-shot: main.gd calls look_at_point(npc) right before the NPC opens its dialogue
	Dialogue.opened.connect(func(_id: String) -> void:
		talk_framing = _has_talk_point)
	Dialogue.closed.connect(func(_id: String) -> void:
		talk_framing = false)


func _unhandled_input(event: InputEvent) -> void:
	if GameState.ui_locked:
		_dragging = false
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
	elif event is InputEventMouseMotion and _dragging:
		cam_yaw -= event.relative.x * 0.006


func _physics_process(delta: float) -> void:
	var locked: bool = GameState.ui_locked
	if not locked:
		var orbit := Input.get_action_strength("cam_left") - Input.get_action_strength("cam_right")
		cam_yaw += orbit * CAM_SPEED * delta
	var pivot: Node3D = $CamPivot
	_ease_camera(delta)
	pivot.rotation.y = view_yaw

	var input := Vector2.ZERO
	if not locked:
		input = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := (Basis(Vector3.UP, cam_yaw) * Vector3(input.x, 0.0, input.y))
	var speed := JOG if Input.is_key_pressed(KEY_SHIFT) else WALK
	var target := dir * speed
	velocity.x = move_toward(velocity.x, target.x, 30.0 * delta)
	velocity.z = move_toward(velocity.z, target.z, 30.0 * delta)
	velocity.y = -9.8 if not is_on_floor() else 0.0
	move_and_slide()

	if dir.length() > 0.1:
		facing = atan2(-dir.x, -dir.z)
	_body.rotation.y = lerp_angle(_body.rotation.y, facing, TURN * delta)
	var ground_speed := Vector2(velocity.x, velocity.z).length()
	_play("sprint" if ground_speed > WALK + 0.5 else ("walk" if ground_speed > 0.4 else "idle"))


func _play(clip: String) -> void:
	if _anim != null and _anim.has_animation(clip) and _anim.current_animation != clip:
		_anim.play(clip, 0.15)


## Point both the camera and the body along `yaw` (0 = north / -z).
func set_view(yaw: float) -> void:
	cam_yaw = yaw
	view_yaw = yaw
	facing = yaw
	_body.rotation.y = yaw
	$CamPivot.rotation.y = yaw
	_arm.spring_length = TALK_DIST if talk_framing else CAM_DIST


func look_at_point(p: Vector3) -> void:
	var d := p - global_position
	if d.length() > 0.01:
		facing = atan2(-d.x, -d.z)
	_talk_point = p
	_has_talk_point = true


## Camera pitch in degrees (viz_shots looks up at the coffers with this; the walk uses CAM_PITCH).
func set_cam_pitch(deg: float) -> void:
	cam_pitch = deg
	_arm.rotation_degrees.x = deg


## Force the talk two-shot on / off (the dialogue signals do this in play; viz_shots uses it for framing captures).
func set_talk_framing(on: bool, snap: bool = false) -> void:
	talk_framing = on and _has_talk_point
	if snap:
		view_yaw = _talk_yaw() if talk_framing else cam_yaw
		_arm.spring_length = TALK_DIST if talk_framing else CAM_DIST
		$CamPivot.rotation.y = view_yaw


## Yaw for the two-shot: along player -> NPC, swung by TALK_SWING so the NPC clears the player's shoulder.
func _talk_yaw() -> float:
	var d := _talk_point - global_position
	var to_npc := atan2(-d.x, -d.z) if d.length() > 0.01 else facing
	return to_npc + deg_to_rad(TALK_SWING)


func _ease_camera(delta: float) -> void:
	var w := clampf(CAM_EASE * delta, 0.0, 1.0)
	var yaw_target := _talk_yaw() if talk_framing else cam_yaw
	view_yaw = lerp_angle(view_yaw, yaw_target, w)
	_arm.spring_length = lerpf(_arm.spring_length, TALK_DIST if talk_framing else CAM_DIST, w)
