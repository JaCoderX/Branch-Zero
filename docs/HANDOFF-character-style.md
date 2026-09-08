---
type: handoff
title: Handoff — Character style climb (post–Kenney Blocky)
audience: cold agent (Claude Code · Opus 5 high)
created: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
mission: More complex cartoon characters (Borderlands-adjacent outline + silhouette); room stays as-is
plan: this file §Research
kickoff: docs/KICKOFF-character-style.md
baseline: U7 viz Stages 1–6 met (Kenney Blocky cast + atlas); web Compatibility gates green
parallel_to: Load Account (docs/HANDOFF-load-account.md) — do not steal that product mission
---

# Handoff — Character style climb

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**.
No freedom on constraints, scope, or protocol semantics.

**Authorized construction:** upgrade the **cast only** (NPCs + player) beyond Kenney Blocky silhouettes toward a
still-simple cartoon look with a light Borderlands-adjacent read (outline + graphic silhouette + optional soft
toon on bodies). Prefer **Claude Code · Opus 5 high**.

**Kickoff (paste):** [`docs/KICKOFF-character-style.md`](./KICKOFF-character-style.md)

**Not this mission:** Load Account, Sepolia treasury, U7 ship packaging, Arc, dialogue/bridge, room/furniture rebuild.

---

## Principal intent

1. Room and back are **fine** — do not re-author walls, KayKit fill, hero props, or lighting recipe.
2. Characters feel too Minecraft / Blocky; want **more complex** humans that stay **simple and cartoon**.
3. A **bit** of Borderlands flavour is welcome (ink outline, punchy silhouette) — not a full Gearbox ink pipeline.

---

## Research (2026-09-08) — learnings to carry

### Current cast

| Fact | Implication |
|------|-------------|
| Shipped cast = **Kenney Blocky Characters 2.0** (CC0) | Adult-ish blocks, not Mini chibi; still cubic silhouettes |
| Eight skins → one 1024×512 atlas (`tools/character_atlas.py`) | Material budget held; new kit must keep **one** character material (or prove a cut) |
| `npc.gd` / `player.gd` via `PropKit.character` | Clip names are Kenney (`idle`, `walk`, `interact-right`, `emote-no`, …) — retarget or remap |
| Characters are **animated** → outside `bake_static` | Budget as `surfaces × (1 + shadow_splits + outline_pass)` |

### What “Borderlands-like” actually is

Gearbox’s look is **not** plain cel-shading. It is roughly:

1. **Hand-inked textures** (most of the comic feel — expensive art time)
2. **Screen-space / filter outlines** (Sobel-class edge detection in their engines)
3. **Exaggerated proportions** and graphic silhouettes

Their own art talks: **outlines alone are not a magic bullet**; textures must be touched; proportions must change.
For this bank, a realistic target is **partial**: bold silhouette + Compatibility-safe black outline + optional soft
toon on **characters only** — not world-wide ink + Sobel on every KayKit couch.

### Hard gates (already law)

| Gate | Source | Character-climb note |
|------|--------|----------------------|
| Web, threads OFF, **Compatibility** | GODOT / WORLD-3D | No Forward+; inverted-hull `next_pass` outlines are the safe path; heavy Sobel post is riskier |
| Draws ≤ 350; tris ≤ 400k; mats ≤ 40; 1 shadowed light; ≤ 8 omnis | WORLD-3D §6 | Outline ≈ **+1 pass per surface**; ambient customers already cut on low-end |
| `.pck` prefer ≪ 15 MB | Stage kickoffs | Heavier meshes/textures eat first-load headroom |
| Public MIT repo → true **CC0** (or OFL fonts) for raw `.glb` | CREDITS / Stage 6 | Quaternius pack badges ≠ licence; **QAL v1** forbids redistributing originals/modified outside a finished product |
| Art bible: art-deco bank, flat-to-soft shade, no photoreal, no fantasy RPG, no voxel | WORLD-3D §1 / Stage 6 | Soft comic staff OK; wasteland grit / adventurer skins **reject** |

### Licence shortlist (do not re-litigate Stage 3)

| Source | Tier | Note |
|--------|------|------|
| Kenney Blocky (current) | Green | Baseline; keep as fallback |
| Quaternius Universal / toon kits | **Yellow** | Product use often OK; **no** public raw-file commit under QAL — principal-only private cache or skip |
| Mixamo / Synty / Unity Store free | Yellow / Red | EULA / TOU — not public-repo intake |
| New itch/GitHub kit with zip `License.txt` = CC0 + bank-fit silhouette | Green if verified | Prefer direct zip; CREDITS sha256 |
| Custom Blender bank staff | Green (ours) | Highest control; highest art cost |

### Feasible paths (ranked)

1. **Shader-first on a better humanoid (best ROI)** — CC0 (or principal-yellow) adult cartoon mesh; shared atlas; inverted-hull outline + mild toon on bodies only; room unchanged.
2. **Custom / commissioned stylized staff** — exaggerated bank proportions; simple painted textures; same animation verbs.
3. **Yellow kit behind principal OK** — e.g. Quaternius Universal Base (~13k tris) in a private cache; not committed as redistributable raw assets unless licence changes.
4. **Kenney Blocky + outline only** — cheap A/B; will **not** satisfy “more complex characters.”
5. **Full Borderlands world ink** — reject for time / licence / draw budget while the room is already accepted.

### Craft lessons already paid (do not relearn)

- [`pack-page-badge-is-not-the-licence`](../../GameDevOS/wiki/lessons/pack-page-badge-is-not-the-licence.md)
- [`product-use-is-not-repo-redistribution`](../../GameDevOS/wiki/lessons/product-use-is-not-repo-redistribution.md)
- [`asset-must-fit-the-world-not-just-the-licence`](../../GameDevOS/wiki/lessons/asset-must-fit-the-world-not-just-the-licence.md)
- [`atlas-skins-to-one-material`](../../GameDevOS/wiki/lessons/atlas-skins-to-one-material.md)
- [`animated-nodes-cost-surfaces-times-passes`](../../GameDevOS/wiki/lessons/animated-nodes-cost-surfaces-times-passes.md)
- [`upgrade-one-asset-class-under-hard-gates`](../../GameDevOS/wiki/lessons/upgrade-one-asset-class-under-hard-gates.md)
- Card: [`public-repo-asset-intake`](../../GameDevOS/wiki/cards/public-repo-asset-intake.md)

New scrub from this research (GameDevOS):

- [`outlines-alone-are-not-a-style`](../../GameDevOS/wiki/lessons/outlines-alone-are-not-a-style.md)
- [`style-the-cast-separately-from-the-set`](../../GameDevOS/wiki/lessons/style-the-cast-separately-from-the-set.md)

---

## Outcome (2026-09-08) — met

Built, measured and captured; local record `docs/progress/2026-09-08-character-style.md`.

| Question this file asked | Answer as built |
|--------------------------|-----------------|
| Which path? | **1 — shader-first on a better humanoid.** Kenney **Animated Characters** (Protagonists + Survivors, CC0, direct zips with `License.txt`): one rigged, skinned adult `characterMedium` (1,604 tris, one surface, 32 deform bones) for the whole cast |
| Licence tier | **Green.** kenney.nl has no separate licence page (`/license` 404), so the pack pages' structured CC0 row plus each zip's `License.txt` is the evidence — the standard the four existing Kenney rows already use. Quaternius still out on QAL v1; **Retro** rejected on the art bible (painted, soft-shaded skins), not the licence |
| One material? | Yes — one 1024² atlas of eight 340 px bank uniforms, and `PropKit.character` folds each role's tile into a **copy of the mesh UVs**, so roles cost meshes, not materials. Plus **one** outline material: 38 unique with particles, ≤ 40 |
| Surfaces × passes | **Fell.** 2 surfaces × (1 colour + 2 shadow) = **6 draws per body**, 48 for the cast — the Blocky figures cost 18 each / 144. Worst view 284 → **225** draws; primitives 170k → **222k** (the outline pass is the price) |
| "Borderlands-adjacent" without the Gearbox pipeline | All three knobs, cast only: **silhouette** (shoulders +20 %, hands +26 %, shoes +20 % by skin weight), **surface** (Kenney's faces kept, every clothing region repainted in the wing palette), **edges** (Compatibility-safe inverted hull on `next_pass`). No world ink, no Sobel |
| Clip verbs | `idle` / `walk` / `sprint` shipped or derived from Kenney's clips; **`work`** and **`refuse`** authored on his rig (the packs ship idle / run / jump only). Escort re-verified: `ESCORTING`, clip `walk`, `speed_scale` 2.13, 8.34 m along the U3 waypoints |

Two facts in the Research above are now historical: the cast is no longer Kenney Blocky (retired to git history,
and it remains the documented fallback), and `tools/character_atlas.py` is replaced by
`tools/bank_staff_rig.py` + `tools/bank_staff_atlas.py`.

**Principal review (same day):** visualisation "a lot better", but the people read "boring and flat / dull" next
to the charm the Blocky cast had. Diagnosed as faces too small at the game camera, adult proportion without
silhouette identity, and uniforms painted in the room's own palette — not a mesh-complexity problem. The follow-up
is a separate pass on this pipeline: [`HANDOFF-character-charm.md`](./HANDOFF-character-charm.md) ·
[`KICKOFF-character-charm.md`](./KICKOFF-character-charm.md). This file stays the pipeline record.

---

## Baseline (do not regress)

- U7 viz Stages 1–6 **met** (shell, heroes, Blocky cast + atlas, feel, KayKit/Nature/ambientCG).
- `run_checks` / `run_mock_walk` / `run_viz_budget` green before and after.
- Escort, dialogue, capsules, Name Desk wiring, bridge, teller-desk — **untouched**.
- Load Account / Sepolia Live / treasury / OBSERVER — **untouched**.

---

## DoD

See [`KICKOFF-character-style.md`](./KICKOFF-character-style.md) DoD block.

---

## Out of scope

Room/furniture/heroes/HUD/particles rebuild; Full Borderlands ink pipeline; Mixamo without principal licence;
Quaternius committed to the public tree without a licence change or principal yellow path; Arc; ship packaging;
Load Account / chain work.
