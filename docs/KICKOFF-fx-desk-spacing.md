---
title: Kickoff prompt — FX desk spacing (pull west)
created: 2026-09-09
product: Branch-Zero
model: Codex Luna
handoff: docs/HANDOFF-fx-desk-spacing.md
---

# Kickoff prompt — FX desk spacing (pull west)

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** a **small layout pass** — pull Kenji's FX desk **forward** (west / into the lobby) so staff have real space behind the counter. The alcove currently feels too compact.

**Why:** Principal — FX desk too tight against the east wall.

**Baseline:** Main wing playable. Counter ~x=13.5, Kenji ~14.3. Fiat-pairs unit ([HANDOFF-fx-fiat-pairs.md](./HANDOFF-fx-fiat-pairs.md)) is **separate** (Fable) — do not start tokens/pools here.

**Handoff:** [`docs/HANDOFF-fx-desk-spacing.md`](./HANDOFF-fx-desk-spacing.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| "Forward" = toward lobby | **Lower x** (west), away from east wall |
| Customer looks east at Kenji | Keep approach; Kenji yaw still faces lobby |
| Quote board on vault partition | Keep readable; nudge only if the pull breaks the read |
| WORLD-3D §6 | No new mats / lights |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — FX desk spacing ONLY. Pull Kenji's FX counter/stool/dealer west (into the lobby) so there is comfortable staff clearance behind the desk. Layout / props only.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/HANDOFF-fx-desk-spacing.md
2. docs/KICKOFF-fx-desk-spacing.md
3. docs/WORLD-3D-ENVIRONMENT.md   (§2 east run / FX, §6 budget)
4. apps/game/scripts/bank_interior.gd   (_fx_desk)
5. apps/game/scripts/main.gd   (dealer spawn; F9 if present)
6. docs/HANDOFF-CC.md   (do not regress freeze)

HARD RULES:
- Codex Luna seat. Do NOT deploy tokens, touch lanes/fx.ts, Uniswap pools, dealer FX pair dialogue, or HANDOFF-fx-fiat-pairs work.
- Godot 4.5 GDScript, web Compatibility. Existing props only. No ninth OmniLight. No new materials.
- Pull the desk group west ~0.8–1.5 m (tune by eye). Aim for ≥ ~1 m clear Kenji/stool → east wall.
- Move Kenji with the stool. Keep customer approach looking east; Kenji faces west into lobby.
- Quote board (FxBoardQuad + sponsor) must stay legible from the customer walk-up — nudge if needed, do not orphan it behind the dealer.
- Do not block vault door, SECURITY lore door, or escort waypoints.
- No secrets. Player-facing plaque copy may stay as-is unless a plaque must move with the wall.

SEQUENCE:
1. In bank_interior.gd _fx_desk: shift FxCounter, shelf, printer, tool, screen, stool, planter by the same west delta; re-seat east-wall FX plaques.
2. In main.gd: shift dealer position by the same delta; update F9 FX teleport if it exists.
3. Walk or viz: customer two-shot (Kenji + board) + staff-side clearance still.
4. Short WORLD-3D §2 note and/or REFLECTION row. Local progress note if useful. Export/refresh web if needed for :5173.

DoD:
- [ ] Staff strip behind Kenji no longer feels pinched against the east wall
- [ ] Customer can still read the quote board and talk to Kenji from the lobby approach
- [ ] No FX logic / fiat / packaging changes
- [ ] Budget gates unchanged (no new mats/lights)

STOP AND ASK if: vault or SECURITY blocking; quote board cannot stay readable without a larger redesign; fiat-pairs agent already moved the desk in the same tree (rebase, don't double-shift).
```

---

## After

Principal eye-check at F9 / FX walk-up. Fiat pairs remain the Fable unit.
