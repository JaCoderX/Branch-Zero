extends Node3D
## Lighting — the WORLD-3D §7 Main-wing recipe, driven by themes/wing_main.tres (WingTheme):
## one shadowed DirectionalLight3D as the warm key through the lobby skylight, one shadowless cool fill from the
## clerestory windows, and the Environment (ACES tonemap, exposure, ambient, a little fog for depth, low glow so the
## vault LED and pendant bulbs bloom). No SDFGI / VoxelGI / SSR / volumetric fog — Compatibility renderer, web.
## Pendant OmniLight3Ds live with their fixtures in scripts/bank_interior.gd.

@onready var sun: DirectionalLight3D = $Sun
@onready var fill: DirectionalLight3D = $Fill


func _ready() -> void:
	var t := PropKit.ensure_theme()
	_aim(sun, t.key_azimuth_deg, t.key_elevation_deg)
	sun.light_color = t.key_color
	sun.light_energy = t.key_energy
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 60.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS   # each split redraws every caster
	sun.directional_shadow_blend_splits = true
	sun.shadow_bias = 0.03
	sun.shadow_normal_bias = 1.5

	_aim(fill, 180.0, 28.0)
	fill.light_color = t.fill_color
	fill.light_energy = t.fill_energy
	fill.shadow_enabled = false

	var we := get_parent().get_node_or_null("WorldEnvironment") as WorldEnvironment
	if we == null:
		return
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = t.background_color
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = t.ambient_color
	env.ambient_light_energy = t.ambient_energy
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = t.exposure
	env.fog_enabled = t.fog_enabled
	env.fog_light_color = t.fog_color
	env.fog_density = t.fog_density
	env.fog_sky_affect = 0.0
	env.glow_enabled = t.glow_enabled
	env.glow_intensity = t.glow_intensity
	env.glow_bloom = 0.0
	env.glow_hdr_threshold = 1.3
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
	we.environment = env


## Point a directional light so it shines from compass azimuth `az` (degrees clockwise from north) at `el` above the horizon.
func _aim(light: DirectionalLight3D, az: float, el: float) -> void:
	var a := deg_to_rad(az)
	var e := deg_to_rad(el)
	var from := Vector3(sin(a) * cos(e), sin(e), -cos(a) * cos(e)) * 20.0
	light.position = from + Vector3(0, 8, 0)
	light.look_at(Vector3(0, 8, 0), Vector3.UP)
