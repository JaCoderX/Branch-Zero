extends Control
## Iris's load slip (docs/LOAD-ACCOUNT.md). Same code-built Control family as `payment_slip.gd` and
## `name_claim_form.gd`: one value, checked for shape only, then handed back over the
## Dialogue → GameState → Chain boundary.
##
## The shape check here is deliberately shallow — 0x plus forty hex characters. Whether that address is a real
## AccountBlox, whether it is on this wing, and above all whether the player owns it are facts about the chain,
## and only the Teller Desk may answer them (it reads `owner()` before it changes anything). A form that guessed
## would either refuse a good address or promise a load the desk is about to refuse.

var _panel: PanelContainer
var _account_edit: LineEdit
var _hint: Label
var _error: Label


func _ready() -> void:
	name = "LoadAccountForm"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false

	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -300
	_panel.offset_right = 300
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
	title.text = GameState.strings.get("load_account_title", "LOAD AN ACCOUNT")
	title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color(0.15, 0.30, 0.24))
	v.add_child(title)
	var label := Label.new()
	label.text = GameState.strings.get("load_account_label", "Account number")
	label.add_theme_font_size_override("font_size", 15)
	label.add_theme_color_override("font_color", Color(0.35, 0.3, 0.2))
	v.add_child(label)
	_account_edit = LineEdit.new()
	_account_edit.placeholder_text = GameState.strings.get("load_account_placeholder", "Paste the account address")
	_account_edit.add_theme_font_size_override("font_size", 17)
	_account_edit.text_submitted.connect(func(_text: String) -> void: _submit())
	v.add_child(_account_edit)
	_hint = Label.new()
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
	submit.text = GameState.strings.get("load_account_submit", "Load this account")
	submit.add_theme_font_size_override("font_size", 17)
	submit.pressed.connect(_submit)
	row.add_child(submit)
	var cancel := Button.new()
	cancel.text = GameState.strings.get("load_account_cancel", "Never mind")
	cancel.add_theme_font_size_override("font_size", 17)
	cancel.pressed.connect(_cancel)
	row.add_child(cancel)

	Dialogue.form_requested.connect(func(kind: String, _ctx: Dictionary) -> void:
		if kind == "load_account":
			_open())


func _open() -> void:
	_error.visible = false
	# The hint names the wing the desk is actually on: a load is per wing, and the commonest mistake this slip
	# can catch early is a number copied from the other one (docs/LOAD-ACCOUNT.md §5). Under MockChain there is
	# no terminal to look an address up in, so the canned numbers are named instead of pretending otherwise.
	var key := "load_account_hint_mock" if Chain.use_mock else "load_account_hint"
	_hint.text = Dialogue.interpolate(str(GameState.strings.get(key, "")), GameState.vars())
	_account_edit.text = ""
	visible = true
	_account_edit.grab_focus()


func _submit() -> void:
	var account := _account_edit.text.strip_edges()
	if not _looks_like_address(account):
		_error.text = GameState.strings.get("load_account_bad_address", "That is not an account number (0x + 40 characters).")
		_error.visible = true
		return
	visible = false
	Dialogue.submit_form({"account": account})


static func _looks_like_address(a: String) -> bool:
	if a.length() != 42 or not a.begins_with("0x"):
		return false
	for i in range(2, 42):
		if not a[i].is_valid_hex_number(false):
			return false
	return true


func _cancel() -> void:
	visible = false
	Dialogue.cancel_form()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		_cancel()
		get_viewport().set_input_as_handled()
