#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const gradient = require('gradient-string');

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
    .map(file => {
      const filePath = path.join(POSTS_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        name: file.replace('.md', ''),
        value: file,
        mtime: stats.mtime.getTime() // 最后修改时间（时间戳）
      };
    })
    .sort((a, b) => b.mtime - a.mtime); // 按最后修改时间降序排序（最新的在前）
}

// 创建新文章
async function createNewPost() {
  console.log();
  const title = boxen(chalk.hex('#00FF88')('📝 创建新文章'), {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'green',
    textAlignment: 'center'
  });
  console.log(title);
  console.log();

  const { articleName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'articleName',
      message: chalk.hex('#00FF88')('请输入文章名称:'),
      validate: (input) => {
        if (!input.trim()) {
          return '文章名称不能为空';
        }
        // 将空格替换为连字符，与创建逻辑保持一致
        const sanitizedName = input.trim().replace(/\s+/g, '-');
        const fileName = `${sanitizedName}.md`;
        const filePath = path.join(POSTS_DIR, fileName);
        if (fs.existsSync(filePath)) {
          return '文章已存在，请使用其他名称';
        }
        return true;
      }
    }
  ]);

  // 将空格替换为连字符，参考 new.sh 的做法
  const sanitizedName = articleName.trim().replace(/\s+/g, '-');
  const fileName = `${sanitizedName}.md`;
  const spinner = ora('正在创建文章...').start();

  try {
    if (!commandExists('hugo')) {
      spinner.fail(chalk.hex('#FF6B6B')('错误: 未找到 hugo 命令，请先安装 Hugo'));
      return;
    }

    // 使用引号包裹文件名，确保正确处理特殊字符
    execSync(`hugo new posts/"${fileName}"`, { 
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true
    });

    const filePath = path.join(POSTS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      spinner.succeed(chalk.hex('#00FF88')(`文章创建成功: ${fileName}`));
      console.log();
      
      // 在 macOS 上打开文件
      if (process.platform === 'darwin' && commandExists('open')) {
        execSync(`open "${filePath}"`, { stdio: 'ignore' });
        console.log(chalk.hex('#00D9FF')('  📂 已自动打开文件\n'));
      } else {
        console.log();
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
  console.log();
  const title = boxen(chalk.hex('#FF6B6B')('🗑️  删除文章'), {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'red',
    textAlignment: 'center'
  });
  console.log(title);
  console.log();

  const posts = getPostsList();
  if (posts.length === 0) {
    console.log(chalk.hex('#FFE66D')('  ⚠️  没有找到任何文章\n'));
    return;
  }

  const { selectedPost } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedPost',
      message: chalk.hex('#FF6B6B')('请选择要删除的文章:'),
      choices: posts.map((p, index) => {
        const filePath = path.join(POSTS_DIR, p.value);
        const stats = fs.statSync(filePath);
        const date = stats.mtime.toLocaleDateString('zh-CN');
        return {
          name: `${chalk.white(p.name)} ${chalk.gray(`(${date})`)}`,
          value: p.value,
          short: p.name
        };
      }),
      pageSize: 10
    }
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.hex('#FF6B6B')(`⚠️  确定要删除 "${chalk.bold(selectedPost)}" 吗？此操作不可恢复！`),
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.hex('#FFE66D')('  ✓ 已取消删除\n'));
    return;
  }

  const filePath = path.join(POSTS_DIR, selectedPost);
  const spinner = ora('正在删除文章...').start();

  try {
    fs.unlinkSync(filePath);
    spinner.succeed(chalk.hex('#00FF88')(`文章已删除: ${selectedPost}`));
    console.log();
  } catch (error) {
    spinner.fail(`删除失败: ${error.message}`);
  }
}

// 本地测试
async function testLocal() {
  console.log();
  const title = boxen(chalk.hex('#FFE66D')('🚀 启动本地测试服务器'), {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'yellow',
    textAlignment: 'center'
  });
  console.log(title);
  console.log();

  if (!commandExists('hugo')) {
    console.log(chalk.hex('#FF6B6B')('  ✗ 错误: 未找到 hugo 命令，请先安装 Hugo\n'));
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
    console.log();
    const infoBox = boxen(
      chalk.hex('#00D9FF')('📍 访问地址: ') + chalk.white('http://localhost:1313/') + '\n' +
      chalk.gray('按 Ctrl+C 停止服务器'),
      {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        margin: { top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'blue',
        backgroundColor: 'black'
      }
    );
    console.log(infoBox);
    console.log();

    // 启动服务器（不阻塞），使用 -D 参数包含草稿文章
    const hugoServer = spawn('hugo', ['server', '-D', '--disableFastRender'], {
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
  console.log();
  const title = boxen(chalk.hex('#95E1D3')('🌐 发布到 GitHub'), {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'green',
    textAlignment: 'center'
  });
  console.log(title);
  console.log();

  if (!commandExists('hugo')) {
    console.log(chalk.hex('#FF6B6B')('  ✗ 错误: 未找到 hugo 命令，请先安装 Hugo\n'));
    return;
  }

  if (!commandExists('git')) {
    console.log(chalk.hex('#FF6B6B')('  ✗ 错误: 未找到 git 命令\n'));
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.hex('#95E1D3')('确定要发布到 GitHub 吗？这将自动提交并推送所有更改。'),
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.hex('#FFE66D')('  ✓ 已取消发布\n'));
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
    console.log();
    const successBox = boxen(
      chalk.hex('#00FF88')('✨ 您的博客已更新到 GitHub'),
      {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        margin: { top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'green',
        backgroundColor: 'black',
        textAlignment: 'center'
      }
    );
    console.log(successBox);
    console.log();

  } catch (error) {
    spinner.fail(`发布失败: ${error.message}`);
    console.log(chalk.red('\n请检查错误信息并重试'));
  }
}

// 查看文章列表
async function listPosts() {
  console.log();
  const title = boxen(chalk.hex('#4ECDC4')('📚 文章列表'), {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'cyan',
    textAlignment: 'center'
  });
  console.log(title);
  console.log();

  const posts = getPostsList();
  if (posts.length === 0) {
    console.log(chalk.yellow('  ⚠️  没有找到任何文章\n'));
    return;
  }

  // 创建表格样式的列表
  const tableContent = posts.map((post, index) => {
    const filePath = path.join(POSTS_DIR, post.value);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(2);
    const date = stats.mtime.toLocaleDateString('zh-CN');
    const num = chalk.hex('#00D9FF')(`${(index + 1).toString().padStart(3)}.`);
    const name = chalk.white(post.name);
    const info = chalk.gray(`(${size} KB · ${date})`);
    return `  ${num} ${name} ${info}`;
  }).join('\n');

  const boxedList = boxen(tableContent, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 0, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'cyan',
    backgroundColor: 'black'
  });
  
  console.log(boxedList);
  console.log(chalk.hex('#00D9FF')(`  ✨ 共 ${chalk.bold(posts.length)} 篇文章\n`));
}

// 主菜单
async function showMainMenu() {
  console.clear();
  
  // 创建美观的标题
  const title = gradient.rainbow('  📝 Blog 管理工具  ');
  const boxedTitle = boxen(title, {
    padding: { top: 1, bottom: 1, left: 3, right: 3 },
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'cyan',
    backgroundColor: 'black',
    textAlignment: 'center'
  });
  
  console.log(boxedTitle);
  console.log();

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: chalk.hex('#00D9FF')('请选择操作:'),
      choices: [
        { 
          name: chalk.hex('#00FF88')('📝  创建新文章'), 
          value: 'new',
          short: '创建新文章'
        },
        { 
          name: chalk.hex('#FF6B6B')('🗑️  删除文章'), 
          value: 'delete',
          short: '删除文章'
        },
        { 
          name: chalk.hex('#4ECDC4')('📚  查看文章列表'), 
          value: 'list',
          short: '查看文章列表'
        },
        { 
          name: chalk.hex('#FFE66D')('🚀  本地测试'), 
          value: 'test',
          short: '本地测试'
        },
        { 
          name: chalk.hex('#95E1D3')('🌐  发布到 GitHub'), 
          value: 'publish',
          short: '发布到 GitHub'
        },
        { 
          name: chalk.gray('❌  退出'), 
          value: 'exit',
          short: '退出'
        }
      ],
      pageSize: 6
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
      console.log();
      const goodbyeBox = boxen(
        gradient.rainbow('👋 再见！'),
        {
          padding: { top: 1, bottom: 1, left: 3, right: 3 },
          margin: { top: 1, bottom: 1 },
          borderStyle: 'round',
          borderColor: 'cyan',
          backgroundColor: 'black',
          textAlignment: 'center'
        }
      );
      console.log(goodbyeBox);
      console.log();
      process.exit(0);
      return;
  }

  // 询问是否继续
  const { continueAction } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continueAction',
      message: chalk.hex('#00D9FF')('是否继续？'),
      default: true
    }
  ]);

  if (continueAction) {
    await showMainMenu();
  } else {
    console.log();
    const goodbyeBox = boxen(
      gradient.rainbow('👋 再见！'),
      {
        padding: { top: 1, bottom: 1, left: 3, right: 3 },
        margin: { top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: 'black',
        textAlignment: 'center'
      }
    );
    console.log(goodbyeBox);
    console.log();
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
