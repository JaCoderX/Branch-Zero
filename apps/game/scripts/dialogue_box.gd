extends Control
## Dialogue box — speaker, 1–3 lines, numbered choices (docs/GAME-DESIGN.md §7). Keys 1–9 pick a choice,
## Esc closes. While the NPC is WORKING the choices are hidden and the line shows the real stage text.

var _panel: PanelContainer
var _content: VBoxContainer
var _header: VBoxContainer
var _speaker: Label
var _text: Label
var _choices_scroll: ScrollContainer
var _choices: VBoxContainer
var _working: Label
var _buttons: Array[Button] = []
var _fit_queued := false

const PANEL_WIDTH := 760.0
const PANEL_SIDE_MARGIN := 24.0
const PANEL_TOP_MARGIN := 24.0
const PANEL_BOTTOM_MARGIN := 40.0


func _ready() -> void:
	name = "DialogueBox"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false

	_panel = PanelContainer.new()
	_panel.name = "ConversationPanel"
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 1.0
	_panel.anchor_bottom = 1.0
	_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_panel.clip_contents = true
	_panel.mouse_filter = Control.MOUSE_FILTER_PASS
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
	add_child(_panel)

	_content = VBoxContainer.new()
	_content.add_theme_constant_override("separation", 8)
	_panel.add_child(_content)
	_header = VBoxContainer.new()
	_header.add_theme_constant_override("separation", 8)
	_content.add_child(_header)

	_speaker = Label.new()
	_speaker.add_theme_font_size_override("font_size", 18)
	_speaker.add_theme_color_override("font_color", Color(0.95, 0.80, 0.45))
	_header.add_child(_speaker)

	_text = Label.new()
	_text.add_theme_font_size_override("font_size", 20)
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.custom_minimum_size = Vector2(720, 0)
	_header.add_child(_text)

	_working = Label.new()
	_working.add_theme_font_size_override("font_size", 18)
	_working.add_theme_color_override("font_color", Color(0.85, 0.72, 1.0))
	_working.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_working.visible = false
	_header.add_child(_working)

	_choices_scroll = ScrollContainer.new()
	_choices_scroll.name = "ChoicesScroll"
	_choices_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_choices_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	_choices_scroll.follow_focus = true
	_choices_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_choices_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_choices_scroll.mouse_filter = Control.MOUSE_FILTER_PASS
	_content.add_child(_choices_scroll)
	_choices = VBoxContainer.new()
	_choices.add_theme_constant_override("separation", 4)
	_choices.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_choices_scroll.add_child(_choices)

	get_viewport().size_changed.connect(_queue_fit_layout)
	resized.connect(_queue_fit_layout)
	_queue_fit_layout()

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
			b.disabled = true
		_queue_fit_layout())
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
	_choices_scroll.set_deferred("scroll_vertical", 0)
	_queue_fit_layout()


func _queue_fit_layout() -> void:
	if _fit_queued:
		return
	_fit_queued = true
	call_deferred("_fit_layout")


func _fit_layout() -> void:
	_fit_queued = false
	if not is_instance_valid(_panel):
		return
	var viewport_size := get_viewport_rect().size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		return

	var panel_width := min(PANEL_WIDTH, max(0.0, viewport_size.x - PANEL_SIDE_MARGIN * 2.0))
	_panel.offset_left = -panel_width / 2.0
	_panel.offset_right = panel_width / 2.0
	# Keep the dialogue copy at the old width on a normal viewport, while allowing it to wrap on narrow ones.
	_text.custom_minimum_size.x = max(0.0, panel_width - 36.0)

	var max_panel_height := max(0.0, viewport_size.y - PANEL_TOP_MARGIN - PANEL_BOTTOM_MARGIN)
	var panel_style := _panel.get_theme_stylebox("panel")
	var panel_padding := panel_style.get_minimum_size().y if panel_style != null else 0.0
	var header_height := _header.get_combined_minimum_size().y
	var choices_height := _choices.get_combined_minimum_size().y
	var choice_slot := max(0.0, max_panel_height - panel_padding - header_height - _content.get_theme_constant("separation"))
	var visible_choices_height := min(choices_height, choice_slot)

	# The ScrollContainer owns only the choices, so the header stays readable while the rows remain reachable.
	_choices_scroll.custom_minimum_size.y = visible_choices_height
	_choices_scroll.custom_maximum_size.y = visible_choices_height
	var panel_height := min(max_panel_height, panel_padding + header_height + _content.get_theme_constant("separation") + visible_choices_height)
	_panel.offset_top = -PANEL_BOTTOM_MARGIN - panel_height
	_panel.offset_bottom = -PANEL_BOTTOM_MARGIN


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
