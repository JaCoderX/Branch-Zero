---
title: Sepolia Live — payment wing + Developer Mode
created: 2026-09-08
status: met 2026-09-08
product: Branch-Zero
handoff: docs/missions/HANDOFF-sepolia-live.md
kickoff: docs/missions/KICKOFF-sepolia-live.md
---

# Sepolia Live — Main wing on public Sepolia, Remote EVM as Developer Mode

> **Goal:** Outside users and judges play a **full Sepolia** bank. Remote EVM `1337` stays available only as
> **Developer Mode** (desk debug). ENS stays Sepolia. FX stays Sepolia and requires a real Sepolia account.

Related: [PLAN.md](./PLAN.md) · [REMOTE-EVM.md](./REMOTE-EVM.md) · [SECURITY-AND-KEYS.md](./SECURITY-AND-KEYS.md) ·
[UNISWAP.md](./UNISWAP.md) · [ENS.md](./ENS.md) · [HANDOFF-sepolia-live.md](./missions/HANDOFF-sepolia-live.md)

---

## 1. Decision (locked)

| Mode | Payment wing (Ines / Dev / Bob / Okafor / faucet / OBSERVER) | ENS | FX |
|------|---------------------------------------------------------------|-----|-----|
| **Live** (product default) | Sepolia `11155111` | Sepolia | Sepolia — prefer **same** AccountBlox as Main |
| **Dev** (Developer Mode) | Remote EVM `1337` (private lab) | Sepolia (unchanged) | Sepolia — separate till; must refuse without a real Sepolia account |

- Remote EVM is **never** public infra. No Tailscale share for judges.
- Dev/Live is a **session profile** in desk debug — not a lobby elevator, not Arc.
- Arc remains **DEFERRED**; do not conflate Dev/Live with `switchWing` Arc.
- MockChain (`?mock=`) stays offline canned data — distinct from Dev mode.

---

## 2. Runtime shape

Reuse the Arc dual-desk pattern (`/api` vs `/arc-api`):

| Profile | Chain | Suggested proxy | Process |
|---------|-------|-----------------|---------|
| Live | Sepolia | `/api` → Live Teller (`CHAIN_ID=11155111`) | Public / default |
| Dev | Remote EVM | `/dev-api` → Dev Teller (`CHAIN_ID=1337`) | Local only when Remote EVM is up |

Desk debug toggle: **Live | Dev**. On switch: `/session` on the target desk, rebind passbook, update board
chain label, never reuse a 1337 account address on Sepolia.

Privy: `supportedChains` include Sepolia + Remote EVM; per-mode policy pins `chainId` + `verifyingContract` to the
active Main account. FX always needs a Sepolia typed-data rule for the till (or the unified Live account).

---

## 3. Build sequence (suggested)

1. **Sepolia payment bootstrap** — CopyBlox + demo/practice token + deployment record; Teller accepts
   `CHAIN_ID=11155111` / target `sepolia`; provision + Lane A smoke on Etherscan.
2. **Dual desk + Dev/Live toggle** — second Vite proxy; desk-debug mode control; session rebind; board/passbook
   show active payment chain.
3. **Unify Live Main ↔ FX** — one Sepolia AccountBlox for Counter and Kenji when Live; Dev keeps Main≠till.
4. **FX honesty** — require real Sepolia account; bank lines: FX only works on Sepolia.
5. **ENS Live path** — resolve → pay on Sepolia; Dev path keep resolve Sepolia → pay 1337.
6. **Defaults + docs** — Live default; funding runbook (§4); SECURITY env table; progress note + REFLECTION row.

---

## 4. Funding runbook — all moving parts (Sepolia)

Testnet assets only. Never put Ganache-parity / Remote EVM keys on Sepolia.

### 4.1 Faucets (canonical)

> **Drop them on the treasury.** Since S3 every faucet claim goes to **`SEPOLIA_TREASURY_PK`** first, and the
> staff wallets are topped from there to `need × 1.25` — in the background or with one command. Get the
> address (and the current shortfall) from `npm -w infra run funding:sepolia`; see
> [SEPOLIA-TREASURY.md](./SEPOLIA-TREASURY.md). Funding role addresses one at a time still works and is the
> fallback when no treasury is configured, but it costs a day's drop per address.

| Asset | Faucet | What you get | Limits (as published) | Send it to |
|-------|--------|--------------|------------------------|------------|
| **ETH (gas)** | [Google Cloud — Ethereum Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) | **0.05 ETH** | **Once per day** per eligibility (plan top-ups; do not burn a day’s drop on a failed OOG experiment) | **treasury** |
| **USDC** | [Circle Testnet Faucet](https://faucet.circle.com/) — network **Ethereum Sepolia** | **20 USDC** | One request per asset+network pair every **2 hours** | **treasury** |

Circle’s public faucet is USDC/EURC/cirBTC — not native ETH. For ETH use Google Cloud (above). Circle’s FAQ also
points native test ETH/POL at their Developer Console for Circle Wallets only; Branch Zero operator keys are
ordinary EOAs → **Google Cloud for ETH**.

### 4.2 Two different “USDC”s (do not confuse)

| Token | Address (Sepolia) | How to fund | Used for |
|-------|-------------------|-------------|----------|
| **Branch Zero practice / demo USDC** | `0xD3322B29a7BdEe707D1684676f149bf41Aa3422f` (open mint; see `infra/deployments/sepolia.json`) | Deployer (or mint script) after it has **ETH** | Ines faucet, Counter pays, FX pool currency0 / Kenji swaps |
| **Circle test USDC** | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (pinned in `sepolia.json` as `tokens.circleUsdc`; [Circle docs](https://developers.circle.com/stablecoins/usdc-contract-addresses)) | [faucet.circle.com](https://faucet.circle.com/) → Ethereum Sepolia → 20 USDC → **treasury** | Ops float on the treasury, optional operator checks, CCTP/Arc experiments — **not** the in-game practice token unless a future unit migrates. The treasury **holds** it and never auto-sends it |

**Live Main practice dollars** stay the open-mint demo token unless the principal explicitly migrates. Fund
**ETH** on the deployer first; then mint/transfer practice USDC in-process (Ines `/faucet` / provision).

### 4.3 Who needs what

Fund **each address separately** (Google Cloud = 0.05 ETH/day/address). Prefer distinct throwaways per role.

| Role | Env key(s) | Needs ETH? | Needs Circle USDC? | Needs practice USDC? | Notes |
|------|------------|------------|--------------------|----------------------|-------|
| **Ops treasury** | `SEPOLIA_TREASURY_PK` | **Yes — this is where the drops land** | Yes (collects) | Optional float | Holds **no** role on any player account; only sends. `need × 1.25` top-ups to the rows below (SEPOLIA-TREASURY §4) |
| **Live Main deployer** | `SEPOLIA_DEPLOYER_PK` (or Live desk `DEPLOYER_PK` when `CHAIN_ID=11155111`) | **Yes** — cloneBlox / initialize / mint practice USDC / `OWNER_GAS` tops | No | Holds mint rights / treasury for faucet | Highest gas consumer at Account Opening |
| **Live Main broadcaster** | `SEPOLIA_BROADCASTER_PK` / Live `BROADCASTER_PK` | **Yes** — every meta-tx gas | No | No | Alarm if balance ≪ ~0.05 ETH |
| **Live Main manager** | Live `MANAGER_PK` | **Yes** — Priority submit / cancel | No | No | Smaller; still fund before demo |
| **Recovery** | address only on server | Cold / optional | No | No | Do not hot-fund on the demo host |
| **ENS registrar** | `ENS_REGISTRAR_PK` | **Yes** — claim / setText / setAddr | No | No | Already Sepolia-only |
| **FX broadcaster** | `SEPOLIA_BROADCASTER_PK` | **Yes** — enableFx batches + swaps (~0.01+ ETH headroom) | No | No | May be **same key** as Live Main broadcaster if Live unifies desks — still one funded EOA |
| **FX deployer** | `SEPOLIA_DEPLOYER_PK` | **Yes** if cloning tills | No | Optional seed | May share Live Main deployer when Live unifies |
| **Player embedded wallet** | Privy (per user) | **Yes** for Lane B owner txs | No | Via Ines faucet (practice) | Desk tops native gas from deployer (`OWNER_GAS_ETH`) at provision — deployer must hold ETH |
| **Operator laptop (you)** | — | Optional | Optional via Circle | Optional | Useful for manual Etherscan checks |

### 4.4 Suggested funding order (operator)

1. Create / confirm **Sepolia throwaway** keys for the **ops treasury**, Live deployer, broadcaster, manager and ENS registrar (and FX if not shared). Record **addresses** in a local note; never commit keys. Keep them distinct — the treasury refuses to share a key with a staff role unless you opt in (`SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=on`).
2. Run `npm -w infra run funding:sepolia`. It prints the treasury address, its ETH / Circle USDC / practice balances, and each staff wallet against `need` and `need × 1.25`.
3. Claim to the **treasury address**: [Google Cloud Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) **0.05 ETH** (daily) and, if you want the ops float, [Circle faucet](https://faucet.circle.com/) → Ethereum Sepolia → **20 USDC** (every 2 h). Then `npm run treasury:topup` (dry run) and `-- --execute` to rebalance. Circle's USDC never becomes Ines' practice dollars — different token.
4. Set `SEPOLIA_RPC_URL` + keys in `.env`. Start Live desk (`CHAIN_ID=11155111`).
5. Bootstrap CopyBlox + practice token on Sepolia if missing (`npm run chain:bootstrap -- --chain sepolia` or documented equivalent). Confirm addresses in `infra/deployments/sepolia.json`.
6. Smoke: provision → Lane A pay → Etherscan. Then ENS claim. Then FX enable/swap (or unified account path).
7. Dev desk: keep funding Remote EVM from lab genesis (no public faucet). Never paste those keys into Sepolia env slots.

**Steady-state (shipped, S3):** faucet drops go to **`SEPOLIA_TREASURY_PK`** first, then staff wallets are
topped to `need × 1.25` — in the background (before an Account Opening and on an interval) or with
`npm run treasury:topup -- --execute`. See [SEPOLIA-TREASURY.md](./SEPOLIA-TREASURY.md). With no treasury
configured, nothing breaks: fund role addresses directly as in the table above.

### 4.5 Gas budget reminders (Sepolia)

| Operation | Order-of-magnitude | Implication |
|-----------|-------------------|-------------|
| `CopyBlox.cloneBlox` | ~16M gas | Needs a healthy ETH balance at current base fee |
| FX guard + role enable | ~5M combined (measured S1b) | Don’t soft-cap gas; hard-fail if underfunded |
| Routine pay / wire meta-tx | ≪1M | Broadcaster drip |

If a day’s 0.05 ETH is spent on a failed batch, wait for the next Google Cloud drop or use a second address.

### 4.6 Public demo host

- Run **Live desk only** (Sepolia). Do not expose Remote EVM.
- Pre-fund the **treasury**, then `npm run treasury:topup -- --execute`, and confirm `funding:sepolia` shows deployer + broadcaster + manager + ENS at or above need before any judge link goes live.
- Practice faucet rate-limit remains; practice USDC is minted, not Circle-faucet drained.

---

## 5. Out of scope

Arc revive, ship packaging video, sharing Remote EVM, migrating practice token to Circle USDC (unless principal orders), Privy Global Wallet / bloxchain.app SaaS edits.

---

## 6. Definition of done (unit) — **MET 2026-09-08**

- [x] Live: full Main wing on Sepolia (provision, pay, wire, Priority, practice faucet, OBSERVER) with Etherscan evidence
- [x] Dev: desk-debug toggle → Remote EVM Main; ENS/FX still Sepolia
- [x] FX refuses without a real Sepolia account; copy states Sepolia-only
- [x] Live default; funded-key runbook followed; no Ganache keys on Sepolia
- [x] Progress note + REFLECTION decision row; HANDOFF-CC § updated

### 6.1 Evidence (live Sepolia, 2026-09-08)

Bootstrap: **CopyBlox `0x443ECf1678963D2E49B4B3Ed4f77Af5182DE824b`** (2,480,829 gas), clone implementation
`0xB5e8ab92…` (the S1 FX till), practice token reused, not redeployed.

| What | Proof |
|------|-------|
| Account Opening — `cloneBlox` on Sepolia | account [`0xf8EECc6B…A984`](https://sepolia.etherscan.io/address/0xf8EECc6B3e612811C697B5F006a89C975D5eA984), owner `0x28C3D771…7364`, roleSet 3 |
| K2 — session signer recovers to `owner()` | `recover(digest) == owner()` on `0xf8EECc6B…`, chainId 11155111, domain `Bloxchain` |
| K5 — policy denies another account | `policy_violation` (HTTP 400) for `verifyingContract 0xB5e8ab92…` |
| Lane A pay | [`0x9e77e5b8…`](https://sepolia.etherscan.io/tx/0x9e77e5b8ddf8b04f6db41bc1bbf95294ceccd17cc1ab502c6e086ee7faf724ff) |
| Lane B wire → timed release | [`0xf729d387…`](https://sepolia.etherscan.io/tx/0xf729d3874008482d5b06d6fdd2512741ce7cbee267c55119c3f449e29e08ab9b) (COMPLETED after the clock); early approve reverted `BeforeReleaseTime`; recall [`0x1399fdb4…`](https://sepolia.etherscan.io/tx/0x1399fdb47ab2ac4b7642832da80d81de2d79f66b8abdb0f3458fc40757184939) |
| Priority release (Okafor, 84 s early) | [`0xb2a202ca…`](https://sepolia.etherscan.io/tx/0xb2a202ca094691cb9e3f518c810dc5b64c995b17655f2f7aa03a9988d38203bb) — manager `0x1a4Dc6ea…9139` submits the owner-signed meta-approve |
| Manager has no timed stamp (U4+) | `NoPermission` before **and** after `releaseTime` (Y2b / Y7b) |
| Practice faucet | [`0x1d9bee7f…`](https://sepolia.etherscan.io/tx/0x1d9bee7fd3ee5841daef7c6a2c77fa1c110df193726141f1a3c053d7aed1c553) restore + already-full no-op |
| OBSERVER grant / revoke | [`0x36aea1e3…`](https://sepolia.etherscan.io/tx/0x36aea1e3f0fcab41b1a8161e1d5e19fab7ca8ffd91acedb01420ed75b33ca245) / [`0xdd6b0c8c…`](https://sepolia.etherscan.io/tx/0xdd6b0c8c0045b4011c5808a79fb153d7c7eace9d7729d5ddfdc28431a5e38847) — zero function permissions, 9/9 |
| ENS Live pay-by-name | `u5-mtskrdyt.branchzero.eth` → `0xf8EECc6B…`, paid on **Sepolia** [`0x44bfdb21…`](https://sepolia.etherscan.io/tx/0x44bfdb2163a5d4a97e1cf8737646eadf1a0454658bd105276f1019fafa767640); duplicate → `NAME_TAKEN` |
| FX on the unified Live till (K7 re-run) | till **is** the Main account `0xB5e8ab92…`; swap [`0xd1d9cd8e…`](https://sepolia.etherscan.io/tx/0xd1d9cd8eaac73cdc52eb5e6ce8327c868e91ee8c08e22d37d864e93391feadd6) 0.5 USDC → 0.000108 WETH; wrong door → `TargetNotWhitelisted` |

Suites, all green: `killtests` (K2/K5/Lane A), `killtests:u2` (V6 + Lane B 1–4), `killtests:u4plus` (Y0–Y9),
`killtests:observer` (O0–O6, 9/9), `smoke:faucet`, `killtests:u5` (G6 a–e), `killtests:s1 -- --amount 0.5`
(K7 a–f), and the new `killtests:s2` (S2-1…6) **on both wings**. Godot on a 4.5.2 host: `run_checks`,
`run_mock_walk`, `run_fx_walk`, `run_faucet_walk`, `run_viz_budget` — all PASS. `npm run typecheck` clean.

### 6.2 Re-run

```bash
npm -w infra run funding:sepolia                     # who needs ETH, what it pays for, what is short
npm run dev:teller                                   # Live  desk :8787  -> /api
npm run dev:teller:dev                               # Dev   desk :8788  -> /dev-api  (needs Remote EVM up)
npm -w apps/teller-desk run killtests:s2             # Live/Dev invariants (read-only)
npm -w apps/teller-desk run killtests:s2 -- --dev    # ...the same, against the Dev desk
```

### 6.3 Findings worth keeping

1. **A public RPC's `eth_estimateGas` can return its own gascap, not a requirement.** publicnode caps both
   estimation and `eth_sendRawTransaction` at `0x1000000` (16,777,216). `cloneBlox` is measured at ~16.65 M, so
   the estimate comes back *at* the cap looking like a real number; adding the usual headroom made the send fail
   `gas limit too high`. Headroom must only be added below the ceiling — `MAX_TX_GAS` + `CLONE_BLOX_MIN_GAS` in
   `lanes/provision.ts`.
2. **`OWNER_GAS_ETH` and `tickChain()` were both lab-shaped.** 0.05 ETH of owner gas is free on 1337 and an
   entire faucet drop per player on Sepolia (Live: 0.003). `tickChain()` mines an empty block to unfreeze the
   lab's on-demand clock; on a scheduled chain its 2-second staleness check fires constantly and it would have
   paid real gas for a no-op before **every** vault operation. It is now lab-only.
3. **"Which account is this owner's on this chain" has more than one answer.** Account recovery consulted
   `BloxCloned` logs only, so on Sepolia it would have cloned a duplicate (16.2 M gas) beside the AccountBlox
   the owner already had from S1. It now also adopts a deployment fixture whose recorded owner matches —
   which is what makes Live's Main account and FX till the *same* contract for that player.
4. **A refusal must not masquerade as an outage.** The new "is this really a Sepolia AccountBlox of yours"
   gate first reported `FX_RPC` ("Kenji can't reach the exchange floor") for a contract with no `owner()`,
   because the read was wrapped in the generic RPC guard. `getCode` had already answered, so a failing
   `owner()` is a fact about the contract: it is now `FX_TILL_NOT_SEPOLIA`. Caught by S2-4.
