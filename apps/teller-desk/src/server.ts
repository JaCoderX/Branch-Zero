/**
 * Teller Desk — U1.
 *
 * Holds the two keys the browser must never see: the Privy P-256 authorization key (which lets it *ask*
 * a delegated wallet for a signature) and the broadcaster key (which pays gas). Neither can move a
 * player's money alone: the enclave only signs what the policy allows, and the broadcaster can only
 * submit meta-transactions the owner actually signed.
 *
 *   npm run dev:teller     # :8787, reads ../../.env
 */
import Fastify from 'fastify';
import { formatEther, getAddress, isAddress, type Address } from 'viem';
import type { StageEvent } from '@branch-zero/shared';
import { broadcasterAddress, chain, deployerAddress, publicClient } from './chain.ts';
import { config, deployments, redact } from './config.ts';
import { createPlayerPolicy, identify } from './privy.ts';
import { pay, passbook } from './lanes/laneA.ts';
import { provision } from './lanes/provision.ts';
import { emitStage, getPlayer, listReceipts, newJobId, patchPlayer, serialize, subscribe, upsertPlayer, type Player } from './store.ts';
import type { SignatureAudit } from './signing/privySigner.ts';

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

app.get('/healthz', async () => {
  const d = deployments();
  try {
    const [chainId, block, broadcasterBal, deployerBal] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBlockNumber(),
      publicClient.getBalance({ address: broadcasterAddress }),
      publicClient.getBalance({ address: deployerAddress }),
    ]);
    return {
      ok: chainId === chain.id,
      unit: 'U1',
      chains: { remoteEvm: { chainId, expected: chain.id, block: block.toString(), reachable: true } },
      broadcaster: { address: broadcasterAddress, balanceEth: formatEther(broadcasterBal) },
      deployer: { address: deployerAddress, balanceEth: formatEther(deployerBal) },
      privy: { appId: config.privy.appId, signerId: config.privy.signerId, authorizationKey: redact(config.privy.authorizationKey) },
      contracts: { copyBlox: d.copyBlox, accountBloxImplementation: d.accountBloxImplementation, token: d.token },
    };
  } catch (e) {
    return { ok: false, unit: 'U1', chains: { remoteEvm: { reachable: false, error: (e as Error).message } } };
  }
});

/**
 * Exchange a Privy access token for a Teller Desk session view of the player.
 *
 * Also mints the player's policy if they do not have one yet, and hands back its id: the overlay passes
 * that id to `addSessionSigners`, so the single consent the player gives covers both "who may sign" (our
 * key quorum) and "what they may sign" (this policy). We cannot attach either from here — the wallet is
 * owned by the player's own key quorum, which is the point.
 */
app.post('/session', async (req, reply) => {
  try {
    let player = await requirePlayer(req as never);
    if (!player.policyId) {
      const policy = await createPlayerPolicy(chain.id, player.ownerAddress.slice(2, 12).toLowerCase());
      player = patchPlayer(player.privyUserId, { policyId: policy.policyId, policyRuleId: policy.ruleId });
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
      chainId: chain.id,
      token: deployments().token,
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

app.post('/pay', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const body = (req.body ?? {}) as { to?: string; amount?: string; memo?: string };
    if (!body.to || !isAddress(body.to)) throw Object.assign(new Error('`to` must be an address'), { statusCode: 400, code: 'BAD_ARGS' });
    if (!body.amount || !/^\d+(\.\d+)?$/.test(body.amount)) throw Object.assign(new Error('`amount` must be a decimal string'), { statusCode: 400, code: 'BAD_ARGS' });
    if (Number(body.amount) > Number(config.instantLimit)) {
      // Off-chain routing only — docs/REFLECTION.md §2.2 records this as a partial invariant.
      throw Object.assign(new Error(`over the ${config.instantLimit} instant limit — that is a wire (Lane B, U2)`), { statusCode: 400, code: 'POLICY' });
    }
    const jobId = newJobId();
    const current = getPlayer(player.privyUserId)!;
    const result = await serialize(player.privyUserId, () => pay(current, getAddress(body.to!) as Address, body.amount!, jobId, auditFor(player)));
    return { jobId, ...result };
  } catch (e) {
    return fail(reply, e);
  }
});

app.get('/status', async (req, reply) => {
  try {
    const player = await requirePlayer(req as never);
    const book = player.account ? await passbook(player.account) : null;
    return {
      owner: player.ownerAddress,
      chainId: chain.id,
      signingMode: player.signingMode,
      policyId: player.policyId ?? null,
      ...(book ?? { account: null, balance: '0', symbol: deployments().token.symbol, pending: 0 }),
      receipts: listReceipts(player.privyUserId),
    };
  } catch (e) {
    return fail(reply, e);
  }
});

/**
 * SSE stage stream. The token rides in the query string because `EventSource` cannot set headers; it is
 * a short-lived Privy access token over localhost in U1, and moves to a cookie when the shell is hosted.
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
  const keepAlive = setInterval(() => reply.raw.write(': ping\n\n'), 20_000);
  req.raw.on('close', () => {
    clearInterval(keepAlive);
    off();
  });
  return reply;
});

/** Not in U1. Left explicit so the bridge fails with a plan, not a 404. */
for (const [route, unit] of [
  ['/wire', 'U2'],
  ['/approve', 'U2'],
  ['/cancel', 'U2'],
  ['/ens/claim', 'U5'],
  ['/ens/record', 'U5'],
  ['/fx/swap', 'S1'],
] as const) {
  app.post(route, async (_req, reply) => reply.code(501).send({ error: 'not implemented', route, plannedUnit: unit }));
}

function fail(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, e: unknown) {
  const err = e as Error & { statusCode?: number; code?: string; status?: number };
  const status = err.statusCode ?? (err.status === 401 || err.status === 403 ? 401 : 500);
  app.log.error({ err: err.message, code: err.code }, 'request failed');
  return reply.code(status).send({ error: err.message, code: err.code ?? 'INTERNAL' });
}

// Surface a misconfigured deployments file at boot rather than on the first player.
deployments();

app.listen({ port: config.port, host: '127.0.0.1' }).then((addr) => {
  app.log.info(
    { rpc: config.rpcUrl, broadcaster: broadcasterAddress, deployer: deployerAddress, privyApp: config.privy.appId, signerId: config.privy.signerId },
    `Teller Desk (U1) listening on ${addr}`,
  );
});

export { app, emitStage, patchPlayer };
