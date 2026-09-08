---
title: Kickoff — SE partners notice board (ETH Online · sponsors · Bloxchain · Particle)
created: 2026-09-08
product: Branch-Zero
model: Codex Luna
handoff: docs/HANDOFF-partners-board.md
---

# Kickoff prompt — SE partners notice board

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**. Escalate only if geometry or batching blocks for more than one honest attempt.

**What this is:** a **tiny set-dressing pass** — fill the empty southeast corner with one diegetic **partners / event notice board**. Not ship packaging, not Arc revive, not new chain work, not a logo collage.

**Why:** Principal review — east–south of the bank (south of the elevator, east of the entrance) is unused; use it for ETH Online framing, featured partners, a Bloxchain panel, and a Particle CS panel — bank-voiced, readable from spawn.

**Baseline:** Main wing on `http://localhost:5173` (mock or live). Desk-local sponsor plaques stay. U6 Arc **DEFERRED**. Polish / packaging gates unchanged ([OWED.md](./OWED.md)).

**Handoff:** [`docs/HANDOFF-partners-board.md`](./HANDOFF-partners-board.md)

---

## Reflect (do not invent scope)

| Fact | Implication |
|------|-------------|
| Elevator at `z=5.5`, shaft `[4,7]`; south wall `z≈11`; east wall `x≈15` | Free wall/floor is ~`(x>11, z>7)` — place board there, facing west |
| Entrance gap `x∈[3,7]`; Branch Zero lintel plaque at `(5, 3.5, south)` | Do not cover the entrance plaque or block the door |
| Coat rack `(8.6, 9.9)`, cooler `(8.0, 4.5)` | May nudge props slightly; do not crowd the walk to the elevator |
| FX / AO / Name Desk / Arc already carry sponsor teaching | This board **complements**; do not delete or weaken desk plaques |
| REFLECTION: bank signs not logos; max three in pitch; Particle ≠ Bloxchain | Separate panels; short bank copy; no trademark logo dump |
| WORLD-3D §6 web budget | BoxMesh + palette + `Label3D`; bake with static batch; no new OmniLight |
| v1 = set dressing | No new bridge methods; click-out URLs optional later |

**Semantics (locked):**

1. One composed notice board in the SE corner.
2. Hierarchy: **ETH Online 2026** → **featured partners strip** → **Bloxchain** \| **Particle CS**.
3. Diegetic frame: partners / community notices of the branch — not a trade-show booth.
4. Arc on the strip only as a name; elevator keeps “coming soon.”

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero set dressing — fill the unused southeast corner (south of the elevator, east of the entrance) with one diegetic partners / event notice board showing (1) ETH Online 2026, (2) featured partners Privy · ENS · Uniswap · Arc, (3) a Bloxchain protocol panel, (4) a Particle CS company panel. Bank-voiced copy. Readable from the entrance.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-partners-board.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-partners-board.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1 art, §2 floor plan, §6 budget)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md   (§2.4 language; §3 sponsor matrix)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md   (do not regress freeze / Priority / ENS / FX / terminal / Live)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (do not wipe)

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. No new bridge methods. No keys/RPC in Godot.
- Godot 4.5 GDScript, web, threads OFF. Bridge JSON only; no JavaScriptBridge.eval.
- Diegetic bank signs — not a logo wall. Prefer Label3D + existing palette (Brass / Paper / Graphite / Marble). No imported trademark logos unless CREDITS.md + licence allows and they stay secondary.
- Particle CS = company; Bloxchain = open protocol. Separate panels. Do not claim Branch Zero is the official Particle/Bloxchain product.
- Do not remove or weaken desk plaques (AO Privy tone, Name Desk ENS, FX Uniswap, elevator Arc notice).
- Do not revive Arc / touch FX logic / ship packaging / character-style climb / AO desk polish files unless a shared helper must move (prefer not).
- Do not block entrance gap, elevator doors/panel, or teller escort waypoints. No ninth OmniLight. Stay inside WORLD-3D §6 budget.
- No secrets in git. Player-facing strings stay bank words.

SEQUENCE:
1. Geometry: in apps/game/scripts/bank_interior.gd, add a `_partners_board()` (or equivalent) called from `_ready` after east column / lobby furniture. Anchor ~ (12.5–13.5, 1.6–2.4, 8.5–9.5), yaw facing west (−PI/2 or look toward lobby). Keep clear of elevator west face (x≈11.46, z≈5.5) and south entrance. Nudge coat rack if needed.
2. Build one framed board: header (ETH Online 2026 · Branch Zero · Sep 4–16), partners strip (Privy · ENS · Uniswap · Arc), two lower panels (Bloxchain open-protocol one-liner | Particle CS trust-infra one-liner). Match plaque helper style already in bank_interior.gd. Optional thin paper quads behind labels like ArcNoticeBoard.
3. Copy: short, bank-voiced. Example tone — "Partners of this branch" / "Governed accounts — open protocol" / "Built by Particle Crypto Security". Event line may cite ETH Online without turning the lobby into a booth.
4. Docs: one short note under WORLD-3D §2.1 (new row or footnote: Partners board, SE, set dressing) OR a single REFLECTION decision row — do not rewrite sponsor matrix. Update CREDITS only if new assets.
5. Evidence: walk :5173 from entrance; optional viz_shots entry; local docs/progress/ note (gitignored). Export/refresh web build if .pck must pick up Godot changes for :5173.
6. Checks: if run_viz_budget or run_checks assert prop counts, update only as needed; keep green when Godot 4.5 host available.

DoD:
- [ ] SE corner has a single composed notice board; empty dead space filled without blocking paths
- [ ] From entrance / lobby: readable hierarchy Event → Partners → Bloxchain | Particle
- [ ] Desk-local sponsor plaques + elevator Arc notice unchanged in meaning
- [ ] No trademark logo collage; bank wording; Particle ≠ Bloxchain panels
- [ ] No new bridge methods, no Arc revive, no budget regression (no new shadow light / ninth omni)
- [ ] Progress note filed; optional viz shot

OUT OF SCOPE: URL click-out system, new NPCs/zones, ship packaging, DEMO-SCRIPT rewrite, sponsor feedback forms, U6 Arc, FX/ENS/Privy logic, character-style climb, GameLab ENG trees, bloxchain.app SaaS, protocol Solidity.

Stop when DoD met or a named blocker with the smallest honest fallback (e.g. four Label3Ds on one brass frame if SubViewport is overkill).
```

---

## After this pass

- Tick the OWED §5 explore item when DoD is met.
- Point `HANDOFF-CC.md` at the progress note only if the principal wants the main index updated.
- Do not merge this scope into ship packaging or character-style climb.
