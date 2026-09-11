---
type: handoff
title: Handoff — KayKit bank performance (animation / idle)
audience: cold agent (Claude Code or Codex Luna)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Make the landed jacket cast move like bank staff — settled idle, walk, desk work, greet — not Adventurers T-pose / arms-spread rest
plan: this file §Direction; work Stage 0 in product or ENG-2026-0018
kickoff: docs/missions/KICKOFF-kaykit-bank-performance.md
baseline: Jacket cast landed Branch-Zero fec5aa1 (ENG-0016 sheets + ENG-0017 glbs); principal — look good enough; next is animation (base stance hands spread)
lab: ../GameLab/work/ENG-2026-0018-kaykit-bank-performance/
prior_lab: ../GameLab/work/ENG-2026-0017-kaykit-bank-jacket/
parallel_to: Load Account / ship packaging — do not steal
---

# Handoff — KayKit bank performance (animation)

You are a **cold agent**. Prefer this file + kickoff over chat memory.

**Authorized construction:** bank **motion language** on the live jacket cast (Rig_Medium). Diagnose whether arms-out is dead tracks or Adventurers `Idle_A`, then remap / pick / lightly bake clips so idle reads as staff, not dungeon rest.

**Principal (2026-09-09):** Jacket cast is good enough. Stage 0A landed — "hands spread" was dead tracks (`root_node = "."`), not Idle_A. Principal accepted Idle_A feel after the fix. **ENG-2026-0018 not opened**; open only if Idle_A still reads wrong (clip census in §Stage 0 outcome).

**Status:** Stage 0A **met** (commits `639ffd2` / handoff `f31a1bd`). Cast art + idle wiring parked. Product focus → OWED walks / U7 packaging.

**Product today:** `PropKit.USE_KAYKIT_CAST` + jacket meshes (`Ranger_jacket_nocape`, `Mage_jacket_nocape`, `Rogue_jacket_nocape`, `Johnny_jacket`, `Walker_jacket`, `Bob_jacket_cape`) + wardrobe `*_bank_texture.png`. Clips: idle←`Idle_A`, walk←`Walking_A`, sprint←`Running_A`, greet←`Waving`, work←`Interact`, refuse←`Hit_A`. AnimationPlayer `root_node` = `..` (Stage 0A).

**Kickoff (paste):** [`docs/missions/KICKOFF-kaykit-bank-performance.md`](./KICKOFF-kaykit-bank-performance.md)

**Not this mission:** Remeshing jackets · room · dialogue · Mad Men faces · new yellow-licence packs · Load Account.

---

## Stage 0 outcome (2026-09-09) — verdict **A: wiring**, landed (Stage 0A, commit 639ffd2)

**Evidence (headless probe, Godot 4.5.2, jacket bodies Ranger / Bob / Mage / Johnny):**

| Check | Before | After |
|-------|--------|-------|
| `AnimationPlayer.root_node` on `character_kaykit` | `.` (product-created player) | `..` |
| `idle` tracks resolving (`Rig_Medium/Skeleton3D:*`) | **0 / 54** — `root_node` is relative to the player itself, so `.` pointed at the AnimationPlayer node; `AnimationMixer: couldn't resolve track` once a frame ran | 54 / 54 on every body |
| Left upper arm vs straight-down after 12 frames of `idle` | 90.0° = T-pose bind (pose delta 0.000) | 41° (Idle_A; hands at hip height) |
| `current_animation` | `idle` (set, but driving nothing) | `idle`, driving the skeleton |

The "hands spread" was the **T-pose bind**, not `Idle_A` authoring. Stock and jacket bodies behave identically (same
Rig_Medium; ENG-0017 bone deltas hold). The lab's `..` was the correct value; the handoff line "force `root_node = .`"
was the bug and has been corrected here.

**Clip census (arm angle from vertical, left upper / lower, 3 samples) for a later Stage 1 if the principal still wants
a different idle:** `Idle_A` 41 / 34 (settled, fists by hips) · `Idle_B` 48–51 / 40 (looser, slightly wider) ·
`Interact` 63 / 42 · `Waving` 48 / 22 · `Walking_A` 78–80 / 58–67 · `Walking_C` 63–68 / 44–47 (calmer walk) ·
`Sit_Chair_Idle` 61 / 37 (desk seated candidate). No Tools library vendored; none needed for 0A.

**Product change (Branch-Zero main, principal accepted the feel check 2026-09-09):**

- `apps/game/scripts/props.gd` `_kaykit_ensure_anim_player`: product-created player gets `root_node = NodePath("..")`; an embedded glb player is re-pointed at the glb root too (`get_path_to(root)`).
- `apps/game/tests/smoke_kaykit_cast.gd`: in-tree `idle` play for 12 frames on greeter / vault_keeper / dealer; asserts
  every idle track resolves, `current_animation == "idle"`, and the upper arm has left the bind pose (≤ 70°, ≥ 10° moved).
- Gates: `smoke_kaykit_cast` PASS (idle 41.2° / 40.8° / 40.8°) · `run_checks` PASS · `run_viz_budget` PASS (39 mats) ·
  `npm run export:web` refreshed `apps/web/public/game/` (gitignored).
- Feel stills: windowed `tests/viz_shots.tscn` run — `23_mo_talk`, `25_bob_talk`, `16_mo_close` show arms down.

**Not opened:** ENG-2026-0018 (no authoring question yet — `Idle_A` is a settled stance once it plays). Open it only if the
principal's feel check says Idle_A still reads wrong; the census above is the Stage 1 starting table.

---

## Direction

### Stage 0 — Diagnose (hours, not days)

| Check | Meaning |
|-------|---------|
| `AnimationPlayer.current_animation == "idle"` in lobby | Clip actually playing |
| Track paths `Rig_Medium/Skeleton3D:…` resolve on jacket roots | Not silent miss |
| Embedded glb `AnimationPlayer` vs product-created one; `root_node` must be `NodePath("..")` (it is relative to the player, which sits under the glb root) | `"."` points at the player itself and every track misses silently — the Stage 0A bug |
| Stock Ranger idle vs jacket idle side-by-side | Same pose family = authoring; diverge = wiring |

**A:** Wiring broken → tiny PropKit hotfix + smoke + `export:web` (may skip full ENG).  
**B:** Wiring fine, `Idle_A` looks arms-spread → Stage 1–2 clip work (ENG-0018).

### Stage 1 — Clip bible

Propose `KAYKIT_CLIP_SRC` targets (Idle_B / Tools / baked bank idle). Keep ≤5 mats, Rig_Medium only.

### Stage 2 — Lab ENG-2026-0018

Board candidate idles; Godot proof on jacket bodies; findings + land proposal. Principal accepts idle board before product land of new clips.

### Stage 3 — Land

Update clip map (+ any CC0 derivatives); smoke asserts idle not bind/T-pose; viz green; export web.

---

## Constraints

CC0 KayKit only · Rig_Medium bone names · Compatibility · room untouched · capsules/dialogue unchanged · laptop-local captures.

## After Yes

Separate land kickoff if Stage 2 produced new files; wiring-only Stage 0A can land without a new ENG closeout.
