extends SceneTree
## Headless smoke for the shy FX unicorn (docs/missions/HANDOFF-shy-fx-unicorn.md). No window, no chain.
##
##   godot --headless --path apps/game -s tests/run_unicorn_peek.gd
##
## Boots the autoloads by hand, drops a stand-in player (a CharacterBody3D in group "player") on the customer pad and
## drives scripts/fx_unicorn.gd through `step(delta, active)` with a fixed clock, so the tier table is checked in
## seconds rather than frames: hidden under 3 s, the seeded mid-socket discovery peek at 3 s in the FX zone, dissolve
## to the far socket on activity (velocity, ui_locked), far → mid → near with idle, dwell never above the cap, alpha
## never below the soft floor, no socket inside personal space, no collider, no peek when the player is off in the
## lobby. Scripts are loaded by path (never a class_name) because a `-s` runner compiles before the autoloads exist.

const DT := 0.1
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


func _run() -> void:
	var game_state: Node = root.get_node("GameState")
	var player := CharacterBody3D.new()
	player.name = "PlayerStub"
	player.add_to_group("player")
	player.position = Vector3(10.8, 0.0, -2.0)   # the customer pad west of the FX counter
	root.add_child(player)

	var script: GDScript = load("res://scripts/fx_unicorn.gd")
	var u: Node3D = Node3D.new()
	u.set_script(script)
	root.add_child(u)
	u.set_process(false)   # the test owns the clock
	await process_frame
	var st: Dictionary = script.get_script_constant_map()["State"]
	var hidden_alpha: float = script.get_script_constant_map()["HIDDEN_ALPHA"]
	var peek_alpha: float = script.get_script_constant_map()["PEEK_ALPHA"]
	var max_dwell: float = script.get_script_constant_map()["MAX_DWELL_SEC"]
	var sockets: Array = script.get_script_constant_map()["SOCKETS"]

	print("look")
	var meshes := u.find_children("*", "MeshInstance3D", true, false)
	_check(meshes.size() == 1 and (meshes[0] as MeshInstance3D).mesh != null, "unicorn_pink.glb loaded as one MeshInstance3D")
	var mi := meshes[0] as MeshInstance3D
	var mat := mi.get_active_material(0) as StandardMaterial3D
	_check(mat != null and mat.texture_filter == BaseMaterial3D.TEXTURE_FILTER_NEAREST, "albedo uses the Closest (nearest) filter")
	_check(mat != null and mat.transparency == BaseMaterial3D.TRANSPARENCY_ALPHA and mat.albedo_texture != null, "one textured alpha material (pink sheet embedded)")
	_check(mi.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF, "shadows off")
	_check(u.find_children("*", "CollisionObject3D", true, false).is_empty() and u.find_children("*", "CollisionShape3D", true, false).is_empty(), "no collider — never blocks a path")
	_check(mi.mesh.get_surface_count() == 1 and mi.mesh.get_faces().size() / 3 > 1000, "single surface, %d triangles" % (mi.mesh.get_faces().size() / 3))
	var aabb: AABB = mi.get_aabb()
	var h: float = aabb.size.y * u.get_node("Body").scale.y
	_check(h > 1.0 and h < 1.8, "stands %.2f m tall (horn clears the 1.1 m counter, under head height)" % h)
	_check(FileAccess.file_exists("res://assets/models/fx_unicorn/LICENSE-fx-unicorn.txt"), "LICENSE-fx-unicorn.txt beside the glb (CC-BY 4.0)")
	for i in sockets.size():
		var s: Vector3 = sockets[i]
		_check(s.distance_to(player.position) >= 2.0, "socket %d is %.2f m from the customer pad (≥ 2 m personal space)" % [i, s.distance_to(player.position)])
		_check(s.x > 12.5 and s.x < 14.6 and s.z > -4.9 and s.z < 1.6, "socket %d sits in the east FX run behind the furniture" % i)

	print("seeded discovery (FX zone)")
	game_state.set_zone("FX desk")
	_check(u.state == st["HIDDEN"] and is_equal_approx(u.alpha, hidden_alpha), "starts HIDDEN at the soft floor alpha %.2f" % u.alpha)
	_drive(u, 2.9, false)
	_check(u.state == st["HIDDEN"] and u.alpha <= hidden_alpha + 0.001 and u.peeks == 0, "2.9 s idle: still hidden, no peek")
	_drive(u, 0.3, false)
	_check(u.state != st["HIDDEN"] or u.socket == 1, "3.2 s idle in the FX zone: the seeded peek starts (state %d)" % u.state)
	_drive(u, 1.5, false)
	_check(u.state == st["PEEKING"] and u.socket == 1 and u.seeded and u.peeks == 1, "seeded peek is at the mid socket (socket %d, peeks %d)" % [u.socket, u.peeks])
	_check(u.alpha > 0.6 and u.alpha <= peek_alpha + 0.001, "faded in to alpha %.2f (≤ %.2f)" % [u.alpha, peek_alpha])
	_check(absf(u.global_position.x - sockets[1].x) < 0.01 and absf(u.global_position.z - sockets[1].z) < 0.01, "body stands on the mid socket")
	# Face = glb +Z (horn), mapped onto parent −x by MODEL_YAW −π/2; must track the hero.
	var nose: Vector3 = u.face_dir()
	var to_player := (Vector3(player.position.x, 0, player.position.z) - Vector3(u.global_position.x, 0, u.global_position.z)).normalized()
	_check(nose.dot(to_player) > 0.95, "peek faces the player (dot %.2f)" % nose.dot(to_player))
	# always-face: move the stub while peeking — the nose must track without waiting for a new peek
	player.position = Vector3(10.8, 0.0, 0.5)
	_drive(u, 0.3, false)
	nose = u.face_dir()
	to_player = (Vector3(player.position.x, 0, player.position.z) - Vector3(u.global_position.x, 0, u.global_position.z)).normalized()
	_check(nose.dot(to_player) > 0.95, "tracks the hero while peeking (dot %.2f after pad move)" % nose.dot(to_player))
	player.position = Vector3(10.8, 0.0, -2.0)
	_drive(u, 4.0, false)
	_check(u.state == st["HIDDEN"] and u.alpha <= hidden_alpha + 0.001, "seed dwell over: dissolved back to the soft floor")
	_drive(u, 0.1, false)
	nose = u.face_dir()
	to_player = (Vector3(player.position.x, 0, player.position.z) - Vector3(u.global_position.x, 0, u.global_position.z)).normalized()
	_check(nose.dot(to_player) > 0.95, "hidden silhouette still faces the hero (dot %.2f)" % nose.dot(to_player))
	_check(is_equal_approx(u.MODEL_YAW, -PI / 2), "MODEL_YAW is −π/2 (horn on +Z maps to parent −x)")

	print("activity dissolves to the far socket")
	_drive(u, 3.0, false)   # re-peek gap then a tier-0 peek would start... at socket 0 → relocation first
	_drive(u, 2.0, false)
	_check(u.peeks == 2 and u.socket == 0, "after the seed, the next peek follows the tier table (far socket, peeks %d, socket %d)" % [u.peeks, u.socket])
	player.velocity = Vector3(3.0, 0, 0)
	_drive(u, 0.1, true)
	_check(u.state == st["HIDDEN"] and u.idle_sec == 0.0, "player velocity → idle clock reset, state HIDDEN")
	_drive(u, 1.0, true)
	_check(u.alpha <= hidden_alpha + 0.001 and u.socket == 0, "dissolved to alpha %.2f at the far socket" % u.alpha)
	player.velocity = Vector3.ZERO
	game_state.ui_locked = true
	_drive(u, 5.0, true)
	_check(u.state == st["HIDDEN"] and u.peeks == 2, "an open dialogue / form counts as activity — no peek while ui_locked")
	game_state.ui_locked = false

	print("longer idle → closer socket, longer dwell (capped)")
	var min_alpha := 1.0
	var max_alpha := 0.0
	var longest_visible := 0.0
	var visible_run := 0.0
	var seen_sockets := {}
	var t := 0.0
	while t < 60.0:
		u.step(DT, false)
		t += DT
		min_alpha = minf(min_alpha, u.alpha)
		max_alpha = maxf(max_alpha, u.alpha)
		if u.state == st["PEEKING"]:
			seen_sockets[u.socket] = true
		if u.alpha > hidden_alpha + 0.05:
			visible_run += DT
			longest_visible = maxf(longest_visible, visible_run)
		else:
			visible_run = 0.0
		var body_to_player: float = Vector3(u.global_position.x, 0, u.global_position.z).distance_to(Vector3(player.position.x, 0, player.position.z))
		if body_to_player < 2.0:
			_fail("body came within %.2f m of the player" % body_to_player)
			break
	_check(seen_sockets.has(0) and seen_sockets.has(1) and seen_sockets.has(2), "60 s idle visited far, mid and near sockets (%s)" % str(seen_sockets.keys()))
	_check(u.socket == 2, "ends at the near socket (closest allowed)")
	_check(min_alpha >= hidden_alpha - 0.001 and min_alpha >= 0.05, "alpha never below the soft floor (min %.2f)" % min_alpha)
	_check(max_alpha <= peek_alpha + 0.001, "alpha never above the peek level (max %.2f)" % max_alpha)
	_check(longest_visible <= max_dwell + 2.0, "longest visible run %.1f s ≤ dwell cap %.0f s + fades" % [longest_visible, max_dwell])
	_check(u.peeks >= 4, "%d peeks in a minute — repeeks with gaps, not a stare" % u.peeks)

	print("lobby: no peeks off the FX bay")
	player.velocity = Vector3(3.0, 0, 0)
	u.step(DT, true)
	player.velocity = Vector3.ZERO
	player.position = Vector3(0.0, 0.0, 2.0)
	game_state.set_zone("Lobby")
	var before: int = u.peeks
	_drive(u, 30.0, false)
	_check(u.peeks == before and u.state == st["HIDDEN"] and u.socket == 0, "30 s idle in the lobby: no peek, hidden at the far socket")

	print("")
	if failures == 0:
		print("PASS — 0 failure(s)")
	else:
		print("FAIL — %d failure(s)" % failures)
	quit(0 if failures == 0 else 1)


func _drive(u: Node3D, seconds: float, active: bool) -> void:
	var t := 0.0
	while t < seconds - 0.0001:
		u.step(DT, active)
		t += DT
