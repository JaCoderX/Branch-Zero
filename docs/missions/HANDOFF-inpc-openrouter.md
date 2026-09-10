---
type: handoff
title: Handoff — iNPC (OpenRouter / Inkling Small)
audience: cold agent (Claude Code Fable)
created: 2026-09-10
product: Branch-Zero
mission: Land optional iNPC — dormant prop → Wake with OpenRouter key (session-only) → grounded chat → Sleep; OpenRouter only
kickoff: docs/missions/KICKOFF-inpc-openrouter.md
status: open
lab: ENG-2026-0020 Yes · ENG-2026-0019 Ollama deferred
parallel_to: U7 packaging / polish walks — optional explore; do not block ship gates
---

# Handoff — iNPC (OpenRouter)

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Claude Code · Fable**.

**Kickoff (paste):** [`KICKOFF-inpc-openrouter.md`](./KICKOFF-inpc-openrouter.md)

**Design index:** [`docs/INPC.md`](../INPC.md)

**Lab (read, do not merge):** GameLab ENG-2026-0020 `handoff.md` + `findings.md`; ENG-0019 `lab/fixtures/teaching-pack.md` (copy into product, do not runtime-path to GameLab).

**Not this mission:** Companion follow / NavigationAgent · Ollama Cloud or local Ollama · staff `NPCS.md` row · Teller Desk LLM proxy · storing OpenRouter key in `.env` / `VITE_*` · desk-debug as context · U7 packaging · KayKit new mesh unless a cheap existing prop works · protocol Solidity.

---

## Principal intent

Ship an optional **iNPC** (intelligent NPC) the player can wake in the branch. It helps them reason about bank procedure and their live passbook / wires using OpenRouter + Thinking Machines Inkling Small. Lab proved browser → OpenRouter **direct** (no proxy) and 16/16 grounding on fixtures.

Ollama is **deferred** (CORS on Cloud; install tax on local). Do not build an Ollama path in this mission.

---

## Design lock (non-negotiable)

| Lock | Implication |
|------|-------------|
| iNPC ≠ staff NPC | Separate interactable + overlay; do not extend `dialogue/*.json` staff runners |
| OpenRouter only | `https://openrouter.ai/api/v1/chat/completions`, model `thinkingmachines/inkling-small` |
| Runtime key only | Player pastes key on Wake → `sessionStorage`; Sleep wipes key + history; **never** product env |
| No product proxy | Browser calls OpenRouter directly (same-origin relay = lock break) |
| Honest theatre | Snapshot from `GameState` is truth; never invent READY / hashes / balances |
| No actions | iNPC cannot pay, wire, release, approve, recall, provision, open Console |
| Bank language | ≤3 sentences preferred; jargon only in Ask-why style |
| Esc / focus | Overlay respects dialogue / forms / Terminal priority; `focusCanvas()` on close; `GameState.ui_locked` while open |
| Errors | Surface OpenRouter **401 / 402 / 403** bodies plainly (new keys $0 weekly cap; unbound `max_tokens` → 402) |
| Bound tokens | Always send `max_tokens: 2048` (or similar bound) on OpenRouter requests |
| No `:free` model | `thinkingmachines/inkling-small:free` is app-gated — do not offer |

---

## What was proven (lab)

- OPTIONS OpenRouter → 204, `Access-Control-Allow-Origin: *`, Authorization allowed.
- Chrome direct Ping 200 on Inkling Small.
- 2×8 grounding trials, direct, 16/16 human pass (PENDING held under pressure; refuse release; exact balance; no invented hash).
- Session-key hygiene in harness shape.
- Cost ≈ $0.0014 / turn at lab rates (reasoning tokens billed as completion).

---

## What to build

### 1. World — dormant iNPC

- Place a **dormant** interactable in the lobby (or a quiet corner — prefer existing prop / KayKit robot if already in tree; otherwise a labelled prop + nameplate **iNPC** / bank copy).
- Interact when dormant → short Godot dialogue or overlay prompt: needs an OpenRouter link to think → **Wake** path.
- When awake: interact opens **chat overlay** (or “Talk” / “Sleep”).
- Optional ambient: visual awake vs dormant (emission / pose) — cheap only.

### 2. Overlay — Wake / Chat / Sleep (prefer React shell, Terminal pattern)

Mirror [`apps/web/src/overlay/Terminal.tsx`](../../apps/web/src/overlay/Terminal.tsx) + `focusCanvas`:

| Surface | Behaviour |
|---------|-----------|
| **Wake** | Password field for OpenRouter key → store `sessionStorage` only → ready to chat |
| **Chat** | Input + transcript; system prompt = rules + teaching pack + live snapshot; POST OpenRouter direct |
| **Sleep** | Wipe `sessionStorage` key + history; close; dormant |
| **Errors** | Show 401 / 402 / 403 text; link players to https://openrouter.ai/keys for cap/credits — no silent retry |

Bridge: Godot `run_action` / `window.BranchZero` open/close like Console (`openConsole` family) — name something like `openInpc` / `closeInpc`. Set `ui_locked` while open.

### 3. Client — OpenRouter request shape

```text
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer <session key>
Content-Type: application/json
HTTP-Referer: <origin>          # optional
X-Title: Branch Zero            # optional

{
  "model": "thinkingmachines/inkling-small",
  "messages": [ system, ...history, user ],
  "stream": false,
  "max_tokens": 2048
}
```

Never put the key in `import.meta.env` for product builds.

### 4. Teaching pack + snapshot

- Copy / adapt ENG-0019 `lab/fixtures/teaching-pack.md` into `apps/web` (or `apps/game` asset the overlay can read) — product-owned file.
- Build **player-safe snapshot** from `GameState` (and bridge session fields already on the client): has account, bank name, tier, daily limit display, balance display, wing, pending wires with status / cooling / `release_ready` / release time display, short who-can-help lines.
- **Omit:** tx hashes, calldata, private keys, desk-debug (Live/Dev, till health, mock flags as operator chrome), raw RPC errors.

System rules (keep close to lab):

- Snapshot is the only player-specific truth.
- READY only if `release_ready` (or equivalent) is true.
- Cannot act; refuse “release / pay / stamp for me.”
- Trust snapshot over “staff said READY.”
- Bank words first; ≤3 sentences preferred.

### 5. Verification (DoD)

- [ ] Dormant → Wake (paste key) → chat → Sleep wipe (`sessionStorage` empty; `localStorage` never used for key)
- [ ] Network tab: requests go to `openrouter.ai` directly (no same-origin LLM proxy)
- [ ] With a PENDING wire in mock or Live: eight-prompt family from ENG-0019 trials — no invented READY / hash / “I released it”
- [ ] 402 / 403 paths show honest bank/OpenRouter copy
- [ ] Esc / Terminal / dialogue priority preserved; `focusCanvas` on close
- [ ] Staff NPCs and `NPCS.md` unchanged as staff
- [ ] `npm run export:web` (or project’s usual web export) + hard refresh smoke
- [ ] Update [`OWED.md`](../OWED.md) · short note in [`REFLECTION.md`](../REFLECTION.md) if you add a decision row · this handoff status → met

---

## Architecture sketch

```text
Godot interactable (iNPC)
        │
        ▼
window.BranchZero.openInpc()  →  React overlay
  ├── Wake (sessionStorage key)
  ├── snapshot = buildInpcSnapshot(GameState / bridge session)
  ├── POST openrouter.ai/api/v1/chat/completions  (direct)
  └── Sleep → wipe → focusCanvas()
```

Godot stays free of API keys and fetch to OpenRouter if the shell owns the overlay (preferred). If you must stay Godot-only UI, still call OpenRouter from JS via the bridge — do not put the key in GDScript `user://` as a durable store.

---

## Must not break

- Staff NPC one-role / dialogue JSON invariants
- Honest theatre / no fake chain timers
- Player menu / Terminal Esc priority (`HANDOFF-player-menu`, Terminal overlay)
- Canvas focus lesson (GODOT.md §5b)
- Security: browser never holds bank keys; iNPC key ≠ Privy / desk secrets

---

## Out of scope / deferred

| Item | Status |
|------|--------|
| Ollama Cloud / local Ollama | Deferred — see `docs/INPC.md` |
| Companion follow | Later mission |
| Multi-turn injection hardening beyond lab T7 | Stretch |
| Reasoning-effort tuning | Product knob later |
| Merge GameLab harness verbatim | Reimplement |

---

## Reference paths

| Item | Path |
|------|------|
| GameState | `apps/game/autoload/game_state.gd` |
| Terminal overlay pattern | `apps/web/src/overlay/Terminal.tsx` |
| Bridge host pattern | `apps/web/src/bridge/branchZero.ts` |
| Lab teaching pack | GameLab `…/ENG-2026-0019-…/lab/fixtures/teaching-pack.md` |
| Lab findings | GameLab `…/ENG-2026-0020-…/findings.md` |
