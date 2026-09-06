---
date: 2026-09-06
unit: U1 Signing lane
gate: G2
result: met (K2 PASS, K5 PASS, K8 PASS; Lane A green on Remote EVM 1337)
agent: Claude Code (Opus 5), cold session
---

# 2026-09-06 — U1 Signing lane

Privy login + session signer + Lane A payment, SDK-only, on Remote EVM 1337. Nothing was wiped; the U0
AccountBlox fixture is kept and now doubles as the CopyBlox clone implementation.

## Kill tests

| ID | Result | Evidence |
|----|--------|----------|
| **K2** | **PASS** | `recoverAddress(digest)` = the Privy embedded wallet = `owner()` on the player's cloned AccountBlox. Digest from `generateUnsignedMetaTransactionForNew`; domain `Bloxchain`, chainId `1337`. Verified twice — once by the SDK's own `signMetaTransactionWithWallet` check, once independently in the kill test. |
| **K5** | **PASS** | With the per-player policy attached, `eth_signTypedData_v4` for a `verifyingContract` the wallet does not own is refused: `400 {"error":"RPC request denied due to policy violation","code":"policy_violation"}`. Same request succeeds for the player's own account. |
| **K8** | **PASS** | Privy login modal and the `auth.privy.io/.../embedded-wallets` iframe render over the running Godot 4.5.2 single-threaded canvas. `crossOriginIsolated === false`, no COOP/COEP, no cross-origin console errors. |
| **Lane A** | **PASS** | `requestAndApproveExecution` moved 12.5 dUSDC from the player's account to a payee; account balance 500 → 487.5; record read back as `txId 3`. Zero browser involvement — the signature came from the server via the session signer. |

Re-run: `npm -w apps/teller-desk run killtests -- --fresh`.

## What runs

| Step | Command | Result |
|------|---------|--------|
| Chain bootstrap (one-time) | `BLOXCHAIN_PROTOCOL_DIR=… npm run chain:bootstrap` | `CopyBlox` `0x7C728214be9A0049e6a86f2137ec61030D0AA964` (2.48 M gas); demo ERC-20 `dUSDC` `0x5017A545b09ab9a30499DE7F431DF0855bCb7275` (0.84 M gas) |
| Teller Desk | `npm run dev:teller` → `GET /healthz` | `{"ok":true,"unit":"U1",…}` with broadcaster + deployer balances, Privy app/signer ids, contract addresses |
| Web shell | `npm run dev:web` → http://localhost:5173 | Godot canvas + React overlay; K1 echo still PASS on bridge `u1.0`; Privy login modal opens |
| Kill tests | `npm -w apps/teller-desk run killtests -- --fresh` | K2 / K5 / Lane A all PASS |

## The shape that emerged

**Provisioning is one transaction now.** `CopyBlox.cloneBlox` does `Clones.clone` + `initialize` together, so
the "uninitialised instance reachable across blocks" window U0 accepted is gone. The clone implementation is
the U0 fixture itself — `Clones.clone` copies runtime code, not storage, so an already-initialised account is
a perfectly good template.

**The delegation consent is a real control, not a courtesy dialog.** A user-controlled Privy embedded wallet
is owned by the *user's* key quorum (`owner_id` on the wallet record is not ours). Server-side
`wallets().update({ additional_signers | policy_ids })` is refused with
`401 No valid authorization keys or user signing keys available`. So the Teller Desk genuinely cannot grant
itself signing rights; only the browser consent can. That forced the policy lifecycle below and is the
strongest single fact in the Privy submission.

**Policy lifecycle (K5).** The policy has to exist before the player delegates, but the account address we
want to pin only exists after provisioning. Policy *rules* are app-owned, so:

1. `POST /session` mints a policy scoped to `chainId` and returns its id.
2. The overlay's one consent calls `addSessionSigners({ signerId, policyIds: [thatId] })`.
3. `POST /provision` clones the account, then tightens the rule to name `verifyingContract` — no further consent.

## Findings that matter later

1. **V4 answered: NO — a whitelist is not enough for Lane A.** `initialize` registers the
   `transfer(address,uint256)` schema (all nine actions supported) and the guard batch whitelists the token,
   but the default role grants cover only the controller's own selectors: `getActiveRolePermissions` on a
   fresh clone shows *no* entry for `0xa9059cbb` under any role. `requestAndApproveExecution` checks the
   **execution** selector, so without a role config batch the broadcaster is refused with
   `NoPermission(caller)`. Provisioning now grants exactly two mirrored permissions on that one selector:
   OWNER `SIGN_META_REQUEST_AND_APPROVE`, BROADCASTER `EXECUTE_META_REQUEST_AND_APPROVE`, handled by
   `requestAndApproveExecution`.
2. **`createMetaTxParams(..., deadline, ...)` takes a duration, not a timestamp.** The contract returns
   `block.timestamp + deadline`. The sketch in BLOXCHAIN-INTEGRATION §3.3 passed `now + 600` and produced a
   signature valid until 2083. Pass `600n`.
3. **Privy policy conditions cannot match `domain.name`.** `EthereumTypedDataDomainConditionField` is
   `chainId | verifyingContract | chain_id | verifying_contract` only. The `"name": "Bloxchain"` condition in
   PRIVY.md §4 is not expressible. `verifyingContract` is the stronger pin anyway.
4. **Privy canonicalises request bodies as JSON**, and `JSON.stringify` throws on BigInt — viem hands typed
   data with `uint256` fields as BigInts. Every numeric field is rendered as a decimal string before the call
   (`jsonSafe` in `privySigner.ts`). The digest is unaffected; only transport encoding changes.
5. **Permissioned registry views need a sender.** The SDK passes `walletClient.account` as the `eth_call`
   sender, so a reader built with `undefined` as the wallet client gets `NoPermission(0x0)`. Read as the
   broadcaster (or the owner), not anonymously — this is the U0 finding, restated as a code rule.
6. **`@bloxchain/sdk` ships ABIs under `abi/` but its `exports` map has no `./abi/*` subpath.** Same wall U0
   hit on the EIP-712 constants. `cloneBlox` and the ERC-20 surface are transcribed as viem `parseAbi`
   fragments in `packages/shared/src/abi.ts`; every stateful call still goes through the SDK wrappers.
7. **Live block gas ceiling is 16,777,216, not ~20 M.** `cloneBlox` needs ~16.65 M (99.2 % of a block, measured
   by binary search) and uses 16.20 M when mined, so it only fits as the sole transaction in its block. It
   works today; it has almost no headroom. See REMOTE-EVM.md.
8. **`@privy-io/react-auth` pulls its own viem 2.56.0** alongside our pinned 2.50.4. Harmless — we only cross
   that boundary through EIP-1193 and plain JSON — but it is a second copy in the browser bundle. Revisit at
   the U4 size check.
9. **App config:** embedded wallets are `create_on_login: "off"` and the app is in
   `user-controlled-server-wallets-only` mode. The overlay calls `createWallet()` explicitly after login, so
   the wallet appears at the Account Opening desk. The principal may flip the dashboard setting for a
   smoother demo; nothing in the code depends on it.

## Blockers / not done

- **The overlay's login was exercised up to the modal, not through it.** Completing Privy's email OTP needs a
  human with an inbox: the app has no dashboard test accounts (`getTestCredentials` returns nothing) and guest
  auth is off. So the *consent UI* is verified as far as "the modal opens over the Godot canvas and the Privy
  iframe loads"; the *signing lane behind it* is verified end to end by the kill tests, which drive a Privy
  user whose wallet carries the same key quorum and policy. Both halves are real; neither substitutes for the
  other. **Next human action:** run `npm run dev:web`, sign in with a real address, click "Allow the teller to
  stamp my slips", then "Open my account" and "Pay" — and confirm no second modal appears.
- SQLite is not wired; the player index is in memory (ARCHITECTURE §2.3 puts it with the U2 watcher, where
  there is asynchronous state worth surviving a restart).
- `/wire`, `/approve`, `/cancel` still answer 501 with `plannedUnit: U2`. Out of scope by design.
- No Godot UI for the new bridge methods — the cube scene still only exercises K1 reads. U3.

## Re-run from a fresh clone

```bash
npm install
cp .env.example .env    # fill Privy secrets + BLOXCHAIN_PROTOCOL_DIR + dev keys (see docs/REMOTE-EVM.md §2)
npm run chain:probe
npm run chain:bootstrap          # one-time: CopyBlox + demo ERC-20 (skips anything already deployed)
npm run dev:teller               # :8787/healthz
npm -w apps/teller-desk run killtests -- --fresh
npm run export:web && npm run dev:web
```

## Code pointers

- `apps/teller-desk/src/signing/privySigner.ts` — viem custom account backed by the session signer (K2)
- `apps/teller-desk/src/privy.ts` — identity, policy create/pin (K5)
- `apps/teller-desk/src/lanes/provision.ts` — clone, guard batch, role batch, funding
- `apps/teller-desk/src/lanes/laneA.ts` — `requestAndApproveExecution`
- `apps/web/src/overlay/useBranchZeroWallet.ts` — login, wallet creation, the one consent, revoke
- `infra/scripts/bootstrap-blox.ts` — one-time out-of-band chain bootstrap
