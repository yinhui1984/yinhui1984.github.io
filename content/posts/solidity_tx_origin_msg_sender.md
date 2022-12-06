---
title: "Solidity中tx.origin和msg.sender"
date: 2022-12-06T13:21:41+08:00
draft: false
author: yinhui
categories: [Blockchain]
tags: [solidity, L3,Web3.0] 
---

## 基本含义:

### `tx.origin`:

tx.origin 表示交易的发起者,这个值在执行交易时自动设置，用于表示这个交易是由哪个账户发起的.

使用 tx.origin 的原因是，在以太坊区块链中，交易可能会经过多个中间人，最终到达目标账户。在这种情况下，msg.sender 可能会变成中间人账户的地址，而 tx.origin 则始终表示交易的发起者。使用 tx.origin 可以保证在检查权限时，始终检查交易的实际发起者。

### `msg.sender`

msg.sender 表示当前函数调用的发送者,这个值在执行函数调用时自动设置，用于表示谁在调用当前函数.



## 简单理解:

如果A调用了合约B的函数FB, 那么在函数FB中, A既是`tx.origin`, 也是`msg.sender`

如果A调用了合约C, 合约C再调用了合约B的函数FB, 那么在函数FB中,  A是`tx.origin`, C是`msg.sender`



## 举例

三个合约, 外部地址调用C, C调用B, B调用A

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "hardhat/console.sol";

contract A {
    function FA() public view {
        console.log("A-tx.origin:", tx.origin);
        console.log("A-msg.sender:", msg.sender);
        console.log("A-address:", address(this));
    }
}

contract B {
    function FB() public {
        console.log("B-tx.origin:", tx.origin);
        console.log("B-msg.sender:", msg.sender);
        console.log("B-address:", address(this));
        A a = new A();
        a.FA();
    }
}

contract C {
    function FC() public {
        console.log("C-tx.origin:", tx.origin);
        console.log("C-msg.sender:", msg.sender);
        console.log("C-address:", address(this));
        B b = new B();
        b.FB();
    }
}

```

```js
//const { expect } = require('chai');
const { ethers } = require('hardhat'); 

describe('origin demo Test Suits', function () {
    it("测试..", async function () {

        const [owner, other] = await ethers.getSigners();
        let facotry = await ethers.getContractFactory("C");
        const contract = await facotry.deploy();
        await contract.FC();

    });
});
```

输出

```
C-tx.origin: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
C-msg.sender: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
C-address: 0x5fbdb2315678afecb367f032d93f642f64180aa3
B-tx.origin: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
B-msg.sender: 0x5fbdb2315678afecb367f032d93f642f64180aa3
B-address: 0xa16e02e87b7454126e5e10d957a927a7f5b5d2be
A-tx.origin: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
A-msg.sender: 0xa16e02e87b7454126e5e10d957a927a7f5b5d2be
A-address: 0x8ff3801288a85ea261e4277d44e1131ea736f77b
```

分析上面的输出, 可以得到下面这个图

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1670306285585886000.jpg?raw=true)





## 安全隐患

网上有很多关于对`tx.origin`授权导致的安全隐患的文章, 但使用时要区分你的代码到底是需要`tx.origin`还是`msg.sender`

