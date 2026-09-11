---
type: handoff
title: Handoff — Dialogue, ENS surface, bank text refinement
audience: cold agent (Codex Luna)
created: 2026-09-10
product: Branch-Zero
objective: OBJ-2026-0004
mission: Game-creation refinement — review and improve NPC dialogue; deepen ENS across the bank where cheap and honest; replace stale / placeholder bank text
kickoff: docs/missions/KICKOFF-copy-ens-refinement.md
status: met
parallel_to: packaging gate (OWED §2 polish re-playtest) — copy/ENS only; no ship packaging
---

# Handoff — Dialogue · ENS · bank text

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna**.

**Kickoff (paste):** [`docs/missions/KICKOFF-copy-ens-refinement.md`](./KICKOFF-copy-ens-refinement.md)

**Status (2026-09-10):** **Met** — ranked audit recorded, copy wins shipped, and the passbook/name-board/pay-by-name ENS surfaces now use existing state and bridge verbs. Reverse resolution, staff directory, and EAC deny-address teaching remain OWED proposals.

**Not this mission:** Lane B Release / Privy policy · Arc revive · Uniswap pool changes · KayKit art · dialogue *box layout* (already met) · U7 ship packaging · GameLab ENG-* · protocol Solidity · mainnet ENS.

---

## Principal intent

We are in the **game-creation refinement** phase. Three linked jobs:

1. **Review all dialogues** — improve lines that are flat, jargon-leaking on the main path, stale (Bob, Counter 1/2), or misaligned with how the bank actually works now.
2. **Use ENS better across the bank** — names should feel like the account pointer everywhere it is honest, not only at Petra’s desk. Prefer surfaces already designed in [`docs/ENS.md`](../ENS.md) / WORLD-3D that are still thin or missing.
3. **Review all bank text** — world plaques, HUD/passbook/boards, forms, errors’ *player* lines. Some were placeholders; some need updates for Live/Dev, Bob, Counter (singular), FX fiat, partners board.

---

## Voice rules (non-negotiable)

From [`docs/GAME-DESIGN.md`](../GAME-DESIGN.md) §1 and [`docs/NPCS.md`](../NPCS.md) §3:

| Surface | Allowed |
|---------|---------|
| Main dialogue path, plaques, HUD, prompts | Everyday **bank** words |
| “Ask why” nodes + receipt fine print | Protocol terms OK |
| `errors.json` → `line` | Bank apology |
| `errors.json` → `why` | Technical (agents / Ask why) — leave unless wrong |

Tone: dry humour, never mocking the player. Max ~2 sentences per line. No overclaim that Branch Zero is an official Bloxchain/Particle product.

---

## Inventory (start here)

### Dialogue SoT — `apps/game/dialogue/`

| File | Speaker | Notes for review |
|------|---------|------------------|
| `greeter.json` | Ash | Routing / tutorial; check Counter wording, ENS awareness |
| `clerk.json` | Iris | Open / load / faucet / terminal; bank words on main path |
| `teller.json` | Eve | Pay / wire; pay-by-name should feel first-class |
| `vault_keeper.json` | **Bob** (not Bob) | Wait-path release only |
| `manager.json` | Walker | Priority + shredder; no post-clock stamp |
| `registrar.json` | Petra | Claim / tier / board — main path still says “AccountBlox” in places |
| `dealer.json` | Johnny | EUR + ILS; Sepolia-only honesty |
| `terminal.json` | Branch console | OBSERVER grant/revoke; bank words |
| `strings.json` | All non-NPC UI | Forms, passbook, boards, prompts, FX board |
| `errors.json` | Revert → line | Player `line` only for tone; keep codes stable |

Headless graph checks: `apps/game/tests/run_checks.gd` — keep green; update assertions if player-facing strings they pin change intentionally.

### World text — `apps/game/scripts/bank_interior.gd`

Every `plaque(...)` and template sign (`{limit}` / `{timelock}`). High-signal boards:

- Limits poster · Counter / Name Desk / FX service menus · Approved payees · Partners board · Elevator / ARC coming soon · ACCOUNT OPENING · Exterior title
- **Keep** ARC “coming soon” (product truth; `run_checks` asserts it)
- Exterior street-art easter is maker/brand credit — do not rewrite into bank marketing

### ENS today vs design

**Shipped (U5 / Live):** claim under `branchzero.eth`, `addr(60)` → AccountBlox, `bz.tier` Silver→Gold via desk, resolve + pay-by-name on slip, names board recent claims, pinned UR V2 on Sepolia.

**Designed but thin / unused** ([`docs/ENS.md`](../ENS.md) §2–4 — rank and decide):

| Idea | Likely effort | Notes |
|------|---------------|-------|
| Reverse names on ledger / receipts / payee list | Medium | WORLD-3D already sketches reverse on payees; HANDOFF-CC left “receipts in U5 or U7” open |
| Passbook / HUD show `{ens_name}` + tier from text record | Low–medium | Prefer bank words (“nameplate”, “tier”) |
| Greeter / teller / Ash lines that route by name once claimed | Low | Copy + conditions only |
| Petra EAC beat: upgrade tier OK, change address refused | Medium | Needs a real denied `setAddr` (or honest MockChain refusal) — teaching moment in ENS §4.4 |
| Staff directory `*.staff.branchzero.eth` vs RBAC | High | Stretch — propose only unless already half-built |
| Wildcard guest names | High | Stretch |

Do **not** move payments or ENS off Sepolia. Do **not** use mainnet `branchzero.eth` as a runtime register.

---

## Working method

1. **Audit first** — write a short ranked findings list into a local `docs/progress/` note (gitignored) *or* a dated REFLECTION subsection: keep / rewrite / cut / ENS-win.
2. **Implement copy wins** in dialogue JSON + plaque strings + `strings.json` / player `errors.json` lines — no bridge churn for wording alone.
3. **Implement ENS surface wins** that reuse existing bridge verbs (`ensAvailable` / `ensMint` / `ensSetText` / `resolveName` / slip pay-by-name). Stop and ask before new HTTP routes or new ENS contracts.
4. **Re-run** `run_checks` when Godot host is available; light mock walk of Ash → Iris → Petra → Counter (name on slip) → Bob/Walker one-liners if touching those graphs.
5. Mark this handoff **met** or **blocked** with OWED; one-line REFLECTION if a design call was made.

---

## Constraints

- Godot 4.5 · web Compatibility · `@bloxchain/sdk` + `viem` only at runtime.
- Godot never holds keys / never talks RPC.
- Preserve: U4 freeze, U4+ Priority, Bob wait-only, Petra Name Desk, FX Sepolia-only, Live Main / Eve 1337, partners board bank voice, exterior easter separate from interior.
- Never commit secrets. Prefer not to force a Godot re-export solely for copy — note if next scheduled export is enough; if principal is on `:5173` with an old pack, say so.
- Internal node ids (`Counter1`, etc.) may stay; **player-facing** words must stay consistent (Counter singular, Bob not Bob, Name Desk not Counter 2).

## Out of scope

New payment lanes · Arc elevator live · staff ENS registries / EAC contract deploys without principal · rewriting DEMO-SCRIPT end-to-end · packaging · character meshes · dialogue_box.gd layout · fixing Lane B opaque Release (already met).
