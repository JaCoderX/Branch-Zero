# Kickoff prompt — U3 Bank shell (G4)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck on Godot web export or the bridge after one honest attempt.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U3 — Bank shell (gate G4) ONLY.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-06-u2-timelock-lane.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REMOTE-EVM.md   (§1a frozen block clock)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GAME-DESIGN.md
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4 bridge table, §5 background tabs)
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (§5 error lines)
9. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ARCHITECTURE.md   (§3.3 Lane B as built)
10. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. Do NOT deepen @bloxchain/contracts / chain:compile.
- Do NOT wipe Remote EVM. Live block gasLimit = 16,777,216; cloneBlox already ~99% of a block.
- Godot 4.5 GDScript, web, threads OFF. Godot never holds keys / never talks RPC; no JavaScriptBridge.eval.
  Everything on-chain goes through window.BranchZero (bridge u2.0).
- One wallet modal, at Account Opening. Any second modal is a bug.
- Do NOT change lane semantics, role grants, or the Privy policy shapes — U2 settled those. If a desk needs
  something the bridge does not expose, add a bridge method that calls the EXISTING Teller Desk route.
- Vault clock: render releaseTime from the chain, count against the desk's serverNow, never chainNow.
- U0–U2 are DONE — do not redo scaffold/K1/K2/K5/Lane A/Lane B.

DoD = HANDOFF-CC §5c (G4): walkable greybox (Account Opening, Counter, Vault antechamber, Manager's office);
NPCs driving the real calls through Chain.call_async; vault door clock from releaseTime; ledger board with
pending + recent receipts, reconciled on tab focus; an NPC line for every error code in NPCS.md §5; progress
note + REFLECTION update.

OUT OF SCOPE: ENS (U5), Arc (U6), Uniswap, art/audio passes, changing chain semantics.

Stop when G4 met or a named blocker with fallback chosen.
```
