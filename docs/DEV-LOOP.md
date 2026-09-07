---
title: Development loop — craft, lab, product
created: 2026-09-06
updated: 2026-09-07
---

# Development loop

How Branch Zero is built without turning GameDevOS into a second backlog or GameLab into the game.

Related: [HANDOFF-CC.md](./HANDOFF-CC.md) · [PLAN.md](./PLAN.md) · [REMOTE-EVM.md](./REMOTE-EVM.md) · GameDevOS `OBJ-2026-0004` · GameLab `ENG-2026-0003`…`0008`

---

## 1. Three layers

```text
OBJ-2026-0004 (GameDevOS)     what we intend to still know after the event
        │
        ▼
ENG-2026-0003…0013 (GameLab)  one falsifiable question each (kill tests)
        │  handoff = rewrite, never merge
        ▼
U0–U7 (this repo)             construction that ships
```

| Layer | Authority | Never |
|-------|-----------|-------|
| **GameDevOS** | Craft method, scrubbed lessons | Engine projects, product status |
| **GameLab** | Isolated yes/no | Hosting the game; merging into this repo |
| **Branch Zero** | Code, demo, sponsors | Inventing protocol semantics |

Open an ENG when the answer is **unknown and could kill the thesis**. If the shape is already in ARCHITECTURE, **build here**.

---

## 2. Chain policy

| Work | Chain |
|------|--------|
| Local Teller Desk, deploy scripts, Lane A/B iteration, Godot MockChain replacement | **Remote EVM `1337`** — [REMOTE-EVM.md](./REMOTE-EVM.md) |
| ENS mint/resolve, Uniswap, judge-facing Sepolia receipts | Sepolia |
| Arc wing / K3 | Arc Testnet `5042002` |

Do not use public testnets to find out whether `initialize` reverts. **Do not wipe** Remote EVM volumes; live block gas limit is **16,777,216** (measured — see [REMOTE-EVM.md](./REMOTE-EVM.md); the earlier "≈20M" is retracted).

**Product packages:** `@bloxchain/sdk` + `viem` only. Bootstrap/clone via protocol CopyBlox scripts — not `@bloxchain/contracts` in this repo.

---

## 3. Construction units

Ordered so that after U2 we can stop and still demo a coherent bank-on-a-chain (ugly is fine).

| Unit | Outcome | Gate | Lab first? |
|------|---------|------|------------|
| **U0 Foundation** | Monorepo, Godot web + JS echo, SDK, AccountBlox fixture on Remote EVM | G1 | **met 2026-09-06** |
| **U1 Signing lane** | Privy + session signer + Lane A (≤1 modal); SDK only; CopyBlox for new accounts when needed | G2 | ENG-0004 — **met 2026-09-06** |
| **U2 Timelock lane** | Wire → PENDING → approve/cancel; SSE; `releaseTime` from chain | G3 | No — **met 2026-09-06** |
| **U3 Bank shell** | Greybox zones, NPCs wired to bridge, ledger board | G4 | No — **met 2026-09-06** (mock walk + real-bridge desk calls; human OTP walk pending) |
| **U4 MVP freeze** | Error UX, reconnect, canvas focus, rough capture | G5 | No — **met 2026-09-07** (canvas re-focus, `RPC`/`AUTH`/`NOT_CONFIGURED` paths, SSE reconnect + `desk.link`, first load measured; real 30 s capture owed by the human walk) |
| **U4+ Priority release** | Ruth waits the clock; Okafor meta-bypass + Passkey before `releaseTime` | G5b | ENG-0012 + 0011 + 0013 — **met 2026-09-07** (ROLE_SET 3 split on chain, `/priority/*`, Passkey step-up in the overlay, policy pins the silent lane to `params.action`; kill tests Y0–Y9) |
| **U5 ENS** | Subname + pay-by-name | G6 | ENG-0007 — **yes** (2026-09-07); pin UR V2 `0x85ed…b92cf` |
| **U6 Arc + manager role** | Elevator wing + runtime role (manager already in U4+ as Priority submitter) | G7 | ENG-0006 |
| **U7 Feel / ship** | Art, video, submission | G8–G10 | ENG-0008 only if S1; staged art: Stage 1–3 met; next [`KICKOFF-U7-viz-stage4.md`](./KICKOFF-U7-viz-stage4.md) when clear of U5 |

Each unit ends with: commit, a line in `docs/progress/`, kill/decision log if anything changed.

### Daily rhythm (from PLAN)

09:00 15-min plan · 13:00 integration merge · 20:00 capture + log. No new dependencies after Day 7 without a `REFLECTION.md` note.

---

## 4. Graduation rule

```text
ENG findings  →  handoff.md (behaviour, not files)
              →  rewrite in apps/ / infra/
              →  if it generalises: scrub → GameDevOS wiki/lessons/
```

A Godot project left only in `GameLab/work/ENG-2026-0003-…` is a failed U0.

---

## 5. Cut order (time death)

Uniswap → Manager runtime role → Arc wing → ENS EAC → ENS mint.

**Never cut:** Privy (or documented K2 fallback) or Lane B.
