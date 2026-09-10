---
title: Kickoff prompt — iNPC Gum Bot skinned walk land
created: 2026-09-11
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-inpc-gum-bot-walk.md
lab: ../../GameLab/work/ENG-2026-0022-inpc-gum-bot-walk/
---

# Kickoff prompt — iNPC Gum Bot skinned walk land

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** land lab ENG-2026-0022 skinned Gum Bot (`GumBot_Idle` + `GumBot_Walk`) into Branch-Zero so companion Follow shows legs instead of sliding a rest-pose mesh.

**Why:** Lab answered **Yes** (Godot 4.5.2 Compatibility proof; contact/swing/contact strip). Product still ships rig-stripped `gum_bot_bank.glb`.

**Baseline:** companion follow Phase 1 **met** (slide). Phone / OpenRouter / screen swap stay as-is.

**Handoff:** [`HANDOFF-inpc-gum-bot-walk.md`](./HANDOFF-inpc-gum-bot-walk.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Clips have **no root motion** | Keep escort-lite seek; AnimationPlayer only poses legs |
| Lab glb ~397 KB with skins | Expect import AnimationPlayer; may bump download slightly |
| `emission` additive | Keep black base; swap sheet only (unchanged) |
| Captures gitignored in GameLab | Copy from local lab `out/`; verify sha256 |
| Sibling WIP may touch cast/FX | Touch `inpc.gd` + inpc assets + docs + tests only |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — land iNPC Gum Bot skinned walk from GameLab ENG-2026-0022.
(1) Copy out/gum_bot_bank_walk.glb into apps/game/assets/models/inpc/ (replace or variant — prefer replace if footprint matches); verify sha256 against lab out/SHA256SUMS.txt.
(2) Wire InpcProp (inpc.gd): AnimationPlayer plays GumBot_Walk (or alias walk) while _walking; GumBot_Idle (or idle) when following-but-resting / STAYING / HOME. Keep seek, collision exceptions, Sleep home snap, screen swap, phone Follow contract.
(3) CREDITS + INPC.md as-built + OWED tick; run_inpc_walk green; export:web when Godot 4.5.x available; browser smoke Follow → legs.
Do not change OpenRouter, snapshot whitelist, phone chrome, or escort into navmesh.

Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-inpc-gum-bot-walk.md
2. docs/missions/KICKOFF-inpc-gum-bot-walk.md  (this file)
3. D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0022-inpc-gum-bot-walk\handoff.md
4. Same ENG findings.md (Answer = Yes)
5. apps/game/scripts/inpc.gd (as-built slide follow)
6. docs/INPC.md — Companion follow + Visual
7. CREDITS.md (Gum Bot row)
8. Skim: GameLab/.../godot_proof/proof.gd (clip names + emission pattern)

Local roots:
- Product WRITE: D:\My Git Projects\D9-Studio\Branch-Zero\
- Lab READ/COPY only: D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0022-inpc-gum-bot-walk\out\

HARD RULES:
- Codex Luna. Product repo only for code. Copy ship glb from lab out/ — do not vendor the ENG tree or blend.
- No root-motion double move. Seek remains the translator.
- Keep Follow non-locking; Sleep = unfollow + home + dormant.
- emission = Color(0,0,0); swap emission_texture only.
- No NavigationRegion. No npc.gd / KayKit merge. No OpenRouter / phone / U7 scope creep.
- Never commit secrets. Progress under docs/progress/ OK (gitignored).

SEQUENCE:
1. Copy glb; sha256 check; Godot import shows GumBot_Idle + GumBot_Walk.
2. Wire AnimationPlayer from _walking / rest states; keep mesh yaw π if lobby face still requires it.
3. CREDITS + LICENSE note if needed; INPC.md slide → skinned as-built.
4. run_inpc_walk (+ _check_inpc / viz budget if touched).
5. export:web if Godot host available; else note in handoff Outcome.
6. Browser ?mock=account: Wake → Follow → legs → Unfollow → Sleep home.
7. Mark HANDOFF met/blocked; OWED tick; HANDOFF-CC one line.

DoD:
- [ ] Follow shows readable leg cycle
- [ ] Idle at rest / Stay / Home; Sleep home + dormant
- [ ] Follow does not lock floor; Talk/phone intact
- [ ] CREDITS sha256 + INPC + OWED
- [ ] Headless iNPC green or host noted unavailable
- [ ] No OpenRouter / navmesh / staff scope creep

STOP AND ASK if: lab sha256 missing/mismatch; import has no AnimationPlayer; skins break viz budget badly; sibling WIP blocks inpc.gd merge.
```

---

## After

Principal: browser Follow eye-check. If legs skate or melt → park and reopen lab; do not weaken Follow locks.
