extends Node
## Dialogue — runs `res://dialogue/<npc>.json` (docs/NPCS.md §3). No player-visible string lives in code.
##
## Format:
##   { "id", "name", "role",
##     "start": [ {"if": "<cond>", "node": "<id>"}, ... ],          first match wins; last entry may omit "if"
##     "nodes": { "<id>": {
##         "text": "..." | ["...", "..."],                          `{vars}` interpolated from GameState.vars()
##         "choices": [ {"text", "next" | "end", "if",
##                       "action", "args", "as", "working",        run through GameState.run_action
##                       "on_ok", "on_error", "escort"} ],
##         "choices_from": "pending" | "pending_released" | "pending_cooling",   one choice per wire, using
##         "choice_template": { ...same fields; text may use {txId} {amount} {payee} {release_in} {status} },
##         "form": "payment_slip", "on_instant": "<id>", "on_vault": "<id>",   open the slip; route by amount
##         "enter_action": {"action", "args", "working", "on_ok", "on_error", "escort"},   run on entry
##         "next": "<id>"                                                     shown as a single "Continue"
##     } } }
## Conditions: terms joined by `&&`; a term is `fact`, `!fact`, `fact>0`, `fact>=N`, `fact==N`, `fact!=N`.

signal opened(npc_id: String)
signal closed(npc_id: String)
signal node_changed(speaker: String, role: String, text: String, choices: Array)
signal working(npc_id: String, text: String)
signal action_finished(npc_id: String, ok: bool)
signal form_requested(kind: String, ctx: Dictionary)
signal form_closed()
signal escort_requested(npc_id: String, target: String)

const DIALOGUE_DIR := "res://dialogue/"

var active: bool = false
var npc_id: String = ""
var is_working: bool = false

var _cache: Dictionary = {}
var _data: Dictionary = {}
var _node_id: String = ""
var _choices: Array = []        # resolved choice dictionaries shown to the player
var _ctx: Dictionary = {}       # txId, payee, amount, reason_line, reason_why, ...
var _pending_form: Dictionary = {}


func _ready() -> void:
	GameState.stage.connect(_on_stage)


func load_npc(id: String) -> Dictionary:
	if _cache.has(id):
		return _cache[id]
	var path := DIALOGUE_DIR + id + ".json"
	if not FileAccess.file_exists(path):
		push_error("Dialogue: no script for %s" % id)
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (parsed is Dictionary):
		push_error("Dialogue: %s is not a JSON object" % path)
		return {}
	_cache[id] = parsed
	return parsed


func start(id: String) -> void:
	if active or GameState.busy:
		return
	_data = load_npc(id)
	if _data.is_empty():
		return
	npc_id = id
	active = true
	_ctx = {}
	GameState.ui_locked = true
	opened.emit(id)
	_goto(pick_start(_data, GameState.facts()))


func close() -> void:
	if not active:
		return
	active = false
	is_working = false
	GameState.ui_locked = false
	var id := npc_id
	npc_id = ""
	closed.emit(id)


func choose(index: int) -> void:
	if not active or is_working or index < 0 or index >= _choices.size():
		return
	var c: Dictionary = _choices[index]
	if c.has("form"):
		_pending_form = c
		form_requested.emit(str(c["form"]), _ctx.duplicate())
		return
	if c.has("action"):
		await _run(c)
		return
	_goto(str(c.get("next", "end")))


## The payment slip came back. Route by the branch's instant limit (an off-chain policy the Teller Desk also
## enforces — docs/REFLECTION.md §2.2); the actual call is still the node's action.
func submit_form(values: Dictionary) -> void:
	form_closed.emit()
	if not active or _pending_form.is_empty():
		return
	var c := _pending_form
	_pending_form = {}
	_ctx["payee"] = GameState.short_address(str(values.get("to", "")))
	_ctx["to"] = str(values.get("to", ""))
	_ctx["amount"] = GameState.fmt_amount(str(values.get("amount", "0")))
	_ctx["memo"] = str(values.get("memo", ""))
	var amount := float(str(values.get("amount", "0")))
	var target := str(c.get("on_instant", "end")) if amount <= GameState.instant_limit() else str(c.get("on_vault", "end"))
	_goto(target)


func cancel_form() -> void:
	form_closed.emit()
	_pending_form = {}
	if active:
		_goto(_node_id)


# ---------------------------------------------------------------- internals

func _goto(id: String) -> void:
	if id == "end" or id == "":
		close()
		return
	var nodes: Dictionary = _data.get("nodes", {})
	if not nodes.has(id):
		push_error("Dialogue: %s has no node %s" % [npc_id, id])
		close()
		return
	_node_id = id
	var node: Dictionary = nodes[id]
	if node.has("enter_action"):
		_show(node, [])
		await _run(node["enter_action"])
		return
	_choices = _resolve_choices(node)
	_show(node, _choices)


func _show(node: Dictionary, choices: Array) -> void:
	var text: Variant = node.get("text", "")
	if text is Array:
		text = "\n".join(PackedStringArray(text))
	var labels: Array = []
	for c in choices:
		labels.append(interpolate(str(c.get("text", "…")), GameState.vars(_ctx)))
	node_changed.emit(str(_data.get("name", npc_id)), str(_data.get("role", "")), interpolate(str(text), GameState.vars(_ctx)), labels)


func _resolve_choices(node: Dictionary) -> Array:
	var out: Array = []
	var facts := GameState.facts()
	if node.has("choices_from"):
		var tpl: Dictionary = node.get("choice_template", {})
		for w in _wires_for(str(node["choices_from"])):
			var c := tpl.duplicate(true)
			var wv := _wire_vars(w)
			c["text"] = interpolate(str(tpl.get("text", "#{txId}")), GameState.vars(wv))
			var args: Dictionary = c.get("args", {}).duplicate()
			args["txId"] = str(w.get("txId", ""))
			c["args"] = args
			c["ctx"] = wv
			out.append(c)
	for c in node.get("choices", []):
		if c.has("if") and not eval_condition(str(c["if"]), facts):
			continue
		out.append(c)
	if node.has("next") and out.is_empty():
		out.append({"text": str(GameState.strings.get("continue", "Continue")), "next": node["next"]})
	return out


func _wires_for(which: String) -> Array:
	var out: Array = []
	for w in GameState.wires:
		var rem: int = GameState.remaining(w)
		if which == "pending_released" and rem > 0:
			continue
		if which == "pending_cooling" and rem <= 0:
			continue
		out.append(w)
	return out


func _wire_vars(w: Dictionary) -> Dictionary:
	var rem: int = GameState.remaining(w)
	return {
		"txId": str(w.get("txId", "")),
		"amount": GameState.fmt_amount(w.get("amount", "?")),
		"payee": GameState.short_address(str(w.get("to", "?"))),
		"release_in": GameState.fmt_duration(rem),
		"status": "ready" if rem <= 0 else "cooling",
	}


## Run a choice's action through GameState. Progress text comes from real stage events only.
func _run(c: Dictionary) -> void:
	is_working = true
	if c.has("ctx"):
		_ctx.merge(c["ctx"], true)
	var args: Dictionary = c.get("args", {}).duplicate()
	for k in ["to", "amount", "memo", "txId"]:
		if not args.has(k) and _ctx.has(k):
			args[k] = _ctx[k]
	var action := str(c.get("action", ""))
	if c.get("as", "") == "manager" and (action == "approve" or action == "cancel"):
		action = "manager_" + action
	working.emit(npc_id, interpolate(str(c.get("working", GameState.strings.get("working", "One moment…"))), GameState.vars(_ctx)))
	var r: Dictionary = await GameState.run_action(action, args)
	is_working = false
	if not active:
		return
	var ok := bool(r.get("ok", false))
	if ok:
		var res = r.get("result", {})
		if res is Dictionary:
			for k in ["txId", "hash", "releaseTime", "account", "balanceAfter", "status"]:
				if res.has(k) and res[k] != null:
					_ctx[k] = str(res[k])
			if res.has("releaseTime") and res["releaseTime"] != null:
				_ctx["release_in"] = GameState.fmt_duration(int(str(res["releaseTime"])) - GameState.now())
	else:
		var err: Dictionary = r.get("error", {})
		_ctx["reason_line"] = GameState.error_line(err, _ctx)
		_ctx["reason_why"] = GameState.error_why(err)
		_ctx["reason_code"] = str(err.get("code", "Unknown"))
	action_finished.emit(npc_id, ok)
	if ok and c.has("escort"):
		escort_requested.emit(npc_id, str(c["escort"]))
	_goto(str(c.get("on_ok", c.get("next", "end"))) if ok else str(c.get("on_error", "refused")))


func _on_stage(ev: Dictionary) -> void:
	if active and is_working and ev.has("bankLine"):
		working.emit(npc_id, str(ev["bankLine"]))


# ---------------------------------------------------------------- pure helpers (unit-tested in tests/run_checks.gd)

static func pick_start(data: Dictionary, facts: Dictionary) -> String:
	for entry in data.get("start", []):
		if not entry.has("if") or eval_condition(str(entry["if"]), facts):
			return str(entry.get("node", "end"))
	return "end"


static func eval_condition(expr: String, facts: Dictionary) -> bool:
	for raw in expr.split("&&"):
		var term := raw.strip_edges()
		if term == "":
			continue
		if not _eval_term(term, facts):
			return false
	return true


static func _eval_term(term: String, facts: Dictionary) -> bool:
	for op in [">=", "<=", "==", "!=", ">", "<"]:
		var i := term.find(op)
		if i > 0:
			var lhs := _fact_num(facts, term.substr(0, i).strip_edges())
			var rhs := float(term.substr(i + op.length()).strip_edges())
			match op:
				">=": return lhs >= rhs
				"<=": return lhs <= rhs
				"==": return lhs == rhs
				"!=": return lhs != rhs
				">": return lhs > rhs
				"<": return lhs < rhs
	if term.begins_with("!"):
		return not _truthy(facts.get(term.substr(1).strip_edges(), false))
	return _truthy(facts.get(term, false))


static func _fact_num(facts: Dictionary, key: String) -> float:
	var v = facts.get(key, 0)
	if v is bool:
		return 1.0 if v else 0.0
	return float(v)


static func _truthy(v: Variant) -> bool:
	if v is bool:
		return v
	if v is int or v is float:
		return v != 0
	if v is String:
		return v != ""
	return v != null


## Replace `{key}` with vars[key]; unknown keys are left visible so a missing var is caught in review.
static func interpolate(text: String, vars: Dictionary) -> String:
	var out := text
	for k in vars.keys():
		out = out.replace("{%s}" % k, str(vars[k]))
	return out
