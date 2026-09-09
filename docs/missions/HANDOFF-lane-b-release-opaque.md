---
type: handoff
title: Handoff — Lane B timed Release stuck (wire #14)
created: 2026-09-09
product: Branch-Zero
status: met
account: "0xD70B3b804A5E1C40122e4617A8C39474A07509eD"
owner: "0x79542756550E1E5a74FfE4c62EB0B2E2D193c26B"
chain: Sepolia 11155111
txId: "14"
kickoff: docs/missions/KICKOFF-lane-b-release-opaque.md
---

# Handoff — Lane B timed Release opaque failure (Live wire #14)

> **MET 2026-09-09.** Root cause: Privy `eth_signTransaction` **`policy_violation`** — the player's policy had **no** "Owner: release a wire · 11155111" rule (duplicate stored rule ids made `pinTxRulesToAccount` overwrite it with the recall spec). Not gas, not RPC, not the contract. Wire #14 released `0x16b519b53bea872fc2d5e3f34e52a9079f59766574a5431b39fed4810fa5d46b` (COMPLETED, 225 → 75 USDC); fresh wire #15 released clean `0x1e7f7566c6a6acebed0d89d2258f549a6f200583f3afaf4bca2c5e222b6cde0a`. Fix: `privy.ts reconcileTxRules` (by-name reconcile on `/session` and on a `PolicyDenied` retry in `laneB.decide`), `explainRevert` reads the Privy answer first (`PolicyDenied` / `SignerError`), address-shaped "revert data" rejected. Diag rigs: `npm -w apps/teller-desk run diag:release|diag:sign|release:wire`. Detail: REFLECTION.md rows #14e/#14f. Review follow-up (#14g): Load Account brought onto the reconciler, `createTxRules` rejects missing/duplicate ids, `pinTxRulesToAccount` removed.

## Verdict (so far)

The **vault contract will accept** a timed `approveTimeLockExecution(14)` when called as the owner. The **Teller Desk send path** still fails before broadcast with a viem-wrapped “unknown error executing approveTimeLockExecution”, mislabeled `ReadableText`. This is **not** `BeforeReleaseTime`, **not** an expired meta-tx, and **not** a Godot export issue.

**Do not open a GameLab `ENG-*`.** This is product desk/signing (Branch-Zero). Lab-style isolation means: reproduce on Sepolia with desk logs, kill-test if useful on 1337, no engine project.

---

## Hard facts (reproduced 2026-09-09)

| Fact | Evidence |
|------|----------|
| Record #14 still `PENDING` | `getPassbook` / `listPending`; balance **225** USDC (150 still in vault) |
| Clock long past | `releaseTime` 1788969576; chainNow ≫ that |
| `eth_call` / `simulateContract` **as owner** succeeds | Direct viem against Sepolia RPC → returns txId 14 |
| Same call **without** `from` | `NoPermission(address(0))` `0xf37a3442` |
| Desk failure is **pre-broadcast** | Stage `signing` → `failed`; never `broadcasting` / no approve hash |
| Latest desk build is loaded | Error shows `gas: 350000`, `maxFeePerGas: 3 gwei`, `maxPriorityFeePerGas: 1 gwei` |
| Fund top-up likely runs | ~14 s gap approve → signing on job `6ac0d4d4` |
| Tx #13 timed release **did** mine earlier same account | Receipt `899f4c4f` / `0xfbcfe85f…` |
| Bob “Ask why” for ReadableText was wrong for Live | Cited Remote EVM meta-tx idle — path is direct owner approve on Sepolia |

---

## What was already tried (local / partially pushed)

1. Vault board UX: **● ready** ≠ funds sent (`6df5e8e` on main).
2. SDK strict simulate skipped (`simulationMode: 'skip'`) — still fails inside `walletClient.writeContract` → `getContractError`.
3. Blocking desk preflight removed (it produced `ReadableText: yT'VUZt.k` and never sent).
4. Gas 500k → 350k; pin 3 gwei maxFee; `fundOwnerGas` before decide (full target).
5. `revertData` should ignore write-call selectors (`0x805f14ab…`) so calldata is not decoded as a string revert — **ReadableText label may still stick** via SDK `handleViemError` / last-resort decode.

Uncommitted / restart-dependent: full-target `fundOwnerGas({ minWei: target })`, `gasPrice: 3 gwei`, ReadableText copy in `errors.json`. Confirm `git status` before the next agent starts.

---

## Likely root (hypothesis to prove)

`writeContract` wraps **any** prepare/sign/`eth_sendRawTransaction` failure as `ContractFunctionExecutionError` (“executing the contract function…”). Earlier Sepolia `eth_call` as owner succeeds, so the mined call should work if a correctly signed owner tx is broadcast.

Suspect order:

1. **Privy `eth_signTransaction`** policy / enclave error (most likely once fees+balance are fine).
2. **`sendRawTransaction`** node rejection (nonce, underpriced, simulation-on-send).
3. Residual **balance×fee** edge (less likely after full top-up + 3 gwei).

**Required next step:** capture the **unwrapped** `error.cause` / `originalError` / Privy response in Teller Desk logs for one Release click. Do not trust the bank line alone.

---

## Scope for the follow-on agent

**In**

- `apps/teller-desk/src/lanes/laneB.ts` (decide / explainRevert)
- `apps/teller-desk/src/signing/privySigner.ts`
- `apps/teller-desk/src/privy.ts` (tx policy rules for `approveTimeLockExecution`)
- Optional: bypass SDK `writeContract` with encode → prepare → Privy sign → `sendRawTransaction` and surface raw RPC/Privy errors
- Kill-test or scripted Live diag that prints cause chain (no secrets)
- Fix Bob ReadableText / Unknown bank lines so Live timed Release never cites Remote EVM meta-tx

**Out**

- Godot re-export / GameLab ENG
- Protocol Solidity changes (unless eth_call as owner starts failing)
- Priority (Okafor) as the only fix — may be a **workaround** to unblock the principal, not the Ruth path fix

**Done when**

1. Desk Release on wire #14 (or a fresh wire) reaches `broadcasting` → `mined`, record `COMPLETED`, passbook balance drops by the wire amount.
2. Failure mode (if any) names the real cause (`OwnerGasDry`, `policy_violation`, RPC, …) — not `ReadableText` / Remote EVM lore.
3. Short note in `docs/REFLECTION.md` + close this handoff.

**Kill:** If after unwrapping Privy+RPC the failure is an upstream Privy policy engine bug that cannot be expressed in current rule DSL — document the blocker and ship Priority as temporary Live escape with an OWED item.
