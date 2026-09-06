extends Node
## Chain — the ONLY place in the game that touches JavaScriptBridge.
##
## Contract (docs/GODOT.md §4): `get_interface("BranchZero")` + `create_callback` + JSON strings. Never `eval`.
## Godot never holds keys and never talks to an RPC; the TS bridge in apps/web does the reads/writes.
##
## Two ways a call is answered:
##   - web + real bridge (the product): `request(method, argsJson, id)` → the response comes back through the
##     callback registered with `setGodotCallback`.
##   - MockChain (`autoload/mock_chain.gd`): on desktop (editor) always, and on web when the shell was opened
##     with `?mock` (announced in the `bridge.ready` payload). Canned data, fake latency, no Privy, no chain —
##     for walking the greybox, never for kill tests (docs/REMOTE-EVM.md §5).

signal event(kind: String, payload: Dictionary)
signal ready_changed()

const TIMEOUT_SEC := 15.0

var is_web: bool = false
var bridge_ready: bool = false
var bridge_version: String = ""
var use_mock: bool = false

var _bz: JavaScriptObject
var _cb: JavaScriptObject
var _pending: Dictionary = {}   # id -> true while awaiting
var _results: Dictionary = {}   # id -> response Dictionary
var _seq: int = 0
var _mock: MockChain


func _ready() -> void:
	is_web = OS.has_feature("web")
	_mock = MockChain.new()
	add_child(_mock)
	if not is_web:
		use_mock = true
		bridge_ready = true
		push_warning("Chain: not running on web — MockChain answers every call")
		return
	_bz = JavaScriptBridge.get_interface("BranchZero")
	if _bz == null:
		push_error("Chain: window.BranchZero is missing — load the game through the apps/web shell")
		use_mock = true
		bridge_ready = true
		return
	_cb = JavaScriptBridge.create_callback(_on_js_message)
	_bz.setGodotCallback(_cb)
	print("Chain: bridge interface acquired, callback registered")


## Wait until the bridge has said hello (or `max_sec` passed). GameState boots after this so the mock flag is known.
func wait_ready(max_sec: float = 3.0) -> void:
	var elapsed := 0.0
	while not bridge_ready and elapsed < max_sec:
		await get_tree().process_frame
		elapsed += get_process_delta_time()


## Ask the bridge. Returns the response Dictionary: {"ok": bool, "result": ..., "error": {code, message, bankLine?}}.
## `timeout_sec` is per call: sign-in waits for a human, provisioning waits for several transactions.
func call_async(method: String, args: Dictionary = {}, timeout_sec: float = TIMEOUT_SEC) -> Dictionary:
	_seq += 1
	var id := "%d-%d" % [_seq, Time.get_ticks_msec()]
	if use_mock or _bz == null:
		return await _mock.call_method(method, args)
	_pending[id] = true
	_bz.request(method, JSON.stringify(args), id)
	var elapsed := 0.0
	while _pending.has(id) and elapsed < timeout_sec:
		await get_tree().process_frame
		elapsed += get_process_delta_time()
	if _pending.has(id):
		_pending.erase(id)
		return {"ok": false, "error": {"code": "TIMEOUT", "message": "no response from bridge after %.0fs (%s)" % [timeout_sec, method]}}
	var r: Dictionary = _results[id]
	_results.erase(id)
	return r


## Used by MockChain to push its own stage events into the same signal the real bridge feeds.
func emit_event(kind: String, payload: Dictionary) -> void:
	event.emit(kind, payload)


## JS → Godot. `args[0]` is one JSON string: {"type":"response",...} or {"type":"event",...}.
func _on_js_message(args: Array) -> void:
	if args.is_empty():
		return
	var parsed = JSON.parse_string(str(args[0]))
	if not (parsed is Dictionary):
		push_warning("Chain: non-JSON message from bridge")
		return
	var msg: Dictionary = parsed
	match str(msg.get("type", "")):
		"response":
			var id := str(msg.get("id", ""))
			if _pending.has(id):
				_pending.erase(id)
				var r := {"ok": msg.get("ok", false), "result": msg.get("result", {})}
				if msg.has("error"):
					r["error"] = msg["error"]
				_results[id] = r
		"event":
			var kind := str(msg.get("kind", ""))
			var payload: Dictionary = msg.get("payload", {}) if msg.get("payload") is Dictionary else {}
			if kind == "bridge.ready":
				bridge_version = str(payload.get("version", ""))
				var mock: Variant = payload.get("mock", false)
				if (mock is bool and mock) or (mock is String and mock != ""):
					use_mock = true
					if str(mock) == "account":
						_mock.preset_account()
					print("Chain: shell asked for MockChain (?mock=%s) — no Privy, no chain" % str(mock))
				bridge_ready = true
				ready_changed.emit()
			event.emit(kind, payload)
		_:
			push_warning("Chain: unknown message type %s" % str(msg.get("type", "")))
