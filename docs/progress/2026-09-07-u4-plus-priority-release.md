---
date: 2026-09-07
unit: U4+ Priority release
gate: G5b
result: met — same account, three ways out of the vault on Remote EVM 1337: Ruth early → `BeforeReleaseTime`; Okafor's Priority (owner-signed meta-approve, manager submits) → `COMPLETED` 102 s before the clock; Ruth after the clock → `COMPLETED`. Manager refused `NoPermission` before and after the clock. Session signer refused the bypass payload by Privy policy, still signs counter pays. Principal Passkey walk recorded 2026-09-07 (wire #9, `mfaPrompted: true`, `0xaa381c00…`)
agent: Claude Code (Fable 5.1), cold session
---

# 2026-09-07 — U4+ Priority release (G5b)

A third workflow, not a rename. Ruth waits the clock: the owner's own `approveTimeLockExecution` after `releaseTime`,
signed silently by the session signer, exactly as U2 built it. Mr. Okafor bypasses the clock: the owner signs a
`SIGN_META_APPROVE` meta-transaction **in the browser with a Passkey** ("hand scan") and the Branch Manager submits
`approveTimeLockExecutionWithMetaTx`, which `EngineBlox` deliberately does not time-check (ENG-2026-0012). Recall is
unchanged. Okafor's post-clock timed stamp is gone — from the grants, the route and the dialogue.

On-screen copy, on Okafor's idle line and his priority list: **"Skip the cooling period — hand scan required."**

## What changed

| Layer | Change |
|-------|--------|
| Grants (`lanes/provision.ts`) | `ROLE_SET_VERSION` **3**. On `transfer`: OWNER +`SIGN_META_APPROVE` (bitmap 15 → 31); `BRANCH_MANAGER` +`EXECUTE_META_APPROVE` −`EXECUTE_TIME_DELAY_APPROVE` (bitmap 6 → 132) plus the handler half on `approveTimeLockExecutionWithMetaTx` (`0x532abced`). REMOVE+ADD in one role config batch; `retiredSelectors` removes the manager's old handler grant where the schema allows. `PRIORITY_RELEASE=off` → vault-only grant set (no META bits, same version) |
| Privy policy (`privy.ts`) | The per-player `eth_signTypedData_v4` rule now carries an `ethereum_typed_data_message` condition: `params.action eq 3` (`SIGN_META_REQUEST_AND_APPROVE`). The silent lane can sign counter pays and config batches and **nothing else**; the Priority payload (`action` 4) is `policy_violation`. `TYPED_DATA_RULE_VERSION` 3; existing rules re-written in place (`ensureTypedDataPolicy`) |
| Teller Desk | `lanes/priority.ts`: `POST /priority/prepare {txId}` → contract-built unsigned meta-approve as EIP-712 typed data + `priorityId`; `POST /priority/submit {priorityId, signature}` → recover == owner (SDK), manager submits, `COMPLETED`. Refuses a released wire (`NOT_COOLING`), a settled one (`NOT_PENDING`), vault-only (`PRIORITY_OFF`), stale payload (`PRIORITY_EXPIRED`). `/approve` is owner-only (`as: 'manager'` → `MANAGER_NO_STAMP`). `/session` reports `priority`, `roleSet`. `/healthz` says `U4+` |
| Overlay (`useBranchZeroWallet.ts`) | `priority(txId)`: prepare → `useMfa().clear()` + `promptMfa()` when the player has MFA enrolled → `useSignTypedData().signTypedData(typedData, { showWalletUIs: true, title: 'Priority release — hand scan', … })` with the **user** signer → submit. Dismissed sheet → `PRIORITY_CANCELLED`, failed factor → `MFA_FAILED`. Debug panel: "Priority (hand scan)" button on cooling wires, "Manager stamp" gone |
| Bridge | `u4.1`: `priority` method (calls `focusCanvas()` in a `finally`, like `login`); `approve` sends `as: 'owner'` always |
| Godot | `run_action("priority")` (300 s, a human scans); `manager_approve` answers `MANAGER_NO_STAMP` without a bridge call; facts `priority`, `cooling`; `manager.json` rewritten (Priority list from `pending_cooling`, recall, `not_cooling`, `vault_only`, fine print on account-wide META bits); `vault_keeper.json` wait-only with the Priority mentioned as the manager's; Dev / Mo copy; 6 new error lines (92 total); MockChain `priority` (fake, labelled); `run_checks.gd` enforces Ruth `approve`-only / Okafor `priority`+`cancel`-only and the copy line; new `tests/run_mock_walk.gd` boots the autoloads headlessly and walks both desks against the mock |
| Shared | `packages/shared/src/metaTx.ts`: the SDK's EIP-712 type list transcribed (`META_TX_TYPED_DATA_TYPES`, `…_AS_SIGNED` with `EIP712Domain`), cross-checked against the SDK's real typed data on every prepare |

## Kill tests — `npm -w apps/teller-desk run killtests:u4plus` (run 5, 02:43–02:47 UTC)

Rig: Privy user `k2-rig+mtqmczhc@branch-zero.local`, wallet `0x7d2e…Dc71`, clone **`0xD02617e844D7200ee6c41A8a70a03304D5008DbD`** (provisioned straight at ROLE_SET 3;
the Re-check REMOVE+ADD path was exercised on `0x494f…eBfd`, 2 → 3, and on the two human players by `upgrade-players` — see below).

| ID | Result | On chain |
|----|--------|----------|
| Y0 | PASS | OWNER `transfer` bitmap 31 (has `SIGN_META_APPROVE` + timed approve, no `EXECUTE_META_APPROVE`); `BRANCH_MANAGER` bitmap 132 (`EXECUTE_META_APPROVE` + cancel, **no** timed approve); manager handler grant on `approveTimeLockExecutionWithMetaTx` present |
| Y1 | PASS | owner `executeWithTimeLock` via session signer → #9 PENDING, `releaseTime` 1788749127, 117 s of cooling (block 235, `0x6b238e77…`) |
| Y2 | PASS | Ruth early → `BeforeReleaseTime` (`0xee142cd7`) |
| Y2b | PASS | manager direct approve early → **`NoPermission`** (was `BeforeReleaseTime` in U2: the grant is gone, not merely clocked) |
| Y8b | PASS | counter pay 1 dUSDC under the action-pinned rule → signed silently, block 238 `0x71366862…` (#10) |
| Y9 | PASS | `/priority/prepare` built the owner's `SIGN_META_APPROVE` payload for #9; the SDK's typed data matched `packages/shared` (domain `Bloxchain` v1.0.0, chain 1337, `verifyingContract` = the account) |
| Y8a | PASS | session signer asked to sign that payload (`params.action` = 4) → **`policy_violation`** (HTTP 400) |
| Y8c | PASS | rig relaxed its rule for one signature (see "honest substitution"), restored it → `policy_violation` again |
| Y4 | PASS | owner submits their own meta-approve (simulated as the owner) → `NoPermission`; #9 still PENDING |
| **Y3** | **PASS** | **`BRANCH_MANAGER` `0xE11B…882d` submitted `approveTimeLockExecutionWithMetaTx` with the owner's signature → #9 `COMPLETED` at chain time 1788749025, 102 s before `releaseTime` 1788749127; payee +250 dUSDC. Block 239, `0xf34c88f6c4fa79485d6897167396d927d0c3247bcbe29391738e0c77ffdf124e`, gas 217,844** |
| Y5 | PASS | manager `executeWithTimeLock` → `NoPermission` (cannot file) |
| Y7b | PASS | manager direct approve **after** the clock → `NoPermission` (no post-clock stamp) |
| Y7 | PASS | Ruth (owner timed approve, session signer) after `releaseTime` → #11 `COMPLETED`, payee +150. Block 244, `0x99f8a3e5835eaa91f06e8fbf7b7dec6be76625ccc725847c25e25cb65e72a200` |
| Y6 | PASS | `desiredGrants(priority=false)`: 4 grants, no META_APPROVE bit anywhere, no manager timed approve (vault-only keeps the U2 invariant) |

`npm -w apps/teller-desk run evidence` reproduces the table above from the chain (blocks 233–244 for run 5).

**The honest substitution.** A headless rig cannot hold a Passkey, and under the product policy the session signer
*cannot* sign the Priority payload (that is Y8a). So for Y3/Y4 the script re-writes its own rig rule to the pre-U4+
shape for exactly one signature, signs the same contract-built payload with the session signer, restores the rule, and
hands the signature to `/priority/submit` as the overlay would. `recover == owner` is the same check either way; what
the browser adds is *which key produced it*. ENG-2026-0013 M2 proved that browser half (Passkey sheet → sign sheet →
signature recovers to the owner); the product walk with a human is still owed (below).

## Findings

- **Privy `ethereum_typed_data_message` conditions** (probed with `npm -w apps/teller-desk run probe:policy`, kept as a
  script): nested dotted paths work (`params.action`; the primary type is *not* a prefix); operators are `eq | gt | gte |
  lt | lte` only — `in` is `invalid_policy_format`; and the condition's `typed_data.types` must equal the request's
  `types` **exactly**. viem prepends `EIP712Domain` to the types before an account's `signTypedData` runs, so a rule built
  from the bare SDK list denied *every* request — action 3 and 4 alike — and the first pinned run refused provisioning
  itself (run 2). `META_TX_TYPED_DATA_TYPES_AS_SIGNED` is the matching set.
- **The manager's U2 handler grant is not revocable.** `getFunctionSchema(approveTimeLockExecution).isGrantRevocable`
  is `false`, so `removeFunctionFromRole` would revert. Provisioning leaves it and reports it as "stranded"; without the
  `transfer` half the dual check fails, which Y2b/Y7b show (`NoPermission`). Accounts cloned at ROLE_SET 3 never get it.
- **A Priority payload dies with the next meta-transaction.** `createMetaTxParams` reads the owner's signer nonce; a
  counter pay between prepare and submit consumes it and the submit reverts `InvalidNonce(uint256,uint256)`
  (`0x06427aeb`, run 3/4). In the bank the player is at Okafor's desk while the sheet is open, so this is a race only
  the kill test could hit (it now pays before it prepares). The SDK's error table lists `InvalidNonce` with a different
  parameter list, so `explainRevert` names the selector itself; Okafor's line is "Someone already used that slip number".
- **`explainRevert` was silently skipping a fallback.** A regex literal after `??` and a comment line inside one long
  `??` chain was mis-parsed by the transpiler; `NoPermission` came back as `Unknown` although the message named it. The
  function is now written as explicit steps; probes confirm `NoPermission` / `InvalidNonce` / `BeforeReleaseTime` decode.
- **A release against an empty account executes as FAILED.** Run 4's Y7 spent the rig's last dUSDC; the owner's approve
  mined `success` and the record went `FAILED` (record #8). The kill test now tops the rig up from the treasury first.
  The vault board already shows `failed`; `RECORD_FAILED` has a line.
- **The reused U1 rig (`k2-rig@…`) carries no Privy policy at all** (created before policies existed; user-controlled
  wallets cannot be given one afterwards), so it cannot prove any deny. `--fresh` mints a correct one; the U4+ script
  records policy tests as PARTIAL instead of FAIL on such a wallet. Re-run with `KILLTEST_EMAIL=k2-rig+mtqmczhc@branch-zero.local`.

## Existing players — Re-check (`npm -w apps/teller-desk run upgrade-players`)

| Owner | Account | Before → after | Batch |
|-------|---------|----------------|-------|
| `0x2489…1d8C` | `0x8f3C…8D25` | roleSet 2 → 3 | REMOVE/ADD `transfer` for OWNER (15 → 31) and `BRANCH_MANAGER` (6 → 132), ADD manager handler `0x532abced`; stranded handler grant `0x805f14ab` reported; typed-data rule v3 |
| `0x7954…c26B` (principal) | `0x9C01…5Cb9` | roleSet 2 → 3 | same five changes, one owner-signed role config batch via the session signer; typed-data rule v3 |
| `0x818A…83e7` (U1 rig) | `0x494f…eBfd` | 2 → 3 (run 1) | same shape; this wallet has no policy, so no rule to tighten |

Until this ran, `/pay` `/wire` `/priority/*` refused those accounts with `NOT_CONFIGURED` (Ines's Re-check line) — no
half-configured writes.

## Godot

- `godot --headless --path apps/game -s tests/run_checks.gd` → **PASS — 0 failure(s)**, 92 error lines; the new
  `vault desks (U4+)` check: Ruth `approve` only, Okafor `priority` + `cancel`, no `approve`, copy present.
- `godot --headless --path apps/game -s tests/run_mock_walk.gd` → **PASS — 0 failure(s)**: mock wire → Okafor's
  priority list offers it, Ruth's cooling list offers `approve`; Ruth early "Still cooling — 0:27 to go."; stale
  `manager_approve` → `MANAGER_NO_STAMP`; mock Priority → COMPLETED with 26 s on the clock; a released wire →
  `NOT_COOLING` at Okafor, Priority choice routes to `not_cooling`, Ruth starts at `ready`.
- Export: `.pck` 138,016 B (was 127 KB), `.wasm` unchanged. Browser mock walk (`?mock=account`): Dev files 250 →
  Okafor's idle line reads "1 wire(s) in the vault, 1 still cooling. Skip the cooling period — hand scan required. Or I
  can shred one."; `why_priority` shows the fine print; recall list works. Keys kept working after every dialogue.

## Freeze check

- `npm run typecheck` — all four workspaces clean.
- One Account Opening modal unchanged; the Priority hand scan is the one documented second surface and only reachable
  from Okafor's `priority` action; Lane A / Ruth / recall never touch the user signer.
- `desk.link`, `RPC` / `AUTH` / `NOT_CONFIGURED` paths untouched (`requireConfigured` now also gates `/approve` and
  `/priority/*`). Canvas focus: `priority` handler → `focusCanvas()` in `finally`.
- Kill tests, all on the same rig (`KILLTEST_EMAIL=k2-rig+mtqmczhc@branch-zero.local`):
  `killtests:u4plus` 15/15 PASS (run 5); `killtests` (U1) K2 / K5 / LaneA PASS (`0x34a0dd56…`, record #12);
  `killtests:u2` V6-a / V6-b / LaneB-1 / LaneB-2 / LaneB-3 PASS (`0x38d972ee…`, #16) and **LaneB-4 rewritten for
  U4+**: the Branch Manager is refused `NoPermission` before **and** after `releaseTime` and recalls the wire instead
  (#17 CANCELLED, `0x44ba2885…`). Both older scripts now top the rig up from the treasury first — the first U2 re-run
  released 250 against 86.5 dUSDC and the record went FAILED, the same hygiene finding as run 4.

## Human walk — Passkey on the real bridge (2026-09-07, ~09:21 local)

Principal account `0x7954…c26B` / clone `0x9C01…5Cb9`, roleSet 3/3, MFA enrolled, Priority desk open. Debug overlay +
`window.BranchZero` traffic:

| Step | Evidence |
|------|----------|
| Wire #9 filed | job `e4b32221`, hash `0x758e756d…`, `releaseTime` 1788762119 |
| Priority (hand scan) | job `579de08a`, hash **`0xaa381c0047cd34743e3d56f648ccb92cc42f02f6b4c106ff9610f0adec86c5fd`**, `actor: "priority"`, **`mfaPrompted: true`**, `chainNow` 1788762058 (**61 s before** `releaseTime`), `balanceAfter` 250, payee received 112.5 dUSDC |
| Session after | `priority: true`, `signingMode: session`, policy `wllkltf7…` pinned, pending empty |

This is the product half ENG-0013 M2 proved in the lab. G5b human Passkey item is closed.

## Teller escort (playtest 2026-09-07)

After a vault wire, Dev walked to the antechamber and stayed there: `ESCORTING` ignores `interact()`, the body had no
gravity, leftover velocity was never zeroed, and standing on the last waypoint blocked arrival so the 5 s "walk home"
never started. Fixed in `apps/game/scripts/npc.gd`: gravity, ignore the player while escorting, short pause, reverse
the path back to the counter, skip a stuck leg, hard-home after 22 s. `E` only talks to NPCs in IDLE/TALKING, so Ruth
is the vault desk while Dev is walking. Lobby plants are solid (`StaticBody3D`, collision mask 0 so Godot Physics
cannot shove them) and sit at `x` = -5/-1/3 — clear of the manager door and the vault escort.

## Still optional

- Silent counter Pay immediately after a Passkey (no sheet) — kill test Y8b already covers the policy; a filmed beat is nice, not blocking.
- Dismiss the Passkey sheet → `PRIORITY_CANCELLED` line.

## Code pointers

- `apps/teller-desk/src/lanes/provision.ts` — `ROLE_SET_VERSION` 3, `desiredGrants(priority)`, `retiredSelectors`, `ensureTypedDataPolicy`
- `apps/teller-desk/src/lanes/priority.ts` — prepare / submit, typed-data capture + shape check
- `apps/teller-desk/src/privy.ts` — `silentActionCondition`, `TYPED_DATA_RULE_VERSION`, `pinPolicyToAccount({ pinAction })`
- `apps/teller-desk/src/lanes/laneB.ts` — `explainRevert` as steps, `InvalidNonce` selector
- `apps/teller-desk/scripts/kill-tests-u4plus.ts`, `upgrade-players.ts`, `probe-typed-data-policy.ts`
- `packages/shared/src/metaTx.ts`, `packages/shared/src/bridge.ts` (`priority`, `via`)
- `apps/web/src/overlay/useBranchZeroWallet.ts` (`priority()`), `apps/web/src/bridge/branchZero.ts` (`u4.1`)
- `apps/game/scripts/npc.gd` (escort returns to the counter), `apps/game/autoload/game_state.gd`, `autoload/mock_chain.gd`, `dialogue/manager.json`, `dialogue/vault_keeper.json`,
  `dialogue/errors.json`, `tests/run_checks.gd`, `tests/run_mock_walk.gd`
