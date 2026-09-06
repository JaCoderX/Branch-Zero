# Branch Zero

**A walkable 3D bank where every desk is a real smart-account operation.** Built in Godot 4.5 (web, GDScript) on the open-source [Bloxchain](https://github.com/PracticalParticle/Bloxchain-Protocol) account pattern, driven through the public npm package **`@bloxchain/sdk`** (+ `viem`). You do not click "Confirm" in a wallet pop-up; you talk to a teller. For [ETHOnline 2026](https://ethglobal.com/events/ethonline2026) (Start Fresh).

**Start here**

- Cold agent / Claude Code: [`docs/HANDOFF-CC.md`](./docs/HANDOFF-CC.md) (**U2** mission)
- Plan and gates: [`docs/PLAN.md`](./docs/PLAN.md) · construction units: [`docs/DEV-LOOP.md`](./docs/DEV-LOOP.md)
- Doc index: [`docs/README.md`](./docs/README.md) · honest review + kill-test log: [`docs/REFLECTION.md`](./docs/REFLECTION.md)
- Daily evidence: [`docs/progress/`](./docs/progress/)

**Status:** U1 / G2 met 2026-09-06. Privy login + session signer + policy + Lane A payment all run on Remote EVM 1337 (**K2, K5, K8 PASS**). **U2 (time-locked wire) is next.**

---

## Layout

```text
apps/game/          Godot 4.5.2 project (GDScript). autoload/chain.gd is the ONLY JavaScriptBridge user. Never holds keys.
apps/web/           Vite + React shell. index.html hosts the canvas; src/bridge installs window.BranchZero (@bloxchain/sdk reads).
apps/teller-desk/   Fastify service. Holds the Privy authorization key + broadcaster key. /session /provision /pay /status /events.
                    src/signing/privySigner.ts is the signing lane; scripts/kill-tests.ts re-runs K2 / K5 / Lane A.
packages/shared/    viem chain configs (remoteEvm 1337, sepolia), dev-role addresses, bridge protocol types, deployments schema,
                    the two ABI fragments the SDK does not expose at runtime.
infra/scripts/      probe / smoke / bootstrap-blox (one-time CopyBlox + demo ERC-20) / historical U0 compile+deploy
infra/deployments/  remote-evm.json — AccountBlox fixture, CopyBlox, demo token. Never keys.
scripts/            export-web.mjs — headless Godot import + Web export into apps/web/public/game/
docs/               plan, architecture, integration notes, reflection, progress
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

## Hard rules (from `docs/HANDOFF-CC.md`)

Public **`@bloxchain/sdk` + `viem`** only for product runtime (plus Privy for identity/signing). No custom Solidity. No path dependency on the protocol repo for runtime — `npm run chain:bootstrap` reads already-built artifacts out of band and only addresses are committed. Godot never holds keys / never talks RPC. No `JavaScriptBridge.eval`. Testnets + Remote EVM only; **do not wipe** the lab chain; live block gas limit is **16,777,216** (measured — `cloneBlox` already uses 99.2 % of it). Remote EVM dev keys never touch a public network.

**K4 / packages:** U0 used a one-off compile to place a fixture account. Principal locked SDK-only + CopyBlox going forward. See `docs/REFLECTION.md`.

## AI tools

Planning and U0 construction: Claude Code (Fable 5.1). U1 construction: Claude Code (Opus 5). Lessons scrubbed into GameDevOS `wiki/lessons/`. See `docs/progress/`.

Licence: MIT. Bloxchain SDK is MPL-2.0.
