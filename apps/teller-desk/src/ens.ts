/**
 * U5 — ENSv2 Name Desk.
 *
 * ENS is an identity/read surface on Sepolia. It never carries a Branch Zero payment: the resolved address
 * is handed back to the existing Lane A/B routes, which still execute on Remote EVM 1337.
 *
 * The deployed ENSv2 Universal Resolver is deliberately passed to every viem ENS action. The viem default and
 * the legacy 0xeEeE… proxy do not walk native ENSv2 children under branchzero.eth (ENG-2026-0007 / K6).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  keccak256,
  namehash,
  parseAbi,
  toBytes,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getEnsAddress, getEnsText } from 'viem/actions';
import { normalize } from 'viem/ens';
import { sepolia, type StageEvent } from '@branch-zero/shared';
import { config, REPO_ROOT } from './config.ts';
import { emitStage, patchPlayer, type Player } from './store.ts';
import { maybeTopUp } from './treasury.ts';

const ETH_REGISTRAR_ABI = parseAbi([
  'function isAvailable(string label) view returns (bool)',
]);

const ETH_REGISTRY_ABI = parseAbi([
  'function getSubregistry(string label) view returns (address)',
  'function getResolver(string label) view returns (address)',
]);

const CUSTOMER_REGISTRY_ABI = parseAbi([
  'function getState(uint256 anyId) view returns (uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, bytes32 resource)',
  'function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256 tokenId)',
]);

const RESOLVER_ABI = parseAbi([
  'function setAddr(bytes32 node, address addr_)',
  'function setText(bytes32 node, string key, string value)',
]);

// ENSv2 registry event spelling changed in the public docs during the beta. Read both spellings; they have the
// same fields and the deployed registry only emits one of them. This is indexing only, not a mint dependency.
const LABEL_REGISTERED_ABI = parseAbi([
  'event LabelRegistered(uint256 indexed tokenId, bytes32 indexed labelHash, string label, address owner, uint64 expiry, address indexed sender)',
]);
const NAME_REGISTERED_ABI = parseAbi([
  'event NameRegistered(uint256 indexed tokenId, bytes32 indexed labelHash, string label, address owner, uint64 expiry, address indexed sender)',
]);

const AVAILABLE = 0;
const ONE_YEAR = 365n * 24n * 60n * 60n;

// Copied from the ENG-2026-0007 handoff's proven UserRegistry registration shape. These are ENSv2 EAC bits,
// not Bloxchain roles and must not be mixed with the Remote EVM role tables.
const ROLE_SET_SUBREGISTRY = 1n << 20n;
const ROLE_SET_RESOLVER = 1n << 24n;
const ROLE_CAN_TRANSFER_ADMIN = (1n << 28n) << 128n;
const ADMIN = (role: bigint) => role << 128n;
const REGISTRATION_ROLES =
  ROLE_SET_SUBREGISTRY |
  ADMIN(ROLE_SET_SUBREGISTRY) |
  ROLE_SET_RESOLVER |
  ADMIN(ROLE_SET_RESOLVER) |
  ROLE_CAN_TRANSFER_ADMIN;

interface EnsDeployment {
  chainId: number;
  parentName: string;
  parentLabel: string;
  registrar: Address;
  ethRegistrar: Address;
  ethRegistry: Address;
  customersRegistry: Address;
  resolver: Address;
  universalResolver: Address;
}

export interface EnsClaim {
  label: string;
  name: string;
  address: Address;
  owner: Address;
  expiry: string;
  txHash?: Hex;
}

export interface EnsAvailableResult {
  chainId: number;
  parent: string;
  label?: string;
  name?: string;
  available?: boolean;
  expiry?: string;
  owner?: Address;
  recent: EnsClaim[];
}

let deployment: EnsDeployment | undefined;
let client: PublicClient | undefined;
let wallet: WalletClient | undefined;
let registrarAddress: Address | undefined;

function asAddress(value: unknown, field: string): Address {
  if (typeof value !== 'string' || !isAddress(value)) throw new Error(`invalid ENS deployment address: ${field}`);
  return getAddress(value) as Address;
}

function ensDeployment(): EnsDeployment {
  if (deployment) return deployment;
  const file = path.join(REPO_ROOT, 'infra', 'deployments', 'sepolia.json');
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    deployment = {
      chainId: Number(raw.chainId),
      parentName: normalize(String(raw.parentName ?? config.ensParentName)),
      parentLabel: String(raw.parentLabel ?? 'branchzero'),
      registrar: asAddress(raw.registrar, 'registrar'),
      ethRegistrar: asAddress(raw.ethRegistrar, 'ethRegistrar'),
      ethRegistry: asAddress(raw.ethRegistry, 'ethRegistry'),
      customersRegistry: asAddress(raw.customersRegistry, 'customersRegistry'),
      resolver: asAddress(raw.resolver, 'resolver'),
      universalResolver: asAddress(raw.universalResolver, 'universalResolver'),
    };
  } catch (e) {
    throw Object.assign(new Error(`ENS deployment is unavailable: ${(e as Error).message}`), { statusCode: 503, code: 'ENS_NOT_CONFIGURED' });
  }
  if (deployment.chainId !== sepolia.id || deployment.parentLabel !== 'branchzero' || deployment.parentName !== 'branchzero.eth') {
    throw Object.assign(new Error('ENS deployment is not the pinned Branch Zero Sepolia parent'), { statusCode: 503, code: 'ENS_NOT_CONFIGURED' });
  }
  return deployment;
}

function ensClient(): PublicClient {
  if (client) return client;
  const d = ensDeployment();
  if (!config.sepoliaRpcUrl) throw Object.assign(new Error('SEPOLIA_RPC_URL is missing'), { statusCode: 503, code: 'ENS_NOT_CONFIGURED' });
  client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpcUrl) });
  if (d.chainId !== sepolia.id) throw Object.assign(new Error(`ENS client is configured for chain ${d.chainId}, expected ${sepolia.id}`), { statusCode: 503, code: 'ENS_NOT_CONFIGURED' });
  return client;
}

function ensWallet(): { client: PublicClient; wallet: WalletClient; address: Address; deployment: EnsDeployment } {
  const d = ensDeployment();
  const c = ensClient();
  if (wallet && registrarAddress) return { client: c, wallet, address: registrarAddress, deployment: d };
  const raw = (config.ensRegistrarPk ?? '').trim();
  if (!raw) throw Object.assign(new Error('ENS_REGISTRAR_PK is missing; the Name Desk has no Sepolia bank key'), { statusCode: 503, code: 'ENS_NOT_CONFIGURED' });
  const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex;
  const account = privateKeyToAccount(key);
  if (account.address.toLowerCase() !== d.registrar.toLowerCase()) {
    throw Object.assign(new Error(`ENS_REGISTRAR_PK resolves to ${account.address}, not the pinned registrar ${d.registrar}`), { statusCode: 503, code: 'ENS_NOT_CONFIGURED' });
  }
  wallet = createWalletClient({ account, chain: sepolia, transport: http(config.sepoliaRpcUrl!) });
  registrarAddress = account.address;
  return { client: c, wallet, address: account.address, deployment: d };
}

function invalidName(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 400, code: 'INVALID_NAME' });
}

/** Normalize one customer label, never an arbitrary dotted name. */
function labelOf(input: unknown): string {
  const raw = String(input ?? '').trim();
  if (!raw || raw.includes('.') || raw.length > 255) invalidName('name claims use one label under branchzero.eth');
  let label: string;
  try {
    label = normalize(raw);
  } catch (e) {
    invalidName(`invalid ENS label: ${(e as Error).message}`);
  }
  if (!label || label.includes('.') || label.length > 63 || label.toLowerCase() === 'branchzero' || label.toLowerCase() === 'eth') {
    invalidName('invalid ENS customer label');
  }
  return label;
}

function nameOf(input: unknown, d: EnsDeployment): string {
  const raw = String(input ?? '').trim();
  let name: string;
  try {
    name = normalize(raw);
  } catch (e) {
    invalidName(`invalid ENS name: ${(e as Error).message}`);
  }
  const suffix = `.${d.parentName}`;
  if (!name.endsWith(suffix) || name.slice(0, -suffix.length).includes('.') || name === d.parentName) {
    invalidName(`names must be one customer label under ${d.parentName}`);
  }
  return name;
}

async function readEns<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    // viem attaches its own error codes to RPC failures. Keep only our actionable
    // configuration code at the desk boundary.
    if (e && typeof e === 'object' && (e as { code?: string }).code === 'ENS_NOT_CONFIGURED') throw e;
    throw Object.assign(new Error(`ENS Sepolia read failed: ${(e as Error).message}`), { statusCode: 503, code: 'ENS_RPC' });
  }
}

async function sendEns(label: string, fn: () => Promise<Hex>): Promise<Hex> {
  try {
    const hash = await fn();
    const receipt = await ensClient().waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`${label} transaction reverted (${hash})`);
    return hash;
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'ENS_NOT_CONFIGURED') throw e;
    throw Object.assign(new Error(`ENS ${label} failed: ${(e as Error).message}`), { statusCode: 400, code: 'ENS_TX_FAILED' });
  }
}

async function parentReady(c: PublicClient, d: EnsDeployment, sender: Address): Promise<void> {
  const [subregistry, resolver] = await readEns(() =>
    Promise.all([
      c.readContract({ address: d.ethRegistry, abi: ETH_REGISTRY_ABI, functionName: 'getSubregistry', args: [d.parentLabel], account: sender }),
      c.readContract({ address: d.ethRegistry, abi: ETH_REGISTRY_ABI, functionName: 'getResolver', args: [d.parentLabel], account: sender }),
    ]),
  );
  if (subregistry.toLowerCase() !== d.customersRegistry.toLowerCase() || resolver.toLowerCase() !== d.resolver.toLowerCase()) {
    throw Object.assign(new Error(`ENS parent ${d.parentName} is not linked to the pinned customer registry/resolver`), { statusCode: 503, code: 'ENS_NOT_CONFIGURED' });
  }
}

async function stateFor(label: string, c: PublicClient, d: EnsDeployment, sender: Address) {
  const state = await readEns(() =>
    c.readContract({
      address: d.customersRegistry,
      abi: CUSTOMER_REGISTRY_ABI,
      functionName: 'getState',
      args: [BigInt(keccak256(toBytes(label)))],
      account: sender,
    }),
  );
  return { status: Number(state[0]), expiry: BigInt(state[1]), owner: state[2] as Address };
}

async function logsFor(abi: typeof LABEL_REGISTERED_ABI | typeof NAME_REGISTERED_ABI, c: PublicClient, d: EnsDeployment) {
  const latest = await c.getBlockNumber();
  const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;
  return c.getLogs({ address: d.customersRegistry, abi, eventName: abi[0].name, fromBlock, toBlock: latest } as never);
}

/** The Name Desk board is an on-chain log view, not a second index database. */
export async function recentClaims(): Promise<EnsClaim[]> {
  const d = ensDeployment();
  const c = ensClient();
  const [labels, names] = await readEns(() => Promise.all([logsFor(LABEL_REGISTERED_ABI, c, d), logsFor(NAME_REGISTERED_ABI, c, d)]));
  const rows: EnsClaim[] = [];
  for (const log of [...labels, ...names]) {
    const args = (log as { args?: Record<string, unknown> }).args ?? {};
    if (typeof args.label !== 'string' || typeof args.owner !== 'string' || !isAddress(args.owner)) continue;
    let label: string;
    try {
      label = labelOf(args.label);
    } catch {
      continue;
    }
    rows.push({
      label,
      name: normalize(`${label}.${d.parentName}`),
      address: getAddress(args.owner) as Address,
      owner: getAddress(args.owner) as Address,
      expiry: String(args.expiry ?? '0'),
      txHash: (log as { transactionHash?: Hex }).transactionHash,
    });
  }
  const unique = new Map<string, EnsClaim>();
  for (const row of rows) unique.set(`${row.name}:${row.txHash ?? ''}`, row);
  return [...unique.values()].slice(-50).reverse();
}

export async function available(labelInput?: unknown): Promise<EnsAvailableResult> {
  const d = ensDeployment();
  const { client: c, address } = ensWallet();
  const recent = await recentClaims();
  if (labelInput === undefined || String(labelInput).trim() === '') return { chainId: d.chainId, parent: d.parentName, recent };
  const label = labelOf(labelInput);
  await parentReady(c, d, address);
  const state = await stateFor(label, c, d, address);
  return {
    chainId: d.chainId,
    parent: d.parentName,
    label,
    name: normalize(`${label}.${d.parentName}`),
    available: state.status === AVAILABLE,
    expiry: state.expiry.toString(),
    ...(state.owner !== zeroAddress ? { owner: state.owner } : {}),
    recent,
  };
}

function ensStage(player: Player, jobId: string) {
  return (stage: StageEvent['stage'], bankLine: string, extra: Partial<StageEvent> = {}) =>
    emitStage(player.privyUserId, { type: 'stage', jobId, lane: 'ENS', stage, bankLine, ...extra });
}

/** Mint one customer subname and point its addr(60) at the player's AccountBlox. */
export async function mint(player: Player, labelInput: unknown, jobId: string): Promise<EnsClaim & { txHashes: Hex[]; tier: string; account: Address; owner: Address }> {
  if (!player.account) throw Object.assign(new Error('Open an AccountBlox before claiming a name'), { statusCode: 400, code: 'NO_ACCOUNT' });
  await maybeTopUp('pre-ens-mint');
  const { client: c, wallet: w, address: registrar, deployment: d } = ensWallet();
  const label = labelOf(labelInput);
  const name = normalize(`${label}.${d.parentName}`);
  await parentReady(c, d, registrar);
  const state = await stateFor(label, c, d, registrar);
  if (state.status !== AVAILABLE) throw Object.assign(new Error(`${name} is already registered`), { statusCode: 409, code: 'NAME_TAKEN' });

  const block = await readEns(() => c.getBlock());
  const expiry = block.timestamp + ONE_YEAR;
  const stage = ensStage(player, jobId);
  stage('signing', 'Checking the Name Desk register…');
  stage('broadcasting', `Registering ${name} on Sepolia…`);
  const registerHash = await sendEns('name registration', () =>
    w.writeContract({
      address: d.customersRegistry,
      abi: CUSTOMER_REGISTRY_ABI,
      functionName: 'register',
      args: [label, player.ownerAddress, zeroAddress, d.resolver, REGISTRATION_ROLES, expiry],
      account: w.account!,
      chain: sepolia,
    }),
  );
  const node = namehash(name);
  stage('broadcasting', `Pointing ${name} at your account…`, { hash: registerHash });
  const addrHash = await sendEns('address record', () =>
    w.writeContract({ address: d.resolver, abi: RESOLVER_ABI, functionName: 'setAddr', args: [node, player.account!] , account: w.account!, chain: sepolia }),
  );
  stage('broadcasting', 'Writing your Silver passbook record…', { hash: addrHash });
  const textHash = await sendEns('tier record', () =>
    w.writeContract({ address: d.resolver, abi: RESOLVER_ABI, functionName: 'setText', args: [node, 'bz.tier', 'Silver'], account: w.account!, chain: sepolia }),
  );

  const resolved = await resolve(name);
  if (resolved.address.toLowerCase() !== player.account.toLowerCase()) {
    throw Object.assign(new Error(`${name} did not resolve to the player's AccountBlox`), { statusCode: 503, code: 'ENS_RECORD_FAILED' });
  }
  patchPlayer(player.privyUserId, { ensName: name, ensTier: 'Silver' });
  stage('mined', `${name} is ready — it points to your account.`, { hash: textHash });
  return { label, name, address: player.account, owner: player.ownerAddress, expiry: expiry.toString(), txHash: textHash, txHashes: [registerHash, addrHash, textHash], tier: 'Silver', account: player.account };
}

export async function setText(player: Player, nameInput: unknown, keyInput: unknown, valueInput: unknown, jobId: string) {
  await maybeTopUp('pre-ens-set-text');
  const { client: c, wallet: w, address: registrar, deployment: d } = ensWallet();
  const name = nameOf(nameInput || player.ensName, d);
  if (String(keyInput ?? '') !== 'bz.tier' || !['Silver', 'Gold'].includes(String(valueInput ?? ''))) {
    throw Object.assign(new Error('the Name Desk only edits bz.tier to Silver or Gold'), { statusCode: 400, code: 'BAD_ARGS' });
  }
  const resolved = await resolve(name);
  if (!player.account || resolved.address.toLowerCase() !== player.account.toLowerCase()) {
    throw Object.assign(new Error(`${name} does not point to this player's AccountBlox`), { statusCode: 403, code: 'NAME_NOT_OWNED' });
  }
  await parentReady(c, d, registrar);
  const stage = ensStage(player, jobId);
  stage('signing', `Preparing the ${String(valueInput)} passbook record…`);
  const hash = await sendEns('text record', () =>
    w.writeContract({ address: d.resolver, abi: RESOLVER_ABI, functionName: 'setText', args: [namehash(name), 'bz.tier', String(valueInput)], account: w.account!, chain: sepolia }),
  );
  // The passbook reads the tier from the desk mirror on /session, so every Name Desk write keeps the mirror current.
  patchPlayer(player.privyUserId, { ensTier: String(valueInput), ...(player.ensName ? {} : { ensName: name }) });
  stage('mined', `${name} now carries a ${String(valueInput)} passbook record.`, { hash });
  return { name, key: 'bz.tier', value: String(valueInput), txHash: hash, chainId: d.chainId };
}

export async function resolve(nameInput: unknown) {
  const d = ensDeployment();
  const name = nameOf(nameInput, d);
  const c = ensClient();
  const address = await readEns(() => getEnsAddress(c, { name, universalResolverAddress: d.universalResolver, strict: true }));
  if (!address) throw Object.assign(new Error(`${name} has no address record`), { statusCode: 404, code: 'NAME_NOT_FOUND' });
  const tier = await readEns(() => getEnsText(c, { name, key: 'bz.tier', universalResolverAddress: d.universalResolver, strict: false }));
  return { name, address, chainId: d.chainId, ...(tier ? { tier } : {}) };
}
