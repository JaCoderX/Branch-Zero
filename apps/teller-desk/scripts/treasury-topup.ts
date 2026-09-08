/**
 * Sepolia ops treasury — operator CLI (docs/SEPOLIA-TREASURY.md §5).
 *
 *   npm run treasury:topup                      # DRY RUN — reads balances, prints the plan, sends nothing
 *   npm run treasury:topup -- --execute         # send ETH from the treasury to every staff wallet below need
 *   npm run treasury:topup -- --execute --partial   # allow a send that reaches `need` but not `target`
 *   npm run treasury:topup -- --json            # same plan, machine-readable
 *   npm run treasury:topup -- --practice        # also consider the (opt-in) practice-USDC float
 *
 * Dry run is the default because the dangerous direction is silent: an operator who forgets a flag should
 * end up informed, not out of gas money. The dry run and `--execute` share one planner (`planTopUps` in
 * `@branch-zero/shared`), so what prints is what would be sent, not a second guess at it.
 *
 * Exit codes: 0 = nothing owed or top-ups sent · 2 = a named funding blocker (empty/short treasury, role
 * collapse, wrong wing) · 1 = an unexpected failure. Nothing here prints key material.
 */
import { formatEther } from 'viem';
import { ETH_FAUCET_URL, USDC_FAUCET_URL, fmtEth } from '@branch-zero/shared';
import { config } from '../src/config.ts';
import { chain } from '../src/chain.ts';
import { plan as planTreasury, serializeHealth, topUp, topUpPractice } from '../src/treasury.ts';

const argv = process.argv.slice(2);
const execute = argv.includes('--execute');
const partial = argv.includes('--partial');
const asJson = argv.includes('--json');
const withPractice = argv.includes('--practice');

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function main() {
  if (asJson) {
    const { snapshot, plan } = await planTreasury({ allowPartial: partial });
    console.log(JSON.stringify(serializeHealth(snapshot, plan), null, 2));
    process.exitCode = plan.treasuryShort || snapshot.problem ? 2 : 0;
    return;
  }

  console.log(`Sepolia ops treasury — ${execute ? 'EXECUTE' : 'DRY RUN'} · wing ${config.mode} · chain ${chain.id}${partial ? ' · partial sends allowed' : ''}`);
  console.log('');

  const result = await topUp({ execute, allowPartial: partial, reason: 'cli' });
  const { snapshot: snap, plan } = result;

  if (!snap.address) {
    console.log('x  no treasury configured.');
    console.log(`   Set SEPOLIA_TREASURY_PK (a Sepolia throwaway, never a Ganache-parity key) and send the faucet drops there:`);
    console.log(`     ETH  ${ETH_FAUCET_URL}`);
    console.log(`     USDC ${USDC_FAUCET_URL}  (Ethereum Sepolia)`);
    console.log('   SEPOLIA_TREASURY_ADDRESS alone gives a read-only view (balances, plan) with no ability to send.');
    process.exitCode = 2;
    return;
  }

  console.log(`treasury ${snap.address}${snap.canExecute ? '' : '   [read-only: SEPOLIA_TREASURY_ADDRESS, no key in this process]'}`);
  console.log(`   ETH            ${fmtEth(snap.ethWei)}`);
  console.log(`   Circle USDC    ${snap.circleUsdc.amount}   ${snap.circleUsdc.address}  (held only — never auto-sent)`);
  console.log(`   practice ${pad(snap.practiceUsdc.symbol, 6)} ${snap.practiceUsdc.amount}   ${snap.practiceUsdc.address}  (in-game dollars; a DIFFERENT token)`);
  console.log(`   caps           ${config.treasury.maxPerTxEth} ETH/tx · ${config.treasury.maxPerHourEth} ETH/hour (spent ${fmtEth(snap.spentLastHourWei)}) · reserve ${config.treasury.reserveEth} ETH`);
  if (snap.collapsed.length) {
    console.log(`   !! this key is ALSO the ${snap.collapsed.join(' + ')} key — identity/float separation is collapsed for this demo`);
    console.log(`      those roles are skipped (a self-transfer moves nothing) and their target is held back as reserve`);
  }
  console.log('');

  if (snap.problem) {
    console.log(`REFUSED (${snap.problem.code}): ${snap.problem.message}`);
    process.exitCode = 2;
    return;
  }

  console.log(`staff wallets — refill below need, fill to need × 1.25`);
  console.log(`   ${pad('role', 37)}${pad('balance', 13)}${pad('need', 11)}${pad('target', 11)}action`);
  for (const line of plan.lines) {
    const action =
      line.sendWei > 0n
        ? `SEND ${fmtEth(line.sendWei)} ETH${line.clampedBy ? ` (clamped by ${line.clampedBy})` : ''}`
        : line.skip === 'funded'
          ? 'ok'
          : line.skip === 'is-treasury'
            ? 'skip — this is the treasury key itself'
            : `BLOCKED — needs ${fmtEth(line.deficitWei ?? 0n)} ETH more in the treasury${line.clampedBy === 'per-tx cap' ? ' (also over the per-tx cap)' : ''}`;
    console.log(`   ${pad(line.label, 37)}${pad(fmtEth(line.balanceWei), 13)}${pad(fmtEth(line.needWei), 11)}${pad(fmtEth(line.targetWei), 11)}${action}`);
  }
  for (const role of snap.unconfigured) console.log(`   ${pad(role, 37)}${pad('—', 13)}${pad('—', 11)}${pad('—', 11)}not configured in this .env`);
  console.log('');

  if (withPractice) {
    const practice = await topUpPractice({ execute });
    console.log(`practice float: ${practice.note}${practice.hash ? `  ${practice.hash}` : ''}`);
    console.log('');
  }

  if (result.sends.length) {
    console.log(`SENT ${result.sends.length} top-up${result.sends.length > 1 ? 's' : ''} (total ${fmtEth(plan.totalWei)} ETH):`);
    for (const s of result.sends) console.log(`   ${pad(s.role, 14)} ${s.amountEth} ETH -> ${s.to}   https://sepolia.etherscan.io/tx/${s.hash}`);
    console.log('');
    console.log(`treasury now holds ${formatEther(result.snapshot.ethWei)} ETH`);
    process.exitCode = 0;
    return;
  }

  if (result.refused?.code === 'TREASURY_SHORT' || plan.treasuryShort) {
    console.log(`BLOCKER — the treasury cannot fill every shortfall.`);
    console.log(`   holds ${fmtEth(snap.ethWei)} ETH · needs ${fmtEth(plan.requiredWei)} ETH (plus ${config.treasury.reserveEth} reserve) to reach every target`);
    console.log(`   a human fills the treasury; agents do not claim faucets (sign-in / captcha):`);
    console.log(`     ${ETH_FAUCET_URL}`);
    console.log(`     paste ${snap.address}  -> request 0.05 ETH`);
    console.log(`   --partial allows a send that reaches need (never below it) without reaching target.`);
    process.exitCode = 2;
    return;
  }

  if (plan.sends.length && !execute) {
    console.log(`DRY RUN — nothing sent. Re-run with --execute to move ${fmtEth(plan.totalWei)} ETH.`);
    process.exitCode = 0;
    return;
  }

  console.log('nothing to do — every configured staff wallet is at or above its need.');
  process.exitCode = 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
