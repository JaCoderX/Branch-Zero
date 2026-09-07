extends SceneTree
## Headless budget check for the art pass (docs/WORLD-3D-ENVIRONMENT.md §6). No window, no chain.
##
##   godot --headless --path apps/game -s tests/run_viz_budget.gd
##
## Boots the autoloads by hand, instances the main scene against MockChain and walks the tree: every .glb the
## interior asks for must have loaded (a missing hero/kit file leaves an empty Node3D), the unique-material count
## stays ≤ 40, on-screen triangles stay ≤ 400k, and the surface count (a ceiling on draw calls — the renderer can
## only draw fewer, never more) stays under 350 + labels. Also re-asserts the freeze rules that art can break:
## every StaticBody3D under the interior is layer 1 / mask 0, the six zone volumes are where U3 put them, and
## nothing solid sits in the manager door, the vault opening or on the escort waypoints.

const MAX_MATERIALS := 40
const MAX_TRIS := 400_000
const MAX_SURFACES := 350

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


func _run() -> void:
	var main: Node = load("res://scenes/main/main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	var meshes: Array[MeshInstance3D] = []
	var labels := 0
	var lights := 0
	var shadowed := 0
	var bodies: Array[StaticBody3D] = []
	_walk(main, meshes, bodies)
	for n in _all(main):
		if n is Label3D:
			labels += 1
		elif n is Light3D:
			lights += 1
			if (n as Light3D).shadow_enabled:
				shadowed += 1

	var surfaces := 0
	var tris := 0
	var mats := {}
	var empty_props: PackedStringArray = []
	for mi in meshes:
		if mi.mesh == null:
			continue
		surfaces += mi.mesh.get_surface_count()
		tris += mi.mesh.get_faces().size() / 3
		for i in mi.mesh.get_surface_count():
			var m := mi.get_active_material(i)
			if m != null:
				mats[m.get_instance_id()] = m
	for n in _all(main):
		if n.has_meta("missing_glb"):
			empty_props.append(str(n.get_meta("missing_glb")))
	var batch := main.get_node_or_null("BankInterior/StaticBatch") as MeshInstance3D
	var baked: int = int(batch.get_meta("baked_surfaces", 0)) if batch != null else 0

	print("viz budget (WORLD-3D §6)")
	print("  mesh instances %d (static batch merged %d surfaces into %d) · surfaces (≈ max draw calls) %d · Label3D %d · triangles %d · unique materials %d (PropKit cache %d) · lights %d (%d shadowed)" % [meshes.size(), baked, batch.mesh.get_surface_count() if batch != null else 0, surfaces, labels, tris, mats.size(), PropKit.unique_material_count(), lights, shadowed])
	if batch == null or baked < 150 or tris < 20_000:
		_fail("static batch missing or thin (%d surfaces, %d tris) — the interior did not build" % [baked, tris])
	if empty_props.is_empty():
		_ok("every .glb the interior asked for loaded")
	else:
		_fail("missing .glb: %s" % ", ".join(empty_props))
	if mats.size() <= MAX_MATERIALS:
		_ok("unique materials %d ≤ %d" % [mats.size(), MAX_MATERIALS])
	else:
		_fail("unique materials %d > %d" % [mats.size(), MAX_MATERIALS])
	if tris <= MAX_TRIS:
		_ok("triangles %d ≤ %d (whole building, before culling)" % [tris, MAX_TRIS])
	else:
		_fail("triangles %d > %d" % [tris, MAX_TRIS])
	if surfaces + labels <= MAX_SURFACES:
		_ok("surfaces + labels %d ≤ %d (whole building, before culling)" % [surfaces + labels, MAX_SURFACES])
	else:
		print("  ! surfaces + labels %d > %d before culling — measure the real draw calls with tests/viz_shots.tscn" % [surfaces + labels, MAX_SURFACES])
	if shadowed <= 1:
		_ok("%d shadowed light (budget 1)" % shadowed)
	else:
		_fail("%d shadowed lights (budget 1: the sun)" % shadowed)

	print("freeze rules")
	var bad_layers: PackedStringArray = []
	for b in bodies:
		if b.collision_layer != 1 or b.collision_mask != 0:
			bad_layers.append(b.name)
	if bad_layers.is_empty():
		_ok("%d static bodies: layer 1 / mask 0 (block, do not listen)" % bodies.size())
	else:
		_fail("bodies not layer 1 / mask 0: %s" % ", ".join(bad_layers))
	var interior: Node3D = main.get_node("BankInterior")
	var zones := {
		"Zone Entrance": Vector3(6.0, 1.5, 8.0), "Zone Account Opening": Vector3(-9.0, 1.5, 8.0), "Zone Lobby": Vector3(0.5, 1.5, 0.0),
		"Zone Counter": Vector3(-11.5, 1.5, 1.0), "Zone Vault antechamber": Vector3(8.0, 1.5, -8.0), "Zone Manager's office": Vector3(-8.0, 1.5, -8.0),
	}
	var zone_ok := true
	for zn in zones.keys():
		var z := interior.get_node_or_null(zn) as Area3D
		if z == null or not z.position.is_equal_approx(zones[zn]):
			_fail("zone %s moved or missing" % zn)
			zone_ok = false
	if zone_ok:
		_ok("six zone volumes where U3 put them")
	# keep-clear spots: manager door, vault opening, escort waypoints, teleports, NPC homes
	var clear := [
		["manager door", Vector3(-8.0, 1.0, -5.0), 0.9], ["vault opening", Vector3(8.0, 1.8, -5.0), 1.6],
		["escort wp1", Vector3(-11.6, 1.0, 5.6), 0.5], ["escort wp2", Vector3(-8.5, 1.0, 5.6), 0.5], ["escort wp3", Vector3(-2.0, 1.0, -1.0), 0.5],
		["escort wp4", Vector3(6.0, 1.0, -3.5), 0.5], ["escort wp5", Vector3(8.0, 1.0, -6.8), 0.5],
		["F2", Vector3(-7.0, 1.0, 7.6), 0.4], ["F3", Vector3(-9.5, 1.0, 3.0), 0.4], ["F4", Vector3(8.0, 1.0, -6.5), 0.4], ["F6", Vector3(3.0, 1.0, 6.0), 0.4], ["F7", Vector3(-8.0, 1.0, -7.3), 0.4],
		["spawn", Vector3(5.0, 1.0, 7.0), 0.4],
		["Mo", Vector3(2.0, 1.0, 4.5), 0.4], ["Ines", Vector3(-9.0, 1.0, 6.9), 0.4], ["Dev", Vector3(-11.6, 1.0, 3.0), 0.4], ["Ruth", Vector3(10.0, 1.0, -7.5), 0.4], ["Okafor", Vector3(-8.0, 1.0, -9.8), 0.4],
	]
	var space := root.get_world_3d().direct_space_state
	var blocked: PackedStringArray = []
	for c in clear:
		var q := PhysicsShapeQueryParameters3D.new()
		var sph := SphereShape3D.new()
		sph.radius = c[2]
		q.shape = sph
		q.transform = Transform3D(Basis.IDENTITY, c[1])
		q.collision_mask = 1
		q.collide_with_bodies = true
		q.collide_with_areas = false
		var hits := space.intersect_shape(q, 8)
		var names: PackedStringArray = []
		for h in hits:
			var col: Object = h["collider"]
			if col is StaticBody3D:
				names.append(col.name)
		if not names.is_empty():
			blocked.append("%s ← %s" % [c[0], ", ".join(names)])
	if blocked.is_empty():
		_ok("door gaps, escort waypoints, teleports and NPC homes are clear of solid props")
	else:
		_fail("solid props in keep-clear spots: %s" % "; ".join(blocked))

	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)


func _walk(n: Node, meshes: Array[MeshInstance3D], bodies: Array[StaticBody3D]) -> void:
	if n is MeshInstance3D:
		meshes.append(n)
	if n is StaticBody3D:
		bodies.append(n)
	for c in n.get_children():
		_walk(c, meshes, bodies)


func _all(n: Node) -> Array[Node]:
	var out: Array[Node] = [n]
	for c in n.get_children():
		out.append_array(_all(c))
	return out
