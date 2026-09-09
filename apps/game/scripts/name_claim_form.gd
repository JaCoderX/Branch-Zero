extends Control
## Petra's Name Desk form. It follows payment_slip.gd's code-built Control pattern, but the only value is an
## ENSv2 customer label; the actual normalization, availability read and Sepolia transaction happen behind the
## Dialogue → GameState → Chain boundary.

var _panel: PanelContainer
var _label_edit: LineEdit
var _hint: Label
var _error: Label
var _checking := false


func _ready() -> void:
	name = "NameClaimForm"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false

	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -280
	_panel.offset_right = 280
	_panel.offset_top = -155
	_panel.offset_bottom = 155
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.97, 0.95, 0.88, 0.98)
	sb.border_color = Color(0.30, 0.55, 0.48)
	sb.border_width_left = 3
	sb.border_width_right = 3
	sb.border_width_top = 3
	sb.border_width_bottom = 3
	sb.corner_radius_top_left = 4
	sb.corner_radius_top_right = 4
	sb.corner_radius_bottom_left = 4
	sb.corner_radius_bottom_right = 4
	sb.content_margin_left = 20
	sb.content_margin_right = 20
	sb.content_margin_top = 14
	sb.content_margin_bottom = 14
	_panel.add_theme_stylebox_override("panel", sb)
	add_child(_panel)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	_panel.add_child(v)
	var title := Label.new()
	title.text = GameState.strings.get("name_claim_title", "NAME CLAIM")
	title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color(0.15, 0.30, 0.24))
	v.add_child(title)
	var label := Label.new()
	label.text = GameState.strings.get("name_claim_label", "Choose one label under branchzero.eth")
	label.add_theme_font_size_override("font_size", 15)
	label.add_theme_color_override("font_color", Color(0.35, 0.3, 0.2))
	v.add_child(label)
	_label_edit = LineEdit.new()
	_label_edit.text = GameState.strings.get("name_claim_placeholder", "your-name")
	_label_edit.placeholder_text = GameState.strings.get("name_claim_placeholder", "your-name")
	_label_edit.add_theme_font_size_override("font_size", 19)
	_label_edit.text_submitted.connect(func(_text: String) -> void: _submit())
	v.add_child(_label_edit)
	_hint = Label.new()
	_hint.text = GameState.strings.get("name_claim_hint", "Your bank name is kept on Sepolia and points to your account. Counter can pay by it once Petra registers it.")
	_hint.add_theme_font_size_override("font_size", 14)
	_hint.add_theme_color_override("font_color", Color(0.35, 0.3, 0.2))
	_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_hint)
	_error = Label.new()
	_error.add_theme_font_size_override("font_size", 15)
	_error.add_theme_color_override("font_color", Color(0.7, 0.1, 0.1))
	_error.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_error.visible = false
	v.add_child(_error)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	v.add_child(row)
	var submit := Button.new()
	submit.text = GameState.strings.get("name_claim_submit", "Check and claim")
	submit.add_theme_font_size_override("font_size", 17)
	submit.pressed.connect(_submit)
	row.add_child(submit)
	var cancel := Button.new()
	cancel.text = GameState.strings.get("name_claim_cancel", "Never mind")
	cancel.add_theme_font_size_override("font_size", 17)
	cancel.pressed.connect(_cancel)
	row.add_child(cancel)

	Dialogue.form_requested.connect(func(kind: String, _ctx: Dictionary) -> void:
		if kind == "name_claim":
			_open())


func _open() -> void:
	_checking = false
	_error.visible = false
	_hint.text = GameState.strings.get("name_claim_hint", "Your bank name is kept on Sepolia and points to your account. Counter can pay by it once Petra registers it.")
	visible = true
	_label_edit.grab_focus()
	_label_edit.select_all()


func _submit() -> void:
	if _checking:
		return
	var label := _label_edit.text.strip_edges()
	if label == "" or label.contains("."):
		_error.text = GameState.strings.get("name_claim_bad_label", "Choose one label only — Petra adds .branchzero.eth.")
		_error.visible = true
		return
	_checking = true
	_error.visible = false
	_hint.text = GameState.strings.get("name_claim_checking", "Checking the Sepolia name register…")
	var read := await GameState.run_action("ens_available", {"label": label})
	if not read.get("ok", false):
		_error.text = GameState.error_line(read.get("error", {}))
		_error.visible = true
		_checking = false
		_hint.text = GameState.strings.get("name_claim_hint", "Your bank name is kept on Sepolia and points to your account. Counter can pay by it once Petra registers it.")
		return
	var result: Dictionary = read.get("result", {})
	if not bool(result.get("available", false)):
		_error.text = GameState.error_line({"code": "NAME_TAKEN", "message": "%s is already registered" % str(result.get("name", label))})
		_error.visible = true
		_checking = false
		_hint.text = GameState.strings.get("name_claim_taken_hint", "Try another label.")
		return
	_checking = false
	visible = false
	Dialogue.submit_form({"label": label})


func _cancel() -> void:
	visible = false
	Dialogue.cancel_form()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		_cancel()
		get_viewport().set_input_as_handled()
