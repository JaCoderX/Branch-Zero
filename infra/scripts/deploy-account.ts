/**
 * Deploy (or attach) the four foundation libraries and one AccountBlox on the selected chain, initialise it, and read back
 * owner / broadcaster / recovery / timelock through @bloxchain/sdk. Arc uses only its target-specific keys and 5042002.
 *
 *   npm run chain:compile            # once, or after bumping the package
 *   npm run chain:deploy             # reuse libraries already on Remote EVM 1337
 *   npm run chain:deploy -- --chain arc # Arc Testnet 5042002 (requires ARC_* keys)
 *   npm run chain:deploy -- --chain sepolia --label fx-rig-till   # S1: Sepolia 11155111 (SEPOLIA_* keys; merges into sepolia.json beside the ENS pins)
 *   npm run chain:deploy -- --fresh  # redeploy libraries too (after a Remote EVM wipe)
 *   npm run chain:deploy -- --label alice
 *   npm run chain:deploy -- --chain sepolia --attach-account 0x… --deploy-tx 0x…   # initialise + record an AccountBlox already deployed (resume after a failed initialize)
 *
 * Env: DEPLOYER_PK/OWNER_ADDRESS/BROADCASTER_ADDRESS/RECOVERY_ADDRESS on 1337;
 * ARC_DEPLOYER_PK/ARC_OWNER_ADDRESS/ARC_BROADCASTER_ADDRESS/ARC_RECOVERY_ADDRESS on Arc; SEPOLIA_* likewise; TIMELOCK_SEC=120.
 * On public networks the fee is pinned low (0.02 gwei tip over the base fee) because the deployer is a faucet-funded throwaway.
 * Deploy + initialize are two transactions seconds apart (documented window; no factory in the public package — see REFLECTION.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { type Address, type Hex, formatEther, parseGwei, zeroAddress } from 'viem';
import { SecureOwnable } from '@bloxchain/sdk';
import { DeploymentFileSchema, REMOTE_EVM_DEV_ROLES, type DeploymentFile, type ChainTarget } from '@branch-zero/shared';
import { loadEnv, env, ARTIFACTS_DIR, DEPLOYMENTS_DIR, INFRA_DIR } from './lib/env.ts';
import { connect, deployerWallet, asAddress, deploymentsFile, envName, targetFromArg } from './lib/chain.ts';

loadEnv();
const argv = process.argv.slice(2);
const FRESH = argv.includes('--fresh');
const attachIdx = argv.indexOf('--attach-account');
const ATTACH = attachIdx >= 0 ? (argv[attachIdx + 1] as Address) : undefined;
const deployTxIdx = argv.indexOf('--deploy-tx');
const ATTACH_DEPLOY_TX = deployTxIdx >= 0 ? (argv[deployTxIdx + 1] as Hex) : undefined;
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
  const target: ChainTarget = targetFromArg();
  const { chain, publicClient, clientVersion } = await connect(target);
  const { account: deployer, walletClient, label: deployerLabel } = deployerWallet(chain, target);
  const balance = await publicClient.getBalance({ address: deployer.address });
  console.log(`chain      ${chain.id} · ${clientVersion}`);
  console.log(`deployer   ${deployerLabel}  ${formatEther(balance)} ${chain.nativeCurrency.symbol}`);
  if (balance === 0n) throw new Error(`deployer has no ${chain.nativeCurrency.symbol}`);

  const dev = target === 'remote';
  const owner = asAddress(env(envName(target, 'OWNER_ADDRESS'), dev ? REMOTE_EVM_DEV_ROLES.playerOwner : undefined), envName(target, 'OWNER_ADDRESS'));
  const broadcaster = asAddress(env(envName(target, 'BROADCASTER_ADDRESS'), dev ? REMOTE_EVM_DEV_ROLES.broadcaster : undefined), envName(target, 'BROADCASTER_ADDRESS'));
  const recovery = asAddress(env(envName(target, 'RECOVERY_ADDRESS'), dev ? REMOTE_EVM_DEV_ROLES.recovery : undefined), envName(target, 'RECOVERY_ADDRESS'));
  // Public networks: a faucet-funded throwaway pays; keep the tip minimal and let the base fee do the work.
  const head = await publicClient.getBlock();
  // The cap is also what viem checks the balance against before sending, so keep it close to the base fee.
  const fees = dev ? {} : { maxPriorityFeePerGas: parseGwei('0.02'), maxFeePerGas: ((head.baseFeePerGas ?? parseGwei('1')) * 21n) / 20n + parseGwei('0.02') };
  const eventForwarder = asAddress(env('EVENT_FORWARDER', zeroAddress), 'EVENT_FORWARDER');
  const timeLockSec = BigInt(env('TIMELOCK_SEC', '120'));

  const outFile = path.join(DEPLOYMENTS_DIR, deploymentsFile(target));
  let existing: DeploymentFile | undefined;
  // sepolia.json predates this script (U5 ENS pins, no libraries yet): keep every key it has and add ours beside them.
  let extra: Record<string, unknown> = {};
  if (fs.existsSync(outFile)) {
    const raw = JSON.parse(fs.readFileSync(outFile, 'utf8')) as Record<string, unknown>;
    const parsed = DeploymentFileSchema.safeParse(raw);
    if (parsed.success && parsed.data.chainId === chain.id) existing = parsed.data;
    else if (raw.chainId === chain.id) extra = raw;
    else if (raw.chainId !== undefined) throw new Error(`${outFile} is for chain ${raw.chainId}, RPC is ${chain.id}`);
  }

  // ---- libraries ----------------------------------------------------------------------------------------------------
  const libs: Record<string, Address> = {};
  const libRecords: DeploymentFile['libraries'] = {};
  for (const name of FOUNDATION_LIBRARIES) {
    const art = loadArtifact(name);
    // Attach from a schema-valid file or from a pre-schema one (sepolia.json before its first account) alike.
    const prev = existing?.libraries[name] ?? ((extra.libraries as Record<string, { address: string; txHash?: string }> | undefined)?.[name]);
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
    const hash = await walletClient.deployContract({ abi: art.abi, bytecode, account: deployer, chain, ...fees });
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status !== 'success' || !rcpt.contractAddress) throw new Error(`${name} deploy failed: ${hash}`);
    libs[name] = rcpt.contractAddress;
    libRecords[name] = { address: rcpt.contractAddress, txHash: hash };
    console.log(`deploy     ${name.padEnd(28)} ${rcpt.contractAddress}  gas=${rcpt.gasUsed}`);
  }

  // ---- AccountBlox --------------------------------------------------------------------------------------------------
  const acct = loadArtifact('AccountBlox');
  const linked = link(acct.bytecode, acct.linkReferences, libs);
  let deployHash: Hex;
  let accountAddress: Address;
  if (ATTACH) {
    // Resume: the deploy landed but initialize did not (e.g. the fee cap exceeded the deployer's balance).
    if (!ATTACH_DEPLOY_TX) throw new Error('--attach-account needs --deploy-tx <hash of the deploy transaction>');
    const rcpt = await publicClient.getTransactionReceipt({ hash: ATTACH_DEPLOY_TX });
    if (rcpt.contractAddress?.toLowerCase() !== ATTACH.toLowerCase()) throw new Error(`--deploy-tx created ${rcpt.contractAddress}, not ${ATTACH}`);
    deployHash = ATTACH_DEPLOY_TX;
    accountAddress = asAddress(ATTACH, '--attach-account');
    console.log(`attach     ${'AccountBlox'.padEnd(28)} ${accountAddress}`);
  } else {
    deployHash = await walletClient.deployContract({ abi: acct.abi, bytecode: linked, account: deployer, chain, ...fees });
    const deployRcpt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    if (deployRcpt.status !== 'success' || !deployRcpt.contractAddress) throw new Error(`AccountBlox deploy failed: ${deployHash}`);
    accountAddress = deployRcpt.contractAddress;
  }
  const code = (await publicClient.getCode({ address: accountAddress })) ?? '0x';
  console.log(`deploy     ${'AccountBlox'.padEnd(28)} ${accountAddress}  code=${(code.length - 2) / 2} bytes`);

  const initHash = await walletClient.writeContract({
    address: accountAddress,
    abi: acct.abi,
    functionName: 'initialize',
    args: [owner, broadcaster, recovery, timeLockSec, eventForwarder],
    account: deployer,
    chain,
    ...fees,
    // initialize registers every schema and role: ~16.1 M gas. Public RPCs' estimateGas has refused it (2026-09-08);
    // the measured figure plus headroom is sent instead of asking.
    ...(dev ? {} : { gas: 16_300_000n }),
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
      protocolArtifacts: existing?.sources.protocolArtifacts,
    },
    libraries: libRecords,
    applications: existing?.applications,
    tokens: existing?.tokens,
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
  fs.writeFileSync(outFile, JSON.stringify({ ...extra, ...DeploymentFileSchema.parse(record) }, null, 2) + '\n');
  console.log(`wrote      ${path.relative(process.cwd(), outFile)}`);
  console.log(`K4 (${target}): PASS — AccountBlox deployed + initialised on chain ${chain.id}; owner() read back via @bloxchain/sdk`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
