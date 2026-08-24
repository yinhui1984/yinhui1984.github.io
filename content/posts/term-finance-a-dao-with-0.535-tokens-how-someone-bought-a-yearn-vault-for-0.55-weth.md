---
title: "Term Finance: A DAO With 0.535 Tokens: How Someone Bought a Yearn Vault for 0.55 WETH"
date: 2026-08-24T09:59:52+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack", "Term Finance"]
description: "How Term Finance's Yearn V3 vault holding ~2926 WETH was drained by capturing DAO governance with 0.535 tokens for 0.55 WETH and puppeting Zodiac Delay via Roles."
---

Ethereum mainnet, block `25816049`. A transaction (`0xd354a15b15cb73d30908f411aee3f795ec86737a4d080e9a818ac4d6d3014129`) walks through a proxy contract, calls a function called `executeProposal()`, and by the time it's done a wallet that started the day with nothing has `2841.743535791961701401` WETH sitting in it. The vault it came from — `0x26fCb50eEC367ddAB060ccf5E7394Cecd95F7Db2`, a real Yearn V3 vault with `totalAssets()` around 2926 WETH — didn't get hacked in the usual sense. Nobody found a reentrancy bug or a rounding error in a swap. Someone won a vote.

I want to walk through how that vote got won, because the contract that lets you win it is, read in isolation, completely unremarkable.

<!--more-->

## The proxy that looked like incident response

The contract in question is a proxy at `0x64E477800051EFb06Ae4086f4b258b270668b4dF`, logic at `0x3e30DDF30172F54C50cB490fF56E10f1a4737cF1`, both unverified on Etherscan. Decompiling the logic gives you something that reads like a one-shot governance executor: `initialize`, `propose`, `voteFor`, `executeProposal`, a permit-style deposit function at selector `0x0edade10`, and an unwind function at `0x5dd30406`. Every state-changing function is `onlyOwner`, and `owner` is set exactly once in `initialize()` and can never be transferred or renounced — `transferOwnership`/`renounceOwnership` are both wired to hit `OwnableUnauthorizedAccount` unconditionally. That's a deliberate design choice, not a decompiler artifact — checked the bytecode paths directly.

The obvious question with any `initialize()` that isn't gated by an owner check is whether it's front-runnable. I went and pulled the proxy's own creation transaction to check. `initialize()` isn't called separately at all — it's invoked atomically inside the constructor, standard `ERC1967Proxy(impl, initData)` pattern, so there's no window between deployment and initialization for anyone to race. Whoever deployed this proxy became its owner in the same transaction, full stop.

That deployer is EOA `0xa908b3472d76e7744bab0a5911768a4a6300612b` — no code, nothing flagged on Etherscan. And the `_data` blob baked into that constructor call decodes to plain JSON: a proposal titled *"Veto strategy vault parameter change,"* with a summary reading *"Vote YES to VETO the curator's proposed vault parameter change. Otherwise, the transaction will become executable when this proposal expires."* Paired with an exit-strategy contract deployed by the same EOA three blocks earlier (`0x184f2E57b4cE135181FA2A2166AC394339016338`, constructor args `(VAULT, WETH, recipient=same EOA)`, with the string `"Fixed Recipient WETH Exit Strategy"` sitting right there in the bytecode), the whole thing reads, on a first pass, like a defensive contract — someone spinning up emergency tooling to block a bad proposal from a curator multisig.

It isn't.

## Half a token controls the whole vault

The vault wraps its shares into governance through `GovernanceWrappedERC20` at `0x5b96c5bBdcB361E1E9944bAa071b237E27829Be0`, feeding an Aragon OSx `TokenVoting` plugin (`0x213771693A4411446b4ECce5bce4a405778b2171`) attached to a DAO contract at `0x0ae12AF3878a2d896f5C4DCE3Be7250FB187c0a6`. Standard stack, nothing custom. What isn't standard is what I found when I checked `totalSupply()` on the wrapped token:

```
VOTING_TOKEN.totalSupply() = 0.535216182805348484
```

Half a token. That's the entire voting base behind a governance layer with `execute()` rights over a vault holding thousands of WETH. `minParticipation` is 5%, `supportThreshold` is 50% — both computed against that 0.535-token supply, so they don't constrain anything meaningful. `minProposerVotingPower` is 0, so there's no floor on who can even open a proposal in the first place.

The `0x0edade10` deposit function is how you get into that voting layer: it takes an EIP-2612 permit for an arbitrary address, pulls that address's vault shares, wraps them into `VOTING_TOKEN`, and self-delegates. The parameter is arbitrary — nothing stops you from using someone else's valid permit signature if you had one — but checking the `Transfer` event for this specific deposit, the shares moved were `0.485216182805348480`, sent from `0xa908b3472d76e7744bab0a5911768a4a6300612b` to the proxy. Same address as the deployer. Self-funded, not stolen. That's 90.66% of the entire wrapped supply, bought with roughly 0.55 WETH — call it a couple thousand dollars at the time.

## Who actually owns the timelock

None of that matters much on its own if the DAO's `execute()` still routes through a real timelock. It does — there's a Zodiac `Delay` module at `0x35C99CF4a5DF2D9bCd822BeE32676D9590229e33` sitting behind a `Roles` module at `0xD9DdE54D99a27F0f0E2b282369BFaa95528e9B75`, guarding the main Safe at `0x46DA347d1Db6EdCA62BF6Cd5892Dc284fC938613`. `txCooldown` is 608400 seconds, `txExpiration` is 604800 seconds — close enough to real seven-day production timelock parameters, not a toy config.

Here's the part that actually breaks things: `DELAY.owner() == ROLES`. Not "Roles is registered as one of Delay's modules" — Roles is the admin of Delay, full owner-level control, including `enableModule()`. And role 1 on that Roles instance is granted to the DAO. So the chain isn't "DAO can act through Delay's normal module queue with its seven-day wait" — it's "DAO holds a role that lets it puppet Delay's owner functions directly, any time it can get one proposal through."

Reading the seventeen actions the proposal actually queues, in order:

- Action 0: `Delay.setTxCooldown(0)` — selector `0xebb2b4a2`
- Action 1: `Delay.setTxExpiration(0)` — selector `0x9b56d5be`
- Action 2: `ROLES.callTargetFunctionWithRole(DELAY, enableModule(DAO), role=1)` — the call lands on Delay's `enableModule`, selector `0x610b5925`, and succeeds because `msg.sender` for that call is `ROLES`, which is `Delay`'s owner

That third action is the whole trick. It doesn't rely on the DAO already being a registered module of Delay — it makes the DAO a module, live, inside the same transaction, by using Roles' owner-level access to call `enableModule` on its behalf. The moment that lands, the next fourteen actions run as `execTransactionFromModule`/`executeNextTx` pairs sourced directly from the DAO — no more Roles wrapper needed — draining the vault's four real strategies via `update_debt(strategy, 0, 10000)`, then registering the exit-strategy contract as a fifth strategy and pushing its debt cap to max. That last step is what finally calls the exit strategy's `deposit()`, which checks a gate — `txCooldown == 0 || txExpiration == 0 || DELAY.isModuleEnabled(DAO)` — that was only just satisfied, two actions earlier, by the same transaction that's now calling it. Then it moves everything it received straight out: `WETH.transferFrom(VAULT, this, amount)` immediately followed by `WETH.transfer(owner, amount)`. No redeem step, no second transaction. The vault's own event log calls this `AssetsForwarded`.

The timelock's seven-day cooldown never got a chance to matter, because the thing enforcing it got reassigned before it was asked to enforce anything.

## The clock, not the calendar

`propose()` landed at block `25772694`, timestamp `1786944335`. `voteFor()` followed at block `25772700`, timestamp `1786944407` — seventy-two seconds later, same sitting. I originally assumed `TokenVoting`'s early-execution mode meant the actual seven-day wait was avoidable once the outcome was mathematically locked in — it isn't. `votingMode()` returns `2`, and checking the enum declaration order in the actual source (`{Standard, EarlyExecution, VoteReplacement}`) rather than guessing, `2` is `VoteReplacement`. No early execution. `canExecute()` stays false until the real voting period runs out.

It ran out, and `executeProposal()` fired at block `25816049`, timestamp `1787466347`. From `propose()` to execution: `522012` seconds. `minDuration` on this plugin is `522000` seconds. Twelve seconds. Whoever or whatever triggered that final call did it twelve seconds after the earliest possible moment the contract would let them — not "came back a few days later," but watching a clock and pulling the trigger the instant it hit zero.

Worth noting, and I can't answer this from the trace: the vault's `role_manager` had an `EMERGENCY_MANAGER` bit that could call `shutdown_vault()` at any point during those six days. Nobody did. Whether that's because nobody was watching, or because the "voting YES vetoes a bad curator proposal" framing read as legitimate to whoever was, isn't something call data can settle.

## Rebuilding it with a fresh wallet

Reading the mechanism is one thing. Before calling it done, I wanted to check that someone starting from zero — their own wallet, their own contracts, no borrowed signatures or replayed calldata from the real incident — could actually walk the whole chain themselves. So I forked mainnet at block `25816048` and wrote an attacker from scratch:

```solidity
contract AttackerExitStrategy {
    address public immutable vaultAddr;
    address public immutable assetAddr;
    address public immutable recipientAddr;
    bool public used;

    function deposit(uint256 amount, address to) external returns (uint256) {
        require(msg.sender == vaultAddr, "onlyVault");
        require(to == vaultAddr, "invalid receiver");
        require(!used, "already used");
        used = true;
        IERC20Like(assetAddr).transferFrom(vaultAddr, address(this), amount);
        IERC20Like(assetAddr).transfer(recipientAddr, amount);
        return amount;
    }
}
```

Twenty lines, independently authored, no shared bytecode with the real exit strategy — just the same behavior the real one has, worked out from reading it. Paired it with a hand-written EIP-1967 proxy (matching the real deployment pattern, no OpenZeppelin dependency needed) pointed at the real, still-unmodified executor logic contract. Then:

```solidity
function _step1_fundAndDeposit() internal {
    capital = 1.5 ether;
    deal(WETH, attacker, capital);

    vm.startPrank(attacker);
    weth.approve(VAULT, capital);
    vaultShares = vault.deposit(capital, attacker);
    vm.stopPrank();
}
```

Ordinary retail capital — 1.5 WETH, not a flash loan — deposited through the vault's completely normal, public `deposit()`. Then a self-signed EIP-2612 permit (own key, `vm.sign`, nothing borrowed), fed into the real `0x0edade10` to wrap those shares into voting power. One thing worth calling out here: `TokenVoting`'s actual vote tally reads `getPastVotes(_, block.number - 1)` — a committed snapshot from the previous block, not a same-block spot balance — so there's no way to wrap voting power and vote on it inside one transaction. I rolled forward a block before calling `propose()`, which rules out a same-block flash-loan version of this attack; you need at least one block of exposure, though nothing close to a long lockup.

From there: `propose()`, `voteFor()`, `vm.warp` forward seven days to clear the real minimum voting duration, then `executeProposal()`.

```
Suite result: ok. 1 passed; 0 failed
```

Net extracted: `2844.158763636700960597` WETH, against `1.5` WETH of starting capital. Ran it twice, byte-identical both times, gas `7685430` on the nose. The number differs slightly from the real historical extraction — `2841.743535791961701401` WETH — because the clean-room run waits out a full fresh seven days from a fresh proposal, and the vault's own accounting drifts a little in that window. Same mechanism, same order of magnitude, independently arrived at.

One more thing the fork test caught that a surface read wouldn't have: two of the four real strategies don't fully zero out. Yearn V3's `_update_debt` only pulls what `strategy.maxRedeem()` reports as currently liquid — positions that haven't matured yet stay put no matter how hard you ask. In the real attack this left `84.47` WETH behind, 2.89% of `totalAssets()`, still sitting in strategies that presumably become drainable the same way once their underlying positions mature.

## Checking it against what actually happened

Comparing all of this against the real transaction, selector by selector: `tx.origin` matches, the call sequence into `executeProposal → canExecute → TokenVoting.execute → DAO.execute` matches, and the three self-bootstrap calls — `0xebb2b4a2` / `0x9b56d5be` / `0x610b5925` — land in the exact order worked out above. The event name really is `AssetsForwarded`. The extracted amount, `2841.743535791961701401` WETH, differs from the historical-replay estimate by eleven decimal places — rounding-level noise, not a different outcome.

One thing I had wrong: reading the strategy bytecode, I guessed the four drained strategies were Term Finance repoToken positions. The real trace shows standard Aave (`getReserveNormalizedIncome`, `scaledBalanceOf`) and Morpho (`MetaMorphoV1_1`) internals instead. Doesn't change anything about the mechanism — the vulnerability never depended on what the strategies did internally, only on how much of their balance was currently liquid — but it's a fair reminder that reading unverified bytecode gets you the *behavior* far more reliably than it gets you the *label*.

## Five more vaults, same transaction

There's a second transaction from the same window, `0x9f273f9a5a20c2fc957b06bbfa45db486390eede4a7f44fbe1a2eb6744c2e8a0` — 1550 calls, roughly four times the size of the one above. It runs the identical selector sequence (`0xebb2b4a2` / `0x9b56d5be` / `0x610b5925`) against five separate Delay/Roles/DAO stacks, one after another, inside a single transaction. Each of those five vaults shows `proposalId == 0` — meaning for every one of them, the vote that just captured their governance layer was the *first* vote that layer had ever seen. Denominated in USDC this time, the five together net `1,679,639.290442` USDC, all landing at `0x686457a7468B9B31c5dbA43b1b16077B48520691` — a different payout address than the WETH vault's `0xa908b3472d76e7744bab0a5911768a4a6300612b`. Whether the same person controls both is outside what calldata can tell you.

Six vaults, same configuration mistake, same twelve-second-precision timing discipline. Not an isolated incident against one contract — a template, applied wherever it had been deployed.

The number worth remembering isn't `2841.74` WETH. It's `0.535216182805348484` — the total supply of the token that decided who got to move it.
