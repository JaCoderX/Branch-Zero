---
type: handoff
title: Handoff — iNPC Gum Bot skinned walk land
audience: cold agent (Codex Luna preferred · Claude Code OK)
created: 2026-09-11
product: Branch-Zero
mission: Replace rest-pose gum_bot_bank.glb with lab skinned walk glb; drive idle/walk from InpcProp._walking
kickoff: docs/missions/KICKOFF-inpc-gum-bot-walk.md
status: open — lab Yes ENG-2026-0022; awaiting land
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

Companion follow Phase 1 **slides** a rig-stripped Gum Bot. Lab ENG-2026-0022 answered **Yes**: skinned lod03 with `GumBot_Idle` + `GumBot_Walk`, bank palette held, Godot 4.5.2 Compatibility proof. Land the asset and wire clips so Follow shows legs.

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

- [ ] Follow shows alternating legs (not T-pose slide)
- [ ] Resting / Unfollow / HOME play idle (or rest pose)
- [ ] Sleep snaps home + dormant screen; follow cleared
- [ ] Follow alone does not lock WASD / `inpc_open`
- [ ] Talk / phone / screen swap still work
- [ ] CREDITS + sha256; `run_inpc_walk` green; viz budget within documented ceiling
- [ ] OWED + INPC + this handoff status updated

---

## Outcome

*(fill on met / blocked)*
