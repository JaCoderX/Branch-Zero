extends SceneTree
## Headless walk of Kenji's FX desk against MockChain (no browser, no chain).
##
##   godot --headless --path apps/game -s tests/run_fx_walk.gd
##
## Boots the autoloads by hand (a `-s` script gets no project autoloads), opens a funded mock account, then walks the
## desk in the order a player meets it: the till is closed → Kenji offers to open it → the board prices euros and
## shekels → each swap spends practice dollars for practice fiat → a stale quote is refused → an over-balance order is
## refused with the bank line, not a crash → a currency the desk does not deal in is refused `FX_PAIR`. It also asserts
## the two things the greybox could quietly get wrong: that Kenji's start node follows the chain state (`fx_till` /
## `fx_open` / `fx_quoted`), and that the board is **flat** — since the fiat pairs (2026-09-09) each pool is a $100M
## book, so a bigger order must move the rate by a hair, not by a percent. The old WETH desk taught price impact on a
## thin pool; a bank FX desk teaches the opposite, and this walk fails if the depth is ever shrunk back.
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
	if gs.fx.get("pairs", []).size() != 2:
		_fail("the board knows %d pairs, want USD/EUR and USD/ILS" % gs.fx.get("pairs", []).size())
	else:
		_ok("board: %s · %s" % [gs.vars()["fx_rate_eur"], gs.vars()["fx_rate_ils"]])
	var early: Dictionary = await gs.run_action("fx_swap", {"amount": "1", "pair": "EUR"})
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
		_fail("the till advertises %d whitelisted calls, want exactly 3 — the fiat pairs add none (one-way desk)" % gs.fx.get("whitelist", []).size())

	# --- the board and the swap, once per pair ---
	for pair in ["EUR", "ILS"]:
		var seed := float(str(gs.fx_pair(pair).get("seedRate", "0")))
		# depth probe first, so the quote left on the board for "Take it" is the desk-sized one
		var big: Dictionary = await gs.run_action("fx_quote", {"amount": "250", "pair": pair})
		if not big.get("ok", false):
			_fail("%s 250 quote refused: %s" % [pair, str(big.get("error"))])
			return _finish()
		var big_rate := float(str(big["result"]["amountOut"])) / 250.0
		var small: Dictionary = await gs.run_action("fx_quote", {"amount": "25", "pair": pair})
		if not small.get("ok", false):
			_fail("%s quote refused: %s" % [pair, str(small.get("error"))])
			return _finish()
		var small_rate := float(str(small["result"]["amountOut"])) / 25.0
		if not gs.fx_quoted():
			_fail("a fresh %s quote is not on the board: %s" % [pair, str(gs.fx_quote)])
		elif gs.fx_quote_remaining() <= 0 or gs.fx_quote_remaining() > 300:
			_fail("quote countdown is %d s, want 1..300" % gs.fx_quote_remaining())
		elif str(gs.fx_quote.get("symbolOut", "")) != pair or str(gs.vars()["fx_symbol_out"]) != pair:
			_fail("the board's quote says %s / %s, want %s" % [str(gs.fx_quote.get("symbolOut")), str(gs.vars()["fx_symbol_out"]), pair])
		else:
			_ok("board: 25 USD → %s %s (floor %s), valid %s" % [str(small["result"]["amountOut"]), pair, str(small["result"]["minOut"]), gs.fmt_duration(gs.fx_quote_remaining())])
		if _start(dlg, gs) != "quoted":
			_fail("Kenji starts at %s with a live quote, want quoted" % _start(dlg, gs))
		else:
			_ok("live %s quote → Kenji starts at quoted" % pair)
		# all-in rate within 1 % of the seed mid (0.30 % fee on a deep book)
		if seed <= 0.0 or absf(small_rate - seed) / seed > 0.01:
			_fail("%s: 25 USD priced at %.6f per dollar, seed mid %.5f — more than 1 %% away on a $100M book" % [pair, small_rate, seed])
		else:
			_ok("%s: all-in %.6f vs seed mid %.5f (%.3f %% off — the fee, not depth)" % [pair, small_rate, seed, absf(small_rate - seed) / seed * 100.0])
		if big_rate > small_rate:
			_fail("%s: 250 USD priced better per dollar (%.8f) than 25 USD (%.8f) — a constant-product book cannot do that" % [pair, big_rate, small_rate])
		elif absf(small_rate - big_rate) / small_rate > 0.0005:
			_fail("%s: 250 USD is %.4f %% worse per dollar than 25 USD — the book is thin; the fiat pools are $100M deep on purpose" % [pair, absf(small_rate - big_rate) / small_rate * 100.0])
		else:
			_ok("%s: a 10× order moves the rate %.6f %% — flat, as a bank FX board should be" % [pair, absf(small_rate - big_rate) / small_rate * 100.0])

		var before_usd := float(str(gs.fx.get("usdc", "0")))
		var before_out := float(str(gs.fx.get(pair.to_lower(), "0")))
		var quoted_out := float(str(gs.fx_quote.get("amountOut", "0")))
		var swapped: Dictionary = await gs.run_action("fx_swap", {})
		if not swapped.get("ok", false):
			_fail("%s swap refused: %s" % [pair, str(swapped.get("error"))])
			return _finish()
		var after_usd := float(str(gs.fx.get("usdc", "0")))
		var after_out := float(str(gs.fx.get(pair.to_lower(), "0")))
		if after_usd >= before_usd or after_out <= before_out:
			_fail("%s balances did not move: %s/%s → %s/%s" % [pair, before_usd, before_out, after_usd, after_out])
		elif absf((after_out - before_out) - quoted_out) > quoted_out * 0.05:
			_fail("%s: received %.6f but the board promised %.6f" % [pair, after_out - before_out, quoted_out])
		elif str(swapped["result"].get("pair", "")) != pair:
			_fail("the receipt says pair %s, want %s" % [str(swapped["result"].get("pair", "")), pair])
		else:
			_ok("swap: −%s USD, +%.6f %s in three guarded steps" % [gs.fmt_amount(before_usd - after_usd), after_out - before_out, pair])
		if not gs.fx_quote.is_empty():
			_fail("the board still shows a spent quote")
		else:
			_ok("the board clears once its quote is filled")

	# --- refusals a player will actually hit ---
	# "Take it" on a quote whose deadline has passed must be refused, not re-priced under the player.
	var fresh: Dictionary = await gs.run_action("fx_quote", {"amount": "1", "pair": "EUR"})
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

	var over: Dictionary = await gs.run_action("fx_swap", {"amount": "999999", "pair": "ILS"})
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

	# the desk is fiat: ether is not a pair it deals in, and it says so before pricing anything
	var ether: Dictionary = await gs.run_action("fx_quote", {"amount": "1", "pair": "WETH"})
	if ether.get("ok", false) or str(ether.get("error", {}).get("code", "")) != "FX_PAIR":
		_fail("the desk priced WETH: %s" % str(ether))
	else:
		_ok("WETH → FX_PAIR: \"%s\"" % gs.error_line(ether["error"]))
	return _finish()


func _finish() -> void:
	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)
