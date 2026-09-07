---
date: 2026-09-06
unit: review U3 / scrub
gate: G4 claimed met
---

# 2026-09-06 night — U3 CC review + craft capture

## Verdict

**Accept G4 with the same human-OTP caveat as U1/U2.** Commit `5d3ff42` (push if still ahead). Mock walk + headless checks + real-bridge login dismiss proven; full OTP→wire→release on real chain still owed to a human.

Constraint hygiene: no lane/role/policy changes; bridge adds reads only; threads off; no eval.

## Lessons scrubbed (GameDevOS)

| Lesson | Finding |
|--------|---------|
| hidden-browser-tab-stops-engine-loop | Hidden pane ⇒ no rAF ⇒ frozen Godot |
| bind-keycode-and-physical-keycode-on-web | Automation keys need both bindings |
| anchors-and-offsets-for-code-built-ui-roots | FULL_RECT preset alone ⇒ 0×0 roots |
| preserve-error-codes-across-fetch-boundary | `throw new Error(msg)` ate desk codes |

## Next

Human: `http://localhost:5173/` — Ines → OTP → pay → wire → vault release. Or start U4 from `docs/KICKOFF-U4.md` after that walk (or in parallel on mock).
