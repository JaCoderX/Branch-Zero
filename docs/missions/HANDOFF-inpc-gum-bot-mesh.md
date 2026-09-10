---
type: handoff
title: Handoff — iNPC Gum Bot mesh land
audience: cold agent (Codex Luna preferred · Claude Code OK)
created: 2026-09-10
product: Branch-Zero
mission: Replace procedural iNPC kiosk with lab-proven Gum Bot bank mesh; keep Wake/Sleep/chat behaviour
kickoff: docs/missions/KICKOFF-inpc-gum-bot-mesh.md
status: open
lab: GameLab ENG-2026-0021 Yes (Phase 1 + brass/Godot follow-up)
parallel_to: iNPC phone Talk fix · U7 packaging — mesh-only; do not absorb phone/HUD or OpenRouter work
---

# Handoff — iNPC Gum Bot mesh land

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope.

**Prefer:** **Codex Luna** (Godot mesh / PropKit class). Claude Code OK if Luna unavailable.

**Kickoff (paste):** [`KICKOFF-inpc-gum-bot-mesh.md`](./KICKOFF-inpc-gum-bot-mesh.md)

**Design index:** [`docs/INPC.md`](../INPC.md) Visual · [`CREDITS.md`](../../CREDITS.md)

**Lab (read, copy ship set only — do not merge the ENG tree):**  
[`../../GameLab/work/ENG-2026-0021-inpc-gum-bot-bank/handoff.md`](../../../GameLab/work/ENG-2026-0021-inpc-gum-bot-bank/handoff.md) ·  
[`findings.md`](../../../GameLab/work/ENG-2026-0021-inpc-gum-bot-bank/findings.md) Follow-up section ·  
proven pattern: `GameLab/.../godot_proof/proof.gd`

**Not this mission:** Companion follow / NavigationAgent · phone HUD / Talk bugs · OpenRouter / pack / snapshot changes · staff `NPCS.md` · Ollama · U7 packaging · blink/poweron polish (optional after land) · protocol Solidity.

---

## Principal intent

The lobby service assistant still uses a procedural cylinder stack (`InpcProp._dress`). Lab **ENG-2026-0021** proved a CC0 **3D Gum Bot** remapped to Graphite / Steel / **Brass bezel**, with dormant↔awake screen emissive, in Godot 4.5.2 Compatibility. Land that mesh at the existing spot so the iNPC reads as bank furniture, not a debug prop.

Behaviour (Wake / Talk / Sleep / OpenRouter / phone HUD if already landed) **unchanged**.

---

## Lab lessons (do not re-learn the hard way)

| Lesson | Product implication |
|--------|---------------------|
| Godot samples `emission_texture` from **UV1 only** | Ship glb has **one UV set** (`TEXCOORD_0`). Do not reintroduce TEXCOORD_1. |
| Emission is **additive** | Keep `emission = Color(0,0,0)`; swap only the sheet + energy. Never set emission to white/Bulb (floods screen). Bulb is baked into `screen_awake.png`. |
| Use `PropKit.ensure_theme()` | Not `WingTheme.current()` (does not exist). |
| Mesh name | Find `GumBotBank` (or first `MeshInstance3D`); surface 0 body, surface 1 screen. |
| Plaque / collider | Procedural column constants (`PEDESTAL_H`, `FACE_Z`) do **not** fit the biped — re-anchor enamel plaque and collider to the new body. |
| Spot | Keep `INPC_SPOT (7.6, 0, 2.4)` · yaw `π/2` unless the screen faces the wrong way after import — then fix rotation only. |
| Dormant mid-grey under sun | Optional: `_screen_mat.albedo_color = Color(0,0,0)` for a blacker asleep screen. |

---

## Ship set (copy from lab `out/` + licence)

| Lab path (ENG-2026-0021) | Product path |
|--------------------------|--------------|
| `out/gum_bot_bank.glb` (sha256 `7ad8abc5ad92cdf0f69797aba048c8f55360da086511d90487ff3fa927ccffbb`) | `apps/game/assets/models/inpc/gum_bot_bank.glb` |
| `out/screen_awake.png` | `apps/game/assets/models/inpc/screen_awake.png` |
| `source/LICENSE-gum-bot-cc0.txt` | `apps/game/assets/models/inpc/LICENSE-gum-bot.txt` |

Do **not** copy `source/` blend, clean/dirty PBR, raw glb, or capture PNGs into product.

Verify hash after copy. Add **CREDITS.md** row (CC0 · pistachio / GrafxKid · bank remap).

---

## What to build

1. **Assets** — copy ship set; Godot import: Generate LODs on, lightmap UV off, Basis Universal OK.
2. **`InpcProp._dress()`** — instance Gum Bot instead of cylinders; keep `BankTerminal` interact, groups (`inpc`, not `terminal`), plaque (repositioned), collider sized to biped.
3. **`_refresh_look()`** — swap screen emission texture dormant ↔ awake from `GameState.inpc_awake` (same bit as today). Pattern from lab `proof.gd` / lab handoff sketch.
4. **Docs** — update `docs/INPC.md` Visual table (mesh = Gum Bot bank lod03); tick OWED row; one REFLECTION line if a design call was made.
5. **Verify** — still at couches; `run_inpc_walk.gd` + `_check_inpc`; `npm -w apps/web run typecheck` if bridge untouched; `npm run export:web` when Godot 4.5.x host available.

---

## DoD

- [ ] Ship set in `apps/game/assets/models/inpc/` + CREDITS + LICENSE
- [ ] Lobby still: Gum Bot at east couches, brass bezel readable, dormant screen dark / awake eyes on
- [ ] Wake / Sleep / Talk / overlay (and phone HUD if present) still work; no OpenRouter / snapshot changes
- [ ] Headless iNPC checks green (or Godot host noted unavailable)
- [ ] `docs/INPC.md` Visual + OWED updated; Branch-Zero not carrying GameLab ENG tree

## Stop and ask if

You would change snapshot / OpenRouter / phone Talk logic; spot must move; hash mismatch on lab glb; export:web blocked without a principal call.
