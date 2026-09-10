# Godot — Engine Setup, Web Export, JavaScript Bridge, Conventions

> Godot renders the bank and owns the dialogue; it never holds a key and never talks to a chain directly. Everything on-chain goes through `window.BranchZero`.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) § 2 and § 5 · [WORLD-3D-ENVIRONMENT.md](./WORLD-3D-ENVIRONMENT.md) · [GAME-DESIGN.md](./GAME-DESIGN.md)

---

## 1. Versions and toolchain

| Item | Choice | Why |
|------|--------|-----|
| Godot | **4.5.x stable** (GDScript only) | C# is not supported for Web export in Godot 4; GDScript keeps one language in the game |
| Renderer | **Compatibility** (WebGL 2) | Forward+ / Mobile are not available on Web |
| Threads | **Disabled** (single-threaded export) | Threaded export requires COOP/COEP headers which break Privy's iframe and most third-party embeds |
| Export template | Official 4.5.x web template | — |
| Shell | Vite + React (`apps/web`) hosting the exported `.html/.js/.wasm/.pck` under `/game/` | Custom HTML gives us control of the overlay and headers |
| Hosting | Cloudflare Pages / Vercel (static) with `.wasm` served `application/wasm`, gzip/brotli on | Judges load it from a link |
| Node | 20 LTS for the shell and Teller Desk | — |

---

## 2. Project settings (`project.godot` highlights)

```ini
[application]
config/name="Branch Zero"
run/main_scene="res://scenes/main/main.tscn"

[display]
window/size/viewport_width=1280
window/size/viewport_height=720
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"

[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.web="gl_compatibility"
textures/vram_compression/import_etc2_astc=true
anti_aliasing/quality/msaa_3d=0
lights_and_shadows/directional_shadow/size=2048

[physics]
3d/physics_engine="Jolt Physics"   ; 4.4+ built in

[input]
interact={"deadzone":0.5,"events":[Key E, Gamepad A]}
```

Export preset (`export_presets.cfg`, Web):

```ini
variant/extensions_support=false
variant/thread_support=false          ; REQUIRED — see § 1
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=false
html/custom_html_shell="res://export/shell.html"
html/canvas_resize_policy=2           ; adaptive
html/focus_canvas_on_start=true
html/experimental_virtual_keyboard=false
progressive_web_app/enabled=false
```

Command line export (CI):

```bash
godot --headless --path apps/game --export-release "Web" ../web/public/game/index.html
```

---

## 3. Custom HTML shell

> **U0 decision (2026-09-06):** the shell is `apps/web/index.html` served by Vite; `apps/web/src/main.ts` installs `window.BranchZero`, then loads `/game/index.js` and starts `Engine` on `#canvas` with `ensureCrossOriginIsolationHeaders: false`. Godot's own exported `index.html` is ignored and `res://export/shell.html` is **not** created. `npm run export:web` (`scripts/export-web.mjs`) runs `--import` then `--export-release Web`; the exported `GODOT_CONFIG` was checked to carry `ensureCrossOriginIsolationHeaders:false`. The text below describes the Godot-side alternative if a PWA/splash shell is ever needed.

`res://export/shell.html` is a copy of the default shell with:

- `<script type="module" src="/bridge.js">` loaded **before** the engine starts, so `window.BranchZero` exists on first frame.
- The engine canvas inside a full-screen `<div id="game">`; the React overlay root `<div id="overlay">` positioned above it (`pointer-events: none` except on children).
- No `Cross-Origin-Embedder-Policy` headers anywhere (single-threaded build does not need them).
- Loading screen with the bank logo and the sponsor strip.

The Vite app owns everything outside the canvas: Privy login modal, toasts, the "Ask why" side panel (optional; may also be in-game UI).

---

## 4. JavaScriptBridge contract

GDScript side: one autoload `Chain.gd` wraps all JS calls. Never call `JavaScriptBridge` from scene scripts.

```gdscript
# res://autoload/chain.gd
extends Node

signal event(kind: String, payload: Dictionary)   # SSE relay from the bridge

var _bz: JavaScriptObject
var _cb: JavaScriptObject
var _pending := {}   # request id -> Callable

func _ready() -> void:
    if not OS.has_feature("web"):
        push_warning("Chain: not on web, using MockChain")
        return
    _bz = JavaScriptBridge.get_interface("BranchZero")
    _cb = JavaScriptBridge.create_callback(_on_js_message)
    _bz.setGodotCallback(_cb)

func call_async(method: String, args: Dictionary) -> Dictionary:
    var id := str(randi())
    _bz.request(method, JSON.stringify(args), id)
    var result: Dictionary = await _await_id(id)
    return result

func _on_js_message(args: Array) -> void:
    var msg: Dictionary = JSON.parse_string(args[0])
    match msg.get("type"):
        "response": _resolve(msg.id, msg.result)
        "event":    event.emit(msg.kind, msg.payload)
```

JS side (`apps/web/src/bridge.ts`) exposes a **flat, JSON-only** API. All values are strings (bigint → decimal string, addresses checksummed, bytes hex).

| Method | Args | Returns | Backing |
|--------|------|---------|---------|
| `getSession` | — | `{ loggedIn, userId, owner, account?, ensName?, chainId }` | Privy + Teller `/status` |
| `login` | — | `{ owner }` | Privy modal (only pop-up in the game) |
| `delegate` | — | `{ ok }` | Privy session-signer consent (part of the same modal flow) |
| `provision` | `{ chainId }` | `{ account, txHash }` | Teller `/provision` |
| `faucet` | — | `{ ok, balance, hash? }` | Teller `/faucet` — Main-wing deployer transfer up to `OPENING_BALANCE_USDC`; already-full is a no-op and it never opens Privy |
| `getBalances` | `{ chainId }` | `{ native, usdc }` | viem reads |
| `resolveName` | `{ name }` | `{ address, chainId, avatar? }` | ENS (Sepolia) |
| `pay` | `{ chainId, to, amount, memo }` | `{ txId, txHash }` | Teller `/pay` (Lane A) |
| `wire` | `{ to, amount, memo }` | `{ txId, releaseTime, chainNow, serverNow, hash, status }` | Teller `/wire` (Lane B request). **No `releaseSeconds`** — the cooling period is the account's own `timeLockPeriodSec`, fixed at `initialize`; the game cannot shorten it |
| `approve` | `{ txId }` | `{ hash, txId, status, balanceAfter? }` | Teller `/approve` — **owner only** (Bob's wait path, after `releaseTime`). U4+: `as: "manager"` is refused (`MANAGER_NO_STAMP`) |
| `cancel` | `{ txId, as?: "owner" or "manager" }` | `{ hash, txId, status }` | Teller `/cancel` (recall) |
| `priority` (U4+) | `{ txId }` | `{ hash, txId, status, actor: "priority", releaseTime, chainNow, balanceAfter, mfaPrompted }` | Teller `/priority/prepare` → Privy **user signer** (`clear()` + `promptMfa()` Passkey when enrolled, `signTypedData` with `showWalletUIs`) → `/priority/submit`. The one method allowed to open a second Privy surface; hands focus back to the canvas afterwards. Refuses a released wire (`NOT_COOLING`) |
| `listPending` | — | `{ items: [{ txId, status, releaseTime, released, to, amount, requester }], serverNow }` | `getPendingTransactions` + `getTransaction` |
| `getSession` (U3) | — | `{ loggedIn, ready, userId?, owner?, account?, delegated?, signingMode?, chainId?, timeLockSec?, instantLimit?, manager?, token? }` | Privy auth state + Teller `/session`. **Never opens a modal**; `loggedIn:false` is a normal answer |
| `getHistory` (U3) | `{ limit }` | `{ items: [receipts], serverNow }` | Teller `/status.receipts` (the ledger board's right column) |
| `getHistory` | `{ chainId, limit }` | `{ items }` | Teller watcher cache |
| `ensAvailable` / `ensMint` / `ensSetText` | see [ENS.md](./ENS.md) | — | Teller `/ens/*` |
| `fxStatus` (S1) | — | `{ chainId, account, enabled, usdc, weth, symbolIn, symbolOut, pool{id,fee,tick,liquidity,router,quoter}, whitelist[], explorer, serverNow }` | Teller `/fx/status` — the till on Sepolia, re-read from the chain each time |
| `fxQuote` (S1) | `{ amount }` | `{ quoteId, amountIn, amountOut, minOut, rate, fee, slippage, deadline, serverNow, validSec, poolId }` | Teller `/fx/quote` — V4Quoter by `eth_call`; signs nothing and works signed-out |
| `fxEnable` (S1) | — | `{ account, guardHash?, roleHash?, actions[], whitelist[] }` | Teller `/fx/enable` — registers the three schemas, whitelists their targets, grants OWNER / BROADCASTER. Silent (session signer) |
| `fxSwap` (S1) | `{ quoteId?, amount? }` | `{ account, amountIn, amountOut, minOut, steps[{step,hash,explorer}], hash, explorer, usdcAfter, wethAfter, fee? }` | Teller `/fx/swap` — up to three guarded Lane A meta-transactions on Sepolia (token `approve` → Permit2 `approve` → UniversalRouter `execute`). **No second Privy surface** |
| `switchWing` | `{ chainId }` | `{ ok }` | local state + Privy chain switch |
| `openConsole` (stretch) | — | `{ opened, mode: "iframe" \| "tab", url, account }` | The bank computer's terminal overlay (`apps/web/src/overlay/Terminal.tsx`): an iframe of `bloxchain.app/accounts` plus the viewing-wallet form. Resolves when the **panel mounts**, not when it closes — the game unlocks movement on the `terminal.closed` event instead, because a player may read the Console for minutes and no bridge call should be held open that long. MockChain refuses it (`CONSOLE_UNAVAILABLE`): the panel is the shell's, and claiming to open one it cannot produce would be a lie the player can see |
| `observerGrant` / `observerRevoke` / `observerList` (stretch) | `{ address }` (grant also takes an ENS `name`) | `{ role, roleName, exists, maxWallets, wallets, changed, address, hash? }` | Teller `/observer/*` — the `OBSERVER` runtime role: membership only, **zero** function permissions, so a wallet the player already holds can pass `_validateAnyRole()` on the permissioned registry views (V10) and nothing else. Idempotent; a name is resolved through the existing `/ens/resolve` first. See [TERMINAL-CONSOLE.md](./TERMINAL-CONSOLE.md) |

Events pushed to Godot (`type: "event"`), as built through U3: `bridge.ready` `{ version, mock }` (first message after
`setGodotCallback`; `mock` is `false`, `"fresh"` or `"account"` — see §5a), `stage` (a Teller Desk `StageEvent`
relayed verbatim from SSE; carries `lane`, `stage`, `bankLine`, `txId`, `releaseTime`, `serverNow`, `chainNow`),
and `tab.visible` `{ visible }` (from `visibilitychange`, so Godot reconciles the board with `listPending` once the tab
is back), plus (stretch) `terminal.closed` `{ reason }` — the player shut the Console overlay, so `GameState` clears
`terminal_open` and hands movement back. U4 adds `desk.link` `{ connected, attempt, reason? }` — the state of the Teller Desk SSE stream as the shell's
reconnecting `EventSource` sees it (`apps/web/src/shell/deskEvents.ts`); `GameState` toasts the transition and reconciles
the board on every reconnect, because the server re-reads the vault and re-arms its watchers on each `/events` connect. The finer-grained `tx.*` / `balance.changed` / `session.changed` names from the plan were not needed: the
game derives them from `stage`.

Rules:
- Godot never sees private keys, session tokens or Privy IDs beyond `userId`.
- Every call has a timeout (15 s) and returns `{ error: { code, message } }` on failure; NPCs have a line for each `code` (see [NPCS.md](./NPCS.md) § 5).
- On desktop (editor) `MockChain.gd` implements the same API with fake latency and canned data so gameplay can be iterated offline.

### 4d. Bridge version `s2.3` (as built 2026-09-10; adds the optional iNPC)

`apps/web/src/bridge/branchZero.ts`. `s2.3` adds four **shell-only** methods for the optional service assistant
([INPC.md](./INPC.md), [missions/HANDOFF-inpc-openrouter.md](./missions/HANDOFF-inpc-openrouter.md)) and one event:

| Method / event | Direction | What it does |
|---|---|---|
| `openInpc({snapshot})` | Godot → shell | Mounts the Wake / chat / Sleep panel (`overlay/Inpc.tsx`) with `GameState.inpc_snapshot()`; resolves `{opened, awake}` once mounted |
| `inpcSnapshot({snapshot})` | Godot → shell | A fresher snapshot while the panel is up (GameState pushes one on every `changed` while `inpc_open`) |
| `inpcStatus()` | Godot → shell | `{awake}` — is an OpenRouter key in this tab's `sessionStorage`? Yes/no only; read once at boot |
| `sleepInpc()` | Godot → shell | Wipe key + transcript (the prop's "Put it to sleep" choice); closes the panel if it is up |
| `inpc.closed {reason, awake}` | shell → Godot | Every exit path of the panel (Esc, Close, backdrop, Sleep). Godot unlocks on this event, never on the `openInpc` promise, and mirrors `awake` into the prop's eye |

Rules that follow, all mirroring the Terminal Console pattern:

- **The key never crosses the bridge.** The player pastes it in the panel; it lives in `sessionStorage` under
  `inpc.openrouter.key`; `localStorage`, `.env`, `VITE_*` and the Godot side never hold it. Sleep and closing the tab
  wipe it. `inpcStatus` answers a boolean.
- **The snapshot is player-safe by construction** (`GameState.inpc_snapshot()`): no account / owner address, no tx
  hash, no calldata, no receipts, no Live/Dev or desk-link chrome. The shell whitelists it again (`inpc/snapshot.ts`)
  and re-derives READY from the chain's `releaseTime` against the desk clock at send time.
- **No product proxy.** The panel POSTs `https://openrouter.ai/api/v1/chat/completions` from the browser, model
  `thinkingmachines/inkling-small`, `max_tokens: 2048` always. 401 / 402 / 403 bodies are shown as OpenRouter wrote
  them, with a bank line beside them and no retry.
- **`Chain.SHELL_METHODS`.** These four go to the real shell even under `?mock` (they touch no chain), which is how a
  MockChain walk with a pending wire drives the real panel. With no shell at all, MockChain refuses `INPC_UNAVAILABLE`.
- **Locks.** `GameState.overlay_open()` = `terminal_open or inpc_open`; `Dialogue.close()`, the player menu and the
  prompt all read it, so Esc order (dialogue → slips → Console / iNPC panel → visitor's card) and `focusCanvas()` on
  close hold for both overlays. `run_action("open_inpc")` sets `inpc_open` + `ui_locked`; `inpc.closed` clears them.
- **In-world.** `scripts/inpc.gd` (`InpcProp extends BankTerminal`, so `main.gd` ranks it with the terminals for the
  [Space] prompt) stands at `(7.6, 0, 2.4)` facing west; `dialogue/inpc.json` has two verbs, `open_inpc` and
  `sleep_inpc`. `tests/run_inpc_walk.gd` walks the Godot half headless; `tests/run_checks.gd` guards the verb list, the
  copy and staff-file silence.

`s2.2` before it added `starGithub` (front-door GitHub stars); `s2.4` after it (a parallel unit) adds the player ops
float. Everything below is unchanged.

### 4c. Bridge version `s2.1` (as built; adds Ines's load slip)

`apps/web/src/bridge/branchZero.ts`. `s2.1` adds one method, **`loadAccount`** — Ines adopting an AccountBlox the
player already owns on the current wing (docs/LOAD-ACCOUNT.md). It opens **no** Privy surface: the desk re-pins the
app-owned policy rules to the loaded address on its own side, so the one consent from Account Opening still covers
it, and `priority` remains the only method allowed to show a wallet sheet. The bridge checks the shape only
(`0x` + 40 hex) and deliberately does **not** resolve an ENS name, unlike `observerGrant`: a customer name points at
whichever account the Name Desk recorded, which may be exactly the account the player is trying to move away from.
Godot routes it through `GameState.run_action("load_account", {account})` at a 300 s timeout (a load runs the same
config batches as a Re-check), and the slip that collects the number is a Godot form
(`scripts/load_account_form.gd`, the `name_claim` family) rather than an overlay. `MockChain` answers from two
canned numbers so the greybox can walk the adopt, the foreign-owner refusal and the not-an-account refusal.

`s2.0` before it added **`setMode`** (Live | Developer Mode) and the `mode` / `chainName` / `fxTillIsMain` fields on
`getSession`. Everything below is unchanged.

### 4b. Bridge version `s1.0` (as built; adds Kenji's FX desk)

`apps/web/src/bridge/branchZero.ts`. `s1.0` adds four methods — `fxStatus`, `fxQuote`, `fxEnable`, `fxSwap` — and
changes nothing else: ENS (`u5.0`), the Terminal Console (`u5.1`) and Priority (`u4.1`) are untouched. The FX desk
executes on **Sepolia**, from a second `AccountBlox` (the "FX till") owned by the same Privy wallet, while pay / wire
/ release stay on Remote EVM 1337. It opens **no** Privy surface: every FX write uses the Lane A shape (the owner's
session signer signs, a Sepolia broadcaster submits), so `priority` remains the only method allowed to show a wallet
sheet. `fxQuote` is a read and deliberately works signed-out, so the board can price a swap for someone still in the
lobby. Godot routes these through `GameState.run_action("fx_quote" / "fx_enable" / "fx_swap")`, and `GameState`
refuses to take a quote whose deadline has passed rather than let the desk silently re-price it. `MockChain` answers
all four from a constant-product curve labelled "MockChain: no Uniswap here".

**Fiat pairs (2026-09-09, no version bump):** `fxQuote` and `fxSwap` carry `pair` = `EUR` | `ILS` (default `EUR`;
anything else is the desk's `FX_PAIR`). `fxStatus` returns `usdc` / `eur` / `ils` balances and `pairs[]` (per pool:
`midRate`, `seedRate`, `pool`), and no longer carries `weth` / `pool`; `GameState.fx_pair("EUR")` reads one entry and
the `fx_desk` fact is `fx.has("pairs")`. A swap result names its `pair`. MockChain mirrors both $100M books.

### 4a. Bridge version `u5.1` (as built)

`apps/web/src/bridge/branchZero.ts`. `u5.1` (Terminal Console stretch) adds **`openConsole`** and the three
**`observer*`** methods above, and the **`terminal.closed`** event; every overlay exit path calls `focusCanvas()` and
the panel renders nothing while closed, so no hit target is ever left over `#canvas` (§5b). `u5.0` added the ENS Name
Desk verbs. `u4.1` added one method, **`priority`** (Okafor's desk, U4+): the overlay
prepares the owner's `SIGN_META_APPROVE` payload at the Teller Desk, asks the player's *own* Privy signer to sign it
with the wallet UI shown — preceded by a fresh Passkey (`useMfa().clear()` + `promptMfa()`) when the player has MFA
enrolled — and hands the signature back for the Branch Manager to submit. It is the only bridge method allowed to open a
Privy surface after Account Opening, and like `login` it calls `focusCanvas()` in a `finally`. `approve` is owner-only
(`as` is ignored). `u4.0` added **no methods**: the `desk.link` event above, and `login` /
`addSessionSigner` hand DOM focus back to the canvas when the Privy modal closes (`shell/focus.ts`, see §5b). Godot's side is `autoload/chain.gd`, with `call_async(method, args, timeout_sec)`
— the timeout is **per call**: `login` waits up to 600 s for a human OTP, `provision` 300 s, lane calls 120 s, reads 20 s.
Teller Desk error codes (`NO_ACCOUNT`, `NOT_PENDING`, `BeforeReleaseTime`, `policy_violation`, …) travel unchanged in
`error.code`; the game maps them to NPC lines in `apps/game/dialogue/errors.json` (NPCS.md §5). Every desk action
in the game goes `Dialogue` → `GameState.run_action` → `Chain.call_async`; scene scripts never touch the bridge.

---

## 5. Background tab and timers

Browsers throttle `requestAnimationFrame` in background tabs, so Godot's `_process` stops. Consequences and rules:

- **No gameplay-critical timers in Godot.** Release time comes from chain (`getTransaction().releaseTime`); the board recomputes remaining time from `Time.get_unix_time_from_system()` on each frame.
- **Correct the local clock against the desk, not against the chain.** Every stage event and `listPending`
  carries `serverNow` (the Teller Desk's wall clock). Keep `offset = serverNow - localNow` and count down
  `releaseTime - (localNow + offset)`. Do **not** count against `chainNow`: Remote EVM mines on demand, so
  its latest block timestamp is frozen between transactions and the clock would appear stopped
  ([REMOTE-EVM.md](./REMOTE-EVM.md) section 1a). `releaseTime` itself is still read only from the chain.
- The bridge keeps SSE alive in JS (not throttled the same way); on tab focus Godot calls `listPending` once to reconcile.
  As built (U3): the bridge pushes `tab.visible` on `visibilitychange` **and** `GameState` listens for
  `NOTIFICATION_APPLICATION_FOCUS_IN` / `NOTIFICATION_WM_WINDOW_FOCUS_IN`; either path calls `reconcile_pending`,
  throttled to once per 2 s.
- **A hidden tab is a stopped game.** Browsers do not fire `requestAnimationFrame` for a hidden tab at all, so Godot's
  `_process`, `_physics_process` and `SceneTreeTimer`s do not advance — a `login` awaited in Godot will only resolve
  once the tab is visible again. Nothing in Godot may therefore be *required* to happen while hidden; the Teller Desk
  watcher and SSE carry the state in the meantime.
- Audio: resume `AudioServer` on first input after focus (browser autoplay policy).

### 5b. Canvas focus (U4)

Godot's web export listens for `keydown` **on the canvas element**, not on `document`. The game therefore only hears
keys while `#canvas` is `document.activeElement`; any click on a React control or a finished Privy modal moves focus
off it and WASD / `Space` go dead. Rules that follow:

- Nothing may sit over the canvas as a hit target when it is not meant to be one. The U4 playtest bug was the
  full-viewport `#boot` status div (`position: fixed; inset: 0`) left in the DOM after loading: every click on the
  bank hit it, so Godot's own `mousedown → canvas.focus()` never ran. It is `pointer-events: none` and `hidden` once
  the engine runs (`apps/web/index.html`, `src/main.ts`).
- The shell calls `focusCanvas()` (`src/shell/focus.ts`) after the interactions it owns: the debug panel's *hide*,
  and the bridge's `login` / `addSessionSigner` once the Privy flow settles. It focuses now and again on two
  timers — not `requestAnimationFrame`, which a background tab never runs — because React unmounts the clicked button
  in the same commit and an unmounted focused element drops focus to `<body>`.
- Verified 2026-09-07 in the shell: pill → `body`; click bank → `canvas`; *hide* → `canvas`; `F6` teleports, `E` opens Mo
  (U7 polish since then: **Space** talks, **E** orbits the camera right, and `F6` needs `?debug=1`).
- U4+: the Priority hand scan (Privy MFA sheet + sign sheet) is the second surface that moves focus; the bridge's
  `priority` handler calls `focusCanvas()` in a `finally`, success or refusal.

### 5a. MockChain and the `?mock` flag (U3)

`autoload/mock_chain.gd` answers the whole bridge API from canned state (addresses start `0xM0CK…`, cooling period
30 s, receipts local; U4+ `priority` is a 1.8 s timer labelled "MockChain: no Passkey, nothing signed" and
`approve as: manager` answers `MANAGER_NO_STAMP`). `godot --headless --path apps/game -s tests/run_mock_walk.gd`
boots the autoloads by hand and walks Bob's and Okafor's desks against it (U4+) — a `-s` script gets no project
autoloads, so the test adds `Chain` / `GameState` / `Dialogue` to the root itself. It is used automatically on desktop, and on web when the shell URL carries `?mock` (`?mock=account`
starts as a signed-in, delegated player with an open, funded account). The real bridge stays installed; only Godot's
`Chain` routes calls to the mock. It exists to walk the greybox without an inbox and proves nothing about the chain —
kill tests run against the Teller Desk (REMOTE-EVM.md §5). Tester keys (**only with `?debug=1`** on the web, or `-- --debug` / `BRANCH_ZERO_DEBUG=1` on desktop — U7 polish: a plain `?mock=account` playtest never teleports): **F2 / F3 / F4 / F6 / F7 / F8** teleport to Account Opening /
Counter 1 / Vault / Lobby / Manager / Name Desk (F5 is the browser's reload and is left alone); **1–9** pick a dialogue choice; **Enter** in the payment slip hands it in.

**Walking demo reel (MockChain):** `godot --path apps/game -- --demo=walk` (or `BRANCH_ZERO_DEMO=walk`, or web
`?mock=account&demo=walk`) runs `scripts/demo_walk.gd` — full desk circuit with pauses. Record with
`powershell -File .\scripts\record-demo-walk.ps1` (default: ffmpeg **ddagrab** client-rect grab + go marker so Mo is
on film; `-Encoder x264` falls back to GameLab `runtimes/capture`). Keep the Godot window maximized on the primary
monitor; leave the desktop alone for ~4 minutes. Output under `docs/progress/captures/` (gitignored). See local
`docs/progress/2026-09-07-u7-ship-reel.md` for the accepted take.

---

## 6. Scene and code conventions

```
apps/game/
  autoload/            chain.gd, mock_chain.gd, game_state.gd, audio.gd, dialogue.gd
  scenes/
    main/              main.tscn (world + player + hud)
    world/             bank_main_wing.tscn, bank_arc_wing.tscn, zones/*.tscn
    npcs/              npc_base.tscn + one scene per NPC
    ui/                hud.tscn, dialogue_box.tscn, board_*.tscn, receipt.tscn, passbook.tscn
    props/             counter, vault_door, split_flap, ticket_printer, …
  scripts/             one .gd per scene, snake_case, class_name PascalCase
  dialogue/            *.json (Dialogic-free, our own minimal format: nodes, choices, conditions on GameState)
  assets/              models/ (glb), textures/, audio/, fonts/
  export/              shell.html
```

- Static typing everywhere (`var x: int`); `@export` for tunables; signals over polling between nodes.
- NPC interaction: `Area3D` trigger → prompt → `Space` (U7 polish; was `E`) → `Dialogue.start(npc_id)`; dialogue conditions read `GameState` (which mirrors bridge results), never call the bridge directly.
- Camera switch to "counter cam" via `Phantom Camera`-style priority (`Camera3D` per counter, tweened).
- All player-visible strings in `dialogue/*.json` or `ui/strings.json` (no literals in code) so everyday bank wording can be reviewed in one place.
- Performance budget in [WORLD-3D-ENVIRONMENT.md](./WORLD-3D-ENVIRONMENT.md) § 6; run the web build every evening.

---

## 7. Local dev loop

```bash
# terminal 1 — Teller Desk
npm -w apps/teller-desk run dev          # :8787
# terminal 2 — web shell (proxies /api to :8787)
npm -w apps/web run dev                  # :5173 serving /game from last export
# terminal 3 — godot editor for gameplay iteration (uses MockChain)
godot --path apps/game
# export when integration matters
npm run export:web
```

`apps/web` `vite.config.ts` sets `server.headers` **without** COOP/COEP and proxies `/api` to the Teller Desk.

---

## 8. Known Godot-web pitfalls

| Pitfall | Handling |
|---------|----------|
| Safari/iOS WebGL2 quirks | Out of scope; target Chrome/Edge/Firefox desktop for judging |
| `.pck` size > 30 MB slows first load | Keep textures ≤ 1024², `glb` with Draco off (Godot lacks decoder) but meshes low-poly; target ≤ 25 MB total |
| Audio autoplay blocked | Start music on first click (the "Enter branch" button) |
| `JavaScriptBridge.eval` string escaping | Never use `eval`; only `get_interface` + JSON |
| Text input focus stolen by canvas | The React overlay handles text entry (names, amounts); Godot receives the result via a bridge call |
| Keyboard dead after clicking the overlay / closing Privy | Godot listens on the canvas; see §5b — no full-viewport hit targets over `#game`, `focusCanvas()` after overlay interactions |
| `tsx watch` does not respawn a *killed* Teller Desk | It waits for a file change. To drill a restart use Ctrl+C + `npm run dev:teller` (or save a source file); a second `npm run dev:teller` in another terminal crashes on `EADDRINUSE` and then races the first on every save |
