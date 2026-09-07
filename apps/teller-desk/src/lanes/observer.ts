/**
 * Terminal Console — the OBSERVER runtime role (stretch after U7, docs/TERMINAL-CONSOLE.md).
 *
 * What this is for. AccountBlox registry views are permissioned (V10): `getTransaction`,
 * `getPendingTransactions`, `getTransactionHistory`, `getAuthorizedWallets`, `getWalletRoles` all run
 * `_validateAnyRole()` on the `eth_call` sender, so a wallet with no role on the account reads
 * `NoPermission` — pasting the account address into the hosted Console is not enough. A runtime role whose
 * member list contains the player's own MetaMask/EOA and whose **function permission list is empty**
 * satisfies `hasAnyRole` and unlocks exactly those reads, while granting no `TxAction` bit on any selector,
 * so it can never pay, wire, release, recall or reconfigure. That is the whole trick, and the kill tests
 * (`scripts/kill-tests-observer.ts`) exist to keep it true.
 *
 * Shape of a change. Same owner-signs / broadcaster-executes meta-transaction as every other configuration
 * batch — `ownerSignedBatch(..., 'role', ...)` from `provision.ts`, signed silently by the session signer
 * under the existing typed-data rule (`params.action` = `SIGN_META_REQUEST_AND_APPROVE`). No second Privy
 * surface: the terminal is not the Priority desk.
 *
 * Deliberately **not** part of `desiredGrants()` / `ROLE_SET_VERSION`. Account Opening and Re-check never
 * create OBSERVER and never touch it once it exists (`syncRolePermissions` only walks the roles it wants),
 * so viewing wallets are opt-in per player, added and removed at the terminal, and survive a Re-check.
 *
 * V7 ordering still applies: `CREATE_ROLE` must precede `ADD_WALLET` for the same role, which the single
 * batch below guarantees by construction.
 */
import { getAddress, isAddress, keccak256, toBytes, type Address, type Hex } from 'viem';
import { RoleConfigActionType, RuntimeRBAC, encodeAddWallet, encodeCreateRole, encodeRevokeWallet, roleConfigBatchExecutionParams } from '@bloxchain/sdk';
import { broadcaster, broadcasterAddress, chain, managerAddress, publicClient } from '../chain.ts';
import { deployments } from '../config.ts';
import type { AuditSink } from '../signing/privySigner.ts';
import { emitStage, type Player } from '../store.ts';
import { ownerSignedBatch } from './provision.ts';

/** On-chain role name. Bank words for the same thing are "viewing wallet" / "viewing clerk". */
export const OBSERVER_ROLE_NAME = 'OBSERVER';
export const OBSERVER_ROLE = keccak256(toBytes(OBSERVER_ROLE_NAME));

/**
 * How many viewing wallets one account may carry. The protocol enforces this itself
 * (`RoleWalletLimitReached`); the pre-check below only exists so the terminal can say so in bank words
 * before spending a meta-transaction on a refusal.
 */
export const OBSERVER_MAX_WALLETS = 3n;

export interface ObserverList {
  role: Hex;
  roleName: string;
  exists: boolean;
  maxWallets: number;
  wallets: Address[];
}

export interface ObserverChange extends ObserverList {
  address: Address;
  /** `false` when the chain already said yes — a re-grant or a re-revoke costs nothing and is not an error. */
  changed: boolean;
  actions: string[];
  hash?: Hex;
}

const err = (code: string, message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode, code });

/** Registry views are permissioned (V10) — read as the broadcaster, which holds a role on every account. */
function rbac(account: Address) {
  return new RuntimeRBAC(publicClient, broadcaster, account, chain);
}

function requireAccount(player: Player): Address {
  if (!player.account) throw err('NO_ACCOUNT', 'No account opened for this player');
  return player.account;
}

/**
 * The address the player typed. ENS names are resolved before they get here (the bridge calls the existing
 * `/ens/resolve`), so anything that is not 20 bytes of hex at this point is a typo.
 */
function parseWallet(input: unknown): Address {
  const raw = String(input ?? '').trim();
  if (!raw) throw err('BAD_ARGS', 'a viewing wallet address is required');
  if (!isAddress(raw)) throw err('BAD_ARGS', `not an address: ${raw.slice(0, 64)}`);
  return getAddress(raw) as Address;
}

/**
 * Addresses that already hold a role on this account. Adding one of them to OBSERVER would grant nothing
 * and would put the bank's own keys on a list the player is told is "people who can watch", so it is
 * refused with a code the terminal has a line for rather than quietly succeeding.
 */
function refuseHouseWallet(player: Player, address: Address): void {
  const mine: Array<[string, Address | undefined]> = [
    ['your own account holder wallet', player.ownerAddress],
    ['the teller (broadcaster)', broadcasterAddress],
    ['the branch manager', managerAddress],
  ];
  for (const [who, candidate] of mine) {
    if (candidate && candidate.toLowerCase() === address.toLowerCase()) {
      throw err('OBSERVER_SELF', `${address} is ${who} and already holds a role on this account`);
    }
  }
  if (player.account && player.account.toLowerCase() === address.toLowerCase()) {
    throw err('OBSERVER_SELF', `${address} is the account itself, not a wallet that can read it`);
  }
}

/** Who can currently read this account from the Console. Empty (and `exists:false`) before the first grant. */
export async function listObservers(player: Player): Promise<ObserverList> {
  const account = requireAccount(player);
  const rb = rbac(account);
  const roles = await rb.getSupportedRoles();
  const exists = roles.some((r) => r.toLowerCase() === OBSERVER_ROLE.toLowerCase());
  if (!exists) return { role: OBSERVER_ROLE, roleName: OBSERVER_ROLE_NAME, exists: false, maxWallets: Number(OBSERVER_MAX_WALLETS), wallets: [] };
  const [wallets, role] = await Promise.all([rb.getAuthorizedWallets(OBSERVER_ROLE), rb.getRole(OBSERVER_ROLE).catch(() => undefined)]);
  return {
    role: OBSERVER_ROLE,
    roleName: OBSERVER_ROLE_NAME,
    exists: true,
    maxWallets: Number(role?.maxWallets ?? OBSERVER_MAX_WALLETS),
    wallets: wallets.map((w) => getAddress(w) as Address),
  };
}

/**
 * The permissions OBSERVER actually holds, read back from the chain. Anything but an empty array is a bug:
 * membership is the whole grant. `/observer/list` reports it so the terminal (and a judge) can see it, and
 * the kill tests assert it.
 */
export async function observerPermissions(account: Address): Promise<Array<{ functionSelector: string; grantedActionsBitmap: string }>> {
  const active = (await rbac(account)
    .getActiveRolePermissions(OBSERVER_ROLE)
    .catch(() => [])) as Array<{ functionSelector?: string; grantedActionsBitmap?: number | bigint }>;
  return active.map((p) => ({ functionSelector: String(p.functionSelector ?? '?'), grantedActionsBitmap: String(p.grantedActionsBitmap ?? '?') }));
}

/**
 * Add a viewing wallet: `CREATE_ROLE OBSERVER` when the account has never had one, then `ADD_WALLET`.
 * Idempotent against the chain, like provisioning — a wallet that is already on the list is a quiet no-op
 * and costs no gas. **No `ADD_FUNCTION_TO_ROLE`, ever.**
 */
export async function grantObserver(player: Player, input: unknown, jobId?: string, audit?: AuditSink): Promise<ObserverChange> {
  const account = requireAccount(player);
  const address = parseWallet(input);
  refuseHouseWallet(player, address);
  const { rbacDefinitions } = deployments();

  const stage = (s: 'signing' | 'broadcasting' | 'mined', bankLine: string, extra: Record<string, unknown> = {}) => {
    if (jobId) emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'CONFIG', stage: s, bankLine, serverNow: String(Math.floor(Date.now() / 1000)), ...extra });
  };

  const before = await listObservers(player);
  if (before.wallets.some((w) => w.toLowerCase() === address.toLowerCase())) {
    return { ...before, address, changed: false, actions: [] };
  }
  if (before.exists && before.wallets.length >= before.maxWallets) {
    throw err('OBSERVER_FULL', `this account already carries ${before.wallets.length} viewing wallet(s); the limit is ${before.maxWallets}`);
  }

  const actions: Array<{ actionType: RoleConfigActionType; data: Hex }> = [];
  const log: string[] = [];
  if (!before.exists) {
    actions.push({ actionType: RoleConfigActionType.CREATE_ROLE, data: encodeCreateRole(publicClient, rbacDefinitions, OBSERVER_ROLE_NAME, OBSERVER_MAX_WALLETS) });
    log.push(`CREATE_ROLE ${OBSERVER_ROLE_NAME} (maxWallets ${OBSERVER_MAX_WALLETS}, no function permissions)`);
  }
  actions.push({ actionType: RoleConfigActionType.ADD_WALLET, data: encodeAddWallet(publicClient, rbacDefinitions, OBSERVER_ROLE, address) });
  log.push(`ADD_WALLET ${address} → ${OBSERVER_ROLE_NAME}`);

  stage('signing', 'Writing the viewing wallet onto your file…');
  const executionParams = roleConfigBatchExecutionParams(publicClient, rbacDefinitions, actions);
  const hash = await ownerSignedBatch(player, account, 'role', executionParams, audit, 400_000n * BigInt(actions.length) + 300_000n);
  stage('mined', 'Viewing wallet added. It can read this account and nothing else.', { hash });

  const after = await listObservers(player);
  return { ...after, address, changed: true, actions: log, hash };
}

/**
 * Remove a viewing wallet (`REVOKE_WALLET`). The role itself is left in place: an empty role grants nobody
 * anything, and keeping it means the next grant is one action instead of two.
 */
export async function revokeObserver(player: Player, input: unknown, jobId?: string, audit?: AuditSink): Promise<ObserverChange> {
  const account = requireAccount(player);
  const address = parseWallet(input);
  const { rbacDefinitions } = deployments();

  const before = await listObservers(player);
  if (!before.exists || !before.wallets.some((w) => w.toLowerCase() === address.toLowerCase())) {
    throw err('NOT_OBSERVER', `${address} is not a viewing wallet on this account`);
  }

  if (jobId) {
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'CONFIG', stage: 'signing', bankLine: 'Striking the viewing wallet off your file…', serverNow: String(Math.floor(Date.now() / 1000)) });
  }
  const executionParams = roleConfigBatchExecutionParams(publicClient, rbacDefinitions, [
    { actionType: RoleConfigActionType.REVOKE_WALLET, data: encodeRevokeWallet(publicClient, rbacDefinitions, OBSERVER_ROLE, address) },
  ]);
  const hash = await ownerSignedBatch(player, account, 'role', executionParams, audit, 700_000n);
  if (jobId) {
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'CONFIG', stage: 'mined', bankLine: 'Viewing wallet removed. That address can no longer read your account.', hash, serverNow: String(Math.floor(Date.now() / 1000)) });
  }

  const after = await listObservers(player);
  return { ...after, address, changed: true, actions: [`REVOKE_WALLET ${address} ← ${OBSERVER_ROLE_NAME}`], hash };
}
