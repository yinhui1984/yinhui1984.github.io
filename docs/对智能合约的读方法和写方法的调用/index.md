# 对智能合约的读方法和写方法的调用




介绍了调用智能合约中"读方法"与"写方法"的区别

<!--more-->



##  方法(函数)的分类

智能合约中的方法可以粗暴的分为两类:

1. 不会改变虚拟机状态的方法
2. 会改变虚拟机状态的方法

假设我们将他们称为"读方法"和"写方法", 那么读方法而言, 其是不会创建交易和花费`GAS`的, 是免费的.  对于写方法而言, 需要收取'手续费'进行挖矿的.

| 关键字       | 描述                 | 改变虚拟机状态? |
| ------------ | -------------------- | --------------- |
| pure         | 不读数据, 也不写数据 | NO              |
| view         | 读数据, 但不写数据   | NO              |
| payable      | 支付以太, 肯定写数据 | YES             |
| 未明确指示的 | 其它可能写数据的     | YES             |



## Web3.js的 call() 与Send()

对于上面两类方法, `Web3.js`中分别对应`Call`方法和`Send`方法来进行调用

|        | 创建交易 | 改变虚拟机状态 |
| ------ | -------- | -------------- |
| Call() | NO       | NO             |
| Send() | YES      | YES            |

实际上从语法层面上而言, 无论是读方法还是写方法, 都可以调用 `call` , 但对于写方法, 调用`call`虚拟机状态并不会改变, 并且不会报错.



## 举例

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract temp {
    int private counter;

    function add() public {
        counter ++;
    }

    function get() public view returns(int){
        return counter;
    }
}
```



调用代码

```js
const base = require('./base');

const c = base.initContract('temp');

async function test(){

    await c.methods.get().call().then(x=>{
        console.log("current value:", x);
    })

    await  c.methods.add().call()

    await c.methods.get().call().then(x=>{
        console.log("after call add(): current value:", x);
    })

    let accounts = await base.web3Instance.eth.getAccounts();
    await c.methods.add().send({from: accounts[0], gas: 3000000})

    await c.methods.get().call().then(x=>{
        console.log("after send add(): current value:", x);
    })
}

test()
```



输出

```shell
current value: 0
after call add(): current value: 0
after send add(): current value: 1
```

>可以看到使用 `call` 调用 `add()`后 值并没有变, 而用 `send`调用`add()`后, 值被累加1





## web3.py

`web3.py` 中对应的是 `call()`和`transact()`

