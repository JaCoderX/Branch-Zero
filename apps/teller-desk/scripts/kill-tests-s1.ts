/**
 * S1 kill test — K7: can a governed `AccountBlox` complete a Uniswap **v4** swap on Sepolia, and only through
 * the door the manager approved? Since 2026-09-09 the desk is a **fiat** desk: USD against EUR and ILS on the two
 * deep practice pools `infra/scripts/fx-pools-fiat.ts` seeded (docs/HANDOFF-fx-fiat-pairs.md). Since 2026-09-10 it
 * trades **both ways** and the fiat can be paid out over the counter (docs/missions/HANDOFF-fx-bidirectional.md).
 *
 *   npm -w apps/teller-desk run killtests:s1
 *   npm -w apps/teller-desk run killtests:s1 -- --amount 5           # dollars per buy; the sell changes back half of what the buy returned
 *   npm -w apps/teller-desk run killtests:s1 -- --pairs EUR          # one pair only
 *   npm -w apps/teller-desk run killtests:s1 -- --no-pay             # skip the Lane A fiat pays (K7-h)
 *
 * This deliberately stays outside MockChain (HANDOFF §5i: "MockChain alone is not enough"). It drives the product
 * modules `src/lanes/fx.ts` + `src/lanes/laneA.ts` against the live pools:
 *
 *   K7-a  the FX till is the player's own AccountBlox on Sepolia and `owner()` is their Privy wallet
 *   K7-b  opening the till registers the three schemas and whitelists **seven** rows: `approve` × USD, EUR, ILS (a sell
 *         approves the fiat), Permit2, the router, and EUR + ILS as `transfer` targets — and a till opened one-way
 *         (2026-09-09) **heals** to that on this very call, with `fxEnabled` false before and true after
 *   K7-c  per pair, both sides: the V4Quoter prices the trade off-chain (`eth_call`), the board carries min-out + a
 *         deadline, and the all-in rate sits within 1 % of the pinned seed mid (read the other way for a sell)
 *   K7-d  per pair, both sides: **the swap completes** — a buy turns practice dollars into EUR / ILS, a sell turns some
 *         of them back into dollars, through the Universal Router, honouring each pool's own `currency0`/`currency1`
 *         sort (USD is currency1 in both) and the side's `zeroForOne` flip
 *   K7-e  the same call through a router that is *not* whitelisted is refused by the guard (the security story)
 *   K7-f  a stale quote is refused rather than silently re-priced
 *   K7-g  a currency the desk does not deal in is refused `FX_PAIR`, a direction it does not know `FX_SIDE`, and a
 *         quote taken as its own mirror `FX_SIDE` — all before anything is signed
 *   K7-h  Lane A pays a little EUR and a little ILS out of the Main account (Live: the till *is* the Main account) and
 *         refuses a currency the counter does not move (`PAY_TOKEN`)
 *
 * Sepolia gas is real. A first pass on a shut till — guard batch (≈3.3 M gas) + role batch (≈2.4 M) + per pair one
 * `execute` for the buy and approve + Permit2 + `execute` for the sell + two Lane A pays — needs **≈0.015 ETH** in
 * `SEPOLIA_BROADCASTER_PK` at a ~1 gwei base fee. Healing a one-way till is one small guard batch (four whitelist
 * rows, no schema). On a till with every allowance on file, a pass is four `execute` calls + two pays (≈0.005 ETH).
 * Check before you spend — `npm -w apps/teller-desk run fx:preflight`. The till needs practice USD (the U5 mock's
 * `mint` is open).
 */
import { formatEther, formatUnits, getAddress, parseAbi, parseUnits, type Address } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { config } from '../src/config.ts';
import { enableFx, fxDeployment, fxEnabled, fxStatus, quote, readDoor, swap, swapThroughWrongRouter, tillFor, FX_PAIRS, type FxPair, _fxClients } from '../src/lanes/fx.ts';
import { pay, payTokenOf } from '../src/lanes/laneA.ts';
import { embeddedWalletOf, privy, recoverPolicy } from '../src/privy.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const argv = process.argv.slice(2);
const AMOUNT = argv.indexOf('--amount') >= 0 ? argv[argv.indexOf('--amount') + 1] : '5';
const PAIRS: FxPair[] = argv.indexOf('--pairs') >= 0 ? (argv[argv.indexOf('--pairs') + 1].split(',').map((p) => p.trim().toUpperCase()) as FxPair[]) : [...FX_PAIRS];
const DO_PAY = !argv.includes('--no-pay');
/** Lane A fiat pay size (display units) — small on purpose: it is the proof, not the point. */
const PAY_AMOUNT = '0.5';
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

  // ---- K7-b: the exchange door — three schemas, seven whitelist rows (both ways + fiat over the counter), heals a one-way till ----
  try {
    const doorBefore = await readDoor(till);
    const enabled = await enableFx(player, 'kt-s1-enable');
    player = getPlayer(player.privyUserId)!;
    const doorAfter = await readDoor(till);
    const rows = enabled.whitelist.map((w) => `${w.function.split('(')[0]} → ${w.symbol}`);
    const approveSyms = enabled.whitelist.filter((w) => w.function === 'approve(address,uint256)').map((w) => w.symbol);
    const transferSyms = enabled.whitelist.filter((w) => w.function === 'transfer(address,uint256)').map((w) => w.symbol);
    const shape = enabled.whitelist.length === 7 && ['USD', 'EUR', 'ILS'].every((s) => approveSyms.includes(s)) && ['EUR', 'ILS'].every((s) => transferSyms.includes(s));
    const healed = !doorBefore.open && doorAfter.open;
    const payable = doorAfter.payable.join(' · ');
    record(
      'K7-b-guards',
      doorAfter.open && shape ? 'PASS' : 'FAIL',
      `${doorBefore.open ? 'already open both ways' : `${doorBefore.missing.length ? `healed a till missing ${doorBefore.missing.map((m) => `${m.function.split('(')[0]}→${m.symbol}`).join(', ')}` : 'opened'} (${enabled.actions.length} config actions${enabled.guardHash ? `, guard ${enabled.guardHash}` : ''}${enabled.roleHash ? `, roles ${enabled.roleHash}` : ''})`}; ${healed ? 'fxEnabled false → true; ' : ''}whitelist: ${rows.join(' | ')}; counter pays ${payable}`,
    );
    if (!doorAfter.open) return finish();
  } catch (e) {
    record('K7-b-guards', 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
    return finish();
  }

  // ---- K7-c / K7-d per pair, both sides: the quote board and the swap itself ----
  for (const pair of PAIRS) {
    const p = d.pairs[pair];
    const seed = Number(p.seedRate);
    // Buy first (dollars in), then sell back half of what the buy returned (fiat in) — so a fresh till can do both.
    let sellAmount: string | undefined;
    for (const side of ['buy', 'sell'] as const) {
      const tokenIn = side === 'buy' ? { address: d.usdc.address, symbol: d.usdc.symbol, decimals: d.usdc.decimals } : p.token;
      const tokenOut = side === 'buy' ? p.token : { address: d.usdc.address, symbol: d.usdc.symbol, decimals: d.usdc.decimals };
      const amount = side === 'buy' ? AMOUNT : (sellAmount ?? formatUnits((await balanceOf(p.token.address)) / 2n, p.token.decimals));
      let quoteId: string | undefined;
      try {
        const q = await quote(player, amount, pair, side);
        quoteId = q.quoteId;
        const perOne = Number(q.amountOut) / Number(q.amountIn);
        // a buy's all-in rate is fiat per dollar (≈ seed); a sell's is dollars per fiat (≈ 1/seed)
        const expect = side === 'buy' ? seed : 1 / seed;
        const drift = seed > 0 ? Math.abs(perOne - expect) / expect : 1;
        const sane = Number(q.amountOut) > 0 && Number(q.minOut) > 0 && Number(q.minOut) < Number(q.amountOut) && Number(q.deadline) > Number(q.serverNow) && q.pair === pair && q.side === side && q.symbolIn === tokenIn.symbol && q.symbolOut === tokenOut.symbol;
        const deep = drift < 0.01; // 0.30 % fee + a $100M book: the all-in rate should sit well inside 1 % of the seed mid
        record(`K7-c-quote-${pair}-${side}`, sane && deep ? 'PASS' : sane ? 'PARTIAL' : 'FAIL', `${q.amountIn} ${q.symbolIn} → ${q.amountOut} ${q.symbolOut} (min ${q.minOut} at ${q.slippage}, fee ${q.fee}); ${q.rate} vs seed ${side === 'buy' ? p.seedRate : `1/${p.seedRate}`} (${(drift * 100).toFixed(3)} % off); valid ${q.validSec}s, deadline ${q.deadline}`);
      } catch (e) {
        record(`K7-c-quote-${pair}-${side}`, 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
      }

      const inBefore = await balanceOf(tokenIn.address);
      const outBefore = await balanceOf(tokenOut.address);
      try {
        if (inBefore < parseUnits(amount, tokenIn.decimals)) throw Object.assign(new Error(`till holds ${formatUnits(inBefore, tokenIn.decimals)} ${tokenIn.symbol}, needs ${amount}${side === 'buy' ? ` — mint practice dollars to ${till}` : ''}`), { code: 'InsufficientBalance' });
        const s = await swap(player, quoteId, amount, `kt-s1-swap-${pair}-${side}`, undefined, pair, side);
        player = getPlayer(player.privyUserId)!;
        const inAfter = await balanceOf(tokenIn.address);
        const outAfter = await balanceOf(tokenOut.address);
        const spent = inBefore - inAfter;
        const got = outAfter - outBefore;
        const ok = got > 0n && spent === parseUnits(amount, tokenIn.decimals) && got >= parseUnits(s.minOut, tokenOut.decimals) && s.pair === pair && s.side === side;
        if (side === 'buy' && ok) sellAmount = formatUnits(got / 2n, p.token.decimals);
        record(
          `K7-d-swap-${pair}-${side}`,
          ok ? 'PASS' : 'FAIL',
          `AccountBlox ${till} swapped ${formatUnits(spent, tokenIn.decimals)} ${tokenIn.symbol} → ${formatUnits(got, tokenOut.decimals)} ${tokenOut.symbol} on Uniswap v4 (zeroForOne ${side === 'buy' ? p.usdIsCurrency0 : !p.usdIsCurrency0}); ${s.steps.map((x) => `${x.step} ${x.hash}`).join(' · ')}; explorer ${s.explorer}${s.fee ? `; fee ${s.fee}` : ''}`,
        );
      } catch (e) {
        record(`K7-d-swap-${pair}-${side}`, 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
      }
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

  // ---- K7-g: a currency the desk does not deal in, a direction it does not know, a quote taken as its mirror ----
  try {
    await quote(player, AMOUNT, 'WETH');
    record('K7-g-pair', 'FAIL', 'the desk priced WETH — the fiat desk must not quote ether');
  } catch (e) {
    record('K7-g-pair', codeOf(e) === 'FX_PAIR' ? 'PASS' : 'FAIL', `pair WETH refused with ${codeOf(e)}: ${msgOf(e)}`);
  }
  try {
    await quote(player, AMOUNT, 'EUR', 'hold');
    record('K7-g-side', 'FAIL', "the desk priced a 'hold' — there are two directions");
  } catch (e) {
    record('K7-g-side', codeOf(e) === 'FX_SIDE' ? 'PASS' : 'FAIL', `side 'hold' refused with ${codeOf(e)}: ${msgOf(e)}`);
  }
  try {
    const q = await quote(player, '1', 'EUR', 'sell');
    await swap(player, q.quoteId, undefined, 'kt-s1-mirror', undefined, 'EUR', 'buy');
    record('K7-g-mirror', 'FAIL', 'a sell quote was executed as a buy');
  } catch (e) {
    record('K7-g-mirror', codeOf(e) === 'FX_SIDE' ? 'PASS' : 'FAIL', `a sell quote taken as a buy refused with ${codeOf(e)}: ${msgOf(e)} (nothing signed)`);
  }

  // ---- K7-h: Lane A in fiat — the counter pays a little EUR and ILS out of the Main account; refuses a currency it does not move ----
  if (DO_PAY) {
    if (!config.fxTillIsMain || !player.account || player.account.toLowerCase() !== till.toLowerCase()) {
      record('K7-h-pay', 'PARTIAL', `skipped: Lane A pays from the Main account (${player.account ?? 'none'}) and the till is ${till} — fiat pay needs the Live wing where they are one contract (fxTillIsMain ${config.fxTillIsMain})`);
    } else {
      const payee = d.fixtures.find((f) => f.address.toLowerCase() !== till.toLowerCase())?.address ?? broadcasterAddress;
      for (const pair of PAIRS) {
        const p = d.pairs[pair];
        try {
          const before = await balanceOf(p.token.address);
          const payeeBefore = (await publicClient.readContract({ address: p.token.address, abi: erc20, functionName: 'balanceOf', args: [payee] })) as bigint;
          if (before < parseUnits(PAY_AMOUNT, p.token.decimals)) throw Object.assign(new Error(`the account holds ${formatUnits(before, p.token.decimals)} ${p.token.symbol}, needs ${PAY_AMOUNT}`), { code: 'FX_TILL_SHORT' });
          const r = await pay(player, payee, PAY_AMOUNT, `kt-s1-pay-${pair}`, undefined, payTokenOf(pair));
          const after = await balanceOf(p.token.address);
          const payeeAfter = (await publicClient.readContract({ address: p.token.address, abi: erc20, functionName: 'balanceOf', args: [payee] })) as bigint;
          const ok = before - after === parseUnits(PAY_AMOUNT, p.token.decimals) && payeeAfter - payeeBefore === parseUnits(PAY_AMOUNT, p.token.decimals) && r.symbol === p.token.symbol;
          record(`K7-h-pay-${pair}`, ok ? 'PASS' : 'FAIL', `Lane A paid ${PAY_AMOUNT} ${p.token.symbol} from ${till} to ${payee} through the counter's transfer(address,uint256) (slip #${r.txId ?? '?'}); ${d.explorer}/tx/${r.hash}; account now ${r.balanceAfter} ${r.symbol}`);
        } catch (e) {
          record(`K7-h-pay-${pair}`, 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
        }
      }
      try {
        payTokenOf('GBP');
        record('K7-h-token', 'FAIL', 'the counter accepted GBP');
      } catch (e) {
        record('K7-h-token', codeOf(e) === 'PAY_TOKEN' ? 'PASS' : 'FAIL', `GBP refused with ${codeOf(e)}: ${msgOf(e)}`);
      }
    }
  }

  // ---- desk view the game will render ----
  try {
    const st = await fxStatus(getPlayer(player.privyUserId)!);
    console.log(`\nstatus    till ${st.account} · ${st.usdc} ${st.symbolIn} · ${st.eur} EUR · ${st.ils} ILS · door ${st.enabled ? 'open' : 'closed'} · counter pays ${st.payable.join(' · ')}${st.missing.length ? ` · missing ${st.missing.length} rows` : ''}`);
    for (const p of st.pairs) console.log(`          USD/${p.pair} ${p.midRate} (seed ${p.seedRate} ${p.seedRateDate}) · fee ${p.pool.fee} tick ${p.pool.tick} liquidity ${p.pool.liquidity}`);
    console.log(`explorer  ${st.explorer.account}`);
  } catch (e) {
    console.log(`status read failed: ${msgOf(e)}`);
  }
  console.log(`teller    ${formatEther(await publicClient.getBalance({ address: broadcasterAddress }))} ETH left`);
  return finish();
}

function finish(): void {
  console.log('\nS1 kill-test summary (K7 — fiat pairs, both ways, fiat over the counter)');
  for (const r of results) console.log(`${r.id.padEnd(18)} ${r.verdict.padEnd(8)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(`S1 kill test aborted: ${codeOf(e)}: ${(e as Error).message}`);
  process.exitCode = 1;
});
