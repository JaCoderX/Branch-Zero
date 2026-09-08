# ENSv2 Integration — The Name Desk

> **S2 (2026-09-08):** ENS is Sepolia-only and unchanged, on **both** payment wings. On the Live wing (Sepolia)
> pay-by-name now resolves *and* pays on Sepolia — proven by
> [`0x44bfdb21…`](https://sepolia.etherscan.io/tx/0x44bfdb2163a5d4a97e1cf8737646eadf1a0454658bd105276f1019fafa767640);
> in Developer Mode it still resolves on Sepolia and pays on `1337`. See [SEPOLIA-LIVE.md](./SEPOLIA-LIVE.md).

> Names are not decoration here. Your bank name *is* your account pointer, your passbook fields *are* text records, and what staff may edit *is* Enhanced Access Control.

Related: [GAME-DESIGN.md](./GAME-DESIGN.md) § 5.4 · [NPCS.md](./NPCS.md) § 4.6 · [ARCHITECTURE.md](./ARCHITECTURE.md) § 3.4

Docs: [ENSv2 for app developers](https://docs.ens.domains/ensv2/tutorial-app-developers/) · [ENSv2 for contract developers](https://docs.ens.domains/ensv2/tutorial-contract-developers/) · [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/) · [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control) · [Indexing ENSv2](https://docs.ens.domains/ensv2/indexing/) · [contracts-v2 repo](https://github.com/ensdomains/contracts-v2) (Sepolia address tables under `contracts/docs/addresses/sepolia.md`)

---

## 1. Prize target and criteria

**Best Use of ENSv2 — $4,500 (1st $1,500 · 2nd $1,500 · 3rd $1,000 · runner-up $500).**

| Requirement (from the prize page) | Branch Zero |
|-----------------------------------|-------------|
| Built on ENSv2 (**Sepolia**) | Main wing is Sepolia; all ENS calls target the Sepolia ENSv2 beta deployment |
| ENSv2 features central, not cosmetic | Subname registry under the bank's name; account resolution drives payments; text records drive passbook/tier; EAC drives staff permissions; wildcard/parent-resolver resolution for cheap names |
| Functional demo, no hard-coded values | Availability check, mint, resolve and record writes all live at demo time |
| Video or live demo + open source | Both |
| Bonus: AI agents as namespaces | Optional stretch: give the Teller Desk service its own `teller.staff.branchzero.eth` with a text record describing its policy — "agent as a named actor" |

Features the prize text explicitly invites, and where each lands:

| ENSv2 feature | Use in game | Ships |
|---------------|-------------|-------|
| Hierarchical registry / own subname registry (`UserRegistry`) | `branchzero.eth` → UserRegistry for customers; `staff.branchzero.eth` → second UserRegistry for staff | T1 |
| Wildcard resolution off the parent's resolver | Cheap "guest" names resolved from the parent `PermissionedResolver` before a player mints a tokenised subname | T1 (nice) |
| Enhanced Access Control (EAC) | Teller role may edit `bz.tier` on customer names; cannot touch `addr` | T1 (scripted demo moment) |
| Permissioned Resolver per subname | Customers who "upgrade" get their own resolver → fully own their records | Stretch |
| Record aliasing / namespace aliasing | `arc.branchzero.eth` aliases the customer namespace for the Arc wing display names | Stretch |
| Expiring / revocable / non-transferable subnames | Staff names: non-transferable, revocable by the bank; customer names: transferable, 1-year expiry | T1 (flags at mint) |

---

## 2. Naming scheme

```text
branchzero.eth                          # parent, owned by the bank (Sepolia ENSv2)
├── alice.branchzero.eth                # customer (transferable ERC-1155 in customers UserRegistry)
│     addr(60)      → alice's AccountBlox (Sepolia)
│     addr(coinType for Arc 5042002) → alice's AccountBlox (Arc)   (ENSIP-11 EVM coinType)
│     text bz.tier  → "Silver" | "Gold"
│     text bz.limit → "100"           (instant lane limit, display only)
│     text avatar   → optional
├── staff.branchzero.eth                # staff namespace (second UserRegistry, non-transferable names)
│     ├── teller.staff.branchzero.eth    addr → Teller Desk broadcaster; text bz.role → "BROADCASTER"
│     ├── manager.staff.branchzero.eth   addr → manager wallet;          text bz.role → "BRANCH_MANAGER"
│     └── security.staff.branchzero.eth  addr → recovery address;        text bz.role → "RECOVERY"
└── arc.branchzero.eth                  # (stretch) alias of the customer namespace for the Arc wing
```

The staff names make the roster **auditable by name**: the manager's office board resolves `manager.staff.branchzero.eth` and compares it with `RuntimeRBAC.getAuthorizedWallets(BRANCH_MANAGER)`; mismatch shows a red flag. That is a real use of ENS as an on-chain directory.

---

## 3. Setup (Day 1 registration, Day 6 build)

1. **Parent name `branchzero.eth`**
   - **Mainnet:** owned by the bank in a **separate** wallet (brand / prize surface only — never in Teller Desk env).
   - **Sepolia ENSv2 (product):** **ready** (ENG-2026-0007 **yes**, 2026-09-07). `ETHRegistrar.isAvailable("branchzero")=false`; `ETHRegistry.ownerOf` = registrar `0xc4d7…9277`; Customers UserRegistry `0x64ED…073c`; resolver proxy `0xf8b95…6C72`. Lab minted `test.branchzero.eth` and resolved via ENSv2 Universal Resolver **`0x85edf8b6b7d4211e2b07aa687506b746357b92cf`**. The legacy Universal Resolver proxy `0xeEeE…EeEe` still follows a mirror path and returns **null** for native children — product must **pin UR V2**. See GameLab ENG-0007 handoff.
2. **Deploy a `UserRegistry`** for customers (and one for staff) through the ENSv2 `VerifiableFactory` per the contract-developer tutorial; deploy a `PermissionedResolver` (UUPS proxy) via the same factory or use the parent's resolver initially.
3. **Point the parent at the subregistry**: `ETHRegistry.setSubregistry(tokenId(branchzero), customersRegistry)` — we hold `ROLE_SET_SUBREGISTRY` from registration. Same for `staff` as a subname whose subregistry is the staff registry.
4. **Registrar**: the tutorial's `SimpleRegistrar` pattern (availability, `register(label, owner, registry, resolver, roleBitmap, expiry)`). For the hackathon our Teller Desk holds the registrar key and mints on behalf of players (free, rate-limited per Privy user). The player becomes the **owner** of the ERC-1155 subname token.
5. **Roles at mint** (EAC role bitmap on the registry entry): customers get `ROLE_SET_RESOLVER | ROLE_SET_SUBREGISTRY`-class rights per tutorial defaults; staff names get none (bank keeps control; non-transferable).
6. **Resolver records**: `setAddr(node, 60, account)`, `setText(node, 'bz.tier', 'Silver')`. For Arc: `setAddr(node, coinType(5042002), arcAccount)` where coinType follows ENSIP-11 (`0x80000000 | chainId`).
7. **Delegate a record right to the Teller**: on the resolver, `authorize*Roles` so `teller.staff` wallet holds only the "set text record" role for key `bz.tier` (or the resolver's text-record role class if per-key granularity is not available — `VERIFY` against EAC docs on Day 6).

All addresses land in `infra/deployments/sepolia.json` (`ensParentNode`, `customersRegistry`, `staffRegistry`, `resolver`, `registrar`).

---

## 4. Runtime flows

### 4.1 Pay by name (Counter)

```ts
import { createPublicClient, http, normalize } from 'viem';
import { sepolia } from 'viem/chains';
import { getEnsAddress, getEnsName, getEnsText } from 'viem/actions';

const client = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const ENSV2_UNIVERSAL_RESOLVER = '0x85edf8b6b7d4211e2b07aa687506b746357b92cf' as const;
const to = await getEnsAddress(client, {
  name: normalize('bob.branchzero.eth'),
  universalResolverAddress: ENSV2_UNIVERSAL_RESOLVER,
});
// Pin UR V2 — viem default / legacy proxy 0xeEeE… returns null for native ENSv2 children under branchzero (ENG-0007).
// For Arc wing: getEnsAddress(client, { name, coinType: 0x80000000 | 5042002, universalResolverAddress: ENSV2_UNIVERSAL_RESOLVER })
```

If `to` is `null` the Teller says "No such customer." If the whitelist for `ERC20_TRANSFER_SELECTOR` is a list of *specific payees*, the bank additionally checks the resolved address is on it; otherwise the payment goes through the normal Lane A path.

### 4.2 Display names (receipts, ledger board, approved payees)

`getEnsName(client, { address })` (reverse). ENSv2's Universal Resolver forward-verifies during reverse resolution and reverts on mismatch, so a returned name is trustworthy.

### 4.3 Claim a name (Name Desk)

1. Player types a label; bridge normalises (`normalize`) and calls the registry's `isAvailable`/`getExpiry` view.
2. `POST /ens/claim { label }` → Teller Desk registrar mints to the player's owner wallet, sets `addr(60)` to the player's Sepolia account and `bz.tier=Silver`.
3. Passbook updates; the names board reads `LabelRegistered` events from the customers registry.

### 4.4 Delegated record edit (scripted demo moment)

At the Name Desk: "Petra, upgrade me to Gold." The **Teller wallet** (not the registrar) calls `setText(node, 'bz.tier', 'Gold')` — succeeds because of the delegated role. Then Petra offers "and change your address?" — the same wallet's `setAddr` reverts with `EACUnauthorizedAccountRoles`; the NPC explains. Two real transactions, one permitted, one denied, in 20 seconds of video.

### 4.5 Staff directory check (Manager's office)

Resolve `manager.staff.branchzero.eth` → compare to `RuntimeRBAC` authorised wallets for `BRANCH_MANAGER`. Board shows green/red.

---

## 5. Indexing (light)

No subgraph needed for the hackathon. The names board uses `getLogs` on the customers registry for `LabelRegistered` (last 50) and resolves labels; the Teller Desk caches results for 30 s. Event names per the ENSv2 indexing doc.

---

## 6. Judge-facing proof

- README § ENS: parent name, registry/resolver addresses (Sepolia explorer links), the exact features used (own subname registry, EAC delegation, wildcard/parent resolution, text records, non-transferable staff names), and code pointers: `infra/scripts/ens-setup.ts`, `apps/teller-desk/src/ens.ts`, `apps/web/src/bridge/ens.ts`.
- Video: mint `alice.branchzero.eth`, pay `bob.branchzero.eth` at the counter, the Teller's permitted vs denied record edit.
- "Ask why" lines in game name the ENSv2 features.

---

## 7. Risks

| Risk | Mitigation |
|------|-----------|
| Sepolia ENSv2 deployment repointed / beta churn (the repo README notes temporary URP repointing) | Pin addresses on Day 6 from the official `sepolia.md` table; keep an env override; test resolution daily |
| Commit/reveal wait for the parent name | Register Day 1 |
| EAC granularity per text key unavailable | Delegate the text-record role class; demo still shows permitted `setText` vs denied `setAddr` |
| viem API differences for ENSv2 coinType / universal resolver | Fall back to direct `PermissionedResolver` reads for the Arc address |
| Rate-limited public Sepolia RPC | Use a provider key; cache reverse lookups 30 s |
