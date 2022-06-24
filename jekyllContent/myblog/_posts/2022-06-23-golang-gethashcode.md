---
title: golang GetHashCode
author: yinhui
date: 2022-06-23
categories:  [BlockChain, golang]
tags: [hash]     # TAG names should always be lowercase
math: true
mermaid: true
toc: true
---



一个简单的helper函数  

```go
package helpers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

func GetHashCode(i interface{}) string {
	s := GetHashCodeHex(i)
	return hex.EncodeToString(s[:])
}

func GetHashCodeHex(i interface{}) [32]byte {
	j, err := json.Marshal(i)
	if err != nil {
		panic("can not Marshal")
	}

	return sha256.Sum256(j)
}

```



> 缺陷:
>
> 对于结构体, 生成hashcode时只使用了public字段, 如果同一结构体类型的两个对象只有private字段不同, 那么其生成的hashcode是一样的



测试:

```go
package main_test

import (
	"goplayground/helpers"
	"testing"
)

func TestGetHashCode(t *testing.T) {

	t.Run("基本类型测试", func(t *testing.T) {
		t.Helper()
		_ = helpers.GetHashCode(1)
		_ = helpers.GetHashCode(1.23)
		_ = helpers.GetHashCode("abc")

		if helpers.GetHashCode("123456") != helpers.GetHashCode("123456") {
			t.Error("相同字面量,应该有相同hash")
		}
	})

	t.Run("nil测试", func(t *testing.T) {
		t.Helper()

		if helpers.GetHashCode(nil) != helpers.GetHashCode(nil) {
			t.Error("nil应该有相同hash")
		}

	})

	t.Run("map测试", func(t *testing.T) {
		t.Helper()
		m1 := make(map[int]string)
		m1[0] = "hi"
		m1[1] = "world"

		m2 := make(map[int]string)
		m2[0] = "hi"
		m2[1] = "world"

		if helpers.GetHashCode(m1) != helpers.GetHashCode(m2) {
			t.Error("相同map应该有相同hash")
		}

		m3 := make(map[int]string)
		m3[0] = "hello"
		m3[1] = "world"

		if helpers.GetHashCode(m1) == helpers.GetHashCode(m3) {
			t.Error("不同map应该有不同hash")
		}

	})

	t.Run("结构体测试", func(t *testing.T) {
		t.Helper()

		type people struct {
			Name string
			Age  uint
		}
		p1 := people{}

		p2 := people{}

		if helpers.GetHashCode(p1) != helpers.GetHashCode(p2) {
			t.Error("相同类型空结构体应该有相同hash")
		}

		p3 := people{
			Name: "zhangSan",
			Age:  20,
		}
		p4 := people{
			Name: "zhangSan",
			Age:  20,
		}

		if helpers.GetHashCode(p3) != helpers.GetHashCode(p4) {
			t.Error("相同结构体应该有相同hash")
		}

		p5 := people{
			Name: "liSi",
			Age:  20,
		}

		if helpers.GetHashCode(p3) == helpers.GetHashCode(p5) {
			t.Error("不同结构体应该有不同hash")
		}

	})
}

```

