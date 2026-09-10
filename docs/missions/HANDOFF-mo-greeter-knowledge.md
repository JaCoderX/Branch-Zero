---
type: handoff
title: Handoff — Mo the greeter knowledge graph
audience: cold agent (Codex Luna)
created: 2026-09-10
product: Branch-Zero
mission: Expand Mo (greeter.json) from thin router into a hub-and-spoke conversation knowledge graph — bank services + optional sponsor/tech Ask-why — without stealing desk verbs or competing with the iNPC
kickoff: docs/missions/KICKOFF-mo-greeter-knowledge.md
status: met
parallel_to: Help keep the branch open · U7 packaging (gated) · iNPC principal grounding walk — this unit is copy/graph only
---

# Handoff — Mo the greeter knowledge graph

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna**.

**Kickoff (paste):** [`KICKOFF-mo-greeter-knowledge.md`](./KICKOFF-mo-greeter-knowledge.md)

**Baseline audit (2026-09-10):** Mo’s graph in `apps/game/dialogue/greeter.json` is ~8 nodes — booting / no_account / has_account / pending + one lore hop + one vault hop. That matches historical `docs/NPCS.md` §4.1 (“routing, tutorial pacing”) but under-serves players who want to deepen on **the bank** and **the stack** from the lobby.

**Not this mission:** Rewriting Ines / Dev / Kenji / Petra Ask-why essays · turning Mo into a write lane · iNPC prompt/pack redesign as primary work · gas paymaster / 4337 sponsorship · Arc revive · U7 ship packaging · GameLab ENG-* · protocol Solidity · DEMO-SCRIPT end-to-end rewrite · dialogue *box layout* (already met).

---

## Principal intent

Make Mo the lobby’s **curated knowledge hub**:

1. **Bank layer (main path)** — what desks exist, what each does in everyday bank words, where to walk.
2. **Stack / sponsor layer (Ask why only)** — how those desks are powered (Privy, ENSv2, Uniswap v4, Bloxchain account / timelock / broadcaster) without jargon on the greeting line.
3. **Always hand off** — Mo explains and points; staff at desks still own the verbs (sign in, pay, wire, release, claim name, swap).

He stays **read-only** (no on-chain identity, no actions). Deterministic JSON graph — not a second LLM. The service assistant (`docs/INPC.md`) remains the freeform Q&A path.

---

## Voice rules (non-negotiable)

From [`docs/GAME-DESIGN.md`](../GAME-DESIGN.md) §1 and [`docs/NPCS.md`](../NPCS.md) §3:

| Surface | Allowed |
|---------|---------|
| Main dialogue path | Everyday **bank** words |
| “Ask why” nodes | Protocol + sponsor product names OK |
| Tone | Dry humour; never mock the player; max ~2 sentences per line |

**“Sponsor” here = ETHOnline partners** (Privy · ENS · Uniswap; Arc listed / elevator “coming soon”) — **not** gas sponsorship / paymasters. If a player asks who pays the fee on a stamp, Mo may say (under Ask why) that the teller’s desk broadcasts and pays gas for routine slips; do not invent account-abstraction sponsorship.

No overclaim that Branch Zero is an official Bloxchain / Particle product.

---

## Design lock

| Lock | Implication |
|------|-------------|
| **Hub-and-spoke** | From ready-to-talk entries (`no_account` / `has_account` / `pending`), offer a small hub — not a single vault question |
| **Choice budget** | Cap top-level hub rows (~5–6). Put overflow under “More about the building” / “Who powers the desks?” so dialogue box fit stays safe |
| **Desk Ask-why stays authoritative** | Ines owns Privy depth; Kenji owns Uniswap depth; Petra owns ENS depth; Dev owns Lane A/B depth. Mo = **one beat + send them to the desk** |
| **Conditioned routing** | Soft-bias with existing `GameState.facts()`: `!has_account` → Ines; `pending>0` → Bob / Okafor; `!has_ens_name` → Petra invite; never print bank name unless `has_ens_name` |
| **FX honesty** | Sepolia-only exchange; bank words first; Uniswap v4 name only in Ask why |
| **iNPC coexistence** | Optional short pointer to the service assistant kiosk; do not duplicate the full `TEACHING_PACK` |
| **No new bridge verbs** | Copy + conditions + `{vars}` only |

---

## Recommended graph (target shape)

Keep the three starts. Replace thin choice lists with a hub:

```text
hub_tour  (or inline choices on no_account / has_account / pending)
  ├─ How does this bank work?     → lore (keep / deepen; Back to hub)
  ├─ What desks are open?         → directory
  ├─ How do I open an account?    → Ines route (+ Ask why → Privy one-beat)
  ├─ Payments & the vault         → Counter / Vault / Manager (+ existing vault tech)
  ├─ Bank names                   → Petra (+ Ask why → ENSv2 one-beat)
  ├─ Currency exchange            → Kenji (+ Ask why → Uniswap v4 one-beat)
  ├─ Who built the rails?         → partners strip (bank voice; Ask why → sponsor names)
  └─ Thanks.                      → end
```

**Directory (bank → Ask why):**

| Choice | Bank line (main) | Ask why (one beat) |
|--------|------------------|--------------------|
| Account Opening · Ines | Sign in once, consent once | Privy embedded wallet + scoped session signer + policy |
| Counter · Dev | Small payments clear now; big ones go to the vault | Meta-tx; teller = broadcaster; desk pays gas for the stamp |
| Vault · Bob | Cooling clock, then release | Timelock / `releaseTime` (reuse / extend existing nodes) |
| Manager · Okafor | Priority hand-scan or shred | Meta-approve / cancel; Passkey for Priority |
| Name Desk · Petra | Claim `you.branchzero.eth` | ENSv2 subname + passbook text |
| FX Desk · Kenji | Practice USD → EUR \| ILS | Guarded Uniswap v4 on Sepolia; three whitelisted calls |
| Partners board | Event notice in the lobby | Pitch: Privy + ENS + Uniswap (Arc coming soon) |
| Service assistant | Optional explainer kiosk | Their key, session-only; never acts |

Reuse existing good lines (`lore_bank*`, `why_vault*`) — wire them into the hub with **Back** instead of dead-end “Got it.” where useful.

---

## Source of truth (do not invent facts)

| Topic | Read |
|-------|------|
| Desk map / stack | [`README.md`](../../README.md) “How you play” + “Under the hood” |
| Mo script today | [`docs/NPCS.md`](../NPCS.md) §4.1 — **update when graph ships** |
| Privy | [`docs/PRIVY.md`](../PRIVY.md) · Ines `clerk.json` `why_login` / `why_delegate` |
| Uniswap FX | [`docs/UNISWAP.md`](../UNISWAP.md) · Kenji `dealer.json` · FX sponsor plaque in `bank_interior.gd` |
| ENS | [`docs/ENS.md`](../ENS.md) · Petra `registrar.json` |
| Partners board | Lobby plaques (`PARTNERS · PRIVY · ENS · UNISWAP · ARC`) |
| iNPC teaching facts | `apps/web/src/inpc/pack.ts` `TEACHING_PACK` — keep Mo facts aligned if you touch both |
| Conditions / vars | `apps/game/autoload/game_state.gd` `facts()` / `vars()` |
| Graph runner | `apps/game/autoload/dialogue.gd` |

---

## What to change

1. **`apps/game/dialogue/greeter.json`** — expand to hub-and-spoke; preserve start conditions; keep booting node.
2. **`docs/NPCS.md` §4.1** — rewrite Mo’s script to match the shipped graph (cold agents read this).
3. **`apps/game/tests/run_checks.gd`** — update any greeter string pins; keep ENS unnamed quiet (`has_ens_name` discipline).
4. **Optional light sync** — if Mo’s sponsor one-beats contradict `TEACHING_PACK`, fix pack wording to match (no iNPC feature work).
5. **Close** — mark this handoff met/blocked; tick [`OWED.md`](../OWED.md); one [`REFLECTION.md`](../REFLECTION.md) line if a design call was made.

Prefer not to force `export:web` solely for JSON dialogue if the principal already hot-reloads dialogue from the pack — note if a scheduled export is enough.

---

## Verification checklist

- [x] `no_account` can reach directory + Ines route + lore without dead ends
- [x] `has_account` hub covers Counter / Vault / Name / FX / partners (directory nests the side hall)
- [x] `pending>0` still highlights Bob / Okafor and can deepen on vault
- [x] Main path has no “Privy / Uniswap / meta-transaction / GuardController” unless behind Ask why
- [x] Unnamed customers never hear “not chosen yet” / empty bank-name clauses (`has_ens_name` only)
- [x] Mo has **no** `action` / write verbs
- [x] Hub choice count stays on-screen (six raw choices; account-aware rows filter at runtime)
- [x] `run_checks.gd` has graph pins and the JSON/mock checks pass; Godot was unavailable on this host, so the headless suite is noted rather than claimed green
- [x] `NPCS.md` §4.1 matches shipped nodes
- [x] HANDOFF status set; OWED row ticked

## Closeout — 2026-09-10

`greeter.json` now has a read-only hub, a two-page desk directory, account-aware opening/payment routes, and short Ask-why spokes for the bank rails and pitch partners. No export was forced for this JSON/docs-only pass; the principal can hard-refresh `:5173` if the dialogue pack is rebuilt.

---

## Constraints

- Godot 4.5 · web Compatibility · product runtime `@bloxchain/sdk` + `viem` + Privy.
- Godot never holds keys / never talks RPC.
- Preserve: U4 freeze, Bob wait-only, Okafor Priority, FX Sepolia-only, Live Main / Dev 1337, partners board bank voice, ENS passbook polish, iNPC shell methods.
- Never commit secrets. Progress notes under `docs/progress/` (gitignored).

## Out of scope

New NPCs · new bridge HTTP · rewriting other desks’ full graphs · achievements celebration (optional later) · Walkable Treasury Desk · Help keep the branch open HUD · packaging.
