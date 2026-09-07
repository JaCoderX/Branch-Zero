import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAddress, type Address, type Hex } from 'viem';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} — see .env.example`);
  return v;
}
function opt(name: string, fallback = ''): string {
  return process.env[name] || fallback;
}

/** Never log these. `redact` exists so startup logs can prove a value is present without leaking it. */
export function redact(v: string): string {
  return v.length <= 10 ? '***' : `${v.slice(0, 6)}…${v.slice(-4)}`;
}

export const config = {
  port: Number(opt('PORT', '8787')),
  rpcUrl: opt('REMOTE_EVM_RPC_URL', 'http://127.0.0.1:8545'),
  /** Remote EVM. The only chain the Teller Desk serves until U6. */
  chainId: 1337,
  allowedOrigins: opt('ALLOWED_ORIGINS', 'http://localhost:5173').split(',').map((s) => s.trim()),

  broadcasterPk: req('BROADCASTER_PK') as Hex,
  deployerPk: req('DEPLOYER_PK') as Hex,
  /** Optional (U2). Branch Manager: a runtime `BRANCH_MANAGER` role holder who may approve / cancel wires directly. */
  managerPk: (opt('MANAGER_PK') || undefined) as Hex | undefined,
  recoveryAddress: getAddress(req('RECOVERY_ADDRESS')) as Address,

  timeLockSec: BigInt(opt('TIMELOCK_SEC', '120')),
  /** Lane A soft cap. Off-chain policy only — see docs/REFLECTION.md §2.2 "partial" invariant. */
  instantLimit: opt('INSTANT_LIMIT_USDC', '100'),
  /** Opening balance handed to a freshly provisioned account, in display units. */
  openingBalance: opt('OPENING_BALANCE_USDC', '500'),
  /**
   * U2, Lane B option 1: the player's embedded wallet sends `executeWithTimeLock` / `approveTimeLockExecution`
   * itself (signed by the session signer), so it needs a little gas. Topped up from the deployer at
   * Account Opening whenever the balance drops under half of this.
   */
  ownerGasEth: opt('OWNER_GAS_ETH', '0.05'),
  /**
   * U4+ Priority release. `on` (default when a manager key is present): accounts are provisioned with the
   * owner-signs / manager-submits META_APPROVE split on the transfer selector, so Mr. Okafor can release a
   * cooling wire early once the player brings a Passkey (hand scan). `off` = vault-only accounts (the U2
   * invariant: no META_APPROVE bits on `transfer`; the clock is the only way out). Changing this changes
   * `desiredGrants()`; the next Re-check re-syncs every player. META bits are account-wide: once granted, any
   * PENDING wire on that account can be bypassed — Okafor says so in his "Ask why".
   */
  priorityRelease: opt('PRIORITY_RELEASE', opt('MANAGER_PK') ? 'on' : 'off').toLowerCase() === 'on' && Boolean(opt('MANAGER_PK')),

  /** U5: ENS identity is always read/written on Sepolia; it is never the payment chain. */
  sepoliaRpcUrl: opt('SEPOLIA_RPC_URL'),
  ensParentName: opt('ENS_PARENT_NAME', 'branchzero.eth'),
  /** Sepolia throwaway bank key. Lazy ENS client construction fails with ENS_NOT_CONFIGURED if absent. */
  ensRegistrarPk: opt('ENS_REGISTRAR_PK') as Hex | undefined,

  privy: {
    appId: req('PRIVY_APP_ID'),
    appSecret: req('PRIVY_APP_SECRET'),
    /** Dashboard value is prefixed `wallet-auth:`; the API wants the bare base64 PKCS8 key. */
    authorizationKey: req('PRIVY_AUTHORIZATION_KEY').replace(/^wallet-auth:/, ''),
    /** Key-quorum id registered in the dashboard — this is the "session signer". */
    signerId: req('PRIVY_SIGNER_ID'),
    /** Optional app-wide policy; per-player policies are created at provisioning (K5). */
    policyId: opt('PRIVY_POLICY_ID'),
  },
} as const;

/** Addresses written by `npm run chain:bootstrap` / `chain:deploy`. Public data, committed. */
export function deployments() {
  const file = path.join(REPO_ROOT, 'infra', 'deployments', 'remote-evm.json');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const copyBlox = d.applications?.CopyBlox;
  const token = d.tokens?.demoUsdc;
  if (!copyBlox?.address) throw new Error('CopyBlox missing from infra/deployments/remote-evm.json — run `npm run chain:bootstrap`');
  if (!token?.address) throw new Error('demoUsdc missing from infra/deployments/remote-evm.json — run `npm run chain:bootstrap`');
  return {
    chainId: d.chainId as number,
    copyBlox: getAddress(copyBlox.address) as Address,
    /** First block that can hold a `BloxCloned` event — where account recovery scans from. */
    copyBloxDeployedAtBlock: BigInt(copyBlox.deployedAtBlock ?? 0),
    /** The U0 fixture doubles as the clone implementation: `Clones.clone` copies runtime code, not storage. */
    accountBloxImplementation: getAddress(copyBlox.cloneImplementation ?? d.accounts[0].address) as Address,
    fixtureAccount: getAddress(d.accounts[0].address) as Address,
    fixtureOwner: getAddress(d.accounts[0].owner) as Address,
    guardDefinitions: getAddress(d.libraries.GuardControllerDefinitions.address) as Address,
    rbacDefinitions: getAddress(d.libraries.RuntimeRBACDefinitions.address) as Address,
    token: {
      address: getAddress(token.address) as Address,
      symbol: (token.symbol ?? 'dUSDC') as string,
      decimals: (token.decimals ?? 18) as number,
    },
  };
}
