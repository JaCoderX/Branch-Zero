---
title: Kickoff — AO desk polish (Ines terminal · keyboard · Counter labels)
created: 2026-09-08
product: Branch-Zero
model: Codex Luna
handoff: docs/missions/HANDOFF-ao-desk-polish.md
---

# Kickoff prompt — AO desk polish

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna**. Escalate only if dialogue ↔ bridge wiring or prop orientation blocks for more than one honest attempt.

**What this is:** a **tiny polish pass** after Terminal Console + OBSERVER. Three refinements only. Not ship packaging, not Arc, not FX, not new chain work.

**Why:** Principal playtest notes — (1) Ines should point players at the desk computer she already has; (2) AO keyboard sits behind the screen from the client walk-up; (3) west column should read **Counter** + **Name Desk**, not Counter 1 / Counter 2.

**Baseline:** Main wing on `http://localhost:5173` (mock or live). Terminal stretch met (`u5.1`, `AOScreen` interactable). U4 / U4+ / U5 / faucet / polish DoD intact. U6 Arc **DEFERRED**.

**Handoff:** [`docs/missions/HANDOFF-ao-desk-polish.md`](./HANDOFF-ao-desk-polish.md)

---

## Reflect (do not invent scope)

| Fact | Implication |
|------|-------------|
| `clerk.json` has no terminal choice today | Add `open_console` on Ines’s post-account path; reuse `GameState` / bridge — no new method |
| `terminal.json` already owns observer verbs | Ines may open the Console only; do not duplicate grant/revoke on Ines |
| AO chairs `z≈6.7`, screen `z=7.85`, keyboard `z=8.3` | From lobby: screen then keyboard behind it — move keyboard to the **client** side of the screen |
| Screen yaw already faces the client | Do not rotate the screen away from the client to “fix” order |
| `_counter("Counter1", …, "COUNTER 1")` / `"COUNTER 2 · NAME DESK"` | Plaque text change; node names may stay |
| Separate `NAME DESK` plaque already exists | Removing Counter 2 overhead label does not remove Name Desk identity |
| `_check_terminal()` bans write verbs on `terminal.json` | Keep that invariant; clerk may call `open_console` without gaining observer write verbs |

**Semantics (locked):**

1. Ines choice → same `open_console` action as the physical terminal.
2. Keyboard between client and screen at Account Opening.
3. Player-facing labels: **Counter** (Dev’s bay) and **Name Desk** (Petra’s bay). No “Counter 1” / “Counter 2” on plaques or NPC lines the player hears/reads.

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero polish — (1) Ines dialogue action to open the Account Opening desk terminal, (2) move AOKeyboard between AOScreen and the client, (3) rename Counter 1 → Counter and remove Counter 2 label so signage reads Counter + Name Desk only.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-ao-desk-polish.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/KICKOFF-ao-desk-polish.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/TERMINAL-CONSOLE.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4 bridge, §5b focusCanvas)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (§4.2 Ines; update Counter wording if you touch player copy)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/missions/HANDOFF-CC.md   (do not regress freeze / Priority / ENS / faucet / terminal OBSERVER)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (do not wipe)

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. No new bridge methods unless absolutely required (prefer existing openConsole).
- Godot 4.5 GDScript, web, threads OFF. No keys/RPC in Godot. Bridge JSON only; no JavaScriptBridge.eval.
- Do not regress OBSERVER membership-only, terminal write-verb ban, canvas focus on overlay close, ROLE_SET 3, ENS, faucet, desk.link, MockChain greybox.
- Do not wipe Remote EVM. No secrets in git. New/changed player-facing strings stay bank words.
- Internal node names Counter1/Counter2 / debug F-keys may stay; player-facing "Counter 1" / "Counter 2" go.
- Do not move Petra off the south teller bay. Do not redesign desks. Do not revive Arc / touch FX / ship packaging.

SEQUENCE:
1. Ines: in apps/game/dialogue/clerk.json, on the has-account `done` (and any equivalent start_over path), add a choice that runs action `open_console` with working/on_ok/on_error like terminal.json. Bank copy e.g. "Use the desk terminal". Success line: Console is on the desk screen; close the panel when done. Update docs/NPCS.md §4.2 briefly. Do NOT add observer_grant/revoke to Ines.
2. Keyboard: in apps/game/scripts/bank_interior.gd `_account_opening()`, place AOKeyboard on the client-approach side of AOScreen (between chairs at z≈6.7 and the screen). Keep screen facing the client. Verify in editor or :5173 that order is client → keyboard → screen → Ines. Leave Mgr* props unless the same bug is proven there.
3. Labels: Counter1 overhead plaque → "COUNTER". Remove Counter2 overhead Counter-2 label (empty/skip plaque in `_counter` if needed). Rewrite ServiceMenu to Name Desk services without "Counter 1"/"Counter 2"; pay-by-name → "Counter". Update player-facing dialogue/role strings: teller.json, greeter.json, vault_keeper.json, dealer.json, errors.json FX line, main.gd Dev display role, any other player-visible "Counter 1"/"Counter 2".
4. Checks: extend run_checks if useful (clerk has open_console; no regression on _check_terminal). run_checks / mock walk green when Godot 4.5 host available. Export or refresh web build if the game .pck/public game assets must pick up Godot changes for :5173.
5. Evidence: local docs/progress/ note + optional captures (AO desk from chairs; west column Counter + Name Desk). One REFLECTION decision row if a non-obvious choice was made (e.g. skipping empty plaque vs labelling Counter2 "NAME DESK").

DoD:
- [ ] Ines (account open) offers Use the desk terminal → openConsole path; overlay close restores movement + focusCanvas
- [ ] From AO customer chairs: keyboard visibly between player and screen; screen still faces client
- [ ] West column plaques: COUNTER at Dev's bay; no COUNTER 2; Name Desk identity clear for Petra
- [ ] No player-facing "Counter 1" / "Counter 2" left in dialogue/signage touched by this pass
- [ ] Terminal OBSERVER invariants unchanged; run_checks green when host available
- [ ] Progress note filed

OUT OF SCOPE: new chain routes, OBSERVER semantics changes, Privy surfaces, faucet/ENS/FX/Arc, ship packaging, moving NPCs, SubViewport live screen texture, GameLab ENG trees, bloxchain.app SaaS edits.

Stop when DoD met or a named blocker with the smallest honest fallback.
```

---

## After this pass

- Point `HANDOFF-CC.md` at the progress note if the principal wants the main handoff index updated.
- Scrub a craft lesson to GameDevOS only if something non-obvious bit (e.g. prop local +Z vs yaw).
- Do not merge this scope into S1b FX validate or ship packaging.
