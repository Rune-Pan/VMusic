# AGENTS.md

面向 OpenCode 会话的紧凑提示。完整架构与约定见 [CLAUDE.md](./CLAUDE.md)——先读它。本文件只补 agent 易错、CLAUDE.md 未点透或已过时的点。

## 命令

```sh
npm run dev      # Vite 开发服务器（绑定 0.0.0.0，方便局域网/手机调试）
npm run build    # 生产构建 -> dist/
npm run preview  # 预览生产构建
npm run lint     # run-s 顺序跑 lint:oxlint -> lint:eslint，均带 --fix
npm run format   # prettier --write --experimental-cli src/（只格式化 src/）
```

- **无测试套件**。不要臆造 `npm test`；验证改动用 `npm run lint && npm run build`。
- **Node 引擎严格**：`^22.18.0 || >=24.12.0`（见 `package.json` `engines`）。

## 启动前提（最易踩坑）

`npm run dev` 单跑不会得到任何数据——前端把 `/api` 代理到 `localhost:3000` 的网易云 API。必须先起后端：

```sh
npx @neteasecloudmusicapienhanced/api
# 网络失败时用仓库内 vendored 副本：cd NeteaseCloudMusicApi && node app.js
```

代理规则（`vite.config.js`）：`/api/foo` -> `http://localhost:3000/foo`（剥掉 `/api`）。

## 代码风格真相

`.prettierrc.json` 是唯一权威（CLAUDE.md 写"行宽 100"已过时）：

- 无分号、单引号、`printWidth: 80`、`endOfLine: crlf`、`trailingComma: none`、`vueIndentScriptAndStyle: true`
- 缩进 2 空格；`.editorconfig` 对源码 `max_line_length = 100`、`end_of_line = lf`（与 prettier 的 crlf 有冲突时，以 `npm run format` 实际结果为准）

## 仓库约定（违反即出 bug）

- **`@` -> `src/`**：在 `vite.config.js` 与 `jsconfig.json` 都配了，导入用 `@/...`。
- **视图必须单根节点**：`App.vue` 的 `<router-view>` 包在 `<transition name="fade" mode="out-in">` 里，多根视图会破坏过渡，导致返回上一级白屏。
- **常量集中在 `src/constants.js`**：localStorage 键名（`STORAGE_KEYS`）、缓存 TTL/上限、默认音质/字号等。禁止散落硬编码。
- **可播放状态走 `mapTrackPlayableStatus(tracks, privileges)`**：给歌曲打 `playable` 字段，UI 据此决定能否点击。新增取歌接口要接上。

## 缓存层（别绕过也别重造）

`src/utils/db.js` 用 Dexie/IndexedDB 做 SWR + LRU 缓存，命中返旧值同时后台刷新。接入点：

- `getTrackDetail` / `getMP3`（`src/api/track.js`）
- `getPlaylistDetail`（`src/api/playlist.js`），传 `noCache: true` 强制刷新
- `fetchLyrics`（`src/stores/music.js`）存解析后歌词数组

Howl `onloaderror` 会在音频 url 失效时清掉该 id 的 `trackSource` 缓存并重拉一次——改播放逻辑时别删这条兜底。

## 部署与打包

- **生产部署**：`.env.production` 的 `VITE_NETEASE_API_URL` 是占位符（`https://your-netease-api.example.com`），部署前必须改成真实 API 地址。
- **源码打包**：`pack.ps1` 生成日期戳 zip；要求 git 已跟踪文件全部 clean（未提交会中止）。它显式排除 `AGENTS.md`/`CLAUDE.md`/`docs/`/`.env.production` 等——这些是 agent/部署期文件，不进源码包。

## 文档

- [CLAUDE.md](./CLAUDE.md) —— 架构、状态管理、API 层、composables 全量说明（权威）。
- [docs/](./docs/) —— 需求规格、功能设计、YesPlayMusic 参考分析。
