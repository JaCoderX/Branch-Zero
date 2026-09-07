# Kickoff prompt — U7 viz Stage 6 (safe narrative asset climb)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate only if Compatibility draw/material gates fail after one honest cut pass.

**What this is:** Stage 6 of the art climb — **redistribution-safe, narrative-fitting** third-party upgrades after Stages 1–5. Not ship packaging, not U6 Arc revive, not bridge/desk changes.

**Craft backing (read first if cold):** GameDevOS card
[`public-repo-asset-intake`](../../GameDevOS/wiki/cards/public-repo-asset-intake.md) and lessons
`product-use-is-not-repo-redistribution`, `nyop-is-not-a-free-licence`,
`asset-must-fit-the-world-not-just-the-licence`, `pack-page-badge-is-not-the-licence`,
`upgrade-one-asset-class-under-hard-gates`, `split-flat-colour-atlas-by-uv-cell`,
`remap-kit-materials-as-materials-not-colors`, `decorated-kit-mesh-is-not-the-current-class`,
`snapshot-kit-meta-before-static-bake`, `nested-yaw-inflates-aabb`.

**Ladder:**

| Stage | Goal | Status |
|-------|------|--------|
| 1–5 | Legible bank → heroes → characters → shell → feel | **met** |
| 6a | KayKit furniture fill (palette remap) | **met** |
| 6b | MrEliptik desk clutter | **skipped** (NYOP) |
| 6c | ambientCG albedo on existing palette slots | **met** |
| 6d | Kenney Nature Kit plants + KayKit cabinet consistency | **met** 2026-09-07 — [`KICKOFF-U7-viz-stage6d.md`](./KICKOFF-U7-viz-stage6d.md); consistency `58b5761` |

---

## Art bible (narrative gate — reject on fail)

Branch Zero is a **stylised art-deco bank**: warm marble / brass / deep green (Main), cool graphite / USDC blue (Arc later). Strong silhouettes, flat-to-soft shade, **no** photoreal micro-detail, **no** fantasy RPG cast, **no** voxel kits, **no** open-plan startup office look. Camera is third-person OTS at human scale (1 unit = 1 m).

"Higher res" here means: cleaner fill, shared grain atlas, denser but remappable props — **not** Unreal PBR or adventurer skins.

---

## Licence gate (hard)

Public MIT repo ⇒ only **green** redistribution:

| Allowed (verify licence page + zip) | Forbidden without principal |
|-------------------------------------|----------------------------|
| Kenney CC0 packs | Quaternius (**QAL** — product-only redistribute ban) |
| KayKit Bits **CC0** (glTF + one atlas) if palette-remappable | VNB / Mixamo / Unity Store free EULAs |
| ambientCG / Poly Haven **CC0** → downsampled atlas | Any pack with no licence line |
| Named itch **CC0** office props with `License.txt` | CC-BY-NC, Freepik free tier |
| SIL OFL fonts (keep OFL.txt) | |

CREDITS must record author, licence name + URL, fetch date, zip sha256, paths under `apps/game/assets/`.

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — U7 viz Stage 6a ONLY (replace Kenney furniture *fill* with denser
CC0 interior props that pass the art bible, remapped onto WingTheme / PropKit).
Freedom on HOW. No freedom on constraints.
This is NOT 6b/6c/6d unless 6a gates are green and the principal expands scope.
This is NOT ship packaging, NOT U6 Arc, NOT dialogue/bridge/MockChain.

BEFORE CODE — read in order:
1. docs/HANDOFF-CC.md
2. docs/KICKOFF-U7-viz-stage6.md   (this file)
3. docs/WORLD-3D-ENVIRONMENT.md   (§1, §5–§7)
4. docs/progress/2026-09-07-u7-viz-stage5.md   (budget headroom)
5. CREDITS.md
6. GameDevOS wiki/cards/public-repo-asset-intake.md
7. docs/GODOT.md (§5b, §8)
8. docs/DEV-LOOP.md

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility. No SDFGI/SSR/volumetric fog/lightmaps.
- Licence: CC0 (or OFL fonts) only. Open the *site licence page*, not only the itch badge.
- Narrative: art-deco bank only. Recolour via PropKit / WingTheme. Drop any mesh that still
  reads fantasy, voxel, or photoreal after remap.
- One class: furniture fill. Do NOT swap characters, heroes, shell, HUD, particles, fonts.
- Keep footprints, colliders (layer 1 / mask 0), zones, escort waypoints, vault legibility.
- Perf (WORLD-3D §6): ≤ 350 draws, ≤ 400k tris, ≤ 40 materials, 1 shadowed light, ≤ 8 omnis,
  `.pck` prefer ≪ 15 MB. Re-run tests/run_viz_budget.gd + viz_shots; cut before adding more.
- bake_static stays; animated / no_batch nodes stay out of the merge.
- Name Desk / Petra / ens* / bridge / teller-desk: do not touch wiring — props only if already
  in the zone as fill.
- Update CREDITS.md for every new third-party file. Prefer direct zip downloads.

OWN:
- apps/game/assets/models/ (new CC0 fill; retire unused Kenney furniture files if replaced)
- props.gd / bank_interior.gd placement only as needed
- CREDITS.md; docs/progress note for Stage 6a

AVOID:
- Quaternius, Mixamo, VNB, KayKit Adventurers (fantasy cast — narrative fail)
- Photoreal 4K/8K full PBR stacks on meshes
- Character atlas / npc.gd / hero_props.py / hud / feel / fonts
- Parallel ship-packaging files

SEQUENCE:
0. Record Stage 5 baselines (draws, mats, tris, .pck). Confirm run_checks + run_viz_budget green.
1. Fetch shortlisted packs (see § Shortlist). Verify licence page + License.txt + sha256.
2. Import subset for lobby + counters + manager + vault antechamber only.
3. Remap materials into PropKit / WingTheme; one shared atlas if the pack brings one.
4. bake_static; measure; if over gate → remove densest offenders before 6b.
5. Progress note + captures; CREDITS. Stop.

DoD (Stage 6a):
- Kenney furniture fill in high-traffic zones replaced or clearly denser CC0 equivalents.
- Art bible holds in lobby → vault and Counter 1 shots (no fantasy/voxel/photoreal reads).
- Every new file in CREDITS with licence URL + sha256.
- WORLD-3D §6 gates green; freeze checks (run_checks, mock walk) still pass.
- HANDOFF unit unchanged (do not claim ship packaging done).
```

---

## Shortlist (6a → 6d)

### 6a — Fill (do first)

| Pack | Why it fits | Licence check |
|------|-------------|----------------|
| [KayKit Furniture Bits](https://kaylousberg.itch.io/furniture-bits) | Low-poly interiors, **one 1024 atlas**, Godot glTF — remap to marble/brass/green | Confirm itch **CC0** + zip licence |
| Remaining [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) pieces | Already in CREDITS; fill gaps without new vendor | CC0 (known) |

**Reject for 6a:** KayKit Adventurers / dungeon packs (narrative), voxel office packs (style), Quaternius furniture (QAL).

### 6b — Desk clutter — **SKIPPED**

| Pack | Why skipped |
|------|-------------|
| [MrEliptik Office low poly](https://mreliptik.itch.io/office-low-poly-pack) | itch **name-your-own-price** gate (not a free direct download for public-repo intake). Principal: skip. Desk tech stays on existing Kenney screen/keyboard + hero printer/stamp. |

### 6c — Surfaces (after 6a; 6b skipped)

| Source | Use | Licence |
|--------|-----|---------|
| [ambientCG](https://ambientcg.com/license) Marble016 / WoodFloor043 / Plaster001 | 512² albedo only → tint existing Marble / Wood / Ceiling / Paper slots (**zero new materials**) | **CC0** — `tools/surface_pack.py` |

Keep Compatibility: albedo + theme tint only; no normal/roughness stacks on web.


### 6d — Optional soft props

| Pack | Use | Licence |
|------|-----|---------|
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | Lobby plants denser silhouettes | CC0 |

### Characters (explicit non-goal)

**Keep Kenney Blocky** unless the principal opens a separate stage. Fantasy CC0 humanoids fail the bank narrative even when the licence is green.

### Yellow (principal-only, not this kickoff)

Quaternius (QAL), Mixamo, VNB office sets — may ship in a closed product; **do not** commit raw files to this public tree.

---

## Perf reminder (Stage 5 baseline to beat carefully)

Worst views ~281 draws / ~144k prims / 36 materials / `.pck` ~1.8 MB. Headroom exists on tris and draws; **materials (~40)** and **8 omnis** are the tight walls. New atlases must merge into PropKit — do not add a material per imported mesh.

---

## Out of scope

Ship packaging, title cards, Cloudflare deploy, U6 Arc faucet, dialogue, bridge version bumps, character swap, hero re-cut, shell rewrite.
