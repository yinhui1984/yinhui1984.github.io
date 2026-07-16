---
title: "ERC-4626 tokenized yield-bearing vaults"
date: 2026-07-16T09:46:34+08:00
draft: false
author: yinhui
categories: ["web3"]
tags: ["web3.0", "EIP", "ERC", "ERC-4626"]
---

about ERC-4626 tokenized yield-bearing vaults

<!--more-->

## 标准文档

https://eips.ethereum.org/EIPS/eip-4626

https://ethereum.org/developers/docs/standards/tokens/erc-4626/

### 解决的问题

在 DeFi 世界里，有很多"生息金库"。比如你把 USDC 存进 Aave，Aave 把它借出去赚利息；你存进 Yearn，Yearn 用复杂的策略在多个协议间搬砖赚收益。

问题是：每个协议的接口都不一样。Aave 叫 `supply()`，Yearn 叫 `deposit()`，另一个协议可能叫 `stake()`。你想做一个聚合器（比如自动把钱存到收益最高的地方），你就得给每个协议写一套适配代码。这就像"每个牌子的手机都有自己的充电口，要随身带一堆转接头"。 ERC-4626 就是给所有收益型金库定义了一个统一的充电口（接口标准）。

核心类比：银行存款,就像你把黄金存进银行保险库，银行给你一张存单。以后你拿存单回来，就能把黄金取出来（可能更多，因为金库帮你赚了利息）。

所以就有两个核心概念：

- `asset` = 底层资产（USDC、ETH 等）
- `share` = 金库份额代币（你的"存单"）

> *关键：1 share 能换多少 asset* 不是固定的。金库赚了钱就涨，亏了钱就跌（坏账、被黑、slashing、无常损失等）。

```solidity
// 返回底层代币地址
function asset() public view returns (address)

// 返回金库管理多少底层资产（含复利、费用）
function totalAssets() public view returns (uint256)
```



### 2种存钱方式

#### 方式1：按底层资产算（deposit）

"我有 100 USDC，全存进去，能拿多少 share 算多少。"

```solidity
// assets:   你要存入多少底层代币（精确值，比如 100 USDC = 100_000000）
// receiver: 谁收到 share 代币（可以和 msg.sender 不同，你可以帮别人存）
// returns:  实际铸造了多少 share 给 receiver（因取整，可能略少于理论值）
function deposit(uint256 assets, address receiver) public returns (uint256 shares)

// OpenZeppelin 扩展版（非标准），多了 bytes 参数用于 hook 回调：
// data 透传给 beforeDeposit / afterDeposit 钩子，金库可 override 做自定义逻辑
function deposit(uint256 assets, address receiver, bytes calldata data) public returns (uint256 shares)
```

调用 deposit 前需要先 `approve` 金库合约使用你的 USDC。

**前置检查函数：**

```solidity
// "金库最多还能收多少 asset？"
// receiver:  谁将收到 share
// returns:   当前 deposit 能存的最大 asset 量。
//            type(uint256).max = 无上限，0 = 暂停/已满。
//            永不 revert。
//  假设用户有无限余额——不看用户钱包里实际有多少 token。
//    前端应自行计算 min(maxDeposit, userBalance)。
function maxDeposit(address receiver) public view returns (uint256 maxAssets)

// "如果我现在 deposit(X)，能拿到多少 share？"
// assets:  你想存多少 asset
// returns: 当前区块下你能拿到的 share 数。
//          包含存款手续费，但不考虑限额（maxDeposit 的返回值）。
//          实际 deposit 返回的 share ≥ preview 的值（用户至少拿到这么多）。
function previewDeposit(uint256 assets) public view returns (uint256 shares)
```

#### 方式2：按 Share 算（mint）

"我就要 50 个 share，需要扣多少 USDC 你看着办。"

```solidity
// shares:   你要铸造多少 share（精确值）
// receiver: 谁收到这些 share
// returns:  实际从你账户转走了多少 asset（因取整，可能略多于理论值）
function mint(uint256 shares, address receiver) public returns (uint256 assets)
```

调用 mint 前同样需要先 `approve` 金库合约使用你的 USDC（无论 deposit 还是 mint，金库都需要从你账户转走 asset）。

**前置检查函数：**

```solidity
// "金库最多还能 mint 多少 share？"
// receiver: 谁将收到 share
// returns:  当前能 mint 的最大 share 数。
//           type(uint256).max = 无上限，0 = 暂停。
// 同样假设用户有无限余额，不看钱包实际余额。
function maxMint(address receiver) public view returns (uint256 maxShares)

// "如果我现在 mint(X share)，需要付多少 asset？"
// shares:  你想铸造多少 share
// returns: 你需要付多少 asset。
//          包含手续费，但不考虑限额。
//          实际 mint 扣的 asset ≤ preview 的值（用户最多付这么多）。
function previewMint(uint256 shares) public view returns (uint256 assets)
```



#### deposit vs mint

|                      | deposit                     | mint                          |
| -------------------- | --------------------------- | ----------------------------- |
| 你指定的量（精确）   | asset 数量                  | share 数量                    |
| 金库返回的量（估算） | share 数量                  | asset 数量                    |
| 实际 vs preview      | 实际 share ≥ preview        | 实际 asset ≤ preview          |
| 需要 approve？       | 是                          | 是                            |
| 前置查询             | maxDeposit + previewDeposit | maxMint + previewMint         |
| 类比                 | "1000 人民币换多少美元？"   | "我要 200 美元，多少人民币？" |



### 2种取钱方式

#### 方式1：按底层资产算（withdraw）

"我要取 100 USDC，烧多少 share 你算。"

```solidity
// assets:   你要取多少底层代币（精确值）
// receiver: 谁收到 asset（可以和 owner 不同）
// owner:    share 从谁的账户里烧（owner 得有足够的 share，或 msg.sender 有 owner 的 approve）
// returns:  实际烧了多少 share（因取整，可能略多于理论值）
function withdraw(uint256 assets, address receiver, address owner) public returns (uint256 shares)
```

如果 `owner != msg.sender`，需要先 `approve` 金库合约使用 owner 的 share。

**前置检查函数：**

```solidity
// "owner 最多能取出多少 asset？"
// owner:   谁的 share 要被烧
// returns: 当前能取的最大 asset 量。≤ 实际能取的最大值（宁可低估）。
//          type(uint256).max = 无上限，0 = 暂停/没 share。
//          永不 revert。
function maxWithdraw(address owner) public view returns (uint256 maxAssets)

// "如果我现在 withdraw(X asset)，要烧多少 share？"
// assets:  你想取多少 asset
// returns: 需要烧多少 share。
//          包含提款手续费，但不考虑限额（maxWithdraw 的返回值）。
//          实际 withdraw 烧的 share ≤ preview 的值（用户最多烧这么多）。
function previewWithdraw(uint256 assets) public view returns (uint256 shares)
```



#### 方式2：按 Share 算（redeem）

"我要烧 50 share，能拿回多少 asset 算多少。"

```solidity
// shares:   你要烧多少 share（精确值）
// receiver: 谁收到 asset
// owner:    share 从谁的账户里烧
// returns:  实际拿回了多少 asset（因取整，可能略少于理论值）
function redeem(uint256 shares, address receiver, address owner) public returns (uint256 assets)
```

如果 `owner != msg.sender`，同样需要先 `approve` 金库合约使用 owner 的 share。

**前置检查函数：**

```solidity
// "owner 最多能 redeem 多少 share？"
// owner:   谁的 share 要被赎回
// returns: 当前能 redeem 的最大 share 数。规则同 maxWithdraw。
//          type(uint256).max = 无上限，0 = 暂停。
function maxRedeem(address owner) public view returns (uint256 maxShares)

// "如果我现在 redeem(X share)，能拿回多少 asset？"
// shares:  你想烧多少 share
// returns: 你能拿回多少 asset。
//          包含手续费，但不考虑限额。
//          实际 redeem 给的 asset ≥ preview 的值（用户至少拿到这么多）。
function previewRedeem(uint256 shares) public view returns (uint256 assets)
```



#### withdraw vs redeem

|                      | withdraw                      | redeem                    |
| -------------------- | ----------------------------- | ------------------------- |
| 你指定的量（精确）   | asset 数量                    | share 数量                |
| 金库返回的量（估算） | share 数量                    | asset 数量                |
| 实际 vs preview      | 实际 share ≤ preview          | 实际 asset ≥ preview      |
| 需要 approve？       | owner≠sender 时               | owner≠sender 时           |
| 前置查询             | maxWithdraw + previewWithdraw | maxRedeem + previewRedeem |
| 类比                 | "我要取 100 美元"             | "我要把存单全兑了"        |



### 汇率

> 注: 汇率是通过2个convert函数间接给出的, 而不是直接给出(比如没有提供一个getRate函数)

```solidity
// "X 个 asset 理想情况下能换多少 share？"
// assets:  你想换算的 asset 量
// returns: 理想情况下的 share 数。向下取整。无手续费、无滑点。
function convertToShares(uint256 assets) public view returns (uint256 shares)

// "X 个 share 理想情况下能换多少 asset？"
// shares:  你想换算的 share 量
// returns: 理想情况下的 asset 数。向下取整。无手续费、无滑点。
function convertToAssets(uint256 shares) public view returns (uint256 assets)
```

注意, 与前面的previewXXX函数的不同: previewXXX是预览,所以包含了手续费,并且每笔交易都可能有所不同. convertToXXX不包含手续费, 相对比较稳定, 可作为价格预言机(TWAP)

> 安全要点：`preview*` 是即时精确值，但可以被同一笔交易的前置操作操纵（比如闪电贷砸盘）。所以不要拿 `preview*` 当价格预言机。`convertTo*` 可以做 TWAP（时间加权平均价）防操纵。



为什么不提供 `getRate()` 函数：

**1. 精度问题**

Solidity 没有浮点数。如果返回一个 rate 值（比如 1 share = 1.25 USDC），需要用 numerator/denominator 或定死小数位表示。更关键的是——极端情况下（比如金库只有 2 share 但管着 10 万 USDC），1 wei 级别的汇率精度极差。`convertToAssets(2 share)` 却能精确返回 10 万 USDC——输入你关心的量，精度由输入量级自然保证。

**2. 取整方向问题**

如果只给原始汇率，调用方自己做乘法时可能向上取整、可能向下取整——结果不一致。`convertTo*` 把取整方向锁死在函数内部（两个都向下取整），消除歧义。

**3. 汇率可能非线性**

大多数金库是线性的（share 价格跟数量无关），但标准不禁止非线性的（比如存得越多给的 share 越少）。一个单独的 `rate` 值无法表达这种行为，`convertTo*(amount)` 接受任意数量，更通用。

**补充：`totalAssets() / totalSupply()` 能当粗糙的 rate 用吗？**

能，前端展示"你的 share 大概值多少钱"基本就用它。但它不等于 `convertToAssets(1)`：

- `totalAssets()` 是瞬时快照，`convertToAssets` 可以实现为 TWAP（更防操纵）
- 没有取整保证——不适合直接当兑换价



### share 价格为什么会上涨/下跌？

金库赚了钱（利息、交易费、奖励)，`totalAssets` 增加，但 share 总量不变 → 每 share 更值钱。

初始：1000 USDC / 1000 share → 1 share = 1 USDC
一年后：1100 USDC / 1000 share → 1 share = 1.1 USDC（涨了 10%）

当然也可能下跌(坏账,被黑)或不变



### 取整方向:

ERC-4626 明确规定——金库永远占便宜

| 场景                          | 取整方向 | 谁吃亏         |
| ----------------------------- | -------- | -------------- |
| 用户 deposit，金库 mint share | 向下取整 | 用户少拿 share |
| 用户 mint，金库收 asset       | 向上取整 | 用户多付 asset |
| 用户 withdraw，金库烧 share   | 向上取整 | 用户多烧 share |
| 用户 redeem，金库付 asset     | 向下取整 | 用户少拿 asset |
| convertToShares               | 向下取整 | 消除歧义       |
| convertToAssets               | 向下取整 | 消除歧义       |


> 为什么会这样: 因为如果反过来，攻击者可以通过反复存/取 + 取整差来慢慢从金库里抽水（"取整攻击"）



### 事件、安全、与扩展

#### EVENT

```solidity
// deposit 或 mint 成功后必须 emit
event Deposit(
    address indexed sender,   // msg.sender（谁触发了这笔交易）
    address indexed owner,    // receiver（谁收到了 share）
    uint256 assets,           // 存了多少 asset
    uint256 shares            // mint 了多少 share
);

// withdraw 或 redeem 成功后必须 emit
event Withdraw(
    address indexed sender,   // msg.sender
    address indexed receiver, // 谁收到了 asset
    address indexed owner,    // 谁的 share 被烧了
    uint256 assets,           // 取了多少 asset
    uint256 shares            // 烧了多少 share
);
```



#### 安全要点

1, preview 不是预言机

`preview*` 是即时精确值，跟当前区块状态挂钩。如果攻击者在同一笔交易里先闪电贷砸盘改变 share 价格，再让你基于 `preview*` 做决策——你就被套了。

> 价格预言机用 `convertTo*` + TWAP , 交易模拟用 `preview*`

2, 恶意实现

一个合约可以"长得像" ERC-4626（函数签名匹配），但实际行为完全不对——比如 `previewRedeem` 返回 100 USDC，实际 `redeem` 只给你 50 USDC。标准管不了实现者是否诚实

3, 滑点

智能合约可以在收到不满意的 share 数时 revert。但 EOA 钱包（比如你手动在 MetaMask 里调 deposit）没法做这个判断——你只能接受返回值。所以很多金库会额外提供带 `minSharesOut` / `maxAssetsIn` 参数的版本，让 EOA 也能设置滑点容忍。



#### 扩展

ERC-4626 假设存/取是同步即时的（调 deposit → 立刻拿 share）。但有些场景做不到：

| 场景            | 问题                             |
| :-------------- | :------------------------------- |
| RWA（现实资产） | 赎回需要等传统金融结算，可能几天 |
| 跨链借贷        | 需要等跨链消息确认               |
| 保险模块        | 解锁有等待期                     |
| 流动性挖矿      | 提款有锁定期                     |

- ERC-7540：给 ERC-4626 加了一层异步请求模型（先提交 request → 等待 → claim），保留 `deposit`/`redeem` 的接口不变。

- 另外，ERC-4626 只支持单一底层资产。像 Uniswap LP token（本身就是两种资产的组合）没法直接套。
- ERC-7575：多资产金库，把 ERC-20（share）和 ERC-4626（金库逻辑）拆开，允许多个 entry point



## openzeppelin 文档

https://docs.openzeppelin.com/contracts/5.x/erc4626

和标准文档相同的内容略过. 说说openzeppelin增加到内容



### 通货膨胀攻击

首先理解什么是"抢跑（front-run）": 区块链上所有人发出的交易都先进一个公开的待处理池（mempool），矿工再从里面挑交易打包。也就是说，你的交易在还没执行之前，别人就能看到你要干什么。"抢跑"就是：攻击者看到你的交易在排队，他立刻发一笔交易，给更高的 gas 费让矿工先打包他的，赶在你前面执行

#### 攻击步骤

假设一个全新的空金库（管理 USDC），还没任何人存过钱。

1. 攻击者调用金库的 `deposit` 函数，存入 1 个最小单位的 USDC（即 0.000001 USDC，1 wei），拿到 1 个 share。此时金库状态：

   ```
   totalAssets() = 0.000001 USDC（攻击者存的） 
   totalSupply() = 1 share（只发给了攻击者） 
   1 share ≈ 0.000001 USDC
   ```

2. 攻击者在 mempool 里看到受害者即将要调金库的 `deposit(假设 5万 USDC)` ,攻击者抢跑：赶在受害者的交易之前，攻击者先调 USDC 代币合约 的 `transfer(金库合约地址, 50000.000001 USDC)`。这个数字不是随便的——恰好等于"受害者要存的数量 + 1 wei"。

   ```
   totalAssets = 1 wei + (50000.000001 USDC) = 50000.000002 USDC totalSupply = 1 share（没变！） 
   1 share ≈ 50000 USDC (汇率被疯狂抬高！)
   ```

   > 为什么刚好是受害者存款额 + 1 wei？当然, 只要大于受害者的存款额就都是可以的
   >
   > 受害者存入 `u` 个 USDC 时，能拿到的 share 数 = `⌊u × totalSupply / totalAssets⌋`（向下取整）
   >
   > 如果 `u < totalAssets`，则 `u × 1 / totalAssets < 1`，取整后 = 0 share。
   >
   > 所以在空金库（totalSupply = 1）的前提下，只要让 `totalAssets > u`（即 `totalAssets` 的任何值超过受害者的存款量），受害者的 share 就会归零。

3. 受害者的交易执行。他调金库的 `deposit(5万 USDC)`：

   ```
   按汇率 1 share = 50000+ USDC (大于用户的5万, 也就是说要5万多USDC才能够分到一个share)
   用户 5万 / 50000+ = 不到 1 个share
   Solidity 整数除法向下取整 → 拿到 0 share
   金库吞了他的 5 万 USDC，但没给他任何 share
   ```

4. 攻击者调用金库的 `redeem(1 share, 攻击者地址, 攻击者地址)`，烧掉自己那 1 个 share，把金库里的所有 USDC 提走：

   ```
   金库总资产 = 攻击者存的 1 wei USDC + 攻击者捐的 50000.000001 USDC + 受害者存的 5万 USDC
   攻击者拿回 ≈ 10 万 USDC
   净赚 ≈ 5 万 USDC（受害者的钱）
   ```

   

#### 防御方案: 虚拟偏移

OZ 的方案借鉴了 YieldBox，两个措施组合：

1. 精度偏移（decimals offset）

让 share 的小数位比 asset 多（比如 asset 是 6 位小数 USDC，share 用 12 位）。这样初始汇率极高（1 asset = 10^6 share），取整误差极小。

```
偏移前：1 asset → 1 share          攻击者 donation 10 万 → 受害者 0 share
偏移后：1 asset → 1,000,000 share  攻击者需要捐 10 万 × 10^6 才能造成同样伤害
```

2. 虚拟 share 和虚拟 asset

在计算汇率时，假装金库里已经有了一笔初始资金——不真实存在，只参与数学：

```
真实：0 asset，0 share
虚拟：1 asset，10^δ share  ← 凭空加的

汇率 = (真实资产 + 虚拟资产) / (真实份额 + 虚拟份额)
空金库时 = 1 / 10^δ = 极低 → 攻击者需要天价 donation 才能影响汇率
```

关键效果：攻击者的 donation 大部分被虚拟 share 吃掉，不属于攻击者自己。攻击者的 loss 远大于他能偷到的金额——所以不划算。

```
无虚拟偏移：攻击者捐 10 万，全归自己（他是唯一股东）
有虚拟偏移：攻击者捐 10 万，大部分被虚拟 share 稀释，自己只能拿回一点点
```

> 这只是一种威慑, 现实中攻击者不可能亏掉, 会先模拟,或者拿不到对应的share就revert



### 手续费实现

#### 核心矛盾："含费"与"不含费"的两种方向

ERC-4626 的四个操作里，用户指定的那个量**已经包含了手续费**的情况，和**不包含手续费**的情况，是恰好交叉的：

| 操作               | 用户指定          | 手续费在哪里                    | 生活类比                     |
| ------------------ | ----------------- | ------------------------------- | ---------------------------- |
| `deposit(100)`     | 从钱包掏 100 USDC | 费从 100 里**扣掉**，剩余进金库 | "我付 100 块，含了税"        |
| `mint(50 share)`   | 拿到 50 share     | 费**额外加**在成本上            | "我要拿到手 50，税另算"      |
| `withdraw(100)`    | 到手 100 USDC     | 费**额外加**在烧的 share 上     | "我要拿到手 100，手续费另算" |
| `redeem(50 share)` | 烧 50 share       | 费从赎回款里**扣掉**            | "我烧 50，税从里面扣"        |

> 规律：**deposit 和 redeem 的用户输入量已含费；mint 和 withdraw 的用户输入量不含费，费是额外加上的。**

---

因此需要两种不同的费用计算公式

以 100 basis points（1%）为例：

`_feeOnRaw`：费是额外加上的

原始值 1000 → 费 = `1000 × 100 / 10000 = 10` → 含费总计 = 1010

```
function _feeOnRaw(uint256 assets, uint256 bps) → uint256
    return assets × bps / 10000   // 向上取整
```

适用于 `mint` 和 `withdraw`——因为用户说"我要拿 X"，金库需要告诉用户"你得额外付 Y 的费"。

`_feeOnTotal`：费从总额里拆出来

总额 1010 → 费 = `1010 × 100 / (10000 + 100) = 1010 × 100/10100 = 10` → 净额 = 1000

```
function _feeOnTotal(uint256 assets, uint256 bps) → uint256
    return assets × bps / (bps + 10000)   // 向上取整
```

适用于 `deposit` 和 `redeem`——因为用户说"我总共出 X"（或"我总共烧 X"），金库需要从里面拆出费交给 treasury，剩下的才是真正的存款/赎回。

> 为什么分母是 `bps + 10000` 而不是 `10000`？
> 因为 `assets` 已经包含了费。如果直接用 `assets × 1%`，算出来比真实的费要多一点（你在对"含税费"再征税）。正确做法是把 `assets` 拆回"原始值 + 费"这两个部分。



#### 具体到四个 preview 函数

以 1% 手续费为例，OZ 的实现逻辑：

**`previewDeposit(assets)`**：用户说"我总共掏 100 USDC"

```
费 = _feeOnTotal(100) = 100 × 100/10100 = 0.99 USDC → 交给 treasury
净投入 = 100 - 0.99 = 99.01 USDC → 进入金库，换算成 share
返回 share 数
```

**`previewMint(shares)`**：用户说"我要铸造对应 100 USDC 的 share"

```
先算出基础成本 = 100 USDC（不含费）
费 = _feeOnRaw(100) = 1 USDC → 额外加
总扣款 = 100 + 1 = 101 USDC
返回 101
```

**`previewWithdraw(assets)`**：用户说"我要到手 100 USDC"

```
到手 100 USDC，需要烧的基础 share 数 = X
费 = _feeOnRaw(100) = 1 USDC → 额外加
总需烧 = X + 额外的 1 USDC 对应的 share
返回总 share 数
```

**`previewRedeem(shares)`**：用户说"我要烧对应 100 USDC 的 share"

```
基础赎回 = 100 USDC
费 = _feeOnTotal(100) = 0.99 USDC → 交给 treasury
实际到手 = 100 - 0.99 = 99.01 USDC
返回 99.01
```



### `_deposit` 和 `_withdraw` 钩子

OZ 在内部留了两个 hook，子合约可以重写来实现手续费：

```solidity
// 存款时调用（deposit 和 mint 都会走到这里）
function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal virtual {
    // 默认：直接把 asset 从 caller 转给金库，mint share 给 receiver
    // 带手续费的版本会在这里拆出 fee，转给 treasury
}

// 取款时调用（withdraw 和 redeem 都会走到这里）
function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal virtual {
    // 默认：烧 share，转 asset
    // 带手续费的版本会在这里拆出 fee，转给 treasury
}
```

好处是只需重写这两个 hook，四个对外函数的行为全部自动对齐。



### Deposit / Withdraw 事件中的手续费

OZ 文档特别说明了一个共识（EIP 本身对此写得不够明确）：

- **`Deposit` 事件**：`assets` 字段应包含手续费（用户掏的总数），`shares` 是实际收到的份额。两个数字之间的汇率差 = 买入价差。
- **`Withdraw` 事件**：`shares` 字段应包含手续费（用户烧的总数），`assets` 是实际到手的金额。两个数字之间的汇率差 = 卖出价差。

> 前端可以通过 `assets/shares`（买入价）和另一笔交易的 `assets/shares`（卖出价）之间的差值看出金库收了多少费。
