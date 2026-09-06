/**
 * Compile the PUBLISHED Bloxchain sources into deployable artifacts — no Solidity is authored in this repo.
 *
 *   core libraries + Account pattern : node_modules/@bloxchain/contracts (npm, MPL-2.0) — source + ABI only, no bytecode shipped
 *   AccountBlox template             : fetched at build time from the public Bloxchain-Protocol repo at the commit tagged
 *                                      `contracts-v1.0.0` (the commit the npm package was published from), pinned by
 *                                      commit hash AND sha256. It is not in the npm package (README: templates live in the main repo).
 *
 * Output: infra/build/artifacts/<Name>.json  (git-ignored; re-runnable)
 * Compiler settings mirror upstream foundry.toml (solc 0.8.35, optimizer 200, via-IR) except evmVersion, which defaults
 * to `prague` because Remote EVM's chainspec has no Osaka fork. Override with SOLC_EVM_VERSION.
 *
 *   npm run chain:compile
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import solc from 'solc';
import { loadEnv, ARTIFACTS_DIR, BUILD_DIR } from './lib/env.ts';

loadEnv();

// ---- pins -----------------------------------------------------------------------------------------------------------
export const ACCOUNTBLOX_TEMPLATE = {
  repo: 'PracticalParticle/Bloxchain-Protocol',
  tag: 'contracts-v1.0.0',
  commit: '99beac2d6e6d7567c23b25cecaf6f4053f31c987',
  path: 'contracts/examples/templates/AccountBlox.sol',
  sha256: 'a1c2d7c19f59969fb4bf717b15146121a1c68ddc7d802412e0cc023cddbd74c1',
  license: 'MIT',
} as const;
export const TEMPLATE_URL = `https://raw.githubusercontent.com/${ACCOUNTBLOX_TEMPLATE.repo}/${ACCOUNTBLOX_TEMPLATE.commit}/${ACCOUNTBLOX_TEMPLATE.path}`;

/** Libraries with external functions that AccountBlox links against (same order as upstream deploy-foundation-libraries.js). */
export const FOUNDATION_LIBRARIES = ['EngineBlox', 'SecureOwnableDefinitions', 'RuntimeRBACDefinitions', 'GuardControllerDefinitions'] as const;
export const ACCOUNT_CONTRACT = 'AccountBlox';

const LIB_SOURCES: Record<(typeof FOUNDATION_LIBRARIES)[number], string> = {
  EngineBlox: 'contracts/core/lib/EngineBlox.sol',
  SecureOwnableDefinitions: 'contracts/core/security/lib/definitions/SecureOwnableDefinitions.sol',
  RuntimeRBACDefinitions: 'contracts/core/access/lib/definitions/RuntimeRBACDefinitions.sol',
  GuardControllerDefinitions: 'contracts/core/execution/lib/definitions/GuardControllerDefinitions.sol',
};

// ---- locate published package ----------------------------------------------------------------------------------------
const require = createRequire(import.meta.url);
const contractsPkgJson = require.resolve('@bloxchain/contracts/package.json');
const contractsRoot = path.dirname(contractsPkgJson);
const contractsPkg = JSON.parse(fs.readFileSync(contractsPkgJson, 'utf8')) as { name: string; version: string };
const pkgRequire = createRequire(contractsPkgJson);

function sha256(s: string | Buffer): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function fetchTemplate(): Promise<string> {
  const cached = path.join(BUILD_DIR, 'sources', 'AccountBlox.sol');
  let text: string | undefined;
  if (fs.existsSync(cached)) text = fs.readFileSync(cached, 'utf8');
  if (!text || sha256(text) !== ACCOUNTBLOX_TEMPLATE.sha256) {
    console.log(`fetch  ${TEMPLATE_URL}`);
    const res = await fetch(TEMPLATE_URL);
    if (!res.ok) throw new Error(`template fetch failed: ${res.status} ${res.statusText}`);
    text = await res.text();
    const got = sha256(text);
    if (got !== ACCOUNTBLOX_TEMPLATE.sha256) {
      throw new Error(`AccountBlox.sol sha256 mismatch: expected ${ACCOUNTBLOX_TEMPLATE.sha256}, got ${got}. Refusing to compile unpinned source.`);
    }
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.writeFileSync(cached, text);
  }
  return text;
}

/** Map solc source-unit names onto the npm package / OZ deps. Relative imports are already resolved by solc. */
function findImports(p: string): { contents: string } | { error: string } {
  try {
    if (p.startsWith('contracts/core/')) {
      return { contents: fs.readFileSync(path.join(contractsRoot, p.slice('contracts/'.length)), 'utf8') };
    }
    if (p.startsWith('@openzeppelin/')) {
      return { contents: fs.readFileSync(pkgRequire.resolve(p), 'utf8') };
    }
    return { error: `unresolved import ${p}` };
  } catch (e) {
    return { error: `cannot read ${p}: ${(e as Error).message}` };
  }
}

interface SolcOutput {
  errors?: Array<{ severity: string; formattedMessage: string; errorCode?: string }>;
  contracts?: Record<string, Record<string, any>>;
}

async function main() {
  const evmVersion = process.env.SOLC_EVM_VERSION ?? 'prague';
  const template = await fetchTemplate();

  const sources: Record<string, { content: string }> = {
    [`contracts/examples/templates/${ACCOUNT_CONTRACT}.sol`]: { content: template },
  };
  for (const lib of FOUNDATION_LIBRARIES) {
    const r = findImports(LIB_SOURCES[lib]);
    if ('error' in r) throw new Error(r.error);
    sources[LIB_SOURCES[lib]] = { content: r.contents };
  }

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion,
      metadata: { bytecodeHash: 'ipfs' },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object', 'evm.bytecode.linkReferences', 'evm.deployedBytecode.object', 'metadata'] },
      },
    },
  };

  console.log(`solc   ${solc.version()}  evmVersion=${evmVersion} viaIR optimizer(200)`);
  console.log(`pkg    ${contractsPkg.name}@${contractsPkg.version} at ${path.relative(process.cwd(), contractsRoot)}`);
  const t0 = Date.now();
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports })) as SolcOutput;
  const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
  const warnings = (output.errors ?? []).filter((e) => e.severity !== 'error');
  console.log(`done   ${((Date.now() - t0) / 1000).toFixed(1)}s, ${warnings.length} warnings, ${errors.length} errors`);
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage);
    process.exit(1);
  }

  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const wanted = new Set<string>([ACCOUNT_CONTRACT, ...FOUNDATION_LIBRARIES]);
  const written: string[] = [];
  for (const [sourceName, contracts] of Object.entries(output.contracts ?? {})) {
    for (const [name, c] of Object.entries(contracts)) {
      if (!wanted.has(name)) continue;
      const bytecode: string = c.evm.bytecode.object;
      const artifact = {
        contractName: name,
        sourceName,
        abi: c.abi,
        bytecode: `0x${bytecode}`,
        deployedBytecode: `0x${c.evm.deployedBytecode.object}`,
        linkReferences: c.evm.bytecode.linkReferences ?? {},
        compiler: { solc: solc.version(), evmVersion, optimizerRuns: 200, viaIR: true },
        sources: {
          contractsPackage: `${contractsPkg.name}@${contractsPkg.version}`,
          ...(name === ACCOUNT_CONTRACT ? { accountBloxTemplate: { url: TEMPLATE_URL, ...ACCOUNTBLOX_TEMPLATE } } : {}),
        },
      };
      fs.writeFileSync(path.join(ARTIFACTS_DIR, `${name}.json`), JSON.stringify(artifact, null, 2));
      const linkNames = Object.values(artifact.linkReferences as Record<string, Record<string, unknown>>).flatMap((m) => Object.keys(m));
      const size = (bytecode.length / 2).toString().padStart(6);
      console.log(`write  ${name.padEnd(28)} ${size} bytes${linkNames.length ? `  links-> ${linkNames.join(', ')}` : ''}`);
      written.push(name);
    }
  }
  const missing = [...wanted].filter((n) => !written.includes(n));
  if (missing.length) {
    console.error(`missing artifacts: ${missing.join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
