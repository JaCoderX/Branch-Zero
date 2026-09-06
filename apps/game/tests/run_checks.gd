extends SceneTree
## Headless checks for the dialogue data and the pure helpers. No chain, no browser.
##
##   godot --headless --path apps/game -s tests/run_checks.gd
##
## Asserts: every dialogue JSON parses; every `next` / `on_ok` / `on_error` / `on_instant` / `on_vault` target
## exists; every node with an action has an "Ask why" choice somewhere reachable in the same file; every error
## code in docs/NPCS.md §5 (and every Teller Desk / bridge code the lanes emit) has a line in errors.json;
## the condition evaluator and interpolation behave.

const NPCS := ["greeter", "clerk", "teller", "vault_keeper", "manager"]

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
	"NO_ACCOUNT", "NO_WALLET", "NO_MANAGER", "NOT_PENDING", "RECORD_*", "policy_violation", "Unknown",
	"TIMEOUT", "UNKNOWN_METHOD", "BAD_ARGS", "RPC", "NOT_IMPLEMENTED", "INTERNAL", "AUTH", "POLICY", "CHAIN", "LOGIN_CANCELLED",
	"default",
]

var failures := 0


func _initialize() -> void:
	var Dlg := load("res://autoload/dialogue.gd")
	_check_errors()
	for id in NPCS:
		_check_npc(id)
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
			for k in ["next", "on_ok", "on_error", "on_instant", "on_vault"]:
				if c.has(k):
					targets.append(c[k])
			if c.has("action") or c.has("form"):
				action_nodes += 1
			if str(c.get("text", "")).begins_with("Ask why"):
				has_ask_why = true
			if c.has("form") and not (c.has("on_instant") and c.has("on_vault")):
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


func _check_eval(Dlg) -> void:
	print("condition evaluator / interpolation")
	var facts := {"logged_in": true, "has_account": false, "pending": 2, "released": 0, "delegated": false, "manager": true}
	var cases := [
		["logged_in", true], ["!logged_in", false], ["!has_account", true], ["pending>0", true], ["pending>2", false],
		["released==0", true], ["pending>=2", true], ["logged_in && !has_account", true], ["logged_in && has_account", false],
		["!delegated && !has_account", true], ["manager", true], ["", true],
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
