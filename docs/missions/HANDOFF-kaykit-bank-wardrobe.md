---
type: handoff
title: Handoff — KayKit full cast bank wardrobe (lab-first)
audience: cold agent (Codex Luna / Claude Code — Opus not required)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Strip non-daywear fantasy accessories from all KayKit Adventurers roles and retint / silhouette them into a coherent art-deco bank staff wardrobe while Rig_Medium idle/walk/greet keep working — principal accepts lab board before product land
plan: this file §Direction + rung ladder; work in ENG-2026-0016
kickoff: docs/missions/KICKOFF-kaykit-bank-wardrobe.md
baseline: Bob art-deco land on main (044f934) — helm/visor hide + navy plate cells; Pass A sheets for other roles; quiver/hat/mask/hood/bear kit still fantasy
lab: ../GameLab/work/ENG-2026-0016-kaykit-bank-wardrobe/
prior_lab: ../GameLab/work/ENG-2026-0015-kaykit-artdeco-cast/
parallel_to: Load Account / ship packaging — do not steal those product missions
supersedes_in_part: docs/missions/HANDOFF-kaykit-artdeco-cast.md — Bob done; open quest is the rest of the cast + cloth language
---

# Handoff — KayKit full cast bank wardrobe

You are a **cold agent**. Prefer this file + the kickoff + ENG-2026-0016 over chat memory.
Freedom on **how** inside the lab (creative wardrobe). No freedom on silent product land without principal accept of the cast board.

**Authorized construction:** extend the Bob pattern (ENG-2026-0015) across **all** Adventurers bodies used in the bank —
remove hats, caps, quivers, masks, hoods, weapons-kit, bear/raider props that cannot read as normal bank daywear;
retint / lightly soften remaining geometry into **art-deco lobby livery** (KayKit-cute, not Mad Men photoreal).

**Where:** GameLab [`ENG-2026-0016-kaykit-bank-wardrobe`](../../GameLab/work/ENG-2026-0016-kaykit-bank-wardrobe/README.md).
**Product today:** Bob only (`KAYKIT_HIDE_PARTS` + navy knight cells, commit `044f934`). Other roles stay Pass A fantasy silhouettes until this ENG lands.

**Kickoff (paste):** [`docs/missions/KICKOFF-kaykit-bank-wardrobe.md`](./KICKOFF-kaykit-bank-wardrobe.md)

**Not this mission:** Room / HUD / dialogue; Mixamo / Quaternius; paid Mystery Series without principal OK; rewriting NPC lines; fixing unrelated `work`-clip AnimationMixer warnings (note only).

---

## Principal intent (2026-09-09)

1. Bob land is a **strong start** — keep iterating.
2. Extend the transformation to **all characters**.
3. Remove anything that cannot relate to **normal day-to-day bank clothing** (hats, caps, weapons, quivers, …).
4. Dressing should become **acceptable cloth**; creative freedom OK if it matches **bank / art-deco game vibes**, less fantasy.

---

## Baseline (do not regress in product)

| Item | State |
|------|--------|
| Live cast | `PropKit.USE_KAYKIT_CAST` + Pass A `*_bank_texture.png` + `KAYKIT_ROLE_CELLS` |
| Bob | Helm/visor freed; navy cells `(3,0)`/`(4,0)` — `044f934` |
| Gates | Compatibility; ≤5 body albedos; mesh ≤40 / +particles ≤42; draws ≤350 |
| Anims | Rig_Medium bank aliases unchanged |
| Prior | ENG-2026-0015 Yes; Ranger quiver / Mage hat previewed as separate nodes; Rogue / Barbarian **not** inspected |

---

## Direction

### North star

**Virtual art-deco branch staff** — cute KayKit faces and proportions stay. Capes may remain as **house livery**, not wizard kit.

| Role | Base | Drop / soften | Target cloth read |
|------|------|---------------|-------------------|
| Bob vault | Knight | Helm done; plate→tunic paint done; optional softshoulder later | Security / porter — navy + brass |
| Mo / player | Ranger | **Quiver**; adventure leather if it screams kit | Lobby tunic + sash/cape (emerald / navy) |
| Ines / Petra | Mage | **Hat**; mage-orb energy → brass/clasp | Desk coat-dress (slate / deep green) |
| Dev | Rogue | **Mask**, dungeon straps if separate | Teller waistcoat / sleeves — oxblood accent |
| Kenji | Rogue_Hooded | **Hood** (+ mask if any); prove hair under hood | Dealer vest/blazer — teal accent |
| Okafor | Barbarian | **Bear hood / bare chest / raider straps** | Manager presence without raider kit — hardest body |

### Rung ladder

1. **Rung A — part-hide + sheet** (Bob-proven): node census → hide non-bank shells → retint cells toward cloth/wool/office leather. Prefer this for product land.
2. **Rung B — silhouette soften** (lab until accept): radial scale / shell rebuild where paint fails (shoulders, gauntlets, bare chest).
3. **Rung C — new base mesh / pack:** only if A+B cannot get bank read — principal decision.

### Shared-sheet rule

Still **five** body materials. Second tint of Mage / Ranger / Rogue pairs stays on spare cells + `KAYKIT_ROLE_CELLS`. No sixth albedo.

---

## Lab sequence (ENG-2026-0016)

1. **Node census** — all six glbs: mesh names, tris, hide / paint / remesh.
2. **Cast board** — stock vs hide-only vs hide+sheet draft; **pause for principal** wardrobe call.
3. **Wardrobe sheet pass** — extend `kaykit_bank_variants.py` language toward uniform cloth (creative within room neutrals + one accent/role).
4. **Hard-body spikes** — Rogue_Hooded (hair under hood?) → Barbarian → optional softshoulder-class for others.
5. **Anim proof** — sample: Ranger, Mage, Rogue_Hooded, Barbarian + Bob regression; Idle_A / Walking_A / Waving.
6. **Findings + handoff** — per-role hide list for `KAYKIT_HIDE_PARTS`, sheet diffs, which need Rung B.
7. **Stop** — principal accept → separate Branch-Zero land kickoff. No silent merge.

---

## Hard gates (when landing — not yet)

Same as bank-variants / Bob land: Compatibility, CC0 KayKit derivatives only, ≤5 body mats, mesh ≤40 / +particles ≤42,
draws ≤350, capsules / dialogue / clips unchanged, room untouched, CREDITS sha256.

---

## DoD (lab)

See [`KICKOFF-kaykit-bank-wardrobe.md`](./KICKOFF-kaykit-bank-wardrobe.md).

---

## Out of scope

Product land this pass; full remesh of all eight before board accept; Mad Men hard dress code; room art; Load Account.
