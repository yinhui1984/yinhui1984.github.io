---
title: "Go语言中的http服务器"
date: 2022-06-06
author: yinhui
categories: [golang]
tags: [go, http]  
draft: false
---

go语言中`net/http`包对`http`服务与请求的处理



<!--more-->



## 简单的文件服务器

```go
package main

import (
	"log"
	"net/http"
)

func main() {
	err := http.ListenAndServe(":8080", http.FileServer(http.Dir(".")))
	if err != nil {
		log.Fatal(err)
	}
}
```

上面这个例子创建了一个以当前目录为站点跟目录的文件服务器,  我一般用这个来作为局域网文件共享.

然后写一个函数放到bash.rc 或zshrc中

```shell
#文件服务器
function fileserver(){
	echo "start file server :12345"
	cat <<EOF | tee /tmp/fileserver.go | go run /tmp/fileserver.go

package main

import (
	"log"
	"net/http"
)

func main() {
	err := http.ListenAndServe(":12345", http.FileServer(http.Dir(".")))
	if err != nil {
		log.Fatal(err)
	}
}
EOF
}
```



```shell
OSX MP16 ~/Downloads ❯ fileserver                                                         
start file server :12345
```

Python中有相同的功能

`python3 -m SimpleHTTPServer 7777`  或 `python3 -m http.server`



## 一个简单的WebServer

```go
package main

import (
	"log"
	"net/http"
)

func main() {

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		_, err := w.Write([]byte("Hello World!\n"))
		if err != nil {
			log.Println(err)
		}
	})

	err := http.ListenAndServe(":12345", nil)
	if err != nil {
		log.Fatal(err)
	}
}

```

访问一下试试:

```
OSX MP16 ~/Downloads/goplayground ❯ curl http://localhost:12345          
Hello World!
```



## http.HandleFunc

```go
http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		//...
	})
```

该方法提供了一种指定如何处理特定路由的请求的方法, 第一个参数为路由, 第二个参数为处理函数. 处理函数可写成匿名函数, 也可以声明为一个独立的函数

```go
func rootHandler(w http.ResponseWriter, r *http.Request) {
	_, err := w.Write([]byte("<h1 style=\"color:Tomato;\">Hello World</h1>"))
	if err != nil {
		log.Println(err)
	}
}

func main() {

	http.HandleFunc("/", rootHandler)
  //...
}
```

函数的第一个参数是`http.ResponseWriter`类型的值。这是用于向任何连接的HTTP客户端发送响应的机制。这也是响应标头的设置方式,比如`w.WriteHeader(http.StatusOK)`。第二个论点是指向`http.Request`的指针。这是从网络请求中检索数据的方式。例如，可以通过请求指针访问表单提交的详细信息

比如 下面的方法, 使用 `http://127.0.0.1:12345/?key=date` 时将返回当前的日期, 确实`key=`或`key`不正确时返回`http.StatusBadRequest`

```go
func rootHandler(w http.ResponseWriter, r *http.Request) {
	keys, ok := r.URL.Query()["key"]
	if !ok || len(keys[0]) < 1 {
		log.Println("Url Param 'key' is missing")
		w.WriteHeader(http.StatusBadRequest)
		_, err := w.Write([]byte("Url Param 'key' is missing"))
		if err != nil {
			log.Println(err)
			return
		}
		return
	}

	key := keys[0]
	switch key {
	case "date":
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(time.Now().Format("2006-01-02")))
		if err != nil {
			log.Println(err)
		}
	default:
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("Invalid key"))
		log.Println("Invalid key")
	}
}
```



### http.ResponseWriter

用于向任何连接的HTTP客户端发送响应

#### 设置相应标志头:

   ```go
   w.WriteHeader(http.StatusOK)
   ```

#### 获取或实则响应头

   ```go
   w.Header().Set("content-type", "application/json")
   w.Header().Add("foo", "bar")
   ```

#### 写入相应数据:

   ```go
   w.Write([]byte(time.Now().Format("2006-01-02")))
   ```

   

例子:

```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
)

type SystemInfo struct {
	Hostname string `json:"hostname"`
	Uptime   string `json:"uptime"`
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	info := SystemInfo{
		Hostname: "test",
		Uptime:   "2022-01-01 00:00:00",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	bytes, _ := json.Marshal(info)
	_, err := w.Write(bytes)
	if err != nil {
		log.Println("Error writing response: ", err)
	}
}

func main() {

	http.HandleFunc("/", rootHandler)

	err := http.ListenAndServe(":12345", nil)
	if err != nil {
		log.Fatal(err)
	}
}
```



```shell
OSX MP16 ~ ❯ curl localhost:12345                                                         
{"hostname":"test","uptime":"2022-01-01 00:00:00"}
```



### *http.Request

指向`http.Request`的指针, 通过改指针可以获取请求中的各种数据, 比如

#### 获取基本信息

```go
func rootHandler(w http.ResponseWriter, r *http.Request) {

	fmt.Println("User Agent: ", r.UserAgent())
	fmt.Println("Host: ", r.Host)
	fmt.Println("Remote Address: ", r.RemoteAddr)
	fmt.Println("Request URI: ", r.RequestURI)
	fmt.Println("Method: ", r.Method)
	fmt.Println("URL: ", r.URL)
	fmt.Println("Header: ", r.Header)

	w.WriteHeader(http.StatusOK)
}
```

输出:

```shell
User Agent:  curl/7.79.1
Host:  localhost:12345
Remote Address:  127.0.0.1:58967
Request URI:  /
Method:  GET
URL:  /
Header:  map[Accept:[*/*] User-Agent:[curl/7.79.1]]
```



#### 获取cookie

```go
func rootHandler(w http.ResponseWriter, r *http.Request) {

	//获取所有
	for _, c := range r.Cookies() {
		fmt.Printf("%s : %q\n", c.Name, c.Value)
	}

	//获取指定
	c, err := r.Cookie("token")
	if err != nil {
		log.Println(err)
	}
	fmt.Printf("%s : %q\n", c.Name, c.Value)

	w.WriteHeader(http.StatusOK)
}
```



`curl --cookie "token=abcdefg" http://localhost:12345`



#### 获取GET参数

+ 获取所有参数 `args := r.URL.Query()`

+ 获取指定参数(注:参数可能被重复写多次)

  比如: `localhost:12345/?id=5`
  
  ```go
  func rootHandler(w http.ResponseWriter, r *http.Request) {
  	ids, ok := r.URL.Query()["id"]
  	if !ok || len(ids[0]) < 1 {
  		log.Println("Url Param 'id' is missing")
  		return
  	}
  	id := ids[0]
  	log.Println("Url Param 'id' is: " + id)
  	
  	w.WriteHeader(http.StatusOK)
  }
  ```

或者

```go
func rootHandler(w http.ResponseWriter, r *http.Request) {

	id := r.FormValue("id")
	if id == "" {
		log.Println("Url Param 'id' is missing")
	}
	fmt.Println("id:", id)

	w.WriteHeader(http.StatusOK)
}
```



> 也可以通过r.Form来获取Get参数

#### 获取PATCH, POST or PUT参数

比如 `curl -d "id=5&format=1" http://localhost:12345/`

```go
func rootHandler(w http.ResponseWriter, r *http.Request) {
	//parse
	err := r.ParseForm()
	if err != nil {
		log.Println("ParseForm error:", err)
	}
	//get post args
	for k, v := range r.PostForm {
		log.Println("key:", k)
		log.Println("val:", v) // v []string
	}

	w.WriteHeader(http.StatusOK)
}
```

输出

```shell
2022/06/06 15:14:46 key: id
2022/06/06 15:14:46 val: [5]
2022/06/06 15:14:46 key: format
2022/06/06 15:14:46 val: [1]
```

ParseForm会填充r.Form和r.PostForm。
对于所有的请求，ParseForm解析来自URL的原始查询并更新r.Form。
对于POST、PUT和PATCH请求，它也读取请求正文，将其解析为一个表单，并将结果放入r.PostForm和r.Form中。在r.Form中，请求正文参数优先于URL查询字符串值。
如果请求体的大小还没有被MaxBytesReader限制，那么其大小将被限制在10MB。
对于其他HTTP方法，或者当内容类型不是application/x-www-form-urlencoded时，请求正文不被读取，并且r.PostForm被初始化为一个非零的空值。
ParseMultipartForm自动调用ParseForm。ParseForm是幂等的。



> r.Form属性包含了post表单和url中的get参数。
>
> r.PostForm属性只包含了post表单参数。



获取指定参数, 比如

```go
func rootHandler(w http.ResponseWriter, r *http.Request) {

	err := r.ParseForm()
	if err != nil {
		log.Println("ParseForm error:", err)
	}
	ids := r.PostForm.Get("id") //获取id参数的第一个值
	log.Println("id:", ids)

	w.WriteHeader(http.StatusOK)
}
```

或者

```go
func rootHandler(w http.ResponseWriter, r *http.Request) {

	id := r.PostFormValue("id")
	if id == "" {
		log.Println("Url Param 'id' is missing")
	}
	fmt.Println("id:", id)

	w.WriteHeader(http.StatusOK)
}
```



#### 获取上传文件

比如 `curl -F "file=@IMG_1526.PNG;type=image/png" http://localhost:12345/upload`

下面代码中:

`r.ParseMultipartForm(10 << 20)`将一个请求体解析为multipart/form-data。整个请求正文被解析，并且其文件部分最多存储在maxMemory字节的内存中，其余部分则存储在磁盘的临时文件中。ParseMultipartForm在必要时调用ParseForm。如果ParseForm返回一个错误，ParseMultipartForm将其返回，但也继续解析请求正文。在对ParseMultipartForm进行一次调用后，随后的调用没有任何影响.

`FormFile` 返回提供的表单key的第一个文件。如果需要，FormFile会调用ParseMultipartForm和ParseForm。

```go
package main

import (
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
)

func uploadHandler(w http.ResponseWriter, r *http.Request) {

	// Parse the multipart form in the request
	err := r.ParseMultipartForm(10 << 20) // 10 MiB
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	
	// FormFile returns the first file for the given key `file`
	// it also returns the FileHeader, so we can get the Filename, the Header and the size of the file
	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer func(file multipart.File) {
		err := file.Close()
		if err != nil {
			log.Println(err)
		}
	}(file)
	err = os.MkdirAll("./upload", 0777)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	localFile, err := os.OpenFile("./upload/"+handler.Filename, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer func(localFile *os.File) {
		err := localFile.Close()
		if err != nil {
			log.Println(err)
		}
	}(localFile)
	_, err = io.Copy(localFile, file)
	if err != nil {
		http.Error(w, "", http.StatusInternalServerError)
    return
	}

	w.WriteHeader(http.StatusOK)
}

func main() {

	http.HandleFunc("/upload", uploadHandler)

	err := http.ListenAndServe(":12345", nil)
	if err != nil {
		log.Fatal(err)
	}
}

```



#### 👍各种获取参数方式比较



| 操作              | 解析                         | 读取URL参数 | 读取Body表单 | 支持文本 | 支持二进制 |
| ----------------- | ---------------------------- | ----------- | ------------ | -------- | ---------- |
| r.Form            | r.ParseForm()                | Y           | Y            | Y        |            |
| r.PostForm        | r.ParseForm()                |             | Y            | Y        |            |
| r.FormValue()     | 自动调用r.ParseForm()        | Y           | Y            | Y        |            |
| r.PostFormValue() | 自动调用r.ParseForm()        |             | Y            | Y        |            |
| r.MultipartForm   | ParseMultipartForm()         |             | Y            | Y        | Y          |
| r.FormFile        | 自动调用ParseMultipartForm() |             | Y            |          | Y          |



### Handler , Handle , HandleFunc 与 http.ListenAndServe

#### 使用默认的Handler

先看一个简单的例子

```go
package main

import "net/http"

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello, world!"))
	})
	http.HandleFunc("/blog", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("This is my Blog"))
	})

	http.ListenAndServe(":12345", nil)
}
```

在启动一个HttpServer的时候, 其实我们就关心2个东西:

+ 地址
+ 路由: 将请求对应到相应的处理函数中去

这两个参数 在`http.ListenAndServe(":12345", nil)`中进行设置的, 第一个为地址, 第二个传递处理函数.

如果传递`nil`, 则采用默认的 

> The handler is typically nil, in which case the DefaultServeMux is used.

`http.ListenAndServe`的实现如下:

```go
func ListenAndServe(addr string, handler Handler) error {
	server := &Server{Addr: addr, Handler: handler}
	return server.ListenAndServe()
}
```

```go
type Handler interface {
   ServeHTTP(ResponseWriter, *Request)
}
```

可以看到 `Handler`是一个接口, 实现这个接口的话, 我们可以创建自己的Handler



#### 自定义Handler

定义一个结构体, 结构体实现 `ServeHTTP(w http.ResponseWriter, r *http.Request)`方法

然后使用 `Handle`函数进行路由注册

```go
package main

import "net/http"

type MyIndexHandler struct {
}

func (h *MyIndexHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Hello World"))
}

type MyBlogHandler struct {
}

func (h *MyBlogHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("This is my Blog"))
}

func main() {
	mux := http.NewServeMux()
	mux.Handle("/", &MyIndexHandler{})
	mux.Handle("/blog", &MyBlogHandler{})
	http.ListenAndServe(":12345", mux)
}
```

```shell
OSX MP16 ~ ❯ curl localhost:12345                                                          
Hello World
OSX MP16 ~ ❯ curl localhost:12345/blog                                                     
This is my Blog
OSX MP16 ~ ❯
```

但这明显看出来, 对每一个路由 都要高写一个xxxHandler结构体和实现ServeHTTP, 看上去非常混乱

这时候就可以用`mux.HandleFunc`来实现路由

```go
package main

import "net/http"

func main() {
   mux := http.NewServeMux()
   mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
      w.Write([]byte("Hello World"))
   })
   mux.HandleFunc("/blog", func(w http.ResponseWriter, r *http.Request) {
      w.Write([]byte("This is my Blog"))
   })

   http.ListenAndServe(":12345", mux)
}
```



#### 自定义ServeMux

在上面的例子中, `mux := http.NewServeMux()`还是使用了默认router, 其简单的同时也有不少缺点

比如, 其是通过url进行路由, 但不支持基于方法(GET, POST...)的路由, 不支持正则表达式等等

参考这个 https://www.alexedwards.net/blog/which-go-router-should-i-use

 



## 人气Web框架

参考这篇文章, 

https://blog.51cto.com/coderaction/3001008

其中有各框架的对比, 功能上iris最全

https://github.com/kataras/iris
