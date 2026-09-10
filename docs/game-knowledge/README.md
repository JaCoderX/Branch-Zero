# Game knowledge (iNPC-safe)

Curated, **player-facing** markdown that is the **only** general knowledge loaded into the Branch Zero service
assistant (iNPC). The robot has no tools, no web, no GitHub and no repo access at runtime: whatever is not in the
files below (plus the live `GameState.inpc_snapshot()`) does not exist for it. **These files are its hard source of truth.**

The web shell bundles the allowlist at build time (`apps/web/src/inpc/pack.ts`). Per-player facts come only from
the live snapshot — never from these files.

Coding agents: start at root [`AGENTS.md`](../../AGENTS.md). That file and the rest of `docs/` are **not** in the
robot’s context.

## Allowlist (everything the iNPC may see)

| File | Role | Prompt slot |
|------|------|-------------|
| [`system-rules.md`](./system-rules.md) | Behaviour locks (reader/teacher; snapshot is sole player truth) | System rules |
| [`teaching-pack.md`](./teaching-pack.md) | Bank words, lanes, staff who-does-what, board vocabulary | Teaching pack |
| [`bloxchain-account.md`](./bloxchain-account.md) | Ask-why depth: AccountBlox, roles, meta-tx slips, timelock, guards, ENS, FX | Technology primer |

Adding a file means: write it here, import it in `pack.ts`, add it to the prompt in `prompt.ts`, update this table.

## Explicitly excluded (never load)

- `docs/missions/` — every `HANDOFF-*` and `KICKOFF-*` (agent briefs, key names, operator state)
- `AGENTS.md`, `docs/OWED.md`, `docs/SECURITY-AND-KEYS.md`, `docs/SEPOLIA-TREASURY.md`, `docs/PRIVY.md`, `docs/REMOTE-EVM.md`, `docs/SEPOLIA-LIVE.md`
- `docs/ARCHITECTURE.md`, `docs/BLOXCHAIN-INTEGRATION.md`, `docs/GODOT.md`, `docs/DEV-LOOP.md`, `docs/PLAN.md`, `docs/REFLECTION.md`
- `.env*`, `infra/`, `apps/teller-desk/`, anything under `docs/progress/`
- Any content with addresses, hashes, RPC URLs, key names, Live/Dev switches or desk-debug

If a fact from an excluded doc is needed by the robot, **rewrite it in bank words here**; never link or copy the doc.

## Rules for editing

1. Bank words first; protocol jargon in “Ask why” style with the bank word alongside.
2. No addresses, keys, RPC URLs, Live/Dev ops, desk-debug, or hashes. Demo constants (limits, cooling seconds) belong to the snapshot, not here.
3. Be complete: assume the reader has no other source. If a player could reasonably ask it, answer it or say which desk answers.
4. Keep the combined pack bounded (target under ~5k tokens) so the snapshot stays loud.
5. Align facts with [`GAME-DESIGN.md`](../GAME-DESIGN.md) §4, [`NPCS.md`](../NPCS.md) Ask-why lines, and the public Bloxchain account pattern; do not invent desks or protocol behaviour.
6. After content changes, rebuild/typecheck the web app; re-smoke iNPC grounding if the pack meaning shifts
   ([`INPC.md`](../INPC.md), OWED §2 walk).

## Provenance

Adapted from the GameLab ENG-2026-0019 fixture that proved 16/16 grounding on Inkling Small (ENG-2026-0020),
then product-owned under Branch Zero. Technology primer distilled from the public Bloxchain account pattern
(SecureOwnable / RuntimeRBAC / GuardController) and this repo's design docs. Nothing is read from GameLab or
GitHub at runtime.
