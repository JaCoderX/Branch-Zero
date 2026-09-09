---
title: Kickoff prompt — KayKit full cast bank wardrobe (lab-first)
created: 2026-09-09
product: Branch-Zero
model: Codex Luna xhigh or Claude Code (Opus not required)
handoff: docs/HANDOFF-kaykit-bank-wardrobe.md
lab: ../GameLab/work/ENG-2026-0016-kaykit-bank-wardrobe/
---

# Kickoff prompt — KayKit full cast bank wardrobe

Paste into a **new** session that owns the **GameLab** engagement (or dual-root with GameLab as the write target).
Do **not** land cast changes into Branch-Zero until the principal accepts the ENG cast board + findings.

**What this is:** Lab exploration — strip non-daywear fantasy (hats, caps, quivers, masks, hoods, weapons-kit, bear/raider props)
and retint / lightly soften Adventurers into **art-deco bank staff livery**. Creative wardrobe OK. Keep Rig_Medium.
Bob (`044f934`) is already live; this ENG covers the **rest of the cast** and a coherent cloth language.

**Why:** Principal: Bob is a strong start; extend to all characters; less fantasy, bank-daywear vibes.

**Parallel:** Load Account / ship packaging — do not touch.

---

## Reflect

| Fact | Implication |
|------|-------------|
| Bob land on `main` (`044f934`) | Pattern proven: part-hide + navy cells; product playable |
| ENG-2026-0015 | Quiver / Mage_Hat are separate nodes (board only); Rogue / Barbarian uninspected |
| Five body materials | Sheet + UV remaps only — no sixth albedo |
| Rig_Medium wired | Remesh must not rename bones |
| Creative freedom | Board first; principal picks direction before Rung B remesh spend |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: GameLab ENG-2026-0016 — KayKit FULL CAST BANK WARDROBE. Answer whether we can strip all Adventurers
roles of non-daywear fantasy accessories and transform dress into coherent art-deco bank staff clothing
(KayKit-cute, less fantasy) such that Idle_A / Walking_A / Waving still play — without breaking ≤5 body mats
or Rig_Medium. Creative wardrobe allowed. Principal accepts cast board before any Branch-Zero land of non-Bob roles.
Freedom on HOW in the ENG folder. No freedom to edit Branch-Zero live cast this pass (Bob already landed).

BEFORE WORK — read in order:
1. Branch-Zero docs/HANDOFF-kaykit-bank-wardrobe.md
2. Branch-Zero docs/KICKOFF-kaykit-bank-wardrobe.md
3. GameLab work/ENG-2026-0016-kaykit-bank-wardrobe/README.md
4. GameLab work/ENG-2026-0015-kaykit-artdeco-cast/findings.md (Bob recipe + quiver/hat preview)
5. Branch-Zero docs/HANDOFF-kaykit-artdeco-cast.md (Bob status)
6. Branch-Zero apps/game/scripts/props.gd — KAYKIT_MESHES, KAYKIT_HIDE_PARTS, KAYKIT_ROLE_CELLS, kaykit_bank_variants.py
7. GameLab docs/ENGAGEMENT.md · docs/SANDBOX.md · policy/hard-stops.md · policy/isolation.md

Local roots:
- Lab writes: D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0016-kaykit-bank-wardrobe\
- Product read-only this pass: D:\My Git Projects\D9-Studio\Branch-Zero
- Copy Adventurers glb + textures + Rig_Medium libs into ENG assets/ (hashes match CREDITS); do not mutate product in place

HARD RULES:
- Work inside the ENG folder only. Do not commit Branch-Zero mesh/texture product changes this pass.
- Keep Rig_Medium bone names and skinning. Anim proof required on hard cases (sample set OK).
- Blender 4.5.5 host: GameLab runtimes/blender/scripts/run-host.ps1 — scripts take $env:ENG_ARGS (PowerShell eats bare --).
- Godot proof: 4.5.2 Compatibility when needed; document recipe in ENG README Log.
- CC0 KayKit only. No Mixamo / Quaternius into a future public land without a new intake decision.
- Kill: bank read impossible without breaking skinning / 6th albedo / losing cheer without lobby gain → stop, write findings.
- Or time-box: census + board + one hard-body spike (Barbarian or Rogue_Hooded) fails after one honest pass.
- Append GameLab log.md; update work/index.md on close/hand-off.
- Prefer Rung A (hide + sheet) for product; Rung B remesh only after principal OK on board.

OWN: ENG-2026-0016 tree (census, board stills, sheet drafts, optional soft spikes, findings.md, optional handoff.md).
AVOID: Branch-Zero apps/game product cast land; bank_interior; Load Account; dialogue; room props.

SEQUENCE:
0. Copy needed glbs + textures + anim libs into ENG (provenance table). Reuse ENG-0015 inspect scripts if useful.
1. NODE CENSUS — every MeshInstance3D on Knight/Ranger/Mage/Rogue/Rogue_Hooded/Barbarian; mark hide/paint/remesh.
2. BOARD — stock vs hide-only vs hide+sheet draft for all roles; PAUSE for principal wardrobe direction.
3. WARDROBE SHEETS — draft bank-cloth cells (creative within room neutrals + one accent/role); skin/eyes untouched.
4. HARD SPIKES — Rogue_Hooded (hair under hood?) then Barbarian; optional softshoulder-class elsewhere.
5. ANIM PROOF — Idle_A / Walking_A / Waving on sample set + Bob regression.
6. FINDINGS — per-role answer; proposed KAYKIT_HIDE_PARTS map + sheet diffs; Rung B debt list.
7. STOP — principal accept → separate Branch-Zero land kickoff. No silent merge.

DoD (lab):
- Written answer in findings.md (Yes / No / It depends) with per-role table.
- Node census + re-run recipe documented.
- Cast board stills (stock vs proposed) for all roles used in game.
- Anim proof on hard cases (no broken limbs / obvious weight errors).
- Branch-Zero product cast unchanged this pass (Bob already on main).
- work/index.md + log.md updated when answered.

OUT OF SCOPE: Landing non-Bob meshes into Branch-Zero; remeshing all eight before board accept; Mad Men hard dress
code; new character packs; room art; dialogue; AnimationMixer work-clip warnings (note only).
```

---

## After a Yes

File a Branch-Zero **land** kickoff: extend `KAYKIT_HIDE_PARTS`, regenerate `*_bank_texture.png`, CREDITS sha256, smoke + `run_viz_budget`. Until then only Bob’s art-deco land is live.
