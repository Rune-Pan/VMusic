---
name: 听潮 · VMusic
description: 封面是内容主体，液态玻璃是悬浮控制层。
colors:
  primary: "#3b82f6"
  primary-hover: "#60a5fa"
  primary-bg-light: "rgba(59, 130, 246, 0.12)"
  primary-bg-dark: "rgba(59, 130, 246, 0.18)"
  purple-light: "#7c3aed"
  purple-dark: "#a78bfa"
  rose-light: "#e11d48"
  rose-dark: "#fb7185"
  green-light: "#22c55e"
  green-dark: "#4ade80"
  body-light: "#edf0f3"
  body-dark: "#14181e"
  card-light: "#ffffff"
  card-dark: "#242a32"
  text-light: "#202733"
  text-dark: "#f1f4f8"
  secondary-light: "#34404f"
  secondary-dark: "#c3cdd9"
  muted-light: "#4b5869"
  muted-dark: "#b4bfcd"
  action-text: "#f8fafc"
  action-bg: "color-mix(in srgb, var(--color-primary) 45%, #14263a)"
  action-hover: "color-mix(in srgb, var(--color-primary) 40%, #14263a)"
  accent-ink-light: "var(--color-action-bg)"
  accent-ink-dark: "color-mix(in srgb, var(--color-primary) 65%, #f1f4f8)"
  border-light: "#e2e8f0"
  border-dark: "#3a424d"
  glass-solid-light: "#f1f3f6"
  glass-solid-dark: "#242c36"
  glass-tint-light: "rgb(248 250 253 / 0.55)"
  glass-tint-dark: "rgb(33 41 52 / 0.61)"
  glass-border-light: "rgb(255 255 255 / 0.8)"
  glass-border-dark: "rgb(232 242 255 / 0.22)"
  glass-highlight-light: "rgb(255 255 255 / 0.65)"
  glass-highlight-dark: "rgb(224 239 255 / 0.16)"
  content-light: "rgb(250 252 254 / 0.65)"
  content-dark: "rgb(26 33 43 / 0.76)"
  ambient-blue-light: "#c9d9ec"
  ambient-blue-dark: "#293e56"
  ambient-silver-light: "#d6dce4"
  ambient-silver-dark: "#25303e"
  ambient-veil-light: "rgb(239 242 246 / 0.68)"
  ambient-veil-dark: "rgb(18 24 33 / 0.72)"
  ambient-scrim-light: "rgb(239 242 246 / 0.45)"
  ambient-scrim-dark: "rgb(18 24 33 / 0.4)"
  overlay: "rgb(8 16 28 / 0.28)"
  success: "#22c55e"
  error: "#ef4444"
  warning: "#f59e0b"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans CJK SC', 'WenQuanYi Micro Hei', sans-serif"
    fontSize: "34px"
    fontWeight: 720
    letterSpacing: "-0.035em"
  featured-title:
    fontSize: "clamp(22px, 2.2vw, 32px)"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.03em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans CJK SC', 'WenQuanYi Micro Hei', sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  card-title:
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.55
  navigation:
    fontSize: "14px"
    fontWeight: 580
  label:
    fontSize: "13px"
  caption:
    fontSize: "12px"
  lyric:
    fontSize: "var(--lyric-font-size, 24px)"
    fontWeight: 600
    lineHeight: 1.65
rounded:
  sm: "8px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  glass: "28px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.action-bg}"
    textColor: "{colors.action-text}"
    rounded: "{rounded.full}"
    padding: "11px 22px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.action-text}"
  search:
    backgroundColor: "var(--surface-content)"
    textColor: "var(--color-text-secondary)"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  navigation-item:
    textColor: "var(--color-text-secondary)"
    typography: "{typography.navigation}"
    rounded: "14px"
    padding: "13px 16px"
  navigation-item-active:
    backgroundColor: "var(--color-primary-bg)"
    textColor: "var(--color-accent-ink)"
  tab:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "9px 18px"
  tab-active:
    backgroundColor: "var(--color-primary-bg)"
    textColor: "var(--color-accent-ink)"
  cover:
    rounded: "{rounded.lg}"
  player:
    rounded: "{rounded.glass}"
    padding: "12px 24px"
    height: "88px"
---

# Design System: 听潮 · VMusic

## Overview

**Creative North Star: "封面是内容主体，液态玻璃是悬浮控制层"**

听潮面向桌面浏览器和 Electron。真实封面、曲目与歌词承担内容表达；导航、共享播放器和任务浮层采用通透、有边缘折射的控制材质。该实现是 Apple Liquid Glass 的网页近似，不代表 Apple 原生材质或官方 CSS 包。

银灰浅色与石墨深色提供稳定底色，用户原有强调色提供操作识别。默认背景保持冷调，登录后仅跟随当前播放曲目的封面；新图加载完成后才交叉淡入。已确认的设计参数为 DESIGN_VARIANCE 7、MOTION_INTENSITY 6、VISUAL_DENSITY 4。

**Key Characteristics:**

- 真实封面主导内容，玻璃用于悬浮控制和任务浮层。
- 带文字的左侧导航、顶部搜索和账户、底部共享播放器形成稳定桌面框架。
- 系统字体、克制的文字层级、圆角封面与胶囊操作。
- 折射层与前景文字分离，并提供磨砂、实体及减少动态效果的降级。

## Colors

前置 tokens 记录实现的最终语义值；`variables.scss` 后声明覆盖前声明，不能依据文件顶部的旧注释推断最终风格。

### Primary

默认蓝用于强调。紫罗、玫红、碧波保留为用户可选主题色；深色模式使用各自的深色配方。`useTheme.js` 从 `constants.js` 写入 primary、primary-hover、primary-bg、primary-bg-transparent 和 shadow-glow，切换外观时重新应用。

**The Readable Accent Rule.** 主要实色操作使用 action-bg 和 action-text；选中导航、页内标签和曲目列表的活动曲目使用 accent-ink；队列当前曲名采用正文色，以主题选中底色识别当前项。不要直接把所有主题色当作浅底小字或白字按钮的背景。

### Neutral

body、card、text、secondary、muted 区分页面、内容和文字层级；glass-solid 是无透明度回退底色，glass-tint 是光学层填充，content 是内容容器的轻底色。ambient-blue、ambient-silver、ambient-veil 和 ambient-scrim 为封面背景提供冷调底与阅读遮罩。

### Functional

success、error、warning 用于状态。付费、购买和无版权角标沿用独立 badge 语义及其深色覆盖，不能从主题强调色推断状态。

## Typography

标题与正文共用前置 tokens 中的系统字体栈；中文优先使用操作系统可用的苹方、微软雅黑等回退。没有额外下载的展示字体。

- **Headline:** 页面标题使用较紧字距和明确字重；紧凑桌面缩为 30px。
- **Featured title:** 首页重点推荐标题可换行，最多两行；紧凑桌面固定 22px。
- **Body / card title:** 正文与封面标题保持易扫读的基础字号；歌手和辅助信息使用 caption。
- **Label / navigation:** 操作、标签和导航使用明确中文标签；导航保留文字。
- **Lyric:** 原文跟随现有歌词字号偏好；译文为 14px、常规字重，时间使用等宽数字。当前行通过文字颜色和轻微缩放识别。

歌单、歌手说明最长约 65ch，首页重点推荐描述约 45ch。长标题可换行或按组件既有规则截断，不挤压操作区域。

## Layout

以桌面外窗 900×650 为最低目标，同时覆盖 1280×820 和 1440×900。Electron 最小外窗实测内容区为 896×623，因此文档根元素最小宽度为 880px；本轮没有手机布局、安装包或发布范围。

默认侧栏宽 168px、外缘间距 18px、顶部工具区高 64px、底部播放器高 88px。侧栏采用 A「整体短面板」，高度随内容决定，圆角 24px；无播放器时在视口中垂直居中，出现播放器时在其上方可用区域中居中。内容最大宽度为 1400px，常规页内留白为 24px 32px 40px。主内容分别避让顶部、侧栏和播放器。

在 `max-width: 1199px` 收紧为侧栏 152px、外缘间距 14px、页内留白 20px 24px 32px；搜索结果网格从四列收为三列。保持桌面信息层级，不折叠为手机导航。

首页第一项推荐成为重点封面，后续项目保持原顺序进入网格。个人中心使用资料头部与横向页内标签。播放详情隐藏导航，封面和歌词保持两列；歌词区域内部滚动，返回与底部共享播放器持续可用。搜索、队列和对话框按视口限制高度，并在内部滚动。

## Elevation & Depth

内容依靠封面与轻底色分组；悬浮控制通过阴影、内高光、边缘反射和真实后景采样建立深度。不要为每张内容卡再叠一层独立折射。

**The Clear Foreground Rule.** 折射和模糊只作用于 GlassSurface 的独立光学层，文字与图标保持清晰。公共祖先不要添加会阻断后景采样的 opacity 或 filter。

Chromium 且支持 SVG backdrop filter 时启用位移折射；其他支持 backdrop-filter 的环境使用普通磨砂；无滤镜支持时使用实体底。光学参数、阴影、层级和回退规则记录于 `.impeccable/design.json`，避免塞入不支持这些属性的前置 token schema。

## Shapes

封面使用内容圆角，主要玻璃控制层使用更大的 glass 圆角。普通小控件沿用 sm/md，资料或详情大封面使用 xl；按钮、搜索及分段标签使用 full。圆形头像与播放按钮保持圆形，曲目行使用较小的局部圆角。

玻璃边界为一像素细边，辅以内边高光。内容容器使用自己的轻底色，不需要复制玻璃边框和折射。

## Components

### Buttons

主要播放操作为实色胶囊，使用前置 button-primary；hover 改用 action-hover。次级操作保留轻底色或透明外观。键盘焦点为强调色双像素轮廓；禁用操作保持既有禁用语义与半透明状态。按下轻缩放沿用既有状态反馈；减少动态效果时过渡缩至近瞬时。

### Inputs / Fields

顶部搜索使用轻底色胶囊、44px 高度和 label 字号，聚焦时外框可见。登录表单沿用边框与内容底色，嵌套输入不再独立模糊。保留可访问名称和键盘焦点。

### Navigation / Tabs

左侧导航将 B「潮·水势」原创标识与「听潮」组成单行品牌，与四个完整中文入口共置于一块玻璃面板内，不显示 VMusic 副标及底部标语。导航 22px 图形置于 30px 容器，登录页共用 40px 图形与 88px 容器；图形继承现有强调色，玻璃材质由容器承担。favicon 固定蓝白，16px 使用简化版；桌面应用图标尚未接入。品牌组件独立于 46 个功能图标。入口操作区域高 44px，选中项使用主题浅底与可读 accent-ink，键盘焦点清晰可见。悬停轻移两像素，减少动态效果时过渡缩至近瞬时。个人中心页内标签横向排列；选中状态通过底色和文字表达，不恢复第二条侧栏。

### Cards / Containers

普通推荐由真实方形封面和下方文字组成，封面角标和播放操作保持独立。首页重点推荐为封面与说明两列的轻底色容器，使用较大的标题和明确播放操作。键盘焦点进入卡片或曲目时，显示与 hover 等价的播放及操作入口。

### GlassSurface / Shared Player

GlassSurface 统一承载导航、共享播放器和任务浮层。SVG 位移图在初始化和尺寸变化时生成；指针追光通过 CSS 变量与 requestAnimationFrame 更新，不逐帧重建位移图。共享播放器停留在页面底部外缘留白内，切页沿用同一播放状态。

### Ambient Background / Player Detail

未登录或没有封面时显示冷调背景。新封面加载前保留上一张，加载失败回退默认背景；过期加载不能覆盖新曲目。封面交叉淡入，正文由阅读遮罩保护。播放详情的大封面与歌词分列，当前歌词使用现有字号偏好，不能由浏览详情触发自动播放。

## Do's and Don'ts

### Do:

- **Do** 让真实封面承担内容表达，把液态玻璃用于悬浮控制和任务浮层。
- **Do** 使用最终语义变量和现有四个主题色，保留深浅外观及用户偏好。
- **Do** 保持键盘焦点清晰，使焦点进入时也能看到卡片播放、曲目操作和队列移除入口。
- **Do** 在减少透明度时关闭折射、隐藏封面氛围并使用实体表面，在减少动态效果时关闭追光、过渡和进场动画。
- **Do** 将模拟接口、静音音频和渲染检查与真人登录、听音及云端写入验收分开报告。

### Don't:

- **Don't** 把网页近似称为 Apple 官方原生 Liquid Glass。
- **Don't** 为每个内容卡片嵌套独立玻璃滤镜，或让前景文字参与折射。
- **Don't** 重排首页后续推荐，或在个人中心恢复双侧栏。
- **Don't** 把切页、打开详情或封面加载与自动播放绑定。
- **Don't** 因视觉重设计修改账号、播放、缓存和持久化格式等既有业务契约。
