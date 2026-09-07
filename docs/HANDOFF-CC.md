---
type: handoff
title: Handoff — Claude Code / Fable 5.1
audience: cold agent
created: 2026-09-06
updated: 2026-09-07
product: Branch-Zero
objective: OBJ-2026-0004
first_mission: U5 ENS (G6)
prior_mission: U4+ Priority release (G5b) — met 2026-09-07
---

# Handoff — Claude Code (Fable 5.1)

You are a **cold agent** unless the human says you are continuing a prior session. Prefer reading this file over chat memory. You have **freedom on how**. You do **not** have freedom on constraints, scope, or protocol semantics.

**Current mission: U5 ENS (G6)** — Petra's Name Desk. Kickoff: [`docs/KICKOFF-U5.md`](./KICKOFF-U5.md). Do not
start U6 or **full** U7 ship (video / submission). Early art may run from [`docs/KICKOFF-U7-viz.md`](./KICKOFF-U7-viz.md)
when the principal schedules it so it does not overlap U5 in code or time. Do not regress the U4 freeze or the U4+
Priority desk.

> **U4+ met 2026-09-07 — Priority release is the third way out of the vault.** Read
> [`docs/progress/2026-09-07-u4-plus-priority-release.md`](./progress/2026-09-07-u4-plus-priority-release.md)
> **first**. Ruth is wait-only (owner timed approve after the clock, silent); Mr. Okafor submits an owner-signed
> `SIGN_META_APPROVE` **before** the clock, and that signature is made in the browser by the player's own Privy signer
> behind a Passkey — the "hand scan". `ROLE_SET_VERSION` is **3**: OWNER +`SIGN_META_APPROVE`, `BRANCH_MANAGER`
> +`EXECUTE_META_APPROVE` −`EXECUTE_TIME_DELAY_APPROVE` on `transfer`; Re-check (`/provision`, or
> `npm -w apps/teller-desk run upgrade-players`) upgrades existing players and `/pay` `/wire` `/priority/*` refuse
> `NOT_CONFIGURED` until it has. The per-player Privy typed-data rule now pins `params.action` to
> `SIGN_META_REQUEST_AND_APPROVE`, so the silent session signer **cannot** sign the bypass payload (kill test Y8a) and
> still signs counter pays (Y8b). Bridge is `u4.1` (`priority`; `approve` owner-only). Findings that will otherwise cost
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

1. **This file** (§5f is the open mission)
2. [`docs/DEV-LOOP.md`](./DEV-LOOP.md) — U5 row; lab-first for ENG-0007
3. [`docs/progress/2026-09-07-u4-plus-checkpoint.md`](./progress/2026-09-07-u4-plus-checkpoint.md) — process scrub +
   "ENG-0007 still unrun"; then [`…u4-plus-priority-release.md`](./progress/2026-09-07-u4-plus-priority-release.md) and
   [`…u4-mvp-freeze.md`](./progress/2026-09-07-u4-mvp-freeze.md) for Priority / freeze findings
4. [`docs/ENS.md`](./ENS.md) §2–4 + [`docs/NPCS.md`](./NPCS.md) §4.6 — Name Desk. GameLab ENG-2026-0007
   [`handoff.md`](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0007-ensv2-subname-mint/handoff.md)
   is **partial** (resolve yes; mint needs parent). Do not invent addresses — use the Sepolia table in that handoff.
5. [`docs/REMOTE-EVM.md`](./REMOTE-EVM.md) — **do not wipe**; payments stay on 1337; gasLimit **16,777,216**; § 1a frozen block clock
6. [`docs/GAME-DESIGN.md`](./GAME-DESIGN.md) + [`docs/WORLD-3D-ENVIRONMENT.md`](./WORLD-3D-ENVIRONMENT.md) — zones, NPCs, the ledger board
7. [`docs/GODOT.md`](./GODOT.md) §4–5 — bridge method table (`u4.1` now; U5 adds `ens*`), MockChain (§5a), canvas focus (§5b)
8. [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §1–3, §5–6 (§3.3 is Lane B as built)
9. [`docs/BLOXCHAIN-INTEGRATION.md`](./BLOXCHAIN-INTEGRATION.md) §6–7 — Lane B + roles (do not regress ROLE_SET 3)
10. [`docs/PRIVY.md`](./PRIVY.md) — session signer, action pin, Priority Passkey exception
11. [`docs/SECURITY-AND-KEYS.md`](./SECURITY-AND-KEYS.md) — registrar key is a bank key
12. [`docs/REFLECTION.md`](./REFLECTION.md) — kill log + principal decisions
13. Craft lessons (do not re-author) — especially the U4+ scrub:
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/lab-gate-before-product-unit.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/pin-delegated-signer-to-allowed-payload.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/headless-cannot-prove-user-held-credential.md  
    https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/colliders-that-block-must-not-listen.md  
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

## 5f. Mission U5 — ENS (G6) — **NEXT**

Petra's Name Desk becomes a desk. A player claims a subname under the bank's parent on Sepolia; the name points at
their account; the counter pays by name. Payments stay on Remote EVM 1337 — ENS only answers "which address".
Kickoff: [`docs/KICKOFF-U5.md`](./KICKOFF-U5.md). Design: [`docs/ENS.md`](./ENS.md) §2–4; NPC: [`docs/NPCS.md`](./NPCS.md) §4.6.

**U4+ / G5b met 2026-09-07** — this is the open mission.

**Gate before code:** GameLab ENG-2026-0007 is **partial** ([pre-U5 closeout](./progress/2026-09-07-pre-u5-closeout.md)):
viem resolve on Sepolia works; Universal Resolver answers `branchzero.eth` → `0xc4d7…`; **ENSv2**
`ETHRegistry` owner is still zero and workspace `ENS_REGISTRAR_PK` was empty. Mainnet `branchzero.eth`
is brand-only (separate wallet). U5 may scaffold `/ens/*` + resolve; **do not claim G6 mint** until
`dig-parent` shows a non-zero ENSv2 owner and a lab mint of `test.branchzero.eth` resolves. See GameLab
`work/ENG-2026-0007-ensv2-subname-mint/handoff.md`.

### Freedom envelope

- Which ENSv2 client / contract calls the Teller Desk uses, as long as ENG-0007 proved them and REFLECTION §8 records the dependency
- Name-claim form shape (payment_slip.gd is the pattern); how the names board is drawn (SubViewport like the ledger board)
- Whether reverse names show on receipts in U5 or wait for U7

### Out of scope

- Arc (U6); Priority / Privy step-up productization (done in U4+); Uniswap; art/audio; greybox redesign; wiping Remote EVM; ENS on mainnet;
  moving Lane A/B off 1337; any change to the one-modal rule except the already-shipped Priority Passkey; lane semantics

### Definition of Done (G6)

- [ ] Teller Desk `/ens/available`, `/ens/claim`, `/ens/record`, `/ens/resolve` (the 501 stubs from U2 become real); registrar key from env, never a player key
- [ ] Bridge `u5.0`: `ensAvailable` / `ensMint` / `ensSetText` / `resolveName` over those routes; codes survive the fetch boundary; MockChain answers them
- [ ] Petra at the Name Desk claims a name for the player's account; a taken or invalid name is refused with her line
- [ ] Counter 1 accepts a name on the slip: resolve → address → Lane A / Lane B on 1337 unchanged
- [ ] Names board on the Name Desk wall lists recent claims
- [ ] Freeze intact: `run_checks.gd`, `npm run typecheck`, both kill-test scripts green; canvas focus and `desk.link` unchanged; Account Opening still one modal; Priority Passkey still only on Okafor’s bypass
- [ ] Progress note + REFLECTION; HANDOFF advanced to U6 + `docs/KICKOFF-U6.md`

---

## 6. After U5

| Next | Gate |
|------|------|
| U6 Arc + manager role | G7 |
| U7 Feel / ship | G8–G10 |

**Parallel (principal-scheduled, not the open mission):** early U7 art off the U4+ greybox —
[`docs/KICKOFF-U7-viz.md`](./KICKOFF-U7-viz.md). Materials / kit props / lighting only; leave Name Desk
interactables and all bridge/desk work to U5. Do not advance HANDOFF past U5 from that pass.

Cut order unchanged: Uniswap → Manager → Arc → ENS EAC → ENS mint. **Never cut Privy or Lane B.**

---

## 7. Stop conditions

- Need custom Solidity or path-dep on Bloxchain-protocol for **runtime** (bootstrap artifacts OK)
- Would wipe Remote EVM or re-add contracts compile as default
- Scope drifts to greybox/ENS/Arc/Uniswap
- Lane B blocked and PLAN fallback not chosen

Leave: commands, file pointers, kill-test log, next agent can resume from the G5b checklist.
