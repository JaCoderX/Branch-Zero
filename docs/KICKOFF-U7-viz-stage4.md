# Kickoff prompt — U7 viz Stage 4 (wall shell)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck
on static-merge regressions or Compatibility draw-call spikes after one honest attempt.

**What this is:** Stage 4 of the staged art climb — **architecture shell** so walls, ceilings, and repeated fill
stop reading as raw CSG boxes. Stages 1–3 are **met** (bank dress, hero polish, Blocky characters). This is **not**
Stage 5 / full U7 (HUD, particles, fonts, video), **not** U5 ENS.

**Ladder:**

| Stage | Goal | Status |
|-------|------|--------|
| 1 | Legible bank | **met** |
| 2 | Hero polish | **met** |
| 3 | Characters (Kenney Blocky + atlas) | **met** |
| **4** | **Shell architecture — walls / MultiMesh fill** | **this kickoff** |
| 5 | Feel / video | full U7 |

**Baseline after Stage 3** ([`progress/2026-09-07-u7-viz-stage3.md`](./progress/2026-09-07-u7-viz-stage3.md)):
worst ~242 draws / 126k prims / 34 mats / `.pck` ~1.21 MB. Prefer leaving ≥80 draw-call headroom for Stage 5 juice.

**Lessons (do not relearn):** parent free frees children; ≤8 omnis on merged mesh; animated nodes cost surfaces×passes;
one asset class per stage; README index rows; pack-page badge ≠ licence; atlas many skins → one material;
centred spring arm + wider body hides nearby NPCs (camera polish = Stage 5, not this unit).

**Timing / ports:** schedule clear of U5 Name Desk / bridge edits; Godot + MockChain day-to-day;
`:5174?mock=account` only; leave `:5173` / `:8787`; never `dev:teller`.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — U7 viz Stage 4 ONLY (wall / ceiling shell + MultiMesh repeated fill).
Freedom on HOW. No freedom on constraints.
This is NOT Stage 5 feel/video, NOT character re-skin, NOT hero re-cut, NOT U5 ENS, NOT U6 Arc.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-U7-viz-stage4.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u7-viz-stage3.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1–2 footprints, §5–6)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md
8. Craft lessons:
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/upgrade-one-asset-class-under-hard-gates.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/freeing-a-parent-frees-children.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/cap-dynamic-lights-on-merged-meshes.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/animated-nodes-cost-surfaces-times-passes.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/pack-page-badge-is-not-the-licence.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/atlas-skins-to-one-material.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/parallel-agents-drop-shared-index-rows.md

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility. No SDFGI/SSR/volumetric fog/lightmaps.
- Do NOT change zone footprints, navigation volumes, collider layer/mask rules, door gaps, escort waypoints,
  NPC homes, or teleport points. Assert with run_viz_budget (extend if needed).
- Scope = architecture shell: wall/wainscot/ceiling modules that replace obvious BoxMesh CSG in place; optional
  MultiMesh for repeated plants/benches/rope posts already in the kit. Keep WingTheme palette.
- Do NOT rebuild heroes (Stage 2), characters/atlas (Stage 3), HUD, particles, fonts, or camera spring arm
  (Stage 5). Do NOT touch dialogue, bridge, MockChain, teller-desk, ens*, Name Desk interactables.
- Static shell joins bake_static. Guard frees with is_instance_valid. Keep NamesBoardQuad / ledger quads /
  VaultDoor / characters out of the batch (no_batch / animated).
- Materials ≤ 40 (Stage 3 left 34 — prefer shared wall mats, not a new atlas per zone). Prefer vertex colour /
  existing theme over new textures; if one wall atlas ≤ 1024², Basis Universal OK.
- Lights: still 1 shadowed directional; still ≤ 8 omnis on the merged interior — do not add a ninth.
- Perf gates (fail → cut): draw calls ≤ 350 (prefer worst ≤ 300 to leave Stage 5 juice); tris prefer ≤ 150k
  (cap 400k); .pck well under 15 MB. Measure before/after with run_viz_budget + viz_shots.
- Licence: CC0 / ours only for any new kit pieces. Read the real licence page, not the pack badge
  (Stage 3 Quaternius lesson). Update CREDITS with URL + sha256.
- Ports: :5174 ?mock=account only. Never :5173 / :8787 / dev:teller.
- Progress note + docs/progress/README.md index row in the SAME commit. Do NOT advance HANDOFF past U5.

OWN: bank_interior.gd wall/ceiling build paths, optional wall modules under assets/models/, MultiMesh helpers in
props.gd, CREDITS, progress note + README index.

AVOID: npc.gd / player.gd / character_atlas (done), hero_props.py, hud.gd, dialogue, ens*, teller, web bridge.

SEQUENCE:
0. Record Stage 3 baselines; run_checks + mock_walk + run_viz_budget green. Note U5 may have uncommitted Name Desk
   files — do not stage them; only commit Stage 4 paths.
1. Identify the highest-visibility CSG walls (lobby long walls, vault antechamber, counter backs) — replace in place.
2. Ceiling / skylight trim only if it stays inside budget; keep glass no-shadow behaviour.
3. MultiMesh plants/benches if instance count justifies it; keep layer 1 / mask 0 colliders.
4. bake_static; measure. If over gate → fewer wall mats / simpler modules / skip MultiMesh — not more lights.
5. :5174 ?mock=account; F6/E/F4 focus drill; vault states still legible from lobby.
6. Progress note + captures (lobby, counter, vault) + README index row. Stop — no Stage 5.

DoD (Stage 4):
- Lobby / counter / vault antechamber walls no longer read as raw single-colour boxes in a 30 s walk.
- Footprints, zones, waypoints, freeze checks PASS; vault LED/clock still legible from lobby.
- All perf gates green with numbers recorded before/after; prefer worst draws ≤ 300.
- CREDITS current; progress note + README index row committed together.
- Name Desk / characters / heroes untouched; HANDOFF not advanced past U5.

OUT OF SCOPE: HUD/camera/particles/fonts/video (Stage 5), character re-author, Quaternius without principal licence
OK, ninth omni, footprint redesign, ENS/Arc.

Stop when Stage 4 DoD is met or a named budget blocker needs a principal cut.
```

## Conflict map

| Area | Stage 4 agent | U5 agent |
|------|---------------|----------|
| Walls / ceilings / MultiMesh fill | Yes | No |
| Characters / heroes | No | No |
| Name Desk form / ens* / teller / bridge | No | Yes |
| `:5174` mock preview | Yes | No |

## After this pass

Next art unit: **Stage 5** — [`docs/KICKOFF-U7-viz-stage5.md`](./KICKOFF-U7-viz-stage5.md) (HUD / camera / particles /
fonts / demo). Product mission stays **U6 Arc** until HANDOFF says otherwise.
