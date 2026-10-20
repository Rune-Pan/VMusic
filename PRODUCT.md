# 听潮 · VMusic

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

在 Windows 电脑浏览器和 Electron 桌面应用中发现、搜索和收听音乐的用户。

## Product Purpose

以真实音乐封面、歌单和歌词帮助用户发现音乐、持续播放和管理已有收藏。

## Capabilities and Constraints

- Vue 3、Vite、Sass、Pinia、Vue Router；继续使用现有 API、共享播放器和 IndexedDB 缓存。
- 八个现有页面：登录、首页、每日推荐、排行榜、歌单、歌手、个人中心、播放详情。
- 音乐数据与播放权限由网易云上游和账号权限决定；保留登录及本地/云端写入边界。
- 界面重设计以桌面 900×650 及以上为目标。Chrome、Edge、Electron 为完整效果目标。
- 保留主题、主题色、音质、歌词、快捷键和预加载偏好及现有持久化格式。
- 切页不重建音频实例，恢复会话保持暂停，浏览歌曲详情不自动播放。

## Brand Commitments

保留“听潮”名称、中文功能用语和主要导航标签。网站品牌采用已选定的 B「潮·水势」原创标识，融合三点水与潮线；导航、登录页共用母形，favicon 使用蓝白版本，桌面应用图标尚未接入。用户确认采用强烈通透、真实后景折射的 Apple Liquid Glass 网页近似。

## Accessibility & Inclusion

主要操作可通过键盘使用；保持清晰焦点、文本对比及减少动态效果/透明度的降级。

## Evidence on Hand

封面、头像、曲目和歌词使用真实 API 数据。自动测试采用隔离模拟数据，不能替代真人登录、听音或云端写入验收。
