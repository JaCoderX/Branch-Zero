/**
 * Account Opening (M1) — clone an AccountBlox for the player, whitelist the demo token, hand over money.
 *
 * The clone is created by `CopyBlox.cloneBlox`, which does `Clones.clone` + `initialize` in a single
 * transaction, so no uninitialised account is ever reachable across blocks (the two-transaction window
 * U0 accepted is gone). The deployer pays for that transaction and holds no role on the account
 * afterwards: owner is the player's Privy wallet, broadcaster is the Teller Desk, recovery is cold.
 */
import { decodeEventLog, encodeFunctionData, getAddress, keccak256, parseUnits, toBytes, type Address, type Hex } from 'viem';
import {
  EngineBlox,
  GuardController,
  GuardConfigActionType,
  GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL,
  GUARD_CONTROLLER_OPERATION_TYPES as GC_OP,
  RoleConfigActionType,
  RuntimeRBAC,
  RUNTIME_RBAC_FUNCTION_SELECTORS as RB_SEL,
  RUNTIME_RBAC_OPERATION_TYPES as RB_OP,
  TxAction,
  createBitmapFromActions,
  encodeAddFunctionToRole,
  encodeAddTargetToWhitelist,
  guardConfigBatchExecutionParams,
  roleConfigBatchExecutionParams,
  toContractValue,
} from '@bloxchain/sdk';
import { copyBloxAbi, erc20Abi } from '@branch-zero/shared';
import { broadcaster, broadcasterAddress, chain, deployer, deployerAddress, publicClient } from '../chain.ts';
import { config, deployments } from '../config.ts';
import { pinPolicyToAccount } from '../privy.ts';
import { signMetaTx, type AuditSink } from '../signing/privySigner.ts';
import { emitStage, patchPlayer, type Player } from '../store.ts';

const d = () => deployments();

/**
 * `createMetaTxParams(..., deadline, ...)` takes a **duration**, not an absolute timestamp: the contract
 * returns `block.timestamp + deadline`. Passing `now + 600` (as docs/BLOXCHAIN-INTEGRATION.md §3.3
 * sketched) yields a signature valid for another fifty-odd years. Ten minutes is the window we want.
 */
const META_TX_TTL_SEC = 600n;

/** Clone a fresh AccountBlox owned by the player's Privy wallet. One transaction, ~16.2M gas. */
export async function cloneAccount(owner: Address): Promise<{ account: Address; hash: Hex; gasUsed: bigint }> {
  const { copyBlox, accountBloxImplementation } = d();

  // The live Remote EVM block ceiling is 16,777,216 and this call needs ~16.2M of it, so it only fits
  // as the sole transaction in its block. Check before spending gas rather than mining a failure.
  const gas = await publicClient.estimateGas({
    account: deployerAddress,
    to: copyBlox,
    data: encodeFunctionData({
      abi: copyBloxAbi,
      functionName: 'cloneBlox',
      args: [accountBloxImplementation, owner, broadcasterAddress, config.recoveryAddress, config.timeLockSec],
    }),
  });
  const { gasLimit } = await publicClient.getBlock();
  if (gas > gasLimit) throw new Error(`cloneBlox needs ${gas} gas but the block ceiling is ${gasLimit}`);

  const hash = await broadcasterOrDeployerClone(owner, gas > gasLimit - 10_000n ? gasLimit : gas + 100_000n);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`cloneBlox reverted (${hash})`);

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: copyBloxAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === 'BloxCloned') {
        return { account: getAddress(decoded.args.clone as string), hash, gasUsed: receipt.gasUsed };
      }
    } catch {
      /* not a CopyBlox event */
    }
  }
  throw new Error(`cloneBlox mined but emitted no BloxCloned event (${hash})`);
}

function broadcasterOrDeployerClone(owner: Address, gas: bigint): Promise<Hex> {
  const { copyBlox, accountBloxImplementation } = d();
  return deployer.writeContract({
    address: copyBlox,
    abi: copyBloxAbi,
    functionName: 'cloneBlox',
    args: [accountBloxImplementation, owner, broadcasterAddress, config.recoveryAddress, config.timeLockSec],
    gas,
    chain,
    account: deployer.account!,
  });
}

/**
 * Guard configuration batch: whitelist the demo token for `transfer(address,uint256)`.
 *
 * The owner signs; the broadcaster executes. This is the same meta-transaction shape Lane A uses, so a
 * successful provision already proves the signing lane end to end before any money moves.
 */
export async function whitelistToken(player: Player, account: Address, audit?: AuditSink): Promise<Hex> {
  const { guardDefinitions, token } = d();
  const gc = new GuardController(publicClient, broadcaster, account, chain);

  const executionParams = guardConfigBatchExecutionParams(publicClient, guardDefinitions, [
    {
      actionType: GuardConfigActionType.ADD_TARGET_TO_WHITELIST,
      data: encodeAddTargetToWhitelist(publicClient, guardDefinitions, EngineBlox.ERC20_TRANSFER_SELECTOR, token.address),
    },
  ]);

  const metaTxParams = await gc.createMetaTxParams(
    account,
    GC_SEL.GUARD_CONFIG_BATCH_META_SELECTOR,
    TxAction.SIGN_META_REQUEST_AND_APPROVE,
    META_TX_TTL_SEC,
    0n,
    player.ownerAddress,
  );
  const unsigned = await gc.generateUnsignedMetaTransactionForNew(
    player.ownerAddress,
    account,
    0n,
    1_000_000n,
    GC_OP.CONTROLLER_CONFIG_BATCH,
    GC_SEL.GUARD_CONFIG_BATCH_EXECUTE_SELECTOR,
    executionParams,
    metaTxParams,
  );

  const signed = await signMetaTx(publicClient, chain, unsigned, { owner: player.ownerAddress, walletId: player.walletId, account }, audit);
  const res = await gc.guardConfigBatchRequestAndApprove(signed, { from: broadcasterAddress });
  const receipt = await res.wait();
  if (receipt.status !== 'success') throw new Error(`guard config batch reverted (${res.hash})`);
  return res.hash as Hex;
}

/**
 * V4, answered the hard way: whitelisting the token is **not** enough for Lane A.
 *
 * `AccountBlox.initialize` registers a schema for `transfer(address,uint256)` (all nine actions
 * supported) and the guard batch above whitelists the token for it, but the default role grants only
 * cover the controller's own selectors — reading `getActiveRolePermissions` on a fresh clone shows no
 * entry for `0xa9059cbb` under any role. `requestAndApproveExecution` checks the *execution* selector,
 * so without this batch the broadcaster is refused with `NoPermission(caller)`.
 *
 * So we grant exactly two permissions, each the mirror of the other, on that one selector:
 *   OWNER       may SIGN_META_REQUEST_AND_APPROVE
 *   BROADCASTER may EXECUTE_META_REQUEST_AND_APPROVE
 * handled by `requestAndApproveExecution`. Neither side gains anything else: the owner still cannot
 * broadcast, the broadcaster still cannot sign, and the token still has to be whitelisted.
 */
const OWNER_ROLE = keccak256(toBytes('OWNER_ROLE'));
const BROADCASTER_ROLE = keccak256(toBytes('BROADCASTER_ROLE'));

export async function grantTransferPermissions(player: Player, account: Address, audit?: AuditSink): Promise<Hex> {
  const { rbacDefinitions } = d();
  const rbac = new RuntimeRBAC(publicClient, broadcaster, account, chain);
  const handler = GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR;

  const permission = (actions: TxAction[]) => ({
    functionSelector: EngineBlox.ERC20_TRANSFER_SELECTOR,
    grantedActionsBitmap: toContractValue(createBitmapFromActions(actions)),
    handlerForSelectors: [handler] as const,
  });

  const executionParams = roleConfigBatchExecutionParams(publicClient, rbacDefinitions, [
    {
      actionType: RoleConfigActionType.ADD_FUNCTION_TO_ROLE,
      data: encodeAddFunctionToRole(publicClient, rbacDefinitions, OWNER_ROLE, permission([TxAction.SIGN_META_REQUEST_AND_APPROVE])),
    },
    {
      actionType: RoleConfigActionType.ADD_FUNCTION_TO_ROLE,
      data: encodeAddFunctionToRole(publicClient, rbacDefinitions, BROADCASTER_ROLE, permission([TxAction.EXECUTE_META_REQUEST_AND_APPROVE])),
    },
  ]);

  const metaTxParams = await rbac.createMetaTxParams(
    account,
    RB_SEL.ROLE_CONFIG_BATCH_META_SELECTOR,
    TxAction.SIGN_META_REQUEST_AND_APPROVE,
    META_TX_TTL_SEC,
    0n,
    player.ownerAddress,
  );
  const unsigned = await rbac.generateUnsignedMetaTransactionForNew(
    player.ownerAddress,
    account,
    0n,
    1_000_000n,
    RB_OP.ROLE_CONFIG_BATCH,
    RB_SEL.ROLE_CONFIG_BATCH_EXECUTE_SELECTOR,
    executionParams,
    metaTxParams,
  );

  const signed = await signMetaTx(publicClient, chain, unsigned, { owner: player.ownerAddress, walletId: player.walletId, account }, audit);
  const res = await rbac.roleConfigBatchRequestAndApprove(signed, { from: broadcasterAddress });
  const receipt = await res.wait();
  if (receipt.status !== 'success') throw new Error(`role config batch reverted (${res.hash})`);
  return res.hash as Hex;
}

/** Opening balance from the demo-token treasury. Plain ERC-20 transfer — no Bloxchain semantics involved. */
export async function fundAccount(account: Address): Promise<Hex> {
  const { token } = d();
  const hash = await deployer.writeContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [account, parseUnits(config.openingBalance, token.decimals)],
    chain,
    account: deployer.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Full Account Opening. Idempotent: a player who already has an account gets it back unchanged. */
export async function provision(player: Player, jobId: string, audit?: AuditSink): Promise<{ account: Address; timeLockSec: number }> {
  const stage = (s: Parameters<typeof emitStage>[1]['stage'], bankLine: string, extra: Record<string, unknown> = {}) =>
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'PROVISION', stage: s, bankLine, ...extra });

  let account = player.account;
  if (!account) {
    stage('provisioning', 'Opening your account…');
    const cloned = await cloneAccount(player.ownerAddress);
    account = cloned.account;
    patchPlayer(player.privyUserId, { account });
    stage('provisioning', 'Account opened.', { hash: cloned.hash, account });
  }

  // K5 — the policy the player delegated to was pinned to the chain only, because this account did not
  // exist yet. Now that it does, tighten the rule to name it. Policy rules are app-owned, so this needs
  // no further consent. A failure here is not fatal: the signer keeps the chain-scoped policy and the
  // fallback is recorded, so the README can be honest about how far the pin got.
  const policy = player.policyId && player.policyRuleId ? { policyId: player.policyId, ruleId: player.policyRuleId } : undefined;
  if (policy && !player.policyPinned) {
    try {
      await pinPolicyToAccount(policy, account, chain.id);
      patchPlayer(player.privyUserId, { policyPinned: true });
    } catch (e) {
      stage('provisioning', 'Account opened.', { reason: `policy not pinned to account: ${(e as Error).message}` });
    }
  }

  const current = { ...player, account };
  if (!player.configured) {
    stage('configuring', 'Adding the payee list to your file…');
    const whitelistHash = await whitelistToken(current, account, audit);
    stage('configuring', 'Payee list approved.', { hash: whitelistHash });

    stage('configuring', 'Authorising the counter to process your slips…');
    const permissionHash = await grantTransferPermissions(current, account, audit);
    patchPlayer(player.privyUserId, { configured: true });
    stage('configuring', 'Counter authorised.', { hash: permissionHash });
  }

  stage('funding', 'Counting out your opening balance…');
  await fundAccount(account);

  stage('mined', 'Your account is ready.', { account });
  return { account, timeLockSec: Number(config.timeLockSec) };
}
