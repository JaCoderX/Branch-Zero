/**
 * window.BranchZero — the only door between the Godot canvas and anything on-chain.
 *
 * Contract (docs/GODOT.md §4 + packages/shared/src/bridge.ts): JSON strings in, JSON strings out; GDScript calls
 * `request(method, argsJson, id)` and receives `{type:'response', id, ok, result|error}` through the callback it
 * registered with `setGodotCallback`. Never `JavaScriptBridge.eval`. Godot never sees RPC URLs or keys.
 *
 * U0 methods: echo (K1), chainInfo, accountInfo (SDK read of the AccountBlox recorded in infra/deployments/remote-evm.json).
 */
import { createPublicClient, http, type Address } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { remoteEvmWithRpc, type BranchZeroBridge, type BridgeError, type BridgeMessage, type BridgeResponse } from '@branch-zero/shared';
import deployments from '../../../../infra/deployments/remote-evm.json';

export const BRIDGE_VERSION = 'u0.1';

type Handler = (args: Record<string, unknown>) => Promise<unknown>;
type Listener = (m: BridgeMessage | { type: 'request'; id: string; method: string; args: Record<string, unknown> }) => void;

const listeners = new Set<Listener>();
export function onBridgeTraffic(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function emit(m: Parameters<Listener>[0]) {
  for (const l of listeners) l(m);
}

// Reads go through the Vite `/rpc` proxy so the browser stays same-origin and the RPC URL never reaches Godot.
const chain = remoteEvmWithRpc(`${location.origin}/rpc`);
const publicClient = createPublicClient({ chain, transport: http(`${location.origin}/rpc`) });

const handlers: Record<string, Handler> = {
  async echo(args) {
    return { echo: args.msg ?? null, receivedAt: new Date().toISOString(), bridge: BRIDGE_VERSION, userAgent: navigator.userAgent.slice(0, 60) };
  },
  async chainInfo() {
    const [chainId, block] = await Promise.all([publicClient.getChainId(), publicClient.getBlock()]);
    return { chainId, chainName: chain.name, blockNumber: block.number.toString(), timestamp: Number(block.timestamp) };
  },
  async accountInfo(args) {
    const label = typeof args.label === 'string' ? args.label : deployments.accounts[0]?.label;
    const rec = deployments.accounts.find((a) => a.label === label);
    if (!rec) throw bridgeError('BAD_ARGS', `no deployed account labelled ${label}`, 'That account is not on file at this branch.');
    const so = new SecureOwnable(publicClient as any, undefined, rec.address as Address, chain);
    const [owner, broadcasters, recovery, timeLock] = await Promise.all([so.owner(), so.getBroadcasters(), so.getRecovery(), so.getTimeLockPeriodSec()]);
    return {
      label: rec.label,
      account: rec.address,
      chainId: deployments.chainId,
      owner,
      broadcasters,
      recovery,
      timeLockPeriodSec: Number(timeLock),
      ownerMatchesRecord: owner.toLowerCase() === rec.owner.toLowerCase(),
    };
  },
};

function bridgeError(code: BridgeError['code'], message: string, bankLine?: string): BridgeError {
  return { code, message, bankLine };
}

function toError(e: unknown): BridgeError {
  if (e && typeof e === 'object' && 'code' in e && 'message' in e) return e as BridgeError;
  const message = e instanceof Error ? e.message : String(e);
  const code: BridgeError['code'] = /fetch|network|HTTP|ECONN/i.test(message) ? 'RPC' : 'INTERNAL';
  return { code, message, bankLine: code === 'RPC' ? 'The branch cannot reach the ledger right now.' : 'Something went wrong behind the counter.' };
}

async function dispatch(method: string, args: Record<string, unknown>): Promise<unknown> {
  const h = handlers[method];
  if (!h) throw bridgeError('UNKNOWN_METHOD', `unknown bridge method ${method}`, 'No desk handles that request.');
  return h(args);
}

export function installBridge(): BranchZeroBridge {
  let godotCallback: ((json: string) => void) | undefined;

  const bridge: BranchZeroBridge = {
    version: BRIDGE_VERSION,
    setGodotCallback(cb) {
      godotCallback = cb;
      emit({ type: 'event', kind: 'bridge.ready', payload: { version: BRIDGE_VERSION } });
      // Let the engine know the door is open (arrives as type:'event' in Chain.gd).
      queueMicrotask(() => cb(JSON.stringify({ type: 'event', kind: 'bridge.ready', payload: { version: BRIDGE_VERSION } })));
    },
    request(method, argsJson, id) {
      let args: Record<string, unknown> = {};
      try {
        args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
      } catch (e) {
        const res: BridgeResponse = { type: 'response', id, ok: false, error: bridgeError('BAD_ARGS', `args not JSON: ${(e as Error).message}`) };
        emit(res);
        godotCallback?.(JSON.stringify(res));
        return;
      }
      emit({ type: 'request', id, method, args });
      void dispatch(method, args)
        .then((result) => ({ type: 'response', id, ok: true, result }) as BridgeResponse)
        .catch((e) => ({ type: 'response', id, ok: false, error: toError(e) }) as BridgeResponse)
        .then((res) => {
          emit(res);
          if (!godotCallback) console.warn('[BranchZero] response with no Godot callback registered', res);
          godotCallback?.(JSON.stringify(res));
        });
    },
    call<T>(method: string, args: Record<string, unknown> = {}) {
      return dispatch(method, args) as Promise<T>;
    },
  };

  window.BranchZero = bridge;
  return bridge;
}
