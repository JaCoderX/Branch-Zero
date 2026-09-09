---
type: handoff
title: Handoff — FX fiat pairs (Practice EUR + Practice ILS)
audience: cold agent (Claude Code · Fable)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Replace USDC→WETH FX demo with bank-true fiat pairs USD↔EUR and USD↔ILS on Uniswap v4; deep practice pools; optional FX desk pull-west
plan: this file §Direction
kickoff: docs/KICKOFF-fx-fiat-pairs.md
baseline: S1/S1b/S2 FX met (governed swap on Sepolia); Live OTP + FX walk 2026-09-09 on Main till; practice USDC open-mint; WETH pool exists but is metaphor-wrong for a bank FX desk
status: met 2026-09-09 — Practice EUR/ILS pools ~$100M; Kenji USD→fiat on Live; WETH off product path (c138952)
parallel_to: U7 packaging / polish re-playtest — do not steal those gates
---

# Handoff — FX fiat pairs (Practice EUR + ILS)

You are a **cold agent**. Prefer this file + the kickoff + [`UNISWAP.md`](./UNISWAP.md) over chat memory.
Freedom on **how**. No freedom on constraints, scope, or protocol semantics.

**Status (2026-09-09):** **Met** (`c138952`). Practice EUR `0xB6a3…` + ILS `0x5Bca…`; two v4 pools ≈ $100M TVL at Frankfurter 2026-09-08 mids; Kenji quotes/swaps USD→EUR and USD→ILS on Live; WETH refused `FX_PAIR`. Desk spacing is the separate Luna unit (met). Owed: principal Live eye-check + Uniswap feedback form.

**Authorized construction (historical):** Kenji's FX desk trades **practice fiat** against practice USD through **two** Uniswap v4 pools on Sepolia — not WETH.

**Desk spacing:** owned by a separate Codex Luna unit — [`HANDOFF-fx-desk-spacing.md`](./HANDOFF-fx-desk-spacing.md). **Do not** pull the desk in this Fable session (avoid double-moves).

**Prefer:** **Claude Code · Fable** (Sepolia infra + `lanes/fx.ts` + guards + killtests). Codex Luna is the wrong seat for tokens/pools.

**Kickoff (paste):** [`docs/KICKOFF-fx-fiat-pairs.md`](./KICKOFF-fx-fiat-pairs.md)

**Not this mission:** Arc · packaging · OBSERVER walk · KayKit cast · custom SwapHelper · live FX oracle every quote · Circle USDC · reverse EUR/ILS→USD in v1 (USD→fiat one-way is enough).

---

## Principal intent

1. FX demo should feel like a **bank foreign-exchange desk**, not “buy ether.”
2. New open-mint tokens: **Practice EURO** and **Practice ILS**.
3. Two pools: **USD ↔ EUR** and **USD ↔ ILS**.
4. Each pool ≈ **$100M total value** at seed mid-market rates (both sides, ~50/50 by value).
5. Optional: move FX desk **away from the east wall** for space behind Kenji — **not in this unit**; see [`HANDOFF-fx-desk-spacing.md`](./HANDOFF-fx-desk-spacing.md) (Codex Luna).

---

## Rate snapshot (pin at seed; do not live-oracle v1)

Frankfurter ECB-style mid **2026-09-08** (`https://api.frankfurter.app/latest?from=USD&to=EUR,ILS`):

| | Rate | Seed inventory for ≈ $100M TVL (50/50) |
|--|-----:|----------------------------------------|
| **USD → EUR** | **0.86103** | 50,000,000 USD + **43,051,500** EUR |
| **USD → ILS** | **3.0118** | 50,000,000 USD + **150,590,000** ILS |

Re-check Frankfurter (or Wise mid) on the day you seed; freeze `seedRate` + `seedRateDate` in `sepolia.json`. Market screens on 2026-09-09 were nearby (EUR ~0.86–0.87, ILS ~3.02–3.05).

**Across both pools:** mint **100M** practice USD into LP (open-mint — no real capital). Fee tier **0.30%** (fee in pair tokens; gas = Sepolia ETH).

**Demo effect:** $100M depth → tiny Kenji swaps barely move price. That is **desired** for bank FX. The old tiny WETH pool taught impact; do not shrink these fiat books to recreate that lesson.

---

## Direction

### A. Infra (Sepolia)

1. Deploy open-mint **PracticeEUR** + **PracticeILS** (6 decimals, same mint pattern as `demoUsdc`). Pin in `infra/deployments/sepolia.json`.
2. Extend `infra/scripts/uniswap-pool.ts` (or sibling) to initialise + full-range mint **two** pools vs practice USD. No hooks. Fee 3000, tick spacing 60.
3. Write pool ids, token addresses, seed rates/date, TVL inventory into `sepolia.json` under e.g. `uniswap.pools.usdEur` / `usdIls`.
4. Deprecate product use of USDC/WETH pool (leave on-chain; desk stops quoting it). Document in `UNISWAP.md`.

### B. Desk / bridge / Godot

5. `lanes/fx.ts`: pair argument (`EUR` | `ILS`); quote + swap **USD → fiat** one-hop; balances for USD + both fiats on status.
6. Respect address sort (`currency0` / `currency1`) — do **not** assume USD is always token0.
7. Guard enable: same three call shapes; whitelist targets include new token contracts where approve is needed (USD out is enough for one-way).
8. Kenji dialogue + quote board: euros / shekels, not ether; board shows pair, rate, min out, fee, countdown.
9. MockChain + `run_fx_walk` / killtests updated for pairs.
10. Optional desk pull-west — **skip here**; Luna owns [`HANDOFF-fx-desk-spacing.md`](./HANDOFF-fx-desk-spacing.md).

### C. Proof + docs

11. Live Sepolia: enable → quote EUR → swap → quote ILS → swap; balances reconcile on Main till (`fxTillIsMain`).
12. Update `UNISWAP.md`, `NPCS.md` §Kenji, `FEEDBACK.md` angle (governed **fiat** FX via v4), `REFLECTION` decision row, progress note (local).

---

## Constraints

- Runtime: `@bloxchain/sdk` + viem. No custom Solidity SwapHelper. No Ganache-parity keys on Sepolia.
- Session signer only — **no new Privy modal**.
- Do not regress Lane A/B, Priority, ENS, Load Account, packaging freeze.
- Practice tokens only — never swap Circle USDC into these pools.
- Parallel to packaging: do not block OWED polish re-playtest / ship package.

## After Yes

Principal Live walk at Kenji (both pairs). Human still owes Uniswap feedback form ([OWED.md](./OWED.md) §2).
