# Branch Zero

**A walkable 3D bank where every desk is a real smart-account operation.** Built in Godot 4.5 (web, GDScript) on the open-source [Bloxchain](https://github.com/PracticalParticle/Bloxchain-Protocol) account pattern, driven through the public npm package **`@bloxchain/sdk`** (+ `viem`). You do not click "Confirm" in a wallet pop-up; you talk to a teller. For [ETHOnline 2026](https://ethglobal.com/events/ethonline2026) (Start Fresh).

**Start here**

- Cold agent / Claude Code: [`docs/HANDOFF-CC.md`](./docs/HANDOFF-CC.md) (**U1** mission)
- Plan and gates: [`docs/PLAN.md`](./docs/PLAN.md) · construction units: [`docs/DEV-LOOP.md`](./docs/DEV-LOOP.md)
- Doc index: [`docs/README.md`](./docs/README.md) · honest review + kill-test log: [`docs/REFLECTION.md`](./docs/REFLECTION.md)
- Daily evidence: [`docs/progress/`](./docs/progress/)

**Status:** U0 / G1 met 2026-09-06. **U1 (Privy session signer + Lane A) is next** — Privy app created; finish dashboard auth key + policy, then run HANDOFF-CC.

---

## Layout

```text
apps/game/          Godot 4.5.2 project (GDScript). autoload/chain.gd is the ONLY JavaScriptBridge user. Never holds keys.
apps/web/           Vite + React shell. index.html hosts the canvas; src/bridge installs window.BranchZero (@bloxchain/sdk reads).
apps/teller-desk/   Fastify service. U0: /healthz + 501 stubs for the lane routes. Signing/broadcasting arrive in U1/U2.
packages/shared/    viem chain configs (remoteEvm 1337, sepolia), dev-role addresses, bridge protocol types, deployments schema.
infra/scripts/      probe / smoke / historical U0 compile+deploy (not the ongoing product path)
infra/deployments/  remote-evm.json — lab AccountBlox fixture. Never keys.
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

### 3. Account on 1337 (already done for U0)

Lab fixture is in `infra/deployments/remote-evm.json`. Re-check without redeploying:

```bash
npm run chain:smoke     # SDK owner() / roles against the recorded address
```

**Do not wipe Remote EVM.** New player accounts (U1+): prefer protocol **CopyBlox** / `create-wallet` — see [`docs/BLOXCHAIN-INTEGRATION.md`](./docs/BLOXCHAIN-INTEGRATION.md). Do not use `chain:compile` as the default product path.

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

Public **`@bloxchain/sdk` + `viem`** only for product runtime. No custom Solidity. No path dependency on the protocol repo for runtime (protocol scripts may bootstrap CopyBlox out of band). Godot never holds keys / never talks RPC. No `JavaScriptBridge.eval`. Testnets + Remote EVM only; **do not wipe** the lab chain; gas ceiling ≈ **20M**. Remote EVM dev keys never touch a public network.

**K4 / packages:** U0 used a one-off compile to place a fixture account. Principal locked SDK-only + CopyBlox going forward. See `docs/REFLECTION.md`.

## AI tools

Planning and U0 construction: Claude Code (Fable 5.1). Lessons scrubbed into GameDevOS `wiki/lessons/`. See `docs/progress/`.

Licence: MIT. Bloxchain SDK is MPL-2.0.
