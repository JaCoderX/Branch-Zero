---
type: handoff
title: Handoff — Shy FX unicorn (Uniswap folklore ambient)
audience: cold agent (Codex Luna preferred · Claude Code OK)
created: 2026-09-11
product: Branch-Zero
mission: Land a shy pink Minecraft-style unicorn near the FX desk that peeks from curated hide sockets after locomotion idle and dissolves on activity — ambient folklore only
kickoff: docs/missions/KICKOFF-shy-fx-unicorn.md
status: met
met: 2026-09-11 (Claude Code; Codex Luna unavailable) — scripts/fx_unicorn.gd · tests/run_unicorn_peek.gd 34/34 · run_viz_budget 43/45 · run_fx_walk green · principal feel-check owed
lab: GameLab ENG-2026-0023 (mesh + pink remap + preview clip; behaviour design locked — Godot peek proof optional)
parallel_to: U7 packaging · iNPC walk-feel · do not absorb FX lane / Johnny dialogue / companion follow
---

# Handoff — Shy FX unicorn

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna** (Godot ambient prop + idle timer). Claude Code OK if Luna unavailable.

**Kickoff (paste):** [`KICKOFF-shy-fx-unicorn.md`](./KICKOFF-shy-fx-unicorn.md)

**Design context:** [`docs/GAME-DESIGN.md`](../GAME-DESIGN.md) pillars · [`docs/UNISWAP.md`](../UNISWAP.md) (FX desk exists; do not change swap path) · [`docs/WORLD-3D-ENVIRONMENT.md`](../WORLD-3D-ENVIRONMENT.md) §6 budget · [`CREDITS.md`](../../CREDITS.md)

**Lab (read / copy ship set only — do not merge the ENG tree):**  
[`../../../GameLab/work/ENG-2026-0023-shy-fx-unicorn/`](../../../GameLab/work/ENG-2026-0023-shy-fx-unicorn/) ·  
[`IDEA.md`](../../../GameLab/work/ENG-2026-0023-shy-fx-unicorn/IDEA.md) ·  
[`handoff.md`](../../../GameLab/work/ENG-2026-0023-shy-fx-unicorn/handoff.md) ·  
[`source/PROVENANCE.md`](../../../GameLab/work/ENG-2026-0023-shy-fx-unicorn/source/PROVENANCE.md) ·  
preview: `captures/unicorn_pink_preview.mp4`

**Not this mission:** FX swap / quote / Johnny dialogue graphs · Uniswap oracle implication · iNPC Follow / phone · staff `NPCS.md` row · talk / Ask-why · navmesh / freeform LOS stealth AI · U7 packaging · protocol Solidity · reopening FX bidirectional.

---

## Principal intent

Uniswap’s logo is a pink unicorn — myth creatures that like to stay unseen. Branch Zero’s FX desk is the Uniswap surface. Land a **shy pink voxel unicorn** that:

1. Lives near **Johnny’s FX desk** (not lobby-wide roaming).
2. Is normally **near-transparent** (soft silhouette / rim — never “missing mesh”).
3. **Hides** at curated sockets behind FX furniture / pillars (socket-based, not realtime LOS AI).
4. After **≥ ~3 s locomotion idle** (no WASD / no interact; look/orbit OK), **peeks** (fade in) briefly.
5. Longer idle → **closer** socket + **longer** dwell (hard caps).
6. On activity → **dissolve** back to a far socket.
7. Never blocks paths, never talks, never required for FX, never Follow/phone, never a second companion.

Tone: ambient easter-egg folklore (same layer as entrance lintel delight), not a teaching NPC.

---

## Design lock (non-negotiable)

| Lock | Implication |
|------|-------------|
| **Ambient only** | No dialogue, no interact prompt, no `NPCS.md` row, no bridge events required for v1 |
| **Not a companion** | Distinct from Blox-47 Follow — no phone toggle, no seek-to-player trail |
| **Not an FX gate** | Johnny / swap / quote / whitelist untouched; unicorn never enables or blocks FX |
| **Socket hide, not stealth AI** | 3–4 `Marker3D` (or equivalent) hide sockets near FX; pick by idle tier — **do not** bake NavigationRegion or continuous camera occlusion queries |
| **Idle = locomotion / interact** | Camera look and spring-arm orbit **do not** reset idle. WASD / jump / desk Space interact / dialogue open **do** |
| **Soft alpha** | Hidden state keeps a faint pink silhouette or very low alpha (≥ ~0.05–0.15 readable rim); full alpha=0 is forbidden |
| **Closeness cap** | Never enter player personal space (~2 m) or dialogue counter-cam framing; closest socket still behind FX furniture |
| **Dwell cap** | Peek dwell scales with idle but caps (suggested: ~1.5 s at first peek → ~8–12 s max) |
| **Budget** | Prefer **+1 unique material** (document ceiling bump like Gum Bot if `run_viz_budget` needs it). Mesh should stay tiny (Minecraft unicorn) |
| **Licence** | **CC-BY 4.0** — **CREDITS.md row required** (Amazing Inc.) |
| **Honest theatre** | Optional Johnny shrug line is **out of v1** unless free; never claim the unicorn is an on-chain oracle |

---

## Lab ship set (copy — do not merge ENG)

| Lab path (ENG-2026-0023) | Product target |
|--------------------------|----------------|
| `source/UnicornGlasses.fbx` (sha256 `ff4dd0b79d5e26783dcfafe83afcabf6c48cc9eab1d4a17d04b1066ce4bea2bf`) | Convert with pink sheet → `apps/game/assets/models/fx_unicorn/unicorn_pink.glb` |
| `out/unicorn_pink_sheet.png` (sha256 `468d6080e1bc0142fdda29fbf275fef3636a51c8ab7864329eef3d89e890d8a0`) | Embedded in the glb **or** sibling `unicorn_pink_sheet.png` if import needs it |
| Write `LICENSE-fx-unicorn.txt` | CC-BY 4.0 notice + Amazing Inc. + itch URL |

**Do not** copy: stock rainbow sheet as the live albedo (keep pink), preview mp4/frames, Blender render scripts, board PNGs.

**Convert note:** Pack has **no** AnimationStack / skin. Static mesh is correct. Optional tiny authored bob (lab preview style) is nice-to-have only — fade peek is the required motion. Use **Closest** texture filter so Minecraft blocks stay crisp.

Verify hashes after copy. Add **CREDITS.md** row (CC-BY · Amazing Inc. · pink remap derivative).

---

## What already exists (reuse)

| Piece | Where |
|-------|--------|
| FX desk placement | `WORLD-3D-ENVIRONMENT.md` east column; Johnny / FX pulled west (`FX_WEST_DELTA` / desk spacing handoff) |
| Player locomotion | `apps/game/scripts/player.gd` — detect velocity / input for idle |
| Overlay / dialogue open | `GameState.overlay_open` / desk interact — treat as activity |
| Viz budget gate | `apps/game/tests/run_viz_budget.gd` |
| Ambient easter-egg precedent | South entrance lintel (WORLD-3D) — folklore layer, not systems |
| iNPC (do **not** copy behaviour) | `inpc.gd` — unicorn must stay a separate ambient species |

---

## What to build

### 1. Assets

- Product folder `apps/game/assets/models/fx_unicorn/` with pink glb (+ licence).
- Godot import: LODs OK; keep Closest filtering on albedo.

### 2. Ambient controller (Godot)

One small script / autoload-free node under the Main wing (e.g. spawned from `main.gd` or FX props):

| State | Behaviour |
|-------|-----------|
| `HIDDEN` | At far socket; low alpha / soft rim |
| `PEEKING` | Fade toward readable alpha; dwell timer |
| `RELOCATING` | Instant or short dissolve → next closer socket (only while still idle) |

Idle tiers (suggested defaults — tune to feel):

| Idle time | Socket tier | Peek dwell |
|-----------|-------------|------------|
| < 3 s | stay hidden | — |
| ≥ 3 s | far / mid socket | ~1.5–3 s then dissolve unless idle continues |
| ≥ 8–12 s | closer socket | longer dwell |
| ≥ 20–30 s | closest allowed socket | max dwell (~8–12 s), then soft hide+repeek or hold capped |

On activity → cancel peek, fade/snap to far socket, reset idle clock.

**Collision:** mesh should **not** push the player (layer off / no collider, or tiny non-blocking). Shadows off is fine.

### 3. Seeded discovery (one beat)

So a demo walk can notice it once without requiring a long AFK:

- After **first successful FX quote or swap** in the session, **or** first time the player stands idle ≥3 s inside the FX bay — force one soft peek at a mid socket.
- Freedom on which seed; pick one and document it. Do not spam.

### 4. Docs

- Short note in `WORLD-3D-ENVIRONMENT.md` (FX folklore prop) and/or `UNISWAP.md` (ambient only — not part of S1 path).
- `CREDITS.md` CC-BY row.
- Tick OWED §5 row; local `docs/progress/` note (gitignored) if useful.
- Optional one-line REFLECTION.

### 5. Verify

- Headless or windowed smoke: idle ≥3 s near FX → peek; move → hide; longer idle → closer socket.
- `run_viz_budget` green (document +1 mat ceiling if needed).
- `run_checks` / FX walks still green — unicorn must not touch desk APIs.
- `npm run export:web` when Godot host available; browser glance that pink mesh peeks without tanking fps.

---

## Suggested sockets (tune in-scene)

Place relative to current FX assembly (see WORLD-3D east-column pins; Johnny ~x 13.65 after spacing):

1. **Far** — behind east FX shelf / wall signage, mostly occluded from lobby approach.
2. **Mid** — beside FX counter end / vault partition edge facing FX bay.
3. **Near** — still behind desk furniture from typical player stand point; **never** on the customer pad in front of Johnny.

Exact transforms are free; the rule is “reads as hiding behind bank stuff.”

---

## DoD / Verification checklist

- [x] Pink unicorn glb in `apps/game/assets/models/fx_unicorn/` + `LICENSE-fx-unicorn.txt`
- [x] CREDITS.md CC-BY row (Amazing Inc. · itch URL · pink remap note)
- [x] Idle ≥3 s (locomotion/interact only) → peek; activity → hide
- [x] Longer idle → closer socket + longer dwell, with caps
- [x] Soft silhouette when “hidden”; never full invisible
- [x] No path block; no talk; no FX gate; no phone / Follow coupling
- [x] One seeded discovery beat documented — **chosen: first idle ≥ 3 s inside the `FX desk` zone → forced mid-socket peek, 3.5 s dwell** (not the FX quote path, so the swap lanes stay untouched)
- [x] `run_viz_budget` green (ceiling bump documented if any) — **mesh 42 → 43, with particles 44 → 45**, one textured alpha material (test header + WORLD-3D §6)
- [x] FX / Johnny / swap paths untouched (`killtests:s1` or `run_fx_walk` still green if you touch shared scenes)
- [x] OWED §5 tick; handoff status → `met` or `blocked` with reason
- [x] Local progress note under `docs/progress/` (gitignored)

---

## Cost and risk

| Risk | Mitigation |
|------|------------|
| Creepy “right behind you” | Cap closest socket; never dialogue cam |
| Competes with Blox-47 | No follow; FX bay only |
| Viz budget | +1 mat max; tiny mesh; shadow off |
| CC-BY forgotten | CREDITS row is DoD |
| Lab peek proof skipped | Behaviour locks above are the SoT — implement in product |

---

## Not included (park for later)

- Johnny dialogue acknowledgement
- Freeform LOS / navmesh hide
- Walk/gallop clips (pack has none)
- Phone controls / companion mode
- Arc-wing unicorn
- Making unicorn required for Uniswap sponsor video (nice if it appears, never gated)
