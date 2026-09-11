---
title: Kickoff prompt — Hackathon all-in-one compose (Caddy + CF Tunnel) for branchzero.app
created: 2026-09-12
product: Branch-Zero
model: Claude Code · Fable 5.1
handoff: docs/missions/HANDOFF-hosting-hackathon-compose.md
---

# Kickoff prompt — Hackathon all-in-one compose + branchzero.app

Paste into a **new** Claude Code session. Prefer **Fable 5.1**.

**What this is:** one Docker Compose stack = Vite+Godot shell + Live Teller Desk + **Caddy** reverse proxy +
**Cloudflare Tunnel**, so `https://branchzero.app` works for the hackathon without Cloudflare Pages' ~25 MiB
per-file cap.

**Why:** official `index.wasm` is **36.29 MiB**; Pages+R2 is the scalable twin but more moving parts. Desk image and
`?desk=` already shipped ([HANDOFF-hosting-private-desk.md](./HANDOFF-hosting-private-desk.md) met). This unit
colocates front + desk for the fastest public URL. Lab ENG-2026-0025 stays parallel — do not wait on it.

**Baseline:** `Dockerfile.teller` + `docker-compose.yml` (Live + `dev` profile); shell `desk.ts` runtime override;
HOSTING.md documents Pages/R2. Extend — do not rip out.

**Handoff:** [`HANDOFF-hosting-hackathon-compose.md`](./HANDOFF-hosting-hackathon-compose.md)

---

## Reflect

| Fact | Implication |
|------|-------------|
| Wasm 36.3 MiB | Same-origin `/game/` inside compose — no R2 required for this path |
| Vite strips `/api` prefix | Caddy must rewrite `/api/*` → teller root the same way |
| EventSource + SSE | Proxy must not buffer; verify streaming |
| Tunnel token is a secret | Env / gitignored credentials only |
| Privacy = operator custody | Same compose locally; keys stay in desk env + volume |
| `1337` never public | Tunnel and public ports = Live only |

---

```text
You are a cold agent. No prior chat. Prefer docs over memory. Model: Claude Code Fable 5.1.

MISSION: Branch Zero — Hackathon all-in-one compose + branchzero.app (Caddy + Cloudflare Tunnel) ONLY.
(1) Extend Docker Compose: Live teller (reuse Dockerfile.teller) + static shell (dist incl. /game) + Caddy (file_server + /api reverse_proxy, wasm MIME, NO COOP/COEP, SSE-friendly) + cloudflared (token from env).
(2) Hackathon shell build: VITE_TELLER_DESK_URL=/api (or default /api); unset VITE_GAME_BASE_URL; bake only public VITE_PRIVY_* (and optional GitHub client id). Document export:web → build:web → image/volume path without committing secrets or forcing wasm into git.
(3) Do not publish Dev/1337 on the tunnel. Prefer teller reachable only on the compose network (Caddy ingress) for the public profile.
(4) Docs: HOSTING.md hackathon-first section; ARCHITECTURE §9 short amendment; OWED §1 human steps (Tunnel DNS, Privy origins, treasury, smoke); handoff Outcome + status.
Freedom on HOW. No freedom on constraints.

BEFORE CODE — read in order:
1. AGENTS.md (root)
2. docs/missions/HANDOFF-hosting-hackathon-compose.md
3. docs/missions/KICKOFF-hosting-hackathon-compose.md
4. docs/missions/HANDOFF-hosting-private-desk.md (Outcome — what already shipped)
5. docs/HOSTING.md (full)
6. docs/ARCHITECTURE.md §9
7. docs/SECURITY-AND-KEYS.md §1, §4, §4.1
8. docs/SEPOLIA-LIVE.md §4.6 (never expose 1337)
9. docs/PRIVY.md §3 (Allowed origins)
10. Dockerfile.teller · docker-compose.yml · .dockerignore
11. apps/web/vite.config.ts ( /api rewrite ) · apps/web/src/shell/desk.ts · apps/web/public/_headers
12. apps/web/src/shell/deskEvents.ts (SSE reconnect)

Local root: D:\My Git Projects\D9-Studio\Branch-Zero

HARD RULES:
- Public @bloxchain/sdk + viem only; no Solidity; no GameLab ENG merges into product.
- No secrets in git or image layers (desk env, TUNNEL_TOKEN, Privy secrets). Shell may bake only VITE_* public ids.
- Never expose Remote EVM 1337 / teller-dev on the tunnel or public host ports.
- Do not touch lanes, Privy policy shapes, ROLE_SET, whitelists, session-signer flow, one-modal rule.
- No auto-fallback from a chosen private desk to the hosted desk.
- Caddy headers: wasm MIME OK; never COOP/COEP.
- Do not run a production tunnel deploy with the principal's live secrets unless explicitly given a token and told to; prefer local verify + runbook. Principal owns CF Tunnel create, DNS route, Privy dashboard, treasury.
- Do not block on Pages, R2, or ENG-2026-0025. Do not delete the Pages/R2 runbook — mark it parallel/later.
- Keep unrelated uncommitted working-tree changes out of your commits.
- Local progress notes under docs/progress/ (gitignored).

SEQUENCE:
1. Inventory — compose services, /api rewrite contract, how dist/game gets into a container, whether public/game exists (export:web if Godot present, else document VERIFY artefact).
2. Compose — Caddyfile + services (teller-live, web/static, caddy, cloudflared profile or service). Internal network; Live only on tunnel path.
3. Build path — document and automate as far as practical: export → build:web with /api → serve dist. Prove locally: curl / and /api/healthz through Caddy; wasm Content-Type; no COOP/COEP.
4. SSE — confirm /api/events streams (flush); record ≥ 60 s or mark VERIFY for authenticated public origin.
5. Tunnel — compose service + env template; dry-run docs if no token; never commit credentials.
6. Docs — HOSTING hackathon section; ARCHITECTURE §9; OWED; handoff Outcome + status met/blocked.
7. Regression — npm run typecheck; killtests:s2 Live (and Dev locally if unchanged); ?desk= still works.

DoD = HANDOFF-hosting-hackathon-compose Verification checklist + OWED tick + handoff status met.
Stop when met / blocked (see handoff Stop conditions).
```

---

## After

Principal: create Cloudflare Tunnel + route `branchzero.app` (and `www` if wanted) to the tunnel; Privy Allowed
origins += `https://branchzero.app`; fund treasury (OWED §1); `compose up` with Live secrets; smoke splash → Godot →
OTP → Lane A. Pages/R2 and ENG-0025 remain optional follow-ups after the event.
