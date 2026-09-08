extends SceneTree
## Headless smoke: import KayKit cast path and print clip / skeleton / track diagnostics.
## Usage: Godot --headless --path apps/game -s res://tests/smoke_kaykit_cast.gd


func _init() -> void:
	call_deferred("_run")


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
	root.free()
	print("SMOKE_KAYKIT=", "PASS" if ok else "FAIL")
	quit(0 if ok else 1)
