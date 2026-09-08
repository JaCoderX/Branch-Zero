---
type: handoff
title: Handoff — SE partners board + lobby terminal (ETH Online · sponsors · Bloxchain · Particle · Console)
audience: cold agent (Codex)
created: 2026-09-08
updated: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
mission: Fill the unused southeast corner with a diegetic partners board and a standalone bank terminal (no NPC)
kickoff: docs/KICKOFF-partners-board.md
prior: Sponsor signage is desk-local. Terminals today are only MgrScreen + AOScreen (NPC-adjacent). SE floor south of the elevator is empty.
---

# Handoff — SE partners board + lobby terminal

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on constraints or scope.

**Authorized construction:** southeast lobby set dressing with **two** related pieces:

1. A **bank-voiced partners / event notice board** (not a hackathon booth wall).
2. A **standalone branch terminal** — a `computerScreen` (plus small desk/kiosk if needed) wired like `AOScreen` / `MgrScreen`, **not** attached to any NPC.

Spec + paste prompt: [`docs/KICKOFF-partners-board.md`](./KICKOFF-partners-board.md). Prefer **Codex Luna**.

This is **optional polish / explore**, parallel to packaging. It does **not** replace the principal re-playtest gate or U7 ship packaging ([OWED.md](./OWED.md) §2 / §4).

## What the principal asked for

### A. Partners / event board

Use the underused **east–south** corner with a board that shows:

1. **ETH Online 2026** event frame  
2. **Featured sponsors / partners** notes  
3. **Bloxchain**-specific poster (protocol / open source)  
4. **Particle CS** poster (company that builds Bloxchain)

Reference links (for copy accuracy — board itself stays static text; no URL click-out required):

| Role | URL |
|------|-----|
| Company | https://particlecs.com/ |
| Protocol / app | https://bloxchain.app/ |
| Event | https://ethglobal.com/events/ethonline2026 |
| Partner | https://www.privy.io/ |
| Partner | https://ens.domains/ |
| Partner | https://www.uniswapfoundation.org/build |
| Partner (deferred wing) | https://www.arc.io/ |

### B. Standalone lobby terminal

Place a **new** bank computer in the same SE area so the player has an easy, obvious place to open the Terminal Console **without** leaning on Ines’s or Okafor’s desk (those compete with NPC proximity — see `terminal.gd` / `main.gd`).

- Reuse existing `BankTerminal` + `dialogue/terminal.json` + `open_console` / OBSERVER verbs — **no new bridge methods**, no new dialogue file unless a one-line display-name tweak is cleaner.
- Register it in `main.gd` `TERMINALS` (today only `manager` + `opening`). Suggested id: `lobby` / display name e.g. `"the lobby terminal"` or `"the branch console"`.
- Place screen + optional small table/kiosk so the interact zone (`ZONE_RADIUS` 1.9) does **not** steal prompts from Mo (greeter) or the elevator panel. Prefer slightly south/east of the partners board, facing into the lobby.
- Prompt / lean behaviour must match existing terminals: Space talks to the computer → `terminal.json`; close overlay → `focusCanvas()` unchanged.
- **No NPC** stands at this terminal. Do not invent a “console clerk.”

## Why this corner

Floor plan SoT: [`docs/WORLD-3D-ENVIRONMENT.md`](./WORLD-3D-ENVIRONMENT.md) §2. Coordinates in `apps/game/scripts/bank_interior.gd`: **x east, z south**, origin at centre of the **30 × 22 m** footprint; south wall at `z ≈ +11`, east wall at `x ≈ +15`.

East column (north → south): vault → FX → SECURITY (`z ≈ 1.5`) → **elevator** (`z = 5.5`, shaft `z ∈ [4, 7]`, door face `x ≈ 11.46`).

South of the elevator and east of the entrance gap (`x ∈ [3, 7]`) is mostly dead space today: coat rack `(8.6, 9.9)`, water cooler `(8.0, 4.5)`, doormat `(5.0, 9.6)`. No zone, no NPC, no story prop. Spawn is the revolving entrance — early glance for the demo reel.

**Suggested anchors (agent may nudge ±0.5 m after a walk):**

| Piece | Approx centre | Face |
|-------|---------------|------|
| Partners board | `(12.5–13.5, 1.6–2.2, 8.5–9.5)` | west into lobby |
| Lobby terminal | `(10.5–12.0, desk height, 8.5–10.0)` or beside the board | west / northwest so walk-up is from lobby, not into the elevator |

Keep clear of elevator west face, entrance lintel plaque (`BRANCH ZERO — est. block 0` at `(5.0, 3.5, half_d - 0.25)`), escort waypoints, and greeter roam.

## Locked product language (board)

From [`docs/REFLECTION.md`](./REFLECTION.md) §2.4 / §3:

- Board **complements** desk-local sponsor plaques; does not replace them.
- Pitch: **max three** sponsors in narrative (Privy + ENS + Uniswap). Arc on the board = listed partner only; elevator keeps “coming soon.”
- Branch Zero is built **on** public Bloxchain — not the official Particle/Bloxchain product.
- **Particle CS** = company; **Bloxchain** = open protocol. Separate panels.
- Bank signs, not logo collage / marketing slogans.

## Composition — board

```text
┌─────────────────────────────────────┐
│  ETH Online 2026 · Branch Zero      │  header
│  Sep 4–16 · online                  │
├─────────────────────────────────────┤
│  Privy · ENS · Uniswap · Arc        │  featured strip
├──────────────────┬──────────────────┤
│  Bloxchain       │  Particle CS     │  protocol | company
│  open protocol   │  trust infra     │
│  for governed    │  (one line)      │
│  accounts        │                  │
└──────────────────┴──────────────────┘
```

Prefer `Label3D` + existing palette over trademark logos (WORLD-3D §1 / §6).

## Composition — terminal

Reuse the as-built path in [`docs/TERMINAL-CONSOLE.md`](./TERMINAL-CONSOLE.md):

```text
computerScreen prop → BankTerminal zone → dialogue/terminal.json
  → open_console / observer_* → shell overlay → focusCanvas on close
```

Prop pattern: same kit as `AOScreen` / `MgrScreen` (`PropKit.kit(..., "computerScreen", ...)`). Optional small desk / stool from KayKit or Kenney already in use — keep colliders honest. Optional tiny plaque: `BRANCH CONSOLE` / `Public terminal` (bank words).

## Baseline (do not regress)

- U4 freeze, U4+ Priority, U5 ENS, practice faucet, U7 polish DoD, Terminal Console + OBSERVER invariants (`_check_terminal` write-verb ban), S1 FX, Live/Dev, Load Account, treasury.
- Existing `manager` + `opening` terminals keep working; Ines “Use the desk terminal” unchanged.
- U6 Arc **DEFERRED**. Runtime: `@bloxchain/sdk` + `viem` only.
- Do not wipe Remote EVM. No secrets in git.
- WORLD-3D §6 — no new shadow lights; **no ninth OmniLight**.

## Evidence / DoD

See kickoff. Minimum:

- `:5173` from entrance: board legible; SE no longer empty.
- Walk up to lobby terminal **without** an NPC prompt winning → `terminal.json` → Console opens; close restores movement + canvas focus.
- Desk plaques + elevator Arc notice unchanged in meaning; AO/Mgr terminals still work.
- Optional `viz_shots` (`partners_board`, `lobby_terminal`); local `docs/progress/` note; REFLECTION row if framing choice was non-obvious.
- Extend `run_checks` lightly if useful (e.g. `TERMINALS` has a third id; lobby screen node exists).

## Out of scope

- Ship packaging, DEMO-SCRIPT rewrite, sponsor feedback forms.
- Reviving Arc / U6; new NPCs; new zones; new bridge methods; board URL click-outs.
- New terminal dialogue semantics / OBSERVER permission changes / Privy Global Wallet.
- Replacing desk-local sponsor teaching; trademark logo dumps without `CREDITS.md`.
- Character-style climb, AO desk polish file collisions (prefer not).
- GameLab ENG trees, bloxchain.app SaaS edits, protocol Solidity.
