import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useMusicStore } from '@/stores/music'
import { STORAGE_KEYS } from '@/constants'

// 默认配置：总开关关，子项默认全开（总开关开时生效）
export const DEFAULT_PRELOAD_CONFIG = {
  enabled: false,
  items: {
    dailyRecommend: true,
    toplists: true,
    liked: true,
    playlists: true
  }
}

export const PRELOAD_ITEMS = [
  { key: 'dailyRecommend', label: '每日推荐' },
  { key: 'toplists', label: '排行榜' },
  { key: 'liked', label: '喜欢的歌曲' },
  { key: 'playlists', label: '我的歌单' }
]

function loadConfig() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PRELOAD) || 'null'
    )
    if (!saved)
      return {
        ...DEFAULT_PRELOAD_CONFIG,
        items: { ...DEFAULT_PRELOAD_CONFIG.items }
      }
    // 合并默认，保证新增子项有值
    return {
      enabled: saved.enabled ?? false,
      items: { ...DEFAULT_PRELOAD_CONFIG.items, ...saved.items }
    }
  } catch {
    return {
      ...DEFAULT_PRELOAD_CONFIG,
      items: { ...DEFAULT_PRELOAD_CONFIG.items }
    }
  }
}

const config = ref(loadConfig())

function persist() {
  localStorage.setItem(STORAGE_KEYS.PRELOAD, JSON.stringify(config.value))
}

// 触发预加载：按子项开关调对应 fetch，失败静默（预加载是优化，不该报错）
export async function runPreload() {
  const cfg = config.value
  if (!cfg.enabled || !cfg.items) return
  const userStore = useUserStore()
  if (!userStore.isLoggedIn || !userStore.userInfo.id) return
  const musicStore = useMusicStore()

  // 各项独立 catch，互不影响
  const tasks = []
  if (cfg.items.dailyRecommend) {
    tasks.push(musicStore.fetchDailyRecommend().catch(() => {}))
  }
  if (cfg.items.toplists) {
    tasks.push(musicStore.fetchToplists().catch(() => {}))
  }
  if (cfg.items.liked) {
    tasks.push(userStore.fetchLikedTracks().catch(() => {}))
  }
  if (cfg.items.playlists) {
    tasks.push(
      musicStore.fetchUserPlaylists(userStore.userInfo.id).catch(() => {})
    )
  }
  await Promise.allSettled(tasks)
}

export function usePreload() {
  function setEnabled(val) {
    config.value = { ...config.value, enabled: val }
    persist()
    // 开启时立即触发一次预加载
    if (val) runPreload()
  }

  function setItem(key, val) {
    config.value = {
      ...config.value,
      items: { ...config.value.items, [key]: val }
    }
    persist()
    if (val && config.value.enabled) runPreload()
  }

  return {
    config,
    setEnabled,
    setItem
  }
}
