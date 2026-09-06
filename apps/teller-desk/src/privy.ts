import { PrivyClient, isEmbeddedWalletLinkedAccount, type User } from '@privy-io/node';
import { getAddress, type Address } from 'viem';
import { config } from './config.ts';

export const privy = new PrivyClient({ appId: config.privy.appId, appSecret: config.privy.appSecret });

/**
 * Every wallet request is signed with our P-256 authorization key. Privy checks that signature against
 * the key quorum the player delegated to; without it the app secret alone cannot move a user's wallet.
 */
export const authorizationContext = { authorization_private_keys: [config.privy.authorizationKey] };

export interface PlayerIdentity {
  privyUserId: string;
  /** The embedded wallet address — this becomes `OWNER_ROLE` on the player's AccountBlox. */
  ownerAddress: Address;
  /** Privy's wallet id; the handle used for every server-side signature request. */
  walletId: string;
  /** True once the session signer is attached, i.e. the Teller Desk may sign without the browser. */
  delegated: boolean;
}

/**
 * Authenticate a caller.
 *
 * The access token proves *who* they are. The wallet address they claim is then looked up at Privy and
 * the returned user id must match the token's, which proves the wallet is theirs — so a caller cannot
 * point the Teller Desk at someone else's wallet by passing a different address.
 */
export async function identify(accessToken: string, claimedAddress?: string): Promise<PlayerIdentity> {
  const claims = await privy.utils().auth().verifyAccessToken(accessToken);
  const address = claimedAddress?.trim();
  if (!address) {
    throw Object.assign(new Error('wallet address required alongside the access token'), { statusCode: 400, code: 'BAD_ARGS' });
  }
  const user = await privy.users().getByWalletAddress({ address });
  if (user.id !== claims.user_id) {
    throw Object.assign(new Error('that wallet does not belong to the authenticated user'), { statusCode: 403, code: 'AUTH' });
  }
  return { privyUserId: claims.user_id, ...embeddedWalletOf(user, address) };
}

/** Pick the user's Privy-held EVM wallet out of their linked accounts. */
export function embeddedWalletOf(user: User, address?: string): { ownerAddress: Address; walletId: string; delegated: boolean } {
  const wanted = address?.toLowerCase();
  const wallet = user.linked_accounts.filter(isEmbeddedWalletLinkedAccount).find((a) => {
    const w = a as { chain_type?: string; address?: string };
    return w.chain_type === 'ethereum' && (!wanted || w.address?.toLowerCase() === wanted);
  }) as { id?: string | null; address?: string; delegated?: boolean } | undefined;

  if (!wallet?.address || !wallet.id) {
    throw Object.assign(new Error('No Privy embedded EVM wallet on this account — create one before opening an account'), {
      statusCode: 400,
      code: 'NO_WALLET',
    });
  }
  return { ownerAddress: getAddress(wallet.address) as Address, walletId: wallet.id, delegated: Boolean(wallet.delegated) };
}

/**
 * K5 — one policy per player, tightened to that player's own account contract.
 *
 * Two things constrain the shape of this:
 *
 * 1. A user-controlled embedded wallet is owned by the *user's* own key quorum, not ours. Attaching a
 *    session signer or a policy to it is a wallet update, and Privy rejects that with 401 unless the
 *    owner authorises it — so the delegation genuinely has to happen in the browser, with consent.
 *    That is the "one modal", and it is a real control rather than a UI courtesy.
 * 2. The policy must therefore exist *before* the player delegates, but the account address we want to
 *    pin only exists after provisioning. Policy rules are app-owned, so we create the policy pinned to
 *    the chain, hand its id to the overlay, and tighten the rule to the account once it is cloned.
 *
 * Privy's typed-data domain conditions expose `verifyingContract` and `chainId` but **not** `name`
 * (`EthereumTypedDataDomainConditionField`), so the `domain.name == "Bloxchain"` check sketched in
 * docs/PRIVY.md §4 is not expressible. Pinning `verifyingContract` is the stronger half anyway: it is
 * the player's own AccountBlox, so a signature obtained under this policy cannot address another
 * player's account, and pinning `chainId` stops a Remote EVM signature being solicited for a public chain.
 */
const RULE_NAME = 'Bloxchain meta-tx for this account';

export interface PlayerPolicy {
  policyId: string;
  ruleId: string;
}

/** Created at sign-in, before the account exists: allow Bloxchain typed data on our chain only. */
export async function createPlayerPolicy(chainId: number, label: string): Promise<PlayerPolicy> {
  const policy = await privy.policies().create({
    version: '1.0',
    chain_type: 'ethereum',
    name: `bz-${label}`.slice(0, 48),
    rules: [
      {
        name: RULE_NAME,
        method: 'eth_signTypedData_v4',
        action: 'ALLOW',
        conditions: [{ field_source: 'ethereum_typed_data_domain', field: 'chainId', operator: 'eq', value: String(chainId) }],
      },
    ],
  });
  const ruleId = (policy as { rules?: Array<{ id: string }> }).rules?.[0]?.id;
  if (!ruleId) throw new Error('Privy returned a policy with no rule id');
  return { policyId: policy.id, ruleId };
}

/**
 * Narrow the player's policy to their account once it exists. Everything outside this account — another
 * player's AccountBlox, another chain, any non-typed-data method — now falls through to the default DENY.
 */
export async function pinPolicyToAccount(policy: PlayerPolicy, account: Address, chainId: number): Promise<void> {
  await privy.policies().updateRule(policy.ruleId, {
    policy_id: policy.policyId,
    authorization_context: authorizationContext,
    name: RULE_NAME,
    method: 'eth_signTypedData_v4',
    action: 'ALLOW',
    conditions: [
      { field_source: 'ethereum_typed_data_domain', field: 'verifyingContract', operator: 'eq', value: account },
      { field_source: 'ethereum_typed_data_domain', field: 'chainId', operator: 'eq', value: String(chainId) },
    ],
  });
}
