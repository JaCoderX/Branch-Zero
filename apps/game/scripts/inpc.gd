class_name InpcProp
extends BankTerminal
## iNPC — the optional service assistant (docs/INPC.md, docs/missions/HANDOFF-inpc-openrouter.md).
##
## Not a staff NPC (docs/NPCS.md): it embodies no on-chain role, reads no chain and has no dialogue action that could
## pay, wire, release, approve, recall or provision. It is a *prop* the player can wake: Space opens `dialogue/inpc.json`,
## whose only verbs are `open_inpc` (the shell's Wake / chat overlay) and `sleep_inpc` (forget the key). The overlay,
## the OpenRouter call and the player's session-only key all live in apps/web; Godot hands over a player-safe snapshot
## (`GameState.inpc_snapshot()`) and mirrors one bit back — awake or dormant — for the eye and the prompt.
##
## It extends BankTerminal for the interact zone and `can_talk()` shape only, so main.gd ranks it with the terminals
## for the [Space] prompt without a third pick rule. Meshes are palette materials and no new lights (the lobby is at its
## eight-omni budget); the "eye" swaps between Graphite (dormant) and Bulb (awake) — no new material either.

const PEDESTAL_H := 1.05
const HEAD_Y := 1.36

var _eye: MeshInstance3D
var _plate: Label3D
var _state_plate: Label3D


func _ready() -> void:
	terminal_id = "inpc"
	display_name = "the service assistant"
	super()
	name = "Inpc"
	remove_from_group("terminal")   # a bank computer it is not; the group keeps meaning "Console screen"
	add_to_group("inpc")
	_dress()
	GameState.changed.connect(_refresh_look)
	_refresh_look()


## Dormant or awake, Space is never offered while a dialogue, a desk action or either shell overlay owns the screen.
func can_talk() -> bool:
	return not Dialogue.active and not GameState.busy and not GameState.overlay_open()


func interact() -> void:
	if can_talk():
		Dialogue.start("inpc")


func prompt_text() -> String:
	var s: Dictionary = GameState.strings
	if GameState.inpc_awake:
		return str(s.get("prompt_inpc_awake", "[Space] Talk to the service assistant"))
	return str(s.get("prompt_inpc_dormant", "[Space] Wake the service assistant"))


# ---------------------------------------------------------------- look

## A service kiosk: brass foot, graphite column, brass collar, steel head with one round eye facing the lobby, and a
## plate. One cylinder collider on layer 1 / mask 0 like every other blocking prop (bank_interior.gd rules).
func _dress() -> void:
	var brass := PropKit.palette("Brass")
	var graphite := PropKit.palette("Graphite")
	var steel := PropKit.palette("Steel")
	_cyl("Foot", Vector3(0, 0.03, 0), 0.40, 0.06, brass)
	_cyl("Column", Vector3(0, PEDESTAL_H / 2.0, 0), 0.26, PEDESTAL_H, graphite)
	_cyl("Collar", Vector3(0, PEDESTAL_H + 0.025, 0), 0.30, 0.05, brass)
	_cyl("Neck", Vector3(0, PEDESTAL_H + 0.10, 0), 0.06, 0.12, steel)
	var head := MeshInstance3D.new()
	head.name = "Head"
	var sphere := SphereMesh.new()
	sphere.radius = 0.22
	sphere.height = 0.44
	head.mesh = sphere
	head.position = Vector3(0, HEAD_Y, 0)
	head.material_override = steel
	add_child(head)
	# the eye sits on the face the prop looks out of (local -z; main.gd yaws the node toward the lobby)
	_eye = MeshInstance3D.new()
	_eye.name = "Eye"
	var lens := CylinderMesh.new()
	lens.top_radius = 0.075
	lens.bottom_radius = 0.075
	lens.height = 0.03
	_eye.mesh = lens
	_eye.position = Vector3(0, HEAD_Y + 0.02, -0.205)
	_eye.rotation.x = PI / 2
	_eye.material_override = graphite
	add_child(_eye)
	var body := StaticBody3D.new()
	body.name = "InpcCollider"
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var cs := CylinderShape3D.new()
	cs.radius = 0.34
	cs.height = HEAD_Y + 0.24
	shape.shape = cs
	shape.position.y = (HEAD_Y + 0.24) / 2.0
	body.add_child(shape)
	add_child(body)
	var theme: WingTheme = PropKit.ensure_theme()
	_plate = _label("SERVICE ASSISTANT", Vector3(0, HEAD_Y + 0.42, 0), 44, theme.trim_color)
	_state_plate = _label("", Vector3(0, HEAD_Y + 0.30, 0), 30, theme.paper_color)


func _cyl(n: String, pos: Vector3, radius: float, height: float, m: Material) -> void:
	var mi := MeshInstance3D.new()
	mi.name = n
	var c := CylinderMesh.new()
	c.top_radius = radius
	c.bottom_radius = radius
	c.height = height
	mi.mesh = c
	mi.position = pos
	mi.material_override = m
	add_child(mi)


func _label(text: String, pos: Vector3, size: int, color: Color) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font = BankFonts.plaque()
	l.font_size = size
	l.pixel_size = 0.0035
	l.modulate = color
	l.outline_size = 8
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.position = pos
	add_child(l)
	return l


## The eye and the state line follow the one bit the shell mirrors back: a key in this tab's session or not.
func _refresh_look() -> void:
	if _eye == null:
		return
	var awake := GameState.inpc_awake
	_eye.material_override = PropKit.palette("Bulb") if awake else PropKit.palette("Graphite")
	var s: Dictionary = GameState.strings
	_state_plate.text = str(s.get("inpc_plate_awake", "awake · reads your board")) if awake else str(s.get("inpc_plate_dormant", "asleep · needs your OpenRouter key"))
