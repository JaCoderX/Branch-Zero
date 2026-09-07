class_name MockChain
extends Node
## MockChain — the same JSON API as window.BranchZero, answered from canned state with fake latency.
##
## Used on desktop (editor play) and on web behind `?mock`. It exists so the greybox, the NPC lines and the
## vault clock can be walked without an inbox; it proves nothing about the chain (docs/REMOTE-EVM.md §5).
## Every value is obviously fake: addresses start with 0xM0CK, the cooling period is 30 s, receipts are local.

const OWNER := "0xM0CK0000000000000000000000000000000000E7"
const ACCOUNT := "0xM0CK0000000000000000000000000000000ACC7"
const MANAGER := "0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d"
const TIMELOCK_SEC := 30
const INSTANT_LIMIT := "100"

var logged_in := false
var delegated := false
var account := ""
var balance := 0.0
var wires: Array = []        # PendingWire dictionaries (strings only, like the real bridge)
var receipts: Array = []     # Receipt dictionaries
var _next_tx_id := 1
var _job := 0


## `?mock=account`: start as a signed-in, delegated player with an open, funded account.
func preset_account() -> void:
	logged_in = true
	delegated = true
	account = ACCOUNT
	balance = 500.0


func call_method(method: String, args: Dictionary) -> Dictionary:
	await get_tree().create_timer(randf_range(0.25, 0.7)).timeout
	match method:
		"echo":
			return _ok({"echo": args.get("msg"), "bridge": "mock"})
		"getSession":
			return _ok(_session())
		"login":
			logged_in = true
			return _ok({"userId": "did:privy:mock", "owner": OWNER, "account": account if account != "" else null, "signingMode": "session" if delegated else "client", "delegated": delegated})
		"logout":
			logged_in = false
			delegated = false
			return _ok({"ok": true})
		"addSessionSigner":
			if not logged_in:
				return _err("AUTH", "not signed in")
			delegated = true
			return _ok({"ok": true})
		"removeSessionSigner":
			delegated = false
			return _ok({"ok": true})
		"provision":
			if not logged_in:
				return _err("AUTH", "not signed in")
			var job := _new_job()
			if account == "":
				_stage(job, "PROVISION", "provisioning", "Creating your account…")
				await get_tree().create_timer(0.8).timeout
				_stage(job, "PROVISION", "configuring", "Registering services and the payee list…")
				await get_tree().create_timer(0.8).timeout
				_stage(job, "PROVISION", "funding", "Putting 500 practice dollars in it…")
				await get_tree().create_timer(0.5).timeout
				account = ACCOUNT
				balance = 500.0
				_stage(job, "PROVISION", "mined", "Ready.", {"account": account})
			return _ok({"jobId": job, "account": account, "balance": _fmt(balance)})
		"getPassbook":
			return _ok(_status())
		"listPending":
			return _ok({"items": wires.duplicate(true), "serverNow": _now_str()})
		"getHistory":
			var limit := int(args.get("limit", 8))
			return _ok({"items": receipts.slice(max(0, receipts.size() - limit)), "serverNow": _now_str()})
		"pay":
			return await _pay(args)
		"wire":
			return await _wire(args)
		"approve":
			return await _decide(args, "approve")
		"cancel":
			return await _decide(args, "cancel")
		_:
			return _err("UNKNOWN_METHOD", "unknown bridge method %s" % method)


func _pay(args: Dictionary) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var amount := float(str(args.get("amount", "0")))
	if amount > float(INSTANT_LIMIT):
		return _err("POLICY", "over the %s instant limit — that is a wire: use /wire" % INSTANT_LIMIT)
	if not str(args.get("to", "")).begins_with("0x"):
		return _err("TargetNotWhitelisted", "payee refused by the guard")
	var job := _new_job()
	_stage(job, "A", "signing", "Stamping your slip…")
	await get_tree().create_timer(0.6).timeout
	if amount > balance:
		_stage(job, "A", "failed", "Not enough practice dollars in the account.", {"reason": "InsufficientBalance"})
		return _err("InsufficientBalance", "Insufficient balance: %s (required: %s)" % [_fmt(balance), _fmt(amount)])
	_stage(job, "A", "broadcasting", "Taking it to the counter…")
	await get_tree().create_timer(0.6).timeout
	balance -= amount
	var tx_id := _next_tx_id
	_next_tx_id += 1
	_stage(job, "A", "mined", "Paid %s dUSDC." % _fmt(amount), {"hash": _hash(), "txId": str(tx_id), "amount": _fmt(amount)})
	return _ok({"jobId": job, "hash": _hash(), "txId": str(tx_id), "to": args.get("to"), "amount": _fmt(amount), "balanceAfter": _fmt(balance)})


func _wire(args: Dictionary) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var amount := float(str(args.get("amount", "0")))
	var job := _new_job()
	_stage(job, "B", "signing", "Filing your wire with the vault…")
	await get_tree().create_timer(0.7).timeout
	var tx_id := _next_tx_id
	_next_tx_id += 1
	var release := _now() + TIMELOCK_SEC
	var rec := {
		"txId": str(tx_id), "status": "PENDING", "releaseTime": str(release), "released": false,
		"to": str(args.get("to", "")), "amount": _fmt(amount), "requester": OWNER,
	}
	wires.append(rec)
	_stage(job, "B", "pending", "Wire of %s dUSDC is in the vault. The clock is running." % _fmt(amount), {"hash": _hash(), "txId": str(tx_id), "releaseTime": str(release), "chainNow": str(_now() - 47), "status": "PENDING"})
	_watch(tx_id, job)
	return _ok({"jobId": job, "hash": _hash(), "txId": str(tx_id), "to": rec["to"], "amount": rec["amount"], "releaseTime": str(release), "chainNow": str(_now() - 47), "serverNow": _now_str(), "status": "PENDING"})


func _decide(args: Dictionary, kind: String) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var tx_id := str(args.get("txId", ""))
	var idx := _find(tx_id)
	if idx < 0:
		return _err("NOT_PENDING", "record %s is not PENDING" % tx_id)
	var rec: Dictionary = wires[idx]
	var job := _new_job()
	var actor := "manager" if str(args.get("as", "owner")) == "manager" else "owner"
	var who := "The manager is" if actor == "manager" else "You are"
	_stage(job, "B", "signing", ("%s opening the vault…" if kind == "approve" else "%s recalling the wire…") % who, {"txId": tx_id, "releaseTime": rec["releaseTime"]})
	await get_tree().create_timer(0.6).timeout
	if kind == "approve" and int(rec["releaseTime"]) > _now():
		_stage(job, "B", "failed", "Still cooling — the vault clock has not run down yet.", {"txId": tx_id, "reason": "BeforeReleaseTime", "releaseTime": rec["releaseTime"]})
		return _err("BeforeReleaseTime", "BeforeReleaseTime: Current time is before release time", {"releaseTime": rec["releaseTime"]})
	wires.remove_at(idx)
	if kind == "approve":
		balance -= float(rec["amount"])
		_stage(job, "B", "mined", "Wire released: %s dUSDC sent." % rec["amount"], {"hash": _hash(), "txId": tx_id, "status": "COMPLETED"})
		return _ok({"jobId": job, "hash": _hash(), "txId": tx_id, "status": "COMPLETED", "actor": actor, "balanceAfter": _fmt(balance)})
	_stage(job, "B", "cancelled", "Wire recalled. Nothing left the vault.", {"hash": _hash(), "txId": tx_id, "status": "CANCELLED"})
	return _ok({"jobId": job, "hash": _hash(), "txId": tx_id, "status": "CANCELLED", "actor": actor})


## Mirror of the Teller Desk watcher: a `released` tick once the mock clock passes releaseTime.
func _watch(tx_id: int, job: String) -> void:
	var announced := false
	while _find(str(tx_id)) >= 0:
		await get_tree().create_timer(2.0).timeout
		var idx := _find(str(tx_id))
		if idx < 0:
			return
		var rec: Dictionary = wires[idx]
		var released := int(rec["releaseTime"]) <= _now()
		if released and not announced:
			announced = true
			rec["released"] = true
			_stage(job, "B", "released", "The vault clock has run down. The wire may be released.", {"txId": str(tx_id), "releaseTime": rec["releaseTime"], "status": "PENDING"})
		elif not released:
			_stage(job, "B", "pending", "The vault clock is running.", {"txId": str(tx_id), "releaseTime": rec["releaseTime"], "status": "PENDING"})


func _session() -> Dictionary:
	if not logged_in:
		return {"loggedIn": false, "ready": true}
	return {
		"loggedIn": true, "ready": true, "userId": "did:privy:mock", "owner": OWNER,
		"account": account if account != "" else null, "delegated": delegated,
		"signingMode": "session" if delegated else "client", "chainId": 1337,
		"timeLockSec": TIMELOCK_SEC, "instantLimit": INSTANT_LIMIT, "manager": MANAGER,
		"token": {"address": "0xM0CK00000000000000000000000000000000dUSD", "symbol": "dUSDC", "decimals": 18},
	}


func _status() -> Dictionary:
	for w in wires:
		w["released"] = int(w["releaseTime"]) <= _now()
	return {
		"owner": OWNER, "chainId": 1337, "signingMode": "session" if delegated else "client",
		"account": account if account != "" else null, "balance": _fmt(balance), "symbol": "dUSDC",
		"pending": wires.size(), "wires": wires.duplicate(true), "serverNow": _now_str(),
		"timeLockSec": TIMELOCK_SEC, "receipts": receipts.duplicate(true),
	}


func _stage(job: String, lane: String, stage: String, bank_line: String, extra: Dictionary = {}) -> void:
	var ev := {"type": "stage", "jobId": job, "lane": lane, "stage": stage, "bankLine": bank_line, "serverNow": _now_str()}
	ev.merge(extra, true)
	var idx := -1
	for i in receipts.size():
		if receipts[i]["jobId"] == job:
			idx = i
	var prev: Dictionary = receipts[idx] if idx >= 0 else {"jobId": job, "lane": lane}
	var rec := prev.duplicate()
	rec["stage"] = stage
	for k in ["hash", "txId", "reason", "releaseTime", "amount"]:
		if extra.has(k):
			rec[k] = extra[k]
	rec["updatedAt"] = int(Time.get_unix_time_from_system() * 1000.0)
	if idx >= 0:
		receipts[idx] = rec
	else:
		receipts.append(rec)
	if receipts.size() > 25:
		receipts.remove_at(0)
	Chain.emit_event("stage", ev)


func _find(tx_id: String) -> int:
	for i in wires.size():
		if str(wires[i]["txId"]) == tx_id:
			return i
	return -1


func _new_job() -> String:
	_job += 1
	return "mock-%03d" % _job


func _ok(result: Variant) -> Dictionary:
	return {"ok": true, "result": result}


func _err(code: String, message: String, extra: Dictionary = {}) -> Dictionary:
	var e := {"code": code, "message": message}
	e.merge(extra, true)
	return {"ok": false, "result": {}, "error": e}


func _now() -> int:
	return int(Time.get_unix_time_from_system())


func _now_str() -> String:
	return str(_now())


func _fmt(v: float) -> String:
	var s := "%.2f" % v
	if s.ends_with(".00"):
		return s.substr(0, s.length() - 3)
	return s


func _hash() -> String:
	return "0xm0ck%056x" % (randi() % 1000000)
