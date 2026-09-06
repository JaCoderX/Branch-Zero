---
date: 2026-09-06
unit: U3 Bank shell
gate: G4
result: met — walkable greybox, five NPCs driving the desk through Chain.call_async, vault door clock from releaseTime, ledger board; human OTP walk still pending (same caveat class as U1/U2)
agent: Claude Code (Fable 5.1), cold session
---

# 2026-09-06 — U3 Bank shell

The bank is walkable and the desks are the operations. Nothing changed on the chain side: no lane semantics, no
role grants, no Privy policy shapes. The bridge went from `u2.0` to `u3.0` by adding two **reads** over routes that
already existed (`getSession` over `/session`, `getHistory` over `/status.receipts`) and by letting Teller Desk
error codes survive the fetch boundary so an NPC can pick its line by code.

## What was built

| Piece | Where | Note |
|-------|-------|------|
| Greybox — Entrance, Lobby, Account Opening, Counter 1 (+ Counter 2 dressing), Ledger board wall, Vault antechamber + door, Manager's glass office; Name Desk / Elevator / FX / Side door as signage | `apps/game/scripts/bank_interior.gd` | Built from boxes in code (WORLD-3D §2 floor plan, 30 × 22 m). Zones are `Area3D`s; the HUD chip names them |
| Player | `scripts/player.gd` | Third-person capsule, WASD relative to camera, ←/→ or drag to orbit, Shift to jog, no jump |
| NPCs — Mo, Ines, Dev, Ruth, Mr. Okafor | `scripts/npc.gd`, `scripts/main.gd` | IDLE / TALKING / WORKING / REFUSING / ESCORTING; Dev walks the player to the vault after a wire |
| Dialogue runner + JSON scripts | `autoload/dialogue.gd`, `dialogue/*.json` | NPCS.md §4 scripts, every action with an "Ask why"; `choices_from: pending` turns the vault register into choices |
| Desk state mirror | `autoload/game_state.gd` | `run_action` is the only path to `Chain.call_async`; refreshes session + passbook after every action (U1 lesson) |
| MockChain | `autoload/mock_chain.gd`, `?mock` / `?mock=account` | Canned desk for walking the greybox without an inbox; never a kill test |
| Vault door | `scripts/vault_door.gd` | LED off / red / green / amber, bolts, 30° swing; clock digits = `releaseTime − (localNow + offset)` |
| Ledger board | `scripts/ledger_board.gd` | SubViewport texture on the lobby wall: pending wires with release countdown, last receipts |
| Payment slip | `scripts/payment_slip.gd` | Presets (florist / landlord / demo merchant) or any address; ≤ limit → Lane A, above → Lane B via Dev |
| Error lines | `dialogue/errors.json` | 85 codes: every NPCS.md §5 row, every SDK `ERROR_SIGNATURES` name (63), every Teller Desk / bridge / Privy code |
| Headless checks | `tests/run_checks.gd` | JSON integrity, targets resolve, Ask-why present, error coverage, condition evaluator |

Bridge / shell (`apps/web`): `getSession` (never opens a modal), `getHistory`, `login` now **awaits** Privy
(`useLogin` `onComplete` / `onError`; a dismissed modal is `LOGIN_CANCELLED`, not a hang), `tab.visible` event,
`bridge.ready` carries the mock flag, the overlay collapses to a "desk debug" pill once the engine runs (`?debug`
keeps it open). `packages/shared`: `BridgeError.code` widened to carry desk and protocol codes; `DeskSession` type.

## What ran

| Step | Command / action | Result |
|------|------------------|--------|
| Desk up | `GET /healthz` | `{"ok":true,"unit":"U2",…,"timeLockSec":120,"manager":{…}}` (Remote EVM block 89) |
| Checks | `godot --headless --path apps/game -s tests/run_checks.gd` | **PASS — 0 failures**: 85 error lines, all 32 required + all 63 SDK names; 5 scripts (64 nodes, 20 action choices) resolve |
| Export | `npm run export:web` | `index.pck` 125 KB, `index.wasm` 37 MB unchanged; threads off; console: `single-threaded, no GDExtension support` |
| Shell | `http://localhost:5173/?mock=account` | `bridge.ready {"version":"u3.0","mock":"account"}`; `Chain: shell asked for MockChain` |
| Mock walk | Mo → Ines (sign in → consent → open account) → Dev (12.5 pay; 250 → vault; escort) → Ruth (release) → second wire → red clock `0:05` on the door → manager | Every node reached, every action returned through `run_action`; passbook, ledger board and door followed the events |
| Manager (mock) | F7 → Mr. Okafor → Recall → #1 | `approve` / `cancel` dispatched with `as: "manager"`; the shredder list is built from the pending register |
| Reconcile | synthetic `visibilitychange`; window focus | console: `GameState: reconciled 1 pending record(s) on tab.visible`, `… 0 … on window focus` |
| Real bridge | `http://localhost:5173/` (no mock) | see "Real bridge" below; boot: `bridge ready after 6583 ms, session after 38 ms (bridge u3.0)` |

### Real bridge (no `?mock`)

Godot's clerk asks `getSession` on boot — no modal — and the passbook reads "No account yet". Talking to Ines and
choosing **Sign in** dispatches `login` through the bridge; the Privy "Log in or sign up" modal is the one that
opens (over the running canvas, K8 still holds), and dismissing it comes back as `LOGIN_CANCELLED` with Ines's line
"No rush — come back when you are ready to sign in." and her refusing pose. The desk-debug traffic log for that run,
verbatim:

```text
• bridge.ready {"version":"u3.0","mock":false}
→ getSession {}
← 1-7411 {"loggedIn":false,"ready":true}
• tab.visible {"visible":true}
→ login {}
← 2-113552 LOGIN_CANCELLED: the sign-in was dismissed
→ getSession {}
← 3-132562 {"loggedIn":false,"ready":true}
```

Dev, Ruth and Mr. Okafor all take the `!has_account` branch and send you to Ines. Completing the OTP needs a human with an
inbox — the same constraint as U1 and U2. **Next human action:** sign in at Ines's desk, consent once, open the
account, pay the florist at Counter 1, wire 250 and watch the door clock count down from the chain's `releaseTime`,
release at the vault window, and confirm no second modal appears at any point.

## Findings worth keeping

1. **A hidden browser tab is a stopped Godot.** No `requestAnimationFrame` means no `_process`, no physics, no
   `SceneTreeTimer`. During this session the in-app pane was hidden, and `boot()` reported "session after 124 s"
   because that is how long the tab was hidden. The design rule in GODOT.md §5 (nothing gameplay-critical in
   Godot timers; SSE + reconcile on focus) is exactly right, and now it is written down why.
2. **Bind both `keycode` and `physical_keycode`.** Godot web maps `KeyboardEvent.code` to the physical key; browser
   automation (and some remote-desktop clients) send an empty `code`. A physical-only `interact` binding was dead
   under automation while a `keycode` binding worked. `GameState._bind` now adds both.
3. **`set_anchors_preset` keeps the current rect.** A root `Control` under a `CanvasLayer` created in code has size
   0; `set_anchors_preset(FULL_RECT)` compensates with negative offsets and stays 0 × 0, so everything anchored
   inside it collapses to the top-left. `set_anchors_and_offsets_preset` is the one that fills.
4. **Keep the desk's error code, not the fetch error.** The overlay's `call()` threw `new Error(json.error)`, which
   erased `code`; the bridge then classified every desk refusal as `INTERNAL`. Carrying `code` and `status` through
   is what lets NPCS.md §5 be a table instead of a regex.
5. **Enter submits the slip.** Tab moves DOM focus out of the canvas in a browser, so a form that needs Tab to reach
   its button is unusable without a mouse; `LineEdit.text_submitted` fixes that for humans and tests alike.

## Not done / carried forward

- **Human OTP walk of the greybox** (sign in → consent → open → pay → wire → release) — needs an inbox. The mock
  walk covers every node and the kill tests cover every lane; the join is the human's.
- Escort walk and NPC "animations" are pose changes on capsules; art is U7.
- The countdown proof video (30 s capture) was not recorded: the agent's pane was hidden, so frames only advanced
  under screenshots. The door clock did read `0:05 → 0:04` against the mock desk clock in those frames.
- `chainNow` is still carried in every stage event and still unused for the clock (REMOTE-EVM §1a).
- The Teller Desk's manager stage line reads "The manager are opening the vault…" (`laneB.ts` builds `${who} are`);
  the mock mirrors it. Lane code was out of scope for U3 — a one-word fix for U4's error-UX pass.
- `BeforeReleaseTime` was not provoked in the mock walk (its fake latency let the 30 s clock run out first); the line
  exists (`errors.json`, checked by `run_checks.gd`) and the real refusal is LaneB-1's on-chain revert.
- Bundle: shell 2.66 MB + `.pck` 125 KB + `.wasm` 37 MB — the U4 size check is unchanged.

## Code pointers

- `apps/game/autoload/chain.gd` — bridge wrapper, per-call timeouts, mock switch
- `apps/game/autoload/game_state.gd` — desk mirror, `run_action`, clock offset, focus reconcile, error lines
- `apps/game/autoload/dialogue.gd` — runner; `tests/run_checks.gd` validates the JSON it runs
- `apps/game/scripts/vault_door.gd`, `ledger_board.gd` — the two in-world data displays
- `apps/web/src/bridge/branchZero.ts` — `u3.0`; `apps/web/src/overlay/useBranchZeroWallet.ts` — `loginAndWait`, error codes
