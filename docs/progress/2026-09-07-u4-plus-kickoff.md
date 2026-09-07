---
date: 2026-09-07
unit: U4+ Priority release
gate: G5b
status: kicked off — not built
---

# 2026-09-07 — U4+ Priority release (docs)

Inserted after U4 / before U5. No product code in this note. Kickoff: [`docs/KICKOFF-U4-plus.md`](../KICKOFF-U4-plus.md). Mission: [`docs/HANDOFF-CC.md`](../HANDOFF-CC.md) §5e.

## Labs consumed (do not edit)

| ENG | Answer | Use |
|-----|--------|-----|
| 0012 | Yes | Owner-signed `SIGN_META_APPROVE`, manager `EXECUTE_META_APPROVE`, completes **before** `releaseTime`. One role cannot hold both META bits. |
| 0011 | Yes (architecture) | User signer + `showWalletUIs` + `promptMfa` for bypass; session signer stays silent. Policy DENY must block silent lane for the bypass payload. |
| 0013 | It depends | Passkey UI works (M2). `promptMfa()` re-challenges at ~9s/~21s — do **not** claim 1-min cache. M4 PASS on `0x2489…`. **Re-smoke 2026-09-07:** `lab/.env` present; `npm run smoke` aborted (`SMOKE_POLICY_ID` / `SMOKE_VERIFYING_CONTRACT` missing on `0x818A…`). Not an MFA fail. |
| 0010 | Yes | Timed dual-control, META closed. **Not** this beat. |

## Product grants (target)

Not a copy of the 0012 throwaway clone (that withheld owner timed-approve). Same account:

- OWNER: Lane A + request + cancel + **timed approve (Ruth)** + `SIGN_META_APPROVE`
- BRANCH_MANAGER: cancel + `EXECUTE_META_APPROVE`; **remove** timed approve (Okafor is not Ruth)
- Bump `ROLE_SET_VERSION` (now 2)

## Human-owed from U4 (unchanged)

Real 30 s door clip with the tab visible; in-game toasts on the real bridge.
