---
type: handoff
title: Handoff — Character charm (faces, proportions, mid-50s wardrobe)
audience: cold agent (Codex Luna / Claude Code — Opus not required)
created: 2026-09-08
product: Branch-Zero
objective: OBJ-2026-0004
mission: Make the bank-staff cast read as inviting people — legible faces with expression, cartoon proportions, mid-50s "Mad Men" dress in a Cartoon Modern language; room unchanged
plan: this file §Research + §Direction
kickoff: docs/missions/KICKOFF-character-charm.md
baseline: Character style climb met 2026-09-08 (Kenney Animated Characters rig, one atlas + outline, gates green)
parallel_to: Load Account / ship packaging — do not steal those product missions
supersedes_in_part: docs/missions/HANDOFF-character-style.md (rig + atlas pipeline stay; look direction changes)
---

# Handoff — Character charm

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**.
No freedom on constraints, scope, or protocol semantics.

**Authorized construction:** re-author the **cast only** (seven staff NPCs + player) on the rig and pipeline the
character-style climb built, so the people read as *inviting* rather than *dull*: legible faces with a small
expression set, cartoon head-to-body proportion, and a mid-50s bank dress code drawn in a **Cartoon Modern**
(UPA / Mary Blair / Saul Bass) language. Room, heroes, HUD, particles, lighting recipe: **untouched**.

**Kickoff (paste):** [`docs/missions/KICKOFF-character-charm.md`](./KICKOFF-character-charm.md)

**Not this mission:** Load Account, ship packaging, partners board, Arc, dialogue/bridge, room rebuild, new NPCs.

---

## Principal intent (verbatim gist, 2026-09-08)

1. The new cast is "a lot better" as visualisation — **keep the climb**, do not revert to Blocky.
2. But the people feel **boring and flat / dull**; the Blocky cast "had simplicity but a certain charm."
3. This is a **UX and vis** issue, not a mesh-complexity issue.
4. Borrow a **Mad Men / mid-50s dress code** to fit the art-deco bank narrative.
5. **Pay attention to facial expression.** It is a bank, but the characters should look **inviting to interact with**.

---

## Research (2026-09-08) — learnings to carry

### Diagnosis: why "dull" (read off the atlas + captures)

| Symptom | Cause in the shipped build | What Blocky had by accident |
|---|---|---|
| Faces do not read | Kenney Protagonists faces are two dot eyes + a line mouth, authored for a skater/shooter at 1024²; now on a ~7-heads-tall body in a 340 px tile. At the over-the-shoulder camera the face is ~20–30 px | Big flat head plane; eyes proportionally 3–4× larger → legible from across the lobby |
| Everyone is the same person | One mesh, one silhouette, height ±5 cm only; five source faces for eight roles; every uniform is graphite / deep-green / brass — the **room's** palette — so the cast dissolves into the walls | Chunky figures in red / teal / purple shirts popping off cream marble |
| Nobody is inviting | Generic shooter idle; no gaze in IDLE; no facial state; uniform 1.3 cm outline on everything flattens rather than accents | Toy read → forgiven and liked |

Craft rule confirmed by the appeal / shape-language literature: **faces and hands carry appeal; at 7–8 heads tall,
facial detail and expression are at a disadvantage** unless the camera goes to close-ups. The climb moved *toward*
adult proportion and paid for it. "More complex" is not the same knob as "more charming."

### Style vocabulary that fits both the bank and the wardrobe: Cartoon Modern

- Fifties animation design (UPA, Mary Blair, Saul Bass, Jim Flora, Cliff Roberts): flat graphic shapes,
  off-centre construction, **limited palette with one saturated pop**, confident line, minimal shading.
- It is contemporary with the wardrobe the principal wants, it is what a Compatibility flat-shaded web build
  renders honestly, and it sits closer to an art-deco bank than Borderlands grit ever did.
- Proposed **character bible line** (add to WORLD-3D §1 as a *cast* row, room row unchanged):
  *"Cast: Cartoon Modern — flat graphic faces with large readable eyes, ~5.5-heads proportion, one accent colour per
  person, ink outline on cast only. Room stays low-poly flat-shaded cream / brass / deep green."*

### Mid-50s → early-60s bank dress code (verified against period and Mad Men style guides)

| Who | Period-accurate | Pop accent (one per person) |
|---|---|---|
| Men, front office | Charcoal / navy / grey two-piece, white shirt, **narrow tie**, tie bar, pocket square, black shoes | Tie colour |
| Men, clerks / back office | Brown or mid-grey suit, sleeves rolled at the desk, waistcoat acceptable | Tie or braces |
| Women | Sheath or A-line dress, skirt suit, cardigan, cat-eye glasses, hair up; jewel tones (emerald, mustard, coral, navy) | Dress or cardigan |
| Hierarchy cue (period-true) | Manager darkest suit; tellers grey; clerks brown | — |

Palette rule: **the room owns cream / brass / deep green; each person owns one saturated accent.** That one rule
separates the cast from the set without touching the set.

### Facial expression on a low-poly web cast — Compatibility-safe

- Industry-standard indie technique in Godot 4: a **face sprite sheet** swapped by `uv1_offset` on a
  `StandardMaterial3D` (animation track set to **Discrete**) or by a two-line face-swap shader with an
  `instance uniform int frame`. No blendshapes, no Forward+, no per-character material.
- Carrier options (either is fine — kickoff leans **quad**):
  - **Face quad** parented to the `Head` bone (`BoneAttachment3D`), `cast_shadow` OFF, **no** outline `next_pass`,
    alpha-scissor. One shared face material for the whole cast.
  - **Second surface** on the body mesh (split the face triangles in `bank_staff_rig.py`) with the face material.
- Cost: +1 material (38 → **39** of 40; tight but fits) and +1 unshadowed surface per body → ≈ **+8 draws** for the
  cast on the worst view (225 → ~233 ≤ 350).
- Expression set that earns its pixels: `neutral` · `smile` · `talk` · `concern` · `surprised` (+ optional `blink`
  as a timer, not a state). Drive from states already in `npc.gd`: `player_near(true)` → smile; `TALKING` /
  `WORKING` → talk / neutral; `REFUSING` → concern; dialogue open → surprised for ~0.4 s then talk.

### Proportion knob is already in the tool

`bank_staff_rig.py` exaggerates by skin weight (shoulders +20 %, hands +26 %, shoes +20 %). Head scale is the same
mechanism on the `Head` / `Neck` joints. Target **~5.5 heads** (from ~7): head ×~1.35, torso/legs −5 %, hands and shoes
keep their bump. Per-role bone scale (stocky Okafor, slight Petra, tall Bob, round Mo) is a cheap **silhouette
identity** knob the one-mesh cast currently lacks.

### Kits (do not re-litigate)

No CC0 "1950s office" character pack exists. KayKit is fantasy / toy; Quaternius stays yellow (QAL v1); Mixamo /
Synty red. The honest route is the one already built: **Kenney rig + our tools**, but with faces and proportions
*authored*, not inherited. Kenney's Protagonists / Survivors skins ship **SVG sources**, so the kept faces can be
redrawn as vectors rather than sampled.

### Hard gates (unchanged law)

| Gate | Source | Charm-pass note |
|---|---|---|
| Web, threads OFF, **Compatibility** | GODOT / WORLD-3D | Face swap via `uv1_offset` or trivial shader; no blendshape pipelines |
| Draws ≤ 350; tris ≤ 400k; **mats ≤ 40**; 1 shadowed light | WORLD-3D §6 | 38 → 39 mats with the face material; **no** second new material |
| `.pck` prefer ≪ 15 MB (now 2.89 MB) | Stage kickoffs | Face sheet ≤ 512², Basis or lossless whichever is smaller |
| Public MIT → true CC0 | CREDITS | Everything new is our derivative of CC0 Kenney sources |
| Art bible | WORLD-3D §1 | Add the cast row; room row unchanged |
| **New:** face readability | this file | Faces must read at **5 m** (counter cam) and **15 m** (lobby cam) in `viz_shots` |

### Craft lessons already paid (do not relearn)

- [`outlines-alone-are-not-a-style`](../../GameDevOS/wiki/lessons/outlines-alone-are-not-a-style.md)
- [`style-the-cast-separately-from-the-set`](../../GameDevOS/wiki/lessons/style-the-cast-separately-from-the-set.md)
- [`animated-nodes-cost-surfaces-times-passes`](../../GameDevOS/wiki/lessons/animated-nodes-cost-surfaces-times-passes.md)
- [`atlas-skins-to-one-material`](../../GameDevOS/wiki/lessons/atlas-skins-to-one-material.md)
- [`asset-must-fit-the-world-not-just-the-licence`](../../GameDevOS/wiki/lessons/asset-must-fit-the-world-not-just-the-licence.md)
- Card: [`public-repo-asset-intake`](../../GameDevOS/wiki/cards/public-repo-asset-intake.md)

New scrub from this research (GameDevOS):

- [`complexity-is-not-charm`](../../GameDevOS/wiki/lessons/complexity-is-not-charm.md) — face size, proportion and
  one accent colour carry appeal; mesh fidelity does not.

---

## Direction (decided 2026-09-08)

Three knobs on the cast, plus two UX moves. Decisions the principal left to the agent are marked **(assumed)**.

| Knob | Change | Where |
|---|---|---|
| **Proportion** | ~5.5 heads **(assumed; 6.5 is the fallback if the bank reads too childish at the counter)**; per-role bone scale for silhouette identity | `apps/game/tools/bank_staff_rig.py` |
| **Face** | Eight distinct flat vector faces (no reuse), eyes 2–3× current, brows, mouth, cheek dot; per-role expression sheet `neutral / smile / talk / concern / surprised`; **face quad (assumed)** on the `Head` bone with one shared face material | new `apps/game/tools/bank_staff_faces.py`; `PropKit.character`; `npc.gd` / `player.gd` state hooks |
| **Wardrobe** | Mid-50s cuts drawn as graphic shapes (lapel line, narrow tie, pocket square, sheath dress, cardigan, cat-eye glasses); **one accent per role**; hair shapes with real variety | `apps/game/tools/bank_staff_atlas.py` ROLES + region painter |
| **Gaze** | In IDLE while `player_near`, head turns toward the player (clamped ±40°) — `LookAtModifier3D` on the skeleton or a yaw lerp on the `Head` bone pose | `npc.gd` |
| **Greeting beat** | On `player_near(true)` from IDLE: short nod / wave clip once, then back to idle | `bank_staff_rig.py` (author `greet`), `npc.gd` |

**Two passes (assumed):** Pass A = proportion + wardrobe + gaze (measurable on stills); Pass B = faces + expressions +
greeting. Each pass ends with all gates green and the face-readability shots.

### Per-role wardrobe sheet (start here; taste may move colours, not the one-accent rule)

| Role | Name | Cut | Base | Accent | Face / hair note |
|---|---|---|---|---|---|
| greeter | Mo | Grey two-piece, narrow tie, pocket square | mid-grey | **emerald tie** | Round friendly face, big smile default, dark short hair |
| clerk | Ines | Sheath dress, cardigan, cat-eye glasses | deep green dress | **mustard cardigan** | Warm eyes, auburn hair up |
| teller | Dev / Ama | Grey waistcoat over white shirt, sleeves rolled, tie bar | graphite | **oxblood tie** | Alert, brows up; short black hair |
| vault_keeper | Bob | Charcoal uniform jacket, brass buttons, cap optional | charcoal | **brass buttons + coral tie** | Calm, heavy brows, moustache |
| manager | Mr. Okafor | Darkest three-piece, white pocket square | near-black | **oxblood tie** | Grey temples, glasses, measured half-smile |
| registrar | Petra | Skirt suit, blouse bow | navy | **coral blouse** | Precise, small smile, hair in a bun |
| dealer | Kenji | Brown suit, sleeves rolled, braces showing | brown | **teal tie / braces** | Quick grin, slick hair |
| player | — | Camel overcoat over navy | camel | **navy scarf** | Neutral open face (the customer) |

---

## Baseline (do not regress)

- Character style climb **met**: one CC0 skinned humanoid, one 1024² atlas + one outline material, clips
  `idle / walk / sprint / work / refuse`; worst view 225 draws / 222k prims; 38 materials; `.pck` 2,892,816 B.
- `run_checks` / `run_mock_walk` / `run_viz_budget` green before and after.
- Escort, dialogue, capsules, Name Desk wiring, bridge, teller-desk — **untouched**.
- Load Account / Sepolia / treasury / OBSERVER — **untouched**.

---

## DoD

See [`KICKOFF-character-charm.md`](./KICKOFF-character-charm.md) DoD block.

---

## Outcome (2026-09-08) — met

Codex built the cast offline; Godot 4.5.2 gates were run on a host with the official console binary. Local record: `docs/progress/2026-09-08-character-charm.md`.

| Gate | Result |
|------|--------|
| `run_checks` / `run_mock_walk` / `run_viz_budget` | **PASS** |
| Materials | 37 mesh / **39 with particles** ≤ 40 (face sheet is the +1) |
| Cast accounting | 8 face carriers, 1 shared face material, outline intact; ≈ 56 honest character draws with 2 shadow splits |
| Worst viz view | **206** draws / 205k prims (entrance) |
| Readability | `40_face_read_5m_close` (Ines) · `41_face_read_lobby_15m` (Mo) |
| `.pck` | **2,919,012 B** |
| Follow-up fixes | greet interrupt on non-IDLE; face alpha scissor; CREDITS one hash set |

Room / Load Account / chain untouched. Human playtest of gaze + mid-greet dialogue feel still useful; headless gates are green.

---

## Out of scope

Room / furniture / heroes / HUD / particles; new NPCs or lines; blendshape or bone-driven facial rigs; Forward+;
additional character materials beyond the one face sheet; yellow-licence kits in the public tree; Arc; ship
packaging; Load Account / chain work.
