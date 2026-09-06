/**
 * The signing lane (K2) — and, since U2, the owner's own transactions (V6).
 *
 * `MetaTransactionSigner.signMetaTransactionWithWallet` builds the canonical Bloxchain EIP-712 payload
 * (domain `Bloxchain`, primary type `MetaTransaction`, `verifyingContract` = the player's account) and
 * calls `walletClient.signTypedData`. We hand it a viem *custom account* whose `signTypedData` is
 * fulfilled by Privy's session signer, so the SDK stays the single source of the EIP-712 shape and no
 * browser — and no key — is involved. The SDK then recovers the signer from the digest the contract
 * produced and throws unless it equals `metaTx.params.signer`; that check *is* K2.
 *
 * U2 gives the same custom account a `signTransaction`, fulfilled by Privy's `eth_signTransaction`.
 * viem prepares the transaction (nonce, gas, fees) against Remote EVM, Privy signs it inside the
 * enclave under the player's policy, and the Teller Desk broadcasts the raw bytes. That is how the
 * *owner* — not the teller — files a wire (`executeWithTimeLock`) and later opens the vault
 * (`approveTimeLockExecution`): the direct path is the only one on which the contract enforces
 * `releaseTime`. Privy never needs to reach our chain; it only signs.
 */
import { MetaTransactionSigner } from '@bloxchain/sdk';
import {
  createWalletClient,
  http,
  numberToHex,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type TransactionSerializableEIP1559,
  type TransactionSerializableLegacy,
  type WalletClient,
} from 'viem';
import { toAccount } from 'viem/accounts';
import { config } from '../config.ts';
import { authorizationContext, privy } from '../privy.ts';

export interface SigningContext {
  owner: Address;
  walletId: string;
  /** The player's AccountBlox — the EIP-712 `verifyingContract` and the only `to` the tx policy allows. */
  account: Address;
}

export interface SignatureAudit {
  owner: Address;
  walletId: string;
  chainId: number;
  verifyingContract: Address;
  handlerSelector: Hex;
  nonce: string;
  deadline: string;
  action: number;
  ms: number;
}

/** Everything the signer sends to Privy is logged, so what was signed is auditable after the fact. */
export type AuditSink = (entry: SignatureAudit) => void;

/** One owner-sent transaction, as logged. `selector` is the first four bytes of calldata. */
export interface TxAudit {
  owner: Address;
  walletId: string;
  chainId: number;
  to: Address;
  selector: Hex;
  nonce: number;
  gas: string;
  ms: number;
}
export type TxAuditSink = (entry: TxAudit) => void;

/**
 * viem hands typed data to `signTypedData` with `uint256` fields as JavaScript BigInts. Privy canonicalises
 * the request body as JSON before signing it with the authorization key, and `JSON.stringify` throws on a
 * BigInt — so every numeric field is rendered as a decimal string, which is what EIP-712 JSON expects
 * anyway. Nothing about the digest changes; only the transport encoding does.
 */
function jsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as unknown as T;
  if (Array.isArray(value)) return value.map(jsonSafe) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, jsonSafe(v)])) as T;
  }
  return value;
}

/**
 * A viem account whose capabilities are exactly two: Bloxchain typed data, and transactions to the
 * player's own account — both signed inside Privy's enclave, both bounded by the player's policy.
 */
export function privyBackedAccount(ctx: SigningContext, txAudit?: TxAuditSink) {
  return toAccount({
    address: ctx.owner,
    async signTypedData(typedData) {
      const res = await privy.wallets().ethereum().signTypedData(ctx.walletId, {
        authorization_context: authorizationContext,
        params: {
          typed_data: {
            domain: jsonSafe(typedData.domain) as never,
            types: jsonSafe(typedData.types) as never,
            primary_type: typedData.primaryType as string,
            message: jsonSafe(typedData.message) as Record<string, unknown>,
          },
        },
      } as never);
      return (res as { signature: Hex }).signature;
    },
    async signMessage() {
      // The contract recovers against the raw EIP-712 digest; an EIP-191 prefix would never verify.
      throw new Error('personal_sign is never used for Bloxchain meta-transactions');
    },
    async signTransaction(transaction) {
      // viem has already filled nonce / gas / fees from the chain; Privy only signs. We refuse anything
      // that is not a call into the player's own account before it even reaches the policy — the policy
      // is the control, this is the seat belt.
      const tx = transaction as TransactionSerializableEIP1559 & TransactionSerializableLegacy;
      if (!tx.to || tx.to.toLowerCase() !== ctx.account.toLowerCase()) {
        throw new Error(`owner transactions may only target the player's own account (${ctx.account}), not ${tx.to}`);
      }
      if (tx.nonce === undefined || tx.gas === undefined) throw new Error('transaction not prepared (nonce / gas missing)');
      const chainId = Number(tx.chainId ?? config.chainId);
      const fees =
        tx.maxFeePerGas !== undefined
          ? { type: 2 as const, max_fee_per_gas: numberToHex(tx.maxFeePerGas), max_priority_fee_per_gas: numberToHex(tx.maxPriorityFeePerGas ?? 0n) }
          : { type: 0 as const, gas_price: numberToHex(tx.gasPrice ?? 0n) };

      const started = Date.now();
      const res = await privy.wallets().ethereum().signTransaction(ctx.walletId, {
        authorization_context: authorizationContext,
        params: {
          transaction: {
            ...fees,
            chain_id: chainId,
            nonce: tx.nonce,
            to: tx.to,
            value: numberToHex(tx.value ?? 0n),
            data: tx.data ?? '0x',
            gas_limit: numberToHex(tx.gas),
          },
        },
      } as never);
      txAudit?.({
        owner: ctx.owner,
        walletId: ctx.walletId,
        chainId,
        to: tx.to,
        selector: ((tx.data ?? '0x').slice(0, 10) || '0x') as Hex,
        nonce: tx.nonce,
        gas: tx.gas.toString(),
        ms: Date.now() - started,
      });
      return (res as { signed_transaction: Hex }).signed_transaction;
    },
  });
}

/**
 * Wallet client acting *as the owner*, for direct calls on the player's account (Lane B request,
 * approve, cancel). Every write goes: viem prepares → Privy signs (policy) → Teller Desk broadcasts.
 */
export function ownerWalletClient(chain: Chain, ctx: SigningContext, txAudit?: TxAuditSink): WalletClient {
  return createWalletClient({ account: privyBackedAccount(ctx, txAudit), chain, transport: http(config.rpcUrl) });
}

/**
 * Sign one unsigned meta-transaction with the player's session signer.
 * Returns the meta-tx with `signature` set, ready for the broadcaster.
 */
export async function signMetaTx(
  publicClient: PublicClient,
  chain: Chain,
  unsigned: Awaited<ReturnType<MetaTransactionSigner['createUnsignedMetaTransactionForNew']>>,
  ctx: SigningContext,
  audit?: AuditSink,
) {
  const walletClient = createWalletClient({ account: privyBackedAccount(ctx), chain, transport: http(config.rpcUrl) });
  const signer = new MetaTransactionSigner(publicClient, walletClient, ctx.account, chain);

  const started = Date.now();
  const signed = await signer.signMetaTransactionWithWallet(unsigned);
  audit?.({
    owner: ctx.owner,
    walletId: ctx.walletId,
    chainId: Number(unsigned.params.chainId),
    verifyingContract: ctx.account,
    handlerSelector: unsigned.params.handlerSelector as Hex,
    nonce: String(unsigned.params.nonce),
    deadline: String(unsigned.params.deadline),
    action: Number(unsigned.params.action),
    ms: Date.now() - started,
  });
  return signed;
}
