extends Node
## Windowed capture of the art pass against MockChain (a window is needed — headless does not render).
##
##   godot --path apps/game tests/viz_shots.tscn -- <out_dir>
##
## Runs the main scene as a child, walks the camera through the DoD views (lobby → counter → vault, manager,
## account opening, entrance, Stage 3 character two-shots, Stage 4 shell views, Stage 5 talk two-shots + look-ups), files a mock wire so the vault door shows PENDING, waits for the mock clock so it
## shows OPEN, releases it (DONE), files and recalls another (CANCELLED), and saves a PNG per view into <out_dir>
## with the renderer's draw-call / primitive counters printed for each. Quits when done. Tester aid only; the
## product path is the walk.

const VIEWS := [
	["01_entrance", Vector3(5.0, 0.1, 9.0), 0.0],
	["02_lobby", Vector3(3.0, 0.1, 6.0), 0.0],
	["03_lobby_to_vault", Vector3(8.0, 0.1, 1.0), 0.0],
	["04_counter", Vector3(-9.5, 0.1, 3.0), PI / 2],
	["05_account_opening", Vector3(-9.0, 0.1, 6.3), PI],
	["06_manager", Vector3(-8.0, 0.1, -7.3), 0.0],
	["07_vault", Vector3(8.0, 0.1, -6.5), 0.0],
	["08_name_desk", Vector3(-9.5, 0.1, -1.0), PI / 2],
	["09_elevator", Vector3(9.2, 0.1, 4.8), -PI / 2],
	# Stage 3 character two-shots: player two metres from an NPC (body hidden for the frame, see _shot)
	["16_mo_close", Vector3(2.0, 0.1, 7.0), 0.0],
	["17_dev_close", Vector3(-9.6, 0.1, 4.6), PI / 2],
	["18_bob_close", Vector3(8.4, 0.1, -6.0), -0.85],
	["19_okafor_close", Vector3(-6.6, 0.1, -7.6), 0.0],
	["20_ines_close", Vector3(-9.0, 0.1, 7.0), PI],
	# Stage 4 shell views: the antechamber's west end (north wall bays, bench, magazine rack) and the lobby looking west
	# along the partition's lobby face towards the counters. Both keep the spring arm (4.6 m behind) clear of walls.
	["21_vault_west", Vector3(10.5, 0.1, -9.6), PI / 2],
	["22_lobby_west", Vector3(5.5, 0.1, -2.5), PI / 2],
	# Stage 5 feel views. Optional 4th element: {"talk": npc position} snaps the dialogue two-shot (player body
	# visible — the *_close frames above hide it); {"pitch": deg} tilts the arm for a look-up at the coffers and the
	# skylight dust. Same spots as the F-key teleports, so the spring arm keeps its clearance.
	["23_mo_talk", Vector3(3.0, 0.1, 6.0), 0.0, {"talk": Vector3(2.0, 0.0, 4.5)}],
	["24_dev_talk", Vector3(-9.5, 0.1, 3.0), PI / 2, {"talk": Vector3(-11.6, 0.0, 3.0)}],
	["25_bob_talk", Vector3(8.0, 0.1, -6.5), 0.0, {"talk": Vector3(10.0, 0.0, -7.5)}],
	["26_lobby_ceiling", Vector3(3.0, 0.1, 6.0), 0.0, {"pitch": -2.0}],
	["27_lobby_west_ceiling", Vector3(5.5, 0.1, -2.5), PI / 2, {"pitch": -6.0}],
	# U7 polish views: the manager doorway from the lobby (no rail / sill), Petra's Counter 2 window, Ines behind the
	# AO desk, Okafor facing his door, and the elevator's coming-soon notice. The vault OPEN interior is 13_vault_open.
	["28_manager_door", Vector3(-8.0, 0.1, -1.6), 0.0],
	["29_petra_talk", Vector3(-9.5, 0.1, -1.0), PI / 2, {"talk": Vector3(-11.6, 0.0, -1.0)}],
	["30_ines_talk", Vector3(-9.0, 0.1, 6.3), PI, {"talk": Vector3(-9.0, 0.0, 9.5)}],
	["31_okafor_talk", Vector3(-8.0, 0.1, -7.3), 0.0, {"talk": Vector3(-8.0, 0.0, -9.8)}],
	["32_elevator_notice", Vector3(8.6, 0.1, 4.9), -PI / 2],
	# S1: Kenji's expanded FX desk in the east run — the longer counter, the quote board in its Stage 4 brass frame, and the
	# sponsor plaque under it. `_close` hides the player body, which the spring arm otherwise centres over the desk;
	# the talk frame is the two-shot the dialogue camera actually gives the player. The board carries a live mock
	# quote by then (see `_run`), because a board photographed dark proves nothing about the board.
	["33_fx_desk_close", Vector3(11.4, 0.1, -2.0), -PI / 2],
	["34_fx_talk", Vector3(12.0, 0.1, -2.0), -PI / 2, {"talk": Vector3(14.3, 0.0, -2.0)}],
	["35_fx_board_close", Vector3(10.4, 0.1, -2.1), -PI / 4, {"pitch": -2.0}],
	# Character style climb: the bank verbs on film. `pose` drives an NPC's state machine for the frame (so the
	# clip comes from the same mapping the game uses), `clip` plays one clip directly.
	["36_dev_work_close", Vector3(-9.4, 0.1, 3.0), PI / 2, {"pose": ["teller", Npc.State.WORKING]}],
	["37_bob_refuse_close", Vector3(8.6, 0.1, -6.2), -0.85, {"pose": ["vault_keeper", Npc.State.REFUSING]}],
	["38_mo_walk_close", Vector3(2.0, 0.1, 7.0), 0.0, {"clip": ["greeter", "walk"]}],
	["39_ines_work_close", Vector3(-9.0, 0.1, 7.0), PI, {"pose": ["clerk", Npc.State.WORKING]}],
]

var out_dir := ""
var main: Node3D
var player: CharacterBody3D


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	out_dir = args[0] if args.size() > 0 else OS.get_user_data_dir().path_join("viz_shots")
	DirAccess.make_dir_recursive_absolute(out_dir)
	main = load("res://scenes/main/main.tscn").instantiate()
	add_child(main)
	await get_tree().create_timer(1.0).timeout
	player = main.get_node("Player")
	while not GameState.booted:
		await get_tree().process_frame
	Chain._mock.preset_account()
	await GameState.refresh_all()
	# S1: read the FX till and put a quote on Kenji's board, so views 33-35 photograph the panel doing its job.
	await GameState.refresh_fx()
	await GameState.run_action("fx_enable", {})
	await GameState.run_action("fx_quote", {"amount": "25"})
	await _shots("")

	# vault states, read from the mock's own records through the same GameState the real bridge feeds
	var r: Dictionary = await GameState.run_action("wire", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "250", "memo": "flat"})
	var tx_id := str(r.get("result", {}).get("txId", ""))
	await get_tree().create_timer(0.5).timeout
	await _shot("10_lobby_pending", Vector3(8.0, 0.1, 1.0), 0.0)
	await _shot("11_vault_pending", Vector3(8.0, 0.1, -6.5), 0.0)
	var remaining: int = GameState.remaining(GameState.wire_by_id(tx_id))
	print("viz_shots: wire #%s cooling %d s — waiting for the mock clock" % [tx_id, remaining])
	while GameState.released_count() == 0 and GameState.pending_count() > 0:
		await get_tree().create_timer(0.5).timeout
	await get_tree().create_timer(6.0).timeout   # the door swings at 20°/s: let the 95° open (U7 polish) finish first
	await _shot("12_lobby_open", Vector3(8.0, 0.1, 1.0), 0.0)
	await _shot("13_vault_open", Vector3(8.0, 0.1, -6.5), 0.0)
	await _shot("13b_vault_open_east", Vector3(9.3, 0.1, -7.6), 0.3)   # U7 polish: the strongroom past the parked door
	await GameState.run_action("approve", {"txId": tx_id})
	await get_tree().create_timer(0.6).timeout
	await _shot("14_vault_done", Vector3(8.0, 0.1, -6.5), 0.0)
	var r2: Dictionary = await GameState.run_action("wire", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "300", "memo": "again"})
	var tx2 := str(r2.get("result", {}).get("txId", ""))
	await get_tree().create_timer(0.5).timeout
	await GameState.run_action("cancel", {"txId": tx2})
	await get_tree().create_timer(0.6).timeout
	await _shot("15_lobby_cancelled", Vector3(8.0, 0.1, 1.0), 0.0)
	print("viz_shots: done → %s" % out_dir)
	get_tree().quit()


func _npc(id: String) -> Npc:
	for n in main.get_tree().get_nodes_in_group("npc"):
		if (n as Npc).npc_id == id:
			return n
	push_error("viz_shots: no npc %s" % id)
	return null


func _shots(suffix: String) -> void:
	for v in VIEWS:
		await _shot(str(v[0]) + suffix, v[1], v[2], v[3] if v.size() > 3 else {})


func _shot(name: String, pos: Vector3, yaw: float, opts: Dictionary = {}) -> void:
	player.global_position = pos
	player.velocity = Vector3.ZERO
	player.set_view(yaw)
	if opts.has("pitch"):
		player.set_cam_pitch(float(opts["pitch"]))
	if opts.has("talk"):
		player.look_at_point(opts["talk"])
		player.set_talk_framing(true, true)
	if opts.has("pose"):
		var want: Array = opts["pose"]
		_npc(str(want[0]))._set_state(want[1])
	if opts.has("clip"):
		var which: Array = opts["clip"]
		_npc(str(which[0]))._play(str(which[1]))
	# the *_close two-shots judge the NPC silhouette: hide the player's body for that frame (the spring arm always
	# centres the player, so at two metres the body would cover the NPC)
	var body := player.get_node("Body") as Node3D
	body.visible = not name.ends_with("_close")
	await get_tree().physics_frame
	await get_tree().create_timer(0.45).timeout
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	body.visible = true
	if opts.has("talk"):
		player.set_talk_framing(false, true)
	if opts.has("pitch"):
		player.set_cam_pitch(player.CAM_PITCH)
	var path := out_dir.path_join(name + ".png")
	img.save_png(path)
	print("shot %-22s draw calls %5d · primitives %8d · objects %5d · %s" % [
		name,
		RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),
		RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME),
		RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME),
		path,
	])
