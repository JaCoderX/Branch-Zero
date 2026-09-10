---
title: Kickoff prompt — iNPC phone HUD (awake companion screen)
created: 2026-09-10
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-inpc-phone-hud.md
---

# Kickoff prompt — iNPC phone HUD

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** when the service assistant is **awake**, show a compact **phone-like HUD** with its message transcript so the player can keep walking. Talk / Sleep from the phone; full chat panel remains the place to type.

**Why:** Today chat only lives in the modal overlay. Principal wants ambient messages while exploring — **radio only**. No follow. No action-triggered tips.

**Baseline:** iNPC OpenRouter **met** ([`HANDOFF-inpc-openrouter.md`](./HANDOFF-inpc-openrouter.md) · [`docs/INPC.md`](../INPC.md)). Session key + transcript already in `apps/web/src/inpc/session.ts`.

**Handoff:** [`HANDOFF-inpc-phone-hud.md`](./HANDOFF-inpc-phone-hud.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Full `Inpc.tsx` locks the floor | Phone must **not** set `overlay_open` / `inpc_open` alone |
| Transcript already in sessionStorage | Reuse `getTranscript` / `subscribe` — one store |
| Ops float sits bottom-left | Phone → bottom-right (or clear of meter); never top third |
| Companion follow is parked | Do not build Follow / Stay / NavigationAgent |
| Desk-debug is not player-safe | Do not feed bridge traffic into the phone |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — iNPC phone HUD (awake only).
(1) When the player's OpenRouter session key is present (assistant awake), show a compact phone-like HUD in the Vite shell with the existing chat transcript.
(2) Affordance: Talk → existing full Inpc panel; Sleep → existing wipe + sleepInpc / inpc.closed awake:false.
(3) Phone alone must NOT lock the floor or steal canvas focus; walking and desks stay free.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-inpc-phone-hud.md
2. docs/missions/KICKOFF-inpc-phone-hud.md
3. docs/INPC.md (locks + as-built)
4. apps/web/src/overlay/Inpc.tsx · apps/web/src/inpc/session.ts · apps/web/src/overlay/App.tsx (setInpcHost)
5. apps/web/src/overlay/BranchFloat.tsx (ambient chrome precedent — different feature)
6. Skim: docs/GODOT.md §5b focus; docs/missions/HANDOFF-inpc-openrouter.md (do not reopen OpenRouter locks)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Codex Luna. Product repo only (Branch-Zero). No GameLab ENG-*. No protocol Solidity.
- Scope = phone HUD only. Forbidden: companion follow / Stay / nav; action tips from debug/bridge; unsolicited OpenRouter; Ollama; game-knowledge edits; snapshot whitelist changes.
- Awake only (hasKey / inpc_awake). Sleep wipes key + transcript; phone unmounts.
- One transcript store: apps/web/src/inpc/session.ts.
- Phone ≠ overlay lock. Full Inpc panel keeps current lock / focusCanvas / Esc behaviour.
- Hide phone while full panel is open (recommended).
- Placement: bottom/corner band — not top third; don't fight the ops-float meter.
- Bank words on chrome. OpenRouter only in full Wake / Ask-why copy.
- Never commit secrets. Local progress under docs/progress/ (gitignored).

SEQUENCE:
1. Inventory — when App knows awake after panel close; how sleepInpc is invoked from React today.
2. Build InpcPhone (or equivalent) + mount from App when awake && !fullPanel.
3. Wire Talk → open host; Sleep → wipe + close awake false; subscribe to transcript.
4. Smoke — ?mock=account: Wake → Esc keep key → phone up, walk free → Talk → type → Esc → phone → Sleep → gone.
5. Close — mark HANDOFF met/blocked; tick OWED; one line on docs/INPC.md as-built.

DoD = HANDOFF-inpc-phone-hud Verification checklist + OWED tick + handoff status met.
Stop when met / blocked.
```
