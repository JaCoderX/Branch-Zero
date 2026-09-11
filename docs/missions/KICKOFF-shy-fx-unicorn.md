---
title: Kickoff prompt — Shy FX unicorn (Uniswap folklore ambient)
created: 2026-09-11
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-shy-fx-unicorn.md
---

# Kickoff prompt — Shy FX unicorn

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**.

**What this is:** land a shy pink Minecraft-style unicorn near Johnny’s FX desk. It peeks from curated hide sockets after ≥3 s locomotion idle (closer + longer with idle), dissolves on activity. Ambient folklore only.

**Why:** Uniswap logo = pink unicorn; myth creatures prefer to stay unseen. Lab ENG-2026-0023 chose Amazing Inc. rainbow unicorn, remapped to pink, previewed. Principal wants it in the bank as ambient theatre — not a companion, not an FX gate.

**Baseline:** FX desk + Johnny **met** ([`docs/UNISWAP.md`](../UNISWAP.md)); lab mesh + pink sheet ready ([ENG-2026-0023](../../../GameLab/work/ENG-2026-0023-shy-fx-unicorn/)).

**Handoff:** [`HANDOFF-shy-fx-unicorn.md`](./HANDOFF-shy-fx-unicorn.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Pack is static (no AnimationStack) | Fade peek + optional tiny bob only — no walk clip required |
| CC-BY 4.0 | CREDITS row mandatory |
| Viz ceiling already 42 with Gum Bot | Prefer +1 mat; document any ceiling bump |
| Blox-47 already Follows | Unicorn must not seek/follow/phone |
| Hide-behind-LOS is expensive | Curated sockets only |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — shy FX unicorn (Uniswap folklore ambient) ONLY.
(1) Copy lab pink unicorn into apps/game/assets/models/fx_unicorn/ as a glb (+ CC-BY licence file) and add CREDITS.md.
(2) Godot: near FX desk, curated hide sockets (3–4). Default near-transparent soft silhouette. After ≥3 s locomotion/interact idle (look OK), peek/fade in; longer idle → closer socket + longer dwell (capped); activity → dissolve to far socket.
(3) Never talk, never block paths, never Follow/phone, never gate Johnny/FX swaps. One seeded discovery peek so a demo can notice it once.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-shy-fx-unicorn.md
2. docs/missions/KICKOFF-shy-fx-unicorn.md
3. GameLab ENG-2026-0023 IDEA.md + source/PROVENANCE.md + out/unicorn_pink_sheet.png (copy ship set only — do not merge ENG tree)
4. docs/WORLD-3D-ENVIRONMENT.md (§2 FX pins, §6 budget)
5. docs/UNISWAP.md (FX exists — do not change lane)
6. CREDITS.md (add CC-BY row pattern)
7. apps/game/scripts/player.gd (idle from locomotion)
8. apps/game/tests/run_viz_budget.gd
9. Skim: docs/GODOT.md web; do not reopen iNPC / FX bidirectional

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Lab root (read-only copy): D:\My Git Projects\D9-Studio\GameLab\work\ENG-2026-0023-shy-fx-unicorn

HARD RULES:
- Codex Luna. Product repo only for edits (Branch-Zero). Copy assets out of GameLab; never merge ENG-* into apps/.
- Scope = ambient shy unicorn. Forbidden: Johnny dialogue graphs; FX swap/quote/whitelist; iNPC Follow/phone; NPCS.md staff row; navmesh / continuous LOS AI; U7 packaging; protocol Solidity.
- Idle = no WASD / no interact / no overlay dialogue. Camera look does NOT reset idle.
- Soft alpha when hidden (no full invisible). Cap closest socket outside personal space / dialogue cam.
- CC-BY attribution required in CREDITS.md (Amazing Inc. — https://amazing-inc.itch.io/rainbow-unicorn).
- Prefer Closest texture filter (Minecraft blocks). Pack has no skinned anim — static + fade is correct.
- Never commit secrets. Local progress under docs/progress/ (gitignored).

SEQUENCE:
1. Inventory — FX desk transforms / Johnny spot; how player input and overlay_open signal activity; current viz material count.
2. Assets — convert lab FBX + pink sheet → unicorn_pink.glb; LICENSE-fx-unicorn.txt; CREDITS row; verify sha256.
3. Sockets — place 3–4 Marker3D (far/mid/near) behind FX furniture; no collider push.
4. Controller — idle timer + HIDDEN/PEEKING/RELOCATING; fade alpha; tier table from handoff; activity reset.
5. Seed — one discovery peek (first FX bay idle ≥3 s OR first FX quote/swap — pick one; document).
6. Tests — smoke idle/peek/hide; run_viz_budget; ensure run_fx_walk / killtests:s1 still green if shared scenes touched.
7. Close — mark HANDOFF met/blocked; tick OWED §5; short WORLD-3D or UNISWAP ambient note; progress note.

DoD = HANDOFF-shy-fx-unicorn Verification checklist + OWED tick + handoff status met.
Stop when met / blocked.
```

---

## After

Principal feel-check the peek timing and pink read in the live FX bay. Optional later: Johnny one-liner, Arc-wing twin — not this mission.
