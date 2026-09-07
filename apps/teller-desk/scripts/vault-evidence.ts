/**
 * Evidence printer for a human walk (U4, G5). Reads the chain only — nothing is signed or sent.
 *
 *   npm -w apps/teller-desk run evidence                    # every account in .data/players.json
 *   npm -w apps/teller-desk run evidence -- 0x9C01…         # one account
 *
 * For each account: every transaction on the chain that touched it (block, timestamp, hash, sender, decoded
 * function), then every time-locked record (`getTransactionHistory` + `getTransaction`) with its status and
 * `releaseTime`. Paste the output into the progress note: it is the txIds / hashes the G5 walk must record.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatUnits, getAddress, toFunctionSelector, type AbiFunction, type Address, type Hex } from 'viem';
import { GuardController } from '@bloxchain/sdk';
import { broadcaster, chain, publicClient } from '../src/chain.ts';
import { REPO_ROOT, deployments } from '../src/config.ts';
import { readWire } from '../src/lanes/laneB.ts';

const ABI_DIR = path.join(REPO_ROOT, 'node_modules', '@bloxchain', 'sdk', 'abi');
const selectors = new Map<string, string>();
for (const f of fs.readdirSync(ABI_DIR)) {
  const raw = JSON.parse(fs.readFileSync(path.join(ABI_DIR, f), 'utf8')) as unknown;
  const abi = (Array.isArray(raw) ? raw : (raw as { abi: unknown[] }).abi) as AbiFunction[];
  for (const item of abi) if (item.type === 'function') selectors.set(toFunctionSelector(item).toLowerCase(), item.name);
}
selectors.set(toFunctionSelector('transfer(address,uint256)').toLowerCase(), 'transfer');
selectors.set(toFunctionSelector('mint(address,uint256)').toLowerCase(), 'mint');

const players = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'apps', 'teller-desk', '.data', 'players.json'), 'utf8')) as Array<{ ownerAddress: string; account?: string }>;
  } catch {
    return [];
  }
})();
const wanted = process.argv.slice(2).filter((a) => a.startsWith('0x')).map((a) => getAddress(a));
const targets = wanted.length ? wanted.map((a) => ({ account: a, owner: players.find((p) => p.account?.toLowerCase() === a.toLowerCase())?.ownerAddress })) : players.filter((p) => p.account).map((p) => ({ account: getAddress(p.account!), owner: p.ownerAddress }));

const who = (a: string | null | undefined) => {
  if (!a) return 'create';
  const d = deployments();
  const l = a.toLowerCase();
  if (l === broadcaster.account!.address.toLowerCase()) return 'broadcaster';
  if (l === d.copyBlox.toLowerCase()) return 'CopyBlox';
  if (l === d.token.address.toLowerCase()) return 'dUSDC';
  for (const p of players) {
    if (p.ownerAddress.toLowerCase() === l) return `owner ${a.slice(0, 8)}`;
    if (p.account?.toLowerCase() === l) return `account ${a.slice(0, 8)}`;
  }
  return a.slice(0, 10);
};
const iso = (ts: bigint | number) => new Date(Number(ts) * 1000).toISOString().replace('T', ' ').slice(0, 19);

const latest = await publicClient.getBlockNumber();
console.log(`chain ${chain.id} · latest block ${latest} · ${targets.length} account(s)\n`);

for (const t of targets) {
  const acc = t.account.toLowerCase();
  const own = t.owner?.toLowerCase();
  console.log(`=== account ${t.account}${t.owner ? ` (owner ${t.owner})` : ''}`);
  console.log(`--- transactions touching it (block · time UTC · hash · from → to · function)`);
  for (let n = 1n; n <= latest; n++) {
    const b = await publicClient.getBlock({ blockNumber: n, includeTransactions: true });
    for (const tx of b.transactions) {
      const from = tx.from.toLowerCase();
      const to = tx.to?.toLowerCase();
      const touches = to === acc || from === acc || (own && (from === own || to === own)) || (tx.input.toLowerCase().includes(acc.slice(2)) && to !== undefined);
      if (!touches) continue;
      const fn = tx.input === '0x' ? (tx.value > 0n ? `ETH ${formatUnits(tx.value, 18)}` : 'empty') : selectors.get(tx.input.slice(0, 10).toLowerCase()) ?? tx.input.slice(0, 10);
      const rc = await publicClient.getTransactionReceipt({ hash: tx.hash });
      console.log(`${String(n).padStart(4)} · ${iso(b.timestamp)} · ${tx.hash} · ${who(tx.from)} → ${who(tx.to)} · ${fn} · ${rc.status} · gas ${rc.gasUsed}`);
    }
  }
  console.log(`--- time-locked records (txId · status · releaseTime · payee · amount)`);
  const gc = new GuardController(publicClient, broadcaster, t.account, chain);
  let ids: bigint[] = [];
  try {
    const hist = (await gc.getTransactionHistory(1n, 50n)) as unknown as Array<{ txId: bigint | number }>;
    ids = hist.map((r) => BigInt(r.txId)).filter((x) => x > 0n);
  } catch (e) {
    console.log(`(getTransactionHistory: ${(e as Error).message.slice(0, 120)}) — probing ids 1..20`);
    ids = Array.from({ length: 20 }, (_, i) => BigInt(i + 1));
  }
  for (const id of ids) {
    try {
      const w = await readWire(t.account, id);
      if (w.status === 'UNDEFINED') continue;
      console.log(`#${w.txId} · ${w.status} · ${w.releaseTime} (${iso(BigInt(w.releaseTime))}) · ${w.to ?? '?'} · ${w.amount ?? '?'}`);
    } catch {
      /* no such record */
    }
  }
  const bal = (await publicClient.readContract({ address: deployments().token.address as Address, abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }], functionName: 'balanceOf', args: [t.account] })) as bigint;
  console.log(`balance ${formatUnits(bal, deployments().token.decimals)} ${deployments().token.symbol}\n`);
}
