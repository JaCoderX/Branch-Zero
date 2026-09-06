# Arc Integration — The Arc Wing

> Same bank, second floor: the account contract is unchanged, but fees are paid in dollars and settlement is sub-second. That is the whole point of the elevator.

Related: [PLAN.md](./PLAN.md) § 3 (tier T2) · [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) (diagram is an Arc requirement)

Docs: [Add Arc to a wallet](https://docs.arc.io/integrate/wallets/add-arc-to-a-wallet) · [RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints) · Faucet: `faucet.circle.com` · Explorer: `testnet.arcscan.app` · [Circle Agent Stack starter kits](https://github.com/circlefin/agent-stack-starter-kits)

---

## 1. Prize target and criteria

Arc pool: **$10,000**. Realistic targets for Branch Zero (Start Fresh track):

| Bounty | Fit | Notes |
|--------|-----|-------|
| **Best DeFi / Onchain Finance Application — $1,667** | Strong: "payments, treasury or fintech infrastructure using Arc and USDC"; "conditional payments, onchain automation or multi-step settlement" = our time-locked wires and approvals | Primary Arc submission |
| **Launch on Arc Testnet & Push to Mainnet — $3,500 (1st $2,500)** | Medium: "USDC payment flows on Arc added to a wallet product"; requires **deployed or deployment-ready on Arc mainnet by Sep 30** | We can be deployment-ready (scripts + config for chain `5042`), but Bloxchain contracts are not audited for our use on mainnet and we will say so honestly; consider entering only if judges accept "ready, gated behind audit" |
| Best Agentic Economy Application (Agent Stack) | Weak unless we frame the Teller Desk as an agent using Circle Agent Stack; skip | — |

Qualification requirements (all Arc bounties): **functional MVP with working frontend + backend, an architecture diagram, video + presentation, detailed documentation, repo link, and a clear statement of which bounty.** [ARCHITECTURE.md](./ARCHITECTURE.md) § 1 is the diagram source; export it to PNG for the submission.

---

## 2. Network facts (verify on Day 1, kill test K3)

| Parameter | Arc Testnet |
|-----------|-------------|
| Chain ID | `5042002` (`0x4CEF52`) — mainnet is `5042`, do not mix |
| RPC | `https://rpc.testnet.arc.io` (also Blockdaemon / dRPC / QuickNode mirrors) |
| WebSocket | `wss://rpc.testnet.arc.io` |
| Native currency | USDC — **18 decimals at the native layer**, 6 decimals via the ERC-20 interface at `0x3600000000000000000000000000000000000000` |
| Fees | EIP-1559, paid in USDC |
| Finality | sub-second (Malachite), ~2 s block time |
| Explorer | `https://testnet.arcscan.app` |
| Faucet | `https://faucet.circle.com` |
| Signing | secp256k1, EIP-155 — identical to Ethereum |

viem chain definition (`packages/shared/chains.ts`):

```ts
import { defineChain } from 'viem';
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  testnet: true,
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } }, // VERIFY
});
```

Display rule: show USDC with **6** display decimals everywhere; convert native (18) balances before display.

---

## 3. What runs on Arc

| Component | Arc Testnet |
|-----------|-------------|
| Definition libraries | Deployed by us from `@bloxchain/contracts` artifacts (`infra/scripts/deploy-definitions.ts --chain arc`) |
| `AccountBlox` per player | Provisioned by the Arc-wing Clerk (same provisioner, `chainId = 5042002`) |
| Payments | Lane A / Lane B with **native USDC via the ERC-20 interface** at `0x3600…0000` as the whitelisted target for `ERC20_TRANSFER_SELECTOR`; or plain native transfer via `NATIVE_TRANSFER_SELECTOR` (value > 0, selector `0x00000000`-class flow per GuardController) — choose whichever passes K3 cleanly (`VERIFY` both) |
| Broadcaster / deployer gas | Faucet USDC to the Arc broadcaster and deployer keys |
| ENS | Read from Sepolia; `addr(coinType(5042002))` record points at the Arc account |
| Privy | Session signer policy includes `verifyingContract = <arc account>`; Privy `supportedChains` includes the custom Arc chain |

The game presents this as the **Arc wing**: identical layout, cool palette, signage about dollar-denominated fees and instant finality. The elevator is the chain switch (see [ARCHITECTURE.md](./ARCHITECTURE.md) § 3.5).

---

## 4. Why Arc strengthens the thesis (for the write-up)

- A bank should quote fees in the currency it holds. On Arc the "network fee" line on the receipt is `$0.00x`, not gwei.
- Time-locked wires on a sub-second-finality chain make the point that the delay is a **policy**, not a network limitation: the vault clock is the only thing slowing the money down.
- The same `AccountBlox` bytecode on both wings shows the account pattern is portable; only guards (whitelisted USDC address) differ.

---

## 5. Day 7 runbook

1. Fund deployer + broadcaster from the faucet; confirm `eth_chainId == 0x4cef52`.
2. Deploy definitions; deploy one test `AccountBlox`; `initialize`; smoke reads.
3. Guard batch: whitelist `0x3600…0000` for `ERC20_TRANSFER_SELECTOR`.
4. Lane A: transfer 1 USDC via meta-tx; confirm on Arcscan; confirm the receipt shows fee in USDC.
5. Lane B: 120 s wire; approve after release.
6. Wire the elevator; QA both wings in one session; record B-roll.
7. Export the architecture diagram (PNG) into `docs/assets/architecture.png`; add Arc section to README with explorer links.

**Mainnet-readiness statement (if entering the Launch bounty):** `infra/deployments/arc-mainnet.example.json` + chain definition for `5042`, a checklist in README ("what would have to be true to deploy to mainnet": audit scope, key custody, fee reserves), and no actual mainnet deployment during the hackathon.

---

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| EVM version mismatch (opcodes emitted by Solidity 0.8.35 vs Arc's EVM) | K3 on Day 1; if deployment fails, Arc becomes set dressing and Uniswap takes slot 3 |
| Public RPC best-effort limits | Use a provider mirror (QuickNode/dRPC endpoints listed by Arc) for the demo |
| Native 18-dec vs ERC-20 6-dec confusion | Single `formatUsdc()` helper in `packages/shared`; tests |
| Faucet limits | Request early; keep a small reserve wallet |
| Judges expect Circle App Kits / Wallets usage | Not required for the DeFi bounty ("where relevant"); we state plainly what we use: Arc as settlement chain + USDC |
