# Kickoff prompt — U2 Timelock lane (G3) — **SUPERSEDED**

> **G3 was met on 2026-09-06.** Kept for the record. The live kickoff is
> [`KICKOFF-U3.md`](./KICKOFF-U3.md); what U2 actually found is in
> [`progress/2026-09-06-u2-timelock-lane.md`](./progress/2026-09-06-u2-timelock-lane.md).

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck on Lane B option choice or permission/gas after one honest attempt.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U2 — Timelock lane (gate G3) ONLY.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-CC.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/KICKOFF-U2.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REMOTE-EVM.md
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/BLOXCHAIN-INTEGRATION.md  (§6 Lane B; §7 roles)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ARCHITECTURE.md  (§3.3)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/PRIVY.md
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md
9. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-06-u1-signing-lane.md
10. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-06-u1-human-path.md

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM
- Protocol (bootstrap only): D:\My Git Projects\ParticleCS\Bloxchain-protocol

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. Do NOT deepen @bloxchain/contracts / chain:compile.
- Do NOT wipe Remote EVM. Live block gasLimit = 16,777,216; cloneBlox already ~99% of a block — keep heavy txs alone in their blocks.
- Keep U0 AccountBlox fixture; new wallets via CopyBlox already on chain.
- Godot never holds keys / never talks RPC; no JavaScriptBridge.eval; single-thread web.
- One wallet modal after Account Opening (session signer). Prefer Lane B option 1 (owner eth_sendTransaction via session signer) if Privy policy can scope it; else option 2 (REQUESTER) or document chosen fallback (V6).
- EIP-712 domain name from SDK: "Bloxchain".
- Extend role grants in apps/teller-desk/src/lanes/provision.ts (EXECUTE_TIME_DELAY_REQUEST / approve / cancel) — do not invent a second provisioner.
- Fill existing 501 stubs: /wire /approve /cancel. SSE stages must expose releaseTime from chain (getTransaction), not a local timer.
- Refresh overlay session after mutations (U1 lesson — refreshSession).

U0–U1 are DONE — do not redo scaffold/K1/K2/K5/Lane A.

DoD = HANDOFF-CC §5b (G3): wire creates PENDING; countdown from on-chain releaseTime; approve and cancel paths; SSE stages; kill/decision log + progress note; overlay can exercise without a second wallet modal (or documented fallback).

OUT OF SCOPE: greybox/NPCs (U3), ENS, Arc, Uniswap, manager runtime role polish beyond what approve needs.

Stop when G3 met or a named blocker with fallback chosen.
```
