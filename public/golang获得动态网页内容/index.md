# Golang获得动态网页内容


golang中用get()或httpClient 进行get时得到的静态页面, 如果页面中的内容是获取到本地后动态生成的话, 应该如何得到呢

<!--more-->

## 举例

有一些连接你通过`http.get`方法只能得到网页的一个框架, 其中并没有实质的查询结果, 和你通过浏览器直接访问得到的html是不一样的.



使用`chromedp`:  https://github.com/chromedp/chromedp

通过`chromedp.WaitVisible(selector),`来等待动态生成的内容出现

其中 `selector`字符串通过浏览器的开发者控制台, 右击html, 选择 `copy selector`来得到



```go
// GetHttpHtmlContent 获取网站上爬取的数据
func GetHttpHtmlContent(url string, selector string, sel interface{}) (string, error) {
	options := []chromedp.ExecAllocatorOption{
		chromedp.Flag("headless", true), // debug使用
		chromedp.Flag("blink-settings", "imagesEnabled=false"),
		chromedp.UserAgent(`Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36`),
	}
	//初始化参数，先传一个空的数据
	options = append(chromedp.DefaultExecAllocatorOptions[:], options...)

	c, _ := chromedp.NewExecAllocator(context.Background(), options...)

	// create context
	chromeCtx, cancel := chromedp.NewContext(c, chromedp.WithLogf(log.Printf))
	// 执行一个空task, 用提前创建Chrome实例
	_ = chromedp.Run(chromeCtx, make([]chromedp.Action, 0, 1)...)

	//创建一个上下文，超时时间为40s  此时间可做更改  调整等待页面加载时间
	timeoutCtx, cancel := context.WithTimeout(chromeCtx, 40*time.Second)
	defer cancel()

	var htmlContent string
	err := chromedp.Run(timeoutCtx,
		chromedp.Navigate(url),
		chromedp.WaitVisible(selector),
		chromedp.OuterHTML(sel, &htmlContent, chromedp.ByJSPath),
	)
	if err != nil {
		//log.Fatal("Run err : %v\n", err)
		return "", err
	}
	//log.Println(htmlContent)

	return htmlContent, nil
}
```



```go
func main() {
	selector := "#resultset > div:nth-child(2)"
	param := `document.querySelector("body")`
	url := "https://search.censys.io/search?resource=hosts&virtual_hosts=EXCLUDE&q=%28services.http.response.headers.location%3A+account.jetbrains.com%2Ffls-auth%29+and+services.port%3D%6080%60"
	html, _ := GetHttpHtmlContent(url, selector, param)
  log.Println(html)
}
```



## 更详细的

参考这个文章:

https://segmentfault.com/a/1190000039349417


