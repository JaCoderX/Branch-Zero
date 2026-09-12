---
title: Kickoff prompt — Pin ENG-0025 Profile H custom web template (met)
created: 2026-09-12
updated: 2026-09-12
product: Branch-Zero
model: Claude Code · Fable 5.1
handoff: docs/missions/HANDOFF-custom-web-template.md
lab: GameLab/work/ENG-2026-0025-godot-web-wasm-under-25mib
status: met — do not re-run; pin is Profile H
---

# Kickoff prompt — Custom web template Profile H (bank proof)

> **Done 2026-09-12 — do not re-run.** Lab Profile **F** fails the bank (Gum Bot needs `basis_universal`).
> Product pin is **Profile H** = E + `basis_universal` (**23.680 MiB**, clears both Pages cap readings) via
> `npm run export:web:lean`. See the Outcome in
> [`HANDOFF-custom-web-template.md`](./HANDOFF-custom-web-template.md) and
> [`tools/godot-web-template/README.md`](../../tools/godot-web-template/README.md).

**What landed:** `Web-Lean` preset + pinned zip (sha256 in `tools/godot-web-template/SHA256SUMS`); default `Web`
preset unchanged so hackathon compose / clones without the zip still work.

**Why H (not F/G):** F boots but Gum Bot textures go magenta; G = F+basis clears MiB but **fails** decimal 25 MB;
H drops soft `gltf` (edit-time remaps only), keeps `noise` + `basis_universal`, clears both caps.

**Hackathon compose** ([KICKOFF-hosting-hackathon-compose.md](./KICKOFF-hosting-hackathon-compose.md)) remains a
valid public path and does not require this template. Pages same-origin `/game/` can use lean export without R2.

**Handoff:** [`HANDOFF-custom-web-template.md`](./HANDOFF-custom-web-template.md)

---

## After (principal)

`npm run export:web:lean` → Pages build with wasm under the cap (unset `VITE_GAME_BASE_URL`). Keep
`export:web` (official) for the compose stack if you prefer. Unicorn peek / full circuit feel still VERIFY.
