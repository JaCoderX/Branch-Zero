extends SceneTree
## Headless mock walk of the U4+ vault desks (no browser, no chain — MockChain answers everything).
##
##   godot --headless --path apps/game -s tests/run_mock_walk.gd
##
## Boots the autoloads by hand (a `-s` script does not get project autoloads), opens a funded mock account, files a
## wire, then checks what each desk offers: Ruth lists the cooling wire under `approve` and is refused
## `BeforeReleaseTime`; Okafor lists it under `priority` and the mock Priority release completes it; a released
## wire is `NOT_COOLING` at Okafor's desk. Exits non-zero on the first wrong answer.

var failures := 0


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
	chain._mock.preset_account()
	await gs.refresh_all()
	print("mock account: %s balance %s, priority=%s" % [gs.account(), gs.balance, str(gs.priority_enabled())])

	# file a wire (Dev's over-limit path) — 250 > instant limit 100
	var r: Dictionary = await gs.run_action("wire", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "250", "memo": "flat"})
	if not r.get("ok", false):
		_fail("mock wire refused: %s" % str(r.get("error")))
		return _finish()
	var tx_id := str(r["result"]["txId"])
	_ok("wire #%s filed, releases in %d s (cooling=%d released=%d)" % [tx_id, gs.remaining(gs.wire_by_id(tx_id)), gs.cooling_count(), gs.released_count()])

	# desk listings
	var manager: Dictionary = dlg.load_npc("manager")
	var ruth: Dictionary = dlg.load_npc("vault_keeper")
	var m_choices: Array = dlg._resolve_choices(manager["nodes"]["priority_list"])
	var r_choices: Array = dlg._resolve_choices(ruth["nodes"]["cooling"])
	var m_actions := []
	for c in m_choices:
		if c.has("action"):
			m_actions.append("%s#%s" % [c["action"], c.get("args", {}).get("txId", "")])
	var r_actions := []
	for c in r_choices:
		if c.has("action"):
			r_actions.append("%s#%s" % [c["action"], c.get("args", {}).get("txId", "")])
	if m_actions.has("priority#" + tx_id):
		_ok("Okafor's priority list offers priority#%s (%s)" % [tx_id, str(m_actions)])
	else:
		_fail("Okafor's priority list does not offer the cooling wire: %s" % str(m_actions))
	if r_actions.has("approve#" + tx_id):
		_ok("Ruth's cooling list offers approve#%s" % tx_id)
	else:
		_fail("Ruth does not list the wire: %s" % str(r_actions))
	var start: String = dlg.pick_start(manager, gs.facts())
	if start != "idle":
		_fail("Okafor start node is %s, want idle (facts %s)" % [start, str(gs.facts())])
	else:
		_ok("Okafor starts at idle; facts cooling=%d priority=%s" % [gs.facts()["cooling"], str(gs.facts()["priority"])])

	# Ruth early → BeforeReleaseTime
	var early: Dictionary = await gs.run_action("approve", {"txId": tx_id})
	var code := str(early.get("error", {}).get("code", ""))
	if early.get("ok", false) or code != "BeforeReleaseTime":
		_fail("Ruth early: ok=%s code=%s" % [str(early.get("ok")), code])
	else:
		_ok("Ruth early → BeforeReleaseTime: \"%s\"" % gs.error_line(early["error"], {"txId": tx_id}))
	# manager approve (stale verb) → MANAGER_NO_STAMP
	var stamp: Dictionary = await gs.run_action("manager_approve", {"txId": tx_id})
	if str(stamp.get("error", {}).get("code", "")) != "MANAGER_NO_STAMP":
		_fail("manager_approve did not answer MANAGER_NO_STAMP: %s" % str(stamp))
	else:
		_ok("manager_approve → MANAGER_NO_STAMP: \"%s\"" % gs.error_line(stamp["error"]))

	# Passkey / sign-sheet dismiss → Okafor's PRIORITY_CANCELLED line (no chain write)
	var dismiss: Dictionary = await gs.run_action("priority", {"txId": "dismiss", "dismiss": true})
	var dcode := str(dismiss.get("error", {}).get("code", ""))
	if dismiss.get("ok", false) or dcode != "PRIORITY_CANCELLED":
		_fail("priority dismiss: ok=%s code=%s" % [str(dismiss.get("ok")), dcode])
	else:
		var dline: String = gs.error_line(dismiss["error"])
		if not dline.contains("No hand scan"):
			_fail("PRIORITY_CANCELLED line wrong: \"%s\"" % dline)
		else:
			_ok("priority dismiss → PRIORITY_CANCELLED: \"%s\"" % dline)

	# Okafor Priority (mock) → COMPLETED before the clock
	var before: int = gs.remaining(gs.wire_by_id(tx_id))
	var pr: Dictionary = await gs.run_action("priority", {"txId": tx_id})
	if not pr.get("ok", false):
		_fail("mock priority refused: %s" % str(pr.get("error")))
	elif str(pr["result"].get("status", "")) != "COMPLETED" or str(pr["result"].get("actor", "")) != "priority":
		_fail("mock priority result: %s" % str(pr["result"]))
	else:
		_ok("Okafor priority → COMPLETED with %d s still on the clock; balance %s; pending now %d" % [before, gs.balance, gs.pending_count()])

	# a released wire is Ruth's, not Okafor's
	var r2: Dictionary = await gs.run_action("wire", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "150", "memo": "x"})
	var tx2 := str(r2["result"]["txId"])
	var rec: Dictionary = chain._mock.wires[chain._mock._find(tx2)]
	rec["releaseTime"] = str(int(rec["releaseTime"]) - 60)  # pretend the clock ran down
	await gs.refresh_passbook()
	var late: Dictionary = await gs.run_action("priority", {"txId": tx2})
	if str(late.get("error", {}).get("code", "")) != "NOT_COOLING":
		_fail("priority on a released wire: %s" % str(late))
	else:
		_ok("priority on a released wire → NOT_COOLING: \"%s\"" % gs.error_line(late["error"]))
	var okafor_start: String = dlg.pick_start(manager, gs.facts())
	var idle_choices: Array = dlg._resolve_choices(manager["nodes"]["idle"])
	var texts := []
	for c in idle_choices:
		texts.append(str(c.get("text", "")) + "→" + str(c.get("next", c.get("action", ""))))
	if okafor_start != "idle" or not str(texts).contains("not_cooling"):
		_fail("released wire: Okafor idle should route Priority to not_cooling: %s" % str(texts))
	else:
		_ok("released wire: Okafor's Priority choice routes to not_cooling")
	var ruth_start: String = dlg.pick_start(ruth, gs.facts())
	if ruth_start != "ready":
		_fail("Ruth start for a released wire is %s, want ready" % ruth_start)
	else:
		_ok("Ruth starts at ready for the released wire")
	_finish()


func _finish() -> void:
	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)
