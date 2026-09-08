extends CharacterBody3D
## Player — third-person capsule, WASD relative to the camera, ←/→ (or Q/E, or LMB drag) orbit the camera.
## Right mouse (U7 polish finding 6): a click walks to the pointed floor spot, holding steers toward the cursor's
## ground aim; WASD or a UI lock cancels. It reuses `steer_target`, the same rail the demo autopilot and walk_to() use.
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
const SKIN := "player"        # the customer's tile of the staff atlas (camel overcoat); staff are npc.gd SKINS
const CLICK_ARRIVE := 0.35     # RMB walk: close enough to the pointed spot
const CLICK_STUCK_SEC := 0.7   # RMB walk: give up when a wall / desk stops the body for this long
const CLICK_RAY := 80.0        # metres of camera ray to look for the floor

var cam_yaw: float = 0.0
var view_yaw: float = 0.0       # the yaw the pivot actually shows: eases to cam_yaw, or to the talk two-shot
var cam_pitch: float = CAM_PITCH
var talk_framing: bool = false
var _talk_point: Vector3 = Vector3.ZERO
var _has_talk_point := false
var facing: float = 0.0
## When set, WASD is ignored and the body walks toward this point (demo autopilot / escorts).
var steer_target: Variant = null
var steer_speed: float = WALK
## > 0 pins the boom length (demo autopilot in the glass office); 0 = the walk / talk defaults.
var cam_dist_override: float = 0.0

var _arm: SpringArm3D
var _cam: Camera3D
var _body: Node3D
var _anim: AnimationPlayer
var _dragging := false
var _rmb_held := false
var _mouse_steer := false      # steer_target came from the mouse (cancel on WASD / lock; no camera follow)
var _stuck_t := 0.0


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

	# the customer: the staff rig in a camel overcoat (character style climb); the collider is still the U3 capsule
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
		_rmb_held = false
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT:
		_rmb_held = event.pressed
		if event.pressed:
			_aim_at_mouse(event.position)
	elif event is InputEventMouseMotion and _dragging:
		cam_yaw -= event.relative.x * 0.006


func _physics_process(delta: float) -> void:
	var locked: bool = GameState.ui_locked
	var input := Vector2.ZERO if locked else Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	if _mouse_steer:
		# WASD or a dialogue / form takes the wheel back; while RMB is held the aim follows the cursor
		if locked or input.length() > 0.1:
			clear_steer()
		elif _rmb_held:
			_aim_at_mouse(get_viewport().get_mouse_position())
	var steering: bool = steer_target is Vector3 and not locked
	if not locked and not steering:
		var orbit := Input.get_action_strength("cam_left") - Input.get_action_strength("cam_right")
		cam_yaw += orbit * CAM_SPEED * delta
	var pivot: Node3D = $CamPivot
	_ease_camera(delta)
	pivot.rotation.y = view_yaw

	var dir := Vector3.ZERO
	var speed := WALK
	if steering:
		var to: Vector3 = (steer_target as Vector3) - global_position
		to.y = 0.0
		if _mouse_steer and to.length() <= CLICK_ARRIVE:
			clear_steer()
		elif to.length() > 0.15:
			dir = to.normalized()
			speed = steer_speed
			# Autopilot only: keep the camera behind the walk so the reel reads as third-person, not strafe. A mouse
			# walk keeps the camera still, so the spot under the cursor stays the spot the body walks to.
			if not _mouse_steer:
				cam_yaw = lerp_angle(cam_yaw, atan2(-dir.x, -dir.z), 4.0 * delta)
	elif not locked:
		dir = Basis(Vector3.UP, cam_yaw) * Vector3(input.x, 0.0, input.y)
		speed = JOG if Input.is_key_pressed(KEY_SHIFT) else WALK
	var target := dir * speed
	velocity.x = move_toward(velocity.x, target.x, 30.0 * delta)
	velocity.z = move_toward(velocity.z, target.z, 30.0 * delta)
	velocity.y = -9.8 if not is_on_floor() else 0.0
	move_and_slide()

	if dir.length() > 0.1:
		facing = atan2(-dir.x, -dir.z)
	_body.rotation.y = lerp_angle(_body.rotation.y, facing, TURN * delta)
	var ground_speed := Vector2(velocity.x, velocity.z).length()
	if _mouse_steer and dir.length() > 0.1:
		# a desk or wall between here and the click: stop pushing rather than jog in place
		_stuck_t = _stuck_t + delta if ground_speed < 0.3 else 0.0
		if _stuck_t > CLICK_STUCK_SEC:
			clear_steer()
	# the clips were authored for PropKit.STAFF_WALK_MPS / STAFF_SPRINT_MPS, so playback follows the real speed
	if ground_speed > WALK + 0.5:
		_play("sprint", ground_speed / PropKit.STAFF_SPRINT_MPS)
	elif ground_speed > 0.4:
		_play("walk", ground_speed / PropKit.STAFF_WALK_MPS)
	else:
		_play("idle")


## Point the mouse walk at the floor under `screen`: the camera ray against layer 1 (floor, desks, NPC bodies — a
## click on a desk walks up to it), or the player's ground plane when the ray hits nothing.
func _aim_at_mouse(screen: Vector2) -> void:
	var from := _cam.project_ray_origin(screen)
	var dir := _cam.project_ray_normal(screen)
	var hit := Vector3.ZERO
	var found := false
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * CLICK_RAY, 1, [get_rid()])
	var r := get_world_3d().direct_space_state.intersect_ray(q)
	if not r.is_empty():
		hit = r["position"]
		found = true
	elif absf(dir.y) > 0.001:
		var t := (global_position.y - from.y) / dir.y
		if t > 0.0:
			hit = from + dir * t
			found = true
	if not found:
		return
	steer_target = Vector3(hit.x, global_position.y, hit.z)
	steer_speed = WALK
	if not _mouse_steer:
		_stuck_t = 0.0
	_mouse_steer = true


## Clear autopilot / mouse steering (idle in place).
func clear_steer() -> void:
	steer_target = null
	_mouse_steer = false
	_stuck_t = 0.0
	velocity.x = 0.0
	velocity.z = 0.0


## Turn the body and camera toward `yaw` (0 = north / -z); the pivot eases there instead of snapping.
func turn_to(yaw: float) -> void:
	facing = yaw
	cam_yaw = yaw


## Pin the boom length (tight rooms such as the manager's glass office); pass 0 to release it.
func set_cam_dist(d: float) -> void:
	cam_dist_override = clampf(d, 1.2, CAM_DIST) if d > 0.0 else 0.0


## Walk toward `p` until within `arrive` metres. Returns false on timeout.
func walk_to(p: Vector3, arrive: float = 0.55, timeout_sec: float = 45.0, speed: float = WALK) -> bool:
	steer_target = Vector3(p.x, global_position.y, p.z)
	steer_speed = clampf(speed, 0.5, JOG)
	var elapsed := 0.0
	while elapsed < timeout_sec:
		if GameState.ui_locked:
			await get_tree().process_frame
			elapsed += get_process_delta_time()
			continue
		var d := Vector2(global_position.x - p.x, global_position.z - p.z).length()
		if d <= arrive:
			clear_steer()
			return true
		await get_tree().process_frame
		elapsed += get_process_delta_time()
	clear_steer()
	return false


func _play(clip: String, speed: float = 1.0) -> void:
	if _anim == null or not _anim.has_animation(clip):
		return
	_anim.speed_scale = clampf(speed, 0.5, 2.5)
	if _anim.current_animation != clip:
		_anim.play(clip, 0.15)


## Point both the camera and the body along `yaw` (0 = north / -z).
func set_view(yaw: float) -> void:
	cam_yaw = yaw
	view_yaw = yaw
	facing = yaw
	_body.rotation.y = yaw
	$CamPivot.rotation.y = yaw
	_arm.spring_length = _boom_target()


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
		_arm.spring_length = _boom_target()
		$CamPivot.rotation.y = view_yaw


## Yaw for the two-shot: along player -> NPC, swung by TALK_SWING so the NPC clears the player's shoulder.
func _talk_yaw() -> float:
	var d := _talk_point - global_position
	var to_npc := atan2(-d.x, -d.z) if d.length() > 0.01 else facing
	return to_npc + deg_to_rad(TALK_SWING)


func _boom_target() -> float:
	if cam_dist_override > 0.0:
		return cam_dist_override
	return TALK_DIST if talk_framing else CAM_DIST


func _ease_camera(delta: float) -> void:
	var w := clampf(CAM_EASE * delta, 0.0, 1.0)
	var yaw_target := _talk_yaw() if talk_framing else cam_yaw
	view_yaw = lerp_angle(view_yaw, yaw_target, w)
	_arm.spring_length = lerpf(_arm.spring_length, _boom_target(), w)
