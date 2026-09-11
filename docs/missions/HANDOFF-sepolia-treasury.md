---
type: handoff
title: Handoff — Sepolia Ops Treasury (SEPOLIA_TREASURY_PK)
audience: cold agent (Claude Code · Opus 5 high)
created: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
mission: Central Live-wing treasury for Sepolia ETH + USDC; background staff top-ups at need × 1.25
plan: docs/SEPOLIA-TREASURY.md
kickoff: docs/missions/KICKOFF-sepolia-treasury.md
baseline: Sepolia Live + Developer Mode MET 2026-09-08 (docs/SEPOLIA-LIVE.md §6)
---

# Handoff — Sepolia Ops Treasury

You are a **cold agent**. Prefer this file + the plan + kickoff over chat memory. Freedom on **how**.
No freedom on constraints, scope, or protocol semantics.

**Authorized construction:** add **`SEPOLIA_TREASURY_PK`** as the Live-wing collection point for **Sepolia ETH**
and **USDC**, with **background rebalancing** to bank staff role wallets at **need × 1.25**. Prefer
**Claude Code · Opus 5 high**.

**Plan:** [`docs/SEPOLIA-TREASURY.md`](../SEPOLIA-TREASURY.md)  
**Kickoff (paste):** [`docs/missions/KICKOFF-sepolia-treasury.md`](./KICKOFF-sepolia-treasury.md)  
**Prior unit:** [`docs/SEPOLIA-LIVE.md`](../SEPOLIA-LIVE.md) (MET)

---

## Learnings to carry (do not re-litigate)

1. **Identity ≠ gas float.** `SEPOLIA_MANAGER_PK` is Walker’s Priority stamp; deployer/broadcaster/registrar stay
   separate. S2 rebalanced from the ENS registrar only because faucet drops are scarce — that must not become the
   steady-state design.
2. **Live is Sepolia; Dev is 1337.** Treasury is Live-only. Do not invent a Remote EVM treasury.
3. **Two USDCs.** Circle faucet USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`) ≠ practice demo USDC
   (`0xD332…` in `sepolia.json`). Gameplay faucet stays practice token unless principal migrates.
4. **Faucets:** ETH → [Google Cloud Sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
   (0.05/day); USDC → [Circle](https://faucet.circle.com/) Ethereum Sepolia (20/2h). Humans fill treasury;
   agents do not bypass captcha/sign-in.
5. **Lab defaults burn public ETH.** Keep `OWNER_GAS` / `tickChain` / `MAX_TX_GAS` lessons; top-ups must not
   soft-send undersized gas.
6. **Logistics ≠ lobby.** Rebalancing is background / desk-debug / CLI — not a new walkable NPC desk.

---

## Principal intent

1. One address collects Live ETH + USDC (Circle + optional practice float).
2. When staff roles need gas (or practice float), top them up automatically or via one operator command.
3. Each top-up fills to **25% above** the defined need (`target = need × 1.25`).
4. Keep separation of duties; never point treasury at player AccountBlox roles.

---

## Baseline (do not regress)

- Sepolia Live default, Dev toggle, ENS/FX Sepolia-only, `fxTillIsMain` on Live, `killtests:s2`, Ganache refusal.
- U4 / U4+ / U5 / faucet / OBSERVER / S1 K7.
- Arc **DEFERRED**. No sharing Remote EVM. Runtime `@bloxchain/sdk` + `viem` only.

---

## DoD

See [`SEPOLIA-TREASURY.md`](../SEPOLIA-TREASURY.md) §8.

---

## Out of scope

Player Treasury Desk quest; merging manager into treasury; Circle↔practice token migration; Arc; ship packaging;
auto faucet claim.
