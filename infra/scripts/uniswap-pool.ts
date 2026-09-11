/**
 * S1 — seed the FX desk's original Uniswap v4 pool on Sepolia (docs/UNISWAP.md §5 step 2).
 *
 * **Deprecated for the product on 2026-09-09.** Johnny now sells practice USD for Practice EUR / ILS through the two
 * fiat pools `fx-pools-fiat.ts` seeds (`npm run fx:pools-fiat`); this WETH pool stays on chain as history and is no
 * longer quoted. The script is kept runnable and idempotent so the record stays honest.
 *
 *   npm -w infra run fx:pool                 # idempotent: initialises + mints only what is missing
 *   npm -w infra run fx:pool -- --weth 0.006 --usdc 12   # liquidity to add (display units)
 *
 * The pool is demo USDC (the U5 Sepolia mock, 6 decimals, open `mint`) against Sepolia WETH9, fee 0.30 %,
 * tick spacing 60, no hook — plain v4, exactly what the Universal Router's V4_SWAP command expects. One
 * full-range position is minted through the official PositionManager (MINT_POSITION + SETTLE_PAIR, paid
 * through Permit2), so the pool has depth on both sides for Johnny's quotes and swaps.
 *
 * Paid by `SEPOLIA_LP_PK` if set, else `ENS_REGISTRAR_PK` (the only funded Sepolia key on the laptop; it is the
 * bank's key, holds no role on any player account, and the LP position is the bank's). Never a Ganache-parity key.
 * Everything is hand-encoded with viem from the published v4-periphery encodings; no Uniswap npm package is added
 * (REFLECTION §8). Addresses written to infra/deployments/sepolia.json `uniswap` — public data.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  createWalletClient,
  encodeAbiParameters,
  encodePacked,
  formatUnits,
  getAddress,
  http,
  keccak256,
  maxUint160,
  maxUint256,
  parseAbi,
  parseAbiParameters,
  parseGwei,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { isGanacheParityAddress } from '@branch-zero/shared';
import { connect } from './lib/chain.ts';
import { loadEnv, env, DEPLOYMENTS_DIR } from './lib/env.ts';
import { UNISWAP_SEPOLIA } from './lib/uniswap.ts';

loadEnv();
const argv = process.argv.slice(2);
const arg = (k: string, d: string) => (argv.indexOf(k) >= 0 ? argv[argv.indexOf(k) + 1] : d);

export { UNISWAP_SEPOLIA };

const FEE = 3000; // 0.30 %
const TICK_SPACING = 60;
const FULL_RANGE = 887220; // TickMath.MAX_TICK (887272) rounded down to a multiple of 60
/** Practice rate: 1 ETH = 2,000 practice dollars. It only fixes the seed ratio; the pool prices every swap. */
const USDC_PER_ETH = 2000n;

// v4-periphery Actions.sol / universal-router Commands.sol (read 2026-09-08)
const MINT_POSITION = 0x02;
const SETTLE_PAIR = 0x0d;

const erc20 = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function mint(address to, uint256 amount)',
  'function deposit() payable',
]);
const permit2Abi = parseAbi([
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
]);
const poolManagerAbi = parseAbi(['function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) returns (int24 tick)']);
const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)',
]);
const posmAbi = parseAbi(['function modifyLiquidities(bytes unlockData, uint256 deadline) payable']);

const POOL_KEY = parseAbiParameters('(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)');

function sqrtBig(n: bigint): bigint {
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  for (let i = 0; i < 64; i++) {
    const nx = (x + n / x) >> 1n;
    if (nx === x || nx === x - 1n || nx === x + 1n) {
      x = nx;
      break;
    }
    x = nx;
  }
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}

async function main() {
  const { chain, publicClient } = await connect('sepolia');
  const rawPk = (process.env.SEPOLIA_LP_PK || env('ENS_REGISTRAR_PK')).trim();
  const account = privateKeyToAccount((rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) as Hex);
  if (isGanacheParityAddress(account.address)) throw new Error('refusing a Ganache-parity key on Sepolia');
  const wallet = createWalletClient({ account, chain, transport: http(env('SEPOLIA_RPC_URL')) });
  const head = await publicClient.getBlock();
  const fees = { maxPriorityFeePerGas: parseGwei('0.02'), maxFeePerGas: ((head.baseFeePerGas ?? parseGwei('1')) * 23n) / 20n + parseGwei('0.02') };

  const file = path.join(DEPLOYMENTS_DIR, 'sepolia.json');
  const dep = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
  if (dep.chainId !== chain.id) throw new Error(`${file} is for chain ${dep.chainId}`);
  const usdc = getAddress(String(dep.mockUsdc ?? dep.tokens?.demoUsdc?.address));
  const weth = getAddress(UNISWAP_SEPOLIA.weth);
  const [currency0, currency1] = usdc.toLowerCase() < weth.toLowerCase() ? [usdc, weth] : [weth, usdc];
  if (currency0 !== usdc) throw new Error('expected demo USDC to sort as currency0 — the desk assumes zeroForOne = USDC → WETH');
  const key = { currency0, currency1, fee: FEE, tickSpacing: TICK_SPACING, hooks: '0x0000000000000000000000000000000000000000' as Address };
  const poolId = keccak256(encodeAbiParameters(POOL_KEY, [key]));
  console.log(`lp        ${account.address}  ${formatUnits(await publicClient.getBalance({ address: account.address }), 18)} ETH`);
  console.log(`pool      USDC ${usdc} / WETH ${weth}  fee ${FEE} spacing ${TICK_SPACING}  id ${poolId}`);

  const wethAmount = parseUnits(arg('--weth', '0.006'), 18);
  const usdcAmount = (wethAmount * USDC_PER_ETH) / 10n ** 12n; // 18 → 6 decimals at the practice rate
  // price = token1 per token0 in raw units = (WETH raw per USDC raw) = 1e18 / (USDC_PER_ETH * 1e6)
  const priceX192 = (10n ** 18n << 192n) / (USDC_PER_ETH * 10n ** 6n);
  const sqrtPriceX96 = sqrtBig(priceX192);

  const send = async (label: string, tx: () => Promise<Hex>) => {
    const hash = await tx();
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') throw new Error(`${label} reverted (${hash})`);
    console.log(`${label.padEnd(22)} ${hash}  gas ${r.gasUsed}`);
    return hash;
  };

  // ---- 1. pool initialised? ----
  const slot0 = await publicClient.readContract({ address: UNISWAP_SEPOLIA.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: [poolId] });
  let initTx: Hex | undefined = dep.uniswap?.pool?.initTx;
  if (slot0[0] === 0n) {
    initTx = await send('initialize', () => wallet.writeContract({ address: UNISWAP_SEPOLIA.poolManager, abi: poolManagerAbi, functionName: 'initialize', args: [key, sqrtPriceX96], ...fees }));
  } else console.log(`initialize             already: sqrtPriceX96 ${slot0[0]} tick ${slot0[1]}`);

  // ---- 2. liquidity ----
  const liquidityBefore = await publicClient.readContract({ address: UNISWAP_SEPOLIA.stateView, abi: stateViewAbi, functionName: 'getLiquidity', args: [poolId] });
  let seedTx: Hex | undefined = dep.uniswap?.pool?.seedTx;
  if (liquidityBefore === 0n || argv.includes('--add')) {
    // funds: mint practice dollars (open mint on the U5 mock), wrap ETH
    const usdcBal = await publicClient.readContract({ address: usdc, abi: erc20, functionName: 'balanceOf', args: [account.address] });
    if (usdcBal < usdcAmount) await send('usdc.mint', () => wallet.writeContract({ address: usdc, abi: erc20, functionName: 'mint', args: [account.address, usdcAmount - usdcBal], ...fees }));
    const wethBal = await publicClient.readContract({ address: weth, abi: erc20, functionName: 'balanceOf', args: [account.address] });
    if (wethBal < wethAmount) await send('weth.deposit', () => wallet.writeContract({ address: weth, abi: erc20, functionName: 'deposit', value: wethAmount - wethBal, ...fees }));
    // Permit2 path the PositionManager settles through
    for (const [name, token, amount] of [['usdc', usdc, usdcAmount], ['weth', weth, wethAmount]] as const) {
      const allowance = await publicClient.readContract({ address: token, abi: erc20, functionName: 'allowance', args: [account.address, UNISWAP_SEPOLIA.permit2] });
      if (allowance < amount) await send(`${name}.approve(permit2)`, () => wallet.writeContract({ address: token, abi: erc20, functionName: 'approve', args: [UNISWAP_SEPOLIA.permit2, maxUint256], ...fees }));
      const [p2amount, p2exp] = await publicClient.readContract({ address: UNISWAP_SEPOLIA.permit2, abi: permit2Abi, functionName: 'allowance', args: [account.address, token, UNISWAP_SEPOLIA.positionManager] });
      if (p2amount < amount || p2exp < head.timestamp + 3600n) {
        await send(`permit2.approve(${name})`, () => wallet.writeContract({ address: UNISWAP_SEPOLIA.permit2, abi: permit2Abi, functionName: 'approve', args: [token, UNISWAP_SEPOLIA.positionManager, maxUint160, Number(head.timestamp) + 30 * 24 * 3600], ...fees }));
      }
    }
    // full range: L ≈ sqrt(x·y); the *Max caps carry 1 % headroom for rounding
    const liquidity = sqrtBig(usdcAmount * wethAmount);
    const actions = encodePacked(['uint8', 'uint8'], [MINT_POSITION, SETTLE_PAIR]);
    const mintParams = encodeAbiParameters(parseAbiParameters('(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks), int24, int24, uint256, uint128, uint128, address, bytes'), [
      key,
      -FULL_RANGE,
      FULL_RANGE,
      liquidity,
      (usdcAmount * 101n) / 100n,
      (wethAmount * 101n) / 100n,
      account.address,
      '0x',
    ]);
    const settleParams = encodeAbiParameters(parseAbiParameters('address, address'), [currency0, currency1]);
    const unlockData = encodeAbiParameters(parseAbiParameters('bytes, bytes[]'), [actions, [mintParams, settleParams]]);
    const deadline = head.timestamp + 1200n;
    seedTx = await send('posm.modifyLiquidities', () => wallet.writeContract({ address: UNISWAP_SEPOLIA.positionManager, abi: posmAbi, functionName: 'modifyLiquidities', args: [unlockData, deadline], ...fees }));
  } else console.log(`liquidity              already: ${liquidityBefore}`);

  const after = await publicClient.readContract({ address: UNISWAP_SEPOLIA.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: [poolId] });
  const liquidity = await publicClient.readContract({ address: UNISWAP_SEPOLIA.stateView, abi: stateViewAbi, functionName: 'getLiquidity', args: [poolId] });
  console.log(`state     sqrtPriceX96 ${after[0]}  tick ${after[1]}  lpFee ${after[3]}  liquidity ${liquidity}`);

  // ---- 3. record ----
  dep.tokens ??= {};
  dep.tokens.demoUsdc = { ...(dep.tokens.demoUsdc ?? {}), address: usdc, symbol: 'USDC', decimals: 6 };
  dep.tokens.weth = { ...(dep.tokens.weth ?? {}), address: weth, symbol: 'WETH', decimals: 18 };
  // Merge, never replace: `uniswap.pools` (the fiat pairs, fx-pools-fiat.ts) and `productPath` live beside this pool.
  dep.uniswap = {
    ...(dep.uniswap ?? {}),
    source: 'https://developers.uniswap.org/contracts/v4/deployments',
    readAt: '2026-09-08',
    poolManager: UNISWAP_SEPOLIA.poolManager,
    universalRouter: UNISWAP_SEPOLIA.universalRouter,
    positionManager: UNISWAP_SEPOLIA.positionManager,
    stateView: UNISWAP_SEPOLIA.stateView,
    quoter: UNISWAP_SEPOLIA.quoter,
    permit2: UNISWAP_SEPOLIA.permit2,
    pool: {
      ...(dep.uniswap?.pool ?? {}),
      id: poolId,
      currency0,
      currency1,
      fee: FEE,
      tickSpacing: TICK_SPACING,
      hooks: key.hooks,
      zeroForOne: 'USDC → WETH',
      practiceRate: `1 ETH = ${USDC_PER_ETH} USDC at seeding`,
      sqrtPriceX96: after[0].toString(),
      liquidity: liquidity.toString(),
      lp: dep.uniswap?.pool?.lp ?? account.address,
      ...(initTx ? { initTx } : {}),
      ...(seedTx ? { seedTx } : {}),
    },
  };
  dep.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(dep, null, 2) + '\n');
  console.log(`wrote     ${path.relative(process.cwd(), file)} (uniswap section)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
