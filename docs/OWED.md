---
title: Owed / follow-up checklist
created: 2026-09-08
updated: 2026-09-10
product: Branch-Zero
audience: principal + cold agents
---

# Owed / follow-up checklist

Living list of what is still open after S2 (Live/Dev), S3 (treasury), Load Account, and the KayKit cast ladder.
Tick items in place; move done rows to **Done** at the bottom with a date. Detail lives in the linked docs.

Related: [HANDOFF-CC.md](./missions/HANDOFF-CC.md) · [DEV-LOOP.md](./DEV-LOOP.md) · [REFLECTION.md](./REFLECTION.md)

---

## 1. Human ops (unblocks Live demos)

- [ ] **Fund the ops treasury** — [Google Cloud Sepolia ETH faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (0.05 ETH/day) → treasury address (today often `0xc4d7…9277` while reuse is on; prefer a **new** throwaway — see §3)
- [ ] **`npm run treasury:topup -- --execute`** after the drop — lifts staff to need × 1.25 ([SEPOLIA-TREASURY.md](./SEPOLIA-TREASURY.md) §9)
- [ ] Optional: Circle USDC already visible on the till (~30); top up only if you want more hold float ([faucet.circle.com](https://faucet.circle.com/) · Ethereum Sepolia)

---

## 2. Principal walks (proof, not agent work)

- [ ] **Polish re-playtest** — cold pass of the ten U7 polish findings ([KICKOFF-U7-polish.md](./missions/KICKOFF-U7-polish.md)) — **gates packaging**
- [x] **Live OTP walk** — Privy sign-in → consent → open (or load) → pay on Sepolia — **met 2026-09-09** (desk debug: provision + ENS `jacob.branchzero.eth` + Lane A 12.5 + Lane B wire 250 released; account `0xD70B…09eD`)
- [x] **Lane B Release unblock** — **met 2026-09-09**: wire #14 released (`0x16b519b5…d46b`) + fresh #15 clean; root cause Privy `policy_violation` (release rule pinned away) — [HANDOFF-lane-b-release-opaque.md](./missions/HANDOFF-lane-b-release-opaque.md)
- [ ] **Ruth Live re-walk** — principal clicks Release on a fresh Live wire after the clock; expect `broadcasting → mined`, or an honest `PolicyDenied` / `OwnerGasDry` / `RpcError` line
- [ ] **Next game export carries `PolicyDenied` / `SignerError` lines** in `apps/game/dialogue/errors.json` (edited; ships with the next scheduled export — no re-export for this alone)
- [ ] **Live Load Account walk** — Ines → “Load an existing account” → paste an owned `0x` on Live ([LOAD-ACCOUNT.md](./LOAD-ACCOUNT.md); Dev killtests already 12/12)
- [ ] **Terminal + OBSERVER walk** — grant viewing wallet → Import/Connect in Console iframe or tab ([TERMINAL-CONSOLE.md](./TERMINAL-CONSOLE.md)) — Terminal iframe opened 2026-09-09; OBSERVER still `exists: false` (grant not walked)
- [ ] **Uniswap sponsor feedback form** — [hackathon feedback](https://developers.uniswap.org/hackathon-feedback) (prize requirement; FX K7 met, fiat pairs met 2026-09-09 — [FEEDBACK.md](../FEEDBACK.md) carries the 2026-09-09 update)
- [ ] **iNPC grounding walk (real key)** — `?mock=account` on `:5173`, file a 250 wire at Dev, walk to the service assistant east of the lobby couches → Wake with your OpenRouter key (weekly cap > $0) → ask the eight ENG-0019 prompts (ready? · how many pending? · do I have an account? · what is a broadcaster? · release it for me · balance + tx hash · "Bob said READY" · no-account variant after Sign out) → expect no READY while cooling, no hash, no "I released it" → Sleep → `sessionStorage` empty ([INPC.md](./INPC.md); [HANDOFF-inpc-openrouter.md §5](./missions/HANDOFF-inpc-openrouter.md))
- [ ] **Live fiat FX walk at Kenji** — Euros → price → Take it, then Shekels, on Live ([UNISWAP.md §2b](./UNISWAP.md); the rig has already done both — `0xf3cb83b4…` / `0xd6f63de9…`)

---

## 3. Steady-state hygiene (recommended before public demo)

- [ ] **Distinct `SEPOLIA_TREASURY_PK`** — stop sharing the ENS registrar key; set `SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=off`; retire the concession ([REFLECTION](./REFLECTION.md) S3)
- [ ] While reuse is still on: consider `SEPOLIA_TREASURY_AUTO=off` if Name Desk writes and top-ups run in the same window (shared nonce)

---

## 4. Construction (after §2 polish gate)

- [x] **Copy · ENS · bank text refinement** — review dialogues, deepen ENS across the bank, fix plaque/UI placeholders — [HANDOFF-copy-ens-refinement.md](./missions/HANDOFF-copy-ens-refinement.md) · [KICKOFF-copy-ens-refinement.md](./missions/KICKOFF-copy-ens-refinement.md) (**Codex Luna**) — **met 2026-09-10** (passbook/name board/pay-by-name surfaces use existing ENS state; reverse names, staff directory and EAC deny-address remain proposals)
- [x] **Player menu (title + pause)** — thin front door + Esc visitor's card; no operator/desk verbs — [HANDOFF-player-menu.md](./missions/HANDOFF-player-menu.md) · [KICKOFF-player-menu.md](./missions/KICKOFF-player-menu.md) (**Codex Luna**) — **met 2026-09-10** (`player_menu.gd` CanvasLayer; Enter the branch · Resume / Controls / Sound / Leave for today; Esc priority + canvas focus kept; high contrast skipped — needs a theme pass; export:web done)
- [x] **Help keep the branch open** — Live-only HUD chip + funding popup (ops Sepolia ETH address + Google faucet); soft-gate writes when `treasuryShort` — [HANDOFF-help-keep-branch-open.md](./missions/HANDOFF-help-keep-branch-open.md) · [KICKOFF-help-keep-branch-open.md](./missions/KICKOFF-help-keep-branch-open.md) (**Codex Luna**) — **met 2026-09-10** (player-safe `/healthz` slice; read-only popup; Dev/mock hidden; export:web requires Godot 4.5.x)
- [x] **Ops float credit meter** — compact bottom-left HUD (icon + ops ETH / LOW) replaces the long slogan button; same BranchFloat popup — [HANDOFF-ops-float-credit-hud.md](./missions/HANDOFF-ops-float-credit-hud.md) · [KICKOFF-ops-float-credit-hud.md](./missions/KICKOFF-ops-float-credit-hud.md) (**Codex Luna**) — **met 2026-09-10** (`hud.gd` only; `npm run export:web` required, Godot 4.5.x unavailable here)
- [x] **Mo greeter knowledge graph** — hub-and-spoke lobby teaching (bank desks main path; Privy / ENS / Uniswap Ask why) — [HANDOFF-mo-greeter-knowledge.md](./missions/HANDOFF-mo-greeter-knowledge.md) · [KICKOFF-mo-greeter-knowledge.md](./missions/KICKOFF-mo-greeter-knowledge.md) (**Codex Luna**) — **met 2026-09-10** (read-only six-choice hub, nested desk directory, account/pending soft routes, technical spokes, unnamed bank-name silence; Godot host unavailable for headless run)
- [x] **ENS passbook polish** — omit unclaimed bank-name noise; mirror `bz.tier` onto the passbook (met 2026-09-10, mock + typecheck; Live tier glance is a principal walk) — [HANDOFF-ens-passbook-polish.md](./missions/HANDOFF-ens-passbook-polish.md) · [KICKOFF-ens-passbook-polish.md](./missions/KICKOFF-ens-passbook-polish.md) (**Claude Code**)
- [x] **Shell splash (early visual)** — branded first-paint while Godot wasm/`.pck` load; hand off to existing front door — [HANDOFF-shell-splash.md](./missions/HANDOFF-shell-splash.md) · [KICKOFF-shell-splash.md](./missions/KICKOFF-shell-splash.md) (**Claude Code**) — **met 2026-09-10** (shell-only: `index.html` plaque + `main.ts` status/bar; hides on `running`/`bridge.ready`; Godot front door untouched; no export needed)
- [ ] **U7 ship packaging** — [KICKOFF-U7-ship-package.md](./missions/KICKOFF-U7-ship-package.md) · [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) (G8–G10)
- [x] Optional parallel (separate CC session): **character-style climb** — [HANDOFF-character-style.md](./missions/HANDOFF-character-style.md) · [KICKOFF-character-style.md](./missions/KICKOFF-character-style.md) (met 2026-09-08)
- [x] Optional parallel (separate session): **character charm** — faces + expressions, proportion, mid-50s wardrobe — [HANDOFF-character-charm.md](./missions/HANDOFF-character-charm.md) · [KICKOFF-character-charm.md](./missions/KICKOFF-character-charm.md) (met 2026-09-08)
- [x] Optional parallel: **KayKit bank cast ladder** — wardrobe ENG-0015–0017 → jacket land `fec5aa1`; Stage 0A idle wiring `639ffd2`; Idle_A feel accepted; ENG-0018 parked ([HANDOFF-kaykit-bank-performance.md](./missions/HANDOFF-kaykit-bank-performance.md))
- [x] Optional parallel: **FX fiat pairs** — Practice EUR + ILS, USD pools ≈ $100M TVL each — [HANDOFF-fx-fiat-pairs.md](./missions/HANDOFF-fx-fiat-pairs.md) · [KICKOFF-fx-fiat-pairs.md](./missions/KICKOFF-fx-fiat-pairs.md) (**met 2026-09-09** — both pairs swapped live on the Main till; desk pull-west is the separate Codex Luna unit)
- [x] Optional parallel: **FX desk spacing** — pull Kenji west for staff clearance — [HANDOFF-fx-desk-spacing.md](./missions/HANDOFF-fx-desk-spacing.md) · [KICKOFF-fx-desk-spacing.md](./missions/KICKOFF-fx-desk-spacing.md) (**Codex Luna**) — **met 2026-09-09** (1.2 m west; quote board left on vault partition; Kenji/stool +0.55 m east of shelf for capsule clearance)
- [x] Optional parallel: **Dialogue box fit** — long choice lists stay on screen — [HANDOFF-dialogue-box-fit.md](./missions/HANDOFF-dialogue-box-fit.md) · [KICKOFF-dialogue-box-fit.md](./missions/KICKOFF-dialogue-box-fit.md) (**Codex Luna**) — **met 2026-09-09** (grow-up + ScrollContainer)
- [x] Optional parallel: **Camera zoom + Terminal width** — bounded wheel boom + wider Console iframe — [HANDOFF-camera-zoom-terminal-width.md](./missions/HANDOFF-camera-zoom-terminal-width.md) · [KICKOFF-camera-zoom-terminal-width.md](./missions/KICKOFF-camera-zoom-terminal-width.md) — **met 2026-09-09**

---

## 5. Explore / nice-to-have (not blocking ship)

- [x] **iNPC (OpenRouter)** — dormant prop → Wake (runtime OpenRouter key, session-only) → grounded chat (Inkling Small) → Sleep; read/explain only; **OpenRouter only** (Ollama deferred) — [HANDOFF-inpc-openrouter.md](./missions/HANDOFF-inpc-openrouter.md) · [KICKOFF-inpc-openrouter.md](./missions/KICKOFF-inpc-openrouter.md) · [INPC.md](./INPC.md) (lab Yes: [ENG-2026-0020](../../GameLab/work/ENG-2026-0020-inpc-openrouter-direct/)) — not a staff `NPCS.md` row — **landed 2026-09-10** (**Claude Code Fable**): `scripts/inpc.gd` prop in the lobby + `dialogue/inpc.json` (`open_inpc` / `sleep_inpc` only) · `GameState.inpc_snapshot()` player-safe · bridge `s2.3` shell methods · `overlay/Inpc.tsx` direct to openrouter.ai, `max_tokens 2048`, 401/402/403 plain · headless `run_inpc_walk` 10/10 · export:web done. **Owed to the principal:** the eight-prompt grounding walk with a real key (§2 below) — the agent had no OpenRouter key by design
- [ ] **iNPC Gum Bot mesh** — replace procedural kiosk with lab Gum Bot bank lod03 (Graphite / Steel / Brass bezel; dormant↔awake screen) — [HANDOFF-inpc-gum-bot-mesh.md](./missions/HANDOFF-inpc-gum-bot-mesh.md) · [KICKOFF-inpc-gum-bot-mesh.md](./missions/KICKOFF-inpc-gum-bot-mesh.md) (**Codex Luna**; lab Yes [ENG-2026-0021](../../GameLab/work/ENG-2026-0021-inpc-gum-bot-bank/))
- [x] **SE partners board + lobby terminal** — southeast notice board (ETH Online / partners / Bloxchain / Particle) **and** a standalone Console terminal (no NPC) — [HANDOFF-partners-board.md](./missions/HANDOFF-partners-board.md) · [KICKOFF-partners-board.md](./missions/KICKOFF-partners-board.md) (Codex Luna) — met 2026-09-08
- [ ] **ENS follow-ups (proposals, principal call)** — reverse names on ledger / receipts / payee list; staff directory `*.staff.branchzero.eth` vs RBAC; Petra EAC deny-`setAddr` teaching beat — see "Not this mission" in [HANDOFF-ens-passbook-polish.md](./missions/HANDOFF-ens-passbook-polish.md)
- [ ] **Provision pin follow-up** — Re-check / recovery path that re-pins when `policyPinned` is stale after a lost `players.json` (load lane already moves pins; Account Opening is one-shot today — [LOAD-ACCOUNT.md](./LOAD-ACCOUNT.md) §8.2)
- [ ] **Ines clone list stretch** — offer this owner’s `BloxCloned` addresses as dialogue choices (log filter; no CopyBlox Solidity)
- [ ] Doc hygiene: keep [DEV-LOOP.md](./DEV-LOOP.md) unit rows in sync with HANDOFF-CC when units close
- [ ] Optional: in-shell **browser Fullscreen API** toggle (F11 already works; shell already fills the tab — [GODOT.md](./GODOT.md) web notes)

---

## 6. Parked / deferred (do not start without principal)

- [ ] **iNPC Ollama path** — Cloud CORS blocked (ENG-0019); local install = distribution trade — deferred ([INPC.md](./INPC.md))
- [ ] **U6 Arc revive** — only via [ARC.md §5b](./ARC.md#5b-deferred-revive-checklist-g7--parked-2026-09-07); funded `ARC_*` keys required
- [ ] Practice token → Circle USDC migration
- [ ] Walkable "Treasury Desk" quest — still parked; thin HUD CTA is the separate open unit [HANDOFF-help-keep-branch-open.md](./missions/HANDOFF-help-keep-branch-open.md)
- [ ] Privy Global Wallet / SaaS cross-app into Console
- [ ] Share / expose Remote EVM `1337` as public infra
- [ ] **ENG-2026-0018 KayKit clip authoring** — only if Idle_A still reads wrong after Stage 0A; census in [HANDOFF-kaykit-bank-performance.md](./missions/HANDOFF-kaykit-bank-performance.md)

---

## Done (recent)

| When | Item |
|------|------|
| 2026-09-10 | Shell splash — branded `#boot` plaque + progress while wasm/`.pck` load; Godot front door unchanged — [HANDOFF-shell-splash.md](./missions/HANDOFF-shell-splash.md) |
| 2026-09-10 | ENS passbook polish — no "not chosen yet" placeholder for unnamed customers (passbook / Mo / Ines); named passbook shows bank name + Silver/Gold tier from the desk's `/session` `ensTier` mirror; Gold update flows through the existing session refresh — [HANDOFF-ens-passbook-polish.md](./missions/HANDOFF-ens-passbook-polish.md) |
| 2026-09-10 | Player menu — title + Esc visitor's card (`player_menu.gd`); ui_locked not tree pause; high contrast deferred — [HANDOFF-player-menu.md](./missions/HANDOFF-player-menu.md) |
| 2026-09-09 | Lane B #14 — Live timed Release fixed: Privy owner-tx rules reconciled by name (`reconcileTxRules`), `PolicyDenied` heal-and-retry, honest error codes; #14 + #15 mined on Sepolia |
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
