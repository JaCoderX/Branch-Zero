extends CanvasLayer
class_name PlayerMenu
## Player menu (docs/HANDOFF-player-menu.md) — two player-facing surfaces, both plain Godot Controls on one
## CanvasLayer above the HUD and the dialogue layer. No HTML, so the canvas keeps the keyboard (U4 focus lesson).
##
##   Front door (title)  — brand · one line · **Enter the branch**; Controls and a short About underneath. Shown once
##                         per visit and again after "Leave for today". The bank is visible, dimmed, behind it.
##   Visitor's card (Esc) — Resume · Controls · Sound · Leave for today. A soft card over the lobby, not a settings
##                         wall. Esc only opens it when the floor is free: a dialogue, slip, form or the Console owns
##                         Esc first (they run `_unhandled_input` too and each checks its own `visible`; this layer
##                         steps aside whenever `Dialogue.active` or `GameState.ui_locked`).
##
## While either surface is up `GameState.ui_locked` is true — the player, the interact key and the debug teleports
## already honour it — and nothing is paused: bridge events, the desk clock and any in-flight desk action carry on.
## Everything the bank already owns stays at its desk: no Sign in / Load Account (Ines), no Live / Dev / Mock
## (desk-debug), no wing switch (elevator), no Console (terminals). Every string comes from dialogue/strings.json.

signal entered()     # the player walked in through the front door
signal left()        # "Leave for today" confirmed — the title is back up
signal mode_changed()   # any surface went up or down — main.gd re-decides the [Space] prompt

enum Mode { NONE, TITLE, PAUSE }

const BRASS := Color(0.86, 0.69, 0.32)
const CREAM := Color(0.95, 0.93, 0.88)
const INK := Color(0.05, 0.06, 0.09, 0.94)
const MUTED := Color(0.72, 0.76, 0.80)
const CARD_WIDTH := 460.0

var mode: int = Mode.NONE
var _page := ""                 # "" · "controls" · "about" · "leave"

var _root: Control
var _scrim: ColorRect
var _title_box: VBoxContainer
var _card: PanelContainer
var _card_box: VBoxContainer
var _status: Label            # title footer: booting / MockChain honesty line
var _buttons: Array[Button] = []


func _ready() -> void:
	name = "PlayerMenu"
	layer = 20
	visible = false

	_root = Control.new()
	_root.name = "Root"
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_STOP   # clicks stop at the card; the bank behind is not interactive
	add_child(_root)

	_scrim = ColorRect.new()
	_scrim.name = "Scrim"
	_scrim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_scrim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_scrim)

	# --- front door -------------------------------------------------------------------------------------------
	_title_box = VBoxContainer.new()
	_title_box.name = "FrontDoor"
	_title_box.set_anchors_preset(Control.PRESET_CENTER)
	_title_box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_title_box.grow_vertical = Control.GROW_DIRECTION_BOTH
	_title_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_title_box.add_theme_constant_override("separation", 14)
	_title_box.custom_minimum_size = Vector2(CARD_WIDTH, 0)
	_root.add_child(_title_box)

	_status = Label.new()
	_status.name = "Status"
	_status.anchor_left = 0.0
	_status.anchor_right = 1.0
	_status.anchor_top = 1.0
	_status.anchor_bottom = 1.0
	_status.offset_left = 16
	_status.offset_right = -16
	_status.offset_top = -46
	_status.offset_bottom = -12
	_status.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	_status.add_theme_font_size_override("font_size", 14)
	_status.add_theme_color_override("font_color", MUTED)
	_status.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_status)

	# --- visitor's card ---------------------------------------------------------------------------------------
	_card = PanelContainer.new()
	_card.name = "VisitorsCard"
	_card.set_anchors_preset(Control.PRESET_CENTER)
	_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_card.grow_vertical = Control.GROW_DIRECTION_BOTH
	_card.custom_minimum_size = Vector2(CARD_WIDTH, 0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = INK
	sb.border_color = BRASS
	sb.border_width_top = 3
	sb.corner_radius_top_left = 8
	sb.corner_radius_top_right = 8
	sb.corner_radius_bottom_left = 8
	sb.corner_radius_bottom_right = 8
	sb.content_margin_left = 22
	sb.content_margin_right = 22
	sb.content_margin_top = 16
	sb.content_margin_bottom = 18
	_card.add_theme_stylebox_override("panel", sb)
	_root.add_child(_card)
	_card_box = VBoxContainer.new()
	_card_box.add_theme_constant_override("separation", 10)
	_card.add_child(_card_box)

	GameState.changed.connect(_refresh_status)
	get_viewport().size_changed.connect(_relayout)
	_refresh_status()


func is_open() -> bool:
	return mode != Mode.NONE


## The front door. Called by main.gd on boot (product path only — tests and the demo walk skip it) and after Leave.
func show_title() -> void:
	mode = Mode.TITLE
	_page = ""
	GameState.ui_locked = true
	visible = true
	_render()
	mode_changed.emit()


## Esc on a free floor. Refused while anything else owns the screen (see the header) — main.gd's Esc never reaches
## here in those cases anyway, but a second gate costs nothing.
func open_pause() -> void:
	if mode != Mode.NONE or Dialogue.active or GameState.ui_locked:
		return
	mode = Mode.PAUSE
	_page = ""
	GameState.ui_locked = true
	visible = true
	_render()
	mode_changed.emit()


func resume() -> void:
	if mode != Mode.PAUSE:
		return
	mode = Mode.NONE
	_page = ""
	visible = false
	# mirror Dialogue.close(): the Console overlay keeps the lock if it is up (it cannot be — Esc would not have
	# opened the card — but the rule stays in one shape)
	GameState.ui_locked = GameState.terminal_open
	mode_changed.emit()


func _enter() -> void:
	if mode != Mode.TITLE:
		return
	mode = Mode.NONE
	_page = ""
	visible = false
	GameState.ui_locked = GameState.terminal_open
	mode_changed.emit()
	entered.emit()


## Soft exit: the floor is left, the account / Privy session is not touched (a web page has no Quit). The title
## comes back; main.gd walks the player to the front door.
func _leave() -> void:
	if mode != Mode.PAUSE:
		return
	mode = Mode.TITLE
	_page = ""
	GameState.ui_locked = true
	left.emit()
	_render()
	mode_changed.emit()


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	var key: int = event.keycode
	if mode == Mode.NONE:
		# Esc priority: dialogue → slip / form → Console → visitor's card. Anything that locks the floor gets Esc first.
		if key == KEY_ESCAPE and not Dialogue.active and not GameState.ui_locked:
			open_pause()
			get_viewport().set_input_as_handled()
		return
	# a surface is up: every key stops here (the player, the interact key and the teleports are locked anyway)
	get_viewport().set_input_as_handled()
	if key == KEY_ESCAPE or key == KEY_BACKSPACE:
		if _page != "":
			_page = ""
			_render()
		elif mode == Mode.PAUSE:
			resume()
		return
	if mode == Mode.TITLE and _page == "" and (key == KEY_ENTER or key == KEY_KP_ENTER):
		_enter()
		return
	# 1–9 pick a row, the same way the dialogue box numbers its choices
	var n: int = key - KEY_1
	if n >= 0 and n < _buttons.size():
		_buttons[n].pressed.emit()


# ---------------------------------------------------------------------------------------------------------------

func _render() -> void:
	_buttons.clear()
	for box in [_title_box, _card_box]:
		for c in box.get_children():
			box.remove_child(c)   # out of the tree now, so the box's minimum size is right for _relayout this frame
			c.queue_free()
	var s: Dictionary = GameState.strings
	_title_box.visible = mode == Mode.TITLE and _page == ""
	_status.visible = mode == Mode.TITLE
	_card.visible = mode == Mode.PAUSE or _page != ""
	_scrim.color = Color(0.03, 0.04, 0.06, 0.62 if mode == Mode.TITLE else 0.38)

	if _title_box.visible:
		_title_box.add_child(_text(str(s.get("menu_brand", "Branch Zero")), 64, BRASS, BankFonts.plaque(), HORIZONTAL_ALIGNMENT_CENTER))
		_title_box.add_child(_text(str(s.get("menu_tagline", "A bank you can walk through.")), 22, CREAM, BankFonts.ui(), HORIZONTAL_ALIGNMENT_CENTER))
		_title_box.add_child(_spacer(18))
		var enter := _button(str(s.get("menu_enter", "Enter the branch")), _enter, true)
		_title_box.add_child(enter)
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", 12)
		row.add_child(_button(str(s.get("menu_controls", "Controls")), func() -> void: _open_page("controls")))
		row.add_child(_button(str(s.get("menu_about", "About the branch")), func() -> void: _open_page("about")))
		_title_box.add_child(row)
		# GitHub ★ CTAs — two repos, one row. Star goes through the shell (`starGithub`); the canvas stays put.
		var stars := HBoxContainer.new()
		stars.alignment = BoxContainer.ALIGNMENT_CENTER
		stars.add_theme_constant_override("separation", 12)
		stars.add_child(_button(str(s.get("menu_star_game", "★ Star the game")), func() -> void: _star_repo("JaCoderX/Branch-Zero")))
		stars.add_child(_button(str(s.get("menu_star_protocol", "★ Star the protocol")), func() -> void: _star_repo("PracticalParticle/Bloxchain-Protocol")))
		_title_box.add_child(stars)
		_title_box.add_child(_text(str(s.get("menu_hint_enter", "Enter ↵")), 13, MUTED, BankFonts.ui(), HORIZONTAL_ALIGNMENT_CENTER))
		enter.grab_focus.call_deferred()
	elif _card.visible:
		match _page:
			"controls":
				_card_box.add_child(_text(str(s.get("menu_controls", "Controls")), 22, BRASS, BankFonts.plaque()))
				_card_box.add_child(_text(str(s.get("help", "")), 17, CREAM, BankFonts.ui(), HORIZONTAL_ALIGNMENT_LEFT, true))
				_card_box.add_child(_text(str(s.get("menu_controls_esc", "Esc opens this card on the floor and closes a conversation or a slip first.")), 14, MUTED, BankFonts.ui(), HORIZONTAL_ALIGNMENT_LEFT, true))
				_card_box.add_child(_spacer(4))
				_card_box.add_child(_button(str(s.get("menu_back", "Back")), func() -> void: _open_page("")))
			"about":
				_card_box.add_child(_text(str(s.get("menu_about", "About the branch")), 22, BRASS, BankFonts.plaque()))
				_card_box.add_child(_text(str(s.get("menu_about_text", "")), 16, CREAM, BankFonts.ui(), HORIZONTAL_ALIGNMENT_LEFT, true))
				_card_box.add_child(_spacer(4))
				_card_box.add_child(_button(str(s.get("menu_back", "Back")), func() -> void: _open_page("")))
			"leave":
				_card_box.add_child(_text(str(s.get("pause_leave", "Leave for today")), 22, BRASS, BankFonts.plaque()))
				_card_box.add_child(_text(str(s.get("pause_leave_ask", "Leave the floor for today?")), 17, CREAM, BankFonts.ui(), HORIZONTAL_ALIGNMENT_LEFT, true))
				_card_box.add_child(_spacer(4))
				_card_box.add_child(_button(str(s.get("pause_leave_no", "Stay")), func() -> void: _open_page("")))
				_card_box.add_child(_button(str(s.get("pause_leave_yes", "Leave")), _leave))
			_:
				_card_box.add_child(_text(str(s.get("pause_title", "Visitor's card")), 24, BRASS, BankFonts.plaque()))
				_card_box.add_child(_text(str(s.get("pause_sub", "")), 14, MUTED, BankFonts.ui(), HORIZONTAL_ALIGNMENT_LEFT, true))
				_card_box.add_child(_spacer(4))
				_card_box.add_child(_button(str(s.get("pause_resume", "Resume")), resume))
				_card_box.add_child(_button(str(s.get("pause_controls", "Controls")), func() -> void: _open_page("controls")))
				var sound_key := "pause_sound_off" if Audio.muted else "pause_sound_on"
				_card_box.add_child(_button(str(s.get(sound_key, "Sound")), func() -> void:
					Audio.set_muted(not Audio.muted)
					_render()))
				_card_box.add_child(_button(str(s.get("pause_leave", "Leave for today")), func() -> void: _open_page("leave")))
		if not _buttons.is_empty():
			_buttons[0].grab_focus.call_deferred()
	_number_rows()
	_refresh_status()
	_relayout()
	_relayout.call_deferred()   # once more after the containers have sorted their new children


func _open_page(page: String) -> void:
	_page = page
	_render()


## Front-door GitHub star. The shell keeps the bank mounted; a small popup handles GitHub consent / the repo page.
func _star_repo(repo: String) -> void:
	GameState.toast.emit(str(GameState.strings.get("menu_star_working", "Opening GitHub…")), "info")
	var r: Dictionary = await Chain.call_async("starGithub", {"repo": repo}, 180.0)
	if r.get("ok", false):
		var result: Dictionary = r.get("result", {})
		if typeof(result) != TYPE_DICTIONARY:
			result = {}
		var via := str(result.get("via", ""))
		if via == "api":
			if result.get("already", false):
				GameState.toast.emit(str(GameState.strings.get("menu_star_already", "Already starred — thank you.")), "info")
			else:
				GameState.toast.emit(str(GameState.strings.get("menu_star_done", "Starred — thank you.")), "info")
		else:
			GameState.toast.emit(str(GameState.strings.get("menu_star_popup", "If you are signed into GitHub, tap Star, then close the window.")), "info")
		return
	var err: Dictionary = r.get("error", {})
	var line := str(err.get("bankLine", err.get("message", GameState.strings.get("menu_star_failed", "GitHub would not take the star just now."))))
	GameState.toast.emit(line, "error")


## Rows are numbered like the dialogue box's choices so 1–4 work from the keyboard (the web canvas gets keys, and
## the Browser-pane tester cannot click Godot buttons).
func _number_rows() -> void:
	if mode != Mode.PAUSE:
		return
	var i := 0
	for b in _buttons:
		i += 1
		b.text = "%d.  %s" % [i, b.text]


func _refresh_status() -> void:
	if not is_instance_valid(_status):
		return
	var s: Dictionary = GameState.strings
	if not GameState.booted:
		_status.text = str(s.get("passbook_booting", "Opening the branch…"))
	elif Chain.use_mock:
		# mock honesty: the same line the passbook shows — never a silent fake chain, not even on the front door
		_status.text = str(s.get("passbook_mock", "MockChain — nothing on this screen is on a chain"))
	else:
		_status.text = ""


func _relayout() -> void:
	# the card and the front door centre themselves; cap the width on a narrow viewport
	var w: float = min(CARD_WIDTH, max(280.0, get_viewport().get_visible_rect().size.x - 48.0))
	for c: Control in [_title_box, _card]:
		c.custom_minimum_size.x = w
		c.offset_left = -w / 2.0
		c.offset_right = w / 2.0
		c.offset_top = -c.get_combined_minimum_size().y / 2.0
		c.offset_bottom = -c.offset_top


func _text(text: String, size: int, color: Color, font: Font, align: int = HORIZONTAL_ALIGNMENT_LEFT, wrap: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if font != null:
		l.add_theme_font_override("font", font)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART if wrap else TextServer.AUTOWRAP_OFF
	if wrap:
		l.custom_minimum_size.x = CARD_WIDTH - 44.0
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _spacer(h: int) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, h)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


func _button(text: String, on_pressed: Callable, primary: bool = false) -> Button:
	var b := Button.new()
	b.text = text
	b.alignment = HORIZONTAL_ALIGNMENT_CENTER if primary else HORIZONTAL_ALIGNMENT_LEFT
	b.add_theme_font_size_override("font_size", 22 if primary else 18)
	b.add_theme_font_override("font", BankFonts.ui_bold() if primary else BankFonts.ui())
	b.add_theme_color_override("font_color", CREAM)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_focus_color", Color.WHITE)
	b.add_theme_color_override("font_pressed_color", BRASS)
	b.add_theme_stylebox_override("normal", _button_style(Color(0.10, 0.12, 0.17, 0.92) if primary else Color(0.08, 0.09, 0.13, 0.85), Color(0, 0, 0, 0), primary))
	b.add_theme_stylebox_override("hover", _button_style(Color(0.14, 0.16, 0.22, 0.95), BRASS, primary))
	b.add_theme_stylebox_override("focus", _button_style(Color(0.14, 0.16, 0.22, 0.95), BRASS, primary))
	b.add_theme_stylebox_override("pressed", _button_style(Color(0.20, 0.17, 0.10, 0.95), BRASS, primary))
	b.focus_mode = Control.FOCUS_ALL
	b.pressed.connect(on_pressed)
	_buttons.append(b)
	return b


func _button_style(bg: Color, border: Color, primary: bool) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(2 if border.a > 0.0 else 0)
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 12 if primary else 9
	sb.content_margin_bottom = 12 if primary else 9
	if not primary:
		sb.border_width_left = 3
		sb.border_color = border if border.a > 0.0 else BRASS
	return sb
