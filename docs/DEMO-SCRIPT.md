# Demo Script and Submission Checklist

> Judges watch ~3 minutes. They must see: one wallet pop-up, then a bank that moves real testnet money without another one; a vault clock that is a real timelock; a name desk that is real ENSv2; an elevator that is a real chain switch.

Related: [PLAN.md](./PLAN.md) § 8 (definition of done) · [GAME-DESIGN.md](./GAME-DESIGN.md) § 5 (journeys)

---

## 1. Video storyboard (target 3:00, hard max per ETHGlobal rules — `VERIFY` limit on the event page)

| Time | Shot | Voice-over (everyday bank language) | On screen proves |
|------|------|----------------------------|------------------|
| 0:00–0:15 | Exterior → doors open; title card "Branch Zero — a bank you can walk through" | "Most crypto apps hide their security behind a wallet pop-up. We built a bank where the security is the building." | tone, Godot 3D |
| 0:15–0:40 | Account Opening desk. Clerk dialogue. **The one Privy modal**: email login + "let the branch sign for you" consent. Passbook prints with owner address and `alice.branchzero.eth` | "You open an account once. Privy holds your key; the bank gets a limited signer with a policy — it can only stamp slips for your own account." | Privy embedded wallet, session signer, policy; AccountBlox deployed (Etherscan link overlay) |
| 0:40–1:10 | Teller counter. "Pay 25 USDC to bob.branchzero.eth". Stamp animation; receipt prints with tx hash | "Routine payments to approved payees clear at the counter. No pop-up: the slip is signed in the back office and the teller broadcasts it." | Lane A meta-tx `requestAndApproveExecution`; ENS resolve; Etherscan overlay showing `from = broadcaster`, account emits transfer |
| 1:10–1:50 | Wire desk → Vault antechamber. "Wire 5,000 USDC to a new payee". Clock starts (real `releaseTime`). Cut to Manager's office: pending board; Manager approves after release / or cancels a suspicious one | "Large or unusual transfers go to the vault. The clock is not an animation — it's a timelock on the account. Before it releases, the manager can still cancel." | Lane B `executeWithTimeLock` → `approveTimeLockExecution` / `cancelTimeLockExecution`; `getPendingTransactions` |
| 1:50–2:15 | Name Desk. Registrar checks availability, mints `carol.branchzero.eth`, sets `tier` text record; staff-only records demonstrated | "Names are accounts here. Your bank name resolves to your account; your passbook fields are ENS records; who may edit them is ENSv2 access control." | ENSv2 Sepolia: subname mint, `setText`, EAC roles |
| 2:15–2:40 | Elevator → Arc wing (palette change). Same teller flow; receipt shows fee in USDC, instant finality | "Second floor: same account, different rails. On Arc the fee is in dollars and settlement is sub-second — so the vault clock is clearly policy, not network lag." | Arc Testnet chain id `5042002`, Arcscan overlay |
| 2:40–3:00 | Architecture diagram; sponsor strip; repo URL; "built with the public `@bloxchain/sdk`" | "Godot in front, Bloxchain-governed accounts underneath, Privy, ENS and Arc as the desks. Everything you saw is on public testnets. Come open an account." | submission requirements |

Production notes:
- Record at 1920×1080 60 fps from the **web build** (not the editor); OBS with game + browser overlay.
- Pre-warm: tab open, logged out, accounts for `bob`/`carol` pre-provisioned, faucets full, broadcaster gas ≥ 0.1 ETH / 10 USDC.
- Use a **120 s** timelock for the wire so the approval happens within the recording (cut the wait).
- Explorer overlays as picture-in-picture, 2 s each — judges need the hash, not the whole page.
- Voice-over recorded separately; subtitles burned in.
- Backup: full run recorded on Day 9 in case Day 10 testnets misbehave.

---

## 2. Live demo fallback

If the judge review is live (rare for ETHOnline) or the link is opened: `MockChain` toggle (`?mock=1`) shows the game with canned data and a banner "offline mode — chain unavailable". Never silently fake chain state without the banner.

---

## 3. Submission checklist (ETHGlobal + sponsors)

**ETHGlobal (all `VERIFY` against the event page on Sep 14)**
- [ ] Project created on ethglobal.com, track **Start Fresh**, team members added
- [ ] Short description (≤ 280 chars) and long description (problem → how → what's next)
- [ ] How it's made (tech stack, hacky bits, sponsor tech) — copy from [ARCHITECTURE.md](./ARCHITECTURE.md) § 1 and § 11
- [ ] Demo video ≤ limit, public URL (YouTube unlisted OK)
- [ ] Public GitHub repo; README at root with run instructions and deployed addresses
- [ ] Live link (web build)
- [ ] **AI tool disclosure** filled (Cursor + models used, what they did)
- [ ] Prize selections: Privy, ENS, Arc (+ Uniswap only if S1 shipped)
- [ ] Repo shows meaningful commit history over the event dates (Start Fresh)

**Privy — Best B2B financial product**
- [ ] README § Privy: which wallet type, signer, policy; link to `infra/privy/policy.json`
- [ ] Video shows delegation + a no-pop-up business workflow

**ENS — Best Use of ENSv2**
- [ ] Sepolia ENSv2 addresses used listed in README
- [ ] Video shows live mint/resolve/record write (no hard-coded values)
- [ ] `branchzero.eth` (or the test parent) name given in README

**Arc — Best DeFi / Onchain Finance (+ Launch, if entered)**
- [ ] Architecture diagram PNG in repo and in the submission
- [ ] Which bounty stated explicitly in README and submission
- [ ] Arc Testnet addresses + Arcscan tx links
- [ ] Documentation folder (`docs/`) linked
- [ ] Launch only: mainnet-readiness statement + config for chain `5042`

**Repo hygiene**
- [ ] No secrets (gitleaks pass), `.env.example` present
- [ ] LICENSE (MIT) — check `@bloxchain/*` licences and attribute
- [ ] `docs/README.md` index up to date; `VERIFY` markers resolved or moved to "Known gaps"

---

## 4. Written pitch (paste-ready draft, refine Day 10)

**Branch Zero** is a walkable 3D bank built in Godot where every counter is a real operation on a Bloxchain-governed smart account. You open an account once (Privy embedded wallet + a policy-bound session signer) and never see a wallet pop-up again: tellers broadcast your signed slips, the vault clock is an on-chain timelock, the manager's approval is a role-gated on-chain call, and your bank name is an ENSv2 subname whose records are your passbook. The Arc wing runs the same account on Arc Testnet with USDC-denominated fees. It teaches non-crypto users what account security *feels* like — and it is a working B2B treasury workflow underneath.
