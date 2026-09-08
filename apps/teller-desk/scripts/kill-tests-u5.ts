/**
 * U5 kill test — ENSv2 Name Desk (G6).
 *
 * This deliberately stays outside MockChain. It claims a fresh customer label on ENSv2 Sepolia through the
 * product `ensMint` path, resolves it through the pinned Universal Resolver, then gives that address to the
 * existing Lane A `pay` path on whichever wing the desk is pinned to — ENS is a Sepolia side-module in both
 * Live and Developer Mode, and only answers "which address". The second claim must be refused as NAME_TAKEN.
 *
 *   npm -w apps/teller-desk run killtests:u5
 *   npm -w apps/teller-desk run killtests:u5 -- --fresh
 *
 * `ENS_REGISTRAR_PK` is an env-only Sepolia throwaway key. The ENS module checks that its derived address is the
 * pinned registrar in infra/deployments/sepolia.json; no Remote EVM Ganache-parity key can pass that check.
 */
import { createPublicClient, getAddress, http, type Address, type Hex } from 'viem';
import { sepolia } from '@branch-zero/shared';
import { chain, publicClient } from '../src/chain.ts';
import { config } from '../src/config.ts';
import { available as ensAvailable, mint as ensMint, resolve as ensResolve } from '../src/ens.ts';
import { pay } from '../src/lanes/laneA.ts';
import { ensureTypedDataPolicy, ensureTxPolicy, provision, recoverAccount } from '../src/lanes/provision.ts';
import { createPlayerPolicy, embeddedWalletOf, privy, recoverPolicy } from '../src/privy.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const FRESH = process.argv.includes('--fresh');
const results: Array<{ id: string; verdict: 'PASS' | 'FAIL' | 'PARTIAL'; note: string }> = [];

function record(id: string, verdict: 'PASS' | 'FAIL' | 'PARTIAL', note: string): void {
  results.push({ id, verdict, note });
  const mark = verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : '✗';
  console.log(`\n${mark} ${id} ${verdict} — ${note}\n`);
}

function errorCode(e: unknown): string {
  return String((e as { code?: string }).code ?? 'UNKNOWN');
}

async function rigPlayer(): Promise<Player> {
  const email = FRESH ? RIG_EMAIL.replace('@', `+${Date.now().toString(36)}@`) : RIG_EMAIL;
  const existing = await privy.users().getByEmailAddress({ address: email }).catch(() => undefined);
  if (existing) {
    const w = embeddedWalletOf(existing);
    const stored = getPlayer(existing.id);
    const recovered = stored?.policyId ? undefined : await recoverPolicy(w.walletId).catch(() => undefined);
    console.log(`reusing Privy user ${existing.id} · wallet ${w.walletId} → ${w.ownerAddress}`);
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
      ensName: stored?.ensName,
    });
  }
  const policy = await createPlayerPolicy(chain.id, `rig-${Date.now().toString(36)}`);
  const user = await privy.users().create({
    linked_accounts: [{ type: 'email', address: email }],
    wallets: [{ chain_type: 'ethereum', additional_signers: [{ signer_id: config.privy.signerId, override_policy_ids: [policy.policyId] }] }],
  });
  const wallet = embeddedWalletOf(user);
  console.log(`created Privy user ${user.id} · wallet ${wallet.walletId} → ${wallet.ownerAddress}`);
  return upsertPlayer({
    privyUserId: user.id,
    ownerAddress: wallet.ownerAddress,
    walletId: wallet.walletId,
    signingMode: 'session',
    policyId: policy.policyId,
    policyRuleId: policy.ruleId,
  });
}

async function main(): Promise<void> {
  if (!config.sepoliaRpcUrl || !config.ensRegistrarPk) {
    record('G6-config', 'FAIL', 'SEPOLIA_RPC_URL and env-only ENS_REGISTRAR_PK are required; no ENS transaction was attempted');
    return finish();
  }

  console.log(`ENS chain ${sepolia.id} · payment chain ${chain.id} · pinned resolver is read by the product module`);
  let player = await rigPlayer();
  const provisioned = await provision(player, 'kt-u5-provision');
  player = getPlayer(player.privyUserId)!;
  player = await ensureTxPolicy(player, provisioned.account);
  player = await ensureTypedDataPolicy(player);
  const account = player.account ?? provisioned.account;
  const label = `u5-${Date.now().toString(36)}`;
  const name = `${label}.branchzero.eth`;

  const before = await ensAvailable(label);
  record('G6-available', before.available === true ? 'PASS' : 'FAIL', `${name} availability read on Sepolia: ${String(before.available)}`);
  if (before.available !== true) return finish();

  let claim;
  try {
    claim = await ensMint(player, label, 'kt-u5-claim');
    const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpcUrl) });
    const mined = await Promise.all(claim.txHashes.map((hash) => sepoliaClient.getTransactionReceipt({ hash })));
    const allMined = mined.every((receipt) => receipt.status === 'success');
    record('G6-mint', allMined && claim.address.toLowerCase() === account.toLowerCase() ? 'PASS' : 'FAIL', `${claim.name} → AccountBlox ${claim.address}; register/setAddr/setText txs ${claim.txHashes.join(', ')}`);
  } catch (e) {
    record('G6-mint', 'FAIL', `${errorCode(e)}: ${(e as Error).message.slice(0, 220)}`);
    return finish();
  }

  const resolved = await ensResolve(name);
  record('G6-resolve', resolved.chainId === sepolia.id && resolved.address.toLowerCase() === account.toLowerCase() ? 'PASS' : 'FAIL', `${resolved.name} resolves on Sepolia to ${resolved.address}${resolved.tier ? ` (${resolved.tier})` : ''}`);

  try {
    const paid = await pay(player, getAddress(resolved.address) as Address, '1', 'kt-u5-pay-by-name');
    const receipt = await publicClient.getTransactionReceipt({ hash: paid.hash });
    const ok = receipt.status === 'success' && paid.to.toLowerCase() === resolved.address.toLowerCase();
    record('G6-pay-by-name', ok ? 'PASS' : 'FAIL', `resolved address was handed to Lane A on ${chain.name} ${chain.id}: ${paid.hash} → ${paid.to}`);
  } catch (e) {
    record('G6-pay-by-name', 'FAIL', `${errorCode(e)}: ${(e as Error).message.slice(0, 220)}`);
  }

  try {
    await ensMint(player, label, 'kt-u5-taken');
    record('G6-taken', 'FAIL', `${name} was claimable twice`);
  } catch (e) {
    record('G6-taken', errorCode(e) === 'NAME_TAKEN' ? 'PASS' : 'FAIL', `second claim refused with ${errorCode(e)}: ${(e as Error).message.slice(0, 180)}`);
  }
  return finish();
}

function finish(): void {
  console.log('\nU5 kill-test summary');
  for (const result of results) console.log(`${result.id.padEnd(18)} ${result.verdict.padEnd(8)} ${result.note}`);
  process.exitCode = results.some((result) => result.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(`U5 kill test aborted: ${errorCode(e)}: ${(e as Error).message}`);
  process.exitCode = 1;
});
