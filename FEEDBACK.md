# Uniswap developer feedback — building the FX Desk in Branch Zero

Submitted for **ETHOnline 2026, Best Uniswap Stack Contribution**. Written 2026-09-08 by the Branch Zero team after
building an FX desk where a **governed smart account** — not a wallet — executes a Uniswap **v4** swap.

Form: <https://developers.uniswap.org/hackathon-feedback>

**What we built, in one line.** A walkable 3D bank whose FX desk lets the player's `AccountBlox` (an open-source
governed-account pattern) call the Universal Router, and *only* the Universal Router, because the account's own guard
list says so. Code pointers are in [`README.md`](./README.md#the-fx-desk--uniswap-v4-s1) and the design is
[`docs/UNISWAP.md`](./docs/UNISWAP.md).

**Our vantage point matters for reading this.** We are not a wallet or an aggregator. We integrate as a *contract
account* with a permission system, hand-encoding calldata with viem, deliberately avoiding the SDKs a dapp front-end
would reach for. Several notes below are about that seam.

---

## What worked well

**1. The v4 Quoter is the right shape for a "board".** `quoteExactInputSingle` as a `simulateContract` gives a price
with no signature, no allowance and no state, so our dealer NPC can post a rate to a player who has not signed in yet.
That an off-chain quote costs nothing made the whole "quote board, then accept" interaction possible; a design that
required an approval to see a price would have collapsed the desk into a single opaque button.

**2. Singleton + `PoolKey` is far friendlier to a contract account than v3 was.** There is no pool address to
discover, whitelist, or keep in sync. Our account's guard list needs exactly one address for swapping — the Universal
Router — no matter how many pools we later trade against. On v3 every new pool would have been another address the
account had to be reconfigured to trust. This is a genuine, concrete win for permissioned-treasury integrations, and
it is the reason our security story is short enough to say out loud in a demo.

**3. The action encoding is legible.** `abi.encode(actions, params[])` inside a single `V4_SWAP` command reads
cleanly, and the three-step `SWAP_EXACT_IN_SINGLE → SETTLE_ALL → TAKE_ALL` sequence maps almost word-for-word onto
what a teller would say out loud. We reproduced it in viem in about thirty lines with no library, which is the best
evidence we can offer that the format is well designed.

**4. `StateView` made the board honest.** Reading `getSlot0` / `getLiquidity` by pool id let us show tick and
liquidity beside the quote, so the panel says *why* a big order prices badly instead of just quoting a worse number.

**5. Deployments page.** One table, chain by chain, addresses copy-pasteable. We pinned Sepolia's from it directly
into `infra/deployments/sepolia.json`.

---

## What cost us time

**1. `docs.uniswap.org` 301s to `developers.uniswap.org`, and the deep links do not all survive.**
`/contracts/v4/deployments` and `/contracts/v4/quickstart/swap` both redirect; some deeper paths under the old
structure 404 rather than landing on their new home. Every hackathon kickoff doc, blog post and StackExchange answer
still points at the old host. A path-preserving redirect map, or a visible "this page moved" banner, would save a lot
of people a lot of guessing.

**2. Actions and Commands live in the source, not in the docs.** The swap guide shows `Actions.SWAP_EXACT_IN_SINGLE`
and `Commands.V4_SWAP` as Solidity identifiers, but a non-Solidity integrator needs the *numbers*. We ended up reading
`v4-periphery/src/libraries/Actions.sol` and `universal-router/contracts/libraries/Commands.sol` on GitHub to learn
that `V4_SWAP = 0x10`, `SWAP_EXACT_IN_SINGLE = 0x06`, `SETTLE_ALL = 0x0c`, `TAKE_ALL = 0x0f`. **Ask:** publish these as
a small constants table (or a JSON file) in the docs. It is the single highest-value page you could add for anyone
integrating from TypeScript, Go, Rust or a contract that is not Solidity.

**3. `ExactInputSingleParams` in the docs does not match the deployed struct.** The swap guide shows

```solidity
IV4Router.ExactInputSingleParams({ poolKey, zeroForOne, amountIn, amountOutMinimum, hookData })
```

while `v4-periphery` `main` has a `minHopPriceX36` field between `amountOutMinimum` and `hookData`. For anyone
hand-encoding, a struct that is one field out is a silent, mystifying revert — the ABI encoder is happy, the router is
not. **Ask:** version the code samples against a tag, and say which tag each deployment corresponds to. A struct
changing shape is fine; a struct changing shape invisibly is not.

**4. There is no non-Solidity quickstart.** Every swap example is a Solidity contract calling the router. The most
common real-world integration — a backend or a wallet building calldata off-chain — has to be reverse-engineered from
those. A twenty-line viem or ethers snippet that produces `execute(commands, inputs, deadline)` bytes would be the
single most useful addition to the v4 docs after the constants table above.

**5. Seeding a test pool is the hardest part of trying v4, and it is barely documented.** Our demo needed a pool that
did not exist, so we had to encode `MINT_POSITION → SETTLE_PAIR` through `PositionManager.modifyLiquidities`, work out
that full range means `±887220` at tick spacing 60, compute `sqrtPriceX96` ourselves, and discover that liquidity is
roughly `sqrt(x·y)` for a full-range position. The docs cover swapping well and pool creation thinly. **Ask:** a
"create and seed a test pool on Sepolia" page, or a script in a repo you point people at. Most hackathon teams will
hit this before they ever hit a swap, and some will give up there.

**6. Permit2 is a third concept in an already three-concept flow.** `token.approve(permit2)` then
`permit2.approve(token, router, amount, expiration)` then `router.execute(...)` is three transactions before a first
swap. For an EOA with a wallet this is one-time and invisible. For a *governed contract account* it means three
separate whitelisted functions across three separate contracts — it roughly tripled the on-chain configuration our
account needed, and it is the dominant cost of onboarding a user to our FX desk (measured: ~3.0 M gas to register the
three function schemas and whitelist their targets, ~2.1 M more to grant the roles, against ~1.3 M for the swap
itself). We are **not** asking you to drop Permit2 — the expiry-bounded allowance is genuinely better than an infinite
ERC-20 approval, and it is the reason our account can cap what the router may ever spend. But it is worth knowing
that for contract-account integrators the approval surface, not the swap, is the integration.

**7. Sepolia pool liquidity is thin, and quotes reflect it.** Our own seeded pool prices a 1-unit order at roughly a
30 % impact. That is our fault for seeding a small position, not yours, but a canonical, well-funded
`WETH/testUSDC` v4 pool on Sepolia that hackathon teams could just *use* would remove a whole class of
"is my encoding wrong or is the pool empty?" debugging. We spent real time distinguishing those two.

---

## Bugs / rough edges we did not expect

- `V4Quoter.quoteExactInputSingle` is **non-view** (it reverts to return data), so it must be `simulateContract` /
  `eth_call`, never `readContract`. The docs say "off-chain quotes" but the method's mutability trips the obvious
  code path first. A sentence in the reference page would fix it.
- The docs' `params[1] = abi.encode(key.currency0, amountIn)` for `SETTLE_ALL` is right, but neither the guide nor the
  reference states that the currency arguments are the *pool key's* currencies in pool order, not "input" and
  "output". With `zeroForOne` false those are swapped, and the failure mode is a confusing revert deep in the lock.

## What we would build next with more time

A **hook that reads the account's own guard list** — so the pool itself, not just our account, enforces that a swap
came from a governed treasury. That is a v4-specific product that could not exist on v3, and it is the direction we
would take this if the desk graduated past a hackathon.

---

## Honest limitations of our own submission

The swap is live on Sepolia as of 2026-09-08 —
[`0xd98efc64…`](https://sepolia.etherscan.io/tx/0xd98efc64e579758b04aa338b2ec777536839b7e48908000e6c6a0b93e8f686b3),
the account spending its own practice dollars through the Universal Router — so what follows is what the demo still
does *not* prove, rather than an apology for what it could not reach.

**One pool, one direction, one hop.** We trade USDC → WETH against a pool we created and seeded ourselves, and we
seeded it thinly on purpose so the board shows visible price impact. Nothing here exercises routing, multi-hop, or
liquidity we did not put there; our `ExactInputSingleParams` is hand-encoded for exactly this shape. If the desk ever
needed a second hop we would reach for `@uniswap/v4-sdk` rather than extend the hand-encoding.

**The account, not the wallet, is the integration.** Everything above is written from a contract account with a
permission system, which is a narrow vantage point. We never touched the front-end SDKs a dapp would use, so we
cannot say whether the seams we hit exist for a normal integrator too.

**The security story is one whitelist deep.** "The account can only talk to those three contracts with those three
selectors" is true and enforced on chain (K7-e is refused `TargetNotWhitelisted`), but the router's `execute` takes
an opaque `bytes[]`. The guard checks *which* contract and *which* function — not what commands are inside. A
Uniswap-aware guard would be a genuinely interesting thing to build and we did not build it.
