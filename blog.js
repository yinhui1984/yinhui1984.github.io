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
      message: `确认发布文章 "${post.title}"?`,
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
