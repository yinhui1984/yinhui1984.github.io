# WebAssembly


WebAssembly 相关

<!--more-->

## WebAssembly 是什么

### 定义

来自[MDN的解释](https://developer.mozilla.org/en-US/docs/WebAssembly/Concepts#what_is_webassembly):

*WebAssembly 是一种新型代码，可以在现代 Web 浏览器中运行，并提供新功能和主要性能提升。它的主要目的不是手写，而是设计为 C、C++、Rust 等源语言的有效编译目标。*
*这对 Web 平台有着巨大的影响——它提供了一种在 Web 上以接近本机的速度运行以多种语言编写的代码的方法，而客户端应用程序可以在 Web 上运行，而这是以前无法做到的。*
*更重要的是，您甚至不必知道如何创建 WebAssembly 代码来利用它。 WebAssembly 模块可以导入到 Web（或 Node.js）应用程序中，公开 WebAssembly 函数以通过 JavaScript 使用。 JavaScript 框架可以利用 WebAssembly 来提供巨大的性能优势和新功能，同时仍然使 Web 开发人员可以轻松使用这些功能。*

来自[webassembly.org](https://webassembly.org)的解释:

*WebAssembly（缩写为Wasm）是一种基于堆栈的虚拟机的二进制指令格式。Wasm被设计为编程语言的可移植编译目标，能够在网络上部署客户端和服务器应用程序。*

>通过上面的解释, 我们大概可以知道一下几点:
>
>+ WASM可以在浏览器中运行
>+ WASM可以在本地服务器上运行
>+ WASM是通过高级语言进行编译得到的一种二进制格式
>+ WASM可用使用各式各样你拿手的高级语言进行代码编写, 然后再编译而成
>+ WASM性能很棒
>+ WASM可以和JS混用
>+ WASM可移植性很强
>+ 有一个基于堆栈的虚拟机(Stack Based VM)



### 目标

来自(https://developer.mozilla.org/en-US/docs/WebAssembly/Concepts#webassembly_goals):https://webassembly.github.io/spec/core/intro/introduction.html

+ WebAssembly的设计目标如下
  - 快速、安全、便携:
    - **Fast**: 以接近原生代码的性能执行，利用所有当代硬件的共同能力。
    - **Safe**: 代码被验证并在内存安全[2](https://webassembly.github.io/spec/core/intro/introduction.html?highlight=jit#memorysafe)、沙盒环境中执行，防止数据损坏或安全漏洞。
    - **Well-defined**: 以一种易于非正式和正式推理的方式，充分而精确地定义了有效的程序及其行为。
    - **Hardware-independent**: 可以在所有现代架构、桌面或移动设备以及嵌入式系统上编译。
    - **Language-independent**: 不对任何特定的语言、编程模型或对象模型给予特权。
    - **Platform-independent**: 可以嵌入到浏览器中，作为一个独立的虚拟机运行，或集成到其他环境中。
    - **Open**: 程序能以简单和通用的方式与环境互操作。
  - 高效和便携的*代表*:
    - **Compact**: 有一种二进制格式，比典型的文本或本地代码格式更小，所以传输速度快。
    - **Modular**: 程序可以被分割成较小的部分，可以分别进行传输、缓存和消费。
    - **Efficient**: 可以在一个快速的单程中进行解码、验证和编译，同样也可以使用及时编译（JIT）或预先编译（AOT）。
    - **Streamable**: 允许在所有数据被看到之前，尽快开始解码、验证和编译。
    - **Parallelizable**: 允许将解码、验证和编译分割成许多独立的并行任务。
    - **Portable**: 不做任何在现代硬件中不被广泛支持的架构假设。

## WebAssembly到底长啥样

上面的定义和目标听起来非常的抽象, 不如生成一个WebAssembly并使用一下,来具体感受一下.

我们选用`Rust`语言来写一个简单的demo

先根据官网安装Rust: https://www.rust-lang.org/learn/get-started

```rust
fn main(){
    println!("Hello, i'm Rust!");
}
```

用rustc编译器编译和运行一下, 没有瑕疵:

```shell
OSX MP16 ~/Dow/wasm_e/standalone ❯ rustc ./hello.rs -o hello.exe                        
OSX MP16 ~/Dow/wasm_example/standalone ❯ ./hello.exe 
Hello, i'm Rust!
```

### "可以在本地服务器上运行"的WebAssembly:

#### 编译

```shell
rustup target add wasm32-wasi  && rustc hello.rs --target wasm32-wasi -o hello_standalone.wasm
```

> 其中wasm32-wasi 表示 WebAssembly with WASI ,  [WASI](https://wasi.dev)是WebAssembly的模块化系统接口



#### 运行

运行编译出来的WebAssembly需要用到"基于堆栈的虚拟机", 这个虚拟机我们称之为"运行时" (WebAssembly Runtime).  `WebAssembly Runtime`有很多, 这里有一个列表:  https://github.com/appcypher/awesome-wasm-runtimes    我们选择`wasmer` https://github.com/wasmerio/wasmer , 先根据官方文档安装好.

```shell
OSX MP16 ~/Dow/wasm_example/standalone ❯ wasmer ./hello_standalone.wasm
Hello, i'm Rust!
```



#### 跨平台运行

上面的`hello_standalone.wasm`我是在macos上编译出来的, 一个大胆的想法: 拿到windows上面去, 可以运行吗?

在windows上面安装好wasmer, 然后运行:

```
PS C:\Users\Administrator> wasmer "Z:\下载\wasm_example\standalone\hello_standalone.wasm"
Hello, i'm Rust!
```

完全没有问题.



> 注: 用cargo新建和编译项目更为通用一些, 参考这里 https://docs.wasmtime.dev/wasm-rust.html
> 用到的主要命令 
>
> rustup target add wasm32-wasi
> cargo install cargo-wasi
> cargo new MyProject
> cargo wasi run

### "可以在浏览器中运行"的WebAssembly

#### 编写工程

我们将使用 wasm-pack 这个工具, 先到官网安装好该工具  https://rustwasm.github.io/wasm-pack/  或使用 `cargo install wasm-pack` 安装

该工具会给我们生成很多JS和WebAssembly相结合的"胶水代码", 以便事情来得更简单.

新建项目: `wasm-pack new wasm-web`

到`./src/lib.rs `中追加一个加法代码

```rust
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

其中的`wasm_bindgen`是一个库, 在`Cargo.toml`中进行了声明

```toml
[dependencies]
wasm-bindgen = "0.2.63"
```

> wasm-bindgen工具有点像为主机绑定建议等功能提供的polyfill，以及为JS和wasm编译的代码（目前主要来自Rust）之间的高级交互提供的功能。更具体地说，这个项目允许JS/wasm与字符串、JS对象、类等进行交流，而不是纯粹的整数和浮点数。例如，使用wasm-bindgen，你可以在Rust中定义一个JS类，或者从JS中获取一个字符串，或者返回一个字符串。其功能也在不断增加! 详细信息参考这里:  https://rustwasm.github.io/wasm-bindgen/

#### 编译

```shell
wasm-pack build
```

其中生成的`./pkg/wasm_web_bg.wasm`就是"可以在浏览器中运行"的WebAssembly, 也就是大多数情况下所说的那种WebAssembly(非STANDALONE的, 需要JS来进行调用执行的, 类似于Library)

另外, 在`pkg/wasm_web.js` 和  `pkg/wasm_web_bg.js`生成了JS包装调用WebAssembly的胶水代码.

```js
/**
* @param {number} a
* @param {number} b
* @returns {number}
*/
export function add(a, b) {
    const ret = wasm.add(a, b);
    return ret;
}
```

可以看到JS中的`add`实际是对WebAssembly中的`add`函数的封装.

#### 运行

在项目的根目录下添加`index.html`

```html
<!DOCTYPE html>
<html lang="en-US">
<head>
    <meta charset="utf-8" />
    <title>example</title>
</head>
<body>
<label id="labelContent"></label>
<script type="module">
    import init, { greet, add } from "./pkg/wasm_web.js";
    init().then(() => {
        document.getElementById("labelContent").innerHTML = "2+2=" + add(2,2);
    });
</script>
</body>
</html>

```

在项目根目录下运行一个httpserver:

```shell
python -m SimpleHTTPServer 7777
```

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1665559247628017000-Snipaste_2022-10-12_15-19-51.jpg?raw=true)



## WebAssembly底层原理

### 现代编程语言的编译/运行方式

#### AOT 预先编译

Ahead-of-Time compilation, 预先编译

将源代码编译成机器代码. C/C++, Rust, Go是使用这类编译方式的代表

编译器获取程序代码（源代码）并将源代码转换为机器语言模块（称为对象文件）。另一个专门的程序，称为链接器，将这个对象文件与其他先前编译的对象文件（特别是运行时模块）结合起来，创建一个可执行文件。

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1665565283208220000-20000001000000CC000000CA2EBFF9B2.png?raw=true)



#### 解释型(Interpreted)

解释语言的过程是不同的。解释器不是在创建可执行文件之前将源代码翻译成机器语言，而是在程序运行的同时将源代码转换为机器语言。Python, Ruby, Perl 等是采用这种方式

当每次运行一个解释型程序时，解释器必须将源代码转换为机器代码，并且还要拉入运行时库。这个转换过程使程序的运行速度比用编译语言编写的类似程序要慢。

由于解释器在程序运行过程中进行了从源代码到机器语言的转换，因此解释语言通常导致程序的执行速度比编译程序慢。但通常得到的回报是，解释型语言通常是独立于平台的，因为每个不同的操作系统都可以使用不同的解释器。



![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1665565487366732000-2000000100000093000000BCE298370F.png?raw=true)



#### 字节码解释器 (Bytecode interpreters)

在解释和编译之间有一系列的可能性，这取决于在程序执行前进行的分析量。例如，Emacs Lisp被编译成字节码，字节码是Lisp源代码的高度压缩和优化表示，但不是机器码（因此不与任何特定的硬件相联系）。这种 "编译 "的代码然后由字节码解释器（本身是用C语言编写的）来解释。在这种情况下，编译后的代码是虚拟机的机器代码，它不是在硬件中实现的，而是在字节码解释器中实现的。这种编译解释器有时也被称为编译器。 在字节码解释器中，每条指令以一个字节开始，因此字节码解释器最多有256条指令，尽管不一定都会使用。一些字节码可能需要多个字节，而且可能是任意的复杂。

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1665566136155851000-2000000100000109000000BDEB75FEAC.png?raw=true)

#### JIT 及时编译

JIT: Just in Time

来自 https://en.wikipedia.org/wiki/Just-in-time_compilation

在计算机领域，及时编译（JIT）是一种执行计算机代码的方式，它涉及在程序执行期间（运行时）而不是在执行之前进行编译。这可能包括源代码翻译，但更常见的是字节码翻译成机器码，然后直接执行。实现JIT编译器的系统通常会持续分析正在执行的代码，并确定代码的哪些部分从编译或重新编译中获得的速度会超过编译该代码的开销。

JIT编译是两种传统的机器码翻译方法的结合--预先编译（AOT）和解释器，并且结合了两者的一些优点和缺点。粗略地说，JIT编译结合了编译代码的速度和解释的灵活性，以及解释器的开销和编译和链接（不仅仅是解释）的额外开销。JIT编译是动态编译的一种形式，并允许自适应优化，如动态重新编译和针对微架构的加速。解释和JIT编译特别适合动态编程语言，因为运行时系统可以处理迟来的数据类型并执行安全保证。

由于加载和编译字节码所需的时间，JIT在应用程序的初始执行中会造成轻微到明显的延迟。有时这种延迟被称为 "启动时间延迟 "或 "预热时间"。一般来说，JIT执行的优化越多，它生成的代码就越好，但初始延迟也会增加。因此，JIT编译器必须在编译时间和它希望生成的代码的质量之间做出权衡。启动时间除了JIT编译外，还可能包括增加的IO绑定操作：例如，Java虚拟机（JVM）的rt.jar类数据文件是40MB，JVM必须在这个上下文巨大的文件中寻找大量的数据 。

Sun公司的HotSpot Java虚拟机所使用的一种可能的优化是把解释和JIT编译结合起来。应用程序代码最初是被解释的，但JVM监控哪些字节码序列经常被执行，并将它们翻译成机器代码，以便在硬件上直接执行。对于只执行几次的字节码，这可以节省编译时间并减少初始延迟；对于经常执行的字节码，JIT编译被用来在缓慢解释的初始阶段后高速运行。此外，由于一个程序大部分时间都在执行其少数的代码，因此减少的编译时间是很重要的。最后，在最初的代码解释过程中，可以在编译前收集执行统计数据，这有助于进行更好的优化。

正确的权衡会因情况不同而不同。例如，Sun公司的Java虚拟机有两种主要模式--客户端和服务器。在客户端模式下，执行最小的编译和优化，以减少启动时间。在服务器模式下，会进行大量的编译和优化，通过牺牲启动时间，使应用程序运行后的性能最大化。其他的Java即时编译器使用方法执行次数的运行时间测量，结合方法的字节码大小，作为决定何时编译的启发式方法。还有一个使用执行次数结合循环的检测。[22] 一般来说，在短时运行的应用程序中准确预测哪些方法需要优化比在长时运行的应用程序中更难。

微软的Native Image Generator（Ngen）是另一种减少初始延迟的方法。 Ngen将通用中间语言图像(Image)中的字节码预编译（或 "预JIT"）为机器本地代码。因此，不需要在运行时进行编译。与Visual Studio 2005一起运送的.NET框架2.0在安装后立即对所有的微软库DLLs运行Ngen。预jitting提供了一种改善启动时间的方法。然而，它所产生的代码质量可能不如JIT化的代码，原因与静态编译的代码在没有剖析指导下的优化，在极端情况下不能像JIT编译的代码那样好的原因一样：缺乏剖析数据来驱动，例如，内联缓存。

也有一些Java实现将AOT（超前）编译器与JIT编译器（Excelsior JET）或解释器（GNU Compiler for Java）相结合。 



JIT编译从根本上使用可执行数据，因此带来了安全挑战和可能的漏洞。

JIT编译的实施包括将源代码或字节码编译成机器码并执行。这通常是在内存中直接完成的：JIT编译器将机器代码直接输出到内存中并立即执行，而不是像通常的超前编译那样将其输出到磁盘，然后作为一个单独的程序调用。在现代架构中，由于可执行空间的保护，这遇到了一个问题：任意的内存不能被执行，否则就会出现潜在的安全漏洞。因此，内存必须被标记为可执行；出于安全考虑，这应该在代码被写入内存后进行，并标记为只读，因为可写/可执行的内存是一个安全漏洞）。 例如，Firefox的JIT编译器在Firefox 46的发布版本中引入了这种保护。JIT喷洒是一类计算机安全漏洞，它使用JIT编译进行堆喷洒：然后产生的内存是可执行的，如果执行可以移动到堆中，就可以进行漏洞攻击。



近年来，及时编译在语言实现者中获得了主流关注，Java、.NET框架、大多数现代JavaScript实现和Matlab现在都包括JIT编译器。



> 更多类型的参考 :  https://en.wikipedia.org/wiki/Interpreter_(computing)



### WebAssembly的编译/运行方式

WebAssembly的编译/运行方式多种多样. 这取决于 浏览器引擎或`runtime`(运行时)的实现方式.

到 https://github.com/appcypher/awesome-wasm-runtimes   , 参考每个运行时的`Compilation / Execution modes`  一节, 他们对JIT, AOT, Interpreted 都有部分或全部支持. 

>注:为啥还要AOT, 除了速度快以外, 更重要的是一些平台出于安全考虑是不支持JIT的, 比如IOS

另外还有一种叫"动态分层编译": https://groups.google.com/a/chromium.org/g/blink-dev/c/Xzr6PQflTFA

但总体而言

```
                                       ┌────────────────────────┐
                                       │         runtime        │
                                       └────────────────────────┘
┌────────┐                                      ┌────┐           
│.c/.cpp │─emcc───┐                         ─ ─▶│AOT │           
└────────┘        │                        │    └────┘           
┌────────┐        │                             ┌────┐           
│  .rs   │─rustc──┤         ┌──────────┐   ├───▶│JIT │           
└────────┘        ├────────▶│  .wasm   │───┘    └────┘           
┌────────┐        │         └──────────┘   │    ┌────┐           
│  .go   │─tinygo─┘                         ─ ─▶│Inte│           
└────────┘                                      └────┘           
┌────────┐                                      ┌────┐           
│  ...   │                                      │... │           
└────────┘                                      └────┘                                  
```

将源代码编译成wasm过程中, 从编译器的角度而言, 我们可以将编译器分为三段:

+ 编译器前端: 前端主要负责预处理、词 法分析、语法分析、语义分析，生成便于后续处理的中间表示
+ 编译器中端: 中端对中间表示进行分析和各种优化
+ 编译器后端: 生成平台目标代码 . 我们使用的`rustup target add wasm32-wasi` 就是增加了一个编译器后端.  https://doc.rust-lang.org/nightly/rustc/platform-support.html



### .wasm结构

WebAssembly对应的文件.wasm是一种紧凑的二进制格式, 以上面例子中的`wasm_web_bg.wasm`为例, 看看这个二进制是如何组成的.



WebAssembly程序被组织成[模块](https://webassembly.github.io/spec/core/syntax/modules.html)，它是部署、加载和编译的单位。一个模块收集了类型、函数、表、内存和全局变量的定义。此外，它可以声明import和export，并以数据和元素段的形式提供初始化，或提供一个启动函数。

模块由 magic-number + version +  N个节(Section)组成, 其中Section由以下三部分组成:

+ section id
+ section 大小
+ section实际内容



| Section Name                                                 | Code | Description                                                  |
| ------------------------------------------------------------ | ---- | ------------------------------------------------------------ |
| [Type](https://www.wasm.com.cn/docs/binary-encoding/#type-section) | `1`  | 类型部分声明了所有将在模块中使用的函数签名。                 |
| [Import](https://www.wasm.com.cn/docs/binary-encoding/#import-section) | `2`  | 导入部分声明了所有将在模块中使用的导入。                     |
| [Function](https://www.wasm.com.cn/docs/binary-encoding/#function-section) | `3`  | 函数部分声明了模块中所有函数的签名（其定义出现在代码部分）   |
| [Table](https://www.wasm.com.cn/docs/binary-encoding/#table-section) | `4`  | 表部分包含零个或多个不同的[表](https://www.wasm.com.cn/docs/semantics/#table)的定义 |
| [Memory](https://www.wasm.com.cn/docs/binary-encoding/#memory-section) | `5`  | 线性内存部分提供了一个[线性内存](https://www.wasm.com.cn/docs/semantics/#linear-memory)的内部定义。在MVP中，每个内存都是默认内存，最多可能有一个线性内存导入或线性内存定义。 |
| [Global](https://www.wasm.com.cn/docs/binary-encoding/#global-section) | `6`  | 全局部分提供了一个零个或多个全局变量的内部定义。             |
| [Export](https://www.wasm.com.cn/docs/binary-encoding/#export-section) | `7`  | [导出](https://www.wasm.com.cn/docs/modules/#exports)声明    |
| [Start](https://www.wasm.com.cn/docs/binary-encoding/#start-section) | `8`  | 如果模块定义了一个开始部分，它所指的函数应该在实例被初始化后被加载器调用，包括它的内存和表虽然数据和元素部分，并且在导出的函数可被调用之前。 |
| [Element](https://www.wasm.com.cn/docs/binary-encoding/#element-section) | `9`  | 元素部分包含一个可能是空的元素段数组，指定一个给定表的固定（偏移量，长度）范围的初始内容，由其表索引指定。 |
| [Code](https://www.wasm.com.cn/docs/binary-encoding/#code-section) | `10` | 代码部分包含模块中每个函数的主体。在函数部分声明的函数和在这部分定义的函数体的数量必须相同，第i个声明对应第i个函数体。 |
| [Data](https://www.wasm.com.cn/docs/binary-encoding/#data-section) | `11` | 数据部分声明了加载到线性存储器中的初始化数据。               |
| [Name](https://www.wasm.com.cn/docs/binary-encoding/#name-section) | `0`  | 自定义部分                                                   |



更多的, 参考这里  https://webassembly.github.io/spec/core/binary/modules.html#binary-section



使用任意一个16进制查看器查看我们上面demo中的`wasm_web_bg.wasm`

```
OSX MP16 ~/Dow/wasm_e/wasm-web/pkg master ?12 ❯ hexdump -C ./wasm_web_bg.wasm
00000000  00 61 73 6d 01 00 00 00  01 0f 03 60 02 7f 7f 00  |.asm.......`....|
00000010  60 00 00 60 02 7f 7f 01  7f 02 24 01 03 77 62 67  |`..`......$..wbg|
00000020  1c 5f 5f 77 62 67 5f 61  6c 65 72 74 5f 62 35 30  |.__wbg_alert_b50|
00000030  61 33 64 37 33 35 34 65  31 34 39 62 37 00 00 03  |a3d7354e149b7...|
00000040  03 02 01 02 05 03 01 00  11 07 18 03 06 6d 65 6d  |.............mem|
00000050  6f 72 79 02 00 05 67 72  65 65 74 00 01 03 61 64  |ory...greet...ad|
00000060  64 00 02 0a 15 02 0b 00  41 80 80 c0 00 41 10 10  |d.......A..�.A..|
00000070  00 0b 07 00 20 00 20 01  6a 0b 0b 19 01 00 41 80  |.... . .j.....A.|
00000080  80 c0 00 0b 10 48 65 6c  6c 6f 2c 20 77 61 73 6d  |.�...Hello, wasm|
00000090  2d 77 65 62 21 00 7b 09  70 72 6f 64 75 63 65 72  |-web!.{.producer|
000000a0  73 02 08 6c 61 6e 67 75  61 67 65 01 04 52 75 73  |s..language..Rus|
000000b0  74 00 0c 70 72 6f 63 65  73 73 65 64 2d 62 79 03  |t..processed-by.|
000000c0  05 72 75 73 74 63 1d 31  2e 36 34 2e 30 20 28 61  |.rustc.1.64.0 (a|
000000d0  35 35 64 64 37 31 64 35  20 32 30 32 32 2d 30 39  |55dd71d5 2022-09|
000000e0  2d 31 39 29 06 77 61 6c  72 75 73 06 30 2e 31 39  |-19).walrus.0.19|
000000f0  2e 30 0c 77 61 73 6d 2d  62 69 6e 64 67 65 6e 12  |.0.wasm-bindgen.|
00000100  30 2e 32 2e 38 33 20 28  65 62 61 36 39 31 66 33  |0.2.83 (eba691f3|
00000110  38 29                                             |8)|
00000112
```



整理一下:

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1665645194203124000-Snipaste_2022-10-13_15-12-48.jpg?raw=true)

前8个字节是magic number (.asm) 和 版本

后面的是N个Section, section的第一个字节是ID号, 第二个字节是该section的长度(16进制, 实际内容长度)

比如

```
01 0F 03 60 02 7F 7F 00 60 00 00 60 02 7F 7F 01 7F
```

表示section id 是 `01`, 也就是 [Type](https://www.wasm.com.cn/docs/binary-encoding/#type-section) section, 长度为`0F` (15), 实际内容就是后面紧跟着的15个字节`03 60 02 7F 7F 00 60 00 00 60 02 7F 7F 01 7F`  内容是函数声明:

`03`表示 3个函数声明, 

`60 02 7F 7F 00` 表示一个函数声明, `60`	是函数声明标记,  后面是参数数量`02`,表示有两个参数,分别是`7F 7F` ( 7F表示i32) 最后一个字节是函数返回值类型, `00`表示没有返回值

`60 00 00` 表示参数数量为0, 也没有返回值

`60 02 7F 7F 01 7F` 表示有2个`7F`(i32)类型的参数, 返回值有1个, 类型也是`7F`



### WebAssembly 文本格式(wat)

上面的二进制格式人类阅读起来是非常痛苦的, 所以WebAssembly还提供了文本格式, 对应的后缀名是.wat (WebAssembly Text)

将.wasm转换为.wat需要用到 [wabt](https://github.com/WebAssembly/wabt) 工具包中的 `wasm2wat`

```
OSX MP16 ~/Dow/wasm_e/wasm-web/pkg master ?12 ❯ wasm2wat ./wasm_web_bg.wasm
(module
  (type (;0;) (func (param i32 i32)))
  (type (;1;) (func))
  (type (;2;) (func (param i32 i32) (result i32)))
  (import "wbg" "__wbg_alert_b50a3d7354e149b7" (func (;0;) (type 0)))
  (func (;1;) (type 1)
    i32.const 1048576
    i32.const 16
    call 0)
  (func (;2;) (type 2) (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.add)
  (memory (;0;) 17)
  (export "memory" (memory 0))
  (export "greet" (func 1))
  (export "add" (func 2))
  (data (;0;) (i32.const 1048576) "Hello, wasm-web!"))
```



在MDN上有该格式的详细解释:

https://developer.mozilla.org/zh-CN/docs/WebAssembly/Understanding_the_text_format





### Stack Machine

Wasm规范实际上也定义了一 台概念上的栈式虚拟机, 绝大多数的Wasm指令都是基 于一个虚拟栈工作:从栈顶弹出若干个数，进行计 算，然后把结果压栈。由于采用了栈式虚拟机，大部分Wasm指令(特别 是数值指令)都很短，只有一个操作码，这是因为操 作数已经隐含在栈上了。举例来说，i32.add指令只有 一个操作码0x6A。在执行时，这条指令从栈顶弹出两 个i32类型的整数，这两个整数相加，然后把结果(也是i32类型)压栈.

比如计算
$$
\begin{align*}
f(x) = 2x^2 + 1
\end{align*}
$$

对应的wat

```
(func $f (param $x i32) (result i32)
                 ;; stack: []
  (get_local $x) ;; stack: [x]
  (get_local $x) ;; stack: [x, x]
  (i32.mul)      ;; stack: [x*x]

  (i32.const 2)  ;; stack: [2, x*x]
  (i32.mul)      ;; stack: [2*x*x]

  (i32.const 1)  ;; stack: [1, 2*x*x]
  (i32.add))     ;; stack: [2*x*x+1]
)
```

WebAssembly中的大多数指令都以某种方式修改值栈。在上面的函数中，`get_local`把参数`x`推到栈上。`i32.mul`从栈上弹出两个值，把它们相乘，然后把结果推回栈上。`i32.const N`把值`N`推到栈上。该函数隐含地返回堆栈顶部的值。理论上，当从左到右写堆栈时，最左边的值是堆栈的顶部。对于需要多个参数的操作，它们的顺序与从堆栈中取出的顺序相反。例如:

```
(i32.const 1)
(i32.const 2)
(i32.sub)
```

这个程序计算出1-2

> 注意，虽然我们一直在使用i32，但WebAssembly理解不同大小的数字类型，包括整数（i8, i16, i32, i64, i128）和浮点数（f32, f64）。

那么, 我们在上一节中源代码

```rust
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

对应的wat就很好理解了: 获取2个局部值将其压栈, 然后调用指令 `i32.add` 从栈中弹出2个值进行加法操作, 并将结果压栈

```
  (func (;2;) (type 2) (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.add)
```

更多指令参考这里 :  包括循环, 条件判断等现代语言的基本元素.

https://github.com/sunfishcode/wasm-reference-manual/blob/master/WebAssembly.md#instruction-descriptions

 https://webassembly.github.io/spec/core/appendix/index-instructions.htm



### WASI



编程就绕不开和系统打交道, 比如文件系统, 磁盘读写, 网络通讯等. WebAssembly也一样, 但和其它编程语言不一样的是, WebAssembly面向的是一个概念性的机器,他需要跨各式各样的平台(可移植)并保证安全性. 所以便了以[WASI](https://github.com/WebAssembly/WASI)  (WebAssembly System Interface), 但值得注意的是其不是一个单一的标准系统接口，而是一个标准化的API的模块化集合。

这篇文章详细解释了为什么需要WASI以及如何实现和实现中遇到的问题: https://hacks.mozilla.org/2019/03/standardizing-wasi-a-webassembly-system-interface/

更多的参考这里 https://github.com/WebAssembly/WASI

一个简单的教程:

https://github.com/bytecodealliance/wasmtime/blob/main/docs/WASI-tutorial.md



有不少运行时(runtime)都支持WASI, 可以到 https://github.com/appcypher/awesome-wasm-runtimes  中查看 "**Host APIs supported**"字段 

