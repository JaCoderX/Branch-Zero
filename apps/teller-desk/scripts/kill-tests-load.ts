/**
 * Load Account kill tests — Iris adopting a player-owned AccountBlox by number (docs/LOAD-ACCOUNT.md).
 *
 *   npm -w apps/teller-desk run killtests:load             # Developer Mode (Remote EVM 1337), reuse the rig player
 *   npm -w apps/teller-desk run killtests:load -- --fresh  # mint a new Privy user + wallet
 *
 * The claim under test: **the desk will file any account the chain says you own on this wing, and nothing else.**
 * The interesting half is the "nothing else" — an account number is public, so knowing one must never be enough.
 *
 *   L0  the reason this lane exists, reproduced: with two clones for one owner, `recoverAccount` returns the
 *       **last** `BloxCloned` only, and a player whose index was cleared ("Open my account" after a restart) is
 *       given the newest — stranding the older vault. No Solidity change can be assumed to fix this: CopyBlox
 *       has a flat `_clones` set and no owner→clones map.
 *   L1  load the stranded older clone → the index, the session view and the chain all agree; `owner()` on it is
 *       the player's Privy wallet; ROLE_SET is back to current and the guard/role sync ran without a clone.
 *   L2  the load is real money, not bookkeeping: a Lane A payment executes **from the loaded account**. This is
 *       the one test that cannot pass unless the Privy typed-data rule was re-pinned *and* the role grants
 *       landed on the newly-loaded contract.
 *   L2b the pin moved rather than widened: the same session signer, asked for a slip on the account that was
 *       loaded a moment ago and is no longer current, is refused by Privy's policy. Without this, L2 would also
 *       pass for a policy that had been loosened to "any contract". **Needs a policy-bound rig wallet** — the
 *       desk cannot attach a policy to a wallet (only the player's consent can), so a reused rig wallet whose
 *       Privy `override_policy_ids` is empty has an unbounded signer and this leg SKIPs with that reason. Use
 *       `--fresh`, which creates the wallet with the policy already attached.
 *   L3  somebody else's real AccountBlox (the deployment fixture, owner = Ganache acct 5) → `ACCOUNT_NOT_OWNED`,
 *       and the player's file is untouched.
 *   L4  a plain wallet address (no code) → `ACCOUNT_NOT_A_VAULT`.
 *   L5  contracts that are not accounts: the demo ERC-20 (code, but `owner()` reverts) and **CopyBlox itself**
 *       (code, `IBaseStateMachine` true, but `initialized()` false and `ISecureOwnable` false) → both
 *       `ACCOUNT_NOT_A_VAULT`. CopyBlox is the case a lazier check would have adopted.
 *   L6  the Live wing's own AccountBlox address, pasted into the Dev desk → `ACCOUNT_NOT_A_VAULT`. Live and Eve
 *       are different chains; an address does not travel between them.
 *   L7  malformed input (empty, not hex, the zero address) → `BAD_ARGS`, no reads spent on it.
 *   L8  re-loading the account already on file is a Re-check, not a switch: `changed:false`, and because the
 *       chain is read first, no role batch is sent.
 *   L9  restore: load the newest clone back, so the rig is left where "Open my account" would put it.
 *
 * Runs on Developer Mode by default because it clones a real second account (~16.65 M gas) and refuses a real
 * foreign one; both are free on the lab chain. It never touches Live keys.
 */
import { encodeAbiParameters, formatUnits, getAddress, keccak256, parseAbiParameters, parseUnits, toBytes, zeroAddress, type Address, type Hex } from 'viem';
import { EngineBlox, GuardController, GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL, RuntimeRBAC, SecureOwnable, TxAction } from '@bloxchain/sdk';
import { copyBloxAbi, erc20Abi } from '@branch-zero/shared';
import { broadcaster, chain, deployer, metaTxDuration, publicClient } from '../src/chain.ts';
import { config, deployments } from '../src/config.ts';
import { embeddedWalletOf, createPlayerPolicy, privy, recoverPolicy } from '../src/privy.ts';
import { signMetaTx } from '../src/signing/privySigner.ts';
import { pay } from '../src/lanes/laneA.ts';
import { OWNER_ROLE, ROLE_SET_VERSION, cloneAccount, ensureTxPolicy, ensureTypedDataPolicy, provision, recoverAccount } from '../src/lanes/provision.ts';
import { loadAccount } from '../src/lanes/loadAccount.ts';
import { getPlayer, patchPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const FRESH = process.argv.includes('--fresh');
/** Ganache acct 6 — a wallet, never an account contract. */
const EOA = getAddress('0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC') as Address;
/** The Live wing's Main AccountBlox (docs/SEPOLIA-LIVE.md). Real on 11155111, nothing at all on 1337. */
const LIVE_ACCOUNT = getAddress('0xf8EECc6B3e612811C697B5F006a89C975D5eA984') as Address;
const ERC20_TRANSFER_OPERATION = keccak256(toBytes('ERC20_TRANSFER'));

type Verdict = 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP';
const results: Array<{ id: string; verdict: Verdict; note: string }> = [];
function record(id: string, verdict: Verdict, note: string) {
  results.push({ id, verdict, note });
  console.log(`\n${verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : verdict === 'SKIP' ? '-' : '✗'} ${id} ${verdict} — ${note}\n`);
}
/**
 * Our own errors carry `code`; a Privy refusal carries it one level down (`error.code`, e.g. `policy_violation`),
 * which is the code the game has a bank line for — so read both rather than printing `NONE` for the refusal this
 * suite most wants to name.
 */
const codeOf = (e: unknown) => {
  const err = e as { code?: string; error?: { code?: string }; body?: { error?: { code?: string } } };
  return String(err.code ?? err.error?.code ?? err.body?.error?.code ?? 'NONE');
};
const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'none');

async function rigPlayer(): Promise<Player> {
  const email = FRESH ? RIG_EMAIL.replace('@', `+${Date.now().toString(36)}@`) : RIG_EMAIL;
  const existing = await privy.users().getByEmailAddress({ address: email }).catch(() => undefined);
  if (existing) {
    const w = embeddedWalletOf(existing);
    const stored = getPlayer(existing.id);
    const recovered = stored?.policyId ? undefined : await recoverPolicy(w.walletId).catch(() => undefined);
    console.log(`reusing Privy user ${existing.id}\n  wallet ${w.walletId} → ${w.ownerAddress} (delegated: ${w.delegated})`);
    return upsertPlayer({
      privyUserId: existing.id,
      ownerAddress: w.ownerAddress,
      walletId: w.walletId,
      signingMode: w.delegated ? 'session' : 'client',
      policyId: stored?.policyId ?? recovered?.policyId,
      policyRuleId: stored?.policyRuleId ?? recovered?.ruleId,
      txRuleIds: stored?.txRuleIds ?? recovered?.txRules?.ruleIds,
      txPolicyMode: stored?.txPolicyMode ?? recovered?.txRules?.mode,
      account: stored?.account ?? (await recoverAccount(w.ownerAddress)),
      /**
       * The rig re-establishes its own pin every run, because this suite moves the rig's account around and
       * `provision`'s pin is deliberately **one-shot** (`if (policy && !player.policyPinned)`) — Account Opening
       * pins once, when the account first exists, and has no reason to move a pin afterwards. A rig that kept a
       * stale `policyPinned:true` while pointing at a different clone would ask the enclave for a slip on an
       * account its policy does not name and be refused `policy_violation` before the first assertion. Moving a
       * pin is the load lane's job, and it does it explicitly (`repinPolicies`) rather than through this flag.
       */
      policyPinned: false,
      txPolicyPinned: false,
    });
  }
  const policy = await createPlayerPolicy(chain.id, `load-${Date.now().toString(36)}`);
  const user = await privy.users().create({
    linked_accounts: [{ type: 'email', address: email }],
    wallets: [{ chain_type: 'ethereum', additional_signers: [{ signer_id: config.privy.signerId, override_policy_ids: [policy.policyId] }] }],
  });
  const wallet = embeddedWalletOf(user);
  console.log(`privy user ${user.id}\n  wallet ${wallet.walletId} → ${wallet.ownerAddress}\n  re-run without --fresh using: KILLTEST_EMAIL=${email}`);
  return upsertPlayer({ privyUserId: user.id, ownerAddress: wallet.ownerAddress, walletId: wallet.walletId, signingMode: 'session', policyId: policy.policyId, policyRuleId: policy.ruleId });
}

/** Every `BloxCloned` clone this owner has, oldest first — the enumeration CopyBlox does not offer. */
async function clonesOf(owner: Address): Promise<Address[]> {
  const { copyBlox, copyBloxDeployedAtBlock } = deployments();
  const logs = await publicClient.getLogs({
    address: copyBlox,
    event: copyBloxAbi.find((x) => x.type === 'event' && x.name === 'BloxCloned')!,
    args: { initialOwner: owner },
    fromBlock: copyBloxDeployedAtBlock,
    toBlock: 'latest',
  });
  return logs.map((l) => getAddress((l.args as { clone: string }).clone) as Address);
}

const balanceOf = async (who: Address) => (await publicClient.readContract({ address: deployments().token.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] })) as bigint;

/** Ask the session signer for a Lane A slip on `account`. Used to prove the policy pin follows the load. */
async function trySignSlipFor(player: Player, account: Address): Promise<{ signed: boolean; code: string; message: string }> {
  try {
    const gc = new GuardController(publicClient, broadcaster, account, chain);
    const params = encodeAbiParameters(parseAbiParameters('address, uint256'), [EOA, parseUnits('1', deployments().token.decimals)]);
    const metaTxParams = await gc.createMetaTxParams(account, GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR, TxAction.SIGN_META_REQUEST_AND_APPROVE, await metaTxDuration(), 0n, player.ownerAddress);
    const unsigned = await gc.generateUnsignedMetaTransactionForNew(player.ownerAddress, deployments().token.address, 0n, 200_000n, ERC20_TRANSFER_OPERATION, EngineBlox.ERC20_TRANSFER_SELECTOR, params, metaTxParams);
    await signMetaTx(publicClient, chain, unsigned, { owner: player.ownerAddress, walletId: player.walletId, account });
    return { signed: true, code: 'NONE', message: '' };
  } catch (e) {
    return { signed: false, code: codeOf(e), message: (e as Error).message.split('\n')[0].slice(0, 160) };
  }
}

async function refusal(player: Player, input: unknown, label: string): Promise<{ code: string; message: string; accountAfter?: Address }> {
  try {
    const r = await loadAccount(getPlayer(player.privyUserId)!, input);
    return { code: `LOADED ${r.account}`, message: `${label} was accepted`, accountAfter: r.account };
  } catch (e) {
    return { code: codeOf(e), message: (e as Error).message.split('\n')[0].slice(0, 180), accountAfter: getPlayer(player.privyUserId)!.account };
  }
}

async function main() {
  if (config.target !== 'remote') {
    console.error(`refusing to run on the ${config.target} wing: this suite clones a second account and is meant for Developer Mode (pass --dev / CHAIN_ID=1337)`);
    process.exitCode = 1;
    return;
  }
  const { token, fixtureAccount, fixtureOwner, copyBlox } = deployments();
  console.log(`chain ${chain.id} (${config.mode}) · Privy app ${config.privy.appId} · ROLE_SET ${ROLE_SET_VERSION}\n`);

  let player = await rigPlayer();
  console.log('provisioning (Re-check)…');
  const prov = await provision(player, 'kt-load-provision');
  player = getPlayer(player.privyUserId)!;
  player = await ensureTxPolicy(player, prov.account);
  player = await ensureTypedDataPolicy(player);
  const first = prov.account;
  console.log(`account ${first} · roleSet ${prov.roleSet} · changes: ${prov.roleChanges.join(' | ') || 'none'}\n`);

  /**
   * Whether this rig wallet is policy-bound at all decides whether the pinning half of the suite can mean
   * anything. The Teller Desk **cannot** attach a policy to a wallet: the wallet belongs to the player's own
   * key quorum, and the policy travels with the consent the overlay collects (`addSessionSigners`) — which is
   * exactly the property that makes the session signer safe. So a rig wallet whose `override_policy_ids` is
   * empty has an *unbounded* session signer, and L1's pin flags and L2b would be measuring the rig, not the
   * product. `--fresh` mints a wallet created **with** the policy attached, which is the bound case.
   */
  const policyBound = Boolean(player.policyId && player.policyRuleId);
  if (!policyBound) {
    console.log(
      `\n! this rig wallet carries no session-signer policy (Privy \`override_policy_ids\` is empty), so its signer is unbounded.\n` +
        `  The desk cannot attach one — only the player's consent can — so the pin assertions below are SKIPPED.\n` +
        `  Re-run with --fresh for a policy-bound wallet.\n`,
    );
  }

  // ---- L0: recovery keeps the last clone only, so an older vault is unreachable through "Open my account"
  let second: Address;
  {
    const before = await clonesOf(player.ownerAddress);
    console.log(`cloning a second account for this owner (~16.65 M gas on the lab chain)…`);
    const cloned = await cloneAccount(player.ownerAddress);
    second = cloned.account;
    const after = await clonesOf(player.ownerAddress);
    const recovered = await recoverAccount(player.ownerAddress);

    /**
     * The honest reproduction of the stranding: forget the index (a lost `players.json`) and let the player
     * press "Open my account". Provisioning recovers — and gets the newest clone, not the one they were using.
     * `policyPinned` is cleared with it because a forgotten index forgets that too, and provision only pins
     * when the flag is unset.
     */
    patchPlayer(player.privyUserId, { account: undefined, configured: false, roleSet: 0, policyPinned: false, txPolicyPinned: false });
    const reopened = await provision(getPlayer(player.privyUserId)!, 'kt-load-reopen');
    player = getPlayer(player.privyUserId)!;

    const stranded = after.filter((a) => a.toLowerCase() !== reopened.account.toLowerCase());
    record(
      'L0',
      recovered?.toLowerCase() === second.toLowerCase() && reopened.account.toLowerCase() === second.toLowerCase() && stranded.some((a) => a.toLowerCase() === first.toLowerCase())
        ? 'PASS'
        : 'FAIL',
      `owner has ${after.length} clone(s) [${after.map(short).join(', ')}] (was ${before.length}); recoverAccount → ${short(recovered)}; "Open my account" after a forgotten index adopted ${short(reopened.account)} — ${stranded.length} owned account(s) [${stranded.map(short).join(', ')}] are unreachable that way, ${short(first)} among them`,
    );
  }

  // ---- L1: load the stranded older clone
  {
    const loaded = await loadAccount(getPlayer(player.privyUserId)!, first, 'kt-load-adopt');
    player = getPlayer(player.privyUserId)!;
    const onChainOwner = await new SecureOwnable(publicClient as never, undefined, loaded.account, chain).owner();
    const rb = new RuntimeRBAC(publicClient, broadcaster, loaded.account, chain);
    const ownerGrants = (await rb.getActiveRolePermissions(OWNER_ROLE)) as Array<{ functionSelector: Hex }>;
    const ok =
      loaded.account.toLowerCase() === first.toLowerCase() &&
      loaded.changed &&
      loaded.previous?.toLowerCase() === second.toLowerCase() &&
      player.account?.toLowerCase() === first.toLowerCase() &&
      player.roleSet === ROLE_SET_VERSION &&
      Boolean(player.configured) &&
      (policyBound ? Boolean(player.policyPinned) : true) &&
      onChainOwner.toLowerCase() === player.ownerAddress.toLowerCase();
    record(
      'L1',
      ok ? 'PASS' : 'FAIL',
      `load ${short(first)} → previous ${short(loaded.previous)}, changed ${loaded.changed}; index account ${short(player.account)} configured ${player.configured} roleSet ${player.roleSet}; policy pinned ${policyBound ? `${player.policyPinned} / tx pinned ${player.txPolicyPinned}` : 'n/a (unbound rig wallet)'}; chain owner() ${short(onChainOwner)} == session owner ${short(player.ownerAddress)}; sync changes [${loaded.roleChanges.join(' | ') || 'none — the chain already had them'}]; OWNER holds ${ownerGrants.length} selector grant(s); balance ${loaded.balance} ${loaded.symbol}`,
    );
  }

  // ---- L2: a real payment out of the loaded account
  {
    const want = parseUnits('5', token.decimals);
    if ((await balanceOf(first)) < want) {
      const hash = await deployer.writeContract({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [first, want], chain, account: deployer.account! });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`topped the loaded account up for the payment leg (${hash})`);
    }
    const payeeBefore = await balanceOf(EOA);
    try {
      const receipt = await pay(getPlayer(player.privyUserId)!, EOA, '2', 'kt-load-pay');
      const moved = (await balanceOf(EOA)) - payeeBefore;
      record(
        'L2',
        moved === parseUnits('2', token.decimals) ? 'PASS' : 'FAIL',
        `Lane A out of the loaded account ${short(first)}: ${receipt.hash} moved ${formatUnits(moved, token.decimals)} ${token.symbol} to ${short(EOA)}; account balance now ${receipt.balanceAfter} — the owner's slip was signed ${policyBound ? 'under the re-pinned typed-data rule' : 'by an unbound rig signer (see L2b)'} and the loaded contract's own role grants executed it`,
      );
    } catch (e) {
      record('L2', 'FAIL', `Lane A out of the loaded account was refused: [${codeOf(e)}] ${(e as Error).message.split('\n')[0].slice(0, 200)}`);
    }
  }

  // ---- L2b: the pin moved, it did not widen
  if (!policyBound) {
    record('L2b', 'SKIP', `this rig wallet's session signer carries no policy at all (Privy \`override_policy_ids\` empty), so it would sign for any account and the pin has nothing to prove — re-run with --fresh`);
  } else {
    const nowCurrent = await trySignSlipFor(getPlayer(player.privyUserId)!, first);
    const previous = await trySignSlipFor(getPlayer(player.privyUserId)!, second);
    record(
      'L2b',
      nowCurrent.signed && !previous.signed ? 'PASS' : previous.signed ? 'FAIL' : 'PARTIAL',
      `session signer asked for a slip on the loaded account ${short(first)} → ${nowCurrent.signed ? 'signed' : `refused [${nowCurrent.code}] ${nowCurrent.message}`}; on the account it was loaded away from ${short(second)} → ${previous.signed ? 'SIGNED ANYWAY (the rule names more than one contract)' : `refused [${previous.code}] ${previous.message}`}`,
    );
  }

  // ---- L3: somebody else's AccountBlox
  {
    const before = getPlayer(player.privyUserId)!.account;
    const r = await refusal(player, fixtureAccount, `the fixture account owned by ${fixtureOwner}`);
    record(
      'L3',
      r.code === 'ACCOUNT_NOT_OWNED' && r.accountAfter?.toLowerCase() === before?.toLowerCase() ? 'PASS' : 'FAIL',
      `a real AccountBlox owned by ${short(fixtureOwner)} → [${r.code}] ${r.message}; the player's file still says ${short(r.accountAfter)}`,
    );
  }

  // ---- L4 / L5 / L6: things that are not this player's account contract
  {
    const cases: Array<[string, Address, string]> = [
      ['L4', EOA, 'a plain wallet address (no code)'],
      ['L5', token.address, 'the demo ERC-20 (code, but owner() reverts)'],
      ['L5b', copyBlox, 'CopyBlox itself (IBaseStateMachine true, initialized false, ISecureOwnable false)'],
      ['L6', LIVE_ACCOUNT, `the Live wing's own AccountBlox pasted into the ${config.mode} desk`],
    ];
    for (const [id, address, label] of cases) {
      const before = getPlayer(player.privyUserId)!.account;
      const r = await refusal(player, address, label);
      record(
        id,
        r.code === 'ACCOUNT_NOT_A_VAULT' && r.accountAfter?.toLowerCase() === before?.toLowerCase() ? 'PASS' : 'FAIL',
        `${label} ${short(address)} → [${r.code}] ${r.message}`,
      );
    }
  }

  // ---- L7: malformed input never becomes a read
  {
    const bad: Array<[string, unknown]> = [
      ['empty', ''],
      ['not hex', '0xnope'],
      ['too short', first.slice(0, 20)],
      ['zero address', zeroAddress],
      ['a name', 'alice.branchzero.eth'],
    ];
    const out: string[] = [];
    let wrong = 0;
    for (const [label, input] of bad) {
      const r = await refusal(player, input, label);
      out.push(`${label}: ${r.code}`);
      if (r.code !== 'BAD_ARGS') wrong++;
    }
    record('L7', wrong === 0 ? 'PASS' : 'FAIL', `malformed account numbers — ${out.join(' · ')}${wrong ? ` · ${wrong} were not BAD_ARGS` : ''}`);
  }

  // ---- L8: re-loading the current account is a Re-check
  {
    const again = await loadAccount(getPlayer(player.privyUserId)!, first, 'kt-load-again');
    record(
      'L8',
      !again.changed && again.account.toLowerCase() === first.toLowerCase() && again.roleChanges.length === 0 ? 'PASS' : 'FAIL',
      `re-loading ${short(first)}: changed ${again.changed}, role changes [${again.roleChanges.join(' | ') || 'none'}] — the chain is read first, so a repeat sends nothing`,
    );
  }

  // ---- L9: leave the rig where auto-recovery would put it
  {
    const restored = await loadAccount(getPlayer(player.privyUserId)!, second, 'kt-load-restore');
    const recovered = await recoverAccount(player.ownerAddress);
    record(
      'L9',
      restored.account.toLowerCase() === second.toLowerCase() && recovered?.toLowerCase() === second.toLowerCase() ? 'PASS' : 'FAIL',
      `loaded the newest clone ${short(second)} back (changed ${restored.changed}); recoverAccount agrees, so the rig is where "Open my account" would leave it`,
    );
  }

  const finalPlayer = getPlayer(player.privyUserId)!;
  console.log(`\nrig player ${finalPlayer.privyUserId}\n  owner   ${finalPlayer.ownerAddress}\n  account ${finalPlayer.account} · balance ${formatUnits(await balanceOf(finalPlayer.account!), token.decimals)} ${token.symbol}\n  clones  ${(await clonesOf(finalPlayer.ownerAddress)).join(', ')}`);
  finish();
}

function finish() {
  console.log('\n─── Load Account kill tests ───');
  for (const r of results) console.log(`${r.id.padEnd(5)} ${r.verdict.padEnd(7)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
