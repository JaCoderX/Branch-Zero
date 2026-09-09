---
title: Kickoff prompt — Exterior street-art easter egg (south façade)
created: 2026-09-09
product: Branch-Zero
model: Codex Astra light
handoff: docs/HANDOFF-exterior-street-art-easter.md
---

# Kickoff prompt — Exterior street-art easter egg (south façade)

Paste into a **new** Cursor / Codex session. Prefer **Codex Astra light**. Escalate only if texture atlas / Compatibility draw spikes block after one honest attempt.

**What this is:** a **small exterior set-dressing pass** — turn the blank south walls flanking the revolving entrance into a **street-art easter egg** (maker credit + Bloxchain / ParticleCS), while the gold lintel keeps **Branch Zero** in bank voice. Not a cyberpunk reskin. Not the SE partners board. Not packaging.

**Why:** Principal — outside walls are visible from only a few angles; good easter-egg real estate. Fun contrast with the art-deco interior is intentional; street art / wheatpaste if cyberpunk is too loud.

**Baseline:** Main wing on `http://localhost:5173`. `WallS_a` / `WallS_b` plain cream; lintel plaque `BRANCH ZERO — est. block 0`. SE partners board already exists inside. U6 Arc deferred. KayKit cast closed.

**Handoff:** [`docs/HANDOFF-exterior-street-art-easter.md`](./HANDOFF-exterior-street-art-easter.md)

---

## Reflect (do not invent scope)

| Fact | Implication |
|------|-------------|
| Entrance gap `x ∈ [3, 7]`; south wall at `z ≈ +11` | Murals on `WallS_a` (x < 3) and `WallS_b` (x > 7) only |
| Existing lintel plaque | Upgrade / keep **Branch Zero** in brass bank voice — do not graffiti the name |
| SE partners board is bank-voiced Event → Partners → Bloxchain \| Particle | Exterior is maker/studio credit — do not duplicate the same poster |
| Interior pillars = warm art-deco | Style break is **mural-only**; no neon / holograms / rain |
| WORLD-3D §6; eight omnis | No ninth OmniLight; albedo (+ optional plaque emission) only |
| REFLECTION sponsor language | Particle CS ≠ Bloxchain panels; do not claim Branch Zero is the official product |

**Semantics (locked):**

1. Lintel = **Branch Zero** (bank).
2. One flank = `@JaCoderX` + GitHub · Telegram · X.
3. Other flank = **Bloxchain** + **by ParticleCS** + remapped logos from bloxchain.app / particlecs.com.
4. Look = cute low-poly **street art** (stencil / wheatpaste / sticker), not Blade Runner.
5. No click-outs from Godot. No interior bleed.

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Astra light.

MISSION: Branch Zero — exterior street-art easter egg on the south façade. (A) Keep / polish the entrance lintel as bank-voiced BRANCH ZERO. (B) Dress one south exterior flank as @JaCoderX maker credit (GitHub, Telegram, X). (C) Dress the other flank as Bloxchain + by ParticleCS with logos remapped from bloxchain.app / particlecs.com. Street-art / wheatpaste / stencil contrast only — not a cyberpunk building skin. Interior art-deco and SE partners board unchanged in meaning.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/HANDOFF-exterior-street-art-easter.md
2. docs/KICKOFF-exterior-street-art-easter.md   (this file)
3. docs/WORLD-3D-ENVIRONMENT.md   (§1 art, §2 entrance / south wall, §6 budget)
4. docs/REFLECTION.md   (§2.4 language; do not overclaim Particle / Bloxchain)
5. docs/HANDOFF-partners-board.md   (know what already exists inside — do not duplicate)
6. apps/game/scripts/bank_interior.gd   (_outer_walls, plaque helper, WallS_a / WallS_b)
7. apps/game/scripts/wing_theme.gd   (palette — interior stays; mural inks may borrow cream/brass/graphite)
8. CREDITS.md   (licence pattern for new assets)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility. No SDFGI/SSR/volumetric fog/lightmaps.
- Runtime / bridge: no new bridge methods. No keys/RPC in Godot. No secrets in git.
- Scope = south exterior flanks + lintel only. Do NOT rewrite lobby, SE partners board, desks, HUD, dialogue, cast, vault, FX, packaging.
- Style: street art / paste-up / stencil easter egg. NOT neon cyberpunk materials, NOT holograms, NOT animated signage, NOT full-wall cyber reskin.
- Branch Zero on the lintel stays bank brass/enamel voice. Do not put the bank name in graffiti type.
- Logos: vendor local copies; remap into mural ink colours; CREDITS with source URL + sha256. Do not hotlink live sites into the .pck.
- Do not claim Branch Zero is the official Particle CS / Bloxchain product. Separate Bloxchain vs ParticleCS on the brand wall.
- No ninth OmniLight. No zone / entrance-gap / revolving-door collider / escort waypoint changes. WORLD-3D §6 budget; run_viz_budget if draws/meshes move.
- No URL click-outs from Godot walls. Handles and brand names are visual credits only.

SEQUENCE:
1. Survey: from spawn / outside glance, confirm WallS_a vs WallS_b blank faces and lintel plaque placement. Pick west=maker / east=brand (or reverse) and note the choice in the progress note.
2. Lintel: ensure BRANCH ZERO reads clearly in bank voice (keep plaque text or upgrade lettering on the gold header — still brass/enamel, not graffiti).
3. Assets: obtain ParticleCS + Bloxchain marks; build one or two mural textures (atlas preferred) in cute low-poly wheatpaste language — soft stencil @JaCoderX + three platform marks; brand wall with remapped logos + "by ParticleCS".
4. Place: add thin mural quads (or decals) on the outer faces of WallS_a / WallS_b — slight offset so they do not z-fight; optional thin frame. Keep revolving door and entrance gap clear.
5. Docs: CREDITS entries; short WORLD-3D §2 entrance note; one REFLECTION decision row (easter-egg exterior ≠ SE partners board). Optional viz_shots from entrance.
6. Evidence: hard-refresh :5173; walk spawn → look left/right outside; confirm interior lobby look unchanged; run_viz_budget if counts moved. File docs/progress/2026-09-09-exterior-street-art-easter.md.

DoD:
- [ ] Lintel: Branch Zero in bank voice, legible at entrance
- [ ] One exterior flank: @JaCoderX + GitHub / Telegram / X in street-art style
- [ ] Other exterior flank: Bloxchain + by ParticleCS with remapped logos, same mural language
- [ ] Interior art-deco + SE partners board unchanged in meaning
- [ ] No cyberpunk lighting/materials; contrast is mural-only; door unblocked
- [ ] CREDITS + WORLD-3D and/or REFLECTION note; progress note filed; budget gates hold

OUT OF SCOPE: cyberpunk building theme, interior partners board rewrite, board URL click-outs, new NPCs/zones, ship packaging, DEMO-SCRIPT rewrite, GameLab ENG trees, cast/wardrobe, Lane B / Privy / FX / ENS logic, bloxchain.app SaaS code, protocol Solidity.

Stop when DoD met or a named blocker with the smallest honest fallback (e.g. Label3D + coloured paper quads without full logo raster if asset intake blocks).
```

---

## After this pass

- Tick any OWED explore item only if the principal tracks this there.
- Point `HANDOFF-CC.md` at the progress note only if asked.
- Do not merge this scope into ship packaging without a separate ask.
