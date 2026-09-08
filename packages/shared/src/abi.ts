import { parseAbi } from 'viem';

/**
 * The two ABI fragments the product needs that `@bloxchain/sdk` does not expose at runtime.
 *
 * The SDK ships full ABIs under `abi/` but its package `exports` map has no `./abi/*` subpath, so
 * `@bloxchain/sdk/abi/CopyBlox.abi.json` is unreachable (same wall U0 hit on the EIP-712 constants —
 * see GameDevOS `wiki/lessons/verify-published-package-artifacts.md`). These are transcriptions of
 * signatures from that published ABI, not invented semantics: every stateful Bloxchain call still goes
 * through the SDK wrappers (`GuardController`, `BaseStateMachine`, `MetaTransactionSigner`).
 */

/** `CopyBlox` — EIP-1167 clone factory. Clone + `initialize` happen in one transaction. */
export const copyBloxAbi = parseAbi([
  'function cloneBlox(address bloxAddress, address initialOwner, address broadcaster, address recovery, uint256 timeLockPeriodSec) returns (address cloneAddress)',
  'function getCloneCount() view returns (uint256)',
  'function isClone(address) view returns (bool)',
  'event BloxCloned(address indexed original, address indexed clone, address indexed initialOwner, uint256 cloneNumber)',
]);

/** Plain ERC-20 surface for the demo faucet token (balances, funding, and the Lane A payload). */
export const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
]);

/**
 * The practice-dollar mint. Only the *demo* tokens carry it, and only where it is permissionless: the U5
 * Sepolia mock USDC (`0xD332…422f`, 6 decimals) lets anyone mint, which is how the Live wing's bank till
 * refills itself without touching Circle's faucet USDC (docs/SEPOLIA-LIVE.md §4.2). Never assume a real
 * token exposes this — Arc's native USDC does not, which is why the faucet stays closed there.
 */
export const mintableErc20Abi = parseAbi(['function mint(address to, uint256 amount)']);
