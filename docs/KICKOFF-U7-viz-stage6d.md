# Kickoff prompt — U7 viz Stage 6d (Kenney Nature Kit plants)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate only if Compatibility draw/material gates fail after one honest cut pass.

**What this is:** Optional Stage **6d** of the safe narrative asset climb — denser **lobby / soft-zone plants** from Kenney Nature Kit (CC0). Not 6b (skipped), not ship packaging, not U6 Arc, not bridge/desk/dialogue.

**Craft backing:** GameDevOS card
[`public-repo-asset-intake`](../../GameDevOS/wiki/cards/public-repo-asset-intake.md) · lessons
`product-use-is-not-repo-redistribution`, `asset-must-fit-the-world-not-just-the-licence`,
`upgrade-one-asset-class-under-hard-gates`, `bake-beats-multimesh-for-static-fill`.

**Ladder:**

| Stage | Goal | Status |
|-------|------|--------|
| 1–5 | Legible bank → heroes → characters → shell → feel | **met** |
| 6a | KayKit furniture fill (palette remap) | **met** (`9a00f8b`) |
| 6b | MrEliptik desk clutter | **skipped** (itch NYOP — not free intake) |
| 6c | ambientCG albedo on existing Marble/Wood/Ceiling/Paper | **met** (`3abe152`) |
| **6d** | **Kenney Nature Kit plants — denser silhouettes** | **this kickoff** |

**Baselines after 6c (do not regress):** worst draws ~290 / prims ~167k / materials **36 mesh · 38 with particles** (≤ 40) / `.pck` ~2 MB. **Material headroom is 2** — Nature Kit must collapse into PropKit `Plant` (+ existing wood/pot colours). Prefer **zero** new unique materials; one shared plant atlas material only if the kit forces it and you stay ≤ 40.

---

## Art bible (narrative gate)

Stylised art-deco bank: warm marble / brass / deep green. Plants are **lobby greenery** — potted indoor silhouettes, not forest trees, not fantasy flora, not photoreal leaves. Keep scale human (1 unit = 1 m); lobby pots read from the OTS camera without blocking vault LED / ledger sightlines.

---

## Licence gate (hard)

| Allowed | Forbidden |
|---------|-----------|
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) **CC0** (direct zip + `License.txt`) | Quaternius QAL, Mixamo, VNB, itch NYOP packs |
| Remap into WingTheme / PropKit (`Plant`, wood pot, etc.) | Per-prop unique materials, new shadowed lights, 9th omni |

CREDITS: author, licence URL, fetch date, zip sha256, paths under `apps/game/assets/`.

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — U7 viz Stage 6d ONLY (replace / densify lobby and soft-zone
plants with Kenney Nature Kit CC0 picks, remapped onto PropKit Plant + existing pot
colours). Freedom on HOW. No freedom on constraints.
This is NOT 6a/6b/6c rework, NOT ship packaging, NOT U6 Arc, NOT dialogue/bridge/MockChain.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-U7-viz-stage6d.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-U7-viz-stage6.md   (§ licence + art bible; 6b skipped)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1, §5–§7)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/CREDITS.md
6. https://github.com/D9-Studio/GameDevOS/blob/main/wiki/cards/public-repo-asset-intake.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- D:\My Git Projects\D9-Studio\GameDevOS
- Godot 4.5.2 standard (not mono) + web templates

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility. No SDFGI/SSR/volumetric fog/lightmaps.
- Licence: Kenney Nature Kit CC0 only for new meshes. Open kenney.nl licence + zip License.txt.
  Record sha256 in CREDITS. Prefer direct zip (not All-in-1 paywall unless already owned).
- Narrative: indoor bank pots / small trees only. No outdoor forest, rocks, camping kits, animals.
- One class: plants. Do NOT swap furniture, heroes, characters, shell, HUD, particles, fonts,
  or Stage 6c surface textures.
- Materials: target +0 unique materials. Remap kit greens → PropKit.palette("Plant"); pots →
  Wood / Cream / MarbleDark. If the kit needs one shared atlas texture, that is one material
  and total with particles must stay ≤ 40. Fail → cut plants, do not open a new slot class.
- Keep footprints, colliders (layer 1 / mask 0), zones, escort waypoints, vault legibility from
  lobby (LED / repeater / clock). Plants must not block manager door gap or vault opening.
- Existing plant nodes to upgrade in place (bank_interior.gd): LobbyPlant0..2 (pottedPlant),
  AOPlant landmark, AODeskPlant, MgrPlant, NameDeskPlant, VaultLedgePlant — replace meshes /
  densify silhouettes; keep collider footprints unless you prove clearance with run_viz_budget.
- bake_static stays; plants that are static merge. No MultiMesh unless bake proves worse
  (lesson: bake-beats-multimesh-for-static-fill).
- Perf (WORLD-3D §6): ≤ 350 draws, ≤ 400k tris, ≤ 40 materials, 1 shadowed light, ≤ 8 omnis,
  `.pck` prefer ≪ 15 MB. Re-run tests/run_viz_budget.gd (+ new 6d section); cut before adding more.
- Name Desk / Petra / ens* / bridge / teller-desk: props only — no wiring changes.
- Do not touch dirty sibling WIP (dialogue, teller-desk lanes, broken run_mock_walk.gd) unless
  you must for compile; prefer path-scoped commits of Stage 6d files only.

OWN:
- apps/game/assets/models/ (nature kit subset; optional retire unused Furniture Kit plantSmall* /
  pottedPlant if fully replaced)
- props.gd / bank_interior.gd plant placement only
- CREDITS.md; docs/progress note for Stage 6d (gitignored tree OK — do not force-add JPGs)

AVOID:
- Quaternius, Mixamo, VNB, MrEliptik, KayKit Adventurers
- Photoreal leaf cards / alpha-heavy foliage that kills Compatibility fill rate
- New OmniLight / shadowed lights
- Character / hero / shell / HUD / feel / fonts / surface_pack albedo rework

SEQUENCE:
0. Record 6c baselines from run_viz_budget (draws, mats, tris, .pck if you export). Confirm
   run_checks + run_viz_budget green on current main.
1. Fetch https://kenney.nl/assets/nature-kit — verify CC0 + License.txt + sha256.
2. Import a small subset (potted plants / indoor shrubs only). Remap to PropKit.
3. Swap LobbyPlant* + AO landmark first; then desk / vault ledge pots if budget allows.
4. bake_static; measure; if over gate → remove densest offenders.
5. Extend run_viz_budget with a "plants (Stage 6d)" section (files + licence + baked + clearance).
6. Progress note + captures (local); CREDITS. Stop. Do not start ship packaging.

DoD (Stage 6d):
- Lobby (and preferably AO landmark) plants read denser than Furniture Kit pottedPlant, still
  art-deco / indoor.
- Every new file in CREDITS with licence URL + sha256.
- WORLD-3D §6 gates green; materials with particles ≤ 40; vault still legible from lobby.
- run_checks + run_viz_budget PASS. (If run_mock_walk is broken by sibling dirt, note it — do
  not expand scope to fix unrelated parse errors unless one-line and OWN.)
- HANDOFF unit unchanged.
```

---

## Shortlist

| Pack | Use | Licence |
|------|-----|---------|
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | Potted / indoor plant meshes only (subset of 330+) | **CC0** — already trusted vendor in CREDITS |

**Reject:** camping gear, rocks, terrain, trees meant for outdoor skyline, anything that needs alpha cutout sheets at web scale.

**Fallback if Nature Kit style clashes:** keep Furniture Kit `pottedPlant` / `plantSmall*` and stop — record "6d no-op, style reject" in the progress note. Do not force a bad fit.

---

## Out of scope

Ship packaging, Cloudflare deploy, U6 Arc faucet, dialogue, bridge bumps, 6b revisit, character swap, hero re-cut, shell rewrite, fixing unrelated dirty `run_mock_walk.gd` / teller-desk WIP.
