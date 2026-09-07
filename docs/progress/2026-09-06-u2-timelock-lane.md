---
date: 2026-09-06
unit: U2 Timelock lane
gate: G3
result: met (V6 PASS both ways; Lane B wire → pending → approve / cancel green on Remote EVM 1337)
agent: Claude Code (Fable 5.1 → Opus 5), cold session
---

# 2026-09-06 — U2 Timelock lane

The vault. A wire goes in as a time-locked record, the clock is the record's own `releaseTime`, and the only
way out is a path the contract time-checks. Nothing was wiped; the U0 fixture and the U1 accounts are intact,
and a U1-era account upgrades in place rather than being re-cloned.

## Kill tests

| ID | Result | Evidence |
|----|--------|----------|
| **V6-a** | **PASS** | The owner's own `executeWithTimeLock` was signed by the Privy session signer (`eth_signTransaction`, calldata-scoped policy, pinned to the account) and broadcast by the Teller Desk. `txId 3` PENDING with `releaseTime 1788721736` = block 77 timestamp + 120 s. No browser, no second modal. |
| **V6-b** | **PASS** | The same wallet, same call, addressed to the U0 fixture — an account it does not own: `400 {"error":"RPC request denied due to policy violation","code":"policy_violation"}`. The `to` pin holds for transactions exactly as the `verifyingContract` pin does for typed data (K5). |
| **LaneB-1** | **PASS** | `approveTimeLockExecution` twelve seconds into a 120 s cooling period reverted `BeforeReleaseTime` (`0xee142cd7`) **on chain**. The greyed button is decoration; the contract is the control. |
| **LaneB-2** | **PASS** | `cancelTimeLockExecution` while PENDING → `CANCELLED`, payee balance unchanged. |
| **LaneB-3** | **PASS** | Second wire, waited the full 120 s (no time warp on this chain), `approveTimeLockExecution` → `COMPLETED`; payee +250 dUSDC; pending list empty. |
| **LaneB-4** | **PASS** | Branch Manager (`BRANCH_MANAGER` runtime role, `MANAGER_PK` = `0xE11BA2b4…882d`) was refused before release with `BeforeReleaseTime` — not `NoPermission`, which is what proves the runtime grants landed — then approved `txId 5` after it: payee +150 dUSDC. The manager can release and recall; it can never file a wire. |

Re-run: `npm -w apps/teller-desk run killtests:u2 -- --fresh`. **Use `--fresh` for V6-b to mean anything** — a
user-controlled wallet's signers and policies can only be set at creation or by the user, so a reused rig
user whose wallet was made without them has nothing to deny with (the test says so rather than passing
quietly).

## The two findings that cost the afternoon

### 1. The meta-transaction approve path does not enforce the timelock

`EngineBlox._txApprovalWithMetaTx` skips `releaseTime` **by design** — its comment calls it "hybrid synergy":
the direct path enforces the clock, the delegated meta-tx path is time-flexible. Had Lane B approved the way
Lane A pays, the session signer could have released a wire the instant it was filed and the vault clock would
have been an animation.

So both the request and the approval are **owner transactions** (Lane B option 1), and provisioning grants
**no** `SIGN_META_APPROVE` / `EXECUTE_META_APPROVE` on the ERC-20 transfer selector at all. With no role
holding that action, the untimed path is unreachable. This is why option 1 was required, not merely
preferred — the "no pop-up" argument was the smaller half.

### 2. Remote EVM's block clock is frozen between transactions

NethDev mines only when a transaction arrives, so every contract **view** reads a `block.timestamp` that can
be minutes behind wall time. That broke two things in opposite directions, and both failed in a way that
pointed away from the cause:

- `createMetaTxParams(..., duration, ...)` returns `block.timestamp + duration`. Idle longer than the
  duration and every meta-tx is **born expired** — while `eth_call` still passes, because it replays against
  the same stale block. Symptom: role batches reverting with empty data (which the SDK's decoder rendered as
  a nonsense `ReadableText` error), pre-flight simulation insisting the call was fine. Fix: `metaTxDuration()`
  passes `(now − latestBlockTimestamp) + TTL`.
- The mirror: a wire whose `releaseTime` has genuinely passed still looks *unreleased* to `simulateContract`
  and `eth_estimateGas`, so the approval is refused before it is sent. Fix: `tickChain()` mines one empty
  block (21,000 gas) before a vault operation, so the pre-flight sees the clock the real transaction will.

**The rule worth keeping: on this chain a passing `eth_call` is not evidence that a transaction will
succeed.** Both fixes are no-ops on a chain that mines on a schedule.

## What runs

| Step | Command | Result |
|------|---------|--------|
| Teller Desk | `npm run dev:teller` → `GET /healthz` | `{"ok":true,"unit":"U2",…,"timeLockSec":120,"manager":{…}}` |
| U2 kill tests | `npm -w apps/teller-desk run killtests:u2 -- --fresh` | V6-a / V6-b / LaneB-1…4 |
| U1 kill tests | `npm -w apps/teller-desk run killtests -- --fresh` | unchanged (K2 / K5 / Lane A) |
| Web shell | `npm run dev:web` → http://localhost:5173 | overlay renders over the running Godot canvas; bridge `u2.0`; K1 echo still round-trips |

## The shape that emerged

**Permissions are checked on two selectors, and `initialize` only gives you one of them.** Every workflow
validates the caller's action on the *execution* selector (`transfer`) **and** the *handler* selector
(`executeWithTimeLock` / `approveTimeLockExecution` / `cancelTimeLockExecution`). The defaults grant OWNER the
handler half only — the same shape as U1's V4 finding, one level along. Provisioning now adds, on `transfer`:
OWNER `EXECUTE_TIME_DELAY_REQUEST` + `EXECUTE_TIME_DELAY_APPROVE` + `EXECUTE_TIME_DELAY_CANCEL` beside U1's
`SIGN_META_REQUEST_AND_APPROVE`; `BRANCH_MANAGER` approve + cancel, and the same two on the handler selectors,
because the handler half is OWNER-only by default.

**Provisioning is a reconciler now, not a script.** It reads the whitelist, the role grants and the balances
back before sending anything, so a U1-era account upgrades in place, a restart cannot re-fund or double-grant,
and `ROLE_SET_VERSION` says when a re-sync is due. Changing an existing grant is REMOVE + ADD in one batch —
`addFunctionToRole` refuses a duplicate selector, and the transfer schema is `isGrantRevocable` so the removal
is allowed even on a protected role.

**Privy's policy engine does scope calldata.** `ethereum_calldata` conditions take an ABI and match
`function` or `function.param`, so each of the three vault functions gets its own rule, pinned alongside
`to` = the player's account and `chain_id`. The to-only shape is kept as a per-player fallback and recorded
in `player.txPolicyMode`, so the README can say exactly what a given player got. Fresh players got
`calldata`.

**Signing, not sending.** Privy signs the owner's transaction inside the enclave and the Teller Desk
broadcasts the bytes, so Privy never needs RPC access to a private chain and viem keeps ownership of nonce
and gas. The custom viem account now has two capabilities and refuses everything else: Bloxchain typed data,
and transactions whose `to` is the player's own account.

**The player index is on disk.** `apps/teller-desk/.data/players.json` (git-ignored, no secrets). A vault
clock runs for minutes; losing the in-memory map mid-wire meant the next "Open my account" cloned a second
account at 16.2 M gas and stranded the balance. Accounts are additionally recoverable from
`CopyBlox.BloxCloned` logs, so the chain stays the index of record and the file is only a cache.

## Not done / carried forward

- **The overlay's vault UI was exercised as far as a human-free session can reach.** The panel renders over
  the running Godot canvas, the bridge reports `u2.0`, and `wire` / `approve` / `cancel` / `listPending` all
  dispatch through to the Teller Desk and fail only on authentication — not as unknown methods. Completing
  Privy's email OTP needs a human with an inbox (same constraint as U1). **Next human action:** sign in, open
  an account, click **Wire**, watch the vault board count down from the chain's `releaseTime`, then
  **Release** — and confirm no second modal appears at any point. The signing lane behind those buttons is
  what the kill tests prove.
- Godot has no vault scene yet; the cube scene still only exercises K1. U3.
- Bundle is 2.66 MB (765 kB gzipped) before the Godot export — the U4 size check has real work to do.
- `chainNow` is reported in every stage event but deliberately not used for the countdown; if the demo ever
  moves to a scheduled-mining chain, the `tickChain` calls become dead weight and can go.

## Code pointers

- `apps/teller-desk/src/lanes/laneB.ts` — wire / approve / cancel, the watcher, revert decoding
- `apps/teller-desk/src/lanes/provision.ts` — `desiredGrants` / `syncRolePermissions`, account recovery, gas top-up
- `apps/teller-desk/src/signing/privySigner.ts` — `signTransaction` half of the custom account (V6)
- `apps/teller-desk/src/privy.ts` — `createTxRules` / `pinTxRulesToAccount` / `recoverPolicy`
- `apps/teller-desk/src/chain.ts` — `metaTxDuration`, `tickChain` (the frozen-clock fixes)
- `apps/web/src/overlay/App.tsx` — vault board and countdown
- `apps/teller-desk/scripts/kill-tests-u2.ts` — V6 + Lane B
