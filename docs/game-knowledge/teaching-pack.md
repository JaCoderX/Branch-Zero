# Branch Zero — public teaching pack (iNPC)

## The bank in one breath
- Branch Zero is a small bank. Every step of its procedure is a real step of an on-chain account workflow. Nothing is a fake mini-game.
- Honest theatre: everything on the boards is read from the chain. If the chain says PENDING, the board says PENDING. Nobody keeps a local timer.
- Your account is a smart account owned by you (the account holder). The bank never holds your key.
- The money here is practice dollars (dUSDC on the Main wing). No real money moves in this branch.

## Two ways to pay
- Over-the-counter payment (Lane A): you fill a slip at the counter, the teller stamps it, and the payment goes out right away. It is capped at the counter limit shown in your passbook.
  Ask why: the slip is a signed meta-transaction; the teller's desk broadcasts it and pays the gas.
- Scheduled wire (Lane B): amounts above the counter limit go into the vault first and wait out a cooling period shown on the vault clock.
  Ask why: it is a time-locked request; it cannot be released before its release time.

## Wire status words
- PENDING: the wire is in the vault, still cooling. It is NOT ready.
- READY: the cooling period has passed; the Vault Keeper can release it. A wire is READY only when the snapshot says release_ready is true. Even then it stays a PENDING record until the release is stamped.
- DONE / COMPLETED: the movement has completed and the wire leaves the board.
- RECALLED / CANCELLED: the wire was cancelled while it was pending.

## Who does what (staff)
- Teller (Dev, Ama at the counters): takes your slip and stamps it. Ask why: the teller is the broadcaster — a courier who submits what you signed and pays gas; the teller cannot start or approve anything alone.
- Vault Keeper (Bob): releases a scheduled wire after the clock runs out. Not before.
- Branch Manager (Mr. Okafor): Priority (skip the cooling period with a hand scan — your own signature behind a passkey) or Recall (shred a pending wire).
- Account Clerk (Ines): opens accounts, and can load an account you already hold.
- Registrar (Petra): your bank name, e.g. yourname.branchzero.eth, and your passbook tier (Silver, Gold).
- Dealer (Kenji, FX desk): exchanges practice dollars for practice euros or shekels at the board rate.
- Security Officer (Sgt. Bale): recovery, at the side door.
- Greeter (Mo): points the way.

## Bank words and what they mean underneath (Ask why)
- Broadcaster: the teller's desk computer that submits your signed slip to the chain and pays the fee. It is a courier; it cannot move money without your signature.
- Approved payee list: the branch only pays counterparties on the wall list.
- Service menu: the services offered at a counter.
- Departure board: today's movements (pending and completed).
- Cooling period: the vault door countdown on a scheduled wire.
- Passbook: your account, name, tier and limits.
- Viewing wallet: a wallet you already hold that may read your account on the public Console and nothing else — set at the branch terminal.
- Wing: the Main wing runs on one network; the Arc wing (coming soon) on another; the elevator switches between them.

## What the iNPC is and is not
- The iNPC is a teaching companion. It explains; it never acts.
- It cannot pay, wire, release, approve, recall, open accounts, stamp slips, or change anything. Only staff at their desks do those, and only with your signature.
- It reads a snapshot of the player's passbook and vault board. It cannot see transaction hashes, account addresses, keys or anything behind the counter.
