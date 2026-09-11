/**
 * U2 kill tests — V6 (owner transactions through the session signer, policy-scoped) and Lane B end to end
 * against Remote EVM 1337 and the live Privy application.
 *
 *   npm -w apps/teller-desk run killtests:u2            # reuse the rig player (and its account, via chain recovery)
 *   npm -w apps/teller-desk run killtests:u2 -- --fresh # mint a new Privy user + wallet + account
 *
 * The rig player is a server-created Privy user whose embedded wallet carries our key quorum with the
 * per-player policy — the same object a human's consent produces (see kill-tests.ts). From there the code
 * under test is the product code: `provision`, `wire`, `approve`, `cancel` from src/lanes.
 *
 * What is asserted:
 *   V6-a   Privy signs `executeWithTimeLock` for the player's own account (raw tx, broadcast by us) and the
 *          chain accepts it: a PENDING record exists with `releaseTime` ≈ block.timestamp + TIMELOCK_SEC.
 *   V6-b   The same wallet is refused when the transaction targets an account it does not own (the U0 fixture).
 *   LaneB-1  approve **before** releaseTime reverts `BeforeReleaseTime` — the clock is enforced on chain.
 *   LaneB-2  cancel while PENDING → CANCELLED; nothing moved.
 *   LaneB-3  a second wire, wait out the clock (no time warp on this chain), approve → COMPLETED, payee paid.
 *   LaneB-4  (if MANAGER_PK) U4+: the Branch Manager is refused NoPermission before and after the clock (no timed stamp)
 *            and recalls the third wire instead.
 */
import { encodeFunctionData, formatUnits, getAddress, parseAbi, parseUnits, type Address } from 'viem';
import { erc20Abi } from '@branch-zero/shared';
import { chain, deployer, managerAddress, publicClient } from '../src/chain.ts';
import { config, deployments } from '../src/config.ts';
import { authorizationContext, createPlayerPolicy, embeddedWalletOf, privy, recoverPolicy } from '../src/privy.ts';
import { approve, cancel, explainRevert, listPending, readWire, wire } from '../src/lanes/laneB.ts';
import { ensureTxPolicy, provision, recoverAccount } from '../src/lanes/provision.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const FRESH = process.argv.includes('--fresh');
const PAYEE = getAddress('0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC') as Address; // Ganache acct5 — a payee, no role

const results: Array<{ id: string; verdict: 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP'; note: string }> = [];
function record(id: string, verdict: 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP', note: string) {
  results.push({ id, verdict, note });
  console.log(`\n${verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : verdict === 'SKIP' ? '-' : '✗'} ${id} ${verdict} — ${note}\n`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);

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
  console.log(`creating Privy user ${email} with an embedded EVM wallet + session signer…`);
  const user = await privy.users().create({
    linked_accounts: [{ type: 'email', address: email }],
    wallets: [{ chain_type: 'ethereum', additional_signers: [{ signer_id: config.privy.signerId, override_policy_ids: [policy.policyId] }] }],
  });
  const wallet = embeddedWalletOf(user);
  console.log(`privy user ${user.id}\n  wallet ${wallet.walletId} → ${wallet.ownerAddress}\n  re-run without --fresh using: KILLTEST_EMAIL=${email}`);
  return upsertPlayer({ privyUserId: user.id, ownerAddress: wallet.ownerAddress, walletId: wallet.walletId, signingMode: 'session', policyId: policy.policyId, policyRuleId: policy.ruleId });
}

/**
 * Does this wallet actually carry a policy for our key quorum?
 *
 * V6-b only means something if it does. A user-controlled wallet's signers and policies can only be set by
 * the user (U1 finding: server-side `wallets().update` is 401), and the kill-test rig sets them at wallet
 * creation — so a *reused* rig user whose wallet was created without them can never be policy-tested here.
 * `--fresh` mints one correctly.
 */
async function attachedPolicy(walletId: string): Promise<string | undefined> {
  const w = (await privy.wallets().get(walletId)) as { policy_ids?: string[]; additional_signers?: Array<{ signer_id?: string; override_policy_ids?: string[] }> };
  return w.additional_signers?.find((x) => x.signer_id === config.privy.signerId)?.override_policy_ids?.[0] ?? w.policy_ids?.[0];
}

const balanceOf = async (who: Address) => (await publicClient.readContract({ address: deployments().token.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] })) as bigint;

/** V6-b — ask Privy to sign the very same call, but addressed to an account the wallet does not own. */
async function v6Negative(player: Player, policyAttached: boolean) {
  const { fixtureAccount, token } = deployments();
  const abi = parseAbi(['function executeWithTimeLock(address,uint256,bytes4,bytes,uint256,bytes32) returns (uint256)']);
  const data = encodeFunctionData({ abi, functionName: 'executeWithTimeLock', args: [token.address, 0n, '0xa9059cbb', '0x', 200_000n, `0x${'00'.repeat(32)}`] });
  try {
    const res = await privy.wallets().ethereum().signTransaction(player.walletId, {
      authorization_context: authorizationContext,
      params: { transaction: { type: 2, chain_id: chain.id, nonce: 0, to: fixtureAccount, value: '0x0', data, gas_limit: '0x30d40', max_fee_per_gas: '0x3b9aca00', max_priority_fee_per_gas: '0x0' } },
    } as never);
    record(
      'V6-b',
      policyAttached ? 'FAIL' : 'PARTIAL',
      policyAttached
        ? `Privy signed a transaction to ${fixtureAccount}, an account this wallet does not own (${String((res as { signed_transaction: string }).signed_transaction).slice(0, 20)}…)`
        : `not a valid test: this rig wallet carries no policy for our signer, so nothing could deny it. Re-run with --fresh (a user-controlled wallet's policies can only be set at creation / by the user).`,
    );
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const denied = err.status === 403 || err.status === 400 || /polic/i.test(err.message ?? '');
    record('V6-b', denied ? 'PASS' : 'PARTIAL', denied ? `policy denied to=${fixtureAccount} (HTTP ${err.status}): ${err.message?.slice(0, 160)}` : `refused but not visibly on policy: ${err.message?.slice(0, 200)}`);
  }
}

async function main() {
  console.log(`chain ${chain.id} · Privy app ${config.privy.appId} · signer ${config.privy.signerId} · manager ${managerAddress ?? 'none'} · timelock ${config.timeLockSec}s\n`);
  let player = await rigPlayer();

  console.log('provisioning (clone if needed, whitelist, role sync, funding, tx policy)…');
  const prov = await provision(player, 'killtest-u2-provision');
  player = getPlayer(player.privyUserId)!;
  const account = prov.account;
  player = await ensureTxPolicy(player, account);
  const attached = await attachedPolicy(player.walletId).catch(() => undefined);
  const policyAttached = Boolean(attached && attached === player.policyId);
  console.log(
    `account ${account} · roleSet ${prov.roleSet} · tx policy ${player.txPolicyMode ?? 'none'} pinned=${Boolean(player.txPolicyPinned)} · wallet policy ${attached ?? 'none'} (ours: ${policyAttached})\n`,
  );
  const { token } = deployments();

  // The rig spends real dUSDC every run; a wire released against an empty account executes as FAILED (U4+ finding).
  // Top the account back up to the opening balance from the treasury before filing anything.
  {
    const bal = await balanceOf(account);
    const want = parseUnits(config.openingBalance, token.decimals);
    if (bal < want) {
      const hash = await deployer.writeContract({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [account, want - bal], chain, account: deployer.account! });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`topped the rig account up from ${formatUnits(bal, token.decimals)} to ${config.openingBalance} ${token.symbol} (${hash})`);
    }
  }

  // ---- V6-a: wire → PENDING with releaseTime from the chain
  const t0 = now();
  let w1;
  try {
    w1 = await wire(player, PAYEE, '250', 'kt-wire-1');
  } catch (e) {
    const why = explainRevert(e);
    record('V6-a', 'FAIL', `wire refused: ${why.code}: ${why.message}`);
    return finish();
  }
  const rec1 = await readWire(account, BigInt(w1.txId));
  const block = await publicClient.getBlock({ blockHash: (await publicClient.getTransactionReceipt({ hash: w1.hash })).blockHash });
  const expected = Number(block.timestamp) + Number(config.timeLockSec);
  const ok1 = rec1.status === 'PENDING' && Number(rec1.releaseTime) === expected;
  record('V6-a', ok1 ? 'PASS' : 'FAIL', `owner sent executeWithTimeLock via session signer (policy: ${player.txPolicyMode ?? 'none'}${policyAttached ? ', attached' : ', NOT attached to wallet'}); txId ${w1.txId} ${rec1.status}, releaseTime ${rec1.releaseTime} = block ${block.number} ts ${block.timestamp} + ${config.timeLockSec} (wall ${t0})`);

  // ---- V6-b: same wallet, someone else's account
  await v6Negative(player, policyAttached);

  // ---- LaneB-1: approve too early
  try {
    await approve(player, BigInt(w1.txId), 'owner', 'kt-approve-early');
    record('LaneB-1', 'FAIL', `approve before releaseTime succeeded on txId ${w1.txId} — the clock is not enforced`);
  } catch (e) {
    const code = (e as { code?: string }).code;
    record(
      'LaneB-1',
      code === 'BeforeReleaseTime' ? 'PASS' : 'PARTIAL',
      code === 'BeforeReleaseTime'
        ? `approve before releaseTime reverted BeforeReleaseTime on chain (txId ${w1.txId}, releaseTime ${rec1.releaseTime}, wall ${now()}) — the clock is enforced by the contract, not the UI`
        : `early approve refused but the error did not decode as BeforeReleaseTime (${code}): ${(e as Error).message.slice(0, 180)}`,
    );
  }

  // ---- LaneB-2: cancel while pending
  const payeeBefore = await balanceOf(PAYEE);
  const c = await cancel(player, BigInt(w1.txId), 'owner', 'kt-cancel');
  const afterCancel = await readWire(account, BigInt(w1.txId));
  record('LaneB-2', afterCancel.status === 'CANCELLED' && (await balanceOf(PAYEE)) === payeeBefore ? 'PASS' : 'FAIL', `cancel ${c.hash} → txId ${w1.txId} ${afterCancel.status}; payee balance unchanged`);

  // ---- LaneB-3: wire, wait for the clock, approve
  const w2 = await wire(player, PAYEE, '250', 'kt-wire-2');
  const release = Number(w2.releaseTime);
  console.log(`txId ${w2.txId} PENDING, releaseTime ${release}; waiting ${Math.max(0, release - now())}s (no evm_increaseTime on Remote EVM)…`);
  while (now() < release + 1) await sleep(1000);
  const payeeMid = await balanceOf(PAYEE);
  const a = await approve(player, BigInt(w2.txId), 'owner', 'kt-approve');
  const moved = (await balanceOf(PAYEE)) - payeeMid;
  const pendingNow = (await listPending(account)).map((x) => x.txId);
  record(
    'LaneB-3',
    a.status === 'COMPLETED' && moved === parseUnits('250', token.decimals) ? 'PASS' : 'FAIL',
    `approve ${a.hash} → txId ${w2.txId} ${a.status}; payee +${formatUnits(moved, token.decimals)} ${token.symbol}; account ${a.balanceAfter} ${token.symbol}; pending now [${pendingNow.join(',')}]`,
  );

  // ---- LaneB-4: manager path. U2 expected the Branch Manager's timed stamp after the clock; U4+ (ROLE_SET 3) removed
  //      it — Walker is not a second Bob. The manager must be refused before AND after releaseTime (NoPermission), and
  //      the wire is then recalled by the manager (his shredder still works) so the rig account keeps its balance.
  if (!managerAddress) {
    record('LaneB-4', 'SKIP', 'MANAGER_PK not set — manager path not exercised');
  } else {
    const w3 = await wire(player, PAYEE, '150', 'kt-wire-3');
    const rel3 = Number(w3.releaseTime);
    let earlyCode = '';
    try {
      await approve(player, BigInt(w3.txId), 'manager', 'kt-manager-early');
      record('LaneB-4', 'FAIL', 'manager approved before releaseTime');
    } catch (e) {
      earlyCode = (e as { code?: string }).code ?? explainRevert(e).code;
      console.log(`manager early approve refused (${earlyCode}); waiting ${Math.max(0, rel3 - now())}s for txId ${w3.txId}…`);
      while (now() < rel3 + 1) await sleep(1000);
      let lateCode = '';
      try {
        await approve(player, BigInt(w3.txId), 'manager', 'kt-manager-late');
        record('LaneB-4', 'FAIL', `BRANCH_MANAGER stamped txId ${w3.txId} after the clock — the U4+ removal of the timed stamp did not land`);
      } catch (e2) {
        lateCode = (e2 as { code?: string }).code ?? explainRevert(e2).code;
        const c = await cancel(player, BigInt(w3.txId), 'manager', 'kt-manager-recall');
        record(
          'LaneB-4',
          earlyCode === 'NoPermission' && lateCode === 'NoPermission' && c.status === 'CANCELLED' ? 'PASS' : 'PARTIAL',
          `U4+: BRANCH_MANAGER ${managerAddress} refused before (${earlyCode}) and after (${lateCode}) releaseTime — no timed stamp; manager recall of txId ${w3.txId} → ${c.status} (${c.hash})`,
        );
      }
    }
  }
  finish();
}

function finish() {
  console.log('\n─── U2 kill tests ───');
  for (const r of results) console.log(`${r.id.padEnd(8)} ${r.verdict.padEnd(7)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
