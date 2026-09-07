extends SceneTree
## Headless U7 practice-faucet walk against MockChain.
##
##   godot --headless --path apps/game -s tests/run_faucet_walk.gd
##
## Covers the locked distinctions: spend down → restore to opening, already-full no-op, Re-check remains
## zero-only, and the deferred Arc wing refuses this Main-wing-only practice faucet.

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
	var chain: Node = root.get_node("Chain")
	while not gs.booted:
		await process_frame
	chain._mock.preset_account()
	await gs.refresh_all()

	var spend: Dictionary = await gs.run_action("pay", {"to": "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "amount": "100"})
	if not spend.get("ok", false) or str(gs.balance) != "400":
		_fail("spend-down setup failed: %s; balance=%s" % [str(spend), gs.balance])
	else:
		_ok("spend down: balance is %s" % gs.balance)

	var top_up: Dictionary = await gs.run_action("faucet")
	var top_result: Dictionary = top_up.get("result", {})
	if not top_up.get("ok", false) or str(gs.balance) != "500" or not bool(top_result.get("toppedUp", false)) or not top_result.has("hash"):
		_fail("underfunded faucet did not restore opening balance: %s; balance=%s" % [str(top_up), gs.balance])
	else:
		_ok("faucet restores balance to opening 500 with a transfer result")

	var full: Dictionary = await gs.run_action("faucet")
	var full_result: Dictionary = full.get("result", {})
	if not full.get("ok", false) or str(gs.balance) != "500" or bool(full_result.get("toppedUp", true)) or full_result.has("hash"):
		_fail("already-full faucet was not a no-op success: %s; balance=%s" % [str(full), gs.balance])
	else:
		_ok("already-full faucet succeeds without a second transfer")

	chain._mock.balance = 250.0
	await gs.refresh_passbook()
	var recheck: Dictionary = await gs.run_action("provision")
	if not recheck.get("ok", false) or str(gs.balance) != "250":
		_fail("Re-check unexpectedly re-funded a non-zero underfunded balance: %s; balance=%s" % [str(recheck), gs.balance])
	else:
		_ok("Re-check leaves non-zero underfunded balance at %s" % gs.balance)

	var arc: Dictionary = await gs.run_action("switch_wing", {"chainId": 5042002})
	var arc_faucet: Dictionary = await gs.run_action("faucet")
	if not arc.get("ok", false) or arc_faucet.get("ok", false) or str(arc_faucet.get("error", {}).get("code", "")) != "FAUCET_OFF":
		_fail("Arc faucet was not refused: switch=%s faucet=%s" % [str(arc), str(arc_faucet)])
	else:
		_ok("Arc faucet is refused with FAUCET_OFF")

	await gs.run_action("switch_wing", {"chainId": 1337})
	var final_top_up: Dictionary = await gs.run_action("faucet")
	if not final_top_up.get("ok", false) or str(gs.balance) != "500":
		_fail("final Main-wing faucet did not restore opening balance: %s; balance=%s" % [str(final_top_up), gs.balance])
	else:
		_ok("Main-wing faucet restores the rechecked balance to 500")

	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)
