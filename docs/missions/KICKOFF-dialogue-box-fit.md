---
title: Kickoff prompt — Dialogue box stays on screen
created: 2026-09-09
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-dialogue-box-fit.md
---

# Kickoff prompt — Dialogue box stays on screen

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** a **small UI layout pass** — keep the conversation / choice panel fully inside the viewport when many rows are shown. Menus must not exit the bottom framing.

**Why:** Principal — long choice lists clip or hang off the bottom of the screen.

**Baseline:** Main wing on `:5173`. Primary suspect: `apps/game/scripts/dialogue_box.gd` fixed ~330 px bottom slot.

**Handoff:** [`docs/missions/HANDOFF-dialogue-box-fit.md`](./HANDOFF-dialogue-box-fit.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Slot `offset_top=-370` … `offset_bottom=-40` | Height capped; many buttons overflow |
| Bottom-band bank chrome | Grow **up**; don’t centre-modal the whole frame |
| Keys 1–9 pick choices | Scrolling OK if indices still map |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — dialogue / conversation panel ALWAYS fully on screen when choice lists are long. Layout only.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-dialogue-box-fit.md
2. docs/missions/KICKOFF-dialogue-box-fit.md
3. apps/game/scripts/dialogue_box.gd
4. docs/GAME-DESIGN.md §7 (dialogue UX) if needed
5. docs/missions/HANDOFF-CC.md (do not regress freeze)

HARD RULES:
- Codex Luna. Touch dialogue_box.gd (and only expand to payment_slip / load_account / name_claim forms if they share the same fixed-slot overflow — ask first if unsure).
- Godot 4.5 GDScript, web Compatibility. Keep bank bottom-band look (grow upward). No new materials/fonts/deps.
- Do NOT rewrite dialogue/*.json copy, bridge methods, FX logic, packaging, or character art.
- Keyboard 1–9 and Esc must keep working. Working-state (disabled choices + stage line) unchanged.
- After layout (and on viewport resize), panel global rect must stay inside the viewport with a small margin.
- If content exceeds max height: ScrollContainer on the choices (or equivalent) so every choice is reachable.

SEQUENCE:
1. Reproduce: open an NPC with many choices (e.g. Johnny FX pair → amount list + extras) on a short viewport / default 1280×720; confirm overflow.
2. Fix slot/max-height: derive max panel height from viewport (leave HUD margin); grow upward from bottom; scroll choices if needed.
3. Verify keys 1–9 still choose the correct index; Esc closes; working state still hides/disables choices.
4. Optional: one viz or local progress note; light run_checks / mock walk; export:web if reviewing on :5173.
5. Short WORLD-3D or GODOT note only if useful; prefer a one-line REFLECTION / handoff Outcome.

DoD:
- [ ] Long choice lists stay fully on screen (or scroll within an on-screen panel)
- [ ] Bottom framing not breached; panel readable on 1280×720 and taller
- [ ] 1–9 / Esc / working state unchanged in behaviour
- [ ] No dialogue JSON or FX/desk logic churn

STOP AND ASK if: fix seems to require rewriting every form UI; mobile/tall phone aspect needs a different chrome; choice count > 9 breaks the key map (product already caps at 1–9 — do not invent 0/10).
```

---

## After

Principal: hard-refresh `:5173`, open Johnny (or any dense menu), confirm the box stays framed.
