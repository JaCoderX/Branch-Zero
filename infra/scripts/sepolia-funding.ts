/**
 * Sepolia funding checklist — read-only (docs/SEPOLIA-LIVE.md §4, docs/SEPOLIA-TREASURY.md §5).
 *
 * Lists every address the Live wing needs on Sepolia, what it pays for, what it holds now, and what is
 * still owed before a Live pass can be attempted. Sends nothing and signs nothing: it derives addresses
 * from the keys already in `.env`, reads balances, and prints the faucet steps for whatever is short.
 *
 *   npm -w infra run funding:sepolia
 *
 * Since S3 the first section is the **ops treasury** (`SEPOLIA_TREASURY_PK`) — the single address faucet
 * drops should go to — followed by each staff role against its `need` and its `need × 1.25` target. The
 * need model is imported from `@branch-zero/shared`, the same table `treasury:topup` and the desk's
 * `/healthz` use, so this report can never disagree with what a top-up would actually send. It stays the
 * Privy-free path: infra needs no desk env to answer "who is short".
 *
 * Three rules it enforces rather than merely documents:
 *   1. A Ganache-parity (Remote EVM lab) key in a `SEPOLIA_*` slot is a hard FAIL, never a warning —
 *      those keys are public knowledge and would be swept (docs/SECURITY-AND-KEYS.md §1). That includes
 *      the treasury slot.
 *   2. The gas floors come from measured costs, not optimism: `CopyBlox.cloneBlox` is ~16.65 M gas
 *      (docs/SEPOLIA-LIVE.md §4.5) and the S1b FX config batches were ~5 M combined, so a deployer that is
 *      about to open accounts needs materially more than a broadcaster that only forwards meta-txs.
 *   3. Circle's faucet USDC and the in-game practice token are printed as separate columns, from separate
 *      pins, and a deployment file that put one under the other's name is a hard FAIL — the plan's "do not
 *      silently swap them" (docs/SEPOLIA-TREASURY.md §3).
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatEther, formatUnits, getAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  CIRCLE_USDC_DECIMALS,
  CIRCLE_USDC_SEPOLIA,
  ETH_FAUCET_URL,
  SEPOLIA_STAFF_NEEDS,
  TREASURY_MARGIN_LABEL,
  USDC_FAUCET_URL,
  capsFromEnv,
  fmtEth,
  isGanacheParityAddress,
  needWeiFor,
  planTopUps,
  targetWei,
  type StaffBalance,
} from '@branch-zero/shared';
import { connect } from './lib/chain.ts';
import { DEPLOYMENTS_DIR, loadEnv } from './lib/env.ts';

loadEnv();

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
  { role: 'Ops treasury', pk: 'SEPOLIA_TREASURY_PK', floorEth: 0, pays: 'nothing on chain — collects faucet ETH/USDC and tops staff wallets to need x 1.25' },
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

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
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
    tokens?: Record<string, { address: string; symbol?: string; decimals?: number; note?: string }>;
    applications?: Record<string, { address?: string }>;
  };
  const practice = sep.tokens?.demoUsdc;
  const circle = getAddress(CIRCLE_USDC_SEPOLIA);

  // The two USDCs are pinned in two places on purpose. If they ever agree, one pin is wrong and every
  // "USDC" number below would be ambiguous — so this is a hard stop, not a note.
  if (practice?.address && practice.address.toLowerCase() === (CIRCLE_USDC_SEPOLIA as string).toLowerCase()) {
    console.error(`FAIL — sepolia.json tokens.demoUsdc is Circle's USDC ${circle}. The practice token must be the open-mint demo token (docs/SEPOLIA-TREASURY.md §3).`);
    process.exitCode = 1;
    return;
  }
  const pinnedCircle = sep.tokens?.circleUsdc?.address;
  if (pinnedCircle && pinnedCircle.toLowerCase() !== (CIRCLE_USDC_SEPOLIA as string).toLowerCase()) {
    console.error(`FAIL — sepolia.json tokens.circleUsdc ${pinnedCircle} disagrees with the pinned Circle USDC ${circle}.`);
    process.exitCode = 1;
    return;
  }

  // ---- the ops treasury: the address every faucet drop should go to first ----
  const treasuryPk = process.env.SEPOLIA_TREASURY_PK;
  const treasuryAddress = treasuryPk && !isGanacheParityAddress(keyAddress(treasuryPk)) ? keyAddress(treasuryPk) : process.env.SEPOLIA_TREASURY_ADDRESS ? getAddress(process.env.SEPOLIA_TREASURY_ADDRESS) : undefined;

  console.log('— ops treasury (faucet destination) —');
  if (!treasuryAddress) {
    console.log('  NOT CONFIGURED — SEPOLIA_TREASURY_PK is unset, so faucet drops have to go to each staff address');
    console.log('  one at a time (0.05 ETH/day each). Set it to a Sepolia throwaway and the drops land in one place');
    console.log('  (docs/SEPOLIA-TREASURY.md §1). SEPOLIA_TREASURY_ADDRESS alone gives a read-only view.');
  } else {
    const [treasuryEth, treasuryCircle, treasuryPractice] = await Promise.all([
      publicClient.getBalance({ address: treasuryAddress }),
      publicClient.readContract({ address: circle, abi: BALANCE_OF, functionName: 'balanceOf', args: [treasuryAddress] }).catch(() => 0n) as Promise<bigint>,
      practice?.address
        ? (publicClient.readContract({ address: getAddress(practice.address), abi: BALANCE_OF, functionName: 'balanceOf', args: [treasuryAddress] }).catch(() => 0n) as Promise<bigint>)
        : Promise.resolve(0n),
    ]);
    console.log(`  ${treasuryAddress}   [${treasuryPk ? 'SEPOLIA_TREASURY_PK' : 'SEPOLIA_TREASURY_ADDRESS (read-only)'}]`);
    console.log(`     ETH          ${formatEther(treasuryEth)}`);
    console.log(`     Circle USDC  ${formatUnits(treasuryCircle, CIRCLE_USDC_DECIMALS)}   ${circle}   (held as ops float; never the in-game balance)`);
    console.log(`     practice     ${formatUnits(treasuryPractice, practice?.decimals ?? 6)}   ${practice?.address ?? '(missing)'}   (open-mint demo token)`);

    // Which staff roles share this key? Reusing one is a role collapse the plan forbids; the desk refuses it
    // unless SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=on, and either way it must be visible here.
    const shared = SEPOLIA_STAFF_NEEDS.filter((n) => {
      const raw = process.env[n.envPk];
      return raw ? keyAddress(raw).toLowerCase() === treasuryAddress.toLowerCase() : false;
    }).map((n) => n.role);
    if (shared.length) {
      const allowed = (process.env.SEPOLIA_TREASURY_ALLOW_ROLE_REUSE ?? 'off').toLowerCase() === 'on';
      console.log(`     !! ALSO the ${shared.join(' + ')} key — identity and float are the same wallet.`);
      console.log(`        ${allowed ? 'Accepted for this demo (SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=on): those roles are skipped by top-ups and their target is reserved.' : 'The desk and treasury:topup REFUSE this. Use a distinct throwaway, or set SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=on to accept it.'}`);
    }

    // ---- staff need vs target, from the shared model ----
    const staff: StaffBalance[] = [];
    const unconfigured: string[] = [];
    for (const need of SEPOLIA_STAFF_NEEDS) {
      const raw = process.env[need.envPk];
      if (!raw) {
        unconfigured.push(`${need.label} (${need.envPk})`);
        continue;
      }
      const address = keyAddress(raw);
      if (isGanacheParityAddress(address)) continue; // already refused above
      const needWei = needWeiFor(need, process.env);
      staff.push({ need, address, balanceWei: await publicClient.getBalance({ address }), needWei, targetWei: targetWei(needWei) });
    }

    const plan = planTopUps({
      treasury: treasuryAddress,
      treasuryBalanceWei: treasuryEth,
      staff,
      // Same caps the desk enforces, read from the same env with the same defaults. When a staff role
      // shares the treasury key, that role's own target is reserved so a top-up cannot starve it.
      caps: capsFromEnv(process.env, {
        extraReserveWei: SEPOLIA_STAFF_NEEDS.filter((n) => {
          const raw = process.env[n.envPk];
          return raw ? keyAddress(raw).toLowerCase() === treasuryAddress.toLowerCase() : false;
        }).reduce((acc, n) => acc + targetWei(needWeiFor(n, process.env)), 0n),
      }),
    });

    console.log('');
    console.log(`  staff wallets — refill below need, fill to need × ${TREASURY_MARGIN_LABEL}`);
    console.log(`     ${pad('role', 37)}${pad('balance', 13)}${pad('need', 11)}${pad('target', 11)}top-up`);
    for (const line of plan.lines) {
      const action =
        line.sendWei > 0n
          ? `send ${fmtEth(line.sendWei)}${line.clampedBy ? ` (clamped by ${line.clampedBy})` : ''}`
          : line.skip === 'funded'
            ? 'ok'
            : line.skip === 'is-treasury'
              ? 'skip — is the treasury'
              : `BLOCKED — needs ${fmtEth(line.deficitWei ?? 0n)} more in the treasury${line.clampedBy === 'per-tx cap' ? ' (also over the per-tx cap)' : ''}`;
      console.log(`     ${pad(line.label, 37)}${pad(fmtEth(line.balanceWei), 13)}${pad(fmtEth(line.needWei), 11)}${pad(fmtEth(line.targetWei), 11)}${action}`);
    }
    for (const u of unconfigured) console.log(`     ${pad(u, 37)}${pad('—', 13)}${pad('—', 11)}${pad('—', 11)}not configured`);
    if (plan.sends.length) {
      console.log(`  -> npm run treasury:topup                 (dry run: plans ${fmtEth(plan.totalWei)} ETH to ${plan.sends.length} wallet${plan.sends.length > 1 ? 's' : ''})`);
      console.log(`     npm run treasury:topup -- --execute    (sends it)`);
    } else if (plan.treasuryShort) {
      console.log(`  -> BLOCKER: treasury holds ${fmtEth(treasuryEth)} ETH, needs ${fmtEth(plan.requiredWei)} ETH to fill every target.`);
      console.log(`     A human fills it: ${ETH_FAUCET_URL} -> paste ${treasuryAddress} -> 0.05 ETH`);
    } else {
      console.log('  -> nothing owed: every configured staff wallet is at or above its need.');
    }
  }
  console.log('');

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
  console.log(`  Minted by the deployer at provision / Ines' faucet. Circle's ${USDC_FAUCET_URL} USDC (${circle}) is a`);
  console.log('  DIFFERENT token — operator/treasury float only, never the practice balance (docs/SEPOLIA-LIVE.md §4.2).');
  console.log('');

  if (shortfalls.length === 0 && refused.length === 0) {
    console.log('ALL FUNDED — every configured Sepolia role meets its floor. A Live pass may proceed.');
    return;
  }

  console.log('— what to do (docs/SEPOLIA-LIVE.md §4.4) —');
  if (treasuryAddress) {
    console.log(`  0. Faucet drops go to the TREASURY first: ${ETH_FAUCET_URL}`);
    console.log(`     paste ${treasuryAddress}  -> request 0.05 ETH, then: npm run treasury:topup -- --execute`);
    console.log(`     Circle USDC (20 / 2 h): ${USDC_FAUCET_URL} -> Ethereum Sepolia -> same address`);
  }
  let step = 1;
  for (const r of shortfalls) {
    console.log(`  ${step++}. ${ETH_FAUCET_URL}`);
    console.log(`     paste ${r.address}  (${r.label})  -> request 0.05 ETH   [${r.need}]`);
  }
  console.log('  Google Cloud drops 0.05 ETH per day per eligibility: fund the treasury first, then let it rebalance.');
  console.log('  Do not soft-send undersized gas to get past a shortfall — cloneBlox needs ~16.2M gas of headroom.');
  process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
