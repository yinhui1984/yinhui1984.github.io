# Ethernaut 19 MagicNumber


ethernaut 挑战 第19题, 比较有意思, 记录一下

<!--more-->

这个系列的挑战的参考答案:  https://github.com/yinhui1984/EthernautGameReferenceAnswers



## 题目要求

```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MagicNum {

  address public solver;

  constructor() {}

  function setSolver(address _solver) public {
    solver = _solver;
  }

  /*
    ____________/\\\_______/\\\\\\\\\_____        
     __________/\\\\\_____/\\\///////\\\___       
      ________/\\\/\\\____\///______\//\\\__      
       ______/\\\/\/\\\______________/\\\/___     
        ____/\\\/__\/\\\___________/\\\//_____    
         __/\\\\\\\\\\\\\\\\_____/\\\//________   
          _\///////////\\\//____/\\\/___________  
           ___________\/\\\_____/\\\\\\\\\\\\\\\_ 
            ___________\///_____\///////////////__
  */
}
```

要求传递一个合约地址给`setSolver`函数,该合约满足如下要求:

题目会调用合约的`whatIsTheMeaningOfLife()`函数, 函数返回magicnumber, 题目中已经给出magicnumber的值是`42`了, 并且要求合约足够的小, codesize不能超过`10` (这是重点)



## 思路

### 不满足要求的合约

```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract WrongAnswer {
    function whatIsTheMeaningOfLife() public pure returns (uint256) {
        return 42;
    }
}
```

编译

```
 solc --bin-runtime ./WrongAnswer.sol

======= WrongAnswer.sol:WrongAnswer =======
Binary of the runtime part:
6080604052348015600f57600080fd5b506004361060285760003560e01c8063650500c114602d575b600080fd5b60336047565b604051603e91906067565b60405180910390f35b6000602a905090565b6000819050919050565b6061816050565b82525050565b6000602082019050607a6000830184605a565b9291505056fea264697066735822122094dfbe4a86b9ebcf9fceb03023a0ac85fa65d89f9775f2deb822b0ad74fdda2364736f6c63430008110033
```

这么多代码, 大小肯定超过10了

导入到 BinaryNinja, 看看到底干了些什么需要这么多代码

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1674111885834466000.png?raw=true)

可见其中产生了大量"普通合约"都需要的判断代码, 对于我们完成这次挑战而言, 这些代码都是不需要的.

我们需要的是"只要调用我们合约, 我就直接返回42"



### 手工撸操作码(和字节码)

#### 运行时代码

我们需要合约在运行时, 对于任何调用都简单粗暴地返回`42(0x2A)`

```
#将要返回的值0x2A存储到内存00位置
PUSH1 0x2A
PUSH1 0x00
MSTORE
#从内存取出值并返回
PUSH1 0x20
PUSH1 0x00
RETURN
```

> 其中要存储的内存位置在这个题目中不重要, 当在一个正常的合约中需要给合约预留一部分内存用于保存"free memory pointer"等 , 也就是为啥平时编译的普通合约的字节码总是60806040 (PUSH1 0x80 PUSH1 0x40)开头的

上面的代码就是我们合约运行时的代码(runtime code), 刚好code size 为 10

翻译成字节码为: `0x602a60005260206000f3`

> 操作码翻译成字节码, 可以在https://www.evm.codes/?fork=merge 对照手工翻译 
>
> 也可以使用工具 https://github.com/crytic/pyevmasm

#### 创建时代码

我们现在有了合约的运行时代码, 但还需要告诉EVM如何帮我们创建出该合约, 这就是创建合约时的初始化工作, 称为"creation time code", 比如初始化存储(虽然我们这里没有需要初始化的存储),将运行时代码放到区块链上等.

```
#运行时代码放到内存中
PUSH10 0x602a60005260206000f3
PUSH1 0
MSTORE
#将运行时代码返回给evm,告诉它我们的合约在实际运行时用的这个代码: 0x602a60005260206000f3
PUSH1 0xA
PUSH1 0x16
RETURN
```

> 平时我们使用`solc --bin`时输出的代码包含了创建时代码和运行时代码
>
> 使用`solc --bin-runtime`时只输出了运行时代码

上面的代码翻译成字节码: `0x69602a60005260206000f3600052600a6016f3`

这就是创建合约时需要告诉evm的全部代码, 里面包含了合约初始化时需要的代码和运行时需要的代码



#### 创建合约

创建合约时用到的操作码是 `CREATE`  https://www.evm.codes/?fork=merge

它需三个参数:

+ value: 创建时发送给新建账户的ether
+ offset: 初始化代码(含运行时代码)在内存上的起始位置
+ size: 初始化代码(含运行时代码)在内存上的大小

> 如果没有代码, 则创建的是普通外部账户

返回账户(合约)的地址

```
# save ini-code (runtime-code included in the ini-code) of new_account into memory
PUSH32 0x69602a60005260206000f3600052600a6016f3
PUSH1 0
MSTORE
# create new_account with  ini-code
# the new_account address will be put on the stack by CREATE
PUSH1 0x13
PUSH1 0xd
PUSH1 0
CREATE
# LOG out the new_account address
DUP1
PUSH1 0
PUSH1 0
LOG1
```

创建完成后, 我们将新合约地址以日志的方式输出

上面的操作码翻译成字节码为: 

`0x7f0000000000000000000000000069602a60005260206000f3600052600a6016f36000526013600d6000f08060006000a1`

这就是我们要解决该挑战所需要的所有字节码



## 部署合约和获取合约地址

继续手工撸

使用eth json rpc:

> 关于eth json-rpc: https://ethereum.org/zh/developers/docs/apis/json-rpc/

```bash
~ ❯ node=http://localhost:8545
~ ❯ bytecode=0x7f0000000000000000000000000069602a60005260206000f3600052600a6016f36000526013600d6000f08060006000a1
~ ❯ sender_address=$(curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_accounts","params":[],"id":1}' $node | jq -r '.result[0]')
~ ❯  receipt=$(curl -s -X POST --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getTransactionReceipt\",\"params\":[\"$tx_hash\"],\"id\":1}" $node)
~ ❯ echo "receipt:\n$receipt"
receipt:
{"id":1,"jsonrpc":"2.0","result":{"transactionHash":"0xd8417440d0172b80fe53bda4c1842535c8043a276c7bfc2c8e8fca4993996b4d","transactionIndex":"0x0","blockNumber":"0x6e","blockHash":"0xc592afe3a765a8592257ea0c26fcb2c36ed2253f1333a92b89cfab1a1df9da84","from":"0x394026b8a8b7477ed47380da688bc5380b20096e","to":null,"cumulativeGasUsed":"0x15916","gasUsed":"0x15916","contractAddress":"0xba18e0ee28dc90beebeb175001c8c658aeafc855","logs":[{"address":"0xba18e0ee28dc90beebeb175001c8c658aeafc855","blockHash":"0xc592afe3a765a8592257ea0c26fcb2c36ed2253f1333a92b89cfab1a1df9da84","blockNumber":"0x6e","data":"0x","logIndex":"0x0","removed":false,"topics":["0x000000000000000000000000436526bd095c7d3109d9055fa854fe739eb8b5a4"],"transactionHash":"0xd8417440d0172b80fe53bda4c1842535c8043a276c7bfc2c8e8fca4993996b4d","transactionIndex":"0x0"}],"logsBloom":"0x00000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000008000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000004000","status":"0x1","effectiveGasPrice":"0x2fb","type":"0x2"}}
```



注意到日志中的 `0x000000000000000000000000436526bd095c7d3109d9055fa854fe739eb8b5a4` 删除掉非地址部分的0, 得到我们的新建的合约地址 `0x436526bd095c7d3109d9055fa854fe739eb8b5a4`

在浏览器console中

```js
contract.setSolver("0x436526bd095c7d3109d9055fa854fe739eb8b5a4")
```

DONE!



## 参考过程

```
redux-logger.js:1  action SET_BLOCK_NUM @ 16:09:27.395
contract.setSolver("0x436526bd095c7d3109d9055fa854fe739eb8b5a4")
Promise {<pending>, _events: Events, emit: ƒ, on: ƒ, …}
^^.js:140 ⛏️ Sent transaction ⛏ undefined/tx/0x4c857aba0d8411943ff92749de816ef573ee4b2af1690694e6f7297a44e784d4
^^.js:140 ⛏️ Mined transaction ⛏ undefined/tx/0x4c857aba0d8411943ff92749de816ef573ee4b2af1690694e6f7297a44e784d4
^^.js:45 (●*∩_∩*●) 正在提交关卡实例... <  < <<请稍等>> >  >
redux-logger.js:1  action SUBMIT_LEVEL_INSTANCE @ 16:09:45.461
redux-logger.js:1  action SET_BLOCK_NUM @ 16:09:47.487
^^.js:140 ⛏️ Sent transaction ⛏ undefined/tx/0x73992fbed5a4d9df155727e7b1b072eab65252c139a141a0a5431788c7a14be0
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:140 ⛏️ Mined transaction ⛏ undefined/tx/0x73992fbed5a4d9df155727e7b1b072eab65252c139a141a0a5431788c7a14be0
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:73 |[●▪▪●]| 牛逼！, 你通过了这关!!!
^^.js:56 
redux-logger.js:1  action SET_BLOCK_NUM @ 16:09:57.389

```


