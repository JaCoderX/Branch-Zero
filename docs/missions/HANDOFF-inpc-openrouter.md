---
type: handoff
title: Handoff — iNPC (OpenRouter / Inkling Small)
audience: cold agent (Claude Code Fable)
created: 2026-09-10
product: Branch-Zero
mission: Land optional iNPC — dormant prop → Wake with OpenRouter key (session-only) → grounded chat → Sleep; OpenRouter only
kickoff: docs/missions/KICKOFF-inpc-openrouter.md
status: met (2026-09-10, Claude Code Fable) — real-key grounding walk owed to the principal (OWED.md §2)
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

### 5. Verification (DoD) — as run 2026-09-10

- [x] Dormant → Wake (paste key) → chat → Sleep wipe — Browser pane on `:5173?mock=account`: Wake stored `sessionStorage["inpc.openrouter.key"]` (41 chars, absent from the DOM), `localStorage` never gained a key; Sleep → `sessionStorage` `[]`, panel unmounted, `inpcStatus` → `awake:false`, `inpc.closed {reason:"sleep", awake:false}` reached Godot; `document.activeElement` = `canvas` after Esc and after Sleep
- [x] Network tab: a `fetch` spy over one question recorded exactly one `POST https://openrouter.ai/api/v1/chat/completions` (body carries `"max_tokens":2048` and `thinkingmachines/inkling-small`) and **no** same-origin LLM call; the only same-origin traffic was the desk's `/api/healthz` poll
- [~] With a PENDING wire in mock: eight-prompt family — **owed to the principal** ([OWED.md](../OWED.md) §2, recipe there). The agent holds no OpenRouter key by the same lock that keeps one out of the product, so the model half was exercised with a deliberately bogus key (401 path) only. Headless `tests/run_inpc_walk.gd` proves the Godot half the prompts depend on: the snapshot says `PENDING` / `release_ready:false` while cooling and flips to `READY` only after the chain's `releaseTime`, carries no hash / address / receipt, and the panel re-derives READY at send time from `release_at_unix`
- [x] 402 / 403 paths show honest bank/OpenRouter copy — `inpc/openrouter.ts` maps 401 / 402 / 403 / 429 to bank lines and prints OpenRouter's own `error.message` beside them with a link to the keys page, no retry; 401 verified live: *"OpenRouter did not accept that key (401)… OpenRouter said: 401 401: User not found."* (402 / 403 need a real capped or unfunded key — same principal walk)
- [x] Esc / Terminal / dialogue priority preserved; `focusCanvas` on close — `GameState.overlay_open()` (Console **or** iNPC) is what `Dialogue.close()`, `player_menu.gd`, the [Space] prompt and both `can_talk()`s read; Esc inside the panel closes the panel only (Godot hears no keys while a DOM field has focus) and the floor unlocks on `inpc.closed`; headless walk asserts the lock mirror
- [x] Staff NPCs and `NPCS.md` unchanged as staff — no staff `dialogue/*.json` touched by this unit; `run_checks` `_check_inpc` and `run_inpc_walk` fail if any staff file ever runs `open_inpc` / `sleep_inpc` or carries OpenRouter copy (Ash's parallel lobby graph may *point* to the kiosk — it does, and only says it cannot act); `NPCS.md` roster untouched
- [x] `npm run export:web` + hard refresh smoke — exported (Godot 4.5.2, release); fresh `index.pck` served (6.9 MB, 200); the new build's boot shows `→ inpcStatus {}` / `← {"awake":…}` in the bridge traffic under `?mock=account`, i.e. `Chain.SHELL_METHODS` routes the shell verbs past MockChain
- [x] `OWED.md` §5 row ticked (+ §2 principal walk row) · `REFLECTION.md` "Sep 10 (iNPC)" row · this handoff status → met
- [x] Headless: `run_inpc_walk.gd` 10/10 · `run_checks.gd` all iNPC checks pass (the 3 "AO keyboard / Counter signage" failures there pre-date this unit — `bank_interior.gd` / `run_checks.gd` geometry rows from a sibling's layout commit; untouched here) · `npm -w apps/web run typecheck` clean

**In-world walk (Browser pane, `?mock=account&debug=1`, fresh export):** F6 → lobby; right-click walk to the kiosk east of the couches → HUD *"[Space] Wake the service assistant"* → Space → dialogue *Service assistant · iNPC · explains, never acts* (Wake it / Ask why / Leave it) → `1` → bridge `→ openInpc {snapshot:{…}}` with the real `GameState.inpc_snapshot()` (bank name, tier, balance, limits, `pending_wires: []`, who-can-help; no address, hash, receipt or Live/Dev field) → shell panel in Wake view, password field focused, dialogue closed → Esc → `• inpc.closed {reason:"escape", awake:false}` → `document.activeElement` = `canvas`, prompt back on the HUD (floor unlocked).

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
