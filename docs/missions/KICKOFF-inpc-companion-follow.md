---
title: Kickoff prompt — iNPC companion follow (phone Follow / Unfollow)
created: 2026-09-10
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-inpc-companion-follow.md
---

# Kickoff prompt — iNPC companion follow

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** when Blox-47 is **awake**, add phone **Follow / Unfollow** so the Gum Bot mesh walks with the player (escort-lite seek). No floor lock. Sleep returns it home.

**Why:** Companion follow was parked through OpenRouter / phone / mesh lands. Principal unparked it. Phone toggle is the cheapest control; lobby Space-only Follow is worse UX.

**Baseline:** phone HUD + Talk + Gum Bot mesh **met** ([`docs/INPC.md`](../INPC.md)).

**Handoff:** [`HANDOFF-inpc-companion-follow.md`](./HANDOFF-inpc-companion-follow.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Phone already Talk/Sleep with no lock | Follow fits the same chrome; do not invent a second overlay |
| `InpcProp` is `BankTerminal` + `StaticBody3D` | Must promote to a moving body to walk |
| Teller escort seeks waypoints — no navmesh in tree | Copy seek / ignore-player / stuck limits — do **not** bake NavigationRegion |
| Gum Bot glb is rig-stripped | Slide locomotion is OK for v1 |
| Sleep wipes the session | Sleep must Unfollow + home |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — iNPC companion follow (phone Follow / Unfollow).
(1) While the service assistant is awake, add Follow / Unfollow on the existing phone HUD (InpcPhone).
(2) Godot: Blox-47 mesh trails the player with escort-lite seek (CharacterBody3D). Unfollow = Stay in place. Sleep = clear follow + return to lobby home + dormant.
(3) Follow alone must NOT lock the floor or set inpc_open. Keep Talk (inpc.open fresh board) and Sleep wipe working.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-inpc-companion-follow.md
2. docs/missions/KICKOFF-inpc-companion-follow.md
3. docs/INPC.md (locks + as-built + Live mirror sync)
4. apps/web/src/overlay/InpcPhone.tsx · apps/web/src/bridge/branchZero.ts (inpc.open / requestInpcOpen pattern)
5. apps/game/scripts/inpc.gd · apps/game/scripts/main.gd (INPC_SPOT)
6. apps/game/scripts/npc.gd — escort seek / collision exceptions only (do not absorb staff NPC)
7. apps/game/tests/run_inpc_walk.gd
8. Skim: docs/GODOT.md §5b focus; do not reopen OpenRouter locks

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Codex Luna. Product repo only (Branch-Zero). No GameLab ENG-* unless principal opens a walk-rig lab later. No protocol Solidity.
- Scope = companion follow Phase 1. Forbidden: action tips; Ollama; game-knowledge / snapshot whitelist edits; NavigationRegion bake; skinned walk re-export; staff NPCS.md row; U7 packaging.
- Phone is the primary Follow / Unfollow control. Awake only.
- No overlay lock from Follow. Phone Talk still uses inpc.open → Godot open_inpc (fresh snapshot).
- Unfollow = Stay. Sleep = Unfollow + home spot (3.5, 0, 4.5) yaw π + dormant look + existing key wipe.
- Escort-lite seek only — no navmesh requirement. Slide without walk anim is acceptable.
- Do not merge iNPC into npc.gd / staff dialogue graphs.
- Ordinary button clicks on the phone (no preventDefault that kills activation).
- Never commit secrets. Local progress under docs/progress/ (gitignored).

SEQUENCE:
1. Inventory — how InpcPhone fires Talk/Sleep; how GameState handles inpc.open / inpc.closed; InpcProp collider vs CharacterBody3D staff.
2. Bridge — inpc.follow / inpc.unfollow (or one event + bool); optional following bit on inpcStatus; GameState.inpc_following (name free).
3. Godot — promote InpcProp to move; FOLLOWING / STAYING / HOME; seek ~1.5–2 m from player; collision exception with player; stuck timeout.
4. Phone UI — Follow/Unfollow button + header state; keep Talk/Sleep.
5. Lifecycle — Sleep clears follow + home; dormant never follows.
6. Tests — extend run_inpc_walk (follow on, no lock, Sleep clears + home). Smoke ?mock=account: Wake → Esc → Follow → walk → Unfollow → Follow → Sleep → home/dormant.
7. Close — mark HANDOFF met/blocked; tick OWED §5; update docs/INPC.md as-built + lock; note HANDOFF-CC.

DoD = HANDOFF-inpc-companion-follow Verification checklist + OWED tick + handoff status met.
Stop when met / blocked.
```

---

## After

Principal: **walk-rig ENG opened** — [ENG-2026-0022](../../../GameLab/work/ENG-2026-0022-inpc-gum-bot-walk/) (`KICKOFF.md` for Codex Luna). Action tips stay parked.
