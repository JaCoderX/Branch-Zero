/**
 * Live Main-wing practice-faucet smoke against Remote EVM 1337.
 *
 *   npm -w apps/teller-desk run smoke:faucet
 *
 * Reuses the U1 kill-test Privy rig (no browser). Spends a little via Lane A if the account
 * is already full, then asserts `/faucet` semantics: delta restore, already-full no-op, fundAccount
 * still zero-only after a deliberate underfund (re-check path is not exercised here — MockChain covers it).
 */
import { erc20Abi, formatUnits, parseUnits, type Address } from 'viem';
import { publicClient } from '../src/chain.ts';
import { config, deployments } from '../src/config.ts';
import { embeddedWalletOf, privy } from '../src/privy.ts';
import { pay } from '../src/lanes/laneA.ts';
import { faucetAccount, provision } from '../src/lanes/provision.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
/** Same whitelisted demo payee the U1 kill tests use (Ganache acct5). */
const PAYEE = '0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC' as Address;

async function rigPlayer(): Promise<Player> {
  const existing = await privy.users().getByEmailAddress({ address: RIG_EMAIL }).catch(() => undefined);
  if (!existing) throw new Error(`no Privy rig user for ${RIG_EMAIL} — run npm run killtests once first`);
  const w = embeddedWalletOf(existing);
  const stored = getPlayer(existing.id);
  return upsertPlayer({
    privyUserId: existing.id,
    ownerAddress: w.ownerAddress,
    walletId: w.walletId,
    signingMode: w.delegated ? 'session' : 'client',
    policyId: stored?.policyId ?? process.env.KILLTEST_POLICY_ID,
    policyRuleId: stored?.policyRuleId ?? process.env.KILLTEST_POLICY_RULE_ID,
    account: stored?.account,
    configured: stored?.configured,
    roleSet: stored?.roleSet,
  });
}

async function balanceOf(account: Address): Promise<bigint> {
  const { token } = deployments();
  return (await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })) as bigint;
}

async function main() {
  if (config.target !== 'remote') throw new Error(`expected Main wing; got target=${config.target}`);
  const { token } = deployments();
  const opening = parseUnits(config.openingBalance, token.decimals);
  let player = await rigPlayer();
  console.log(`rig ${player.privyUserId} owner ${player.ownerAddress}`);

  if (!player.account || !player.configured) {
    console.log('provisioning…');
    const jobId = `faucet-smoke-${Date.now().toString(36)}`;
    await provision(player, jobId);
    player = getPlayer(player.privyUserId)!;
  }
  const account = player.account as Address;
  console.log(`account ${account}`);

  let bal = await balanceOf(account);
  console.log(`balance before spend: ${formatUnits(bal, token.decimals)} ${token.symbol}`);
  if (bal >= opening) {
    const spend = '12.5';
    console.log(`spending ${spend} ${token.symbol} via Lane A so the faucet has a delta…`);
    await pay(player, PAYEE, spend, `faucet-smoke-${Date.now().toString(36)}`);
    bal = await balanceOf(account);
    console.log(`balance after spend: ${formatUnits(bal, token.decimals)} ${token.symbol}`);
  }
  if (bal >= opening) throw new Error('could not spend below opening balance — abort');

  const top = await faucetAccount(account);
  const after = await balanceOf(account);
  if (!top.toppedUp || !top.hash || after < opening) {
    throw new Error(`faucet restore failed: ${JSON.stringify(top)}; on-chain ${formatUnits(after, token.decimals)}`);
  }
  console.log(`✓ restore: toppedUp amount=${top.amount} hash=${top.hash} balance=${top.balance}`);

  const noop = await faucetAccount(account);
  if (noop.toppedUp || noop.hash) {
    throw new Error(`already-full should be a no-op: ${JSON.stringify(noop)}`);
  }
  console.log(`✓ already-full no-op: balance=${noop.balance}`);

  const treasury = await balanceOf(deployerAddress);
  console.log(`treasury left: ${formatUnits(treasury, token.decimals)} ${token.symbol}`);
  console.log('PASS — live Main-wing practice faucet');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
