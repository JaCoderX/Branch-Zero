class_name WingTheme
extends Resource
## One wing's palette and lighting recipe (docs/WORLD-3D-ENVIRONMENT.md §1 palette, §3 theme resource, §7 lighting).
## `themes/wing_main.tres` is the Main wing (Sepolia / Remote EVM): warm marble cream, brass, deep green.
## `themes/wing_arc.tres` is a U6 palette stub only — nothing loads it yet. The layout scene never changes per
## wing; scripts/bank_interior.gd reads colours from here and scripts/props.gd maps hero-prop material names
## (Marble, Brass, …) onto the same palette so a wing swap is one resource.

@export var wing_name: String = "main"

@export_group("Surfaces")
@export var floor_color := Color(0.86, 0.80, 0.70)      # terrazzo base
@export var floor_chip_color := Color(0.62, 0.55, 0.46) # terrazzo chips (procedural noise, no texture file)
@export var wall_color := Color(0.93, 0.90, 0.84)       # marble
@export var wainscot_color := Color(0.16, 0.36, 0.28)   # deep green band along the walls
@export var trim_color := Color(0.78, 0.62, 0.30)       # brass
@export var wood_color := Color(0.45, 0.30, 0.18)
@export var graphite_color := Color(0.26, 0.28, 0.32)
@export var steel_color := Color(0.55, 0.57, 0.62)
@export var glass_color := Color(0.70, 0.85, 0.95, 0.28)
@export var plant_color := Color(0.20, 0.55, 0.25)
@export var cream_color := Color(0.86, 0.80, 0.70)
@export var paper_color := Color(0.97, 0.96, 0.92)
@export var rope_color := Color(0.55, 0.12, 0.14)
@export var ceiling_color := Color(0.97, 0.95, 0.90)

@export_group("Emissive")
@export var plaque_emission := Color(0.78, 0.62, 0.30)  # brass plaques glow faintly (§7 "brass emissive on plaques")
@export var plaque_emission_energy: float = 0.35
@export var bulb_color := Color(1.0, 0.92, 0.72)
@export var accent_strip_color := Color(0.0, 0.0, 0.0, 0.0)  # Arc: USDC-blue strips along counters; Main: none

@export_group("Lighting")
@export var key_color := Color(1.0, 0.87, 0.74)     # ~4800 K warm key through the skylight
@export var key_energy: float = 0.95
@export var key_elevation_deg: float = 35.0         # WORLD-3D §7 "sun angle 35° from skylight"
@export var key_azimuth_deg: float = 30.0
@export var fill_color := Color(0.80, 0.88, 1.0)    # cool fill from the clerestory windows
@export var fill_energy: float = 0.22
@export var ambient_color := Color(0.96, 0.92, 0.85)
@export var ambient_energy: float = 0.42
@export var lamp_color := Color(1.0, 0.90, 0.72)    # pendant omni lights (shadows off)
@export var lamp_energy: float = 1.1
@export var lamp_range: float = 7.5
@export var fog_enabled: bool = true
@export var fog_color := Color(0.85, 0.82, 0.76)
@export var fog_density: float = 0.004
@export var background_color := Color(0.72, 0.78, 0.86)
@export var exposure: float = 1.1
@export var glow_enabled: bool = true
@export var glow_intensity: float = 0.22
