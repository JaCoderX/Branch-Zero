---
title: Kickoff prompt — Ash the greeter knowledge graph
created: 2026-09-10
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-mo-greeter-knowledge.md
---

# Kickoff prompt — Ash the greeter knowledge graph

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** expand Ash (`apps/game/dialogue/greeter.json`) from a thin router into a **hub-and-spoke conversation knowledge graph** — bank services on the main path, sponsor/tech under Ask why — then update `docs/NPCS.md` §4.1 and any `run_checks` pins.

**Why:** Players who stop at the greeter get almost no path to deepen on desks or the stack. Desk Ask-why (Iris/Privy, Johnny/Uniswap, Petra/ENS) already exists; Ash should **orient and point**, not replace those essays. Official pitch partners: Privy + ENS + Uniswap (Arc coming soon).

**Baseline:** `greeter.json` ~8 nodes (lore + vault only). Main wing `:5173` mock or Live. Dialogue box fit already met.

**Handoff:** [`HANDOFF-mo-greeter-knowledge.md`](./HANDOFF-mo-greeter-knowledge.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Ash has no on-chain identity | Read-only graph; no `action` verbs |
| Design pillar: bank words first | Privy / Uniswap / meta-tx only in Ask why |
| “Sponsor” = ETHOnline partners | Not gas paymasters / 4337 |
| Desk Ask-why already deep | Ash = one beat + send to desk |
| Hub menus get long | Cap ~5–6 top choices; nest “More…” |
| iNPC has `docs/game-knowledge/` teaching pack | Align facts; don’t rebuild freeform chat in JSON |
| `has_ens_name` polish shipped | Never print unnamed placeholders |
| Dialogue box fit met | Don’t regress with huge choice lists |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — Ash the greeter knowledge graph.
(1) Expand apps/game/dialogue/greeter.json into a hub-and-spoke graph: bank desks / services on the main path; Ask why for Privy, ENSv2, Uniswap v4, Bloxchain timelock/broadcaster, partners strip.
(2) Soft-route with existing GameState.facts() (no account → Iris; pending → Bob/Walker; !has_ens_name → Petra invite; has_ens_name only for bank-name lines).
(3) Update docs/NPCS.md §4.1 to match; keep run_checks greeter/ENS pins honest.
Ash explains and points. Staff keep the verbs. Do not steal Iris/Johnny/Petra/Eve Ask-why depth.

Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-mo-greeter-knowledge.md
2. docs/missions/KICKOFF-mo-greeter-knowledge.md
3. apps/game/dialogue/greeter.json (baseline)
4. docs/NPCS.md §3 + §4.1 · docs/GAME-DESIGN.md §1
5. README.md “How you play” + “Under the hood”
6. Skim: clerk.json why_login/why_delegate · dealer.json FX Ask why · registrar.json · apps/web/src/inpc/pack.ts TEACHING_PACK · game_state.gd facts()/vars() · HANDOFF-copy-ens-refinement voice rules

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Codex Luna. Product repo only (Branch-Zero). No GameLab ENG-*. No protocol Solidity.
- Everyday bank words on main path. Protocol + sponsor product names only in Ask why.
- Sponsor = Privy / ENS / Uniswap (Arc listed / coming soon). Not gas sponsorship.
- Ash: no write actions. Cap hub choices; use Back to hub; preserve booting + start conditions.
- Desk Ask-why remains authoritative — Ash one-beat then point to the desk.
- Preserve ENS unnamed quiet, Bob wait-only, Counter singular, FX Sepolia-only, Live/Dev, partners board bank voice, iNPC as optional pointer only.
- Prefer not to force export:web for JSON-only; note if needed.
- Never commit secrets. Progress under docs/progress/ (gitignored).
- Do not start Help keep the branch open, U7 packaging, Arc, or iNPC feature work in this mission.

SEQUENCE:
1. Inventory — current greeter nodes + facts available for conditions.
2. Design hub — list choice labels (≤6 top-level) + spoke nodes; reuse lore_bank* / why_vault*.
3. Implement greeter.json — Back links; Ask why siblings; conditioned lines.
4. Docs — NPCS.md §4.1 script rewrite.
5. Verify — run_checks when Godot host available; mock walk no_account hub → Iris pointer; has_account hub → FX/partners Ask why; pending → vault.
6. Optional — TEACHING_PACK one-line fact sync if Ash contradicts it.
7. Close — HANDOFF status met/blocked; tick OWED; one REFLECTION line if a design call was made.

DoD:
- [ ] Hub reachable from no_account / has_account / pending
- [ ] Directory covers Iris, Counter, Vault, Manager, Petra, Johnny (nested OK)
- [ ] Ask why covers Privy, Uniswap v4, ENS, vault timelock, partners — without main-path jargon leak
- [ ] No Ash write verbs; unnamed customers stay quiet on bank name
- [ ] NPCS.md §4.1 matches; run_checks green or host noted unavailable
- [ ] OWED + handoff status updated

STOP AND ASK if: you want Ash to open overlays / run bridge actions; hub needs new GameState facts; you would rewrite other NPC graphs; packaging or forced re-export seems required mid-pass.
```

---

## After

Principal: hard-refresh `:5173` if the pack was rebuilt; talk to Ash with no account, with account, and with a pending wire. Confirm the hub teaches desks in bank words and Ask why names Privy / Uniswap / ENS without turning Ash into a clerk.
