---
title: "Visutal Studio VC++ 远程调试"
date: 2022-07-27T09:32:00+08:00
draft: false
author: yinhui
categories: [windows]
tags: [vs, vc++] 
---

如何使用Visual Studio进行C++项目远程调试



<!--more-->

这里说的是`VS`, 不是`VS Code`



## 普通的实践

一般的思路是, 在远程机器上安装VS远程调试工具.  将调试文件拷贝到远程机器.

但这会带来一下问题

+ 本地机器修改了代码,重新编译后需要重新拷贝到远程机器
+ 如果将代码放在远程, 本机访问远程机器的共享文件夹进行编码, 然后编译. 会带来问题: 如果编译的项目稍大, 编译超慢. `hotload`更是没法用



## 最佳实践

思路:
本地机器共享文件夹, 远程机器公共访问共享文件夹来运行程序. 这样确保编译和运行在同一目录. 修改代码,编译,调试效率就会高很多.

### 拷贝remote debuger

到`VS`的安装目录下拷贝`remote debuger`

```sh
C:\Program Files\Microsoft Visual Studio xxx\Common7\IDE\Remote Debugger
```

假设下面你的目录结构如下:

```sh
./to_debug
├── RemoteDebugger
│   └── x64
│       └── msvsmon.exe
└── my_code
    └── debug
        └── app.exe
```

### 共享目录

将to_debug目录共享, 确保远程机器能访问改共享目录

假设**本地ip**为`192.168.0.200`

远程机器可以

`\\192.168.0.200\to_debug`



### 运行msvsmon.exe

在远程机器上访问共享文件夹, 然后运行`msvsmon.exe`

第一次运行时会弹窗, 把能勾上的全勾上.然后在`设置`中选择'无需授权验证'和'超时时间'设置为0 , 0表示不超时.

运行后, 会看到: `MSvsoon`启动了名为`XXXX`的新服务器

`XXXX`是服务器名称和端口, 等会儿会用到



### 配置项目

在VS`解决方案资源管理器`中, 右键用做启动项目的`属性` 

`配置属性` --> `调试` -->`远程Windows调试器`

配置:

+ 远程命令: 在远程计算机上如何运行的你程序.  我们远程机器通过访问本地机器的共享目录来访问, 所以填写 `\\192.168.0.200\to_debug\mycode\debug\app.exe`
+ 工作目录`\\192.168.0.200\to_debug\mycode\debug`
+ 远程服务名称: `XXXX` 就是上一步中的服务名称和端口, 例如 `ADMIN-PC:4026`
+ 部署目录, 无需填写, 我们不需要部署和拷贝, 因为编译和运行本来就在同一目录



### 调试

平时我们调试时绿色箭头旁边选择的时本地调试器, 这里切换成`远程Windows调试器`



