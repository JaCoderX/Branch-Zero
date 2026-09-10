---
title: iNPC — intelligent NPC (OpenRouter)
created: 2026-09-10
updated: 2026-09-10
product: Branch-Zero
status: landed
lab: ENG-2026-0019 (Ollama CORS) · ENG-2026-0020 (OpenRouter Yes)
mission: docs/missions/HANDOFF-inpc-openrouter.md
note: Live mirror sync — phone Talk via Godot open_inpc; Ask freshen (2026-09-10)
---

# iNPC — Branch Zero

Optional **intelligent NPC**: a dormant bank service bot the player can wake with their own **OpenRouter** API key. It explains the bank and the live passbook/wires using a player-safe snapshot. It never stamps slips.

Not a staff NPC (`NPCS.md`). Separate species.

## Lab proof (captured)

| ENG | Result |
|-----|--------|
| [ENG-2026-0019](../../GameLab/work/ENG-2026-0019-inpc-ollama-cloud/) | Ollama Cloud: grounding Yes via lab proxy; **browser → ollama.com direct = CORS No** |
| [ENG-2026-0020](../../GameLab/work/ENG-2026-0020-inpc-openrouter-direct/) | **Yes** — OpenRouter direct CORS works; Inkling Small **16/16** grounded; session-key hygiene holds |
| [ENG-2026-0021](../../GameLab/work/ENG-2026-0021-inpc-gum-bot-bank/) | **Yes** — CC0 Gum Bot remapped Graphite / Steel / Brass bezel; Godot Compatibility screen swap proven — **landed 2026-09-10** ([HANDOFF-inpc-gum-bot-mesh.md](./missions/HANDOFF-inpc-gum-bot-mesh.md)) |

## Locks (principal)

| Lock | Value |
|------|-------|
| Provider | **OpenRouter only** for product v1 |
| Model | `thinkingmachines/inkling-small` |
| Key | Player paste at runtime → `sessionStorage` only; **never** product `.env` / `VITE_*` / Teller Desk |
| Agency | Read / explain only — no pay / wire / release / approve / provision |
| Context | Allowlisted [`docs/game-knowledge/`](./game-knowledge/) pack + **player-safe** `GameState` snapshot — not desk-debug; **not** root `AGENTS.md` or the rest of `docs/` |
| Request | Bound `max_tokens` (2048); surface 401 / 402 / 403 plainly |
| Ollama | **Deferred** (local install distribution; Cloud CORS blocked) — do not build in this mission |
| Companion follow | **Out of v1** — chat-only land first |

## Learnings worth keeping

### Lab / OpenRouter (ENG-0019 · ENG-0020)

1. **Bearer cloud APIs need a CORS preflight.** Ollama Cloud fails OPTIONS today; OpenRouter returns 204 + `ACAO: *`.
2. **OpenRouter pre-authorises `max_tokens` × price against remaining credits.** Omitting `max_tokens` reserves the full model window (~131k) → 402 on thin balances. Always send a bound.
3. **New OpenRouter keys default to a $0 weekly cap** → 403 until the player raises it on openrouter.ai/keys.
4. **`thinkingmachines/inkling-small:free` is app-gated** — not a product path.
5. **Grounding works** when the system prompt treats the snapshot as sole truth and refuses actions.
6. **Local Ollama + cloud models** fixes CORS but is a distribution trade for a public web game — deferred.

### Product context architecture (2026-09-10)

7. **Two audiences, two corpora.** Root [`AGENTS.md`](../AGENTS.md) briefs coding/ops agents. The in-game robot must **not** read it, nor `docs/missions/` handoffs/kickoffs, OWED, SECURITY, treasury, architecture, or `.env*`. Mixing them either leaks operator detail into chat or drowns grounding in noise.
8. **The robot has no tools and no GitHub.** Whatever it must know about Bloxchain accounts has to live as **player-safe markdown** under [`game-knowledge/`](./game-knowledge/) and ship in the web bundle (`?raw` imports). That folder is its **hard source of truth** — allowlist only (`system-rules.md`, `teaching-pack.md`, `bloxchain-account.md`). If a fact from an excluded doc is needed, rewrite it in bank words there; never link or copy the doc.
9. **Prompt order matters:** rules → teaching pack → technology primer → live snapshot. Keep the combined pack under ~5k tokens so the snapshot stays loud (~3.6k today).
10. **Shell methods must route even under `?mock`.** `Chain.SHELL_METHODS` keeps `openInpc` / snapshot / status / sleep on the real shell; MockChain alone refuses `INPC_UNAVAILABLE` without locking the floor.
11. **One overlay lock bit:** `GameState.overlay_open()` covers Console + iNPC (+ BranchFloat); Esc / `focusCanvas` / `inpc.closed` mirror the Terminal pattern.

### Visual (v1 land — review notes)

12. **Cheap palette prop is fine for v1** (no KayKit robot in tree; handoff allowed labelled prop). Brass / graphite / steel + Bulb eye respects the eight-omni budget and room language.
13. **Diegetic copy:** world plate is bank words only (`asleep · needs your link`). OpenRouter stays in dialogue Ask-why / Wake panel — **met 2026-09-10** visual polish.
14. **Fixed enamel plaque:** title + state on a paper/brass board on the lobby face of the column (not a billboard stack) — **met 2026-09-10**.
15. ~~**Silhouette still temp-prop vs KayKit:** cylinder stack + sphere beside Stage 6a couches.~~ **Met 2026-09-10 — Gum Bot mesh land** (ENG-2026-0021): a CRT-headed biped in Graphite / Steel with a Brass bezel now stands at the spot; the awake cue is the screen sheet (eyes) and the plaque is a nameplate strip under the CRT. Lessons: Godot samples `emission_texture` from UV1 only, and emission is additive — keep `emission` black and swap the sheet; a textured hero mesh costs its own two materials (budget ceiling 40 → 42, documented in `run_viz_budget`).
16. **Placement:** beside Mo at the lobby greeter post — `(3.5, 0, 4.5)`, yaw `π` (faces south toward the entrance, same as Mo).

## As built (2026-09-10)

| Piece | Where | Notes |
|-------|-------|-------|
| Dormant prop | `apps/game/scripts/inpc.gd` (`InpcProp extends BankTerminal`), placed by `main.gd` at `(3.5, 0, 4.5)` facing south beside Mo | Gum Bot bank glb (Graphite / Steel / Brass bezel); screen sheet dormant ↔ awake with `GameState.inpc_awake`; fixed paper/brass nameplate strip under the screen `BLOX-47` + bank-words state (`asleep · needs your link`); no billboards, no new lights |
| Dialogue | `apps/game/dialogue/inpc.json` | Verbs: `open_inpc`, `sleep_inpc` only. Dormant → *Wake it* / *Ask why* / *Leave it*; awake → *Talk* / *Put it to sleep* / *Ask why*. Not a staff row; no staff file mentions it |
| Snapshot | `GameState.inpc_snapshot()` | 17 whitelisted fields (account yes/no, bank name, tier, wing, network, balance / limit / cooling displays, pending wires with `release_ready` · `board_word` · `cooling_left_display` · `release_at_unix` · `release_at_display`, viewing-wallet count, zone, who-can-help). No addresses (payee shortened as on the board), hashes, receipts, owner, Live/Dev or link flags |
| Bridge | `branchZero.ts` `s2.3`: `openInpc` · `inpcSnapshot` · `inpcStatus` · `sleepInpc`; event `inpc.closed {reason, awake}` | `Chain.SHELL_METHODS` routes them to the real shell even under `?mock`; MockChain refuses `INPC_UNAVAILABLE` when there is no shell |
| Panel | `apps/web/src/overlay/Inpc.tsx` + `apps/web/src/inpc/{openrouter,pack,prompt,session,snapshot,types}.ts` | Wake (password field → `sessionStorage['inpc.openrouter.key']`, best-effort `GET /api/v1/key` names a $0 cap) → Chat (rules + pack + freshened snapshot → `POST openrouter.ai/api/v1/chat/completions`, `thinkingmachines/inkling-small`, `max_tokens 2048`, no retry) → Sleep (wipe key + transcript, `inpc.closed awake:false`). Esc / Close / backdrop close and `focusCanvas()`. A red line appears if the bundle ever carries a `VITE_*OPENROUTER*` key |
| Phone HUD | `apps/web/src/overlay/InpcPhone.tsx`, mounted by `App.tsx` | Awake-only lower-right radio with the same session transcript; **Talk** emits shell→Godot `inpc.open` so GameState runs `open_inpc` (fresh `inpc_snapshot()` after `refresh_session` / `refresh_passbook`, sets `inpc_open` + floor lock). Sleep uses `sleepInpc` and emits `inpc.closed {awake:false}` even when no modal is open. Phone alone never sets `overlay_open` or steals canvas focus |
| Knowledge SoT | [`docs/game-knowledge/`](./game-knowledge/) | Allowlist only: `system-rules.md` + `teaching-pack.md` + `bloxchain-account.md` (Ask-why technology primer). `pack.ts` imports them with Vite `?raw`; `prompt.ts` orders rules → pack → primer → snapshot. The robot has no tools or repo access at runtime — these files are its **hard source of truth**. `missions/`, `AGENTS.md` and all operator docs are **excluded** (list in the folder README) |
| Locks | `GameState.overlay_open()` | `Dialogue.close()`, `player_menu.gd`, `main.gd` prompt and both `can_talk()`s read it; Esc order and canvas focus unchanged |
| Tests | `tests/run_inpc_walk.gd` · `tests/run_checks.gd` `_check_inpc` | Snapshot whitelist + leak scan, READY only after `releaseTime`, no-shell refusal locks nothing (prop + `inpc.open`), verb list, start routing, lock mirror on `inpc.closed`, staff files silent |

### Live mirror sync (2026-09-10)

Desk-debug (`useBranchZeroWallet` `/session`) and the robot's board (`GameState.inpc_snapshot()`) are **two mirrors**. Provision / Pay / Re-check in desk-debug refresh React only. Convergence:

1. **Open (prop or phone Talk)** — `open_inpc` re-pulls `refresh_session()` (+ `refresh_passbook()` when logged in), then hands the shell a freshly built snapshot and sets `inpc_open` so `_push_inpc_snapshot` keeps working.
2. **Ask** — shell emits `inpc.freshen`; Godot re-pulls the same way and pushes one complete board before the model call (local `freshenSnapshot` still retimes vault clocks). Fallback: if Godot does not answer, Ask uses the last board + clock freshen only.
3. **Never** feed desk-debug React state into the robot; whitelist unchanged.
4. **Phone activation** — Talk and Sleep use ordinary button clicks so pointer handling cannot suppress activation; the Talk waiter reports shell failures and gives an honest error after 8 seconds rather than leaving the phone busy for 30 seconds.

## Context split (do not blur)

| Audience | Entry | May include |
|----------|-------|-------------|
| Coding / ops agents | Root [`AGENTS.md`](../AGENTS.md) → `docs/` + missions | Architecture, OWED, SECURITY, treasury, desk-debug |
| In-game iNPC | [`game-knowledge/`](./game-knowledge/) allowlist + live snapshot | Bank words, staff who-does-what, Ask-why glossary; **no** keys, hashes, Live/Dev ops |

Provenance: ENG-0019 fixture → product-owned under `game-knowledge/` (counter limit, Kenji, Sgt. Bale, Mo, viewing wallets, practice dollars). Technology primer distilled from the public Bloxchain account pattern + GAME-DESIGN §4 / NPCS Ask-why. Never read from GameLab or GitHub at runtime.

## Visual — as built + review (2026-09-10)

| Aspect | As built | Review |
|--------|----------|--------|
| Species | Prop, not staff mesh | Correct — separate from KayKit cast |
| Mesh | **Gum Bot bank** glb (`assets/models/inpc/gum_bot_bank.glb`, lod03, 3,590 tris, one UV set, two surfaces) instanced by `inpc.gd`, yawed π so the imported +z screen faces the lobby (−z); 1.14 × 1.40 × 1.18 m, feet at y = 0 | **Landed 2026-09-10** (ENG-2026-0021) — **Blox-47** beside Mo at the greeter post, facing south |
| Materials | Body albedo (Graphite shell · Steel plates · Brass bezel, baked in the lab) + screen emissive override; plaque strip on PropKit Paper / Brass | Two textured materials (the building's only non-palette mesh materials → `run_viz_budget` ceiling 42); no new lights |
| Awake cue | Screen `emission_texture` dormant sheet → `screen_awake.png` (Bulb eyes baked in), energy 1.0 → 2.0, `emission` kept black (additive), `albedo_color` black for a dark asleep screen; state plate text | Eyes read from the lobby; dormant screen dark under the sun |
| Labels | Fixed paper/brass nameplate strip under the CRT (screen width, y 0.32–0.50): `BLOX-47` + bank-words state | **Polish 1–2 met 2026-09-10** — no OpenRouter on the prop; no billboard; re-fit to the biped; named **Blox-47** |
| Spot | `INPC_SPOT (3.5, 0, 4.5)` · `INPC_YAW π` (south, beside Mo) | Lobby greeter pair |
| Interact | Extends `BankTerminal` for near/Space only; not in `terminal` group; box collider 1.14 × 1.40 × 1.18 on layer 1 / mask 0 | Correct — zone radius 1.9 still clears the body |

**Still optional:** blink / poweron polish, KayKit plinth. Companion follow still out of v1. Stills: `tests/inpc_shots.tscn` (windowed) → `docs/progress/captures/inpc-gum-bot/`.

**Mesh land (met 2026-09-10):** lab Gum Bot bank remap Yes — [HANDOFF-inpc-gum-bot-mesh.md](./missions/HANDOFF-inpc-gum-bot-mesh.md) · [KICKOFF-inpc-gum-bot-mesh.md](./missions/KICKOFF-inpc-gum-bot-mesh.md) (ENG-2026-0021); ship set + CC0 licence in `assets/models/inpc/`, [CREDITS.md](../CREDITS.md) row.

## Product docs

- Build brief: [`missions/HANDOFF-inpc-openrouter.md`](./missions/HANDOFF-inpc-openrouter.md)
- Paste kickoff: [`missions/KICKOFF-inpc-openrouter.md`](./missions/KICKOFF-inpc-openrouter.md)
- Game-knowledge index: [`game-knowledge/README.md`](./game-knowledge/README.md)
- Coding entry: [`AGENTS.md`](../AGENTS.md) (not loaded into the robot)
- Phone HUD (met): [`missions/HANDOFF-inpc-phone-hud.md`](./missions/HANDOFF-inpc-phone-hud.md)
- Phone Talk fix (met): [`missions/HANDOFF-inpc-phone-talk.md`](./missions/HANDOFF-inpc-phone-talk.md) · [`missions/KICKOFF-inpc-phone-talk.md`](./missions/KICKOFF-inpc-phone-talk.md) — normal click; `inpc.open` kept; 8s open waiter
