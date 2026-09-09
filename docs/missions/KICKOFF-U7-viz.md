# Kickoff prompt — U7 early viz (art pass off the U4+ checkpoint)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck
on Godot web export size or Compatibility-renderer lighting after one honest attempt.

**What this is:** an **early slice of U7 Feel / ship** (G8 art), started from the U4+ greybox freeze. It is **not**
the full U7 ship unit (video, submission, G9–G10). It is **not** U5 ENS and must not block or rewrite U5.

**Timing (principal owns this):** do not edit the same Godot scenes / scripts that an U5 agent is touching in the
same window. Sequence U5 Name Desk wiring and this art pass so they do not overlap in code or calendar. No
dedicated git branch is required if that scheduling holds.

**Ports (when U5 is also running):** day-to-day art in the Godot editor (MockChain). For a web export check only:
`npm -w apps/web run dev -- --port 5174 --strictPort` → `http://localhost:5174/?mock=account`. Leave `:5173` and
Teller Desk `:8787` to U5 — do not start a second desk. Do not change `vite.config.ts` defaults (`5173` /
`strictPort: true` will `EADDRINUSE` if you fight for the primary port).

**Base:** U4+ checkpoint — [`docs/progress/2026-09-07-u4-plus-checkpoint.md`](./progress/2026-09-07-u4-plus-checkpoint.md)
(principal playtest green; layout + desks frozen). Art direction and budgets:
[`docs/WORLD-3D-ENVIRONMENT.md`](../WORLD-3D-ENVIRONMENT.md).

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — early U7 visualization / art pass ONLY (materials, lighting, kit props, CC0 characters).
Freedom on HOW. No freedom on constraints.
This is NOT U5 ENS, NOT U6 Arc, NOT full U7 ship (video / submission). Do not open those units.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-CC.md   (freeze + U4+ findings; current product mission stays U5)
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u4-plus-checkpoint.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u4-mvp-freeze.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1 art direction, §5 pipeline, §6 budget, §7 lighting)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GAME-DESIGN.md   (zones; protocol↔world table — do not invent new desks)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§5b canvas focus; §8 web pitfalls; size)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (roles / silhouettes only — do not rewrite dialogue trees)
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
9. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- Godot 4.5.2 standard + web templates (see README / progress U0)

HARD RULES:
- Godot 4.5 GDScript, web export, threads OFF. Compatibility renderer. No SDFGI / VoxelGI / SSR / volumetric fog.
- Godot never holds keys / never talks RPC; no JavaScriptBridge.eval. Do NOT add bridge methods, Teller Desk
  routes, Privy surfaces, or MockChain behaviour.
- Do NOT change lane semantics, roles, ROLE_SET_VERSION, Privy policy, or dialogue/action graphs
  (Dialogue → GameState.run_action → Chain.call_async stays as-is).
- Do NOT redesign zone footprints or navigation. Replace CSG/box greybox with kit / Blender meshes **in place**.
- Protect the freeze: one Account Opening modal; Priority Passkey only on Okafor’s bypass; canvas re-focus after
  overlays; collider lesson — props that block must collide (layer 1) but not listen (mask 0); keep plants/props
  off door gaps and escort waypoints.
- Licence everything: Kenney / Quaternius / Freesound / OFL fonts only unless the principal approves otherwise.
  Create or update CREDITS.md. No Mixamo unless licence verified for this use.
- Pipeline: glTF 2.0 (.glb), +Y up, 1 unit = 1 m, textures ≤ 1024², Basis Universal for web, naming from WORLD-3D §5.
- Perf budget (WORLD-3D §6) is law. Re-measure after imports: draw calls, tris, unique materials, `.pck` + `.wasm`.
  First-load win is still host brotli on `.wasm` — do not "fix" size with a pre-compress plugin in export:web.
- Name Desk: leave interactables and Petra wiring alone. Dress the zone (desk, engraver prop, wall board quad) so
  U5 can attach NPC + name-claim form + SubViewport names board without a second layout pass. Soft-finish only.
- Do not run or edit GameLab ENG folders. Do not wipe Remote EVM. Do not touch apps/teller-desk or apps/web bridge
  except if a prop somehow breaks canvas focus (then fix focus only — see GODOT.md §5b).
- Ports: if another agent owns the primary stack, do NOT bind :5173 or :8787. Prefer Godot editor play. Web check
  only: `npm -w apps/web run dev -- --port 5174 --strictPort` and open `http://localhost:5174/?mock=account`.
  Never start `dev:teller` for this mission. Do not edit vite.config.ts port defaults.

OWN (preferred files):
- apps/game assets: meshes, materials, textures, WingTheme / Environment, Lighting
- Prop scenes under Props/; vault door mesh/animation polish; MultiMesh plants/benches if needed
- CREDITS.md; optional short progress note under docs/progress/

AVOID overlapping with U5 (schedule around these):
- apps/game dialogue trees, errors.json, Petra NPC instance wiring, name_claim form, payment_slip name field
- autoload/chain.gd, mock_chain.gd, GameState run_action tables, bridge version bumps
- apps/teller-desk /ens/*, apps/web BranchZero ens* methods

SEQUENCE:
0. Confirm base: greybox walkable; run_checks.gd green; note current `.pck` / `.wasm` sizes (U4 freeze numbers).
1. Materials + lighting recipe for Main wing (WORLD-3D §7) — readable vault LED states from lobby.
2. Kit-mesh replace high-traffic props: counters, desks, benches, plants, vault door hero, ledger board frame
   (keep SubViewport texture path). Lobby must still read as a bank in one glance.
3. CC0 character bases for existing NPCs (silhouette + idle); do not re-author lines or escort paths.
4. Optional: stamp / printer / split-flap SFX placeholders (CC0) — volume low; no music pass required.
5. Export web; preview on :5174 with ?mock=account (not :5173); measure vs WORLD-3D §6; fix budget breaches
   before more props.
6. Progress note (what changed, sizes before/after, licence list). Do NOT advance HANDOFF past U5.
   Full U7 (G8–G10 video + submission) stays a later unit.

DoD (early viz — not full G8):
- Main wing no longer reads as raw CSG boxes in a 30 s lobby→counter→vault walk (mock or real bridge).
- Vault door PENDING / released / CANCELLED still legible from the lobby (LED + clock).
- Freeze intact: run_checks.gd green; canvas focus; no new Privy modal; colliders do not shove plants/NPCs.
- Export sizes recorded; budget held or overages named with a cut list.
- CREDITS.md lists every third-party asset.
- Name Desk still free for U5 to wire Petra + claim form.

OUT OF SCOPE: ENS / bridge ens* (U5), Arc wing theme as a product unit (U6 — palette notes OK in WingTheme stub only
if it does not block U5), Uniswap FX desk, full audio/music pass, tutorial quest, achievements, demo video,
ETHGlobal submission, greybox redesign, rewriting NPC copy, Priority/Passkey/roles, wiping Remote EVM.

Stop when the early DoD is met or a named budget blocker needs a principal cut.
```

## Conflict map (for the principal)

| Area | Viz agent | U5 agent |
|------|-----------|----------|
| Lobby / counters / vault meshes & lights | Yes | No |
| Name Desk dress (static props only) | Soft | Owns interactables + Petra |
| `payment_slip` / forms / dialogue / errors | No | Yes |
| Bridge / Teller Desk / Privy | No | Yes |
| Vite `:5174` + `?mock=account` | Yes (preview only) | No — keeps `:5173` / `:8787` |
| `CREDITS.md` / materials / `.glb` | Yes | No |

## After this pass

**Stage 1 met** ([`docs/progress/2026-09-07-u7-early-viz.md`](./progress/2026-09-07-u7-early-viz.md)). Next art unit:
[`docs/missions/KICKOFF-U7-viz-stage2.md`](./KICKOFF-U7-viz-stage2.md) (hero polish). Product units stay on HANDOFF:
**U5 ENS** → U6 Arc → **full U7** Feel / ship (G8–G10).
