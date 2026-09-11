/**
 * Load Account (Iris) — adopt an AccountBlox the player already owns on this wing (docs/LOAD-ACCOUNT.md).
 *
 * Why this lane exists. CopyBlox keeps a **flat** `_clones` set and emits `BloxCloned(indexed initialOwner)`;
 * there is no `owner → clones` mapping, so `recoverAccount` takes the **last** matching log (then a deployment
 * fixture). A player who opened a second account, or who needs an older one that still holds a balance or a
 * pending wire, cannot reach it through "Open my account" — recovery will keep preferring the newest. The desk
 * terminal already helps them *find* the address; this lane is how Account Opening *adopts* it.
 *
 * What it is not. It clones nothing, transfers no ownership, and invents no factory index. It only changes
 * which contract the Teller Desk treats as this player's Main account on this wing — and it refuses to do
 * even that unless the chain says the player owns it.
 *
 * The gate, in order (all reads, no signature, nothing written until every one passes):
 *   1. `getAddress` — a checksummed 20-byte address, and not the zero address.
 *   2. `getCode` — there must be a contract there *on this wing*. A Dev (1337) address pasted into Live has no
 *      code on Sepolia, which is exactly what the cross-wing refusal looks like; measured shapes are in §"probe".
 *   3. `owner()` + `initialized()` + `supportsSecureOwnableInterface()` — it must answer like an AccountBlox.
 *      Measured on Remote EVM 1337 (2026-09-08): a real clone answers owner / initialized true / both interface
 *      ids true; an EOA has no code; the demo ERC-20 has code but `owner()` **reverts** and both interface ids
 *      are false; CopyBlox itself has code and `IBaseStateMachine` true but `owner()` reverts, `initialized()`
 *      is false and `ISecureOwnable` is **false**. So `ISecureOwnable` + `initialized` is the sharp edge, and
 *      `IBaseStateMachine` alone would have adopted the factory.
 *   4. `owner()` must equal the session's Privy owner. This is the whole security story: never load a stranger's
 *      vault into somebody's passbook (`ACCOUNT_NOT_OWNED`).
 *
 * Then, and only then:
 *   5. Re-pin the Privy policies to the new address **before** the player index is touched. The typed-data rule
 *      is what stops the silent session signer being handed a slip for some other contract, so a load whose
 *      re-pin failed must not be a load at all — otherwise the desk would be pointing at vault B while the
 *      enclave still only signs for vault A. Rules are app-owned, so this needs no second consent.
 *   6. `patchPlayer` the account (and forget the previous account's `configured` / `roleSet`: they were facts
 *      about a different contract).
 *   7. Run the same chain-reconciling sync as Re-check — whitelist, role grants, zero-only opening balance,
 *      owner gas — with **no** `cloneBlox`. Every step reads the chain first, so adopting an account that was
 *      already fully provisioned sends nothing at all.
 */
import { formatUnits, getAddress, isAddress, zeroAddress, type Address, type Hex } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { erc20Abi } from '@branch-zero/shared';
import { chain, publicClient } from '../chain.ts';
import { config, deployments } from '../config.ts';
import { pinPolicyToAccount, reconcileTxRules, TYPED_DATA_RULE_VERSION } from '../privy.ts';
import type { AuditSink } from '../signing/privySigner.ts';
import { emitStage, patchPlayer, type Player } from '../store.ts';
import { ROLE_SET_VERSION, fundAccount, fundOwnerGas, syncRolePermissions, whitelistToken } from './provision.ts';

const err = (code: string, message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode, code });

export interface LoadedAccount {
  account: Address;
  /** The account this player was pointed at before, or `null` for a player who had none. */
  previous: Address | null;
  /** `false` when the desk was already pointed here — the sync still runs, like a Re-check. */
  changed: boolean;
  owner: Address;
  chainId: number;
  chainName: string;
  mode: string;
  wing: string;
  timeLockSec: number;
  roleSet: number;
  priority: boolean;
  roleChanges: string[];
  stranded: string[];
  /** Which Privy rules now name this address. `false` for a player signing every slip themselves. */
  policyPinned: boolean;
  txPolicyPinned: boolean;
  balance: string;
  symbol: string;
}

/**
 * What the player typed. Everything here is a typo, not a chain fact, so it never costs a read: the terminal
 * hands out checksummed addresses and Iris only ever asks for one of those.
 */
function parseAccount(input: unknown): Address {
  const raw = String(input ?? '').trim();
  if (!raw) throw err('BAD_ARGS', 'an account address is required');
  if (!isAddress(raw)) throw err('BAD_ARGS', `not an address: ${raw.slice(0, 64)}`);
  const account = getAddress(raw) as Address;
  if (account === zeroAddress) throw err('BAD_ARGS', 'the zero address is not an account');
  return account;
}

/**
 * Is there really a player-owned AccountBlox at this address on this wing? Four reads, one honest refusal each.
 * Nothing is written and nothing is signed: a wrong address costs the desk an `eth_call`, not a transaction.
 */
export async function assertOwnedAccount(account: Address, owner: Address): Promise<{ timeLockSec: number }> {
  const code = await publicClient.getCode({ address: account });
  if (!code || code === '0x') {
    throw err(
      'ACCOUNT_NOT_A_VAULT',
      `${account} has no contract on ${chain.name} (${chain.id}) — either it is a plain wallet address or it belongs to another wing of the bank`,
    );
  }
  const so = new SecureOwnable(publicClient as never, undefined, account, chain);

  /**
   * `getCode` just answered, so the RPC is demonstrably reachable: a failing read below is a fact about the
   * *contract*, not the network, and must not be reported as `RPC` (`lanes/fx.ts` learned the same lesson on
   * its till check). A contract that does not answer `owner()` is simply not an account.
   */
  let onChainOwner: Address;
  try {
    onChainOwner = await so.owner();
  } catch (e) {
    throw err('ACCOUNT_NOT_A_VAULT', `${account} on ${chain.name} does not answer owner() — it is not an account (${(e as Error).message.split('\n')[0]})`);
  }
  const [initialized, isSecureOwnable] = await Promise.all([so.initialized().catch(() => false), so.supportsSecureOwnableInterface().catch(() => false)]);
  if (!initialized || !isSecureOwnable) {
    throw err(
      'ACCOUNT_NOT_A_VAULT',
      `${account} on ${chain.name} answers owner() but is not an initialised AccountBlox (initialized ${initialized}, ISecureOwnable ${isSecureOwnable})`,
    );
  }
  if (onChainOwner.toLowerCase() !== owner.toLowerCase()) {
    throw err('ACCOUNT_NOT_OWNED', `${account} on ${chain.name} is owned by ${onChainOwner}, not by ${owner}`);
  }
  const timeLockSec = await so.getTimeLockPeriodSec().catch(() => BigInt(config.timeLockSec));
  return { timeLockSec: Number(timeLockSec) };
}

/**
 * Point every Privy rule the silent lane uses at `account`, before the desk starts calling it this player's.
 *
 * Unlike provisioning — which pins *after* the clone, because there was nothing to pin to beforehand — a load
 * has an old address to move away from, so the order is reversed on purpose: the enclave must be able to sign
 * for the new vault before the index says that is where the money is. A player in client-signing mode has no
 * policy at all; that is a real answer (`pinned: false`), not a failure.
 */
async function repinPolicies(player: Player, account: Address): Promise<Partial<Player>> {
  /**
   * Both flags start **false** rather than absent: they are claims about which contract the rules name, and
   * carrying a `true` from the previous account across a switch would make the player index say something
   * untrue (and `/session` report `policyPinnedToAccount` for a contract the rule does not mention).
   */
  const patch: Partial<Player> = { policyPinned: false, txPolicyPinned: false };
  if (!player.policyId) return patch;
  const { token } = deployments();

  if (player.policyRuleId) {
    try {
      await pinPolicyToAccount({ policyId: player.policyId, ruleId: player.policyRuleId }, account, chain.id);
      patch.policyPinned = true;
      patch.typedDataRule = TYPED_DATA_RULE_VERSION;
    } catch (e) {
      throw err(
        'LOAD_POLICY',
        `the typed-data rule could not be re-pinned to ${account}: ${(e as Error).message.slice(0, 200)} — the account was NOT switched, because the session signer would still only sign for the old one`,
        502,
      );
    }
  }

  /**
   * V6 — the owner's own transactions (`executeWithTimeLock`, approve, cancel) travel under separate
   * `eth_signTransaction` rules. They are **reconciled by name** against Privy and pointed at the loaded account
   * (the same posture as provisioning's `ensureTxPolicy`): a rule that exists is re-pinned in place, a missing one is
   * created, a duplicate is re-purposed or deleted. The stored ids are never used positionally — that is what pinned
   * the release rule away on Lane B #14. A failure here is *not* fatal: the wire lanes fall back to whatever rules the
   * policy holds and the index says `txPolicyPinned: false`.
   */
  try {
    const r = await reconcileTxRules(player.policyId, chain.id, token.address, account);
    if (r.actions.length) console.warn(`[load] tx rules reconciled for ${player.ownerAddress} → ${account}: ${r.actions.join('; ')}`);
    patch.txRuleIds = r.ruleIds;
    patch.txPolicyMode = r.mode;
    patch.txPolicyPinned = true;
  } catch (e) {
    console.warn(`[load] tx rules not reconciled for ${account}: ${(e as Error).message.slice(0, 200)}`);
  }
  return patch;
}

/**
 * Adopt `input` as this player's account on this wing, then bring it up to the branch's standard the same way
 * Re-check does. Serialised by the caller: the sync signs meta-transactions, and one player has one nonce.
 */
export async function loadAccount(player: Player, input: unknown, jobId?: string, audit?: AuditSink): Promise<LoadedAccount> {
  const account = parseAccount(input);
  const previous = player.account ?? null;
  const { token } = deployments();

  const stage = (s: 'provisioning' | 'configuring' | 'funding' | 'mined', bankLine: string, extra: Record<string, unknown> = {}) => {
    if (jobId) emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'PROVISION', stage: s, bankLine, serverNow: String(Math.floor(Date.now() / 1000)), ...extra });
  };

  stage('provisioning', 'Looking that account up on the ledger…');
  const { timeLockSec } = await assertOwnedAccount(account, player.ownerAddress);
  const changed = previous?.toLowerCase() !== account.toLowerCase();
  stage('provisioning', changed ? 'That account is yours — moving your file over to it.' : 'That is the account already on your file — checking it over.', { account });

  const policyPatch = await repinPolicies(player, account);

  /**
   * `configured` / `roleSet` described the *previous* contract, so they are cleared rather than carried across.
   * If the sync below fails half-way the player is left pointed at an account whose desk permissions are
   * unconfirmed — which is precisely what `NOT_CONFIGURED` ("ask Iris to re-check your account") is for, and a
   * far better state than a passbook that claims permissions nobody verified.
   */
  let current = patchPlayer(player.privyUserId, {
    account,
    ...policyPatch,
    ...(changed ? { configured: false, roleSet: 0 } : {}),
  });

  stage('configuring', 'Adding the payee list to your file…');
  const whitelistHash = await whitelistToken(current, account, audit);
  stage('configuring', whitelistHash ? 'Payee list approved.' : 'Payee list already on file.', whitelistHash ? { hash: whitelistHash } : {});

  stage('configuring', config.priorityRelease ? 'Authorising the counter, the vault and the manager’s priority desk…' : 'Authorising the counter and the vault (vault-only branch)…');
  const sync = await syncRolePermissions(current, account, audit);
  current = patchPlayer(player.privyUserId, { configured: true, roleSet: ROLE_SET_VERSION, priority: config.priorityRelease });
  stage('configuring', sync.hash ? `Desks authorised (${sync.actions.length} changes).` : 'Desks already authorised.', {
    ...(sync.hash ? { hash: sync.hash } : {}),
    ...(sync.stranded.length ? { reason: sync.stranded.join('; ') } : {}),
  });

  /**
   * Zero-only, exactly like Account Opening: an older vault the player is coming back to usually has its own
   * balance, and the branch does not top it up here. Iris's faucet is the explicit way to ask for more.
   */
  stage('funding', 'Checking the balance on it…');
  const funded = await fundAccount(account);
  const gas = await fundOwnerGas(player.ownerAddress);
  const balance = (await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })) as bigint;
  stage('funding', funded ? 'Opening balance deposited.' : 'Balance already on deposit.', { ...(funded ? { hash: funded } : {}), ownerGasEth: gas.balanceEth });

  stage('mined', changed ? 'Loaded. That account is the one this desk will use for you.' : 'Checked. That account is still the one this desk uses for you.', { account });

  return {
    account,
    previous,
    changed,
    owner: player.ownerAddress,
    chainId: chain.id,
    chainName: chain.name,
    mode: config.mode,
    wing: config.target,
    timeLockSec,
    roleSet: ROLE_SET_VERSION,
    priority: config.priorityRelease && Boolean(current.priority),
    roleChanges: sync.actions,
    stranded: sync.stranded,
    policyPinned: Boolean(current.policyPinned),
    txPolicyPinned: Boolean(current.txPolicyPinned),
    balance: formatUnits(balance, token.decimals),
    symbol: token.symbol,
  };
}
