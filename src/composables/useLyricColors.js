import { computed, reactive, toRefs } from 'vue'
import { STORAGE_KEYS } from '@/constants'

function normalizeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toUpperCase()
    : null
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.LYRIC_COLORS))
    return {
      active: normalizeColor(saved?.active),
      normal: normalizeColor(saved?.normal)
    }
  } catch {
    return { active: null, normal: null }
  }
}

const colors = reactive(restore())
const colorStyle = computed(() => ({
  '--lyric-active-color': colors.active || undefined,
  '--lyric-normal-color': colors.normal || undefined
}))

function save() {
  localStorage.setItem(STORAGE_KEYS.LYRIC_COLORS, JSON.stringify(colors))
}

function setColor(target, value) {
  if (target !== 'active' && target !== 'normal') return false
  const color = normalizeColor(value)
  if (value !== null && !color) return false
  colors[target] = color
  save()
  return true
}

function resetColors() {
  colors.active = null
  colors.normal = null
  save()
}

export function useLyricColors() {
  return { ...toRefs(colors), colorStyle, setColor, resetColors }
}
