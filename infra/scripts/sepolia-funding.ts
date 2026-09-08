/**
 * Sepolia funding checklist — read-only (docs/SEPOLIA-LIVE.md §4).
 *
 * Lists every address the Live wing needs on Sepolia, what it pays for, what it holds now, and what is
 * still owed before a Live pass can be attempted. Sends nothing and signs nothing: it derives addresses
 * from the keys already in `.env`, reads balances, and prints the faucet steps for whatever is short.
 *
 *   npm -w infra run funding:sepolia
 *
 * Two rules it enforces rather than merely documents:
 *   1. A Ganache-parity (Remote EVM lab) key in a `SEPOLIA_*` slot is a hard FAIL, never a warning —
 *      those keys are public knowledge and would be swept (docs/SECURITY-AND-KEYS.md §1).
 *   2. The gas floors come from measured costs, not optimism: `CopyBlox.cloneBlox` is ~16.2 M gas
 *      (docs/REMOTE-EVM.md §1) and the S1b FX config batches were ~5 M combined, so a deployer that is
 *      about to open accounts needs materially more than a broadcaster that only forwards meta-txs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatEther, formatUnits, getAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { isGanacheParityAddress } from '@branch-zero/shared';
import { connect } from './lib/chain.ts';
import { DEPLOYMENTS_DIR, loadEnv } from './lib/env.ts';

loadEnv();

const ETH_FAUCET = 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia';
const USDC_FAUCET = 'https://faucet.circle.com/';

interface Role {
  role: string;
  /** Env key holding a private key (address derived) … */
  pk?: string;
  /** … or an env key that already holds a public address. */
  addressEnv?: string;
  /** Minimum ETH this role needs before a Live pass is honest. */
  floorEth: number;
  pays: string;
  /** A role only needed for bootstrap or an optional desk, not every pass. */
  optional?: boolean;
}

/**
 * Live Main + ENS + FX. Where SEPOLIA-LIVE §4.3 allows one key to serve two roles (FX broadcaster ==
 * Live broadcaster when the desks unify), the same env key appears twice and the report collapses it to
 * one funded EOA — the floor taken is the larger of the two.
 */
const ROLES: Role[] = [
  { role: 'Live Main deployer', pk: 'SEPOLIA_DEPLOYER_PK', floorEth: 0.05, pays: 'CopyBlox deploy + cloneBlox (~16.2M gas/account), practice-USDC mint, OWNER_GAS top-ups' },
  { role: 'Live Main broadcaster', pk: 'SEPOLIA_BROADCASTER_PK', floorEth: 0.02, pays: 'every Lane A / config meta-tx gas' },
  { role: 'Live Main manager', pk: 'SEPOLIA_MANAGER_PK', floorEth: 0.01, pays: 'Priority submit / recall', optional: true },
  { role: 'ENS registrar', pk: 'ENS_REGISTRAR_PK', floorEth: 0.01, pays: 'claim / setAddr / setText under branchzero.eth' },
  { role: 'FX broadcaster', pk: 'SEPOLIA_BROADCASTER_PK', floorEth: 0.01, pays: 'enableFx guard+role batches (~5M gas) and swaps' },
  { role: 'Recovery (address only)', addressEnv: 'SEPOLIA_RECOVERY_ADDRESS', floorEth: 0, pays: 'nothing — cold; must NOT be hot-funded on the demo host' },
];

const BALANCE_OF = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }] as const;

function keyAddress(pk: string): Address {
  const hex = (pk.startsWith('0x') ? pk : `0x${pk}`) as Hex;
  return privateKeyToAccount(hex).address;
}

async function main() {
  const { chain, publicClient, clientVersion } = await connect('sepolia');
  const head = await publicClient.getBlock();
  console.log(`Sepolia funding checklist — chain ${chain.id} · ${clientVersion} · head #${head.number}`);
  console.log(`block gasLimit ${head.gasLimit.toLocaleString()} · baseFee ${head.baseFeePerGas ? `${(Number(head.baseFeePerGas) / 1e9).toFixed(3)} gwei` : 'n/a'}`);
  console.log('');

  // Collapse roles that share a key into one funded EOA, keeping the larger floor and both purposes.
  const byAddress = new Map<string, { address: Address; roles: string[]; pays: string[]; floorEth: number; source: string; optional: boolean }>();
  const missing: Role[] = [];
  const refused: string[] = [];

  for (const r of ROLES) {
    let address: Address | undefined;
    let source = '';
    if (r.pk) {
      const raw = process.env[r.pk];
      if (!raw) {
        missing.push(r);
        continue;
      }
      address = keyAddress(raw);
      source = r.pk;
      if (isGanacheParityAddress(address)) {
        refused.push(`${r.role}: ${r.pk} holds Ganache-parity key ${address} — a Remote EVM lab key in a Sepolia slot`);
        continue;
      }
    } else if (r.addressEnv) {
      const raw = process.env[r.addressEnv];
      if (!raw) {
        missing.push(r);
        continue;
      }
      address = getAddress(raw);
      source = r.addressEnv;
    }
    if (!address) continue;
    const prev = byAddress.get(address.toLowerCase());
    if (prev) {
      prev.roles.push(r.role);
      prev.pays.push(r.pays);
      prev.floorEth = Math.max(prev.floorEth, r.floorEth);
      prev.optional = prev.optional && Boolean(r.optional);
    } else {
      byAddress.set(address.toLowerCase(), { address, roles: [r.role], pays: [r.pays], floorEth: r.floorEth, source, optional: Boolean(r.optional) });
    }
  }

  if (refused.length) {
    console.log('REFUSED — lab keys must never sign on a public network (docs/SECURITY-AND-KEYS.md §1):');
    for (const line of refused) console.log(`  x ${line}`);
    console.log('');
  }

  // Practice dollars: the open-mint demo token in sepolia.json, NOT Circle's faucet USDC.
  const sep = JSON.parse(fs.readFileSync(path.join(DEPLOYMENTS_DIR, 'sepolia.json'), 'utf8')) as {
    tokens?: Record<string, { address: string; symbol?: string; decimals?: number }>;
    applications?: Record<string, { address?: string }>;
  };
  const practice = sep.tokens?.demoUsdc;

  const shortfalls: Array<{ label: string; address: Address; need: string }> = [];
  for (const entry of byAddress.values()) {
    const bal = await publicClient.getBalance({ address: entry.address });
    const eth = Number(formatEther(bal));
    const gap = entry.floorEth - eth;
    const ok = eth >= entry.floorEth;
    const label = `${entry.roles.join(' + ')}${entry.optional ? ' (optional)' : ''}`;
    if (!ok) shortfalls.push({ label, address: entry.address, need: `${gap.toFixed(4)} ETH short of ${entry.floorEth}` });
    console.log(`${ok ? 'OK ' : 'XX '} ${label}`);
    console.log(`      ${entry.address}   [${entry.source}]`);
    console.log(`      balance ${formatEther(bal)} ETH · floor ${entry.floorEth} ETH${ok ? '' : `   -> NEEDS ${gap.toFixed(4)} ETH`}`);
    for (const p of entry.pays) console.log(`      pays: ${p}`);
    if (practice?.address) {
      const held = (await publicClient.readContract({ address: getAddress(practice.address), abi: BALANCE_OF, functionName: 'balanceOf', args: [entry.address] }).catch(() => 0n)) as bigint;
      if (held > 0n) console.log(`      practice ${practice.symbol ?? 'USDC'}: ${formatUnits(held, practice.decimals ?? 6)}  (open-mint demo token ${practice.address})`);
    }
    console.log('');
  }

  if (missing.length) {
    console.log('NOT CONFIGURED — no env value, so nothing to fund yet:');
    for (const r of missing) console.log(`  . ${r.role} (${r.pk ?? r.addressEnv}) — ${r.pays}`);
    console.log('');
  }

  console.log('— payment deployment —');
  const copyBlox = sep.applications?.CopyBlox?.address;
  console.log(`  CopyBlox on Sepolia: ${copyBlox ?? 'MISSING — the Live wing cannot open accounts until it is deployed (chain:bootstrap --chain sepolia)'}`);
  console.log('');

  console.log('— practice dollars —');
  console.log(`  In-game USDC is the open-mint demo token ${practice?.address ?? '(missing from sepolia.json)'} (${practice?.decimals ?? '?'} decimals).`);
  console.log(`  Minted by the deployer at provision / Ines' faucet. Circle's ${USDC_FAUCET} USDC is a DIFFERENT token —`);
  console.log('  operator checks only, never the practice balance (docs/SEPOLIA-LIVE.md §4.2).');
  console.log('');

  if (shortfalls.length === 0 && refused.length === 0) {
    console.log('ALL FUNDED — every configured Sepolia role meets its floor. A Live pass may proceed.');
    return;
  }

  console.log('— what to do (docs/SEPOLIA-LIVE.md §4.4) —');
  let step = 1;
  for (const r of shortfalls) {
    console.log(`  ${step++}. ${ETH_FAUCET}`);
    console.log(`     paste ${r.address}  (${r.label})  -> request 0.05 ETH   [${r.need}]`);
  }
  console.log('  Google Cloud drops 0.05 ETH per day per eligibility: fund the deployer first, then the broadcaster.');
  console.log('  Do not soft-send undersized gas to get past a shortfall — cloneBlox needs ~16.2M gas of headroom.');
  process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
