/**
 * Account Opening (M1) — clone an AccountBlox for the player, whitelist the demo token, grant the roles
 * every desk needs, hand over money (and, since U2, a little gas).
 *
 * The clone is created by `CopyBlox.cloneBlox`, which does `Clones.clone` + `initialize` in a single
 * transaction, so no uninitialised account is ever reachable across blocks (the two-transaction window
 * U0 accepted is gone). The deployer pays for that transaction and holds no role on the account
 * afterwards: owner is the player's Privy wallet, broadcaster is the Teller Desk, recovery is cold.
 *
 * U2 made provisioning **idempotent against the chain**, not against memory: the whitelist, the role
 * grants and the opening balance are each read back before anything is sent, so re-running it on an
 * account opened under U1 upgrades it in place, and a Teller Desk restart cannot re-fund or re-grant.
 */
import { decodeEventLog, encodeFunctionData, formatEther, getAddress, keccak256, parseEther, parseUnits, toBytes, type Address, type Hex } from 'viem';
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
  encodeAddWallet,
  encodeCreateRole,
  encodeRemoveFunctionFromRole,
  guardConfigBatchExecutionParams,
  roleConfigBatchExecutionParams,
  toContractValue,
} from '@bloxchain/sdk';
import { copyBloxAbi, erc20Abi } from '@branch-zero/shared';
import { broadcaster, broadcasterAddress, chain, deployer, deployerAddress, managerAddress, metaTxDuration, publicClient } from '../chain.ts';
import { config, deployments } from '../config.ts';
import { createTxRules, pinPolicyToAccount, pinTxRulesToAccount } from '../privy.ts';
import { signMetaTx, type AuditSink } from '../signing/privySigner.ts';
import { emitStage, patchPlayer, type Player } from '../store.ts';

const d = () => deployments();

/** Bump when `desiredGrants` changes; players below it get their grants re-synced at the next provision. */
export const ROLE_SET_VERSION = 2;

export const OWNER_ROLE = keccak256(toBytes('OWNER_ROLE'));
export const BROADCASTER_ROLE = keccak256(toBytes('BROADCASTER_ROLE'));
export const BRANCH_MANAGER_ROLE = keccak256(toBytes('BRANCH_MANAGER'));
const BRANCH_MANAGER_ROLE_NAME = 'BRANCH_MANAGER';

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

  const hash = await deployer.writeContract({
    address: copyBlox,
    abi: copyBloxAbi,
    functionName: 'cloneBlox',
    args: [accountBloxImplementation, owner, broadcasterAddress, config.recoveryAddress, config.timeLockSec],
    gas: gas > gasLimit - 10_000n ? gasLimit : gas + 100_000n,
    chain,
    account: deployer.account!,
  });
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

/**
 * Find the account CopyBlox already cloned for this owner, if any. The chain is the index of record:
 * after a Teller Desk restart this is what stops "Open my account" from cloning a second one.
 */
export async function recoverAccount(owner: Address): Promise<Address | undefined> {
  const { copyBlox, copyBloxDeployedAtBlock } = d();
  const logs = await publicClient.getLogs({
    address: copyBlox,
    event: copyBloxAbi.find((x) => x.type === 'event' && x.name === 'BloxCloned')!,
    args: { initialOwner: owner },
    fromBlock: copyBloxDeployedAtBlock,
    toBlock: 'latest',
  });
  const last = logs[logs.length - 1];
  return last ? getAddress((last.args as { clone: string }).clone) : undefined;
}

/** Owner signs, broadcaster executes: the one meta-transaction shape every configuration change uses. */
async function ownerSignedBatch(
  player: Player,
  account: Address,
  kind: 'guard' | 'role',
  executionParams: Hex,
  audit?: AuditSink,
  /**
   * Gas forwarded to the *inner* `execute…ConfigBatch` call — a fixed cap the record carries, not the tx
   * gas limit. Too small and the inner call runs out of gas with no revert data (U2: seven role actions
   * did not fit in 1.5 M). Sized per batch by the caller.
   */
  innerGas = 1_000_000n,
): Promise<Hex> {
  const ctl = kind === 'guard' ? new GuardController(publicClient, broadcaster, account, chain) : new RuntimeRBAC(publicClient, broadcaster, account, chain);
  const metaSelector = kind === 'guard' ? GC_SEL.GUARD_CONFIG_BATCH_META_SELECTOR : RB_SEL.ROLE_CONFIG_BATCH_META_SELECTOR;
  const execSelector = kind === 'guard' ? GC_SEL.GUARD_CONFIG_BATCH_EXECUTE_SELECTOR : RB_SEL.ROLE_CONFIG_BATCH_EXECUTE_SELECTOR;
  const operation = kind === 'guard' ? GC_OP.CONTROLLER_CONFIG_BATCH : RB_OP.ROLE_CONFIG_BATCH;

  const metaTxParams = await ctl.createMetaTxParams(account, metaSelector, TxAction.SIGN_META_REQUEST_AND_APPROVE, await metaTxDuration(), 0n, player.ownerAddress);
  const unsigned = await ctl.generateUnsignedMetaTransactionForNew(player.ownerAddress, account, 0n, innerGas, operation, execSelector, executionParams, metaTxParams);
  const signed = await signMetaTx(publicClient, chain, unsigned, { owner: player.ownerAddress, walletId: player.walletId, account }, audit);
  const res =
    kind === 'guard'
      ? await (ctl as GuardController).guardConfigBatchRequestAndApprove(signed, { from: broadcasterAddress })
      : await (ctl as RuntimeRBAC).roleConfigBatchRequestAndApprove(signed, { from: broadcasterAddress });
  const receipt = await res.wait();
  if (receipt.status !== 'success') throw new Error(`${kind} config batch reverted (${res.hash})`);
  return res.hash as Hex;
}

/**
 * Guard configuration batch: whitelist the demo token for `transfer(address,uint256)`.
 * Skipped when the chain already lists it.
 */
export async function whitelistToken(player: Player, account: Address, audit?: AuditSink): Promise<Hex | undefined> {
  const { guardDefinitions, token } = d();
  const gc = new GuardController(publicClient, broadcaster, account, chain);
  const listed = await gc.getFunctionWhitelistTargets(EngineBlox.ERC20_TRANSFER_SELECTOR).catch(() => [] as Address[]);
  if (listed.some((a) => a.toLowerCase() === token.address.toLowerCase())) return undefined;

  const executionParams = guardConfigBatchExecutionParams(publicClient, guardDefinitions, [
    {
      actionType: GuardConfigActionType.ADD_TARGET_TO_WHITELIST,
      data: encodeAddTargetToWhitelist(publicClient, guardDefinitions, EngineBlox.ERC20_TRANSFER_SELECTOR, token.address),
    },
  ]);
  return ownerSignedBatch(player, account, 'guard', executionParams, audit);
}

/**
 * The role grants Branch Zero needs on top of `initialize`'s defaults — and why each exists.
 *
 * V4 (U1): the default role grants cover only the controller's own selectors. Every workflow checks the
 * caller's action on **both** the handler selector (e.g. `executeWithTimeLock`) and the execution selector
 * (`transfer`), so `transfer` needs explicit grants or everything reverts `NoPermission`.
 *
 * On the transfer selector:
 *   OWNER        SIGN_META_REQUEST_AND_APPROVE          Lane A: sign a routine payment (U1)
 *                EXECUTE_TIME_DELAY_REQUEST             Lane B: file a wire (`executeWithTimeLock`)
 *                EXECUTE_TIME_DELAY_APPROVE             Lane B: open the vault after `releaseTime`
 *                EXECUTE_TIME_DELAY_CANCEL              Lane B: recall a wire
 *   BROADCASTER  EXECUTE_META_REQUEST_AND_APPROVE       Lane A: execute what the owner signed (U1)
 *   BRANCH_MANAGER (runtime role, optional)
 *                EXECUTE_TIME_DELAY_APPROVE / CANCEL    the manager's stamp / shredder
 *   plus BRANCH_MANAGER on the two handler selectors `approveTimeLockExecution` / `cancelTimeLockExecution`,
 *   because the handler side of the dual check is only granted to OWNER by default.
 *
 * Deliberately **not** granted: `SIGN_META_APPROVE` / `EXECUTE_META_APPROVE` on the transfer selector.
 * `EngineBlox._txApprovalWithMetaTx` skips the `releaseTime` check by design, so a meta-approve would let
 * the session signer release a wire early. With no role holding that action on `transfer`, the only way
 * out of the vault is the direct path, and the clock is a real control — for the owner's delegated signer
 * as much as for anyone else.
 *
 * `addFunctionToRole` refuses a second grant on the same (role, selector); changing a grant means
 * REMOVE then ADD, which the transfer schema allows (`isGrantRevocable`). The handler-selector schemas are
 * not revocable, but the manager grants on them are new, never changed.
 */
interface Grant {
  role: Hex;
  selector: Hex;
  actions: TxAction[];
  handlers: Hex[];
}
export function desiredGrants(): Grant[] {
  const T = EngineBlox.ERC20_TRANSFER_SELECTOR;
  const grants: Grant[] = [
    {
      role: OWNER_ROLE,
      selector: T,
      actions: [TxAction.SIGN_META_REQUEST_AND_APPROVE, TxAction.EXECUTE_TIME_DELAY_REQUEST, TxAction.EXECUTE_TIME_DELAY_APPROVE, TxAction.EXECUTE_TIME_DELAY_CANCEL],
      handlers: [GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR, GC_SEL.EXECUTE_WITH_TIMELOCK_SELECTOR, GC_SEL.APPROVE_TIMELOCK_EXECUTION_SELECTOR, GC_SEL.CANCEL_TIMELOCK_EXECUTION_SELECTOR],
    },
    { role: BROADCASTER_ROLE, selector: T, actions: [TxAction.EXECUTE_META_REQUEST_AND_APPROVE], handlers: [GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR] },
  ];
  if (managerAddress) {
    grants.push(
      { role: BRANCH_MANAGER_ROLE, selector: T, actions: [TxAction.EXECUTE_TIME_DELAY_APPROVE, TxAction.EXECUTE_TIME_DELAY_CANCEL], handlers: [GC_SEL.APPROVE_TIMELOCK_EXECUTION_SELECTOR, GC_SEL.CANCEL_TIMELOCK_EXECUTION_SELECTOR] },
      { role: BRANCH_MANAGER_ROLE, selector: GC_SEL.APPROVE_TIMELOCK_EXECUTION_SELECTOR, actions: [TxAction.EXECUTE_TIME_DELAY_APPROVE], handlers: [GC_SEL.APPROVE_TIMELOCK_EXECUTION_SELECTOR] },
      { role: BRANCH_MANAGER_ROLE, selector: GC_SEL.CANCEL_TIMELOCK_EXECUTION_SELECTOR, actions: [TxAction.EXECUTE_TIME_DELAY_CANCEL], handlers: [GC_SEL.CANCEL_TIMELOCK_EXECUTION_SELECTOR] },
    );
  }
  return grants;
}

interface ExistingGrant {
  functionSelector: Hex;
  grantedActionsBitmap: number | bigint;
  handlerForSelectors: Hex[];
}

/** Read the chain, diff against `desiredGrants`, and send one role config batch with only what is missing. */
export async function syncRolePermissions(player: Player, account: Address, audit?: AuditSink): Promise<{ hash?: Hex; actions: string[] }> {
  const { rbacDefinitions } = d();
  const rbac = new RuntimeRBAC(publicClient, broadcaster, account, chain);
  const roles = new Set((await rbac.getSupportedRoles()).map((r) => r.toLowerCase()));
  const actions: Array<{ actionType: RoleConfigActionType; data: Hex }> = [];
  const log: string[] = [];

  const enc = (permission: Grant) => ({
    functionSelector: permission.selector,
    grantedActionsBitmap: toContractValue(createBitmapFromActions(permission.actions)),
    handlerForSelectors: permission.handlers,
  });

  const wanted = desiredGrants();
  const byRole = new Map<Hex, Grant[]>();
  for (const g of wanted) byRole.set(g.role, [...(byRole.get(g.role) ?? []), g]);

  for (const [role, grants] of byRole) {
    let existing: ExistingGrant[] = [];
    if (!roles.has(role.toLowerCase())) {
      if (role !== BRANCH_MANAGER_ROLE) throw new Error(`system role ${role} missing on ${account}`);
      actions.push({ actionType: RoleConfigActionType.CREATE_ROLE, data: encodeCreateRole(publicClient, rbacDefinitions, BRANCH_MANAGER_ROLE_NAME, 3n) });
      log.push('CREATE_ROLE BRANCH_MANAGER');
    } else {
      existing = (await rbac.getActiveRolePermissions(role)) as ExistingGrant[];
    }
    if (role === BRANCH_MANAGER_ROLE && managerAddress) {
      const has = roles.has(role.toLowerCase()) ? await rbac.hasRole(role, managerAddress) : false;
      if (!has) {
        actions.push({ actionType: RoleConfigActionType.ADD_WALLET, data: encodeAddWallet(publicClient, rbacDefinitions, role, managerAddress) });
        log.push(`ADD_WALLET ${managerAddress} → BRANCH_MANAGER`);
      }
    }
    for (const g of grants) {
      const want = enc(g);
      const cur = existing.find((e) => e.functionSelector.toLowerCase() === g.selector.toLowerCase());
      const same =
        cur &&
        Number(cur.grantedActionsBitmap) === want.grantedActionsBitmap &&
        cur.handlerForSelectors.length === g.handlers.length &&
        g.handlers.every((h) => cur.handlerForSelectors.some((x) => x.toLowerCase() === h.toLowerCase()));
      if (same) continue;
      if (cur) {
        actions.push({ actionType: RoleConfigActionType.REMOVE_FUNCTION_FROM_ROLE, data: encodeRemoveFunctionFromRole(publicClient, rbacDefinitions, role, g.selector) });
        log.push(`REMOVE ${g.selector} from ${roleName(role)} (bitmap ${Number(cur.grantedActionsBitmap)} → ${want.grantedActionsBitmap})`);
      }
      actions.push({ actionType: RoleConfigActionType.ADD_FUNCTION_TO_ROLE, data: encodeAddFunctionToRole(publicClient, rbacDefinitions, role, want) });
      log.push(`ADD ${g.selector} to ${roleName(role)} bitmap ${want.grantedActionsBitmap} handlers ${g.handlers.length}`);
    }
  }

  if (!actions.length) return { actions: log };
  const executionParams = roleConfigBatchExecutionParams(publicClient, rbacDefinitions, actions);
  // ~350k per action is generous; the record's inner gas cap is what fails silently when undersized.
  const hash = await ownerSignedBatch(player, account, 'role', executionParams, audit, 400_000n * BigInt(actions.length) + 300_000n);
  return { hash, actions: log };
}

function roleName(role: Hex): string {
  return role === OWNER_ROLE ? 'OWNER' : role === BROADCASTER_ROLE ? 'BROADCASTER' : role === BRANCH_MANAGER_ROLE ? 'BRANCH_MANAGER' : role;
}

/** Opening balance from the demo-token treasury — only when the account holds nothing yet. */
export async function fundAccount(account: Address): Promise<Hex | undefined> {
  const { token } = d();
  const balance = (await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })) as bigint;
  if (balance > 0n) return undefined;
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

/**
 * Lane B option 1 needs the owner's embedded wallet to pay gas for its own direct calls. Top it up from
 * the deployer to `OWNER_GAS_ETH` whenever it holds less than half of that. Dev ETH on 1337 only.
 */
export async function fundOwnerGas(owner: Address): Promise<{ hash?: Hex; balanceEth: string }> {
  const target = parseEther(config.ownerGasEth);
  const balance = await publicClient.getBalance({ address: owner });
  if (balance >= target / 2n) return { balanceEth: formatEther(balance) };
  const hash = await deployer.sendTransaction({ to: owner, value: target - balance, chain, account: deployer.account! });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, balanceEth: formatEther(await publicClient.getBalance({ address: owner })) };
}

/**
 * V6 — make sure the player's policy carries the `eth_signTransaction` rules, and pin them to the account
 * once it exists. Rules are app-owned, so this never needs a second consent. Called from `/session`
 * (chain-scoped, before delegation) and from provisioning (pinned).
 */
export async function ensureTxPolicy(player: Player, account?: Address): Promise<Player> {
  const policyId = player.policyId;
  if (!policyId) return player;
  const { token } = d();
  let p = player;
  if (!p.txRuleIds?.length) {
    const created = await createTxRules(policyId, chain.id, token.address, account);
    p = patchPlayer(p.privyUserId, { txRuleIds: created.ruleIds, txPolicyMode: created.mode, txPolicyPinned: Boolean(account) });
    if (created.fallbackReason) console.warn(`[V6] calldata-scoped tx rules refused, using to-only: ${created.fallbackReason}`);
  }
  if (account && !p.txPolicyPinned && p.txRuleIds && p.txPolicyMode) {
    await pinTxRulesToAccount(policyId, { ruleIds: p.txRuleIds, mode: p.txPolicyMode }, account, chain.id, token.address);
    p = patchPlayer(p.privyUserId, { txPolicyPinned: true });
  }
  return p;
}

/** Full Account Opening. Idempotent: everything is checked against the chain (or Privy) before it is sent. */
export async function provision(player: Player, jobId: string, audit?: AuditSink): Promise<{ account: Address; timeLockSec: number; roleSet: number }> {
  const stage = (s: Parameters<typeof emitStage>[1]['stage'], bankLine: string, extra: Record<string, unknown> = {}) =>
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'PROVISION', stage: s, bankLine, ...extra });

  let account = player.account;
  if (!account) {
    stage('provisioning', 'Checking the files for an existing account…');
    account = await recoverAccount(player.ownerAddress);
    if (account) {
      patchPlayer(player.privyUserId, { account });
      stage('provisioning', 'Found your account on file.', { account });
    }
  }
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
  let current: Player = { ...player, account };
  const policy = player.policyId && player.policyRuleId ? { policyId: player.policyId, ruleId: player.policyRuleId } : undefined;
  if (policy && !player.policyPinned) {
    try {
      await pinPolicyToAccount(policy, account, chain.id);
      current = patchPlayer(player.privyUserId, { policyPinned: true });
    } catch (e) {
      stage('provisioning', 'Account opened.', { reason: `policy not pinned to account: ${(e as Error).message}` });
    }
  }
  // V6 — same lifecycle for the owner-transaction rules.
  try {
    current = await ensureTxPolicy(current, account);
  } catch (e) {
    stage('provisioning', 'Account opened.', { reason: `tx policy not pinned to account: ${(e as Error).message}` });
  }

  stage('configuring', 'Adding the payee list to your file…');
  const whitelistHash = await whitelistToken(current, account, audit);
  stage('configuring', whitelistHash ? 'Payee list approved.' : 'Payee list already on file.', whitelistHash ? { hash: whitelistHash } : {});

  stage('configuring', 'Authorising the counter, the vault and the manager…');
  const sync = await syncRolePermissions(current, account, audit);
  current = patchPlayer(player.privyUserId, { configured: true, roleSet: ROLE_SET_VERSION });
  stage('configuring', sync.hash ? `Desks authorised (${sync.actions.length} changes).` : 'Desks already authorised.', sync.hash ? { hash: sync.hash } : {});

  stage('funding', 'Counting out your opening balance…');
  const funded = await fundAccount(account);
  const gas = await fundOwnerGas(player.ownerAddress);
  stage('funding', funded ? 'Opening balance deposited.' : 'Balance already on deposit.', { ...(funded ? { hash: funded } : {}), ownerGasEth: gas.balanceEth });

  stage('mined', 'Your account is ready.', { account });
  return { account, timeLockSec: Number(config.timeLockSec), roleSet: ROLE_SET_VERSION };
}
