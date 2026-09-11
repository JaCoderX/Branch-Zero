---
type: handoff
title: Handoff — Player menu (title + visitor's card / pause)
audience: cold agent (Codex Luna)
created: 2026-09-10
product: Branch-Zero
objective: OBJ-2026-0004
mission: Ship a thin player-facing title screen and Esc pause (visitor's card) — bank language, no operator tools, no stolen desk verbs
kickoff: docs/missions/KICKOFF-player-menu.md
status: met 2026-09-10
parallel_to: packaging gate (OWED §2 polish re-playtest) · copy/ENS refinement — UI shell only; do not absorb those missions
---

# Handoff — Player menu (title + pause)

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna**.

**Kickoff (paste):** [`docs/missions/KICKOFF-player-menu.md`](./KICKOFF-player-menu.md)

**Status (2026-09-10):** **Met.** `apps/game/scripts/player_menu.gd` — one `CanvasLayer` (layer 20, above HUD 5 and dialogue 10), no HTML. Front door: **Branch Zero** (Cinzel) · *A bank you can walk through.* · **Enter the branch** (Enter / focused button) · Controls (the F1 legend) · About the branch; the MockChain honesty line sits in the footer when the mock answers. Visitor's card on Esc when the floor is free: **1. Resume · 2. Controls · 3. Sound: on/off · 4. Leave for today** (numbered like dialogue choices, arrows + Enter work too). Esc still goes to the dialogue box / slip / forms / Console first — the layer steps aside whenever `Dialogue.active` or `GameState.ui_locked`. A card up = `GameState.ui_locked` (player, Space and teleports already honour it); nothing is paused, desk actions and bridge events carry on. Leave is a soft exit: title back, player at `FRONT_DOOR`, session / account untouched. Sound = Master-bus mute via `Audio.set_muted`, remembered in `user://settings.cfg`. Gate only on the product path (`current_scene == main` and not the demo walk) — viz_shots / run_viz_budget / DemoWalk start on the floor. Verified on `:5173/?mock=account` (export 2026-09-10) and headless `tests/run_menu_walk.gd` + `run_checks` `_check_player_menu`. **High contrast skipped** (needs a theme system — not cheap). Requires `npm run export:web` (done here) + hard refresh.

Product decision locked: **player-facing front door + pause only** (design option A). Operator Live/Dev stays desk-debug.

**Not this mission:** Live/Dev / Mock toggles · Load Account · Sign in / Privy · Arc elevator · Terminal Console · dialogue JSON copy rewrite · ENS surface work · U7 ship packaging · KayKit art · GameLab ENG-* · protocol Solidity · full settings dashboard · local save slots.

---

## Principal intent

Branch Zero boots straight into the lobby today. For ship / demo we want:

1. A **title / front door** — brand + one enter action (matches [`DEMO-SCRIPT.md`](../DEMO-SCRIPT.md) title-card beat).
2. An **Esc pause** framed as a **visitor's card** / desk blotter — not a second wallet modal.

Everything that already has an owner in the bank **stays at that desk**. The menu only covers what the player needs without walking to staff.

---

## Design lock (non-negotiable)

From [`docs/GAME-DESIGN.md`](../GAME-DESIGN.md) §1 pillars + principal review 2026-09-10:

| Pillar | Menu implication |
|--------|------------------|
| No pop-ups, ever | Pause is a soft bank card over the canvas — not a Privy-style wall; one CTA on title |
| Process is the puzzle | Do **not** put Open account / Load vault / Sign in on the menu |
| Everyday bank language | Prefer *Enter the branch*, *Resume*, *Leave for today* — not Start / Options / Quit |
| Honest theatre | Do not fake network mode; Live/Dev stays operator-side |

**Option A (locked):** player title + pause.  
**Option B (rejected for this mission):** operator panel on the menu (mode, mock, till health) — that stays [`apps/web` desk-debug](../apps/web/src/overlay/App.tsx).

---

## What to build

### 1. Title / front door (once per visit / after Leave)

Thin first viewport:

| Element | Required |
|---------|----------|
| Brand | **Branch Zero** (hero-level) |
| One line | e.g. *a bank you can walk through* (align DEMO-SCRIPT) |
| Primary CTA | **Enter the branch** → lobby / play |
| Controls | Optional secondary — same content as HUD help / F1 |
| About / credits | Optional short — or point to lobby partners board |
| Mock honesty | If `?mock=1` (or shell mock), show the existing offline / mock banner rule — never silent fake chain |

Do **not** put on title: network picker, Load Account, Sign in, achievements dump, Live/Dev, volume-only page as the whole screen.

Sign-in remains at **Iris** after the player walks in (preserves “one wallet modal in the whole game”).

### 2. Pause / visitor's card (Esc while inside)

| Include | Why |
|---------|-----|
| **Resume** | Default |
| **Controls** | Same copy family as `strings.json` `"help"` / F1 |
| **Sound** | Mute or master volume — stamp / printer / vault juice needs a web mute |
| **Leave for today** | Confirm → return to title (soft exit; web has no real Quit) |
| High contrast | Stretch if cheap — GAME-DESIGN §7 names it; skip if it forces a theme rewrite |
| Short About | Optional; partners board already covers sponsors diegetically |

| Keep **out** of pause | Owner today |
|----------------------|-------------|
| Sign in / revoke / Load Account | Iris |
| Live / Dev / Mock | Desk-debug / URL |
| Switch wing / Arc | Elevator |
| Open Console | Lobby / desk terminals |
| Achievements submenu | Ash / greeter (cosmetic) |
| Full settings / save slots | Out of scope — state is chain + Privy |

---

## Input / layering rules

Today:

- Esc closes dialogue / slips (`dialogue_box.gd`, `payment_slip.gd`, load/name forms).
- F1 pins the HUD help legend (`hud.gd`).
- `GameState.ui_locked` hides passbook / zone while dialogue or forms are open.
- Shell `focusCanvas()` after overlay hide / Privy — do not cover `#game` with a full-viewport HTML hit-target (U4 freeze lesson in [`REFLECTION.md`](../REFLECTION.md)).

**Required behaviour:**

1. Esc while dialogue / form / terminal overlay owns focus → **close that first** (unchanged).
2. Esc when not `ui_locked` (and no slip open) → **open / close visitor's card**.
3. While pause is open: freeze player move / camera orbit (or ignore WASD); do not cancel an in-flight desk action.
4. Pause must not steal Esc from an open slip mid-edit.
5. Prefer Godot `CanvasLayer` above HUD for the card; avoid a new HTML overlay unless necessary — if HTML is used, it must not leave a dead keyboard (pointer-events + `focusCanvas()` on close).

---

## Likely touch points (start here)

| Area | Notes |
|------|-------|
| New script / scene under `apps/game/scripts/` (e.g. `player_menu.gd`) | Title + pause Controllers; bank chrome (brass / bottom-band family from HUD / dialogue) |
| `apps/game/scripts/main.gd` | Boot → title first, then enter; wire Esc when free |
| `apps/game/scripts/hud.gd` | Help text may be reused; do not redesign passbook |
| `apps/game/dialogue/strings.json` | Menu labels (bank words) |
| `apps/game/tests/run_checks.gd` | Only if you pin new strings |
| Shell | Prefer not; mock banner already exists — reuse honesty rule |

Audio: find existing buses / `AudioStreamPlayer`s; mute via `AudioServer` bus or a simple master flag. If there is almost no audio yet, still ship a Mute control that no-ops cleanly or gates future SFX.

---

## Voice rules

| Surface | Allowed |
|---------|---------|
| Title + pause labels | Everyday **bank** words |
| Controls blurb | Same as HUD help |
| About | Bank / event frame OK; no overclaim Branch Zero is an official Bloxchain product |

Tone: warm, small, Wes-adjacent — not a SaaS settings page.

---

## Constraints

- Godot 4.5 · web Compatibility · `@bloxchain/sdk` + `viem` only at runtime.
- Godot never holds keys / never talks RPC.
- Preserve: U4 freeze, U4+ Priority, Bob wait-only, Iris Load Account, FX Sepolia-only, Live Main / Eve 1337 (operator only), partners board, exterior easter separate.
- Never commit secrets.
- Prefer one Godot export when principal will hard-refresh `:5173`; note if pack rebuild is required.
- Do not absorb copy/ENS refinement or ship packaging into this session.

## Out of scope

Operator mode UI · second Privy surface · Arc revive · rewriting DEMO-SCRIPT · character meshes · dialogue content pass · new bridge methods.

---

## Definition of done

- [x] Title shows brand + tagline + **Enter the branch**; no desk verbs / Live-Dev on it
- [x] Esc opens visitor's card when free; Esc still closes dialogue/slips first
- [x] Pause has Resume · Controls · Sound · Leave → title
- [x] Leave does not hard-kill the tab; returns to title cleanly
- [x] Mock / offline honesty preserved when mock is active
- [x] Keyboard focus still works after close (canvas focus rule)
- [x] Light mock walk: title → enter → Esc → Resume → Esc → Leave → Enter again; one NPC talk Esc still closes dialogue
- [x] Handoff marked **met** or **blocked**; OWED ticked; one REFLECTION line if a design call was made
