extends Node
## Chain — the ONLY place in the game that touches JavaScriptBridge.
##
## Contract (docs/GODOT.md §4): `get_interface("BranchZero")` + `create_callback` + JSON strings. Never `eval`.
## Godot never holds keys and never talks to an RPC; the TS bridge in apps/web does the reads/writes.
## On desktop (editor) there is no browser, so `call_async` answers with an obviously-fake mock payload.

signal event(kind: String, payload: Dictionary)

const TIMEOUT_SEC := 15.0

var is_web: bool = false
var bridge_ready: bool = false

var _bz: JavaScriptObject
var _cb: JavaScriptObject
var _pending: Dictionary = {}   # id -> true while awaiting
var _results: Dictionary = {}   # id -> response Dictionary
var _seq: int = 0


func _ready() -> void:
	is_web = OS.has_feature("web")
	if not is_web:
		push_warning("Chain: not running on web — MockChain answers every call")
		return
	_bz = JavaScriptBridge.get_interface("BranchZero")
	if _bz == null:
		push_error("Chain: window.BranchZero is missing — load the game through the apps/web shell")
		return
	_cb = JavaScriptBridge.create_callback(_on_js_message)
	_bz.setGodotCallback(_cb)
	print("Chain: bridge interface acquired, callback registered")


## Ask the bridge. Returns the response Dictionary: {"ok": bool, "result": ..., "error": {...}}.
func call_async(method: String, args: Dictionary = {}) -> Dictionary:
	_seq += 1
	var id := "%d-%d" % [_seq, Time.get_ticks_msec()]
	if not is_web or _bz == null:
		await get_tree().create_timer(0.15).timeout
		return {"ok": true, "result": {"mock": true, "method": method, "echo": args}}
	_pending[id] = true
	_bz.request(method, JSON.stringify(args), id)
	var elapsed := 0.0
	while _pending.has(id) and elapsed < TIMEOUT_SEC:
		await get_tree().process_frame
		elapsed += get_process_delta_time()
	if _pending.has(id):
		_pending.erase(id)
		return {"ok": false, "error": {"code": "TIMEOUT", "message": "no response from bridge after %.0fs" % TIMEOUT_SEC}}
	var r: Dictionary = _results[id]
	_results.erase(id)
	return r


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
			if kind == "bridge.ready":
				bridge_ready = true
			event.emit(kind, msg.get("payload", {}))
		_:
			push_warning("Chain: unknown message type %s" % str(msg.get("type", "")))
