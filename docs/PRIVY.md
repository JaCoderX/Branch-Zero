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

**Status 2026-09-06 evening:** Privy **application created** by principal. Remaining human steps before / during U1:

1. Allowed origins: `http://localhost:5173` (+ Pages later).
2. Login methods: email, passkey, Google. Embedded wallets: **create on login** for EVM.
3. Enable **Server-side access** (signers) and **Require signed requests**; generate the authorization key → `PRIVY_AUTHORIZATION_KEY`. Record signer / key-quorum ID → `VITE_PRIVY_SIGNER_ID`.
4. Create policies (§ 4). Domain name = **`Bloxchain`**. Record policy ID → `PRIVY_POLICY_ID`.
5. Chains: Sepolia (`11155111`); try custom **Remote EVM `1337`** for local K2 — if refused, K2 on Sepolia.
6. Fill local `.env` / Vite env (never commit secrets). Wrap overlay in `PrivyProvider`.

---

## 4. Policies (the one line that makes "background signing" honest)

Goal: the Teller Desk may only obtain signatures that are (a) typed data, (b) on the Bloxchain domain, (c) for the player's own account contract(s). Everything else is denied.

Policy sketch (dashboard JSON; exact schema per current Privy docs — verify field names on Day 2, kill test **K5**):

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

Because the verifying contract is per player, either (a) create one policy per player at provisioning via the Policies API and pass its ID to `addSessionSigner`, or (b) if typed-data field matching is unavailable, scope by **method only** and document that the on-chain guards (whitelist, roles, nonce, deadline, chainId) are the real control — which is true, and is exactly Bloxchain's design point.

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

```ts
// apps/teller-desk/src/privy.ts
import { PrivyClient } from '@privy-io/node'; // or REST with privy-authorization-signature header

export const privy = new PrivyClient({
  appId: env.PRIVY_APP_ID,
  appSecret: env.PRIVY_APP_SECRET,
  authorizationPrivateKey: env.PRIVY_AUTHORIZATION_PRIVATE_KEY, // signs every wallet request
});

// verify player token on /session
const claims = await privy.utils().auth().verifyAccessToken(token);
const user = await privy.users().get(claims.userId);
const wallet = user.linkedAccounts.find(a => a.type === 'wallet' && a.walletClientType === 'privy' && a.chainType === 'ethereum');
// store { privyUserId, ownerAddress: wallet.address, walletId: wallet.id }

// typed-data signing used by the viem custom account (see BLOXCHAIN-INTEGRATION § 4)
await privy.wallets().ethereum().signTypedData(walletId, { typedData });
// Lane B option 1:
await privy.wallets().ethereum().sendTransaction(walletId, { caip2: 'eip155:11155111', transaction: { to, data, value: '0x0' } });
```

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
