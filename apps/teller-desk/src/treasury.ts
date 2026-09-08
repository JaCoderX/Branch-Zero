/**
 * Sepolia ops treasury — the engine (docs/SEPOLIA-TREASURY.md).
 *
 * Faucets fill one Live-wing wallet; this moves ETH from it to the staff wallets that hold the bank's
 * on-chain duties, filling each to `need × 1.25` when it falls below `need`. The arithmetic lives in
 * `@branch-zero/shared` (`planTopUps`) so the read-only funding report, the CLI dry-run and the background
 * watcher cannot disagree about what is owed. What lives *here* is everything that touches the chain, the
 * key or the clock:
 *
 *   - reading balances (treasury ETH, Circle USDC, practice USDC, every staff EOA);
 *   - the caps and the rolling-hour ledger, so a loop cannot drain the float;
 *   - the refusals: a lab key, a token that is not the practice token, a treasury that shares a key with a
 *     staff role, a wing that is not Live.
 *
 * Three deliberate non-features:
 *
 *   1. **No custom contract.** EOA transfers are enough, so the treasury adds no Solidity and no approvals.
 *   2. **Nothing writes from `/healthz`.** An unauthenticated GET that moved money would be a gas-drain
 *      vector wearing a health check. Health *reports*; the writers are the CLI, the pre-`cloneBlox` hook
 *      and the interval watcher.
 *   3. **Circle's USDC is never sent.** It is collected and displayed. Any request to transfer that token is
 *      refused by address, because "the USDC in the treasury" means two different tokens and a wrong guess
 *      would silently spend the wrong one (docs/SEPOLIA-TREASURY.md §3).
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatUnits, getAddress, parseEther, parseUnits, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  CIRCLE_USDC_DECIMALS,
  CIRCLE_USDC_SEPOLIA,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_STAFF_NEEDS,
  erc20Abi,
  fmtEth,
  needWeiFor,
  planTopUps,
  targetWei,
  type StaffBalance,
  type StaffRole,
  type TopUpCaps,
  type TopUpPlan,
} from '@branch-zero/shared';
import { chain, deployerAddress, broadcasterAddress, managerAddress, publicClient, treasury, treasuryAddress } from './chain.ts';
import { config, deployments, REPO_ROOT } from './config.ts';

export interface TreasuryProblem {
  code: 'NOT_LIVE' | 'NOT_CONFIGURED' | 'ROLE_REUSE' | 'TOKEN_MISMATCH';
  message: string;
}

/** Roles whose key this process can see, so the report can say "not configured" rather than guess. */
function staffAddresses(): Map<StaffRole, Address> {
  const out = new Map<StaffRole, Address>();
  out.set('deployer', deployerAddress);
  out.set('broadcaster', broadcasterAddress);
  if (managerAddress) out.set('manager', managerAddress);
  // The registrar's key belongs to the Name Desk, which builds its own Sepolia client. Only the derived
  // address is needed here, and it is never logged.
  const raw = (config.ensRegistrarPk ?? '').trim();
  if (raw) out.set('registrar', privateKeyToAccount((raw.startsWith('0x') ? raw : `0x${raw}`) as Hex).address);
  return out;
}

/**
 * Which address the treasury *is*, whether or not this process holds its key. `SEPOLIA_TREASURY_ADDRESS`
 * exists so an operator can watch a treasury from a desk that cannot spend it.
 */
export function treasuryView(): Address | undefined {
  return treasuryAddress ?? (config.treasury.address ? getAddress(config.treasury.address) : undefined);
}

/**
 * The refusals, in one place, so the CLI, the desk and the tests give the same answer.
 * Returns `undefined` when the treasury may act.
 */
export function treasuryProblem(): TreasuryProblem | undefined {
  if (config.target !== 'sepolia') {
    return { code: 'NOT_LIVE', message: `the ops treasury is Live/Sepolia only; this desk is ${config.mode} (chain ${config.chainId})` };
  }
  const address = treasuryView();
  if (!address) {
    return { code: 'NOT_CONFIGURED', message: 'SEPOLIA_TREASURY_PK is not set — fund the faucet drops to a treasury address first (docs/SEPOLIA-TREASURY.md §1)' };
  }
  const shared = [...staffAddresses()].filter(([, a]) => a.toLowerCase() === address.toLowerCase()).map(([role]) => role);
  if (shared.length && !config.treasury.allowRoleReuse) {
    return {
      code: 'ROLE_REUSE',
      message:
        `treasury ${address} is also the ${shared.join(' + ')} key — identity and float must stay separate ` +
        `(docs/SEPOLIA-TREASURY.md §1). Use a distinct throwaway, or set SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=on to accept the collapse for a demo.`,
    };
  }
  // The practice token and Circle's token are pinned in different files on purpose; if they ever agree,
  // one of the pins is wrong and every "USDC" number below would be ambiguous.
  const practice = deployments().token.address;
  if (practice.toLowerCase() === (CIRCLE_USDC_SEPOLIA as string).toLowerCase()) {
    return { code: 'TOKEN_MISMATCH', message: `sepolia.json practice token equals Circle's USDC ${CIRCLE_USDC_SEPOLIA} — refusing to treat one as the other` };
  }
  return undefined;
}

/**
 * Staff roles that share the treasury's key. Empty unless the operator opted into the collapse.
 *
 * Worth knowing when it is *not* empty: two senders then share one account, and the shared wallet's other
 * module (the Name Desk builds its own client) picks its nonce from `eth_getTransactionCount` independently.
 * A top-up issued while an ENS write is in flight can therefore collide on a nonce. That is a consequence of
 * the collapse, not of the treasury — one more reason the steady state is a distinct throwaway.
 */
export function collapsedRoles(): StaffRole[] {
  const address = treasuryView();
  if (!address) return [];
  return [...staffAddresses()].filter(([, a]) => a.toLowerCase() === address.toLowerCase()).map(([role]) => role);
}

export function caps(allowPartial = false): TopUpCaps {
  const reserve = parseEther(config.treasury.reserveEth);
  /**
   * When the operator has deliberately collapsed a staff role into the treasury (demo only), that role's own
   * target has to be reserved too — otherwise topping up the deployer would starve the very wallet whose
   * duty the treasury is standing in for.
   */
  const collapsedReserve = collapsedRoles().reduce((acc, role) => {
    const need = SEPOLIA_STAFF_NEEDS.find((n) => n.role === role);
    return need ? acc + targetWei(needWeiFor(need, process.env)) : acc;
  }, 0n);
  return {
    maxPerTxWei: parseEther(config.treasury.maxPerTxEth),
    maxPerHourWei: parseEther(config.treasury.maxPerHourEth),
    reserveWei: reserve + collapsedReserve,
    allowPartial,
  };
}

// ---------------------------------------------------------------------------------------------------
// The ledger: what this treasury has already sent, so the rolling-hour cap survives a restart and is
// shared by every writer (CLI, provisioning hook, watcher). Same discipline as the player index: a small
// git-ignored JSON file beside it, written synchronously, holding addresses and amounts — never a key.
// ---------------------------------------------------------------------------------------------------

const DATA_DIR = path.join(REPO_ROOT, 'apps', 'teller-desk', '.data');
const LEDGER_FILE = path.join(DATA_DIR, `treasury-${config.chainId}.json`);
const HOUR_MS = 60 * 60 * 1000;

export interface TreasurySend {
  at: number;
  role: StaffRole;
  to: Address;
  amountEth: string;
  hash: Hex;
  reason: string;
}

function readLedger(): TreasurySend[] {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')) as TreasurySend[];
  } catch {
    return [];
  }
}

function appendLedger(entry: TreasurySend): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Re-read before writing: the dev server, the CLI and the kill tests all share this file and each only
    // knows its own sends. Keep a day of history — enough to explain a drain, small enough to stay a file.
    const kept = [...readLedger(), entry].filter((e) => Date.now() - e.at < 24 * HOUR_MS);
    const tmp = `${LEDGER_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(kept, null, 2));
    fs.renameSync(tmp, LEDGER_FILE);
  } catch (e) {
    console.error('treasury ledger not persisted:', (e as Error).message);
  }
}

export function spentThisHourWei(): bigint {
  const since = Date.now() - HOUR_MS;
  return readLedger()
    .filter((e) => e.at >= since)
    .reduce((acc, e) => acc + parseEther(e.amountEth), 0n);
}

export function recentSends(limit = 5): TreasurySend[] {
  return readLedger()
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------------------------------
// Reading the till
// ---------------------------------------------------------------------------------------------------

export interface TreasurySnapshot {
  address?: Address;
  /** True when this process holds the key and could execute. */
  canExecute: boolean;
  problem?: TreasuryProblem;
  ethWei: bigint;
  /** Circle's faucet USDC — collected and displayed, never auto-sent. */
  circleUsdc: { address: Address; amount: string; decimals: number };
  /** The in-game open-mint practice token. A different token, kept a different column. */
  practiceUsdc: { address: Address; symbol: string; amount: string; decimals: number };
  staff: StaffBalance[];
  /** Staff slots this process has no key for, so nothing is silently omitted from the report. */
  unconfigured: StaffRole[];
  collapsed: StaffRole[];
  spentLastHourWei: bigint;
}

async function erc20Balance(token: Address, owner: Address): Promise<bigint> {
  return (await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }).catch(() => 0n)) as bigint;
}

/** One round of reads: the treasury's three balances plus every configured staff EOA. */
export async function snapshot(): Promise<TreasurySnapshot> {
  const address = treasuryView();
  const problem = treasuryProblem();
  const practice = deployments().token;
  const addresses = staffAddresses();
  const staff: StaffBalance[] = [];
  const unconfigured: StaffRole[] = [];

  const [ethWei, circle, practiceHeld] = address
    ? await Promise.all([publicClient.getBalance({ address }), erc20Balance(getAddress(CIRCLE_USDC_SEPOLIA), address), erc20Balance(practice.address, address)])
    : [0n, 0n, 0n];

  for (const need of SEPOLIA_STAFF_NEEDS) {
    const a = addresses.get(need.role);
    if (!a) {
      unconfigured.push(need.role);
      continue;
    }
    const needWei = needWeiFor(need, process.env);
    staff.push({ need, address: a, balanceWei: await publicClient.getBalance({ address: a }), needWei, targetWei: targetWei(needWei) });
  }

  return {
    address,
    canExecute: Boolean(treasuryAddress),
    problem,
    ethWei,
    circleUsdc: { address: getAddress(CIRCLE_USDC_SEPOLIA), amount: formatUnits(circle, CIRCLE_USDC_DECIMALS), decimals: CIRCLE_USDC_DECIMALS },
    practiceUsdc: { address: practice.address, symbol: practice.symbol, amount: formatUnits(practiceHeld, practice.decimals), decimals: practice.decimals },
    staff,
    unconfigured,
    collapsed: collapsedRoles(),
    spentLastHourWei: spentThisHourWei(),
  };
}

/** Snapshot + plan, with nothing sent. The dry-run and `/healthz` both stop here. */
export async function plan(opts: { allowPartial?: boolean } = {}): Promise<{ snapshot: TreasurySnapshot; plan: TopUpPlan }> {
  const snap = await snapshot();
  const p = planTopUps({
    treasury: snap.address ?? getAddress('0x0000000000000000000000000000000000000000'),
    treasuryBalanceWei: snap.ethWei,
    staff: snap.staff,
    caps: caps(opts.allowPartial ?? false),
    spentThisHourWei: snap.spentLastHourWei,
  });
  return { snapshot: snap, plan: p };
}

// ---------------------------------------------------------------------------------------------------
// Moving money
// ---------------------------------------------------------------------------------------------------

export interface TopUpResult {
  executed: boolean;
  snapshot: TreasurySnapshot;
  plan: TopUpPlan;
  sends: TreasurySend[];
  /** Why nothing was sent, when nothing was. */
  refused?: TreasuryProblem | { code: 'NOTHING_TO_DO' | 'TREASURY_SHORT'; message: string };
}

/**
 * Execute the plan. Every send is a plain value transfer from the treasury EOA, waited on, and written to
 * the ledger *before* the next one is planned against the hour cap.
 *
 * `reason` is recorded so a later drain can be explained: `cli`, `pre-cloneBlox`, `watch`.
 */
export async function topUp(opts: { execute: boolean; allowPartial?: boolean; reason: string }): Promise<TopUpResult> {
  const problem = treasuryProblem();
  const { snapshot: snap, plan: p } = await plan({ allowPartial: opts.allowPartial });
  if (problem) return { executed: false, snapshot: snap, plan: p, sends: [], refused: problem };
  if (!opts.execute || p.sends.length === 0) {
    return {
      executed: false,
      snapshot: snap,
      plan: p,
      sends: [],
      ...(p.sends.length === 0
        ? {
            refused: p.treasuryShort
              ? ({
                  code: 'TREASURY_SHORT',
                  message: `treasury holds ${fmtEth(snap.ethWei)} ETH; ${fmtEth(p.requiredWei)} ETH is needed to fill every shortfall to target — fund it at ${'https://cloud.google.com/application/web3/faucet/ethereum/sepolia'}`,
                } as const)
              : ({ code: 'NOTHING_TO_DO', message: 'every configured staff wallet is at or above its need' } as const),
          }
        : {}),
    };
  }
  if (!treasury || !treasuryAddress) {
    return { executed: false, snapshot: snap, plan: p, sends: [], refused: { code: 'NOT_CONFIGURED', message: 'this process holds no treasury key (SEPOLIA_TREASURY_ADDRESS is read-only)' } };
  }

  const sends: TreasurySend[] = [];
  for (const line of p.sends) {
    // Re-check the hour cap between sends: the ledger is shared, so another writer may have spent since
    // this plan was made. Stop rather than exceed it.
    if (spentThisHourWei() + line.sendWei > caps(opts.allowPartial).maxPerHourWei) break;
    const hash = await treasury.sendTransaction({ to: line.address, value: line.sendWei, chain, account: treasury.account! });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`treasury top-up to ${line.address} reverted (${hash})`);
    const entry: TreasurySend = { at: Date.now(), role: line.role, to: line.address, amountEth: fmtEth(line.sendWei, 18), hash, reason: opts.reason };
    appendLedger(entry);
    sends.push(entry);
  }
  return { executed: sends.length > 0, snapshot: await snapshot(), plan: p, sends };
}

/**
 * Practice-dollar float (docs/SEPOLIA-TREASURY.md §4.2), off unless `SEPOLIA_TREASURY_PRACTICE=on`.
 *
 * On Live the practice token is open-mint, so the deployer makes its own float and this path is ceremony —
 * which is why it is opt-in rather than removed: if a later unit closes the mint, the treasury already knows
 * how to hand over what it holds. Circle's USDC is refused here by address, whatever the policy says.
 */
export async function topUpPractice(opts: { execute: boolean }): Promise<{ executed: boolean; note: string; hash?: Hex }> {
  if (!config.treasury.practice) return { executed: false, note: 'practice-USDC float is off (SEPOLIA_TREASURY_PRACTICE=off); the deployer mints its own on the open-mint token' };
  const problem = treasuryProblem();
  if (problem) return { executed: false, note: problem.message };
  const token = deployments().token;
  if (token.address.toLowerCase() === (CIRCLE_USDC_SEPOLIA as string).toLowerCase()) {
    return { executed: false, note: `refusing: ${token.address} is Circle's USDC, which the treasury holds but never sends` };
  }
  const address = treasuryView();
  if (!address) return { executed: false, note: 'no treasury configured' };
  const need = parseUnits(config.treasury.practiceNeedUsdc, token.decimals);
  const target = (need * 5n) / 4n;
  const [held, deployerHas] = await Promise.all([erc20Balance(token.address, address), erc20Balance(token.address, deployerAddress)]);
  if (deployerHas >= need) return { executed: false, note: `deployer holds ${formatUnits(deployerHas, token.decimals)} ${token.symbol} ≥ need ${config.treasury.practiceNeedUsdc}` };
  const gap = target - deployerHas;
  if (!treasury || !treasuryAddress) return { executed: false, note: 'this process holds no treasury key (SEPOLIA_TREASURY_ADDRESS is read-only)' };
  if (held < gap) return { executed: false, note: `treasury holds ${formatUnits(held, token.decimals)} ${token.symbol}, needs ${formatUnits(gap, token.decimals)} — deployer should mint instead (open-mint token)` };
  if (!opts.execute) return { executed: false, note: `would transfer ${formatUnits(gap, token.decimals)} ${token.symbol} → deployer ${deployerAddress}` };
  const hash = await treasury.writeContract({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [deployerAddress, gap], chain, account: treasury.account! });
  await publicClient.waitForTransactionReceipt({ hash });
  return { executed: true, note: `transferred ${formatUnits(gap, token.decimals)} ${token.symbol} → deployer`, hash };
}

// ---------------------------------------------------------------------------------------------------
// Background paths
// ---------------------------------------------------------------------------------------------------

let lastAttempt = 0;
/** Floor between background attempts, whatever calls them. A busy Account Opening loop must not poll. */
const MIN_ATTEMPT_GAP_MS = 60_000;

/**
 * Best-effort top-up before an expensive operation, or on the watcher's tick.
 *
 * Never throws and never blocks the caller's real work: a Dev desk has no treasury, a Live desk may have an
 * empty one, and neither is a reason to refuse to open an account. The pre-flight that *does* fail loudly is
 * the one in `lanes/provision.ts` — `cloneBlox` still refuses to send undersized gas.
 */
export async function maybeTopUp(reason: string, log?: (o: Record<string, unknown>, msg: string) => void): Promise<TopUpResult | undefined> {
  if (config.target !== 'sepolia' || !config.treasury.auto || !treasuryAddress) return undefined;
  if (Date.now() - lastAttempt < MIN_ATTEMPT_GAP_MS) return undefined;
  lastAttempt = Date.now();
  try {
    const result = await topUp({ execute: true, reason });
    if (result.sends.length) {
      log?.({ sends: result.sends.map((s) => ({ role: s.role, to: s.to, eth: s.amountEth, hash: s.hash })), reason }, 'treasury topped up staff wallets');
    } else if (result.refused?.code === 'TREASURY_SHORT') {
      log?.({ reason, need: fmtEth(result.plan.requiredWei), held: fmtEth(result.snapshot.ethWei) }, `treasury is short: ${result.refused.message}`);
    }
    return result;
  } catch (e) {
    log?.({ reason, err: (e as Error).message }, 'treasury top-up failed (continuing)');
    return undefined;
  }
}

/** The interval watcher. Live-only, key-only, unref'd so it never holds the process open. */
export function startTreasuryWatch(log?: (o: Record<string, unknown>, msg: string) => void): NodeJS.Timeout | undefined {
  if (config.target !== 'sepolia' || !config.treasury.auto || !treasuryAddress) return undefined;
  if (chain.id !== SEPOLIA_CHAIN_ID) return undefined;
  const ms = Math.max(60, config.treasury.intervalSec) * 1000;
  const timer = setInterval(() => void maybeTopUp('watch', log), ms);
  timer.unref();
  return timer;
}

/** Compact, JSON-safe treasury block for `/healthz` and the desk-debug panel. Addresses and amounts only. */
export function serializeHealth(snap: TreasurySnapshot, p: TopUpPlan) {
  return {
    configured: Boolean(snap.address),
    canExecute: snap.canExecute,
    address: snap.address ?? null,
    auto: config.treasury.auto,
    problem: snap.problem ? { code: snap.problem.code, message: snap.problem.message } : null,
    collapsedRoles: snap.collapsed,
    eth: fmtEth(snap.ethWei),
    circleUsdc: { address: snap.circleUsdc.address, amount: snap.circleUsdc.amount, note: 'Circle faucet USDC — held, never auto-sent; NOT the in-game practice dollar' },
    practiceUsdc: { address: snap.practiceUsdc.address, symbol: snap.practiceUsdc.symbol, amount: snap.practiceUsdc.amount },
    marginLabel: '1.25',
    staff: snap.staff.map((s) => {
      const line = p.lines.find((l) => l.role === s.need.role);
      return {
        role: s.need.role,
        label: s.need.label,
        address: s.address,
        eth: fmtEth(s.balanceWei),
        needEth: fmtEth(s.needWei),
        targetEth: fmtEth(s.targetWei),
        short: s.balanceWei < s.needWei,
        wouldSendEth: line && line.sendWei > 0n ? fmtEth(line.sendWei) : null,
        skip: line?.skip ?? null,
        /** Set when this role is short but the treasury cannot cover it — the operator's shopping list. */
        deficitEth: line?.deficitWei ? fmtEth(line.deficitWei) : null,
      };
    }),
    unconfigured: snap.unconfigured,
    shortfalls: p.lines.filter((l) => l.balanceWei < l.needWei).length,
    plannedEth: fmtEth(p.totalWei),
    requiredEth: fmtEth(p.requiredWei),
    treasuryShort: p.treasuryShort,
    caps: { perTxEth: config.treasury.maxPerTxEth, perHourEth: config.treasury.maxPerHourEth, reserveEth: config.treasury.reserveEth, spentLastHourEth: fmtEth(snap.spentLastHourWei) },
    recent: recentSends(3).map((s) => ({ role: s.role, to: s.to, eth: s.amountEth, hash: s.hash, reason: s.reason, at: new Date(s.at).toISOString() })),
  };
}
