---
type: handoff
title: Handoff — iNPC phone Talk dead (button not responding)
audience: cold agent (Claude Code or Codex Luna)
created: 2026-09-10
product: Branch-Zero
mission: Phone HUD Talk does nothing (or appears dead); restore open of full Inpc panel with fresh GameState board
kickoff: docs/missions/KICKOFF-inpc-phone-talk.md
status: met
baseline: iNPC phone HUD MET 2026-09-10 + Live mirror sync Talk path (inpc.open / inpc.freshen) — docs/INPC.md § Live mirror sync · HANDOFF-inpc-phone-hud.md
parallel_to: U7 packaging (gated) · do not absorb companion follow / Ollama / snapshot whitelist expansion
---

# Handoff — iNPC phone Talk dead

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Claude Code (Opus / Fable high)** for browser smoke; **Codex Luna** is fine if CC is unavailable.

**Kickoff (paste):** [`KICKOFF-inpc-phone-talk.md`](./KICKOFF-inpc-phone-talk.md)

**Baseline (met, but Talk regressed):** phone HUD + mirror sync — [`HANDOFF-inpc-phone-hud.md`](./HANDOFF-inpc-phone-hud.md) · [`docs/INPC.md`](../INPC.md) § Live mirror sync.

**Not this mission:** Companion follow · action tips · Ollama · teaching-pack / whitelist expansion · desk-debug → robot · new Godot mesh · U7 packaging · Ash rewrite · protocol Solidity · reopening OpenRouter locks.

---

## Principal report

After the Live mirror sync fix, **phone Talk does not respond** (no full chat panel, or click feels dead). Sleep may or may not work — verify both. Prop dialogue *Talk* / *Wake* path is **out of blame until proven**; focus the shell phone button first.

---

## Likely causes (check in order)

| # | Hypothesis | Where | Symptom |
|---|------------|--------|---------|
| 1 | **`preventDefault` on `pointerdown` kills `click`** | `InpcPhone.tsx` Talk/Sleep buttons: `onPointerDown={(e) => e.preventDefault()}` + `onClick={…}` | Click never fires; no bridge traffic; button looks inert |
| 2 | **Talk hangs on `requestInpcOpen` (30s)** | `branchZero.ts` `requestInpcOpen` → `inpc.open` → Godot `open_inpc`; waiter only resolves when `openInpc` mounts | Button goes `busy`/disabled; no panel until timeout; feels dead |
| 3 | **Godot never handles `inpc.open`** | Event reaches `Chain._on_js_message` but `GameState._on_chain_event` / `_on_inpc_open_request` fails or `run_action` busy | Desk debug shows `• inpc.open` (or not); no `→ openInpc` |
| 4 | **Panel opens then immediately closes / phone remount race** | `App.tsx` phone vs `inpc_` mount; `inpc.closed` misfire | Flash or no visible panel |

Do **not** revert the mirror-sync design (Talk must still go through Godot for a fresh `inpc_snapshot()` + `inpc_open`). Fix the dead control; keep the sync contract.

---

## Design lock (non-negotiable)

| Lock | Implication |
|------|-------------|
| **Talk → Godot** | Prefer `requestInpcOpen` / `inpc.open` → `open_inpc` (fresh board). Do **not** go back to `openInpc({ snapshot: cached })` as sole path. |
| **Phone ≠ floor lock** | Phone alone must not set `overlay_open` / steal canvas focus. Full panel locks as today. |
| **Canvas focus** | Keep Godot hearing keys while phone is ambient — but **do not** break button activation. If `preventDefault` on pointerdown was for focus, replace with a pattern that still fires Talk (e.g. `onPointerUp` / `onClick` without cancelling click, or focusCanvas after click). See `docs/GODOT.md` §5b and BranchFloat / desk-debug button patterns. |
| **Honest failure** | If Godot refuses / times out, show an error on the phone within a few seconds — not a silent 30s hang with no feedback. |
| **Do not regress** | Sleep, Esc, `run_inpc_walk`, Ask `inpc.freshen`, snapshot whitelist. |

---

## What already exists

| Piece | Path |
|-------|------|
| Phone UI | `apps/web/src/overlay/InpcPhone.tsx` |
| Talk request | `apps/web/src/bridge/branchZero.ts` — `requestInpcOpen`, `openInpc` resolves waiter |
| Godot handlers | `apps/game/autoload/game_state.gd` — `inpc.open` → `_on_inpc_open_request` → `run_action("open_inpc")` |
| Mount | `apps/web/src/overlay/App.tsx` — phone when `inpcAwake && !inpc_` |
| As-built | `docs/INPC.md` § Live mirror sync · Phone HUD row |

---

## Done when

- [x] Phone **Talk** opens the full Inpc panel within ~2–3s on `?mock=account` (and Live if easy)
- [x] Desk debug (or console) shows `inpc.open` then `→ openInpc` with a real snapshot
- [x] Panel header can show account board when GameState has an account (mirror sync still works)
- [x] Phone **Sleep** still wipes key + transcript; eye dormant
- [x] Walking remains free while only the phone is up (ambient phone owns no lock; Esc returned focus to the canvas)
- [ ] Headless `run_inpc_walk` still PASS (Godot unavailable; noted below)
- [x] `docs/INPC.md` / this handoff status → **met**; OWED ticked; root cause recorded below

## Verification — 2026-09-10

- [x] Browser mock smoke (`?mock=account&debug=1`): Wake → Esc → phone **Talk** opened the full panel.
- [x] Desk debug showed `inpc.open` → `openInpc` with a fresh snapshot (`500 USDC`, `test.branchzero.eth`, MockChain).
- [x] Full panel accepted typed input; Esc returned to the awake phone; Sleep removed the phone and emitted `awake:false`.
- [x] Web typecheck and production build passed.
- [ ] `run_inpc_walk`: Godot 4.5.x is unavailable on this workstation, so the headless walk remains unrun here.

Root cause was hypothesis (1): phone buttons cancelled `pointerdown` while depending on the following `click`. The bridge waiter now also reports host/callback failures promptly and times out in 8 seconds instead of leaving the phone busy for 30 seconds.

**STOP AND ASK if:** you believe Talk must bypass Godot again; you need a new bridge verb beyond events; focus contract forces an unworkable trade.

---

## Agent choice

**Claude Code** — shell click + Godot event smoke. **Codex Luna** alternate.
