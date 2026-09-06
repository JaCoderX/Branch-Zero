extends Control
## Dialogue box — speaker, 1–3 lines, numbered choices (docs/GAME-DESIGN.md §7). Keys 1–9 pick a choice,
## Esc closes. While the NPC is WORKING the choices are hidden and the line shows the real stage text.

var _panel: PanelContainer
var _speaker: Label
var _text: Label
var _choices: VBoxContainer
var _working: Label
var _buttons: Array[Button] = []


func _ready() -> void:
	name = "DialogueBox"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false

	# A fixed 760 × 330 slot at the bottom centre; the panel sits at the bottom of it and grows upward.
	var slot := VBoxContainer.new()
	slot.anchor_left = 0.5
	slot.anchor_right = 0.5
	slot.anchor_top = 1.0
	slot.anchor_bottom = 1.0
	slot.offset_left = -380
	slot.offset_right = 380
	slot.offset_top = -370
	slot.offset_bottom = -40
	slot.alignment = BoxContainer.ALIGNMENT_END
	slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(slot)
	_panel = PanelContainer.new()
	_panel.size_flags_horizontal = Control.SIZE_FILL
	_panel.size_flags_vertical = Control.SIZE_SHRINK_END
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.06, 0.09, 0.94)
	sb.border_color = Color(0.95, 0.80, 0.45)
	sb.border_width_top = 2
	sb.corner_radius_top_left = 8
	sb.corner_radius_top_right = 8
	sb.corner_radius_bottom_left = 8
	sb.corner_radius_bottom_right = 8
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 12
	sb.content_margin_bottom = 12
	_panel.add_theme_stylebox_override("panel", sb)
	slot.add_child(_panel)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	_panel.add_child(v)

	_speaker = Label.new()
	_speaker.add_theme_font_size_override("font_size", 18)
	_speaker.add_theme_color_override("font_color", Color(0.95, 0.80, 0.45))
	v.add_child(_speaker)

	_text = Label.new()
	_text.add_theme_font_size_override("font_size", 20)
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.custom_minimum_size = Vector2(720, 0)
	v.add_child(_text)

	_working = Label.new()
	_working.add_theme_font_size_override("font_size", 18)
	_working.add_theme_color_override("font_color", Color(0.85, 0.72, 1.0))
	_working.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_working.visible = false
	v.add_child(_working)

	_choices = VBoxContainer.new()
	_choices.add_theme_constant_override("separation", 4)
	v.add_child(_choices)

	Dialogue.opened.connect(func(_id: String) -> void:
		visible = true
		_working.visible = false)
	Dialogue.closed.connect(func(_id: String) -> void:
		visible = false)
	Dialogue.node_changed.connect(_on_node)
	Dialogue.working.connect(func(_id: String, text: String) -> void:
		_working.text = text
		_working.visible = true
		for b in _buttons:
			b.disabled = true)
	Dialogue.form_requested.connect(func(_kind: String, _ctx: Dictionary) -> void:
		visible = false)
	Dialogue.form_closed.connect(func() -> void:
		visible = Dialogue.active)


func _on_node(speaker: String, role: String, text: String, choices: Array) -> void:
	print("DialogueBox: %s — %d choice(s)" % [speaker, choices.size()])
	_speaker.text = "%s · %s" % [speaker, role] if role != "" else speaker
	_text.text = text
	_working.visible = false
	for b in _buttons:
		b.queue_free()
	_buttons.clear()
	var i := 0
	for c in choices:
		i += 1
		var b := Button.new()
		b.text = "%d.  %s" % [i, str(c)]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.add_theme_font_size_override("font_size", 18)
		var idx := i - 1
		b.pressed.connect(func() -> void:
			Dialogue.choose(idx))
		_choices.add_child(b)
		_buttons.append(b)
	if choices.is_empty():
		var b := Button.new()
		b.text = str(GameState.strings.get("close", "Close"))
		b.add_theme_font_size_override("font_size", 18)
		b.pressed.connect(func() -> void:
			Dialogue.close())
		_choices.add_child(b)
		_buttons.append(b)


func _unhandled_input(event: InputEvent) -> void:
	if not visible or not Dialogue.active:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			if not Dialogue.is_working:
				Dialogue.close()
			get_viewport().set_input_as_handled()
			return
		var n: int = event.keycode - KEY_1
		if n >= 0 and n < 9 and n < _buttons.size() and not Dialogue.is_working:
			if _buttons.size() == 1 and _buttons[0].text == str(GameState.strings.get("close", "Close")):
				Dialogue.close()
			else:
				Dialogue.choose(n)
			get_viewport().set_input_as_handled()
