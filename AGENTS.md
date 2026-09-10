# AGENTS.md — Branch Zero

Briefing for **coding / ops agents** (Cursor, Claude Code, Codex, etc.) working in this product repo.
It is **not** the in-game service assistant’s context. Player-facing lore for the iNPC lives only under
[`docs/game-knowledge/`](./docs/game-knowledge/) — do not load this file (or the rest of `docs/`) into the robot.

**Public pitch:** [`README.md`](./README.md) · **Cold mission index:** [`docs/missions/HANDOFF-CC.md`](./docs/missions/HANDOFF-CC.md) · **Open work:** [`docs/OWED.md`](./docs/OWED.md)

---

## 1. What this is

Branch Zero is a walkable 3D bank (Godot + Vite/React shell) where every desk is a real smart-account step on
Bloxchain via the public **`@bloxchain/sdk`**. Honest theatre: boards and clocks are read from chain.

It is **not** GameLab (no `ENG-*` experiments here), **not** GameDevOS craft BoK, and **not** Bloxchain-protocol
core. Protocol semantics come from the published SDK and product docs — never invent lane / timelock / RBAC rules.

---

## 2. Before you act

1. Read [`docs/README.md`](./docs/README.md) start-here order (PLAN → DEV-LOOP → OWED → ARCHITECTURE → GAME-DESIGN).
2. Open the **topic doc** for the surface you are changing (`GODOT`, `PRIVY`, `ENS`, `INPC`, …).
3. If you are cold: prefer [`docs/missions/HANDOFF-CC.md`](./docs/missions/HANDOFF-CC.md) over chat memory.
4. Paste missions from [`docs/missions/`](./docs/missions/) (`HANDOFF-*` / `KICKOFF-*`) — do not invent scope.

---

## 3. Layout (where truth lives)

| Path | Role |
|------|------|
| `apps/game/` | Godot 4.5 — world, dialogue, HUD; `chain.gd` is the only JS bridge user |
| `apps/web/` | Vite shell, React overlay, `window.BranchZero` |
| `apps/teller-desk/` | Fastify desk — Privy, broadcaster, lanes, SSE |
| `packages/shared/` | Bridge types, chains, ABI fragments |
| `infra/` | Deployments / funding helpers |
| `docs/` | Product SoT for agents building here |
| `docs/game-knowledge/` | **iNPC-safe** curated pack only (bundled into `apps/web`) |

---

## 4. Commands (typical)

From repo root (see package scripts / `docs/DEV-LOOP.md` for the full set):

```bash
# Shell + desks (Live default Sepolia; Dev = Remote EVM 1337)
npm run dev          # Vite :5173 — needs matching teller desk(s)

# Godot web export into the shell
npm run export:web

# Headless / kill tests (names vary by surface)
npm run killtests:*  # e.g. load, treasury, s1, s2 — see docs for the lane you touch
```

Prefer Remote EVM (`1337`, Developer Mode) unless the question needs ENS, Uniswap, or Live Sepolia.

---

## 5. Hard stops

- No secrets in commits (`.env`, private keys, OpenRouter keys, Privy secrets).
- Public **`@bloxchain/sdk` + `viem`** only at product runtime — no custom Solidity, no unpublished path deps for runtime.
- Godot never holds keys or talks RPC — only `window.BranchZero` → Teller Desk.
- One wallet modal in the whole game (Account Opening).
- Everything the player sees about chain state is read from chain.
- Testnets + Remote EVM only — no mainnet.
- Do not weaken timelock, RBAC, whitelist, or session-signer policy to “make a demo easier.”
- **iNPC:** OpenRouter only (v1); player runtime key in `sessionStorage`; read/explain only; never product `.env` / `VITE_*` OpenRouter keys. See [`docs/INPC.md`](./docs/INPC.md).

---

## 6. iNPC vs coding agents (do not blur)

| | Coding agents (you) | In-game iNPC |
|--|---------------------|--------------|
| Entry | **This file** → `docs/` + missions | [`docs/game-knowledge/`](./docs/game-knowledge/) allowlist only |
| Live facts | Desk-debug, receipts, hashes OK in *your* tooling | Player-safe `GameState.inpc_snapshot()` only |
| Actions | You may change code under mission scope | Explains only — never pay / wire / release / stamp |

Teaching pack SoT: markdown under `docs/game-knowledge/` → imported by `apps/web/src/inpc/pack.ts` at build time.
The robot has **no tools and no repo/GitHub access** at runtime; those files are its hard source of truth, so anything
it must know about Bloxchain accounts is rewritten there in bank words. Do not teach it from `AGENTS.md`, `OWED`,
`SECURITY-AND-KEYS`, treasury, or **any `docs/missions/` handoff / kickoff** — the folder README carries the deny list.

---

## 7. Sibling repos (route, don’t absorb)

| Repo | When to go there |
|------|------------------|
| `Bloxchain-protocol` | Contract / SDK core changes |
| `GameLab` | Cheap isolated spikes (`ENG-*`) |
| `GameDevOS` | Engine-agnostic craft knowledge |
| `particle-tool-box` | Docker labs (Remote EVM, Console, …) |

---

## 8. How to ask the repo for help

Prefer NatSpec-free product docs and existing tests over guessing. Unclear protocol semantics → ask a human;
do not invent AccountBlox / Privy / ENS behaviour.
