/**
 * Probe Remote EVM: chain id, client, head block, dev-role balances. Read-only; no keys needed.
 *   npm run chain:probe
 */
import { formatEther } from 'viem';
import { REMOTE_EVM_DEV_ROLES } from '@branch-zero/shared';
import { loadEnv } from './lib/env.ts';
import { connect, rpcUrl, targetFromArg } from './lib/chain.ts';

loadEnv();
const target = targetFromArg();
const { chain, publicClient, clientVersion } = await connect(target);
const block = await publicClient.getBlock();
console.log(`target     ${target}`);
console.log(`RPC        ${rpcUrl(target)}`);
console.log(`chainId    ${chain.id} (0x${chain.id.toString(16)})`);
console.log(`client     ${clientVersion}`);
console.log(`head       #${block.number} gasLimit=${block.gasLimit} ts=${block.timestamp}`);
if (target === 'remote') {
  for (const [role, addr] of Object.entries(REMOTE_EVM_DEV_ROLES)) {
    const bal = await publicClient.getBalance({ address: addr });
    console.log(`${role.padEnd(12)} ${addr}  ${formatEther(bal)} ETH`);
  }
}
