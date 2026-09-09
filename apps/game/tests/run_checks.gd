extends SceneTree
## Headless checks for the dialogue data and the pure helpers. No chain, no browser.
##
##   godot --headless --path apps/game -s tests/run_checks.gd
##
## Asserts: every dialogue JSON parses; every `next` / `on_ok` / `on_error` / `on_instant` / `on_vault` target
## exists; every node with an action has an "Ask why" choice somewhere reachable in the same file; every error
## code in docs/NPCS.md §5 (and every Teller Desk / bridge code the lanes emit) has a line in errors.json;
## the condition evaluator and interpolation behave.

const NPCS := ["greeter", "clerk", "teller", "vault_keeper", "manager", "registrar", "dealer"]
## Dialogue files that are not NPCs. The bank computer runs the same format (docs/TERMINAL-CONSOLE.md §3).
const PROPS := ["terminal"]

## NPCS.md §5 rows, the SDK names behind them, plus every code the Teller Desk and the bridge can return.
const REQUIRED_CODES := [
	"TargetNotWhitelisted", "ResourceNotFound",
	"NoPermission", "NoPermissionForFunction",
	"BeforeReleaseTime",
	"InvalidSignature", "SignerNotAuthorized",
	"MetaTxExpired",
	"InsufficientBalance",
	"InvalidNonce",
	"TransactionNotPending", "CanOnlyApprovePending", "CanOnlyCancelPending", "TransactionNotFound",
	"NO_ACCOUNT", "NO_WALLET", "NO_MANAGER", "NOT_PENDING", "RECORD_*", "RECORD_FAILED", "policy_violation", "Unknown",
	"OwnerGasDry", "RpcError",
	"TIMEOUT", "UNKNOWN_METHOD", "BAD_ARGS", "RPC", "NOT_IMPLEMENTED", "INTERNAL", "AUTH", "POLICY", "CHAIN", "LOGIN_CANCELLED",
	"NOT_CONFIGURED",
	"FAUCET_OFF", "FAUCET_EMPTY", "FAUCET_TX_FAILED",
	# U5 ENS Name Desk codes
	"INVALID_NAME", "NAME_TAKEN", "NAME_NOT_FOUND", "NAME_NOT_OWNED", "ENS_NOT_CONFIGURED", "ENS_RPC", "ENS_TX_FAILED", "ENS_RECORD_FAILED",
	# U4+ Priority release (Okafor) — desk + overlay codes
	"MANAGER_NO_STAMP", "NOT_COOLING", "PRIORITY_OFF", "PRIORITY_CANCELLED", "MFA_FAILED", "PRIORITY_EXPIRED",
	# Terminal Console stretch — the bank computer and the OBSERVER viewing role
	"CONSOLE_UNAVAILABLE", "OBSERVER_SELF", "OBSERVER_FULL", "NOT_OBSERVER", "RoleWalletLimitReached",
	# Load Account (Ines adopts an owned AccountBlox by number) — docs/LOAD-ACCOUNT.md
	"ACCOUNT_NOT_OWNED", "ACCOUNT_NOT_A_VAULT", "LOAD_POLICY",
	# S1 — Kenji's FX desk (Uniswap v4 on Sepolia)
	"FX_NOT_CONFIGURED", "FX_TILL_CLOSED", "FX_NOT_ENABLED", "FX_TELLER_DRY", "FX_AMOUNT",
	"FX_QUOTE_FAILED", "FX_QUOTE_EXPIRED", "FX_SLIPPAGE", "FX_ROUTER", "FX_RPC", "FX_TX_FAILED", "FX_TILL_SHORT",
	"default",
]

var failures := 0


func _initialize() -> void:
	var Dlg := load("res://autoload/dialogue.gd")
	_check_errors()
	for id in NPCS:
		_check_npc(id)
	for id in PROPS:
		_check_npc(id)
	_check_faucet_choice()
	_check_load_account()
	_check_terminal()
	_check_se_corner()
	_check_fx_desk()
	_check_vault_desks()
	_check_ao_desk_polish()
	_check_counter_labels()
	_check_polish()
	_check_copy_ens_surface(Dlg)
	_check_player_menu()
	_check_eval(Dlg)
	print("\n%s — %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)


func _fail(msg: String) -> void:
	failures += 1
	print("  ✗ " + msg)


func _ok(msg: String) -> void:
	print("  ✓ " + msg)


func _load(path: String) -> Dictionary:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		return parsed
	_fail("%s does not parse as a JSON object" % path)
	return {}


func _check_errors() -> void:
	print("errors.json")
	var errors := _load("res://dialogue/errors.json")
	for code in REQUIRED_CODES:
		if not errors.has(code):
			_fail("no line for error code %s" % code)
		elif str(errors[code].get("line", "")) == "":
			_fail("empty line for %s" % code)
	if errors.has("BeforeReleaseTime") and str(errors["BeforeReleaseTime"]["line"]).find("cooling") < 0:
		_fail("BeforeReleaseTime must say 'still cooling' (HANDOFF §5c)")
	var n := 0
	for k in errors.keys():
		if k != "_comment":
			n += 1
	_ok("%d codes have lines; all %d required codes present" % [n, REQUIRED_CODES.size()])
	# every SDK ERROR_SIGNATURES name should be covered too; list mirrors @bloxchain/sdk contract-errors.js
	var sdk_names := [
		"InvalidAddress", "NotNewAddress", "InvalidTimeLockPeriod", "TimeLockPeriodZero", "MetaTxExpired", "BeforeReleaseTime", "NewTimelockSame",
		"NoPermission", "NoPermissionForFunction", "RestrictedOwner", "RestrictedOwnerRecovery", "RestrictedRecovery", "RestrictedBroadcaster",
		"SignerNotAuthorized", "MetaTxHandlerSelectorMismatch", "MetaTxHandlerContractMismatch", "OnlyCallableByContract", "NotSupported",
		"InvalidOperationType", "ZeroOperationTypeNotAllowed", "TransactionStatusMismatch", "AlreadyInitialized", "NotInitialized",
		"TransactionIdMismatch", "PendingSecureRequest", "InvalidSignatureLength", "InvalidSignature", "InvalidNonce", "ChainIdMismatch",
		"InvalidHandlerSelector", "InvalidSValue", "InvalidVValue", "ECDSAInvalidSignature", "GasPriceExceedsMax", "ResourceNotFound",
		"ResourceAlreadyExists", "CannotModifyProtected", "ItemAlreadyExists", "ItemNotFound", "InvalidOperation", "DefinitionNotIDefinition",
		"RoleWalletLimitReached", "MaxWalletsZero", "ConflictingMetaTxPermissions", "InternalFunctionNotAccessible", "ContractFunctionMustBeProtected",
		"TargetNotWhitelisted", "FunctionSelectorMismatch", "HandlerForSelectorMismatch", "InvalidRange", "OperationFailed", "InvalidPayment",
		"InsufficientBalance", "PaymentFailed", "ArrayLengthMismatch", "IndexOutOfBounds", "BatchSizeExceeded", "MaxRolesExceeded", "MaxHooksExceeded",
		"MaxFunctionsExceeded", "RangeSizeExceeded", "CustomError", "ReadableText",
	]
	var missing: PackedStringArray = []
	for nme in sdk_names:
		if not errors.has(nme):
			missing.append(nme)
	if missing.is_empty():
		_ok("all %d SDK ERROR_SIGNATURES names have a line" % sdk_names.size())
	else:
		_fail("SDK names without a line: %s" % ", ".join(missing))


func _check_npc(id: String) -> void:
	print("dialogue/%s.json" % id)
	var d := _load("res://dialogue/%s.json" % id)
	if d.is_empty():
		return
	var nodes: Dictionary = d.get("nodes", {})
	if str(d.get("id", "")) != id:
		_fail("id mismatch: %s" % str(d.get("id", "")))
	for s in d.get("start", []):
		if not nodes.has(str(s.get("node", ""))):
			_fail("start → missing node %s" % str(s.get("node", "")))
	var has_ask_why := false
	var action_nodes := 0
	for nid in nodes.keys():
		var node: Dictionary = nodes[nid]
		var targets: Array = []
		if node.has("next"):
			targets.append(node["next"])
		var choices: Array = node.get("choices", []).duplicate()
		if node.has("choice_template"):
			choices.append(node["choice_template"])
		if node.has("enter_action"):
			choices.append(node["enter_action"])
		for c in choices:
			for k in ["next", "on_ok", "on_error", "on_instant", "on_vault", "on_submit"]:
				if c.has(k):
					targets.append(c[k])
			if c.has("action") or c.has("form"):
				action_nodes += 1
			if str(c.get("text", "")).begins_with("Ask why"):
				has_ask_why = true
			if c.has("form"):
				# One-value slips (Petra's label, Ines's account number) route through `on_submit`; the payment
				# slip is the only form whose value decides which node comes next (over/under the instant limit).
				var form_kind := str(c.get("form", ""))
				if form_kind == "name_claim" or form_kind == "load_account":
					if not c.has("on_submit"):
						_fail("%s: %s form needs on_submit" % [nid, form_kind])
				elif not (c.has("on_instant") and c.has("on_vault")):
					_fail("%s: form choice needs on_instant + on_vault" % nid)
			if c.has("action") and not c.has("on_error"):
				_fail("%s: action '%s' has no on_error node" % [nid, str(c["action"])])
		for t in targets:
			if str(t) != "end" and not nodes.has(str(t)):
				_fail("%s → missing node %s" % [nid, str(t)])
		if node.has("choices_from") and not node.has("choice_template"):
			_fail("%s: choices_from without choice_template" % nid)
	if action_nodes > 0 and not has_ask_why:
		_fail("has actions but no 'Ask why' choice")
	if nodes.has("refused") and str(nodes["refused"].get("text", "")).find("{reason_line}") < 0:
		_fail("refused node does not show {reason_line}")
	_ok("%d nodes, %d action choices, targets resolve" % [nodes.size(), action_nodes])


## U4+ (HANDOFF §5e): Bob waits the clock, Okafor bypasses it. The dialogue must not hand either the other's verb.
func _check_vault_desks() -> void:
	print("vault desks (U4+)")
	var m := _load("res://dialogue/manager.json")
	var r := _load("res://dialogue/vault_keeper.json")
	var m_actions := _actions_in(m)
	var r_actions := _actions_in(r)
	if m_actions.has("approve") or m_actions.has("manager_approve"):
		_fail("manager.json still stamps a timed approve (Okafor is not a second Bob)")
	if not m_actions.has("priority"):
		_fail("manager.json has no priority action")
	if not m_actions.has("cancel"):
		_fail("manager.json has no recall")
	if r_actions.has("priority"):
		_fail("vault_keeper.json offers priority (Bob is the wait path)")
	if not r_actions.has("approve"):
		_fail("vault_keeper.json has no owner approve")
	var m_text := JSON.stringify(m)
	if m_text.find("hand scan") < 0:
		_fail("manager.json never says 'hand scan'")
	if m_text.find("{priority_copy}") < 0:
		_fail("manager.json does not show the on-screen copy {priority_copy}")
	var strings := _load("res://dialogue/strings.json")
	if str(strings.get("priority_copy", "")) != "Skip the cooling period — hand scan required.":
		_fail("strings.json priority_copy is not the mandated line")
	_ok("Bob: approve only · Okafor: priority + cancel, no approve · copy present")


## U7 practice faucet: Ines exposes the explicit top-up as a done/passbook action, not as Re-check.
func _check_faucet_choice() -> void:
	print("practice faucet choice")
	var clerk := _load("res://dialogue/clerk.json")
	var found := false
	for c in clerk.get("nodes", {}).get("done", {}).get("choices", []):
		if str(c.get("action", "")) != "faucet":
			continue
		found = true
		if str(c.get("text", "")) != "Top up practice dollars":
			_fail("clerk faucet choice has unexpected text")
		if str(c.get("working", "")) != "Counting out practice dollars…":
			_fail("clerk faucet choice has unexpected working copy")
		if str(c.get("on_ok", "")) != "done" or str(c.get("on_error", "")) != "refused":
			_fail("clerk faucet choice must return to done or refused")
	if not found:
		_fail("clerk done has no faucet choice")
	else:
		_ok("Ines offers Top up practice dollars from the done/passbook node")


## Load Account (docs/LOAD-ACCOUNT.md §7): Ines offers the load slip whether or not the player already has an
## account, the slip routes into a node that really runs `load_account`, and "Open my account" keeps the
## last-clone default — a load must be a second, named choice, never a replacement for auto-recovery.
func _check_load_account() -> void:
	print("load account (Ines)")
	var clerk := _load("res://dialogue/clerk.json")
	var nodes: Dictionary = clerk.get("nodes", {})
	var bad: PackedStringArray = []
	var submits := {}
	for nid in ["open", "done", "start_over"]:
		var found := false
		for c in nodes.get(nid, {}).get("choices", []):
			if str(c.get("form", "")) != "load_account":
				continue
			found = true
			if str(c.get("text", "")) != "Load an existing account":
				bad.append("%s: load slip has unexpected text %s" % [nid, str(c.get("text", ""))])
			if not c.has("on_submit"):
				bad.append("%s: load slip has no on_submit" % nid)
			else:
				submits[str(c["on_submit"])] = true
		if not found:
			bad.append("clerk %s has no load_account form choice" % nid)
	# The slip only carries a string; the node it lands on is what asks the desk, and must be able to refuse.
	for target in submits.keys():
		var node: Dictionary = nodes.get(str(target), {})
		var enter: Dictionary = node.get("enter_action", {})
		if str(enter.get("action", "")) != "load_account":
			bad.append("%s does not run the load_account action on entry" % str(target))
		if str(enter.get("on_error", "")) != "refused":
			bad.append("%s must route a refusal to the refused node" % str(target))
		if not nodes.has(str(enter.get("on_ok", ""))):
			bad.append("%s on_ok names no node" % str(target))
	# Auto-recovery stays the default for Open my account (LOAD-ACCOUNT §"out of scope").
	var opens := 0
	for c in nodes.get("open", {}).get("choices", []):
		if str(c.get("action", "")) == "provision":
			opens += 1
	if opens != 1:
		bad.append("clerk open should still offer exactly one provision choice, found %d" % opens)
	var why := str(nodes.get("why_load", {}).get("text", ""))
	if why.find("owner()") < 0:
		bad.append("why_load does not say the desk reads owner()")
	var strings := _load("res://dialogue/strings.json")
	for k in ["load_account_title", "load_account_label", "load_account_hint", "load_account_bad_address", "load_account_submit", "load_account_cancel"]:
		if str(strings.get(k, "")) == "":
			bad.append("strings.json has no %s" % k)
	if str(strings.get("load_account_hint", "")).to_lower().find("terminal") < 0:
		bad.append("load_account_hint does not point at the desk terminal")
	if bad.is_empty():
		_ok("Ines offers the load slip from open/done/start_over → %s; Open my account still recovers the last clone" % ", ".join(PackedStringArray(submits.keys())))
	else:
		for b in bad:
			_fail(b)


## AO desk polish: Ines can open the existing terminal from the post-account path, but never edits OBSERVER wallets.
func _check_ao_desk_polish() -> void:
	print("Account Opening terminal choice")
	var clerk := _load("res://dialogue/clerk.json")
	var nodes: Dictionary = clerk.get("nodes", {})
	var bad: PackedStringArray = []
	var done_console := false
	for c in nodes.get("done", {}).get("choices", []):
		if str(c.get("action", "")) != "open_console":
			continue
		done_console = true
		if str(c.get("text", "")) != "Use the desk terminal":
			bad.append("clerk done terminal choice has unexpected text")
		if str(c.get("working", "")) != "Waking the screen…":
			bad.append("clerk done terminal choice has unexpected working copy")
		if str(c.get("on_ok", "")) != "console_open" or str(c.get("on_error", "")) != "refused":
			bad.append("clerk done terminal choice must return to console_open or refused")
	if not done_console:
		bad.append("clerk done has no open_console choice")
	var start_over_console := false
	for c in nodes.get("start_over", {}).get("choices", []):
		if str(c.get("action", "")) == "open_console" and str(c.get("if", "")) == "has_account":
			start_over_console = true
	if not start_over_console:
		bad.append("clerk start_over has no has_account open_console choice")
	var console_text := str(nodes.get("console_open", {}).get("text", ""))
	if console_text.find("desk screen") < 0 or console_text.to_lower().find("close") < 0:
		bad.append("clerk console_open does not say the Console is on the desk screen and to close the panel")
	var actions := _actions_in(clerk)
	for forbidden in ["observer_grant", "observer_revoke", "observer_list"]:
		if actions.has(forbidden):
			bad.append("clerk.json must not run %s" % forbidden)
	if bad.is_empty():
		_ok("Ines: done + start_over open_console paths · close copy present · no OBSERVER verbs")
	else:
		for b in bad:
			_fail(b)


## AO geometry and west-column signage: preserve screen yaw, keyboard between client and screen, skip Counter2's
## overhead plaque so the visible identity is Counter + Name Desk.
func _check_counter_labels() -> void:
	print("AO keyboard / Counter signage")
	var interior := FileAccess.get_file_as_string("res://scripts/bank_interior.gd")
	var bad: PackedStringArray = []
	if interior.find("_counter(\"Counter1\", 3.0, \"COUNTER\")") < 0:
		bad.append("Counter1 plaque is not COUNTER")
	if interior.find("_counter(\"Counter2\", -1.0, \"\", \"prop_engraver\")") < 0:
		bad.append("Counter2 does not skip its overhead plaque")
	if interior.find("if not label.is_empty():") < 0:
		bad.append("_counter does not guard empty plaque labels")
	if interior.find("plaque(\"NAME DESK SERVICES") < 0 or interior.find("Pay by name at Counter") < 0:
		bad.append("Name Desk service menu is missing the Counter wording")
	if interior.find("PropKit.kit(self, \"AOScreen\", \"computerScreen\", Vector3(-8.6, 0.78, 7.95), PI)") < 0:
		bad.append("AOScreen position or client-facing yaw changed")
	if interior.find("PropKit.kit(self, \"AOKeyboard\", \"computerKeyboard\", Vector3(-8.6, 0.78, 7.65), PI)") < 0:
		bad.append("AOKeyboard is not between the client and the screen")
	var player_copy := ["greeter", "teller", "vault_keeper", "dealer", "errors"]
	for id in player_copy:
		var text := FileAccess.get_file_as_string("res://dialogue/%s.json" % id)
		if text.find("Counter 1") >= 0 or text.find("Counter 2") >= 0 or text.find("COUNTER 1") >= 0 or text.find("COUNTER 2") >= 0:
			bad.append("%s.json still contains numbered Counter copy" % id)
	var main_text := FileAccess.get_file_as_string("res://scripts/main.gd")
	if main_text.find("[\"teller\", \"Dev\", \"Teller · Counter\"") < 0:
		bad.append("main.gd Dev display role is not Teller · Counter")
	if main_text.find("[\"opening\", Vector3(-8.6, 0.4, 7.95)") < 0:
		bad.append("opening terminal does not follow AO screen z")
	if bad.is_empty():
		_ok("AO order is keyboard 7.65 → screen 7.95 on desk · Counter plaque + Name Desk only")
	else:
		for b in bad:
			_fail(b)


## Terminal Console stretch: the bank computer opens the Console panel and edits the viewing list — and it must never
## grow a write verb. The OBSERVER role is membership only; a terminal that could pay or approve would be the whole
## point of the unit, undone (docs/TERMINAL-CONSOLE.md §5).
func _check_terminal() -> void:
	print("terminal console (OBSERVER)")
	var t := _load("res://dialogue/terminal.json")
	var actions := _actions_in(t)
	var allowed := ["open_console", "observer_list", "observer_grant", "observer_revoke"]
	var bad: PackedStringArray = []
	for a in actions.keys():
		if not allowed.has(str(a)):
			bad.append("terminal.json runs '%s' — the terminal may only open the Console and edit the viewing list" % str(a))
	if not actions.has("open_console"):
		bad.append("terminal.json never opens the Console")
	if not actions.has("observer_revoke"):
		bad.append("terminal.json cannot remove a viewing wallet")
	var text := FileAccess.get_file_as_string("res://dialogue/terminal.json")
	if text.find("choices_from") >= 0 and text.find("\"observers\"") < 0:
		bad.append("terminal.json lists choices from something other than the viewing wallets")
	if text.find("read") < 0:
		bad.append("terminal.json never tells the player a viewing wallet only reads")
	# The words the player is given have to match the grant: membership, no permissions.
	var why := str(t.get("nodes", {}).get("why_viewing", {}).get("text", ""))
	if why.find("OBSERVER") < 0 or why.to_lower().find("no permission") < 0:
		bad.append("terminal.json 'why' does not say OBSERVER carries no permissions")
	var strings := _load("res://dialogue/strings.json")
	if not str(strings.get("prompt_terminal", "")).begins_with("[Space]"):
		bad.append("prompt_terminal missing or not a [Space] prompt")
	# The Console is a browser panel; a MockChain walk must be told so rather than shown an empty screen.
	var errors := _load("res://dialogue/errors.json")
	if str(errors.get("CONSOLE_UNAVAILABLE", {}).get("line", "")).find("full bank window") < 0:
		bad.append("CONSOLE_UNAVAILABLE does not say the panel needs the full bank window")
	if bad.is_empty():
		_ok("terminal: open_console + viewing list only, no write verbs · [Space] prompt · read-only copy present")
	else:
		for b in bad:
			_fail(b)


## SE explore pass: geometry stays in bank_interior.gd while the third screen reuses the existing terminal path.
func _check_se_corner() -> void:
	print("SE partners board + lobby terminal")
	var interior := FileAccess.get_file_as_string("res://scripts/bank_interior.gd")
	var main_text := FileAccess.get_file_as_string("res://scripts/main.gd")
	var bad: PackedStringArray = []
	for needle in ["func _partners_board()", "PartnersBoardEventPanel", "BloxchainPanel", "ParticlePanel", "func _lobby_terminal()", "LobbyScreen", "LobbyKeyboard"]:
		if interior.find(needle) < 0:
			bad.append("bank_interior.gd is missing %s" % needle)
	if main_text.find('["lobby", Vector3(11.35, 0.4, 9.15), "the lobby terminal"]') < 0:
		bad.append("main.gd has no registered lobby terminal")
	if bad.is_empty():
		_ok("event → partners → Bloxchain | Particle board present · third BankTerminal screen registered")
	else:
		for b in bad:
			_fail(b)


## S1 (HANDOFF §5i): Kenji quotes and swaps, and does nothing else. The FX desk is a *third* lane on a *second* chain,
## so the risk it adds is scope creep in the dialogue — a dealer who could pay, wire or release would put the vault's
## whole story behind a desk with no clock. He may only price (a read), open the till, and swap; the guard story has
## to be sayable at the desk; and the quote board must promise a countdown the desk clock can actually keep.
func _check_fx_desk() -> void:
	print("FX desk (S1)")
	var dealer := _load("res://dialogue/dealer.json")
	var actions := _actions_in(dealer)
	var allowed := ["fx_quote", "fx_enable", "fx_swap"]
	var bad: PackedStringArray = []
	for a in actions.keys():
		if not allowed.has(str(a)):
			bad.append("dealer.json runs '%s' — Kenji may only quote, open the till and swap" % str(a))
	for want in allowed:
		if not actions.has(want):
			bad.append("dealer.json never runs '%s'" % want)
	var text := FileAccess.get_file_as_string("res://dialogue/dealer.json")
	# the guard story is the submission's whole angle: it must be on the main path, not only in a why_ node
	if text.find("approved list") < 0:
		bad.append("dealer.json never tells the player the router is on an approved list")
	# fiat pairs (2026-09-09): Kenji sells euros and shekels, both reachable by choice, and never ether
	var pairs_quoted := {}
	for nid in dealer.get("nodes", {}).keys():
		for c in dealer["nodes"][nid].get("choices", []):
			if str(c.get("action", "")) == "fx_quote":
				pairs_quoted[str(c.get("args", {}).get("pair", ""))] = true
	for pair in ["EUR", "ILS"]:
		if not pairs_quoted.has(pair):
			bad.append("dealer.json never quotes %s — both fiat pairs must be a dialogue choice" % pair)
	if text.to_lower().find("ether") >= 0:
		bad.append("dealer.json still talks about ether — the FX desk is fiat (USD → EUR | ILS)")
	for word in ["euro", "shekel"]:
		if text.to_lower().find(word) < 0:
			bad.append("dealer.json never says '%s'" % word)
	for phrase in ["approve(address,uint256)", "execute(bytes,bytes[],uint256)"]:
		if text.find(phrase) < 0:
			bad.append("dealer.json 'Ask why' does not name %s" % phrase)
	# a quote the player can act on has to say what it is worth and how long it stands
	var quoted: Dictionary = dealer.get("nodes", {}).get("quoted", {})
	var quoted_text := str(quoted.get("text", ""))
	for token in ["{fx_amount_out}", "{fx_min_out}", "{fx_valid}"]:
		if quoted_text.find(token) < 0:
			bad.append("dealer.json quoted node does not show %s" % token)
	var strings := _load("res://dialogue/strings.json")
	for key in ["fx_board_title", "fx_board_quote", "fx_board_valid", "fx_board_whitelist", "fx_board_dark", "fx_board_idle", "fx_board_till"]:
		if str(strings.get(key, "")) == "":
			bad.append("strings.json is missing %s" % key)
	if str(strings.get("fx_board_title", "")).find("UNISWAP") < 0:
		bad.append("the quote board does not name the exchange it quotes")
	for token in ["{fx_rate_eur}", "{fx_rate_ils}"]:
		if str(strings.get("fx_board_idle", "")).find(token) < 0:
			bad.append("the idle quote board does not show %s" % token)
	# errors.json carries the fiat desk's refusal for a currency it does not deal in
	var errs := _load("res://dialogue/errors.json")
	if str(errs.get("FX_PAIR", {}).get("line", "")) == "":
		bad.append("errors.json has no FX_PAIR line")
	# MockChain must never be mistaken for the sponsor evidence
	var mock := FileAccess.get_file_as_string("res://autoload/mock_chain.gd")
	if mock.find("MockChain: no Uniswap here") < 0:
		bad.append("mock_chain.gd does not label its fake swap")
	if bad.is_empty():
		_ok("Kenji: quote + open till + swap only · EUR and ILS both quotable, no ether · guard story on the main path · board names the exchange, both pairs and its countdown")
	else:
		for b in bad:
			_fail(b)


## U7 polish (principal playtest findings 7 · 8 · 10): the vault keeper is Bob everywhere a player can read it, the
## prompts and legend say Space (E orbits), the F-keys live only in the debug legend, and the elevator's Arc line is a
## "coming soon" — never a wing swap.
func _check_polish() -> void:
	print("U7 polish strings")
	var strings := _load("res://dialogue/strings.json")
	var bad: PackedStringArray = []
	for id in NPCS:
		var text := FileAccess.get_file_as_string("res://dialogue/%s.json" % id)
		if text.find("Ruth") >= 0:
			bad.append("%s.json still says Ruth" % id)
		if text.find("[E]") >= 0:
			bad.append("%s.json still shows an [E] prompt" % id)
	for f in ["errors", "strings"]:
		var text := FileAccess.get_file_as_string("res://dialogue/%s.json" % f)
		if text.find("Ruth") >= 0:
			bad.append("%s.json still says Ruth" % f)
		if text.find("[E]") >= 0:
			bad.append("%s.json still shows an [E] prompt" % f)
	var keeper := _load("res://dialogue/vault_keeper.json")
	if str(keeper.get("name", "")) != "Bob":
		bad.append("vault_keeper.json name is %s, want Bob" % str(keeper.get("name", "")))
	if not str(strings.get("prompt_talk", "")).begins_with("[Space]"):
		bad.append("prompt_talk does not start with [Space]")
	for k in ["prompt_elevator_arc", "prompt_elevator_main"]:
		if not str(strings.get(k, "")).begins_with("[Space]"):
			bad.append("%s missing or not a [Space] prompt" % k)
	if str(strings.get("elevator_arc_deferred", "")).to_lower().find("coming soon") < 0:
		bad.append("elevator_arc_deferred missing or does not say 'coming soon'")
	if str(strings.get("prompt_elevator_arc", "")).to_lower().find("coming soon") < 0:
		bad.append("prompt_elevator_arc does not say 'coming soon'")
	var help := str(strings.get("help", ""))
	if help.find("Space") < 0 or help.find(" E ") >= 0 or help.find("F2") >= 0:
		bad.append("help legend must name Space to talk and keep the F-keys out (they belong to help_debug)")
	if str(strings.get("help_debug", "")).find("F2") < 0:
		bad.append("help_debug does not list the F-key teleports")
	if str(strings.get("escort_arrived", "")).find("Bob") < 0:
		bad.append("escort_arrived does not hand over to Bob")
	if bad.is_empty():
		_ok("Bob is the keeper · [Space] prompts · Space in the legend, F-keys only in help_debug · Arc elevator says coming soon")
	else:
		for b in bad:
			_fail(b)


## Copy/ENS refinement: the cheap truthful surfaces share one vocabulary — passbook, customer-name board and payment slip.
## This check deliberately does not require a new reverse-resolution route: that remains an owed proposal.
## ENS passbook polish: the name row and the tier row exist only for a named customer, and Mo / Ines never print a
## "not chosen yet" placeholder; the tier comes from the desk mirror (`/session.ensTier`), never a local fake.
func _check_copy_ens_surface(Dlg) -> void:
	print("Copy and ENS surfaces")
	var strings := _load("res://dialogue/strings.json")
	var bad: PackedStringArray = []
	if str(strings.get("passbook_name", "")).find("{bank_name}") < 0:
		bad.append("passbook_name does not interpolate the chosen bank name")
	if str(strings.get("name_claim_hint", "")).to_lower().find("counter") < 0:
		bad.append("name_claim_hint does not explain pay-by-name at Counter")
	if str(strings.get("slip_name_toggle", "")).to_lower().find("customer name") < 0:
		bad.append("payment slip still hides the customer-name route behind protocol wording")
	if str(strings.get("slip_hint", "")).find("{limit}") < 0 or str(strings.get("slip_hint", "")).find("{timelock}") < 0:
		bad.append("slip_hint lost {limit}/{timelock} interpolation")
	var hud := FileAccess.get_file_as_string("res://scripts/hud.gd")
	if hud.find("passbook_name") < 0:
		bad.append("hud.gd does not show the bank name in the passbook")
	if str(strings.get("passbook_tier", "")).find("{bank_tier}") < 0:
		bad.append("passbook_tier does not interpolate the desk's tier mirror")
	if hud.find("passbook_tier") < 0 or hud.find("has_ens_name") < 0:
		bad.append("hud.gd does not condition the bank-name and tier rows on has_ens_name")
	var gs_src := FileAccess.get_file_as_string("res://autoload/game_state.gd")
	if gs_src.find("not chosen yet") >= 0 or gs_src.find("\"bank_tier\"") < 0 or gs_src.find("\"has_ens_name\"") < 0:
		bad.append("game_state.gd still prints a bank-name placeholder, or lacks bank_tier / the has_ens_name fact")
	var mock_src := FileAccess.get_file_as_string("res://autoload/mock_chain.gd")
	if mock_src.find("\"ensTier\"") < 0:
		bad.append("MockChain session does not carry ensTier like the Teller Desk /session")
	# Mo and Ines mention the bank name only for a named customer; an unnamed one hears nothing about it.
	var unnamed := {"booted": true, "logged_in": true, "has_account": true, "has_ens_name": false}
	var named := unnamed.duplicate()
	named["has_ens_name"] = true
	for probe in [["greeter", "has_account"], ["clerk", "done"], ["clerk", "loaded"]]:
		var node: Dictionary = _load("res://dialogue/%s.json" % probe[0]).get("nodes", {}).get(probe[1], {})
		var quiet: String = Dlg.resolve_text(node, unnamed)
		var loud: String = Dlg.resolve_text(node, named)
		if quiet.find("{bank_name}") >= 0 or quiet.to_lower().find("bank name") >= 0 or quiet.find("not chosen") >= 0:
			bad.append("%s.%s names the bank name for an unnamed customer: %s" % [probe[0], probe[1], quiet])
		if probe[1] != "loaded" and loud.find("{bank_name}") < 0:
			bad.append("%s.%s no longer mentions the bank name for a named customer" % [probe[0], probe[1]])
	var board := FileAccess.get_file_as_string("res://scripts/names_board.gd")
	if board.find("ENSv2 SEPOLIA") >= 0:
		bad.append("names_board.gd still exposes ENSv2 in its player-facing title")
	var interior := FileAccess.get_file_as_string("res://scripts/bank_interior.gd")
	if interior.find("Customer names") < 0:
		bad.append("payee plaque does not mention customer names")
	if bad.is_empty():
		_ok("passbook bank name + tier only when named · Mo / Ines quiet when unnamed · customer-name board · pay-by-name slip · honest limit/cooling hints")
	else:
		for b in bad:
			_fail(b)


## Player menu (docs/HANDOFF-player-menu.md): the front door and the visitor's card use everyday bank words and never
## carry a desk or operator verb — Sign in / Load Account stay with Ines, Live / Dev / Mock with desk-debug, the wing
## switch with the elevator, the Console with the terminals. No SaaS chrome (New Game / Options / Quit) either.
func _check_player_menu() -> void:
	print("Player menu strings")
	var strings := _load("res://dialogue/strings.json")
	var bad: PackedStringArray = []
	var keys := ["menu_brand", "menu_tagline", "menu_enter", "menu_controls", "menu_about", "menu_about_text", "menu_back",
		"pause_title", "pause_resume", "pause_controls", "pause_sound_on", "pause_sound_off", "pause_leave", "pause_leave_ask",
		"pause_leave_yes", "pause_leave_no"]
	var blob := ""
	for k in keys:
		var v := str(strings.get(k, ""))
		if v == "":
			bad.append("strings.json has no %s" % k)
		blob += "\n" + v.to_lower()
	if str(strings.get("menu_brand", "")) != "Branch Zero":
		bad.append("menu_brand must read Branch Zero")
	if str(strings.get("menu_enter", "")) != "Enter the branch":
		bad.append("menu_enter must read Enter the branch")
	if str(strings.get("menu_tagline", "")).to_lower().find("bank you can walk through") < 0:
		bad.append("menu_tagline must carry the DEMO-SCRIPT line (a bank you can walk through)")
	if str(strings.get("pause_leave", "")) != "Leave for today":
		bad.append("pause_leave must read Leave for today")
	for forbidden in ["sign in", "load account", "live", "dev ", "mock", "arc", "wing", "console", "achievement", "save slot",
		"new game", "options", "quit", "settings"]:
		if blob.find(forbidden) >= 0:
			bad.append("menu / pause strings must not say '%s' (it has an owner elsewhere or is SaaS chrome)" % forbidden)
	if str(strings.get("help", "")).to_lower().find("visitor") < 0:
		bad.append("help legend does not tell the player Esc opens the visitor's card")
	if bad.is_empty():
		_ok("front door + visitor's card: bank words only · Enter the branch · Leave for today · no desk / operator verbs")
	else:
		for b in bad:
			_fail(b)


func _actions_in(d: Dictionary) -> Dictionary:
	var out := {}
	for nid in d.get("nodes", {}).keys():
		var node: Dictionary = d["nodes"][nid]
		var choices: Array = node.get("choices", []).duplicate()
		if node.has("choice_template"):
			choices.append(node["choice_template"])
		if node.has("enter_action"):
			choices.append(node["enter_action"])
		for c in choices:
			if c.has("action"):
				var a := str(c["action"])
				if str(c.get("as", "")) == "manager" and (a == "approve" or a == "cancel"):
					a = "manager_" + a
				out[a] = true
				if a.begins_with("manager_"):
					out[a.substr(8)] = true
	return out


func _check_eval(Dlg) -> void:
	print("condition evaluator / interpolation")
	var facts := {"logged_in": true, "has_account": false, "pending": 2, "released": 0, "cooling": 2, "delegated": false, "manager": true, "priority": true}
	var cases := [
		["logged_in", true], ["!logged_in", false], ["!has_account", true], ["pending>0", true], ["pending>2", false],
		["released==0", true], ["pending>=2", true], ["logged_in && !has_account", true], ["logged_in && has_account", false],
		["!delegated && !has_account", true], ["manager", true], ["", true],
		["cooling>0", true], ["cooling==0 && released>0", false], ["!priority", false],
	]
	for c in cases:
		var got: bool = Dlg.eval_condition(c[0], facts)
		if got != c[1]:
			_fail("eval('%s') = %s, want %s" % [c[0], got, c[1]])
	var start: String = Dlg.pick_start({"start": [{"if": "!logged_in", "node": "a"}, {"if": "pending>0", "node": "b"}, {"node": "c"}]}, facts)
	if start != "b":
		_fail("pick_start → %s, want b" % start)
	var text: String = Dlg.interpolate("Hi {name}, {pending} cooling, {missing}", {"name": "Ada", "pending": 2})
	if text != "Hi Ada, 2 cooling, {missing}":
		_fail("interpolate → %s" % text)
	_ok("%d condition cases, pick_start, interpolate" % cases.size())
