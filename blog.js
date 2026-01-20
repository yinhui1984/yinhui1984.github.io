#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');

// 获取项目根目录
const PROJECT_ROOT = __dirname;
const POSTS_DIR = path.join(PROJECT_ROOT, 'content', 'posts');

// 检查命令是否存在
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 获取所有文章列表
function getPostsList() {
  if (!fs.existsSync(POSTS_DIR)) {
    return [];
  }
  return fs.readdirSync(POSTS_DIR)
    .filter(file => file.endsWith('.md'))
    .map(file => ({
      name: file.replace('.md', ''),
      value: file
    }));
}

// 创建新文章
async function createNewPost() {
  console.log(chalk.cyan('\n📝 创建新文章\n'));

  const { articleName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'articleName',
      message: '请输入文章名称:',
      validate: (input) => {
        if (!input.trim()) {
          return '文章名称不能为空';
        }
        const fileName = `${input.trim()}.md`;
        const filePath = path.join(POSTS_DIR, fileName);
        if (fs.existsSync(filePath)) {
          return '文章已存在，请使用其他名称';
        }
        return true;
      }
    }
  ]);

  const fileName = `${articleName.trim()}.md`;
  const spinner = ora('正在创建文章...').start();

  try {
    if (!commandExists('hugo')) {
      spinner.fail('错误: 未找到 hugo 命令，请先安装 Hugo');
      return;
    }

    execSync(`hugo new posts/${fileName}`, { 
      cwd: PROJECT_ROOT,
      stdio: 'pipe' 
    });

    const filePath = path.join(POSTS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      spinner.succeed(chalk.green(`文章创建成功: ${fileName}`));
      
      // 在 macOS 上打开文件
      if (process.platform === 'darwin' && commandExists('open')) {
        execSync(`open "${filePath}"`, { stdio: 'ignore' });
        console.log(chalk.blue('已自动打开文件'));
      }
    } else {
      spinner.fail('文章创建失败');
    }
  } catch (error) {
    spinner.fail(`创建失败: ${error.message}`);
  }
}

// 删除文章
async function deletePost() {
  console.log(chalk.cyan('\n🗑️  删除文章\n'));

  const posts = getPostsList();
  if (posts.length === 0) {
    console.log(chalk.yellow('没有找到任何文章'));
    return;
  }

  const { selectedPost } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedPost',
      message: '请选择要删除的文章:',
      choices: posts.map(p => ({
        name: p.name,
        value: p.value
      }))
    }
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.red(`确定要删除 "${selectedPost}" 吗？此操作不可恢复！`),
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('已取消删除'));
    return;
  }

  const filePath = path.join(POSTS_DIR, selectedPost);
  const spinner = ora('正在删除文章...').start();

  try {
    fs.unlinkSync(filePath);
    spinner.succeed(chalk.green(`文章已删除: ${selectedPost}`));
  } catch (error) {
    spinner.fail(`删除失败: ${error.message}`);
  }
}

// 本地测试
async function testLocal() {
  console.log(chalk.cyan('\n🚀 启动本地测试服务器\n'));

  if (!commandExists('hugo')) {
    console.log(chalk.red('错误: 未找到 hugo 命令，请先安装 Hugo'));
    return;
  }

  const spinner = ora('正在启动服务器...').start();

  try {
    // 停止可能正在运行的 hugo 进程
    try {
      execSync('killall -9 hugo', { stdio: 'ignore' });
    } catch {
      // 忽略错误，可能没有运行中的进程
    }

    // 构建站点
    spinner.text = '正在构建站点...';
    execSync('hugo -D', { 
      cwd: PROJECT_ROOT,
      stdio: 'pipe' 
    });

    // 打开浏览器
    if (process.platform === 'darwin' && commandExists('open')) {
      setTimeout(() => {
        execSync('open http://localhost:1313/', { stdio: 'ignore' });
      }, 1000);
    }

    spinner.succeed(chalk.green('服务器启动成功！'));
    console.log(chalk.blue('\n📍 访问地址: http://localhost:1313/'));
    console.log(chalk.gray('按 Ctrl+C 停止服务器\n'));

    // 启动服务器（不阻塞）
    const hugoServer = spawn('hugo', ['server', '--disableFastRender'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });

    // 处理退出信号
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n正在停止服务器...'));
      hugoServer.kill();
      process.exit(0);
    });

    hugoServer.on('exit', () => {
      console.log(chalk.green('服务器已停止'));
    });

  } catch (error) {
    spinner.fail(`启动失败: ${error.message}`);
  }
}

// 发布到 GitHub
async function publish() {
  console.log(chalk.cyan('\n🚀 发布到 GitHub\n'));

  if (!commandExists('hugo')) {
    console.log(chalk.red('错误: 未找到 hugo 命令，请先安装 Hugo'));
    return;
  }

  if (!commandExists('git')) {
    console.log(chalk.red('错误: 未找到 git 命令'));
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '确定要发布到 GitHub 吗？这将自动提交并推送所有更改。',
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('已取消发布'));
    return;
  }

  const spinner = ora('正在构建站点...').start();

  try {
    // 构建站点
    spinner.text = '正在构建站点...';
    execSync('hugo -D', { 
      cwd: PROJECT_ROOT,
      stdio: 'pipe' 
    });

    // 复制文件到 docs
    spinner.text = '正在复制文件到 docs/...';
    const docsDir = path.join(PROJECT_ROOT, 'docs');
    const publicDir = path.join(PROJECT_ROOT, 'public');

    if (fs.existsSync(docsDir)) {
      fs.rmSync(docsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(docsDir, { recursive: true });

    // 复制 public 目录内容到 docs
    execSync(`cp -aRf ${publicDir}/* ${docsDir}/`, {
      cwd: PROJECT_ROOT,
      stdio: 'pipe'
    });

    // 创建 .nojekyll 文件
    fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

    // Git 操作
    spinner.text = '正在提交更改...';
    execSync('git add .', { 
      cwd: PROJECT_ROOT,
      stdio: 'pipe' 
    });

    execSync('git commit -m "auto updated by script"', { 
      cwd: PROJECT_ROOT,
      stdio: 'pipe' 
    });

    spinner.text = '正在推送到 GitHub...';
    execSync('git push', { 
      cwd: PROJECT_ROOT,
      stdio: 'pipe' 
    });

    spinner.succeed(chalk.green('发布成功！'));
    console.log(chalk.blue('✨ 您的博客已更新到 GitHub\n'));

  } catch (error) {
    spinner.fail(`发布失败: ${error.message}`);
    console.log(chalk.red('\n请检查错误信息并重试'));
  }
}

// 查看文章列表
async function listPosts() {
  console.log(chalk.cyan('\n📚 文章列表\n'));

  const posts = getPostsList();
  if (posts.length === 0) {
    console.log(chalk.yellow('没有找到任何文章'));
    return;
  }

  console.log(chalk.gray('─'.repeat(50)));
  posts.forEach((post, index) => {
    const filePath = path.join(POSTS_DIR, post.value);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(2);
    const date = stats.mtime.toLocaleDateString('zh-CN');
    console.log(
      chalk.cyan(`${(index + 1).toString().padStart(3)}. `) +
      chalk.white(post.name) +
      chalk.gray(` (${size} KB, ${date})`)
    );
  });
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.blue(`\n共 ${posts.length} 篇文章\n`));
}

// 主菜单
async function showMainMenu() {
  console.clear();
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║        📝 Blog 管理工具               ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════╝\n'));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择操作:',
      choices: [
        { name: '📝  创建新文章', value: 'new' },
        { name: '🗑️  删除文章', value: 'delete' },
        { name: '📚  查看文章列表', value: 'list' },
        { name: '🚀  本地测试', value: 'test' },
        { name: '🌐  发布到 GitHub', value: 'publish' },
        { name: '❌  退出', value: 'exit' }
      ]
    }
  ]);

  switch (action) {
    case 'new':
      await createNewPost();
      break;
    case 'delete':
      await deletePost();
      break;
    case 'list':
      await listPosts();
      break;
    case 'test':
      await testLocal();
      return; // 不返回菜单，因为服务器在运行
    case 'publish':
      await publish();
      break;
    case 'exit':
      console.log(chalk.blue('\n👋 再见！\n'));
      process.exit(0);
      return;
  }

  // 询问是否继续
  const { continueAction } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continueAction',
      message: '是否继续？',
      default: true
    }
  ]);

  if (continueAction) {
    await showMainMenu();
  } else {
    console.log(chalk.blue('\n👋 再见！\n'));
  }
}

// 启动应用
async function main() {
  try {
    await showMainMenu();
  } catch (error) {
    if (error.isTtyError) {
      console.log(chalk.red('错误: 当前环境不支持交互式界面'));
    } else {
      console.log(chalk.red(`错误: ${error.message}`));
    }
    process.exit(1);
  }
}

// 运行主程序
main();
