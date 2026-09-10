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
## for the [Space] prompt without a third pick rule. The body is the lab-proven CC0 **Gum Bot bank** glb (GameLab
## ENG-2026-0021: Graphite shell, Steel plates, Brass CRT bezel — one UV set, two surfaces) and no new lights (the lobby is
## at its eight-omni budget); the screen swaps its emission sheet dormant (dark) ↔ awake (eyes) — no new material either.
##
## Signage is a fixed enamel name badge on the lobby face of the CRT body, under the screen (not a billboard stack).
## World copy stays bank words; OpenRouter is named only in dialogue / the Wake panel (docs/INPC.md Visual).

const GUM_BOT := preload("res://assets/models/inpc/gum_bot_bank.glb")
const SCREEN_AWAKE := preload("res://assets/models/inpc/screen_awake.png")
## Body as imported (lab findings): 1.14 wide × 1.40 tall × 1.18 deep, feet at y = 0, screen on the glb's +z between
## y 0.52 and 1.14. The glb is yawed π below so the screen looks out of local −z like every other lobby face
## (main.gd yaws the node so −z faces the room).
const BODY_W := 1.14
const BODY_H := 1.40
const BODY_D := 1.18
## Lobby face of the CRT body (local −z, just clear of the shell at −0.59); the badge sits in the band under the screen.
const FACE_Z := -0.61
const BADGE_Y := 0.41

var _screen_mat: StandardMaterial3D
var _screen_dormant_tex: Texture2D
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

## The Gum Bot bank body plus a name badge under its screen. One box collider on layer 1 / mask 0 sized to the biped
## like every other blocking prop (bank_interior.gd rules); the old column geometry is gone with the cylinders.
func _dress() -> void:
	var brass := PropKit.palette("Brass")
	var paper := PropKit.palette("Paper")
	var bot: Node3D = GUM_BOT.instantiate()
	bot.name = "GumBot"
	bot.rotation.y = PI   # glb screen faces +z; the lobby face of this prop is −z
	add_child(bot)
	var mesh := bot.find_child("GumBotBank", true, false) as MeshInstance3D
	if mesh == null:
		for c in bot.find_children("*", "MeshInstance3D", true, false):
			mesh = c
			break
	if mesh != null and mesh.mesh != null and mesh.mesh.get_surface_count() > 1:
		# surface 0 = GumBotBody (imported albedo stays), surface 1 = GumBotScreen. Godot's emission is additive
		# (EMISSION = emission + emission_texture): keep `emission` black and let the sheet carry the colour — Bulb is
		# baked into screen_awake.png. A black albedo keeps the asleep screen dark under the lobby sun (lab follow-up).
		var imported := mesh.mesh.surface_get_material(1) as StandardMaterial3D
		_screen_mat = imported.duplicate() as StandardMaterial3D
		_screen_dormant_tex = _screen_mat.emission_texture
		_screen_mat.emission_enabled = true
		_screen_mat.emission = Color(0, 0, 0)
		_screen_mat.albedo_color = Color(0, 0, 0)
		mesh.set_surface_override_material(1, _screen_mat)
	else:
		push_warning("InpcProp: gum_bot_bank.glb has no two-surface mesh — screen swap disabled")
	var body := StaticBody3D.new()
	body.name = "InpcCollider"
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = Vector3(BODY_W, BODY_H, BODY_D)
	shape.shape = box_shape
	shape.position.y = BODY_H / 2.0
	body.add_child(shape)
	add_child(body)
	# Paper face + brass frame under the screen (screen width, y 0.32–0.50) — same class as BRANCH CONSOLE / Arc notice,
	# not a floating HUD.
	var board := MeshInstance3D.new()
	board.name = "PlateBoard"
	var box := BoxMesh.new()
	box.size = Vector3(0.84, 0.18, 0.02)   # as wide as the screen above it: a nameplate strip under the CRT
	board.mesh = box
	board.position = Vector3(0, BADGE_Y, FACE_Z)
	board.material_override = paper
	add_child(board)
	var frame := MeshInstance3D.new()
	frame.name = "PlateFrame"
	var frame_box := BoxMesh.new()
	frame_box.size = Vector3(0.88, 0.22, 0.015)
	frame.mesh = frame_box
	frame.position = Vector3(0, BADGE_Y, FACE_Z + 0.012)
	frame.material_override = brass
	add_child(frame)
	var theme: WingTheme = PropKit.ensure_theme()
	_plaque("SERVICE ASSISTANT", Vector3(0, BADGE_Y + 0.045, FACE_Z - 0.018), 0.10, theme.graphite_color, "InpcTitle")
	_state_plate = _plaque("", Vector3(0, BADGE_Y - 0.04, FACE_Z - 0.018), 0.08, theme.graphite_color, "InpcState")


## Fixed enamel (bank_interior.plaque style): faces local −z into the lobby; never billboarded.
func _plaque(text: String, pos: Vector3, size: float, color: Color, n: String = "") -> Label3D:
	var l := Label3D.new()
	if n != "":
		l.name = n
	l.text = text
	l.font = BankFonts.plaque()
	l.position = pos
	l.rotation.y = PI   # Label3D reads from +z by default; spin so the ink faces the lobby (−z)
	l.pixel_size = 0.005 * size / 0.3
	l.font_size = 48
	l.outline_size = 6
	l.double_sided = false
	l.billboard = BaseMaterial3D.BILLBOARD_DISABLED
	l.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	l.modulate = color
	l.outline_modulate = Color(0, 0, 0, 0.6)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(l)
	return l


## The screen and the state line follow the one bit the shell mirrors back: a key in this tab's session or not.
## Only the emission sheet and its energy change; `emission` stays black (additive) so the awake eyes never flood white.
func _refresh_look() -> void:
	if _state_plate == null:
		return
	var awake := GameState.inpc_awake
	if _screen_mat != null:
		_screen_mat.emission_texture = SCREEN_AWAKE if awake else _screen_dormant_tex
		_screen_mat.emission = Color(0, 0, 0)
		_screen_mat.emission_energy_multiplier = 2.0 if awake else 1.0
	var s: Dictionary = GameState.strings
	_state_plate.text = str(s.get("inpc_plate_awake", "awake · reads your board")) if awake else str(s.get("inpc_plate_dormant", "asleep · needs your link"))
