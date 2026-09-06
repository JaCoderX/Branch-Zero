---
title: Remote EVM — local chain for Branch Zero
created: 2026-09-06
updated: 2026-09-06
---

# Remote EVM

Default execution chain for **development and lab kill tests**. Public testnets are for sponsor proofs and things a private chain cannot fake (ENSv2, Uniswap v4, Arc USDC-gas).

Infra lives in **particle-tool-box**, not this repo. Do not vendor Nethermind here.

| | |
|--|--|
| Path | `D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM` |
| README | that folder's `README.md` |
| Client | Nethermind, genesis from `ganache-deterministic-accounts.json` |
| Chain id | **`1337`** (`0x539`) |
| RPC (host) | `http://127.0.0.1:8545` |
| RPC (office) | Tailscale Serve HTTPS or `http://<hostname>.<tailnet>.ts.net:8545` — hostname stays in local env, never committed |
| Gas limit | genesis `0x3938700` (60_000_000) |
| Instant finality | NethDev mining enabled — vault clock must still be **policy** (`releaseTime`), not "waiting for a block" |

---

## 1. Start / probe

```powershell
cd "D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM"
# if needed: copy .env.temp .env
docker compose up -d
```

```bash
curl -s -X POST http://127.0.0.1:8545 `
  -H "Content-Type: application/json" `
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"params\":[],\"id\":1}"
```

Expect `"result":"0x539"`.

Wipe (new genesis, all addresses change):

```bash
docker compose down -v
docker compose up -d
```

Then redeploy definitions + accounts; update `infra/deployments/remote-evm.json`.

---

## 2. Dev accounts (lab only)

Ten Ganache-parity accounts, 1000 ETH each. **Never use these keys on Sepolia, Arc, or mainnet.**

Suggested Branch Zero mapping (document if you change it):

| Role | Index | Address |
|------|-------|---------|
| Deployer | 0 | `0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1` |
| Broadcaster | 1 | `0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0` |
| Recovery | 2 | `0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b` |
| Manager (T3) | 3 | `0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d` |
| Player owner (no Privy) | 4 | `0xd03ea8624C8C5987235048901fB614fDcA89b117` |

Private keys: `ganache-deterministic-accounts.json` in the Remote EVM folder. Put them in **local** `.env` only.

EIP-712 `chainId` is `1337` here. A signature for Remote EVM **cannot** replay on Sepolia. That is intended.

---

## 3. Product wiring

`packages/shared` should export a viem `defineChain`:

```ts
export const remoteEvm = defineChain({
  id: 1337,
  name: 'Remote EVM',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.REMOTE_EVM_RPC_URL ?? 'http://127.0.0.1:8545'] } },
});
```

Env (Teller Desk / infra):

```
REMOTE_EVM_RPC_URL=http://127.0.0.1:8545
# or Tailscale Serve URL when the agent is not on the Docker host
```

Demo USDC: deploy a **minimal mintable ERC-20 from a public well-known artifact or a tiny script in `infra/`** only if no published test token exists on 1337 (none will). This is **not** Bloxchain protocol source. Keep it obviously a test faucet token. Alternatively reuse an OpenZeppelin ERC20 from npm bytecode — still not a Bloxchain fork.

---

## 4. When you must leave this chain

| Need | Chain |
|------|--------|
| ENSv2 name | Sepolia |
| Uniswap v4 | Sepolia |
| Arc bounty / USDC-as-gas | Arc Testnet |
| Judge explorer links in the video | Sepolia (and Arc if T2 shipped) |

Privy: prefer adding custom chain `1337` for local signing tests (ENG-0004). If the dashboard refuses, run K2 on Sepolia and keep Lane A/B logic on Remote EVM with a **local owner key** (account 4) until Privy is wired.

---

## 5. Godot / MockChain

Editor desktop play uses `MockChain.gd` ([GODOT.md](./GODOT.md) §4). Web integration tests should hit **Remote EVM** via the bridge, not MockChain, whenever you are proving Lane A/B or provision. MockChain is for greybox feel, not for kill tests.
