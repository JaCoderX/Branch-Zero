/**
 * Lane B — time-locked wire (M3). The vault.
 *
 * Three direct calls on the player's account, all sent **by the owner** through the Privy session signer
 * (`eth_signTransaction`, policy-scoped to this account — see privy.ts V6) and broadcast by the Teller Desk:
 *
 *   wire     executeWithTimeLock(token, 0, transfer, (to, amount), gas, ERC20_TRANSFER)  → record PENDING
 *   approve  approveTimeLockExecution(txId)   — reverts BeforeReleaseTime until the chain clock passes
 *   cancel   cancelTimeLockExecution(txId)    — allowed while PENDING
 *
 * Why the direct path and not the owner meta-transaction the U1 lane uses: `EngineBlox._txApprovalWithMetaTx`
 * intentionally does **not** check `releaseTime` (a signer-approved meta-tx may release early by design). If
 * the vault clock is to be a real control, the approval must go through `txDelayedApproval`, and that
 * requires the caller to hold `EXECUTE_TIME_DELAY_APPROVE` and pay gas — so the owner sends it. The
 * Branch Manager (runtime `BRANCH_MANAGER` role, `MANAGER_PK`) may take the same two direct paths.
 *
 * The countdown is `record.releaseTime` read from the chain (`getTransaction`), never a local timer.
 */
import {
  decodeAbiParameters,
  encodeAbiParameters,
  formatEther,
  formatUnits,
  keccak256,
  parseEther,
  parseGwei,
  parseAbiParameters,
  parseUnits,
  toBytes,
  toFunctionSelector,
  type Address,
  type Hex,
} from 'viem';
import { ERROR_SIGNATURES, EngineBlox, GuardController, TxStatus, decodeRevertReason, getUserFriendlyErrorMessage } from '@bloxchain/sdk';
import { erc20Abi, type PendingWire, type RecordStatus, type StageEvent } from '@branch-zero/shared';
import { broadcaster, chain, manager, managerAddress, publicClient, tickChain } from '../chain.ts';
import { config, deployments } from '../config.ts';
import { ownerWalletClient, type TxAuditSink } from '../signing/privySigner.ts';
import { emitStage, hasSubscribers, type Player } from '../store.ts';
import { receiptFee } from '../fees.ts';
import { maybeTopUp } from '../treasury.ts';
import { ensureTxPolicy, fundOwnerGas } from './provision.ts';

/**
 * Outer gas for approve/cancel. The pending record's inner `gasLimit` is 200_000 for the ERC-20 transfer;
 * the handler needs headroom above that. Keep this modest: viem reserves `gas × maxFeePerGas` from the
 * owner balance before send — 500k × a spiky Sepolia maxFee can exceed a half-topped owner (~0.0015 ETH)
 * and surfaces as ContractFunctionExecutionError ("unknown error executing…"), not insufficient-funds.
 */
const VAULT_DECISION_GAS = 350_000n;

/** Calldata selectors — never treat these as revert payloads (viem puts request `data` on the error). */
const WRITE_CALL_SELECTORS = new Set([
  toFunctionSelector('approveTimeLockExecution(uint256)').toLowerCase(),
  toFunctionSelector('cancelTimeLockExecution(uint256)').toLowerCase(),
  toFunctionSelector('executeWithTimeLock(address,uint256,bytes4,bytes,uint256,bytes32)').toLowerCase(),
]);

/** Operation type registered by the default guard schema for ERC-20 transfers. */
const ERC20_TRANSFER_OPERATION = keccak256(toBytes('ERC20_TRANSFER'));

export type Actor = 'owner' | 'manager';

export interface WireResult {
  hash: Hex;
  txId: string;
  to: Address;
  amount: string;
  releaseTime: string;
  chainNow: string;
  serverNow: string;
  status: RecordStatus;
}

export interface DecisionResult {
  hash: Hex;
  txId: string;
  status: RecordStatus;
  actor: Actor;
  balanceAfter?: string;
  fee?: string;
}

const STATUS_NAMES: Record<number, RecordStatus> = {
  [TxStatus.UNDEFINED]: 'UNDEFINED',
  [TxStatus.PENDING]: 'PENDING',
  [TxStatus.EXECUTING]: 'EXECUTING',
  [TxStatus.PROCESSING_PAYMENT]: 'PROCESSING_PAYMENT',
  [TxStatus.CANCELLED]: 'CANCELLED',
  [TxStatus.COMPLETED]: 'COMPLETED',
  [TxStatus.FAILED]: 'FAILED',
};
export const statusName = (s: number | bigint): RecordStatus => STATUS_NAMES[Number(s)] ?? 'UNDEFINED';

/** Registry views are permissioned (V10) — read as the broadcaster, which holds a role on every account. */
function reader(account: Address) {
  return new GuardController(publicClient, broadcaster, account, chain);
}

/** The owner's own GuardController: writes are signed by Privy, paid by the owner's gas. */
function asOwner(player: Player, account: Address, txAudit?: TxAuditSink) {
  return new GuardController(publicClient, ownerWalletClient(chain, { owner: player.ownerAddress, walletId: player.walletId, account }, txAudit), account, chain);
}

function asManager(account: Address) {
  if (!manager || !managerAddress) throw Object.assign(new Error('No Branch Manager configured (MANAGER_PK)'), { statusCode: 400, code: 'NO_MANAGER' });
  return { gc: new GuardController(publicClient, manager, account, chain), from: managerAddress };
}

const stageFor =
  (player: Player, jobId: string) =>
  (stage: StageEvent['stage'], bankLine: string, extra: Partial<StageEvent> = {}) =>
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'B', stage, bankLine, serverNow: nowSec(), ...extra });

const nowSec = () => String(Math.floor(Date.now() / 1000));

/** Shared player-facing line for a mined release whose AccountBlox record is FAILED. */
export const RECORD_FAILED_BANK_LINE = 'The release was mined, but execution failed — your available balance may have been spent down, so nothing was sent.';

/**
 * Selectors for the protocol errors the vault actually produces. The SDK's `GuardController` ABI does not
 * carry `SharedValidation`'s custom errors, so viem cannot name them: it reports "reverted with the
 * following signature: 0x…" and hands back four raw bytes. `decodeRevertReason` handles the rest.
 */
const ERROR_SELECTORS: Record<string, string> = {
  [toFunctionSelector('BeforeReleaseTime(uint256,uint256)')]: 'BeforeReleaseTime',
  [toFunctionSelector('NoPermission(address)')]: 'NoPermission',
  [toFunctionSelector('TransactionNotPending(uint256)')]: 'TransactionNotPending',
  [toFunctionSelector('CanOnlyApprovePending(uint256)')]: 'CanOnlyApprovePending',
  [toFunctionSelector('CanOnlyCancelPending(uint256)')]: 'CanOnlyCancelPending',
  [toFunctionSelector('MetaTxExpired(uint256,uint256)')]: 'MetaTxExpired',
  [toFunctionSelector('TransactionNotFound(uint256)')]: 'TransactionNotFound',
  // U4+: a Priority payload prepared before a counter pay carries a stale signer nonce (`0x06427aeb`). The SDK's
  // ERROR_SIGNATURES lists InvalidNonce with a different parameter list, so it cannot name this one.
  [toFunctionSelector('InvalidNonce(uint256,uint256)')]: 'InvalidNonce',
  [toFunctionSelector('SignerNotAuthorized(address)')]: 'SignerNotAuthorized',
  [toFunctionSelector('InvalidSignature(bytes)')]: 'InvalidSignature',
  // S1b: the FX guard's own refusals. `TargetNotWhitelisted` is the one the security story rests on — the account
  // asked to call a contract that is not on its list — and K7-e reported it as "Unknown" until it was named here.
  [toFunctionSelector('TargetNotWhitelisted(address,bytes4)')]: 'TargetNotWhitelisted',
  [toFunctionSelector('HandlerForSelectorMismatch(bytes4,bytes4)')]: 'HandlerForSelectorMismatch',
  [toFunctionSelector('NoPermissionForFunction(address,bytes4)')]: 'NoPermissionForFunction',
};

/**
 * Last resort before "Unknown": the SDK ships a selector → name table for the whole protocol
 * (`ERROR_SIGNATURES`). `ERROR_SELECTORS` above stays because it overrides that table where the two disagree on a
 * parameter list (`InvalidNonce`), and because it is the list of errors this bank has actually seen and written a
 * line for. This fallback simply means a protocol error we have never met is still reported by **name**.
 */
const SDK_ERROR_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(ERROR_SIGNATURES as Record<string, { name: string }>).map(([selector, sig]) => [selector.toLowerCase(), sig.name]),
);

/** Pull the revert payload out of viem's error chain — structured fields first, never the message text. */
function revertData(e: unknown): Hex | undefined {
  const seen = new Set<unknown>();
  const queue: unknown[] = [e];
  const looksLikeRevert = (hex: string): hex is Hex => {
    if (!/^0x[0-9a-fA-F]{8,}$/.test(hex)) return false;
    // Request calldata is often attached as `error.data` by getContractError — that is not a revert.
    if (WRITE_CALL_SELECTORS.has(hex.slice(0, 10).toLowerCase())) return false;
    // A revert payload is a selector plus whole 32-byte words. The SDK's `extractErrorData` grabs the first hex run in
    // the message — on a write failure that is the `from` address, which then "decodes" as ReadableText "yT'VUZt.k".
    if ((hex.length - 10) % 64 !== 0) return false;
    return true;
  };
  while (queue.length) {
    const cur = queue.shift() as
      | {
          data?: unknown;
          raw?: unknown;
          errorData?: unknown;
          originalError?: unknown;
          cause?: unknown;
        }
      | undefined;
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const candidate of [cur.errorData, cur.raw, cur.data]) {
      if (typeof candidate === 'string' && looksLikeRevert(candidate)) return candidate;
      if (candidate && typeof candidate === 'object') {
        const nested = (candidate as { data?: unknown }).data;
        if (typeof nested === 'string' && looksLikeRevert(nested)) return nested;
      }
    }
    // viem decoded it against the ABI: { abiItem, errorName, args } — no raw hex to return
    if ((cur.data as { errorName?: string } | undefined)?.errorName) continue;
    if (cur.cause) queue.push(cur.cause);
    if (cur.originalError) queue.push(cur.originalError);
  }
  return undefined;
}
function viemErrorName(e: unknown): string | undefined {
  for (let cur = e as { data?: { errorName?: string }; cause?: unknown } | undefined; cur; cur = cur.cause as never) {
    if (cur.data?.errorName) return cur.data.errorName;
  }
  return undefined;
}

/** Logs must never carry the RPC endpoint (it embeds the provider key). */
const redactRpc = (s: string) => s.replace(/https?:\/\/[^\s"')]+/g, '<rpc>');

/** Flatten shortMessage/message/details across the viem cause chain (simulation often nests the real reason). */
function errorTextChain(e: unknown): string {
  const parts: string[] = [];
  for (let cur = e as { shortMessage?: string; message?: string; details?: string; cause?: unknown } | undefined; cur; cur = cur.cause as never) {
    for (const p of [cur.shortMessage, cur.message, cur.details]) {
      if (typeof p === 'string' && p.trim()) parts.push(p);
    }
  }
  return parts.join('\n');
}

/**
 * The session signer answered instead of the chain. viem wraps the Privy SDK's HTTP error (`BadRequestError`,
 * `status`, `error: { error, code }`) as the `cause` of a ContractFunctionExecutionError, and the SDK then flattens it
 * to "unknown error executing…" — so walk the chain for it *first*. `policy_violation` is Privy's default DENY: the
 * request matched no ALLOW rule (Lane B #14: the release rule had been pinned away). Anything else from Privy
 * (401 auth, 5xx) is `SignerError`. Never a contract revert; nothing was broadcast.
 */
export function privyDenial(e: unknown): { code: 'PolicyDenied' | 'SignerError'; detail: string } | undefined {
  const seen = new Set<unknown>();
  for (let cur = e as Record<string, unknown> | undefined; cur && typeof cur === 'object' && !seen.has(cur); cur = (cur.cause ?? cur.originalError) as never) {
    seen.add(cur);
    const body = cur.error as { error?: string; code?: string } | string | undefined;
    const code = typeof body === 'object' && body ? body.code : undefined;
    const status = Number(cur.status ?? cur.statusCode);
    const text = [typeof body === 'string' ? body : body?.error, cur.details].filter((x) => typeof x === 'string').join(' ');
    if (code === 'policy_violation' || /policy[_ ]violation/i.test(text)) {
      return { code: 'PolicyDenied', detail: `Privy ${status || 400} policy_violation: ${typeof body === 'object' && body?.error ? body.error : text.slice(0, 200)}` };
    }
    if (body !== undefined && status >= 400 && (cur as { constructor?: { name?: string } }).constructor?.name?.endsWith('Error')) {
      return { code: 'SignerError', detail: `Privy ${status}: ${(typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 200)}` };
    }
  }
  return undefined;
}

/**
 * When there is no custom-error selector, classify transport / wallet failures that otherwise become
 * "Unknown: An unknown error occurred while executing…".
 */
function classifyOpaqueFailure(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/policy[_ ]violation/.test(t)) return 'PolicyDenied';
  if (/insufficient funds|exceeds the balance|intrinsic gas too low|gas required exceeds allowance/.test(t)) return 'OwnerGasDry';
  if (/http request failed|fetch failed|econnreset|etimedout|timeout|502|503|504|cloudflare|rate limit|too many requests/.test(t)) {
    return 'RpcError';
  }
  if (/nonce too low|replacement transaction underpriced|already known/.test(t)) return 'RpcError';
  return undefined;
}

/** Turn a revert into a bank line + the decoded protocol error name, when we can name it. */
export function explainRevert(e: unknown): { code: string; message: string; bankLine: string } {
  const err = e as Error & { shortMessage?: string; cause?: { message?: string } };
  // The SDK often re-wraps viem's error as plain text, so the decoded name only survives in the full message.
  const text = errorTextChain(e) || `${err.shortMessage ?? ''} ${err.message ?? ''} ${err.cause?.message ?? ''}`;
  const denial = privyDenial(e);
  if (denial) {
    return {
      code: denial.code,
      message: denial.detail,
      bankLine:
        denial.code === 'PolicyDenied'
          ? "The signing desk refused that slip — your account's signing rules need a re-check. Ask Iris, then try again."
          : 'The signing desk did not answer clearly — try again in a moment.',
    };
  }
  const data = revertData(e);
  const decoded = data ? decodeRevertReason(data) : null;
  // In order of trust: viem's own decode → a raw selector we know → the SDK's decoder → the selector viem printed
  // into the message (`signature "0x…"`) → the name viem printed when its ABI knew the error but the SDK re-wrapped
  // it as text (`Error: NoPermission(address caller)`). Written as steps, not one `??` chain: a regex literal after
  // `??` and a comment line was mis-parsed by the transpiler and silently skipped (U4+ kill-test run 3/4).
  const SIG_IN_TEXT = /signature:?\s*"?(0x[0-9a-fA-F]{8})"?/;
  const NAME_IN_TEXT = /Error: ([A-Z][A-Za-z0-9]+)\(/;
  let name: string | undefined = viemErrorName(e);
  if (!name && data) name = ERROR_SELECTORS[data.slice(0, 10).toLowerCase()];
  // Prefer curated / SDK selectors over ReadableText — that label is often binary custom-error bytes
  // misread as a string (e.g. "yT'VUZt.k" for NoPermission data).
  if (!name && decoded?.name && decoded.name !== 'ReadableText' && decoded.name !== 'CustomError') name = decoded.name;
  const sigInText = SIG_IN_TEXT.exec(text)?.[1]?.toLowerCase();
  if (!name && sigInText) name = ERROR_SELECTORS[sigInText];
  if (!name) name = NAME_IN_TEXT.exec(text)?.[1];
  // Only now fall back to the SDK's full table, so a curated name always wins over the generic one.
  if (!name && data) name = SDK_ERROR_NAMES[data.slice(0, 10).toLowerCase()];
  if (!name && sigInText) name = SDK_ERROR_NAMES[sigInText];
  if (!name && decoded?.name) name = decoded.name;
  if (!name || name === 'Unknown') {
    const opaque = classifyOpaqueFailure(text);
    if (opaque) name = opaque;
  }
  if (!name) name = 'Unknown';
  const bankLine =
    name === 'BeforeReleaseTime'
      ? 'Still cooling — the vault clock has not run down yet.'
      : name === 'NoPermission'
        ? 'That desk is not authorised to touch this wire.'
        : name === 'TransactionNotPending' || name === 'CanOnlyApprovePending' || name === 'CanOnlyCancelPending'
          ? 'That wire is no longer waiting in the vault.'
          : name === 'OwnerGasDry'
            ? 'Your account needs a little more network credit — ask Iris to re-check your account.'
            : name === 'RpcError'
              ? 'The chain did not answer clearly — try Release again in a moment.'
              : 'The vault would not accept that.';
  const message =
    decoded && decoded.name !== 'ReadableText'
      ? getUserFriendlyErrorMessage(decoded)
      : text.replace(/\s+/g, ' ').trim().slice(0, 400) || (err.message ?? String(e)).slice(0, 400);
  return { code: name, message, bankLine };
}

/** Decode `(to, amount)` out of a transfer record's execution params. */
function decodeTransfer(params: Hex): { to: Address; amount: string } | undefined {
  try {
    const [to, value] = decodeAbiParameters(parseAbiParameters('address, uint256'), params);
    return { to, amount: formatUnits(value, deployments().token.decimals) };
  } catch {
    return undefined;
  }
}

/** One record as the vault board shows it. `released` compares against wall-clock seconds (see `chainNow` note). */
export async function readWire(account: Address, txId: bigint): Promise<PendingWire> {
  const rec = await reader(account).getTransaction(txId);
  const releaseTime = BigInt(rec.releaseTime);
  const transfer = rec.params.executionSelector === EngineBlox.ERC20_TRANSFER_SELECTOR ? decodeTransfer(rec.params.executionParams as Hex) : undefined;
  return {
    txId: String(rec.txId),
    status: statusName(rec.status),
    releaseTime: releaseTime.toString(),
    released: releaseTime <= BigInt(nowSec()),
    requester: rec.params.requester,
    ...(transfer ?? {}),
  };
}

/** Every PENDING record on the account, with release times. `getPendingTransactions` + `getTransaction`. */
export async function listPending(account: Address): Promise<PendingWire[]> {
  const ids = await reader(account).getPendingTransactions();
  return Promise.all(ids.map((id) => readWire(account, BigInt(id))));
}

/**
 * Chain time on Remote EVM is the latest block's timestamp, and NethDev only mines when there is a
 * transaction — so between transactions `chainNow` stands still while the wall clock runs. The record's
 * `releaseTime` is what the contract will compare against `block.timestamp` *when the approval is mined*,
 * i.e. against the wall clock of that moment. The countdown therefore reads `releaseTime` from the chain
 * and ticks against wall time; `chainNow` is reported alongside for honesty, not used for the clock.
 */
async function chainNow(): Promise<string> {
  return (await publicClient.getBlock()).timestamp.toString();
}

/** POST /wire — owner files a time-locked transfer. Returns once the PENDING record is readable. */
export async function wire(player: Player, to: Address, amount: string, jobId: string, txAudit?: TxAuditSink): Promise<WireResult> {
  const account = player.account;
  if (!account) throw Object.assign(new Error('No account opened for this player'), { code: 'NO_ACCOUNT', statusCode: 400 });
  const { token } = deployments();
  const stage = stageFor(player, jobId);

  const value = parseUnits(amount, token.decimals);
  const freeBalance = (await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })) as bigint;
  if (value > freeBalance) {
    const free = formatUnits(freeBalance, token.decimals);
    const message = `Available balance is ${free} ${token.symbol}; requested wire is ${amount} ${token.symbol}. Nothing was filed.`;
    stage('failed', message, { reason: `InsufficientBalance: ${message}` });
    throw Object.assign(new Error(message), { statusCode: 400, code: 'InsufficientBalance' });
  }
  const params = encodeAbiParameters(parseAbiParameters('address, uint256'), [to, value]);
  const gc = asOwner(player, account, txAudit);

  // Give pre-flight simulation a current clock to work against (see chain.ts `tickChain`).
  await tickChain();
  stage('signing', 'Filing your wire with the vault…');
  let res;
  try {
    res = await gc.executeWithTimeLock(token.address, 0n, EngineBlox.ERC20_TRANSFER_SELECTOR, params, 200_000n, ERC20_TRANSFER_OPERATION, {
      from: player.ownerAddress,
    });
  } catch (e) {
    const why = explainRevert(e);
    stage('failed', why.bankLine, { reason: `${why.code}: ${why.message}` });
    throw Object.assign(new Error(`executeWithTimeLock refused: ${why.code}: ${why.message}`), { statusCode: 400, code: why.code });
  }
  stage('broadcasting', 'The vault is logging your request…', { hash: res.hash });
  const receipt = await res.wait();
  if (receipt.status !== 'success') {
    stage('failed', 'The vault did not accept that wire.', { hash: res.hash });
    throw new Error(`executeWithTimeLock reverted (${res.hash})`);
  }

  // The record just created is the highest pending id (V5 shape: monotonic counter, no log decoding).
  const pending = await reader(account).getPendingTransactions();
  if (!pending.length) throw new Error(`executeWithTimeLock mined (${res.hash}) but no PENDING record is readable`);
  const txId = pending.reduce((m, x) => (BigInt(x) > m ? BigInt(x) : m), 0n);
  const rec = await readWire(account, txId);
  const now = await chainNow();

  const fee = await receiptFee(res.hash as Hex);
  stage('pending', `Wire of ${amount} ${token.symbol} is in the vault. The clock is running.`, {
    hash: res.hash,
    txId: rec.txId,
    fee,
    releaseTime: rec.releaseTime,
    chainNow: now,
    status: rec.status,
  });
  watch(player, account, txId, jobId);
  return { hash: res.hash as Hex, txId: rec.txId, to, amount, releaseTime: rec.releaseTime, chainNow: now, serverNow: nowSec(), status: rec.status };
}

/** POST /approve — open the vault. Owner by default; `actor: 'manager'` uses the Branch Manager's role. */
export async function approve(player: Player, txId: bigint, actor: Actor, jobId: string, txAudit?: TxAuditSink): Promise<DecisionResult> {
  return decide(player, txId, actor, 'approve', jobId, txAudit);
}

/** POST /cancel — recall a wire while it is still PENDING. */
export async function cancel(player: Player, txId: bigint, actor: Actor, jobId: string, txAudit?: TxAuditSink): Promise<DecisionResult> {
  return decide(player, txId, actor, 'cancel', jobId, txAudit);
}

async function decide(player: Player, txId: bigint, actor: Actor, kind: 'approve' | 'cancel', jobId: string, txAudit?: TxAuditSink): Promise<DecisionResult> {
  const account = player.account;
  if (!account) throw Object.assign(new Error('No account opened for this player'), { code: 'NO_ACCOUNT', statusCode: 400 });
  const { token } = deployments();
  const stage = stageFor(player, jobId);

  // The contract compares `releaseTime` to the timestamp of the block that mines this call, but the SDK
  // simulates first and viem estimates gas — both replayed against the latest block. Mine one so those
  // replays see the same clock the real transaction will. The contract still makes the decision.
  await tickChain();
  const before = await readWire(account, txId);
  if (before.status !== 'PENDING') {
    throw Object.assign(new Error(`record ${txId} is ${before.status}, not PENDING`), { statusCode: 409, code: 'NOT_PENDING' });
  }

  const { gc, from } = actor === 'manager' ? asManager(account) : { gc: asOwner(player, account, txAudit), from: player.ownerAddress };

  if (actor === 'manager') {
    await maybeTopUp('pre-manager-cancel');
  }

  // Owner-paid path: viem reserves gas×maxFeePerGas up front. Half of SEPOLIA_OWNER_GAS_ETH (~0.0015) is
  // not enough when maxFee spikes — top to the full target before Release/Recall, and pin a quiet Sepolia fee.
  if (actor === 'owner') {
    const targetWei = parseEther(config.ownerGasEth);
    try {
      await fundOwnerGas(player.ownerAddress, { minWei: targetWei });
    } catch (e) {
      console.warn('[laneB] fundOwnerGas before decide:', (e as Error).message?.slice(0, 200));
    }
    const ownerWei = await publicClient.getBalance({ address: player.ownerAddress });
    if (ownerWei < targetWei / 2n) {
      const bal = formatEther(ownerWei);
      const message = `Owner wallet holds ${bal} ETH; need ~${formatEther(targetWei / 2n)} for a vault call (target ${config.ownerGasEth}). Ask Iris to re-check.`;
      stage('failed', 'Your account needs a little more network credit — ask Iris to re-check your account.', {
        txId: String(txId),
        reason: `OwnerGasDry: ${message}`,
        releaseTime: before.releaseTime,
        chainNow: await chainNow(),
      });
      throw Object.assign(new Error(message), { statusCode: 400, code: 'OwnerGasDry' });
    }
  }

  const who = actor === 'manager' ? 'The manager is' : 'You are';
  stage('signing', kind === 'approve' ? `${who} opening the vault…` : `${who} recalling the wire…`, { txId: String(txId), releaseTime: before.releaseTime });

  // Skip the SDK's strict pre-flight simulate. With the Privy-backed wallet client that eth_call is unreliable
  // (and viem's getContractError then labels unrelated send failures as "executing approveTimeLockExecution").
  // PENDING + releaseTime are still enforced by readWire and by the contract on the mined call.
  // gasPrice → SDK sets maxFeePerGas (and a 1 gwei tip cap) so the balance reserve stays predictable on Sepolia.
  const writeOpts = {
    from,
    simulationMode: 'skip' as const,
    gas: VAULT_DECISION_GAS,
    gasPrice: parseGwei('3').toString(),
  };

  const send = () => (kind === 'approve' ? gc.approveTimeLockExecution(txId, writeOpts) : gc.cancelTimeLockExecution(txId, writeOpts));
  let res;
  try {
    try {
      res = await send();
    } catch (e) {
      // Privy said no before anything was broadcast. The one cause we have met is our own: the player's release/recall
      // rule had been overwritten (Lane B #14). Reconcile the rules by name against Privy and sign once more; a second
      // refusal is reported as what it is. Manager sends use a plain key, so there is nothing to heal there.
      if (actor !== 'owner' || privyDenial(e)?.code !== 'PolicyDenied') throw e;
      console.warn(`[laneB] ${kind} txId=${txId} PolicyDenied — reconciling tx rules and retrying once: ${privyDenial(e)?.detail}`);
      await ensureTxPolicy(player, account);
      res = await send();
    }
  } catch (e) {
    const why = explainRevert(e);
    // Desk operators: the bridge only carries a short reason, so the full cause chain goes to the log (no secrets —
    // RPC URLs redacted). This is what proves *where* a Release died: Privy, prepare, or sendRawTransaction.
    if (why.code !== 'BeforeReleaseTime' && !ERROR_SELECTORS[revertData(e)?.slice(0, 10).toLowerCase() ?? '']) {
      console.warn(`[laneB] ${kind} txId=${txId} ${why.code}: ${why.message}\n  chain: ${redactRpc(errorTextChain(e)).slice(0, 1500)}\n  privy: ${JSON.stringify(privyDenial(e) ?? null)}`);
    }
    stage('failed', why.bankLine, { txId: String(txId), reason: `${why.code}: ${why.message}`, releaseTime: before.releaseTime, chainNow: await chainNow() });
    throw Object.assign(new Error(`${kind} refused: ${why.code}: ${why.message}`), { statusCode: why.code === 'BeforeReleaseTime' ? 425 : 400, code: why.code });
  }
  stage('broadcasting', 'Taking it to the vault door…', { hash: res.hash, txId: String(txId) });
  const receipt = await res.wait();
  const after = await readWire(account, txId);

  if (receipt.status !== 'success' || (kind === 'approve' ? after.status !== 'COMPLETED' : after.status !== 'CANCELLED')) {
    const code = after.status === 'FAILED' ? 'RECORD_FAILED' : 'RECORD_' + after.status;
    stage('failed', after.status === 'FAILED' ? RECORD_FAILED_BANK_LINE : kind === 'approve' ? 'The wire did not go through.' : 'The wire could not be recalled.', {
      hash: res.hash,
      txId: String(txId),
      status: after.status,
      reason: `${code}: ${kind} mined but record is ${after.status}`,
    });
    // 409: the outer tx may have mined; the record did not settle as expected (business conflict, not a desk crash).
    throw Object.assign(new Error(`${kind} mined but record is ${after.status} (${res.hash})`), { statusCode: 409, code });
  }

  const balanceAfter =
    kind === 'approve'
      ? formatUnits(
          (await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })) as bigint,
          token.decimals,
        )
      : undefined;

  const fee = await receiptFee(res.hash as Hex);
  stage(kind === 'approve' ? 'mined' : 'cancelled', kind === 'approve' ? `Wire released: ${after.amount ?? ''} ${token.symbol} sent.` : 'Wire recalled. Nothing left the vault.', {
    hash: res.hash,
    txId: String(txId),
    status: after.status,
    fee,
  });
  return { hash: res.hash as Hex, txId: String(txId), status: after.status, actor, balanceAfter, fee };
}

// ============ watcher ============

/**
 * One poller per pending record: re-reads `getTransaction` and pushes `pending` ticks (with the chain's
 * `releaseTime`) while the clock runs, one `released` when wall time passes it, and the final status if
 * someone else — the manager, another tab — settled the record. Stops when the record leaves PENDING or
 * after an hour. Restart-safe: `resumeWatchers` re-arms from `getPendingTransactions`.
 */
const watchers = new Map<string, NodeJS.Timeout>();
const WATCH_TICK_MS = 5_000;
const WATCH_MAX_MS = 60 * 60_000;

export function watch(player: Player, account: Address, txId: bigint, jobId: string): void {
  const key = `${account}:${txId}`;
  if (watchers.has(key)) return;
  const started = Date.now();
  let announcedRelease = false;
  const stage = stageFor(player, jobId);

  const tick = async () => {
    try {
      const rec = await readWire(account, txId);
      if (rec.status !== 'PENDING') {
        stop();
        if (hasSubscribers(player.privyUserId)) {
          stage(rec.status === 'COMPLETED' ? 'mined' : rec.status === 'CANCELLED' ? 'cancelled' : 'failed', rec.status === 'COMPLETED' ? 'Wire released.' : rec.status === 'CANCELLED' ? 'Wire recalled.' : 'Wire failed.', {
            txId: rec.txId,
            status: rec.status,
          });
        }
        return;
      }
      if (rec.released && !announcedRelease) {
        announcedRelease = true;
        stage('released', 'The vault clock has run down — ready to release (still PENDING until you open it).', { txId: rec.txId, releaseTime: rec.releaseTime, chainNow: await chainNow(), status: rec.status });
      } else if (!rec.released && hasSubscribers(player.privyUserId)) {
        stage('pending', 'The vault clock is running.', { txId: rec.txId, releaseTime: rec.releaseTime, chainNow: await chainNow(), status: rec.status });
      }
      if (Date.now() - started > WATCH_MAX_MS) stop();
    } catch {
      /* transient RPC error; try again next tick */
    }
  };
  const stop = () => {
    const t = watchers.get(key);
    if (t) clearInterval(t);
    watchers.delete(key);
  };
  watchers.set(key, setInterval(() => void tick(), WATCH_TICK_MS));
}

/** Re-arm pollers for every PENDING record on an account (SSE reconnect, Teller Desk restart). */
export async function resumeWatchers(player: Player): Promise<PendingWire[]> {
  if (!player.account) return [];
  const pending = await listPending(player.account);
  for (const w of pending) watch(player, player.account, BigInt(w.txId), `wire-${w.txId}`);
  return pending;
}
