extends SceneTree
## Headless mock walk of the U4+ vault desks (no browser, no chain — MockChain answers everything).
##
##   godot --headless --path apps/game -s tests/run_mock_walk.gd
##
## Boots the autoloads by hand (a `-s` script does not get project autoloads), opens a funded mock account, files a
## wire, then checks what each desk offers: Bob lists the cooling wire under `approve` and is refused
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
	var bank_name: String = gs.ens_name()
	# ENS passbook polish: the passbook shows name + tier from the desk mirror (/session ensTier) only once a name exists,
	# a Gold update reaches it through the ordinary session refresh, and an unnamed customer never meets a placeholder.
	var v0: Dictionary = gs.vars()
	if not gs.has_ens_name() or str(v0.get("bank_name", "")) != bank_name or str(v0.get("bank_tier", "")) != "Silver":
		_fail("passbook vars after the preset claim: bank_name=%s bank_tier=%s" % [str(v0.get("bank_name")), str(v0.get("bank_tier"))])
	else:
		_ok("passbook mirrors %s · Silver from the mock session" % bank_name)
	var gold: Dictionary = await gs.run_action("ens_set_text", {"key": "bz.tier", "value": "Gold"})
	if not gold.get("ok", false) or str(gs.vars().get("bank_tier", "")) != "Gold" or str(gs.session.get("ensTier", "")) != "Gold":
		_fail("Gold update did not reach the passbook through the session refresh: %s (bank_tier=%s)" % [str(gold), str(gs.vars().get("bank_tier"))])
	else:
		_ok("Petra's Gold update → passbook Tier · Gold via the existing session refresh, no new bridge verb")
	var registrar: Dictionary = dlg.load_npc("registrar")
	var greeter: Dictionary = dlg.load_npc("greeter")
	var clerk: Dictionary = dlg.load_npc("clerk")
	if not bool(gs.facts().get("has_ens_name", false)) or dlg.pick_start(registrar, gs.facts()) == "first_visit":
		_fail("has_ens_name fact is false for a named customer (Petra would greet a first visit)")
	var mo_named: String = dlg.resolve_text(greeter["nodes"]["has_account"], gs.facts())
	if mo_named.find("{bank_name}") < 0:
		_fail("Mo does not mention the bank name for a named customer: %s" % mo_named)
	var saved_name: String = chain._mock.ens_name
	var saved_rows: Array = chain._mock.ens_names
	chain._mock.ens_name = ""
	chain._mock.ens_names = []
	await gs.refresh_all()
	await gs.refresh_names()
	var v1: Dictionary = gs.vars()
	var mo_quiet: String = dlg.resolve_text(greeter["nodes"]["has_account"], gs.facts())
	var ines_quiet: String = dlg.resolve_text(clerk["nodes"]["done"], gs.facts())
	if gs.has_ens_name() or str(v1.get("bank_name", "")) != "" or str(v1.get("bank_tier", "")) != "" or dlg.pick_start(registrar, gs.facts()) != "first_visit":
		_fail("unnamed customer still carries a name/tier: has=%s bank_name=%s bank_tier=%s" % [str(gs.has_ens_name()), str(v1.get("bank_name")), str(v1.get("bank_tier"))])
	elif mo_quiet.to_lower().find("bank name") >= 0 or ines_quiet.to_lower().find("bank name") >= 0 or (mo_quiet + ines_quiet).find("not chosen") >= 0:
		_fail("Mo/Ines name the bank name for an unnamed customer: %s | %s" % [mo_quiet, ines_quiet])
	else:
		_ok("unnamed customer: no name row, no tier, Mo and Ines say nothing about a bank name; Petra starts at first_visit")
	chain._mock.ens_name = saved_name
	chain._mock.ens_names = saved_rows
	chain._mock.ens_tier = "Silver"
	await gs.refresh_all()
	await gs.refresh_names()
	var named_pay: Dictionary = await gs.run_action("pay", {"name": bank_name, "amount": "1", "memo": "name walk"})
	if not named_pay.get("ok", false) or str(named_pay.get("result", {}).get("to", "")).to_lower() != chain._mock.ACCOUNT.to_lower():
		_fail("pay-by-name did not resolve the registered customer name: %s" % str(named_pay))
	else:
		_ok("pay-by-name resolves %s before the unchanged Counter payment lane" % bank_name)
	var refill: Dictionary = await gs.run_action("faucet", {})
	if not refill.get("ok", false):
		_fail("mock faucet could not restore the walk's opening balance: %s" % str(refill))

	# Lane B preflight: an overdrawn wire is refused before a pending record is created.
	var wires_before: int = chain._mock.wires.size()
	var over_balance: Dictionary = await gs.run_action("wire", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "501", "memo": "too much"})
	var over_error: Dictionary = over_balance.get("error", {})
	var over_line: String = gs.error_line(over_error)
	if over_balance.get("ok", false) or str(over_error.get("code", "")) != "InsufficientBalance" or chain._mock.wires.size() != wires_before:
		_fail("over-balance wire was filed or returned the wrong error: %s" % str(over_balance))
	elif not str(over_error.get("message", "")).contains("500") or not str(over_error.get("message", "")).contains("501") or not over_line.to_lower().contains("available balance") or not over_line.to_lower().contains("that amount"):
		_fail("over-balance wire copy is not honest: line=%s error=%s" % [over_line, str(over_error)])
	else:
		_ok("over-balance wire → InsufficientBalance: \"%s\"; no pending record filed" % over_line)

	# file a wire (Dev's over-limit path) — 250 > instant limit 100
	var r: Dictionary = await gs.run_action("wire", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "250", "memo": "flat"})
	if not r.get("ok", false):
		_fail("mock wire refused: %s" % str(r.get("error")))
		return _finish()
	var tx_id := str(r["result"]["txId"])
	_ok("wire #%s filed, releases in %d s (cooling=%d released=%d)" % [tx_id, gs.remaining(gs.wire_by_id(tx_id)), gs.cooling_count(), gs.released_count()])

	# desk listings
	var manager: Dictionary = dlg.load_npc("manager")
	var bob: Dictionary = dlg.load_npc("vault_keeper")
	var m_choices: Array = dlg._resolve_choices(manager["nodes"]["priority_list"])
	var r_choices: Array = dlg._resolve_choices(bob["nodes"]["cooling"])
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
		_ok("Bob's cooling list offers approve#%s" % tx_id)
	else:
		_fail("Bob does not list the wire: %s" % str(r_actions))
	var start: String = dlg.pick_start(manager, gs.facts())
	if start != "idle":
		_fail("Okafor start node is %s, want idle (facts %s)" % [start, str(gs.facts())])
	else:
		_ok("Okafor starts at idle; facts cooling=%d priority=%s" % [gs.facts()["cooling"], str(gs.facts()["priority"])])

	# Bob early → BeforeReleaseTime
	var early: Dictionary = await gs.run_action("approve", {"txId": tx_id})
	var code := str(early.get("error", {}).get("code", ""))
	if early.get("ok", false) or code != "BeforeReleaseTime":
		_fail("Bob early: ok=%s code=%s" % [str(early.get("ok")), code])
	else:
		_ok("Bob early → BeforeReleaseTime: \"%s\"" % gs.error_line(early["error"], {"txId": tx_id}))
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

	# a released wire is Bob's, not Okafor's
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
	var ruth_start: String = dlg.pick_start(bob, gs.facts())
	if ruth_start != "ready":
		_fail("Bob start for a released wire is %s, want ready" % ruth_start)
	else:
		_ok("Bob starts at ready for the released wire")

	# Spend down the free balance after filing: a release can still mine and leave the record FAILED.
	var spend_a: Dictionary = await gs.run_action("pay", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "100"})
	var spend_b: Dictionary = await gs.run_action("pay", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "50"})
	if not spend_a.get("ok", false) or not spend_b.get("ok", false):
		_fail("mock spend-down setup failed: %s / %s" % [str(spend_a), str(spend_b)])
	else:
		var failed_release: Dictionary = await gs.run_action("approve", {"txId": tx2})
		var failed_error: Dictionary = failed_release.get("error", {})
		var failed_line: String = gs.error_line(failed_error)
		if failed_release.get("ok", false) or str(failed_error.get("code", "")) != "RECORD_FAILED" or not failed_line.contains("execution failed") or not failed_line.contains("available balance") or str(gs.last_stage.get("txId", "")) != tx2 or not str(gs.last_stage.get("hash", "")).begins_with("0xm0ck"):
			_fail("underfunded Bob release did not map to RECORD_FAILED: %s" % str(failed_release))
		else:
			_ok("underfunded Bob release → RECORD_FAILED: \"%s\"" % failed_line)

	# The same spend-down race is surfaced at Okafor's Priority desk, with the stage carrying its fake hash/txId.
	var r3: Dictionary = await gs.run_action("wire", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "100", "memo": "priority race"})
	if not r3.get("ok", false):
		_fail("mock Priority race wire refused unexpectedly: %s" % str(r3))
	else:
		var tx3 := str(r3["result"]["txId"])
		var last_spend: Dictionary = await gs.run_action("pay", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "1"})
		var failed_priority: Dictionary = await gs.run_action("priority", {"txId": tx3})
		var priority_error: Dictionary = failed_priority.get("error", {})
		var priority_line: String = gs.error_line(priority_error)
		if not last_spend.get("ok", false) or failed_priority.get("ok", false) or str(priority_error.get("code", "")) != "RECORD_FAILED" or not priority_line.contains("execution failed") or not priority_line.contains("available balance") or str(gs.last_stage.get("txId", "")) != tx3 or not str(gs.last_stage.get("hash", "")).begins_with("0xm0ck"):
			_fail("underfunded Priority did not map to RECORD_FAILED: %s" % str(failed_priority))
		else:
			_ok("underfunded Priority → RECORD_FAILED: \"%s\"" % priority_line)

	# Terminal Console (stretch): the bank computer's viewing list, and the honest refusal for the panel itself.
	var viewer := "0xd03ea8624C8C5987235048901fB614fDcA89b117"   # Ganache acct 5 — a wallet, no role
	var panel: Dictionary = await gs.run_action("open_console", {})
	if panel.get("ok", false) or str(panel.get("error", {}).get("code", "")) != "CONSOLE_UNAVAILABLE" or gs.terminal_open:
		_fail("MockChain claimed to open the Console panel: %s (terminal_open=%s)" % [str(panel), str(gs.terminal_open)])
	else:
		_ok("open_console under MockChain → CONSOLE_UNAVAILABLE: \"%s\"" % gs.error_line(panel["error"]))
	var granted: Dictionary = await gs.run_action("observer_grant", {"address": viewer})
	if not granted.get("ok", false) or not bool(granted["result"].get("changed", false)):
		_fail("mock observer grant refused: %s" % str(granted))
	elif granted["result"].get("permissions", []).size() != 0:
		_fail("mock OBSERVER carries permissions: %s" % str(granted["result"]["permissions"]))
	elif gs.observers.size() != 1 or str(gs.observers[0]).to_lower() != viewer.to_lower():
		_fail("GameState did not mirror the viewing list: %s" % str(gs.observers))
	else:
		_ok("viewing wallet granted: OBSERVER holds %d wallet(s), 0 function permissions" % gs.observers.size())
	var again: Dictionary = await gs.run_action("observer_grant", {"address": viewer})
	if not again.get("ok", false) or bool(again["result"].get("changed", true)) or gs.observers.size() != 1:
		_fail("re-granting the same wallet was not a quiet no-op: %s" % str(again))
	else:
		_ok("re-grant is idempotent — changed=false, still %d wallet(s)" % gs.observers.size())
	var house: Dictionary = await gs.run_action("observer_grant", {"address": chain._mock.MANAGER})
	if str(house.get("error", {}).get("code", "")) != "OBSERVER_SELF":
		_fail("granting a wallet that already holds a role was not refused: %s" % str(house))
	else:
		_ok("granting the branch manager → OBSERVER_SELF: \"%s\"" % gs.error_line(house["error"]))
	var term: Dictionary = dlg.load_npc("terminal")
	var v_choices: Array = dlg._resolve_choices(term["nodes"]["viewers"])
	var v_actions := []
	for c in v_choices:
		if c.has("action"):
			v_actions.append("%s#%s" % [c["action"], c.get("args", {}).get("address", "")])
	if not v_actions.has("observer_revoke#" + viewer):
		_fail("the terminal does not offer to remove the viewing wallet: %s" % str(v_actions))
	else:
		_ok("terminal lists observer_revoke#%s" % gs.short_address(viewer))
	var revoked: Dictionary = await gs.run_action("observer_revoke", {"address": viewer})
	if not revoked.get("ok", false) or not gs.observers.is_empty():
		_fail("mock observer revoke failed: %s (list %s)" % [str(revoked), str(gs.observers)])
	else:
		_ok("viewing wallet revoked — nobody can read the account again")
	var twice: Dictionary = await gs.run_action("observer_revoke", {"address": viewer})
	if str(twice.get("error", {}).get("code", "")) != "NOT_OBSERVER":
		_fail("revoking a wallet that is not on the list: %s" % str(twice))
	else:
		_ok("second revoke → NOT_OBSERVER: \"%s\"" % gs.error_line(twice["error"]))

	_finish()


func _finish() -> void:
	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)
