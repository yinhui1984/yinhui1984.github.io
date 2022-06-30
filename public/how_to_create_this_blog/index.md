# 如何利用IFPS创建这个博客



### 第1步：在Github上新建一个项目

登录你的[Github](https://github.com)账号，按照向导 新建一个 Repository

假设你新建的Repo为： https://github.com/yourUserName/MyBlog.git

### 第2步： Clone项目到本地并尝试push

```shell
git clone https://github.com/yourUserName/MyBlog.git
```

尝试新建一个文件和push

```shell
cd MyBlog
git init
touch index.html
echo "hi" >> index.html
git add index.html
git commit -m "add index.html"
git branch -M main
git remote add origin https://github.com/yourUserName/MyBlog.git
git push -u origin main
```

尝试提交的时候，会让你输入github账号和token（gitbub弃用了密码登录，而是使用token）

如果你还没有生成过token，可以到Github你账户下的settings -> Developer settings 下生成token

### 第3步：使用hugo自动生成静态网站

+ 安装[hugo](https://gohugo.io)
```shell
brew install hugo
```

+ 按照官方教程新建一个网站
  官方教程： https://gohugo.io/getting-started/quick-start/

  假设你的网站名称叫MySite

+ 编译你的网站 `hugo -D` ，编译出来的静态网页的全部内容在MySite/public目录下
+ 在本地运行试试 `hugo server -D` , 不出意外，你应该能在http://localhost:1313上看到你的站点

### 第4步：使用 [fleek](https://fleek.co/)来将其自动部署到IPFS上

+ 关联Github repo和[fleek](https://fleek.co/)

  按照[https://docs.ipfs.io/how-to/websites-on-ipfs/introducing-fleek/#host-a-site](https://docs.ipfs.io/how-to/websites-on-ipfs/introducing-fleek/#host-a-site)  教程一步步地将你的Github项目，也就是上面的MyBlog.git和fleek项目关联起来，这样，但你的git有更新后，fleek会将你的内容自动部署到IPFS上

  fleek给你的临时子域名，就在项目的下方，类似 xxxxxx.on.fleek.co , 你可以跳过教程中的Domain names一节

+ 将hugo编译出的public下所有内容复制到本地的MyBlog下

  然后进行push

  ```shell
  cd MySite
  hugo -D
  cp -rf ./public/ ../MyBlog/
  cd ../MyBlog
  git add .
  git commit -m "your comments"
  git push origin main
  ```

  push成功后，稍等2分钟，让fleek自动拉取你最新的内容并重新部署

### 第5步 makefile

我们使用makefile来让新建Blog文章、测试和发布显得自动化一些

```shell
cd MySite
touch Makefile
vim Makefile
```

在Makefile中加入类似下面的内容：

```makefile
all:
	hugo -D
	
test:
# To ignore errors in a command line, 
# write a - at the beginning of the line's text (after the initial tab). 
# The - is discarded before the command is passed to the shell for execution
	-killall -9 hugo
	hugo server -D &
	sleep 2
	open http://localhost:1313/
	
release:
	hugo -D
	cp -rf ./public/  ../MyBlog/
	cd ../MyBlog/ && git add . && git commit -m "auto updated by script" && git push origin main
	
##how to use:
# make new file=this_is_one_article.md
new:
	hugo new posts/$(file)
	open ./content/posts/$(file) & 
```





## **大功告成**

