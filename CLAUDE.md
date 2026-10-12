# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 工作准则

- **参考实现优先**：任何涉及代码修改的需求，优先参考本地 `YesPlayMusic-master` 项目的实现。项目路径：`C:\Users\w1315\Documents\PHL\001_Projects\GitProjects\GitHubProjects\YesPlayMusic-master`。
- **先确认再执行**：任何时候都要先向用户确认需求，再开始编写或修改代码。
- **Python 命令**：在本环境中使用 `py` 运行 Python，而不是 `python`。

## 项目概述

听潮（原 VMusic）是一个基于 Vue 3 的音乐 Web 单页应用，最初作为课程期末项目开发。它提供音乐发现、播放、歌单管理和用户个人中心等功能。项目大量参考了 [YesPlayMusic](https://github.com/qier222/YesPlayMusic)（参考分析文档位于 `docs/YesPlayMusic项目结构与执行流程分析.md`），但这是一个更小的 Vite 网页应用，不是 Electron 客户端。

- **技术栈**：Vue 3、Vue Router、Pinia、Vite、Howler.js、Axios、Sass。
- **后端接口**：网易云音乐第三方 API（例如 [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)）。项目内 `NeteaseCloudMusicApi/` 为本地副本，可直接 `node app.js` 启动。

## 常用命令

需要 Node.js `^22.18.0 || >=24.12.0`。

```sh
# 安装依赖
npm install

# 启动开发服务器（Vite 默认端口，/api 代理到 localhost:3000）
npm run dev

# 启动网易云 API 服务（npx 方式，默认监听 localhost:3000）
npx @neteasecloudmusicapienhanced/api

# 如果 npx 因网络失败，可使用项目内的本地副本启动
# cd NeteaseCloudMusicApi && node app.js

# 生产构建（输出到 dist/）
npm run build

# 本地预览生产构建
npm run preview

# 运行所有 linter 并自动修复
npm run lint

# 单独运行 linter
npm run lint:oxlint
npm run lint:eslint

# 使用 Prettier 格式化源码
npm run format
```

本项目没有配置测试套件。

## 开发配置

- **Vite 配置**：`vite.config.js`。`@/` 别名映射到 `src/`。开发服务器将 `/api` 代理到 `http://localhost:3000`。
- **环境变量**：
  - `VITE_NETEASE_API_URL` — 网易云 API 请求的基础 URL（开发默认 `/api`，生产环境占位符见 `.env.production`）。
- **代码检查**：ESLint（`eslint.config.js`）+ Oxlint（`.oxlintrc.json`）。Prettier 配置在 `.prettierrc.json`（无分号、单引号、行宽 100）。
- **路径别名**：`@/` 解析为 `src/`（在 `vite.config.js` 和 `jsconfig.json` 中配置）。
- **常量集中管理**：`src/constants.js` 集中管理 localStorage 键名（`STORAGE_KEYS`）、占位图 URL、图片尺寸、默认音量、各种轮询间隔、API 超时等，避免硬编码散落各处。

## 高层架构

### 应用启动

`src/main.js` 创建 Vue 应用，安装 Pinia 和路由，引入全局 SCSS，并挂载到 `#app`。`src/App.vue` 渲染全局布局：登录后显示 `Navbar`、带淡出过渡的 `<router-view>`、登录且有曲目时显示 `PlayerBar`，以及全局 `ConfirmDialog` 和 `Toast`。

挂载时，`App.vue` 从 `localStorage` 恢复用户、播放器和音乐三个 store 的持久化状态。

### 路由与权限

`src/router/index.js` 使用 `createWebHistory`，定义了七条路由：`/login`、`/`（首页）、`/player/:id`、`/playlist/:id`、`/profile`、`/daily-recommend`、`/toplist`。全局 `beforeEach` 守卫：

- 未登录用户访问 `meta.requiresAuth` 路由时，重定向到 `/login` 并携带 `redirect` 查询参数；
- 已登录用户访问 `/login` 时，重定向到首页；
- 根据路由 `meta.title` 设置 `document.title`。

路由还配置了 `scrollBehavior`：前进/后退恢复保存的滚动位置，新导航回到顶部。守卫首次进入时会调用 `userStore.restore()` 从 localStorage 恢复登录态。

登录状态由 Pinia 管理，并持久化到 `localStorage`（键名为 `vmusic-user`）。

### 状态管理（Pinia）

Store 位于 `src/stores/`，采用 Composition API 风格（`defineStore(..., () => { ... })`）。

- **`user`**：登录/登出、用户信息、头像兜底。支持手机号/密码登录和通过注入 Cookie 的二维码登录。
- **`player`**：音频播放器。封装 Howler.js，管理当前曲目、播放列表、播放/暂停、进度、音量、循环/随机模式，以及持久化到 `localStorage` 的本地播放历史（键名 `vmusic-player`、`vmusic-play-history`）。
- **`music`**：音乐发现数据（推荐、分类、搜索）、歌词、用户自建歌单、服务端播放历史。用户歌单本地持久化（`vmusic-playlists`），同时调用网易云歌单 API。
- **`ui`**：全局确认弹窗和 Toast 通知。

### API 层

`src/api/` 按领域导出函数（`auth`、`user`、`playlist`、`track`、`others`）。每个函数封装 `src/utils/request.js` 中的 Axios 实例，其 `baseURL` 为 `VITE_NETEASE_API_URL`。所有 API 函数直接调用真实网易云接口（已移除模拟数据层）。

部分函数在 `.then` 中调用 `mapTrackPlayableStatus(tracks, privileges)`，根据 `privileges` 里的可播放状态给歌曲标记 `playable` 字段，供 UI 决定是否可点击播放。

### 缓存机制（IndexedDB + SWR）

参考上游 YesPlayMusic，引入 Dexie（IndexedDB）持久缓存层，集中在 `src/utils/db.js`。采用 **SWR（stale-while-revalidate）** 模式：命中未过期直接返回；过期返回旧值同时后台静默刷新；未命中才等网络。每张表带 **TTL** 与 **LRU 条数上限淘汰**（命中更新 `lastAccess`，超限按它删最旧）。

- `lyric` — 解析后的歌词数组（含翻译匹配），TTL 7 天，上限 500
- `trackDetail` — 歌曲详情 + privileges，TTL 1 天，上限 500
- `playlistDetail` — 歌单详情 + tracks + 订阅态，TTL 1 小时，上限 100
- `trackSource` — 音频 url（不存字节），TTL 30 分钟，上限 200

接入点：`getTrackDetail`/`getMP3`（`src/api/track.js`）、`getPlaylistDetail`（`src/api/playlist.js`，`noCache=true` 跳过缓存强制刷新）、`fetchLyrics`（`src/stores/music.js`，IDB 存解析后数组）。TTL 与上限常量集中在 `src/constants.js`（`CACHE_TTL_*` / `CACHE_MAX_*`）。

`player.js` 的 Howl `onloaderror` 会在 url 失效时清除该 id 的 trackSource 缓存并重拉一次，避免播放卡死。

### 音频播放

`src/stores/player.js` 是播放状态的唯一数据源。它通过 `src/api/track.js` 获取曲目详情和 MP3 地址，实例化 Howl，并暴露 `play`、`pause`、`togglePlay`、`next`、`prev`、`seek` 和播放列表控制。播放偏好（音量、循环、随机）通过 `localStorage` 在刷新后保留。

### 样式

全局样式位于 `src/assets/styles/`：

- `variables.scss` — 颜色、间距、导航栏/播放栏高度等 CSS 自定义属性。
- `global.scss` — 重置、基础元素样式、工具类。
- `transitions.scss` — Vue 过渡类（fade、slide 等）。

组件使用 scoped `<style scoped>` 配合 Sass，并引用 `variables.scss` 中的 CSS 变量。

### 重要工具函数

- `src/utils/common.js` — 歌曲可播放状态映射、LRC 歌词解析（`parseLRC`）、图片缩放辅助、Cookie 存储辅助。
- `src/utils/request.js` — Axios 实例和拦截器。
- `src/utils/db.js` — Dexie/IndexedDB 持久缓存，SWR 封装 + LRU 淘汰（见上文「缓存机制」）。

### 组合式函数（Composables）

`src/composables/` 存放可复用逻辑：

- `useTheme` — 主题（深色/浅色/跟随系统）+ 主题色（4 预设）应用与持久化，写 `--color-primary` 等 5 个 CSS 变量到 `:root`，深浅模式切换联动重应用主题色。
- `useEscClose` — 弹窗 ESC 关闭，模块级栈记录可见弹窗，ESC 只关栈顶（叠加弹窗不连锁关）。CommentModal/PlaylistPanel/AddToPlaylistModal/TrackDetailModal/ConfirmDialog/SearchResultsOverlay 接入；PlayerView 用独立 window 监听实现 ESC 退出播放页（与 useEscClose 协调：弹窗栈非空时弹窗优先）。
- `useShortcuts` — 全局快捷键（7 操作：播放/上一首/下一首/音量±/静音/喜欢），input 聚焦/button+Space 跳过，设置页可自定义键位（录制 + 冲突检测），App.vue 挂载。
- `usePreload` — 登录后预加载列表页数据（每日推荐/排行榜/喜欢的歌曲/我的歌单），复用现有 IDB SWR 缓存，App.vue watch isLoggedIn 触发；设置页可配置总开关 + 子项。

### 视图与组件

- **视图**（`src/views/`）：路由映射的页面级组件（`HomeView`、`PlayerView`、`PlaylistView`、`ProfileView`、`LoginView`、`DailyRecommendView`、`ToplistView`）。
- **组件**（`src/components/`）：共享 UI 组件，如 `Navbar`、`PlayerBar`、`MusicCard`、`PlaylistCard`、`TrackList`（含表头行）、`ProgressBar`、`CategoryFilter`、`SearchResultsOverlay`、`CommentModal`、`TrackDetailModal`、`PlaylistPanel`、`AddToPlaylistModal`、`Toast`、`ConfirmDialog`。

### 沉浸式播放页与布局

`App.vue` 的 `.app-container` 为 flex 列布局，`.main-content` 用 `padding-top` 给固定定位的 `Navbar` 让位、`padding-bottom` 给 `PlayerBar` 让位。进入 `/player/:id` 时隐藏 `Navbar`，`.player-view` 改用 `position: fixed; inset: 0` 直接占满视口，`PlayerBar` 在该页透明背景（`immersive` 类）以融入。路由切换有 `<transition name="fade" mode="out-in">`，因此各视图必须保持**单根节点**（多根会破坏过渡动画，导致返回上一级页面空白）。

### 文档

`docs/` 文件夹包含中文的需求和设计文档：

- `docs/需求规格说明书.md` — 功能与非功能需求。
- `docs/功能设计说明书.md` — 详细功能设计和页面交互流程。
- `docs/YesPlayMusic项目结构与执行流程分析.md` — 对 YesPlayMusic 架构的参考分析，影响了本项目的设计。
