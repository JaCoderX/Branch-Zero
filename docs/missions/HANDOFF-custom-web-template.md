---
type: handoff
title: Handoff — Pin ENG-0025 Profile F (or E) custom web template for Pages
audience: cold agent (Claude Code · Fable 5.1)
created: 2026-09-12
product: Branch-Zero
status: open — lab measure done; bank export walk owed
kickoff: docs/missions/KICKOFF-custom-web-template.md
lab: GameLab/work/ENG-2026-0025-godot-web-wasm-under-25mib
parallel_to: hackathon compose (primary public path — do not block on this)
---

# Handoff — Custom web template Profile F / E

## Lab result (do not re-litigate)

| Profile | wasm | Pages 25 MiB | Pages 25 MB |
|---------|-----:|:------------:|:-----------:|
| Official | 36.29 MiB | FAIL | FAIL |
| **E** (B+noise, size_extra) | **23.26 MiB** | PASS | PASS (−611 KB) |
| **F** (B+noise+gltf, size_extra) | **23.81 MiB** | PASS | PASS (−29 KB) |

Pin **F** unless decimal margin is unacceptable → then **E** + prove `.glb` remaps.
**Keep `optimize=size_extra`.** Template zip sha256 F:
`5deb1ec46c749bd7e96b9c8065bda6dbc9e281b3bd6488031b4fc2a75463cd1b`

## Your job

1. Copy `out/profile-f-template.zip` (or rebuild via lab `scripts/build-profile-f.ps1`) into a product-pinned path.
2. `apps/game/export_presets.cfg` → `custom_template/release`; threads OFF; no COOP/COEP.
3. `npm run export:web` → measure `index.wasm`.
4. `?mock=account` walk: Gum Bot, unicorn, KayKit props, FastNoise carpet path — watch console.
5. HOSTING.md note; OWED tick. Do **not** delay hackathon compose.

## Stop

Over cap after bank export → keep compose/R2; do not strip more modules without a new ENG.
