/**
 * U1 kill tests — K2 and K5, plus a Lane A smoke, run end to end against Remote EVM 1337 and the live
 * Privy application.
 *
 *   npm run killtests            # reuse the rig player if it exists
 *   npm run killtests -- --fresh # mint a new Privy user + wallet + account
 *
 * Why a server-created player: the DoD's *product* path is "log in through the overlay, delegate once",
 * which needs a human to read an email OTP. What that human step produces is a Privy user with an
 * embedded EVM wallet and our key quorum attached as an additional signer — exactly what
 * `users().create({ wallets: [{ additional_signers }] })` produces here. From the moment the wallet
 * exists, the code under test is identical: the same `privy.wallets().ethereum().signTypedData` call,
 * the same policy, the same broadcaster. So these runs prove the signing lane; the overlay proves the
 * consent UI. Both are needed and neither substitutes for the other.
 */
import { encodeAbiParameters, getAddress, keccak256, parseAbiParameters, recoverAddress, toBytes, type Address, type Hex } from 'viem';
import {
  EngineBlox,
  GuardController,
  GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL,
  TxAction,
} from '@bloxchain/sdk';
import { erc20Abi } from '@branch-zero/shared';
import { broadcaster, broadcasterAddress, chain, publicClient } from '../src/chain.ts';
import { config, deployments } from '../src/config.ts';
import { authorizationContext, createPlayerPolicy, embeddedWalletOf, ensureTypedDataRule, pinPolicyToAccount, recoverPolicy, privy } from '../src/privy.ts';
import { signMetaTx } from '../src/signing/privySigner.ts';
import { META_TX_TTL_SEC, pay } from '../src/lanes/laneA.ts';
import { provision } from '../src/lanes/provision.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const FRESH = process.argv.includes('--fresh');

const results: Array<{ id: string; verdict: 'PASS' | 'FAIL' | 'PARTIAL'; note: string }> = [];
function record(id: string, verdict: 'PASS' | 'FAIL' | 'PARTIAL', note: string) {
  results.push({ id, verdict, note });
  console.log(`\n${verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : '✗'} ${id} ${verdict} — ${note}\n`);
}

/**
 * Create (or reuse) a Privy user whose embedded wallet carries our key quorum as an additional signer,
 * scoped by a per-player policy.
 *
 * The policy is created *first* and passed at wallet-creation time, because a user-controlled wallet is
 * owned by the user's own key quorum: afterwards only the user can change its signers or policies (a
 * server-side `wallets().update` gets 401). That constraint is what makes the browser consent real, and
 * it is why the overlay — not this script — is the product path.
 */
async function rigPlayer(): Promise<Player> {
  const email = FRESH ? RIG_EMAIL.replace('@', `+${Date.now().toString(36)}@`) : RIG_EMAIL;

  const existing = await privy.users().getByEmailAddress({ address: email }).catch(() => undefined);
  if (existing) {
    const w = embeddedWalletOf(existing);
    console.log(`reusing Privy user ${existing.id}
  wallet ${w.walletId} → ${w.ownerAddress} (delegated: ${w.delegated})`);
    const stored = getPlayer(existing.id);
    /**
     * The player index is per chain (`store.ts` suffixes the file with the chain id), so a rig that was first
     * used on another wing arrives here with no policy id — and without one, K5 would be asking an unpoliced
     * signer to refuse something, which it never will. `/session` solves this by *recovering* the policy that
     * is already attached to the wallet (only the browser consent can attach one), so the rig does the same.
     */
    let policyId = stored?.policyId ?? process.env.KILLTEST_POLICY_ID;
    let policyRuleId = stored?.policyRuleId ?? process.env.KILLTEST_POLICY_RULE_ID;
    if (!policyId) {
      const recovered = await recoverPolicy(w.walletId, chain.id).catch(() => undefined);
      if (recovered?.policyId) {
        policyId = recovered.policyId;
        policyRuleId = recovered.ruleId ?? (await ensureTypedDataRule(recovered.policyId, chain.id));
        console.log(`recovered policy ${policyId} from the wallet (rule ${policyRuleId}) for chain ${chain.id}`);
      }
    }
    return upsertPlayer({
      privyUserId: existing.id,
      ownerAddress: w.ownerAddress,
      walletId: w.walletId,
      signingMode: w.delegated ? 'session' : 'client',
      policyId,
      policyRuleId,
    });
  }

  const policy = await createPlayerPolicy(chain.id, `rig-${Date.now().toString(36)}`);
  console.log(`policy ${policy.policyId} (rule ${policy.ruleId}) — chain-scoped until an account exists`);

  console.log(`creating Privy user ${email} with an embedded EVM wallet + session signer…`);
  const user = await privy.users().create({
    linked_accounts: [{ type: 'email', address: email }],
    wallets: [{ chain_type: 'ethereum', additional_signers: [{ signer_id: config.privy.signerId, override_policy_ids: [policy.policyId] }] }],
  });
  const wallet = embeddedWalletOf(user);
  console.log(`privy user ${user.id}
  wallet ${wallet.walletId} → ${wallet.ownerAddress} (delegated: ${wallet.delegated})`);
  console.log(`  re-run without --fresh using: KILLTEST_EMAIL=${email} KILLTEST_POLICY_ID=${policy.policyId} KILLTEST_POLICY_RULE_ID=${policy.ruleId}`);

  return upsertPlayer({
    privyUserId: user.id,
    ownerAddress: wallet.ownerAddress,
    walletId: wallet.walletId,
    signingMode: 'session',
    policyId: policy.policyId,
    policyRuleId: policy.ruleId,
  });
}

/** K2 — does the session signer's signature recover to the account's on-chain owner? */
async function k2(player: Player, account: Address) {
  const { token } = deployments();
  const gc = new GuardController(publicClient, broadcaster, account, chain);

  const onChainOwner = await gc.owner();
  if (getAddress(onChainOwner) !== getAddress(player.ownerAddress)) {
    return record('K2', 'FAIL', `account owner ${onChainOwner} is not the Privy wallet ${player.ownerAddress}`);
  }

  const metaTxParams = await gc.createMetaTxParams(
    account,
    GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR,
    TxAction.SIGN_META_REQUEST_AND_APPROVE,
    META_TX_TTL_SEC,
    0n,
    player.ownerAddress,
  );
  const unsigned = await gc.generateUnsignedMetaTransactionForNew(
    player.ownerAddress,
    token.address,
    0n,
    200_000n,
    keccak256(toBytes('ERC20_TRANSFER')),
    EngineBlox.ERC20_TRANSFER_SELECTOR,
    encodeAbiParameters(parseAbiParameters('address, uint256'), [broadcasterAddress, 1n]),
    metaTxParams,
  );

  // The SDK verifies recover == params.signer itself and throws otherwise; we recover again here so the
  // kill test does not depend on the SDK's own assertion for its verdict.
  const signed = await signMetaTx(publicClient, chain, unsigned, {
    owner: player.ownerAddress,
    walletId: player.walletId,
    account,
  });
  const recovered = await recoverAddress({ hash: unsigned.message as Hex, signature: signed.signature as Hex });

  const match = getAddress(recovered) === getAddress(onChainOwner);
  record(
    'K2',
    match ? 'PASS' : 'FAIL',
    match
      ? `recover(digest) = ${recovered} = owner() on ${account}; chainId ${unsigned.params.chainId}, nonce ${unsigned.params.nonce}, domain "Bloxchain"`
      : `recovered ${recovered} but owner() is ${onChainOwner}`,
  );
}

/** K5 — with the per-player policy attached, does Privy refuse typed data for someone else's account? */
async function k5(player: Player, account: Address) {
  const gc = new GuardController(publicClient, broadcaster, account, chain);

  /**
   * An account this wallet does **not** own. The deployment fixture is the natural choice and is what this test
   * used on 1337 — but on Sepolia the fixture *is* this player's account (the S1 FX till, which provisioning
   * now adopts rather than duplicating), and asking Privy to sign for your own account proves nothing. So pick
   * the first fixture that is not this player's, and fall back to CopyBlox: any address other than the player's
   * account is out of policy scope, which is precisely the claim under test.
   */
  const { fixtures, copyBlox } = deployments();
  const stranger = fixtures.find((f) => f.address.toLowerCase() !== account.toLowerCase())?.address ?? copyBlox;
  const fixtureAccount = stranger;

  // Build a genuine Bloxchain payload, then swap the verifyingContract for the U0 fixture — the account
  // this player does *not* own. Everything else about the request is legitimate.
  const metaTxParams = await gc.createMetaTxParams(
    account,
    GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR,
    TxAction.SIGN_META_REQUEST_AND_APPROVE,
    META_TX_TTL_SEC,
    0n,
    player.ownerAddress,
  );

  const outOfScope = {
    domain: { name: 'Bloxchain', version: '1', chainId: chain.id, verifyingContract: fixtureAccount },
    primary_type: 'MetaTxParams',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
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
    },
    message: {
      chainId: String(metaTxParams.chainId),
      nonce: String(metaTxParams.nonce),
      handlerContract: fixtureAccount,
      handlerSelector: metaTxParams.handlerSelector,
      action: Number(metaTxParams.action),
      deadline: String(metaTxParams.deadline),
      maxGasPrice: '0',
      signer: player.ownerAddress,
    },
  };

  try {
    const res = await privy.wallets().ethereum().signTypedData(player.walletId, {
      authorization_context: authorizationContext,
      params: { typed_data: outOfScope },
    } as never);
    record(
      'K5',
      'FAIL',
      `Privy signed typed data for ${fixtureAccount}, an account this wallet does not own (signature ${(res as { signature: string }).signature.slice(0, 20)}…)`,
    );
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const denied = err.status === 403 || /polic/i.test(err.message ?? '');
    record(
      'K5',
      denied ? 'PASS' : 'PARTIAL',
      denied
        ? `policy denied verifyingContract ${fixtureAccount} (HTTP ${err.status}): ${err.message?.slice(0, 160)}`
        : `request failed but not visibly on policy: ${err.message?.slice(0, 200)}`,
    );
  }
}

/** Lane A — one payment, zero browser interaction. */
async function laneA(player: Player, account: Address) {
  const { token } = deployments();
  const payee = getAddress('0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC') as Address; // Ganache acct5 — a payee, no role
  const before = (await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [payee] })) as bigint;

  const res = await pay({ ...player, account }, payee, '12.5', 'killtest');
  const after = (await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [payee] })) as bigint;

  const moved = after - before;
  record(
    'LaneA',
    moved > 0n ? 'PASS' : 'FAIL',
    moved > 0n
      ? `requestAndApproveExecution ${res.hash} moved ${moved} base units to ${payee}; account balance now ${res.balanceAfter} ${token.symbol}; txId ${res.txId ?? 'n/a'}`
      : `payment mined but payee balance did not move`,
  );
}

async function main() {
  console.log(`chain ${chain.id} · Privy app ${config.privy.appId} · signer ${config.privy.signerId}\n`);
  const player = await rigPlayer();

  console.log('opening an account (CopyBlox clone + guard batch + opening balance)…');
  const { account } = await provision(player, 'killtest-provision');
  const current = { ...player, account };
  console.log(`account ${account}`);

  await k2(current, account);

  // The policy was chain-scoped at creation; provisioning should have pinned it to this account.
  const stored = getPlayer(player.privyUserId)!;
  if (stored.policyId && stored.policyRuleId && !stored.policyPinned) {
    await pinPolicyToAccount({ policyId: stored.policyId, ruleId: stored.policyRuleId }, account, chain.id);
    console.log(`policy ${stored.policyId} pinned to ${account}`);
  }
  console.log(`policy ${stored.policyId ?? 'none'} · pinned to account: ${stored.policyPinned || Boolean(stored.policyRuleId)}`);

  await k5(current, account);
  await laneA(current, account);

  console.log('\n─── U1 kill tests ───');
  for (const r of results) console.log(`${r.id.padEnd(6)} ${r.verdict.padEnd(7)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
