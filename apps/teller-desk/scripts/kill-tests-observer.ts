/**
 * Terminal Console kill tests — the OBSERVER viewing role, against Remote EVM 1337 and the live Privy application.
 *
 *   npm -w apps/teller-desk run killtests:observer            # reuse the rig player
 *   npm -w apps/teller-desk run killtests:observer -- --fresh # mint a new Privy user + wallet + account
 *
 * The claim under test is one sentence: **a viewing wallet can read this account and can change nothing.** Everything
 * below exists to make that falsifiable rather than asserted.
 *
 *   O0  the role set Account Opening applies still knows nothing about OBSERVER — it is opt-in at the terminal,
 *       not a grant every player silently receives, and a Re-check neither creates nor removes it.
 *   O1  grant → `CREATE_ROLE` + `ADD_WALLET` in one owner-signed batch; `hasRole` true; `getActiveRolePermissions`
 *       is **empty**; the OWNER / BRANCH_MANAGER ROLE_SET 3 bitmaps on `transfer` are untouched.
 *   O2  the permissioned registry views (V10) answer for the viewing wallet — `getPendingTransactions`,
 *       `getTransaction`, `getAuthorizedWallets`, `getWalletRoles` — with a real PENDING wire on the board.
 *   O2b the control: the same reads from a wallet with no role → `NoPermission`. Without this, O2 proves nothing;
 *       an unpermissioned view would "pass" for everybody.
 *   O3  every direct write path from the viewing wallet → `NoPermission`: file a wire (`executeWithTimeLock`),
 *       release one (`approveTimeLockExecution`), recall one (`cancelTimeLockExecution`). Simulated as the
 *       observer, so the refusal is the contract's, not a missing signature or an empty gas tank.
 *   O3b the meta path, which is the interesting one: a **genuine, owner-signed** Lane A payment slip — the same
 *       object the teller submits every day — handed to the viewing wallet to broadcast. It carries a valid
 *       signature, so the refusal can only come from the submitter's permissions
 *       (`EXECUTE_META_REQUEST_AND_APPROVE` is the broadcaster's, not OBSERVER's).
 *   O4  re-granting the same wallet is a quiet no-op — no second transaction.
 *   O5  revoke → `hasRole` false, and the O2 reads go straight back to `NoPermission`.
 *   O6  a Re-check after all of it still reports ROLE_SET 3 and leaves the (now empty) OBSERVER role alone.
 *
 * Ganache-parity accounts 5–9 are free for lab use on 1337 and hold no role on any player account, which is exactly
 * what a "wallet the player already carries" looks like here.
 */
import { createWalletClient, encodeAbiParameters, formatUnits, getAddress, http, keccak256, parseAbiParameters, parseUnits, toBytes, type Address, type Hex } from 'viem';
import { toAccount } from 'viem/accounts';
import { EngineBlox, GuardController, GUARD_CONTROLLER_FUNCTION_SELECTORS as GC_SEL, RuntimeRBAC, TxAction } from '@bloxchain/sdk';
import { erc20Abi } from '@branch-zero/shared';
import { broadcaster, chain, deployer, metaTxDuration, publicClient } from '../src/chain.ts';
import { config, deployments } from '../src/config.ts';
import { embeddedWalletOf, createPlayerPolicy, privy, recoverPolicy } from '../src/privy.ts';
import { signMetaTx } from '../src/signing/privySigner.ts';
import { cancel, explainRevert, listPending, wire } from '../src/lanes/laneB.ts';
import { BRANCH_MANAGER_ROLE, OWNER_ROLE, ROLE_SET_VERSION, desiredGrants, ensureTxPolicy, ensureTypedDataPolicy, provision, recoverAccount } from '../src/lanes/provision.ts';
import { OBSERVER_ROLE, OBSERVER_ROLE_NAME, grantObserver, listObservers, observerPermissions, revokeObserver } from '../src/lanes/observer.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';
const FRESH = process.argv.includes('--fresh');
/** Ganache acct 5 — the player's "own MetaMask": funded on 1337, holds no role on anybody's AccountBlox. */
const VIEWER = getAddress('0xd03ea8624C8C5987235048901fB614fDcA89b117') as Address;
/** Ganache acct 6 — never granted anything. The control that proves the views are actually gated. */
const STRANGER = getAddress('0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC') as Address;

type Verdict = 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP';
const results: Array<{ id: string; verdict: Verdict; note: string }> = [];
function record(id: string, verdict: Verdict, note: string) {
  results.push({ id, verdict, note });
  console.log(`\n${verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : verdict === 'SKIP' ? '-' : '✗'} ${id} ${verdict} — ${note}\n`);
}
const code = (e: unknown) => (e as { code?: string }).code ?? explainRevert(e).code;
const bit = (bitmap: number | bigint, action: number) => ((Number(bitmap) >> action) & 1) === 1;
const ERC20_TRANSFER_OPERATION = keccak256(toBytes('ERC20_TRANSFER'));

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
    });
  }
  const policy = await createPlayerPolicy(chain.id, `obs-${Date.now().toString(36)}`);
  const user = await privy.users().create({
    linked_accounts: [{ type: 'email', address: email }],
    wallets: [{ chain_type: 'ethereum', additional_signers: [{ signer_id: config.privy.signerId, override_policy_ids: [policy.policyId] }] }],
  });
  const wallet = embeddedWalletOf(user);
  console.log(`privy user ${user.id}\n  wallet ${wallet.walletId} → ${wallet.ownerAddress}\n  re-run without --fresh using: KILLTEST_EMAIL=${email}`);
  return upsertPlayer({ privyUserId: user.id, ownerAddress: wallet.ownerAddress, walletId: wallet.walletId, signingMode: 'session', policyId: policy.policyId, policyRuleId: policy.ruleId });
}

/**
 * A client that can only *call*. `eth_call` carries no signature, so the sender is whatever address the wallet
 * client names — which is exactly how the SDK decides who a permissioned view is answering (V10). Every signing
 * method throws, so nothing here can leave the simulation and become a transaction by accident.
 */
function as(who: Address) {
  const acct = toAccount({
    address: who,
    async signTypedData() {
      throw new Error('simulate only');
    },
    async signMessage() {
      throw new Error('simulate only');
    },
    async signTransaction() {
      throw new Error('simulate only — a read-only wallet must never sign');
    },
  });
  const walletClient = createWalletClient({ account: acct, chain, transport: http(config.rpcUrl) });
  return { walletClient, gc: (account: Address) => new GuardController(publicClient, walletClient, account, chain), rbac: (account: Address) => new RuntimeRBAC(publicClient, walletClient, account, chain) };
}

/** Every permissioned view the Console actually needs, tried as one sender. */
async function readsAs(who: Address, account: Address, txId: bigint): Promise<{ ok: boolean; detail: string }> {
  const gc = as(who).gc(account);
  try {
    const pending = await gc.getPendingTransactions();
    const rec = await gc.getTransaction(txId);
    const wallets = await gc.getAuthorizedWallets(OBSERVER_ROLE);
    const roles = await gc.getWalletRoles(who);
    return { ok: true, detail: `getPendingTransactions [${pending.join(',')}] · getTransaction #${rec.txId} status ${Number(rec.status)} · getAuthorizedWallets(OBSERVER) ${wallets.length} · getWalletRoles ${roles.length}` };
  } catch (e) {
    return { ok: false, detail: `${code(e)}` };
  }
}

const balanceOf = async (who: Address) => (await publicClient.readContract({ address: deployments().token.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] })) as bigint;

async function main() {
  console.log(`chain ${chain.id} · Privy app ${config.privy.appId} · ROLE_SET ${ROLE_SET_VERSION} · viewer ${VIEWER} · stranger ${STRANGER}\n`);
  let player = await rigPlayer();
  const { token } = deployments();

  console.log('provisioning (Re-check)…');
  const prov = await provision(player, 'kt-observer-provision');
  player = getPlayer(player.privyUserId)!;
  const account = prov.account;
  player = await ensureTxPolicy(player, account);
  player = await ensureTypedDataPolicy(player);
  console.log(`account ${account} · roleSet ${prov.roleSet} · changes: ${prov.roleChanges.join(' | ') || 'none'}\n`);

  // Housekeeping: an earlier run may have left this wallet on the list, or the account short of practice dollars.
  {
    const already = await listObservers(player);
    if (already.wallets.some((w) => w.toLowerCase() === VIEWER.toLowerCase())) {
      await revokeObserver(player, VIEWER, 'kt-observer-cleanup');
      console.log(`removed ${VIEWER} left over from an earlier run`);
    }
    const bal = await balanceOf(account);
    const want = parseUnits(config.openingBalance, token.decimals);
    if (bal < want) {
      const hash = await deployer.writeContract({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [account, want - bal], chain, account: deployer.account! });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`topped the rig account up to ${config.openingBalance} ${token.symbol} (${hash})`);
    }
  }

  // ---- O0: OBSERVER is not part of the provisioned role set
  {
    const wanted = desiredGrants(true);
    const mentions = wanted.filter((g) => g.role.toLowerCase() === OBSERVER_ROLE.toLowerCase());
    const created = prov.roleChanges.some((c) => c.includes(OBSERVER_ROLE_NAME));
    record(
      'O0',
      mentions.length === 0 && !created ? 'PASS' : 'FAIL',
      `desiredGrants() names OBSERVER in ${mentions.length} grant(s); Re-check role changes mentioning ${OBSERVER_ROLE_NAME}: ${created ? 'yes' : 'none'} — viewing access is opt-in at the terminal, never a default at Account Opening`,
    );
  }

  // A record on the board, so the reads below have something real to answer with.
  const w = await wire(player, STRANGER, '25', 'kt-observer-board');
  const txId = BigInt(w.txId);
  console.log(`filed wire #${w.txId} (PENDING until ${w.releaseTime}) so the registry views have something to show\n`);

  // ---- O1: grant
  let granted: Awaited<ReturnType<typeof grantObserver>>;
  {
    const ownerBefore = (await new RuntimeRBAC(publicClient, broadcaster, account, chain).getActiveRolePermissions(OWNER_ROLE)) as Array<{ functionSelector: Hex; grantedActionsBitmap: number | bigint }>;
    granted = await grantObserver(player, VIEWER, 'kt-observer-grant');
    const perms = await observerPermissions(account);
    const rb = new RuntimeRBAC(publicClient, broadcaster, account, chain);
    const has = await rb.hasRole(OBSERVER_ROLE, VIEWER);
    const T = EngineBlox.ERC20_TRANSFER_SELECTOR.toLowerCase();
    const ownerAfter = (await rb.getActiveRolePermissions(OWNER_ROLE)) as Array<{ functionSelector: Hex; grantedActionsBitmap: number | bigint }>;
    const mgrAfter = (await rb.getActiveRolePermissions(BRANCH_MANAGER_ROLE)) as Array<{ functionSelector: Hex; grantedActionsBitmap: number | bigint }>;
    const oT = ownerAfter.find((g) => g.functionSelector.toLowerCase() === T);
    const mT = mgrAfter.find((g) => g.functionSelector.toLowerCase() === T);
    const ownerUnchanged = JSON.stringify(ownerBefore.map((g) => [g.functionSelector, Number(g.grantedActionsBitmap)])) === JSON.stringify(ownerAfter.map((g) => [g.functionSelector, Number(g.grantedActionsBitmap)]));
    const ok = granted.changed && has && perms.length === 0 && ownerUnchanged && !!oT && bit(oT.grantedActionsBitmap, TxAction.SIGN_META_APPROVE) && !!mT && bit(mT.grantedActionsBitmap, TxAction.EXECUTE_META_APPROVE);
    record(
      'O1',
      ok ? 'PASS' : 'FAIL',
      `grant → ${granted.actions.join(' | ')} (${granted.hash}); hasRole ${has}; OBSERVER function permissions: ${perms.length === 0 ? 'none' : JSON.stringify(perms)}; ROLE_SET ${ROLE_SET_VERSION} intact — OWNER transfer bitmap ${oT ? Number(oT.grantedActionsBitmap) : 'none'} (unchanged: ${ownerUnchanged}), BRANCH_MANAGER transfer bitmap ${mT ? Number(mT.grantedActionsBitmap) : 'none'}`,
    );
  }

  // ---- O2 / O2b: the permissioned views, with and without the role
  {
    const viewer = await readsAs(VIEWER, account, txId);
    record('O2', viewer.ok ? 'PASS' : 'FAIL', `viewing wallet reads the permissioned registry (V10): ${viewer.detail}`);
    const stranger = await readsAs(STRANGER, account, txId);
    record('O2b', !stranger.ok && stranger.detail === 'NoPermission' ? 'PASS' : stranger.ok ? 'FAIL' : 'PARTIAL', `control — a wallet with no role on the same views → ${stranger.ok ? 'READ ANYWAY (the views are not gated)' : stranger.detail}`);
  }

  // ---- O3: every write path, simulated as the viewing wallet
  {
    const gc = as(VIEWER).gc(account);
    const transferParams = encodeAbiParameters(parseAbiParameters('address, uint256'), [STRANGER, parseUnits('1', token.decimals)]);
    const attempts: Array<[string, () => Promise<unknown>]> = [
      ['executeWithTimeLock (file a wire)', () => gc.executeWithTimeLock(token.address, 0n, EngineBlox.ERC20_TRANSFER_SELECTOR, transferParams, 300_000n, ERC20_TRANSFER_OPERATION, { from: VIEWER })],
      ['approveTimeLockExecution (release)', () => gc.approveTimeLockExecution(txId, { from: VIEWER })],
      ['cancelTimeLockExecution (recall)', () => gc.cancelTimeLockExecution(txId, { from: VIEWER })],
    ];
    const outcome: string[] = [];
    let breached = 0;
    for (const [name, run] of attempts) {
      try {
        await run();
        outcome.push(`${name}: ACCEPTED`);
        breached++;
      } catch (e) {
        const c = code(e);
        outcome.push(`${name}: ${c}`);
        // "simulate only" means the pre-flight passed and viem went to sign — a permission breach in disguise.
        if (!/NoPermission/i.test(c) && !/NoPermission/i.test((e as Error).message ?? '')) {
          if (/simulate only/i.test((e as Error).message ?? '')) breached++;
        }
      }
    }
    record('O3', breached === 0 ? 'PASS' : 'FAIL', `writes as the viewing wallet — ${outcome.join(' · ')}${breached ? ` · ${breached} path(s) were not refused` : ''}`);
  }

  // ---- O3b: a real owner-signed payment slip, broadcast by the viewing wallet
  {
    const gcDesk = new GuardController(publicClient, broadcaster, account, chain);
    const params = encodeAbiParameters(parseAbiParameters('address, uint256'), [STRANGER, parseUnits('1', token.decimals)]);
    const metaTxParams = await gcDesk.createMetaTxParams(account, GC_SEL.REQUEST_AND_APPROVE_EXECUTION_SELECTOR, TxAction.SIGN_META_REQUEST_AND_APPROVE, await metaTxDuration(), 0n, player.ownerAddress);
    const unsigned = await gcDesk.generateUnsignedMetaTransactionForNew(player.ownerAddress, token.address, 0n, 200_000n, ERC20_TRANSFER_OPERATION, EngineBlox.ERC20_TRANSFER_SELECTOR, params, metaTxParams);
    const signed = await signMetaTx(publicClient, chain, unsigned, { owner: player.ownerAddress, walletId: player.walletId, account });
    const payeeBefore = await balanceOf(STRANGER);
    try {
      await as(VIEWER).gc(account).requestAndApproveExecution(signed, { from: VIEWER });
      record('O3b', 'FAIL', 'the viewing wallet broadcast an owner-signed payment slip');
    } catch (e) {
      const c = code(e);
      const moved = (await balanceOf(STRANGER)) - payeeBefore;
      const refused = /NoPermission/i.test(c) || /NoPermission/i.test((e as Error).message ?? '');
      record(
        'O3b',
        refused && moved === 0n ? 'PASS' : 'FAIL',
        `a genuine owner-signed Lane A slip, submitted by the viewing wallet → ${c}; payee moved ${formatUnits(moved, token.decimals)} ${token.symbol} — the signature was valid, so this refusal is the submitter's missing EXECUTE_META_REQUEST_AND_APPROVE, not a bad slip`,
      );
    }
  }

  // ---- O4: idempotence
  {
    const again = await grantObserver(player, VIEWER, 'kt-observer-regrant');
    record('O4', !again.changed && !again.hash && again.wallets.length === granted.wallets.length ? 'PASS' : 'FAIL', `re-granting ${VIEWER}: changed ${again.changed}, transaction ${again.hash ?? 'none'}, wallets ${again.wallets.length} — a repeat is a quiet no-op, not a second batch`);
  }

  // ---- O5: revoke takes the reading right back
  {
    const revoked = await revokeObserver(player, VIEWER, 'kt-observer-revoke');
    const has = await new RuntimeRBAC(publicClient, broadcaster, account, chain).hasRole(OBSERVER_ROLE, VIEWER);
    const after = await readsAs(VIEWER, account, txId);
    record('O5', !has && !after.ok && after.detail === 'NoPermission' ? 'PASS' : 'FAIL', `revoke (${revoked.hash}) → hasRole ${has}; the same reads now → ${after.ok ? 'STILL READABLE' : after.detail}`);
  }

  // ---- O6: a Re-check leaves the empty role alone and keeps ROLE_SET 3
  {
    const before = await listObservers(player);
    const again = await provision(getPlayer(player.privyUserId)!, 'kt-observer-recheck');
    const after = await listObservers(player);
    const touched = again.roleChanges.some((c) => c.includes(OBSERVER_ROLE_NAME));
    record(
      'O6',
      again.roleSet === ROLE_SET_VERSION && !touched && after.exists === before.exists && after.wallets.length === before.wallets.length ? 'PASS' : 'FAIL',
      `Re-check after the terminal: roleSet ${again.roleSet}, changes [${again.roleChanges.join(' | ') || 'none'}] — OBSERVER role ${after.exists ? 'kept' : 'absent'} with ${after.wallets.length} wallet(s), untouched by provisioning`,
    );
  }

  // Leave the board as we found it.
  try {
    await cancel(player, txId, 'owner', 'kt-observer-cleanup');
    console.log(`\nrecalled the board wire #${txId}`);
  } catch (e) {
    console.log(`\ncould not recall wire #${txId}: ${(e as Error).message.slice(0, 140)}`);
  }
  const pendingNow = (await listPending(account)).map((x) => x.txId);
  console.log(`account ${account} · balance ${formatUnits(await balanceOf(account), token.decimals)} ${token.symbol} · pending [${pendingNow.join(',')}]`);
  finish();
}

function finish() {
  console.log('\n─── Terminal Console kill tests (OBSERVER) ───');
  for (const r of results) console.log(`${r.id.padEnd(5)} ${r.verdict.padEnd(7)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
