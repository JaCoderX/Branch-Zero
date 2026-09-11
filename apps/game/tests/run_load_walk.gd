extends SceneTree
## Headless Load Account walk against MockChain (docs/LOAD-ACCOUNT.md).
##
##   godot --headless --path apps/game -s tests/run_load_walk.gd
##
## Walks the slip the way a player does — the clerk's choice opens a form, the form hands back one string, and
## the node it routes to is what asks the desk — then checks the four answers that matter: an owned account is
## adopted and shows up in the session/passbook, re-loading it is a quiet no-op, somebody else's account is
## refused `ACCOUNT_NOT_OWNED`, and a number that is not one of the branch's accounts is refused
## `ACCOUNT_NOT_A_VAULT`. MockChain cannot prove the ownership gate (it has no chain to read) — that is what
## `npm -w apps/teller-desk run killtests:load` is for. What it proves here is the wiring and the copy.

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
	var mock: Node = chain._mock
	var opened: String = gs.account()
	print("mock account: %s on %s" % [opened, gs.chain_label()])

	# --- the clerk's own path: the choice opens a form, and only the form's value reaches the desk
	var clerk: Dictionary = dlg.load_npc("clerk")
	var done_choices: Array = dlg._resolve_choices(clerk["nodes"]["done"])
	var slip: Dictionary = {}
	for c in done_choices:
		if str(c.get("form", "")) == "load_account":
			slip = c
	if slip.is_empty():
		_fail("Iris's passbook node offers no load slip: %s" % str(dlg.choice_labels()))
		return _finish()
	_ok("Iris offers \"%s\" from the passbook node → %s" % [str(slip["text"]), str(slip["on_submit"])])

	dlg.start("clerk")
	var idx: int = dlg.find_choice("load an existing account")
	if idx < 0:
		_fail("the load slip is not on screen at Iris's desk: %s" % str(dlg.choice_labels()))
		return _finish()
	# GDScript lambdas capture locals by value, so the signal writes into a shared container, not a local.
	var asked: Array = []
	dlg.form_requested.connect(func(kind: String, _ctx: Dictionary) -> void: asked.append(kind))
	dlg.choose(idx)
	await process_frame
	if asked != ["load_account"]:
		_fail("choosing the load option requested form(s) %s" % str(asked))
		return _finish()
	_ok("choosing it asks the shell for the load_account form (no desk call yet)")

	# The form's shape check is local and shallow: 0x + 40 hex. Whether it is an account is the desk's business.
	var LoadForm = load("res://scripts/load_account_form.gd")
	for bad in ["", "0x", "not-an-address", "0xC10ded000000000000000000000000000000000", "0xM0CK0000000000000000000000000000000ACC7"]:
		if LoadForm._looks_like_address(bad):
			_fail("the load slip accepted %s" % bad)
	if not LoadForm._looks_like_address(mock.OLD_ACCOUNT):
		_fail("the load slip rejected a well-formed account number %s" % mock.OLD_ACCOUNT)
	else:
		_ok("slip shape check: 0x + 40 hex only (5 malformed values refused, %s accepted)" % gs.short_address(mock.OLD_ACCOUNT))

	# --- submitting an owned, non-current account: the desk adopts it
	dlg.submit_form({"account": mock.OLD_ACCOUNT})
	while dlg.is_working:
		await process_frame
	await process_frame
	if gs.account().to_lower() != str(mock.OLD_ACCOUNT).to_lower():
		_fail("the session still points at %s after loading %s" % [gs.account(), mock.OLD_ACCOUNT])
	elif not gs.has_account():
		_fail("has_account is false after a load")
	elif str(gs.last_stage.get("account", "")).to_lower() != str(mock.OLD_ACCOUNT).to_lower() or str(gs.last_stage.get("stage", "")) != "mined":
		_fail("no mined PROVISION stage naming the loaded account: %s" % str(gs.last_stage))
	else:
		_ok("loaded %s — session, passbook and the desk's last stage all name it" % gs.short_address(gs.account()))
	if dlg._node_id != "loaded":
		_fail("the clerk did not land on the loaded node: %s" % dlg._node_id)
	dlg.close()

	# --- re-loading the same account is a Re-check, not a second switch
	var again: Dictionary = await gs.run_action("load_account", {"account": mock.OLD_ACCOUNT})
	if not again.get("ok", false) or bool(again["result"].get("changed", true)):
		_fail("re-loading the loaded account was not a quiet no-op: %s" % str(again))
	elif gs.account().to_lower() != str(mock.OLD_ACCOUNT).to_lower():
		_fail("re-load moved the account to %s" % gs.account())
	else:
		_ok("re-loading the same number → changed=false, account unmoved")

	# --- somebody else's account
	var foreign: Dictionary = await gs.run_action("load_account", {"account": mock.FOREIGN_ACCOUNT})
	var foreign_line: String = gs.error_line(foreign.get("error", {}))
	if foreign.get("ok", false) or str(foreign.get("error", {}).get("code", "")) != "ACCOUNT_NOT_OWNED":
		_fail("a foreign account was not refused ACCOUNT_NOT_OWNED: %s" % str(foreign))
	elif foreign_line.to_lower().find("isn't yours") < 0:
		_fail("ACCOUNT_NOT_OWNED line does not say it is not theirs: \"%s\"" % foreign_line)
	elif gs.account().to_lower() != str(mock.OLD_ACCOUNT).to_lower():
		_fail("a refused load still moved the account to %s" % gs.account())
	else:
		_ok("somebody else's account → ACCOUNT_NOT_OWNED: \"%s\"; file unchanged" % foreign_line)
	if gs.error_why(foreign.get("error", {})).find("owner()") < 0:
		_fail("the Ask why for ACCOUNT_NOT_OWNED does not mention owner()")

	# --- a well-formed number that is not one of the branch's accounts (an EOA, or the other wing's account)
	var not_vault: Dictionary = await gs.run_action("load_account", {"account": "0xd03ea8624C8C5987235048901fB614fDcA89b117"})
	var not_vault_line: String = gs.error_line(not_vault.get("error", {}))
	if not_vault.get("ok", false) or str(not_vault.get("error", {}).get("code", "")) != "ACCOUNT_NOT_A_VAULT":
		_fail("a non-account address was not refused ACCOUNT_NOT_A_VAULT: %s" % str(not_vault))
	elif not_vault_line.to_lower().find("wing") < 0:
		_fail("ACCOUNT_NOT_A_VAULT line does not mention the wing: \"%s\"" % not_vault_line)
	else:
		_ok("a plain wallet address → ACCOUNT_NOT_A_VAULT: \"%s\"" % not_vault_line)

	# --- nothing typed at all never reaches the bridge
	var empty: Dictionary = await gs.run_action("load_account", {})
	if empty.get("ok", false) or str(empty.get("error", {}).get("code", "")) != "BAD_ARGS":
		_fail("an empty account was not refused BAD_ARGS: %s" % str(empty))
	else:
		_ok("an empty account number → BAD_ARGS before the bridge is called")

	# --- and the account Iris opened can be loaded back: a load is a switch, not a one-way door
	var back: Dictionary = await gs.run_action("load_account", {"account": opened})
	if not back.get("ok", false) or gs.account().to_lower() != opened.to_lower() or not bool(back["result"].get("changed", false)):
		_fail("could not load the originally opened account back: %s" % str(back))
	else:
		_ok("loaded %s back — the desk moves both ways" % gs.short_address(opened))

	_finish()


func _finish() -> void:
	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)
