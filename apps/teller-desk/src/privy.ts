import { PrivyClient, isEmbeddedWalletLinkedAccount, type User } from '@privy-io/node';
import { getAddress, parseAbi, type Address } from 'viem';
import { META_TX_PRIMARY_TYPE, META_TX_TYPED_DATA_TYPES_AS_SIGNED, SILENT_SIGNER_ACTIONS } from '@branch-zero/shared';
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
  let claims;
  try {
    claims = await privy.utils().auth().verifyAccessToken(accessToken);
  } catch (e) {
    // An expired or malformed token is the caller's problem, not ours: 401 `AUTH` gives the clerk her
    // "I'll need you signed in" line instead of a 500 `INTERNAL` (U4 — seen as "Failed to verify authentication token").
    throw Object.assign(new Error(`access token rejected: ${(e as Error).message}`), { statusCode: 401, code: 'AUTH' });
  }
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
const chainRuleName = (base: string, chainId: number) => (chainId === 1337 ? base : `${base} · ${chainId}`);

/**
 * U4+ — shape of the typed-data rule, recorded per player (`player.typedDataRule`) so an older rule is re-written.
 *   1  U1: `verifyingContract` + `chainId`
 *   2  U4+ (retired same day): `params.action` pin built from the bare SDK type list — Privy denied every request
 *   3  U4+: plus `params.action` ∈ SILENT_SIGNER_ACTIONS — the session signer may sign Lane A / config batches
 *      (`SIGN_META_REQUEST_AND_APPROVE`) and nothing else. A Priority payload is `SIGN_META_APPROVE` on the same
 *      domain; without this pin Privy could not tell it from a counter pay, and the hand scan would be theatre.
 *      Anything not matched falls through to Privy's default DENY (`policy_violation`).
 */
export const TYPED_DATA_RULE_VERSION = 3; // 2 = action pin with the bare SDK types (denied everything); 3 = as-signed types

/**
 * The message half of the typed-data rule. Privy decodes the EIP-712 message with the `types` / `primary_type` we give
 * it and compares the dotted field (`params.action` — nested paths work, the primary type is not a prefix). The types
 * are the SDK's `META_TX_TYPES`, transcribed into `packages/shared` because the SDK does not export them at runtime;
 * `lanes/priority.ts` cross-checks the transcription against what the SDK actually asks the wallet to sign.
 *
 * Two things Privy taught us on 2026-09-07 (`scripts/probe-typed-data-policy.ts`):
 *   - message fields take `eq | gt | gte | lt | lte` only — `in` is rejected (`invalid_policy_format`), so one silent
 *     action means one `eq`; a second action would need a second rule;
 *   - the condition's `typed_data.types` must equal the request's `types` **exactly**, and viem prepends
 *     `EIP712Domain` to the types before the account signer sees them — with the bare SDK list every request
 *     (action 3 and 4 alike) was denied, i.e. the silent lane went dark. Hence `META_TX_TYPED_DATA_TYPES_AS_SIGNED`.
 */
function silentActionCondition() {
  if (SILENT_SIGNER_ACTIONS.length !== 1) throw new Error('silentActionCondition: one action per rule (Privy message conditions have no `in`)');
  return {
    field_source: 'ethereum_typed_data_message' as const,
    typed_data: { primary_type: META_TX_PRIMARY_TYPE, types: META_TX_TYPED_DATA_TYPES_AS_SIGNED as never },
    field: 'params.action',
    operator: 'eq' as const,
    value: String(SILENT_SIGNER_ACTIONS[0]),
  };
}

export interface PlayerPolicy {
  policyId: string;
  ruleId: string;
}

function typedDataRuleSpec(chainId: number, name = chainRuleName(RULE_NAME, chainId)) {
  return {
    name,
    method: 'eth_signTypedData_v4' as const,
    action: 'ALLOW' as const,
    conditions: [{ field_source: 'ethereum_typed_data_domain' as const, field: 'chainId' as const, operator: 'eq' as const, value: String(chainId) }, silentActionCondition()],
  };
}

/** Created at sign-in, before the account exists: allow Bloxchain typed data on our chain only. */
export async function createPlayerPolicy(chainId: number, label: string): Promise<PlayerPolicy> {
  const policy = await privy.policies().create({
    version: '1.0',
    chain_type: 'ethereum',
    name: `bz-${label}`.slice(0, 48),
    rules: [
      {
        name: chainRuleName(RULE_NAME, chainId),
        method: 'eth_signTypedData_v4',
        action: 'ALLOW',
        conditions: [{ field_source: 'ethereum_typed_data_domain', field: 'chainId', operator: 'eq', value: String(chainId) }, silentActionCondition()],
      },
    ],
  });
  const ruleId = (policy as { rules?: Array<{ id: string }> }).rules?.[0]?.id;
  if (!ruleId) throw new Error('Privy returned a policy with no rule id');
  return { policyId: policy.id, ruleId };
}

/**
 * Narrow the player's policy to their account once it exists. Everything outside this account — another
 * player's AccountBlox, another chain, any non-typed-data method, any meta-tx action other than the silent
 * lane's (U4+) — now falls through to the default DENY.
 */
export async function pinPolicyToAccount(
  policy: PlayerPolicy,
  account: Address,
  chainId: number,
  /**
   * `pinAction: false` writes the pre-U4+ shape (no `params.action` pin). **Kill-test rig only**: it is how the
   * headless rig obtains the owner's Priority signature from the session signer, standing in for the Passkey a
   * human gives in the browser. The product never calls it this way; the rig restores the pin afterwards.
   */
  opts: { pinAction?: boolean } = {},
): Promise<void> {
  const pinAction = opts.pinAction ?? true;
  await privy.policies().updateRule(policy.ruleId, {
    policy_id: policy.policyId,
    authorization_context: authorizationContext,
    name: chainRuleName(RULE_NAME, chainId),
    method: 'eth_signTypedData_v4',
    action: 'ALLOW',
    conditions: [
      { field_source: 'ethereum_typed_data_domain', field: 'verifyingContract', operator: 'eq', value: account },
      { field_source: 'ethereum_typed_data_domain', field: 'chainId', operator: 'eq', value: String(chainId) },
      ...(pinAction ? [silentActionCondition()] : []),
    ],
  });
}

// ============ U2 — owner transactions (V6) ============

/**
 * V6 — may the session signer send the owner's *own* transactions, and can the policy scope them?
 *
 * Lane B option 1 has the player's embedded wallet call `executeWithTimeLock`, `approveTimeLockExecution`
 * and `cancelTimeLockExecution` directly, so the request and the approval genuinely come from OWNER and
 * the contract's `releaseTime` check applies (the meta-tx approve path deliberately skips it — see
 * `EngineBlox._txApprovalWithMetaTx`). Privy signs the transaction (`eth_signTransaction`); the Teller
 * Desk broadcasts it. Privy's policy engine sees the transaction object (`to`, `chain_id`) and, with an
 * ABI, the decoded calldata (`function.param`).
 *
 * Two scoping modes, tried in order and recorded on the player:
 *   - `calldata`: three rules, one per function, each pinned to `to` = the player's account, `chain_id`,
 *     and a decoded calldata field that only exists if the selector matches (`executeWithTimeLock.target`
 *     must be the demo token; `approve…/cancel….txId` must be a record id). Nothing else is signable.
 *   - `to-only`: one rule pinned to `to` + `chain_id`, if Privy rejects the calldata conditions. Still
 *     bounded to the player's own account contract, whose own RBAC decides what the owner may do.
 * Like the typed-data rule, `to` cannot be pinned until the account exists, so rules are created at
 * `/session` scoped to the chain (and calldata) and tightened at `/provision`.
 */
export type TxPolicyMode = 'calldata' | 'to-only';

/** The three owner-callable functions, transcribed from the SDK's GuardController ABI for Privy's decoder. */
const OWNER_TX_ABI = parseAbi([
  'function executeWithTimeLock(address target, uint256 value, bytes4 functionSelector, bytes params, uint256 gasLimit, bytes32 operationType) returns (uint256)',
  'function approveTimeLockExecution(uint256 txId) returns (uint256)',
  'function cancelTimeLockExecution(uint256 txId) returns (uint256)',
]);

const TX_RULE_TO_ONLY = 'Owner tx to own account';
const TX_RULES_CALLDATA = ['Owner: file a wire', 'Owner: release a wire', 'Owner: recall a wire'] as const;

function txRuleSpecs(mode: TxPolicyMode, chainId: number, token: Address, account?: Address) {
  const base = [
    { field_source: 'ethereum_transaction', field: 'chain_id', operator: 'eq', value: String(chainId) },
    ...(account ? [{ field_source: 'ethereum_transaction', field: 'to', operator: 'eq', value: account }] : []),
  ];
  if (mode === 'to-only') {
    return [{ name: chainRuleName(TX_RULE_TO_ONLY, chainId), method: 'eth_signTransaction', action: 'ALLOW', conditions: base }];
  }
  const calldata = (field: string, operator: string, value: string) => ({
    field_source: 'ethereum_calldata',
    abi: OWNER_TX_ABI,
    field,
    operator,
    value,
  });
  return [
    { name: chainRuleName(TX_RULES_CALLDATA[0], chainId), method: 'eth_signTransaction', action: 'ALLOW', conditions: [...base, calldata('executeWithTimeLock.target', 'eq', token)] },
    { name: chainRuleName(TX_RULES_CALLDATA[1], chainId), method: 'eth_signTransaction', action: 'ALLOW', conditions: [...base, calldata('approveTimeLockExecution.txId', 'gt', '0')] },
    { name: chainRuleName(TX_RULES_CALLDATA[2], chainId), method: 'eth_signTransaction', action: 'ALLOW', conditions: [...base, calldata('cancelTimeLockExecution.txId', 'gt', '0')] },
  ];
}

export interface TxRules {
  ruleIds: string[];
  mode: TxPolicyMode;
}

/**
 * Thrown when Privy hands back rule ids we cannot index by: missing, or the same id twice. This is exactly how the
 * player index came to hold `[file, recall, recall]` (Lane B #14) and the positional pin then destroyed the release
 * rule. It is **not** a reason to fall back to `to-only` rules: the policy is in an unknown state and the caller must
 * see that, not paper over it with a looser rule set.
 */
export class TxRuleIdError extends Error {
  constructor(policyId: string, ids: Array<string | undefined>) {
    super(`Privy returned unusable rule ids for policy ${policyId}: ${JSON.stringify(ids)} — ids must be non-empty and distinct`);
    this.name = 'TxRuleIdError';
  }
}

/**
 * Add the `eth_signTransaction` rules to a player's policy. Calldata-scoped if Privy accepts it. Used only **before**
 * the account exists (chain-scoped rules); once it does, `reconcileTxRules` is the single write path.
 *
 * The ids Privy returns are re-read from the policy and checked to be present and distinct before anything is stored:
 * a positional id list that lies is worse than none (see `TxRuleIdError`).
 */
export async function createTxRules(policyId: string, chainId: number, token: Address, account?: Address): Promise<TxRules & { fallbackReason?: string }> {
  const attempt = async (mode: TxPolicyMode) => {
    const specs = txRuleSpecs(mode, chainId, token, account);
    const ids: Array<string | undefined> = [];
    for (const rule of specs) {
      const res = (await privy.policies().createRule(policyId, { authorization_context: authorizationContext, ...rule } as never)) as { id?: string };
      ids.push(res.id);
    }
    // Trust the policy, not the create responses: the policy is what Privy will actually evaluate.
    const policy = (await privy.policies().get(policyId)) as unknown as { rules?: Array<{ id: string; name: string }> };
    const byName = specs.map((spec) => (policy.rules ?? []).filter((r) => r.name === spec.name).map((r) => r.id));
    const resolved = byName.map((matches, i) => (matches.length === 1 ? matches[0] : matches.find((id) => id === ids[i])));
    if (resolved.some((id) => !id) || new Set(resolved).size !== resolved.length) throw new TxRuleIdError(policyId, resolved);
    return resolved as string[];
  };
  try {
    return { ruleIds: await attempt('calldata'), mode: 'calldata' };
  } catch (e) {
    if (e instanceof TxRuleIdError) throw e;
    const reason = (e as Error).message.slice(0, 300);
    return { ruleIds: await attempt('to-only'), mode: 'to-only', fallbackReason: reason };
  }
}

/**
 * Reconcile the owner-transaction rules against what Privy actually holds (Lane B #14, 2026-09-09).
 *
 * The player index once stored **duplicate** rule ids (`[file, recall, recall]`), so the positional pin (the retired
 * `pinTxRulesToAccount`) wrote the release spec and then the recall spec onto the *same* rule: the policy ended up with two "recall" rules and no
 * "release" rule, and every `approveTimeLockExecution` was refused by Privy's default DENY (`policy_violation`) before
 * broadcast — surfaced by the SDK as a bogus `ReadableText`. Stored ids are therefore never trusted again: rules are
 * resolved **by name** from the policy, brought to spec in place, created when missing, and same-name duplicates
 * (which are over-broad allows when unpinned) are re-purposed for a missing spec or deleted. Idempotent; one GET when
 * everything is already right. Calldata-scoped first, `to-only` if Privy refuses the calldata conditions.
 */
export async function reconcileTxRules(policyId: string, chainId: number, token: Address, account: Address): Promise<TxRules & { actions: string[] }> {
  type Rule = { id: string; name: string; method?: string; conditions?: Array<Record<string, unknown>> };
  const policy = (await privy.policies().get(policyId)) as unknown as { rules?: Rule[] };
  const rules = policy.rules ?? [];
  const ours = new Set([...TX_RULES_CALLDATA, TX_RULE_TO_ONLY].map((n) => chainRuleName(n, chainId)));
  const pool = rules.filter((r) => r.method === 'eth_signTransaction' && ours.has(r.name));
  const shape = (conds: Array<Record<string, unknown>> | undefined) =>
    JSON.stringify((conds ?? []).map((c) => [c.field_source, c.field, c.operator, String(c.value).toLowerCase()]).sort());
  const actions: string[] = [];

  const attempt = async (mode: TxPolicyMode) => {
    const claimed = new Set<string>();
    const ids: string[] = [];
    for (const spec of txRuleSpecs(mode, chainId, token, account)) {
      const byName = pool.filter((r) => r.name === spec.name && !claimed.has(r.id));
      let rule = byName[0];
      if (!rule) {
        // Re-use an orphan (a same-name duplicate of a rule already claimed) rather than leaving it as a loose allow.
        rule = pool.find((r) => !claimed.has(r.id) && pool.some((o) => o !== r && o.name === r.name && claimed.has(o.id)))!;
      }
      if (rule) {
        claimed.add(rule.id);
        if (rule.name !== spec.name || shape(rule.conditions) !== shape(spec.conditions as never)) {
          await privy.policies().updateRule(rule.id, { policy_id: policyId, authorization_context: authorizationContext, ...spec } as never);
          actions.push(`${rule.name === spec.name ? 'repinned' : `re-purposed "${rule.name}" as`} "${spec.name}" (${rule.id})`);
        }
        ids.push(rule.id);
      } else {
        const created = (await privy.policies().createRule(policyId, { authorization_context: authorizationContext, ...spec } as never)) as { id: string };
        claimed.add(created.id);
        ids.push(created.id);
        actions.push(`created "${spec.name}" (${created.id})`);
      }
    }
    // Whatever is left of ours on this chain is a duplicate or a retired shape: a loose allow, so it goes.
    for (const r of pool) {
      if (claimed.has(r.id)) continue;
      await privy.policies().deleteRule(r.id, { policy_id: policyId, authorization_context: authorizationContext } as never);
      actions.push(`deleted duplicate "${r.name}" (${r.id})`);
    }
    return ids;
  };
  try {
    return { ruleIds: await attempt('calldata'), mode: 'calldata', actions };
  } catch (e) {
    actions.push(`calldata rules refused: ${(e as Error).message.slice(0, 200)}`);
    return { ruleIds: await attempt('to-only'), mode: 'to-only', actions };
  }
}

/** Add the active wing's typed-data rule to an already-consented policy; app-owned rules need no second modal. */
export async function ensureTypedDataRule(policyId: string, chainId: number): Promise<string> {
  const policy = (await privy.policies().get(policyId)) as { rules?: Array<{ id: string; name: string }> };
  const name = chainRuleName(RULE_NAME, chainId);
  const existing = policy.rules?.find((r) => r.name === name)?.id;
  if (existing) return existing;
  const created = await privy.policies().createRule(policyId, { authorization_context: authorizationContext, ...typedDataRuleSpec(chainId) } as never);
  const ruleId = (created as { id?: string }).id;
  if (!ruleId) throw new Error(`Privy returned no typed-data rule id for chain ${chainId}`);
  return ruleId;
}

/**
 * Recover a player's policy handles from Privy after a Teller Desk restart or a code upgrade: the wallet
 * record names the policy the player consented to, and the policy lists its rules by name.
 */
export async function recoverPolicy(walletId: string, chainId = config.chainId): Promise<{ policyId?: string; ruleId?: string; txRules?: TxRules } | undefined> {
  const wallet = (await privy.wallets().get(walletId)) as {
    policy_ids?: string[];
    additional_signers?: Array<{ signer_id?: string; override_policy_ids?: string[] }>;
  };
  const policyId =
    wallet.additional_signers?.find((s) => s.signer_id === config.privy.signerId)?.override_policy_ids?.[0] ?? wallet.policy_ids?.[0];
  if (!policyId) return undefined;
  const policy = (await privy.policies().get(policyId)) as { rules?: Array<{ id: string; name: string }> };
  const rules = policy.rules ?? [];
  const ruleId = rules.find((r) => r.name === chainRuleName(RULE_NAME, chainId))?.id;
  const calldata = TX_RULES_CALLDATA.map((n) => rules.find((r) => r.name === chainRuleName(n, chainId))?.id);
  const toOnly = rules.find((r) => r.name === chainRuleName(TX_RULE_TO_ONLY, chainId))?.id;
  const txRules: TxRules | undefined = calldata.every(Boolean)
    ? { ruleIds: calldata as string[], mode: 'calldata' }
    : toOnly
      ? { ruleIds: [toOnly], mode: 'to-only' }
      : undefined;
  return { policyId, ruleId, txRules };
}
