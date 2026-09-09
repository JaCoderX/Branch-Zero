# Uniswap v4 Integration — The FX Desk (S1)

> Status: **MET 2026-09-08** (sponsor **#3**; Arc deferred). Pool, FX till, quotes, **guard + role config and the
> guarded swap are all live on Sepolia**. K7-a…f green. First swap
> [`0xd98efc64…`](https://sepolia.etherscan.io/tx/0xd98efc64e579758b04aa338b2ec777536839b7e48908000e6c6a0b93e8f686b3);
> guard batch `0x38f28f37…`, role batch `0xef7b253d…` (§3.1). Owed by a human: the Uniswap feedback form.
> S1b record: `docs/progress/2026-09-08-s1b-fx-validate.md`.
>
> **Fiat pairs — MET 2026-09-09.** The desk is a bank FX desk now: **USD → EUR** and **USD → ILS** against two
> practice pools seeded ≈ $100M TVL each (§2b). Both pairs swapped live on the Main till:
> EUR [`0xf3cb83b4…`](https://sepolia.etherscan.io/tx/0xf3cb83b440a555accd9cb14a3378098af4f89b7e5cc801cb0be7142b4ce50e20) ·
> ILS [`0xd6f63de9…`](https://sepolia.etherscan.io/tx/0xd6f63de93198f8fa48926fb68ae9bbd096fbd318dc3470819c1f49c040976fa7). The USDC/WETH pool stays on chain and is
> **off the product path**. Brief: [`HANDOFF-fx-fiat-pairs.md`](./missions/HANDOFF-fx-fiat-pairs.md); local record:
> `docs/progress/2026-09-09-fx-fiat-pairs.md`.
> Kickoff: [`KICKOFF-S1-fx-validate.md`](./missions/KICKOFF-S1-fx-validate.md). Build kickoff:
> [`KICKOFF-S1-uniswap-fx.md`](./missions/KICKOFF-S1-uniswap-fx.md). HANDOFF **§5i**. Local progress:
> `docs/progress/2026-09-08-s1-uniswap-fx.md`. Prize: `FEEDBACK.md` +
> [Uniswap hackathon feedback form](https://developers.uniswap.org/hackathon-feedback).

Related: [PLAN.md](./PLAN.md) § 3 (tier S1) · [REFLECTION.md](./REFLECTION.md) § Sponsor matrix · [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) § 3 (guard config batch) · [HANDOFF-CC.md](./missions/HANDOFF-CC.md) §5i

Docs: [Universal Router](https://docs.uniswap.org/contracts/universal-router/overview) · [v4 swap via Universal Router](https://docs.uniswap.org/contracts/v4/quickstart/swap) · [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments) · [Permit2](https://docs.uniswap.org/contracts/permit2/overview) · [v4 Quoter](https://docs.uniswap.org/contracts/v4/reference/periphery/lens/V4Quoter)

---

## 1. Prize framing

ETHOnline 2026 **Best Uniswap Stack Contribution** (Start Fresh pool unless Continuity Track). Branch Zero's angle:

> **A swap executed by a governed account through the bank's guard rails.** The Dealer NPC quotes with the v4 Quoter; the swap goes through `GuardController` as a whitelisted, selector-scoped call to the Universal Router. The player never approves a token spend in a wallet modal, and the account's policy caps what the Dealer can do.

This is not "a swap UI"; it is "swaps as a permissioned treasury operation."

**Reset:** v4 only · Sepolia for FX · no custom SwapHelper · no new Privy modal · K7 = live Sepolia evidence.

**Fiat pairs (2026-09-09):** "buy ether" was the wrong metaphor for a bank FX desk. Kenji now sells practice
dollars for **Practice EUR** and **Practice ILS** — open-mint 6-decimal tokens in the same family as the practice
dollar — through two v4 pools, each seeded 50/50 by value at the Frankfurter mid of 2026-09-08 (§2b). The guard list
did not change: one-way USD → fiat approves only the dollar, so the same three schemas / three targets that opened the
WETH desk open the fiat desk. Kenji never quotes WETH again (`FX_PAIR`).

**S2 (2026-09-08):** FX is Sepolia on **both** wings and now refuses a till that is not a live Sepolia
`AccountBlox` owned by the player (`FX_TILL_NOT_SEPOLIA`, one `eth_call` before anything is signed); the bank
says "Sepolia only" in words (`FX_SEPOLIA_ONLY`, `{fx_chain_note}`). K7 re-run on the unified Live till:
[`0xd1d9cd8e…`](https://sepolia.etherscan.io/tx/0xd1d9cd8eaac73cdc52eb5e6ce8327c868e91ee8c08e22d37d864e93391feadd6).

---

## 2. Contracts (Sepolia — pinned 2026-09-08 from the [deployments page](https://developers.uniswap.org/contracts/v4/deployments))

Recorded in [`infra/deployments/sepolia.json`](../infra/deployments/sepolia.json) under `uniswap`, beside the U5 ENS pins.

| Contract | Role | Address |
|----------|------|---------|
| `PoolManager` | v4 singleton | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| `UniversalRouter` | entry point for swaps | `0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b` |
| `PositionManager` | pool creation + liquidity (seeding only) | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` |
| `V4Quoter` | off-chain quotes (`quoteExactInputSingle` — **non-view**, so `eth_call` / `simulateContract` only) | `0x61b3f2011a92d183c7dbadbda940a7555ccf9227` |
| `StateView` | pool state reads (`getSlot0`, `getLiquidity` by pool id) | `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c` |
| `Permit2` | token allowance to router | `0x000000000022D473030F116dDEE9F6B43aC78BA3` (canonical) |
| Practice dollar | the U5 Sepolia mock USDC, 6 decimals, open `mint` — "USD" at the desk | `0xD3322B29a7BdEe707D1684676f149bf41Aa3422f` |
| ~~Demo pool~~ (**deprecated for the product 2026-09-09**) | `USDC(demo) / WETH`, fee 0.30 %, tick spacing 60, no hook — S1's first pool; left on chain, no longer quoted | id `0xfd32332c7bc1c1ab4b2cd2971b6e1eef513d610457504b8a19745413b678581f` |
| — its `currency1` | Sepolia WETH9 (the one the Uniswap deployments use) — off the product path | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |
| **FX till** | the player's `AccountBlox` on Sepolia — the account that trades. **Since S2 (2026-09-08) this is the player's Live Main account itself** (`fxTillIsMain`): the Live wing is Sepolia, so Kenji trades out of the account the counter pays from. In Developer Mode it stays a separate Sepolia account, because a 1337 account cannot be a Sepolia till. | `0xB5e8ab92467663F50c6Ba237Cb062cE6Bf66B2Af` |

### 2b. Fiat pools (the product path since 2026-09-09)

Seeded by [`infra/scripts/fx-pools-fiat.ts`](../infra/scripts/fx-pools-fiat.ts) (`npm run fx:pools-fiat`, idempotent,
`--dry` to plan). Recorded in `sepolia.json` under `tokens.practiceEur` / `tokens.practiceIls` and
`uniswap.pools.usdEur` / `usdIls`, each with `seedRate`, `seedRateDate`, `seedInventory`, `seedTvlUsd`, `usdIsCurrency0`.

| | USD / EUR | USD / ILS |
|--|-----------|-----------|
| Fiat token | **Practice Euro** `EUR` [`0xB6a3e346…`](https://sepolia.etherscan.io/address/0xB6a3e346C5aEddC14BD1006017Fd04697069BF98) | **Practice Israeli Shekel** `ILS` [`0x5Bca93fc…`](https://sepolia.etherscan.io/address/0x5Bca93fc8C9e383280C220252651635B8B2f4336) |
| Token source | [`infra/contracts/PracticeFiat.sol`](../infra/contracts/PracticeFiat.sol) — OpenZeppelin 5.6 ERC-20, `decimals() = 6`, open `mint(address,uint256)`; not protocol code | same |
| Pool id | `0x3b57bf6e9a835de1b54562b23156abeed18e44a420d2ecd6e8773d9a9ac333de` | `0x93adbf0b5794f0ebcf20c4dffdd9ff4036dd6808031af0db33392b65b88e0733` |
| Key | fee 3000 (0.30 %), tick spacing 60, no hooks | same |
| Address sort | **`currency0` = EUR, `currency1` = USD** → USD → EUR is `zeroForOne = false` | **`currency0` = ILS, `currency1` = USD** → `zeroForOne = false` |
| Seed rate (Frankfurter ECB mid, **2026-09-08**; re-read on seed day 2026-09-09 — unchanged) | 1 USD = **0.86103 EUR** | 1 USD = **3.0118 ILS** |
| Seed inventory (≈ $100M TVL, 50/50 by value) | 50,000,000 USD + 43,051,500 EUR | 50,000,000 USD + 150,590,000 ILS |
| Full-range liquidity `L ≈ √(x·y)` | 46,395,851,107,615 · tick 1496 | 86,772,691,556,733 · tick −11026 |
| LP / deployer | `SEPOLIA_DEPLOYER_PK` `0xDD46DA5d…` (the bank's mint key; total cost ≈ 0.002 ETH of gas) | same |
| Init / seed | [`0x4dc361ae…`](https://sepolia.etherscan.io/tx/0x4dc361ae8309f640b82f50234db6cb95ec1fa210bb49b922d928effe931a0bb5) / [`0xe161c59c…`](https://sepolia.etherscan.io/tx/0xe161c59c7df2d5014185fab556aa5d43fe5843560b196424a7a6f24fe9c025b5) | [`0x10315c7c…`](https://sepolia.etherscan.io/tx/0x10315c7ced964efec2871c2ae4ea384866d5706835340f1b36afb6223f74e722) / [`0xdf0917d0…`](https://sepolia.etherscan.io/tx/0xdf0917d09b9531b1420d04afe17eb19d57b61ee62894bcff1e0bbb01aade7a94) |
| **Live swap on the Main till** (5 USD, one `execute` each) | [`0xf3cb83b4…`](https://sepolia.etherscan.io/tx/0xf3cb83b440a555accd9cb14a3378098af4f89b7e5cc801cb0be7142b4ce50e20) → 4.292234 EUR | [`0xd6f63de9…`](https://sepolia.etherscan.io/tx/0xd6f63de93198f8fa48926fb68ae9bbd096fbd318dc3470819c1f49c040976fa7) → 15.013821 ILS |

**Pinned, not oracled.** The rate is frozen at seed; the pool prices every quote from then on. A desk-sized order on
a $100M book moves the price by ~1e-7, so the all-in quote sits at the seed mid minus the 0.30 % fee — which is what a
bank FX board looks like, and the opposite of the thin WETH pool that taught price impact. Do not shrink these books
to recreate that lesson (HANDOFF-fx-fiat-pairs.md). Re-seed on a new day by running the script again with `--add`
after re-pinning; it reads Frankfurter, compares against the handoff pins and reports drift > 1 %.

**Address sort is not optional.** Both fiat tokens happened to sort below the practice dollar, so USD is `currency1`
in both pools — the exact case the S1 code refused (`expected demo USDC to sort as currency0`). `lanes/fx.ts` now
re-derives `usdIsCurrency0` from the pool's addresses and uses it for `zeroForOne`, `SETTLE_ALL` (USD) and `TAKE_ALL`
(fiat); nothing assumes a side.

**One-way, one door.** USD → EUR | ILS only. The account approves the dollar for Permit2 and nothing else, so the
guard whitelist is unchanged from §3.1 and a till opened for the WETH desk trades fiat without a new config batch
(K7-b re-read it: "already open"). Reverse fiat → USD is out of scope for v1 and would need two more `approve` targets.

#### History — the WETH pool (S1, 2026-09-08)

The pool did not exist, so we created and seeded it: `npm -w infra run fx:pool`
([`infra/scripts/uniswap-pool.ts`](../infra/scripts/uniswap-pool.ts)) initialises it at 1 ETH = 2,000 practice dollars
and mints one full-range position through `PositionManager.modifyLiquidities` (`MINT_POSITION` → `SETTLE_PAIR`, paid
through Permit2). It is deliberately a small position, so quotes show real price impact — 1 → 0.000352 WETH,
5 → 0.000810, 10 → 0.000967.

**Encoding constants** (read from the published sources, not the docs — see `FEEDBACK.md`):
`Commands.V4_SWAP = 0x10`; `Actions.SWAP_EXACT_IN_SINGLE = 0x06`, `SETTLE_ALL = 0x0c`, `TAKE_ALL = 0x0f`,
`MINT_POSITION = 0x02`, `SETTLE_PAIR = 0x0d`. Note `IV4Router.ExactInputSingleParams` on `v4-periphery` `main` carries
a `minHopPriceX36` field the swap guide's sample omits; the deployed Sepolia router takes the guide's five-field shape,
which is what `lanes/fx.ts` encodes.

---

## 3. Flow through the Bloxchain account

Because the player's assets live in the `AccountBlox`, the swap is executed **by the account** (the account is `msg.sender` to Permit2/Router), gated by `GuardController`.

```mermaid
sequenceDiagram
  participant P as Player (Godot)
  participant D as Dealer NPC
  participant T as Teller Desk
  participant A as AccountBlox (Sepolia)
  participant U as Universal Router / PoolManager

  P->>D: "Change 100 dollars to euros"
  D->>T: GET /fx/quote?amount=100&pair=EUR
  T->>U: V4Quoter.quoteExactInputSingle (eth_call, zeroForOne = usdIsCurrency0)
  T-->>D: 85.84 EUR, min 84.99 @ 1% slippage
  D->>P: quote board updates; "Accept?"
  P->>D: yes
  D->>T: POST /swap (route, minOut, deadline)
  T->>T: build 3 calls: approve(Permit2), Permit2.approve(router), router.execute(V4_SWAP…)
  T->>T: Privy session signer signs meta-tx (owner)
  T->>A: requestAndApproveExecution (broadcaster) — each call whitelisted
  A->>U: execute(commands, inputs, deadline)
  U-->>A: EUR received
  T-->>D: receipt (tx hash, in/out)
  D->>P: "Done. New balance …"
```

### 3.1 Guard configuration (one-time, at Account Opening or first FX visit)

| Target | Selector | Purpose |
|--------|----------|---------|
| practice USD (`demoUsdc`) | `approve(address,uint256)` `0x095ea7b3` | allow Permit2 — the **only** token the account ever approves: the desk is one-way, so Practice EUR / ILS are never approve targets | 
| `Permit2` | `approve(address,address,uint160,uint48)` `0x87517c45` | allow Universal Router | 
| `UniversalRouter` | `execute(bytes,bytes[],uint256)` `0x3593564c` | perform the swap | 

Each pair is a `FunctionSchema` registration (`registerFunctionSchema`) plus `addToWhitelist` in a guard config batch (see [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) § 3). This is the security story for the write-up: **the account can only talk to those three contracts with those three selectors**. Nothing else the Dealer says can move funds. Proven the other way round by K7-e: the same `execute` call aimed at the PoolManager is refused `TargetNotWhitelisted`.

**The whitelist alone opens nothing** — the same V4 lesson as Lane A. A second, `RuntimeRBAC` batch grants OWNER
`SIGN_META_REQUEST_AND_APPROVE` and BROADCASTER `EXECUTE_META_REQUEST_AND_APPROVE` on each of the three selectors;
without it `requestAndApproveExecution` reverts `NoPermission`. Both batches landed 2026-09-08:

| Batch | Contents | Hash | Gas |
|-------|----------|------|-----|
| Guard | 3 × `registerFunctionSchema` + 3 × `addTargetToWhitelist` | [`0x38f28f37…`](https://sepolia.etherscan.io/tx/0x38f28f3788dbe62f88ea2307f165e0362b0b073567a615a8a32f1614e8bd6128) | 2,880,708 |
| Role | 6 × `addFunctionToRole` | [`0xef7b253d…`](https://sepolia.etherscan.io/tx/0xef7b253df409a82c2d05c7b201861590761faa2cd089db7791b690efdf1002e5) | ~2.6 M |

> **The grant's `handlerForSelectors` must be the selector itself, not `requestAndApproveExecution`.** Provisioning
> uses the latter for `transfer` on 1337 and is right to: the built-in schemas are registered in *flexible* mode.
> Every schema `registerFunctionSchema` adds is *strict* (`enforceHandlerRelations: true`) with a self-reference, so
> naming the handler reverts `HandlerForSelectorMismatch`. It costs nothing at run time — the dual permission check
> reads the **handler's** schema, which is flexible. Full reasoning in `lanes/fx.ts` `enableFx`.

### 3.2 Batching
`GuardController` execution is single-call per request. Options:
- **Three sequential Lane-A requests** (simplest; three signatures from the session signer — no user pop-ups anyway). Permit2 allowance can be set once with a long expiry, leaving one call per subsequent swap.
- A tiny `SwapHelper` contract the account calls once — rejected: adds an unaudited contract and dilutes "public SDK only".

Go with sequential; cache Permit2 approval so repeat swaps are one call.

### 3.3 Slippage and deadline
Quote → `minAmountOut = quote * (1 - 0.01)`, `deadline = now + 300`. The meta-tx itself has its own `deadline` in `MetaTxParams`; keep both aligned.

---

## 4. Game surface

- **FX Desk** in the main wing (Sepolia): an expanded east-wall window between the vault partition and the SECURITY lore door; Dealer NPC Kenji. Since 2026-09-09 the pair is a dialogue choice — **Euros** or **Shekels** — then 25 / 100 / 250 dollars.
- Quote board (LED) idles on both pools' mid rates (`1 USD ≈ 0.8610 EUR · 1 USD ≈ 3.0118 ILS`, read from each pool's `slot0`), then shows the quoted pair, rate, min out, pool fee tier, "quote valid 5:00" countdown driven by the deadline, and the till in USD / EUR / ILS.
- Receipt: in/out amounts, pool id, route, tx hash link.
- "Ask why" branch explains: *"I can only trade against the exchange the manager approved, and only through that door."*

---

## 5. Runbook (activated)

1. Resolve addresses from the deployments page; write to `infra/deployments/sepolia.json`.
2. ~~Ensure a `demoUSDC/WETH` pool with liquidity exists~~ → since 2026-09-09: `npm run fx:pools-fiat` deploys Practice EUR / ILS and seeds both fiat pools (§2b); `fx:pool` is history.
3. Add guard batch for the three selectors to the provisioner (flag `--fx` / first FX visit).
4. Implement `/fx/quote?amount&pair=EUR|ILS` (V4Quoter via viem `simulateContract`) and `/fx/swap {quoteId | amount + pair}` in Teller Desk.
5. Bridge + Dealer dialogue + quote board + FX desk viz in Godot (see kickoff §F).
6. QA a swap end-to-end; link tx on Etherscan in README; commit `FEEDBACK.md`; submit Uniswap form.

Time estimate: 1–2 focused days end-to-end (infra + viz). Prefer Fable 5.1. Do not start Arc revive from this unit.

---

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| Encoding `V4_SWAP` commands/inputs by hand is error-prone | Use the `@uniswap/universal-router-sdk` / `@uniswap/v4-sdk` to build calldata; only pass bytes to the account |
| Sepolia pool with no liquidity | Seed our own pool; small amounts |
| Judges see "generic swap" | Lead with the guard story; show the whitelist in-game (Manager's office board) |
