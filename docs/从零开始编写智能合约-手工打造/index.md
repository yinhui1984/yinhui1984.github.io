# 从零开始编写智能合约-手工打造


前面在 [从零开始编写智能合约-使用traffle套件](https://yinhui1984.github.io/从零开始编写智能合约-使用traffle套件/) 中 使用 `truffle`套件从零开始搭建环境, 编写、部署、测试和调用智能合约, 这次我们只使用一些命令行工具来进行"手工打造"



<!--more-->



## 创建测试链

还是以ETH为例, 使用 `Go Ethereum` https://geth.ethereum.org 来创建 使用`POW`共识算法的一个简单私有链.

### 安装geth

官方教程 https://geth.ethereum.org/docs/install-and-build/installing-geth

或者自己下载安装包进行安装  https://geth.ethereum.org/downloads/

安装完成后, 运行一下version表示成功

```shell
OSX MP16 ~/Downloads/privateNetwork ❯ geth version
Geth
Version: 1.10.16-stable
Architecture: amd64
Go Version: go1.17.6
Operating System: darwin
GOPATH=
GOROOT=go
```

### 创建一个账户

下面的`创世文件`中的`coinbase`会用到这个账户, 用来接收挖矿的收入

为方便起见, 将账户密码写到password.txt , 当然这是不安全的行为.

```shell
echo 123456 > password.txt
```

新建账户:

```shell
geth --datadir ./data/ account new --password ./password.txt
```

其中的`datadir`是数据存储目录, 后面的数据文件都将存到这个目录中

```shell
OSX MP16 ~/Downloads/privateNetwork ❯ geth --datadir ./data/ account new --password ./password.txt
INFO [07-01|10:10:34.007] Maximum peer count                       ETH=50 LES=0 total=50

Your new key was generated

Public address of the key:   0x79dF0D3c23f22370881dC92aF524A1D5E52e3552
Path of the secret key file: data/keystore/UTC--2022-07-01T02-10-34.008109000Z--79df0d3c23f22370881dc92af524a1d5e52e3552

- You can share your public address with anyone. Others need it to interact with you.
- You must NEVER share the secret key with anyone! The key controls access to your funds!
- You must BACKUP your key file! Without the key, it's impossible to access account funds!
- You must REMEMBER your password! Without the password, it's impossible to decrypt the key!
```

打印内容中的 `0x79dF0D3c23f22370881dC92aF524A1D5E52e3552`是公钥, 也是我们的账户地址



### 找一个网络ID

`chainId`或者`network ID` 用于隔离以太坊对等网络。只有当两个对等点使用相同的创世块和网络 ID 时，区块链节点之间才会发生连接。使用 --networkid 命令行选项设置 geth 使用的网络 ID。

以太网主网 ID 为 1。如果您提供与主网不同的自定义网络 ID，您的节点将不会连接到其他节点并形成专用网络。如果您打算在 Internet 上连接到您的私有链，最好选择一个尚未使用的网络 ID。您可以在 https://chainid.network 找到由社区运行的以太坊网络注册表。 这里我们只是在本地运行, 随便使用一个ID就可以了, 比如`1235`

### 编写"创世文件"

一个新的区块链在生成第一个区块, 也就是`创世块`的时候, 需要从`创世文件`来进行生成

```shell
touch genesis.json
```

```json
{
  "nonce": "0x0000000000000042",
  "timestamp": "0x00",
  "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "extraData": "0x00",
  "gasLimit": "0x8000000",
  "difficulty": "0x0400",
  "byzantiumBlock": 0,
  "constantinopleBlock": 0,
  "mixhash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "coinbase": "0x79dF0D3c23f22370881dC92aF524A1D5E52e3552",
  "alloc": {
    "0x79dF0D3c23f22370881dC92aF524A1D5E52e3552":
    {
      "balance": "1000000000000000000000"
    }
  },
  "config": {
    "chainId": 1235,
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0
  }
}
```

关于创世文件中的各个字段的含义, 后面会有一篇专门的博客来讲

> 注意: 将`coinbase` 以及 `alloc`中的地址修改为上面创建账户时你所得到的地址

### 初始化区块链

```shell
geth --datadir ./data init ./genesis.json
```

输出

```shell
INFO [07-01|10:50:50.915] Maximum peer count                       ETH=50 LES=0 total=50
INFO [07-01|10:50:50.919] Set global gas cap                       cap=50,000,000
INFO [07-01|10:50:50.919] Allocated cache and file handles         database=/Users/zhouyinhui/Downloads/privateNetwork/data/geth/chaindata cache=16.00MiB handles=16
INFO [07-01|10:50:51.007] Writing custom genesis block 
INFO [07-01|10:50:51.010] Persisted trie from memory database      nodes=0 size=0.00B time="21.005µs" gcnodes=0 gcsize=0.00B gctime=0s livenodes=1 livesize=0.00B
INFO [07-01|10:50:51.011] Successfully wrote genesis state         database=chaindata hash=0ca0fb..b61b69
INFO [07-01|10:50:51.011] Allocated cache and file handles         database=/Users/zhouyinhui/Downloads/privateNetwork/data/geth/lightchaindata cache=16.00MiB handles=16
INFO [07-01|10:50:51.090] Writing custom genesis block 
INFO [07-01|10:50:51.090] Persisted trie from memory database      nodes=0 size=0.00B time="2.71µs"   gcnodes=0 gcsize=0.00B gctime=0s livenodes=1 livesize=0.00B
INFO [07-01|10:50:51.091] Successfully wrote genesis state         database=lightchaindata hash=0ca0fb..b61b69
OSX MP16 ~/Downloads/privateNetwork ❯ 

```

生成的文件在 ` ./data/geth`下

## 运行区块链

```shell
geth --datadir ./data/ --networkid 1235 --port 8545  --http --http.api 'admin,eth,miner,net,txpool,personal,web3'  --mine --allow-insecure-unlock --unlock '0x79dF0D3c23f22370881dC92aF524A1D5E52e3552' --password password.txt
```

+ ` --datadir` 数据文件目录
+ `--networkid` 网络ID
+ `--port` RPC端口
+ `--http` 启用`http-rpc`服务
+ `--http.api`提供那些API
+ `--mine` 启用挖矿
+  `--allow-insecure-unlock` 当账户相关的RPC被http暴露时，允许不安全的账户解锁
+ `--unlock` 解锁账户 (多个账户用逗号分割)
+ `--password` 解锁账户用到的密码文件

成功运行后, 会看到很多打印信息, 其中值得注意的是下面这两行, 一个是ipc, 一个是http server, 我们会使用他们来和我们的区块链进行通讯

```shell
INFO [07-01|11:08:58.245] IPC endpoint opened                      url=/Users/zhouyinhui/Downloads/privateNetwork/data/geth.ipc
INFO [07-01|11:08:58.245] HTTP server started                      endpoint=127.0.0.1:8545 prefix= cors= vhosts=localhost
```

另外一条是 我们作为区块链中的对等节点`PEER NODE`时的信息, 这里我们还用不到

```shell
 Started P2P networking                   self=enode://de2537c5f309be45bcb2d011cd172138db40295f74a288b07e03635e2194e7c2987cf97c9d295dc502053d9f7adda11052597c7f1bc5a5ec3d8182777138a0f1@127.0.0.1:8545
```



>请保持区块链在后台运行, 后面的代码都需要用到

## 与测试链进行交互

`attach`到测试链, 就可以启动一个js console, 和`truffle console`功能一样

**方式1, 通过IPC进行attach**

```shell
geth attach /Users/zhouyinhui/Downloads/privateNetwork/data/geth.ipc
```

```shell
OSX MP16 ~/blockchain/private_net/tempchain ❯ geth attach /Users/zhouyinhui/Downloads/privateNetwork/data/geth.ipc
Welcome to the Geth JavaScript console!

....

To exit, press ctrl-d or type exit
> eth.chainId()
"0x4d3"
>
```

`"0x4d3"` 也就是 我们的 `1235`

其中 *.ipc 可以使用相对路径



**方式2, 通过http服务进行attach**

```
geth attach http://127.0.0.1:8545
```



## 一键生成测试链

上面那些繁琐的步骤可以搞成一个脚本, 一键生成, 这样来得更方便

```python
#!/usr/bin/env python3

# 一键创建ETH私有链，共识算法POW，如果要使用POA请修改createGenesisFile()中的配置文件
# 这只是练习使用，更好的做法是使用 ganache-cli

import os
import subprocess
import re
from typing import List

ROOT_FOLDER = os.getcwd()
DATA_FOLDER = "./data/"
ACCOUNT_FILE = "accounts.txt"
PASSWORD_FILE = "password.txt"
GENESIS_FILE = "genesis.json"
CHAIN_ID = ""


def run_command(cmd: List):
    sp = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = sp.communicate()
    out = out.decode('utf-8').rstrip()
    err = err.decode('utf-8').rstrip()
    rtn = sp.returncode
    if out:
        # print("[output]"+out)
        return out
    if err:
        print("return code:" + str(rtn) + " : " + err)
        return err


def ask_root_folder():
    i = input("the folder path of output:")
    p = os.path.abspath(i)
    if not os.path.exists(p):
        os.mkdir(p)
    global ROOT_FOLDER
    ROOT_FOLDER = p
    print(ROOT_FOLDER)
    os.chdir(ROOT_FOLDER)


def create_account():
    # geth account new --password <(echo $mypassword)
    account = ""
    password = input("password of new account:")
    with open(PASSWORD_FILE, "w+") as f:
        f.write(password)
    out = run_command(["geth", "--datadir", DATA_FOLDER, "account",
                       "new", "--password", "./password.txt"])
    m = re.search('0x.+', out)
    if m:
        account = m.group(0)
        with open(ACCOUNT_FILE, "w+") as f:
            f.write(account)
        print("account: " + account + " with password:" + password)
    else:
        print("creat account error!")
        quit()
    return account


def create_genesis(coinbase):
    # use os.system("puppeth") is another option

    global CHAIN_ID
    CHAIN_ID = input("id of chain (numbers):")

    g = '''
{{
    "nonce": "0x0000000000000042",
    "timestamp": "0x00",
    "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "extraData": "0x00",
    "gasLimit": "0x8000000",
    "difficulty": "0x0400",
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "mixhash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "coinbase": "{}",
    "alloc": {{
    }},
    "config": {{
        "chainId": {},
        "homesteadBlock": 0,
        "eip150Block": 0,
        "eip155Block": 0,
        "eip158Block": 0
    }}
}}
    '''.format(coinbase, CHAIN_ID)
    print(g)
    with open(GENESIS_FILE, "w+") as f:
        f.write(g)


def init_chain():
    run_command(["geth", "--datadir", DATA_FOLDER, "init", GENESIS_FILE])


def create_run_script(account):
    #  do not add   --http.corsdomain '*'  , it's not safe for private chain
    cmd = '''
    geth --datadir {} --networkid {} --port 30310  --http --http.api 'admin,eth,miner,net,txpool,personal,web3'  --mine --allow-insecure-unlock --unlock '{}' --password password.txt
    '''.format(DATA_FOLDER, CHAIN_ID, account)
    with open("run.sh", "w+") as f:
        f.write(cmd)
    run_command(["chmod", "+x", "run.sh"])
    # runCommand(["sh", "run.sh"])


def create_attach_script():
    cmd = '''
    geth attach {}geth.ipc
    '''.format(DATA_FOLDER)
    with open("attach.sh", "w+") as f:
        f.write(cmd)
    run_command(["chmod", "+x", "attach.sh"])


def main():
    ask_root_folder()
    account = create_account()
    create_genesis(account)
    init_chain()
    create_run_script(account)
    create_attach_script()
    print("DONE")


if __name__ == "__main__":
    main()

```



## 编写智能合约

我们还是使用 [上篇博客中的](https://yinhui1984.github.io/从零开始编写智能合约-使用traffle套件/)智能合约

```shell
mkdir ./contracts
cd ./contracts
touch Calculator.sol
```



```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Calculator {

    function add(int a, int b) public pure returns (int)  {
        return a + b;
    }

    function subtract(int a, int b) public pure returns (int) {
        return a - b;
    }
}
```



## 编译智能合约

如果你的电脑上没有`solc`, 请事先安装, 它是solidity的编译器, 官方教程: https://docs.soliditylang.org/en/v0.8.15/installing-solidity.html#installing-solidity



编译:

```shell
solc --bin --abi -o ./build ./Calculator.sol
```

+ `--bin` 生成16进制文件
+ `--abi`生成abi文件
+ `-o`输出目录



可以写一个`Makefile`来干这个事情:

```makefile
all:
	solc --bin --abi --overwrite -o ./build ./Calculator.sol
clean:
	rm -rf ./build/*
```



```
OSX MP16 ~/Downloads/privateNetwork/contracts ❯ tree
.
├── Calculator.sol
├── Makefile
└── build
    ├── Calculator.abi
    └── Calculator.bin
```



## 部署智能合约

新建一个node.js 项目`deploy`

```
mkdir -p deploy/
cd deploy/
npm init
touch index.js
```

安装`web3.js`

```shell
npm install web3
```

在`index.js`中加入如下代码:

```js
const fs = require('fs');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:8545');

const bytecode = fs.readFileSync('../build/Calculator.bin').toString();
const abi = JSON.parse(fs.readFileSync('../build/Calculator.abi').toString());

(async function () {
    const ganacheAccounts = await web3.eth.getAccounts();

    const calculator = new web3.eth.Contract(abi);

    calculator.deploy({
        data: bytecode
    }).send({
        from: ganacheAccounts[0],
    }).then((deployment) => {
        console.log('Contract was deployed at the following address:');
        console.log(deployment.options.address);
    }).catch((err) => {
        console.error(err);
    });
})();

```

>注意,  上面的部署代码没有使用账户的私钥, 是因为在前面的步骤中, 账户已经解锁了

**在部署之前需要先启动挖矿**

```shell
OSX MP16 ~/Downloads/pri/mychain ❯ ./attach.sh 

...

> miner.start()
null
> eth.blockNumber
26


```

部署:

```shell
OSX MP16 ~/Downloads/pri/c/d/deploy_js ❯ node ./index.js 
Contract was deployed at the following address:
0x1F55d61D5Aa8eC92FD1Da0f19FaC9D552A29DBBF
```

部署成功, 停掉挖矿, 否则电脑巨烫...

```shell
> miner.stop()
null
```



## 调用智能合约

调用智能合约就和 [从零开始编写智能合约-使用traffle套件](https://yinhui1984.github.io/从零开始编写智能合约-使用traffle套件/#7-demoapp调用合约)中的一样了, 可以跳转到那里进行参考


