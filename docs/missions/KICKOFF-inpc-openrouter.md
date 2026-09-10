---
title: Kickoff prompt — iNPC (OpenRouter / Inkling Small)
created: 2026-09-10
product: Branch-Zero
model: Claude Code Fable
handoff: docs/missions/HANDOFF-inpc-openrouter.md
---

# Kickoff prompt — iNPC (OpenRouter)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Claude Code · Fable**.

**What this is:** Branch Zero product land — optional **iNPC** (not a staff NPC): dormant prop → Wake with **OpenRouter** key (session-only) → grounded chat from teaching pack + `GameState` snapshot → Sleep wipe. **OpenRouter only.** Ollama deferred.

**Why:** Lab ENG-2026-0020 Yes — browser → OpenRouter direct works; Inkling Small grounded 16/16. Ship the optional companion explainer without new infra or desk secrets.

**Baseline:** Main wing on `:5173` (mock or Live). Terminal overlay + `focusCanvas` already exist.

**Handoff:** [`HANDOFF-inpc-openrouter.md`](./HANDOFF-inpc-openrouter.md) · design [`docs/INPC.md`](../INPC.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| ENG-0019: ollama.com CORS blocked | Do not build Ollama in this mission |
| ENG-0020: OpenRouter ACAO `*` + direct Ping | Product path = browser → openrouter.ai, no proxy |
| New OR keys $0 weekly / unbound max_tokens → 402 | Bound `max_tokens`; honest 402/403 UX |
| Principal: no env key in product | Wake paste → sessionStorage only |
| iNPC ≠ staff | Do not add to `NPCS.md` staff roster / dialogue JSON staff pattern |
| Terminal pattern | React overlay + ui_locked + focusCanvas |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code Fable.

MISSION: Branch Zero — land optional iNPC (OpenRouter only).
(1) Dormant in-world interactable (lobby / quiet corner).
(2) Wake: player pastes OpenRouter API key → sessionStorage only.
(3) Chat overlay: teaching pack + player-safe GameState snapshot → POST https://openrouter.ai/api/v1/chat/completions direct; model thinkingmachines/inkling-small; max_tokens 2048.
(4) Sleep: wipe key + history; return focus to canvas.
Read/explain only — never pay/wire/release/approve/provision.

Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-inpc-openrouter.md
2. docs/missions/KICKOFF-inpc-openrouter.md
3. docs/INPC.md
4. docs/GAME-DESIGN.md §1 + §4
5. docs/NPCS.md §1–3 (iNPC is NOT a staff row)
6. docs/GODOT.md §5b (canvas focus)
7. apps/web/src/overlay/Terminal.tsx · apps/web/src/bridge/branchZero.ts · apps/game/autoload/game_state.gd
8. Skim lab (READ ONLY, copy fixtures — do not merge harness):
   D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0020-inpc-openrouter-direct\findings.md
   D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0020-inpc-openrouter-direct\handoff.md
   D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0019-inpc-ollama-cloud\lab\fixtures\teaching-pack.md

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Claude Code Fable. Product repo only (Branch-Zero). No GameLab ENG tree edits except if you must read fixtures.
- OpenRouter ONLY. No Ollama Cloud, no localhost:11434, no Teller Desk LLM proxy, no same-origin /or relay for product.
- NEVER store OPENROUTER_API_KEY in product .env, VITE_*, or build. Runtime Wake → sessionStorage; Sleep wipes.
- Always send max_tokens (2048). Surface 401/402/403 plainly. Do not offer inkling-small:free.
- Snapshot = player-safe GameState only (no desk-debug, no tx hashes, no keys).
- iNPC never calls pay/wire/approve/cancel/provision/priority.
- Preserve Esc priority: dialogue / slips / Terminal before iNPC; focusCanvas on close; ui_locked while open.
- Do not rewrite staff dialogue JSON or NPCS.md staff roster.
- Reimplement — do not copy GameLab lab/ into apps/web verbatim.
- Companion follow is OUT OF SCOPE.

DoD = HANDOFF-inpc-openrouter §5 Verification checklist + OWED tick + handoff status met.
Stop when met / blocked. Prefer mock walk with a PENDING wire for grounding smoke.
```
