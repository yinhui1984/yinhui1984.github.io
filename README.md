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
├── Makefile            # 构建和部署脚本
├── new.sh              # 创建新文章的脚本
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

### 本地开发

```bash
# 启动本地开发服务器
make test

# 或者手动启动
hugo server -D
```

访问 http://localhost:1313 查看网站

### 创建新文章

```bash
# 使用脚本创建新文章
./new.sh 文章标题

# 或者使用 Hugo 命令
hugo new posts/文章标题.md
```

### 构建和部署

```bash
# 构建网站
make all
# 或
hugo -D

# 部署到 GitHub Pages
make release
```

`make release` 会：
1. 将 `public/` 目录内容复制到 `docs/`
2. 提交并推送到 GitHub
3. GitHub Pages 会自动从 `docs/` 目录部署

## 常用命令

```bash
make test      # 启动本地开发服务器
make all       # 构建网站
make release   # 构建并部署
make stop      # 停止本地服务器
make list      # 列出所有文章
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
