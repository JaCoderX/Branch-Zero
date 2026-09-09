shader_type spatial;
render_mode cull_disabled, blend_mix;

uniform sampler2D atlas_tex : source_color;

void fragment() {
	// The green vertex channel is a per-quad flag: brick underlay = 1, paste-up = 0.
	// Keeping both faces on one shader preserves the exterior material budget.
	if (COLOR.g > 0.5) {
		vec2 p = UV * vec2(1.0, 8.0);
		float row = floor(p.y);
		float shifted_x = p.x + mod(row, 2.0) * 0.5;
		vec2 cell = fract(vec2(shifted_x, p.y));
		float mortar = max(max(step(cell.x, 0.045), step(0.955, cell.x)),
			max(step(cell.y, 0.10), step(0.90, cell.y)));
		float tint = step(0.78, fract(sin(dot(vec2(floor(shifted_x), row), vec2(12.9898, 78.233))) * 43758.5453));
		vec3 brick = mix(vec3(0.74, 0.68, 0.57), vec3(0.78, 0.61, 0.50), tint * 0.16);
		ALBEDO = mix(brick, vec3(0.31, 0.30, 0.28), clamp(mortar, 0.0, 1.0));
		ROUGHNESS = 1.0;
		METALLIC = 0.0;
		ALPHA = 1.0;
	} else {
		vec4 paper = texture(atlas_tex, UV);
		ALBEDO = paper.rgb;
		ROUGHNESS = 1.0;
		METALLIC = 0.0;
		ALPHA = paper.a * COLOR.a;
	}
}
