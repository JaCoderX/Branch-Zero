# Uniswap v4 Integration — The FX Desk (S1)

> Status: **MET 2026-09-08** (sponsor **#3**; Arc deferred). Pool, FX till, quotes, **guard + role config and the
> guarded swap are all live on Sepolia**. K7-a…f green. First swap
> [`0xd98efc64…`](https://sepolia.etherscan.io/tx/0xd98efc64e579758b04aa338b2ec777536839b7e48908000e6c6a0b93e8f686b3);
> guard batch `0x38f28f37…`, role batch `0xef7b253d…` (§3.1). Owed by a human: the Uniswap feedback form.
> S1b record: `docs/progress/2026-09-08-s1b-fx-validate.md`.
> Kickoff: [`KICKOFF-S1-fx-validate.md`](./KICKOFF-S1-fx-validate.md). Build kickoff:
> [`KICKOFF-S1-uniswap-fx.md`](./KICKOFF-S1-uniswap-fx.md). HANDOFF **§5i**. Local progress:
> `docs/progress/2026-09-08-s1-uniswap-fx.md`. Prize: `FEEDBACK.md` +
> [Uniswap hackathon feedback form](https://developers.uniswap.org/hackathon-feedback).

Related: [PLAN.md](./PLAN.md) § 3 (tier S1) · [REFLECTION.md](./REFLECTION.md) § Sponsor matrix · [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) § 3 (guard config batch) · [HANDOFF-CC.md](./HANDOFF-CC.md) §5i

Docs: [Universal Router](https://docs.uniswap.org/contracts/universal-router/overview) · [v4 swap via Universal Router](https://docs.uniswap.org/contracts/v4/quickstart/swap) · [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments) · [Permit2](https://docs.uniswap.org/contracts/permit2/overview) · [v4 Quoter](https://docs.uniswap.org/contracts/v4/reference/periphery/lens/V4Quoter)

---

## 1. Prize framing

ETHOnline 2026 **Best Uniswap Stack Contribution** (Start Fresh pool unless Continuity Track). Branch Zero's angle:

> **A swap executed by a governed account through the bank's guard rails.** The Dealer NPC quotes with the v4 Quoter; the swap goes through `GuardController` as a whitelisted, selector-scoped call to the Universal Router. The player never approves a token spend in a wallet modal, and the account's policy caps what the Dealer can do.

This is not "a swap UI"; it is "swaps as a permissioned treasury operation."

**Reset:** v4 only · Sepolia for FX · no custom SwapHelper · no new Privy modal · K7 = live Sepolia evidence.

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
| Demo pool | `USDC(demo) / WETH`, fee 0.30 %, tick spacing 60, no hook | id `0xfd32332c7bc1c1ab4b2cd2971b6e1eef513d610457504b8a19745413b678581f` |
| — pool `currency0` | the U5 Sepolia mock USDC, 6 decimals, open `mint` | `0xD3322B29a7BdEe707D1684676f149bf41Aa3422f` |
| — pool `currency1` | Sepolia WETH9 (the one the Uniswap deployments use) | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |
| **FX till** | the player's `AccountBlox` on Sepolia — the account that trades. **Since S2 (2026-09-08) this is the player's Live Main account itself** (`fxTillIsMain`): the Live wing is Sepolia, so Kenji trades out of the account the counter pays from. In Developer Mode it stays a separate Sepolia account, because a 1337 account cannot be a Sepolia till. | `0xB5e8ab92467663F50c6Ba237Cb062cE6Bf66B2Af` |

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

  P->>D: "Change 100 demoUSDC to ETH"
  D->>T: GET /quote?in=demoUSDC&out=WETH&amount=100
  T->>U: V4Quoter.quoteExactInputSingle (eth_call)
  T-->>D: 0.0312 WETH, min 0.0309 @ 1% slippage
  D->>P: quote board updates; "Accept?"
  P->>D: yes
  D->>T: POST /swap (route, minOut, deadline)
  T->>T: build 3 calls: approve(Permit2), Permit2.approve(router), router.execute(V4_SWAP…)
  T->>T: Privy session signer signs meta-tx (owner)
  T->>A: requestAndApproveExecution (broadcaster) — each call whitelisted
  A->>U: execute(commands, inputs, deadline)
  U-->>A: WETH received
  T-->>D: receipt (tx hash, in/out)
  D->>P: "Done. New balance …"
```

### 3.1 Guard configuration (one-time, at Account Opening or first FX visit)

| Target | Selector | Purpose |
|--------|----------|---------|
| `demoUSDC` | `approve(address,uint256)` `0x095ea7b3` | allow Permit2 | 
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

- **FX Desk** in the main wing (Sepolia); Dealer NPC Kenji.
- Quote board (LED) shows rate, min out, pool fee tier, "quote valid 5:00" countdown driven by the deadline.
- Receipt: in/out amounts, pool id, route, tx hash link.
- "Ask why" branch explains: *"I can only trade against the exchange the manager approved, and only through that door."*

---

## 5. Runbook (activated)

1. Resolve addresses from the deployments page; write to `infra/deployments/sepolia.json`.
2. Ensure a `demoUSDC/WETH` pool with liquidity exists (create + seed via v4 `PositionManager` script if none).
3. Add guard batch for the three selectors to the provisioner (flag `--fx` / first FX visit).
4. Implement `/quote` (V4Quoter via viem `simulateContract`) and `/swap` in Teller Desk.
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
