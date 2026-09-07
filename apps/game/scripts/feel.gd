extends Node3D
## Feel (U7 viz Stage 5) — the two Compatibility-safe particle systems and the plaque typography. Nothing here moves
## a footprint, a collider or a light: both systems are CPUParticles3D (no GPU transform feedback, so they run the same
## on WebGL 2), cast no shadow and draw one call each with an unshaded billboard quad in a procedural radial texture —
## no texture asset, no licence. They live outside BankInterior so `bake_static` never sees them.
##
##   SkylightDust — slow motes in the sun shaft under the lobby skylight (WORLD-3D §9 Day 8 "dust in skylight").
##                  Always on; it is the one system on screen along the default lobby path.
##   StampInk     — a one-shot ink puff off the teller's stamp on the desk's `signing` stage (mirrors audio.gd's
##                  stamp thud; GAME-DESIGN §8 "ink splash particle"). Fires at Counter 1's stamp, or at the
##                  manager's stamp when the player is in his office.
## Budget: 2 systems, +2 materials (34 → 36 ≤ 40), +1 draw each while visible.

const DUST_CENTRE := Vector3(0.0, 2.9, 0.5)          # under SKYLIGHT (x −6…6, z −4…5), between the frieze and the floor
const DUST_EXTENTS := Vector3(5.4, 1.5, 4.0)
const DUST_AMOUNT := 96
const STAMP_COUNTER := Vector3(-11.15, 1.18, 2.0)    # Counter 1 stamp: bank_interior._counter("Counter1", 3.0) → z − 1.0
const STAMP_MANAGER := Vector3(-7.0, 0.92, -8.6)     # MgrStamp

var dust: CPUParticles3D
var ink: CPUParticles3D
var plaques_dressed := 0


func _ready() -> void:
	name = "Feel"
	dust = _dust()
	add_child(dust)
	ink = _ink()
	add_child(ink)
	GameState.stage.connect(_on_stage)
	# BankInterior is built by Main._ready, after this node's — dress the plaques once the frame settles.
	_dress.call_deferred()


func _dress() -> void:
	var main := get_parent()
	if main == null:
		return
	var interior := main.get_node_or_null("BankInterior")
	if interior != null:
		plaques_dressed = BankFonts.dress_plaques(interior)
	set_meta("plaques_dressed", plaques_dressed)


func _on_stage(ev: Dictionary) -> void:
	if str(ev.get("stage", "")) != "signing":
		return
	ink.global_position = STAMP_MANAGER if GameState.current_zone == "Manager's office" else STAMP_COUNTER
	ink.restart()


## A soft radial dot, drawn once — the only "texture" either system uses.
static func _dot(size: int, hard: float) -> GradientTexture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, hard, 1.0])
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.55), Color(1, 1, 1, 0)])
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(0.5, 0.0)
	t.width = size
	t.height = size
	return t


static func _billboard(tex: Texture2D, additive: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if additive else BaseMaterial3D.BLEND_MODE_MIX
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.billboard_keep_scale = true
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = tex
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.no_depth_test = false
	m.disable_receive_shadows = true
	m.resource_name = "ParticleAdd" if additive else "ParticleMix"
	return m


static func _quad(size: float) -> QuadMesh:
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	return q


func _dust() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.name = "SkylightDust"
	p.position = DUST_CENTRE
	p.amount = DUST_AMOUNT
	p.lifetime = 11.0
	p.preprocess = 11.0          # full on the first frame, no fade-in when the scene opens
	p.randomness = 0.7
	p.fixed_fps = 20             # motes are slow; 20 Hz simulation is invisible and cheaper on the single web thread
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = DUST_EXTENTS
	p.direction = Vector3(0.35, -1.0, 0.15)
	p.spread = 180.0
	p.initial_velocity_min = 0.02
	p.initial_velocity_max = 0.10
	p.gravity = Vector3(0.0, -0.025, 0.0)
	p.damping_min = 0.0
	p.damping_max = 0.03
	p.scale_amount_min = 0.55
	p.scale_amount_max = 1.0
	var fade := Gradient.new()
	fade.offsets = PackedFloat32Array([0.0, 0.2, 0.8, 1.0])
	fade.colors = PackedColorArray([Color(1, 0.96, 0.85, 0.0), Color(1, 0.96, 0.85, 0.24), Color(1, 0.96, 0.85, 0.24), Color(1, 0.96, 0.85, 0.0)])
	p.color_ramp = fade
	p.mesh = _quad(0.06)
	p.material_override = _billboard(_dot(32, 0.25), true)
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.visibility_aabb = AABB(-DUST_EXTENTS - Vector3(0.5, 0.5, 0.5), DUST_EXTENTS * 2.0 + Vector3(1, 1, 1))
	return p


func _ink() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.name = "StampInk"
	p.position = STAMP_COUNTER
	p.emitting = false
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = 26
	p.lifetime = 0.75
	p.randomness = 0.4
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 0.05
	p.direction = Vector3(0.0, 1.0, 0.0)
	p.spread = 55.0
	p.initial_velocity_min = 0.7
	p.initial_velocity_max = 1.5
	p.gravity = Vector3(0.0, -3.5, 0.0)
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.0
	var shrink := Curve.new()
	shrink.add_point(Vector2(0.0, 1.0))
	shrink.add_point(Vector2(1.0, 0.15))
	p.scale_amount_curve = shrink
	var fade := Gradient.new()
	fade.offsets = PackedFloat32Array([0.0, 0.6, 1.0])
	fade.colors = PackedColorArray([Color(0.10, 0.12, 0.30, 0.95), Color(0.10, 0.12, 0.30, 0.8), Color(0.10, 0.12, 0.30, 0.0)])
	p.color_ramp = fade
	p.mesh = _quad(0.09)
	p.material_override = _billboard(_dot(32, 0.55), false)
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return p
