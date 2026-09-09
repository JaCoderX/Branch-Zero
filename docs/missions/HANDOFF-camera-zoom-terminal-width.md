---
type: handoff
title: Handoff — Bounded mouse-wheel zoom + wider Terminal iframe
audience: cold agent (Codex Luna)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Add hard-bounded mouse-wheel camera zoom, and widen the Terminal Console panel so the bloxchain.app iframe has more room
kickoff: docs/missions/KICKOFF-camera-zoom-terminal-width.md
baseline: No wheel zoom (fixed CAM_DIST 5.0); Terminal panel min(1180×760) with 360 px grant column
status: met 2026-09-09 — cam_dist 2.8–9.0 m via wheel; Terminal panel min(1480×860), side 320 px
parallel_to: dialogue-box fit (layout) · Terminal OBSERVER walk (human)
---

# Handoff — Bounded mouse-wheel zoom + wider Terminal iframe

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Status (2026-09-09):** **Met.**

1. **Zoom** — `apps/game/scripts/player.gd`: `cam_dist` starts at `CAM_DIST` (5.0); wheel up/down steps ±0.45 m, clamped to **2.8–9.0**. Talk framing and `cam_dist_override` still win while active. Wheel ignored when `ui_locked`.
2. **Terminal** — `apps/web/src/overlay/Terminal.tsx`: panel `min(1480px, 100%)` × `min(860px, 100%)`; grant column **320** px (was 360) so the iframe strip gains width. Esc / focusCanvas / fallback tab behaviour unchanged.
3. WORLD-3D §2 mouse line notes the wheel bounds.

**Authorized construction (historical):** two small shell/feel refinements only — no OBSERVER logic, no Godot export pipeline, no packaging.

**Prefer:** **Codex Luna**.

**Kickoff (paste):** [`docs/missions/KICKOFF-camera-zoom-terminal-width.md`](./KICKOFF-camera-zoom-terminal-width.md)

**Not this mission:** Dialogue JSON · FX desk · packaging · OBSERVER grant walks · new bridge methods · FOV hacks that bypass spring-arm collision · unbounded free-cam.

---

## Principal intent

1. Scroll in/out with the mouse should **zoom**, but stay **bounded** — never face-crop or map-view the bank.
2. The back-office Terminal should be **wider** so the Console iframe is usable beside the viewing-wallet column.

---

## Likely touch points

| Piece | File |
|-------|------|
| Boom length / input | `apps/game/scripts/player.gd` (`CAM_DIST`, `_boom_target`, `_unhandled_input`) |
| Overlay size | `apps/web/src/overlay/Terminal.tsx` (`panel`, `side`) |
| Doc pin | `docs/WORLD-3D-ENVIRONMENT.md` §2 mouse · optional one line in `docs/TERMINAL-CONSOLE.md` / `docs/GODOT.md` |

---

## Direction (if re-opening)

1. Wheel → adjust boom; clamp hard. Do not change LMB orbit / RMB walk.
2. Widen panel first; trim grant column only if needed for iframe room.
3. Hard-refresh `:5173`; confirm wheel stops at ends; open lobby/AO/Mgr terminal and eye the iframe strip.
4. Keep Esc + `focusCanvas` + permanent “open in new tab” escape hatch.

## Constraints

Godot 4.5 · web Compatibility · no new deps · laptop-local check · no secrets.
