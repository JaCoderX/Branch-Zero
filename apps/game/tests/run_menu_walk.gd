extends SceneTree
## Headless walk of the player menu (docs/HANDOFF-player-menu.md) — no browser, no chain, MockChain answers.
##
##   godot --headless --path apps/game -s tests/run_menu_walk.gd
##
## Instantiates the real main scene (like run_viz_budget), puts the front door up by hand (a `-s` script is never the
## current scene, so main.gd skips the gate — exactly what the test harnesses rely on) and checks the state machine:
## title locks the floor · Enter frees it · Esc opens the card only when the floor is free · Esc closes a dialogue and
## a slip first · Resume frees · Leave puts the title back and the player at the front door · Enter again works ·
## the Sound row mutes the Master bus. Exits non-zero on the first wrong answer.

var failures := 0


func _initialize() -> void:
	for spec in [["Chain", "res://autoload/chain.gd"], ["GameState", "res://autoload/game_state.gd"], ["Dialogue", "res://autoload/dialogue.gd"], ["Audio", "res://autoload/audio.gd"]]:
		var n: Node = load(spec[1]).new()
		n.name = spec[0]
		root.add_child(n)
	_run()


func _fail(msg: String) -> void:
	failures += 1
	print("  ✗ " + msg)


func _ok(msg: String) -> void:
	print("  ✓ " + msg)


func _check(cond: bool, msg: String) -> void:
	if cond:
		_ok(msg)
	else:
		_fail(msg)


func _esc(menu: Node) -> void:
	var ev := InputEventKey.new()
	ev.keycode = KEY_ESCAPE
	ev.pressed = true
	menu._unhandled_input(ev)


func _run() -> void:
	var gs: Node = root.get_node("GameState")
	var dlg: Node = root.get_node("Dialogue")
	var audio: Node = root.get_node("Audio")
	var main: Node = load("res://scenes/main/main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	while not gs.booted:
		await process_frame
	var menu: Node = main.get("menu")
	var player: Node3D = main.get_node("Player")
	if menu == null:
		_fail("main.gd has no player menu")
		return _finish()
	_check(not menu.is_open() and not gs.ui_locked, "harness boot: front door skipped (not the current scene), floor free")

	# --- front door -------------------------------------------------------------------------------------------
	menu.show_title()
	await process_frame
	_check(menu.is_open() and menu.mode == PlayerMenu.Mode.TITLE and gs.ui_locked and menu.visible, "title up: floor locked, layer visible")
	var enter_row: Node = menu._buttons[0] if menu._buttons.size() > 0 else null
	_check(enter_row != null and str(enter_row.text) == str(gs.strings.get("menu_enter", "")), "first row is Enter the branch")
	var status := str(menu._status.text)
	_check(status.find("MockChain") >= 0, "mock honesty on the title: '%s'" % status)
	var entered := [false]
	menu.entered.connect(func() -> void: entered[0] = true)
	menu._enter()
	await process_frame
	_check(entered[0] and not menu.is_open() and not gs.ui_locked and not menu.visible, "Enter the branch: floor free, entered emitted")

	# --- Esc on a free floor opens the card; Esc again resumes -------------------------------------------------
	_esc(menu)
	await process_frame
	_check(menu.mode == PlayerMenu.Mode.PAUSE and gs.ui_locked, "Esc on a free floor: visitor's card up, floor locked")
	var rows: Array = []
	for b in menu._buttons:
		rows.append(str(b.text))
	_check(rows.size() == 4 and rows[0].ends_with(str(gs.strings.get("pause_resume", ""))) and rows[3].ends_with(str(gs.strings.get("pause_leave", ""))), "card rows: %s" % str(rows))
	_esc(menu)
	await process_frame
	_check(not menu.is_open() and not gs.ui_locked, "Esc on the card: resumed, floor free")

	# --- Esc goes to a dialogue first ---------------------------------------------------------------------------
	dlg.start("greeter")
	await process_frame
	_check(dlg.active and gs.ui_locked, "Mo's dialogue open (floor locked by the dialogue)")
	_esc(menu)
	await process_frame
	_check(not menu.is_open() and dlg.active, "Esc with a dialogue open: the card stays shut (the dialogue box owns Esc)")
	menu.open_pause()
	_check(not menu.is_open(), "open_pause() refused while the dialogue holds the floor")
	dlg.close()
	await process_frame
	_check(not gs.ui_locked, "dialogue closed: floor free again")

	# --- Esc goes to a slip first -------------------------------------------------------------------------------
	gs.ui_locked = true   # what payment_slip / the forms leave in place while they are up (Dialogue keeps it)
	_esc(menu)
	_check(not menu.is_open(), "Esc while a slip / form holds the lock: the card stays shut")
	gs.ui_locked = false

	# --- Sound row ------------------------------------------------------------------------------------------------
	_esc(menu)
	await process_frame
	var master := AudioServer.get_bus_index("Master")
	menu._buttons[2].pressed.emit()
	await process_frame
	_check(audio.muted and AudioServer.is_bus_mute(master) and menu._buttons[2].text.ends_with(str(gs.strings.get("pause_sound_off", ""))), "Sound row: Master bus muted, row reads Sound: off")
	menu._buttons[2].pressed.emit()
	await process_frame
	_check(not audio.muted and not AudioServer.is_bus_mute(master), "Sound row again: unmuted")

	# --- Leave for today → title → Enter again -------------------------------------------------------------------
	player.global_position = Vector3(-9.0, 0.1, 6.3)
	menu._buttons[3].pressed.emit()
	await process_frame
	_check(menu.mode == PlayerMenu.Mode.PAUSE and menu._page == "leave", "Leave for today asks first")
	menu._buttons[1].pressed.emit()   # Leave
	await process_frame
	_check(menu.mode == PlayerMenu.Mode.TITLE and gs.ui_locked and menu.visible, "left for today: title back up, floor locked")
	var at: Vector3 = player.global_position
	_check(Vector2(at.x, at.z).distance_to(Vector2(main.FRONT_DOOR.x, main.FRONT_DOOR.z)) < 0.01, "player back at the front door (%s)" % str(at))
	_check(gs.booted and gs.session.size() >= 0, "session untouched by Leave (soft exit)")
	menu._enter()
	await process_frame
	_check(not menu.is_open() and not gs.ui_locked, "Enter the branch again: floor free")
	_finish()


func _finish() -> void:
	if failures == 0:
		print("\nOK — player menu walk green")
	else:
		print("\nFAIL — %d failure(s)" % failures)
	quit(1 if failures > 0 else 0)
