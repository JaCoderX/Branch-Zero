---
date: 2026-09-07
unit: U4+ checkpoint / scrub
gate: G5b met — principal playtest green
result: accept — vault desks (wait / Priority / recall), freeze, and greybox feel verified on the real bridge; next unit is U5 after ENG-0007 says yes
---

# 2026-09-07 midday — U4+ checkpoint (what the process taught)

Principal verdict: **all is working as expected.** This note is the scrub, not new product work.

HEAD at capture: `210a314` (plants solid + still + off the manager door). Prior: Priority release `efb0a07`, escort/consent `c6fa729`, plant-drift `1cf2b64`.

## What "done" means here

| Path | Who | Credential | Proven |
|------|-----|------------|--------|
| Wait | Ruth | Silent session signer, after `releaseTime` | Kill tests Y2 / Y7; U2 Lane B |
| Priority | Mr. Okafor | Owner Passkey ("hand scan") before clock; manager submits | Y3 on the rig; human walk wire #9 `0xaa381c00…`, `mfaPrompted: true` |
| Recall | Owner and/or manager | Unchanged | U2 + U4+ Y |

Freeze still holds: one Account Opening modal; Priority is the only second Privy surface; canvas re-focus after overlay; `desk.link` / `RPC` / `AUTH` / `NOT_CONFIGURED` intact; `ROLE_SET_VERSION` 3 on the principal account.

## Process map (U0 → this checkpoint)

```text
Lab ENG answers unknown facts
        │  handoff = behaviour rewrite, never merge
        ▼
Product unit ships the desk
        │  kill tests + MockChain + (when needed) human walk
        ▼
Playtest finds feel / physics / copy bugs
        │  small commits, export:web, hard-refresh
        ▼
Checkpoint note + scrub lessons → GameDevOS
        ▼
Next unit only if its lab gate is filled
```

What this stretch reinforced:

1. **Insert a unit when framing diverges from the lab.** ENG-0010 answered "short clock dual-control"; the product needed a *third* path (meta-bypass + Passkey). U4+ (G5b) was inserted before ENS rather than renaming Ruth or shipping 0010's desk.
2. **Labs prove halves; the product closes the half a headless rig cannot.** ENG-0013 M2 proved Passkey → signature recovers to the owner. `killtests:u4plus` uses an honest one-shot rule relax for Y3, then restores (Y8c). The human walk closed the product half.
3. **Silent and privileged payloads that share a domain need a message pin.** Same EIP-712 domain, same account: only `params.action` (and exact `types`, including viem's `EIP712Domain`) separates a counter pay from a Priority bypass. Match types exactly or every request denies.
4. **Version grants and refuse half-configured writes.** `ROLE_SET_VERSION` + `/provision` Re-check + `NOT_CONFIGURED` kept live players from writing with the wrong bitmap.
5. **Godot web physics shoves what it can.** Escort `move_and_slide` displaced lobby plants that were `StaticBody3D` with a default mask. Fix: collide (layer 1) but do not listen (mask 0); place props off door gaps and escort waypoints; lock NPC pitch/roll; escort ignores other characters.
6. **Choreographed NPC walks need a hard home.** Gravity, ignore player, reverse path, skip a stuck leg, hard-home after a wall-clock limit — otherwise `ESCORTING` eats `E` forever.
7. **Consent and session APIs are not idempotent by default.** Re-consent while already delegated → Privy `Duplicate signer(s)`; treat as success and refresh `/session`.
8. **Transfer compression is a host story.** First-load win is brotli on `.wasm` at the CDN, not a pre-compress plugin in the export script — VERIFY on the chosen host before the video.

## Craft lessons scrubbed (GameDevOS)

| Lesson | Finding |
|--------|---------|
| [pin-delegated-signer-to-allowed-payload](https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/pin-delegated-signer-to-allowed-payload.md) | Silent lane and privileged sibling share a typed-data domain → pin the message field the silent lane may sign; match `types` exactly |
| [colliders-that-block-must-not-listen](https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/colliders-that-block-must-not-listen.md) | Set dressing that must stop the player must not take physics shove |
| [headless-cannot-prove-user-held-credential](https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/headless-cannot-prove-user-held-credential.md) | Automate recoverability; close "which key / which factor" with a human walk |
| [lab-gate-before-product-unit](https://github.com/D9-Studio/GameDevOS/blob/main/wiki/lessons/lab-gate-before-product-unit.md) | Do not start a construction unit whose ENG handoff is still empty |

## Still optional (not blocking U5)

- Film a silent counter Pay immediately after a Passkey (Y8b already covers policy).
- Dismiss Passkey sheet → `PRIORITY_CANCELLED` line on the real bridge.
- Real-bridge 30 s clip with the tab visible (mock clip is committed; U4 owed item).

## Next

**U5 ENS (G6)** — [`docs/KICKOFF-U5.md`](../KICKOFF-U5.md). **Gate:** GameLab [ENG-2026-0007](https://github.com/D9-Studio/GameLab/tree/main/work/ENG-2026-0007-ensv2-subname-mint) must fill `findings.md` / `handoff.md` with a yes (registry, resolver, client). As of this checkpoint that ENG is still **unrun** — run the lab first, then paste the U5 kickoff into a cold agent. Do not regress U4 / U4+.
