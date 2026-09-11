---
title: Kickoff prompt — Ops float credit meter (HUD polish)
created: 2026-09-10
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-ops-float-credit-hud.md
---

# Kickoff prompt — Ops float credit meter

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** HUD polish on the met **Help keep the branch open** unit — replace the long bottom slogan button with a **compact Live ops-ETH credit meter** next to the passbook (icon + amount / LOW). Click opens the **same** `BranchFloat` popup.

**Why:** The long bottom CTA crowds the passbook/prompt band. Principal wants a small credit box (fuel/pump indicator OK) that shows bank ops ETH and invites funding via the existing popup — without putting chrome in the top third.

**Baseline:** Prior unit met (`HANDOFF-help-keep-branch-open`). `hud.gd` still has the wide bottom button. Soft-gate + bridge + `BranchFloat.tsx` stay.

**Handoff:** [`HANDOFF-ops-float-credit-hud.md`](./HANDOFF-ops-float-credit-hud.md) · prior [`HANDOFF-help-keep-branch-open.md`](./HANDOFF-help-keep-branch-open.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| U7 Stage 5: nothing persistent in top third | Meter goes **bottom-left with passbook**, not top-left |
| Long button text is the problem | Compact icon + ETH / LOW |
| Popup + soft-gate already work | Reuse `open_branch_float`; do not rebuild funding |
| Ops ETH ≠ practice dollars | Meter reads `treasury_status.eth`; passbook unchanged |
| “Gas station” banned as label | Pump **icon** OK; title stays Help keep the branch open |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — ops float credit meter (HUD polish).
(1) Remove the long bottom-band "Help keep the branch open" button in apps/game/scripts/hud.gd.
(2) Add a compact Live-only clickable meter with the passbook (bottom-left): small fuel/pump-style indicator + ops ETH amount from GameState treasury_status (or LOW when treasuryShort); urgent style when short.
(3) Click → existing GameState.open_branch_float("hud") → same React BranchFloat popup (address, Copy, Google Sepolia faucet, title "Help keep the branch open").
Do not put persistent HUD chrome in the top third / top-left. Do not change soft-gate, /healthz, or top-up writers.

Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-ops-float-credit-hud.md
2. docs/missions/KICKOFF-ops-float-credit-hud.md
3. docs/missions/HANDOFF-help-keep-branch-open.md (baseline — met)
4. apps/game/scripts/hud.gd (passbook + _branch_float + "Nothing persistent sits in the top third")
5. apps/game/autoload/game_state.gd (treasury_status, treasury_short, branch_float_available, open_branch_float)
6. apps/web/src/overlay/BranchFloat.tsx (leave behaviour; optional micro-copy only)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Codex Luna. Product repo only (Branch-Zero). No GameLab ENG-*. No protocol Solidity.
- Placement: bottom-left with passbook ONLY. Forbidden: top-left / top-third persistent chrome.
- Compact meter — not a long slogan button. Icon OK; do not label the chip "gas station" or "Treasury Desk".
- Show bank ops Sepolia ETH from the existing player-safe treasury slice — never imply it is the player's wallet or practice dollars.
- Same popup path only. No second modal. No new bridge spend methods.
- Live only: hide when not branch_float_available(); Dev/mock stay dark.
- Preserve soft write-gate, Esc / focusCanvas, desk-debug treasury row, restore toast.
- Do not start iNPC, Ash rewrite, U7 packaging, Arc, or walkable Treasury Desk.
- Never commit secrets. Local progress under docs/progress/ (gitignored).
- If hud.gd changes: note export:web required; run it if Godot 4.5.x is available.

SEQUENCE:
1. Inventory — current _branch_float layout vs passbook anchors; confirm eth field on treasury_status.
2. Replace — compact meter bottom-left; quiet + short styles; tooltip; click → open_branch_float.
3. Smoke — Live shows amount; short goes urgent; click opens BranchFloat; Dev/mock hidden; dialogue ui_locked still hides meter.
4. Close — mark HANDOFF met/blocked; tick OWED; note export:web.

DoD = HANDOFF-ops-float-credit-hud Verification checklist + OWED tick + handoff status met.
Stop when met / blocked.
```
