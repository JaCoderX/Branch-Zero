---
type: handoff
title: Handoff — KayKit art-deco cast adaptation (lab-first)
audience: cold agent (Codex Luna / Claude Code — Opus not required)
created: 2026-09-09
product: Branch-Zero
objective: OBJ-2026-0004
mission: Prove in GameLab that KayKit Adventurers can be mesh-adapted toward bank / art-deco readable staff (e.g. vault keeper without full helm/plate) while Rig_Medium anims keep working — principal accepts lab evidence before any Branch-Zero land
plan: this file §Direction + cast board; work in ENG-2026-0015
kickoff: docs/KICKOFF-kaykit-artdeco-cast.md
baseline: Pass A bank palette sheets live on main (b749e24); soft fantasy tints OK; accessory debt documented
lab: ../GameLab/work/ENG-2026-0015-kaykit-artdeco-cast/
parallel_to: Load Account / ship packaging — do not steal those product missions
supersedes_in_part: docs/HANDOFF-kaykit-bank-variants.md Outcome “Pass B not needed” — mesh adaptation is now an open exploration; Pass A textures remain the live product cast until land is accepted
---

# Handoff — KayKit art-deco cast adaptation

You are a **cold agent**. Prefer this file + the kickoff + the lab ENG over chat memory.
Freedom on **how** inside the lab. No freedom on product land without principal accept.

**Authorized construction:** explore **mesh / silhouette adaptation** of KayKit Adventurers toward
bank / art-deco readable body language, **keeping Rig_Medium** so idle / walk / greet (and the other bank
clip aliases) still drive the body. Soft fantasy is optional — full plate + helmet on the vault keeper is
**over the top** for this lobby; the quest is our own variant cast, not “preserve pure dungeon Adventurers.”

**Where the work happens:** GameLab [`ENG-2026-0015-kaykit-artdeco-cast`](../../GameLab/work/ENG-2026-0015-kaykit-artdeco-cast/README.md).
**Branch-Zero stays on Pass A** (`*_bank_texture.png` + UV remaps) until the principal accepts lab stills + anim proof
and a separate land kickoff is filed.

**Kickoff (paste):** [`docs/KICKOFF-kaykit-artdeco-cast.md`](./KICKOFF-kaykit-artdeco-cast.md)

**Not this mission:** Silently swapping product meshes; Load Account; room rebuild; new third-party packs into the
public MIT tree; Mad Men photoreal suits as a hard dress code; deleting Kenney revert path.

---

## Principal intent (2026-09-09)

1. Pass A recolour made bank accents readable — **good enough to explore real variants**, not a final costume language.
2. Full fantasy bodies (esp. Knight helm/plate, Ranger quiver) are **too much** for an art-deco virtual bank.
3. Plan and prove in the **lab** before accepting into the game.
4. Body **rig must keep working** — movement / greet animations are part of the proof, not an afterthought.

---

## Baseline (do not regress in product)

| Item | State |
|------|--------|
| Live cast | `PropKit.USE_KAYKIT_CAST` + Pass A `*_bank_texture.png` + `KAYKIT_ROLE_CELLS` (commit `b749e24`) |
| Gates | `run_checks` / `run_viz_budget` / `smoke_kaykit_cast` green on Pass A |
| Anims | Bank aliases on Rig_Medium: idle←Idle_A, walk←Walking_A, sprint←Running_A, greet←Waving, work←Interact, refuse←Hit_A |
| Materials | ≤ 5 body albedos; mesh ≤ 40; mesh+particles ≤ 42 |
| Prior handoff | [`HANDOFF-kaykit-bank-variants.md`](./HANDOFF-kaykit-bank-variants.md) — Pass A met; accessory debt listed |

---

## Direction

| Knob | Change | Where |
|------|--------|--------|
| **Silhouette** | Soften / remove over-the-top fantasy parts toward bank staff read | Lab Blender on Adventurers glbs |
| **Vault keeper (hero case)** | Knight without full helmet + heavy plate → guard / jacket-adjacent | First mesh spike in ENG-0015 |
| **Others** | Board first; adapt after Bob proves anim-safe | Lab cast board |
| **Rig** | **Keep Rig_Medium bone names** — no new skeleton | Export check + Godot play |
| **Textures** | May keep Pass A palette language or re-paint cells after mesh change | Lab; land recipe later |
| **Product** | No land until principal OK on lab findings | Separate land kickoff |

### Suggested cast board (lab — not final)

| Role | Base | Problem today | Target read |
|------|------|---------------|-------------|
| Bob vault | Knight | Full helm + plate | Guard / security, bank-appropriate |
| Mo / player | Ranger | Quiver | Soft tunic / cape, no archery kit |
| Ines / Petra | Mage | Wizard hat / orb energy | Desk-robe / soft hat optional |
| Dev / Kenji | Rogue(+Hood) | Mask / dungeon hood | Counter cloth; hood optional for Kenji |
| Okafor | Barbarian | Bare chest / bear hood | Boss presence without raider kit |

Cute KayKit proportions and painted faces may stay — we are not requiring adult Mad Men meshes.

---

## Lab sequence (ENG-2026-0015)

1. **Board** — turnarounds / clay stills of stock vs proposed silhouette; principal picks direction.
2. **Anim control** — stock KayKit mesh: Idle_A, Walking_A, Waving on Rig_Medium (Godot or Blender).
3. **Hero spike (Bob)** — part-delete / light remesh; re-export glb; **same** Rig_Medium + anim libraries.
4. **Proof** — stills + short clip: bind pose, walk, wave. If skinning breaks → kill.
5. **Findings** — yes/no; optional second role; **do not** land Branch-Zero without handoff accept.
6. **If yes** — scrub → product land kickoff (derivatives + PropKit paths + gates).

---

## Hard gates (when landing — not yet)

Same as bank-variants: Compatibility, CC0 KayKit derivatives only, ≤5 body mats, mesh ≤40 / +particles ≤42,
draws ≤350, capsules / dialogue / clips unchanged, room untouched.

---

## DoD (lab exploration)

See [`KICKOFF-kaykit-artdeco-cast.md`](./KICKOFF-kaykit-artdeco-cast.md). Lab DoD ≠ product land DoD.

---

## Out of scope

Product mesh swap this pass; room / HUD / heroes; Quaternius / Mixamo; paid Mystery Series without principal OK;
rewriting NPC lines; Arc; Load Account.
