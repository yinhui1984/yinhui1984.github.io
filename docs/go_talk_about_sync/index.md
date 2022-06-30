# [Golang]聊聊sync







我们将用些简单的例子来尝试golang中sync包的各种有趣的情况



## 一个简单的DEMO

```go
package main

import "fmt"

var (
	sharedCounter = 0
)

func add(count int) {
	for i := 0; i < count; i++ {
		sharedCounter++
	}
}

func sub(count int) {
	for i := 0; i < count; i++ {
		sharedCounter--
	}
}

func show() {
	fmt.Println(sharedCounter)
}

func main() {
	add(1000000)
	sub(1000000)
	show()
}


```



程序很简单, 我们用一个共享变量`sharedCounter`作为一个计数器. `add`函数在计数器上循环添加一定的数值, sub则相反, show则是打印计数器当前的值.

程序运行结束后, `sharedCounter`应该为0, 上面代码的输出的确如此.



## 使用一个协程

如果对计数器进行加减的调用在不同的协程里面, 会怎么样呢?

```go
func main() {
	add(1000000)
	go sub(1000000)
	show()
}
```

会得到`1000000` , 因为`go sub(1000000)`刚启动, 程序就退出了.

或许我们应该等到`sub`函数执行结束

### 等待协程结束

+  错误的方式
   如果有C语言开发背景, 可能会想到通过设置一个flag来指示运算是否结束, 比如:

   ```go
   func sub(count int, done *bool) {
   	for i := 0; i < count; i++ {
   		sharedCounter--
   	}
   	*done = true
   }
   //....
   
   func main() {
   	add(1000000)
   
   	done := false
   	go sub(1000000, &done)
   
   	for !done {
   		time.Sleep(time.Millisecond * 10)
   	}
   	
   	show()
   }
   ```


   这虽然也能得到正确的输出, 但非常不优雅.

+  正确的方式1
   可以使用一个无缓冲的信道(或者说容量为1的信道)来充当flag

   ```go
   //...
   func sub(count int, done chan bool) {
   	for i := 0; i < count; i++ {
   		sharedCounter--
   	}
   	done <- true
   }
   //....
   func main() {
   	add(1000000)
   
   	done := make(chan bool)
   	go sub(1000000, done)
   	<-subDone
   	show()
   }
   ```

   这里利用了信道的特点: **当从信道中读取数据时,如果信道为空,读取将被阻塞直到有数据到达**.  所以 `<-subDone` 会一直阻塞, 直到通过`subDone <- true`向其中写入了数据



## 使用2个协程

上面的例子中, `sub(1000000, done)`是在新的协程中运行的, `add(1000000)`却不是, 如果他们都在新协程中运行, 主程序应该如何等待他们结束呢

很容易想到,  使用两次`<-done` 也就是说向信道索要两个计算完成的标志, `add`和 `sub`    计算完成后分别向其中放入标志.

```go
package main

import "fmt"

var (
	sharedCounter = 0
)

func add(count int, done chan bool) {
	for i := 0; i < count; i++ {
		sharedCounter++
	}

	fmt.Println("add done")
	done <- true
}

func sub(count int, done chan bool) {
	for i := 0; i < count; i++ {
		sharedCounter--
	}
	fmt.Println("sub done")
	done <- true
}

func show() {
	fmt.Println(sharedCounter)
}

func main() {
	done := make(chan bool)
	go add(1000000, done)
	go sub(1000000, done)
	<-done
	<-done
	show()
}

```

为了明确知道main函数的确是等待两个协程执行完毕了的, 我们在其中加入了`fmt.Println("sub done")`这样的输出

运行程序, 得到

```shell
add done
sub done
824933
```

**Opps, 虽然`add`和`sub` 都执行完毕了,但是结果不对(并且多次运行的结果还不相同), 期望接收应该是`0`**

再运行一次, 得到:

```shell
sub done
add done
-481342
```



原因是`add`和`sub`在交叉读取和写入`sharedCounter`这个变量, 他们共享了变量, 但在读取和写入的时候出现**"竞态"**

### 竞态

有多个协程运行时, 对于每个协程而言,其内部代码时顺序执行的, 但无法确定协程之间的执行顺序, 那么就说这些协程是并发的

如果一段代码无论是顺序执行还是并发执行,其结果都是确定的,那么这个代码就是并发安全的.

相反, 并发不安全的代码,可能会出现死锁,活锁,竞态

竞态则表示代码可执行,但可能出现结果不一致(错误结果)



###解决方法1, 利用信道

```go
func main() {
	done := make(chan bool)
	go add(1000000, done)
	<-done //1
	go sub(1000000, done)
	<-done //2
	show()
}
```

在`add`执行完毕之前, 首先会堵塞在`//1`处,  

```go
func add(count int, done chan bool) {
	//....
	done <- true
}
```

`add`函数执行最后一句 `done <- true`  后 `<-done //1`能取到值, 接触阻塞. 然后继续往下执行`sub`函数.

这虽然能得到正确输出, 但, 我们发现, **这实际是将并行执行修改成了串行执行.** 



### 解决方法2, 利用 Mutex 或 RWMutex

sync.Mutex 可能是同步包中使用最广泛的原语。它允许对共享资源进行互斥（不能同时访问). 

```go
mutex := &sync.Mutex{}

mutex.Lock()
//.... 更新共享变量
mutex.Unlock()
```

注意: 在官方文档中有这么一句 "Values containing the types defined in this package should not be copied."   ("包含这个包中定义的类型的值不应该被复制。") . 我们直到值传递就是复制然后传递, 所以我们代码中的mutex用的是引用传递.

```go
package main

import (
	"fmt"
	"sync"
)

var (
	sharedCounter = 0
	mutex         = &sync.Mutex{}
)

func add(count int, done chan bool) {
	for i := 0; i < count; i++ {
		mutex.Lock()
		sharedCounter++
		mutex.Unlock()
	}

	fmt.Println("add done")
	done <- true
}

func sub(count int, done chan bool) {
	for i := 0; i < count; i++ {
		mutex.Lock()
		sharedCounter--
		mutex.Unlock()
	}
	fmt.Println("sub done")
	done <- true
}

func show() {
	fmt.Println(sharedCounter)
}

func main() {
	done := make(chan bool)
	go add(1000000, done)
	go sub(1000000, done)
	<-done
	<-done
	show()
}
```

在读写`sharedCounter`之前先`Lock()`, 用完后`Unlock()`

如果我们在进行计算的时候加上点打印(仅测试用,非常影响速度)

```go
for i := 0; i < count; i++ {
		mutex.Lock()
		fmt.Println("--") // fmt.Println("++")
		sharedCounter--   // sharedCounter++
		mutex.Unlock()
	}
```

则可以看到 ++ 和 -- 是交叉着打印的, 说明是并行执行的.



另外, 还有`RWMutex` (读写锁), 除了与`Mutex`相同的`Lock()`和`Unlock()`方法外,  其还有用于共享读操作的`RLock()`和`RUnlock()`, 在读取共享变量时允许同时多个读取器能提高效率.  所以在频繁读写操作的代码中, 使用`RWMutex`效率要比`Mutex`高



### 解决方法3, 利用原子操作

原子操作在`"sync/atomic"`包中. 利用这个包中提供的函数可实现"无锁版"的共享变量读写

`原子操作`即是进行过程中不能被中断的操作，针对某个值的原子操作在被进行的过程中，CPU绝不会再去进行其他的针对该值的操作。为了实现这样的严谨性，原子操作仅会由一个独立的CPU指令代表和完成。**原子操作是无锁的，常常直接通过CPU指令直接实现。** 事实上，其它同步技术的实现常常依赖于原子操作

```go
package main

import (
	"fmt"
	"sync/atomic"
)

var (
	sharedCounter = int64(0)
)

func add(count int, done chan bool) {
	for i := 0; i < count; i++ {
		atomic.AddInt64(&sharedCounter, 1) //
	}

	fmt.Println("add done")
	done <- true
}

func sub(count int, done chan bool) {
	for i := 0; i < count; i++ {
		atomic.AddInt64(&sharedCounter, -1) //
	}
	fmt.Println("sub done")
	done <- true
}

func show() {
	fmt.Println(sharedCounter)
}

func main() {
	done := make(chan bool)
	go add(1000000, done)
	go sub(1000000, done)
	<-done
	<-done
	show()
}

```

原子操作的常用接口如下(以`int32`为例)

```go
//将addr指向的值和old进行比较, 如果相等,则将new赋值到addr指向的位置,并返回true, 如果不相等,则直接返回false
func CompareAndSwapInt32(addr *int32, old, new int32) (swapped bool)


//使用原子操作,将addr指向的位置增加一个delta
func AddInt32(addr *int32, delta int32) (new int32)

//原子读取
//当我们要读取一个变量的时候，很有可能这个变量正在被写入，这个时候，我们就很有可能读取到写到一半的数据。 所以读取操作是需要一个原子行为的。
func LoadInt32(addr *int32) (val int32)

//读取是有原子性的操作的，同样写入atomic包也提供了相关的操作包
func StoreInt32(addr *int32, val int32)


//此类型的值相当于一个容器，可以被用来“原子地"存储（Store）和加载（Load）任意类型的值。当然这个类型也是原子性的。
//有了atomic.Value这个类型，这样用户就可以在不依赖Go内部类型unsafe.Pointer的情况下使用到atomic提供的原子操作。
// A Value must not be copied after first use.
type Value struct {
	v interface{}
}

```



> 原子操作与互斥锁的区别
>
> 首先atomic操作的优势是更轻量，比如CAS可以在不形成临界区和创建互斥量的情况下完成并发安全的值替换操作。这可以大大的减少同步对程序性能的损耗。
>
> 原子操作也有劣势。还是以CAS操作为例，使用CAS操作的做法趋于乐观，总是假设被操作值未曾被改变（即与旧值相等），并一旦确认这个假设的真实性就立即进行值替换，那么在被操作值被频繁变更的情况下，CAS操作并不那么容易成功。而使用互斥锁的做法则趋于悲观，我们总假设会有并发的操作要修改被操作的值，并使用锁将相关操作放入临界区中加以保护。
>
> 下面是几点区别：
>
> - 互斥锁是一种数据结构，用来让一个线程执行程序的关键部分，完成互斥的多个操作
> - 原子操作是无锁的，常常直接通过CPU指令直接实现
> - 原子操作中的cas趋于乐观锁，CAS操作并不那么容易成功，需要判断，然后尝试处理
> - 可以把互斥锁理解为悲观锁，共享资源每次只给一个线程使用，其它线程阻塞，用完后再把资源转让给其它线程



> 不要轻易使用atomic
>
> https://texlution.com/post/golang-lock-free-values-with-atomic-value/





## 其它并发控制方法

上面的例子中, 我们都是使用的信道来进行并发控制 (`done <- true`与`<-done`), 这只是常用的方法之一



### WaitGroup

`sync.WaitGroup `拥有一个内部计数器。如果此计数器等于 0，则 `Wait()` 方法立即返回。否则，它将被阻塞，直到计数器为 0。

要增加计数器，我们必须使用` Add(int)`。要减少它，我们可以使用 `Done()` （将减少 1）或具有负值的相同 `Add(int)` 方法。

```go
package main

import (
   "fmt"
   "sync"
   "sync/atomic"
)

var (
   sharedCounter = int64(0)
)

func add(count int, wg *sync.WaitGroup) {
   for i := 0; i < count; i++ {
      atomic.AddInt64(&sharedCounter, 1)
   }

   fmt.Println("add done")
   wg.Done()
}

func sub(count int, wg *sync.WaitGroup) {
   for i := 0; i < count; i++ {
      atomic.AddInt64(&sharedCounter, -1)
   }
   fmt.Println("sub done")
   wg.Done()
}

func show() {
   fmt.Println(sharedCounter)
}

func main() {
   wg := sync.WaitGroup{}
   wg.Add(2)

   go add(1000000, &wg)
   go sub(1000000, &wg)

   wg.Wait()
   show()
}
```

注意:传递 `WaitGroup`时要使用引用传递(指针), 其不应该被复制. `func sub(count int, wg *sync.WaitGroup)`



### context.Context

`Context`提供了2个功能

1. 控制子协程结束
2. 传递值

其不在`sync`包中, 后面专门讲





## sync.Pool 对象复用

其提供一个"并发安全"的可复用的对象池. 用来减少频繁GC所代理的压力.

其大概意思是: 如果有旧对象可用,则用旧的, 没有再New一个

参考这批文章: https://www.cnblogs.com/qcrao-2018/p/12736031.html

以及这里 https://geektutu.com/post/hpg-sync-pool.html



在实际开发工作中, 不要一上来就想做使用`sync.Pool`它通常会带来问题(因为其`Get`出来的对象的状态是不确定的), 而应该遵循下面的原则:

1. 根据你收集到的需求设计你的代码（不要跳过这个步骤）。
2. 编写最简单、最清晰、最愚蠢的设计实现。
3. 如果客户满意，就停止
4. 如果客户不满意，而且他们认为应用程序的性能不能满足他们的要求，那么就剖析。
5. 解决最高性能的主导者
6. 剖析并进入第五阶段。然后进入3
7. 如果实在搞不定, 再想想`sync.Pool`



## sync.Once 只执行一次

sync.Once 提供了一种方法, 让相关代码只被执行一次

实际开发过程中, 经常有这样的场景: 你做了一个叫做`lowLevelApi`的包, 用于控制底层设备, 比如开关LED,  但在调用开关LED之前需要确保一些初始化工作已经完成, 所以你写了一个`InitEnv`的函数, 并告诉其它开发人员: 一定要先初始化哦. 

```go
package lowLevelApi

import "fmt"

func InitEnv() {
	fmt.Println("init environment")
}

func LedOn() {
	fmt.Println("LedOn")
}

func LedOff() {
	fmt.Println("LedOff")
}

```



其它开发人员经常会问你: 这个初始化函数如果被重复调用不会出问题吧?

因为他们的代码通常会这样写:

```go
package main

import (
	"fmt"
	"goplayground/lowLevelApi"
)

func turnLedOn() {
	fmt.Println("Turning LED on")
	lowLevelApi.InitEnv()
	lowLevelApi.LedOn()
	fmt.Println("LED on")
}

func turnLedOff() {
	fmt.Println("Turning LED off")
	lowLevelApi.InitEnv()
	lowLevelApi.LedOff()
	fmt.Println("LED off")
}

func main() {
	turnLedOn()
	turnLedOff()
}

```

上面的代码会输出

```
Turning LED on
InitEnv
LedOn
LED on
Turning LED off
InitEnv
LedOff
LED off

```



为了防止重复调用`InitEnv()`可能带来的问题, 则可以使用`sync.Once`

```go
var (
	once sync.Once
)

func InitEnv() {
	once.Do(func() {
		fmt.Println("InitEnv")
	})
}
```

这样`InitEnv()`即使被多次调用, 其内部逻辑只会执行一次

```
Turning LED on
InitEnv
LedOn
LED on
Turning LED off
LedOff
LED off
```



`sync.Once` 常应用于单例模式，例如初始化配置、保持数据库连接等。作用与 `init` 函数类似，但有区别。

- init 函数是当所在的 package 首次被加载时执行，若迟迟未被使用，则既浪费了内存，又延长了程序加载时间。
- sync.Once 可以在代码的任意位置初始化和调用，因此可以延迟到使用时再执行，并发场景下是线程安全的。



## sync.Cond 条件变量

`sync.Cond` 用于协调多个协程访问共享资源, 其中某些协程处于阻塞状态, 另外一个协程在条件准备好的时候来讲其它协程唤醒.



下面的例子中 `InitEnv`函数需要一点时间在准备`sharedCounter` 的初始值, 在这期间`Add`和`sub`处于`Wait`状态,  当准备好后, 将通知 `Add`和`Sub`继续向下执行



```go
package main

import (
	"fmt"
	"sync"
	"time"
)

var (
	sharedCounter int
)

func InitEnv(c *sync.Cond) {
	fmt.Println("begin InitEnv")
	time.Sleep(time.Second * 1)
	c.L.Lock()
	sharedCounter = 10
	c.L.Unlock()
	fmt.Println("Init Env Done, broadcast...")
	c.Broadcast()
}

func Add(cout int, c *sync.Cond) {
	c.L.Lock()
	c.Wait()
	sharedCounter += cout
	c.L.Unlock()
	fmt.Println("Add Done")
}

func Sub(count int, c *sync.Cond) {
	c.L.Lock()
	c.Wait()
	sharedCounter -= count
	c.L.Unlock()
	fmt.Println("Sub Done")
}

func main() {
	cond := sync.NewCond(&sync.Mutex{})
	go InitEnv(cond)
	go Add(5, cond)
	go Sub(2, cond)

	time.Sleep(2 * time.Second)
	fmt.Println("Final Counter:", sharedCounter)
}

```



输出

```
begin InitEnv
Init Env Done, broadcast...
Add Done
Sub Done
Final Counter: 13
```



`c.Broadcast()`唤醒所有等待的协程,   另外还有一个`Signal()`方法, 用于唤醒一个协程.  `sync.Cond`一般用于一对多的情况, 如果是一对一的情况, 用一个信道就可以轻松解决了



## sync.Map

内置的`map`不是并发安全的, 所以 `sync.Map` 提供了一个功能与`map`类似但是并发安全的版本

可以参考这篇文章  https://juejin.cn/post/6844903895227957262








