# Kickoff prompt — U7 practice faucet (Ines top-up)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**.

**What this is:** a **small playtest-continuity unit**. Ines’s passbook menu gets an explicit
**“Top up practice dollars”** choice that restores the account’s demo-token balance **up to** the
configured opening amount (`OPENING_BALANCE_USDC`, default **500**). It is **not** ship packaging,
**not** Arc funding, **not** unlimited minting, **not** a change to Lane A/B routing.

**Why now:** after polish + live Priority / wire play, free balance runs down (wires, fees, failed
Priority after meta-approve). Re-checking the account does **not** re-fund (`fundAccount` only
transfers when `balanceOf == 0`). Exploring and demoing then dead-ends. `docs/NPCS.md` §4.2 already
names `action: faucet`; `clerk.json` never wired it.

**Baseline:** Main wing playable on `http://localhost:5173/?mock=account` (or `:5174`). Live Remote
EVM optional for DoD. U6 Arc **DEFERRED**. U4 freeze unchanged (no new Privy modal on this path).

---

## Reflect (do not invent scope)

| Fact | Implication |
|------|-------------|
| `NPCS.md` already lists `> Top up practice dollars → action: faucet` | Ship the designed verb; don’t rename casually |
| `fundAccount` in `provision.ts` funds **only when balance is zero** | Opening / Re-check must stay that way — top-up is a **separate** explicit action |
| Opening amount is `config.openingBalance` (`OPENING_BALANCE_USDC`, default `500`) | Top-up target = that config, not a hard-coded string in dialogue |
| Demo token treasury = deployer wallet (bootstrap) | Faucet = deployer `transfer` of the **delta** to reach opening balance |
| MockChain starts at `balance = 500.0` | Mock path must set balance back to opening without inventing a second economy |
| Freeze: one Privy surface at consent; Priority may open Passkey | Faucet is **server-side deployer transfer** — **zero** wallet / Passkey UI |

**Semantics (locked):**

1. Read `balanceOf(account)`.
2. If `balance >= openingBalance` → success, **no tx**, bank line that practice dollars are already topped up; refresh passbook.
3. If `balance < openingBalance` → transfer `openingBalance - balance` from deployer to account; wait receipt; return new balance.
4. Never mint above opening; never wipe pending wires; never touch native gas (leave `fundOwnerGas` to provision only unless already dry and you have a proven reason — default **no**).
5. Requires authenticated player with a provisioned account (same bar as `/pay` / `/wire`).

**Out of scope:** Arc faucet, Circle USDC, changing `INSTANT_LIMIT`, auto-top-up on every Re-check, `/wire` balance pre-check (separate optional follow-up), Stage 6 art, ship packaging title cards.

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — practice faucet ONLY (Ines → top up demo balance to OPENING_BALANCE).
Freedom on HOW. No freedom on constraints.
This is NOT Arc, NOT packaging, NOT unlimited mint, NOT re-fund-on-re-check.

BEFORE CODE — read in order:
1. docs/HANDOFF-CC.md          (current mission; freeze; polish DoD — do not regress)
2. docs/NPCS.md §4.2           (faucet already named)
3. docs/KICKOFF-U7-practice-faucet.md  (this file — semantics locked above)
4. apps/game/dialogue/clerk.json       (`done` node — add the choice)
5. apps/teller-desk/src/lanes/provision.ts  (`fundAccount` — do not change zero-only opening behavior)
6. apps/teller-desk/src/config.ts      (`openingBalance`)
7. apps/game/autoload/game_state.gd    (`run_action` match)
8. apps/web/src/bridge/branchZero.ts
9. apps/game/autoload/mock_chain.gd
10. docs/DEV-LOOP.md

BUILD:
A. Desk — `POST /faucet` (name may match NPCS `faucet`):
   - Auth + provisioned account (refuse NOT_CONFIGURED / no account like other lanes).
   - Reuse or extend funding helper: transfer delta up to openingBalance from deployer.
   - Response shape: ok + balance (and hash if a tx ran). Clear error if treasury cannot cover.
B. Bridge — `faucet()` → `/faucet`.
C. Godot — `run_action("faucet")` → Chain.call_async("faucet", …); refresh_all after.
D. Dialogue — under Ines `done` (has_account path):
     { "text": "Top up practice dollars", "action": "faucet",
       "working": "Counting out practice dollars…", "on_ok": "done", "on_error": "refused" }
   Optional short success copy via existing `{balance}` on `done`. Optional "Ask why" note that
   top-up brings the demo balance back to the opening amount from the branch treasury.
E. MockChain — `faucet` sets balance to opening (500) immediately; no fake latency beyond existing patterns.
F. Overlay (optional, thin) — only if other desk verbs already have a debug button; do not build a new admin UI.
G. Docs — thin HANDOFF / REFLECTION pointer when DoD met; keep NPCS §4.2 aligned if wording drifts.

TESTS / DoD (all required):
- [ ] Mock: `?mock=account` → spend down balance (pay/wire) → Ines → Top up → balance reads opening again
- [ ] Mock: already at opening → choice succeeds with no invented second economy; balance unchanged
- [ ] Live (if Remote EVM up): same path; one deployer ERC-20 transfer of the delta; no Privy modal
- [ ] Re-check still does NOT top up a non-zero underfunded balance (opening fundAccount unchanged)
- [ ] `run_checks` / existing desk smoke green; no freeze regression
- [ ] Commit with a clear message; push if the human asked

CONSTRAINTS:
- Freeze: faucet must not open Privy / Passkey / wallet UI
- Do not change OPENING_BALANCE default without env; dialogue may say “practice dollars” not “500” if `{balance}` / config is enough
- Do not fund Arc; do not use Circle faucet
- Do not weaken wire / Priority validation
- Prefer Fable 5.1

WHEN DONE: append a short progress note (gitignored ok) or REFLECTION bullet; mark HANDOFF pointer if this unit is met.
```

---

## Suggested agent order

1. Implement desk helper + `/faucet` + unit/smoke assertion (delta math).
2. Bridge + `game_state` + `mock_chain`.
3. `clerk.json` choice + any error bank line in `game_state.error_line` if a new code appears.
4. Mock walk DoD, then live if chain is up.
5. Thin doc pointer; commit.

## Paste block (short)

Copy the fenced `MISSION` block above into the new agent session after pointing it at this file.
