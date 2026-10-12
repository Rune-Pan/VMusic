# 听潮 · VMusic

基于 Vue 3 的音乐 Web 应用，从发现歌单、搜索歌曲到播放和管理喜欢的音乐。
最初作为课程项目开发，参考了 [YesPlayMusic](https://github.com/qier222/YesPlayMusic)
的部分架构与交互设计，主要面向桌面浏览器。

[在线体验](https://tingchao.vercel.app) · [文档导航](./docs/README.md) ·
[本地启动](#本地启动) · [Vercel 部署](#部署到-vercel)

使用已有的网易云音乐账号登录。数据和音频来自第三方网易云 API，
可播放内容、试听范围与音质取决于上游服务及账号权限。

## 可以做什么

| 功能       | 内容                                                             |
| ---------- | ---------------------------------------------------------------- |
| 音乐发现   | 推荐歌单、分类浏览、每日推荐、排行榜                             |
| 搜索与歌手 | 搜索单曲、歌单、歌手、专辑；查看歌手介绍、歌曲和专辑列表         |
| 音乐播放   | 播放控制、循环与随机、进度拖动、音量、播放队列、同步歌词与翻译   |
| 歌单与评论 | 查看歌单、创建歌单、添加歌曲、查看歌曲和歌单评论、复制分享链接   |
| 个人中心   | 喜欢的歌曲、创建和收藏的歌单、本地与服务端播放历史               |
| 个性化     | 深浅主题与跟随系统、4 种主题色、音质偏好、歌词设置、自定义快捷键 |
| 加载体验   | 骨架屏、按需预加载、IndexedDB 缓存与过期后台刷新                 |

当前没有注册、发表评论、私人 FM、MV 或独立专辑详情页面。
歌单删除和个人资料修改虽保留了底层函数，界面尚未提供入口；
详细边界见[功能状态与待办](./docs/VMusic待办事项清单.md)。

## 本地启动

需要 npm，以及满足 `^22.18.0 || >=24.12.0` 的 Node.js。
建议使用 Node.js 24.12.0 或更高版本；版本要求以 [package.json](./package.json) 为准。

### 1. 获取项目并安装依赖

```sh
git clone https://github.com/Rune-Pan/VMusic.git
cd VMusic
npm ci
npm ci --prefix NeteaseCloudMusicApi --omit=dev
```

前端和后端分别安装依赖。只安装根目录依赖不足以启动仓库内的后端。

### 2. 启动后端（终端一）

在项目根目录运行，默认监听 `http://localhost:3000`：

```sh
node NeteaseCloudMusicApi/app.js
```

### 3. 启动前端（终端二）

```sh
npm run dev
```

打开终端显示的地址，默认是 `http://localhost:5173`。
开发环境将 `/api/*` 转发到本地后端，登录后进入首页。
后端启动、接口检查与端口调整见[API 启动说明](./docs/NeteaseAPI启动说明.md)。

Windows 用户也可双击 `start.bat` 安装并启动前后端；已安装依赖后可用
`dev.bat`。后者使用脚本中固定的 Chrome 安装路径。

## 部署到 Vercel

仓库已包含前后端同站部署配置：静态页面来自 `dist/`，
`/api/*` 交给 [api/index.js](./api/index.js) 处理，页面路由回退到 `index.html`。

1. 在 Vercel 中导入本仓库，Root Directory 保持为仓库根目录。
2. Framework Preset 使用 Vite，Node.js Version 选择 `24.x`。
3. 保留 [vercel.json](./vercel.json) 中的安装、构建和输出设置。
4. `VITE_NETEASE_API_URL` 使用 `/api`；仓库环境文件已配置，项目中已有的同名变量也应设为 `/api`。
5. 部署后检查登录页、公开 API、真人登录与实际播放。

也可在项目根目录使用 CLI：

```sh
npx vercel
# 预览确认后发布到生产环境
npx vercel --prod
```

无需另行部署 API 服务。详细请求链路见[架构总览](./docs/架构总览.md#部署与请求链路)，
平台设置参考 [Vercel Node.js 版本说明](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)。

## 开发命令

| 命令              | 用途                                                 |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | 前端开发服务器；需同时运行后端                       |
| `npm run build`   | 生产构建，输出 `dist/`                               |
| `npm run preview` | 本地预览构建结果；API 仍需后端，不会启动 Vercel 函数 |
| `npm run lint`    | 顺序运行 Oxlint、ESLint，包含自动修复                |
| `npm run format`  | 使用 Prettier 格式化 `src/`                          |

根目录没有配置自动化测试套件。检查前端改动时运行 lint 和构建，
并按[需求验收清单](./docs/需求规格说明书.md#验收清单)核对实际操作。
当前全仓库 lint 包含第三方后端，仍有存量报错，不能将构建通过等同于所有检查通过。

## 技术与目录

前端使用 Vue 3、Vue Router、Pinia、Vite、Sass 和 `@lucide/vue`；
Axios 负责请求，Howler.js 负责音频播放，Dexie 负责 IndexedDB 缓存。
仓库内后端来自 `@neteasecloudmusicapienhanced/api`，版本见其
[package.json](./NeteaseCloudMusicApi/package.json)。

```text
src/
├── api/             # 认证、用户、歌曲、歌单、歌手与搜索接口
├── assets/styles/   # 样式变量、全局样式与过渡
├── components/      # 播放栏、列表、搜索覆盖层与弹窗等
├── composables/     # 主题、快捷键、预加载与 ESC 关闭
├── router/          # 页面路由与登录守卫
├── stores/          # user / player / music / ui
├── utils/           # 请求、数据处理与缓存
├── views/           # 页面视图
└── constants.js     # 存储键、缓存策略与默认设置
api/index.js         # Vercel API 入口
NeteaseCloudMusicApi/ # 仓库内后端
docs/                # 使用、维护、参考分析与课程资料
```

## 进一步了解

- [文档导航](./docs/README.md)：按使用、开发与课程汇报选择阅读路径。
- [架构总览](./docs/架构总览.md)：代码入口、状态管理、播放流程和缓存。
- [功能设计](./docs/功能设计说明书.md)：页面交互与数据边界。
- [UI 设计](./docs/UI设计方案.md)：布局、主题与共享组件。
- [课程汇报](./docs/期末项目汇报说明文档.md)：汇报正文与待补充材料。

感谢 [YesPlayMusic](https://github.com/qier222/YesPlayMusic) 和
[NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)。
第三方后端的许可证保留在 [NeteaseCloudMusicApi/LICENSE](./NeteaseCloudMusicApi/LICENSE)。
