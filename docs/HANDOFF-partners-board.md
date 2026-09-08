---
type: handoff
title: Handoff — SE partners notice board (ETH Online · sponsors · Bloxchain · Particle)
audience: cold agent (Codex)
created: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
mission: Fill the unused southeast corner with a diegetic partners / event notice board
kickoff: docs/KICKOFF-partners-board.md
prior: Sponsor signage is desk-local (Privy AO, ENS Name Desk, Uniswap FX, Arc elevator). SE floor south of the elevator is empty.
---

# Handoff — SE partners notice board

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on constraints or scope.

**Authorized construction:** one set-dressing prop in the southeast lobby corner — a **bank-voiced partners / event notice board** (not a hackathon booth wall). Spec + paste prompt: [`docs/KICKOFF-partners-board.md`](./KICKOFF-partners-board.md). Prefer **Codex Luna**.

This is **optional polish / explore**, parallel to packaging. It does **not** replace the principal re-playtest gate or U7 ship packaging ([OWED.md](./OWED.md) §2 / §4).

## What the principal asked for

Use the underused **east–south** corner of the Main wing with a board that shows:

1. **ETH Online 2026** event frame  
2. **Featured sponsors / partners** notes  
3. **Bloxchain**-specific poster (protocol / open source)  
4. **Particle CS** poster (company that builds Bloxchain)

Reference links (for copy accuracy / optional later click-out — **not** required interactables in v1):

| Role | URL |
|------|-----|
| Company | https://particlecs.com/ |
| Protocol / app | https://bloxchain.app/ |
| Event | https://ethglobal.com/events/ethonline2026 |
| Partner | https://www.privy.io/ |
| Partner | https://ens.domains/ |
| Partner | https://www.uniswapfoundation.org/build |
| Partner (deferred wing) | https://www.arc.io/ |

## Why this corner

Floor plan SoT: [`docs/WORLD-3D-ENVIRONMENT.md`](./WORLD-3D-ENVIRONMENT.md) §2. Coordinates in `apps/game/scripts/bank_interior.gd`: **x east, z south**, origin at centre of the **30 × 22 m** footprint; south wall at `z ≈ +11`, east wall at `x ≈ +15`.

East column (north → south): vault → FX → SECURITY (`z ≈ 1.5`) → **elevator** (`z = 5.5`, shaft `z ∈ [4, 7]`, door face `x ≈ 11.46`).

South of the elevator and east of the entrance gap (`x ∈ [3, 7]`) is mostly dead space today: coat rack `(8.6, 9.9)`, water cooler `(8.0, 4.5)`, doormat `(5.0, 9.6)`. No zone, no NPC, no story prop. Spawn is the revolving entrance — the SE wall is an early glance for the demo reel.

**Suggested anchor (agent may nudge ±0.5 m after a walk):** board facing **west** into the lobby (readable from entrance / couches), centre roughly `(12.5–13.5, eye height ~1.6–2.2, 8.5–9.5)`, clear of the elevator west face and the entrance lintel plaque (`BRANCH ZERO — est. block 0` at `(5.0, 3.5, half_d - 0.25)`).

Do **not** block escort waypoints, the elevator call panel, or the south-wall entrance gap.

## Locked product language

From [`docs/REFLECTION.md`](./REFLECTION.md) §2.4 / §3:

- Sponsors already appear as **desk-local bank signs**, not logo walls. This board **complements** them; it does not replace Privy / ENS / Uniswap / Arc plaques.
- Pitch rule: **max three sponsors** in the submission narrative (Privy + ENS + Uniswap). Arc stays **deferred** on the elevator; on this board Arc may appear only as a listed partner, **not** a “go to Arc now” CTA.
- Do **not** overclaim: Branch Zero is a hackathon bank **built on** the public Bloxchain stack — not “the official Particle / Bloxchain product.”
- **Particle CS** = company. **Bloxchain** = open protocol / platform. Keep them on **separate** panels.
- Wording class matches FXSponsor / ArcNotice / Name Desk service menus: **bank signs**, not marketing slogans or brand-mark collage.

## Composition (one prop, one job)

Single composed notice board (brass frame + paper/graphite panels + `Label3D` and/or one small SubViewport if useful). Suggested hierarchy readable in ~2 s from the entrance cam:

```text
┌─────────────────────────────────────┐
│  ETH Online 2026 · Branch Zero      │  header
│  Sep 4–16 · online                  │
├─────────────────────────────────────┤
│  Privy · ENS · Uniswap · Arc        │  featured strip (desk-aligned)
├──────────────────┬──────────────────┤
│  Bloxchain       │  Particle CS     │  protocol | company
│  open protocol   │  trust infra     │
│  for governed    │  for blockchain  │
│  accounts        │  (one line)      │
└──────────────────┴──────────────────┘
```

Copy must stay short enough to read at plaque sizes already used in `bank_interior.gd` (`size` ~0.15–0.28). Prefer `Label3D` / existing palette materials over imported sponsor logos (licence + art bible + web budget — WORLD-3D §1 / §6).

**v1 = static set dressing.** Optional later (out of this mission unless trivial): interactable that opens a URL in the shell. Do not invent new bridge methods for v1.

## Baseline (do not regress)

- U4 freeze, U4+ Priority, U5 ENS, practice faucet, U7 polish DoD, Terminal Console + OBSERVER, S1 FX, Live/Dev, Load Account, treasury code paths.
- U6 Arc stays **DEFERRED**. Elevator “coming soon” notice stays the Arc story beat.
- Runtime deps: `@bloxchain/sdk` + `viem` only. No keys/RPC in Godot.
- Do not wipe Remote EVM. No secrets in git.
- Performance: WORLD-3D §6 — prefer BoxMesh / existing palette / batch-friendly pieces; no new shadow lights; avoid a ninth OmniLight.

## Evidence / DoD

See kickoff DoD. Minimum:

- `:5173` walk: from entrance / lobby couches, the board is legible; SE corner no longer reads empty.
- Hierarchy visible in one still: event → partners → Bloxchain | Particle.
- Desk plaques and elevator Arc notice unchanged in meaning.
- Optional: one `viz_shots` entry (e.g. `partners_board`) if cheap; local `docs/progress/` note (gitignored).
- One REFLECTION decision row if a non-obvious framing choice was made (e.g. “Partners of this branch” vs “ETH Online booth”).

## Out of scope

- Ship packaging, DEMO-SCRIPT rewrite, sponsor feedback forms.
- Reviving Arc wing / U6.
- New NPCs, new zones, new bridge methods, click-out URL system (unless a one-liner reuse of an existing shell open already exists — prefer skip).
- Replacing desk-local sponsor teaching with this board alone.
- Importing trademark logo meshes/textures without a licence entry in `CREDITS.md`.
- Character-style climb, AO desk polish collisions — stay out of those files unless a shared plaque helper must move (prefer not).
- GameLab ENG trees, bloxchain.app SaaS edits, protocol Solidity.
