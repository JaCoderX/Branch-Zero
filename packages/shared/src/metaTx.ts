/**
 * Bloxchain meta-transaction EIP-712 shape, as the SDK signs it (`@bloxchain/sdk` `utils/metaTx/metaTransaction`:
 * `META_TX_DOMAIN` name `Bloxchain`, primary type `MetaTransaction`, selective `MetaTxRecord`).
 *
 * The SDK does not export `META_TX_TYPES` from its package root (same wall as the ABIs — see `abi.ts`), and the
 * product needs the type list in two places the SDK cannot reach: the Privy **policy condition** that pins which
 * meta-tx `action` the silent session signer may sign (U4+, `apps/teller-desk/src/privy.ts`), and the browser's
 * `signTypedData` call for a Priority release, which wants an eth-sig-util `TypedMessage` with `EIP712Domain` in the
 * types. This is a transcription, not invented semantics: the Teller Desk cross-checks it against the typed data
 * the SDK's `MetaTransactionSigner` actually produces every time a Priority payload is prepared, and refuses to
 * continue on drift (`lanes/priority.ts`).
 */

export const META_TX_DOMAIN_NAME = 'Bloxchain';
export const META_TX_PRIMARY_TYPE = 'MetaTransaction';

export const EIP712_DOMAIN_TYPE = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
] as const;

export const META_TX_TYPED_DATA_TYPES = {
  MetaTransaction: [
    { name: 'txRecord', type: 'MetaTxRecord' },
    { name: 'params', type: 'MetaTxParams' },
    { name: 'data', type: 'bytes' },
  ],
  MetaTxRecord: [
    { name: 'txId', type: 'uint256' },
    { name: 'params', type: 'TxParams' },
    { name: 'payment', type: 'PaymentDetails' },
  ],
  TxParams: [
    { name: 'requester', type: 'address' },
    { name: 'target', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gasLimit', type: 'uint256' },
    { name: 'operationType', type: 'bytes32' },
    { name: 'executionSelector', type: 'bytes4' },
    { name: 'executionParams', type: 'bytes' },
  ],
  MetaTxParams: [
    { name: 'chainId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'handlerContract', type: 'address' },
    { name: 'handlerSelector', type: 'bytes4' },
    { name: 'action', type: 'uint8' },
    { name: 'deadline', type: 'uint256' },
    { name: 'maxGasPrice', type: 'uint256' },
    { name: 'signer', type: 'address' },
  ],
  PaymentDetails: [
    { name: 'recipient', type: 'address' },
    { name: 'nativeTokenAmount', type: 'uint256' },
    { name: 'erc20TokenAddress', type: 'address' },
    { name: 'erc20TokenAmount', type: 'uint256' },
  ],
} as const;

/**
 * The type set as it actually reaches a signer. viem's `signTypedData` prepends `EIP712Domain` (derived from the
 * domain's present fields: name, version, chainId, verifyingContract) before calling the account's `signTypedData`,
 * so this — not the bare SDK list — is what Privy sees in `eth_signTypedData_v4` requests from the Teller Desk.
 * Privy's `ethereum_typed_data_message` condition only matches when its `typed_data.types` equals the request's
 * types exactly (probed 2026-09-07: same list without `EIP712Domain` → every request denied), so policy conditions
 * must use this set.
 */
export const META_TX_TYPED_DATA_TYPES_AS_SIGNED = { EIP712Domain: EIP712_DOMAIN_TYPE, ...META_TX_TYPED_DATA_TYPES } as const;

/**
 * `TxAction` values (SDK `types/lib.index`): 0 EXECUTE_TIME_DELAY_REQUEST · 1 EXECUTE_TIME_DELAY_APPROVE ·
 * 2 EXECUTE_TIME_DELAY_CANCEL · 3 SIGN_META_REQUEST_AND_APPROVE · 4 SIGN_META_APPROVE · 5 SIGN_META_CANCEL ·
 * 6 EXECUTE_META_REQUEST_AND_APPROVE · 7 EXECUTE_META_APPROVE · 8 EXECUTE_META_CANCEL.
 */
export const TX_ACTION_SIGN_META_REQUEST_AND_APPROVE = 3;
export const TX_ACTION_SIGN_META_APPROVE = 4;

/**
 * The only meta-tx actions the **silent** session signer may sign (U4+). Lane A payments and the provisioning
 * config batches are all `SIGN_META_REQUEST_AND_APPROVE`. The Priority payload is `SIGN_META_APPROVE` and must
 * come from the player's own signer with a Passkey — the Privy policy denies it to the session signer.
 */
export const SILENT_SIGNER_ACTIONS: readonly number[] = [TX_ACTION_SIGN_META_REQUEST_AND_APPROVE];

/**
 * What the Teller Desk hands the browser for a Priority release, and what the browser hands Privy's
 * `signTypedData`. Numbers are decimal strings (JSON-safe; EIP-712 JSON accepts them). `types` includes
 * `EIP712Domain` because `@privy-io/react-auth` takes an eth-sig-util `TypedMessage`.
 */
export interface PriorityTypedData {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: typeof META_TX_PRIMARY_TYPE;
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  message: Record<string, unknown>;
}
