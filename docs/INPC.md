---
title: iNPC — intelligent NPC (OpenRouter)
created: 2026-09-10
updated: 2026-09-10
product: Branch-Zero
status: ready-to-build
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
| Context | Curated teaching pack + **player-safe** `GameState` snapshot — not desk-debug |
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

## Product docs

- Build brief: [`missions/HANDOFF-inpc-openrouter.md`](./missions/HANDOFF-inpc-openrouter.md)
- Paste kickoff: [`missions/KICKOFF-inpc-openrouter.md`](./missions/KICKOFF-inpc-openrouter.md)
