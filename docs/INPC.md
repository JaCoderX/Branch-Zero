---
title: iNPC — intelligent NPC (OpenRouter)
created: 2026-09-10
updated: 2026-09-10
product: Branch-Zero
status: landed
lab: ENG-2026-0019 (Ollama CORS) · ENG-2026-0020 (OpenRouter Yes)
mission: docs/missions/HANDOFF-inpc-openrouter.md
---

# iNPC — Branch Zero

Optional **intelligent NPC**: a dormant bank service bot the player can wake with their own **OpenRouter** API key. It explains the bank and the live passbook/wires using a player-safe snapshot. It never stamps slips.

Not a staff NPC (`NPCS.md`). Separate species.

## Lab proof (captured)

| ENG | Result |
|-----|--------|
| [ENG-2026-0019](../../GameLab/work/ENG-2026-0019-inpc-ollama-cloud/) | Ollama Cloud: grounding Yes via lab proxy; **browser → ollama.com direct = CORS No** |
| [ENG-2026-0020](../../GameLab/work/ENG-2026-0020-inpc-openrouter-direct/) | **Yes** — OpenRouter direct CORS works; Inkling Small **16/16** grounded; session-key hygiene holds |

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

1. **Bearer cloud APIs need a CORS preflight.** Ollama Cloud fails OPTIONS today; OpenRouter returns 204 + `ACAO: *`.
2. **OpenRouter pre-authorises `max_tokens` × price against remaining credits.** Omitting `max_tokens` reserves the full model window (~131k) → 402 on thin balances. Always send a bound.
3. **New OpenRouter keys default to a $0 weekly cap** → 403 until the player raises it on openrouter.ai/keys.
4. **`thinkingmachines/inkling-small:free` is app-gated** — not a product path.
5. **Grounding works** when the system prompt treats the snapshot as sole truth and refuses actions.
6. **Local Ollama + cloud models** fixes CORS but is a distribution trade for a public web game — deferred.

## As built (2026-09-10)

| Piece | Where | Notes |
|-------|-------|-------|
| Dormant prop | `apps/game/scripts/inpc.gd` (`InpcProp extends BankTerminal`), placed by `main.gd` at `(7.6, 0, 2.4)` facing west — east of the lobby couches, off the escort line and the entrance walk | Brass / graphite / steel kiosk from palette materials; the eye swaps Graphite ↔ Bulb with `GameState.inpc_awake`; no new lights or materials; plate `SERVICE ASSISTANT` |
| Dialogue | `apps/game/dialogue/inpc.json` | Verbs: `open_inpc`, `sleep_inpc` only. Dormant → *Wake it* / *Ask why* / *Leave it*; awake → *Talk* / *Put it to sleep* / *Ask why*. Not a staff row; no staff file mentions it |
| Snapshot | `GameState.inpc_snapshot()` | 17 whitelisted fields (account yes/no, bank name, tier, wing, network, balance / limit / cooling displays, pending wires with `release_ready` · `board_word` · `cooling_left_display` · `release_at_unix` · `release_at_display`, viewing-wallet count, zone, who-can-help). No addresses (payee shortened as on the board), hashes, receipts, owner, Live/Dev or link flags |
| Bridge | `branchZero.ts` `s2.3`: `openInpc` · `inpcSnapshot` · `inpcStatus` · `sleepInpc`; event `inpc.closed {reason, awake}` | `Chain.SHELL_METHODS` routes them to the real shell even under `?mock`; MockChain refuses `INPC_UNAVAILABLE` when there is no shell |
| Panel | `apps/web/src/overlay/Inpc.tsx` + `apps/web/src/inpc/{openrouter,pack,prompt,session,snapshot,types}.ts` | Wake (password field → `sessionStorage['inpc.openrouter.key']`, best-effort `GET /api/v1/key` names a $0 cap) → Chat (rules + pack + freshened snapshot → `POST openrouter.ai/api/v1/chat/completions`, `thinkingmachines/inkling-small`, `max_tokens 2048`, no retry) → Sleep (wipe key + transcript, `inpc.closed awake:false`). Esc / Close / backdrop close and `focusCanvas()`. A red line appears if the bundle ever carries a `VITE_*OPENROUTER*` key |
| Knowledge SoT | [`docs/game-knowledge/`](./game-knowledge/) | Allowlist only: `system-rules.md` + `teaching-pack.md` + `bloxchain-account.md` (Ask-why technology primer). `pack.ts` imports them with Vite `?raw`; `prompt.ts` orders rules → pack → primer → snapshot. The robot has no tools or repo access at runtime — these files are its **hard source of truth**. `missions/`, `AGENTS.md` and all operator docs are **excluded** (list in the folder README) |
| Locks | `GameState.overlay_open()` | `Dialogue.close()`, `player_menu.gd`, `main.gd` prompt and both `can_talk()`s read it; Esc order and canvas focus unchanged |
| Tests | `tests/run_inpc_walk.gd` (10 checks) · `tests/run_checks.gd` `_check_inpc` | Snapshot whitelist + leak scan, READY only after `releaseTime`, no-shell refusal locks nothing, verb list, start routing, lock mirror on `inpc.closed`, staff files silent |

## Context split (do not blur)

| Audience | Entry | May include |
|----------|-------|-------------|
| Coding / ops agents | Root [`AGENTS.md`](../AGENTS.md) → `docs/` + missions | Architecture, OWED, SECURITY, treasury, desk-debug |
| In-game iNPC | [`game-knowledge/`](./game-knowledge/) allowlist + live snapshot | Bank words, staff who-does-what, Ask-why glossary; **no** keys, hashes, Live/Dev ops |

Provenance: ENG-0019 fixture → product-owned under `game-knowledge/` (counter limit, Kenji, Sgt. Bale, Mo, viewing wallets, practice dollars). Never read from GameLab at runtime.

## Product docs

- Build brief: [`missions/HANDOFF-inpc-openrouter.md`](./missions/HANDOFF-inpc-openrouter.md)
- Paste kickoff: [`missions/KICKOFF-inpc-openrouter.md`](./missions/KICKOFF-inpc-openrouter.md)
- Game-knowledge index: [`game-knowledge/README.md`](./game-knowledge/README.md)
