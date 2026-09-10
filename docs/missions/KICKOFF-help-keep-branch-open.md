---
title: Kickoff prompt — Help keep the branch open (ops float HUD)
created: 2026-09-10
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-help-keep-branch-open.md
---

# Kickoff prompt — Help keep the branch open

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** Live-only **player** sustainability surface for the Sepolia ops treasury — (1) HUD chip **Help keep the branch open**, (2) React funding popup (address + Copy + Google Sepolia faucet), (3) soft-gate write lanes when `/healthz` reports `treasuryShort`.

**Why:** Public demos die when staff gas runs dry. S3 already collects faucet ETH at `SEPOLIA_TREASURY_*` and tops staff in the background; desk-debug already shows the till. Promote a thin player CTA so strangers can refill the same sink — not a Treasury Desk quest, not Bob, not Terminal.

**Baseline:** Main wing on `:5173` Live. S3 treasury MET. HUD bottom band + Terminal overlay + `focusCanvas` exist.

**Handoff:** [`HANDOFF-help-keep-branch-open.md`](./HANDOFF-help-keep-branch-open.md) · plan [`docs/SEPOLIA-TREASURY.md`](../SEPOLIA-TREASURY.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| S3: treasury is operator logistics | This mission = approved thin player exception only |
| `treasuryShort` already on `/healthz` | Reuse it — do not invent a second oracle |
| Bob = wire vault; "vault" = Lane B | Never say "fund the vault" for ops ETH |
| Terminal = Console / OBSERVER | Do not put funding in the iframe |
| Faucet is human Google captcha | Popup = Copy + open link; never auto-claim |
| Drop ≠ instant staff solvency | Tell players background top-up; retry shortly |
| Hard undismissable modal + captcha | Soft write-gate; dismissible popup |
| Ines faucet = practice USDC | Keep separate from ops ETH CTA |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — Help keep the branch open.
(1) Live-only HUD chip near the passbook: "Help keep the branch open" (urgent when treasuryShort).
(2) React overlay popup: one-line why (ops gas, not passbook/practice dollars) + treasury address + Copy + open https://cloud.google.com/application/web3/faucet/ethereum/sepolia + status (eth / short / requiredEth) + "tops staff in the background — retry in a minute"; Esc closes; focusCanvas on close.
(3) Soft write-gate: when Live + treasuryShort + configured, write actions (provision/pay/wire/release/priority/ENS/FX/load) open the popup; player may dismiss and walk. No hard lobby lock.
Reuse /healthz treasury fields only. Read-only for players — never call top-up spend from the UI.

Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-help-keep-branch-open.md
2. docs/missions/KICKOFF-help-keep-branch-open.md
3. docs/SEPOLIA-TREASURY.md (§5 health reports / §7 out of scope)
4. docs/GAME-DESIGN.md §1 + §7
5. apps/web/src/overlay/useBranchZeroWallet.ts (DeskTreasury) · App.tsx treasury row
6. apps/web/src/overlay/Terminal.tsx · apps/web/src/bridge/branchZero.ts · apps/game/scripts/hud.gd · game_state.gd
7. Skim: docs/GODOT.md §5b · docs/OWED.md §1 + §6 (Treasury Desk still parked)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Codex Luna. Product repo only (Branch-Zero). No GameLab ENG-*. No protocol Solidity.
- Title copy: "Help keep the branch open". Not Treasury Desk / gas station / fund the vault.
- Live only. Hide on Dev/mock. Never fake Live treasury on mock.
- Single truth: /healthz treasury (address, eth, treasuryShort, requiredEth). No second balance path.
- Publish address only — never SEPOLIA_TREASURY_PK or any key.
- Popup never spends / never calls treasury:topup. Copy + faucet link only.
- Soft-gate writes when treasuryShort; dismissible; do not ui_locked-trap during faucet captcha.
- Do not put funding on Bob, Mo, or Terminal as the primary surface (optional shared popup from a plaque later — not required).
- Do not change Ines practice faucet, need table, caps, or auto interval semantics.
- Preserve Esc priority: dialogue / slips / Terminal before this popup; focusCanvas on close.
- Preserve U4 freeze, Load Account, Live/Dev, FX, partners board, player menu, desk-debug treasury row.
- Never commit secrets. Local progress under docs/progress/ (gitignored).
- Do not start iNPC, U7 packaging, Arc, or walkable Treasury Desk quest in this mission.

SEQUENCE:
1. Inventory — healthz treasury shape, how App.tsx renders it, how HUD + Terminal open overlays.
2. Player-safe bridge — expose configured/address/eth/treasuryShort(/requiredEth) to chip + popup.
3. HUD chip — quiet + short styles; click opens overlay.
4. Popup — Copy, faucet new-tab, dismiss, focusCanvas; bank language.
5. Soft write-gate — open popup on write attempts when treasuryShort; optional restore toast.
6. Verify — Live chip+popup; Dev/mock hidden; short→write opens popup and dismiss works; desk-debug still ok.
7. Close — mark HANDOFF met/blocked; tick OWED; one SEPOLIA-TREASURY line that player HUD CTA is authorized; note if export:web required.

DoD = HANDOFF-help-keep-branch-open Verification checklist + OWED tick + handoff status met.
Stop when met / blocked.
```
