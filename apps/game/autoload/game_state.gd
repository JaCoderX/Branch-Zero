extends Node
## GameState — the game's mirror of what the bridge has told it. Dialogue conditions read this; nothing in a
## scene script calls Chain directly except through `run_action` here.
##
## Rules it keeps (docs/GODOT.md §5): release times are the chain's `releaseTime` (strings in `wires`), the
## countdown runs against the Teller Desk clock (`serverNow` → `clock_offset`), never against `chainNow`;
## the pending list is reconciled with `listPending` on tab focus; stage events are relayed, never invented.

signal changed()                       # any state change worth re-rendering
signal stage(ev: Dictionary)           # a Teller Desk stage event (relayed from Chain)
signal toast(text: String, kind: String)
signal zone_changed(zone: String)

const ERRORS_PATH := "res://dialogue/errors.json"
const STRINGS_PATH := "res://dialogue/strings.json"

var booted: bool = false
var session: Dictionary = {}           # DeskSession as the bridge returns it
var balance: String = "0"
var symbol: String = "dUSDC"
var wires: Array = []                  # PendingWire dictionaries, strings only
var receipts: Array = []               # Teller Desk receipts (last few)
var ens_names: Array = []              # Recent ENSv2 customer claims for Petra's wall board
var clock_offset: float = 0.0          # serverNow - local wall clock, seconds
var last_stage: Dictionary = {}
var busy: bool = false
var ui_locked: bool = false            # dialogue / form open → player does not move
var current_zone: String = ""
var desk_linked: bool = true        # Teller Desk SSE stream up (bridge `desk.link`); false while reconnecting
var observers: Array = []           # viewing wallets on the OBSERVER role (addresses, strings only)
var fx: Dictionary = {}             # S1: Johnny's till on Sepolia — USD/EUR/ILS balances, the two fiat pools (`pairs`), whitelist (bridge `fxStatus`)
var fx_quote: Dictionary = {}       # the rate currently on the quote board (bridge `fxQuote`); empty = board dark
var fx_last: Dictionary = {}        # the last filled trade (bridge `fxSwap` result) — Johnny's "Filled." line reads it after the board clears
var terminal_open: bool = false     # the bank computer's Console overlay is up in the shell (bridge `terminal.closed` clears it)
var inpc_open: bool = false         # the iNPC's Wake / chat overlay is up in the shell (bridge `inpc.closed` clears it) — docs/INPC.md
var inpc_awake: bool = false        # the shell holds the player's session-only OpenRouter key; mirrored yes/no, the key itself never comes here
var inpc_following: bool = false    # phone Follow: Blox-47 trails the player (bridge `inpc.follow`); spatial chrome only — never a lock, cleared by Sleep
var branch_float_open: bool = false # the read-only Live ops float panel is up in the shell (bridge `branch-float.closed` clears it)
var _branch_float_opening: bool = false
var treasury_status: Dictionary = {} # player-safe `/healthz` slice only: configured/address/eth/treasuryShort/requiredEth
var errors: Dictionary = {}
var strings: Dictionary = {}

var _reconcile_at: float = 0.0
var _fx_at: float = 0.0            # last successful fxStatus wall time — throttle pool reads in refresh_all
var _inpc_pushing: bool = false    # one snapshot hand-over in flight at a time while the assistant's panel is up
var _inpc_freshening: bool = false # suppress mid-flight pushes while session/passbook re-pull for open / Ask
var _treasury_at: float = 0.0      # last player-safe treasury status read
var _treasury_refreshing: bool = false
var _last_error: Dictionary = {}

const FX_REFRESH_SEC := 12.0       # Sepolia pair reads are not free; refresh_all reuses a warm board within this window
const TREASURY_REFRESH_SEC := 5.0  # the React side polls /healthz; this cheap bridge read keeps the HUD responsive


func _ready() -> void:
	_setup_controls()
	errors = _load_json(ERRORS_PATH)
	strings = _load_json(STRINGS_PATH)
	Chain.event.connect(_on_chain_event)
	changed.connect(_push_inpc_snapshot)
	boot()


## First contact with the desk: wait for the bridge, ask who is standing there (no modal), read the passbook.
func boot() -> void:
	var t0 := Time.get_ticks_msec()
	await Chain.wait_ready(4.0)
	var t1 := Time.get_ticks_msec()
	await refresh_session()
	await refresh_treasury(true)
	if logged_in():
		await refresh_passbook()
	booted = true
	# Read the board after the bridge/session boot is complete. Anonymous users still get a silent board read,
	# while a real adapter can no longer race its initial ready event here.
	await refresh_names()
	if logged_in():
		await refresh_observers()
		await refresh_fx()
	await refresh_inpc()
	print("GameState: booted — bridge ready after %d ms, session after %d ms (%s)" % [t1 - t0, Time.get_ticks_msec() - t1, "MockChain" if Chain.use_mock else "bridge " + Chain.bridge_version])
	changed.emit()


# ---------------------------------------------------------------- facts

func logged_in() -> bool:
	return bool(session.get("loggedIn", false))


func has_account() -> bool:
	return logged_in() and session.get("account") != null and str(session.get("account", "")) != ""


func has_ens_name() -> bool:
	return _session_str("ensName") != "" or not ens_names_for_owner().is_empty()


## A session field as text; the desk sends `null` for "none", which str() would render as "<null>".
func _session_str(key: String) -> String:
	var v: Variant = session.get(key)
	return "" if v == null else str(v)


## The passbook tier (Silver / Gold) as the desk mirrors it from the name's `bz.tier` record; "" until a name exists.
func ens_tier() -> String:
	return _session_str("ensTier") if has_ens_name() else ""


func ens_name() -> String:
	var direct := _session_str("ensName")
	if direct != "":
		return direct
	var mine := ens_names_for_owner()
	return str(mine[0].get("name", "")) if not mine.is_empty() else ""


func ens_names_for_owner() -> Array:
	var out: Array = []
	var owner_id := owner().to_lower()
	for row in ens_names:
		if str(row.get("owner", "")).to_lower() == owner_id or str(row.get("address", "")).to_lower() == account().to_lower():
			out.append(row)
	return out


func delegated() -> bool:
	return bool(session.get("delegated", false))


func has_manager() -> bool:
	return session.get("manager") != null and str(session.get("manager", "")) != ""


## U4+: the branch runs the Priority desk and this account carries the META_APPROVE split (ROLE_SET 3). When false
## the manager can still shred, but nobody skips the cooling (vault-only, or Iris has to re-check the file).
func priority_enabled() -> bool:
	return has_manager() and bool(session.get("priority", false))


func account() -> String:
	return str(session.get("account", "")) if has_account() else ""


## A shell overlay owns the screen: the Console (terminal) or the iNPC panel. While either is up the player is typing
## in the DOM, so movement, Space and the visitor's card stay locked until the shell says it closed (docs/GODOT.md §5b).
func overlay_open() -> bool:
	return terminal_open or inpc_open or branch_float_open


func owner() -> String:
	return str(session.get("owner", ""))


const SEPOLIA_CHAIN_ID := 11155111   ## Live — the public payment chain (product default)
const DEV_CHAIN_ID := 1337           ## Developer Mode — the private Remote EVM lab, never published
const ARC_CHAIN_ID := 5042002        ## U6 Arc wing — DEFERRED


func active_chain_id() -> int:
	return int(session.get("chainId", SEPOLIA_CHAIN_ID))


func active_wing() -> String:
	return "arc" if active_chain_id() == ARC_CHAIN_ID else "main"


## Live (Sepolia, the product default) or Developer Mode (Remote EVM 1337, operator only). The desk tells us
## which one answered; we never assume, because a Live player must never be shown a lab chain
## (docs/SEPOLIA-LIVE.md §6). Arc keeps its own label and stays deferred.
func mode() -> String:
	var m := str(session.get("mode", ""))
	if m != "":
		return m
	return "dev" if active_chain_id() == DEV_CHAIN_ID else "live"


## The only player-facing treasury truth: a whitelisted slice of the selected Live desk's `/healthz` response.
## MockChain, Developer Mode and Arc never borrow a real Live health response for this surface.
func _treasury_surface_allowed() -> bool:
	return not Chain.use_mock and mode() == "live" and active_chain_id() == SEPOLIA_CHAIN_ID


func treasury_configured() -> bool:
	var address: Variant = treasury_status.get("address")
	return _treasury_surface_allowed() and bool(treasury_status.get("configured", false)) and address != null and str(address) != ""


func treasury_short() -> bool:
	return treasury_configured() and bool(treasury_status.get("treasuryShort", false))


func branch_float_available() -> bool:
	return treasury_configured()


func branch_float_status() -> Dictionary:
	return treasury_status.duplicate(true)



## What the board, the passbook and the NPCs call the chain the money is actually on.
func chain_label() -> String:
	if Chain.use_mock:
		return "MockChain"
	var named := str(session.get("chainName", ""))
	var id := active_chain_id()
	if id == ARC_CHAIN_ID:
		return "Arc Testnet 5042002"
	if id == DEV_CHAIN_ID:
		return "%s %d (Developer Mode)" % [named if named != "" else "Remote EVM", id]
	return "%s %d" % [named if named != "" else "Sepolia", id]


func switch_wing(chain_id: int) -> Dictionary:
	return await run_action("switch_wing", {"chainId": chain_id})


## Live | Developer Mode. Operator path (desk debug / `?mode=dev`); see docs/SEPOLIA-LIVE.md §1.
func set_mode(target: String) -> Dictionary:
	return await run_action("set_mode", {"mode": target})


func instant_limit() -> float:
	return float(str(session.get("instantLimit", "100")))


func timelock_sec() -> int:
	return int(session.get("timeLockSec", 120))


func pending_count() -> int:
	return wires.size()


func released_count() -> int:
	var n := 0
	for w in wires:
		if remaining(w) <= 0:
			n += 1
	return n


func cooling_count() -> int:
	return pending_count() - released_count()


## Desk-corrected wall clock, unix seconds.
func now() -> int:
	return int(Time.get_unix_time_from_system() + clock_offset)


## Seconds until a record's chain `releaseTime`, counted against the desk clock. Negative once released.
func remaining(w: Dictionary) -> int:
	return int(str(w.get("releaseTime", "0"))) - now()


## The soonest pending release, or 0 when nothing is cooling.
func soonest_remaining() -> int:
	var best := -1
	for w in wires:
		var r := remaining(w)
		if r > 0 and (best < 0 or r < best):
			best = r
	return max(best, 0)


func wire_by_id(tx_id: String) -> Dictionary:
	for w in wires:
		if str(w.get("txId", "")) == tx_id:
			return w
	return {}


static func fmt_duration(sec: int) -> String:
	var s: int = max(sec, 0)
	return "%d:%02d" % [s / 60, s % 60]


static func short_address(a: String) -> String:
	if a.length() < 12:
		return a
	return "%s…%s" % [a.substr(0, 6), a.substr(a.length() - 4)]


func fmt_amount(v: Variant) -> String:
	var s := str(v)
	if s == "" or s == "<null>":
		return "?"
	if s.find(".") >= 0:
		s = s.rstrip("0").rstrip(".")
	return s


## Facts the dialogue conditions may test (docs/NPCS.md §3).
func facts() -> Dictionary:
	return {
		"booted": booted,
		"logged_in": logged_in(),
		"has_account": has_account(),
		"delegated": delegated(),
		"manager": has_manager(),
		"priority": priority_enabled(),
		"pending": pending_count(),
		"released": released_count(),
		"cooling": cooling_count(),
		"busy": busy,
		"desk_linked": desk_linked,
		"observers": observers.size(),
		"terminal_open": terminal_open,
		"inpc_open": inpc_open,
		"inpc_awake": inpc_awake,
		"inpc_following": inpc_following,
		"branch_float_open": branch_float_open,
		"treasury_configured": treasury_configured(),
		"treasury_short": treasury_short(),
		# S1 — Johnny's desk. `fx_till` = the player has an AccountBlox on Sepolia; `fx_open` = its exchange door is
		# registered (the three whitelisted calls); `fx_quoted` = a rate is on the board and still inside its deadline.
		"fx_till": has_fx_till(),
		"fx_open": fx_open(),
		"fx_quoted": fx_quoted(),
		"fx_desk": fx.has("pairs"),
		"ens_name": ens_name(),
		"has_ens_name": has_ens_name(),
		"mock": Chain.use_mock,
		"web": Chain.is_web,
		"arc": active_wing() == "arc",
		"live": mode() == "live",
		"dev_mode": mode() == "dev",
	}


## `{vars}` the dialogue text may interpolate.
func vars(extra: Dictionary = {}) -> Dictionary:
	var v := {
		"name": short_address(owner()) if logged_in() else "friend",
		"short_address": short_address(account()),
		"balance": fmt_amount(balance),
		"symbol": symbol,
		"limit": fmt_amount(str(session.get("instantLimit", "100"))),
		"timelock": fmt_duration(timelock_sec()),
		"timelock_sec": str(timelock_sec()),
		"pending": str(pending_count()),
		"released": str(released_count()),
		"cooling": str(cooling_count()),
		"release_in": fmt_duration(soonest_remaining()),
		"wing": active_wing(),
		"chain": chain_label(),
		"mode": mode(),
		"mode_label": "Developer Mode" if mode() == "dev" else "Live",
		# FX is Sepolia in both modes. What differs is whether the till is the account Iris opened (Live) or a
		# second account on another chain (Eve) — Johnny says whichever is true rather than one line for both.
		"fx_till_note": ("a second account of your own on Sepolia, where the exchange lives — separate books from your counter money" if mode() == "dev" else "the very account Iris opened for you: the exchange lives on this same chain, so there is one balance and one guard list"),
		"fx_chain_note": ("Currency exchange is on Sepolia only — that is where the pool is. Your payments and wires are on the development chain in this mode." if mode() == "dev" else "Currency exchange is on Sepolia only — the same chain your payments and wires already use."),
		"manager_name": "Mr. Walker",
		"priority_copy": str(strings.get("priority_copy", "Skip the cooling period — hand scan required.")),
		"ens_name": ens_name() if has_ens_name() else "no name yet",
		# Bank surfaces condition on has_ens_name and never print a placeholder: no name means no name row, no clause.
		"bank_name": ens_name() if has_ens_name() else "",
		"bank_tier": ens_tier(),
		"observers": str(observers.size()),
		# S1 — the quote board and Johnny's lines. Everything here came from the chain (V4Quoter, StateView) or is "—".
		"fx_usdc": fmt_amount(fx.get("usdc", "0")),
		"fx_eur": fmt_amount(fx.get("eur", "0")),
		"fx_ils": fmt_amount(fx.get("ils", "0")),
		# The till's own currency — the practice dollar — whatever is on the board.
		"fx_symbol_in": str(fx.get("symbolIn", "USD")),
		# Bidirectional (2026-09-10): the quote's sold / bought currencies. A buy sells USD; a sell sells EUR | ILS.
		"fx_quote_in": str(fx_quote.get("symbolIn", fx.get("symbolIn", "USD"))),
		"fx_symbol_out": str(fx_quote.get("symbolOut", "EUR")),
		"fx_side": str(fx_quote.get("side", "buy")),
		"fx_side_word": ("selling" if str(fx_quote.get("side", "buy")) == "sell" else "buying"),
		"fx_pair": str(fx_quote.get("pair", "")),
		# The last fill, kept after the board clears so the receipt line does not read zeros.
		"fx_filled_in": fmt_amount(fx_last.get("amountIn", "0")),
		"fx_filled_in_symbol": str(fx_last.get("symbolIn", "USD")),
		"fx_filled_out": fmt_amount(fx_last.get("amountOut", "0")),
		"fx_filled_out_symbol": str(fx_last.get("symbolOut", "EUR")),
		# Currencies Eve's counter may pay from this account (Live: USD + whatever Johnny's grant added; Dev: USD).
		"fx_payable": " · ".join(fx.get("payable", [])) if fx.get("payable", []).size() > 0 else str(fx.get("symbolIn", "USD")),
		"fx_rate_eur": str(fx_pair("EUR").get("midRate", "—")),
		"fx_rate_ils": str(fx_pair("ILS").get("midRate", "—")),
		"fx_pool_fee": str(fx_pair("EUR").get("pool", {}).get("fee", "0.30%")),
		"fx_amount_in": fmt_amount(fx_quote.get("amountIn", "0")),
		"fx_amount_out": fmt_amount(fx_quote.get("amountOut", "0")),
		"fx_min_out": fmt_amount(fx_quote.get("minOut", "0")),
		"fx_rate": str(fx_quote.get("rate", "—")),
		"fx_slippage": str(fx_quote.get("slippage", "1%")),
		"fx_valid": fmt_duration(fx_quote_remaining()),
	}
	v.merge(extra, true)
	return v


# ---------------------------------------------------------------- reads

func refresh_session() -> void:
	var prev_account := account()
	var prev_mode := mode()
	var r := await Chain.call_async("getSession", {}, 20.0)
	if r.get("ok", false) and r.get("result") is Dictionary:
		session = r["result"]
		if not logged_in():
			balance = "0"
			wires = []
			receipts = []
			fx = {}
			fx_quote = {}
			fx_last = {}
			_fx_at = 0.0
		elif account() != prev_account or mode() != prev_mode:
			# New till / Live↔Dev: drop the stale board so refresh_all forces fxStatus.
			fx = {}
			fx_quote = {}
			fx_last = {}
			_fx_at = 0.0
	else:
		session = {"loggedIn": false, "ready": false}
		_note_error(r.get("error", {}))
	changed.emit()


## The Name Desk board is backed by the customers UserRegistry's recent registration events.
func refresh_names() -> void:
	var r := await Chain.call_async("ensAvailable", {}, 20.0)
	if not r.get("ok", false):
		# A board read must not make Account Opening or the existing bank lanes unusable.
		return
	var result: Dictionary = r.get("result", {})
	if result.get("recent") is Array:
		ens_names = result["recent"]
	changed.emit()


## Who may read this account from the public Console — the OBSERVER role's wallet list, read from the chain.
## Silent on failure: the terminal is a side path, and a refused read must never break Account Opening or the lanes.
func refresh_observers() -> void:
	if not has_account():
		observers = []
		return
	var r := await Chain.call_async("observerList", {}, 20.0)
	if not r.get("ok", false):
		return
	var res: Dictionary = r.get("result", {})
	if res.get("wallets") is Array:
		observers = res["wallets"]
	changed.emit()


## Fiat pairs (2026-09-09): the desk's view of one pool — `fxStatus.pairs[]` entry for EUR or ILS (balance, midRate, pool).
func fx_pair(pair: String) -> Dictionary:
	for p in fx.get("pairs", []):
		if p is Dictionary and str(p.get("pair", "")) == pair:
			return p
	return {}


## S1 — has the player an AccountBlox on Sepolia at all? (`fxStatus.account`; null until the FX till is opened.)
func has_fx_till() -> bool:
	return fx.get("account") != null and str(fx.get("account", "")) != ""


## Is the exchange door registered on it — the three whitelisted calls? Read from the chain, never remembered.
func fx_open() -> bool:
	return has_fx_till() and bool(fx.get("enabled", false))


## Seconds a quote is still good for, counted against the **desk** clock like the vault (docs/GODOT.md §5).
func fx_quote_remaining() -> int:
	if fx_quote.is_empty():
		return 0
	return max(int(str(fx_quote.get("deadline", "0"))) - now(), 0)


func fx_quoted() -> bool:
	return not fx_quote.is_empty() and fx_quote_remaining() > 0


## Johnny's till and his pools. Silent on failure: a Sepolia hiccup must never break Account Opening or the Main lanes.
## Pass `force` when the player is at the FX desk — a Re-check / late login must not leave the board dark for 12 s.
func refresh_fx(force: bool = false) -> void:
	if not logged_in():
		fx = {}
		fx_quote = {}
		_fx_at = 0.0
		return
	if not force and fx.has("pairs") and (Time.get_unix_time_from_system() - _fx_at) < FX_REFRESH_SEC:
		return
	var r := await Chain.call_async("fxStatus", {}, 30.0)
	if not r.get("ok", false):
		# Keep a warm board on a transient RPC blip; clear only when we never had pairs (so Johnny stays honest).
		if not fx.has("pairs"):
			print("GameState: fxStatus failed — Johnny's board stays dark (%s)" % str(r.get("error", {}).get("code", "unknown")))
		return
	if r.get("result") is Dictionary:
		fx = r["result"]
		_fx_at = Time.get_unix_time_from_system()
		_sync_clock(fx.get("serverNow"))
	changed.emit()


## `/status` in one read: balance, pending wires (with the chain's releaseTime), receipts, serverNow.
func refresh_passbook() -> void:
	if not logged_in():
		return
	var r := await Chain.call_async("getPassbook", {}, 20.0)
	if not r.get("ok", false):
		_note_error(r.get("error", {}))
		return
	var st: Dictionary = r.get("result", {})
	balance = str(st.get("balance", balance))
	symbol = str(st.get("symbol", symbol))
	if st.get("wires") is Array:
		wires = st["wires"]
	if st.get("receipts") is Array:
		receipts = st["receipts"]
	_sync_clock(st.get("serverNow"))
	changed.emit()


## Tab regained focus: SSE kept running in JS, Godot's frame loop did not — re-read the pending list once.
func reconcile_pending(reason: String = "focus") -> void:
	if not has_account():
		return
	var t := Time.get_unix_time_from_system()
	if t - _reconcile_at < 2.0:
		return
	_reconcile_at = t
	var r := await Chain.call_async("listPending", {}, 20.0)
	if not r.get("ok", false):
		_note_error(r.get("error", {}))
		return
	var res: Dictionary = r.get("result", {})
	if res.get("items") is Array:
		wires = res["items"]
	_sync_clock(res.get("serverNow"))
	print("GameState: reconciled %d pending record(s) on %s" % [wires.size(), reason])
	changed.emit()


func refresh_all() -> void:
	await refresh_session()
	await refresh_treasury()
	if logged_in():
		await refresh_passbook()
		# Provision / login / Re-check used to skip FX — Johnny then stayed on desk_closed with an empty `fx`.
		# Force when the board has never loaded; otherwise reuse a warm status within FX_REFRESH_SEC.
		await refresh_fx(not fx.has("pairs"))


## Read the current player-safe treasury slice from the React shell. The shell is the one place that polls `/healthz`;
## this call never reaches a funding writer and the result is whitelisted again before it enters GameState.
func refresh_treasury(force: bool = false) -> void:
	if not _treasury_surface_allowed():
		if not treasury_status.is_empty():
			treasury_status = {}
			changed.emit()
		_treasury_at = 0.0
		return
	if not force and (Time.get_unix_time_from_system() - _treasury_at) < TREASURY_REFRESH_SEC:
		return
	if _treasury_refreshing:
		return
	_treasury_refreshing = true
	var r := await Chain.call_async("treasuryStatus", {}, 10.0)
	_treasury_refreshing = false
	_treasury_at = Time.get_unix_time_from_system()
	if not r.get("ok", false):
		return
	var raw: Variant = r.get("result")
	var next: Dictionary = {}
	if raw is Dictionary:
		next = {
			"configured": bool(raw.get("configured", false)),
			"address": raw.get("address", null),
			"eth": raw.get("eth", null),
			"treasuryShort": bool(raw.get("treasuryShort", false)),
			"requiredEth": raw.get("requiredEth", null),
		}
	var was_short := treasury_short()
	var changed_now := next != treasury_status
	if changed_now:
		treasury_status = next
		if was_short and not treasury_short() and bool(next.get("configured", false)):
			toast.emit("Branch float restored.", "info")
		changed.emit()


func _process(_delta: float) -> void:
	if not booted:
		return
	if _treasury_surface_allowed() and Time.get_unix_time_from_system() - _treasury_at >= TREASURY_REFRESH_SEC:
		refresh_treasury()


# ---------------------------------------------------------------- iNPC (docs/INPC.md) — a reader, never a desk

## Is the assistant awake in this tab? The shell owns the key (sessionStorage) and answers yes/no; Godot never sees the
## key. Silent on failure — a dark assistant must never delay Account Opening or the lanes. MockChain answers "no".
func refresh_inpc() -> void:
	var r := await Chain.call_async("inpcStatus", {}, 10.0)
	if r.get("ok", false) and r.get("result") is Dictionary:
		var awake := bool(r["result"].get("awake", false))
		var following := awake and bool(r["result"].get("following", false))
		if awake != inpc_awake or following != inpc_following:
			inpc_awake = awake
			inpc_following = following
			changed.emit()


## The only player-specific truth the iNPC gets (HANDOFF-inpc-openrouter §4). Every field is already on a surface the
## player reads — passbook, vault board, name board, the terminal's viewing count — and nothing here is desk chrome:
## no addresses beyond the payee the board already shortens, no tx hashes, no calldata, no keys, no owner, no
## Live/Dev or link-health flags, no receipts. `release_ready` is the board's own rule (`remaining() <= 0`); the shell
## re-derives it at send time from `release_at_unix` against the desk clock, so a wire that finished cooling while the
## player typed is READY on that question, not on the next open.
func inpc_snapshot() -> Dictionary:
	var pending: Array = []
	for w in wires:
		var rem := remaining(w)
		var release_at := int(str(w.get("releaseTime", "0")))
		pending.append({
			"slip": "#%s" % str(w.get("txId", "?")),
			"amount_display": "%s %s" % [fmt_amount(w.get("amount", "?")), symbol],
			"payee_short": short_address(str(w.get("to", "?"))),
			"status": str(w.get("status", "PENDING")),
			"board_word": "READY" if rem <= 0 else "PENDING",
			"release_ready": rem <= 0,
			"cooling_left_display": fmt_duration(rem) if rem > 0 else "0:00",
			"release_at_unix": release_at,
			"release_at_display": clock_display(release_at),
		})
	var help: Array = []
	if not has_account():
		help.append("Iris at Account Opening opens an account (or loads one you already hold).")
	else:
		help.append("Eve at the counter takes an over-the-counter payment up to the counter limit; larger amounts go to the vault as a scheduled wire.")
		if pending.size() > 0:
			help.append("Bob at the vault window releases a wire once its clock shows READY — not before.")
			help.append("Mr. Walker in the manager's office can recall a pending wire" + (" or run Priority (a hand scan) before the clock." if priority_enabled() else "."))
		if not has_ens_name():
			help.append("Petra at the Name Desk registers a bank name.")
	var network := "MockChain (practice — nothing here is on a chain)" if Chain.use_mock else _session_str("chainName")
	return {
		"schema": "branch-zero-inpc-snapshot/1",
		"desk_now_unix": now(),
		"logged_in": logged_in(),
		"has_account": has_account(),
		"wing": active_wing(),
		"network": network,
		"bank_name": ens_name() if has_ens_name() else "",
		"tier": ens_tier(),
		"balance_display": ("%s %s" % [fmt_amount(balance), symbol]) if has_account() else "",
		"currency_note": "%s are practice dollars — no real money moves in this branch." % symbol,
		"counter_limit_display": ("%s %s per over-the-counter payment" % [fmt_amount(str(session.get("instantLimit", "100"))), symbol]) if has_account() else "",
		"cooling_period_display": fmt_duration(timelock_sec()) if has_account() else "",
		"pending_count": pending.size(),
		"pending_wires": pending,
		"viewing_wallets_count": observers.size(),
		"player_zone": current_zone,
		"who_can_help": help,
	}


## `HH:MM` on the player's own clock for a unix instant — how the vault clock's release time reads to a person.
static func clock_display(unix: int) -> String:
	if unix <= 0:
		return ""
	var bias := int(Time.get_time_zone_from_system().get("bias", 0))   # minutes east of UTC
	var d := Time.get_datetime_dict_from_unix_time(unix + bias * 60)
	return "%02d:%02d" % [int(d.get("hour", 0)), int(d.get("minute", 0))]


## While the assistant's panel is up, each change of the mirror is handed to the shell (`inpcSnapshot`), so the chat
## reads the board as it is now. One hand-over in flight at a time; a missed one is covered by the next `changed`.
## Suppressed while `_freshen_inpc_mirror` is mid-flight so Ask does not resolve on a half-updated board.
func _push_inpc_snapshot() -> void:
	if not inpc_open or _inpc_pushing or _inpc_freshening:
		return
	_inpc_pushing = true
	await Chain.call_async("inpcSnapshot", {"snapshot": inpc_snapshot()}, 10.0)
	_inpc_pushing = false


## Re-pull `/session` (+ passbook when logged in) into GameState. Does not push to the shell by itself — callers
## open with `inpc_snapshot()` or call `inpcSnapshot` once the board is complete.
func _freshen_inpc_mirror() -> void:
	_inpc_freshening = true
	await refresh_session()
	if logged_in():
		await refresh_passbook()
	_inpc_freshening = false


# ---------------------------------------------------------------- writes (every desk action lands here)

func _needs_treasury_gate(action: String) -> bool:
	return [
		"provision", "load_account", "pay", "wire", "approve", "cancel", "manager_cancel", "priority",
		"ens_mint", "ens_set_text", "fx_enable", "fx_swap",
	].has(action)


## Refuse the write locally while the existing Live health signal is short. The popup is dismissible and the player
## can continue walking after it closes; no top-up or other spend call is made here.
func _gate_treasury_write(action: String) -> Dictionary:
	if Dialogue.active:
		# A gated choice should not leave a dialogue trapped behind the shell panel. The player can walk after dismissing.
		Dialogue.close()
	var opened := await open_branch_float("write:%s" % action)
	var error := {
		"code": "TREASURY_SHORT",
		"message": "the Live ops treasury is short; no write was sent",
		"bankLine": "The branch is low on ops gas — no slip was sent. Drop Sepolia ETH to the bank float address (Help keep the branch open); staff refill in the background once the float has funds.",
	}
	if not opened.get("ok", false):
		error = opened.get("error", error)
	_note_error(error)
	return {"ok": false, "result": {}, "error": error}


func open_branch_float(reason: String = "hud") -> Dictionary:
	if branch_float_open:
		return {"ok": true, "result": {"opened": true, "alreadyOpen": true}}
	if _branch_float_opening:
		return {"ok": true, "result": {"opened": true, "alreadyOpening": true}}
	_branch_float_opening = true
	if not branch_float_available():
		await refresh_treasury(true)
	if not branch_float_available():
		_branch_float_opening = false
		return {"ok": false, "result": {}, "error": {"code": "FLOAT_UNAVAILABLE", "message": "the Live treasury is not configured"}}
	var r := await Chain.call_async("openBranchFloat", {"reason": reason}, 30.0)
	_branch_float_opening = false
	if r.get("ok", false):
		branch_float_open = true
		ui_locked = true
		changed.emit()
	return r

## Run one desk action through the bridge. Returns {"ok", "result", "error"}. Refreshes the mirror afterwards
## whatever the outcome (a refused approve still moved the clock; a provision changes the session).
## Vault verbs (U4+): `approve` = Bob (owner, after the clock) · `priority` = Walker (hand scan, before the clock) ·
## `cancel` / `manager_cancel` = recall. There is no manager approve.
func run_action(action: String, args: Dictionary = {}) -> Dictionary:
	if _needs_treasury_gate(action) and treasury_short():
		return await _gate_treasury_write(action)
	busy = true
	changed.emit()
	var r: Dictionary
	match action:
		"login":
			r = await Chain.call_async("login", {}, 600.0)            # a human types an OTP
		"delegate":
			r = await Chain.call_async("addSessionSigner", {}, 300.0)  # the one consent
		"revoke":
			r = await Chain.call_async("removeSessionSigner", {}, 60.0)
		"logout":
			r = await Chain.call_async("logout", {}, 30.0)
		"switch_wing":
			# The elevator: Main wing (whichever chain the current mode runs on) or Arc. Arc is DEFERRED and the
			# lobby refuses it with "ARC floor — coming soon" before it ever reaches here.
			var target_chain := int(args.get("chainId", active_chain_id()))
			if target_chain != SEPOLIA_CHAIN_ID and target_chain != DEV_CHAIN_ID and target_chain != ARC_CHAIN_ID:
				r = {"ok": false, "error": {"code": "BAD_ARGS", "message": "the elevator only serves the Main wing and Arc %d" % ARC_CHAIN_ID}}
			else:
				r = await Chain.call_async("switchWing", {"chainId": target_chain}, 60.0)
		"set_mode":
			# Live | Developer Mode. Operator surface only (desk debug or `?mode=dev`): no NPC offers it, so no
			# dialogue action reaches this branch in normal play. It re-points the shell at the other Teller Desk.
			var target_mode := str(args.get("mode", "live")).to_lower()
			if target_mode != "live" and target_mode != "dev":
				r = {"ok": false, "error": {"code": "BAD_ARGS", "message": "the branch runs in Live or Developer Mode"}}
			else:
				r = await Chain.call_async("setMode", {"mode": target_mode}, 90.0)
		"provision":
			r = await Chain.call_async("provision", {}, 300.0)         # clone + config batches + funding
		"load_account":
			# Iris adopts an account the player already owns on this wing (docs/LOAD-ACCOUNT.md). The address
			# comes from the load slip; the desk checks `owner()` on the chain and refuses anything else. No
			# Privy surface — the policy re-pin happens behind the counter — so this waits like a Re-check, not
			# like a sign-in. Godot never reads the chain itself: it only carries the string the player typed.
			var wanted := str(args.get("account", "")).strip_edges()
			if wanted == "":
				r = {"ok": false, "error": {"code": "BAD_ARGS", "message": "an account address is required"}}
			else:
				r = await Chain.call_async("loadAccount", {"account": wanted}, 300.0)
		"faucet":
			r = await Chain.call_async("faucet", {}, 120.0)            # explicit practice top-up; no Privy surface
		"ens_available":
			r = await Chain.call_async("ensAvailable", {"label": args.get("label", "")}, 20.0)
		"ens_mint":
			r = await Chain.call_async("ensMint", {"label": str(args.get("label", ""))}, 180.0)
		"ens_set_text":
			r = await Chain.call_async("ensSetText", {"name": str(args.get("name", ens_name())), "key": str(args.get("key", "bz.tier")), "value": str(args.get("value", "Silver"))}, 120.0)
		"resolve_name":
			r = await Chain.call_async("resolveName", {"name": str(args.get("name", ""))}, 20.0)
		"fx_status":
			r = await Chain.call_async("fxStatus", {}, 30.0)
		"fx_quote":
			# A read: the V4Quoter prices it with an eth_call. Johnny shows the board before anyone signs anything.
			# `pair` is EUR | ILS (fiat pairs, 2026-09-09); the desk refuses anything else with FX_PAIR.
			# `side` is buy (USD → fiat, amount in dollars) | sell (fiat → USD, amount in that fiat) — 2026-09-10.
			r = await Chain.call_async("fxQuote", {"amount": str(args.get("amount", "1")), "pair": str(args.get("pair", "EUR")), "side": str(args.get("side", "buy"))}, 30.0)
			if r.get("ok", false) and r.get("result") is Dictionary:
				fx_quote = r["result"]
				_sync_clock(fx_quote.get("serverNow"))
			else:
				fx_quote = {}
		"fx_enable":
			# Registering the exchange door: two owner-signed config batches, silent (the session signer).
			r = await Chain.call_async("fxEnable", {}, 300.0)
		"fx_swap":
			# Up to three guarded Lane A meta-transactions on Sepolia. No Privy surface — this is not the hand scan.
			#
			# A quote the player accepted is the price they agreed to. If the board's quote has run out its deadline,
			# refuse here rather than send an amount and let the desk price it afresh: re-quoting silently under a
			# player who said "take it" is exactly the behaviour the deadline exists to prevent, and the desk's own
			# FX_QUOTE_EXPIRED says so on the other side of the bridge.
			var swap_args := {}
			var board_id := str(args.get("quoteId", fx_quote.get("quoteId", "")))
			if board_id != "" and not fx_quoted():
				r = {"ok": false, "error": {"code": "FX_QUOTE_EXPIRED", "message": "the quote on the board expired before it was taken"}}
			else:
				if board_id != "":
					swap_args["quoteId"] = board_id
				if str(args.get("amount", "")) != "":
					swap_args["amount"] = str(args["amount"])
				elif not swap_args.has("quoteId"):
					r = {"ok": false, "error": {"code": "FX_AMOUNT", "message": "ask Johnny for a price before taking one"}}
				if str(args.get("pair", "")) != "":
					swap_args["pair"] = str(args["pair"])   # a bare amount needs its currency; a quote already carries it
				if str(args.get("side", "")) != "":
					swap_args["side"] = str(args["side"])   # ... and its direction (buy | sell); the desk refuses a mismatch with FX_SIDE
				if not r.has("error"):
					r = await Chain.call_async("fxSwap", swap_args, 300.0)
					if r.get("ok", false):
						fx_quote = {}
						if r.get("result") is Dictionary:
							fx_last = r["result"]
		"pay":
			r = await _run_payment_lane("pay", args)
		"wire":
			r = await _run_payment_lane("wire", args)
		"approve":
			# Bob's wait path — the owner's timed release after the clock, silent. Never the manager (U4+).
			r = await Chain.call_async("approve", {"txId": str(args.get("txId", "")), "as": "owner"}, 120.0)
		"manager_approve":
			# Walker's post-clock stamp was removed in U4+ (ROLE_SET 3). Kept as a refusal so a stale dialogue line
			# gets his bank line instead of a chain revert.
			r = {"ok": false, "error": {"code": "MANAGER_NO_STAMP", "message": "the manager does not stamp vault releases (U4+); use priority before the clock or Bob after it"}}
		"priority":
			# Walker's Priority release: the one call that may open a second Privy surface (Passkey + sign sheet).
			# A human scans a hand, so the timeout is generous, like login.
			r = await Chain.call_async("priority", {"txId": str(args.get("txId", ""))}, 300.0)
		"cancel", "manager_cancel":
			r = await Chain.call_async("cancel", {"txId": str(args.get("txId", "")), "as": "manager" if action.begins_with("manager") else "owner"}, 120.0)
		"open_console":
			# The bank computer. Asks the shell for its Console overlay; the panel then outlives this call, and
			# movement stays locked until the shell pushes `terminal.closed` (docs/TERMINAL-CONSOLE.md §4).
			r = await Chain.call_async("openConsole", {}, 30.0)
			if r.get("ok", false):
				terminal_open = true
				ui_locked = true
		"open_inpc":
			# The iNPC's Wake / chat panel (docs/INPC.md). The shell owns the panel and the player's OpenRouter key;
			# Godot hands over a player-safe snapshot and locks movement until the shell pushes `inpc.closed`. There is
			# no bridge verb behind this panel that can pay, wire, release, approve, recall, provision or open the Console.
			# Refresh the mirror *before* the hand-over so Live desk-debug advances (provision / Pay / Re-check) that
			# only updated React still converge into this board — the panel must not open on a frozen empty snapshot.
			await _freshen_inpc_mirror()
			r = await Chain.call_async("openInpc", {"snapshot": inpc_snapshot()}, 30.0)
			if r.get("ok", false):
				inpc_open = true
				ui_locked = true
				if r.get("result") is Dictionary:
					inpc_awake = bool(r["result"].get("awake", inpc_awake))
		"sleep_inpc":
			# Forget the key from the prop's own dialogue: the shell wipes sessionStorage + the conversation and
			# closes its panel if it was up. The same wipe runs behind the panel's own Sleep button.
			r = await Chain.call_async("sleepInpc", {}, 30.0)
			if r.get("ok", false):
				inpc_awake = false
				inpc_following = false   # Sleep = Unfollow + home; the prop snaps back on `changed`
		"observer_list":
			r = await Chain.call_async("observerList", {}, 20.0)
		"observer_grant":
			# Kept for completeness and for the desk tests: in the bank the address is typed on the Console overlay.
			r = await Chain.call_async("observerGrant", {"address": str(args.get("address", args.get("name", "")))}, 180.0)
		"observer_revoke":
			r = await Chain.call_async("observerRevoke", {"address": str(args.get("address", ""))}, 180.0)
		"refresh":
			r = {"ok": true, "result": {}}
		_:
			r = {"ok": false, "error": {"code": "UNKNOWN_METHOD", "message": "no desk action named %s" % action}}
	if not r.get("ok", false):
		_note_error(r.get("error", {}))
	await refresh_all()
	if action.begins_with("ens"):
		await refresh_names()
	if action.begins_with("observer"):
		await refresh_observers()
	# An enable or a fill *changed* the till (door rows, balances) — force the re-read; the FX_REFRESH_SEC throttle is
	# for idle polling, not for a board that has just been told "Filled." A fiat counter pay moves the same balances.
	if (action.begins_with("fx") and action != "fx_quote") or (action == "pay" and str(args.get("token", "")) != ""):
		await refresh_fx(true)
	# A load changes *which* account this desk works from, so two mirrors that are keyed to the account and not
	# to the owner go stale: the viewing list (OBSERVER lives on the account) and, on Live, Johnny's till — where
	# `fxTillIsMain` makes the till the very account Iris just swapped (docs/SEPOLIA-LIVE.md §1).
	if action == "load_account":
		await refresh_observers()
		await refresh_fx(true)
	busy = false
	changed.emit()
	return r


## Pay-by-name is a resolve step followed by the unchanged Remote EVM Lane A/B call.
## The resolved address is never sent to Godot from a scene script; it stays inside this action boundary.
func _run_payment_lane(lane: String, args: Dictionary) -> Dictionary:
	var to := str(args.get("to", ""))
	var name := str(args.get("name", "")).strip_edges()
	if name != "":
		var resolved := await Chain.call_async("resolveName", {"name": name}, 20.0)
		if not resolved.get("ok", false):
			return resolved
		var target: Dictionary = resolved.get("result", {})
		to = str(target.get("address", ""))
	var method_args := {"to": to, "amount": str(args.get("amount", "")), "memo": args.get("memo", "")}
	# Multi-token Lane A (2026-09-10): `token` = USD (default) | EUR | ILS. Only the counter (`pay`) takes it; the
	# vault is practice dollars only, and the desk refuses a fiat wire in words rather than here.
	if lane == "pay" and str(args.get("token", "")) != "":
		method_args["token"] = str(args["token"]).to_upper()
	return await Chain.call_async(lane, method_args, 120.0)


# ---------------------------------------------------------------- errors → NPC lines (docs/NPCS.md §5)

## The bank line for an error code, with `{release_in}` filled from the record the error names when it can.
func error_line(err: Dictionary, ctx: Dictionary = {}) -> String:
	var entry := error_entry(err)
	var extra := ctx.duplicate()
	if err.has("releaseTime"):
		extra["release_in"] = fmt_duration(int(str(err["releaseTime"])) - now())
	elif ctx.has("txId") and not wire_by_id(str(ctx["txId"])).is_empty():
		extra["release_in"] = fmt_duration(remaining(wire_by_id(str(ctx["txId"]))))
	return Dialogue.interpolate(str(entry.get("line", "")), vars(extra))


## The "Ask why" half: the protocol explanation plus the raw code and message.
func error_why(err: Dictionary) -> String:
	var entry := error_entry(err)
	var code := str(err.get("code", "Unknown"))
	var msg := str(err.get("message", ""))
	return "%s\n[%s] %s" % [str(entry.get("why", "")), code, msg.substr(0, 220)]


func error_entry(err: Dictionary) -> Dictionary:
	var code := str(err.get("code", "Unknown"))
	if errors.has(code):
		return errors[code]
	# The Teller Desk reports a settled-but-wrong record as RECORD_<STATUS>.
	if code.begins_with("RECORD_") and errors.has("RECORD_*"):
		return errors["RECORD_*"]
	var d: Dictionary = errors.get("default", {"line": "Sorry — the counter could not do that.", "why": ""})
	if err.has("bankLine") and str(err["bankLine"]) != "":
		d = d.duplicate()
		d["line"] = str(err["bankLine"])
	return d


func last_error() -> Dictionary:
	return _last_error


func _note_error(err: Dictionary) -> void:
	_last_error = err
	if not err.is_empty():
		toast.emit(error_line(err), "error")


# ---------------------------------------------------------------- events

func _on_chain_event(kind: String, payload: Dictionary) -> void:
	match kind:
		"stage":
			_on_stage(payload)
		"tab.visible":
			if bool(payload.get("visible", false)):
				reconcile_pending("tab.visible")
		"desk.link":
			_on_desk_link(payload)
		"terminal.closed":
			_on_terminal_closed(payload)
		"branch-float.closed":
			_on_branch_float_closed(payload)
		"inpc.closed":
			_on_inpc_closed(payload)
		"inpc.open":
			# Phone Talk (shell) → same Godot path as the prop: refresh mirror, openInpc with fresh snapshot, set inpc_open.
			_on_inpc_open_request()
		"inpc.freshen":
			# Full panel Ask: re-pull session/passbook, then push one complete board (shell awaits the push).
			_on_inpc_freshen_request()
		"inpc.follow":
			# Phone Follow / Unfollow: flip the companion bit only. Not an overlay — no lock, no snapshot, no verb.
			_on_inpc_follow(payload)
		"bridge.ready":
			pass


## Phone Talk asked the bank to open the full typing panel. Must not open from a cached shell snapshot — reuse
## `open_inpc` so `inpc_open` + floor lock + `_push_inpc_snapshot` stay on the same contract as the prop.
func _on_inpc_open_request() -> void:
	if inpc_open:
		await _on_inpc_freshen_request()
		return
	await run_action("open_inpc", {})


## Re-pull the mirror and hand the panel one complete player-safe board. Used before Ask and when Talk hits an
## already-open panel. Does not touch desk-debug React state.
func _on_inpc_freshen_request() -> void:
	await _freshen_inpc_mirror()
	await Chain.call_async("inpcSnapshot", {"snapshot": inpc_snapshot()}, 10.0)


## The player shut the assistant's panel (Esc, Close, Sleep or the backdrop). Same shape as the Console: the panel is
## the shell's, so this event is what makes the bank walkable again. `awake` rides along because Sleep is one of the
## ways the panel closes, and the eye must go dark on the same frame.
func _on_inpc_closed(p: Dictionary) -> void:
	if p.has("awake"):
		inpc_awake = bool(p["awake"])
	if not inpc_awake:
		inpc_following = false   # Sleep (or a vanished key): a dormant assistant never follows
	if inpc_open:
		inpc_open = false
		ui_locked = Dialogue.active or overlay_open()
	changed.emit()


## Phone Follow / Unfollow (HANDOFF-inpc-companion-follow). Awake only: a dormant assistant refuses silently and the
## bit stays false. Deliberately touches neither `inpc_open` nor `ui_locked` — Follow is spatial chrome, not an
## overlay, and the phone must leave WASD and the desks free (same contract as phone Talk ≠ lock).
func _on_inpc_follow(p: Dictionary) -> void:
	var want := inpc_awake and bool(p.get("following", false))
	if want == inpc_following:
		return
	inpc_following = want
	changed.emit()


## The player shut the Console overlay. The panel is the shell's, so this is the only signal that the bank is
## walkable again — `open_console` resolved the moment the panel mounted, deliberately not when it closes
## (docs/GODOT.md §4: no bridge call is held open while somebody reads a ledger).
func _on_terminal_closed(_p: Dictionary) -> void:
	if not terminal_open:
		return
	terminal_open = false
	ui_locked = Dialogue.active or overlay_open()
	refresh_observers()
	changed.emit()


## The player dismissed the read-only ops float panel. Unlike a hard funding lock, this always restores the prior
## floor state even while the health signal remains short.
func _on_branch_float_closed(_p: Dictionary) -> void:
	if not branch_float_open:
		return
	branch_float_open = false
	ui_locked = Dialogue.active or overlay_open()
	changed.emit()


## The Teller Desk SSE stream came or went (U4). Both lines come from real link state: the shell pushes this
## only on a transition of its EventSource. On reconnect the server has re-read the vault and re-armed its
## watchers, so the board is reconciled once here as well.
func _on_desk_link(p: Dictionary) -> void:
	var connected := bool(p.get("connected", false))
	if connected == desk_linked:
		return
	desk_linked = connected
	if connected:
		toast.emit(str(strings.get("desk_link_back", "Back in touch with the branch.")), "info")
		reconcile_pending("desk reconnect")
	else:
		toast.emit(str(strings.get("desk_link_lost", "Lost the branch for a moment — reconnecting…")), "error")
	changed.emit()


## A Teller Desk stage event. The vault board is updated from what the event carries; the chain's
## `releaseTime` string is stored as-is, and `serverNow` corrects the local clock.
func _on_stage(ev: Dictionary) -> void:
	last_stage = ev
	_sync_clock(ev.get("serverNow"))
	var lane := str(ev.get("lane", ""))
	var st := str(ev.get("stage", ""))
	var tx_id := str(ev.get("txId", ""))
	if lane == "B" and tx_id != "":
		var idx := -1
		for i in wires.size():
			if str(wires[i].get("txId", "")) == tx_id:
				idx = i
		match st:
			"pending", "released":
				if idx < 0:
					wires.append({"txId": tx_id, "status": "PENDING", "releaseTime": str(ev.get("releaseTime", "0")), "released": st == "released", "requester": ""})
				else:
					if ev.has("releaseTime"):
						wires[idx]["releaseTime"] = str(ev["releaseTime"])
					wires[idx]["released"] = st == "released"
					wires[idx]["status"] = str(ev.get("status", "PENDING"))
			"mined", "cancelled", "failed":
				if idx >= 0 and st != "failed":
					wires.remove_at(idx)
				# a settled wire moves money or frees it; either way the passbook changed
				if st != "failed":
					refresh_passbook()
	elif lane == "A" and st == "mined":
		refresh_passbook()
	elif lane == "PROVISION" and st == "mined":
		refresh_all()
	stage.emit(ev)
	changed.emit()


func _sync_clock(server_now: Variant) -> void:
	if server_now == null:
		return
	var s := str(server_now)
	if s == "" or not s.is_valid_int():
		return
	clock_offset = float(int(s)) - Time.get_unix_time_from_system()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_IN or what == NOTIFICATION_WM_WINDOW_FOCUS_IN:
		if booted:
			reconcile_pending("window focus")


func set_zone(zone: String) -> void:
	if zone == current_zone:
		return
	current_zone = zone
	zone_changed.emit(zone)


# ---------------------------------------------------------------- helpers

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("GameState: missing %s" % path)
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		return parsed
	push_error("GameState: %s is not a JSON object" % path)
	return {}


## Input actions are declared here rather than in project.godot so the bindings are reviewable in one place.
func _setup_controls() -> void:
	_bind("move_forward", [KEY_W, KEY_UP])
	_bind("move_back", [KEY_S, KEY_DOWN])
	_bind("move_left", [KEY_A])
	_bind("move_right", [KEY_D])
	# U7 polish (principal playtest): Space is the only interact key; E orbits right to pair with Q (R is unbound).
	_bind("cam_left", [KEY_LEFT, KEY_Q])
	_bind("cam_right", [KEY_RIGHT, KEY_E])
	_bind("interact", [KEY_SPACE])
	_bind("debug_toggle", [KEY_F1])


## Both the physical and the logical key are bound: browsers (and automation) do not always send `code`,
## and Godot web maps that to `physical_keycode`, so a physical-only binding can be silently dead.
func _bind(action: String, keys: Array) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var phys := InputEventKey.new()
		phys.physical_keycode = k
		InputMap.action_add_event(action, phys)
		var logical := InputEventKey.new()
		logical.keycode = k
		InputMap.action_add_event(action, logical)
