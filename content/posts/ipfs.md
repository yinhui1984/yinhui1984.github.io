---
title: "IPFS"
date: 2022-10-24T09:17:22+08:00
draft: false
author: yinhui
categories: [Blockchain]
tags: [IPFS, L1,Web3.0] 
---

`IPFS` 基础知识

<!--more-->

## 什么是IPFS

相比于以前的本地存储, 我们现在更喜欢使用云存储, 云存储是由云存储提供商提供的集中式存储, 其有很多优点, 比如用户使用起来简单,提供数据保护等, 但短板也很明显, 比如可访问性、保密性、信任、以及抗审查能力弱等问题。针对这些问题， 便出现了P2P数据网络，大家印象最深刻的便是BT下载。

关于P2P数据网络， 参考这里 ：  https://yinhui1984.github.io/p2p/

[IPFS](https://ipfs.tech)  属于新一代P2P数据网络之一（还有 Swarm、SAFE、Storj等等），采用[官方的解释](https://docs.ipfs.tech/concepts/what-is-ipfs/#what-is-ipfs)是 “IPFS is a distributed system for storing and accessing files, websites, applications, and data.”

另外， 从区块链的角度说， 将数据放在诸如ETH这样的链上代价是昂贵的，对应大型数据也是不现实的， 所以需要一个系统来解决Dapp的数据存储问题， 正如编写传统APP需要有数据库一样。



## IPFS初识

### 安装与启动

> 首先安装IPFS Desktop 和 CLI：   https://docs.ipfs.tech/install/



+ 命令行安装：

  ```
  >  wget  --no-check-certificate   https://dist.ipfs.tech/kubo/v0.16.0/kubo_v0.16.0_linux-amd64.tar.gz
  
  > tar -xvzf kubo_v0.16.0_linux-amd64.tar.gz
  
  > cd kubo && sudo bash install.sh
  ```

  

+ 初始化

  ```
  > ipfs init
  ```

+ 启动节点

  ```
  > ipfs daemon
  ```

+ 查看节点信息

  ```
  > ipfs id  -f="<id>"
  12D3KooWJdT87m7RVHHwYmvTzhitNhuG9eVBJB5EiQeCGcR13aHE
  ```
  
  可以在另外一台电脑或虚拟机上使用`ipfs ping <id>` 来尝试ping这个id
  
  ```
  ➜  ~ ipfs ping 12D3KooWJdT87m7RVHHwYmvTzhitNhuG9eVBJB5EiQeCGcR13aHE
  PING 12D3KooWJdT87m7RVHHwYmvTzhitNhuG9eVBJB5EiQeCGcR13aHE.
  Pong received: time=0.66 ms
  ...
  
  ```
  
  尝试连接:
  
  ```
  ➜  ~ ipfs swarm connect /ipfs/12D3KooWJdT87m7RVHHwYmvTzhitNhuG9eVBJB5EiQeCGcR13aHE
  connect 12D3KooWJdT87m7RVHHwYmvTzhitNhuG9eVBJB5EiQeCGcR13aHE success
  
  ```
  
  

### 上传一个文件

我们使用下面这个脚本生成一个大于256K的文件,然后上传到IPFS

```shell
#!/usr/bin/env sh

TEXTFILE=./text.txt
TRUE > $TEXTFILE

counter=0

# while size of text.txt < 300k, write content into it

# get size of text.txt
# linux: stat -c%s "$FILENAME"
# macos: stat -f%z "$FILENAME"
FILESIZE=$(stat -f%z "$TEXTFILE")
LINE="########################################################"
while [ "$FILESIZE" -lt 307200 ]; do
  echo ${counter}$LINE >> ./text.txt
  counter=$((counter+1))
  FILESIZE=$(stat -f%z "$TEXTFILE")
done
```



```
OSX MP16 ~/Desktop/ipfs_demo ❯ ipfs add ./local_file/text.txt 
added QmPLXXaC81eGS3fNoCkvaqaRPFRu9pUCQMbKvajo9co1ND text.txt
 300.04 KiB / 300.04 KiB [=========================] 100.00%
```



上传完成后, 其会给出一个地址字符串, 叫着 `CID`  (conent id). 可以理解为该文件的hash值, 但不仅仅如此. 参考这里: https://docs.ipfs.tech/concepts/content-addressing/#cid-versions



使用`ipfs cat` 命令可以将内容打印出来:

```
➜  ~ ipfs cat QmPLXXaC81eGS3fNoCkvaqaRPFRu9pUCQMbKvajo9co1ND
0########################################################
1########################################################
2########################################################
3########################################################
...
...
5051########################################################
5052########################################################
5053########################################################
5054########################################################
➜  ~ 

```

 

使用`ipfs ls`命令我们可以看到 这个CID又指向另外2个CID

```
OSX MP16 ~ ❯ ipfs ls -v QmPLXXaC81eGS3fNoCkvaqaRPFRu9pUCQMbKvajo9co1ND
Hash                                           Size   Name
QmaroDZbcMjim4a8nVyahnvb3hhCSSTsCZB2jCJEsrd3ZF 262144
QmU6xSMhb74oxAXRjLVRwqsJJgU4GH14FDVME5qys8uFZF 45101
```

分别`ipfs cat`出这两个CID, 看看其中的内容:

```
OSX MP16 ~ ❯ ipfs cat QmaroDZbcMjim4a8nVyahnvb3hhCSSTsCZB2jCJEsrd3ZF                          
0########################################################
1########################################################
2########################################################
3########################################################
4########################################################
...
...
4312########################################################
4313########################################################
4314########################################################
4315###################################
OSX MP16 ~ ❯
```



````
OSX MP16 ~ ❯ ipfs cat QmU6xSMhb74oxAXRjLVRwqsJJgU4GH14FDVME5qys8uFZF
#####################
4316########################################################
4317########################################################
4318########################################################
4319########################################################
4320########################################################
...
...
5051########################################################
5052########################################################
5053########################################################
5054########################################################
````

很明显的, 我们上传的文件被分成了2个部分,分别存储了.

这涉及到2个知识:

+ IPFS的文件存储是分块(Block)存储的, 一个块最大容量是256KB
+ IPFS使用的是默克尔树的形式来进行存储的

到 IPFS Desktop上看就更形象了

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1666772210052104000-Snipaste_2022-10-26_16-16-15.jpg?raw=true)





在公共网关上查看

>ipfs 内容能在本地看到, 但无法在公共网关上看到 ?
>
>添加配置:
>
>`ipfs config --json Swarm.RelayClient.Enabled true`
>
>重启ipfs
>
>`ipfs shutdown`
>
>`ipfs daemon`

https://ipfs.io/ipfs/QmPLXXaC81eGS3fNoCkvaqaRPFRu9pUCQMbKvajo9co1ND

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1666772512478754000-Snipaste_2022-10-26_16-21-08.jpg?raw=true)



## 理论基础

### Hash

`Hash`函数在https://yinhui1984.github.io/pow/#hash 中说过. 但那里没有提及Hash面临的问题: 

1. 哈希算法很多, 不同的软件可能采用不同的算法, 并且算法输出的哈希值长度也不一样
2. 随着时间的推移, 某一些哈希算法可能会被发现存在不安全因素而被弃用而采取其他的算法,或进行升级

这就导致在编写哈希解码程序的时候, 一个程序会面对很多种算法, 这在兼容性和算法升级上是很痛苦的.

#### mutihash (聚合哈希)

针对上面的问题, 提出了`mutihash`  https://multiformats.io/multihash/

基本原理就是在hash值前面加上*哈希算法类型*和*哈希值长度*这样两个前缀

```c
<hash-func-type><digest-length><digest-value>
```

完整类型列表在这里 :  https://github.com/multiformats/multicodec/blob/master/table.csv

| name     | tag       | code | status    | description |
| :------- | :-------- | :--- | :-------- | :---------- |
| ...      |           |      |           |             |
| sha2-256 | multihash | 0x12 | permanent |             |
| ...      |           |      |           |             |

比如

```c
"12200ED3911004C0EF2CC63ADCDC9E44CD8C2C831EEC0E4431402000F5325A7FE1AE"
```

就表示类型是0x12, 也就是`sha2-256`,  长度为0x20 = 32Byte = 256bit , 哈希值为 0ED3911004C0EF2CC63ADCDC9E44CD8C2C831EEC0E4431402000F5325A7FE1AE



##### 举例

```
OSX MP16 ~ ❯ cat ./hello.txt
helloworld
OSX MP16 ~ ❯ ipfs add ./hello.txt
added QmUU2HcUBVSXkfWPUc3WUSeCMrWWeEJTuAgR9uyWBhh9Nf hello.txt
 11 B / 11 B [==============] 100.00
```

点击IPFS Desktop 文件 -> 导入(来自IPFS路径) 按钮, 导入上面的CID, 然后在导入的题目上选择"检查"

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1666923773240948000-Snipaste_2022-10-28_10-20-44.jpg?raw=true)

我们可以看到其采用的是sha2-256的哈希算法

我们导出该数据块(block), 手动使用sha2-256来看看其hash值是否如此:

```
~❯ ipfs block get QmUU2HcUBVSXkfWPUc3WUSeCMrWWeEJTuAgR9uyWBhh9Nf > hello.block
~❯ sha256sum ./hello.block
5b0995ced69229d26009c53c185a62ea805a339383521edbed1028c496615448  ./hello.block
```

**注意:**

直接对./hello.txt 进行hash得到的值是不同的

```
~❯ sha256sum ./hello.txt
8cd07f3a5ff98f2a78cfc366c13fb123eb8d29c1ca37c79df190425d5b9e424d  ./hello.txt
```

**这是为什么?**

这是因为IPFS在存储hello.txt中的内容时,还添加了其他信息, 其和数据信息一起作为"块的内容"被存储起来的

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1666924911392066000.jpg?raw=true)



### CID

关于CID的介绍参考这里 : https://docs.ipfs.tech/concepts/content-addressing/#what-is-a-cid

以及官方教程:  https://proto.school/anatomy-of-a-cid



我们这里以CID v0为例, 看看IPFS是如何生成CID的

导出CID为 `QmUU2HcUBVSXkfWPUc3WUSeCMrWWeEJTuAgR9uyWBhh9Nf` 一个块:

```
~ > ipfs block get QmUU2HcUBVSXkfWPUc3WUSeCMrWWeEJTuAgR9uyWBhh9Nf > hello.block
```

IPFS 生成CID v0的步骤 :

1, 将块数据进行一次sha256 哈希, 得到H1

2, 在H1前面追加哈希算法类型和H1哈希长度 得到 S

3, 将S进行一次base58编码

```go
package main

import (
	"crypto/sha256"
	"fmt"
	"github.com/mr-tron/base58/base58"
	"os"
)

func main() {

	bytes, _ := os.ReadFile("hello.block")
	s := sha256.Sum256(bytes)
  
  //0x12 表示 sha256
  //https://github.com/multiformats/multicodec/blob/master/table.csv
  //0x20 表示 32Byte
	s1 := append([]byte{0x12, 0x20}, s[:]...)
	output := base58.Encode(s1[:])

	fmt.Println("MY CID: ", output)
}

```

 ```
 OSX MP16 ~/Desktop/ipfs_demo/cid_demo ❯ go run .
 MY CID:  QmUU2HcUBVSXkfWPUc3WUSeCMrWWeEJTuAgR9uyWBhh9Nf
 OSX MP16 ~/Desktop/ipfs_demo/cid_demo ❯ 
 ```



**一个在线的CID查看器:**

https://cid.ipfs.tech/#QmUU2HcUBVSXkfWPUc3WUSeCMrWWeEJTuAgR9uyWBhh9Nf

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1667286451237651000.jpg?raw=true)



通用的生成CID的代码如下:

https://github.com/ipfs/go-cid

```go
package main

import (
	"fmt"
	"github.com/ipfs/go-cid"
	mc "github.com/multiformats/go-multicodec"
	mh "github.com/multiformats/go-multihash"
	"os"
)

func main() {

	bytes, _ := os.ReadFile("hello.block")

	pref := cid.Prefix{
    //这里指定 CID version
		Version:  0,
		Codec:    uint64(mc.Raw),
    //这里指定哈希算法
		MhType:   mh.SHA2_256,
		MhLength: -1, // default length
	}

	c, err := pref.Sum(bytes)
	if err != nil {
		panic(err)
	}

	fmt.Println("Created CID: ", c)
}
```

其他编程语言的CID实现在这里 : https://github.com/multiformats/cid#implementations



### 默克尔有向无环图(Merkle DAG)

参考这篇文章, 写得非常详细

https://developer.aliyun.com/article/842854



![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1667270192324991000.jpg?raw=true)



### 分布式哈希表 DHT

这个视频 https://www.bilibili.com/video/BV1bA411q73K/

以及 https://learnblockchain.cn/article/3443



## 消息服务(pubsub)

提供消息发布和订阅服务

在启动`ipfs deamon`是需要带上 `--enable-pubsub-experiment` 参数



### demo

订阅消息demo

```go
package main

import (
	ipfs "github.com/ipfs/go-ipfs-api"
	"log"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	shell := ipfs.NewShell("localhost:5001")

	if shell == nil {
		log.Fatal("Failed to connect to IPFS")
	}

	//Run daemon with --enable-pubsub-experiment to use.
	subscribe, err := shell.PubSubSubscribe("topic_test")
	if err != nil {
		log.Fatal("Failed to subscribe topic, ", err)
	}

	for true {
		msg, err := subscribe.Next()
		if err != nil {
			log.Println("error when get next message, ", err)
			continue
		}
		log.Printf("got message:\n\t%v\n \tdata:%s\n\tfrom:%s\n", msg.TopicIDs, msg.Data, msg.From.String())
	}

}

```



发布消息demo:

```go
package main

import (
	ipfs "github.com/ipfs/go-ipfs-api"
	"log"
	"time"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	shell := ipfs.NewShell("localhost:5001")

	if shell == nil {
		log.Fatal("Failed to connect to IPFS")
	}

	//Run daemon with --enable-pubsub-experiment to use.
	for true {
		msg := "hello,current time is:" + time.Now().String()
		err := shell.PubSubPublish("topic_test", msg)
		if err != nil {
			log.Println("Error when publish message: ", err)
		}
		log.Println("sent msg: " + msg)
		time.Sleep(time.Second)
	}

}

```



启动节点:

```shell
ipfs daemon --enable-pubsub-experiment
```



用两台电脑, 一个运行发布者另外一个运行订阅者:

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1667371846359876000.jpg?raw=true)





## API

https://docs.ipfs.tech/reference/#api-cli-reference

一个最基础的示例:

```go
package main

import (
   "fmt"
   ipfs "github.com/ipfs/go-ipfs-api"
   "io"
   "log"
   "strings"
)

func main() {
   log.SetFlags(log.LstdFlags | log.Lshortfile)

   shell := ipfs.NewShell("localhost:5001")

   if shell == nil {
      log.Fatal("Failed to connect to IPFS")
   }
   log.Println("IPS connected")

   // 上传
   //add的内容默认是被pin在本地的
   cid, err := shell.Add(strings.NewReader("HELLO!!"))
   if err != nil {
      log.Fatal("Add error:", err)
   }
   log.Println("Success added in IPFS: ", cid)

   //下载
   log.Println("Getting content from IPFS")
   reader, err := shell.Cat(cid)
   if err != nil {
      log.Fatal(err)
   }
   content, err := io.ReadAll(reader)
   if err != nil {
      log.Fatal(err)
   }
   fmt.Println(string(content))

}
```



