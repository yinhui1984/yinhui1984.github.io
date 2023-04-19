---
title: "Error : WINDOWS.H Already Included"
date: 2022-07-12T20:30:29+08:00
draft: true
author: yinhui
categories: [windows]
tags: [vc++] 
---



关于编译Windows  MFC 项目遇到的`Error : WINDOWS.H Already Included`的解决方法

<!--more-->



## 现象

今天接到一个老旧的MFC项目, 安装windows虚拟机, VS2010 (真是老掉牙呀) , 最后编译时出现一堆如下报错:

```shell
1>  app.cpp
1>c:\program files (x86)\microsoft visual studio 10.0\vc\atlmfc\include\afxv_w32.h(16): fatal error C1189: #error :  WINDOWS.H already included.  MFC apps must not #include <windows.h>
```



## 解决方法

经过一番折腾, 直接说结论:

> \#include "stdafx.h" 必须放在其他头文件之前

这涉及到一个很恶心的问题, 如果多个头文件层层include, 得耐心地慢慢调整顺序



## 举例

比如 下面这个就会报错:

```c++
//a.h
#include "b.h"
#include "c.h"

//b.h
#include "xxx.h"

//c.h
#include "yyy.h"
#include "stdafx.h"

```

需要调整2处:

1,  `c.h` 中  `#include "stdafx.h"` 需要放到 `#include "yyy.h"`  前面

2,  `a.h` 中  `#include "c.h"`   需要放到 `#include "b.h"` 前面



最后这样:

```c++
//a.h
#include "c.h"
#include "b.h"

//b.h
#include "xxx.h"

//c.h
#include "stdafx.h"
#include "yyy.h"
```

