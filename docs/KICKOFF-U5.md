# Kickoff prompt — U5 ENS (G6)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck on
ENSv2 Sepolia contract wiring after one honest attempt.

**Before this unit:** U4+ Priority release (G5b) is **met**. GameLab **ENG-2026-0007** is **partial** (2026-09-07 dig):
viem resolve works; Universal Resolver answers `branchzero.eth` → `0xc4d7…49277`; **ENSv2** `ETHRegistry.ownerOf`
is still **zero** and product `ENS_REGISTRAR_PK` was empty. Mainnet `branchzero.eth` is brand-only (separate wallet).

**First task if mint evidence is still missing:** finish K6 in GameLab (fill testnet `ENS_REGISTRAR_PK`, ENSv2
`ETHRegistrar` commit/reveal until `npm run dig` shows non-zero owner, UserRegistry + mint `test.branchzero.eth`).
Do **not** invent Sepolia ownership. **Do not edit GameLab ENG-0010–0013.** Priority / Passkey are out of U5.

U5 may **scaffold** `/ens/*` + resolve + Petra in parallel once the dig/handoff shape is understood; **do not claim G6
mint DoD** until ENG-0007 mint is yes. Freeze intact: one Account Opening modal, Priority Passkey only on Okafor,
canvas focus, `desk.link`, error lines, measured `.pck`/`.wasm`.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U5 — ENS (gate G6) ONLY.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md   (§5f; U4+ met; ENG-0007 partial)
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-pre-u5-closeout.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ENS.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md   (ENS = Sepolia; payments = 1337)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4 ens* methods, §5b canvas focus)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (§4.6 Petra, §5 errors)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SECURITY-AND-KEYS.md   (registrar = bank key; never mainnet key)
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md   (K6 partial row)
9. GameLab ENG-2026-0007 findings.md + handoff.md + run `npm run dig` in that folder (behaviour)

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0007-ensv2-subname-mint
- Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (Lane A/B stay here)

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY (+ ENS client already proven: viem getEnsAddress against Universal Resolver proxy 0xeEeE…EeEe). Note any new dep in REFLECTION §8.
- ENS on Sepolia; payments stay on Remote EVM 1337. Resolve name → address → pay that address on 1337.
- Parent label: branchzero. Mainnet ownership is brand-only — never put the mainnet wallet key in Teller Desk env.
- ENSv2 parent must show non-zero ETHRegistry.ownerOf before claiming mint works (dig-parent). A Universal Resolver address alone is not ENSv2 ownership.
- Do NOT wipe Remote EVM. Do NOT touch lane semantics, role grants, Privy policy, or the one-modal rule (Priority Passkey exception already shipped).
- Godot 4.5 GDScript, web, threads OFF. Bridge only: ensAvailable / ensMint / ensSetText / resolveName over NEW /ens/* desk routes. Dialogue → GameState.run_action → Chain.call_async.
- Registrar key = ENS_REGISTRAR_PK (Sepolia throwaway + MockUSDC). Never Ganache-parity keys on Sepolia. No secrets in git.
- Every new error code → apps/game/dialogue/errors.json; run_checks.gd green. MockChain answers ens* for greybox only — never for G6 evidence.
- No art/audio/zone redesign (U7). Petra Name Desk: NPC + name-claim form (payment_slip.gd pattern) + names board.

SEQUENCE:
0. Run GameLab `npm run dig`. If ENSv2 owner is zero or ENS_REGISTRAR_PK empty: finish K6 in the lab first (register on ETHRegistrar, UserRegistry, mint test.branchzero.eth, resolve). Update ENG findings/handoff to yes. Then continue.
1. Teller Desk: /ens/available, /ens/claim, /ens/record, /ens/resolve. Pin addresses from ENG handoff / infra/deployments/sepolia.json.
2. Bridge u5.0: four methods; codes survive fetch boundary; focusCanvas after any overlay.
3. Godot: Petra (§4.6), claim form, names board, slip accepts name (resolve → address; refuse with her line).
4. Kill tests: mint → resolve → pay-by-name on 1337; taken name refused.
5. Progress note + REFLECTION; HANDOFF → U6 + docs/KICKOFF-U6.md.

DoD = HANDOFF-CC §5f (G6).

OUT OF SCOPE: Arc (U6), Priority/Passkey (U4+), Uniswap, art/audio, greybox redesign, wiping Remote EVM, editing ENG-0010–0013, ENS mainnet runtime, merging GameLab ENG trees.

Stop when G6 met or a named blocker with fallback chosen (cut order: ENS EAC before ENS mint — DEV-LOOP §5).
```
