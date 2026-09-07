extends Control
## Payment slip — recipient, amount, memo (docs/GAME-DESIGN.md §7 "Forms"). Amounts at or under the branch's
## instant limit go over the counter (Lane A); above it the teller routes the slip to the vault (Lane B).
## Preset payees are dev accounts on Remote EVM 1337 (docs/REMOTE-EVM.md §2); any 0x address is accepted.

const PAYEES := [
	["Florist", "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC"],
	["Landlord", "0x3E5e9111Ae8eB78Fe1CC3bb8915d5D461F3Ef9A9"],
	["Demo merchant", "0x28a8746e75304c0780E011BEd21C72cD78cd535E"],
]

var _panel: PanelContainer
var _payee: OptionButton
var _address: LineEdit
var _name_toggle: CheckButton
var _name_edit: LineEdit
var _amount: LineEdit
var _memo: LineEdit
var _hint: Label
var _error: Label


func _ready() -> void:
	name = "PaymentSlip"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	var s: Dictionary = GameState.strings

	# A fixed 560 × 460 slot in the middle of the screen; the slip fills it.
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -280
	_panel.offset_right = 280
	_panel.offset_top = -230
	_panel.offset_bottom = 230
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.97, 0.95, 0.88, 0.98)
	sb.border_color = Color(0.78, 0.62, 0.30)
	sb.border_width_left = 3
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
	title.text = str(s.get("slip_title", "PAYMENT SLIP"))
	title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color(0.25, 0.2, 0.1))
	v.add_child(title)

	v.add_child(_field_label(str(s.get("slip_payee", "Pay to"))))
	_payee = OptionButton.new()
	for p in PAYEES:
		_payee.add_item("%s  %s" % [p[0], GameState.short_address(p[1])])
	_payee.add_item(str(s.get("slip_other", "Other address…")))
	_payee.item_selected.connect(func(i: int) -> void:
		_address.editable = i >= PAYEES.size()
		if i < PAYEES.size():
			_address.text = PAYEES[i][1])
	_payee.add_theme_font_size_override("font_size", 17)
	v.add_child(_payee)
	_address = LineEdit.new()
	_address.text = PAYEES[0][1]
	_address.editable = false
	_address.add_theme_font_size_override("font_size", 15)
	v.add_child(_address)
	_name_toggle = CheckButton.new()
	_name_toggle.text = str(s.get("slip_name_toggle", "Pay by ENS name"))
	_name_toggle.add_theme_font_size_override("font_size", 16)
	_name_toggle.toggled.connect(_toggle_name)
	v.add_child(_name_toggle)
	_name_edit = LineEdit.new()
	_name_edit.placeholder_text = str(s.get("slip_name_placeholder", "alice.branchzero.eth"))
	_name_edit.add_theme_font_size_override("font_size", 17)
	_name_edit.visible = false
	_name_edit.text_submitted.connect(func(_t: String) -> void:
		_submit())
	v.add_child(_name_edit)

	v.add_child(_field_label(Dialogue.interpolate(str(s.get("slip_amount", "Amount ({symbol})")), GameState.vars())))
	_amount = LineEdit.new()
	_amount.text = "12.5"
	_amount.add_theme_font_size_override("font_size", 17)
	_amount.text_submitted.connect(func(_t: String) -> void:
		_submit())
	v.add_child(_amount)

	v.add_child(_field_label(str(s.get("slip_memo", "Memo"))))
	_memo = LineEdit.new()
	_memo.text = str(s.get("slip_memo_default", "flowers"))
	_memo.add_theme_font_size_override("font_size", 17)
	_memo.text_submitted.connect(func(_t: String) -> void:
		_submit())
	v.add_child(_memo)

	_hint = Label.new()
	_hint.add_theme_font_size_override("font_size", 15)
	_hint.add_theme_color_override("font_color", Color(0.35, 0.3, 0.2))
	_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_hint)

	_error = Label.new()
	_error.add_theme_font_size_override("font_size", 15)
	_error.add_theme_color_override("font_color", Color(0.7, 0.1, 0.1))
	_error.visible = false
	v.add_child(_error)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	v.add_child(row)
	var ok := Button.new()
	ok.text = str(s.get("slip_submit", "Hand it to the teller"))
	ok.add_theme_font_size_override("font_size", 17)
	ok.pressed.connect(_submit)
	row.add_child(ok)
	var cancel := Button.new()
	cancel.text = str(s.get("slip_cancel", "Never mind"))
	cancel.add_theme_font_size_override("font_size", 17)
	cancel.pressed.connect(func() -> void:
		visible = false
		Dialogue.cancel_form())
	row.add_child(cancel)

	Dialogue.form_requested.connect(func(kind: String, _ctx: Dictionary) -> void:
		if kind == "payment_slip":
			_open())


func _field_label(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 15)
	l.add_theme_color_override("font_color", Color(0.35, 0.3, 0.2))
	return l


func _open() -> void:
	_error.visible = false
	_name_toggle.button_pressed = false
	_name_edit.visible = false
	_payee.visible = true
	_address.visible = true
	_hint.text = Dialogue.interpolate(str(GameState.strings.get("slip_hint", "Up to {limit} {symbol} goes over the counter. More than that goes through the vault ({timelock} cooling).")), GameState.vars())
	visible = true
	_amount.grab_focus()


func _submit() -> void:
	var use_name := _name_toggle.button_pressed
	var to := _address.text.strip_edges()
	var ens_name := _name_edit.text.strip_edges()
	var amount := _amount.text.strip_edges()
	var s: Dictionary = GameState.strings
	if use_name and (ens_name == "" or not ens_name.to_lower().ends_with(".branchzero.eth") or ens_name.count(".") != 2):
		_error.text = str(s.get("slip_bad_name", "Write a full customer name, like alice.branchzero.eth."))
		_error.visible = true
		return
	if not use_name and not (to.begins_with("0x") and to.length() == 42):
		_error.text = str(s.get("slip_bad_address", "That is not an address the counter can pay."))
		_error.visible = true
		return
	if not amount.is_valid_float() or float(amount) <= 0.0:
		_error.text = str(s.get("slip_bad_amount", "Write the amount as a number, e.g. 12.5"))
		_error.visible = true
		return
	visible = false
	Dialogue.submit_form({"to": to, "name": ens_name if use_name else "", "amount": amount, "memo": _memo.text.strip_edges()})


func _toggle_name(enabled: bool) -> void:
	_payee.visible = not enabled
	_address.visible = not enabled
	_name_edit.visible = enabled
	if enabled:
		_name_edit.grab_focus()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		visible = false
		Dialogue.cancel_form()
		get_viewport().set_input_as_handled()
