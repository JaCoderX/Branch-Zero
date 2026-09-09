---
title: Kickoff prompt — Lane B timed Release opaque failure
created: 2026-09-09
product: Branch-Zero
model: Cursor · high reasoning
handoff: docs/HANDOFF-lane-b-release-opaque.md
---

# Kickoff prompt — Lane B timed Release opaque failure

Paste into a **new** Cursor / Claude Code session. Prefer a strong reasoning model.

**What this is:** Live Sepolia timed vault Release (`approveTimeLockExecution`) fails on the Teller Desk send path while on-chain `eth_call` as owner succeeds. Wire **#14** on account `0xD70B…09eD` is the living repro.

**Why:** Principal Live walk is blocked on Ruth’s path; desk shows `ReadableText` / “vault would not accept that”; Bob’s Ask-why wrongly cites Remote EVM meta-tx.

**Not GameLab.** Product desk + Privy signing only.

---

## Reflect

| Fact | Implication |
|------|-------------|
| `eth_call` as owner succeeds | Contract + permissions + clock are fine for #14 |
| Fail at `signing`, never `broadcasting` | Break is prepare / Privy sign / `sendRawTransaction` |
| viem `getContractError` wraps all write failures | Bank line is lying; unwrap `cause` / `originalError` |
| `ReadableText` + calldata `0x805f14ab…` | Often mis-decoded request data, not a string revert |
| Gas/fee/fund already patched | Latest dump has 350k + 3 gwei; still fails — dig deeper |
| Tx #13 released earlier | Path can work; regression is environmental or signing |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — make Live timed vault Release (owner approveTimeLockExecution via Privy session signer) succeed end-to-end on Sepolia. Reproduce and clear wire #14 on 0xD70B3b804A5E1C40122e4617A8C39474A07509eD (or file a fresh wire and release it). Surface real errors; stop labeling fee/Privy/RPC failures as ReadableText / Remote EVM meta-tx.

Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/HANDOFF-lane-b-release-opaque.md
2. docs/KICKOFF-lane-b-release-opaque.md
3. docs/REFLECTION.md (Lane B #14 rows)
4. apps/teller-desk/src/lanes/laneB.ts (decide, explainRevert)
5. apps/teller-desk/src/signing/privySigner.ts
6. apps/teller-desk/src/privy.ts (eth_signTransaction rules)
7. @bloxchain/sdk BaseStateMachine executeWriteContract (simulationMode, handleViemError)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Runtime: @bloxchain/sdk + viem + existing Privy session signer. No new wallets. No protocol Solidity unless eth_call-as-owner starts failing.
- Godot never holds keys / never talks RPC. No GameLab ENG-*. No Godot re-export for this bug.
- Do not weaken timelock / RBAC. Direct timed approve must remain the Ruth path (meta-approve is Priority only).
- Never commit secrets (.env, Privy keys). Redact RPC URLs in logs.
- Restart Teller Desk after server changes; do not tell the principal to re-export Godot for this.

FIRST ACTIONS:
1. git status — note uncommitted laneB/provision/errors.json work; continue or commit only if the human asks.
2. Reproduce one Release with console.warn of full errorTextChain + JSON of cause/originalError/Privy body (no secrets).
3. Prove whether failure is Privy sign, prepareTransactionRequest, or sendRawTransaction.
4. Fix the send path and/or error surfacing; verify #14 or a new wire completes on Sepolia.
5. Append REFLECTION.md; mark HANDOFF status met or blocked with OWED.

DONE WHEN: Release mines COMPLETED; passbook pending clears; bank line honest on failure.
KILL: Privy policy engine cannot express the needed rule — document and leave Priority as temporary Live escape.
```
