# About docker


docker 学习总结

<!--more-->

## docker架构

**采用CS架构**

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138531329949000.png?raw=true)

+ 启动守护进程(服务器端)

```sh
sudo systemctl start docker
# or
dockerd
```

+ 使用客户端

```sh
#比如列举所有容器
docker ps -a
```

客户端和服务器端一般在同一台机器上, 但可以在不同的机器上 https://www.atlantic.net/vps-hosting/how-to-set-up-remote-access-to-docker-daemon/

+ REST API

```sh
# https://docs.docker.com/engine/api/v1.41/
curl --unix-socket /var/run/docker.sock http://localhost/v1.41/containers/json\?all\=true | jq

# 等同于 
docker ps -a
```



官方支持`go`和`python` 

下面的代码类似于 docker ps -a

```go
package main

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
)

func main() {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		panic(err)
	}

	containers, err := cli.ContainerList(context.Background(), types.ContainerListOptions{
		All: true,
	})
	if err != nil {
		panic(err)
	}

	for _, container := range containers {
		fmt.Printf("%s %s %s\n", container.ID[:10], container.Image, container.Names)
	}
}

```

> https://docs.docker.com/engine/api/sdk/



## docker engine 支持的平台架构

https://docs.docker.com/engine/install/

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138585597163000.png?raw=true)

> powerpc?
>
> https://developer.ibm.com/tutorials/install-docker-on-linux-on-power/



操作系统: 常见unix linux发行版, macos, windows server.



> 如果一个docker镜像是基于linux的， 其能运行在windows的docker engine上吗?
>
> 不能。Docker镜像是基于操作系统的，如果镜像是基于Linux的，则只能在Linux的Docker引擎上运行。Windows的Docker引擎无法直接运行Linux镜像，但是可以使用Linux子系统（[Windows Subsystem for Linux, WSL](https://learn.microsoft.com/en-us/windows/wsl/about)）在Windows上运行Linux镜像。

## 安装

例如:  https://docs.docker.com/engine/install/centos/

支持在线安装和离线安装



配置: `$HOME/.docker/daemon.json`

 https://docs.docker.com/engine/reference/commandline/dockerd/

```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false,
  "features": {
    "buildkit": true
  },
  "registry-mirrors": [
    "https://dockerproxy.com",
    "https://1nj0zren.mirror.aliyuncs.com",
    "https://docker.mirrors.ustc.edu.cn",
    "http://f1361db2.m.daocloud.io",
    "https://dockerhub.azk8s.cn"
  ]
}
```



> 免安装把玩: https://labs.play-with-docker.com



![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138634207029000.png?raw=true)



## 镜像与容器

Docker 镜像是 Docker 容器的基础，是一个只读模板。Docker 镜像可以用来创建 Docker 容器。容器是镜像的运行实例.

### 获取第三方镜像

```sh
$ docker images
REPOSITORY   TAG       IMAGE ID   CREATED   SIZE

$ docker pull ubuntu
Using default tag: latest
latest: Pulling from library/ubuntu
677076032cca: Pull complete 
Digest: sha256:9a0bdde4188b896a372804be2384015e90e3f84906b750c1a53539b585fbbe7f
Status: Downloaded newer image for ubuntu:latest
docker.io/library/ubuntu:latest

$ docker images
REPOSITORY   TAG       IMAGE ID       CREATED       SIZE
ubuntu       latest    58db3edaf2be   11 days ago   77.8MB
```



> 官方镜像库: https://hub.docker.com

### 创建和运行容器



```sh
$ docker ps
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
$ docker run -dit --name c1 ubuntu
8d7f5c90cb56e2cce64af39301da208703f7be669f794d716f4ea948c8e00ae4
$ docker run -dit --name c2 ubuntu
3b933714da4c98c774b9f9a0192e281f1a0b99f0389617faf3f26c86491ac946
$ docker ps
CONTAINER ID   IMAGE     COMMAND       CREATED          STATUS          PORTS     NAMES
3b933714da4c   ubuntu    "/bin/bash"   7 seconds ago    Up 6 seconds              c2
8d7f5c90cb56   ubuntu    "/bin/bash"   21 seconds ago   Up 20 seconds             c1
```

> run = create + start

```sh
$ docker exec c2 bash -c 'echo "i am c2" >> /tmp/hi.txt'

$ docker exec c2 cat /tmp/hi.txt
i am c2

$ docker exec c1 bash -c 'echo "i am c1" >> /tmp/hi.txt'

$ docker exec c1 cat /tmp/hi.txt
i am c1
```

```sh
$ docker exec -it c1 bash
root@8d7f5c90cb56:/# cat /tmp/hi.txt 
i am c1
root@8d7f5c90cb56:/# 
```



> more CLI:  https://docs.docker.com/engine/reference/commandline/cli/
>
> cheatsheet: [/Users/zhouyinhui/Desktop/docker_training/Docker备忘清单.pdf](/Users/zhouyinhui/Desktop/docker_training/Docker备忘清单.pdf)



### 创建自己的镜像

举例: 创建一个带有C++编译环境的镜像

```sh
~/Desktop/docker_training ❯ docker exec -it c1 gcc                       
OCI runtime exec failed: exec failed: unable to start container process: exec: "gcc": executable file not found in $PATH: unknown
```



#### 方式1 在容器中修改

第一步, 选择一个基础容器

```
docker pull ubuntu
docker run -dit --name c1 ubuntu
```

第二步, 进入容器内进行环境安装

```sh
~/Desktop/docker_training ❯ docker exec -it c1 bash                     
root@bd8ab473d7e4:/# apt-get update
Hit:1 http://security.ubuntu.com/ubuntu jammy-security InRelease
Hit:2 http://archive.ubuntu.com/ubuntu jammy InRelease
Hit:3 http://archive.ubuntu.com/ubuntu jammy-updates InRelease
Hit:4 http://archive.ubuntu.com/ubuntu jammy-backports InRelease
Reading package lists... Done
root@bd8ab473d7e4:/# apt-get install build-essential
...
...

root@bd8ab473d7e4:/# gcc --version
gcc (Ubuntu 11.3.0-1ubuntu1~22.04) 11.3.0
Copyright (C) 2021 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

```

> 注意: 这时的C++环境在容器中, 而不是镜像中

第三步, 基于修改后的容器创建新镜像

```sh
~/Desktop/docker_training ❯ docker commit c1 ubuntu_cpp
sha256:c22bb41b728e6298f639fa3601fb49cc9184461c9fd0ab8561d3290dd3bc026d

~/Desktop/docker_training ❯ docker images | grep ubuntu
ubuntu_cpp           latest       c22bb41b728e   18 seconds ago   392MB
ubuntu               latest       58db3edaf2be   12 days ago      77.8MB
```

```sh
~/Desktop/docker_training ❯ docker run -it --rm ubuntu_cpp gcc --version
gcc (Ubuntu 11.3.0-1ubuntu1~22.04) 11.3.0
Copyright (C) 2021 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
```



#### 方式2 dockerfile

Dockerfile 是一个文本文件，其中包含了创建 Docker 镜像的说明和指令。它可以被 Docker 引擎读取并用于创建一个新的镜像.

第一步, 新建`Dockerfile`

```dockerfile
# Use the official Ubuntu base image
FROM ubuntu:22.04

LABEL Name="cpp env based on ubuntu"
LABEL Version="0.1"

# Update the package repository and install build-essential
RUN apt-get update && apt-get install -y build-essential

# Set the working directory
WORKDIR /app

# Run a command when the container starts
# RUN是build时运行, CMD是启动Container时运行
CMD ["/bin/bash"]

```

第二步, build

```shell
docker build -t ubuntu_cpp_2 .
```

> 使用代理: `docker build --build-arg  all_proxy=socks5://127.0.0.1:7890 .  `

```sh
~/De/d/d/create_ubuntu_cpp_image ❯ docker build -t ubuntu_cpp_2  --build-arg  all_proxy=socks5://127.0.0.1:7890  .
[+] Building 168.2s (7/7) FINISHED
...
...

Use 'docker scan' to run Snyk tests against images to find vulnerabilities and learn how to fix them
```

```shell
~/De/d/d/create_ubuntu_cpp_image ❯ docker images | grep ubuntu        
ubuntu_cpp_2         latest       1b3b746eb6cf   About a minute ago   392MB
ubuntu_cpp           latest       c22bb41b728e   54 minutes ago       392MB
ubuntu               latest       58db3edaf2be   12 days ago          77.8MB
```

```shell
~/Desktop/docker_training ❯ docker run -it --rm ubuntu_cpp_2 gcc --version
gcc (Ubuntu 11.3.0-1ubuntu1~22.04) 11.3.0
Copyright (C) 2021 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
```



> more:  https://docs.docker.com/engine/reference/builder/
>
> 参考别人写的Dockerfile:  https://github.com/search?q=in%3Apath+%22Dockerfile%22&type=Repositories



## 容器与宿主机或其他容器交互

### 数据卷

Docker数据卷是一个独立的目录，存储在宿主机上，并且可以与一个或多个容器共享。与容器的文件系统不同，数据卷可以在容器之间共享和重用，并且数据卷内的数据不会随着容器的删除而丢失。可以使用数据卷来存储需要长期保留的数据，如配置文件，数据库文件等。数据卷可以使用`-v`或`--mount`选项挂载到容器上。

举例: 代码保存在宿主机上, 在宿主机上愉快的写代码, 在docker中编译和运行

`-v 宿主机文件夹:容器文件夹`

```sh
docker run --rm -v `pwd`:/app/ --workdir "/app/" -it ubuntu_cpp
```

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138702769883000.png?raw=true)

>如果容器内的目标文件夹已经有了内容?
>
>当把一个数据卷挂载到一个容器时，如果容器内的目标文件夹已经有了内容，这取决于所使用的特定挂载选项。如果--mount选项和--volume标志一起使用，并且没有设置--read-only标志，那么容器的文件夹中的现有内容就会被卷的内容覆盖。如果--mount选项和--volume标志一起使用，并且设置了--read-only标志，卷的内容将以只读模式提供给容器，而在容器内所做的任何改变都不会被保存到卷中。如果不使用--mount选项，而使用-v标志，默认行为是将卷挂载为读写卷，并覆盖容器文件夹中的现有内容。



### 网络

Docker 容器网络是指容器如何在 Docker 主机上与网络以及其他容器进行通信的方式。Docker 可以创建一个容器网络，容器可以通过该网络进行通信

#### 网络驱动1: Bridge(桥接)

https://docs.docker.com/network/bridge/

+ 它是一个在主机上创建的私有默认网络。
+ **链接到这个网络的容器有一个内部IP地址**，通过它可以很容易地相互通信。 (比如每一个Container分一个内部IP 172.17.0.x , 所以他们可以相互通讯)
+ Docker服务器（守护进程）创建了一个虚拟的以太网桥docker0，通过在各种网络接口之间传递数据包而自动运行。

```shell
#!/usr/bin/env sh

# 桥接模式， 默认模式
# 相当于Vmware中的Nat模式，容器使用独立network Namespace，并连接到docker0虚拟网卡（默认模式）。
# 通过docker0网桥以及Iptables nat表配置与宿主机通信；
# bridge模式是Docker默认的网络设置，此模式会为每一个容器分配Network Namespace、设置一个内部IP等，
# 并将一个主机上的Docker容器连接到一个虚拟网桥上

# run 2 busybox with bridge dirver in background
docker run -d --name busybox1 --network=bridge busybox:latest sleep 1000
# --network=bridge 默认driver， 可以不写
docker run -d --name busybox2  busybox:latest sleep 1000
# get ip of busybox1
ip1=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' busybox1`
echo "run busybox1 with <bridge> network driver, got ip :" ${ip1} "it should be an internal ip"
# get ip of busybox2
ip2=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' busybox2`
echo "run busybox2 with <bridge> network driver, got ip :" ${ip2} "it should be an internal ip"

echo "\033[32mbusybox1 ping busybox2 \033[0m"

docker exec busybox1 ping -c 5 ${ip2}

#clean
docker kill busybox1 busybox2
exitedContains=`docker ps -a -q --filter status=exited --format="{{.ID}}"`
docker rm ${exitedContains}

```



#### 网络驱动2: Host

容器将直接使用主机的网络栈进行网络通信。这意味着容器可以直接访问主机上的网络接口，并与主机上的其他容器共享相同的IP地址和端口。因此，如果使用host模式，容器的网络配置将与主机的网络配置完全相同

> host网络驱动只适用于Linux主机，不支持Docker Desktop for Mac、Docker Desktop for Windows或Docker EE for Windows Server

```shell
#!/usr/bin/env sh

# host模式

# 相当于Vmware中的桥接模式，与宿主机在同一个网络中，但没有独立IP地址。
# Docker使用了Linux的Namespaces技术来进行资源隔离，如PID Namespace隔离进程，Mount Namespace隔离文件系统，Network Namespace隔离网络等。
# 一个Network Namespace提供了一份独立的网络环境，包括网卡、路由、Iptable规则等都与其他的Network Namespace隔离。
# 一个Docker容器一般会分配一个独立的Network Namespace。
# 但如果启动容器的时候使用host模式，那么这个容器将不会获得一个独立的Network Namespace，而是和宿主机共用一个Network Namespace。
# 容器将不会虚拟出自己的网卡，配置自己的IP等，而是使用宿主机的IP和端口。

#host网络驱动只适用于Linux主机，不支持Docker Desktop for Mac、Docker Desktop for Windows或Docker EE for Windows Server

docker run -d --name=ubuntu1 --network=host ubuntu sleep 1000

# get ip of busybox1
ip1=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ubuntu1`
echo "run ubuntu1 with <host> network driver, got ip :" ${ip1} "it should be an empty string"

ip2=`docker exec ubuntu1 hostname -I`
echo "run ubuntu1 with <host> network driver, got ip :" ${ip2} "it should be same as your computer"

docker run -d --name=ubuntu2 --network=host ubuntu sleep 1000
ip2=`docker exec ubuntu1 hostname -I`
echo "run ubuntu2 with <host> network driver, got ip :" ${ip2} "it should be same as your computer"

docker run -d --name=busybox1 --network=host busybox sleep 1000
ip2=`docker exec ubuntu1 hostname -I`
echo "run busybox1 with <host> network driver, got ip :" ${ip2} "it should be same as your computer"

#clean
docker kill ubuntu1 ubuntu2 busybox1
exitedContains=`docker ps -a -q --filter status=exited --format="{{.ID}}"`
docker rm ${exitedContains}

```



###### 其它方式

访问宿主机网络, 除了` --network=host `外,还可以:

`--add-host` : 更新容器中的`/etc/hosts`为相关变量为宿主机器的

```shell
docker run -d --add-host host.docker.internal:host-gateway my-container:latest
#或
--add-host localhost:10.0.2.2
```





#### 网络驱动3: Container

共享其它container的

```shell
#!/usr/bin/env sh

# 容器模式
#这个模式指定新创建的容器和已经存在的一个容器共享一个Network Namespace，而不是和宿主机共享。
#新创建的容器不会创建自己的网卡，配置自己的IP，而是和一个指定的容器共享IP、端口范围等。
# 同样，两个容器除了网络方面，其他的如文件系统、进程列表等还是隔离的。
# 两个容器的进程可以通过lo网卡设备通信。

docker run --name container1 -d --network=bridge ubuntu:latest sleep 1000
docker run --name container2 -d --network=container:container1 ubuntu:latest sleep 1000


ip1=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container1`
echo "run container1 with <bridge> network driver, got ip :" ${ip1} "it should be an internal ip"

ip2=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container2`
echo "run container2 with <container> network driver, got ip :" ${ip2} "it should be empty"
ip2=`docker exec container2 hostname -I`
echo "run container2 with <container> network driver, got ip from internal :" ${ip2} "it should be same as container1"

#clean
docker kill container1 container2
exitedContains=`docker ps -a -q --filter status=exited --format="{{.ID}}"`
docker rm ${exitedContains}

```



#### 网络驱动4: None

完全隔离的

+ 在这个网络驱动中，Docker容器既不能访问外部网络，也不能与其他容器通信。
+ 当用户想要禁止容器的网络访问时，就可以使用这个选项。
+ 只有回环接口，没有外部网络接口。

```shell
#!/usr/bin/env sh

# none模式

docker run -d --name busybox1 --network=none busybox:latest sleep 1000
docker run -d --name busybox2 --network=none busybox:latest sleep 1000

# get ip of busybox1
ip1=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' busybox1`
echo "run busybox1 with <none> network driver, got ip :" ${ip1} "it should be an empty string"

# get ip of busybox2
ip2=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' busybox2`
echo "run busybox2 with <none> network driver, got ip :" ${ip2} "it should be an empty string"

#clean
docker kill busybox1 busybox2
exitedContains=`docker ps -a -q --filter status=exited --format="{{.ID}}"`
docker rm ${exitedContains}

```



#### 网络驱动5: 自定义

```sh
#!/usr/bin/env sh

#######自定义网桥

# 清理网络
docker network prune -y

#创建一个网桥
docker network create --driver=bridge --subnet=192.168.100.0/24 --gateway=192.168.100.1 mybridge

#查看网桥信息
docker network inspect mybridge


#创建容器，指定网桥
docker run --rm --name container1 -d --network=mybridge busybox:latest sleep 1000
docker run --rm --name container2 -d --network=mybridge busybox:latest sleep 1000
#创建容器， 指定网桥，ip
docker run --rm --name container3 -d --network=mybridge --ip=192.168.100.88 busybox:latest sleep 1000

#查看容器的ip
ip1=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container1`
echo "run container1 with <mybridge> network driver, got ip :" ${ip1} "it should be an internal ip"
ip2=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container2`
echo "run container2 with <mybridge> network driver, got ip :" ${ip2} "it should be an internal ip"
ip3=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container3`
echo "run container3 with <mybridge> network driver, got ip :" ${ip3} "it should be an fixed ip"

#ping
docker exec container1 ping -c 3 ${ip2}
docker exec container2 ping -c 3  ${ip3}

#clean
docker kill container1 container2 container3

#删除网桥
docker network rm mybridge
```



#### 网络驱动:其它

##### overlay:

https://docs.docker.com/network/overlay/

用于多个dock engine之间的

+ 这是用来为Docker Swarm集群中的Docker节点创建一个内部专用网络的。
+ 注：Docker Swarm是一种用于容器的服务，它可以帮助开发者团队在Docker平台中建立和管理Swarm节点集群。
+ 它是Docker网络中一个重要的网络驱动。它有助于提供独立容器和Docker swarm服务之间的互动。

##### macvlan

https://docs.docker.com/network/macvlan/



##### ipvlan

https://docs.docker.com/network/ipvlan/

### 端口映射

`-p 宿主机端口1:容器端口1 -p 宿主机端口2:容器端口2 `

```shell
# 比如运行一个http server
docker run -dit --rm --name my-apache-app -p 8080:80 -v "$PWD":/usr/local/apache2/htdocs/ httpd
```



### 环境变量

设置容器的环境变量

`-e X=Y`

容器中的程序代码可以通过读取环境变量的方式来处理动态值, 而不是硬编码

比如容器中连接数据库时无法确定的数据:

```go
func getDbUrlFromEnv() string {
	//	get from env
	var password = os.Getenv("MYSQL_PASSWORD")
	var host = os.Getenv("MYSQL_HOST")
	var port = os.Getenv("MYSQL_PORT")
	var user = os.Getenv("MYSQL_USER")

	var dburl = user + ":" + password + "@tcp(" + host + ":" + port + ")/"
	//log.Println("dburl:", dburl)
	return dburl
}
```

```shell
docker run --name xxapp -e MYSQL_USER=root -e MYSQL_PASSWORD=123456 -e MYSQL_HOST=mysqldb -e MYSQL_PORT=3306 --rm -p 9192:9192 xxx:latest
```



### PID设置

PID 命名空间是 Docker 中的隔离技术之一，它可以将容器中的进程隔离在一个独立的命名空间中，从而保证容器内的进程不能访问主机上的任何进程。

这样做的好处是：

- 避免容器内的进程对主机进程造成任何影响。
- 可以让容器内的进程以为自己是整个系统的唯一进程。
- 提高容器隔离性。

默认情况下，Docker 容器内的进程都是运行在独立的 PID 命名空间中的。可以使用 `--pid=host` 选项来让容器内的进程与主机上的进程共享同一个 PID 命名空间。

```dockerfile
FROM alpine:latest
# htop, a cross-platform interactive process viewer.
RUN apk add --update htop && rm -rf /var/cache/apk/*
CMD ["htop"]

# FROM ubuntu:latest
# RUN apt-get update && apt-get install -y htop && rm -rf /var/lib/apt/lists/*
# CMD ["htop"]
```

#### 以隔离的进程空间运行

```
docker run -it --rm  myhtop
```

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138770194459000.png?raw=true)

#### 使用宿主机的进程空间运行

```
docker run -it --rm --pid=host myhtop
```

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138803113053000.png?raw=true)

### IPC设置

IPC（Inter-Process Communication）命名空间是Docker中的一种隔离技术，用于隔离进程间的IPC通信。在每个容器中，IPC命名空间会为每个容器分配一个独立的IPC通信环境，使得各个容器间的进程间通信不互相干扰。这样，即使容器中的进程不信任，也可以使用IPC通信等技术，而不用担心容器间通信的安全问题。可以通过 `--ipc="MODE"` 来设置

| Value                       | Description                                                  |
| :-------------------------- | :----------------------------------------------------------- |
| ””                          | Use daemon’s default. If not specified, daemon default is used, which can either be `"private"` or `"shareable"`, depending on the daemon version and configuration. |
| “none”                      | Own private IPC namespace, with /dev/shm not mounted.        |
| “private”                   | Own private IPC namespace.                                   |
| “shareable”                 | Own private IPC namespace, with a possibility to share it with other containers. |
| “container: <_name-or-ID_>" | Join another (“shareable”) container’s IPC namespace.        |
| “host”                      | Use the host system’s IPC namespace.                         |



>  参考 ipc_demo

## docker compose

Docker Compose是一个用于定义和运行多容器Docker应用程序的工具。它使用一个YAML文件来配置应用程序服务、网络和数据卷，并将所有服务一起启动和管理。



参考DEMO: gotodo



> https://docs.docker.com/compose/
>
> [/Users/zhouyinhui/Desktop/docker_training/dockercompose备忘清单.pdf](/Users/zhouyinhui/Desktop/docker_training/dockercompose备忘清单.pdf)



## 管理



### 镜像管理

Docker镜像管理场景下常用的命令如下：

1. 搜索镜像：`docker search <image_name>`  
2. 下载镜像：`docker pull <image_name>`
3. 查看本地镜像：`docker images`
4. 删除镜像：`docker rmi <image_id/image_name>`
5. 标记镜像：`docker tag <image_id/image_name> <new_image_name>`
6. 导出镜像：`docker save <image_name> > <file_name.tar>`
7. 导入镜像：`docker load < <file_name.tar>`
8. 查看详细信息 `docker inspect <image_name>`



#### 自定义仓库

略

#### 关于导入导出镜像

image -> tar -> image

+ 导出: `docker save`:  https://docs.docker.com/engine/reference/commandline/save/

  ```shell
  docker save myimage:latest | gzip > myimage_latest.tar.gz
  # 或
  docker save -o myimage_latest.tar myimage:latest
  ```

  

+ 导入: `docker load`: https://docs.docker.com/engine/reference/commandline/load/

  ```
  docker load < myimage_latest.tar.gz
  ```

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138896999274000.png?raw=true)

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138917368676000.png?raw=true)

#### 关于镜像升级

在线: 直接`docker pull myimage:version`

离线: 利用导入导出

基本步骤

+ docker stop mycontainer
+ docker rmi myimage
+ docker pull myimage:version 或者 docker load xxx
+ docker run xxx 

> 注意数据卷

### 容器管理

一些常见的 Docker 容器管理命令包括：

1. docker ps: 显示正在运行的容器
2. docker start: 启动一个已经存在的容器
3. docker stop: 停止一个正在运行的容器
4. docker restart: 重启一个正在运行的容器
5. docker kill: 终止一个正在运行的容器
6. docker rm: 删除一个容器
7. docker logs: 显示容器的日志信息
8. docker top: 显示容器内正在运行的进程
9. docker attach: 连接到容器的控制台。
10. docker inspect : 查看容器详细信息

#### 容器导出为镜像

##### docker export

> export 导出的是容器的文件系统
>
> 比如原镜像中的dockerfile 中的CMD xxx 是没有被复制过来的,只保留文件
>
> 另外, 也不会拷贝数据卷中的内容



 `docker export`: https://docs.docker.com/engine/reference/commandline/export/

The `docker export` command does not export the contents of volumes associated with the container.

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138961061742000.png?raw=true)

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677138982320758000.png?raw=true)

导入: `docker import`: https://docs.docker.com/engine/reference/commandline/import/

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677139041902458000.png?raw=true)

> 注意: import只是把文件系统拷贝过来了, 也就是说只包含文件, 不包含命令
>
> 所有, 拷贝过来后是没有cmd运行的, 但文件都在

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677139074237254000.png?raw=true)

所以可以手动运行:

![image](https://github.com/yinhui1984/imagehosting/blob/main/images/1677139111757043000.png?raw=true)

##### docker commit

`docker commit` 命令用于保存容器的当前状态为一个新的镜像。当你在容器中安装软件，创建文件或文件夹，或进行其他修改时，可以使用此命令提交容器的当前状态。然后可以使用新镜像创建新容器，并从容器的先前状态恢复。

参考上面的: 创建自己的镜像-方式1







#### 随系统启动与自动运行

随系统启动docker服务

```
systemctl enable docker.service
```

随docker服务启动container

```
docker run -d --restart always myapp
或 Dockercompose中
  myapp:
    restart: always
```

还可以在app异常退出时自动重启app:  `--restart on-failure:3`

https://docs.docker.com/config/containers/start-containers-automatically/

| Flag                       | Description                                                  |
| :------------------------- | :----------------------------------------------------------- |
| `no`                       | Do not automatically restart the container. (the default)    |
| `on-failure[:max-retries]` | Restart the container if it exits due to an error, which manifests as a non-zero exit code. Optionally, limit the number of times the Docker daemon attempts to restart the container using the `:max-retries` option. |
| `always`                   | Always restart the container if it stops. If it is manually stopped, it is restarted only when Docker daemon restarts or the container itself is manually restarted. (See the second bullet listed in [restart policy details](https://docs.docker.com/config/containers/start-containers-automatically/#restart-policy-details)) |
| `unless-stopped`           | Similar to `always`, except that when the container is stopped (manually or otherwise), it is not restarted even after Docker daemon restarts. |



> 使用重启策略时请记住以下几点：
>
> + 重启策略只有在容器启动成功后才会生效。在这种情况下，启动成功意味着容器已经启动至少 10 秒，并且 Docker 已经开始对其进行监控。这可以防止根本没有启动的容器进入重启循环。
> + 如果您手动停止容器，则其重启策略将被忽略，直到 Docker 守护程序重新启动或容器被手动重新启动。这是防止重启循环的另一种尝试。
> + 重启策略仅适用于容器。集群服务的重启策略配置不同。



### 网络管理

Docker 网络管理的常见命令包括：

1. `docker network create`: 用于创建一个新的 Docker 网络
2. `docker network inspect`: 用于检查网络的详细信息
3. `docker network ls`: 用于列出所有的 Docker 网络
4. `docker network connect`: 用于连接一个容器到现有的 Docker 网络
5. `docker network disconnect`: 用于断开容器与网络的连接
6. `docker network rm`: 用于删除一个 Docker 网络
7. `docker network prune`: 用于删除所有没有使用的 Docker 网络

### 数据卷管理

常见的 Docker 数据卷管理命令如下：

1. `docker volume create`：创建一个新的数据卷。
2. `docker volume ls`：列出所有的数据卷。
3. `docker volume inspect`：查看数据卷的详细信息。
4. `docker volume rm`：删除一个数据卷。
5. `docker volume prune`：删除所有未使用的数据卷。
6. `docker volume attach`：挂载一个数据卷到一个容器上。
7. `docker volume detach`：从一个容器中分离出一个数据卷。
8. `docker run -v`：在启动容器时，使用 `-v` 参数将数据卷挂载到容器上。



### 日志

最基本的, 通过 `docker logs <container>` 查看容器中应用程序的控制台输出

```
~/Desktop/docker_training/demo/ipc_demo ❯ docker logs ipc_demo_pub
Bound to pubsub.ipc
sent: now: 2023-02-09 06:17:57.645847
sent: now: 2023-02-09 06:17:58.646370
sent: now: 2023-02-09 06:17:59.646992
sent: now: 2023-02-09 06:18:00.647609
```



更多的 :  https://docs.docker.com/engine/reference/commandline/logs/



### docker inspect

查看各种底层信息

例如 查看容器 ipc_demo_pub的ip地址

```shell
docker container inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ipc_demo_pub
```

```
172.17.0.2
```

> `-f` (format) 后面的字符串语法叫做 `go template`
>
> 参考这里  https://pkg.go.dev/text/template
>
> https://www.escapelife.site/posts/8bf741fb.html

参考:

https://docs.docker.com/engine/reference/commandline/inspect/

https://linuxhandbook.com/docker-inspect-command/



### 系统管理

1. docker system prune：清理 Docker 系统中不再使用的数据
2. docker system df：查看 Docker 系统的磁盘使用情况
3. docker system info / docker info：查看 Docker 系统配置信息
4. docker system events：查看 Docker 系统中的实时事件
5. docker system update：更新 Docker 系统
6. docker system version：查看 Docker 系统的版本信息



### docker swarm

Docker Swarm 是 Docker 官方提供的容器集群管理解决方案。它允许用户管理和部署多个 Docker 容器到多台服务器上。Swarm 把多个 Docker 主机当作一个逻辑主机，用户可以在这个逻辑主机上管理多个容器。Swarm 提供了负载均衡、故障转移、服务发现、配置管理等功能，使得用户可以更加方便地管理容器集群

1. docker swarm init：在当前节点上初始化Swarm集群。
2. docker swarm join：在当前节点上加入Swarm集群。
3. docker swarm leave：从Swarm集群中删除当前节点。
4. docker service create：在Swarm集群中创建一个新服务。
5. docker service inspect：检查Swarm集群中的服务详细信息。
6. docker service update：更新Swarm集群中的服务。
7. docker service ls：列出Swarm集群中的所有服务。
8. docker node ls：列出Swarm集群中的所有节点。

