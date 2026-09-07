extends Node
## GameState — the game's mirror of what the bridge has told it. Dialogue conditions read this; nothing in a
## scene script calls Chain directly except through `run_action` here.
##
## Rules it keeps (docs/GODOT.md §5): release times are the chain's `releaseTime` (strings in `wires`), the
## countdown runs against the Teller Desk clock (`serverNow` → `clock_offset`), never against `chainNow`;
## the pending list is reconciled with `listPending` on tab focus; stage events are relayed, never invented.

signal changed()                       # any state change worth re-rendering
signal stage(ev: Dictionary)           # a Teller Desk stage event (relayed from Chain)
signal toast(text: String, kind: String)
signal zone_changed(zone: String)

const ERRORS_PATH := "res://dialogue/errors.json"
const STRINGS_PATH := "res://dialogue/strings.json"

var booted: bool = false
var session: Dictionary = {}           # DeskSession as the bridge returns it
var balance: String = "0"
var symbol: String = "dUSDC"
var wires: Array = []                  # PendingWire dictionaries, strings only
var receipts: Array = []               # Teller Desk receipts (last few)
var ens_names: Array = []              # Recent ENSv2 customer claims for Petra's wall board
var clock_offset: float = 0.0          # serverNow - local wall clock, seconds
var last_stage: Dictionary = {}
var busy: bool = false
var ui_locked: bool = false            # dialogue / form open → player does not move
var current_zone: String = ""
var desk_linked: bool = true        # Teller Desk SSE stream up (bridge `desk.link`); false while reconnecting
var errors: Dictionary = {}
var strings: Dictionary = {}

var _reconcile_at: float = 0.0
var _last_error: Dictionary = {}


func _ready() -> void:
	_setup_controls()
	errors = _load_json(ERRORS_PATH)
	strings = _load_json(STRINGS_PATH)
	Chain.event.connect(_on_chain_event)
	boot()


## First contact with the desk: wait for the bridge, ask who is standing there (no modal), read the passbook.
func boot() -> void:
	var t0 := Time.get_ticks_msec()
	await Chain.wait_ready(4.0)
	var t1 := Time.get_ticks_msec()
	await refresh_session()
	if logged_in():
		await refresh_passbook()
	booted = true
	# Read the board after the bridge/session boot is complete. Anonymous users still get a silent board read,
	# while a real adapter can no longer race its initial ready event here.
	await refresh_names()
	print("GameState: booted — bridge ready after %d ms, session after %d ms (%s)" % [t1 - t0, Time.get_ticks_msec() - t1, "MockChain" if Chain.use_mock else "bridge " + Chain.bridge_version])
	changed.emit()


# ---------------------------------------------------------------- facts

func logged_in() -> bool:
	return bool(session.get("loggedIn", false))


func has_account() -> bool:
	return logged_in() and session.get("account") != null and str(session.get("account", "")) != ""


func has_ens_name() -> bool:
	return str(session.get("ensName", "")) != "" or not ens_names_for_owner().is_empty()


func ens_name() -> String:
	var direct := str(session.get("ensName", ""))
	if direct != "":
		return direct
	var mine := ens_names_for_owner()
	return str(mine[0].get("name", "")) if not mine.is_empty() else ""


func ens_names_for_owner() -> Array:
	var out: Array = []
	var owner_id := owner().to_lower()
	for row in ens_names:
		if str(row.get("owner", "")).to_lower() == owner_id or str(row.get("address", "")).to_lower() == account().to_lower():
			out.append(row)
	return out


func delegated() -> bool:
	return bool(session.get("delegated", false))


func has_manager() -> bool:
	return session.get("manager") != null and str(session.get("manager", "")) != ""


## U4+: the branch runs the Priority desk and this account carries the META_APPROVE split (ROLE_SET 3). When false
## the manager can still shred, but nobody skips the cooling (vault-only, or Ines has to re-check the file).
func priority_enabled() -> bool:
	return has_manager() and bool(session.get("priority", false))


func account() -> String:
	return str(session.get("account", "")) if has_account() else ""


func owner() -> String:
	return str(session.get("owner", ""))


func active_chain_id() -> int:
	return int(session.get("chainId", 1337))


func active_wing() -> String:
	return "arc" if active_chain_id() == 5042002 else "main"


func switch_wing(chain_id: int) -> Dictionary:
	return await run_action("switch_wing", {"chainId": chain_id})


func instant_limit() -> float:
	return float(str(session.get("instantLimit", "100")))


func timelock_sec() -> int:
	return int(session.get("timeLockSec", 120))


func pending_count() -> int:
	return wires.size()


func released_count() -> int:
	var n := 0
	for w in wires:
		if remaining(w) <= 0:
			n += 1
	return n


func cooling_count() -> int:
	return pending_count() - released_count()


## Desk-corrected wall clock, unix seconds.
func now() -> int:
	return int(Time.get_unix_time_from_system() + clock_offset)


## Seconds until a record's chain `releaseTime`, counted against the desk clock. Negative once released.
func remaining(w: Dictionary) -> int:
	return int(str(w.get("releaseTime", "0"))) - now()


## The soonest pending release, or 0 when nothing is cooling.
func soonest_remaining() -> int:
	var best := -1
	for w in wires:
		var r := remaining(w)
		if r > 0 and (best < 0 or r < best):
			best = r
	return max(best, 0)


func wire_by_id(tx_id: String) -> Dictionary:
	for w in wires:
		if str(w.get("txId", "")) == tx_id:
			return w
	return {}


static func fmt_duration(sec: int) -> String:
	var s: int = max(sec, 0)
	return "%d:%02d" % [s / 60, s % 60]


static func short_address(a: String) -> String:
	if a.length() < 12:
		return a
	return "%s…%s" % [a.substr(0, 6), a.substr(a.length() - 4)]


func fmt_amount(v: Variant) -> String:
	var s := str(v)
	if s == "" or s == "<null>":
		return "?"
	if s.find(".") >= 0:
		s = s.rstrip("0").rstrip(".")
	return s


## Facts the dialogue conditions may test (docs/NPCS.md §3).
func facts() -> Dictionary:
	return {
		"booted": booted,
		"logged_in": logged_in(),
		"has_account": has_account(),
		"delegated": delegated(),
		"manager": has_manager(),
		"priority": priority_enabled(),
		"pending": pending_count(),
		"released": released_count(),
		"cooling": cooling_count(),
		"busy": busy,
		"desk_linked": desk_linked,
		"ens_name": ens_name(),
		"mock": Chain.use_mock,
		"web": Chain.is_web,
		"arc": active_wing() == "arc",
	}


## `{vars}` the dialogue text may interpolate.
func vars(extra: Dictionary = {}) -> Dictionary:
	var v := {
		"name": short_address(owner()) if logged_in() else "friend",
		"short_address": short_address(account()),
		"balance": fmt_amount(balance),
		"symbol": symbol,
		"limit": fmt_amount(str(session.get("instantLimit", "100"))),
		"timelock": fmt_duration(timelock_sec()),
		"timelock_sec": str(timelock_sec()),
		"pending": str(pending_count()),
		"released": str(released_count()),
		"cooling": str(cooling_count()),
		"release_in": fmt_duration(soonest_remaining()),
		"wing": active_wing(),
		"chain": ("Arc Testnet 5042002" if active_wing() == "arc" else "Remote EVM 1337") if not Chain.use_mock else "MockChain",
		"manager_name": "Mr. Okafor",
		"priority_copy": str(strings.get("priority_copy", "Skip the cooling period — hand scan required.")),
		"ens_name": ens_name() if has_ens_name() else "no name yet",
	}
	v.merge(extra, true)
	return v


# ---------------------------------------------------------------- reads

func refresh_session() -> void:
	var r := await Chain.call_async("getSession", {}, 20.0)
	if r.get("ok", false) and r.get("result") is Dictionary:
		session = r["result"]
		if not logged_in():
			balance = "0"
			wires = []
			receipts = []
	else:
		session = {"loggedIn": false, "ready": false}
		_note_error(r.get("error", {}))
	changed.emit()


## The Name Desk board is backed by the customers UserRegistry's recent registration events.
func refresh_names() -> void:
	var r := await Chain.call_async("ensAvailable", {}, 20.0)
	if not r.get("ok", false):
		# A board read must not make Account Opening or the existing bank lanes unusable.
		return
	var result: Dictionary = r.get("result", {})
	if result.get("recent") is Array:
		ens_names = result["recent"]
	changed.emit()


## `/status` in one read: balance, pending wires (with the chain's releaseTime), receipts, serverNow.
func refresh_passbook() -> void:
	if not logged_in():
		return
	var r := await Chain.call_async("getPassbook", {}, 20.0)
	if not r.get("ok", false):
		_note_error(r.get("error", {}))
		return
	var st: Dictionary = r.get("result", {})
	balance = str(st.get("balance", balance))
	symbol = str(st.get("symbol", symbol))
	if st.get("wires") is Array:
		wires = st["wires"]
	if st.get("receipts") is Array:
		receipts = st["receipts"]
	_sync_clock(st.get("serverNow"))
	changed.emit()


## Tab regained focus: SSE kept running in JS, Godot's frame loop did not — re-read the pending list once.
func reconcile_pending(reason: String = "focus") -> void:
	if not has_account():
		return
	var t := Time.get_unix_time_from_system()
	if t - _reconcile_at < 2.0:
		return
	_reconcile_at = t
	var r := await Chain.call_async("listPending", {}, 20.0)
	if not r.get("ok", false):
		_note_error(r.get("error", {}))
		return
	var res: Dictionary = r.get("result", {})
	if res.get("items") is Array:
		wires = res["items"]
	_sync_clock(res.get("serverNow"))
	print("GameState: reconciled %d pending record(s) on %s" % [wires.size(), reason])
	changed.emit()


func refresh_all() -> void:
	await refresh_session()
	if logged_in():
		await refresh_passbook()


# ---------------------------------------------------------------- writes (every desk action lands here)

## Run one desk action through the bridge. Returns {"ok", "result", "error"}. Refreshes the mirror afterwards
## whatever the outcome (a refused approve still moved the clock; a provision changes the session).
## Vault verbs (U4+): `approve` = Bob (owner, after the clock) · `priority` = Okafor (hand scan, before the clock) ·
## `cancel` / `manager_cancel` = recall. There is no manager approve.
func run_action(action: String, args: Dictionary = {}) -> Dictionary:
	busy = true
	changed.emit()
	var r: Dictionary
	match action:
		"login":
			r = await Chain.call_async("login", {}, 600.0)            # a human types an OTP
		"delegate":
			r = await Chain.call_async("addSessionSigner", {}, 300.0)  # the one consent
		"revoke":
			r = await Chain.call_async("removeSessionSigner", {}, 60.0)
		"logout":
			r = await Chain.call_async("logout", {}, 30.0)
		"switch_wing":
			var target_chain := int(args.get("chainId", 1337))
			if target_chain != 1337 and target_chain != 5042002:
				r = {"ok": false, "error": {"code": "BAD_ARGS", "message": "the elevator only serves Main 1337 and Arc 5042002"}}
			else:
				r = await Chain.call_async("switchWing", {"chainId": target_chain}, 60.0)
		"provision":
			r = await Chain.call_async("provision", {}, 300.0)         # clone + config batches + funding
		"ens_available":
			r = await Chain.call_async("ensAvailable", {"label": args.get("label", "")}, 20.0)
		"ens_mint":
			r = await Chain.call_async("ensMint", {"label": str(args.get("label", ""))}, 180.0)
		"ens_set_text":
			r = await Chain.call_async("ensSetText", {"name": str(args.get("name", ens_name())), "key": str(args.get("key", "bz.tier")), "value": str(args.get("value", "Silver"))}, 120.0)
		"resolve_name":
			r = await Chain.call_async("resolveName", {"name": str(args.get("name", ""))}, 20.0)
		"pay":
			r = await _run_payment_lane("pay", args)
		"wire":
			r = await _run_payment_lane("wire", args)
		"approve":
			# Bob's wait path — the owner's timed release after the clock, silent. Never the manager (U4+).
			r = await Chain.call_async("approve", {"txId": str(args.get("txId", "")), "as": "owner"}, 120.0)
		"manager_approve":
			# Okafor's post-clock stamp was removed in U4+ (ROLE_SET 3). Kept as a refusal so a stale dialogue line
			# gets his bank line instead of a chain revert.
			r = {"ok": false, "error": {"code": "MANAGER_NO_STAMP", "message": "the manager does not stamp vault releases (U4+); use priority before the clock or Bob after it"}}
		"priority":
			# Okafor's Priority release: the one call that may open a second Privy surface (Passkey + sign sheet).
			# A human scans a hand, so the timeout is generous, like login.
			r = await Chain.call_async("priority", {"txId": str(args.get("txId", ""))}, 300.0)
		"cancel", "manager_cancel":
			r = await Chain.call_async("cancel", {"txId": str(args.get("txId", "")), "as": "manager" if action.begins_with("manager") else "owner"}, 120.0)
		"refresh":
			r = {"ok": true, "result": {}}
		_:
			r = {"ok": false, "error": {"code": "UNKNOWN_METHOD", "message": "no desk action named %s" % action}}
	if not r.get("ok", false):
		_note_error(r.get("error", {}))
	await refresh_all()
	if action.begins_with("ens"):
		await refresh_names()
	busy = false
	changed.emit()
	return r


## Pay-by-name is a resolve step followed by the unchanged Remote EVM Lane A/B call.
## The resolved address is never sent to Godot from a scene script; it stays inside this action boundary.
func _run_payment_lane(lane: String, args: Dictionary) -> Dictionary:
	var to := str(args.get("to", ""))
	var name := str(args.get("name", "")).strip_edges()
	if name != "":
		var resolved := await Chain.call_async("resolveName", {"name": name}, 20.0)
		if not resolved.get("ok", false):
			return resolved
		var target: Dictionary = resolved.get("result", {})
		to = str(target.get("address", ""))
	var method_args := {"to": to, "amount": str(args.get("amount", "")), "memo": args.get("memo", "")}
	return await Chain.call_async(lane, method_args, 120.0)


# ---------------------------------------------------------------- errors → NPC lines (docs/NPCS.md §5)

## The bank line for an error code, with `{release_in}` filled from the record the error names when it can.
func error_line(err: Dictionary, ctx: Dictionary = {}) -> String:
	var entry := error_entry(err)
	var extra := ctx.duplicate()
	if err.has("releaseTime"):
		extra["release_in"] = fmt_duration(int(str(err["releaseTime"])) - now())
	elif ctx.has("txId") and not wire_by_id(str(ctx["txId"])).is_empty():
		extra["release_in"] = fmt_duration(remaining(wire_by_id(str(ctx["txId"]))))
	return Dialogue.interpolate(str(entry.get("line", "")), vars(extra))


## The "Ask why" half: the protocol explanation plus the raw code and message.
func error_why(err: Dictionary) -> String:
	var entry := error_entry(err)
	var code := str(err.get("code", "Unknown"))
	var msg := str(err.get("message", ""))
	return "%s\n[%s] %s" % [str(entry.get("why", "")), code, msg.substr(0, 220)]


func error_entry(err: Dictionary) -> Dictionary:
	var code := str(err.get("code", "Unknown"))
	if errors.has(code):
		return errors[code]
	# The Teller Desk reports a settled-but-wrong record as RECORD_<STATUS>.
	if code.begins_with("RECORD_") and errors.has("RECORD_*"):
		return errors["RECORD_*"]
	var d: Dictionary = errors.get("default", {"line": "Sorry — the counter could not do that.", "why": ""})
	if err.has("bankLine") and str(err["bankLine"]) != "":
		d = d.duplicate()
		d["line"] = str(err["bankLine"])
	return d


func last_error() -> Dictionary:
	return _last_error


func _note_error(err: Dictionary) -> void:
	_last_error = err
	if not err.is_empty():
		toast.emit(error_line(err), "error")


# ---------------------------------------------------------------- events

func _on_chain_event(kind: String, payload: Dictionary) -> void:
	match kind:
		"stage":
			_on_stage(payload)
		"tab.visible":
			if bool(payload.get("visible", false)):
				reconcile_pending("tab.visible")
		"desk.link":
			_on_desk_link(payload)
		"bridge.ready":
			pass


## The Teller Desk SSE stream came or went (U4). Both lines come from real link state: the shell pushes this
## only on a transition of its EventSource. On reconnect the server has re-read the vault and re-armed its
## watchers, so the board is reconciled once here as well.
func _on_desk_link(p: Dictionary) -> void:
	var connected := bool(p.get("connected", false))
	if connected == desk_linked:
		return
	desk_linked = connected
	if connected:
		toast.emit(str(strings.get("desk_link_back", "Back in touch with the branch.")), "info")
		reconcile_pending("desk reconnect")
	else:
		toast.emit(str(strings.get("desk_link_lost", "Lost the branch for a moment — reconnecting…")), "error")
	changed.emit()


## A Teller Desk stage event. The vault board is updated from what the event carries; the chain's
## `releaseTime` string is stored as-is, and `serverNow` corrects the local clock.
func _on_stage(ev: Dictionary) -> void:
	last_stage = ev
	_sync_clock(ev.get("serverNow"))
	var lane := str(ev.get("lane", ""))
	var st := str(ev.get("stage", ""))
	var tx_id := str(ev.get("txId", ""))
	if lane == "B" and tx_id != "":
		var idx := -1
		for i in wires.size():
			if str(wires[i].get("txId", "")) == tx_id:
				idx = i
		match st:
			"pending", "released":
				if idx < 0:
					wires.append({"txId": tx_id, "status": "PENDING", "releaseTime": str(ev.get("releaseTime", "0")), "released": st == "released", "requester": ""})
				else:
					if ev.has("releaseTime"):
						wires[idx]["releaseTime"] = str(ev["releaseTime"])
					wires[idx]["released"] = st == "released"
					wires[idx]["status"] = str(ev.get("status", "PENDING"))
			"mined", "cancelled", "failed":
				if idx >= 0 and st != "failed":
					wires.remove_at(idx)
				# a settled wire moves money or frees it; either way the passbook changed
				if st != "failed":
					refresh_passbook()
	elif lane == "A" and st == "mined":
		refresh_passbook()
	elif lane == "PROVISION" and st == "mined":
		refresh_all()
	stage.emit(ev)
	changed.emit()


func _sync_clock(server_now: Variant) -> void:
	if server_now == null:
		return
	var s := str(server_now)
	if s == "" or not s.is_valid_int():
		return
	clock_offset = float(int(s)) - Time.get_unix_time_from_system()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_IN or what == NOTIFICATION_WM_WINDOW_FOCUS_IN:
		if booted:
			reconcile_pending("window focus")


func set_zone(zone: String) -> void:
	if zone == current_zone:
		return
	current_zone = zone
	zone_changed.emit(zone)


# ---------------------------------------------------------------- helpers

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("GameState: missing %s" % path)
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		return parsed
	push_error("GameState: %s is not a JSON object" % path)
	return {}


## Input actions are declared here rather than in project.godot so the bindings are reviewable in one place.
func _setup_controls() -> void:
	_bind("move_forward", [KEY_W, KEY_UP])
	_bind("move_back", [KEY_S, KEY_DOWN])
	_bind("move_left", [KEY_A])
	_bind("move_right", [KEY_D])
	# U7 polish (principal playtest): Space is the only interact key; E orbits right to pair with Q (R is unbound).
	_bind("cam_left", [KEY_LEFT, KEY_Q])
	_bind("cam_right", [KEY_RIGHT, KEY_E])
	_bind("interact", [KEY_SPACE])
	_bind("debug_toggle", [KEY_F1])


## Both the physical and the logical key are bound: browsers (and automation) do not always send `code`,
## and Godot web maps that to `physical_keycode`, so a physical-only binding can be silently dead.
func _bind(action: String, keys: Array) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var phys := InputEventKey.new()
		phys.physical_keycode = k
		InputMap.action_add_event(action, phys)
		var logical := InputEventKey.new()
		logical.keycode = k
		InputMap.action_add_event(action, logical)
