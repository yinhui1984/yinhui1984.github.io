---
title: "MFC窗体程序弹出命令行窗口显示日志输出"
date: 2022-07-13T17:38:13+08:00
draft: true
author: yinhui
categories: [windows]
tags: [vc++] 
---

如何让MFC窗体程序弹出命令行窗口并打印日志输出



<!--more-->



习惯了linux上运行程序时在`terminal`中查看打印的日志. 但在MFC窗口程序中却不行.  折腾了一下, 结果如下



##  弹出命令行窗口

在主程序的`XXX::InitInstance()`函数中添加

```c++
#ifdef _DEBUG
	if (!AllocConsole())
		AfxMessageBox("Failed to create the console!", MB_ICONEXCLAMATION);
#endif
```

在对应的`XXX::ExitInstance()`中添加

```c++
#ifdef _DEBUG
	if (!FreeConsole())
		AfxMessageBox("Could not free the console!");
#endif
```

这样在`DEBUG`模式下启动程序时, 会弹出命令行窗口



## 打印日志(含文件名, 代码行号)

```c++

#define LOG2CONSOLE(X)												\
{																	\
	std::string file = __FILE__;									\
	size_t index;													\
	for (index = file.size()-1; index > 0; index--) {				\
		if (file[index] == '\\') break;								\
	}																\
	std::string  fileName = file.substr(index + 1);					\
	std::stringstream ss;											\
	ss << X;														\
	std::string s = ss.str();										\
	_cprintf("%s:%i %s\n", fileName.c_str(), __LINE__, s.c_str());	\
}
```



>1, 注意要使用宏, 而不是函数, 否则代码文件名和代码行始终是定义的位置
>
>2, 宏换行的话, 除了最后一个大括号, 每一行后面都要接一个  `\`



##  使用

```c++
LOG2CONSOLE("[Clicked] my button clicked. the xxx value is:" << something);
```





## 使用printf

上面的宏中使用的是 `_cprintf`, 我发现在某些时候, 即便输出的是ascii字符, 也会出现乱码. 改成`printf`又打印不出来, 为了让`printf`能打印出来, 

修改:

```c
#ifdef _DEBUG
	if (!AllocConsole())
		AfxMessageBox("Failed to create the console!", MB_ICONEXCLAMATION);
#endif
```

为

```c++
#ifdef _DEBUG
	AllocConsole();
	//freopen("CONIN$", "r", stdin);
	freopen("CONOUT$", "w", stdout);
	freopen("CONOUT$", "w", stderr);
#endif
```



