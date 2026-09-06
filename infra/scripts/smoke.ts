/**
 * Re-runnable K4 check: read every account in infra/deployments/remote-evm.json through @bloxchain/sdk and compare with
 * the recorded owner / broadcaster / recovery / timelock. No keys required.
 *
 *   npm run chain:smoke
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Address } from 'viem';
import { SecureOwnable, INTERFACE_IDS } from '@bloxchain/sdk';
import { DeploymentFileSchema } from '@branch-zero/shared';
import { loadEnv, DEPLOYMENTS_DIR } from './lib/env.ts';
import { connect } from './lib/chain.ts';

loadEnv();
const { chain, publicClient } = await connect();
const file = path.join(DEPLOYMENTS_DIR, chain.id === 1337 ? 'remote-evm.json' : `chain-${chain.id}.json`);
const dep = DeploymentFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
if (dep.chainId !== chain.id) throw new Error(`deployments file is for chain ${dep.chainId}, RPC is ${chain.id}`);

let failures = 0;
for (const [name, lib] of Object.entries(dep.libraries)) {
  const code = (await publicClient.getCode({ address: lib.address as Address })) ?? '0x';
  const ok = code !== '0x';
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} library ${name.padEnd(28)} ${lib.address}  ${(code.length - 2) / 2} bytes`);
}

/** Permissioned registry views revert with NoPermission for an anonymous eth_call; they answer when `from` holds a role. */
const registryAbi = [
  { type: 'function', name: 'getSupportedFunctions', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes4[]' }] },
  { type: 'function', name: 'getSupportedRoles', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32[]' }] },
] as const;

for (const a of dep.accounts) {
  const so = new SecureOwnable(publicClient as any, undefined, a.address as Address, chain);
  const ids = INTERFACE_IDS as Record<string, string>;
  const [owner, broadcasters, recovery, tl, isGuard, isRbac, isSecure] = await Promise.all([
    so.owner(),
    so.getBroadcasters(),
    so.getRecovery(),
    so.getTimeLockPeriodSec(),
    so.supportsInterface(ids.IGuardController as `0x${string}`),
    so.supportsInterface(ids.IRuntimeRBAC as `0x${string}`),
    so.supportsInterface(ids.ISecureOwnable as `0x${string}`),
  ]);
  let anonRegistryReverts = false;
  try {
    await publicClient.readContract({ address: a.address as Address, abi: registryAbi, functionName: 'getSupportedFunctions' });
  } catch {
    anonRegistryReverts = true;
  }
  const [fnsAsOwner, rolesAsOwner] = await Promise.all([
    publicClient.readContract({ address: a.address as Address, abi: registryAbi, functionName: 'getSupportedFunctions', account: a.owner as Address }),
    publicClient.readContract({ address: a.address as Address, abi: registryAbi, functionName: 'getSupportedRoles', account: a.owner as Address }),
  ]);
  const checks: Array<[string, boolean, string]> = [
    ['owner()', owner.toLowerCase() === a.owner.toLowerCase(), owner],
    ['getBroadcasters()', broadcasters.map((b) => b.toLowerCase()).includes(a.broadcaster.toLowerCase()), broadcasters.join(',')],
    ['getRecovery()', recovery.toLowerCase() === a.recovery.toLowerCase(), recovery],
    ['getTimeLockPeriodSec()', Number(tl) === a.timeLockPeriodSec, String(tl)],
    ['supportsInterface(IGuardController)', isGuard, String(isGuard)],
    ['supportsInterface(IRuntimeRBAC)', isRbac, String(isRbac)],
    ['supportsInterface(ISecureOwnable)', isSecure, String(isSecure)],
    ['getSupportedFunctions() anonymous → NoPermission', anonRegistryReverts, String(anonRegistryReverts)],
    ['getSupportedFunctions() from=owner', fnsAsOwner.length > 0, `${fnsAsOwner.length} selectors`],
    ['getSupportedRoles() from=owner', rolesAsOwner.length > 0, `${rolesAsOwner.length} roles`],
  ];
  console.log(`account ${a.label} ${a.address}`);
  for (const [what, ok, got] of checks) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what.padEnd(36)} ${got}`);
  }
}
console.log(failures ? `K4 smoke: ${failures} FAILURE(S)` : 'K4 smoke: PASS');
process.exit(failures ? 1 : 0);
