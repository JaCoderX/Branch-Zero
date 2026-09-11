---
title: Kickoff — SE partners board + lobby terminal
created: 2026-09-08
updated: 2026-09-08
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-partners-board.md
---

# Kickoff prompt — SE partners board + lobby terminal

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**. Escalate only if geometry, terminal proximity ranking, or batching blocks for more than one honest attempt.

**What this is:** a **small set-dressing + interactable pass** — fill the empty southeast corner with (1) a diegetic partners / event notice board and (2) a **standalone** bank terminal (no NPC) that opens the existing Terminal Console. Not ship packaging, not Arc revive, not new chain work, not a logo collage.

**Why:** Principal — SE is unused; add ETH Online / partners / Bloxchain / Particle board, **and** a public console so players are not forced to fight Iris or Walker for the computer prompt.

**Baseline:** Main wing on `http://localhost:5173`. `TERMINALS` today = manager + opening only. Desk-local sponsor plaques stay. U6 Arc **DEFERRED**. [OWED.md](../OWED.md) polish/packaging gates unchanged.

**Handoff:** [`docs/missions/HANDOFF-partners-board.md`](./HANDOFF-partners-board.md)

---

## Reflect (do not invent scope)

| Fact | Implication |
|------|-------------|
| Elevator `z=5.5`; free SE ~`(x>11, z>7)` | Board + terminal live here; face lobby (west) |
| `BankTerminal` + `terminal.json` already met | Third screen = prop + `TERMINALS` row; reuse dialogue/actions |
| AO/Mgr screens sit next to NPCs; zone radius 1.9 m | Lobby terminal must win its own walk-up without greeter/elevator steal |
| REFLECTION: bank signs; Particle ≠ Bloxchain | Separate board panels; no logo dump |
| WORLD-3D §6; eight omnis already | No ninth OmniLight |
| Terminal Console write-verb ban | Do not add pay/wire verbs to `terminal.json` |

**Semantics (locked):**

1. One composed notice board: Event → Partners → Bloxchain \| Particle.
2. One standalone lobby terminal → same Console/OBSERVER path as AO/Mgr.
3. No new NPC. No new bridge methods.
4. Arc on the strip only as a name; elevator keeps “coming soon.”

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero SE corner — (A) diegetic partners / event notice board (ETH Online 2026; Privy · ENS · Uniswap · Arc; Bloxchain panel; Particle CS panel) and (B) a standalone lobby terminal computer (no NPC) that opens the existing Terminal Console via BankTerminal + terminal.json. Bank-voiced. Readable / usable from the entrance side of the lobby.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-partners-board.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/KICKOFF-partners-board.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1 art, §2 floor plan, §6 budget)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/TERMINAL-CONSOLE.md   (as-built interactable path)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md   (§2.4 language; §3 sponsor matrix)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-CC.md   (do not regress freeze / Priority / ENS / FX / terminal / Live)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (do not wipe)

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. No new bridge methods. No keys/RPC in Godot.
- Godot 4.5 GDScript, web, threads OFF. Bridge JSON only; no JavaScriptBridge.eval.
- Board: diegetic bank signs — not a logo wall. Label3D + existing palette. Particle CS ≠ Bloxchain panels. Do not claim Branch Zero is the official Particle/Bloxchain product.
- Terminal: reuse BankTerminal + dialogue/terminal.json + open_console / observer_*. Do NOT invent a console NPC. Do NOT weaken _check_terminal write-verb ban or canvas focus on close.
- Keep manager + opening terminals and Iris "Use the desk terminal" working. Do not remove/weaken desk plaques or elevator Arc notice.
- Do not revive Arc / touch FX logic / ship packaging / character-style climb / AO desk polish files unless a shared helper must move (prefer not).
- Do not block entrance gap, elevator doors/panel, or teller escort waypoints. Place so greeter Ash does not steal the terminal prompt. No ninth OmniLight. WORLD-3D §6 budget.
- No secrets in git. Player-facing strings stay bank words.

SEQUENCE:
1. Board geometry: in apps/game/scripts/bank_interior.gd, add `_partners_board()` (or equivalent) from `_ready` after east column / lobby furniture. Anchor ~ (12.5–13.5, 1.6–2.4, 8.5–9.5), face west. Framed hierarchy: ETH Online 2026 · Branch Zero · Sep 4–16 → Privy · ENS · Uniswap · Arc → Bloxchain | Particle one-liners. Match plaque helper style; optional paper quads like ArcNoticeBoard.
2. Lobby terminal prop: place a computerScreen (name e.g. LobbyScreen) on a small desk/kiosk in the same SE pocket (~10.5–12.0, desk height, 8.5–10.0), facing the lobby walk-up. Optional "BRANCH CONSOLE" plaque. Honest collider; nudge coat rack if needed.
3. Wire interactable: in apps/game/scripts/main.gd, append TERMINALS entry e.g. ["lobby", <screen pos>, "the lobby terminal"]. Reuse existing terminal spawn path — do not fork dialogue. Confirm Space → terminal.json → openConsole; Esc/close → focusCanvas + movement.
4. Proximity: walk-test that standing at the lobby terminal prompts the computer, not Ash / elevator; AO and manager desks still prefer NPC vs terminal by distance as today.
5. Docs: short WORLD-3D §2.1 note (Partners board + lobby terminal) and/or one REFLECTION decision row. Mention in TERMINAL-CONSOLE §3/§6a that a third screen exists in the lobby if you touch that doc. CREDITS only if new assets.
6. Evidence: :5173 from entrance; optional viz_shots; local docs/progress/ note. Light run_checks if useful (third TERMINALS id / LobbyScreen present). Export/refresh web .pck if needed for :5173.

DoD:
- [ ] SE corner: composed notice board with Event → Partners → Bloxchain | Particle hierarchy, legible from entrance
- [ ] Standalone lobby terminal (no NPC): lean/Space opens terminal.json / Console; close restores movement + focusCanvas
- [ ] Manager + opening terminals and Iris desk-terminal choice still work; OBSERVER write-verb ban unchanged
- [ ] Desk-local sponsor plaques + elevator Arc notice unchanged in meaning
- [ ] No trademark logo collage; bank wording; no new bridge methods; no ninth omni; paths unblocked
- [ ] Progress note filed; optional viz shots

OUT OF SCOPE: board URL click-outs, new NPCs/zones, new terminal semantics, ship packaging, DEMO-SCRIPT rewrite, sponsor forms, U6 Arc, FX/ENS/Privy logic changes, character-style climb, GameLab ENG trees, bloxchain.app SaaS, protocol Solidity.

Stop when DoD met or a named blocker with the smallest honest fallback (e.g. Label3Ds only for the board; kit computerScreen on a box desk for the terminal).
```

---

## After this pass

- Tick the OWED §5 explore item when DoD is met.
- Point `HANDOFF-CC.md` at the progress note only if the principal wants the main index updated.
- Do not merge this scope into ship packaging or character-style climb.
