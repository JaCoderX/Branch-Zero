---
title: Kickoff prompt — FX bidirectional + fiat transfer (USD ↔ EUR | ILS)
created: 2026-09-10
product: Branch-Zero
model: Claude Code · Fable
handoff: docs/missions/HANDOFF-fx-bidirectional.md
---

# Kickoff prompt — FX bidirectional + fiat transfer

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable** (Claude Code).  
Do **not** use Codex Luna as the primary seat — this is Sepolia FX lane + guards + killtests, not set-dressing.

**What this is:** upgrade Johnny's FX desk from **one-way USD → EUR | ILS** to **bidirectional USD ↔ EUR and USD ↔ ILS**, and let the player's account **view + Lane A transfer** Practice EUR / ILS after the exchange desk grants those permissions on **first FX interaction**.

**Why:** Fiat pairs landed 2026-09-09 as sell-only. Principal wants both directions, and fiat held in the till must be spendable as account currency (transfer), with the FX desk owning the grant — not Account Opening.

**Baseline:** FX fiat pairs **met** ([`HANDOFF-fx-fiat-pairs.md`](./HANDOFF-fx-fiat-pairs.md)); pools ≈ $100M; Live `fxTillIsMain`; `UNISWAP.md` §2b still documents one-way.

**Handoff:** [`HANDOFF-fx-bidirectional.md`](./HANDOFF-fx-bidirectional.md)

**Not this mission:** Arc · packaging · OBSERVER · KayKit · custom Solidity · live oracle · Circle USDC · EUR↔ILS cross · Lane B/Priority in fiat · desk geometry.

---

## Reflect (locked)

| Fact | Implication |
|------|-------------|
| Same pools serve both directions | No deploy / reseed required |
| One-way blocked reverse via approve whitelist | `enableFx` must add EUR + ILS as `approve` targets |
| Transfer schema already exists | Only whitelist EUR/ILS targets on first FX open |
| Amount = sold currency | Buy euros quotes USD size; sell euros quotes EUR size |
| Live vs Dev | Live: one account. Dev: fiat on Sepolia till — do not pretend 1337 Main holds EUR/ILS |
| Kill tests assert one-way | Update K7-b / `run_fx_walk` / dealer copy checks |

Canonical plan: [`HANDOFF-fx-bidirectional.md`](./HANDOFF-fx-bidirectional.md).

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — FX bidirectional + fiat transfer ONLY.
(1) Johnny quotes and swaps USD ↔ EUR and USD ↔ ILS (both directions) on the existing Uniswap v4 practice pools.
(2) On first FX interaction (`enableFx`), grant Practice EUR + Practice ILS: approve→Permit2 (for reverse swaps) AND transfer whitelist (for Lane A pay). Idempotent heal for tills that already opened one-way.
(3) Account can view EUR/ILS balances and Lane A `/pay` in USD | EUR | ILS. No Lane B / Priority / faucet in fiat. No EUR↔ILS cross.
Prefer Claude Code · Fable. Freedom on HOW. No freedom on constraints.
This is NOT Arc, NOT packaging, NOT OBSERVER, NOT KayKit, NOT a live FX oracle, NOT Circle USDC, NOT a new SwapHelper, NOT desk pull-west.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-fx-bidirectional.md   (scope, reflect, verification)
2. docs/missions/KICKOFF-fx-bidirectional.md   (this file)
3. docs/UNISWAP.md                             (§2b one-way today; §3.1 guard table)
4. docs/missions/HANDOFF-fx-fiat-pairs.md      (baseline met; reverse was out of v1)
5. docs/missions/HANDOFF-CC.md                 (freeze; do not regress)
6. docs/BLOXCHAIN-INTEGRATION.md               (§3 guard batches; transfer whitelist)
7. docs/SECURITY-AND-KEYS.md                   (Sepolia keys; never Ganache-parity)
8. docs/NPCS.md                                (Johnny)
9. docs/GODOT.md                               (bridge FX methods)
10. docs/OWED.md                               (parallel — do not steal polish / packaging gate)
11. apps/teller-desk/src/lanes/fx.ts
12. apps/teller-desk/src/lanes/laneA.ts
13. apps/teller-desk/src/lanes/provision.ts    (whitelistToken pattern — do NOT move EUR/ILS grants here)
14. apps/game/dialogue/dealer.json
15. apps/teller-desk/scripts/kill-tests-s1.ts
16. apps/game/tests/run_fx_walk.gd

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Runtime: @bloxchain/sdk + viem. No custom SwapHelper. No @bloxchain/contracts in product.
- No new pools or tokens. Use pinned practiceEur / practiceIls and uniswap.pools.usdEur / usdIls.
- Product path: USD ↔ EUR and USD ↔ ILS only. Refuse WETH (FX_PAIR). No EUR ↔ ILS.
- Amount is always in the sold currency.
- Session signer; zero new Privy modals. fxTillIsMain on Live unchanged.
- Respect currency0/1 address sort for zeroForOne, settle, and take — never assume USD is token0.
- EUR/ILS transfer + approve whitelist: enableFx / first Johnny visit ONLY — not Iris provision.
- Lane A multi-token yes; Lane B / Priority / wires in fiat NO.
- Every new error → errors.json; MockChain bank lines; run_checks / run_fx_walk / killtests:s1 green.
- Operator-funded Sepolia teller gas only. Never Ganache-parity keys on Sepolia.
- Do not start U7 packaging or polish re-playtest work in this session.
- Never commit secrets. Local progress under docs/progress/ (gitignored).

SEQUENCE:

A. DESK — BIDIRECTIONAL FX
   1. Add direction/side to quote + swap APIs and quote store (pair stays EUR|ILS).
   2. Flip zeroForOne / settle / take / approve / Permit2 for fiat→USD; check input balance.
   3. Permit2 allowance cached per input token (USD, EUR, ILS).

B. DESK — FIRST INTERACTION GRANTS
   4. enableFx: add EUR + ILS to approve whitelist; add EUR + ILS to transfer whitelist; keep Permit2 + UR.
   5. fxEnabled / fx status must require the new targets (heal one-way tills on revisit).
   6. Do not add new role grants unless chain proves a selector is missing — roles are selector-scoped.

C. DESK — LANE A MULTI-TOKEN
   7. /pay + laneA.pay accept USD|EUR|ILS; refuse others.
   8. /status (Live) surfaces EUR/ILS balances honestly; Dev must not claim Main holds Sepolia fiat.

D. GODOT / BRIDGE / COPY
   9. dealer.json Buy vs Sell trees; drop one-way lines; amount choices match sold currency.
   10. fx board + strings; bridge args; MockChain.
   11. Update run_fx_walk / run_checks / killtests:s1 (K7-b no longer “no fiat approved”).

E. PROOF + DOCS
   12. Live: enable → USD→EUR → EUR→USD → USD→ILS → ILS→USD; small Lane A EUR + ILS pays; Etherscan links.
   13. UNISWAP.md §2b/§3.1, NPCS §Johnny, FEEDBACK/REFLECTION as needed, local progress note.
   14. Mark HANDOFF-fx-bidirectional met; tick OWED §5; note HANDOFF-CC.
   15. Commit + push when green. Do not claim Uniswap feedback form done (human OWED).

DONE WHEN:
- Johnny can quote and complete all four directed trades on Live
- enableFx grants approve+transfer for EUR/ILS; existing one-way tills heal
- Lane A can pay EUR and ILS on Live Main
- checks/walks/killtests green; docs updated; OWED ticked

STOP AND ASK if: reverse seems to need a new helper contract; Circle USDC would enter a pool; packaging gate is blocked; principal demands EUR↔ILS or fiat wires in this unit.
```

---

## After the agent finishes

Principal: Live walk buy + sell both pairs; small fiat Lane A. Still owe [Uniswap feedback form](https://developers.uniswap.org/hackathon-feedback) on [OWED.md](../OWED.md).
