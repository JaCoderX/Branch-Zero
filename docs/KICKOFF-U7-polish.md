# Kickoff prompt — U7 polish (principal playtest pass)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck
on click-to-move raycasts or vault-interior budget after one honest attempt.

**What this is:** a **principal-driven polish unit** after Stages 1–5 art and the ship reel. Layout feel, NPC
homes, controls, vault payoff, and Arc elevator honesty. It is **not** Stage 6 art, **not** Arc revive / funding,
**not** ship packaging (title cards / submission), **not** a greybox redesign.

**Why now:** construction is ahead of schedule; principal playtested MockChain and filed ten findings. Reflect
before inventing scope.

**Baseline:** Main wing dressed (Stages 1–5 met). U6 Arc **DEFERRED**. Ship reel met (laptop-local). Open URL for
day-to-day: `http://localhost:5173/?mock=account` (or `:5174` if another stack owns `:5173`).

**Finding → work map (do not drop items):**

| # | Finding | Fix |
|---|---------|-----|
| 1 | F* teleports fired without principal pressing them | Not DemoWalk (`?demo=walk` only). F2–F8 are greybox teleports in `main.gd`. **Gate behind `?debug=1` (or equivalent)** so normal playtests never teleport. Document. |
| 2 | Manager entrance shows glass/rail sill | Split/shorten `MgrRail` (and any mullion) so door gap `x ∈ [-9, -7]` at `z = -5` is empty |
| 3 | Petra on wrong side of wall | Move Petra to **Counter 2** teller bay (`Counter2` at `z = -1`, teller `x ≈ -11.6`, face lobby like Dev). Move Name Desk interactables / names board with her (or onto C2 wall). She must not sit north of manager glass |
| 4 | Manager faces away from entrance | Okafor yaw `+= PI` (face entrance / `+Z`) |
| 5 | Ines after the desk | Place Ines **between north wall and AO desk** (`z` north of desk ≈ 9.x), facing the room (yaw `PI`) |
| 6 | RMB move | Hold RMB → walk toward mouse ground aim; single RMB → `walk_to` pointed location. Reuse `steer_target` / `walk_to`. Cancel on WASD / UI lock. Keep LMB orbit |
| 7 | Vault keeper name | Rename **Ruth → Bob** everywhere product-facing (NPC table, dialogue JSON, strings, escort line, tests). Role unchanged |
| 8 | Keys | Interact = **Space only** (drop E). Cam right = **E** (replace R). Update HUD legend + all `[E]` prompts (talk + elevator) → `[Space]` |
| 9 | Vault OPEN empty | Add shallow vault **interior** behind the door: shelves + money/stack props readable when OPEN. Budget via `run_viz_budget` |
| 10 | Elevator → Arc = black canvas | Arc is deferred. Elevator to Arc must **not** rebuild/tear the interior. Diegetic refuse: toast / plaque / line **"ARC floor — coming soon / under construction"**. Stay on Main |

**Also heal if still broken after moves:** sticky interact prompt (wrong NPC name) and zone chip mismatches — fix volumes / `_nearest` after homes move. No Name Desk zone exists today; Petra currently inherits Manager's office.

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — U7 polish ONLY (principal playtest findings 1–10).
Freedom on HOW. No freedom on constraints.
This is NOT Stage 6 art, NOT Arc revive/funding, NOT U7 ship packaging, NOT Uniswap, NOT zone footprint redesign.

BEFORE CODE — read in order:
1. docs/HANDOFF-CC.md
2. docs/KICKOFF-U7-polish.md
3. docs/NPCS.md                    (homes / roles; Ruth→Bob; Petra station moves to Counter 2)
4. docs/GODOT.md                   (§5b canvas focus; web pitfalls)
5. docs/WORLD-3D-ENVIRONMENT.md    (budgets; vault legibility)
6. docs/ARC.md                     (§5b deferred — do not revive funding)
7. docs/DEV-LOOP.md
8. docs/REFLECTION.md

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Godot 4.5 GDScript, web export, threads OFF, Compatibility. No SDFGI / SSR / volumetric fog / lightmaps.
- Preserve U4 freeze, U4+ Priority (Okafor hand-scan / Bob wait path), U5 ENS verbs. Do not change bridge,
  MockChain payment semantics, ROLE_SET, Privy policy, or teller-desk routes.
- Do NOT redesign zone footprints or navigation beyond: manager door clearance, NPC home/yaw edits, optional
  zone volume tweaks so chips/prompts match desks after Petra/Ines moves.
- Do NOT start Arc funding, deploy Arc contracts, or call switch_wing rebuild for 5042002 as a real wing swap.
  Elevator Arc = deferred message only.
- F-key teleports: gate behind debug query/flag so `?mock=account` never teleports. DemoWalk stays `?demo=walk` only.
- Perf: draws ≤ 350, mats ≤ 40, prefer ≤ 150k tris, `.pck` ≪ 15 MB. Re-run `tests/run_viz_budget.gd` after vault interior.
- Licence: Kenney / existing hero props / OFL only unless principal approves. Update CREDITS.md if new assets.
- Ports: prefer `:5173?mock=account`. If another stack owns it, `:5174?mock=account`. Do not start a second teller
  unless the principal asks for a real-bridge walk. Do not edit vite.config.ts defaults.
- Path-scoped commits. Do not advance HANDOFF past this polish into packaging unless asked.

OWN:
- apps/game/scripts/main.gd (NPCS homes/yaw, teleports gate, elevator refuse, prompts)
- apps/game/scripts/bank_interior.gd (MgrRail door gap; Counter 2 / Name Desk dress; vault chamber if built here)
- apps/game/scripts/player.gd (RMB move; cam bindings if local)
- apps/game/autoload/game_state.gd (input binds Space / E)
- apps/game/scripts/hud.gd (legend / prompts)
- apps/game/scripts/vault_door.gd + vault interior props
- apps/game/dialogue/*.json, strings.json (Bob rename; Arc coming-soon line if diegetic)
- apps/game/tests/run_checks.gd, run_viz_budget.gd (homes, Bob, door clear)
- CREDITS.md / short docs/progress note if useful (progress is gitignored — local OK)

AVOID:
- apps/teller-desk, apps/web bridge (except prompt string if any), Arc funded keys, Stage 6 mesh climb,
  ship-package title cards, rewriting Priority/ENS graphs

SEQUENCE:
0. Confirm `?mock=account` does NOT start DemoWalk. Note current F-key behaviour; plan debug gate.
1. P0 layout: MgrRail door gap; Ines / Petra / Okafor homes+yaw; Petra at Counter 2 + board/interactables.
2. P0 Arc elevator: refuse with coming-soon; no interior teardown.
3. P0 Ruth→Bob rename (product-facing + tests).
4. P1 controls: Space interact, E cam-right; update all prompts/legend.
5. P1 RMB hold + click-to-move on floor raycast; cancel on WASD / ui_locked.
6. P2 vault interior + money readable on OPEN; budget check.
7. Soft: zone volumes / _nearest if prompts still lie.
8. Verify: run_checks + run_viz_budget; MockChain walk Ines→Dev→vault→Bob→Okafor→Petra@C2; elevator Arc message;
   no F-teleport without debug. Progress note. Stop.

DoD:
- Cold walk without F-keys: desks correct; manager doorway empty of rail/sill.
- Petra at Counter 2 (lobby/teller side); Ines between wall and AO desk facing room; Okafor faces entrance.
- Space talks; E orbits right; RMB click/hold moves; LMB orbit intact.
- Vault OPEN shows money/interior.
- Elevator to Arc never blacks the canvas — coming soon only; Main wing stays.
- Bob everywhere the vault keeper was named; checks green; budget held or overages named with a cut list.

OUT OF SCOPE: Arc revive, Stage 6 art, Uniswap, ship packaging video/title cards, wiping Remote EVM,
rewriting bridge versions, greybox redesign of wing footprints.

Stop when DoD is met or a named blocker needs the principal.
```

## Conflict map

| Area | Polish agent | Packaging / Arc |
|------|----------------|-----------------|
| NPC homes, MgrRail, vault interior, controls | Yes | No |
| Elevator Arc refuse / plaque | Yes (deferred message) | No revive |
| Title cards / reel crop / ETHGlobal form | No | Packaging kickoff |
| Funded Arc keys / switch_wing rebuild | No | ARC.md §5b only |

## After this pass

Resume [`docs/KICKOFF-U7-ship-package.md`](./KICKOFF-U7-ship-package.md) for submission packaging, or principal
playtest again. Arc stays deferred until ARC.md §5b.
