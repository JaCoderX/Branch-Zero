# Your Branch Zero account — how the technology works (Ask why)

This is the deeper explanation behind the bank words. Use it when the player asks why, how, or "what is really happening". Bank words first; these terms second. Nothing here is about any individual player — that comes only from the passbook snapshot.

## The account itself
- Your account is a Bloxchain smart account (the contract is called AccountBlox). It is one address on a public network that holds your practice money and carries its own rulebook.
- It is not a plain wallet. A plain wallet does whatever its one key says. Your account only does what its rulebook allows: who may ask, who may approve, which counterparties are allowed, and how long big movements must wait.
- Your account was created for you at Account Opening in a single step: the branch made a copy of a reference account (a factory called CopyBlox clones and initialises it in one transaction) and set you as the owner. The branch never holds your key.
- The rulebook cannot be edited by staff. Changing roles, approved payees or the cooling period requires the owner's signature — yours — and goes through the same request-and-approve procedure as any payment.
- The account accepts plain deposits (money sent to its address). Anything else must arrive through a registered service, or the account refuses it.

## Three protected roles (fixed at opening)
- Owner: you, the account holder. Your signature is what moves money. Held by the wallet Iris opened for you.
- Broadcaster: the teller's desk. It submits the slips you signed and pays the network fee. It cannot forge your signature, cannot start a payment alone and cannot approve anything alone.
- Recovery: the Security Officer at the side door. A separate key that can request an ownership transfer if you lose yours. That request is time-locked like everything else, so the real holder can see it coming and cancel it.
- These three roles are protected: staff cannot add themselves to them, and they cannot be removed.

## Runtime roles (added by the branch, with your signature)
- The account can also carry extra, non-protected roles created for a purpose. In this branch:
  - BRANCH_MANAGER — Mr. Walker. He can recall a pending wire and can submit your Priority release. He cannot start a payment and cannot release a wire after the clock on his own.
  - OBSERVER — a viewing wallet you name at the branch terminal. It can read your account on the public Console and hold no other power. Zero actions, read only.
- A role only ever has the exact actions the account's service list allows. There is no role inheritance; a role is a flat list of wallets and permitted actions.

## The slip: how a payment is authorised (meta-transaction)
- When you pay at the counter you sign an instruction, not a transaction. The instruction says: which service (for example "transfer practice dollars"), to whom, how much, on which network, with a deadline and a one-time number so it cannot be replayed.
- Signing is a typed-data signature (EIP-712) whose verifying contract is your own account address. A signature for one account is useless on another.
- The teller's desk (the broadcaster) takes the signed slip and submits it. The account checks the signature against the owner, checks the broadcaster is allowed to submit, checks the target is on the approved payee list, and only then moves the money.
- Because you signed once at Account Opening to allow a session signer, the routine slips are signed for you inside a secure enclave with no pop-up. That session signer is limited to slips for this one account on this network; it cannot sign anything else.
- Every slip has a nonce (a one-time number). The same slip cannot be submitted twice.

## Two lanes, one rulebook
- Over-the-counter (Lane A): request and approve in one step. The teller stamps it, the money moves, the record completes immediately. The counter limit is a branch policy, not a chain rule: above it, the teller sends you to the vault.
- Scheduled wire (Lane B): a time-locked request. The account records the wire as PENDING and stamps it with a release time equal to now plus the cooling period. It cannot be released by the timed path before that time — the chain refuses, not the clerk.
- Release (Bob's window): the owner's timed approval after the release time. Bob is the desk; the account checks the clock.
- Priority (Mr. Walker): a different approval path that is not time-checked. It needs the owner's own signature made in the browser behind a passkey (the hand scan); Walker only submits it. Without your signature there is no Priority.
- Recall (the shredder): cancel while PENDING. Owner or manager. Once cancelled, a wire cannot be revived.

## Wire record states (what the board reads)
- PENDING — requested, waiting. The board shows the cooling clock from the release time. READY is the board's word for PENDING with the release time passed; it is still a pending record until a release is stamped.
- COMPLETED — approved and executed. It leaves the departure board's pending list and joins today's movements.
- CANCELLED — recalled while pending.
- FAILED — approved, but the movement itself did not go through (for example the payee contract refused). The record stays as evidence.
- There is no separate "approved but waiting" state. Approval and execution happen in the same stamp.

## Approved payee list and service menu (the guards)
- Every service the account offers (transfer practice dollars, exchange currency, and so on) is registered as a schema: which function, which actions are possible, and who may do them.
- For each service the account keeps a whitelist of allowed counterparties. A payment to an address not on the list is refused by the account itself before any money moves. That is the approved payee list on the teller's wall.
- Adding a payee is a guard configuration batch — a slip you sign, the teller submits. The same mechanism opened the exchange door for the FX desk.
- Staff can neither widen the whitelist nor grant themselves actions without your signature.

## The cooling period (timelock)
- A single number set at Account Opening: the cooling period in seconds. In this branch it is short, so the demo is watchable; a real bank would set hours or days.
- It applies to every time-locked request on the account, including ownership recovery. Changing it requires your signature.
- The wall clock and the board read the release time from the chain record every time. There is no local timer anywhere in the building.

## Practice money and the wings
- The Main wing keeps practice dollars (dUSDC) on a public test network. Nothing here is real money.
- The FX desk is a second small account of the same kind, on the network where the exchange lives. It holds three registered services (approve, permit, and the exchange call) and one whitelisted counterparty for each. A swap is a treasury operation of your own account, not a wallet pop-up.
- The Arc wing is coming soon: another network where fees are quoted in dollars. The elevator will switch which account you are looking at.

## Your bank name and passbook tier (ENS)
- Your bank name (yourname.branchzero.eth) is an ENS subname. It points at your account address, so people can pay you by name.
- Your passbook tier (Silver, Gold) is a text record on that name. Staff have exactly the record rights the registry gives them: the teller may update your tier but cannot change which address your name points to. If they try, the registry refuses.

## What Blox-47 can and cannot see
- It sees a read-only snapshot: whether you have an account, your bank name and tier, your wing, your balance and counter limit, the cooling period, and the pending wires with their board word and clock.
- It cannot see transaction hashes, full addresses, keys, receipts, or anything behind the counter. If a player asks for those, name the desk or the receipt that shows them.
- It cannot act. Every verb that changes state belongs to a desk and needs the player's signature.

## Short answers for common "why" questions
- "Why can't the teller just do it?" — The teller only has the broadcaster role: submit and pay fees. Without your signature the account refuses.
- "Why does the vault make me wait?" — Big movements are time-locked so the real owner has time to notice and recall a wire they did not intend.
- "Can the manager release my wire early on his own?" — No. Priority needs your passkey signature; he only submits it.
- "Is my money real?" — No, practice dollars on a test network. The procedure is real; the value is not.
- "Where is my key?" — In a secure enclave you control, opened at Account Opening. The branch never holds it.
- "What if I lose my key?" — The Security Officer's recovery role can request an ownership transfer; it cools first, so the true owner can see it and cancel.
