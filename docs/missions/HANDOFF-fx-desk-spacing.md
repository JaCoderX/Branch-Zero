---
type: handoff
title: Handoff — FX desk spacing (pull west)
audience: cold agent (Codex Luna)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Pull Johnny's FX counter forward into the alcove so staff have real space behind the desk — layout only
kickoff: docs/missions/KICKOFF-fx-desk-spacing.md
baseline: FX desk hard against the east wall (counter ~x=13.5, Johnny ~14.3, stool ~14.35); principal — too compact
status: met 2026-09-09 — FX_WEST_DELTA −1.2 m; wall plaques stay; quote board unmoved; checks green
parallel_to: docs/missions/HANDOFF-fx-fiat-pairs.md (Fable owns tokens/pools; this unit owns geometry only)
---

# Handoff — FX desk spacing (pull west)

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Status (2026-09-09):** **Met.** Desk props + Johnny pulled west by **1.2 m** (`FX_WEST_DELTA`). East-wall FX plaques stay at x ≈ 14.8. Quote board / sponsor left on the vault partition (still customer-readable). F9 + viz shots (`33`–`35`, new `42_fx_staff_clearance_close`) updated. WORLD-3D §2 note landed. Gates: `run_checks` / `run_fx_walk` / `run_mock_walk` / `run_viz_budget` green on Godot 4.5.2.

**Authorized construction (historical):** move the **FX desk assembly** west for staff clearance. Layout only — no FX logic.

**Prefer:** **Codex Luna**. Do **not** touch Uniswap, tokens, `lanes/fx.ts`, or fiat-pair work ([HANDOFF-fx-fiat-pairs.md](./HANDOFF-fx-fiat-pairs.md) is a separate Fable unit).

**Kickoff (paste):** [`docs/missions/KICKOFF-fx-desk-spacing.md`](./KICKOFF-fx-desk-spacing.md)

**Not this mission:** Fiat tokens/pools · FX dialogue copy about euros · packaging · Arc · new props/materials · ninth OmniLight · Bob/vault geometry redesign.

---

## Principal intent

The FX alcove **feels too compact**. Johnny is pinched against the east wall. Pull the desk **forward** (toward the open lobby = **lower x / west**) so the dealer has a proper strip behind the counter — bank teller spacing, not a hallway lean.

---

## Current anchors (as of 2026-09-09)

| Piece | Approx today |
|-------|----------------|
| `FxCounter` | `(13.5, 0, -2.0)` yaw `-PI/2` |
| Shelf / printer / screen / tools | x ≈ `14.15` |
| `FxStool` | `(14.35, 0, -2.0)` |
| Johnny (`dealer`) | `(14.3, 0, -2.0)` yaw `PI/2` (faces west into lobby) |
| East-wall plaques `FX DESK` / service menu | x ≈ `14.8` |
| `FxBoardQuad` + sponsor (vault partition south face) | `(12.4, …, -4.78)` — faces alcove; **may stay** if still legible after the pull |

Files: `apps/game/scripts/bank_interior.gd` (`_fx_desk`), `apps/game/scripts/main.gd` (Johnny row + F9 teleport if present).

---

## Direction

1. Shift the **whole desk group** west by roughly **0.8–1.5 m** (tune by eye). Target: ≥ ~1.0 m clear behind Johnny to the east wall / stool→wall.
2. Move Johnny with the stool (same delta). Keep yaw facing the lobby.
3. Re-place east-wall plaques so they still read as desk signage (on wall behind staff, or on the counter run — bank-voiced, not floating).
4. Quote board: keep customer-readable from the walk-up; if the pull makes the vault-partition board awkward, nudge it or re-anchor on a face that customers still see without reading through Johnny's shoulders.
5. Do not block vault door approach, SECURITY lore door, or teller escort waypoints. No new materials. WORLD-3D §6 unchanged.
6. Evidence: `:5173` or viz still — customer two-shot + staff-side clearance; optional F9 FX teleport updated. One WORLD-3D / REFLECTION note.

## Constraints

Godot 4.5 · existing props only · no FX logic · no fiat handoff scope · no ninth light · laptop-local captures.
