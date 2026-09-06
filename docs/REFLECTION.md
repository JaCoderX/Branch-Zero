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
| "Signs in the background with no pop-ups" | **True with a caveat** — one delegation modal at Account Opening; afterwards zero, as long as Privy session signers accept our typed data | K2, K5 | Say "one pop-up" in all copy; never "zero" |
| "Everything you see is on chain" | True for statuses, balances, names, release times; **false** for NPC mood, queue animations, achievements (local) | Code review: no local timers for release | Keep achievements clearly cosmetic; board copy reads chain |
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
| Session signer cannot touch another player's account | Privy policy pins `verifyingContract` | K5 | pass if K5 holds; else Teller Desk authZ only |
| Deployer cannot retain control after opening | ownership set to player at `initialize`; deployer holds no role afterwards | verify `owner()` after provisioning in tests | pass |
| Recovery is time-locked | Bloxchain `SecureOwnable` | recovery key is cold; flow is lore in MVP | pass (not exercised) |
| No secrets in browser or Godot | architecture | JSON bridge, keys server-side | pass |

**Security summary:** acceptable for a hackathon **if** the partial invariant is stated in the README and in the Manager's "Ask why" dialogue. Do not claim the vault clock is the only path for large amounts.

### 2.3 Workflow review

- Every player action is a **request → (sign) → broadcast → observe** loop with one owner of each step. Nothing loops back into the browser after step 1.
- The timelock is the only asynchronous state; SSE + `listPending` reconcile handles background tabs.
- Failure modes have NPC lines; the game never shows a raw error.
- Dependency direction: Godot → bridge → Teller Desk → SDK → chain; no reverse calls except events. Clean.
- Risk: single-process Teller Desk with an in-memory account map. Mitigation: SQLite file + idempotency keys; acceptable for demo.

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
| K2 | — | pending | Privy **app created** by principal 2026-09-06. Next: fill env (auth key, policy ID, signer ID); ENG-2026-0004 / U1. |
| K3 | — | pending | After G5. Needs a funded Arc Testnet key (never a Ganache-parity key). |
| K4 | 2026-09-06 | **FAIL as written → lab PASS; product path revised** | npm contracts package = source only. U0 compile fallback produced fixture `0x4bf7…7ba2` on 1337 (kept). **Principal 2026-09-06 evening: reject compile-from-contracts as product path.** Ongoing: `@bloxchain/sdk` only; new accounts via **CopyBlox** / protocol deploy scripts; do not wipe Remote EVM. |
| K5 | — | pending | With K2 (Privy dashboard policy). Domain name = `Bloxchain` (SDK `META_TX_DOMAIN`). |
| K6 | — | pending | Producer registers a Sepolia `.eth` parent first (commit/reveal wait). |
| K7 | — | pending (S1 only) | |
| K8 | — | pending | Precondition verified in K1. Privy app exists — exercise iframe in U1. |

Fill on Day 1–2. A `fail` with no chosen fallback blocks G1. **G1 status (2026-09-06): met.** K4 product policy closed by principal (fixture kept, SDK+CopyBlox going forward).

Findings recorded alongside:

- Registry views are **permissioned** — pass `account: owner` on `readContract`.
- Live Remote EVM gas ceiling ≈ **20M** (operator). **Do not wipe** volumes. `initialize` ≈ 16.06 M fits with headroom for other wallet ops.
---

## 5. Originality check (what already exists)

Prior ETHGlobal "bank" / 3D projects mostly fall into: (a) DeFi dashboards skinned as a bank, (b) metaverse lobbies with wallet-connect buttons, (c) educational quizzes. None found that make **the security workflow itself** the walkable object — timelock as a vault clock, broadcaster as a teller, roles as staff, guards as approved-payee lists. That mapping is the contribution; the 3D is the delivery, not the novelty. Re-check ETHGlobal showcase on Day 9 with the terms "bank", "Godot", "timelock", "teller" and note any overlap in the README's "Related work".

---

## 6. Open questions (owner, due)

| # | Question | Owner | Due | Default if unanswered |
|---|----------|-------|-----|------------------------|
| 1 | Exact EIP-712 domain `name`/`version` for Privy policy | protocol/backend | Day 2 | **SDK:** `META_TX_DOMAIN.name = "Bloxchain"`; version from `EngineBlox.VERSION` — pin in `infra/privy/policy.json` |
| 2 | Are definition libraries in `@bloxchain/contracts` published with Sepolia addresses? | backend | Day 1 (K4) | **Answered:** no bytecode in npm. **Product path:** do not use contracts package; SDK + CopyBlox / protocol scripts |
| 3 | ENSv2 Sepolia: which registry for subnames | backend | Day 4 | Follow contract-developer tutorial default |
| 4 | Do we own a `.eth` name on Sepolia already? | producer | Day 1 | Register a test name via ENS Sepolia app |
| 5 | Team size / who owns Godot art | producer | Day 1 | Solo: Kenney/Quaternius CC0 assets only |
| 6 | Video length / AI disclosure | producer | Day 9 | Assume 3 min, disclose Cursor + models |
| 7 | Arc Launch vs DeFi bounty | producer | Day 8 | DeFi only |
| 8 | Privy dashboard: auth key + policy + custom 1337? | producer | **now** | App created; finish checklist in PRIVY.md §3 before U1 |

---

## 7. Things we decided not to do

- **Custom Solidity.** Even a tiny helper would break the "public SDK only" rule and the audit story.
- **ERC-4337 / bundlers.** Different thesis (UX abstraction vs governed operations); mixing them confuses judges.
- **Multiplayer.** Tellers seeing each other is charming and irrelevant; SSE per player only.
- **Real timelocks (24 h).** Demo uses 60–120 s; the Manager explains it is configurable.
- **Mobile web.** Desktop Chrome/Edge/Firefox only.
- **A token or points economy.** Achievements are cosmetic stamps; no on-chain rewards.

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
| Sep 6 (U0) | Deploy + `initialize` as two transactions (no factory) | `CopyBlox`/factory is not in the public package either; window is seconds on 1337; deployer holds no role after `initialize` | U1 provisioner may add a clone factory only if one is published |
