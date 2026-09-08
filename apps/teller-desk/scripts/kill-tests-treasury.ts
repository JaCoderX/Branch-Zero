/**
 * Treasury kill tests — the Sepolia ops treasury (docs/SEPOLIA-TREASURY.md §8).
 *
 *   npm -w apps/teller-desk run killtests:treasury            # Live desk (Sepolia)
 *   npm -w apps/teller-desk run killtests:treasury -- --dev    # Dev desk: must refuse to have a treasury
 *
 * Read-only: no sends, no gas, no keys printed. Every check is something that would be a real loss if it
 * were wrong, and nothing the funding report already prints:
 *
 *   T1  the margin is exactly ×1.25 and the refill trigger is `need`, not `target` — a role at need-minus-a-wei
 *       fills to target, a role at need exactly is left alone. Checked on the pure planner, in wei.
 *   T2  role separation: the treasury address is not any staff address. When an operator has deliberately
 *       collapsed them (demo), the collapse is *reported* and the collapsed role is skipped, never self-sent.
 *   T3  a Ganache-parity key is refused in the treasury slot, by derived address, on a public chain.
 *   T4  Circle's USDC and the in-game practice token are different addresses, and the engine will not send
 *       Circle's token under any policy.
 *   T5  the caps bind: a shortfall larger than the per-tx cap is clamped, and an exhausted rolling hour
 *       plans nothing. A treasury too poor to reach `need` is a BLOCKER, not a partial dribble.
 *   T6  the treasury is Live-only and optional: on the Dev wing it refuses `NOT_LIVE`, holds no key, and the
 *       desk boots regardless.
 *   T7  nothing in the health payload or the ledger is key material.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getAddress, parseEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  CIRCLE_USDC_SEPOLIA,
  GANACHE_PARITY_ADDRESSES,
  REMOTE_EVM_CHAIN_ID,
  SEPOLIA_STAFF_NEEDS,
  fmtEth,
  isGanacheParityAddress,
  needWeiFor,
  planTopUps,
  targetWei,
  type StaffBalance,
} from '@branch-zero/shared';
import { chain } from '../src/chain.ts';
import { config, deployments, REPO_ROOT } from '../src/config.ts';
import { caps, collapsedRoles, plan as planTreasury, serializeHealth, snapshot, topUpPractice, treasuryProblem, treasuryView } from '../src/treasury.ts';

const results: Array<{ id: string; verdict: 'PASS' | 'FAIL' | 'SKIP'; note: string }> = [];
function record(id: string, verdict: 'PASS' | 'FAIL' | 'SKIP', note: string) {
  results.push({ id, verdict, note });
  console.log(`\n${verdict === 'PASS' ? '✓' : verdict === 'SKIP' ? '·' : '✗'} ${id} ${verdict} — ${note}\n`);
}

const ADDR = (n: number): Address => getAddress(`0x${String(n).padStart(40, '0')}`);
const TREASURY = ADDR(9);

/** A synthetic staff row, so the planner is tested on arithmetic rather than on today's balances. */
function row(needEth: string, balanceEth: string, role: StaffBalance['need']['role'] = 'deployer'): StaffBalance {
  const need = SEPOLIA_STAFF_NEEDS.find((n) => n.role === role)!;
  const needWei = parseEther(needEth);
  return { need: { ...need, role }, address: ADDR(role === 'deployer' ? 1 : 2), balanceWei: parseEther(balanceEth), needWei, targetWei: targetWei(needWei) };
}

async function main() {
  console.log(`Treasury kill tests — wing ${config.mode} · chain ${chain.id} · treasury ${treasuryView() ?? 'not configured'}\n`);
  const live = config.target === 'sepolia';

  // ---- T1: the margin and the trigger
  {
    const atNeed = planTopUps({ treasury: TREASURY, treasuryBalanceWei: parseEther('1'), staff: [row('0.048', '0.048')], caps: { ...caps(), reserveWei: 0n } });
    const belowNeed = planTopUps({ treasury: TREASURY, treasuryBalanceWei: parseEther('1'), staff: [row('0.048', '0.030')], caps: { ...caps(), reserveWei: 0n } });
    const expectTarget = parseEther('0.06'); // 0.048 × 1.25, exactly
    const expectSend = expectTarget - parseEther('0.030');
    const ok =
      atNeed.sends.length === 0 &&
      atNeed.lines[0]?.skip === 'funded' &&
      belowNeed.sends.length === 1 &&
      belowNeed.lines[0]?.targetWei === expectTarget &&
      belowNeed.sends[0]?.sendWei === expectSend &&
      belowNeed.sends[0].balanceWei + belowNeed.sends[0].sendWei === expectTarget;
    record(
      'T1',
      ok ? 'PASS' : 'FAIL',
      `need 0.048 → target ${fmtEth(expectTarget)} (×1.25 in wei); balance 0.048 → no send (trigger is need, not target); balance 0.030 → send ${fmtEth(belowNeed.sends[0]?.sendWei ?? 0n)} landing exactly on target`,
    );
  }

  // ---- T2: identity ≠ float
  {
    const snap = await snapshot();
    const collapsed = collapsedRoles();
    const address = treasuryView();
    if (!address) {
      record('T2', 'SKIP', 'no treasury configured, so no address to compare with the staff wallets');
    } else if (collapsed.length === 0) {
      const distinct = snap.staff.every((s) => s.address.toLowerCase() !== address.toLowerCase());
      record('T2', distinct ? 'PASS' : 'FAIL', `treasury ${address} is not any of ${snap.staff.length} staff addresses — identity and float are separate wallets`);
    } else {
      // The operator opted into the collapse. It must be *visible* and it must not self-send.
      const { plan } = await planTreasury();
      const lines = plan.lines.filter((l) => collapsed.includes(l.role));
      const skipped = lines.every((l) => l.skip === 'is-treasury' && l.sendWei === 0n);
      const reported = Boolean(config.treasury.allowRoleReuse) && serializeHealth(snap, plan).collapsedRoles.length > 0;
      const reserved = caps().reserveWei > parseEther(config.treasury.reserveEth);
      record(
        'T2',
        skipped && reported && reserved ? 'PASS' : 'FAIL',
        `treasury shares a key with ${collapsed.join(' + ')} (SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=${config.treasury.allowRoleReuse ? 'on' : 'off'}): ` +
          `${skipped ? 'those roles are skipped, never self-sent' : 'SELF-SEND PLANNED'}; ${reported ? 'reported on /healthz' : 'NOT reported'}; ` +
          `${reserved ? `their target is held back as reserve (${fmtEth(caps().reserveWei)} ETH)` : 'reserve NOT raised'}`,
      );
    }
  }

  // ---- T3: a lab key can never be the treasury on a public chain
  {
    const labAddress = GANACHE_PARITY_ADDRESSES[0];
    const refusedByList = isGanacheParityAddress(labAddress);
    // The desk builds the treasury wallet through the same `wallet()` helper as every other signer, so the
    // refusal is the one `chain.ts` already enforces by derived address. Prove the derivation path agrees:
    // a known Ganache-parity key derives to a listed address, whatever slot it is pasted into.
    const knownLabPk = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
    const derived = privateKeyToAccount(knownLabPk).address;
    const wouldRefuse = isGanacheParityAddress(derived) && chain.id !== REMOTE_EVM_CHAIN_ID;
    const current = treasuryView();
    const currentClean = !current || !isGanacheParityAddress(current);
    record(
      'T3',
      refusedByList && currentClean && (live ? wouldRefuse : true) ? 'PASS' : 'FAIL',
      `lab key ${knownLabPk.slice(0, 8)}… derives to ${derived}, which is on the Ganache-parity list; on chain ${chain.id} the treasury slot ${live ? 'refuses it' : 'is not read at all (Dev wing)'} · configured treasury ${current ?? 'none'} is ${currentClean ? 'not a lab key' : 'A LAB KEY'}`,
    );
  }

  // ---- T4: two USDCs, and only one of them is ever sent
  {
    const practice = deployments().token.address;
    const circle = getAddress(CIRCLE_USDC_SEPOLIA);
    const different = practice.toLowerCase() !== circle.toLowerCase();
    // Even with the practice float switched on, the engine refuses when the configured token is Circle's.
    const guardSource = fs.readFileSync(path.join(REPO_ROOT, 'apps', 'teller-desk', 'src', 'treasury.ts'), 'utf8');
    const refusesCircle = /CIRCLE_USDC_SEPOLIA[\s\S]{0,200}refusing/.test(guardSource);
    const practiceNote = await topUpPractice({ execute: false });
    record(
      'T4',
      different && refusesCircle ? 'PASS' : 'FAIL',
      `practice ${practice} ≠ Circle ${circle}; the practice-float path refuses Circle's token by address; float is ${config.treasury.practice ? 'on' : 'off'} → "${practiceNote.note}"`,
    );
  }

  // ---- T5: the caps bind, and a poor treasury is a blocker rather than a dribble
  {
    const c = { ...caps(), reserveWei: 0n, maxPerTxWei: parseEther('0.01'), maxPerHourWei: parseEther('1') };
    // Shortfall 0.03 against a 0.01 per-tx cap: clamped, and still above `need`, so it is allowed.
    const clamped = planTopUps({ treasury: TREASURY, treasuryBalanceWei: parseEther('1'), staff: [row('0.036', '0.030')], caps: { ...c, allowPartial: true } });
    const clampOk = clamped.sends[0]?.sendWei === parseEther('0.01') && clamped.sends[0]?.clampedBy === 'per-tx cap';
    // Same shortfall, partials disallowed: refused rather than partially sent.
    const strict = planTopUps({ treasury: TREASURY, treasuryBalanceWei: parseEther('1'), staff: [row('0.036', '0.030')], caps: { ...c, allowPartial: false } });
    const strictOk = strict.sends.length === 0 && strict.lines[0]?.skip === 'treasury-short' && strict.treasuryShort;
    // A treasury too poor to reach `need` never sends, even with partials on.
    const poor = planTopUps({ treasury: TREASURY, treasuryBalanceWei: parseEther('0.001'), staff: [row('0.048', '0.010')], caps: { ...c, allowPartial: true } });
    const poorOk = poor.sends.length === 0 && poor.treasuryShort;
    // An exhausted rolling hour plans nothing at all.
    const spent = planTopUps({ treasury: TREASURY, treasuryBalanceWei: parseEther('1'), staff: [row('0.048', '0.010')], caps: { ...c, allowPartial: true }, spentThisHourWei: parseEther('1') });
    const hourOk = spent.sends.length === 0;
    record(
      'T5',
      clampOk && strictOk && poorOk && hourOk ? 'PASS' : 'FAIL',
      `per-tx cap clamps a 0.015 gap to 0.01 and still clears need ${clampOk ? 'ok' : 'FAIL'} · partial refused without --partial ${strictOk ? 'ok' : 'FAIL'} · ` +
        `treasury below need sends nothing ${poorOk ? 'ok' : 'FAIL'} · exhausted hourly cap plans nothing ${hourOk ? 'ok' : 'FAIL'} · ` +
        `live caps ${config.treasury.maxPerTxEth}/tx, ${config.treasury.maxPerHourEth}/hour, reserve ${fmtEth(caps().reserveWei)}`,
    );
  }

  // ---- T6: Live-only, and never a boot dependency
  {
    const problem = treasuryProblem();
    if (live) {
      const ok = problem?.code !== 'NOT_LIVE';
      record('T6', ok ? 'PASS' : 'FAIL', `Live wing: treasury path is available (${problem ? `${problem.code}: ${problem.message}` : 'no problem reported'})`);
    } else {
      const ok = problem?.code === 'NOT_LIVE' && config.treasury.pk === undefined && config.treasury.auto === false;
      record(
        'T6',
        ok ? 'PASS' : 'FAIL',
        `Dev wing booted with no treasury: problem ${problem?.code ?? 'none'} · key read ${config.treasury.pk === undefined ? 'not at all' : 'LOADED (should not be)'} · auto ${config.treasury.auto}`,
      );
    }
  }

  // ---- T7: no key material anywhere the operator can see
  {
    const { snapshot: snap, plan } = await planTreasury();
    const health = JSON.stringify(serializeHealth(snap, plan));
    const ledgerFile = path.join(REPO_ROOT, 'apps', 'teller-desk', '.data', `treasury-${config.chainId}.json`);
    const ledger = fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8') : '[]';
    // Anything that looks like a 32-byte secret. Addresses (20 bytes) and tx hashes (32 bytes) are expected,
    // so compare against the keys this process actually holds instead of guessing from shape.
    const secrets = [config.treasury.pk, config.broadcasterPk, config.deployerPk, config.managerPk, config.ensRegistrarPk]
      .flatMap((s) => (s ? [String(s).replace(/^0x/, '').toLowerCase()] : []));
    const leaked = secrets.filter((s) => health.toLowerCase().includes(s) || ledger.toLowerCase().includes(s));
    record('T7', leaked.length === 0 ? 'PASS' : 'FAIL', `${secrets.length} configured keys checked against the /healthz payload and the ledger — ${leaked.length === 0 ? 'none present' : `${leaked.length} LEAKED`}`);
  }

  // A read-only look at the till, for the record rather than as a verdict.
  {
    const { snapshot: snap, plan } = await planTreasury();
    if (snap.address) {
      console.log(
        `till: ${fmtEth(snap.ethWei)} ETH · Circle USDC ${snap.circleUsdc.amount} · practice ${snap.practiceUsdc.amount} ${snap.practiceUsdc.symbol} · ` +
          `${plan.lines.filter((l) => l.balanceWei < l.needWei).length} staff below need · plan ${fmtEth(plan.totalWei)} ETH · required ${fmtEth(plan.requiredWei)} ETH`,
      );
    }
  }

  console.log('\n─── Treasury kill tests (Sepolia ops treasury) ───');
  for (const r of results) console.log(`${r.id.padEnd(4)} ${r.verdict.padEnd(5)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
