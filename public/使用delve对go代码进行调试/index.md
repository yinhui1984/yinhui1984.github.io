# 使用delve对go代码进行调试




`delve`就是go语言的`gdb`

<!--more-->





`delve`就是go语言的`gdb`,虽然 `gdb`也可以调试go程序 (https://go.dev/doc/gdb). 但是, 用`gdb`调试go程序有这些已知问题:

**已知问题**

+ 字符串pretty printing 只对字符串类型触发，而不是对其派生类型。
+ 运行库的 C 部分缺少类型信息。
+ GDB 不理解 Go 的名称资格，并将 "fmt.Print "视为带有". "的非结构化字面，需要加以引号。它对pkg.(*MyType).Meth形式的方法名反对得更厉害。
+ 从Go 1.11开始，调试信息默认是压缩的。旧版本的gdb，例如MacOS上默认提供的版本，并不理解压缩。你可以使用go build -ldflags=-compressdwarf=false来生成未压缩的调试信息。(为了方便，你可以把-ldflags选项放在GOFLAGS环境变量中，这样你就不必每次都指定它)。

使用 `delve`  https://github.com/go-delve/delve 更简单舒适



## 首次安装

```shell
go install github.com/go-delve/delve/cmd/dlv@latest
```



## 基本使用

+ 如果是调试主程序, `cd`到`main.go`所在目录, 运行 `dlv debug`
+ 如果是调试测试代码,  `cd`到`*_test.go`所在目录, 运行 `dlv test`

然后 和 `gdb`用法类似

1. `break`: 打断点 `b packageName.functionName`  或 `b fileName:lineNumber`
   比如 `b main.Add`,  `b main.main`
2. `continue`: 开始执行或继续执行 `c`   (开始执行也用`c`)
3. `next` :执行下一行 `n`
4. `step`: 单步进入 `s`
5. `stepout`: 单步退出`so`
6. `print`:打印 `p thevar `
7. `quit`退出调试 `q`

更多的  https://github.com/go-delve/delve/blob/master/Documentation/cli/README.md



## 高级使用

[dlv attach](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_attach.md) - 附加到正在运行的进程并开始调试。

[dlv connect]() - 用终端客户端连接到headless debug server。

[dlv core](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_core.md) - 检查一个核心转储。

[dlv dap](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_dap.md) - 启动一个通过调试适配器协议（DAP）通信的无头TCP服务器。

[dlv debug](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_debug.md) - 编译并开始调试当前目录下的主包，或指定的包。

[dlv exec](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_exec.md) - 执行一个预编译的二进制文件，并开始一个调试会话。

[dlv replay](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_replay.md) - 回放一个rr跟踪。

dlv run - 废弃的命令。使用'debug'代替。

[dlv test](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_test.md) - 编译测试二进制文件并开始调试程序。

[dlv trace](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_trace.md) - 编译并开始追踪程序。

dlv version - 打印版本。

[dlv log](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_log.md) - 关于记录标记的帮助

[dlv backend](https://github.com/go-delve/delve/blob/master/Documentation/usage/dlv_backend.md) -  `--backend` flag的帮助


