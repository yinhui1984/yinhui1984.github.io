---
title: "PoW"
date: 2022-07-08T19:45:30+08:00
draft: false
author: yinhui
categories: [BlockChain]
tags: [pow, consensus] 
---



"如何达成共识"是分布式系统的一个最基本的问题. 区块链作为一个分布式系统, 这也是最核心的问题.

共识算法很多, `PoW`、 `BFT` 、`POS` .. 以及的变体, 比如`PBFT`、 `IBFT`、`Tendermint`、`DPoS`、 `HotStuff` 等.

但作为区块链的鼻祖的BTC和元老的ETH都使用的`PoW`, ETH正在过度到`PoS`, 另外有一些区块链采用了`PoS`的一个变体`DPoS`.我们主要关注这几种.

今天先说说`PoW`

<!--more-->

## 原理

`PoW`  Proof of Work 工作量证明  在挖矿的时候通过作出"一定的工作量"来增加作恶成本.

其基本原理是通过一个简单但又费力的数学计算来体现工作量. 这样的数学计算有很多, 比如质因数分解, 计算hash等.



##  Hash

哈希函数用于为任意长的输入字符串创建固定长度的摘要,有各种系列的哈希函数，如MD、SHA1、SHA-2、SHA-3、RIPEMD和Whirlpool

特点:

+ 哈希函数必须能够接受任何长度的输入文本，并输出一个固定长度的压缩信息.
+ 哈希函数的计算速度非常快。如果消息太大，效率可能会下降，但该函数仍应足够快，以满足实际使用
+ 哈希函数的输出必须的稳定的, 输入不变时输出也不会发生变化
+ 哈希不能反向推导.  也就是说很难通过哈希值反向计算出原始值. 这也叫`抗碰撞性`
+ 不同的信息要得到不同的哈希值. 实际上, 输入信息稍加改变, 输出的哈希值将会有很大的差异. 这叫 `雪崩效应`
+ 我们一般使用的是 `SHA-256`

举例
```shell
OSX MP16 ~ ❯ echo "this is a test" | openssl dgst -sha256
91751cee0a1ab8414400238a761411daa29643ab4b8243e9a91649e25be53ada

OSX MP16 ~ ❯ echo "this is A test" | openssl dgst -sha256
215ec5072f0ae6f05d9576d42c1a3fb5794aa51199cb44e7d087e679ff000d1
```



##  Hash解密游戏

假设有这个一个游戏:

给定一个常量字符串`str`,  再加上一个可变数字`num` 得到 `str+num`, 

通过不断变化`num`的值, 使得 `hash(str+num)`得到的哈希值满足一定的条件 就算成功.

假设我们需要满足的条件是: 哈希值以`0000`开头



```go
func main() {
	str := "this is a test string"
	num := 0

	for true {
		tempStr := str + strconv.Itoa(num)
		h := sha256.New()
		h.Write([]byte(tempStr))
		sum := h.Sum(nil)
		s := hex.EncodeToString(sum)

		fmt.Println("try:" + s)

		if s[0:4] == "0000" {
			fmt.Println("找到num: ", num)
			fmt.Println("找到hash: ", s)
			break
		}
		num++
	}
}
```

运行结果:

```shell
try:2717e2d84df58353433bdef467f5f12766710aedc7114d409d04d6712b670edb
try:a13b43128c8961d36d9f7aca7fd82018497d713e5305e86f1ba6c900e7870e61
try:5a968dcad3ab8564046abedff836a91242d77207b758f079865680b96e9e9b3a
...
...
找到num:  7521
找到hash:  0000e87f07402bc7592d63fc8876fc4685eb52649ceefa78915b33d7792be1f0
```

经过七千多次尝试, 找到了当`num`为7521时, 满足条件



## PoW

上面游戏中的`给定字符串`就算挖矿是的区块"密封前"的哈希值 ,包含前面的区块的哈希值和交易数据以及其它信息计算出来的哈希值, 但还没有成功挖矿,所以还没包含本区块的`nonce`等. 挖矿成功后, 会进行密封(`Seal`). 这里说的`nonce`也就是上面游戏中的`num`

游戏中还提到 `一定的条件` ,  在Pow中, 一定的条件就是找到的哈希值小于指定的 `target` ,  `target`是根据 `难度` 计算出来的.



所以我们可以得到这样一个简化版本的 PoW过程

```go
package main

import (
	"crypto/sha256"
	"fmt"
	"math/big"
	"strconv"
	"time"
)

func getTarget() *big.Int {
  //假设当前难度值
	difficulty := 22341680
	two256 := new(big.Int).Exp(big.NewInt(2), big.NewInt(256), big.NewInt(0))
	return new(big.Int).Div(two256, big.NewInt(int64(difficulty)))
}

// getBlockHashBeforeSeal 获取区块在"密封前"的哈希值
func getBlockHashBeforeSeal() []byte {
	str := "1312af178c253f84028d480a6adc1e25e81caa44c749ec81976192e2ec934c64"
	//convert to bytes[]
	b := []byte(str)
	return b
}

func hash(s []byte) []byte {
	//使用sha256哈希函数
	h := sha256.New()
	h.Write(s)
	sum := h.Sum(nil)

	return sum
}

func mine() uint64 {
	nonce := 0
	target := getTarget()
	fmt.Println("target: ", target)

	powBuffer := new(big.Int)
	//旷工挖矿，需要进行暴力遍历
	//通过不停地改变nonce以便让hash值变化，然后找到刚好满足一定条件的值
	for true {

		var bytes = append(getBlockHashBeforeSeal(), strconv.Itoa(nonce)...)
		sum := hash(bytes)

		if powBuffer.SetBytes(sum).Cmp(target) < 0 {
			fmt.Println("找到nonce: ", nonce)
			break
		}

		nonce++
	}

	return uint64(nonce)
}

func verify(nonce uint64) bool {

	//对旷工挖矿得到的结果进行验证
	//验证只需要进行一次计算
	powBuffer := new(big.Int)
	target := getTarget()
	var bytes = append(getBlockHashBeforeSeal(), strconv.Itoa(int(nonce))...)
	sum := hash(bytes)

	return powBuffer.SetBytes(sum).Cmp(target) < 0

}

func main() {
	startTime := time.Now()
	nonce := mine()
	fmt.Println("计算耗时: ", time.Now().Sub(startTime))
	ok := verify(nonce)
	fmt.Println("验证结果: ", ok)

}

```



## go-etherum

go-etherum的`PoW`用到的算法名称叫 `Ethash`

其挖矿逻辑在  go-ethereum-1.10.20/consensus/ethash/sealer.go 中的 `mine` 方法

