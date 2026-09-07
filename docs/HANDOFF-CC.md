---
type: handoff
title: Handoff — Claude Code / Fable 5.1
audience: cold agent
created: 2026-09-06
updated: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
first_mission: S1 Uniswap v4 FX Desk (docs/KICKOFF-S1-uniswap-fx.md) — sponsor #3 while Arc deferred; U7 ship packaging owed after principal polish re-playtest; U6 Arc G7 deferred — revive via docs/ARC.md §5b
prior_mission: Terminal Console + OBSERVER stretch met 2026-09-08 (§5h); U7 polish met 2026-09-07; U7 ship reel met; practice faucet met; U5 ENS (G6) — met 2026-09-07
---

# Handoff — Claude Code (Fable 5.1)

You are a **cold agent** unless the human says you are continuing a prior session. Prefer reading this file over chat memory. You have **freedom on how**. You do **not** have freedom on constraints, scope, or protocol semantics.

**Authorized construction (2026-09-08): S1 Uniswap v4 FX Desk** — prefer **Fable 5.1**. Spec:
[`docs/UNISWAP.md`](./UNISWAP.md). Kickoff (infra → viz):
[`docs/KICKOFF-S1-uniswap-fx.md`](./KICKOFF-S1-uniswap-fx.md). Mission record: **§5i**.
Arc stays **DEFERRED**; Uniswap is the activated **sponsor #3** for submission unless Arc revives first.
Official pitch still names at most three sponsors (Privy + ENS + Uniswap **or** Arc).

> **Terminal Console + OBSERVER met 2026-09-08** (local `docs/progress/2026-09-08-terminal-observer.md`; **§5h**).
> The bank computers in the manager's office and at Account Opening open a terminal overlay: an iframe of
> `bloxchain.app/accounts` plus the account's **viewing wallets**. A viewing wallet is the runtime `OBSERVER` role —
> `CREATE_ROLE` + `ADD_WALLET`, **never** `ADD_FUNCTION_TO_ROLE` — so it passes `_validateAnyRole()` on the
> permissioned registry views (V10) and holds no `TxAction` bit anywhere. Deliberately **outside** `desiredGrants()` /
> `ROLE_SET_VERSION`: Account Opening never grants it and Re-check never touches it. Bridge is now **`u5.1`**
> (`openConsole` / `observerGrant` / `observerRevoke` / `observerList` + the `terminal.closed` event); ENS `u5.0`,
> Priority, the faucet, `desk.link` and canvas focus are unchanged. Live on 1337:
> `npm -w apps/teller-desk run killtests:observer` **9/9**, including a **valid owner-signed Lane A slip** refused
> `NoPermission` when the viewing wallet submits it. `bloxchain.app` frames today; a *refused* frame turns out to be
> undetectable from the parent, so the new-tab fallback is permanent rather than auto-triggered (TERMINAL-CONSOLE §6).
> Privy Global Wallet / RainbowKit cross-app in bloxchain.app stays **parked** — do not reopen.

**Also open: U7 ship packaging** — polish findings 1–10 are **built** ([`KICKOFF-U7-polish.md`](./KICKOFF-U7-polish.md));
**owed** before packaging starts: the principal's cold re-playtest. Kickoff:
[`docs/KICKOFF-U7-ship-package.md`](./KICKOFF-U7-ship-package.md). Prefer **Fable 5.1** for packaging.
Early art Stage 1–5 met; ship reel met (laptop-local). U6 Arc remains **DEFERRED** — do not revive funding;
elevator stays “coming soon.” Do not regress the U4 freeze, the U4+ Priority desk, U5 ENS verbs, the polish DoD
(Bob, Space/E, debug-gated F-keys, Petra at Counter 2), or the practice faucet.

> **Practice faucet met:** [`docs/KICKOFF-U7-practice-faucet.md`](./KICKOFF-U7-practice-faucet.md) —
> Ines **Top up practice dollars** → `/faucet` restores demo balance **up to** `OPENING_BALANCE_USDC` (500);
> provision `fundAccount` stays zero-only; Arc refuses `FAUCET_OFF`. Mock: `tests/run_faucet_walk.gd`. Live 1337:
> `npm -w apps/teller-desk run smoke:faucet` (restore + already-full no-op). Craft lessons:
> GameDevOS `keep-opening-fund-zero-only`, `track-engine-uid-for-new-scripts`.

> **U7 polish pass landed 2026-09-07** (local `docs/progress/2026-09-07-u7-polish.md`): findings 1–10 built and checked
> (`run_checks`, `run_viz_budget`, `run_mock_walk` green; :5173 `?mock=account` walk). Product facts that changed: the vault
> keeper is **Bob**; **Space** talks and **E** orbits right; F2–F8 teleports need **`?debug=1`**; Petra serves from **Counter 2**;
> the elevator refuses Arc with "ARC floor — coming soon" and never rebuilds the interior. **Owed:** the principal's
> re-playtest of the ten findings before packaging. **Live Priority (same evening):** free balance below wire amount →
> meta-approve mined, record `FAILED` / `RECORD_FAILED` (auth OK). **Met:** `/wire` balance pre-check +
> `RECORD_FAILED` copy (`3209ab8`); hygiene follow-up: `RECORD_FAILED` → HTTP 409, Ruth→Bob desk strings, Ines tip on
> InsufficientBalance. Craft lessons scrubbed to GameDevOS (`pending-count-is-not-reserved-balance`,
> `outer-tx-success-is-not-record-completed`, plus four polish lessons).

> **U5 met 2026-09-07 — ENS Name Desk / G6.** Read
> [`docs/progress/2026-09-07-u5-ens-g6.md`](./progress/2026-09-07-u5-ens-g6.md) **first** for live evidence.
> Bridge is **`u5.0`** (`ensAvailable` / `ensMint` / `ensSetText` / `resolveName`). Identity is Sepolia ENSv2 with
> Universal Resolver pinned to `0x85edf8b6b7d4211e2b07aa687506b746357b92cf`; payments stay on Remote EVM 1337.
> Live proof: `u5-mtra3lb6.branchzero.eth` → AccountBlox `0x494f…eBfd`, Lane A pay `0x7ea8…6a58`, duplicate →
> `NAME_TAKEN`. **Still owed on a Godot 4.5 host:** `tests/run_checks.gd` (absent on the U5 build machine).
>
> **U4+ met 2026-09-07 — Priority release is the third way out of the vault.** Read
> [`docs/progress/2026-09-07-u4-plus-priority-release.md`](./progress/2026-09-07-u4-plus-priority-release.md)
> **first**. Ruth is wait-only (owner timed approve after the clock, silent); Mr. Okafor submits an owner-signed
> `SIGN_META_APPROVE` **before** the clock, and that signature is made in the browser by the player's own Privy signer
> behind a Passkey — the "hand scan". `ROLE_SET_VERSION` is **3**: OWNER +`SIGN_META_APPROVE`, `BRANCH_MANAGER`
> +`EXECUTE_META_APPROVE` −`EXECUTE_TIME_DELAY_APPROVE` on `transfer`; Re-check (`/provision`, or
> `npm -w apps/teller-desk run upgrade-players`) upgrades existing players and `/pay` `/wire` `/priority/*` refuse
> `NOT_CONFIGURED` until it has. The per-player Privy typed-data rule now pins `params.action` to
> `SIGN_META_REQUEST_AND_APPROVE`, so the silent session signer **cannot** sign the bypass payload (kill test Y8a) and
> still signs counter pays (Y8b). Bridge methods from U4+ remain; do not regress Priority. Findings that will otherwise cost
> you: the manager's old grant on the `approveTimeLockExecution` *handler* selector is **not revocable** (schema
> `isGrantRevocable=false`) — it stays, inert without the transfer half, and provisioning reports it as "stranded";
> a headless rig cannot hold a Passkey, so `killtests:u4plus` obtains the owner's Priority signature by briefly
> relaxing its own rule and restoring it (documented in the script); the SDK re-wraps a viem-decoded revert as text
> (`Error: NoPermission(address caller)`), so `explainRevert` now also reads that. **Human Passkey walk recorded
> 2026-09-07:** principal `0x7954…` / `0x9C01…`, wire #9 Priority `COMPLETED` 61 s early, hash `0xaa381c00…`,
> `mfaPrompted: true`. Optional: film a silent counter Pay right after.
>
> **U4 met 2026-09-07 — the MVP is frozen.** Read
> [`docs/progress/2026-09-07-u4-mvp-freeze.md`](./progress/2026-09-07-u4-mvp-freeze.md) **first**. What it fixed
> and why: the keyboard died after any overlay click because a full-viewport `#boot` div sat over the canvas
> (Godot listens for keys on the canvas, GODOT.md §5b); a dead Teller Desk came back as `INTERNAL`, now `RPC`; an
> expired Privy token came back as 500 `INTERNAL`, now 401 `AUTH`; the SSE stream closed for good on its first error,
> now it reconnects with a fresh token and Godot hears `desk.link`; half-provisioned players are refused with
> `NOT_CONFIGURED` (Ines re-checks) instead of the chain's `NoPermission`; the player index is written synchronously
> and receipts survive a restart. Bridge is `u4.0` (no new methods). First load measured: `.wasm` 36.3 MB raw /
> 7.05 MB brotli, `.pck` 127 KB, shell entry 2.6 MB raw / 0.53 MB brotli. The principal's real-bridge walk (pay,
> wire, manager release) is on chain and recorded there with hashes; **still owed by a human:** the door-clock
> release at Ruth's window on the real bridge *with the tab visible* for the 30 s clip (the committed clip is the mock).
> `tsx watch` does **not** respawn a killed desk — save a file or restart it.
>
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

1. **This file** (§5i Uniswap FX is authorized; §5h Terminal stretch **met**; packaging §6; U6 §5g deferred)
2. [`docs/DEV-LOOP.md`](./DEV-LOOP.md) — U6 row; ENG-0006 **yes** (K3); U5 / G6 **met**
3. [`docs/progress/2026-09-07-u5-ens-g6.md`](./progress/2026-09-07-u5-ens-g6.md) — Name Desk frozen; then
   [`…k6-yes.md`](./progress/2026-09-07-k6-yes.md) only if you need Sepolia address pins
4. [`docs/ARC.md`](./ARC.md) + GameLab ENG-2026-0006
   [`handoff.md`](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0006-accountblox-on-arc/handoff.md)
   — attach library fixtures; CopyBlox-style clone; never Ganache keys on Arc
5. [`docs/REMOTE-EVM.md`](./REMOTE-EVM.md) — **do not wipe**; Main-wing payments stay on 1337
6. [`docs/GAME-DESIGN.md`](./GAME-DESIGN.md) + [`docs/WORLD-3D-ENVIRONMENT.md`](./WORLD-3D-ENVIRONMENT.md) — Arc wing / elevator
7. [`docs/GODOT.md`](./GODOT.md) §4–5 — bridge is **`u5.1`** (preserve the ENS `u5.0` and terminal methods); MockChain (§5a), canvas focus (§5b)
8. [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §1–3, §5–6 (§3.5 wing switch)
9. [`docs/BLOXCHAIN-INTEGRATION.md`](./BLOXCHAIN-INTEGRATION.md) §6–7 — do not regress ROLE_SET 3 / Priority
10. [`docs/PRIVY.md`](./PRIVY.md) — Arc policy must include Arc `verifyingContract` when provisioning Arc accounts
11. [`docs/SECURITY-AND-KEYS.md`](./SECURITY-AND-KEYS.md) — Arc keys ≠ Remote EVM keys ≠ ENS registrar
12. [`docs/REFLECTION.md`](./REFLECTION.md) — kill log + principal decisions
13. Craft lessons (do not re-author) — especially:
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/sdk-runtime-factory-clones.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/pin-the-resolver-that-walks-your-hierarchy.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/lab-gate-before-product-unit.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/pin-delegated-signer-to-allowed-payload.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/prefer-timed-path-over-untimed-sibling.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/on-demand-mining-freezes-view-time.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/dual-selector-permission-checks.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/hidden-browser-tab-stops-engine-loop.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/preserve-error-codes-across-fetch-boundary.md

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

## 4e. U4 / U4+ already done (do not redo)

- U4 (G5): canvas re-focus, `RPC` / `AUTH` / `NOT_CONFIGURED`, reconnecting SSE + `desk.link`, persisted receipts, first
  load measured — [`docs/progress/2026-09-07-u4-mvp-freeze.md`](./progress/2026-09-07-u4-mvp-freeze.md)
- U4+ (G5b): `ROLE_SET_VERSION` 3 grant split (`lanes/provision.ts` `desiredGrants`, `PRIORITY_RELEASE` flag);
  `lanes/priority.ts` + `/priority/prepare` `/priority/submit`; `/approve` owner-only; typed-data rule pins
  `params.action` (`privy.ts`, `packages/shared/src/metaTx.ts`); overlay `priority()` (user signer + MFA);
  bridge `u4.1` `priority`; Godot `run_action("priority")`, Ruth wait-only, Okafor Priority + recall, 6 new error
  lines, MockChain; `npm -w apps/teller-desk run killtests:u4plus` (Y0–Y9) and `upgrade-players`

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

## 5d. Mission U4 — MVP freeze (G5) — **MET 2026-09-07**

Kept as the record of what G5 required. The next mission is **§5e U4+** (then §5f ENS).

Nothing new to build on the chain or in the bank's shape; U4 makes what exists survive a judge's laptop. Kickoff:
[`docs/KICKOFF-U4.md`](./KICKOFF-U4.md).

**2026-09-07 playtest:** real-bridge Pay + Wire worked after Re-check account synced roles (player had been missing
`configured` / `roleSet`). Feel is good — no art. **Canvas focus loss** after using the React debug overlay is an
in-scope hotfix (click bank → WASD/`E` must work without reload).

**Parallel (do not wait; do not implement here):** GameLab
[ENG-2026-0010](https://github.com/D9-Studio/GameLab/tree/main/work/ENG-2026-0010-express-dual-control) (Express
dual-control) and
[ENG-2026-0011](https://github.com/D9-Studio/GameLab/tree/main/work/ENG-2026-0011-privy-step-up) (Privy step-up).
Promote only after lab handoffs + principal OK (likely U6+).

### Freedom envelope

- How reconnect is surfaced (HUD toast vs NPC line) as long as it comes from real bridge/SSE state
- Whether the debug pill stays in the shipped build (recommend: yes, collapsed)
- How canvas re-focus is wired (`canvas.focus()` on game click / after modal close) as long as overlay does not eat the full viewport when collapsed
- Capture tooling for the 30-second clip

### Out of scope

- ENS, Arc, Uniswap; art passes; Express desk / Privy step-up productization; new lanes, roles or policy shapes; wiping Remote EVM; editing GameLab ENG folders

### Definition of Done (G5) — met, with one human-owed item

- [x] Human walk on the real bridge: the principal's 2026-09-07 playtest is on chain — account `0x9C01…5Cb9`, pay
      records #3 / #4, wire #6 (112.5 dUSDC, `0x6f94c24f…`), released by the manager's stamp at block 99
      (`0x5b4be600…`); one modal (the Privy sign-in at Ines) per the playtest report. Recorded with hashes in the progress
      note (`npm -w apps/teller-desk run evidence` regenerates it)
- [x] Error UX: dead desk → `RPC` (was `INTERNAL`), bad token → `AUTH` (was 500), half-provisioned → `NOT_CONFIGURED`;
      86 codes have lines, `run_checks.gd` green. `TIMEOUT` / `RPC` verified at the bridge layer by killing the desk;
      the in-game rendering of those two lines on the real bridge is part of the owed human walk
- [x] Reconnect: the shell's stream reconnects with backoff (2 → 4 → 8 → 16 → 30 s, measured) and a fresh token;
      Godot toasts `desk.link` and reconciles on reconnect; the desk re-arms watchers on every connect (U2) and now
      keeps receipts across a restart
- [x] First load measured (progress note "First load") — `.wasm` 36.3 MB / 8.9 gzip / 7.05 brotli; `.pck` 127 KB;
      shell entry 2.6 MB / 0.75 gzip / 0.53 brotli. Release template confirmed; the win is transfer compression at the host
- [x] 30-second capture: mock clip committed (`docs/progress/captures/`); the real-bridge clip is owed with the human walk
- [x] **Canvas re-focus** verified in the shell: pill → `body`; click bank → `canvas`; *hide* → `canvas`; `F6` + `E` drive Godot
- [x] Progress note + REFLECTION; HANDOFF had advanced to U5; **U4+ inserted 2026-09-07** (this file §5e)

### Suggested sequence

1. Canvas re-focus hotfix if playtest is blocked; desk `/healthz` says `U2`.
2. Confirm / complete human OTP walk evidence on the real bridge; coach + record.
3. Error UX + reconnect drills; measure load; 30 s capture (tab visible).
4. Progress note + REFLECTION; HANDOFF → U5 (later inserted U4+ before ENS).

---

## 5e. Mission U4+ — Priority release (G5b) — **MET 2026-09-07**

Kept as the record of what G5b required and how it was answered. The next mission is §5f.

A **third** workflow, not a rename of Ruth’s timed vault release and **not** ENG-0010’s short clock.

| Path | Who | When | Credential |
|------|-----|------|------------|
| Wait | **Ruth** | After `releaseTime` | Silent session signer — today’s owner `approveTimeLockExecution` |
| Priority | **Mr. Okafor** | Before `releaseTime` | Owner Passkey / in-game “hand scan”; manager submits meta-approve |
| Recall | Owner and/or manager | While PENDING | Unchanged |

**Okafor must stop being a second Ruth.** Remove his post-clock vault stamp. Copy: “Skip the cooling period — hand scan required.” Prefer **Priority release** / **Manager’s bypass** over “Express.”

Kickoff: [`docs/KICKOFF-U4-plus.md`](./KICKOFF-U4-plus.md). Labs (do not edit):
[ENG-0012](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0012-express-meta-approve-bypass/handoff.md) (chain yes),
[ENG-0011](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0011-privy-step-up/handoff.md) (two signers),
[ENG-0013](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0013-privy-mfa-silent-vs-step-up/handoff.md) (Passkey; `promptMfa()` is not a 1-min cache). ENG-0010 stays timed dual-control only.

**Grant split (product, not a copy of the 0012 clone):** the throwaway lab withheld owner timed-approve. This bank needs Ruth **and** Priority on the same account:

- OWNER: Lane A `SIGN_META_REQUEST_AND_APPROVE` + `EXECUTE_TIME_DELAY_REQUEST` + `_CANCEL` + timed `_APPROVE` (Ruth) + `SIGN_META_APPROVE` (Priority payload)
- `BRANCH_MANAGER`: `_CANCEL` (recall) + `EXECUTE_META_APPROVE` (submit). **Remove** `EXECUTE_TIME_DELAY_APPROVE` from the manager
- Never one role with both `SIGN_META_APPROVE` and `EXECUTE_META_APPROVE` (`ConflictingMetaTxPermissions`)
- Bump `ROLE_SET_VERSION` (currently 2). META bits are account-wide: any PENDING can bypass once granted. Vault-only mode (no META) stays the U2 invariant if you keep a hard switch.

**UX:** overlay step-up only on Priority (`/priority` or `approve as: "priority"`). User signer, not Teller session signer. Silent Pay must stay silent after MFA enroll.

### Freedom envelope

- Route name and whether Godot uses `as: "priority"` vs a new action verb
- Whether Passkey every time (`clear()` + `promptMfa()`, 0013 M2 — recommended for teaching) vs sign-only without `promptMfa()` (unmeasured)
- How Okafor’s desk lists cooling vs ready wires (Priority vs refuse)

### Out of scope

- ENS (U5), Arc (U6), Uniswap, art/audio, greybox redesign
- Restoring Okafor’s post-clock timed stamp
- ENG-0010 short-clock desk; wiping Remote EVM; editing GameLab ENG folders
- Lane A amount routing / policy rewrite; claiming dashboard MFA cache

### Definition of Done (G5b) — met

- [x] Same account (rig clone `0xD026…8DbD`, kill tests Y2 / Y3 / Y7 on 1337, blocks 235–244): Ruth early →
      `BeforeReleaseTime`; Okafor Priority early → `COMPLETED` 102 s before `releaseTime` (`0xf34c88f6…`), payee paid;
      Ruth after clock → `COMPLETED` (`0x99f8a3e5…`)
- [x] Okafor has no post-clock timed stamp: `EXECUTE_TIME_DELAY_APPROVE` removed from `BRANCH_MANAGER` on `transfer`
      (Y0), manager direct approve → `NoPermission` before **and** after the clock (Y2b, Y7b), `/approve as: manager` →
      `MANAGER_NO_STAMP`, `manager.json` offers `priority` + `cancel` only (`run_checks.gd` enforces). Manager cannot
      file (Y5). Owner cannot submit their own meta-approve (Y4)
- [x] Passkey / hand scan on Priority only: the `priority` bridge method is the one second Privy surface (user signer,
      `clear()` + `promptMfa()` when enrolled, `showWalletUIs`); Lane A / Ruth / recall untouched. The session signer
      cannot sign the bypass payload (Y8a `policy_violation`) and still signs a counter pay (Y8b). **Human walk
      2026-09-07:** wire #9, `mfaPrompted: true`, `0xaa381c00…`, 61 s before `releaseTime` (progress note)
- [x] `ROLE_SET_VERSION` 3; Re-check (`/provision`) re-syncs REMOVE+ADD in one batch (Y0 on a roleSet-2 account);
      `upgrade-players` script for players on file; `NOT_CONFIGURED` until then; player index written synchronously (U4)
- [x] NPCS.md §4.4–4.5 as built; `errors.json` 92 lines (+6 codes); `run_checks.gd` checks the Ruth/Okafor verb split
      and the copy line; MockChain answers `priority` (labelled fake) and refuses `approve as: manager`;
      `tests/run_mock_walk.gd` walks both desks headlessly against the mock (PASS)
- [x] Freeze intact: one Account Opening modal (Priority is the documented exception); `focusCanvas()` after the Passkey
      / sign sheets; `desk.link` / `RPC` / `AUTH` / `NOT_CONFIGURED` paths unchanged; `npm run typecheck` clean;
      `killtests` (U1), `killtests:u2`, `killtests:u4plus` green — see the progress note for the run
- [x] Progress note + REFLECTION; HANDOFF advanced to U5 ([`docs/KICKOFF-U5.md`](./KICKOFF-U5.md))

### Suggested sequence

1. Grants + ROLE_SET bump + provision upgrade.
2. Teller Priority path (user-sign meta, manager execute).
3. Ruth wait-only; Okafor Priority + recall; copy + errors.
4. Kill tests Y1–Y7 + freeze; progress + HANDOFF → U5.

---

## 5f. Mission U5 — ENS (G6) — **MET 2026-09-07**

Petra's Name Desk becomes a desk. A player claims a subname under the bank's parent on Sepolia; the name points at
their account; the counter pays by name. Payments stay on Remote EVM 1337 — ENS only answers "which address".
Kickoff: [`docs/KICKOFF-U5.md`](./KICKOFF-U5.md). Design: [`docs/ENS.md`](./ENS.md) §2–4; NPC: [`docs/NPCS.md`](./NPCS.md) §4.6.

**U5 / G6 met 2026-09-07.** The live kill test claimed `u5-mtra3lb6.branchzero.eth` on Sepolia, resolved it through the pinned UR V2 to
the player's AccountBlox, paid that address through Lane A on Remote EVM 1337, and refused the duplicate claim as `NAME_TAKEN`.
The local Godot 4.5 binary is absent on this host, so `run_checks.gd` remains a named verification follow-up; the static dialogue/JSON
review and the real-chain kill path are recorded in [`docs/progress/2026-09-07-u5-ens-g6.md`](./progress/2026-09-07-u5-ens-g6.md).

**Lab gate:** GameLab ENG-2026-0007 is **yes** ([K6 note](./progress/2026-09-07-k6-yes.md)). Parent `branchzero`
owned on ENSv2; UserRegistry `0x64ED…073c`; `test.branchzero.eth` resolves via UR **`0x85ed…b92cf`**.
Rewrite into `/ens/*` + Name Desk; pin that resolver; map claim `setAddr` to the player's AccountBlox.
Mainnet `branchzero.eth` remains brand-only. See GameLab
`work/ENG-2026-0007-ensv2-subname-mint/handoff.md`.

### Freedom envelope

- Which ENSv2 client / contract calls the Teller Desk uses, as long as ENG-0007 proved them and REFLECTION §8 records the dependency
- Name-claim form shape (payment_slip.gd is the pattern); how the names board is drawn (SubViewport like the ledger board)
- Whether reverse names show on receipts in U5 or wait for U7

### Out of scope

- Arc (U6); Priority / Privy step-up productization (done in U4+); Uniswap; art/audio; greybox redesign; wiping Remote EVM; ENS on mainnet;
  moving Lane A/B off 1337; any change to the one-modal rule except the already-shipped Priority Passkey; lane semantics

### Definition of Done (G6)

- [x] Teller Desk `/ens/available`, `/ens/claim`, `/ens/record`, `/ens/resolve`; registrar key from env, never a player key
- [x] Bridge `u5.0`: `ensAvailable` / `ensMint` / `ensSetText` / `resolveName` over those routes; codes survive the fetch boundary; MockChain answers them
- [x] Petra at the Name Desk claims a name for the player's account; a taken or invalid name is refused with her line
- [x] Counter 1 accepts a name on the slip: resolve → address → Lane A / Lane B on 1337 unchanged; live G6 pay proof recorded
- [x] Names board on the Name Desk wall lists recent claims
- [ ] Freeze verification complete: `npm run typecheck` is green; Godot `run_checks.gd` and the existing kill-test scripts are not runnable through `tsx`/Godot on this host (fallbacks and exact commands are recorded in the progress note); canvas focus, `desk.link`, one-modal flow, and Priority path were left unchanged
- [x] Progress note + REFLECTION; HANDOFF advanced to U6 + `docs/KICKOFF-U6.md`

---

## 5g. Mission U6 — Arc + manager role (G7) — **DEFERRED**

Elevator wing: same AccountBlox pattern on **Arc Testnet 5042002** (native USDC gas); provision Arc accounts from
ENG-0006 library fixtures + CopyBlox-style clone. Manager-role product beat only where this file and ARC.md say yes —
do not invent a second Priority path. Kickoff: [`docs/KICKOFF-U6.md`](./KICKOFF-U6.md).

**Principal (2026-09-07):** live Arc funding / CopyBlox / Lane A kills are **parked**. Product wing code stays.
**Revive checklist (authoritative):** [`docs/ARC.md`](./ARC.md) §5b. Do not mark G7 met from readback alone.

**Lab gate:** GameLab ENG-2026-0006 is **yes** (K3 deploy+init+`owner()`). Guard batches / Lane A/B / meta-tx on Arc are
**unproven** — treat as product work with honest kill tests, not as already answered.

### Freedom envelope

- How Arc chain config and `infra/deployments/arc-testnet.json` are shaped, as long as ENG-0006 addresses are pinned first
- Whether the first shippable Arc beat is provision+owner read, a single Lane A pay in native USDC, or both
- Smallest Godot elevator / wing switch that proves the chain split without redesigning the Main wing

### Out of scope

- Full U7 ship; Uniswap; ENS mainnet; moving Main-wing Lane A/B or ENS off their chains; wiping Remote EVM;
  merging ENG trees; re-proving K6/G6; redesigning Petra / Name Desk; weakening ROLE_SET 3

### Definition of Done (G7)

- [x] Arc chain + deployment pins from ENG-0006; Ganache-parity keys refused on Arc
- [ ] Per-player Arc AccountBlox provision path (prefer clone; product code is shipped, but CopyBlox still needs a funded product-controlled Arc deployer)
- [x] Live Arc readback kill with explorer-linked evidence; Main wing 1337 + ENS Sepolia regressions are green
- [x] Manager-role beat is the existing U4+ Priority split (owner signs, manager submits); no second manager path was invented
- [ ] Freeze intact: bridge `u5.0`, Priority, Name Desk; TypeScript is green, but `run_checks.gd` needs the documented Godot 4.5 host
- [x] Progress note + REFLECTION updated; HANDOFF stays at U6 until the named funding/Godot blockers close

**U6 status (2026-09-07): PARTIAL → DEFERRED.** Readback and regressions are live; provision/elevator code is in
tree. No funded `ARC_*` keys; Circle faucet is reCAPTCHA-gated. Do not use ENG-0006 or Remote/Ganache keys.
Evidence: [`docs/progress/2026-09-07-u6-arc-g7.md`](./progress/2026-09-07-u6-arc-g7.md). Revive: ARC.md §5b.

---

## 5h. Mission stretch — Terminal Console + OBSERVER — **MET 2026-09-08**

Diegetic computer → overlay with iframe of `bloxchain.app` + opt-in **OBSERVER** runtime role (empty permissions)
for a MetaMask/EOA or ENS so permissioned registry views work under Console’s existing RainbowKit connect.
Design: [`docs/TERMINAL-CONSOLE.md`](./TERMINAL-CONSOLE.md) (§9 DoD ticked). Kickoff:
[`docs/KICKOFF-terminal-observer.md`](./KICKOFF-terminal-observer.md). Built by **Codex Luna**, 2026-09-08.

**Parked (do not build):** Privy Global Wallet / `@privy-io/cross-app-connect` inside the SaaS Console.

**Do not regress:** OBSERVER stays membership-only and stays out of `desiredGrants()`; the terminal's dialogue may
only run `open_console` / `observer_*` (`run_checks.gd` `_check_terminal()` fails the build otherwise); every overlay
exit calls `focusCanvas()` and the panel unmounts.

### Freedom envelope (as used)

- Which existing `computerScreen` becomes the interactable (manager, AO, or both) — **both**
- Overlay chrome / CRT framing (HTML overlay only — not a live SubViewport texture)
- Bridge version label (`u5.1` vs `u7.t` etc.) as long as ENS + Priority methods remain
- Iframe vs top-level-tab fallback when CSP blocks framing

### Out of scope

- SaaS Privy connector; Arc revive; ship packaging; default OBSERVER on every `/provision`; any write bits on OBSERVER; custom Solidity; merging GameLab ENG trees
- **Do not block on Uniswap** — S1 is a parallel authorized mission (§5i); do not merge FX desk work into Terminal commits

### Definition of Done — **met**

Evidence: local `docs/progress/2026-09-08-terminal-observer.md`.

- [x] Terminal overlay from in-world computer; close returns canvas focus — `MgrScreen` (manager) + `AOScreen` (Account Opening) via `apps/game/scripts/terminal.gd`; after close `document.activeElement` and `elementFromPoint(centre)` are both `#canvas`, and the panel renders nothing at all while closed
- [x] `/observer/grant` + `/observer/revoke` + `/observer/list` via `roleConfigBatch`; OBSERVER has **no** function permissions — `getActiveRolePermissions(OBSERVER)` reads back empty on chain, and the panel prints that list to the player
- [x] Bridge + MockChain methods; ENS or `0x` input — bridge **`u5.1`**; names resolve through the existing `/ens/resolve`; MockChain answers the three observer verbs and refuses `openConsole` (`CONSOLE_UNAVAILABLE`) rather than faking a panel it cannot produce
- [x] Iframe loads bloxchain.app **and** a documented fallback — it frames today (no `X-Frame-Options`, no `frame-ancestors`; `load` in ~150 ms). A *refused* frame is undetectable from the parent, so the new-tab link is permanent instead of auto-triggered (TERMINAL-CONSOLE §6)
- [x] Kill tests — `npm -w apps/teller-desk run killtests:observer` **9/9** on 1337: reads pass with the role (O2) and `NoPermission` without it (O2b control); three direct writes refused (O3); a **valid owner-signed Lane A slip** submitted by the viewing wallet refused (O3b); grant `0xdcb6c95f…badfe`, revoke `0xcfe66118…de8a8`; Re-check leaves it alone (O6)
- [x] REFLECTION row; this §5h DoD updated

**Not owed, not done:** no human has driven grant → Import → Connect *inside* the framed Console end to end (it needs
an OTP sign-in and a MetaMask). The grant half is on chain, the frame half is screenshotted. Which chain the Console
itself can reach stays a Console-side **VERIFY** (TERMINAL-CONSOLE §7) — grant on the account the iframe can see.

---

## 5i. Mission S1 — Uniswap v4 FX Desk — **OPEN**

Activated **2026-09-08** as sponsor **#3** while U6 Arc stays deferred. End-to-end: Sepolia infra → AccountBlox
guards → Teller `/quote` `/swap` → bridge → Kenji + FX desk visualization → `FEEDBACK.md` + Uniswap form.
Spec: [`docs/UNISWAP.md`](./UNISWAP.md). Kickoff:
[`docs/KICKOFF-S1-uniswap-fx.md`](./KICKOFF-S1-uniswap-fx.md). Prefer **Fable 5.1**.

**Reset:** v4 only; Sepolia for FX writes; 1337 for Main-wing pay/wire; no custom SwapHelper; no new Privy modal;
MockChain for greybox only — **K7 evidence must be live Sepolia**.

### Freedom envelope

- Exact FX desk placement in Main wing (reuse a bay/alcove vs thin new module)
- Quote-board art (LED panel / CRT / wall plaque) within viz budget
- Bridge method names (`quote` / `fxQuote` / `fxSwap`)
- Whether first FX visit upgrades guards via Re-check vs dedicated `/fx/enable`

### Out of scope

- Arc revive / funding; Terminal/OBSERVER; ship packaging title cards; Unichain; CCA; custom v4 hooks;
  v2/v3 as the primary path; custom Solidity; wiping Remote EVM; ENS mainnet

### Definition of Done

- [ ] Sepolia v4 addresses + liquid pool documented in `infra/deployments/sepolia.json` / UNISWAP.md
- [ ] Guard whitelist: token `approve`, Permit2 `approve`, UniversalRouter `execute`
- [ ] Live K7: AccountBlox completes a v4 swap on Sepolia; hash in progress note
- [ ] Desk `/quote` + `/swap` + bridge + Kenji dialogue (mock + live paths)
- [ ] In-world FX desk + Kenji + quote board + sponsor signage; `run_viz_budget` / named shot OK
- [ ] `FEEDBACK.md` committed; README points at integration lines; form reminder recorded
- [ ] `run_checks` green; no freeze / Priority / ENS / faucet regression
- [ ] REFLECTION K7 row; this §5i DoD updated

---

## 6. After U5 / with U6 deferred

| Next | Gate |
|------|------|
| **Terminal Console + OBSERVER** | Stretch — **met** 2026-09-08 (§5h; local `docs/progress/2026-09-08-terminal-observer.md`) |
| U7 polish | Principal playtest — **met** 2026-09-07 ([`KICKOFF-U7-polish.md`](./KICKOFF-U7-polish.md); owed: principal re-playtest) |
| **U7 ship packaging** | G8–G10 — **open** after re-playtest ([`KICKOFF-U7-ship-package.md`](./KICKOFF-U7-ship-package.md)) |
| U6 Arc + manager role | G7 — **deferred** (revive ARC.md §5b) |

**Now:** staged art Stage 1–5 **met**; ship reel **met**; polish **met** (code); practice faucet **met**;
Terminal/OBSERVER stretch **met**. Do not reopen Arc funding; elevator refuses with coming-soon. Packaging waits on
the principal's re-walk of the ten findings.

Cut order unchanged: Uniswap → Manager → Arc → ENS EAC → ENS mint. **Never cut Privy or Lane B.**

---

## 7. Stop conditions

- Need custom Solidity or path-dep on Bloxchain-protocol for **runtime** (bootstrap artifacts OK)
- Would wipe Remote EVM or re-add contracts compile as default
- Scope drifts to greybox redesign / ENS rework / Uniswap without a gate
- Lane B blocked and PLAN fallback not chosen
- A change would add Privy cross-app, or any write permission on OBSERVER

Leave: commands, file pointers, kill-test log. Packaging resumes from
[`docs/KICKOFF-U7-ship-package.md`](./KICKOFF-U7-ship-package.md) after the principal's polish re-playtest.
