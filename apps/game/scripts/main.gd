extends Node3D
## Main — assembles the bank: interior greybox, NPCs, player, vault door, ledger board, HUD, dialogue, slip.
## Scene layout follows docs/WORLD-3D-ENVIRONMENT.md §4. Nothing here talks to the bridge; NPC actions go
## through Dialogue → GameState.run_action → Chain.call_async.

const NPCS := [
	# id, name, role, colour, position, yaw (radians), escort path
	["greeter", "Mo", "Greeter", Color(0.85, 0.55, 0.25), Vector3(2.0, 0, 4.5), PI * 0.9, []],
	["clerk", "Ines", "Account Clerk", Color(0.30, 0.60, 0.50), Vector3(-9.0, 0, 6.9), PI, []],
	["teller", "Dev", "Teller · Counter 1", Color(0.55, 0.35, 0.70), Vector3(-11.6, 0, 3.0), -PI / 2, [Vector3(-11.6, 0, 5.6), Vector3(-8.5, 0, 5.6), Vector3(-2.0, 0, -1.0), Vector3(6.0, 0, -3.5), Vector3(8.0, 0, -6.8)]],
	["vault_keeper", "Ruth", "Vault Keeper", Color(0.75, 0.30, 0.30), Vector3(10.0, 0, -7.5), PI * 0.6, []],
	["manager", "Mr. Okafor", "Branch Manager", Color(0.25, 0.30, 0.55), Vector3(-8.0, 0, -9.8), 0.0, []],
]

var interior: Node3D
var player: CharacterBody3D
var hud: CanvasLayer
var _near: Array[Npc] = []


func _ready() -> void:
	interior = Node3D.new()
	interior.name = "BankInterior"
	interior.set_script(load("res://scripts/bank_interior.gd"))
	add_child(interior)
	interior.zone_entered.connect(func(z: String) -> void:
		GameState.set_zone(z))
	interior.zone_exited.connect(func(z: String) -> void:
		if GameState.current_zone == z:
			GameState.set_zone(""))

	var door := Node3D.new()
	door.set_script(load("res://scripts/vault_door.gd"))
	door.position = Vector3(8.0, 0.0, -10.7)
	add_child(door)

	var board := Node3D.new()
	board.set_script(load("res://scripts/ledger_board.gd"))
	board.position = Vector3(0.0, 3.0, -4.7)
	add_child(board)

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

	GameState.changed.connect(func() -> void:
		interior.refresh_signs())
	Dialogue.closed.connect(func(_id: String) -> void:
		_update_prompt())
	Dialogue.opened.connect(func(_id: String) -> void:
		hud.set_prompt(""))
	print("Branch Zero U3 · Godot %s · %s · bridge %s" % [Engine.get_version_info().string, "web" if Chain.is_web else "desktop", "MockChain" if Chain.use_mock else Chain.bridge_version])


func _on_player_near(npc: Npc, near: bool) -> void:
	if near and not _near.has(npc):
		_near.append(npc)
	elif not near:
		_near.erase(npc)
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
	var n := _nearest()
	if n == null or Dialogue.active:
		hud.set_prompt("")
	else:
		hud.set_prompt(Dialogue.interpolate(str(GameState.strings.get("prompt_talk", "[E] Talk to {npc}")), {"npc": n.display_name}))


## F2–F4, F6, F7 jump the player to a desk (greybox testing aid; the walk loop is the product path).
## [position, view yaw]. F5 is left alone: in a browser it reloads the page.
const TELEPORTS := {
	KEY_F2: [Vector3(-7.0, 0.1, 7.6), PI / 2],     # Account Opening, looking west at Ines
	KEY_F3: [Vector3(-9.5, 0.1, 3.0), PI / 2],     # Counter 1, looking west at Dev
	KEY_F4: [Vector3(8.0, 0.1, -6.5), 0.0],        # Vault antechamber, looking north at the door
	KEY_F6: [Vector3(3.0, 0.1, 6.0), 0.0],         # Lobby, near Mo
	KEY_F7: [Vector3(-8.0, 0.1, -7.3), 0.0],       # Manager's office, looking north at the desk
}


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("interact") and not Dialogue.active and not GameState.ui_locked:
		var n := _nearest()
		if n != null:
			player.look_at_point(n.global_position)
			n.interact()
			get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and not event.echo and TELEPORTS.has(event.keycode) and not GameState.ui_locked:
		var spot: Array = TELEPORTS[event.keycode]
		player.global_position = spot[0]
		player.velocity = Vector3.ZERO
		player.set_view(spot[1])
		get_viewport().set_input_as_handled()
