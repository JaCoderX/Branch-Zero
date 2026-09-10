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
## Dialogue files that are not NPCs. The bank computer runs the same format (docs/TERMINAL-CONSOLE.md §3); so does the
## optional service assistant (docs/INPC.md), which is a prop and not a staff row.
const PROPS := ["terminal", "inpc"]

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
	# U4+ Priority release (Walker) — desk + overlay codes
	"MANAGER_NO_STAMP", "NOT_COOLING", "PRIORITY_OFF", "PRIORITY_CANCELLED", "MFA_FAILED", "PRIORITY_EXPIRED",
	# Terminal Console stretch — the bank computer and the OBSERVER viewing role
	"CONSOLE_UNAVAILABLE", "OBSERVER_SELF", "OBSERVER_FULL", "NOT_OBSERVER", "RoleWalletLimitReached",
	# iNPC (docs/INPC.md) — the assistant's panel is the shell's; MockChain says so
	"INPC_UNAVAILABLE",
	# Load Account (Iris adopts an owned AccountBlox by number) — docs/LOAD-ACCOUNT.md
	"ACCOUNT_NOT_OWNED", "ACCOUNT_NOT_A_VAULT", "LOAD_POLICY",
	# S1 — Johnny's FX desk (Uniswap v4 on Sepolia)
	"FX_NOT_CONFIGURED", "FX_TILL_CLOSED", "FX_NOT_ENABLED", "FX_TELLER_DRY", "FX_AMOUNT",
	"FX_QUOTE_FAILED", "FX_QUOTE_EXPIRED", "FX_SLIPPAGE", "FX_ROUTER", "FX_RPC", "FX_TX_FAILED", "FX_TILL_SHORT",
	"FX_TILL_NOT_SEPOLIA", "FX_SEPOLIA_ONLY", "FX_PAIR",
	# FX bidirectional + fiat Lane A (2026-09-10) — a direction the desk does not know; a currency the counter does not move
	"FX_SIDE", "PAY_TOKEN",
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
	_check_greeter_graph(Dlg)
	_check_faucet_choice()
	_check_load_account()
	_check_terminal()
	_check_inpc()
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
				# One-value slips (Petra's label, Iris's account number) route through `on_submit`; the payment
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


## Ash's lobby graph: the three ready-to-talk states must reach the small hub; bank language stays out of the
## technical spokes; named-customer copy remains quiet until has_ens_name is true; and Ash stays read-only.
func _check_greeter_graph(Dlg) -> void:
	print("Ash greeter knowledge graph")
	var d := _load("res://dialogue/greeter.json")
	var nodes: Dictionary = d.get("nodes", {})
	var bad: PackedStringArray = []
	for id in ["hub", "directory", "directory_more", "payments_vault", "desk_iris", "desk_counter", "desk_vault", "desk_manager", "desk_petra", "desk_fx", "service_assistant", "partners_strip", "lore_bank", "lore_bank_tech", "why_privy", "why_counter", "why_vault", "why_vault_tech", "why_manager", "why_ens", "why_fx", "why_partners"]:
		if not nodes.has(id):
			bad.append("greeter graph is missing %s" % id)
	for id in ["no_account", "has_account", "pending"]:
		var reaches_hub := false
		for c in nodes.get(id, {}).get("choices", []):
			if str(c.get("next", "")) == "hub":
				reaches_hub = true
		if not reaches_hub:
			bad.append("%s cannot return to the lobby hub" % id)
	for pin in [
		["no_account", "Point me to Iris.", "desk_iris"],
		["has_account", "Claim a bank name?", "desk_petra"],
		["hub", "What desks are open?", "directory"],
		["hub", "Who powers the desks?", "partners_strip"],
		["directory", "More desks", "directory_more"],
		["directory_more", "FX Desk · Johnny", "desk_fx"],
		["directory_more", "Blox-47 (beside me)", "service_assistant"],
		["pending", "Go to the vault.", "desk_vault"],
	]:
		var found := false
		for c in nodes.get(pin[0], {}).get("choices", []):
			if str(c.get("text", "")) == pin[1] and str(c.get("next", "")) == pin[2]:
				found = true
		if not found:
			bad.append("mock walk lost %s → %s → %s" % [pin[0], pin[1], pin[2]])
	# Soft ENS invite is only for unnamed customers.
	var ens_invite_ok := false
	for c in nodes.get("has_account", {}).get("choices", []):
		if str(c.get("text", "")) == "Claim a bank name?" and str(c.get("if", "")) == "!has_ens_name" and str(c.get("next", "")) == "desk_petra":
			ens_invite_ok = true
	if not ens_invite_ok:
		bad.append("has_account lost the !has_ens_name Name Desk invite")
	var hub_choices: Array = nodes.get("hub", {}).get("choices", [])
	if hub_choices.size() > 6:
		bad.append("hub exposes %d choices; keep it at six or fewer" % hub_choices.size())
	var hub_no_account := false
	var hub_account := false
	for c in hub_choices:
		if str(c.get("text", "")) == "Open an account" and str(c.get("if", "")) == "!has_account":
			hub_no_account = true
		if str(c.get("text", "")) == "Payments & the vault" and str(c.get("if", "")) == "has_account":
			hub_account = true
	if not hub_no_account or not hub_account:
		bad.append("hub lost the account-aware opening/payment routes")
	if _actions_in(d).size() > 0:
		bad.append("greeter.json contains a write action")
	var main_path := ""
	for id in ["no_account", "has_account", "pending", "hub", "directory", "directory_more", "payments_vault", "desk_iris", "desk_counter", "desk_vault", "desk_manager", "desk_petra", "desk_fx", "service_assistant", "partners_strip", "lore_bank", "why_vault"]:
		main_path += str(nodes.get(id, {}).get("text", "")).to_lower()
	for jargon in ["privy", "uniswap", "ensv2", "meta-transaction", "broadcaster", "timelock", "releasetime", " gas"]:
		if main_path.find(jargon) >= 0:
			bad.append("main path leaks Ask-why term '%s'" % jargon.strip_edges())
	var tech_expectations := {
		"why_privy": ["privy", "session signer"],
		"why_counter": ["meta-transaction", "broadcaster", "gas"],
		"why_vault_tech": ["bloxchain", "releasetime", "not my timer"],
		"why_manager": ["hand-scan", "cooling", "bob"],
		"why_ens": ["ensv2", "accountblox"],
		"why_fx": ["uniswap v4", "sepolia"],
		"why_partners": ["privy", "ens", "uniswap", "arc", "coming soon"],
		"lore_bank_tech": ["bloxchain", "broadcaster", "timelock"],
	}
	for id in tech_expectations.keys():
		var text := str(nodes.get(id, {}).get("text", "")).to_lower()
		for needle in tech_expectations[id]:
			if text.find(str(needle)) < 0:
				bad.append("%s is missing Ask-why fact '%s'" % [id, needle])
	var unnamed := {"booted": true, "logged_in": true, "has_account": true, "has_ens_name": false}
	var named := unnamed.duplicate()
	named["has_ens_name"] = true
	var petra_quiet: String = Dlg.resolve_text(nodes.get("desk_petra", {}), unnamed)
	var petra_named: String = Dlg.resolve_text(nodes.get("desk_petra", {}), named)
	if petra_quiet.find("{bank_name}") >= 0 or petra_quiet.to_lower().find("bank name") >= 0:
		bad.append("greeter.desk_petra names the bank name for an unnamed customer")
	if petra_named.find("{bank_name}") < 0:
		bad.append("greeter.desk_petra lost the named-customer bank name")
	if bad.is_empty():
		_ok("hub reachable from all starts · six-choice cap · bank words on main path · technical spokes pinned · Ash read-only")
	else:
		for b in bad:
			_fail(b)


## U4+ (HANDOFF §5e): Bob waits the clock, Walker bypasses it. The dialogue must not hand either the other's verb.
func _check_vault_desks() -> void:
	print("vault desks (U4+)")
	var m := _load("res://dialogue/manager.json")
	var r := _load("res://dialogue/vault_keeper.json")
	var m_actions := _actions_in(m)
	var r_actions := _actions_in(r)
	if m_actions.has("approve") or m_actions.has("manager_approve"):
		_fail("manager.json still stamps a timed approve (Walker is not a second Bob)")
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
	_ok("Bob: approve only · Walker: priority + cancel, no approve · copy present")


## U7 practice faucet: Iris exposes the explicit top-up as a done/passbook action, not as Re-check.
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
		_ok("Iris offers Top up practice dollars from the done/passbook node")


## Load Account (docs/LOAD-ACCOUNT.md §7): Iris offers the load slip whether or not the player already has an
## account, the slip routes into a node that really runs `load_account`, and "Open my account" keeps the
## last-clone default — a load must be a second, named choice, never a replacement for auto-recovery.
func _check_load_account() -> void:
	print("load account (Iris)")
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
		_ok("Iris offers the load slip from open/done/start_over → %s; Open my account still recovers the last clone" % ", ".join(PackedStringArray(submits.keys())))
	else:
		for b in bad:
			_fail(b)


## AO desk polish: Iris can open the existing terminal from the post-account path, but never edits OBSERVER wallets.
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
		_ok("Iris: done + start_over open_console paths · close copy present · no OBSERVER verbs")
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
	if main_text.find("[\"teller\", \"Eve\", \"Teller · Counter\"") < 0:
		bad.append("main.gd Eve display role is not Teller · Counter")
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


## iNPC (docs/INPC.md): a prop, not staff. Its dialogue may only open the shell's panel or forget the key; the copy must
## tell the player the key is theirs, session-only and wiped on Sleep; the prompt is a [Space] line; MockChain's refusal
## has a bank line; and no staff file mentions it (the roster in NPCS.md is unchanged).
func _check_inpc() -> void:
	print("iNPC (service assistant)")
	var d := _load("res://dialogue/inpc.json")
	var actions := _actions_in(d)
	var bad: PackedStringArray = []
	for a in actions.keys():
		if not ["open_inpc", "sleep_inpc"].has(str(a)):
			bad.append("inpc.json runs '%s' — the assistant may only open its panel or forget the key" % str(a))
	if not actions.has("open_inpc"):
		bad.append("inpc.json never opens the panel")
	if not actions.has("sleep_inpc"):
		bad.append("inpc.json cannot put the assistant to sleep")
	var text := FileAccess.get_file_as_string("res://dialogue/inpc.json").to_lower()
	for needle in ["openrouter", "session", "wipe", "never acts"]:
		if text.find(needle) < 0:
			bad.append("inpc.json copy is missing '%s'" % needle)
	var strings := _load("res://dialogue/strings.json")
	for k in ["prompt_inpc_dormant", "prompt_inpc_awake"]:
		if not str(strings.get(k, "")).begins_with("[Space]"):
			bad.append("%s missing or not a [Space] prompt" % k)
	var plate_dormant := str(strings.get("inpc_plate_dormant", "")).to_lower()
	if plate_dormant == "" or plate_dormant.find("openrouter") >= 0:
		bad.append("inpc_plate_dormant must be bank words (no OpenRouter on the world plate)")
	if str(strings.get("inpc_plate_awake", "")) == "":
		bad.append("inpc_plate_awake missing")
	var inpc_src := FileAccess.get_file_as_string("res://scripts/inpc.gd")
	if inpc_src.find("BILLBOARD_ENABLED") >= 0:
		bad.append("inpc.gd still billboards its plate — use a fixed column plaque")
	var errors := _load("res://dialogue/errors.json")
	if str(errors.get("INPC_UNAVAILABLE", {}).get("line", "")).find("full bank window") < 0:
		bad.append("INPC_UNAVAILABLE does not say the panel needs the full bank window")
	# Staff may point the way to the kiosk (Ash's lobby graph does); none may run its verbs or carry its key copy.
	for id in NPCS:
		var st := FileAccess.get_file_as_string("res://dialogue/%s.json" % id).to_lower()
		if st.find("open_inpc") >= 0 or st.find("sleep_inpc") >= 0 or st.find("openrouter") >= 0:
			bad.append("%s.json runs the assistant's verbs or talks OpenRouter — staff dialogue stays staff" % id)
	var main_text := FileAccess.get_file_as_string("res://scripts/main.gd")
	if main_text.find("InpcProp.new()") < 0:
		bad.append("main.gd does not place the assistant")
	var gs := FileAccess.get_file_as_string("res://autoload/game_state.gd")
	for forbidden in ["\"hash\"", "\"owner\":", "\"account\":", "receipts", "desk_linked", "mode()"]:
		var fn_start := gs.find("func inpc_snapshot()")
		var fn_end := gs.find("static func clock_display", fn_start)
		if fn_start >= 0 and fn_end > fn_start and gs.substr(fn_start, fn_end - fn_start).find(forbidden) >= 0:
			bad.append("inpc_snapshot() touches %s — not player-safe" % forbidden)
	if bad.is_empty():
		_ok("inpc: open_inpc + sleep_inpc only · session-only key copy · [Space] prompts · MockChain line · no staff file runs its verbs · snapshot builder avoids hashes/addresses/receipts/mode")
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


## S1 (HANDOFF §5i): Johnny quotes and swaps, and does nothing else. The FX desk is a *third* lane on a *second* chain,
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
			bad.append("dealer.json runs '%s' — Johnny may only quote, open the till and swap" % str(a))
	for want in allowed:
		if not actions.has(want):
			bad.append("dealer.json never runs '%s'" % want)
	var text := FileAccess.get_file_as_string("res://dialogue/dealer.json")
	# the guard story is the submission's whole angle: it must be on the main path, not only in a why_ node
	if text.find("approved list") < 0:
		bad.append("dealer.json never tells the player the router is on an approved list")
	# fiat pairs (2026-09-09): Johnny deals in euros and shekels, both reachable by choice, and never ether.
	# bidirectional (2026-09-10): every pair is quotable as a buy *and* a sell, and a sell prices the fiat amount.
	var sides_quoted := {}
	for nid in dealer.get("nodes", {}).keys():
		for c in dealer["nodes"][nid].get("choices", []):
			if str(c.get("action", "")) == "fx_quote":
				var a: Dictionary = c.get("args", {})
				sides_quoted["%s/%s" % [str(a.get("pair", "")), str(a.get("side", "buy"))]] = true
				if str(a.get("side", "buy")) == "sell" and str(c.get("text", "")).find("{fx_symbol_in}") >= 0:
					bad.append("dealer.json %s: a sell choice prices dollars — the amount is in the sold currency" % nid)
	for pair in ["EUR", "ILS"]:
		for side in ["buy", "sell"]:
			if not sides_quoted.has("%s/%s" % [pair, side]):
				bad.append("dealer.json never quotes a %s %s — both pairs, both directions, must be a dialogue choice" % [pair, side])
	if text.to_lower().find("ether") >= 0:
		bad.append("dealer.json still talks about ether — the FX desk is fiat (USD ↔ EUR | ILS)")
	for phrase in ["one-way", "don't buy them back", "only ever come in"]:
		if text.to_lower().find(phrase) >= 0:
			bad.append("dealer.json still says '%s' — the desk trades both ways since 2026-09-10" % phrase)
	for word in ["euro", "shekel"]:
		if text.to_lower().find(word) < 0:
			bad.append("dealer.json never says '%s'" % word)
	for phrase in ["approve(address,uint256)", "execute(bytes,bytes[],uint256)", "transfer(address,uint256)"]:
		if text.find(phrase) < 0:
			bad.append("dealer.json 'Ask why' does not name %s" % phrase)
	# a quote the player can act on has to say what it is worth, in which currency, and how long it stands
	var quoted: Dictionary = dealer.get("nodes", {}).get("quoted", {})
	var quoted_text := str(quoted.get("text", ""))
	for token in ["{fx_amount_out}", "{fx_min_out}", "{fx_valid}", "{fx_quote_in}"]:
		if quoted_text.find(token) < 0:
			bad.append("dealer.json quoted node does not show %s" % token)
	# the receipt line must read the fill, not a board that has just been cleared
	var swapped_text := str(dealer.get("nodes", {}).get("swapped", {}).get("text", ""))
	if swapped_text.find("{fx_filled_out}") < 0 or swapped_text.find("{fx_amount_in}") >= 0:
		bad.append("dealer.json swapped node must read the last fill ({fx_filled_*}), not the cleared quote")
	var strings := _load("res://dialogue/strings.json")
	for key in ["fx_board_title", "fx_board_quote", "fx_board_valid", "fx_board_whitelist", "fx_board_dark", "fx_board_idle", "fx_board_till"]:
		if str(strings.get(key, "")) == "":
			bad.append("strings.json is missing %s" % key)
	if str(strings.get("fx_board_title", "")).find("UNISWAP") < 0:
		bad.append("the quote board does not name the exchange it quotes")
	for token in ["{fx_rate_eur}", "{fx_rate_ils}"]:
		if str(strings.get("fx_board_idle", "")).find(token) < 0:
			bad.append("the idle quote board does not show %s" % token)
	if str(strings.get("fx_board_quote", "")).find("{fx_quote_in}") < 0:
		bad.append("the quote board's quote line must name the sold currency ({fx_quote_in}) — a sell is not in dollars")
	if str(strings.get("fx_board_whitelist", "")).to_lower().find("one-way") >= 0:
		bad.append("the quote board still calls the desk one-way")
	# errors.json carries the fiat desk's refusals: a currency it does not deal in, a direction it does not know
	var errs := _load("res://dialogue/errors.json")
	for code in ["FX_PAIR", "FX_SIDE", "PAY_TOKEN"]:
		if str(errs.get(code, {}).get("line", "")) == "":
			bad.append("errors.json has no %s line" % code)
	# MockChain must never be mistaken for the sponsor evidence
	var mock := FileAccess.get_file_as_string("res://autoload/mock_chain.gd")
	if mock.find("MockChain: no Uniswap here") < 0:
		bad.append("mock_chain.gd does not label its fake swap")
	if bad.is_empty():
		_ok("Johnny: quote + open till + swap only · EUR and ILS quotable both ways (sell prices the fiat), no ether, no one-way copy · guard story names approve/execute/transfer · board names the exchange, both pairs, the sold currency and its countdown")
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
## ENS passbook polish: the name row and the tier row exist only for a named customer, and Ash / Iris never print a
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
	# Ash and Iris mention the bank name only for a named customer; an unnamed one hears nothing about it.
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
		_ok("passbook bank name + tier only when named · Ash / Iris quiet when unnamed · customer-name board · pay-by-name slip · honest limit/cooling hints")
	else:
		for b in bad:
			_fail(b)


## Player menu (docs/HANDOFF-player-menu.md): the front door and the visitor's card use everyday bank words and never
## carry a desk or operator verb — Sign in / Load Account stay with Iris, Live / Dev / Mock with desk-debug, the wing
## switch with the elevator, the Console with the terminals. No SaaS chrome (New Game / Options / Quit) either.
func _check_player_menu() -> void:
	print("Player menu strings")
	var strings := _load("res://dialogue/strings.json")
	var bad: PackedStringArray = []
	var keys := ["menu_brand", "menu_tagline", "menu_enter", "menu_controls", "menu_about", "menu_about_text", "menu_back",
		"menu_star_game", "menu_star_protocol",
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
