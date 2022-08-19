# Censys文档


`censys` https://search.censys.io 堪称神器, 翻译了一下帮助文档



<!--more-->

## Search Language

### 全文搜索

当没有指定字段时，Censys会尝试对所有字段进行全文搜索。

例如，搜索`Dell`将返回`location.city`为 "Dell Rapids "的主机，以及`service.software.vendor`为 "Dell "的主机。如果你对戴尔制造的设备感兴趣，你会希望指定存储该信息的字段。

### 指定字段和值

有效的搜索将指定一个属性所存储的字段。为此，你需要知道你要搜索的数据集中的字段。

在**数据定义**标签下查看字段及其价值类型的完整列表，或者选择在详情页上查看**原始数据**，例如谷歌公共DNS的[主机表视图]（https://search.censys.io/hosts/8.8.8.8/data/table）。

一个典型的搜索至少提供一个字段--它反映了使用点符号的JSON模式的嵌套（例如，`services.http.response.headers.server.headers`） --- 和一个值。如果值的类型是*文本*，将返回一个模糊匹配的结果；如果值的类型是*关键词*，只返回一个精确的匹配。

例如，你可以通过指定字段和值来搜索所有有HTTP服务返回HTTP状态码的主机。[`services.http.response.status_code: 500`](https://search.censys.io/search?q=services.http.response.status_code%3A+500&resource=hosts) .

### Wildcards 通配符

默认情况下，Censys搜索的是完整的值。例如，搜索 "Del "不会返回包含 "Dell "的记录。通配符可以用来扩大搜索范围，以便在结果中包括部分匹配。

有两个通配符。

- `?` - 这个通配符表示一个字符。
- `*` - 这个通配符表示零个或多个字符。

组合通配符也是非常有用的。

下面的查询利用CPE软件格式的知识，搜索运行微软IIS webservers的服务，其主要版本<10（因为? 只代表一个字符）和确定的次要版本（因为存在句号）。*通配符占CPE格式的其余部分：

`services.software.uniform_resource_identifier: cpe:2.3:a:microsoft:iis:?.*`

`*`通配符的另一个用途是检查一个字段是否存在，这对服务未知的主机很有帮助。例如，这个查询将返回至少有一个服务已经与Censys完成TLS握手的主机：`services.tls: *`

### 网络协议和端口

使用CIDR符号搜索IP地址块（例如，ip：`23.20.0.0/14`）或通过提供一个范围：`ip：[23.20.0.0 to 23.20.5.34/]`。通过搜索服务名称字段来搜索运行特定协议的主机： `services.service_name: S7 `。通过搜索端口字段来搜索具有特定端口的主机：`services.port: 3389`

### 用布尔逻辑组合搜索条件

使用 "AND"、"OR"、"NOT "和括号来组合多个搜索条件。布尔是不区分大小写的。

默认情况下，由布尔表达式组合的条件是针对主机整体进行评估的。

```
AND
```

搜索[`services.port: 8880 and services.service_name: HTTP`](https://search.censys.io/search?q=services.port%3A+8880+and+services.service_name%3A+HTTP&resource=hosts)将返回打开8880端口的主机（上面运行着任何服务）和运行在任何端口的HTTP服务。

要搜索运行在8880端口的HTTP服务，请使用`same_service()`函数。[`same_service(services.port: 8880 and services.service_name: HTTP)`](https://search.censys.io/search?q=same_service(services.port%3A+8880+and+services.service_name%3A+HTTP)&resource=hosts) .



```
OR
```

搜索[`services.port: 21 or services.service_name: FTP`]()将返回任何打开21号端口（在其上运行任何服务）和在任何端口运行FTP服务的主机。



```
NOT
```

搜索[`not same_service(service_name: HTTP and port: 443)`](https://search.censys.io/search?q=not+same_service(service_name%3A+HTTP+and+port%3A+443)&resource=hosts)将返回那些没有在443上运行HTTP的主机。

搜索[`same_service(service_name: "HTTP" and not port:443)`](https://search.censys.io/search?q=same_service(service_name%3A+"HTTP "+and+not+port%3A443)&resource=hosts)将返回任何有HTTP服务但不在443端口运行的主机。这*可以*包括在443上有HTTP的主机，只要有一个不同端口号的其他HTTP服务。

### 范围

搜索数字的范围，用`[` 和 `]`表示包容范围，用`{`和`}`表示排他范围。例如，`services.http.response.status_code:[500 to 503] `。日期应使用以下语法进行格式化`[2012-01-01 to 2012-12-31]`。也可以指定单边限制`[2012-01-01 to *]`  .  to操作符不区分大小写。

### 正则表达式

> 正则表达式**仅限于付费客户使用**。完整的重新编码语法是[可在此获得](https://www.elastic.co/guide/en/elasticsearch/reference/current/regexp-syntax.html)。

**注意** Censys的正则搜索是不区分大小写的，除非使用精确匹配操作符`=`。

例如，`services.software.vendor:/De[l]+/`将返回该词大写或小写的结果，而`services.software.vendor=/De[l]+/`将只返回大写词的结果。

###Unicode 转义序列

以下序列将被解释为unicode转义序列，以使用户能够在它们经常出现的地方搜索这些特殊字符，如服务标语和HTTP正文。

| Escape Sequence | Character Represented |
| :-------------- | :-------------------- |
| `\a`            | Alert                 |
| `\b`            | Backspace             |
| `\e`            | Escape character      |
| `\f`            | Formfeed / Page break |
| `\n`            | Newline               |
| `\r`            | Carriage return       |
| `\t`            | Horizontal tab        |
| `\v`            | Vertical tab          |

例如，`services.banner="Hello\nWorld"`将把`\n`解释为换行，而不是转义的`n`。

### 保留字符

以下字符将被解释为控制字符，除非它们被反斜杠转义（即前面）或被封装在一个由反斜杠包围的字符串中。

```
= > < ) } ] " * ? : \ /
```

例如，星号在CPE软件标识符中很常见，而转义每个星号是很繁琐的，所以URI周围的反引``号将转义其中所有的星号。

```
(services.software.uniform_resource_identifier: `cpe:2.3:a:cloudflare:cloudflare_load_balancer:*:*:*:*:*:*:*:*`)
```





## 例子

### 在该范围内的主机 23.0.0.0/8 or 8.8.8.0/24:

 ```
 ip: {"23.0.0.0/8", "8.8.8.0/24"}
 ```

### 在德国运行 FTP 或 Telnet 的主机:

 ```
 location.country_code: DE and services.service_name: {"FTP", "Telnet"}
 ```

### HTTP 正文中带有 powershell.exe 的主机:

 ```
 services.http.response.body: powershell.exe
 ```

### “Sitting on the Dock of the Bay”的准确 SNMP 位置值:

 ```
 services.snmp.oid_system.location = "Sitting on the Dock of the Bay"
 ```

### 带有短语“Schneider Electric”或 Dell 在 23.20.0.0/14 范围内的主机：

 ```
 ("Schneider Electric" OR Dell) AND ip:23.20.0.0/14
 ```

### 打开以下任何一个端口的主机：22、23、24、25:

 ```
 services.port: {22, 23, 24, 25}
 ```

### 没有运行 HTTP 服务的主机:

 ```
 NOT services.service_name: HTTP
 ```

### 主机出示任何证书:

 ```
 services.tls.certificates.leaf_fp_sha_256: *
 ```

### 呈现字符串 "hello "的主机由任何值继承（正则表达式）。

 ```
 /hello.*/
 ```

### 提出名称为foo1, foo2, foo3...foo100的主机，由任何数值（常规表达式）继承。

 ```
 services.tls.certificates.leaf_data.names=/foo<1-100>.*/
 ```

### 指定范围内的主机：

 ```
 ip: [1.12.0.0 TO 1.15.255.255]
 ```

### 在端口 22 和 2222 以外的端口上运行 SSH 服务的主机：

 ```
 same_service(services.service_name: "SSH" AND NOT (services.port: 22 OR services.port: 2222))
 ```

### 在端口 443 上运行 elasticsearch 的主机：

 ```
 same_service(services.service_name: "ELASTICSEARCH" AND services.port: 443)
 ```

### 有服务的主机，最后一次被NTT ISP内的Censys扫描器扫描过的。

 ```
 services.perspective_id: "PERSPECTIVE_NTT"
 ```

### 在NTT或TELIA ISP内，具有Censys扫描器最后扫描的服务的主机。

 ```
 services.perspective_id: "PERSPECTIVE_NTT" OR services.perspective_id: "PERSPECTIVE_TELIA"
 ```

#### 在HTTP服务上有一个包含 "dashboard "一词的页面标题的主机。

 ```
 services.http.response.html_title: dashboard
 ```

### 具有响应服务器错误状态代码的 HTTP 服务的主机：

 ```
 services.http.response.status_code: 500
 ```



### 具有特定 HTTP 标头-值对的 HTTP 服务的主机：

 ```
 services.http.response.headers.connection: close AND services.http.response.headers.content_type: text/plain
 ```



### 具有提供证书的 RDP 服务的主机：

 ```
 same_service(services.service_name: RDP AND services.certificate: *)
 ```



### 具有任何运行SSLv3的服务的主机。

 ```
 services.tls.version_selected: SSLv3
 ```



### 具有在 subject_dn 中提供带有字符串“localhost”的 TLS 证书的服务的主机：

 ```
 services.tls.certificates.leaf_data.subject_dn: "localhost"
 ```



### 具有运行微软IIS 7.5的服务的主机。

 ```
 services.software.product: IIS AND services.software.vendor: Microsoft AND services.software.version: 7.5
 ```



### 具有呈现操作系统和应用软件特定组合的服务的主机:

 ```
 same_service(services.software.uniform_resource_identifier: `cpe:2.3:o:canonical:ubuntu_linux:18.04:*:*:*:*:*:*:*` AND services.software.uniform_resource_identifier: `cpe:2.3:a:openbsd:openssh:7.6p1:*:*:*:*:*:*:*`)
 ```



### 运行 Raspberry Pi 产品的主机:

 ```
 services.software.product: "Raspberry Pi"
 ```



### 包含单词 University 的 ASes 中的主机：

 ```
 autonomous_system.description: University
 ```





## 字段定义

https://search.censys.io/search/definitions?resource=hosts

