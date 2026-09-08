---
type: handoff
title: Handoff — Load Account (Ines custom AccountBlox)
audience: cold agent (Claude Code · Opus 5 high)
created: 2026-09-08
updated: 2026-09-08
status: met
product: Branch-Zero
objective: OBJ-2026-0004
mission: Ines loads a player-owned AccountBlox by address (non-latest clone / multi-account)
plan: docs/LOAD-ACCOUNT.md
kickoff: docs/KICKOFF-load-account.md
baseline: Sepolia Live + Dev Mode MET; Terminal Console + OBSERVER MET; AO polish MET
---

# Handoff — Load Account (Ines)

> **MET 2026-09-08.** Ines offers *Load an existing account* from `open`, `done` and `start_over`; the desk
> validates `getCode` → `owner()` → `initialized()` → ERC-165 `ISecureOwnable` → owner match on the current
> wing, re-pins the Privy typed-data and tx rules to the loaded address **before** switching the file, then
> runs the Re-check sync (guards, roles, zero-only balance) with **no** `cloneBlox`. Bridge is **`s2.1`**
> (`loadAccount` → `POST /account/load`). Live proof on Remote EVM 1337:
> `npm -w apps/teller-desk run killtests:load` **12/12** — including a Lane A payment out of a loaded
> non-latest clone (`0x4c93d37f…589e`), `policy_violation` on the account it was loaded away from, and
> `ACCOUNT_NOT_OWNED` for a real AccountBlox belonging to someone else. Evidence:
> [`progress/2026-09-08-load-account.md`](./progress/2026-09-08-load-account.md); DoD ticks in
> [`LOAD-ACCOUNT.md`](./LOAD-ACCOUNT.md) §7, as-built in §8.

> **Still owed:** a human browser walk on the **Live** wing — nobody has typed an address into the slip on
> Sepolia; the desk paths are headless-proven on Dev. The optional stretch (listing this owner's clones as
> Ines choices) was **not** built.

You are a **cold agent**. Prefer this file + the plan + kickoff over chat memory. Freedom on **how**.
No freedom on constraints, scope, or protocol semantics.

**Authorized construction:** Ines can **load a custom AccountBlox address** the player owns on the current
wing. Prefer **Claude Code · Opus 5 high**.

**Plan:** [`docs/LOAD-ACCOUNT.md`](./LOAD-ACCOUNT.md)  
**Kickoff (paste):** [`docs/KICKOFF-load-account.md`](./KICKOFF-load-account.md)

---

## Learnings to carry (do not re-litigate)

1. **CopyBlox has no `owner → clones` map.** Flat `_clones` + indexed `BloxCloned(initialOwner)`. Enumeration
   for one entity = filter logs (or walk `getCloneAtIndex` + `owner()`).
2. **Recovery keeps the last clone only.** `/session` and `/provision` call `recoverAccount` → latest
   `BloxCloned` for the Privy owner (then deployment fixtures). Older vaults with balance or pending wires
   are stranded unless the player can name the address.
3. **Terminal discovers; Ines loads.** Console Import / OBSERVER already help find addresses. Account Opening
   must adopt the chosen vault into the session passbook — same desk that opens accounts.
4. **Identity ≠ which vault is active.** Same Privy owner can own multiple AccountBlox contracts; the desk
   currently holds one `player.account` per wing.
5. **Owner check before adopt.** Same honesty as FX till: `owner()` must equal the session owner; refuse
   otherwise with a bank line (never soft-load a stranger's vault).
6. **Policy pin follows the vault.** After switching `account`, typed-data + tx rules must pin to the new
   address or silent signing targets the wrong contract.

---

## Principal intent

1. Ines chat: clean way to load an account by address.
2. Covers non-latest CopyBlox clones and intentional multi-account use.
3. Discovery can stay on the terminal; loading is Ines.

---

## Baseline (do not regress)

- Sepolia Live default, Dev toggle, ENS/FX, Priority, faucet, OBSERVER, AO polish, `killtests:s2`.
- Runtime `@bloxchain/sdk` + `viem` only. Arc **DEFERRED**. No Remote EVM wipe.
- One Privy modal. Godot never holds keys / never talks RPC.

---

## DoD

See [`LOAD-ACCOUNT.md`](./LOAD-ACCOUNT.md) §7 — **all six boxes ticked 2026-09-08**.

---

## Out of scope

CopyBlox Solidity changes; loading non-owned accounts; Arc; treasury; ship packaging.
