---
title: Kickoff prompt — Sepolia Live + Developer Mode
created: 2026-09-08
product: Branch-Zero
model: Claude Code · Opus 5 high
handoff: docs/missions/HANDOFF-sepolia-live.md
plan: docs/SEPOLIA-LIVE.md
---

# Kickoff prompt — Sepolia Live (payment wing) + Developer Mode

Paste into a **new** Claude Code / Cursor session. Prefer **Opus 5 high** (Claude Opus 5 · high thinking).
Escalate only if CopyBlox/bootstrap or Privy multi-chain policy blocks for more than one honest attempt.

**What this is:** promote **Sepolia** to the **Live Main payment wing** (product default). Keep Remote EVM
`1337` as **Developer Mode** behind desk debug. ENS stays Sepolia. FX stays Sepolia and must require a real
Sepolia account. **Not** Arc revive, **not** ship packaging, **not** sharing Remote EVM.

**Why:** Remote EVM is private lab infra and will not be shared. Judges and outside players need a full public
testnet bank. PLAN already named Sepolia as the primary public chain.

**Funding (operator, before / during):** [`docs/SEPOLIA-LIVE.md`](../SEPOLIA-LIVE.md) §4 —
ETH via [Google Cloud Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (0.05 ETH/day);
Circle USDC via [faucet.circle.com](https://faucet.circle.com/) Ethereum Sepolia (20 USDC/2h). Practice gameplay
USDC is the open-mint demo token in `sepolia.json`, not Circle’s USDC, unless the principal migrates.

---

## Reflect (do not invent scope)

| Fact | Implication |
|------|-------------|
| Today Main pays on 1337; ENS/FX are Sepolia sidebands | Live must make Main = Sepolia; Dev keeps Main = 1337 |
| Teller boot pins one `CHAIN_ID` | Two desks (Live + Eve), Arc-style proxies — not one process flipping chain |
| Desk debug already has Main/Arc buttons | Add **Live \| Eve** mode; do not use Arc elevator for Sepolia |
| FX till is already a Sepolia AccountBlox | Live: unify with Main account when possible; Eve: till ≠ Main is OK |
| Circle faucet ≠ practice token | Document both; Iris faucet mints demo USDC after deployer has ETH |
| Google Cloud ETH is 0.05/day | Fund each role address; don’t soft-send undersized gas limits |

**Semantics (locked):**

1. **Live** = default = Sepolia payment wing for Iris/Eve/Bob/Walker/faucet/OBSERVER.
2. **Eve** = Developer Mode = Remote EVM payment wing; operator-only.
3. ENS always Sepolia.
4. FX always Sepolia; refuse without a real Sepolia account; say so in bank words.
5. Never publish Remote EVM; never put lab keys on Sepolia.

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code Opus 5 high.

MISSION: Branch Zero — promote Sepolia to the Live Main payment wing (product default); keep Remote EVM 1337 as Developer Mode toggled from desk debug; ENS stays Sepolia; FX stays Sepolia and requires a real Sepolia account with honest copy.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SEPOLIA-LIVE.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-sepolia-live.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/KICKOFF-sepolia-live.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-CC.md
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REMOTE-EVM.md
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SECURITY-AND-KEYS.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/UNISWAP.md
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ENS.md
9. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/PRIVY.md
10. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ARCHITECTURE.md
11. apps/teller-desk/src/config.ts · chain.ts · server.ts
12. apps/web/src/overlay/useBranchZeroWallet.ts · App.tsx · vite.config.ts
13. infra/deployments/sepolia.json · remote-evm.json

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Remote EVM (Dev only): D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (do not wipe)
Funding: SEPOLIA-LIVE.md §4 — Google Cloud ETH https://cloud.google.com/application/web3/faucet/ethereum/sepolia (0.05 ETH/day); Circle USDC https://faucet.circle.com/ Ethereum Sepolia (20 USDC/2h). Never Ganache-parity keys on Sepolia.

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. No custom Solidity. No sharing Remote EVM as public infra.
- Live default for normal play / hosted demo. Dev mode is operator (desk debug ± optional ?mode=dev).
- Two Teller processes for Live+Eve (extend CHAIN_ID to allow 11155111; target sepolia; deployments from sepolia.json). Mirror Arc /api + /arc-api with /api (Live) + /dev-api (1337) or equivalent clear naming.
- Eve/Live is NOT Arc switchWing and NOT MockChain. Do not revive Arc elevator.
- ENS stays Sepolia side-module. Live: resolve → pay on Sepolia. Eve: keep resolve Sepolia → pay 1337 if that path remains.
- FX always Sepolia. Require a real Sepolia AccountBlox before enable/swap. Bank lines + errors.json: FX only works on Sepolia. Prefer Live Main account == FX till; Eve may keep separate till.
- Practice dollars = open-mint demo USDC in sepolia.json (deployer mint/faucet), NOT Circle faucet USDC, unless principal migrates.
- Privy: supportedChains include Sepolia + Remote EVM; policies pin chainId + verifyingContract per active Main account; FX Sepolia rule retained.
- Do not regress U4/U4+/U5/faucet/OBSERVER/S1 K7 invariants. Do not wipe Remote EVM. No secrets in git.
- Godot board / passbook / healthz must show the active payment chain (not hard-coded Remote EVM 1337 when Live).
- Stop and name a funding blocker if Sepolia keys lack ETH — do not soft-send undersized gas.

SEQUENCE:
1. Funding checklist: list every Sepolia address that needs ETH; confirm Google Cloud / Circle steps in SEPOLIA-LIVE §4; refuse to burn lab keys on Sepolia.
2. Bootstrap / extend Sepolia payment deployment (CopyBlox + practice token + libraries as needed). Record addresses in infra/deployments/sepolia.json.
3. Teller: support CHAIN_ID=11155111 / target sepolia; provision, pay, wire, Priority, faucet, OBSERVER against Sepolia deployment. Smoke on Etherscan.
4. Dual desk + Vite proxies: Live desk + Dev desk (1337). Web session mode Live|Dev; callOnChain / tellerFor routes correctly; /session rebind on toggle.
5. Desk debug UI: primary Live | Dev toggle; show mode, chainId, Main account, FX till, ENS status. Keep Arc controls deferred/disabled as today.
6. FX: enforce real Sepolia account; update dealer.json / errors.json copy; Live unify till with Main when safe; Eve documents Sepolia-only.
7. ENS: verify Live pay-by-name on Sepolia; Dev path still honest.
8. Defaults: Live when mode unset; document .env.example (SEPOLIA_* / dual PORT / proxies); update SECURITY-AND-KEYS env table; NPCS/GODOT board strings as needed.
9. Evidence: local docs/progress/ note + REFLECTION row; tick SEPOLIA-LIVE §6 DoD; update HANDOFF-CC mission pointer when met.

DoD = docs/SEPOLIA-LIVE.md §6 + HANDOFF-sepolia-live.md.

OUT OF SCOPE: Arc G7 revive; ship packaging; exposing Remote EVM; migrating practice token to Circle USDC; Privy Global Wallet / bloxchain.app SaaS; GameLab ENG trees; custom Solidity.

Stop when DoD met or a named blocker (funding, CopyBlox missing, Privy policy) with the smallest honest fallback.
```

---

## After this pass

- Hosted demo runs **Live only**.
- Scrub craft lessons to GameDevOS only if something non-obvious bit (dual-desk session isolation, faucet token confusion).
- Packaging / Arc remain separate kickoffs.
