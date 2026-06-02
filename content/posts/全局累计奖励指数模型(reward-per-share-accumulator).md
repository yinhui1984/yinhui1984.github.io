---
title: "全局累计奖励指数模型(reward-per-share-accumulator)"
date: 2026-06-02T16:54:18+08:00
draft: false
author: yinhui
categories: ["Blockchain"]
tags: ["DeFi", "Solidity", "Web3.0"]
---

about [Scalable Reward Distribution on the Ethereum Blockchain](https://batog.info/papers/scalable-reward-distribution.pdf) and more...

<!--more-->

## **先看论文**

[Scalable Reward Distribution on the Ethereum Blockchain](https://batog.info/papers/scalable-reward-distribution.pdf)

### **多用户奖励分发的困境**

如果使用传统方案记录和分发 DeFi 协议中的用户奖励，最容易写出这样的代码：

```solidity
for each user:
    reward[user] += rewardAmount * stake[user] / totalStake;
```

问题很直接：

1. 复杂度为 O(N)；
2. 用户越多，gas 越高；
3. 用户数量达到一定规模后，gas limit 会让交易直接 revert.

即使将“项目方向用户主动转账”改成“用户自己 claim”，问题也没有解决.

如果每次分红仍然需要遍历所有用户，逐个更新：reward[user]

那只是把“推送转账”改成了“推送记账”.

真正需要消灭的是遍历.

### **转变观念：不要为每个用户记账，转而使用全局标尺**

每次分红时，不要问：Alice 应该获得多少奖励？

应该问：本次分红让每 1 单位质押增加了多少收益？

假设：

```text
totalStake = 100
reward     = 50
```

那么每 1 单位质押增加：50 / 100 = 0.5 的收益.



我们只需要维护一个全局指数：

```solidity
uint256 S; // 累计每单位质押收益
```

分红时：

```solidity
S += reward / totalStake;
```

`S` 不属于任何用户.它记录的是：

```text
从系统开始运行到现在，每 1 单位 stake 累计获得了多少 reward.
```

### **全局标尺的刻度是什么**

刻度是奖励发放事件，而不是时间.

```text
distribution event:
e0 -> e1 -> e2 -> ... -> e_right_now

global index S:
100 -> 150 -> 210 -> ... -> 600
```

Alice 在 `e1` 后进入，在 `e2` 后退出.

那么她每 1 单位质押获得：210 - 150 = 60 的奖励.如果她质押了 100 个 token，那么她获得：6000的奖励.

所以：`用户奖励 = 用户质押数量 *（结算时的 S - 进入时的 S）`

```solidity
reward = stake[user] * (S - S0[user]);
```

这个奖励分发系统与绝对时间无关，只与奖励事件的顺序有关.

### **数学形式：前缀和**

设第 `t` 次分红金额为：reward_t, 当时的总质押数量为：T_t

那么第 `t` 次分红让每 1 单位质押获得：reward_t / T_t的奖励.

定义全局累计奖励指数：

```text
S_t = Σ reward_k / T_k
```

用户 `j` 在 `t1` 时刻进入，在 `t2` 时刻结算，则：

```text
totalReward_j = stake_j * (S_t2 - S_t1)
```

这是一个前缀和问题：区间收益 = 右端点前缀和 - 左端点前缀和

### **如何鼓励长期质押，并削弱踩点质押**

如果一个月只分红一次，用户可以：分红前质押 然后 分红后退出, 进行踩点
短期资金只承担很小的时间成本，却可以参与整笔奖励的分配.
缓解方式是减小粒度：提高分红频率，减少单次分红的绝对数量.

例如：每小时释放一次奖励 或者：按区块释放奖励
这样，短期资金只能获得它实际覆盖的小时或区块对应的奖励，不能只踩中一个时间点就拿走整块蛋糕.
这并没有彻底禁止短期质押，只是将离散的大额分红切碎，让奖励近似按照质押时间累计.

### **节约存储**

最直接的实现似乎需要保存完整的 `S` 历史：`S_0, S_1, S_2, S_3, ...`
但用户结算时，其实只需要三个值：

```text
1. 用户质押数量；
2. 用户进入时的全局指数；
3. 用户结算时的全局指数.
```

第三个值就是当前的 `S`，不需要额外保存.
第二个值只需要在用户 deposit 时记录：
```solidity
S0[user] = S;
```

例如：
```text
S = 0
Alice deposit   -> Alice.S0 = 0

distribute      -> S = 10
distribute      -> S = 13
distribute      -> S = 17

Bob deposit     -> Bob.S0 = 17

distribute      -> S = 20
```

完整历史是：
```text
0, 10, 13, 17, 20
```
但链上真正需要保存的是：
```text
Alice.S0 = 0
Bob.S0   = 17
currentS = 20
```
`10` 和 `13` 没有用户在对应刻度进入，不需要单独保存.它们已经被当前的：S = 20 吸收了.

所以这个模型不保存完整历史，只保存未来结算仍然需要的用户入场锚点.

### **最终得到的最小模型**

```solidity
// 全局状态
uint256 totalStake; // T
uint256 S;          // 累计每单位质押收益

// 用户状态
mapping(address => uint256) stake;
mapping(address => uint256) S0;

// 用户质押时
stake[user] = amount;
S0[user] = S;
totalStake += amount;

// 分红时
S += reward / totalStake;

// 用户结算时
reward = stake[user] * (S - S0[user]);
totalStake -= stake[user];
stake[user] = 0;
```

No `for ... each`, just O(1).

### **Solidity 中的精度问题**

Solidity 没有小数.
如果直接写：`S += reward / totalStake;`
但是当：`reward < totalStake`时，整数除法可能直接得到 0.
实际代码通常会引入精度系数：
```solidity
uint256 constant PRECISION = 1e18;
S += reward * PRECISION / totalStake;
```

用户结算时再除回来：

```solidity
reward = stake[user] * (S - S0[user]) / PRECISION;
```
此时仍然会存在向下取整产生的 dust（零头），但不会因为整数除法直接吞掉大部分小额奖励.

### **这是算法骨架，不是完整生产代码**

论文为了突出核心算法，省略了很多真实业务边界.
例如：

```text
同一用户能否重复 deposit？
用户能否只领取奖励而不退出？
用户能否部分 withdraw？
stake token 与 reward token 是否相同？
整数除法产生的 dust 如何处理？
外部转账是否可能触发重入？
分红是否会被踩点套利？
```
这些问题不会改变全局累计奖励指数模型，但会决定合约能不能安全运行.


## **MasterChef 与 Synthetix**

论文中的算法可以称为：
```text
全局累计奖励指数模型
reward-per-share accumulator
```
论文原文将其描述为：
```text
Constant Time Reward Distribution Algorithm
```

`MasterChef` 与 `Synthetix` 不是算法名称，而是这套模型的两种典型工程实现.

| **模型**     | **全局收益尺**         | **用户锚点**                   | **奖励如何增长**                     |
| ------------ | ---------------------- | ------------------------------ | ------------------------------------ |
| 论文原始模型 | `S`                    | `S0[user]`                     | 每次 `distribute(reward)` 时增长     |
| MasterChef   | `accSushiPerShare`     | `rewardDebt`                   | 按经过的区块数惰性更新               |
| Synthetix    | `rewardPerTokenStored` | `userRewardPerTokenPaid[user]` | 按经过的时间和 `rewardRate` 惰性更新 |

## **MasterChef**

[MasterChef.sol](https://github.com/sushi-labs/sushiswap/blob/archieve/master/contracts/MasterChef.sol)

[MasterChefV2.sol](https://github.com/sushi-labs/sushiswap/blob/archieve/master/contracts/MasterChefV2.sol)

### **从单池扩展为多池**

论文只有一个质押池：

```solidity
uint256 totalStake;
uint256 S;

mapping(address => uint256) stake;
mapping(address => uint256) S0;
```

`MasterChef` 支持多个 LP 池：

```solidity
struct PoolInfo {
    IERC20 lpToken;
    uint256 allocPoint;
    uint256 lastRewardBlock;
    uint256 accSushiPerShare;
}

struct UserInfo {
    uint256 amount;
    uint256 rewardDebt;
}

PoolInfo[] public poolInfo;

mapping(uint256 => mapping(address => UserInfo)) public userInfo;
```

不同 LP 池有各自独立的全局收益尺：`pool.accSushiPerShare`
用户状态也按池编号 `pid` 分开记录：`userInfo[pid][user]`

### **`accSushiPerShare`** **就是** **`S`**

论文中的分红逻辑：`S += reward / totalStake;`
在 `MasterChef` 中变成：

```solidity
pool.accSushiPerShare = pool.accSushiPerShare.add(
    sushiReward.mul(1e12).div(lpSupply)
);
```
对应关系是：

```text
S          -> pool.accSushiPerShare
reward     -> sushiReward
totalStake -> lpSupply
PRECISION  -> 1e12
```
其中：

```solidity
uint256 lpSupply = pool.lpToken.balanceOf(address(this));
```
表示当前池子中质押的 LP token 总量.

### **奖励按区块惰性更新**

`MasterChef` 希望每个区块都产生一定数量的 SUSHI：`uint256 public sushiPerBlock;`
但它不会每个区块都发送交易更新 storage.
每个池只记录：`uint256 lastRewardBlock;`

有人操作时，再一次性补算从上次更新到当前区块之间产生的奖励：
```solidity
uint256 multiplier = getMultiplier(
    pool.lastRewardBlock,
    block.number
);

uint256 sushiReward = multiplier
    .mul(sushiPerBlock)
    .mul(pool.allocPoint)
    .div(totalAllocPoint);
```

然后推动全局收益尺增长：

```solidity
pool.accSushiPerShare = pool.accSushiPerShare.add(
    sushiReward.mul(1e12).div(lpSupply)
);

pool.lastRewardBlock = block.number;
```

逻辑上：每个区块都在释放奖励, 但是实际上：用户交互时才一次性补账. 这就是所谓的惰性更新.

### `allocPoint`：不同池如何分配奖励

多个池共享每个区块释放的 SUSHI.
每个池有一个权重：`uint256 allocPoint;`
全局记录权重总和：`uint256 totalAllocPoint;`
某个池分到的奖励比例是：`pool.allocPoint / totalAllocPoint`
因此：

```solidity
sushiReward = multiplier
    * sushiPerBlock
    * pool.allocPoint
    / totalAllocPoint;
```

### `rewardDebt` **是什么**

论文保存用户进入时的指数：`S0[user]`
用户奖励是：`reward = stake[user] * (S - S0[user]);`
也就是：`reward = stake[user] * S - stake[user] * S0[user]`
`MasterChef` 不保存：`S0[user]` 而是直接保存右侧的第二项：`stake[user] * S0[user]`, 也就是：`user.rewardDebt`

因此用户待领取奖励为：

```solidity
pending =
    user.amount * pool.accSushiPerShare / 1e12
    - user.rewardDebt;
```

两种表达完全等价：

```text
论文：
reward = stake * (S - S0)

MasterChef：
reward = amount * accSushiPerShare - rewardDebt

其中：
rewardDebt = amount * S0
```

`rewardDebt` 这个名字容易误导.

它不是用户欠协议的钱，而是用户已经结算过的奖励基线.

### **用户追加质押**

论文中的极简代码：

```solidity
stake[user] = amount;
S0[user] = S;
```

不能直接处理同一个用户重复 deposit.否则旧的 stake 和旧收益会被覆盖.
`MasterChef` 会先结算旧收益：

```solidity
uint256 pending =
    user.amount
        .mul(pool.accSushiPerShare)
        .div(1e12)
        .sub(user.rewardDebt);

safeSushiTransfer(msg.sender, pending);
```

然后增加本金：
```solidity
user.amount = user.amount.add(_amount);
```

最后重置奖励基线：
```solidity
user.rewardDebt =
    user.amount.mul(pool.accSushiPerShare).div(1e12);
```

可以理解为：
```text
旧 position 先结算
追加本金
用新的本金数量在当前收益刻度重新建立锚点
```

### **用户部分退出**

`withdraw()` 的逻辑相似：

```solidity
uint256 pending =
    user.amount
        .mul(pool.accSushiPerShare)
        .div(1e12)
        .sub(user.rewardDebt);

safeSushiTransfer(msg.sender, pending);

user.amount = user.amount.sub(_amount);

user.rewardDebt =
    user.amount.mul(pool.accSushiPerShare).div(1e12);

pool.lpToken.safeTransfer(
    address(msg.sender),
    _amount
);
```

可以理解为：

```text
旧 position 先结算
退还部分本金
剩余本金在当前收益刻度重新建立锚点
```

### **`deposit(pid, 0)`** **可以充当 claim**

如果调用：deposit(pid, 0);不会增加 LP token.但仍然会：

```text
更新池子
计算 pending
发放奖励
重置 rewardDebt
```

因此可以领取奖励而不改变质押本金.

### **仍然存在循环：****`massUpdatePools()`**

核心用户路径已经不再遍历用户.
但 `MasterChef` 仍然保留了：
```solidity
function massUpdatePools() public {
    uint256 length = poolInfo.length;

    for (uint256 pid = 0; pid < length; ++pid) {
        updatePool(pid);
    }
}
```
这个循环遍历的是池，不是用户.所以更准确的说法是：

```text
MasterChef 消除了按照用户数量增长的循环，
但保留了按照池数量增长的批量更新入口.
```



## **Synthetix**

[Synthetix StakingRewards](https://optimistic.etherscan.io/address/0xfD49C7EE330fE060ca66feE33d49206eB96F146D#code)

`Synthetix` 使用同一套全局累计奖励指数模型，但增长方式不同.

### **从按区块释放改为按时间释放**

`MasterChef` 按区块累计：`经过区块数 * sushiPerBlock`
`Synthetix` 按时间累计：`经过时间 * rewardRate`

核心状态是：

```solidity
uint256 public rewardRate;
uint256 public lastUpdateTime;
uint256 public periodFinish;
uint256 public rewardPerTokenStored;

mapping(address => uint256) public userRewardPerTokenPaid;
mapping(address => uint256) public rewards;
```

对应论文模型：

```text
S        -> rewardPerTokenStored
S0[user] -> userRewardPerTokenPaid[user]
```

### **全局收益尺如何增长**

核心计算可以压缩为：

```solidity
rewardPerToken =
    rewardPerTokenStored
    + (
        elapsedTime
        * rewardRate
        * 1e18
        / totalStake
    );
```

其中：

```text
elapsedTime = 当前有效时间 - lastUpdateTime
```
所以：

```text
每单位质押收益增量
=
经过时间 * 每秒奖励 / 总质押数量
```
这与论文中的：`S += reward / totalStake;`仍然是同一件事.
只是这里的：`reward`变成了`elapsedTime * rewardRate`

### **用户待领取奖励**

用户收益为：

```solidity
earned =
    balance[user]
    * (
        rewardPerToken()
        - userRewardPerTokenPaid[user]
    )
    / 1e18
    + rewards[user];
```

其中：
```solidity
userRewardPerTokenPaid[user]
```

就是用户上一次结算时的全局指数锚点.
```solidity
rewards[user]
```

则保存已经结算、但尚未实际领取的奖励.

### **MasterChef 与 Synthetix 的差异**

`MasterChef` 更接近按区块挖矿
`Synthetix` 更接近：按照 rewardRate 持续释放奖励

两者都不会真的在每个区块或每一秒写入 storage.
它们都使用惰性更新:逻辑上持续增长, 实际上在用户交互时一次性补算




## **最后**

这个模型最值得记住的不是某个变量名，而是设计方式：
- 不要逐个更新所有用户的奖励余额.
- 维护一个全局累计指数.
- 用户进入时记录锚点.
- 用户交互时结算区间差值.


从：每次分红，遍历所有用户 变成：每次分红，只推动全局收益尺增长
这就是：`reward-per-share accumulator`

不同项目里，变量名可能是：
accRewardPerShare
accSushiPerShare
rewardPerTokenStored
globalIndex

本质是同一件事：将大量用户级别的重复记账，压缩成一个全局累计指数.