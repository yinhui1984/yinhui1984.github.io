---
title: "Agent 替你签 approve 时, 少检查了一层"
date: 2026-06-25T11:29:11+08:00
draft: false
author: yinhui
categories: [security]
tags: [agent, approve, defi]
---

先看一个很小的例子.

用户给 Agent 的任务是: 帮我把 8 USDC 换成 ETH.

Agent 最后生成的链上动作是:

```text
approve(MetaSwap, type(uint256).max)
```

对应一笔 ETH 主网交易: `tx = 0x8e0a15886616d1e7bc59c4c398fa3091fa5516a042af69ce44cdd06afe78a582`, 区块高度 `22350004`.

MetaSwap 是一个 DEX 聚合器, 不是一眼假的恶意合约. 这笔交易也可以正常执行: 签名有效, calldata 合法, token 合约不会 revert, gas 正常消耗.

但这里有个问题: 任务需要最多花 8 USDC, 实际授权却是 MetaSwap 可以长期花接近无限的 USDC. 链上看, 这只是一笔正常的 ERC20 `approve`. 从任务角度看, 它给出去的能力明显超过了这次任务需要.

<!--more-->

## calldata 里能看到什么

`approve` 的 ABI 是:

```solidity
function approve(address spender, uint256 amount) returns (bool);
```

这类交易最少要拆两个字段: `spender = 0x881D40237659C251811CEC9c364ef91dC08D300C`, `amount = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`.

`spender` 决定谁可以调用 `transferFrom` 花用户的 USDC. `amount` 决定它最多可以花多少.

如果 Agent 的任务只是 swap 8 USDC, 那更贴近任务边界的授权应该类似 `approve(MetaSwap, 8 USDC)`, 或者稍微留一点 slippage / fee buffer, 但也应该有一个明确上限.

`type(uint256).max` 的问题不是语法错误. 它完全合法. 问题是它把一次任务需要的额度, 变成了一个长期、近似无限的 allowance.

## 现有检查大多在看能不能执行

现在 agent wallet / agent runtime 相关的防线, 大多可以回答这些问题: 这个 agent 是谁, 这个 tool 有没有注册, spender 合约是不是已知恶意地址, 交易 simulation 会不会失败, 交易有没有符合用户设置的每日限额或白名单, 输入在传给执行层之前有没有被篡改.

这些都很有用.

比如相关 ERC 草案和产品方向里, 已经可以看到几类基础设施:

- `ERC-8257`: Agent Tool Registry, 给 agent tool 做链上注册
- `ERC-8239`: Agent Skill Registry, 描述 agent 能力
- `ERC-8004`: Trustless Agents, 处理 agent 身份、声誉、验证
- `ERC-8195`: Task Market Protocol, 让人、agent、IoT 都可以接任务
- `ERC-8183`: Agentic Commerce, 做托管、交付和结算

产品侧也开始出现 agent wallet. MetaMask 在 2026 年 6 月开放 Agent Wallet early access, 让 AI agent 在用户定义的规则里做链上交易, 并经过 simulation、threat scanning、MEV protection 等检查. GoPlus 的 AgentGuard 也在做 AI agent runtime security.

这些检查能拦很多东西. 但回到刚才那笔 `approve`, 它们可能都会通过: agent 身份合法, tool 合法, spender 未被标记为恶意, 交易 simulation 成功, 签名有效, 输入没有被篡改. 然后无限授权还是签出去了.

## 少掉的是任务边界

这里缺的不是又一个“这个地址是不是坏人”的检查.

缺的是:

```text
granted capability <= task requirement
```

也就是实际授予的能力, 不能超过完成任务需要的能力. 可以把它叫做 Authorization Surplus:

```text
Authorization Surplus = 授予的能力 - 完成任务所需的能力
```

放到这笔交易里, 完成任务所需是花 8 USDC, 实际授予能力是 spender 可长期花接近无限 USDC, Authorization Surplus 近似无限.

所以问题不是 agent 一定会偷钱. 更具体一点: 一个合法 agent 调用了合法 tool, 生成了一笔合法交易, 但这笔交易的权限范围超过了用户这次任务.

这在 EVM 语义里不会报错. ERC20 只关心 owner 是否签了名, spender 和 amount 是否写进 allowance. 它不知道用户原始任务是“换 8 USDC”, 还是“长期授权这个 router”.

## 为什么 Agent 场景更明显

人自己操作 DeFi 的时候, 也经常签无限授权.

区别是, 人至少知道自己在点钱包弹窗, 虽然多数时候也不会读 calldata. Agent 场景里, 用户给的是自然语言任务, 中间会多一层规划和工具调用:

```text
用户任务 -> Agent plan -> tool call -> calldata -> wallet policy -> chain
```

如果 wallet policy 只看最后的 calldata, 它能看到 `approve(spender, amount)`, 但它不一定知道这个 `amount` 和用户原始任务之间的关系.

这里就是任务边界检查的位置: 它要把原始任务里的上限, 带到交易检查里.

比如 task token 是 USDC, task amount 是 8, tx function 是 `approve`, tx spender 是 MetaSwap, tx amount 是 `type(uint256).max`. 这时候策略引擎应该能说: approve amount 明显超过 task amount. 然后要求缩小额度, 或者让用户显式确认“我就是要给长期无限授权”.

## VSCode 插件这个类比

这个问题有点像 VSCode 插件市场.

你装一个插件, 可能只是想要一个小功能. 但插件拿到的权限可能是文件系统、网络、终端. 用户意图很小, 实际权限很大.

Web3 agent 也是类似结构. 用户给的是一个小任务: 帮我 swap 一次. Agent 可能申请到一个更大的权限: 允许某个 spender 长期划走我的 token.

区别是, Web3 这里动的是链上资产, 而且授权状态直接存在 token 合约的 `_allowances` 里. 只要没 revoke, 它就还在.

## 可以先做的检查

如果要把任务边界放进 wallet / agent policy, 最小实现不需要很玄.

第一步, decode calldata, 拿到 `function = approve(address,uint256)`, `spender`, `amount`.

第二步, 从任务里抽出 token 和额度上限, 比如 `task = swap 8 USDC to ETH`, 那么 `max_input = 8 USDC`.

第三步, 比较授权: `approve.amount <= max_input + buffer`.

第四步, 如果必须临时放大额度, 要把原因暴露出来, 并在任务结束后自动 revoke:

```solidity
approve(spender, 0)
```

这里的关键不是某个具体 ERC 名字, 而是检查对象变了.

以前很多检查在问: agent 是否可信, spender 是否恶意, 交易是否能成功.

这里要多问一句: 这笔授权是否超过本次任务需要?

`approve` 的链上语义只认识 `spender` 和 `amount`. Agent 钱包如果要理解任务, 就必须把“用户要做什么”和“calldata 实际授权了什么”放在同一个检查里.
