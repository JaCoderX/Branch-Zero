extends Node
## Windowed stills of the service assistant beside the Stage 6a couches (a window is needed — headless does not render).
## Dormant and awake, close and from the lobby; MockChain, no shell. Tester aid for the Gum Bot mesh land (docs/INPC.md Visual).
##
##   godot --path apps/game tests/inpc_shots.tscn -- <out_dir>

var out_dir := ""
var main: Node3D
var player: CharacterBody3D


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	out_dir = args[0] if args.size() > 0 else OS.get_user_data_dir().path_join("inpc_shots")
	DirAccess.make_dir_recursive_absolute(out_dir)
	main = load("res://scenes/main/main.tscn").instantiate()
	add_child(main)
	await get_tree().create_timer(1.0).timeout
	player = main.get_node("Player")
	while not GameState.booted:
		await get_tree().process_frame
	var inpc: Node3D = main.get_tree().get_first_node_in_group("inpc")
	print("inpc at %s yaw %.2f children %s" % [str(inpc.global_position), inpc.rotation.y, str(inpc.get_children().map(func(c): return c.name))])
	GameState.inpc_awake = false
	GameState.changed.emit()
	await _shot("inpc_01_dormant_close", Vector3(5.4, 0.1, 2.4), -PI / 2)
	await _shot("inpc_02_dormant_lobby", Vector3(2.0, 0.1, 5.5), -0.9)
	GameState.inpc_awake = true
	GameState.changed.emit()
	await _shot("inpc_03_awake_close", Vector3(5.4, 0.1, 2.4), -PI / 2)
	await _shot("inpc_04_awake_lobby", Vector3(2.0, 0.1, 5.5), -0.9)
	await _shot("inpc_05_awake_badge_close", Vector3(6.0, 0.1, 2.4), -PI / 2, -8.0)
	GameState.inpc_awake = false
	GameState.changed.emit()
	print("inpc_shots: done → %s" % out_dir)
	get_tree().quit()


func _shot(name: String, pos: Vector3, yaw: float, pitch: float = 0.0) -> void:
	player.global_position = pos
	player.velocity = Vector3.ZERO
	player.set_view(yaw)
	if pitch != 0.0:
		player.set_cam_pitch(pitch)
	var body := player.get_node("Body") as Node3D
	body.visible = not name.ends_with("_close")
	await get_tree().physics_frame
	await get_tree().create_timer(0.45).timeout
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	body.visible = true
	if pitch != 0.0:
		player.set_cam_pitch(player.CAM_PITCH)
	var path := out_dir.path_join(name + ".png")
	img.save_png(path)
	print("shot %-28s %s" % [name, path])
