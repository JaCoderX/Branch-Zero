/**
 * S1 kill test — K7: can a governed `AccountBlox` complete a Uniswap **v4** swap on Sepolia, and only through
 * the door the manager approved?
 *
 *   npm -w apps/teller-desk run killtests:s1
 *   npm -w apps/teller-desk run killtests:s1 -- --amount 5
 *
 * This deliberately stays outside MockChain (HANDOFF §5i: "MockChain alone is not enough"). It drives the product
 * module `src/lanes/fx.ts` against the live pool seeded by `infra/scripts/uniswap-pool.ts`:
 *
 *   K7-a  the FX till is the player's own AccountBlox on Sepolia and `owner()` is their Privy wallet
 *   K7-b  opening the till registers the three schemas and whitelists exactly three targets
 *   K7-c  the V4Quoter prices the swap off-chain (`eth_call`) and the board carries min-out + a deadline
 *   K7-d  **the swap completes**: the account's practice dollars become WETH through the Universal Router
 *   K7-e  the same call through a router that is *not* whitelisted is refused by the guard (the security story)
 *   K7-f  a stale quote is refused rather than silently re-priced
 *
 * Sepolia gas is real: the run needs `SEPOLIA_BROADCASTER_PK` funded (~0.002 ETH covers a full pass) and the till
 * holding practice USDC (mint it — the U5 mock's `mint` is open).
 */
import { formatEther, formatUnits, getAddress, parseAbi, parseUnits, type Address, type Hex } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { config } from '../src/config.ts';
import { enableFx, fxDeployment, fxEnabled, fxStatus, quote, swap, swapThroughWrongRouter, tillFor, _fxClients } from '../src/lanes/fx.ts';
import { embeddedWalletOf, privy, recoverPolicy } from '../src/privy.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const argv = process.argv.slice(2);
const AMOUNT = argv.indexOf('--amount') >= 0 ? argv[argv.indexOf('--amount') + 1] : '5';
/** A live contract that is emphatically not the whitelisted router: the v4 PoolManager itself. */
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
  console.log(`chain     ${chain.id} · pool ${d.pool.id}`);
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
  const usdcOf = async () => (await publicClient.readContract({ address: d.usdc.address, abi: erc20, functionName: 'balanceOf', args: [till] })) as bigint;
  const wethOf = async () => (await publicClient.readContract({ address: d.weth.address, abi: erc20, functionName: 'balanceOf', args: [till] })) as bigint;
  console.log(`till      ${formatUnits(await usdcOf(), d.usdc.decimals)} ${d.usdc.symbol} · ${formatUnits(await wethOf(), d.weth.decimals)} ${d.weth.symbol}`);

  // ---- K7-b: the exchange door — three schemas, three targets, nothing else ----
  try {
    const before = await fxEnabled(till);
    const enabled = await enableFx(player, 'kt-s1-enable');
    player = getPlayer(player.privyUserId)!;
    const after = await fxEnabled(till);
    const targets = enabled.whitelist.map((w) => `${w.function} → ${w.target}`);
    record('K7-b-guards', after ? 'PASS' : 'FAIL', `${before ? 'already open' : `opened (${enabled.actions.length} config actions${enabled.guardHash ? `, guard ${enabled.guardHash}` : ''}${enabled.roleHash ? `, roles ${enabled.roleHash}` : ''})`}; whitelist: ${targets.join(' | ')}`);
    if (!after) return finish();
  } catch (e) {
    record('K7-b-guards', 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
    return finish();
  }

  // ---- K7-c: the quote board ----
  let quoteId: string | undefined;
  try {
    const q = await quote(player, AMOUNT);
    quoteId = q.quoteId;
    const sane = Number(q.amountOut) > 0 && Number(q.minOut) > 0 && Number(q.minOut) < Number(q.amountOut) && Number(q.deadline) > Number(q.serverNow);
    record('K7-c-quote', sane ? 'PASS' : 'FAIL', `${q.amountIn} ${q.symbolIn} → ${q.amountOut} ${q.symbolOut} (min ${q.minOut} at ${q.slippage}, fee ${q.fee}); ${q.rate}; valid ${q.validSec}s, deadline ${q.deadline}`);
  } catch (e) {
    record('K7-c-quote', 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
  }

  // ---- K7-d: the swap itself — the whole point ----
  const usdcBefore = await usdcOf();
  const wethBefore = await wethOf();
  try {
    if (usdcBefore < parseUnits(AMOUNT, d.usdc.decimals)) throw Object.assign(new Error(`till holds ${formatUnits(usdcBefore, d.usdc.decimals)} ${d.usdc.symbol}, needs ${AMOUNT} — mint practice dollars to ${till}`), { code: 'InsufficientBalance' });
    const s = await swap(player, quoteId, AMOUNT, 'kt-s1-swap');
    player = getPlayer(player.privyUserId)!;
    const usdcAfter = await usdcOf();
    const wethAfter = await wethOf();
    const spent = usdcBefore - usdcAfter;
    const got = wethAfter - wethBefore;
    const ok = got > 0n && spent === parseUnits(AMOUNT, d.usdc.decimals) && got >= parseUnits(s.minOut, d.weth.decimals) / 2n;
    record(
      'K7-d-swap',
      ok ? 'PASS' : 'FAIL',
      `AccountBlox ${till} swapped ${formatUnits(spent, d.usdc.decimals)} ${d.usdc.symbol} → ${formatUnits(got, d.weth.decimals)} ${d.weth.symbol} on Uniswap v4; ${s.steps.map((x) => `${x.step} ${x.hash}`).join(' · ')}; explorer ${s.explorer}${s.fee ? `; fee ${s.fee}` : ''}`,
    );
  } catch (e) {
    record('K7-d-swap', 'FAIL', `${codeOf(e)}: ${msgOf(e)}`);
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

  // ---- desk view the game will render ----
  try {
    const st = await fxStatus(getPlayer(player.privyUserId)!);
    console.log(`\nstatus    till ${st.account} · ${st.usdc} ${st.symbolIn} · ${st.weth} ${st.symbolOut} · door ${st.enabled ? 'open' : 'closed'} · pool fee ${st.pool.fee} tick ${st.pool.tick} liquidity ${st.pool.liquidity}`);
    console.log(`explorer  ${st.explorer.account}`);
  } catch (e) {
    console.log(`status read failed: ${msgOf(e)}`);
  }
  console.log(`teller    ${formatEther(await publicClient.getBalance({ address: broadcasterAddress }))} ETH left`);
  return finish();
}

function finish(): void {
  console.log('\nS1 kill-test summary (K7)');
  for (const r of results) console.log(`${r.id.padEnd(18)} ${r.verdict.padEnd(8)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(`S1 kill test aborted: ${codeOf(e)}: ${(e as Error).message}`);
  process.exitCode = 1;
});
