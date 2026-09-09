---
title: Owed / follow-up checklist
created: 2026-09-08
updated: 2026-09-09
product: Branch-Zero
audience: principal + cold agents
---

# Owed / follow-up checklist

Living list of what is still open after S2 (Live/Dev), S3 (treasury), Load Account, and the KayKit cast ladder.
Tick items in place; move done rows to **Done** at the bottom with a date. Detail lives in the linked docs.

Related: [HANDOFF-CC.md](./HANDOFF-CC.md) · [DEV-LOOP.md](./DEV-LOOP.md) · [REFLECTION.md](./REFLECTION.md)

---

## 1. Human ops (unblocks Live demos)

- [ ] **Fund the ops treasury** — [Google Cloud Sepolia ETH faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (0.05 ETH/day) → treasury address (today often `0xc4d7…9277` while reuse is on; prefer a **new** throwaway — see §3)
- [ ] **`npm run treasury:topup -- --execute`** after the drop — lifts staff to need × 1.25 ([SEPOLIA-TREASURY.md](./SEPOLIA-TREASURY.md) §9)
- [ ] Optional: Circle USDC already visible on the till (~30); top up only if you want more hold float ([faucet.circle.com](https://faucet.circle.com/) · Ethereum Sepolia)

---

## 2. Principal walks (proof, not agent work)

- [ ] **Polish re-playtest** — cold pass of the ten U7 polish findings ([KICKOFF-U7-polish.md](./KICKOFF-U7-polish.md)) — **gates packaging**
- [x] **Live OTP walk** — Privy sign-in → consent → open (or load) → pay on Sepolia — **met 2026-09-09** (desk debug: provision + ENS `jacob.branchzero.eth` + Lane A 12.5 + Lane B wire 250 released; account `0xD70B…09eD`)
- [ ] **Lane B Release unblock** — wire #14 still PENDING after clock; agent task [HANDOFF-lane-b-release-opaque.md](./HANDOFF-lane-b-release-opaque.md) · [KICKOFF-lane-b-release-opaque.md](./KICKOFF-lane-b-release-opaque.md) (**blocks Ruth Live re-walk**)
- [ ] **Live Load Account walk** — Ines → “Load an existing account” → paste an owned `0x` on Live ([LOAD-ACCOUNT.md](./LOAD-ACCOUNT.md); Dev killtests already 12/12)
- [ ] **Terminal + OBSERVER walk** — grant viewing wallet → Import/Connect in Console iframe or tab ([TERMINAL-CONSOLE.md](./TERMINAL-CONSOLE.md)) — Terminal iframe opened 2026-09-09; OBSERVER still `exists: false` (grant not walked)
- [ ] **Uniswap sponsor feedback form** — [hackathon feedback](https://developers.uniswap.org/hackathon-feedback) (prize requirement; FX K7 met, fiat pairs met 2026-09-09 — [FEEDBACK.md](../FEEDBACK.md) carries the 2026-09-09 update)
- [ ] **Live fiat FX walk at Kenji** — Euros → price → Take it, then Shekels, on Live ([UNISWAP.md §2b](./UNISWAP.md); the rig has already done both — `0xf3cb83b4…` / `0xd6f63de9…`)

---

## 3. Steady-state hygiene (recommended before public demo)

- [ ] **Distinct `SEPOLIA_TREASURY_PK`** — stop sharing the ENS registrar key; set `SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=off`; retire the concession ([REFLECTION](./REFLECTION.md) S3)
- [ ] While reuse is still on: consider `SEPOLIA_TREASURY_AUTO=off` if Name Desk writes and top-ups run in the same window (shared nonce)

---

## 4. Construction (after §2 polish gate)

- [ ] **U7 ship packaging** — [KICKOFF-U7-ship-package.md](./KICKOFF-U7-ship-package.md) · [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) (G8–G10)
- [x] Optional parallel (separate CC session): **character-style climb** — [HANDOFF-character-style.md](./HANDOFF-character-style.md) · [KICKOFF-character-style.md](./KICKOFF-character-style.md) (met 2026-09-08)
- [x] Optional parallel (separate session): **character charm** — faces + expressions, proportion, mid-50s wardrobe — [HANDOFF-character-charm.md](./HANDOFF-character-charm.md) · [KICKOFF-character-charm.md](./KICKOFF-character-charm.md) (met 2026-09-08)
- [x] Optional parallel: **KayKit bank cast ladder** — wardrobe ENG-0015–0017 → jacket land `fec5aa1`; Stage 0A idle wiring `639ffd2`; Idle_A feel accepted; ENG-0018 parked ([HANDOFF-kaykit-bank-performance.md](./HANDOFF-kaykit-bank-performance.md))
- [x] Optional parallel: **FX fiat pairs** — Practice EUR + ILS, USD pools ≈ $100M TVL each — [HANDOFF-fx-fiat-pairs.md](./HANDOFF-fx-fiat-pairs.md) · [KICKOFF-fx-fiat-pairs.md](./KICKOFF-fx-fiat-pairs.md) (**met 2026-09-09** — both pairs swapped live on the Main till; desk pull-west is the separate Codex Luna unit)
- [x] Optional parallel: **FX desk spacing** — pull Kenji west for staff clearance — [HANDOFF-fx-desk-spacing.md](./HANDOFF-fx-desk-spacing.md) · [KICKOFF-fx-desk-spacing.md](./KICKOFF-fx-desk-spacing.md) (**Codex Luna**) — **met 2026-09-09** (1.2 m west; quote board left on vault partition; Kenji/stool +0.55 m east of shelf for capsule clearance)
- [x] Optional parallel: **Dialogue box fit** — long choice lists stay on screen — [HANDOFF-dialogue-box-fit.md](./HANDOFF-dialogue-box-fit.md) · [KICKOFF-dialogue-box-fit.md](./KICKOFF-dialogue-box-fit.md) (**Codex Luna**) — **met 2026-09-09** (grow-up + ScrollContainer)
- [x] Optional parallel: **Camera zoom + Terminal width** — bounded wheel boom + wider Console iframe — [HANDOFF-camera-zoom-terminal-width.md](./HANDOFF-camera-zoom-terminal-width.md) · [KICKOFF-camera-zoom-terminal-width.md](./KICKOFF-camera-zoom-terminal-width.md) — **met 2026-09-09**

---

## 5. Explore / nice-to-have (not blocking ship)

- [x] **SE partners board + lobby terminal** — southeast notice board (ETH Online / partners / Bloxchain / Particle) **and** a standalone Console terminal (no NPC) — [HANDOFF-partners-board.md](./HANDOFF-partners-board.md) · [KICKOFF-partners-board.md](./KICKOFF-partners-board.md) (Codex Luna) — met 2026-09-08
- [ ] **Provision pin follow-up** — Re-check / recovery path that re-pins when `policyPinned` is stale after a lost `players.json` (load lane already moves pins; Account Opening is one-shot today — [LOAD-ACCOUNT.md](./LOAD-ACCOUNT.md) §8.2)
- [ ] **Ines clone list stretch** — offer this owner’s `BloxCloned` addresses as dialogue choices (log filter; no CopyBlox Solidity)
- [ ] Doc hygiene: keep [DEV-LOOP.md](./DEV-LOOP.md) unit rows in sync with HANDOFF-CC when units close
- [ ] Optional: in-shell **browser Fullscreen API** toggle (F11 already works; shell already fills the tab — [GODOT.md](./GODOT.md) web notes)

---

## 6. Parked / deferred (do not start without principal)

- [ ] **U6 Arc revive** — only via [ARC.md §5b](./ARC.md#5b-deferred-revive-checklist-g7--parked-2026-09-07); funded `ARC_*` keys required
- [ ] Practice token → Circle USDC migration
- [ ] Walkable “Treasury Desk” quest
- [ ] Privy Global Wallet / SaaS cross-app into Console
- [ ] Share / expose Remote EVM `1337` as public infra
- [ ] **ENG-2026-0018 KayKit clip authoring** — only if Idle_A still reads wrong after Stage 0A; census in [HANDOFF-kaykit-bank-performance.md](./HANDOFF-kaykit-bank-performance.md)

---

## Done (recent)

| When | Item |
|------|------|
| 2026-09-09 | Camera wheel zoom (2.8–9.0 m) + wider Terminal panel (1480×860) for iframe room |
| 2026-09-09 | Dialogue box fit — grow-up panel + choices ScrollContainer |
| 2026-09-09 | Kenji FX staff nudge +0.55 m east of shelf (capsule clearance after west pull) |
| 2026-09-09 | FX desk spacing — Codex Luna pull west 1.2 m (`FX_WEST_DELTA`); staff clearance; quote board readable |
| 2026-09-09 | FX fiat pairs — Practice EUR + ILS deployed, two ≈ $100M v4 pools seeded at the 2026-09-08 ECB mids, Kenji quotes/swaps USD → EUR \| ILS on Live (`0xf3cb83b4…`, `0xd6f63de9…`); WETH off the product path; K7-a…g green |
| 2026-09-09 | KayKit jacket cast land + Stage 0A AnimationPlayer `root_node` fix; Idle_A accepted; ENG-0018 parked |
| 2026-09-09 | Live OTP walk — provision / ENS / Lane A / Lane B wire release on Sepolia (`0xD70B…09eD`) |
| 2026-09-08 | S2 — Live Main = Sepolia; Dev = 1337 desk toggle |
| 2026-09-08 | S3 — ops treasury code + killtests (execute still owed → §1) |
| 2026-09-08 | Load Account — Ines + `POST /account/load` + killtests:load 12/12 on 1337 (Live load walk → §2) |
| 2026-09-08 | SE partners / event board + standalone lobby Console terminal — Label3D bank signage, third `BankTerminal`, no new assets |
| 2026-09-08 | Pushed `92ad164..ff46ceb` to `origin/main` |
