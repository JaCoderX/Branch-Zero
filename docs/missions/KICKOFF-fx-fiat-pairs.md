---
title: Kickoff prompt — FX fiat pairs (Practice EUR + ILS)
created: 2026-09-09
product: Branch-Zero
model: Claude Code · Fable
handoff: docs/missions/HANDOFF-fx-fiat-pairs.md
---

# Kickoff prompt — FX fiat pairs (Practice EUR + ILS)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable** (Claude Code).  
Do **not** use Codex Luna for this unit — it is Sepolia infra + FX lane + guards, not set-dressing explore.

**What this is:** replace the USDC→WETH FX demo with **bank fiat pairs** — open-mint Practice EURO + Practice ILS, two Uniswap v4 pools (USD/EUR, USD/ILS), each seeded to ≈ **$100M** TVL at a pinned mid-market rate. Optional: pull Johnny's desk west for staff space.

**Why:** Live walk proved governed Uniswap works; the metaphor is wrong for an FX desk. Principal wants dollars→euros / shekels.

**Baseline:** S1/S1b/S2 FX met; Live Main = Sepolia; `fxTillIsMain`; practice USDC open-mint; WETH pool may remain on-chain but must leave the product path.

**Not this mission:** Arc · U7 packaging · OBSERVER · KayKit · custom Solidity · live FX oracle per quote · Circle USDC · EUR/ILS→USD reverse in v1.

---

## Reflect (locked)

| Fact | Implication |
|------|-------------|
| Frankfurter 2026-09-08: 1 USD = **0.86103 EUR**, **3.0118 ILS** | Pin at seed; re-check on seed day; store `seedRate` + date |
| $100M TVL / pool, ~50/50 | USD/EUR: 50M USD + 43,051,500 EUR · USD/ILS: 50M USD + 150,590,000 ILS |
| Open mint | Theatrical TVL is free; label practice; no real capital |
| Deep book | Tiny swaps ≈ flat rate — desired for bank FX |
| Address sort | Never assume USD is currency0 |
| Prize story | Still governed AccountBlox → UR; fiat makes the bank angle clearer |

Canonical plan: [`docs/missions/HANDOFF-fx-fiat-pairs.md`](./HANDOFF-fx-fiat-pairs.md).

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — FX fiat pairs ONLY (Practice EUR + Practice ILS; two v4 pools; Johnny USD→fiat).
Prefer Claude Code · Fable. Freedom on HOW. No freedom on constraints.
This is NOT Arc, NOT packaging, NOT OBSERVER, NOT KayKit, NOT Codex Luna set-dressing, NOT a live FX oracle, NOT Circle USDC.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-fx-fiat-pairs.md   (rates, inventories, scope)
2. docs/missions/KICKOFF-fx-fiat-pairs.md   (this file)
3. docs/UNISWAP.md                 (current WETH path — replace product path)
4. docs/missions/HANDOFF-CC.md              (freeze; FX met; do not regress)
5. docs/BLOXCHAIN-INTEGRATION.md   (§3 guard batches)
6. docs/SECURITY-AND-KEYS.md       (Sepolia keys; never Ganache-parity)
7. docs/NPCS.md                    (Johnny)
8. docs/GODOT.md                   (bridge)
9. docs/OWED.md                    (parallel to packaging — do not steal the polish gate)
10. infra/scripts/uniswap-pool.ts
11. apps/teller-desk/src/lanes/fx.ts
12. https://api.frankfurter.app/latest?from=USD&to=EUR,ILS  (re-pin rates on seed day)

HARD RULES:
- Runtime: @bloxchain/sdk + viem. No custom SwapHelper. No @bloxchain/contracts in product.
- Open-mint PracticeEUR + PracticeILS (6 decimals), same family as demoUsdc.
- Two pools only for product: USD/EUR and USD/ILS. Fee 3000, spacing 60, no hooks.
- Seed ≈ $100M TVL each at pinned mid-market (50/50 by value). Default inventories from handoff unless Frankfurter moved >1% — then recompute and document.
- Product path: USD → EUR | USD → ILS one-way. Stop quoting WETH.
- Session signer; zero new Privy modals. fxTillIsMain on Live unchanged.
- Respect currency0/1 address sort in encode + quoter.
- Every new error → errors.json; run_checks / fx walk / killtests green.
- Operator-funded Sepolia LP/deployer key only. Never Ganache-parity.
- Do NOT pull the FX desk geometry — that is Codex Luna ([docs/missions/HANDOFF-fx-desk-spacing.md](./HANDOFF-fx-desk-spacing.md)).
- Do not start U7 packaging or polish re-playtest work in this session.

SEQUENCE:

A. INFRA
   1. Deploy PracticeEUR + PracticeILS; pin sepolia.json.
   2. Initialise + full-range seed both pools (extend fx:pool or add fx:pools-fiat).
   3. Record pool ids, rates, date, inventories; deprecate product use of USDC/WETH.

B. DESK
   4. fx status/quote/swap take pair EUR|ILS; balances for USD+EUR+ILS.
   5. Guard enable still approve / Permit2 / UR execute; whitelist new tokens as needed for one-way.
   6. MockChain + killtests / run_fx_walk for both pairs.

C. GODOT
   7. dealer.json + fx board: euros/shekels; pair choice in dialogue.
   8. (Desk pull-west is a separate Luna mission — skip.)

D. PROOF + DOCS
   9. Live Sepolia evidence: both pairs swap on Main till; Etherscan links.
   10. UNISWAP.md, NPCS, FEEDBACK.md angle, REFLECTION decision, local progress note.
   11. Commit + push when green. Do not claim Uniswap feedback form done (human OWED).

DONE WHEN:
- sepolia.json pins both tokens + both pools with seedRate/date/TVL
- Johnny can quote and complete USD→EUR and USD→ILS on Live
- WETH is off the product FX path
- checks/walks green; docs updated

STOP AND ASK if: seed would spend real scarce ETH beyond gas; Circle USDC would enter a pool; packaging gate is blocked; reverse fiat→USD is demanded for v1.
```

---

## After the agent finishes

Principal: Live walk both pairs at Johnny. Still owe [Uniswap feedback form](https://developers.uniswap.org/hackathon-feedback) on [OWED.md](../OWED.md).
