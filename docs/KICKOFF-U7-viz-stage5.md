# Kickoff prompt — U7 viz Stage 5 (feel / juice)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck
on web HUD layout or Compatibility particle / font regressions after one honest attempt.

**What this is:** Stage 5 of the staged art climb — **feel / juice** so the dressed bank reads on camera and in a
short demo: HUD that does not bury architecture, OTS camera that clears talk targets and shows the shell, light
particles, readable fonts, and a recorded walk. Stages 1–4 are **met**. This is **not** U6 Arc construction, **not**
a wall/character re-author, **not** Uniswap.

**Ladder:**

| Stage | Goal | Status |
|-------|------|--------|
| 1 | Legible bank | **met** |
| 2 | Hero polish | **met** |
| 3 | Characters (Kenney Blocky + atlas) | **met** |
| 4 | Shell architecture | **met** |
| **5** | **Feel — HUD, camera, particles, fonts, demo clip** | **this kickoff** |

**Baseline after Stage 4** ([`progress/2026-09-07-u7-viz-stage4.md`](./progress/2026-09-07-u7-viz-stage4.md)):
worst draws **242** on Stage 3 views / **284** on vault-west; prims worst **143k**; **34** mats; **8** omnis;
`.pck` ~1.22 MB. Hard gates still ≤ 350 draws / prefer ≤ 150k tris / ≤ 40 mats / `.pck` ≪ 15 MB. Stage 5 may spend
some of the remaining draw headroom (to 350) on particles / labels — do not blow it.

**Carry-ins from Stage 4 (fix these):**
- HUD passbook + zone chip cover the frieze / ledger from the lobby camera spot.
- Fixed −22° spring-arm pitch hides most of the coffered ceiling.
- Centred spring arm + Blocky body can hide nearby NPCs (Stage 3 lesson).
- New shot cams need ≥ ~4.6 m clear floor behind the player (spring-arm clearance).

**Lessons (do not relearn):** one asset class per stage; bake > MultiMesh for static fill; path-scoped `git add`;
parent free frees children; ≤8 omnis; animated cost = surfaces×passes; pack badge ≠ licence; atlas skins → one
material; centred spring arm hides NPCs; spring-arm clearance for shots; README index rows.

**Timing / ports:** schedule clear of U6 Arc / elevator / role edits; Godot + MockChain day-to-day;
`:5174?mock=account` only; leave `:5173` / `:8787`; never `dev:teller`.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — U7 viz Stage 5 ONLY (HUD layout, camera OTS, light particles, fonts, demo walk captures).
Freedom on HOW. No freedom on constraints.
This is NOT U6 Arc, NOT wall/character/hero re-author, NOT Uniswap, NOT a second Name Desk pass.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-U7-viz-stage5.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u7-viz-stage4.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§5–6 + Day-8 feel notes)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md
8. Craft lessons:
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/upgrade-one-asset-class-under-hard-gates.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/bake-beats-multimesh-for-static-fill.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/centred-spring-arm-hides-nearby-npcs.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/spring-arm-clearance-for-shot-cameras.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/path-scoped-stage-owned-files.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/anchors-and-offsets-for-code-built-ui-roots.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/parallel-agents-drop-shared-index-rows.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/cap-dynamic-lights-on-merged-meshes.md

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility. No SDFGI/SSR/volumetric fog/lightmaps.
- Do NOT change zone footprints, navigation, collider layer/mask rules, door gaps, escort waypoints, NPC homes,
  teleports, wall shell modules, character atlas, or hero props. Assert with run_checks / run_viz_budget.
- Scope = feel juice only:
  (1) HUD — passbook / zone chip / prompts must not bury ledger, vault repeater, or frieze from lobby default cam.
  (2) Camera — OTS lateral offset (and modest pitch if needed) so talk targets stay visible beside Blocky bodies and
      coffers read in wide lobby shots; keep spring-arm collision; do not break F6/F4 focus drill.
  (3) Particles — few Compatibility-safe systems (e.g. skylight dust, stamp ink puff). Count toward draw budget.
  (4) Fonts — OFL / already-approved faces only; update CREDITS. Prefer one UI face + one plaque face max.
  (5) Demo — ≥30 s MockChain walk on :5174 with captures (lobby → Mo → Counter → vault door read); optional short
      screen recording path documented. Full ETHOnline submission packaging is principal-owned if still open.
- Do NOT touch dialogue content, bridge, MockChain semantics, teller-desk, ens*, Name Desk forms, Arc elevator logic.
- Lights: still 1 shadowed directional; still ≤ 8 omnis on the merged interior — no ninth.
- Perf gates (fail → cut juice, not architecture): draws ≤ 350; tris prefer ≤ 150k (cap 400k); mats ≤ 40; .pck ≪ 15 MB.
  Measure before/after with run_viz_budget + viz_shots. Prefer worst draws stay ≤ 320 after juice.
- Licence: OFL fonts / CC0 particle textures only; read the real licence page. CREDITS + sha256.
- Ports: :5174 ?mock=account only. Never :5173 / :8787 / dev:teller.
- Path-scoped commits: git add only OWN paths. Sibling U6 / product dirt stays unstaged.
- Progress note + docs/progress/README.md index row in the SAME commit. Do NOT advance construction HANDOFF past U6
  from this art pass (pointers to Stage 5→done / next ship steps are OK if the principal already opened U7 ship).

OWN: hud.gd, player.gd (camera arm only), optional particle helpers, font assets under assets/fonts/, CREDITS,
tests/viz_shots.gd (camera presets only), progress note + README index + captures / demo clip notes.

AVOID: bank_interior.gd shell (done), character_atlas / npc meshes (done), hero_props, dialogue/*.json, ens*,
teller, web bridge, MockChain behaviour, Arc wing scripts.

SEQUENCE:
0. Record Stage 4 baselines; run_checks + mock_walk + run_viz_budget green. Stage only Stage 5 paths.
1. HUD layout pass — lobby default cam must show ledger strip + vault repeater without passbook burial.
2. Camera OTS — lateral offset; verify Mo/Dev/Ruth talk prompts; spring-arm clearance on new shots.
3. Particles — one or two systems; cut if draws spike.
4. Fonts — swap UI / plaque faces; keep legibility at web scale.
5. :5174 ?mock=account; hide debug → F6 → E → Esc → F4 focus drill; 30 s walk captures.
6. Progress note + README index row + CREDITS. Stop — no U6 Arc, no Uniswap.

DoD (Stage 5):
- Lobby default view: architecture shell + ledger/vault reads are not buried by HUD.
- Talk targets beside the player stay visible (OTS offset); coffers readable in at least one wide lobby shot.
- ≤2 particle systems on screen in the default lobby path; all perf gates green with before/after numbers.
- Fonts licensed and credited; prompts/labels readable on :5174.
- ≥30 s walk evidence (captures and/or short clip) on MockChain; freeze checks PASS.
- Shell / characters / heroes / Name Desk / bridge untouched; path-scoped commit; README row present.

OUT OF SCOPE: Arc wing (U6), Uniswap FX desk, music full pass, Mixamo, Quaternius without principal OK,
ninth omni, footprint redesign, rewriting Stage 1–4 art classes.

Stop when Stage 5 DoD is met or a named budget/licence blocker needs a principal cut.
```

## Conflict map

| Area | Stage 5 agent | U6 agent |
|------|---------------|----------|
| HUD / camera / particles / fonts / demo captures | Yes | No |
| Walls / characters / heroes | No | No |
| Arc elevator / manager role / wing scripts | No | Yes |
| `:5174` mock preview | Yes | No |

## After this pass

Art ladder complete for staged viz. Product mission stays **U6 Arc** until HANDOFF opens full U7 ship /
submission (G8–G10 packaging). Any remaining ship tasks (store page, final video edit) are principal-scheduled.
