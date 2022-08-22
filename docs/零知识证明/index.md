# 零知识证明


关于零知识证明的若干知识

<!--more-->



## 这是啥

我知道一个秘密, 不能告诉你, 但我又得向你证明我的确知道这个秘密

## 为什么需要`零知识证明`

1. 区块链太透明
   区块链以透明著称, 但这会带来一些问题, 比如一些企业级应用中的数据并不适合这种透明性

2. `Web2.0`向`Web3.0`的过度

   在`Web3.0`概念很火爆的今天, 不得不承认一个观点: 在向`Web3.0`进发的过程中, `Web2.0`的已有数据和生态将长期过程,然后融合. 一个简单的问题是: `Web2.0`数据如何传递到`Web3.0`中, 并在`Web3.0`的区块链上形成`共识`.
   `零知识证明`提供了解决方案, 让`Web2.0`(以及一切链外数据)和`Web3.0`相互信任



所以`零知识证明`是`Web3.0`的基石. 其处于`L0`层.



##  阿里巴巴洞穴

如何向你的孩子解释`零知识证明协议` https://link.springer.com/content/pdf/10.1007/0-387-34805-0_60.pdf

简单翻译一下:

哦，我的孩子们，你们要知道，很久以前，在东部城市巴格达，住着一个叫阿里巴巴的老人。每天阿里巴巴都会去集市上买东西或卖东西。这个故事部分是关于阿里巴巴的，部分也是关于一个山洞的，一个奇怪的山洞，其秘密和奇迹至今存在。但我想得太远了...

有一天，在巴格达集市上，一个小偷从阿里巴巴手中抢走了一个钱包，阿里巴巴马上开始追赶他。小偷逃进了一个山洞，山洞的入口分叉成两条黑暗的蜿蜒通道：一条向左，另一条向右。

山洞大概长这个样子😂

```
xxxxxxx   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx   xxxxxxxxxxxxxxxxxxxxxxxxx        xxxxxxx
xxxxxxx   xxxxxxxxxxxxxxxxxxxxxxxxx    xxxxxxxxxxx
xxxxxxx   xxxxxxxxxxxxxxxxxxxxxxxxx    xxxxxxxxxxx
xxxxxxx   xxxxxxxxxxxxxxxxxxxx         xxxxxxxxxxx
xxxxxxx   xxxxxxxxxxxxxxxxxxxx         xxxxxxxxxxx
xxxxxxx   xxxxxxxxxxxxxxxxxxxx         xxxxxxxxxxx
xxxxxxx                    left        xxxxxxxxxxx
xxxxxxx                                xxxxxxxxxxx
xxxxxxx    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx                    xxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx                    xxxxxxxxxxxxxxxxxxxxxxx
xxxxxxx             right                  xxxxxxx
xxxxxxx                                    xxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```



 阿里巴巴没有看到小偷进入哪条通道。阿里巴巴不得不选择走哪条路，他决定向左走。左边的通道尽头是一个死胡同。阿里巴巴从岔路口一直找到死胡同，但他没有找到小偷。阿里巴巴对自己说，小偷也许在另一条通道上。于是他找了右边的通道，也是一个死胡同。但他再次没有找到小偷。"这个洞很奇怪，"阿里巴巴对自己说，"我的小偷去哪儿了？"

第二天，另一个小偷抓起阿里巴巴的篮子，像第一个小偷一样，逃进了那个奇怪的山洞。阿里巴巴追赶他，又一次没有看到小偷往哪边走。这一次，阿里巴巴决定向右搜索。他一直走到右侧通道的尽头，但没有找到那个小偷。他对自己说，和第一个小偷一样，第二个小偷也很幸运，走了阿里巴巴没有选择的通道。这无疑让小偷再次离开，悄悄地混入拥挤的集市。

日子一天天过去，每天都有小偷。阿里巴巴总是追着小偷跑，但他从未抓住过任何一个。第四十天，第四十个小偷抓起阿里巴巴的头巾，像之前的三十九个小偷一样，逃进了那个奇怪的山洞。阿里巴巴又一次没有看到小偷走了哪条路。这一次，阿里巴巴决定搜索左边的通道，但他又一次没有在通道尽头找到小偷。阿里巴巴非常疑惑。

他本可以像以前那样对自己说，第四十名小偷和其他三十九名小偷一样幸运。但这种解释非常牵强，甚至阿里-巴巴也不相信。四十名小偷的运气实在太好了，不可能是偶然的事情。一百万分之一的机会，这四十个人都能逃脱！所以阿里巴巴说，这四十个人的运气太好了，不可能是偶然的。所以阿里巴巴对自己说，一定有另一种更可能的解释。他开始怀疑，这个奇怪的山洞守护着一个秘密!

阿里巴巴开始探索这个奇怪山洞的秘密。他决定躲在右侧通道尽头的一些麻袋下面。经过一段非常不舒服的等待，他看到一个小偷来了，他感觉到自己被受害者追赶，就低声说了一句神奇的话，"芝麻开门"。阿里巴巴惊奇地看到洞壁滑开。小偷从洞口跑了出来。然后，墙又滑开了。追捕者赶到，发现通道的死胡同里只有阿里巴巴在麻袋下面，不由得大失所望。小偷已经逃走了。但阿里巴巴很高兴，因为他发现了奇异洞穴的秘密。

阿里巴巴用这些神奇的词语进行了实验。他惊奇地发现，当墙壁滑开时，右边的通道与左边的通道是相连的。现在，阿里巴巴知道了四十个小偷是如何从他手中逃脱的了。阿里巴巴用这些魔法词不断工作，最后他设法用新的魔法词取代它们，有点像你改变一些挂锁的密码。<u>阿里巴巴把这个故事和他的发现记录在一本可爱的插图手稿中。他没有写下新的魔法词，但他包括了一些关于它们的微妙线索。</u>

阿里巴巴的手稿在中世纪时抵达意大利。今天它在美国，靠近波士顿。在那里，它最近引起了一些好奇的研究人员的充分注意。通过对微妙线索的解密，这些研究人员甚至找回了新的魔力之词。

电视网络很快就知道了在巴格达发生的异常事件。一家大型美国电视网甚至获得了这个故事的独家报道。其中一位研究人员，某个叫米克-阿里的人，也许是阿里巴巴的后裔，**想证明他知道这个秘密。但他并不想透露这个秘密**。他的做法是这样的。

首先，一个电视摄制组拍摄了洞内两个死胡同的详细参观。然后所有人都走出了山洞。米克-阿里又独自进去，走了其中一条通道。然后，记者在摄像机的陪同下，只走到了岔路口。在那里，他抛出一枚硬币，在左右两边做出选择。如果硬币是正面，他就告诉米克从右边出来。如果硬币是反面，他就会告诉米克从左边出来。结果是正面，所以记者大声叫道："米克，从右边出来。" 米克就这样做了。
为了纪念那四十个小偷，这个演示场景被播放了四十次。每一次大家都回到洞外，米克独自进入其中一个通道，一路走来。然后记者和摄像机一直走到岔路口，在那里他通过抛硬币选择给米克的命令。米克在所有40个场景中都成功了。

任何不知道山洞秘密的人都会在第一次失败时被暴露。每一次新的测试都会使不知道秘密的人的成功机会减少两倍。另一方面，这个秘密让米克每次都能从规定的出口出来。

.......



##  `零知识证明`介绍

从上面的故事中, 可以看出 `零知识证明` (Zero Knowledge Proofs,  ZKPs) 是基于概率性的, 而不是确定性的, 随着测试的不断进行, 靠运气猜中的几率越来越低: 0.5 ^ n  

`零知识证明`一般包括3个阶段:

1. 证明者发送声明, 并将其发送给验证者

2. 验证者选择一个问题, 发送给证明者

3. 证明者生成答案, 发送给验证者, 验证者验证答案是否正确

但这里, 明显弊端就出来了:

1. 它需要验证者和证明者不停的进行多次交互, 以降低运气概率, 提高可信度. 这样的证明方式也称为 `交互式零知识证明`
2. 换一个验证者, 证明者又得需要重复上述过程



所以这又引入了另外一个概念`简洁的非交互式零知识证明`: "Zero-Knowledge Succinct Non-Interactive Argument of Knowledge"，或 "zk-SNARK"，

## zk-SNARK

`简洁的非交互式零知识证明`: "Zero-Knowledge Succinct Non-Interactive Argument of Knowledge":

`Succinct`: 简洁,  意味着证明很短（例如，对于加密货币的人来说，让我们说，它可以很容易地存储在现有区块链的交易中），并且可以很容易地被验证（例如，它可以由区块链节点在验证区块时廉价地检查）。

`Non-Interactive`: 非交互式意味着我们可以编写和存储一个证明，而不需要像主页中的介绍性 "斯诺克球 "例子那样有问题/答案循环。因此，一个证明可以被计算出来并发布在区块链上，每个人都可以验证它。



zk-Snark通常以5个主要步骤的序列来实现:

1.  要证明的计算的表示，作为一组变量之间的约束条件
2. 将上述约束集还原为多项式方程
3. 选择一个随机值，并将其和所有方程单向映射到一个 "同态 "空间，即一个线性组合（对系数的求和和乘法）仍然成立的空间，因此第2点中定义的方程在这个新空间中仍然成立。这是一个单向的映射，基于椭圆曲线数学，所以它是一种 "加密 "技术：如果你只知道被映射的加密点，那么计算原始值在计算上是不可行的。然后，原始选择的值将是一个秘密，永远不会被任何人知道。
4. 证明创建，通过将在所选（秘密）值中计算的方程映射到同态空间。在这个阶段，随机值被用来进一步隐藏方程，同时保留方程结构。
5. 通过计算方程是否成立来验证证明。验证不是直接在映射的空间中进行的，而是通过一个 "配对 "函数将数值再次映射到一个新的空间，该函数保留并允许检查原始变量之间的乘法。



是不是理解起来特别懵逼😳

通过一个来自这里的漫画更容易理解点 : https://github.com/KevinSmall/zk-SNARKs-Explainer/blob/master/translations/zh-TW/README.md



<img src="https://github.com/KevinSmall/zk-SNARKs-Explainer/blob/master/translations/zh-TW/page1.png?raw=true" style="zoom:50%;" />
<img src="https://github.com/KevinSmall/zk-SNARKs-Explainer/blob/master/translations/zh-TW/page2.png?raw=true" style="zoom:50%;" />

这里就看到了几个关键函数, 而他们实际是相当复杂的, 有能力的看这里 https://www.di.ens.fr/~nitulesc/files/Survey-SNARKs.pdf





## 扩展阅读

 **Awesome zero knowledge proofs (zkp)**

https://github.com/matter-labs/awesome-zero-knowledge-proofs


