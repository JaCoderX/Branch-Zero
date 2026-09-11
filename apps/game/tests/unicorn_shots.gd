extends Node
## Windowed stills of the shy FX unicorn (a window is needed — headless does not render). MockChain, no shell.
## Tester aid for the ENG-2026-0023 land (docs/missions/HANDOFF-shy-fx-unicorn.md): hidden silhouette from the
## customer pad, then each socket peeking, driven through `step()` so the shots do not wait on real idle seconds.
##
##   godot --path apps/game tests/unicorn_shots.tscn -- <out_dir>

var out_dir := ""
var main: Node3D
var player: CharacterBody3D
var unicorn: Node3D


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	out_dir = args[0] if args.size() > 0 else OS.get_user_data_dir().path_join("unicorn_shots")
	DirAccess.make_dir_recursive_absolute(out_dir)
	main = load("res://scenes/main/main.tscn").instantiate()
	add_child(main)
	await get_tree().create_timer(1.0).timeout
	player = main.get_node("Player")
	while not GameState.booted:
		await get_tree().process_frame
	unicorn = main.get_node("FxUnicorn")
	unicorn.set_process(false)   # this runner owns the shy clock
	var pad := Vector3(10.6, 0.1, -2.0)   # the F9 FX aid spot, looking east at Johnny
	await _shot("unicorn_01_hidden_pad", pad, -PI / 2)
	# seeded discovery peek: mid socket (first idle >= 3 s inside the FX zone)
	GameState.set_zone("FX desk")
	_drive_until_peek(1)
	await _shot("unicorn_02_seed_mid_peek", pad, -PI / 2)
	# tier table after the seed: far socket first
	_drive_until_peek(0)
	await _shot("unicorn_03_far_peek", pad, -PI / 2)
	# long idle: the near socket behind the printer / screen
	_drive_until_peek(2)
	await _shot("unicorn_04_near_peek", pad, -PI / 2)
	await _shot("unicorn_05_near_peek_north", Vector3(11.0, 0.1, -3.6), -PI / 2 + 0.35)
	# activity: dissolve back to the far socket
	unicorn.step(0.1, true)
	_drive(1.0)
	await _shot("unicorn_06_hidden_after_activity", pad, -PI / 2)
	print("unicorn_shots: state %d socket %d alpha %.2f peeks %d" % [unicorn.state, unicorn.socket, unicorn.alpha, unicorn.peeks])
	print("unicorn_shots: done → %s" % out_dir)
	get_tree().quit()


## Tick the shy clock (idle) until a peek at `socket` has fully faded in; give up after 90 idle seconds.
func _drive_until_peek(socket: int) -> void:
	var t := 0.0
	while t < 90.0:
		unicorn.step(0.1, false)
		t += 0.1
		if unicorn.state == 1 and unicorn.socket == socket and unicorn.alpha >= unicorn.PEEK_ALPHA - 0.01:
			return
	push_warning("unicorn_shots: no peek at socket %d within 90 s (state %d socket %d)" % [socket, unicorn.state, unicorn.socket])


func _drive(seconds: float) -> void:
	var t := 0.0
	while t < seconds - 0.0001:
		unicorn.step(0.1, false)
		t += 0.1


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
	print("shot %-28s %s" % [name, path])
