/**
 * Probe — how does Privy address a nested EIP-712 message field in an `ethereum_typed_data_message` condition?
 *
 *   npm -w apps/teller-desk run probe:policy -- <privyUserId-or-email>
 *
 * Re-writes the rig player's typed-data rule through several shapes and asks the session signer to sign a synthetic
 * Bloxchain `MetaTransaction` with `params.action = 3` and `= 4`. Prints allow/deny per shape. Restores the product
 * shape at the end. Rig wallets only (never a human's).
 */
import { META_TX_PRIMARY_TYPE, META_TX_TYPED_DATA_TYPES, EIP712_DOMAIN_TYPE } from '@branch-zero/shared';
import { chain } from '../src/chain.ts';
import { authorizationContext, embeddedWalletOf, privy, recoverPolicy } from '../src/privy.ts';

const who = process.argv[2];
if (!who) throw new Error('usage: probe:policy <privyUserId|email>');

const RULE_NAME = 'Bloxchain meta-tx for this account';
const ACCOUNT = '0x000000000000000000000000000000000000e011';

function message(action: number) {
  return {
    txRecord: {
      txId: '0',
      params: { requester: ACCOUNT, target: ACCOUNT, value: '0', gasLimit: '200000', operationType: `0x${'11'.repeat(32)}`, executionSelector: '0xa9059cbb', executionParams: '0x' },
      payment: { recipient: ACCOUNT, nativeTokenAmount: '0', erc20TokenAddress: ACCOUNT, erc20TokenAmount: '0' },
    },
    params: { chainId: String(chain.id), nonce: '0', handlerContract: ACCOUNT, handlerSelector: '0xa9059cbb', action, deadline: '9999999999', maxGasPrice: '0', signer: ACCOUNT },
    data: '0x',
  };
}

async function trySign(walletId: string, action: number, withDomainType = false): Promise<string> {
  try {
    await privy.wallets().ethereum().signTypedData(walletId, {
      authorization_context: authorizationContext,
      params: {
        typed_data: {
          domain: { name: 'Bloxchain', version: '1.0.0', chainId: chain.id, verifyingContract: ACCOUNT },
          // viem's signTypedData adds EIP712Domain to `types` before it reaches the account signer — the product path
          types: withDomainType ? { EIP712Domain: [...EIP712_DOMAIN_TYPE], ...META_TX_TYPED_DATA_TYPES } : META_TX_TYPED_DATA_TYPES,
          primary_type: META_TX_PRIMARY_TYPE,
          message: message(action),
        },
      },
    } as never);
    return 'ALLOW';
  } catch (e) {
    const err = e as { status?: number; error?: { code?: string; error?: string }; message?: string };
    return `DENY (${err.status} ${err.error?.code ?? ''} ${(err.error?.error ?? err.message ?? '').slice(0, 80)})`;
  }
}

async function main() {
  const user = who.includes('@') ? await privy.users().getByEmailAddress({ address: who }) : await privy.users().get({ id_token: who } as never).catch(() => undefined);
  if (!user) throw new Error('user not found (pass the rig email)');
  const w = embeddedWalletOf(user);
  const pol = await recoverPolicy(w.walletId);
  if (!pol?.policyId || !pol.ruleId) throw new Error('no policy/rule on this wallet');
  console.log(`user ${user.id} wallet ${w.walletId} policy ${pol.policyId} rule ${pol.ruleId}\n`);

  const base = [{ field_source: 'ethereum_typed_data_domain', field: 'chainId', operator: 'eq', value: String(chain.id) }];
  const typesWithDomain = { EIP712Domain: [...EIP712_DOMAIN_TYPE], ...META_TX_TYPED_DATA_TYPES };
  const shapes: Array<{ label: string; conditions: unknown[]; requestWithDomainType?: boolean }> = [
    { label: 'I  rule types incl. EIP712Domain, request too (product)', requestWithDomainType: true, conditions: [...base, { field_source: 'ethereum_typed_data_message', typed_data: { primary_type: META_TX_PRIMARY_TYPE, types: typesWithDomain }, field: 'params.action', operator: 'eq', value: '3' }] },
    { label: 'J  rule types w/o EIP712Domain, request with it', requestWithDomainType: true, conditions: [...base, { field_source: 'ethereum_typed_data_message', typed_data: { primary_type: META_TX_PRIMARY_TYPE, types: META_TX_TYPED_DATA_TYPES }, field: 'params.action', operator: 'eq', value: '3' }] },
    { label: 'A  no action pin (baseline)', conditions: base },
    { label: 'B  params.action eq "3"', conditions: [...base, { field_source: 'ethereum_typed_data_message', typed_data: { primary_type: META_TX_PRIMARY_TYPE, types: META_TX_TYPED_DATA_TYPES }, field: 'params.action', operator: 'eq', value: '3' }] },
    { label: 'E  params.action eq "3", types incl. EIP712Domain', conditions: [...base, { field_source: 'ethereum_typed_data_message', typed_data: { primary_type: META_TX_PRIMARY_TYPE, types: typesWithDomain }, field: 'params.action', operator: 'eq', value: '3' }] },
  ];
  for (const s of shapes) {
    try {
      await privy.policies().updateRule(pol.ruleId, { policy_id: pol.policyId, authorization_context: authorizationContext, name: RULE_NAME, method: 'eth_signTypedData_v4', action: 'ALLOW', conditions: s.conditions } as never);
    } catch (e) {
      console.log(`${s.label.padEnd(52)} rule rejected: ${((e as { error?: { error?: string } }).error?.error ?? (e as Error).message).slice(0, 120)}`);
      continue;
    }
    const a3 = await trySign(w.walletId, 3, s.requestWithDomainType);
    const a4 = await trySign(w.walletId, 4, s.requestWithDomainType);
    console.log(`${s.label.padEnd(52)} action=3 → ${a3.padEnd(40)} action=4 → ${a4}`);
  }
  // leave the wallet chain-scoped without a pin; the kill test re-pins through the product path
  await privy.policies().updateRule(pol.ruleId, { policy_id: pol.policyId, authorization_context: authorizationContext, name: RULE_NAME, method: 'eth_signTypedData_v4', action: 'ALLOW', conditions: base } as never);
  console.log('\nrule left at baseline (chain-scoped, no pin)');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
