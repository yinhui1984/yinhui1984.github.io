package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"strings"
	"time"
)

const postsDir = "./jekyllContent/myblog/_posts"
const sitePostDir = "./jekyllContent/myblog/_site/posts"

func getPostFilePath(title string) string {
	t := time.Now()
	theDate := t.Format("2006-01-02")

	title = strings.ToLower(title)
	title = strings.Replace(title, " ", "-", -1)

	fileName := theDate + "-" + title + ".md"
	return path.Join(postsDir, fileName)
}

func openFileInEditor(fullPath string) {
	cmd := exec.Command("open", fullPath)
	_ = cmd.Run()
}

func makeTemplateMD(title string) {
	t := time.Now()
	theDate := t.Format("2006-01-02")
	//theTime := t.Format("15:04:05")

	template := `---
title: %s
author: yinhui
date: %s
categories: [TOP_CATEGORIE, SUB_CATEGORIE]
tags: [tag]     # TAG names should always be lowercase
math: true
mermaid: true
toc: true
---

`
	content := fmt.Sprintf(template, title, theDate)
	fullPath := getPostFilePath(title)
	err := ioutil.WriteFile(fullPath, []byte(content), 0644)
	if err != nil {
		fmt.Println("write file error:", err)
		return
	}

	openFileInEditor(fullPath)
}

func main() {
	title := strings.Join(os.Args[1:], " ")
	if title == "" {
		fmt.Println("please input title")
		return
	}
	makeTemplateMD(title)
}
