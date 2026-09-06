extends Node3D
## U0 cube scene: proves the Godot 4.5 single-threaded web build can round-trip JSON with window.BranchZero (K1)
## and show an AccountBlox owner() read that the TS bridge made through @bloxchain/sdk on Remote EVM (K4 via K1).

@onready var cube: MeshInstance3D = $Cube
@onready var status: Label = $UI/Status

var _lines: PackedStringArray = []


func _ready() -> void:
	Chain.event.connect(_on_chain_event)
	_log("Branch Zero U0 · Godot %s · %s" % [Engine.get_version_info().string, "web" if Chain.is_web else "desktop (MockChain)"])

	var echo := await Chain.call_async("echo", {"msg": "hello from Godot %s" % Engine.get_version_info().string})
	_log("K1 echo → %s" % JSON.stringify(echo))

	var chain := await Chain.call_async("chainInfo", {})
	_log("chainInfo → %s" % JSON.stringify(chain))

	var acct := await Chain.call_async("accountInfo", {})
	_log("accountInfo → %s" % JSON.stringify(acct))

	if echo.get("ok", false) and str(echo.get("result", {}).get("echo", "")).begins_with("hello from Godot"):
		_log("K1: PASS (JS echoed the message back through create_callback)")
	else:
		_log("K1: FAIL — see error above")


func _process(delta: float) -> void:
	cube.rotate_y(delta * 0.8)
	cube.rotate_x(delta * 0.3)


func _on_chain_event(kind: String, payload: Dictionary) -> void:
	_log("event %s %s" % [kind, JSON.stringify(payload)])


func _log(line: String) -> void:
	print(line)
	_lines.append(line)
	while _lines.size() > 10:
		_lines.remove_at(0)
	status.text = "\n".join(_lines)
