# 听潮 源码打包脚本
# 排除依赖、构建产物、IDE 配置等，生成 zip 压缩包

$projectRoot = $PSScriptRoot
$date = Get-Date -Format 'yyyyMMdd'
$outputName = "听潮-src-$date.zip"
$outputPath = Join-Path $projectRoot $outputName

# —— 1. Git 检查：已跟踪文件有未提交修改则中断（忽略未跟踪文件）——
$status = git -C $projectRoot status --porcelain | Where-Object { $_ -notmatch '^\?\?' }
if ($status) {
    Write-Host "打包中止：存在未提交的修改，请先 commit。" -ForegroundColor Red
    Write-Host ""
    $status
    exit 1
}

# —— 2. 排除规则 ——
$excludeDirs = @(
    'node_modules',
    '.git',
    'dist',
    'dist-ssr',
    '.vscode',
    '.idea',
    'coverage',
    '.agents',
    '.claude',
    'docs',
    '.codex'
)

$excludeFiles = @(
    '*.local',
    '*.log',
    '.eslintcache',
    '*.timestamp-*-*.mjs',
    'CLAUDE.md',
    'AGENTS.md',
    'skills-lock.json',
    'pack.ps1',
    '.env.production'
)

# —— 3. 创建临时目录并复制 ——
$tempDir = Join-Path $env:TEMP "听潮-pack-$date-$(Get-Date -Format 'HHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host "正在复制源码..." -ForegroundColor Cyan

$excludeDirArgs = $excludeDirs | ForEach-Object { "/XD"; Join-Path $projectRoot $_ }
$excludeFileArgs = $excludeFiles | ForEach-Object { "/XF"; $_ }

$robocopyArgs = @($projectRoot, $tempDir, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np") + $excludeDirArgs + $excludeFileArgs
& robocopy @robocopyArgs | Out-Null

# —— 4. 生成 README.txt ——
$readmeContent = @"
听潮 - 音乐 Web 单页应用
========================

基于 Vue 3 + Vite 的音乐播放器，参考 YesPlayMusic，使用网易云第三方 API。

环境要求
--------
  Node.js ^22.18.0 或 >=24.12.0

一键启动（Windows）
------------------
  - start.bat  首次安装并启动（自动 npm install + 启动前后端 + 开浏览器）
  - dev.bat    开发调试（跳过安装，启动前后端 + 以 --disable-extensions 开 Chrome）

  双击 start.bat 即可，浏览器访问 http://localhost:5173

手动启动
--------
  1. 安装前端依赖
     npm install

  2. 安装 API 后端依赖
     cd NeteaseCloudMusicApi
     npm install
     cd ..

  3. 启动 API 后端服务（新终端窗口）
     cd NeteaseCloudMusicApi
     node app.js
     默认监听 http://localhost:3000

  4. 启动前端开发服务器（另一个终端窗口）
     npm run dev
     默认 http://localhost:5173，API 请求自动代理到 localhost:3000

常用命令
--------
  npm run dev       启动开发服务器
  npm run build     生产构建，输出到 dist/
  npm run preview   本地预览生产构建
  npm run lint      运行 ESLint + Oxlint 并自动修复
  npm run format    Prettier 格式化源码

注意
----
  - start.bat / dev.bat 内的提示为英文，避免 cmd 中文编码问题
  - 生产部署需配置 .env.production 中的 VITE_NETEASE_API_URL
"@

$readmePath = Join-Path $tempDir "README.txt"
[System.IO.File]::WriteAllText($readmePath, $readmeContent, [System.Text.Encoding]::UTF8)

# —— 5. 压缩 ——
if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
}

Write-Host "正在压缩..." -ForegroundColor Cyan
Compress-Archive -Path "$tempDir\*" -DestinationPath $outputPath -Force

# —— 6. 清理并输出结果 ——
Remove-Item $tempDir -Recurse -Force

$size = (Get-Item $outputPath).Length
$sizeMB = [math]::Round($size / 1MB, 2)

Write-Host ""
Write-Host "打包完成！" -ForegroundColor Green
Write-Host "文件: $outputPath"
Write-Host "大小: $sizeMB MB"
