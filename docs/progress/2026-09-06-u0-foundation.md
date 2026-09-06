---
date: 2026-09-06
unit: U0 Foundation
gate: G1
result: met (K1 PASS; K4 PASS via fallback pending principal confirmation)
agent: Claude Code (Fable 5.1), cold session
---

# 2026-09-06 — U0 Foundation

## What ran

| Step | Command | Result |
|------|---------|--------|
| Remote EVM probe | `curl … eth_chainId` → `0x539`; `npm run chain:probe` | Nethermind v1.39.3, chain 1337, head #10 → #28 after deploys, block gasLimit **16,777,216** |
| Scaffold | npm workspaces: `apps/web`, `apps/teller-desk`, `packages/shared`, `infra`; `apps/game` (Godot, not an npm package) | `npm install` → 312 packages; `@bloxchain/sdk@1.0.0`, `@bloxchain/contracts@1.0.0`, `viem@2.50.4` (pinned to the SDK), `solc@0.8.35`, `vite@5.4.21`, `fastify@5.12.3` |
| Godot 4.5.2 | official `Godot_v4.5.2-stable_win64.exe.zip` + `…_export_templates.tpz`, SHA-512 verified against `SHA512-SUMS.txt`; editor → `%LOCALAPPDATA%\Programs\Godot-4.5.2\`, templates → `%APPDATA%\Godot\export_templates\4.5.2.stable\` | `4.5.2.stable.official.6ce3de25a` |
| Export | `npm run export:web` (`--headless --import`, then `--export-release Web`) | `apps/web/public/game/`: `index.wasm` 37 MB, `index.pck` 12 KB, `index.js` 298 KB; `GODOT_CONFIG.ensureCrossOriginIsolationHeaders=false` |
| K1 in browser | `npm run dev:web` → http://localhost:5173 (Chromium, in-app browser) | console: `Build configuration: Emscripten 4.0.10, single-threaded, no GDExtension support` · `Chain: bridge interface acquired, callback registered` · `K1 echo → {"ok":true,"result":{"echo":"hello from Godot 4.5.2-stable (official)",…}}` · `K1: PASS`. `crossOriginIsolated=false`, no COOP/COEP headers, `SharedArrayBuffer` undefined, `.wasm` served as `application/wasm` |
| Compile | `npm run chain:compile` | solc `0.8.35+commit.47b9dedd`, via-IR, 200 runs, `evmVersion=prague`; 62 s; 0 errors / 7 warnings; `AccountBlox` 20,879 B init code (links 4 libs), `EngineBlox` 24,544 B (under EIP-170) |
| K4 deploy | `npm run chain:deploy` | libs `EngineBlox` (5.35 M gas), `SecureOwnableDefinitions`, `RuntimeRBACDefinitions`, `GuardControllerDefinitions`; `AccountBlox` 4.56 M gas, code 20,853 B; `initialize(acct4, acct1, acct2, 120, 0x0)` **16.06 M gas**; SDK `owner()` = `0xd03ea862…b117` ✔ |
| K4 smoke | `npm run chain:smoke` | 4 libraries have code; owner/broadcaster/recovery/timelock match; ERC-165 ✔ ×3; `getSupportedFunctions()` anonymous → `NoPermission`, `from=owner` → 30 selectors, `getSupportedRoles()` → 3 roles. **PASS** |
| Teller Desk stub | `npm run dev:teller` → `GET /healthz` | `{"ok":true,"chains":{"remoteEvm":{"chainId":1337,"block":"28"}},"broadcaster":{"address":"0xFFcf…09f0","balanceEth":"999.99…"}}`; lane routes answer `501` with the planned unit |
| Bridge → chain via Godot | scene calls `chainInfo` and `accountInfo` | Godot label shows owner/broadcaster/recovery/timelock read by the TS bridge through `@bloxchain/sdk` over the Vite `/rpc` proxy; `ownerMatchesRecord:true` |

Deployment record: [`infra/deployments/remote-evm.json`](../../infra/deployments/remote-evm.json) (addresses, tx hashes, compiler + source pins — no keys).

## Findings that matter later

1. **K4 as written fails.** `@bloxchain/contracts` ships source + ABI only; `AccountBlox` is not in npm. We compile the published sources and fetch the template at the `contracts-v1.0.0` commit (pinned commit + sha256). **The principal must confirm this fallback is acceptable** under "public packages only". Alternatives are listed in `docs/REFLECTION.md` § 4.
2. **Permissioned views.** Registry reads (`getSupportedFunctions`, `getSupportedRoles`, …) revert for anonymous `eth_call`; pass `account: owner`.
3. **Block gas limit is 16.7 M, not 60 M.** `initialize` uses 96 % of a block. Wipe Remote EVM (`docker compose down -v`) before U1, then `npm run chain:deploy -- --fresh` and re-commit the deployments file. Not done in this session (it would change addresses for other lab projects on that chain).
4. **Engine start promise.** `Engine.startGame()` did not settle in the shell; the overlay now treats Godot registering its callback (`bridge.ready`) as "running".
5. Two earlier deploy attempts left orphan library + account sets on 1337 (script crashed after `initialize` on a read/record step). Harmless on a dev chain; ignore them.

## Blockers / not done

- Nothing blocking G1. Privy (U1), greybox, ENS, Arc, Uniswap untouched by design.
- `docs/REFLECTION.md` K2/K3/K5/K6/K8 stay pending with the next human action named.
- No video capture; this note is the Day-1 evidence. Screenshot of the running shell was taken in the agent browser but not saved into the repo (avoid binaries).

## Re-run from a fresh clone

```bash
npm install
cp .env.example .env            # fill DEPLOYER_PK from the Remote EVM ganache-deterministic-accounts.json (acct0)
npm run chain:probe
npm run chain:compile && npm run chain:deploy && npm run chain:smoke
npm run export:web              # needs Godot 4.5.2 standard + web templates (README)
npm run dev:web                 # http://localhost:5173  (and optionally npm run dev:teller → :8787/healthz)
```

## Lab bookkeeping

GameLab `ENG-2026-0003` and `ENG-2026-0005` answered from product-side runs (findings + handoff written, `work/index.md` rows moved to Closed as `handed-off`). No ENG tree was merged; `apps/` and `infra/` are rewrites.
