extends Node
## Windowed capture of the art pass against MockChain (a window is needed — headless does not render).
##
##   godot --path apps/game tests/viz_shots.tscn -- <out_dir>
##
## Runs the main scene as a child, walks the camera through the DoD views (lobby → counter → vault, manager,
## account opening, entrance), files a mock wire so the vault door shows PENDING, waits for the mock clock so it
## shows OPEN, releases it (DONE), files and recalls another (CANCELLED), and saves a PNG per view into <out_dir>
## with the renderer's draw-call / primitive counters printed for each. Quits when done. Tester aid only; the
## product path is the walk.

const VIEWS := [
	["01_entrance", Vector3(5.0, 0.1, 9.0), 0.0],
	["02_lobby", Vector3(3.0, 0.1, 6.0), 0.0],
	["03_lobby_to_vault", Vector3(8.0, 0.1, 1.0), 0.0],
	["04_counter", Vector3(-9.5, 0.1, 3.0), PI / 2],
	["05_account_opening", Vector3(-7.0, 0.1, 7.6), PI / 2],
	["06_manager", Vector3(-8.0, 0.1, -7.3), 0.0],
	["07_vault", Vector3(8.0, 0.1, -6.5), 0.0],
	["08_name_desk", Vector3(-11.0, 0.1, -3.5), PI / 2],
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
	await get_tree().create_timer(1.6).timeout
	await _shot("12_lobby_open", Vector3(8.0, 0.1, 1.0), 0.0)
	await _shot("13_vault_open", Vector3(8.0, 0.1, -6.5), 0.0)
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


func _shots(suffix: String) -> void:
	for v in VIEWS:
		await _shot(str(v[0]) + suffix, v[1], v[2])


func _shot(name: String, pos: Vector3, yaw: float) -> void:
	player.global_position = pos
	player.velocity = Vector3.ZERO
	player.set_view(yaw)
	await get_tree().physics_frame
	await get_tree().create_timer(0.45).timeout
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := out_dir.path_join(name + ".png")
	img.save_png(path)
	print("shot %-22s draw calls %5d · primitives %8d · objects %5d · %s" % [
		name,
		RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),
		RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME),
		RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME),
		path,
	])
