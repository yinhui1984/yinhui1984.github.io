---
title: "When a Uniswap V3 Vault Prices Its Own Shares at the Edge of Its Range"
date: 2026-08-26T12:41:48+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
description: "How an Arrakis Finance G-UNI vault's mint/burn pricing broke once a flash-loan-sized swap pushed spot price past the position's own Uniswap V3 range, netting 2.94 ETH in one transaction."
---

A Gelato G-UNI vault on Arrakis Finance priced its own shares off a Uniswap V3 position's current-block valuation. Moderate price manipulation looked harmless — it wasn't, once the price crossed the position's own range boundary in one swap.

<!--more-->

# When a Uniswap V3 vault prices its own shares at the edge of its range

Chain: Ethereum mainnet. Attack tx: `0x6ae3af4b2f25a56594de99cfb31369150dd9ac059c49efe04b9e3e0163dbc672`, block `25817966`. Victim contract: `0x7c687f775A3b73BBAb0E15832F24caaB5D53bDDe`, an `EIP173Proxy` in front of `ArrakisVaultV1` at `0xd68b055fb444D136e3aC4df023f4C42334F06395`. It's a Gelato G-UNI vault, "Gelato Uniswap WETH/ENS LP", wrapping a single Uniswap V3 position on the WETH/ENS pool at `0xb9C4a5522a2f8bA9E2fF7063Df8C02ed443337A3` (1% fee tier). Net result: the attacker walked away with about 2.94135 ETH in one transaction, no prior capital, no privileged role.

I spent a while on this vault's `mint()`/`burn()` before I found the actual bug, and I got the wrong answer the first three times. That part is worth writing down too, because the reasoning that went wrong is the same reasoning most people would use to wave this off as safe.

## The vault in one paragraph

`ArrakisVaultV1` holds one Uniswap V3 position, defined by `lowerTick` and `upperTick` (here `32000` and `60000`). Anyone can call `mint(mintAmount, receiver)` to deposit `token0`/`token1` and get G-UNI shares back, and anyone can call `burn(burnAmount, receiver)` to redeem shares for the underlying. Both go through `getUnderlyingBalances()`, which calls `_getUnderlyingBalances(sqrtRatioX96, tick)`:

```solidity
(amount0Current, amount1Current) = LiquidityAmounts.getAmountsForLiquidity(
    sqrtRatioX96,
    lowerTick.getSqrtRatioAtTick(),
    upperTick.getSqrtRatioAtTick(),
    liquidity
);
```

`sqrtRatioX96` comes straight from `pool.slot0()` — the current spot price, read fresh on every call, no TWAP. That's the read a lot of people would flag immediately: current-block spot price feeding a pricing function, and no time lock between reading it and using it (`mint`/`burn` do both in the same call, so there isn't even a same-transaction reentrancy angle, it's one call doing one read and one write).

So I did what you'd normally do here: take a flash loan, swap enough of one token to push `slot0` somewhere unfavorable, call `mint()`, swap back, call `burn()`, see if the round trip nets a profit. I ran this at moderate swap sizes — a few percent of pool depth, then a somewhat larger one — and every time the numbers came back clean. `mint()` charges you proportionally to `getUnderlyingBalances()` at whatever price you just pushed it to, `burn()` pays out proportionally at whatever price you push it back to, and the two prices don't have to match for the round trip to be fair, because both sides are using the *same* function reading the *same* live state. Moving the price didn't create an edge. Spot-price manipulation on `getUnderlyingBalances()` looked like a dead end.

That conclusion is wrong, and the reason it's wrong is specific to what `getAmountsForLiquidity` does once the price actually leaves the position's range.

## What happens at the range boundary

`getAmountsForLiquidity` has three branches, keyed on where `sqrtRatioX96` sits relative to `sqrtRatioAX96` (lower bound) and `sqrtRatioBX96` (upper bound):

```solidity
if (sqrtRatioX96 <= sqrtRatioAX96) {
    amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
    amount1 = 0;
} else if (sqrtRatioX96 < sqrtRatioBX96) {
    amount0 = getAmount0ForLiquidity(sqrtRatioX96, sqrtRatioBX96, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioX96, liquidity);
} else {
    amount0 = 0;
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
}
```

Inside the range, the split between `amount0` and `amount1` moves continuously with price, which is what makes "moderate manipulation" harmless — you're just sliding along a curve both `mint` and `burn` agree on. But once price crosses either boundary, you land in the first or third branch, and notice what's missing from those two: `sqrtRatioX96` isn't in the formula at all. Below the lower bound, the reported value of the position is a function of `lowerTick`, `upperTick`, and `liquidity` only — it's pinned. Pushing price further down does nothing to that number. It's correct Uniswap V3 math, not a bug in the library; a position waiting below its range really does have a fixed value in terms of the token it'll receive when price comes back up.

What I hadn't tested was the actual attack shape: don't nudge the price, cross the *entire range* in one swap, using a flash loan sized to do it. Two things happen at once when you do that. First, the valuation function saturates into the pinned branch. Second — and this is the part that makes it not just "free repricing" — a swap that crosses the whole range also trades against the position's own liquidity for its entire width, which means it generates real, non-trivial fee income for that position. Uniswap V3 tracks this per-tick via `feeGrowthGlobal0X128`/`feeGrowthGlobal1X128`, and `_computeFeesEarned()` reads it back out. So the same transaction that pins the valuation also inflates the fee credit baked into that valuation, and the two effects land on the same `mint()`/`burn()` call.

## What actually happened

The attacker's contract (`0x028d9c17b1a097e7e115a6400203df86339baf4a`, deployed by the tx's initiator) did this:

1. Flash-borrowed 1800 WETH from Morpho.
2. Approved the vault for both WETH and ENS at `type(uint256).max`.
3. Swapped 150 WETH into the WETH/ENS pool, `zeroForOne = true`, with `sqrtPriceLimitX96` set to essentially the protocol minimum — no real limit. Tick went from `60333` to `-887272`, the floor of the entire Uniswap V3 tick space. The vault's range is `[32000, 60000]`; this swap didn't just nudge the price out of range, it blew straight through it.
4. Called `getMintAmounts()` then `mint()` on the vault with the WETH and ENS now sitting in the contract. Got 4486619135659964587643 shares (about 4486.6), pulling in 1253394683838271695411 WETH and 13159587645638410744793 ENS.
5. Swapped a small amount of ENS back to WETH, then immediately called `burn()` on all 4486.6 shares, receiving 1248407278620612918512 WETH and 13283298507313887894451 ENS back.
6. Swapped the remaining ENS back to WETH — tick recovered to around 59024, close to where it started.
7. Repaid the 1800 WETH flash loan, netted 2941350352900037140 wei of WETH, unwrapped it, kept the profit.

The mint/burn ratio in step 4 — roughly 10.5 ENS per WETH — has nothing to do with the real market price of ENS (the tick recovering to ~59024 by the end tells you that). It's the ratio `getMintAmounts()` produced while the position was sitting in the pinned, below-range branch, with a chunk of freshly-generated fee credit added on top.

## Rebuilding it independently

I didn't want to just replay the attacker's calldata — that only proves their transaction worked, not that the mechanism is really what I think it is. So I wrote a separate Foundry test from scratch: my own contract, my own swap call, my own choice of mint/burn parameters, forked at block `25817965` (one block before the attack):

```solidity
uint256 startingCapital = 1800 ether; // WETH
deal(WETH, address(this), startingCapital);

IERC20(WETH).approve(POOL, type(uint256).max);
uint256 crashAmount = 150 ether;
IUniswapV3Pool(POOL).swap(address(this), true, int256(crashAmount), MIN_SQRT_RATIO + 1, "");

// tick after crash: -887272, confirmed below lowerTick (32000)

uint256 wethForMint = IERC20(WETH).balanceOf(address(this));
uint256 ensForMint = IERC20(ENS).balanceOf(address(this));
(, , uint256 mintAmount) = IVault(VAULT).getMintAmounts(wethForMint, ensForMint);

IERC20(WETH).approve(VAULT, type(uint256).max);
IERC20(ENS).approve(VAULT, type(uint256).max);
IVault(VAULT).mint(mintAmount, address(this));
IVault(VAULT).burn(mintAmount, address(this));
```

Same capital size as the real attacker (1800 WETH), same crash size (150 WETH). Result: 2945124607296743704 wei net profit, i.e. 2.945124607296743704 WETH — against the real attack's 2.94135 ETH. That's under 0.13% off, which is close enough that I'm confident this is the same mechanism, not a coincidentally-similar one. I also reran the same logic with 200 WETH of starting capital instead of 1800, just to check the exploit wasn't somehow tuned to that exact number — still profitable, 0.1368 WETH, smaller crash and smaller position but the same shape.

## Where the first pass went wrong

Going back to why the naive flash-loan test missed this: I was testing "does moving the price create an edge," and at moderate magnitude the honest answer is no. The mechanism only shows up once you push price *past* the position's own boundary, and even then it's not just "price manipulation" doing the work — it's the saturation of the valuation formula plus the fee credit from actually trading through the full range, arriving together in the same call. A flash-loan probe that stops at "a large swap" instead of "a swap that crosses the entire configured range" will come back clean every time, right up until it doesn't.

The proxy sitting in front of the vault has its admin slot zeroed out (`proxyAdmin() == address(0)`), so there's no upgrade path to patch this after the fact — whatever the position's range and liquidity happen to be at any given block is the actual attack surface, indefinitely.
