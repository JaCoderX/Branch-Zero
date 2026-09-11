# Kickoff prompt — S1 Uniswap v4 FX Desk (end-to-end)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if
Universal Router / Permit2 encoding stays broken after one honest SDK-based attempt.

**What this is:** sponsor stretch **S1** — a walkable **FX Desk** where the player's **AccountBlox** executes a
**Uniswap v4** swap through **GuardController** whitelists. Infra → desk → bridge → Godot viz. It is **not** Arc
revive, **not** ship packaging, **not** Terminal/OBSERVER, **not** a custom Solidity helper, **not** Unichain/CCA/hooks.

**Why now:** Arc G7 stays **DEFERRED**. Official submission still names at most three sponsors; Uniswap is the
activated **#3** while Arc remains elevator “coming soon.” Prize: ETHOnline 2026 **Best Uniswap Stack Contribution**
(Start Fresh pool) — public repo + **`FEEDBACK.md`** + [hackathon feedback form](https://developers.uniswap.org/hackathon-feedback).

**Baseline:** Main wing playable (`?mock=account`). U5 ENS on Sepolia met. Lane A/B + Priority on Remote EVM 1337.
Practice faucet met. Freeze intact (one Account Opening modal; Priority Passkey only at Walker).

**Reset (locked):**
- **v4 only** (PoolManager + Universal Router + V4Quoter + Permit2). No v2/v3 primary path.
- Swaps run on **Sepolia** (sponsor proof). Payments / vault stay on **1337**. Do not invent a Uniswap fork on 1337.
- Account is `msg.sender` to Permit2/Router; session signer Lane A; **zero new Privy modals**.
- No `SwapHelper` contract — sequential guarded calls (cache Permit2 after first visit).

---

## Reflect (do not invent scope)

| Fact | Implication |
|------|-------------|
| Assets live in AccountBlox | Guard whitelist: token `approve`, Permit2 `approve`, UR `execute` |
| `GuardController` = one call per request | 2–3 Lane A meta-txs first swap; later swaps often 1 |
| Prize needs FEEDBACK.md + form | Shipping code without paperwork fails the bounty |
| Judges hate “generic swap UI” | Lead with **guards + Dealer Johnny**; show whitelist / Ask why |
| Viz must match Stage 1–5 / polish DoD | New FX desk + Johnny + quote board; stay under viz budget; no greybox redesign |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — S1 Uniswap v4 FX Desk ONLY (infra → desk → bridge → Godot visualization).
Freedom on HOW. No freedom on constraints.
This is NOT Arc, NOT packaging, NOT Terminal/OBSERVER, NOT custom Solidity, NOT v2/v3-primary, NOT hooks/CCA.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-CC.md          (§5i S1; freeze; Arc deferred; faucet met)
2. docs/UNISWAP.md             (canonical flow + guard table — follow it)
3. docs/missions/KICKOFF-S1-uniswap-fx.md  (this file)
4. docs/BLOXCHAIN-INTEGRATION.md  (§3 guard config batches)
5. docs/DEV-LOOP.md            (Sepolia vs 1337)
6. docs/NPCS.md                (§4.7 Johnny)
7. docs/GODOT.md               (bridge; canvas focus §5b)
8. docs/ARCHITECTURE.md        (FX lane hints)
9. docs/SECURITY-AND-KEYS.md
10. docs/REFLECTION.md         (K7; sponsor matrix)
11. https://docs.uniswap.org/contracts/v4/deployments
12. https://docs.uniswap.org/contracts/v4/quickstart/swap

HARD RULES:
- Runtime: @bloxchain/sdk + viem. Uniswap encode libs (@uniswap/universal-router-sdk / v4-sdk or equivalent) ONLY to build calldata — note any new dep in REFLECTION §8.
- No custom Solidity. No @bloxchain/contracts in product. No wiping Remote EVM.
- Do not regress U4 freeze, Priority, ENS verbs, polish DoD (Bob, Space/E, debug F-keys, Petra C2), faucet.
- FX writes = Sepolia AccountBlox (provision or flag path for FX guards). Quote = eth_call. Live K7 evidence on Sepolia — MockChain alone is not enough for the prize.
- Every new error → errors.json; run_checks green. focusCanvas after overlay.
- Prize paperwork: FEEDBACK.md + README pointers to contracts/lines + form URL in progress note.

END-TO-END SEQUENCE (do not skip layers):

A. INFRA (Sepolia)
   1. Resolve official v4 Sepolia addresses (PoolManager, UniversalRouter, V4Quoter, StateView, Permit2 canonical).
   2. Write/update infra/deployments/sepolia.json (and shared reader if needed).
   3. Ensure a liquid demo pool (demoUSDC/WETH or documented existing Sepolia pool). Seed via PositionManager script if required — operator-funded Sepolia key; never Ganache-parity keys.
   4. Document pool id / fee tier / token addresses in UNISWAP.md + README.

B. ACCOUNT / GUARDS
   5. Provision or `--fx` / ROLE path: registerFunctionSchema + whitelist for:
        token.approve(address,uint256)
        Permit2.approve(address,address,uint160,uint48)
        UniversalRouter.execute(bytes,bytes[],uint256)
   6. Keep fundAccount zero-only; do not mix faucet into FX. Re-check must not break non-FX players.

C. TELLER DESK
   7. GET /quote  — V4Quoter; return amountOut, minOut (1% default), fee, deadline, route summary.
   8. POST /swap  — build calldata via Uniswap SDKs; sequential Lane A requestAndApproveExecution(s);
                   cache Permit2 allowance; return hashes, amounts, explorer links.
   9. Auth + requireConfigured like /pay. Clear FX_* / Uniswap revert → bank lines.
  10. Optional: smoke:fx or kill-tests-s1.ts for K7.

D. BRIDGE + SHARED
  11. Bridge methods: quote (and/or fxQuote) + fxSwap (names flexible; document in GODOT.md).
  12. Version bump label ok if ENS/Priority methods preserved.
  13. packages/shared types if needed.

E. GODOT — LOGIC
  14. game_state.run_action: "quote" / "fx_swap" (or match bridge); refresh balances after swap.
  15. MockChain: canned quote + fake swap for ?mock=account (never claim as K7).
  16. Dialogue: dealer.json (Johnny) per NPCS §4.7; Ask why = guard story.
  17. errors.json for new codes; run_checks (+ optional run_fx_walk.gd); commit .uid with any new script.

F. GODOT — VISUALIZATION (required for “end-to-end”)
  18. FX Desk place in Main wing (not Arc floor). Prefer an existing counter / alcove; do not redesign the whole greybox.
  19. Johnny NPC: home pose, interact Space, faces the desk; nameplate.
  20. Quote board: diegetic LED/panel showing rate, min out, fee tier, “quote valid mm:ss” from deadline (desk clock pattern like vault — honest about chain vs wall time if needed).
  21. Uniswap / FX signage visible in a viz shot (sponsor plaque — same class as Privy/ENS signage).
  22. Receipt / toast: in/out + explorer link in fine print.
  23. run_viz_budget / a named viz shot for FX desk; stay within existing Stage budgets; no Stage-6 art rabbit hole unless already on tree.

G. PRIZE / DOCS
  24. FEEDBACK.md (honest DX notes for Uniswap stack).
  25. README: point to guard batch + /swap + Sepolia tx hash.
  26. Progress note (gitignored ok) with K7 evidence; REFLECTION K7 row; HANDOFF §5i DoD.
  27. Reminder in progress note: human must submit https://developers.uniswap.org/hackathon-feedback with FEEDBACK.md URL.

DoD (all required):
- [ ] Sepolia addresses + pool documented in infra
- [ ] Account can swap only via whitelisted selectors (wrong target refused with bank line)
- [ ] Live K7: AccountBlox completes v4 swap on Sepolia; Etherscan hash in progress note
- [ ] /quote + /swap (or equivalent) + bridge + Johnny dialogue work on mock and live paths
- [ ] FX desk + Johnny + quote board visible in-world; viz budget not blown
- [ ] FEEDBACK.md committed; README points to integration lines
- [ ] run_checks green; no freeze regression
- [ ] Commit + push when the human asked

CONSTRAINTS:
- Prefer Fable 5.1
- Slippage default 1%; deadline ~300s; align meta-tx deadline
- Do not fund Arc; do not open second Privy surface for FX
- Cut if blocked: ship paperwork + one scripted Sepolia swap before fancy quote-board art

Stop when §5i DoD met or a named blocker with fallback (documented-only Uniswap + plaque — same honesty as Arc elevator).
```

---

## Suggested agent order

1. Infra addresses + pool (or blocker if faucet/key missing).
2. Guard batch + desk `/quote` `/swap` + K7 script.
3. Bridge + GameState + MockChain + Johnny JSON.
4. FX desk viz + quote board + signage + viz shot.
5. FEEDBACK.md + HANDOFF/REFLECTION; push.

## Paste block (short)

Copy the fenced `MISSION` block above into a new agent session after pointing it at this file and `docs/UNISWAP.md`.
