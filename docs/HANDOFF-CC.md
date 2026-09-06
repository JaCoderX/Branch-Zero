---
type: handoff
title: Handoff — Claude Code / Fable 5.1
audience: cold agent
created: 2026-09-06
updated: 2026-09-06
product: Branch-Zero
objective: OBJ-2026-0004
first_mission: U2 Timelock lane (G3)
prior_mission: U1 Signing lane (G2) — met 2026-09-06
---

# Handoff — Claude Code (Fable 5.1)

You are a **cold agent** unless the human says you are continuing a prior session. Prefer reading this file over chat memory. You have **freedom on how**. You do **not** have freedom on constraints, scope, or protocol semantics.

**Current mission: U2 Timelock lane (G3)** — wire → PENDING → approve/cancel, SSE, `releaseTime` read from
chain. Do not start U3–U7.

> **U1 met 2026-09-06.** K2, K5 and K8 all PASS; Lane A moves demo USDC on Remote EVM 1337 with the player's
> Privy session signer and no browser in the loop. Read
> [`docs/progress/2026-09-06-u1-signing-lane.md`](./progress/2026-09-06-u1-signing-lane.md) before anything
> else — it carries the findings that will otherwise cost you an afternoon (role permissions on the execution
> selector, `deadline` being a duration, the 99.2 %-of-a-block clone, Privy's BigInt/JSON and wallet-ownership
> rules). One human step is still outstanding: completing an email-OTP login in the overlay to see the single
> consent modal end to end.

---

## 0. Product (one paragraph)

**Branch Zero** — walkable 3D bank (Godot 4.5 GDScript, single-thread web) whose desks are real **Bloxchain** smart-account operations, driven only through public **`@bloxchain/sdk`** (+ viem). Privy = one wallet modal. Teller = broadcaster. Vault clock = on-chain timelock. ETHOnline 2026, Start Fresh.

Not: a wallet UI, DeFi protocol, Bloxchain fork, mainnet, Tactical-AI, GameLab merge target.

---

## 1. Repos

| Role | Path | GitHub |
|------|------|--------|
| **Product** | `D:\My Git Projects\D9-Studio\Branch-Zero` | https://github.com/JaCoderX/Branch-Zero |
| **Craft** | `D:\My Git Projects\D9-Studio\GameDevOS` | https://github.com/D9-Studio/GameDevOS |
| **Lab** | `D:\My Git Projects\D9-Studio\GameLab` | https://github.com/D9-Studio/GameLab |
| **Remote EVM** | `D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM` | consume only |
| **Protocol (reference / CopyBlox scripts)** | `D:\My Git Projects\ParticleCS\Bloxchain-protocol` | **do not path-depend**; may run its deploy/create-wallet scripts **out of band** for bootstrap |

---

## 2. Read order (before code)

1. **This file**
2. [`docs/DEV-LOOP.md`](./DEV-LOOP.md) — U1 row
3. [`docs/REMOTE-EVM.md`](./REMOTE-EVM.md) — **do not wipe**; ~20M gas
4. [`docs/PRIVY.md`](./PRIVY.md)
5. [`docs/BLOXCHAIN-INTEGRATION.md`](./BLOXCHAIN-INTEGRATION.md) — SDK-only; CopyBlox provision
6. [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §1–3, §5–6
7. [`docs/SECURITY-AND-KEYS.md`](./SECURITY-AND-KEYS.md)
8. [`docs/REFLECTION.md`](./REFLECTION.md) — kill log + principal decisions
9. [`docs/progress/2026-09-06-u0-foundation.md`](./progress/2026-09-06-u0-foundation.md) — what already works
10. GameLab [ENG-2026-0004](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0004-privy-typed-data-signer/README.md)
11. Craft lessons (already filed — do not re-author):  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/sdk-runtime-factory-clones.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/verify-published-package-artifacts.md

GitHub mirrors under `https://github.com/JaCoderX/Branch-Zero/blob/main/docs/…`.

---

## 3. Hard constraints (non-negotiable)

1. **Runtime dependency = `@bloxchain/sdk` + `viem` only.** Do **not** add or deepen `@bloxchain/contracts`. Do **not** run `chain:compile` / in-repo solc as the product path.
2. Derive behaviour from SDK types + public Bloxchain docs. Mark unknowns `VERIFY`.
3. Godot 4.5 GDScript, web, **threads OFF**. No keys / no RPC in Godot. No `JavaScriptBridge.eval`.
4. **One wallet modal** (Account Opening). Second modal = bug unless K2 client-side fallback is chosen and logged.
5. **Remote EVM first** (`1337`, `http://127.0.0.1:8545`). **Do not** `docker compose down -v` or wipe volumes. Live block gas limit is **16,777,216** (measured in U1; the earlier "≈20M" is retracted) — design under it, and note `cloneBlox` already uses 99.2 % of a block.
6. Keep existing `infra/deployments/remote-evm.json` AccountBlox as the **lab fixture**. New players: prefer **CopyBlox.cloneBlox** (protocol `npm run create-wallet` pattern) once CopyBlox is on-chain; if CopyBlox is not deployed yet, you may deploy **CopyBlox only** (no foundation wipe) or use the fixture owner for K2 — document which.
7. Never use Ganache-parity keys on public nets. No secrets in git.
8. Never merge GameLab ENG trees into this repo.
9. Do not invent custom Solidity.

EIP-712 domain name from SDK: **`Bloxchain`** (`META_TX_DOMAIN`).

---

## 4. U0 already done (do not redo)

- Scaffold: `apps/game`, `apps/web`, `apps/teller-desk`, `packages/shared`, `infra/`
- K1 PASS — Godot 4.5.2 ↔ `window.BranchZero`
- K4 fixture — AccountBlox on 1337; SDK `owner()` matches
- Teller Desk stub `/healthz`
- See progress note for re-run commands

## 4b. U1 already done (do not redo)

- `npm run chain:bootstrap` — CopyBlox `0x7C728214be9A0049e6a86f2137ec61030D0AA964`, demo ERC-20 `dUSDC`
  `0x5017A545b09ab9a30499DE7F431DF0855bCb7275`
- Teller Desk U1: `/session`, `/provision`, `/pay`, `/status`, `/events` (SSE), `/healthz`
- Privy session signer adapter + per-player policy (K2, K5); React overlay with login, one consent, revoke
- Lane A green: `requestAndApproveExecution` moving demo USDC
- `npm -w apps/teller-desk run killtests -- --fresh` re-runs K2 / K5 / Lane A

---

## 5. Mission U1 — Signing lane (G2) — **MET 2026-09-06**

Kept as the record of what G2 required and how it was answered. The next mission is §5b.

### Freedom envelope

- Privy React overlay shape inside `apps/web`
- Fastify route layout for `/session`, `/pay`, SSE stages
- Whether K2 is proven on Remote EVM 1337 (if Privy allows custom chain) or Sepolia
- Whether ENG-0004 scripts live briefly in GameLab or only in `apps/teller-desk` (prefer product; still fill ENG findings)

### Out of scope

- Greybox bank / NPCs / ENS / Arc / Uniswap / U2 timelock UI polish beyond what’s needed to prove Lane A
- Wiping Remote EVM
- Reintroducing `@bloxchain/contracts` compile pipeline
- Deepening `infra/scripts/compile.ts` (leave as historical; do not call it from default npm scripts for U1)

### Definition of Done (G2) — all met

- [x] Privy env filled locally (`PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_KEY`, `PRIVY_SIGNER_ID`, `VITE_PRIVY_APP_ID`, `VITE_PRIVY_SIGNER_ID`). `PRIVY_POLICY_ID` turned out to be unnecessary: policies are minted **per player** via the API.
- [x] Login + embedded wallet in the React overlay; session signer delegated once at Account Opening (`apps/web/src/overlay/useBranchZeroWallet.ts`). *Caveat: the modal was verified to open over the Godot canvas; completing the email OTP needs a human — see the progress note's "Blockers".*
- [x] Teller Desk requests `eth_signTypedData_v4` for a Bloxchain meta-tx; **recover == owner** — **K2 PASS**
- [x] Policy denies out-of-scope typed data — **K5 PASS** (`verifyingContract` + `chainId`; `domain.name` is not a matchable field, documented)
- [x] Lane A: unsigned meta-tx via SDK → session-signer signature → `requestAndApproveExecution` from the broadcaster, moving demo USDC on 1337
- [x] After delegation: no second wallet modal — the signature is obtained server-side with no browser in the loop at all
- [x] `docs/REFLECTION.md` kill log (K2, K5, K8) + `docs/progress/2026-09-06-u1-signing-lane.md`
- [x] ENG-2026-0004 `findings.md` and `handoff.md` filled

### Suggested sequence

1. Confirm Remote EVM up; **do not wipe**.
2. Confirm Privy dashboard: origins include `http://localhost:5173`; embedded wallet on login; server-side access + auth key; policy (domain `Bloxchain` / verifyingContract or method-only).
3. Wire overlay + Teller Desk session + signer adapter.
4. K2 against fixture AccountBlox (or CopyBlox clone).
5. Guard whitelist for transfer target if not already set; Lane A smoke.
6. Log kill tests. Stop.

---

## 5b. Next mission — U2 Timelock lane (G3)

Scope and gate are already defined; do not re-derive them:

- [`docs/DEV-LOOP.md`](./DEV-LOOP.md) §3 — U2 row
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §3.3 — Lane B sequence and the three request options (option 1,
  owner sends via session-signer `eth_sendTransaction`, is marked preferred; V6 is still unverified)
- [`docs/BLOXCHAIN-INTEGRATION.md`](./BLOXCHAIN-INTEGRATION.md) §6 — request / countdown / approve / cancel

What U1 leaves you: a working signing lane, a provisioner, SSE stage events, and `/wire` `/approve` `/cancel`
answering `501 { plannedUnit: 'U2' }` so the routes already exist to fill in. Expect the U1 finding about role
permissions to repeat: `executeWithTimeLock` will need `EXECUTE_TIME_DELAY_REQUEST` on the transfer selector,
and the approve/cancel meta handlers their own grants — extend the role config batch in
`apps/teller-desk/src/lanes/provision.ts` rather than adding a second one.

## 6. After U1

| Next | Gate |
|------|------|
| U2 Timelock lane | G3 |
| U3 Greybox | G4 |

Cut order unchanged: Uniswap → Manager → Arc → ENS EAC → ENS mint. **Never cut Privy or Lane B.**

---

## 7. Stop conditions

- Need custom Solidity or path-dep on Bloxchain-protocol for runtime
- Would wipe Remote EVM or re-add contracts compile as default
- Scope drifts to greybox/ENS/Arc
- K2 fails and PLAN fallback not chosen

Leave: commands, file pointers, kill-test log, next agent can resume from G2 checklist.
