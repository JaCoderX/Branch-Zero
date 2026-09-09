---
title: Load Account — Ines adopts a custom AccountBlox address
created: 2026-09-08
updated: 2026-09-08
status: met
product: Branch-Zero
handoff: docs/missions/HANDOFF-load-account.md
kickoff: docs/missions/KICKOFF-load-account.md
---

# Load Account (Ines)

> Let the player **point Ines at a specific AccountBlox address** they already own on the current wing.
> Covers stranded / non-latest CopyBlox clones and deliberate multi-account use. The terminal stays for
> **discovery**; Ines is the clean **load** path.

Related: [NPCS.md](./NPCS.md) §4.2 · [PRIVY.md](./PRIVY.md) · [TERMINAL-CONSOLE.md](./TERMINAL-CONSOLE.md) ·
[HANDOFF-load-account.md](./missions/HANDOFF-load-account.md)

---

## 1. Decision (from principal + session learnings)

| Decision | Why |
|----------|-----|
| Ines offers **Load an existing account** (chat + address form) | Account Opening owns identity ↔ vault linkage |
| Accept a pasted `0x` AccountBlox on the **current wing** | Player may have several clones; auto-recovery only keeps the **last** `BloxCloned` |
| Terminal discovers; Ines loads | Console / Import already helps find addresses; the desk must adopt them into the session |
| Hard gate: on-chain `owner()` == Privy owner | Never load someone else's vault into your passbook |
| After load, run the same sync as Re-check | Policies pin, role set, whitelist — without `cloneBlox` |

**Hard line:** this does **not** invent a CopyBlox `owner → clones` mapping. It does not transfer ownership.
It only switches which contract the Teller Desk treats as *this player's Main account* for the wing.

---

## 2. Why auto-recovery is not enough

CopyBlox stores a **flat** `_clones` set and emits `BloxCloned` with indexed `initialOwner`. There is **no**
`mapping(owner → clones)`.

Branch Zero `recoverAccount` / `/session` / `/provision` take the **latest** matching log (then fixtures).
If the player opened a second clone, or needs an older vault with balance / pending wires, recovery will
prefer the wrong contract unless they can **name** the address.

```text
Privy owner ──BloxCloned logs──► [clone₀, clone₁, … cloneₙ]
                                      ▲
                          recoverAccount → last only
                          Load Account   → player picks any they own
```

---

## 3. Player flow (diegetic)

1. Sign in + (optional) teller consent as today.
2. At Ines — from **open** (no account yet) **and** **done** (already have one):
   - **Open my account** — existing provision / recover / clone path.
   - **Load an existing account** — opens a slip (same family as Petra's name claim / Bob's payment slip).
3. Player pastes `0x…` (hint: "from the desk terminal or your passbook").
4. Desk validates on the **current wing** RPC:
   - checksum / `getAddress`
   - `getCode` non-empty
   - `SecureOwnable.owner()` == session owner
   - Prefer also: answers BaseStateMachine / looks like AccountBlox (same spirit as FX till checks)
5. On success: `players*.json` `account` ← address; pin typed-data + tx policies; run provision **sync**
   (guards / roles / faucet-zero only — **no** new clone). Passbook shows the loaded address.
6. On refuse: bank line (wrong owner / not a vault / bad address) + Ask why.

**Ask why (sketch):** "Your wallet can own more than one account contract. The desk usually files the newest;
you can hand me an older address if that's the vault you want to use today."

---

## 4. Surfaces

| Layer | Work |
|-------|------|
| Dialogue `clerk.json` | Choices on `open` / `done` / `start_over`; form kind e.g. `load_account` |
| Godot form | New Control (mirror `name_claim_form.gd` / `payment_slip.gd`) — LineEdit for address |
| Bridge / GameState | Action `load_account` `{ account }` → Teller |
| Teller Desk | `POST /account/load` (or equivalent) — validate + `patchPlayer` + policy pin + sync |
| MockChain | Accept a fake owned address for greybox / `run_checks` |
| Terminal | Unchanged discovery; optional one-line hint in `terminal.json` / Console copy pointing at Ines |

Optional stretch (same unit if cheap): after load failure for "not owner", or from Ask why, list
`BloxCloned` for this owner as **dialogue choices** (short addresses) — still no factory mapping required.

---

## 5. Security

- Session required (Privy JWT). Never load by address alone without login.
- **Owner match is mandatory** — refuse `ACCOUNT_NOT_OWNED` (or existing code family).
- Do not grant OBSERVER / Priority / FX by loading; those stay their own desks.
- Re-pin Privy policies to the **new** `verifyingContract` / `to` — silent lane must not keep signing the old vault.
- Live and Dev: load only on that desk's chain; no cross-wing paste of a 1337 address into Live.
- Refuse zero address, EOAs, contracts that do not answer `owner()`.

---

## 6. Out of scope

- CopyBlox Solidity changes / `getClonesForOwner`
- Loading accounts the player does **not** own (viewing stays OBSERVER + Console)
- Auto-switching FX till on Dev (Live `fxTillIsMain` already shares Main)
- Arc wing
- Merging with Sepolia treasury ops
- Walking a new NPC desk

---

## 7. Definition of done — **met 2026-09-08**

Evidence: [`progress/2026-09-08-load-account.md`](./progress/2026-09-08-load-account.md).

- [x] Ines dialogue exposes Load path (no account + has account) — `open`, `done` **and** `start_over` all offer
  "Load an existing account"; `run_checks.gd` asserts all three and that Open my account still recovers the last clone
- [x] Address form → desk validates `owner()` == Privy owner on current wing — `lanes/loadAccount.ts`
  `assertOwnedAccount`: `getAddress` → `getCode` → `owner()` → `initialized()` → ERC-165 `ISecureOwnable` → owner match
- [x] Player index + session + passbook show the loaded account; Re-check sync without cloning — `POST /account/load`
  patches `player.account`, then runs `whitelistToken` + `syncRolePermissions` + zero-only `fundAccount`. **No**
  `cloneBlox` anywhere in the lane; kill test L8 shows a repeat load sends no role batch at all
- [x] Policies re-pinned to the loaded account — and pinned **before** the index moves, so a refused re-pin
  (`LOAD_POLICY`) leaves the file alone instead of filing account B while the enclave still only signs for A.
  L2b proves the pin *moved* rather than widened: after the load the signer signs for the loaded account and is
  refused `policy_violation` on the account it was loaded away from
- [x] Refusals have bank lines + Ask why; MockChain + Godot check and/or kill/smoke evidence —
  `ACCOUNT_NOT_OWNED` / `ACCOUNT_NOT_A_VAULT` / `LOAD_POLICY` in `errors.json`; `tests/run_load_walk.gd` walks the
  slip under MockChain; `npm -w apps/teller-desk run killtests:load` is the live Dev-wing proof
- [x] NPCS / PRIVY / ARCHITECTURE note updated; REFLECTION row; HANDOFF-CC when met

---

## 8. As built

| Layer | File |
|-------|------|
| Teller Desk lane | `apps/teller-desk/src/lanes/loadAccount.ts` — `assertOwnedAccount`, `repinPolicies`, `loadAccount` |
| Route | `apps/teller-desk/src/server.ts` — `POST /account/load { account }`; session-gated, deliberately **not** behind `requireConfigured` |
| Bridge | `apps/web/src/bridge/branchZero.ts` — `loadAccount` (bridge **`s2.1`**); address only, no ENS resolve |
| Game | `dialogue/clerk.json` (`loading` / `loaded` / `why_load`), `scripts/load_account_form.gd`, `GameState.run_action("load_account")` |
| MockChain | `autoload/mock_chain.gd` `_load_account` — canned owned clone `0xC10ded…0001`, foreign vault `0xFACade…0002` |
| Tests | `tests/run_load_walk.gd`, `tests/run_checks.gd` `_check_load_account`, `scripts/kill-tests-load.ts` (`killtests:load`) |

### 8.1 The shape gate, measured

Four real addresses read on Remote EVM 1337 (2026-09-08). This table is why the gate is what it is:

| Address | `getCode` | `owner()` | `initialized()` | `IBaseStateMachine` | `ISecureOwnable` |
|---------|-----------|-----------|-----------------|---------------------|------------------|
| a real AccountBlox clone | 20,853 bytes | the player | `true` | `true` | `true` |
| an EOA | none | reverts | reverts | reverts | reverts |
| the demo ERC-20 | 2,771 bytes | **reverts** | reverts | `false` | `false` |
| **CopyBlox itself** | 11,227 bytes | **reverts** | `false` | **`true`** | **`false`** |

`IBaseStateMachine` alone would have adopted the **factory**. `owner()` + `initialized()` + `ISecureOwnable` is the
sharp edge, and kill test L5b keeps a leg on CopyBlox for exactly that reason.

### 8.2 Order of operations, and why

The policy re-pin happens **before** `patchPlayer`, which is the reverse of provisioning. Provisioning pins after
the clone because there was nothing to pin to beforehand; a load has an old address to move away from, so the
enclave must be able to sign for the new vault before the index says that is where the money is. A `LOAD_POLICY`
refusal therefore changes nothing at all.

Related: `provision`'s pin is **one-shot** (`if (policy && !player.policyPinned)`) — Account Opening pins once and
never moves it. Moving a pin is this lane's job. The one way to reach a stale pin without it is to lose
`players.json` while the Privy rule still names an older clone; recovery then adopts a different account and the
silent lane is refused `policy_violation`. Reproduced in kill test L0 setup, mitigated there by clearing the flag
with the index. Noted as a follow-up rather than changed, because Account Opening is Live-critical and the load
lane is the honest fix for the same class of drift.

### 8.3 What a load does *not* do

No clone, no ownership transfer, no `getClonesForOwner`, and no top-up beyond the zero-only opening balance
Account Opening already gives. Open my account keeps its last-`BloxCloned` default; loading is a second, named
choice. OBSERVER, ENS, FX, Priority and the faucet are untouched.
