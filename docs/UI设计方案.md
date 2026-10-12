---
name: 听潮 UI 设计方案
overview: 听潮 基于 Vue 3 的音乐 Web 单页应用 UI 方案。采用深色 OLED + 毛玻璃（Glassmorphism）视觉风格，融合沉浸式播放页与微交互。本文档描述设计系统（配色/字体/间距/动效）、7 个页面级视图布局、共享组件清单与文件结构，与当前代码实现同步。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Dark Mode OLED
    - Glassmorphism
    - Modern
    - Immersive
    - Micro-interactions
  fontSystem:
    fontFamily: Poppins
    heading:
      size: 28px
      weight: 700
    subheading:
      size: 18px
      weight: 600
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#3B82F6"
      - "#60A5FA"
      - "#F97316"
    background:
      - "#0A0E27"
      - "#1E1E2E"
      - "#121218"
    text:
      - "#FFFFFF"
      - "#A0A0B8"
      - "#6B7280"
    functional:
      - "#22C55E"
      - "#EF4444"
      - "#F59E0B"
---

## 产品概述

听潮 是一个基于 Vue 3 的单页 Web 音乐平台，参考 YesPlayMusic 的设计风格。平台支持手机号/扫码登录、音乐发现（推荐/每日推荐/排行榜/分类）、沉浸式播放、歌单管理（创建/收藏分类）、多类型搜索与个人中心，采用深色 OLED 主题为主、浅色与跟随系统可切换，融合毛玻璃导航栏与播放栏，定位为高颜值现代音乐平台。

## 核心功能与视图

- **登录页（LoginView）**：账号登录 / 二维码扫码登录切换，主题切换入口，毛玻璃表单卡片
- **推荐首页（HomeView）**：毛玻璃导航栏 + 分类筛选 + 歌单卡片网格（响应式 5/4/3/2 列）
- **播放详情页（PlayerView）**：沉浸式，隐藏导航栏，左右分栏（封面 + 歌词同步滚动），PlayerBar 透明融入
- **歌单详情页（PlaylistView）**：歌单信息区（封面/创建者/简介）+ 播放全部/收藏/评论/分享按钮 + 带表头的歌曲列表 + 加载更多
- **每日推荐（DailyRecommendView）**：推荐歌曲 / 推荐歌单双 Tab
- **排行榜（ToplistView）**：分类 Tab + 榜单卡片网格（含前三首预览）
- **个人中心（ProfileView）**：侧边菜单 + 喜欢的歌曲 / 我的歌单（创建/收藏分类）/ 播放历史（本地+服务端）/ 个人设置
- **全局搜索覆盖层（SearchResultsOverlay）**：歌曲/歌单/歌手/专辑多类型搜索结果

## Tech Stack

- **框架**：Vue 3（Composition API + `<script setup>`）+ Vite
- **路由**：Vue Router（createWebHistory + scrollBehavior）
- **状态管理**：Pinia
- **样式方案**：SCSS + CSS 自定义属性实现深浅/跟随系统主题切换（`data-theme="dark|light"`，`auto` 跟随系统）
- **图标库**：lucide-vue-next
- **音频**：Howler.js
- **字体**：Google Fonts Poppins + 中文系统字体回退（PingFang SC / Microsoft YaHei 等）
- **API 层**：Axios 封装，`baseURL` 由 `VITE_NETEASE_API_URL` 决定，开发经 Vite 代理到本地 NeteaseCloudMusicApi
- **持久缓存**：Dexie（IndexedDB），SWR 模式 + LRU 淘汰，集中封装于 `src/utils/db.js`。缓存歌词（7天）/歌曲详情（1天）/歌单详情（1小时）/音频 url（30分钟），减少重复请求与跨刷新重拉。

## 设计系统

所有设计 token 集中在 `src/assets/styles/variables.scss`，通过 CSS 自定义属性提供，深色主题在 `[data-theme='dark']` 下覆盖。

- **主色**：`#3B82F6`（蓝），hover `#60A5FA`，CTA `#F97316`（橙）
- **背景**：浅色 `#F8FAFC` / 卡片 `#FFFFFF`；深色 body `#0A0E27` / 卡片 `#1E1E2E`
- **导航栏/播放栏**：半透明 + `backdrop-filter: saturate(180%) blur(20px)` 实现毛玻璃
- **间距**：`--spacing-xs/sm/md/lg/xl/2xl/3xl`（4/8/16/24/32/48/64px）
- **圆角**：`--radius-sm/md/lg/xl/full`（6/8/12/16/9999px）
- **过渡**：fast 150ms / base 200ms / slow 300ms
- **Z-index 层级**：dropdown 100 / navbar & player 500 / modal 1000 / toast 1100

## 布局与沉浸式播放

`App.vue` 的 `.app-container` 为 flex 列布局，`.main-content` 用 `padding-top` 给固定定位 Navbar 让位、`padding-bottom` 给 PlayerBar 让位，并带 `transition: padding-top 0.3s ease` 平滑过渡。

进入 `/player/:id` 时：
- `Navbar` 通过 `v-if` 隐藏（`showNavbar = isLoggedIn && !isPlayerPage`）
- `.player-view` 改用 `position: fixed; inset: 0` 直接占满视口，背景延伸到底部
- `PlayerBar` 加 `immersive` 类：背景与边框透明，融入播放页

路由切换使用 `<transition name="fade" mode="out-in">`，**各视图必须保持单根节点**（多根会破坏过渡动画，导致返回上一级页面空白）。

## 页面设计

### 1. 登录页（LoginView）

- **布局**：全屏深色背景，居中毛玻璃表单卡片
- **内容**：账号登录 / 扫码登录 Tab 切换；账号模式含账号、密码输入与显隐切换；扫码模式展示二维码与刷新；右上角主题切换按钮
- **交互**：表单校验，登录成功跳转首页，已登录访问自动重定向首页

### 2. 推荐首页（HomeView）

- **布局**：顶部 64px 固定毛玻璃导航栏 + 主内容区（最大宽度 1400px 居中）
- **导航栏**：左 logo，中导航链接（首页/每日推荐/排行榜/个人中心），右主题切换 + 搜索框 + 用户头像下拉菜单
- **分类筛选**：横向标签栏，从服务端获取分类，选中主色高亮
- **歌单卡片网格**：响应式 5/4/3/2 列，卡片含封面 + 歌名 + 歌手，悬停上浮显示播放按钮

### 3. 播放详情页（PlayerView）— 沉浸式

- **布局**：`position: fixed; inset: 0`，隐藏导航栏，左右分栏（左 40% + 右 60%）
- **左侧**：大尺寸方形封面（280px，带模糊光晕）+ 歌名 + 歌手 + 专辑
- **右侧**：歌词居中排列，当前行高亮放大加粗，自动平滑滚动至当前行，点击歌词行跳转播放进度
- **底部**：PlayerBar 透明背景，提供完整播放控制

### 4. 歌单详情页（PlaylistView）

- **布局**：歌单信息区（封面 + 名称 + 创建者 + 歌曲数 + 简介）+ 操作按钮区 + 歌曲列表
- **操作按钮**：播放全部 / 收藏（或取消收藏，非自己歌单时显示，文案随状态切换）/ 评论 / 分享
- **歌曲列表**：TrackList 带表头（#/歌名歌手/专辑/时长），自己歌单可移除歌曲，支持「加载更多」
- **评论**：复用 CommentModal（type=playlist），展示歌单评论

### 5. 每日推荐（DailyRecommendView）

- **布局**：标题区 + 双 Tab（推荐歌曲 / 推荐歌单）
- **推荐歌曲**：TrackList 展示，支持「播放全部」
- **推荐歌单**：PlaylistCard 网格，简介回退用创建者昵称

### 6. 排行榜（ToplistView）

- **布局**：分类 Tab（全部/官方榜/精选榜/全球榜）+ 榜单卡片网格
- **卡片**：封面 + 榜单名 + 前三首歌曲预览（异步加载并缓存）+ 播放按钮

### 7. 个人中心（ProfileView）

- **布局**：左侧 240px 侧边栏（头像 + 昵称 + 菜单）+ 右侧主内容区
- **菜单**：喜欢的歌曲 / 我的歌单 / 播放历史 / 个人设置
- **我的歌单**：按创建者分为「创建的」「收藏的」两组，PlaylistCard 展示
- **播放历史**：本地 / 最近一周 / 所有时间 三种模式切换
- **个人设置**：头像 URL + 昵称编辑，保存到服务端

## 共享组件

| 组件 | 说明 |
|------|------|
| `Navbar` | 顶部固定毛玻璃导航栏，含导航链接、搜索、主题切换、用户菜单 |
| `PlayerBar` | 底部固定播放栏，含曲目信息、播放控制、进度条、音量、播放列表、更多菜单；沉浸式透明 |
| `MusicCard` | 音乐/歌单卡片，悬停显示播放与添加到歌单按钮 |
| `PlaylistCard` | 歌单卡片，封面 + 名称 + 简介 + 歌曲数 |
| `TrackList` | 歌曲列表，带表头行，支持移除、播放时间/次数显示 |
| `ProgressBar` | 播放进度条，可拖拽 |
| `CategoryFilter` | 分类筛选标签栏 |
| `SearchResultsOverlay` | 全局搜索结果覆盖层，多类型 Tab |
| `CommentModal` | 评论弹窗，泛化支持歌曲/歌单评论 |
| `TrackDetailModal` | 歌曲详情弹窗 |
| `PlaylistPanel` | 播放列表面板 |
| `AddToPlaylistModal` | 添加到歌单弹窗 |
| `ConfirmDialog` | 全局确认弹窗 |
| `Toast` | 全局提示通知 |

## Directory Structure

```
src/
├── api/                    # 按领域拆分的 API 函数（auth/user/playlist/track/others）
├── assets/styles/          # variables.scss / global.scss / transitions.scss
├── components/             # 共享 UI 组件（见上表）
├── composables/            # useTheme（主题）、useLyricScroll（歌词滚动）
├── constants.js            # 集中管理 localStorage 键名、占位图、轮询间隔等常量
├── router/index.js         # 7 条路由 + scrollBehavior + 权限守卫
├── stores/                 # user / player / music / ui 四个 Pinia store
├── utils/                  # request.js（Axios 实例）、common.js（工具函数）
└── views/                  # 7 个页面级视图
```

## 响应式断点

375px（手机）/ 768px（平板）/ 1024px（小屏桌面）/ 1200-1440px（大屏）。导航栏在窄屏隐藏 logo 文字、缩短搜索框；播放栏在窄屏精简控件；歌单/卡片网格列数随断点递减。
