---
title: "Solidity中的fallback和receive函数"
date: 2022-11-30T09:25:29+08:00
draft: false
author: yinhui
categories: [Blockchain]
tags: [solidity, L3,Web3.0] 
---





## Receiver

```solidity
receive() external payable {
 	//...
}
```



### 基本作用

让合约地址可以**以纯转账的方式**接收以太, 直接当向合约地址发送以太的时候, `receive`函数将被调用

比如:

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.4;

import "hardhat/console.sol";

contract Callee {
    receive() external payable {
        console.log(
            "[LOG] got some money, from:",
            msg.sender,
            ", value:",
            msg.value
        );
    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }
}

```



```js
const { expect } = require('chai');
const { ethers } = require('hardhat'); // https://docs.ethers.io/v5/
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe('ReceiveEther Contract Test Suits', function () {

    // https://hardhat.org/tutorial/testing-contracts#reusing-common-test-setups-with-fixtures
    // loadFixture将在第一次运行设置，并在其他测试中快速返回到该状态。
    async function deployContractFixture() {
        const [owner, addr1] = await ethers.getSigners();
        const facotry = await ethers.getContractFactory("Callee");
        const contract = await facotry.deploy();
        return { contract, owner, addr1 };
    }

    it("测试1", async function () {
        const { contract, owner, addr1 } = await loadFixture(deployContractFixture);

        let balance = await contract.getBalance();
        expect(balance).to.equal(0);

        //send ether to contract
        await owner.sendTransaction({
            to: contract.address,
            value: ethers.utils.parseEther("0.01"),
            gasLimit: 50000
        });

        balance = await contract.getBalance();
        expect(balance).to.equal(ethers.utils.parseEther("0.01"));
    });

});
```



输出:

```
❯ npx hardhat test ./test/receive.test.js                                            
Compiled 1 Solidity file successfully


  ReceiveEther Contract Test Suits
[LOG] got some money, from: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 , value: 10000000000000000
    ✔ 测试1 (1044ms)


  1 passing (1s)
```



如果没有`receive`函数 (或其替代品, 见下面的fallback的附加作用), 则执行会报错

```
  1) ReceiveEther Contract Test Suits
       测试1:
     Error: Transaction reverted: function selector was not recognized and there's no fallback nor receive function
```



### 注意

这里说的是`让合约地址可以**以纯转账的方式**接收以太` 而不是说合约地址上可以不存钱,

比如调用`payable`函数就不是"纯转账", 这时候是不需要`receive`函数的

```solidity
    function giveMoney() external payable {
        console.log(
            "[LOG] giveMoney, from:",
            msg.sender,
            ", value:",
            msg.value
        );
    }
```



## Fallback

```solidity
fallback() external {
	//...
}
```

或

```solidity
fallback() external payable{
	//...
}
```

### 基本作用:

当对合约调用一个不存在的函数时,  `fallback()`将被执行

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.4;

import "hardhat/console.sol";


contract Callee {
	
		fallback() external {
        console.log("[LOG] you called one function which not exist ");
    }
    function getBalance() public view returns (uint) {
        return address(this).balance;
    }
}

contract Caller {
    function callFunctionDoesNotExist(address _addr) public {
        (bool success, ) = _addr.call(
            abi.encodeWithSignature("doesNotExist()")
        );
        console.log("[LOG] address call return: ", success);
    }
}

```



```js

const { ethers } = require('hardhat'); 

describe('Caller Contract Test Suits', function () {

    it("测试调用不存在的函数", async function () {
        let facotry = await ethers.getContractFactory("Caller");
        let callerContract = await facotry.deploy();

        facotry = await ethers.getContractFactory("Callee");
        let receiveContract = await facotry.deploy();

        await callerContract.callFunctionDoesNotExist(receiveContract.address);

    });

});
```

输出

```
❯ npx hardhat test ./test/caller.test.js                                             
Compiled 1 Solidity file successfully


  Caller Contract Test Suits
[LOG] you called one function which not exist 
[LOG] address call return:  true
    ✔ 测试调用不存在的函数 (1080ms)
```



### 附加作用(不推荐的)

当没有`receive`函数, 并且 fallback() 为 payable时 (也就是`fallback() external payable`), 充当`receive`的角色.



## 2300gas

`receive` 和 `fallback` 由于并非用户明确调用, 所以gas是定死的2300, 那么不要在他们的函数体中做高消耗gas的操作, 记记日志就不错了:)





## DMEO代码

https://github.com/yinhui1984/imagehosting/blob/main/images/1669789488023678000.7z

下载后, 调用makefile: `make init`  来安装依赖



```makefile

.PHONY:  test

init:
	@echo "Initializing the project"
	npm init -y
	npm install hardhat
	npm install @nomicfoundation/hardhat-toolbox

compile:
	npx hardhat compile

test:
	@echo  "\033[31m运行使用js编写的测试用例\033[m" 
	@# 后面跟文件路径可以只运行某个测试文件， 比如 npx hardhat test ./test/ZombieAttack.test.js 
	npx hardhat test

```

