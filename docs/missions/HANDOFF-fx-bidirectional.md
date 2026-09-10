---
type: handoff
title: Handoff — FX bidirectional + fiat transfer (USD ↔ EUR | ILS)
audience: cold agent (Claude Code · Fable preferred)
created: 2026-09-10
product: Branch-Zero
objective: OBJ-2026-0004
mission: Bidirectional FX at Johnny (USD↔EUR and USD↔ILS) plus account view/transfer of Practice EUR/ILS; permissions granted on first FX interaction
kickoff: docs/missions/KICKOFF-fx-bidirectional.md
status: met 2026-09-10 — one-way Live till healed to seven whitelist rows in one guard batch; USD→EUR, EUR→USD, USD→ILS, ILS→USD all completed on the Main till; Lane A paid EUR + ILS; killtests:s1 K7-a…h, run_fx_walk, run_checks (FX desk) green — see §Outcome
baseline: FX fiat pairs MET 2026-09-09 (USD→EUR|ILS one-way; pools ~$100M; Live fxTillIsMain) — HANDOFF-fx-fiat-pairs.md · UNISWAP.md §2b
parallel_to: U7 packaging / polish re-playtest — do not steal those gates; do not absorb EUR↔ILS cross or multi-currency Lane B
---

# Handoff — FX bidirectional + fiat transfer

You are a **cold agent**. Prefer this file + the kickoff + [`UNISWAP.md`](../UNISWAP.md) over chat memory.
Freedom on **how**. No freedom on constraints, scope, or protocol semantics.

**Prefer:** **Claude Code · Fable** (`lanes/fx.ts` + guard batches + Sepolia killtests + Johnny dialogue). Codex Luna is the wrong seat for pool/guard work (dialogue-only polish is fine as a follow-up if Fable lands desk first).

**Kickoff (paste):** [`KICKOFF-fx-bidirectional.md`](./KICKOFF-fx-bidirectional.md)

**Baseline (met):** [`HANDOFF-fx-fiat-pairs.md`](./HANDOFF-fx-fiat-pairs.md) · [`UNISWAP.md`](../UNISWAP.md) §2b · Live till swaps `0xf3cb83b4…` (EUR) / `0xd6f63de9…` (ILS).

**Not this mission:** Arc · U7 packaging · OBSERVER · KayKit · custom SwapHelper · live FX oracle every quote · Circle USDC · **EUR ↔ ILS cross** (no pool) · multi-currency **Lane B / Priority / wires** (Lane A pay only) · reseeding / shrinking the $100M books · new Privy modal · protocol Solidity.

---

## Principal intent

1. Johnny's desk trades **both ways**: USD → EUR and **EUR → USD**; same for ILS.
2. After FX opens, the player's account can **view** and **transfer** Practice EUR and Practice ILS (not only hold them on the till board).
3. **Permissions for EUR/ILS are granted by the exchange desk on first interaction** (`/fx/enable` / `fx_enable`) — not at Account Opening by Iris.
4. Security story stays: governed AccountBlox → three FX call shapes + transfer whitelist; no wider door.

---

## Reflect (locked facts)

| Fact | Implication |
|------|-------------|
| Pools already exist (`usdEur`, `usdIls` in `sepolia.json`) | **No new pools or tokens.** Reverse is `zeroForOne` flip + settle/take swap on the same pool |
| v1 was deliberately one-way | `enableFx` whitelists **USD only** for `approve`; fiat never approved for Permit2 |
| Reverse spend needs fiat approve | Add **Practice EUR** + **Practice ILS** as `approve` whitelist targets (same selector `0x095ea7b3`) |
| Permit2 + Universal Router | Unchanged addresses; Permit2 allowance must be **per input token** |
| Role grants are selector-scoped | Adding approve/transfer **targets** does **not** need new OWNER/BROADCASTER grants on those selectors if grants already exist |
| `transfer` schema exists from `initialize` | Only need `ADD_TARGET_TO_WHITELIST` for EUR/ILS on `ERC20_TRANSFER` — do this in **`enableFx`**, not `provision.whitelistToken` |
| Lane A `/pay` is USD-only today | Extend with `token` / `symbol` (`USD` \| `EUR` \| `ILS`); refuse unknown |
| Live `fxTillIsMain` | On Live, one account = pay + FX; multi-token passbook matters. Eve: EUR/ILS live on **Sepolia till**, not 1337 Main — do not lie in UI |
| Kill tests encode one-way | `killtests:s1` K7-b and `run_fx_walk` assert no fiat on approve / "exactly 3" one-way copy — **invert** those assertions |
| Deep books | Tiny reverse swaps stay flat — desired; do not shrink TVL |

Canonical product path after this unit: **USD ↔ EUR** and **USD ↔ ILS** (four directed trades). Still refuse WETH (`FX_PAIR`).

---

## Direction

### A. Desk — bidirectional quote / swap (`apps/teller-desk/src/lanes/fx.ts`)

1. Add a **direction** (name free: `side: 'buy' | 'sell'`, or `from`/`to`). `pair` stays `EUR` \| `ILS`.
2. **Amount = sold currency** (recommended lock): buy euros = amount in USD; sell euros = amount in EUR.
3. Quote: flip `zeroForOne` for fiat→USD (`!usdIsCurrency0` when USD is currency1, which both pools are today — still derive from addresses, never hard-code).
4. Swap encode: `SETTLE_ALL` input token, `TAKE_ALL` output token; approve + Permit2 against **input**.
5. Balance check / `FX_TILL_SHORT`: check the **input** balance.
6. Quote store remembers pair **and** direction; stale/mismatched direction refused.
7. New error codes → `apps/game/dialogue/errors.json` (and MockChain bank lines).

### B. Desk — first FX interaction grants (`enableFx`)

On first open (idempotent heal on revisit):

| Batch piece | Action |
|-------------|--------|
| FX `approve` whitelist | Keep USD; **add** Practice EUR + Practice ILS |
| Permit2 + `execute` | Unchanged |
| Role grants on FX selectors | Unchanged (already OWNER sign / BROADCASTER execute) |
| **Transfer** whitelist | `ADD_TARGET_TO_WHITELIST` for EUR + ILS on `EngineBlox.ERC20_TRANSFER_SELECTOR` |
| Transfer role grants | **Do not** re-run provision grants; they already cover the selector |

Update `fxEnabled` / `/fx/status` whitelist reporting so “open” means reverse + fiat transfer targets are present (or you will lie / re-open forever). Existing one-way tills must heal on next Johnny enable without a manual chain surgery script.

### C. Desk — Lane A multi-token (view + transfer)

8. `POST /pay` (and `laneA.pay`): accept token symbol/address for USD \| EUR \| ILS; use that token as the guarded `transfer` target.
9. `GET /status` (and shell passbook): expose EUR + ILS balances when the wing/account can hold them (Live Main; Eve: be honest that Main is 1337 USD-only and FX till is separate — prefer showing fiat on `/fx/status` + Johnny board there).
10. Do **not** extend `/wire`, Priority, or faucet to fiat in this unit.

### D. Godot / bridge / dialogue

11. `dealer.json`: remove one-way copy (“I don’t buy them back”); add Buy vs Sell (or Dollars↔Euros / Dollars↔Shekels) trees; amount choices must match sold currency.
12. `fx_board.gd` / `strings.json`: both-way rates; whitelist copy no longer “one-way”.
13. Bridge `fxQuote` / `fxSwap` args carry direction; pay path if exposed from game.
14. MockChain + `run_fx_walk` + `run_checks` (`_check_johnny` / dealer allowed actions).

### E. Proof + docs

15. Live Sepolia: enable (heal if needed) → USD→EUR → EUR→USD → USD→ILS → ILS→USD; then Lane A pay small EUR and ILS on Live Main; Etherscan links.
16. Update `UNISWAP.md` §2b / §3.1 (drop “one-way, one door”), `NPCS.md` §Johnny, `FEEDBACK.md` if angle changes, `REFLECTION` decision row, local `docs/progress/` note (gitignored OK).
17. Tick [`OWED.md`](../OWED.md) §5 when met; note [`HANDOFF-CC.md`](./HANDOFF-CC.md).

---

## Constraints

- Runtime: `@bloxchain/sdk` + viem. No custom SwapHelper. No `@bloxchain/contracts` in product.
- Session signer only — **no new Privy modal**.
- Practice tokens only — never Circle USDC in these pools.
- Do not regress Lane A/B (USD), Priority, ENS, Load Account, FX one-hop pools, packaging freeze.
- Do not grant EUR/ILS transfer at Iris Account Opening — **Johnny / `enableFx` only**.
- Do not weaken timelock / RBAC / whitelist to “make reverse easier.”

---

## Verification checklist

- [x] Quote + swap USD→EUR and EUR→USD on Live (Main till) — K7-c/d `EUR-buy` / `EUR-sell`
- [x] Quote + swap USD→ILS and ILS→USD on Live — K7-c/d `ILS-buy` / `ILS-sell`
- [x] `enableFx` lists USD+EUR+ILS on approve; EUR+ILS on transfer; `fxEnabled` true after heal — K7-b ("healed a till missing approve→EUR, approve→ILS, transfer→EUR, transfer→ILS … fxEnabled false → true")
- [x] Lane A `/pay` moves EUR and ILS (Live); unknown token refused — K7-h
- [x] Johnny dialogue no longer claims one-way; board copy updated — `run_checks` FX desk fails on "one-way" / "don't buy them back" / a sell priced in dollars
- [x] `killtests:s1`, `run_fx_walk` green; `run_checks` FX desk green (four unrelated failures in the working tree come from a sibling's uncommitted greeter / AO-desk work — see §Outcome)
- [x] WETH still `FX_PAIR` — K7-g
- [x] Docs: `UNISWAP.md` §2b / §3.1 / §4, `NPCS.md`, `GODOT.md` §4b, `FEEDBACK.md`, `REFLECTION.md` §8, OWED tick, HANDOFF status → met

## Outcome (2026-09-10)

**Desk.** `lanes/fx.ts` gained `side` (`buy` = USD → fiat, `sell` = fiat → USD; amount in the sold currency; the quote
store keeps pair + side and refuses a mirror with `FX_SIDE`). A sell flips `zeroForOne`, settles the fiat, takes the
dollar, and runs approve → Permit2 against the input token. `enableFx` whitelists three `approve` targets and adds
EUR + ILS as `transfer` targets; `readDoor` / `fxEnabled` demand all seven rows, and `/fx/status` reports `missing`
and `payable`. No new role grant unless the chain proves a role holds nothing on `transfer` (Dev till only).
`laneA.pay` takes a `PayToken` (`payTokenOf`: USD default, EUR | ILS on Live, `PAY_TOKEN` otherwise; fiat before the
grant is `FX_NOT_ENABLED`), and `passbook` returns `balances[]`. Bridge carries `side` and `token` (no version bump).

**Godot.** `dealer.json`: Euros / Shekels → Buy / Sell → sizes in the sold currency; "Ask why" names
`approve` / `execute` / `transfer`; the receipt reads `GameState.fx_last`. `strings.json` board copy, `errors.json`
`FX_SIDE` + `PAY_TOKEN` (and honest `FX_PAIR` / `FX_TILL_SHORT` / `FX_NOT_ENABLED`), MockChain both sides + fiat pay,
`run_fx_walk` both sides + pays + refusals, `run_checks` bidirectional assertions. `GameState.run_action` now
**forces** `refresh_fx` after an enable / fill / fiat pay — the 12 s idle throttle a sibling added had left the mock
walk reading a stale board.

**Live evidence** is in [`UNISWAP.md` §2b](../UNISWAP.md) (heal batch, four swaps, two pays, Etherscan links).

**Not done, by design:** EUR ↔ ILS cross · fiat Lane B / Priority / wire / faucet · a currency picker in Eve's slip
(the desk API takes `token`; the teller dialogue still pays dollars) · Uniswap feedback form (human, OWED §2).

---

## After Yes

Principal: Live walk buy + sell both pairs at Johnny; small fiat Lane A pay. Human still owes Uniswap feedback form ([OWED.md](../OWED.md) §2).
