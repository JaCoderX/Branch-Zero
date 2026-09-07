extends CanvasLayer
## HUD — passbook (top-left), zone chip (top-centre), interaction prompt (bottom-centre), stage line and
## error toasts (top-right). Every string comes from dialogue/strings.json or the bridge (docs/GODOT.md §6).

var _passbook: Label
var _zone: Label
var _prompt: Label
var _stage: Label
var _toast: Label
var _help: Label
var _toast_until := 0.0
var _stage_until := 0.0


func _ready() -> void:
	layer = 5
	# anchor (0..1 of the viewport) + pixel offsets; `position` after an anchor preset lands off-screen.
	_passbook = _label(Vector2(0, 0), Vector4(16, 12, 540, 150), 18, Color(0.95, 0.95, 0.95))
	_passbook.add_theme_stylebox_override("normal", _panel_style())
	_zone = _label(Vector2(0.5, 0), Vector4(-200, 12, 200, 48), 20, Color(0.95, 0.80, 0.45))
	_zone.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_zone.add_theme_stylebox_override("normal", _panel_style())
	_stage = _label(Vector2(1, 0), Vector4(-560, 12, -16, 80), 17, Color(0.85, 0.72, 1.0))
	_stage.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_toast = _label(Vector2(1, 0), Vector4(-560, 88, -16, 156), 17, Color(1.0, 0.55, 0.5))
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_prompt = _label(Vector2(0.5, 1), Vector4(-260, -150, 260, -106), 22, Color(1, 1, 1))
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.add_theme_stylebox_override("normal", _panel_style())
	_help = _label(Vector2(0, 1), Vector4(16, -44, 900, -12), 15, Color(0.7, 0.75, 0.8))
	_help.text = str(GameState.strings.get("help", ""))

	GameState.changed.connect(_refresh)
	GameState.stage.connect(_on_stage)
	GameState.toast.connect(show_toast)
	GameState.zone_changed.connect(func(z: String) -> void:
		_zone.text = z
		_zone.visible = z != "")
	_refresh()


func _label(anchor: Vector2, offsets: Vector4, font: int, color: Color) -> Label:
	var l := Label.new()
	l.anchor_left = anchor.x
	l.anchor_right = anchor.x
	l.anchor_top = anchor.y
	l.anchor_bottom = anchor.y
	l.offset_left = offsets.x
	l.offset_top = offsets.y
	l.offset_right = offsets.z
	l.offset_bottom = offsets.w
	l.add_theme_font_size_override("font_size", font)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(l)
	return l


func _panel_style() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.05, 0.08, 0.72)
	sb.corner_radius_top_left = 6
	sb.corner_radius_top_right = 6
	sb.corner_radius_bottom_left = 6
	sb.corner_radius_bottom_right = 6
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	return sb


func _refresh() -> void:
	var s: Dictionary = GameState.strings
	var v := GameState.vars()
	var lines: PackedStringArray = []
	if not GameState.booted:
		lines.append(str(s.get("passbook_booting", "Opening the branch…")))
	elif not GameState.logged_in():
		lines.append(str(s.get("passbook_anon", "No account yet — see Ines at Account Opening.")))
	else:
		lines.append(Dialogue.interpolate(str(s.get("passbook_owner", "Account holder {name}")), v))
		if GameState.has_account():
			lines.append(Dialogue.interpolate(str(s.get("passbook_account", "Account {short_address} · {chain}")), v))
			lines.append(Dialogue.interpolate(str(s.get("passbook_balance", "{balance} {symbol}")), v))
			if GameState.pending_count() > 0:
				lines.append(Dialogue.interpolate(str(s.get("passbook_pending", "{pending} in the vault · next release {release_in}")), v))
		else:
			lines.append(str(s.get("passbook_no_account", "Account not opened yet.")))
		lines.append(str(s.get("passbook_delegated" if GameState.delegated() else "passbook_client", "")))
	if Chain.use_mock:
		lines.append(str(s.get("passbook_mock", "MockChain — nothing here is on a chain")))
	_passbook.text = "\n".join(lines)


func _on_stage(ev: Dictionary) -> void:
	var line := str(ev.get("bankLine", ""))
	if line == "":
		return
	_stage.text = line
	_stage_until = Time.get_unix_time_from_system() + 6.0


func show_toast(text: String, kind: String = "error") -> void:
	_toast.text = text
	_toast.add_theme_color_override("font_color", Color(0.55, 0.9, 0.6) if kind == "info" else Color(1.0, 0.55, 0.5))
	_toast_until = Time.get_unix_time_from_system() + 6.0


func set_prompt(text: String) -> void:
	_prompt.text = text
	_prompt.visible = text != ""


var _tick := 0.0


func _process(delta: float) -> void:
	# the passbook's "next release" line counts against the desk clock, so redraw it once a second while cooling
	_tick += delta
	if _tick >= 1.0:
		_tick = 0.0
		if GameState.cooling_count() > 0:
			_refresh()
	var t := Time.get_unix_time_from_system()
	_stage.visible = t < _stage_until and _stage.text != ""
	_toast.visible = t < _toast_until and _toast.text != ""
	_help.visible = not GameState.ui_locked
