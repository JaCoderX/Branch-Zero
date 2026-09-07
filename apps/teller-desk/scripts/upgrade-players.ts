/**
 * Re-check every player on file whose role set is behind `ROLE_SET_VERSION` (U4+: 2 → 3, the Priority grant split),
 * exactly as Ines's "Re-check my account" would — reads the chain first, sends only what is missing, tightens the
 * Privy typed-data rule. Needs the session signer (the players delegated at Account Opening), not the players.
 *
 *   npm -w apps/teller-desk run upgrade-players            # upgrade everyone below the current ROLE_SET
 *   npm -w apps/teller-desk run upgrade-players -- --all   # re-run provision for everyone (idempotent)
 *
 * Until this (or a Re-check in the bank) has run, `/pay` `/wire` `/priority/*` refuse an out-of-date account with
 * `NOT_CONFIGURED` — never a half-provisioned player (U4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/config.ts';
import { recoverPolicy } from '../src/privy.ts';
import { ROLE_SET_VERSION, ensureTxPolicy, ensureTypedDataPolicy, provision } from '../src/lanes/provision.ts';
import { getPlayer, patchPlayer, type Player } from '../src/store.ts';

const ALL = process.argv.includes('--all');
const file = path.join(REPO_ROOT, 'apps', 'teller-desk', '.data', 'players.json');
const players = JSON.parse(fs.readFileSync(file, 'utf8')) as Player[];

async function main() {
  console.log(`ROLE_SET_VERSION ${ROLE_SET_VERSION} · ${players.length} player(s) on file\n`);
  for (const p of players) {
    let player = getPlayer(p.privyUserId) ?? p;
    const behind = (player.roleSet ?? 0) < ROLE_SET_VERSION;
    if (!player.account) {
      console.log(`- ${player.ownerAddress}: no account yet — skipped`);
      continue;
    }
    if (!behind && !ALL) {
      console.log(`- ${player.ownerAddress} (${player.account}): roleSet ${player.roleSet} — up to date`);
      continue;
    }
    if (!player.policyId) {
      const recovered = await recoverPolicy(player.walletId).catch(() => undefined);
      if (recovered?.policyId) {
        player = patchPlayer(player.privyUserId, {
          policyId: recovered.policyId,
          policyRuleId: recovered.ruleId,
          ...(recovered.txRules ? { txRuleIds: recovered.txRules.ruleIds, txPolicyMode: recovered.txRules.mode } : {}),
        });
        console.log(`  policy recovered from Privy: ${recovered.policyId}`);
      }
    }
    console.log(`- ${player.ownerAddress} (${player.account}): roleSet ${player.roleSet ?? 'none'} → ${ROLE_SET_VERSION}…`);
    try {
      const r = await provision(player, `upgrade-${Date.now().toString(36)}`);
      player = getPlayer(player.privyUserId)!;
      player = await ensureTxPolicy(player, r.account);
      player = await ensureTypedDataPolicy(player);
      console.log(`  ✓ roleSet ${r.roleSet} · priority ${r.priority} · ${r.roleChanges.length} role change(s): ${r.roleChanges.join(' | ') || 'none'}${r.stranded.length ? `\n  ~ stranded: ${r.stranded.join('; ')}` : ''} · typed-data rule v${player.typedDataRule ?? 1}`);
    } catch (e) {
      console.log(`  ✗ ${(e as Error).message.slice(0, 300)}`);
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
