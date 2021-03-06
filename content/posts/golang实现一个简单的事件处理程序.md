---
title: "Golang实现一个简单的事件处理程序"
date: 2022-07-22T20:16:58+08:00
draft: false
author: yinhui
categories: [golang]
tags: [event]  
---



一个简单的事件处理程序



<!--more-->

demo目录结构

```
.
├── events
│   └── event.go
├── go.mod
├── main.go
└── user
    └── login.go

```





## event.go

```go
package events

import "sync"

type EventHandler func(event Event, arg interface{})

var lock sync.Mutex

type Event interface {
	Name() string
	Register(EventHandler) error
	Trigger(arg interface{}) error
}

type SimpleEvent struct {
	name     string
	handlers []EventHandler
}

func (e SimpleEvent) Name() string {
	return e.name
}

//事件注册
func (e *SimpleEvent) Register(h EventHandler) error {
	lock.Lock()
	e.handlers = append(e.handlers, h)
	lock.Unlock()
	return nil
}

//事件触发
func (e *SimpleEvent) Trigger(arg interface{}) error {
	lock.Lock()
	for _, h := range e.handlers {
		go h(e, arg)
	}
	lock.Unlock()
	return nil
}

func NewSimpleEvent(name string) Event {
	return &SimpleEvent{name: name}
}
```





## demo

### login.go

模拟登录登出的时候,发送事件

```go
package user

import (
	"goplayground/events"
	"time"
)

var (
	LoginEvent  = events.NewSimpleEvent("user.login")
	LogoutEvent = events.NewSimpleEvent("user.logout")
)

type LoginArg struct {
	Username string
	Password string
	Time     time.Time
}

type LogoutArg struct {
	Username string
	Time     time.Time
}

func Login(username, password string) (bool, error) {
	_ = LoginEvent.Trigger(LoginArg{username, password, time.Now()})
	return true, nil
}

func Logout(username string) error {
	_ = LogoutEvent.Trigger(LogoutArg{username, time.Now()})
	return nil
}

```



### main.go

```go
package main

import (
	"fmt"
	"goplayground/events"
	"goplayground/user"
	"time"
)

func main() {

	//事件处理程序 注册
	user.LoginEvent.Register(func(event events.Event, arg interface{}) {
		a := arg.(user.LoginArg)
		fmt.Printf("%q: %q %q %q\n", event.Name(), a.Username, a.Password, a.Time)
	})

	user.LogoutEvent.Register(func(event events.Event, arg interface{}) {
		a := arg.(user.LogoutArg)
		fmt.Printf("%q: %q %q\n", event.Name(), a.Username, a.Time)
	})

	//模拟
	user.Login("admin", "admin")
	time.Sleep(time.Second)
	user.Logout("admin")
	time.Sleep(time.Second)

}

```
