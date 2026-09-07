# Kickoff prompt — U7 viz Stage 2 (hero polish)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck
on Compatibility draw-call regressions or Blender→Godot LOD import after one honest attempt.

**What this is:** Stage 2 of the staged art climb — **hero polish only** (vault door, counters, board housings,
elevator panel). Stage 1 (legible bank) is **met**: [`docs/progress/2026-09-07-u7-early-viz.md`](./progress/2026-09-07-u7-early-viz.md)
(`76bcc65`). This is **not** Stage 3 (characters), **not** Stage 4 (wall shell), **not** full U7 ship, **not** U5 ENS.

**Ladder (do not skip ahead):**

| Stage | Goal | Status |
|-------|------|--------|
| 1 | Legible bank — kits + lighting + bake | **met** |
| **2** | **Hero polish — demo-critical props look intentional** | **met 2026-09-07** — [`progress/2026-09-07-u7-viz-stage2.md`](./progress/2026-09-07-u7-viz-stage2.md) |
| 3 | Character pass — adult-ish CC0 silhouettes | later |
| 4 | Shell architecture — walls stop reading as CSG | later |
| 5 | Feel — particles, fonts, HUD, video | full U7 |

**Timing (principal owns this):** do not edit the same Godot scenes / scripts an U5 agent is touching in the same
window. No dedicated branch required if that scheduling holds.

**Ports (when U5 is also running):** Godot editor + MockChain day-to-day. Web check only:
`npm -w apps/web run dev -- --port 5174 --strictPort` → `http://localhost:5174/?mock=account`. Leave `:5173` /
`:8787` to U5. Never start `dev:teller`. Do not edit `vite.config.ts` defaults.

**Art direction:** stylised low-poly, strong silhouettes, **no PBR micro-detail**
([`WORLD-3D-ENVIRONMENT.md`](./WORLD-3D-ENVIRONMENT.md) §1). “Higher res” here means cleaner bevels + optional
shared atlas — not Unreal-style maps.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — U7 viz Stage 2 ONLY (hero polish: vault door, marble counters, ledger/names board frames,
elevator panel). Freedom on HOW. No freedom on constraints.
This is NOT Stage 3 characters, NOT Stage 4 wall shell, NOT full U7 ship, NOT U5 ENS, NOT U6 Arc.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-U7-viz-stage2.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u7-early-viz.md   (Stage 1 baseline + numbers)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1, §5–§7)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§5b, §8)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-U7-viz.md   (Stage 1 rules still apply except scope)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- Godot 4.5.2 + Blender 4.x (hero_props.py already regenerates assets/models/hero/*.glb)

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility renderer. No SDFGI / VoxelGI / SSR / volumetric fog / lightmaps.
- Do NOT add bridge methods, Teller Desk routes, Privy surfaces, or MockChain behaviour.
- Do NOT change footprints, zones, lanes, roles, dialogue, escort paths, or collider layer/mask rules
  (block = layer 1, mask 0). Keep door gaps and escort waypoints clear.
- Scope = hero props only: vault frame + door (bolts, clock plate, lobby LED repeater), Counter 1/2 marble counters
  (glass slot), ledger + names board housings, elevator panel. Optional tiny polish on stamp/printer/shredder only
  if budget still has room after the heroes.
- Do NOT replace Kenney furniture fill, plants, rugs, or Mini Characters (that is Stage 3–4).
- Do NOT redesign Name Desk interactables / Petra; NamesBoardQuad stays no_batch for U5 SubViewport.
- Materials: prefer shared WingTheme / PropKit cache. At most ONE shared atlas ≤ 1024² (Basis Universal for that
  atlas). No per-prop 2K PBR sets. Vertex colour + flat shade still preferred.
- LODs on import; keep or improve bake_static. When freeing meshes in bake, guard with is_instance_valid (Stage 1
  lesson — parent free frees children).
- Hard perf gates (fail → cut, do not ship): draw calls ≤ 350 incl. shadow pass; tris on screen prefer ≤ 150k
  (hard cap 400k); unique materials ≤ 40; 1 shadowed light; ≤ 8 omni lights on the merged interior (do not add a
  ninth); .pck stay well under 15 MB unless principal approves (Stage 1 was ~1 MB).
- Re-run tests/run_checks.gd, tests/run_mock_walk.gd, tests/run_viz_budget.gd after changes. Capture before/after
  with tests/viz_shots.tscn (or equivalent) for lobby→vault PENDING/OPEN and Counter 1.
- Ports: web preview on :5174 ?mock=account only. Never :5173 / :8787 / dev:teller. Do not edit vite.config.ts.
- Update CREDITS.md only if new third-party assets appear (prefer regenerating our hero_props.py output).
- Do NOT advance HANDOFF past U5.

OWN:
- apps/game/tools/hero_props.py, apps/game/assets/models/hero/*.glb
- props.gd / vault_door.gd / bank_interior.gd only as needed to place new heroes (no zone rewrite)
- WingTheme / shared atlas if introduced; CREDITS.md; docs/progress note for Stage 2

AVOID (U5 / later stages):
- dialogue, errors.json, Petra, name_claim, payment_slip name field
- chain.gd, mock_chain.gd, teller-desk, apps/web ens*
- Kenney character swap, wall CSG replacement, MultiMesh fill pass, HUD layout, particles, fonts

SEQUENCE:
0. Record Stage 1 baselines from the progress note (draw calls, mats, tris, .pck). Confirm run_checks + mock walk
   + run_viz_budget green before editing.
1. Rebuild vault frame + door in Blender (cleaner bevels, bolts, clock plate above swing, lobby LED repeater).
   Keep state legibility from the lobby (PENDING / OPEN / CANCELLED).
2. Rebuild Counter 1/2 marble counters (green top, brass, glass with slot) — same footprints/colliders.
3. Rebuild ledger + names board housings; keep SubViewport quads / no_batch paths.
4. Elevator panel polish (still U6-inactive copy is fine).
5. Re-import, bake_static, measure. If over gate → cut tris/LODs/atlas size before adding anything else.
6. Web export; :5174 ?mock=account; F6/E/F4 canvas focus still works.
7. Progress note + captures; CREDITS if needed. Do NOT start Stage 3.

DoD (Stage 2):
- Vault door + counters + board housings read as intentional hero props (not Stage 1 kit-simple) in lobby→vault
  and Counter 1 screenshots.
- Vault states still legible from the lobby (LED + clock / OPEN sign).
- All hard perf gates green; run_checks + mock_walk + run_viz_budget PASS; sizes recorded before/after.
- Freeze intact; Name Desk still free for U5; HANDOFF not advanced.
- CREDITS.md current.

OUT OF SCOPE: character swap (Stage 3), wall shell (Stage 4), particles/HUD/fonts/video (Stage 5 / full U7),
ENS/Arc/Uniswap, greybox redesign, ninth omni, PBR micro-detail, Mixamo.

Stop when Stage 2 DoD is met or a named budget blocker needs a principal cut.
```

## Conflict map (for the principal)

| Area | Stage 2 agent | U5 agent |
|------|---------------|----------|
| `assets/models/hero/*`, `hero_props.py` | Yes | No |
| Vault door / counters / board frames | Yes | No |
| Kenney fill / Mini Characters | No | No |
| Name Desk interactables + Petra | No | Yes |
| Bridge / Teller Desk / `:5173` | No | Yes |
| Vite `:5174` mock preview | Yes | No |

## After this pass

Next art unit: **Stage 3** (Quaternius / adult-ish CC0 characters). Product mission stays **U5 ENS** until HANDOFF
says otherwise. Full U7 Feel / ship remains G8–G10.
