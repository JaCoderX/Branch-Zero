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
  }),
  libraries: z.record(z.string(), z.object({ address, txHash: hash.optional() })),
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
