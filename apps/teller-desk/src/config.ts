import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAddress, type Address, type Hex } from 'viem';
import { ARC_TESTNET_CHAIN_ID, DEFAULT_ARC_RPC_URL, REMOTE_EVM_CHAIN_ID, SEPOLIA_CHAIN_ID, TREASURY_CAP_DEFAULTS, type ChainTarget } from '@branch-zero/shared';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} — see .env.example`);
  return v;
}
function opt(name: string, fallback = ''): string {
  return process.env[name] || fallback;
}

/** Never log these. `redact` exists so startup logs can prove a value is present without leaking it. */
export function redact(v: string): string {
  return v.length <= 10 ? '***' : `${v.slice(0, 6)}…${v.slice(-4)}`;
}

/**
 * One Teller Desk process serves one payment wing, pinned at boot. Two processes run side by side:
 *
 *   Live (product default)  CHAIN_ID=11155111  PORT=8787   → Vite `/api`      → Sepolia
 *   Dev  (Developer Mode)   CHAIN_ID=1337      PORT=8788   → Vite `/dev-api`  → Remote EVM
 *
 * `CHAIN_ID` is deliberately *not* switchable at runtime: the broadcaster nonce queue, the player index and
 * the deployment pins are all per chain, and a process that flipped chains mid-flight would sign a
 * meta-transaction for one chain against the other's account map. Dev/Live is therefore a **session** choice
 * in the browser (which desk it talks to), never a chain swap inside one desk — and it is not Arc's
 * `switchWing`, which is a different wing of the same product (docs/SEPOLIA-LIVE.md §1).
 *
 * Arc (`5042002`) remains DEFERRED but its config path stays wired, unchanged.
 */
const DEFAULT_CHAIN_ID = SEPOLIA_CHAIN_ID;

/**
 * `--dev` on the command line is the same thing as `CHAIN_ID=1337`, and exists because the two desks must be
 * startable from `package.json` on any OS. `.env` holds exactly one `PORT` and one `CHAIN_ID`, which the Live
 * desk uses; a Dev desk launched with the flag reads `DEV_PORT` instead, so neither process needs shell-specific
 * `VAR=x cmd` prefixes (cmd.exe has none) and neither can accidentally inherit the other's port.
 */
const devFlag = process.argv.includes('--dev');
const chainId = devFlag ? REMOTE_EVM_CHAIN_ID : Number(opt('CHAIN_ID', String(DEFAULT_CHAIN_ID)));

const target: ChainTarget = chainId === ARC_TESTNET_CHAIN_ID ? 'arc' : chainId === SEPOLIA_CHAIN_ID ? 'sepolia' : 'remote';

/**
 * Per-target env namespaces. Keys never cross networks: the Remote EVM slots hold Ganache-parity keys that are
 * public knowledge, so a `SEPOLIA_*` / `ARC_*` prefix is the only thing standing between a config slip and a
 * swept wallet (docs/SECURITY-AND-KEYS.md §1; `chain.ts` re-checks the derived address as well).
 */
const PREFIX: Record<ChainTarget, string> = { remote: '', arc: 'ARC_', sepolia: 'SEPOLIA_' };
const key = (base: string) => `${PREFIX[target]}${base}`;

/**
 * How much native gas the player's own embedded wallet is topped up to at Account Opening (Lane B option 1:
 * the owner sends `executeWithTimeLock` / `approveTimeLockExecution` itself). On the lab chain dev ETH is
 * free, so 0.05 is generous and harmless. On Sepolia 0.05 ETH is an entire day's faucet drop per player,
 * while the owner's actual bill is a wire plus a release — ~450k gas, under 0.0015 ETH at a few gwei. So Live
 * defaults to 0.003 (a ~7× cushion) and the operator can raise it with `SEPOLIA_OWNER_GAS_ETH`.
 */
const DEFAULT_OWNER_GAS_ETH: Record<ChainTarget, string> = { remote: '0.05', arc: '0.05', sepolia: '0.003' };

const rpcUrl =
  target === 'arc' ? opt('ARC_RPC_URL', DEFAULT_ARC_RPC_URL) : target === 'sepolia' ? req('SEPOLIA_RPC_URL') : opt('REMOTE_EVM_RPC_URL', 'http://127.0.0.1:8545');

const managerPk = opt(key('MANAGER_PK')) || undefined;

/**
 * Sepolia ops treasury (docs/SEPOLIA-TREASURY.md).
 *
 * **Live wing only, and never required.** The lab chain funds itself from genesis, so a Dev desk must boot
 * with none of this set — hence `opt` throughout and a `target === 'sepolia'` gate on the key itself: a
 * treasury key left in `.env` cannot be picked up by the Dev process even by accident.
 *
 * The treasury is a float, not an identity: it holds no role on any player account and appears in no
 * `desiredGrants()`. Its only power is `sendTransaction` to addresses that already hold the bank's duties.
 */
const treasuryRawPk = target === 'sepolia' ? opt('SEPOLIA_TREASURY_PK').trim() : '';
/**
 * `0x`-normalised, because an operator pasting a bare 64-char key is normal (`ENS_REGISTRAR_PK` is stored
 * that way) and viem's `privateKeyToAccount` throws on it. The Name Desk already normalises its own key;
 * doing it here means the treasury wallet is built through the same `wallet()` helper — and the same
 * Ganache-parity refusal — as every other signer, instead of crashing before that check runs.
 */
const treasuryPk = treasuryRawPk ? ((treasuryRawPk.startsWith('0x') ? treasuryRawPk : `0x${treasuryRawPk}`) as Hex) : undefined;

export const config = {
  port: Number(target === 'remote' ? opt('DEV_PORT', '8788') : target === 'arc' ? opt('ARC_PORT', '8789') : opt('PORT', '8787')),
  chainId,
  target,
  /** `live` is the product default (Sepolia); `dev` is the operator's Remote EVM lab. Arc keeps its own label. */
  mode: (target === 'sepolia' ? 'live' : target === 'remote' ? 'dev' : 'arc') as 'live' | 'dev' | 'arc',
  rpcUrl,
  allowedOrigins: opt('ALLOWED_ORIGINS', 'http://localhost:5173').split(',').map((s) => s.trim()),

  broadcasterPk: req(key('BROADCASTER_PK')) as Hex,
  deployerPk: req(key('DEPLOYER_PK')) as Hex,
  /** Optional (U2). Branch Manager: a runtime `BRANCH_MANAGER` role holder who may approve / cancel wires directly. */
  managerPk: managerPk as Hex | undefined,
  recoveryAddress: getAddress(req(key('RECOVERY_ADDRESS'))) as Address,

  /**
   * Largest gas limit a single transaction may declare. Defaults to 2^24 = 16,777,216, which is both the
   * Remote EVM block limit and the `rpc.gascap` public Sepolia providers use — and just enough for
   * `cloneBlox` (~16.65 M measured). Raise it only against an RPC that really allows more.
   */
  maxTxGas: BigInt(opt(key('MAX_TX_GAS'), opt('MAX_TX_GAS', '16777216'))),

  timeLockSec: BigInt(opt('TIMELOCK_SEC', '120')),
  /** Lane A soft cap. Off-chain policy only — see docs/REFLECTION.md §2.2 "partial" invariant. */
  instantLimit: opt('INSTANT_LIMIT_USDC', '100'),
  /** Opening balance handed to a freshly provisioned account, in display units. */
  openingBalance: opt('OPENING_BALANCE_USDC', '500'),
  /**
   * U2, Lane B option 1: the player's embedded wallet sends `executeWithTimeLock` / `approveTimeLockExecution`
   * itself (signed by the session signer), so it needs a little gas. Topped up from the deployer at
   * Account Opening whenever the balance drops under half of this. See `DEFAULT_OWNER_GAS_ETH` for why Live
   * is two orders of magnitude smaller than the lab.
   */
  ownerGasEth: opt(key('OWNER_GAS_ETH'), opt('OWNER_GAS_ETH', DEFAULT_OWNER_GAS_ETH[target])),
  /**
   * U4+ Priority release. `on` (default when a manager key is present): accounts are provisioned with the
   * owner-signs / manager-submits META_APPROVE split on the transfer selector, so Mr. Okafor can release a
   * cooling wire early once the player brings a Passkey (hand scan). `off` = vault-only accounts (the U2
   * invariant: no META_APPROVE bits on `transfer`; the clock is the only way out). Changing this changes
   * `desiredGrants()`; the next Re-check re-syncs every player. META bits are account-wide: once granted, any
   * PENDING wire on that account can be bypassed — Okafor says so in his "Ask why".
   */
  priorityRelease: opt('PRIORITY_RELEASE', managerPk ? 'on' : 'off').toLowerCase() === 'on' && Boolean(managerPk),

  /** U5: ENS identity is always read/written on Sepolia, on every wing — it is a side-module, not the payment chain. */
  sepoliaRpcUrl: opt('SEPOLIA_RPC_URL'),
  /**
   * S1 — the FX desk's Sepolia keys (docs/UNISWAP.md). FX writes are **always** Sepolia, whichever wing the
   * payment desk is on: on the Dev wing these are a separate till from the player's 1337 Main account, and on
   * the Live wing they are the same chain as Main, so the Live till can simply *be* the Main account
   * (`fxTillIsMain`). Absent keys make the desk answer `FX_NOT_CONFIGURED`, never a stack trace.
   */
  fx: {
    broadcasterPk: opt('SEPOLIA_BROADCASTER_PK'),
    deployerPk: opt('SEPOLIA_DEPLOYER_PK'),
    recoveryAddress: (opt('SEPOLIA_RECOVERY_ADDRESS') || undefined) as Address | undefined,
  },
  /**
   * On the Live wing the player's Main AccountBlox already lives on Sepolia, so Kenji trades out of the very
   * account the counter pays from — one balance, one guard list, no second till to fund or explain
   * (docs/SEPOLIA-LIVE.md §1). Dev keeps Main (1337) and till (Sepolia) apart because they cannot be the same
   * contract on two chains.
   */
  fxTillIsMain: target === 'sepolia',
  /**
   * Whether the wing's practice token lets the bank's till mint its own float. True on Live: the U5 Sepolia
   * mock USDC has a permissionless `mint` (confirmed 2026-09-08, 51,762 gas), which is what keeps the practice
   * faucet working without touching Circle's faucet USDC. The lab chain's dUSDC was pre-minted to the deployer
   * at bootstrap and needs nothing; Arc's payment token is real native USDC and must never be faked.
   */
  practiceTokenOpenMint: target === 'sepolia',
  /**
   * The ops treasury. `pk` is present only on Live; `address` lets an operator watch a treasury this process
   * does not hold the key for (read-only balances in `/healthz` and the funding report) — the same
   * address-only shape `SEPOLIA_RECOVERY_ADDRESS` already uses.
   */
  treasury: {
    pk: treasuryPk as Hex | undefined,
    address: (opt('SEPOLIA_TREASURY_ADDRESS') || undefined) as Address | undefined,
    /**
     * Background rebalancing. On by default when a key is present, because that is the whole point of the
     * wallet; `off` leaves the CLI as the only way money moves. Never consulted on the Dev wing.
     */
    auto: opt('SEPOLIA_TREASURY_AUTO', 'on').toLowerCase() !== 'off' && Boolean(treasuryPk),
    /** How often the background watcher may look, in seconds. Each look is still cap- and ledger-bound. */
    intervalSec: Number(opt('SEPOLIA_TREASURY_INTERVAL_SEC', '900')),
    /** Largest single transfer, and the largest total in a rolling hour, in ETH (docs/SEPOLIA-TREASURY.md §6). */
    maxPerTxEth: opt('SEPOLIA_TREASURY_MAX_TX_ETH', TREASURY_CAP_DEFAULTS.perTxEth),
    maxPerHourEth: opt('SEPOLIA_TREASURY_MAX_HOUR_ETH', TREASURY_CAP_DEFAULTS.perHourEth),
    /** Held back so the treasury can always pay for its own transfers. */
    reserveEth: opt('SEPOLIA_TREASURY_RESERVE_ETH', TREASURY_CAP_DEFAULTS.reserveEth),
    /**
     * Practice-dollar float. `off` by default: the Live practice token is open-mint, so the deployer makes
     * its own float and a treasury transfer would be ceremony (docs/SEPOLIA-TREASURY.md §4.2). Circle's USDC
     * is never sent by any policy — the engine refuses that token outright.
     */
    practice: opt('SEPOLIA_TREASURY_PRACTICE', 'off').toLowerCase() === 'on',
    practiceNeedUsdc: opt('SEPOLIA_TREASURY_NEED_PRACTICE_USDC', opt('OPENING_BALANCE_USDC', '500')),
    /**
     * Demo-only escape hatch. The treasury sharing a key with a staff role collapses "identity ≠ float",
     * which the plan forbids, so every treasury path refuses it by derived address unless the operator says
     * `on` here. When it is on, the collapse is printed by the CLI, reported on `/healthz` and shown in the
     * desk-debug panel — a concession stays visible or it becomes the design.
     */
    allowRoleReuse: opt('SEPOLIA_TREASURY_ALLOW_ROLE_REUSE', 'off').toLowerCase() === 'on',
  },
  ensParentName: opt('ENS_PARENT_NAME', 'branchzero.eth'),
  /** Sepolia throwaway bank key. Lazy ENS client construction fails with ENS_NOT_CONFIGURED if absent. */
  ensRegistrarPk: opt('ENS_REGISTRAR_PK') as Hex | undefined,

  privy: {
    appId: req('PRIVY_APP_ID'),
    appSecret: req('PRIVY_APP_SECRET'),
    /** Dashboard value is prefixed `wallet-auth:`; the API wants the bare base64 PKCS8 key. */
    authorizationKey: req('PRIVY_AUTHORIZATION_KEY').replace(/^wallet-auth:/, ''),
    /** Key-quorum id registered in the dashboard — this is the "session signer". */
    signerId: req('PRIVY_SIGNER_ID'),
    /** Optional app-wide policy; per-player policies are created at provisioning (K5). */
    policyId: opt('PRIVY_POLICY_ID'),
  },
} as const;

if (config.chainId !== REMOTE_EVM_CHAIN_ID && config.chainId !== ARC_TESTNET_CHAIN_ID && config.chainId !== SEPOLIA_CHAIN_ID) {
  throw new Error(`Unsupported Teller Desk CHAIN_ID=${config.chainId}; use 11155111 (Sepolia — Live), 1337 (Remote EVM — Developer Mode) or 5042002 (Arc Testnet, deferred)`);
}

/** Addresses written by `npm run chain:bootstrap` / `chain:deploy`. Public data, committed. */
export function deployments() {
  const file = path.join(REPO_ROOT, 'infra', 'deployments', config.target === 'arc' ? 'arc-testnet.json' : config.target === 'sepolia' ? 'sepolia.json' : 'remote-evm.json');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (d.chainId !== config.chainId) throw new Error(`deployment ${file} is for chain ${d.chainId}, service is configured for ${config.chainId}`);
  const copyBlox = d.applications?.CopyBlox;
  const token = config.target === 'arc' ? d.tokens?.usdc : d.tokens?.demoUsdc;
  if (!copyBlox?.address) {
    throw new Error(
      `CopyBlox missing from ${path.basename(file)} — run the chain bootstrap first` +
        (config.target === 'sepolia' ? ' (BLOXCHAIN_PROTOCOL_DIR=… npm run chain:bootstrap -- --chain sepolia; the deployer needs ETH — npm -w infra run funding:sepolia)' : ''),
    );
  }
  if (!token?.address) throw new Error(`${config.target === 'arc' ? 'usdc' : 'demoUsdc'} missing from ${path.basename(file)} — run the chain bootstrap first`);
  return {
    chainId: d.chainId as number,
    copyBlox: getAddress(copyBlox.address) as Address,
    /** First block that can hold a `BloxCloned` event — where account recovery scans from. */
    copyBloxDeployedAtBlock: BigInt(copyBlox.deployedAtBlock ?? 0),
    /** The U0 fixture doubles as the clone implementation: `Clones.clone` copies runtime code, not storage. */
    accountBloxImplementation: getAddress(copyBlox.cloneImplementation ?? d.accounts[0].address) as Address,
    fixtureAccount: getAddress(d.accounts[0].address) as Address,
    fixtureOwner: getAddress(d.accounts[0].owner) as Address,
    /**
     * Every AccountBlox this chain's deployment file records, with the owner it was initialised for.
     * Addresses only — the file never holds keys. Account recovery consults this after the `BloxCloned`
     * logs, so an account deployed before CopyBlox existed on the chain is adopted rather than duplicated
     * (on Sepolia: the S1 FX till, whose owner is a player).
     */
    fixtures: (d.accounts as Array<{ address: string; owner: string; label: string }>).map((a) => ({
      label: a.label,
      address: getAddress(a.address) as Address,
      owner: getAddress(a.owner) as Address,
    })),
    guardDefinitions: getAddress(d.libraries.GuardControllerDefinitions.address) as Address,
    rbacDefinitions: getAddress(d.libraries.RuntimeRBACDefinitions.address) as Address,
    token: {
      address: getAddress(token.address) as Address,
      symbol: (token.symbol ?? 'dUSDC') as string,
      decimals: (token.decimals ?? 18) as number,
    },
    native: { symbol: config.target === 'arc' ? 'USDC' : 'ETH', decimals: 18 },
  };
}

/** Explorer link for a transaction on this wing, or `undefined` on the private lab chain. */
export function explorerTx(hash: string): string | undefined {
  if (config.target === 'sepolia') return `https://sepolia.etherscan.io/tx/${hash}`;
  if (config.target === 'arc') return `https://testnet.arcscan.app/tx/${hash}`;
  return undefined;
}
