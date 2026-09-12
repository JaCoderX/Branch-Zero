# Branch Zero — Documentation

Product docs for the walkable 3D bank built for [ETHOnline 2026](https://ethglobal.com/events/ethonline2026).

| | |
|--|--|
| **Public pitch** | Root [`README.md`](../README.md) · screenshots in [`media/readme/`](./media/readme/) |
| **Agent entry** | Root [`AGENTS.md`](../AGENTS.md) — coding / ops briefing (not the in-game iNPC) |
| **What’s open** | [`OWED.md`](./OWED.md) |
| **Cold agent start** | [`missions/HANDOFF-CC.md`](./missions/HANDOFF-CC.md) |
| **Mission briefs** | [`missions/`](./missions/) — all `HANDOFF-*` / `KICKOFF-*` |
| **iNPC knowledge** | [`game-knowledge/`](./game-knowledge/) — player-safe pack allowlist only |

---

## Start here

| Order | Doc | Why |
|------:|-----|-----|
| 1 | [PLAN.md](./PLAN.md) | Scope, gates, kill tests, submission |
| 2 | [DEV-LOOP.md](./DEV-LOOP.md) | U0–U7 units; craft vs lab vs build-here |
| 3 | [OWED.md](./OWED.md) | Living checklist — walks, packaging, parked work |
| 4 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers, bridge, trust boundaries — before code |
| 5 | [GAME-DESIGN.md](./GAME-DESIGN.md) | Player fantasy, loop, protocol ↔ desk map |

Then open the topic doc that matches the surface you are changing.

---

## Product docs

### Design & world

| Doc | Use when |
|-----|----------|
| [GAME-DESIGN.md](./GAME-DESIGN.md) | Gameplay, HUD, tutorial errands |
| [NPCS.md](./NPCS.md) | Staff roster, dialogue, on-chain roles |
| [INPC.md](./INPC.md) | Optional intelligent NPC (OpenRouter) — lab learnings + locks |
| [game-knowledge/](./game-knowledge/) | iNPC-safe teaching pack SoT (bundled into `apps/web`) |
| [WORLD-3D-ENVIRONMENT.md](./WORLD-3D-ENVIRONMENT.md) | Zones, layout, art direction, perf budget |
| [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) | Demo video storyboard and submission checklist |

### Build & integration

| Doc | Use when |
|-----|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System overview, sequences, repo layout |
| [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) | Public `@bloxchain/sdk` only — provision, lanes, guards |
| [GODOT.md](./GODOT.md) | Engine, web export, `window.BranchZero` bridge |
| [SECURITY-AND-KEYS.md](./SECURITY-AND-KEYS.md) | Keys, env, threat model |
| [REFLECTION.md](./REFLECTION.md) | Design review, sponsor matrix, kill-test log |

### Sponsor desks

| Doc | Desk / surface |
|-----|----------------|
| [PRIVY.md](./PRIVY.md) | Account Opening — embedded wallet, session signer, policy |
| [ENS.md](./ENS.md) | Name Desk — ENSv2 subnames, records, EAC |
| [UNISWAP.md](./UNISWAP.md) | FX Desk — Uniswap v4 practice USD → EUR \| ILS |
| [ARC.md](./ARC.md) | Arc wing — deferred (G7); revive checklist in §5b |
| [TERMINAL-CONSOLE.md](./TERMINAL-CONSOLE.md) | Lobby Console + OBSERVER view role |

### Chains & ops

| Doc | Use when |
|-----|----------|
| [SEPOLIA-LIVE.md](./SEPOLIA-LIVE.md) | Live Main = Sepolia; Remote EVM = Developer Mode |
| [HOSTING.md](./HOSTING.md) | Pages + lean `/game/` + Docker desk (`desk.branchzero.app`) preferred public URL; §4 compose self-host twin; private desk via `?desk=` |
| [REMOTE-EVM.md](./REMOTE-EVM.md) | Lab chain `1337` |
| [SEPOLIA-TREASURY.md](./SEPOLIA-TREASURY.md) | Ops treasury, staff top-ups |
| [LOAD-ACCOUNT.md](./LOAD-ACCOUNT.md) | Iris loads an owned AccountBlox by address |

---

## Missions

Paste-ready agent packets live under **[`missions/`](./missions/)**:

- `HANDOFF-*.md` — outcome / status for the next session  
- `KICKOFF-*.md` — mission block to paste into a new agent  
- [`HANDOFF-CC.md`](./missions/HANDOFF-CC.md) — cold-start index (freeze, open lanes, next mission)

Do not re-list every brief here. Track open work in [`OWED.md`](./OWED.md); start cold agents from `HANDOFF-CC`.

**Not published** (gitignored): `docs/progress/` — daily notes and capture dumps stay on the laptop.

---

## Conventions

| Term | Meaning |
|------|---------|
| `VERIFY` | Not yet confirmed on live net / package — has a kill test or open question in [REFLECTION.md](./REFLECTION.md) |
| **Lane A / Lane B** | Instant payment vs time-locked wire |
| **MVP / T1–T3 / S1–S2** | Scope ladder from [PLAN.md](./PLAN.md) |
| **K1–K8 / G1–G10 / U0–U7** | Kill tests · PLAN gates · construction units ([DEV-LOOP.md](./DEV-LOOP.md)) |

**Language:** everyday bank words on screen; protocol jargon only in “Ask why” and receipt fine print; implementation detail stays in these docs.

---

## Hard rules

1. Public **`@bloxchain/sdk` + `viem`** only at product runtime. No custom Solidity, no unpublished deps, no path deps for runtime.
2. Godot never holds keys or talks RPC — everything goes through `window.BranchZero` → Teller Desk.
3. One wallet modal in the whole game (Account Opening). A second modal is a bug or a documented fallback.
4. Everything the player sees about chain state is read from chain.
5. Testnets + Remote EVM only — no mainnet. Prefer Remote EVM (`1337`, **no wipe**) unless the question needs ENS, Uniswap, or Arc.
