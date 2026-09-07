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
## nothing solid sits in the manager door, the vault opening or on the escort waypoints. Stage 3 adds the
## characters: clips present, U3 capsules unchanged, head height, one shared atlas material, Petra's skin entry.
## Stage 4 adds the shell: the wall / ceiling modules exist and all went into the static batch, the skylight glass
## and NamesBoardQuad stayed out of it, and the pendant count is still eight shadowless omnis (a ninth is unlit
## on the merged mesh under Compatibility). Stage 5 adds the feel layer: at most two particle systems (CPU, shadowless,
## unshaded billboards) whose materials still fit the 40, Inter installed as the default font with Cinzel on the title
## plaques (both OFL, licences beside the files), the HUD anchored to the bottom band, and the spring arm off the shoulder.
## Stage 6d adds the plants: the Kenney Nature Kit picks and their licence are present, the eight planters stand where
## the Furniture Kit plants stood with the same colliders, every kit material was replaced by a palette Material (no
## metallic-1 teal survives, +0 unique materials), all of it baked, the arrangements are denser than the 60-tri
## pottedPlant they replace, and no planter reaches the ledger-board rows or the vault repeater / clock sightlines.

const MAX_MATERIALS := 40
const MAX_TRIS := 400_000
const MAX_SURFACES := 350
const MAX_OMNIS := 8          # Compatibility lights ≤ 8 omnis per mesh and the merged interior sees them all
const MIN_SHELL_PIECES := 300  # Stage 4 built 415 wall / ceiling modules; fewer means a build path was lost
const MAX_PARTICLES := 2       # Stage 5: skylight dust + stamp ink — CPUParticles3D only, shadowless, unshaded
const MIN_PLAQUES_DRESSED := 8 # Stage 5: title plaques carrying the Cinzel face
const MIN_PLANTERS := 9        # Stage 6d: LobbyPlant0..2, AOPlant, AODeskPlant, MgrPlant, NameDeskPlant, VaultLedgePlant, MgrCabinetPlant
const MIN_NATURE_TRIS := 1200  # Stage 6d: the eight Furniture Kit plants were ~640 tris together; denser or it is not an upgrade

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

	# characters (U7 viz Stage 3): animated, so outside the static batch — budget them as surfaces × passes explicitly
	print("characters (Stage 3)")
	var bodies3: Array = main.get_tree().get_nodes_in_group("npc")
	bodies3.append(main.get_node("Player"))
	var char_surfaces := 0
	var char_mats := {}
	var char_bad: PackedStringArray = []
	for c in bodies3:
		var body := (c as Node).get_node_or_null("Body") as Node3D
		var anim := body.find_child("AnimationPlayer", true, false) as AnimationPlayer if body != null else null
		if body == null or anim == null:
			char_bad.append("%s: no animated body" % c.name)
			continue
		var want := ["idle", "walk", "interact-right", "emote-no"] if c is Npc else ["idle", "walk", "sprint"]
		for clip in want:
			if not anim.has_animation(clip):
				char_bad.append("%s: missing clip %s" % [c.name, clip])
		var cap: CapsuleShape3D = null
		for ch in c.get_children():
			if ch is CollisionShape3D and (ch as CollisionShape3D).shape is CapsuleShape3D:
				cap = (ch as CollisionShape3D).shape
		var want_h := 1.75 if c is Npc else 1.8
		if cap == null or not is_equal_approx(cap.radius, 0.35) or not is_equal_approx(cap.height, want_h):
			char_bad.append("%s: collider is not the U3 capsule" % c.name)
		var root := body.get_child(0) as Node3D
		var h := PropKit.aabb(root).size.y * root.scale.y
		if absf(h - want_h) > 0.05:
			char_bad.append("%s: head height %.2f m, want %.2f" % [c.name, h, want_h])
		for mi in PropKit._meshes(body):
			if mi.mesh == null:
				continue
			char_surfaces += mi.mesh.get_surface_count()
			for i in mi.mesh.get_surface_count():
				var m := mi.get_active_material(i)
				if m != null:
					char_mats[m.get_instance_id()] = m
	print("  %d characters · %d surfaces (≈ %d draw calls with 2 shadow splits if all on screen) · %d character material(s)" % [bodies3.size(), char_surfaces, char_surfaces * 3, char_mats.size()])
	if char_bad.is_empty():
		_ok("five NPCs + player: clips idle / walk / interact-right / emote-no (player: sprint), U3 capsules, head at 1.75 / 1.8 m")
	else:
		_fail("characters: %s" % "; ".join(char_bad))
	if char_mats.size() <= 1:
		_ok("characters share one atlas material")
	else:
		_fail("characters use %d materials (one shared atlas expected)" % char_mats.size())
	var skins: Dictionary = Npc.SKINS
	if skins.has("registrar"):
		_ok("npc.gd SKINS has an explicit registrar entry (%s) for U5" % skins["registrar"])
	else:
		_fail("npc.gd SKINS has no registrar entry")

	# architecture shell (U7 viz Stage 4): mesh-only modules that must all have merged into the batch
	print("shell (Stage 4)")
	var interior4: Node3D = main.get_node("BankInterior")
	var pieces := int(interior4.get_meta("shell_pieces", 0))
	var loose: PackedStringArray = []
	for n in _all(interior4):
		if n is MeshInstance3D and n != batch:
			loose.append(n.name)
	print("  %d shell modules built · %d mesh instances left outside the batch (%s)" % [pieces, loose.size(), ", ".join(loose)])
	if pieces >= MIN_SHELL_PIECES:
		_ok("wall / ceiling shell present (%d modules ≥ %d)" % [pieces, MIN_SHELL_PIECES])
	else:
		_fail("wall / ceiling shell thin or missing: %d modules < %d" % [pieces, MIN_SHELL_PIECES])
	if baked >= pieces + 250:
		_ok("static batch took the shell (%d surfaces merged, Stage 3 had 282)" % baked)
	else:
		_fail("static batch merged only %d surfaces for %d shell modules — something stayed unbatched or stopped building" % [baked, pieces])
	var sky := interior4.get_node_or_null("SkyGlass") as MeshInstance3D
	var names_quad := interior4.get_node_or_null("NamesBoardQuad") as MeshInstance3D
	if sky != null and sky.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF and sky.has_meta("no_batch"):
		_ok("skylight glass is its own node, no_batch, casts no shadow")
	else:
		_fail("skylight glass was batched, lost no_batch, or casts a shadow")
	if names_quad != null and names_quad.has_meta("no_batch"):
		_ok("NamesBoardQuad is still its own no_batch node (U5 swaps its material)")
	else:
		_fail("NamesBoardQuad missing or batched")
	if loose.size() <= 3:
		_ok("only %d mesh instance(s) outside the batch under BankInterior (batch + glass + quad)" % loose.size())
	else:
		_fail("%d mesh instances outside the batch under BankInterior: %s" % [loose.size(), ", ".join(loose)])
	var omnis := 0
	var omni_shadow := 0
	for n in _all(main):
		if n is OmniLight3D:
			omnis += 1
			if (n as OmniLight3D).shadow_enabled:
				omni_shadow += 1
	if omnis <= MAX_OMNIS and omni_shadow == 0:
		_ok("%d shadowless omnis ≤ %d (no ninth on the merged interior)" % [omnis, MAX_OMNIS])
	else:
		_fail("%d omnis (%d shadowed) — budget is %d shadowless" % [omnis, omni_shadow, MAX_OMNIS])

	# feel (U7 viz Stage 5): particles, fonts, HUD band, OTS arm
	print("feel (Stage 5)")
	var particles: Array[GeometryInstance3D] = []
	for n in _all(main):
		if n is CPUParticles3D or n is GPUParticles3D:
			particles.append(n)
	var p_names: PackedStringArray = []
	var p_bad: PackedStringArray = []
	var p_mats := {}
	for p in particles:
		p_names.append(p.name)
		if p is GPUParticles3D:
			p_bad.append("%s is GPUParticles3D (CPUParticles3D only on Compatibility web)" % p.name)
		if p.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
			p_bad.append("%s casts shadows" % p.name)
		var pm := p.material_override as StandardMaterial3D
		if pm == null or pm.shading_mode != BaseMaterial3D.SHADING_MODE_UNSHADED or pm.billboard_mode == BaseMaterial3D.BILLBOARD_DISABLED:
			p_bad.append("%s is not an unshaded billboard" % p.name)
		elif not mats.has(pm.get_instance_id()):
			p_mats[pm.get_instance_id()] = pm
		if p.get_parent() != null and p.get_parent().name == "BankInterior":
			p_bad.append("%s sits under BankInterior (bake_static territory)" % p.name)
	print("  %d particle system(s): %s · %d particle material(s) → %d unique materials with them" % [particles.size(), ", ".join(p_names), p_mats.size(), mats.size() + p_mats.size()])
	if particles.size() <= MAX_PARTICLES and p_bad.is_empty():
		_ok("%d particle systems ≤ %d, all CPU, shadowless, unshaded billboards" % [particles.size(), MAX_PARTICLES])
	else:
		_fail("particles: %d systems (max %d); %s" % [particles.size(), MAX_PARTICLES, "; ".join(p_bad)])
	if mats.size() + p_mats.size() <= MAX_MATERIALS:
		_ok("unique materials with particles %d ≤ %d" % [mats.size() + p_mats.size(), MAX_MATERIALS])
	else:
		_fail("unique materials with particles %d > %d" % [mats.size() + p_mats.size(), MAX_MATERIALS])
	var df := ThemeDB.get_default_theme().default_font
	var df_path := ""
	if df is FontVariation and (df as FontVariation).base_font != null:
		df_path = (df as FontVariation).base_font.resource_path
	elif df != null:
		df_path = df.resource_path
	if df_path.ends_with("Inter.ttf"):
		_ok("UI face is Inter (default theme font %s)" % df_path)
	else:
		_fail("default theme font is %s, not assets/fonts/Inter.ttf" % ("<built-in>" if df_path == "" else df_path))
	var licences_ok := FileAccess.file_exists("res://assets/fonts/LICENSE-inter-OFL.txt") and FileAccess.file_exists("res://assets/fonts/LICENSE-cinzel-OFL.txt")
	if ResourceLoader.exists("res://assets/fonts/Cinzel.ttf") and licences_ok:
		_ok("Cinzel.ttf present; OFL licence files beside both fonts")
	else:
		_fail("Cinzel.ttf or an OFL licence file is missing under assets/fonts/")
	var feel := main.get_node_or_null("Feel")
	var dressed := int(feel.get_meta("plaques_dressed", 0)) if feel != null else 0
	if dressed >= MIN_PLAQUES_DRESSED:
		_ok("%d title plaques carry the plaque face (≥ %d); body signs keep Inter" % [dressed, MIN_PLAQUES_DRESSED])
	else:
		_fail("only %d plaques carry the plaque face (want ≥ %d) — Feel node missing or dress_plaques ran early" % [dressed, MIN_PLAQUES_DRESSED])
	var hud_pass: Control = null
	var hud_zone: Control = null
	for c in main.get_children():
		if c is CanvasLayer and c.has_node("Passbook"):
			hud_pass = c.get_node("Passbook")
			hud_zone = c.get_node_or_null("Zone")
	if hud_pass != null and hud_zone != null and hud_pass.anchor_top == 1.0 and hud_pass.offset_bottom <= 0.0 and hud_zone.anchor_top == 1.0 and hud_zone.offset_bottom <= 0.0:
		_ok("HUD passbook and zone chip anchor to the bottom band (ledger / frieze / vault repeater clear)")
	else:
		_fail("HUD passbook or zone chip is not anchored to the bottom band")
	var arm := main.get_node_or_null("Player/CamPivot/Arm") as SpringArm3D
	if arm != null and arm.position.x >= 0.4 and arm.rotation_degrees.x > -20.0 and arm.rotation_degrees.x < -8.0 and arm.collision_mask == 1:
		_ok("spring arm %.2f m off the shoulder at %.0f°, still colliding on layer 1" % [arm.position.x, arm.rotation_degrees.x])
	else:
		_fail("spring arm is not the Stage 5 OTS arm (offset ≥ 0.4 m, pitch −8…−20°, mask 1)")

	# fill (U7 viz Stage 6a): KayKit Furniture Bits (CC0) replace the Kenney fill in the high-traffic zones. Every pick
	# must have loaded, been split into palette materials (no textured / white KayKit material survives), and merged
	# into the static batch; the licence file sits beside the models; the retired Kenney files are gone; the bench,
	# chair and bookcase colliders those props used to sit on are still exactly where U3 / U7 put them.
	print("fill (Stage 6a)")
	var kk_dir := "res://assets/models/kaykit_furniture/"
	var kk_files: PackedStringArray = []
	var kk_missing: PackedStringArray = []
	for f in ["couch", "chair_A", "chair_stool", "table_small", "lamp_table", "lamp_standing", "cabinet_medium", "cabinet_medium_decorated", "shelf_B_large_decorated", "book_set", "rug_rectangle_stripes_B", "rug_oval_B", "pictureframe_large_A", "pictureframe_large_B", "pictureframe_medium"]:
		kk_files.append(f)
		if not ResourceLoader.exists(kk_dir + f + ".glb"):
			kk_missing.append(f)
	var kk_nodes := 0
	for n in _all(interior4):
		if n.has_meta("glb") and str(n.get_meta("glb")).begins_with(kk_dir):
			kk_nodes += 1
	var kk_split := int(interior4.get_meta("kaykit_split_meshes", 0))
	var kk_tris := int(interior4.get_meta("kaykit_tris", 0))
	print("  %d KayKit picks · %d instances asked for · %d meshes split into palette surfaces (%d tris)" % [kk_files.size(), int(interior4.get_meta("kaykit_instances", 0)), kk_split, kk_tris])
	if kk_missing.is_empty() and FileAccess.file_exists(kk_dir + "LICENSE-kaykit-furniture-bits.txt"):
		_ok("all %d KayKit .glb present with LICENSE-kaykit-furniture-bits.txt beside them" % kk_files.size())
	else:
		_fail("KayKit files missing: %s (licence %s)" % [", ".join(kk_missing), "present" if FileAccess.file_exists(kk_dir + "LICENSE-kaykit-furniture-bits.txt") else "MISSING"])
	if int(interior4.get_meta("kaykit_instances", 0)) >= 20 and kk_split >= 20 and kk_nodes == 0:
		_ok("%d KayKit props placed, every mesh split by UV cell and baked (no KayKit root left standing)" % int(interior4.get_meta("kaykit_instances", 0)))
	else:
		_fail("KayKit fill: %d placed, %d split, %d roots left outside the batch" % [int(interior4.get_meta("kaykit_instances", 0)), kk_split, kk_nodes])
	var white_mats: PackedStringArray = []
	for id in mats.keys():
		var m: Material = mats[id]
		if m is StandardMaterial3D and (m as StandardMaterial3D).albedo_color.is_equal_approx(Color.WHITE) and (m as StandardMaterial3D).albedo_texture == null:
			white_mats.append(m.resource_name)
	if white_mats.is_empty():
		_ok("no plain-white untextured material in the scene (every KayKit surface took a palette material)")
	else:
		_fail("plain-white materials survive: %s" % ", ".join(white_mats))
	var retired: PackedStringArray = []
	for f in ["benchCushion", "lampRoundTable"]:
		if ResourceLoader.exists("res://assets/models/kenney_furniture/" + f + ".glb"):
			retired.append(f)
	if retired.is_empty():
		_ok("retired Kenney files gone (benchCushion, lampRoundTable)")
	else:
		_fail("retired Kenney files still in the tree: %s" % ", ".join(retired))
	var seats := {"Bench0Collider": Vector3(-4.5, 0.25, 2.5), "Bench3Collider": Vector3(4.5, 0.25, 2.5), "VaultBenchCollider": Vector3(3.0, 0.25, -8.0), "MgrChairA": Vector3(-8.8, 0.0, -7.6), "MgrBookcase": Vector3(-4.2, 0.0, -10.6)}
	var seat_bad: PackedStringArray = []
	for sn in seats.keys():
		var b := interior4.get_node_or_null(sn) as StaticBody3D
		if b == null or not b.position.is_equal_approx(seats[sn]):
			seat_bad.append(sn)
	if seat_bad.is_empty():
		_ok("bench, guest-chair and bookcase colliders still where U3 / U7 put them")
	else:
		_fail("fill colliders moved or missing: %s" % ", ".join(seat_bad))

	# surfaces (U7 viz Stage 6c): ambientCG CC0 albedo JPEGs tint existing Marble/Wood/Ceiling/Paper slots — no new materials.
	print("surfaces (Stage 6c)")
	var surf_dir := "res://assets/textures/surfaces/"
	var surf_missing: PackedStringArray = []
	for f in ["marble_albedo.jpg", "wood_albedo.jpg", "plaster_albedo.jpg", "LICENSE-ambientcg.txt"]:
		if not FileAccess.file_exists(surf_dir + f):
			surf_missing.append(f)
	if surf_missing.is_empty():
		_ok("ambientCG albedo trio + LICENSE-ambientcg.txt present under textures/surfaces/")
	else:
		_fail("Stage 6c surfaces missing: %s" % ", ".join(surf_missing))
	var textured_slots := 0
	for slot in ["Marble", "Wood", "Ceiling", "Paper"]:
		var sm: StandardMaterial3D = PropKit.palette(slot)
		if sm != null and sm.albedo_texture != null:
			textured_slots += 1
	if textured_slots >= 4:
		_ok("Marble / Wood / Ceiling / Paper palette slots carry albedo textures (no new material class)")
	else:
		_fail("only %d/4 Stage 6c palette slots textured" % textured_slots)

	# plants (U7 viz Stage 6d): Kenney Nature Kit (CC0) planters replace the Furniture Kit plants in place.
	print("plants (Stage 6d)")
	var nk_dir := "res://assets/models/kenney_nature/"
	var nk_files: PackedStringArray = ["pot_large", "pot_small", "tree_thin", "tree_small_dark", "tree_palmShort", "plant_bushDetailed", "plant_bushSmall", "plant_flatShort", "plant_flatTall", "flower_redA"]
	var nk_missing: PackedStringArray = []
	for f in nk_files:
		if not ResourceLoader.exists(nk_dir + f + ".glb"):
			nk_missing.append(f)
	var nk_roots := 0
	var planters: Dictionary = {}
	for n in _all(interior4):
		if n.has_meta("glb") and str(n.get_meta("glb")).begins_with(nk_dir):
			nk_roots += 1
		if n.has_meta("planter"):
			planters[n.name] = n.get_meta("planter_aabb")
	var nk_instances := int(interior4.get_meta("nature_instances", 0))
	var nk_tris := int(interior4.get_meta("nature_tris", 0))
	print("  %d Nature Kit picks · %d instances in %d planters (%d tris) · %d kit roots left outside the batch" % [nk_files.size(), nk_instances, planters.size(), nk_tris, nk_roots])
	if nk_missing.is_empty() and FileAccess.file_exists(nk_dir + "LICENSE-kenney-nature-kit.txt"):
		_ok("all %d Nature Kit .glb present with LICENSE-kenney-nature-kit.txt beside them" % nk_files.size())
	else:
		_fail("Nature Kit files missing: %s (licence %s)" % [", ".join(nk_missing), "present" if FileAccess.file_exists(nk_dir + "LICENSE-kenney-nature-kit.txt") else "MISSING"])
	var want_planters: PackedStringArray = ["LobbyPlant0", "LobbyPlant1", "LobbyPlant2", "AOPlant", "AODeskPlant", "MgrPlant", "NameDeskPlant", "VaultLedgePlant", "MgrCabinetPlant"]
	var planter_missing: PackedStringArray = []
	for pn in want_planters:
		if not planters.has(pn):
			planter_missing.append(pn)
	if planters.size() >= MIN_PLANTERS and planter_missing.is_empty() and nk_instances >= 2 * 8 and nk_roots == 0:
		_ok("%d planters (pot + foliage, %d kit instances), every Nature Kit mesh baked (no kit root left standing)" % [planters.size(), nk_instances])
	else:
		_fail("planters: %d built (missing %s), %d kit instances, %d kit roots outside the batch" % [planters.size(), ", ".join(planter_missing), nk_instances, nk_roots])
	# Manager cabinet must be the undecorated KayKit body (decorated baked a plant into the atlas — consistency pass).
	# Recorded in _count_fill before bake frees the KayKit roots.
	var decorated_cabs := int(interior4.get_meta("kaykit_decorated_cabinets", -1))
	var mgr_cab_glb := str(interior4.get_meta("mgr_bookcase_glb", ""))
	if decorated_cabs == 0 and mgr_cab_glb.ends_with("cabinet_medium.glb") and planters.has("MgrCabinetPlant"):
		_ok("manager cabinet is plain KayKit + Nature Kit MgrCabinetPlant (no decorated atlas plant)")
	else:
		_fail("manager cabinet consistency: decorated_cabs=%d mgr_glb=%s MgrCabinetPlant=%s" % [decorated_cabs, mgr_cab_glb, planters.has("MgrCabinetPlant")])
	if nk_tris >= MIN_NATURE_TRIS:
		_ok("plants are %d tris (≥ %d; the Furniture Kit plants were ~640) — denser silhouettes" % [nk_tris, MIN_NATURE_TRIS])
	else:
		_fail("plants are only %d tris (< %d) — not denser than the Furniture Kit plants" % [nk_tris, MIN_NATURE_TRIS])
	var kit_mats: PackedStringArray = []
	for id in mats.keys():
		var m: Material = mats[id]
		if m is StandardMaterial3D and (m as StandardMaterial3D).metallic >= 0.95 and (m as StandardMaterial3D).roughness >= 0.95:
			kit_mats.append(m.resource_name)   # the Nature Kit's own factors — nothing in the palette is metallic 1 / rough 1
	if kit_mats.is_empty() and mats.size() <= 36:
		_ok("no Nature Kit material survives (metallic 1 / roughness 1); %d unique mesh materials ≤ 36 (Stage 6c had 36 — plants cost +0)" % mats.size())
	else:
		_fail("Nature Kit remap leaked: raw kit materials %s; %d unique mesh materials (Stage 6c: 36)" % [", ".join(kit_mats), mats.size()])
	var retired6d: PackedStringArray = []
	for f in ["pottedPlant", "plantSmall1", "plantSmall2", "plantSmall3"]:
		if ResourceLoader.exists("res://assets/models/kenney_furniture/" + f + ".glb"):
			retired6d.append(f)
	if retired6d.is_empty():
		_ok("retired Furniture Kit plants gone (pottedPlant, plantSmall1–3)")
	else:
		_fail("retired Furniture Kit plant files still in the tree: %s" % ", ".join(retired6d))
	# colliders under the plants that block: the three lobby cylinders and the Account Opening landmark box (U3 places)
	var plant_bodies := {"LobbyPlant0BodyCollider": Vector3(-5.0, 1.0, -3.2), "LobbyPlant1BodyCollider": Vector3(-1.0, 1.0, -3.2), "LobbyPlant2BodyCollider": Vector3(3.0, 1.0, -3.2), "AOPlantCollider": Vector3(-11.6, 1.1, 9.6)}
	var plant_body_bad: PackedStringArray = []
	for bn in plant_bodies.keys():
		var b := interior4.get_node_or_null(bn) as StaticBody3D
		if b == null or not b.position.is_equal_approx(plant_bodies[bn]):
			plant_body_bad.append(bn)
	if plant_body_bad.is_empty():
		_ok("lobby plant cylinders and the Account Opening landmark box still where U3 put them")
	else:
		_fail("plant colliders moved or missing: %s" % ", ".join(plant_body_bad))
	# sightlines: from the lobby eye points the ledger-board rows (y ≥ 2.2 at z = -4.7), the vault repeater
	# (8, 3.58, -4.78) and the door clock (8, 3.62, -10.08) must not cross a planter's tight AABB (vertex extents);
	# floor planters stay within 1.4 m of footprint (the 1 m colliders + frond overhang above shoulder height) and
	# under 2.0 m; desk pots stay under 0.6 m
	var eyes: Array[Vector3] = [Vector3(3.0, 1.7, 6.0), Vector3(8.0, 1.7, 1.0), Vector3(5.0, 1.7, 9.0), Vector3(-1.0, 1.7, 0.5)]
	var targets := {"ledger rows": Vector3(0.0, 2.3, -4.7), "ledger rows west": Vector3(-3.5, 2.3, -4.7), "vault repeater": Vector3(8.0, 3.58, -4.78), "vault clock": Vector3(8.0, 3.62, -10.08)}
	var sight_bad: PackedStringArray = []
	var tall: PackedStringArray = []
	for pn in planters.keys():
		var bb: AABB = planters[pn]
		var floor_planter: bool = str(pn).begins_with("LobbyPlant") or str(pn) == "AOPlant"
		if floor_planter and bb.end.y > 2.0:
			tall.append("%s %.2f m" % [pn, bb.end.y])
		if floor_planter and (bb.size.x > 1.4 or bb.size.z > 1.4):
			tall.append("%s footprint %.2f × %.2f m" % [pn, bb.size.x, bb.size.z])
		if not floor_planter and str(pn) != "MgrCabinetPlant" and bb.size.y > 0.6:
			tall.append("%s desk pot %.2f m" % [pn, bb.size.y])
		if str(pn) == "MgrCabinetPlant" and bb.size.y > 0.75:
			tall.append("%s cabinet pot %.2f m" % [pn, bb.size.y])
		for e in eyes:
			for tn in targets.keys():
				if bb.intersects_segment(e, targets[tn]):
					sight_bad.append("%s blocks %s from %s" % [pn, tn, str(e)])
	if sight_bad.is_empty() and tall.is_empty():
		_ok("no planter crosses the ledger-board, repeater or clock sightlines; floor planters ≤ 2.0 m, desk pots ≤ 0.6 m")
	else:
		_fail("planters: %s" % "; ".join(sight_bad + tall))

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
	# U7 polish: the Counter volume grew north to the manager glass (Petra's annex chips as Counter); the rest is U3
	var zones := {
		"Zone Entrance": Vector3(6.0, 1.5, 8.0), "Zone Account Opening": Vector3(-9.0, 1.5, 8.0), "Zone Lobby": Vector3(0.5, 1.5, 0.0),
		"Zone Counter": Vector3(-11.5, 1.5, 0.0), "Zone Vault antechamber": Vector3(8.0, 1.5, -8.0), "Zone Manager's office": Vector3(-8.0, 1.5, -8.0),
	}
	var zone_ok := true
	for zn in zones.keys():
		var z := interior.get_node_or_null(zn) as Area3D
		if z == null or not z.position.is_equal_approx(zones[zn]):
			_fail("zone %s moved or missing" % zn)
			zone_ok = false
	if zone_ok:
		_ok("six zone volumes where U3 put them (Counter stretched north, U7 polish)")
	# keep-clear spots: manager door, vault opening, escort waypoints, teleports, NPC homes (U7 polish homes)
	var clear := [
		["manager door", Vector3(-8.0, 1.0, -5.0), 0.9], ["vault opening", Vector3(8.0, 1.8, -5.0), 1.6],
		["escort wp1", Vector3(-11.6, 1.0, 5.6), 0.5], ["escort wp2", Vector3(-8.5, 1.0, 5.6), 0.5], ["escort wp3", Vector3(-2.0, 1.0, -1.0), 0.5],
		["escort wp4", Vector3(6.0, 1.0, -3.5), 0.5], ["escort wp5", Vector3(8.0, 1.0, -6.8), 0.5],
		["F2", Vector3(-9.0, 1.0, 6.3), 0.4], ["F3", Vector3(-9.5, 1.0, 3.0), 0.4], ["F4", Vector3(8.0, 1.0, -6.5), 0.4], ["F6", Vector3(3.0, 1.0, 6.0), 0.4], ["F7", Vector3(-8.0, 1.0, -7.3), 0.4], ["F8", Vector3(-9.5, 1.0, -1.0), 0.4],
		["spawn", Vector3(5.0, 1.0, 7.0), 0.4],
		["Mo", Vector3(2.0, 1.0, 4.5), 0.4], ["Ines", Vector3(-9.0, 1.0, 9.5), 0.4], ["Dev", Vector3(-11.6, 1.0, 3.0), 0.4], ["Petra", Vector3(-11.6, 1.0, -1.0), 0.4], ["Bob", Vector3(10.0, 1.0, -7.5), 0.4], ["Okafor", Vector3(-8.0, 1.0, -9.8), 0.4],
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

	# U7 polish (principal playtest findings 2 · 3 · 4 · 5 · 9): the manager doorway carries no mesh at all (the
	# brass rail used to cross it as a sill — a solid-body probe never saw it), the NPC homes and yaws are the polish
	# ones, and the strongroom behind the vault door exists with the frame's blind disc hidden and a 60°+ swing.
	print("U7 polish")
	var door_tris := 0
	if batch != null:
		var faces := batch.mesh.get_faces()   # interior-local == world: BankInterior sits at the origin
		for i in range(0, faces.size() - 2, 3):
			var c: Vector3 = (faces[i] + faces[i + 1] + faces[i + 2]) / 3.0
			if c.x > -8.9 and c.x < -7.1 and c.y > 0.02 and c.y < 2.6 and c.z > -5.3 and c.z < -4.7:
				door_tris += 1
	if door_tris == 0:
		_ok("manager doorway x ∈ [-9, -7] at z = -5 is empty of mesh below 2.6 m (no rail, no sill, no mullion)")
	else:
		_fail("%d triangles sit in the manager doorway — a rail / mullion still crosses the door" % door_tris)
	var homes := {
		"NPC_clerk": [Vector3(-9.0, 0.0, 9.5), 0.0], "NPC_registrar": [Vector3(-11.6, 0.0, -1.0), -PI / 2],
		"NPC_manager": [Vector3(-8.0, 0.0, -9.8), PI], "NPC_vault_keeper": [Vector3(10.0, 0.0, -7.5), PI * 0.6],
	}
	var home_bad: PackedStringArray = []
	for hn in homes.keys():
		var npc := main.get_node_or_null("NPCs/" + hn) as Npc
		if npc == null:
			home_bad.append("%s missing" % hn)
		elif not npc.home.is_equal_approx(homes[hn][0]) or absf(angle_difference(npc.home_yaw, homes[hn][1])) > 0.01:
			home_bad.append("%s at %s yaw %.2f" % [hn, str(npc.home), npc.home_yaw])
	var bob := main.get_node_or_null("NPCs/NPC_vault_keeper") as Npc
	if bob != null and bob.display_name != "Bob":
		home_bad.append("vault keeper is named %s, not Bob" % bob.display_name)
	if home_bad.is_empty():
		_ok("Ines behind the AO desk facing the room · Petra at Counter 2 facing the lobby · Okafor facing his door · Bob at the window")
	else:
		_fail("NPC homes: %s" % "; ".join(home_bad))
	var vault_pieces := int(interior.get_meta("vault_pieces", 0))
	var door_node := main.get_node_or_null("VaultDoor")
	var mouth := PropKit.find_mesh(door_node, "Mouth") if door_node != null else null
	var throat := interior.get_node_or_null("VaultThroatCollider") as StaticBody3D
	if vault_pieces >= 40 and throat != null:
		_ok("strongroom built behind the vault door: %d pieces, solid throat keeps the player out" % vault_pieces)
	else:
		_fail("strongroom missing or thin (%d pieces, throat %s)" % [vault_pieces, "present" if throat != null else "missing"])
	if mouth != null and not mouth.visible and door_node.OPEN_DEG >= 60.0:
		_ok("frame Mouth hidden, door swings %.0f° so the strongroom reads when OPEN" % door_node.OPEN_DEG)
	else:
		_fail("vault door still blind: Mouth %s, swing %s°" % ["visible" if mouth == null or mouth.visible else "hidden", str(door_node.OPEN_DEG) if door_node != null else "?"])
	var wall_n := interior.get_node_or_null("WallN")
	if wall_n == null and interior.get_node_or_null("WallN_a") != null and interior.get_node_or_null("WallN_b") != null:
		_ok("north wall cut behind the door (WallN_a / WallN_b + lintel)")
	else:
		_fail("north wall not cut for the strongroom")

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
