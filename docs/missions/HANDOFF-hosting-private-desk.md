---
type: handoff
title: Handoff — Hosting: Pages shell + Dockerised Teller Desk (default hosted, bring-your-own private desk)
audience: cold agent (Claude Code · Fable 5.1)
created: 2026-09-12
product: Branch-Zero
objective: OBJ-2026-0004
mission: Ship the front on Cloudflare Pages at branchzero.app; package the Live Teller Desk as one Docker image that runs both as the hosted default and as a player-operated private desk the public shell can be pointed at
kickoff: docs/missions/KICKOFF-hosting-private-desk.md
prior: docs/missions/HANDOFF-lane-b-release-opaque.md (met 2026-09-09) · packaging review 2026-09-11 (chat)
status: met (2026-09-12) — public deploy is the principal's human step, HOSTING.md §6
parallel_to: U7 ship packaging (submission media) stays a separate unit — do not absorb it; polish re-playtest gate unchanged
---

# Handoff — Hosting: Pages shell + Dockerised Teller Desk

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope,
constraints, or protocol semantics.

**Prefer:** **Claude Code** (Fable 5.1).

**Kickoff (paste):** [`docs/missions/KICKOFF-hosting-private-desk.md`](./KICKOFF-hosting-private-desk.md)

**Not this mission:** submission reel / architecture PNG / README bounty line
([`KICKOFF-U7-ship-package.md`](./KICKOFF-U7-ship-package.md)) · Arc revive · exposing Remote EVM `1337` · a second
Privy app · multi-tenant "any stranger's desk drives the public app" · custom Solidity · GameLab `ENG-*` · changing
lane / timelock / RBAC / Privy policy shapes.

---

## Principal intent

Two decisions were taken 2026-09-11/12:

1. **The front is common; the teller is private.** `https://branchzero.app` (Cloudflare Pages, domain already
   registered) serves the Vite shell + Godot export and holds **no keys**. The Teller Desk — the process holding the
   Privy authorization key, broadcaster / deployer / registrar / treasury keys and the player index — is a **separate
   deployable**, packaged as **one Docker image**.
2. **A default hosted desk keeps the website playable for anyone**, but if the principal takes that desk down (cost,
   privacy, end of event), an operator can run **the same image locally** and point the public shell at it. The
   branch front stays open; the drawer moves under your own desk.

Privacy claim to keep honest (from the review): a private desk protects **operator custody** — hot keys, `players`
index, logs. It does **not** hide Privy login, Sepolia state or ENS. Say so in docs; do not oversell.

---

## Baseline (do not regress)

| Fact | Where | Implication |
|------|-------|-------------|
| Shell picks the desk by URL: `VITE_TELLER_DESK_URL \|\| '/api'` (+ `/dev-api`, `/arc-api`) | `apps/web/src/overlay/useBranchZeroWallet.ts` L123–131 · `apps/web/src/shell/githubStar.ts` L44 | Override is a **build-time** constant today; BYO desk needs a **runtime** override |
| Vite proxies `/api → :8787` exist only in `vite dev` | `apps/web/vite.config.ts` | After `vite build` nothing answers `/api` — Pages needs a Function/`_redirects` proxy **or** an absolute desk URL |
| Desk CORS allowlist `ALLOWED_ORIGINS` (default `http://localhost:5173`) | `apps/teller-desk/src/config.ts` L98 | Hosted + private desks both need `https://branchzero.app` in the list; SSE with bearer header |
| One desk = one chain, pinned at boot; `--dev` flag → `1337` on `DEV_PORT` | `config.ts` L37–48, L92 | The image ships **Live** by default; a Dev container is the same image with `--dev` and **never** public |
| Per-wing env namespaces (`SEPOLIA_*`), Ganache-parity refusal by derived address | `SECURITY-AND-KEYS.md` §4.1 · `chain.ts` | Compose/env docs must keep the prefix boundary; do not flatten |
| Player index `apps/teller-desk/.data/players*.json` + receipts, written synchronously | `store.ts` | Container needs a **volume** at `.data/`; losing it strands accounts (LOAD-ACCOUNT §"Why it exists") |
| `/healthz` unauthenticated, reports mode / chain / treasury, **never writes** | `server.ts` · SEPOLIA-TREASURY §6 | Use it for the shell's "which desk am I on / is it reachable" and for Docker `HEALTHCHECK` |
| Desk runs via `tsx --env-file-if-exists=../../.env src/server.ts`; workspace deps `@branch-zero/shared` | `apps/teller-desk/package.json` | Dockerfile must build from repo root (npm workspaces), env comes from the platform, **not** a baked `.env` |
| Privy session signer: shell bakes `VITE_PRIVY_APP_ID` + `VITE_PRIVY_SIGNER_ID`; desk holds `PRIVY_AUTHORIZATION_KEY` for that signer | `PRIVY.md` §3, L56, L209 | A private desk must use the **same Privy app + signer key** as the shell build, or silent signing fails. Document this plainly; it is the honest limit of "anyone's desk" |
| Broadcaster is pinned on each `AccountBlox` at `initialize`; `BRANCH_MANAGER` role likewise | `BLOXCHAIN-INTEGRATION.md` §6–7 · `lanes/provision.ts` | A private desk with **different** staff keys can serve accounts **it** opened / loaded; it cannot stamp accounts opened by the hosted desk. Do not "fix" this by sharing keys |
| Godot export single-thread, **no COOP/COEP**; wasm 36.3 MB raw / 7.05 MB brotli | `GODOT.md` · U4 freeze | Pages `_headers` may set `Content-Type: application/wasm`; **must not** add COOP/COEP (Privy iframe) |
| Cloudflare Pages per-file upload cap (~25 MiB) | REFLECTION / packaging review | **VERIFY** current `apps/web/public/game/*` sizes after `export:web`; if `.wasm` > cap, host it on R2 / alternate origin and rewrite the loader path |
| Never run or expose the Dev desk (`1337`) publicly | SEPOLIA-LIVE §4.6 · SECURITY §4 | Hosted default = Live only; compose `dev` profile is localhost-only |

---

## What to build

### 1. Teller Desk Docker image (required)

- `apps/teller-desk/Dockerfile` (or repo-root `Dockerfile.teller`) — Node 20 (or the version `package.json` engines
  pin, if any), npm workspaces install from repo root, runs `apps/teller-desk` via `tsx` **or** a compiled `dist`
  (agent's choice; document). Non-root user. `HEALTHCHECK` on `/healthz`.
- Ports: `8787` (Live). `CMD` defaults to Live; `--dev` reachable via `command:` override only.
- Volume: `/app/apps/teller-desk/.data` (or wherever `store.ts` resolves — read it; do not guess).
- Env: **all** secrets from environment / platform secret store. No `.env` copied into the image. `.dockerignore`
  must exclude `.env*`, `.data/`, `node_modules`, `apps/game`, `docs/progress`.
- `docker-compose.yml` at repo root (or `infra/docker/`) with:
  - `teller-live` — `ALLOWED_ORIGINS=https://branchzero.app,http://localhost:5173`, `CHAIN_ID=11155111`, volume.
  - `teller-dev` — **profile `dev`**, `--dev`, binds `127.0.0.1:8788` only, connects to the operator's Remote EVM
    (`REMOTE_EVM_RPC_URL` — on Windows Docker Desktop that is `host.docker.internal:8545`; document).
- `docs/HOSTING.md` (new) — how to run the image locally, what each env var is for (pointers to
  SECURITY-AND-KEYS, not duplicates), what a private desk **can and cannot** do (the Privy-signer and broadcaster
  couplings above), and the honest privacy statement.

### 2. Shell: runtime desk selection (required)

Today `LIVE_TELLER` is baked at build. Add a **runtime** override with this precedence (highest first):

1. `?desk=https://…` query param → persisted to `localStorage['bz.desk']` (operator intent survives reload)
2. `localStorage['bz.desk']`
3. `import.meta.env.VITE_TELLER_DESK_URL`
4. `'/api'`

Constraints:

- Only `https://` or `http://localhost` / `http://127.0.0.1` origins accepted; anything else ignored with a console
  warning (no injection of arbitrary schemes).
- Show the resolved desk origin in the **desk-debug panel** (operator surface, already exists) with a "Reset to
  default" control. Player-facing HUD unchanged.
- `/healthz` probe already runs before sign-in — reuse it: if the chosen desk is unreachable, the panel says so
  and offers the reset. Do **not** silently fall back to the hosted desk (that would defeat the privacy intent).
- `githubStar.ts` L44 and any other `VITE_TELLER_DESK_URL` reader must go through the same resolver.
- Mixed content: `https://branchzero.app` → `http://localhost:8787` is allowed by browsers for `localhost`
  (potentially trustworthy origin) — **VERIFY** in Chrome + Firefox and record. If blocked in one, document the
  reverse-proxy / local-HTTPS path in HOSTING.md rather than weakening anything.

### 3. Cloudflare Pages wiring (required, ops-light)

- Build: `npm run export:web` is a Godot 4.5.x host step — Pages **cannot** run Godot. Decide and document one of:
  (a) commit the export output, or (b) upload the export as a build artefact / R2 object the Pages build pulls.
  Prefer whichever keeps `apps/web/public/game/` out of a bloated git history if sizes demand it.
- Pages project config: build command `npm run build:web` (verify the exact root script), output `apps/web/dist`,
  Node version pin, `VITE_PRIVY_APP_ID`, `VITE_PRIVY_SIGNER_ID`, `VITE_TELLER_DESK_URL` (default hosted desk) as
  **build** env. Never desk secrets.
- Same-origin `/api` option: a Pages Function / `_redirects` proxy to the hosted desk URL, **only if** SSE streams
  cleanly through it (**VERIFY**; if not, use the absolute desk URL and CORS). Record which you chose.
- `_headers`: wasm MIME if needed; **no** COOP/COEP.
- Domain: `branchzero.app` (+ `www` → apex) attached to the Pages project. Privy dashboard **Allowed origins** must
  include `https://branchzero.app` — this is a **human** step; list it in OWED §1.
- Size probe: **done 2026-09-12** — `index.wasm` **36.29 MiB**, `index.pck` **6.94 MiB**. Pages per-file cap
  fails on wasm. Default product path: **R2 / alternate origin** for `index.wasm` (and rewrite the loader). Parallel
  lab [GameLab ENG-2026-0025](../../../GameLab/work/ENG-2026-0025-godot-web-wasm-under-25mib/) asks whether a custom
  4.5.2 web template (3D kept, threads OFF) can get under 25 MiB — **do not** block Pages wiring on that ENG; do not
  invent a custom template inside this hosting mission.

### 4. Hosted default desk (ops handoff, not code)

Provide the runbook, do not run production yourself: which host (Fly / Railway / small VPS / the principal's own
Docker host), the exact `docker run` / compose invocation, required secrets list, volume, `ALLOWED_ORIGINS`,
treasury funding gate (OWED §1). The principal decides where it runs and when it goes down.

---

## Freedom envelope

- Dockerfile shape (tsx runtime vs compiled), multi-stage or not, image base tag
- Where compose + HOSTING.md live (`infra/docker/` is fine)
- Pages Function vs absolute URL for `/api`, after verifying SSE
- Desk-debug panel copy for the desk origin row

## Out of scope (held)

- Any change to lanes, Privy policy shapes, ROLE_SET, whitelists, session-signer behaviour
- Sharing `PRIVY_AUTHORIZATION_KEY` or staff keys with third parties, or any "key exchange" feature
- A second Privy app / per-desk Privy credentials in the shell
- Remote EVM reachable from the public internet
- Auto-fallback from an unreachable private desk to the hosted desk
- U7 submission media; Arc; iNPC; FX; dialogue

---

## Verification checklist (DoD)

- [ ] `docker build` from repo root succeeds; image runs Live with env-only secrets; `/healthz` green;
      `docker compose --profile dev up` runs a `1337` desk bound to `127.0.0.1` only
- [ ] `.dockerignore` excludes `.env*`, `.data/`, `docs/progress`; `docker history` / a file listing proves no
      secret file is baked
- [ ] Killing the container and restarting with the same volume keeps `players*.json` + receipts (restart drill)
- [ ] Shell: `?desk=http://localhost:8787` on a **production build** (`vite preview` or Pages preview) reaches the
      local container; desk-debug shows the origin; Reset returns to default; invalid scheme ignored + warned
- [ ] Unreachable private desk → panel names it, **no** silent fallback
- [ ] CORS + SSE: `/events` stream from `https://<pages-preview>` to the desk stays open ≥ 60 s and reconnects
      after a desk restart (U4 backoff still 2→4→8→16→30 s)
- [ ] Mixed-content result recorded for Chrome + Firefox (localhost desk from https shell)
- [ ] Pages preview deploy: splash → Godot title → Privy OTP → one Lane A pay against the hosted (or local) desk;
      `Content-Type: application/wasm` and brotli/gzip observed in response headers; no COOP/COEP
- [ ] `public/game/*` sizes recorded vs the Pages cap; alternate-origin path implemented **or** explicitly not
      needed
- [ ] `docs/HOSTING.md` written: run locally, env table (pointers), privacy statement, the two couplings (Privy
      signer, broadcaster/roles) stated as limits, not bugs
- [ ] OWED §1 gains the human steps: Privy Allowed origins, DNS attach, hosted desk secrets + volume, treasury
      funded; OWED §4 row ticked; this file's `status` → met / blocked with a short Outcome section
- [ ] `npm run typecheck` clean; `killtests:s2` still green on both wings (no lane touched); `run_checks` unchanged

---

## Stop conditions

- You would need to share or embed a Privy or staff secret in the shell, the image, or the repo
- A "convenience" would expose `1337` or auto-fall-back to the hosted desk
- SSE does not survive the Pages proxy **and** absolute-URL CORS also fails — stop, record evidence, ask
- `.wasm` exceeds the Pages cap and the alternate-origin path would require a Godot template change — record sizes
  and ask before touching the export template

---

## Outcome (2026-09-12, Claude Code · Fable 5.1)

**Built:** `Dockerfile.teller` + `.dockerignore` + `docker-compose.yml` (`teller-live` default, `teller-dev` under
`--profile dev` on `127.0.0.1:8788`); desk `HOST` env; `apps/web/src/shell/desk.ts` runtime resolver
(`?desk=` → `bz.desk` → `VITE_TELLER_DESK_URL` → `/api`, https or loopback-http only, saved, Reset, no fallback) wired
through the wallet hook, the SSE URL and `githubStar.ts`; desk-debug row + unreachable copy; `VITE_GAME_BASE_URL`
alternate-origin loader in `main.ts`; `apps/web/public/_headers` (wasm MIME, no COOP/COEP); `scripts/publish-game.mjs`
(R2, dry-run default); `.node-version`; `docs/HOSTING.md`; ARCHITECTURE §9 / GODOT.md / OWED amendments.

**Verified locally** (details HOSTING.md §7): image has no `.env*` / key fragment; `/healthz` green in the container;
restart drill with the volume; dev profile loopback-only; production build `?desk=` round-trips incl. invalid
scheme warning, unreachable-desk naming, Reset; Chrome 153 mixed content https → http://localhost **allowed**;
cross-origin export load (engine running); `npm run typecheck` clean; `killtests:s2` 6/6 on Live and Dev.

**Decisions:** `/api` = **absolute desk URL + CORS** (the private desk needs it anyway; nothing buffers SSE); export
on **R2 alternate origin** because `index.wasm` = 36.29 MiB > 25 MiB Pages cap (no template change needed).

**VERIFY / human (OWED §1, HOSTING §6):** Pages project + DNS, Privy Allowed origins, R2 bucket + publish, hosted
desk secrets + volume, Firefox mixed-content (not installed here), ≥ 60 s authenticated `/events` from the
production origin (needs Privy OTP), `content-encoding: br` on the deployed wasm. Not touched: lanes, Privy policy
shapes, ROLE_SET, whitelists, session-signer flow, `apps/game`.

