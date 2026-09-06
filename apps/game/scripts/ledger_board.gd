extends Node3D
## Ledger board — "Today's movements" (docs/GAME-DESIGN.md §7, WORLD-3D §8). A SubViewport draws the rows;
## its texture goes on a quad on the lobby wall. Left: pending wires with the chain's releaseTime counting
## against the desk clock. Right: the last receipts the Teller Desk recorded. Redrawn once a second and on
## every state change; reconciled with `listPending` on tab focus by GameState.

const VP_W := 1024
const VP_H := 256
const ROWS := 6

var _vp: SubViewport
var _left: Label
var _right: Label
var _title: Label
var _accum := 0.0


func _ready() -> void:
	name = "LedgerBoard"
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
	_title.position = Vector2(16, 6)
	_title.size = Vector2(VP_W - 32, 28)
	_title.add_theme_font_size_override("font_size", 20)
	_title.add_theme_color_override("font_color", Color(0.95, 0.80, 0.45))
	_vp.add_child(_title)

	_left = Label.new()
	_left.position = Vector2(16, 40)
	_left.size = Vector2(VP_W / 2 - 24, VP_H - 48)
	_left.add_theme_font_size_override("font_size", 19)
	_left.add_theme_color_override("font_color", Color(0.92, 0.92, 0.92))
	_vp.add_child(_left)

	_right = Label.new()
	_right.position = Vector2(VP_W / 2 + 8, 40)
	_right.size = Vector2(VP_W / 2 - 24, VP_H - 48)
	_right.add_theme_font_size_override("font_size", 19)
	_right.add_theme_color_override("font_color", Color(0.75, 0.85, 0.95))
	_vp.add_child(_right)

	var quad := MeshInstance3D.new()
	var mesh := QuadMesh.new()
	mesh.size = Vector2(8.0, 2.0)
	quad.mesh = mesh
	var m := StandardMaterial3D.new()
	m.albedo_texture = _vp.get_texture()
	m.emission_enabled = true
	m.emission_texture = _vp.get_texture()
	m.emission_energy_multiplier = 0.9
	m.roughness = 1.0
	quad.material_override = m
	add_child(quad)

	GameState.changed.connect(_redraw)
	_redraw()


func _process(delta: float) -> void:
	_accum += delta
	if _accum >= 1.0:
		_accum = 0.0
		_redraw()


func _redraw() -> void:
	var s: Dictionary = GameState.strings
	var v := GameState.vars()
	_title.text = Dialogue.interpolate(str(s.get("board_title", "TODAY'S MOVEMENTS · {chain}")), v)

	var left: PackedStringArray = []
	left.append(str(s.get("board_pending_head", "IN THE VAULT")))
	if not GameState.has_account():
		left.append(str(s.get("board_no_account", "no account at this branch yet")))
	elif GameState.wires.is_empty():
		left.append(str(s.get("board_no_pending", "nothing cooling")))
	else:
		var shown := 0
		for w in GameState.wires:
			if shown >= ROWS - 1:
				left.append("…")
				break
			var rem: int = GameState.remaining(w)
			var status := str(s.get("board_ready", "READY")) if rem <= 0 else GameState.fmt_duration(rem)
			left.append("#%-4s WIRE  %8s → %-11s  %s" % [str(w.get("txId", "?")), GameState.fmt_amount(w.get("amount", "?")), GameState.short_address(str(w.get("to", "?"))), status])
			shown += 1
	_left.text = "\n".join(left)

	var right: PackedStringArray = []
	right.append(str(s.get("board_receipts_head", "RECENT RECEIPTS")))
	if GameState.receipts.is_empty():
		right.append(str(s.get("board_no_receipts", "—")))
	else:
		var recent: Array = GameState.receipts.slice(max(0, GameState.receipts.size() - (ROWS - 1)))
		recent.reverse()
		for r in recent:
			var lane := str(r.get("lane", "?"))
			var kind: String = str({"A": "PAY", "B": "WIRE", "PROVISION": "OPEN", "CONFIG": "DESK"}.get(lane, lane))
			var h := str(r.get("hash", ""))
			right.append("%-5s %-12s %s%s" % [kind, str(r.get("stage", "")).to_upper(), ("#" + str(r["txId"]) + " ") if r.has("txId") and r["txId"] != null else "", h.substr(0, 10) if h != "" else ""])
	_right.text = "\n".join(right)
	_vp.render_target_update_mode = SubViewport.UPDATE_ONCE
