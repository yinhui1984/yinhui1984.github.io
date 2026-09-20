---
title: "Whoever You Name Pays: A Missing Payer Check in BonfireSwap"
date: 2026-09-20T18:15:40+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
description: "BonfireSwap's transfer() took its payer from a function argument and then paid the caller's chosen beneficiary out of the Pancake pair's excess. One transaction drained 65 holders who had simply approved the wrapper once."
---

A BSC swap wrapper let the caller decide who pays. `BonfireSwap.transfer()` passes its first argument straight into `transferFrom`, so any holder with a standing `approve` can be spent by anyone. The same function then pays out the pool excess to a beneficiary the caller also chooses. One transaction, 65 holders, +66.080052 BNB to the attacker.

<!--more-->

# Whoever You Name Pays: A Missing Payer Check in BonfireSwap

Chain: BNB Smart Chain. Attack tx: `0xb4c00e8f3ba815b6c70f45026f8794d2c1f079646a89919077688ce60692193f`, and the state I read everything against is block `122003953`.

Three contracts matter. `Bonfire` at `0x5e90253fbae4Dab78aa351f4E6fed08A64AB5590` is a SafeMoon-style reflection token: every transfer skims 10%, split 5% to holders as reflection and 5% into the token contract's own liquidity pot. `BonfireSwap` at `0x17e801E17CeFC6334059189c178D4783830E03D3` is a swap wrapper that lets a user route a transfer through the token and into the Pancake pair at `0xD3F478F0d5E98b01f757bc6cB54Db4C00b9838f2` (token0 = BONFIRE, token1 = WBNB), with the price math outsourced to an upgradeable helper at `0xf33D46ecBB9fEdF80F8fEeBa8eb9d3c1053d3f91`.

Net result: the attacker contract at `0x28e976ea7b83553d6d1d45ce81334156a2632127` walked away with 66.080052 BNB, no privileged role and no capital of its own.

## The wrapper

`BonfireSwap` mostly exists so that a taxed token can be traded without the user hashing out fee-on-transfer details themselves. `transfer()` is the entry point that takes a user's tokens, pushes them into the pair, and then immediately tries to collect whatever the pair is holding on top of its cached reserves. Trimmed to the relevant lines:

```solidity
function transfer(address to, uint256 amountAIn, address beneficiary, uint256 deadline)
    public
    ensure(deadline)
    returns (uint256 amountAOut, uint256 amountBOut)
{
    _safeTransferFrom(tokenAddress, to, pancakePair, amountAIn);
    (amountAOut, amountBOut) = skimPools(beneficiary);
}
```

Read the first line of the body carefully. `_safeTransferFrom` is the usual low-level wrapper around `transferFrom`, and its `from` is `to` — the function's first argument. Nothing in `transfer` compares that argument to `msg.sender`. The function does not care who calls it, and it does not care whose address you hand it, as long as that address has approved the wrapper at some point.

```solidity
function _safeTransferFrom(address token, address from, address to, uint amount) internal {
    (bool success, bytes memory data) =
        token.call(abi.encodeWithSelector(TRANSFERFROM, from, to, amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))),
        'BonfireSwap: TRANSFERFROM_FAILED');
}
```

The second line of `transfer` is the payout. `skimPools(beneficiary)` loops over a registry of pools and, for each one holding more BONFIRE than its cached `reserve0`, calls `skimPool`, which pays the difference out:

```solidity
function skimPotential(address pool) public view returns (uint amountEstimation) {
    uint reserve;
    if (IUniswapV2Pair(pool).token0() == tokenAddress) {
        (reserve,,) = IUniswapV2Pair(pool).getReserves();
    } else {
        (,reserve,) = IUniswapV2Pair(pool).getReserves();
    }
    uint potential = IERC20(tokenAddress).balanceOf(pool) - reserve;
    amountEstimation = potential - (potential * totalTax / 100);
}

function skimPools(address beneficiary) public returns (uint amountAOut, uint amountBOut) {
    for (uint8 i=0; i<pools.length; i++) {
        if (skimPotential(pools[i]) >= minimumSkimAmount) {
            (uint a0, uint a1) = skimPool(pools[i], beneficiary);
            ...
        }
    }
}
```

`skimPool(pool, beneficiary)` is public, takes both the pool and the payout address as parameters, and checks neither. The `minimumSkimAmount` gate lives only on the multi-pool loop; the single-pool function anyone can call has no threshold at all.

## Where it breaks

Two missing checks, and each of them is enough on its own to move someone else's money.

The payer is an argument. A holder who ever used `BonfireSwap` normally would have approved it once, and that `approve` is the only thing standing between their balance and any caller. There is no path where the victim has to do anything wrong: no signature to trick them into, no function of theirs to call, no state of theirs to change. The allowance was created by their own ordinary use of the wrapper.

The beneficiary is also an argument. The pool excess that `skimPools` collects is real tokens sitting in the pair; the wrapper never asks whether the caller has any claim on them.

What ties the two together is that the payout leg runs in the same call as the pull leg. Push tokens into the pair and, in the same transaction, that push creates the excess that the next two lines are about to pay out.

## Why the excess appears instantly

The token taxes transfers, and the pair is not on the fee-exclusion list. So when the wrapper pulls `x` out of a victim and sends it to the pair, the pair receives `0.9x` while its cached `reserve0` stays where it was. That gap *is* `balanceOf(pair) - reserve0`.

There's a second contribution from the same transfer. The 5% reflection slice is redistributed to all holders, and the pair holds around 41% of supply, so the pair's balance also ticks up by its share of that slice. The excess ends up slightly bigger than `0.9x`, which is why `skimPools` fires for pull sizes a little below what the 1e15 threshold would suggest.

The payout itself is not pure subtraction. `skimPool` asks the upgradeable helper for the amounts:

```solidity
(amountAOut, amountBOut) = magic.computeSwapAmountsWithReflection(
    balanceA, balanceB, reserveA, reserveB, reflectionB,
    IERC20(pair.token1()).totalSupply(), pancakeSwapFeePermille);
```

and then settles it through a normal pair swap:

```solidity
gains = IERC20(pair.token0()).balanceOf(to);
pair.swap(amountBOut, amountAOut, to, new bytes(0));
gains = IERC20(pair.token0()).balanceOf(to) - gains;
require(gains >= minAmountOut, "BonfireSwap: MinOut not met.");
```

So the pair hands BONFIRE out to `to`, its own K check has to hold with the reflection rebate counted in, and the tokens that leave the pair are taxed like any other transfer — the beneficiary nets 90% of `amountBOut`.

## The transaction, end to end

The real transaction does one loop and nothing else:

1. `BonfireSwap.transfer(victim, x, attackerContract, block.timestamp)` for each address with a live allowance. The victim's tokens move to the pair, the excess appears, `skimPools` pays the attacker contract in BONFIRE.
2. Sell that BONFIRE back into the same pair for WBNB.
3. `WBNB.withdraw`, to end up in BNB.

65 distinct addresses paid in that single transaction. Nothing exotic in the flow: no flash loan in the call trace, no third protocol, no governance. The pair is both the injection target and the exit.

## Reproducing it

I rebuilt it against block `122003953` on a fork, starting from zero balance:

- A single pull of `5e21` raw BONFIRE — the token's `_maxTxAmount` — leaves the attacker contract holding `4220513422969450438759` BONFIRE after the payout's own 10% tax.
- Clearing the largest victim in one transaction (two pulls, because their balance is above the per-transfer cap) and selling gives `64484719618547273645` wei, or 64.48 WBNB. Gas: 770,110 against the block's 70,000,000 limit.
- Running every address that still had a balance — 78 of them — in a single transaction gives `66074167100212519084`, 66.07 WBNB, in 9,564,825 gas.

The real transaction came out at 66.080052 BNB; my fork run of the same chain lands 0.0089% below it, which is close enough that I stopped worrying about which one is "the" number.

Three constraints shaped the reproduction, and they're worth writing down because they're easy to miss:

- `_maxTxAmount` caps the pull leg *and* the payout leg, because both are ordinary token transfers and both go through the same `require(amount <= _maxTxAmount)`.
- Around a fifth of the victims have a finite allowance rather than an unlimited one, so the pull has to be `min(balance, allowance)`. Get that wrong and it reverts with `BonfireSwap: TRANSFERFROM_FAILED` — the wrapper swallows the inner reason and reports its own.
- The token's own `swapAndLiquify` can fire mid-transaction and refresh the pair's reserves, so anything you cached from `getReserves()` before a transfer is stale after it. The K check does not forgive that.

## The token helped, on its own schedule

Part of the loss didn't go to the attacker. The BONFIRE token contract holds its own accumulated tax pot, and once that pot crosses `numTokensSellToAddToLiquidity = 5e20`, the next transfer whose `from` isn't the pair makes the token sell half the pot for ETH and pair the rest with it:

```solidity
swapExactTokensForETHSupportingFeeOnTransferTokens(half, 0, path, address(this), deadline);
addLiquidityETH{value: address(this).balance - initialBalance}(tokenAddress, otherHalf, 0, 0, owner(), deadline);
```

Two things about those two lines. The swap passes `0` as the minimum output, so it has no slippage floor at all. And the LP is minted to `owner()`, which for this token is `address(0)` — the owner renounced, so that liquidity is unrecoverable by design.

In the real transaction the token contract lost 499,652,336,110.22 BONFIRE this way, and the V1 factory's `feeTo` picked up 0.219 LP. It's a side effect of the attack rather than its goal, but it's the kind of side effect that only shows up if you watch the token contract's balance, not just the attacker's.

The reflection accounting cuts the other way too, slightly. A victim's balance drops by a little less than the amount pulled, because they're a holder and the same transfer pays them their slice of the 5% reflection. The largest victim went from `5875946668764761448339` to a loss of `4999575521397973466852` for a nominal 5e21 pull.

## One thing that doesn't work

The obvious way to scale an extraction like this is a flash loan, and for this token it cannot work from the pair itself. The borrow leg is taxed and so is the repayment leg. Borrow `B` and you receive `0.9B`; the pair wants at least `1.002B` back, which means transferring `B * 1.002 / 0.9`, or about 11.3% more than you borrowed — while you only ever received 90% of it. You need roughly 21% of the loan in hand before you start, which is not a flash loan anymore.

There's a second obstacle if you try anyway: mid-callback the pair's real balance sits below its cached reserve, and anything that prices off `balanceOf - reserve` during that window underflows before it can revert cleanly.

## The fix

Two checks, one on each entry point:

```solidity
// transfer / simpleTransfer / loggedTransfer / simpleLoggedTransfer
require(to == msg.sender, "BonfireSwap: SENDER_MISMATCH");

// skimPool / skimPools
require(beneficiary == msg.sender, "BonfireSwap: BENEFICIARY_NOT_CALLER");
```

The first makes the payer come from `msg.sender` instead of an argument. The second keeps the payout from being redirected: inside the contract, the auto-skim still pays whatever beneficiary the paying user asked for, because that path doesn't go through the public entry point.

I checked both on the fork — the chain above stops moving anything, and a user spending their own tokens through the same function still works.

The shape to remember is the one at the top: `transferFrom(token, to, pair, amount)` where `to` came in as a parameter. When an allowance is involved, the address that spends it and the address that authorised it have to be the same one, and that has to be enforced rather than assumed.
