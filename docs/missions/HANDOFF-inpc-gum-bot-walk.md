---
type: handoff
title: Handoff — iNPC Gum Bot skinned walk land
audience: cold agent (Codex Luna preferred · Claude Code OK)
created: 2026-09-11
product: Branch-Zero
mission: Replace rest-pose gum_bot_bank.glb with lab skinned walk glb; drive idle/walk from InpcProp._walking
kickoff: docs/missions/KICKOFF-inpc-gum-bot-walk.md
status: met — landed 2026-09-11; lab Yes ENG-2026-0022
lab: GameLab ENG-2026-0022 Yes (handed-off proposal)
parallel_to: U7 packaging · do not absorb OpenRouter / phone / FX / cast WIP
---

# Handoff — iNPC Gum Bot skinned walk land

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna** (Godot mesh / AnimationPlayer). Claude Code OK if Luna unavailable.

**Kickoff (paste):** [`KICKOFF-inpc-gum-bot-walk.md`](./KICKOFF-inpc-gum-bot-walk.md)

**Design index:** [`docs/INPC.md`](../INPC.md) Companion follow + Visual · [`CREDITS.md`](../../CREDITS.md)

**Lab (read / copy ship set only — do not merge the ENG tree):**  
[`../../../GameLab/work/ENG-2026-0022-inpc-gum-bot-walk/handoff.md`](../../../GameLab/work/ENG-2026-0022-inpc-gum-bot-walk/handoff.md) ·  
[`findings.md`](../../../GameLab/work/ENG-2026-0022-inpc-gum-bot-walk/findings.md) ·  
ship: `out/gum_bot_bank_walk.glb` + `out/SHA256SUMS.txt` · proof pattern: `godot_proof/proof.gd`

**Not this mission:** Navmesh bake · staff NPC merge · phone HUD / Talk / OpenRouter · blink/poweron/plinth · U7 packaging · protocol Solidity · rewriting escort seek numbers unless broken by the swap.

---

## Principal intent

Companion follow Phase 1 keeps the escort-lite mover as the sole translator. Lab ENG-2026-0022 answered **Yes**: skinned lod03 with `GumBot_Idle` + `GumBot_Walk`, bank palette held, Godot 4.5.2 Compatibility proof. The asset is landed and Follow now shows the baked leg cycle.

---

## Design lock (non-negotiable)

| Lock | Implication |
|------|-------------|
| **Lab ship set only** | Copy `gum_bot_bank_walk.glb` (verify sha256 from lab `out/SHA256SUMS.txt`). Do not vendor blend / scripts / ENG tree. |
| **No root motion** | Clips translate in place. Keep escort-lite seek as the only world motion. |
| **Drive from `_walking`** | Play **walk** while `_walking`; **idle** when following but resting, STAYING, or HOME. |
| **Screen contract** | Keep dormant↔awake emission swap (`emission` black; swap sheet only). |
| **Follow contract** | Phone Follow / Unfollow / Sleep home snap / no floor lock from Follow — unchanged. |
| **Not staff** | Do not fold into `npc.gd` / KayKit clip installers. |

---

## What to build

1. Copy lab `out/gum_bot_bank_walk.glb` into `apps/game/assets/models/inpc/` (replace `gum_bot_bank.glb` **or** add a walk variant and point `InpcProp` at it — pick one; prefer replace if sizes/footprint match).
2. Ensure Godot imports armature + `GumBot_Idle` / `GumBot_Walk` (aliases `idle` / `walk` OK).
3. Wire `inpc.gd`: find `AnimationPlayer` under the mesh; sync clip to `_walking` / rest states; keep yaw π mesh child if still required for lobby face.
4. CREDITS.md row + sha256; LICENSE already present if same CC0 lineage.
5. Docs: INPC.md as-built (slide → skinned); OWED tick land met/blocked; HANDOFF-CC one line.
6. Tests: `run_inpc_walk` still green (follow bit / no lock / Sleep home). Optional: assert AnimationPlayer has idle+walk if cheap.
7. `export:web` when Godot 4.5.x available; browser smoke Wake → Follow → legs → Unfollow → Sleep.

---

## Verification checklist

- [x] Follow shows alternating legs (not T-pose slide)
- [x] Resting / Unfollow / HOME play idle (or rest pose)
- [x] Sleep snaps home + dormant screen; follow cleared
- [x] Follow alone does not lock WASD / `inpc_open`
- [x] Talk / phone / screen swap still work
- [x] CREDITS + sha256; `run_inpc_walk` green; viz budget within documented ceiling
- [x] OWED + INPC + this handoff status updated

---

## Outcome

**Met 2026-09-11 (Codex Luna).** Replaced `apps/game/assets/models/inpc/gum_bot_bank.glb` with the ENG-2026-0022 ship GLB from `GameLab/out/`; product SHA-256 is `00a825f9286baf8653b1d40671a63eca998cf5bb07adb23de511d8dc4ab24f1b`, matching `out/SHA256SUMS.txt`. Enabled Godot animation import; Godot 4.5.2 imported `AnimationPlayer` clips `GumBot_Idle` and `GumBot_Walk`. `InpcProp` selects walk only while `_follow == FOLLOWING && _walking`, otherwise idle; mover seek, collision exceptions, Sleep home snap, yaw π, emission-sheet swap, and phone contract remain unchanged. No root motion, navmesh, OpenRouter, phone chrome, or staff changes.

Verification: `run_inpc_walk` PASS (0 failures); `run_checks` `_check_inpc` PASS; `run_viz_budget` PASS at 42 mesh materials / 44 with particles / 112,407 triangles; `export:web` completed with Godot 4.5.2. Browser `?mock=account` smoke used the non-secret placeholder `sk-or-smoke-test-invalid` only to unlock the session UI (no chat sent): Wake → awake radio → Follow → player movement showed the leg cycle across frames → Unfollow parked → Sleep removed the radio and returned the assistant dormant/home. Browser console had no iNPC/Godot errors; one pre-existing Privy iframe warning remains.
