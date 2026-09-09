# Kickoff — Desk screen ↔ keyboard swap (Ines + Okafor)

Paste into a **new** Codex / Cursor session. Prefer **Codex Luna**.

**What this is:** one geometry fix, twice. At Account Opening (Ines) and at the manager desk (Okafor), **swap the world positions** of the computer screen and the keyboard. Keep the same yaw on each prop. Not dialogue, not Counter labels, not FX, not packaging.

**Why:** Principal playtest — at both desks the screen and keyboard still read in the wrong depth order. Same bug, two desks.

**Baseline:** Main wing on `:5173` (`?mock=account` fine). Terminal Console met. Current pins in `bank_interior.gd` (do not invent new coords):

| Desk | Screen today | Keyboard today | Yaw |
|------|--------------|----------------|-----|
| AO (Ines) | `(-8.6, 0.78, 7.85)` | `(-8.6, 0.78, 7.55)` | both `PI` |
| Mgr (Okafor) | `(-8.6, 0.78, -8.95)` | `(-8.6, 0.78, -8.5)` | both `PI` |

After the swap, each screen occupies the keyboard’s old vector and each keyboard occupies the screen’s old vector. **Yaw stays `PI` on all four.** Do not rotate to “fix” depth.

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero — swap computerScreen ↔ computerKeyboard world positions at Account Opening (Ines) and the manager desk (Okafor). Same orientation (yaw PI). Nothing else.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read:
1. apps/game/scripts/bank_interior.gd  (_account_opening AOScreen/AOKeyboard; manager MgrScreen/MgrKeyboard)
2. apps/game/scripts/main.gd           (TERMINALS[] anchors track the screens)
3. apps/game/tests/run_checks.gd       (_check_counter_labels hard-codes AO z pins — update after swap)
4. docs/GODOT.md · docs/TERMINAL-CONSOLE.md (do not regress lean-over-keyboard → terminal vs NPC pick)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Godot 4.5 GDScript, web, threads OFF. No keys in Godot. No new bridge methods. No chain / FX / Arc / packaging / dialogue / Counter-label work.
- Swap positions only. Keep names AOScreen/AOKeyboard/MgrScreen/MgrKeyboard. Keep yaw PI on all four.
- Move main.gd TERMINALS[] positions with the screens (interactable sits on the screen mesh).
- Update run_checks strings that assert the old AO z order.
- Refresh web export / :5173 so the playtest sees the .pck change.
- Do not redesign desks, move NPCs, or change terminal.json / OBSERVER.

SEQUENCE:
1. In bank_interior.gd: exchange AOScreen ↔ AOKeyboard Vector3; exchange MgrScreen ↔ MgrKeyboard Vector3; leave yaw PI.
2. In main.gd TERMINALS: set opening + manager positions to the screens' new coords (y can stay 0.4).
3. Update run_checks (and any comment in bank_interior) to the new AO z pins.
4. Visual check at :5173 — walk AO chairs and manager guest chairs; confirm depth reads correctly with unchanged yaw.
5. run_checks green when Godot host available. Brief local progress note (gitignored ok).

DoD:
- [ ] AO: screen and keyboard positions swapped; both still yaw PI
- [ ] Mgr: screen and keyboard positions swapped; both still yaw PI
- [ ] TERMINALS[] follow the screens
- [ ] run_checks updated and green
- [ ] :5173 playtest confirms both desks

OUT OF SCOPE: Ines dialogue, Counter plaques, FX desk, Arc, packaging, OBSERVER, Privy, moving chairs/NPCs.

Stop when DoD met or a named blocker (e.g. mesh pivot still lies after the swap — report with a screenshot path, do not invent a second rotation without asking).
```

---

## Paste block (short)

Copy the fenced `MISSION` block above into a Codex Luna session after pointing it at this file.
