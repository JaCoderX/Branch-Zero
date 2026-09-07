# Reflection — Design Review, Sponsor Matrix, Kill Tests, Open Questions

> This is the file we argue with. Everything else in `docs/` states decisions; this one records why, what could kill them, and what we deliberately left out.

Related: [PLAN.md](./PLAN.md) § 7 (kill tests) · [DEMO-SCRIPT.md](./DEMO-SCRIPT.md)

Review method: run the idea through four plain checklists — reality, security, workflow, and language — and record verdicts. No special methodology; just structured skepticism before we build.

---

## 1. The idea, restated without adjectives

A Godot 3D bank. Each desk is one Bloxchain account operation. Privy provides the owner key and a policy-bound server signer so the game has one wallet modal total. ENSv2 subnames are the customer identity layer. Arc Testnet is a second wing showing the same account on USDC-fee rails. Only the public `@bloxchain/sdk` / `@bloxchain/contracts` packages are used.

What it is **not**: a web admin dashboard with a 3D skin; a DeFi yield product; a wallet; an audited bank.

---

## 2. Design review

### 2.1 Reality check

| Claim | Verdict | Evidence needed | Action |
|-------|---------|-----------------|--------|
| "Signs in the background with no pop-ups" | **True, and now demonstrated** — one delegation modal at Account Opening; afterwards zero. Privy accepts the Bloxchain typed data and the policy bounds it (K2, K5 both PASS 2026-09-06) | K2, K5 — done | Say "one pop-up" in all copy; never "zero" |
| "Everything you see is on chain" | True for statuses, balances, names, release times; **false** for NPC mood, queue animations, achievements (local) | Code review: no local timers for release | Keep achievements clearly cosmetic; board copy reads chain |
| "The vault clock is a timelock, not an animation" | **True, and enforced by the contract** — the countdown renders `releaseTime` from `getTransaction`, and an early release is refused on chain, not by the UI (U2, LaneB-1). Only the *"now"* side of the countdown is local, corrected against the Teller Desk's clock, because Remote EVM's block timestamp is frozen between transactions | LaneB-1 / LaneB-3 | Never count down against `chainNow`; say "corrected against the desk clock" if asked |
| "Uses only the public Bloxchain SDK" | True if we deploy definition libraries from package artifacts and add no Solidity | K4 | `infra/` contains only deploy scripts against package ABIs/bytecode |
| "Works on Arc" | Unverified until K3 | K3 | Day-1 spike; fallback documented |
| "10 days is enough" | Tight. MVP = Sepolia main wing + Privy + Lane A/B. Everything else is ladder | Day-5 gate | Cut order fixed: Uniswap → Manager runtime role → Arc wing → ENS EAC → ENS mint (never cut Privy or Lane B) |
| "Judges will get it in 3 minutes" | Risk: too many concepts. The video must show exactly four things (login, pay, wire+approve, name) plus the elevator | Dry run with someone outside crypto on Day 9 | Storyboard locked in DEMO-SCRIPT |
| "Godot web build is fine" | True for low-poly single-thread; first load ≤ 25 MB is the real constraint | K1 + size check every evening | Perf budget in WORLD-3D |

### 2.2 Security review

| Invariant | Held by | Our exposure | Verdict |
|-----------|---------|--------------|---------|
| Broadcaster cannot act without owner signature | Bloxchain meta-tx verification | none | pass |
| Signed slip cannot be replayed or moved cross-chain | nonce + deadline + chainId + verifyingContract in EIP-712 digest | none | pass |
| Large transfers cannot skip the timelock | Our routing rule (amount > threshold ⇒ Lane B) is **off-chain**; on-chain, the owner's session signer could sign a Lane A meta-tx for any amount to a whitelisted payee | Privy policy cannot see the amount inside `executionOptions` bytes | **partial** — document honestly; mitigate with per-payee whitelist and a Teller Desk soft cap; optional follow-up: amount-scoped guards in a future Bloxchain release (out of scope for this hackathon) |
| A wire in the vault cannot be released early | `EngineBlox.txDelayedApproval` checks `releaseTime`; the **meta-tx** approve path (`_txApprovalWithMetaTx`) deliberately does not | Provisioning grants **no** `SIGN_META_APPROVE` / `EXECUTE_META_APPROVE` on the ERC-20 transfer selector, so no role can take the untimed path; owner and manager both approve directly (U2) | **pass** — LaneB-1 asserts the on-chain refusal (`BeforeReleaseTime`) rather than trusting the greyed button |
| The Teller Desk cannot file a wire on the player's behalf | `executeWithTimeLock` needs `EXECUTE_TIME_DELAY_REQUEST`, held by OWNER only; the broadcaster holds meta-execute actions | The request is an owner transaction signed in Privy's enclave; no `REQUESTER` role was created (U2 chose Lane B option 1) | **pass** |
| Session signer cannot touch another player's account | Privy policy pins `verifyingContract` + `chainId`, one policy per player | K5 **PASS** 2026-09-06 | **pass** — verified by asking Privy to sign for the U0 fixture account and being refused |
| Deployer cannot retain control after opening | ownership set to player at `initialize`; deployer holds no role afterwards | verify `owner()` after provisioning in tests | pass |
| Recovery is time-locked | Bloxchain `SecureOwnable` | recovery key is cold; flow is lore in MVP | pass (not exercised) |
| No secrets in browser or Godot | architecture | JSON bridge, keys server-side | pass |

**Security summary:** acceptable for a hackathon **if** the partial invariant is stated in the README and in the Manager's "Ask why" dialogue. Do not claim the vault clock is the only path for large amounts.

### 2.3 Workflow review

- Every player action is a **request → (sign) → broadcast → observe** loop with one owner of each step. Nothing loops back into the browser after step 1.
- The timelock is the only asynchronous state; SSE + `listPending` reconcile handles background tabs.
- Failure modes have NPC lines; the game never shows a raw error.
- Dependency direction: Godot → bridge → Teller Desk → SDK → chain; no reverse calls except events. Clean.
- Risk: single-process Teller Desk with an in-memory account map. Mitigation: SQLite file + idempotency keys; acceptable for demo. **U4:** the player index is a synchronously written JSON file, receipts persist too, and the browser's stage stream reconnects on its own — a desk restart mid-wire costs the player one toast.

### 2.4 Language / copy review

- On screen: everyday bank words ("approved payee", "wire", "manager approval", "network fee"). Protocol jargon only in "Ask why" and receipts' fine print. Implementation detail only in README/docs.
- Sponsor names appear as in-world signage (Privy plaque at Account Opening, ENS at the Name Desk, Arc on the elevator panel) — visible in video without narration doing all the work.
- Do not overclaim on Bloxchain: describe it as "an open-source smart-account protocol with built-in timelocks, roles and guards", link the public GitHub / npm packages, and do not present Branch Zero as an official Bloxchain product.

---

## 3. Sponsor decision matrix

Scoring 1–5. Weights: fit 0.35, feasibility in 10 days 0.30, prize size/odds 0.20, story value 0.15.

| Sponsor | Fit | Feasibility | Prize | Story | Weighted | Decision |
|---------|-----|-------------|-------|-------|----------|----------|
| **Privy** | 5 (B2B financial product criteria read like our spec) | 4 (session signers are documented; K2/K5 risk) | 3 ($2.5k single) | 5 (enables the no-pop-up thesis) | **4.35** | **Primary** |
| **ENS (ENSv2)** | 4 (subnames as accounts, records as passbook, EAC as staff roles) | 3 (Sepolia beta; contract tutorial needed; K6) | 4 ($4.5k, four places) | 4 | **3.70** | **Primary** |
| **Arc** | 4 (USDC bank, conditional payments, multi-step settlement) | 3 (unknown EVM compat; K3) | 4 ($10k pool, several bounties) | 4 (elevator = chain switch is a great beat) | **3.70** | **Third** |
| Uniswap v4 | 3 (a bank FX desk is plausible, but swaps are not the thesis) | 2 (Permit2 + Universal Router encoding from a contract account; three guarded calls) | 3 | 3 | **2.70** | Swap-in if K3 fails; else S1 stretch |
| Others considered (briefly): Circle Agent Stack, account-abstraction sponsors | 2 | 2 | — | 2 | — | No — dilutes the "governed account, not 4337" message |

Rule: max three sponsors in the submission unless S1 ships cleanly.

---

## 4. Kill tests

Defined in [PLAN.md](./PLAN.md) § 7 (K1–K6). Added here:

| ID | Question | Method | Fallback |
|----|----------|--------|----------|
| K7 | Can a contract account (`AccountBlox`) complete a v4 swap via Universal Router in three guarded calls on Sepolia? | Script: approve → Permit2 approve → `execute`; check output token balance | Uniswap stays documented-only |
| K8 | Does Godot 4.5 web build + Privy iframe coexist without COOP/COEP (single-threaded)? | Load shell with Privy modal open; check console for cross-origin errors | Host Privy login on a separate page before the game loads; pass token via URL fragment |

### Kill test log

| ID | Date | Result | Notes / fallback chosen |
|----|------|--------|-------------------------|
| K1 | 2026-09-06 | **PASS** | Godot **4.5.2-stable** (standard/GDScript) Web export, `variant/thread_support=false`; console: `Build configuration: Emscripten 4.0.10, single-threaded, no GDExtension support`. Served by the Vite shell (`apps/web`) with **no** COOP/COEP (`crossOriginIsolated === false`, `SharedArrayBuffer` undefined). `autoload/chain.gd` → `JavaScriptBridge.get_interface("BranchZero")` + `create_callback`; `echo` round-trip returned the sent string; `chainInfo` and `accountInfo` (SDK `owner()` read made by the TS bridge on Remote EVM) also returned through the same callback. No `eval`. Evidence: `docs/progress/2026-09-06-u0-foundation.md`. Re-run: `npm run export:web && npm run dev:web`. |
| K2 | 2026-09-06 | **PASS** | Privy session signer over a Bloxchain meta-tx on Remote EVM 1337 (no Sepolia needed — `eth_signTypedData_v4` is chain-agnostic; the chain id lives in the domain). `recoverAddress(digest)` = embedded wallet = `owner()` on the player's cloned AccountBlox; checked once by the SDK's `signMetaTransactionWithWallet` and once independently in the kill test. Re-run: `npm -w apps/teller-desk run killtests -- --fresh`. Evidence: `docs/progress/2026-09-06-u1-signing-lane.md`. |
| K3 | — | pending | After G5. Needs a funded Arc Testnet key (never a Ganache-parity key). |
| K4 | 2026-09-06 | **FAIL as written → lab PASS; product path revised** | npm contracts package = source only. U0 compile fallback produced fixture `0x4bf7…7ba2` on 1337 (kept). **Principal 2026-09-06 evening: reject compile-from-contracts as product path.** Ongoing: `@bloxchain/sdk` only; new accounts via **CopyBlox** / protocol deploy scripts; do not wipe Remote EVM. |
| K5 | 2026-09-06 | **PASS (with one caveat)** | A per-player policy pinning `domain.verifyingContract` + `domain.chainId` denies typed data for an account the wallet does not own: `400 policy_violation`. **Caveat:** `domain.name` is *not* a supported condition field (`EthereumTypedDataDomainConditionField` = `chainId \| verifyingContract \| chain_id \| verifying_contract`), so the `"name": "Bloxchain"` clause sketched in PRIVY.md §4 cannot be expressed. `verifyingContract` is the stronger pin. Policies are created via the API per player, not in the dashboard. |
| K6 | — | pending | Producer registers a Sepolia `.eth` parent first (commit/reveal wait). |
| K7 | — | pending (S1 only) | |
| K8 | 2026-09-06 | **PASS** | Privy login modal + `auth.privy.io/.../embedded-wallets` iframe render over the running Godot 4.5.2 single-threaded canvas served by the Vite shell. `crossOriginIsolated === false`, no COOP/COEP, no cross-origin console errors. The separate-login-page fallback is not needed. |
| V6 | 2026-09-06 | **PASS** (both directions) | Lane B option 1 works and is bounded. **a)** The player's embedded wallet signed its own `executeWithTimeLock` via the session signer (`eth_signTransaction`; the Teller Desk broadcasts, so Privy needs no RPC to chain 1337) and the record landed PENDING with `releaseTime` = block timestamp + 120 s. **b)** The same wallet, same call, addressed to the U0 fixture: `400 policy_violation`. Policy rules are calldata-scoped (`ethereum_calldata` + ABI, matching `function.param`) with `to` and `chain_id` pinned; a to-only shape is the recorded per-player fallback (`player.txPolicyMode`). Re-run: `npm -w apps/teller-desk run killtests:u2 -- --fresh`. |
| G4-walk | 2026-09-06 | **PASS (mock) · real-bridge desk calls PASS · human OTP pending** | Godot greybox: five NPCs drive `login` / `addSessionSigner` / `provision` / `pay` / `wire` / `approve` / `cancel` through `Dialogue → GameState.run_action → Chain.call_async`; the vault door clock renders the record's `releaseTime` against the desk clock (`0:05 → 0:04` on the door face in the mock walk); the ledger board lists pending + receipts and reconciles with `listPending` on `tab.visible` / window focus. Real bridge: `getSession` on boot opens **no** modal; Ines's **Sign in** opens the one Privy modal; dismissing it yields `LOGIN_CANCELLED` and a bank line. Every NPCS.md §5 code (and every SDK `ERROR_SIGNATURES` name) has a line — `tests/run_checks.gd`. Evidence: `docs/progress/2026-09-06-u3-bank-shell.md`. |
| G5-freeze | 2026-09-07 | **PASS (product) · human clip owed** | **Canvas focus:** the U4 playtest's dead keyboard was a full-viewport `#boot` div left over the canvas — Godot listens for `keydown` on the canvas, and every click on the bank hit the div instead, so Godot's own `mousedown → canvas.focus()` never ran. Fixed (`pointer-events: none`, hidden once running) plus `focusCanvas()` after the overlay's *hide* and after the Privy modals; verified in the shell: pill → `body`, click bank → `canvas`, *hide* → `canvas`, `F6` + `E` drive Godot. **Error UX:** a dead Teller Desk behind the proxy is now `RPC` (was `INTERNAL` — the proxy's 500 has no JSON body), a bad Privy token is 401 `AUTH` (was 500), an account on file without `configured`/`roleSet` is refused `NOT_CONFIGURED` on `/pay` `/wire` (Ines re-checks) — 86 lines, `run_checks.gd` green. **Reconnect:** the shell's `EventSource` used to `close()` on its first error; it now reconnects with a fresh token, backoff measured 2 → 4 → 8 → 16 → 30 s, and pushes `desk.link` to Godot, which toasts and reconciles; receipts persist across a desk restart. **Human walk on the real bridge is on chain:** account `0x9C01…5Cb9`, pay #3/#4, wire #6 (`0x6f94c24f…`), manager release at block 99 (`0x5b4be600…`). **First load:** `.wasm` 36.3 MB / 7.05 MB brotli, `.pck` 127 KB, shell entry 2.6 MB / 0.53 MB brotli. Evidence: `docs/progress/2026-09-07-u4-mvp-freeze.md`. **Owed:** the 30 s clip of the real door clock with the tab visible (mock clip committed). |
| LaneB | 2026-09-06 | **PASS** | wire → PENDING → approve / cancel on Remote EVM 1337. Early approve reverts `BeforeReleaseTime` **on chain** (`0xee142cd7`); cancel while PENDING → CANCELLED with nothing moved; after the full 120 s, approve → COMPLETED and 250 dUSDC reached the payee; the `BRANCH_MANAGER` runtime role approved a third wire after its own early attempt was refused. Evidence: `docs/progress/2026-09-06-u2-timelock-lane.md`. |

Fill on Day 1–2. A `fail` with no chosen fallback blocks G1. **G1 status (2026-09-06): met.** K4 product policy closed by principal (fixture kept, SDK+CopyBlox going forward). **G2 status (2026-09-06): met** — K2, K5, K8 pass; Lane A green on 1337. **G3 status (2026-09-06): met** — V6 passes in both directions and Lane B is green; the vault clock is enforced by the contract, not the UI. **G4 status (2026-09-06): met** — the bank is walkable, the desks are the calls, the door clock is the record's `releaseTime`; the human OTP walk of the greybox is the carried caveat (same class as U1/U2). **G5 status (2026-09-07): met — MVP frozen.** The principal's real-bridge pay → wire → release is on chain; the shell survives a dead desk, a restart and a lost keyboard; what remains for a human is the 30 s clip of the real clock with the tab visible.

Findings recorded alongside:

- Registry views are **permissioned** — pass a sender on `eth_call`. In SDK terms: `executeReadContract` uses
  `walletClient.account`, so a wrapper built with `undefined` as the wallet client gets `NoPermission(0x0)`.
  Construct readers with the broadcaster (or owner) wallet client.
- Live Remote EVM block gas ceiling is **16,777,216** — the "≈20M" in REMOTE-EVM.md was optimistic.
  `AccountBlox.initialize` ≈ 16.06 M; `CopyBlox.cloneBlox` (clone + initialize in one tx) needs ~16.65 M and
  uses 16.20 M, i.e. **99.2 % of a block**. It fits only as the sole transaction in its block. **Do not wipe** volumes.
- **A whitelist alone does not authorise Lane A** (V4). The default role grants after `initialize` cover only
  the controller's own selectors; `requestAndApproveExecution` checks the *execution* selector, so the
  ERC-20 transfer selector needs an explicit role config batch (OWNER `SIGN_META_REQUEST_AND_APPROVE`,
  BROADCASTER `EXECUTE_META_REQUEST_AND_APPROVE`). Without it: `NoPermission(caller)`.
- `createMetaTxParams(..., deadline, ...)` takes a **duration**; the contract returns `block.timestamp + deadline`.
- **Godot web listens for keys on the canvas element.** Any element that covers the canvas as a hit target — even an
  invisible status div — stops Godot from re-focusing itself on click, and the keyboard dies after the first overlay
  interaction. Keep `#game` clear; give focus back explicitly after the interactions the shell owns (U4).
- **`tsx watch` does not respawn a killed child.** It waits for a file change. A "kill the desk" drill must be Ctrl+C
  + restart (or a file save); a stray second `npm run dev:teller` crashes on `EADDRINUSE`, stays alive, and then races the
  first on every save. Three such watchers were found on the dev box during U4 (U4).
- A user-controlled Privy embedded wallet is owned by the **user's** key quorum. The server cannot attach a
  session signer or a policy to it (`401 No valid authorization keys…`); only the browser consent can. Policy
  *rules*, being app-owned, can be tightened server-side afterwards.
---

## 5. Originality check (what already exists)

Prior ETHGlobal "bank" / 3D projects mostly fall into: (a) DeFi dashboards skinned as a bank, (b) metaverse lobbies with wallet-connect buttons, (c) educational quizzes. None found that make **the security workflow itself** the walkable object — timelock as a vault clock, broadcaster as a teller, roles as staff, guards as approved-payee lists. That mapping is the contribution; the 3D is the delivery, not the novelty. Re-check ETHGlobal showcase on Day 9 with the terms "bank", "Godot", "timelock", "teller" and note any overlap in the README's "Related work".

---

## 6. Open questions (owner, due)

| # | Question | Owner | Due | Default if unanswered |
|---|----------|-------|-----|------------------------|
| 1 | Exact EIP-712 domain `name`/`version` for Privy policy | protocol/backend | Day 2 | **Closed 2026-09-06.** Domain name is `Bloxchain` (SDK `META_TX_DOMAIN`), but Privy **cannot** condition on `domain.name` — only `verifyingContract` / `chainId`. Policy is created per player through the API (`apps/teller-desk/src/privy.ts`), not a committed JSON file. |
| 2 | Are definition libraries in `@bloxchain/contracts` published with Sepolia addresses? | backend | Day 1 (K4) | **Answered:** no bytecode in npm. **Product path:** do not use contracts package; SDK + CopyBlox / protocol scripts |
| 3 | ENSv2 Sepolia: which registry for subnames | backend | Day 4 | Follow contract-developer tutorial default |
| 4 | Do we own a `.eth` name on Sepolia already? | producer | Day 1 | Register a test name via ENS Sepolia app |
| 5 | Team size / who owns Godot art | producer | Day 1 | Solo: Kenney/Quaternius CC0 assets only |
| 6 | Video length / AI disclosure | producer | Day 9 | Assume 3 min, disclose Cursor + models |
| 7 | Arc Launch vs DeFi bounty | producer | Day 8 | DeFi only |
| 8 | Privy dashboard: auth key + policy + custom 1337? | producer | done | **Closed 2026-09-06.** Auth key + key quorum were already set; policies are created per player via the API, so no dashboard policy is needed; no custom chain entry was needed either — typed-data signing is chain-agnostic and 1337 rides in the domain. Only open dashboard nicety: embedded wallets are `create_on_login: off`, so the overlay creates one explicitly. |

---

## 7. Things we decided not to do

- **Custom Solidity.** Even a tiny helper would break the "public SDK only" rule and the audit story.
- **ERC-4337 / bundlers.** Different thesis (UX abstraction vs governed operations); mixing them confuses judges.
- **Multiplayer.** Tellers seeing each other is charming and irrelevant; SSE per player only.
- **Real timelocks (24 h).** Demo uses 60–120 s; the Manager explains it is configurable.
- **Mobile web.** Desktop Chrome/Edge/Firefox only.
- **A token or points economy.** Achievements are cosmetic stamps; no on-chain rewards.
- **Express (corrected Sep 7 evening, named Priority Sep 7 night).** ENG-0010 = dual-control **with clock** (META_APPROVE closed) — useful, **not** this beat. **Priority release** = optional instant bypass via owner-signed meta-tx approve submitted by the manager **before** `releaseTime` (ENG-2026-0012 yes). Step-up = ENG-0011 + ENG-0013 (Passkey; `promptMfa()` re-challenges at ~9s/~21s — do not claim 1-min cache). Ruth keeps timed owner approve. Okafor is **not** a post-clock vault stamp. Vault-only accounts keep U2: no META_APPROVE on `transfer`. Do not ship a shorter timelock from 0010.

---

## 8. Decision log (append-only)

| Date | Decision | Why | Revisit |
|------|----------|-----|---------|
| Sep 6 | Godot 4.5 GDScript, single-threaded web export | C# not on web; threads break iframes | never |
| Sep 6 | Sponsors: Privy + ENS + Arc; Uniswap swap-in | § 3 | Day 5 gate |
| Sep 6 | Server-side Privy session signer via viem `toAccount` + SDK `MetaTransactionSigner` | SDK does not export the EIP-712 constants; using its signer keeps parity with the contracts | K2 |
| Sep 6 | Large-amount routing to Lane B is off-chain policy; stated as partial invariant | Privy policy cannot parse `executionOptions` | document in README; no protocol change in this repo |
| Sep 6 | Remote EVM (Nethermind `1337`) is the default lab/dev chain | Sepolia faucet and ENS waits must not block Lane A/B construction | Docker down → name blocker; never publish Ganache-parity keys |
| Sep 6 | GameDevOS OBJ-2026-0004 + GameLab ENG-0003…0008 bound | Lab answers kill tests; product is rewritten; no ENG merge | after G5 scrub first lesson |
| Sep 6 (U0) | Compile published sources instead of consuming npm artifacts (K4 fallback) | Public packages ship no bytecode and no `AccountBlox`; the template is fetched from the public repo at the `contracts-v1.0.0` commit, pinned by commit + sha256, into a git-ignored build dir. Zero Solidity authored or vendored here | **Superseded evening same day** |
| Sep 6 (evening) | **Reject** `@bloxchain/contracts` / in-repo solc as product path; runtime = `@bloxchain/sdk` only | Principal: SDK is the integrator surface; contracts package is not how we ship | — |
| Sep 6 (evening) | New wallets via **CopyBlox** (protocol `create-wallet`); keep U0 AccountBlox fixture | Matches protocol best practice; no chain wipe | Deploy CopyBlox only when needed |
| Sep 6 (evening) | **Do not wipe** Remote EVM; gas ceiling ≈ **20M** | Shared lab + MetaMask hard limit | never wipe without principal order |
| Sep 6 (evening) | Privy application created | Unblocks U1 / ENG-0004 | Fill auth key + policy in env |
| Sep 6 (U0) | `evmVersion=prague` for 1337 builds (upstream uses `osaka`) | Remote EVM chainspec activates forks through Prague only; Osaka opcodes would fail | Re-align to `osaka` for Sepolia/Arc once those deploys start (`SOLC_EVM_VERSION`) |
| Sep 6 (U0) | The Vite `apps/web/index.html` **is** the HTML shell; Godot's exported `index.html` is unused and `res://export/shell.html` is not created | One owner of the page; Vite transpiles the TS bridge in dev; `window.BranchZero` is installed before the engine script loads | If a Godot-side custom shell is ever needed (PWA, splash), revisit in U4 |
| Sep 6 (U0) | `viem` pinned to **2.50.4** in every workspace | `@bloxchain/sdk@1.0.0` pins `viem@2.50.4`; a second viem copy broke `Chain` types and would duplicate runtime code | Bump together with the SDK |
| Sep 6 (U0) | Godot 4.5.2 installed as a portable zip under `%LOCALAPPDATA%\Programs\Godot-4.5.2\` (not winget, not on PATH); templates under `%APPDATA%\Godot\export_templates\4.5.2.stable\` | Keeps the lab's 4.7.1-mono untouched; `scripts/export-web.mjs` resolves the binary and refuses non-4.5.x | — |
| Sep 6 (U1) | Provision with `CopyBlox.cloneBlox` — clone + `initialize` in one tx | Closes the uninitialised-instance window U0 accepted; ~16.2 M gas vs a fresh deploy + init. Clone template is the U0 fixture (`Clones.clone` copies runtime code, not storage) | If the lab chain's gas ceiling ever drops below ~16.7 M |
| Sep 6 (U1) | CopyBlox + a demo ERC-20 deployed **out of band** by `npm run chain:bootstrap`, reading already-built protocol artifacts from `BLOXCHAIN_PROTOCOL_DIR` | Honours "runtime = SDK + viem only" while still getting published bytecode onto the lab chain. Nothing under `apps/` references that path; only addresses + artifact sha256 are committed | If the protocol ever publishes bytecode to npm |
| Sep 6 (U1) | Two ABI fragments (`cloneBlox`, ERC-20) transcribed into `packages/shared/src/abi.ts` | The SDK ships full ABIs under `abi/` but its `exports` map has no `./abi/*` subpath, so they are unreachable at runtime. Every *stateful* Bloxchain call still goes through the SDK wrappers | Drop them if the SDK adds the subpath |
| Sep 6 (U1) | Lane A provisioning also runs a **role config batch** granting the ERC-20 transfer selector to OWNER (sign) and BROADCASTER (execute) | V4 answered NO: whitelist + schema are not sufficient; `requestAndApproveExecution` checks the execution selector and reverts `NoPermission(caller)` without it | never — this is protocol behaviour, not a workaround |
| Sep 6 (U1) | Per-player Privy policy: created chain-scoped at `/session`, tightened to `verifyingContract` after provisioning | The policy must exist before the player consents, but the account address does not exist until after. Wallets are user-owned (server updates are 401); policy *rules* are app-owned, so only the rule can be tightened later | If Privy allows server-side wallet policy attachment |
| Sep 6 (U1) | Player index kept in memory, not SQLite | The chain is the source of truth for U1; there is no asynchronous state worth surviving a restart until the U2 watcher | U2 |
| Sep 6 (U1) | Overlay calls `refreshSession()` after provision/pay; Sign out clears local session | Without it Pay stayed hidden (`session.account` null) and Sign out left stale UI | never |
| Sep 6 (U1) | Human OTP → consent → Pay verified on 1337 (487.5 dUSDC, txId 3) | Closes the "modal only opened" caveat; G2 product path met | — |
| Sep 6 (U2) | **Lane B option 1**: the owner's own transactions, signed by the Privy session signer (`eth_signTransaction`) and broadcast by the Teller Desk | Not just "no pop-up": the meta-tx approve path skips `releaseTime` by design, so only a direct `approveTimeLockExecution` from a permission-holder keeps the vault clock real. Signing (not sending) at Privy means Privy needs no RPC access to a private chain and viem keeps nonce/gas | If Privy ever adds amount-aware conditions, revisit the Lane A soft cap too |
| Sep 6 (U2) | Grant **no** `SIGN_META_APPROVE` / `EXECUTE_META_APPROVE` on the ERC-20 transfer selector | `EngineBlox._txApprovalWithMetaTx` documents that it intentionally does not enforce `releaseTime`. With no role holding that action, the untimed path is unreachable and the vault clock cannot be bypassed by the delegated signer | never — this is the whole point of the vault |
| Sep 6 (U2) | Owner `eth_signTransaction` policy rules are **calldata-scoped** (`ethereum_calldata` + ABI, `to` and `chain_id` pinned), with a to-only fallback recorded per player | Privy's engine decodes calldata as `function` / `function.param`, so each of the three vault functions gets its own rule; `player.txPolicyMode` records which shape a given player got so the README cannot overclaim | If a future Privy release drops calldata conditions |
| Sep 6 (U2) | Player index persisted to `apps/teller-desk/.data/players.json` (git-ignored) | A vault clock runs for minutes. Losing the in-memory index mid-wire meant the next "Open my account" cloned a second account at 16.2 M gas and stranded the balance. Accounts are also recoverable from `CopyBlox.BloxCloned` logs, so the chain remains the index of record | SQLite if the shape outgrows a flat file (ARCHITECTURE §2.3) |
| Sep 6 (U2) | Provisioning is idempotent **against the chain**, not against memory, and versioned (`ROLE_SET_VERSION`) | Whitelist, role grants and balances are read back before anything is sent, so a U1-era account upgrades in place and a restart cannot re-fund or double-grant. Changing an existing grant is REMOVE + ADD in one batch (`addFunctionToRole` refuses a duplicate selector) | Bump the version whenever `desiredGrants` changes |
| Sep 6 (U2) | Meta-tx durations are drift-corrected, and vault operations mine an empty block first (`metaTxDuration`, `tickChain`) | Remote EVM mines on demand, so contract *views* read a frozen `block.timestamp` while wall time runs on. Uncorrected, meta-txs were born expired and released wires still looked "still cooling" to pre-flight simulation — `eth_call` passing is not proof here | Both are no-ops on a chain that mines on a schedule |
| Sep 6 (U2) | `BRANCH_MANAGER` is a **runtime** role created per account, never a protected one | `RuntimeRBAC` refuses wallet add/revoke on protected roles by design — only SecureOwnable may change system wallets. So the manager cannot be bolted onto OWNER, which is the correct separation anyway | — |
| Sep 6 (U3) | Bridge `u3.0` adds **reads only** (`getSession` over `/session`, `getHistory` over `/status`); Teller Desk `code`s travel unchanged in `error.code` | HANDOFF §5c: a desk that needs something the bridge lacks gets a bridge method over an existing route, never a new lane. Codes surviving the fetch boundary is what makes NPCS.md §5 a lookup table (`dialogue/errors.json`, 85 entries) | If a later unit adds a route, add the method beside these |
| Sep 6 (U3) | Every desk action in Godot goes `Dialogue → GameState.run_action → Chain.call_async`; scene scripts never touch the bridge; `run_action` refreshes session + passbook after every call, success or failure | GODOT.md §4 rule, plus the U1 lesson (refresh client session after server mutation) applied to the game | never |
| Sep 6 (U3) | Vault door and ledger board count `releaseTime − (localNow + (serverNow − localNow))`; `chainNow` is stored, shown nowhere | REMOTE-EVM §1a: the block clock is frozen between transactions on the lab chain | Drop the correction if the demo ever moves to a scheduled-mining chain — it is a no-op there |
| Sep 6 (U3) | `MockChain` (`autoload/mock_chain.gd`, `?mock` / `?mock=account`) answers the whole bridge API on desktop and behind a URL flag | The greybox and every NPC line can be walked without an inbox; kill tests stay on the Teller Desk. Fake values are obviously fake (`0xM0CK…`, 30 s cooling) | Never use it for evidence |
| Sep 6 (U3) | Greybox is code-built boxes (`bank_interior.gd`), UI is code-built Controls; `.tscn` is one root scene | Reviewable in a diff, no editor round-trips for a cold agent, `.pck` 125 KB | Replace with kit meshes in U7 |
| Sep 6 (U3) | Input actions bind **both** `keycode` and `physical_keycode` | Godot web maps `KeyboardEvent.code` to the physical key and browser automation sends none; a physical-only `interact` was dead | never |
| Sep 6 (U0) | Deploy + `initialize` as two transactions (no factory) | `CopyBlox`/factory is not in the public package either; window is seconds on 1337; deployer holds no role after `initialize` | U1 provisioner may add a clone factory only if one is published |
| Sep 7 | Explore Express (dual-control) + Privy step-up in **GameLab ENG-0010 / ENG-0011** in parallel with U4; do not build in product until handoffs | Principal playtest liked Counter vs Vault; Ideas A/B are a possible third beat; vault meta-approve stays banned | **Superseded evening** — Express reframed |
| Sep 7 (evening) | **Express = meta-approve bypass of `releaseTime`**, not a shorter timelock. Open **ENG-2026-0012**. ENG-0010 stays yes for timed dual-control only; ENG-0011 step-up stands | Principal clarified original Idea A | After 0012 answers; Vault accounts keep no META_APPROVE |
| Sep 7 (night) | **Product beat = U4+ Priority release (G5b)** before ENS. Ruth = wait (silent timed approve). Okafor = bypass only (EXECUTE_META_APPROVE + owner Passkey). Remove manager post-clock stamp. Prefer “Priority” over “Express.” Same account needs owner timed-approve **and** the 0012 meta split; bump ROLE_SET | Principal: Okafor must not be a second Ruth | After G5b |
| Sep 7 (evening) | Privy MFA enabled on Branch Zero app: **Passkey** + **1 min** cache. Open **ENG-2026-0013** to prove silent session-signer vs step-up under MFA | ENG-0011 left this unproven; dashboard “any transaction” wording is ambiguous | After 0013; turn MFA off for demo if Lane A breaks |
| Sep 7 (0013) | Keep MFA on for Priority. `promptMfa()` is **not** the dashboard 1-min cache (M3a FAIL ~9s/~21s). Silent Pay: M4 PASS; M1 silent deny was policy slip. Re-smoke `npm run smoke` aborted (no SMOKE_POLICY_ID on `0x818A…`) | Empirical | never document cache-skip if product calls `promptMfa()` |
| Sep 7 (U4) | Express dual-control and Privy step-up stay in GameLab ENG-0010 / ENG-0011; promote to U6+ only if both hand off yes | Kickoff rule; nothing of either was built in U4 | **Superseded night** — U4+ consumes 0012+0011+0013 |
| Sep 7 | Canvas focus loss after React overlay is a **U4 product hotfix**, not a lab ENG | `#overlay > * { pointer-events: auto }` steals focus from Godot `#canvas` | Close in G5 DoD |
| Sep 7 | Half-provisioned players (account set, `configured`/`roleSet` missing) fail Wire with `NoPermission` on `executeWithTimeLock`; Re-check `/provision` syncs roles | Dual-selector grants land only at end of provision | U4: harden write path / surface "Re-check" in bank copy if needed |
| Sep 7 (U4) | `#boot` is `pointer-events: none` and hidden once the engine runs; the shell calls `focusCanvas()` after *hide* and after the Privy modals, on timers not rAF | Godot web binds `keydown` to the canvas; a full-viewport status div over `#game` ate every click, so Godot never re-focused itself. rAF does not run in a background tab | never — any future overlay child must not cover the canvas unless it is meant to be clicked |
| Sep 7 (U4) | `/pay` and `/wire` refuse `NOT_CONFIGURED` (409) when the account is on file but `configured`/`roleSet < ROLE_SET_VERSION`; player index written synchronously (atomic rename); receipts persisted to `.data/receipts.json` | The playtest's `NoPermission` was a half-recorded provision (`tsx watch` restarted the desk inside the 50 ms debounce). The clerk's "Re-check" is the honest path, so the counter names it | If provisioning becomes a single transaction |
| Sep 7 (U4) | Stage stream is a reconnecting `EventSource` (`shell/deskEvents.ts`, 2 → 30 s backoff, fresh token per attempt) and its state is a bridge event `desk.link`; Godot toasts and reconciles on reconnect | U3 closed the stream on its first error; a desk restart silently ended the feed until reload. Reconnect surfaces as a HUD toast (freedom envelope: from real link state, not a timer) | If the shell is hosted behind a gateway that needs a cookie instead of a query token |
| Sep 7 (U4) | A dead desk behind the proxy is `RPC`; a rejected Privy token is 401 `AUTH` | The proxy's 500 has no JSON body and used to become `INTERNAL`; Privy's verify error had no status and became 500 | — |
| Sep 7 (U4) | Bridge label `u4.0` with **no** new methods; the transfer-compression win is left to the host (Cloudflare Pages / Vercel brotli `application/wasm`), no pre-compression plugin added | HANDOFF §3: no new dependency; 36.3 MB → 7.05 MB brotli is the whole first-load story and the host does it for free. **VERIFY** on the chosen host before the video | If the host does not compress wasm: pre-compress in `scripts/export-web.mjs` (Node zlib, no dependency) |
