# 听潮 · VMusic

基于 Vue 3 的音乐 Web 应用，支持发现音乐、搜索、播放和管理歌单，主要面向桌面浏览器。

[在线体验](https://tingchao.vercel.app) · [开发指南](./docs/开发指南.md) · [功能状态与验收](./docs/功能状态与验收.md)

使用已有网易云音乐账号登录。数据和音频来自第三方 API，完整播放、试听范围与音质取决于上游服务及账号权限。

## 功能

- 推荐与分类歌单、每日推荐、排行榜。
- 分页搜索歌曲、歌单、歌手与专辑，支持失败重试，查看歌手和专辑详情；从专辑返回搜索可恢复结果与位置。
- 播放控制、循环与随机、进度与音量、队列、同步歌词及翻译，刷新后暂停续播。
- 私密歌单创建、名称与简介编辑、删除、歌曲增删、收藏与取消收藏；只读评论、喜欢列表与播放历史。
- 深浅主题、主题色、音质与歌词偏好、自定义快捷键；当前行与普通行歌词可独立设色、即时预览并在本机保存。
- IndexedDB 缓存、过期后台刷新与可配置预加载。

当前不提供注册、发表评论、私人 FM、MV、专辑收藏或专辑评论。
歌单管理以网易云结果为准，已有本机历史歌单保留只读入口；完整边界见[功能状态](./docs/功能状态与验收.md#功能边界)。

## 本地启动

需要 npm 和 Node.js `^22.18.0 || >=24.12.0`，要求以 [package.json](./package.json) 为准。

### 1. 获取项目并安装两端依赖

```sh
git clone https://github.com/Rune-Pan/VMusic.git
cd VMusic
npm ci
npm ci --prefix NeteaseCloudMusicApi --omit=dev
```

### 2. 启动后端（终端一）

在项目根目录运行，默认监听 `http://localhost:3000`：

```sh
node NeteaseCloudMusicApi/app.js
```

### 3. 启动前端（终端二）

```sh
npm run dev
```

打开终端显示的地址，默认为 `http://localhost:5173`，登录后使用。
前端将 `/api/*` 代理到后端；只启动前端无法获取数据。
Windows 也可双击 [start.bat](./start.bat) 安装并启动两端；排障见开发指南。

## 开发与部署

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 前端开发服务，需同时运行后端 |
| `npm run build` | 生产构建，输出 `dist/` |
| `npm run preview` | 预览静态构建，不启动 Vercel API 函数 |
| `npm test` / `npm run test:watch` | 播放、会话、歌单、搜索及界面回归测试 / 监听测试 |
| `npm run check` | 自有代码只读检查、回归测试和生产构建 |
| `npm run lint` | Oxlint、ESLint 检查，包含自动修复 |
| `npm run format` | Prettier 格式化 `src/` |

仓库支持 Vercel 前后端同站部署，API 基址使用 `/api`。
导入本仓库并保留 `vercel.json` 配置，详细步骤见[部署说明](./docs/开发指南.md#vercel-部署)。
测试使用模拟网络、音频及内存 IndexedDB；真实登录和试听仍需单独验收。
全仓库 lint 含第三方后端的存量问题，`check` 检查自有代码，验收方法见状态文档。

## 技术与文档

Vue 3、Vue Router、Pinia、Vite、Sass 和 `@lucide/vue` 构建界面；
Axios、Howler.js、Dexie 分别负责请求、音频播放和持久缓存。

- [开发指南](./docs/开发指南.md)：代码入口、播放缓存、维护约束、部署与排障。
- [功能状态与验收](./docs/功能状态与验收.md)：功能限制、数据写入边界与手工检查。

## 致谢

项目最初作为课程项目开发，架构与交互参考 [YesPlayMusic](https://github.com/qier222/YesPlayMusic)。
后端来自 [NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)，
其许可证保留在 [NeteaseCloudMusicApi/LICENSE](./NeteaseCloudMusicApi/LICENSE)。
