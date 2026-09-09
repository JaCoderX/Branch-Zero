---
title: Kickoff prompt — KayKit bank jacket / shirt (robe-off) — paste to same agent
created: 2026-09-09
product: Branch-Zero
model: same agent as ENG-2026-0016 (Claude Code / Codex) — keep GameLab + Branch-Zero roots
handoff: docs/missions/HANDOFF-kaykit-bank-jacket.md
lab: ../GameLab/work/ENG-2026-0017-kaykit-bank-jacket/
prior: ../GameLab/work/ENG-2026-0016-kaykit-bank-wardrobe/
---

# Kickoff prompt — robe-off / bank jacket silhouette

Paste into the **same** session that ran ENG-2026-0016 (or a dual-root session with GameLab write + Branch-Zero read).
Do **not** land Branch-Zero cast until principal accepts the jacket board.

**What this is:** Follow-on to ENG-0016. Accessories are solved. Principal liked the wardrobe board as a **start** but
wants the **robes / long tunics removed** — Rung B body silhouette toward art-deco **jacket / shirt / waistcoat**.

**Why:** Hide+paint cannot delete a robe; the robe *is* `Mage_Body` / Ranger tunic shells. Need shell edit + UV remap
(+ optional light remesh), keep Rig_Medium, ≤5 body mats.

**Parallel:** Load Account / ship packaging — do not touch.

---

## Reflect

| Fact | Implication |
|------|-------------|
| ENG-0016 answered Yes | Quiver/hat/mask/bear hide; Kenji_bank + Okafor_bank proven; do not re-census from zero |
| Principal | "look good for start" + "remove the robes" |
| Product | Bob only on main; 0016 not landed — jacket ENG may land together with hide list later |
| Caps/captures | Laptop-local under ENG-0016 `captures/` (gitignored) — still on disk for comparison |

---

```text
You are continuing the KayKit bank cast work. Prefer ENG-0016 artefacts + this kickoff over guessing.

MISSION: GameLab ENG-2026-0017 — KayKit BANK JACKET / SHIRT (robe-off). Replace Adventurers robe/tunic/cape
body silhouettes with art-deco bank daywear (jacket, shirt, waistcoat; cape → short livery scarf or drop)
while keeping Rig_Medium Idle_A / Walking_A / Waving and ≤5 body materials. Creative silhouette OK.
Principal accepted ENG-0016 accessory strip as a strong start but rejects long robes/tunics as bank dress.
Freedom on HOW in the ENG-0017 folder. No Branch-Zero product cast land this pass.

BEFORE WORK — read in order:
1. Branch-Zero docs/missions/HANDOFF-kaykit-bank-jacket.md
2. Branch-Zero docs/missions/KICKOFF-kaykit-bank-jacket.md  (this file)
3. GameLab work/ENG-2026-0017-kaykit-bank-jacket/README.md
4. GameLab work/ENG-2026-0016-kaykit-bank-wardrobe/findings.md
5. GameLab work/ENG-2026-0016-kaykit-bank-wardrobe/census/census.md
6. GameLab work/ENG-2026-0016-kaykit-bank-wardrobe/handoff.md  (principal robe note)
7. ENG-0016 scripts/build_variant.py, paint_wardrobe.py, board_*.py — reuse, do not reinvent
8. Branch-Zero props.gd KAYKIT_* + kaykit_bank_variants.py (read-only)
9. GameLab docs/ENGAGEMENT.md · policy/hard-stops.md · policy/isolation.md

Local roots:
- Lab writes: D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0017-kaykit-bank-jacket\
- Prior artefacts (read/copy scripts/assets as needed):
  D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0016-kaykit-bank-wardrobe\
- Product read-only: D:\My Git Projects\D9-Studio\Branch-Zero
- Board reference (gitignored, on disk): ENG-0016 captures/board/_sheet_ward.png · _zoom_hard.png

HARD RULES:
- Work inside ENG-0017 (may copy assets/scripts from 0016 into 0017; no cross-folder runtime refs).
- Do not commit Branch-Zero mesh/texture product changes this pass.
- Keep Rig_Medium bone names/skinning. Anim proof required on every body you reshape.
- Blender 4.5.5 via run-host.ps1; scripts use $env:ENG_ARGS (PowerShell eats bare --).
- Godot 4.5.2 Compatibility for anim proof when needed.
- CC0 KayKit derivatives only. ≤5 body albedos.
- Kill: jacket read impossible without breaking skinning / 6th albedo / losing KayKit cheer → stop, write findings.
- Time box: Mage spike first; do not remesh all eight before principal sees Mage board.
- Append GameLab log.md; update work/index.md on open/close.
- Prefer shell-delete + UV remap + light vertex edit over full remesh; reuse Kenji head-graft / Okafor UV lessons.

OWN: ENG-0017 tree (board stills, jacket glbs, findings, optional handoff).
AVOID: Branch-Zero apps/game land; room; dialogue; Load Account; redoing 0016 accessory census from scratch.

SEQUENCE:
0. Open ENG folder if needed; copy Adventurers + 0016 wardrobe sheets + anim libs; provenance hashes.
1. BOARD — ENG-0016 ward row vs first Mage jacket trials (front / 3q / side / back).
2. MAGE SPIKE — shorten/rebuild robe shells into jacket+lower; export; joint/weight check; Idle/Walk/Wave proof.
3. PAUSE — principal look at Mage board (robe vs jacket). If kill → findings No/It depends.
4. ROLL — same recipe to Ranger (Mo/player), then Rogue/Kenji, Bob refine, Okafor refine.
5. FINDINGS — per-role table; proposed land (glbs + sheets + hide list from 0016).
6. STOP — principal accept → separate Branch-Zero land kickoff (may combine 0016 hide + 0017 jackets).

DoD (lab):
- Written answer in findings.md.
- Mage jacket board + anim proof minimum.
- Re-run recipe documented; Branch-Zero untouched this pass.
- index.md + log.md updated.

OUT OF SCOPE: Shipping robes-as-coats from 0016 as final dress; Mad Men photoreal; new third-party packs; room art.
```

---

## After a Yes

Land kickoff combining ENG-0016 `KAYKIT_HIDE_PARTS` (+ Kenji/Okafor glbs if still needed) with ENG-0017 jacket derivatives and sheet updates. Until then product stays Bob-only (`044f934`).
