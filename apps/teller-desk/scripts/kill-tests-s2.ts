/**
 * S2 kill tests — Sepolia Live + Developer Mode (docs/SEPOLIA-LIVE.md §6).
 *
 *   npm -w apps/teller-desk run killtests:s2            # against the Live desk (Sepolia)
 *   npm -w apps/teller-desk run killtests:s2 -- --dev   # against the Dev desk (Remote EVM 1337)
 *
 * The earlier units all ran on one chain, so nothing had to check the things that only exist once there are
 * two wings. This script checks exactly those, and nothing the other scripts already prove:
 *
 *   S2-1  the desk names the payment chain it is actually on — mode, chainId, chain name, explorer. This is
 *         the "no hard-coded 1337 when Live" invariant, checked at the source the board reads from.
 *   S2-2  the player index is isolated per wing: the same Privy user's Main account on this wing is not the
 *         account the *other* wing has on file for them. Two chains, two contracts, no bleed.
 *   S2-3  Live unifies Main and the FX till — Johnny trades out of the account Iris opened. Dev must not:
 *         a 1337 account cannot be a Sepolia till.
 *   S2-4  FX refuses an account that is not really a Sepolia AccountBlox of this player's
 *         (`FX_TILL_NOT_SEPOLIA`), and the refusal happens *before* anything is signed.
 *   S2-5  the practice dollars are the open-mint demo token pinned in sepolia.json — never Circle's USDC.
 *   S2-6  every bank line these paths can produce exists in the game's `errors.json`.
 *
 * Read-only except S2-4, which asks for a quote/enable it expects to be refused: no writes, no gas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getAddress, type Address } from 'viem';
import { SEPOLIA_CHAIN_ID, REMOTE_EVM_CHAIN_ID } from '@branch-zero/shared';
import { chain, publicClient } from '../src/chain.ts';
import { config, deployments, explorerTx, REPO_ROOT } from '../src/config.ts';
import { embeddedWalletOf, privy } from '../src/privy.ts';
import { fxStatus, tillFor } from '../src/lanes/fx.ts';
import { getPlayer, upsertPlayer, type Player } from '../src/store.ts';

const RIG_EMAIL = process.env.KILLTEST_EMAIL ?? 'k2-rig@branch-zero.local';

const results: Array<{ id: string; verdict: 'PASS' | 'FAIL' | 'SKIP'; note: string }> = [];
function record(id: string, verdict: 'PASS' | 'FAIL' | 'SKIP', note: string) {
  results.push({ id, verdict, note });
  console.log(`\n${verdict === 'PASS' ? '✓' : verdict === 'SKIP' ? '·' : '✗'} ${id} ${verdict} — ${note}\n`);
}

async function rigPlayer(email: string): Promise<Player | undefined> {
  const existing = await privy.users().getByEmailAddress({ address: email }).catch(() => undefined);
  if (!existing) return undefined;
  const w = embeddedWalletOf(existing);
  const stored = getPlayer(existing.id);
  return upsertPlayer({
    privyUserId: existing.id,
    ownerAddress: w.ownerAddress,
    walletId: w.walletId,
    signingMode: w.delegated ? 'session' : 'client',
    policyId: stored?.policyId,
    policyRuleId: stored?.policyRuleId,
    account: stored?.account,
    configured: stored?.configured,
    roleSet: stored?.roleSet,
    fxAccount: stored?.fxAccount,
  });
}

/** The other wing's player index, read straight off disk — the file `store.ts` would have written there. */
function otherWingIndex(): { file: string; players: Array<{ privyUserId: string; account?: string }> } {
  const otherChainId = config.chainId === REMOTE_EVM_CHAIN_ID ? SEPOLIA_CHAIN_ID : REMOTE_EVM_CHAIN_ID;
  const suffix = otherChainId === REMOTE_EVM_CHAIN_ID ? '' : `-${otherChainId}`;
  const file = path.join(REPO_ROOT, 'apps', 'teller-desk', '.data', `players${suffix}.json`);
  if (!fs.existsSync(file)) return { file, players: [] };
  return { file, players: JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ privyUserId: string; account?: string }> };
}

async function main() {
  const email = RIG_EMAIL;
  console.log(`S2 — mode ${config.mode} · wing ${config.target} · chain ${config.chainId} · rig ${email}\n`);
  const live = config.mode === 'live';

  // ---- S2-1: the desk names the chain it is on
  {
    const onChainId = await publicClient.getChainId();
    const expectMode = live ? 'live' : 'dev';
    const expectChain = live ? SEPOLIA_CHAIN_ID : REMOTE_EVM_CHAIN_ID;
    const explorer = explorerTx('0xhash');
    const ok =
      config.mode === expectMode &&
      config.chainId === expectChain &&
      onChainId === expectChain &&
      chain.id === expectChain &&
      (live ? explorer?.startsWith('https://sepolia.etherscan.io/tx/') === true : explorer === undefined);
    record(
      'S2-1',
      ok ? 'PASS' : 'FAIL',
      `mode ${config.mode} · chainId ${config.chainId} (RPC says ${onChainId}) · chain name "${chain.name}" · explorer ${explorer ?? 'none (private lab chain)'}` +
        (ok ? '' : ` — expected mode ${expectMode} on chain ${expectChain}`),
    );
  }

  // ---- S2-5: practice dollars are the pinned open-mint demo token
  {
    const { token } = deployments();
    const pinned = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'infra', 'deployments', live ? 'sepolia.json' : 'remote-evm.json'), 'utf8')) as {
      tokens?: Record<string, { address: string; decimals?: number }>;
    };
    const expected = getAddress(pinned.tokens!.demoUsdc.address) as Address;
    /** Circle's Sepolia USDC. Must never be the in-game balance (docs/SEPOLIA-LIVE.md §4.2). */
    const CIRCLE_SEPOLIA_USDC = getAddress('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238') as Address;
    const ok = token.address === expected && token.address !== CIRCLE_SEPOLIA_USDC;
    record(
      'S2-5',
      ok ? 'PASS' : 'FAIL',
      `practice token ${token.address} (${token.symbol}, ${token.decimals} dp) is the pinned demoUsdc and is not Circle's faucet USDC ${CIRCLE_SEPOLIA_USDC}`,
    );
  }

  const player = await rigPlayer(email);
  if (!player) {
    record('S2-2', 'SKIP', `no Privy rig user ${email} — run \`npm -w apps/teller-desk run killtests -- --fresh\` on this wing first`);
    record('S2-3', 'SKIP', 'needs the rig player');
    record('S2-4', 'SKIP', 'needs the rig player');
  } else {
    // ---- S2-2: per-wing player isolation
    {
      const other = otherWingIndex();
      const mine = player.account;
      const theirs = other.players.find((p) => p.privyUserId === player.privyUserId)?.account;
      const isolated = !mine || !theirs || mine.toLowerCase() !== theirs.toLowerCase();
      record(
        'S2-2',
        isolated ? 'PASS' : 'FAIL',
        `this wing has ${mine ?? 'no account'} for ${player.privyUserId.slice(0, 24)}…; ${path.basename(other.file)} has ${theirs ?? 'no account'} — ` +
          (isolated ? 'separate contracts, no bleed between wings' : 'the two wings share one account address, which cannot be right on two chains'),
      );
    }

    // ---- S2-3: Live unifies Main and the FX till; Dev keeps them apart
    {
      const till = await tillFor(player).catch((e) => (e as Error & { code?: string }).code ?? (e as Error).message);
      const main = player.account;
      if (typeof till !== 'string' || !till.startsWith('0x')) {
        record('S2-3', live ? 'FAIL' : 'PASS', `FX till on the ${config.mode} wing: ${till}${live ? ' — Live should trade out of the Main account' : ' (Dev has no Sepolia till for this owner yet, which is honest)'}`);
      } else {
        const unified = Boolean(main) && till.toLowerCase() === main!.toLowerCase();
        const ok = live ? unified && config.fxTillIsMain : !unified;
        record(
          'S2-3',
          ok ? 'PASS' : 'FAIL',
          live
            ? `Live: FX till ${till} is the Main account ${main} — Johnny trades out of the account Iris opened (fxTillIsMain ${config.fxTillIsMain})`
            : `Dev: FX till ${till} is on Sepolia while Main is ${main ?? 'not opened on this wing yet'} on ${chain.name} ${chain.id} — FX is always Sepolia, and a 1337 account can never be the till (fxTillIsMain ${config.fxTillIsMain})`,
        );
      }
    }

    // ---- S2-4: FX refuses an account that is not a real Sepolia AccountBlox of this player's
    {
      /**
       * The CopyBlox factory: a real contract on both chains, and never an AccountBlox owned by a player. It
       * stands in for the mistake this gate exists to catch — an address from the wrong chain, or one that
       * simply is not this player's account — without needing a second player.
       */
      const notATill = deployments().copyBlox;
      const probe = { ...player, account: notATill, fxAccount: notATill } as Player;
      let code = 'no refusal';
      try {
        await tillFor(probe);
      } catch (e) {
        code = (e as Error & { code?: string }).code ?? (e as Error).message.slice(0, 80);
      }
      const ok = code === 'FX_TILL_NOT_SEPOLIA';
      const lines = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'apps', 'game', 'dialogue', 'errors.json'), 'utf8')) as Record<string, { line: string }>;
      record(
        'S2-4',
        ok ? 'PASS' : 'FAIL',
        `FX till check on ${notATill} (CopyBlox, not anyone's account) → ${code}` + (ok ? `; bank line: "${lines.FX_TILL_NOT_SEPOLIA?.line ?? 'MISSING'}"` : ''),
      );
    }
  }

  // ---- S2-6: every code these paths raise has a bank line
  {
    const lines = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'apps', 'game', 'dialogue', 'errors.json'), 'utf8')) as Record<string, { line: string; why: string }>;
    const needed = ['FX_TILL_NOT_SEPOLIA', 'FX_SEPOLIA_ONLY', 'DEV_DESK_DOWN', 'FX_TILL_CLOSED', 'FAUCET_OFF'];
    const missing = needed.filter((c) => !lines[c]?.line);
    const sepoliaOnly = /sepolia/i.test(lines.FX_SEPOLIA_ONLY?.line ?? '');
    record(
      'S2-6',
      missing.length === 0 && sepoliaOnly ? 'PASS' : 'FAIL',
      missing.length ? `errors.json is missing ${missing.join(', ')}` : `${needed.length} codes have bank lines; FX_SEPOLIA_ONLY says Sepolia in words: "${lines.FX_SEPOLIA_ONLY.line}"`,
    );
  }

  // A read-only look at the FX board, for the record rather than as a verdict.
  if (player) {
    const status = await fxStatus(getPlayer(player.privyUserId)!).catch((e) => ({ error: (e as Error & { code?: string }).code ?? (e as Error).message }));
    console.log(`FX board: ${JSON.stringify(status && 'account' in status ? { account: status.account, enabled: status.enabled, usd: status.usdc, eur: status.eur, ils: status.ils, chainId: status.chainId } : status)}`);
  }

  console.log('\n─── S2 kill tests (Sepolia Live + Developer Mode) ───');
  for (const r of results) console.log(`${r.id.padEnd(6)} ${r.verdict.padEnd(5)} ${r.note}`);
  process.exitCode = results.some((r) => r.verdict === 'FAIL') ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
