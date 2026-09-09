/**
 * Lane B Live rig — drive the product `approve()` (the exact code `POST /approve` runs: fund → sign via the Privy session
 * signer → broadcast → wait → re-read the record) for one PENDING wire, printing every stage event the game would see.
 * Optionally file a fresh wire first and wait out its clock, to prove the clean path after a repair.
 *
 *   npm -w apps/teller-desk run release:wire -- 0xD70B… 14
 *   npm -w apps/teller-desk run release:wire -- 0xD70B… --fresh 1        # file 1 dUSDC to the rig payee, wait, release
 *
 * Same posture as the kill-test rigs: the player index and the session signer are the product's; no key is held here.
 */
import { formatUnits, getAddress, type Address } from 'viem';
import { erc20Abi } from '@branch-zero/shared';
import { chain, publicClient } from '../src/chain.ts';
import { config, deployments } from '../src/config.ts';
import { approve, listPending, readWire, wire } from '../src/lanes/laneB.ts';
import { getPlayer, newJobId, subscribe } from '../src/store.ts';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/config.ts';

const argv = process.argv.slice(2);
const account = getAddress(argv.find((a) => a.startsWith('0x')) ?? '0xD70B3b804A5E1C40122e4617A8C39474A07509eD') as Address;
const freshIdx = argv.indexOf('--fresh');
const freshAmount = freshIdx >= 0 ? (argv[freshIdx + 1] ?? '1') : undefined;
const txArg = argv.find((a, i) => /^\d+$/.test(a) && argv[i - 1] !== '--fresh');
const PAYEE = getAddress('0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC') as Address; // the rig payee every kill test pays; holds no role

const file = path.join(REPO_ROOT, 'apps', 'teller-desk', '.data', `players${config.chainId === 1337 ? '' : `-${config.chainId}`}.json`);
const players = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ privyUserId: string; account?: string }>;
const id = players.find((x) => String(x.account ?? '').toLowerCase() === account.toLowerCase())?.privyUserId;
const player = id ? getPlayer(id) : undefined;
if (!player) throw new Error(`no player for ${account} in ${path.basename(file)}`);

const redact = (s: string) => s.replace(/https?:\/\/[^\s"')]+/g, '<rpc>');
const { token } = deployments();
const balance = async () => formatUnits((await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })) as bigint, token.decimals);
const unsubscribe = subscribe(player.privyUserId, (e) => {
  const extra = { ...e } as Record<string, unknown>;
  for (const k of ['type', 'lane', 'jobId', 'serverNow']) delete extra[k];
  console.log(`  ▸ [${e.jobId}] ${e.stage.padEnd(12)} ${redact(JSON.stringify(extra))}`);
});

console.log(`chain ${chain.id} · account ${account} · owner ${player.ownerAddress} · rules ${JSON.stringify(player.txRuleIds)} pinned=${player.txPolicyPinned}`);
console.log(`balance before: ${await balance()} ${token.symbol} · pending ${JSON.stringify((await listPending(account)).map((w) => `#${w.txId}`))}`);

let txId: bigint;
if (freshAmount !== undefined) {
  console.log(`\n=== wire ${freshAmount} ${token.symbol} → ${PAYEE}`);
  const w = await wire(player, PAYEE, freshAmount, newJobId());
  txId = BigInt(w.txId);
  const wait = Number(w.releaseTime) - Math.floor(Date.now() / 1000) + 3;
  console.log(`  filed #${w.txId} (${w.hash}); releaseTime ${w.releaseTime}; waiting ${wait}s for the clock`);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait * 1000));
} else {
  if (!txArg) throw new Error('give a txId or --fresh <amount>');
  txId = BigInt(txArg);
}

const before = await readWire(account, txId);
console.log(`\n=== approve #${txId} (${before.status}, releaseTime ${before.releaseTime}, released=${before.released}, ${before.amount} → ${before.to})`);
try {
  const r = await approve(player, txId, 'owner', newJobId());
  console.log(`\nRELEASED #${r.txId}: ${r.status} · hash ${r.hash} · fee ${r.fee} · balance after ${r.balanceAfter} ${token.symbol}`);
  console.log(`explorer: https://sepolia.etherscan.io/tx/${r.hash}`);
} catch (e) {
  const err = e as Error & { code?: string; statusCode?: number };
  console.log(`\nFAILED ${err.code ?? ''} (${err.statusCode ?? ''}): ${redact(err.message).slice(0, 600)}`);
  process.exitCode = 1;
}
console.log(`pending now ${JSON.stringify((await listPending(account)).map((w) => `#${w.txId}`))} · rules now ${JSON.stringify(getPlayer(player.privyUserId)?.txRuleIds)}`);
unsubscribe();
process.exit();
