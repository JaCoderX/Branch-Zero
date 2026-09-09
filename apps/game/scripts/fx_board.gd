extends Node3D
## Kenji's quote board — the FX desk's LED panel (docs/UNISWAP.md §4, KICKOFF §F.20).
##
## Same shape as ledger_board.gd and names_board.gd: a small SubViewport drawn into the wall quad
## `bank_interior.gd` left inside the brass frame above the FX counter. It renders only what the chain told us —
## the V4Quoter's price, the minimum out the desk will accept, the pool's fee tier — plus a "quote valid m:ss"
## countdown taken from the quote's own deadline against the **desk** clock (`GameState.now()`), never a local
## timer, for the same reason the vault door counts that way (docs/GODOT.md §5).
##
## When there is no quote the board shows both pools' mid rates and the till instead of inventing a rate, and when the FX desk
## is unreachable it says so. Nothing here is a number the game made up.

const VP_W := 768
const VP_H := 384

var _vp: SubViewport
var _title: Label
var _rows: Label
var _accum := 0.0


func _ready() -> void:
	name = "FxBoard"
	_vp = SubViewport.new()
	_vp.size = Vector2i(VP_W, VP_H)
	_vp.transparent_bg = false
	_vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	_vp.disable_3d = true
	add_child(_vp)

	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.06, 0.08)
	bg.size = Vector2(VP_W, VP_H)
	_vp.add_child(bg)

	_title = Label.new()
	_title.position = Vector2(20, 14)
	_title.size = Vector2(VP_W - 40, 40)
	_title.add_theme_font_size_override("font_size", 25)
	_title.add_theme_color_override("font_color", Color(1.0, 0.45, 0.80))   # Uniswap pink, the one sponsor cue on the panel
	_vp.add_child(_title)

	_rows = Label.new()
	_rows.position = Vector2(20, 62)
	_rows.size = Vector2(VP_W - 40, VP_H - 76)
	_rows.add_theme_font_size_override("font_size", 22)
	_rows.add_theme_color_override("font_color", Color(0.92, 0.94, 0.92))
	_rows.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_vp.add_child(_rows)

	# bank_interior.gd owns the frame and the quad's footprint; this script only supplies its live texture.
	var quad := get_parent().get_node_or_null("BankInterior/FxBoardQuad") as MeshInstance3D
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


## The countdown is the only thing that moves without a state change, so redraw once a second while a quote stands.
func _process(delta: float) -> void:
	_accum += delta
	if _accum < 1.0:
		return
	_accum = 0.0
	if GameState.fx_quoted():
		_redraw()


func _redraw() -> void:
	if _title == null:
		return
	var s: Dictionary = GameState.strings
	var v := GameState.vars()
	_title.text = Dialogue.interpolate(str(s.get("fx_board_title", "FX BOARD · UNISWAP v4 · SEPOLIA")), v)

	var lines: PackedStringArray = []
	if not GameState.fx.has("pairs"):
		lines.append(str(s.get("fx_board_dark", "Board dark — the branch can't reach the exchange floor.")))
	else:
		if GameState.fx_quoted():
			lines.append(Dialogue.interpolate(str(s.get("fx_board_quote", "{fx_amount_in} {fx_symbol_in}  →  {fx_amount_out} {fx_symbol_out}")), v))
			lines.append(Dialogue.interpolate(str(s.get("fx_board_rate", "{fx_rate}")), v))
			lines.append(Dialogue.interpolate(str(s.get("fx_board_min", "minimum {fx_min_out} {fx_symbol_out} · rate room {fx_slippage}")), v))
			lines.append(Dialogue.interpolate(str(s.get("fx_board_valid", "quote valid {fx_valid}")), v))
		else:
			# Both pairs' mid rates, read from each pool's own slot0 by the desk — a reading, not a quote.
			lines.append(Dialogue.interpolate(str(s.get("fx_board_idle", "{fx_rate_eur} · {fx_rate_ils} · exchange fee {fx_pool_fee}")), v))
			lines.append(str(s.get("fx_board_ask", "Ask Kenji for a euro or shekel price.")))
		lines.append("")
		if GameState.has_fx_till():
			lines.append(Dialogue.interpolate(str(s.get("fx_board_till", "till  {fx_usdc} {fx_symbol_in} · {fx_eur} EUR · {fx_ils} ILS")), v))
		else:
			lines.append(str(s.get("fx_board_no_till", "no till on the exchange floor yet")))
		if not GameState.fx_open():
			lines.append(str(s.get("fx_board_closed", "exchange door not on your approved list")))
		else:
			lines.append(Dialogue.interpolate(str(s.get("fx_board_whitelist", "approved services: prepare dollars · authorise exchange · place trade")), v))
		for pair in ["EUR", "ILS"]:
			var pool: Dictionary = GameState.fx_pair(pair).get("pool", {})
			if str(pool.get("tick", "")) != "":
				lines.append(Dialogue.interpolate(str(s.get("fx_board_pool", "{pair} exchange · available depth {liq}")), {"pair": pair, "tick": str(pool.get("tick", "?")), "liq": str(pool.get("liquidity", "?"))}))
	_rows.text = "\n".join(lines)
	_vp.render_target_update_mode = SubViewport.UPDATE_ONCE
