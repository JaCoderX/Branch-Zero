---
type: handoff
title: Handoff — Shell splash (early visual before Godot load)
audience: cold agent (Claude Code · Opus / Fable)
created: 2026-09-10
product: Branch-Zero
objective: OBJ-2026-0004
mission: Show a branded shell splash on first paint while wasm/.pck load; hand off to the existing Godot front door when the engine is ready
kickoff: docs/missions/KICKOFF-shell-splash.md
prior: docs/missions/HANDOFF-player-menu.md (met 2026-09-10)
status: met 2026-09-10
parallel_to: packaging gate unchanged — do not absorb U7 ship packaging; do not reopen player-menu behaviour
---

# Handoff — Shell splash (early visual)

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Claude Code** (Opus / Fable high).

**Kickoff (paste):** [`docs/missions/KICKOFF-shell-splash.md`](./KICKOFF-shell-splash.md)

**Status (2026-09-10):** **Met.** Shell-only: `apps/web/index.html` turns `#boot` into a branded plaque (**Branch Zero** · *A bank you can walk through.* · status line · brass progress bar, Georgia serif stack — no Cinzel shipped); `apps/web/src/main.ts` feeds the status/bar from the existing `setState` / `onProgress` path with bank words (*Opening the branch… N%*, *Unlocking the doors…*) and hides `#boot` on `running` / `bridge.ready` as before. Nothing clickable on the HTML; `pointer-events: none` kept. Verified on `:5173/?mock=account`: splash visible during load → Godot title → **Enter the branch** works → Esc visitor's card / resume; `document.activeElement` stays `canvas`; no console errors. Nothing under `apps/game` touched — no export needed, hard refresh only.

**Not this mission:** Reworking `player_menu.gd` Esc / Leave / Sound · deferred `bank_interior` streaming · Privy / Sign in on splash · Live/Dev / Mock toggles · packaging · dialogue · KayKit · protocol Solidity · GameLab `ENG-*`.

---

## Principal intent

Cold open of `:5173` shows a dark screen and `#boot` status text for a long time while `/game/index.js` + wasm + `.pck` download. The Godot front door (`player_menu.gd` — **Branch Zero** · *A bank you can walk through.* · **Enter the branch**) only appears **after** that load.

Wanted: a **branded visual immediately** on shell first paint, honest load progress, then a clean handoff to the existing in-game title once the engine is running.

---

## Baseline (do not regress)

| Fact | Implication |
|------|-------------|
| Player menu **met** — Godot `CanvasLayer` front door + Esc visitor's card | Keep it as the **real** interactive menu; shell splash is a **placeholder** until Godot is up |
| Boot order ([`GODOT.md`](../GODOT.md) §3): bridge → React overlay → load `/game/index.js` → `Engine.startGame` on `#canvas` | Splash lives in Vite shell (`index.html` / `main.ts`), not in the Godot export |
| `#boot` is `pointer-events: none` and hides when `running` | U4 freeze: a full-viewport hit-target over `#canvas` kills keyboard — **never** reintroduce that |
| Strings: `menu_brand` / `menu_tagline` / `menu_enter` in `dialogue/strings.json` | Match those words on the splash (hard-code in HTML/CSS is fine; do not invent Start / Loading Game SaaS chrome) |
| `onProgress` already feeds `#boot` % / KB | Reuse for splash status line |
| `bridge.ready` is the reliable “engine running” signal | Prefer hiding splash on that (or existing `running…` state), not inventing a new bridge method |

---

## What to build

### 1. Shell splash (required)

On first paint (before / while Godot downloads):

| Element | Required |
|---------|----------|
| Brand | **Branch Zero** (hero-level — not a tiny nav label) |
| One line | *A bank you can walk through.* (same as Godot title) |
| Status | Honest progress: `loading N%` / KB / “Opening the branch…” — reuse `main.ts` `setState` / `onProgress` |
| Look | Dark bank atmosphere consistent with shell (`#0b0e14` family); readable; not a dashboard of chips |

Optional (only if cheap and still non-interactive): muted secondary lines that mirror Controls / About *labels* — **not** clickable actions that start play.

### 2. Handoff to Godot title (required)

- When engine state becomes `running…` / `bridge.ready`: **hide** the splash completely (same rule as today’s `#boot[hidden]`).
- Godot’s existing `menu.show_title()` remains the interactive front door (**Enter the branch**, Controls, About, stars).
- Do **not** put a working **Enter the branch** on the HTML splash that starts play, opens Privy, or focuses a fake menu. If you show the CTA word, it must be clearly disabled / “Opening…” until Godot owns the floor — prefer **no** fake button.

### 3. Focus / hit-target contract (non-negotiable)

- Splash must not steal clicks from `#canvas` once Godot is interactive (`pointer-events: none` on the splash layer, or remove it from the DOM when hidden).
- After hide: `focusCanvas()` behaviour and desk-debug / overlay rules unchanged ([`focus.ts`](../../apps/web/src/shell/focus.ts), GODOT.md §5b).
- React overlay stays `pointer-events: none` except children — do not leave an invisible full-viewport splash over the game.

---

## Likely touch points

| Path | Role |
|------|------|
| `apps/web/index.html` | Replace plain `#boot` text with branded splash markup + CSS |
| `apps/web/src/main.ts` | Drive splash status from `setState` / `onProgress`; hide on running |
| Optional tiny CSS module / inline styles | Keep in shell; no new npm deps |
| Docs on close | Mark this handoff **met**; tick [`OWED.md`](../OWED.md); one [`REFLECTION.md`](../REFLECTION.md) line if a design call was made |

**Prefer not to touch:** `player_menu.gd`, `main.gd` title gate, dialogue JSON, teller-desk, bridge methods (unless a one-line comment in GODOT.md §3).

---

## Out of scope (ask before expanding)

- Deferring `bank_interior` / streaming assets so Godot title appears before the 3D lobby (WORLD-3D “preload lobby only”) — **stretch only**; not required for DoD.
- Custom Godot `res://export/shell.html` PWA path — Vite shell owns the page (U0 decision).
- Fonts that require shipping Cinzel into the HTML shell — system / existing web fonts OK if they stay bank-like; do not block on matching Godot plaque fonts exactly.
- Changing export size / wasm threading / COOP-COEP.

---

## Constraints

- Product repo only (`Branch-Zero`). No GameLab `ENG-*`. No protocol Solidity.
- Runtime stays `@bloxchain/sdk` + `viem`. Godot never holds keys / never talks RPC.
- Preserve: U4 freeze, player-menu Esc priority, Bob wait-only, Priority, FX Sepolia-only, Live Main / Eve 1337, iNPC / Terminal overlays.
- Never commit secrets.
- No forced `export:web` for a shell-only change — note if you touched anything under `apps/game`.

---

## Definition of done

- [x] Cold open of `:5173` shows branded splash (brand + tagline + load status) **before** Godot canvas is playable
- [x] Progress updates honestly while wasm/`.pck` load
- [x] Splash hides when engine is running; Godot front door still appears and **Enter the branch** works
- [x] No full-viewport hit-target; keyboard / canvas focus still works after enter (U4 rule)
- [x] No Sign in / Live-Dev / Mock / desk verbs on the splash
- [x] Handoff marked **met** or **blocked**; OWED ticked; REFLECTION line if a design call was made
