import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { likeSong } from '@/api/track'
import {
  STORAGE_KEYS,
  SHORTCUT_ACTIONS,
  DEFAULT_SHORTCUTS,
  SHORTCUT_VOLUME_STEP
} from '@/constants'

const enabled = ref(
  localStorage.getItem(STORAGE_KEYS.SHORTCUTS_ENABLED) !== 'false'
)
const shortcuts = ref(loadShortcuts())

function loadShortcuts() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.SHORTCUTS) || '{}'
    )
    // 合并默认：保证新增的 action 有默认值
    const result = {}
    for (const action of SHORTCUT_ACTIONS) {
      result[action.id] = saved[action.id] || { ...action.default }
    }
    return result
  } catch {
    return { ...DEFAULT_SHORTCUTS }
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEYS.SHORTCUTS, JSON.stringify(shortcuts.value))
  localStorage.setItem(STORAGE_KEYS.SHORTCUTS_ENABLED, String(enabled.value))
}

// 键位 → 可读字符串（如 "Alt + ←"）
export function formatShortcut(s) {
  if (!s) return ''
  const parts = []
  if (s.ctrl) parts.push('Ctrl')
  if (s.alt) parts.push('Alt')
  if (s.shift) parts.push('Shift')
  const keyMap = {
    ' ': 'Space',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓'
  }
  parts.push(keyMap[s.key] || s.key.toUpperCase())
  return parts.join(' + ')
}

// 录制按键事件 → 标准化键位对象
export function eventToShortcut(e) {
  return {
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    key: e.key
  }
}

// 判断是否 input/textarea/contenteditable 聚焦
function isInputFocused() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

// 判断事件是否匹配某 action 当前键位
function matchShortcut(action, e) {
  const s = shortcuts.value[action.id]
  if (!s) return false
  return (
    s.ctrl === e.ctrlKey &&
    s.alt === e.altKey &&
    s.shift === e.shiftKey &&
    s.key.toLowerCase() === e.key.toLowerCase()
  )
}

let installed = false
function onKeydown(e) {
  if (!enabled.value) return
  // input 聚焦时不触发（避免打字误触）
  if (isInputFocused()) return
  // Space 且当前焦点是按钮：跳过（避免误触发按钮 click）
  if (e.key === ' ' && document.activeElement?.tagName === 'BUTTON') {
    return
  }

  const playerStore = usePlayerStore()
  const uiStore = useUiStore()

  for (const action of SHORTCUT_ACTIONS) {
    if (!matchShortcut(action, e)) continue
    e.preventDefault()
    switch (action.id) {
      case 'playPause':
        playerStore.togglePlay()
        break
      case 'prev':
        playerStore.prev()
        break
      case 'next':
        playerStore.next()
        break
      case 'volumeUp':
        playerStore.setVolume(
          Math.min(1, playerStore.volume + SHORTCUT_VOLUME_STEP)
        )
        break
      case 'volumeDown':
        playerStore.setVolume(
          Math.max(0, playerStore.volume - SHORTCUT_VOLUME_STEP)
        )
        break
      case 'mute':
        playerStore.toggleMute()
        break
      case 'like':
        toggleLike(playerStore, uiStore)
        break
    }
    return
  }
}

// 喜欢逻辑：当前曲目存在时切换喜欢状态（含 API 同步，避免 fetchLikedTracks 回滚）
async function toggleLike(playerStore, uiStore) {
  const track = playerStore.currentTrack
  if (!track) return
  const userStore = useUserStore()
  const nextLiked = !userStore.isLiked(track.id)
  // 乐观更新 store（按钮立即响应）
  if (nextLiked) {
    userStore.addLikedSong(track.id)
  } else {
    userStore.removeLikedSong(track.id)
  }
  uiStore.showToast(nextLiked ? '已添加到喜欢' : '已取消喜欢', 'success')
  try {
    await likeSong({ id: track.id, like: nextLiked })
  } catch (e) {
    // API 失败回滚 store
    if (nextLiked) {
      userStore.removeLikedSong(track.id)
    } else {
      userStore.addLikedSong(track.id)
    }
    uiStore.showToast('操作失败，请稍后重试', 'error')
    console.error('Like song failed:', e)
  }
}

export function useShortcuts() {
  if (!installed) {
    window.addEventListener('keydown', onKeydown)
    installed = true
  }

  function setEnabled(val) {
    enabled.value = val
    persist()
  }

  // 修改某 action 键位
  function setShortcut(actionId, shortcut) {
    shortcuts.value = { ...shortcuts.value, [actionId]: shortcut }
    persist()
  }

  // 重置某 action 为默认
  function resetShortcut(actionId) {
    shortcuts.value = {
      ...shortcuts.value,
      [actionId]: { ...DEFAULT_SHORTCUTS[actionId] }
    }
    persist()
  }

  // 重置全部
  function resetAllShortcuts() {
    // 深拷贝默认值，避免多 action 共享同一 default 对象引用
    const result = {}
    for (const action of SHORTCUT_ACTIONS) {
      result[action.id] = { ...action.default }
    }
    shortcuts.value = result
    persist()
  }

  // 检查键位是否与其他 action 冲突（返回冲突的 action id，无则 null）
  function findConflict(actionId, shortcut) {
    for (const action of SHORTCUT_ACTIONS) {
      if (action.id === actionId) continue
      const s = shortcuts.value[action.id]
      if (
        s.ctrl === shortcut.ctrl &&
        s.alt === shortcut.alt &&
        s.shift === shortcut.shift &&
        s.key.toLowerCase() === shortcut.key.toLowerCase()
      ) {
        return action
      }
    }
    return null
  }

  return {
    enabled,
    shortcuts,
    setEnabled,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
    findConflict
  }
}
