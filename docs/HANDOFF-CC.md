---
type: handoff
title: Handoff — Claude Code / Fable 5.1
audience: cold agent
created: 2026-09-06
updated: 2026-09-06
product: Branch-Zero
objective: OBJ-2026-0004
first_mission: U0 Foundation (G1)
---

# Handoff — Claude Code (Fable 5.1)

You are a **cold agent**. You have not seen the prior chat. This file is the brief. Read it, then follow the **read order**, then execute **Mission U0** only.

You are running in **Claude Code** with a strong model. You have **freedom on how**. You do **not** have freedom on constraints, scope, or protocol semantics.

---

## 0. What you are building (one paragraph)

**Branch Zero** is a walkable 3D bank in **Godot 4.5 GDScript**, exported to **web (single-threaded)**, where every desk is a real operation on a **Bloxchain** smart account (`AccountBlox`) driven **only** through the public npm packages `@bloxchain/sdk` and `@bloxchain/contracts`. The player logs in once with **Privy**; afterwards a teller stamps slips (EIP-712 meta-transactions). Large wires go through a vault whose clock **is** the on-chain timelock. Identity is **ENSv2** on Sepolia. A second wing is **Arc Testnet**. Event: ETHOnline 2026, track Start Fresh, **~10 days**.

It is **not** a wallet UI, not a DeFi protocol, not a fork of Bloxchain, not mainnet, not Tactical-AI, not a GameLab merge target.

---

## 1. Repos you must know (three + one infra)

| Role | Local path (Windows) | GitHub | You write here? |
|------|----------------------|--------|-----------------|
| **Product (SoT for code)** | `D:\My Git Projects\D9-Studio\Branch-Zero` | https://github.com/JaCoderX/Branch-Zero | **Yes — all construction** |
| **Craft (method, OBJ)** | `D:\My Git Projects\D9-Studio\GameDevOS` | https://github.com/D9-Studio/GameDevOS | Lessons + logs only; **no game code** |
| **Lab (one-question spikes)** | `D:\My Git Projects\D9-Studio\GameLab` | https://github.com/D9-Studio/GameLab | **Yes — only inside `work/ENG-…/`** |
| **Remote EVM (private chain)** | `D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM` | (internal particle-tool-box) | **No** — consume it. Do not modify unless RPC is down and the principal asks |

Bloxchain protocol source (`D:\My Git Projects\ParticleCS\Bloxchain-protocol`) is a **reference for reading published behaviour**, not a dependency. **Do not** path-depend it. **Do not** copy Solidity into Branch Zero.

If a sibling repo is not cloned, use the GitHub URLs in this file. Product work still lands only in Branch-Zero.

---

## 2. Read order (do this before writing code)

Read in this order. Do not skim PLAN and then invent a different architecture.

### 2.1 Product (Branch Zero) — required

| # | File | Why |
|---|------|-----|
| 1 | **This file** | Mission, constraints, DoD |
| 2 | [`docs/DEV-LOOP.md`](./DEV-LOOP.md) | How craft/lab/product split; construction units U0–U7 |
| 3 | [`docs/REMOTE-EVM.md`](./REMOTE-EVM.md) | Default local chain `1337`; when to touch Sepolia |
| 4 | [`docs/PLAN.md`](./PLAN.md) | Scope ladder, 10-day schedule, kill tests, gates G1–G10 |
| 5 | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | Three runtimes, sequences, `window.BranchZero`, repo layout |
| 6 | [`docs/BLOXCHAIN-INTEGRATION.md`](./BLOXCHAIN-INTEGRATION.md) | Public SDK only; provision; lanes A/B |
| 7 | [`docs/GODOT.md`](./GODOT.md) | 4.5, single-thread, `Chain.gd`, no eval |
| 8 | [`docs/SECURITY-AND-KEYS.md`](./SECURITY-AND-KEYS.md) | Keys, env, threat model |
| 9 | [`docs/REFLECTION.md`](./REFLECTION.md) | Honest invariants, sponsor matrix, **kill-test log to fill** |
| 10 | [`docs/GAME-DESIGN.md`](./GAME-DESIGN.md) | Pillars + protocol-to-game table (do not implement greybox in U0) |

GitHub equivalents (same paths under `https://github.com/JaCoderX/Branch-Zero/blob/main/`):

- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REMOTE-EVM.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/PLAN.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ARCHITECTURE.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/BLOXCHAIN-INTEGRATION.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SECURITY-AND-KEYS.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md
- https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GAME-DESIGN.md

### 2.2 Product — later units (do not implement in U0)

[`docs/PRIVY.md`](./PRIVY.md) · [`docs/ENS.md`](./ENS.md) · [`docs/ARC.md`](./ARC.md) · [`docs/UNISWAP.md`](./UNISWAP.md) · [`docs/NPCS.md`](./NPCS.md) · [`docs/WORLD-3D-ENVIRONMENT.md`](./WORLD-3D-ENVIRONMENT.md) · [`docs/DEMO-SCRIPT.md`](./DEMO-SCRIPT.md)

### 2.3 Craft + lab (required orientation, light)

| File | Why |
|------|-----|
| https://github.com/D9-Studio/GameDevOS/blob/main/objectives/OBJ-2026-0004-walkable-governed-account-ux/objective.md | Craft learning contract |
| https://github.com/D9-Studio/GameDevOS/blob/main/AGENTS.md | Craft never runs engines |
| https://github.com/D9-Studio/GameLab/blob/main/AGENTS.md | One question per ENG; never merge ENG → product |
| https://github.com/D9-Studio/GameLab/blob/main/docs/ENGAGEMENT.md | open → run → find → handoff rewrite |
| https://github.com/D9-Studio/GameLab/blob/main/work/index.md | ENG-0003…0008 |

Local:

- `D:\My Git Projects\D9-Studio\GameDevOS\objectives\OBJ-2026-0004-walkable-governed-account-ux\objective.md`
- `D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0003-godot-web-js-bridge\README.md`
- `D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0005-accountblox-on-remote-evm\README.md`

### 2.4 Remote EVM operator docs

- `D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM\README.md`
- `D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM\docker-compose.yml`

---

## 3. Hard constraints (non-negotiable)

1. **Public Bloxchain only.** `@bloxchain/sdk` and `@bloxchain/contracts` from npm. No unpublished packages, no `file:` / path deps to Bloxchain-protocol, no copied protocol Solidity, no new contracts.
2. **Derive protocol behaviour from public SDK types + Bloxchain public docs.** If unknown, mark `VERIFY` and add/use a kill test. Do not invent semantics.
3. **Godot 4.5.x GDScript, Web export, threads OFF.** C# is not supported on Godot 4 web. Do not use the GameLab 4.7.1-mono pin for this product.
4. **Godot never holds keys and never talks to an RPC.** All chain I/O: GDScript → `window.BranchZero` → TypeScript bridge / Teller Desk.
5. **No `JavaScriptBridge.eval`.** `get_interface` + JSON + `create_callback` only.
6. **One wallet modal** in the whole game (Account Opening). A second modal is a bug unless K2 fallback is explicitly chosen and documented.
7. **Testnets + Remote EVM only.** No mainnet.
8. **Remote EVM first.** Local/dev execution = chain id `1337` at `http://127.0.0.1:8545` (or Tailscale Serve). Sepolia/Arc only for sponsor proofs, ENS, or when the question cannot be answered locally (ENS, Uniswap, Arc EVM compat).
9. **Never use Remote EVM / Ganache-parity private keys on a public network.**
10. **Secrets:** `.env` gitignored; `.env.example` only; no keys in logs or `deployments/*.json` (addresses only).
11. **Lab isolation:** GameLab work stays in `work/ENG-YYYY-NNNN-slug/`. Copy proven patterns into Branch Zero. **Never merge an ENG tree into the product.**
12. **Do not mint** `SPEC-*`, `IDEA-*`, or mutate other products' IDs. Branch Zero construction units are `U0`–`U7` in `docs/DEV-LOOP.md`.
13. **Do not weaken** timelock, RBAC, whitelist, or meta-tx verification to "make the demo easier."
14. **Custom errors / CEI / no constructors on upgradeable accounts** — inherit from published `AccountBlox`; don't "fix" the protocol.

Everyday bank words on screen later; U0 may use technical logs.

---

## 4. Architecture you will implement toward (do not redesign)

Three runtimes, from [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md):

```text
Browser:  Godot Web (GDScript)  ←JavaScriptBridge→  window.BranchZero (TS + viem + SDK reads)
                                                      ↓ HTTPS + SSE
Node:     Teller Desk (Fastify) — Privy session-signer requests + broadcaster key
Chain:    AccountBlox per player — Remote EVM (dev) / Sepolia (primary public) / Arc (wing)
```

Target layout (create in U0 as far as the mission needs):

```text
Branch-Zero/
  apps/game/          Godot 4.5 project
  apps/web/           Vite shell + React overlay + bridge
  apps/teller-desk/   Node service (may be a stub in U0)
  packages/shared/    chain configs, zod, constants
  infra/scripts/      deploy from @bloxchain/contracts artifacts
  infra/deployments/  addresses only
  docs/
```

PLAN also mentioned `apps/bridge`; ARCHITECTURE folded the bridge into `apps/web`. **Follow ARCHITECTURE:** bridge lives in `apps/web`. If you split a package, say why in `docs/REFLECTION.md`.

---

## 5. Lab vs product (how you are allowed to spike)

| Unknown / kill test | Where to run | Then |
|---------------------|--------------|------|
| K1 / K8 Godot web ↔ JS | GameLab **ENG-2026-0003** *or* directly in `apps/game` if faster | Copy pattern into product; fill ENG findings if you opened the ENG |
| K4 local AccountBlox | GameLab **ENG-2026-0005** *or* `infra/scripts` in product | Same — product must end with a re-runnable script |
| K2 / K5 Privy | **ENG-2026-0004** — **not U0** | After U0 |
| K3 Arc | **ENG-2026-0006** — not U0 | After G5 |
| K6 ENS | **ENG-2026-0007** — not U0 | Needs a Sepolia name |
| K7 Uniswap | **ENG-2026-0008** — **do not start** | Until S1 |

**Preference:** if a spike is clearly the product scaffold, build it in Branch Zero and still **log the kill test** in `docs/REFLECTION.md`. Open an ENG when the experiment is throwaway or might pollute the product tree.

Fill ENG `findings.md` when you answer that ENG's question. Write ENG `handoff.md` before copying into product.

---

## 6. Mission U0 — Foundation (this session)

**One mission:** Establish a runnable foundation and settle Day-1 kill tests so later sessions only build gameplay on proven rails.

### 6.1 Freedom envelope (you choose how)

- npm workspaces vs pnpm vs bun — prefer **npm workspaces** unless you have a strong reason (document it).
- Fastify vs a thinner HTTP server for Teller Desk stub.
- Direct `deployContract` + immediate `initialize` vs clone factory **if** the public artifacts include it.
- Whether K1 is proven in GameLab ENG-0003 or in `apps/game` first.
- Exact folder names **inside** the apps listed above.
- Cube scene, CLI smoke scripts, README run instructions.

### 6.2 Out of scope (do not do)

- Full Privy session-signer production path (U1 / G2)
- Greybox bank, NPCs, dialogue, ledger board art
- ENS, Arc wing, Uniswap
- Demo video, sponsor forms
- Custom Solidity
- Changing GameDevOS wiki craft pages except appending `log.md` if you closed an ENG with a scrub-worthy lesson (unlikely in U0)

### 6.3 Definition of Done (G1)

Check all:

- [ ] Repo scaffold exists: `apps/game`, `apps/web`, `apps/teller-desk` (may be stub), `packages/shared`, `infra/scripts`, `infra/deployments`
- [ ] Godot **4.5** project; web export preset **thread support off**
- [ ] Browser: Godot canvas + JS round-trip (K1). Document the command to serve it
- [ ] `@bloxchain/sdk` (and `@bloxchain/contracts` as needed) installed from **npm**
- [ ] Remote EVM reachable; script deploys or attaches `AccountBlox` on **1337** and reads `owner()` (K4 local / ENG-0005)
- [ ] `infra/deployments/remote-evm.json` committed with **addresses only**
- [ ] `.env.example` for RPCs and key **names**; no real keys
- [ ] Root `README.md`: one-line pitch + how to run web shell + how to point at Remote EVM
- [ ] `docs/REFLECTION.md` kill-test log: **K1** and **K4** filled (pass/fail/fallback). K2/K3/K5 may stay pending with the next human action named
- [ ] If you opened ENGs: `findings.md` started; GameLab `work/index.md` unchanged unless you close one
- [ ] `docs/progress/` note: what ran, commands, blockers (text is enough if capture is awkward)

### 6.4 Suggested sequence (not a script — deviate if faster)

1. Confirm Remote EVM: `curl` `eth_chainId` → `0x539`. If down, start compose in particle-tool-box Remote EVM folder (`docker compose up -d`). See [`REMOTE-EVM.md`](./REMOTE-EVM.md).
2. Scaffold workspaces + `.gitignore` (node, `.env`, Godot `.godot/`, `*.pck`).
3. K1: smallest Godot web export + `window.BranchZero` echo.
4. K4: deploy script against 1337 using package artifacts. Inspect `@bloxchain/contracts` for artifact paths (`VERIFY` in BLOXCHAIN doc).
5. Wire `packages/shared` chain config `remoteEvm` (`id: 1337`).
6. Log kill tests. Stop.

If Godot 4.5 is not installed, **name the blocker** and still finish the TS/deploy half. Do not silently switch to 4.7.1-mono.

If Remote EVM is not running and Docker is unavailable, **name the blocker**; do not spend the session on Sepolia unless the principal already provided a Sepolia RPC and a funded key.

---

## 7. After U0 (do not start unless G1 is green and the human says so)

| Next | Gate | Docs |
|------|------|------|
| U1 Signing lane | G2 | PRIVY.md, BLOXCHAIN-INTEGRATION.md, ENG-0004 |
| U2 Timelock lane | G3 | ARCHITECTURE §3.3 |
| U3 Greybox bank | G4 | WORLD, NPCS, GAME-DESIGN |
| U4 MVP freeze | G5 | DEMO-SCRIPT |

Cut order if time dies: Uniswap → Manager runtime role → Arc → ENS EAC → ENS mint. **Never cut Privy or Lane B.**

---

## 8. Language and honesty

- Copy: "one pop-up" not "zero pop-ups" (delegation at Account Opening).
- Lane B amount routing is **off-chain** policy. Do not claim the vault is the only on-chain path for large amounts (`REFLECTION.md` §2.2).
- Bloxchain is an open-source dependency, not "our protocol" in judge copy.

---

## 9. Human / principal remaining

These are **not yours to fake**:

1. Privy app + authorization key (U1)
2. Sepolia `.eth` parent registration (start Day 1, wait is real) — producer
3. Funded Sepolia/Arc keys when leaving Remote EVM
4. Team size (assume solo if unknown)

---

## 10. Stop conditions

Stop and report if:

- You would need custom Solidity or a local Bloxchain path dep to continue
- K1 fails and the PLAN fallback is not chosen
- Remote EVM rejects `AccountBlox` bytecode and Anvil/Sepolia is not authorized
- Scope is drifting into U1–U7

When you stop, leave: commands, file pointers, kill-test log, and the next agent can resume from G1 incomplete checklist above.
