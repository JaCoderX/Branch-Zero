extends SceneTree
## Headless walk of Kenji's FX desk against MockChain (no browser, no chain).
##
##   godot --headless --path apps/game -s tests/run_fx_walk.gd
##
## Boots the autoloads by hand (a `-s` script gets no project autoloads), opens a funded mock account, then walks the
## desk in the order a player meets it: the till is closed → Kenji offers to open it → the board prices a swap → the
## swap spends practice dollars for practice ether → a stale quote is refused → an over-balance order is refused with
## the bank line, not a crash. It also asserts the two things the greybox could quietly get wrong: that Kenji's
## start node follows the chain state (`fx_till` / `fx_open` / `fx_quoted`), and that a bigger order gets a *worse*
## rate, because a board that shows one flat number is not a market.
##
## MockChain proves nothing about Uniswap (docs/REMOTE-EVM.md §5). The sponsor evidence is
## `npm -w apps/teller-desk run killtests:s1` against live Sepolia.

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


func _start(dlg: Node, gs: Node) -> String:
	return dlg.pick_start(dlg.load_npc("dealer"), gs.facts())


func _run() -> void:
	var gs: Node = root.get_node("GameState")
	var dlg: Node = root.get_node("Dialogue")
	var chain: Node = root.get_node("Chain")
	while not gs.booted:
		await process_frame
	chain._mock.preset_account()
	# `preset_account` hands the mock a till but leaves its exchange door shut, which is where a new player starts.
	chain._mock.fx_open = false
	await gs.refresh_all()
	await gs.refresh_fx()

	# --- the desk before the door is registered ---
	if _start(dlg, gs) != "closed_door":
		_fail("Kenji starts at %s with a till and no exchange door, want closed_door (facts %s)" % [_start(dlg, gs), str(gs.facts())])
	else:
		_ok("till on file, door shut → Kenji starts at closed_door")
	var early: Dictionary = await gs.run_action("fx_swap", {"amount": "1"})
	if early.get("ok", false) or str(early.get("error", {}).get("code", "")) != "FX_NOT_ENABLED":
		_fail("swap before the door was registered: %s" % str(early))
	else:
		_ok("swap before registration → FX_NOT_ENABLED: \"%s\"" % gs.error_line(early["error"]))

	# --- registering the exchange door ---
	var opened: Dictionary = await gs.run_action("fx_enable", {})
	if not opened.get("ok", false):
		_fail("fx_enable refused: %s" % str(opened.get("error")))
		return _finish()
	if not gs.fx_open():
		_fail("fx_enable returned ok but GameState still reports the door shut: %s" % str(gs.fx))
	else:
		_ok("exchange door registered · till %s · %s whitelisted calls" % [gs.fx.get("account"), str(gs.fx.get("whitelist", []).size())])
	if gs.fx.get("whitelist", []).size() != 3:
		_fail("the till advertises %d whitelisted calls, want exactly 3" % gs.fx.get("whitelist", []).size())

	# --- the board ---
	var small: Dictionary = await gs.run_action("fx_quote", {"amount": "1"})
	if not small.get("ok", false):
		_fail("quote refused: %s" % str(small.get("error")))
		return _finish()
	var small_rate := float(str(small["result"]["amountOut"])) / 1.0
	if not gs.fx_quoted():
		_fail("a fresh quote is not on the board: %s" % str(gs.fx_quote))
	elif gs.fx_quote_remaining() <= 0 or gs.fx_quote_remaining() > 300:
		_fail("quote countdown is %d s, want 1..300" % gs.fx_quote_remaining())
	else:
		_ok("board: 1 → %s %s (floor %s), valid %s" % [str(small["result"]["amountOut"]), str(gs.fx.get("symbolOut")), str(small["result"]["minOut"]), gs.fmt_duration(gs.fx_quote_remaining())])
	if _start(dlg, gs) != "quoted":
		_fail("Kenji starts at %s with a live quote, want quoted" % _start(dlg, gs))
	else:
		_ok("live quote → Kenji starts at quoted")
	var big: Dictionary = await gs.run_action("fx_quote", {"amount": "25"})
	var big_rate := float(str(big["result"]["amountOut"])) / 25.0
	if big_rate >= small_rate:
		_fail("25 units priced at %.8f per unit, no worse than 1 unit at %.8f — the board is not pricing depth" % [big_rate, small_rate])
	else:
		_ok("a bigger order gets a worse rate (%.8f vs %.8f per unit) — the board reads the pool, not a constant" % [big_rate, small_rate])

	# --- the swap ---
	var before_usdc := float(str(gs.fx.get("usdc", "0")))
	var before_weth := float(str(gs.fx.get("weth", "0")))
	var quoted_out := float(str(gs.fx_quote.get("amountOut", "0")))
	var swapped: Dictionary = await gs.run_action("fx_swap", {})
	if not swapped.get("ok", false):
		_fail("swap refused: %s" % str(swapped.get("error")))
		return _finish()
	var after_usdc := float(str(gs.fx.get("usdc", "0")))
	var after_weth := float(str(gs.fx.get("weth", "0")))
	if after_usdc >= before_usdc or after_weth <= before_weth:
		_fail("balances did not move: %s/%s → %s/%s" % [before_usdc, before_weth, after_usdc, after_weth])
	elif absf((after_weth - before_weth) - quoted_out) > quoted_out * 0.05:
		_fail("received %.8f but the board promised %.8f" % [after_weth - before_weth, quoted_out])
	else:
		_ok("swap: −%s %s, +%.6f %s in three guarded steps" % [gs.fmt_amount(before_usdc - after_usdc), str(gs.fx.get("symbolIn")), after_weth - before_weth, str(gs.fx.get("symbolOut"))])
	if not gs.fx_quote.is_empty():
		_fail("the board still shows a spent quote")
	else:
		_ok("the board clears once its quote is filled")

	# --- refusals a player will actually hit ---
	# "Take it" on a quote whose deadline has passed must be refused, not re-priced under the player.
	var fresh: Dictionary = await gs.run_action("fx_quote", {"amount": "1"})
	if not fresh.get("ok", false):
		_fail("re-quote refused: %s" % str(fresh.get("error")))
	gs.fx_quote["deadline"] = str(gs.now() - 1)
	var stale: Dictionary = await gs.run_action("fx_swap", {})
	if stale.get("ok", false) or str(stale.get("error", {}).get("code", "")) != "FX_QUOTE_EXPIRED":
		_fail("a stale board quote was taken instead of refused: %s" % str(stale))
	else:
		_ok("stale quote → FX_QUOTE_EXPIRED: \"%s\"" % gs.error_line(stale["error"]))
	# ... and "take it" with nothing on the board asks for a price rather than guessing an amount.
	gs.fx_quote = {}
	var blind: Dictionary = await gs.run_action("fx_swap", {})
	if blind.get("ok", false) or str(blind.get("error", {}).get("code", "")) != "FX_AMOUNT":
		_fail("a swap with no quote and no amount was accepted: %s" % str(blind))
	else:
		_ok("no quote, no amount → FX_AMOUNT: \"%s\"" % gs.error_line(blind["error"]))

	var over: Dictionary = await gs.run_action("fx_swap", {"amount": "999999"})
	var code := str(over.get("error", {}).get("code", ""))
	if over.get("ok", false) or code != "FX_TILL_SHORT":
		_fail("an order beyond the till balance: ok=%s code=%s" % [str(over.get("ok")), code])
	else:
		# the Main wing's InsufficientBalance line sends the player to Ines, whose faucet cannot reach Sepolia
		var line: String = gs.error_line(over["error"])
		if line.find("Ines") >= 0:
			_fail("the FX desk's short-till line sends the player to Ines, who tops up the other chain: \"%s\"" % line)
		else:
			_ok("order beyond the till → FX_TILL_SHORT: \"%s\"" % line)
	return _finish()


func _finish() -> void:
	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)
