# Privy Integration — Login, Embedded Wallet, Session Signer, Policy

> Privy is the reason the game has one wallet modal instead of twenty. It is the **Account Opening desk**.

Related: [BLOXCHAIN-INTEGRATION.md](./BLOXCHAIN-INTEGRATION.md) § 4 · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SECURITY-AND-KEYS.md](./SECURITY-AND-KEYS.md)

Docs: [Privy signers overview](https://docs.privy.io/wallets/using-wallets/signers/overview) · [Configure signers](https://docs.privy.io/wallets/using-wallets/signers/configure-signers) · [Server-side access recipe](https://docs.privy.io/recipes/wallets/session-signer-use-cases/server-side-access) · [User and server signers](https://docs.privy.io/recipes/wallets/user-and-server-signers)

---

## 1. Prize target and criteria

**Best B2B financial product — $2,500** (ETHOnline 2026 Privy page). Requirements, mapped:

| Requirement | How Branch Zero satisfies it | Where judges see it |
|-------------|------------------------------|---------------------|
| Integrate Privy as a core part of the product | Login + embedded wallet + session signer are the only identity/signing layer | Account Opening desk; README § Privy |
| Create or use at least one Privy wallet | Every player gets an embedded EVM wallet (the `AccountBlox` owner) | Passbook shows owner address |
| Demonstrate a business / organisation use case | A bank branch: customer accounts, tellers (broadcaster), manager approvals, security officer | Whole game |
| At least one functional B2B workflow (payment, approval, treasury, wallet admin) | Lane A payment; Lane B time-locked wire with approval/cancel; guard config (payee allowlist) | Counter, Vault, Manager's office |
| Use at least one Privy control (policies, signers, key quorums, intents) | **Session signer** (key quorum) + **policy** restricting it to typed-data signing for the player's own account | Delegation step; policy JSON in repo |
| Working demo + source | Live web build + public repo | Submission |
| Clearly explain how Privy enables the product | README section + "Ask why" dialogue at the Clerk | README, in-game |

Secondary fit: **Best financial flow — $2,500** (transfers with hidden onchain complexity). We state B2B as primary in the submission and let judges consider both.

---

## 2. What we use, precisely

| Privy feature | Purpose | Client / server |
|---------------|---------|-----------------|
| React SDK (`@privy-io/react-auth`) | Login modal (email, passkey, social), embedded wallet creation on login | Client (React overlay over the Godot canvas) |
| Embedded EVM wallet | Player's owner key, held in Privy's enclave; never exported | Client-created, server-signable via signer |
| **Session signer** (key quorum with our P-256 authorization key) | Lets the Teller Desk request `eth_signTypedData_v4` (and optionally `eth_sendTransaction`) without a pop-up | Server (Node SDK `@privy-io/node` or REST) |
| **Policies** | Restrict what the signer may sign | Dashboard + policy IDs passed on `addSessionSigner` |
| Access tokens | Authenticate the player to the Teller Desk (`/session`) | Client → server, verified with Privy's public key |
| Funding (optional) | Testnet faucet is used instead; Privy onramp not needed | — |

Not used: Privy Cards (guided onboarding), intents (mocked out of scope), Solana.

---

## 3. Setup checklist (Day 2 morning)

**Status 2026-09-06 (after U1):** done, with corrections. Allowed origins already include
`http://localhost:5173`; server-side access and the P-256 authorization key are set and the key quorum
(`PRIVY_SIGNER_ID`) is live. **No dashboard policy is needed** (§4: created per player via the API) and **no
custom chain entry is needed** — `eth_signTypedData_v4` is chain-agnostic and `1337` rides in the EIP-712
domain, so K2 ran on Remote EVM without touching Sepolia. Two live facts worth knowing: embedded wallets are
`create_on_login: "off"` (the overlay calls `createWallet()` explicitly) and the app is in
`user-controlled-server-wallets-only` mode. Original checklist:

1. Allowed origins: `http://localhost:5173` (+ Pages later).
2. Login methods: email, passkey, Google. Embedded wallets: **create on login** for EVM.
3. Enable **Server-side access** (signers) and **Require signed requests**; generate the authorization key → `PRIVY_AUTHORIZATION_KEY`. Record signer / key-quorum ID → `VITE_PRIVY_SIGNER_ID`.
4. Create policies (§ 4). Domain name = **`Bloxchain`**. Record policy ID → `PRIVY_POLICY_ID`.
5. Chains: Sepolia (`11155111`); try custom **Remote EVM `1337`** for local K2 — if refused, K2 on Sepolia.
6. Fill local `.env` / Vite env (never commit secrets). Wrap overlay in `PrivyProvider`.

---

## 4. Policies (the one line that makes "background signing" honest)

Goal: the Teller Desk may only obtain signatures that are (a) typed data, (b) on the Bloxchain domain, (c) for the player's own account contract(s). Everything else is denied.

> **Verified 2026-09-06 (K5 PASS).** The sketch below is kept for context but two things in it are wrong.
> Policies are created **through the API, per player** (`apps/teller-desk/src/privy.ts`), not as dashboard
> JSON, and **`domain.name` is not a condition field**: `EthereumTypedDataDomainConditionField` is
> `chainId | verifyingContract | chain_id | verifying_contract`. What we actually ship:

```ts
await privy.policies().create({
  version: '1.0',
  chain_type: 'ethereum',
  name: `bz-${label}`,                       // <= 48 chars; rule names must be < 50
  rules: [{
    name: 'Bloxchain meta-tx for this account',
    method: 'eth_signTypedData_v4',
    action: 'ALLOW',
    conditions: [
      { field_source: 'ethereum_typed_data_domain', field: 'verifyingContract', operator: 'eq', value: account },
      { field_source: 'ethereum_typed_data_domain', field: 'chainId',           operator: 'eq', value: '1337' },
    ],
  }],
});
// anything not matched falls through to Privy's default DENY
```

Pinning `verifyingContract` is the stronger half of the original intent: it is the player's own AccountBlox,
so a signature obtained under this policy cannot address anyone else's account. Losing the `name` clause costs
little — a contract at that address either speaks Bloxchain or the meta-tx reverts.

**Lifecycle.** The policy must exist before the player delegates (the consent carries its id), but the account
address only exists after provisioning. Wallet records are owned by the *user's* key quorum, so the server
cannot attach signers or policies later — but policy **rules** are app-owned and can be updated. Hence:

1. `POST /session` → `policies().create` scoped to `chainId`; returns `policyId`.
2. Browser consent → `addSessionSigners({ signerId, policyIds: [policyId] })`.
3. `POST /provision` → clone the account, then `policies().updateRule(...)` to add the `verifyingContract` condition.

Original sketch (superseded):

```json
{
  "version": "1.0",
  "name": "bz-typed-data-owner-only",
  "chain_type": "ethereum",
  "rules": [
    {
      "name": "Allow Bloxchain meta-tx typed data for the player's account",
      "method": "eth_signTypedData_v4",
      "conditions": [
        { "field_source": "ethereum_typed_data_domain", "field": "name", "operator": "eq", "value": "Bloxchain" },
        { "field_source": "ethereum_typed_data_domain", "field": "verifyingContract", "operator": "in", "value": ["<player-account-sepolia>", "<player-account-arc>"] }
      ],
      "action": "ALLOW"
    }
  ],
  "default_action": "DENY"
}
```

Lane B option 1 adds a second rule: `eth_sendTransaction` allowed only when `to == <player-account>` and calldata selector == `executeWithTimeLock` (if calldata matching is supported; else method + `to` only).

---

## 5. Client flow (React overlay)

```tsx
// apps/web/src/overlay/Wallet.tsx
import { usePrivy, useWallets, useSessionSigners } from '@privy-io/react-auth';

export function useBranchZeroWallet() {
  const { login, logout, authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { addSessionSigners, removeSessionSigners } = useSessionSigners();
  const embedded = wallets.find(w => w.walletClientType === 'privy');

  async function delegate() {
    await addSessionSigners({
      address: embedded!.address,
      signers: [{ signerId: import.meta.env.VITE_PRIVY_SIGNER_ID, policyIds: [policyIdForPlayer] }],
    });
  }
  async function revoke() { await removeSessionSigners({ address: embedded!.address }); }

  return { login, logout, authenticated, embedded, delegate, revoke, getAccessToken };
}
```

`window.BranchZero.login()` resolves once `authenticated && embedded` and after `POST /session` with the access token. `addSessionSigner()` maps to `delegate()`; the game shows the Clerk's consent line first.

Client-side fallback (no delegation): wrap `await embedded.getEthereumProvider()` in viem `createWalletClient({ transport: custom(provider) })` and use the SDK's `MetaTransactionSigner.signMetaTransactionWithWallet` in the browser. The game marks `signingMode = 'client'` and tellers say "sign the slip" before each action.

---

## 6. Server flow (Teller Desk)

As built against `@privy-io/node@0.34.0` (method names verified, not guessed):

```ts
// apps/teller-desk/src/privy.ts
import { PrivyClient } from '@privy-io/node';

export const privy = new PrivyClient({ appId: env.PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET });

// The P-256 key is passed per request, not on the constructor. The dashboard value is prefixed
// `wallet-auth:`; strip it — the API wants the bare base64 PKCS8 key.
const authorizationContext = { authorization_private_keys: [env.PRIVY_AUTHORIZATION_KEY.replace(/^wallet-auth:/, '')] };

// /session: the token proves who they are; looking the claimed wallet up and matching the user id
// proves the wallet is theirs. (`users().get()` takes an *identity token*, not a user id.)
const claims = await privy.utils().auth().verifyAccessToken(token);
const user = await privy.users().getByWalletAddress({ address });
if (user.id !== claims.user_id) throw new Error('that wallet does not belong to the authenticated user');

// typed-data signing used by the viem custom account (see BLOXCHAIN-INTEGRATION § 4)
await privy.wallets().ethereum().signTypedData(walletId, {
  authorization_context: authorizationContext,
  params: { typed_data: { domain, types, primary_type: 'MetaTransaction', message } },
});
```

Two gotchas that cost time:

- **BigInt.** Privy canonicalises the request body as JSON before signing it with the authorization key, and
  `JSON.stringify` throws on a BigInt — which is exactly what viem hands `signTypedData` for every `uint256`.
  Render numeric fields as decimal strings first (`jsonSafe` in `signing/privySigner.ts`). The digest is
  unchanged; only transport encoding is.
- **The server cannot delegate to itself.** `wallets().update({ additional_signers | policy_ids })` on a
  user-controlled wallet returns `401 No valid authorization keys or user signing keys available`, because the
  wallet's `owner_id` is the *user's* key quorum. Only the browser consent can grant signing rights. This is a
  feature: it is what makes the "one modal" a real control rather than a courtesy.

Exact method names follow the installed Node SDK version; the REST fallback is `POST /v1/wallets/{wallet_id}/rpc` with `method: "eth_signTypedData_v4"` and the authorization signature header.

**Every** signature request logs `{ owner, walletId, chainId, verifyingContract, handlerSelector, nonce }` so the judges (and we) can audit what was signed.

---

## 7. UX rules for the Clerk (Ines)

- One consent, plainly worded, with a **Revoke** option always visible at the desk.
- Show the policy summary in the leaflet prop: "Signer may: sign bank slips for your account. Signer may not: anything else."
- If Privy is unreachable, the Clerk says so and offers "sign each slip yourself" (client mode) — never a dead end.

---

## 8. Judge-facing proof

- README § Privy: what is created (wallet), what control is used (session signer + policy JSON committed under `infra/privy/policy.json`), what workflows run (payment, time-locked approval, allowlist config).
- Video: the delegation moment, then three actions with **no modals**; a cut to the Privy dashboard showing the signer and policy.
- Code pointers: `apps/web/src/overlay/Wallet.tsx`, `apps/teller-desk/src/privy.ts`, `apps/teller-desk/src/signing/privySigner.ts`.

---

## 9. Risks

| Risk | Mitigation |
|------|-----------|
| Typed-data field conditions not supported by policy engine | Method-level scope + on-chain guards; say so in README |
| Session signer requests rate-limited or slow (>3 s) | Show real stage "Stamping your slip…"; cache nothing; serialise per player |
| Privy iframe blocked by strict headers | Single-thread Godot export; no COEP |
| Embedded wallet has no gas for Lane B option 1 | Airdrop 0.02 Sepolia ETH / faucet USDC at provisioning; watch balance in `/healthz` |
