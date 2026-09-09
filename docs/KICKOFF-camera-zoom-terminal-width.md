---
title: Kickoff prompt — Bounded mouse-wheel zoom + wider Terminal iframe
created: 2026-09-09
product: Branch-Zero
model: Codex Luna
handoff: docs/HANDOFF-camera-zoom-terminal-width.md
status: met 2026-09-09
---

# Kickoff prompt — Bounded mouse-wheel zoom + wider Terminal iframe

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** a **small feel + shell polish** — (1) mouse-wheel boom zoom with hard min/max, (2) wider Terminal Console panel so the bloxchain.app iframe has more room.

**Why:** Principal — want scroll zoom that cannot runaway; Terminal iframe feels cramped at 1180 px.

**Baseline:** Main wing on `:5173`. `player.gd` fixed `CAM_DIST := 5.0` (no wheel). `Terminal.tsx` panel `min(1180px, 100%)` / height 760 / side 360.

**Handoff:** [`docs/HANDOFF-camera-zoom-terminal-width.md`](./HANDOFF-camera-zoom-terminal-width.md)

**Status:** Met 2026-09-09 — `cam_dist` 2.8–9.0; panel 1480×860; side 320. Re-open only if principal retunes bounds.

---

## Reflect

| Fact | Implication |
|------|-------------|
| SpringArm boom is the camera distance | Zoom = change length, not FOV alone |
| Talk / override pin the boom | Wheel must not fight talk framing or `cam_dist_override` |
| ui_locked during dialogue / forms | Ignore wheel while locked (dialogue ScrollContainer owns scroll) |
| Overlay is React, not Godot | Width change is CSS in `Terminal.tsx` only |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — (A) bounded mouse-wheel camera zoom and (B) wider Terminal Console panel for the iframe. Feel + shell layout only.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/HANDOFF-camera-zoom-terminal-width.md
2. docs/KICKOFF-camera-zoom-terminal-width.md
3. apps/game/scripts/player.gd
4. apps/web/src/overlay/Terminal.tsx
5. docs/TERMINAL-CONSOLE.md (do not regress iframe / Esc / focusCanvas)
6. docs/HANDOFF-CC.md (do not regress freeze)

HARD RULES:
- Codex Luna. Touch player.gd + Terminal.tsx (+ light WORLD-3D / GODOT / TERMINAL-CONSOLE note). Do not change OBSERVER bridge verbs, dialogue JSON, FX, packaging, or character art.
- Godot 4.5 GDScript, web Compatibility. Zoom via SpringArm boom length (or equivalent), NOT an unbounded free-cam.
- Hard clamp zoom (suggested ~2.5–9.5 m; tune by eye). Wheel up = closer. Ignore wheel when ui_locked.
- Preserve LMB orbit, RMB walk/steer, talk two-shot, cam_dist_override.
- Terminal: widen the panel so the iframe strip is clearly larger; keep grant column usable; Esc / Close / backdrop / permanent new-tab link unchanged.
- No secrets. No new deps.

SEQUENCE:
1. Add cam_dist (or equivalent) + wheel handlers with min/max; wire _boom_target to use it when not talking / overridden.
2. Widen Terminal panel (and trim side column only if needed); keep flex iframe column expanding.
3. Hard-refresh :5173 — scroll zoom hits both ends; open lobby terminal and confirm iframe room + Esc restores canvas focus.
4. One WORLD-3D mouse line (and optional TERMINAL-CONSOLE note). Mark handoff Outcome / OWED.

DoD:
- [ ] Wheel zooms in/out and stops at hard bounds
- [ ] Talk framing + cam_dist_override still win while active
- [ ] Terminal iframe strip visibly wider; grant UX intact; Esc / focusCanvas OK
- [ ] No OBSERVER / FX / dialogue-copy churn

STOP AND ASK if: wheel fights dialogue ScrollContainer while unlocked; web export needs a rebuild the agent cannot run; principal wants FOV zoom instead of boom.
```

---

## After

Principal: hard-refresh `:5173`, scroll in the lobby, open a terminal (lobby / AO / Mgr), confirm iframe width and Esc.
