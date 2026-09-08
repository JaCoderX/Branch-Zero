# Branch Zero

**A walkable 3D bank where every desk is a real smart-account operation.** Built in Godot 4.5 (web, GDScript) on the open-source [Bloxchain](https://github.com/PracticalParticle/Bloxchain-Protocol) account pattern, driven through the public npm package **`@bloxchain/sdk`** (+ `viem`). You do not click "Confirm" in a wallet pop-up; you talk to a teller. For [ETHOnline 2026](https://ethglobal.com/events/ethonline2026) (Start Fresh).

**The FX desk — Uniswap v4 (S1)**

Kenji's desk is a **Uniswap v4 swap executed by a governed smart account**, not by a wallet. The player's
`AccountBlox` on Sepolia is `msg.sender` to Permit2 and the Universal Router, and it may call exactly three
functions on exactly three addresses, because its own `GuardController` whitelist says so.

| What | Where |
|------|-------|
| The lane: guard batch, quote, swap, and why each step exists | [`apps/teller-desk/src/lanes/fx.ts`](./apps/teller-desk/src/lanes/fx.ts) — `enableFx` (the three schemas + whitelist + role grants), `quote` (V4Quoter), `swap` (V4_SWAP calldata) |
| The three whitelisted calls | `FX_FUNCTIONS` in the same file: `approve(address,uint256)` → demo USDC · `approve(address,address,uint160,uint48)` → Permit2 · `execute(bytes,bytes[],uint256)` → UniversalRouter |
| Desk routes | [`apps/teller-desk/src/server.ts`](./apps/teller-desk/src/server.ts) — `/fx/status` `/fx/quote` `/fx/enable` `/fx/swap` |
| Pool creation + seeding | [`infra/scripts/uniswap-pool.ts`](./infra/scripts/uniswap-pool.ts) (`npm -w infra run fx:pool`) |
| Addresses, pool id, encoding constants | [`docs/UNISWAP.md`](./docs/UNISWAP.md) § 2 · [`infra/deployments/sepolia.json`](./infra/deployments/sepolia.json) `uniswap` |
| In-game: dealer, board, desk | [`apps/game/dialogue/dealer.json`](./apps/game/dialogue/dealer.json) · [`apps/game/scripts/fx_board.gd`](./apps/game/scripts/fx_board.gd) · `_fx_desk()` in [`bank_interior.gd`](./apps/game/scripts/bank_interior.gd) |
| Kill test (K7) | `npm -w apps/teller-desk run killtests:s1` — [`scripts/kill-tests-s1.ts`](./apps/teller-desk/scripts/kill-tests-s1.ts) |
| Developer feedback for the sponsor | [`FEEDBACK.md`](./FEEDBACK.md) |

**Live on Sepolia now:** the v4 pool we created and seeded
([`0xfd32332c…`](https://sepolia.etherscan.io/address/0xE03A1074c86CFeDd5C142C4F04F1a1536e203543), USDC/WETH, 0.30 %),
the FX till [`0xB5e8ab92…`](https://sepolia.etherscan.io/address/0xB5e8ab92467663F50c6Ba237Cb062cE6Bf66B2Af)
(deployed + initialised, `owner()` = the player's Privy wallet), and real `V4Quoter` prices against that pool.
**Not yet live:** the guarded swap itself — the Sepolia teller ran out of gas money after seeding, and testnet
faucets are captcha-gated. It needs ≈0.007 ETH and one re-run of the kill test. We would rather say that than imply
a receipt we do not have; the honest limitation is repeated at the end of [`FEEDBACK.md`](./FEEDBACK.md).

**Start here**

- Plan and gates: [`docs/PLAN.md`](./docs/PLAN.md) · construction units: [`docs/DEV-LOOP.md`](./docs/DEV-LOOP.md)
- Doc index: [`docs/README.md`](./docs/README.md) · honest review + kill-test log: [`docs/REFLECTION.md`](./docs/REFLECTION.md)
- Demo / submission: [`docs/DEMO-SCRIPT.md`](./docs/DEMO-SCRIPT.md)

**Status:** U4 / G5 met 2026-09-07 — MVP frozen. The bank is walkable (Godot 4.5 web, single-threaded): Ines opens accounts,
Dev takes payments and routes big ones to the vault, Bob releases once the clock runs down, Mr. Okafor skips the
cooling for a hand scan (U4+ Priority release) or shreds — every desk a call through `window.BranchZero` (`u4.1`) to the same Teller Desk lanes that passed **K2, K5, K8, V6, Lane A, Lane B**
in U1–U2 on Remote EVM 1337. The vault door's clock is the record's own `releaseTime`, counted against the desk
clock; the lobby board lists what is cooling and the last receipts. Walk it without an inbox at
`http://localhost:5173/?mock=account`. U4 made it survive a judge's laptop: the canvas takes the keyboard back after
any overlay or Privy interaction, a dead or restarting Teller Desk shows as NPC lines and a reconnecting board, the
first load is measured (36 MB `.wasm` → 7 MB brotli). **U5 (ENS) is next.**

---

## Layout

```text
apps/game/          Godot 4.5.2 project (GDScript). autoload/chain.gd is the ONLY JavaScriptBridge user. Never holds keys.
apps/web/           Vite + React shell. index.html hosts the canvas; src/bridge installs window.BranchZero (@bloxchain/sdk reads).
apps/teller-desk/   Fastify service. Holds the Privy authorization key + broadcaster key. /session /provision /pay /wire /approve /cancel /status /events.
                    src/signing/privySigner.ts is the signing lane; scripts/kill-tests.ts re-runs K2 / K5 / Lane A.
packages/shared/    viem chain configs (remoteEvm 1337, sepolia), dev-role addresses, bridge protocol types, deployments schema,
                    the two ABI fragments the SDK does not expose at runtime.
infra/scripts/      probe / smoke / bootstrap-blox (one-time CopyBlox + demo ERC-20) / historical U0 compile+deploy
infra/deployments/  remote-evm.json — AccountBlox fixture, CopyBlox, demo token. Never keys.
scripts/            export-web.mjs — headless Godot import + Web export into apps/web/public/game/
docs/               plan, architecture, integration notes, reflection (agent ops / daily progress are local-only)
```

## Run it (Windows, Node ≥ 20)

### 1. Remote EVM (default dev chain, id 1337)

The chain lives in particle-tool-box `Docker Apps/Remote EVM` (Nethermind). Start it there, then verify:

```bash
curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"params\":[],\"id\":1}"
```

Expect `"result":"0x539"`. Details and the dev-role → address mapping: [`docs/REMOTE-EVM.md`](./docs/REMOTE-EVM.md). To point elsewhere (Tailscale Serve, a different RPC) set `REMOTE_EVM_RPC_URL` in `.env`; the scripts refuse to run Ganache-parity keys on any chain other than 1337.

### 2. Install and configure

```bash
npm install
cp .env.example .env    # then set DEPLOYER_PK to Remote EVM account 0 (dev-only key, never on a public network)
npm run chain:probe     # chain id, client, head block, dev-role balances
```

### 3. Chain bootstrap (one-time) and the account fixture

`CopyBlox` (the wallet factory) and a demo ERC-20 are already on 1337 and recorded in
`infra/deployments/remote-evm.json`. To place them on a fresh chain, point `BLOXCHAIN_PROTOCOL_DIR` at a built
Bloxchain-Protocol checkout and run:

```bash
npm run chain:bootstrap  # deploys published artifacts unchanged, records addresses + sha256; skips what exists
npm run chain:smoke      # SDK owner() / roles against the recorded fixture
```

Player accounts are then opened by `CopyBlox.cloneBlox` — clone + `initialize` in one transaction — with the
player's Privy wallet as owner. **Do not wipe Remote EVM.** Do not use `chain:compile` as the product path;
see [`docs/BLOXCHAIN-INTEGRATION.md`](./docs/BLOXCHAIN-INTEGRATION.md).

### 4. Godot 4.5.2 (standard build, **not** mono) and the web export

Install the official editor and export templates once (checksums in the release's `SHA512-SUMS.txt`):

- `Godot_v4.5.2-stable_win64.exe.zip` → unzip to `%LOCALAPPDATA%\Programs\Godot-4.5.2\` (portable; no PATH change)
- `Godot_v4.5.2-stable_export_templates.tpz` → unzip, copy `templates/*` to `%APPDATA%\Godot\export_templates\4.5.2.stable\`

Downloads: https://github.com/godotengine/godot/releases/tag/4.5.2-stable. Any other location: set `GODOT_BIN` to the `*_console.exe`. The lab's 4.7.1-mono is refused on purpose.

```bash
npm run export:web      # → apps/web/public/game/ (git-ignored). Web preset: Compatibility renderer, thread support OFF.
```

### 5. Serve the shell

```bash
npm run dev:web         # http://localhost:5173 — Godot canvas + bridge traffic overlay. Proxies /rpc → Remote EVM, /api → Teller Desk
npm run dev:teller      # http://127.0.0.1:8787/healthz
```

Open http://localhost:5173. The cube scene asks the bridge for `echo`, `chainInfo` and `accountInfo`; the
overlay is the Account Opening desk: **Sign in** → **Allow the teller to stamp my slips** (the one consent) →
**Open my account** → **Pay**. No COOP/COEP headers are sent; the build is single-threaded so none are needed,
and the Privy modal and embedded-wallet iframe render over the canvas without them (K8).

### 6. Kill tests

```bash
npm -w apps/teller-desk run killtests -- --fresh
```

Creates a Privy user with a delegated embedded wallet, opens an account for it, and asserts **K2**
(`recover(digest) == owner()`), **K5** (policy denies typed data for an account the wallet does not own) and a
real Lane A payment.

## Privy — what is used, and why it matters

Privy is the reason this game has one wallet modal instead of twenty. It is the Account Opening desk.

| Privy feature | How Branch Zero uses it | Where |
|---|---|---|
| React SDK + embedded EVM wallet | The player's wallet is created at the desk and becomes `OWNER_ROLE` on their own `AccountBlox` | `apps/web/src/overlay/useBranchZeroWallet.ts` |
| **Session signer** (key quorum) | Delegated **once**, with consent, so the Teller Desk can request `eth_signTypedData_v4` for bank slips without a pop-up | same file — `addSessionSigners` |
| **Policy** (per player) | Bounds that signer to Bloxchain meta-transactions **for that player's own account** (`verifyingContract`) on our chain. Everything else is denied by default | `apps/teller-desk/src/privy.ts` |
| Access tokens | Authenticate the player to the Teller Desk; the wallet they claim is checked at Privy against the token's user id | `identify()` in the same file |

The delegation is a genuine control, not a courtesy dialog: a user-controlled embedded wallet is owned by the
*user's* key quorum, so the server is refused (`401`) if it tries to attach a signer or policy itself. Only the
browser consent can grant signing rights — and **Revoke** is always visible at the desk.

Two honest limits, stated because they are load-bearing:

- Privy cannot see inside a meta-transaction's `executionOptions`, so it cannot police *amounts*. Routing large
  transfers to the time-locked lane is a Teller Desk rule, not an on-chain or policy guarantee. The real
  controls on what a signed slip can do are the account's own guards: payee whitelist, selector schema, role
  permissions, nonce, deadline, chain id.
- `domain.name` is not a matchable policy field, so the policy pins `verifyingContract` + `chainId` instead —
  which is the stronger half of the intent anyway.

## Hard rules

Public **`@bloxchain/sdk` + `viem`** only for product runtime (plus Privy for identity/signing). No custom Solidity. No path dependency on the protocol repo for runtime — `npm run chain:bootstrap` reads already-built artifacts out of band and only addresses are committed. Godot never holds keys / never talks RPC. No `JavaScriptBridge.eval`. Testnets + Remote EVM only; **do not wipe** the lab chain; live block gas limit is **16,777,216** (measured — `cloneBlox` already uses 99.2 % of it). Remote EVM dev keys never touch a public network.

**K4 / packages:** U0 used a one-off compile to place a fixture account. Principal locked SDK-only + CopyBlox going forward. See `docs/REFLECTION.md`.

## AI tools

Planning and U0 construction: Claude Code (Fable 5.1). U1 construction: Claude Code (Opus 5). U2 construction: Claude Code (Fable 5.1 / Opus 5). Lessons scrubbed into GameDevOS `wiki/lessons/`. Kill-test decisions live in [`docs/REFLECTION.md`](./docs/REFLECTION.md).

Licence: MIT. Bloxchain SDK is MPL-2.0.
