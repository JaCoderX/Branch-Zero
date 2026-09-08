---
title: Remote EVM — local chain for Branch Zero
created: 2026-09-06
updated: 2026-09-06
---

# Remote EVM

> **Since 2026-09-08 this chain is Branch Zero's *Developer Mode*, not the product default.** The Live Main
> payment wing is **Sepolia `11155111`** and it is what every player and judge gets
> ([SEPOLIA-LIVE.md](./SEPOLIA-LIVE.md)). `1337` is reached only from the desk-debug **Live | Dev** toggle or
> `?mode=dev`, served by a second Teller Desk (`npm run dev:teller:dev`, `:8788`, Vite `/dev-api`). It is
> **never** exposed as public infra — no Tailscale share for judges — and it is neither Arc's `switchWing` nor
> MockChain. Everything below still describes the chain itself and remains accurate.

Execution chain for **development and lab kill tests**. Public testnets are for sponsor proofs and things a private chain cannot fake (ENSv2, Uniswap v4, Arc USDC-gas).

Infra lives in **particle-tool-box**, not this repo. Do not vendor Nethermind here.

| | |
|--|--|
| Path | `D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM` |
| README | that folder's `README.md` |
| Client | Nethermind, genesis from `ganache-deterministic-accounts.json` |
| Chain id | **`1337`** (`0x539`) |
| RPC (host) | `http://127.0.0.1:8545` |
| RPC (office) | Tailscale Serve HTTPS or `http://<hostname>.<tailnet>.ts.net:8545` — hostname stays in local env, never committed |
| Gas limit | **Live block `gasLimit` = 16,777,216** (0x1000000), measured 2026-09-06 in U1 — the earlier "≈20M" was optimistic; treat 16.7M as the rule. Do **not** wipe volumes to chase a higher genesis number. Design all txs under this ceiling. |
| Instant finality | NethDev mining enabled — vault clock must still be **policy** (`releaseTime`), not "waiting for a block" |
| Block clock | **Mines on demand only.** Between transactions the latest block's `timestamp` is frozen while wall-clock time runs on. Anything a contract *view* derives from `block.timestamp` is therefore stale — see § 1a. |

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

> **Observed 2026-09-06 (U0, corrected in U1):** Nethermind `v1.39.3`, forks through **Prague** (no Osaka).
> Live block `gasLimit` is **16,777,216** — U0's 16.7M reading was the real number, not a stale one; the
> "≈20M operator ceiling" was wrong and is retracted. **Do not** `docker compose down -v` — shared lab data
> stays. Probe: `npm run chain:probe`.
>
> **Gas budget (U1, measured):**
>
> | Operation | Gas | % of a block |
> |---|---|---|
> | `AccountBlox.initialize` (U0, standalone) | 16.06 M | 95.7 % |
> | `CopyBlox.cloneBlox` (clone + initialize, one tx) | **16.20 M** used, ~16.65 M required | **99.2 %** |
> | `CopyBlox` deploy (one-time) | 2.48 M | 14.8 % |
> | demo ERC-20 deploy (one-time) | 0.84 M | 5.0 % |
> | guard config batch / role config batch / Lane A payment | well under 1 M each | — |
>
> `cloneBlox` therefore only fits **as the sole transaction in its block**. It works on this instant-mining
> dev chain, but there is essentially no headroom: if account opening ever starts failing, this is why.
> Anything that grows `initialize` (more schemas, more roles) breaks provisioning outright.

~~Wipe~~ — **forbidden for Branch Zero development** unless the principal explicitly orders a new chain. If a wipe ever happens, every address changes and `infra/deployments/remote-evm.json` must be regenerated.
### 1a. The frozen block clock (U2, 2026-09-06)

NethDev mines a block only when a transaction arrives. So `eth_call` — and every contract **view** — runs
against the last mined block, whose timestamp can be minutes or hours behind wall time, while a transaction
you send *now* is mined with the current time.

That asymmetry broke meta-transactions after an idle period. `createMetaTxParams(..., duration, ...)` is a
view returning `block.timestamp + duration`; sit idle for longer than the duration and every meta-tx is born
already expired. The symptom is confusing on purpose: `eth_call` **succeeds** (it replays against the stale
block) and the mined transaction **reverts** with unhelpful data, so pre-flight simulation says the call is
fine right up until it is not.

Rules that follow:

- Meta-tx durations are computed as `(now − latestBlockTimestamp) + TTL` — `metaTxDuration()` in
  `apps/teller-desk/src/chain.ts`. Never pass a bare TTL.
- The vault countdown ticks against **wall time**, not `chainNow`, because `releaseTime` will be compared to
  the timestamp of the block that mines the approval. `chainNow` is still reported for honesty.
- A pre-flight `eth_call` that passes is not proof a transaction will succeed on this chain.

Public testnets mine on a schedule and do not have this asymmetry; the drift correction is harmless there.

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
| **Anything a player or judge sees (the Live wing)** | **Sepolia** |
| ENSv2 name | Sepolia |
| Uniswap v4 | Sepolia |
| Arc bounty / USDC-as-gas | Arc Testnet |
| Judge explorer links in the video | Sepolia (and Arc if T2 shipped) |

Privy: prefer adding custom chain `1337` for local signing tests (ENG-0004). If the dashboard refuses, run K2 on Sepolia and keep Lane A/B logic on Remote EVM with a **local owner key** (account 4) until Privy is wired.

---

## 5. Godot / MockChain

Editor desktop play uses `MockChain.gd` ([GODOT.md](./GODOT.md) §4). Web integration tests should hit **Remote EVM** via the bridge, not MockChain, whenever you are proving Lane A/B or provision. MockChain is for greybox feel, not for kill tests.
