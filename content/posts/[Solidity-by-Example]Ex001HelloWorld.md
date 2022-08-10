---
title: "[Solidity by Example]Ex001HelloWorld"
date: 2022-08-10T08:44:36+08:00
draft: false
author: yinhui
categories: [BlockChain]
tags: [solidity] 
---



https://solidity-by-example.org 中的第一个练习, 并添加了注释



<!--more-->



## 习题:

https://solidity-by-example.org/hello-world/



## 注释

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//1.
// 许可证标识符 SPDX-License-xxx: xxx
// Solidity 0.6.8 引入了 SPDX 许可证标识符，因此开发人员可以指定合约使用的许可证 。
// 许可证列表参考这个表 https://spdx.org/licenses/
// 如果许可证标识符未包含在合约文件中，编译器现在将显示警告
// 如果包含了多个许可证标识符，编译器将报错



//2.
// pragma solidity xxx
// pragma solidity 用于指定合约的 Solidity 编译器版本
// 如果指定了不支持的 Solidity 版本，编译器将报错
// 如果指定了多个 Solidity 版本，编译器将报错
// 如果没有指定，则使用默认的 Solidity 版本
// pragma 指令始终位于源文件的本地，因此如果要在整个项目中启用它，则必须将 pragma 添加到所有文件中。
// 如果您导入另一个文件，该文件中的编译指示不会自动应用于导入文件。
// 例子:
//pragma solidity 0.6.12  - 只用0.6.12版本的编译器编译
//pragma solidity ^0.6.12 - 大于等于0.6.12版本, 但小于0.7.0版本的编译器
//pragma solidity >=0.4.0 <0.6.0 - 在 大于等于0.4.0 和 小于0.6.0之间的编译器都可以



//3.
// contract XXX
// 合约声明, Solidity合约是一个代码（其功能）和数据（其状态）的集合。部署后其会驻留在区块链上的一个地址上.

//4.
// string public greet = "Hello World!"; 声明了一个字符串变量, 参考这里 https://www.tutorialspoint.com/solidity/solidity_strings.htm
// external - 外部函数是用来被其他合约调用的。它们不能用于内部调用。要在合约中调用外部函数，需要调用this.function_name()。状态变量不能被标记为外部变量。
// public   - 公共函数/变量可以在外部和内部使用。对于公共状态变量，Solidity自动创建一个getter函数。
// internal - 内部函数/变量只能由内部或派生合约使用。
// private  - 私有函数/变量只能在内部使用，甚至不能被派生合约使用。

contract Ex001HelloWorld {
    string public greet = "Hello World!";
}


```



## 合约调用 

```js
import Web3 from "web3";
import net from "net";
import * as fs from "fs";
const web3 = new Web3(new Web3.providers.IpcProvider("../mychain/data/geth.ipc", net));


const contractName = "Ex001HelloWorld";

// read the contract abi from the file
let abi = JSON.parse(fs.readFileSync("../contracts/build/"+contractName+".abi").toString());
// read the contract address from the file
const address = fs.readFileSync("../contracts/"+contractName+".address").toString();
// create the contract object
const contract = new web3.eth.Contract(abi, address);

// get the value of  the field "greet"
contract.methods.greet.call().call().then((e) => {
    console.log(e);
    process.exit(0);
});

```



## Github

https://github.com/yinhui1984/Explain-of-Solidity-by-Example

