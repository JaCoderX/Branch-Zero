---
type: handoff
title: Handoff — KayKit bank variants (base Adventurers → role-readable cast)
audience: cold agent (Codex Luna / Claude Code — Opus not required)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Keep the locked KayKit Adventurers cast vibe; author bank-readable variants (texture / accessory / light mesh) so each role reads as that job without Mad Men realism or new third-party kits
plan: this file §Direction + wardrobe sheet
kickoff: docs/KICKOFF-kaykit-bank-variants.md
baseline: KayKit Stage 3 lock 2026-09-09 (USE_KAYKIT_CAST, shared ≤5 body albedos, gates green)
parallel_to: Load Account / ship packaging — do not steal those product missions
supersedes_in_part: docs/HANDOFF-character-charm.md (Mad Men wardrobe + Kenney face sheet are no longer the live cast direction)
---

# Handoff — KayKit bank variants

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**.
No freedom on constraints, scope, or protocol semantics.

**Authorized construction:** derive **bank-readable variants** from the free KayKit Adventurers bases already
vendored and wired (`PropKit.USE_KAYKIT_CAST`). Soft fantasy is allowed — the principal locked cute KayKit vibes
over mid-50s dress code. Room, furniture, heroes, HUD, particles, lighting: **untouched**.

**Kickoff (paste):** [`docs/KICKOFF-kaykit-bank-variants.md`](./KICKOFF-kaykit-bank-variants.md)

**Not this mission:** Load Account, ship packaging, partners board, Arc, dialogue/bridge, room rebuild, new NPCs,
new third-party character packs, reverting to Kenney as the live cast (Kenney stays in-tree for revert only).

---

## Principal intent (verbatim gist, 2026-09-09)

1. Stock KayKit Adventurers in the bank **feel right** — keep that vibe; do not perfect Kenney charm further.
2. Soft fantasy in an art-deco bank is **OK** if the game stays fun to interact with.
3. Ideal next state: **use those base characters and create variants that fit the bank story** (roles readable).
4. Prefer an external cold agent with a full handoff + kickoff (this pair), not an open-ended chat.

---

## Baseline (Stage 3 lock — do not regress)

| Item | State |
|------|--------|
| Live cast switch | `PropKit.USE_KAYKIT_CAST := true` in `apps/game/scripts/props.gd` |
| Assets | `apps/game/assets/characters/kaykit_adventurers/` — Characters glTF + `Rig_Medium_{General,MovementBasic,Simulation}.glb` + licences (~4.6 MB) |
| Role → mesh | greeter/player→Ranger, clerk/registrar→Mage, teller→Rogue, vault_keeper→Knight, manager→Barbarian, dealer→Rogue_Hooded |
| Clips | Bank aliases: idle←Idle_A, walk←Walking_A, sprint←Running_A, greet←Waving, work←Interact, refuse←Hit_A |
| Materials | ≤ **5** shared body albedos via `PropKit.kaykit_body_material` (Rogue + Rogue_Hooded → `rogue_texture`); mesh mats ≤ 40; with Stage 5 particles ≤ **42** |
| Faces | Painted on KayKit textures — **no** Kenney face sheet / outline required on this path |
| Gates | `run_checks` / `run_viz_budget` / `tests/smoke_kaykit_cast.gd` green at lock |
| Art bible | WORLD-3D §1 Cast row = KayKit Adventurers soft fantasy; room cream / brass / deep green unchanged |
| Kenney staff | `apps/game/assets/characters/kenney_staff/` + `character_kenney()` kept for revert — do not delete this pass |

---

## What “bank variant” means (ladder)

Cheapest first. Stop at the lowest rung that meets DoD.

| Rung | Work | When |
|------|------|------|
| **1. Texture / palette** | Recolour Adventurers PNGs toward bank cream / brass + **one accent per role**; soften neon fantasy loudness | Default first pass **(assumed)** |
| **2. Accessory edit** | Hide or remove weapons, quiver, oversized staff/orb from default posed meshes (or separate “bank idle” meshes) | If roles still read as dungeon party at 15 m |
| **3. Light mesh trim** | Soften armor / cape / hood only where needed for teller / registrar readability | Only if 1–2 fail DoD; keep Rig_Medium |
| **Out** | New adult humanoids, Mixamo, Quaternius into public MIT, Mad Men suit remesh from scratch, room rebuild | Forbidden |

**Do not** collapse back to one Kenney atlas + face sheet unless the principal flips `USE_KAYKIT_CAST` false.

---

## Direction (decided / assumed)

| Knob | Change | Where |
|------|--------|--------|
| **Base** | Keep KayKit Rig_Medium + Adventurers silhouettes | `kaykit_adventurers/Characters/*.glb` |
| **Variants** | Per-role derivative textures (and optional accessory-stripped glbs) | New tool under `apps/game/tools/` **or** GameLab `ENG-*` then land derivatives here **(assumed: GameLab spike first for mesh edits)** |
| **Palette rule** | Room owns cream / brass / deep green; each person owns **one** saturated accent (can sit on cape, trim, scarf, hood, tie-like stripe — fantasy-allowed) | Variant textures |
| **Materials** | Still ≤ 5 unique body albedos after variants (share sheets where two roles share a mesh family, or pack into ≤5 PropKit keys) | `PropKit.kaykit_body_material` / `KAYKIT_TEXTURE_FILES` |
| **Anims** | Keep bank clip aliases; may add Tools library clips later — not required for DoD | `KAYKIT_ANIM_FILES` |
| **Gaze / greet** | Already wired (`head` bone, Waving) — preserve | `npc.gd` / `player.gd` |

### Per-role bank-read sheet (start here)

| Role | Name | Keep silhouette of | Bank read | Accent (suggested) |
|------|------|--------------------|-----------|---------------------|
| greeter | Mo | Ranger | Open / friendly lobby face | emerald |
| clerk | Ines | Mage | Account Opening — “desk mage”, softer robe | mustard |
| teller | Dev | Rogue | Counter hustle | oxblood |
| vault_keeper | Bob | Knight | Security / vault guard (armor OK if it reads guard) | brass / coral |
| manager | Mr. Okafor | Barbarian | Presence / boss | oxblood |
| registrar | Petra | Mage (alt tint of Ines’s body) | Name Desk — distinct from Ines | coral |
| dealer | Kenji | Rogue_Hooded | FX desk | teal |
| player | — | Ranger (alt tint of Mo’s body) | Customer “you” | navy / camel |

Taste may move accents; do not break “one accent + room owns the neutrals.”

---

## Hard gates

| Gate | Note |
|------|------|
| Godot **4.5**, web, threads OFF, Compatibility | No Forward+, no blendshape face rigs |
| Draws ≤ 350 · tris ≤ 400k · mesh mats ≤ 40 · mesh+particles ≤ 42 · 1 shadowed light | `run_viz_budget.gd` |
| `.pck` ≪ 15 MB | Prefer keeping Adventurers textures tiny / ≤ 1024² |
| Public MIT → true **CC0** | Derivatives of Kay Lousberg KayKit only; CREDITS + sha256 |
| Cast-only | Room / KayKit furniture / Nature Kit / heroes byte-stable |
| Capsules / escort / dialogue graphs | Unchanged |

---

## Lab vs product **(assumed)**

1. **GameLab** `ENG-YYYY-NNNN-kaykit-bank-variants`: Blender experiments, before/after stills, kill criterion = “roles readable at 15 m without losing cute.”
2. **Scrub** → land only redistributable CC0 derivatives into Branch-Zero `kaykit_adventurers/` (or `kaykit_staff/` if cleaner).
3. Wire PropKit paths + CREDITS; gates green; stop.

If the agent works only in Branch-Zero: headless Blender 4.5 tools mirroring `bank_staff_*.py` are fine — still cast-only.

---

## Craft / intake (do not relearn)

- GameDevOS card [`public-repo-asset-intake`](../../GameDevOS/wiki/cards/public-repo-asset-intake.md)
- Lessons: `style-the-cast-separately-from-the-set`, `asset-must-fit-the-world-not-just-the-licence`, `complexity-is-not-charm`, `atlas-skins-to-one-material` (mat budget still applies even without one atlas)
- Prior climbs: [`HANDOFF-character-style.md`](./HANDOFF-character-style.md), [`HANDOFF-character-charm.md`](./HANDOFF-character-charm.md) — **pipeline history**; wardrobe direction here **supersedes** Mad Men as the live cast goal

---

## DoD

See [`KICKOFF-kaykit-bank-variants.md`](./KICKOFF-kaykit-bank-variants.md) DoD block.

---

## Outcome (2026-09-09) — Pass A met; Pass B / C not needed

**Rung reached:** 1 (texture / palette). Roles read at the lobby cam by silhouette + accent without touching a mesh.

| Item | Result |
|------|--------|
| Derivatives | `Characters/*_bank_texture.png` × 5 from `tools/kaykit_bank_variants.py` (cell recolour, gradients kept; skin / eyes untouched); originals kept beside them as the tool's input |
| Shared bodies | Petra / player / Kenji tinted by **UV cell remap** into spare bottom-row cells (`PropKit.KAYKIT_ROLE_CELLS`, `_kaykit_role_mesh`, cached per mesh × role) — no sixth material |
| Accents | Mo emerald · Ines mustard (slate robe) · Dev oxblood · Bob coral cape on dark steel + brass · Okafor oxblood sash + brass straps · Petra coral on deep green, copper hair · Kenji teal hood / mask · player navy on graphite, dark hair |
| Gates | `run_checks` PASS · `run_viz_budget` PASS — 39 mesh mats (41 with particles), 5 body materials, 118k tris whole building; `smoke_kaykit_cast` PASS · worst `viz_shots` view 308 draws (21_vault_west, unchanged class) |
| Stills | laptop-local `docs/progress/captures/2026-09-09-kaykit-bank-variants/` (before / after lobby 15 m, role frames) |
| Untouched | Room, furniture, heroes, HUD, particles, lighting, dialogue, colliders, clip names, Kenney revert path |

**Accessory debt (Pass B, not taken):** the Ranger quiver stays on Mo and the player (recoloured leather + accent);
the Knight helmet + visor stay on Bob (reads as a guard). No weapons were vendored, so nothing else to hide. Take
Pass B only if the principal wants the quiver gone — it is a Blender part-delete on `Ranger.glb` with the rig kept.

## Out of scope

Room / heroes / HUD; new NPCs or lines; yellow-licence kits; Quaternius / Mixamo; Kenney charm face sheet revival; Arc; ship packaging; Load Account; Complete KayKit paid Mystery Series unless principal explicitly buys and re-licences intake.
