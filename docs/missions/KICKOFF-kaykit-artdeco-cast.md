---
title: Kickoff prompt — KayKit art-deco cast (lab-first)
created: 2026-09-09
product: Branch-Zero
model: Codex Luna xhigh or Claude Code (Opus not required)
handoff: docs/missions/HANDOFF-kaykit-artdeco-cast.md
lab: ../GameLab/work/ENG-2026-0015-kaykit-artdeco-cast/
---

# Kickoff prompt — KayKit art-deco cast adaptation

Paste into a **new** session that owns the **GameLab** engagement (or a dual-root session with GameLab as the write
target). Do **not** land mesh changes into Branch-Zero product until the principal accepts lab findings.

**What this is:** Lab exploration — adapt KayKit Adventurers toward **bank / art-deco readable** body language
(e.g. vault keeper without full helm and plate), **keeping Rig_Medium** so walk / idle / greet still work. Plan and
prove before product accept. Pass A palette cast stays live in Branch-Zero.

**Why:** Pass A accents work, but fantasy silhouettes (Knight armor, Ranger quiver, …) are over the top for this
lobby. Principal wants our own variant cast, planned in the lab.

**Parallel:** Load Account / ship packaging — do not touch.

---

## Reflect

| Fact | Implication |
|------|-------------|
| Pass A is on `main` (`b749e24`) | Product playable; lab can fork assets without blocking ship |
| Rig_Medium + Character Animations already wired | Remesh must **not** rename bones or the bank clips die |
| Helmet / quiver called out by principal | Bob-first spike is the right kill test |
| Public MIT + CC0 | Lab may copy Adventurers; land only scrubbed CC0 derivatives |
| Mat budget ≤5 body sheets | Mesh edits cannot invent a sixth albedo without a plan |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: GameLab ENG-2026-0015 — KayKit ART-DECO CAST adaptation. Answer whether we can mesh-adapt
KayKit Adventurers (keep Rig_Medium) into bank-readable staff silhouettes — starting with Bob/vault
(Knight without full helm/plate) — such that Idle_A, Walking_A, and Waving still play correctly.
Principal must accept lab stills + anim proof before any Branch-Zero product land.
Freedom on HOW in the ENG folder. No freedom to edit Branch-Zero live cast this pass.

BEFORE WORK — read in order:
1. Branch-Zero docs/missions/HANDOFF-kaykit-artdeco-cast.md
2. Branch-Zero docs/missions/KICKOFF-kaykit-artdeco-cast.md
3. GameLab work/ENG-2026-0015-kaykit-artdeco-cast/README.md
4. Branch-Zero docs/missions/HANDOFF-kaykit-bank-variants.md (Pass A baseline + accessory debt)
5. Branch-Zero docs/WORLD-3D-ENVIRONMENT.md §1 cast row
6. GameLab docs/ENGAGEMENT.md · docs/SANDBOX.md · policy/hard-stops.md · policy/isolation.md
7. GameDevOS card public-repo-asset-intake (if landing later)

Local roots:
- Lab writes: D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0015-kaykit-artdeco-cast\
- Product read-only this pass: D:\My Git Projects\D9-Studio\Branch-Zero
- Source assets (copy into ENG, do not mutate product in place): 
  Branch-Zero/apps/game/assets/characters/kaykit_adventurers/
  Desktop packs OK if hashes match CREDITS

HARD RULES:
- Work inside the ENG folder only. Do not commit Branch-Zero mesh/texture product changes this pass.
- Keep Rig_Medium bone names and skinning. Anim proof required (idle + walk + wave minimum).
- Blender 4.5.5 host: GameLab runtimes/blender/scripts/run-host.ps1
- Godot proof: Branch-Zero 4.5.2 or GameLab Godot — document the recipe in the ENG README Log.
- CC0 KayKit only. No Mixamo / Quaternius into a future public land without a new intake decision.
- Kill criterion: if Bob adaptation breaks skinning/anims, or loses cheer without gaining bank read → stop,
  write findings "no" / "it depends". Do not force product land.
- Append GameLab log.md when you open/run/find. Update work/index.md on close/hand-off.

OWN: ENG-2026-0015 tree (board stills, adapted glbs, captures, findings.md, optional handoff.md).
AVOID: Branch-Zero apps/game product cast land; bank_interior; Load Account; dialogue lines; room props.

SEQUENCE:
0. Copy needed Adventurers glb + textures + one Rig_Medium anim library into the ENG folder (provenance table).
1. BOARD — stills: stock Knight / Ranger / Mage vs proposed bank silhouettes. Pause for principal if direction unclear.
2. ANIM CONTROL — stock Knight (or Mannequin): play Idle_A, Walking_A, Waving; capture proof.
3. BOB SPIKE — remove/hide helm + heavy plate (or rebuild soft guard jacket) on Knight; export glb; verify weights.
4. ANIM PROOF — same clips on adapted Bob; still + short clip side-by-side with control.
5. FINDINGS — answer the ENG question; list what transfers to product vs what failed.
6. STOP — principal accept → then a *separate* Branch-Zero land kickoff. No silent merge.

DoD (lab):
- Written answer in findings.md (Yes / No / It depends).
- Re-run recipe documented (Blender version, files, Godot/play steps).
- Anim proof artefact: adapted Bob walks and waves without broken limbs / obvious weight errors.
- Board stills show intended bank read vs stock fantasy (at least Bob).
- Branch-Zero product cast unchanged this pass.
- work/index.md + log.md updated when answered.

OUT OF SCOPE: Landing meshes into Branch-Zero; full eight-role remesh before Bob is proven; Mad Men hard dress
code; new character packs; room art.
```

---

## After a Yes

File a short Branch-Zero **land** kickoff (derivatives path, PropKit map, gates). Until then Pass A remains live.
