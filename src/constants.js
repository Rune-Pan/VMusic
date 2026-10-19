// 集中管理项目常量，避免硬编码重复

// localStorage 键名
export const STORAGE_KEYS = {
  USER: 'vmusic-user',
  PLAYER: 'vmusic-player',
  PLAY_HISTORY: 'vmusic-play-history',
  PLAYLISTS: 'vmusic-playlists',
  CATEGORY_STATE: 'vmusic-category-state',
  PROFILE_ACTIVE_MENU: 'vmusic-profile-active-menu',
  THEME: 'vmusic-theme',
  THEME_COLOR: 'vmusic-theme-color',
  MUSIC_QUALITY: 'vmusic-music-quality',
  LYRIC_FONT_SIZE: 'vmusic-lyric-font-size',
  SHOW_LYRICS_TRANSLATION: 'vmusic-show-lyrics-translation',
  SHOW_LYRICS_TIME: 'vmusic-show-lyrics-time',
  SHORTCUTS_ENABLED: 'vmusic-shortcuts-enabled',
  SHORTCUTS: 'vmusic-shortcuts',
  PRELOAD: 'vmusic-preload'
}

// 音质选项（参考上游 YesPlayMusic musicQuality）
// short 用于分段按钮短标签，label 用于 select 等长文案
export const MUSIC_QUALITY_OPTIONS = [
  { value: 128000, short: '标准', label: '标准 - 128Kbps' },
  { value: 192000, short: '较高', label: '较高 - 192Kbps' },
  { value: 320000, short: '高品', label: '高品 - 320Kbps' },
  { value: 999000, short: '无损', label: '无损 - FLAC' }
]
export const DEFAULT_MUSIC_QUALITY = 320000

// 歌词字号选项（参考上游 YesPlayMusic lyricFontSize）
export const LYRIC_FONT_SIZE_OPTIONS = [
  { value: 16, short: '小' },
  { value: 22, short: '中' },
  { value: 28, short: '大' }
]
export const DEFAULT_LYRIC_FONT_SIZE = 16

// 主题选项（auto 跟随系统）
export const THEME_OPTIONS = [
  { value: 'light', short: '浅色' },
  { value: 'dark', short: '深色' },
  { value: 'auto', short: '跟随系统' }
]

// 主题色预设（参考上游 YesPlayMusic themeColorPresets，本项目纯色无渐变）
// 每预设配 light/dark 两套，dark 用提亮变体保证对比度（color-dark-mode 规则）
// 每套 5 个变量：primary / primaryHover / primaryBg / primaryBgTransparent / shadowGlow
export const THEME_COLOR_OPTIONS = [
  {
    value: 'default',
    label: '默认',
    swatch: '#3b82f6',
    light: {
      primary: '#3b82f6',
      primaryHover: '#60a5fa',
      primaryBg: 'rgba(59, 130, 246, 0.12)',
      primaryBgTransparent: 'rgba(59, 130, 246, 0.08)',
      shadowGlow: 'rgba(59, 130, 246, 0.15)'
    },
    dark: {
      primary: '#3b82f6',
      primaryHover: '#60a5fa',
      primaryBg: 'rgba(59, 130, 246, 0.18)',
      primaryBgTransparent: 'rgba(59, 130, 246, 0.15)',
      shadowGlow: 'rgba(59, 130, 246, 0.25)'
    }
  },
  {
    value: 'purple',
    label: '紫罗',
    swatch: '#7c3aed',
    light: {
      primary: '#7c3aed',
      primaryHover: '#8b5cf6',
      primaryBg: 'rgba(124, 58, 237, 0.12)',
      primaryBgTransparent: 'rgba(124, 58, 237, 0.08)',
      shadowGlow: 'rgba(124, 58, 237, 0.15)'
    },
    dark: {
      primary: '#a78bfa',
      primaryHover: '#c4b5fd',
      primaryBg: 'rgba(167, 139, 250, 0.18)',
      primaryBgTransparent: 'rgba(167, 139, 250, 0.15)',
      shadowGlow: 'rgba(167, 139, 250, 0.25)'
    }
  },
  {
    value: 'rose',
    label: '玫红',
    swatch: '#e11d48',
    light: {
      primary: '#e11d48',
      primaryHover: '#f43f5e',
      primaryBg: 'rgba(225, 29, 72, 0.12)',
      primaryBgTransparent: 'rgba(225, 29, 72, 0.08)',
      shadowGlow: 'rgba(225, 29, 72, 0.15)'
    },
    dark: {
      primary: '#fb7185',
      primaryHover: '#fda4b4',
      primaryBg: 'rgba(251, 113, 133, 0.18)',
      primaryBgTransparent: 'rgba(251, 113, 133, 0.15)',
      shadowGlow: 'rgba(251, 113, 133, 0.25)'
    }
  },
  {
    value: 'green',
    label: '碧波',
    swatch: '#22c55e',
    light: {
      primary: '#22c55e',
      primaryHover: '#4ade80',
      primaryBg: 'rgba(34, 197, 94, 0.12)',
      primaryBgTransparent: 'rgba(34, 197, 94, 0.08)',
      shadowGlow: 'rgba(34, 197, 94, 0.15)'
    },
    dark: {
      primary: '#4ade80',
      primaryHover: '#86efac',
      primaryBg: 'rgba(74, 222, 128, 0.18)',
      primaryBgTransparent: 'rgba(74, 222, 128, 0.15)',
      shadowGlow: 'rgba(74, 222, 128, 0.25)'
    }
  }
]
export const DEFAULT_THEME_COLOR = 'default'

// 占位图 URL
export const PLACEHOLDER_COVER_300 =
  'https://placehold.co/300x300/1E1E2E/3B82F6?text=Music'
export const PLACEHOLDER_AVATAR_80 =
  'https://placehold.co/80x80/1E1E2E/FFFFFF?text=U'
export const PLACEHOLDER_COVER_48 =
  'https://placehold.co/48x48/1E1E2E/3B82F6?text=Music'

// 图片缩放尺寸
export const IMAGE_SIZE_LARGE = 512
export const IMAGE_SIZE_CARD = 300
export const IMAGE_SIZE_AVATAR = 80

// 播放器默认值
export const DEFAULT_VOLUME = 0.8

// API 请求限制
export const RECOMMEND_LIMIT = 30
export const CATEGORY_PLAYLIST_LIMIT = 10
export const SEARCH_LIMIT = 16

// 预加载数量
export const PRELOAD_CATEGORY_COUNT = 3
export const TOPLIST_PREVIEW_COUNT = 3

// 定时器间隔（毫秒）
export const PROGRESS_POLL_INTERVAL = 250
export const DEFAULT_TOAST_DURATION = 2000
export const QR_CHECK_INTERVAL = 1000

// IndexedDB 缓存 TTL（毫秒）
export const CACHE_TTL_LYRIC = 7 * 24 * 60 * 60 * 1000 // 7 天
export const CACHE_TTL_TRACK_DETAIL = 24 * 60 * 60 * 1000 // 1 天
export const CACHE_TTL_PLAYLIST_DETAIL = 60 * 60 * 1000 // 1 小时
export const CACHE_TTL_TRACK_SOURCE = 30 * 60 * 1000 // 30 分钟
export const CACHE_TTL_USER_PLAYLISTS = 10 * 60 * 1000 // 10 分钟
export const CACHE_TTL_TOPLISTS = 24 * 60 * 60 * 1000 // 1 天
export const CACHE_TTL_CATEGORY_LIST = 24 * 60 * 60 * 1000 // 1 天
export const CACHE_TTL_RECOMMEND = 60 * 60 * 1000 // 1 小时

// IndexedDB 缓存条数上限（LRU 淘汰）
export const CACHE_MAX_LYRIC = 500
export const CACHE_MAX_TRACK_DETAIL = 500
export const CACHE_MAX_PLAYLIST_DETAIL = 100
export const CACHE_MAX_TRACK_SOURCE = 200
export const CACHE_MAX_USER_PLAYLISTS = 5
export const CACHE_MAX_MISC = 20

// 时间窗去重（毫秒）
export const FETCH_DEBOUNCE_LIKED_SONGS = 10 * 60 * 1000 // 10 分钟
export const FETCH_DEBOUNCE_PLAY_HISTORY = 5 * 60 * 1000 // 5 分钟

// 快捷键功能列表 + 默认键位
// key 对应 action id，键位用 { ctrl, alt, shift, key } 表示
// 规则：除 Space（播放暂停）外，必须带修饰键，避免与输入/滚动冲突
export const SHORTCUT_ACTIONS = [
  {
    id: 'playPause',
    label: '播放/暂停',
    default: { alt: false, ctrl: false, shift: false, key: ' ' }
  },
  {
    id: 'prev',
    label: '上一首',
    default: { alt: true, ctrl: false, shift: false, key: 'ArrowLeft' }
  },
  {
    id: 'next',
    label: '下一首',
    default: { alt: true, ctrl: false, shift: false, key: 'ArrowRight' }
  },
  {
    id: 'volumeUp',
    label: '音量加',
    default: { alt: true, ctrl: false, shift: false, key: 'ArrowUp' }
  },
  {
    id: 'volumeDown',
    label: '音量减',
    default: { alt: true, ctrl: false, shift: false, key: 'ArrowDown' }
  },
  {
    id: 'mute',
    label: '静音',
    default: { alt: true, ctrl: false, shift: false, key: 'm' }
  },
  {
    id: 'like',
    label: '喜欢/取消喜欢',
    default: { alt: true, ctrl: false, shift: false, key: 'l' }
  }
]

// 默认键位映射（id → 键位对象）
export const DEFAULT_SHORTCUTS = SHORTCUT_ACTIONS.reduce((map, a) => {
  map[a.id] = a.default
  return map
}, {})

// 音量±单次步进
export const SHORTCUT_VOLUME_STEP = 0.1
