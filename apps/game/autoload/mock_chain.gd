class_name MockChain
extends Node
## MockChain — the same JSON API as window.BranchZero, answered from canned state with fake latency.
##
## Used on desktop (editor play) and on web behind `?mock`. It exists so the greybox, the NPC lines and the
## vault clock can be walked without an inbox; it proves nothing about the chain (docs/REMOTE-EVM.md §5).
## Every value is obviously fake: addresses start with 0xM0CK, the cooling period is 30 s, receipts are local, and
## the U4+ Priority release "hand scan" is a timer — no Passkey, no signature.

const OWNER := "0xM0CK0000000000000000000000000000000000E7"
const ACCOUNT := "0xM0CK0000000000000000000000000000000ACC7"
const MANAGER := "0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d"
const TIMELOCK_SEC := 30
const INSTANT_LIMIT := "100"
const OPENING_BALANCE := 500.0
## Terminal Console (stretch): how many viewing wallets the mock account will carry.
const OBSERVER_MAX_WALLETS := 3
## S1 FX desk. The mock till starts with practice dollars and no ether; the "pool" is a constant-product curve with
## made-up reserves, so the board moves when you ask for more — it is not a chain and says so.
const FX_ACCOUNT := "0xM0CK00000000000000000000000000000000F0FF"
const FX_OPENING_USDC := 100.0
const FX_POOL_USDC := 240.0
const FX_POOL_WETH := 0.12
const FX_FEE_BPS := 30.0
const FX_SLIPPAGE_BPS := 100.0
const FX_QUOTE_TTL := 300

## Cooling period the mock writes into new wires. The demo autopilot stretches it so the vault beats
## (Bob refuses early, Okafor's Priority release) still happen at a human reading pace.
var timelock_sec: int = TIMELOCK_SEC

var logged_in := false
var delegated := false
var account := ""
var balance := 0.0
var wires: Array = []        # PendingWire dictionaries (strings only, like the real bridge)
var receipts: Array = []     # Receipt dictionaries
var ens_name := ""
var ens_tier := "Silver"
var ens_names: Array = []
var observers: Array = []    # viewing wallets on the mock OBSERVER role (addresses, strings only)
var fx_till := ""            # S1: the mock Sepolia AccountBlox; "" until Kenji opens it
var fx_open := false         # the three whitelisted calls are registered on it
var fx_usdc := 0.0
var fx_weth := 0.0
var _fx_quotes: Dictionary = {}
var _next_tx_id := 1
var _job := 0
## The mock plays the **Live** branch by default, like the real shell does: a mock walk should look like what a
## player gets, not like the operator's lab. `setMode` moves it, and MockChain is still a third thing entirely —
## it is not Live and not Developer Mode, it is canned offline data, and it says so (docs/SEPOLIA-LIVE.md §1).
const SEPOLIA_CHAIN_ID := 11155111
const DEV_CHAIN_ID := 1337
const ARC_CHAIN_ID := 5042002
var chain_id := SEPOLIA_CHAIN_ID


## `?mock=account`: start as a signed-in, delegated player with an open, funded account.
func preset_account() -> void:
	logged_in = true
	delegated = true
	account = ACCOUNT
	balance = OPENING_BALANCE
	ens_name = "test.branchzero.eth"
	ens_tier = "Silver"
	ens_names = [{"label": "test", "name": ens_name, "address": ACCOUNT, "owner": OWNER, "expiry": str(_now() + 365 * 86400), "txHash": _hash()}]
	fx_till = FX_ACCOUNT
	fx_usdc = FX_OPENING_USDC


func call_method(method: String, args: Dictionary) -> Dictionary:
	await get_tree().create_timer(randf_range(0.25, 0.7)).timeout
	match method:
		"echo":
			return _ok({"echo": args.get("msg"), "bridge": "mock"})
		"getSession":
			return _ok(_session())
		"login":
			logged_in = true
			return _ok({"userId": "did:privy:mock", "owner": OWNER, "account": account if account != "" else null, "signingMode": "session" if delegated else "client", "delegated": delegated})
		"logout":
			logged_in = false
			delegated = false
			return _ok({"ok": true})
		"switchWing":
			return _switch_wing(int(args.get("chainId", chain_id)))
		"setMode":
			return _set_mode(str(args.get("mode", "live")))
		"addSessionSigner":
			if not logged_in:
				return _err("AUTH", "not signed in")
			delegated = true
			return _ok({"ok": true})
		"removeSessionSigner":
			delegated = false
			return _ok({"ok": true})
		"provision":
			if not logged_in:
				return _err("AUTH", "not signed in")
			var job := _new_job()
			if account == "":
				_stage(job, "PROVISION", "provisioning", "Creating your account…")
				await get_tree().create_timer(0.8).timeout
				_stage(job, "PROVISION", "configuring", "Registering services and the payee list…")
				await get_tree().create_timer(0.8).timeout
				_stage(job, "PROVISION", "funding", "Putting %s practice dollars in it…" % _fmt(OPENING_BALANCE))
				await get_tree().create_timer(0.5).timeout
				account = ACCOUNT
				balance = OPENING_BALANCE
				_stage(job, "PROVISION", "mined", "Ready.", {"account": account})
			return _ok({"jobId": job, "account": account, "balance": _fmt(balance)})
		"faucet":
			return _faucet()
		"ensAvailable":
			return _ens_available(args)
		"ensMint":
			return await _ens_mint(args)
		"ensSetText":
			return await _ens_set_text(args)
		"resolveName":
			return _resolve_name(args)
		"getPassbook":
			return _ok(_status())
		"listPending":
			return _ok({"items": wires.duplicate(true), "serverNow": _now_str()})
		"getHistory":
			var limit := int(args.get("limit", 8))
			return _ok({"items": receipts.slice(max(0, receipts.size() - limit)), "serverNow": _now_str()})
		"pay":
			return await _pay(args)
		"wire":
			return await _wire(args)
		"approve":
			if str(args.get("as", "owner")) == "manager":
				return _err("MANAGER_NO_STAMP", "the manager does not stamp vault releases (U4+)")
			return await _decide(args, "approve")
		"cancel":
			return await _decide(args, "cancel")
		"priority":
			return await _priority(args)
		"openConsole":
			# The Console panel belongs to the browser shell, and MockChain is what answers when there is no shell
			# (desktop) or when the shell was told to stand down (`?mock`). Saying "opened" here would be a lie the
			# player could see through — an empty screen — so it refuses with a line the terminal has.
			return _err("CONSOLE_UNAVAILABLE", "MockChain has no browser panel to open")
		"observerList":
			return _ok(_observer_list())
		"observerGrant":
			return await _observer_grant(args)
		"observerRevoke":
			return await _observer_revoke(args)
		"fxStatus":
			return _ok(_fx_status())
		"fxQuote":
			return _fx_quote(args)
		"fxEnable":
			return await _fx_enable()
		"fxSwap":
			return await _fx_swap(args)
		_:
			return _err("UNKNOWN_METHOD", "unknown bridge method %s" % method)


## Terminal Console (stretch) — the OBSERVER viewing role, mocked. Membership only: the permission list this
## returns is always empty, because that is the whole invariant the real lane keeps (docs/TERMINAL-CONSOLE.md §5).
func _observer_list() -> Dictionary:
	return {
		"role": "0xM0CK0B5E", "roleName": "OBSERVER", "exists": not observers.is_empty(),
		"maxWallets": OBSERVER_MAX_WALLETS, "wallets": observers.duplicate(), "permissions": [],
	}


func _observer_grant(args: Dictionary) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var address := str(args.get("address", args.get("wallet", ""))).strip_edges()
	if not address.begins_with("0x") or address.length() != 42:
		return _err("BAD_ARGS", "not an address: %s" % address)
	if address.to_lower() == OWNER.to_lower() or address.to_lower() == MANAGER.to_lower():
		return _err("OBSERVER_SELF", "%s already holds a role on this account" % address)
	for w in observers:
		if str(w).to_lower() == address.to_lower():
			var same := _observer_list()
			same["address"] = address
			same["changed"] = false
			return _ok(same)
	if observers.size() >= OBSERVER_MAX_WALLETS:
		return _err("OBSERVER_FULL", "this account already carries %d viewing wallet(s)" % observers.size())
	var job := _new_job()
	_stage(job, "CONFIG", "signing", "Writing the viewing wallet onto your file…")
	await get_tree().create_timer(0.7).timeout
	observers.append(address)
	var h := _hash()
	_stage(job, "CONFIG", "mined", "Viewing wallet added. It can read this account and nothing else.", {"hash": h})
	var res := _observer_list()
	res["address"] = address
	res["changed"] = true
	res["jobId"] = job
	res["hash"] = h
	return _ok(res)


func _observer_revoke(args: Dictionary) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var address := str(args.get("address", args.get("wallet", ""))).strip_edges()
	var idx := -1
	for i in observers.size():
		if str(observers[i]).to_lower() == address.to_lower():
			idx = i
	if idx < 0:
		return _err("NOT_OBSERVER", "%s is not a viewing wallet on this account" % address)
	var job := _new_job()
	_stage(job, "CONFIG", "signing", "Striking the viewing wallet off your file…")
	await get_tree().create_timer(0.6).timeout
	observers.remove_at(idx)
	var h := _hash()
	_stage(job, "CONFIG", "mined", "Viewing wallet removed. That address can no longer read your account.", {"hash": h})
	var res := _observer_list()
	res["address"] = address
	res["changed"] = true
	res["jobId"] = job
	res["hash"] = h
	return _ok(res)


## ---------------------------------------------------------------- S1: Kenji's FX desk, mocked
##
## Enough shape for the greybox to walk the desk: a till, an exchange door that has to be registered before a swap,
## a board whose rate moves with size, and a swap that spends practice dollars for practice ether. Nothing here is a
## chain (docs/UNISWAP.md): the real path is /fx/enable + /fx/quote (V4Quoter) + /fx/swap (Universal Router), and the
## prize evidence is the live Sepolia kill test, never this.

func _fx_status() -> Dictionary:
	return {
		"chainId": 11155111, "configured": true,
		"account": fx_till if fx_till != "" else null,
		"enabled": fx_open,
		"usdc": _fmt(fx_usdc), "weth": "%.6f" % fx_weth,
		"symbolIn": "USDC", "symbolOut": "WETH",
		"pool": {"id": "0xm0ckpool", "fee": "0.30%", "feeBps": 30, "tick": 200311, "liquidity": "53665631459", "router": "0xM0CK000000000000000000000000000000R0UTR", "quoter": "0xM0CK00000000000000000000000000000QU0TER"},
		"whitelist": [
			{"function": "approve(address,uint256)", "selector": "0x095ea7b3", "target": "0xM0CK00000000000000000000000000000000dUSD"},
			{"function": "approve(address,address,uint160,uint48)", "selector": "0x87517c45", "target": "0x000000000022D473030F116dDEE9F6B43aC78BA3"},
			{"function": "execute(bytes,bytes[],uint256)", "selector": "0x3593564c", "target": "0xM0CK000000000000000000000000000000R0UTR"},
		],
		"explorer": {"account": "", "pool": ""},
		"serverNow": _now_str(),
	}


## Constant product with a 0.30 % fee, so a bigger order really does get a worse rate on the board.
func _fx_out(amount: float) -> float:
	var in_after_fee := amount * (1.0 - FX_FEE_BPS / 10000.0)
	return (FX_POOL_WETH * in_after_fee) / (FX_POOL_USDC + in_after_fee)


func _fx_quote(args: Dictionary) -> Dictionary:
	var amount := float(str(args.get("amount", "1")))
	if amount <= 0.0:
		return _err("FX_AMOUNT", "amount must be a positive number")
	var out := _fx_out(amount)
	if out <= 0.0:
		return _err("FX_QUOTE_FAILED", "the pool returned nothing for that amount")
	var min_out := out * (1.0 - FX_SLIPPAGE_BPS / 10000.0)
	var quote_id := "mockq%03d" % (_fx_quotes.size() + 1)
	_fx_quotes[quote_id] = {"amount": amount, "minOut": min_out, "deadline": _now() + FX_QUOTE_TTL}
	return _ok({
		"quoteId": quote_id, "chainId": 11155111,
		"amountIn": _fmt(amount), "amountOut": "%.6f" % out, "minOut": "%.6f" % min_out,
		"rate": "1 USDC ≈ %.6f WETH" % (out / amount), "rateOut": "1 WETH ≈ %.2f USDC" % (amount / out),
		"symbolIn": "USDC", "symbolOut": "WETH", "fee": "0.30%", "slippage": "1%",
		"deadline": str(_now() + FX_QUOTE_TTL), "serverNow": _now_str(), "validSec": FX_QUOTE_TTL,
		"gasEstimate": "120000", "poolId": "0xm0ckpool",
	})


func _fx_enable() -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "Open an account before opening an FX till")
	if fx_till == "":
		fx_till = FX_ACCOUNT
		fx_usdc = FX_OPENING_USDC
	if fx_open:
		return _ok(_fx_status())
	var job := _new_job()
	_stage(job, "FX", "configuring", "Registering the exchange door on your account… (MockChain: nothing on a chain)")
	await get_tree().create_timer(0.8).timeout
	_stage(job, "FX", "configuring", "Authorising you to sign and the FX teller to submit…")
	await get_tree().create_timer(0.6).timeout
	fx_open = true
	var h := _hash()
	_stage(job, "FX", "mined", "Your FX till is open.", {"hash": h, "account": fx_till})
	var res := _fx_status()
	res["jobId"] = job
	res["guardHash"] = h
	return _ok(res)


func _fx_swap(args: Dictionary) -> Dictionary:
	if fx_till == "":
		return _err("FX_TILL_CLOSED", "no FX till for this player yet")
	if not fx_open:
		return _err("FX_NOT_ENABLED", "the exchange door is not registered on this till")
	var quote_id := str(args.get("quoteId", ""))
	var amount := float(str(args.get("amount", "0")))
	if quote_id != "":
		if not _fx_quotes.has(quote_id) or int(_fx_quotes[quote_id]["deadline"]) <= _now():
			return _err("FX_QUOTE_EXPIRED", "that quote has gone stale")
		amount = float(_fx_quotes[quote_id]["amount"])
	if amount <= 0.0:
		return _err("FX_AMOUNT", "a quote or an amount is required")
	if amount > fx_usdc:
		return _err("FX_TILL_SHORT", "the FX till holds %s USDC; the order needs %s" % [_fmt(fx_usdc), _fmt(amount)])
	var job := _new_job()
	var steps: Array = []
	_stage(job, "FX", "signing", "Letting the exchange counter draw practice dollars from your till…")
	await get_tree().create_timer(0.6).timeout
	steps.append({"step": "approve", "hash": _hash(), "explorer": ""})
	_stage(job, "FX", "signing", "Allowing the Universal Router to spend them, with an expiry…")
	await get_tree().create_timer(0.5).timeout
	steps.append({"step": "permit2", "hash": _hash(), "explorer": ""})
	_stage(job, "FX", "signing", "Swapping %s USDC through the Universal Router… (MockChain: no Uniswap here)" % _fmt(amount))
	await get_tree().create_timer(0.8).timeout
	var out := _fx_out(amount)
	fx_usdc -= amount
	fx_weth += out
	var h := _hash()
	steps.append({"step": "execute", "hash": h, "explorer": ""})
	_stage(job, "FX", "mined", "Swapped %s USDC for %.6f WETH." % [_fmt(amount), out], {"hash": h, "account": fx_till})
	if quote_id != "":
		_fx_quotes.erase(quote_id)
	return _ok({
		"jobId": job, "account": fx_till, "chainId": 11155111,
		"amountIn": _fmt(amount), "amountOut": "%.6f" % out, "minOut": "%.6f" % (out * 0.99),
		"symbolIn": "USDC", "symbolOut": "WETH", "steps": steps, "hash": h, "explorer": "",
		"usdcAfter": _fmt(fx_usdc), "wethAfter": "%.6f" % fx_weth, "poolId": "0xm0ckpool", "deadline": str(_now() + FX_QUOTE_TTL),
	})


func _pay(args: Dictionary) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var amount := float(str(args.get("amount", "0")))
	if amount > float(INSTANT_LIMIT):
		return _err("POLICY", "over the %s instant limit — that is a wire: use /wire" % INSTANT_LIMIT)
	if not str(args.get("to", "")).begins_with("0x"):
		return _err("TargetNotWhitelisted", "payee refused by the guard")
	var job := _new_job()
	_stage(job, "A", "signing", "Stamping your slip…")
	await get_tree().create_timer(0.6).timeout
	if amount > balance:
		_stage(job, "A", "failed", "Not enough practice dollars in the account.", {"reason": "InsufficientBalance"})
		return _err("InsufficientBalance", "Insufficient balance: %s (required: %s)" % [_fmt(balance), _fmt(amount)])
	_stage(job, "A", "broadcasting", "Taking it to the counter…")
	await get_tree().create_timer(0.6).timeout
	balance -= amount
	var tx_id := _next_tx_id
	_next_tx_id += 1
	_stage(job, "A", "mined", "Paid %s dUSDC." % _fmt(amount), {"hash": _hash(), "txId": str(tx_id), "amount": _fmt(amount)})
	return _ok({"jobId": job, "hash": _hash(), "txId": str(tx_id), "to": args.get("to"), "amount": _fmt(amount), "balanceAfter": _fmt(balance)})


## Practice faucet: an explicit, Main-wing-only top-up to the opening balance. Full is a no-op.
## Main wing means either payment mode — Live (Sepolia) or Developer Mode (1337); both have a practice till the
## branch can draw on. Only the deferred Arc wing is refused, because its money is real native USDC.
func _faucet() -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	if chain_id == ARC_CHAIN_ID:
		return _err("FAUCET_OFF", "the practice faucet is only available on the Main wing")
	var sym := str(_token()["symbol"])
	if balance >= OPENING_BALANCE:
		return _ok({"balance": _fmt(balance), "symbol": sym, "targetBalance": _fmt(OPENING_BALANCE), "toppedUp": false})
	var delta := OPENING_BALANCE - balance
	balance = OPENING_BALANCE
	return _ok({"balance": _fmt(balance), "symbol": sym, "targetBalance": _fmt(OPENING_BALANCE), "toppedUp": true, "amount": _fmt(delta), "hash": _hash()})


func _ens_available(args: Dictionary) -> Dictionary:
	var label := str(args.get("label", "")).strip_edges().to_lower()
	var result := {"chainId": 11155111, "parent": "branchzero.eth", "recent": ens_names.duplicate(true)}
	if label == "":
		return _ok(result)
	var taken := label == "test" or label == "taken" or label == ens_name.get_slice(".", 0)
	result["label"] = label
	result["name"] = "%s.branchzero.eth" % label
	result["available"] = not taken
	return _ok(result)


func _ens_mint(args: Dictionary) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "Open an account before claiming a name")
	var label := str(args.get("label", "")).strip_edges().to_lower()
	if label == "" or label.contains("."):
		return _err("INVALID_NAME", "choose one label under branchzero.eth")
	if not bool(_ens_available({"label": label}).get("result", {}).get("available", false)):
		return _err("NAME_TAKEN", "%s.branchzero.eth is already registered" % label)
	var job := _new_job()
	_stage(job, "ENS", "signing", "Checking the Name Desk register…")
	await get_tree().create_timer(0.5).timeout
	_stage(job, "ENS", "broadcasting", "Registering %s.branchzero.eth on Sepolia…" % label)
	await get_tree().create_timer(0.8).timeout
	ens_name = "%s.branchzero.eth" % label
	ens_tier = "Silver"
	var row := {"label": label, "name": ens_name, "address": account, "owner": OWNER, "expiry": str(_now() + 365 * 86400), "txHash": _hash()}
	ens_names.append(row)
	_stage(job, "ENS", "broadcasting", "Pointing the name at your AccountBlox…", {"txId": label})
	await get_tree().create_timer(0.5).timeout
	_stage(job, "ENS", "mined", "%s is ready — it points to your AccountBlox." % ens_name, {"hash": row["txHash"], "name": ens_name})
	return _ok({"jobId": job, "label": label, "name": ens_name, "address": account, "owner": OWNER, "expiry": row["expiry"], "txHash": row["txHash"], "txHashes": [row["txHash"]], "tier": "Silver", "account": account})


func _ens_set_text(args: Dictionary) -> Dictionary:
	var name := str(args.get("name", ens_name))
	if name == "" or name != ens_name:
		return _err("NAME_NOT_OWNED", "that name does not point to this account")
	if str(args.get("key", "bz.tier")) != "bz.tier" or not ["Silver", "Gold"].has(str(args.get("value", "Silver"))):
		return _err("BAD_ARGS", "the Name Desk only edits bz.tier to Silver or Gold")
	ens_tier = str(args.get("value", "Silver"))
	var job := _new_job()
	_stage(job, "ENS", "signing", "Preparing the passbook record…")
	await get_tree().create_timer(0.5).timeout
	_stage(job, "ENS", "mined", "%s now carries a %s passbook record." % [name, str(args.get("value", "Silver"))], {"hash": _hash(), "name": name})
	return _ok({"jobId": job, "name": name, "key": "bz.tier", "value": ens_tier, "txHash": _hash(), "chainId": 11155111})


func _resolve_name(args: Dictionary) -> Dictionary:
	var name := str(args.get("name", "")).strip_edges().to_lower()
	for row in ens_names:
		if str(row.get("name", "")).to_lower() == name:
			return _ok({"name": name, "address": str(row.get("address", ACCOUNT)), "chainId": 11155111, "tier": ens_tier if name == ens_name else "Silver"})
	return _err("NAME_NOT_FOUND", "%s has no address record" % name)


func _wire(args: Dictionary) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var amount := float(str(args.get("amount", "0")))
	var job := _new_job()
	_stage(job, "B", "signing", "Filing your wire with the vault…")
	await get_tree().create_timer(0.7).timeout
	if amount > balance:
		var line := "Free balance is %s dUSDC; requested wire is %s dUSDC. Nothing was filed." % [_fmt(balance), _fmt(amount)]
		_stage(job, "B", "failed", line, {"reason": "InsufficientBalance"})
		return _err("InsufficientBalance", line)
	var tx_id := _next_tx_id
	_next_tx_id += 1
	var release := _now() + timelock_sec
	var rec := {
		"txId": str(tx_id), "status": "PENDING", "releaseTime": str(release), "released": false,
		"to": str(args.get("to", "")), "amount": _fmt(amount), "requester": OWNER,
	}
	wires.append(rec)
	_stage(job, "B", "pending", "Wire of %s dUSDC is in the vault. The clock is running." % _fmt(amount), {"hash": _hash(), "txId": str(tx_id), "releaseTime": str(release), "chainNow": str(_now() - 47), "status": "PENDING"})
	_watch(tx_id, job)
	return _ok({"jobId": job, "hash": _hash(), "txId": str(tx_id), "to": rec["to"], "amount": rec["amount"], "releaseTime": str(release), "chainNow": str(_now() - 47), "serverNow": _now_str(), "status": "PENDING"})


func _decide(args: Dictionary, kind: String) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var tx_id := str(args.get("txId", ""))
	var idx := _find(tx_id)
	if idx < 0:
		return _err("NOT_PENDING", "record %s is not PENDING" % tx_id)
	var rec: Dictionary = wires[idx]
	var job := _new_job()
	var actor := "manager" if str(args.get("as", "owner")) == "manager" else "owner"
	var who := "The manager is" if actor == "manager" else "You are"
	_stage(job, "B", "signing", ("%s opening the vault…" if kind == "approve" else "%s recalling the wire…") % who, {"txId": tx_id, "releaseTime": rec["releaseTime"]})
	await get_tree().create_timer(0.6).timeout
	if kind == "approve" and int(rec["releaseTime"]) > _now():
		_stage(job, "B", "failed", "Still cooling — the vault clock has not run down yet.", {"txId": tx_id, "reason": "BeforeReleaseTime", "releaseTime": rec["releaseTime"]})
		return _err("BeforeReleaseTime", "BeforeReleaseTime: Current time is before release time", {"releaseTime": rec["releaseTime"]})
	wires.remove_at(idx)
	if kind == "approve":
		var h := _hash()
		var requested := float(rec["amount"])
		if requested > balance:
			var failed_line := "The release was mined, but execution failed — free balance may have been spent down, so nothing was sent."
			_stage(job, "B", "failed", failed_line, {"hash": h, "txId": tx_id, "status": "FAILED", "reason": "RECORD_FAILED"})
			return _err("RECORD_FAILED", failed_line, {"hash": h, "txId": tx_id, "status": "FAILED"})
		balance -= requested
		_stage(job, "B", "mined", "Wire released: %s dUSDC sent." % rec["amount"], {"hash": _hash(), "txId": tx_id, "status": "COMPLETED"})
		return _ok({"jobId": job, "hash": _hash(), "txId": tx_id, "status": "COMPLETED", "actor": actor, "balanceAfter": _fmt(balance)})
	_stage(job, "B", "cancelled", "Wire recalled. Nothing left the vault.", {"hash": _hash(), "txId": tx_id, "status": "CANCELLED"})
	return _ok({"jobId": job, "hash": _hash(), "txId": tx_id, "status": "CANCELLED", "actor": actor})


## U4+ Okafor's Priority release, mocked: no Passkey, no signature, nothing on a chain — it only lets the greybox
## walk the desk. The real path is /priority/prepare → Privy MFA + user-signer sign sheet → /priority/submit.
## Pass `dismiss: true` (or txId `dismiss`) to exercise the Passkey/sign-sheet cancel line without a browser.
func _priority(args: Dictionary) -> Dictionary:
	if account == "":
		return _err("NO_ACCOUNT", "No account opened for this player")
	var tx_id := str(args.get("txId", ""))
	if bool(args.get("dismiss", false)) or tx_id == "dismiss":
		return _err("PRIORITY_CANCELLED", "priority release not signed: mock dismiss")
	var idx := _find(tx_id)
	if idx < 0:
		return _err("NOT_PENDING", "record %s is not PENDING" % tx_id)
	var rec: Dictionary = wires[idx]
	if int(rec["releaseTime"]) <= _now():
		return _err("NOT_COOLING", "record %s passed its releaseTime — that is Bob's window" % tx_id)
	var job := _new_job()
	_stage(job, "B", "signing", "Hand scan at the manager’s desk — (MockChain: no Passkey, nothing signed)…", {"txId": tx_id, "releaseTime": rec["releaseTime"], "via": "priority"})
	await get_tree().create_timer(1.2).timeout
	_stage(job, "B", "broadcasting", "Hand scan on file (mock). The manager is stamping a priority release…", {"txId": tx_id, "via": "priority"})
	await get_tree().create_timer(0.6).timeout
	idx = _find(tx_id)
	if idx < 0:
		return _err("NOT_PENDING", "record %s is not PENDING" % tx_id)
	wires.remove_at(idx)
	var h := _hash()
	var requested := float(rec["amount"])
	if requested > balance:
		var failed_line := "The release was mined, but execution failed — free balance may have been spent down, so nothing was sent."
		_stage(job, "B", "failed", failed_line, {"hash": h, "txId": tx_id, "status": "FAILED", "via": "priority", "reason": "RECORD_FAILED"})
		return _err("RECORD_FAILED", failed_line, {"hash": h, "txId": tx_id, "status": "FAILED", "via": "priority"})
	balance -= requested
	_stage(job, "B", "mined", "Priority release (mock): %s dUSDC sent before the clock — hand scan on file." % rec["amount"], {"hash": h, "txId": tx_id, "status": "COMPLETED", "via": "priority", "releaseTime": rec["releaseTime"], "chainNow": str(_now() - 47)})
	return _ok({"jobId": job, "hash": h, "txId": tx_id, "status": "COMPLETED", "actor": "priority", "releaseTime": rec["releaseTime"], "chainNow": str(_now() - 47), "balanceAfter": _fmt(balance), "mfaPrompted": false})


## Mirror of the Teller Desk watcher: a `released` tick once the mock clock passes releaseTime.
func _watch(tx_id: int, job: String) -> void:
	var announced := false
	while _find(str(tx_id)) >= 0:
		await get_tree().create_timer(2.0).timeout
		var idx := _find(str(tx_id))
		if idx < 0:
			return
		var rec: Dictionary = wires[idx]
		var released := int(rec["releaseTime"]) <= _now()
		if released and not announced:
			announced = true
			rec["released"] = true
			_stage(job, "B", "released", "The vault clock has run down. The wire may be released.", {"txId": str(tx_id), "releaseTime": rec["releaseTime"], "status": "PENDING"})
		elif not released:
			_stage(job, "B", "pending", "The vault clock is running.", {"txId": str(tx_id), "releaseTime": rec["releaseTime"], "status": "PENDING"})


## The practice token's name and precision follow the wing, as they do for real: Live (Sepolia) hands out
## `USDC` at 6 decimals, the lab chain `dUSDC` at 18, Arc native `USDC` at 6.
func _mode() -> String:
	return "dev" if chain_id == DEV_CHAIN_ID else "live"


func _chain_name() -> String:
	if chain_id == ARC_CHAIN_ID:
		return "Arc Testnet"
	return "Remote EVM" if chain_id == DEV_CHAIN_ID else "Sepolia"


func _token() -> Dictionary:
	if chain_id == DEV_CHAIN_ID:
		return {"address": "0xM0CK00000000000000000000000000000000dUSD", "symbol": "dUSDC", "decimals": 18}
	return {"address": "0xM0CK00000000000000000000000000000000dUSD", "symbol": "USDC", "decimals": 6}


func _session() -> Dictionary:
	if not logged_in:
		return {"loggedIn": false, "ready": true}
	return {
		"loggedIn": true, "ready": true, "userId": "did:privy:mock", "owner": OWNER,
		"account": account if account != "" else null, "delegated": delegated, "ensName": ens_name if ens_name != "" else null,
		"signingMode": "session" if delegated else "client", "chainId": chain_id,
		"mode": _mode(), "chainName": _chain_name(), "fxTillIsMain": _mode() == "live",
		"timeLockSec": timelock_sec, "instantLimit": INSTANT_LIMIT, "manager": MANAGER, "priority": true,
		"token": _token(),
	}


func _status() -> Dictionary:
	for w in wires:
		w["released"] = int(w["releaseTime"]) <= _now()
	return {
		"owner": OWNER, "chainId": chain_id, "signingMode": "session" if delegated else "client",
		"account": account if account != "" else null, "balance": _fmt(balance), "symbol": str(_token()["symbol"]),
		"pending": wires.size(), "wires": wires.duplicate(true), "serverNow": _now_str(),
		"timeLockSec": timelock_sec, "receipts": receipts.duplicate(true),
	}


func _switch_wing(target: int) -> Dictionary:
	if not logged_in:
		return _err("AUTH", "sign in before taking the elevator")
	if target != SEPOLIA_CHAIN_ID and target != DEV_CHAIN_ID and target != ARC_CHAIN_ID:
		return _err("BAD_ARGS", "the elevator only serves the Main wing and Arc %d" % ARC_CHAIN_ID)
	chain_id = target
	return _ok({"wing": "arc" if chain_id == ARC_CHAIN_ID else "main", "chainId": chain_id, "account": account if account != "" else null, "owner": OWNER})


## Live | Developer Mode against canned data. No session to rebind and no second desk to reach: the mock just
## relabels itself, so a mock walk can show either wing's copy without a chain or a Teller Desk anywhere.
func _set_mode(target: String) -> Dictionary:
	if target != "live" and target != "dev":
		return _err("BAD_ARGS", "the branch runs in Live or Developer Mode")
	chain_id = DEV_CHAIN_ID if target == "dev" else SEPOLIA_CHAIN_ID
	return _ok({"mode": target, "chainId": chain_id, "chainName": "Remote EVM" if target == "dev" else "Sepolia", "account": account if account != "" else null, "owner": OWNER, "fxTillIsMain": target == "live"})


func _stage(job: String, lane: String, stage: String, bank_line: String, extra: Dictionary = {}) -> void:
	var ev := {"type": "stage", "jobId": job, "lane": lane, "stage": stage, "bankLine": bank_line, "serverNow": _now_str()}
	ev.merge(extra, true)
	var idx := -1
	for i in receipts.size():
		if receipts[i]["jobId"] == job:
			idx = i
	var prev: Dictionary = receipts[idx] if idx >= 0 else {"jobId": job, "lane": lane}
	var rec := prev.duplicate()
	rec["stage"] = stage
	for k in ["hash", "txId", "reason", "releaseTime", "amount"]:
		if extra.has(k):
			rec[k] = extra[k]
	rec["updatedAt"] = int(Time.get_unix_time_from_system() * 1000.0)
	if idx >= 0:
		receipts[idx] = rec
	else:
		receipts.append(rec)
	if receipts.size() > 25:
		receipts.remove_at(0)
	Chain.emit_event("stage", ev)


func _find(tx_id: String) -> int:
	for i in wires.size():
		if str(wires[i]["txId"]) == tx_id:
			return i
	return -1


func _new_job() -> String:
	_job += 1
	return "mock-%03d" % _job


func _ok(result: Variant) -> Dictionary:
	return {"ok": true, "result": result}


func _err(code: String, message: String, extra: Dictionary = {}) -> Dictionary:
	var e := {"code": code, "message": message}
	e.merge(extra, true)
	return {"ok": false, "result": {}, "error": e}


func _now() -> int:
	return int(Time.get_unix_time_from_system())


func _now_str() -> String:
	return str(_now())


func _fmt(v: float) -> String:
	var s := "%.2f" % v
	if s.ends_with(".00"):
		return s.substr(0, s.length() - 3)
	return s


func _hash() -> String:
	return "0xm0ck%056x" % (randi() % 1000000)
