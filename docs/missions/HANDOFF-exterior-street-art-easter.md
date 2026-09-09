---
type: handoff
title: Handoff — Exterior street-art easter egg (south façade)
audience: cold agent (Codex Astra light)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Dress the blank south exterior walls flanking the revolving entrance as a contained street-art easter egg — Branch Zero on the lintel (bank voice); maker wall @JaCoderX; brand wall Bloxchain + by ParticleCS with remapped logos
kickoff: docs/missions/KICKOFF-exterior-street-art-easter.md
baseline: WallS_a / WallS_b are plain marble cream; lintel plaque already reads "BRANCH ZERO — est. block 0" at (5.0, 3.5, half_d − 0.25); SE partners board inside lobby already covers Event → Partners → Bloxchain | Particle in bank voice
status: open
parallel_to: U7 ship packaging · KayKit cast (closed) · Lane B Release (met) — do not steal those missions
---

# Handoff — Exterior street-art easter egg (south façade)

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope or tone.

**Authorized construction:** a **small set-dressing pass** on the **outside** of the bank only — the blank south wall runs either side of the entrance gap (`x ∈ [3, 7]`). Make them a discoverable easter egg in **street-art / wheatpaste / stencil** language. Interior art-deco stays untouched.

**Prefer:** **Codex Astra light**.

**Kickoff (paste):** [`docs/missions/KICKOFF-exterior-street-art-easter.md`](./KICKOFF-exterior-street-art-easter.md)

**Not this mission:** Full cyberpunk reskin · interior partners board rewrite · HUD / dialogue · packaging · GameLab ENG · new bridge methods · clickable URLs from Godot · ninth OmniLight.

---

## Principal intent (2026-09-09)

1. The **outside walls** are a good easter-egg location — visible from only a few angles (entrance approach / outside glance).
2. Content split:
   - **Header / gold lintel:** bank name **Branch Zero** (bank voice — not graffiti).
   - **One flank:** social maker credit — `@JaCoderX` with **GitHub, Telegram, X**.
   - **Other flank:** **Bloxchain** brand + **by ParticleCS**, using logos from [bloxchain.app](https://bloxchain.app/) and [particlecs.com](https://particlecs.com/).
3. Style may **leave the bank’s art-deco house look** because it is an easter egg — intentional fun contrast.
4. If full cyberpunk is too loud, dial to **street art** (paste-up / stencil / sticker-zine). Principal accepted street art as the right intensity.

---

## Why this is not the SE partners board

| Piece | Voice | Where |
|-------|-------|-------|
| SE partners board (existing) | Diegetic **bank** notices — Event → Partners → Bloxchain \| Particle | Inside lobby SE |
| This mission | **Maker / studio credit** as façade street art | South **exterior** flanks + lintel polish |

Do **not** duplicate the same poster twice. Exterior = “built by / with”; interior board = “partners of this branch.”

---

## Baseline (do not regress)

| Item | State |
|------|--------|
| South walls | `wall("WallS_a"…)` / `wall("WallS_b"…)` in `bank_interior.gd` `_outer_walls()` — plain cream |
| Entrance plaque | `plaque("BRANCH ZERO — est. block 0", Vector3(5.0, 3.5, half_d - 0.25), …)` |
| Revolving door | Brass rings + glass wings — leave geometry alone unless a mural quad needs a millimetre clearance |
| Theme | Main wing marble / brass / deep green (`WingTheme`) — **interior** unchanged |
| Budget | WORLD-3D §6; Compatibility; no ninth OmniLight; mesh/draw gates from `run_viz_budget` |
| Language | REFLECTION: do not claim Branch Zero is the official Particle / Bloxchain product |

---

## Direction

### North star

**Cute low-poly paste-up on a warm bank**, not Blade Runner. Contained style break on exterior faces only.

| Surface | Content | Treatment |
|---------|---------|-----------|
| Gold header / lintel | **Branch Zero** (keep or upgrade existing plaque) | Bank brass / enamel — **not** graffiti type |
| West south flank (`WallS_a`, x < 3) | `@JaCoderX` + GitHub · Telegram · X marks | Street-art mural / wheatpaste panel |
| East south flank (`WallS_b`, x > 7) | Bloxchain mark + “by ParticleCS” + remapped logos | Matching mural language |

Suggested assignment (agent may swap flanks if composition reads better from spawn — document the choice):

- West = maker · East = brand — or the reverse; pick one and stick to it.

### Look recipe

- Soft stencil letters, wheatpaste edges, slight mis-registration OK.
- Logos: **vendored** SVGs/PNGs remapped into the mural ink set (cream paper, slate ink, one accent). Do **not** hotlink live site images into the `.pck`.
- Optional thin brass/wood frame so panels still feel **hung on a bank**.
- **No** neon tubes, holographic UI, rain, full-wall cyber materials, animated signage.
- Legible from entrance distance without screenshot zoom.

### Assets / licence

- Pull official marks from particlecs.com / bloxchain.app (or existing org assets the principal supplies).
- Record licence + source URL + sha256 in `CREDITS.md`.
- Prefer one atlas / few materials for both murals (web Compatibility).

---

## Likely touch points

| Piece | File |
|-------|------|
| South walls + lintel | `apps/game/scripts/bank_interior.gd` (`_outer_walls`, `plaque`) |
| Mural quads / textures | `apps/game/assets/…` (new) + dress from `bank_interior.gd` or a tiny helper |
| Theme colours (if needed) | `apps/game/scripts/wing_theme.gd` — only if a mural tint helper is cleaner than hard-coded colours |
| Evidence | optional `viz_shots` / progress note; `run_viz_budget` if mesh/draw count moves |
| Docs | short WORLD-3D §2 entrance note; one REFLECTION decision row; `CREDITS.md` |

---

## Constraints

- Godot 4.5 GDScript · web · threads OFF · Compatibility.
- No new bridge methods · no keys/RPC in Godot · no secrets in git.
- Do not change zone footprints, entrance gap `x ∈ [3, 7]`, revolving door collide, escort waypoints, NPC homes.
- Do not rewrite SE partners board, desk plaques, HUD, dialogue, cast meshes.
- Do not add lights. Albedo (+ optional existing plaque emission pattern) only.
- Player-facing strings: Branch Zero stays bank words; social/brand walls may use handle / product names as credits (not protocol jargon dump).

---

## DoD

- [ ] Entrance lintel clearly reads **Branch Zero** in bank voice
- [ ] One exterior flank: `@JaCoderX` + GitHub / Telegram / X, street-art style
- [ ] Other exterior flank: Bloxchain + by ParticleCS with remapped logos, same mural language
- [ ] Interior art-deco (lobby, partners board, counters) unchanged in meaning
- [ ] No cyberpunk lighting / materials language; contrast is mural-only
- [ ] CREDITS entries for logo sources; WORLD-3D and/or REFLECTION note filed
- [ ] `:5173` walk from spawn shows the easter egg without blocking the door; budget gates hold

---

## After this pass

- Append a short `docs/progress/2026-09-09-exterior-street-art-easter.md` (or same-day progress note).
- Point `HANDOFF-CC.md` only if the principal wants the main index updated.
- Do not fold this into ship packaging scope without a separate ask.
