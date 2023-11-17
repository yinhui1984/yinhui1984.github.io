# Golang记录panic到日志


将panic记录下来可以使用recover函数, 但由于golang 的 recover 函数只能捕获同一个 goroutine 中的 panic, 所以就有了下面的一些辅助函数

<!--more-->



```go
package main

import (
	"fmt"
	"log"
	"reflect"
	"runtime/debug"
)

// safeGo 启动一个新的 goroutine，并捕获并处理该 goroutine 中的 panic。
func safeGo(fn interface{}, args ...interface{}) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("Recovered in goroutine from panic: %v\n", r)
			}
		}()

		// 反射调用函数
		reflect.ValueOf(fn).Call(makeReflectArgs(fn, args...))
	}()
}

// safeDo 在当前的 goroutine 中执行函数，并捕获并处理 panic。
func safeDo(fn interface{}, args ...interface{}) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in main from panic: %v\n", r)
			log.Println("STACK TRACE:")
			log.Println(string(debug.Stack()))
		}
	}()

	// 反射调用函数
	reflect.ValueOf(fn).Call(makeReflectArgs(fn, args...))
}

// makeReflectArgs 创建 reflect.Value 类型的参数切片，用于反射调用。
func makeReflectArgs(fn interface{}, args ...interface{}) []reflect.Value {
	fnType := reflect.TypeOf(fn)
	if fnType.Kind() != reflect.Func {
		panic("safeGo: argument is not a function")
	}

	if len(args) != fnType.NumIn() {
		panic("safeGo: argument count mismatch")
	}

	var in []reflect.Value
	for _, arg := range args {
		in = append(in, reflect.ValueOf(arg))
	}
	return in
}

// 示例函数
func myFunc(arg1 int, arg2 string) {
	fmt.Printf("Function called with arg1=%d, arg2=%s\n", arg1, arg2)
	panic("Example panic")
}

func main() {
	// 在主 goroutine 中安全执行函数
	safeDo(myFunc, 10, "hello")

	// 在新的 goroutine 中安全执行函数
	safeGo(myFunc, 20, "world")

	// 为了演示，等待一段时间
	// 实际应用中可能需要使用 sync.WaitGroup 或类似机制
	select {}
}

```


