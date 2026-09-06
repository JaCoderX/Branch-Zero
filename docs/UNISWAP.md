# Uniswap v4 Integration — The FX Desk (stretch S1)

> Status: **documented swap-in, not on the critical path.** If Arc fails kill test K3 on Day 1, this replaces the Arc wing as sponsor #3. Otherwise it ships only if Day 8 has slack.

Related: [PLAN.md](./PLAN.md) § 3 (tier S1) · [REFLECTION.md](./REFLECTION.md) § Sponsor matrix · [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) § 3 (guard config batch)

Docs: [Universal Router](https://docs.uniswap.org/contracts/universal-router/overview) · [v4 swap via Universal Router](https://docs.uniswap.org/contracts/v4/quickstart/swap) · [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments) · [Permit2](https://docs.uniswap.org/contracts/permit2/overview) · [v4 Quoter](https://docs.uniswap.org/contracts/v4/reference/periphery/lens/V4Quoter)

---

## 1. Prize framing

Uniswap Foundation prize wording (from the ETHOnline 2026 page) rewards products built on **v4 hooks, the Universal Router, or the v4 SDK** with real UX. Branch Zero's angle:

> **A swap executed by a governed account through the bank's guard rails.** The Dealer NPC quotes with the v4 Quoter; the swap goes through `GuardController` as a whitelisted, selector-scoped call to the Universal Router. The player never approves a token spend in a wallet modal, and the account's policy caps what the Dealer can do.

This is not "a swap UI"; it is "swaps as a permissioned treasury operation", which fits the bounty's interest in novel access/UX patterns.

---

## 2. Contracts (Sepolia — `VERIFY` at deployments page)

| Contract | Role | Address |
|----------|------|---------|
| `PoolManager` | v4 singleton | `VERIFY` |
| `UniversalRouter` | entry point for swaps | `VERIFY` |
| `V4Quoter` | off-chain quotes (`quoteExactInputSingle`, `eth_call` only) | `VERIFY` |
| `StateView` | pool state reads | `VERIFY` |
| `Permit2` | token allowance to router | `0x000000000022D473030F116dDEE9F6B43aC78BA3` (canonical) |
| Demo pool | `demoUSDC / WETH` (we create + seed on Day 8, or use an existing Sepolia test pool) | `VERIFY` |

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

Each pair is a `FunctionSchema` registration (`registerFunctionSchema`) plus `addToWhitelist` in a guard config batch (see [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) § 3). This is the security story for the write-up: **the account can only talk to those three contracts with those three selectors**. Nothing else the Dealer says can move funds.

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

## 5. Day-8 runbook (if activated)

1. Resolve addresses from the deployments page; write to `infra/deployments/sepolia.json`.
2. Ensure a `demoUSDC/WETH` pool with liquidity exists (create + seed via v4 `PositionManager` script if none).
3. Add guard batch for the three selectors to the provisioner (flag `--fx`).
4. Implement `/quote` (V4Quoter via viem `simulateContract`) and `/swap` in Teller Desk.
5. Dealer dialogue + quote board in Godot.
6. QA a swap end-to-end; link tx on Etherscan in README.

Time estimate: 1 focused day. Do not start unless Days 1–7 are green.

---

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| Encoding `V4_SWAP` commands/inputs by hand is error-prone | Use the `@uniswap/universal-router-sdk` / `@uniswap/v4-sdk` to build calldata; only pass bytes to the account |
| Sepolia pool with no liquidity | Seed our own pool; small amounts |
| Judges see "generic swap" | Lead with the guard story; show the whitelist in-game (Manager's office board) |
