# YesPlayMusic 项目结构 与 执行流程分析

> 高颜值第三方网易云音乐播放器。技术栈：Vue 2.6 + Vuex 3 + Vue Router 3 + Electron 13 + Howler.js。
> Vue CLI 4 + `vue-cli-plugin-electron-builder` 打包。
> 网易云 API 通过内嵌的 `@neteaseapireborn/api` 在 Electron 主进程启动（端口 10754），再由 Express 代理（端口 27232）暴露给渲染进程。Web 模式则依赖外部 API 服务。

---

## 一、顶层目录结构

```
YesPlayMusic-master/
├── Dockerfile / docker-compose.yml / docker/    # Docker 部署（nginx + 内嵌 NCM API + UnblockNeteaseMusic）
├── build/                       # 打包资源（icons 等）
├── public/                      # SPA 模板 index.html、favicon、PWA 资源
├── src/                         # 源码（主战场）
│   ├── main.js                  # 渲染进程入口
│   ├── App.vue                  # 根组件
│   ├── background.js            # Electron 主进程入口（package.json "main"）
│   ├── ncmModDef.js             # NCM API 模块注册映射（100+ 端点）
│   ├── registerServiceWorker.js # PWA
│   ├── api/                     # 网易云 / Last.fm API 封装
│   ├── assets/                  # 静态资源（css/fonts/icons）
│   ├── components/              # 通用组件（Player、Navbar、TrackListItem…）
│   ├── electron/                # Electron 主进程各模块（ipc/tray/menu…）
│   ├── locale/                  # i18n 多语言
│   ├── router/                  # 路由
│   ├── store/                   # Vuex（单 store + plugins）
│   ├── utils/                   # 工具层（Player/auth/db/request/common…）
│   └── views/                   # 页面级组件
├── vue.config.js                # Vue CLI + Electron Builder 配置
├── babel.config.js / jsconfig.json
├── package.json                 # scripts: serve / build / electron:serve / electron:build / netease_api:run
└── README.md
```

源码规模：约 145 个文件，其中 `.vue` 42 个、`.js` 51 个。

---

## 二、入口与配置

### `src/main.js`（渲染进程入口）
- 引入 router、store、i18n、全局 SCSS、SVG 图标、Vue 过滤器、PWA service worker。
- 挂载 `window.resetApp()`（清 localStorage + 删 IndexedDB `yesplaymusic` + 清 cookie）。
- 集成 Google Analytics（`vue-gtag`，id `G-KMJJCFZDKF`）。
- 启动时调用 `dailyTask()`（刷新 cookie，见 utils/common.js）。
- `NProgress` 顶部进度条配置。
- `new Vue({ i18n, store, router }).$mount('#app')`。

### `src/App.vue`（根组件）
- 模板结构：`Scrollbar` + `Navbar` + `<main>`（router-view，keep-alive 按 `meta.keepAlive`）+ `Player`（slide-up 过渡）+ `Toast` + 两个 Modal + `Lyrics` 全屏歌词页。
- `created()`：若 `process.env.IS_ELECTRON` 为真则调用 `ipcRenderer(this)`（注册渲染端 IPC 监听）；`fetchData()` 拉取已喜欢歌曲/歌单/专辑/歌手/MV/云盘。
- 全局空格键播放/暂停（排除 input 与 mv 页）。
- `showPlayer`/`enablePlayer`/`showNavbar` 控制在 mv、login、lastfmCallback 路由下的显隐。

### `vue.config.js`
- `productionSourceMap: false`。
- devServer 端口 8080（`DEV_SERVER_PORT` 可覆盖），代理 `^/api` → `http://localhost:3000`（本地 NCM API）。
- PWA 配置（name、favicon、themeColor）；`pages.index` 指向 `src/main.js` + `public/index.html`。
- `chainWebpack`：SVG 用 `svg-sprite-loader`（限定 `src/assets/icons`）、`.node` 用 node-loader、node_modules 下 js 用 `esbuild-loader`（target es2015）、`LimitChunkCountPlugin`（maxChunks 3）。
- `pluginOptions.electronBuilder`：
  - `nodeIntegration: true`、`externals: ['@unblockneteasemusic/rust-napi']`。
  - `builderOptions`：多平台打包（mac dmg x64/arm64/universal、win portable+nsis、linux AppImage/deb/rpm/snap/pacman/tar.gz），发布到 GitHub `qier222/YesPlayMusic`。
  - 主/渲染进程 webpack 都注入 `IS_ELECTRON=true`。

### `src/background.js`（Electron 主进程入口）
- `Background` 类：单实例锁（`app.requestSingleInstanceLock`）。
- `startNeteaseMusicApi()`：启动内嵌 NCM API（端口 **10754**）。
- `createExpressApp()`：Express 监听 `127.0.0.1:**27232**`，静态服务 `__dirname`，`/api` 反向代理到 `127.0.0.1:10754`，`/player` 通过 `webContents.executeJavaScript('window.yesplaymusic.player')` 暴露当前播放状态。
- 注册 `app://` 协议。
- `createWindow()`：从 `electron-store` 读窗口尺寸/位置；`titleBarStyle: 'hiddenInset'`；Win/Linux 无边框（可配置）；`webSecurity:false`、`nodeIntegration:true`、`enableRemoteModule:true`、`contextIsolation:false`。生产模式加载 `http://localhost:27232`（dev 加载 devServer URL），`showLibraryDefault` 时直接跳 `/#/library`。
- 事件：ready-to-show、close（Linux/Mac/Win 三套最小化到托盘逻辑，Mac 用 willQuitApp）、resized/moved（持久化 bounds）、maximize/unmaximize（发 `isMaximized` 给渲染进程）、new-window（白名单 last.fm 单独开窗，其余 `shell.openExternal`）。
- app 事件：ready（创建窗口/托盘/ipcMain/菜单/dock/touchBar/全局快捷键/mpris/osdlyrics）、activate、window-all-closed、before-quit、quit（关 express）、will-quit（注销全局快捷键）、second-instance。
- `checkForUpdates()`：`electron-updater` + 弹窗引导到 GitHub releases。

---

## 三、路由（`src/router/index.js`）

`mode`：Electron 用 `hash`，Web 用 `history`。重写 `VueRouter.prototype.push` 吞掉 NavigationDuplicated。
`beforeEach` 守卫：`requireAccountLogin` → 否则跳 `/login/account`；`requireLogin` → 否则 Electron 跳 `/login/account`、Web 跳 `/login`。

| path | name | 组件 | meta |
|---|---|---|---|
| `/` | home | `views/home.vue` | keepAlive, savePosition |
| `/login` | login | `views/login.vue` | — |
| `/login/username` | loginUsername | `views/loginUsername.vue` | — |
| `/login/account` | loginAccount | `views/loginAccount.vue` | — |
| `/playlist/:id` | playlist | `views/playlist.vue` | — |
| `/album/:id` | album | `views/album.vue` | — |
| `/artist/:id` | artist | `views/artist.vue` | keepAlive, savePosition |
| `/artist/:id/mv` | artistMV | `views/artistMV.vue` | keepAlive |
| `/mv/:id` | mv | `views/mv.vue` | — |
| `/next` | next | `views/next.vue` | keepAlive, savePosition |
| `/search/:keywords?` | search | `views/search.vue` | keepAlive |
| `/search/:keywords/:type` | searchType | `views/searchType.vue` | — |
| `/new-album` | newAlbum | `views/newAlbum.vue` | — |
| `/explore` | explore | `views/explore.vue` | keepAlive, savePosition |
| `/library` | library | `views/library.vue` | requireLogin, keepAlive, savePosition |
| `/library/liked-songs` | likedSongs | `views/playlist.vue` | requireLogin |
| `/settings` | settings | `views/settings.vue` | — |
| `/daily/songs` | dailySongs | `views/dailyTracks.vue` | requireAccountLogin |
| `/lastfm/callback` | lastfmCallback | `views/lastfmCallback.vue` | — |

---

## 四、状态管理（`src/store/`）

非 module 化，单 store + state/mutations/actions + plugins。

### `src/store/index.js`
- 装载 localStorage 初始化、`updateApp()`（版本迁移）。
- 注入 plugins：`saveToLocalStorage`（`plugins/localStorage.js`）+ Electron 下额外 `sendSettings`（`plugins/sendSettings.js`）。
- 启动时根据 `navigator.language` 设默认语言；调用 `changeAppearance`/`changeThemeColor`。
- **关键**：实例化 `new Player()`（utils/Player.js），用 `Proxy` 包裹后塞入 `store.state.player`。Proxy 的 set 拦截器在每次属性变更时调用 `target.saveSelfToLocalStorage()` 和 `target.sendSelfToIpcMain()`（同步到主进程用于托盘/mpris/discord），但对 `_howler` 跳过。

### `src/store/state.js`（根 state）
- `showLyrics`、`enableScrolling`、`title`
- `liked`: { songs, songsWithDetails（前 12 首）, playlists, albums, artists, mvs, cloudDisk, playHistory:{weekData, allData} }
- `contextMenu`、`toast`、`modals`（addTrackToPlaylistModal / newPlaylistModal）
- `dailyTracks`
- `lastfm`、`player`（从 localStorage 反序列化，后被 index.js 的 Proxy Player 实例替换）、`settings`、`data`（均从 localStorage 反序列化）

### `src/store/initLocalStorage.js`（默认值）
- **settings** 默认：`lang`、`musicLanguage`、`appearance:auto`、`themeColor:default`、`musicQuality:320000`、`lyricFontSize:28`、`outputDevice`、`showPlaylistsByAppleMusic`、`enableUnblockNeteaseMusic:true`、`automaticallyCacheSongs:true`、`cacheLimit:8192`(MB)、`enableReversedMode`、`nyancatStyle`、`showLyricsTranslation`、`lyricsBackground`、`enableOsdlyricsSupport`、`closeAppOption:'ask'`、`enableDiscordRichPresence`、`enableGlobalShortcut:true`、`showLibraryDefault`、`subTitleDefault`、`linuxEnableCustomTitlebar`、`trayIconTheme:auto`、`enabledPlaylistCategories`、`proxyConfig`、`enableRealIP`、`realIP`、`shortcuts`。
- **data** 默认：`user`、`likedSongPlaylistID`、`lastRefreshCookieDate`、`loginMode`。

### `src/store/mutations.js`
`updateLikedXXX`（更新 liked 子项，songs 变更时同步 IPC）、`changeLang`、`changeMusicQuality`、`changeLyricFontSize`、`changeOutputDevice`、`updateSettings`、`updateData`、`togglePlaylistCategory`、`updateToast`、`updateModal`、`toggleLyrics`、`updateDailyTracks`、`updateLastfm`、`updateShortcut`、`restoreDefaultShortcuts`、`enableScrolling`、`updateTitle`。

### `src/store/actions.js`
`showToast`、`likeATrack`、`fetchLikedSongs`、`fetchLikedSongsWithDetails`、`fetchLikedPlaylist`、`fetchLikedAlbums`、`fetchLikedArtists`、`fetchLikedMVs`、`fetchCloudDisk`、`fetchPlayHistory`、`fetchUserProfile`。均调用 `@/api/*`。

### `src/store/plugins/`
- `localStorage.js`：subscribe mutation → 持久化 `settings` 和 `data` 到 localStorage。
- `sendSettings.js`：仅 Electron；subscribe `updateSettings` mutation → `ipcRenderer.send('settings', state.settings)`（主进程据此更新 electron-store + 重注册全局快捷键）。

---

## 五、API 层（`src/api/`）

全部基于 `src/utils/request.js` 的 axios 实例（除 lastfm 直连）。

### `src/utils/request.js`（axios 封装 + baseURL 解析）
- baseURL 选择：Electron 生产用 `VUE_APP_ELECTRON_API_URL`、Electron 开发用 `VUE_APP_ELECTRON_API_URL_DEV`、Web 用 `VUE_APP_NETEASE_API_URL`。
- `withCredentials:true`、`timeout:15000`。
- 请求拦截器：注入 `cookie=MUSIC_U=...`（Web 且非 Electron 且有 MUSIC_U）；非 Electron 非 login 接口注入默认 `realIP=211.161.244.70`；支持 `VUE_APP_REAL_IP`/settings.realIP/settings.proxyConfig 覆盖。
- 响应拦截器：直接返回 `response.data`；遇 `code:301 需要登录` 自动 `doLogout()` 并跳登录页。

### 各 api 文件职责

| 文件 | 职责 |
|---|---|
| `track.js` | 歌曲：`getMP3`(获取 url，br 由 musicQuality 决定，flac→350000)、`getTrackDetail`(详情 + IndexedDB 缓存 + mapTrackPlayableStatus)、`getLyric`、`getCloudLyric`(云盘内嵌歌词 eapi 加密)、`topSong`、`likeATrack`、`scrobble`(听歌打卡) |
| `playlist.js` | 歌单：`recommendPlaylist`、`dailyRecommendPlaylist`(/recommend/resource)、`getPlaylistDetail`、`highQualityPlaylist`、`topPlaylist`、`playlistCatlist`、`toplists`、`subscribePlaylist`、`deletePlaylist`、`createPlaylist`、`addOrRemoveTrackFromPlaylist`、`dailyRecommendTracks`(/recommend/songs)、`intelligencePlaylist`(心动模式) |
| `user.js` | 用户：`userDetail`、`userAccount`、`userPlaylist`、`userPlayHistory`、`userLikedSongsIDs`(/likelist)、`dailySignin`、`likedAlbums`、`likedArtists`、`likedMVs`、`uploadSong`、`cloudDisk`、`cloudDiskTrackDetail`、`cloudDiskTrackDelete` |
| `album.js` | 专辑：`getAlbum`(带缓存)、`newAlbums`、`albumDynamicDetail`、`likeAAlbum` |
| `artist.js` | 歌手：`getArtist`、`getArtistAlbum`、`toplistOfArtists`、`artistMv`、`followAArtist`、`similarArtists` |
| `mv.js` | MV：`mvDetail`、`mvUrl`、`simiMv`、`likeAMV` |
| `auth.js` | 登录：`loginWithPhone`、`loginWithEmail`、`loginQrCodeKey`、`loginQrCodeCreate`、`loginQrCodeCheck`、`refreshCookie`、`logout` |
| `others.js` | 杂项：`search`、`personalFM`(私人 FM)、`fmTrash` |
| `lastfm.js` | 独立 axios 直连 `https://ws.audioscrobbler.com/2.0/`，用 `VUE_APP_LASTFM_API_KEY`/`VUE_APP_LASTFM_API_SHARED_SECRET`，md5 签名：`auth`、`authGetSession`、`trackUpdateNowPlaying`、`trackScrobble` |

### NCM API 模块定义（`src/ncmModDef.js`）
导出 100+ 条 `{identifier, route, module}` 映射，把 `@neteaseapireborn/api/module/*` 注册到内嵌 server。覆盖 user_*/playlist_*/album_*/artist_*/song_*/mv_*/login_*/lyric/search/scrobble/like/likelist/personal_fm/fm_trash/daily_signin/cloudsearch/cloud/check_music/captcha_*/calendar/batch/banner 等全部端点。

### `src/electron/services.js`
`startNeteaseMusicApi()` 调用 `@neteaseapireborn/api` 的 `server.serveNcmApi({ port: 10754, moduleDefs: require('../ncmModDef') })`。

---

## 六、Electron 集成（`src/electron/`）

渲染进程通过 `window.require('electron')` 访问 Node API（因 `nodeIntegration:true`）。
通信两类：`ipcRenderer.send/on`（单向）、`ipcRenderer.invoke` + `ipcMain.handle`（双向）。

### `src/electron/ipcMain.js` — `initIpcMain(win, store, trayEventEmitter)`
实例化 `new UNM.Executor()`（UnblockNeteaseMusic），注册通道：

**ipcMain.handle（invoke 双向）：**
- `unblock-music` — 入参 `(sourceListString, ncmTrack, context)`，用 UNM search+retrieve，处理 bilibili 视频（下载转 base64），返回 `{url, source}`。

**ipcMain.on（渲染→主 单向）：**
- `close` — 按 `closeAppOption`（exit/minimizeToTray/ask）处理关闭。
- `minimize` / `maximizeOrUnmaximize`
- `settings` — 存 electron-store，按 `enableGlobalShortcut` 注册/注销全局快捷键。
- `playDiscordPresence` / `pauseDiscordPresence` — 通过 `discord-rich-presence`（clientId `818936529484906596`）更新状态。
- `setProxy` / `removeProxy` — 设置/清除 session 代理。
- `switchGlobalShortcutStatusTemporary` — 临时禁用/启用全局快捷键。
- `updateShortcut` / `restoreDefaultShortcuts` — 更新快捷键并重建菜单 + 重注册。
- `updateTrayTooltip` / `updateTrayPlayState` / `updateTrayLikeState` / `updateTrayIcon` — 通过 `trayEventEmitter` 通知托盘（仅 isCreateTray）。

### `src/electron/mpris.js`（仅 Linux）
`createMpris(window)`：用 `mpris-service` 创建 MPRIS2 player（name `yesplaymusic`）。监听 player 事件 → `renderer.send('next'/'previous'/'play'/'repeat'/'shuffle'/'setPosition')`；`quit` → `app.exit()`。同时监听 IPC：`player`、`metadata`、`playerCurrentTrackTime`、`seeked`、`switchRepeatMode`、`switchShuffle`。
`createDbus(window)`：连接 OSDLyrics 的 dbus，IPC `sendLyrics` → `osdInterface.SetLyricContent`，完成后 `renderer.send('saveLyricFinished')`。

### `src/electron/tray.js`
`createTray(win, eventEmitter, store)`：按平台返回 `YPMTrayLinuxImpl` 或 `YPMTrayWindowsImpl`。菜单项：播放/暂停（切换可见）、上一首、下一首、循环、加入喜欢/取消喜欢、退出。Linux 用 `setContextMenu`，Windows 用 `popUpContextMenu`。监听 emitter 的 `updateTooltip/updatePlayState/updateLikeState/updateIcon`。图标按 `trayIconTheme`（auto/light/dark）。

### `src/electron/globalShortcut.js`
`registerGlobalShortcut(win, store)`：注册 7 个全局快捷键（play/next/previous/increaseVolume/decreaseVolume/like/minimize）→ `win.webContents.send(...)`。

### `src/electron/menu.js`
`createMenu(win, store)`：应用菜单（Edit/Controls/Window/Help，Mac 多 app 菜单）。Controls 菜单项 accelerator 来自 settings.shortcuts，click → `win.webContents.send('play'/'next'/...)`。

### `src/electron/dockMenu.js`
`createDockMenu(win)`：macOS Dock 菜单（Play/Next/Previous）→ `webContents.send`。

### `src/electron/touchBar.js`
`createTouchBar(window)`：macOS Touch Bar 按钮（上一页/下一页/搜索/上一首/播放/下一首/喜欢/播放队列）→ `renderer.send`。监听 `player` IPC 更新播放/喜欢图标。

### `src/electron/ipcRenderer.js` — `ipcRenderer(vueInstance)`（渲染端监听）
注册主→渲染监听：`changeRouteTo`、`search`、`play`、`next`、`previous`、`increaseVolume`、`decreaseVolume`、`like`、`repeat`、`shuffle`、`routerGo`、`nextUp`、`rememberCloseAppOption`、`setPosition`。给 body 加 `data-electron`/`data-electron-os` 属性。

### IPC 通道总览

**主进程监听（ipcMain.on / handle）：** `unblock-music`(handle)、`close`、`minimize`、`maximizeOrUnmaximize`、`settings`、`playDiscordPresence`、`pauseDiscordPresence`、`setProxy`、`removeProxy`、`switchGlobalShortcutStatusTemporary`、`updateShortcut`、`restoreDefaultShortcuts`、`updateTrayTooltip`、`updateTrayPlayState`、`updateTrayLikeState`、`updateTrayIcon`、`player`、`metadata`、`playerCurrentTrackTime`、`seeked`、`switchRepeatMode`、`switchShuffle`、`sendLyrics`。

**主进程发送给渲染（webContents.send / renderer.send）：** `changeRouteTo`、`search`、`play`、`next`、`previous`、`increaseVolume`、`decreaseVolume`、`like`、`repeat`、`shuffle`、`routerGo`、`nextUp`、`rememberCloseAppOption`、`setPosition`、`isMaximized`、`saveLyricFinished`。

**渲染进程发送给主（ipcRenderer.send / invoke）：** `unblock-music`(invoke)、`player`、`seeked`、`playerCurrentTrackTime`、`switchRepeatMode`、`switchShuffle`、`playDiscordPresence`、`pauseDiscordPresence`、`metadata`、`sendLyrics`、`updateTrayTooltip`、`updateTrayLikeState`、`updateTrayPlayState`、`settings`。

---

## 七、播放器核心

### `src/utils/Player.js`（播放器类，核心）
- 用 **howler.js**（`Howl`/`Howler`），`html5:true`、`format:['mp3','flac']`。项目依赖虽列了 `plyr` 但实际播放用 howler。
- 构造函数初始化：`_playing`、`_progress`、`_enabled`、`_repeatMode`(off/on/one)、`_shuffle`、`_reversed`、`_volume`、`_list`、`_current`、`_shuffledList`、`_playlistSource`、`_currentTrack`、`_playNextList`、`_isPersonalFM`、`_personalFMTrack`/`_personalFMNextTrack`、`_howler`(enumerable:false)、`createdBlobRecords`。
- `window.yesplaymusic.player = this`（供主进程 Express `/player` 端点读取）。
- **音频源获取链** `_getAudioSource(track)`：缓存(IndexedDB) → 网易 `getMP3`(登录用户，跳过试听片段 `freeTrialInfo`，未登录用 `music.163.com/song/media/outer/url`) → UnblockNeteaseMusic。
- `_playAudioSource`：`Howler.unload()` 后 `new Howl`，挂 `onend`→下一首、`loaderror`(code 3 跳下一首、code 4 toast、其他重新替换音频)。
- 播放/暂停带 200ms fade（`PLAY_PAUSE_FADE_DURATION`）。
- `_setIntervals`：每秒同步 `_progress` 到 localStorage，发 `playerCurrentTrackTime` IPC（mpris）。
- **MediaSession API** `_initMediaSession`：注册 play/pause/previoustrack/nexttrack/stop/seekto/seekbackward/seekforward；`_updateMediaSessionMetaData` 设置 artwork；mpris 模式下发 `metadata`/`sendLyrics` IPC。
- **私人 FM**：`playPersonalFM`、`playNextFMTrack`(带 5 次重试)、`moveToFMTrash`、`_loadPersonalFMNextTrack`(预加载下一首)。
- **播放列表操作**：`replacePlaylist`、`playAlbumByID`、`playPlaylistByID`、`playArtistByID`、`playTrackOnListByID`、`playIntelligenceListById`、`addTrackToPlayNext`、`removeTrackFromQueue`。
- **scrobble**：`_scrobble` 调用 `/scrobble` + 满足条件（进度过半或 ≥240s）调 lastfm `trackScrobble`；`play()` 时调 lastfm `trackUpdateNowPlaying`。
- **Discord**：`_playDiscordPresence`/`_pauseDiscordPresence` 发 IPC。
- **缓存下一首** `_cacheNextTrack`。
- `setTitle` 更新 document.title 并发 `updateTrayTooltip` IPC。
- `sendSelfToIpcMain` 发 `player` IPC（playing + likedCurrentTrack）给 touchBar/mpris。
- `seek` 同步 mpris `seeked`；`switchRepeatMode`/`switchShuffle` 同步 mpris 状态。
- `setOutputDevice` 用 `setSinkId` 切换输出设备。

### `src/components/Player.vue`（底部播放器 UI）
- 进度条（`vue-slider-component` 绑 `player.progress`）、当前曲目信息（封面→跳专辑、歌名→跳来源列表、歌手→跳歌手页）、喜欢按钮、上一首/播放暂停/下一首、播放队列（`goToNextTracksPage`→`/next`）、循环模式、随机、倒序（条件显示）、音量条、歌词按钮。
- mounted 注册 `MediaPlayPause`/`MediaTrackPrevious`/`MediaTrackNext` 键盘媒体键。
- 点击空白处切歌词页。

### `src/views/lyrics.vue`（全屏歌词页）
- 调 `getLyric`/`getCloudLyric` 拉歌词 → `lyricParser`/`parseLyric`（`src/utils/lyrics.js`）解析为 `{time, content}[]`。
- `lyricWithTranslation`/`lyricWithRomaPronunciation` 合并翻译/罗马音；`lyricType` 切换。
- **歌词同步**：`setLyricsInterval` 每 50ms 用 `player.seek()` 取进度，`findIndex` 找当前行 `highlightLyricIndex`，`scrollIntoView({behavior:'smooth', block:'center'})` 滚动。点击/双击歌词行 `player.seek(line.time)`。
- 背景：`lyricsBackground` 支持 blur/dynamic(旋转动画)/gradient(`node-vibrant` 取封面主色生成渐变)。
- F11 全屏。

### `src/utils/lyrics.js`
`lyricParser`(拆 lyric/tlytic/romalyric)、`parseLyric`(正则提取 `[mm:ss.ms]` 时间戳，二分插入排序)、`copyLyric`(剪贴板)。

---

## 八、UnblockNeteaseMusic 集成

依赖 `@unblockneteasemusic/rust-napi`，`vue.config.js` 中列为 externals（不打包进 bundle，运行时从 node_modules 加载 .node 原生模块）。

**调用入口**：`src/utils/Player.js` 的 `_getAudioSourceFromUnblockMusic(track)` — 通过 `ipcRenderer.invoke('unblock-music', unmSource, track, context)` 调主进程。

**主进程处理**：`src/electron/ipcMain.js` 的 `ipcMain.handle('unblock-music', ...)`：
- 入参 `sourceListString`(逗号分隔音源，空则默认 `['ytdl','bilibili','pyncm','kugou']`)、`ncmTrack`、`context`(含 `enableFlac`/`proxyUri`/`searchMode`/`joox:cookie`/`qq:cookie`/`ytdl:exe`)。
- `parseSourceStringToList` 过滤出 executor 支持的音源。
- `unmExecutor.search(sourceList, song, context)` → `unmExecutor.retrieve(matchedAudio, context)`。
- bilibili 源特殊处理：`getBiliVideoFile` 下载音频转 base64 返回。
- 失败返回 null（渲染端会 toast 并跳下一首）。

**配置项**（settings，见 `views/settings.vue` 的 unm 配置区）：`enableUnblockNeteaseMusic`(开关，默认 true)、`unmSource`、`unmEnableFlac`、`unmSearchMode`(fast-first/order-first)、`unmJooxCookie`、`unmQQCookies`、`unmYtDlExe`、`unmProxyUri`。

**变灰歌曲处理**：`src/components/TrackListItem.vue` 的 `showUnavailableSongInGreyStyle` 计算属性 — Electron 下若开启 UNM 则不变灰（因为能解锁播放），Web 下恒变灰。歌曲可播性判断在 `utils/common.js` 的 `isTrackPlayable`/`mapTrackPlayableStatus`(基于 `privilege.pl`/`cs`/`fee`/`noCopyrightRcmd`/`st`)。

**缓存**：UNM 返回的源若开启缓存，经 `cacheTrackSource(track, url, 128000, 'unm:<source>')` 存入 IndexedDB（bilibili 源用 `data:application/octet-stream;base64,`）。

---

## 九、工具层（`src/utils/`）

| 文件 | 职责 |
|---|---|
| `auth.js` | Cookie 管理（js-cookie + localStorage 双写）；`isLoggedIn`/`isAccountLoggedIn`(MUSIC_U + loginMode==='account')/`isUsernameLoggedIn`/`isLooseLoggedIn`/`doLogout` |
| `db.js` | Dexie(IndexedDB `yesplaymusic`)。表：`trackDetail`/`lyric`/`album`/`trackSources`(音频源 arraybuffer)。CRUD：`cacheTrackSource`/`getTrackSource`/`cacheTrackDetail`/`getTrackDetailFromCache`/`cacheLyric`/`getLyricFromCache`/`cacheAlbum`/`getAlbumFromCache`/`countDBSize`/`clearDB`；`deleteExcessCache` 按 `cacheLimit`(MB) LRU 淘汰 |
| `common.js` | 主题色预设(default/sunset/ocean/forest)、`changeThemeColor`/`changeAppearance`、`isTrackPlayable`/`mapTrackPlayableStatus`、`randomNum`、`shuffleAList`、`throttle`、`updateHttps`、`dailyTask`(每日刷新 cookie)、`splitSoundtrackAlbumTitle`/`splitAlbumTitle`、`bytesToSize`、`formatTrackTime` |
| `request.js` | axios 封装（见 API 层） |
| `playList.js` | `hasListSource`/`goToListSource`/`getListSourcePath`(回到当前播放列表来源页)、`getRecommendPlayList`(合并每日推荐 + 推荐歌单) |
| `Player.js` | 播放器类（见第七节） |
| `lyrics.js` | 歌词解析（见第七节） |
| `shortcuts.js` | 默认快捷键定义（play/next/previous/increaseVolume/decreaseVolume/like/minimize，各有应用内 shortcut + globalShortcut） |
| `platform.js` | 平台判断：`isWindows`/`isMac`/`isLinux`/`isDevelopment`/`isCreateTray`(Win\|\|Linux\|\|Dev)/`isCreateMpris`(Linux) |
| `updateApp.js` | 版本迁移：合并新 settings、补全新增 shortcuts、0.2.5 重置 player、删旧 `tracks` indexedDB |
| `filters.js` | Vue 全局过滤器：`formatTime`、`formatDate`、`formatAlbumType`、`resizeImage`(网易图片 CDN `?param=NxN`)、`formatPlayCount`(亿/万/M/K)、`toHttps` |
| `base64.js` | ArrayBuffer↔base64 转换（给 UNM bilibili 源用） |
| `nativeAlert.js` | Electron 下用 `dialog.showMessageBoxSync` 替代 `alert`（规避 Win 下 input 失焦 bug） |
| `checkAuthToken.js` | 启动时确保 `os.tmpdir()/anonymous_token` 存在（给 NCM API 用） |
| `staticData.js` | 静态数据（如 `playlistCategories`） |

---

## 十、视图层（`src/views/`）

| 文件 | 页面 |
|---|---|
| `home.vue` | 首页（keepAlive） |
| `explore.vue` | 发现页（keepAlive） |
| `library.vue` | 音乐库（requireLogin, keepAlive）：已喜欢歌单/专辑/歌手/MV/云盘/播放历史 |
| `login.vue` / `loginUsername.vue` / `loginAccount.vue` | 三种登录（二维码 / 用户名搜索只读 / 手机邮箱账号） |
| `settings.vue` | 设置页：外观/主题色/音乐质量/歌词字号/输出设备/缓存/UNM 配置/Discord RPC/全局快捷键/代理/关闭选项 |
| `playlist.vue` | 歌单详情（也复用作 liked-songs） |
| `album.vue` | 专辑详情 |
| `artist.vue` / `artistMV.vue` | 歌手详情 / 歌手 MV（keepAlive） |
| `mv.vue` | MV 播放页 |
| `search.vue` / `searchType.vue` | 搜索 / 分类搜索结果 |
| `newAlbum.vue` | 新碟速递 |
| `next.vue` | 播放队列（下一首列表，keepAlive） |
| `dailyTracks.vue` | 每日推荐歌曲（requireAccountLogin） |
| `lastfmCallback.vue` | Last.fm OAuth 回调 |
| `lyrics.vue` | 全屏歌词页（通过 `showLyrics` 控制显隐，非路由页） |

---

## 十一、执行流程总结（启动 → 播放）

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 打包入口 package.json "main":"background.js" → new Background()│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. 主进程启动 (background.js)                                    │
│    单实例锁 → startNeteaseMusicApi() (NCM API on 10754)          │
│    → createExpressApp() (Express on 27232, /api→10754,           │
│       /player→webContents) → 注册 app:// 协议                     │
│    → app.on('ready'): 创建窗口(加载 27232)、托盘、initIpcMain、   │
│       菜单、dock、touchBar、全局快捷键、mpris(Linux)、            │
│       osdlyrics(可选)、检查更新                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. 渲染进程启动 (main.js → App.vue)                              │
│    dailyTask() → store 初始化(从 localStorage 恢复               │
│    + new Player() Proxy 注入) → ipcRenderer(this) 注册渲染端监听 │
│    → fetchData() 拉用户数据                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. axios 请求链                                                  │
│    渲染进程 request.js baseURL → Electron 生产                   │
│    VUE_APP_ELECTRON_API_URL(指向 27232) → Express /api 代理      │
│    → NCM API(10754) → 网易云                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. 播放一首歌                                                    │
│    视图调 player.playPlaylistByID/AlbumByID/...                  │
│    → replacePlaylist → _replaceCurrentTrack → getTrackDetail     │
│    → _getAudioSource(缓存→网易 getMP3→UNM invoke)                │
│    → _playAudioSource(Howl) → play()(fade、setTitle、            │
│       发 discord/lastfm/tray IPC)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. 播放中                                                        │
│    每秒同步进度 + 发 mpris IPC；歌词页每 50ms 高亮当前行；        │
│    切换歌曲 _scrobble(网易 + lastfm) → _nextTrackCallback → 下一首│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. 设置变更                                                      │
│    settings.vue commit updateSettings → localStorage plugin 持久化│
│    + sendSettings plugin ipcRenderer.send('settings')            │
│    → 主进程存 electron-store + 按需重注册全局快捷键               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. 快捷键/托盘/菜单触发                                          │
│    主进程触发 → webContents.send('play'/'next'/...)              │
│    → 渲染端 ipcRenderer.js 监听 → 调 player 方法                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十二、关键端口与环境变量

**端口**
- `10754` — Electron 内嵌网易云 API（`@neteaseapireborn/api`，由 `services.js` 启动）
- `27232` — Express 代理服务（主进程 `createExpressApp`，对外暴露 `/api` 与 `/player`）
- `3000` — Web 模式外部网易云 API（devServer 代理目标）
- `8080` — Vue devServer
- `80` — Docker nginx 部署端口

**环境变量**（`.env` / `.env.example`）
- `VUE_APP_NETEASE_API_URL` — Web 模式 API 地址
- `VUE_APP_ELECTRON_API_URL` — Electron 生产 API 地址
- `VUE_APP_ELECTRON_API_URL_DEV` — Electron 开发 API 地址
- `VUE_APP_REAL_IP` — 真实 IP（绕过地区限制）
- `VUE_APP_LASTFM_API_KEY` / `VUE_APP_LASTFM_API_SHARED_SECRET` — Last.fm
- `DEV_SERVER_PORT` — devServer 端口覆盖
- `IS_ELECTRON` — 构建期注入，区分 Web/Electron

---

## 十三、两种运行模式对比

| 维度 | Web 模式 | Electron 模式 |
|---|---|---|
| API 来源 | 外部 `VUE_APP_NETEASE_API_URL` | 内嵌 `@neteaseapireborn/api` (10754) + Express 代理 (27232) |
| 路由模式 | history | hash |
| 登录守卫 | `requireLogin` → `/login` | `requireLogin` → `/login/account` |
| UnblockNeteaseMusic | ❌ 不支持（需主进程） | ✅ 支持（`@unblockneteasemusic/rust-napi`） |
| 变灰歌曲 | 恒变灰 | 开启 UNM 则不变灰 |
| 全局快捷键/托盘/菜单/MediaSession 高级特性 | ❌ | ✅ |
| 真实 IP 注入 | 默认 `211.161.244.70` | 由 NCM API 本地处理 |
| 缓存音频 | ✅ IndexedDB | ✅ IndexedDB |
| Discord/Last.fm scrobble | ✅(Discord 除外) | ✅ |
