# Kickoff prompt — U4+ Priority release (G5b)

Paste into a **new** Claude Code / Cursor agent session. Prefer **Fable 5.1**. Escalate to Opus only if stuck on
role-config REMOVE+ADD or Privy user-signer MFA after one honest attempt.

Labs are **already answered**. Do **not** edit GameLab. Consume:

- [ENG-2026-0012](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0012-express-meta-approve-bypass/handoff.md) — on-chain meta bypass (yes)
- [ENG-2026-0011](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0011-privy-step-up/handoff.md) — two signers (yes)
- [ENG-2026-0013](https://github.com/D9-Studio/GameLab/blob/main/work/ENG-2026-0013-privy-mfa-silent-vs-step-up/handoff.md) — Passkey step-up; `promptMfa()` is not a 1-min cache

**Not this beat:** ENG-0010 (timed dual-control, META closed). Do not ship a shorter vault clock. Prefer the names
**Priority release** / **Manager’s bypass**. Avoid “Express” if it still smells like the short-clock mistake.

U4 / G5 is frozen (2026-09-07). Nothing in U4+ may regress it except the deliberate Priority Passkey (hand scan).

```text
You are a cold agent. No prior chat. Prefer docs over memory.

MISSION: Branch Zero construction unit U4+ — Priority release (gate G5b) ONLY.
Freedom on HOW. No freedom on constraints.

This is a THIRD workflow, not a rename of Ruth’s vault release:

  Wait     = Ruth (vault keeper). After releaseTime. Silent session signer.
             Today's owner approveTimeLockExecution. Unchanged clock.
  Priority = Mr. Okafor. BEFORE releaseTime. Owner Passkey / in-game "hand scan"
             then manager submits meta-approve (SIGN_META_APPROVE owner,
             EXECUTE_META_APPROVE manager).
  Recall   = owner and/or manager while PENDING. Unchanged.

Okafor must STOP being a second Ruth. He must NOT stamp post-clock vault releases.
He only bypasses cooling when the player brings extra credentials.

Teaching: cooling is real unless a second desk stamps a priority release, and that
stamp costs a human check.

On-screen copy: "Skip the cooling period — hand scan required."

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md   (§5e is the mission)
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/progress/2026-09-07-u4-mvp-freeze.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/DEV-LOOP.md
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (§4.4 Ruth, §4.5 Okafor)
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GAME-DESIGN.md
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/PRIVY.md
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/BLOXCHAIN-INTEGRATION.md
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4a, §5a MockChain, §5b canvas focus)
9. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/REFLECTION.md
10. GameLab ENG-0012 / 0011 / 0013 handoff.md (behaviour, not files). Do not merge ENG trees.

Local roots:
- D:\My Git Projects\D9-Studio\Branch-Zero
- Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. Do NOT deepen @bloxchain/contracts / chain:compile.
- Do NOT wipe Remote EVM. Live block gasLimit = 16,777,216.
- Godot 4.5 GDScript, web, threads OFF. No keys / RPC in Godot. No JavaScriptBridge.eval.
  Desk actions: Dialogue → GameState.run_action → Chain.call_async.
- One Account Opening modal for login+delegate. Priority Passkey is the ALLOWED second
  surface (hand scan). Do not put Passkey on Lane A Pay.
- Do NOT implement ENG-0010 short-clock dual-control. Do NOT restore Okafor timed stamp.
- Vault-only accounts (if you keep a mode): NO SIGN_META_APPROVE / EXECUTE_META_APPROVE
  on transfer. Once META bits exist on an account, ANY PENDING wire can be bypassed —
  say so in NPC "Ask why" / fine print.
- Contract rejects one role holding both SIGN_META_APPROVE and EXECUTE_META_APPROVE
  (ConflictingMetaTxPermissions). Owner signs; manager submits.
- Product grant split is NOT a copy of the 0012 throwaway clone. 0012 withheld owner
  timed-approve so the lab could isolate the meta path. THIS bank needs BOTH:
    OWNER: Lane A SIGN_META_REQUEST_AND_APPROVE + REQUEST + CANCEL + timed APPROVE
           (Ruth) + SIGN_META_APPROVE (Priority payload)
    BRANCH_MANAGER: CANCEL (recall) + EXECUTE_META_APPROVE (Priority submit)
                    REMOVE EXECUTE_TIME_DELAY_APPROVE (Okafor is not the vault stamp)
- Bump ROLE_SET_VERSION (today 2). Provision REMOVE+ADD; never leave half-provisioned
  players (U4 NOT_CONFIGURED / Re-check).
- Privy: Priority uses the USER signer + showWalletUIs + promptMfa (0011+0013).
  If you call promptMfa(), expect Passkey EVERY Priority — do not document a 1-min skip.
  Silent Lane A must stay silent. Policy DENY must block the session signer from the
  bypass payload.
- Keep MFA on. Verify counter Pay after MFA enroll.
- MockChain must answer the new path (obviously fake). Real G5b evidence is the chain.
- Protect freeze: canvas focus after overlay/Passkey; desk.link; RPC/AUTH/NOT_CONFIGURED;
  no art; no ENS; no Arc.
- Close stale tsx watch / Vite before demo (Privy origin http://localhost:5173).
- No secrets in git. Never Ganache-parity keys on public nets.

SEQUENCE:
0. Confirm Remote EVM up; desk /healthz. Do not start ENS or Arc.
1. Grants: desiredGrants() as above; ROLE_SET bump; Re-check provision on an existing player.
2. Teller: Priority route (e.g. POST /priority or /approve as: "priority") — owner user-sign
   meta-approve, manager EXECUTE_META_APPROVE, before releaseTime. Overlay step-up ONLY there.
3. Godot: Ruth wait-only (owner timed approve after clock). Okafor Priority + recall, no
   post-clock stamp. Copy: skip cooling / hand scan. NPCS.md + errors.json lines for new codes.
4. Kill tests Y1–Y7 + freeze regress (HANDOFF-CC §5e).
5. Progress note + REFLECTION; HANDOFF → U5 + docs/KICKOFF-U5.md (already queued; do not start U5).

DoD = HANDOFF-CC §5e (G5b).

OUT OF SCOPE: ENS (U5), Arc (U6), art/audio, Lane A semantics, merging GameLab ENG trees,
restoring Okafor post-clock stamp, 0010 short-clock desk, wiping Remote EVM, claiming MFA cache.

Stop when G5b met or a named blocker with fallback chosen.
```
