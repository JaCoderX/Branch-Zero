---
title: Kickoff prompt — iNPC phone Talk dead
created: 2026-09-10
product: Branch-Zero
model: Claude Code · Opus / Fable high (or Codex Luna)
handoff: docs/missions/HANDOFF-inpc-phone-talk.md
---

# Kickoff prompt — iNPC phone Talk dead

Paste into a **new** Claude Code or Codex session. Prefer **Claude Code (Opus / Fable high)** for browser smoke; **Codex Luna** OK.

**What this is:** bugfix — phone HUD **Talk** button does not open the full service-assistant panel (principal: “not responding”).

**Why:** Live mirror sync correctly routed Talk through Godot (`inpc.open` → `open_inpc`), but Talk is now dead in the shell. Do not revert the sync contract; restore a working click → panel open.

**Baseline:** Phone HUD **met** + mirror sync — [`HANDOFF-inpc-phone-hud.md`](./HANDOFF-inpc-phone-hud.md) · [`docs/INPC.md`](../INPC.md) § Live mirror sync.

**Handoff:** [`HANDOFF-inpc-phone-talk.md`](./HANDOFF-inpc-phone-talk.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Talk must refresh GameState board | Keep `requestInpcOpen` / `inpc.open` — no cached-shell-snapshot reopen |
| `onPointerDown` + `preventDefault` on Talk | Classic way to kill the following `click` — check first |
| Waiter resolves only on `openInpc` | Soft Godot failure → 30s hang feels like “dead” |
| BranchFloat buttons use plain `onClick` | Prefer that pattern for activation; focusCanvas after if needed |
| Phone is ambient | Must not lock the floor; full panel still locks |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.
Model: Claude Code (Opus / Fable high) preferred; Codex Luna OK.

MISSION: Branch Zero — iNPC phone Talk button dead.
(1) Diagnose why phone Talk does not open the full Inpc panel (principal report).
(2) Fix so Talk opens the panel with a fresh GameState.inpc_snapshot() via Godot (keep inpc.open → open_inpc; do NOT go back to openInpc with a cached shell snapshot alone).
(3) Honest failure UI if Godot refuses/times out (no silent 30s hang). Sleep + walk-free phone must still work.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-inpc-phone-talk.md
2. docs/missions/KICKOFF-inpc-phone-talk.md
3. docs/INPC.md (§ Live mirror sync + Phone HUD as-built)
4. apps/web/src/overlay/InpcPhone.tsx
5. apps/web/src/bridge/branchZero.ts — requestInpcOpen / openInpc / pendingInpcOpen
6. apps/game/autoload/game_state.gd — inpc.open / _on_inpc_open_request / open_inpc
7. Skim: docs/GODOT.md §5b focus; apps/web/src/overlay/BranchFloat.tsx button pattern

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Product repo only (Branch-Zero). No GameLab ENG-*. No protocol Solidity.
- Scope = phone Talk (and Sleep if same root cause). Forbidden: companion follow; Ollama; game-knowledge / whitelist edits; feeding desk-debug to the robot; new mesh.
- Keep Talk → Godot fresh snapshot + inpc_open. Do not regress Ask inpc.freshen or run_inpc_walk.
- Phone alone ≠ overlay lock. Full panel keeps Esc / focusCanvas.
- Never commit secrets. Local progress under docs/progress/ (gitignored) OK.
- Do not commit unless principal asks.

SEQUENCE:
1. Reproduce — ?mock=account: Wake → Esc keep key → phone visible → Talk. Watch desk-debug bridge log for inpc.open / openInpc. Note busy/disabled state.
2. Test hypothesis #1 first: remove or replace preventDefault-on-pointerdown so click/pointerup still activates Talk without stealing the bank’s keyboard forever.
3. If click fires but panel missing: trace requestInpcOpen → Godot → openInpc; harden timeout/error path.
4. Smoke — Talk opens panel; type; Esc → phone back; Sleep → gone; walk free on phone alone.
5. run_inpc_walk (or note blocked); typecheck apps/web; mark HANDOFF met; tick OWED; one line on INPC.md if root cause worth recording.

DoD = HANDOFF-inpc-phone-talk Verification checklist + OWED tick + handoff status met.
Stop when met / blocked.
```
