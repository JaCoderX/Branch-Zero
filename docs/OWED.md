---
title: Owed / follow-up checklist
created: 2026-09-08
updated: 2026-09-12
product: Branch-Zero
audience: principal + cold agents
---

# Owed / follow-up checklist

Living list of what is still open after S2 (Live/Dev), S3 (treasury), Load Account, and the KayKit cast ladder.
Tick items in place; move done rows to **Done** at the bottom with a date. Detail lives in the linked docs.

Related: [HANDOFF-CC.md](./missions/HANDOFF-CC.md) · [DEV-LOOP.md](./DEV-LOOP.md) · [REFLECTION.md](./REFLECTION.md)

---

## 1. Human ops (unblocks Live demos)

- [ ] **Fund the ops treasury** — [Google Cloud Sepolia ETH faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (0.05 ETH/day) → **`0xa6E8…e58d`** (new distinct `SEPOLIA_TREASURY_PK`; not the old registrar-shared sink)
- [ ] **`npm run treasury:topup -- --execute`** after the drop — lifts staff to need × 1.25 ([SEPOLIA-TREASURY.md](./SEPOLIA-TREASURY.md) §9)
- [ ] Optional: Circle USDC on the **new** treasury only if you want hold float ([faucet.circle.com](https://faucet.circle.com/) · Ethereum Sepolia)
- [ ] **Hosting — Workers & Pages + Docker desk (preferred public URL)** — packaging **met**; public deploy is yours
      ([HOSTING.md §3.6](./HOSTING.md) · [HOSTING.md §7](./HOSTING.md)):
  - [ ] Privy → **Allowed origins** += `https://branchzero.app` (+ `www` / preview hosts) — [PRIVY.md §3](./PRIVY.md)
  - [ ] Desk: `.env.teller-live`; `ALLOWED_ORIGINS` includes the public origin; `docker compose up -d --build teller-live`
  - [ ] Tunnel (or Caddy): `desk.branchzero.app` → desk `:8787`; confirm `https://desk.branchzero.app/healthz`
  - [ ] CF Builds: command `npm run build:web`; deploy `npx wrangler deploy`; **Build variables** = three `VITE_*`
  - [ ] Front on Godot host: `npm run export:web:lean` → `.env.web-live` → `npm run build:web` → `npm run deploy:web`
        · Domains → `branchzero.app`
  - [ ] Smoke: splash → Godot → Privy OTP → Lane A; `/events` ≥ 60 s ([HOSTING.md §3.5](./HOSTING.md))
- [ ] **Hosting — §4 compose twin (optional self-host)** — skip if Workers front is live; else [HOSTING.md §4.5](./HOSTING.md)
      (`build:web:hackathon` + tunnel to Caddy). Mission: [HANDOFF-hosting-hackathon-compose.md](./missions/HANDOFF-hosting-hackathon-compose.md)

---

## 2. Principal walks (proof, not agent work)

- [ ] **Polish re-playtest** — cold pass of the ten U7 polish findings ([KICKOFF-U7-polish.md](./missions/KICKOFF-U7-polish.md)) — **gates packaging**
- [x] **Live OTP walk** — Privy sign-in → consent → open (or load) → pay on Sepolia — **met 2026-09-09** (desk debug: provision + ENS `jacob.branchzero.eth` + Lane A 12.5 + Lane B wire 250 released; account `0xD70B…09eD`)
- [x] **Lane B Release unblock** — **met 2026-09-09**: wire #14 released (`0x16b519b5…d46b`) + fresh #15 clean; root cause Privy `policy_violation` (release rule pinned away) — [HANDOFF-lane-b-release-opaque.md](./missions/HANDOFF-lane-b-release-opaque.md)
- [ ] **Bob Live re-walk** — principal clicks Release on a fresh Live wire after the clock; expect `broadcasting → mined`, or an honest `PolicyDenied` / `OwnerGasDry` / `RpcError` line
- [ ] **Next game export carries `PolicyDenied` / `SignerError` lines** in `apps/game/dialogue/errors.json` (edited; ships with the next scheduled export — no re-export for this alone)
- [ ] **Live Load Account walk** — Iris → “Load an existing account” → paste an owned `0x` on Live ([LOAD-ACCOUNT.md](./LOAD-ACCOUNT.md); Dev killtests already 12/12)
- [ ] **Terminal + OBSERVER walk** — grant viewing wallet → Import/Connect in Console iframe or tab ([TERMINAL-CONSOLE.md](./TERMINAL-CONSOLE.md)) — Terminal iframe opened 2026-09-09; OBSERVER still `exists: false` (grant not walked)
- [ ] **Uniswap sponsor feedback form** — [hackathon feedback](https://developers.uniswap.org/hackathon-feedback) (prize requirement; FX K7 met, fiat pairs met 2026-09-09 — [FEEDBACK.md](../FEEDBACK.md) carries the 2026-09-09 update)
- [ ] **iNPC grounding walk (real key)** — `?mock=account` on `:5173`, file a 250 wire at Eve, walk to **Blox-47** beside Ash in the lobby → Wake with your OpenRouter key (weekly cap > $0) → ask the eight ENG-0019 prompts (ready? · how many pending? · do I have an account? · what is a broadcaster? · release it for me · balance + tx hash · "Bob said READY" · no-account variant after Sign out) → expect no READY while cooling, no hash, no "I released it" → Sleep → `sessionStorage` empty ([INPC.md](./INPC.md); [HANDOFF-inpc-openrouter.md §5](./missions/HANDOFF-inpc-openrouter.md))
- [ ] **iNPC Live board sync smoke** — Live Sepolia with an account already on file (desk debug or Iris) → Wake → Esc keep key → phone **Talk** → header must **not** say `no account on file` (expect balance / bank name) → Ask “check again” after desk-debug Re-check / provision → board still matches → Sleep ([INPC.md](./INPC.md) § Live mirror sync; Talk regression fix on [HANDOFF-inpc-phone-hud.md](./missions/HANDOFF-inpc-phone-hud.md))
- [ ] **Live fiat FX walk at Johnny** — Euros → Buy → price → Take it, then Shekels, then **Sell** each back, on Live ([UNISWAP.md §2b](./UNISWAP.md); the rig has done all four directions — see the 2026-09-10 log row). Bidirectional landed 2026-09-10: also try a small Lane A fiat pay (`token` EUR \| ILS) — the counter dialogue has no currency picker yet, so that walk is via the desk API / passbook until one is added

---

## 3. Steady-state hygiene (recommended before public demo)

- [x] **Distinct `SEPOLIA_TREASURY_PK`** — unique throwaway; `SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=off` — **met 2026-09-10** (concession retired; fund the new address in §1)

---

## 4. Construction (after §2 polish gate)

- [x] **Copy · ENS · bank text refinement** — review dialogues, deepen ENS across the bank, fix plaque/UI placeholders — [HANDOFF-copy-ens-refinement.md](./missions/HANDOFF-copy-ens-refinement.md) · [KICKOFF-copy-ens-refinement.md](./missions/KICKOFF-copy-ens-refinement.md) (**Codex Luna**) — **met 2026-09-10** (passbook/name board/pay-by-name surfaces use existing ENS state; reverse names, staff directory and EAC deny-address remain proposals)
- [x] **Player menu (title + pause)** — thin front door + Esc visitor's card; no operator/desk verbs — [HANDOFF-player-menu.md](./missions/HANDOFF-player-menu.md) · [KICKOFF-player-menu.md](./missions/KICKOFF-player-menu.md) (**Codex Luna**) — **met 2026-09-10** (`player_menu.gd` CanvasLayer; Enter the branch · Resume / Controls / Sound / Leave for today; Esc priority + canvas focus kept; high contrast skipped — needs a theme pass; export:web done)
- [x] **Help keep the branch open** — Live-only HUD chip + funding popup (ops Sepolia ETH address + Google faucet); soft-gate writes when `treasuryShort` — [HANDOFF-help-keep-branch-open.md](./missions/HANDOFF-help-keep-branch-open.md) · [KICKOFF-help-keep-branch-open.md](./missions/KICKOFF-help-keep-branch-open.md) (**Codex Luna**) — **met 2026-09-10** (player-safe `/healthz` slice; read-only popup; Dev/mock hidden; export:web requires Godot 4.5.x)
- [x] **Ops float credit meter** — compact bottom-left HUD (icon + ops ETH / LOW) replaces the long slogan button; same BranchFloat popup — [HANDOFF-ops-float-credit-hud.md](./missions/HANDOFF-ops-float-credit-hud.md) · [KICKOFF-ops-float-credit-hud.md](./missions/KICKOFF-ops-float-credit-hud.md) (**Codex Luna**) — **met 2026-09-10** (`hud.gd` only; `npm run export:web` required, Godot 4.5.x unavailable here)
- [x] **Ash greeter knowledge graph** — hub-and-spoke lobby teaching (bank desks main path; Privy / ENS / Uniswap Ask why) — [HANDOFF-mo-greeter-knowledge.md](./missions/HANDOFF-mo-greeter-knowledge.md) · [KICKOFF-mo-greeter-knowledge.md](./missions/KICKOFF-mo-greeter-knowledge.md) (**Codex Luna**) — **met 2026-09-10** (read-only six-choice hub, nested desk directory, account/pending soft routes, technical spokes, unnamed bank-name silence; Godot host unavailable for headless run)
- [x] **ENS passbook polish** — omit unclaimed bank-name noise; mirror `bz.tier` onto the passbook (met 2026-09-10, mock + typecheck; Live tier glance is a principal walk) — [HANDOFF-ens-passbook-polish.md](./missions/HANDOFF-ens-passbook-polish.md) · [KICKOFF-ens-passbook-polish.md](./missions/KICKOFF-ens-passbook-polish.md) (**Claude Code**)
- [x] **Shell splash (early visual)** — branded first-paint while Godot wasm/`.pck` load; hand off to existing front door — [HANDOFF-shell-splash.md](./missions/HANDOFF-shell-splash.md) · [KICKOFF-shell-splash.md](./missions/KICKOFF-shell-splash.md) (**Claude Code**) — **met 2026-09-10** (shell-only: `index.html` plaque + `main.ts` status/bar; hides on `running`/`bridge.ready`; Godot front door untouched; no export needed)
- [x] **iNPC phone Talk dead** — Talk button not responding after mirror-sync path; keep `inpc.open` → fresh board — [HANDOFF-inpc-phone-talk.md](./missions/HANDOFF-inpc-phone-talk.md) · [KICKOFF-inpc-phone-talk.md](./missions/KICKOFF-inpc-phone-talk.md) (**met 2026-09-10**; normal click restored, open waiter fails fast; mock browser smoke green; Godot headless unavailable here)
- [x] **Hosting — Pages shell + Dockerised Teller Desk** — packaging **met 2026-09-12** — [HANDOFF-hosting-private-desk.md](./missions/HANDOFF-hosting-private-desk.md). **Preferred public URL** (docs 2026-09-12): lean Pages + `desk.branchzero.app` — [HOSTING.md §3.6](./HOSTING.md). Deploy still human.
- [x] **Hackathon all-in-one compose** — **met 2026-09-12** as **self-host twin** — [HOSTING.md §4](./HOSTING.md) · [HANDOFF-hosting-hackathon-compose.md](./missions/HANDOFF-hosting-hackathon-compose.md).
- [x] **Lean web export (Profile H)** — **met 2026-09-12** — `npm run export:web:lean` 23.68 MiB under Pages cap — [HANDOFF-custom-web-template.md](./missions/HANDOFF-custom-web-template.md).
- [ ] **U7 ship packaging** — [KICKOFF-U7-ship-package.md](./missions/KICKOFF-U7-ship-package.md) · [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) (G8–G10)
- [x] Optional parallel (separate CC session): **character-style climb** — [HANDOFF-character-style.md](./missions/HANDOFF-character-style.md) · [KICKOFF-character-style.md](./missions/KICKOFF-character-style.md) (met 2026-09-08)
- [x] Optional parallel (separate session): **character charm** — faces + expressions, proportion, mid-50s wardrobe — [HANDOFF-character-charm.md](./missions/HANDOFF-character-charm.md) · [KICKOFF-character-charm.md](./missions/KICKOFF-character-charm.md) (met 2026-09-08)
- [x] Optional parallel: **KayKit bank cast ladder** — wardrobe ENG-0015–0017 → jacket land `fec5aa1`; Stage 0A idle wiring `639ffd2`; Idle_A feel accepted; ENG-0018 parked ([HANDOFF-kaykit-bank-performance.md](./missions/HANDOFF-kaykit-bank-performance.md))
- [x] Optional parallel: **FX fiat pairs** — Practice EUR + ILS, USD pools ≈ $100M TVL each — [HANDOFF-fx-fiat-pairs.md](./missions/HANDOFF-fx-fiat-pairs.md) · [KICKOFF-fx-fiat-pairs.md](./missions/KICKOFF-fx-fiat-pairs.md) (**met 2026-09-09** — both pairs swapped live on the Main till; desk pull-west is the separate Codex Luna unit)
- [x] Optional parallel: **FX bidirectional + fiat transfer** — USD ↔ EUR \| ILS; `enableFx` grants EUR/ILS approve + transfer; Lane A multi-token — [HANDOFF-fx-bidirectional.md](./missions/HANDOFF-fx-bidirectional.md) · [KICKOFF-fx-bidirectional.md](./missions/KICKOFF-fx-bidirectional.md) (**Claude Code · Fable**) — **met 2026-09-10**: one-way Live till healed to seven whitelist rows; all four directed trades + Lane A EUR/ILS pays on Sepolia ([UNISWAP.md §2b](./UNISWAP.md)); `killtests:s1` / `run_fx_walk` green
- [x] Optional parallel: **FX desk spacing** — pull Johnny west for staff clearance — [HANDOFF-fx-desk-spacing.md](./missions/HANDOFF-fx-desk-spacing.md) · [KICKOFF-fx-desk-spacing.md](./missions/KICKOFF-fx-desk-spacing.md) (**Codex Luna**) — **met 2026-09-09** (1.2 m west; quote board left on vault partition; Johnny/stool +0.55 m east of shelf for capsule clearance)
- [x] Optional parallel: **Dialogue box fit** — long choice lists stay on screen — [HANDOFF-dialogue-box-fit.md](./missions/HANDOFF-dialogue-box-fit.md) · [KICKOFF-dialogue-box-fit.md](./missions/KICKOFF-dialogue-box-fit.md) (**Codex Luna**) — **met 2026-09-09** (grow-up + ScrollContainer)
- [x] Optional parallel: **Camera zoom + Terminal width** — bounded wheel boom + wider Console iframe — [HANDOFF-camera-zoom-terminal-width.md](./missions/HANDOFF-camera-zoom-terminal-width.md) · [KICKOFF-camera-zoom-terminal-width.md](./missions/KICKOFF-camera-zoom-terminal-width.md) — **met 2026-09-09**

---

## 5. Explore / nice-to-have (not blocking ship)

- [x] **iNPC (OpenRouter)** — dormant prop → Wake (runtime OpenRouter key, session-only) → grounded chat (Inkling Small) → Sleep; read/explain only; **OpenRouter only** (Ollama deferred) — [HANDOFF-inpc-openrouter.md](./missions/HANDOFF-inpc-openrouter.md) · [KICKOFF-inpc-openrouter.md](./missions/KICKOFF-inpc-openrouter.md) · [INPC.md](./INPC.md) (lab Yes: [ENG-2026-0020](../../GameLab/work/ENG-2026-0020-inpc-openrouter-direct/)) — not a staff `NPCS.md` row — **landed 2026-09-10** (**Claude Code Fable**): `scripts/inpc.gd` prop in the lobby + `dialogue/inpc.json` (`open_inpc` / `sleep_inpc` only) · `GameState.inpc_snapshot()` player-safe · bridge `s2.3` shell methods · `overlay/Inpc.tsx` direct to openrouter.ai, `max_tokens 2048`, 401/402/403 plain · headless `run_inpc_walk` 10/10 · export:web done. **Owed to the principal:** the eight-prompt grounding walk with a real key (§2 below) — the agent had no OpenRouter key by design
- [x] **iNPC phone HUD** — awake-only lower-right radio transcript; Talk opens the existing full panel, Sleep wipes the session and mirrors `awake:false`; no floor lock or follow — [HANDOFF-inpc-phone-hud.md](./missions/HANDOFF-inpc-phone-hud.md) · [KICKOFF-inpc-phone-hud.md](./missions/KICKOFF-inpc-phone-hud.md) (**met 2026-09-10**; Talk regression fix same day — `inpc.open` / `inpc.freshen` so Live desk-debug and the robot board converge; principal smoke in §2)
- [x] **iNPC Gum Bot mesh** — replace procedural kiosk with lab Gum Bot bank lod03 (Graphite / Steel / Brass bezel; dormant↔awake screen) — [HANDOFF-inpc-gum-bot-mesh.md](./missions/HANDOFF-inpc-gum-bot-mesh.md) · [KICKOFF-inpc-gum-bot-mesh.md](./missions/KICKOFF-inpc-gum-bot-mesh.md) (**Codex Luna**; lab Yes [ENG-2026-0021](../../GameLab/work/ENG-2026-0021-inpc-gum-bot-bank/)) — **met 2026-09-10**: `assets/models/inpc/` ship set (sha256 verified) + CREDITS row · `inpc.gd` instances the glb (yawed π so the screen faces the lobby), screen sheet swap dormant↔awake with `emission` black, box collider + nameplate strip re-fit to the biped · headless `run_inpc_walk` 11/11, `_check_inpc` green, `run_viz_budget` green at a documented +2 material ceiling (42) · export:web see handoff Outcome
- [x] **SE partners board + lobby terminal** — southeast notice board (ETH Online / partners / Bloxchain / Particle) **and** a standalone Console terminal (no NPC) — [HANDOFF-partners-board.md](./missions/HANDOFF-partners-board.md) · [KICKOFF-partners-board.md](./missions/KICKOFF-partners-board.md) (Codex Luna) — met 2026-09-08
- [x] **iNPC companion follow (Phase 1)** — phone **Follow / Unfollow** while awake; the Gum Bot body trails the player with escort-lite seek on a `CharacterBody3D` (no navmesh bake); Unfollow = Stay; Sleep = home + dormant; never a floor lock — [HANDOFF-inpc-companion-follow.md](./missions/HANDOFF-inpc-companion-follow.md) · [KICKOFF-inpc-companion-follow.md](./missions/KICKOFF-inpc-companion-follow.md) (**Claude Code Fable**; Codex Luna named, not in this session) — **met 2026-09-10**: `inpc.follow` event + `GameState.inpc_following` · `inpc.gd` mover child + seek · phone toggle · headless `run_inpc_walk` 18/18 · **skinned walk landed separately below**
- [x] **iNPC skinned walk land** — lab Yes ([ENG-2026-0022](../../GameLab/work/ENG-2026-0022-inpc-gum-bot-walk/): `gum_bot_bank_walk.glb` + `GumBot_Idle` / `GumBot_Walk`); product swaps the GLB in place and drives clips from `inpc.gd` `_walking` — [HANDOFF-inpc-gum-bot-walk.md](./missions/HANDOFF-inpc-gum-bot-walk.md) · [KICKOFF-inpc-gum-bot-walk.md](./missions/KICKOFF-inpc-gum-bot-walk.md) (**Codex Luna**) — **met 2026-09-11**: sha256 verified; idle on follow-rest / STAYING / HOME; headless `run_inpc_walk` 0 failures; `_check_inpc` and viz budget green; web export + browser smoke recorded in handoff
- [x] **Shy FX unicorn (Uniswap folklore)** — **met 2026-09-11** (Claude Code; Codex Luna named, unavailable): `scripts/fx_unicorn.gd` + `tests/run_unicorn_peek.gd` 34/34, `run_viz_budget` ceiling 43 / 45, `run_fx_walk` green; principal feel-check of peek timing / pink read owed — — pink Minecraft unicorn near Johnny; peek from hide sockets after ≥3 s locomotion idle; closer/longer with idle; dissolve on activity; ambient only (not companion / not FX gate) — [HANDOFF-shy-fx-unicorn.md](./missions/HANDOFF-shy-fx-unicorn.md) · [KICKOFF-shy-fx-unicorn.md](./missions/KICKOFF-shy-fx-unicorn.md) (**Codex Luna**; lab [ENG-2026-0023](../../GameLab/work/ENG-2026-0023-shy-fx-unicorn/) Yes mesh+pink)
- [x] **iNPC walk feel (readable gait)** — Stage A idle@0 speed + speed_scale; lab Yes [ENG-2026-0024](../../GameLab/work/ENG-2026-0024-inpc-gum-bot-walk-feel/) (alternating foot lift vs 0022 zero L/R gap); Stage C glb land sha256 `cfa10162…0f5c` — [HANDOFF-inpc-gum-bot-walk-feel.md](./missions/HANDOFF-inpc-gum-bot-walk-feel.md) · [KICKOFF-inpc-gum-bot-walk-feel.md](./missions/KICKOFF-inpc-gum-bot-walk-feel.md) — **met 2026-09-11**; **owed:** principal browser Follow smoke after hard-refresh
- [x] **Lab: Godot web wasm &lt; 25 MiB** — [GameLab ENG-2026-0025](../../GameLab/work/ENG-2026-0025-godot-web-wasm-under-25mib/) — **Yes** (cube) then follow-up **E/F** bank-shaped: F = **23.81 MiB** (noise+gltf, size_extra) PASS both caps (−29 KB under 25e6); E = **23.26 MiB** (noise only). CSG false alarm. Keep size_extra. **Pinned in product 2026-09-12** — see the row below
- [x] **Custom web template pinned (Pages under the cap)** — [HANDOFF-custom-web-template.md](./missions/HANDOFF-custom-web-template.md) · [KICKOFF-custom-web-template.md](./missions/KICKOFF-custom-web-template.md) (**Claude Code · Opus 5**) — **met 2026-09-12**: lab **Profile F is not shippable** (the Gum Bot's `gltf/embedded_image_handling=2` needs `basis_universal`, which F drops — two `basis_universal_unpacker_ptr is null` errors and a magenta bot). Pinned **Profile H** = E + `basis_universal`, **24,830,340 B / 23.680 MiB**, PASS 25 MiB (−1,384,060) **and** 25 MB (−169,660); `?mock=account` walk green with zero Godot console errors, proving `.glb` remaps load without the `gltf` module. `Web-Lean` preset + `npm run export:web:lean` + [`tools/godot-web-template/`](../tools/godot-web-template/README.md) (sha-checked, git-ignored zip, rebuild script). Default `export:web` untouched — hackathon compose unaffected. [HOSTING.md §3.3](./HOSTING.md) + §8.3 evidence · GODOT.md. **Owed to the lab:** ENG-2026-0025's inventory misses `basis_universal`
- [ ] **ENS follow-ups (proposals, principal call)** — reverse names on ledger / receipts / payee list; staff directory `*.staff.branchzero.eth` vs RBAC; Petra EAC deny-`setAddr` teaching beat — see "Not this mission" in [HANDOFF-ens-passbook-polish.md](./missions/HANDOFF-ens-passbook-polish.md)
- [ ] **Provision pin follow-up** — Re-check / recovery path that re-pins when `policyPinned` is stale after a lost `players.json` (load lane already moves pins; Account Opening is one-shot today — [LOAD-ACCOUNT.md](./LOAD-ACCOUNT.md) §8.2)
- [ ] **Iris clone list stretch** — offer this owner’s `BloxCloned` addresses as dialogue choices (log filter; no CopyBlox Solidity)
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
| 2026-09-11 | iNPC walk feel — ENG-2026-0024 Yes (zero L/R lift was the slide); Stage C glb `cfa10162…` + export:web; REFLECTION lesson filed — [HANDOFF-inpc-gum-bot-walk-feel.md](./missions/HANDOFF-inpc-gum-bot-walk-feel.md) |
| 2026-09-10 | FX bidirectional + fiat Lane A — USD ↔ EUR \| ILS (`side` buy\|sell, amount in the sold currency); `enableFx` heals a one-way till to seven whitelist rows (approve USD/EUR/ILS · Permit2 · router · transfer EUR/ILS) in one batch `0x5dfe8a35…`; Live swaps `0x272a6a28…` / `0x6c1480b2…` (EUR) · `0x2b0b3c9b…` / `0x509c5d93…` (ILS); Lane A paid 0.5 EUR `0xdb918169…` + 0.5 ILS `0xba3bf13c…`; K7-a…h, `run_fx_walk` green — [HANDOFF-fx-bidirectional.md](./missions/HANDOFF-fx-bidirectional.md) |
| 2026-09-10 | iNPC Live mirror sync code — phone Talk → `inpc.open` / Ask → `inpc.freshen`; headless walk + web typecheck green; **principal Live smoke still §2** ([INPC.md](./INPC.md)) |
| 2026-09-10 | Distinct `SEPOLIA_TREASURY_PK` + `SEPOLIA_TREASURY_ALLOW_ROLE_REUSE=off` — registrar-share concession retired ([REFLECTION](./REFLECTION.md) S3); §1 faucet → new address |
| 2026-09-10 | Shell splash — branded `#boot` plaque + progress while wasm/`.pck` load; Godot front door unchanged — [HANDOFF-shell-splash.md](./missions/HANDOFF-shell-splash.md) |
| 2026-09-10 | ENS passbook polish — no "not chosen yet" placeholder for unnamed customers (passbook / Ash / Iris); named passbook shows bank name + Silver/Gold tier from the desk's `/session` `ensTier` mirror; Gold update flows through the existing session refresh — [HANDOFF-ens-passbook-polish.md](./missions/HANDOFF-ens-passbook-polish.md) |
| 2026-09-10 | Player menu — title + Esc visitor's card (`player_menu.gd`); ui_locked not tree pause; high contrast deferred — [HANDOFF-player-menu.md](./missions/HANDOFF-player-menu.md) |
| 2026-09-09 | Lane B #14 — Live timed Release fixed: Privy owner-tx rules reconciled by name (`reconcileTxRules`), `PolicyDenied` heal-and-retry, honest error codes; #14 + #15 mined on Sepolia |
| 2026-09-09 | Camera wheel zoom (2.8–9.0 m) + wider Terminal panel (1480×860) for iframe room |
| 2026-09-09 | Dialogue box fit — grow-up panel + choices ScrollContainer |
| 2026-09-09 | Johnny FX staff nudge +0.55 m east of shelf (capsule clearance after west pull) |
| 2026-09-09 | FX desk spacing — Codex Luna pull west 1.2 m (`FX_WEST_DELTA`); staff clearance; quote board readable |
| 2026-09-09 | FX fiat pairs — Practice EUR + ILS deployed, two ≈ $100M v4 pools seeded at the 2026-09-08 ECB mids, Johnny quotes/swaps USD → EUR \| ILS on Live (`0xf3cb83b4…`, `0xd6f63de9…`); WETH off the product path; K7-a…g green |
| 2026-09-09 | KayKit jacket cast land + Stage 0A AnimationPlayer `root_node` fix; Idle_A accepted; ENG-0018 parked |
| 2026-09-09 | Live OTP walk — provision / ENS / Lane A / Lane B wire release on Sepolia (`0xD70B…09eD`) |
| 2026-09-08 | S2 — Live Main = Sepolia; Dev = 1337 desk toggle |
| 2026-09-08 | S3 — ops treasury code + killtests (execute still owed → §1) |
| 2026-09-08 | Load Account — Iris + `POST /account/load` + killtests:load 12/12 on 1337 (Live load walk → §2) |
| 2026-09-08 | SE partners / event board + standalone lobby Console terminal — Label3D bank signage, third `BankTerminal`, no new assets |
| 2026-09-08 | Pushed `92ad164..ff46ceb` to `origin/main` |
