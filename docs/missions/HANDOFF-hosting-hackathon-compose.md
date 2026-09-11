---
type: handoff
title: Handoff — Hackathon all-in-one compose (shell + teller + Caddy + CF Tunnel) for branchzero.app
audience: cold agent (Claude Code · Fable 5.1)
created: 2026-09-12
product: Branch-Zero
objective: OBJ-2026-0004
mission: Ship a Docker Compose stack that serves the Vite+Godot shell and the Live Teller Desk behind Caddy, with Cloudflare Tunnel to https://branchzero.app — hackathon-first path that clears the 36 MiB wasm without Pages/R2
kickoff: docs/missions/KICKOFF-hosting-hackathon-compose.md
prior: docs/missions/HANDOFF-hosting-private-desk.md (met 2026-09-12 — desk image, ?desk=, Pages/R2 runbook)
status: met (2026-09-12) — stack built + locally verified; Cloudflare Tunnel, Privy origins, treasury and the public smoke are the principal’s human steps (OWED §1)
parallel_to: GameLab ENG-2026-0025 (wasm under 25 MiB) · Pages+R2 path in HOSTING.md remains the scalable twin — do not absorb or block on either · U7 ship packaging stays separate
---

# Handoff — Hackathon all-in-one compose + branchzero.app

You are a **cold agent**. Prefer this file + the kickoff over chat memory. Freedom on **how**. No freedom on scope,
constraints, or protocol semantics.

**Prefer:** **Claude Code** (Fable 5.1).

**Kickoff (paste):** [`docs/missions/KICKOFF-hosting-hackathon-compose.md`](./KICKOFF-hosting-hackathon-compose.md)

**Not this mission:** Cloudflare Pages project as the primary host · R2 game publish as a blocker · custom Godot
export templates / GameLab ENG merges · U7 submission media · Arc · exposing Remote EVM `1337` · changing lanes /
Privy policy shapes / ROLE_SET / whitelists / session-signer flow · sharing staff or Privy authorization keys as a
feature.

---

## Principal intent (2026-09-12)

1. **Hackathon-first hosting:** one Docker Compose stack holds the **web game front** and the **Live Teller Desk**,
   fronted by **Caddy** (TLS / reverse proxy) and exposed as **`https://branchzero.app`** via **Cloudflare Tunnel**
   (`cloudflared`). Judges get one URL; no 25 MiB Pages per-file gate.
2. **Reuse what already shipped:** `Dockerfile.teller`, desk `HOST` bind, runtime `?desk=` resolver, privacy /
   coupling docs in [`docs/HOSTING.md`](../HOSTING.md). Extend compose; do not rewrite the desk from scratch.
3. **Pages + R2 + ENG-2026-0025** stay **parallel / later**. This unit must not wait on a lean wasm template or an
   R2 bucket. Document them as the scalable twin; do not delete that runbook.
4. **Privacy story unchanged:** browser still holds no keys; desk holds keys + `.data`. Taking the compose down
   closes the default drawer (and this front). An operator runs the **same compose** locally. `?desk=` remains for
   pointing a different front at another desk — default for this stack is **same-origin `/api`**.

Honest privacy claim (keep): operator custody of keys and player index — not anonymity, not multi-tenant strangers'
desks driving the public app without the Privy-signer / broadcaster limits already stated in HOSTING §1.

---

## Baseline (do not regress)

| Fact | Where | Implication |
|------|-------|-------------|
| Desk image + compose Live / `dev` profile already exist | `Dockerfile.teller` · `docker-compose.yml` · HOSTING.md | **Extend** compose; keep `teller-dev` localhost-only under `profiles: ["dev"]` |
| Shell resolves Live desk at runtime | `apps/web/src/shell/desk.ts` | Hackathon build should bake `VITE_TELLER_DESK_URL=/api` (or leave default `/api`); unset `VITE_GAME_BASE_URL` so `/game/` is same-origin |
| Vite `/api` proxy strips the `/api` prefix | `apps/web/vite.config.ts` | Caddy (or equivalent) must rewrite `/api/*` → teller root the same way, or the shell paths break |
| SSE `/events` uses query `token=` (EventSource) | `App.tsx` · `deskEvents.ts` | Proxy must **not** buffer SSE; verify keep-alive ≥ 60 s through Caddy |
| `index.wasm` **36.29 MiB** | measured 2026-09-12 | Fine inside this stack — no Pages upload. Serve `Content-Type: application/wasm`; **never** COOP/COEP |
| Godot export is a host step | `npm run export:web` | Compose build needs `apps/web/public/game/` present (bind-mount, multi-stage copy of a pre-exported tree, or documented principal export before `docker compose build`). Pages cannot run Godot; neither can this image build Godot |
| Secrets = env only | SECURITY §4.1 · existing `.dockerignore` | No `.env` in any layer; tunnel token is a secret too (`TUNNEL_TOKEN` / credentials file — never commit) |
| Privy Allowed origins are shell origins | PRIVY.md §3 | Principal must add `https://branchzero.app` — list in OWED; agent does not click the dashboard |
| Never expose `1337` publicly | SEPOLIA-LIVE §4.6 | Public stack = Live only |

---

## What to build

### 1. All-in-one Compose (required)

Target shape:

```text
Internet → Cloudflare Tunnel → Caddy (:80 or unix; TLS at CF and/or Caddy)
                                 ├─ /        → static Vite dist (incl. /game/*.wasm|.pck|.js)
                                 └─ /api/*   → teller-live:8787  (strip /api prefix like vite.config.ts)
teller-live → existing Dockerfile.teller, .data volume, env-only secrets
cloudflared → token from env / file (gitignored)
```

Minimum services (names flexible):

- **`teller-live`** — reuse current service; for the public stack prefer **not** publishing `8787` on the host LAN
  when Caddy is the only ingress (or bind `127.0.0.1` / internal network only). Keep `TELLER_LIVE_BIND` escape hatch.
- **`web` or static asset stage** — serves / contains `apps/web/dist` after `npm run build:web` with public
  `VITE_PRIVY_APP_ID`, `VITE_PRIVY_SIGNER_ID`, and `VITE_TELLER_DESK_URL=/api`. No desk secrets in build args.
- **`caddy`** — `file_server` + `reverse_proxy` for `/api`; wasm MIME; **no** COOP/COEP; SPA fallback to
  `index.html` if needed; SSE-friendly proxy (disable response buffering / set flush).
- **`cloudflared`** — `tunnel run` with token from env; routes `branchzero.app` (and optional `www`) to Caddy.
  Document local-only mode without tunnel (Caddy on localhost) for laptop verify.

Freedom: single `docker-compose.yml` with profiles (`hackathon` / `tunnel`) **or** `docker-compose.hackathon.yml`
override — pick one and document the exact `docker compose …` invocation.

### 2. Build / artefact path (required)

- Document: `npm run export:web` (Godot 4.5.x host) → ensure `apps/web/public/game/` → `npm run build:web` → image
  or volume gets `dist`.
- Prefer **not** committing the 36 MiB wasm into git. Bind-mount `dist` **or** multi-stage copy from a build
  context that the operator populates locally is fine; say which.
- Image(s) must not contain `.env*`, PEM/key files, or `docs/progress`.

### 3. Docs (required)

- Extend [`docs/HOSTING.md`](../HOSTING.md): new **§ Hackathon all-in-one** (or renumber) as the **recommended path
  for the event**; keep Pages/R2 as “scalable / CDN twin (parallel)”.
- Short amendment to [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) §9: hackathon default = compose + Caddy + Tunnel;
  Pages/R2 remains optional.
- OWED §1 human steps for this path: CF Tunnel create + DNS route to tunnel, Privy Allowed origins, treasury fund,
  first public smoke. Tick OWED §4 row when met.
- Outcome section on **this** handoff; set `status: met | blocked`.

### 4. Runbook for the principal (required — do not deploy production yourself)

Exact commands to:

1. Export + build web (or mount prebuilt `dist`)
2. Fill env (desk secrets + `TUNNEL_TOKEN` + `ALLOWED_ORIGINS=https://branchzero.app`)
3. `docker compose … up`
4. Verify `/healthz` via public URL (through tunnel) and same-origin `/api/healthz`
5. Take down / backup volume

If no Cloudflare account/token is available on the agent machine: verify **locally** (Caddy → shell + desk on
localhost or `http://127.0.0.1`) and mark tunnel DNS attach **VERIFY / human**.

---

## Freedom envelope

- Compose file layout / service names / Caddyfile vs Caddy JSON
- Whether web is `caddy file_server` of a volume vs a tiny nginx/Caddy image that embeds `dist`
- Tunnel as a compose service vs documented host-side `cloudflared`
- Local profile without tunnel for CI/laptop

## Out of scope (held)

- Making Cloudflare Pages the primary host for this unit
- Blocking on ENG-2026-0025 or implementing a custom Godot template
- Exposing Dev/`1337` on the tunnel
- Auto-fallback from a chosen private desk to the hosted desk (already forbidden)
- Key-sharing features; lane / Privy / RBAC edits
- U7 media; iNPC; FX; dialogue; `apps/game` content changes (export only if needed for artefact presence)

---

## Verification checklist (DoD)

- [x] `docker compose -f docker-compose.hackathon.yml up -d --build` brings up Live desk + static shell + Caddy;
      `/` serves the shell; `/game/index.wasm` returns `application/wasm`; **no** COOP/COEP on any response
- [x] `/api/healthz` (same origin through Caddy) → `ok:true`, `mode:live`, `wing:sepolia` with env-only secrets
- [x] SSE: **65 s open stream** through the shipped Caddy container — 13 `data:` frames + three `: ping`
      keep-alives, each arriving the second it was written, `chunked`, no `Content-Encoding`. The desk's own
      `/events` needs a Privy OTP, so a stand-in with the desk's exact SSE headers answered on the `teller-live`
      network alias; the proxy path under test was the real one. Reconnect wrapper untouched. An **authenticated**
      ≥ 60 s stream from the public origin is **VERIFY / principal** (OWED §1)
- [x] `teller-dev` / `1337` is not on the tunnel or public ports — the hackathon compose has no such service, and
      `teller-live` itself has no host port (`curl 127.0.0.1:8787` refused)
- [x] Restart drill: seeded file, `docker kill` + `rm` the desk, `up -d` → `players-11155111.json` intact, front
      never stopped answering
- [x] Image / context scrub: `find /app -name ".env*" -o -name "*.pem" -o -name "*.key"` → nothing; `deploy/`
      added to `.dockerignore`
- [x] Local path without tunnel documented (HOSTING §4.3) and verified: splash → Godot 4.5.2 *front door up*,
      `/game/*` and `/api/*` both same-origin
- [x] Cloudflare Tunnel path documented (HOSTING §4.4, runbook §4.5). **No token on this machine** → not run;
      image pinned and its empty-token failure mode recorded. `https://branchzero.app` smoke = **VERIFY / human**
- [x] HOSTING.md §4 + §8.1 · ARCHITECTURE §9 amendment · OWED §1 human list + §4 tick · this Outcome
- [x] `npm run typecheck` clean; `killtests:s2` 6/6 PASS on Live **and** 6/6 PASS on Dev — no lane edits
- [x] Prior `?desk=` behaviour preserved (chosen → saved → *"will NOT fall back"* → Reset); default hackathon
      build resolves `/api`

---

## Stop conditions

- You would bake desk secrets, tunnel tokens, or Privy secrets into an image or the repo
- You would expose `1337` / Remote EVM on the public tunnel
- SSE cannot survive Caddy and same-origin `/api` also fails — stop, record evidence, ask
- Godot is missing and you cannot obtain a pre-exported `public/game/` — document VERIFY and ask before inventing
  a fake engine binary
- Scope expands into Pages primary deploy, R2 publish, or ENG template work as blockers

---

## Outcome (2026-09-12, Claude Code · Opus 5) — **met**, public tunnel is the principal's step

**Built**

| Path | What |
|------|------|
| `docker-compose.hackathon.yml` | **standalone** stack (not an override): `teller-live` with `expose:` and **no `ports:`**, `caddy` on `127.0.0.1:8080`, `cloudflared` behind `--profile tunnel`. Same `branch-zero` project and same `teller-live-data` volume as `docker-compose.yml`, so the player index follows the desk either way. No Dev / `1337` service exists in it |
| `deploy/caddy/Caddyfile` | `/api/*` → `uri strip_prefix /api` + `reverse_proxy teller-live:8787 { flush_interval -1 }`; `/` → `file_server` over `/srv` (a read-only bind mount of `apps/web/dist`) with `_headers` parity, explicit wasm MIME, `encode` (zstd/gzip, explicit type list) only on the static half, and **no COOP/COEP** |
| `scripts/build-web-hackathon.mjs` + `npm run build:web:hackathon` | `vite build` with `VITE_TELLER_DESK_URL=/api` and `VITE_GAME_BASE_URL` cleared, refusing to build without `public/game/index.wasm` and re-checking `dist/game/*` after |
| Docs | HOSTING.md new **§4** (+ §8.1 evidence, hackathon-first header, §3 marked parallel twin, old §4–§7 renumbered §5–§8) · ARCHITECTURE §9 amendment · GODOT.md hosting row · `.env.example` tunnel block · `.dockerignore` `deploy` · OWED §1 human list + §4 tick |

**Chosen, and why**

- **Standalone file, not `-f a -f b`.** Compose *merges* `ports` across files, so an override could never remove
  the base desk's published `8787`. The constraint "teller reachable only on the compose network" is only
  enforceable by redefining the service — which is what this file does.
- **`dist` bind-mounted, not baked.** The Godot export is a host step (this image cannot build Godot) and the
  36.29 MiB `index.wasm` is git-ignored; a bind mount keeps both true and lets an operator rebuild without a
  `docker build`. Copying `dist` to a remote host is documented for that case.
- **Same-origin `/api` for this build only.** `?desk=` and the no-fallback rule are untouched; the hackathon build
  simply resolves to `/api` instead of an absolute URL. `_headers` stays for the §3 Pages twin.
- **Tunnel in token mode.** Ingress (`branchzero.app` → `HTTP caddy:8080`) lives in the Cloudflare dashboard, so
  no hostname and no credential is in the repo; `TUNNEL_TOKEN` arrives as an env var `cloudflared` reads itself,
  keeping it out of `command:` and `docker ps`.

**Verified locally** (full evidence HOSTING §8.1): wasm `application/wasm` + immutable cache, 38,047,590 B →
9,789,909 B gzip / 9,208,216 B zstd; no COOP/COEP anywhere; `/api/healthz` `ok:true mode:live wing:sepolia` with
`treasury.shortfalls: 0`; `/api/events` reaching the desk as `/events?…` (prefix strip proven by the desk's own
log); a **65 s** unbuffered SSE stream through the shipped Caddy; desk unreachable from the host; restart drill
green; the browser walk (splash → Godot *front door up* → desk-debug `/api` + treasury block) and the full `?desk=`
round trip; image scrub clean; `typecheck` clean; `killtests:s2` 6/6 Live and 6/6 Dev.

**VERIFY / human (OWED §1, HOSTING §7):** Cloudflare Tunnel create + public hostname (no token on this machine —
the tunnel itself was never run, only the image pinned and its empty-token failure mode recorded); Privy Allowed
origins += `https://branchzero.app` (its `frame-ancestors` list blocked the sign-in iframe at `localhost:8080`,
exactly as expected); treasury top-up; the first public smoke including an **authenticated ≥ 60 s `/events`**
stream, which needs an OTP sign-in from the public origin.

**Not touched:** lanes, Privy policy shapes, ROLE_SET, whitelists, session-signer flow, the one-modal rule,
`apps/game`, `docker-compose.yml`, `Dockerfile.teller`. Pages/R2 (§3) and GameLab ENG-2026-0025 are unchanged and
still marked parallel — neither was a blocker and neither was deleted.
