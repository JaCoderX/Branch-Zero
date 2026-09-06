class_name Npc
extends CharacterBody3D
## NPC — one on-chain role or read surface each (docs/NPCS.md §2). State machine:
## IDLE → TALKING → WORKING → TALKING | REFUSING → TALKING → ESCORTING → IDLE.
## The body is a coloured capsule; states are read from pose (bob while working, shake when refusing).

signal player_near(npc: Npc, near: bool)

enum State { IDLE, TALKING, WORKING, ESCORTING, REFUSING }

@export var npc_id: String = "greeter"
@export var display_name: String = "Mo"
@export var role: String = "Greeter"
@export var tint: Color = Color(0.85, 0.55, 0.25)
@export var escort_path: Array[Vector3] = []

var state: State = State.IDLE
var home: Vector3
var home_yaw: float = 0.0

var _body: MeshInstance3D
var _plate: Label3D
var _bubble: Label3D
var _zone: Area3D
var _player: Node3D
var _t := 0.0
var _escort_i := -1
var _escort_back := false
var _wait := 0.0


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

	_body = MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = 0.35
	mesh.height = 1.75
	_body.mesh = mesh
	_body.position.y = 0.875
	var m := StandardMaterial3D.new()
	m.albedo_color = tint
	_body.material_override = m
	add_child(_body)
	var nose := MeshInstance3D.new()
	var nm := BoxMesh.new()
	nm.size = Vector3(0.16, 0.16, 0.22)
	nose.mesh = nm
	nose.position = Vector3(0, 1.4, -0.4)
	nose.material_override = m
	_body.add_child(nose)

	_plate = Label3D.new()
	_plate.text = "%s\n%s" % [display_name, role]
	_plate.position.y = 2.25
	_plate.pixel_size = 0.006
	_plate.font_size = 40
	_plate.outline_size = 8
	_plate.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_plate.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_plate)

	_bubble = Label3D.new()
	_bubble.position.y = 2.75
	_bubble.pixel_size = 0.006
	_bubble.font_size = 34
	_bubble.outline_size = 8
	_bubble.modulate = Color(1.0, 0.92, 0.6)
	_bubble.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_bubble.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_bubble.visible = false
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
			player_near.emit(self, true))
	_zone.body_exited.connect(func(b: Node3D) -> void:
		if b.is_in_group("player"):
			player_near.emit(self, false))
	add_child(_zone)

	Dialogue.opened.connect(func(id: String) -> void:
		if id == npc_id:
			_set_state(State.TALKING))
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


func interact() -> void:
	if state == State.IDLE or state == State.TALKING:
		Dialogue.start(npc_id)


func _set_state(s: State) -> void:
	state = s
	_t = 0.0
	if s == State.REFUSING:
		_say(str(GameState.strings.get("refusing_bubble", "…")))
		get_tree().create_timer(1.6).timeout.connect(func() -> void:
			if state == State.REFUSING:
				_set_state(State.TALKING)
				_bubble.visible = false)


func _say(text: String) -> void:
	_bubble.text = text
	_bubble.visible = text != ""


func _physics_process(delta: float) -> void:
	_t += delta
	match state:
		State.TALKING, State.WORKING, State.REFUSING:
			if _player:
				var d := _player.global_position - global_position
				if d.length() > 0.05:
					rotation.y = lerp_angle(rotation.y, atan2(-d.x, -d.z), 8.0 * delta)
			if state == State.WORKING:
				_body.position.y = 0.875 + 0.06 * sin(_t * 9.0)
			elif state == State.REFUSING:
				_body.rotation.z = 0.08 * sin(_t * 18.0)
			else:
				_body.position.y = 0.875
				_body.rotation.z = 0.0
		State.ESCORTING:
			_escort(delta)
		_:
			_body.position.y = 0.875
			_body.rotation.z = 0.0
			rotation.y = lerp_angle(rotation.y, home_yaw, 3.0 * delta)


# ---------------------------------------------------------------- escort (teller walks the player to the vault)

func _begin_escort() -> void:
	_escort_i = 0
	_escort_back = false
	_wait = 0.0
	_set_state(State.ESCORTING)
	_say(str(GameState.strings.get("escort_bubble", "Walk with me.")))


func _escort(delta: float) -> void:
	if _escort_i < 0:
		return
	var target: Vector3
	if _escort_back:
		target = home if _escort_i < 0 else escort_path[_escort_i]
	else:
		target = escort_path[_escort_i]
	var d := target - global_position
	d.y = 0.0
	if d.length() < 0.25:
		if not _escort_back:
			if _escort_i >= escort_path.size() - 1:
				# arrived at the vault: wait, then walk home
				_wait += delta
				_say(str(GameState.strings.get("escort_arrived", "Here we are. Ruth will take it from here.")))
				if _wait > 5.0:
					_escort_back = true
					_bubble.visible = false
				return
			_escort_i += 1
		else:
			_escort_i -= 1
			if _escort_i < 0:
				global_position = home
				_set_state(State.IDLE)
				return
		return
	velocity = d.normalized() * 3.2
	rotation.y = lerp_angle(rotation.y, atan2(-d.x, -d.z), 10.0 * delta)
	move_and_slide()
