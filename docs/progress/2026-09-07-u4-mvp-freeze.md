---
date: 2026-09-07
unit: U4 MVP freeze
gate: G5
result: met — canvas re-focus fixed and verified; dead-desk / bad-token / half-provisioned refusals have NPC lines; SSE reconnects with `desk.link`; first load measured; the principal's real-bridge walk is on chain with hashes. Owed by a human: the 30 s clip of the real door clock with the tab visible (a mock clip stands in)
agent: Claude Code (Fable 5.1), cold session
---

# 2026-09-07 — U4 MVP freeze

Nothing new on the chain, nothing new in the bank's shape. U4 made what exists survive a judge's laptop: a lost
keyboard, a dead or restarting Teller Desk, an expired token, a half-finished account opening. Bridge is `u4.0` with
**no new methods** — one new event (`desk.link`) and focus handed back to the canvas after the Privy modals.

## The playtest bug, and why it happened

**Symptom (2026-09-07 playtest):** after clicking the React debug overlay or finishing the Privy modal, WASD and `E`
were dead until a reload. Clicking the bank did nothing.

**Cause:** Godot's web export binds `keydown` / `keyup` to the **canvas element**, not to `document`, so the game only
hears keys while `#canvas` is `document.activeElement`. Godot does re-focus the canvas on its own `mousedown` — but
the shell's `#boot` status div (`position: fixed; inset: 0`) was left in the DOM after loading, with the default
`pointer-events: auto`. `document.elementFromPoint(centre)` was `DIV#boot`, not the canvas: every click on the bank hit
an invisible div, Godot never saw the mousedown, focus stayed on `<body>`. The `#overlay > * { pointer-events: auto }`
rule that HANDOFF suspected was innocent — the pill and panel are small.

**Fix** (`apps/web/index.html`, `src/main.ts`, `src/shell/focus.ts`, `src/bridge/branchZero.ts`, `src/overlay/App.tsx`):

- `#boot` is `pointer-events: none` always and `hidden` once the engine reports running.
- `focusCanvas()` after the interactions the shell owns: the debug panel's *hide*, and the bridge's `login` /
  `addSessionSigner` once the Privy flow settles. It focuses now and again on two timers — **not**
  `requestAnimationFrame`, which a background tab never runs — because React unmounts the clicked button in the same
  commit and an unmounted focused element drops focus to `<body>`.
- A `pointerdown` on `#game` also focuses the canvas (belt and braces; Godot's handler does it too).

**Verified in the shell (real bridge, no `?mock`):**

| Step | `document.activeElement` | Godot |
|------|--------------------------|-------|
| page loaded, engine running | `CANVAS#canvas`; `elementFromPoint(centre)` = `CANVAS#canvas` (was `DIV#boot`) | — |
| click the *desk debug* pill | `BODY` (the pill unmounts as the panel opens) | keys dead — the pre-fix state |
| click the bank | `CANVAS#canvas` | — |
| click *hide* on the panel | `CANVAS#canvas` | — |
| `F6` | — | teleport to the lobby, prompt "[E] Talk to Mo" |
| `E` | — | Mo's dialogue opens |

Rule kept in [GODOT.md §5b](../GODOT.md): nothing covers the canvas as a hit target unless it is meant to be clicked.

## Error UX

Provoked without a signed-in player, at the layers a session is not needed for:

| Case | Before | After | How verified |
|------|--------|-------|--------------|
| Teller Desk dead behind the Vite proxy | proxy answers 500 with an empty body → `res.json()` throws → `INTERNAL` ("Something went wrong behind the counter") | `RPC` — "The branch can't reach the ledger right now." | killed the desk child; `window.BranchZero.call('getPassbook')` three times over 8.6 s → `{code:'RPC', status:500, message:'Teller Desk unreachable (500 from /status)'}` |
| Expired / malformed Privy token | Privy's verify error had no status → 500 `INTERNAL` ("Failed to verify authentication token") | 401 `AUTH` — Ines's "I'll need you signed in for that" | `getPassbook` with no session → 500 INTERNAL observed before the fix; `identify()` now wraps `verifyAccessToken` |
| Account on file, provisioning never recorded its end (`configured` / `roleSet` missing — the playtest's `NoPermission` on Wire) | the chain refused `executeWithTimeLock` with `NoPermission` | `/pay` and `/wire` refuse **409 `NOT_CONFIGURED`** before touching the chain; line: "Your account is on file, but the desks aren't authorised for it yet — ask Ines to re-check your account." Ines's *Re-check my account* runs the reconciling provisioner | `requireConfigured()` in `server.ts`; all three players in `.data/players.json` are `configured:true, roleSet:2`, so the live desk is unaffected |
| `TIMEOUT` (raised by `Chain.gd` when the bridge never answers) | line existed | unchanged — "The desk is taking longer than usual — the board will catch up when it answers." | `run_checks.gd` |

`apps/game/dialogue/errors.json` has 86 entries; `godot --headless --path apps/game -s tests/run_checks.gd` → **PASS — 0 failures**.
The two in-game renderings that need a signed-in player on the real bridge (`RPC` / `TIMEOUT` toasts while a wire is
pending) are on the human walk list below — the code path is the same `error_line()` that already rendered
`LOGIN_CANCELLED` in U3.

Copy fix carried from U3: "The manager are opening the vault…" → "The manager is opening the vault…" / "You are opening
the vault…" (`laneB.ts`, `mock_chain.gd`); seen in-game during the mock walk.

## Reconnect

**What was broken:** the overlay's `EventSource` did `es.onerror = () => es.close()`. A Teller Desk restart, a dropped
connection or an expired token ended the stage feed for good until the page was reloaded — the door clock kept
running (it is wall time against `releaseTime`) but no `released` / `mined` stage would ever arrive.

**Fix:** `apps/web/src/shell/deskEvents.ts` — one reconnecting stream. On any error it closes, waits (2 s doubling to
30 s), asks for a **fresh URL** (fresh Privy access token) and reopens. Every transition is pushed into the bridge as
`desk.link {connected, attempt, reason}`; `GameState._on_desk_link` toasts `desk_link_lost` / `desk_link_back` and
calls `reconcile_pending("desk reconnect")`, because `/events` re-reads the vault and re-arms the per-record watchers
on every connect (U2 behaviour, unchanged). The debug panel shows "desk link down (refused) — reconnecting, attempt n".

**Measured** (module imported into the running shell, desk killed and restarted underneath it): 19 attempts, spacing
`2, 4, 8, 16, 30, 30, 30 …` seconds; `reason: 'refused'` for a 401 / proxy 500. A successful reopen needs a signed-in
player's token — that transition (`connected:true, attempt>0` → toast + reconcile) is on the human walk list.

**Server side:** receipts (the ledger board's right column) now persist to `.data/receipts.json`, so a restart
mid-wire no longer blanks the board. The player index is written **synchronously** with an atomic rename — the U2
50 ms debounce is how the playtest player lost `configured` / `roleSet` (`tsx watch` restarted the desk inside it).

**Finding — `tsx watch` does not respawn a killed child.** It waits for a file change. Killing the desk process left
port 8787 empty until a source file was saved; the "restart mid-wire" drill must be Ctrl+C + `npm run dev:teller` (or a
save). Three `tsx watch` instances from earlier sessions were alive on the dev box; whichever child binds first after a
save owns the port, the others crash on `EADDRINUSE` and wait. Close stale terminals before a demo.

## Human walk on the real bridge — what is on chain

The principal's 2026-09-07 playtest (owner `0x7954…c26B`, account `0x9C01e49A3511402AE7E7229660dAF7de3Ed75Cb9`), read
back with `npm -w apps/teller-desk run evidence` (new script, reads only):

| Block | UTC | Hash | Call | Record |
|-------|-----|------|------|--------|
| 61 | 18:08:32 | `0xecc36866…` | `guardConfigBatchRequestAndApprove` (broadcaster) | #1 COMPLETED |
| 62 | 18:08:36 | `0xd6df438d…` | `roleConfigBatchRequestAndApprove` | #2 COMPLETED |
| 63 | 18:08:37 | `0x91d890c8…` | dUSDC `transfer` (opening balance) | — |
| 64 | 18:15:49 | `0xff0a9053…` | `requestAndApproveExecution` — **pay 12.5** to the florist | #3 COMPLETED |
| 90 | 21:00:28 | `0x96a2290a…` | `requestAndApproveExecution` — **pay 12.5** to `0x28a8…535E` | #4 COMPLETED |
| 93 | 21:24:47 | `0x06cd4baa…` | `roleConfigBatchRequestAndApprove` — the **Re-check** that synced roles | #5 COMPLETED |
| 94 | 21:24:52 | `0x2ad2f54c…` | owner gas top-up 0.05 ETH | — |
| 96 | 21:25:29 | `0x6f94c24f59bd611ea72efe6e4c14580c2717337597c59cdc1300f224a4c545fc` | **wire** `executeWithTimeLock` 112.5 dUSDC (owner tx via session signer) | #6 PENDING, `releaseTime` 1788730049 (21:27:29) |
| 99 | 21:28:06 | `0x5b4be60028815ff20e1c05e28a1c0e192697530b5ab8ce922eb7451557b88edf` | `approveTimeLockExecution` by the **Branch Manager** (`0xE11B…882d`) — 37 s after release | #6 COMPLETED |

Balance now 362.5 dUSDC. The sign-in at Ines was the one modal (Privy email OTP); every later step was signed by the
session signer — pay #3/#4 as meta-transactions from the broadcaster, wire #6 as the owner's own transaction (V6), the
release by the manager's runtime role (LaneB-4 shape). Times are UTC; the playtest was the evening of 2026-09-07 local.

**Still owed by a human (needs an inbox and a visible tab), ~10 minutes:**

1. `npm run dev:teller`, `npm run dev:web`, open `http://localhost:5173/` (no `?mock`).
2. Ines: *Sign in* (the one modal) → consent → *Re-check my account*. Confirm **no second modal** at any later step.
3. Counter 1: pay 12.5 (Lane A) → receipt. Then 250 → *OK* → Dev walks you to the vault.
4. Watch the door clock count down from the chain's `releaseTime` (2:00) — **record the screen for 30 s** here
   (Win+G Game Bar or OBS), tab visible. At `OPEN`, Ruth: *Release #n*. Door bolts back.
5. Kill drill while a second wire is cooling: Ctrl+C the desk → HUD toast "Lost the branch for a moment — reconnecting…",
   the clock keeps counting; `npm run dev:teller` → toast "Back in touch with the branch. Board re-read from the vault."
   Talk to Ruth while the desk is down → "The branch can't reach the ledger right now."
6. `npm -w apps/teller-desk run evidence` → paste the new rows here.

## First load

Measured on the release export (`npm run export:web`, `--export-release`, `variant/thread_support=false`) and the
production shell (`npm run build:web`):

| Asset | Raw | gzip -9 | brotli | at 50 Mbps (raw / br) |
|-------|-----|---------|--------|-----------------------|
| `game/index.wasm` | **36.29 MB** | 8.91 MB | **7.05 MB** | 6.1 s / 1.2 s |
| `game/index.pck` | 0.12 MB | 0.09 MB | 0.09 MB | — |
| `game/index.js` | 0.29 MB | 0.07 MB | 0.07 MB | — |
| shell entry `assets/index-*.js` (React + Privy + viem + SDK) | 2.60 MB | 0.75 MB | 0.53 MB | 0.4 s / 0.1 s |
| shell, all 248 chunks (Privy screens, code-split, loaded on demand) | 5.13 MB | 1.62 MB | 1.29 MB | — |

Against [WORLD-3D §6](../WORLD-3D-ENVIRONMENT.md): export size budget "≤ 60 MB `.pck` + ~40 MB wasm" — met with room
(`.pck` is 0.12 MB because the greybox is code-built). Startup budget "≤ 8 s on 50 Mbps" — met only if the host
compresses `application/wasm` (Cloudflare Pages and Vercel do; **VERIFY** on the chosen host before the video):
~8 MB over the wire → ~1.5 s transfer, then the wasm compile. Compile + Godot boot on this laptop under heavy load was
the dominant cost (the console's `GameState: booted — bridge ready after N ms` is the number to watch; it read 74 s
once while the CPU was pegged by other work, and ~7 s when idle in U3). Obvious wins taken: release template confirmed,
`.pck` tiny, no debug export. Not taken: a pre-compression plugin (new dependency; the host does it for free — if it
does not, `scripts/export-web.mjs` can write `.br` beside the files with Node's zlib, no dependency).

## 30-second capture

`docs/progress/captures/2026-09-07-u4-vault-clock-mock.gif` — **MockChain stand-in, labelled on every frame**
(`?mock=account`, 30 s cooling; 16 frames, 1.5 s each, 556 KB): Dev filing the 250 dUSDC wire with the HUD reading
"1 in the vault · next release 0:2x"; the vault door with its clock at `0:1x` and `0:09` while Ruth's early "Try to
release #1" is refused-in-progress ("You are opening the vault…" → the clock runs out first); the door at `OPEN`, LED
green, "Wire released: 250 dUSDC sent"; then "Wire #1 released — the bolts are back and the money is on its way".

How it was made, because the obvious way did not work: the agent's Browser pane never composites — a hidden pane is a
stopped Godot (U3 finding) — so every frame was forced by a screenshot tick, one key per tick, and the frames were read
off the WebGL canvas with `canvas.toDataURL` and **POSTed to a loopback receiver** (`node`, port 5199) rather than
returned through the tool output (retyped base64 did not survive). The mock's own fake latency (wire stages plus the
session/passbook refresh after every action) costs ~25 rendered frames before Dev's dialogue lets the player leave the
counter, which is most of the 30 s cooling — hence the countdown is seen at `0:1x`/`0:09`, not from `0:30`.

**This is a stand-in, not evidence.** The real clip — the 2:00 clock from the chain's `releaseTime` on the door, the
bolts and the swing, tab visible, Win+G — is item 4 of the human walk above and should replace this file.

## What ran

| Step | Command / action | Result |
|------|------------------|--------|
| Typecheck | `npm run typecheck` | all four workspaces clean |
| Godot checks | `godot --headless --path apps/game -s tests/run_checks.gd` | **PASS — 0 failure(s)**, 86 error lines |
| Export | `npm run export:web` | `index.pck` 127 KB, `index.wasm` 37,156 KB, `index.js` 298 KB |
| Shell build | `npm run build:web` | `dist/` 248 chunks, 5.13 MB raw / 1.29 MB brotli |
| Desk | `GET /healthz` | `ok:true, unit:U2`, Remote EVM block 101 |
| Evidence | `npm -w apps/teller-desk run evidence` | the table above (all three players) |
| Focus | shell at `http://localhost:5173/`, DOM probes + `F6` / `E` | table in "The playtest bug" |
| Dead desk | kill the desk child; bridge `getPassbook` ×3 | `RPC` each time; reconnect loop backoff 2/4/8/16/30 s |
| Mock walk | `?mock=account` (shell on `:5174` — a parallel GameLab Vite held `:5173`): F3 → Dev → slip 250 → OK → F4 → Ruth → Release | stage line "You are opening the vault…"; door `0:1x` → `0:09` → `OPEN`; 31 frames captured, 16 in the GIF |

## Not done / carried forward

- **Real-bridge 30 s clip and the in-game `RPC` / `desk.link` toasts** — need a signed-in player; walk list above.
- The desk child that owns `:8787` now belongs to a `tsx watch` started 2026-09-06 20:17 (a stale terminal), not the
  00:14 one. Same code, but close the stale terminals before the demo.
- `chainNow` still rides in every stage event and is still unused for the clock (REMOTE-EVM §1a) — correct, keep.
- The mock does not check balances (a 25 012 dUSDC wire went through and left the mock passbook at −24 512). Cosmetic;
  MockChain proves nothing and says so on screen.
- Express dual-control / Privy step-up: nothing built here; GameLab ENG-0010 / ENG-0011 decide (U6+ at the earliest).

## Code pointers

- `apps/web/index.html`, `apps/web/src/main.ts`, `apps/web/src/shell/focus.ts` — the canvas-focus fix
- `apps/web/src/shell/deskEvents.ts` — reconnecting stream; `apps/web/src/bridge/branchZero.ts` — `pushLink`, `u4.0`
- `apps/web/src/overlay/useBranchZeroWallet.ts` — non-JSON 5xx → `RPC`
- `apps/teller-desk/src/server.ts` — `requireConfigured` (`NOT_CONFIGURED`); `src/privy.ts` — token errors → 401 `AUTH`
- `apps/teller-desk/src/store.ts` — synchronous atomic player index, persisted receipts
- `apps/teller-desk/scripts/vault-evidence.ts` — `npm -w apps/teller-desk run evidence`
- `apps/game/autoload/game_state.gd` — `_on_desk_link`; `scripts/hud.gd` — toast colour by kind; `dialogue/strings.json`, `dialogue/errors.json`
