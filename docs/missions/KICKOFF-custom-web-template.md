---
title: Kickoff prompt — Pin ENG-0025 Profile C web template (bank export + Pages size gate)
created: 2026-09-12
product: Branch-Zero
model: Claude Code · Fable 5.1
handoff: docs/missions/HANDOFF-custom-web-template.md
lab: GameLab/work/ENG-2026-0025-godot-web-wasm-under-25mib
---

# Kickoff prompt — Custom web template Profile C (bank proof)

Paste into a **new** session. Prefer **Fable 5.1**. Lab measure for Profiles E/F is **done**
([GameLab ENG-2026-0025](../../../GameLab/work/ENG-2026-0025-godot-web-wasm-under-25mib/) `measured-sizes.txt`).

**What this is:** point Branch-Zero at **Profile F** (noise+gltf, `size_extra`, **23.81 MiB**) — or **E**
(noise only, **23.26 MiB**) if F’s −29 KB decimal margin is too thin — re-export the bank, walk mock.

**Why:** Lab cube Yes was not bank-shaped; follow-up proved F/E under the Pages cap. Hackathon compose
([KICKOFF-hosting-hackathon-compose.md](./KICKOFF-hosting-hackathon-compose.md)) stays the **primary** public
path and does not wait on this.

**Handoff:** [`HANDOFF-custom-web-template.md`](./HANDOFF-custom-web-template.md) (create/fill when opening)

---

```text
You are a cold agent. Prefer docs over memory. Model: Claude Code Fable 5.1.

MISSION: Branch Zero — pin ENG-0025 Profile C custom web template and prove the bank exports under the Pages wasm cap.
(1) Copy/pin profile-c-template.zip (sha256 from lab measured-sizes) into infra or apps/game/export_templates/ — do not commit multi-GB godot-src.
(2) Point apps/game/export_presets.cfg custom_template/release at it; threads OFF; no COOP/COEP.
(3) npm run export:web → measure apps/web/public/game/index.wasm vs 26_214_400 and 25_000_000.
(4) ?mock=account walk: lobby, Gum Bot, unicorn peek idle, KayKit props, counter — watch console for missing-class / Cannot load.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read:
1. GameLab ENG-2026-0025 findings.md + INVENTORY-branch-zero-modules.md + measured-sizes.txt
2. docs/missions/HANDOFF-hosting-hackathon-compose.md (hackathon path stays primary)
3. docs/HOSTING.md
4. apps/game/export_presets.cfg · scripts/export-web.mjs

HARD RULES:
- Do not block or rewrite the hackathon compose mission.
- Do not disable_3d. Threads stay OFF.
- If wasm exceeds the cap after Profile C, stop and keep R2/compose — do not strip more modules without a new lab question.
- Never commit secrets or godot-src/emsdk.

DoD: measured wasm under cap + mock walk green + HOSTING note + OWED tick; or blocked with sizes.
```

---

## After

If Yes: Pages+R2 becomes optional; compose remains fine. If over cap: compose/R2 only.
