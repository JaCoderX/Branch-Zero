---
type: handoff
title: Handoff — Account Opening terminal + Counter signage polish
audience: cold agent (Codex)
created: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
mission: AO desk polish — Ines → terminal, keyboard client-side, Counter / Name Desk labels
kickoff: docs/missions/KICKOFF-ao-desk-polish.md
prior: Terminal Console + OBSERVER met 2026-09-08 (docs/TERMINAL-CONSOLE.md · KICKOFF-terminal-observer.md)
---

# Handoff — AO desk polish (Ines terminal · keyboard · Counter labels)

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on constraints or scope.

**Authorized construction:** three small product refinements only. Spec + paste prompt:
[`docs/missions/KICKOFF-ao-desk-polish.md`](./KICKOFF-ao-desk-polish.md). Prefer **Codex Luna**.

## What the principal asked for

1. **Ines dialogue** includes an action that opens the Account Opening desk terminal (same `open_console` path as leaning on `AOScreen`).
2. **Keyboard placement** at Account Opening: screen already faces the client; move the keyboard so it sits **between the screen and the client** (today it reads behind the screen).
3. **Signage:** rename Counter 1 → **Counter**; **remove** the Counter 2 label so the west column reads **Counter** and **Name Desk** only.

## Baseline (do not regress)

- Terminal Console + OBSERVER stretch is **met** — bridge `u5.1`, `terminal.json` / `AOScreen` / `MgrScreen`, membership-only OBSERVER, canvas focus on close.
- U4 freeze, U4+ Priority, U5 ENS, practice faucet, polish DoD (Bob, Space/E, `?debug=1` F-keys, Petra at the former Counter 2 bay), S1 FX desk stay intact.
- U6 Arc stays **DEFERRED**. Do not wipe Remote EVM. Runtime deps remain `@bloxchain/sdk` + `viem` only.
- Node names `Counter1` / `Counter2` may stay internal; **player-facing** words change.

## Geometry facts (Account Opening)

From `apps/game/scripts/bank_interior.gd` `_account_opening()`:

| Prop | Position (approx) | Note |
|------|-------------------|------|
| Customer chairs | `z ≈ 6.7` | Lobby / client side (north of desk) |
| Desk | `z = 8.0` | Ines south of desk toward the wall |
| `AOScreen` | `(-8.6, 0.78, 7.85)`, yaw `PI` | Faces client — **keep** |
| `AOKeyboard` | `(-8.6, 0.78, 8.3)`, yaw `PI` | Currently on Ines’s side of the screen → **behind** from the walk-up |

Intent: client approach (chairs) → **keyboard** → **screen** → Ines. Do not flip the screen away from the client to “fix” depth.

Manager desk (`MgrScreen` / `MgrKeyboard`) already has keyboard on the guest side — leave it unless a walk proves the same bug.

## Ines → terminal

- Dialogue SoT: `apps/game/dialogue/clerk.json` (Ines). Terminal SoT: `apps/game/dialogue/terminal.json`.
- `GameState` already implements `open_console` → `Chain.call_async("openConsole", …)`.
- Add a choice on the post-account (`done`) path — bank words, not “iframe” / “OBSERVER”. Something like **Use the desk terminal** / **Open the desk terminal**.
- Reuse existing `on_ok` / `on_error` / `working` patterns; after success, short line that the Console is on the desk screen (mirror `terminal.json` `console_open` tone).
- Do **not** teach Ines observer grant/revoke verbs — those stay on the terminal. Do **not** weaken `_check_terminal()`’s write-verb ban.
- Closing the overlay still fires `terminal.closed` and must `focusCanvas()` (unchanged).

## Counter / Name Desk labels

Player-facing only:

| Was | Becomes |
|-----|---------|
| Overhead `COUNTER 1` | `COUNTER` |
| Overhead `COUNTER 2 · NAME DESK` | **removed** (no Counter 2 plaque) |
| Service menu “Name Desk · Counter 2 … Pay by name at Counter 1” | Drop Counter 1/2 wording; keep Name Desk services; pay-by-name points at **Counter** |
| Dev role / lines “Counter 1” | “Counter” |
| Greeter / Bob / Kenji / error lines that say Counter 1 | “Counter” where player-visible |

Keep the existing separate `NAME DESK` plaque / names board / Petra at the south teller bay. Internal ids (`Counter1`, `Counter2`, F3/F8 debug spots) may stay.

## Evidence / DoD

See kickoff DoD. Minimum:

- `:5173` walk (mock or live): Ines **done** → desk terminal opens; close returns movement + canvas focus.
- AO still: keyboard between client and screen from the chair side.
- Lobby looking west: one **COUNTER** plaque; Petra’s bay reads **Name Desk**, not Counter 2.
- `run_checks.gd` green when Godot 4.5 host available; update any check copy that hard-codes “Counter 1” / “Counter 2” as product truth.
- Local progress note under `docs/progress/` (gitignored). Optional one-line REFLECTION row.

## Out of scope

New bridge methods, OBSERVER / Privy / faucet / ENS / FX / Arc / ship packaging, redesigning desks, moving Petra, SubViewport live textures, editing GameLab ENG trees.
