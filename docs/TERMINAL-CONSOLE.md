---
title: Terminal Console — iframe bloxchain.app + OBSERVER role
created: 2026-09-08
updated: 2026-09-08
status: met
product: Branch-Zero
---

# Terminal Console — bank computer → bloxchain.app

> Stretch after U7. A diegetic terminal opens the hosted Console in an iframe. View access uses a **general** on-chain runtime role, not SaaS-specific Privy wiring.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) V10 · [PRIVY.md](./PRIVY.md) · [GODOT.md](./GODOT.md) §5b · kickoff [`KICKOFF-terminal-observer.md`](./KICKOFF-terminal-observer.md)

---

## 1. Decision (2026-09-08)

| Path | Verdict |
|------|---------|
| Embed `bloxchain.app` and connect via Privy Global Wallet / RainbowKit `@privy-io/cross-app-connect` | **Parked.** Would force non-general infra onto the SaaS Console (provider allowlists, connector package, dashboard consent). |
| Terminal iframe of `bloxchain.app` + opt-in **view-only** wallet (MetaMask / any EOA the player already holds) | **Chosen.** Uses protocol RuntimeRBAC only; Console stays RainbowKit/WalletConnect as today. |

---

## 2. Why a view-only *role* (not “just paste the address”)

AccountBlox permissioned registry views require `_validateAnyRole()` on the `eth_call` sender (`getTransaction`, `getPendingTransactions`, `getTransactionHistory`, several role queries). Branch Zero already recorded this as **V10**: a reader with `from = 0x0` gets `NoPermission`.

So:

- Pasting the AccountBlox address alone does **not** unlock the interesting Console screens when the connected wallet has no role.
- A runtime role (name TBD: `OBSERVER` / `VIEWER`) with the player's MetaMask (or ENS-resolved) address in `authorizedWallets` and **zero** function permissions / `TxAction` bits still satisfies `hasAnyRole` and cannot run pays, wires, config batches, or Priority.

That is honest theatre: the terminal grants a real viewing clerk.

---

## 3. Player fantasy

1. Walk up to an in-world computer (manager office and/or Account Opening already place `computerScreen` props).
2. Interact → shell opens a terminal overlay (pause movement; `focusCanvas` on close — GODOT.md §5b).
3. Prompt: add a **viewing wallet**? Enter `0x…` or ENS → resolve (existing `resolveName` / Sepolia ENS where applicable).
4. Teller Desk runs `roleConfigBatch`: `CREATE_ROLE OBSERVER` (if missing) + `ADD_WALLET` (idempotent). Signed via the existing owner/broadcaster meta path — **no** new Privy modal beyond Account Opening / Priority.
5. Overlay shows an **iframe** of `https://bloxchain.app` (optional deep-link query if Console supports account address).
6. Player connects MetaMask / WalletConnect **inside** Console to that same address and reads the Privy-owned AccountBlox.

Routine Lane A/B stays modal-free. MetaMask appears only on this optional Console side-path.

---

## 4. Architecture

```text
Godot interactable (computer)
        │
        ▼
React overlay — Terminal panel
  ├── grant observer form (address | ENS)
  │         │
  │         ▼
  │   window.BranchZero → Teller Desk /observer/* (or roleConfig lane)
  │         │
  │         ▼
  │   roleConfigBatch: CREATE_ROLE + ADD_WALLET (empty permissions)
  │
  └── <iframe src="https://bloxchain.app/…">
            └── RainbowKit / WalletConnect / MetaMask (existing Console)
```

| Concern | Owner |
|---------|--------|
| Interactable + dialogue copy | `apps/game` |
| Overlay iframe + grant form + `focusCanvas` | `apps/web` |
| Role batch + revoke + resolve | `apps/teller-desk` (+ bridge methods) |
| Console auth / RainbowKit | **unchanged** (bloxchain.app) |
| Privy Global Wallet in SaaS | **out of scope / parked** |

---

## 5. Role semantics (locked)

1. Role name: **`OBSERVER`** (display: “viewing clerk” / bank copy TBD).
2. **No** function selectors, **no** action bitmap bits — membership only.
3. Opt-in per terminal action — do **not** auto-grant on `/provision` unless a later ROLE_SET bump is explicitly approved.
4. Idempotent: re-adding the same wallet succeeds quietly; maxWallets ≥ 3 (or config).
5. Revoke: same terminal (“remove viewing wallet”) → `REVOKE_WALLET`.
6. Kill tests must prove: observer can read permissioned views; observer **cannot** `requestAndApproveExecution` / wire / roleConfig / Priority.

Signing the grant uses the existing silent session-signer lane for role config (same family as provision role batches) — not a second user Passkey.

---

## 6. Iframe constraints

- Parent shell already avoids COOP/COEP (K8) — required for third-party frames.
- **Answered 2026-09-08: it frames.** `https://bloxchain.app/` sends no `X-Frame-Options` and no CSP at all; a live frame from `http://localhost:5173` fired `load` in ~150 ms and painted the Console. Default URL is `/accounts` (Import + Connect wallet); `VITE_CONSOLE_URL` overrides.
- **A refused frame cannot be detected from the parent** (measured against `X-Frame-Options: deny`): Chrome fires `load` on its own error document, `contentWindow` is an opaque origin so `location` / `document` throw exactly as for a page that loaded fine, `contentWindow.length` is 0 for both, and "Refused to display…" goes to the console, not to script. So the overlay never guesses: the top-level-tab link is permanent, a second escape hatch sits under the frame for the player looking at a blank rectangle, and the load-timeout is kept only for a frame that never loads at all.
- Injected `window.ethereum` inside a **cross-origin** iframe is unreliable; expect **WalletConnect** inside Console, not “MetaMask auto-injects into the iframe.”
- On close: destroy or hide iframe, return keyboard to `#canvas` via `focusCanvas()`.
- Sandbox: allow scripts, same-origin, forms, **popups** (WalletConnect / RainbowKit modals).

Optional later (separate SaaS ask, general embed only): `frame-ancestors` allowlist + `?embed=1` chrome. Not required to start the Branch Zero side.

---

### 6a. As built

`apps/web/src/overlay/Terminal.tsx` (panel) · `apps/web/src/bridge/branchZero.ts` (`u5.1`: `openConsole`,
`observerGrant`, `observerRevoke`, `observerList`, `terminal.closed`) · `apps/teller-desk/src/lanes/observer.ts`
(`/observer/grant` `/observer/revoke` `/observer/list`) · `apps/game/scripts/terminal.gd` +
`apps/game/dialogue/terminal.json`.

`openConsole` resolves as soon as the panel mounts; the game unlocks movement on the `terminal.closed` event, so no
bridge call is held open while a player reads a ledger. MockChain refuses `openConsole` with `CONSOLE_UNAVAILABLE`
rather than claiming to open a panel it cannot produce.

---

## 7. Chain policy

| Action | Chain |
|--------|--------|
| Observer grant / revoke on the player's AccountBlox | Same chain as that account (Remote EVM **1337** for Main wing) |
| ENS name → address for the form | Sepolia UR V2 pin (existing U5) when input looks like a name |
| Console iframe network | Whatever Console is pointing at — **VERIFY** Sepolia vs 1337 story for the demo. Prefer granting observer on the account the iframe can actually see. |

Do not invent a second AccountBlox. Do not move Lane A/B off 1337.

---

## 8. Out of scope

- Privy ↔ RainbowKit Global Wallet / `@privy-io/cross-app-connect` in bloxchain.app
- Painting a live website onto a Godot `SubViewport` mesh (overlay only)
- Giving OBSERVER any write permissions “for convenience”
- Arc wing revive, Uniswap, ship packaging title cards
- Changing Console product auth

---

## 9. Definition of Done (stretch) — **met 2026-09-08**

Evidence: [`progress/2026-09-08-terminal-observer.md`](./progress/2026-09-08-terminal-observer.md).

- [x] Interactable computer opens terminal overlay; Esc / Close returns canvas focus — `MgrScreen` + `AOScreen`; after close `document.activeElement` and `elementFromPoint(centre)` are both `#canvas`, and the panel renders nothing at all
- [x] Grant OBSERVER by `0x` or ENS; on-chain role membership verified — ENS via the existing `/ens/resolve`; `hasRole` true, `getActiveRolePermissions(OBSERVER)` **empty** (kill test O1, tx `0xdcb6c95f…badfe`)
- [x] Revoke path works — O5, tx `0xcfe66118…de8a8`; the reads go straight back to `NoPermission`
- [x] Iframe loads bloxchain.app — verified live (`load` in ~150 ms, Console painted). Fallback shipped **and tested against a host that really refuses framing**: a refused frame is not detectable from the parent (§6), so the top-level-tab link is permanent rather than auto-triggered
- [x] Kill tests: observer reads permissioned view; write paths `NoPermission` — O2 + the O2b control; O3 (three direct calls) and O3b (a valid owner-signed slip submitted by the viewing wallet)
- [x] MockChain answers grant/revoke for greybox; live proof on 1337 — `run_mock_walk.gd` seven legs; `killtests:observer` 9/9
- [x] Progress note + REFLECTION row; HANDOFF §5h checked

---

## 10. Parked follow-ups / owed

- **Human walk (owed):** grant a real MetaMask/WC address → Import/Connect inside the iframe or tab → confirm pending/history on a chain the Console can reach (1337 grant vs Sepolia Console is VERIFY).
- SaaS: embed CSP allowlist + embed chrome (only if framing breaks)
- Deep-link `?account=0x…` on Console
- Diegetic CRT bezel / SubViewport fake screen (cosmetic)
- ROLE_SET bump to create empty OBSERVER at provision time (optional)

## 11. Craft lessons (scrubbed 2026-09-08)

- GameDevOS [`refused-iframe-is-undetectable-from-parent`](https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/refused-iframe-is-undetectable-from-parent.md)
- GameDevOS [`resolve-overlay-open-dont-await-close`](https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/resolve-overlay-open-dont-await-close.md)
- GameDevOS [`membership-only-roles-for-gated-reads`](https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/membership-only-roles-for-gated-reads.md)
