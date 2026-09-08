---
title: Load Account — Ines adopts a custom AccountBlox address
created: 2026-09-08
status: planned
product: Branch-Zero
handoff: docs/HANDOFF-load-account.md
kickoff: docs/KICKOFF-load-account.md
---

# Load Account (Ines)

> Let the player **point Ines at a specific AccountBlox address** they already own on the current wing.
> Covers stranded / non-latest CopyBlox clones and deliberate multi-account use. The terminal stays for
> **discovery**; Ines is the clean **load** path.

Related: [NPCS.md](./NPCS.md) §4.2 · [PRIVY.md](./PRIVY.md) · [TERMINAL-CONSOLE.md](./TERMINAL-CONSOLE.md) ·
[HANDOFF-load-account.md](./HANDOFF-load-account.md)

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

## 7. Definition of done

- [ ] Ines dialogue exposes Load path (no account + has account)
- [ ] Address form → desk validates `owner()` == Privy owner on current wing
- [ ] Player index + session + passbook show the loaded account; Re-check sync without cloning
- [ ] Policies re-pinned to the loaded account
- [ ] Refusals have bank lines + Ask why; MockChain + Godot check and/or kill/smoke evidence
- [ ] NPCS / PRIVY / ARCHITECTURE note updated; REFLECTION row; HANDOFF-CC when met
