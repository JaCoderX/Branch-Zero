import { z } from 'zod';

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'address');
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'hash');

/** infra/deployments/<chain>.json — addresses and provenance only. Never keys. */
export const DeploymentFileSchema = z.object({
  chainId: z.number().int(),
  chainName: z.string(),
  updatedAt: z.string(),
  deployer: address,
  compiler: z.object({
    solc: z.string(),
    evmVersion: z.string(),
    optimizerRuns: z.number().int(),
    viaIR: z.boolean(),
  }),
  sources: z.object({
    contractsPackage: z.string(),
    sdkPackage: z.string(),
    accountBloxTemplate: z.object({ url: z.string(), commit: z.string(), sha256: z.string() }),
    /** sha256 of each already-built protocol artifact consumed by `npm run chain:bootstrap`. */
    protocolArtifacts: z.record(z.string(), z.object({ path: z.string(), sha256: z.string() })).optional(),
  }),
  libraries: z.record(z.string(), z.object({ address, txHash: hash.optional() })),
  /** One-time bootstrap deployments of published protocol bytecode (U1: CopyBlox). Addresses only. */
  applications: z
    .record(
      z.string(),
      z.object({ address, txHash: hash.optional(), deployedAtBlock: z.number().int().optional(), cloneImplementation: address.optional() }).passthrough(),
    )
    .optional(),
  /** Demo money. Not protocol code -- a plain OZ ERC-20 used as a faucet token on the lab chain. */
  tokens: z
    .record(
      z.string(),
      z
        .object({ address, txHash: hash.optional(), symbol: z.string().optional(), decimals: z.number().int().optional(), treasury: address.optional() })
        .passthrough(),
    )
    .optional(),
  accounts: z.array(
    z.object({
      label: z.string(),
      address,
      owner: address,
      broadcaster: address,
      recovery: address,
      timeLockPeriodSec: z.number().int(),
      eventForwarder: address,
      deployTxHash: hash,
      initializeTxHash: hash,
      block: z.number().int(),
    }),
  ),
});
export type DeploymentFile = z.infer<typeof DeploymentFileSchema>;
