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
| `getBalances` | `{ chainId }` | `{ native, usdc }` | viem reads |
| `resolveName` | `{ name }` | `{ address, chainId, avatar? }` | ENS (Sepolia) |
| `pay` | `{ chainId, to, amount, memo }` | `{ txId, txHash }` | Teller `/pay` (Lane A) |
| `wire` | `{ to, amount, memo }` | `{ txId, releaseTime, chainNow, serverNow, hash, status }` | Teller `/wire` (Lane B request). **No `releaseSeconds`** — the cooling period is the account's own `timeLockPeriodSec`, fixed at `initialize`; the game cannot shorten it |
| `approve` / `cancel` | `{ txId, as?: "owner" or "manager" }` | `{ hash, txId, status, balanceAfter? }` | Teller `/approve` `/cancel` |
| `listPending` | — | `{ items: [{ txId, status, releaseTime, released, to, amount, requester }], serverNow }` | `getPendingTransactions` + `getTransaction` |
| `getHistory` | `{ chainId, limit }` | `{ items }` | Teller watcher cache |
| `ensAvailable` / `ensMint` / `ensSetText` | see [ENS.md](./ENS.md) | — | Teller `/ens/*` |
| `quote` / `swap` | see [UNISWAP.md](./UNISWAP.md) | — | S1 only |
| `switchWing` | `{ chainId }` | `{ ok }` | local state + Privy chain switch |

Events pushed to Godot (`type: "event"`): `tx.pending`, `tx.released`, `tx.executed`, `tx.cancelled`, `balance.changed`, `session.changed`.

Rules:
- Godot never sees private keys, session tokens or Privy IDs beyond `userId`.
- Every call has a timeout (15 s) and returns `{ error: { code, message } }` on failure; NPCs have a line for each `code` (see [NPCS.md](./NPCS.md) § 5).
- On desktop (editor) `MockChain.gd` implements the same API with fake latency and canned data so gameplay can be iterated offline.

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
- Audio: resume `AudioServer` on first input after focus (browser autoplay policy).

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
- NPC interaction: `Area3D` trigger → prompt → `E` → `Dialogue.start(npc_id)`; dialogue conditions read `GameState` (which mirrors bridge results), never call the bridge directly.
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
