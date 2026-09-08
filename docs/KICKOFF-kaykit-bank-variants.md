---
title: Kickoff prompt — KayKit bank variants
created: 2026-09-09
product: Branch-Zero
model: Codex Luna xhigh or Claude Code (Opus not required)
handoff: docs/HANDOFF-kaykit-bank-variants.md
---

# Kickoff prompt — KayKit bank variants

Paste into a **new** Cursor / Claude Code session, separate from any Load Account or packaging session.

**What this is:** Keep the locked **KayKit Adventurers** cast vibe and author **bank-readable variants**
(texture / accessory / light mesh ladder) so each of the seven staff + player reads as that bank job at lobby
distance. Soft fantasy is allowed. **Room / furniture / heroes stay as-is.**

**Why:** Principal liked stock KayKit in the bank (Stage 3 lock) but wants variants that fit the bank story —
not Mad Men suits on Kenney, not more charm-face work on the old cast.

**Parallel:** Load Account / ship packaging keep their own handoffs — do not touch their files.

---

## Reflect

| Fact | Implication |
|------|-------------|
| `USE_KAYKIT_CAST` is live; ≤5 PropKit body albedos | Variants must stay within **5** unique character materials (or pack into ≤5 keys) |
| Five free bodies for eight roles | Mage×2 and Ranger×2 are tint/alt-texture splits, not new meshes |
| Adventurers PNGs are tiny (~13–15 KB) | Recolour is cheap; remesh is expensive — ladder starts at texture |
| Painted faces, no face sheet | Do not reintroduce Kenney `face_sheet` / outline unless principal flips cast switch |
| Charm handoff still says Mad Men | **Superseded** for live cast — read this handoff first |
| GameLab exists for Blender spikes | Prefer `ENG-*` for mesh/accessory experiments; land scrubbed CC0 derivatives in Branch-Zero |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero — KayKit BANK VARIANTS only. Keep PropKit.USE_KAYKIT_CAST and the Adventurers
Rig_Medium pipeline. Author cast-only derivatives so Mo / Ines / Dev / Bob / Okafor / Petra / Kenji / player
read as bank roles at ≈15 m while staying cute KayKit. Soft fantasy OK. Ladder: (1) texture/palette + one
accent per role, (2) hide/remove loud weapons/accessories, (3) light mesh trim only if needed. Room,
furniture, heroes, HUD, particles, lighting: untouched.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-kaykit-bank-variants.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/KICKOFF-kaykit-bank-variants.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/WORLD-3D-ENVIRONMENT.md   (§1 cast row, §6 budget)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/CREDITS.md   (KayKit Adventurers + Character Animations row)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (roles / names — do not rewrite lines)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
8. Craft: GameDevOS public-repo-asset-intake card; lessons style-the-cast-separately-from-the-set,
   asset-must-fit-the-world-not-just-the-licence, complexity-is-not-charm
9. History only (do not revive Mad Men as the live goal):
   docs/HANDOFF-character-charm.md · docs/HANDOFF-character-style.md

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Live cast: apps/game/scripts/props.gd (USE_KAYKIT_CAST, KAYKIT_MESHES, kaykit_body_material, character_kaykit)
Assets: apps/game/assets/characters/kaykit_adventurers/
Smoke: apps/game/tests/smoke_kaykit_cast.gd
Kenney revert path: character_kenney + kenney_staff/ — do not delete; do not make it live.

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF, Compatibility.
- Public MIT → true CC0 derivatives of KayKit Adventurers / Character Animations only. CREDITS + sha256.
- Mesh materials ≤ 40; mesh + Stage 5 particles ≤ 42; draws ≤ 350; tris ≤ 400k; .pck ≪ 15 MB.
- Character body albedos ≤ 5 unique (PropKit cache). Rogue + Rogue_Hooded may keep sharing rogue_texture
  unless a bank variant needs a second rogue sheet — then still fit in the five-budget (drop elsewhere).
- Preserve bank clip names idle / walk / sprint / work / refuse / greet and npc/player wiring.
- Colliders stay U3 capsules. Escort / dialogue / run_action graphs unchanged.
- Ports: Godot editor + MockChain day-to-day; web check only :5174 ?mock=account. Never :5173 / :8787.
- Progress note is laptop-local (docs/progress gitignored) if you write one.
- Do NOT touch Load Account / teller-desk / bridge / ens* / treasury / partners board / HANDOFF-CC first_mission.

OWN: apps/game/assets/characters/kaykit_adventurers/** (derivatives), NEW tools under apps/game/tools/ for
recolour/export if needed, PropKit kaykit_* paths only as required, CREDITS.md, WORLD-3D §1 if the cast
bible needs a one-line update, this handoff/kickoff if you must correct facts.
Optional: GameLab work/ENG-*-kaykit-bank-variants for Blender spikes (scrub before product land).

AVOID: bank_interior shell, kaykit_furniture / kenney_nature / hero props, hud.gd, feel particles,
dialogue/*.json, main.gd beyond unavoidable wiring, apps/teller-desk, apps/web, MockChain, Load Account,
kenney_staff charm/face revival, Quaternius / Mixamo / paid Mystery Series without principal OK.

SEQUENCE:
0. Baselines: run_checks + run_viz_budget + smoke_kaykit_cast green; note mats / draws; capture lobby stills "before".
PASS A — texture / palette
1. Recolour Adventurers textures (or export new sibling PNGs) per the handoff wardrobe sheet: room neutrals +
   one accent per role; Ines vs Petra and Mo vs player must be tellable by tint alone.
2. Point PropKit.KAYKIT_TEXTURE_FILES / kaykit_body_material at the derivatives; keep ≤5 unique mats.
3. Gates green; lobby 15 m stills "after A". Stop here if DoD met.
PASS B — accessories (only if A fails role-read)
4. Hide/remove weapons, quiver, loud mage props from default bank meshes (Blender preferred in GameLab ENG).
5. Re-export glbs; preserve Rig_Medium bone names for existing anim libraries.
6. Gates green; stills "after B".
PASS C — light mesh trim (only if B fails)
7. Soften armor/cape/hood minimally; no new rig; no adult-proportion rebuild.
8. Gates green; CREDITS sha256; local progress note. Stop.

DoD:
- At lobby cam (≈15 m) Mo / Ines / Dev / Bob / Okafor / Petra / Kenji are tellable by silhouette + accent
  as bank roles (not an undifferentiated dungeon party). Soft fantasy OK.
- Cute KayKit vibe preserved (principal liked Stage 3 stock feel — do not "adultify" into dull suits).
- ≤ 5 character body materials via PropKit; mesh mats ≤ 40; with particles ≤ 42; draws ≤ 350; tris ≤ 400k;
  run_checks + run_viz_budget + smoke_kaykit_cast PASS; escort + dialogue + capsules unchanged.
- CREDITS updated for new derivative hashes; licence remains CC0 KayKit.
- Room / Load Account / chain untouched; Kenney staff remains available behind USE_KAYKIT_CAST false.

OUT OF SCOPE: room / heroes / HUD; new NPCs or lines; Mad Men as a hard dress code; Kenney face sheet;
yellow-licence kits; Arc; ship packaging; Load Account.

Stop when DoD met, or when a named budget / readability blocker needs a principal cut (smallest honest
fallback: Pass A shipped alone with accessory debt documented in the handoff Outcome).
```

---

## After this pass

Product construction stays **Load Account → ship packaging** unless the principal reorders. The KayKit Stage 3
lock remains the live cast baseline; this file owns the *bank variant* climb on top of it.
