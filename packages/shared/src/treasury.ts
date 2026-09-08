import { formatEther, parseEther, type Address } from 'viem';

/**
 * Sepolia ops treasury — the need model (docs/SEPOLIA-TREASURY.md §4).
 *
 * One Live-wing wallet (`SEPOLIA_TREASURY_PK`) collects faucet ETH and USDC, then tops the bank's staff
 * wallets back up. This module is the *arithmetic* of that, and nothing else: no keys, no RPC, no fs. It is
 * shared so that the read-only funding report (`infra/scripts/sepolia-funding.ts`), the executable top-up
 * (`apps/teller-desk/src/treasury.ts`) and the desk's own health view all answer "what does this role need"
 * from the same table — a second copy of these numbers would drift the moment fees move.
 *
 * Two rules the whole unit rests on:
 *
 *   1. **Refill when below `need`, fill up to `need × 1.25`.** Refilling at the target would mean a transfer
 *      every time a role spent a single gwei; refilling *to* the target means the 25 % margin absorbs a fee
 *      spike or one extra operation before the treasury is asked again.
 *   2. **Identity ≠ gas float.** The treasury moves assets to wallets that already hold the on-chain roles.
 *      It never holds `OWNER` / `BROADCASTER` / `BRANCH_MANAGER` / ENS-registrar duties itself, so nothing
 *      here maps a role *name* to anything but a balance.
 */

/** Fixed by the principal. Only they change it (docs/SEPOLIA-TREASURY.md §4). */
export const TREASURY_MARGIN_NUM = 5n;
export const TREASURY_MARGIN_DEN = 4n;
/** For copy and reports: "need × 1.25". */
export const TREASURY_MARGIN_LABEL = '1.25';

/** Staff wallets the treasury may fund. `recovery` is deliberately absent — it is cold and never hot-funded. */
export type StaffRole = 'deployer' | 'broadcaster' | 'manager' | 'registrar';

export interface StaffNeed {
  role: StaffRole;
  /** Human label used in reports and the desk-debug panel. */
  label: string;
  /** Env slot holding this role's private key. The treasury never reads it — only its derived address. */
  envPk: string;
  /** Env slot an operator can use to override `needEth` for this role. */
  envNeed: string;
  /** Baseline need in ETH, as a decimal string (docs/SEPOLIA-TREASURY.md §4.1). */
  needEth: string;
  /** What that ETH actually buys, for the report. */
  pays: string;
  /** A role the Live wing can run without (Priority is optional). Still funded when configured. */
  optional?: boolean;
}

/**
 * Measured baselines, not optimism (docs/SEPOLIA-TREASURY.md §4.1):
 * `cloneBlox` is ~16.65 M gas — about 0.0425 ETH at the fees S2 measured — so the deployer's need is one
 * Account Opening plus a mint and a cushion. The others forward meta-txs or write records and are an order
 * of magnitude cheaper.
 */
export const SEPOLIA_STAFF_NEEDS: readonly StaffNeed[] = [
  {
    role: 'deployer',
    label: 'Live Main deployer',
    envPk: 'SEPOLIA_DEPLOYER_PK',
    envNeed: 'SEPOLIA_TREASURY_NEED_DEPLOYER_ETH',
    needEth: '0.048',
    pays: 'cloneBlox (~16.65M gas/account), practice-USDC mint, OWNER_GAS top-ups',
  },
  {
    role: 'broadcaster',
    label: 'Live Main broadcaster (+ FX teller)',
    envPk: 'SEPOLIA_BROADCASTER_PK',
    envNeed: 'SEPOLIA_TREASURY_NEED_BROADCASTER_ETH',
    needEth: '0.012',
    pays: 'every Lane A / config meta-tx, FX guard+role batches and swaps',
  },
  {
    role: 'manager',
    label: 'Branch Manager (Priority)',
    envPk: 'SEPOLIA_MANAGER_PK',
    envNeed: 'SEPOLIA_TREASURY_NEED_MANAGER_ETH',
    needEth: '0.008',
    pays: 'Priority submit / recall',
    optional: true,
  },
  {
    role: 'registrar',
    label: 'ENS registrar',
    envPk: 'ENS_REGISTRAR_PK',
    envNeed: 'SEPOLIA_TREASURY_NEED_REGISTRAR_ETH',
    needEth: '0.008',
    pays: 'claim / setAddr / setText under branchzero.eth',
  },
];

/**
 * Circle's test USDC on Sepolia (https://developers.circle.com/stablecoins/usdc-contract-addresses).
 *
 * **This is not the in-game practice dollar.** Gameplay balances are the open-mint demo token pinned in
 * `infra/deployments/sepolia.json` (`tokens.demoUsdc`). The two are pinned in different places on purpose:
 * a report that showed one under the other's name would be the silent swap the plan forbids, so the treasury
 * paths cross-check this constant against the deployment file and refuse a mismatch rather than pick a winner
 * (docs/SEPOLIA-TREASURY.md §3).
 */
export const CIRCLE_USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
export const CIRCLE_USDC_DECIMALS = 6;

export const ETH_FAUCET_URL = 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia';
export const USDC_FAUCET_URL = 'https://faucet.circle.com/';

/** `target = need × 1.25`, in wei, exactly (no float rounding). */
export function targetWei(needWei: bigint): bigint {
  return (needWei * TREASURY_MARGIN_NUM) / TREASURY_MARGIN_DEN;
}

/** Resolve one role's need from its baseline plus an optional env override, in wei. */
export function needWeiFor(need: StaffNeed, overrides: Record<string, string | undefined> = {}): bigint {
  const raw = overrides[need.envNeed];
  return parseEther(raw && raw.trim() ? raw.trim() : need.needEth);
}

export interface StaffBalance {
  need: StaffNeed;
  address: Address;
  balanceWei: bigint;
  needWei: bigint;
  targetWei: bigint;
}

export type SkipReason = 'funded' | 'is-treasury' | 'treasury-short';

export interface TopUpLine {
  role: StaffRole;
  label: string;
  address: Address;
  balanceWei: bigint;
  needWei: bigint;
  targetWei: bigint;
  /** What would be sent. `0n` when the line is a skip. */
  sendWei: bigint;
  /** Present only on a skip; `undefined` means "send this". */
  skip?: SkipReason;
  /** Set when a cap or the treasury's own floor reduced `sendWei` below `targetWei - balanceWei`. */
  clampedBy?: 'per-tx cap' | 'treasury balance';
  /**
   * On a `treasury-short` skip: how much *more* the treasury would have to hold for this line to go out,
   * after its reserve and the caps. Computed here so every report names the same number — recomputing
   * "how short are we" at each call site is how a report ends up saying `short by 0`.
   */
  deficitWei?: bigint;
}

export interface TopUpCaps {
  /** Largest single transfer. A bug that loops cannot move more than this per send. */
  maxPerTxWei: bigint;
  /** Largest total the treasury may send in a rolling hour, across every caller. */
  maxPerHourWei: bigint;
  /** Kept back for the treasury's own gas (and, when it shares a key with a staff role, that role's target). */
  reserveWei: bigint;
  /**
   * Allow a send that lands the role above `need` but below `target` when the treasury cannot fund the full
   * gap. Off by default: the plan's rule is stop on a funding blocker rather than dribble
   * (docs/SEPOLIA-TREASURY.md §6). A partial send never lands a role below `need`.
   */
  allowPartial: boolean;
}

/**
 * Cap defaults, owned here so the desk config, the CLI and the read-only report cannot drift apart.
 *
 * `perTx` is one Google Cloud drop: a single transfer can never move more than the faucet gives in a day.
 * `perHour` is roughly two of those, which covers "the deployer and the broadcaster both ran dry" and
 * nothing like a loop. `reserve` keeps the treasury able to pay for its own transfers (21,000 gas each).
 */
export const TREASURY_CAP_DEFAULTS = {
  perTxEth: '0.05',
  perHourEth: '0.12',
  reserveEth: '0.001',
} as const;

/** Read the caps from an env bag, falling back to `TREASURY_CAP_DEFAULTS`. */
export function capsFromEnv(env: Record<string, string | undefined>, opts: { allowPartial?: boolean; extraReserveWei?: bigint } = {}): TopUpCaps {
  const pick = (name: string, fallback: string) => {
    const v = env[name];
    return parseEther(v && v.trim() ? v.trim() : fallback);
  };
  return {
    maxPerTxWei: pick('SEPOLIA_TREASURY_MAX_TX_ETH', TREASURY_CAP_DEFAULTS.perTxEth),
    maxPerHourWei: pick('SEPOLIA_TREASURY_MAX_HOUR_ETH', TREASURY_CAP_DEFAULTS.perHourEth),
    reserveWei: pick('SEPOLIA_TREASURY_RESERVE_ETH', TREASURY_CAP_DEFAULTS.reserveEth) + (opts.extraReserveWei ?? 0n),
    allowPartial: opts.allowPartial ?? false,
  };
}

export interface TopUpPlan {
  lines: TopUpLine[];
  /** Lines that would actually send, in the order they would be sent (largest shortfall first). */
  sends: TopUpLine[];
  totalWei: bigint;
  /** Treasury balance minus reserve minus what this plan spends. */
  remainingWei: bigint;
  /** What the treasury would need to hold to satisfy every shortfall in full. */
  requiredWei: bigint;
  /** True when a role was skipped only because the treasury is too poor — the named funding blocker. */
  treasuryShort: boolean;
}

/**
 * Decide who gets what, given balances the caller has already read.
 *
 * Pure and total: no clock, no I/O, no randomness — which is what makes the dry-run a real rehearsal of the
 * execution rather than a second implementation of it. `spentThisHourWei` is passed in so the rolling cap is
 * enforced by whoever owns the ledger.
 */
export function planTopUps(input: {
  treasury: Address;
  treasuryBalanceWei: bigint;
  staff: StaffBalance[];
  caps: TopUpCaps;
  spentThisHourWei?: bigint;
}): TopUpPlan {
  const { treasury, treasuryBalanceWei, staff, caps } = input;
  const spent = input.spentThisHourWei ?? 0n;
  const hourLeft = caps.maxPerHourWei > spent ? caps.maxPerHourWei - spent : 0n;
  let budget = treasuryBalanceWei > caps.reserveWei ? treasuryBalanceWei - caps.reserveWei : 0n;
  if (budget > hourLeft) budget = hourLeft;

  const lines: TopUpLine[] = [];
  const sends: TopUpLine[] = [];
  let total = 0n;
  let required = 0n;
  let treasuryShort = false;

  // Neediest first: with a thin treasury the deployer (one Account Opening) must win over a registrar
  // that is a few thousand gwei light.
  const ordered = [...staff].sort((a, b) => {
    const ga = a.targetWei - a.balanceWei;
    const gb = b.targetWei - b.balanceWei;
    return ga === gb ? 0 : gb > ga ? 1 : -1;
  });

  for (const s of ordered) {
    const base = { role: s.need.role, label: s.need.label, address: s.address, balanceWei: s.balanceWei, needWei: s.needWei, targetWei: s.targetWei };
    // The treasury cannot fund itself. This is only reachable when an operator has deliberately pointed a
    // staff slot and the treasury at the same key (see `SEPOLIA_TREASURY_ALLOW_ROLE_REUSE`); a self-transfer
    // would burn 21,000 gas to move nothing.
    if (s.address.toLowerCase() === treasury.toLowerCase()) {
      lines.push({ ...base, sendWei: 0n, skip: 'is-treasury' });
      continue;
    }
    // The refill trigger is `need`, not `target` — see the module note.
    if (s.balanceWei >= s.needWei) {
      lines.push({ ...base, sendWei: 0n, skip: 'funded' });
      continue;
    }
    const wanted = s.targetWei - s.balanceWei;
    required += wanted;
    let send = wanted;
    let clampedBy: TopUpLine['clampedBy'];
    if (send > caps.maxPerTxWei) {
      send = caps.maxPerTxWei;
      clampedBy = 'per-tx cap';
    }
    if (send > budget) {
      send = budget;
      clampedBy = 'treasury balance';
    }
    // A send that cannot even reach `need` is a funding blocker, not a top-up. Same for a partial send when
    // the operator has not opted into partials.
    const reaches = s.balanceWei + send;
    if (send === 0n || reaches < s.needWei || (send < wanted && !caps.allowPartial)) {
      treasuryShort = true;
      lines.push({ ...base, sendWei: 0n, skip: 'treasury-short', deficitWei: wanted - send, ...(clampedBy ? { clampedBy } : {}) });
      continue;
    }
    const line: TopUpLine = { ...base, sendWei: send, ...(clampedBy ? { clampedBy } : {}) };
    lines.push(line);
    sends.push(line);
    total += send;
    budget -= send;
  }

  return {
    lines,
    sends,
    totalWei: total,
    remainingWei: treasuryBalanceWei > total ? treasuryBalanceWei - total : 0n,
    requiredWei: required,
    treasuryShort,
  };
}

/** Trim `formatEther` for reports: enough digits to see a gwei-level difference, no 18-decimal noise. */
export function fmtEth(wei: bigint, digits = 6): string {
  const raw = formatEther(wei);
  if (!raw.includes('.')) return raw;
  const [whole, frac] = raw.split('.');
  const shown = frac.slice(0, digits).replace(/0+$/, '');
  return shown ? `${whole}.${shown}` : whole;
}
