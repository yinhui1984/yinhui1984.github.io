---
title: "ERC20 approve 到底授权了什么"
date: 2026-06-24T10:36:18+08:00
draft: false
author: yinhui
categories: [security]
tags: [defi, approve, ERC20]
---

这里看一笔真实的 USDC `approve` 交易.

交易哈希: `0x8e0a15886616d1e7bc59c4c398fa3091fa5516a042af69ce44cdd06afe78a582`

ETH 主网, 区块高度: `22350004`

原始 calldata:

```text
0x095ea7b3000000000000000000000000881d40237659c251811cec9c364ef91dc08d300cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
```

这笔交易做的事情很简单: 调用 USDC 合约的 `approve(address,uint256)`. 但 `approve` 容易被误解, 因为它不是转账, 而是给另一个地址一个后续转账的权限.

<!--more-->

## calldata

先拆 calldata.

```text
0x095ea7b3
000000000000000000000000881d40237659c251811cec9c364ef91dc08d300c
ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
```

第一段 `0x095ea7b3` 是函数选择器, 对应 `approve(address,uint256)`. 后面两个参数都是 32 字节. 第一个参数去掉前面的补零后得到 `0x881D40237659C251811CEC9c364ef91dC08D300C`, 这个地址就是 `spender`, 也就是被授权花钱的地址. Etherscan 上显示它是 `MetaSwap`, 一个 DEX 聚合器.

第二个参数是 32 字节的 `f`, 也就是 `uint256` 的最大值: `2^256 - 1`.

所以这笔交易可以简单理解为:

```solidity
USDC.approve(
    0x881D40237659C251811CEC9c364ef91dC08D300C,
    type(uint256).max
);
```

也就是通常说的无限授权.

## approve 改了什么

ERC20 里面一般会有这样的结构:

```solidity
mapping(address owner => mapping(address spender => uint256)) _allowances;
```

`approve(spender, amount)` 改的是:

```solidity
_allowances[msg.sender][spender] = amount;
```

也就是说, 它不是把 token 立刻转出去, 而是记录一条授权: `owner` 允许 `spender` 最多花掉 `amount` 数量的 token. 真正转走 token 的时候, spender 后面会调用 `transferFrom(owner, to, value)`, token 合约再检查 `_allowances[owner][msg.sender] >= value`.

所以 `approve` 和 `transfer` 不是同一个动作. `transfer` 是资产移动, `approve` 是写入一个后续可以被 `transferFrom` 使用的额度.

## allowance 和 balance 不是一回事

这里最容易误解的是: 钱包余额清零, 不等于授权清零.

比如现在钱包里只有 8 USDC. 你先签了一笔 `USDC.approve(MetaSwap, type(uint256).max)`, 然后 MetaSwap 通过 `transferFrom` 花掉 8 USDC. 这时钱包里的 USDC 余额变成 0, 但 `_allowances[owner][MetaSwap]` 并不会因为余额为 0 就自动变成 0.

如果之后你又往这个地址转入 100000 USDC, 只要这条 allowance 还在, MetaSwap 仍然可以继续通过 `transferFrom` 花这部分 USDC.

简单理解: `balance` 是 owner 当前有多少 token, `allowance` 是 spender 被允许从 owner 那里花多少 token. 它们是两个状态.

## 可以怎么验证

如果要看当前授权值, 可以直接读 token 合约的 `allowance`.

命令类似这样:

```bash
cast call <USDC_CONTRACT> \
  "allowance(address,address)(uint256)" \
  <OWNER_ADDRESS> \
  0x881D40237659C251811CEC9c364ef91dC08D300C \
  --rpc-url <RPC_URL>
```

这里 `<OWNER_ADDRESS>` 是发起这笔 approve 的地址. 如果读出来的值接近 `115792089237316195423570985008687907853269984665640564039457584007913129639935`, 那就是 `uint256.max`, 基本可以认为是无限授权.

如果它比这个数字少一点, 通常说明 spender 已经通过 `transferFrom` 花掉了一部分, 因为普通 allowance 会在 `transferFrom` 后扣减.

## spender 正常也不代表授权合理

这里的问题不是 MetaSwap 一定有问题. 恰好相反, spender 可能是一个正常协议, 合约也可能已经开源验证.

但这次操作如果只是 swap 8 USDC, 那需要的权限其实是最多花掉 8 USDC. 实际给出的权限却是 spender 后续可以花掉接近无限的 USDC.

从链上执行角度看, 这笔交易没有问题. 签名正确, calldata 正确, token 合约接受这个调用. 但从授权范围看, 这个权限明显大于本次 swap 需要.

## 不只是全 f 才要注意

还有一种情况也容易被忽略.

并不是只有 `0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` 才有问题. 比如给一个 router 授权 `10000000 USDC`. 它不是 `uint256.max`, 但对普通地址来说, 这个额度和无限也差不多.

所以判断 approve 风险时, 不要只看是不是全 `f`. 更实际的问题是: `amount` 是否明显超过这次操作需要的数量.

## revoke

撤销授权本质上也是一次 approve:

```solidity
USDC.approve(spender, 0);
```

也就是把 `_allowances[owner][spender]` 重新设置为 0.

常用工具比如:

- https://revoke.cash
- https://etherscan.io/tokenapprovalchecker

这些工具最终做的事情还是回到 ERC20 这个模型上: 找到 owner 对 spender 的 allowance, 然后发一笔交易把它改掉.

## 最后

看一笔 ERC20 approve, 至少要拆两个字段: `spender` 是谁可以花, `amount` 是最多可以花多少.

`approve` 写进去的是一条持续性的支出权限. 只要这条 allowance 还在, 后续 `transferFrom` 检查的就是它.

所以这里的核心不是钱包弹窗写得好不好, 而是 ERC20 allowance 这个模型本身:

```solidity
mapping(owner => mapping(spender => amount))
```

授权一旦写进去, 它就会一直留在那里, 直到被消费或被主动改掉.
