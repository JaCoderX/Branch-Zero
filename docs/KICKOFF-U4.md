# Kickoff prompt — U4 MVP freeze (G5)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck on
reconnect/SSE or web export after one honest attempt.

**Parallel labs (do not wait on them; do not edit them):** GameLab
[ENG-2026-0010](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0010-express-dual-control/KICKOFF.md)
(Express dual-control) and
[ENG-2026-0011](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0011-privy-step-up/KICKOFF.md)
(Privy step-up). Express is **out of U4 scope** — labs only.

The human OTP walk needs a person with an inbox at the keyboard. As of **2026-09-07**, a principal playtest got
through **real-bridge Pay + Wire** (owner `0x7954…` / account `0x9C01…`) after **Re-check account** synced roles
(`configured` / `roleSet` had been missing). Greybox *feel* is good — protect it; no art. Confirm whether
wire → door → release evidence is already logged before inventing a second walk.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U4 — MVP freeze (gate G5) ONLY.
Freedom on HOW. No freedom on constraints.
Parallel GameLab ENG-0010 / ENG-0011 may run elsewhere — do NOT edit GameLab; do NOT build Express / step-up here.

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
- One wallet modal, at Account Opening. Any second modal is a bug (Express step-up is a lab question, not U4).
- Do NOT change lane semantics, role grants, or the Privy policy shapes. A desk that needs something the bridge
  does not expose gets a bridge method over an EXISTING Teller Desk route.
- Vault clock: releaseTime from the chain, counted against the desk's serverNow, never chainNow.
- U0–U3 are DONE — do not redo scaffold, lanes, greybox layout, NPCs, dialogue trees, or errors.json wholesale.
- MockChain (?mock / ?mock=account) is for walking and kill UX, never for G5 evidence.
- Protect the principal's "nice feel" verdict: no art/audio pass, no zone redesign, no kit meshes (that is U7).
  Tiny copy/grammar and error-path fixes are in scope.
- Do NOT implement Express dual-control or Privy OTP-on-approve — those are ENG-0010 / ENG-0011.

CARRY-FORWARD (cheap, in scope):
- HOTFIX FIRST if playtest is blocked: after clicking the React debug overlay / Privy UI, keyboard+mouse must
  return to the Godot canvas without reload. Likely: #overlay > * steals hits; click on #game/#canvas (and after
  modal close / pill collapse) must canvas.focus(). See apps/web/index.html pointer-events rules.
- laneB / mock stage line: "The manager are opening the vault…" → correct subject/verb (`laneB.ts`).
- After provision, players.json must get configured:true + roleSet (Re-check /provision syncs roles; wire fails
  with NoPermission if role sync never finished) — fix write path if still flaky; do not wipe the file.
- Keep the HTML overlay as a collapsed debug pill unless the human says cut it.

SEQUENCE:
0. Canvas re-focus hotfix — verify: click debug pill → click bank → WASD/E work again.
1. Ask the human whether OTP walk (sign in → consent → open → pay → wire → door → release) is logged with
   account / txIds / hashes and one-modal proof. Coach + record if not. Real bridge only for G5 evidence.
2. Error UX: provoke refusals; kill Teller Desk mid-session for TIMEOUT / RPC; NPCS.md §5 / errors.json only.
3. Reconnect: SSE drop → board reconciles; Teller restart mid-wire → watcher re-arms; clock from releaseTime.
4. Measure first load (wasm + pck + shell) vs WORLD-3D §6; obvious wins only. Record numbers.
5. 30-second capture of vault clock + door (tab visible — hidden pane freezes Godot rAF).
6. Progress note + REFLECTION; advance HANDOFF-CC to U5 + docs/KICKOFF-U5.md.
   Optional REFLECTION bullet only: Express deferred to lab ENG-0010/0011 → U6+ if both yes.

DoD = HANDOFF-CC §5d (G5) PLUS canvas re-focus after overlay interaction:
human walk recorded (one modal); NPC lines on refusals; reconnect verified; first load measured;
30-second capture; canvas focus restored after overlay; progress note + REFLECTION; HANDOFF → U5.

OUT OF SCOPE: ENS (U5), Arc (U6), Express desk, Privy step-up productization, Uniswap, art/audio, new lanes,
rebuilding greybox, wiping Remote EVM, editing GameLab ENG folders.

Stop when G5 met or a named blocker with fallback chosen.
```
