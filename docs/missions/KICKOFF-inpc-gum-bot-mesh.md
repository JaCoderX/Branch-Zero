---
title: Kickoff prompt — iNPC Gum Bot mesh land
created: 2026-09-10
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-inpc-gum-bot-mesh.md
lab: ../../GameLab/work/ENG-2026-0021-inpc-gum-bot-bank/
---

# Kickoff prompt — iNPC Gum Bot mesh land

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** replace the procedural service-assistant kiosk in `InpcProp` with the lab-proven **Gum Bot bank** mesh (CC0, Graphite / Steel / Brass bezel, dormant↔awake screen). Chat / OpenRouter / phone HUD behaviour stays as-is.

**Why:** Lab ENG-2026-0021 answered Yes (Phase 1 + brass/Godot follow-up). Product still shows the cylinder stack; OWED optional silhouette is this land.

**Baseline:** iNPC OpenRouter **met**; phone HUD may be met or in parallel — **do not** edit phone/Talk missions in this unit.

**Handoff:** [`HANDOFF-inpc-gum-bot-mesh.md`](./HANDOFF-inpc-gum-bot-mesh.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Lab glb is one UV set | Do not put screen on TEXCOORD_1 |
| Godot emission is additive | `emission = black`; swap sheet only |
| Plaque was on a column | Re-anchor for biped CRT body |
| Sibling sessions may touch Inpc/phone | Mesh-only diff; do not absorb Talk-dead or phone work |
| Captures are gitignored in GameLab | Copy from local ENG `out/` (or pull lab repo); verify sha256 |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — land iNPC Gum Bot mesh from GameLab ENG-2026-0021.
(1) Copy ship set into apps/game/assets/models/inpc/ (glb + screen_awake.png + LICENSE); verify sha256 7ad8abc5ad92cdf0f69797aba048c8f55360da086511d90487ff3fa927ccffbb for gum_bot_bank.glb.
(2) Rewrite InpcProp._dress() / _refresh_look() to instance the glb and swap screen emission dormant↔awake from GameState.inpc_awake — keep interact, groups, INPC_SPOT, bridge/verbs untouched.
(3) CREDITS.md + docs/INPC.md Visual + OWED tick; headless iNPC checks; export:web when Godot 4.5.x available.
Do not change OpenRouter, snapshot, phone HUD, or staff dialogue.

Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-inpc-gum-bot-mesh.md
2. docs/missions/KICKOFF-inpc-gum-bot-mesh.md  (this file)
3. D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0021-inpc-gum-bot-bank\handoff.md
4. Same ENG findings.md — Follow-up section only
5. apps/game/scripts/inpc.gd (as-built procedural dress)
6. docs/INPC.md Visual
7. CREDITS.md (intake ritual)
8. Skim: GameLab/.../godot_proof/proof.gd (emission override pattern)

Local roots:
- Product WRITE: D:\My Git Projects\D9-Studio\Branch-Zero\
- Lab READ/COPY only: D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0021-inpc-gum-bot-bank\out\

HARD RULES:
- Codex Luna. Product repo only for code. Copy assets from lab out/ — do not vendor the whole ENG or source blend.
- emission = Color(0,0,0); swap emission_texture + energy only. PropKit.ensure_theme() if needed — never WingTheme.current().
- Keep INPC_SPOT (7.6, 0, 2.4) and yaw unless screen faces away — then rotate mesh only.
- Re-fit plaque + StaticBody collider to biped (do not keep column-only PEDESTAL geometry as the silhouette).
- No new lights. No companion follow. No NPCS.md staff row.
- Do not start HANDOFF-inpc-phone-talk, OpenRouter pack edits, or U7 packaging in this mission.
- Never commit secrets. Progress under docs/progress/ OK (gitignored).
- Prefer not to fight sibling WIP in overlay/Inpc* — touch inpc.gd + assets + docs + tests only.

SEQUENCE:
1. Copy ship set; sha256 check; CREDITS row.
2. Dress InpcProp with glb + screen swap; reposition plaque/collider.
3. Desktop or web still beside Stage 6a couches (dormant + awake).
4. run_inpc_walk + _check_inpc; typecheck if any TS touched (should be none).
5. export:web if Godot host available; else note in handoff Outcome.
6. Update INPC.md Visual, OWED, handoff status met/blocked; one REFLECTION line if design call.

DoD:
- [ ] Gum Bot visible at service-assistant spot; brass bezel readable; awake eyes / dormant dark
- [ ] Wake / Sleep / Talk (and phone if present) still work
- [ ] CREDITS + LICENSE + INPC Visual + OWED
- [ ] Headless iNPC green or host noted unavailable
- [ ] No OpenRouter / snapshot / phone-Talk scope creep

STOP AND ASK if: lab glb hash mismatch; you must move INPC_SPOT; emission still floods white; sibling phone WIP blocks inpc.gd merge.
```

---

## After

Principal: hard-refresh `:5173` after export; walk to the east couches — asleep plaque + dark screen, Wake → brass frame + eyes, Talk/Sleep unchanged. Compare to lab Godot board if unsure.
