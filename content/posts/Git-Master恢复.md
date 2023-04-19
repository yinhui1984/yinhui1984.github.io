---
title: "Git Master恢复"
date: 2022-08-30T16:20:50+08:00
draft: true
author: yinhui
categories: [devops]
tags: [git] 
---

删库跑路, 如何恢复

<!---more-->

给代码打tag的时候, 发现 `fatal: 'xxx/myproject.git' does not appear to be a git repository`

服务器上一看, 被人删了, NB-PLUS



+ 首先本地机的clone中查看远程路径

```shell
> git remote -v
origin	root@XXX:/xxx/myproject.git (fetch)
origin	root@XXX:/xxx/myproject.git (push)
```



+ 到服务器上创建对应的路径

```
mkdir -p /xxx/
```

  

+ 在服务上创建一个空的repository

```shell
cd /xxx/
git init --bare myproject.git
```



+ 到本地机clone中 添加现存代码到服务器

```shell
git add .
git commit -m "re-add all"
git push origin master
```

