---
date: 2026-09-06
unit: U1 overlay fix + human G2 confirmation
gate: G2 closed for real; G3 next
---

# 2026-09-06 evening — human Lane A + session refresh fix

## Human product path (principal)

After the overlay session-refresh fix:

1. Sign in (email OTP) → Start → Allow the teller → Open my account → Pay  
2. Account `0x9C01e49A3511402AE7E7229660dAF7de3Ed75Cb9` on Remote EVM **1337**  
3. Passbook 500 → **487.5** dUSDC; stage mined; `txId` 3; hash `0xff0a9053a96bd098e500bd184e07fef1691564ed95f76a028be711fe7637d4ac`  
4. Signing stayed **session signer — no modal per action**; policy **pinned to your account**

G2 is met on both kill tests **and** the real overlay consent path. Bridge `accountInfo` still reports the U0 fixture — expected until U3.

## Bug fixed

After `/provision`, the overlay refreshed passbook from `/status` but **not** `session.account`, so **Pay** stayed hidden. Sign out also left stale React session/passbook, so **Start** never returned.

Fix: `refreshSession()` after mutating desk calls; clear session on logout / `authenticated === false`; clear passbook when signed out.

- `apps/web/src/overlay/useBranchZeroWallet.ts`
- `apps/web/src/overlay/App.tsx`

## Next

U2 Timelock lane (G3). See [`docs/HANDOFF-CC.md`](../HANDOFF-CC.md) §5b and [`docs/KICKOFF-U2.md`](../KICKOFF-U2.md).
