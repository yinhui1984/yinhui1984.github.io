---
title: "Uniswap"
date: 2023-03-13T09:53:56+08:00
draft: false
author: yinhui
categories: [Blockchain]
tags: [swap,L3,Web3.0] 
---

uniswap API 解释与举例

<!--more-->





## 名词解释

+ Uniswap lab: 开发Uniswap协议的公司，同时也开发了网络界面。
+ Uniswap Protocol: 一套持久的、**不可升级**的智能合约，共同创建了一个自动做市商，该协议促进了以太坊区块链上ERC-20代币的点对点做市和交换。
+ [Uniswap Interface:](https://app.uniswap.org/#/swap) 一个网络界面，允许与Uniswap协议轻松互动。该界面只是人们与Uniswap协议互动的众多方式之一。
+ Uniswap Governance: 用于管理Uniswap协议的治理系统，由UNI代币启用。



### Fee-On-Transfer Tokens

手续费转移代币（Fee-On-Transfer Tokens）是一种特殊类型的代币，其主要特点是在代币转移的同时，会从转移金额中抽取一定比例的代币作为手续费，并将这部分代币转移给代币的持有者或其他地址。

这种代币主要用于在代币交易过程中收取手续费，而不需要代币交易双方自行支付手续费。通常，这种代币的手续费率是在交易发生时动态计算的，通常以固定比例或动态算法的形式进行计算。手续费可以用于维护代币的生态系统，支持开发者、社区等。

在 Uniswap 中，如果一个代币是 Fee-On-Transfer Tokens，那么在将其从流动性池中移除时，需要根据代币在池子中的比例计算手续费，并将其转移到 Uniswap 协议的费用池中。这样，就可以避免在代币交易时需要交纳手续费的麻烦，使得代币交易更加方便快捷。

一些实际存在的 Fee-On-Transfer Tokens 包括：Safemoon、Reflect.finance、Moonrat、ElonGate等。

以 Safemoon 为例，Safemoon 是一种基于 Binance Smart Chain 的 Fee-On-Transfer Tokens，其交易手续费为 10%，其中 5% 作为交易流动性提供者的奖励，5% 作为持有者的奖励。当持有者在交易时出售 Safemoon 代币时，交易中的 10% 会被抽取为手续费，其中 5% 会自动流向交易对的流动性池子，另外 5% 会按比例分配给 Safemoon 的所有持有者。

Reflect.finance 是另一个 Fee-On-Transfer Tokens，它的交易手续费是 2%。在交易时，2% 的代币会被抽取为手续费，其中 1% 将会自动流向交易对的流动性池，另外 1% 会按比例分配给所有的持有者。

这些代币的特点是：在代币转移的过程中，一定比例的代币会被抽取为手续费，并按照一定的规则进行分配。这种设计可以激励代币持有者长期持有代币，并有助于代币的价格稳定性。



## uniswap 协议

https://docs.uniswap.org/concepts/uniswap-protocol

Uniswap协议是一个点对点系统，旨在交换以太坊区块链上的加密货币（ERC-20代币）。该协议被实现为一套持久的、不可升级的智能合约；旨在优先考虑抗审查、安全、自我监护，并在没有任何可信任的中介机构可能选择性地限制访问的情况下运作。



uniswap使用自动做市商（AMM, Auto Market Making），有时被称为恒定功能做市商，来代替订单簿(order book)。

**AMM用两种资产的流动性池取代了订单簿市场上的买卖订单，这两种资产都是相对于对方的价值。当一种资产被交易为另一种资产时，两种资产的相对价格就会发生变化，两种资产的新市场价格就会确定**。在这种动态中，买方或卖方直接与资金池进行交易，而不是与其他各方留下的具体订单进行交易。



### uniswap V1

交易是针对智能合约或流动性池的，一个数学公式决定了资产的价格。流动性提供者向帮助做市的池子增加流动性。

在Uniswap流动性池中，交易资产对的比例应该是恒定的。其数学表达式为

```
X * Y = K

X :第一种资产的储备

Y : 第二中资产的储备
```

流动性提供者应以K的方式增加流动性，使其不发生变化。

![https://miro.medium.com/max/1050/1*CLjUpP1efeDdXeU-dJRBJw.png](https://miro.medium.com/max/1050/1*CLjUpP1efeDdXeU-dJRBJw.png)

Uniswap v1只支持ETH-ERC 20对的互换。如果用户希望将USDC换成DAI，第一步是将USDC换成ETH，然后兑换ETH-DAI，得到DAI。Uniswap v1还促进了LP代币的概念。当流动性提供者（LPs）向任何池子增加流动性时，他们会收到代表增加的流动性的LP代币。然后，这些LP代币可以被押注或燃烧，以赎回奖励。为了奖励流动性提供者，会产生0.3%的交易费。



### uniswap V2

Uniswap v1的主要缺点是 "ETH桥接 "问题，即缺乏ERC20-ERC20代币池。这导致了当用户想要交换一个ERC20代币时，成本上升和高滑点(high slippage)

Uniswap v2在用户界面和体验上比v1好得多。同时，它通过引入ERC20-ERC20池的概念，消除了ETH桥接的问题。另一个重要的区别是在核心合约中使用wrapped ETH，而不是原生ETH。然而，交易者可以通过辅助合约使用ETH。

![https://miro.medium.com/max/1050/1*HeCiFcK_4LjKmK14Iy37BQ.png](https://miro.medium.com/max/1050/1*HeCiFcK_4LjKmK14Iy37BQ.png)

Uniswap v2的闪电互换(`FlashSwap`)概念允许用户提取任何数量的ERC20代币，而不需要预先付款。但他们可以为提取的代币付款，或支付一部分并归还其余部分，或归还所有提取的代币。这些事情可以在交易执行结束时进行。

Uniswap v2还引入了协议费。社区治理在开启/关闭这项费用方面起着至关重要的作用。0.3%的交易费中的0.05%的协议费将被保留给塑造网络路线图的Uniswap平台的发展。



### uniswarp V3

Uniswap v3旨在超越基于稳定币的AMM和集中式交易所，提供更好的资本效率和准确性，更灵活的收费结构，以及流动性提供者根据自己的喜好建立独特的价格曲线的能力。Uniswap v3还允许LPs在自定义的价格范围内集中他们的资本，增强所需价格的流动性，并在市场超出LP指定的价格范围时自动从池中移除流动性。Uniswap v3的收费结构是由社区管理的，包括三个不同的收费等级。



## V2合约

### Facotry

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/factory

在 Uniswap 协议中，Factory 是指 Uniswap 的工厂合约，它是创建 Uniswap 市场的主要合约。它的作用是充当中央化的市场制造商，允许任何人在 Uniswap 上创建自己的交易对，例如 ETH/DAI 或 USDC/DAI 等。

当一个用户想要创建一个新的交易对时，他们会将资产添加到 Liquidity Pool 中，这个过程会触发 Factory 合约，Factory 合约会根据输入的两种资产类型的地址创建一个新的交易对，并将 Liquidity Pool 添加到新创建的交易对中。Factory 合约还负责为每个新的交易对创建对应的交易对合约，以便交易对的交易可以被执行。

#### 地址

 [0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f](https://etherscan.io/address/0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f#code)



#### 接口

```solidity
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
```

```js
import IUniswapV2Factory from '@uniswap/v2-core/build/IUniswapV2Factory.json'
```

```solidity
pragma solidity >=0.5.0;

interface IUniswapV2Factory {
  event PairCreated(address indexed token0, address indexed token1, address pair, uint);

  function getPair(address tokenA, address tokenB) external view returns (address pair);
  function allPairs(uint) external view returns (address pair);
  function allPairsLength() external view returns (uint);

  function feeTo() external view returns (address);
  function feeToSetter() external view returns (address);

  function createPair(address tokenA, address tokenB) external returns (address pair);
}
```



> 下面所有的举例都假设你设置了 ETH_RPC_URL=<mainnet> 环境变量

##### event PairCreated

```solidity
event PairCreated(address indexed token0, address indexed token1, address pair, uint);
```



##### allPairs

获取第N个交易对

```solidity
function allPairs(uint) external view returns (address pair);
```

举例:

```shell
# 返回第1个pair的地址: 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc
cast call 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f  "allPairs(uint)(address)" 0

# 返回pair的token0的地址: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
cast call 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc "token0()(address)" 

# 返回token0名称: USD Coin
cast call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 "name()(string)"

# 返回pair的token1的地址: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
cast call 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc "token1()(address)"

# 返回token1名称: Wrapped Ether
cast call 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2  "name()(string)"

# 所以第一个交易对是 USD Coin 和 Wrapped Ether
```



##### getPair

传入token1和token2地址, 查询对应的pair地址 (不存在返回0x0)

```solidity
function getPair(address tokenA, address tokenB) external view returns (address pair);
```

举例:

```shell
# 比如查询 DAI-USDC交易对对应的Pair
# DAI: 0x6B175474E89094C44Da98b954EedeAC495271d0F
# USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
# 返回: 0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5
cast call 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f "getPair(address,address)(address)" 0x6B175474E89094C44Da98b954EedeAC495271d0F  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```



##### allPairsLength

返回pair总数

```
function allPairsLength() external view returns (uint);
```

举例

```sh
# 返回 150745
cast call 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f  "allPairsLength()(uint)"
```

##### feeTo

手续费收取人地址.

当用户在 Uniswap 上进行交易时，交易所收取的费用将被分成两部分：一部分将被直接销毁（burn），另一部分将被分配给 `feeTo` 函数指定的地址。销毁的部分是为了保证 Uniswap 协议中的流动性资产总量不会因为手续费的积累而增加，而分配给 `feeTo` 函数指定的地址的部分则可以被用于奖励交易所，例如支付给开发者或用于项目运营等。



```solidity
function feeToSetter() external view returns (address);
```

目前 feeTo的地址是0x0

参考这里:  https://docs.uniswap.org/contracts/v2/concepts/advanced-topics/fees#protocol-charge-calculation



##### feeToSetter

```solidity
function feeToSetter() external view returns (address);
```

获取可以更新feeTo地址的地址 (The address allowed to change [feeTo](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/factory#feeto).)

 

##### createPair

创建Pair. (Creates a pair for `tokenA` and `tokenB` if one doesn't exist already.)

> 创建时tokenA和tokenB的传入顺序是由影响的, 因为Pair的地址是这样计算的 
>
> ```solidity
>         address pairAddress2 = address(
>             uint160(
>                 (
>                     uint(
>                         keccak256(
>                             abi.encodePacked(
>                                 hex"ff",
>                                 factory,
>                                 keccak256(abi.encodePacked(tokenA, tokenB)),
>                                 hex"96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f"
>                             )
>                         )
>                     )
>                 )
>             )
>         );
> ```
>
> 
>
> 

```solidity
function createPair(address tokenA, address tokenB) external returns (address pair);
```

举例:

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
// forge install OpenZeppelin/openzeppelin-contracts --no-commit
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
// forge install --no-commit  Uniswap/v2-core
import "lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

address constant UNISWAP_V2_FACTORY_ADDRESS = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
address constant USDT_ADDRESS = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

contract ExampleToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        uint256 initSupply = 100 * 10 ** decimals();
        _mint(msg.sender, initSupply);
    }
}

contract CreatePairTest is Test {
    IUniswapV2Factory facotry;
    ExampleToken ext;
    IERC20 usdt;

    function setUp() public {
        //[rpc_endpoints]
        //mainnet = "${ETH_RPC_URL}"
        vm.createSelectFork("mainnet");

        facotry = IUniswapV2Factory(UNISWAP_V2_FACTORY_ADDRESS);
        usdt = IERC20(USDT_ADDRESS);
        ext = new ExampleToken("EXAMPLE", "EXT");
    }

    function testCreatePair() public {
        uint pairLengthBefore = facotry.allPairsLength();
        console2.log("pair length before:", facotry.allPairsLength());
        address pairAddress = facotry.createPair(address(ext), address(usdt));
        console2.log("pair address:", pairAddress);
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        console2.log(
            ERC20(pair.token0()).symbol(),
            "-",
            ERC20(pair.token1()).symbol()
        );
        uint pairLengthAfter = facotry.allPairsLength();
        console2.log("pair length after:", facotry.allPairsLength());
        assert(pairLengthAfter == pairLengthBefore + 1);
    }
}

```

输出

```
[PASS] testCreatePair() (gas: 2518336)
Logs:
  pair length before: 150948
  pair address: 0xEC42F3DDD5940F2be204938e6b0C70fC72c4aE85
  EXT - USDT
  pair length after: 150949
```



### Pair

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/pair

在Uniswap中，Pair是指一对代币的交易池，用于交换这两种代币。Uniswap的交易池采用自动做市商模型（Automated Market Maker，AMM），也就是说，它们通过智能合约自动确定代币的价格，而不是依赖于传统的买卖订单簿。

每个Pair都有一个唯一的地址，由代币的合约地址计算而来。例如，在ETH/USDT交易对中，ETH和USDT的代币合约地址会被组合成一个新的地址，该地址就是Pair的地址。

每个Pair中都会存储相应代币的余额和汇率，汇率是指一个代币相对于另一个代币的价格比率。当用户在一个Pair中进行交易时，他们会把一种代币发送到该Pair的智能合约地址，智能合约会自动计算出相应的汇率，然后返回等值的另一种代币。

当用户在Uniswap上创建一个新的交易对时，会通过调用Factory合约的createPair函数来创建新的Pair。createPair函数会将两个代币的合约地址作为输入参数，并使用这些地址来计算Pair的地址。创建成功后，该Pair将被添加到Uniswap中，并且用户就可以在该Pair中进行交易了。

每个Pair都有一个自己的代币，称为LP代币或流动性代币（Liquidity Provider Token）。当一个用户向Pair中提供流动性时，他们会收到相应数量的LP代币，这些代币代表用户向交易池中贡献的流动性。

LP代币可以用于多种用途。首先，用户可以随时将其赎回，以取回相应的流动性。此外，LP代币也可以用于投票和治理，例如，在Uniswap的治理中，持有LP代币的用户可以投票表决关于Uniswap协议的决策。最后，用户还可以将其LP代币质押到各种流动性挖矿平台上，以获取代币的奖励。

LPs(流动性提供商)可以通过向池子里添加代币来赚取交易费，以获得LP代币的奖励

需要注意的是，每个Pair的LP代币是独立的，不同的交易对将有不同的LP代币。此外，LP代币的价值是根据Pair中存储的代币余额和汇率来计算的，因此它们的价值会随着Pair中代币余额和价格的变化而变化。

#### 地址

##### 方式1: 

使用Factory的`getPair`函数

```sh
# 比如查询 DAI-USDC交易对对应的Pair
# DAI: 0x6B175474E89094C44Da98b954EedeAC495271d0F
# USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
# 返回: 0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5
cast call 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f "getPair(address,address)(address)" 0x6B175474E89094C44Da98b954EedeAC495271d0F  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```



##### 方式2

Pair是通过[Create2](https://www.evm.codes/?fork=merge) 创建的, 所以其地址是可以计算出来的, 参考这里 https://docs.uniswap.org/contracts/v2/guides/smart-contract-integration/getting-pair-addresses

举例:

```solidity
function testPairAddress() public view {
        address factory = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
        address token0 = 0x6B175474E89094C44Da98b954EedeAC495271d0F; // DAI
        address token1 = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // USDC

				//方式1
        address pairAddress1 = IUniswapV2Factory(factory).getPair(
            token0,
            token1
        );
				//方式2 (下面的代码对于任何pair都一样, 不用变)
        address pairAddress2 = address(
            uint160(
                (
                    uint(
                        keccak256(
                            abi.encodePacked(
                                hex"ff",
                                factory,
                                keccak256(abi.encodePacked(token0, token1)),
                                hex"96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f"
                            )
                        )
                    )
                )
            )
        );

        console2.log("pair address 1:", pairAddress1);
        console2.log("pair address 2:", pairAddress2);

        assert(pairAddress1 == pairAddress2);
    }
```

其中 `96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f` 是uniswap创建pair时传递给creat2的 keccak256(init_code)



#### 接口

```solidity
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
```



```json
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json'
```



```solidity
pragma solidity >=0.5.0;

interface IUniswapV2Pair {
  event Approval(address indexed owner, address indexed spender, uint value);
  event Transfer(address indexed from, address indexed to, uint value);

  function name() external pure returns (string memory);
  function symbol() external pure returns (string memory);
  function decimals() external pure returns (uint8);
  function totalSupply() external view returns (uint);
  function balanceOf(address owner) external view returns (uint);
  function allowance(address owner, address spender) external view returns (uint);

  function approve(address spender, uint value) external returns (bool);
  function transfer(address to, uint value) external returns (bool);
  function transferFrom(address from, address to, uint value) external returns (bool);

  function DOMAIN_SEPARATOR() external view returns (bytes32);
  function PERMIT_TYPEHASH() external pure returns (bytes32);
  function nonces(address owner) external view returns (uint);

  function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;

  event Mint(address indexed sender, uint amount0, uint amount1);
  event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
  event Swap(
      address indexed sender,
      uint amount0In,
      uint amount1In,
      uint amount0Out,
      uint amount1Out,
      address indexed to
  );
  event Sync(uint112 reserve0, uint112 reserve1);

  function MINIMUM_LIQUIDITY() external pure returns (uint);
  function factory() external view returns (address);
  function token0() external view returns (address);
  function token1() external view returns (address);
  function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
  function price0CumulativeLast() external view returns (uint);
  function price1CumulativeLast() external view returns (uint);
  function kLast() external view returns (uint);

  function mint(address to) external returns (uint liquidity);
  function burn(address to) external returns (uint amount0, uint amount1);
  function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
  function skim(address to) external;
  function sync() external;
}
```





##### event Mint

当流动性代币被铸造(`mint()`)的时候触发

```solidity
event Mint(address indexed sender, uint amount0, uint amount1);
```

##### event Burn

当流动性代币被销毁(`burn()`)的时候触发

```solidity
event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
```



##### event Swap

当 `swap()`函数被成功调用后触发

```solidity
event Swap(
  address indexed sender,
  uint amount0In,
  uint amount1In,
  uint amount0Out,
  uint amount1Out,
  address indexed to
);
```

##### event Sync

`mint` `burn` `swap` `sync` 时都会触发



##### MINIMUM_LIQUIDITY

返回 流动性代币最小值 (固定值1000)

```solidity
function MINIMUM_LIQUIDITY() external pure returns (uint);
```



```sh
# 1000
cast call 0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5 "MINIMUM_LIQUIDITY()(uint)"
```



每对交易对（pair）都会在合约创建时初始化一个名为MINIMUM_LIQUIDITY的变量。该变量是一个固定值(1000)，用于确保交易对的初始流动性总量大于零。这意味着在交易对中添加流动性之前，必须先添加至少1000个流动性代币（Liquidity Token）才能完成初始化.MINIMUM_LIQUIDITY的存在是为了防止某些攻击，例如闪电贷攻击，其可能会通过在交易对中添加和删除大量流动性代币来操纵价格和市场深度。由于MINIMUM_LIQUIDITY的存在，这种攻击在Uniswap中不再有效。

需要注意的是，一旦交易对的流动性代币数量超过了MINIMUM_LIQUIDITY，该变量的值对交易对的操作不再有影响，而仅仅是一个初始化时的限制。

##### factory

返回生成该Pair的Factory的地址

```solidity
function factory() external view returns (address);
```



##### token0 token1

返回对应的两个token的地址 

谁是token0

```solidity
function token0() external view returns (address);
function token1() external view returns (address);
```



##### getReserves

返回 token0, token1的储备量. 这个储备量会用于[定价](https://docs.uniswap.org/contracts/v2/concepts/advanced-topics/pricing)和分配流动性, 还返回最后一次与Pair交互的时间

```solidity
function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
```

举例:

```shell
cast call 0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5 "getReserves()(uint112,uint112,uint32)"
# 17855224108246409584874388
# 17830344327957
# 1678333223
```



#####  price0CumulativeLast     price1CumulativeLast

```solidity
function price0CumulativeLast() external view returns (uint);
function price1CumulativeLast() external view returns (uint);
```

价格累积函数（Price Cumulative Function）是Uniswap用来计算某个交易对价格的一种方式。每当交易对的价格发生变化时，价格累积函数的值就会更新。

在Uniswap中，每个Pair都有两个价格累积函数，分别称为`price0CumulativeLast`和`price1CumulativeLast`。其中，`price0CumulativeLast`表示当前Pair的第一个代币（Token0）的价格累积函数的值，而`price1CumulativeLast`表示当前Pair的第二个代币（Token1）的价格累积函数的值。

具体来说，`price0CumulativeLast`函数表示从创建Pair以来，Token1在交易中累计出售量与Token0价格乘积的累加值。也就是说，如果当前Pair的价格为P，Token1的数量为Q，则`price0CumulativeLast`的值为P*Q的累加和。

在Uniswap中，根据价格累积函数的值可以计算出当前价格，从而实现交易对的价格发现。例如，对于一个Pair，假设当前的`price0CumulativeLast`值为X，上一次交易时的`price0CumulativeLast`值为Y，上一次交易时的时间为T，则当前价格P0（即Token0相对于Token1的价格）可以通过以下公式计算得出：

`P0 = (X - Y) / (Q1 - Q0)`

其中，Q1和Q0分别表示两次交易时的Token1数量。

因此，`price0CumulativeLast`函数在Uniswap中扮演着重要的角色，用于计算交易对的价格以及实现交易对的自动价格发现功能。

##### kLast

```solidity
function kLast() external view returns (uint);
```

每个交易对（Pair）都有一个参数叫做"k"值，它表示该交易对的流动性大小。"k"值是由该交易对中两种资产的余额相乘得出的。例如，对于一个交易对，其中ETH余额为100，ERC20代币余额为200，则该交易对的"k"值为20,000（100 * 200 = 20,000）。

kLast是一个在Uniswap合约中的函数，它用于记录交易之前的"k"值。具体来说，当一个交易对发生交易时，该函数会记录下当前交易对的"k"值，并在交易完成后更新"k"值。这样做的目的是为了方便后续计算交易手续费。

在每次交易完成后，"k"值都会更新，因此记录下交易之前的"k"值可以方便地计算出交易手续费。如果没有记录下"k"值，计算交易手续费将会更加复杂，因为需要重新计算交易对的"k"值。



##### mint

```solidity
function mint(address to) external returns (uint liquidity);
```

铸造该Pair的流动性代币

它会触发 [Mint](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/pair#mint), [Sync](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/pair#sync), [Transfer](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/pair-erc-20#transfer) 事件

##### burn

```solidity
function burn(address to) external returns (uint amount0, uint amount1);
```

销毁该Pair的流动性代币

它会触发[Burn](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/pair#burn), [Sync](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/pair#sync), [Transfer](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/pair-erc-20#transfer) 事件



##### swap

```solidity
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
```

`swap`是用于执行资产交易的函数。当用户想要交换一种代币或加密货币为另一种代币或加密货币时，他们会调用该函数。

swap函数的参数包括输入代币的地址、输出代币的地址、输入代币的数量、输出代币的最小数量和交易的接收地址。其中，输入代币的地址和数量是必需的，而输出代币的地址和最小数量是可选的。

当用户调用swap函数时，Uniswap合约会自动计算输出代币的数量，并将其转移到交易的接收地址。在这个过程中，Uniswap合约会根据交易对中的"k"值来计算交易手续费，并将其分配给流动性提供者和Uniswap协议。

需要注意的是，由于Uniswap采用自动做市商模型，交易对中的价格是由市场供需关系动态决定的，因此在执行swap函数时，交易对的价格可能已经发生了变化，从而影响到交易的成交价格和数量。

它会触发 [Swap](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/pair#swap), [Sync 事件.

##### skim

```solidity
function skim(address to) external;
```

当交易对中的其中一种代币被交易时，交易对中的另一种代币的数量会发生变化。这个变化会影响交易对中的比例，从而影响到交易对的价格。

skim函数是Uniswap交易对合约中的一个函数，其作用是将一个代币从交易对中提取出来，使得交易对中的两种代币之间的比例重新平衡。这个过程通常发生在交易对中某一种代币流动性不足时，需要将交易对中的另一种代币提取出来以增加流动性。

具体来说，当一个代币被从交易对中提取出来时，skim函数会将代币的数量除以交易对中剩余另一种代币的数量，从而确定提取的代币在当前价格下的价值。然后，这个价值会从交易对中另一种代币的余额中减去，以重新平衡交易对中两种代币的比例。



##### sync

```solidity
function sync() external;
```



当某个交易对的价格发生变化时，需要调整交易对的储备量（Reserve），以确保交易对中代币的比例始终保持不变。这个过程就是通过Sync函数实现的。

具体来说，Sync函数会计算出当前交易对中每个代币的储备量，并将其与区块链上实际的代币储备量进行比较。如果区块链上的代币储备量与计算出来的储备量不一致，Sync函数会调整交易对的储备量，使其与区块链上的储备量一致。这个过程会同时更新交易对的价格，并在交易对中添加或移除代币。

需要注意的是，Sync函数并不是直接调整交易对的价格，而是通过调整交易对中的储备量来影响价格。因此，在Sync函数调用之前，需要先进行价格计算，以确定储备量需要被调整的方向。

### Pair (ERC20)

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/Pair-ERC-20#allowance

参考上面的链接, 为流动性代币实现的ERC20的相关功能

特别说明的是permit

#### permit

```solidity
function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;
```

**它的作用是让一个地址 spender 能够代表一个地址 owner 进行一定数量的代币交易，而不需要在每次交易之前都得到 owner 的授权**。

`permit` 函数是 ERC20 中的一种新型授权机制，它允许用户在一次操作中同时授权 spender 进行一定数量的代币交易，并设置一个过期时间 deadline。通过 permit 函数进行授权，可以避免用户在每次交易之前都需要通过传统的 approve 函数进行授权过程。

而 Uniswap 中的 permit 函数则是将这种授权机制集成到了交易过程中。当某个地址需要进行交易时，它可以先调用 permit 函数进行授权，然后再直接进行交易。这样既方便了用户，也提高了交易的效率。

owner：需要进行授权的地址；
spender：被授权的地址；
value：被授权的代币数量；
deadline：授权过期时间戳；
v、r、s：用于签名验证的参数(ECDSA 签名算法)

> 需要注意的是，这个函数需要用户先对授权进行签名，因此它并不是直接调用的。一般来说，用户需要通过一些其他的工具或者库来进行签名，然后再将签名后的数据作为参数传入到 permit 函数中。



### Router01

地址  [0xf164fC0Ec4E93095b804a4795bBe1e041497b92a](https://etherscan.io/address/0xf164fC0Ec4E93095b804a4795bBe1e041497b92a)

> Router01有bug被弃用了

### Router02

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02



#### 地址

[0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D](https://etherscan.io/address/0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D)



#### 接口

https://github.com/Uniswap/v2-periphery

```solidity
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
```

```json
import IUniswapV2Router02 from '@uniswap/v2-periphery/build/IUniswapV2Router02.json'
```



##### factory

返回facotry合约地址

````solidity
function factory() external pure returns (address);
````



##### WETH

返回 WETH的地址,  关于WETH: https://blog.0xproject.com/canonical-weth-a9aa7d0279dd

```solidity
function WETH() external pure returns (address);
```

##### quote getAmountOut getAmountIn getAmountsOut getAmountsIn

参考 [Library合约](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/library)中的相关函数



##### addLiquidity

增加 ERC-20⇄ERC-20 池子的流动性

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#addliquidity

> 调用前需要先调用IERC20的Approve为Router批准额度

> Token 不能是USDT

> 如果对应的Pair不存在则会创建
>
> https://github.com/Uniswap/v2-periphery/blob/master/contracts/UniswapV2Router02.sol#L41

```solidity
function addLiquidity(
    address tokenA, // 添加流动性 tokenA 的地址
    address tokenB, // 添加流动性 tokenB 的地址
    uint amountADesired, // 期望添加 tokenA 的数量
    uint amountBDesired, // 期望添加 tokenB 的数量
    uint amountAMin, // 添加 tokenA 的最小数量
    uint amountBMin // 添加 tokenB 的最小数量
    address to, // 获得的流动性代币发送到的地址
    uint deadline // 过期时间
) external returns (
    uint amountA, // 实际添加 tokenA 的数量
    uint amountB, // 实际添加 tokenB 的数量
    uint liquidity // 获得流动性代币的数量
    );

```

举例:

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
// forge install OpenZeppelin/openzeppelin-contracts --no-commit
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
// forge install --no-commit  Uniswap/v2-core
import "lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
// forge install --no-commit Uniswap/v2-periphery
import "lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

IUniswapV2Router02 constant UNISWAP_V2_ROUTER = IUniswapV2Router02(
    0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
);
IERC20 constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

contract ExampleToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        uint256 initSupply = 100000 * 10 ** decimals();
        _mint(msg.sender, initSupply);
    }
}

contract RouterTest is Test {
    ExampleToken ext;

    function setUp() public {
        vm.createSelectFork("mainnet");
        ext = new ExampleToken("ExampleToken", "EXT");
        deal(address(WETH), address(this), 10000 ether);
    }

    function testAddLiquidity() public {
        ext.approve(address(UNISWAP_V2_ROUTER), 10000 ether);
        WETH.approve(address(UNISWAP_V2_ROUTER), 1000 ether);

        (uint amountA, uint amountB, uint liquidity) = UNISWAP_V2_ROUTER
            .addLiquidity(
                address(ext),
                address(WETH),
                10000 ether,
                1000 ether,
                0,
                0,
                address(this),
                block.timestamp + 1000
            );

        console2.log("amountA:", amountA);
        console2.log("amountB:", amountB);
        console2.log("liquidity:", liquidity);

        IUniswapV2Factory factory = IUniswapV2Factory(
            UNISWAP_V2_ROUTER.factory()
        );
        address pairAddress = factory.getPair(address(ext), address(WETH));
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        console2.log("pair address:", pairAddress);
        console2.log("liquidity token i have:", pair.balanceOf(address(this)));
    }
}
```

输出:

```
Logs:
  amountA: 10000000000000000000000
  amountB: 1000000000000000000000
  liquidity: 3162277660168379330998
  pair address: 0x35318373409608AFC0f2cdab5189B3cB28615008
  liquidity token i have: 3162277660168379330998
```



##### addLiquidityETH

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#addliquidityeth

使用ETH和Token的增加  ERC-20⇄WETH 池子的流动性

用法和`addLiquidity`类似, 只不是ETH是通过`msg.value`传入的

```solidity
function addLiquidityETH(
  address token,
  uint amountTokenDesired,
  uint amountTokenMin,
  uint amountETHMin,
  address to,
  uint deadline
) external payable returns (uint amountToken, uint amountETH, uint liquidity);
```



##### removeLiquidity removeLiquidityETH

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#removeliquidity

增加流动性的反向操作: 降低流动性 并销毁一部分流动性代币



##### removeLiquidityWithPermit  removeLiquidityETHWithPermit

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#removeliquiditywithpermit

`removeLiquidity` 和` removeLiquidityETH` 的Permit版本(无需提前Approve)

##### removeLiquidityETHSupportingFeeOnTransferTokens

https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#removeliquidityethsupportingfeeontransfertokens

`removeLiquidityETH` 的 手续费转移代币 翻版



##### swap_xxx

由于价格时浮动的, 所以需要确定是输入固定(就花这么多钱)还是输出固定(就换这么多东西), 不行就revert

| 函数名称                                                     | 输入代币类型 | 输出代币类型 | 输入数量类型 | 输出数量类型 |
| ------------------------------------------------------------ | ------------ | ------------ | ------------ | ------------ |
| [swapExactTokensForTokens](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#swapexacttokensfortokens) | ERC20代币    | ERC20代币    | 固定数量     | 自动计算     |
| [swapTokensForExactTokens](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#swaptokensforexacttokens) | ERC20代币    | ERC20代币    | 自动计算     | 固定数量     |
| [swapExactETHForTokens](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#swapexactethfortokens) | ETH          | ERC20代币    | 固定数量     | 自动计算     |
| [swapTokensForExactETH](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#swaptokensforexacteth) | ERC20代币    | ETH          | 自动计算     | 固定数量     |
| [swapExactTokensForETH](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#swapexacttokensforeth) | ERC20代币    | ETH          | 固定数量     | 自动计算     |
| [swapETHForExactTokens](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02#swapethforexacttokens) | ETH          | ERC20代币    | 自动计算     | 固定数量     |

+ `deadline`: 每次交易都需要包含一个deadline参数，表示这个交易的截止时间。如果在截止时间之前交易成功，交易就会被执行，否则交易将被取消。deadline参数是以Unix时间戳（以秒为单位）的形式提供的。在Solidity中，可以使用`block.timestamp`获取当前区块的时间戳
+ `path` : 用于指定交易从一个代币到另一个代币的路线。在使用swap函数进行交易时，需要指定交易的输入代币和输出代币，并通过路径参数指定交易路径。路径参数是一个代币地址数组，表示交易从输入代币开始，逐步转换到输出代币的过程



> 注: 在warp之前需要先Approve

举例:

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
// forge install OpenZeppelin/openzeppelin-contracts --no-commit
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
// forge install --no-commit  Uniswap/v2-core
import "lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
// forge install --no-commit Uniswap/v2-periphery
import "lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

IUniswapV2Router02 constant UNISWAP_V2_ROUTER = IUniswapV2Router02(
    0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
);

contract RouterTest is Test {
    function setUp() public {
        vm.createSelectFork("mainnet");
    }
    
    function testSwap() public {
        IERC20 DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
        IERC20 USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        deal(address(DAI), address(this), 10000 ether);

        DAI.approve(address(UNISWAP_V2_ROUTER), 10000 ether);

        address[] memory path = new address[](2);
        path[0] = address(DAI);
        path[1] = address(USDC);

        uint[] memory amounts = UNISWAP_V2_ROUTER.swapExactTokensForTokens(
            10000 ether,
            1,
            path,
            address(this),
            block.timestamp
        );
        console2.log("amounts[0]:", amounts[0]);
        console2.log("amounts[1]:", amounts[1]);
        console2.log("USDC i have", USDC.balanceOf(address(this)));
    }
}
```



```
Logs:
  amounts[0]: 10000000000000000000000
  amounts[1]: 9963991331
  USDC i have 9963991331
```



##### swap_xxx_ForTokensSupportingFeeOnTransferTokens

swap_xxx的手续费转移翻版





#### Library

参考这 https://docs.uniswap.org/contracts/v2/reference/smart-contracts/library



