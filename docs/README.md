# Branch Zero — Documentation

A walkable 3D bank (Godot) where every desk is a real operation on a Bloxchain-governed smart account, built for [ETHOnline 2026](https://ethglobal.com/events/ethonline2026).

Start with **[PLAN.md](./PLAN.md)**. Read order for a new contributor:

| # | Doc | Read when |
|---|-----|-----------|
| 1 | [PLAN.md](./PLAN.md) | Always first — scope, 10-day schedule, gates, kill tests, submission |
| 1b | [DEV-LOOP.md](./DEV-LOOP.md) | OBJ / ENG / U0–U7; when to lab vs when to build here |
| 1c | [REMOTE-EVM.md](./REMOTE-EVM.md) | Local chain `1337` — default for development |
| 2 | [GAME-DESIGN.md](./GAME-DESIGN.md) | Before touching gameplay, dialogue or HUD |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Before touching any code — layers, bridge, sequences, repo layout |
| 4 | [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) | Before touching the Teller Desk or provisioning — public SDK usage only |
| 5 | [GODOT.md](./GODOT.md) | Before opening the Godot project — export settings, `Chain.gd` bridge contract |
| 6 | [WORLD-3D-ENVIRONMENT.md](./WORLD-3D-ENVIRONMENT.md) | Before modelling or laying out zones |
| 7 | [NPCS.md](./NPCS.md) | Before writing dialogue or NPC logic |
| 8 | [PRIVY.md](./PRIVY.md) | Account Opening desk — login, embedded wallet, session signer, policy |
| 9 | [ENS.md](./ENS.md) | Name Desk — ENSv2 subnames, records, Enhanced Access Control |
| 10 | [ARC.md](./ARC.md) | Arc wing — network facts, bounties; **§5b deferred revive checklist** (G7 parked) |
| 11 | [UNISWAP.md](./UNISWAP.md) | FX Desk — stretch / swap-in only |
| 12 | [SECURITY-AND-KEYS.md](./SECURITY-AND-KEYS.md) | Before handling any key or env var |
| 13 | [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) | Day 9–10 — video storyboard, submission checklist |
| 14 | [REFLECTION.md](./REFLECTION.md) | When a decision feels wrong — design review, sponsor matrix, kill-test log, open questions |
| 15 | [TERMINAL-CONSOLE.md](./TERMINAL-CONSOLE.md) | Stretch — bank computer iframe of bloxchain.app + OBSERVER view role (Privy↔SaaS parked) |

**Not published** (gitignored; stay on the laptop): `docs/progress/` (daily notes + captures). Kickoffs and `HANDOFF-CC.md` stay in git for cold agents.

## Conventions used across the docs

- `VERIFY` — a fact we have not yet confirmed against the live network / package. Each has a kill test or an open question in [REFLECTION.md](./REFLECTION.md).
- **Lane A / Lane B** — routine payment (`requestAndApproveExecution`, immediate) / time-locked wire (`executeWithTimeLock` → approve or cancel).
- **MVP / T1–T3 / S1–S2** — scope ladder tiers from [PLAN.md](./PLAN.md) § 3.
- **K1–K8** — kill tests; **G1–G10** — PLAN gates; **U0–U7** — construction units in [DEV-LOOP.md](./DEV-LOOP.md).
- Language: **everyday bank words** on screen; **protocol jargon** only in "Ask why" and receipts; **implementation detail** only in docs/README.

## Hard rules

1. Only the public `@bloxchain/sdk` (+ `viem`). No `@bloxchain/contracts` in this product. No custom Solidity, no unpublished deps, no path deps for runtime.
2. Godot never holds keys or talks to a chain; everything goes through `window.BranchZero` → Teller Desk.
3. One wallet modal in the whole game (Account Opening). If a second appears, it is a bug or a documented fallback.
4. Everything the player sees about chain state is read from chain.
5. Testnets + Remote EVM only. No mainnet. Develop against Remote EVM (`1337`, ~20M gas, **no wipe**) when the question is not ENS / Uniswap / Arc.
