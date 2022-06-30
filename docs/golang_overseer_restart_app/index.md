# [Golang] 使用overseer实现APP重启




前两天在一个项目中需要实现这样一个功能"点击一个按钮或通过API来重启后台服务"

发现Github上有一个叫overseer的模块, 试用了一下,效果还不错

使用方法很简单

```go
package main

import (
	"fmt"
	"github.com/jpillora/overseer"
	"time"
)

func main() {
	overseer.Run(overseer.Config{
		Program: app,
	})
}

func app(overseer.State) {

	fmt.Println("app started : " + time.Now().Format("2006-01-02 03:04:05 pm"))

	fmt.Println("Hello, 回车键重启APP")

	_, _ = fmt.Scanln()

	overseer.Restart()
}
```



项目地址: https://github.com/jpillora/overseer

其README中介绍了如何使用这个模块来优雅地进行自我升级.


