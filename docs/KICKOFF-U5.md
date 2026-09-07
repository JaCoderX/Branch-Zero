# Kickoff prompt — U5 ENS (G6)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck on
ENSv2 Sepolia contract wiring after one honest attempt.

**Before this unit:** U4+ Priority release (G5b) must be **met**. Kickoff for that unit: [`docs/KICKOFF-U4-plus.md`](./KICKOFF-U4-plus.md). GameLab **ENG-2026-0007** (ENSv2 subnames on Sepolia) must have a `handoff.md` with a yes. If it
does not, the first task is to run that kill test — in the lab, not here. **Do not edit GameLab ENG-0010–0013.**
Priority / Passkey / meta-bypass are **out of U5** (already a prior unit).

The MVP is frozen (U4 / G5, 2026-09-07) plus U4+ if G5b is met. Nothing in U5 may regress: one Account Opening
modal, Priority Passkey only on Okafor’s bypass, canvas focus after any overlay, `desk.link` reconnect, NPC lines
for every refusal, `.pck` + `.wasm` sizes as measured. Run
`godot --headless --path apps/game -s tests/run_checks.gd`, `npm run typecheck` and the two kill-test scripts before
you call G6.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U5 — ENS (gate G6) ONLY.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md   (§5f is the mission; U4+ must already be met)
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u4-mvp-freeze.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ENS.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md   (chain policy: ENS lives on Sepolia)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4 bridge table — ensAvailable / ensMint / ensSetText / resolveName, §4a, §5b canvas focus)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (§4.6 Petra, §5 error lines)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SECURITY-AND-KEYS.md   (registrar key is a bank key, never a player key)
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md
9. GameLab ENG-2026-0007 findings.md + handoff.md (behaviour, not files)

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (Lane A/B stay here)

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY, plus whatever ENS client ENG-0007 proved (note it in REFLECTION §8 — no
  new dependency without a decision-log row).
- ENS on Sepolia; payments stay on Remote EVM 1337. A name resolves to an address; the bank pays that address on 1337.
  Never move Lane A/B to Sepolia for this.
- Do NOT wipe Remote EVM. Do NOT touch lane semantics, role grants, Privy policy shapes, or the one-modal rule.
- Godot 4.5 GDScript, web, threads OFF. Everything on-chain goes through window.BranchZero. New bridge methods
  (ensAvailable / ensMint / ensSetText / resolveName) sit over NEW Teller Desk routes /ens/* — these are the routes
  U2 left as 501 "planned U5"; scene scripts never touch the bridge (Dialogue → GameState.run_action → Chain.call_async).
- The registrar key is the bank's (Teller Desk env), never the player's. The player's name points at THEIR account.
- Every new error code gets a line in apps/game/dialogue/errors.json; run_checks.gd must stay green.
- Never use Ganache-parity keys on Sepolia. No secrets in git.
- Protect the frozen feel: no art/audio pass, no zone redesign (U7). Petra's Name Desk exists as signage — it becomes a
  desk with an NPC and a name-claim form (payment_slip.gd is the pattern).
- MockChain answers the new methods too (canned availability / mint), never for G6 evidence.

SEQUENCE:
0. Confirm ENG-0007 says yes and which registry / resolver / client it used. If no — run the lab, not the product.
1. Teller Desk: /ens/available, /ens/claim (mint subname under the bank's parent → player's account), /ens/record
   (setText bz.tier etc.), /ens/resolve. Sepolia RPC + registrar key in env.
2. Bridge u5.0: the four methods over those routes; codes survive the fetch boundary.
3. Godot: Petra at the Name Desk (NPCS.md §4.6), name-claim form, names board (SubViewport like the ledger board),
   payment slip accepts a name (resolve → address; refuse with a line if it does not resolve).
4. Kill tests: mint → resolve → pay-by-name on 1337; a taken name is refused with Petra's line.
5. Progress note + REFLECTION; HANDOFF → U6 + docs/KICKOFF-U6.md.

DoD = HANDOFF-CC §5f (G6).

OUT OF SCOPE: Arc (U6), Priority / Passkey / meta-bypass (U4+), Uniswap, art/audio, greybox redesign, wiping Remote EVM,
editing GameLab ENG folders, ENS on mainnet.

Stop when G6 met or a named blocker with fallback chosen (cut order: ENS EAC before ENS mint — see DEV-LOOP §5).
```
