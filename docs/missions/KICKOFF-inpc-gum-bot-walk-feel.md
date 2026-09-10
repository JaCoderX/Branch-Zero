---
title: Kickoff prompt — iNPC Gum Bot walk feel (readable gait)
created: 2026-09-11
product: Branch-Zero
model: Codex Luna (+ GameLab Blender for Stage B)
handoff: docs/missions/HANDOFF-inpc-gum-bot-walk-feel.md
prior_lab: ../../GameLab/work/ENG-2026-0022-inpc-gum-bot-walk/
---

# Kickoff prompt — iNPC Gum Bot walk feel

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna** for Stage A + C; open/extend GameLab for Stage B.

**What this is:** make Blox-47's Follow walk **read** at lobby distance (hero-like alternating legs). Skinned land already plays clips; amplitude is the gap.

**Why:** Principal: legs still look frozen while following. Probe 2026-09-11: `root_node=..`, 42/42 tracks OK, but `leg1.l` mid-cycle delta ~**2°** — not a Stage 0A wiring miss.

**Baseline:** [`HANDOFF-inpc-gum-bot-walk.md`](./HANDOFF-inpc-gum-bot-walk.md) **met**. Nameplate strip removed (silhouette = robot only).

**Handoff:** [`HANDOFF-inpc-gum-bot-walk-feel.md`](./HANDOFF-inpc-gum-bot-walk-feel.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Tracks resolve; root_node correct | Do **not** spend the mission re-debugging KayKit `"."` |
| ~2° leg swing | Need Blender re-author (Stage B), not KayKit retarget |
| Hero uses `speed_scale` from ground speed | Stage A should mirror that on InpcProp |
| `_walking` can stay true while settled at rest point | Stage A: idle when ground speed ~0 |
| No root motion in ship glb | Keep escort-lite seek as sole translator |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna (+ GameLab for Stage B).

MISSION: Branch Zero — iNPC Gum Bot walk feel (readable gait like the hero).
(1) Stage A product: inpc.gd — idle when following but ground speed ~0; speed_scale from seek speed; keep seek/screen/phone contracts.
(2) Stage B GameLab: re-author GumBot_Walk on existing Gum Bot Rig with hero-readable amplitude; no root motion; bank lod03 look held; Godot 4.5.2 Compatibility proof strip; ship out/ + sha256.
(3) Stage C product land: swap glb, CREDITS/INPC/OWED, run_inpc_walk, export:web, browser Follow smoke.
Do not retarget KayKit Walking_A. Do not add navmesh or OpenRouter changes.

Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-inpc-gum-bot-walk-feel.md
2. docs/missions/KICKOFF-inpc-gum-bot-walk-feel.md  (this file)
3. docs/missions/HANDOFF-inpc-gum-bot-walk.md (landed baseline)
4. apps/game/scripts/inpc.gd (_sync_animation / _seek)
5. apps/game/scripts/player.gd (_play + speed_scale)
6. docs/INPC.md — Companion follow + Visual
7. GameLab ENG-2026-0022 findings.md (prior Yes; amplitude now rejected by principal eye)

Local roots:
- Product WRITE: D:\My Git Projects\D9-Studio\Branch-Zero\
- Lab WRITE (Stage B): D:\My Git Projects\D9-Studio\GameLab\work\ENG-… (0022 follow-up or new ENG — ask principal if unclear)

HARD RULES:
- Diagnose already done — do not reopen root_node rabbit hole unless a new probe fails.
- No KayKit skeleton retarget onto Gum Bot.
- No root-motion double move. Seek remains the translator.
- Keep Follow non-locking; Sleep = unfollow + home + dormant.
- Never commit secrets.

SEQUENCE:
1. Stage A inpc.gd nits + headless smoke.
2. Principal eye check — if still frozen, Stage B (do not fake it with mesh bob alone).
3. Lab proof strip + ship glb.
4. Stage C land + export:web + browser Follow.
5. Mark HANDOFF met/blocked; OWED tick; HANDOFF-CC one line.

DoD:
- [ ] Follow shows readable alternating legs at lobby distance
- [ ] Idle at rest / Stay / Home; Sleep home + dormant
- [ ] Stage A nits or explicit skip note
- [ ] Lab sha256 + CREDITS if glb changed
- [ ] Headless iNPC green
- [ ] No KayKit retarget / navmesh / OpenRouter creep

STOP AND ASK if: principal accepts Stage A alone; lab isolation mode unclear (reuse 0022 vs mint 0023); sibling WIP blocks inpc.gd merge.
```

---

**After paste:** agent runs Stage A first; opens lab only when the eye still fails.
