# Kickoff prompt — Terminal Console + OBSERVER (stretch)

Paste into a **new** Cursor / Codex session. Prefer **Codex Luna** (`gpt-5.6-luna` / Luna). Escalate only if role-config
batch semantics or iframe CSP block for more than one honest attempt.

**What this is:** a **stretch unit** after U7. Diegetic bank computer → React overlay with (1) opt-in **OBSERVER**
runtime role for a MetaMask/EOA address or ENS, and (2) an **iframe** of `https://bloxchain.app`. It is **not**
ship packaging, **not** Arc revive, **not** Privy Global Wallet / RainbowKit cross-app in the SaaS Console.

**Why:** Privy↔SaaS connector was parked (non-general Console infra). Protocol already gates sensitive reads with
`_validateAnyRole()` (V10). An empty-permission `OBSERVER` role unlocks Console viewing via a normal wallet the
player already holds, without changing bloxchain.app auth.

**Baseline:** Main wing on `http://localhost:5173` (mock or live). U4 freeze + U4+ Priority + U5 ENS + practice
faucet intact. U6 Arc **DEFERRED**.

**Design SoT:** [`docs/TERMINAL-CONSOLE.md`](./TERMINAL-CONSOLE.md)

---

## Reflect (do not invent scope)

| Fact | Implication |
|------|-------------|
| `getTransaction` / `getPendingTransactions` / history require `_validateAnyRole()` | Viewer needs **any** role membership; address paste alone is not enough |
| Empty function permissions still count for `hasAnyRole` | `OBSERVER` = wallets only, **zero** TxAction bits |
| Privy Global Wallet / `@privy-io/cross-app-connect` in SaaS | **Parked** — do not reopen |
| `computerScreen` props already in manager / AO rooms | Wire an interactable; do not redesign the bank |
| COOP/COEP off (K8) | Required for iframe; keep it that way |
| Injected MetaMask in cross-origin iframe is unreliable | Console path = WalletConnect / RainbowKit as today; document it |
| One wallet modal rule | Grant uses existing silent roleConfig / session-signer path — **no** new Privy surface |
| Canvas focus (GODOT.md §5b) | Overlay open steals focus; close **must** `focusCanvas()` |

**Semantics (locked):**

1. Role name on-chain: `OBSERVER`. Display bank words: “viewing wallet” / “viewing clerk.”
2. Grant: resolve input → address → `CREATE_ROLE` if missing → `ADD_WALLET`. Idempotent.
3. Revoke: `REVOKE_WALLET` for that address.
4. Never attach transfer / meta / config / Priority selectors to `OBSERVER`.
5. Opt-in at the terminal only — do **not** change default `/provision` ROLE_SET unless the principal later bumps version.
6. Iframe default URL: `https://bloxchain.app/` (optional query later). Fallback if framed: open top-level tab and say so in the terminal.

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Codex Luna.

MISSION: Branch Zero stretch — Terminal Console iframe + OBSERVER view-only role ONLY.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/TERMINAL-CONSOLE.md
2. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/HANDOFF-CC.md
3. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/BLOXCHAIN-INTEGRATION.md   (V10 permissioned views)
4. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/ARCHITECTURE.md
5. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/GODOT.md   (§4 bridge, §5b focusCanvas)
6. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/PRIVY.md   (do NOT add Global Wallet / cross-app)
7. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/NPCS.md   (errors / bank copy patterns)
8. https://github.com/JaCoderX/Branch-Zero/blob/main/docs/SECURITY-AND-KEYS.md
9. Provision role-batch pattern: apps/teller-desk/src/lanes/provision.ts (syncRolePermissions) — reuse batch encoding, do not copy BRANCH_MANAGER grants onto OBSERVER

Local root: D:\My Git Projects\D9-Studio\Branch-Zero
Remote EVM: D:\My Git Projects\ParticleCS\particle-tool-box\Docker Apps\Remote EVM  (do not wipe)

HARD RULES:
- Runtime deps: @bloxchain/sdk + viem ONLY. No Privy cross-app packages. No SaaS Console repo edits in this unit.
- Godot 4.5 GDScript, web, threads OFF. No keys/RPC in Godot. Bridge JSON only; no JavaScriptBridge.eval.
- One Account Opening Privy modal + existing Priority Passkey exception only. Observer grant = silent desk path.
- OBSERVER: membership only — kill-test any write from that wallet must NoPermission.
- Do not regress ROLE_SET 3 Priority split, ENS u5.0 methods, faucet, desk.link, canvas focus, MockChain greybox.
- Do not wipe Remote EVM. No secrets in git. New error codes → dialogue/errors.json; run_checks green when Godot host available.
- Every overlay close → focusCanvas(). Iframe must not leave a full-viewport hit target over #canvas when closed.

SEQUENCE:
1. Spike: iframe bloxchain.app from the Vite shell; record CSP/frame result; implement fallback (new tab) if blocked.
2. Teller Desk: /observer/grant + /observer/revoke (+ status/list if useful). roleConfigBatch CREATE_ROLE OBSERVER + ADD_WALLET / REVOKE_WALLET. Empty permissions. Idempotent.
3. Bridge methods (bump version label, e.g. u5.1 or u7.t): observerGrant / observerRevoke / (optional observerList). MockChain answers them.
4. React terminal overlay: grant form (0x | ENS via existing resolve), iframe or fallback link, close → focusCanvas.
5. Godot: interactable on an existing computerScreen (manager and/or AO); dialogue → GameState.run_action → Chain; lock movement while open.
6. Kill tests: grant → eth_call getPendingTransactions as observer succeeds; pay/wire/roleConfig as observer fails; revoke removes read. Live 1337 evidence in progress note.
7. Progress note (local docs/progress/) + REFLECTION decision row; check HANDOFF-CC §5h DoD boxes.

DoD = docs/TERMINAL-CONSOLE.md §9 + HANDOFF-CC §5h.

OUT OF SCOPE: Privy Global Wallet / RainbowKit connector in bloxchain.app; SubViewport live texture; Arc; Uniswap; ship packaging; ROLE_SET default observer at provision; giving OBSERVER any write bits; editing GameLab ENG trees; custom Solidity.

Stop when DoD met or a named blocker (e.g. Console frame-ancestors) with fallback shipped.
```

---

## After this pass

- If framing is blocked: keep grant/revoke + “Open Console” top-level link; file a **general** embed CSP ask to SaaS (no Privy).
- Scrub any reusable lesson to GameDevOS only after the unit lands.
- Packaging / Arc remain their own kickoffs — do not merge scopes.
