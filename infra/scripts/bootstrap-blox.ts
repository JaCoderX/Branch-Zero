/**
 * One-time chain bootstrap — CopyBlox (wallet factory) plus the payment-token fixture.
 *
 * This is the out-of-band bootstrap step: the product runtime depends on
 * `@bloxchain/sdk` + `viem` only, but *somebody* has to put the published bytecode on the lab chain once.
 * We do not compile anything here and we do not import from the protocol repo — we read two already-built
 * Hardhat artifacts from a directory the operator names in `BLOXCHAIN_PROTOCOL_DIR`, record their sha256,
 * and deploy them unchanged. Nothing in `apps/` ever touches this path; the product reads only the
 * addresses written back into `infra/deployments/remote-evm.json` and the ABIs shipped by the SDK.
 *
 *   BLOXCHAIN_PROTOCOL_DIR="D:/My Git Projects/ParticleCS/Bloxchain-protocol" npm run chain:bootstrap -- --chain remote
 *   BLOXCHAIN_PROTOCOL_DIR="D:/My Git Projects/ParticleCS/Bloxchain-protocol" npm run chain:bootstrap -- --chain arc
 *   BLOXCHAIN_PROTOCOL_DIR="D:/My Git Projects/ParticleCS/Bloxchain-protocol" npm run chain:bootstrap -- --chain sepolia
 *
 * Idempotent: contracts already recorded in the deployments file (and still carrying code) are skipped.
 * Never wipes anything. Refuses to send a transaction whose estimate does not fit the live block gas limit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { encodeDeployData, formatEther, getAddress, parseUnits, type Abi, type Address, type Hex } from 'viem';
import { ARC_USDC_ADDRESS, type ChainTarget } from '@branch-zero/shared';
import { connect, deployerWallet, deploymentsFile as deploymentsFileFor, targetFromArg } from './lib/chain.ts';
import { loadEnv, env, DEPLOYMENTS_DIR } from './lib/env.ts';

loadEnv();

/** Artifacts we consume, relative to BLOXCHAIN_PROTOCOL_DIR. Hardhat layout, already built upstream. */
const ARTIFACTS = {
  CopyBlox: 'artifacts/contracts/examples/applications/CopyBlox/CopyBlox.sol/CopyBlox.json',
  BasicERC20: 'artifacts/contracts/examples/extra/BasicERC20.sol/BasicERC20.json',
} as const;

interface Artifact {
  abi: unknown[];
  bytecode: Hex;
  linkReferences?: Record<string, Record<string, Array<{ start: number; length: number }>>>;
}

function readArtifact(protocolDir: string, rel: string): { artifact: Artifact; sha256: string; rel: string } {
  const file = path.join(protocolDir, rel);
  if (!fs.existsSync(file)) throw new Error(`Artifact not found: ${file}\nSet BLOXCHAIN_PROTOCOL_DIR to a built Bloxchain-Protocol checkout.`);
  const raw = fs.readFileSync(file);
  return { artifact: JSON.parse(raw.toString('utf8')) as Artifact, sha256: createHash('sha256').update(raw).digest('hex'), rel };
}

/** Substitute library addresses into the placeholder slots Hardhat left in the init code. */
function linkBytecode(bytecode: Hex, linkReferences: Artifact['linkReferences'], libraries: Record<string, Address>): Hex {
  let code = bytecode.replace(/^0x/, '');
  for (const libs of Object.values(linkReferences ?? {})) {
    for (const [libName, refs] of Object.entries(libs)) {
      const addr = libraries[libName];
      if (!addr) throw new Error(`Missing library address for ${libName}`);
      const hex = addr.replace(/^0x/, '').toLowerCase();
      for (const { start, length } of refs) {
        if (length !== 20) throw new Error(`Unexpected link slot length ${length} for ${libName}`);
        code = code.slice(0, start * 2) + hex + code.slice(start * 2 + 40);
      }
    }
  }
  if (/__\$[0-9a-f]{34}\$__/.test(code)) throw new Error('Unlinked library placeholder remains in bytecode');
  return `0x${code}` as Hex;
}

async function main() {
  const target: ChainTarget = targetFromArg();
  const protocolDir = env('BLOXCHAIN_PROTOCOL_DIR');
  const { chain, publicClient, clientVersion } = await connect(target);
  const { account: deployer, walletClient } = deployerWallet(chain, target);
  const deploymentsFile = path.join(DEPLOYMENTS_DIR, deploymentsFileFor(target));

  const block = await publicClient.getBlock();
  const gasCeiling = block.gasLimit;
  console.log(`chain ${chain.id} · ${clientVersion} · head #${block.number} · block gasLimit ${gasCeiling.toLocaleString()}`);
  console.log(`deployer ${deployer.address} · ${formatEther(await publicClient.getBalance({ address: deployer.address }))} ${chain.nativeCurrency.symbol}`);

  const file = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'));
  if (file.chainId !== chain.id) throw new Error(`deployments file is for chain ${file.chainId}, RPC is ${chain.id}`);
  file.applications ??= {};
  file.tokens ??= {};
  file.sources.protocolArtifacts ??= {};

  const engineBlox = getAddress(file.libraries.EngineBlox.address as string);
  const accountBloxImpl = getAddress(file.accounts[0].address as string);

  /** Deploy `artifact` unless `record` already points at live code. Refuses to exceed the live block limit. */
  async function deployOnce(
    label: string,
    bucket: Record<string, { address: string; txHash?: string }>,
    src: { artifact: Artifact; sha256: string; rel: string },
    args: unknown[],
    libraries: Record<string, Address> = {},
  ): Promise<Address> {
    const existing = bucket[label]?.address;
    if (existing) {
      const code = await publicClient.getCode({ address: existing as Address });
      if (code && code !== '0x') {
        console.log(`${label}: already deployed at ${existing} — skipping`);
        return getAddress(existing);
      }
      console.log(`${label}: recorded at ${existing} but no code there; redeploying`);
    }

    const bytecode = linkBytecode(src.artifact.bytecode, src.artifact.linkReferences, libraries);
    const abi = src.artifact.abi as Abi;
    const gas = await publicClient.estimateGas({ account: deployer, data: encodeDeployData({ abi, bytecode, args }) });
    if (gas > gasCeiling) throw new Error(`${label}: estimate ${gas} exceeds block gasLimit ${gasCeiling}`);
    console.log(`${label}: deploying (est ${gas.toLocaleString()} gas, ${((Number(gas) / Number(gasCeiling)) * 100).toFixed(1)}% of a block)`);

    const hash = await walletClient.deployContract({ abi, bytecode, args, chain, account: deployer } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`${label}: deploy reverted (${hash})`);
    const address = getAddress(receipt.contractAddress);
    console.log(`${label}: ${address} (${receipt.gasUsed.toLocaleString()} gas, block ${receipt.blockNumber})`);

    bucket[label] = { address, txHash: hash, deployedAtBlock: Number(receipt.blockNumber) } as never;
    file.sources.protocolArtifacts[label] = { path: src.rel, sha256: src.sha256 };
    return address;
  }

  // --- CopyBlox: EIP-1167 clone factory. Clones the U0 AccountBlox fixture as the implementation. ---
  const copyBloxSrc = readArtifact(protocolDir, ARTIFACTS.CopyBlox);
  const copyBlox = await deployOnce('CopyBlox', file.applications, copyBloxSrc, [], { EngineBlox: engineBlox });

  let paymentToken: Address;
  if (target === 'sepolia') {
    // The Live wing's practice dollars are the open-mint demo USDC already pinned in sepolia.json (U5 / S1:
    // Kenji quotes it against WETH and the FX pool's currency0 is this token). Deploying a second "demo USDC"
    // here would silently fork the practice balance away from the FX pool, so this branch only verifies.
    // Circle's faucet USDC is a *different* token and is never the in-game balance (docs/SEPOLIA-LIVE.md §4.2).
    const recorded = file.tokens.demoUsdc?.address as string | undefined;
    if (!recorded) throw new Error('sepolia.json has no tokens.demoUsdc — the practice token must be pinned before bootstrap (docs/SEPOLIA-LIVE.md §4.2)');
    paymentToken = getAddress(recorded);
    const code = await publicClient.getCode({ address: paymentToken });
    if (!code || code === '0x') throw new Error(`practice token ${paymentToken} has no code on chain ${chain.id}`);
    console.log(`demoUsdc: reusing the pinned open-mint practice token ${paymentToken} — not redeploying`);
  } else if (target === 'arc') {
    // Arc's native USDC also exposes this ERC-20-compatible interface. Never deploy a fake token on Arc.
    paymentToken = getAddress(ARC_USDC_ADDRESS);
    file.tokens.usdc = {
      ...file.tokens.usdc,
      address: paymentToken,
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6,
      note: 'Arc native USDC interface; native gas uses 18-decimal units.',
    };
  } else {
    // --- Demo money for Lane A. Not protocol code: a plain OZ ERC-20 used as a faucet token. ---
    const erc20Src = readArtifact(protocolDir, ARTIFACTS.BasicERC20);
    const supply = parseUnits('1000000', 18);
    paymentToken = await deployOnce('demoUsdc', file.tokens, erc20Src, ['USD Coin (demo)', 'dUSDC', supply, deployer.address]);
    if (!file.tokens.demoUsdc.decimals) {
      file.tokens.demoUsdc = { ...file.tokens.demoUsdc, name: 'USD Coin (demo)', symbol: 'dUSDC', decimals: 18, treasury: deployer.address };
    }
  }

  file.applications.CopyBlox = {
    ...file.applications.CopyBlox,
    role: 'wallet factory (cloneBlox) - new player accounts',
    cloneImplementation: accountBloxImpl,
    note: 'Clones the U0 AccountBlox fixture: Clones.clone copies runtime code only, so the clone starts uninitialised.',
  };

  file.updatedAt = new Date().toISOString();
  fs.writeFileSync(deploymentsFile, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`\nwrote ${path.relative(process.cwd(), deploymentsFile)}`);
  console.log(`  CopyBlox   ${copyBlox}  (clone implementation: ${accountBloxImpl})`);
  console.log(`  payment   ${paymentToken}${target === 'remote' ? `  (treasury: ${deployer.address})` : target === 'sepolia' ? '  (open-mint practice USDC, pinned)' : '  (Arc native USDC)'}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
