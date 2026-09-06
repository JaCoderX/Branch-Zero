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

> **U1 met 2026-09-06.** K2, K5 and K8 PASS; Lane A green on Remote EVM 1337. **Human overlay path
> also verified** (email OTP → consent → provision → Pay, 500→487.5 dUSDC, no second modal). Read
> [`docs/progress/2026-09-06-u1-signing-lane.md`](./progress/2026-09-06-u1-signing-lane.md) and
> [`docs/progress/2026-09-06-u1-human-path.md`](./progress/2026-09-06-u1-human-path.md) before coding.
> Pasteable kickoff: [`docs/KICKOFF-U2.md`](./KICKOFF-U2.md).

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
2. [`docs/KICKOFF-U2.md`](./KICKOFF-U2.md) — pasteable cold kickoff
3. [`docs/DEV-LOOP.md`](./DEV-LOOP.md) — U2 row
4. [`docs/REMOTE-EVM.md`](./REMOTE-EVM.md) — **do not wipe**; gasLimit **16,777,216**
5. [`docs/BLOXCHAIN-INTEGRATION.md`](./BLOXCHAIN-INTEGRATION.md) §6–7 — Lane B + roles
6. [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §1–3, §5–6 (esp. §3.3 Lane B options)
7. [`docs/PRIVY.md`](./PRIVY.md) — session signer; optional `eth_sendTransaction` policy for V6
8. [`docs/SECURITY-AND-KEYS.md`](./SECURITY-AND-KEYS.md)
9. [`docs/REFLECTION.md`](./REFLECTION.md) — kill log + principal decisions
10. [`docs/progress/2026-09-06-u1-signing-lane.md`](./progress/2026-09-06-u1-signing-lane.md)
11. [`docs/progress/2026-09-06-u1-human-path.md`](./progress/2026-09-06-u1-human-path.md)
12. Craft lessons (do not re-author):  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/sdk-runtime-factory-clones.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/delegated-signing-consent-belongs-to-the-key-owner.md

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
- Human overlay path verified (OTP → Pay); overlay `refreshSession` after provision (Pay no longer hidden)

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
- [x] Login + embedded wallet in the React overlay; session signer delegated once at Account Opening. **Human OTP path verified 2026-09-06 evening.**
- [x] Teller Desk requests `eth_signTypedData_v4` for a Bloxchain meta-tx; **recover == owner** — **K2 PASS**
- [x] Policy denies out-of-scope typed data — **K5 PASS** (`verifyingContract` + `chainId`; `domain.name` is not a matchable field, documented)
- [x] Lane A: unsigned meta-tx via SDK → session-signer signature → `requestAndApproveExecution` from the broadcaster, moving demo USDC on 1337
- [x] After delegation: no second wallet modal — server-side session signer
- [x] `docs/REFLECTION.md` kill log (K2, K5, K8) + U1 progress notes
- [x] ENG-2026-0004 `findings.md` and `handoff.md` filled

---

## 5b. Mission U2 — Timelock lane (G3)

### Freedom envelope

- Lane B request path: prefer **option 1** (owner `eth_sendTransaction` via session signer for `executeWithTimeLock`) if Privy policy can scope it (V6); else **option 2** (REQUESTER role) or document fallback
- Overlay UX for wire / approve / cancel (still HTML overlay — greybox is U3)
- Whether manager approve uses `MANAGER_PK` direct call or owner meta-tx approve
- Headless script vs overlay-first for the countdown proof

### Out of scope

- Greybox zones / NPCs / ledger board (U3)
- ENS, Arc, Uniswap
- Full BRANCH_MANAGER product polish beyond what G3 needs for approve
- Wiping Remote EVM; reintroducing contracts compile

### Definition of Done (G3)

- [ ] `/wire` creates a PENDING time-locked execution (demo token transfer); record readable via SDK
- [ ] Countdown / vault clock uses **`releaseTime` from chain** (`getTransaction` / equivalent), not a local timer
- [ ] `/approve` completes after release (owner meta-tx and/or manager path — document which)
- [ ] `/cancel` works before completion
- [ ] SSE stages cover wire → pending → approve/cancel → mined/failed; overlay refreshes session/passbook
- [ ] Provisioning grants any missing role permissions for time-delay / approve / cancel selectors (extend `provision.ts`)
- [ ] After Account Opening: **no second wallet modal** for the happy path (or V6/K2-style fallback chosen + logged)
- [ ] `docs/REFLECTION.md` + `docs/progress/` note for U2; HANDOFF advanced to U3 when G3 met

### Suggested sequence

1. Confirm Remote EVM up; do not wipe; confirm CopyBlox + dUSDC still in `infra/deployments/remote-evm.json`.
2. Choose Lane B request option (1 vs 2); extend Privy policy only if option 1.
3. Extend role config batch; implement `/wire`, `/approve`, `/cancel`.
4. Prove PENDING + `releaseTime`; warp or wait on 1337 (`TIMELOCK_SEC`, default 120).
5. Approve + cancel smokes; overlay buttons; progress note; stop.

---

## 6. After U2

| Next | Gate |
|------|------|
| U3 Greybox | G4 |
| U4 MVP freeze | G5 |

Cut order unchanged: Uniswap → Manager → Arc → ENS EAC → ENS mint. **Never cut Privy or Lane B.**

---

## 7. Stop conditions

- Need custom Solidity or path-dep on Bloxchain-protocol for **runtime** (bootstrap artifacts OK)
- Would wipe Remote EVM or re-add contracts compile as default
- Scope drifts to greybox/ENS/Arc/Uniswap
- Lane B blocked and PLAN fallback not chosen

Leave: commands, file pointers, kill-test log, next agent can resume from G3 checklist.
