# 听潮 待办事项清单

记录 听潮 已完成功能、修复与待处理事项，与代码实现同步。

## ✅ 已完成功能

### 核心功能
| 功能 | 说明 |
|------|------|
| 用户认证 | 手机号密码 + 手机验证码 + 二维码扫码登录，登录态持久化，路由权限守卫 |
| 推荐首页 | 推荐歌单网格、分类筛选（服务端分类）、响应式布局 |
| 沉浸式播放页 | 进入播放页隐藏导航栏，PlayerBar 透明融入，歌词同步滚动，ESC 退出 |
| 歌单详情 | 歌单信息展示、播放全部、加载更多、自己歌单可移除歌曲 |
| 歌单评论 | 评论弹窗，复用 CommentModal（支持歌曲/歌单），SWR 缓存 + 滚动触底自动加载 |
| 歌单分享 | 复制歌单链接到剪贴板 |
| 每日推荐 | 推荐歌曲 + 推荐歌单双 Tab |
| 排行榜 | 分类 Tab + 榜单卡片网格 + 前三首预览 |
| 个人中心 | 喜欢的歌曲 / 我的歌单（创建/收藏分类）/ 播放历史 / 个人设置（分组：外观/播放/快捷键/预加载） |
| 播放历史 | 本地 + 服务端（最近一周/所有时间）三种模式 |
| 多类型搜索 | 歌曲 / 歌单 / 歌手 / 专辑，全局搜索覆盖层（ESC 关闭 + shimmer 骨架 + 单曲行式骨架） |
| 添加到歌单 | MusicCard 与 PlayerBar 更多菜单，弹窗选择本地/网易云歌单 |
| 主题切换 | 深色 / 浅色 / 跟随系统，持久化 |
| 主题色 | 4 预设（默认/紫罗/玫红/碧波），light/dark 双配色，跟随主题色联动 |
| 快捷键 | 7 操作可自定义（播放/上一首/下一首/音量±/静音/喜欢），设置页录制 + 冲突检测 |
| 预加载 | 登录后预加载列表页数据（每日推荐/排行榜/喜欢的歌曲/我的歌单），设置页可配置 |
| 常量集中管理 | `src/constants.js` 集中 localStorage 键名、占位图、轮询间隔等 |
| 持久缓存（IndexedDB） | Dexie + SWR 模式 + LRU 淘汰，缓存歌词/歌曲详情/歌单详情/音频 url/评论，TTL 与上限见 `src/constants.js` |

### 关键 Bug 修复
| Bug | 修复 |
|-----|------|
| 音量静音/取消静音异常 | 用 volumeBeforeMuted 保存静音前音量 |
| 红心状态刷新丢失 | addLikedSong/removeLikedSong 后立即 persist |
| LoginView 内存泄漏 | onUnmounted 移至 setup 顶层 |
| 每日推荐缓存时区错误 | isToday 改用本地时间 |
| 排行榜失败后永久缓存空数据 | 失败时不缓存，允许重试 |
| 排行榜播放只有 3 首歌 | 播放时获取完整曲目列表 |
| 搜索功能仅首页可用 | 全局 SearchResultsOverlay 覆盖层 |
| 搜索歌手/专辑点击跳转错误 | 改为提示暂不支持（无独立页） |
| 搜索覆盖层跳转后不关闭 | route.path 监听自动关闭 |
| mapTrackPlayableStatus 返回值丢弃 | 正确赋值回原数组 |
| 播放历史不更新 | scrobble 在切歌时记录上一首实际听歌时长 |
| 退出登录不跳转 | logout 先清本地状态，API 后台调用不阻塞 |
| 播放详情页高度溢出 | PlayerView 改 position: fixed |
| 返回上一级页面空白 | PlaylistView 多根节点破坏 transition，恢复单根 |
| 歌单卡片显示 0 歌曲 | 用 trackCount ?? tracks.length 回退 |
| 每日推荐歌单无简介 | copywriter 为空，回退用创建者昵称 |
| LoginView @click 多语句编译错误 | 改用逗号分隔 |
| 收藏 405 笼统提示 | 识别限流码，提示"操作过于频繁" |
| likelist 参数传对象致 301 | 改传原始 uid，避免 axios 序列化成 uid[uid] |
| 列表删空时 Howler 未停 | removeFromPlaylist 补 _howler.pause() + _stopProgressTimer() |
| 删播放列表联动改 likedTracks | play/setPlaylist 浅拷贝 [...list] 断开引用 |
| 喜欢按钮闪两次 | Set.add/delete 改整体重新赋值 + 移除 fetchLikedTracks 竞态覆盖 + 补 likeSong API |
| 重置全部快捷键无反应 | composable 导出名 resetAll 与解构 resetAllShortcuts 不匹配，统一 |

---

## ⚠️ 已知问题

### `/playlist/subscribe` 接口 eapi 通道返回 405

> 注：歌单收藏功能已移除（subscribePlaylist 函数删除），本节仅记录接口不可用的根因，供日后若恢复收藏功能时参考。

**现象：** 点击收藏歌单时，本地 API 返回 `code: 405, message: "操作过于频繁，请稍后再试"`。即使换了账号、重启 API 实例、只操作一次也会复现。

**排查过程：**
1. 非防抖问题——代码有 `subscribing` 守卫，且只点了一次
2. 非账号问题——换账号后仍然 405
3. 非 IP 限频——同一 IP 下网易云官方客户端请求返回 200
4. 非 API 版本问题——`npx @neteasecloudmusicapienhanced/api` 最新版同样 405
5. 仅此接口报错——其他写操作（`/like`、`/playlist/tracks`）正常

**根因：** 网易云对 `/playlist/subscribe` 接口单独加强了校验，拒绝第三方 API 请求。将 eapi 改为 weapi 无效，具体校验机制未知，待进一步排查。

---

## 🚧 待处理

### 未使用的 API 函数（待清理或后续接入）
共 1 个：
- `personalFM`（`src/api/others.js`）— 私人 FM 未做 UI

（已清理：`loginWithEmail`、`loginQrCodeCreate`、`userDetail`，及孤立文件 `src/api/index.js`、`src/composables/useLyricScroll.js`，未引用常量 `LIKE_ANIMATION_DURATION`/`API_TIMEOUT_MS`/`NETEASE_BASE_URL`。）

### 暂不实现
| 功能 | 说明 |
|------|------|
| 发表评论 | CommentModal 只读展示，无输入框和提交 API |
| 个人 FM 页 | 无路由，API 已定义未调用 |
| 邮箱登录 | UI 只有手机号和扫码登录 |
| 注册功能 | 仅登录，无注册页（网易云账号体系） |
| 修改密码/注销账号 | ProfileView 无此功能 |
| 专辑/歌手详情页 | 搜索结果中点击仅提示暂不支持 |
