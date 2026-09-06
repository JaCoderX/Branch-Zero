# Kickoff prompt — U4 MVP freeze (G5)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. The first item (the human OTP walk)
needs a person with an inbox at the keyboard; the agent drives everything else.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U4 — MVP freeze (gate G5) ONLY.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md   (§5d is the mission)
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-06-u3-bank-shell.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-06-u2-timelock-lane.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REMOTE-EVM.md   (§1a frozen block clock)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4a bridge u3.0, §5 background tabs, §5a MockChain)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (§5 error lines)
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§6 performance budget)
9. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. Do NOT deepen @bloxchain/contracts / chain:compile.
- Do NOT wipe Remote EVM. Live block gasLimit = 16,777,216; cloneBlox already ~99% of a block.
- Godot 4.5 GDScript, web, threads OFF. Godot never holds keys / never talks RPC; no JavaScriptBridge.eval.
  Everything on-chain goes through window.BranchZero (bridge u3.0). Scene scripts never touch the bridge;
  desk actions go Dialogue → GameState.run_action → Chain.call_async.
- One wallet modal, at Account Opening. Any second modal is a bug.
- Do NOT change lane semantics, role grants, or the Privy policy shapes. A desk that needs something the bridge
  does not expose gets a bridge method over an EXISTING Teller Desk route.
- Vault clock: releaseTime from the chain, counted against the desk's serverNow, never chainNow.
- U0–U3 are DONE — do not redo scaffold, lanes, greybox, NPCs, dialogue, errors.json.
- MockChain (?mock) is for walking, never for evidence.

DoD = HANDOFF-CC §5d (G5): human walk on the real bridge recorded (one modal); every refusal shows an NPC line;
reconnect + Teller Desk restart mid-wire verified; first load measured against WORLD-3D §6; 30-second capture;
progress note + REFLECTION; HANDOFF advanced to U5.

OUT OF SCOPE: ENS (U5), Arc (U6), Uniswap, art/audio passes, new lanes or roles.

Stop when G5 met or a named blocker with fallback chosen.
```
