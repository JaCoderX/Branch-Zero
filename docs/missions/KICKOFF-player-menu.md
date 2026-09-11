---
title: Kickoff prompt — Player menu (title + visitor's card)
created: 2026-09-10
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-player-menu.md
---

# Kickoff prompt — Player menu (title + pause)

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** game-creation **UI shell** — (1) thin title / front door, (2) Esc pause as a visitor's card. Player-facing only.

**Why:** Product boots straight into the lobby; ship/demo needs a brand enter beat and a soft leave/pause without stealing desk verbs or operator tools.

**Baseline:** Main wing on `:5173` (mock or Live). Esc today closes dialogue/slips; F1 is help; no title/pause menu exists.

**Handoff:** [`docs/missions/HANDOFF-player-menu.md`](./HANDOFF-player-menu.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Pillar: no pop-ups after the one Privy modal | Pause = bank blotter / visitor's card, not a settings wall |
| Pillar: process is the puzzle | Open / Load / Sign in stay at Iris — never on the menu |
| Live/Dev is desk-debug / `?mode=dev` | Do **not** put network mode on title or pause |
| DEMO-SCRIPT opens with title card → doors | Title CTA: **Enter the branch** + brand + one line |
| Esc already closes dialogue / slips | Esc opens pause only when UI is free |
| `#boot` / overlay focus lesson (U4) | No full-viewport HTML hit-target that kills Godot keyboard |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — player menu.
(1) Title / front door: brand "Branch Zero", one tagline (bank you can walk through), primary CTA "Enter the branch"; optional Controls / short About.
(2) Esc pause ("visitor's card"): Resume · Controls · Sound (mute or master) · Leave for today → title. High contrast only if cheap.

Freedom on HOW. No freedom on constraints.
Player-facing only (design option A). Operator Live/Dev stays desk-debug.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-player-menu.md
2. docs/missions/KICKOFF-player-menu.md
3. docs/GAME-DESIGN.md §1 + §7 (pillars + HUD/UI)
4. docs/DEMO-SCRIPT.md §1 first beat (title card)
5. apps/game/scripts/main.gd · hud.gd · dialogue_box.gd (Esc / ui_locked)
6. apps/game/dialogue/strings.json ("help")
7. Skim: docs/REFLECTION.md canvas-focus / #boot lesson · docs/missions/HANDOFF-CC.md freeze notes (do not regress)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Codex Luna. Product repo only (Branch-Zero). No GameLab ENG-*. No protocol Solidity.
- Everyday bank words on title/pause. No "New Game / Options / Quit" SaaS chrome.
- NEVER put on the menu: Sign in, Load Account, Live/Dev, Mock toggle, Arc wing switch, Open Console, achievements dump, save slots.
- Esc priority: dialogue / slip / form first → then open/close pause when GameState is free (respect ui_locked).
- While pause open: ignore move/orbit; do not cancel in-flight desk actions.
- Prefer Godot CanvasLayer; if any HTML overlay is used, preserve focusCanvas() / no dead keyboard (U4 freeze).
- Runtime deps stay @bloxchain/sdk + viem. Godot never holds keys / never talks RPC.
- Preserve U4 freeze, U4+ Priority, Bob wait-only, Iris Load Account, FX Sepolia-only, partners board, exterior easter.
- Mock honesty: if mock/offline, keep the honest banner rule — never silent fake chain.
- Never commit secrets. Local progress notes under docs/progress/ (gitignored).
- Do not start copy/ENS refinement, U7 ship packaging, Arc revive, or KayKit art in this mission.

SEQUENCE:
1. Inventory — confirm boot path (main.gd), Esc owners, existing audio buses / SFX, HUD help string.
2. Title — gate play behind Enter the branch; thin layout; bank chrome consistent with HUD/dialogue.
3. Pause — Esc when free; Resume / Controls / Sound / Leave→title; confirm Esc still closes talk/slips first.
4. Wire Leave ↔ title without breaking session/bridge; soft exit only (no window.close required).
5. Verify — mock walk: title→enter→Esc→Resume→Esc→Leave→Enter; talk to Ash, Esc closes dialogue not pause; F1 help still works; keyboard after close.
6. Close — mark HANDOFF met/blocked; tick OWED; one REFLECTION line if a design call was made; note if export:web is required for :5173.

DoD:
- [ ] Title: brand + tagline + Enter the branch; no desk/operator verbs
- [ ] Esc pause when free; Esc still closes dialogue/slips first
- [ ] Pause: Resume · Controls · Sound · Leave → title
- [ ] Leave returns to title cleanly; re-enter works
- [ ] Mock honesty preserved when mock active
- [ ] Canvas keyboard focus intact after menu close
- [ ] Light mock walk above green; no freeze / Load Account / Live-Dev regressions

STOP AND ASK if: you want Live/Dev on the menu; Sign in on title; HTML overlay seems required and focus is unclear; high-contrast needs a full theme system; Leave must wipe Privy session (default: keep session, only leave the floor).
```

---

## After

Principal: hard-refresh `:5173` if the web pack was rebuilt. Confirm title → enter → walk → Esc card → Leave → title. Confirm talking to Ash still uses Esc to close dialogue. Confirm desk-debug still owns Live/Dev.
