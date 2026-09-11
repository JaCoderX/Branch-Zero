---
title: Kickoff prompt — Hosting: Pages shell + Dockerised Teller Desk (private desk option)
created: 2026-09-12
product: Branch-Zero
model: Claude Code · Fable 5.1
handoff: docs/missions/HANDOFF-hosting-private-desk.md
---

# Kickoff prompt — Hosting: Pages shell + Dockerised Teller Desk

Paste into a **new** Claude Code session. Prefer **Fable 5.1**.

**What this is:** put the front on Cloudflare Pages at `branchzero.app`; package the Live Teller Desk as one Docker
image that runs as the hosted default **and** as an operator's private desk; let the public shell be pointed at a
private desk at runtime.

**Why:** the front holds no keys and can be common; the desk holds the hot keys and the player index and should be
the operator's to run — or to take down — without closing the branch. Reviewed 2026-09-11/12: architectural fit is
good (ARCHITECTURE §9 already splits shell vs desk); the missing work is packaging + a runtime desk override, plus
honest limits (Privy signer coupling, broadcaster pinned per account).

**Baseline:** Sepolia Live default **met**; Dev = `1337` desk behind `--dev`; shell resolves desk from
`VITE_TELLER_DESK_URL || '/api'`; no Dockerfile, no Pages project, no `.github/workflows` yet.

**Handoff:** [`HANDOFF-hosting-private-desk.md`](./HANDOFF-hosting-private-desk.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Vite `/api` proxy exists only in dev | Production needs Pages Function/`_redirects` **or** absolute desk URL + CORS |
| Desk pins one chain at boot | Image = Live by default; Dev container is `--dev`, `127.0.0.1` only |
| `players*.json` is the account index | Volume is mandatory; restart drill is part of DoD |
| Shell bakes Privy app + signer id; desk holds the matching auth key | A private desk must use the same Privy app — say so; do not invent key sharing |
| Broadcaster pinned on each `AccountBlox` | Private desk serves accounts it opened/loaded; cannot stamp hosted-desk accounts |
| wasm 36.3 MB raw | Pages ~25 MiB per-file cap — measure before committing to Pages-only |
| Single-thread export | `_headers` never adds COOP/COEP |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code Fable 5.1.

MISSION: Branch Zero — Hosting: Cloudflare Pages shell + Dockerised Teller Desk (default hosted + private desk) ONLY.
(1) Teller Desk Docker image + compose (Live default; `dev` profile localhost-only), env-only secrets, .data volume, HEALTHCHECK on /healthz, .dockerignore that excludes .env* / .data / docs/progress.
(2) Shell runtime desk override: ?desk= → localStorage bz.desk → VITE_TELLER_DESK_URL → '/api'; https or localhost only; shown in desk-debug with Reset; unreachable desk is named, never auto-falls back to the hosted desk.
(3) Cloudflare Pages wiring for branchzero.app: build/output config, _headers (wasm MIME, NO COOP/COEP), /api strategy (Function proxy if SSE survives, else absolute URL + CORS), export artefact strategy, size probe vs the per-file cap.
(4) docs/HOSTING.md: run locally, env pointers, honest privacy statement, the two couplings (Privy signer, broadcaster) as stated limits; hosted-desk runbook for the principal; OWED human steps.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. AGENTS.md (root)
2. docs/missions/HANDOFF-hosting-private-desk.md
3. docs/missions/KICKOFF-hosting-private-desk.md
4. docs/ARCHITECTURE.md §1, §2.3, §9
5. docs/SECURITY-AND-KEYS.md §1, §4, §4.1 (per-wing env prefixes; Ganache-parity refusal)
6. docs/SEPOLIA-LIVE.md §2, §4.6 (never expose 1337)
7. apps/teller-desk/src/config.ts · store.ts · server.ts (/healthz, ALLOWED_ORIGINS, .data path)
8. apps/teller-desk/package.json · root package.json (workspaces, build:web / export:web scripts)
9. apps/web/vite.config.ts · apps/web/src/overlay/useBranchZeroWallet.ts (L120–260) · apps/web/src/shell/githubStar.ts
10. docs/GODOT.md hosting / first-load notes; docs/PRIVY.md §3 (signer id, Allowed origins)
11. docs/OWED.md §1 (treasury funding gate — a public desk needs it)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Public @bloxchain/sdk + viem only; no Solidity; no GameLab ENG merges.
- No secrets in git, in the image, or in the shell build. Desk secrets = platform env only. Shell may bake only VITE_* public ids.
- Never expose Remote EVM 1337 publicly; `dev` profile binds 127.0.0.1.
- Do not touch lanes, Privy policy shapes, ROLE_SET, whitelists, session-signer flow, one-modal rule.
- No auto-fallback from a chosen private desk to the hosted desk. Name the failure instead.
- Do not share PRIVY_AUTHORIZATION_KEY or staff keys as a feature; document the coupling as a limit.
- Pages headers: never COOP/COEP. wasm MIME OK.
- Do not run production deploys yourself; write the runbook. Principal owns DNS, Privy dashboard, hosted secrets.
- Keep the existing uncommitted working-tree changes of other sessions out of your commits (commit only your files).
- Local progress notes under docs/progress/ (gitignored).

SEQUENCE:
1. Inventory — .data path, /healthz shape, ALLOWED_ORIGINS use, build:web script, current export sizes (run export:web if Godot 4.5.x present; else read the last measured numbers and mark VERIFY).
2. Docker — Dockerfile + .dockerignore + compose (teller-live, teller-dev profile). Build, run, healthz, restart drill with volume.
3. Shell — desk resolver module; wire useBranchZeroWallet + githubStar through it; desk-debug row + Reset; invalid input warning; unreachable copy. vite preview + ?desk=http://localhost:8787 against the container. Record mixed-content result Chrome + Firefox.
4. Pages — _headers, /api strategy with SSE ≥ 60 s test, export artefact strategy, project config notes; Pages preview if a CF token is available, else a dry runbook marked VERIFY.
5. Docs — docs/HOSTING.md; ARCHITECTURE §9 short amendment; GODOT.md hosting note if sizes force an alternate origin; OWED §1 human steps + §4 tick; handoff Outcome + status.
6. Regression — npm run typecheck; killtests:s2 both wings; no Godot change expected (no export needed unless you touched apps/game — you should not).

DoD = HANDOFF-hosting-private-desk Verification checklist + OWED tick + handoff status met.
Stop when met / blocked (see handoff Stop conditions).
```

---

## After

Principal: attach `branchzero.app` DNS, add the origin in the Privy dashboard, fund the treasury (OWED §1), stand
up the hosted desk from the runbook. Then a Live smoke on the public URL. U7 submission media stays its own unit.
