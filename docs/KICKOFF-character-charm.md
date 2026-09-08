---
title: Kickoff prompt — Character charm (faces, proportions, mid-50s wardrobe)
created: 2026-09-08
product: Branch-Zero
model: Codex Luna xhigh or Claude Code (Opus not required)
handoff: docs/HANDOFF-character-charm.md
---

# Kickoff prompt — Character charm

Paste into a **new** Cursor / Claude Code session, separate from any Load Account or packaging session.

**What this is:** Re-author the **cast only** (seven staff NPCs + player) on the rig and pipeline the character-style
climb built, so the people read as **inviting**: legible flat faces with a five-state expression sheet, ~5.5-heads
cartoon proportion, and a mid-50s bank dress code drawn in a Cartoon Modern language with **one accent colour per
person**. **Room / furniture / heroes stay as-is.**

**Why:** Principal accepted the climb ("a lot better") but the people are "boring and flat / dull" and lack the charm
the simpler cast had. Research ([`HANDOFF-character-charm.md`](./HANDOFF-character-charm.md)) traces it to three
things: faces too small to read at the game camera, adult proportion with no silhouette identity, and uniforms painted
in the room's own palette. Mesh complexity was never the knob.

**Parallel:** Load Account / ship packaging keep their own handoffs — do not touch their files.

---

## Reflect

| Fact | Implication |
|------|-------------|
| Cast is one CC0 skinned mesh, one atlas mat + one outline mat (38 of 40 mats) | Exactly **one** new material is affordable: the shared face sheet |
| Camera is over-the-shoulder; face ≈ 20–30 px today | Eyes must grow 2–3× and the head ~1.35×, or no expression will ever read |
| Room palette = cream / brass / deep green; uniforms currently the same | Each person owns **one** saturated accent; the room owns the rest |
| `npc.gd` already has `player_near`, `TALKING / WORKING / REFUSING / ESCORTING` | Expressions and gaze are state hooks, not new systems |
| Animated nodes × passes | Face carrier: `cast_shadow` OFF, **no** outline `next_pass` → ≈ +1 draw per body |
| Kenney skins ship SVG sources | Faces are redrawn as vectors, not sampled from the skater |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — character CHARM pass ONLY. Keep the current CC0 rig / atlas / outline pipeline and make the
seven staff NPCs + player read as inviting people: (1) ~5.5-heads cartoon proportion with per-role silhouette,
(2) eight distinct flat vector faces with a five-state expression sheet driven by NPC state, (3) mid-50s bank dress
code in Cartoon Modern language with ONE accent colour per person, (4) gaze toward a near player in IDLE,
(5) a one-shot greet beat on approach. Room, furniture, heroes, HUD, particles, lighting: untouched.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-character-charm.md   (diagnosis, direction, wardrobe sheet)
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-character-charm.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-character-style.md   (§Outcome — the pipeline you inherit)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1 art bible, §6 budget)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (roles, names, states — do not rewrite lines)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/CREDITS.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§5b, §8 web)
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
9. Craft (do not re-author):
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/complexity-is-not-charm.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/outlines-alone-are-not-a-style.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/style-the-cast-separately-from-the-set.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/animated-nodes-cost-surfaces-times-passes.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/atlas-skins-to-one-material.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/cards/public-repo-asset-intake.md

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Tools you inherit: apps/game/tools/bank_staff_rig.py (Blender 4.5 headless; retarget + exaggerate + author clips),
apps/game/tools/bank_staff_atlas.py (region painter → 1024² atlas), apps/game/scripts/props.gd PropKit.character.

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility. No blendshapes, no bone-driven face rigs, no Forward+.
- Face expressions = sprite sheet swapped via StandardMaterial3D.uv1_offset (Discrete) or a two-line face-swap
  shader with `instance uniform int frame`. ONE shared face material for the whole cast. Face carrier: a quad on a
  BoneAttachment3D at the Head bone (preferred) or a second surface split from the body mesh — either way
  cast_shadow OFF and NO outline next_pass on it.
- Materials ≤ 40 (now 38 → 39 with the face sheet). No other new material. Draws ≤ 350, tris ≤ 400k, .pck ≪ 15 MB.
  Face sheet ≤ 512². Fail → cut, not more lights or materials.
- Proportion: target ~5.5 heads via bone-weighted scaling in bank_staff_rig.py (Head/Neck up ~1.35×, torso/legs
  −5 %, keep hand/shoe bumps). Per-role bone scale allowed (stocky / slight / tall). If the counter shot reads
  childish, fall back to ~6.5 heads and say so — do not silently split the difference.
- Palette rule: room owns cream / brass / deep green; each person owns exactly ONE saturated accent (tie, dress,
  cardigan, braces, scarf). Start from the wardrobe sheet in the handoff; you may move colours, not the rule.
- Faces: eight DISTINCT faces (no shared face between roles), drawn flat: large eyes with highlight, brows, mouth,
  cheek dot; hair as a graphic shape with variety (parted, bun, slick, grey temples). Default expression for
  staff is a light smile — this is a bank that wants your business.
- Expression hooks (npc.gd): player_near(true) in IDLE → smile; Dialogue.opened → surprised ~0.4 s then talk;
  WORKING → neutral/talk; REFUSING → concern; ESCORTING → smile; back to neutral when the player leaves.
  Player: neutral; smile while a dialogue is open. Optional blink on a 3–6 s random timer (a timer, not a state).
- Gaze: in IDLE while player_near, turn the Head bone toward the player (yaw clamp ±40°, pitch ±15°) via
  LookAtModifier3D or a pose lerp; body keeps home_yaw. Existing TALKING/WORKING/REFUSING body turn stays.
- Greet: author one short `greet` clip (nod or half-wave, ~0.8 s) in bank_staff_rig.py; play once on
  player_near(true) from IDLE, then return to idle. Never interrupt WORKING / REFUSING / ESCORTING.
- Colliders stay U3 capsules. Escort / dialogue / run_action graphs unchanged. Clip verbs idle / walk / sprint /
  work / refuse keep their names and speeds.
- Licence: everything new is our derivative of CC0 Kenney sources — CREDITS row updated with new sha256s and the
  face tool named. No new third-party asset intake without the public-repo card.
- Ports: Godot editor + MockChain day-to-day; web check only :5174 ?mock=account. Never :5173 / :8787 / dev:teller.
- Progress note is laptop-local (docs/progress gitignored) — write it, with the readability shots.
- Do NOT touch Load Account / teller-desk / bridge / ens* / treasury / partners board / HANDOFF-CC first_mission.

OWN: apps/game/tools/bank_staff_rig.py, apps/game/tools/bank_staff_atlas.py, NEW apps/game/tools/bank_staff_faces.py,
apps/game/assets/characters/kenney_staff/**, PropKit.character + staff_* in props.gd, npc.gd (state → face/gaze/greet
hooks only), player.gd (face hook only), apps/game/tests/run_viz_budget.gd (count the face surface honestly),
apps/game/tools/viz_shots (add the two face-readability frames), CREDITS.md, WORLD-3D §1 (add the cast bible row),
this handoff/kickoff if you must correct facts.

AVOID: bank_interior shell, kaykit/nature/hero props, hud.gd, feel particles, dialogue/*.json, main.gd beyond
wiring you cannot avoid, apps/teller-desk, apps/web, MockChain, Load Account forms.

SEQUENCE (two passes; each ends with all gates green):
0. Baselines: run_checks + run_mock_walk + run_viz_budget green; note draws / mats / .pck; take the two
   readability frames (counter cam 5 m, lobby cam 15 m) as "before".
PASS A — silhouette + wardrobe + gaze
1. bank_staff_rig.py: head/neck scale, torso/legs trim, per-role bone scale table; re-export bank_staff.glb;
   confirm clips still land (work stamps at counter height after the rescale).
2. bank_staff_atlas.py: mid-50s cuts as graphic regions (lapel line, narrow tie, pocket square, sheath, cardigan,
   glasses), ONE accent per role, hair shapes with variety; rebuild staff_atlas.png. Outline: consider thinning to
   ~0.030 on bodies so the accent does the work.
3. npc.gd gaze in IDLE while player_near. Measure; cut until green. Readability frames "after A".
PASS B — faces + expressions + greet
4. bank_staff_faces.py: eight vector faces × five states → ≤ 512² face sheet (grid; mirror eyes to save cells).
   PropKit.character adds the face carrier + shared face material; uv1_offset (or frame uniform) per role/state.
5. npc.gd / player.gd expression hooks; blink timer; `greet` clip authored + wired once per approach.
6. run_viz_budget counts the face surface and the 39th material; viz_shots gets the two readability frames.
7. :5174 ?mock=account drill: approach Mo (greet + smile + gaze), open dialogue (surprised → talk), trigger a
   refusal at a counter (concern), escort still walks. CREDITS + WORLD-3D §1 cast row + local progress note. Stop.

DoD:
- At the counter cam (≈5 m) every staff face reads: eyes, brows, mouth state. At the lobby cam (≈15 m) each of
  Mo / Ines / Dev / Bob / Okafor / Petra / Kenji is tellable by silhouette + accent alone.
- Five expression states visible in a capture set (neutral / smile / talk / concern / surprised) driven by NPC
  state; default staff face is a light smile; gaze follows a near player in IDLE; greet plays once on approach.
- Mid-50s dress code reads in stills (narrow ties / sheath / cardigan / glasses) with one accent per person;
  room materials byte-identical.
- ≤ 350 draws, ≤ 400k tris, ≤ 40 materials (expect 39), 1 shadowed light; .pck < 4 MB; freeze checks PASS;
  escort + dialogue + capsules unchanged; CREDITS updated; licence green.
- HANDOFF-CC first_mission untouched; Load Account / chain code untouched.

OUT OF SCOPE: room / heroes / HUD; new NPCs or lines; blendshape or bone facial rigs; Forward+; more than one new
material; yellow-licence kits; Arc; ship packaging; Load Account.

Stop when DoD met, or when a named budget / readability blocker needs a principal cut (smallest honest fallback:
Pass A shipped alone with faces documented as owed).
```

---

## After this pass

Product construction stays **Load Account → ship packaging** unless the principal reorders. The character-style
handoff remains the pipeline record; this file owns the *look*.
