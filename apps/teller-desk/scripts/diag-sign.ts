/**
 * Lane B Live diagnostic — sign (never broadcast) approveTimeLockExecution(txId) through the desk's own Privy path,
 * and print the unwrapped error chain both raw and as the SDK wraps it. No secrets: RPC URLs are redacted.
 *   npm -w apps/teller-desk run diag:sign -- 0xD70B… 14
 */
import fs from 'node:fs';
import path from 'node:path';
import { encodeFunctionData, getAddress, parseAbi, parseGwei, type Address, type Hex } from 'viem';
import { GuardController } from '@bloxchain/sdk';
import { chain, publicClient } from '../src/chain.ts';
import { REPO_ROOT, config } from '../src/config.ts';
import { ownerWalletClient } from '../src/signing/privySigner.ts';
import { explainRevert } from '../src/lanes/laneB.ts';

const account = getAddress(process.argv[2] ?? '0xD70B3b804A5E1C40122e4617A8C39474A07509eD') as Address;
const txId = BigInt(process.argv[3] ?? '14');
const file = path.join(REPO_ROOT, 'apps', 'teller-desk', '.data', `players${config.chainId === 1337 ? '' : `-${config.chainId}`}.json`);
const players = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ account?: string; ownerAddress: Address; walletId: string }>;
const p = players.find((x) => String(x.account ?? '').toLowerCase() === account.toLowerCase());
if (!p) throw new Error(`no player for ${account}`);

const redact = (s: string) => s.replace(/https?:\/\/[^\s"')]+/g, '<rpc>').replace(/(authorization_private_keys|app_secret)"?:\s*\[?"[^"]+"/gi, '$1:"<redacted>"');
function dumpChain(e: unknown) {
  let depth = 0;
  const seen = new Set<unknown>();
  for (let cur = e as Record<string, unknown> | undefined; cur && typeof cur === 'object' && !seen.has(cur) && depth < 8; cur = (cur.cause ?? cur.originalError) as never, depth++) {
    seen.add(cur);
    const keys = Object.keys(cur).filter((k) => !['cause', 'originalError', 'abi', 'stack', 'docsPath', 'metaMessages', 'version'].includes(k));
    const view: Record<string, unknown> = { ctor: (cur as { constructor?: { name?: string } }).constructor?.name, name: cur.name, code: cur.code, status: cur.status, statusCode: cur.statusCode };
    for (const k of keys) {
      const v = cur[k];
      if (v === undefined || typeof v === 'function') continue;
      try {
        const s = typeof v === 'string' ? v : JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));
        view[k] = s && s.length > 400 ? s.slice(0, 400) + '…' : s;
      } catch {
        view[k] = String(v);
      }
    }
    console.log(`  [${depth}] ${redact(JSON.stringify(view, null, 1))}`);
  }
}

const wc = ownerWalletClient(chain, { owner: p.ownerAddress, walletId: p.walletId, account });
const data = encodeFunctionData({ abi: parseAbi(['function approveTimeLockExecution(uint256 txId) returns (uint256)']), functionName: 'approveTimeLockExecution', args: [txId] });

console.log(`\n=== A. prepareTransactionRequest (owner ${p.ownerAddress} → ${account})`);
let prepared: Awaited<ReturnType<typeof wc.prepareTransactionRequest>> | undefined;
try {
  prepared = await wc.prepareTransactionRequest({ account: wc.account!, chain, to: account, data, gas: 350_000n, maxFeePerGas: parseGwei('3'), maxPriorityFeePerGas: parseGwei('1') });
  console.log(`  ok nonce=${prepared.nonce} gas=${prepared.gas} maxFee=${prepared.maxFeePerGas} type=${prepared.type}`);
} catch (e) {
  console.log('  FAILED at prepare:');
  dumpChain(e);
}

console.log(`\n=== B. Privy eth_signTransaction (sign only, nothing broadcast)`);
let signed: Hex | undefined;
if (prepared) {
  try {
    signed = await wc.account!.signTransaction!(prepared as never);
    console.log(`  ok signed ${signed.length / 2 - 1} bytes (NOT broadcast)`);
  } catch (e) {
    console.log('  FAILED at Privy sign:');
    dumpChain(e);
  }
}

console.log(`\n=== C. Same through the SDK (GuardController.approveTimeLockExecution, simulationMode skip)`);
const gc = new GuardController(publicClient, wc, account, chain);
// Guard against actually sending if B succeeded: only run C when B failed, so the diag never broadcasts.
if (signed) {
  console.log('  skipped — signing works; the desk path should broadcast. Run the desk Release instead.');
} else {
  try {
    const res = await gc.approveTimeLockExecution(txId, { from: p.ownerAddress, simulationMode: 'skip', gas: 350_000n, gasPrice: parseGwei('3').toString() });
    console.log(`  UNEXPECTED: sent ${res.hash}`);
  } catch (e) {
    console.log('  FAILED (as the desk sees it):');
    dumpChain(e);
    const why = explainRevert(e);
    console.log(`  explainRevert → code=${why.code} bankLine="${why.bankLine}" message="${redact(why.message).slice(0, 200)}"`);
  }
}
