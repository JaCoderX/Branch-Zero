# Bloxchain Integration — Public SDK Only

> Everything on-chain in Branch Zero is the unmodified Bloxchain account pattern, driven through the public `@bloxchain/sdk`. This doc is the contract between the game's narrative and the protocol's real behaviour.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRIVY.md](./PRIVY.md) · [SECURITY-AND-KEYS.md](./SECURITY-AND-KEYS.md)

Upstream references (public): [Bloxchain-Protocol on GitHub](https://github.com/PracticalParticle/Bloxchain-Protocol) — `docs/getting-started.md`, `docs/account-pattern.md`, `docs/guard-controller.md`, `docs/runtime-rbac.md`, `docs/meta-transactions.md`, `docs/secure-ownable.md`.

---

## 1. Packages and the "public only" rule

| Package | Used for | Notes |
|---------|----------|-------|
| `@bloxchain/sdk` (npm, MPL-2.0) | All reads/writes: `SecureOwnable`, `RuntimeRBAC`, `GuardController`, `BaseStateMachine`, `MetaTransactionSigner`, `MetaTransactionBuilder`, definition encoders, constants, error decoding | Pin exact version (`1.x`); peer `viem ^2.49` |
| `@bloxchain/contracts` (npm, optional peer) | Compiled artifacts (ABI + bytecode) for `AccountBlox`, `GuardControllerDefinitions`, `RuntimeRBACDefinitions`, `SecureOwnableDefinitions`; `deployed-addresses.json` if it ships testnet addresses | Only consumed for deployment scripts; no Solidity is written or modified by us |
| `viem` | Clients, ABI encoding, ENS resolution, chain definitions | Same major as SDK peer |

Forbidden: unpublished packages, local path dependencies to other repos, copying protocol source into this repo. If a helper is missing from the SDK we write it in `apps/teller-desk` or `packages/shared` on top of the public API.

Install:

```bash
npm i @bloxchain/sdk viem
npm i -D @bloxchain/contracts   # artifacts for deploy scripts only
```

Kill test **K4** (Day 1): inspect `node_modules/@bloxchain/contracts` for `deployed-addresses.json` with `sepolia` entries for the three definition libraries. If absent, deploy them ourselves (§ 3.1).

---

## 2. Roles and who holds which key

| Bloxchain role | Holder in Branch Zero | Key location | Can do |
|----------------|----------------------|--------------|--------|
| `OWNER_ROLE` | Player | Privy embedded wallet (enclave); delegated session signer for typed data | Sign meta-txs (request-and-approve, approve, cancel, config batches); request time-locked executions; approve/cancel directly |
| `BROADCASTER_ROLE` | Teller Desk | `BROADCASTER_PRIVATE_KEY_*` on the server | Execute meta-txs the owner signed; pays gas |
| `RECOVERY_ROLE` | Security Officer | `RECOVERY_ADDRESS` (cold; key offline unless S2) | Ownership recovery workflow only |
| Runtime `BRANCH_MANAGER` (T3) | Manager wallet | `MANAGER_PRIVATE_KEY` (demo) or a second Privy user | `approveTimeLockExecution`, `cancelTimeLockExecution` on the ERC-20 transfer flow |
| Runtime `REQUESTER` (optional, Lane B option 2) | Teller Desk requester wallet | server | `executeWithTimeLock` only — never approve |
| Deployer | Bank | `DEPLOYER_PRIVATE_KEY` | Deploys + initialises each player's `AccountBlox`; funds demo USDC |

Separation of duties is real: the broadcaster cannot forge an owner signature; the owner's enclave key cannot pay gas or bypass guards; the manager cannot start a payment.

---

## 3. Provisioning a player account (M1)

### 3.1 One-time per chain: definition libraries

`AccountBlox.initialize` loads schemas and permissions from the definition libraries linked at compile time, so the account itself does not need their addresses. The **SDK helpers** (`guardConfigBatchExecutionParams`, `roleConfigBatchExecutionParams`, `updateRecoveryExecutionParams`, …) take a `definitionAddress` parameter; the current SDK implementation encodes locally and does not call the address, but we still record the deployed addresses per chain for forward compatibility and for `getGuardConfigActionSpecs` / `getRoleConfigActionSpecs` reads.

```ts
// infra/scripts/deploy-definitions.ts (per chain)
import { createWalletClient, http, publicActions } from 'viem';
import guardDef from '@bloxchain/contracts/artifacts/GuardControllerDefinitions.json'; // path VERIFY in package
// deploy the three libraries with walletClient.deployContract({ abi, bytecode }) and write infra/deployments/<chain>.json
```

### 3.2 Per player: deploy + initialise atomically

`AccountBlox` uses OZ `Initializable`: no constructor state; `initialize(owner, broadcaster, recovery, timeLockPeriodSec, eventForwarder)` must run on the deployed instance. The upstream guidance is to avoid a publicly reachable, uninitialised instance across blocks. Two options, decided Day 1:

1. **Direct deploy + immediate initialise** (two txs, seconds apart, from the same deployer; acceptable on testnet for a game — document the window).
2. **Minimal factory** — only if the public artifacts include `CopyBlox` (EIP-1167 clone + `initialize` in one tx). Using it is still "public package only" since we deploy the published bytecode unchanged. Preferred if available.

```ts
// infra/scripts/deploy-account.ts (sketch)
import { SecureOwnable, BaseStateMachine } from '@bloxchain/sdk';
import accountBlox from '@bloxchain/contracts/artifacts/AccountBlox.json'; // VERIFY path

const hash = await deployer.deployContract({ abi: accountBlox.abi, bytecode: accountBlox.bytecode });
const { contractAddress } = await publicClient.waitForTransactionReceipt({ hash });

await deployer.writeContract({
  address: contractAddress!, abi: accountBlox.abi, functionName: 'initialize',
  args: [ownerAddr, broadcasterAddr, recoveryAddr, 120n, eventForwarderOrZero],
});

// smoke reads (must match before we tell the player "Ready")
const so = new SecureOwnable(publicClient, undefined, contractAddress!, chain);
assert((await so.owner()).toLowerCase() === ownerAddr.toLowerCase());
assert((await so.getBroadcasters()).map(a => a.toLowerCase()).includes(broadcasterAddr.toLowerCase()));
assert((await so.getTimeLockPeriodSec()) === 120n);
```

`eventForwarder`: pass `0x0` unless we deploy an event forwarder (not needed for the game; the watcher polls state).

### 3.3 Per player: guard configuration batch (owner signs, broadcaster executes)

Finding from the public definitions (`GuardControllerDefinitions.sol`): the default schema set **already registers** `transfer(address,uint256)` (`EngineBlox.ERC20_TRANSFER_SELECTOR`, operation `ERC20_TRANSFER`, all actions). So for USDC payments we only need to **whitelist the token address for that selector**. (`VERIFY` on Day 2 that no additional role permission is required for the execution selector; if the engine demands one, add it via a role config batch — § 6.)

```ts
import {
  GuardController, GuardConfigActionType, TxAction, EngineBlox,
  guardConfigBatchExecutionParams, encodeAddTargetToWhitelist,
  GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL, GUARD_CONTROLLER_OPERATION_TYPES as GC_OP,
} from '@bloxchain/sdk';

const gc = new GuardController(publicClient, broadcasterWallet, account, chain);

const actions = [{
  actionType: GuardConfigActionType.ADD_TARGET_TO_WHITELIST,
  data: encodeAddTargetToWhitelist(publicClient, guardDefsAddr, EngineBlox.ERC20_TRANSFER_SELECTOR, USDC),
}];
const executionParams = guardConfigBatchExecutionParams(publicClient, guardDefsAddr, actions);

const metaTxParams = await gc.createMetaTxParams(
  account,                                   // handlerContract = the account (verifyingContract)
  GC_SEL.GUARD_CONFIG_BATCH_META_SELECTOR,   // exact external function that will submit
  TxAction.SIGN_META_REQUEST_AND_APPROVE,
  BigInt(Math.floor(Date.now() / 1000) + 600),
  0n,
  ownerAddr,
);

const unsigned = await gc.generateUnsignedMetaTransactionForNew(
  ownerAddr, account, 0n, 1_000_000n,
  GC_OP.CONTROLLER_CONFIG_BATCH,
  GC_SEL.GUARD_CONFIG_BATCH_EXECUTE_SELECTOR,
  executionParams, metaTxParams,
);

const signed = await privySigner.signMetaTx(unsigned, ctx); // § 4
await gc.guardConfigBatchRequestAndApprove(signed, { from: broadcasterAddr });
```

Whitelist additions later (new payee contracts, Uniswap router, Permit2) reuse this exact batch.

### 3.4 Demo money

Sepolia: deploy our own mintable 6-decimal "USDC (demo)" ERC-20 from a standard OpenZeppelin artifact in `infra/` (this is not protocol code), or use a public test USDC if one is stable. Arc Testnet: USDC is native; the ERC-20 interface lives at `0x3600000000000000000000000000000000000000` (6 decimals) — `VERIFY` on Arc docs; faucet at `faucet.circle.com`.

---

## 4. Signing meta-transactions with Privy (the "no pop-up" core)

The SDK's `MetaTransactionSigner.signMetaTransactionWithWallet(unsigned)` builds the canonical EIP-712 request (domain `Bloxchain` / `EngineBlox.VERSION`, `verifyingContract` = the account, `MetaTransaction` primary type) and calls `walletClient.signTypedData`, then verifies `recoverAddress(digest) == params.signer`. The typed-data constants themselves (`META_TX_DOMAIN`, `META_TX_TYPES`, `buildTypedDataMessage`) are **not** re-exported from the package root and the package `exports` map blocks deep imports — so we do not re-implement them. Instead we give the SDK a viem **custom account** whose `signTypedData` is fulfilled by Privy's server-side session signer. The SDK stays the single source of the EIP-712 shape.

```ts
// apps/teller-desk/src/signing/privySigner.ts
import { MetaTransactionSigner, type MetaTransaction } from '@bloxchain/sdk';
import { createWalletClient, http, type Address, type Chain } from 'viem';
import { toAccount } from 'viem/accounts';

/** viem account backed by the player's Privy embedded wallet via session signer (no browser involved). */
export function privyBackedAccount(owner: Address, walletId: string) {
  return toAccount({
    address: owner,
    async signTypedData(typedData) {
      // Privy Node SDK / REST: eth_signTypedData_v4 on the user's wallet, request signed with our
      // P-256 authorization key (privy-authorization-signature header). Policy decides if it is allowed.
      return privy.walletApi.ethereum.signTypedData({ walletId, typedData });
    },
    async signMessage() { throw new Error('personal_sign is never used for Bloxchain meta-txs'); },
    async signTransaction() { throw new Error('use eth_sendTransaction path (Lane B option 1) instead'); },
  });
}

export async function signMetaTx(unsigned: MetaTransaction, owner: Address, walletId: string,
                                 account: Address, chain: Chain, rpcUrl: string) {
  const walletClient = createWalletClient({ account: privyBackedAccount(owner, walletId), chain, transport: http(rpcUrl) });
  const signer = new MetaTransactionSigner(publicClient, walletClient, account, chain);
  return signer.signMetaTransactionWithWallet(unsigned); // SDK verifies recovered signer == params.signer
}
```

Notes:
- `unsigned.message` is the EIP-712 digest computed **by the contract** (`generateUnsignedMetaTransactionForNew/Existing`). The SDK recovers the signer from that digest — the same check the contract does — so a signature that passes here passes on-chain.
- Fallback (K2): the same `MetaTransactionSigner` in the browser with a `WalletClient` over Privy's EIP-1193 provider — one pop-up per action, still Privy, identical code path.
- **Never** sign the digest with `personal_sign` (EIP-191 prefix); the contract recovers against the raw EIP-712 digest. For wallets, typed data is the only correct path — exactly what `signMetaTransactionWithWallet` does.
- In the lane sketches below, `signMetaTx(unsigned, ctx)` stands for this helper with the player's `{ owner, walletId, account, chain }` context.

Privy policy for the session signer (see [PRIVY.md](./PRIVY.md)): allow `eth_signTypedData_v4` where `domain.name == "Bloxchain"` and `domain.verifyingContract ∈ player's account addresses`; deny everything else. Whether Privy's policy engine can match typed-data fields is kill test **K5**; fallback is method-level scoping.

---

## 5. Lane A — routine payment via `requestAndApproveExecution` (M2)

Preconditions: USDC whitelisted for `ERC20_TRANSFER_SELECTOR` (§ 3.3); account holds USDC; owner has default OWNER permissions from `AccountBlox.initialize`.

```ts
import { encodeAbiParameters, parseAbiParameters, parseUnits, keccak256, toBytes } from 'viem';

const params = encodeAbiParameters(parseAbiParameters('address, uint256'), [to, parseUnits(amount, 6)]);

const metaTxParams = await gc.createMetaTxParams(
  account, GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR,
  TxAction.SIGN_META_REQUEST_AND_APPROVE, deadline, 0n, ownerAddr,
);

const unsigned = await gc.generateUnsignedMetaTransactionForNew(
  ownerAddr,                       // requester
  USDC,                            // target (whitelisted)
  0n,                              // value
  200_000n,                        // gasLimit for the inner call
  keccak256(toBytes('ERC20_TRANSFER')),   // operationType (matches default schema)
  EngineBlox.ERC20_TRANSFER_SELECTOR,     // executionSelector
  params, metaTxParams,
);

const signed = await signMetaTx(unsigned, ctx);
const res = await gc.requestAndApproveExecution(signed, { from: broadcasterAddr });
const receipt = await res.wait();
// status: read back via BaseStateMachine.getTransaction(txId) → COMPLETED; txId from the tx record in events or history
```

Getting `txId`: the account's `getTransactionHistory(from, to)` / `getPendingTransactions()` plus the tx receipt block let the watcher correlate; simplest is to read `txCounter`-adjacent history right after mining (`VERIFY` exact event/ABI to decode `txId` from logs on Day 2 — `ComponentEvent` / execution events in the ABI).

Nonce handling: `createMetaTxParams` on-chain returns the current `getSignerNonce(owner)`; never sign two meta-txs with the same nonce concurrently — the Teller Desk serialises per player (p-queue).

---

## 6. Lane B — time-locked wire (M3)

### 6.1 Request

`executeWithTimeLock(target, value, selector, params, gasLimit, operationType)` is a **direct call** requiring `EXECUTE_TIME_DELAY_REQUEST` permission for the handler; OWNER has it by default. The request must therefore come from a wallet that both holds the permission and can pay gas. Options (Day 3 decision, see [ARCHITECTURE.md](./ARCHITECTURE.md) § 3.3):

1. **Owner sends it via Privy session signer `eth_sendTransaction`** — fund the embedded wallet with ~0.02 Sepolia ETH (and faucet USDC on Arc) at onboarding; add `eth_sendTransaction` to the policy restricted to `to == player's account` and `data` selector `executeWithTimeLock`. Cleanest mapping: the customer files the wire; no pop-up. **Preferred.**
2. **Runtime `REQUESTER` role** for a Teller Desk wallet with only `EXECUTE_TIME_DELAY_REQUEST` on `EXECUTE_WITH_TIMELOCK_SELECTOR` (role config batch below). Teller can request, never approve. Narrative: "the teller files the wire for you".
3. **Client-side pop-up** for wires only.

```ts
await gc.executeWithTimeLock(USDC, 0n, EngineBlox.ERC20_TRANSFER_SELECTOR, params, 200_000n,
                             keccak256(toBytes('ERC20_TRANSFER')), { from: requesterAddr });
```

### 6.2 Countdown

```ts
const bsm = new BaseStateMachine(publicClient, undefined, account, chain);
const pending = await bsm.getPendingTransactions();           // bigint[]
const rec = await bsm.getTransaction(txId);                    // TxRecord { status, releaseTime, params, ... }
const now = (await publicClient.getBlock()).timestamp;         // chain time, not Date.now()
const secondsLeft = Number(rec.releaseTime) - Number(now);
```

The vault clock renders `secondsLeft`; the LED turns green when `secondsLeft <= 0`.

### 6.3 Approve / cancel

Owner via session signer (no pop-up), meta-tx for an **existing** tx:

```ts
const metaTxParams = await gc.createMetaTxParams(
  account, GC_SEL.APPROVE_TIMELOCK_EXECUTION_META_SELECTOR, TxAction.SIGN_META_APPROVE, deadline, 0n, ownerAddr);
const unsigned = await gc.generateUnsignedMetaTransactionForExisting(txId, metaTxParams);
const signed = await signMetaTx(unsigned, ctx);
await gc.approveTimeLockExecutionWithMetaTx(signed, { from: broadcasterAddr });
// cancel: CANCEL_TIMELOCK_EXECUTION_META_SELECTOR + TxAction.SIGN_META_CANCEL + cancelTimeLockExecutionWithMetaTx
```

Manager (T3), direct call with a runtime role:

```ts
await gc.approveTimeLockExecution(txId, { from: managerAddr });
await gc.cancelTimeLockExecution(txId, { from: managerAddr });
```

Approval before `releaseTime` reverts — the Vault Keeper's line "Still cooling" is the decoded error, not a client-side guess (though the UI also greys the button).

---

## 7. Runtime roles with `RuntimeRBAC` (T3, and Lane B option 2)

Owner signs, broadcaster executes, same meta-tx shape as guard config:

```ts
import {
  RuntimeRBAC, RoleConfigActionType, roleConfigBatchExecutionParams,
  encodeCreateRole, encodeAddWallet, encodeAddFunctionToRole, createBitmapFromActions,
  RUNTIME_RBAC_FUNCTION_SELECTORS as RB_SEL, RUNTIME_RBAC_OPERATION_TYPES as RB_OP,
} from '@bloxchain/sdk';

const roleHash = keccak256(toBytes('BRANCH_MANAGER'));
const actions = [
  { actionType: RoleConfigActionType.CREATE_ROLE,
    data: encodeCreateRole(publicClient, rbacDefsAddr, 'BRANCH_MANAGER', 2n) },
  { actionType: RoleConfigActionType.ADD_WALLET,
    data: encodeAddWallet(publicClient, rbacDefsAddr, roleHash, managerAddr) },
  { actionType: RoleConfigActionType.ADD_FUNCTION_TO_ROLE,
    data: encodeAddFunctionToRole(publicClient, rbacDefsAddr, roleHash, {
      functionSelector: GC_SEL.APPROVE_TIMELOCK_EXECUTION_SELECTOR,
      grantedActionsBitmap: toContractValue(createBitmapFromActions([TxAction.EXECUTE_TIME_DELAY_APPROVE])),
      handlerForSelectors: [GC_SEL.APPROVE_TIMELOCK_EXECUTION_SELECTOR],
    }) },
  { actionType: RoleConfigActionType.ADD_FUNCTION_TO_ROLE,
    data: encodeAddFunctionToRole(publicClient, rbacDefsAddr, roleHash, {
      functionSelector: GC_SEL.CANCEL_TIMELOCK_EXECUTION_SELECTOR,
      grantedActionsBitmap: toContractValue(createBitmapFromActions([TxAction.EXECUTE_TIME_DELAY_CANCEL])),
      handlerForSelectors: [GC_SEL.CANCEL_TIMELOCK_EXECUTION_SELECTOR],
    }) },
];
const executionParams = roleConfigBatchExecutionParams(publicClient, rbacDefsAddr, actions);

const rbac = new RuntimeRBAC(publicClient, broadcasterWallet, account, chain);
const metaTxParams = await rbac.createMetaTxParams(account, RB_SEL.ROLE_CONFIG_BATCH_META_SELECTOR,
  TxAction.SIGN_META_REQUEST_AND_APPROVE, deadline, 0n, ownerAddr);
const unsigned = await rbac.generateUnsignedMetaTransactionForNew(ownerAddr, account, 0n, 1_000_000n,
  RB_OP.ROLE_CONFIG_BATCH, RB_SEL.ROLE_CONFIG_BATCH_EXECUTE_SELECTOR, executionParams, metaTxParams);
await rbac.roleConfigBatchRequestAndApprove(await signMetaTx(unsigned, ctx), { from: broadcasterAddr });
```

Respect the **batch ordering constraints** documented in upstream `RuntimeRBACDefinitions.sol` (create role before adding wallets/functions; `handlerForSelectors` must satisfy the schema's handler rules). Read `getRoleConfigActionSpecs` if unsure. Mark as `VERIFY` on Day 7.

Reads for the manager's office: `bsm.hasRole(roleHash, managerAddr)`, `bsm.getAuthorizedWallets(roleHash)`, `bsm.getActiveRolePermissions(roleHash)`.

---

## 8. Reads used by the world (cheap, public RPC, from the browser)

| Display | Call |
|---------|------|
| Passbook balance | ERC-20 `balanceOf(account)` via viem (`erc20Token` helpers in SDK are fine too) |
| Pending badge | `getPendingTransactions().length` |
| Ledger board | `getTransactionHistory(max(1, counter-8), counter)` + `getTransaction` |
| Approved payees | `getFunctionWhitelistTargets(EngineBlox.ERC20_TRANSFER_SELECTOR)` |
| Service menu | `getSupportedFunctions()` → `getFunctionSchema(sel).operationName`; actions via `EngineBlox.convertBitmapToActions` |
| Roles | `getSupportedRoles()`, `getRole(roleHash)`, `getWalletRoles(owner)` |
| Security state | `owner()`, `getBroadcasters()`, `getRecovery()`, `getTimeLockPeriodSec()` |
| Component detection | `ComponentDetection` / `supportsInterface(INTERFACE_IDS.IGuardController)` — sanity on first connect |

---

## 9. Error handling

- Wrap every write in the SDK's `handleViemError` / `enhanceViemError`, then `decodeRevertReason(data)` → `getUserFriendlyErrorMessage(err)`.
- Map `error.errorName` → bank line in `packages/shared/errors.json` (see [NPCS.md](./NPCS.md) § 5). Unknown → SDK friendly message under "Ask why", generic apology on the main path.
- Log the raw selector for anything unmapped; add a line the same day.

---

## 10. Invariants we rely on (and must not weaken)

1. The broadcaster can only execute what an owner signed (EIP-712 digest includes chainId, nonce, handler, selector, deadline, signer).
2. Every execution target must be whitelisted for its selector (or be the account itself for registered internal selectors).
3. Time-locked records cannot be approved before `releaseTime`; they can be cancelled until then.
4. Runtime roles can only receive permissions that the function schema supports.
5. `AccountBlox` timelock bounds: 1 s .. 90 days (we use 120 s).

No custom Solidity means we cannot break these; the only project-side risks are key custody and Privy policy scope (see [SECURITY-AND-KEYS.md](./SECURITY-AND-KEYS.md)).

---

## 11. Verification list (fold into Day 1–3)

| ID | What to verify against the installed public package |
|----|------------------------------------------------------|
| V1 | Artifact paths in `@bloxchain/contracts` for `AccountBlox`, definition libraries, optional `CopyBlox` |
| V2 | Whether `deployed-addresses.json` in the package includes Sepolia definition addresses (K4) |
| V3 | Default schema for `transfer(address,uint256)` present after `initialize` (`getSupportedFunctions` includes `ERC20_TRANSFER_SELECTOR`) |
| V4 | Only whitelist needed for Lane A (no extra role permission on execution selector) |
| V5 | How to read `txId` after `requestAndApproveExecution` (event name/args in ABI) |
| V6 | `eth_sendTransaction` via Privy session signer for `executeWithTimeLock` (Lane B option 1) |
| V7 | Role config batch ordering + `handlerForSelectors` rules for `BRANCH_MANAGER` |
| V8 | Exact custom error names exported in `ERROR_SIGNATURES` for the `errors.json` mapping |
| V9 | Arc Testnet: deployment + `initialize` succeed; `generateUnsignedMetaTransactionForNew` returns a non-zero digest (K3) |
