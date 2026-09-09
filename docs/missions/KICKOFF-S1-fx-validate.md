# Kickoff prompt — S1b FX validate (guards land + K7 live)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**.

**What this is:** continuation of **S1** after the build commit (`1d2f558`). Infra, desk, bridge, Kenji, board, and
`FEEDBACK.md` already exist. The live Sepolia **guard / role config and the guarded swap did not land** — gas-blocked.
The principal has **funded** the FX teller. This unit proves and hardens FX on chain; it is **not** a rebuild, **not**
Arc, **not** packaging, **not** Terminal.

**Why now:** Prize evidence needs K7 (AccountBlox completes a v4 swap on Sepolia). Review found the permission door
is coded but closed on chain; several gas/encoding traps will burn the new ETH if ignored.

---

## Learn (read before coding)

### On-chain reality (2026-09-08)

| Fact | Implication |
|------|-------------|
| Pool `0xfd32332c…` + till `0xB5e8ab92…` + live Quoter | Quotes work; **do not re-seed the pool** unless liquidity is gone |
| Guard batch OOG: `0x2d3b6b27…` (2.48M / 2.52M) | **No FX schemas / whitelists on the till** — UR is not approved yet |
| Role batch never sent | OWNER/BROADCASTER lack SIGN/EXECUTE bits on the three FX selectors |
| Teller `0x83Af7CAA…d4DC` **funded by principal** | Re-run `killtests:s1`; check balance first |
| Measured: guard ≈ **2,989,417** · role ≈ **2,143,997** · swap ≈ **1.3M** total outer | Outer limits must exceed these; unused gas refunds |

### Permission model (must land — do not invent a fourth selector)

`initialize` does **not** grant Uniswap. Main-wing `transfer` whitelist is **1337 only**. FX needs **both**:

1. **Guard batch (≤6):** `registerFunctionSchema` + `addTargetToWhitelist` for  
   `USDC.approve` → Permit2 · `Permit2.approve` → Universal Router · `UR.execute` → Universal Router  
2. **Role batch (≤6):** OWNER `SIGN_META_REQUEST_AND_APPROVE` + BROADCASTER `EXECUTE_META_REQUEST_AND_APPROVE`  
   on each of those three selectors (`handlerForSelectors` = `requestAndApproveExecution`)

Implemented in `enableFx` (`apps/teller-desk/src/lanes/fx.ts`). Idempotent: re-reads chain, sends only missing pieces.

**Not** required on the account: Quoter, PoolManager, WETH approve (for USDC→WETH), Branch Manager, Priority.

### Hard lessons (do not re-learn with ETH)

1. **SDK `simulateContract` ignores your gas limit** — undersized outer gas passes pre-flight and OOG on chain (already burned ~0.0027 ETH). Size from **state-override `eth_estimateGas`**, not simulation.
2. **`budget()` soft-send is dangerous** — when `affordable < want` but ≥ 200k it still sends; that recreates the burn. **Change:** hard-fail `FX_TELLER_DRY` unless balance covers the measured ceiling for that step.
3. **Public `eth_estimateGas` fails on a poor account** — node probes with block gas limit. Prefer explicit gas + override estimates.
4. **Frugal fee wrap stays** — 0.02 gwei tip / 1.08× headroom; do not revert to viem defaults on Sepolia faucet wallets.
5. **Encode against Sepolia deployment, not `v4-periphery` main** — five-field `ExactInputSingleParams` (no `minHopPriceX36` on this UR). Confirm with `eth_call` as the till before spending meta-txs. Progress note §5.
6. **Thin pool** — keep kill amounts small (`--amount 0.5`); large orders look like encoding bugs.
7. **`fxEnabled` is a partial probe** (schemas + UR on `execute` only). After enable, also read RBAC grants or rely on K7-d/e. Prefer strengthening the probe if time allows.
8. **Kill-test header lied (~0.002 ETH)** — align comments with ≈**0.007–0.01 ETH** for a full pass.

---

## Plan (ordered)

```text
A. Preflight
   1. Confirm teller balance ≥ ~0.01 ETH (principal funded 0x83Af…).
   2. Confirm till USDC ≥ kill amount (mint mock USDC if short — open mint on demo token).
   3. Harden budget(): refuse unless affordable ≥ want; align kill-tests:s1 gas comment.

B. Permissions land (the door)
   4. enableFx / killtests K7-b: guard + role batches mine; record hashes.
   5. Read back: getSupportedFunctions includes the three selectors; whitelist targets =
      USDC, Permit2, UniversalRouter; getActiveRolePermissions shows OWNER sign + BROADCASTER execute.
   6. Optional: tighten fxEnabled to require Permit2/USDC whitelist + role bits (or document why not).

C. Live swap (K7)
   7. killtests:s1 -- --amount 0.5 → K7-a…f; K7-d must PASS with explorer tx hash.
   8. K7-e wrong door still refuses; K7-f stale quote still FX_QUOTE_EXPIRED.
   9. If router reverts on encoding: fix against live bytecode (still no Uniswap npm unless REFLECTION records it).

D. Docs + honesty
  10. Update HANDOFF §5i DoD, REFLECTION K7 → PASS, README with swap hash, UNISWAP.md status.
  11. Progress note (gitignored ok); remind human: Uniswap form → FEEDBACK.md URL.
  12. run_checks / run_fx_walk / typecheck green; no freeze regression.
  13. Commit + push only when the human asked (or when this kickoff's human already authorized push of docs).
```

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — S1b FX validate ONLY.
Land the Bloxchain FX guard/role config on Sepolia, complete live K7 swap evidence, harden gas so we do not burn the principal's top-up.
Freedom on HOW. No freedom on constraints.
NOT Arc, NOT packaging, NOT Terminal, NOT custom Solidity, NOT re-seeding the pool unless dead, NOT a greenfield rebuild.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-CC.md              (§5i PARTIAL; funded teller; this unit)
2. docs/missions/KICKOFF-S1-fx-validate.md  (this file — learnings + plan)
3. docs/progress/2026-09-08-s1-uniswap-fx.md  (local; gas numbers + failed guard tx)
4. docs/UNISWAP.md
5. apps/teller-desk/src/lanes/fx.ts           (enableFx, budget, swap)
6. apps/teller-desk/scripts/kill-tests-s1.ts
7. docs/BLOXCHAIN-INTEGRATION.md §3 / V4 (whitelist ≠ enough; need role bits)
8. docs/REFLECTION.md (K7 PARTIAL; S1 decisions)
9. FEEDBACK.md / README FX section (keep honest until K7-d PASS)

HARD RULES:
- Runtime = @bloxchain/sdk + viem. No custom Solidity. No wipe Remote EVM.
- Do not regress U4 freeze, Priority, ENS, Terminal, polish DoD, faucet.
- FX writes = Sepolia till only; Main wing stays 1337.
- Hard-fail FX_TELLER_DRY when balance cannot cover measured outer gas — no soft under-limit sends.
- Encode ExactInputSingleParams for the **deployed** Sepolia Universal Router (five fields unless live call proves otherwise).
- Small swap amounts. Idempotent enableFx — do not double-register blindly; trust chain reads.
- Prefer Fable 5.1.

SEQUENCE:
A. Check teller ETH + till USDC; harden budget() + kill-test gas comment.
B. Run enable / killtests until K7-b PASS — prove three schemas, three whitelist targets, six role grants on chain.
C. K7-d PASS — AccountBlox swap via UR; paste explorer hash into README + HANDOFF + REFLECTION.
D. K7-e / K7-f still PASS; optional fxEnabled strengthening.
E. Docs + regression walks; commit when asked.

DoD (all required):
- [ ] Teller funded; budget() never sends gas < measured want
- [ ] On-chain: FX guard + role config live on till 0xB5e8… (hashes in progress note)
- [ ] killtests:s1 K7-a…f green (or named PARTIAL only if human-blocked)
- [ ] Live swap tx hash in README + HANDOFF §5i + REFLECTION K7 = PASS
- [ ] run_checks + run_fx_walk + typecheck green
- [ ] Human reminder: submit Uniswap feedback form pointing at FEEDBACK.md

Stop when DoD met or a named blocker (RPC down, till USDC mint blocked, encoding mismatch with proof).
```

---

## Paste block (short)

Copy the fenced `MISSION` block above into a new agent session after pointing it at this file and `docs/missions/HANDOFF-CC.md` §5i.

## Suggested agent order

1. Harden `budget()` + comments (cheap, protects ETH).  
2. `npm -w apps/teller-desk run killtests:s1 -- --amount 0.5`.  
3. If K7-b/d fail: read revert, fix encoding or gas only — no scope creep.  
4. Docs + DoD tick; push only if the human asked.
