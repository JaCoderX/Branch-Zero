---
title: Kickoff prompt — ENS passbook polish (CC)
created: 2026-09-10
product: Branch-Zero
model: Claude Code · Opus / Fable high
handoff: docs/HANDOFF-ens-passbook-polish.md
---

# Kickoff prompt — ENS passbook polish

Paste into a **new** Claude Code session. Prefer **Opus / Fable high**.

**What this is:** a **small follow-up** after Luna’s copy/ENS refinement. Two polish items only: (1) stop showing unclaimed bank-name placeholders, (2) show Silver/Gold tier on the passbook when a name exists.

**Why:** Principal review of Luna’s met pass — name surfaces are good; “not chosen yet” is stiff; Name Desk already edits `bz.tier` but the passbook never shows it.

**Baseline:** Luna copy/ENS **met** ([`HANDOFF-copy-ens-refinement.md`](./HANDOFF-copy-ens-refinement.md)). Player menu **met** — do not reopen it.

**Handoff:** [`docs/HANDOFF-ens-passbook-polish.md`](./HANDOFF-ens-passbook-polish.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| `{bank_name}` already interpolates `"not chosen yet"` | Condition displays; don’t delete the ENS surface |
| `Player` has `ensName`, not tier | Persist `ensTier` on mint/setText; put on `/session` |
| MockChain already tracks `ens_tier` | Expose it the same way as live |
| Player menu already met | Do not edit `player_menu.gd` or Esc/title flow |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code (Opus / Fable high).

MISSION: Branch Zero — ENS passbook polish after Luna copy/ENS.
(1) Omit unclaimed bank-name noise on passbook, Mo, and Ines (no "not chosen yet").
(2) Persist bz.tier (Silver/Gold) on the player/session and show it on the passbook when a bank name exists.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/HANDOFF-ens-passbook-polish.md
2. docs/KICKOFF-ens-passbook-polish.md
3. docs/HANDOFF-copy-ens-refinement.md (prior met — do not regress)
4. docs/ENS.md §2–4 (bz.tier is the passbook tier record)
5. apps/game/scripts/hud.gd · apps/game/autoload/game_state.gd · apps/teller-desk/src/ens.ts · store.ts · server.ts session shape
6. docs/HANDOFF-CC.md freeze notes (Priority / Bob / FX / Live-Dev)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Claude Code. Product repo only. No GameLab ENG-*. No protocol Solidity. No mainnet ENS.
- Do NOT touch player-menu (`player_menu.gd`, menu walks) or reopen AO keyboard/screen placement for this mission.
- Everyday bank words on passbook / Mo / Ines. Protocol only in Ask why.
- Prefer extending /session + existing mint/ensSetText patches over a new bridge method. Ask before new HTTP routes.
- Preserve Counter pay-by-name, names board strings, Bob wait-only, Priority, FX Sepolia-only, ARC coming soon.
- Runtime: @bloxchain/sdk + viem. Godot never holds keys / never talks RPC.
- Never commit secrets. Leave reverse names / staff directory / EAC deny-addr for a later OWED — out of scope here.

SEQUENCE:
1. git status — touch only ENS-passbook-related paths; leave player-menu alone.
2. Soften unclaimed name: hud passbook omits name row (or soft Petra invite — prefer omit); split/condition Mo has_account and Ines done/loaded so unnamed players never see "not chosen yet".
3. Persist ensTier: patchPlayer on mint + ensSetText; /session + bridge + GameState.vars bank_tier; MockChain session parity.
4. Passbook when named: show bank name + tier; after Gold update, tier refreshes on state change.
5. Tests: run_checks assertions for conditioned name + tier; mock walk claim → Silver on passbook → Gold update; typecheck teller-desk/web.
6. Close: mark HANDOFF met; OWED; one REFLECTION line. Do not claim reverse-resolution.

DoD:
- [ ] Unnamed: no "not chosen yet" on Mo / Ines / passbook
- [ ] Named: passbook shows bank name + Silver/Gold from desk mirror
- [ ] Gold update updates passbook without a new bridge verb
- [ ] Mock + TS checks green for this scope
- [ ] Handoff met + OWED/REFLECTION

STOP AND ASK if: tier cannot ride on /session without a new route; you want reverse names on the ledger; Live Sepolia write is required to prove tier (mock is enough for DoD).
```

---

## After

Principal: mock or Live — open account → glance passbook (no name row) → Petra claim → passbook name + Silver → Gold update → passbook Gold. Mo greeting names the bank name only after claim.
