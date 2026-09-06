---
type: handoff
title: Handoff — Claude Code / Fable 5.1
audience: cold agent
created: 2026-09-06
updated: 2026-09-06
product: Branch-Zero
objective: OBJ-2026-0004
first_mission: U4 MVP freeze (G5)
prior_mission: U3 Bank shell (G4) — met 2026-09-06
---

# Handoff — Claude Code (Fable 5.1)

You are a **cold agent** unless the human says you are continuing a prior session. Prefer reading this file over chat memory. You have **freedom on how**. You do **not** have freedom on constraints, scope, or protocol semantics.

**Current mission: U4 MVP freeze (G5)** — error UX, reconnect, first-load budget, a rough 30-second capture.
Do not start U5–U7.

> **U3 met 2026-09-06.** The bank is walkable: five NPCs drive the existing lanes through
> `Dialogue → GameState.run_action → Chain.call_async`; the vault door's clock is the record's `releaseTime`
> against the desk clock; the ledger board reconciles on tab focus; 85 error codes have bank lines. Read
> [`docs/progress/2026-09-06-u3-bank-shell.md`](./progress/2026-09-06-u3-bank-shell.md) **first** — it carries the
> web-Godot findings (a hidden tab is a stopped game; bind `keycode` *and* `physical_keycode`;
> `set_anchors_and_offsets_preset`, not `set_anchors_preset`, for code-built root Controls). Bridge is `u3.0`.
> **Still owed by a human:** the OTP walk of the greybox (sign in → consent → open → pay → wire → release) —
> the mock walk (`?mock=account`) and the kill tests cover the two halves.
>
> **U2 met 2026-09-06.** V6 PASS both ways (the owner's own transactions are signed by the Privy session
> signer and denied for any other account); Lane B green on Remote EVM 1337 — wire → PENDING → approve /
> cancel, with the countdown read from the record's `releaseTime`. Read
> [`docs/progress/2026-09-06-u2-timelock-lane.md`](./progress/2026-09-06-u2-timelock-lane.md) **first**: it
> carries two findings that will otherwise cost you an afternoon (the meta-tx approve path does not enforce
> the timelock; Remote EVM's block clock is frozen between transactions, so a passing `eth_call` proves
> nothing). U1 before it: K2/K5/K8 PASS, Lane A green, human OTP path verified.

---

## 0. Product (one paragraph)

**Branch Zero** — walkable 3D bank (Godot 4.5 GDScript, single-thread web) whose desks are real **Bloxchain** smart-account operations, driven only through public **`@bloxchain/sdk`** (+ viem). Privy = one wallet modal. Teller = broadcaster. Vault clock = on-chain timelock. ETHOnline 2026, Start Fresh.

Not: a wallet UI, DeFi protocol, Bloxchain fork, mainnet, Tactical-AI, GameLab merge target.

---

## 1. Repos

| Role | Path | GitHub |
|------|------|--------|
| **Product** | `D:\My Git Projects\D9-Studio\Branch-Zero` | https://github.com/JaCoderX/Branch-Zero |
| **Craft** | `D:\My Git Projects\D9-Studio\GameDevOS` | https://github.com/D9-Studio/GameDevOS |
| **Lab** | `D:\My Git Projects\D9-Studio\GameLab` | https://github.com/D9-Studio/GameLab |
| **Remote EVM** | `D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM` | consume only |
| **Protocol (reference / CopyBlox scripts)** | `D:\My Git Projects\ParticleCS\Bloxchain-protocol` | **do not path-depend**; may run its deploy/create-wallet scripts **out of band** for bootstrap |

---

## 2. Read order (before code)

1. **This file**
2. [`docs/DEV-LOOP.md`](./DEV-LOOP.md) — U4 row
3. [`docs/progress/2026-09-06-u3-bank-shell.md`](./progress/2026-09-06-u3-bank-shell.md) — newest findings; then
   [`…u2-timelock-lane.md`](./progress/2026-09-06-u2-timelock-lane.md) for the two chain findings
4. [`docs/REMOTE-EVM.md`](./REMOTE-EVM.md) — **do not wipe**; gasLimit **16,777,216**; § 1a frozen block clock
5. [`docs/GAME-DESIGN.md`](./GAME-DESIGN.md) + [`docs/WORLD-3D-ENVIRONMENT.md`](./WORLD-3D-ENVIRONMENT.md) — zones, NPCs, the ledger board
6. [`docs/GODOT.md`](./GODOT.md) §4–5 — bridge method table (now `u3.0`, §4a), MockChain and tester keys (§5a), the background-tab rules
7. [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §1–3, §5–6 (§3.3 is Lane B as built)
8. [`docs/BLOXCHAIN-INTEGRATION.md`](./BLOXCHAIN-INTEGRATION.md) §6–7 — Lane B + roles
9. [`docs/PRIVY.md`](./PRIVY.md) — session signer and the two policy shapes
10. [`docs/SECURITY-AND-KEYS.md`](./SECURITY-AND-KEYS.md)
11. [`docs/REFLECTION.md`](./REFLECTION.md) — kill log + principal decisions
12. [`docs/progress/2026-09-06-u1-signing-lane.md`](./progress/2026-09-06-u1-signing-lane.md) and [`…u1-human-path.md`](./progress/2026-09-06-u1-human-path.md)
13. Craft lessons (do not re-author):  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/sdk-runtime-factory-clones.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/delegated-signing-consent-belongs-to-the-key-owner.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/prefer-timed-path-over-untimed-sibling.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/on-demand-mining-freezes-view-time.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/dual-selector-permission-checks.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/refresh-client-session-after-server-mutation.md

GitHub mirrors under `https://github.com/JaCoderX/Branch-Zero/blob/main/docs/…`.

---

## 3. Hard constraints (non-negotiable)

1. **Runtime dependency = `@bloxchain/sdk` + `viem` only.** Do **not** add or deepen `@bloxchain/contracts`. Do **not** run `chain:compile` / in-repo solc as the product path.
2. Derive behaviour from SDK types + public Bloxchain docs. Mark unknowns `VERIFY`.
3. Godot 4.5 GDScript, web, **threads OFF**. No keys / no RPC in Godot. No `JavaScriptBridge.eval`.
4. **One wallet modal** (Account Opening). Second modal = bug unless K2 client-side fallback is chosen and logged.
5. **Remote EVM first** (`1337`, `http://127.0.0.1:8545`). **Do not** `docker compose down -v` or wipe volumes. Live block gas limit is **16,777,216** (measured in U1; the earlier "≈20M" is retracted) — design under it, and note `cloneBlox` already uses 99.2 % of a block.
6. Keep existing `infra/deployments/remote-evm.json` AccountBlox as the **lab fixture**. New players: prefer **CopyBlox.cloneBlox** (protocol `npm run create-wallet` pattern) once CopyBlox is on-chain; if CopyBlox is not deployed yet, you may deploy **CopyBlox only** (no foundation wipe) or use the fixture owner for K2 — document which.
7. Never use Ganache-parity keys on public nets. No secrets in git.
8. Never merge GameLab ENG trees into this repo.
9. Do not invent custom Solidity.

EIP-712 domain name from SDK: **`Bloxchain`** (`META_TX_DOMAIN`).

---

## 4. U0 already done (do not redo)

- Scaffold: `apps/game`, `apps/web`, `apps/teller-desk`, `packages/shared`, `infra/`
- K1 PASS — Godot 4.5.2 ↔ `window.BranchZero`
- K4 fixture — AccountBlox on 1337; SDK `owner()` matches
- Teller Desk stub `/healthz`
- See progress note for re-run commands

## 4b. U1 already done (do not redo)

- `npm run chain:bootstrap` — CopyBlox `0x7C728214be9A0049e6a86f2137ec61030D0AA964`, demo ERC-20 `dUSDC`
  `0x5017A545b09ab9a30499DE7F431DF0855bCb7275`
- Teller Desk U1: `/session`, `/provision`, `/pay`, `/status`, `/events` (SSE), `/healthz`
- Privy session signer adapter + per-player policy (K2, K5); React overlay with login, one consent, revoke
- Lane A green: `requestAndApproveExecution` moving demo USDC
- `npm -w apps/teller-desk run killtests -- --fresh` re-runs K2 / K5 / Lane A
- Human overlay path verified (OTP → Pay); overlay `refreshSession` after provision (Pay no longer hidden)

---

## 4c. U2 already done (do not redo)

- Lane B: `/wire` `/approve` `/cancel` on the Teller Desk; SSE stages `pending` / `released` / `mined` /
  `cancelled`; a per-record watcher that re-arms on SSE connect and on restart
- Owner transactions via the Privy session signer (`eth_signTransaction`), policy-scoped per player to
  `to` = their account + `chain_id`, calldata-scoped to the three vault selectors where the engine accepts it
- Provisioning is a chain-reconciling, versioned upgrade (`ROLE_SET_VERSION`): guard whitelist, role grants
  for OWNER / BROADCASTER / `BRANCH_MANAGER`, opening balance, owner gas top-up
- Player index persisted to `apps/teller-desk/.data/players.json`; accounts also recoverable from
  `CopyBlox.BloxCloned` logs
- `npm -w apps/teller-desk run killtests:u2 -- --fresh` re-runs V6 + Lane B
- Bridge is `u2.0`: `wire`, `approve`, `cancel`, `listPending` added

## 4d. U3 already done (do not redo)

- Godot greybox (`apps/game`): Entrance, Lobby, Account Opening, Counter 1, Ledger board wall, Vault antechamber
  + door, Manager's glass office; signage for Name Desk / Elevator / FX / Side door. Code-built boxes
  (`scripts/bank_interior.gd`), zones as `Area3D`
- Five NPCs (Mo, Ines, Dev, Ruth, Mr. Okafor) with JSON dialogue (`dialogue/*.json`, NPCS.md §4), every action with
  an "Ask why"; `dialogue/errors.json` — 85 codes (NPCS.md §5 + every SDK `ERROR_SIGNATURES` name + desk/bridge/Privy)
- `autoload/game_state.gd` (desk mirror, `run_action`, desk-clock offset, focus reconcile), `autoload/dialogue.gd`
  (runner), `autoload/mock_chain.gd` (`?mock` / `?mock=account`), vault door + ledger board (SubViewport), HUD, slip
- Bridge `u3.0`: `getSession`, `getHistory`; `login` awaits Privy; desk error codes survive; `tab.visible` event;
  overlay collapses to a debug pill
- `godot --headless --path apps/game -s tests/run_checks.gd` validates dialogue JSON + error coverage

## 5. Mission U1 — Signing lane (G2) — **MET 2026-09-06**

Kept as the record of what G2 required and how it was answered. The next mission is §5b.

### Freedom envelope

- Privy React overlay shape inside `apps/web`
- Fastify route layout for `/session`, `/pay`, SSE stages
- Whether K2 is proven on Remote EVM 1337 (if Privy allows custom chain) or Sepolia
- Whether ENG-0004 scripts live briefly in GameLab or only in `apps/teller-desk` (prefer product; still fill ENG findings)

### Out of scope

- Greybox bank / NPCs / ENS / Arc / Uniswap / U2 timelock UI polish beyond what’s needed to prove Lane A
- Wiping Remote EVM
- Reintroducing `@bloxchain/contracts` compile pipeline
- Deepening `infra/scripts/compile.ts` (leave as historical; do not call it from default npm scripts for U1)

### Definition of Done (G2) — all met

- [x] Privy env filled locally (`PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_KEY`, `PRIVY_SIGNER_ID`, `VITE_PRIVY_APP_ID`, `VITE_PRIVY_SIGNER_ID`). `PRIVY_POLICY_ID` turned out to be unnecessary: policies are minted **per player** via the API.
- [x] Login + embedded wallet in the React overlay; session signer delegated once at Account Opening. **Human OTP path verified 2026-09-06 evening.**
- [x] Teller Desk requests `eth_signTypedData_v4` for a Bloxchain meta-tx; **recover == owner** — **K2 PASS**
- [x] Policy denies out-of-scope typed data — **K5 PASS** (`verifyingContract` + `chainId`; `domain.name` is not a matchable field, documented)
- [x] Lane A: unsigned meta-tx via SDK → session-signer signature → `requestAndApproveExecution` from the broadcaster, moving demo USDC on 1337
- [x] After delegation: no second wallet modal — server-side session signer
- [x] `docs/REFLECTION.md` kill log (K2, K5, K8) + U1 progress notes
- [x] ENG-2026-0004 `findings.md` and `handoff.md` filled

---

## 5b. Mission U2 — Timelock lane (G3) — **MET 2026-09-06**

Kept as the record of what G3 required. The next mission is §5c.

### Freedom envelope

- Lane B request path: prefer **option 1** (owner `eth_sendTransaction` via session signer for `executeWithTimeLock`) if Privy policy can scope it (V6); else **option 2** (REQUESTER role) or document fallback
- Overlay UX for wire / approve / cancel (still HTML overlay — greybox is U3)
- Whether manager approve uses `MANAGER_PK` direct call or owner meta-tx approve
- Headless script vs overlay-first for the countdown proof

### Out of scope

- Greybox zones / NPCs / ledger board (U3)
- ENS, Arc, Uniswap
- Full BRANCH_MANAGER product polish beyond what G3 needs for approve
- Wiping Remote EVM; reintroducing contracts compile

### Definition of Done (G3) — all met

- [x] `/wire` creates a PENDING time-locked execution (demo token transfer); record readable via SDK
- [x] Countdown / vault clock uses **`releaseTime` from chain** (`getTransaction`), not a local timer
- [x] `/approve` completes after release — **owner direct call** (and the manager's runtime role); the owner
      meta-tx approve was rejected on purpose because it skips `releaseTime` (see the progress note)
- [x] `/cancel` works before completion
- [x] SSE stages cover wire → pending → released → approve/cancel → mined/failed; overlay refreshes session and passbook
- [x] Provisioning grants the missing time-delay permissions on the transfer selector and the two handler selectors
- [x] After Account Opening: no second wallet modal — the owner's own transactions are signed by the session signer (V6)
- [x] `docs/REFLECTION.md` + `docs/progress/2026-09-06-u2-timelock-lane.md`; HANDOFF advanced to U3

---

## 5c. Mission U3 — Bank shell (G4) — **MET 2026-09-06**

Kept as the record of what G4 required. The next mission is §5d.

Make the bank walkable and make the desks the operations. Everything the lanes need already exists behind
`window.BranchZero` (`u2.0`); U3 is Godot work plus the NPC lines, not new chain work.

### Freedom envelope

- Greybox geometry and layout, within [`WORLD-3D-ENVIRONMENT.md`](./WORLD-3D-ENVIRONMENT.md)'s budget
- How NPC dialogue is authored (resource files vs scenes) and how zones trigger
- Whether the ledger board polls `listPending` or listens only to bridge `stage` events (prefer events, reconcile on focus)
- Whether the HTML overlay stays visible in dev (keep a debug toggle; it is the only thing that shows bridge traffic)

### Out of scope

- ENS, Arc, Uniswap; art passes; audio beyond placeholder
- Changing lane semantics, role grants, or the Privy policy shapes
- Wiping Remote EVM; reintroducing the contracts compile

### Definition of Done (G4) — all met

- [x] Walkable greybox: Account Opening, Counter, Vault antechamber, Manager's office ([`GAME-DESIGN.md`](./GAME-DESIGN.md) §zones)
- [x] NPCs at each desk drive the real calls through `Chain.call_async` — login/provision, pay, wire, approve/cancel
- [x] Vault door clock renders the chain's `releaseTime`, counting against the desk clock (`serverNow`), never `chainNow`
- [x] Ledger board shows pending records and the last few receipts; reconciles with `listPending` on tab focus
- [x] Every error code in [`NPCS.md`](./NPCS.md) §5 has a line; `BeforeReleaseTime` says "Still cooling — {release_in} to go."
- [x] No `JavaScriptBridge.eval`, no keys in Godot, threads still off; `.pck` 125 KB, `.wasm` unchanged
- [x] Progress note + REFLECTION update; HANDOFF advanced to U4

---

## 5d. Mission U4 — MVP freeze (G5)

Nothing new to build on the chain or in the bank's shape; U4 makes what exists survive a judge's laptop. The human
OTP walk of the greybox is the first thing to do — it is the only U3 item a machine could not close.

### Freedom envelope

- How reconnect is surfaced (HUD toast vs NPC line) as long as it comes from real bridge/SSE state
- Whether the debug pill stays in the shipped build (recommend: yes, collapsed)
- Capture tooling for the 30-second clip

### Out of scope

- ENS, Arc, Uniswap; art passes; new lanes, roles or policy shapes; wiping Remote EVM

### Definition of Done (G5)

- [ ] Human walk on the real bridge: sign in → consent → open → pay → wire → door clock → release; **one modal**, recorded in the progress note with account, txIds, hashes
- [ ] Error UX: every refusal the walk produces shows its NPC line (no raw error on screen); `TIMEOUT` and `RPC` lines verified by killing the Teller Desk mid-session
- [ ] Reconnect: SSE drop → reconnect → board reconciles; Teller Desk restart mid-wire → watcher re-arms, clock continues from `releaseTime`
- [ ] First load measured (wasm + pck + shell) and written down against WORLD-3D §6; obvious wins taken (compression, no debug template)
- [ ] 30-second capture of the vault clock counting down and the door opening
- [ ] Progress note + REFLECTION; HANDOFF advanced to U5

### Suggested sequence

1. Confirm the desk is up (`/healthz` says `U2`) and `npm run export:web` still produces a working canvas.
2. Greybox the four zones and the walk loop; keep the HTML overlay as the debug panel.
3. Wire one desk end to end (Account Opening), then the counter, then the vault.
4. Ledger board + NPC error lines; capture 30 seconds; write the note.

---

## 6. After U4

| Next | Gate |
|------|------|
| U5 ENS | G6 |
| U6 Arc + manager role | G7 |

Cut order unchanged: Uniswap → Manager → Arc → ENS EAC → ENS mint. **Never cut Privy or Lane B.**

---

## 7. Stop conditions

- Need custom Solidity or path-dep on Bloxchain-protocol for **runtime** (bootstrap artifacts OK)
- Would wipe Remote EVM or re-add contracts compile as default
- Scope drifts to greybox/ENS/Arc/Uniswap
- Lane B blocked and PLAN fallback not chosen

Leave: commands, file pointers, kill-test log, next agent can resume from the G5 checklist.
