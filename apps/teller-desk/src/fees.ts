import { formatEther, type Hex } from 'viem';
import { ARC_TESTNET_CHAIN_ID, formatUsdc } from '@branch-zero/shared';
import { chain, publicClient } from './chain.ts';

/** Gas paid by the Teller Desk, formatted for the receipt rather than contract calldata. */
export async function receiptFee(hash: Hex): Promise<string> {
  const receipt = await publicClient.getTransactionReceipt({ hash });
  const fee = receipt.gasUsed * receipt.effectiveGasPrice;
  return chain.id === ARC_TESTNET_CHAIN_ID ? `$${formatUsdc(fee, 18, 6)}` : `${formatEther(fee)} ETH`;
}
