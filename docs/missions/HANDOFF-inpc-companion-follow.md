---
type: handoff
title: Handoff — iNPC companion follow (phone Follow / Unfollow)
audience: cold agent (Codex Luna preferred · Claude Code OK)
created: 2026-09-10
product: Branch-Zero
mission: When Blox-47 is awake, let the player toggle Follow / Unfollow from the phone HUD so the mesh walks with them (escort-lite seek; no navmesh bake; slide OK)
kickoff: docs/missions/KICKOFF-inpc-companion-follow.md
status: met
baseline: iNPC phone HUD MET · Gum Bot mesh MET · Talk path MET — docs/INPC.md
parallel_to: U7 packaging (gated) · do not absorb action tips / Ollama / walk-rig lab / snapshot whitelist
---

# Handoff — iNPC companion follow

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna** (Godot locomotion + shell phone chrome). Claude Code OK if Luna unavailable.

**Kickoff (paste):** [`KICKOFF-inpc-companion-follow.md`](./KICKOFF-inpc-companion-follow.md)

**Design index:** [`docs/INPC.md`](../INPC.md)

**Baseline (met):** 
[`HANDOFF-inpc-phone-hud.md`](./HANDOFF-inpc-phone-hud.md) · [`HANDOFF-inpc-phone-talk.md`](./HANDOFF-inpc-phone-talk.md) · [`HANDOFF-inpc-gum-bot-mesh.md`](./HANDOFF-inpc-gum-bot-mesh.md) · [`HANDOFF-inpc-openrouter.md`](./HANDOFF-inpc-openrouter.md)

**Not this mission:** Action-triggered tips from desk-debug / bridge · unsolicited OpenRouter · Ollama · teaching-pack / snapshot whitelist changes · baking `NavigationRegion3D` · re-exporting a skinned walk-rig Gum Bot (optional later lab) · converting iNPC into a staff `NPCS.md` row · U7 packaging · Ash rewrite · protocol Solidity · reopening OpenRouter / key locks.

---

## Principal intent

Unpark companion follow. Once Blox-47 is **awake**, the player should be able to ask it to **walk with them** from the existing **phone radio** (not only from lobby Space dialogue).

1. Phone shows **Follow** / **Unfollow** (Stay) while awake.
2. While following, the Gum Bot mesh trails the player through the bank.
3. Phone alone still must **not** lock the floor (`overlay_open` / `inpc_open` unchanged by Follow).
4. Sleep clears follow and returns the bot to its lobby home.
5. Explain-only species unchanged — follow is spatial chrome, not agency.

This is **Phase 1 locomotion**. Walk-cycle animation and a baked navmesh are **out** unless free; a slide/seek is acceptable for v1 (shipped glb has no armature).

---

## Design lock (non-negotiable)

| Lock | Implication |
|------|-------------|
| **Phone is the primary toggle** | Follow / Unfollow live on `InpcPhone.tsx` beside Talk / Sleep. Dialogue Follow is optional stretch only — do not make Space-at-lobby the only path. |
| **Awake only** | Follow available iff session key / `inpc_awake`. Dormant → never follow. |
| **Not an overlay lock** | Follow / Unfollow must **not** set `inpc_open` or `GameState.overlay_open`. WASD / desks stay free (same contract as phone Talk≠lock). |
| **Escort-lite, not NavigationAgent bake** | There is **no** `NavigationRegion3D` in the live tree today. Teller escort in `npc.gd` is waypoint seek on `CharacterBody3D`. Reuse that **idea** (seek, collide, ignore player, stuck timeout). Do **not** bake a navmesh for this mission. |
| **Do not become staff** | Do not fold iNPC into `npc.gd` / staff dialogue graphs / `NPCS.md`. Keep the separate species (`InpcProp` / `inpc` group). |
| **Slide OK** | Shipped `gum_bot_bank.glb` is rest-pose, rig stripped (ENG-2026-0021). No walk clip required. Optional later lab for skinned walk. |
| **Unfollow = Stay** | Stop where it is. Do not force an immediate home walk on Unfollow. |
| **Sleep = Unfollow + home** | Sleep (phone or panel) clears follow, restores dormant look, returns mesh to `INPC_SPOT` / home yaw (snap or short return — pick one; snap is fine). |
| **No new agency** | Still cannot pay / wire / release / approve / provision. |
| **Do not regress** | Phone Talk (`inpc.open` → fresh snapshot), Sleep wipe, Esc / `focusCanvas`, `run_inpc_walk`, viz budget, snapshot whitelist. |

---

## What already exists (reuse)

| Piece | Where |
|-------|--------|
| Phone radio | `apps/web/src/overlay/InpcPhone.tsx` — Talk / Sleep; awake-only; no lock |
| Shell events pattern | `inpc.open` / `inpc.freshen` / `inpc.closed` via `branchZero.ts` + `GameState` |
| Prop + mesh | `apps/game/scripts/inpc.gd` (`InpcProp extends BankTerminal`) + `assets/models/inpc/gum_bot_bank.glb` |
| Home spot | `main.gd` — `(3.5, 0, 4.5)`, yaw `π` beside Ash |
| Escort seek reference | `apps/game/scripts/npc.gd` — `_escort` / collision exceptions / stuck limits (**do not copy staff state machine wholesale**) |
| Player body | `apps/game/scripts/player.gd` — `CharacterBody3D`, group `player` |
| Headless walk | `apps/game/tests/run_inpc_walk.gd` |

**Docs myth to ignore:** `WORLD-3D-ENVIRONMENT.md` / `NPCS.md` mention `NavigationRegion3D` / `NavigationAgent3D`. They are **not** in the product tree. Escort proves seek-without-navmesh is the house pattern.

---

## What to build

### 1. Phone chrome (shell)

- Add **Follow** / **Unfollow** (label may flip on one button, or two clear buttons).
- Reflect Godot/follow bit in UI (header e.g. `awake · following` vs `awake · radio`).
- Ordinary button clicks (same lesson as Talk — do not `preventDefault` the activation path).
- Keep Talk / Sleep behaviour unchanged.

### 2. Bridge

- Shell → Godot events (mirror `inpc.open` shape), e.g. `inpc.follow` / `inpc.unfollow`, **or** one event with `{ following: bool }`.
- Optional: expose following on `inpcStatus` (or a tiny dedicated call) so phone remount / tab refresh stays honest while awake.
- Godot → shell only if needed for UI sync; prefer a GameState bit pushed through existing status/changed paths.
- **Never** set `inpc_open` from Follow.

### 3. Godot locomotion

Promote the prop so it can move:

- Today: `InpcProp` + `StaticBody3D` box — cannot walk.
- Target: moving body (`CharacterBody3D` on collision layer 1) that still owns interact zone, plaque, screen swap, and `can_talk` / `interact`.
- Freedom on refactor shape (promote root, or mover child) — keep one interactable the player recognises as Blox-47.

States (names free):

| State | Behaviour |
|-------|-----------|
| Home / idle | At lobby spot when not following (and after Sleep) |
| Following | Seek a point ~1.5–2 m behind / beside the player; stop when close; resume when player pulls away |
| Staying | Unfollow — freeze in place (yaw may face player optionally) |

Behaviour details:

- Speed ≤ player walk; slightly under teller escort (`_ESCORT_SPEED` 3.2) is fine.
- Collision exception with player (and preferably other NPCs) while following — same class of bug as teller escort shoving props.
- Stuck timeout: if no progress for N seconds, pause follow or soft-reposition near the player — do not thrash forever into a desk.
- Gravity / floor: stay on the floor plane like staff capsules.
- Interact while following: Space Talk near the body still opens `dialogue/inpc.json`; phone Talk still uses `inpc.open`.

### 4. Lifecycle

| Event | Follow bit | Mesh |
|-------|------------|------|
| Follow (phone) | on | start seek |
| Unfollow (phone) | off | Stay in place |
| Sleep | off | home + dormant look + key wipe (existing) |
| Wake / key gone | off | never follow while dormant |

### 5. Docs / owed

- Tick OWED when met; set this handoff `status: met`.
- Update [`docs/INPC.md`](../INPC.md): companion follow as-built + lock value.
- One line on [`HANDOFF-CC.md`](./HANDOFF-CC.md) if you close the unit.

---

## Out of scope

- Baking `NavigationRegion3D` / shipping `NavigationAgent3D` as a required dependency 
- Skinned walk / idle AnimationPlayer (optional later GameLab ENG) 
- Action tips / unsolicited LLM from bridge traffic 
- Follow as a staff escort to the vault (that remains Eve’s job) 
- Putting OpenRouter / follow state on world plaques beyond existing awake/dormant copy 
- Changing `game-knowledge/` or snapshot fields 

---

## Verification checklist

- [x] Awake → phone **Follow** → mesh trails player across lobby toward vault / desks without locking WASD — browser `?mock=account` 2026-09-10: header `awake · following`, RMB walk-to and W both moved the player, Gum Bot trailed ~2 m behind to the vault door 
- [x] **Unfollow** → stops and stays put — header back to `awake · radio`; player walked on to Bob, bot stayed mid-lobby 
- [x] **Sleep** (phone or panel) → follow cleared, eye dormant, mesh back at lobby home — phone unmounted, `sessionStorage` key null; home snap + yaw π asserted headless (not eyeballed in the browser — the camera was at the vault) 
- [x] Follow alone does **not** set `overlay_open` / `inpc_open` — headless assertion + canvas kept focus and moved in the browser 
- [x] Phone **Talk** still opens full panel with fresh board (`inpc.open` contract intact) — panel opened on `reading your board: 500 USDC · no wires in the vault · test.branchzero.eth`; Esc returned focus to the canvas 
- [x] Space interact near following body still works (or honest “too far” — no crash) — `[Space] Talk to Blox-47` prompt followed the body across the lobby (zone travels with the root) 
- [x] Stuck handling does not pin the player or shove furniture — exceptions both ways with the player, one-way with staff; stuck → 2 s pause → soft reposition only when the player is > 7 m away; not provoked in the smoke 
- [x] `run_inpc_walk` extended/green (follow bit + Sleep clears follow + no lock from Follow) — 18/18 PASS 
- [x] OWED + INPC as-built updated; handoff status → met 

---

## Outcome

**Met · Claude Code Fable (Codex Luna named, not available in this session) · 2026-09-10.** Commit: see `git log` for "iNPC companion follow" (product repo only; no GameLab ENG, no Solidity).

- **Bridge / shell:** `inpc/session.ts` owns the bit (`isFollowing` / `setFollowing`, memory only, awake-gated, cleared by `wipe`). `branchZero.ts` `requestInpcFollow(following)` emits shell→Godot `inpc.follow {following}` (fire-and-forget like `inpc.closed`; `INPC_UNAVAILABLE` with no Godot); `inpcStatus` now answers `{awake, following}`. `InpcPhone.tsx`: one Follow / Unfollow toggle (ordinary click, `aria-pressed`, `focusCanvas()` after), header `awake · following` ↔ `awake · radio`; Talk / Sleep untouched.
- **Godot:** `GameState.inpc_following` + `_on_inpc_follow` (awake-gated; never touches `inpc_open` / `ui_locked`); cleared by `sleep_inpc` and by `inpc.closed {awake:false}`; in `facts()`, **not** in the snapshot. `inpc.gd`: root stays `Node3D` / `BankTerminal` (main.gd ranking untouched); the `StaticBody3D` box became a `CharacterBody3D` child (`InpcBody`, cylinder r 0.58 × 1.40, layer 1 / mask 1) that slides and is folded back into the root each tick (`_absorb_motion`). States HOME / FOLLOWING / STAYING.
- **Seek vs home:** escort-lite seek copied in spirit from `npc.gd` `_escort` — speed 2.8, rest point 1.8 m short of the player on the bot's side, hysteresis 2.0 / 2.8 m, faces heading while walking and the player while resting; collision exceptions both ways with the player and one-way with staff, player `SpringArm3D` excludes the mover (a trailing companion would otherwise pop the camera). Stuck < 0.3 m/s for 1.5 s → 2 s pause → soft reposition to the rest point if the player is > 7 m away. **Sleep = snap home** (`INPC_SPOT`, yaw π) — a snap, not a walk, because the eye is out. No `NavigationRegion3D`, no navmesh, no staff merge.
- **Slide accepted** for v1: the glb is rig-stripped; the body slides with no walk clip. Principal call still open: accept, or open a GameLab walk-rig ENG.
- **Checks:** `run_inpc_walk` 18/18 PASS (7 new; the prop is loaded by path — a `-s` test compiles before autoload globals exist, so a `class_name` reference to a script that names `GameState` fails). `apps/web` typecheck clean. `run_checks` `_check_inpc` ✓ (the run's four other failures — inpc.json "timelock" term, three AO-desk pins — pre-date this unit). `run_viz_budget`: materials 41 ≤ 42 unchanged; its two failures (missing `Walker_jacket.glb` / `Johnny_jacket.glb`, zero head heights, `dialogue_box.gd` parse error) belong to the parallel cast-rename session's WIP, not this unit.
- **Browser smoke** (`?mock=account`, exported 20:37 with Godot 4.5.2 → `apps/web/public/game/index.pck` 7,028 KB): Wake stand-in (session key planted) → Enter → Follow → walk (W + RMB) → bot trails to the vault → Unfollow → walk on, bot stays → Talk (panel, fresh board) → Esc → Sleep (phone gone, key null). Home snap eyeballed only headless.
- **Not done / owed:** dialogue Follow verb (optional stretch, skipped on purpose — `inpc.json` verbs unchanged); a walk-cycle rig; blink / poweron polish. Principal: hard-refresh `:5173`, Wake with a real key, Follow from the phone, walk to Bob and back.
