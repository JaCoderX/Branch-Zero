extends Node3D
## Main — assembles the bank: interior greybox, NPCs, player, vault door, ledger board, HUD, dialogue, slip.
## Scene layout follows docs/WORLD-3D-ENVIRONMENT.md §4. Nothing here talks to the bridge; NPC actions go
## through Dialogue → GameState.run_action → Chain.call_async.

## Yaw convention (player.gd / npc.gd): a body faces (-sin yaw, 0, -cos yaw) — yaw 0 looks north (-z), PI looks
## south (+z), -PI/2 looks east (+x, the lobby side of the counters). U7 polish (principal playtest): Ines stands
## behind the Account Opening desk between it and the south wall, facing the room; Petra serves from the Counter 2
## teller bay (never north of the manager glass); Okafor faces his door; the vault keeper is Bob.
const NPCS := [
	# id, name, role, colour, position, yaw (radians), escort path
	["greeter", "Mo", "Greeter", Color(0.85, 0.55, 0.25), Vector3(2.0, 0, 4.5), PI * 0.9, []],
	["clerk", "Ines", "Account Clerk", Color(0.30, 0.60, 0.50), Vector3(-9.0, 0, 9.5), 0.0, []],
	["teller", "Dev", "Teller · Counter 1", Color(0.55, 0.35, 0.70), Vector3(-11.6, 0, 3.0), -PI / 2, [Vector3(-11.6, 0, 5.6), Vector3(-8.5, 0, 5.6), Vector3(-2.0, 0, -1.0), Vector3(6.0, 0, -3.5), Vector3(8.0, 0, -6.8)]],
	["registrar", "Petra", "Registrar · Name Desk", Color(0.25, 0.60, 0.45), Vector3(-11.6, 0, -1.0), -PI / 2, []],
	["vault_keeper", "Bob", "Vault Keeper", Color(0.75, 0.30, 0.30), Vector3(10.0, 0, -7.5), PI * 0.6, []],
	["manager", "Mr. Okafor", "Branch Manager", Color(0.25, 0.30, 0.55), Vector3(-8.0, 0, -9.8), PI, []],
]

const ARC_CHAIN_ID := 5042002
const MAIN_CHAIN_ID := 1337

var interior: Node3D
var player: CharacterBody3D
var hud: CanvasLayer
var debug_tools: bool = false          # F-key teleports + their legend; see debug_wanted()
var _near: Array[Npc] = []
var _near_elevator := false
var _prompt_npc: Npc = null


## Tester aids (the F2–F8 teleports and their legend line) are opt-in: web `?debug=1`, desktop `-- --debug` or
## `BRANCH_ZERO_DEBUG=1`. A plain `?mock=account` playtest never teleports (U7 polish finding 1). The web flag is read
## off `window.location.search` through get_interface — a property read, not eval (docs/GODOT.md §8).
static func debug_wanted() -> bool:
	if OS.get_environment("BRANCH_ZERO_DEBUG").strip_edges().to_lower() in ["1", "true", "yes"]:
		return true
	for a in OS.get_cmdline_user_args():
		var s := str(a).strip_edges().to_lower()
		if s == "--debug" or s == "debug=1" or s.ends_with("debug=1"):
			return true
	if OS.has_feature("web"):
		var loc = JavaScriptBridge.get_interface("location")
		if loc != null:
			for part in str(loc.search).trim_prefix("?").split("&"):
				if part == "debug=1" or part == "debug=true" or part == "debug":
					return true
	return false


func _ready() -> void:
	interior = _make_interior()

	var door := Node3D.new()
	door.set_script(load("res://scripts/vault_door.gd"))
	door.position = Vector3(8.0, 0.0, -10.7)
	add_child(door)

	var board := Node3D.new()
	board.set_script(load("res://scripts/ledger_board.gd"))
	board.position = Vector3(0.0, 3.0, -4.7)
	add_child(board)

	var names_board := Node3D.new()
	names_board.set_script(load("res://scripts/names_board.gd"))
	add_child(names_board)

	var npcs := Node3D.new()
	npcs.name = "NPCs"
	add_child(npcs)
	for spec in NPCS:
		var n := Npc.new()
		n.npc_id = spec[0]
		n.display_name = spec[1]
		n.role = spec[2]
		n.tint = spec[3]
		n.position = spec[4]
		n.rotation.y = spec[5]
		var path: Array[Vector3] = []
		for p in spec[6]:
			path.append(p)
		n.escort_path = path
		n.player_near.connect(_on_player_near)
		n.duty_changed.connect(_update_prompt)
		npcs.add_child(n)

	player = CharacterBody3D.new()
	player.set_script(load("res://scripts/player.gd"))
	player.position = Vector3(5.0, 0.1, 7.0)
	add_child(player)
	player.set_view(0.0)

	hud = CanvasLayer.new()
	hud.set_script(load("res://scripts/hud.gd"))
	add_child(hud)
	debug_tools = debug_wanted()
	hud.set_debug(debug_tools)

	var ui := CanvasLayer.new()
	ui.name = "UI"
	ui.layer = 10
	add_child(ui)
	var dlg := Control.new()
	dlg.set_script(load("res://scripts/dialogue_box.gd"))
	ui.add_child(dlg)
	var slip := Control.new()
	slip.set_script(load("res://scripts/payment_slip.gd"))
	ui.add_child(slip)
	var name_form := Control.new()
	name_form.set_script(load("res://scripts/name_claim_form.gd"))
	ui.add_child(name_form)

	GameState.changed.connect(func() -> void:
		interior.refresh_signs())
	Dialogue.closed.connect(func(_id: String) -> void:
		_update_prompt())
	Dialogue.opened.connect(func(_id: String) -> void:
		hud.set_prompt(""))
	print("Branch Zero U7 · Godot %s · %s · bridge %s · debug tools %s" % [Engine.get_version_info().string, "web" if Chain.is_web else "desktop", "MockChain" if Chain.use_mock else Chain.bridge_version, "on (F-key teleports live)" if debug_tools else "off"])

	if DemoWalk.wanted():
		var demo := Node.new()
		demo.set_script(load("res://scripts/demo_walk.gd"))
		add_child(demo)


func _make_interior() -> Node3D:
	var next := Node3D.new()
	next.name = "BankInterior"
	next.set_script(load("res://scripts/bank_interior.gd"))
	add_child(next)
	next.zone_entered.connect(func(z: String) -> void:
		GameState.set_zone(z))
	next.zone_exited.connect(func(z: String) -> void:
		if GameState.current_zone == z:
			GameState.set_zone(""))
	return next


## U6 smallest wing beat: the shell/props are rebuilt from the selected WingTheme; the player, account and desks stay.
func _apply_wing_theme() -> void:
	PropKit.set_wing_theme(GameState.active_wing())
	if is_instance_valid(interior):
		interior.queue_free()
	await get_tree().process_frame
	interior = _make_interior()
	var lighting := get_node_or_null("Lighting")
	if lighting != null and lighting.has_method("apply_theme"):
		lighting.apply_theme()
	interior.refresh_signs()


## The elevator. U6 Arc is DEFERRED (docs/ARC.md §5b): the ARC floor is under construction, so the car refuses the
## trip in-world — toast + the plaque on the shaft say "coming soon" — and the Main wing stays exactly as it is. It
## never calls switch_wing / rebuilds the interior for Arc (the U7 playtest saw that path black the canvas). The
## Main-bound path is kept for a session the debug overlay may have moved to Arc.
func _take_elevator(target_chain: int) -> void:
	if GameState.busy:
		return
	if target_chain == ARC_CHAIN_ID:
		GameState.toast.emit(str(GameState.strings.get("elevator_arc_deferred", "ARC floor — coming soon. Under construction; the Main wing keeps serving.")), "info")
		_update_prompt()
		return
	var r := await GameState.switch_wing(target_chain)
	if r.get("ok", false):
		await _apply_wing_theme()
		GameState.toast.emit("Now serving the Main wing.", "info")
	_update_prompt()


func _on_player_near(npc: Npc, near: bool) -> void:
	if near and not _near.has(npc):
		_near.append(npc)
	elif not near:
		_near.erase(npc)
	_update_prompt()


func _process(_delta: float) -> void:
	if player == null:
		return
	var near := player.global_position.distance_to(Vector3(11.0, 0.0, 0.5)) < 2.6
	if near != _near_elevator:
		_near_elevator = near
		_update_prompt()
	# Interact zones overlap (Petra at Counter 2 is four metres from Dev): re-pick the nearest talkable NPC every
	# frame so the prompt follows the player instead of sticking to whoever's zone was entered first.
	elif _nearest() != _prompt_npc:
		_update_prompt()


func _nearest() -> Npc:
	var best: Npc = null
	var best_d := INF
	for n in _near:
		if not n.can_talk():
			continue
		var d := n.global_position.distance_to(player.global_position)
		if d < best_d:
			best_d = d
			best = n
	return best


func _update_prompt() -> void:
	var s: Dictionary = GameState.strings
	if _near_elevator and not Dialogue.active:
		_prompt_npc = null
		if GameState.active_wing() == "arc":
			hud.set_prompt(str(s.get("prompt_elevator_main", "[Space] Elevator — back to the Main wing")))
		else:
			hud.set_prompt(str(s.get("prompt_elevator_arc", "[Space] Elevator — ARC floor (coming soon)")))
		return
	var n := _nearest()
	_prompt_npc = n
	if n == null or Dialogue.active:
		hud.set_prompt("")
	else:
		hud.set_prompt(Dialogue.interpolate(str(s.get("prompt_talk", "[Space] Talk to {npc}")), {"npc": n.display_name}))


## F2–F4, F6–F8 jump the player to a desk — a tester aid, live only with the debug flag (debug_wanted()); the walk is
## the product path. [position, view yaw]. F5 is left alone: in a browser it reloads the page.
const TELEPORTS := {
	KEY_F2: [Vector3(-9.0, 0.1, 6.3), PI],         # Account Opening, looking south across the desk at Ines
	KEY_F3: [Vector3(-9.5, 0.1, 3.0), PI / 2],     # Counter 1, looking west at Dev
	KEY_F4: [Vector3(8.0, 0.1, -6.5), 0.0],        # Vault antechamber, looking north at the door
	KEY_F6: [Vector3(3.0, 0.1, 6.0), 0.0],         # Lobby, near Mo
	KEY_F7: [Vector3(-8.0, 0.1, -7.3), 0.0],       # Manager's office, looking north at the desk
	KEY_F8: [Vector3(-9.5, 0.1, -1.0), PI / 2],    # Counter 2 / Name Desk, looking west at Petra
}


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("interact") and not Dialogue.active and not GameState.ui_locked:
		if _near_elevator:
			_take_elevator(MAIN_CHAIN_ID if GameState.active_wing() == "arc" else ARC_CHAIN_ID)
			get_viewport().set_input_as_handled()
			return
		var n := _nearest()
		if n != null:
			player.look_at_point(n.global_position)
			n.interact()
			get_viewport().set_input_as_handled()
	elif debug_tools and event is InputEventKey and event.pressed and not event.echo and TELEPORTS.has(event.keycode) and not GameState.ui_locked:
		var spot: Array = TELEPORTS[event.keycode]
		player.global_position = spot[0]
		player.velocity = Vector3.ZERO
		player.set_view(spot[1])
		get_viewport().set_input_as_handled()
