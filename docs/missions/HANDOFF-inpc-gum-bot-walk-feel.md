---
type: handoff
title: Handoff — iNPC Gum Bot walk feel (readable gait)
audience: cold agent (Codex Luna · GameLab then product land)
created: 2026-09-11
product: Branch-Zero
mission: Make Blox-47's Follow gait read like the KayKit hero walk at lobby distance — not a near-static slide
kickoff: docs/missions/KICKOFF-inpc-gum-bot-walk-feel.md
status: open
baseline: skinned walk land MET 2026-09-11 — clips play; principal still sees no leg motion
parallel_to: U7 packaging · do not absorb OpenRouter / phone / navmesh / KayKit retarget
---

# Handoff — iNPC Gum Bot walk feel

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna** for product Stage A + land; **GameLab ENG-2026-0024** (Blender) for Stage B gait — paste lab [`KICKOFF.md`](../../../GameLab/work/ENG-2026-0024-inpc-gum-bot-walk-feel/KICKOFF.md). Do **not** reopen ENG-2026-0022; do **not** use ENG-2026-0023 (unicorn).

**Kickoff (paste):** [`KICKOFF-inpc-gum-bot-walk-feel.md`](./KICKOFF-inpc-gum-bot-walk-feel.md)

**Design index:** [`docs/INPC.md`](../INPC.md)

**Baseline (met):**
[`HANDOFF-inpc-gum-bot-walk.md`](./HANDOFF-inpc-gum-bot-walk.md) · ENG-2026-0022 **Yes** · product drives `GumBot_Walk` / `GumBot_Idle` from `_walking`

**Not this mission:** Retargeting KayKit `Walking_A` onto the Gum Bot (different skeleton) · navmesh · root-motion double move · OpenRouter / phone chrome · snapshot whitelist · staff `npc.gd` merge · U7 packaging.

---

## Principal intent

Follow should show **natural walking movement** like the hero character — clear alternating legs, readable at lobby camera distance. Today the skinned land plays clips but the body still reads as a slide.

---

## Diagnose (2026-09-11 — already done; do not re-litigate)

| Check | Result |
|-------|--------|
| `AnimationPlayer.root_node` | `..` (correct — not the KayKit Stage 0A `"."` miss) |
| Track resolve on `GumBot_Walk` / Idle | **42 / 42** OK |
| Clip lengths | ~1.04 s each, looping |
| `leg1.l` pose delta mid-cycle vs start | **~0.03–0.04 rad (~2°)** — too small to read at lobby distance |
| Hero walk | KayKit `Walking_A` via PropKit — large hip/leg swing + `speed_scale` from ground speed |

**Verdict:** wiring works; **authoring amplitude is the bottleneck**. Product nits can still help timing / idle-at-rest, but a readable gait needs a **new GameLab walk clip** (or a deliberate exaggeration pass on the existing actions).

---

## Plan (revised)

### Stage A — product hygiene (cheap; same day)

In `apps/game/scripts/inpc.gd` only:

1. When FOLLOW seek has zero ground velocity (at rest point / pause), force **idle** even if `_walking` was left true (today `_walking` can stay true while `settle()` — walk clip on a parked body).
2. Drive `AnimationPlayer.speed_scale` from ground speed / authored walk speed (mirror `player.gd` ↔ `PropKit.walk_mps()`), clamped ~0.5–2.0 — default authored cycle assumes ~1×.
3. Optional smoke assert in `run_inpc_walk` or a tiny probe: while following and moving, `current_animation` is walk and a leg bone leaves bind by a **minimum** delta (set the bar after Stage B; for Stage A alone use a soft "clip is playing" check).

Stop and show the principal if Stage A alone already reads OK (unlikely given ~2° amplitude).

### Stage B — GameLab gait (required for hero-like read)

**ENG-2026-0024** — [`GameLab/work/ENG-2026-0024-inpc-gum-bot-walk-feel/`](../../../GameLab/work/ENG-2026-0024-inpc-gum-bot-walk-feel/) · paste lab [`KICKOFF.md`](../../../GameLab/work/ENG-2026-0024-inpc-gum-bot-walk-feel/KICKOFF.md).

- Re-author `GumBot_Walk` (and idle if needed) on the **existing** Gum Bot Rig.
- Target: contact → swing → contact readable in a 3-frame strip at ~4–6 m camera distance; hip/knee swing ≫ today's ~2°.
- Keep: lod03, bank materials, no root motion, ≤1024², screen UV intact.
- Proof: Godot 4.5.2 Compatibility windowed strip + `out/gum_bot_bank_walk.glb` + sha256.
- Isolation copies already in the ENG (`ref/prior_0022_walk.glb` = amplitude baseline to beat).

### Stage C — product land

Replace `apps/game/assets/models/inpc/gum_bot_bank.glb`; verify sha256; keep seek-as-translator; CREDITS / INPC / OWED; `run_inpc_walk` + browser Follow smoke.

---

## DoD

- [ ] Stage A nits landed (or documented skipped with reason)
- [ ] Lab Yes: readable walk strip at lobby distance; no root motion
- [ ] Product Follow shows alternating legs like the hero (principal eye)
- [ ] Idle when resting / Stay / Home; Sleep home + dormant
- [ ] Headless iNPC green; export:web when host available
- [ ] No KayKit retarget, navmesh, OpenRouter, or staff scope creep

## Outcome

_(agent fills)_
