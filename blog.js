#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync, execSync, spawn, spawnSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');

const PROJECT_ROOT = __dirname;
const POSTS_DIR = path.join(PROJECT_ROOT, 'content', 'posts');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const CACHE_DIR = path.join(PROJECT_ROOT, '.cache', 'hugo-0.154.5');
const HUGO_VERSION = '0.154.5';
const HUGO_PKG_URL = 'https://github.com/gohugoio/hugo/releases/download/v0.154.5/hugo_extended_0.154.5_darwin-universal.pkg';
const DEFAULT_IMAGEHOSTING_BIN = '/Users/z/Documents/web3/05_blogs/imagehosting/bin/imagehosting';
const IMAGE_EXTENSIONS = new Set(['.apng', '.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

function commandExists(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe'
  });
}

function runShell(command, options = {}) {
  return execSync(command, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe'
  });
}

function escapeShell(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function formatDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
    sign,
    pad(Math.floor(abs / 60)),
    ':',
    pad(abs % 60)
  ].join('');
}

function slugify(input) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || `post-${Date.now()}`;
}

function listPostFiles() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => path.join(POSTS_DIR, file));
}

function parseFrontMatter(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { raw, frontMatter: '', body: raw };
  }
  return {
    raw,
    frontMatter: match[1],
    body: raw.slice(match[0].length)
  };
}

function getField(frontMatter, key) {
  const match = frontMatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '');
}

function parseList(value) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1)
      .split(',')
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }
  return trimmed
    .split(',')
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean);
}

function yamlList(items) {
  return `[${items.map((item) => JSON.stringify(item)).join(', ')}]`;
}

function setField(frontMatter, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${key}:.*(?:\\n[ \\t]+[^\\n]*)*`, 'm');
  if (pattern.test(frontMatter)) {
    return frontMatter.replace(pattern, line);
  }
  return `${frontMatter.trimEnd()}\n${line}`;
}

function writeFrontMatter(filePath, frontMatter, body) {
  fs.writeFileSync(filePath, `---\n${frontMatter.trim()}\n---\n\n${body.replace(/^\n+/, '')}`);
}

function getPostInfo(filePath) {
  const { frontMatter } = parseFrontMatter(filePath);
  const stats = fs.statSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    title: stripQuotes(getField(frontMatter, 'title')) || path.basename(filePath, '.md'),
    draft: /^true$/i.test(getField(frontMatter, 'draft')),
    categories: parseList(getField(frontMatter, 'categories')),
    tags: parseList(getField(frontMatter, 'tags')),
    mtime: stats.mtime
  };
}

function getPosts() {
  return listPostFiles()
    .map(getPostInfo)
    .sort((a, b) => b.mtime - a.mtime);
}

function openFile(filePath) {
  if (process.platform === 'darwin' && commandExists('open')) {
    execFileSync('open', [filePath], { stdio: 'ignore' });
  } else {
    console.log(chalk.cyan(filePath));
  }
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isDataImage(value) {
  return /^data:image\//i.test(value);
}

function isLikelyImagePath(value) {
  const clean = value.split(/[?#]/, 1)[0].toLowerCase();
  return IMAGE_EXTENSIONS.has(path.extname(clean));
}

function stripMarkdownUrl(value) {
  return value.trim().replace(/^<|>$/g, '');
}

function getImagehostingCommand() {
  const candidates = [
    process.env.IMAGEHOSTING_BIN,
    commandExists('imagehosting') ? 'imagehosting' : null,
    DEFAULT_IMAGEHOSTING_BIN
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'imagehosting') return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findMarkdownImages(markdown) {
  const images = [];
  const pattern = /!\[([^\]]*)\]\(([^)\n]+)\)/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    const rawUrl = stripMarkdownUrl(match[2]);
    images.push({
      fullMatch: match[0],
      alt: match[1],
      rawUrl,
      index: match.index
    });
  }
  return images;
}

function resolveLocalImagePath(postPath, imagePath) {
  const cleanPath = decodeURI(imagePath.split(/[?#]/, 1)[0]);
  if (path.isAbsolute(cleanPath)) {
    return cleanPath;
  }
  return path.resolve(path.dirname(postPath), cleanPath);
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function extractUrlFromImagehostingOutput(output) {
  const markdownMatch = output.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  if (markdownMatch) return markdownMatch[1];
  const urlMatch = output.match(/https?:\/\/\S+/);
  if (urlMatch) return urlMatch[0].replace(/[)\]]+$/, '');
  return null;
}

function uploadImage(imagehostingCommand, imagePath) {
  const output = execFileSync(imagehostingCommand, [imagePath], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const url = extractUrlFromImagehostingOutput(output);
  if (!url) {
    throw new Error(`无法解析 imagehosting 输出: ${output.trim()}`);
  }
  return url;
}

function inspectPostImages(post) {
  const content = fs.readFileSync(post.filePath, 'utf8');
  const localImages = [];
  const blockedImages = [];

  for (const image of findMarkdownImages(content)) {
    const url = image.rawUrl;
    if (isRemoteUrl(url)) continue;
    if (isDataImage(url)) {
      blockedImages.push({ post, image, reason: 'data image 不支持发布' });
      continue;
    }
    if (!isLikelyImagePath(url)) continue;

    const localPath = resolveLocalImagePath(post.filePath, url);
    localImages.push({
      post,
      image,
      localPath,
      line: lineNumberAt(content, image.index)
    });
  }

  return { localImages, blockedImages };
}

async function processImagesForPosts(posts, options = {}) {
  const allLocalImages = [];
  const allBlockedImages = [];

  for (const post of posts) {
    const { localImages, blockedImages } = inspectPostImages(post);
    allLocalImages.push(...localImages);
    allBlockedImages.push(...blockedImages);
  }

  if (allBlockedImages.length) {
    console.log(chalk.red('发现不支持的内联图片:'));
    for (const item of allBlockedImages) {
      const line = lineNumberAt(fs.readFileSync(item.post.filePath, 'utf8'), item.image.index);
      console.log(`- ${item.post.fileName}:${line} ${item.reason}`);
    }
    throw new Error('图片检查失败');
  }

  if (!allLocalImages.length) {
    if (!options.silent) console.log(chalk.green('没有发现需要上传的本地图片。'));
    return { uploaded: 0 };
  }

  const missing = allLocalImages.filter((item) => !fs.existsSync(item.localPath));
  if (missing.length) {
    console.log(chalk.red('发现本地图片路径不存在:'));
    for (const item of missing) {
      console.log(`- ${item.post.fileName}:${item.line} ${item.image.rawUrl}`);
    }
    throw new Error('图片检查失败');
  }

  console.log(chalk.cyan(`发现 ${allLocalImages.length} 个本地图片引用:`));
  for (const item of allLocalImages) {
    console.log(`- ${item.post.fileName}:${item.line} ${item.image.rawUrl}`);
  }

  if (!options.autoConfirm) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '上传这些图片到图床并替换 Markdown 链接?',
        default: true
      }
    ]);
    if (!confirm) {
      throw new Error('已取消图片处理');
    }
  }

  const imagehostingCommand = getImagehostingCommand();
  if (!imagehostingCommand) {
    throw new Error(`未找到 imagehosting 命令。请设置 IMAGEHOSTING_BIN，或确认 ${DEFAULT_IMAGEHOSTING_BIN} 存在。`);
  }

  const replacementsByPost = new Map();
  const cacheByPath = new Map();
  const spinner = ora('正在上传图片...').start();

  try {
    for (const item of allLocalImages) {
      let url = cacheByPath.get(item.localPath);
      if (!url) {
        spinner.text = `正在上传 ${path.basename(item.localPath)}...`;
        url = uploadImage(imagehostingCommand, item.localPath);
        cacheByPath.set(item.localPath, url);
      }
      if (!replacementsByPost.has(item.post.filePath)) {
        replacementsByPost.set(item.post.filePath, []);
      }
      replacementsByPost.get(item.post.filePath).push({
        from: item.image.fullMatch,
        to: `![${item.image.alt}](${url})`
      });
    }

    for (const [postPath, replacements] of replacementsByPost.entries()) {
      let content = fs.readFileSync(postPath, 'utf8');
      for (const replacement of replacements) {
        content = content.split(replacement.from).join(replacement.to);
      }
      fs.writeFileSync(postPath, content);
    }

    spinner.succeed(`已上传并替换 ${allLocalImages.length} 个图片引用。`);
    return { uploaded: allLocalImages.length };
  } catch (error) {
    spinner.fail('图片上传失败');
    throw error;
  }
}

function showTitle(text) {
  console.log();
  console.log(boxen(chalk.cyan(text), {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'cyan'
  }));
}

function choosePost(posts, message) {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'post',
      message,
      pageSize: 12,
      choices: posts.map((post) => ({
        name: `${post.title} ${chalk.gray(post.fileName)} ${post.draft ? chalk.yellow('[draft]') : chalk.green('[published]')}`,
        value: post
      }))
    }
  ]).then((answer) => answer.post);
}

async function createDraft() {
  showTitle('新建草稿');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: '文章标题:',
      validate: (value) => value.trim() ? true : '标题不能为空'
    },
    {
      type: 'input',
      name: 'slug',
      message: '文件名/slug:',
      default: (answers) => slugify(answers.title),
      filter: slugify,
      validate: (value) => {
        if (!value.trim()) return 'slug 不能为空';
        const filePath = path.join(POSTS_DIR, `${value}.md`);
        return fs.existsSync(filePath) ? '文章文件已存在' : true;
      }
    },
    {
      type: 'list',
      name: 'category',
      message: '分类:',
      choices: ['Blockchain', 'security', 'web3'],
      default: 'Blockchain'
    },
    {
      type: 'input',
      name: 'tags',
      message: '标签，逗号分隔:',
      default: 'Web3.0'
    }
  ]);

  const tags = answers.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  const filePath = path.join(POSTS_DIR, `${answers.slug}.md`);
  const content = `---\ntitle: ${JSON.stringify(answers.title.trim())}\ndate: ${formatDate()}\ndraft: true\nauthor: yinhui\ncategories: ${yamlList([answers.category])}\ntags: ${yamlList(tags)}\n---\n\n<在这里编写摘要>\n\n<!--more-->\n\n<在这里编写正文>\n`;

  fs.writeFileSync(filePath, content);
  console.log(chalk.green(`已创建草稿: ${filePath}`));
  openFile(filePath);
}

async function editDraft() {
  showTitle('编辑草稿');
  const drafts = getPosts().filter((post) => post.draft);
  if (!drafts.length) {
    console.log(chalk.yellow('没有草稿。'));
    return;
  }
  const post = await choosePost(drafts, '选择要编辑的草稿:');
  openFile(post.filePath);
}

async function editPublished() {
  showTitle('编辑正式文章');
  const published = getPosts().filter((post) => !post.draft);
  if (!published.length) {
    console.log(chalk.yellow('没有正式文章。'));
    return;
  }
  const post = await choosePost(published, '选择要编辑的正式文章:');
  openFile(post.filePath);
  console.log(chalk.gray('修改完成后，回到博客工作台选择“发布正式站点”。'));
}

async function listPosts() {
  showTitle('文章列表');
  const posts = getPosts();
  const drafts = posts.filter((post) => post.draft);
  const published = posts.filter((post) => !post.draft);
  console.log(chalk.green(`正式文章: ${published.length}`));
  console.log(chalk.yellow(`草稿: ${drafts.length}`));
  console.log();
  posts.forEach((post, index) => {
    const state = post.draft ? chalk.yellow('draft') : chalk.green('published');
    console.log(`${String(index + 1).padStart(2, ' ')}. ${post.title} ${chalk.gray(post.fileName)} ${state}`);
  });
}

function findHugoCandidate(command) {
  try {
    const version = execFileSync(command, ['version'], { encoding: 'utf8' });
    if (version.includes(`v${HUGO_VERSION}`)) {
      return { command, version: version.trim() };
    }
  } catch {
    return null;
  }
  return null;
}

async function installHugoToCache() {
  if (process.platform !== 'darwin') {
    throw new Error(`未找到 Hugo ${HUGO_VERSION}。请设置 BLOG_HUGO_BIN 指向正确版本的 Hugo。`);
  }
  if (!commandExists('curl') || !commandExists('pkgutil')) {
    throw new Error('需要 curl 和 pkgutil 才能自动准备 Hugo。');
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const pkgPath = path.join(CACHE_DIR, 'hugo.pkg');
  const expandedPath = path.join(CACHE_DIR, 'pkg');
  const hugoPath = path.join(expandedPath, 'Payload', 'hugo');

  const spinner = ora(`正在准备 Hugo ${HUGO_VERSION}...`).start();
  try {
    if (!fs.existsSync(pkgPath)) {
      execFileSync('curl', ['-L', '--fail', HUGO_PKG_URL, '-o', pkgPath], { stdio: 'pipe' });
    }
    if (!fs.existsSync(hugoPath)) {
      fs.rmSync(expandedPath, { recursive: true, force: true });
      execFileSync('pkgutil', ['--expand-full', pkgPath, expandedPath], { stdio: 'pipe' });
    }
    spinner.succeed(`已准备 Hugo ${HUGO_VERSION}`);
    return hugoPath;
  } catch (error) {
    spinner.fail('Hugo 准备失败');
    throw error;
  }
}

async function getHugo() {
  const envHugo = process.env.BLOG_HUGO_BIN;
  const cachedHugo = path.join(CACHE_DIR, 'pkg', 'Payload', 'hugo');
  const candidates = [
    envHugo,
    cachedHugo,
    '/tmp/hugo-0.154.5/pkg/Payload/hugo',
    commandExists('hugo') ? 'hugo' : null
  ].filter(Boolean);

  for (const candidate of candidates) {
    const found = findHugoCandidate(candidate);
    if (found) return found;
  }

  const installed = await installHugoToCache();
  const found = findHugoCandidate(installed);
  if (!found) {
    throw new Error(`自动准备的 Hugo 不是 ${HUGO_VERSION}`);
  }
  return found;
}

async function previewDrafts() {
  showTitle('预览草稿');
  const drafts = getPosts().filter((post) => post.draft);
  if (drafts.length) {
    await processImagesForPosts(drafts);
  }
  const hugo = await getHugo();
  console.log(chalk.gray(hugo.version));
  console.log(chalk.cyan('启动本地预览: http://localhost:1313/'));
  console.log(chalk.gray('按 Ctrl+C 停止预览。'));

  if (process.platform === 'darwin' && commandExists('open')) {
    setTimeout(() => {
      spawn('open', ['http://localhost:1313/'], { stdio: 'ignore' });
    }, 1000);
  }

  const server = spawn(hugo.command, ['server', '-D', '--disableFastRender'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });

  await new Promise((resolve) => {
    server.on('exit', resolve);
  });
}

async function promoteDraft() {
  showTitle('草稿转正式文章');
  const drafts = getPosts().filter((post) => post.draft);
  if (!drafts.length) {
    console.log(chalk.yellow('没有草稿。'));
    return;
  }

  const post = await choosePost(drafts, '选择要转为正式文章的草稿:');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'categories',
      message: '正式分类，逗号分隔:',
      default: post.categories.filter((item) => item.toLowerCase() !== 'draft').join(', ') || 'Blockchain'
    },
    {
      type: 'input',
      name: 'tags',
      message: '正式标签，逗号分隔:',
      default: post.tags.filter((item) => item.toLowerCase() !== 'draft').join(', ') || 'Web3.0'
    },
    {
      type: 'confirm',
      name: 'updateDate',
      message: '将发布时间更新为现在?',
      default: true
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: `确认将 "${post.title}" 转为正式文章?`,
      default: false
    }
  ]);

  if (!answers.confirm) {
    console.log(chalk.yellow('已取消。'));
    return;
  }

  const parsed = parseFrontMatter(post.filePath);
  let frontMatter = parsed.frontMatter;
  frontMatter = setField(frontMatter, 'draft', 'false');
  frontMatter = setField(frontMatter, 'categories', yamlList(answers.categories.split(',').map((item) => item.trim()).filter(Boolean)));
  frontMatter = setField(frontMatter, 'tags', yamlList(answers.tags.split(',').map((item) => item.trim()).filter(Boolean)));
  if (answers.updateDate) {
    frontMatter = setField(frontMatter, 'date', formatDate());
  }
  writeFrontMatter(post.filePath, frontMatter, parsed.body);
  console.log(chalk.green(`已转为正式文章: ${post.fileName}`));
  console.log(chalk.yellow('注意：这篇文章尚未发布到线上。需要回到博客工作台选择“发布正式站点”。'));
}

async function processArticleImages() {
  showTitle('处理文章图片');
  const posts = getPosts();
  if (!posts.length) {
    console.log(chalk.yellow('没有文章。'));
    return;
  }

  const { scope } = await inquirer.prompt([
    {
      type: 'list',
      name: 'scope',
      message: '选择处理范围:',
      choices: [
        { name: '草稿文章', value: 'drafts' },
        { name: '正式文章', value: 'published' },
        { name: '全部文章', value: 'all' },
        { name: '选择单篇文章', value: 'single' }
      ]
    }
  ]);

  let selectedPosts = posts;
  if (scope === 'drafts') selectedPosts = posts.filter((post) => post.draft);
  if (scope === 'published') selectedPosts = posts.filter((post) => !post.draft);
  if (scope === 'single') selectedPosts = [await choosePost(posts, '选择要处理图片的文章:')];

  if (!selectedPosts.length) {
    console.log(chalk.yellow('该范围内没有文章。'));
    return;
  }

  await processImagesForPosts(selectedPosts);
}

function gitOutput(args) {
  return run('git', args).trim();
}

function ensureGitAvailable() {
  if (!commandExists('git')) {
    throw new Error('未找到 git。');
  }
}

function buildSite(hugoCommand, includeDrafts) {
  const args = includeDrafts ? ['-D', '--cleanDestinationDir'] : ['--cleanDestinationDir'];
  run(hugoCommand, args, { stdio: 'inherit' });
}

function syncPublicToDocs() {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  if (commandExists('rsync')) {
    run('rsync', ['-a', '--delete', `${PUBLIC_DIR}/`, `${DOCS_DIR}/`], { stdio: 'inherit' });
  } else {
    fs.rmSync(DOCS_DIR, { recursive: true, force: true });
    fs.cpSync(PUBLIC_DIR, DOCS_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(DOCS_DIR, '.nojekyll'), '');
}

async function publish() {
  showTitle('发布正式站点');
  ensureGitAvailable();
  const hugo = await getHugo();
  console.log(chalk.gray(hugo.version));

  const drafts = getPosts().filter((post) => post.draft);
  if (drafts.length) {
    console.log(chalk.yellow(`仍有 ${drafts.length} 篇草稿。正式发布不会包含草稿。`));
  }
  await processImagesForPosts(getPosts().filter((post) => !post.draft));

  const beforeStatus = gitOutput(['status', '--short']);
  if (beforeStatus) {
    console.log();
    console.log(chalk.cyan('发布前已有改动:'));
    console.log(beforeStatus);
  }

  const { buildConfirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'buildConfirm',
      message: '构建正式站点并准备发布?',
      default: false
    }
  ]);
  if (!buildConfirm) {
    console.log(chalk.yellow('已取消发布。'));
    return;
  }

  const spinner = ora('正在构建正式站点...').start();
  try {
    spinner.stop();
    buildSite(hugo.command, false);
    spinner.start('正在同步 public 到 docs...');
    syncPublicToDocs();
    spinner.succeed('构建完成');
  } catch (error) {
    spinner.fail('构建失败');
    throw error;
  }

  const status = gitOutput(['status', '--short']);
  if (!status) {
    console.log(chalk.green('没有需要发布的改动。'));
    return;
  }

  const stat = gitOutput(['diff', '--stat']);
  const untracked = gitOutput(['ls-files', '--others', '--exclude-standard']);
  console.log();
  console.log(chalk.cyan('即将提交的变更摘要:'));
  console.log(stat || status);
  if (untracked) {
    console.log();
    console.log(chalk.cyan('未跟踪文件:'));
    console.log(untracked);
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: '提交信息:',
      default: 'Update blog'
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: '确认提交并推送到 GitHub?',
      default: false
    }
  ]);

  if (!answers.confirm) {
    console.log(chalk.yellow('已构建但未提交。'));
    return;
  }

  run('git', ['add', '.'], { stdio: 'inherit' });
  run('git', ['commit', '-m', answers.message], { stdio: 'inherit' });
  run('git', ['push'], { stdio: 'inherit' });
  console.log(chalk.green('发布完成。'));
}

async function showMenu() {
  showTitle('博客工作台');
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '选择操作:',
      pageSize: 9,
      choices: [
        { name: '新建草稿', value: 'create' },
        { name: '编辑草稿', value: 'edit-draft' },
        { name: '编辑正式文章', value: 'edit-published' },
        { name: '处理文章图片', value: 'images' },
        { name: '预览草稿', value: 'preview' },
        { name: '草稿转正式文章', value: 'promote' },
        { name: '发布正式站点', value: 'publish' },
        { name: '查看文章列表', value: 'list' },
        { name: '退出', value: 'exit' }
      ]
    }
  ]);
  return action;
}

async function main() {
  try {
    while (true) {
      const action = await showMenu();
      if (action === 'exit') break;
      if (action === 'create') await createDraft();
      if (action === 'edit-draft') await editDraft();
      if (action === 'edit-published') await editPublished();
      if (action === 'images') await processArticleImages();
      if (action === 'preview') await previewDrafts();
      if (action === 'promote') await promoteDraft();
      if (action === 'publish') await publish();
      if (action === 'list') await listPosts();

      const { again } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'again',
          message: '继续使用博客工作台?',
          default: true
        }
      ]);
      if (!again) break;
    }
    console.log(chalk.green('完成。'));
  } catch (error) {
    console.error(chalk.red(`错误: ${error.message}`));
    process.exit(1);
  }
}

main();
