/**
 * Priority release (U4+, G5b) — Mr. Okafor's desk. The third way out of the vault.
 *
 *   Wait      Ruth: owner `approveTimeLockExecution` after `releaseTime`, silent session signer (laneB.ts).
 *   Priority  Okafor: the owner signs a `SIGN_META_APPROVE` meta-transaction **in the browser with a Passkey**,
 *             the Branch Manager submits `approveTimeLockExecutionWithMetaTx` **before** `releaseTime`.
 *   Recall    owner or manager `cancelTimeLockExecution` while PENDING (laneB.ts).
 *
 * `EngineBlox._txApprovalWithMetaTx` deliberately skips the `releaseTime` check (ENG-2026-0012). U2 closed that path
 * by granting nobody the META_APPROVE bits; U4+ reopens it on purpose, split the only way the contract allows —
 * one role signs, another executes (`ConflictingMetaTxPermissions`) — and makes the owner's half cost a human check:
 * the session signer's policy only signs `SIGN_META_REQUEST_AND_APPROVE`, so this payload can only be signed by the
 * player's own signer, which Privy puts behind the Passkey (`useMfa().promptMfa()` + `signTypedData` with UI).
 *
 * Two round trips, because the signature is made in the browser:
 *   POST /priority/prepare {txId}               → unsigned meta-tx built by the contract, typed data for the wallet
 *   POST /priority/submit  {priorityId, signature} → signature verified (recover == owner), manager submits, COMPLETED
 *
 * Okafor is not a second Ruth: a wire whose clock has already run down is refused here (`NOT_COOLING`) — Ruth
 * releases it silently. A vault-only branch (`PRIORITY_RELEASE=off`) refuses everything (`PRIORITY_OFF`).
 */
import { randomUUID } from 'node:crypto';
import { createWalletClient, formatUnits, http, type Address, type Chain, type Hex, type TypedDataDefinition } from 'viem';
import { toAccount } from 'viem/accounts';
import { GuardController, GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL, MetaTransactionSigner, TxAction } from '@bloxchain/sdk';
import { EIP712_DOMAIN_TYPE, META_TX_DOMAIN_NAME, META_TX_PRIMARY_TYPE, META_TX_TYPED_DATA_TYPES, erc20Abi, type PriorityTypedData, type StageEvent } from '@branch-zero/shared';
import { broadcaster, chain, manager, managerAddress, metaTxDuration, publicClient } from '../chain.ts';
import { config, deployments } from '../config.ts';
import { emitStage, type Player } from '../store.ts';
import { receiptFee } from '../fees.ts';
import { explainRevert, readWire, RECORD_FAILED_BANK_LINE, statusName } from './laneB.ts';

type Unsigned = Awaited<ReturnType<GuardController['generateUnsignedMetaTransactionForExisting']>>;

interface Prepared {
  priorityId: string;
  privyUserId: string;
  account: Address;
  owner: Address;
  txId: bigint;
  jobId: string;
  unsigned: Unsigned;
  releaseTime: string;
  /** Unix seconds — the meta-tx deadline the contract will check; the browser must sign and we must submit before it. */
  deadline: number;
}

export interface PriorityPrepared {
  priorityId: string;
  txId: string;
  releaseTime: string;
  deadline: string;
  serverNow: string;
  /** Who must sign (the account holder) and who will submit (the Branch Manager's runtime role). */
  signer: Address;
  submitter: Address;
  typedData: PriorityTypedData;
}

export interface PriorityResult {
  hash: Hex;
  txId: string;
  status: string;
  actor: 'priority';
  releaseTime: string;
  /** Latest block timestamp after mining — for the record: strictly below `releaseTime` on a real Priority. */
  chainNow: string;
  balanceAfter: string;
  fee?: string;
}

/** Prepared payloads waiting for a Passkey. Small, in memory: a signature is worth nothing after its deadline. */
const prepared = new Map<string, Prepared>();
const PREPARE_TTL_SEC = 600;

const nowSec = () => Math.floor(Date.now() / 1000);

function err(message: string, code: string, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

/** Registry views are permissioned (V10) — read as the broadcaster, which holds a role on every account. */
function reader(account: Address) {
  return new GuardController(publicClient, broadcaster, account, chain);
}

function requirePriorityDesk(): { gc: (account: Address) => GuardController; from: Address } {
  if (!manager || !managerAddress) throw err('No Branch Manager configured (MANAGER_PK)', 'NO_MANAGER');
  if (!config.priorityRelease) throw err('This branch is vault-only (PRIORITY_RELEASE=off): no priority releases', 'PRIORITY_OFF');
  const from = managerAddress;
  return { gc: (account: Address) => new GuardController(publicClient, manager, account, chain), from };
}

const stageFor =
  (player: Player, jobId: string) =>
  (stage: StageEvent['stage'], bankLine: string, extra: Partial<StageEvent> = {}) =>
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'B', stage, bankLine, serverNow: String(nowSec()), via: 'priority', ...extra });

/** BigInt → decimal string, recursively. EIP-712 JSON takes decimal strings; the browser cannot receive BigInts. */
function jsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as unknown as T;
  if (Array.isArray(value)) return value.map(jsonSafe) as unknown as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, jsonSafe(v)])) as T;
  return value;
}

/**
 * Ask the SDK for the exact typed data it would sign, without signing. The SDK keeps `META_TX_DOMAIN` /
 * `META_TX_TYPES` private, so we lend `MetaTransactionSigner` a viem account whose `signTypedData` records what it
 * was given and bails out. The SDK therefore stays the single source of the EIP-712 shape (U0 decision), and the
 * transcription in `packages/shared` is checked against it here rather than trusted.
 */
class Captured extends Error {
  constructor(public typedData: TypedDataDefinition) {
    super('typed data captured');
  }
}
async function typedDataFor(unsigned: Unsigned, owner: Address, account: Address, c: Chain): Promise<TypedDataDefinition> {
  const capturing = toAccount({
    address: owner,
    async signTypedData(td) {
      throw new Captured(td as TypedDataDefinition);
    },
    async signMessage() {
      throw new Error('not used');
    },
    async signTransaction() {
      throw new Error('not used');
    },
  });
  const wc = createWalletClient({ account: capturing, chain: c, transport: http(config.rpcUrl) });
  try {
    await new MetaTransactionSigner(publicClient, wc, account, c).signMetaTransactionWithWallet(unsigned);
  } catch (e) {
    if (e instanceof Captured) return e.typedData;
    throw e;
  }
  throw new Error('MetaTransactionSigner returned without asking the wallet to sign');
}

function assertShape(td: TypedDataDefinition): void {
  const domain = td.domain as { name?: string } | undefined;
  if (domain?.name !== META_TX_DOMAIN_NAME) throw new Error(`SDK EIP-712 domain name is ${domain?.name}, expected ${META_TX_DOMAIN_NAME}`);
  if (td.primaryType !== META_TX_PRIMARY_TYPE) throw new Error(`SDK primary type is ${td.primaryType}, expected ${META_TX_PRIMARY_TYPE}`);
  const sdkTypes = td.types as Record<string, ReadonlyArray<{ name: string; type: string }>>;
  for (const [name, fields] of Object.entries(META_TX_TYPED_DATA_TYPES)) {
    const got = sdkTypes[name];
    const same = got && got.length === fields.length && fields.every((f, i) => got[i]?.name === f.name && got[i]?.type === f.type);
    if (!same) throw new Error(`packages/shared META_TX_TYPED_DATA_TYPES.${name} has drifted from the SDK — fix the transcription before shipping a Priority`);
  }
}

/** Step 1 — build the bypass payload for the player's Passkey. Refuses anything Okafor must not touch. */
export async function preparePriority(player: Player, txId: bigint, jobId: string): Promise<PriorityPrepared> {
  const account = player.account;
  if (!account) throw err('No account opened for this player', 'NO_ACCOUNT');
  const desk = requirePriorityDesk();
  if (!player.priority) {
    throw err(`account ${account} was provisioned without the Priority grant split — run /provision (Re-check)`, 'NOT_CONFIGURED', 409);
  }
  const stage = stageFor(player, jobId);

  const rec = await readWire(account, txId);
  if (rec.status !== 'PENDING') throw err(`record ${txId} is ${rec.status}, not PENDING`, 'NOT_PENDING', 409);
  if (rec.released) throw err(`record ${txId} passed its releaseTime (${rec.releaseTime}) — that is Ruth's window, not a priority release`, 'NOT_COOLING', 409);

  // The owner's half: SIGN_META_APPROVE for the manager's meta handler. Nonce and digest come from the contract.
  const duration = await metaTxDuration();
  const params = await reader(account).createMetaTxParams(account, GC_SEL.APPROVE_TIMELOCK_EXECUTION_META_SELECTOR, TxAction.SIGN_META_APPROVE, duration, 0n, player.ownerAddress);
  const unsigned = await reader(account).generateUnsignedMetaTransactionForExisting(txId, params);
  const td = await typedDataFor(unsigned, player.ownerAddress, account, chain);
  assertShape(td);

  const priorityId = randomUUID().slice(0, 12);
  const deadline = Number(params.deadline);
  prepared.set(priorityId, { priorityId, privyUserId: player.privyUserId, account, owner: player.ownerAddress, txId, jobId, unsigned, releaseTime: rec.releaseTime, deadline });
  setTimeout(() => prepared.delete(priorityId), PREPARE_TTL_SEC * 1000).unref();

  stage('signing', 'Hand scan at the manager’s desk — waiting for your Passkey…', { txId: rec.txId, releaseTime: rec.releaseTime });
  const typedData: PriorityTypedData = jsonSafe({
    types: { EIP712Domain: [...EIP712_DOMAIN_TYPE], ...(td.types as unknown as Record<string, Array<{ name: string; type: string }>>) },
    primaryType: META_TX_PRIMARY_TYPE,
    domain: td.domain as PriorityTypedData['domain'],
    message: td.message as Record<string, unknown>,
  });
  return {
    priorityId,
    txId: rec.txId,
    releaseTime: rec.releaseTime,
    deadline: String(deadline),
    serverNow: String(nowSec()),
    signer: player.ownerAddress,
    submitter: desk.from,
    typedData,
  };
}

/** Step 2 — the player's signature is back; the manager submits the meta-approve. Completes before the clock. */
export async function submitPriority(player: Player, priorityId: string, signature: Hex, jobId: string): Promise<PriorityResult> {
  const p = prepared.get(priorityId);
  if (!p || p.privyUserId !== player.privyUserId) throw err(`no priority payload ${priorityId} waiting for this player (expired, used, or never prepared)`, 'PRIORITY_EXPIRED', 410);
  const desk = requirePriorityDesk();
  const { token } = deployments();
  const stage = stageFor(player, p.jobId || jobId);

  // Recover == owner, or the SDK refuses. This is the same check the contract makes; nothing is broadcast otherwise.
  let signed: Unsigned;
  try {
    signed = await new MetaTransactionSigner(publicClient, undefined, p.account, chain).createSignedMetaTransactionWithSignature(p.unsigned, signature);
  } catch (e) {
    stage('failed', 'That hand scan does not match the account holder.', { txId: String(p.txId), reason: `InvalidSignature: ${(e as Error).message}` });
    throw err(`priority signature does not recover to the owner: ${(e as Error).message}`, 'InvalidSignature');
  }
  if (nowSec() >= p.deadline) {
    prepared.delete(priorityId);
    throw err(`priority payload expired at ${p.deadline}`, 'PRIORITY_EXPIRED', 410);
  }
  // The clock may have run out while the player scanned. Then it is Ruth's release, silent — not a priority stamp.
  const before = await readWire(p.account, p.txId);
  if (before.status !== 'PENDING') {
    prepared.delete(priorityId);
    throw err(`record ${p.txId} is ${before.status}, not PENDING`, 'NOT_PENDING', 409);
  }
  if (before.released) {
    prepared.delete(priorityId);
    stage('failed', 'The clock ran down while you scanned — Ruth can release it now, no scan needed.', { txId: String(p.txId), releaseTime: before.releaseTime });
    throw err(`record ${p.txId} passed its releaseTime during the hand scan — use Ruth's release`, 'NOT_COOLING', 409);
  }

  stage('broadcasting', 'Hand scan on file. The manager is stamping a priority release…', { txId: String(p.txId), releaseTime: before.releaseTime });
  let res;
  try {
    res = await desk.gc(p.account).approveTimeLockExecutionWithMetaTx(signed, { from: desk.from });
  } catch (e) {
    const why = explainRevert(e);
    stage('failed', why.bankLine, { txId: String(p.txId), reason: `${why.code}: ${why.message}`, releaseTime: before.releaseTime });
    throw Object.assign(new Error(`priority release refused: ${why.code}: ${why.message}`), { statusCode: 400, code: why.code });
  }
  prepared.delete(priorityId);
  const receipt = await res.wait();
  const after = await readWire(p.account, p.txId);
  if (receipt.status !== 'success' || after.status !== 'COMPLETED') {
    const code = after.status === 'FAILED' ? 'RECORD_FAILED' : 'RECORD_' + after.status;
    stage('failed', after.status === 'FAILED' ? RECORD_FAILED_BANK_LINE : 'The priority release did not go through.', {
      hash: res.hash,
      txId: String(p.txId),
      status: after.status,
      reason: `${code}: priority meta-approve mined but record is ${after.status}`,
    });
    throw Object.assign(new Error(`priority meta-approve mined but record is ${after.status} (${res.hash})`), { statusCode: 500, code });
  }
  const block = await publicClient.getBlock({ blockHash: receipt.blockHash });
  const balanceAfter = formatUnits((await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [p.account] })) as bigint, token.decimals);
  const fee = await receiptFee(res.hash as Hex);
  stage('mined', `Priority release: ${after.amount ?? ''} ${token.symbol} sent before the clock — hand scan on file.`, {
    hash: res.hash,
    txId: String(p.txId),
    status: after.status,
    releaseTime: before.releaseTime,
    chainNow: block.timestamp.toString(),
    fee,
  });
  return {
    hash: res.hash as Hex,
    txId: String(p.txId),
    status: statusName(after.status === 'COMPLETED' ? 5 : 0),
    actor: 'priority',
    releaseTime: before.releaseTime,
    chainNow: block.timestamp.toString(),
    balanceAfter,
    fee,
  };
}

/** For the kill tests: the unsigned payload behind a prepared id (never exposed over HTTP). */
export function peekPrepared(priorityId: string): Unsigned | undefined {
  return prepared.get(priorityId)?.unsigned;
}
