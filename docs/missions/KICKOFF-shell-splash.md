---
title: Kickoff prompt — Shell splash (early visual before Godot load)
created: 2026-09-10
product: Branch-Zero
model: Claude Code · Opus / Fable high
handoff: docs/missions/HANDOFF-shell-splash.md
---

# Kickoff prompt — Shell splash

Paste into a **new** Claude Code session. Prefer **Opus / Fable high**.

**What this is:** Vite **shell** polish — branded splash on first paint while Godot wasm/`.pck` load; hand off to the existing Godot front door when ready.

**Why:** Players stare at dark `#boot` text until the full export loads. The real title (`player_menu.gd`) only appears after that. Principal wants a visual immediately on enter.

**Baseline:** Player menu **met** ([`HANDOFF-player-menu.md`](./HANDOFF-player-menu.md)) — do not reopen Esc / Leave / Sound. Shell boot: [`apps/web/src/main.ts`](../../apps/web/src/main.ts) + [`apps/web/index.html`](../../apps/web/index.html).

**Handoff:** [`docs/missions/HANDOFF-shell-splash.md`](./HANDOFF-shell-splash.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Slow part is wasm + `.pck` download | HTML/CSS splash covers it; Godot title cannot appear earlier without shell help |
| Player menu is the interactive front door | Splash is non-interactive placeholder; **Enter the branch** stays in Godot |
| U4 `#boot` hit-target lesson | Splash: `pointer-events: none` or remove when hidden — never kill canvas keyboard |
| `onProgress` + `bridge.ready` already exist | Drive status / hide from `main.ts`; no new bridge verbs |
| GODOT.md mentions loading screen with logo | Shell owns it (U0); do not revive unused Godot custom HTML shell |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code (Opus / Fable high).

MISSION: Branch Zero — shell splash (early visual).
(1) Branded splash on first paint: "Branch Zero" + "A bank you can walk through." + honest load status (% / KB / Opening the branch…).
(2) Hide splash when Godot is running; existing player_menu front door remains the interactive Enter the branch.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. docs/missions/HANDOFF-shell-splash.md
2. docs/missions/KICKOFF-shell-splash.md
3. apps/web/index.html · apps/web/src/main.ts · apps/web/src/shell/focus.ts
4. docs/GODOT.md §3 (boot order) + §5b (canvas focus)
5. docs/missions/HANDOFF-player-menu.md (met — do not reopen behaviour)
6. Skim: docs/REFLECTION.md U4 #boot / canvas-focus lesson

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Claude Code. Product repo only (Branch-Zero). No GameLab ENG-*. No protocol Solidity.
- Shell-only preferred. Do NOT change player_menu Esc / Leave / Sound / title gate unless a one-line sync is required (ask first).
- Everyday bank words. No "Start Game / Loading… Please Wait" SaaS chrome that fights the Godot title copy.
- NEVER put Sign in, Load Account, Live/Dev, Mock, Open Console, or a working Enter-the-branch that starts play on the HTML splash.
- Splash must not leave a full-viewport hit-target over #canvas (pointer-events: none while visible; fully hidden when running).
- Preserve U4 freeze, player-menu flow, Terminal/iNPC overlays, focusCanvas after overlay hide.
- Runtime: @bloxchain/sdk + viem. Godot never holds keys / never talks RPC.
- Never commit secrets. No forced export:web for shell-only work.
- Deferred bank_interior streaming is OUT OF SCOPE unless principal expands — ask first.

SEQUENCE:
1. Inventory — confirm #boot → setState / onProgress / bridge.ready hide path.
2. Splash markup + CSS in index.html (or thin shell styles) matching brand + tagline; status line wired from main.ts.
3. Hide on running / bridge.ready; verify Godot show_title still gates Enter the branch.
4. Verify focus — hard refresh :5173/?mock=account: splash visible immediately → progress moves → splash gone → Enter works → WASD after enter; desk-debug still usable.
5. Close — mark HANDOFF met/blocked; tick OWED; one REFLECTION line if a design call was made.

DoD:
- [ ] First paint shows branded splash (not bare status text alone)
- [ ] Progress updates during engine download
- [ ] Splash hides when running; Godot front door interactive
- [ ] No canvas keyboard regression (U4)
- [ ] No desk/operator verbs on splash
- [ ] Handoff met + OWED/REFLECTION

STOP AND ASK if: you need to change player_menu.gd; you want an interactive Enter on HTML; you want to defer bank_interior load; matching Cinzel on the web requires new font files and scope creep.
```

---

## After

Principal: hard-refresh `:5173` (shell only — no export required if game untouched). Confirm splash → progress → Godot title → Enter the branch → walk. Confirm Esc visitor's card still works. Confirm keyboard after enter.
