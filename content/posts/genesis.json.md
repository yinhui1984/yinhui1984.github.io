---
title: "genesis.json"
date: 2022-07-06T10:53:24+08:00
draft: false
author: yinhui
categories: [BlockChain]
tags: [genesis.json] 
---



对`创世文件`的介绍

<!--more-->

 

在 [https://yinhui1984.github.io/从零开始编写智能合约-手工打造/#编写创世文件](https://yinhui1984.github.io/从零开始编写智能合约-手工打造/#编写创世文件)中提到了`genesis.json`,

它是区块链的初始配置文件, 称为创世文件, 区块链中的第一个块(`Block`)需要用它来进行生成. 这个块称为创世块



## Genesis struct

在[go-ethereum](https://github.com/ethereum/go-ethereum)中定义如下:

```go
//go-ethereum-1.10.20/params/config.go

type Genesis struct {
	Config     *params.ChainConfig `json:"config"`
	Nonce      uint64              `json:"nonce"`
	Timestamp  uint64              `json:"timestamp"`
	ExtraData  []byte              `json:"extraData"`
	GasLimit   uint64              `json:"gasLimit"   gencodec:"required"`
	Difficulty *big.Int            `json:"difficulty" gencodec:"required"`
	Mixhash    common.Hash         `json:"mixHash"`
	Coinbase   common.Address      `json:"coinbase"`
	Alloc      GenesisAlloc        `json:"alloc"      gencodec:"required"`

	// These fields are used for consensus tests. Please don't use them
	// in actual genesis blocks.
	Number     uint64      `json:"number"`
	GasUsed    uint64      `json:"gasUsed"`
	ParentHash common.Hash `json:"parentHash"`
	BaseFee    *big.Int    `json:"baseFeePerGas"`
}
```

其中 `Config`字段:

```go
//go-ethereum-1.10.20/params/config.go

// ChainConfig is the core config which determines the blockchain settings.
//
// ChainConfig is stored in the database on a per block basis. This means
// that any network, identified by its genesis block, can have its own
// set of configuration options.
type ChainConfig struct {
	ChainID *big.Int `json:"chainId"` // chainId identifies the current chain and is used for replay protection

	HomesteadBlock *big.Int `json:"homesteadBlock,omitempty"` // Homestead switch block (nil = no fork, 0 = already homestead)

	DAOForkBlock   *big.Int `json:"daoForkBlock,omitempty"`   // TheDAO hard-fork switch block (nil = no fork)
	DAOForkSupport bool     `json:"daoForkSupport,omitempty"` // Whether the nodes supports or opposes the DAO hard-fork

	// EIP150 implements the Gas price changes (https://github.com/ethereum/EIPs/issues/150)
	EIP150Block *big.Int    `json:"eip150Block,omitempty"` // EIP150 HF block (nil = no fork)
	EIP150Hash  common.Hash `json:"eip150Hash,omitempty"`  // EIP150 HF hash (needed for header only clients as only gas pricing changed)

	EIP155Block *big.Int `json:"eip155Block,omitempty"` // EIP155 HF block
	EIP158Block *big.Int `json:"eip158Block,omitempty"` // EIP158 HF block

	ByzantiumBlock      *big.Int `json:"byzantiumBlock,omitempty"`      // Byzantium switch block (nil = no fork, 0 = already on byzantium)
	ConstantinopleBlock *big.Int `json:"constantinopleBlock,omitempty"` // Constantinople switch block (nil = no fork, 0 = already activated)
	PetersburgBlock     *big.Int `json:"petersburgBlock,omitempty"`     // Petersburg switch block (nil = same as Constantinople)
	IstanbulBlock       *big.Int `json:"istanbulBlock,omitempty"`       // Istanbul switch block (nil = no fork, 0 = already on istanbul)
	MuirGlacierBlock    *big.Int `json:"muirGlacierBlock,omitempty"`    // Eip-2384 (bomb delay) switch block (nil = no fork, 0 = already activated)
	BerlinBlock         *big.Int `json:"berlinBlock,omitempty"`         // Berlin switch block (nil = no fork, 0 = already on berlin)
	LondonBlock         *big.Int `json:"londonBlock,omitempty"`         // London switch block (nil = no fork, 0 = already on london)
	ArrowGlacierBlock   *big.Int `json:"arrowGlacierBlock,omitempty"`   // Eip-4345 (bomb delay) switch block (nil = no fork, 0 = already activated)
	GrayGlacierBlock    *big.Int `json:"grayGlacierBlock,omitempty"`    // Eip-5133 (bomb delay) switch block (nil = no fork, 0 = already activated)
	MergeNetsplitBlock  *big.Int `json:"mergeNetsplitBlock,omitempty"`  // Virtual fork after The Merge to use as a network splitter

	// TerminalTotalDifficulty is the amount of total difficulty reached by
	// the network that triggers the consensus upgrade.
	TerminalTotalDifficulty *big.Int `json:"terminalTotalDifficulty,omitempty"`

	// Various consensus engines
	Ethash *EthashConfig `json:"ethash,omitempty"`
	Clique *CliqueConfig `json:"clique,omitempty"`
}
```

### ChainID

区块链ID, 每一个对外公开的链ID是唯一的, 这个ID可以在https://chainlist.org上进行查询和申请

之所以加这样一个ChainID是为了防止"重放攻击":是在一个区块链上进行交易，并恶意或欺诈性地在另一个区块链上重复该交易.

参考这里[EIP155](https://github.com/ethereum/EIPs/issues/155)  或[这里](https://learnblockchain.cn/docs/eips/eip-155.html#eip-155-简单的重放攻击保护)

> EIP : Ethereum Improvement Proposals 以太坊改进提案



### HomesteadBlock

`HomesteadBlock` 以及后面的各种`xxxBlock`都是指的是ETH的硬分叉高度.

关于分叉,参考[这里](https://cointelegraph.com/blockchain-for-beginners/soft-fork-vs-hard-fork-differences-explained) 

这里可以看到主网的分叉历史 : https://ethereum.org/en/history/

对于新建测试网而言, 应该设置为0 , 表示你没有分叉



### TerminalTotalDifficulty

TTD, 终端总难度, 网络达到的总难度

最近提到TTD的一个[新闻](https://blog.ethereum.org/2022/05/30/ropsten-merge-announcement/#zh)是ETH将在`Ropsten`测试网的`TTD`达到一个值时触发链上合并, 以将其`POW`(工作量证明)升级为`POS`(权益证明, proof-of-stake)



### Ethash

Ethash是Ethereum使用的`POW`算法。这是目前主网使用的算法.

具体参考 https://ethereum.org/en/developers/docs/consensus-mechanisms/pow/mining-algorithms/

和  https://ethereum.org/en/developers/docs/consensus-mechanisms/pow/mining-algorithms/ethash/

以及 https://ethereum.stackexchange.com/questions/14/what-proof-of-work-function-does-ethereum-use



### Clique

Clique [/kliːk/] 是测试网使用的权益证明`POS` 算法,  主网一直在努力尽快切换到`POS`

具体参考这里 https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/



### Nonce 和 Mixhash

Nonce是一个64位的哈希值, mixhash字段包含一个256位的哈希值，一旦与nonce结合，就可以用来证明为了创建这个区块，已经花费了足够的算力.

后面搞篇博客专门来讲工作量证明



### Timestamp

Unix时间戳 。利用块与块之间的时间戳来调整难度, 以保证出块时间的稳定性.  最后两个块之间的较小周期导致难度级别增加，因此需要额外的计算来找到下一个有效块。如果周期太大，则难度和下一个区块的预期时间会降低。时间戳还允许验证链中块的顺序.



### ExtraData

额外数据. 想写入区块链的任意数据, 但只有32 个字节



### GasLimit

每个区块的Gas支出限额



### Difficulty

难度.  它代表了证明PoW所需的哈希值的难度等级。

它定义了挖矿目标，可以根据前一个区块的难度级别和时间戳来计算。难度越高，矿工为了发现有效区块必须执行的统计计算就越多。该值用于控制区块链的出块时间，使出块频率保持在目标范围内



###  Coinbase

这是一个160位的地址，挖矿成功后，挖矿奖励就会发送到这里。

有些地方称之为 Etherbase, 比如

```shell
miner.setEtherbase(personal.listAccounts[0]) 
```





### alloc

这个参数包含预先分配的钱包和余额列表.

初始化区块链的时候, 这个参数必须被填写, 否则没钱支付挖矿费用, 产生不了块.



### Number, GasUsed, ParentHash, BaseFee

```go
// These fields are used for consensus tests. Please don't use them
// in actual genesis blocks.
```







