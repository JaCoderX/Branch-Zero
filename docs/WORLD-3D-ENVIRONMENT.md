# 3D World — The Branch Zero Building

> One building, two wings, eight zones. Built for legibility and a single-threaded web export, not for screenshots.

Related: [GAME-DESIGN.md](./GAME-DESIGN.md) · [NPCS.md](./NPCS.md) · [GODOT.md](./GODOT.md)

---

## 1. Art direction

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Style | Stylised low-poly, flat-shaded with subtle AO; strong silhouettes; no PBR micro-detail | Reads at small canvas sizes; cheap on integrated GPUs; fast to author |
| Cast | KayKit Adventurers — cute low-poly fantasy roles as bank staff (Ranger / Mage / Rogue / Knight / Barbarian), painted faces, soft toy cheer, dressed as bank staff by recoloured palette sheets — room neutrals (cream / brass / graphite) plus one accent per role: Mo emerald, Ines mustard, Dev oxblood, Bob coral cape on dark steel, Okafor oxblood sash, Petra coral on deep green, Kenji teal, player navy (`tools/kaykit_bank_variants.py`); room stays low-poly flat-shaded cream / brass / deep green | Principal lock 2026-09-09: fun interaction vibe over Mad Men dress; same KayKit language as lobby furniture; bank variants 2026-09-09 keep the five body materials |
| Palette | Warm marble cream, brass, deep green (main wing); cool graphite, white, USDC blue accents (Arc wing) | Wings must be distinguishable in a glance in the demo video |
| Lighting | One `DirectionalLight3D` through skylights + baked-look ambient via `Environment` (no real-time GI on web); a handful of `OmniLight3D` with shadows off | Web single-thread cannot afford SDFGI/VoxelGI |
| Camera | Third-person over-the-shoulder, 55° FOV, spring arm 3.2 m; snaps to fixed "counter cam" during dialogue | Dialogue framing like a film two-shot |
| Scale | 1 unit = 1 m; player capsule 1.8 m; counters 1.1 m; vault door 3.5 m tall | Realistic proportions sell the "bank" instantly |
| Typography in-world | Split-flap and LED boards use a monospace font; brass plaques use a serif | Signage carries a lot of narrative |

Reference boards: art-deco bank lobbies (symmetry, terrazzo floors), *Katamari*-era low-poly cheer, Kenney/Quaternius CC0 kits for props.

---

## 2. Floor plan — Main wing (Sepolia)

```text
                       N
   ┌──────────────────────────────────────────────┐
   │  MANAGER'S OFFICE (glass)   │  VAULT           │
   │  desk · shredder · stamp    │  antechamber:    │
   │                             │  bench · clock · │
   │                             │  LED · window    │
   │                             │  ══ VAULT DOOR ══│
   ├──────────────┬──────────────┴──────┬──────────┤
   │ NAME DESK    │      LEDGER BOARD    │ FX DESK  │
   │ (Registrar)  │   (split-flap wall)  │ (stretch)│
   ├──────────────┤                      ├──────────┤
   │ COUNTER 2    │        LOBBY         │ SECURITY │
   │ (Teller B)   │  greeter · benches   │ lore door│
   ├──────────────┤  plants · rope line  ├──────────┤
   │ COUNTER 1    │                      │ ELEVATOR │
   │ (Teller A)   │                      │ to Arc   │
   ├──────────────┴─────┬────────────────┴──────────┤
   │ ACCOUNT OPENING    │      ENTRANCE (revolving)  │
   │ desk w/ plant      │      spawn point           │
   └────────────────────┴───────────────────────────┘
                       S
   Footprint ≈ 30 m × 22 m, ceiling 6 m in lobby, 3.2 m in offices
```

### 2.1 Zone specs

| Zone | Size | Key props | Interactables | Notes |
|------|------|-----------|---------------|-------|
| Entrance | 6×4 | Revolving door, brass plaque "BRANCH ZERO — est. block 0", doormat | none | Spawn; camera intro pan |
| Lobby | 14×10 | Rope queue, 4 benches, 6 plants, water cooler, floor compass rosette, SE partners / event board, standalone lobby terminal | Greeter NPC, Ledger board, lobby `BankTerminal` | Ledger is a `SubViewport` texture, 8 rows; the SE board is static bank signage (Event → Partners → Bloxchain \| Particle) and the terminal is a public walk-up computer with no NPC |
| Account Opening | 6×5 | Desk, plant (landmark), two chairs, brochure rack, "Delegation" leaflet | Clerk NPC, brochure (lore) | Privy overlay appears here |
| Counter 1 & 2 | 6×4 each | Marble counter, glass partition with slot, stamp, dot-matrix printer, "Approved payees" wall list, service menu sign | Teller NPCs, printed receipt | Approved payees list is generated from `getFunctionWhitelistTargets` |
| Ledger board | 8×1 wall | Split-flap board, clock | read-only | Rows: id · type · payee · amount · status · release |
| Vault antechamber | 6×6 | Bench, magazine rack, wall clock (analog), LED strip on door frame, vault window | Vault Keeper NPC or terminal, magazine (lore) | Clock hands driven by `releaseTime - now` |
| Vault door | 3.5 h | Circular door with bolts (animated), status LED; shallow strongroom behind it (shelves, cash, bars — U7 polish) | door (non-enterable; opens 95° on release so the strongroom reads) | The player never goes inside (solid throat); the payment "leaves" |
| Manager's office | 6×5 | Glass walls, big desk, approval stamp, shredder, framed "Branch limits" poster | Branch Manager NPC, shredder | Poster text from config |
| Name Desk | 5×4 | Desk (records annex), board of "registered names" on the west wall; the engraver sits on Counter 2's shelf | Registrar NPC **at the Counter 2 teller bay** (U7 polish), engraver | Board lists recent `LabelRegistered` events |
| Elevator | 3×3 | Two-button panel "MAIN / ARC", floor indicator, "ARC floor — coming soon" notice | panel | Arc **deferred** (ARC.md §5b): the car refuses with the coming-soon line and the Main wing stays; wing swap code kept for revive |
| FX Desk (stretch) | 4.8×3 | Ticker board, longer dealer window | Dealer NPC | Quote text from Uniswap |
| Side door | 2×3 | "SECURITY" sign, keypad | Security Officer NPC | Compact lore door in the former elevator band; S2 stretch otherwise |

South entrance easter egg (2026-09-10): the existing brass lintel keeps the bank-voiced `BRANCH ZERO` title. The west
run (`WallS_a`, x < 3) carries an enlarged 5.5 × 2.75 m cream-paper / graphite / muted-coral paste-up for `@JaCoderX`
with GitHub, Telegram and X marks, centered at x≈−0.1 beside the gap. The east run (`WallS_b`, x > 7) carries a matching
5.5 × 2.75 m paste-up for `Bloxchain` and `by ParticleCS`, centered at x≈10.1. Both ease into the wall with a soft inner
edge fade and a matte, low-contrast procedural brick underlay; thin, non-colliding quads sit outside the south face and
leave ~35 cm of clear masonry before the entrance gap. The entrance gap, revolving door, lighting and interior partners
board remain unchanged. These are visual credits only, with no click-out.

East-column placement pins (north → south): vault partition z = −5.0; expanded FX counter/shelf z ∈ [−4.4, 0.4],
centre −2.0; SECURITY door z ∈ [1.0, 2.0], centre 1.5; elevator centre z = 5.5, shaft z ∈ [4.0, 7.0].
The FX assembly is pulled west by 1.2 m, then the counter/shelf/tools another 0.35 m (`FX_DESK_FORWARD`) so the
desk face clears Kenji; Kenji/stool stay at x ≈ 13.65 / 13.7. The PC screen sits on the **north** half of the staff
shelf (z ≈ −3.15), not on Kenji's standing centre. East-wall FX signs remain at x ≈ 14.8. The elevator door face
remains at x ≈ 11.46, and the south-wall entrance gap x ∈ [3, 7] is unchanged.

### 2.2 Navigation

- Single `NavigationRegion3D` baked per wing; NPC "walk with me" waypoints for the teller escort to the vault.
- Player: `CharacterBody3D`, 4 m/s walk, 6.5 m/s jog, no jump (keeps colliders trivial).
- Interaction: `Area3D` triggers with `[Space]` prompt (U7 polish: Space talks, Q/E orbit); dialogue locks movement and switches camera.
- Mouse: LMB drag orbits; wheel zooms the boom in/out inside 2.8–9.0 m; RMB click walks to the pointed floor spot, RMB hold steers toward the cursor (U7 polish).

---

## 3. Arc wing (second scene)

Same footprint, mirrored, different dressing:

- Materials: graphite floors, white walls, USDC-blue accent lighting.
- Signage: "Fees are paid in dollars here", "Finality: under a second".
- Counters identical; the FX desk is replaced by a "Treasury" window (set dressing) or omitted.
- Ledger board reads the Arc account.
- Vault identical (same contract behaviour).

Rather than duplicate scenes, the wing is a **theme resource** applied to the same layout scene (`bank_interior.tscn` + `WingTheme.tres`). Elevator swaps theme + chain context; the Godot scene does not reload.

---

## 4. Scene tree (authoring layout)

```text
Main.tscn
├── World (Node3D)
│   ├── BankInterior (bank_interior.tscn)      # static meshes, colliders, nav region
│   │   ├── Zones/ (Area3D per zone → emits zone_entered)
│   │   ├── Props/ (MeshInstance3D, StaticBody3D)
│   │   ├── Interactables/ (interactable.tscn instances)
│   │   ├── LedgerBoard (SubViewport + MeshInstance3D)
│   │   ├── VaultDoor (vault_door.tscn: AnimationPlayer, LED material param)
│   │   └── Elevator (elevator.tscn)
│   ├── NPCs/ (npc.tscn instances, see NPCS.md)
│   ├── Player (player.tscn: CharacterBody3D + SpringArm3D + Camera3D)
│   └── Lighting (DirectionalLight3D, WorldEnvironment)
├── UI (CanvasLayer)
│   ├── HUD (passbook, prompt)
│   ├── Dialogue (panel, choices)
│   ├── Forms (payment_slip.tscn, name_claim.tscn)
│   └── Receipts (side panel)
└── Systems (Node)
    ├── GameState (autoload)     # account, chain, pending cache
    ├── Bridge (autoload)        # JavaScriptBridge wrapper, see GODOT.md
    ├── DialogueRunner (autoload)
    └── AudioBus (autoload)
```

---

## 5. Asset pipeline

| Source | Use | Licence check |
|--------|-----|---------------|
| Blender 4.x | Custom hero props: vault door, counters, split-flap board, elevator panel, stamp, printer | ours |
| Kenney (kenney.nl) | Furniture, plants, office props, characters base | CC0 |
| Quaternius | Low-poly characters + animations (idle, talk, type, walk, stamp via retarget) | CC0 |
| Mixamo (optional) | Extra animations retargeted to Godot humanoid | Adobe licence — verify allows game use; prefer Quaternius |
| Freesound / Kenney audio | Stamps, printer, split-flap, bolt, ambient | CC0/CC-BY — credit in README |
| Fonts | Inter (UI), JetBrains Mono (boards), a free serif for plaques | OFL |

Pipeline rules:
- Export **glTF 2.0 (.glb)** from Blender with `+Y up`, apply transforms, 1 unit = 1 m.
- Textures ≤ 1024², atlas props per zone; use vertex colours where possible (flat-shade look, zero texture memory).
- Import presets in Godot: `Mesh → Generate LODs on`, `Lightmap UV off` (no lightmaps on web build v1), compress to **Basis Universal** for web.
- Naming: `prop_<zone>_<name>.glb`, `npc_<role>.glb`, `mat_<name>.tres`.
- **Public-repo intake:** only redistribution-safe licences (true CC0 / OFL fonts). "Free for commercial games" is not enough if the licence bans republishing raw assets. Style must pass the art bible (this §1) — see Stage 6 [`KICKOFF-U7-viz-stage6.md`](./missions/KICKOFF-U7-viz-stage6.md) and GameDevOS card `public-repo-asset-intake`.

---

## 6. Performance budget (single-threaded web export)

| Metric | Budget | How we hold it |
|--------|--------|----------------|
| Draw calls | ≤ 350 per frame | Static mesh merging per zone; MultiMesh for plants/benches |
| Triangles | ≤ 400k on screen | Low-poly kits; LODs |
| Materials | ≤ 40 unique on meshes (≤ 42 with Stage 5 particle billboards) | Shared PropKit palette + ≤ 5 KayKit body albedos; LODs |
| Lights with shadows | 1 (directional) | Omni lights without shadows |
| Texture memory | ≤ 128 MB | Basis compression, 1k caps |
| Export size | ≤ 60 MB `.pck` + ~40 MB wasm | Strip unused assets; mono audio at 22 kHz for SFX |
| Frame time | ≤ 16 ms on Intel Iris Xe, Chrome | Compatibility renderer (GLES3/WebGL2), no SDFGI, no SSR, no volumetric fog |
| Startup | ≤ 8 s on 50 Mbps | Preload lobby only; stream Arc theme materials |

Renderer: **Compatibility** (WebGL 2). Forward+ is not available on Web; Mobile renderer is possible but Compatibility has the widest browser support.

---

## 7. Lighting and mood recipes

**Main wing:** sun angle 35° from skylight; warm key (4800 K), cool fill from windows; `Environment` tonemap ACES, exposure 1.1, subtle fog for depth at the far wall; brass emissive on plaques.

**Arc wing:** key from ceiling panels (6500 K), blue emissive strips along counters, no fog, higher contrast.

**Vault antechamber state lighting:**
- PENDING: LED strip red (`emission_energy 2.0`), clock ticking.
- Released: LED green, door bolts retract (0.8 s), door opens 30°, bloom pulse once.
- CANCELLED: LED amber, then off; door stays shut.

---

## 8. In-world data displays

| Display | Data source | Refresh |
|---------|-------------|---------|
| Ledger board | `getPendingTransactions` + `getTransactionHistory(last 8)` | SSE push from Teller Desk; fallback poll 5 s |
| Approved payees list (counter wall) | `getFunctionWhitelistTargets(ERC20_TRANSFER_SELECTOR)` + ENS reverse name if any | On zone enter |
| Service menu (counter sign) | `getSupportedFunctions` → `getFunctionSchema` operationName | On zone enter |
| Vault clock | `getTransaction(txId).releaseTime` vs chain `block.timestamp` (not wall clock) | Every 2 s |
| Branch limits poster | Teller Desk config | Static |
| Names board | `LabelRegistered` events on our UserRegistry | On zone enter |
| Elevator indicator | current chain id | On switch |

Everything rendered in-world is text on a `SubViewport` → `ViewportTexture` on a quad; keeps 3D scenes simple.

---

## 9. Build order for the world (matches PLAN days)

1. **Day 1:** blockout with CSG/`BoxMesh` — walls, counters, door, nav region, player, camera.
2. **Day 4:** replace CSG with kit meshes; zones + interactables; boards as SubViewports.
3. **Day 5:** materials pass, lighting recipe, vault door animation.
4. **Day 7:** Arc theme resource; elevator.
5. **Day 8:** props, particles (stamp ink, dust in skylight), audio, camera polish.

---

## 10. Acceptance checklist

- [ ] A first-time viewer can name every zone from the demo video without narration.
- [ ] The vault door state is legible from the lobby (LED colour + clock).
- [ ] Both wings are distinguishable in a single frame.
- [ ] Web build holds 60 fps in Chrome on an integrated GPU at 1080p.
- [ ] No asset without a licence entry in `CREDITS.md`.
