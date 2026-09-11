---
type: handoff
title: Handoff — iNPC phone HUD (awake companion screen)
audience: cold agent (Codex Luna)
created: 2026-09-10
product: Branch-Zero
mission: When the service assistant is awake, show a compact phone-like HUD for its messages — walkable, no floor lock; open full chat / Sleep from it
kickoff: docs/missions/KICKOFF-inpc-phone-hud.md
status: met
baseline: iNPC OpenRouter MET 2026-09-10 (docs/missions/HANDOFF-inpc-openrouter.md · docs/INPC.md)
parallel_to: U7 packaging (gated) · shell splash · do not absorb companion follow / action tips / Ollama
---

# Handoff — iNPC phone HUD

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna**.

**Kickoff (paste):** [`KICKOFF-inpc-phone-hud.md`](./KICKOFF-inpc-phone-hud.md)

**Baseline (met):** [`HANDOFF-inpc-openrouter.md`](./HANDOFF-inpc-openrouter.md) · [`docs/INPC.md`](../INPC.md) — Wake (session OpenRouter key) → full-panel chat → Sleep; player-safe snapshot; `game-knowledge/` pack.

**Not this mission:** Companion follow / Stay / NavigationAgent · action-triggered tips from desk-debug or bridge traffic · unsolicited OpenRouter calls · Ollama · changing teaching pack / snapshot whitelist · new Godot mesh / KayKit pedestal · U7 packaging · shell splash · Ash rewrite · protocol Solidity.

---

## Principal intent

Once the robot is **awake** (player has a session OpenRouter key), the player should keep walking the bank and still see the assistant’s messages on a **phone-like HUD** — not only inside the modal chat panel.

1. Phone appears only while awake.
2. Shows the same transcript the chat panel uses (session transcript).
3. Player can open the full Talk panel or Sleep from the phone.
4. Walking stays free: the phone must **not** set `GameState.overlay_open()` / lock the floor / steal canvas focus for typing unless the player opens the full chat.

This is **P0 radio** only. Physical follow and action commentary are later missions (still parked).

---

## Design lock (non-negotiable)

| Lock | Implication |
|------|-------------|
| **Awake only** | Visible iff session key present (`hasKey()` / `GameState.inpc_awake`). Sleep or wipe → phone gone + transcript cleared (existing wipe). |
| **Not an overlay lock** | Phone is ambient chrome. Do **not** set `inpc_open` / `overlay_open` while only the phone is up. WASD / Space / desks keep working. |
| **Same transcript** | Reuse `apps/web/src/inpc/session.ts` transcript (`getTranscript` / `subscribe`). Do not invent a second message store. |
| **Full chat still the typer** | Composing a question stays in existing `Inpc.tsx` Wake/Chat panel (password / input need focus + lock). Phone may deep-link “Talk” → `openInpc` / host open. |
| **Sleep clears everything** | Sleep from phone or panel: wipe key + transcript; eye dormant; phone unmounts. |
| **Bottom / corner band** | Prefer bottom-right (or opposite the ops-float meter). **Nothing persistent in the top third** (U7 Stage 5). |
| **Bank language** | “Service assistant” / “asleep · awake” — not “LLM” / “API” on the chrome. OpenRouter stays in the full panel Ask-why / Wake copy. |
| **No new agency** | Phone does not pay, wire, release, or follow. Explain-only species unchanged. |
| **Do not regress** | Esc order, `focusCanvas`, Terminal / BranchFloat / full Inpc panel locks, `run_inpc_walk`, snapshot whitelist. |

---

## What already exists (reuse)

| Piece | Where |
|-------|--------|
| Full Wake / Chat / Sleep panel | `apps/web/src/overlay/Inpc.tsx` |
| Session key + transcript | `apps/web/src/inpc/session.ts` |
| Host open/close / awake mirror | `App.tsx` `setInpcHost` · `pushInpcClosed` · `GameState.inpc_awake` |
| Bridge | `openInpc` · `sleepInpc` · `inpcStatus` · `inpc.closed` |
| HUD placement precedent | Ops float meter bottom-left (`hud.gd` / BranchFloat) — put the **phone** in the shell so it can show React transcript without Godot owning chat text |

**Preferred surface:** React in `apps/web` (shell), driven by `hasKey()` + transcript subscription. Godot already mirrors awake for the eye; no Godot HUD text required unless you need a tiny “assistant awake” cue — default is shell-only.

---

## What to build

### 1. Phone chrome (shell)

- New small component (e.g. `InpcPhone.tsx`) mounted from `App.tsx` when awake **and** the full Inpc modal is **not** covering (or collapsed behind the modal — pick one; prefer hide phone while full panel open to avoid double transcript).
- Compact “handset” / message card: last 1–3 assistant (and optional user) lines, or expand-in-place scroll of the transcript.
- Affordance: **Talk** (opens existing full panel via host / `openInpc` path) · **Sleep** (existing wipe + `sleepInpc` / close awake:false).
- Optional mute for future tips — **out of scope** unless free; do not build action tips here.
- Styles: match Branch Zero shell (graphite / brass hints OK); keep it small — not a second full modal.

### 2. Lifecycle wiring

| Event | Phone |
|-------|--------|
| Wake succeeds (`hasKey` true) | Show |
| Full panel open | Hide or dim (recommend hide) |
| Full panel close with `awake: true` | Show again with transcript |
| Sleep / wipe / Esc sleep | Hide; empty transcript |
| Tab reload with key still in `sessionStorage` | Show if `hasKey()` (refresh `inpcStatus` already mirrors eye) |

### 3. Docs / owed

- Tick OWED when met; set this handoff `status: met`.
- One line on [`docs/INPC.md`](../INPC.md): phone HUD as-built.
- Note: companion follow / action tips remain parked — do not start them.

---

## Out of scope

- Follow me / Stay / moving companion mesh  
- Scrubbed bridge events → unsolicited LLM or template tips  
- Changing `game-knowledge/` or snapshot fields  
- Putting the transcript into Godot `Label3D` / HUD canvas (shell owns messages)  
- Top-third persistent chrome  
- Product `.env` / `VITE_*` OpenRouter keys  

---

## Verification checklist

- [x] After Wake, close the full panel (Esc) with key kept → phone visible; player can walk  
- [x] Phone shows the same transcript as the chat panel  
- [x] Talk from phone re-opens full Inpc panel; typing works; overlay lock only then  
- [x] Sleep from phone wipes key + transcript; phone gone; eye dormant (`inpc.closed` awake:false)  
- [x] Phone hidden while full panel open (or equivalent non-double-UI)  
- [x] No floor lock / no `overlay_open` from phone alone  
- [x] Nothing in top third; does not cover ops-float meter awkwardly  
- [x] `?mock=account` path works (shell methods already route)  
- [x] OWED + INPC as-built updated; handoff status → met  

> **Talk regression fix (2026-09-10):** phone Talk no longer calls `openInpc` with a cached shell snapshot (that skipped `GameState.inpc_open` and could reopen an empty board while desk-debug showed a ready account). Talk emits `inpc.open` → Godot `open_inpc` with a refreshed `inpc_snapshot()`. See `docs/INPC.md` § Live mirror sync.

> Browser smoke intentionally stopped before clicking the phone's Sleep action at the player's request, so the test tab remains awake. The no-modal Sleep path is implemented in `branchZero.ts`: it wipes the session and emits `inpc.closed {awake:false}` so Godot's mirror can go dormant.

**STOP AND ASK if:** you believe the phone must lock typing on itself; you need Godot CanvasLayer text; follow or action tips feel required to “finish” this unit.

---

## Agent choice

**Codex Luna** — shell HUD chrome on a met iNPC surface. Not a protocol / GameLab spike.
