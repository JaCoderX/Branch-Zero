extends Node3D
## Petra's names board. Like ledger_board.gd, it is a small SubViewport on the existing Name Desk wall quad.
## Rows come from the customers UserRegistry registration log via the bridge's ensAvailable read.

const VP_W := 768
const VP_H := 400
const ROWS := 7

var _vp: SubViewport
var _title: Label
var _rows: Label


func _ready() -> void:
	name = "NamesBoard"
	_vp = SubViewport.new()
	_vp.size = Vector2i(VP_W, VP_H)
	_vp.transparent_bg = false
	_vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	_vp.disable_3d = true
	add_child(_vp)
	var bg := ColorRect.new()
	bg.color = Color(0.06, 0.07, 0.09)
	bg.size = Vector2(VP_W, VP_H)
	_vp.add_child(bg)
	_title = Label.new()
	_title.position = Vector2(20, 14)
	_title.size = Vector2(VP_W - 40, 42)
	_title.add_theme_font_size_override("font_size", 25)
	_title.add_theme_color_override("font_color", Color(0.40, 0.85, 0.70))
	_vp.add_child(_title)
	_rows = Label.new()
	_rows.position = Vector2(20, 62)
	_rows.size = Vector2(VP_W - 40, VP_H - 74)
	_rows.add_theme_font_size_override("font_size", 21)
	_rows.add_theme_color_override("font_color", Color(0.92, 0.92, 0.92))
	_rows.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_vp.add_child(_rows)

	# bank_interior.gd owns the frame and quad footprint; this script only supplies its live texture.
	var quad := get_parent().get_node_or_null("BankInterior/NamesBoardQuad") as MeshInstance3D
	if quad != null:
		var material := StandardMaterial3D.new()
		material.albedo_texture = _vp.get_texture()
		material.emission_enabled = true
		material.emission_texture = _vp.get_texture()
		material.emission_energy_multiplier = 0.9
		material.roughness = 1.0
		quad.material_override = material
	GameState.changed.connect(_redraw)
	_redraw()


func _redraw() -> void:
	if _title == null:
		return
	_title.text = "NAMES BOARD · ENSv2 SEPOLIA"
	var lines: PackedStringArray = []
	if GameState.ens_names.is_empty():
		lines.append("No customer names claimed yet.")
		lines.append("Petra can put yours on the board.")
	else:
		var shown := 0
		for row in GameState.ens_names:
			if shown >= ROWS:
				lines.append("…")
				break
			var name := str(row.get("name", "?"))
			var address := GameState.short_address(str(row.get("address", "?")))
			lines.append("%-32s  %s" % [name, address])
			shown += 1
	_rows.text = "\n".join(lines)
	_vp.render_target_update_mode = SubViewport.UPDATE_ONCE
