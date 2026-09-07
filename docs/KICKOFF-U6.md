# Kickoff prompt — U6 Arc + manager role (G7)

> **Parked 2026-09-07.** Principal deferred live Arc funding. Revive with [`docs/ARC.md`](./ARC.md) §5b
> (checklist) before pasting this prompt. Do not claim G7 from readback alone.

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Luna xhigh is an allowed experiment
on the same prompt. Escalate only if stuck on Arc CopyBlox / gas after one honest attempt.

**Before this unit:** U5 ENS / G6 is **met** (2026-09-07). Live proof:
`u5-mtra3lb6.branchzero.eth` → AccountBlox on Sepolia (UR V2 pinned); Lane A pay on Remote EVM 1337; `NAME_TAKEN` on
duplicate. Bridge is **`u5.0`**. Do **not** redesign Name Desk or re-prove K6/G6.
**Still owed on a Godot 4.5 host:** `tests/run_checks.gd` (named U5 follow-up).

GameLab **ENG-2026-0006** is **yes** (K3). Guard/Lane/meta on Arc are **unproven** — prove what you ship.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U6 — Arc + manager role (gate G7) ONLY.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md   (§5g; U5 met; ENG-0006 yes)
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u5-ens-g6.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ARC.md
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4–5; preserve u5.0 ens*)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SECURITY-AND-KEYS.md
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md
9. GameLab ENG-2026-0006 findings.md + handoff.md (read-only; do not merge the ENG tree)
10. Craft: https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/sdk-runtime-factory-clones.md

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0006-accountblox-on-arc
- Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (Main wing stays here)

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. Note any new dep in REFLECTION §8.
- Arc Testnet chainId 5042002 only for Arc work. Native gas is USDC (18 dec native / 6 display). Never Ganache-parity or Remote EVM keys on Arc. No secrets in git.
- Pin ENG-0006 library fixtures into infra/deployments/arc-testnet.json first; prefer attach + CopyBlox-style clone over redeploying foundations every player. K3 did not prove CopyBlox on Arc — that is U6 work.
- ENS still resolves on Sepolia with UR V2 0x85edf8b6b7d4211e2b07aa687506b746357b92cf. Main-wing Lane A/B stay on 1337. Do not wipe Remote EVM.
- Preserve bridge u5.0, Petra, names board, one-modal Account Opening, Priority Passkey only on Okafor. Do not regress ROLE_SET 3.
- Godot 4.5 GDScript, web, threads OFF. Dialogue → GameState.run_action → Chain.call_async. MockChain = greybox only.
- Manager-role beat only if §5g / ARC / principal scope requires it this unit; otherwise ship Arc provision + one live kill and name the manager cut explicitly.
- Simulate with Arc state overrides before spending faucet USDC when possible (ENG-0006). Faucet is reCAPTCHA-gated — agents cannot self-fund.

SEQUENCE:
1. Seed arc-testnet.json from ENG-0006; add Arc chain in packages/shared; refuse wrong chainId / Ganache addresses.
2. Arc provision path (clone preferred); prove owner() on a live Arc account under a product-controlled key when possible.
3. Smallest wing switch / elevator beat; receipt fees render as dollars (native 18 → display 6).
4. Kill tests on real Arc (+ regression that 1337 pay and Sepolia ENS still work).
5. Progress note + REFLECTION; HANDOFF → next unit + kickoff doc.

DoD = HANDOFF-CC §5g (G7).

OUT OF SCOPE: U7 full ship, Uniswap, ENS mainnet, changing U5 resolver, wiping Remote EVM, merging ENG trees, re-proving K6/G6, redesigning Name Desk.

Stop when G7 met or a named blocker with fallback chosen (cut order: Uniswap → Manager → Arc — DEV-LOOP / HANDOFF).
```
