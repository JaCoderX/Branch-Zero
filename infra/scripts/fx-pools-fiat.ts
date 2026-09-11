/**
 * FX fiat pairs — deploy Practice EUR + Practice ILS and seed two deep Uniswap v4 pools against the practice dollar
 * on Sepolia (docs/HANDOFF-fx-fiat-pairs.md §A, docs/UNISWAP.md §2b).
 *
 *   npm run fx:pools-fiat                      # idempotent: deploys / initialises / seeds only what is missing
 *   npm run fx:pools-fiat -- --dry             # plan only: rates, inventories, sqrtPrice, liquidity; sends nothing
 *   npm run fx:pools-fiat -- --rate-eur 0.86103 --rate-ils 3.0118 --rate-date 2026-09-08   # pin by hand (offline)
 *   npm run fx:pools-fiat -- --usd 50000000    # USD side per pool (display units); the fiat side follows the rate
 *
 * Two pools only for the product: USD/EUR and USD/ILS — fee 0.30 %, tick spacing 60, no hooks, one full-range
 * position each through the official PositionManager (MINT_POSITION + SETTLE_PAIR, paid through Permit2). Each pool is
 * seeded ≈ $100M TVL, 50/50 by value at the pinned mid-market rate: 50M USD + 50M×rate fiat. Every token is open-mint
 * practice money, so the depth is free; what the depth buys is a bank FX desk where Johnny's orders barely move the
 * price — the opposite of the old thin WETH pool, on purpose.
 *
 * Rates: Frankfurter (ECB reference, https://api.frankfurter.app/latest?from=USD&to=EUR,ILS) is read at run time and
 * frozen into sepolia.json as `seedRate` / `seedRateDate`; the desk never live-oracles a quote — the pool prices it.
 * If Frankfurter is unreachable, pass --rate-eur / --rate-ils / --rate-date. The handoff's 2026-09-08 pins are the
 * reference the script compares against and warns past 1 %.
 *
 * Address sort: the new tokens land wherever CREATE puts them, so USD may be currency1. Nothing here assumes a side;
 * `usdIsCurrency0` is recorded per pool and the desk (`lanes/fx.ts`) reads it for `zeroForOne`.
 *
 * Paid by `SEPOLIA_LP_PK` if set, else `SEPOLIA_DEPLOYER_PK` (the bank's mint key and the LP of the first pool), else
 * `ENS_REGISTRAR_PK`. Never a Ganache-parity key. Everything is hand-encoded with viem from the published
 * v4-periphery encodings (REFLECTION §8). Addresses land in infra/deployments/sepolia.json — public data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import solc from 'solc';
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
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { isGanacheParityAddress } from '@branch-zero/shared';
import { connect } from './lib/chain.ts';
import { loadEnv, env, DEPLOYMENTS_DIR, INFRA_DIR } from './lib/env.ts';
import { UNISWAP_SEPOLIA } from './lib/uniswap.ts';

loadEnv();
const argv = process.argv.slice(2);
const arg = (k: string, d: string) => (argv.indexOf(k) >= 0 ? argv[argv.indexOf(k) + 1] : d);
const DRY = argv.includes('--dry');

const FEE = 3000; // 0.30 %
const TICK_SPACING = 60;
const FULL_RANGE = 887220; // TickMath.MAX_TICK (887272) rounded down to a multiple of 60
const MINT_POSITION = 0x02;
const SETTLE_PAIR = 0x0d;
const RATE_DECIMALS = 6;

/** The handoff's reference pins (Frankfurter 2026-09-08). The live read is compared against these; >1 % is reported. */
const HANDOFF_PINS = { date: '2026-09-08', EUR: '0.86103', ILS: '3.0118' } as const;

interface PairSpec {
  key: 'usdEur' | 'usdIls';
  pair: 'EUR' | 'ILS';
  tokenKey: 'practiceEur' | 'practiceIls';
  name: string;
  symbol: string;
}
const PAIRS: PairSpec[] = [
  { key: 'usdEur', pair: 'EUR', tokenKey: 'practiceEur', name: 'Practice Euro', symbol: 'EUR' },
  { key: 'usdIls', pair: 'ILS', tokenKey: 'practiceIls', name: 'Practice Israeli Shekel', symbol: 'ILS' },
];

const erc20 = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function mint(address to, uint256 amount)',
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

// ---------------------------------------------------------------- rates

interface Pins {
  date: string;
  source: string;
  EUR: string;
  ILS: string;
}

async function pinRates(): Promise<Pins> {
  const eur = arg('--rate-eur', '');
  const ils = arg('--rate-ils', '');
  if (eur || ils) {
    if (!eur || !ils) throw new Error('--rate-eur and --rate-ils go together');
    return { date: arg('--rate-date', new Date().toISOString().slice(0, 10)), source: 'operator pin (--rate-eur/--rate-ils)', EUR: eur, ILS: ils };
  }
  const url = 'https://api.frankfurter.app/latest?from=USD&to=EUR,ILS';
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Frankfurter ${res.status} — pass --rate-eur/--rate-ils/--rate-date to pin by hand`);
  const j = (await res.json()) as { date: string; rates: { EUR: number; ILS: number } };
  if (!j?.rates?.EUR || !j?.rates?.ILS) throw new Error(`Frankfurter answered without EUR/ILS: ${JSON.stringify(j)}`);
  return { date: j.date, source: url, EUR: String(j.rates.EUR), ILS: String(j.rates.ILS) };
}

// ---------------------------------------------------------------- token compile (OpenZeppelin ERC-20, two overrides)

function compilePracticeFiat(): { abi: Abi; bytecode: Hex } {
  const src = fs.readFileSync(path.join(INFRA_DIR, 'contracts', 'PracticeFiat.sol'), 'utf8');
  const require = createRequire(import.meta.url);
  const findImports = (p: string) => {
    try {
      if (p.startsWith('@openzeppelin/')) return { contents: fs.readFileSync(require.resolve(p), 'utf8') };
      return { error: `unresolved import ${p}` };
    } catch (e) {
      return { error: `cannot read ${p}: ${(e as Error).message}` };
    }
  };
  const input = {
    language: 'Solidity',
    sources: { 'contracts/PracticeFiat.sol': { content: src } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: process.env.SOLC_EVM_VERSION ?? 'prague',
      metadata: { bytecodeHash: 'ipfs' },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports })) as {
    errors?: Array<{ severity: string; formattedMessage: string }>;
    contracts?: Record<string, Record<string, { abi: Abi; evm: { bytecode: { object: string } } }>>;
  };
  const errors = (out.errors ?? []).filter((e) => e.severity === 'error');
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join('\n'));
  const c = out.contracts?.['contracts/PracticeFiat.sol']?.PracticeFiat;
  if (!c) throw new Error('PracticeFiat did not compile');
  return { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` as Hex };
}

// ---------------------------------------------------------------- main

async function main() {
  const { chain, publicClient } = await connect('sepolia');
  const rawPk = (process.env.SEPOLIA_LP_PK || process.env.SEPOLIA_DEPLOYER_PK || env('ENS_REGISTRAR_PK')).trim();
  const account = privateKeyToAccount((rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) as Hex);
  if (isGanacheParityAddress(account.address)) throw new Error('refusing a Ganache-parity key on Sepolia');
  const wallet = createWalletClient({ account, chain, transport: http(env('SEPOLIA_RPC_URL')) });
  const head = await publicClient.getBlock();
  const fees = { maxPriorityFeePerGas: parseGwei('0.02'), maxFeePerGas: ((head.baseFeePerGas ?? parseGwei('1')) * 23n) / 20n + parseGwei('0.02') };

  const file = path.join(DEPLOYMENTS_DIR, 'sepolia.json');
  const dep = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
  if (dep.chainId !== chain.id) throw new Error(`${file} is for chain ${dep.chainId}`);
  const usd = getAddress(String(dep.tokens?.demoUsdc?.address ?? dep.mockUsdc));
  if (dep.tokens?.circleUsdc?.address && usd.toLowerCase() === String(dep.tokens.circleUsdc.address).toLowerCase()) {
    throw new Error('tokens.demoUsdc is Circle USDC — Circle USDC never enters a practice pool (HANDOFF-fx-fiat-pairs.md)');
  }
  const usdDecimals = Number(dep.tokens?.demoUsdc?.decimals ?? 6);
  if (usdDecimals !== 6) throw new Error(`practice dollar has ${usdDecimals} decimals; this script assumes 6 on both sides`);

  const pins = await pinRates();
  console.log(`lp        ${account.address}  ${formatUnits(await publicClient.getBalance({ address: account.address }), 18)} ETH${DRY ? '  (DRY RUN — nothing is sent)' : ''}`);
  console.log(`rates     ${pins.date} via ${pins.source}: 1 USD = ${pins.EUR} EUR · ${pins.ILS} ILS`);
  for (const p of PAIRS) {
    const live = Number(pins[p.pair]);
    const ref = Number(HANDOFF_PINS[p.pair]);
    const drift = Math.abs(live - ref) / ref;
    if (drift > 0.01) console.log(`          ! ${p.pair} moved ${(drift * 100).toFixed(2)} % from the handoff pin ${ref} (${HANDOFF_PINS.date}) — inventories below are recomputed from the live rate; record this in UNISWAP.md`);
  }

  const usdAmount = parseUnits(arg('--usd', '50000000'), 6);
  const usdBalance = await publicClient.readContract({ address: usd, abi: erc20, functionName: 'balanceOf', args: [account.address] });

  const send = async (label: string, tx: () => Promise<Hex>) => {
    if (DRY) {
      console.log(`${label.padEnd(26)} (dry)`);
      return undefined;
    }
    const hash = await tx();
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') throw new Error(`${label} reverted (${hash})`);
    console.log(`${label.padEnd(26)} ${hash}  gas ${r.gasUsed}`);
    return hash;
  };

  // ---- 1. tokens ----
  dep.tokens ??= {};
  let compiled: { abi: Abi; bytecode: Hex } | undefined;
  const tokenOf: Record<PairSpec['pair'], Address> = {} as never;
  for (const p of PAIRS) {
    const pinned = dep.tokens[p.tokenKey]?.address as string | undefined;
    if (pinned && (await publicClient.getCode({ address: getAddress(pinned) }))?.length! > 2) {
      tokenOf[p.pair] = getAddress(pinned);
      console.log(`token     ${p.symbol.padEnd(4)} ${tokenOf[p.pair]}  already deployed`);
      continue;
    }
    compiled ??= compilePracticeFiat();
    if (DRY) {
      console.log(`token     ${p.symbol.padEnd(4)} would deploy PracticeFiat("${p.name}", "${p.symbol}") — ${compiled.bytecode.length / 2 - 1} bytes`);
      tokenOf[p.pair] = '0x0000000000000000000000000000000000000000';
      continue;
    }
    const hash = await wallet.deployContract({ abi: compiled.abi, bytecode: compiled.bytecode, args: [p.name, p.symbol], ...fees });
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== 'success' || !r.contractAddress) throw new Error(`${p.symbol} deploy reverted (${hash})`);
    tokenOf[p.pair] = getAddress(r.contractAddress);
    console.log(`token     ${p.symbol.padEnd(4)} ${tokenOf[p.pair]}  deployed ${hash}  gas ${r.gasUsed}`);
    dep.tokens[p.tokenKey] = {
      address: tokenOf[p.pair],
      name: p.name,
      symbol: p.symbol,
      decimals: 6,
      deployTx: hash,
      deployedAtBlock: Number(r.blockNumber),
      deployer: account.address,
      source: 'infra/contracts/PracticeFiat.sol (OpenZeppelin ERC20 + open mint, 6 decimals)',
      note: `Practice ${p.pair}: open-mint, same family as tokens.demoUsdc. Johnny sells these for practice USD through uniswap.pools.${p.key}. Never real money.`,
    };
    fs.writeFileSync(file, JSON.stringify(dep, null, 2) + '\n');
  }

  // ---- 2. pools ----
  dep.uniswap ??= {};
  dep.uniswap.pools ??= {};
  let usdNeeded = 0n;
  for (const p of PAIRS) {
    const fiat = tokenOf[p.pair];
    const rateScaled = parseUnits(pins[p.pair], RATE_DECIMALS); // fiat per USD × 1e6
    const fiatAmount = (usdAmount * rateScaled) / 10n ** BigInt(RATE_DECIMALS); // both 6 dp → raw × raw / 1e6
    const [currency0, currency1] = usd.toLowerCase() < fiat.toLowerCase() ? [usd, fiat] : [fiat, usd];
    const usdIsCurrency0 = currency0 === usd;
    // price = currency1 per currency0 in raw units; both sides are 6 dp so the raw ratio is the display ratio.
    const priceX192 = usdIsCurrency0 ? (rateScaled << 192n) / 10n ** BigInt(RATE_DECIMALS) : (10n ** BigInt(RATE_DECIMALS) << 192n) / rateScaled;
    const sqrtPriceX96 = sqrtBig(priceX192);
    const key = { currency0, currency1, fee: FEE, tickSpacing: TICK_SPACING, hooks: '0x0000000000000000000000000000000000000000' as Address };
    const poolId = DRY && fiat === '0x0000000000000000000000000000000000000000' ? ('0x(after deploy)' as Hex) : keccak256(encodeAbiParameters(POOL_KEY, [key]));
    const amount0 = usdIsCurrency0 ? usdAmount : fiatAmount;
    const amount1 = usdIsCurrency0 ? fiatAmount : usdAmount;
    const liquidity = sqrtBig(amount0 * amount1); // full range: L ≈ sqrt(x·y)
    const tvlUsd = Number(formatUnits(usdAmount, 6)) * 2;
    console.log(`\npool      USD/${p.pair}  id ${poolId}`);
    console.log(`          currency0 ${currency0}${usdIsCurrency0 ? ' (USD)' : ` (${p.pair})`} · currency1 ${currency1}${usdIsCurrency0 ? ` (${p.pair})` : ' (USD)'} · fee ${FEE} spacing ${TICK_SPACING} · zeroForOne(USD→${p.pair}) = ${usdIsCurrency0}`);
    console.log(`          seed ${formatUnits(usdAmount, 6)} USD + ${formatUnits(fiatAmount, 6)} ${p.pair} @ ${pins[p.pair]} (≈ $${tvlUsd.toLocaleString()} TVL) · sqrtPriceX96 ${sqrtPriceX96} · liquidity ${liquidity}`);
    if (DRY) continue;

    const rec = (dep.uniswap.pools[p.key] ??= {}) as Record<string, any>;
    const slot0 = await publicClient.readContract({ address: UNISWAP_SEPOLIA.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: [poolId] });
    let initTx: Hex | undefined = rec.initTx;
    if (slot0[0] === 0n) {
      initTx = await send(`initialize ${p.pair}`, () => wallet.writeContract({ address: UNISWAP_SEPOLIA.poolManager, abi: poolManagerAbi, functionName: 'initialize', args: [key, sqrtPriceX96], ...fees }));
    } else console.log(`initialize ${p.pair}             already: sqrtPriceX96 ${slot0[0]} tick ${slot0[1]}`);

    const liquidityBefore = await publicClient.readContract({ address: UNISWAP_SEPOLIA.stateView, abi: stateViewAbi, functionName: 'getLiquidity', args: [poolId] });
    let seedTx: Hex | undefined = rec.seedTx;
    if (liquidityBefore === 0n || argv.includes('--add')) {
      // funds: open mint on both sides
      usdNeeded += usdAmount;
      const usdBal = await publicClient.readContract({ address: usd, abi: erc20, functionName: 'balanceOf', args: [account.address] });
      if (usdBal < usdAmount) await send(`usd.mint`, () => wallet.writeContract({ address: usd, abi: erc20, functionName: 'mint', args: [account.address, usdAmount - usdBal], ...fees }));
      const fiatBal = await publicClient.readContract({ address: fiat, abi: erc20, functionName: 'balanceOf', args: [account.address] });
      if (fiatBal < fiatAmount) await send(`${p.symbol.toLowerCase()}.mint`, () => wallet.writeContract({ address: fiat, abi: erc20, functionName: 'mint', args: [account.address, fiatAmount - fiatBal], ...fees }));
      // Permit2 path the PositionManager settles through
      for (const [name, token, amount] of [['usd', usd, usdAmount], [p.symbol.toLowerCase(), fiat, fiatAmount]] as const) {
        const allowance = await publicClient.readContract({ address: token, abi: erc20, functionName: 'allowance', args: [account.address, UNISWAP_SEPOLIA.permit2] });
        if (allowance < amount) await send(`${name}.approve(permit2)`, () => wallet.writeContract({ address: token, abi: erc20, functionName: 'approve', args: [UNISWAP_SEPOLIA.permit2, maxUint256], ...fees }));
        const [p2amount, p2exp] = await publicClient.readContract({ address: UNISWAP_SEPOLIA.permit2, abi: permit2Abi, functionName: 'allowance', args: [account.address, token, UNISWAP_SEPOLIA.positionManager] });
        if (p2amount < amount || p2exp < head.timestamp + 3600n) {
          await send(`permit2.approve(${name})`, () => wallet.writeContract({ address: UNISWAP_SEPOLIA.permit2, abi: permit2Abi, functionName: 'approve', args: [token, UNISWAP_SEPOLIA.positionManager, maxUint160, Number(head.timestamp) + 30 * 24 * 3600], ...fees }));
        }
      }
      const actions = encodePacked(['uint8', 'uint8'], [MINT_POSITION, SETTLE_PAIR]);
      const mintParams = encodeAbiParameters(parseAbiParameters('(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks), int24, int24, uint256, uint128, uint128, address, bytes'), [
        key,
        -FULL_RANGE,
        FULL_RANGE,
        liquidity,
        (amount0 * 101n) / 100n,
        (amount1 * 101n) / 100n,
        account.address,
        '0x',
      ]);
      const settleParams = encodeAbiParameters(parseAbiParameters('address, address'), [currency0, currency1]);
      const unlockData = encodeAbiParameters(parseAbiParameters('bytes, bytes[]'), [actions, [mintParams, settleParams]]);
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + 1200n;
      seedTx = await send(`posm.modifyLiquidities ${p.pair}`, () => wallet.writeContract({ address: UNISWAP_SEPOLIA.positionManager, abi: posmAbi, functionName: 'modifyLiquidities', args: [unlockData, deadline], ...fees }));
    } else console.log(`liquidity ${p.pair}              already: ${liquidityBefore}`);

    const after = await publicClient.readContract({ address: UNISWAP_SEPOLIA.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: [poolId] });
    const liq = await publicClient.readContract({ address: UNISWAP_SEPOLIA.stateView, abi: stateViewAbi, functionName: 'getLiquidity', args: [poolId] });
    console.log(`state     ${p.pair} sqrtPriceX96 ${after[0]}  tick ${after[1]}  lpFee ${after[3]}  liquidity ${liq}`);

    // ---- record ----
    Object.assign(rec, {
      pair: p.pair,
      product: `USD → ${p.pair} (one-way in v1)`,
      id: poolId,
      currency0,
      currency1,
      fee: FEE,
      tickSpacing: TICK_SPACING,
      hooks: key.hooks,
      usdIsCurrency0,
      zeroForOne: `USD → ${p.pair} is zeroForOne = ${usdIsCurrency0}`,
      usd,
      fiat,
      seedRate: pins[p.pair],
      seedRateDate: pins.date,
      seedRateSource: pins.source,
      seedInventory: { usd: formatUnits(usdAmount, 6), [p.pair.toLowerCase()]: formatUnits(fiatAmount, 6) },
      seedTvlUsd: tvlUsd,
      seededAt: rec.seededAt ?? new Date().toISOString().slice(0, 10),
      sqrtPriceX96: after[0].toString(),
      liquidity: liq.toString(),
      lp: account.address,
      ...(initTx ? { initTx } : {}),
      ...(seedTx ? { seedTx } : {}),
    });
    fs.writeFileSync(file, JSON.stringify(dep, null, 2) + '\n');
  }
  if (DRY) {
    console.log(`\ndry run: LP holds ${formatUnits(usdBalance, 6)} practice USD; would mint the rest (open mint). Nothing sent.`);
    return;
  }

  // ---- 3. product path: fiat only; the WETH pool stays on chain but leaves the desk ----
  dep.uniswap.productPath = 'USD → EUR | USD → ILS, one-way (uniswap.pools.usdEur / usdIls). The demo USDC/WETH pool below is deprecated for the product: left on chain, no longer quoted (2026-09-09, docs/HANDOFF-fx-fiat-pairs.md).';
  if (dep.uniswap.pool) dep.uniswap.pool.deprecated = 'product stopped quoting WETH on 2026-09-09 — fiat pairs live in uniswap.pools';
  if (dep.tokens.weth) dep.tokens.weth.note = 'Sepolia WETH9 used by the Uniswap deployments — deprecated for the product on 2026-09-09 (fiat pairs replaced the WETH demo); left pinned for the on-chain history';
  dep.tokens.demoUsdc = { ...(dep.tokens.demoUsdc ?? {}), address: usd, symbol: 'USDC', decimals: 6, note: 'U5 Sepolia mock USDC (open mint) — the practice dollar. Johnny sells it for Practice EUR / ILS through uniswap.pools' };
  dep.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(dep, null, 2) + '\n');
  console.log(`\nwrote     ${path.relative(process.cwd(), file)} (tokens.practiceEur/practiceIls, uniswap.pools, productPath)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
