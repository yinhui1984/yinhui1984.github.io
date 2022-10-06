# EVM




一些关于EVM的学习笔记

<!--more-->

## 什么是EVM

在`web3`的的L0中, 涉及到一个概念 `Platform neutral language` (有些地方也写做 `Platform-neutral computation description language `) 平台中立的计算描述语言, 指一种在不同物理平台（架构、操作系统等）上执行相同程序的方法。

我们知道, 任何一个区块链都需要N个节点按照一定的规则来执行相同的运算, 可以想象成一个平台, 这个平台和硬件以及编程语言都不是强相关的, 在以太坊中, 其采用了虚拟机的形式. 它和我们平时用的VMware有些类似, 但又不同, 因为EVM是分布式的. 另外, 我们很多时候讨论EVM更多的是说的一套规则, 而不是某个具体的EVM实现, EVM的具体实现有很多, 比如golang实现的[go-ethereum](https://github.com/ethereum/go-ethereum) , c++实现的[cpp-ethereum](https://github.com/ethereum/cpp-ethereum)  等等, 更多的参考这里: https://github.com/pirapira/awesome-ethereum-virtual-machine

简言之, EVM提供了一个虚拟的沙盒环境, 为以太坊区块链提供了 一系列的功能



## EVM的主要功能

### 分布式数据库

在其最基本的形式中，以太坊虚拟机是一个大型的分布式数据库，

1. 用于保存以太坊的所有账户和余额 . 

> 注: 以太坊使用的账户/余额模型,  而不是BTC的[UTXO](https://yinhui1984.github.io/utxo/)

基于账户的交易模式将资产表示为账户内的余额，类似于银行账户。以太坊使用这种交易模式。有两种不同类型的账户:

+ 私钥控制的用户账户
+ 合约代码控制的账户。

当你创建一个以太币钱包并收到你的第一笔交易时，一个私钥控制的账户被添加到全局状态并存储在网络上的所有节点。部署一个智能合约会导致创建一个代码控制的账户。智能合约可以自己持有资金，它们可以根据合约逻辑中定义的条件重新分配。以太坊的每个账户都有一个余额、存储空间，以及用于调用其他账户或地址的代码空间。

基于账户的模型中的交易会触发节点减少发送方账户的余额，增加接收方账户的余额。为了防止重放攻击，账户模型中的每笔交易都附有一个非授权码。重放攻击是指受款人广播一个欺诈性的交易，他们在其中获得第二次付款。如果欺诈性交易成功，该交易将被第二次执行--它被重放--并且发送者将被收取两倍于他们想要转移的金额。

为了打击这种行为，以太坊的每个账户都有一个公开的可查看的nonce，该nonce在每笔流出的交易中都会被递增1。这可以防止同一交易被多次提交给网络。

在账户模型中，交易费用的工作方式也有所不同。它们是根据完成状态转换所需的计算次数来计算的。以太坊的出发点是成为一个世界计算机。因此，他们决定，费用应该基于消耗的计算资源数量，而不是所占用的存储容量。

账户模型将所有余额作为一个全局状态进行跟踪。这个状态可以理解为所有账户、私钥和合约代码的数据库，以及他们在网络上不同资产的当前余额的控制。

2. 用于保存智能合约

以太坊在链上有合约（称为智能合约），即代码被编译成字节码，产生的字节在交易中被发送，以坚持到以太坊区块链上。这在你部署智能合约时完成一次。在这之后，人们可以与智能合约与其他交易互动。



> 注: 关于数据存储, 以太坊区块链上并不适合大量数据存储, 参考这篇论文:
>
> [Exploring Ethereum’s Data Stores: A Cost and Performance Comparison](https://arxiv.org/pdf/2105.10520.pdf)



### 分布式状态机

从基本层面上而言, ETH区块链是一个由交易和共识驱动的状态机, 状态需要永久地存储在区块链上.

随着交易的进行, 区块链会不断更新状态, 这里的状态有两种:

1. 世界状态(World State): 以太坊地址和账户状态的映射
2. 账户状态(Account State): 由4个字段组成
   + Nonce: 一个值, 每次从该地址发送交易时都会递增
   + 余额:  这个值代表weis的数量，weis是以太坊中最小的货币单位（wei），由给定地址持有
   + Storage root : 这个字段代表一个MPT的根节点，编码账户的存储内容
   + Code hash:  这是一个不可变的字段，包含与账户相关的智能合约代码的哈希值。 在普通账户的情况下，这个字段包含空字符串的Keccak 256位哈希值

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1665023633967943000-B15726_11_09.png?raw=true)



> 平时区分一个操作是否会改变区块链的状态, 可以简单地看改操作是否花费gas, 如果不花费gas则其不会改变. 对应到代码层面则参考: [https://yinhui1984.github.io/对智能合约的读方法和写方法的调用/](https://yinhui1984.github.io/对智能合约的读方法和写方法的调用/)



### 世界计算机

ETH最大的创新点是智能合约. 也就是我们可以编写程序代码来交给每个采矿节点上的EVM进行执行.

编写代码所使用的编程语言可以是 [Solidity](https://github.com/ethereum/solidity)  [LLLL](https://github.com/mmalvarez/eth-isabelle/blob/master/example/LLLL.thy) 等, 参考:

https://github.com/pirapira/awesome-ethereum-virtual-machine#programming-languages-that-compile-into-evm 

但一般指的都是 [Solidity](https://github.com/ethereum/solidity), EVM并不能直接执行Solidity，首先必须将代码编译成较低级别的机器指令，称为操作码(Opcodes)

#### Solidity 与 Opcodes

EVM被广泛地标记为[图灵完备](https://en.wikipedia.org/wiki/Turing_completeness#:~:text=在口语化的用法中%2C的术语,目的计算机或计算机语言。)或更准确地说是准图灵完备。这意味着，EVM在理论上可以解决任何计算问题。这是通过执行称为EVM操作码的机器级指令来实现的。

EVM操作码协助EVM完成智能合约或交易的具体任务。目前，EVM大约有150个操作码可以执行。它们涵盖了一系列的操作，包括：算术、停止、记录、复制、推送、内存、比较和交换。以及用于检索块和环境信息。你可以找到一个操作代码的列表[这里](https://ethereum.org/en/developers/docs/evm/opcodes/)。

举一个HelloWorld的例子

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Ex001HelloWorld {
    string public greet = "Hello World!";
}
```

使用`solc`进行编译:

```bash
solc --bin --abi --optimize --overwrite -o ./output ./hello.sol
```

我们得到的\*.abi和\*.bin文件, 其中 bin只是编译后的字节码的紧凑二进制表示。操作码不是由PUSH、PULL或DELEGATECALL引用的，而是它们的二进制表示，用文本编辑器读取时看起来像随机数字。

```
cat Ex001HelloWorld.bin
60c0604052600c60809081526b48656c6c6f20576f726c642160a01b60a05260009061002b90826100dd565b5034801561003857600080fd5b5061019c565b634e487b7160e01b600052604160045260246000fd5b600181811c9082168061006857607f821691505b60208210810361008857634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156100d857600081815260208120601f850160051c810160208610156100b55750805b601f850160051c820191505b818110156100d4578281556001016100c1565b5050505b505050565b81516001600160401b038111156100f6576100f661003e565b61010a816101048454610054565b8461008e565b602080601f83116001811461013f57600084156101275750858301515b600019600386901b1c1916600185901b1785556100d4565b600085815260208120601f198616915b8281101561016e5788860151825594840194600190910190840161014f565b508582101561018c5787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b61019a806101ab6000396000f3fe608060405234801561001057600080fd5b506004361061002b5760003560e01c8063cfae321714610030575b600080fd5b61003861004e565b60405161004591906100dc565b60405180910390f35b6000805461005b9061012a565b80601f01602080910402602001604051908101604052809291908181526020018280546100879061012a565b80156100d45780601f106100a9576101008083540402835291602001916100d4565b820191906000526020600020905b8154815290600101906020018083116100b757829003601f168201915b505050505081565b600060208083528351808285015260005b81811015610109578581018301518582016040015282016100ed565b506000604082860101526040601f19601f8301168501019250505092915050565b600181811c9082168061013e57607f821691505b60208210810361015e57634e487b7160e01b600052602260045260246000fd5b5091905056fea26469706673582212208a0be23ced512b2079cbbc853392d671d17da38eaa87497f70ad2b7ef259ae1b64736f6c63430008110033
```

如果我们使用`evm`来反汇编, 就可以看到

```shell
evm disasm Ex001HelloWorld.bin
```



```
evm disasm Ex001HelloWorld.bin
...
00000: PUSH1 0xc0
00002: PUSH1 0x40
00004: MSTORE
00005: PUSH1 0x0c
00007: PUSH1 0x80
00009: SWAP1
0000a: DUP2
0000b: MSTORE
0000c: PUSH12 0x48656c6c6f20576f726c6421
00019: PUSH1 0xa0
0001b: SHL
0001c: PUSH1 0xa0
0001e: MSTORE
0001f: PUSH1 0x00
00021: SWAP1
00022: PUSH2 0x002b
00025: SWAP1
...
```

其中的`0x48656c6c6f20576f726c6421` 就是 `Hello World!`字符串

部署合约:

```python
#!/usr/bin/env python3

from web3 import Web3  # pip3 install web3
import solcx  # pip3 install py-solc-x

w3 = Web3(Web3.IPCProvider('../mychain/data/geth.ipc'))
print('Connected to Ethereum client: %s' % w3.clientVersion)

src = '../contracts/Ex001HelloWorld.sol'
contract_src = open(src).read()
print(contract_src)

compiled_sol = solcx.compile_source(contract_src, output_values=['bin', 'abi'])
contract_interface = compiled_sol['<stdin>:Ex001HelloWorld']

Ex001HelloWorld = w3.eth.contract(abi=contract_interface['abi'], bytecode=contract_interface['bin'])
w3.eth.default_account = w3.eth.accounts[0]
tx_hash = Ex001HelloWorld.constructor().transact()
tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
print("tx_receipt:\n %s" % tx_receipt)
print("-----------------------------------------------------")
print("合约地址:" + tx_receipt.contractAddress)

# write the contract address to a file
with open("../contracts/Ex001HelloWorld.address", "w") as f:
    f.write(tx_receipt.contractAddress)
    f.close()
```



调用合约

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



大体流程可以用下图表示:

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1665026182729146000-62200da42c402a5326990b36_rEl7cW1Opu3_7T91NDwUH81oWJJY6M9ksop7shhO_BMVGQ2emHYaAeqL5SKVbvXPDSjpyAziiE40F7smnSF0uw1rIbKGxeq8L2m8T_E7adHoxE7z9wNIxdkTwQuFVY-xmArgqKU.jpeg?raw=true)



#### gas

gas的目的是作为每个以太坊节点所做的智能合约的计算操作的费用。需要有计算费用，以防止攻击者通过部署大量需要长时间计算的复杂合约，使网络陷入停顿。这种类型的DDoS攻击的运行成本很高(需要很多gas).

每个操作码都有一个gas成本分配给它，更复杂的操作码有更高的成本。例如，简单的加法需要3个gas，每笔交易的成本为21,000个gas.

关于gas成本计算: 参考这里  https://github.com/wolflo/evm-opcodes/blob/main/gas.md

```
gas费 = 消耗的gas总量 x gas价格 
```

gas费是为了补偿验证人，验证人负责确保交易中的信息是有效的，没有来自EVM的错误/例外，并且发送方确实有必要的资金来支付计算。当一个发件人设置了一个高的gas限制，它表明操作是复杂的，这激励验证者为获得高额回报而拾取交易

当网络活动较多时，验证者可以简单地从具有较高gas限额的待定交易池中选择。因此，gas费受到供求关系的影响。好的是，任何未消耗的gas都会退还给发送者。

如果达到了预付的gas限额，验证人的工作仍会得到补偿，但交易不会完成。这也就是为啥说EVM是准图灵完备的，因为它能完成的计算被限制在发件人愿意支付的金额



## EVM的主要问题

EVM是区块链行业的一项突破性创新，因为它使我们所知的dApps成为可能。同时，一些专家注意到它的[设计缺陷](https://medium.com/hackernoon/the-evm-is-fundamentally-unsafe-d69f2e3b908b)。

1. 字节码不是人类可以阅读的。这使得开发人员和独立观察员很难分析和验证智能合约代码。

2. 难以调试。这是上一点的直接后果：你必须将字节码反编译成人类可读的形式，以了解dApp出了什么问题。

3. 它的速度很慢，而且要收取大量的gas。**注意，[EVM的速度](https://ethresear.ch/t/evm-performance/2791)是指每秒处理的操作码数量，所以它与以太坊区块链处理交易的能力不一样**--以太坊区块链的速度也很慢，每秒15笔交易。

4. 它不够安全。EVM应该保护区块链和dApps免受 "坏 "代码的影响。然而，我们不断看到新的智能合约漏洞。特别危险的是重入式攻击，当黑客重复调用提款函数以耗尽合约的资金时。

5. 合约是不可升级的。一旦你发现什么地方出了问题，你就无法修复它，因为以太坊智能合约在部署后不能被改变。你必须从头开始，部署一个新的合约，迁移用户等等。

6. EVM不支持本地库。库是一组与虚拟机一起分发的标准合约。开发人员可以使用库中的现成项目，而不是从头开始编写所有的代码，从而节省大量的时间。对于智能合约，使用库也可以节省gas--也就是节省金钱。但由于EVM默认不包括任何标准库（例如，不像Move VM），编写和部署智能合约变得非常昂贵。



## 趋势

WebAssembly

使用`WebAssembly`(ETH的WebAssembly叫eWASM)代替`EVM`


