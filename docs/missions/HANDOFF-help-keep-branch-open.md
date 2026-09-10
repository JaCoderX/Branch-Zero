---
type: handoff
title: Handoff — Help keep the branch open (ops float HUD)
audience: cold agent (Codex Luna)
created: 2026-09-10
product: Branch-Zero
mission: Live-only player surface for Sepolia ops treasury — HUD chip + funding popup; soft-gate write lanes when treasuryShort
kickoff: docs/missions/KICKOFF-help-keep-branch-open.md
status: open
baseline: Sepolia Ops Treasury MET 2026-09-08 (docs/SEPOLIA-TREASURY.md)
parallel_to: U7 packaging / polish walks · iNPC — UI/ops sustainability only; do not absorb those missions
---

# Handoff — Help keep the branch open

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna**.

**Kickoff (paste):** [`KICKOFF-help-keep-branch-open.md`](./KICKOFF-help-keep-branch-open.md)

**Plan / prior unit:** [`docs/SEPOLIA-TREASURY.md`](../SEPOLIA-TREASURY.md) (S3 met — desk-debug + CLI + auto top-up already exist)

**Not this mission:** Bob / staff dialogue funding beats · Terminal Console funding tab · walkable Treasury Desk quest · collapsing role keys into treasury · auto-claiming Google/Circle faucets · practice-USDC / Ines faucet changes · iNPC · U7 ship packaging · Arc · protocol Solidity · exposing private keys.

---

## Principal intent

Public Live demos die when staff wallets run out of Sepolia ETH. Operators already fund `SEPOLIA_TREASURY_*` via faucet + `treasury:topup`, and desk-debug already shows the till. For a **public** demo, strangers should be able to refill the same sink without being operators.

Ship a thin player-facing CTA:

> **Help keep the branch open**

…with address + faucet instructions, gated on the existing `treasuryShort` health signal — not a new funding system.

---

## Design lock (non-negotiable)

| Lock | Implication |
|------|-------------|
| **HUD + popup, not Bob / Terminal** | Terminal stays Console/OBSERVER. Bob stays Vault Keeper (wire releases). No "fund the vault" copy — that means Lane B. |
| **Ops gas ≠ practice dollars** | Ines faucet stays practice USDC. This surface is **Sepolia ETH** for staff gas only. |
| **Reuse `/healthz` treasury** | Single source of truth: `address`, `eth`, `treasuryShort`, `requiredEth`. Do not invent a second balance oracle. |
| **Live only** | Hide entirely on Dev (`1337`) / mock when no Live treasury block. Lab genesis funds staff. |
| **Soft write-gate, not hard lobby lock** | When `treasuryShort`: write lanes (open / pay / wire / release / ENS / FX / priority / load) open or re-open the funding popup. Player may dismiss and walk / look. Do **not** trap them in undismissable `ui_locked` while they complete a captcha faucet. |
| **Funding ≠ instant solvency** | Copy must say: after send, the branch tops staff in the background — try again shortly. Auto watch interval / pre-`cloneBlox` already exist. |
| **Read-only for players** | Popup never calls `treasury:topup` or any spend path. Copy address + open faucet only. |
| **Key hygiene** | Publish **address** only. Never `SEPOLIA_TREASURY_PK`. Desk-debug remains the operator row. |
| **Focus** | Shell overlay for Copy / open-link (DOM). Preserve `focusCanvas()` / Esc priority (dialogue → slips → Terminal → this popup → visitor's card). |
| **Bank language** | Title: **Help keep the branch open**. Not "Treasury Desk", "gas station", "top up ops wallet". |

---

## What already exists (do not rebuild)

| Piece | Where |
|-------|--------|
| Need × 1.25 planner, `treasuryShort` | `packages/shared/src/treasury.ts` |
| Top-up writers (CLI, pre-clone, interval) | `apps/teller-desk/src/treasury.ts` |
| `/healthz` → `treasury` block | `apps/teller-desk/src/server.ts` · `serializeHealth` |
| Operator desk-debug row + faucet line | `apps/web/src/overlay/App.tsx` |
| Health poll hook | `apps/web/src/overlay/useBranchZeroWallet.ts` (`DeskTreasury`) |
| HUD bottom band | `apps/game/scripts/hud.gd` |
| Overlay / bridge patterns | `Terminal.tsx`, `branchZero.ts`, `focusCanvas` (GODOT.md §5b) |

S3 intentionally left this **operator-only**. This mission is the approved **thin player exception** — not the parked walkable Treasury Desk quest (OWED §6).

---

## What to build

### 1. Bridge treasury into the player shell

- Keep polling `/healthz` (already done for desk-debug).
- Expose a **player-safe** slice to Godot (and/or keep the popup fully in React):
  `configured`, `address`, `eth`, `treasuryShort`, `requiredEth` (optional).
  Omit staff role keys, recent tx hashes if you push into GameState — hashes stay operator chrome.
- Mock / Dev: no chip (or a hidden flag). Never fake a Live treasury on mock.

### 2. HUD chip (Godot)

- Quiet Live state: small clickable affordance near the passbook / help band — **Help keep the branch open**.
- Short state (`treasuryShort`): urgent styling; still clickable.
- Respect `ui_locked` visibility rules like the passbook (step aside while dialogue owns the band — or keep a thin persistent strip if that reads better; do not cover dialogue choices).
- Click → ask shell to open the funding popup (`openBranchFloat` / similar — name freely).

### 3. Funding popup (prefer React overlay)

| Element | Required |
|---------|----------|
| Title | **Help keep the branch open** |
| One sentence | Sepolia ETH for *bank ops gas* — not your passbook, not practice dollars |
| Address | Full or copy-friendly; **Copy** button |
| Faucet | Open [Google Cloud Sepolia ETH faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) in a new tab |
| Status | Current treasury ETH; when short, say staff gas is low / branch cannot stamp slips |
| After-send | Tops staff in the background — retry the desk in a minute |
| Close | Esc / button → `focusCanvas`; dismissible even when short |

Optional: show `requiredEth` as "about X ETH needed" when short — only if the number is already on healthz (it is).

### 4. Soft write-gate

When Live + `treasuryShort` (and treasury configured):

- On write `run_action` / bridge calls that spend staff gas (provision, pay, wire, approve/release, cancel/priority, ENS writes, FX swap — mirror what actually burns staff ETH), **open the funding popup** (once per attempt is enough; do not spam every frame).
- Prefer honest refusal copy if the desk already returns `OwnerGasDry` / funding errors — popup may open alongside, not instead of, the error line.
- Do **not** hard-lock movement or Esc-trap the player.
- When health recovers (`treasuryShort` false): optional info toast — *Branch float restored.*

Gate on **`treasuryShort`**, not "treasury below an arbitrary pretty number while staff are still funded."

### 5. Docs / owed

- Tick the OWED row when met.
- One line in [`SEPOLIA-TREASURY.md`](../SEPOLIA-TREASURY.md): player HUD CTA authorized; full Treasury Desk quest still out of scope.
- Optional `docs/progress/` note (gitignored).

---

## Out of scope (keep parked)

- Walkable Treasury Desk NPC / quest
- Bob or Mo dialogue trees as the primary fund path (optional later plaque that opens the *same* popup is fine if cheap — not required)
- Putting funding inside Terminal iframe
- Forcing undismissable modal until on-chain balance changes
- Circle USDC player CTA (ETH only for v1 of this surface)
- Changing need table / caps / auto interval semantics

---

## Verification checklist

- [ ] Live: chip visible; click opens popup with address + Copy + faucet link
- [ ] Copy works; faucet opens in a new tab
- [ ] Dev / mock: no player chip (or explicitly absent)
- [ ] When `treasuryShort`: write attempt opens popup; player can dismiss and walk
- [ ] When not short: writes do not force the popup
- [ ] Popup never triggers top-up spend; no key material in UI
- [ ] Esc / focusCanvas intact; dialogue priority unchanged
- [ ] Desk-debug treasury row still works for operators
- [ ] Copy distinguishes ops ETH from Ines practice dollars
- [ ] OWED + SEPOLIA-TREASURY pointer updated; handoff status → met or blocked

**STOP AND ASK if:** you believe a hard whole-bank lock is required; Terminal seems like the only viable Copy surface; GameState cannot see health without leaking operator fields; mock must simulate `treasuryShort` for a kill test (default: Live walk or forced health stub — ask before inventing mock treasury drama).

---

## Agent choice (why Codex Luna)

HUD + React overlay + bridge wiring against an existing health block — same shape as player-menu / dialogue-box-fit. Not Claude Code Fable (reserved here for heavier product lands like iNPC).
