---
type: handoff
title: Handoff — Pin ENG-0025 Profile F (or E) custom web template for Pages
audience: cold agent (Claude Code · Fable 5.1)
created: 2026-09-12
product: Branch-Zero
status: met (2026-09-12) — Profile H pinned; lab Profile F rejected on a missing module
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


---

## Outcome (2026-09-12, Claude Code · Opus 5) — **met**, but not with Profile F

### The short version

**Profile F does not survive the bank.** It exports and boots, but the `?mock=account` walk logs

```text
ERROR: Parameter "Image::basis_universal_unpacker_ptr" is null.
   at: _set_data (scene/resources/portable_compressed_texture.cpp:113)
ERROR: Parameter "texture" is null.
   at: texture_set_size_override (drivers/gles3/storage/texture_storage.cpp:1442)
```

twice, and the Gum Bot renders **magenta** instead of yellow/black. `apps/game/assets/models/inpc/gum_bot_bank.glb`
is the one asset of 70 that imports with `gltf/embedded_image_handling=2` (Embed as Basis Universal) — a
deliberate, documented convention ([WORLD-3D-ENVIRONMENT §5](../WORLD-3D-ENVIRONMENT.md),
[HANDOFF-inpc-gum-bot-mesh](./HANDOFF-inpc-gum-bot-mesh.md)), so the runtime needs the `basis_universal`
transcoder. ENG-2026-0025's inventory scanned for `FastNoiseLite`, `CSGBox3D` and runtime `.glb` loads, but not
for the glTF importer's embedded-image mode.

Two templates were built to fix it, with the lab's Profile F/E flags otherwise byte-identical:

| Profile | = | `index.wasm` | MiB | < 25 MiB | < 25 MB | Bank walk |
|---------|---|-------------:|----:|:--------:|:-------:|-----------|
| official | — | 38,047,590 | 36.285 | FAIL | FAIL | green (reference) |
| lab F | B + noise + gltf | 24,970,716 | 23.814 | PASS | PASS −29,284 | **Gum Bot magenta** |
| G | F + basis_universal | 25,411,218 | 24.234 | PASS −803,182 | **FAIL** +411,218 | green |
| **H — pinned** | **E + basis_universal** | **24,830,340** | **23.680** | **PASS −1,384,060** | **PASS −169,660** | **green** |

**Profile H is the pin.** Dropping `gltf` instead of `basis_universal` costs nothing the bank uses and buys back
the decimal-MB margin. That also answers the question this handoff parked on E: all 70 `.glb` are edit-time
imports carrying a `.remap` to `.scn`, so `load("res://….glb")` never reaches the runtime parser — the walk
rendered the whole KayKit cast, the furniture, the vault door and the Gum Bot, and `FxUnicorn._dress()`'s
`load()` of `unicorn_pink.glb` raised neither of its `push_warning` paths. **G is documented as the drop-in** if
anything ever parses glTF at runtime; it costs the decimal reading of the cap.

`optimize=size_extra` kept throughout, threads OFF, no COOP/COEP, `disable_3d` never used, Compatibility intact.

### Built

| Path | What |
|------|------|
| `tools/godot-web-template/` | `README.md` (pin, sha256, full flag list, why each module is kept, the Profile F failure, engine-bump rules), `SHA256SUMS`, `build-profile-h.ps1` (`-WithGltf` builds G), and the git-ignored 7.3 MB zip |
| `apps/game/export_presets.cfg` | new `[preset.1] Web-Lean` — identical to `Web` but `custom_template/release` → the pinned zip. `Web` is **unchanged** |
| `scripts/export-web.mjs` + `npm run export:web:lean` | `--lean` picks the preset, verifies the template's sha256 (refuses on mismatch or absence), and prints `index.wasm` against both `26,214,400` and `25,000,000` — on every export, lean or not |
| Docs | [HOSTING.md](../HOSTING.md) §3.3 rewritten (two exports, two answers; R2 demoted to fallback), §1 status + shape table, §5 Files, new **§8.3** evidence · [GODOT.md](../GODOT.md) toolchain + preset notes · [OWED.md](../OWED.md) row |

### Chosen, and why

- **A second preset, not a change to `Web`.** Pointing the default preset at a git-ignored 7.3 MB zip would make
  `npm run export:web` fail on any clone that lacks it — including the hackathon compose build. `Web-Lean` is
  opt-in, so §4 is untouched. Verified: `npm run export:web` after the change still produces the official
  38,047,590 B wasm.
- **The zip stays out of git.** 7.3 MB of binary in a public repo's history, forever, for an optional path. The
  sha256 in `SHA256SUMS` + `export-web.mjs` and a committed build script make it reproducible instead, and the
  export refuses to run against the wrong bytes.
- **Path relative to `apps/game`.** Godot resolves `custom_template/release` against the process working
  directory, and `res://` cannot escape the project root — while a zip *inside* the project would land in the
  `.pck`. `export-web.mjs` already runs Godot with `cwd: apps/game`, so the relative path is deterministic
  there; the docs say to use the npm script rather than a bare `godot --path`.

### Verified

Full evidence in [HOSTING §8.3](../HOSTING.md). Byte counts come from the **bank** export and match the lab's
to the byte; `index.pck` is 7,273,428 B under every template. Walk: splash → *Enter the branch* → mock account
HUD → `&demo=walk` circuit to the couches and Ines's dialogue; FastNoise terrazzo floor, Cinzel/Inter text,
ledger and partner boards, vault door and clock all drew; banner `v4.5.2.stable.custom_build.6ce3de25a`,
`Emscripten 4.0.11, single-threaded, no GDExtension support`; **zero Godot console errors or warnings**. The
only console errors are `/api/healthz` 500s — no Live desk was running, which `?mock=account` does not need.
Profile F's failure was confirmed side-by-side against the official template from the same camera position.

### Not done

- The unicorn's **peek** animation, and the vault / counter / FX desks further along the demo circuit. The
  Browser pane was hidden, which stalls the Godot canvas between frames, so the circuit was stepped rather
  than watched end to end. The unicorn's `.glb` **load** is covered; its timed peek is not.
- Any **performance** comparison against the official template. `size_extra` is documented to cost run-time
  speed and this was a size gate.
- The actual Pages deploy — still the principal's step (OWED §1), and the hackathon compose stack (§4) remains
  the primary public path. Nothing here touched it.

### Owed to the lab

~~ENG-2026-0025's inventory still recommended F without `basis_universal`.~~ **Folded back 2026-09-12:**
lab `INVENTORY-branch-zero-modules.md`, findings § *Product pin correction*, `handoff.md` outcome, and
`measured-sizes.txt` now state **`basis_universal` is hard; `gltf` is soft; pin H not F**.