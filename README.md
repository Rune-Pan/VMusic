# 听潮

基于 Vue 3 的音乐 Web 单页应用，提供音乐发现、播放、歌单管理与个人中心等功能。参考 [YesPlayMusic](https://github.com/qier222/YesPlayMusic)，但这是一个更小的 Vite 网页应用，非 Electron 客户端。

## 技术栈

- Vue 3 + Vue Router + Pinia
- Vite + Sass
- Howler.js（音频播放）
- Axios（请求网易云第三方 API）
- Dexie（IndexedDB 持久缓存，SWR + LRU）

## 快速开始

需要 Node.js `^22.18.0 || >=24.12.0`。

听潮 依赖本地运行的 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 服务提供真实数据。开发服务器会把 `/api` 代理到 `http://localhost:3000`。

```sh
# 1. 安装依赖
npm install

# 2. 启动网易云 API 服务（监听 localhost:3000）
npx @neteasecloudmusicapienhanced/api
# 若 npx 因网络失败，可使用项目内本地副本：
# cd NeteaseCloudMusicApi && node app.js

# 3. 启动前端开发服务器（另开终端）
npm run dev
```

打开浏览器访问 Vite 输出的本地地址，登录后即可使用。

### 一键启动（Windows）

- `start.bat`：首次安装并启动（自动 `npm install` + 启动前后端 + 开浏览器）
- `dev.bat`：开发调试（跳过安装，启动前后端 + 以 `--disable-extensions` 打开 Chrome）

## 常用命令

```sh
npm run dev        # 启动开发服务器
npm run build      # 生产构建，输出到 dist/
npm run preview     # 本地预览生产构建
npm run lint        # 运行 ESLint + Oxlint 并自动修复
npm run format      # Prettier 格式化源码
```

本项目未配置测试套件。

## 部署到 Vercel

当前站点：[听潮](https://tingchao.vercel.app)。

仓库已配置前端和网易云 API 同时部署到一个 Vercel 项目：前端输出到
`dist/`，`/api/*` 由 `api/index.js` 调用仓库内的 `NeteaseCloudMusicApi/`
处理，其他页面路径回退到 `index.html`，支持直接打开或刷新子页面。

在 Vercel 导入本仓库，根目录保持为仓库根目录，Node.js 选择 `24.x`。
`vercel.json` 已设置构建命令及前后端依赖安装命令，无需单独部署后端或填写
API 域名。生产环境的 `VITE_NETEASE_API_URL` 使用 `/api`；如果 Vercel
项目已有这个环境变量，也需要将其设为 `/api`。

也可以在仓库根目录运行 `npx vercel` 创建预览部署，验证后运行
`npx vercel --prod` 发布到生产域名。音乐数据、扫码登录和播放需要部署后
实际验证，上游接口的地区和账号限制仍然适用。

## 主要功能

- **音乐发现**：推荐歌单、每日推荐、排行榜、按分类浏览
- **播放器**：播放/暂停、上一首/下一首、进度拖动、循环/随机、音量、歌词同步（含翻译）、播放列表
- **歌单管理**：歌单详情、评论、分享、新建/删除、添加歌曲到歌单
- **个人中心**：喜欢的歌曲、我的歌单（创建/收藏分类）、播放历史（本地 + 服务端）、个人设置
- **搜索**：歌曲 / 歌单 / 歌手 / 专辑多类型搜索，全局覆盖层
- **沉浸式播放页**：进入歌曲详情时隐藏导航栏，播放栏透明融入，ESC 退出
- **主题系统**：深色/浅色/跟随系统 + 4 种主题色预设（默认/紫罗/玫红/碧波）
- **快捷键**：7 个操作可自定义（播放/上下首/音量±/静音/喜欢），设置页录制 + 冲突检测
- **预加载**：登录后预加载列表页数据（每日推荐/排行榜/喜欢的歌曲/我的歌单）
- **持久缓存**：IndexedDB + SWR，缓存歌词/歌曲详情/歌单详情/音频 URL/评论

## 目录结构

```
src/
├── api/            # 按领域拆分的 API 函数（auth/user/playlist/track/others）
├── assets/styles/  # 全局样式、CSS 变量、过渡动画
├── components/     # 共享 UI 组件（14 个）
├── composables/    # 组合式函数（useTheme/useEscClose/useShortcuts/usePreload）
├── constants.js    # 集中管理 localStorage 键名、缓存 TTL、默认值等常量
├── router/         # 路由与权限守卫（7 条路由）
├── stores/         # Pinia stores（user/player/music/ui）
├── utils/          # Axios 实例、通用工具、Dexie 缓存层
└── views/          # 页面级视图（7 个）
```

详细架构与开发约定见 [CLAUDE.md](./CLAUDE.md)，设计与需求文档见 [docs/](./docs/)。
