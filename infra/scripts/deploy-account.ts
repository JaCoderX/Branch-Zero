/**
 * Deploy (or attach) the four foundation libraries and one AccountBlox on Remote EVM 1337, initialise it, and read back
 * owner / broadcaster / recovery / timelock through @bloxchain/sdk. Writes infra/deployments/remote-evm.json (addresses only).
 *
 *   npm run chain:compile            # once, or after bumping the package
 *   npm run chain:deploy             # reuse libraries already on chain
 *   npm run chain:deploy -- --fresh  # redeploy libraries too (after a Remote EVM wipe)
 *   npm run chain:deploy -- --label alice
 *
 * Env: DEPLOYER_PK (acct0 on 1337), OWNER_ADDRESS (acct4), BROADCASTER_ADDRESS (acct1), RECOVERY_ADDRESS (acct2), TIMELOCK_SEC=120.
 * Deploy + initialize are two transactions seconds apart (documented window; no factory in the public package — see REFLECTION.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { type Address, type Hex, formatEther, zeroAddress } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { DeploymentFileSchema, REMOTE_EVM_DEV_ROLES, type DeploymentFile } from '@branch-zero/shared';
import { loadEnv, env, ARTIFACTS_DIR, DEPLOYMENTS_DIR, INFRA_DIR } from './lib/env.ts';
import { connect, deployerWallet, asAddress } from './lib/chain.ts';

loadEnv();
const argv = process.argv.slice(2);
const FRESH = argv.includes('--fresh');
const labelIdx = argv.indexOf('--label');
const LABEL = labelIdx >= 0 && argv[labelIdx + 1] ? argv[labelIdx + 1] : 'player-owner-acct4';

const FOUNDATION_LIBRARIES = ['EngineBlox', 'SecureOwnableDefinitions', 'RuntimeRBACDefinitions', 'GuardControllerDefinitions'] as const;

interface Artifact {
  contractName: string;
  abi: any[];
  bytecode: Hex;
  linkReferences: Record<string, Record<string, Array<{ start: number; length: number }>>>;
  compiler: { solc: string; evmVersion: string; optimizerRuns: number; viaIR: boolean };
  sources: { contractsPackage: string; accountBloxTemplate?: { url: string; commit: string; sha256: string } };
}

function loadArtifact(name: string): Artifact {
  const p = path.join(ARTIFACTS_DIR, `${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`missing artifact ${p} — run: npm run chain:compile`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Installed @bloxchain/sdk version. Its exports map has no CJS/`./package.json` entry, so walk node_modules upward instead. */
function sdkVersion(): string {
  let dir = INFRA_DIR;
  for (let i = 0; i < 6; i++) {
    const pj = path.join(dir, 'node_modules', '@bloxchain', 'sdk', 'package.json');
    if (fs.existsSync(pj)) {
      const pkg = JSON.parse(fs.readFileSync(pj, 'utf8'));
      return `${pkg.name}@${pkg.version}`;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '@bloxchain/sdk@unknown';
}

/** Same algorithm as upstream scripts/deployment/deploy-foundation-libraries.js linkBytecode(). */
function link(bytecode: Hex, linkReferences: Artifact['linkReferences'], libs: Record<string, Address>): Hex {
  let code = bytecode.replace(/^0x/, '');
  for (const refsBySource of Object.values(linkReferences)) {
    for (const [libName, refs] of Object.entries(refsBySource)) {
      const addr = libs[libName];
      if (!addr) throw new Error(`link: missing library address for ${libName}`);
      const hex = addr.replace(/^0x/, '').toLowerCase().padStart(40, '0');
      for (const { start, length } of refs) {
        code = code.slice(0, start * 2) + hex + code.slice(start * 2 + length * 2);
      }
    }
  }
  if (/__\$[0-9a-f]{34}\$__/.test(code)) throw new Error('link: unresolved placeholders remain');
  return `0x${code}`;
}

async function main() {
  const { chain, publicClient, clientVersion } = await connect();
  const { account: deployer, walletClient, label: deployerLabel } = deployerWallet(chain);
  const balance = await publicClient.getBalance({ address: deployer.address });
  console.log(`chain      ${chain.id} · ${clientVersion}`);
  console.log(`deployer   ${deployerLabel}  ${formatEther(balance)} ETH`);
  if (balance === 0n) throw new Error('deployer has no ETH');

  const owner = asAddress(env('OWNER_ADDRESS', REMOTE_EVM_DEV_ROLES.playerOwner), 'OWNER_ADDRESS');
  const broadcaster = asAddress(env('BROADCASTER_ADDRESS', REMOTE_EVM_DEV_ROLES.broadcaster), 'BROADCASTER_ADDRESS');
  const recovery = asAddress(env('RECOVERY_ADDRESS', REMOTE_EVM_DEV_ROLES.recovery), 'RECOVERY_ADDRESS');
  const eventForwarder = asAddress(env('EVENT_FORWARDER', zeroAddress), 'EVENT_FORWARDER');
  const timeLockSec = BigInt(env('TIMELOCK_SEC', '120'));

  const outFile = path.join(DEPLOYMENTS_DIR, chain.id === 1337 ? 'remote-evm.json' : `chain-${chain.id}.json`);
  let existing: DeploymentFile | undefined;
  if (fs.existsSync(outFile)) {
    const parsed = DeploymentFileSchema.safeParse(JSON.parse(fs.readFileSync(outFile, 'utf8')));
    if (parsed.success && parsed.data.chainId === chain.id) existing = parsed.data;
  }

  // ---- libraries ----------------------------------------------------------------------------------------------------
  const libs: Record<string, Address> = {};
  const libRecords: DeploymentFile['libraries'] = {};
  for (const name of FOUNDATION_LIBRARIES) {
    const art = loadArtifact(name);
    const prev = existing?.libraries[name];
    if (prev && !FRESH) {
      const code = await publicClient.getCode({ address: prev.address as Address });
      if (code && code !== '0x') {
        libs[name] = prev.address as Address;
        libRecords[name] = prev;
        console.log(`attach     ${name.padEnd(28)} ${prev.address}`);
        continue;
      }
    }
    const bytecode = link(art.bytecode, art.linkReferences, libs);
    const hash = await walletClient.deployContract({ abi: art.abi, bytecode, account: deployer, chain });
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status !== 'success' || !rcpt.contractAddress) throw new Error(`${name} deploy failed: ${hash}`);
    libs[name] = rcpt.contractAddress;
    libRecords[name] = { address: rcpt.contractAddress, txHash: hash };
    console.log(`deploy     ${name.padEnd(28)} ${rcpt.contractAddress}  gas=${rcpt.gasUsed}`);
  }

  // ---- AccountBlox --------------------------------------------------------------------------------------------------
  const acct = loadArtifact('AccountBlox');
  const linked = link(acct.bytecode, acct.linkReferences, libs);
  const deployHash = await walletClient.deployContract({ abi: acct.abi, bytecode: linked, account: deployer, chain });
  const deployRcpt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (deployRcpt.status !== 'success' || !deployRcpt.contractAddress) throw new Error(`AccountBlox deploy failed: ${deployHash}`);
  const accountAddress = deployRcpt.contractAddress;
  const code = (await publicClient.getCode({ address: accountAddress })) ?? '0x';
  console.log(`deploy     ${'AccountBlox'.padEnd(28)} ${accountAddress}  gas=${deployRcpt.gasUsed}  code=${(code.length - 2) / 2} bytes`);

  const initHash = await walletClient.writeContract({
    address: accountAddress,
    abi: acct.abi,
    functionName: 'initialize',
    args: [owner, broadcaster, recovery, timeLockSec, eventForwarder],
    account: deployer,
    chain,
  });
  const initRcpt = await publicClient.waitForTransactionReceipt({ hash: initHash });
  if (initRcpt.status !== 'success') throw new Error(`initialize reverted: ${initHash}`);
  console.log(`initialize owner=${owner} broadcaster=${broadcaster} recovery=${recovery} timelock=${timeLockSec}s  gas=${initRcpt.gasUsed}`);

  // ---- read back through the public SDK (the K4 bar) ------------------------------------------------------------------
  // NOTE: getSupportedFunctions()/getSupportedRoles() are permissioned views — an eth_call from the zero address reverts
  // with NoPermission(0x0). Read them with `from` = an authorised wallet (see smoke.ts). Not part of the K4 bar.
  const so = new SecureOwnable(publicClient as any, undefined, accountAddress, chain);
  const [ownerOnChain, broadcasters, recoveryOnChain, tl] = await Promise.all([
    so.owner(),
    so.getBroadcasters(),
    so.getRecovery(),
    so.getTimeLockPeriodSec(),
  ]);
  console.log(`sdk.owner()                ${ownerOnChain}`);
  console.log(`sdk.getBroadcasters()      ${broadcasters.join(', ')}`);
  console.log(`sdk.getRecovery()          ${recoveryOnChain}`);
  console.log(`sdk.getTimeLockPeriodSec() ${tl}`);

  const problems: string[] = [];
  if (ownerOnChain.toLowerCase() !== owner.toLowerCase()) problems.push(`owner mismatch: ${ownerOnChain}`);
  if (!broadcasters.map((a) => a.toLowerCase()).includes(broadcaster.toLowerCase())) problems.push('broadcaster missing');
  if (recoveryOnChain.toLowerCase() !== recovery.toLowerCase()) problems.push(`recovery mismatch: ${recoveryOnChain}`);
  if (BigInt(tl) !== timeLockSec) problems.push(`timelock mismatch: ${tl}`);
  if (problems.length) throw new Error(`K4 smoke FAILED: ${problems.join('; ')}`);

  // ---- record (addresses only) --------------------------------------------------------------------------------------
  const record: DeploymentFile = {
    chainId: chain.id,
    chainName: chain.name,
    updatedAt: new Date().toISOString(),
    deployer: deployer.address,
    compiler: acct.compiler,
    sources: {
      contractsPackage: acct.sources.contractsPackage,
      sdkPackage: sdkVersion(),
      accountBloxTemplate: acct.sources.accountBloxTemplate!,
    },
    libraries: libRecords,
    accounts: [
      ...(existing?.accounts.filter((a) => a.label !== LABEL) ?? []),
      {
        label: LABEL,
        address: accountAddress,
        owner,
        broadcaster,
        recovery,
        timeLockPeriodSec: Number(timeLockSec),
        eventForwarder,
        deployTxHash: deployHash,
        initializeTxHash: initHash,
        block: Number(initRcpt.blockNumber),
      },
    ],
  };
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(DeploymentFileSchema.parse(record), null, 2) + '\n');
  console.log(`wrote      ${path.relative(process.cwd(), outFile)}`);
  console.log('K4 (local): PASS — AccountBlox deployed + initialised on chain 1337; owner() read back via @bloxchain/sdk');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
