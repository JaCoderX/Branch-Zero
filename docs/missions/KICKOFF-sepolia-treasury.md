---
title: Kickoff prompt — Sepolia Ops Treasury (SEPOLIA_TREASURY_PK)
created: 2026-09-08
product: Branch-Zero
model: Claude Code · Opus 5 high
handoff: docs/missions/HANDOFF-sepolia-treasury.md
plan: docs/SEPOLIA-TREASURY.md
---

# Kickoff prompt — Sepolia Ops Treasury

Paste into a **new** Claude Code / Cursor session. Prefer **Opus 5 high** (Claude Opus 5 · high thinking).

**What this is:** Live-wing **ops treasury** — `SEPOLIA_TREASURY_PK` collects Sepolia **ETH** and **USDC**, then
tops up bank staff role wallets in the **background** (or via CLI) at **need × 1.25**. Not Arc, not packaging,
not a walkable Treasury Desk, not collapsing Okafor into the piggy bank.

**Why:** S2 funded Live by rebalancing the ENS registrar and minting a manager throwaway. That worked once;
steady-state should be faucet → treasury → staff, with role keys remaining separate identities.

**Faucets (human fills treasury):**
- ETH — https://cloud.google.com/application/web3/faucet/ethereum/sepolia (0.05 ETH/day)
- Circle USDC — https://faucet.circle.com/ (Ethereum Sepolia, 20 USDC/2h) → `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

---

## Reflect

| Fact | Implication |
|------|-------------|
| Manager / broadcaster / deployer / registrar are different duties | Treasury funds them; it does not become them |
| Practice USDC ≠ Circle USDC | Document both; gameplay stays practice token |
| Google/Circle faucets need humans | Script top-ups from treasury; do not claim faucets in CI |
| 25% margin | `target = need × 1.25`; refill when below need, fill to target |
| Dev wing has free lab ETH | Treasury is Sepolia Live only |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code Opus 5 high.

MISSION: Branch Zero — add SEPOLIA_TREASURY_PK as the Live-wing central collector for Sepolia ETH and USDC; background (and/or CLI) rebalance to bank staff role wallets so each is topped to need × 1.25 when below need. Keep role-key separation. No player-facing Treasury Desk.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SEPOLIA-TREASURY.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-sepolia-treasury.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/KICKOFF-sepolia-treasury.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SEPOLIA-LIVE.md
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SECURITY-AND-KEYS.md
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-CC.md
7. infra/scripts/sepolia-funding.ts · apps/teller-desk/src/config.ts

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Remote EVM: Dev only — do not wipe; treasury is Live/Sepolia only.
Faucets (human): Google Cloud ETH https://cloud.google.com/application/web3/faucet/ethereum/sepolia ; Circle USDC https://faucet.circle.com/ Ethereum Sepolia.

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. No custom Solidity for treasury (EOA transfers are enough).
- SEPOLIA_TREASURY_PK never receives BROADCASTER / BRANCH_MANAGER / OWNER / ENS registrar duties on player accounts.
- Keep SEPOLIA_DEPLOYER_PK, SEPOLIA_BROADCASTER_PK, SEPOLIA_MANAGER_PK, ENS_REGISTRAR_PK as distinct identities.
- Refuse Ganache-parity keys on any SEPOLIA_* slot (including treasury).
- Top-up: if balance < need, send enough to reach need × 1.25 (25% margin). Cap per-tx and rate-limit drains.
- Circle USDC 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 ≠ practice demo USDC 0xD332… in sepolia.json. Do not silently swap them.
- Rebalancing is background / CLI / desk-debug health — NOT a new lobby NPC or quest.
- Do not regress Sepolia Live, Dev mode, ENS, FX, Priority, faucet, OBSERVER, s2 killtests. Arc stays DEFERRED.
- No secrets in git. Stop on funding blockers rather than soft-sending.

SEQUENCE:
1. Document + .env.example: SEPOLIA_TREASURY_PK (and optional need overrides). Update SECURITY-AND-KEYS + SEPOLIA-LIVE §4 to point faucet drops at the treasury address first.
2. Extend funding:sepolia — show treasury ETH, Circle USDC, practice USDC; each staff role balance vs need/target (×1.25); refuse lab keys.
3. Implement treasury:topup (or equivalent): dry-run default; --execute sends ETH (and practice USDC if policy says so) from treasury → roles below need. Unit-test or scripted dry-run without leaking keys.
4. Optional Live desk background: before cloneBlox / when healthz reports short staff gas, trigger the same top-up path if treasury key is configured; never block Dev desk on missing treasury.
5. Desk debug (operator): treasury + staff balances; shortfall hints. No player UI required.
6. Evidence: dry-run output; optional executed top-up on Sepolia if treasury is funded; progress note; REFLECTION row; tick SEPOLIA-TREASURY §8; update HANDOFF-CC when met.

DoD = docs/SEPOLIA-TREASURY.md §8 + HANDOFF-sepolia-treasury.md.

OUT OF SCOPE: walkable Treasury Desk; merging manager into treasury; practice→Circle migration; Arc; ship packaging; automated faucet claiming; Remote EVM treasury.

Stop when DoD met or a named blocker (empty treasury, faucet gate) with the smallest honest fallback.
```

---

## After this pass

- Operator habit: faucet → treasury address only; run top-up before demos.
- Scrub a GameDevOS lesson only if something non-obvious bit (identity vs float).
- U7 packaging / Arc remain separate.
