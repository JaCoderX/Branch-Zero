# Hosting — the common front and the private desk

**Status 2026-09-12:** two paths, both **built and verified locally**. Public deploy is a **human step**
(Cloudflare account, DNS, Privy dashboard, secrets, treasury):

- **§2–§3 — Workers & Pages shell + Docker desk (preferred for the public URL).** `https://branchzero.app` on
  Cloudflare **Workers Static Assets** (dashboard: Workers & Pages; `wrangler.jsonc` + `npx wrangler deploy`). Lean
  Godot export (**23.68 MiB** Profile H) fits the per-file cap, same-origin `/game/`. Live desk is a separate Docker
  service at `https://desk.branchzero.app` (Tunnel or Caddy). Absolute `VITE_TELLER_DESK_URL` + CORS. R2 is
  **fallback only** if you ship the official 36 MiB template. Runbook §3 + §6; checklist §7.
  Packaging: [`missions/HANDOFF-hosting-private-desk.md`](./missions/HANDOFF-hosting-private-desk.md) · lean pin:
  [`missions/HANDOFF-custom-web-template.md`](./missions/HANDOFF-custom-web-template.md).
- **§4 — all-in-one compose (self-host / offline twin).** One Docker Compose stack: shell + export + Live desk
  behind Caddy, optional Cloudflare Tunnel. Same privacy story; one origin `/api`. Use when you do not want Pages.
  Runbook §4.5. Mission: [`missions/HANDOFF-hosting-hackathon-compose.md`](./missions/HANDOFF-hosting-hackathon-compose.md).

§2 (run a desk in Docker) and §2.3 (`?desk=`) apply to both.

Cross-refs: [ARCHITECTURE.md §9](./ARCHITECTURE.md) · [SECURITY-AND-KEYS.md §4.1](./SECURITY-AND-KEYS.md) (per-wing
key names) · [SEPOLIA-LIVE.md §4.6](./SEPOLIA-LIVE.md) (never expose `1337`) · [PRIVY.md §3](./PRIVY.md) (Allowed
origins, signer) · [GODOT.md](./GODOT.md) (single-thread export, no COOP/COEP) · [OWED.md §1](./OWED.md).

---

## 1. Shape

| Piece | Where it runs | Holds | Who runs it |
|-------|---------------|-------|-------------|
| **Shell** — Vite + React + Godot export loader | `https://branchzero.app` (Cloudflare Pages) | **no keys**; public ids only (`VITE_PRIVY_APP_ID`, `VITE_PRIVY_SIGNER_ID`, `VITE_GITHUB_CLIENT_ID`) | principal, once |
| **Godot export** — `index.wasm` / `.pck` / `.js` | same-origin `/game/` on Pages with the lean export, or `https://game.branchzero.app/<version>/` (R2) with the official one — §3.3 | public game bytes | principal, per export |
| **Teller Desk** — Fastify, Privy signer, broadcaster, lanes, SSE | **one Docker image** — hosted default *and* any operator's private desk | Privy authorization key, broadcaster / deployer / manager / registrar / treasury keys, the player index | principal (hosted) **or** an operator (private) |

The front is common. The desk is private. If the hosted desk goes away (cost, privacy, end of event), an operator
runs the same image on their own machine and points the public shell at it with `?desk=` (§2.3). The branch front
stays open; the drawer moves under their own desk.

That table is the **§3 Pages + desk** shape (preferred public URL). In the **§4 compose** shape the three rows
collapse onto one origin: Caddy serves the shell *and* the export from `apps/web/dist`, and the desk answers under
`/api` across the compose network. Who holds what is unchanged — shell no keys, desk all of them — and so is
`?desk=`: the compose build's default is same-origin `/api` instead of an absolute desk URL.

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

## 3. Cloudflare Workers & Pages (the shell) — preferred public front

> **Preferred for `https://branchzero.app`.** The dashboard umbrella is **Workers & Pages**. The ship shape is
> **Workers Static Assets**: repo-root [`wrangler.jsonc`](../wrangler.jsonc) points `assets.directory` at
> `apps/web/dist`; Git Builds default deploy is `npx wrangler deploy` (not a mistake). Lean export
> (`npm run export:web:lean`, Profile H, 23.68 MiB) fits the per-file cap, so `/game/` is same-origin. The Live
> desk stays a **separate** Docker deploy (`desk.branchzero.app`). §4 compose remains the self-host twin.
>
> **Cloudflare cannot run Godot.** `apps/web/public/game/` is git-ignored. First full bank: export on a Godot
> 4.5.2 host, then `build:web` + `deploy:web`. A Git Build with only `npm run build:web` deploys the shell with
> **no bank** unless `/game/` is supplied as an artefact (or you use the R2 fallback §3.3).

### 3.1 Project configuration (Workers Builds)

Create / connect the app under **Workers & Pages** (name `branch-zero` matches `wrangler.jsonc`). Settings → Builds:

| Setting | Value |
|---------|-------|
| Root directory | `/` (repo root — npm workspaces) |
| Build command | `npm run build:web` |
| Deploy command | `npx wrangler deploy` (Workers Builds default — keep) |
| Non-production deploy | `npx wrangler versions upload` (default) |
| Production branch | `main` |
| Node | `22` — `.node-version` at repo root; `engines.node >= 20` |
| Assets | `wrangler.jsonc` → `./apps/web/dist`, `not_found_handling: single-page-application` |

**Build variables** (Settings → Builds → **Build variables and secrets** — *not* runtime Variables & Secrets).
Vite bakes only `VITE_*` at `vite build` time; runtime Worker vars never enter the browser bundle.
Mirror locally in git-ignored `.env.web-live` (see `.env.example`):

| Variable | Value |
|----------|-------|
| `VITE_PRIVY_APP_ID` | the Privy app id |
| `VITE_PRIVY_SIGNER_ID` | the key-quorum / signer id |
| `VITE_TELLER_DESK_URL` | `https://desk.branchzero.app` — absolute Live desk URL (§3.2) |
| `VITE_GAME_BASE_URL` | **leave unset** for lean same-origin `/game/` · set only for the R2 / official-export fallback (§3.3) |
| `VITE_GITHUB_CLIENT_ID` | optional |
| `VITE_SEPOLIA_RPC_URL` | optional (only if the shell build uses it) |

**First ship (recommended):** local Godot export + Vite + Wrangler, then attach the custom domain on the same
Worker. Git Builds after that redeploy the shell on every `main` push; re-run `export:web:lean` on a Godot host
whenever the bank bytes change (or publish them via a separate artefact step).

Custom domains: Worker → Domains → `branchzero.app` (apex) + `www` redirect if wanted. DNS in the Cloudflare zone.

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

### 3.3 Export artefact strategy — two exports, two answers

Measured 2026-09-12 (`npm run export:web`, Godot 4.5.2, release, threads off) — the **official** template:

| File | Bytes | MiB | Pages 25 MiB per-file cap |
|------|-------|-----|---------------------------|
| `index.wasm` | 38,047,590 | 36.29 | **over** |
| `index.pck` | 7,273,428 | 6.94 | ok |
| `index.js` | 305,185 | 0.29 | ok |
| worklets, `index.html`, `index.png` | < 25 KB | — | ok |

**`npm run export:web:lean` clears the cap** (2026-09-12). It uses the `Web-Lean` preset and the pinned custom
template in [`tools/godot-web-template/`](../tools/godot-web-template/README.md) — Godot 4.5.2-stable at the
same commit as the editor, threads still OFF, still GL Compatibility, `disable_3d` never used, no COOP/COEP:

| Export | `index.wasm` | MiB | < 25 MiB (`26,214,400`) | < 25 MB (`25,000,000`) |
|--------|-------------:|----:|-------------------------|------------------------|
| `export:web` (official) | 38,047,590 | 36.285 | FAIL +11,833,190 | FAIL +13,047,590 |
| **`export:web:lean` (Profile H)** | **24,830,340** | **23.680** | **PASS −1,384,060** | **PASS −169,660** |

`index.pck` is 7,273,428 B either way — the wasm is the engine, the pck is the game, and neither moves the
other. The saving is ~40 removed engine modules, not compiler flags; the module list, the two Branch Zero
assets that pin `noise` and `basis_universal`, and the rebuild script live in the tools README. The lean wasm
also compresses smaller: gzip −9 **7,178,649 B**, brotli q11 **5,121,360 B** (official: 9,241,949 / 6,499,670)
— a 21% faster first load on any host, §4 included.

So §3 has two shapes now:

- **Lean export, same-origin `/game/` on Pages.** Run `npm run export:web:lean`, leave `VITE_GAME_BASE_URL`
  unset, and ship `apps/web/public/game/` in the Pages build. No R2 bucket, no CORS policy, no per-export
  publish step, no `game.branchzero.app` DNS. `_headers` (§3.4) already sets the wasm MIME. This is the
  recommended §3 shape.
- **Official export, R2 alternate origin.** The original path, kept whole below and still correct. Use it if
  the lean template is unavailable on the build machine, or if a future export crosses the cap again.

**Which cap is real:** Cloudflare documents the Pages per-file limit as **25 MiB**. Profile H clears the
decimal reading too, so the question does not have to be settled to ship. If it ever does matter, the numbers
above are the ones to re-check — and `npm run export:web:lean` prints both verdicts on every export and
**exits non-zero** if either fails.

#### R2 alternate origin (the official-export path)

The official engine binary cannot be a Pages asset, so that export lives on an **R2 bucket with a custom domain**
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
the wasm MIME) — just unset `VITE_GAME_BASE_URL` and ship the export in the build. **`export:web:lean` is
exactly that case** (23.68 MiB, measured above), which is why it is the recommended §3 shape.

### 3.4 `_headers`

`apps/web/public/_headers` (copied into `dist/` by Vite): `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`; `/game/*.wasm` → `Content-Type: application/wasm` + immutable cache; `/assets/*` immutable;
`/index.html` `no-cache`. **No COOP / COEP anywhere** — single-threaded export, and COEP would break the Privy
iframe (GODOT.md). Do not add them.

### 3.5 What to look at on the first Pages preview (principal)

Splash → Godot title from **same-origin** `/game/` (lean export) → `?debug` panel shows
`desk https://desk.branchzero.app · this build's default desk` and the treasury block (proves CORS) → Privy OTP →
one Lane A pay. In DevTools: `index.wasm` `content-type: application/wasm`, preferably `content-encoding: br`;
response headers carry **no** `cross-origin-opener-policy` / `cross-origin-embedder-policy`; desk `/events` stays
open ≥ 60 s (keep-alive comment every 20 s) and reconnects after a desk restart.

### 3.6 Principal deploy sequence (Workers & Pages + desk)

1. **Privy** — Allowed origins += `https://branchzero.app` (+ `www` / `*.workers.dev` / preview URLs while testing).
2. **Treasury** — fund + `npm run treasury:topup -- --execute` (OWED §1).
3. **Desk** — fill `.env.teller-live`; `ALLOWED_ORIGINS=https://branchzero.app,…`;
   `TELLER_ENV_FILE=.env.teller-live docker compose up -d --build teller-live` (or VPS). Put TLS in front:
   Cloudflare Tunnel public hostname `desk.branchzero.app` → `http://127.0.0.1:8787` (or Caddy). Check
   `https://desk.branchzero.app/healthz`.
4. **Dashboard (once)** — Workers & Pages → `branch-zero` → Settings → Builds:
   - Build command = `npm run build:web`
   - Deploy command = `npx wrangler deploy` (leave default)
   - Put `VITE_PRIVY_APP_ID`, `VITE_PRIVY_SIGNER_ID`, `VITE_TELLER_DESK_URL` under **Build variables**
     (remove them from runtime Variables if you only set them there earlier)
5. **Front (Godot host) — first full bank:**

```bash
npm run export:web:lean
# load .env.web-live (public VITE_* only; VITE_GAME_BASE_URL unset)
npm run build:web
npm run deploy:web
```

6. **Domain** — Worker → Domains → `branchzero.app`.
7. **Smoke** — §3.5.

Later `main` pushes rebuild the shell via Workers Builds. Re-export lean `/game/` on a Godot host whenever the
bank changes (Git alone never regenerates wasm).

---

## 4. All-in-one compose — self-host twin (optional)

The path in §3 splits shell and desk across Pages + a desk host. This one does not: **one Docker Compose stack**
holds the shell, the Godot export and the Live Teller Desk behind **Caddy**, and **Cloudflare Tunnel** can put it
on `https://branchzero.app`. No Pages project; official or lean export both work (no per-file upload gate).

```text
Internet ──> Cloudflare (TLS, DNS) ──> Tunnel ──> cloudflared ──┐  (compose network; nothing published)
                                                                v
                                                        caddy :8080 ┬─ /       -> /srv = apps/web/dist (incl. /game)
                                                                    └─ /api/*  -> teller-live:8787, prefix stripped
                                                                                   ^
                                              teller-live (Dockerfile.teller, .data volume, env-only secrets)
```

Everything §1 says still holds: the browser holds no keys, the desk holds the keys and the player index, and the
operator who runs this compose is the custodian of both. What changes is only *where the front is served from* —
the desk is reached same-origin at `/api` instead of by absolute URL, so `?desk=` (§2.3) is still there for
pointing this front at somebody else's desk, and still never falls back on its own.

### 4.1 The stack

| Path | Role |
|------|------|
| `docker-compose.hackathon.yml` | **standalone** compose file: `teller-live` (no published port), `caddy`, `cloudflared` (`--profile tunnel`) |
| `deploy/caddy/Caddyfile` | `file_server` for `dist`, `reverse_proxy` for `/api` with the prefix stripped, wasm MIME, no COOP/COEP |
| `scripts/build-web-hackathon.mjs` | `npm run build:web:hackathon` — the shell build with `VITE_TELLER_DESK_URL=/api` and no `VITE_GAME_BASE_URL` |

Three things about that compose file are deliberate:

- **It is standalone — do not run it as `-f docker-compose.yml -f docker-compose.hackathon.yml`.** Compose *merges*
  `ports` across files instead of replacing them, so an override could never take the desk's published `8787` away
  again. This file redefines `teller-live` from scratch with `expose:` and no `ports:`: Caddy is the only way in,
  and neither the host nor the LAN can reach the desk.
- **Same project, same volume.** It keeps the `branch-zero` project name and the `teller-live-data` volume of
  `docker-compose.yml`, so the desk carries the same `players-11155111.json` / receipts / treasury ledger whichever
  way you start it. One desk, two shapes.
- **There is no Developer Mode service in it at all.** Remote EVM `1337` is private lab infrastructure
  ([SEPOLIA-LIVE.md §4.6](./SEPOLIA-LIVE.md)); the `dev` profile lives only in `docker-compose.yml`, bound to
  loopback, and this file cannot be talked into publishing it because it does not mention it.

Caddy publishes `127.0.0.1:8080` by default — enough for the operator to smoke the exact origin the public will
see, and not enough for anyone else. The public path is `cloudflared -> caddy:8080` **over the compose network**,
so the tunnel does not depend on that host port at all. `CADDY_BIND=0.0.0.0` exists for a deliberate LAN demo;
`CADDY_PORT` moves it.

### 4.2 Build the shell

The Godot export is a **host** step: this stack cannot build Godot, and the 36 MiB `index.wasm` is git-ignored on
purpose. `apps/web/dist` is bind-mounted into Caddy read-only — the operator builds, Caddy serves.

```bash
npm run export:web
```

```bash
npm run build:web:hackathon
```

The second command is `vite build` with the two values that make this stack same-origin pinned in a script rather
than in a shell one-liner (PowerShell, bash and Compose each spell env prefixes differently, and a missed one
silently ships a build pointing at last week's desk):

| Baked | Value | Why |
|-------|-------|-----|
| `VITE_TELLER_DESK_URL` | `/api` | the desk is on this origin, behind Caddy |
| `VITE_GAME_BASE_URL` | *(empty → `/game`)* | the export is on this origin too — no R2 twin |

`process.env` wins over the repo-root `.env` in Vite's env loading, so whatever that file holds for the §3 path
does not leak in. Everything else still comes from `.env`, and **only `VITE_*` is ever baked**: the Privy app id
and signer id, optionally `VITE_GITHUB_CLIENT_ID`. No desk secret, no Privy app secret, no tunnel token — none of
those are `VITE_*`, and none of them are build args. The script refuses to build when `public/game/index.wasm` is
missing and re-checks `dist/game/{index.wasm,index.pck,index.js}` afterwards: here a missing export is a splash
screen that never becomes a bank.

Building on one machine and running on another is fine — copy `apps/web/dist` across (`rsync`, `scp -r`) and keep
the bind mount. The stack wants a directory, not an image.

### 4.3 Run it and check it (local, no tunnel)

```bash
TELLER_ENV_FILE=.env.teller-live docker compose -f docker-compose.hackathon.yml up -d --build
```

Secrets come from the operator's git-ignored env file exactly as in §2.2 (`.env` is the default; a desk-only file
keeps browser / iNPC / lab variables out of the container). `ALLOWED_ORIGINS` defaults to
`https://branchzero.app,http://127.0.0.1:8080,http://localhost:8080` — same-origin GETs carry no `Origin` at all,
so CORS is mostly moot in this shape, but the list is still exact-match and still never `*`.

```bash
curl -s http://127.0.0.1:8080/api/healthz
```

What "working" looks like (all verified 2026-09-12 — §8):

| Check | Expected |
|-------|----------|
| `GET /` | 200, the shell's `index.html`, `X-Content-Type-Options: nosniff` |
| `GET /game/index.wasm` | 200, `Content-Type: application/wasm`, immutable cache, and **no** `cross-origin-opener-policy` / `cross-origin-embedder-policy` anywhere |
| `GET /api/healthz` | `"ok":true,"mode":"live","wing":"sepolia"`, `Via: 1.1 Caddy` |
| `GET /api/events` with no token | 401 `missing Privy access token` — i.e. the `/api` prefix really was stripped before the desk saw the path |
| `docker compose … ps` | `bz-caddy` on `127.0.0.1:8080` only; `bz-teller-live` with **no** host port |
| `curl http://127.0.0.1:8787/healthz` | connection refused — the desk is not on the host at all |

Then open `http://localhost:8080/?debug`: splash → Godot title screen → the desk-debug panel reads
`desk /api · this build's default desk` with the treasury block filled in. (Privy's sign-in iframe stays blocked at
`localhost:8080` until that origin — or `https://branchzero.app` — is in the Privy dashboard's allowed origins,
§7; the bank itself loads regardless.)

Taking it down keeps the volume:

```bash
docker compose -f docker-compose.hackathon.yml down
```

### 4.4 Cloudflare Tunnel

`cloudflared` sits behind `--profile tunnel`, so nothing dials out until you ask for it:

```bash
docker compose -f docker-compose.hackathon.yml --profile tunnel up -d
```

**Token mode** is what this file ships. In the Cloudflare dashboard: Zero Trust → Networks → Tunnels → *Create a
tunnel* → **Cloudflared**; copy the connector token; then add a **public hostname**:

| Field | Value |
|-------|-------|
| Subdomain / domain | *(empty)* / `branchzero.app` |
| Service | `HTTP` → `caddy:8080` |
| optional second hostname | `www` / `branchzero.app` → same service |

Adding the hostname writes the `CNAME` into the zone for you, so there is no separate DNS step and no origin
certificate to manage: the tunnel is outbound-only and TLS terminates at Cloudflare. The ingress lives in the
dashboard, which is why no hostname appears anywhere in this repo.

The token is a **secret** — it is a credential for that tunnel. Keep it in the shell environment or in the
git-ignored repo-root `.env` that Compose interpolates; never in a commit, a build arg or an image layer
([SECURITY-AND-KEYS.md §4.1](./SECURITY-AND-KEYS.md)):

```bash
TUNNEL_TOKEN=eyJhIjoi…
```

It reaches the container as the `TUNNEL_TOKEN` environment variable that `cloudflared tunnel run` reads by itself,
which keeps it out of `command:` and out of `docker ps`. With the variable empty the container exits saying
*"cloudflared tunnel run requires the ID or name of the tunnel"* — a missing token fails loudly rather than quietly
serving nothing.

Pinned images: `caddy:2.11-alpine` and `cloudflare/cloudflared:2026.9.1`, overridable with `CADDY_IMAGE` /
`CLOUDFLARED_IMAGE`.

### 4.5 Runbook (principal)

1. **Fund** — treasury faucet drop → `npm run treasury:topup -- --execute` → `npm run funding:sepolia` shows
   deployer, broadcaster, manager and registrar at or above need (OWED §1). A public bank with an unfunded
   broadcaster is a lobby with a closed counter.
2. **Privy dashboard** → Allowed origins += `https://branchzero.app` (and `https://www.branchzero.app` if you route
   it). That is per *shell* origin; the desk needs no dashboard change ([PRIVY.md §3](./PRIVY.md)).
3. **Export + build** — `npm run export:web`, then `npm run build:web:hackathon` (§4.2).
4. **Fill the env file** — desk secrets per §2.2, plus `ALLOWED_ORIGINS=https://branchzero.app`; `TUNNEL_TOKEN` in
   `.env` (§4.4).
5. **Up** — `TELLER_ENV_FILE=.env.teller-live docker compose -f docker-compose.hackathon.yml --profile tunnel up -d --build`.
6. **Smoke** — `https://branchzero.app/api/healthz` → `ok:true`, `treasury.shortfalls: 0`; then the walk: splash →
   Godot title → `?debug` panel shows `/api` and the treasury block → Privy OTP → one Lane A pay. In DevTools:
   `index.wasm` `content-type: application/wasm` with a `content-encoding`, and **no** COOP/COEP header. `/events`
   stays open ≥ 60 s (a `: ping` comment every 20 s) and reconnects after
   `docker compose -f docker-compose.hackathon.yml restart teller-live`.
7. **Down / backup** — `down` keeps the volume; back it up exactly as in §2.2. Taking this stack down closes both
   the front and the default drawer; an operator running their own desk is unaffected (`?desk=`, §2.3).

Never add the `dev` profile, Remote EVM or port `1337` to this host. Rotate the throwaway keys after the event
(SECURITY §4).

---

## 5. Files

| Path | Role |
|------|------|
| `wrangler.jsonc` | **§3** Workers Static Assets — `assets.directory` = `apps/web/dist`, SPA not-found → `index.html` |
| `Dockerfile.teller` | desk image (repo-root context) |
| `.dockerignore` | keeps `.env*`, `.data/`, `docs/progress`, game, shell out of every layer |
| `docker-compose.yml` | `teller-live` (default) · `teller-dev` (`--profile dev`, loopback) · two named volumes |
| `docker-compose.hackathon.yml` | **§4** standalone stack: unpublished `teller-live` · `caddy` · `cloudflared` (`--profile tunnel`) |
| `deploy/caddy/Caddyfile` | **§4** `dist` file server + `/api` reverse proxy (prefix stripped, `flush_interval -1`), wasm MIME, no COOP/COEP |
| `scripts/build-web-hackathon.mjs` | **§4** `npm run build:web:hackathon` — same-origin `/api` + `/game`, export presence checked |
| `apps/web/src/shell/desk.ts` | runtime desk resolver (`?desk=` → saved → env → `/api`), validation, Reset |
| `apps/web/src/overlay/App.tsx` | desk-debug row + unreachable copy (no fallback) |
| `apps/web/src/main.ts` | `VITE_GAME_BASE_URL` alternate-origin loader |
| `apps/web/public/_headers` | Pages headers (wasm MIME, no COOP/COEP) |
| `scripts/publish-game.mjs` | R2 upload helper, dry-run by default |
| `tools/godot-web-template/` | **§3.3** pinned lean web export template (git-ignored zip + `SHA256SUMS` + rebuild script + why each module is kept) |
| `apps/game/export_presets.cfg` | `Web` (official template) and `Web-Lean` (`custom_template/release` → the pinned zip); threads OFF in both |
| `scripts/export-web.mjs` | `npm run export:web` / `export:web:lean`; verifies the pinned sha256 and prints the wasm against both cap readings |
| `.node-version` | `22` for Pages |
| `apps/teller-desk/src/config.ts` | `HOST` bind env (default `127.0.0.1`) |

---

## 6. Hosted default desk — runbook (principal)

Where: any Docker host that keeps a volume and gives you TLS — Fly.io (`fly launch --dockerfile Dockerfile.teller`,
a 1 GB volume at `/app/apps/teller-desk/.data`, `fly secrets set …`), Railway (Dockerfile deploy + volume), or a
small VPS / laptop running `docker compose` + **Cloudflare Tunnel** (§6.1). Single region is fine. The desk must
answer on `https://desk.branchzero.app` (or whatever `VITE_TELLER_DESK_URL` is baked with).

1. **Fund** (OWED §1): treasury faucet drop → `npm run treasury:topup -- --execute` → `npm run funding:sepolia`
   shows deployer, broadcaster, manager, registrar at or above need. A public desk with an unfunded broadcaster is a
   lobby with a closed counter.
2. **Secrets** in git-ignored `.env.teller-live` (names in §2.2; never commit):
   `SEPOLIA_RPC_URL`, `SEPOLIA_DEPLOYER_PK`, `SEPOLIA_BROADCASTER_PK`, `SEPOLIA_MANAGER_PK`,
   `SEPOLIA_RECOVERY_ADDRESS`, `SEPOLIA_TREASURY_PK`, `ENS_REGISTRAR_PK`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
   `PRIVY_AUTHORIZATION_KEY`, `PRIVY_SIGNER_ID`, optional `PRIVY_POLICY_ID`, `GITHUB_OAUTH_*`.
   Plain env: `CHAIN_ID=11155111`, `PORT=8787`,
   `ALLOWED_ORIGINS=https://branchzero.app,https://www.branchzero.app,http://localhost:5173`.
   Compose also sets `HOST=0.0.0.0`. If the host shell / repo `.env` exports `ALLOWED_ORIGINS`, that value wins over
   the file for the `environment:` key — keep it including `https://branchzero.app`.
3. **Volume** mounted at `/app/apps/teller-desk/.data` **before** the first player. Back it up (§2.2).
4. **Run** the desk (laptop / VPS):

```bash
TELLER_ENV_FILE=.env.teller-live docker compose up -d --build teller-live
curl -s http://127.0.0.1:8787/healthz
```

5. **TLS** — Cloudflare Tunnel to `desk.branchzero.app` (§6.1), or Caddy on a VPS. Check
   `https://desk.branchzero.app/healthz` → `ok:true`.
6. **Front** — lean `/game/` in `dist`, then `npm run deploy:web` (§3.6). Smoke §3.5.
7. **Taking it down**: `docker compose stop teller-live`. Keep the volume. The shell keeps loading; the panel names
   the unreachable desk; an operator can `?desk=` their own.

Never run the `dev` profile on that host. Rotate the throwaway keys after the event (SECURITY §4).

### 6.1 Cloudflare Tunnel for `desk.branchzero.app` (Pages/Workers front + Docker desk)

This is the **§3** path: shell already on Workers & Pages; only the desk needs a public hostname. (The §4
hackathon compose tunnel points at **Caddy** instead — different hostname table.)

1. **Desk up locally** (step 4 above) so something answers on `127.0.0.1:8787`.
2. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → connector type
   **Cloudflared**. Name it e.g. `branch-zero-desk`.
3. **Install connector** — pick your OS. Easiest on the same machine as Docker:
   - Copy the **install token** Cloudflare shows (long `eyJ…` string).
   - Or run their one-liner / Windows service installer. Leave the connector **running**.
4. **Public hostname** on that tunnel:

| Field | Value |
|-------|-------|
| Subdomain | `desk` |
| Domain | `branchzero.app` |
| Type | `HTTP` |
| URL | `localhost:8787` (or `127.0.0.1:8787`) |

Save. Cloudflare writes the DNS `CNAME` for `desk.branchzero.app` into the zone — no manual A record, no origin
cert. Traffic is **outbound-only** from your machine; you do not open inbound 8787 on the router.

5. **Confirm**:
   ```bash
   curl -s https://desk.branchzero.app/healthz
   ```
   Expect JSON with `"ok":true` and Live wing. From `https://branchzero.app` DevTools, `/healthz` must show
   `access-control-allow-origin` echoing the Pages origin (CORS from `ALLOWED_ORIGINS`).
6. **Privy** — Allowed origins already need `https://branchzero.app` (shell). Desk origin is not a Privy login
   origin.
7. **SSE** — after OTP, `/events` must stay open ≥ 60 s. Tunnel does not buffer like a misconfigured reverse
   proxy; if streams die, check desk logs and that you did not put another proxy in front that buffers.

**Token hygiene:** the connector token is a secret. Do not commit it. Prefer the dashboard-installed service or a
user env var — not a git-tracked file. For the **§4** all-in-one stack the token is `TUNNEL_TOKEN` in the
git-ignored repo `.env` and the public hostname points at `caddy:8080` instead (§4.4).

**Optional CLI-only connector** (same machine, no Docker profile):

```bash
# after: cloudflared tunnel login  +  cloudflared tunnel create branch-zero-desk
cloudflared tunnel route dns branch-zero-desk desk.branchzero.app
# config.yml ingress: hostname desk.branchzero.app -> http://127.0.0.1:8787
cloudflared tunnel run branch-zero-desk
```

Dashboard token install is enough for the hackathon; use CLI if you already manage tunnels that way.

---

## 7. OWED — human steps (mirrored in OWED §1)

- [ ] Privy dashboard → **Allowed origins** += `https://branchzero.app` (and `https://www.branchzero.app` if used)
- [ ] Treasury funded and staff wallets at need (OWED §1)

**Pages + Docker desk (§3) — preferred public URL:**

- [ ] Desk: `.env.teller-live` filled; `ALLOWED_ORIGINS` includes `https://branchzero.app`; volume in place (§2.2)
- [ ] Desk TLS: Cloudflare Tunnel `desk` → `HTTP localhost:8787` (§6.1); `/healthz` 200
- [ ] Workers Builds: build command `npm run build:web`; deploy `npx wrangler deploy`; **Build variables** =
      the three `VITE_*` (§3.1)
- [ ] Front: on a Godot 4.5.2 host — `npm run export:web:lean` → load `.env.web-live` → `npm run build:web` →
      `npm run deploy:web` (§3.6); custom domain `branchzero.app`
- [ ] First smoke (§3.5): splash → Godot → Privy OTP → Lane A; `/events` open ≥ 60 s; no COOP/COEP

**§4 compose twin — only if you skip Pages:**

- [ ] Tunnel `branchzero.app` → `HTTP caddy:8080`; `TUNNEL_TOKEN`; `export:web` + `build:web:hackathon`;
      `docker compose -f docker-compose.hackathon.yml --profile tunnel up -d --build` (§4.5)

**R2 fallback — only if shipping the official 36 MiB export:**

- [ ] R2 + `game.branchzero.app` + `VITE_GAME_BASE_URL` (§3.3)

---

## 8. Evidence (2026-09-12, build laptop)

### 8.1 Hackathon all-in-one (§4)

`docker compose -f docker-compose.hackathon.yml up -d --build` → `bz-caddy` (caddy 2.11.4) on `127.0.0.1:8080`,
`bz-teller-live` **healthy with no host port**. Through Caddy on that one origin:

- `GET /` → 200 `text/html`, `nosniff` / `Referrer-Policy` / `Permissions-Policy` present, **no**
  `cross-origin-opener-policy` or `cross-origin-embedder-policy` on any response.
- `GET /game/index.wasm` → 200 `Content-Type: application/wasm`, `Cache-Control: public, max-age=31536000,
  immutable`; `Accept-Encoding: gzip` → 9,789,909 B and `zstd` → 9,208,216 B for the 38,047,590 B (36.29 MiB) file,
  served in ~1.5 s locally. Range requests work (`206`, `Content-Range: bytes 0-0/38047590`).
- `GET /api/healthz` → `"ok":true,"mode":"live","wing":"sepolia"`, `Via: 1.1 Caddy`, `treasury.shortfalls: 0`.
- `GET /api/events` with no token → 401 `missing Privy access token`, and the desk's own log line reads
  `GET /events?token=&owner=` — the `/api` prefix is stripped exactly as `vite.config.ts` does it.
- `curl http://127.0.0.1:8787/healthz` from the host → connection refused. `docker compose ps` shows the desk with
  `8787-8788/tcp` and no mapping. No Dev / `1337` service exists in the file.
- **SSE, 65 s open stream** through the shipped `bz-caddy` container and the shipped Caddyfile: 13 `data:` frames
  5 s apart plus three `: ping` keep-alives at the desk's own 20 s cadence, each arriving on the wall-clock second
  it was written (`Transfer-Encoding: chunked`, `Cache-Control: no-cache, no-transform`, no `Content-Encoding`).
  The desk's `/events` needs a Privy OTP, so for this probe a stand-in process with the desk's exact SSE headers
  answered on the network alias `teller-live`; the proxy path under test was the real one. An authenticated ≥ 60 s
  stream from the public origin stays a **principal walk** (§7).
- Restart drill: file seeded into `branch-zero_teller-live-data`, `docker kill` + `docker rm` the desk,
  `up -d` → file intact, `/api/healthz` 200 again. Caddy kept serving the front throughout.
- Browser (Chrome, `http://localhost:8080/?debug`): splash → `Godot Engine v4.5.2.stable` → *front door up*;
  `/game/index.js`, `index.wasm`, `index.pck` all fetched same-origin; desk-debug panel reads
  `desk /api · this build's default desk` with the live treasury block. `?desk=http://localhost:9999` → named,
  saved, *"not answering — the branch will NOT fall back to the hosted desk"*; `?desk=reset` → back to `/api`,
  `localStorage['bz.desk']` cleared. Privy's iframe is refused at `localhost:8080` by its own
  `frame-ancestors` list — the allowed-origins step in §7, not a stack fault.
- Image scrub on the rebuilt desk image: `find /app -name ".env*" -o -name "*.pem" -o -name "*.key"` → nothing.
  `caddy validate` clean; `cloudflared:2026.9.1` with an empty `TUNNEL_TOKEN` exits with *"requires the ID or name
  of the tunnel"* (fails loudly). **Not run here:** a real tunnel — no Cloudflare token on this machine (§7).
- `npm run typecheck` clean; `killtests:s2` 6/6 PASS on Live **and** 6/6 PASS on Dev (`--dev`).

### 8.2 Pages / private desk (§2–§3)

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

### 8.3 Lean web export template (§3.3)

Measured on this laptop, 2026-09-12, Godot `v4.5.2.stable` editor (`6ce3de25a`), `?mock=account` in Chrome
through Vite `:5173`. The `index.wasm` byte counts are the export's, not a lab cube's, and they match the
GameLab measurement exactly — the wasm is the engine and is independent of the `.pck` (7,273,428 B throughout).

| Template | Engine banner | `index.wasm` | MiB | < 25 MiB | < 25 MB | Bank walk |
|----------|---------------|-------------:|----:|:--------:|:-------:|-----------|
| official 4.5.2 | `stable.official.6ce3de25a`, Emscripten 4.0.10 | 38,047,590 | 36.285 | FAIL | FAIL | green (reference) |
| ENG-0025 Profile F | `stable.custom_build.6ce3de25a`, Emscripten 4.0.11 | 24,970,716 | 23.814 | PASS | PASS | **Gum Bot untextured** |
| Profile G (F + basis) | same | 25,411,218 | 24.234 | PASS | **FAIL** +411,218 | green |
| **Profile H — pinned** | same | **24,830,340** | **23.680** | **PASS** −1,384,060 | **PASS** −169,660 | **green** |

- **Profile F is not shippable as-is.** The bank export logs
  `ERROR: Parameter "Image::basis_universal_unpacker_ptr" is null.` twice and the Gum Bot renders magenta
  instead of yellow/black: `assets/models/inpc/gum_bot_bank.glb` is the one asset importing with
  `gltf/embedded_image_handling=2`, so the runtime needs the `basis_universal` transcoder. The lab inventory
  did not scan for that. Side-by-side confirmed against the official template from the same camera position.
- **`gltf` is the module that can go, not `basis_universal`.** All 70 `.glb` are edit-time imports carrying a
  `.remap` to `.scn`, so `load("res://….glb")` never touches the runtime parser. Profile H (no `gltf`)
  rendered the KayKit cast, the furniture, the vault door and the Gum Bot, and `FxUnicorn._dress()`'s
  `load()` of `unicorn_pink.glb` raised neither of its `push_warning` paths.
- **Walk:** splash → *Enter the branch* → mock account HUD (`0xMOCK…ACC7`, `test.branchzero.eth`, Silver,
  500 USDC) → `&demo=walk` circuit across the lobby to the couches and Ines's dialogue. FastNoise terrazzo
  floor, Cinzel/Inter text, ledger and partner boards, vault door and clock all drew. **Zero Godot console
  errors or warnings** across the run; the only console errors are `/api/healthz` 500s because no Live desk
  was running, which `?mock=account` does not need.
- `Build configuration: Emscripten 4.0.11, single-threaded, no GDExtension support.` — threads OFF held, and
  no COOP/COEP header was served by Vite.
- **Not covered:** the unicorn's *peek* animation, the vault / counter / FX desks further along the circuit,
  and any performance comparison against the official template (`size_extra` is documented to cost run-time
  speed). The Browser pane was hidden, which stalls the canvas between frames, so the circuit was stepped
  rather than watched end to end.
- Default path unbroken: `npm run export:web` still produces the official 38,047,590 B wasm after the preset
  change, so §4's `build:web:hackathon` is unaffected.
