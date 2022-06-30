# [Golang]goroutings本质






原文: https://osmh.dev/posts/goroutines-under-the-hood



## 简介

Go从2012年开始出现，开发人员开始认识到它的强大，并慢慢过渡到用Go开发他们的项目。它在 "现代企业 "中变得非常流行，原因有很多，其中之一是它真的很容易学习和使用，而且能产生更干净的代码！特别是如果你有C++的背景。但这并不是许多开发者支持它的唯一原因。其他原因包括它的编译和执行速度有多快，它如何通过提供自己预设的代码风格标准来提高代码的可维护性和可读性，最重要的是，它处理并发的方式

现在让我们来关注一下go真正的特别之处，go处理并发的方式使多线程应用程序的工作速度快得惊人！但是在深入挖掘go是如何工作的之前，我们先来看看go是如何工作的。但在深入了解它是如何做到这一点的之前，让我们向后退一步，解释一下什么是并发性，什么是线程？

如果你已经了解了并发性、并行性和线程，请随意跳到goroutines部分。



## 并发与并行

[维基百科对并发的定义](https://en.wikipedia.org/wiki/Concurrency_(computer_science))是......开玩笑，如果你从来没有听说过并发，那么维基百科对它的定义反而会把你吓跑。简而言之，并发性允许程序在同一时间处理多个事物。还需要提到的是，它并不一定意味着在CPU层面上同时处理多个任务。但尽管如此，它还是同时处理它们，现在让我们来解释一下这意味着什么，下面的内容可能对每一个使用案例都不是100%正确的，因为一些CPU或操作系统在内部有不同的操作方式。我也会暂时忽略一些技术细节，比如线程，以使其更容易理解（我将使用 "任务 "一词而不是 "线程"），并在以后进行解释。但整体过程应该不会有太大差别。

![](https://osmh.dev/6a242ecaf216215a9a52bab41ca0de33/1-elg4tm3ohn_9btv0qnyceg.gif)



### 单核CPU的并发性

CPU要么有单核，要么有多核，为了简单起见，让我们先解释一下单核CPU的并发工作原理，然后再理解多核CPU的工作原理应该是小菜一碟了。在单核CPU上，单核（处理器）可能会欺骗你，让你以为它在同时执行多个任务，而事实上发生的情况是，处理器中的任务执行是重叠的，这意味着每个任务在处理器上都有一个时间窗口来运行，然后它将被另一个任务取代，在该处理器上执行。

换句话说，如果我们有任务 "A"，"B"，处理器可能首先分配给任务 "A "5微秒的时间来执行，然后即使任务A需要更多的时间来完成，它也会告诉任务 "B "来接管并做它需要的计算，比方说再5微秒。最后，当任务 "B "执行完毕后，任务 "A "可以再次开始处理5微秒的时间。由于它是在几乎没有时间（微秒）的情况下执行的，作为人类的你甚至不会注意到这些进程是重叠的，或者是一个接一个地执行的。它们会在屏幕上出现，好像它们是在同一时间运行的。而事实上，处理器一直在不同的时间窗口运行不同的任务，以实现并发。正如我们前面所描述的，处理器允许任务共享以处理它们需要的计算。内核层面的并发性是操作系统（operating system）调度器的责任，它是一个处理器依靠的程序来实现所有这些。



### 多核CPU上的并发性和并行性

现在，多核CPU的情况如何？由于多核（多处理器）基础设施的存在，CPU现在可以在同一时间运行多个任务。这意味着它可以让多个任务在不同的处理器上同时运行。现在你可能想知道 "这是否意味着我们不再需要并发性了？"答案是否定的，这并不意味着并发性 "不再"。并发和并行是两件完全不同的事情。并发可能还会存在于多核CPU上，使其更加高效。现在你明白了并发性在单核CPU上是如何工作的。试想一下，同样的事情在每一个处理器上都会发生。这是因为每个处理器/内核都运行着我们前面谈到的操作系统调度器的一个实例。这使得处理器上的并发性得以实现。这里有一些图片，可以更好地解释这个问题，但是不要被并发性的演示所迷惑，就好像它只在一个处理器上运行，而这些进程在共享处理器。只要想象一下，它对CPU上存在的每一个处理器都做了下面图片上演示的同样的事情。

![](https://osmh.dev/static/ec666b016a0673f9d9b6ebc7209f70fb/5e3e0/untitled.webp)

![](https://osmh.dev/static/c4b9c737607c985ad0c8d9895d090c4a/a8a2c/parallel-vs-concurrent-dotnet-core.webp)

编程语言有不同的方法来处理并发性, 如果它被语言支持的话。但这不是我们的主题，如果你有兴趣了解更多关于什么是并发的知识，我真的建议你去买Abraham Silberschatz、Peter Baer Galvin和Greg Gagne的《操作系统概念》这本书。它解释了所有这些概念以及其他有趣的东西。



## 什么是线程？

在上一节中，我们谈到了任务是如何分享处理器以运行一些计算的。事实是，任务甚至不能访问处理器，也不能直接使用它们。他们利用线程，而线程可以访问处理器。

我所能找到的关于线程的最好的定义是[Stackoverflow的pwnall](https://stackoverflow.com/a/5201906)。

*线程是一个执行环境，它是CPU执行指令流所需的所有信息。*

*假设你正在阅读一本书，你现在想休息一下，但你希望能够回来，并从你停止的确切位置继续阅读。实现这一目标的方法之一是记下页码、行数和字数。所以你阅读一本书的执行背景就是这3个数字。*

*如果你有一个室友，而她也在使用同样的技巧，她可以在你不使用这本书的时候拿走这本书，并从她停止的地方继续阅读。然后你可以把它拿回来，从你原来的地方继续读。*

*线程的工作方式也是如此。一个CPU给你的错觉是它在同时进行多个计算。它通过在每个计算上花费一点时间来做到这一点。它之所以能做到这一点，是因为它为每个计算都有一个执行环境。就像你可以和你的朋友分享一本书一样，许多任务可以分享一个CPU。*

*在更多的技术层面上，一个执行环境（因此是一个线程）由CPU的寄存器的值组成*。



每个线程都有自己独立的上下文，你甚至可以把一个多线程的程序看作是独立的程序，它们共同组成了一个更大的程序。这里有一张图，也许能帮助你直观地了解这一点。

![](https://osmh.dev/static/5375941b6d52381d573d58f77639198f/9a172/4_01_threaddiagram.webp)

单线程进程一次只能运行一个任务，而多线程进程可以同时运行N个任务。

线程的创建和管理有不同的方式或模式，可以这么说。一对一、多对一和多对多的模式。这基本上是用户（应用程序级别）线程和内核（操作系统级别）线程之间的映射。

![](https://osmh.dev/static/9c473e0b9d506dffcd581ba188efec56/83811/model-multithreading.webp)



## Gorouting: Go处理并发问题的方式

开发人员喜欢Go的原因之一是用它来实现并发性是多么容易和有效。这是该语言固有的一部分。Goroutines利用了一个已经存在了一段时间的概念，叫做 "coroutines"，本质上意味着将一组独立执行的函数 "coroutines "复用到操作系统层面的一组实际线程上，这些线程运行在用户层面(用户空间)。这就是使coroutines具有难以置信的效率的原因。你可能想知道为什么？因为当一个程序阻塞时--有些进程会因为很多原因导致线程阻塞--比如调用一个阻塞的系统调用（比如从用户那里读取输入），运行时就会自动将同一操作系统线程上阻塞的程序后面排队的其他程序转移到不同的、可运行的线程，这样它们就不会被阻塞。这在一开始可能会有点让人难以消化，所以让我们用一个例子来证明。

1. 首先，我们假设我们有4个goroutines需要被复用到内核级线程上，以便得到执行。我们还假设我们只需要两个内核级线程。而且我们有一个单一的处理器。
   ![](https://osmh.dev/static/8784ffc5a983903d8e36191b5994faea/c139f/blank-diagram.webp)

2. 现在让我们假设Go的运行时调度器决定将goroutines像这样（出于任何原因）突击到线程上。goroutine A和B将使用左边的内核线程运行，goroutine B和C将使用右边的线程运行。我们还假设goroutines将分别运行，从放置在goroutines池底部的goroutines开始，用环绕它们的边框演示。

   ![](https://osmh.dev/static/87084b8a652a9df8ed1d4d0960c61edf/c139f/blank-diagram-2.webp)

3. goroutines程序开始运行。但是，等等。"A "调用了一个阻塞的系统调用（例如read()语句）现在goroutine A是阻塞的，goroutine B也被阻塞了。
   ![](https://osmh.dev/static/a1a5c663bb243ca3528583124d21844b/bbe5b/blank-diagram-3.webp)

4. goroutine C 执行完毕
   ![](https://osmh.dev/static/da06ca8857a13c4f062fa7826562f545/e4604/blank-diagram-7.webp)

5. **Go的运行时调度器现在也许会意识到，把goroutine B移到另一个可运行的线程上会是一个更好的主意，而不是永远等待goroutine A完成。**
   ![](https://osmh.dev/static/5579c54f1b236f58728c36e920b0e544/41823/blank-diagram-4.webp)

6. goroutine D 执行完毕
   ![](https://osmh.dev/static/5b8b04326f404a0b13539da9238627e0/49d62/blank-diagram-5.webp)

7. Goroutine B现在也完成了，而左边被Goroutine A占据的内核线程仍在阻塞中。
   ![](https://osmh.dev/static/b0c5f1f992a77ccd74120a46548172af/49d62/blank-diagram-6.webp)

如果运行时调度器从不关心将阻塞的goroutines重新安排到另一个可运行的线程，那么goroutine B到现在也不会完成执行! 当然，这只是一个非常简单的例子，但想象一下，这发生在由成千上万个goroutine组成的更复杂、更大的程序上。差异将是巨大的! 开发者看不到这些，这就是问题的关键所在。**goroutines可以非常便宜：除了堆栈的内存之外，它们几乎没有开销，而堆栈的内存只有几千字节**。



还有一件事，堆栈的大小如何？幸运的是，这也是为了更好地提高效率而进行的管理。引用go的FAQ页面上的一个答案。

*为了使堆栈变小，Go的运行时间使用可调整大小的、有边界的堆栈。一个新诞生的goroutine被赋予几千字节的空间，这几乎总是足够的。当它不够时，运行时间会自动增加（和缩小）用于存储堆栈的内存，从而使许多goroutine能够在适量的内存中生存。每个函数调用的CPU开销平均约为三条廉价指令。在同一地址空间中创建成百上千个goroutines是很实际的。如果goroutines只是线程，系统资源会在更少的数量上耗尽。*

Go通道也被用来促进goroutines之间的通信，但我不打算在本文中重点讨论这个问题。如果你有兴趣，你可以[在这里阅读关于通道的工作原理](https://tour.golang.org/concurrency/2)



## 结论

Goroutines是语言的一个固有部分。它们利用了一个叫做coroutines的概念。它们很容易使用，而且在性能上也很便宜。Go的运行时调度器将goroutines复用到线程上，当一个线程阻塞时，运行时将阻塞的goroutines转移到另一个可运行的内核线程上，以达到尽可能高的效率。Go还提供了许多支持goroutines的工具，例如用于goroutines之间通信的通道。如果你要开发一个关注并发性的应用程序或服务，你绝对应该考虑使用Go
