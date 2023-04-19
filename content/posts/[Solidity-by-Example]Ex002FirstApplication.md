---
title: "[Solidity by Example]Ex002FirstApplication"
date: 2022-08-10T14:14:38+08:00
draft: true
author: yinhui
categories: [Blockchain]
tags: [solidity] 
---

https://solidity-by-example.org 中的第二个练习, 并添加了注释



<!--more-->



## 习题

https://solidity-by-example.org/first-app/



## 注释

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Ex002FirstApplication {

    //1.
    // external - 外部函数是用来被其他合约调用的。它们不能用于内部调用。要在合约中调用外部函数，需要调用this.function_name()。状态变量不能被标记为外部变量。
    // public   - 公共函数/变量可以在外部和内部使用。对于公共状态变量，Solidity自动创建一个getter函数。
    // internal - 内部函数/变量只能由内部或派生合约使用。
    // private  - 私有函数/变量只能在内部使用，甚至不能被派生合约使用。

    //这个例子中有了get()函数, 可能count设置为private 或 internal 更恰当
    //类型 参考这里 https://docs.soliditylang.org/en/v0.8.14/types.html
    // 或 https://solidity-cn.readthedocs.io/zh/develop/types.html
    uint public count;

    //2.
    // solidity 中函数可以用作变量赋值,参数传递等
    // 函数分为内部/外部函数, 也就是external和internal, 默认是internal可以不写
    // pure	不读数据, 也不写数据 不改变虚拟机状态
    // view	读数据, 但不写数据	不改变虚拟机状态
    // payable	支付, 写数据	改变虚拟机状态
    // 参考这里  https://yinhui1984.github.io/对智能合约的读方法和写方法的调用/
    function get() public view returns (uint){
        return count;
    }

    //3.
    //与参数类型相比，返回类型不能为空——如果函数类型不应该返回任何内容，则整个返回 (<return types> ) 部分必须省略。
    //没有明确指明 pure view payable 则默认要改变虚拟机状态
    function inc() public {
        count += 1;
    }

    function dec() public {
        count -= 1;
    }
}

```

## 合约调用

```js
import Web3 from "web3"
import net from "net"
import * as fs from "fs"

const web3 = new Web3(new Web3.providers.IpcProvider("../mychain/data/geth.ipc", net))

const contractName = "Ex002FirstApplication"
const abi = JSON.parse(fs.readFileSync("../contracts/build/"+contractName+".abi").toString())
const address = fs.readFileSync("../contracts/"+contractName+".address").toString()

const contract = new web3.eth.Contract(abi,address)

async function test(){

    let accounts = await web3.eth.getAccounts()
    let account = accounts[0]


    await contract.methods.get().call().then(x => console.log("current value:" + x))

    //对inc调用call(), 并不会生效
    await contract.methods.inc().call().then(()=>{
        contract.methods.get().call().then(x => console.log("after call inc(), current value:" + x))
    })

    //对于改变状态机的函数, 要调用send()
    await contract.methods.inc().send({from:account, gas:3000000}).then(()=>{
        contract.methods.get().call().then(x => console.log("after send inc(), current value:" + x))
    })

    //如果值为0,再调用inc()会报错
    await contract.methods.dec().send({from:account, gas:3000000}).then(()=>{
        contract.methods.get().call().then(x => console.log("after send dec(), current value:" + x))
    }).catch(e => console.log("\n\ncatch an error : \n "+e))

    return new Promise((resolve) => {
        setTimeout(()=>{
            resolve()
        } , 5000)
    })
}

test().then(()=>{
    process.exit(0)
})



```



## 输出

```
current value:0
after call inc(), current value:0
after send inc(), current value:1
after send dec(), current value:0
```



## github

https://github.com/yinhui1984/Explain-of-Solidity-by-Example
