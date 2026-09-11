---
type: handoff
title: Handoff — Ops float credit meter (HUD polish)
audience: cold agent (Codex Luna)
created: 2026-09-10
product: Branch-Zero
mission: Replace the long bottom "Help keep the branch open" button with a compact Live ops-ETH credit chip by the passbook; same BranchFloat popup
kickoff: docs/missions/KICKOFF-ops-float-credit-hud.md
status: met 2026-09-10
baseline: Help keep the branch open MET 2026-09-10 (docs/missions/HANDOFF-help-keep-branch-open.md)
parallel_to: U7 packaging (gated) · do not absorb iNPC / Ash / packaging
---

# Handoff — Ops float credit meter

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna**.

**Kickoff (paste):** [`KICKOFF-ops-float-credit-hud.md`](./KICKOFF-ops-float-credit-hud.md)

**Prior unit (met):** [`HANDOFF-help-keep-branch-open.md`](./HANDOFF-help-keep-branch-open.md) — Live player-safe `/healthz` slice, React `BranchFloat` popup, soft write-gate on `treasuryShort`.

**Not this mission:** New funding system · changing `/healthz` / top-up writers · Bob / Terminal / Ash copy as fund path · walkable Treasury Desk · hard lobby lock · Iris practice faucet · iNPC · U7 packaging · Arc · protocol Solidity · putting persistent chrome in the **top third** of the HUD.

---

## Principal intent

The long bottom button **"Help keep the branch open"** is too loud on the passbook / prompt band. Evolve it into a **small ops credit meter** that:

1. Shows how much **Sepolia ETH** the bank ops float holds.
2. Uses a small fuel / pump-style indicator (icon OK — not the words “gas station”).
3. On click, opens the **same** `BranchFloat` popup (address · Copy · faucet · Help keep the branch open).
4. Goes urgent when `treasuryShort`.

Keep all bridge / soft-gate / popup behaviour from the prior unit.

---

## Design lock (non-negotiable)

| Lock | Implication |
|------|-------------|
| **Bottom band only** | Place the meter **with the passbook** (bottom-left: above, beside, or tucked into the passbook card). U7 Stage 5: **nothing persistent in the top third** (ledger / frieze / vault repeater). Do **not** use top-left. |
| **Compact, not a slogan button** | No full-width / long text button. Prefer icon + short ETH amount (e.g. `0.029`) or `LOW` when short. |
| **Same popup** | Click → existing `GameState.open_branch_float("hud")` / shell `BranchFloat`. Do not invent a second modal. |
| **Ops ≠ passbook** | Meter is bank ops ETH from `treasury_status.eth`. Practice dollars stay on the passbook. Tooltip must say ops / keep the branch open — not “your ETH”. |
| **Bank language** | Popup title stays **Help keep the branch open**. Avoid labelling the chip “gas station” / “Treasury Desk”. A small pump icon is fine. |
| **Live only** | Still hide on Dev / mock / unconfigured (reuse `branch_float_available()`). |
| **Do not regress** | Soft write-gate, Esc / `focusCanvas`, desk-debug row, player-safe slice, restore toast — unchanged. |

---

## What already exists (reuse)

| Piece | Where |
|-------|--------|
| Long bottom button to replace | `apps/game/scripts/hud.gd` (`_branch_float`) |
| `treasury_status` / `treasury_short()` / `branch_float_available()` / `open_branch_float` | `apps/game/autoload/game_state.gd` |
| Popup | `apps/web/src/overlay/BranchFloat.tsx` |
| Host / bridge | `App.tsx` · `branchZero.ts` (`treasuryStatus`, `openBranchFloat`) |

---

## What to build

### 1. Replace the long HUD button

- Remove (or stop using) the wide bottom-band text button at offsets ~476–760.
- Add a **compact clickable control** anchored with the passbook (bottom-left).
- Quiet Live: icon + formatted ops ETH from `GameState.treasury_status` / `branch_float_status()`.
- Short: amber/red treatment; text may become `LOW` or keep amount + urgent style.
- Tooltip: e.g. “Bank ops ETH — help keep the branch open” (ops gas, not passbook / practice dollars).
- `pressed` → `GameState.open_branch_float("hud")` (unchanged).
- Visibility: `not ui_locked and branch_float_available()` (same as today).

### 2. Leave shell alone unless needed

- `BranchFloat.tsx` copy/behaviour stays. Optional micro-polish only if the meter needs a matching subtitle — not required.
- No new bridge methods.

### 3. Docs / owed

- Tick the OWED row when met.
- One line on the prior help-keep handoff or SEPOLIA-TREASURY if useful: credit meter is the player HUD affordance.
- Note whether `export:web` is required (yes if `hud.gd` changes).

---

## Out of scope

- Top-left / top-third persistent HUD  
- Redesigning passbook content or zone chip  
- Changing soft-gate action lists or `/healthz` shape  
- New icons pack hunt if a Unicode / simple drawn Control is enough — prefer cheap over art pipeline  
- Ash / Bob dialogue funding beats  

---

## Verification checklist

- [x] Long bottom slogan button gone  
- [x] Compact meter bottom-left with passbook; **not** top-left / top third  
- [x] Shows ops ETH (or LOW) from Live treasury status  
- [x] Click opens existing BranchFloat (Copy + faucet + Help keep the branch open)  
- [x] Urgent style when `treasuryShort`  
- [x] Hidden on Dev / mock / unconfigured  
- [x] Soft write-gate + Esc / focusCanvas / desk-debug unchanged  
- [x] Tooltip / copy does not imply the amount is the player’s wallet  
- [x] OWED ticked; handoff status → met; note `export:web`  

**Verification note (2026-09-10):** `hud.gd` now renders a compact bottom-left ops-ETH meter above the passbook (`⛽ amount ETH`, or `⛽ LOW` when `treasuryShort`) and keeps the existing popup/visibility path. Bridge, React `BranchFloat`, `/healthz`, top-up writers, soft write-gate, dialogue priority, desk-debug row, restore toast, and canvas focus behavior were left unchanged. `npm run export:web` is required because `hud.gd` changed; Godot 4.5.x is unavailable in this environment, so the export/web walk remains the post-export check.

**STOP AND ASK if:** you believe top-left is required after all; you need a new asset pipeline for the icon; passbook layout forces overlapping dialogue choices.

---

## Agent choice

**Codex Luna** — pure HUD polish on a met funding surface. Not CC Fable.
