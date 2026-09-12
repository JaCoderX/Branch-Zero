# Custom Godot web export template — **Profile H**

The `Web-Lean` preset in [`apps/game/export_presets.cfg`](../../apps/game/export_presets.cfg) points
`custom_template/release` at the zip in this folder, and `npm run export:web:lean` uses it. It is **opt-in**:
the default `Web` preset keeps `custom_template/release=""`, so a clone without the zip still runs
`npm run export:web` and the hackathon stack ([HOSTING §4](../../docs/HOSTING.md)) is unaffected.

| | |
|---|---|
| File | `godot-4.5.2-stable-web-nothreads-lean-h.zip` (7,271,147 B) |
| sha256 | `03a443b07e5e3fadc8227c7441e9fdbec1e07fc821fa97bbed94dcd7a20a5c66` |
| Engine | `godotengine/godot` tag `4.5.2-stable`, commit `6ce3de25aa58466e14ef354703ba8d9791a417da` — **the same commit as the editor** in [`apps/game/.godot-version`](../../apps/game/.godot-version) |
| Emscripten | 4.0.11 (the engine's own `EM_VERSION` pin; the official template ships 4.0.10) |
| `godot.wasm` inside | **24,830,340 B · 23.680 MiB** (official template: 38,047,590 B · 36.285 MiB — a 34.7% cut) |
| Lineage | GameLab `ENG-2026-0025` **Profile E** + `basis_universal` (see *Why not F* below) |
| Build | `build-profile-h.ps1` in this folder |

**Why it exists:** Cloudflare Pages caps a single asset at 25 MiB (`26,214,400`). The official 4.5.2 web
template's `index.wasm` is 36.29 MiB, which is why [`docs/HOSTING.md`](../../docs/HOSTING.md) §3.3 put the
export on R2. Profile H clears that cap by 1,384,060 B **and** the stricter decimal reading (`25,000,000`) by
169,660 B, so §3 can serve `/game/` same-origin from Pages with no R2 bucket and no publish step.
The hackathon all-in-one compose stack (§4) has **no per-file cap** and never needed this.

## The build

Profile H is `modules_enabled_by_default=no` plus a re-enable list — **module removal, not compiler flags**
(the official web template is already `-Os` + thin LTO, so flag-chasing buys ~100 KiB). `disable_3d` was never
used; 3D, 3D physics, GL Compatibility and advanced GUI are all intact. Threads stay OFF and no COOP/COEP is
required.

```text
platform=web target=template_release threads=no
optimize=size_extra deprecated=no minizip=no
modules_enabled_by_default=no
module_gdscript_enabled=yes         module_freetype_enabled=yes
module_text_server_fb_enabled=yes   module_text_server_adv_enabled=yes
module_godot_physics_2d_enabled=yes module_godot_physics_3d_enabled=yes
module_navigation_2d_enabled=yes    module_navigation_3d_enabled=yes
module_webp_enabled=yes             module_svg_enabled=yes
module_ogg_enabled=yes              module_vorbis_enabled=yes
module_mbedtls_enabled=yes          module_regex_enabled=yes
module_bcdec_enabled=yes            module_noise_enabled=yes
module_basis_universal_enabled=yes
```

**Keep `optimize=size_extra`.** The lab's Profiles C/D are the same module set at plain `optimize=size` and
land at ~31 MiB — they fail the cap. Dropping `size_extra` is the one change that breaks this.

## What Branch Zero needs from that list

| Module | Why | Evidence |
|--------|-----|----------|
| `noise` | **hard** — the terrazzo floor | `apps/game/scripts/props.gd` `floor_material()` builds a `FastNoiseLite` + `NoiseTexture2D` |
| `basis_universal` | **hard** — the Gum Bot | `assets/models/inpc/gum_bot_bank.glb.import` is the one asset with `gltf/embedded_image_handling=2` (Embed as Basis Universal); the other 69 `.glb` use `=1` (Extract Textures) |
| `text_server_adv` | ICU / complex scripts, 1.41 MiB | cheap; not the load-bearing cut |
| `svg`, `freetype`, `webp`, `ogg`/`vorbis`, `bcdec` | `.svg` + `.ttf` + `.ogg` assets and VRAM-compressed textures | asset scan |
| `godot_physics_3d`, `navigation_3d` | the walk | `project.godot` sets no `physics_engine=Jolt` |

Removed and **confirmed unused** by a repo-wide scan of `.gd`, `.tscn`, `.tres` *and* the imported `.scn` in
`.godot/imported/`: `csg`, `gridmap`, `jolt_physics`, `msdfgen` (both fonts import with
`multichannel_signed_distance_field=false`), `minimp3` (audio is `.ogg` only), `theora`,
`zip`/`minizip`, `websocket`/`multiplayer`/`enet`. `deprecated=no` also removes renamed-API shims — a GDScript
call to a deprecated method would fail at **runtime**, not at export; the `?mock=account` walk found none.

### Why not the lab's Profile F

The lab recommended **F** (Profile E + `gltf`, 23.814 MiB). F exports and boots, but the bank walk logs

```text
ERROR: Parameter "Image::basis_universal_unpacker_ptr" is null.
   at: _set_data (scene/resources/portable_compressed_texture.cpp:113)
ERROR: Parameter "texture" is null.
   at: texture_set_size_override (drivers/gles3/storage/texture_storage.cpp:1442)
```

twice, and the Gum Bot renders **untextured magenta** instead of yellow/black. The lab inventory scanned for
`FastNoiseLite`, `CSGBox3D` and runtime `.glb` loads but not for the glTF importer's embedded-image mode, so
`basis_universal` was missed. It is **not optional** while that asset imports as Basis Universal
(a documented convention — [`docs/WORLD-3D-ENVIRONMENT.md`](../../docs/WORLD-3D-ENVIRONMENT.md) §5,
[`HANDOFF-inpc-gum-bot-mesh.md`](../../docs/missions/HANDOFF-inpc-gum-bot-mesh.md)).

`gltf` turned out to be the droppable one instead. All 70 `.glb` are **edit-time imports**: the pck holds
`.scn` plus a `.remap`, so `load("res://….glb")` resolves without the runtime glTF parser. The
`?mock=account` walk on Profile H rendered every `.glb` in the bank — KayKit cast, furniture, Gum Bot,
vault door — and `FxUnicorn._dress()`'s `load()` of `unicorn_pink.glb` raised neither of its two
`push_warning` paths.

## The three measured builds

| Profile | Modules over lab Profile B | `index.wasm` | MiB | < 25 MiB | < 25 MB | Bank walk |
|---------|---------------------------|-------------:|----:|:--------:|:-------:|-----------|
| official 4.5.2 | *(everything)* | 38,047,590 | 36.285 | FAIL | FAIL | green |
| lab **F** | noise + gltf | 24,970,716 | 23.814 | PASS | PASS (−29,284) | **Gum Bot untextured** |
| **H — pinned** | noise + basis_universal | **24,830,340** | **23.680** | **PASS** (−1,384,060) | **PASS** (−169,660) | **green** |
| G — fallback | noise + gltf + basis_universal | 25,411,218 | 24.234 | PASS (−803,182) | FAIL (+411,218) | green |

`index.pck` is 7,273,428 B under all of them — the wasm is the engine and the pck is the game; neither moves
the other.

**Take G instead of H** only if something starts parsing glTF at *runtime* (a `.glb` fetched or generated
outside the import pipeline, `GLTFDocument` in script). That costs the decimal-MB reading of the cap:
G clears 25 MiB but not 25,000,000. Build it with `build-profile-h.ps1 -WithGltf`.

## Getting the zip

It is git-ignored — 7.3 MB of binary does not belong in this repo's history, and the sha256 above is what makes
it reproducible. Rebuild it (~10 min incremental, 35–90 min cold, on 8 cores):

```bash
powershell -File tools/godot-web-template/build-profile-h.ps1 -Root D:/build/godot-web-template
```

The script's header lists the two clones and the emsdk activation it expects under `-Root`. Then verify:

```bash
sha256sum -c tools/godot-web-template/SHA256SUMS
```

`npm run export:web:lean` re-checks the sha itself and refuses to export on a mismatch, so a wrong or truncated
zip cannot quietly ship.

## On an engine bump

This artefact is tied to `4.5.2-stable`. A different editor version must not use it — Godot refuses mismatched
templates. Rebuild, re-measure the wasm against both caps, re-pin the sha in `SHA256SUMS` and in
`scripts/export-web.mjs`, and re-walk `?mock=account`.
