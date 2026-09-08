---
type: handoff
title: Handoff — Load Account (Ines custom AccountBlox)
audience: cold agent (Claude Code · Opus 5 high)
created: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
mission: Ines loads a player-owned AccountBlox by address (non-latest clone / multi-account)
plan: docs/LOAD-ACCOUNT.md
kickoff: docs/KICKOFF-load-account.md
baseline: Sepolia Live + Dev Mode MET; Terminal Console + OBSERVER MET; AO polish MET
---

# Handoff — Load Account (Ines)

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

See [`LOAD-ACCOUNT.md`](./LOAD-ACCOUNT.md) §7.

---

## Out of scope

CopyBlox Solidity changes; loading non-owned accounts; Arc; treasury; ship packaging.
