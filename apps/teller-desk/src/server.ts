/**
 * Teller Desk — U6 (Arc wing + the existing U4+ Priority manager role).
 *
 * Holds the two keys the browser must never see: the Privy P-256 authorization key (which lets it *ask*
 * a delegated wallet for a signature) and the broadcaster key (which pays gas). Neither can move a
 * player's money alone: the enclave only signs what the policy allows, and the broadcaster can only
 * submit meta-transactions the owner actually signed. U2 adds the vault: the owner's own transactions
 * (`executeWithTimeLock`, approve, cancel) signed by the session signer and broadcast from here, plus an
 * optional Branch Manager key holding a runtime role. U4+ adds the Priority desk: the owner signs a
 * `SIGN_META_APPROVE` payload in the browser behind a Passkey and the manager submits it before `releaseTime`
 * (`/priority/prepare` + `/priority/submit`); the manager's post-clock timed stamp is gone.
 *
 *   npm run dev:teller     # :8787, reads ../../.env
 */
import Fastify from 'fastify';
import { formatEther, getAddress, isAddress, type Address, type Hex } from 'viem';
import type { StageEvent } from '@branch-zero/shared';
import { broadcasterAddress, chain, deployerAddress, managerAddress, publicClient } from './chain.ts';
import { config, deployments, explorerTx, redact } from './config.ts';
import { createPlayerPolicy, ensureTypedDataRule, identify, recoverPolicy } from './privy.ts';
import { pay, passbook } from './lanes/laneA.ts';
import { approve, cancel, listPending, resumeWatchers, wire, type Actor } from './lanes/laneB.ts';
import { preparePriority, submitPriority } from './lanes/priority.ts';
import { ROLE_SET_VERSION, ensureTxPolicy, ensureTypedDataPolicy, faucetAccount, provision, recoverAccount } from './lanes/provision.ts';
import { loadAccount } from './lanes/loadAccount.ts';
import { available as ensAvailable, mint as ensMint, resolve as ensResolve, setText as ensSetText } from './ens.ts';
import { enableFx, fxStatus, quote as fxQuote, swap as fxSwap } from './lanes/fx.ts';
import { grantObserver, listObservers, observerPermissions, revokeObserver } from './lanes/observer.ts';
import { plan as treasuryPlan, serializeHealth as treasuryHealth, startTreasuryWatch, treasuryView } from './treasury.ts';
import { emitStage, getPlayer, listReceipts, newJobId, patchPlayer, serialize, subscribe, upsertPlayer, type Player } from './store.ts';
import type { SignatureAudit, TxAudit } from './signing/privySigner.ts';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization'] } });

app.addHook('onSend', async (req, reply) => {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Headers', 'content-type, authorization');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
});
app.options('/*', async (_req, reply) => reply.code(204).send());

/**
 * Resolve the caller from their Privy access token plus the embedded-wallet address they claim.
 * `identify` checks at Privy that the wallet really belongs to the authenticated user.
 */
async function requirePlayer(req: { headers: Record<string, unknown> }): Promise<Player> {
  const header = String(req.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw Object.assign(new Error('missing Privy access token'), { statusCode: 401, code: 'AUTH' });
  const id = await identify(token, String(req.headers['x-bz-owner'] ?? ''));
  const known = getPlayer(id.privyUserId);
  // `delegated` comes from Privy, so a revoked session signer downgrades the mode on the next request.
  const signingMode = id.delegated ? 'session' : 'client';
  return known ? patchPlayer(id.privyUserId, { ...id, signingMode }) : upsertPlayer({ ...id, signingMode });
}

/** Every signature request is logged with what was signed, so the audit trail is not a promise. */
function auditFor(player: Player) {
  return (e: SignatureAudit) =>
    app.log.info(
      { owner: e.owner, walletId: e.walletId, chainId: e.chainId, verifyingContract: e.verifyingContract, handlerSelector: e.handlerSelector, nonce: e.nonce, action: e.action, ms: e.ms },
      `privy session signer: typed data signed for ${player.privyUserId}`,
    );
}
/** Same for the owner's own transactions (U2): who, to which contract, which function, which nonce. */
function txAuditFor(player: Player) {
  return (e: TxAudit) =>
    app.log.info({ owner: e.owner, walletId: e.walletId, chainId: e.chainId, to: e.to, selector: e.selector, nonce: e.nonce, gas: e.gas, ms: e.ms }, `privy session signer: transaction signed for ${player.privyUserId}`);
}

/**
 * Treasury health, cached briefly. `/healthz` is polled by the overlay whenever the Live | Dev toggle moves,
 * and a treasury read is six extra RPC calls (its ETH, two token balances, and every staff EOA) — worth
 * showing, not worth repeating per poll.
 */
let treasuryCache: { at: number; value: unknown } | undefined;
const TREASURY_CACHE_MS = 15_000;
async function treasuryBlock(): Promise<unknown> {
  if (config.target !== 'sepolia') return null;
  if (treasuryCache && Date.now() - treasuryCache.at < TREASURY_CACHE_MS) return treasuryCache.value;
  try {
    const { snapshot, plan } = await treasuryPlan();
    const value = treasuryHealth(snapshot, plan);
    treasuryCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    // A treasury read must never be the reason the desk looks unhealthy.
    return { configured: Boolean(treasuryView()), error: (e as Error).message };
  }
}

app.get('/healthz', async () => {
  const d = deployments();
  try {
    const [chainId, block, broadcasterBal, deployerBal, managerBal] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBlockNumber(),
      publicClient.getBalance({ address: broadcasterAddress }),
      publicClient.getBalance({ address: deployerAddress }),
      managerAddress ? publicClient.getBalance({ address: managerAddress }) : Promise.resolve(0n),
    ]);
    return {
      ok: chainId === chain.id,
      unit: 'S2',
      /**
       * `live` = Sepolia, the product default; `dev` = Remote EVM Developer Mode. The board, the passbook and
       * this endpoint all name the **active payment chain** rather than assuming 1337 (docs/SEPOLIA-LIVE.md §6).
       */
      mode: config.mode,
      wing: config.target,
      chainName: chain.name,
      /** Where a judge can follow this wing's hashes. `null` on the private lab chain, which has no explorer. */
      explorer: explorerTx('hash')?.replace(/\/tx\/hash$/, '') ?? null,
      priorityRelease: config.priorityRelease,
      roleSetVersion: ROLE_SET_VERSION,
      chains: { [config.target]: { chainId, expected: chain.id, block: block.toString(), reachable: true } },
      broadcaster: { address: broadcasterAddress, balanceNative: formatEther(broadcasterBal), nativeSymbol: chain.nativeCurrency.symbol },
      deployer: { address: deployerAddress, balanceNative: formatEther(deployerBal), nativeSymbol: chain.nativeCurrency.symbol },
      manager: managerAddress ? { address: managerAddress, balanceNative: formatEther(managerBal), nativeSymbol: chain.nativeCurrency.symbol } : null,
      privy: { appId: config.privy.appId, signerId: config.privy.signerId, authorizationKey: redact(config.privy.authorizationKey) },
      contracts: { copyBlox: d.copyBlox, accountBloxImplementation: d.accountBloxImplementation, token: d.token },
      /**
       * S3 — the ops treasury, for the operator's desk-debug view and the funding runbook
       * (docs/SEPOLIA-TREASURY.md §5). Read-only by design: this endpoint is unauthenticated, so it
       * *reports* shortfalls and never triggers a send. The writers are the CLI, the pre-`cloneBlox` hook
       * and the interval watcher. `null` off the Live wing, where the lab funds itself.
       */
      treasury: await treasuryBlock(),
      timeLockSec: Number(config.timeLockSec),
    };
  } catch (e) {
    return { ok: false, unit: 'S2', mode: config.mode, wing: config.target, chainName: chain.name, chains: { [config.target]: { reachable: false, error: (e as Error).message } } };
  }
});

/**
 * Exchange a Privy access token for a Teller Desk session view of the player.
 *
 * Also mints the player's policy if they do not have one yet, and hands back its id: the overlay passes
 * that id to `addSessionSigners`, so the single consent the player gives covers both "who may sign" (our
 * key quorum) and "what they may sign" (this policy). We cannot attach either from here — the wallet is
 * owned by the player's own key quorum, which is the point.
 *
 * U2: a player the index has forgotten (restart, upgrade) is rehydrated from the chain (their clone) and
 * from Privy (their policy and rules) instead of being opened twice.
 */
app.post('/session', async (req, reply) => {
  try {
    let player = await requirePlayer(req as never);
    if (!player.policyId) {
      const recovered = await recoverPolicy(player.walletId, chain.id).catch(() => undefined);
      if (recovered?.policyId) {
        const policyRuleId = recovered.ruleId ?? (await ensureTypedDataRule(recovered.policyId, chain.id));
        player = patchPlayer(player.privyUserId, {
          policyId: recovered.policyId,
          policyRuleId,
          ...(recovered.txRules ? { txRuleIds: recovered.txRules.ruleIds, txPolicyMode: recovered.txRules.mode } : {}),
        });
      } else {
        const policy = await createPlayerPolicy(chain.id, player.ownerAddress.slice(2, 12).toLowerCase());
        player = patchPlayer(player.privyUserId, { policyId: policy.policyId, policyRuleId: policy.ruleId });
      }
    }
    if (!player.account) {
      const account = await recoverAccount(player.ownerAddress).catch(() => undefined);
      if (account) player = patchPlayer(player.privyUserId, { account });
    }
    // V6 — the eth_signTransaction rules must exist before the player consents (the consent carries the policy).
    try {
      player = await ensureTxPolicy(player, player.account);
    } catch (e) {
      app.log.warn({ err: (e as Error).message }, 'tx policy rules not ensured');
    }
    // U4+ — an older typed-data rule (no `params.action` pin) is tightened in place once the account is known.
    try {
      player = await ensureTypedDataPolicy(player);
    } catch (e) {
      app.log.warn({ err: (e as Error).message }, 'typed-data rule not tightened');
    }
    return {
      privyUserId: player.privyUserId,
      owner: player.ownerAddress,
      account: player.account ?? null,
      signingMode: player.signingMode,
      delegated: player.signingMode === 'session',
      signerId: config.privy.signerId,
      policyId: player.policyId,
      policyPinnedToAccount: Boolean(player.policyPinned),
      txPolicy: player.txRuleIds?.length ? { mode: player.txPolicyMode, pinnedToAccount: Boolean(player.txPolicyPinned), rules: player.txRuleIds.length } : null,
      chainId: chain.id,
      /** Which desk answered: the overlay's Live | Dev toggle reads this back rather than trusting its own state. */
      mode: config.mode,
      chainName: chain.name,
      /** Live trades out of the Main account itself; Dev's FX till is a separate Sepolia account (docs/SEPOLIA-LIVE.md §1). */
      fxTillIsMain: config.fxTillIsMain,
      token: deployments().token,
      timeLockSec: Number(config.timeLockSec),
      instantLimit: config.instantLimit,
      manager: managerAddress ?? null,
      ensName: player.ensName ?? null,
      /** U4+: this branch runs the Priority desk (manager key + PRIORITY_RELEASE) and this account carries the split. */
      priority: config.priorityRelease && Boolean(player.priority),
      roleSet: player.roleSet ?? 0,
      roleSetWanted: ROLE_SET_VERSION,
    };
  } catch (e) {
    return fail(reply, e);
  }
});

app.post('/provision', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const jobId = newJobId();
    const result = await serialize(player.privyUserId, () => provision(getPlayer(player.privyUserId)!, jobId, auditFor(player)));
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/**
 * Load Account (Ines) — adopt a specific AccountBlox the player owns on this wing (docs/LOAD-ACCOUNT.md).
 *
 * The escape hatch from `recoverAccount`, which can only ever return the **last** `BloxCloned` for an owner
 * (CopyBlox has no owner→clones map). "Open my account" keeps that last-clone default; this route is how a
 * player names an older vault or a second one and has the desk file it as their Main account instead.
 *
 * Deliberately **not** behind `requireConfigured`: a stranded account's whole problem is that its desk
 * permissions were never confirmed, and the sync this route runs is what confirms them. It is still session-
 * gated like everything else, and the lane refuses any address whose on-chain `owner()` is not the caller.
 */
app.post('/account/load', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { account?: string; address?: string };
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    const result = await serialize(player.privyUserId, () => loadAccount(current, body.account ?? body.address, jobId, auditFor(player)));
    app.log.info(
      { owner: current.ownerAddress, previous: result.previous, account: result.account, changed: result.changed, chainId: result.chainId, policyPinned: result.policyPinned, txPolicyPinned: result.txPolicyPinned, roleChanges: result.roleChanges.length },
      'account load: player-owned AccountBlox adopted as the Main account for this wing',
    );
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/** Explicit practice-credit top-up. Unlike Account Opening, this restores only the missing delta to the configured opening balance. */
app.post('/faucet', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    if (!current.account) throw Object.assign(new Error('No account opened for this player'), { statusCode: 400, code: 'NO_ACCOUNT' });
    const result = await serialize(player.privyUserId, () => faucetAccount(current.account!));
    return { ok: true, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/**
 * U4: a player whose account is on file but whose provisioning never recorded its end (`configured` /
 * `roleSet`) has no guarantee the counter and vault role grants landed — the 2026-09-07 playtest hit
 * `NoPermission` on `executeWithTimeLock` in exactly that state. Refuse with a code the clerk has a line for
 * ("ask Ines to re-check") instead of letting the chain refuse with a less helpful one. `/provision` is the
 * re-check: it reads the chain first and sends only what is missing.
 */
function requireConfigured(player: Player): void {
  if (!player.account) return; // the lanes answer NO_ACCOUNT themselves
  if (player.configured && (player.roleSet ?? 0) >= ROLE_SET_VERSION) return;
  throw Object.assign(new Error(`account ${player.account} is on file but its desk permissions are not confirmed (roleSet ${player.roleSet ?? 'none'}, want ${ROLE_SET_VERSION}) — run /provision (Re-check)`), {
    statusCode: 409,
    code: 'NOT_CONFIGURED',
  });
}

function parseTransfer(body: { to?: string; amount?: string }) {
  if (!body.to || !isAddress(body.to)) throw Object.assign(new Error('`to` must be an address'), { statusCode: 400, code: 'BAD_ARGS' });
  if (!body.amount || !/^\d+(\.\d+)?$/.test(body.amount)) throw Object.assign(new Error('`amount` must be a decimal string'), { statusCode: 400, code: 'BAD_ARGS' });
  return { to: getAddress(body.to) as Address, amount: body.amount };
}

app.post('/pay', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const { to, amount } = parseTransfer((req.body ?? {}) as { to?: string; amount?: string });
    if (Number(amount) > Number(config.instantLimit)) {
      // Off-chain routing only — docs/REFLECTION.md §2.2 records this as a partial invariant.
      throw Object.assign(new Error(`over the ${config.instantLimit} instant limit — that is a wire: use /wire`), { statusCode: 400, code: 'POLICY' });
    }
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    const result = await serialize(player.privyUserId, () => pay(current, to, amount, jobId, auditFor(player)));
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

// ============ U2 — the vault (Lane B) ============

/** File a time-locked wire. The counter routes large ones here, but the desk refuses a wire above free balance. */
app.post('/wire', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const { to, amount } = parseTransfer((req.body ?? {}) as { to?: string; amount?: string });
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    const result = await serialize(player.privyUserId, () => wire(current, to, amount, jobId, txAuditFor(player)));
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

function parseDecision(body: { txId?: string | number; as?: string }): { txId: bigint; actor: Actor } {
  if (body.txId === undefined || !/^\d+$/.test(String(body.txId))) throw Object.assign(new Error('`txId` must be a record id'), { statusCode: 400, code: 'BAD_ARGS' });
  const actor: Actor = body.as === 'manager' ? 'manager' : 'owner';
  return { txId: BigInt(body.txId), actor };
}

/**
 * Open the vault after `releaseTime` — the **wait** path, Ruth's window, always the owner (silent session signer).
 * U4+: `as: 'manager'` is refused. Mr. Okafor no longer holds the timed stamp (ROLE_SET 3 removed it); his desk is
 * `/priority/*`, which needs the player's Passkey, and `/cancel` (recall).
 */
app.post('/approve', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const { txId, actor } = parseDecision((req.body ?? {}) as never);
    if (actor === 'manager') {
      throw Object.assign(new Error('the Branch Manager does not stamp vault releases (U4+): Ruth releases after the clock, Okafor bypasses it with /priority'), { statusCode: 400, code: 'MANAGER_NO_STAMP' });
    }
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    const result = await serialize(player.privyUserId, () => approve(current, txId, 'owner', jobId, txAuditFor(player)));
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

// ============ U4+ — Priority release (Okafor's desk) ============

/**
 * Step 1: build the owner's `SIGN_META_APPROVE` payload for a wire that is still cooling. Returns EIP-712 typed data
 * for the player's own signer (Passkey in the browser) and a `priorityId` to hand back with the signature. Refuses a
 * released wire (`NOT_COOLING` — that is Ruth's), a settled one (`NOT_PENDING`), a vault-only branch (`PRIORITY_OFF`).
 */
app.post('/priority/prepare', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { txId?: string | number };
    if (body.txId === undefined || !/^\d+$/.test(String(body.txId))) throw Object.assign(new Error('`txId` must be a record id'), { statusCode: 400, code: 'BAD_ARGS' });
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    const result = await serialize(player.privyUserId, () => preparePriority(current, BigInt(body.txId!), jobId));
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/** Step 2: the Passkey-backed signature comes back; the Branch Manager submits the meta-approve before the clock. */
app.post('/priority/submit', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { priorityId?: string; signature?: string };
    if (!body.priorityId || !/^[0-9a-f-]{8,40}$/i.test(body.priorityId)) throw Object.assign(new Error('`priorityId` missing'), { statusCode: 400, code: 'BAD_ARGS' });
    if (!body.signature || !/^0x[0-9a-fA-F]{130}$/.test(body.signature)) throw Object.assign(new Error('`signature` must be 65 bytes hex'), { statusCode: 400, code: 'BAD_ARGS' });
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    const result = await serialize(player.privyUserId, () => submitPriority(current, body.priorityId!, body.signature as Hex, jobId));
    app.log.info({ owner: current.ownerAddress, account: current.account, txId: result.txId, hash: result.hash, releaseTime: result.releaseTime, chainNow: result.chainNow }, 'priority release: owner-signed meta-approve submitted by the Branch Manager');
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/** Recall a wire while it is PENDING. Same actor rule as /approve. */
app.post('/cancel', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const { txId, actor } = parseDecision((req.body ?? {}) as never);
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    const result = await serialize(player.privyUserId, () => cancel(current, txId, actor, jobId, txAuditFor(player)));
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

// ============ Stretch — Terminal Console: the OBSERVER viewing role (docs/TERMINAL-CONSOLE.md) ============

/**
 * The bank computer's three verbs. A viewing wallet is a member of the runtime `OBSERVER` role with **zero**
 * function permissions: it satisfies the `_validateAnyRole()` gate on the permissioned registry views (V10) so
 * the hosted Console can show this account, and it holds no `TxAction` bit on any selector, so it cannot pay,
 * wire, release, recall or reconfigure. Signed on the existing silent role-config lane — the terminal never
 * opens a second Privy surface.
 *
 * `requireConfigured` applies for the same reason the payment lanes use it: a half-provisioned account has no
 * guarantee its role machinery landed, and "ask Ines to re-check" is a better answer than a chain revert.
 */
app.post('/observer/grant', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { address?: string; wallet?: string };
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    const result = await serialize(player.privyUserId, () => grantObserver(current, body.address ?? body.wallet, jobId, auditFor(player)));
    app.log.info({ owner: current.ownerAddress, account: current.account, observer: result.address, changed: result.changed, hash: result.hash, wallets: result.wallets.length }, 'terminal console: viewing wallet granted (OBSERVER, no function permissions)');
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

app.post('/observer/revoke', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { address?: string; wallet?: string };
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    const result = await serialize(player.privyUserId, () => revokeObserver(current, body.address ?? body.wallet, jobId, auditFor(player)));
    app.log.info({ owner: current.ownerAddress, account: current.account, observer: result.address, hash: result.hash, wallets: result.wallets.length }, 'terminal console: viewing wallet revoked');
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/** Who can read this account, and proof that the role carries no permissions. */
app.get('/observer/list', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const current = getPlayer(player.privyUserId)!;
    const list = await listObservers(current);
    return { ...list, permissions: list.exists && current.account ? await observerPermissions(current.account) : [] };
  } catch (e) {
    return fail(reply, e);
  }
});

// ============ U5 — ENSv2 Name Desk (Sepolia identity, Remote EVM payments unchanged) ============

/** Public availability read. With no label this also supplies the Name Desk's recent on-chain claims board. */
app.get('/ens/available', async (req, reply) => {
  try {
    const { label } = (req.query ?? {}) as { label?: string };
    return await ensAvailable(label);
  } catch (e) {
    return fail(reply, e);
  }
});

/** Petra's claim: the ENS registrar key mints to the player's owner and sets addr(60) to their AccountBlox. */
app.post('/ens/claim', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { label?: string; name?: string };
    const label = body.label ?? body.name;
    if (!label) throw Object.assign(new Error('`label` is required'), { statusCode: 400, code: 'BAD_ARGS' });
    const jobId = newJobId();
    const result = await serialize(player.privyUserId, () => ensMint(getPlayer(player.privyUserId)!, label, jobId));
    app.log.info({ owner: player.ownerAddress, account: result.account, name: result.name, txHash: result.txHash }, 'ENS Name Desk: customer name claimed');
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/** Petra's delegated text-record desk. U5 permits only the teaching record bz.tier (Silver or Gold). */
app.post('/ens/record', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { name?: string; key?: string; value?: string };
    const jobId = newJobId();
    const result = await serialize(player.privyUserId, () => ensSetText(getPlayer(player.privyUserId)!, body.name, body.key, body.value, jobId));
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/** Public forward resolution. This is the only name lookup the counter needs before paying on 1337. */
app.get('/ens/resolve', async (req, reply) => {
  try {
    const { name } = (req.query ?? {}) as { name?: string };
    if (!name) throw Object.assign(new Error('`name` is required'), { statusCode: 400, code: 'BAD_ARGS' });
    return await ensResolve(name);
  } catch (e) {
    return fail(reply, e);
  }
});

app.get('/status', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const [book, pending] = player.account ? await Promise.all([passbook(player.account), listPending(player.account)]) : [null, []];
    return {
      owner: player.ownerAddress,
      chainId: chain.id,
      signingMode: player.signingMode,
      policyId: player.policyId ?? null,
      ...(book ?? { account: null, balance: '0', symbol: deployments().token.symbol, pending: 0 }),
      wires: pending,
      serverNow: String(Math.floor(Date.now() / 1000)),
      timeLockSec: Number(config.timeLockSec),
      receipts: listReceipts(player.privyUserId),
    };
  } catch (e) {
    return fail(reply, e);
  }
});

/**
 * SSE stage stream. The token rides in the query string because `EventSource` cannot set headers; it is
 * a short-lived Privy access token over localhost in U1, and moves to a cookie when the shell is hosted.
 * On connect the vault's pending records are re-read from the chain and pushed, and their pollers re-armed.
 */
app.get('/events', async (req, reply) => {
  const { token = '', owner = '' } = req.query as { token?: string; owner?: string };
  let player: Player;
  try {
    player = await requirePlayer({ headers: { authorization: `Bearer ${token}`, 'x-bz-owner': owner } });
  } catch (e) {
    return fail(reply, e);
  }
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    ...(req.headers.origin && config.allowedOrigins.includes(req.headers.origin) ? { 'Access-Control-Allow-Origin': req.headers.origin } : {}),
  });
  const send = (e: StageEvent) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
  send({ type: 'stage', jobId: 'hello', lane: 'CONFIG', stage: 'queued', bankLine: 'Connected to the branch.' });
  const off = subscribe(player.privyUserId, send);
  void resumeWatchers(getPlayer(player.privyUserId) ?? player)
    .then((pending) => {
      const now = String(Math.floor(Date.now() / 1000));
      for (const w of pending) {
        send({ type: 'stage', jobId: `wire-${w.txId}`, lane: 'B', stage: w.released ? 'released' : 'pending', bankLine: w.released ? 'The vault clock has run down.' : 'The vault clock is running.', txId: w.txId, releaseTime: w.releaseTime, serverNow: now, status: w.status });
      }
    })
    .catch((e) => app.log.warn({ err: (e as Error).message }, 'could not resume vault watchers'));
  const keepAlive = setInterval(() => reply.raw.write(': ping\n\n'), 20_000);
  req.raw.on('close', () => {
    clearInterval(keepAlive);
    off();
  });
  return reply;
});

// ============ S1 — Kenji's FX desk (Uniswap v4 on Sepolia; fiat pairs USD → EUR | ILS since 2026-09-09) ============

/**
 * The quote board. A read: `V4Quoter.quoteExactInputSingle` by `eth_call`, minus 1 % slippage, good for five
 * minutes. Public like `/ens/available` — a player standing at the desk sees the rate before signing in — but a
 * signed-in caller's quote is remembered against their id so `/fx/swap` can honour the exact price they accepted.
 */
app.get('/fx/quote', async (req, reply) => {
  try {
    const { amount, pair } = (req.query ?? {}) as { amount?: string; pair?: string };
    if (!amount) throw Object.assign(new Error('`amount` is required'), { statusCode: 400, code: 'BAD_ARGS' });
    const player = await requirePlayer(req as never).catch(() => undefined);
    // `pair` is EUR | ILS (fiat pairs, 2026-09-09); anything else is `FX_PAIR`. Default EUR keeps an old caller quoting.
    return await fxQuote(player ? getPlayer(player.privyUserId) : undefined, amount, pair ?? 'EUR');
  } catch (e) {
    return fail(reply, e);
  }
});

/** The till: balances, whether the exchange door is registered, the pool, and the three whitelisted calls. */
app.get('/fx/status', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    return await fxStatus(getPlayer(player.privyUserId)!);
  } catch (e) {
    return fail(reply, e);
  }
});

/**
 * Open the till: register the three function schemas, whitelist their three targets, and grant OWNER `SIGN_` /
 * BROADCASTER `EXECUTE_META_REQUEST_AND_APPROVE` on each. `requireConfigured` applies for the Main-wing reason —
 * a half-provisioned player has no policy to sign with, and "ask Ines to re-check" beats a chain revert.
 */
app.post('/fx/enable', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    const result = await serialize(player.privyUserId, () => enableFx(current, jobId, auditFor(player)));
    app.log.info({ owner: current.ownerAddress, till: result.account, actions: result.actions }, 'FX desk: exchange door registered on the Sepolia till');
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

/** The swap itself: up to three guarded Lane A meta-transactions on Sepolia (approve → Permit2 → V4_SWAP). */
app.post('/fx/swap', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { quoteId?: string; amount?: string; pair?: string };
    if (body.amount !== undefined && !/^\d+(\.\d+)?$/.test(String(body.amount))) throw Object.assign(new Error('`amount` must be a decimal string'), { statusCode: 400, code: 'BAD_ARGS' });
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    requireConfigured(current);
    // The pair rides on the quote when there is one; a bare amount needs `pair` (EUR | ILS) beside it.
    const result = await serialize(player.privyUserId, () => fxSwap(current, body.quoteId, body.amount, jobId, auditFor(player), body.pair));
    app.log.info({ owner: current.ownerAddress, till: result.account, pair: result.pair, amountIn: result.amountIn, amountOut: result.amountOut, hash: result.hash, steps: result.steps.length }, 'FX desk: guarded Uniswap v4 swap completed on Sepolia');
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

function fail(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, e: unknown) {
  const err = e as Error & { statusCode?: number; code?: string; status?: number };
  const status = err.statusCode ?? (err.status === 401 || err.status === 403 ? 401 : 500);
  app.log.error({ err: err.message, code: err.code }, 'request failed');
  return reply.code(status).send({ error: err.message, code: err.code ?? 'INTERNAL' });
}

// Surface a misconfigured deployments file at boot rather than on the first player.
deployments();

app.listen({ port: config.port, host: '127.0.0.1' }).then((addr) => {
  /**
   * Background rebalancing (docs/SEPOLIA-TREASURY.md §5). Live-only, key-only, unref'd: a Dev desk starts
   * nothing, and a Live desk without `SEPOLIA_TREASURY_PK` starts nothing either — the treasury is never a
   * boot dependency. Each tick is still cap- and ledger-bound, so a stuck loop cannot drain the float.
   */
  const watch = startTreasuryWatch((o, msg) => app.log.info(o, msg));
  if (watch) app.log.info({ treasury: treasuryView(), everySec: config.treasury.intervalSec, perTxEth: config.treasury.maxPerTxEth, perHourEth: config.treasury.maxPerHourEth }, 'treasury watch armed — staff wallets are topped to need x 1.25 when they fall below need');
  app.log.info(
    { rpc: config.rpcUrl, broadcaster: broadcasterAddress, deployer: deployerAddress, manager: managerAddress ?? null, priorityRelease: config.priorityRelease, roleSet: ROLE_SET_VERSION, privyApp: config.privy.appId, signerId: config.privy.signerId },
    `Teller Desk (U6 ${config.target}) listening on ${addr}`,
  );
});

export { app, emitStage, patchPlayer };
