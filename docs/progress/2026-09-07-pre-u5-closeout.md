---
date: 2026-09-07
unit: pre-U5 closeout (revised)
gate: G5b optionals + ENG-0007 partial
result: optionals closed in automation; ENG-0007 still partial after principal name claim — ENSv2 parent not on ETHRegistry; ENS_REGISTRAR_PK empty in workspace .env
---

# 2026-09-07 — Pre-U5 closeout (revised)

## ENG-2026-0007

Principal: `branchzero.eth` acquired on **mainnet** (separate wallet, brand only) and claimed on testnet; intended `ENS_REGISTRAR_PK` for Sepolia.

Lab dig (`scripts/dig-parent.mjs`):

| Fact | Value |
|------|--------|
| Universal Resolver `getEnsAddress(branchzero.eth)` | `0xc4d7cCabc561c7D9360481404DA8A80886a49277` |
| ENSv2 `ETHRegistrar.isAvailable("branchzero")` | **true** |
| ENSv2 `ETHRegistry.ownerOf` | **zero** |
| Branch-Zero `.env` `ENS_REGISTRAR_PK` | **empty** this session |

So U5 may scaffold **resolve** with viem against the Sepolia Universal Resolver. **G6 mint** still waits on: (1) fill testnet `ENS_REGISTRAR_PK`, (2) register the label on **ENSv2** `ETHRegistrar` (V1/app resolution ≠ V2 ownership), (3) UserRegistry + mint `test.branchzero.eth`.

## Optionals

| Item | Status |
|------|--------|
| `PRIORITY_CANCELLED` line | Closed in automation (mock walk) |
| Silent Pay after Passkey | Y8b policy coverage; film optional |
| Real-bridge 30 s vault clip | Human — [`captures/README.md`](./captures/README.md) |

## Godot

`run_checks.gd` PASS · `run_mock_walk.gd` PASS (includes PRIORITY_CANCELLED).
