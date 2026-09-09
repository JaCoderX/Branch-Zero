/**
 * Lane B Live diagnostic — read-only: policy rules on Privy, wire state on chain, owner gas. No signing, no send.
 *   npm -w apps/teller-desk run diag:release -- 0xD70B… 14
 */
import { formatEther, getAddress, type Address } from 'viem';
import { chain, publicClient } from '../src/chain.ts';
import { config } from '../src/config.ts';
import { privy } from '../src/privy.ts';
import { readWire, listPending } from '../src/lanes/laneB.ts';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/config.ts';

const account = getAddress(process.argv[2] ?? '0xD70B3b804A5E1C40122e4617A8C39474A07509eD') as Address;
const txId = BigInt(process.argv[3] ?? '14');
const file = path.join(REPO_ROOT, 'apps', 'teller-desk', '.data', `players${config.chainId === 1337 ? '' : `-${config.chainId}`}.json`);
const players = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<Record<string, unknown>>;
const p = players.find((x) => String(x.account ?? '').toLowerCase() === account.toLowerCase());
if (!p) throw new Error(`no player for ${account}`);
console.log(`chain ${chain.id} · account ${account} · owner ${p.ownerAddress} · walletId ${p.walletId}`);
console.log(`player policy ${p.policyId} · txRuleIds ${JSON.stringify(p.txRuleIds)} · mode ${p.txPolicyMode} · pinned ${p.txPolicyPinned}`);

const rec = await readWire(account, txId);
console.log(`wire #${txId}: ${JSON.stringify(rec)}`);
console.log(`pending: ${JSON.stringify((await listPending(account)).map((w) => w.txId))}`);
const ownerWei = await publicClient.getBalance({ address: p.ownerAddress as Address });
const block = await publicClient.getBlock();
console.log(`owner ETH ${formatEther(ownerWei)} · chainNow ${block.timestamp} · baseFee ${block.baseFeePerGas} · nonce ${await publicClient.getTransactionCount({ address: p.ownerAddress as Address })}`);

const wallet = (await privy.wallets().get(String(p.walletId))) as unknown as Record<string, unknown>;
console.log(`wallet policy_ids ${JSON.stringify(wallet.policy_ids)} · additional_signers ${JSON.stringify(wallet.additional_signers)}`);
const policy = (await privy.policies().get(String(p.policyId))) as unknown as { rules?: Array<Record<string, unknown>>; name?: string };
console.log(`policy "${policy.name}" has ${policy.rules?.length ?? 0} rule(s):`);
for (const r of policy.rules ?? []) console.log(JSON.stringify({ id: r.id, name: r.name, method: r.method, action: r.action, conditions: (r.conditions as Array<Record<string, unknown>>)?.map((c) => ({ ...c, abi: c.abi ? '[abi]' : undefined })) }));
