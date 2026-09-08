---
title: Sepolia Ops Treasury — SEPOLIA_TREASURY_PK
created: 2026-09-08
status: met 2026-09-08
product: Branch-Zero
handoff: docs/HANDOFF-sepolia-treasury.md
kickoff: docs/KICKOFF-sepolia-treasury.md
---

# Sepolia Ops Treasury

> One Live-wing wallet collects **Sepolia ETH** and **USDC**, then tops up bank staff role wallets in the
> background. Role keys stay separate (identity ≠ gas float). Not a walkable desk; not a player mechanic.

Related: [SEPOLIA-LIVE.md](./SEPOLIA-LIVE.md) · [SECURITY-AND-KEYS.md](./SECURITY-AND-KEYS.md) ·
[HANDOFF-sepolia-treasury.md](./HANDOFF-sepolia-treasury.md)

---

## 1. Decision (from principal + S2 learnings)

| Decision | Why |
|----------|-----|
| Add `SEPOLIA_TREASURY_PK` | Single faucet destination; stop ad-hoc “drain Petra to fund Ines” |
| Treasury holds **ETH + USDC** | Google Cloud ETH + Circle Sepolia USDC land in one place |
| Role keys stay distinct | Deployer / broadcaster / manager / registrar keep separation of duties |
| Rebalance in background | Ops logistics, not lobby gameplay; optional desk-debug visibility |
| Top-up amount = **need × 1.25** | 25% margin for fee spikes and one extra op |

**Hard line:** treasury **never** holds `OWNER` / `BROADCASTER` / `BRANCH_MANAGER` / ENS write rights on player
accounts. It only moves assets to wallets that already have those jobs.

---

## 2. What each staff role still needs (identity)

| Role | Env | On-chain job | Needs from treasury |
|------|-----|--------------|---------------------|
| Deployer | `SEPOLIA_DEPLOYER_PK` | `cloneBlox`, practice mint, owner-gas top-up | **ETH** (large); optional practice USDC float |
| Broadcaster | `SEPOLIA_BROADCASTER_PK` | Submit meta-txs (Main + FX when unified) | **ETH** |
| Manager | `SEPOLIA_MANAGER_PK` | Priority submit / recall (Okafor) | **ETH** (small) |
| ENS registrar | `ENS_REGISTRAR_PK` | Claim / setText / setAddr | **ETH** (small) |
| Recovery | `SEPOLIA_RECOVERY_ADDRESS` | Cold | **No** hot ETH from treasury by default |
| Treasury | `SEPOLIA_TREASURY_PK` | **None** on player accounts | Receives faucets; sends top-ups |

`SEPOLIA_MANAGER_PK` remains Okafor’s **stamp**, not the piggy bank. Treasury only keeps that stamp solvent.

---

## 3. Two USDC tokens (do not merge)

| Asset | Address (Sepolia) | How treasury gets it | What treasury does with it |
|-------|-------------------|----------------------|----------------------------|
| **ETH** | native | [Google Cloud Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) — 0.05 ETH/day → **treasury address** | Rebalance to staff EOAs (gas) |
| **Circle USDC** | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` ([Circle docs](https://developers.circle.com/stablecoins/usdc-contract-addresses)) | [faucet.circle.com](https://faucet.circle.com/) Ethereum Sepolia — 20 USDC / 2 h → **treasury** | Hold as ops float; do **not** treat as Ines practice dollars unless principal migrates |
| **Practice / demo USDC** | `0xD3322B29…422f` (`sepolia.json`) | Mint (open) into treasury or deployer when ETH allows | Optional float so Ines faucet / provision can draw without minting mid-desk; still not Circle USDC |

Gameplay passbook balances stay the **practice** token unless a later unit migrates.

---

## 4. Need model + 25% margin

Define a **baseline need** per role (ETH), then target balance:

```text
target = need × 1.25
topUp  = max(0, target − balance)
```

Only send when `balance < need` (or `balance < target` — implementer’s choice; prefer refill when below **need**,
fill up to **target** so we don’t drip every block).

### 4.1 Suggested ETH baselines (Live, revise with `funding:sepolia` measurements)

| Role | `need` ETH (order of magnitude) | `target` (= need × 1.25) | Covers |
|------|----------------------------------|---------------------------|--------|
| Deployer | `0.048` | `0.060` | ~1× `cloneBlox` (~0.0425 at measured fees) + mint + small cushion |
| Broadcaster | `0.012` | `0.015` | Several meta-txs / FX batches |
| Manager | `0.008` | `0.010` | Priority / recall headroom |
| ENS registrar | `0.008` | `0.010` | Claims + record writes |

Pin exact defaults in config (`SEPOLIA_TREASURY_NEED_<ROLE>_ETH` or a single JSON map). Re-measure after fee
regime changes; the **1.25 multiplier** stays fixed unless the principal changes it.

### 4.2 USDC baselines (optional first cut)

| Asset | Policy |
|-------|--------|
| Circle USDC | Accumulate on treasury; no auto-disperse to staff unless a documented consumer appears |
| Practice USDC | If deployer practice `balanceOf` &lt; faucet headroom, treasury (if it holds practice USDC) transfers up to `need × 1.25`; else deployer mints after ETH top-up |

---

## 5. Runtime shape

```text
Faucets ──► SEPOLIA_TREASURY_PK
                │
                ├── ETH ──► deployer / broadcaster / manager / registrar
                ├── Circle USDC ──► (hold)
                └── Practice USDC ──► deployer float (optional)
```

| Surface | Behaviour | As built |
|---------|------------|----------|
| `npm -w infra run funding:sepolia` | Show treasury + staff; shortfalls; suggested top-ups with ×1.25 | **yes** — treasury section first (ETH / Circle USDC / practice), then each role vs `need` / `target`. Privy-free, read-only |
| `npm run treasury:topup` | Read-only plan + optional `--execute` send from treasury | **yes** — dry run by default; `--execute`, `--partial`, `--json`, `--practice`. Exit 2 on a named blocker |
| Live Teller Desk (background) | Before expensive ops / periodic: if staff below need, top up | **yes** — `maybeTopUp('pre-cloneBlox')` before a clone, plus an unref'd interval watcher (`SEPOLIA_TREASURY_INTERVAL_SEC`, default 900 s). Both Live-only, key-only, rate-limited, and non-fatal |
| Desk debug | Balances: treasury ETH/USDC + each staff role; never expose private keys | **yes** — a `treasury` block on `/healthz` (cached 15 s) rendered as an operator row in the desk-debug panel. Absent on Dev |
| `npm run killtests:treasury` | — | **added** — T1–T7 read-only invariants (margin, role separation, lab-key refusal, two USDCs, caps, Live-only, no key leakage) |

**Nothing writes from `/healthz`.** It is unauthenticated, so an endpoint that moved money would be a
gas-drain vector wearing a health check. Health *reports*; the three writers are the CLI, the pre-`cloneBlox`
hook and the interval watcher.

**Dev wing (1337):** out of scope — lab genesis already funds Ganache accounts. Treasury is **Live / Sepolia only**.

---

## 6. Security

- Refuse Ganache-parity keys in `SEPOLIA_TREASURY_PK` (same address check as other Live keys).
- Treasury key on Live env only; not required for Dev desk boot.
- Cap per top-up and per hour so a bug cannot drain treasury in a loop.
- Log amounts + to-addresses; never log the key.
- Separation of duties unchanged: Priority still needs `SEPOLIA_MANAGER_PK` ≠ broadcaster ≠ treasury.

---

## 7. Out of scope

- Player-facing “Treasury Desk” quest  
- Collapsing manager/broadcaster into treasury  
- Migrating practice token to Circle USDC  
- Arc revive / sharing Remote EVM  
- Auto-claiming Google/Circle faucets (captcha / sign-in — human fills treasury)

---

## 8. Definition of done — **MET 2026-09-08**

- [x] `SEPOLIA_TREASURY_PK` in `.env.example` (with need overrides, caps and the practice-float switch) +
      SECURITY §1/§4.1/§5 and SEPOLIA-LIVE §4.1–4.4/§4.6 funding docs pointing drops at the treasury first
- [x] Funding script lists treasury (ETH / Circle USDC / practice) + staff `need` / `target` / shortfalls
- [x] Executable top-up path: `npm run treasury:topup [-- --execute]`, the pre-`cloneBlox` hook and the
      interval watcher, all through one planner
- [x] Circle USDC balance visible on the treasury (**30 USDC** read live), pinned in `sepolia.json` as
      `tokens.circleUsdc`, hold-only by policy; practice float implemented and **documented off** because the
      Live practice token is open-mint (§4.2)
- [x] Desk-debug operator row shows till health — no lobby NPC, no quest, no player surface
- [x] No role collapse in code (refused by derived address; demo opt-in is loud); Ganache refusal on the
      treasury slot; `killtests:treasury` 7/7 Live and 6/7 + 1 SKIP Dev; dry-run evidence in §9
- [x] Progress note + REFLECTION rows; HANDOFF-CC §5k updated

---

## 9. As built (2026-09-08)

One planner, three consumers. `packages/shared/src/treasury.ts` holds the need table, the ×1.25 arithmetic
(in wei, so `0.048 → 0.06` exactly), the cap defaults and `planTopUps()` — pure, no I/O. The read-only report,
the CLI and the desk all call it, so the dry run is a rehearsal of the execution rather than a second guess at
it. Everything that touches a key, the chain or the clock lives in `apps/teller-desk/src/treasury.ts`.

| Piece | File |
|-------|------|
| Need model, margin, caps, planner, Circle pin | `packages/shared/src/treasury.ts` |
| Engine: balances, ledger, caps, refusals, sends | `apps/teller-desk/src/treasury.ts` |
| Treasury signer (same Ganache refusal as every key) | `apps/teller-desk/src/chain.ts` |
| Config (Live-gated, all optional) | `apps/teller-desk/src/config.ts` |
| CLI | `apps/teller-desk/scripts/treasury-topup.ts` |
| Invariants | `apps/teller-desk/scripts/kill-tests-treasury.ts` |
| `/healthz` block + interval watcher | `apps/teller-desk/src/server.ts` |
| Pre-`cloneBlox` hook | `apps/teller-desk/src/lanes/provision.ts` |
| Operator row | `apps/web/src/overlay/App.tsx` |
| Report | `infra/scripts/sepolia-funding.ts` |

### 9.1 Decisions worth keeping

1. **A treasury that cannot reach `need` sends nothing.** The plan says fill to `target`; the honest failure
   when the float is thin is a named blocker with the exact deficit, not a dribble that leaves a role still
   below need and the treasury empty. `--partial` exists for the operator who wants the middle ground, and
   even it never lands a role below `need`.
2. **The deficit is computed once, in the planner.** The first version recomputed "how short are we" at each
   call site and printed `short by 0` — the reserve was missing from the subtraction. `TopUpLine.deficitWei`
   is now the single answer the CLI, the report and the panel all print.
3. **Neediest first.** With a thin treasury the deployer (one Account Opening, ~0.0425 ETH) must win over a
   registrar that is a few thousand gwei light, so the plan is ordered by shortfall descending.
4. **Health reports, three writers send.** See §5.
5. **Keys are normalised at the edge.** A bare 64-char key (how `ENS_REGISTRAR_PK` is stored) crashed
   `privateKeyToAccount` *before* the Ganache-parity check could run. `config.ts` now `0x`-normalises the
   treasury key so the refusal is reachable — a guard a malformed value can skip is not a guard.

### 9.2 Evidence (2026-09-08)

Treasury `0xc4d7cCabc561c7D9360481404DA8A80886a49277` — **0.029638 ETH**, **30 Circle USDC**
(`0x1c7D…7238`), **991.999979 practice USDC** (`0xD332…422f`, a different token, its own column).

`npm run treasury:topup` (dry run) against that till:

```text
staff wallets - refill below need, fill to need x 1.25
   role                                 balance      need       target     action
   Live Main deployer                   0.030815     0.048      0.06       BLOCKED - needs 0.010546 ETH more in the treasury
   Branch Manager (Priority)            0.00964      0.008      0.01       ok
   Live Main broadcaster (+ FX teller)  0.022711     0.012      0.015      ok
   ENS registrar                        0.029638     0.008      0.01       skip - this is the treasury key itself

BLOCKER - the treasury cannot fill every shortfall.
   holds 0.029638 ETH - needs 0.029184 ETH (plus 0.001 reserve) to reach every target
```

That is the honest state of the branch, not a failure of the unit: the deployer is one Account Opening short,
the treasury is 0.010546 ETH short of covering it after its reserve, and **a human claims the faucet**
(sign-in / captcha — agents do not). `/healthz` reports the same numbers, the desk-debug row shows them in
amber, and `killtests:treasury` is green on both wings.

**No regressions.** `killtests:s2` 6/6 on both wings; `npm run typecheck` clean; and the Dev wing's
`killtests` / `u2` / `u4plus` / `observer` / `smoke:faucet` / `u5` all green on lab gas — run there rather
than on Live precisely because the Live float cannot yet replace what they would spend. Three Privy-policy
assertions (K5, V6-b, Y8a) report on a **shared rig with no policy attached** rather than on the product;
re-running with `--fresh` restores `K5 PASS — policy_violation (HTTP 400)`. Details:
`docs/progress/2026-09-08-s3-sepolia-treasury.md` §5.1.

**Demo concession (principal-authorised, 2026-09-08):** `SEPOLIA_TREASURY_PK` is the **same key as
`ENS_REGISTRAR_PK`** on this laptop. That collapses "identity ≠ float", so it is refused by default and
requires `SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=on`; with it on, the registrar row is skipped (a self-transfer
moves nothing), its `target` is added to the reserve so a top-up cannot starve the Name Desk, and the
collapse is printed by the CLI, reported on `/healthz` and shown in the panel. **Steady state remains a
distinct throwaway** — see §1.

One consequence to know while the flag is on: two senders now share one account, and the Name Desk builds its
own wallet client, so it picks its nonce independently. A top-up issued while an ENS write is in flight can
collide on a nonce. That is a property of the collapse, not of the treasury.

### 9.3 Re-run

```bash
npm -w infra run funding:sepolia                      # treasury + staff vs need/target (read-only, no Privy)
npm run treasury:topup                                # dry run: the plan, and what is blocked
npm run treasury:topup -- --execute                   # send it (Live, treasury key required)
npm run treasury:topup -- --json                      # same plan, machine-readable
npm run killtests:treasury                            # T1-T7 invariants (Live)
npm run killtests:treasury -- --dev                   # ...and that Dev has no treasury at all
curl -s http://127.0.0.1:8787/healthz                 # .treasury block the desk-debug row renders
```
