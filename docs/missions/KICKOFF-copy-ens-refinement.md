---
title: Kickoff prompt — Dialogue, ENS surface, bank text refinement
created: 2026-09-10
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-copy-ens-refinement.md
---

# Kickoff prompt — Dialogue · ENS · bank text

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** game-creation **refinement** — (1) review and improve all NPC dialogues, (2) deepen honest ENS use across the bank, (3) review and fix world/UI bank text (placeholders + stale lines).

**Why:** Product is feature-complete enough to polish language and make names feel central, not a side desk.

**Baseline:** Main wing on `:5173` (mock or Live). Copy SoT is JSON + plaques — not hard-coded GDScript strings (except `plaque(...)` templates in `bank_interior.gd`).

**Handoff:** [`docs/missions/HANDOFF-copy-ens-refinement.md`](./HANDOFF-copy-ens-refinement.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Design pillar: everyday bank language first | Main-path “AccountBlox / meta-transaction / GuardController” is a smell; push to Ask why |
| Vault keeper is **Bob**; Counter is singular | Any Ruth / Counter 1 / Counter 2 in player text is stale |
| ENS U5 shipped: claim, resolve, pay-by-name, `bz.tier` | Deepen *surfaces* (boards, passbook, greeter, receipts) before inventing new registries |
| ENS.md still lists reverse names, EAC deny-addr, staff directory | Rank: ship cheap wins; propose / ask for medium+ |
| ARC elevator says “coming soon” on purpose | Do not “fix” that into a live wing |
| `run_checks.gd` pins some strings | Update checks when intentional copy changes |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — game-creation refinement.
(1) Review ALL dialogue graphs; improve lines that are flat, jargon-leaking on the main path, stale, or wrong vs current bank behaviour.
(2) Review how ENS is used across the bank; deepen honest name surfaces (passbook, greeter/teller, boards, slips, receipts) using existing bridge verbs where possible.
(3) Review ALL player-visible bank text (plaques, strings.json, error `line`s, form hints); replace placeholders and update stale copy.

Freedom on HOW. No freedom on constraints.
Audit before large rewrites. Ship copy wins freely. For ENS features that need new desk routes or contracts: propose ranked options and STOP AND ASK before building.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-copy-ens-refinement.md
2. docs/missions/KICKOFF-copy-ens-refinement.md
3. docs/GAME-DESIGN.md §1 + §4 (pillars + protocol→bank words)
4. docs/NPCS.md §3–4 (dialogue style + per-NPC scripts)
5. docs/ENS.md §2–4 (naming scheme + runtime flows still thin)
6. docs/REFLECTION.md §2.4 (language / copy review)
7. Skim: apps/game/dialogue/*.json · apps/game/scripts/bank_interior.gd plaque() calls · docs/missions/HANDOFF-CC.md freeze notes (do not regress)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Codex Luna. Product repo only (Branch-Zero). No GameLab ENG-*. No protocol Solidity. No mainnet ENS runtime.
- Everyday bank words on main path / plaques / HUD. Protocol jargon only in "Ask why" and receipt fine print.
- Player-facing consistency: Bob (not Ruth); Counter (not Counter 1/2); Name Desk for Petra; ARC floor stays "coming soon".
- Preserve U4 freeze, U4+ Priority (Okafor), Bob wait-only release, FX Sepolia-only, Live Main / Dev 1337, partners board bank voice, exterior easter separate.
- Runtime deps stay @bloxchain/sdk + viem. Godot never holds keys / never talks RPC.
- Prefer existing bridge: ensAvailable / ensMint / ensSetText / resolveName / payment slip pay-by-name. No new HTTP routes without asking.
- errors.json: improve player `line` tone if needed; keep error codes stable; do not gut technical `why` unless factually wrong.
- Never commit secrets (.env, keys). Local progress notes under docs/progress/ (gitignored).
- Do not start U7 ship packaging, Arc revive, Lane B Privy policy work, or KayKit art in this mission.

SEQUENCE:
1. Inventory — list every dialogue file + major plaque/UI string buckets; note smells (jargon on main path, stale names, placeholders, ENS gaps).
2. Dialogue pass — rewrite keep/cut/improve; preserve graph structure (actions, conditions, Ask why siblings) unless a node is clearly dead.
3. Bank text pass — plaques in bank_interior.gd + strings.json + form placeholders/hints; keep {limit}/{timelock} interpolation honest.
4. ENS pass — implement cheap surface wins (copy + existing resolve/mint/setText/slip). Rank medium/high ideas (reverse on ledger/receipts, EAC deny-addr demo, staff directory); implement only what reuses current verbs OR ask first.
5. Verify — run_checks.gd when Godot 4.5 host available; light mock walk Mo → Ines → Petra → Counter (pay by name) → Bob/Okafor lines you touched.
6. Close — mark HANDOFF status met/blocked; append OWED / one REFLECTION line if a design call was made.

DoD:
- [ ] Written audit (progress note or REFLECTION) with ranked dialogue + ENS + text findings
- [ ] Main-path dialogue no longer leaks protocol nouns that belong in Ask why (spot-check all NPCs)
- [ ] No player-facing Ruth / Counter 1 / Counter 2 / wrong vault role
- [ ] At least one tangible ENS-across-bank improvement beyond Petra-only copy (e.g. passbook nameplate, greeter awareness, board/receipt reverse or clearer pay-by-name), OR a clear blocked proposal with OWED
- [ ] Plaques + strings.json reviewed; obvious placeholders / stale service menus updated
- [ ] run_checks green (or noted host unavailable) ; no freeze / Priority / FX / Live-Dev regressions

STOP AND ASK if: you want new ENS contracts or staff registries; EAC deny-addr needs desk changes beyond MockChain; reverse resolution needs new bridge methods; a rewrite would touch DEMO-SCRIPT beat structure; packaging or a forced re-export seems required mid-pass.
```

---

## After

Principal: hard-refresh `:5173` if the web pack was rebuilt; walk Mo → Petra claim (or existing name) → Counter pay-by-name → glance plaques (Name Desk, Counter, FX, partners, elevator). Confirm names feel like the bank’s pointer, not a side quest.
