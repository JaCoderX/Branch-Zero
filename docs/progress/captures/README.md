# Captures — human checklist (pre-U5 optionals)

Committed artefacts stay small. Video/gif of the **real** bridge is filmed by a human with the tab visible (Godot web freezes when hidden).

## Already automated / on file

| Item | Evidence |
|------|----------|
| Silent counter Pay under the action-pinned policy | `killtests:u4plus` **Y8b** (session signer signs pay; bypass denied Y8a) |
| Passkey dismiss → Okafor's line | Overlay throws `PRIORITY_CANCELLED`; `errors.json` line; MockChain `dismiss` + `run_mock_walk.gd` |
| Vault clock mock clip | [`2026-09-07-u4-vault-clock-mock.gif`](./2026-09-07-u4-vault-clock-mock.gif) |

## Still human (≈5 min with desk + Vite up)

Do these on `http://localhost:5173/` (not `127.0.0.1` — Privy origin). Tab must stay **visible**.

### A. Silent Pay right after a Passkey (optional film)

1. Sign in as principal; Re-check if needed (roleSet 3).
2. Wire >100 dUSDC → walk to Okafor → Priority → complete Passkey + sign sheet.
3. Immediately F3 / Counter → Pay ≤100 to the florist — **no** wallet modal.
4. Optional: 15 s screen recording of steps 2–3.

### B. Dismiss Passkey → PRIORITY_CANCELLED (optional human confirm)

1. File a cooling wire; at Okafor choose Priority release.
2. Dismiss the Passkey sheet (or the sign sheet) without confirming.
3. Okafor should say: *"No hand scan, no priority release — the wire keeps cooling."*
4. Wire still PENDING on the board.

### C. Real-bridge 30 s vault-clock clip (U4 owed)

1. Wire a large amount; stand at Ruth's vault with the door clock visible.
2. Keep the tab focused for ≥30 s while the countdown moves (desk-corrected `releaseTime`).
3. Save as `docs/progress/captures/YYYY-MM-DD-u4-vault-clock-real.*` (gif/mp4; keep under a few MB or link externally).
4. Do **not** commit secrets or full `.env`.

## Producer gate for ENG-0007 mint (blocks full G6)

1. Set `SEPOLIA_RPC_URL` + `ENS_REGISTRAR_PK` in Branch-Zero `.env` (throwaway Sepolia key + MockUSDC).
2. Register `branchzero.eth` (free as of probe 2026-09-07) via ENSv2 ETHRegistrar commit/reveal (≥60 s wait, ≥28 day duration).
3. Re-open GameLab ENG-0007 mint script / product `ens-setup` — see GameLab `work/ENG-2026-0007-ensv2-subname-mint/handoff.md`.
