extends SceneTree
## Headless walk of the iNPC's Godot half (docs/INPC.md, HANDOFF-inpc-openrouter §4–5). No browser, no OpenRouter —
## MockChain answers the desk; the shell is absent, so `open_inpc` must be refused honestly and lock nothing.
##
##   godot --headless --path apps/game -s tests/run_inpc_walk.gd
##
## Asserts: the snapshot is player-safe (whitelisted keys, no hashes / owner / account address / receipts / Live-Dev
## chrome); READY follows the chain's releaseTime and nothing else; the prop's dialogue only opens / sleeps the panel;
## the overlay lock mirrors `inpc.closed` the way the Console's does; staff dialogue never mentions the assistant.

var failures := 0

const SNAPSHOT_KEYS := ["schema", "desk_now_unix", "logged_in", "has_account", "wing", "network", "bank_name", "tier", "balance_display", "currency_note", "counter_limit_display", "cooling_period_display", "pending_count", "pending_wires", "viewing_wallets_count", "player_zone", "who_can_help"]
const WIRE_KEYS := ["slip", "amount_display", "payee_short", "status", "board_word", "release_ready", "cooling_left_display", "release_at_unix", "release_at_display"]


func _initialize() -> void:
	for spec in [["Chain", "res://autoload/chain.gd"], ["GameState", "res://autoload/game_state.gd"], ["Dialogue", "res://autoload/dialogue.gd"]]:
		var n: Node = load(spec[1]).new()
		n.name = spec[0]
		root.add_child(n)
	_run()


func _fail(msg: String) -> void:
	failures += 1
	print("  ✗ " + msg)


func _ok(msg: String) -> void:
	print("  ✓ " + msg)


func _run() -> void:
	var gs: Node = root.get_node("GameState")
	var dlg: Node = root.get_node("Dialogue")
	var chain: Node = root.get_node("Chain")
	while not gs.booted:
		await process_frame

	print("iNPC — snapshot before an account")
	var anon: Dictionary = gs.inpc_snapshot()
	if anon.get("has_account", true) or int(anon.get("pending_count", 1)) != 0 or str(anon.get("balance_display", "x")) != "":
		_fail("anonymous snapshot claims an account / balance / wires: %s" % JSON.stringify(anon))
	else:
		_ok("no account → has_account false, no balance, no wires, help names Ines: %s" % str(anon.get("who_can_help", [])))

	chain._mock.preset_account()
	await gs.refresh_all()
	var wire: Dictionary = await gs.run_action("wire", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "250", "memo": "flat"})
	if not wire.get("ok", false):
		_fail("mock wire refused: %s" % str(wire.get("error")))
		return _finish()
	var tx_id := str(wire["result"]["txId"])

	print("iNPC — snapshot with a PENDING wire")
	var snap: Dictionary = gs.inpc_snapshot()
	var keys := snap.keys()
	keys.sort()
	var want := SNAPSHOT_KEYS.duplicate()
	want.sort()
	if keys != want:
		_fail("snapshot keys drifted from the whitelist: %s" % str(keys))
	else:
		_ok("snapshot carries exactly the %d whitelisted fields" % want.size())
	var text := JSON.stringify(snap)
	var leaks: PackedStringArray = []
	for needle in [chain._mock.ACCOUNT.to_lower(), chain._mock.OWNER.to_lower(), "hash", "receipt", "developer mode", "desk_linked", "calldata", "privy", "0xm0ck"]:
		if text.to_lower().find(needle) >= 0:
			leaks.append(needle)
	var rx := RegEx.new()
	rx.compile("0x[0-9a-fA-F]{40,}")
	if rx.search(text) != null:
		leaks.append("a full 0x address/hash")
	if leaks.is_empty():
		_ok("no account/owner address, hash, receipt, Live/Dev or link chrome in the snapshot text")
	else:
		_fail("snapshot leaks %s: %s" % [str(leaks), text])
	if int(snap.get("pending_count", 0)) != 1 or (snap.get("pending_wires", []) as Array).size() != 1:
		_fail("expected exactly one pending wire in the snapshot: %s" % text)
		return _finish()
	var w: Dictionary = snap["pending_wires"][0]
	var wkeys := w.keys()
	wkeys.sort()
	var wwant := WIRE_KEYS.duplicate()
	wwant.sort()
	if wkeys != wwant:
		_fail("wire keys drifted from the whitelist: %s" % str(wkeys))
	if str(w.get("slip", "")) != "#" + tx_id or bool(w.get("release_ready", true)) or str(w.get("board_word", "")) != "PENDING" or str(w.get("status", "")) != "PENDING":
		_fail("cooling wire is not PENDING / not-ready in the snapshot: %s" % JSON.stringify(w))
	elif int(w.get("release_at_unix", 0)) <= int(snap.get("desk_now_unix", 0)) or str(w.get("cooling_left_display", "")) == "0:00":
		_fail("cooling wire's release_at is not in the desk's future: %s" % JSON.stringify(w))
	else:
		_ok("wire %s: PENDING, release_ready false, %s to go, releases at %s (desk clock), payee %s" % [w["slip"], w["cooling_left_display"], w["release_at_display"], w["payee_short"]])

	# READY comes from the chain's releaseTime and nothing else: move the mock record's clock into the past and re-read.
	for rec in chain._mock.wires:
		if str(rec.get("txId", "")) == tx_id:
			rec["releaseTime"] = str(gs.now() - 1)
	await gs.refresh_passbook()
	var ready_w: Dictionary = gs.inpc_snapshot()["pending_wires"][0]
	if not bool(ready_w.get("release_ready", false)) or str(ready_w.get("board_word", "")) != "READY" or str(ready_w.get("status", "")) != "PENDING":
		_fail("wire past its releaseTime is not READY (record still PENDING) in the snapshot: %s" % JSON.stringify(ready_w))
	else:
		_ok("after releaseTime: release_ready true, board_word READY, record status still PENDING (not COMPLETED)")

	print("iNPC — open without a shell")
	var opened: Dictionary = await gs.run_action("open_inpc", {})
	if opened.get("ok", false) or str(opened.get("error", {}).get("code", "")) != "INPC_UNAVAILABLE" or gs.inpc_open or gs.ui_locked:
		_fail("open_inpc without a shell should refuse INPC_UNAVAILABLE and lock nothing: %s open=%s locked=%s" % [str(opened), str(gs.inpc_open), str(gs.ui_locked)])
	else:
		var line: String = gs.error_line(opened["error"])
		if line.find("full bank window") < 0:
			_fail("INPC_UNAVAILABLE line does not say the panel needs the full bank window: %s" % line)
		else:
			_ok("MockChain refuses INPC_UNAVAILABLE → \"%s\"; inpc_open false, floor free" % line)

	print("iNPC — dialogue")
	var d: Dictionary = dlg.load_npc("inpc")
	var actions := {}
	for n in d.get("nodes", {}).values():
		for c in n.get("choices", []):
			if c.has("action"):
				actions[str(c["action"])] = true
	var akeys := actions.keys()
	akeys.sort()
	if akeys != ["open_inpc", "sleep_inpc"]:
		_fail("inpc.json runs %s — the assistant may only open its panel or forget the key" % str(akeys))
	else:
		_ok("inpc.json verbs: open_inpc + sleep_inpc only (no pay / wire / approve / cancel / priority / provision / console)")
	gs.inpc_awake = false
	var start_dormant: String = dlg.pick_start(d, gs.facts())
	gs.inpc_awake = true
	var start_awake: String = dlg.pick_start(d, gs.facts())
	gs.inpc_awake = false
	if start_dormant != "dormant" or start_awake != "awake":
		_fail("start routing: dormant→%s awake→%s" % [start_dormant, start_awake])
	else:
		_ok("start node follows inpc_awake: dormant / awake")
	var why := str(d["nodes"]["why_key"]["text"]).to_lower()
	if why.find("openrouter") < 0 or why.find("session") < 0 or why.find("wipe") < 0:
		_fail("why_key does not tell the player the key is session-only and wiped on Sleep")
	# Staff may point the way to the kiosk (Mo does), but no staff file may run its verbs or carry its key copy.
	for staff in ["greeter", "clerk", "teller", "vault_keeper", "manager", "registrar", "dealer"]:
		var st := FileAccess.get_file_as_string("res://dialogue/%s.json" % staff).to_lower()
		if st.find("open_inpc") >= 0 or st.find("sleep_inpc") >= 0 or st.find("openrouter") >= 0:
			_fail("staff dialogue %s.json runs the assistant's verbs or talks OpenRouter — the iNPC is not a staff row" % staff)

	print("iNPC — overlay lock mirrors inpc.closed")
	dlg.start("inpc")
	if not dlg.active or not gs.ui_locked:
		_fail("Dialogue.start(inpc) did not lock the floor")
	gs.inpc_open = true            # as `open_inpc` would after the shell answered ok
	dlg.close()
	if not gs.ui_locked:
		_fail("closing the dialogue while the panel is up unlocked the floor")
	chain.emit_event("inpc.closed", {"reason": "escape", "awake": true})
	if gs.inpc_open or gs.ui_locked or not gs.inpc_awake:
		_fail("inpc.closed did not clear inpc_open / ui_locked or did not mirror awake: open=%s locked=%s awake=%s" % [str(gs.inpc_open), str(gs.ui_locked), str(gs.inpc_awake)])
	else:
		_ok("dialogue end keeps the lock while the panel is up; inpc.closed frees the floor and mirrors awake=true")
	chain.emit_event("inpc.closed", {"reason": "sleep", "awake": false})
	if gs.inpc_awake:
		_fail("Sleep's inpc.closed did not put the eye out")
	else:
		_ok("Sleep → inpc_awake false")
	var slept: Dictionary = await gs.run_action("sleep_inpc", {})
	if slept.get("ok", false):
		_fail("sleep_inpc without a shell should be refused (nothing to wipe here)")
	_finish()


func _finish() -> void:
	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(1 if failures > 0 else 0)
