---
type: handoff
title: Handoff — Dialogue box stays on screen
audience: cold agent (Codex Luna)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Keep the conversation / choice panel fully inside the viewport when many choice rows are shown
kickoff: docs/missions/KICKOFF-dialogue-box-fit.md
baseline: dialogue_box.gd uses a fixed ~330 px bottom slot; long choice lists (e.g. Johnny pair amounts, multi-verb NPCs) clip or exit the bottom framing
status: met 2026-09-09 — grow-up bottom panel + choices ScrollContainer; keys 1–9 / Esc preserved
parallel_to: packaging / FX fiat (done) — layout polish only
---

# Handoff — Dialogue box stays on screen

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Status (2026-09-09):** **Met.** `dialogue_box.gd` grows upward from the bottom with viewport-derived max height; choices live in a `ScrollContainer` when they exceed the remaining slot. Keyboard 1–9 / Esc / working state unchanged.

**Authorized construction (historical):** make the **dialogue / conversation panel** always fully visible inside the game viewport — especially when the context box has **many choice rows**. No clip through the bottom chrome; no choices off-screen.

**Prefer:** **Codex Luna**.

**Kickoff (paste):** [`docs/missions/KICKOFF-dialogue-box-fit.md`](./KICKOFF-dialogue-box-fit.md)

**Not this mission:** Rewrite dialogue JSON content · new bridge methods · HUD redesign · FX/Uniswap · packaging · character art · payment_slip / load_account forms unless they share the same fixed-slot bug and a one-line pattern reuse is cheap (prefer dialogue first; stop and ask before expanding).

---

## Principal intent

Some conversation menus **leave the bottom framing** of the screen when the box has many rows. Chat windows must **always stay on screen**.

---

## Likely cause (start here)

[`apps/game/scripts/dialogue_box.gd`](../apps/game/scripts/dialogue_box.gd) builds a bottom-centre slot with a **fixed height**:

- anchors bottom / centre
- `offset_top = -370`, `offset_bottom = -40` → ~330 px tall
- panel `SIZE_SHRINK_END` inside that slot

Speaker + line + **N** choice buttons can exceed 330 px; content then clips or draws past the safe band.

Related craft (do not relearn): GameDevOS [`anchors-and-offsets-for-code-built-ui-roots`](../../GameDevOS/wiki/lessons/anchors-and-offsets-for-code-built-ui-roots.md) — use anchors **and** offsets; measure after layout.

---

## Direction

1. After choices are built (and on viewport resize), ensure the panel’s global rect stays inside the visible viewport with a small margin (e.g. ≥ 16–40 px from bottom / top / sides).
2. Preferred pattern: **grow upward from the bottom** with a **max height** based on `get_viewport_rect().size.y` (e.g. leave room for HUD chips), and if content still exceeds max height, make the **choices region scroll** (`ScrollContainer`) so every choice remains reachable (mouse + keys 1–9 still work for visible/focusable items — keep keyboard 1–9 mapped to choice index, not only on-screen widgets).
3. Do **not** cover the whole screen with an opaque modal unless necessary; keep the bottom-band bank look.
4. Prove with a node that has many choices (Johnny after pair pick with 25/100/250 + Ask why / leave, or any NPC with ≥ 6–8 choices). Capture before/after or note in progress.
5. Light `run_checks` / mock walk if useful; `export:web` if reviewing on `:5173`.

## Constraints

Godot 4.5 · web Compatibility · existing fonts/colours · `set_anchors_and_offsets_preset` for roots · no new deps · no dialogue copy rewrite · laptop-local captures.
