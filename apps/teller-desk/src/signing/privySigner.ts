/**
 * The signing lane (K2).
 *
 * `MetaTransactionSigner.signMetaTransactionWithWallet` builds the canonical Bloxchain EIP-712 payload
 * (domain `Bloxchain`, primary type `MetaTransaction`, `verifyingContract` = the player's account) and
 * calls `walletClient.signTypedData`. We hand it a viem *custom account* whose `signTypedData` is
 * fulfilled by Privy's session signer, so the SDK stays the single source of the EIP-712 shape and no
 * browser — and no key — is involved. The SDK then recovers the signer from the digest the contract
 * produced and throws unless it equals `metaTx.params.signer`; that check *is* K2.
 */
import { MetaTransactionSigner } from '@bloxchain/sdk';
import { createWalletClient, http, type Address, type Chain, type Hex, type PublicClient } from 'viem';
import { toAccount } from 'viem/accounts';
import { config } from '../config.ts';
import { authorizationContext, privy } from '../privy.ts';

export interface SigningContext {
  owner: Address;
  walletId: string;
  /** The player's AccountBlox — the EIP-712 `verifyingContract`. */
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

/** A viem account whose only capability is Bloxchain typed data, signed inside Privy's enclave. */
function privyBackedAccount(ctx: SigningContext) {
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
    async signTransaction() {
      throw new Error('This account signs typed data only; gas is paid by the broadcaster');
    },
  });
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
