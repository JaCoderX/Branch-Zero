extends CharacterBody3D
## Player — third-person capsule, WASD relative to the camera, ←/→ (or Q/R, or mouse drag) orbit the camera.
## No jump (docs/WORLD-3D-ENVIRONMENT.md §2.2). Movement is locked while a dialogue or form is open.

const WALK := 4.0
const JOG := 6.5
const TURN := 10.0
const CAM_SPEED := 2.2
const CAM_DIST := 5.0
const CAM_PITCH := -22.0
const CAM_HEIGHT := 1.6

var cam_yaw: float = 0.0
var facing: float = 0.0

var _arm: SpringArm3D
var _cam: Camera3D
var _body: MeshInstance3D
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

	_body = MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = 0.35
	mesh.height = 1.8
	_body.mesh = mesh
	_body.position.y = 0.9
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.20, 0.45, 0.80)
	_body.material_override = m
	add_child(_body)
	# a nose so the facing direction reads
	var nose := MeshInstance3D.new()
	var nm := BoxMesh.new()
	nm.size = Vector3(0.18, 0.18, 0.25)
	nose.mesh = nm
	nose.position = Vector3(0, 1.45, -0.4)
	nose.material_override = m
	_body.add_child(nose)

	var pivot := Node3D.new()
	pivot.name = "CamPivot"
	pivot.position.y = CAM_HEIGHT
	add_child(pivot)
	_arm = SpringArm3D.new()
	_arm.spring_length = CAM_DIST
	_arm.margin = 0.3
	_arm.rotation_degrees.x = CAM_PITCH
	_arm.collision_mask = 1
	pivot.add_child(_arm)
	_cam = Camera3D.new()
	_cam.fov = 55.0
	_cam.current = true
	_arm.add_child(_cam)
	_arm.add_excluded_object(get_rid())
	cam_yaw = rotation.y
	facing = rotation.y
	rotation.y = 0.0


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
	pivot.rotation.y = cam_yaw

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


## Point both the camera and the body along `yaw` (0 = north / -z).
func set_view(yaw: float) -> void:
	cam_yaw = yaw
	facing = yaw
	_body.rotation.y = yaw
	$CamPivot.rotation.y = yaw


func look_at_point(p: Vector3) -> void:
	var d := p - global_position
	if d.length() > 0.01:
		facing = atan2(-d.x, -d.z)
