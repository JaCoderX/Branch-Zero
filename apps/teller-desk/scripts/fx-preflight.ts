/**
 * FX preflight (read-only): what the FX teller can pay for, what the till holds in USD / EUR / ILS, both fiat pools'
 * state, and whether the exchange door is open on chain. Sends nothing. Run before `killtests:s1` so a dry teller is
 * a sentence, not a burned fee.
 *
 *   npm -w apps/teller-desk run fx:preflight
 *
 * Fiat pairs (2026-09-09): the door is the same three schemas / three targets it was for the WETH desk — one-way
 * USD → fiat approves only the practice dollar — so a till opened before the fiat pools needs no new config batch.
 */
import { formatEther, formatUnits, parseAbi } from 'viem';
import { GuardController, RuntimeRBAC } from '@bloxchain/sdk';
import { config } from '../src/config.ts';
import { FX_FUNCTIONS, FX_PAIRS, FX_SELECTORS, fxDeployment, _fxClients } from '../src/lanes/fx.ts';
import { BROADCASTER_ROLE, OWNER_ROLE } from '../src/lanes/provision.ts';

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);
const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)',
]);

async function main(): Promise<void> {
  if (!config.sepoliaRpcUrl || !config.fx.broadcasterPk) throw new Error('SEPOLIA_RPC_URL and SEPOLIA_BROADCASTER_PK are required');
  const d = fxDeployment();
  const { publicClient, chain, broadcaster, broadcasterAddress } = _fxClients();
  const block = await publicClient.getBlock();
  const base = block.baseFeePerGas ?? 0n;
  const maxFee = (base * 108n) / 100n + 20_000_000n;
  const balance = await publicClient.getBalance({ address: broadcasterAddress });
  console.log(`chain     ${chain.id} · block ${block.number} · base ${formatUnits(base, 9)} gwei · maxFee ${formatUnits(maxFee, 9)} gwei`);
  console.log(`teller    ${broadcasterAddress} ${formatEther(balance)} ETH → ${(balance / maxFee).toString()} gas affordable`);
  for (const [label, want] of [
    ['guard batch (6)', 3_320_000n],
    ['role  batch (6)', 2_400_000n],
    ['swap  approve  ', 780_000n],
    ['swap  permit2  ', 790_000n],
    ['swap  execute  ', 1_200_000n],
  ] as const) {
    const cost = want * maxFee;
    console.log(`  ${label} want ${want.toString().padStart(9)} gas ≈ ${formatEther(cost)} ETH  ${balance >= cost ? 'OK' : 'SHORT'}`);
  }
  const full = (3_320_000n + 2_400_000n + 780_000n + 790_000n + 1_200_000n * 2n) * maxFee;
  console.log(`  full first pass (door + both pairs) ≈ ${formatEther(full)} ETH — teller ${balance >= full ? 'covers it' : `SHORT by ${formatEther(full - balance)} ETH`}`);

  for (const pair of FX_PAIRS) {
    const p = d.pairs[pair];
    const [slot0, liq] = await Promise.all([
      publicClient.readContract({ address: d.uniswap.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: [p.pool.id] }),
      publicClient.readContract({ address: d.uniswap.stateView, abi: stateViewAbi, functionName: 'getLiquidity', args: [p.pool.id] }),
    ]);
    console.log(`pool      USD/${pair} ${p.pool.id} · ${p.token.symbol} ${p.token.address} · USD is currency${p.usdIsCurrency0 ? 0 : 1} · tick ${slot0[1]} · liquidity ${liq} · seed ${p.seedRate} (${p.seedRateDate})`);
  }

  const till = d.fixtures[0]?.address;
  if (!till) return;
  const [usd, eur, ils] = await Promise.all([
    publicClient.readContract({ address: d.usdc.address, abi: erc20, functionName: 'balanceOf', args: [till] }),
    publicClient.readContract({ address: d.pairs.EUR.token.address, abi: erc20, functionName: 'balanceOf', args: [till] }),
    publicClient.readContract({ address: d.pairs.ILS.token.address, abi: erc20, functionName: 'balanceOf', args: [till] }),
  ]);
  console.log(`till      ${till} · ${formatUnits(usd, d.usdc.decimals)} ${d.usdc.symbol} · ${formatUnits(eur, 6)} EUR · ${formatUnits(ils, 6)} ILS`);

  const gc = new GuardController(publicClient, broadcaster, till, chain);
  const rbac = new RuntimeRBAC(publicClient, broadcaster, till, chain);
  const supported = new Set((await gc.getSupportedFunctions()).map((s: string) => s.toLowerCase()));
  for (const fn of FX_FUNCTIONS) {
    const sel = FX_SELECTORS[fn.key];
    const has = supported.has(sel.toLowerCase());
    const targets = has ? await gc.getFunctionWhitelistTargets(sel).catch(() => []) : [];
    console.log(`  schema ${fn.key.padEnd(8)} ${sel} ${has ? 'registered' : 'MISSING'} · whitelist [${(targets as string[]).join(', ') || '—'}]`);
  }
  for (const [role, name] of [[OWNER_ROLE, 'OWNER'], [BROADCASTER_ROLE, 'BROADCASTER']] as const) {
    const perms = (await rbac.getActiveRolePermissions(role)) as Array<{ functionSelector: string; grantedActionsBitmap: number | bigint }>;
    for (const fn of FX_FUNCTIONS) {
      const sel = FX_SELECTORS[fn.key];
      const cur = perms.find((p) => p.functionSelector.toLowerCase() === sel.toLowerCase());
      console.log(`  role   ${name.padEnd(11)} ${fn.key.padEnd(8)} ${cur ? `bitmap ${cur.grantedActionsBitmap}` : 'MISSING'}`);
    }
  }
}

main().catch((e) => {
  console.error(`preflight failed: ${(e as Error).message}`);
  process.exitCode = 1;
});
