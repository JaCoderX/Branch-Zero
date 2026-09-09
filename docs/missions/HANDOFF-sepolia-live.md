---
type: handoff
title: Handoff — Sepolia Live (payment wing) + Developer Mode
audience: cold agent (Claude Code · Opus 5 high)
created: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
mission: Promote Sepolia to Live Main payment wing; Remote EVM = Developer Mode (desk debug)
plan: docs/SEPOLIA-LIVE.md
kickoff: docs/missions/KICKOFF-sepolia-live.md
---

# Handoff — Sepolia Live + Developer Mode

You are a **cold agent**. Prefer this file + the plan + kickoff over chat memory. Freedom on **how**.
No freedom on constraints, scope, or protocol semantics.

**Authorized construction:** Sepolia becomes the **Live** payment wing (product default). Remote EVM `1337`
remains **Developer Mode** via desk debug. Prefer **Claude Code · Opus 5 high** (`claude-opus-5` / thinking high).

**Plan + funding runbook:** [`docs/SEPOLIA-LIVE.md`](../SEPOLIA-LIVE.md)  
**Kickoff (paste):** [`docs/missions/KICKOFF-sepolia-live.md`](./KICKOFF-sepolia-live.md)

---

## Principal intent

1. Outside users must play a **full Sepolia** game without access to private Remote EVM.
2. Operators keep **1337** for fast local iteration — labelled **Developer Mode**, toggled in **desk debug**.
3. **ENS** stays Sepolia-only and keeps current routing (fine as-is).
4. **FX** always Sepolia; requires a **real Sepolia account**; bank copy must say it only works on Sepolia.
5. Funding: document and follow
   - ETH — [Google Cloud Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (0.05 ETH / day)
   - Circle USDC — [faucet.circle.com](https://faucet.circle.com/) Ethereum Sepolia (20 USDC / 2 h)  
   Practice/demo USDC for gameplay remains the open-mint token in `sepolia.json` unless the principal migrates.

---

## Baseline (do not regress)

- U4 freeze, U4+ Priority, U5 ENS, practice faucet, U7 polish DoD, Terminal Console + OBSERVER (`u5.1`), S1/S1b FX (K7 green).
- U6 Arc **DEFERRED** — elevator stays “coming soon”; do not revive Arc to solve public access.
- Runtime deps: `@bloxchain/sdk` + `viem` only. No custom Solidity. No Ganache-parity keys on Sepolia.
- Do not wipe Remote EVM.

---

## Architecture constraints

| Fact | Implication |
|------|-------------|
| Teller `CHAIN_ID` is boot-time (`config.ts` today only allows 1337 \| Arc) | Extend to `11155111` / target `sepolia`; **two processes** for Dev+Live (Arc dual-desk pattern) |
| Web already has `/api` + `/arc-api` | Add `/dev-api` (or swap naming: `/api`=Live Sepolia, `/dev-api`=1337) |
| `switchWing` is Main↔Arc only | Dev/Live is a **new** session mode — do not overload Arc elevator |
| FX module already lazy-loads Sepolia | Keep; Live should prefer Main account == FX till |
| ENS module already Sepolia | Keep; Live pay-by-name pays on Sepolia; Dev keeps resolve→1337 pay |
| Player index is per desk process | Same Privy user may have different Main accounts per mode — isolate cleanly |

---

## DoD (summary) — **MET 2026-09-08**

See [`SEPOLIA-LIVE.md`](../SEPOLIA-LIVE.md) §6 (ticked) and §6.1 for the hashes. Minimum evidence, all delivered:

- **Live provision + Lane A + wire + timed release + Priority + faucet + OBSERVER on Sepolia**, with Etherscan
  links: account `0xf8EECc6B…A984` (real `cloneBlox`), Lane A `0x9e77e5b8…`, release `0xf729d387…`,
  Priority 84 s early `0xb2a202ca…`, faucet `0x1d9bee7f…`, OBSERVER grant `0x36aea1e3…`.
- **Desk debug Live | Dev** is the panel's primary control and works before sign-in; `/dev-api` → 1337 Main
  verified with Remote EVM up (`killtests:s2 -- --dev` 6/6, and the toggle driven in the browser).
- **Kenji is honest**: the FX till must be a live Sepolia AccountBlox owned by the player
  (`FX_TILL_NOT_SEPOLIA`, checked before anything is signed), and `FX_SEPOLIA_ONLY` /
  `{fx_chain_note}` say "Sepolia only" in bank words on both wings. On Live the till **is** the Main account.
- **Funding runbook followed**: `npm -w infra run funding:sepolia` (new) is the checklist; no Ganache-parity
  key was used on Sepolia, and both the desk and infra refuse them by derived address.
- Progress note: local `docs/progress/2026-09-08-s2-sepolia-live.md`; REFLECTION decision row added.

Open, and named rather than hidden:

- The Live wing's ETH came from **rebalancing the ENS registrar's balance** to the deployer and a new manager
  key (principal-authorised in session), not from a fresh faucet drop. The deployer holds ~0.034 ETH, which is
  roughly one more `cloneBlox`; a public demo needs a real top-up first (SEPOLIA-LIVE §4).
- No human has driven the Live wing through the **browser** end to end (Privy OTP → consent → pay). The desk
  paths are proven headlessly and the toggle is proven in the browser; the OTP walk stays owed, as it was on 1337.
- `?mode=dev` is honoured, and the Dev-desk-down banner is written but was not exercised with the desk stopped.

---

## Out of scope

Arc revive, ship packaging, sharing Remote EVM, Circle-USDC migration of the practice token, SaaS Console / Privy cross-app, GameLab ENG trees.
