# YINHUI's BLOG

个人技术博客，使用 Hugo + FixIt 主题构建，部署在 GitHub Pages。

🌐 访问地址：https://yinhui1984.github.io

## 技术栈

- **静态网站生成器**: Hugo (Extended)
- **主题**: [FixIt](https://github.com/hugo-fixit/FixIt)
- **部署**: GitHub Pages
- **构建工具**: Webpack (用于自定义 JS)

## 项目结构

```
yinhui1984.github.io/
├── config.toml          # Hugo主配置文件
├── content/             # 博客文章内容
│   ├── posts/          # 所有博客文章
│   ├── archives.md     # 归档页面
│   └── search.md       # 搜索页面
├── themes/FixIt/       # FixIt主题 (Git Submodule)
├── static/             # 静态资源（图片、图标等）
├── assets/             # 自定义CSS和JS资源
├── src/                # 源代码（用于webpack构建）
├── public/             # Hugo构建输出目录（不提交）
├── docs/               # GitHub Pages部署目录（从public复制）
├── layouts/            # 自定义布局模板
├── data/               # 数据文件
├── blog                # 博客工作台入口
├── blog.js             # 交互式文章和发布工具
└── webpack.config.js   # Webpack配置
```

## 快速开始

### 前置要求

- [Hugo Extended](https://gohugo.io/installation/) (推荐使用 Extended 版本)
- Node.js (用于 webpack 构建)
- Git

### 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 初始化主题 submodule (如果还没有)
git submodule init
git submodule update
```

### 博客工作台

```bash
./blog
```

以后维护博客只使用 `./blog` 这个交互式博客工作台，不需要记底层构建或发布命令。
工作台支持新建草稿、编辑草稿、编辑正式文章、预览草稿、草稿转正式文章、发布正式站点和查看文章列表。

## 文章模板字段说明

博客工作台创建新文章时会自动生成 front matter。以下是常用字段说明：

### 基础信息

- **title** (必需)
  - 文章标题，会自动从文件名转换（将连字符替换为空格并首字母大写）
  - 示例：文件名 `my-article.md` → 标题 `My Article`

- **subtitle**
  - 文章副标题，可选

- **date**
  - 文章创建日期，自动填充为当前时间
  - 格式：`2024-01-20T13:58:58+08:00`

- **slug**
  - URL 友好版本的标题，自动生成（基于文件唯一ID的前7位）
  - 用于生成文章的永久链接

- **draft**
  - 是否为草稿，默认 `true`
  - `true`: 草稿状态，只在博客工作台的“预览草稿”中可见
  - `false`: 正式发布，会出现在网站上

### 作者信息

- **author.name**
  - 作者名称

- **author.link**
  - 作者主页链接

- **author.email**
  - 作者邮箱

- **author.avatar**
  - 作者头像图片路径

### SEO 和描述

- **description**
  - 文章描述，主要用于 SEO（搜索引擎优化）
  - 建议填写，有助于搜索引擎优化
  - **注意**：如果同时存在 `description` 和 `<!--more-->`，摘要显示的优先级见下方说明

- **keywords**
  - 文章关键词，用于 SEO
  - 多个关键词用逗号分隔

- **summary**
  - 文章摘要（在 front matter 中），会显示在文章列表和首页
  - 如果不填写，会按照优先级顺序自动生成（见下方说明）

### 分类和标签

- **tags**
  - 文章标签，数组格式
  - 示例：`tags: [web3, solidity, security]`
  - 默认包含 `draft` 标签，发布前记得删除或替换

- **categories**
  - 文章分类，数组格式
  - 示例：`categories: [blockchain, tutorial]`
  - 默认包含 `draft` 分类，发布前记得删除或替换

- **weight**
  - 文章权重，用于排序
  - 数值越大，排序越靠前
  - 默认 `0`

### 显示控制

- **hiddenFromHomePage**
  - 是否在首页隐藏，默认 `false`
  - `true`: 不在首页显示，但仍可通过链接访问

- **hiddenFromSearch**
  - 是否在搜索结果中隐藏，默认 `false`

- **hiddenFromRelated**
  - 是否在相关文章推荐中隐藏，默认 `false`

- **hiddenFromFeed**
  - 是否在 RSS 订阅中隐藏，默认 `false`

### 评论和互动

- **comment**
  - 是否启用评论，默认 `false`
  - `true`: 启用评论功能

### 图片和媒体

- **featuredImage**
  - 文章特色图片（大图），用于文章详情页
  - 支持两种方式：
    - 本地图片：路径相对于 `static/` 目录，例如 `images/featured.jpg`
    - 远程 URL：直接使用完整的 HTTP/HTTPS URL，例如 `https://example.com/image.jpg`

- **featuredImagePreview**
  - 文章预览图（小图），用于文章列表和卡片
  - 支持两种方式：
    - 本地图片：路径相对于 `static/` 目录，例如 `images/preview.jpg`
    - 远程 URL：直接使用完整的 HTTP/HTTPS URL，例如 `https://example.com/preview.jpg`

### 安全和权限

- **password**
  - 文章访问密码（可选）
  - 如果设置，访问文章需要输入密码

- **message**
  - 密码提示信息

### 转载设置

- **repost.enable**
  - 是否为转载文章，默认 `false`
  - `true`: 标记为转载

- **repost.url**
  - 原文链接（如果是转载）

### 内容分隔和摘要优先级

模板中包含 `<!--more-->` 标记，用于分隔文章摘要和正文：
- `<!--more-->` 之前的内容会作为摘要显示在文章列表
- `<!--more-->` 之后的内容只在文章详情页显示

**摘要显示的优先级顺序**（当多个选项同时存在时）：

1. **`<!--more-->` 之前的内容**（最高优先级）
   - 如果 `<!--more-->` 标记存在，且之前有内容，则使用这部分内容作为摘要
   - 示例：
     ```markdown
     这是摘要内容
     
     <!--more-->
     
     这是正文内容
     ```

2. **`description` 字段**
   - 如果 `<!--more-->` 存在但之前没有内容（空），则使用 `description` 作为摘要
   - 如果 `<!--more-->` 之前有内容，则 `description` 仅用于 SEO，不用于摘要显示
   - 示例：
     ```yaml
     description: "这是文章描述，用于SEO"
     ```
     ```markdown
     <!--more-->
     正文内容
     ```

3. **`summary` 字段**（front matter 中）
   - 如果 front matter 中明确设置了 `summary`，则使用该值
   - 示例：
     ```yaml
     summary: "这是自定义摘要"
     ```

4. **自动摘要**
   - 如果以上都不存在，Hugo 会自动截取文章开头的前 70 个单词作为摘要

**最佳实践**：
- 推荐使用 `<!--more-->` 标记来手动控制摘要内容
- `description` 主要用于 SEO，建议填写
- 如果想让 `description` 作为摘要显示，可以在文章开头立即放置 `<!--more-->`（之前不写内容）

### 发布前检查清单

工作台会处理草稿转正式文章和正式构建。发布前主要检查：

1. 文章摘要是否写在 `<!--more-->` 前
2. `tags` 和 `categories` 是否准确
3. `description` 是否需要补充
4. 图片和外链是否可访问

更多详细信息请参考 [FixIt 主题文档](https://fixit.lruihao.cn/documentation/content-management/introduction/#front-matter)

### 构建和部署

```bash
./blog
```

在交互式菜单中选择“发布正式站点”。正式发布不会包含草稿。
工具会构建 `public/`，同步到 `docs/`，展示变更摘要，经确认后提交并推送到 GitHub。

## 常用命令

```bash
./blog         # 唯一日常入口
```

## 主题更新

主题使用 Git Submodule 管理，更新主题：

```bash
git submodule update --remote themes/FixIt
```

## 许可证

文章内容采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可协议

## 相关链接

- [Hugo 文档](https://gohugo.io/documentation/)
- [FixIt 主题文档](https://fixit.lruihao.cn/)
- [GitHub 仓库](https://github.com/yinhui1984/yinhui1984.github.io)
