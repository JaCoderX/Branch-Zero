# Kickoff prompt — U7 viz Stage 3 (character pass)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck
on retargeting / AnimationPlayer clip names or Compatibility draw-call regressions after one honest attempt.

**What this is:** Stage 3 of the staged art climb — **adult-ish CC0 character silhouettes** for the five NPCs +
player. Stage 1 (legible bank) and Stage 2 (hero polish) are **met**:
[`docs/progress/2026-09-07-u7-early-viz.md`](./progress/2026-09-07-u7-early-viz.md),
[`docs/progress/2026-09-07-u7-viz-stage2.md`](./progress/2026-09-07-u7-viz-stage2.md). This is **not** Stage 4
(wall shell), **not** full U7 ship, **not** U5 ENS.

**Ladder:**

| Stage | Goal | Status |
|-------|------|--------|
| 1 | Legible bank | **met** |
| 2 | Hero polish | **met** |
| **3** | **Character pass — adult-ish CC0 silhouettes** | **this kickoff** |
| 4 | Shell architecture | later |
| 5 | Feel / video | full U7 |

**Lessons already paid for (do not relearn):** parent-mesh free frees children (`is_instance_valid` in bake);
Compatibility ≤ 8 omnis on a merged mesh; animated nodes stay unbatched and cost surfaces × shadow passes;
upgrade one class under hard gates; keep `docs/progress/README.md` index rows when you land a note.

**Timing / ports:** same as Stage 2 — schedule clear of U5; Godot editor + MockChain day-to-day;
`:5174?mock=account` for web only; leave `:5173` / `:8787` alone; never `dev:teller`.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — U7 viz Stage 3 ONLY (CC0 character swap for five NPCs + player).
Freedom on HOW. No freedom on constraints.
This is NOT Stage 4 wall shell, NOT hero re-cut, NOT full U7 ship, NOT U5 ENS, NOT U6 Arc.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-U7-viz-stage3.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u7-viz-stage2.md   (budget headroom)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1 scale/silhouette, §5 Quaternius, §6)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (roles — do not rewrite lines)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§5b)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md
9. Craft lessons (do not re-author):
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/freeing-a-parent-frees-children.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/cap-dynamic-lights-on-merged-meshes.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/animated-nodes-cost-surfaces-times-passes.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/upgrade-one-asset-class-under-hard-gates.md

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility. No SDFGI/SSR/volumetric fog/lightmaps.
- Prefer Quaternius CC0 humanoids (WORLD-3D §5) or an equally licensed adult-ish low-poly kit with idle / walk /
  talk-or-interact / refuse clips. No Mixamo unless principal verifies licence. Keep Kenney Mini as fallback only
  if Quaternius cannot be fetched with a direct download — document the choice in CREDITS + progress note.
- Colliders stay the U3 capsules (CharacterBody3D). Escort / dialogue / run_action graphs unchanged.
- Map skins in npc.gd SKINS (+ player). Add an explicit `registrar` (Petra) entry so U5 does not inherit a surprise.
- Scale to ~1.75–1.8 m head height (WORLD-3D: bank proportions). Face -Z like existing PropKit.character.
- Clips: idle, walk (escort / player move), interact or talk (WORKING), refuse/emote-no (REFUSING). Loop idle/walk.
- Characters are animated → they are NOT part of bake_static. Budget for their surfaces × shadow passes explicitly.
- Do NOT rebuild heroes, Kenney furniture, walls, lighting recipe, or HUD. Do NOT touch Name Desk wiring beyond
  the Petra skin entry.
- Perf gates (fail → cut): draw calls ≤ 350; prefer ≤ 150k tris on screen (cap 400k); materials ≤ 40; 1 shadowed
  light; ≤ 8 omnis; .pck well under 15 MB. Baseline after Stage 2: worst ~188 draws / 130k prims / 34 mats /
  .pck ~1.25 MB — characters must fit in the remaining headroom.
- Textures ≤ 1024²; prefer one shared colormap/atlas + Basis Universal (except tiny palette maps if lossless is
  cheaper — document why).
- Ports: :5174 ?mock=account only. Never :5173 / :8787 / dev:teller.
- Update CREDITS.md with licence, URL, zip sha256. Add a progress note AND a row in docs/progress/README.md
  (prior agents dropped index rows — do not).
- Do NOT advance HANDOFF past U5.

OWN: apps/game/assets/characters/**, npc.gd SKINS / PropKit.character, player.gd skin, CREDITS, progress note + README index.

AVOID: hero_props.py / vault / counters (Stage 2 done), Kenney furniture swap, wall CSG, dialogue/errors, bridge,
teller-desk, apps/web ens*, hud.gd.

SEQUENCE:
0. Record Stage 2 baselines; run_checks + mock_walk + run_viz_budget green.
1. Fetch Quaternius (or documented fallback); licence + sha256 in CREDITS.
2. Import; wire PropKit.character; map SKINS for greeter/clerk/teller/vault_keeper/manager/registrar + player.
3. Verify clips for IDLE/WORKING/REFUSING/ESCORTING and player walk/sprint.
4. Measure; if over gate → fewer materials, smaller textures, simpler meshes, or fewer skinned bones — not more lights.
5. :5174 ?mock=account; F6/E/F4 focus drill.
6. Progress note + captures (lobby with Mo, Counter 1 Dev, vault Ruth) + README index row. Stop — no Stage 4.

DoD (Stage 3):
- Five NPCs + player read as adult-ish low-poly bank staff (not Kenney Mini chibi) in lobby/counter/vault shots.
- Clips cover idle / work-or-talk / refuse / walk; escort and dialogue still work; capsules unchanged.
- All perf gates green; freeze checks PASS; CREDITS + progress note + README index row present.
- Petra has an explicit skin entry; Name Desk still free for U5 interactables.
- HANDOFF not advanced past U5.

OUT OF SCOPE: wall shell (Stage 4), hero re-author, particles/HUD/fonts/video, ENS/Arc, Mixamo without licence,
ninth omni, PBR micro-detail.

Stop when Stage 3 DoD is met or a named budget/licence blocker needs a principal cut.
```

## Conflict map

| Area | Stage 3 agent | U5 agent |
|------|---------------|----------|
| `assets/characters/**`, `npc.gd` skins | Yes | Soft — may add Petra instance later; skin entry helps |
| Heroes / Kenney furniture / walls | No | No |
| Name Desk form / ens* / teller | No | Yes |
| `:5174` mock preview | Yes | No |

## After this pass

Next art unit: **Stage 4** — [`docs/KICKOFF-U7-viz-stage4.md`](./KICKOFF-U7-viz-stage4.md) (wall shell). Product
mission stays **U5 ENS** until HANDOFF says otherwise. Full U7 Feel / ship remains G8–G10.
