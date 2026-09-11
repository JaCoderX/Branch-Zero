/**
 * U4+ kill tests — Priority release (G5b), HANDOFF-CC §5e, against Remote EVM 1337 and the live Privy application.
 *
 *   npm -w apps/teller-desk run killtests:u4plus            # reuse the rig player (Re-check upgrades it to ROLE_SET 3)
 *   npm -w apps/teller-desk run killtests:u4plus -- --fresh # mint a new Privy user + wallet + account
 *
 * Same rig as U1/U2: a server-created Privy user whose embedded wallet carries our key quorum under the per-player
 * policy. The code under test is the product code (`provision`, `wire`, `approve`, `preparePriority`,
 * `submitPriority`, `pay`).
 *
 * One honest substitution. In the product the owner's Priority signature is made **in the browser** by the player's
 * own signer behind a Passkey (ENG-2026-0013 M2 proved that UI). A headless rig has no Passkey, and the product policy
 * forbids the session signer from signing that payload — which Y8 checks. So for Y3/Y4 the rig briefly re-writes its
 * own policy rule to the pre-U4+ shape, signs the very same contract-built payload with the session signer, restores
 * the rule, and hands the signature to `submitPriority` exactly as the overlay would. Recover == owner is the same
 * check either way; what the browser adds is *who holds the key that produced it*.
 *
 * What is asserted:
 *   Y0   Re-check provisioning lands ROLE_SET 3: OWNER +SIGN_META_APPROVE, BRANCH_MANAGER +EXECUTE_META_APPROVE,
 *        BRANCH_MANAGER −EXECUTE_TIME_DELAY_APPROVE on `transfer`; no role holds both META_APPROVE halves.
 *   Y1   owner files a wire → PENDING with a future `releaseTime`.
 *   Y2   Bob early (owner timed approve) → `BeforeReleaseTime`.   Y2b manager direct approve early → `NoPermission`.
 *   Y8b  a counter pay under the action-pinned rule → still signs silently (the silent lane is intact).
 *   Y8a  the session signer is asked to sign the Priority payload under the **product** policy → `policy_violation`.
 *   Y8c  after the rig's one relaxed signature the restored rule denies again.
 *   Y9   the `packages/shared` EIP-712 transcription matches what the SDK asks the wallet to sign (checked in prepare).
 *   Y4   the owner submits their own meta-approve → `NoPermission`; record still PENDING.
 *   Y3   owner-signed meta-approve submitted by BRANCH_MANAGER **before** `releaseTime` → COMPLETED, payee paid.
 *   Y5   the manager cannot file (`executeWithTimeLock` → `NoPermission`).
 *   Y7   a second wire; after the clock: Y7b manager direct approve → `NoPermission` (no post-clock stamp);
 *        Bob (owner) → COMPLETED.
 *   Y6   vault-only mode: `desiredGrants(false)` carries no META_APPROVE bit for any role (config-level).
 */
import { createWalletClient, encodeAbiParameters, formatUnits, getAddress, http, keccak256, parseAbiParameters, parseUnits, toBytes, type Address, type Hex } from 'viem';
import { toAccount } from 'viem/accounts';
import { EngineBlox, GuardController, GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL, RuntimeRBAC, TxAction } from '@bloxchain/sdk';
import { erc20Abi } from '@branch-zero/shared';
import { chain, deployer, manager, managerAddress, publicClient, broadcaster } from '../src/chain.ts';
import { config, deployments } from '../src/config.ts';
import { createPlayerPolicy, embeddedWalletOf, pinPolicyToAccount, privy, recoverPolicy } from '../src/privy.ts';
import { signMetaTx } from '../src/signing/privySigner.ts';
import { pay } from '../src/lanes/laneA.ts';
import { approve, cancel, explainRevert, listPending, readWire, wire } from '../src/lanes/laneB.ts';
import { peekPrepared, preparePriority, submitPriority } from '../src/lanes/priority.ts';
import { BRANCH_MANAGER_ROLE, OWNER_ROLE, ROLE_SET_VERSION, desiredGrants, ensureTxPolicy, ensureTypedDataPolicy, provision, recoverAccount } from '../src/lanes/provision.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const FRESH = process.argv.includes('--fresh');
const PAYEE = getAddress('0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC') as Address; // Ganache acct5 — a payee, no role

type Verdict = 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP';
const results: Array<{ id: string; verdict: Verdict; note: string }> = [];
function record(id: string, verdict: Verdict, note: string) {
  results.push({ id, verdict, note });
  console.log(`\n${verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : verdict === 'SKIP' ? '-' : '✗'} ${id} ${verdict} — ${note}\n`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);
const code = (e: unknown) => (e as { code?: string }).code ?? explainRevert(e).code;
const bit = (bitmap: number | bigint, action: number) => ((Number(bitmap) >> action) & 1) === 1;

async function rigPlayer(): Promise<Player> {
  const email = FRESH ? RIG_EMAIL.replace('@', `+${Date.now().toString(36)}@`) : RIG_EMAIL;
  const existing = await privy.users().getByEmailAddress({ address: email }).catch(() => undefined);
  if (existing) {
    const w = embeddedWalletOf(existing);
    const stored = getPlayer(existing.id);
    const recovered = stored?.policyId ? undefined : await recoverPolicy(w.walletId).catch(() => undefined);
    console.log(`reusing Privy user ${existing.id}\n  wallet ${w.walletId} → ${w.ownerAddress} (delegated: ${w.delegated})`);
    return upsertPlayer({
      privyUserId: existing.id,
      ownerAddress: w.ownerAddress,
      walletId: w.walletId,
      signingMode: w.delegated ? 'session' : 'client',
      policyId: stored?.policyId ?? recovered?.policyId,
      policyRuleId: stored?.policyRuleId ?? recovered?.ruleId,
      txRuleIds: stored?.txRuleIds ?? recovered?.txRules?.ruleIds,
      txPolicyMode: stored?.txPolicyMode ?? recovered?.txRules?.mode,
      account: stored?.account ?? (await recoverAccount(w.ownerAddress)),
    });
  }
  const policy = await createPlayerPolicy(chain.id, `rig-${Date.now().toString(36)}`);
  console.log(`policy ${policy.policyId} (rule ${policy.ruleId}) — chain-scoped until an account exists`);
  const user = await privy.users().create({
    linked_accounts: [{ type: 'email', address: email }],
    wallets: [{ chain_type: 'ethereum', additional_signers: [{ signer_id: config.privy.signerId, override_policy_ids: [policy.policyId] }] }],
  });
  const wallet = embeddedWalletOf(user);
  console.log(`privy user ${user.id}\n  wallet ${wallet.walletId} → ${wallet.ownerAddress}\n  re-run without --fresh using: KILLTEST_EMAIL=${email}`);
  return upsertPlayer({ privyUserId: user.id, ownerAddress: wallet.ownerAddress, walletId: wallet.walletId, signingMode: 'session', policyId: policy.policyId, policyRuleId: policy.ruleId });
}

/**
 * Does this wallet actually carry a policy for our key quorum? (U2 finding.) A user-controlled wallet's signers and
 * policies can only be set by the user or at creation; a rig user created before policies existed has none, and then
 * nothing can deny the session signer anything — Y8a would "fail" for the wrong reason. `--fresh` mints one correctly.
 */
async function attachedPolicy(walletId: string): Promise<string | undefined> {
  const w = (await privy.wallets().get(walletId)) as { policy_ids?: string[]; additional_signers?: Array<{ signer_id?: string; override_policy_ids?: string[] }> };
  return w.additional_signers?.find((x) => x.signer_id === config.privy.signerId)?.override_policy_ids?.[0] ?? w.policy_ids?.[0];
}

const balanceOf = async (who: Address) => (await publicClient.readContract({ address: deployments().token.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] })) as bigint;
const ERC20_TRANSFER_OPERATION = keccak256(toBytes('ERC20_TRANSFER'));

/** A GuardController "as the owner" that can only simulate: eth_call needs no signature, so a revert is on chain logic. */
function ownerSimulator(owner: Address, account: Address) {
  const acct = toAccount({
    address: owner,
    async signTypedData() {
      throw new Error('simulate only');
    },
    async signMessage() {
      throw new Error('simulate only');
    },
    async signTransaction() {
      throw new Error('simulate only — the pre-flight should have refused before signing');
    },
  });
  return new GuardController(publicClient, createWalletClient({ account: acct, chain, transport: http(config.rpcUrl) }), account, chain);
}

async function main() {
  if (!manager || !managerAddress) {
    console.error('MANAGER_PK is required for the Priority desk — set it in .env');
    process.exitCode = 1;
    return;
  }
  if (!config.priorityRelease) {
    console.error('PRIORITY_RELEASE is off — these kill tests need the Priority desk (set PRIORITY_RELEASE=on)');
    process.exitCode = 1;
    return;
  }
  console.log(`chain ${chain.id} · Privy app ${config.privy.appId} · manager ${managerAddress} · timelock ${config.timeLockSec}s · ROLE_SET ${ROLE_SET_VERSION} · priority ${config.priorityRelease}\n`);
  let player = await rigPlayer();
  const { token } = deployments();

  // ---- provision / Re-check → ROLE_SET 3
  console.log('provisioning (Re-check: clone if needed, whitelist, role sync REMOVE+ADD, funding, policies)…');
  const before = getPlayer(player.privyUserId)?.roleSet ?? 0;
  const prov = await provision(player, 'kt-u4plus-provision');
  player = getPlayer(player.privyUserId)!;
  const account = prov.account;
  player = await ensureTxPolicy(player, account);
  player = await ensureTypedDataPolicy(player);
  console.log(`account ${account} · roleSet ${before} → ${prov.roleSet} · priority ${prov.priority} · changes: ${prov.roleChanges.join(' | ') || 'none'}${prov.stranded.length ? ` · stranded: ${prov.stranded.join('; ')}` : ''}\n`);

  // ---- housekeeping: a previous run may have left a PENDING record (a failed Y3); recall it so the board is clean
  for (const stale of await listPending(account)) {
    try {
      await cancel(player, BigInt(stale.txId), 'owner', 'kt-u4plus-cleanup');
      console.log(`recalled stale PENDING record #${stale.txId} from an earlier run`);
    } catch (e) {
      console.log(`could not recall stale record #${stale.txId}: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  // ---- housekeeping: the rig spends real dUSDC every run; a wire released against an empty account executes as
  //      FAILED (run 4, Y7). Top the account back up to the opening balance from the treasury (deployer) first.
  {
    const bal = await balanceOf(account);
    const want = parseUnits(config.openingBalance, token.decimals);
    if (bal < want) {
      const hash = await deployer.writeContract({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [account, want - bal], chain, account: deployer.account! });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`topped the rig account up from ${formatUnits(bal, token.decimals)} to ${config.openingBalance} ${token.symbol} (${hash})`);
    }
  }

  // ---- Y0: grants as the chain has them
  {
    const rbac = new RuntimeRBAC(publicClient, broadcaster, account, chain);
    const T = EngineBlox.ERC20_TRANSFER_SELECTOR.toLowerCase();
    const grantsOf = async (role: Hex) => (await rbac.getActiveRolePermissions(role)) as Array<{ functionSelector: Hex; grantedActionsBitmap: number | bigint; handlerForSelectors: Hex[] }>;
    const owner = await grantsOf(OWNER_ROLE);
    const mgr = await grantsOf(BRANCH_MANAGER_ROLE);
    const oT = owner.find((g) => g.functionSelector.toLowerCase() === T);
    const mT = mgr.find((g) => g.functionSelector.toLowerCase() === T);
    const mHandlerApprove = mgr.find((g) => g.functionSelector.toLowerCase() === GC_SEL.APPROVE_TIMELOCK_EXECUTION_SELECTOR.toLowerCase());
    const mHandlerMeta = mgr.find((g) => g.functionSelector.toLowerCase() === GC_SEL.APPROVE_TIMELOCK_EXECUTION_META_SELECTOR.toLowerCase());
    const ok =
      !!oT &&
      bit(oT.grantedActionsBitmap, TxAction.SIGN_META_APPROVE) &&
      bit(oT.grantedActionsBitmap, TxAction.EXECUTE_TIME_DELAY_APPROVE) &&
      !bit(oT.grantedActionsBitmap, TxAction.EXECUTE_META_APPROVE) &&
      !!mT &&
      bit(mT.grantedActionsBitmap, TxAction.EXECUTE_META_APPROVE) &&
      bit(mT.grantedActionsBitmap, TxAction.EXECUTE_TIME_DELAY_CANCEL) &&
      !bit(mT.grantedActionsBitmap, TxAction.EXECUTE_TIME_DELAY_APPROVE) &&
      !bit(mT.grantedActionsBitmap, TxAction.SIGN_META_APPROVE) &&
      !!mHandlerMeta &&
      prov.roleSet === ROLE_SET_VERSION &&
      player.priority === true;
    record(
      'Y0',
      ok ? 'PASS' : 'FAIL',
      `transfer grants — OWNER bitmap ${oT ? Number(oT.grantedActionsBitmap) : 'none'} (SIGN_META_APPROVE ${oT ? bit(oT.grantedActionsBitmap, TxAction.SIGN_META_APPROVE) : '-'}, timed approve ${oT ? bit(oT.grantedActionsBitmap, TxAction.EXECUTE_TIME_DELAY_APPROVE) : '-'}) · BRANCH_MANAGER bitmap ${mT ? Number(mT.grantedActionsBitmap) : 'none'} (EXECUTE_META_APPROVE ${mT ? bit(mT.grantedActionsBitmap, TxAction.EXECUTE_META_APPROVE) : '-'}, timed approve ${mT ? bit(mT.grantedActionsBitmap, TxAction.EXECUTE_TIME_DELAY_APPROVE) : '-'}) · manager handler approveTimeLockExecution: ${mHandlerApprove ? `still granted (bitmap ${Number(mHandlerApprove.grantedActionsBitmap)}; ${prov.stranded.length ? 'schema not revocable, inert without the transfer half' : 'unexpected'})` : 'removed'} · handler approveTimeLockExecutionWithMetaTx: ${mHandlerMeta ? 'granted' : 'MISSING'} · roleSet ${prov.roleSet}`,
    );
  }

  // ---- Y1: owner files
  const payee0 = await balanceOf(PAYEE);
  const w1 = await wire(player, PAYEE, '250', 'kt-u4plus-wire-1');
  const rec1 = await readWire(account, BigInt(w1.txId));
  record('Y1', rec1.status === 'PENDING' && Number(rec1.releaseTime) > now() ? 'PASS' : 'FAIL', `owner filed executeWithTimeLock via session signer → txId ${w1.txId} ${rec1.status}, releaseTime ${rec1.releaseTime} (wall ${now()}, ${Number(rec1.releaseTime) - now()} s of cooling)`);

  // ---- Y2: Bob early → BeforeReleaseTime; Y2b: manager direct approve → NoPermission
  try {
    await approve(player, BigInt(w1.txId), 'owner', 'kt-u4plus-ruth-early');
    record('Y2', 'FAIL', `owner approve before releaseTime succeeded on txId ${w1.txId}`);
  } catch (e) {
    record('Y2', code(e) === 'BeforeReleaseTime' ? 'PASS' : 'PARTIAL', `Bob early → ${code(e)}: ${(e as Error).message.slice(0, 140)}`);
  }
  try {
    await approve(player, BigInt(w1.txId), 'manager', 'kt-u4plus-manager-early');
    record('Y2b', 'FAIL', `manager direct approve succeeded before releaseTime on txId ${w1.txId} — the timed stamp is back`);
  } catch (e) {
    const c = code(e);
    record('Y2b', c === 'NoPermission' ? 'PASS' : c === 'BeforeReleaseTime' ? 'FAIL' : 'PARTIAL', `manager direct approve early → ${c} (${c === 'NoPermission' ? 'grant removed: Walker is not a second Bob' : c === 'BeforeReleaseTime' ? 'the manager still holds the timed stamp' : 'unexpected'}): ${(e as Error).message.slice(0, 120)}`);
  }

  // ---- Y8b: Lane A under the action-pinned rule — still silent. Before the Priority payload is prepared: a meta-tx
  //      consumes the owner's signer nonce, and a payload prepared earlier would then revert `InvalidNonce` (run 3 finding).
  try {
    const paid = await pay(player, PAYEE, '1', 'kt-u4plus-pay');
    record('Y8b', 'PASS', `counter pay 1 ${token.symbol} signs silently under the action-pinned rule: ${paid.hash} (record #${paid.txId ?? '?'})`);
  } catch (e) {
    record('Y8b', 'FAIL', `counter pay refused under the action pin: ${code(e)}: ${(e as Error).message.slice(0, 160)}`);
  }

  // ---- prepare the Priority payload (Y9 shape check happens inside)
  let prep;
  try {
    prep = await preparePriority(player, BigInt(w1.txId), 'kt-u4plus-priority');
    record('Y9', 'PASS', `prepare built the owner's SIGN_META_APPROVE payload for txId ${prep.txId} (deadline ${prep.deadline}); SDK typed data matched packages/shared META_TX_TYPED_DATA_TYPES; domain ${prep.typedData.domain.name} v${prep.typedData.domain.version} chain ${prep.typedData.domain.chainId} verifyingContract ${prep.typedData.domain.verifyingContract}`);
  } catch (e) {
    record('Y9', 'FAIL', `preparePriority failed: ${code(e)}: ${(e as Error).message.slice(0, 200)}`);
    return finish();
  }
  const unsigned = peekPrepared(prep.priorityId)!;
  const ctx = { owner: player.ownerAddress, walletId: player.walletId, account };
  const attached = await attachedPolicy(player.walletId).catch(() => undefined);
  const policyAttached = Boolean(attached && player.policyId && attached === player.policyId && player.policyRuleId);
  const rule = policyAttached ? { policyId: player.policyId!, ruleId: player.policyRuleId! } : undefined;
  console.log(`wallet policy ${attached ?? 'none'} · player policy ${player.policyId ?? 'none'} (rule ${player.policyRuleId ?? 'none'}, shape v${player.typedDataRule ?? 1}) · ours and attached: ${policyAttached}`);

  // ---- Y8a: the silent lane must not be able to sign the bypass payload under the product policy
  try {
    await signMetaTx(publicClient, chain, unsigned, ctx);
    record(
      'Y8a',
      policyAttached ? 'FAIL' : 'PARTIAL',
      policyAttached
        ? 'the session signer signed the Priority payload (SIGN_META_APPROVE) under the product policy — the hand scan is decoration'
        : 'not a valid test: this rig wallet carries no policy for our signer, so nothing could deny it. Re-run with --fresh.',
    );
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const denied = err.status === 403 || err.status === 400 || /polic/i.test(err.message ?? '');
    record('Y8a', denied ? 'PASS' : 'PARTIAL', `session signer asked to sign params.action=4 → ${denied ? `policy_violation (HTTP ${err.status})` : 'refused, but not visibly on policy'}: ${err.message?.slice(0, 160)}`);
  }
  // ---- rig substitution: pre-U4+ rule shape, sign the same payload with the session signer, restore
  let signature: Hex | undefined;
  if (rule) {
    try {
      await pinPolicyToAccount(rule, account, chain.id, { pinAction: false });
      signature = (await signMetaTx(publicClient, chain, unsigned, ctx)).signature as Hex;
    } finally {
      await pinPolicyToAccount(rule, account, chain.id);
    }
    console.log(`rig: owner signature for the Priority payload obtained with the rule relaxed, rule restored (${signature?.slice(0, 18)}…)`);
    // ---- Y8c: restored rule denies again
    try {
      await signMetaTx(publicClient, chain, unsigned, ctx);
      record('Y8c', 'FAIL', 'after restoring the rule the session signer still signs the Priority payload');
    } catch (e) {
      const err = e as { status?: number; message?: string };
      const denied = err.status === 403 || err.status === 400 || /polic/i.test(err.message ?? '');
      record('Y8c', denied ? 'PASS' : 'PARTIAL', `rule restored → session signer refused again (${denied ? 'policy_violation' : err.message?.slice(0, 80)})`);
    }
  } else {
    // no policy on this wallet: the session signer is unconstrained, so the same call simply signs
    signature = (await signMetaTx(publicClient, chain, unsigned, ctx)).signature as Hex;
    console.log(`rig: owner signature obtained from an unconstrained wallet (${signature.slice(0, 18)}…) — policy tests are PARTIAL this run`);
  }

  // ---- Y4: owner submits their own meta-approve → NoPermission (simulated as the owner; no key needed for eth_call)
  try {
    const signed = { ...unsigned, signature: signature! };
    await ownerSimulator(player.ownerAddress, account).approveTimeLockExecutionWithMetaTx(signed as never, { from: player.ownerAddress });
    record('Y4', 'FAIL', 'the owner could submit their own meta-approve');
  } catch (e) {
    const c = code(e);
    const still = await readWire(account, BigInt(w1.txId));
    record('Y4', c === 'NoPermission' && still.status === 'PENDING' ? 'PASS' : 'PARTIAL', `owner submits own meta-approve → ${c}; record ${w1.txId} still ${still.status}`);
  }

  // ---- Y3: Priority — manager submits the owner-signed meta-approve before releaseTime
  try {
    const payeeMid = await balanceOf(PAYEE);
    const r = await submitPriority(player, prep.priorityId, signature!, 'kt-u4plus-priority');
    const moved = (await balanceOf(PAYEE)) - payeeMid;
    const early = Number(r.chainNow) < Number(r.releaseTime);
    record(
      'Y3',
      r.status === 'COMPLETED' && early && moved === parseUnits('250', token.decimals) ? 'PASS' : 'FAIL',
      `BRANCH_MANAGER ${managerAddress} submitted approveTimeLockExecutionWithMetaTx (owner-signed SIGN_META_APPROVE) → txId ${r.txId} ${r.status} at chain ${r.chainNow} < releaseTime ${r.releaseTime} (${Number(r.releaseTime) - Number(r.chainNow)} s early); payee +${formatUnits(moved, token.decimals)} ${token.symbol}; ${r.hash}`,
    );
  } catch (e) {
    record('Y3', 'FAIL', `priority submit refused: ${code(e)}: ${(e as Error).message.slice(0, 200)}`);
  }

  // ---- Y5: manager cannot file
  try {
    const params = encodeAbiParameters(parseAbiParameters('address, uint256'), [PAYEE, parseUnits('1', token.decimals)]);
    await new GuardController(publicClient, manager, account, chain).executeWithTimeLock(token.address, 0n, EngineBlox.ERC20_TRANSFER_SELECTOR, params, 200_000n, ERC20_TRANSFER_OPERATION, { from: managerAddress });
    record('Y5', 'FAIL', 'the manager filed a wire');
  } catch (e) {
    record('Y5', code(e) === 'NoPermission' ? 'PASS' : 'PARTIAL', `manager executeWithTimeLock → ${code(e)}`);
  }

  // ---- Y7: Bob after the clock (same account); Y7b: manager post-clock direct approve refused
  const w2 = await wire(player, PAYEE, '150', 'kt-u4plus-wire-2');
  const release = Number(w2.releaseTime);
  console.log(`txId ${w2.txId} PENDING, releaseTime ${release}; waiting ${Math.max(0, release - now())}s (no evm_increaseTime on Remote EVM)…`);
  while (now() < release + 1) await sleep(1000);
  try {
    await approve(player, BigInt(w2.txId), 'manager', 'kt-u4plus-manager-late');
    record('Y7b', 'FAIL', 'the manager stamped a release after the clock');
  } catch (e) {
    record('Y7b', code(e) === 'NoPermission' ? 'PASS' : 'PARTIAL', `manager direct approve after the clock → ${code(e)} (no post-clock stamp)`);
  }
  try {
    const payeeMid = await balanceOf(PAYEE);
    const a = await approve(player, BigInt(w2.txId), 'owner', 'kt-u4plus-ruth');
    const moved = (await balanceOf(PAYEE)) - payeeMid;
    record('Y7', a.status === 'COMPLETED' && moved === parseUnits('150', token.decimals) ? 'PASS' : 'FAIL', `Bob (owner timed approve, session signer) after releaseTime → txId ${w2.txId} ${a.status}; payee +${formatUnits(moved, token.decimals)}; ${a.hash}`);
  } catch (e) {
    record('Y7', 'FAIL', `Bob after the clock refused: ${code(e)}: ${(e as Error).message.slice(0, 160)}`);
  }

  // ---- Y6: vault-only grant set carries no META_APPROVE bits
  {
    const vaultOnly = desiredGrants(false);
    const meta = vaultOnly.filter((g) => g.actions.includes(TxAction.SIGN_META_APPROVE) || g.actions.includes(TxAction.EXECUTE_META_APPROVE));
    const mgrApprove = vaultOnly.filter((g) => g.role === BRANCH_MANAGER_ROLE && g.actions.includes(TxAction.EXECUTE_TIME_DELAY_APPROVE));
    record('Y6', meta.length === 0 && mgrApprove.length === 0 ? 'PASS' : 'FAIL', `desiredGrants(priority=false): ${vaultOnly.length} grants, META_APPROVE bits on ${meta.length} of them, manager timed approve on ${mgrApprove.length} — the U2 invariant holds for vault-only accounts (config-level; on chain the untimed path then has no permission-holder, LaneB-1 2026-09-06)`);
  }

  const pendingNow = (await listPending(account)).map((x) => x.txId);
  console.log(`\npayee ${PAYEE}: ${formatUnits((await balanceOf(PAYEE)) - payee0, token.decimals)} ${token.symbol} received during this run · pending now [${pendingNow.join(',')}]`);
  finish();
}

function finish() {
  console.log('\n─── U4+ kill tests (G5b) ───');
  for (const r of results) console.log(`${r.id.padEnd(5)} ${r.verdict.padEnd(7)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
