extends CanvasLayer
## HUD — a bottom band so the architecture stays clear (U7 viz Stage 5): passbook card bottom-left, help line along
## the very bottom, interaction prompt bottom-centre, zone chip bottom-right. The passbook and chip step aside while a
## dialogue or form is open (the box lands on the same band). Stage lines and error toasts are six-second notices in
## the top-right corner, sized to their text, so they never sit on the dialogue box. Nothing persistent sits in the
## top third, where the lobby camera holds the ledger board, the frieze and the vault repeater. Every string comes from
## dialogue/strings.json or the bridge (docs/GODOT.md §6). Fonts: BankFonts (Inter) is installed here, before any label
## is built, so every Control in the game inherits it.

const HELP_SECONDS := 25.0    # the key legend fades once the player has had a look; F1 brings it back

var _debug := false           # main.gd: F-key teleports are live → the legend shows their line too
const BRASS := Color(0.86, 0.69, 0.32)
const FLOAT_QUIET_EDGE := Color(0.34, 0.30, 0.20)
const FLOAT_URGENT_EDGE := Color(0.85, 0.55, 0.18)
const FLOAT_URGENT_TEXT := Color(1.0, 0.72, 0.28)

var _passbook: Label
var _branch_float: Button
var _zone: Label
var _prompt: Label
var _stage: Label
var _toast: Label
var _help: Label
var _toast_until := 0.0
var _stage_until := 0.0
var _help_until := 0.0
var _help_pinned := false
var _help_tween: Tween


func _ready() -> void:
	layer = 5
	BankFonts.install_ui()
	# anchor (0..1 of the viewport) + pixel offsets; `position` after an anchor preset lands off-screen.
	_passbook = _label("Passbook", Vector2(0, 1), Vector4(16, -54, 456, -54), 14, Color(0.95, 0.95, 0.95))
	_passbook.grow_vertical = Control.GROW_DIRECTION_BEGIN   # zero-height box: the card hugs the help line and grows upward with its lines
	_passbook.add_theme_stylebox_override("normal", _panel_style(true))
	_branch_float = Button.new()
	_branch_float.name = "BranchFloat"
	_branch_float.anchor_left = 0.0
	_branch_float.anchor_right = 0.0
	_branch_float.anchor_top = 1.0
	_branch_float.anchor_bottom = 1.0
	# The passbook can grow upward with its rows, so keep the compact meter just above it in the bottom-left band.
	_branch_float.offset_left = 16
	_branch_float.offset_top = -226
	_branch_float.offset_right = 190
	_branch_float.offset_bottom = -192
	_branch_float.text = "⛽ —"
	_branch_float.focus_mode = Control.FOCUS_NONE
	_branch_float.add_theme_font_size_override("font_size", 13)
	_branch_float.add_theme_color_override("font_color", BRASS)
	_branch_float.add_theme_color_override("font_hover_color", Color(1, 0.95, 0.78))
	_branch_float.add_theme_stylebox_override("normal", _chip_style(FLOAT_QUIET_EDGE))
	_branch_float.add_theme_stylebox_override("hover", _chip_style(BRASS))
	_branch_float.add_theme_stylebox_override("pressed", _chip_style(BRASS))
	_branch_float.pressed.connect(func() -> void:
		GameState.open_branch_float("hud"))
	add_child(_branch_float)
	_branch_float.visible = false
	_zone = _label("Zone", Vector2(1, 1), Vector4(-236, -94, -16, -54), 17, BRASS)
	_zone.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_zone.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_zone.add_theme_stylebox_override("normal", _panel_style())
	_zone.add_theme_font_override("font", BankFonts.ui_bold())
	_stage = _label("Stage", Vector2(1, 0), Vector4(-16, 12, -16, 12), 16, Color(0.85, 0.72, 1.0))
	_stage.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_stage.grow_vertical = Control.GROW_DIRECTION_END
	_stage.autowrap_mode = TextServer.AUTOWRAP_OFF
	_stage.add_theme_stylebox_override("normal", _panel_style())
	_toast = _label("Toast", Vector2(1, 0), Vector4(-16, 58, -16, 58), 16, Color(1.0, 0.55, 0.5))
	_toast.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_toast.grow_vertical = Control.GROW_DIRECTION_END
	_toast.autowrap_mode = TextServer.AUTOWRAP_OFF
	_toast.add_theme_stylebox_override("normal", _panel_style())
	_prompt = _label("Prompt", Vector2(0.5, 1), Vector4(-180, -104, 180, -58), 20, Color(1, 1, 1))
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_prompt.add_theme_stylebox_override("normal", _panel_style())
	_prompt.add_theme_font_override("font", BankFonts.ui_bold())
	_help = _label("Help", Vector2(0, 1), Vector4(16, -46, -16, -8), 13, Color(0.72, 0.76, 0.80))
	_help.anchor_right = 1.0
	_help.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	_help.text = str(GameState.strings.get("help", ""))
	_help_until = Time.get_unix_time_from_system() + HELP_SECONDS

	GameState.changed.connect(_refresh)
	GameState.stage.connect(_on_stage)
	GameState.toast.connect(show_toast)
	GameState.zone_changed.connect(func(z: String) -> void:
		_zone.text = z
		_zone.visible = z != "" and not GameState.ui_locked)
	_refresh()


func _label(name: String, anchor: Vector2, offsets: Vector4, font: int, color: Color) -> Label:
	var l := Label.new()
	l.name = name
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
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART if name == "Help" else TextServer.AUTOWRAP_OFF
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(l)
	return l


func _panel_style(brass_edge: bool = false) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.05, 0.08, 0.72)
	sb.corner_radius_top_left = 6
	sb.corner_radius_top_right = 6
	sb.corner_radius_bottom_left = 6
	sb.corner_radius_bottom_right = 6
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 7
	sb.content_margin_bottom = 7
	if brass_edge:
		sb.border_width_left = 3
		sb.border_color = BRASS
		sb.content_margin_left = 14
	return sb


func _chip_style(edge: Color) -> StyleBoxFlat:
	var sb := _panel_style()
	sb.border_width_left = 1
	sb.border_width_top = 1
	sb.border_width_right = 1
	sb.border_width_bottom = 1
	sb.border_color = edge
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
			# A bank name is a row the customer earned at Petra's desk; until then the passbook says nothing about it.
			if GameState.has_ens_name():
				lines.append(Dialogue.interpolate(str(s.get("passbook_name", "Bank name · {bank_name}")), v))
				if str(v.get("bank_tier", "")) != "":
					lines.append(Dialogue.interpolate(str(s.get("passbook_tier", "Tier · {bank_tier}")), v))
			lines.append(Dialogue.interpolate(str(s.get("passbook_balance", "{balance} {symbol}")), v))
			if GameState.pending_count() > 0:
				lines.append(Dialogue.interpolate(str(s.get("passbook_pending", "{pending} in the vault · next release {release_in}")), v))
		else:
			lines.append(str(s.get("passbook_no_account", "Account not opened yet.")))
		lines.append(str(s.get("passbook_delegated" if GameState.delegated() else "passbook_client", "")))
	if Chain.use_mock:
		lines.append(str(s.get("passbook_mock", "MockChain — nothing here is on a chain")))
	_passbook.text = "\n".join(lines)
	_refresh_branch_float()


func _refresh_branch_float() -> void:
	if _branch_float == null:
		return
	var short := GameState.treasury_short()
	var eth: Variant = GameState.treasury_status.get("eth")
	var amount := "—" if eth == null or str(eth) == "" or str(eth) == "<null>" else GameState.fmt_amount(eth)
	_branch_float.text = "⛽ LOW" if short else "⛽ %s ETH" % amount
	var edge := FLOAT_URGENT_EDGE if short else FLOAT_QUIET_EDGE
	var text_color := FLOAT_URGENT_TEXT if short else BRASS
	var hover_color := Color(1.0, 0.92, 0.60) if short else Color(1.0, 0.95, 0.78)
	_branch_float.add_theme_color_override("font_color", text_color)
	_branch_float.add_theme_color_override("font_hover_color", hover_color)
	_branch_float.add_theme_color_override("font_pressed_color", hover_color)
	_branch_float.add_theme_stylebox_override("normal", _chip_style(edge))
	_branch_float.add_theme_stylebox_override("hover", _chip_style(hover_color))
	_branch_float.add_theme_stylebox_override("pressed", _chip_style(hover_color))
	_branch_float.tooltip_text = "Bank ops ETH on Sepolia — help keep the branch open. Not your wallet or passbook."


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


## The legend's first look starts over — the player menu calls this when the player walks in through the front door,
## so the 25 s are not spent behind the title.
func show_help_again() -> void:
	_help_until = Time.get_unix_time_from_system() + HELP_SECONDS


## With the debug flag the legend also lists the F-key teleports; without it they are not bound, so they are not shown.
func set_debug(on: bool) -> void:
	_debug = on
	var s: Dictionary = GameState.strings
	_help.text = str(s.get("help", ""))
	if on and str(s.get("help_debug", "")) != "":
		_help.text += "\n" + str(s.get("help_debug", ""))


func _unhandled_input(event: InputEvent) -> void:
	# F1 pins / unpins the key legend after it has faded (F5 is the browser's reload; F2–F8 teleport only with ?debug=1)
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_F1:
		_help_pinned = not _help_pinned
		if not _help_pinned:
			_help_until = 0.0
		_fade_help(_help_pinned)
		get_viewport().set_input_as_handled()


func _fade_help(show: bool) -> void:
	if _help_tween != null and _help_tween.is_valid():
		_help_tween.kill()
	_help_tween = create_tween()
	_help_tween.tween_property(_help, "modulate:a", 1.0 if show else 0.0, 0.6)


var _tick := 0.0
var _help_shown := true


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
	_passbook.visible = not GameState.ui_locked
	_branch_float.visible = not GameState.ui_locked and GameState.branch_float_available()
	_zone.visible = not GameState.ui_locked and _zone.text != ""
	var want_help := not GameState.ui_locked and (_help_pinned or t < _help_until)
	if want_help != _help_shown:
		_help_shown = want_help
		_fade_help(want_help)
