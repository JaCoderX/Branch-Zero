import { formatUnits } from 'viem';

/**
 * Render a native Arc USDC amount for people, not for contracts.
 * Arc keeps native balances/fees at 18 decimals while its ERC-20 view is 6 decimals.
 */
export function formatUsdc(value: bigint | string | number, decimals = 18, displayDecimals = 6): string {
  const raw = formatUnits(BigInt(value), decimals);
  const [whole, fraction = ''] = raw.split('.');
  const shown = fraction.padEnd(displayDecimals, '0').slice(0, displayDecimals);
  return displayDecimals > 0 ? `${whole}.${shown}` : whole;
}
