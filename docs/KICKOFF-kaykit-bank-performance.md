---
title: Kickoff prompt — KayKit bank performance (animation / idle)
created: 2026-09-09
product: Branch-Zero
model: Claude Code or Codex Luna xhigh — dual-root GameLab write + Branch-Zero (Stage 0 may touch product)
handoff: docs/HANDOFF-kaykit-bank-performance.md
lab: ../GameLab/work/ENG-2026-0018-kaykit-bank-performance/
prior: ../GameLab/work/ENG-2026-0017-kaykit-bank-jacket/
---

# Kickoff prompt — KayKit bank performance (animation)

Paste into a **new** session (dual-root: GameLab write for ENG-0018; Branch-Zero for Stage 0 diagnose / optional wiring hotfix).

**What this is:** Follow-on to the landed jacket cast. Wardrobe is closed. Principal wants **bank motion** — idle no longer reads as arms-spread / T-pose rest.

**Why:** Lab anim proof only checked bone-delta after mesh edits. Product still plays Adventurers `Idle_A` (and friends). That is a performance gap, not a mesh gap.

**Parallel:** Load Account / ship packaging — do not touch.

---

## Reflect

| Fact | Implication |
|------|-------------|
| Jacket land `fec5aa1` | Live meshes are `*_jacket_*`; do not remesh |
| Principal | Cast look OK; animation next — "base stance with hands spread" |
| `KAYKIT_CLIP_SRC` | idle←Idle_A · walk←Walking_A · work←Interact · greet←Waving · refuse←Hit_A · sprint←Running_A |
| Lab vs product AnimationPlayer | Product wants `root_node = "."`; lab sometimes used `".."` — diagnose before baking clips |
| Tools library | Not vendored yet; intake only if Stage 1 needs it and CC0 redistribution is green |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: KayKit BANK PERFORMANCE — make the landed jacket cast move like bank staff.
Stage 0: diagnose whether "hands spread" is dead animation tracks (T-pose) or Adventurers Idle_A (authoring).
If wiring: fix PropKit in Branch-Zero (tiny), smoke, export:web.
If authoring: open GameLab ENG-2026-0018, pick/remap/bake bank-readable clips on Rig_Medium, board for principal, do not silent-land new clips until board accept.
Freedom on HOW inside the ENG (and on the Stage 0 hotfix). No freedom to remesh jackets, touch the room, or steal Load Account.

BEFORE WORK — read in order:
1. Branch-Zero docs/HANDOFF-kaykit-bank-performance.md
2. Branch-Zero docs/KICKOFF-kaykit-bank-performance.md  (this file)
3. Branch-Zero apps/game/scripts/props.gd — character_kaykit, _kaykit_ensure_anim_player, _kaykit_install_bank_clips, KAYKIT_CLIP_SRC, KAYKIT_MESHES
4. Branch-Zero apps/game/scripts/npc.gd + player.gd — when idle/walk/greet/work play
5. Branch-Zero apps/game/tests/smoke_kaykit_cast.gd
6. GameLab work/ENG-2026-0017-kaykit-bank-jacket/findings.md (anim proof was bone-delta only)
7. GameLab docs/ENGAGEMENT.md · docs/SANDBOX.md · policy/hard-stops.md · policy/isolation.md
8. GameDevOS wiki/cards/kitbash-cast-wardrobe-ladder.md (wardrobe closed — do not reopen)

Local roots:
- Product: D:\My Git Projects\D9-Studio\Branch-Zero
- Lab ENG (create if Stage 0B): D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0018-kaykit-bank-performance\
- Prior jacket artefacts: D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0017-kaykit-bank-jacket\
- Godot 4.5.2: %LOCALAPPDATA%\Programs\Godot-4.5.2\ (console for headless; editor for feel)
- Blender 4.5.5 host only if baking a derivative idle: GameLab runtimes/blender/scripts/run-host.ps1 ($env:ENG_ARGS)

HARD RULES:
- Stage 0 first. Do not open a remesh or new character pack.
- Keep Rig_Medium bone names and skinning. Jacket glbs stay.
- ≤5 body albedos. CC0 KayKit (or CC0 derivative clips) only.
- If product wiring hotfix: keep diff minimal; extend smoke to prove idle is not bind/T-pose; run_checks + run_viz_budget; npm run export:web.
- If ENG-0018: work inside that folder only for lab artefacts; Branch-Zero cast land of new clips needs principal board accept + separate land note.
- PowerShell: no bare -- before run-host.ps1; capture with *>.
- Kill: no bank-readable idle without breaking skinning / cheer / mat budget → findings No.
- Time box Stage 0: same day. Time box Stage 2 board: Idle candidates for 2–3 roles before baking all eight.
- Append GameLab log.md + work/index.md when ENG opens/closes. Append Branch-Zero docs outcome when landing.

OWN:
- Stage 0A: PropKit AnimationPlayer ownership / root_node + smoke
- Stage 0B/2: ENG-0018 README, clip census, idle board, optional baked Idle, findings, handoff
AVOID: jacket remesh; room; dialogue; Mad Men face sheet; Mixamo/Quaternius; Load Account; ship packaging

SEQUENCE:
0. DIAGNOSE — run desktop or web lobby; confirm current_animation; compare stock vs jacket; inspect AnimationPlayer.root_node on character_kaykit path; note verdict A (wiring) / B (authoring) / both.
1. If A — fix _kaykit_ensure_anim_player to always use a product-owned player with root_node "."; reinstall bank clips; smoke + export:web; stop for principal feel check.
2. If B — mint ENG-2026-0018 from template; census clips in vendored Rig_Medium_* (+ Tools only if intake approved); board Idle_A vs Idle_B vs candidates on jacket bodies.
3. SPIKE — remap KAYKIT_CLIP_SRC in lab harness (or bake minimal bank idle in Blender, same bones); Godot proof idle/walk/greet on Mo + Ines + Bob.
4. FINDINGS — clip table; wiring notes; proposed product KAYKIT_CLIP_SRC; CREDITS if new files.
5. STOP — principal accept idle board → land kickoff (or land Stage 0A alone if that fixed the feel).

DoD:
- Written Stage 0 verdict (A/B/both) with evidence.
- If A landed: smoke PASS + web export refreshed; principal can feel lobby idle.
- If B: findings.md + idle board stills/clips + re-run recipe; Branch-Zero new clips not landed until accept.
- index.md + log.md updated for any ENG.

OUT OF SCOPE: Reopening wardrobe/robe-off; new NPCs; combat anim packs; room art.
```

---

## After a Yes

- **0A only:** done when lobby idle no longer reads as T-pose; document in HANDOFF outcome.
- **0B / ENG-0018:** file a short Branch-Zero land kickoff for `KAYKIT_CLIP_SRC` (+ any new CC0 clip files) + smoke bone-pose assert + `export:web`.
