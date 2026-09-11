class_name InpcProp
extends BankTerminal
## iNPC — the optional service assistant (docs/INPC.md, docs/missions/HANDOFF-inpc-openrouter.md).
##
## Not a staff NPC (docs/NPCS.md): it embodies no on-chain role, reads no chain and has no dialogue action that could
## pay, wire, release, approve, recall or provision. It is a *prop* the player can wake: Space opens `dialogue/inpc.json`,
## whose only verbs are `open_inpc` (the shell's Wake / chat overlay) and `sleep_inpc` (forget the key). The overlay,
## the OpenRouter call and the player's session-only key all live in apps/web; Godot hands over a player-safe snapshot
## (`GameState.inpc_snapshot()`) and mirrors two bits back — awake or dormant, following or not — for the eye, the
## prompt and the legs.
##
## It extends BankTerminal for the interact zone and `can_talk()` shape only, so main.gd ranks it with the terminals
## for the [Space] prompt without a third pick rule. The body is the lab-proven CC0 **Gum Bot bank** glb (GameLab
## ENG-2026-0021: Graphite shell, Steel plates, Brass CRT bezel — one UV set, two surfaces) and no new lights (the lobby is
## at its eight-omni budget); the screen swaps its emission sheet dormant (dark) ↔ awake (eyes) — no new material either.
## The imported bank walk glb keeps the same footprint and adds skinned `GumBot_Idle` / `GumBot_Walk` clips; the
## mover below remains the only world-motion authority.
##
## Companion follow (HANDOFF-inpc-companion-follow): while awake the phone's Follow / Unfollow flips
## `GameState.inpc_following`; this prop then trails the player with the escort-lite seek the teller uses (npc.gd
## `_escort`: seek, slide, ignore the player, give up when stuck) — no NavigationRegion; the skinned walk clip poses
## the legs while the mover still slides. The root stays a Node3D so main.gd's terminal ranking is untouched; a CharacterBody3D
## child does the sliding and the root absorbs its displacement every tick, so the zone and mesh travel along.
## Follow is spatial chrome only: it never locks the floor (`inpc_open` / `overlay_open()` untouched) and adds no verb.
## Unfollow = stay put. Sleep = snap back to the lobby home spot, dormant.
##
## No world nameplate — the silhouette is just the Gum Bot; Space prompt / dialogue name it Blox-47. OpenRouter is named
## only in dialogue / the Wake panel (docs/INPC.md Visual).

enum Follow { HOME, FOLLOWING, STAYING }

const GUM_BOT := preload("res://assets/models/inpc/gum_bot_bank.glb")
const SCREEN_AWAKE := preload("res://assets/models/inpc/screen_awake.png")
## Body as imported (lab findings): 1.14 wide × 1.40 tall × 1.18 deep, feet at y = 0, screen on the glb's +z between
## y 0.52 and 1.14. The glb is yawed π below so the screen looks out of local −z like every other lobby face
## (main.gd yaws the node so −z faces the room).
const BODY_W := 1.14
const BODY_H := 1.40
const BODY_D := 1.18
## Mover footprint: a cylinder the size of the biped's shell (the box it replaces was 1.14 × 1.18) — round so it slides
## off desk corners instead of hooking on them.
const BODY_R := 0.58

## Escort-lite seek numbers. Speed sits under the teller escort (3.2) and the player's walk (4.0) so the player is
## never overtaken. Rest ~1.8 m off the player; walk again once they pull past 2.8 m (hysteresis, so the bot does not
## twitch at the boundary). If it makes no ground for STUCK_SEC it pauses instead of grinding into a desk; if the
## player is far away when the pause ends it soft-repositions to the rest point rather than thrashing.
const FOLLOW_SPEED := 2.8
const FOLLOW_DIST := 1.8
const FOLLOW_STOP := 2.0
const FOLLOW_RESUME := 2.8
const STUCK_SPEED := 0.3
const STUCK_SEC := 1.5
const STUCK_PAUSE_SEC := 2.0
const FAR_DIST := 7.0
const TURN := 8.0
const ANIM_GROUND_EPSILON := 0.05

var _screen_mat: StandardMaterial3D
var _screen_dormant_tex: Texture2D
var _mover: CharacterBody3D
var _anim: AnimationPlayer
var _player: PhysicsBody3D
var _follow: Follow = Follow.HOME
var _walking := false
var _ground_speed := 0.0
var _stuck_t := 0.0
var _pause_t := 0.0
var _home: Vector3
var _home_yaw: float
## Pairs [a, b] where `a.add_collision_exception_with(b)` is live; cleared when the walk ends.
var _ignored: Array = []


func _ready() -> void:
	terminal_id = "inpc"
	display_name = "Blox-47"
	super()
	name = "Inpc"
	remove_from_group("terminal")   # a bank computer it is not; the group keeps meaning "Console screen"
	add_to_group("inpc")
	_home = position
	_home_yaw = rotation.y
	_dress()
	GameState.changed.connect(_refresh_look)
	_refresh_look()


## Dormant or awake, Space is never offered while a dialogue, a desk action or either shell overlay owns the screen.
func can_talk() -> bool:
	return not Dialogue.active and not GameState.busy and not GameState.overlay_open()


func interact() -> void:
	if can_talk():
		Dialogue.start("inpc")


func prompt_text() -> String:
	var s: Dictionary = GameState.strings
	if GameState.inpc_awake:
		return str(s.get("prompt_inpc_awake", "[Space] Talk to Blox-47"))
	return str(s.get("prompt_inpc_dormant", "[Space] Wake Blox-47"))


## Where the legs are: HOME (lobby spot), FOLLOWING (trailing the player) or STAYING (Unfollow — parked wherever it was).
func follow_state() -> Follow:
	return _follow


func is_following() -> bool:
	return _follow == Follow.FOLLOWING


# ---------------------------------------------------------------- look

## The Gum Bot bank body only — no enamel nameplate. The blocking body is a CharacterBody3D on layer 1 (mask 1
## so it slides along desks and walls) sized to the biped like every other blocking prop (bank_interior.gd rules); it
## is the only thing under this node that moves in its own frame — `_absorb_motion` folds it back into the root.
func _dress() -> void:
	var bot: Node3D = GUM_BOT.instantiate()
	bot.name = "GumBot"
	bot.rotation.y = PI   # glb screen faces +z; the lobby face of this prop is −z
	add_child(bot)
	_anim = bot.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if _anim == null:
		for c in bot.find_children("*", "AnimationPlayer", true, false):
			_anim = c as AnimationPlayer
			break
	if _anim == null:
		push_warning("InpcProp: gum_bot_bank.glb has no AnimationPlayer — skinned leg clips unavailable")
	else:
		for clip_name in ["GumBot_Idle", "GumBot_Walk", "idle", "walk"]:
			if _anim.has_animation(clip_name):
				var clip := _anim.get_animation(clip_name)
				if clip != null:
					clip.loop_mode = Animation.LOOP_LINEAR
	var mesh := bot.find_child("GumBotBank", true, false) as MeshInstance3D
	if mesh == null:
		for c in bot.find_children("*", "MeshInstance3D", true, false):
			mesh = c
			break
	if mesh != null and mesh.mesh != null and mesh.mesh.get_surface_count() > 1:
		# surface 0 = GumBotBody (imported albedo stays), surface 1 = GumBotScreen. Godot's emission is additive
		# (EMISSION = emission + emission_texture): keep `emission` black and let the sheet carry the colour — Bulb is
		# baked into screen_awake.png. A black albedo keeps the asleep screen dark under the lobby sun (lab follow-up).
		var imported := mesh.mesh.surface_get_material(1) as StandardMaterial3D
		_screen_mat = imported.duplicate() as StandardMaterial3D
		_screen_dormant_tex = _screen_mat.emission_texture
		_screen_mat.emission_enabled = true
		_screen_mat.emission = Color(0, 0, 0)
		_screen_mat.albedo_color = Color(0, 0, 0)
		mesh.set_surface_override_material(1, _screen_mat)
	else:
		push_warning("InpcProp: gum_bot_bank.glb has no two-surface mesh — screen swap disabled")
	_mover = CharacterBody3D.new()
	_mover.name = "InpcBody"
	_mover.collision_layer = 1
	_mover.collision_mask = 1
	_mover.floor_stop_on_slope = true
	var shape := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = BODY_R
	cyl.height = BODY_H
	shape.shape = cyl
	shape.position.y = BODY_H / 2.0
	_mover.add_child(shape)
	add_child(_mover)
	_sync_animation()


func _desired_animation() -> String:
	if _anim == null:
		return ""
	# `_walking` is the seek hysteresis state, so it can stay true while the mover is settling or paused.
	# Animation follows measured ground motion instead: a parked companion must not keep the walk clip running.
	var walking := _follow == Follow.FOLLOWING and _walking and _ground_speed > ANIM_GROUND_EPSILON
	var names := ["GumBot_Walk", "walk"] if walking else ["GumBot_Idle", "idle"]
	for clip_name in names:
		if _anim.has_animation(clip_name):
			return clip_name
	return ""


func _sync_animation() -> void:
	if _anim == null:
		return
	var desired := _desired_animation()
	if desired == "":
		return
	var walking := desired == "GumBot_Walk" or desired == "walk"
	_anim.speed_scale = clampf(_ground_speed / PropKit.walk_mps(), 0.5, 2.0) if walking else 1.0
	if _anim.current_animation == desired:
		return
	_anim.play(desired, 0.12)


## The screen follows the one bit the shell mirrors back: a key in this tab's session or not.
## Only the emission sheet and its energy change; `emission` stays black (additive) so the awake eyes never flood white.
## The legs follow the second bit (`inpc_following`), gated on the first: dormant never follows, Sleep sends it home.
func _refresh_look() -> void:
	var awake := GameState.inpc_awake
	if _screen_mat != null:
		_screen_mat.emission_texture = SCREEN_AWAKE if awake else _screen_dormant_tex
		_screen_mat.emission = Color(0, 0, 0)
		_screen_mat.emission_energy_multiplier = 2.0 if awake else 1.0
	_sync_follow()


# ---------------------------------------------------------------- legs (escort-lite seek, no navmesh)

func _sync_follow() -> void:
	if not GameState.inpc_awake:
		if _follow != Follow.HOME:
			_go_home()
		return
	var want: bool = GameState.inpc_following
	if want and _follow != Follow.FOLLOWING:
		_begin_follow()
	elif not want and _follow == Follow.FOLLOWING:
		_stay()


func _player_body() -> PhysicsBody3D:
	if _player != null and is_instance_valid(_player):
		return _player
	var p := get_tree().get_first_node_in_group("player")
	_player = p as PhysicsBody3D
	return _player


func _begin_follow() -> void:
	_follow = Follow.FOLLOWING
	_walking = true
	_ground_speed = 0.0
	_stuck_t = 0.0
	_pause_t = 0.0
	_clear_ignored()
	var p := _player_body()
	if p != null:
		# Both ways: the bot must not shove the player and the player must not be pinned by a body that is trying to
		# stand where they are (the teller escort only ignores one way and shoves props — HANDOFF lock).
		_ignore(_mover, p)
		_ignore(p, _mover)
		# A companion two metres behind the player sits right where the spring arm looks for walls; without this the
		# camera would pop forward every time the bot trails into the boom (player.gd: arm collides with layer 1).
		var arm := p.get_node_or_null("CamPivot/Arm") as SpringArm3D
		if arm != null:
			arm.add_excluded_object(_mover.get_rid())
	for n in get_tree().get_nodes_in_group("npc"):
		if n is PhysicsBody3D:
			_ignore(_mover, n as PhysicsBody3D)
	_sync_animation()


## Unfollow: freeze where it stands. It is a solid prop again (exceptions off) so the player can lean on it for Space.
func _stay() -> void:
	_follow = Follow.STAYING
	_walking = false
	_ground_speed = 0.0
	_clear_ignored()
	if _mover != null:
		_mover.velocity = Vector3.ZERO
	_sync_animation()


## Sleep (or the key vanishing): snap to the lobby home spot with the home yaw. A snap, not a walk — the eye is out.
func _go_home() -> void:
	_follow = Follow.HOME
	_walking = false
	_ground_speed = 0.0
	_clear_ignored()
	if _mover != null:
		_mover.velocity = Vector3.ZERO
		_mover.position = Vector3.ZERO
	position = _home
	rotation = Vector3(0.0, _home_yaw, 0.0)
	_sync_animation()


func _ignore(a: PhysicsBody3D, b: PhysicsBody3D) -> void:
	a.add_collision_exception_with(b)
	_ignored.append([a, b])


func _clear_ignored() -> void:
	for pair in _ignored:
		var a: PhysicsBody3D = pair[0]
		var b: PhysicsBody3D = pair[1]
		if is_instance_valid(a) and is_instance_valid(b):
			a.remove_collision_exception_with(b)
	_ignored.clear()


func _physics_process(delta: float) -> void:
	if _mover == null:
		return
	rotation.x = 0.0
	rotation.z = 0.0
	match _follow:
		Follow.FOLLOWING:
			_seek(delta)
		Follow.STAYING:
			_settle()
			_face_player(delta)
		_:
			_settle()
	_absorb_motion()
	_sync_animation()


## Stand still on the floor (gravity only), like the staff capsules.
func _settle() -> void:
	_mover.velocity.x = 0.0
	_mover.velocity.z = 0.0
	_mover.velocity.y = 0.0 if _mover.is_on_floor() else -9.8
	_mover.move_and_slide()


func _face_player(delta: float) -> void:
	var p := _player_body()
	if p == null:
		return
	var d := p.global_position - global_position
	d.y = 0.0
	if d.length() > 0.05:
		rotation.y = lerp_angle(rotation.y, atan2(-d.x, -d.z), TURN * delta)


func _seek(delta: float) -> void:
	var p := _player_body()
	if p == null:
		_ground_speed = 0.0
		_stay()
		return
	var to_player := p.global_position - global_position
	to_player.y = 0.0
	var dist := to_player.length()
	if _pause_t > 0.0:
		# Stuck a moment ago: wait it out; if the player has gone far, soft-reposition to the rest point instead of
		# grinding into whatever stopped us.
		_pause_t -= delta
		_settle()
		_ground_speed = 0.0
		if _pause_t <= 0.0 and dist > FAR_DIST:
			_reposition_near(p)
		return
	if dist > FOLLOW_RESUME:
		_walking = true
	elif dist <= FOLLOW_STOP:
		_walking = false
	if not _walking:
		_settle()
		_ground_speed = 0.0
		_face_player(delta)
		return
	# Rest point: FOLLOW_DIST short of the player, on our side of them.
	var target := p.global_position - to_player.normalized() * FOLLOW_DIST
	var d := target - global_position
	d.y = 0.0
	if d.length() < 0.05:
		_settle()
		_ground_speed = 0.0
		return
	var dir := d.normalized()
	_mover.velocity.x = dir.x * FOLLOW_SPEED
	_mover.velocity.z = dir.z * FOLLOW_SPEED
	_mover.velocity.y = 0.0 if _mover.is_on_floor() else -9.8
	_mover.move_and_slide()
	rotation.y = lerp_angle(rotation.y, atan2(-dir.x, -dir.z), TURN * delta)
	var real := _mover.get_real_velocity()
	var ground := Vector2(real.x, real.z).length()
	_ground_speed = ground
	_stuck_t = _stuck_t + delta if ground < STUCK_SPEED else 0.0
	if _stuck_t > STUCK_SEC:
		_stuck_t = 0.0
		_pause_t = STUCK_PAUSE_SEC


## Soft reposition: the rest point on the line from the player back toward us (the floor they just walked), feet on
## the home plane. Never inside the player — exceptions are on, but 1.8 m clears both bodies anyway.
func _reposition_near(p: PhysicsBody3D) -> void:
	var away := global_position - p.global_position
	away.y = 0.0
	if away.length() < 0.05:
		away = Vector3(0.0, 0.0, 1.0)
	var spot := p.global_position + away.normalized() * FOLLOW_DIST
	spot.y = _home.y
	_mover.velocity = Vector3.ZERO
	_mover.position = Vector3.ZERO
	global_position = spot
	_stuck_t = 0.0
	_walking = true


## The mover slid in world space; fold that displacement into the root so the interact zone and mesh follow,
## and put the mover back at the root's origin for the next tick.
func _absorb_motion() -> void:
	if _mover.position.length_squared() > 0.0:
		global_position = _mover.global_position
		_mover.position = Vector3.ZERO
