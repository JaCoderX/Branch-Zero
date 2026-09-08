---
title: Sepolia Ops Treasury — SEPOLIA_TREASURY_PK
created: 2026-09-08
status: planned
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

| Surface | Behaviour |
|---------|------------|
| `npm -w infra run funding:sepolia` | Extend: show treasury + staff; shortfalls; suggested top-ups with ×1.25 |
| `npm -w infra run treasury:topup` (or similar) | Read-only plan + optional `--execute` send from treasury |
| Live Teller Desk (background) | On idle / before expensive ops / periodic: if staff below need, request top-up path (script or in-process if treasury key present on Live desk only) |
| Desk debug | Balances: treasury ETH/USDC + each staff role; never expose private keys |

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

## 8. Definition of done

- [ ] `SEPOLIA_TREASURY_PK` in `.env.example` + SECURITY / SEPOLIA-LIVE funding docs  
- [ ] Funding script lists treasury + staff shortfalls with ×1.25 targets  
- [ ] Executable top-up path (CLI and/or Live desk background) moves ETH to roles below need  
- [ ] Circle USDC balance visible on treasury; practice USDC policy documented and implemented or explicitly deferred with a note  
- [ ] Desk-debug (or funding CLI) shows till health without being a lobby mechanic  
- [ ] No role collapse; Ganache refusal; kill/smoke or scripted dry-run evidence  
- [ ] Progress note + REFLECTION row; HANDOFF-CC updated when met  
