/**
 * Teller Desk — U0 stub.
 *
 * Holds no keys yet. Exposes /healthz (Remote EVM reachability + broadcaster balance by ADDRESS) and returns 501 for the
 * lane endpoints defined in docs/ARCHITECTURE.md §6 so the bridge can be wired against real routes in U1/U2.
 *
 *   npm run dev:teller     # :8787, reads ../../.env if present
 */
import Fastify from 'fastify';
import { createPublicClient, http, formatEther, type Address } from 'viem';
import { remoteEvmWithRpc, REMOTE_EVM_DEV_ROLES } from '@branch-zero/shared';

const PORT = Number(process.env.PORT ?? 8787);
const RPC = process.env.REMOTE_EVM_RPC_URL ?? 'http://127.0.0.1:8545';
const BROADCASTER = (process.env.BROADCASTER_ADDRESS ?? REMOTE_EVM_DEV_ROLES.broadcaster) as Address;

const chain = remoteEvmWithRpc(RPC);
const publicClient = createPublicClient({ chain, transport: http(RPC) });

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization'] } });

app.get('/healthz', async () => {
  try {
    const [chainId, block, balance] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBlockNumber(),
      publicClient.getBalance({ address: BROADCASTER }),
    ]);
    return {
      ok: chainId === chain.id,
      unit: 'U0',
      chains: { remoteEvm: { chainId, expected: chain.id, block: block.toString(), reachable: true } },
      broadcaster: { address: BROADCASTER, balanceEth: formatEther(balance) },
    };
  } catch (e) {
    return { ok: false, unit: 'U0', chains: { remoteEvm: { reachable: false, error: (e as Error).message } } };
  }
});

const NOT_YET: Array<[string, string]> = [
  ['/session', 'U1'],
  ['/provision', 'U1'],
  ['/pay', 'U1'],
  ['/wire', 'U2'],
  ['/approve', 'U2'],
  ['/cancel', 'U2'],
  ['/ens/claim', 'U5'],
  ['/ens/record', 'U5'],
  ['/fx/swap', 'S1'],
];
for (const [route, unit] of NOT_YET) {
  app.post(route, async (_req, reply) => reply.code(501).send({ error: 'not implemented', route, plannedUnit: unit }));
}
app.get('/status', async (_req, reply) => reply.code(501).send({ error: 'not implemented', route: '/status', plannedUnit: 'U1' }));
app.get('/events', async (_req, reply) => reply.code(501).send({ error: 'not implemented', route: '/events', plannedUnit: 'U2' }));

app.listen({ port: PORT, host: '127.0.0.1' }).then((addr) => {
  app.log.info({ rpc: RPC, broadcaster: BROADCASTER }, `Teller Desk (U0 stub) listening on ${addr}`);
});
