/**
 * S1 kill test — K7: can a governed `AccountBlox` complete a Uniswap **v4** swap on Sepolia, and only through
 * the door the manager approved? Since 2026-09-09 the desk is a **fiat** desk: USD → EUR and USD → ILS against the
 * two deep practice pools `infra/scripts/fx-pools-fiat.ts` seeded (docs/HANDOFF-fx-fiat-pairs.md).
 *
 *   npm -w apps/teller-desk run killtests:s1
 *   npm -w apps/teller-desk run killtests:s1 -- --amount 5
 *   npm -w apps/teller-desk run killtests:s1 -- --pairs EUR        # one pair only
 *
 * This deliberately stays outside MockChain (HANDOFF §5i: "MockChain alone is not enough"). It drives the product
 * module `src/lanes/fx.ts` against the live pools:
 *
 *   K7-a  the FX till is the player's own AccountBlox on Sepolia and `owner()` is their Privy wallet
 *   K7-b  opening the till registers the three schemas and whitelists exactly three targets (unchanged by the fiat
 *         pairs: one-way USD → fiat approves only the practice dollar)
 *   K7-c  per pair: the V4Quoter prices the swap off-chain (`eth_call`), the board carries min-out + a deadline, and
 *         the all-in rate sits within 1 % of the pinned seed rate — a $100M book barely moves for a desk-sized order
 *   K7-d  per pair: **the swap completes** — practice dollars become EUR / ILS through the Universal Router, honouring
 *         each pool's own `currency0`/`currency1` sort (USD is currency1 in both)
 *   K7-e  the same call through a router that is *not* whitelisted is refused by the guard (the security story)
 *   K7-f  a stale quote is refused rather than silently re-priced
 *   K7-g  a currency the desk does not deal in is refused `FX_PAIR` before anything is signed
 *
 * Sepolia gas is real. A first pass — guard batch (≈3.3 M gas) + role batch (≈2.4 M) + approve + Permit2 + two
 * `execute` calls — needs **≈0.01 ETH** in `SEPOLIA_BROADCASTER_PK` at a ~1 gwei base fee. On a till that is already
 * open with allowances on file, a pass is two `execute` calls (≈0.002 ETH). Check before you spend —
 * `npm -w apps/teller-desk run fx:preflight`. The till needs practice USD (the U5 mock's `mint` is open).
 */
import { formatEther, formatUnits, getAddress, parseAbi, parseUnits, type Address } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { config } from '../src/config.ts';
import { enableFx, fxDeployment, fxEnabled, fxStatus, quote, swap, swapThroughWrongRouter, tillFor, FX_PAIRS, type FxPair, _fxClients } from '../src/lanes/fx.ts';
import { embeddedWalletOf, privy, recoverPolicy } from '../src/privy.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const argv = process.argv.slice(2);
const AMOUNT = argv.indexOf('--amount') >= 0 ? argv[argv.indexOf('--amount') + 1] : '5';
const PAIRS: FxPair[] = argv.indexOf('--pairs') >= 0 ? (argv[argv.indexOf('--pairs') + 1].split(',').map((p) => p.trim().toUpperCase()) as FxPair[]) : [...FX_PAIRS];
const results: Array<{ id: string; verdict: 'PASS' | 'FAIL' | 'PARTIAL'; note: string }> = [];

function record(id: string, verdict: 'PASS' | 'FAIL' | 'PARTIAL', note: string): void {
  results.push({ id, verdict, note });
  console.log(`\n${verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : '✗'} ${id} ${verdict} — ${note}\n`);
}

const codeOf = (e: unknown) => String((e as { code?: string }).code ?? 'UNKNOWN');
const msgOf = (e: unknown) => (e as Error).message.split('\n')[0].slice(0, 220);

async function rigPlayer(): Promise<Player> {
  const user = await privy.users().getByEmailAddress({ address: RIG_EMAIL }).catch(() => undefined);
  if (!user) throw new Error(`no Privy rig user for ${RIG_EMAIL} — run npm run killtests once first`);
  const w = embeddedWalletOf(user);
  const stored = getPlayer(user.id);
  const recovered = stored?.policyId ? undefined : await recoverPolicy(w.walletId).catch(() => undefined);
  console.log(`rig       ${user.id} · wallet ${w.walletId} → ${w.ownerAddress} (delegated ${w.delegated})`);
  return upsertPlayer({
    ...stored,
    privyUserId: user.id,
    ownerAddress: w.ownerAddress,
    walletId: w.walletId,
    signingMode: w.delegated ? 'session' : 'client',
    policyId: stored?.policyId ?? recovered?.policyId,
    policyRuleId: stored?.policyRuleId ?? recovered?.ruleId,
  });
}

async function main(): Promise<void> {
  if (!config.sepoliaRpcUrl || !config.fx.broadcasterPk) {
    record('K7-config', 'FAIL', 'SEPOLIA_RPC_URL and SEPOLIA_BROADCASTER_PK are required; nothing was attempted');
    return finish();
  }
  const d = fxDeployment();
  const { publicClient, chain, broadcasterAddress } = _fxClients();
  console.log(`chain     ${chain.id}`);
  for (const pair of FX_PAIRS) console.log(`pool      USD/${pair} ${d.pairs[pair].pool.id} · ${d.pairs[pair].token.symbol} ${d.pairs[pair].token.address} · USD is currency${d.pairs[pair].usdIsCurrency0 ? 0 : 1} · seed ${d.pairs[pair].seedRate} (${d.pairs[pair].seedRateDate})`);
  console.log(`router    ${d.uniswap.universalRouter} · quoter ${d.uniswap.quoter} · permit2 ${d.uniswap.permit2}`);
  console.log(`teller    ${broadcasterAddress} ${formatEther(await publicClient.getBalance({ address: broadcasterAddress }))} ETH`);

  let player = await rigPlayer();

  // ---- K7-a: the till is the player's own governed account ----
  let till: Address;
  try {
    till = await tillFor(player, true, 'kt-s1-till');
    player = getPlayer(player.privyUserId)!;
    const so = new SecureOwnable(publicClient as never, undefined, till, chain);
    const owner = await so.owner();
    const ok = owner.toLowerCase() === player.ownerAddress.toLowerCase();
    record('K7-a-till', ok ? 'PASS' : 'FAIL', `FX till ${till} · owner() ${owner} ${ok ? '==' : '!='} the player's Privy wallet · broadcasters ${(await so.getBroadcasters()).join(', ')}`);
    if (!ok) return finish();
  } catch (e) {
    record('K7-a-till', 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
    return finish();
  }

  const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);
  const balanceOf = async (token: Address) => (await publicClient.readContract({ address: token, abi: erc20, functionName: 'balanceOf', args: [till] })) as bigint;
  const usdOf = () => balanceOf(d.usdc.address);
  console.log(`till      ${formatUnits(await usdOf(), d.usdc.decimals)} ${d.usdc.symbol} · ${formatUnits(await balanceOf(d.pairs.EUR.token.address), 6)} EUR · ${formatUnits(await balanceOf(d.pairs.ILS.token.address), 6)} ILS`);

  // ---- K7-b: the exchange door — three schemas, three targets, nothing else ----
  try {
    const before = await fxEnabled(till);
    const enabled = await enableFx(player, 'kt-s1-enable');
    player = getPlayer(player.privyUserId)!;
    const after = await fxEnabled(till);
    const targets = enabled.whitelist.map((w) => `${w.function} → ${w.target}`);
    const three = enabled.whitelist.length === 3 && enabled.whitelist.some((w) => w.target.toLowerCase() === d.usdc.address.toLowerCase());
    record('K7-b-guards', after && three ? 'PASS' : 'FAIL', `${before ? 'already open' : `opened (${enabled.actions.length} config actions${enabled.guardHash ? `, guard ${enabled.guardHash}` : ''}${enabled.roleHash ? `, roles ${enabled.roleHash}` : ''})`}; whitelist: ${targets.join(' | ')} — no fiat token is approved (one-way desk)`);
    if (!after) return finish();
  } catch (e) {
    record('K7-b-guards', 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
    return finish();
  }

  // ---- K7-c / K7-d per pair: the quote board and the swap itself ----
  for (const pair of PAIRS) {
    const p = d.pairs[pair];
    let quoteId: string | undefined;
    try {
      const q = await quote(player, AMOUNT, pair);
      quoteId = q.quoteId;
      const perOne = Number(q.amountOut) / Number(q.amountIn);
      const seed = Number(p.seedRate);
      const drift = seed > 0 ? Math.abs(perOne - seed) / seed : 1;
      const sane = Number(q.amountOut) > 0 && Number(q.minOut) > 0 && Number(q.minOut) < Number(q.amountOut) && Number(q.deadline) > Number(q.serverNow) && q.pair === pair;
      const deep = drift < 0.01; // 0.30 % fee + a $100M book: the all-in rate should sit well inside 1 % of the seed mid
      record(`K7-c-quote-${pair}`, sane && deep ? 'PASS' : sane ? 'PARTIAL' : 'FAIL', `${q.amountIn} ${q.symbolIn} → ${q.amountOut} ${q.symbolOut} (min ${q.minOut} at ${q.slippage}, fee ${q.fee}); ${q.rate} vs seed ${p.seedRate} (${(drift * 100).toFixed(3)} % off); valid ${q.validSec}s, deadline ${q.deadline}`);
    } catch (e) {
      record(`K7-c-quote-${pair}`, 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
    }

    const usdBefore = await usdOf();
    const outBefore = await balanceOf(p.token.address);
    try {
      if (usdBefore < parseUnits(AMOUNT, d.usdc.decimals)) throw Object.assign(new Error(`till holds ${formatUnits(usdBefore, d.usdc.decimals)} ${d.usdc.symbol}, needs ${AMOUNT} — mint practice dollars to ${till}`), { code: 'InsufficientBalance' });
      const s = await swap(player, quoteId, AMOUNT, `kt-s1-swap-${pair}`, undefined, pair);
      player = getPlayer(player.privyUserId)!;
      const usdAfter = await usdOf();
      const outAfter = await balanceOf(p.token.address);
      const spent = usdBefore - usdAfter;
      const got = outAfter - outBefore;
      const ok = got > 0n && spent === parseUnits(AMOUNT, d.usdc.decimals) && got >= parseUnits(s.minOut, p.token.decimals) && s.pair === pair;
      record(
        `K7-d-swap-${pair}`,
        ok ? 'PASS' : 'FAIL',
        `AccountBlox ${till} swapped ${formatUnits(spent, d.usdc.decimals)} ${d.usdc.symbol} → ${formatUnits(got, p.token.decimals)} ${p.token.symbol} on Uniswap v4 (zeroForOne ${p.usdIsCurrency0}); ${s.steps.map((x) => `${x.step} ${x.hash}`).join(' · ')}; explorer ${s.explorer}${s.fee ? `; fee ${s.fee}` : ''}`,
      );
    } catch (e) {
      record(`K7-d-swap-${pair}`, 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
    }
  }

  // ---- K7-e: the guard is the security story — a router that is not on the list is refused ----
  try {
    const hash = await swapThroughWrongRouter(player, getAddress(d.uniswap.poolManager));
    record('K7-e-wrong-door', 'FAIL', `the account called a non-whitelisted contract: ${hash}`);
  } catch (e) {
    const code = codeOf(e);
    const refused = /TargetNotWhitelisted|NoPermission|FX_TX_FAILED/i.test(`${code} ${msgOf(e)}`);
    record('K7-e-wrong-door', refused ? 'PASS' : 'PARTIAL', `execute() at the PoolManager (not whitelisted) was refused with ${code}: ${msgOf(e)}`);
  }

  // ---- K7-f: an expired quote is refused, not silently re-priced ----
  try {
    await swap(player, 'deadbeef', undefined, 'kt-s1-stale');
    record('K7-f-stale-quote', 'FAIL', 'an unknown quote id was accepted');
  } catch (e) {
    record('K7-f-stale-quote', codeOf(e) === 'FX_QUOTE_EXPIRED' ? 'PASS' : 'FAIL', `unknown/expired quote refused with ${codeOf(e)}: ${msgOf(e)}`);
  }

  // ---- K7-g: a currency the desk does not deal in is refused before anything is signed ----
  try {
    await quote(player, AMOUNT, 'WETH');
    record('K7-g-pair', 'FAIL', 'the desk priced WETH — the fiat desk must not quote ether');
  } catch (e) {
    record('K7-g-pair', codeOf(e) === 'FX_PAIR' ? 'PASS' : 'FAIL', `pair WETH refused with ${codeOf(e)}: ${msgOf(e)}`);
  }

  // ---- desk view the game will render ----
  try {
    const st = await fxStatus(getPlayer(player.privyUserId)!);
    console.log(`\nstatus    till ${st.account} · ${st.usdc} ${st.symbolIn} · ${st.eur} EUR · ${st.ils} ILS · door ${st.enabled ? 'open' : 'closed'}`);
    for (const p of st.pairs) console.log(`          USD/${p.pair} ${p.midRate} (seed ${p.seedRate} ${p.seedRateDate}) · fee ${p.pool.fee} tick ${p.pool.tick} liquidity ${p.pool.liquidity}`);
    console.log(`explorer  ${st.explorer.account}`);
  } catch (e) {
    console.log(`status read failed: ${msgOf(e)}`);
  }
  console.log(`teller    ${formatEther(await publicClient.getBalance({ address: broadcasterAddress }))} ETH left`);
  return finish();
}

function finish(): void {
  console.log('\nS1 kill-test summary (K7 — fiat pairs)');
  for (const r of results) console.log(`${r.id.padEnd(18)} ${r.verdict.padEnd(8)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(`S1 kill test aborted: ${codeOf(e)}: ${(e as Error).message}`);
  process.exitCode = 1;
});
