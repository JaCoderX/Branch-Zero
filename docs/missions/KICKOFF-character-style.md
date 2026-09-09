---
title: Kickoff prompt — Character style climb
created: 2026-09-08
product: Branch-Zero
model: Claude Code · Opus 5 high
handoff: docs/missions/HANDOFF-character-style.md
---

# Kickoff prompt — Character style climb

Paste into a **new** Claude Code / Cursor session. Prefer **Opus 5 high** (Claude Opus 5 · high thinking).

**What this is:** Upgrade **NPCs + player only** beyond Kenney Blocky toward a still-simple cartoon cast with a
light Borderlands-adjacent read (bold silhouette + Compatibility-safe outline + optional soft toon on bodies).
**Room / furniture / heroes stay as-is.**

**Why:** Principal accepted the bank set dressing; the cast still reads Minecraft-adjacent. Research
([`HANDOFF-character-style.md`](./HANDOFF-character-style.md)) says a full Gearbox ink pipeline is the wrong
budget/licence fit; a character-only style layer is the honest climb.

**Parallel:** Product mission **Load Account** stays with its own handoff — do not steal that scope.

---

## Reflect

| Fact | Implication |
|------|-------------|
| Stages 1–6 met; cast = Kenney Blocky + 1 atlas mat | Upgrade **one class** (characters); keep atlas discipline |
| Animated nodes × shadow × outline passes | Measure `run_viz_budget` + viz_shots before/after; cut surfaces first |
| Public MIT + QAL history | True CC0 zip or principal-yellow private path — never trust pack-page CC0 badges |
| Borderlands = ink + outline + proportions | Outlines-only on Blocky = experiment, not DoD |
| Art-deco bank bible | Soft comic staff yes; wasteland / fantasy adventurer no |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code Opus 5 high.

MISSION: Branch Zero — character style climb ONLY. Replace or restyle the Kenney Blocky cast (NPCs + player)
with more complex but still-simple cartoon humanoids that read a bit Borderlands-adjacent (silhouette + outline
± soft toon on bodies). Leave the room, furniture, heroes, HUD, particles, and lighting recipe alone.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-character-style.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/KICKOFF-character-style.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1 art bible, §5 pipeline, §6 budget)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (roles / animation verbs — do not rewrite lines)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/CREDITS.md
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§5b, §8 web)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-CC.md   (context only — do NOT advance first_mission)
9. Craft (do not re-author):
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/cards/public-repo-asset-intake.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/pack-page-badge-is-not-the-licence.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/product-use-is-not-repo-redistribution.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/asset-must-fit-the-world-not-just-the-licence.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/atlas-skins-to-one-material.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/animated-nodes-cost-surfaces-times-passes.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/upgrade-one-asset-class-under-hard-gates.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/outlines-alone-are-not-a-style.md
   https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/style-the-cast-separately-from-the-set.md

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility. No SDFGI/SSR/volumetric fog/lightmaps.
- Licence: open the site licence page + zip License.txt. Public tree = true CC0 (or OFL fonts) only.
  Quaternius / Mixamo / Synty / Unity free / NYOP itch = yellow or red — principal OK required for yellow private cache; never commit yellow raw .glb to this MIT repo.
- Narrative: art-deco bank staff. Soft comic / light Borderlands outline OK. Reject wasteland grit, fantasy RPG, voxel, photoreal micro-detail.
- ONE asset class: characters (assets/characters/**, PropKit.character, npc.gd SKINS, player.gd skin, character materials/shaders). Do NOT rebuild shell, KayKit, Nature, heroes, HUD, particles, fonts.
- Colliders stay U3 capsules. Escort / dialogue / run_action graphs unchanged. Clip verbs: idle, walk, work-or-interact, refuse (map whatever the kit ships).
- Characters are animated → not in bake_static. Budget surfaces × (base + shadow splits + outline next_pass). Prefer ONE shared character material/atlas.
- Outline path: Compatibility-safe inverted-hull (next_pass / cull_front). Do not require Forward+ or heavy full-screen Sobel for DoD.
- Perf (WORLD-3D §6): ≤ 350 draws, ≤ 400k tris, ≤ 40 materials, 1 shadowed light, ≤ 8 omnis; .pck prefer ≪ 15 MB. Fail → cut (fewer surfaces, thinner outline, simpler mesh), not more lights.
- Ports: day-to-day Godot editor + MockChain; web check only :5174 ?mock=account. Never :5173 / :8787 / dev:teller.
- CREDITS: author, licence name + URL, fetch date, zip sha256, paths. Progress note is laptop-local (docs/progress gitignored) — still write it locally; do not invent a public progress README if absent.
- Do NOT advance HANDOFF-CC first_mission. Do NOT touch Load Account / teller-desk / bridge / ens* / treasury.

OWN: apps/game/assets/characters/**, character shaders/materials under apps/game if needed, PropKit.character, npc.gd SKINS, player.gd skin, tools/character_atlas.py (or successor), CREDITS.md, this handoff/kickoff if you must correct facts.

AVOID: bank_interior shell, kaykit/nature/hero props, hud.gd, feel particles, dialogue/*.json, apps/teller-desk, apps/web bridge, MockChain behaviour, Load Account forms.

SEQUENCE:
0. Record baselines: run_checks + mock_walk + run_viz_budget green; note character surface × pass estimate.
1. Intake: find/verify a green (CC0) adult cartoon humanoid kit with idle/walk/interact/refuse — OR principal-documented yellow private path — OR custom Blender bases. Document reject reasons for anything that fails licence or art bible.
2. Import glTF; scale ~1.75–1.8 m; face -Z; wire PropKit.character; map SKINS (greeter/clerk/teller/vault_keeper/manager/registrar/dealer + player). Keep one shared atlas/material if multiple skins.
3. Add character-only outline (± soft toon). Room materials untouched.
4. Remap AnimationPlayer clips to IDLE / WORKING / REFUSING / ESCORTING / player walk. Escort still works.
5. Measure; cut until gates green. :5174 ?mock=account focus drill.
6. CREDITS + local progress note with lobby/counter/vault shots. Stop — no Stage 6 furniture redo, no packaging.

DoD:
- Five+ staff NPCs + player read as more complex cartoon bank humans than Kenney Blocky (not chibi, not cubes-only) in lobby/counter/vault shots.
- Light Borderlands-adjacent cue present (silhouette and/or outline on cast); room still flat Kenney/KayKit language.
- Clips cover idle / work-or-talk / refuse / walk; escort + dialogue still work; capsules unchanged.
- All perf gates green; freeze checks PASS; CREDITS updated; licence green (or principal yellow path documented without illegal public redistribute).
- HANDOFF-CC first_mission untouched; Load Account / chain code untouched.

OUT OF SCOPE: full-world ink/Sobel; room rebuild; Quaternius in public tree without licence change; Mixamo without principal OK; Arc; ship packaging; Load Account.

Stop when DoD met or a named licence/budget blocker needs a principal cut (smallest honest fallback: keep Blocky + document why).
```

---

## After this pass

Product construction stays **Load Account** ([`KICKOFF-load-account.md`](./KICKOFF-load-account.md)) unless the principal reorders.
U7 ship packaging remains gated on re-playtest.
