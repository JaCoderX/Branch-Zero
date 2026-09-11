---
type: handoff
title: Handoff — ENS passbook polish (follow-up to Luna copy/ENS)
audience: cold agent (Claude Code · Opus / Fable)
created: 2026-09-10
product: Branch-Zero
objective: OBJ-2026-0004
mission: Finish the cheap ENS surfaces Luna left thin — hide unclaimed bank-name noise; mirror bz.tier onto the passbook
kickoff: docs/missions/KICKOFF-ens-passbook-polish.md
prior: docs/missions/HANDOFF-copy-ens-refinement.md (met 2026-09-10)
status: met
parallel_to: packaging gate unchanged — player menu already met; do not reopen it
---

# Handoff — ENS passbook polish

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Claude Code** (Opus / Fable high).

**Kickoff (paste):** [`docs/missions/KICKOFF-ens-passbook-polish.md`](./KICKOFF-ens-passbook-polish.md)

**Status (2026-09-10):** **Met** — unnamed customers see no bank-name placeholder on the passbook, Ash or Iris (conditioned dialogue lines + `has_ens_name` fact); a named passbook shows `Bank name · x` and `Tier · Silver|Gold` from the desk's `/session` mirror (`ensTier`, patched on mint and every Name Desk write, read once from `bz.tier` for names claimed earlier); the Gold update reaches the passbook through the ordinary session refresh, no new bridge verb or route. Verified on MockChain (`run_checks`, `run_mock_walk`) + TypeScript typecheck; a Live Sepolia tier walk is a principal walk, not agent work. Next scheduled web export carries it (no forced re-export). Luna copy/ENS refinement was **met** ([`HANDOFF-copy-ens-refinement.md`](./HANDOFF-copy-ens-refinement.md)). Principal review accepted it and asked for the leftover cheap improvements below. Reverse names, staff directory, and EAC deny-address stay OWED proposals — **not** this mission.

**Not this mission:** Player menu · dialogue box layout · reverse ENS on ledger/receipts · staff `*.staff.branchzero.eth` · Petra EAC deny-`setAddr` · Arc · packaging · KayKit · new payment lanes · new HTTP routes beyond session fields already in the desk pipeline.

---

## Principal intent (from review)

Luna shipped truthful bank-name surfaces (passbook row, Ash greeting, Counter pay-by-name, names board strings). Two polish gaps remain:

1. **Unclaimed name noise** — when the player has no name yet, copy still says `Bank name · not chosen yet` (passbook, Ash, Iris `done`). Honest but stiff. Omit the bank-name clause / passbook row until `has_ens_name`; optionally nudge once toward Petra instead of printing a placeholder.
2. **Tier missing from passbook** — Petra writes `bz.tier` (Silver → Gold) and the Name Desk plaque already promises “Update your passbook tier,” but the HUD passbook never shows tier. Wire the existing text-record value through the desk session into `{bank_tier}` and show it only when a name exists.

---

## Baseline facts (start here)

| Fact | Implication |
|------|-------------|
| Luna met: `{bank_name}` in `GameState.vars()`, passbook row in `hud.gd`, Ash/Iris/Counter copy | Do not rip those out — **condition** them |
| `Player.ensName` is on `/session`; **no** `ensTier` field yet | Persist tier on mint / `ensSetText` / refresh; expose on session like `ensName` |
| Mint already returns `tier: 'Silver'`; resolve can return `tier` from `getEnsText(..., 'bz.tier')` | Prefer patching the player index + session; avoid inventing a new bridge method if `/session` + existing mint/setText refresh is enough |
| MockChain already has `ens_tier` | Mirror into session vars for `?mock` |
| Working tree may still hold other WIP | Touch only ENS/passbook/copy files listed below; do not reopen player-menu or AO geometry |

### Files you will likely touch

- `apps/teller-desk/src/store.ts` — `Player.ensTier?`
- `apps/teller-desk/src/ens.ts` — `patchPlayer(..., { ensTier })` on mint + setText; refresh path if any
- `apps/teller-desk/src/server.ts` — `/session` includes `ensTier`
- `apps/web/src/bridge/branchZero.ts` — forward `ensTier` on desk session
- `apps/game/autoload/game_state.gd` — mirror session → `vars()` (`bank_tier`); conditions already have `has_ens_name`
- `apps/game/autoload/mock_chain.gd` — session payload includes tier
- `apps/game/scripts/hud.gd` — passbook: name (+ tier) only when named
- `apps/game/dialogue/strings.json` — `passbook_name` / optional `passbook_tier` / Ash strings if needed
- `apps/game/dialogue/greeter.json`, `clerk.json` — stop forcing “not chosen yet”
- `apps/game/tests/run_checks.gd`, `run_mock_walk.gd` — assert conditioned name + tier after claim / Gold update
- Light doc touch: `docs/NPCS.md` Petra/passbook one-liner if useful; OWED/REFLECTION on close

---

## Required behaviour

### A. Unclaimed name

- **Passbook:** do **not** show a “Bank name · not chosen yet” row. Either omit the row, or (optional, bank words) a single soft invite like “No bank name yet — see Petra” — pick one pattern and keep it consistent. Prefer **omit** if the passbook is already dense.
- **Ash `has_account`:** do not interpolate `{bank_name}` when unnamed. Greeting should still route to Counter / florist without a blank nameplate line.
- **Iris `done` / `loaded`:** after open or load, do not say “your bank name is not chosen yet.” Mention the name only when `has_ens_name`; otherwise leave the passbook address/balance lines as today (or one optional Petra nudge).

Use existing dialogue `if` conditions (`has_ens_name` / `!has_ens_name`) where the graph already supports them; add a start-branch or split node if a single line cannot be conditioned.

### B. Passbook tier

- When `has_ens_name`, passbook shows bank name **and** customer tier (Silver / Gold) in bank words, e.g. `Bank name · alice.branchzero.eth` + `Tier · Gold` (exact strings in `strings.json`).
- Tier source of truth remains the ENS text record / desk mirror — not a local fake. After Petra “Update my tier to Gold”, the next session refresh / `changed` signal must update the passbook without a new verb.
- Before any name is claimed: no tier row.

### C. Persistence shape (suggested)

```text
mint / ensSetText success → patchPlayer({ ensName?, ensTier })
getSession → ensName, ensTier
bridge getSession → GameState.session
vars(): bank_name, bank_tier (only meaningful when has_ens_name)
```

If `/session` already refreshes from chain for the name, prefer reading `bz.tier` once there **or** trusting the patched player field updated on every Name Desk write — record the choice in a one-line REFLECTION. Do **not** add a dedicated `ensGetTier` bridge method unless the session path cannot carry it.

---

## Constraints

- Runtime: `@bloxchain/sdk` + `viem` only. Godot never holds keys / never talks RPC.
- Everyday bank words on passbook / Ash / Iris. Protocol (`bz.tier`, AccountBlox) stays in Ask why.
- Preserve Luna surfaces: Counter pay-by-name, names board strings SoT, Bob wait-only, Priority, FX Sepolia-only, ARC coming soon.
- No new ENS contracts. No mainnet. No staff registry. No reverse-resolution on the ledger in this pass.
- Do not commit secrets. Do not “fix” player-menu AO geometry checks by editing menu placement.
- Prefer not forcing a Godot re-export solely for this — note if next scheduled export is enough.
- Do not reopen or regress the met player menu (title / Esc visitor's card).

## Evidence / DoD

- [x] Unnamed account: Ash + Iris + passbook do **not** show “not chosen yet” / empty nameplate noise
- [x] After claim (mock walk): passbook shows bank name + Silver (or whatever mint sets)
- [x] After Gold update (mock): passbook tier flips to Gold without a new bridge verb
- [x] `/session` (or MockChain session) carries `ensTier`; TypeScript types compile
- [x] `run_checks` copy/ENS assertions updated and green for these behaviours
- [x] `run_mock_walk` covers name+tier passbook (or a small focused walk); 0 new failures
- [x] Handoff → **met**; OWED row; one REFLECTION line

## Out of scope

Reverse names on ledger/receipts · staff directory · EAC deny-address teaching beat · player menu · packaging · Arc · rewriting DEMO-SCRIPT · Luna’s already-met dialogue jargon pass (unless a line you touch still leaks protocol on the main path — then fix that line only).
