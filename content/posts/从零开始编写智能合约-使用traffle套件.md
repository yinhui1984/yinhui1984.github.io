---
title: 从零开始编写智能合约-使用traffle套件
author: yinhui
date: 2022-06-29
categories: [BlockChain]
tags: [solidity, truffle, ganache, ethereum, go-ethereum]     # TAG names should always be lowercase
math: false
mermaid: false
toc: true
---



这篇文章将带你使用traffle套件从零开始搭建环境, 编写、部署、测试和调用智能合约。

配套代码在 https://github.com/yinhui1984/HelloTruffle



<!--more-->

## 使用traffle套件

### 1. 安装node.js

https://nodejs.org/en/  

安装完成后, 查看是否版本以确保成功

```shell
npm -v
node -v
```

### 2. 安装truffle和Ganache

`truffle`是一套智能合约的开发测试环境 `Ganache`用于创建测试链(可以创建`ETH` `FILECOIN`等测试链), 用来跑自己创建的合约. 

https://trufflesuite.com  

#### 使用npm安装truffle

```shell
npm install -g truffle
```

安装完成后, 查看版本以确保成功

```shell
truffle version
```

> 如果遇到`permission denied: truffle` 找到truffle文件
>
> ```shell
> ll /usr/local/bin/truffle
> ```
>
> 可以看到其软连接到cli.bundled.js
>
> ```
> Permissions Size User       Date Modified Name
> lrwxr-xr-x    48 zhouyinhui 29 Jun 14:06   /usr/local/bin/truffle -> ../lib/node_modules/truffle/build/cli.bundled.js
> ```
>
> 给这个js加上执行权限即可
>
> ```shell
> chmod +x  /usr/local/lib/node_modules/truffle/build/cli.bundled.js
> ```

#### 安装Ganache

到这里直接下载即可  https://trufflesuite.com/ganache/





### 3. 使用truffle新建项目

新建一个目录, 比如`~/Downloads/truffleTest` 到这个目录下

```shell
OSX MP16 ~/Downloads/truffleTest ❯ truffle init 

Starting init...
================

> Copying project files to /Users/zhouyinhui/Downloads/truffleTest

Init successful, sweet!

Try our scaffold commands to get started:
  $ truffle create contract YourContractName # scaffold a contract
  $ truffle create test YourTestName         # scaffold a test

http://trufflesuite.com/docs
```

其新建了这些文件

```shell
OSX MP16 ~/Downloads/truffleTest ❯ tree 
.
├── contracts
│   └── Migrations.sol
├── migrations
│   └── 1_initial_migration.js
├── test
└── truffle-config.js
```

`contracts`文件夹存放合约的地方, 在其中新建一个solidity源码文件, 比如`Calculator.sol`

```shell
touch ./contracts/Calculator.sol
```



在`Calculator.sol`中添加如下代码来做个加减法

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Calculator {

    function add(int a, int b) public pure returns (int)  {
        return a + b;
    }

    function subtract(int a, int b) public pure returns (int) {
        return a - b;
    }
}
```

其中的`pure`表示改函数既不读也不写状态机变量  https://hashnode.com/post/pure-vs-view-in-solidity-cl04tbzlh07kaudnv1ial1gio

复制上面代码时注意 `pragma solidity ^0.8.0;`这一行和 `trffle-config.js`中的下面的配置相匹配

```json
  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.15",   
      //....
    },
  }
```

`pragma solidity ^0.8.0` 表示编译器使用`0.8`到`0.9`版本之间的(不包含`0.9`), 那么`trffle-config.js`中配置的编译器版本要在这个范围内

### 4.编译

```shell
truffle compile
```

```shell
OSX MP16 ~/Downloads/truffleTest ❯ truffle compile

Compiling your contracts...
===========================
> Compiling ./contracts/Calculator.sol
> Artifacts written to /Users/zhouyinhui/Downloads/truffleTest/build/contracts
> Compiled successfully using:
   - solc: 0.8.15+commit.e14f2714.Emscripten.clang
```



编译完成后, 会将结果放到`build`目录下: 我们这里关心的是`Calculator.json`

```shell
OSX MP16 ~/Downloads/truffleTest ❯ tree
.
├── build
│   └── contracts
│       ├── Calculator.json
│       └── Migrations.json
├── contracts
│   ├── Calculator.sol
│   └── Migrations.sol
├── migrations
│   └── 1_initial_migration.js
├── test
└── truffle-config.js

5 directories, 6 files
```



### 5.部署到测试链

#### 启动测试链

启动 `ganache` App, 点击`QUICKSTART` 其就自动创建了`ETH`测试链,  查看窗口上半部分显示的的RPC server信息, 比如 `HTTP://127.0.0.1:8545`  

修改 `truffle-config.js`中的部署配置, 使其与上面的RPC server向匹配

```
  networks: {
    //...
    development: {
     host: "127.0.0.1",     // Localhost (default: none)
     port: 8545,            // Standard Ethereum port (default: none)
     network_id: "*",       // Any network (default: none)
    },
```

{{< admonition >}}
请保持ganache在后台运行, 后面的代码都需要访问测试链
{{< /admonition >}}



#### 添加部署代码

```shell
 touch migrations/2_deploy_contracts.js
```

在`2_deploy_contracts.js`中加入如下代码

```js
var Calculator = artifacts.require("./Calculator.sol");

module.exports = function(deployer) {
    deployer.deploy(Calculator);
}
```



#### 部署合约

运行 `truffle migrate` 命令进行部署

```shell
OSX MP16 ~/Downloads/truffleTest ❯ truffle migrate 
Compiling your contracts...
===========================
> Everything is up to date, there is nothing to compile.


Starting migrations...
======================
> Network name:    'development'
> Network id:      5777
> Block gas limit: 6721975 (0x6691b7)


1_initial_migration.js
======================

   Deploying 'Migrations'
   ----------------------
   > transaction hash:    0xc4b0bf65cbac8d1cf68b72fc6408bd443c18e6bf3e44c5985dede50b191a80d1
   > Blocks: 0            Seconds: 0
   > contract address:    0xe2fd5fA1303B9791417EF637AABd50aE9DB9Af44
   > block number:        1
   > block timestamp:     1656490514
   > account:             0xe149d5f732685669C9E494B233fDB4312d19b5cF
   > balance:             99.99502292
   > gas used:            248854 (0x3cc16)
   > gas price:           20 gwei
   > value sent:          0 ETH
   > total cost:          0.00497708 ETH

   > Saving migration to chain.
   > Saving artifacts
   -------------------------------------
   > Total cost:          0.00497708 ETH


2_deploy_contracts.js
=====================

   Deploying 'Calculator'
   ----------------------
   > transaction hash:    0xc8cce4b870d187dadf38353e6ef71aabd0751375a2f2b8c763ed4a35d8067a0c
   > Blocks: 0            Seconds: 0
   > contract address:    0x6B62e4E253823FBC65E0B93d63ee149350158a18
   > block number:        3
   > block timestamp:     1656490515
   > account:             0xe149d5f732685669C9E494B233fDB4312d19b5cF
   > balance:             99.98984578
   > gas used:            216344 (0x34d18)
   > gas price:           20 gwei
   > value sent:          0 ETH
   > total cost:          0.00432688 ETH

   > Saving migration to chain.
   > Saving artifacts
   -------------------------------------
   > Total cost:          0.00432688 ETH

Summary
=======
> Total deployments:   2
> Final cost:          0.00930396 ETH
```



### 6. 测试合约

#### 使用truffle console 手动调用

运行 `truffle console` 打开控制台

```shell
truffle(development)> let cal = await Calculator.deployed()
truffle(development)> cal.add(1,2)
BN { negative: 0, words: [ 3, <1 empty item> ], length: 1, red: null }
truffle(development)> cal.subtract(10, 2)
BN { negative: 0, words: [ 8, <1 empty item> ], length: 1, red: null }
```

> 在控制台中可以使用TAB按键来提示成员变量或函数



#### 使用js编写单元测试

```sh
touch test/testCalculator.test.js 
```



```js
//testCalculator.test.js 

//开发框架导入合约
const Calculator = artifacts.require("Calculator");

//接下来，我们定义用于测试的合约，然后将账户作为包含所有地址的参数传递。
contract("Calculator", accounts => {
    //it包含对我们要运行的测试的简短描述，
    // 它是一个包含所有测试相关脚本的异步函数
    it("should add two numbers", async () => {
        //cal: 定义存储已部署合约的实例。
        const cal = await Calculator.deployed();
        const result = await cal.add(4, 2);
        assert.equal(result.toNumber(), 6);
    }).timeout(10000);

    it("should subtract two numbers", async () => {
        const cal = await Calculator.deployed();
        const result = await cal.subtract(3, 2);
        assert.equal(result.toNumber(), 1);
    }).timeout(10000);
});
```

运行 `truffle test` 跑测试

```shell
OSX MP16 ~/Downloads/truffleTest ❯ truffle test 

Using network 'development'.


Compiling your contracts...
===========================
> Everything is up to date, there is nothing to compile.


  Contract: Calculator
    ✔ should add two numbers
    ✔ should subtract two numbers (48ms)


  2 passing (126ms)
```



### 7. demoApp调用合约

#### 使用web3.js

我们使用`web3.js` 创建一个app来实际使用我们的合约

初始化一个node.js app

```sh
mkdir -p ./demo/jsApp
cd ./demo/jsApp/
npm init
```

然后一路默认回车

```shell
touch index.js
```

安装`web3.js`

```shell
npm install web3
```

在`index.js`中加入如下代码

```js

const Web3 = require('web3');
//注意，这里有个坑， 有时候http://localhost:8545 用localhost可以，有时候连接不上
//最好用127.0.0.1
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));

//web3.eth.getAccounts().then(console.log)

//modify the following line to your own contract address
let contractAddress = "0x6B62e4E253823FBC65E0B93d63ee149350158a18";

//copy abi from ./build/contracts/Calculator.json
let abi = [
    {
        "inputs": [
            {
                "internalType": "int256",
                "name": "a",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "b",
                "type": "int256"
            }
        ],
        "name": "add",
        "outputs": [
            {
                "internalType": "int256",
                "name": "",
                "type": "int256"
            }
        ],
        "stateMutability": "pure",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "int256",
                "name": "a",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "b",
                "type": "int256"
            }
        ],
        "name": "subtract",
        "outputs": [
            {
                "internalType": "int256",
                "name": "",
                "type": "int256"
            }
        ],
        "stateMutability": "pure",
        "type": "function",
        "constant": true
    }
]
let contract = new web3.eth.Contract(abi,contractAddress);

contract.methods.add(4,2).call().then(console.log);
contract.methods.subtract(3,2).call().then(console.log);


```

其中的 contractAddress是我们部署的`Caculator合约地址`

>**如何找到合约地址?**
>
>方式1, 在上面的`truffle migrate`进行合约部署时,会打印
>
>方式2,  在`Ganache`软件界面的`Transactions`中找, 貌似不方便
>
>方式3, 在`Ganache`软件界面 : `Settings` -> `Workspace` 中点击`ADD Project` 添加 `truffle-config.js`文件关联项目, 然后点击`RESTART`重新回到主界面的`CONTRACTS`就可以看到了
>
>方式4, 运行`truffle console` 
>
>```shell
>truffle(development)> Calculator.address
>'0x6B62e4E253823FBC65E0B93d63ee149350158a18'
>```
>
>

其中的`abi`是合约对应的abi

> **如何找到abi?**
>
> 方式1, `solc --abi ./contracts/Calculator.sol`
>
> 方式2, 到`./build/contracts/Calculator.json`中, 找到`"abi"`对应的值
>
> <font color=red>不要使用truffle console中的Calculator.abi</font>



运行app

```shell
OSX MP16 ~/Downloads/truffleTest/demo/jsApp ❯ node index.js 
6
1
```



#### 使用golang

```shell
mkdir -p ./demo/goApp
cd ./demo/goApp
touch main.go
go mod init goApp
```

需要使用到 `"github.com/ethereum/go-ethereum/ethclient"`这个包

```shell
go get "github.com/ethereum/go-ethereum/ethclient"
```

这个包如果要调用合约, 则需要一些额外的操作

**额外的操作: 利用 `abigen` 从`solidity`源文件生成`golang`代码**

```shell
OSX MP16 ~/Downloads/truffleTest/demo/goApp ❯ mkdir contracts
```

```shell
abigen --pkg contracts --sol ../../contracts/Calculator.sol --out  ./contracts/calculatorContract.go
```

+ --pkg contracts  : 指定生成的代码的 package name
+ --sol ../../contracts/Calculator.sol   : 指定合约代码位置
+ --out  ./contracts/calculatorContract.go: 指定生成的代码位置

生成完成后, goApp的目录结构如下:

```shell
tree ~/Downloads/truffleTest/demo/goApp 
/Users/zhouyinhui/Downloads/truffleTest/demo/goApp
├── contracts
│   └── calculatorContract.go
├── go.mod
├── go.sum
└── main.go

```

生成后的`calculatorContract.go`中import包,可能并不在`go.mod`中, 所以运行一次 `go mod tidy`以避免编译时找不到包

`main.go`中代码如下:

```go
package main

import (
	"fmt"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"goApp/contracts"
	"math/big"
)

//https://goethereumbook.org/client-setup/

func main() {

	client, err := ethclient.Dial("http://localhost:8545")
	if err != nil {
		fmt.Println("could not connect to local node, err:", err)
		return
	}

	contractAddress := common.HexToAddress("0x6B62e4E253823FBC65E0B93d63ee149350158a18")
	calculator, err := contracts.NewCalculator(contractAddress, client)
	if err != nil {
		fmt.Println("could not instantiate contract, err:", err)
		return
	}

	callOpts := bind.CallOpts{
		Context: nil,
		Pending: false,
	}
	a := big.NewInt(1)
	b := big.NewInt(2)
	result, err := calculator.Add(&callOpts, a, b)
	if err != nil {
		fmt.Println("could not call contract, err:", err)
		return
	}
	fmt.Println("add result:", result)

	result, err = calculator.Subtract(&callOpts, a, b)
	if err != nil {
		fmt.Println("could not call contract, err:", err)
		return
	}
	fmt.Println("subtract result:", result)
}

```



运行

```shell
OSX MP16 ~/Downloads/truffleTest/demo/goApp ❯ go run . 
add result: 3
subtract result: -1

```



## 手工撸

Coming Soon....
