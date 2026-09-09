---
type: handoff
title: Handoff — KayKit bank jacket / shirt silhouette (robe-off)
audience: cold agent continuing ENG-0016 context (or fresh with this brief)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Replace Adventurers robe/tunic/cape body silhouettes with art-deco bank daywear (jacket, shirt, waistcoat) while keeping Rig_Medium and ≤5 body mats — lab-first after ENG-0016 accessory strip
plan: this file §Direction; work in ENG-2026-0017
kickoff: docs/KICKOFF-kaykit-bank-jacket.md
baseline: ENG-2026-0016 Yes (hide accessories + Kenji/Okafor glb paths); principal — board good start but robes must go; Bob land 044f934 live; full 0016 wardrobe sheets not landed
lab: ../GameLab/work/ENG-2026-0017-kaykit-bank-jacket/
prior_lab: ../GameLab/work/ENG-2026-0016-kaykit-bank-wardrobe/
parallel_to: Load Account / ship packaging
---

# Handoff — KayKit bank jacket / shirt (robe-off)

You are a **cold agent**. Prefer this file + kickoff + ENG-0016 findings/census over chat memory.
Reuse ENG-0016 scripts, census, and hard-body recipes. Do **not** silent-land Branch-Zero.

**Authorized construction:** Rung B silhouette work — the robe/tunic/cape **is** the body mesh (not a hideable node).
Shorten / rebuild shells and UV-remap toward **shirt + jacket / waistcoat** art-deco lobby daywear. Capes → optional
short livery scarf or drop. KayKit-cute faces stay. Creative freedom OK.

**Principal (2026-09-09):** ENG-0016 wardrobe board is a strong start; wants the **robes removed**.

**Where:** GameLab [`ENG-2026-0017-kaykit-bank-jacket`](../../GameLab/work/ENG-2026-0017-kaykit-bank-jacket/README.md).

**Not this mission:** Room / dialogue; Mixamo; Mad Men photoreal; redoing accessory census (done in 0016).

---

## Outcome (landed 2026-09-09)

Principal accepted Mage/Ranger lobby boards + approved CC review (prefer `_nocape`, keep Bob cape). Product land on Branch-Zero:

- Vendored six CC0 jacket glbs into `kaykit_adventurers/Characters/`
- `PropKit.KAYKIT_MESHES` → jacket stems; `KAYKIT_HIDE_PARTS` empty; wardrobe sheet diffs in `kaykit_bank_variants.py`
- Gates: `smoke_kaykit_cast` / `run_checks` / `run_viz_budget` PASS

---

## Baseline

| Item | State |
|------|--------|
| ENG-0016 | Accessories hideable; Kenji head graft + Okafor UV cloth proven; anim 0 delta |
| Product | Bob helm/navy only (`044f934`); 0016 hide/sheets **not** landed |
| Hard fact | Mage_Body robe = body shells; Ranger tunic = body; cannot part-delete a "robe node" |
| Mats | Still ≤5 body albedos; spare cells + remaps OK |

---

## Direction

| Priority | Body | Target |
|----------|------|--------|
| 1 | Mage (Ines / Petra) | Biggest robe read → desk jacket + lower cloth or skirt length that reads office, not wizard |
| 2 | Ranger (Mo / player) | Tunic length → short coat / shirt + sash; cape → scarf or drop |
| 3 | Rogue / Kenji | Already closer; shorten tunic if still robe-like; keep teal/oxblood accents |
| 4 | Knight (Bob) | Navy guard already; optional softshoulder / less gauntlet flare |
| 5 | Okafor | Waistcoat path from 0016 — refine if still “wrap/robe” |

Reuse: head grafts, per-bone UV remap, shell-delete (pouches), `build_variant.py` patterns from ENG-0016.

---

## Lab sequence (ENG-2026-0017)

1. Board — current 0016 ward vs jacket trials (Mage first).
2. Spike Mage jacket silhouette; export glb; anim proof Idle/Walk/Wave.
3. Roll recipe to Ranger → Rogue → Bob refine → Okafor refine.
4. Findings + handoff; pause for principal before product land (may combine with 0016 hide list).

---

## Out of scope

Landing without board accept; full new character pack; dialogue; room.
