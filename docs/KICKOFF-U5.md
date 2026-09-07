# Kickoff prompt — U5 ENS (G6)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck on
ENSv2 Sepolia contract wiring after one honest attempt.

**Before this unit:** U4+ Priority release (G5b) is **met**. GameLab **ENG-2026-0007** is **yes** (2026-09-07):
ENSv2 parent `branchzero` owned by registrar `0xc4d7…9277`; Customers UserRegistry `0x64ED…073c`;
`test.branchzero.eth` minted + `setAddr`; resolve via ENSv2 Universal Resolver **`0x85edf8b6b7d4211e2b07aa687506b746357b92cf`**
(legacy proxy `0xeEeE…EeEe` returns **null** for native children — pin UR V2). Mainnet `branchzero.eth` is brand-only.

**Do not re-run K6.** Rewrite lab behaviour into product. **Do not edit GameLab ENG-0010–0013.** Priority / Passkey are out of U5.
Freeze intact: one Account Opening modal, Priority Passkey only on Okafor, canvas focus, `desk.link`, error lines, measured `.pck`/`.wasm`.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U5 — ENS (gate G6) ONLY.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md   (§5f; U4+ met; ENG-0007 yes)
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-k6-yes.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ENS.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md   (ENS = Sepolia; payments = 1337)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4 ens* methods, §5b canvas focus)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (§4.6 Petra, §5 errors)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SECURITY-AND-KEYS.md   (registrar = bank key; never mainnet key)
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md   (K6 yes row)
9. GameLab ENG-2026-0007 findings.md + handoff.md (addresses + tx evidence; do not merge the ENG tree)
10. Craft: https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/pin-the-resolver-that-walks-your-hierarchy.md
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/app-resolve-is-not-registry-ownership.md

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0007-ensv2-subname-mint   (read-only reference)
- Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (Lane A/B stay here)

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. Pin getEnsAddress / resolve to ENSv2 Universal Resolver 0x85edf8b6b7d4211e2b07aa687506b746357b92cf (handoff). Do NOT rely on viem default or 0xeEeE… proxy for *.branchzero.eth. Note any new dep in REFLECTION §8.
- ENS on Sepolia; payments stay on Remote EVM 1337. Resolve name → address → pay that address on 1337.
- Parent label: branchzero. Customers UserRegistry 0x64ED6bd3858d95F5e822ACe73b977103B905073c; resolver proxy 0xf8b95a987f0D8d79BF4999e5c84e2d684bB66C72. Pin into infra/deployments/sepolia.json. Mainnet ownership is brand-only — never put the mainnet wallet key in Teller Desk env.
- Do NOT wipe Remote EVM. Do NOT touch lane semantics, role grants, Privy policy, or the one-modal rule (Priority Passkey exception already shipped).
- Godot 4.5 GDScript, web, threads OFF. Bridge only: ensAvailable / ensMint / ensSetText / resolveName over NEW /ens/* desk routes. Dialogue → GameState.run_action → Chain.call_async.
- Registrar key = ENS_REGISTRAR_PK (Sepolia throwaway). Never Ganache-parity keys on Sepolia. No secrets in git. Claim setAddr → player's AccountBlox (lab pointed at registrar — product must map to the player).
- Every new error code → apps/game/dialogue/errors.json; run_checks.gd green. MockChain answers ens* for greybox only — never for G6 evidence.
- No art/audio/zone redesign (U7). Petra Name Desk: NPC + name-claim form (payment_slip.gd pattern) + names board.

SEQUENCE:
1. Teller Desk: /ens/available, /ens/claim, /ens/record, /ens/resolve. Use ENG-0007 handoff addresses; write sepolia.json.
2. Bridge u5.0: four methods; codes survive fetch boundary; focusCanvas after any overlay.
3. Godot: Petra (§4.6), claim form, names board, slip accepts name (resolve via pinned UR V2 → address; refuse with her line).
4. Kill tests: mint → resolve → pay-by-name on 1337; taken name refused. G6 evidence on Sepolia resolve + 1337 pay — not MockChain alone.
5. Progress note + REFLECTION; HANDOFF → U6 + docs/KICKOFF-U6.md.

DoD = HANDOFF-CC §5f (G6).

OUT OF SCOPE: Arc (U6), Priority/Passkey (U4+), Uniswap, art/audio, greybox redesign, wiping Remote EVM, editing ENG-0010–0013, ENS mainnet runtime, merging GameLab ENG trees, re-proving K6.

Stop when G6 met or a named blocker with fallback chosen (cut order: ENS EAC before ENS mint — DEV-LOOP §5).
```
