---
title: Kickoff prompt — Load Account (Iris)
created: 2026-09-08
product: Branch-Zero
model: Claude Code · Opus 5 high
handoff: docs/missions/HANDOFF-load-account.md
plan: docs/LOAD-ACCOUNT.md
---

# Kickoff prompt — Load Account (Iris)

Paste into a **new** Claude Code / Cursor session. Prefer **Opus 5 high** (Claude Opus 5 · high thinking).

**What this is:** Iris (Account Opening) lets the player **load a specific AccountBlox address** they own on
the current wing — for non-latest CopyBlox clones and multi-account use. Terminal stays discovery; Iris is
the clean load path.

**Why:** Auto-recovery only adopts the **last** `BloxCloned` for the Privy owner. CopyBlox has no
owner→clones mapping. Players who opened more than one vault (or need an older one) need a diegetic way to
hand Iris the address the Console already helped them find.

---

## Reflect

| Fact | Implication |
|------|-------------|
| CopyBlox = flat set + `BloxCloned` logs | No Solidity change required for load-by-address |
| `recoverAccount` → last clone only | Custom load is the escape hatch |
| Terminal / Console discover addresses | Do not rebuild a browser explorer in Godot |
| `owner()` must match Privy owner | Same gate as FX till honesty |
| Desk holds one `player.account` per wing | Load switches the active vault + re-pins policies |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code Opus 5 high.

MISSION: Branch Zero — let Iris load a player-owned AccountBlox by address on the current wing (edge: not the latest CopyBlox clone; multi-account). Terminal remains discovery; Iris is the clean load path in chat.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/LOAD-ACCOUNT.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-load-account.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/KICKOFF-load-account.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md (Iris §4.2)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/TERMINAL-CONSOLE.md
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-CC.md
7. apps/game/dialogue/clerk.json · apps/game/scripts/name_claim_form.gd · apps/teller-desk/src/lanes/provision.ts (recoverAccount) · apps/teller-desk/src/server.ts (/session)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Remote EVM: Dev only — do not wipe.

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. No CopyBlox Solidity changes. No custom contracts.
- Load only if on-chain owner() == session Privy owner on the desk's chain. Refuse otherwise with a bank line + Ask why.
- Do not load EOAs, empty code, or contracts that do not answer owner() like an AccountBlox.
- After load: patch player.account, re-pin typed-data + tx policies to the new address, run provision sync (guards/roles) WITHOUT cloneBlox.
- Live vs Eve: address must be on the current desk wing — no cross-chain paste.
- Godot never holds keys / never talks RPC. One Privy modal. Everyday bank words on screen.
- Do not regress Sepolia Live, Dev mode, ENS, FX, Priority, faucet, OBSERVER, AO polish, s2 killtests. Arc stays DEFERRED.
- No secrets in git.

SEQUENCE:
1. Dialogue: Iris open/done/start_over — "Load an existing account" → form (mirror name_claim / payment_slip). Hint that the desk terminal helps find addresses.
2. Bridge + Teller: action/endpoint e.g. load_account / POST /account/load { account }. Validate getAddress + getCode + SecureOwnable.owner() == player.ownerAddress.
3. Persist + sync: patchPlayer account; pin policies; idempotent provision path without cloning; passbook / getSession show the loaded address.
4. MockChain + Godot checks (clerk form wiring) and a desk smoke/kill proving load of a non-latest owned clone (or fixture) and refusal of a foreign owner.
5. Docs: NPCS Iris lines, LOAD-ACCOUNT §7 ticks, REFLECTION row, HANDOFF-CC when met. Optional one-line terminal hint toward Iris.

DoD = docs/LOAD-ACCOUNT.md §7 + HANDOFF-load-account.md.

OUT OF SCOPE: CopyBlox getClonesForOwner; loading non-owned vaults; Arc; treasury ops; ship packaging; replacing auto-recovery (keep last-clone default for Open my account).

Stop when DoD met or a named blocker with the smallest honest fallback.
```

---

## After this pass

- Optional stretch: list this owner's `BloxCloned` clones as Iris choices (still log-based).
- ENS remains pay-by-name / label — not required for load.
- Treasury / U7 packaging / Arc remain separate missions.
