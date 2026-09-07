/**
 * U6 Arc kill/readback. Read-only: proves the selected RPC, pinned ENG-0006 fixtures, native USDC interface,
 * and the live AccountBlox owner() path. A fresh product clone is intentionally not attempted without ARC_* keys.
 *
 *   node --experimental-strip-types infra/scripts/arc-kill.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { SecureOwnable } from '@bloxchain/sdk';
import { ARC_TESTNET_CHAIN_ID, ARC_USDC_ADDRESS, DeploymentFileSchema, erc20Abi } from '@branch-zero/shared';
import { loadEnv, DEPLOYMENTS_DIR } from './lib/env.ts';
import { connect } from './lib/chain.ts';

loadEnv();
const { chain, publicClient, clientVersion } = await connect('arc');
if (chain.id !== ARC_TESTNET_CHAIN_ID) throw new Error(`Arc kill connected to wrong chain ${chain.id}`);
const filePath = path.join(DEPLOYMENTS_DIR, 'arc-testnet.json');
const dep = DeploymentFileSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
const explorer = 'https://testnet.arcscan.app';
let failures = 0;
const mark = (ok: boolean, label: string, note: string) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} — ${note}`);
};

mark(true, 'G7-chain', `${chain.name} ${chain.id} (${clientVersion}); native ${chain.nativeCurrency.symbol} uses ${chain.nativeCurrency.decimals} decimals`);
const token = dep.tokens?.usdc;
const [symbol, decimals] = token
  ? await Promise.all([
      publicClient.readContract({ address: ARC_USDC_ADDRESS, abi: erc20Abi, functionName: 'symbol' }) as Promise<string>,
      publicClient.readContract({ address: ARC_USDC_ADDRESS, abi: erc20Abi, functionName: 'decimals' }) as Promise<number>,
    ])
  : ['', 0];
mark(Boolean(token && token.address.toLowerCase() === ARC_USDC_ADDRESS.toLowerCase() && token.decimals === 6 && symbol === 'USDC' && Number(decimals) === 6), 'G7-token', `${symbol} decimals=${decimals}; interface ${ARC_USDC_ADDRESS}`);

for (const [name, lib] of Object.entries(dep.libraries)) {
  const code = await publicClient.getCode({ address: lib.address as `0x${string}` });
  mark(Boolean(code && code !== '0x'), `G7-library:${name}`, `${explorer}/address/${lib.address}`);
}

const fixture = dep.accounts[0];
const so = new SecureOwnable(publicClient as any, undefined, fixture.address as `0x${string}`, chain);
const owner = await so.owner();
mark(owner.toLowerCase() === fixture.owner.toLowerCase(), 'G7-owner', `${fixture.address} owner()=${owner}; ${explorer}/address/${fixture.address}`);

const copy = dep.applications?.CopyBlox;
if (copy?.address) {
  const code = await publicClient.getCode({ address: copy.address as `0x${string}` });
  mark(Boolean(code && code !== '0x'), 'G7-copyblox', `${explorer}/address/${copy.address}; cloneImplementation=${copy.cloneImplementation ?? 'missing'}`);
} else {
  console.log('PARTIAL G7-copyblox — no CopyBlox address is pinned yet; provision code is ready, but ARC_DEPLOYER_PK + funded product deployment are required.');
}

console.log(failures ? `U6 Arc kill: ${failures} FAILURE(S)` : 'U6 Arc kill: PASS (live Arc readback; fresh product clone not attempted without ARC_* funding)');
process.exitCode = failures ? 1 : 0;
