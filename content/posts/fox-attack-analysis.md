---
title: "Fox (FoxLpBondsPool) Attack Analysis: A $482M 'Create Your Own Market Then Harvest' Exploit"
date: 2026-08-17T22:11:36+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
---

Chain: BSC (56)  
Attack Tx: `0x8e1775cbfd44db29744cc6687ff1822d2c47321de6e94062f789ad6181ad5514`  
Block: `116169049`  
Victim Contracts: `FoxLpBondsPool` Proxy `0x9fa6D8a13b35E051BFc145918db0111dEc13D1A0` (Implementation `0x58E2A853BB14e46BefD3148bd4280370fEA4655A`), `Treasury` Proxy `0x361d08ff43761E6a7E8Fcabe48048AE9010801cc` (Implementation `0x87614d97808dcdecb069fe8489848fa1c001e04d`)

Fox is a staking protocol that had been running on BSC for some time, and `FoxLpBondsPool` is one of its "LP Bond" entrypoints: users deposit USDT, the protocol converts half of it into FOX, pairs it with the other half of USDT into PancakeSwap's FOX/USDT pool to get LP tokens, and then records your deposit under a bond-like model—principal is released linearly according to lockup days, plus there's an "inviter reward". This incident stemmed from this accounting step, where someone extracted roughly 677.5k USDT in instant profit in a single transaction, plus a massive minting certificate with a paper value close to $500 million that releases slowly over 540 days.

<!--more-->

## First, let's see what `stake()` is doing

```solidity
function stake(uint256 _usdtAmount, uint256 _swapPrice) external {
    require(_usdtAmount >= MIN_AMOUNT, "usdtAmount invalid");
    address inviterAddress = IReferral(referralAddress).referralMap(msg.sender);
    require(inviterAddress != address(0), "no referral");

    IERC20(usdtToken).safeTransferFrom(msg.sender, address(this), _usdtAmount);
    _usdtAmount = IERC20(usdtToken).balanceOf(address(this));

    uint256 startTime = block.timestamp / TIME_BASE * TIME_BASE;

    (uint256 swapPrice, ) = getSwapPrice(startTime);
    if(swapPrice > _swapPrice){
        require((swapPrice - _swapPrice) * BASE_100 / _swapPrice <= 100, "swapPrice invalid");
    }

    uint256 stakeAmount = _usdtAmount * 1e18 / swapPrice;

    ISwapRouter(swapRouter).swapExactTokensForTokens(_usdtAmount / 2, 0, usdtToFoxPath, address(this), block.timestamp);

    uint256 usdtBalance = IERC20(usdtToken).balanceOf(address(this));
    uint256 foxBalance = IERC20(foxToken).balanceOf(address(this));
    (, , uint256 liquidity) = ISwapRouter(swapRouter).addLiquidity(usdtToken, foxToken, usdtBalance, foxBalance, 0, 0, address(this), block.timestamp);
    ...
    uint256 inviterRewardAmount = 0;
    if(stakeDays >= 180 && _usdtAmount >= INVITER_REWARD_MIN_AMOUNT){
        inviterRewardAmount = stakeAmount * INVITER_REWARD_RATIO / BASE_100;
    }

    ITreasury(treasury).lpBonds(liquidity, stakeAmount, stakeDays, inviterAddress, inviterRewardAmount);
    ...
}
```

`getSwapPrice()` reads PancakeSwap V2's `getAmountsOut(1e18, [FOX, USDT])`, which is the current spot price of this FOX/USDT pool:

```solidity
function getSwapPrice(uint256 _timestamp) public view returns (uint256, uint256){
    ...
    uint256[] memory amountsOut = ISwapRouter(swapRouter).getAmountsOut(1e18, foxToUsdtPath);
    uint256 swapPrice = amountsOut[1];
    if(discountRateTo > 0){
        swapPrice = swapPrice * (BASE_100 - getDiscountRate(_timestamp)) / BASE_100;
    }
    return (swapPrice, amountsOut[1]);
}
```

What's worth noting here is that the pair `stake()` uses to read the price and the one it immediately turns around to trade on via `swapExactTokensForTokens` + `addLiquidity` is the **exact same pool** (the state variable `lpFoxToken`, verified in practice, equals PancakeSwap's FOX/USDT pair address). And the calculation `stakeAmount = _usdtAmount * 1e18 / swapPrice` happens **before** the internal swap—so looking at this step alone, `stakeAmount` is actually computed using an unpolluted, honest price, not a fake number fed in after prior external manipulation.

The real vulnerability isn't here; it's what comes next.

## Selling received rewards into a pool freshly crushed by yourself

Inside `stake()`, there is a step that takes `_usdtAmount / 2` to swap for FOX, and then pairs it with the other half of USDT to `addLiquidity`. Under normal staking volume, this step has virtually no impact—a user depositing a few thousand USDT causes negligible slippage in a pool with millions in depth. But **nowhere in the code does it check whether `_usdtAmount` is reasonable relative to this pool's depth**; `MIN_AMOUNT` only enforces a lower bound (100 USDT), with no upper bound whatsoever.

The larger `_usdtAmount` is, the greater the impact that `_usdtAmount / 2` internal swap has on the pool. Meanwhile, the "inviter reward" in `Treasury.lpBonds()` is minted and transferred to the inviter only **after** this internal swap:

```solidity
function lpBonds(uint256 _lpFoxAmount,uint256 _stakeAmount, uint256 _stakeDays, address inviterAddress,uint256 inviterRewardAmount) external onlyStakingPool{
    IERC20(lpFoxToken).safeTransferFrom(msg.sender, DEAD, _lpFoxAmount);
    IMintableERC20(foxToken).mint(address(this), _stakeAmount + inviterRewardAmount);
    IMintableERC20(stakedFoxToken).mint(msg.sender, _stakeAmount);
    if(_stakeDays >= 180){
        IMintableERC20(rewardFoxToken).mint(foxDistributor, _stakeAmount * REWARD_RATIO / BASE_100);
    }
    if(inviterRewardAmount > 0){
        IERC20(foxToken).safeTransfer(inviterAddress, inviterRewardAmount);
    }
}
```

`onlyStakingPool` only checks whether the caller is a whitelisted pool contract, not whether the passed numbers make sense—`_stakeAmount`, `inviterRewardAmount`, etc., are all accepted as-is by `Treasury` and directly minted.

Putting it all together: `inviterRewardAmount` itself is 3% of `stakeAmount` calculated at the honest price, so this FOX quantity wasn't "inflated". But if `_usdtAmount` is large enough to **smash through the pool's FOX reserves within the same transaction**, then once this 3% reward is received, selling it back into a pool that has almost no FOX reserves left will yield USDT far exceeding "3% fair value"—because FOX is now extremely scarce relative to USDT, so even a small amount of FOX can trade out a massive chunk of USDT.

In other words: the **quantity** of the reward was not manipulated, but the **market at the moment the reward was cashed out** was engineered by the attacker within that exact same transaction.

As a side note, that slippage check in `stake()`:

```solidity
if(swapPrice > _swapPrice){
    require((swapPrice - _swapPrice) * BASE_100 / _swapPrice <= 100, "swapPrice invalid");
}
```

only takes effect when "the read price is higher than the caller-supplied `_swapPrice`"—this was designed from a staker's perspective to prevent front-running from worsening execution price; it doesn't care at all how much lower the price is than expected. In this attack, the attacker passed `type(uint256).max` as `_swapPrice`, directly making this `if` evaluate to `false`. To be clear though: because price reading occurs **before** any manipulation, even replacing this with a bidirectional check wouldn't have stopped this attack—the check that was actually missing is "whether `_usdtAmount` is absurd relative to pool depth", not "whether the price was read crooked".

## Attack flow (by execution order in trace)

The capital came from an aggregated flash loan spanning 20+ lending markets/pools (Venus's `VBep20Delegator`, several PancakeSwap V3 pools, a Vault, a `PoolManager`, multiple PancakeSwap V2 pairs), pulling together 481,974,785.536796421654333021 USDT, transferred into the attack contract `0x7DA2AF76394B7c00aE46001E6139a316554cFEE4`.

This sum was fed directly into `stake()`:

```text
TransparentUpgradeableProxy_d1a0.stake(
  481974785536796421654333021,   // ≈ 481,974,785.54 USDT
  115792089237316195423570985008687907853269984665640564039457584007913129639935  // type(uint256).max
)
```

Once inside `stake()`:

1. `getReserves()` reads the pool state right before the attack: 2,786,697.20 USDT / 496,041.72 FOX.
2. At this price (about 5.436 USDT/FOX after discount), it computes `stakeAmount = 88,659,280.81 FOX`—this is the "bond" principal the attacker receives this time, released linearly over 540 days, not cashed out in this transaction.
3. Internal swap converts half the USDT (240,987,392.77) into FOX, and the pool's FOX reserve gets hammered from 496,041.72 down to 5,684.54 by this single massive swap, draining 98.85%.
4. The remaining USDT and the freshly swapped small amount of FOX are paired via `addLiquidity`, and the minted LP is immediately transferred by `Treasury.lpBonds` to the blackhole address to be burned—this is a fixed design of the protocol; LP is never kept in anyone's hands.
5. `Treasury.lpBonds` mints 88,659,280.81 real `StakedFox` to the staking pool based on `stakeAmount`, 9,752,520.89 `RewardFox` (11%) to the distributor address, and transfers the 2,659,778.42 FOX inviter reward directly to inviter address `0xAE37BDc9a94C24b3527348a889d9A6b738228c3c`.
6. When this inviter FOX is transferred to the PancakeSwap pool, Fox token's own 2.5% sell tax first skims off 66,494.46 tokens (transferred to an address named `SafeProxy`; the `_update` logic in Fox's contract separately taxes transfers into the pool address, which this transfer happened to hit), leaving a net 2,593,283.96 FOX actually sold into the pool.
7. This step is the harvest: the FOX in the pool was already battered down to just 5,684.54 tokens in step 3, so selling 2,593,283.96 FOX in at this point pulls out 482,652,334.59 USDT.

## Results

In and out: put in 481,974,785.54 USDT, sold FOX to get back 482,652,334.59 USDT, netting roughly 677,549 USDT in instant profit within the same transaction (not yet counting the aggregate flash loan interest costs, though that's minor relative to this scale). The flash loan principal was returned immediately afterward, visible in the subsequent repayment calls in the on-chain trace.

On top of this immediate cash in hand, the attacker still holds a staking principal certificate of 88,659,280.81 FOX—this is the even bigger hole in this incident: this FOX was minted out of thin air, backed not by equivalent assets deposited by the attacker (that part was already drained in steps 6/7 within the same transaction), but by `Treasury`'s unconditional `mint`. By protocol design, this principal takes 540 days to linearly release completely, but as long as `redeem()` can still be called normally, it will eventually turn into real, transferable FOX, diluting the pool and token holders.

## Summary

The common denominator of this type of issue is: the scale of an action a function executes on its own (here, adding liquidity to a pool) is decided entirely by caller-supplied parameters, with zero correlation checks against the depth of the market it actually interacts with (here, that AMM pool). As long as a caller can gather sufficient capital in one shot (in this case, by aggregating flash loans across a dozen+ lending markets), they can force the protocol itself to execute an operation large enough to smash through the market, and then within the same transaction, monetize that impact using a downstream payout whose **quantity was originally normal** but whose **timing of realization lands right on top of the distorted market they engineered**.

Looking at the minting formula alone or the reward ratio alone, neither snippet of code is outrageous by itself; what actually broke is that between "how much money the user deposits" and "how deep the market is that this money will operate on", there was no upper bound constraint whatsoever.
