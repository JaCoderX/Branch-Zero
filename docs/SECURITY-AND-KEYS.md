# Security and Keys — Custody, Environments, Threat Model

> Testnet money is worthless; habits are not. The Teller Desk is a hot signer that can move player funds, so it is treated as production-grade in design and hackathon-grade in effort.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRIVY.md](./PRIVY.md) § 4 (policy) · [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) § 2 (roles)

---

## 1. Actors and keys

| Key | Holder | Role on-chain | Can do | Cannot do |
|-----|--------|---------------|--------|-----------|
| **Player owner key** | Privy embedded wallet (TEE); user + our session signer in the key quorum | `OWNER_ROLE` of the player's `AccountBlox` | sign meta-tx (typed data) within policy; `eth_sendTransaction` for Lane B request | be exported by us; sign outside policy |
| **Session signer authorization key** (P-256) | Teller Desk env (`PRIVY_AUTHORIZATION_KEY`) | none | authorise signing requests to Privy on behalf of players who delegated | move funds without a matching Privy policy |
| **Broadcaster key** | Teller Desk env (`BROADCASTER_PK`) | `BROADCASTER_ROLE` on every player account | submit owner-signed meta-txs; pay gas | initiate or approve anything alone (no signature = revert) |
| **Deployer key** | Teller Desk env (`DEPLOYER_PK`) | deploys `AccountBlox`; calls `initialize`; funds faucet | create accounts; one-shot guard config **before** handing ownership | anything after `initialize` (owner is the player) |
| **Recovery key** | Cold — env only on the operator laptop, not on the server | `RECOVERY_ROLE` on every account | `transferOwnershipRequest` (time-locked) | execute without the timelock |
| **Bank ENS key** | Teller Desk env (`ENS_REGISTRAR_PK`) | owner of `branchzero.eth` on Sepolia | mint subnames, set records under EAC roles | touch player accounts |

Separation is the demo: the Manager approves, the Teller broadcasts, the Security Officer recovers, the Registrar names. Nobody holds two of those.

---

## 2. Bloxchain invariants we rely on (from the public SDK/contracts)

1. A meta-tx executes only if `recover(signature) == signer` and the signer holds the required role/permission for that selector — the broadcaster is a courier.
2. Meta-tx replay protection: per-signer nonce, `chainId`, `verifyingContract`, and `deadline` are all in the EIP-712 digest.
3. Time-locked transactions cannot be approved before `releaseTime`; cancellation is available to the owner (and a configured runtime role) while pending.
4. `GuardController` refuses targets/selectors not whitelisted for the caller's role.
5. Ownership/recovery/broadcaster changes are themselves timelocked operations.

We do not add contracts, so we inherit these unchanged. Anything we cannot express with them is out of scope (see [REFLECTION.md](./REFLECTION.md) § Kill tests).

---

## 3. Privy policy (the second wall)

Even if the Teller Desk is fully compromised, the attacker holds: the broadcaster key (gas only), and the ability to *ask* Privy to sign on behalf of players. The policy limits what Privy will sign:

- Method allowlist: `eth_signTypedData_v4` (+ `eth_sendTransaction` only if Lane B option 1 is used, restricted to `to = player's own account`).
- Typed-data constraints: `domain.name == "EngineBlox"`-family name from the SDK (`VERIFY` exact string via `MetaTransactionSigner` output), `domain.chainId ∈ {11155111, 5042002}`, `domain.verifyingContract == <that player's account>`.
- Optional: per-player daily notional limit enforced by the Teller Desk (soft) and demonstrated in the Manager's office (lore + real cap via `executeWithTimeLock` for amounts over the threshold).

Full JSON lives in `infra/privy/policy.json` and is shown in-game on the Manager's wall (see [PRIVY.md](./PRIVY.md) § 4).

---

## 4. Environments

| Env | Where | Chains | Keys |
|-----|-------|--------|------|
| `local` | laptop; **Remote EVM** (`1337`) default; Anvil fork optional | Remote EVM + optional Sepolia / Arc RPCs | Remote EVM uses Ganache-parity keys **only on 1337**. Separate throwaway keys for Sepolia/Arc in `.env.local` |
| `demo` | single VPS or Fly.io machine for Teller Desk; static host for web | Sepolia + Arc Testnet | dedicated keys, funded from faucets, rotated after the event |

`.env.example` (Teller Desk):

```
PORT=8787
REMOTE_EVM_RPC_URL=http://127.0.0.1:8545
SEPOLIA_RPC_URL=
ARC_RPC_URL=
BROADCASTER_PK=
DEPLOYER_PK=
ENS_REGISTRAR_PK=
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_AUTHORIZATION_KEY=      # P-256 private key, PEM, base64
PRIVY_POLICY_ID=
DEFINITIONS_SEPOLIA_JSON=infra/deployments/sepolia.json
DEFINITIONS_ARC_JSON=infra/deployments/arc-testnet.json
DEMO_USDC_SEPOLIA=
ALLOWED_ORIGINS=https://branchzero.app,http://localhost:5173
```

Rules: `.env*` git-ignored; secrets only via host env or Fly secrets; `git secrets`/`gitleaks` pre-commit hook; never print keys in logs; addresses (not keys) checked into `infra/deployments/*.json`.

---

## 5. Teller Desk hardening (what we actually do in 10 days)

| Control | Implementation |
|---------|----------------|
| AuthN | Privy access token (JWT) verified on every request; `userId` from token, never from body |
| AuthZ | A player may only act on **their** account (`accounts[userId] == req.account`) |
| Input validation | zod schemas on every route; amounts as decimal strings; addresses checksummed; ENS names normalised (ENSIP-15) |
| Rate limiting | per-user + per-IP token bucket; faucet route heavily limited |
| Idempotency | `Idempotency-Key` header on `/pay`, `/wire`, `/provision`; stored 24 h |
| Nonce handling | broadcaster nonce managed by a single in-process queue (one chain, one sender) |
| Gas caps | per-tx gas limit ceiling; broadcaster balance alarm at 0.05 ETH / 5 USDC |
| CORS | strict allowlist |
| Logging | structured, no PII beyond `userId`, no signatures at info level |
| Secrets | host env only; no `.env` on the server disk |
| Dependencies | `npm audit` at CI; pinned `@bloxchain/sdk` version |

---

## 6. Threat model (STRIDE-lite)

| Threat | Vector | Mitigation | Residual |
|--------|--------|------------|----------|
| Stolen broadcaster key | server breach | key cannot initiate without owner signature; only gas at risk | gas drain → top-up alarm |
| Malicious Teller Desk requests signatures for arbitrary calls | server breach / insider | Privy policy pins `verifyingContract` + chain + method; Bloxchain guards pin target/selector; large amounts forced to Lane B where the player/manager must approve | policy-allowed small payments to whitelisted payees |
| Replay of a signed meta-tx | network | nonce + deadline + chainId in digest | none |
| Cross-wing replay (Sepolia sig on Arc) | network | different `chainId` and `verifyingContract` | none |
| Player spoofing another player | client | JWT-bound `userId` → account map | none |
| Phishing via ENS lookalikes | social | display normalised name + resolved address + avatar; require confirmation for first-time payees (and whitelist them via guard batch) | user error |
| Session signer abuse after event | ops | revoke session signers / delete policy at wrap-up; rotate keys | none |
| Browser tab compromise (XSS) | client | no keys in browser; Privy iframe isolation; CSP on shell | phishing UI |
| DoS on Teller Desk | network | rate limits; static web keeps loading | demo outage — keep backup recording |
| Godot bridge injection | client | JSON-only bridge; no `eval`; server validates everything | none |

---

## 7. Honest limitations (put these in the README)

- Bloxchain contracts are used **as published** on testnets; Branch Zero performs no audit and deploys nothing to mainnet.
- The Teller Desk is a single hot signer; a real bank would split broadcaster duties across HSM-backed signers and add monitoring.
- Privy policies are enforced by Privy; we trust their TEE and policy engine.
- Recovery flow is lore in MVP (S2 if time). The role exists on-chain; the UI to exercise it does not.
- Wrap-up: on Sep 17 revoke all session signers, disable the policy, and drain broadcaster/deployer balances back to the faucet address or a burn.
