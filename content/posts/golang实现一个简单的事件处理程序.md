---
title: "Golang实现一个简单的事件处理程序"
date: 2022-07-22T20:16:58+08:00
draft: true
author: yinhui
categories: [golang]
tags: [event]  
---



一个简单的事件处理程序



<!--more-->

demo目录结构

```shell
.
├── events
│   └── event.go
├── go.mod
└── main.go
```





## event.go

```go
package events

type EventHandler func(event Event)

type Event interface {
	GetName() string
	GetData() interface{}
}

type EventBus struct {
	handlers map[string]EventHandler
}

func NewEventBus() *EventBus {
	return &EventBus{
		handlers: make(map[string]EventHandler),
	}
}

func (bus *EventBus) Register(name string, handler EventHandler) {
	bus.handlers[name] = handler
}

func (bus *EventBus) Dispatch(event Event) {
	if handler, ok := bus.handlers[event.GetName()]; ok {
		handler(event)
	}
}

func (bus *EventBus) DispatchAsync(event Event) {
	go bus.Dispatch(event)
}

var defaultEventBus *EventBus = nil

func init() {
	if defaultEventBus == nil {
		defaultEventBus = NewEventBus()
	}
}

func DefaultEventBus() *EventBus {
	return defaultEventBus
}

```





## demo

### login.go

一个ticker事件

```go
const TickEventName = "TickerEvent"

type TickerEvent struct {
}

func (e TickerEvent) GetName() string {
	return TickEventName
}

func (e TickerEvent) GetData() interface{} {
	return time.Now()
}
```



### main.go

```go
package main

import (
	"fmt"
	"simpleEvent/events"
	"time"
)

const TickEventName = "TickerEvent"

type TickerEvent struct {
}

func (e TickerEvent) GetName() string {
	return TickEventName
}

func (e TickerEvent) GetData() interface{} {
	return time.Now()
}

func makeEvents() {
	ticker := time.NewTicker(time.Second * 1)
	for true {
		<-ticker.C
		//触发事件
		events.DefaultEventBus().DispatchAsync(TickerEvent{})
	}
}

func main() {
	go makeEvents()

	//监听事件
	events.DefaultEventBus().Register(TickEventName, func(e events.Event) {
		fmt.Println("event received:", e.GetData())
	})

	for true {
		time.Sleep(time.Second * 10)
	}
}
```



输出:

```
event received: 2022-08-08 11:22:48.61607 +0800 CST m=+1.000275696
event received: 2022-08-08 11:22:49.616192 +0800 CST m=+2.000391077
event received: 2022-08-08 11:22:50.616163 +0800 CST m=+3.000355464
event received: 2022-08-08 11:22:51.616159 +0800 CST m=+4.000344450
event received: 2022-08-08 11:22:52.616195 +0800 CST m=+5.000373565
...
```

