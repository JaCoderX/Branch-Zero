---
date: 2026-09-07
unit: pre-U5 closeout
gate: G5b optionals + ENG-0007 partial
result: optionals closed in automation where possible; ENG-0007 resolve yes / mint parked on producer parent registration
---

# 2026-09-07 — Pre-U5 closeout

## ENG-2026-0007

Probe on Sepolia block 11653504: `branchzero.eth` **available**; `getEnsAddress(vitalik.eth)` works via Universal Resolver proxy; viem + published addresses recorded in GameLab handoff. **Mint kill criterion parked** — needs principal to register the parent and set `ENS_REGISTRAR_PK` + MockUSDC. U5 may scaffold resolve; G6 mint evidence waits.

## Optionals

| Item | Status |
|------|--------|
| `PRIORITY_CANCELLED` line | **Closed in automation** — MockChain `dismiss` + `run_mock_walk.gd` asserts Okafor's "No hand scan…" line; overlay already maps dismiss → code |
| Silent Pay after Passkey | **Policy covered by Y8b** (prior green run); human film optional — steps in [`captures/README.md`](./captures/README.md). A fresh `killtests:u4plus --fresh` re-run was started 2026-09-07 but hung after desk health (Privy/rig); not re-blocking |
| Real-bridge 30 s vault clip | **Still human** — checklist in captures README; mock gif remains on file |

## Godot

`run_checks.gd` PASS · `run_mock_walk.gd` PASS (includes PRIORITY_CANCELLED).
