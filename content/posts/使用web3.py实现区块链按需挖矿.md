---
title: "使用web3.py实现区块链按需挖矿"
date: 2022-07-03T13:10:58+08:00
draft: false
author: yinhui
categories: [Blockchain]
tags: [web3.py, python] 
---



让自己使用`geth`运行的区块链像`Ganche`一样可以`AUTOMINING`

<!--more-->

在做智能合约开发过程中, 如果使用`Ganche`的话, 可以发现其有一个非常爽的功能:`AUTOMINING` 自动挖矿 或按需挖矿, 也就是说不需要挖矿的时候就别挖, 否则非常耗电脑资源.  如果我们是自己使用`geth`运行的测试链, 则没有这个功能, 需要手动`attach`到控制台进行`miner.start()`和`miner.stop`, 非常不方便. 



## Web3.js

如果使用`Web3.js`,貌似没有看到`miner`控制的API, 不过Gitub上有一个扩展, 可以实现

`https://github.com/DecentricCorp/web3admin` 利用这个扩展可以实现我们想要的功能.



## Web3.py

`Web3.py`自带[`miner`控制的API](https://web3py.readthedocs.io/en/stable/web3.miner.html), 这就比较方便了.

每隔几秒轮询一下是否有`pending`的block, 如果有则挖, 否则停止挖矿

 脚本如下

```python
#!/usr/bin/env python3
import os
import time

from web3 import Web3  # pip3 install web3

# 按需挖矿

#使用前请先修改provide
w3 = Web3(Web3.IPCProvider('../mychain/data/geth.ipc'))
num_threads = os.cpu_count()


def main():
    # kill this script
    os.system("killall -9 python > /dev/null 2>&1")

    print('Connected to Ethereum client: %s' % w3.clientVersion)
    print("启动自动挖矿...")
    while True:
        time.sleep(3)
        if w3.eth.getBlock('pending').transactions:
            print(
                time.strftime("%H:%M:%S", time.localtime()) + ":Mining for pending transactions: %s" % w3.eth.getBlock(
                    'pending').transactions)
            w3.geth.miner.start(num_threads)
        else:
            print(time.strftime("%H:%M:%S", time.localtime()) + ':No pending transactions, sleeping...', end='\r')
            w3.geth.miner.stop()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCtrl+C, bye!")
        w3.geth.miner.stop()
        exit(0)
    except Exception as e:
        print("发生错误: %s" % e)
        exit(0)

```



运行时的样子

```shell
Connected to Ethereum client: Geth/v1.10.16-stable/darwin-amd64/go1.17.6
启动自动挖矿...
13:24:42:Mining for pending transactions: [HexBytes('0x0cecdc430a73adc915d9944798e71735a48940b90e38965a3e4a5c8db6b48cb5')]
13:24:57:No pending transactions, sleeping...

```

