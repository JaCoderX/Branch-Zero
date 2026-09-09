extends SceneTree
## Headless smoke: import KayKit jacket cast and print clip / skeleton / accessory diagnostics.
## Also plays `idle` for a few frames in-tree and asserts the arms leave the T-pose bind (Stage 0A, 2026-09-09:
## `root_node = "."` made every `Rig_Medium/Skeleton3D:*` track miss silently and the cast stood in bind pose).
## Usage: Godot --headless --path apps/game -s res://tests/smoke_kaykit_cast.gd


func _init() -> void:
	call_deferred("_run")


func _absent(root: Node, names: Array) -> bool:
	for n in names:
		if root.find_child(str(n), true, false) != null:
			print(" unexpected part still present: ", n)
			return false
	return true


func _role_ok(role: String, height: float, expect_bones: int, forbid: Array) -> bool:
	var ch: Dictionary = PropKit.character(role, height)
	var root: Node3D = ch["root"]
	var anim: AnimationPlayer = ch["anim"]
	var skeleton: Skeleton3D = ch["skeleton"]
	var ok := true
	print("role=", role, " mesh=", PropKit.KAYKIT_MESHES.get(role, "?"), " bones=", skeleton.get_bone_count() if skeleton else -1)
	if skeleton == null or skeleton.get_bone_count() != expect_bones:
		ok = false
	if anim == null or not anim.has_animation("idle") or not anim.has_animation("walk") or not anim.has_animation("greet"):
		ok = false
	if not _absent(root, forbid):
		ok = false
	root.free()
	return ok


## Angle (deg) between the left upper arm and straight down: 90 = T-pose bind, Idle_A ≈ 41.
func _upperarm_deg(skeleton: Skeleton3D) -> float:
	var up := skeleton.find_bone("upperarm.l")
	var lo := skeleton.find_bone("lowerarm.l")
	if up < 0 or lo < 0:
		return -1.0
	var v: Vector3 = (skeleton.get_bone_global_pose(lo).origin - skeleton.get_bone_global_pose(up).origin).normalized()
	return rad_to_deg(acos(clampf(v.dot(Vector3.DOWN), -1.0, 1.0)))


## In-tree: play idle, advance frames, require every idle track to resolve and the arms to drop out of bind pose.
func _idle_not_bind(role: String) -> bool:
	var ch: Dictionary = PropKit.character(role, 1.8)
	var root: Node3D = ch["root"]
	var anim: AnimationPlayer = ch["anim"]
	var skeleton: Skeleton3D = ch["skeleton"]
	get_root().add_child(root)
	var ok := anim != null and skeleton != null
	if ok:
		var base := anim.get_node_or_null(anim.root_node)
		var idle: Animation = anim.get_animation("idle")
		var unresolved := 0
		for i in idle.get_track_count():
			var p: NodePath = idle.track_get_path(i)
			var n := base.get_node_or_null(NodePath(String(p).split(":")[0])) if base != null else null
			if not (n is Skeleton3D) or (n as Skeleton3D).find_bone(String(p.get_subname(0))) < 0:
				unresolved += 1
		var rest_deg := _upperarm_deg(skeleton)
		anim.play("idle")
		for i in 12:
			await process_frame
		var deg := _upperarm_deg(skeleton)
		print("idle pose role=", role, " root_node=", anim.root_node, " base=", base.name if base else "null",
			" unresolved=", unresolved, "/", idle.get_track_count(), " upperarm bind=", snappedf(rest_deg, 0.1), " idle=", snappedf(deg, 0.1))
		if unresolved > 0 or anim.current_animation != "idle" or deg < 0.0 or deg > 70.0 or absf(deg - rest_deg) < 10.0:
			print(" FAIL: idle tracks miss or the cast is still in bind / T-pose")
			ok = false
	root.queue_free()
	return ok


func _run() -> void:
	var ok := true
	var ch: Dictionary = PropKit.character("greeter", 1.78)
	var root: Node3D = ch["root"]
	var anim: AnimationPlayer = ch["anim"]
	var skeleton: Skeleton3D = ch["skeleton"]
	print("USE_KAYKIT_CAST=", PropKit.USE_KAYKIT_CAST)
	print("root=", root.name if root else "null", " children=", root.get_child_count() if root else 0)
	print("skeleton=", skeleton.name if skeleton else "null", " bones=", skeleton.get_bone_count() if skeleton else 0)
	if skeleton != null:
		for b in ["head", "Head", "hips", "Hips"]:
			print(" bone ", b, "=", skeleton.find_bone(b))
	print("anim=", anim.name if anim else "null")
	if anim != null:
		print(" root_node=", anim.root_node)
		print(" libraries=", anim.get_animation_library_list())
		print(" list=", anim.get_animation_list())
		for clip in PropKit.STAFF_CLIPS:
			var has := anim.has_animation(clip)
			print(" has ", clip, "=", has)
			if has:
				var a: Animation = anim.get_animation(clip)
				print("  tracks=", a.get_track_count(), " len=", a.length)
				if a.get_track_count() > 0:
					print("  track0 path=", a.track_get_path(0))
			else:
				ok = false
		anim.play("idle")
		print(" playing=", anim.current_animation)
	else:
		ok = false
	# Keep off-tree sample for path inspection of a source library
	var packed: PackedScene = load("res://assets/characters/kaykit_adventurers/Animations/Rig_Medium_General.glb")
	if packed:
		var tmp := packed.instantiate()
		var src := tmp.find_child("AnimationPlayer", true, false) as AnimationPlayer
		print("src General anim=", src != null, " list=", src.get_animation_list() if src else [])
		if src != null and src.get_animation_list().size() > 0:
			var first: StringName = src.get_animation_list()[0]
			var sa: Animation = src.get_animation(first)
			print(" src first=", first, " tracks=", sa.get_track_count())
			for i in mini(sa.get_track_count(), 6):
				print("  ", sa.track_get_path(i), " type=", sa.track_get_type(i))
		tmp.free()
	if not _absent(root, ["Ranger_Quiver"]):
		ok = false
	root.free()

	# ENG-2026-0017 jacket cast: accessories already gone in the glbs; Rig_Medium still 23 bones.
	if not _role_ok("vault_keeper", 1.82, 23, ["Knight_Helmet", "Knight_HelmetVisor"]):
		ok = false
	if not _role_ok("clerk", 1.70, 23, ["Mage_Hat"]):
		ok = false
	if not _role_ok("dealer", 1.75, 23, ["RogueHooded_Mask"]):
		ok = false
	if not _role_ok("manager", 1.85, 23, ["Barbarian_BearHat"]):
		ok = false
	if not _role_ok("teller", 1.76, 23, []):
		ok = false

	# Stage 0A: idle must actually drive the skeleton (not the T-pose bind) on a shared and a derivative body.
	for role in ["greeter", "vault_keeper", "dealer"]:
		if not await _idle_not_bind(role):
			ok = false

	print("SMOKE_KAYKIT=", "PASS" if ok else "FAIL")
	quit(0 if ok else 1)
