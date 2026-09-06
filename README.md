# Branch Zero

**A walkable 3D bank where every desk is a real smart-account operation.** Built in Godot 4.5 (web, GDScript) on top of the open-source [Bloxchain](https://github.com/PracticalParticle/Bloxchain-Protocol) account pattern, driven only through the public npm packages `@bloxchain/sdk` and `@bloxchain/contracts`. You do not click "Confirm" in a wallet pop-up; you talk to a teller. For [ETHOnline 2026](https://ethglobal.com/events/ethonline2026) (Start Fresh).

**Start here**

- Cold agent / Claude Code: [`docs/HANDOFF-CC.md`](./docs/HANDOFF-CC.md)
- Plan and gates: [`docs/PLAN.md`](./docs/PLAN.md) · construction units: [`docs/DEV-LOOP.md`](./docs/DEV-LOOP.md)
- Doc index: [`docs/README.md`](./docs/README.md) · honest review + kill-test log: [`docs/REFLECTION.md`](./docs/REFLECTION.md)
- Daily evidence: [`docs/progress/`](./docs/progress/)

**Status:** U0 Foundation (G1) landed 2026-09-06 — scaffold, Godot 4.5.2 single-threaded web build talking JSON to `window.BranchZero`, `AccountBlox` deployed and read back on Remote EVM `1337`. Signing lane (Privy), greybox bank, ENS, Arc: not started.

---

## Layout

```text
apps/game/          Godot 4.5.2 project (GDScript). autoload/chain.gd is the ONLY JavaScriptBridge user. Never holds keys.
apps/web/           Vite + React shell. index.html hosts the canvas; src/bridge installs window.BranchZero (@bloxchain/sdk reads).
apps/teller-desk/   Fastify service. U0: /healthz + 501 stubs for the lane routes. Signing/broadcasting arrive in U1/U2.
packages/shared/    viem chain configs (remoteEvm 1337, sepolia), dev-role addresses, bridge protocol types, deployments schema.
infra/scripts/      compile.ts (solc 0.8.35 over the published sources) · deploy-account.ts · smoke.ts · probe.ts
infra/deployments/  remote-evm.json — addresses, tx hashes, compiler + source pins. Never keys.
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

### 3. Deploy `AccountBlox` on 1337 and read it back

```bash
npm run chain:compile   # ~1 min: solc-js compiles @bloxchain/contracts sources + the pinned AccountBlox template → infra/build/
npm run chain:deploy    # deploys the 4 definition libraries (or attaches), deploys + initialises AccountBlox, SDK owner() check
npm run chain:smoke     # re-runnable K4 check from infra/deployments/remote-evm.json (no keys needed)
```

`chain:deploy -- --fresh` redeploys the libraries (after a chain wipe); `-- --label <name>` adds another account to the record.

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

Open http://localhost:5173. The cube scene asks the bridge for `echo`, `chainInfo` and `accountInfo`; the on-canvas label and the overlay show the answers, including `owner()` of the deployed account read through `@bloxchain/sdk`. No COOP/COEP headers are sent; the build is single-threaded so none are needed.

## Hard rules (from `docs/HANDOFF-CC.md`)

Public `@bloxchain/sdk` + `@bloxchain/contracts` only; no custom Solidity, no path dependency on the protocol repo. Godot never holds keys and never talks to an RPC. No `JavaScriptBridge.eval`. Testnets and Remote EVM only. Remote EVM dev keys never touch a public network.

**Honest note on K4:** the public `@bloxchain/contracts` package ships source and ABIs but no bytecode and no `AccountBlox`. `infra/scripts/compile.ts` therefore compiles the published sources and fetches the unmodified `AccountBlox.sol` template from the public repository at the commit tagged `contracts-v1.0.0`, pinned by commit and sha256, into a git-ignored build directory. No Solidity is authored or vendored in this repository. See `docs/REFLECTION.md` kill-test log.

## AI tools

Planning and U0 construction were done with Claude Code (Claude Fable 5.1). See `docs/progress/` for what ran on each day.

Licence: MIT. Bloxchain contracts and SDK are MPL-2.0 (used as published, unmodified); the `AccountBlox` template is MIT.
