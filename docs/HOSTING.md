# Hosting — the common front and the private desk

**Status 2026-09-12:** packaging + shell override **built and verified locally** (Docker image, compose, `?desk=`
override, alternate-origin game loader). The public deploy itself is a **human step** (Cloudflare account, DNS,
Privy dashboard, hosted secrets) — §5 is the runbook, §6 the checklist. Mission:
[`missions/HANDOFF-hosting-private-desk.md`](./missions/HANDOFF-hosting-private-desk.md).

Cross-refs: [ARCHITECTURE.md §9](./ARCHITECTURE.md) · [SECURITY-AND-KEYS.md §4.1](./SECURITY-AND-KEYS.md) (per-wing
key names) · [SEPOLIA-LIVE.md §4.6](./SEPOLIA-LIVE.md) (never expose `1337`) · [PRIVY.md §3](./PRIVY.md) (Allowed
origins, signer) · [GODOT.md](./GODOT.md) (single-thread export, no COOP/COEP) · [OWED.md §1](./OWED.md).

---

## 1. Shape

| Piece | Where it runs | Holds | Who runs it |
|-------|---------------|-------|-------------|
| **Shell** — Vite + React + Godot export loader | `https://branchzero.app` (Cloudflare Pages) | **no keys**; public ids only (`VITE_PRIVY_APP_ID`, `VITE_PRIVY_SIGNER_ID`, `VITE_GITHUB_CLIENT_ID`) | principal, once |
| **Godot export** — `index.wasm` / `.pck` / `.js` | `https://game.branchzero.app/<version>/` (R2, alternate origin — §3.3) | public game bytes | principal, per export |
| **Teller Desk** — Fastify, Privy signer, broadcaster, lanes, SSE | **one Docker image** — hosted default *and* any operator's private desk | Privy authorization key, broadcaster / deployer / manager / registrar / treasury keys, the player index | principal (hosted) **or** an operator (private) |

The front is common. The desk is private. If the hosted desk goes away (cost, privacy, end of event), an operator
runs the same image on their own machine and points the public shell at it with `?desk=` (§2.3). The branch front
stays open; the drawer moves under their own desk.

### 1.1 Honest privacy statement

A private desk protects **operator custody**: the hot keys, the `players*.json` index, the receipts and the desk
logs stay on the operator's machine, and no third party can stamp, release or re-key what that desk opened.

It does **not** hide:

- **Privy login.** Sign-in still goes to Privy; the embedded wallet lives in Privy's enclave. The shell bakes one
  Privy app id; every desk that serves this shell talks to that same Privy app (§1.2).
- **Sepolia state.** Every account, wire, release and balance is public chain data with an explorer link.
- **ENS.** Names under `branchzero.eth` are public Sepolia records.
- The **shell origin**. `https://branchzero.app` is served by Cloudflare; Cloudflare sees the page loads. The desk
  calls go browser → desk directly (absolute URL, §3.2), not through the shell host.

Do not oversell it. "Your keys and your ledger index under your desk" is the claim; "anonymous banking" is not.

### 1.2 The two couplings (limits, not bugs)

1. **Privy session signer.** The shell bakes `VITE_PRIVY_APP_ID` + `VITE_PRIVY_SIGNER_ID`; the desk holds the
   matching `PRIVY_AUTHORIZATION_KEY` for that signer (P-256). A private desk that should sign *silently* for
   players who consented in this shell must hold **that** authorization key — which is the principal's secret and
   is **not** shared as a feature. Without it, a private desk still runs: `/session` works, provisioning works with
   the desk's own keys, but the session-signer lane degrades to the client-signing fallback (`signingMode:
   'client'`, Privy prompts in the browser). This is the honest limit of "anyone's desk drives the public app":
   the *front* is common, the *Privy app* is the principal's.
2. **Broadcaster / roles pinned on-chain.** `AccountBlox.initialize` pins the broadcaster; `BRANCH_MANAGER` is a
   runtime role grant. A private desk with **its own** staff keys serves the accounts **it** opened or loaded
   (LOAD-ACCOUNT adopts by owner + `BloxCloned` logs); it **cannot** broadcast or release for an account the hosted
   desk opened, because that account's broadcaster is the hosted desk's key. Do not "fix" this by copying keys
   between desks — different desks are different banks that happen to share a lobby.

---

## 2. Run a desk locally (Docker)

### 2.1 Build and run the Live desk

```bash
docker compose up -d --build teller-live
```

```bash
curl -s http://localhost:8787/healthz
```

`/healthz` (unauthenticated, never writes) must report `"ok":true,"mode":"live","wing":"sepolia"`. Docker's
`HEALTHCHECK` polls the same endpoint and greps for `"ok":true`, so `docker compose ps` says *healthy* only when the
desk can reach its RPC and the chain id matches.

The image (`Dockerfile.teller`, repo root, multi-stage `node:22-alpine`):

- `npm ci -w apps/teller-desk` from the repo lockfile; runs `apps/teller-desk/src/server.ts` under **tsx**, exactly
  like `npm start` — one runtime, not a second build.
- Contains: `packages/shared`, `apps/teller-desk/{src,scripts,package.json}`, `infra/deployments/*.json`
  (addresses only). **Does not contain:** any `.env*`, `.data/`, the Godot project, the shell, docs.
  `.dockerignore` enforces it; `docker run --rm --entrypoint sh branch-zero/teller-desk:local -c 'find /app -name ".env*"'`
  returns nothing (verified 2026-09-12, along with a grep for a real key fragment: 0 files).
- Runs as user `node` (uid 1000). `HOST=0.0.0.0` inside the container (the desk's default stays `127.0.0.1` on a
  laptop — the image sets the env, compose decides what is published).
- Fastify logs `listening on http://127.0.0.1:8787` even when bound to `0.0.0.0` — cosmetic; the socket is
  `0.0.0.0:8787` (checked with `netstat` inside the container).

### 2.2 Env file, secrets, volume

Secrets are **environment only**. Compose reads them from an env file the operator owns and git ignores:

```bash
cp .env.example .env.teller-live   # fill the SEPOLIA_* wing, PRIVY_*, ENS_REGISTRAR_PK; leave lab keys empty
```

```bash
TELLER_ENV_FILE=.env.teller-live docker compose up -d teller-live
```

| Variable | What for | Pointer |
|----------|----------|---------|
| `SEPOLIA_RPC_URL` | the ledger | SECURITY §4.1 |
| `SEPOLIA_DEPLOYER_PK`, `SEPOLIA_BROADCASTER_PK`, `SEPOLIA_MANAGER_PK`, `SEPOLIA_RECOVERY_ADDRESS` | Live wing staff keys — **your own throwaways**, never Ganache-parity | SECURITY §1, §4.1 |
| `SEPOLIA_TREASURY_PK` / `SEPOLIA_TREASURY_*` | ops float; `SEPOLIA_TREASURY_AUTO=off` if you want CLI-only top-ups | SEPOLIA-TREASURY.md |
| `ENS_REGISTRAR_PK` | Name Desk (Sepolia in every mode) | ENS.md |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_KEY`, `PRIVY_SIGNER_ID` | the signer coupling (§1.2) | PRIVY.md §3 |
| `ALLOWED_ORIGINS` | exact-match CORS allowlist of shell origins; compose default `https://branchzero.app,http://localhost:5173` — **add your shell origin, never `*`** | server.ts `onSend` hook |
| `GITHUB_OAUTH_CLIENT_ID/SECRET` | optional ★ button exchange | player menu docs |

Compose `environment:` overrides the env file for `HOST`, `CHAIN_ID`, `PORT` and `ALLOWED_ORIGINS`
(`ALLOWED_ORIGINS` is interpolated from your shell or the project `.env`, then defaulted). `TELLER_LIVE_BIND=127.0.0.1`
narrows the published port to loopback when the laptop shares a LAN.

**Volume.** `teller-live-data` mounts at `/app/apps/teller-desk/.data` — `players-11155111.json`,
`receipts-11155111.json`, `treasury-11155111.json`. Losing it strands accounts (LOAD-ACCOUNT can re-adopt by owner,
but the vault clock state, receipts and treasury ledger are gone). **Restart drill (verified 2026-09-12):** files
seeded into the volume, `docker kill` (SIGKILL), `docker compose up -d` → files intact, `/healthz` green.

Back it up like any volume:

```bash
docker run --rm -v branch-zero_teller-live-data:/data -v "$PWD":/out alpine tar czf /out/teller-data-backup.tgz -C /data .
```

### 2.3 Point the public shell at your desk

Open the front with the desk URL in the query string:

```text
https://branchzero.app/?desk=http://localhost:8787
```

- Precedence (highest first): `?desk=` → `localStorage['bz.desk']` (saved on first use, survives reload) →
  the build's `VITE_TELLER_DESK_URL` → `/api`.
- Accepted: `https://…` any host; `http://` **only** for `localhost`, `127.0.0.1`, `[::1]`, `*.localhost`.
  Anything else is ignored with a console warning and the panel line *"ignored ?desk=… nothing changed"*.
- The **desk-debug panel** (`?debug`, or the pill once the engine runs) shows the resolved desk, how it was chosen,
  *"private desk: its keys, its player index"*, and **Reset to default** (forgets the saved choice, drops `?desk=`,
  reloads).
- If your desk is down the panel says *"the desk you chose (…) is not answering — the branch will NOT fall back to
  the hosted desk"*. There is deliberately **no automatic fallback**: a player who chose a private desk must never
  be handed to the hosted one behind their back.
- `?desk=` (empty), `?desk=default` or `?desk=reset` also clears the saved choice.
- Only the Live slot is overridable. Dev (`/dev-api`, `1337`) and Arc stay laptop proxies.

**Mixed content (https shell → http://localhost desk).** Browsers treat loopback as a potentially trustworthy
origin, so an `https://` page may call `http://localhost:8787`.

| Browser | Result | How |
|---------|--------|-----|
| Chrome 153.0.8010.36 (Windows) | **allowed** — `fetch('http://localhost:8787/healthz')` and `http://127.0.0.1:8787` both 200 from an `https://` page; `EventSource` to `/events` reached the desk (401 with a bad token, i.e. not blocked) | headless Chrome against a self-signed https origin, 2026-09-12 |
| Firefox | **VERIFY** — not installed on the build laptop. Firefox ≥ 84 treats `http://localhost` as a secure context and exempts it from mixed-content blocking (Mozilla bug 1220810). If a Firefox build blocks it, use the reverse-proxy path below; do not weaken anything | — |

If a browser refuses, put the desk behind local TLS instead of loosening the shell: e.g. Caddy `localhost` with its
internal CA (`caddy reverse-proxy --from localhost:8443 --to 127.0.0.1:8787`) and `?desk=https://localhost:8443`, or
Tailscale Serve (`tailscale serve --bg 8787`) and `?desk=https://<host>.<tailnet>.ts.net`. Add that origin to
nothing — `ALLOWED_ORIGINS` names **shell** origins, and the shell origin is still `https://branchzero.app`.

**Privy Allowed origins** is per *shell* origin, not per desk: `https://branchzero.app` must be in the Privy
dashboard once (OWED §1). A private desk needs no Privy dashboard change.

### 2.4 Developer Mode desk (operator only)

```bash
docker compose --profile dev up -d --build
```

Same image, `--dev` → chain `1337`, reads the **unprefixed** lab keys, talks to the operator's Remote EVM through
`host.docker.internal:8545` (Docker Desktop; on Linux the compose file's `extra_hosts` adds it). Published on
**`127.0.0.1:8788` only** — the compose file has no way to expose it without editing it, on purpose
(SEPOLIA-LIVE §4.6). Verified 2026-09-12: host listener `127.0.0.1:8788`, `/healthz` → `mode dev · chainId 1337`,
`treasury: null`. Never run this profile on a public host.

---

## 3. Cloudflare Pages (the shell)

### 3.1 Project configuration

| Setting | Value |
|---------|-------|
| Framework preset | None (Vite) |
| Root directory | `/` (repo root — npm workspaces) |
| Build command | `npm run build:web` |
| Build output directory | `apps/web/dist` |
| Node version | `22` — `.node-version` at repo root (Pages honours it); `engines.node >= 20` |
| Production branch | `main` |

**Build environment variables** (public ids only — never a desk secret; Vite bakes only `VITE_*`):

| Variable | Value |
|----------|-------|
| `VITE_PRIVY_APP_ID` | the Privy app id |
| `VITE_PRIVY_SIGNER_ID` | the key-quorum / signer id |
| `VITE_TELLER_DESK_URL` | `https://desk.branchzero.app` — the hosted default desk (absolute, §3.2) |
| `VITE_GAME_BASE_URL` | `https://game.branchzero.app/<version>` — from `scripts/publish-game.mjs` (§3.3) |
| `VITE_GITHUB_CLIENT_ID` | optional |
| `NODE_VERSION` | `22` (belt and braces with `.node-version`) |

Custom domains: `branchzero.app` (apex) + `www.branchzero.app` → redirect to apex (Pages "custom domains" +
a Bulk Redirect or a `_redirects` line if `www` is wanted). DNS lives in the principal's Cloudflare zone.

### 3.2 `/api` strategy — absolute desk URL + CORS (chosen)

In `vite dev`, `/api` is a proxy to `:8787`. After `vite build` nothing answers `/api`. Two options were on the
table; **absolute URL + CORS** is what ships:

- The shell already speaks to the desk by base URL (`VITE_TELLER_DESK_URL`, now runtime-overridable), the desk already
  has an exact-match CORS allowlist (`ALLOWED_ORIGINS`) and sets `Access-Control-Allow-Origin` on the SSE response
  too. `EventSource` needs no custom header (the token rides in the query string), so there is no preflight on the
  stream and nothing in the middle to buffer it.
- **Verified 2026-09-12** from a production build on `http://localhost:4173` against the container on `:8787`:
  `/healthz` 200 with `access-control-allow-origin: http://localhost:4173`; `/events` answers with the CORS headers
  (401 for a bad token — an authenticated ≥ 60 s stream needs a Privy OTP sign-in from the production origin, which
  is a **principal walk**, OWED §2). The browser-side reconnect wrapper (`shell/deskEvents.ts`, 2→4→8→16→30 s) is
  unchanged.
- The **private desk** feature *requires* this shape: `?desk=` is an absolute URL by definition. A Pages Function
  proxy for the hosted desk would be a second code path for one desk only.

A Pages Function proxy (`functions/api/[[path]].ts` → `fetch(hostedDesk + path)`) remains possible later for a
same-origin hosted path; it is **not** written, and **VERIFY** SSE ≥ 60 s through it before relying on it.
No `_redirects` file is needed: the shell is a single `index.html` with no client routes.

### 3.3 Export artefact strategy — R2 alternate origin (required by size)

Measured 2026-09-12 (`npm run export:web`, Godot 4.5.2, release, threads off):

| File | Bytes | MiB | Pages 25 MiB per-file cap |
|------|-------|-----|---------------------------|
| `index.wasm` | 38,047,590 | 36.29 | **over** |
| `index.pck` | 7,273,428 | 6.94 | ok |
| `index.js` | 305,185 | 0.29 | ok |
| worklets, `index.html`, `index.png` | < 25 KB | — | ok |

The engine binary cannot be a Pages asset, so the export lives on an **R2 bucket with a custom domain**
(`game.branchzero.app`), versioned by content hash, and the shell loads it cross-origin. Nothing in the Godot
export template changes: `apps/web/src/main.ts` passes `executable: <VITE_GAME_BASE_URL>/index` to Godot's
`Engine`, which derives `.wasm`, `.pck` and the audio worklets from it.

**Verified 2026-09-12** with the export served from `http://localhost:8090` (CORS `*`) and a shell build with
`VITE_GAME_BASE_URL=http://localhost:8090` on `http://localhost:4174`: `index.js`, `index.wasm`
(`application/wasm`), `index.pck` fetched from `:8090`; engine state *running*; title screen rendered. The audio
worklet files were not requested in that probe (Godot loads them lazily); the bucket must allow them anyway.

Publish flow (principal, per export; the script is dry-run by default):

```bash
npm run export:web
```

```bash
node scripts/publish-game.mjs --execute
```

It prints the version (`sha256(wasm+pck+js)[0:12]`), uploads `apps/web/public/game/*` to
`r2://branch-zero-game/<version>/` with the right `Content-Type` and `Cache-Control: immutable`, and prints the
`VITE_GAME_BASE_URL` to set on the Pages project before the next Pages build. Two exports never share a path, so
caches never lie; old versions can be pruned by hand.

**R2 bucket setup (human, once):** bucket `branch-zero-game`; custom domain `game.branchzero.app`; CORS policy:

```json
[{ "AllowedOrigins": ["https://branchzero.app", "http://localhost:4173", "http://localhost:5173"],
   "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 86400 }]
```

Cloudflare compresses `application/wasm` at the edge (Brotli/gzip) — **VERIFY** `content-encoding: br` on the
deployed `index.wasm` (7.05 MB brotli was the U4 measurement). Keep `apps/web/public/game/` git-ignored; the Pages
build does not need it when `VITE_GAME_BASE_URL` is set (the shell's `HEAD` probe goes to the alternate origin).

If a future export drops under 25 MiB, same-origin `/game/` on Pages works unchanged (`_headers` already sets
the wasm MIME) — just unset `VITE_GAME_BASE_URL` and ship the export in the build.

### 3.4 `_headers`

`apps/web/public/_headers` (copied into `dist/` by Vite): `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`; `/game/*.wasm` → `Content-Type: application/wasm` + immutable cache; `/assets/*` immutable;
`/index.html` `no-cache`. **No COOP / COEP anywhere** — single-threaded export, and COEP would break the Privy
iframe (GODOT.md). Do not add them.

### 3.5 What to look at on the first Pages preview (principal)

Splash → Godot title (from `game.branchzero.app`) → `?debug` panel shows `desk https://desk.branchzero.app · this
build's default desk` and the treasury block (proves CORS) → Privy OTP → one Lane A pay. In DevTools: `index.wasm`
`content-type: application/wasm`, `content-encoding: br`; response headers carry **no**
`cross-origin-opener-policy` / `cross-origin-embedder-policy`; `/events` stays open ≥ 60 s (keep-alive comment every
20 s) and reconnects after `docker compose restart teller-live`.

---

## 4. Files

| Path | Role |
|------|------|
| `Dockerfile.teller` | desk image (repo-root context) |
| `.dockerignore` | keeps `.env*`, `.data/`, `docs/progress`, game, shell out of every layer |
| `docker-compose.yml` | `teller-live` (default) · `teller-dev` (`--profile dev`, loopback) · two named volumes |
| `apps/web/src/shell/desk.ts` | runtime desk resolver (`?desk=` → saved → env → `/api`), validation, Reset |
| `apps/web/src/overlay/App.tsx` | desk-debug row + unreachable copy (no fallback) |
| `apps/web/src/main.ts` | `VITE_GAME_BASE_URL` alternate-origin loader |
| `apps/web/public/_headers` | Pages headers (wasm MIME, no COOP/COEP) |
| `scripts/publish-game.mjs` | R2 upload helper, dry-run by default |
| `.node-version` | `22` for Pages |
| `apps/teller-desk/src/config.ts` | `HOST` bind env (default `127.0.0.1`) |

---

## 5. Hosted default desk — runbook (principal)

Where: any Docker host that keeps a volume and gives you TLS — Fly.io (`fly launch --dockerfile Dockerfile.teller`,
a 1 GB volume at `/app/apps/teller-desk/.data`, `fly secrets set …`), Railway (Dockerfile deploy + volume), or a
small VPS running exactly the compose file above behind Caddy. Single region is fine. The desk must answer on
`https://desk.branchzero.app` (or whatever `VITE_TELLER_DESK_URL` is baked with).

1. **Fund** (OWED §1): treasury faucet drop → `npm run treasury:topup -- --execute` → `npm run funding:sepolia`
   shows deployer, broadcaster, manager, registrar at or above need. A public desk with an unfunded broadcaster is a
   lobby with a closed counter.
2. **Secrets** on the platform (names in §2.2; values from your password manager, never from git):
   `SEPOLIA_RPC_URL`, `SEPOLIA_DEPLOYER_PK`, `SEPOLIA_BROADCASTER_PK`, `SEPOLIA_MANAGER_PK`,
   `SEPOLIA_RECOVERY_ADDRESS`, `SEPOLIA_TREASURY_PK`, `ENS_REGISTRAR_PK`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
   `PRIVY_AUTHORIZATION_KEY`, `PRIVY_SIGNER_ID`, optional `PRIVY_POLICY_ID`, `GITHUB_OAUTH_*`.
   Plain env: `CHAIN_ID=11155111`, `PORT=8787`, `HOST=0.0.0.0` (image default),
   `ALLOWED_ORIGINS=https://branchzero.app,https://www.branchzero.app`.
3. **Volume** mounted at `/app/apps/teller-desk/.data` **before** the first player. Back it up (§2.2).
4. **Run** the image: `docker build -f Dockerfile.teller -t branch-zero/teller-desk .` then the platform's
   deploy, or on a VPS `TELLER_ENV_FILE=.env.teller-live docker compose up -d teller-live` behind
   `caddy reverse-proxy --from desk.branchzero.app --to 127.0.0.1:8787`.
5. **Check** `https://desk.branchzero.app/healthz` → `ok:true`, `treasury.shortfalls: 0`.
6. **Pages**: set `VITE_TELLER_DESK_URL=https://desk.branchzero.app`, `VITE_GAME_BASE_URL` (§3.3), Privy ids;
   deploy; walk §3.5.
7. **Taking it down**: `docker compose stop teller-live` (or scale to 0). Keep the volume. The shell keeps loading;
   the panel names the unreachable desk; an operator can `?desk=` their own. Announce the desk URL change, not a
   key.

Never run the `dev` profile on that host. Rotate the throwaway keys after the event (SECURITY §4).

---

## 6. OWED — human steps (mirrored in OWED §1)

- [ ] Privy dashboard → **Allowed origins** += `https://branchzero.app` (and `https://www.branchzero.app` if used)
- [ ] Cloudflare Pages project (§3.1) with the build env; custom domain `branchzero.app` (+ `www` redirect); DNS
- [ ] R2 bucket `branch-zero-game` + custom domain `game.branchzero.app` + CORS policy (§3.3); run
      `node scripts/publish-game.mjs --execute`; set `VITE_GAME_BASE_URL`
- [ ] Hosted desk: platform, secrets, volume, `ALLOWED_ORIGINS`, `desk.branchzero.app` TLS (§5)
- [ ] Treasury funded and staff wallets at need (OWED §1)
- [ ] First Pages preview walk (§3.5), including the ≥ 60 s `/events` stream and Firefox mixed-content note (§2.3)

---

## 7. Evidence (2026-09-12, build laptop)

- `docker build -f Dockerfile.teller .` → 324 MB image; `find /app -name ".env*"` → none; grep for a real key
  fragment / PEM header outside `node_modules` → 0 files; runs as uid 1000.
- `docker compose up -d teller-live` → `/healthz` `ok:true mode:live wing:sepolia`, healthy; CORS preflight 204
  with the exact origin echoed; a foreign origin gets no `access-control-allow-origin`.
- Restart drill: seeded `players-11155111.json` + `receipts-11155111.json`, `docker kill`, `up -d` → intact.
- `--profile dev`: `127.0.0.1:8788` only; `mode dev chainId 1337 treasury null`.
- Production build on `:4173`: `?desk=http://localhost:8787` → panel names it, reachable, treasury block shown;
  reload without the param → *saved choice*; `?desk=http://evil.example:8787` → ignored + console warning;
  `?desk=http://localhost:8799` → *not answering … will NOT fall back*; Reset → `/api · same-origin /api proxy`,
  `localStorage['bz.desk']` null, `?desk` gone from the URL.
- Chrome 153 mixed content: https → `http://localhost:8787` and `http://127.0.0.1:8787` allowed.
- Alternate-origin export on `:8090` → engine running from `:4174`.
- `npm run typecheck` clean; `killtests:s2` 6/6 PASS on Live and 6/6 PASS on Dev (`--dev`).
