---
title: "Golang文件下载"
date: 2022-07-22T20:54:37+08:00
author: yinhui
categories: [golang]
tags: [http, downloader]  
draft: false
---

go语言写的一个文件下载脚本

晚上想听点有声小说, 要两毛一集, 算了一下,一本书要几百块, 囊中羞涩, 于是拿出电脑搞个脚本

<!--more-->

## 单协程下载

```go
package main

import (
	"bufio"
	"io"
	"log"
	"net/http"
	"os"
)

func download(title string) {

	outputFile := "./output/" + title
	// if file exists, skip
	if _, err := os.Stat(outputFile); err == nil {
		log.Println("File exists, skip: ", outputFile)
		return
	}

	url := "https://马赛克xxxx/牧神记/" + title

	log.Println("Downloading: ", url)

	resp, err := http.Get(url)
	if err != nil {
		log.Println("error:" + err.Error())
	}

	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Println("close body error:" + err.Error())
		}
	}(resp.Body)

	file, err := os.OpenFile(outputFile, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		panic(err)
	}
	defer func(file *os.File) {
		err := file.Close()
		if err != nil {
			log.Println("close file error:" + err.Error())
		}
	}(file)

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		log.Println("copy file error:" + err.Error())
	}
	//貌似不会封IP, 如果封ip可以使用 https://github.com/Python3WebSpider/ProxyPool
	//time.Sleep(time.Second * 3)
}

func main() {
	//mp3list.txt 从网站主页复制的小说每一集的标题列表
  //0001_天黑别出门.mp3
	//0002_四灵血.mp3
	//0003_神通.mp3
  //...
  //省略数千行
	file, err := os.Open("mp3list.txt")
	if err != nil {
		panic(err)
	}
	defer func(file *os.File) {
		_ = file.Close()
	}(file)

	//read file line by line
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		title := scanner.Text()
		//download file
		download(title)
	}

}
```



## 多协程下载

感觉单协程太慢, 20个协程同时下载多爽... `golang`实现起来超级简单



### golang chan

搞一个队列

```go
var queue = make(chan int, 20)
```

下载前向队列里放一个元素

```go
		//download file
		queue <- 1
		go download(title)
```

队列最多放20个就会阻塞

下载完成或skip时就从队列中弹出

```go
	// if file exists, skip
	if _, err := os.Stat(outputFile); err == nil {
		log.Println("File exists, skip: ", outputFile)
		<-queue
		return
	}
```



```go
	//download finish
	<-queue
```



队列为空时, 表示下载完成, 程序退出

```go
	for true {
		time.Sleep(time.Second * 2)
		//if queue is empty, exit
		if len(queue) == 0 {
			break
		}
	}
```



### 完整代码

```go
package main

import (
	"bufio"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

var queue = make(chan int, 20)

func download(title string) {

	outputFile := "./output/" + title
	// if file exists, skip
	if _, err := os.Stat(outputFile); err == nil {
		log.Println("File exists, skip: ", outputFile)
		<-queue
		return
	}

	url := "https://马赛克xxxx/牧神记/" + title

	log.Println("Downloading: ", url)

	resp, err := http.Get(url)
	if err != nil {
		log.Println("error:" + err.Error())
	}

	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Println("close body error:" + err.Error())
		}
	}(resp.Body)

	file, err := os.OpenFile(outputFile, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		panic(err)
	}
	defer func(file *os.File) {
		err := file.Close()
		if err != nil {
			log.Println("close file error:" + err.Error())
		}
	}(file)

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		log.Println("copy file error:" + err.Error())
	}
	//貌似不会封IP, 如果封ip可以使用 https://github.com/Python3WebSpider/ProxyPool
	//time.Sleep(time.Second * 3)

	//download finish
	<-queue
}

func main() {
	//open file mp3list.txt
	file, err := os.Open("mp3list.txt")
	if err != nil {
		panic(err)
	}
	defer func(file *os.File) {
		_ = file.Close()
	}(file)

	//read file line by line
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		title := scanner.Text()
		//download file
		queue <- 1
		go download(title)
	}

	for true {
		time.Sleep(time.Second * 2)
		//if queue is empty, exit
		if len(queue) == 0 {
			break
		}
	}

}
```



### 代理池

我本次遇到的网站并没有`WAF` (Web Application Firewall),  所以可以狂下载

如果遇到被封IP的情况, 可以使用代理池:

https://github.com/Python3WebSpider/ProxyPool



##  深入理解

欢迎阅读本博客中的 `go语言中channel是如何工作的`

